// Relation projection (R4 / gate A3) and document operations (R3 / gate A2).
import assert from 'node:assert/strict';
import test from 'node:test';
import { dimensions } from '../../src/domain/defaults.js';
import { applyLevels, deleteEntity, impactOf, newAudience, newCapability, newDomain, addCapability, setCapabilityDomain, setGuidance, timelineImpact, toggleAudienceMembership, upsertAudience, upsertDomain, upsertSegmentOverride, updateCapability, hasDefinition, findCapability } from '../../src/domain/operations.js';
import { buildRelationTable, cellKey, dimensionHeaders, filteredCapabilities, tableReportCsv, UNASSIGNED } from '../../src/domain/projection.js';
import { audienceMembers, guidanceFor, journeySections, knownLevels, unassignedToAudience } from '../../src/domain/selectors.js';
import { periodStarts } from '../../src/domain/timeline.js';
import { validateDocument } from '../../src/domain/validate.js';
import { base, percentile, syntheticDocument } from './helpers.mjs';

const focus = '2026-07-01';
const ids = dimensions.map((d) => d.id);
const pairs = ids.flatMap((x) => ids.filter((y) => y !== x).map((y) => [x, y]));

test('all 20 ordered distinct axis pairs build a table', () => {
  assert.equal(pairs.length, 20);
  const doc = base();
  for (const [xAxis, yAxis] of pairs) {
    const filters = { search: '', capabilityIds: xAxis === 'maturity' || yAxis === 'maturity' ? ['alpha', 'beta'] : [] };
    const table = buildRelationTable(doc, { xAxis, yAxis, filters }, focus);
    assert.equal(table.status, 'ok', `${xAxis}×${yAxis}`);
    assert.ok(table.columns.length && table.rows.length);
    const swapped = buildRelationTable(doc, { xAxis: yAxis, yAxis: xAxis, filters }, focus);
    assert.equal([...table.cells.values()].flat().length, [...swapped.cells.values()].flat().length, 'swap keeps the same relationships');
  }
});

test('same axis is impossible and maturity requires a capability filter', () => {
  assert.equal(buildRelationTable(base(), { xAxis: 'domain', yAxis: 'domain', filters: {} }, focus).status, 'sameAxis');
  assert.equal(buildRelationTable(base(), { xAxis: 'maturity', yAxis: 'capability', filters: { capabilityIds: [] } }, focus).status, 'needsCapabilityFilter');
  assert.equal(buildRelationTable(base(), { xAxis: 'maturity', yAxis: 'capability', filters: { capabilityIds: ['ghost'] } }, focus).status, 'needsCapabilityFilter');
});

test('cell semantics: empty is no relationship; unassigned buckets show missing memberships', () => {
  const doc = base();
  const table = buildRelationTable(doc, { xAxis: 'capability', yAxis: 'audience', filters: {} }, focus);
  assert.deepEqual(table.cells.get(cellKey('client', 'alpha')).map((c) => c.capabilityId), ['alpha']);
  assert.equal(table.cells.get(cellKey('consultant', 'alpha')), undefined);
  assert.deepEqual(table.cells.get(cellKey(UNASSIGNED, 'beta')).map((c) => c.capabilityId), ['beta']);
  const byDomain = buildRelationTable(doc, { xAxis: 'domain', yAxis: 'audience', filters: {} }, focus);
  assert.deepEqual(byDomain.cells.get(cellKey(UNASSIGNED, UNASSIGNED)).map((c) => c.capabilityId), ['beta', 'gamma'], 'aggregate cells list every match');
  assert.equal(byDomain.rows.at(-1).label, 'Unassigned');
});

test('maturity stage headings are capability-qualified and occupancy uses the Focus date', () => {
  const doc = base();
  const single = buildRelationTable(doc, { xAxis: 'maturity', yAxis: 'capability', filters: { capabilityIds: ['alpha'] } }, focus);
  assert.deepEqual(single.columns.map((c) => c.sublabel), ['Zero', 'One', 'Two']);
  assert.deepEqual(single.columns[1].entity, { type: 'level', capabilityId: 'alpha', id: 'l1' });
  assert.deepEqual(single.cells.get(cellKey('alpha', '1')).map((c) => c.levelName), ['One'], 'milestone M1 at 2026-07-01');
  const many = buildRelationTable(doc, { xAxis: 'maturity', yAxis: 'capability', filters: { capabilityIds: ['alpha', 'beta'] } }, focus);
  assert.equal(many.columns[0].entity, null, 'no single level definition to edit across capabilities');
});

test('time segment axis evaluates maturity and owner at each segment start', () => {
  const doc = base();
  const table = buildRelationTable(doc, { xAxis: 'time', yAxis: 'capability', filters: {} }, focus);
  const alpha = table.columns.map((c) => table.cells.get(cellKey('alpha', c.key))[0]);
  assert.deepEqual(alpha.map((a) => a.rank), [0, 0, 1, 2, 2]);
  assert.deepEqual(alpha.map((a) => a.owner), ['appliance', 'appliance', 'appliance', 'federated', 'federated']);
});

