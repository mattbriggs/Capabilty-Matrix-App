// Migration, YAML round trips, timeline rules and CSV interchange.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createEmptyDocument, parseYaml, readDocumentText, stamp, toYaml } from '../../src/domain/document.js';
import { csvToDocument, documentToCsv, encodeCsv, parseCsv } from '../../src/domain/csv.js';
import { isVersion1, migrateV1 } from '../../src/domain/migrate.js';
import { newProjectId, revisionOf, slug, uniqueId } from '../../src/domain/ids.js';
import { horizonDate, levelLabels, maturityAt, ownerAt, periodLabel, periodStarts, realDate, setMaturityAtDate, snapToPeriod, timelinePeriods } from '../../src/domain/timeline.js';
import { normalizeDocument, validateDocument } from '../../src/domain/validate.js';
import { base, readJson, readText, syntheticDocument } from './helpers.mjs';

test('v1 sample migration matches the Python golden exactly', () => {
  const expected = readJson('tests/fixtures/migration/v1-sample.expected.json');
  const source = parseYaml(readText('tests/fixtures/migration/v1-sample.yaml'));
  const before = structuredClone(source);
  const { document, notes } = migrateV1(source, expected.options);
  assert.deepEqual(document, expected.document);
  assert.deepEqual(notes, expected.notes);
  assert.deepEqual(source, before, 'input is not mutated');
  assert.ok(validateDocument(document).ok);
});

test('migration keeps invalid values visible and refuses non-v1 input', () => {
  const { document } = migrateV1({ version: 1, capabilities: [{ id: 'a', name: 'A', current: 1.5, target: 2, owner: 'typo', levels: [{ name: 'X' }, { name: 'X' }, 'junk'] }] }, { projectId: 'p', now: '2026-10-29T00:00:00Z' });
  assert.equal(document.capabilities[0].owner, 'typo');
  assert.deepEqual(document.capabilities[0].levels.map((l) => l.id ?? l), ['x', 'x-2', 'junk']);
  assert.ok(!validateDocument(document).ok);
  assert.throws(() => migrateV1({ version: 2 }, { projectId: 'p', now: 'n' }), /Only version 1/);
  assert.ok(isVersion1([]) && isVersion1({ capabilities: [] }) && !isVersion1({ version: true }) && !isVersion1(null));
  assert.equal(migrateV1([], { projectId: 'p', now: '2026-10-29T00:00:00Z' }).document.capabilities.length, 0);
});

test('readDocumentText classifies v2, v1, invalid and unreadable input', () => {
  const sample = readDocumentText(readText('src/data/capabilities.yaml'));
  assert.equal(sample.kind, 'document'); assert.ok(sample.ok); assert.deepEqual(sample.issues, []);
  const v1 = readDocumentText(readText('tests/fixtures/migration/v1-sample.yaml'), { projectId: 'prj-1', now: '2026-10-29T00:00:00Z' });
  assert.equal(v1.kind, 'migration'); assert.ok(v1.ok); assert.equal(v1.document.project.id, 'prj-1');
  assert.equal(readDocumentText('version: 999\n').issues[0].code, 'version.unsupported');
  const broken = readDocumentText('a: [1, 2\n');
  assert.equal(broken.kind, 'unreadable'); assert.equal(broken.issues[0].code, 'yaml.syntax');
  assert.equal(readDocumentText('a: 1\na: 2\n').kind, 'unreadable', 'duplicate keys are rejected');
});

test('YAML round trip preserves the document; dates stay ISO strings', () => {
  const doc = syntheticDocument({ count: 20, audiences: 4, periods: 12 });
  const text = toYaml(doc);
  assert.match(text, /asOf: 2026-03-01/);
  assert.deepEqual(normalizeDocument(parseYaml(text)), doc);
  const sample = readDocumentText(readText('src/data/capabilities.yaml')).document;
  assert.equal(toYaml(sample), readText('src/data/capabilities.yaml'), 'the bundled sample is stored in canonical form');
});

test('new empty projects are valid and stamped', () => {
  const doc = createEmptyDocument({ name: 'Plan', now: '2026-10-29T00:00:00Z' });
  assert.ok(validateDocument(doc).ok);
  assert.equal(doc.capabilities.length, 0);
  assert.match(doc.project.id, /^prj-[a-z0-9]{12}$/);
  assert.equal(stamp(doc, '2026-11-01T00:00:00Z').project.updatedAt, '2026-11-01T00:00:00Z');
  assert.notEqual(newProjectId(), newProjectId());
});

test('ids: slugs, uniqueness and the FNV-1a revision shared with Rust', () => {
  assert.equal(slug('Audit Trail'), 'audit-trail');
  assert.equal(uniqueId('Audit trail', ['audit-trail', 'audit-trail-2']), 'audit-trail-3');
  assert.equal(uniqueId('!!!', new Set(), 'level'), 'level');
  assert.equal(revisionOf(''), 'cbf29ce484222325');
  assert.equal(revisionOf('a'), 'af63dc4c8601ec8c');
});

test('timeline rules match the shared Python fixture', () => {
  const rules = readJson('tests/fixtures/timeline/rules.json');
  Object.entries(rules.realDate).forEach(([value, valid]) => assert.equal(Boolean(realDate(value)), valid, value));
  rules.periodStarts.forEach((c) => assert.deepEqual(periodStarts(c.granularity, c.start, c.periods), c.expected));
});

