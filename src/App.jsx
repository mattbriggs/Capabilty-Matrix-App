import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowArcLeft, ArrowRight, CalendarBlank, CaretDown, CheckCircle, CloudCheck, Database, DownloadSimple, FileText,
  FolderSimple, FolderSimpleUser, GearSix, Graph, GridFour, MapTrifold, PencilSimple, Printer, UploadSimple, WarningCircle,
} from '@phosphor-icons/react';
import { DirtyContext, useConfirm } from './components/Panel';
import { toYaml } from './domain/document';
import { documentToCsv } from './domain/csv';
import { slug } from './domain/ids';
import { issueKey } from './domain/issues';
import { granularities, periodLabel, snapToPeriod, timelinePeriods } from './domain/timeline';
import { projectSchema, validateDocument } from './domain/validate';
import { DataWorkspace } from './features/data/DataWorkspace';
import { SourceEditor } from './features/data/SourceEditor';
import { useDeleteConfirm } from './features/data/trays/common';
import { TrayHost, trayForIssue } from './features/data/trays/TrayHost';
import { MapView } from './features/map/MapView';
import { ImportFlow } from './features/projects/ImportFlow';
import { ProjectsView } from './features/projects/ProjectsView';
import { printPage, runSidecar } from './sidecarBridge';
import { useProjectStore } from './state/useProjectStore';
import { JourneyView } from './views/JourneyView';
import { EmptyProject, MatrixView } from './views/MatrixView';

const exploreViews = [
  { id: 'matrix', label: 'Matrix', icon: GridFour },
  { id: 'journey', label: 'Capability journey', icon: Graph },
  { id: 'map', label: 'Domain map', icon: MapTrifold },
];
const manageViews = [
  { id: 'data', label: 'Data workspace', icon: Database },
  { id: 'projects', label: 'Projects', icon: FolderSimpleUser },
];
const allViews = [...exploreViews, ...manageViews];

function download(text, fileName, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a'); link.href = url; link.download = fileName; link.click();
  URL.revokeObjectURL(url);
}

function SaveStatus({ store }) {
  const { active, desktop } = store;
  if (!active) return null;
  const unexported = store.projects.find((p) => p.id === active.id)?.unexported;
  const states = {
    saving: { icon: CloudCheck, text: desktop ? 'Saving…' : 'Updating session…', tone: '' },
    saved: desktop ? { icon: CheckCircle, text: 'Saved', tone: 'ok' } : { icon: WarningCircle, text: unexported ? 'Session only · not exported' : 'Session only · exported', tone: unexported ? 'warn' : 'ok' },
    error: { icon: WarningCircle, text: 'Save failed', tone: 'error' },
    conflict: { icon: WarningCircle, text: 'Changed on disk', tone: 'error' },
    invalid: { icon: WarningCircle, text: 'Needs repair', tone: 'error' },
  };
  const s = states[active.status] || states.saved;
  const Icon = s.icon;
  return <span className={`save-status ${s.tone}`} role="status" aria-live="polite"><Icon size={15} weight="bold" /> {s.text}
    {active.status === 'error' && <><button type="button" onClick={store.retrySave}>Retry</button><button type="button" onClick={store.saveAsCopy}>Save a copy</button></>}
    {active.status === 'conflict' && <><button type="button" onClick={store.reloadFromDisk}>Reload from disk</button><button type="button" onClick={store.saveAsCopy}>Save mine as a copy</button></>}
  </span>;
}