test('filters and headers', () => {
  const doc = base();
  assert.deepEqual(filteredCapabilities(doc, { search: 'GAM' }).map((c) => c.id), ['gamma']);
  assert.deepEqual(filteredCapabilities(doc, { capabilityIds: ['beta', 'ghost'] }).map((c) => c.id), ['beta']);
  assert.throws(() => dimensionHeaders(doc, 'owner', []), /Unknown dimension/);
  const report = tableReportCsv(buildRelationTable(doc, { xAxis: 'time', yAxis: 'capability', filters: {} }, focus), { xAxis: 'time', yAxis: 'capability' }, doc.settings.ownerLabels);
  assert.match(report, /^Report: not a project import format/);
  assert.match(report, /Alpha \(M1, Appliance\)/);
});

test('A7 budget: filter/axis actions on 250 capabilities × 20 audiences × 60 periods stay under 200 ms p95', () => {
  const doc = syntheticDocument();
  const started = performance.now();
  assert.ok(validateDocument(doc).ok);
  assert.ok(performance.now() - started < 1000, 'open/validate ≤ 1 s');
  const timings = [];
  for (let run = 0; run < 25; run += 1) {
    const [xAxis, yAxis] = pairs[run % pairs.length];
    const filters = { search: run % 2 ? '1' : '', capabilityIds: xAxis === 'maturity' || yAxis === 'maturity' ? ['c1', 'c2', 'c3'] : [] };
    const t = performance.now();
    buildRelationTable(doc, { xAxis, yAxis, filters }, '2027-01-01');
    if (run >= 5) timings.push(performance.now() - t);
  }
  assert.ok(percentile(timings, 95) < 200, `p95 ${percentile(timings, 95).toFixed(1)} ms`);
});

test('membership, domain and guidance operations', () => {
  let doc = base();
  doc = toggleAudienceMembership(doc, 'beta', 'consultant');
  assert.deepEqual(findCapability(doc, 'beta').audienceIds, ['consultant']);
  doc = toggleAudienceMembership(doc, 'beta', 'consultant');
  assert.deepEqual(findCapability(doc, 'beta').audienceIds, []);
  doc = setCapabilityDomain(doc, 'beta', 'core');
  assert.equal(findCapability(doc, 'beta').domainId, 'core');
  assert.deepEqual(setGuidance([{ audienceId: 'a', levelId: 'l', text: 'x' }], 'a', 'l', ''), []);
  assert.deepEqual(setGuidance([], 'a', 'l', 'y'), [{ audienceId: 'a', levelId: 'l', text: 'y' }]);
  assert.throws(() => updateCapability(doc, { id: 'ghost' }), /not found/);
  assert.ok(validateDocument(doc).ok);
});

test('creating records generates stable unique IDs and valid documents', () => {
  let doc = base();
  const cap = newCapability(doc, 'Alpha');
  assert.equal(cap.id, 'alpha-2');
  doc = addCapability(doc, cap);
  doc = upsertAudience(doc, newAudience(doc, 'Client'));
  doc = upsertDomain(doc, newDomain(doc, 'Core', '#ffffff'));
  assert.deepEqual(doc.settings.audiences.map((a) => a.id), ['client', 'consultant', 'client-2']);
  assert.deepEqual(doc.domains.map((d) => d.id), ['core', 'core-2']);
  doc = upsertAudience(doc, { ...doc.settings.audiences[0], label: 'Customer' });
  doc = upsertDomain(doc, { ...doc.domains[0], name: 'Kernel' });
  assert.equal(doc.settings.audiences[0].label, 'Customer');
  assert.ok(validateDocument(doc).ok);
  assert.equal(hasDefinition(cap), false);
});

test('segment overrides are keyed by date and removed when empty', () => {
  let doc = upsertSegmentOverride(base(), { date: '2026-07-01', label: 'Launch', description: '' });
  doc = upsertSegmentOverride(doc, { date: '2026-04-01', label: '', description: 'Note' });
  assert.deepEqual(doc.timeSegments.map((s) => s.date), ['2026-04-01', '2026-07-01']);
  doc = upsertSegmentOverride(doc, { date: '2026-07-01', label: ' ', description: '' });
  assert.deepEqual(doc.timeSegments.map((s) => s.date), ['2026-04-01']);
});

test('deletion previews references and never cascades silently', () => {
  const doc = base();
  assert.deepEqual(impactOf(doc, { type: 'capability', id: 'beta' }).map((r) => r.label), ['Alpha']);
  assert.ok(impactOf(doc, { type: 'capability', id: 'alpha' }).some((r) => /pruned/.test(r.detail)));
  const removed = deleteEntity(doc, { type: 'capability', id: 'beta' });
  assert.deepEqual(findCapability(removed, 'alpha').dependencies, []);
  const reassigned = deleteEntity(doc, { type: 'capability', id: 'beta' }, { mode: 'reassign', to: 'gamma' });
  assert.deepEqual(findCapability(reassigned, 'alpha').dependencies, ['gamma']);
  const noPlacement = deleteEntity(doc, { type: 'capability', id: 'alpha' });
  assert.equal(noPlacement.mapViews[0].placements.length, 0);
  [removed, reassigned, noPlacement].forEach((d) => assert.ok(validateDocument(d).ok));
});

