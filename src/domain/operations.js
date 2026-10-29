// Immutable document operations used by trays and the relation table.
// Deletions never cascade silently: impactOf() previews references, and deleteEntity() requires an
// explicit resolution ('remove' or 'reassign' to another record).
import { definitionFields, newCapabilityLevels } from './defaults.js';
import { uniqueId } from './ids.js';
import { normalizeDocument } from './validate.js';

const replaceAt = (list, index, item) => list.map((old, i) => (i === index ? item : old));
const dedupe = (list) => [...new Set(list)];

export const capabilityIndex = (doc, id) => doc.capabilities.findIndex((cap) => cap.id === id);
export const findCapability = (doc, id) => doc.capabilities.find((cap) => cap.id === id) || null;

export function updateCapability(doc, capability) {
  const index = capabilityIndex(doc, capability.id);
  if (index < 0) throw new Error(`Capability ${capability.id} not found.`);
  return { ...doc, capabilities: replaceAt(doc.capabilities, index, capability) };
}

export function newCapability(doc, name = 'New capability') {
  const id = uniqueId(name, doc.capabilities.map((cap) => cap.id), 'capability');
  return normalizeDocument({ ...doc, capabilities: [{ id, name, owner: 'appliance', futureOwner: 'appliance', current: 0, target: 0, levels: newCapabilityLevels() }] }).capabilities[0];
}
export const addCapability = (doc, capability) => ({ ...doc, capabilities: [...doc.capabilities, capability] });

export function newAudience(doc, label = 'New audience') {
  return { id: uniqueId(label, doc.settings.audiences.map((a) => a.id), 'audience'), label, description: '', need: '' };
}
export const upsertAudience = (doc, audience) => {
  const exists = doc.settings.audiences.some((a) => a.id === audience.id);
  const audiences = exists ? doc.settings.audiences.map((a) => (a.id === audience.id ? audience : a)) : [...doc.settings.audiences, audience];
  return { ...doc, settings: { ...doc.settings, audiences } };
};

export function newDomain(doc, name = 'New domain', color = null) {
  return { id: uniqueId(name, doc.domains.map((d) => d.id), 'domain'), name, description: '', color };
}
export const upsertDomain = (doc, domain) => {
  const exists = doc.domains.some((d) => d.id === domain.id);
  return { ...doc, domains: exists ? doc.domains.map((d) => (d.id === domain.id ? domain : d)) : [...doc.domains, domain] };
};

export function upsertSegmentOverride(doc, override) {
  const others = doc.timeSegments.filter((segment) => segment.date !== override.date);
  const empty = !override.label?.trim() && !override.description?.trim();
  return { ...doc, timeSegments: empty ? others : [...others, override].sort((a, b) => a.date.localeCompare(b.date)) };
}

export function toggleAudienceMembership(doc, capabilityId, audienceId) {
  const cap = findCapability(doc, capabilityId);
  const has = cap.audienceIds.includes(audienceId);
  return updateCapability(doc, { ...cap, audienceIds: has ? cap.audienceIds.filter((id) => id !== audienceId) : [...cap.audienceIds, audienceId] });
}
export const setCapabilityDomain = (doc, capabilityId, domainId) => updateCapability(doc, { ...findCapability(doc, capabilityId), domainId });

export function setGuidance(entries, audienceId, levelId, text) {
  const others = entries.filter((g) => !(g.audienceId === audienceId && g.levelId === levelId));
  return text.trim() ? [...others, { audienceId, levelId, text }] : others;
}
export const hasDefinition = (cap) => definitionFields.some((field) => cap.definition[field]?.trim());

// Reorder/rename/add/remove levels by ID. `rows` is the new ordered list of { id, name, ... };
// `remap` maps each removed level ID to the surviving level ID that takes its references.
export function applyLevels(cap, rows, remap = {}) {
  const rankOf = new Map(rows.map((row, index) => [row.id, index]));
  const resolve = (rank) => {
    let id = cap.levels[rank]?.id;
    const visited = new Set();
    while (id && !rankOf.has(id) && remap[id] && !visited.has(id)) { visited.add(id); id = remap[id]; }
    if (id && rankOf.has(id)) return rankOf.get(id);
    return Math.min(rank, rows.length - 1);
  };
  const current = resolve(cap.current);
  return {
    ...cap,
    levels: rows,
    current,
    target: Math.max(current, resolve(cap.target)),
    milestones: cap.milestones.map((m) => ({ ...m, maturity: resolve(m.maturity) })),
    journey: { ...cap.journey, guidance: cap.journey.guidance.flatMap((g) => {
      if (rankOf.has(g.levelId)) return [g];
      const to = remap[g.levelId];
      return to && rankOf.has(to) && !cap.journey.guidance.some((o) => o.audienceId === g.audienceId && o.levelId === to) ? [{ ...g, levelId: to }] : [];
    }) },
  };
}

