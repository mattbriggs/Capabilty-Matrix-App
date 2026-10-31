import { useState } from 'react';
import { FloppyDisk, Trash } from '@phosphor-icons/react';
import { Dialog, useDirtyGuard } from '../../../components/Panel';
import { deleteEntity, impactOf } from '../../../domain/operations';

// Apply/close lifecycle shared by trays: validation errors block Apply; a dirty draft asks before closing.
export function useTray({ key, label, dirty, errors, candidate, message, onCommit, onClose, confirm }) {
  const [busy, setBusy] = useState(false);
  const [serverIssues, setServerIssues] = useState([]);
  async function apply() {
    if (errors.length || !candidate || busy) return false;
    setBusy(true);
    const result = await onCommit(candidate, message);
    setBusy(false);
    if (result.ok) { onClose(); return true; }
    setServerIssues(result.issues || []);
    return false;
  }
  useDirtyGuard(key, { label, dirty, save: apply, discard: onClose });
  async function requestClose() {
    const choice = await confirm({ title: 'Discard unsaved changes?', body: <p>{label} has changes that are not applied yet.</p>, choices: [{ value: 'apply', label: 'Apply changes' }, { value: 'discard', label: 'Discard' }, { value: 'cancel', label: 'Keep editing' }] });
    if (choice === 'apply') await apply();
    if (choice === 'discard') onClose();
  }
  return { apply, requestClose, busy, serverIssues, submit: (event) => { event.preventDefault(); apply(); } };
}

export function ApplyBar({ errors, busy, label = 'Apply changes', onDelete, deleteLabel }) {
  return <div className="tray-actions">
    {onDelete && <button type="button" className="danger-action" onClick={onDelete}><Trash size={16} /> {deleteLabel}</button>}
    <button type="submit" className="primary-action" disabled={busy || errors.length > 0} aria-disabled={busy || errors.length > 0}><FloppyDisk size={18} /> {busy ? 'Validating…' : label}</button>
  </div>;
}

export const ReadOnlyId = ({ value, hint = 'Stable ID. It is not an editable label.' }) => <div className="readonly-id"><span>ID</span><code>{value}</code><small>{hint}</small></div>;

// Deletion never cascades silently: preview references and require remove or reassign.
export function ImpactBody({ doc, entity, alternatives, resolution, setResolution }) {
  const refs = impactOf(doc, entity);
  return <div className="impact">
    {refs.length ? <><p>These references are affected:</p><ul className="impact-list">{refs.map((ref, index) => <li key={index}><strong>{ref.label}</strong> {ref.detail}</li>)}</ul></> : <p>Nothing else refers to it.</p>}
    {refs.length > 0 && alternatives && <fieldset className="impact-choice"><legend>References</legend>
      <label className="checkbox-row"><input type="radio" name="resolution" checked={resolution.mode === 'remove'} onChange={() => setResolution({ mode: 'remove' })} /> Remove the references</label>
      {alternatives.length > 0 && <label className="checkbox-row"><input type="radio" name="resolution" checked={resolution.mode === 'reassign'} onChange={() => setResolution({ mode: 'reassign', to: alternatives[0].id })} /> Reassign them to
        <select aria-label="Reassign to" disabled={resolution.mode !== 'reassign'} value={resolution.to || alternatives[0].id} onChange={(e) => setResolution({ mode: 'reassign', to: e.target.value })}>{alternatives.map((alt) => <option key={alt.id} value={alt.id}>{alt.label}</option>)}</select></label>}
    </fieldset>}
  </div>;
}

// Promise-based delete confirmation with an impact preview and an explicit resolution.
export function useDeleteConfirm() {
  const [state, setState] = useState(null);
  const ask = (config) => new Promise((resolve) => setState({ ...config, resolve, resolution: { mode: 'remove' } }));
  const close = (value) => { state?.resolve(value); setState(null); };
  const element = state ? <Dialog title={`Delete ${state.name}?`} tone="danger" onCancel={() => close(null)} actions={<>
    <button type="button" className="danger-action solid" data-autofocus onClick={() => close(state.resolution)}><Trash size={16} /> Delete</button>
    <button type="button" className="outline-action compact" onClick={() => close(null)}>Cancel</button></>}>
    <ImpactBody doc={state.doc} entity={state.entity} alternatives={state.alternatives} resolution={state.resolution} setResolution={(resolution) => setState((old) => ({ ...old, resolution }))} />
    <p className="dialog-note">You can undo this from the header after it is applied.</p>
  </Dialog> : null;
  return [ask, element];
}

export function useDeletion({ doc, onCommit, confirmDelete, onDone }) {
  return async (entity, name, alternatives) => {
    const resolution = await confirmDelete({ doc, entity, name, alternatives });
    if (!resolution) return;
    const result = await onCommit(deleteEntity(doc, entity, resolution), `${name} deleted.`);
    if (result.ok) onDone?.();
  };
}
