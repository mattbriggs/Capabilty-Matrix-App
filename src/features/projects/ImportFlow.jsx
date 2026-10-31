import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { Warning, X } from '@phosphor-icons/react';
import { Dialog, IssueText } from '../../components/Panel';
import { SourceEditor } from '../data/SourceEditor';

const typeLabels = { project: 'project', settings: 'settings', presentation: 'presentation', domain: 'domains', 'time-segment': 'time-segment overrides', capability: 'capabilities', 'map-view': 'map views', extensions: 'extensions', document: 'document fields' };

// Preview before anything is written: format, counts, issues, migration notes and same-ID choices.
function ImportDialog({ preview, onCancel, onApply, onFix, onOpenExisting }) {
  const errors = preview.issues.filter((i) => i.severity === 'error');
  const counts = Object.entries(preview.counts || {});
  const title = preview.kind === 'migration' ? 'Migrate a version 1 file' : preview.kind === 'csv' ? 'Import CSV project' : 'Import YAML project';
  const cancel = <button type="button" className="outline-action compact" onClick={onCancel}>Cancel</button>;
  const actions = errors.length
    ? <>{preview.format !== 'csv' && <button type="button" className="primary-action compact" onClick={onFix}>Fix in source editor</button>}{cancel}</>
    : preview.existing
      ? <><button type="button" className="outline-action compact" onClick={onOpenExisting}>Open existing</button><button type="button" className="danger-action solid" onClick={() => onApply('replace')}>Replace existing</button><button type="button" className="primary-action compact" onClick={() => onApply('copy')}>Import as copy</button>{cancel}</>
      : <><button type="button" className="primary-action compact" onClick={() => onApply('new')}>{preview.kind === 'migration' ? 'Migrate and import' : 'Import'}</button>{cancel}</>;
  return <Dialog title={title} onCancel={onCancel} actions={actions}>
    <p><strong>{preview.fileName || 'File'}</strong>{preview.document?.project?.name ? ` · ${preview.document.project.name}` : ''}</p>
    {counts.length > 0 && <ul className="count-list">{counts.map(([type, n]) => <li key={type}>{n} {typeLabels[type] || type}</li>)}</ul>}
    {preview.kind === 'migration' && <div className="effects-preview"><strong>Migration preview</strong><ul>{preview.notes.map((n) => <li key={n}>{n}</li>)}<li>The original bytes are kept as <code>original-v1.yaml</code> beside the new project. Invalid values are not repaired.</li></ul></div>}
    {preview.existing && <div className="effects-preview warning"><Warning size={18} /><span>A project with the same ID (<code>{preview.existing.id}</code>, “{preview.existing.name || preview.existing.id}”) already exists. Nothing is merged. <strong>Replace existing</strong> overwrites it with this file; <strong>Import as copy</strong> assigns a new ID.</span></div>}
    {preview.format === 'csv' && <p className="muted small">CSV must use this app's typed-row format (<code>format_version,record_type,record_id,parent_id,payload_json</code>). Third-party column layouts are not supported.</p>}
    {preview.issues.length > 0 ? <><p>{errors.length ? `${errors.length} error(s) must be fixed before importing. Nothing has been written.` : `${preview.issues.length} warning(s); you can import.`}</p><ul className="issue-list compact">{preview.issues.slice(0, 30).map((issue) => <li key={`${issue.path}-${issue.code}`}><span><IssueText issue={issue} /></span><code>{issue.path || '(document)'}</code></li>)}</ul></> : <p>The file passes every check.</p>}
  </Dialog>;
}

// Owns the file picker, preview, fix-in-source draft and apply steps for YAML/CSV imports.
export const ImportFlow = forwardRef(function ImportFlow({ previewImport, applyImport, openProject, guard, notify }, ref) {
  const fileRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [fixing, setFixing] = useState(null);
  useImperativeHandle(ref, () => ({ start: () => fileRef.current?.click() }));
  async function pick(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try { setPreview(await previewImport(await file.text(), file.name)); } catch (error) { notify(`Could not read ${file.name}: ${error.message}`, 'error'); }
  }
  async function apply(mode) {
    const current = preview;
    guard(async () => {
      try { await applyImport(current, mode); setPreview(null); notify(mode === 'replace' ? 'Project replaced from the imported file.' : current.kind === 'migration' ? 'Version 1 file migrated and imported. The original is kept.' : 'Project imported.'); } catch (error) { notify(`Import failed: ${error.message}`, 'error'); }
    });
  }
  return <>
    <input ref={fileRef} type="file" hidden accept=".yaml,.yml,.csv,text/yaml,text/csv" onChange={pick} />
    {preview && !fixing && <ImportDialog preview={preview} onCancel={() => setPreview(null)} onOpenExisting={() => { const id = preview.existing.id; setPreview(null); guard(() => openProject(id)); }} onFix={() => setFixing(preview)} onApply={apply} />}
    {fixing && <div className="modal-backdrop" onKeyDown={(e) => { if (e.key === 'Escape') setFixing(null); }}><section className="editor-panel wide-panel source-panel" role="dialog" aria-modal="true" aria-label="Fix import">
      <div className="modal-heading"><div><div className="eyebrow">Import draft</div><h2>Fix before importing</h2><span className="draft-badge">Unsaved draft</span></div><button type="button" className="icon-button" onClick={() => setFixing(null)} aria-label="Cancel import"><X size={22} /></button></div>
      <SourceEditor doc={null} text={fixing.originalText} applyLabel="Check again" intro="Correct the errors below. Nothing is imported until the file passes validation." onApply={async (_, text) => { const next = await previewImport(text, fixing.fileName); setFixing(null); setPreview(next); }} />
    </section></div>}
  </>;
});