// References that a deletion would affect. Each entry: { label, detail }.
export function impactOf(doc, entity) {
  const refs = [];
  const capName = (id) => findCapability(doc, id)?.name || id;
  if (entity.type === 'capability') {
    doc.capabilities.forEach((cap) => { if (cap.id !== entity.id && cap.dependencies.includes(entity.id)) refs.push({ label: cap.name, detail: 'depends on it' }); });
    doc.mapViews.forEach((view) => {
      const placed = view.placements.filter((p) => p.nodeId === `cap:${entity.id}`).length;
      if (placed) refs.push({ label: `Map view “${view.name}”`, detail: `${placed} saved position(s) will be pruned` });
      if (view.selectedCapabilityId === entity.id) refs.push({ label: `Map view “${view.name}”`, detail: 'selects it' });
    });
    if (doc.presentation.dataTable.filters.capabilityIds.includes(entity.id)) refs.push({ label: 'Data table filter', detail: 'includes it' });
  }
  if (entity.type === 'audience') {
    doc.capabilities.forEach((cap) => {
      if (cap.audienceIds.includes(entity.id)) refs.push({ label: cap.name, detail: 'is a member' });
      const guidance = cap.journey.guidance.filter((g) => g.audienceId === entity.id).length;
      if (guidance) refs.push({ label: cap.name, detail: `${guidance} guidance entr${guidance === 1 ? 'y' : 'ies'}` });
    });
    const defaults = doc.presentation.defaultGuidance.filter((g) => g.audienceId === entity.id).length;
    if (defaults) refs.push({ label: 'Default guidance', detail: `${defaults} entr${defaults === 1 ? 'y' : 'ies'}` });
    doc.mapViews.forEach((view) => { if (view.audienceId === entity.id) refs.push({ label: `Map view “${view.name}”`, detail: 'uses this perspective' }); });
  }
  if (entity.type === 'domain') {
    doc.capabilities.forEach((cap) => { if (cap.domainId === entity.id) refs.push({ label: cap.name, detail: 'belongs to it' }); });
    doc.mapViews.forEach((view) => { if (view.filters.domainIds.includes(entity.id)) refs.push({ label: `Map view “${view.name}”`, detail: 'filters on it' }); });
  }
  if (entity.type === 'level') {
    const cap = findCapability(doc, entity.capabilityId);
    const rank = cap.levels.findIndex((l) => l.id === entity.id);
    if (cap.current === rank) refs.push({ label: capName(cap.id), detail: 'current maturity uses this level' });
    if (cap.target === rank) refs.push({ label: capName(cap.id), detail: 'target maturity uses this level' });
    cap.milestones.forEach((m) => { if (m.maturity === rank) refs.push({ label: `Milestone ${m.date}`, detail: 'uses this level' }); });
    const guidance = cap.journey.guidance.filter((g) => g.levelId === entity.id).length;
    if (guidance) refs.push({ label: 'Audience guidance', detail: `${guidance} entr${guidance === 1 ? 'y' : 'ies'}` });
    if (rank < cap.levels.length - 1) refs.push({ label: 'Higher levels', detail: `M${rank + 1}–M${cap.levels.length - 1} move down one rank (references follow their levels)` });
  }
  return refs;
}

