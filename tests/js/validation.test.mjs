// Browser validator: the same fixture contract as tests/python/test_validation_fixtures.py.
import assert from 'node:assert/strict';
import test from 'node:test';
import { applyCase, issueKeys } from '../fixtures/apply.mjs';
import { createSchemaTools, deepEqual, schemaKeywords, SUPPORTED_KEYWORDS } from '../../src/domain/schemaValidator.js';
import { compactDocument, issuesUnder, normalizeDocument, projectSchema, validateDocument, versionGate } from '../../src/domain/validate.js';
import { entityFor, hasErrors, pathParts, sortIssues } from '../../src/domain/issues.js';
import { base, cases, readJson, readText } from './helpers.mjs';

for (const testCase of cases.cases) {
  test(`fixture: ${testCase.name}`, () => {
    const report = validateDocument(applyCase(cases.base, testCase));
    assert.deepEqual(issueKeys(report.issues), testCase.expect);
    assert.equal(report.ok, !testCase.expect.some((issue) => issue.severity === 'error'));
  });
}

test('the browser validator understands every keyword in the generated schema', () => {
  const unsupported = [...schemaKeywords(projectSchema)].filter((k) => !SUPPORTED_KEYWORDS.has(k));
  assert.deepEqual(unsupported, []);
});

test('imported schema is the committed file the Python contract generates', () => {
  assert.deepEqual(projectSchema, JSON.parse(readText('src/data/schema/capability-project.schema.json')));
});

test('defaults match the golden produced by Pydantic model_dump', () => {
  assert.deepEqual(normalizeDocument(structuredClone(cases.base)), readJson('tests/fixtures/normalize/base.expected.json'));
});

test('compact then normalize is lossless and omits defaults', () => {
  const doc = base();
  const compact = compactDocument(doc);
  assert.equal(compact.capabilities[1].summary, undefined);
  assert.equal(compact.presentation.journeySections, undefined);
  assert.deepEqual(normalizeDocument(compact), doc);
});

test('non-finite numbers are structural errors in the browser', () => {
  const doc = base();
  doc.mapViews[0].viewport.zoom = Infinity;
  doc.mapViews[0].placements[0].x = NaN;
  const paths = validateDocument(doc).issues.map((i) => [i.path, i.code]);
  assert.deepEqual(paths, [['mapViews.0.placements.0.x', 'schema.type'], ['mapViews.0.viewport.zoom', 'schema.type']]);
});

test('unknown fields survive normalization and are reported', () => {
  const doc = { ...structuredClone(cases.base), custom: { keep: true } };
  assert.deepEqual(normalizeDocument(doc).custom, { keep: true });
  assert.equal(validateDocument(doc).issues[0].code, 'field.unsupported');
});

test('blank labels get a plain-language message', () => {
  const doc = base(); doc.capabilities[0].name = ' ';
  assert.match(validateDocument(doc).issues[0].message, /cannot be blank/);
});

test('version gate classifies inputs', () => {
  assert.equal(versionGate(null)[0].code, 'document.type');
  assert.equal(versionGate({})[0].code, 'version.missing');
  assert.equal(versionGate({ version: 1 })[0].code, 'version.migrationRequired');
  assert.match(versionGate({ version: 7 })[0].message, /newer release/);
  assert.deepEqual(versionGate({ version: 2 }), []);
});

test('issue helpers', () => {
  assert.deepEqual(pathParts('capabilities.0.levels.2.name'), ['capabilities', 0, 'levels', 2, 'name']);
  assert.deepEqual(pathParts(''), []);
  assert.deepEqual(entityFor(cases.base, ['capabilities', 0, 'levels', 1]), ['level', 'alpha/l1']);
  assert.deepEqual(entityFor(cases.base, ['timeSegments', 0]), ['timeSegment', null]);
  assert.deepEqual(entityFor(null, ['project']), ['project', null]);
  const issues = [{ path: 'b', code: 'x', severity: 'error', entityType: 'document', entityId: null }, { path: 'a', code: 'y', severity: 'warning', entityType: 'document', entityId: null }];
  assert.deepEqual(sortIssues(issues).map((i) => i.path), ['a', 'b']);
  assert.equal(hasErrors(issues), true);
  assert.deepEqual(issuesUnder([{ path: 'capabilities.1' }, { path: 'capabilities.10.x' }, { path: 'capabilities.1.name' }], 'capabilities.1').map((i) => i.path), ['capabilities.1', 'capabilities.1.name']);
});

test('schema tools handle general anyOf, const and nullable branches', () => {
  const tools = createSchemaTools({ $defs: { N: { type: 'integer', minimum: 1 } }, type: 'object', required: ['a'], properties: {
    a: { anyOf: [{ type: 'string' }, { type: 'integer' }] }, b: { const: 3 }, c: { anyOf: [{ $ref: '#/$defs/N' }, { type: 'null' }], default: null }, d: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 2 } } });
  assert.deepEqual(tools.validate({ a: 1 }), []);
  assert.deepEqual(tools.validate({ a: true, b: 4, c: 0, d: [] }).map((e) => e.code), ['schema.type', 'schema.enum', 'schema.minimum', 'schema.minItems']);
  assert.deepEqual(tools.validate({ a: 's', d: ['a', 'b', 'c'] }).map((e) => e.code), ['schema.maxItems']);
  assert.deepEqual(tools.withDefaults({ a: 's' }), { a: 's', c: null });
  assert.throws(() => createSchemaTools({ $ref: '#/$defs/Missing' }).validate({}), /Unresolvable/);
  assert.ok(deepEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] }));
  assert.ok(!deepEqual({ a: 1 }, { a: 1, b: 2 }) && !deepEqual([1], { 0: 1 }) && !deepEqual({ a: 1 }, null));
});

test('validator never throws on hostile input', () => {
  const junk = [null, true, -1, 1.5, '', 'x'.repeat(300), [], {}, [null], { a: { b: [] } }, '2026-02-30', Infinity];
  let seed = 20261029;
  const rand = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  const paths = [];
  const walk = (node, prefix) => { if (prefix.length) paths.push(prefix); if (node && typeof node === 'object') Object.keys(node).forEach((k) => walk(node[k], [...prefix, Array.isArray(node) ? Number(k) : k])); };
  walk(cases.base, []);
  for (let i = 0; i < 400; i += 1) {
    const doc = structuredClone(cases.base);
    const path = paths[Math.floor(rand() * paths.length)];
    let target = doc; path.slice(0, -1).forEach((p) => { target = target[p]; });
    target[path.at(-1)] = structuredClone(junk[Math.floor(rand() * junk.length)]);
    assert.ok(Array.isArray(validateDocument(doc).issues));
  }
});
