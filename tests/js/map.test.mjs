// Domain map graph, organic layout, region outlines and saved-view helpers (R6 / gate A5).
import assert from 'node:assert/strict';
import test from 'node:test';
import { blobOutline, blobPath, pointInPolygon, sampleBlob } from '../../src/features/map/blob.js';
import { buildGraph, capNodeId, groupKey } from '../../src/features/map/graph.js';
import { mulberry32, organicLayout, rectsOverlap } from '../../src/features/map/layout.js';
import { blankView, fixedPositions, mergePositions, pinPlacement, placementKey, pruneView, removeMapView, toPlacementList, toPlacementMap, unplacedNodes, upsertMapView } from '../../src/features/map/views.js';
import { deleteEntity } from '../../src/domain/operations.js';
import { base, syntheticDocument } from './helpers.mjs';

const at = { currentDate: '2026-04-01', focusDate: '2026-04-01' };
const layoutOf = (graph, fixed = {}, seed = 1) => organicLayout({ nodes: graph.nodes, edges: graph.edges, fixed, seed });
const rectsFor = (graph, positions) => graph.nodes.map((n) => ({ id: n.id, ...positions[n.id], width: n.width, height: n.height }));
const overlaps = (rects) => { let count = 0; for (let i = 0; i < rects.length; i += 1) for (let j = i + 1; j < rects.length; j += 1) if (rectsOverlap(rects[i], rects[j])) count += 1; return count; };

test('graph: owners are anchors, domains are groups, unassigned is visible', () => {
  const graph = buildGraph(base(), at);
  assert.deepEqual(graph.groups.map((g) => g.key), ['appliance/core', 'appliance/unassigned', 'federated/unassigned']);
  assert.deepEqual(graph.nodes.filter((n) => n.kind === 'anchor').map((n) => n.id), ['owner:appliance', 'owner:federated']);
  assert.ok(graph.edges.some((e) => e.kind === 'membership' && e.source === 'owner:appliance' && e.target === 'group:appliance/core'));
  assert.ok(graph.edges.some((e) => e.kind === 'dependency' && e.source === 'cap:beta' && e.target === 'cap:alpha'));
});

test('graph: membership follows the Focus date and a domain can span both owners', () => {
  const doc = base();
  doc.capabilities[1].domainId = 'core';
  const later = buildGraph(doc, { currentDate: '2026-04-01', focusDate: '2026-10-01' });
  assert.equal(later.nodes.find((n) => n.id === 'cap:alpha').context, 'federated/core', 'alpha hands off at 2026-10-01');
  const spanning = buildGraph(doc, at);
  assert.ok(spanning.edges.some((e) => e.kind === 'sameDomain'));
  assert.equal(spanning.nodes.find((n) => n.id === 'cap:alpha').from, 0);
});

test('graph: filters by owner, domain and search; ignores unknown domain filters', () => {
  const doc = base();
  assert.deepEqual(buildGraph(doc, { ...at, filters: { owners: ['federated'] } }).nodes.filter((n) => n.kind === 'capability').map((n) => n.id), ['cap:beta']);
  assert.deepEqual(buildGraph(doc, { ...at, filters: { domainIds: ['core'] } }).nodes.filter((n) => n.kind === 'capability').map((n) => n.id), ['cap:alpha']);
  assert.equal(buildGraph(doc, { ...at, filters: { domainIds: ['ghost'] } }).nodes.filter((n) => n.kind === 'capability').length, 3);
  assert.deepEqual(buildGraph(doc, { ...at, filters: { search: 'gam' } }).nodes.filter((n) => n.kind === 'capability').map((n) => n.id), ['cap:gamma']);
  assert.equal(buildGraph(doc, { ...at, sizes: { 'cap:alpha': { width: 300, height: 140 } } }).nodes.find((n) => n.id === 'cap:alpha').width, 300);
});

for (const count of [0, 1, 50, 250]) {
  test(`layout: ${count} cards — no overlaps, deterministic, within budget, regions contain cards`, () => {
    const doc = count ? syntheticDocument({ count, audiences: 6, periods: 12, domains: count > 50 ? 12 : 4 }) : { ...base(), capabilities: [] };
    const graph = buildGraph(doc, { currentDate: '2026-03-01', focusDate: '2026-03-01' });
    const started = performance.now();
    const { positions } = layoutOf(graph);
    const ms = performance.now() - started;
    assert.ok(ms < 3000, `rebuild ${ms.toFixed(0)} ms`);
    const rects = rectsFor(graph, positions);
    assert.equal(overlaps(rects), 0);
    assert.deepEqual(layoutOf(graph).positions, positions, 'same seed gives the same arrangement');
    rects.forEach((r) => assert.ok(Number.isFinite(r.x) && Number.isFinite(r.y)));
    graph.groups.forEach((group) => {
      const members = rects.filter((r) => graph.nodes.find((n) => n.id === r.id).group === group.key);
      const outline = sampleBlob(blobOutline(members, 26, 3));
      members.forEach((r) => [[r.x, r.y], [r.x + r.width, r.y], [r.x, r.y + r.height], [r.x + r.width, r.y + r.height]]
        .forEach(([x, y]) => assert.ok(pointInPolygon({ x, y }, outline), `${r.id} corner outside ${group.key}`)));
    });
  });
}

