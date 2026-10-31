// Read-only selectors over a validated project document, shared by all views.
import { journeySectionDefaults } from './defaults.js';

// Configured sections in presentation order; any section the project omits keeps its default label and is visible.
export function journeySections(doc) {
  const configured = doc.presentation.journeySections;
  const ids = new Set(configured.map((s) => s.id));
  return [...configured, ...journeySectionDefaults.filter((s) => !ids.has(s.id)).map((s) => ({ ...s, visible: true }))];
}
export const sectionConfig = (doc, id) => journeySections(doc).find((s) => s.id === id);

// Per-capability guidance overrides reusable default guidance. Returns null when nothing is recorded.
export function guidanceFor(doc, cap, audienceId, levelId) {
  const own = cap.journey.guidance.find((g) => g.audienceId === audienceId && g.levelId === levelId);
  if (own?.text?.trim()) return { text: own.text, source: 'capability' };
  const fallback = doc.presentation.defaultGuidance.find((g) => g.audienceId === audienceId && g.levelId === levelId);
  if (fallback?.text?.trim()) return { text: fallback.text, source: 'default' };
  return null;
}

export const audienceMembers = (doc, audienceId) => doc.capabilities.filter((cap) => cap.audienceIds.includes(audienceId));
export const unassignedToAudience = (doc) => {
  const ids = new Set(doc.settings.audiences.map((a) => a.id));
  return doc.capabilities.filter((cap) => !cap.audienceIds.some((id) => ids.has(id)));
};

// Union of level definitions across capabilities, by level ID, in first-seen rank order.
export function knownLevels(doc) {
  const seen = new Map();
  doc.capabilities.forEach((cap) => cap.levels.forEach((level, rank) => { if (!seen.has(level.id)) seen.set(level.id, { id: level.id, name: level.name, rank }); }));
  return [...seen.values()].sort((a, b) => a.rank - b.rank);
}