// resolution: { mode: 'remove' } or { mode: 'reassign', to: <id> }.
export function deleteEntity(doc, entity, resolution = { mode: 'remove' }) {
  const to = resolution.mode === 'reassign' ? resolution.to : null;
  if (entity.type === 'capability') {
    return {
      ...doc,
      capabilities: doc.capabilities.filter((cap) => cap.id !== entity.id).map((cap) => {
        if (!cap.dependencies.includes(entity.id)) return cap;
        const deps = cap.dependencies.flatMap((dep) => (dep === entity.id ? (to && to !== cap.id ? [to] : []) : [dep]));
        return { ...cap, dependencies: dedupe(deps) };
      }),
      mapViews: doc.mapViews.map((view) => ({
        ...view,
        selectedCapabilityId: view.selectedCapabilityId === entity.id ? to : view.selectedCapabilityId,
        placements: view.placements.filter((p) => p.nodeId !== `cap:${entity.id}`),
      })),
      presentation: { ...doc.presentation, dataTable: { ...doc.presentation.dataTable, filters: { ...doc.presentation.dataTable.filters, capabilityIds: doc.presentation.dataTable.filters.capabilityIds.filter((id) => id !== entity.id) } } },
    };
  }
  if (entity.type === 'audience') {
    const moveGuidance = (entries) => {
      const kept = entries.filter((g) => g.audienceId !== entity.id);
      if (!to) return kept;
      const moved = entries.filter((g) => g.audienceId === entity.id && !kept.some((k) => k.audienceId === to && k.levelId === g.levelId)).map((g) => ({ ...g, audienceId: to }));
      return [...kept, ...moved];
    };
    return {
      ...doc,
      settings: { ...doc.settings, audiences: doc.settings.audiences.filter((a) => a.id !== entity.id) },
      capabilities: doc.capabilities.map((cap) => ({
        ...cap,
        audienceIds: dedupe(cap.audienceIds.flatMap((id) => (id === entity.id ? (to ? [to] : []) : [id]))),
        journey: { ...cap.journey, guidance: moveGuidance(cap.journey.guidance) },
      })),
      presentation: { ...doc.presentation, defaultGuidance: moveGuidance(doc.presentation.defaultGuidance) },
      mapViews: doc.mapViews.map((view) => (view.audienceId === entity.id ? { ...view, audienceId: to } : view)),
    };
  }
  if (entity.type === 'domain') {
    return {
      ...doc,
      domains: doc.domains.filter((d) => d.id !== entity.id),
      capabilities: doc.capabilities.map((cap) => (cap.domainId === entity.id ? { ...cap, domainId: to } : cap)),
      mapViews: doc.mapViews.map((view) => ({ ...view, filters: { ...view.filters, domainIds: dedupe(view.filters.domainIds.flatMap((id) => (id === entity.id ? (to ? [to] : []) : [id]))) } })),
    };
  }
  if (entity.type === 'level') {
    const cap = findCapability(doc, entity.capabilityId);
    const rows = cap.levels.filter((l) => l.id !== entity.id);
    const fallback = cap.levels[Math.max(0, cap.levels.findIndex((l) => l.id === entity.id) - 1)]?.id;
    return updateCapability(doc, applyLevels(cap, rows, { [entity.id]: to || (fallback !== entity.id ? fallback : rows[0]?.id) }));
  }
  throw new Error(`Cannot delete ${entity.type}.`);
}

// Timeline structure change preview: which recorded dates fall outside the new range.
export function timelineImpact(doc, nextTimeline, periodStarts) {
  const dates = periodStarts(nextTimeline.granularity, nextTimeline.start, nextTimeline.periods);
  const first = dates[0]; const horizon = dates.at(-1);
  const outside = (date) => date < first || date > horizon;
  const refs = [];
  if (outside(nextTimeline.asOf)) refs.push({ label: 'Current anchor', detail: `${nextTimeline.asOf} falls outside the timeline` });
  doc.capabilities.forEach((cap) => {
    cap.milestones.forEach((m) => {
      if (outside(m.date)) refs.push({ label: cap.name, detail: `milestone ${m.date} falls outside the timeline` });
      else if (m.date === horizon || m.date === nextTimeline.asOf) refs.push({ label: cap.name, detail: `milestone ${m.date} collides with an anchor date` });
    });
    if (cap.handoffDate && outside(cap.handoffDate)) refs.push({ label: cap.name, detail: `handoff ${cap.handoffDate} falls outside the timeline` });
  });
  const hidden = doc.timeSegments.filter((s) => !dates.includes(s.date)).length;
  if (hidden) refs.push({ label: 'Segment notes', detail: `${hidden} label/description override(s) are hidden (kept, not deleted)` });
  if (horizonChanged(doc.settings.timeline, nextTimeline, periodStarts)) refs.push({ label: 'Target anchor', detail: `target maturity moves to ${horizon}` });
  return refs;
}
const horizonChanged = (a, b, periodStarts) => periodStarts(a.granularity, a.start, a.periods).at(-1) !== periodStarts(b.granularity, b.start, b.periods).at(-1);