test('layout: uneven groups and a single huge domain stay overlap-free', () => {
  const doc = syntheticDocument({ count: 80, audiences: 3, periods: 12, domains: 2 });
  doc.capabilities.forEach((cap, i) => { cap.domainId = i < 75 ? 'd0' : 'd1'; });
  const graph = buildGraph(doc, { currentDate: '2026-03-01', focusDate: '2026-03-01' });
  assert.equal(overlaps(rectsFor(graph, layoutOf(graph).positions)), 0);
});

test('layout: fixed (pinned) nodes never move and new cards avoid them', () => {
  const graph = buildGraph(base(), at);
  const fixed = { 'cap:alpha': { x: 0, y: 0 }, 'owner:appliance': { x: -600, y: 0 } };
  const { positions } = layoutOf(graph, fixed, 5);
  assert.deepEqual(positions['cap:alpha'], { x: 0, y: 0 });
  assert.deepEqual(positions['owner:appliance'], { x: -600, y: 0 });
  assert.equal(overlaps(rectsFor(graph, positions)), 0);
  assert.notDeepEqual(layoutOf(graph, {}, 1).positions, layoutOf(graph, {}, 2).positions, 'a new seed rebuilds differently');
});

test('layout: cancellation stops early', () => {
  const graph = buildGraph(syntheticDocument({ count: 60, audiences: 3, periods: 12 }), { currentDate: '2026-03-01', focusDate: '2026-03-01' });
  assert.deepEqual(organicLayout({ nodes: graph.nodes, edges: graph.edges, shouldCancel: () => true }), { positions: {}, cancelled: true });
});

test('random generator is deterministic and blob paths are closed', () => {
  const a = mulberry32(7); const b = mulberry32(7);
  assert.deepEqual([a(), a(), a()], [b(), b(), b()]);
  assert.equal(blobPath([]), '');
  assert.match(blobPath([{ x: 0, y: 0 }]), /Z$/);
  assert.match(blobPath(blobOutline([{ x: 0, y: 0, width: 10, height: 10 }])), /^M.*Z$/);
  assert.deepEqual(blobOutline([]), []);
});

test('views: remembered positions per placement context survive Focus changes', () => {
  const doc = base();
  const now = buildGraph(doc, at);
  let placements = mergePositions(now, new Map(), layoutOf(now).positions);
  assert.equal(unplacedNodes(now, placements).length, 0);
  const alphaNow = now.nodes.find((n) => n.id === 'cap:alpha');
  placements = pinPlacement(placements, alphaNow, { x: 11.4, y: 22.6 });
  const later = buildGraph(doc, { currentDate: '2026-04-01', focusDate: '2026-10-01' });
  assert.deepEqual(unplacedNodes(later, placements).map((n) => n.id), ['cap:alpha', 'group:federated/core'], 'new context needs a new position');
  placements = mergePositions(later, placements, layoutOf(later, fixedPositions(later, placements)).positions);
  const back = placements.get(placementKey('cap:alpha', groupKey('appliance', 'core')));
  assert.deepEqual([back.x, back.y, back.pinned], [11, 23, true], 'returning to the earlier Focus restores the pinned spot');
  const rebuilt = mergePositions(now, placements, { 'cap:alpha': { x: 999, y: 999 } });
  assert.equal(rebuilt.get(placementKey('cap:alpha', 'appliance/core')).x, 11, 'pins are preserved by default');
  const reset = mergePositions(now, placements, { 'cap:alpha': { x: 999, y: 999 } }, { reset: true });
  assert.deepEqual([reset.get(placementKey('cap:alpha', 'appliance/core')).x, reset.get(placementKey('cap:alpha', 'appliance/core')).pinned], [999, false]);
  assert.deepEqual(Object.keys(fixedPositions(now, placements, { pinnedOnly: true })), ['cap:alpha']);
});

test('views: pruning deleted references, list/map conversion and CRUD helpers', () => {
  const doc = base();
  const gone = deleteEntity(doc, { type: 'capability', id: 'gamma' });
  const view = { ...doc.mapViews[0], selectedCapabilityId: 'gamma', filters: { owners: [], domainIds: ['core', 'ghost'], search: '' }, placements: [...doc.mapViews[0].placements, { nodeId: 'cap:gamma', context: 'x', x: 1, y: 1, pinned: false }, { nodeId: 'owner:appliance', context: 'anchor', x: 0, y: 0, pinned: true }] };
  const { view: pruned, pruned: count } = pruneView(view, gone);
  assert.equal(count, 1);
  assert.equal(pruned.selectedCapabilityId, null);
  assert.deepEqual(pruned.filters.domainIds, ['core']);
  assert.deepEqual(toPlacementList(toPlacementMap(pruned.placements)).map((p) => p.nodeId), ['cap:alpha', 'owner:appliance']);
  const created = upsertMapView(doc, { ...blankView(), id: 'second', name: 'Second' });
  assert.deepEqual(created.mapViews.map((v) => v.id), ['main', 'second']);
  const renamed = upsertMapView(created, { ...created.mapViews[1], name: 'Renamed' });
  assert.equal(renamed.mapViews[1].name, 'Renamed');
  assert.deepEqual(removeMapView(renamed, 'main').mapViews.map((v) => v.id), ['second'], 'deleting one view leaves the other untouched');
  assert.equal(capNodeId('x'), 'cap:x');
});
