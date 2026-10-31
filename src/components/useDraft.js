import { useDeferredValue, useMemo, useState } from 'react';
import { deepEqual } from '../domain/schemaValidator.js';
import { validateDocument } from '../domain/validate.js';

// Keep an entity draft separate from the committed document. The candidate document is validated
// promptly as fields change; the draft stays explicitly unsaved until Apply succeeds.
export function useDraft(doc, initial, applyDraft) {
  const [baseline] = useState(initial);
  const [draft, setDraft] = useState(initial);
  const candidate = useMemo(() => { try { return applyDraft(doc, draft); } catch { return null; } }, [doc, draft, applyDraft]);
  const deferred = useDeferredValue(candidate);
  const issues = useMemo(() => (deferred ? validateDocument(deferred).issues : []), [deferred]);
  const update = (key, value) => setDraft((old) => ({ ...old, [key]: value }));
  return { draft, setDraft, update, candidate, issues, dirty: !deepEqual(draft, baseline), errors: issues.filter((i) => i.severity === 'error') };
}