test('timeline helpers: labels, overrides, snapping, interpolation and ownership', () => {
  const timeline = { granularity: 'quarter', start: '2026-01-01', periods: 5, asOf: '2026-04-01' };
  assert.deepEqual(['month', 'quarter', 'biannual', 'year'].map((g) => periodLabel('2026-08-01', g)), ['Aug 2026', 'Q3 2026', 'H2 2026', '2026']);
  const periods = timelinePeriods(timeline, [{ date: '2026-07-01', label: 'Launch', description: 'Go live' }, { date: '2030-01-01', label: 'Hidden' }]);
  assert.deepEqual(periods.map((p) => p.label), ['Q1 2026', 'Q2 2026', 'Launch', 'Q4 2026', 'Q1 2027']);
  assert.equal(periods[2].generatedLabel, 'Q3 2026');
  assert.equal(horizonDate(timeline), '2027-01-01');
  assert.equal(snapToPeriod(periods, '2026-08-15'), '2026-07-01');
  assert.equal(snapToPeriod(periods, '2020-01-01'), '2026-01-01');
  assert.equal(snapToPeriod([], '2020-01-01'), '2020-01-01');
  const cap = { current: 0, target: 4, milestones: [{ date: '2026-07-01', maturity: 3 }], handoffDate: '2026-10-01', owner: 'appliance', futureOwner: 'federated' };
  assert.deepEqual(periods.map((p) => maturityAt(cap, timeline, p.date)), [0, 0, 3, 4, 4]);
  assert.equal(maturityAt({ ...cap, milestones: [] }, timeline, '2026-07-01'), 1, 'rounded linear interpolation');
  assert.deepEqual(periods.map((p) => ownerAt(cap, timeline, p.date)), ['appliance', 'appliance', 'appliance', 'federated', 'federated']);
  assert.deepEqual(levelLabels(3), ['0', '1', '2+']);
  assert.deepEqual(levelLabels(1), ['0']);
});

test('setMaturityAtDate edits anchors or a dated milestone, never a calculated value', () => {
  const timeline = { granularity: 'quarter', start: '2026-01-01', periods: 5, asOf: '2026-04-01' };
  const cap = { current: 1, target: 3, milestones: [{ date: '2026-10-01', maturity: 2, note: 'keep' }] };
  assert.deepEqual(setMaturityAtDate(cap, timeline, '2026-04-01', 4), { ...cap, current: 4, target: 4 });
  assert.deepEqual(setMaturityAtDate(cap, timeline, '2027-01-01', 0), { ...cap, target: 0, current: 0 });
  assert.deepEqual(setMaturityAtDate(cap, timeline, '2026-10-01', 3).milestones, [{ date: '2026-10-01', maturity: 3, note: 'keep' }]);
  assert.deepEqual(setMaturityAtDate(cap, timeline, '2026-07-01', 2).milestones.map((m) => m.date), ['2026-07-01', '2026-10-01']);
});

test('CSV round trip preserves the complete document, including views and extensions', () => {
  for (const doc of [base(), syntheticDocument({ count: 30, audiences: 5, periods: 12 }), readDocumentText(readText('src/data/capabilities.yaml')).document]) {
    const withExtras = { ...doc, custom: { a: 1 }, extensions: { note: 'line1\nline2, "quoted"' } };
    const parsed = csvToDocument(documentToCsv(withExtras));
    assert.deepEqual(parsed.issues, []);
    assert.deepEqual(normalizeDocument(parsed.document), normalizeDocument(withExtras));
    assert.ok(validateDocument(parsed.document).issues.every((i) => i.code === 'field.unsupported'));
  }
});

test('CSV encoding: quotes, commas, newlines, unicode, BOM and LF endings', () => {
  const rows = [['a', 'b,c', 'say "hi"', 'line\nbreak', ' pad', 'ünïcødé']];
  assert.deepEqual(parseCsv(encodeCsv(rows)), rows);
  assert.deepEqual(parseCsv('﻿a,b\nc,d\n'), [['a', 'b'], ['c', 'd']]);
  assert.deepEqual(parseCsv('a,b'), [['a', 'b']]);
  assert.throws(() => parseCsv('"open'), /quoted field/);
});

test('CSV import rejects unsupported, duplicate and conflicting rows atomically', () => {
  const good = documentToCsv(base()).trimEnd().split('\r\n');
  const run = (lines) => csvToDocument(`${lines.join('\r\n')}\r\n`);
  const codes = (lines) => run(lines).issues.map((i) => i.code);
  assert.deepEqual(codes(['name,value', ...good.slice(1)]), ['csv.header']);
  assert.deepEqual(codes([good[0], good[1].replace(/^1,/, '9,'), ...good.slice(2)]), ['csv.version', 'csv.missing']);
  assert.deepEqual(codes([...good, good.at(-1)]), ['csv.duplicate']);
  assert.deepEqual(codes([good[0], good[1], good[2], '1,widget,x,,{}']), ['csv.recordType']);
  assert.deepEqual(codes([good[0], good[1], good[2], '1,domain,x,,{oops}']), ['csv.payload']);
  assert.deepEqual(codes([good[0], good[1], good[2], '1,domain,x,,"{""id"":""y"",""name"":""Y""}"']), ['csv.conflict']);
  assert.deepEqual(codes([good[0], good[1].replace('prj-fixture,', 'other,'), good[2]]), ['csv.conflict']);
  assert.deepEqual(codes([good[0], '1,settings']), ['csv.columns', 'csv.missing', 'csv.missing']);
  assert.equal(run([...good, good.at(-1)]).document, null, 'no partial document on error');
  assert.deepEqual(csvToDocument('"bad').issues[0].code, 'csv.syntax');
  assert.deepEqual(run(good).counts, { project: 1, settings: 1, presentation: 1, extensions: 1, domain: 1, capability: 3, 'map-view': 1 });
});
