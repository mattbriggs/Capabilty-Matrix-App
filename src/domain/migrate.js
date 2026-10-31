// Explicit version 1 → version 2 migration. Twin of sidecar/capmatrix/migration.py.
// Fills only what version 1 itself defaulted, assigns IDs and copies DITA audiences into business
// membership. Invalid source values are carried over unchanged so validation reports them.
import { defaultAudiences, defaultOwnerLabels, defaultTimeline, v1DefaultLevels } from './defaults.js';
import { slug } from './ids.js';

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

export function isVersion1(raw) {
  if (Array.isArray(raw)) return true;
  if (!isObject(raw)) return false;
  return raw.version === 1 || (!('version' in raw) && Array.isArray(raw.capabilities));
}

function assignLevelIds(levels) {
  const taken = new Set(); let assigned = 0;
  levels.forEach((level, index) => {
    if (!isObject(level)) return;
    if (typeof level.id === 'string' && level.id) { taken.add(level.id); return; }
    const base = slug(level.name) || `level-${index}`;
    let candidate = base; let suffix = 2;
    while (taken.has(candidate)) { candidate = `${base}-${suffix}`; suffix += 1; }
    taken.add(candidate); level.id = candidate; assigned += 1;
  });
  return assigned;
}

export function migrateV1(raw, { projectId, now, name = null }) {
  if (!isVersion1(raw)) throw new Error('Only version 1 documents can be migrated.');
  const source = Array.isArray(raw) ? { capabilities: structuredClone(raw) } : structuredClone(raw);

  const settings = { ...(isObject(source.settings) ? source.settings : {}) };
  settings.ownerLabels = isObject(settings.ownerLabels) ? { ...defaultOwnerLabels, ...settings.ownerLabels } : { ...defaultOwnerLabels };
  if (!Array.isArray(settings.audiences) || !settings.audiences.length) settings.audiences = structuredClone(defaultAudiences);
  settings.timeline = isObject(settings.timeline) ? { ...defaultTimeline, ...settings.timeline } : { ...defaultTimeline };

  let levelCount = 0; let defaultCount = 0; let membershipCount = 0;
  const capabilities = 'capabilities' in source ? source.capabilities : [];
  if (Array.isArray(capabilities)) {
    capabilities.forEach((cap) => {
      if (!isObject(cap)) return;
      if (!('owner' in cap)) cap.owner = 'appliance';
      if (!('futureOwner' in cap)) cap.futureOwner = 'appliance';
      if (!Array.isArray(cap.levels) || !cap.levels.length) { cap.levels = v1DefaultLevels(cap.id); defaultCount += 1; }
      levelCount += assignLevelIds(cap.levels);
      if (!('audienceIds' in cap)) {
        const audience = isObject(cap.dita) ? cap.dita.audience : null;
        cap.audienceIds = Array.isArray(audience) ? [...audience] : [];
        if (cap.audienceIds.length) membershipCount += 1;
      }
    });
  }

  const rest = Object.fromEntries(Object.entries(source).filter(([key]) => !['version', 'settings', 'capabilities'].includes(key)));
  const document = {
    version: 2,
    project: { id: projectId, name: name || 'Migrated project', description: '', createdAt: now, updatedAt: now },
    settings,
    capabilities,
    domains: [],
    timeSegments: [],
    mapViews: [],
    ...rest,
  };
  const notes = [
    `Assigned project ID ${projectId}.`,
    `Assigned IDs to ${levelCount} maturity levels.`,
    `Added the default maturity levels to ${defaultCount} capabilities.`,
    `Copied DITA audiences into business audience membership for ${membershipCount} capabilities.`,
    'Domains, time-segment overrides and map views start empty.',
  ];
  return { document, notes };
}
