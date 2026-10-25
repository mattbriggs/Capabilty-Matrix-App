import { useEffect, useRef, useState } from 'react';
import YAML from 'yaml';
import {
  ArrowRight, CaretDown, CheckCircle, DownloadSimple, FileText, FloppyDisk,
  FolderSimple, Graph, GridFour, Info, MapTrifold, PencilSimple, Printer,
  UploadSimple, X,
} from '@phosphor-icons/react';
import { audiences, normalizeCapabilities } from './model';
import { loadDesktopYaml, runSidecar, saveDesktopYaml } from './sidecarBridge';
import { MatrixView, JourneyView, MapView } from './Views';
import sampleYaml from './data/capabilities.yaml?raw';

const defaultCapabilities = normalizeCapabilities(YAML.parse(sampleYaml));

const views = [
  { id: 'matrix', label: 'Matrix', icon: GridFour },
  { id: 'journey', label: 'Capability journey', icon: Graph },
  { id: 'map', label: 'Domain map', icon: MapTrifold },
];

function Editor({ selected, capabilities, onClose, onSave }) {
  const [form, setForm] = useState({ ...selected, dependencies: [...selected.dependencies] });
  const [error, setError] = useState('');
  const update = (key, value) => setForm((old) => ({ ...old, [key]: value }));
  function save(event) {
    event.preventDefault();
    if (!form.name.trim()) return setError('Enter a capability name.');
    if (Number(form.target) < Number(form.current)) return setError('Target maturity should be at least current maturity.');
    onSave({ ...form, name: form.name.trim(), current: Number(form.current), target: Number(form.target) });
  }
  return <div className="modal-backdrop" onMouseDown={onClose}><form className="editor-panel" onMouseDown={(e) => e.stopPropagation()} onSubmit={save}>
    <div className="modal-heading"><div><div className="eyebrow">Capability record</div><h2>Edit capability</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Close editor"><X size={22} /></button></div>
    <p>Changes update all three views. Export YAML to save the record.</p>
    <label>Name<input value={form.name} onChange={(e) => update('name', e.target.value)} /></label>
    <label>Summary<textarea rows="2" value={form.summary} onChange={(e) => update('summary', e.target.value)} /></label>
    <div className="form-pair"><label>Current maturity<input type="number" min="0" value={form.current} onChange={(e) => update('current', e.target.value)} /></label><label>Target maturity<input type="number" min="0" value={form.target} onChange={(e) => update('target', e.target.value)} /></label></div>
    <div className="form-pair"><label>Current owner<select value={form.owner} onChange={(e) => update('owner', e.target.value)}><option value="appliance">Appliance</option><option value="federated">Federated</option></select></label><label>Future owner<select value={form.futureOwner} onChange={(e) => update('futureOwner', e.target.value)}><option value="appliance">Appliance</option><option value="federated">Federated</option></select></label></div>
    <label>Scope decision<textarea rows="3" value={form.decision} onChange={(e) => update('decision', e.target.value)} /></label>
    <fieldset><legend>Dependencies</legend>{capabilities.filter((cap) => cap.id !== selected.id).map((cap) => <label className="checkbox-row" key={cap.id}><input type="checkbox" checked={form.dependencies.includes(cap.id)} onChange={(e) => update('dependencies', e.target.checked ? [...form.dependencies, cap.id] : form.dependencies.filter((id) => id !== cap.id))} />{cap.name}</label>)}</fieldset>
    {error && <div className="form-error" role="alert">{error}</div>}<button type="submit" className="primary-action"><FloppyDisk size={18} /> Save changes</button>
  </form></div>;
}

function DitaPanel({ selected, onClose }) {
  const mapping = selected.dita || {};
  return <div className="modal-backdrop" onMouseDown={onClose}><section className="editor-panel mapping-panel" onMouseDown={(e) => e.stopPropagation()} aria-label="Content mapping">
    <div className="modal-heading"><div><div className="eyebrow">Content trace</div><h2>DITA mapping</h2></div><button className="icon-button" onClick={onClose} aria-label="Close content mapping"><X size={22} /></button></div>
    <p>Planning metadata for <strong>{selected.name}</strong>. Attribute names remain hypotheses until the content model is defined.</p>
    <div className="mapping-steps"><span>YAML capability</span><ArrowRight size={16} /><span>DITA tags and DITAVals</span><ArrowRight size={16} /><span>Embedded help + PDF</span></div>
    <dl><dt>Audience</dt><dd>{Array.isArray(mapping.audience) ? mapping.audience.join(', ') : 'Unmapped'}</dd><dt>Maturity</dt><dd>{mapping.maturity || 'Unmapped'}</dd><dt>Ownership</dt><dd>{mapping.ownership || 'Unmapped'}</dd></dl>
    <div className="mapping-note"><Info size={21} /><span>Heretto deployment and PDF Gen mappings need validation against the eventual DITA content stock. This view records intent; it does not publish content.</span></div>
  </section></div>;
}

