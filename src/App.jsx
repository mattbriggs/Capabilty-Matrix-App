import { useEffect, useRef, useState } from 'react';
import YAML from 'yaml';
import {
  ArrowDown, ArrowRight, ArrowUp, CalendarBlank, CaretDown, CheckCircle, DownloadSimple, FileText, FloppyDisk,
  FolderSimple, GearSix, Graph, GridFour, Info, MapTrifold, PencilSimple, Plus, Printer,
  Trash, UploadSimple, X,
} from '@phosphor-icons/react';
import {
  granularities, levelLabels, normalizeDocument, periodLabel, snapToPeriod, timelinePeriods,
} from './model';
import { loadDesktopYaml, printPage, runSidecar, saveDesktopYaml } from './sidecarBridge';
import { MatrixView, JourneyView, MapView } from './Views';
import sampleYaml from './data/capabilities.yaml?raw';

const defaultDocument = normalizeDocument(YAML.parse(sampleYaml));

const views = [
  { id: 'matrix', label: 'Matrix', icon: GridFour },
  { id: 'journey', label: 'Capability journey', icon: Graph },
  { id: 'map', label: 'Domain map', icon: MapTrifold },
];

const toYaml = (settings, capabilities) => YAML.stringify({ version: 1, settings, capabilities });

function Panel({ title, eyebrow, onClose, wide, children, onSubmit }) {
  const Tag = onSubmit ? 'form' : 'section';
  return <div className="modal-backdrop" onMouseDown={onClose}><Tag className={`editor-panel ${wide ? 'wide-panel' : ''}`} aria-label={title} onMouseDown={(e) => e.stopPropagation()} onSubmit={onSubmit}>
    <div className="modal-heading"><div><div className="eyebrow">{eyebrow}</div><h2>{title}</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label={`Close ${title.toLowerCase()}`}><X size={22} /></button></div>
    {children}
  </Tag></div>;
}

function Editor({ selected, capabilities, settings, onClose, onSave }) {
  const [form, setForm] = useState({ ...selected, dependencies: [...selected.dependencies], milestones: selected.milestones.map((m) => ({ ...m })) });
  const [error, setError] = useState('');
  const periods = timelinePeriods(settings.timeline);
  const { ownerLabels } = settings;
  const top = form.levels.length - 1;
  const update = (key, value) => setForm((old) => ({ ...old, [key]: value }));
  const setMilestone = (index, patch) => update('milestones', form.milestones.map((m, i) => (i === index ? { ...m, ...patch } : m)));
  const dateOptions = (value) => (periods.some((p) => p.date === value) ? periods : [...periods, { date: value, label: periodLabel(value, settings.timeline.granularity) }]);
  function save(event) {
    event.preventDefault();
    if (!form.name.trim()) return setError('Enter a capability name.');
    if (Number(form.target) < Number(form.current)) return setError('Target maturity should be at least current maturity.');
    onSave({ ...form, name: form.name.trim(), current: Number(form.current), target: Number(form.target), milestones: form.milestones.map((m) => ({ date: m.date, maturity: Number(m.maturity) })), handoffDate: form.handoffDate || undefined });
  }
  const ownerOptions = <><option value="appliance">{ownerLabels.appliance}</option><option value="federated">{ownerLabels.federated}</option></>;
  return <Panel title="Edit capability" eyebrow="Capability record" onClose={onClose} onSubmit={save}>
    <p>Changes update all three views. Export YAML to save the record.</p>
    <label>Name<input value={form.name} onChange={(e) => update('name', e.target.value)} /></label>
    <label>Summary<textarea rows="2" value={form.summary} onChange={(e) => update('summary', e.target.value)} /></label>
    <div className="form-pair"><label>Current maturity<input type="number" min="0" max={top} value={form.current} onChange={(e) => update('current', e.target.value)} /></label><label>Target maturity<input type="number" min="0" max={top} value={form.target} onChange={(e) => update('target', e.target.value)} /></label></div>
    <div className="form-pair"><label>Current owner<select value={form.owner} onChange={(e) => update('owner', e.target.value)}>{ownerOptions}</select></label><label>Future owner<select value={form.futureOwner} onChange={(e) => update('futureOwner', e.target.value)}>{ownerOptions}</select></label></div>
    <label>Handoff period<select value={form.handoffDate || ''} onChange={(e) => update('handoffDate', e.target.value)}><option value="">End of timeline</option>{dateOptions(form.handoffDate || periods[0].date).map((p) => <option key={p.date} value={p.date}>{p.label}</option>)}</select></label>
    <label>Scope decision<textarea rows="3" value={form.decision} onChange={(e) => update('decision', e.target.value)} /></label>
    <fieldset><legend>Timeline milestones</legend><p>Current maturity applies at {periodLabel(settings.timeline.asOf, settings.timeline.granularity)} and target maturity at the end of the timeline. Add milestones to shape the path between them or record the past.</p>
      {form.milestones.map((m, index) => <div className="milestone-row" key={index}><select aria-label="Milestone period" value={m.date} onChange={(e) => setMilestone(index, { date: e.target.value })}>{dateOptions(m.date).map((p) => <option key={p.date} value={p.date}>{p.label}</option>)}</select><input aria-label="Milestone maturity" type="number" min="0" max={top} value={m.maturity} onChange={(e) => setMilestone(index, { maturity: e.target.value })} /><button type="button" className="icon-button" aria-label="Remove milestone" onClick={() => update('milestones', form.milestones.filter((_, i) => i !== index))}><Trash size={18} /></button></div>)}
      <button type="button" className="text-action" onClick={() => update('milestones', [...form.milestones, { date: periods[0].date, maturity: form.current }])}><Plus size={16} /> Add milestone</button></fieldset>
    <fieldset><legend>Dependencies</legend>{capabilities.filter((cap) => cap.id !== selected.id).map((cap) => <label className="checkbox-row" key={cap.id}><input type="checkbox" checked={form.dependencies.includes(cap.id)} onChange={(e) => update('dependencies', e.target.checked ? [...form.dependencies, cap.id] : form.dependencies.filter((id) => id !== cap.id))} />{cap.name}</label>)}</fieldset>
    {error && <div className="form-error" role="alert">{error}</div>}<button type="submit" className="primary-action"><FloppyDisk size={18} /> Save changes</button>
  </Panel>;
}

