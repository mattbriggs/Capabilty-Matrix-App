export const defaultAudiences = [
  { id: 'client', label: 'Client', description: 'Uses and funds the capability', need: 'Clear outcomes, usable guidance and a dependable operating experience.' },
  { id: 'consultant', label: 'Consultant', description: 'Advises, designs and enables', need: 'Practical guidance for tailoring the product to a client context.' },
  { id: 'product-team', label: 'Product team', description: 'Builds and operates the product', need: 'A clear product boundary, data contract and implementation ownership.' },
  { id: 'leadership', label: 'Leadership', description: 'Sets direction and allocates resources', need: 'A defensible scope decision with visible dependencies and risk.' },
  { id: 'wider-domain', label: 'Wider domain', description: 'Extends value across the ecosystem', need: 'How local capabilities contribute to the evolving domain solution.' },
];

export const initialCapabilities = [
  {
    id: 'contextual-guidance', name: 'Contextual guidance', current: 3, target: 5,
    owner: 'appliance', futureOwner: 'federated',
    summary: 'Relevant, in-device and external guidance at the point of need.',
    decision: 'Define the handoff from product-owned guidance to a federated content service.',
    dependencies: ['deployment-metadata', 'content-service'],
    dita: { audience: ['client', 'consultant'], maturity: 'phase-3', ownership: 'appliance-native' },
  },
  {
    id: 'deployment-metadata', name: 'Deployment metadata', current: 3, target: 5,
    owner: 'appliance', futureOwner: 'appliance',
    summary: 'Structured product, task and deployment context for downstream services.',
    decision: 'Agree on a stable metadata contract before expanding content delivery.',
    dependencies: [],
    dita: { audience: ['consultant', 'product-team'], maturity: 'phase-3', ownership: 'appliance-native' },
  },
  {
    id: 'audit-trail', name: 'Audit trail', current: 4, target: 6,
    owner: 'federated', futureOwner: 'federated',
    summary: 'Evidence of actions and changes across the wider environment.',
    decision: 'Assign event ownership and retention responsibilities across systems.',
    dependencies: ['identity-service'],
    dita: { audience: ['client', 'leadership'], maturity: 'phase-4', ownership: 'federated-infra' },
  },
  {
    id: 'identity-service', name: 'Identity service', current: 4, target: 6,
    owner: 'federated', futureOwner: 'federated',
    summary: 'Shared identity and access context across the estate.',
    decision: 'Clarify which system is authoritative for identity and permissions.',
    dependencies: [],
    dita: { audience: ['product-team', 'consultant'], maturity: 'phase-4', ownership: 'federated-infra' },
  },
  {
    id: 'content-service', name: 'Content service', current: 2, target: 5,
    owner: 'federated', futureOwner: 'federated',
    summary: 'Governed content served across products, channels and devices.',
    decision: 'Map a single DITA content stock to embedded help and PDF manuals.',
    dependencies: ['deployment-metadata'],
    dita: { audience: ['client', 'consultant'], maturity: 'phase-2', ownership: 'federated-infra' },
  },
  {
    id: 'domain-insight', name: 'Domain insight', current: 2, target: 5,
    owner: 'federated', futureOwner: 'federated',
    summary: 'Cross-domain reporting, insight and optimization opportunities.',
    decision: 'Identify useful signals without expanding the appliance boundary.',
    dependencies: ['audit-trail', 'content-service'],
    dita: { audience: ['leadership', 'wider-domain'], maturity: 'phase-2', ownership: 'federated-infra' },
  },
];

export const matrixRows = [
  { audience: 'client', bars: [{ id: 'deployment-metadata', start: 1, end: 5 }, { id: 'audit-trail', start: 3, end: 7 }] },
  { audience: 'consultant', bars: [{ id: 'contextual-guidance', start: 1, end: 6 }] },
  { audience: 'product-team', bars: [{ id: 'deployment-metadata', start: 1, end: 5 }, { id: 'audit-trail', start: 3, end: 8 }] },
  { audience: 'leadership', bars: [{ id: 'contextual-guidance', start: 4, end: 8 }] },
  { audience: 'wider-domain', bars: [{ id: 'audit-trail', start: 5, end: 8.7 }] },
];


