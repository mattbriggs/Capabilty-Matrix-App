// Project documents: creation, YAML parsing/serialization and import classification.
import YAML from 'yaml';
import { defaultAudiences, defaultOwnerLabels, defaultTimeline, SUPPORTED_VERSION } from './defaults.js';
import { newProjectId } from './ids.js';
import { isVersion1, migrateV1 } from './migrate.js';
import { compactDocument, normalizeDocument, validateDocument } from './validate.js';

export const nowStamp = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

export function createEmptyDocument({ name = 'Untitled project', description = '', id = newProjectId(), now = nowStamp() } = {}) {
  return normalizeDocument({
    version: SUPPORTED_VERSION,
    project: { id, name, description, createdAt: now, updatedAt: now },
    settings: { ownerLabels: { ...defaultOwnerLabels }, audiences: structuredClone(defaultAudiences), timeline: { ...defaultTimeline } },
    capabilities: [],
  });
}

// YAML 1.2 core schema keeps `2026-10-01` a string, matching the canonical ISO-string dates.
export const parseYaml = (text) => YAML.parse(text, { schema: 'core', uniqueKeys: true, maxAliasCount: 100 });
// Values equal to their schema defaults are omitted; loading fills them back in, so round trips are lossless.
export const toYaml = (doc) => YAML.stringify(compactDocument(doc), { lineWidth: 0, aliasDuplicateObjects: false });

// Classify imported text: a valid v2 document, a v1 document that needs migration, or an invalid input.
export function readDocumentText(text, { projectId = newProjectId(), now = nowStamp(), name } = {}) {
  let raw;
  try { raw = parseYaml(text); } catch (error) {
    return { kind: 'unreadable', issues: [{ severity: 'error', code: 'yaml.syntax', entityType: 'document', entityId: null, path: '', message: `The file is not readable YAML: ${error.message.split('\n')[0]}` }] };
  }
  if (isVersion1(raw)) {
    const { document, notes } = migrateV1(raw, { projectId, now, name });
    const report = validateDocument(document);
    return { kind: 'migration', raw, document: report.ok ? normalizeDocument(document) : document, notes, ...report };
  }
  const report = validateDocument(raw);
  return { kind: 'document', raw, document: report.ok ? normalizeDocument(raw) : raw, ...report };
}

export const stamp = (doc, now = nowStamp()) => ({ ...doc, project: { ...doc.project, updatedAt: now } });
