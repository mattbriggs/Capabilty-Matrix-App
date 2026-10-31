// Timeline rules. Dates are ISO strings (YYYY-MM-DD) so milestones survive a change of granularity.
// Mirrors sidecar/capmatrix/timeline.py for the rules both validators share.

export const granularities = [
  { id: 'month', label: 'Monthly', months: 1 },
  { id: 'quarter', label: 'Quarterly', months: 3 },
  { id: 'biannual', label: 'Biannual', months: 6 },
  { id: 'year', label: 'Yearly', months: 12 },
];

export const isoDate = (date) => `${String(date.getUTCFullYear()).padStart(4, '0')}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
export const parseDate = (value) => { const [y, m, d] = String(value).split('-').map(Number); return new Date(Date.UTC(y, (m || 1) - 1, d || 1)); };

// Returns the date if `value` is a real calendar date (rejects 2026-02-30), otherwise null.
export function realDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? ''));
  if (!match) return null;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (y < 1 || m < 1 || m > 12 || d < 1) return null;
  const date = new Date(Date.UTC(2000, m - 1, d));
  date.setUTCFullYear(y);
  return date.getUTCMonth() === m - 1 && date.getUTCDate() === d ? date : null;
}

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function periodLabel(value, granularity) {
  const date = parseDate(value); const year = date.getUTCFullYear(); const month = date.getUTCMonth();
  if (granularity === 'month') return `${monthNames[month]} ${year}`;
  if (granularity === 'quarter') return `Q${Math.floor(month / 3) + 1} ${year}`;
  if (granularity === 'biannual') return `H${Math.floor(month / 6) + 1} ${year}`;
  return String(year);
}

export function periodStarts(granularity, start, count) {
  const months = (granularities.find((g) => g.id === granularity) || granularities[1]).months;
  const year = Number(String(start).slice(0, 4)); const month = Number(String(start).slice(5, 7));
  return Array.from({ length: count }, (_, index) => {
    const total = (month - 1) + index * months;
    return `${String(year + Math.floor(total / 12)).padStart(4, '0')}-${String((total % 12) + 1).padStart(2, '0')}-01`;
  });
}

// Generated time segments with optional label/description overrides keyed by ISO start date.
export function timelinePeriods(timeline, overrides = []) {
  const byDate = new Map(overrides.map((o) => [o.date, o]));
  return periodStarts(timeline.granularity, timeline.start, timeline.periods).map((date) => {
    const override = byDate.get(date);
    return { date, label: override?.label?.trim() || periodLabel(date, timeline.granularity), generatedLabel: periodLabel(date, timeline.granularity), description: override?.description || '' };
  });
}
export const horizonDate = (timeline) => periodStarts(timeline.granularity, timeline.start, timeline.periods).at(-1);

// Snap any date to the start of the period that contains it (or the first period).
export function snapToPeriod(periods, value) {
  if (!periods.length) return value;
  const time = parseDate(value).getTime();
  let best = periods[0];
  periods.forEach((period) => { if (parseDate(period.date).getTime() <= time) best = period; });
  return best.date;
}

// Maturity is anchored at asOf (current) and at the last period (target), with optional milestones between.
// Values between points use the existing rounded linear interpolation rule.
export function maturityAt(cap, timeline, date) {
  const horizon = horizonDate(timeline);
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
  const handoff = cap.handoffDate || horizonDate(timeline);
  return parseDate(date).getTime() >= parseDate(handoff).getTime() ? cap.futureOwner : cap.owner;
}

// Edit the recorded value that produces `rank` at `date`: the current anchor, the target anchor,
// or a dated milestone. Calculated values are never stored directly.
export function setMaturityAtDate(cap, timeline, date, rank) {
  if (date === timeline.asOf) return { ...cap, current: rank, target: Math.max(cap.target, rank) };
  if (date === horizonDate(timeline)) return { ...cap, target: rank, current: Math.min(cap.current, rank) };
  const milestones = cap.milestones.filter((m) => m.date !== date);
  const existing = cap.milestones.find((m) => m.date === date);
  return { ...cap, milestones: [...milestones, { date, maturity: rank, note: existing?.note || '' }].sort((a, b) => a.date.localeCompare(b.date)) };
}

export const levelLabels = (count) => Array.from({ length: count }, (_, index) => (index === count - 1 && count > 1 ? `${index}+` : String(index)));
