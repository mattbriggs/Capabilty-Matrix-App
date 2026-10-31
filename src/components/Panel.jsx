import { createContext, useContext, useEffect, useId, useRef, useState } from 'react';
import { WarningCircle, X } from '@phosphor-icons/react';

// Registry of unsaved work (open drafts, unsaved map layouts) so navigation can ask Save/Discard/Cancel.
export const DirtyContext = createContext({ register: () => () => {} });
export function useDirtyGuard(key, entry) {
  const { register } = useContext(DirtyContext);
  const ref = useRef(entry);
  ref.current = entry;
  useEffect(() => register(key, () => ref.current), [key, register]);
}

// Drawer anatomy shared by every editing tray. Escape and the close button ask before discarding a dirty
// draft; focus returns to the element that opened the tray.
export function Panel({ title, eyebrow, onClose, wide, children, onSubmit, dirty = false, onDiscardRequest, className = '', focusPath }) {
  const Tag = onSubmit ? 'form' : 'section';
  const ref = useRef(null);
  const opener = useRef(typeof document !== 'undefined' ? document.activeElement : null);
  const titleId = useId();
  const requestClose = () => (dirty && onDiscardRequest ? onDiscardRequest() : onClose());
  useEffect(() => {
    const node = ref.current;
    // Focus the exact field for an issue path, else its nearest enclosing field group, else the first control.
    let target = null;
    for (let parts = focusPath ? focusPath.split('.') : []; parts.length && !target; parts = parts.slice(0, -1)) target = node?.querySelector(`[data-path="${CSS.escape(parts.join('.'))}"]`);
    target = target || node?.querySelector('input:not([type=hidden]):not([disabled]),select,textarea,button:not(.icon-button)');
    target?.scrollIntoView?.({ block: 'center' });
    target?.focus();
    const restore = opener.current;
    return () => { if (restore && document.contains(restore)) restore.focus(); };
  }, [focusPath]);
  return <div className="modal-backdrop" onMouseDown={requestClose} onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); requestClose(); } }}>
    <Tag ref={ref} className={`editor-panel ${wide ? 'wide-panel' : ''} ${className}`} role="dialog" aria-modal="true" aria-labelledby={titleId} onMouseDown={(e) => e.stopPropagation()} onSubmit={onSubmit} noValidate>
      <div className="modal-heading"><div><div className="eyebrow">{eyebrow}</div><h2 id={titleId}>{title}</h2>{dirty && <span className="draft-badge">Unsaved draft</span>}</div><button type="button" className="icon-button" onClick={requestClose} aria-label={`Close ${title.toLowerCase()}`}><X size={22} /></button></div>
      {children}
    </Tag>
  </div>;
}

export function Dialog({ title, children, actions, onCancel, tone }) {
  const ref = useRef(null);
  const opener = useRef(typeof document !== 'undefined' ? document.activeElement : null);
  const titleId = useId();
  useEffect(() => {
    ref.current?.querySelector('[data-autofocus],button')?.focus();
    const restore = opener.current;
    return () => { if (restore && document.contains(restore)) restore.focus(); };
  }, []);
  return <div className="dialog-backdrop" onMouseDown={onCancel} onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onCancel(); } }}>
    <section ref={ref} className={`dialog ${tone || ''}`} role="alertdialog" aria-modal="true" aria-labelledby={titleId} onMouseDown={(e) => e.stopPropagation()}>
      <h2 id={titleId}>{title}</h2>
      <div className="dialog-body">{children}</div>
      <div className="dialog-actions">{actions}</div>
    </section>
  </div>;
}

const severityLabel = { error: 'Error', warning: 'Warning', info: 'Note' };
export function IssueText({ issue }) {
  return <><strong className={`severity ${issue.severity}`}>{severityLabel[issue.severity]}</strong> {issue.message}</>;
}

// Issues for one field, announced to assistive technology and never conveyed by colour alone.
export function FieldIssues({ id, issues }) {
  if (!issues?.length) return null;
  return <ul className="field-issues" id={id} role="alert">{issues.map((issue) => <li key={`${issue.code}-${issue.path}`} className={issue.severity}><WarningCircle size={14} weight="bold" aria-hidden="true" /><span><IssueText issue={issue} /></span></li>)}</ul>;
}

// A labelled control bound to a document path. `issues` is the draft's issue list.
export function Field({ label, path, issues = [], children, hint, className = '' }) {
  const describedBy = useId();
  const own = issues.filter((issue) => issue.path === path || issue.path.startsWith(`${path}.`));
  const child = typeof children === 'function' ? children({ 'data-path': path, 'aria-invalid': own.some((i) => i.severity === 'error') || undefined, 'aria-describedby': own.length ? describedBy : undefined }) : children;
  return <label className={className}>{label}{child}{hint && <small className="field-hint">{hint}</small>}<FieldIssues id={describedBy} issues={own} /></label>;
}

export function DraftSummary({ issues, prefix }) {
  const relevant = issues.filter((issue) => !prefix || issue.path === prefix || issue.path.startsWith(`${prefix}.`) || !issue.path.startsWith('capabilities'));
  const errors = relevant.filter((i) => i.severity === 'error');
  if (!errors.length) return null;
  return <div className="form-error" role="alert"><strong>{errors.length} error{errors.length === 1 ? '' : 's'} must be fixed before applying.</strong><ul>{errors.slice(0, 6).map((issue) => <li key={`${issue.path}-${issue.code}`}>{issue.message}</li>)}</ul></div>;
}

export function useConfirm() {
  const [state, setState] = useState(null);
  const ask = (config) => new Promise((resolve) => setState({ ...config, resolve }));
  const close = (value) => { state?.resolve(value); setState(null); };
  const element = state ? <Dialog title={state.title} onCancel={() => close('cancel')} tone={state.tone} actions={state.choices.map((choice, index) => <button key={choice.value} type="button" className={index === 0 ? 'primary-action compact' : 'outline-action compact'} data-autofocus={index === 0 || undefined} onClick={() => close(choice.value)}>{choice.label}</button>)}>{state.body}</Dialog> : null;
  return [ask, element];
}
