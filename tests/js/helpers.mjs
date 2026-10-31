import { readFileSync } from 'node:fs';
import { normalizeDocument } from '../../src/domain/validate.js';

export const root = new URL('../../', import.meta.url);
export const readJson = (path) => JSON.parse(readFileSync(new URL(path, root), 'utf8'));
export const readText = (path) => readFileSync(new URL(path, root), 'utf8');
export const cases = readJson('tests/fixtures/validation/cases.json');
export const base = () => normalizeDocument(structuredClone(cases.base));

// Deterministic synthetic project: `count` capabilities, `audiences` audiences, `periods` time segments.
export function syntheticDocument({ count = 250, audiences = 20, periods = 60, domains = 12 } = {}) {
  const levels = Array.from({ length: 9 }, (_, i) => ({ id: `l${i}`, name: `Level ${i}` }));
  const doc = {
    version: 2,
    project: { id: 'prj-synthetic', name: 'Synthetic', createdAt: '2026-10-29T00:00:00Z', updatedAt: '2026-10-29T00:00:00Z' },
    settings: {
      ownerLabels: { appliance: 'Appliance', federated: 'Federated' },
      audiences: Array.from({ length: audiences }, (_, i) => ({ id: `a${i}`, label: `Audience ${i}` })),
      timeline: { granularity: 'month', start: '2026-01-01', periods, asOf: '2026-03-01' },
    },
    domains: Array.from({ length: domains }, (_, i) => ({ id: `d${i}`, name: `Domain ${i}` })),
    capabilities: Array.from({ length: count }, (_, i) => ({
      id: `c${i}`, name: `Capability ${i}`, owner: i % 3 ? 'federated' : 'appliance', futureOwner: i % 5 ? 'federated' : 'appliance',
      current: i % 4, target: 4 + (i % 5), levels,
      milestones: i % 2 ? [{ date: '2026-08-01', maturity: Math.min(4 + (i % 5), (i % 4) + 1) }] : [],
      dependencies: i > 0 ? [`c${(i * 7) % i}`] : [], domainId: i % 9 === 0 ? null : `d${i % domains}`,
      audienceIds: [`a${i % audiences}`, `a${(i * 3) % audiences}`].filter((v, k, list) => list.indexOf(v) === k),
    })),
  };
  return normalizeDocument(doc);
}

export function percentile(values, p) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
}