export const granularities = [
  { id: 'month', label: 'Monthly', months: 1 },
  { id: 'quarter', label: 'Quarterly', months: 3 },
  { id: 'biannual', label: 'Biannual', months: 6 },
  { id: 'year', label: 'Yearly', months: 12 },
];
export const defaultOwnerLabels = { appliance: 'Appliance', federated: 'Federated' };
export const defaultTimeline = { granularity: 'quarter', start: '2026-10-01', periods: 9, asOf: '2026-10-01' };
export const defaultSettings = { ownerLabels: defaultOwnerLabels, audiences: defaultAudiences, timeline: defaultTimeline };

const levelNames = ['Emerging', 'Initial', 'Defined', 'Managed', 'Measured', 'Optimized', 'Scaled', 'Extended', 'Ecosystem'];
const levelNotes = ['Explore the need.', 'Describe the capability.', 'Define the model.', 'Operate a first version.', 'Measure outcomes.', 'Optimize the handoff.', 'Scale to more contexts.', 'Connect across domains.', 'Continue domain evolution.'];
const guidanceNotes = ['Ad hoc content with no shared approach.', 'Basic in-app help and FAQs.', 'Consistent topics and terminology.', 'Product-owned guidance delivered in device.', 'Contextual, task-based guidance.', 'Shared guidance across products.', 'Partners and clients integrated.', 'Guidance across workflows and channels.', 'Continuing wider-domain evolution.'];
export const defaultLevels = (id) => levelNames.map((name, index) => ({ name, description: (id === 'contextual-guidance' ? guidanceNotes : levelNotes)[index] }));
export const levelLabels = (count) => Array.from({ length: count }, (_, index) => (index === count - 1 && count > 1 ? `${index}+` : String(index)));

// Dates are ISO strings (YYYY-MM-DD) so milestones survive a change of granularity.
export const isoDate = (date) => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
export const parseDate = (value) => { const [y, m, d] = String(value).split('-').map(Number); return new Date(Date.UTC(y, (m || 1) - 1, d || 1)); };
export function periodLabel(value, granularity) {
  const date = parseDate(value); const year = date.getUTCFullYear(); const month = date.getUTCMonth();
  if (granularity === 'month') return `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][month]} ${year}`;
  if (granularity === 'quarter') return `Q${Math.floor(month / 3) + 1} ${year}`;
  if (granularity === 'biannual') return `H${Math.floor(month / 6) + 1} ${year}`;
  return String(year);
}
export function timelinePeriods(timeline) {
  const months = (granularities.find((g) => g.id === timeline.granularity) || granularities[1]).months;
  const start = parseDate(timeline.start);
  return Array.from({ length: timeline.periods }, (_, index) => {
    const date = isoDate(new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + index * months, 1)));
    return { date, label: periodLabel(date, timeline.granularity) };
  });
}
// Snap any date to the start of the period that contains it (or the nearest period).
export function snapToPeriod(periods, value) {
  const time = parseDate(value).getTime();
  let best = periods[0];
  periods.forEach((period) => { if (parseDate(period.date).getTime() <= time) best = period; });
  return best.date;
}

// Maturity is anchored at asOf (current) and at the last period (target), with optional milestones between.
export function maturityAt(cap, timeline, date) {
  const periods = timelinePeriods(timeline);
  const horizon = periods[periods.length - 1].date;
  const points = [{ date: timeline.asOf, value: cap.current }, ...(cap.milestones || []).map((m) => ({ date: m.date, value: m.maturity })), { date: horizon, value: cap.target }]
    .map((point) => ({ time: parseDate(point.date).getTime(), value: point.value })).sort((a, b) => a.time - b.time);
  const time = parseDate(date).getTime();
  if (time <= points[0].time) return points[0].value;
  for (let i = 1; i < points.length; i += 1) {
    if (time <= points[i].time) {
      const span = points[i].time - points[i - 1].time;
      const ratio = span === 0 ? 1 : (time - points[i - 1].time) / span;
      return Math.round(points[i - 1].value + (points[i].value - points[i - 1].value) * ratio);
    }
  }
  return points[points.length - 1].value;
}
export function ownerAt(cap, timeline, date) {
  const periods = timelinePeriods(timeline);
  const handoff = cap.handoffDate || periods[periods.length - 1].date;
  return parseDate(date).getTime() >= parseDate(handoff).getTime() ? cap.futureOwner : cap.owner;
}

