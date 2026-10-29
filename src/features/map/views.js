// Saved map views: pure helpers for placements keyed by node and owner/domain placement context.
import { LAYOUT_VERSION } from './layout.js';

export const placementKey = (nodeId, context) => `${nodeId}|${context}`;
export const toPlacementMap = (list) => new Map(list.map((p) => [placementKey(p.nodeId, p.context), p]));
export const toPlacementList = (map) => [...map.values()].sort((a, b) => placementKey(a.nodeId, a.context).localeCompare(placementKey(b.nodeId, b.context)));

export const blankView = () => ({ id: null, name: 'Unsaved view', layoutSeed: 1, layoutVersion: LAYOUT_VERSION, viewport: { x: 0, y: 0, zoom: 1 }, filters: { owners: [], domainIds: [], search: '' }, selectedCapabilityId: null, audienceId: null, currentDate: null, focusDate: null, placements: [] });

// Drop positions for capabilities that no longer exist; report how many were pruned.
export function pruneView(view, doc) {
  const ids = new Set(doc.capabilities.map((cap) => cap.id));
  const placements = view.placements.filter((p) => !p.nodeId.startsWith('cap:') || ids.has(p.nodeId.slice(4)));
  const domainIds = view.filters.domainIds.filter((id) => doc.domains.some((d) => d.id === id));
  return { view: { ...view, placements, filters: { ...view.filters, domainIds }, selectedCapabilityId: ids.has(view.selectedCapabilityId) ? view.selectedCapabilityId : null }, pruned: view.placements.length - placements.length };
}

// Nodes in the current graph without a remembered position for their current context.
export const unplacedNodes = (graph, placements) => graph.nodes.filter((node) => !placements.has(placementKey(node.id, node.context)));

export function fixedPositions(graph, placements, { pinnedOnly = false } = {}) {
  const fixed = {};
  graph.nodes.forEach((node) => {
    const p = placements.get(placementKey(node.id, node.context));
    if (p && (!pinnedOnly || p.pinned)) fixed[node.id] = { x: p.x, y: p.y };
  });
  return fixed;
}

// Merge layout positions into placements. New/auto positions are unpinned; pins survive unless reset.
export function mergePositions(graph, placements, positions, { reset = false } = {}) {
  const next = new Map(placements);
  graph.nodes.forEach((node) => {
    const pos = positions[node.id];
    if (!pos) return;
    const key = placementKey(node.id, node.context);
    const old = next.get(key);
    if (old?.pinned && !reset) return;
    next.set(key, { nodeId: node.id, context: node.context, x: pos.x, y: pos.y, pinned: false });
  });
  return next;
}

export const pinPlacement = (placements, node, position) => new Map(placements).set(placementKey(node.id, node.context), { nodeId: node.id, context: node.context, x: Math.round(position.x), y: Math.round(position.y), pinned: true });

export function upsertMapView(doc, view) {
  const exists = doc.mapViews.some((v) => v.id === view.id);
  return { ...doc, mapViews: exists ? doc.mapViews.map((v) => (v.id === view.id ? view : v)) : [...doc.mapViews, view] };
}
export const removeMapView = (doc, id) => ({ ...doc, mapViews: doc.mapViews.filter((v) => v.id !== id) });