function LevelsPanel({ selected, onClose, onSave }) {
  const [rows, setRows] = useState(selected.levels.map((level, index) => ({ ...level, from: index })));
  const [error, setError] = useState('');
  const setRow = (index, patch) => setRows((old) => old.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  const move = (index, by) => setRows((old) => { const next = [...old]; const [row] = next.splice(index, 1); next.splice(index + by, 0, row); return next; });
  function save(event) {
    event.preventDefault();
    if (rows.length < 2) return setError('Keep at least two maturity levels.');
    if (rows.some((row) => !row.name.trim())) return setError('Every level needs a name.');
    const last = rows.length - 1;
    const remap = (old) => {
      const position = rows.findIndex((row) => row.from === old);
      return position >= 0 ? position : Math.min(rows.filter((row) => row.from !== null && row.from < old).length, last);
    };
    const current = remap(selected.current);
    onSave({
      ...selected, current, target: Math.max(current, remap(selected.target)),
      milestones: selected.milestones.map((m) => ({ ...m, maturity: remap(m.maturity) })),
      levels: rows.map(({ name, description }) => ({ name: name.trim(), description })),
    });
  }
  return <Panel title="Maturity levels" eyebrow={selected.name} onClose={onClose} onSubmit={save}>
    <p>Add, rename, reorder or remove levels. The last level is the open-ended wider-domain horizon. Current and target maturity move with their levels.</p>
    {rows.map((row, index) => <fieldset className="level-row" key={row.from ?? `new-${index}`}><legend>M{levelLabels(rows.length)[index]}</legend>
      <label>Name<input value={row.name} onChange={(e) => setRow(index, { name: e.target.value })} /></label>
      <label>Description<textarea rows="2" value={row.description} onChange={(e) => setRow(index, { description: e.target.value })} /></label>
      <div className="row-actions"><button type="button" className="icon-button" aria-label="Move level up" disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp size={18} /></button><button type="button" className="icon-button" aria-label="Move level down" disabled={index === rows.length - 1} onClick={() => move(index, 1)}><ArrowDown size={18} /></button><button type="button" className="icon-button" aria-label="Delete level" onClick={() => setRows((old) => old.filter((_, i) => i !== index))}><Trash size={18} /></button></div>
    </fieldset>)}
    <button type="button" className="text-action" disabled={rows.length >= 20} onClick={() => setRows((old) => [...old, { name: `Level ${old.length}`, description: '', from: null }])}><Plus size={16} /> Add level</button>
    {error && <div className="form-error" role="alert">{error}</div>}<button type="submit" className="primary-action"><FloppyDisk size={18} /> Save levels</button>
  </Panel>;
}

function DependenciesPanel({ selected, capabilities, onClose, onSave }) {
  const [deps, setDeps] = useState(selected.dependencies);
  const byId = Object.fromEntries(capabilities.map((cap) => [cap.id, cap]));
  const available = capabilities.filter((cap) => cap.id !== selected.id && !deps.includes(cap.id));
  const [pick, setPick] = useState('');
  const choice = available.some((cap) => cap.id === pick) ? pick : available[0]?.id || '';
  return <Panel title="Dependencies" eyebrow={selected.name} onClose={onClose} onSubmit={(e) => { e.preventDefault(); onSave({ ...selected, dependencies: deps }); }}>
    <p>Capabilities that {selected.name} relies on. They appear in the journey and as links on the domain map.</p>
    {deps.length ? deps.map((id) => <div className="dependency-edit" key={id}><FolderSimple size={20} /><span><strong>{byId[id]?.name || id}</strong><small>{byId[id]?.summary || 'Capability not found.'}</small></span><button type="button" className="icon-button" aria-label={`Remove ${byId[id]?.name || id}`} onClick={() => setDeps(deps.filter((dep) => dep !== id))}><Trash size={18} /></button></div>) : <p>No dependencies recorded.</p>}
    <div className="add-row"><select aria-label="Dependency to add" value={choice} onChange={(e) => setPick(e.target.value)} disabled={!available.length}>{available.map((cap) => <option key={cap.id} value={cap.id}>{cap.name}</option>)}</select><button type="button" className="text-action" disabled={!choice} onClick={() => setDeps([...deps, choice])}><Plus size={16} /> Add</button></div>
    <button type="submit" className="primary-action"><FloppyDisk size={18} /> Save dependencies</button>
  </Panel>;
}

function SettingsPanel({ settings, onClose, onSave }) {
  const [labels, setLabels] = useState(settings.ownerLabels);
  const [audiences, setAudiences] = useState(settings.audiences);
  const [timeline, setTimeline] = useState(settings.timeline);
  const [error, setError] = useState('');
  const setAudience = (index, patch) => setAudiences((old) => old.map((a, i) => (i === index ? { ...a, ...patch } : a)));
  const periods = timelinePeriods(timeline);
  function save(event) {
    event.preventDefault();
    if (!labels.appliance.trim() || !labels.federated.trim()) return setError('Both owners need a name.');
    if (!audiences.length || audiences.some((a) => !a.label.trim())) return setError('Every perspective needs a name.');
    onSave({ ownerLabels: labels, audiences, timeline });
  }
  return <Panel title="Settings" eyebrow="Names, perspectives and timeline" onClose={onClose} onSubmit={save} wide>
    <fieldset><legend>Owner names</legend><p>These names replace "Appliance" and "Federated" in every view.</p>
      <div className="form-pair"><label>Product-side owner<input value={labels.appliance} onChange={(e) => setLabels({ ...labels, appliance: e.target.value })} /></label><label>Wider-environment owner<input value={labels.federated} onChange={(e) => setLabels({ ...labels, federated: e.target.value })} /></label></div></fieldset>
    <fieldset><legend>Perspectives</legend>
      {audiences.map((a, index) => <div className="perspective-row" key={a.id || `new-${index}`}>
        <label>Name<input value={a.label} onChange={(e) => setAudience(index, { label: e.target.value })} /></label>
        <label>Role<input value={a.description} onChange={(e) => setAudience(index, { description: e.target.value })} /></label>
        <label>What this perspective needs<textarea rows="2" value={a.need} onChange={(e) => setAudience(index, { need: e.target.value })} /></label>
        <button type="button" className="icon-button" aria-label={`Delete ${a.label || 'perspective'}`} disabled={audiences.length === 1} onClick={() => setAudiences(audiences.filter((_, i) => i !== index))}><Trash size={18} /></button>
      </div>)}
      <button type="button" className="text-action" onClick={() => setAudiences([...audiences, { id: '', label: '', description: '', need: '' }])}><Plus size={16} /> Add perspective</button></fieldset>
    <fieldset><legend>Timeline</legend><p>Maturity is anchored at the "as of" period and the end of the timeline, and can be shaped with milestones.</p>
      <div className="form-pair"><label>Granularity<select value={timeline.granularity} onChange={(e) => setTimeline({ ...timeline, granularity: e.target.value })}>{granularities.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}</select></label><label>Number of periods<input type="number" min="2" max="60" value={timeline.periods} onChange={(e) => setTimeline({ ...timeline, periods: Number(e.target.value) })} /></label></div>
      <div className="form-pair"><label>Start date<input type="date" value={timeline.start} onChange={(e) => e.target.value && setTimeline({ ...timeline, start: e.target.value })} /></label><label>Current maturity applies at<select value={snapToPeriod(periods, timeline.asOf)} onChange={(e) => setTimeline({ ...timeline, asOf: e.target.value })}>{periods.map((p) => <option key={p.date} value={p.date}>{p.label}</option>)}</select></label></div></fieldset>
    {error && <div className="form-error" role="alert">{error}</div>}<button type="submit" className="primary-action"><FloppyDisk size={18} /> Save settings</button>
  </Panel>;
}

function DitaPanel({ selected, onClose }) {
  const mapping = selected.dita || {};
  return <div className="modal-backdrop" onMouseDown={onClose}><section className="editor-panel mapping-panel" onMouseDown={(e) => e.stopPropagation()} aria-label="Content mapping">
    <div className="modal-heading"><div><div className="eyebrow">Content trace</div><h2>DITA mapping</h2></div><button className="icon-button" onClick={onClose} aria-label="Close content mapping"><X size={22} /></button></div>
    <p>Planning metadata for <strong>{selected.name}</strong>. Attribute names remain hypotheses until the content model is defined.</p>
    <div className="mapping-steps"><span>YAML capability</span><ArrowRight size={16} /><span>DITA tags and DITAVals</span><ArrowRight size={16} /><span>Embedded help + PDF</span></div>
    <dl><dt>Audience</dt><dd>{Array.isArray(mapping.audience) ? mapping.audience.join(', ') : 'Unmapped'}</dd><dt>Maturity</dt><dd>{mapping.maturity || 'Unmapped'}</dd><dt>Ownership</dt><dd>{mapping.ownership || 'Unmapped'}</dd></dl>
    <div className="mapping-note"><Info size={21} /><span>CCMS deployment and PDF Gen mappings need validation against the eventual DITA content stock. This view records intent; it does not publish content.</span></div>
  </section></div>;
}

export function App() {
  const [capabilities, setCapabilities] = useState(defaultDocument.capabilities);
  const [settings, setSettings] = useState(defaultDocument.settings);
  const [selectedId, setSelectedId] = useState('contextual-guidance');
  const [perspective, setPerspective] = useState('consultant');
  const [time, setTime] = useState(() => {
    const periods = timelinePeriods(defaultDocument.settings.timeline);
    return { current: defaultDocument.settings.timeline.asOf, focus: periods[periods.length - 1].date };
  });
  const [view, setView] = useState('matrix');
  const [panel, setPanel] = useState(null);
  const [toast, setToast] = useState('');
  const importRef = useRef(null);
  const selected = capabilities.find((cap) => cap.id === selectedId) || capabilities[0];
  const audience = settings.audiences.find((a) => a.id === perspective) || settings.audiences[0];
  const activeView = views.find((item) => item.id === view);
  const periods = timelinePeriods(settings.timeline);
  const label = (date) => periodLabel(date, settings.timeline.granularity);
  function notify(message) { setToast(message); window.setTimeout(() => setToast(''), 4400); }
  function applyDocument(next, keepTime) {
    const nextPeriods = timelinePeriods(next.settings.timeline);
    setCapabilities(next.capabilities); setSettings(next.settings);
    setTime((old) => (keepTime
      ? { current: snapToPeriod(nextPeriods, old.current), focus: snapToPeriod(nextPeriods, old.focus) }
      : { current: snapToPeriod(nextPeriods, next.settings.timeline.asOf), focus: nextPeriods[nextPeriods.length - 1].date }));
  }
  useEffect(() => {
    loadDesktopYaml().then((text) => {
      if (!text) return;
      const loaded = normalizeDocument(YAML.parse(text));
      applyDocument(loaded, false); setSelectedId(loaded.capabilities[0].id);
    }).catch((error) => notify(`Could not load saved YAML: ${error.message}`));
  }, []);
  // Validate with the sidecar, persist, then update state. Returns true on success.
  async function persist(nextCapabilities, nextSettings, message) {
    try {
      const result = await runSidecar('validate', nextCapabilities, nextSettings);
      if (!result.ok) { notify(result.errors.join(' ')); return false; }
      await saveDesktopYaml(toYaml(nextSettings, nextCapabilities));
      applyDocument({ capabilities: nextCapabilities, settings: nextSettings }, true);
      if (message) notify(message);
      return true;
    } catch (error) { notify(`Validation failed: ${error.message}`); return false; }
  }
  async function saveCapability(next, message = 'Capability updated across all views.') {
    if (await persist(capabilities.map((cap) => (cap.id === next.id ? next : cap)), settings, message)) setPanel(null);
  }
  async function saveSettings(next) {
    const normalized = normalizeDocument({ settings: next, capabilities }).settings;
    if (await persist(capabilities, normalized, 'Settings updated.')) setPanel(null);
  }
  function changeGranularity(id) {
    const old = granularities.find((g) => g.id === settings.timeline.granularity);
    const next = granularities.find((g) => g.id === id);
    const span = (settings.timeline.periods - 1) * old.months;
    const timeline = { ...settings.timeline, granularity: id, periods: Math.min(60, Math.max(2, Math.round(span / next.months) + 1)) };
    persist(capabilities, normalizeDocument({ settings: { ...settings, timeline }, capabilities }).settings);
  }
  function exportYaml() {
    const url = URL.createObjectURL(new Blob([toYaml(settings, capabilities)], { type: 'text/yaml' }));
    const link = document.createElement('a'); link.href = url; link.download = 'capability-ownership.yaml'; link.click();
    URL.revokeObjectURL(url); notify('YAML exported.');
  }
  async function importYaml(event) {
    const file = event.target.files?.[0]; if (!file) return;
    try {
      const next = normalizeDocument(YAML.parse(await file.text()));
      if (await persist(next.capabilities, next.settings)) { applyDocument(next, false); setSelectedId(next.capabilities[0].id); notify(`Imported ${next.capabilities.length} capabilities.`); }
    } catch (error) { notify(`Import failed: ${error.message}`); }
    event.target.value = '';
  }
  async function printReport() {
    try { await printPage(); } catch (error) { notify(`Print failed: ${error}`); }
  }
  const shared = { capabilities, selected, settings, perspective: audience.id, time };
  return <div className="app-shell">
    <nav className="sidebar" aria-label="Primary navigation"><div className="brand"><img className="brand-icon" src="/app-icon.png" alt="" /><span>Capability<br />and Ownership</span></div>
      <div className="sidebar-links">{views.map(({ id, label: text, icon: Icon }) => <button key={id} className={view === id ? 'active' : ''} onClick={() => setView(id)}><Icon size={22} weight={view === id ? 'duotone' : 'regular'} />{text}</button>)}</div>
      <div className="sidebar-bottom"><div className="sidebar-context"><span>Working context</span><strong>{selected.name}</strong><small>{audience.label} · {label(time.current)} → {label(time.focus)}</small></div><p>Maturity 0–8+ <br />with room to evolve.</p></div>
    </nav>
    <main className="main"><div className="breadcrumb"><button onClick={() => setView('matrix')}>Matrix</button><ArrowRight size={13} /><span>{selected.name}</span><ArrowRight size={13} /><span>{audience.label} view</span></div>
      <header className="app-header"><div className="header-intro"><div className="eyebrow">Strategic planning workspace</div><h1>Capability &amp; Ownership Matrix</h1><p>See capability maturity, ownership and planned evolution across perspectives.</p></div>
        <div className="header-controls"><label className="control-block capability-control"><span>Selected capability</span><span className="select-wrap"><FolderSimple size={17} /><select value={selected.id} onChange={(e) => setSelectedId(e.target.value)} aria-label="Selected capability">{capabilities.map((cap) => <option key={cap.id} value={cap.id}>{cap.name}</option>)}</select><CaretDown size={14} /></span></label>
          <label className="control-block perspective-control"><span>Perspective</span><span className="select-wrap"><select value={audience.id} onChange={(e) => setPerspective(e.target.value)} aria-label="Perspective">{settings.audiences.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}</select><CaretDown size={14} /></span></label>
          <label className="control-block"><span>Timeline</span><span className="select-wrap"><CalendarBlank size={17} /><select value={settings.timeline.granularity} onChange={(e) => changeGranularity(e.target.value)} aria-label="Timeline granularity">{granularities.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}</select><CaretDown size={14} /></span></label>
          <label className="control-block"><span>Current</span><span className="select-wrap"><select value={time.current} onChange={(e) => setTime({ ...time, current: e.target.value })} aria-label="Current period">{periods.map((p) => <option key={p.date} value={p.date}>{p.label}</option>)}</select><CaretDown size={14} /></span></label>
          <label className="control-block"><span>Focus</span><span className="select-wrap"><select value={time.focus} onChange={(e) => setTime({ ...time, focus: e.target.value })} aria-label="Focus period">{periods.map((p) => <option key={p.date} value={p.date}>{p.label}</option>)}</select><CaretDown size={14} /></span></label></div>
      </header><div className="view-label"><span>{activeView.label}</span><div className="header-actions"><button className="text-action" onClick={() => setPanel('mapping')}><FileText size={17} /> Content mapping</button><button className="text-action" onClick={() => setPanel('settings')}><GearSix size={17} /> Settings</button><button className="text-action" onClick={() => importRef.current?.click()}><UploadSimple size={17} /> Import YAML</button><button className="text-action" onClick={exportYaml}><DownloadSimple size={17} /> Export YAML</button><button className="text-action" onClick={printReport}><Printer size={17} /> Print report</button><button className="edit-action" onClick={() => setPanel('edit')}><PencilSimple size={17} /> Edit capability</button></div></div>
      {view === 'matrix' && <MatrixView {...shared} onSelect={setSelectedId} onNavigate={setView} />}
      {view === 'journey' && <JourneyView {...shared} onNavigate={setView} onUpdate={(next) => saveCapability(next, 'Maturity updated.')} onDefineLevels={() => setPanel('levels')} onManageDependencies={() => setPanel('dependencies')} />}
      {view === 'map' && <MapView {...shared} onSelect={setSelectedId} onEdit={() => setPanel('edit')} />}
    </main>
    <input ref={importRef} type="file" accept=".yaml,.yml,text/yaml" hidden onChange={importYaml} />
    {panel === 'edit' && <Editor key={selected.id} selected={selected} capabilities={capabilities} settings={settings} onClose={() => setPanel(null)} onSave={saveCapability} />}
    {panel === 'levels' && <LevelsPanel key={selected.id} selected={selected} onClose={() => setPanel(null)} onSave={(next) => saveCapability(next, 'Maturity levels updated.')} />}
    {panel === 'dependencies' && <DependenciesPanel key={selected.id} selected={selected} capabilities={capabilities} onClose={() => setPanel(null)} onSave={(next) => saveCapability(next, 'Dependencies updated.')} />}
    {panel === 'settings' && <SettingsPanel settings={settings} onClose={() => setPanel(null)} onSave={saveSettings} />}
    {panel === 'mapping' && <DitaPanel selected={selected} onClose={() => setPanel(null)} />}
    {toast && <div className="toast" role="status"><CheckCircle size={19} />{toast}</div>}
  </div>;
}
