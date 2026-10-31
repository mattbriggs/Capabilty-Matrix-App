// Cross-record rules JSON Schema cannot express. Runs on the structurally valid, defaults-filled document.
// Twin of sidecar/capmatrix/validation/semantic.py; tests/fixtures/validation holds both to the same results.
import { makeIssue } from './issues.js';
import { periodStarts, realDate } from './timeline.js';

const capitalize = (value) => value.charAt(0).toUpperCase() + value.slice(1);

export function semantic(doc) {
  const issues = [];
  const add = (severity, code, parts, message) => issues.push(makeIssue(doc, severity, code, parts, message));
  const duplicates = (items, key, base, noun) => {
    const seen = new Set();
    items.forEach((item, index) => {
      const value = item[key];
      if (seen.has(value)) add('error', 'id.duplicate', [...base, index, key], `Another ${noun} already uses \`${value}\`. Give this ${noun} a unique ${key}.`);
      seen.add(value);
    });
    return seen;
  };

  const { timeline } = doc.settings;
  let periods = null;
  ['start', 'asOf'].forEach((key) => {
    if (!realDate(timeline[key])) add('error', 'date.invalid', ['settings', 'timeline', key], `${timeline[key]} is not a real calendar date. Enter a valid YYYY-MM-DD date.`);
  });
  if (realDate(timeline.start)) periods = periodStarts(timeline.granularity, timeline.start, timeline.periods);
  const first = periods?.[0]; const horizon = periods?.at(-1);
  const inside = (date) => first <= date && date <= horizon;
  if (periods && realDate(timeline.asOf) && !inside(timeline.asOf)) {
    add('error', 'timeline.asOf.range', ['settings', 'timeline', 'asOf'], `Current maturity is anchored at ${timeline.asOf}, outside the timeline (${first} to ${horizon}). Choose a date inside the timeline or extend it.`);
  }

  const audienceIds = duplicates(doc.settings.audiences, 'id', ['settings', 'audiences'], 'audience');
  const domainIds = duplicates(doc.domains, 'id', ['domains'], 'domain');
  const { capabilities } = doc;
  const capabilityIds = duplicates(capabilities, 'id', ['capabilities'], 'capability');
  const allLevelIds = new Set();

  capabilities.forEach((cap, index) => {
    const base = ['capabilities', index];
    const levelIds = duplicates(cap.levels, 'id', [...base, 'levels'], 'maturity level');
    levelIds.forEach((id) => allLevelIds.add(id));
    const top = cap.levels.length - 1;
    ['current', 'target'].forEach((field) => {
      if (cap[field] > top) add('error', 'maturity.range', [...base, field], `${capitalize(field)} maturity M${cap[field]} is above the highest defined level (M${top}). Choose M0–M${top} or add levels.`);
    });
    if (cap.target < cap.current) add('error', 'maturity.order', [...base, 'target'], `Target maturity M${cap.target} is below current maturity M${cap.current}. Raise the target or lower the current maturity.`);

    const handoff = cap.handoffDate;
    if (handoff !== null) {
      if (!realDate(handoff)) add('error', 'date.invalid', [...base, 'handoffDate'], `${handoff} is not a real calendar date. Enter a valid YYYY-MM-DD date.`);
      else if (periods && !inside(handoff)) add('warning', 'handoff.range', [...base, 'handoffDate'], `The handoff date ${handoff} is outside the timeline (${first} to ${horizon}), so the handoff is never shown. Move it inside the timeline.`);
    }

    const seenDates = new Set();
    cap.milestones.forEach((milestone, k) => {
      const mp = [...base, 'milestones', k];
      if (milestone.maturity > top) add('error', 'maturity.range', [...mp, 'maturity'], `Milestone maturity M${milestone.maturity} is above the highest defined level (M${top}).`);
      const { date } = milestone;
      if (!realDate(date)) { add('error', 'date.invalid', [...mp, 'date'], `${date} is not a real calendar date. Enter a valid YYYY-MM-DD date.`); return; }
      if (seenDates.has(date)) add('error', 'milestone.duplicate', [...mp, 'date'], `Another milestone already uses ${date}. Keep one milestone per date.`);
      seenDates.add(date);
      if (periods) {
        if (date === timeline.asOf || date === horizon) add('error', 'milestone.anchorCollision', [...mp, 'date'], `${date} is an anchor date (current maturity at ${timeline.asOf}, target at ${horizon}). Edit current or target maturity instead, or move the milestone.`);
        else if (!inside(date)) add('error', 'milestone.range', [...mp, 'date'], `Milestone ${date} is outside the timeline (${first} to ${horizon}). Move it inside the timeline or extend the timeline.`);
      }
    });

    const seenDeps = new Set();
    cap.dependencies.forEach((dep, k) => {
      const dp = [...base, 'dependencies', k];
      if (dep === cap.id) add('error', 'dependency.self', dp, `${cap.name} cannot depend on itself. Remove this dependency.`);
      else if (!capabilityIds.has(dep)) add('error', 'ref.capability.missing', dp, `Dependency \`${dep}\` does not match any capability. Remove it or create the capability.`);
      if (seenDeps.has(dep)) add('warning', 'dependency.duplicate', dp, `\`${dep}\` is listed more than once. Remove the repeat.`);
      seenDeps.add(dep);
    });

    if (cap.domainId !== null && !domainIds.has(cap.domainId)) add('error', 'ref.domain.missing', [...base, 'domainId'], `Domain \`${cap.domainId}\` does not exist. Choose an existing domain or leave the capability unassigned.`);

    const seenMembers = new Set();
    cap.audienceIds.forEach((audienceId, k) => {
      if (!audienceIds.has(audienceId)) add('error', 'ref.audience.missing', [...base, 'audienceIds', k], `Audience \`${audienceId}\` does not exist. Remove the membership or add the audience in Settings.`);
      if (seenMembers.has(audienceId)) add('warning', 'membership.duplicate', [...base, 'audienceIds', k], `Audience \`${audienceId}\` is listed more than once. Remove the repeat.`);
      seenMembers.add(audienceId);
    });

    guidance(add, cap.journey.guidance, [...base, 'journey', 'guidance'], audienceIds, levelIds, 'error');
  });

  cycles(add, capabilities);

  const seenSegments = new Set();
  doc.timeSegments.forEach((segment, index) => {
    if (!realDate(segment.date)) add('error', 'date.invalid', ['timeSegments', index, 'date'], `${segment.date} is not a real calendar date.`);
    else if (seenSegments.has(segment.date)) add('error', 'id.duplicate', ['timeSegments', index, 'date'], `Time segment ${segment.date} already has an override. Merge the two overrides.`);
    seenSegments.add(segment.date);
  });

  const { presentation } = doc;
  duplicates(presentation.journeySections, 'id', ['presentation', 'journeySections'], 'journey section');
  guidance(add, presentation.defaultGuidance, ['presentation', 'defaultGuidance'], audienceIds, allLevelIds, 'warning');
  const table = presentation.dataTable;
  if (table.xAxis === table.yAxis) add('error', 'table.axes.same', ['presentation', 'dataTable', 'yAxis'], 'The data table X and Y axes use the same dimension. Choose two different dimensions.');
  table.filters.capabilityIds.forEach((capId, k) => {
    if (!capabilityIds.has(capId)) add('warning', 'ref.filter.missing', ['presentation', 'dataTable', 'filters', 'capabilityIds', k], `The table filter refers to missing capability \`${capId}\`; it is ignored.`);
  });

  duplicates(doc.mapViews, 'id', ['mapViews'], 'map view');
  doc.mapViews.forEach((view, index) => {
    const base = ['mapViews', index];
    ['currentDate', 'focusDate'].forEach((field) => {
      if (view[field] !== null && !realDate(view[field])) add('error', 'date.invalid', [...base, field], `${view[field]} is not a real calendar date.`);
    });
    if (view.selectedCapabilityId !== null && !capabilityIds.has(view.selectedCapabilityId)) add('warning', 'ref.mapView.missing', [...base, 'selectedCapabilityId'], `The view selects missing capability \`${view.selectedCapabilityId}\`; it will be cleared when the view opens.`);
    if (view.audienceId !== null && !audienceIds.has(view.audienceId)) add('warning', 'ref.mapView.missing', [...base, 'audienceId'], `The view uses missing audience \`${view.audienceId}\`; the first audience is used instead.`);
    view.filters.domainIds.forEach((domainId, k) => {
      if (!domainIds.has(domainId)) add('warning', 'ref.mapView.missing', [...base, 'filters', 'domainIds', k], `The view filters on missing domain \`${domainId}\`; the filter is ignored.`);
    });
    const seenPlacements = new Set();
    view.placements.forEach((placement, k) => {
      const key = `${placement.nodeId}\u0000${placement.context}`;
      if (seenPlacements.has(key)) add('error', 'placement.duplicate', [...base, 'placements', k], `${placement.nodeId} has two saved positions for ${placement.context}. Keep one.`);
      seenPlacements.add(key);
      const node = placement.nodeId;
      if (node.startsWith('cap:') && !capabilityIds.has(node.slice(4))) add('warning', 'ref.mapView.missing', [...base, 'placements', k, 'nodeId'], `The saved position for missing capability \`${node.slice(4)}\` will be pruned when the view opens.`);
    });
  });

  return issues;
}