export function App() {
  const [capabilities, setCapabilities] = useState(defaultCapabilities);
  const [selectedId, setSelectedId] = useState('contextual-guidance');
  const [perspective, setPerspective] = useState('consultant');
  const [state, setState] = useState('future');
  const [view, setView] = useState('matrix');
  const [editing, setEditing] = useState(false);
  const [mapping, setMapping] = useState(false);
  const [toast, setToast] = useState('');
  const importRef = useRef(null);
  const selected = capabilities.find((cap) => cap.id === selectedId) || capabilities[0];
  const audience = audiences.find((a) => a.id === perspective);
  const activeView = views.find((item) => item.id === view);
  function notify(message) { setToast(message); window.setTimeout(() => setToast(''), 4400); }
  useEffect(() => {
    loadDesktopYaml().then((text) => {
      if (!text) return;
      const loaded = normalizeCapabilities(YAML.parse(text));
      setCapabilities(loaded); setSelectedId(loaded[0].id);
    }).catch((error) => notify(`Could not load saved YAML: ${error.message}`));
  }, []);
  function exportYaml() {
    const text = YAML.stringify({ version: 1, capabilities });
    const url = URL.createObjectURL(new Blob([text], { type: 'text/yaml' }));
    const link = document.createElement('a'); link.href = url; link.download = 'capability-ownership.yaml'; link.click();
    URL.revokeObjectURL(url); notify('YAML exported.');
  }
  async function importYaml(event) {
    const file = event.target.files?.[0]; if (!file) return;
    try { const next = normalizeCapabilities(YAML.parse(await file.text())); const result = await runSidecar('validate', next); if (!result.ok) throw new Error(result.errors.join(' ')); await saveDesktopYaml(YAML.stringify({ version: 1, capabilities: next })); setCapabilities(next); setSelectedId(next[0].id); notify(`Imported ${next.length} capabilities.`); }
    catch (error) { notify(`Import failed: ${error.message}`); }
    event.target.value = '';
  }
  return <div className="app-shell">
    <nav className="sidebar" aria-label="Primary navigation"><div className="brand"><img className="brand-icon" src="/app-icon.png" alt="" /><span>Capability<br />and Ownership</span></div>
      <div className="sidebar-links">{views.map(({ id, label, icon: Icon }) => <button key={id} className={view === id ? 'active' : ''} onClick={() => setView(id)}><Icon size={22} weight={view === id ? 'duotone' : 'regular'} />{label}</button>)}</div>
      <div className="sidebar-bottom"><div className="sidebar-context"><span>Working context</span><strong>{selected.name}</strong><small>{audience.label} · {state} state</small></div><p>Maturity 0–8+ <br />with room to evolve.</p></div>
    </nav>
    <main className="main"><div className="breadcrumb"><button onClick={() => setView('matrix')}>Matrix</button><ArrowRight size={13} /><span>{selected.name}</span><ArrowRight size={13} /><span>{audience.label} view</span></div>
      <header className="app-header"><div className="header-intro"><div className="eyebrow">Strategic planning workspace</div><h1>Capability &amp; Ownership Matrix</h1><p>See capability maturity, ownership and planned evolution across perspectives.</p></div>
        <div className="header-controls"><label className="control-block capability-control"><span>Selected capability</span><span className="select-wrap"><FolderSimple size={17} /><select value={selected.id} onChange={(e) => setSelectedId(e.target.value)} aria-label="Selected capability">{capabilities.map((cap) => <option key={cap.id} value={cap.id}>{cap.name}</option>)}</select><CaretDown size={14} /></span></label>
          <label className="control-block perspective-control"><span>Perspective</span><span className="select-wrap"><select value={perspective} onChange={(e) => setPerspective(e.target.value)} aria-label="Perspective">{audiences.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}</select><CaretDown size={14} /></span></label>
          <div className="control-block state-control"><span>State</span><div className="segmented" role="group" aria-label="State"><button className={state === 'current' ? 'selected' : ''} onClick={() => setState('current')}>Current</button><button className={state === 'future' ? 'selected' : ''} onClick={() => setState('future')}>Future</button></div></div></div>
      </header><div className="view-label"><span>{activeView.label}</span><div className="header-actions"><button className="text-action" onClick={() => setMapping(true)}><FileText size={17} /> Content mapping</button><button className="text-action" onClick={() => importRef.current?.click()}><UploadSimple size={17} /> Import YAML</button><button className="text-action" onClick={exportYaml}><DownloadSimple size={17} /> Export YAML</button><button className="text-action" onClick={() => window.print()}><Printer size={17} /> Print report</button><button className="edit-action" onClick={() => setEditing(true)}><PencilSimple size={17} /> Edit capability</button></div></div>
      {view === 'matrix' && <MatrixView capabilities={capabilities} selected={selected} perspective={perspective} state={state} onSelect={setSelectedId} onNavigate={setView} />}
      {view === 'journey' && <JourneyView capabilities={capabilities} selected={selected} perspective={perspective} state={state} onNavigate={setView} />}
      {view === 'map' && <MapView capabilities={capabilities} selected={selected} perspective={perspective} state={state} onSelect={setSelectedId} onEdit={() => setEditing(true)} />}
    </main>
    <input ref={importRef} type="file" accept=".yaml,.yml,text/yaml" hidden onChange={importYaml} />
    {editing && <Editor key={selected.id} selected={selected} capabilities={capabilities} onClose={() => setEditing(false)} onSave={async (next) => { const updated = capabilities.map((cap) => cap.id === next.id ? next : cap); try { const result = await runSidecar('validate', updated); if (!result.ok) return notify(result.errors.join(' ')); await saveDesktopYaml(YAML.stringify({ version: 1, capabilities: updated })); setCapabilities(updated); setEditing(false); notify('Capability updated across all views.'); } catch (error) { notify(`Validation failed: ${error.message}`); } }} />}
    {mapping && <DitaPanel selected={selected} onClose={() => setMapping(false)} />}
    {toast && <div className="toast" role="status"><CheckCircle size={19} />{toast}</div>}
  </div>;
}