test('deleting the last capability leaves a valid empty project', () => {
  let doc = base();
  ['alpha', 'beta', 'gamma'].forEach((id) => { doc = deleteEntity(doc, { type: 'capability', id }); });
  assert.equal(doc.capabilities.length, 0);
  assert.ok(validateDocument(doc).ok);
});

test('audience and domain deletion with remove or reassign', () => {
  const doc = base();
  assert.ok(impactOf(doc, { type: 'audience', id: 'client' }).length >= 2);
  const moved = deleteEntity(doc, { type: 'audience', id: 'client' }, { mode: 'reassign', to: 'consultant' });
  assert.deepEqual(findCapability(moved, 'alpha').audienceIds, ['consultant']);
  assert.deepEqual(findCapability(moved, 'alpha').journey.guidance.map((g) => g.audienceId), ['consultant']);
  const dropped = deleteEntity(doc, { type: 'audience', id: 'consultant' });
  assert.deepEqual(dropped.presentation.defaultGuidance, []);
  const domainGone = deleteEntity(doc, { type: 'domain', id: 'core' });
  assert.equal(findCapability(domainGone, 'alpha').domainId, null);
  assert.deepEqual(impactOf(doc, { type: 'domain', id: 'core' }).map((r) => r.label), ['Alpha']);
  [moved, dropped, domainGone].forEach((d) => assert.ok(validateDocument(d).ok, JSON.stringify(validateDocument(d).issues)));
  assert.throws(() => deleteEntity(doc, { type: 'project', id: 'x' }), /Cannot delete/);
});

test('levels reorder and removal remap references through IDs', () => {
  const doc = base();
  const alpha = findCapability(doc, 'alpha');
  const reordered = applyLevels(alpha, [alpha.levels[2], alpha.levels[0], alpha.levels[1]]);
  assert.deepEqual([reordered.current, reordered.target, reordered.milestones[0].maturity], [1, 1, 2], 'current l0→1, target l2→0 (raised to current), milestone l1→2');
  const removedL1 = deleteEntity(doc, { type: 'level', capabilityId: 'alpha', id: 'l1' }, { mode: 'reassign', to: 'l2' });
  const after = findCapability(removedL1, 'alpha');
  assert.deepEqual(after.levels.map((l) => l.id), ['l0', 'l2']);
  assert.equal(after.milestones[0].maturity, 1);
  assert.deepEqual(after.journey.guidance.map((g) => g.levelId), ['l2']);
  assert.ok(impactOf(doc, { type: 'level', capabilityId: 'alpha', id: 'l1' }).some((r) => /Milestone/.test(r.label)));
  assert.ok(validateDocument(removedL1).ok);
});

test('timeline impact preview lists dates that would fall outside', () => {
  const doc = base();
  const refs = timelineImpact(doc, { ...doc.settings.timeline, periods: 3 }, periodStarts);
  assert.ok(refs.some((r) => /collides|outside/.test(r.detail)));
  assert.ok(refs.some((r) => r.label === 'Target anchor'));
  const hidden = timelineImpact({ ...doc, timeSegments: [{ date: '2030-01-01', label: 'x', description: '' }] }, doc.settings.timeline, periodStarts);
  assert.ok(hidden.some((r) => /hidden/.test(r.detail)));
});

test('journey selectors: sections, guidance fallback and audience membership', () => {
  const doc = base();
  assert.equal(journeySections(doc).length, 8);
  const partial = { ...doc, presentation: { ...doc.presentation, journeySections: [{ id: 'notes', label: 'Remarks', visible: false }] } };
  assert.deepEqual(journeySections(partial).slice(0, 2).map((s) => [s.id, s.visible]), [['notes', false], ['purpose', true]]);
  const alpha = findCapability(doc, 'alpha');
  assert.deepEqual(guidanceFor(doc, alpha, 'client', 'l1'), { text: 'First help.', source: 'capability' });
  assert.deepEqual(guidanceFor(doc, alpha, 'consultant', 'l0'), { text: 'Default.', source: 'default' });
  assert.equal(guidanceFor(doc, alpha, 'consultant', 'l2'), null);
  assert.deepEqual(audienceMembers(doc, 'client').map((c) => c.id), ['alpha']);
  assert.deepEqual(unassignedToAudience(doc).map((c) => c.id), ['beta', 'gamma']);
  assert.deepEqual(knownLevels(doc).map((l) => l.id), ['l0', 'l1', 'l2']);
});