export function App() {
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const notify = useCallback((message, tone = 'ok') => {
    setToast({ message, tone });
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), tone === 'error' ? 8000 : 4400);
  }, []);
  const store = useProjectStore({ notify });
  const doc = store.active?.doc || null;
  const [view, setView] = useState('matrix');
  const [tray, setTray] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [perspective, setPerspective] = useState('consultant');
  const [time, setTime] = useState({ current: null, focus: null });
  const [confirm, confirmElement] = useConfirm();
  const [confirmDelete, deleteElement] = useDeleteConfirm();
  const importRef = useRef(null);

  // Dirty-work registry (open drafts and unsaved map layouts).
  const registry = useRef(new Map());
  const dirtyContext = useMemo(() => ({ register: (key, get) => { registry.current.set(key, get); return () => { if (registry.current.get(key) === get) registry.current.delete(key); }; } }), []);
  const guard = useCallback(async (action, keys = null) => {
    const dirty = [...registry.current.entries()].filter(([key, get]) => (!keys || keys.includes(key)) && get().dirty).map(([, get]) => get());
    if (!dirty.length) return action();
    const choice = await confirm({ title: 'Save your changes first?', body: <><p>Unsaved work:</p><ul>{dirty.map((d) => <li key={d.label}>{d.label}</li>)}</ul></>, choices: [{ value: 'save', label: 'Save' }, { value: 'discard', label: 'Discard' }, { value: 'cancel', label: 'Cancel' }] });
    if (choice === 'cancel') return undefined;
    if (choice === 'save') { for (const entry of dirty) { if (!(await entry.save())) return undefined; } }
    if (choice === 'discard') dirty.forEach((entry) => entry.discard());
    return action();
  }, [confirm]);

  // Shared exploration context follows the active project; it survives trips to management views.
  const periods = useMemo(() => (doc ? timelinePeriods(doc.settings.timeline, doc.timeSegments) : []), [doc]);
  const projectId = store.active?.id;
  useEffect(() => {
    if (!doc) return;
    setSelectedId((old) => (doc.capabilities.some((c) => c.id === old) ? old : doc.capabilities[0]?.id || null));
    setPerspective((old) => (doc.settings.audiences.some((a) => a.id === old) ? old : doc.settings.audiences[0].id));
  }, [doc]);
  useEffect(() => {
    if (!doc) return;
    setTime({ current: snapToPeriod(periods, doc.settings.timeline.asOf), focus: periods.at(-1).date });
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!periods.length) return;
    setTime((old) => ({ current: snapToPeriod(periods, old.current || doc.settings.timeline.asOf), focus: snapToPeriod(periods, old.focus || periods.at(-1).date) }));
  }, [periods]); // eslint-disable-line react-hooks/exhaustive-deps

  // Warn before unload when work would be lost.
  useEffect(() => {
    const handler = (event) => {
      const dirtyDrafts = [...registry.current.values()].some((get) => get().dirty);
      const unsaved = store.desktop ? store.active && store.active.status !== 'saved' : store.projects.some((p) => p.unexported);
      if (dirtyDrafts || unsaved) { event.preventDefault(); event.returnValue = ''; }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [store.desktop, store.active, store.projects]);

  const selected = doc?.capabilities.find((c) => c.id === selectedId) || doc?.capabilities[0] || null;
  const audience = doc?.settings.audiences.find((a) => a.id === perspective) || doc?.settings.audiences[0];
  const label = (date) => (doc && date ? periodLabel(date, doc.settings.timeline.granularity) : '');
  const issues = useMemo(() => (doc ? validateDocument(doc).issues : []), [doc]);
  const navigate = (next) => guard(() => setView(next));
  const openTray = (next) => {
    if (next.type === 'table') return guard(() => { setTray(null); setView('data'); }, ['tray']);
    if (next.type === 'mapView') return guard(() => { setTray(null); setView('map'); }, ['tray']);
    if (next.type === 'source') return guard(() => { setTray(null); setView('data'); }, ['tray']);
    return guard(() => setTray(next), ['tray']);
  };
  const commit = store.commit;
  const onContextChange = ({ selectedId: sel, perspective: per, current, focus }) => {
    if (sel && doc.capabilities.some((c) => c.id === sel)) setSelectedId(sel);
    if (per && doc.settings.audiences.some((a) => a.id === per)) setPerspective(per);
    if (current || focus) setTime((old) => ({ current: current ? snapToPeriod(periods, current) : old.current, focus: focus ? snapToPeriod(periods, focus) : old.focus }));
  };

  async function changeGranularity(id) {
    const old = granularities.find((g) => g.id === doc.settings.timeline.granularity);
    const next = granularities.find((g) => g.id === id);
    const span = (doc.settings.timeline.periods - 1) * old.months;
    const timeline = { ...doc.settings.timeline, granularity: id, periods: Math.min(60, Math.max(2, Math.round(span / next.months) + 1)) };
    const nextPeriods = timelinePeriods(timeline);
    timeline.asOf = snapToPeriod(nextPeriods, timeline.asOf);
    await commit({ ...doc, settings: { ...doc.settings, timeline } }, `Timeline shown ${next.label.toLowerCase()}.`);
  }
  async function exportYaml(id = store.active?.id) {
    const { text, doc: d } = await store.projectText(id);
    download(d ? toYaml(d) : text, `${slug(d?.project.name || id) || 'project'}.yaml`, 'text/yaml');
    store.markExported(id); notify('YAML exported.');
  }
  async function exportCsv(id = store.active?.id) {
    const { doc: d } = await store.projectText(id);
    if (!d) { notify('This project has validation errors; repair it before exporting CSV.', 'error'); return; }
    download(documentToCsv(d), `${slug(d.project.name) || 'project'}.csv`, 'text/csv');
    store.markExported(id); notify('CSV exported. It round-trips through Import.');
  }
  const exportSchema = () => { download(`${JSON.stringify(projectSchema, null, 2)}\n`, 'capability-project.schema.json', 'application/schema+json'); notify('JSON Schema exported. Cross-record rules need the application validator.'); };
  async function printReport() { try { await printPage(); } catch (error) { notify(`Print failed: ${error}`, 'error'); } }
  async function sidecarCheck() {
    try {
      const result = await runSidecar('validate', { document: doc });
      if (!result?.issues) return `The Python validator returned an unexpected response${result?.error ? `: ${result.error}` : ''}.`;
      const same = JSON.stringify(result.issues.map(issueKey)) === JSON.stringify(issues.map(issueKey));
      return `Python validator: ${result.issues.filter((i) => i.severity === 'error').length} errors, ${result.issues.filter((i) => i.severity === 'warning').length} warnings — ${same ? 'identical to the browser result' : 'differs from the browser result'}.`;
    } catch (error) { return `Python validator failed: ${error.message || error}`; }
  }
  async function deleteProject(project) {
    const choice = await confirm({ title: `Delete “${project.name || project.id}”?`, body: <p>{store.desktop ? 'The project moves to the trash; you can restore it from Projects.' : 'The project moves to the session trash; you can restore it until you close the tab.'} Other projects are unchanged, and no imported original file is touched.</p>, choices: [{ value: 'delete', label: 'Move to trash' }, { value: 'cancel', label: 'Cancel' }] });
    if (choice !== 'delete') return;
    const go = async () => { try { await store.deleteProject(project.id); notify('Project moved to the trash.'); } catch (error) { notify(`Delete failed: ${error.message}`, 'error'); } };
    if (project.id === store.active?.id) guard(go); else go();
  }
  async function restoreProject(entry) {
    try { const id = await store.restoreProject(entry.trashId); notify(`Restored “${entry.name}”.`); return id; } catch (error) { notify(error.message, 'error'); return null; }
  }
  const openProject = (id) => guard(async () => { setTray(null); await store.openProject(id); });
  const editProject = (id) => guard(async () => { if (id !== store.active?.id) await store.openProject(id); setTray({ type: 'project' }); });

  const trayProps = { doc, onCommit: commit, onClose: () => setTray(null), confirm, confirmDelete, openTray: (next) => { setTray(null); setTimeout(() => setTray(next), 0); } };
  const activeView = allViews.find((item) => item.id === view);
  const exploring = exploreViews.some((v) => v.id === view);

  if (!store.ready && !store.active) return <div className="app-loading" role="status">Loading projects…</div>;

  return <DirtyContext.Provider value={dirtyContext}><div className="app-shell">
    <nav className="sidebar" aria-label="Primary navigation"><div className="brand"><img className="brand-icon" src="/app-icon.png" alt="" /><span>Capability<br />and Ownership</span></div>
      <div className="sidebar-links">{exploreViews.map(({ id, label: text, icon: Icon }) => <button key={id} className={view === id ? 'active' : ''} aria-current={view === id ? 'page' : undefined} onClick={() => navigate(id)}><Icon size={22} weight={view === id ? 'duotone' : 'regular'} />{text}</button>)}</div>
      <div className="sidebar-group-label">Manage</div>
      <div className="sidebar-links">{manageViews.map(({ id, label: text, icon: Icon }) => <button key={id} className={view === id ? 'active' : ''} aria-current={view === id ? 'page' : undefined} onClick={() => navigate(id)}><Icon size={22} weight={view === id ? 'duotone' : 'regular'} />{text}</button>)}</div>
      <div className="sidebar-bottom"><div className="sidebar-context"><span>Working context</span><strong>{doc?.project.name || 'No project'}</strong>{selected && <small>{selected.name}</small>}{audience && <small>{audience.label} · {label(time.current)} → {label(time.focus)}</small>}</div><p>Maturity 0–8+ <br />with room to evolve.</p></div>
    </nav>
    <main className="main"><div className="breadcrumb"><button onClick={() => navigate('projects')}>{doc?.project.name || 'Projects'}</button><ArrowRight size={13} /><span>{activeView.label}</span>{selected && exploring && <><ArrowRight size={13} /><span>{selected.name}</span><ArrowRight size={13} /><span>{audience?.label} view</span></>}</div>
      <header className="app-header"><div className="header-intro"><div className="eyebrow">Strategic planning workspace</div><h1>Capability &amp; Ownership Matrix</h1><p>See capability maturity, ownership and planned evolution across perspectives.</p></div>
        {doc && <div className="header-controls"><label className="control-block capability-control"><span>Selected capability</span><span className="select-wrap"><FolderSimple size={17} /><select value={selected?.id || ''} disabled={!selected} onChange={(e) => setSelectedId(e.target.value)} aria-label="Selected capability">{doc.capabilities.length ? doc.capabilities.map((cap) => <option key={cap.id} value={cap.id}>{cap.name}</option>) : <option value="">No capabilities</option>}</select><CaretDown size={14} /></span></label>
          <label className="control-block perspective-control"><span>Perspective</span><span className="select-wrap"><select value={audience.id} onChange={(e) => setPerspective(e.target.value)} aria-label="Perspective">{doc.settings.audiences.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}</select><CaretDown size={14} /></span></label>
          <label className="control-block"><span>Timeline</span><span className="select-wrap"><CalendarBlank size={17} /><select value={doc.settings.timeline.granularity} onChange={(e) => changeGranularity(e.target.value)} aria-label="Timeline granularity">{granularities.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}</select><CaretDown size={14} /></span></label>
          <label className="control-block"><span>Current</span><span className="select-wrap"><select value={time.current || ''} onChange={(e) => setTime({ ...time, current: e.target.value })} aria-label="Current period">{periods.map((p) => <option key={p.date} value={p.date}>{p.label}</option>)}</select><CaretDown size={14} /></span></label>
          <label className="control-block"><span>Focus</span><span className="select-wrap"><select value={time.focus || ''} onChange={(e) => setTime({ ...time, focus: e.target.value })} aria-label="Focus period">{periods.map((p) => <option key={p.date} value={p.date}>{p.label}</option>)}</select><CaretDown size={14} /></span></label></div>}
      </header>
      <div className="view-label"><span className="view-label-left"><span>{activeView.label}</span><SaveStatus store={store} /></span><div className="header-actions">
        {store.history.length > 0 && <button className="text-action" onClick={store.undo} title={`Undo: ${store.history.at(-1).message}`}><ArrowArcLeft size={17} /> Undo</button>}
        {selected && <button className="text-action" onClick={() => openTray({ type: 'mapping', id: selected.id })}><FileText size={17} /> Content mapping</button>}
        {doc && <button className="text-action" onClick={() => openTray({ type: 'settings' })}><GearSix size={17} /> Settings</button>}
        <button className="text-action" onClick={() => importRef.current?.start()}><UploadSimple size={17} /> Import</button>
        {doc && <button className="text-action" onClick={() => exportYaml()}><DownloadSimple size={17} /> Export YAML</button>}
        <button className="text-action" onClick={printReport}><Printer size={17} /> Print report</button>
        {selected && <button className="edit-action" onClick={() => openTray({ type: 'capability', id: selected.id })}><PencilSimple size={17} /> Edit capability</button>}</div></div>

      {store.active?.repair && view !== 'projects' && <section className="repair-view" aria-label="Repair project">
        <div className="data-intro"><div><div className="eyebrow">Needs repair</div><h2>This project file does not pass validation</h2><p>It was changed outside the app or written by another version. Nothing has been changed. Fix the YAML below, or open another project.</p></div></div>
        <SourceEditor doc={null} text={store.active.repair.text} applyLabel="Apply repaired YAML" onApply={async (repaired) => { if (!repaired) return; await commit({ ...repaired, project: { ...repaired.project, id: store.active.id } }, 'Project repaired.', { undoable: false }); }} />
      </section>}
      {doc && !store.active.repair && <>
        {exploring && !selected && <EmptyProject doc={doc} onCreate={() => openTray({ type: 'capability' })} onNavigate={navigate} />}
        {view === 'matrix' && selected && <MatrixView doc={doc} selected={selected} perspective={audience.id} time={time} onSelect={setSelectedId} onNavigate={navigate} />}
        {view === 'journey' && selected && <JourneyView doc={doc} selected={selected} perspective={audience.id} time={time} onNavigate={navigate} openTray={openTray} onUpdate={(next) => commit({ ...doc, capabilities: doc.capabilities.map((c) => (c.id === next.id ? next : c)) }, 'Maturity updated.')} />}
        {view === 'map' && selected && <MapView key={doc.project.id} doc={doc} selected={selected} perspective={audience.id} time={time} onSelect={setSelectedId} openTray={openTray} onCommit={commit} onContextChange={onContextChange} confirm={confirm} notify={notify} />}
        {view === 'data' && <DataWorkspace key={doc.project.id} doc={doc} issues={issues} focusDate={time.focus} focusLabel={label(time.focus)} selectedId={selected?.id} openTray={openTray} onCommit={commit} desktop={store.desktop} sidecarCheck={sidecarCheck} download={download}
          onConfig={(dataTable) => commit({ ...doc, presentation: { ...doc.presentation, dataTable } }, null, { undoable: false, quiet: true })}
          openIssue={(issue) => openTray(trayForIssue(doc, issue))}
          onApplySource={(next) => next && commit({ ...next, project: { ...next.project, id: doc.project.id } }, 'YAML applied.')} />}
      </>}
      {view === 'projects' && <ProjectsView store={store} onOpen={openProject} onCreate={(options) => guard(() => store.createProject(options))} onDelete={deleteProject} onRestore={restoreProject} onEdit={editProject} onImport={() => importRef.current?.start()} exportYaml={exportYaml} exportCsv={exportCsv} exportSchema={exportSchema} />}
      {!doc && !store.active?.repair && view !== 'projects' && <div className="empty-state large"><h2>No project is open</h2><p>Create or import a project to begin.</p><button type="button" className="primary-action compact" onClick={() => navigate('projects')}>Go to Projects</button></div>}
    </main>
    <ImportFlow ref={importRef} previewImport={store.previewImport} applyImport={store.applyImport} openProject={store.openProject} guard={guard} notify={notify} />
    {doc && <TrayHost tray={tray} {...trayProps} />}
    {confirmElement}{deleteElement}
    {toast && <div className={`toast ${toast.tone}`} role={toast.tone === 'error' ? 'alert' : 'status'}>{toast.tone === 'error' ? <WarningCircle size={19} /> : <CheckCircle size={19} />}{toast.message}</div>}
  </div></DirtyContext.Provider>;
}