function guidance(add, entries, base, audienceIds, levelIds, missingLevel) {
  const seen = new Set();
  entries.forEach((entry, k) => {
    if (!audienceIds.has(entry.audienceId)) add('error', 'ref.audience.missing', [...base, k, 'audienceId'], `Guidance refers to missing audience \`${entry.audienceId}\`. Choose an existing audience or delete the guidance.`);
    if (!levelIds.has(entry.levelId)) {
      if (missingLevel === 'error') add('error', 'ref.level.missing', [...base, k, 'levelId'], `Guidance refers to missing maturity level \`${entry.levelId}\`. Choose an existing level or delete the guidance.`);
      else add('warning', 'guidance.level.unused', [...base, k, 'levelId'], `Default guidance for level \`${entry.levelId}\` matches no capability level, so it is never shown.`);
    }
    const pair = `${entry.audienceId}\u0000${entry.levelId}`;
    if (seen.has(pair)) add('error', 'guidance.duplicate', [...base, k], 'Guidance for this audience and level is recorded twice. Merge the entries.');
    seen.add(pair);
  });
}

// Depth-first search in document order; the same traversal as the Python twin so both report the same cycles.
export function cycles(add, capabilities) {
  const ids = new Set(capabilities.map((cap) => cap.id));
  const firstIndex = new Map(); const graph = new Map();
  capabilities.forEach((cap, index) => {
    if (graph.has(cap.id)) return;
    firstIndex.set(cap.id, index);
    const deps = [];
    cap.dependencies.forEach((dep) => { if (ids.has(dep) && dep !== cap.id && !deps.includes(dep)) deps.push(dep); });
    graph.set(cap.id, deps);
  });
  const state = new Map(); const stack = []; const reported = new Set();
  const visit = (node) => {
    state.set(node, 1); stack.push(node);
    graph.get(node).forEach((dep) => {
      if (state.get(dep) === 1) {
        let cycle = stack.slice(stack.indexOf(dep));
        const min = cycle.reduce((a, b) => (b < a ? b : a));
        const start = cycle.indexOf(min);
        cycle = [...cycle.slice(start), ...cycle.slice(0, start)];
        const key = cycle.join('>');
        if (!reported.has(key)) {
          reported.add(key);
          add('warning', 'dependency.cycle', ['capabilities', firstIndex.get(cycle[0]), 'dependencies'], `Dependency cycle: ${[...cycle, cycle[0]].join(' → ')}. Mutual dependencies are allowed in planning, but confirm they are intended.`);
        }
      } else if (!state.has(dep)) visit(dep);
    });
    stack.pop(); state.set(node, 2);
  };
  capabilities.forEach((cap) => { if (!state.has(cap.id)) visit(cap.id); });
}
