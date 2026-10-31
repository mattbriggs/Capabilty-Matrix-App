// Relation projection for the data table. At a date, each capability contributes its ID, audience
// memberships, domain membership, capability-qualified maturity stage and owner. Pairing two dimensions
// projects these facts; a cell lists matching capabilities. Empty means "No recorded relationship",
// never zero maturity. Missing optional memberships fall into an Unassigned bucket.
import { dimensions } from './defaults.js';
import { encodeCsv } from './csv.js';
import { maturityAt, ownerAt, timelinePeriods } from './timeline.js';

export const UNASSIGNED = '__unassigned';
export const dimensionLabel = (id) => dimensions.find((d) => d.id === id)?.label || id;

export function filteredCapabilities(doc, filters = {}) {
  const ids = new Set((filters.capabilityIds || []).filter((id) => doc.capabilities.some((cap) => cap.id === id)));
  const search = (filters.search || '').trim().toLowerCase();
  return doc.capabilities.filter((cap) => (!ids.size || ids.has(cap.id)) && (!search || cap.name.toLowerCase().includes(search) || cap.id.includes(search)));
}

export function factsAt(doc, cap, date) {
  const audiences = new Set(doc.settings.audiences.map((a) => a.id));
  const domains = new Set(doc.domains.map((d) => d.id));
  const memberships = cap.audienceIds.filter((id) => audiences.has(id));
  const rank = maturityAt(cap, doc.settings.timeline, date);
  return {
    capability: [cap.id],
    maturity: [String(rank)],
    audience: memberships.length ? [...new Set(memberships)] : [UNASSIGNED],
    domain: [cap.domainId && domains.has(cap.domainId) ? cap.domainId : UNASSIGNED],
    rank,
    owner: ownerAt(cap, doc.settings.timeline, date),
    level: cap.levels[rank] || null,
  };
}

export function dimensionHeaders(doc, dim, caps) {
  const unassigned = { key: UNASSIGNED, label: 'Unassigned', sublabel: 'No recorded membership', entity: null, unassigned: true };
  if (dim === 'capability') return caps.map((cap) => ({ key: cap.id, label: cap.name, sublabel: cap.id, entity: { type: 'capability', id: cap.id } }));
  if (dim === 'maturity') {
    const top = Math.max(0, ...caps.map((cap) => cap.levels.length - 1));
    const single = caps.length === 1 ? caps[0] : null;
    return Array.from({ length: top + 1 }, (_, rank) => ({
      key: String(rank), label: `M${rank}`, sublabel: single ? single.levels[rank]?.name : `${caps.filter((cap) => cap.levels.length > rank).length} capabilities define this stage`,
      entity: single && single.levels[rank] ? { type: 'level', capabilityId: single.id, id: single.levels[rank].id } : null,
    }));
  }
  if (dim === 'audience') return [...doc.settings.audiences.map((a) => ({ key: a.id, label: a.label, sublabel: a.description, entity: { type: 'audience', id: a.id } })), unassigned];
  if (dim === 'domain') return [...doc.domains.map((d) => ({ key: d.id, label: d.name, sublabel: d.description, entity: { type: 'domain', id: d.id }, color: d.color })), unassigned];
  if (dim === 'time') return timelinePeriods(doc.settings.timeline, doc.timeSegments).map((p) => ({ key: p.date, label: p.label, sublabel: p.date, entity: { type: 'timeSegment', id: p.date } }));
  throw new Error(`Unknown dimension ${dim}`);
}

export const cellKey = (rowKey, columnKey) => `${rowKey}\u0000${columnKey}`;

// config: { xAxis, yAxis, filters: { search, capabilityIds } }; focusDate is the shared Focus date.
export function buildRelationTable(doc, config, focusDate) {
  const { xAxis, yAxis } = config;
  if (xAxis === yAxis) return { status: 'sameAxis', columns: [], rows: [], cells: new Map() };
  const caps = filteredCapabilities(doc, config.filters);
  const usesMaturity = xAxis === 'maturity' || yAxis === 'maturity';
  if (usesMaturity && !(config.filters?.capabilityIds || []).some((id) => doc.capabilities.some((cap) => cap.id === id))) {
    return { status: 'needsCapabilityFilter', columns: [], rows: [], cells: new Map() };
  }
  const columns = dimensionHeaders(doc, xAxis, caps);
  const rows = dimensionHeaders(doc, yAxis, caps);
  const cells = new Map();
  const addAll = (cap, facts, date) => {
    facts[yAxis].forEach((rowKey) => facts[xAxis].forEach((columnKey) => {
      const key = cellKey(rowKey, columnKey);
      if (!cells.has(key)) cells.set(key, []);
      cells.get(key).push({ capabilityId: cap.id, name: cap.name, rank: facts.rank, owner: facts.owner, levelName: facts.level?.name || '', date });
    }));
  };
  const usesTime = xAxis === 'time' || yAxis === 'time';
  if (usesTime) {
    // Evaluate maturity and ownership at each segment start.
    timelinePeriods(doc.settings.timeline).forEach(({ date }) => caps.forEach((cap) => addAll(cap, { ...factsAt(doc, cap, date), time: [date] }, date)));
  } else {
    caps.forEach((cap) => addAll(cap, { ...factsAt(doc, cap, focusDate), time: [] }, focusDate));
  }
  return { status: 'ok', columns, rows, cells };
}

// Readable, explicitly non-round-trip export of the currently filtered table.
export function tableReportCsv(table, config, ownerLabels) {
  const head = [`${dimensionLabel(config.yAxis)} \\ ${dimensionLabel(config.xAxis)}`, ...table.columns.map((c) => c.label)];
  const body = table.rows.map((row) => [row.label, ...table.columns.map((column) => (table.cells.get(cellKey(row.key, column.key)) || [])
    .map((item) => (config.xAxis === 'time' || config.yAxis === 'time' ? `${item.name} (M${item.rank}, ${ownerLabels[item.owner]})` : item.name)).join('; '))]);
  return encodeCsv([['Report: not a project import format'], head, ...body]);
}