export function normalizeSettings(value) {
  const input = value && typeof value === 'object' ? value : {};
  const labels = input.ownerLabels || {};
  const ownerLabels = {
    appliance: String(labels.appliance || '').trim() || defaultOwnerLabels.appliance,
    federated: String(labels.federated || '').trim() || defaultOwnerLabels.federated,
  };
  const seen = new Set();
  const audiences = (Array.isArray(input.audiences) && input.audiences.length ? input.audiences : defaultAudiences).map((item, index) => {
    const label = String(item?.label || '').trim() || `Perspective ${index + 1}`;
    let id = String(item?.id || '').trim() || label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `perspective-${index + 1}`;
    while (seen.has(id)) id = `${id}-2`;
    seen.add(id);
    return { id, label, description: String(item?.description || ''), need: String(item?.need || '') };
  });
  const t = input.timeline || {};
  const granularity = granularities.some((g) => g.id === t.granularity) ? t.granularity : defaultTimeline.granularity;
  const timeline = {
    granularity,
    start: /^\d{4}-\d{2}-\d{2}$/.test(String(t.start)) ? String(t.start) : defaultTimeline.start,
    periods: Math.min(60, Math.max(2, Math.round(Number(t.periods)) || defaultTimeline.periods)),
    asOf: /^\d{4}-\d{2}-\d{2}$/.test(String(t.asOf)) ? String(t.asOf) : defaultTimeline.asOf,
  };
  return { ownerLabels, audiences, timeline };
}

export function normalizeCapabilities(value) {
  const list = Array.isArray(value) ? value : value?.capabilities;
  if (!Array.isArray(list) || list.length === 0) throw new Error('Expected a nonempty capabilities list.');
  const ids = new Set();
  return list.map((item, index) => {
    if (!item || typeof item !== 'object') throw new Error(`Capability ${index + 1} must be an object.`);
    const id = String(item.id || '').trim();
    const name = String(item.name || '').trim();
    const current = Number(item.current);
    const target = Number(item.target);
    if (!id || !name || !Number.isFinite(current) || !Number.isFinite(target) || current < 0 || target < 0) {
      throw new Error(`Capability ${index + 1} needs an id, name and nonnegative maturity values.`);
    }
    if (ids.has(id)) throw new Error(`Duplicate capability id: ${id}`);
    ids.add(id);
    const levels = Array.isArray(item.levels) && item.levels.length
      ? item.levels.map((level, i) => ({ name: String(level?.name || '').trim() || `Level ${i}`, description: String(level?.description || '') }))
      : defaultLevels(id);
    const milestones = (Array.isArray(item.milestones) ? item.milestones : [])
      .filter((m) => m && /^\d{4}-\d{2}-\d{2}$/.test(String(m.date)) && Number.isFinite(Number(m.maturity)))
      .map((m) => ({ date: String(m.date), maturity: Number(m.maturity) }));
    return {
      ...item, id, name, current, target, levels, milestones,
      owner: item.owner === 'federated' ? 'federated' : 'appliance',
      futureOwner: item.futureOwner === 'federated' ? 'federated' : 'appliance',
      summary: String(item.summary || ''), decision: String(item.decision || ''),
      dependencies: Array.isArray(item.dependencies) ? item.dependencies.map(String) : [],
      dita: item.dita && typeof item.dita === 'object' ? item.dita : {},
    };
  });
}

export function normalizeDocument(value) {
  return { settings: normalizeSettings(value?.settings), capabilities: normalizeCapabilities(value) };
}
