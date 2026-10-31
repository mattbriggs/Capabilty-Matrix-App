// Applies a fixture case's `set` patch to a deep copy of the base document.
export function applyCase(base, testCase) {
  if ('document' in testCase) return structuredClone(testCase.document);
  const doc = structuredClone(base);
  for (const [path, value] of Object.entries(testCase.set || {})) {
    const parts = path.split('.').map((p) => (/^\d+$/.test(p) ? Number(p) : p));
    let target = doc;
    for (const part of parts.slice(0, -1)) target = target[part];
    const last = parts.at(-1);
    if (value === '$delete') delete target[last]; else target[last] = structuredClone(value);
  }
  return doc;
}
export const issueKeys = (issues) => issues.map(({ path, code, severity, entityType, entityId }) => ({ path, code, severity, entityType, entityId }));
