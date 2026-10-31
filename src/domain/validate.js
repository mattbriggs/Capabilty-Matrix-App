// Validation pipeline: version gate → structural (generated JSON Schema) → unsupported fields → semantic rules.
// Validates raw input before any normalization. Twin of sidecar/capmatrix/validation/pipeline.py.
import schema from '../data/schema/capability-project.schema.json' with { type: 'json' };
import { SUPPORTED_VERSION } from './defaults.js';
import { hasErrors, makeIssue, pathString, sortIssues } from './issues.js';
import { createSchemaTools } from './schemaValidator.js';
import { semantic } from './semantic.js';

export const projectSchema = schema;
const tools = createSchemaTools(schema);
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

export function versionGate(raw) {
  if (!isObject(raw)) return [makeIssue(raw, 'error', 'document.type', [], 'The file is not a capability project document. Import a YAML mapping with version, project, settings and capabilities.')];
  if (!('version' in raw)) return [makeIssue(raw, 'error', 'version.missing', ['version'], 'The document has no version. Add `version: 2`, or import it as a version 1 document to migrate it.')];
  const { version } = raw;
  const isInt = typeof version === 'number' && Number.isInteger(version);
  if (isInt && version === SUPPORTED_VERSION) return [];
  if (isInt && version === 1) return [makeIssue(raw, 'error', 'version.migrationRequired', ['version'], 'This is a version 1 document. Migrate it to version 2 (the original is kept) before editing.')];
  if (isInt && version > SUPPORTED_VERSION) return [makeIssue(raw, 'error', 'version.unsupported', ['version'], `This document uses version ${version}, created by a newer release. This app supports version ${SUPPORTED_VERSION}; update the app to open it.`)];
  return [makeIssue(raw, 'error', 'version.unsupported', ['version'], `Unsupported document version ${JSON.stringify(version)}. This app supports version ${SUPPORTED_VERSION}.`)];
}

export function validateDocument(raw) {
  const gate = versionGate(raw);
  if (gate.length) return report(gate);
  const structural = tools.validate(raw).map((error) => makeIssue(raw, 'error', error.code, error.parts, error.message));
  if (structural.length) return report(structural);
  const unsupported = tools.unsupported(raw).map((parts) => makeIssue(raw, 'warning', 'field.unsupported', parts, `\`${pathString(parts)}\` is not part of the version 2 format. It is kept as-is; move custom data under \`extensions\` to silence this warning.`));
  return report([...unsupported, ...semantic(tools.withDefaults(raw))]);
}

const report = (issues) => { const sorted = sortIssues(issues); return { ok: !hasErrors(sorted), issues: sorted }; };

// Defaults-filled document (same shape as Pydantic's model_dump). Call only on structurally valid input.
export const normalizeDocument = (raw) => tools.withDefaults(raw);
// Inverse of normalizeDocument for serialization: omits values equal to their defaults.
export const compactDocument = (doc) => tools.compact(doc);

// Validate a single entity draft in the context of its candidate document; returns that entity's issues.
export function issuesUnder(issues, prefix) {
  return issues.filter((issue) => issue.path === prefix || issue.path.startsWith(`${prefix}.`));
}
