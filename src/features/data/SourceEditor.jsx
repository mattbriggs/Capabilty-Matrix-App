import { useDeferredValue, useMemo, useState } from 'react';
import { CheckCircle, FloppyDisk } from '@phosphor-icons/react';
import { IssueText } from '../../components/Panel';
import { readDocumentText, toYaml } from '../../domain/document';

// Edit the canonical YAML directly. The text stays an unsaved draft until the whole document validates.
export function SourceEditor({ doc, text: initialText, onApply, applyLabel = 'Apply YAML', intro }) {
  const original = useMemo(() => initialText ?? toYaml(doc), [doc, initialText]);
  const [text, setText] = useState(original);
  const deferred = useDeferredValue(text);
  const result = useMemo(() => readDocumentText(deferred, { projectId: doc?.project.id }), [deferred, doc]);
  const dirty = text !== original;
  const blocking = result.issues.filter((i) => i.severity === 'error');
  const sameProject = !doc || result.kind !== 'document' || result.document?.project?.id === doc.project.id;
  return <div className="source-editor">
    <p>{intro || 'The canonical YAML for this project. Edits stay an unsaved draft until the whole document passes validation.'} {result.kind === 'migration' && 'This text is version 1; applying it migrates it to version 2.'}</p>
    <textarea aria-label="Project YAML" spellCheck="false" value={text} onChange={(e) => setText(e.target.value)} rows={24} />
    <div className="source-status" role="status" aria-live="polite">{blocking.length ? `${blocking.length} error(s) block applying.` : <><CheckCircle size={16} /> Valid {result.issues.length ? `with ${result.issues.length} warning(s)` : ''}</>}{!sameProject && ' The project id differs from the open project; apply it through Projects → Import instead.'}</div>
    {result.issues.length > 0 && <ul className="issue-list compact">{result.issues.slice(0, 40).map((issue) => <li key={`${issue.path}-${issue.code}`}><span><IssueText issue={issue} /></span><code>{issue.path || '(document)'}</code></li>)}</ul>}
    <div className="tray-actions">
      {dirty && <button type="button" className="outline-action compact" onClick={() => setText(original)}>Discard edits</button>}
      <button type="button" className="primary-action" disabled={!dirty && !initialText ? true : Boolean(blocking.length) || !sameProject} onClick={() => onApply(result.document, text)}><FloppyDisk size={18} /> {applyLabel}</button>
    </div>
  </div>;
}
