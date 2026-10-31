// Structured issues: { severity, code, entityType, entityId, path, message }.
// Mirrors sidecar/capmatrix/validation/issues.py.

export const pathString = (parts) => parts.join('.');
export const pathParts = (path) => (path ? path.split('.').map((part) => (/^\d+$/.test(part) ? Number(part) : part)) : []);

function at(value, ...keys) {
  let current = value;
  for (const key of keys) {
    if (typeof key === 'number') { if (!Array.isArray(current) || key >= current.length) return null; current = current[key]; }
    else { if (!current || typeof current !== 'object' || Array.isArray(current)) return null; current = current[key]; }
  }
  return current ?? null;
}
const text = (value) => (typeof value === 'string' ? value : null);

export function entityFor(doc, parts) {
  if (!parts.length) return ['document', null];
  const [head] = parts;
  const index = typeof parts[1] === 'number' ? parts[1] : null;
  if (head === 'project') return ['project', text(at(doc, 'project', 'id'))];
  if (head === 'settings') {
    if (parts.length > 2 && parts[1] === 'audiences' && typeof parts[2] === 'number') return ['audience', text(at(doc, 'settings', 'audiences', parts[2], 'id'))];
    if (parts.length > 1 && parts[1] === 'timeline') return ['timeline', null];
    return ['settings', null];
  }
  if (head === 'capabilities' && index !== null) {
    const capId = text(at(doc, 'capabilities', index, 'id'));
    if (parts.length > 3 && parts[2] === 'levels' && typeof parts[3] === 'number') {
      const levelId = text(at(doc, 'capabilities', index, 'levels', parts[3], 'id'));
      return ['level', capId && levelId ? `${capId}/${levelId}` : null];
    }
    return ['capability', capId];
  }
  if (head === 'domains' && index !== null) return ['domain', text(at(doc, 'domains', index, 'id'))];
  if (head === 'timeSegments' && index !== null) return ['timeSegment', text(at(doc, 'timeSegments', index, 'date'))];
  if (head === 'mapViews' && index !== null) return ['mapView', text(at(doc, 'mapViews', index, 'id'))];
  if (head === 'presentation') return ['presentation', null];
  return ['document', null];
}

export function makeIssue(doc, severity, code, parts, message) {
  const [entityType, entityId] = entityFor(doc, parts);
  return { severity, code, entityType, entityId, path: pathString(parts), message };
}

export const issueKey = (issue) => [issue.path, issue.code, issue.severity, issue.entityType, issue.entityId || ''];
const compare = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
export function sortIssues(issues) {
  return [...issues].sort((a, b) => {
    const ka = issueKey(a); const kb = issueKey(b);
    for (let i = 0; i < ka.length; i += 1) { const c = compare(ka[i], kb[i]); if (c) return c; }
    return 0;
  });
}

export const hasErrors = (issues) => issues.some((issue) => issue.severity === 'error');
