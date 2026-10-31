// Lossless CSV interchange: one versioned CSV with typed rows.
// Columns: format_version,record_type,record_id,parent_id,payload_json. Nested data stays JSON in payload_json.
// Arbitrary third-party column mapping is out of scope; the readable table report is a separate export.

export const CSV_FORMAT_VERSION = '1';
export const CSV_HEADER = ['format_version', 'record_type', 'record_id', 'parent_id', 'payload_json'];
const SINGLETONS = { project: 'project', settings: 'settings', presentation: 'presentation', extensions: 'extensions', document: 'document' };
const COLLECTIONS = { domain: ['domains', 'id'], 'time-segment': ['timeSegments', 'date'], capability: ['capabilities', 'id'], 'map-view': ['mapViews', 'id'] };
const KNOWN_ROOT = new Set(['version', 'project', 'settings', 'presentation', 'extensions', 'domains', 'timeSegments', 'capabilities', 'mapViews']);
export const CSV_RECORD_TYPES = [...Object.keys(SINGLETONS), ...Object.keys(COLLECTIONS)];

export function encodeCsvField(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\r\n]/.test(text) || /^\s|\s$/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
export const encodeCsv = (rows) => `${rows.map((row) => row.map(encodeCsvField).join(',')).join('\r\n')}\r\n`;

// RFC 4180 parser; tolerates LF line endings and a UTF-8 byte-order mark.
export function parseCsv(text) {
  const input = text.replace(/^﻿/, '');
  const rows = []; let row = []; let field = ''; let quoted = false; let i = 0;
  while (i < input.length) {
    const ch = input[i];
    if (quoted) {
      if (ch === '"' && input[i + 1] === '"') { field += '"'; i += 2; continue; }
      if (ch === '"') { quoted = false; i += 1; continue; }
      field += ch; i += 1; continue;
    }
    if (ch === '"' && field === '') { quoted = true; i += 1; continue; }
    if (ch === ',') { row.push(field); field = ''; i += 1; continue; }
    if (ch === '\r' || ch === '\n') {
      row.push(field); rows.push(row); row = []; field = '';
      i += ch === '\r' && input[i + 1] === '\n' ? 2 : 1; continue;
    }
    field += ch; i += 1;
  }
  if (quoted) throw new Error('The CSV ends inside a quoted field.');
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => !(r.length === 1 && r[0] === ''));
}

export function documentToCsv(doc) {
  const rows = [CSV_HEADER];
  const push = (type, id, payload) => rows.push([CSV_FORMAT_VERSION, type, id, '', JSON.stringify(payload)]);
  push('project', doc.project.id, doc.project);
  push('settings', 'settings', doc.settings);
  if (doc.presentation) push('presentation', 'presentation', doc.presentation);
  if (doc.extensions && Object.keys(doc.extensions).length) push('extensions', 'extensions', doc.extensions);
  const rest = Object.fromEntries(Object.entries(doc).filter(([key]) => !KNOWN_ROOT.has(key)));
  if (Object.keys(rest).length) push('document', 'document', rest);
  Object.entries(COLLECTIONS).forEach(([type, [key, idKey]]) => (doc[key] || []).forEach((item) => push(type, item[idKey], item)));
  return encodeCsv(rows);
}

const csvIssue = (row, code, message) => ({ severity: 'error', code, entityType: 'document', entityId: null, path: row === null ? 'csv' : `csv.row.${row}`, message });

// Rebuild a document from CSV. Returns counts per record type and CSV-level issues; the caller then
// validates the reconstructed document atomically before applying anything.
export function csvToDocument(text) {
  let rows;
  try { rows = parseCsv(text); } catch (error) { return { document: null, counts: {}, issues: [csvIssue(null, 'csv.syntax', error.message)] }; }
  const issues = []; const counts = {};
  if (!rows.length || rows[0].join(',') !== CSV_HEADER.join(',')) {
    return { document: null, counts, issues: [csvIssue(1, 'csv.header', `The first row must be exactly: ${CSV_HEADER.join(',')}. Third-party column layouts are not supported.`)] };
  }
  const doc = { version: 2, capabilities: [], domains: [], timeSegments: [], mapViews: [] };
  const seen = new Map();
  rows.slice(1).forEach((row, offset) => {
    const line = offset + 2;
    if (row.length !== CSV_HEADER.length) { issues.push(csvIssue(line, 'csv.columns', `Row ${line} has ${row.length} columns; expected ${CSV_HEADER.length}.`)); return; }
    const [version, type, recordId, , payloadText] = row;
    if (version !== CSV_FORMAT_VERSION) { issues.push(csvIssue(line, 'csv.version', `Row ${line} uses CSV format version "${version}". This app reads format version ${CSV_FORMAT_VERSION}.`)); return; }
    if (!SINGLETONS[type] && !COLLECTIONS[type]) { issues.push(csvIssue(line, 'csv.recordType', `Row ${line} has unknown record type "${type}". Expected one of ${CSV_RECORD_TYPES.join(', ')}.`)); return; }
    let payload;
    try { payload = JSON.parse(payloadText); } catch (error) { issues.push(csvIssue(line, 'csv.payload', `Row ${line} payload_json is not valid JSON: ${error.message}`)); return; }
    const key = `${type}\u0000${SINGLETONS[type] ? '' : recordId}`;
    if (seen.has(key)) { issues.push(csvIssue(line, 'csv.duplicate', `Row ${line} repeats ${type} "${recordId}" from row ${seen.get(key)}. Remove one of the rows.`)); return; }
    seen.set(key, line);
    counts[type] = (counts[type] || 0) + 1;
    if (SINGLETONS[type]) {
      if (type === 'document') Object.assign(doc, Object.fromEntries(Object.entries(payload || {}).filter(([k]) => !KNOWN_ROOT.has(k))));
      else doc[SINGLETONS[type]] = payload;
      if (type === 'project' && payload?.id !== recordId) issues.push(csvIssue(line, 'csv.conflict', `Row ${line} record_id "${recordId}" does not match the project id in payload_json.`));
      return;
    }
    const [collection, idKey] = COLLECTIONS[type];
    if (payload?.[idKey] !== recordId) issues.push(csvIssue(line, 'csv.conflict', `Row ${line} record_id "${recordId}" does not match ${idKey} "${payload?.[idKey]}" in payload_json.`));
    doc[collection].push(payload);
  });
  ['project', 'settings'].forEach((type) => { if (!counts[type]) issues.push(csvIssue(null, 'csv.missing', `The CSV has no ${type} row.`)); });
  return { document: issues.length ? null : doc, counts, issues };
}
