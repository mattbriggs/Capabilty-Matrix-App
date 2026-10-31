import { useState } from 'react';
import { ArrowCounterClockwise, DownloadSimple, FileCode, FileCsv, FolderOpen, PencilSimple, Plus, Trash, UploadSimple, Warning } from '@phosphor-icons/react';
import { Dialog } from '../../components/Panel';

const when = (project) => (project.updatedAt ? new Date(project.updatedAt).toLocaleString() : project.modifiedMs ? new Date(project.modifiedMs).toLocaleString() : '—');

function NewProjectDialog({ onCancel, onCreate }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [start, setStart] = useState('empty');
  return <Dialog title="New project" onCancel={onCancel} actions={<>
    <button type="button" className="primary-action compact" disabled={!name.trim()} onClick={() => onCreate({ name: name.trim(), description, fromSample: start === 'sample' })}>Create project</button>
    <button type="button" className="outline-action compact" onClick={onCancel}>Cancel</button></>}>
    <div className="dialog-form">
      <label>Name<input data-autofocus value={name} onChange={(e) => setName(e.target.value)} /></label>
      <label>Description<textarea rows="2" value={description} onChange={(e) => setDescription(e.target.value)} /></label>
      <fieldset><legend>Start from</legend>
        <label className="checkbox-row"><input type="radio" name="start" checked={start === 'empty'} onChange={() => setStart('empty')} /> An empty project (default settings, no capabilities)</label>
        <label className="checkbox-row"><input type="radio" name="start" checked={start === 'sample'} onChange={() => setStart('sample')} /> A copy of the bundled sample</label>
      </fieldset>
    </div>
  </Dialog>;
}

export function ProjectsView({ store, onOpen, onCreate, onDelete, onRestore, onEdit, onImport, exportYaml, exportCsv, exportSchema }) {
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const activeId = store.active?.id;
  const projects = store.projects.filter((p) => !search || `${p.name} ${p.description} ${p.id}`.toLowerCase().includes(search.toLowerCase()));
  return <section className="projects-view view-enter" aria-label="Projects">
    <div className="data-intro"><div><div className="eyebrow">Project and file management</div><h2>Projects</h2>
      <p>{store.desktop ? 'Each project is one YAML document stored in the app data folder. Deleted projects go to the trash and can be restored.' : 'Each project is one YAML document held in this browser session.'}</p></div></div>
    {!store.desktop && <div className="session-warning" role="note"><Warning size={18} /><span><strong>Browser preview:</strong> projects live only in this tab. Refreshing or closing it loses anything you have not exported. Export YAML or CSV to keep your work; the desktop app saves projects to disk.</span></div>}
    <div className="records-toolbar">
      <label className="axis-select grow">Search projects<input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, description or ID" /></label>
      <button type="button" className="edit-action" onClick={() => setCreating(true)}><Plus size={16} /> New project</button>
      <button type="button" className="text-action" onClick={onImport}><UploadSimple size={16} /> Import YAML or CSV</button>
      <button type="button" className="text-action" onClick={exportSchema} title="The exact JSON Schema used for structural validation"><FileCode size={16} /> Export JSON Schema</button>
    </div>
    <p className="muted small">The JSON Schema covers structure only. Cross-record rules (unique IDs, references, maturity bounds, timeline dates, cycles) need the application validator.</p>
    {projects.length ? <div className="records-scroll"><table className="records-table projects-table"><caption className="sr-only">Projects</caption>
      <thead><tr><th scope="col">Project</th><th scope="col">ID</th><th scope="col">Updated</th><th scope="col">Location</th><th scope="col">Actions</th></tr></thead>
      <tbody>{projects.map((p) => <tr key={p.id} className={p.id === activeId ? 'active-row' : ''}>
        <th scope="row"><button type="button" className="record-link" onClick={() => onOpen(p.id)}>{p.name || p.id}</button>{p.id === activeId && <span className="pill">Open</span>}{p.unexported && <span className="pill warn">Not exported</span>}<small className="block muted">{p.description}</small></th>
        <td><code>{p.id}</code></td><td>{when(p)}</td><td className="location">{p.location}</td>
        <td className="row-buttons">
          <button type="button" className="text-action" onClick={() => onOpen(p.id)} disabled={p.id === activeId}><FolderOpen size={15} /> Open</button>
          <button type="button" className="text-action" onClick={() => onEdit(p.id)}><PencilSimple size={15} /> Details</button>
          <button type="button" className="text-action" onClick={() => exportYaml(p.id)}><DownloadSimple size={15} /> YAML</button>
          <button type="button" className="text-action" onClick={() => exportCsv(p.id)}><FileCsv size={15} /> CSV</button>
          <button type="button" className="text-action danger" onClick={() => onDelete(p)}><Trash size={15} /> Delete</button>
        </td></tr>)}</tbody></table></div>
      : <div className="empty-state"><strong>{store.projects.length ? 'No projects match.' : 'No projects yet.'}</strong><p>Create a project or import a YAML or CSV file.</p></div>}
    <h3 className="trash-head">Trash</h3>
    {store.trash.length ? <ul className="trash-list">{store.trash.map((t) => <li key={t.trashId}><span><strong>{t.name}</strong> <code>{t.id}</code> <small className="muted">deleted {new Date(t.deletedAtMs).toLocaleString()}</small></span><button type="button" className="text-action" onClick={() => onRestore(t)}><ArrowCounterClockwise size={15} /> Restore</button></li>)}</ul> : <p className="muted">The trash is empty. Deleting a project moves it here; deleting a managed copy never deletes the original file you imported.</p>}
    {creating && <NewProjectDialog onCancel={() => setCreating(false)} onCreate={async (options) => { setCreating(false); await onCreate(options); }} />}
  </section>;
}
