import { useEffect, useMemo, useRef, useState } from 'react';
import { applyNodeChanges, Handle, MarkerType, Position, ReactFlow, ReactFlowProvider, useNodesInitialized, useReactFlow, useViewport, ViewportPortal } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ArrowCounterClockwise, ArrowRight, ArrowsClockwise, ArrowsOut, Copy, Crosshair, FloppyDisk, FolderSimple, MagnifyingGlassMinus, MagnifyingGlassPlus, PencilSimple, PushPin, Trash, WarningCircle } from '@phosphor-icons/react';
import { Dialog, useDirtyGuard } from '../../components/Panel';
import { uniqueId } from '../../domain/ids';
import { maturityAt, ownerAt, periodLabel } from '../../domain/timeline';
import { blobOutline, blobPath } from './blob';
import { buildGraph, capNodeId, owners } from './graph';
import { LAYOUT_VERSION } from './layout';
import { useLayoutRunner } from './useLayoutRunner';
import { blankView, fixedPositions, mergePositions, pinPlacement, placementKey, pruneView, removeMapView, toPlacementList, toPlacementMap, unplacedNodes, upsertMapView } from './views';

const ownerZone = { appliance: '#f2f0f9', federated: '#f8f2e8' };
const hidden = { opacity: 0 };

function CapabilityNode({ data }) {
  return <div className={`map-node ${data.owner} ${data.active ? 'active' : ''} ${data.planned ? 'planned' : ''}`}><Handle type="target" position={Position.Left} className="map-handle" /><div className="map-node-icon"><FolderSimple size={24} /></div><div><div className="map-node-phase">{data.phase}{data.pinned && <PushPin size={11} weight="fill" className="pin-mark" aria-label="Pinned position" />}</div><div className="map-node-name">{data.name}</div><div className="map-node-summary">{data.summary}</div></div><Handle type="source" position={Position.Right} className="map-handle" /></div>;
}
function AnchorNode({ data }) {
  return <div className={`map-anchor ${data.owner}`}><Handle type="source" position={Position.Bottom} style={hidden} /><Handle type="target" position={Position.Top} style={hidden} /><span>{data.label}</span><small>{data.count} capabilit{data.count === 1 ? 'y' : 'ies'} at Focus</small></div>;
}
function GroupNode({ data }) {
  return <div className={`map-group-label ${data.unassigned ? 'unassigned' : ''}`}><Handle type="target" position={Position.Top} style={hidden} /><Handle type="source" position={Position.Bottom} style={hidden} /><span>{data.label}</span><small>{data.ownerLabel} · {data.count}</small></div>;
}
const nodeTypes = { capability: CapabilityNode, anchor: AnchorNode, region: GroupNode };

function NameDialog({ title, initial, onCancel, onSave, action = 'Save' }) {
  const [name, setName] = useState(initial);
  return <Dialog title={title} onCancel={onCancel} actions={<><button type="button" className="primary-action compact" disabled={!name.trim()} onClick={() => onSave(name.trim())}>{action}</button><button type="button" className="outline-action compact" onClick={onCancel}>Cancel</button></>}>
    <label className="dialog-form">View name<input data-autofocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) onSave(name.trim()); }} /></label>
  </Dialog>;
}

function hashSeed(text, seed) { let h = seed; for (let i = 0; i < text.length; i += 1) h = Math.imul(h ^ text.charCodeAt(i), 16777619); return h >>> 0; }

function MapCanvas({ doc, selected, perspective, time, onSelect, openTray, onCommit, onContextChange, confirm, notify }) {
  const rf = useReactFlow();
  const { zoom } = useViewport();
  const { audiences, ownerLabels, timeline } = doc.settings;
  const audience = audiences.find((a) => a.id === perspective) || audiences[0];
  const [activeId, setActiveId] = useState(() => doc.mapViews[0]?.id || null);
  const savedView = doc.mapViews.find((v) => v.id === activeId) || null;
  const [working, setWorking] = useState(() => ({ view: blankView(), placements: new Map() }));
  const [dirty, setDirty] = useState(false);
  const [notice, setNotice] = useState('');
  const [sizes, setSizes] = useState({});
  const [preview, setPreview] = useState(null);
  const [undo, setUndo] = useState([]);
  const [dialog, setDialog] = useState(null);
  const [resetPins, setResetPins] = useState(false);
  const layout = useLayoutRunner();
  const skipLoad = useRef(false);
  const fitPending = useRef(false);
  const moving = time.current !== time.focus;

  function loadView(view) {
    const { view: pruned, pruned: count } = pruneView(view, doc);
    setWorking({ view: pruned, placements: toPlacementMap(pruned.placements) });
    setDirty(count > 0);
    setNotice(count ? `${count} saved position(s) for deleted capabilities were pruned. Save the view to keep this cleanup.` : '');
    setPreview(null); setUndo([]);
    if (view.id) {
      rf.setViewport(view.viewport);
      onContextChange({ selectedId: pruned.selectedCapabilityId, perspective: pruned.audienceId, current: view.currentDate, focus: view.focusDate });
    } else fitPending.current = true;
  }
  useEffect(() => {
    if (skipLoad.current) { skipLoad.current = false; return; }
    loadView(savedView || blankView());
  }, [activeId]); // eslint-disable-line react-hooks/exhaustive-deps

  const filters = working.view.filters;
  const graph = useMemo(() => buildGraph(doc, { currentDate: time.current, focusDate: time.focus, filters, sizes }), [doc, time.current, time.focus, filters, sizes]); // eslint-disable-line react-hooks/exhaustive-deps
  const graphById = useMemo(() => new Map(graph.nodes.map((n) => [n.id, n])), [graph]);
  const missing = useMemo(() => unplacedNodes(graph, working.placements), [graph, working.placements]);
  const missingKey = missing.map((n) => placementKey(n.id, n.context)).join(',');

  // New cards (or cards in a new owner/domain context after Focus changes) are placed near their group
  // without moving anything that already has a position.
  useEffect(() => {
    if (!missing.length || preview) return undefined;
    let live = true;
    const ids = new Set(missing.map((n) => n.id));
    layout.run({ nodes: graph.nodes, edges: graph.edges, fixed: fixedPositions(graph, working.placements), seed: working.view.layoutSeed }).then((result) => {
      if (!live || result.cancelled) return;
      const positions = Object.fromEntries(Object.entries(result.positions).filter(([id]) => ids.has(id)));
      setWorking((old) => ({ ...old, placements: mergePositions(graph, old.placements, positions) }));
    });
    return () => { live = false; };
  }, [missingKey, preview]); // eslint-disable-line react-hooks/exhaustive-deps

  const derived = useMemo(() => graph.nodes.map((node) => {
    const placement = working.placements.get(placementKey(node.id, node.context));
    const position = preview?.positions[node.id] || (placement && { x: placement.x, y: placement.y });
    const base = { id: node.id, type: node.kind === 'group' ? 'region' : node.kind, position: position || { x: 0, y: 0 }, hidden: !position, draggable: !preview, selectable: node.kind === 'capability', zIndex: node.kind === 'anchor' ? 3 : 2 };
    if (node.kind === 'capability') {
      const cap = node.capability;
      return { ...base, data: { name: cap.name, summary: cap.summary, owner: node.owner, phase: moving ? `M${node.from} → M${node.to}` : `M${node.to}`, active: cap.id === selected?.id, planned: node.to > node.from, pinned: placement?.pinned && !preview } };
    }
    if (node.kind === 'anchor') return { ...base, data: { owner: node.owner, label: ownerLabels[node.owner], count: graph.nodes.filter((n) => n.kind === 'capability' && n.owner === node.owner).length } };
    return { ...base, data: { label: node.domain?.name || 'Unassigned', unassigned: !node.domain, ownerLabel: ownerLabels[node.owner], count: node.count } };
  }), [graph, working.placements, preview, selected?.id, moving, ownerLabels]);
  const [rfNodes, setRfNodes] = useState([]);
  useEffect(() => setRfNodes((prev) => { const old = new Map(prev.map((n) => [n.id, n])); return derived.map((n) => ({ ...n, measured: old.get(n.id)?.measured })); }), [derived]);
  // Fit a new working view once every card is placed and measured, so Fit all includes all of them.
  const initialized = useNodesInitialized();
  useEffect(() => {
    if (fitPending.current && initialized && rfNodes.length && rfNodes.every((n) => !n.hidden && n.measured)) {
      fitPending.current = false;
      requestAnimationFrame(() => rf.fitView({ padding: 0.12, duration: 200 }));
    }
  }, [initialized, rfNodes]); // eslint-disable-line react-hooks/exhaustive-deps
  const onNodesChange = (changes) => {
    setRfNodes((ns) => applyNodeChanges(changes, ns));
    const dims = changes.filter((c) => c.type === 'dimensions' && c.dimensions);
    if (dims.length) setSizes((old) => {
      let changed = false; const next = { ...old };
      dims.forEach((c) => { const o = old[c.id]; if (!o || Math.abs(o.width - c.dimensions.width) > 2 || Math.abs(o.height - c.dimensions.height) > 2) { next[c.id] = { width: c.dimensions.width, height: c.dimensions.height }; changed = true; } });
      return changed ? next : old;
    });
  };
  const onNodeDragStop = (_, node) => {
    const graphNode = graphById.get(node.id);
    if (!graphNode) return;
    setUndo((u) => [...u.slice(-19), { placements: working.placements, seed: working.view.layoutSeed, label: 'move' }]);
    setWorking((old) => ({ ...old, placements: pinPlacement(old.placements, graphNode, node.position) }));
    setDirty(true);
  };

  const edges = useMemo(() => graph.edges.map((edge) => {
    if (edge.kind === 'membership') return { id: edge.id, source: edge.source, target: edge.target, type: 'straight', selectable: false, style: { stroke: '#b4c0c9', strokeWidth: 1.2, strokeDasharray: '2 5' } };
    if (edge.kind === 'sameDomain') return { id: edge.id, source: edge.source, target: edge.target, selectable: false, label: 'same domain', labelStyle: { fontSize: 10, fill: '#6b5fa0' }, style: { stroke: '#9a8fc7', strokeWidth: 1.4, strokeDasharray: '7 4' } };
    const crossing = graphById.get(edge.source)?.owner !== graphById.get(edge.target)?.owner;
    const color = crossing ? '#db6c54' : '#415b64';
    return { id: edge.id, source: edge.source, target: edge.target, selectable: false, markerEnd: { type: MarkerType.ArrowClosed, color }, style: { stroke: color, strokeWidth: crossing ? 2.4 : 1.5, strokeDasharray: moving ? '5 4' : 'none' } };
  }), [graph, graphById, moving]);

  // Organic regions in graph coordinates, sized from the member-card envelope.
  const blobs = useMemo(() => {
    const rect = (n) => (n.hidden ? null : { x: n.position.x, y: n.position.y, width: n.measured?.width || graphById.get(n.id)?.width || 200, height: n.measured?.height || graphById.get(n.id)?.height || 90 });
    const byOwner = { appliance: [], federated: [] }; const byGroup = new Map();
    rfNodes.forEach((n) => {
      const g = graphById.get(n.id); const r = rect(n);
      if (!g || !r) return;
      byOwner[g.owner]?.push(r);
      if (g.group) { if (!byGroup.has(g.group)) byGroup.set(g.group, []); byGroup.get(g.group).push(r); }
    });
    const seed = working.view.layoutSeed;
    const ownerPaths = owners.filter((o) => byOwner[o].length).map((o) => ({ key: o, d: blobPath(blobOutline(byOwner[o], 64, hashSeed(o, seed))), fill: ownerZone[o] }));
    const groupPaths = graph.groups.filter((g) => byGroup.get(g.key)?.length).map((g) => ({ key: g.key, d: blobPath(blobOutline(byGroup.get(g.key), 26, hashSeed(g.key, seed))), fill: g.domain?.color || '#eceff2' }));
    return { ownerPaths, groupPaths };
  }, [rfNodes, graphById, graph.groups, working.view.layoutSeed]);

  const setFilters = (patch) => { setWorking((old) => ({ ...old, view: { ...old.view, filters: { ...old.view.filters, ...patch } } })); setDirty(true); };
  const toggleOwner = (owner) => setFilters({ owners: filters.owners.includes(owner) ? filters.owners.filter((o) => o !== owner) : [...filters.owners, owner] });

  async function rebuild() {
    setDialog(null);
    const seed = working.view.layoutSeed + 1;
    const fixed = resetPins ? {} : fixedPositions(graph, working.placements, { pinnedOnly: true });
    const result = await layout.run({ nodes: graph.nodes, edges: graph.edges, fixed, seed });
    if (!result.cancelled) setPreview({ positions: result.positions, seed, reset: resetPins, ms: result.ms });
  }
  function applyPreview() {
    setUndo((u) => [...u.slice(-19), { placements: working.placements, seed: working.view.layoutSeed, label: 'rebuild' }]);
    setWorking((old) => ({ view: { ...old.view, layoutSeed: preview.seed }, placements: mergePositions(graph, old.placements, preview.positions, { reset: preview.reset }) }));
    setPreview(null); setDirty(true);
    requestAnimationFrame(() => rf.fitView({ padding: 0.12, duration: 250 }));
  }
  function undoLayout() {
    const last = undo.at(-1); if (!last) return;
    setWorking((old) => ({ view: { ...old.view, layoutSeed: last.seed }, placements: last.placements }));
    setUndo((u) => u.slice(0, -1)); setDirty(true);
  }

  async function saveView({ asNew = false, name } = {}) {
    const viewport = rf.getViewport();
    const base = asNew || !savedView ? { id: uniqueId(name || 'View', doc.mapViews.map((v) => v.id), 'view'), name: name || `View ${doc.mapViews.length + 1}` } : savedView;
    const view = { ...base, layoutSeed: working.view.layoutSeed, layoutVersion: LAYOUT_VERSION, viewport: { x: viewport.x, y: viewport.y, zoom: viewport.zoom }, filters: working.view.filters, selectedCapabilityId: selected?.id || null, audienceId: audience.id, currentDate: time.current, focusDate: time.focus, placements: toPlacementList(working.placements) };
    const result = await onCommit(upsertMapView(doc, view), `Map view “${view.name}” saved.`);
    if (!result.ok) return false;
    setDirty(false); setNotice('');
    if (view.id !== activeId) { skipLoad.current = true; setActiveId(view.id); }
    return true;
  }
  useDirtyGuard('map', { label: 'The map layout', dirty, save: () => saveView(), discard: () => loadView(savedView || blankView()) });

  async function switchView(id) {
    if (dirty) {
      const choice = await confirm({ title: 'Save the current map view?', body: <p>The working view has unsaved positions, filters or layout changes.</p>, choices: [{ value: 'save', label: 'Save view' }, { value: 'discard', label: 'Discard' }, { value: 'cancel', label: 'Cancel' }] });
      if (choice === 'cancel') return;
      if (choice === 'save' && !(await saveView())) return;
    }
    if (id === activeId) loadView(savedView || blankView()); else setActiveId(id || null);
  }
  async function renameView(name) {
    setDialog(null);
    await onCommit(upsertMapView(doc, { ...savedView, name }), `View renamed to “${name}”.`);
  }
  async function duplicateView(name) {
    setDialog(null);
    await saveView({ asNew: true, name });
  }
  async function deleteView() {
    const choice = await confirm({ title: `Delete the view “${savedView.name}”?`, body: <p>Its saved positions, viewport and filters are removed from the project. Other views are unchanged; you can undo from the header.</p>, choices: [{ value: 'delete', label: 'Delete view' }, { value: 'cancel', label: 'Cancel' }] });
    if (choice !== 'delete') return;
    const result = await onCommit(removeMapView(doc, savedView.id), `View “${savedView.name}” deleted.`);
    if (result.ok) setActiveId(doc.mapViews.find((v) => v.id !== savedView.id)?.id || null);
  }

  const focusOwner = selected ? ownerAt(selected, timeline, time.focus) : null;
  const capCount = graph.nodes.filter((n) => n.kind === 'capability').length;

  return <section className="domain-view view-enter"><div className="domain-intro"><div><div className="eyebrow">Systems view</div><h2>Federated domain map</h2><p>Explore dependencies, boundaries and unresolved ownership across the environment.</p></div><div className="domain-perspective"><span>Perspective</span><strong>{audience.label} lens</strong><small>{audience.need}</small></div></div>
    <div className="map-toolbar" role="toolbar" aria-label="Map views and layout">
      <label className="axis-select">Saved view<select value={activeId || ''} onChange={(e) => switchView(e.target.value)}><option value="">Unsaved view</option>{doc.mapViews.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</select></label>
      {dirty && <span className="dirty-pill" role="status">Unsaved changes</span>}
      <button type="button" className="text-action" onClick={() => (savedView ? saveView() : setDialog({ kind: 'saveAs' }))}><FloppyDisk size={15} /> Save</button>
      <button type="button" className="text-action" onClick={() => setDialog({ kind: 'saveAs' })}><FloppyDisk size={15} /> Save as…</button>
      <button type="button" className="text-action" disabled={!savedView} onClick={() => setDialog({ kind: 'rename' })}><PencilSimple size={15} /> Rename</button>
      <button type="button" className="text-action" disabled={!savedView} onClick={() => setDialog({ kind: 'duplicate' })}><Copy size={15} /> Duplicate</button>
      <button type="button" className="text-action danger" disabled={!savedView} onClick={deleteView}><Trash size={15} /> Delete</button>
      <span className="toolbar-sep" />
      <button type="button" className="text-action" onClick={() => setDialog({ kind: 'rebuild' })} disabled={layout.running || Boolean(preview)}><ArrowsClockwise size={15} /> Rebuild layout</button>
      <button type="button" className="text-action" onClick={undoLayout} disabled={!undo.length || Boolean(preview)}><ArrowCounterClockwise size={15} /> Undo layout</button>
    </div>
    <div className="map-filters" role="group" aria-label="Map filters">
      {owners.map((o) => <label className="checkbox-row" key={o}><input type="checkbox" checked={!filters.owners.length || filters.owners.includes(o)} onChange={() => toggleOwner(o)} />{ownerLabels[o]}</label>)}
      <details className="filter-pop"><summary>Domains {filters.domainIds.length ? `(${filters.domainIds.length})` : '(all)'}</summary><div className="filter-list">{doc.domains.length ? doc.domains.map((d) => <label className="checkbox-row" key={d.id}><input type="checkbox" checked={filters.domainIds.includes(d.id)} onChange={() => setFilters({ domainIds: filters.domainIds.includes(d.id) ? filters.domainIds.filter((x) => x !== d.id) : [...filters.domainIds, d.id] })} />{d.name}</label>) : <p className="muted">No domains defined.</p>}</div></details>
      <input type="search" aria-label="Search cards" placeholder="Search cards" value={filters.search} onChange={(e) => setFilters({ search: e.target.value })} />
      <small className="muted">{capCount} of {doc.capabilities.length} cards shown</small>
    </div>
    {notice && <p className="map-notice" role="status">{notice}</p>}
    <div className="domain-layout"><div className="domain-canvas" aria-label="Domain map canvas">
      <ReactFlow nodes={rfNodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} onNodeDragStop={onNodeDragStop}
        onNodeClick={(_, node) => { const g = graphById.get(node.id); if (g?.kind === 'capability') onSelect(g.capability.id); else if (g?.kind === 'group' && g.domain) openTray({ type: 'domain', id: g.domain.id }); else if (g?.kind === 'anchor') openTray({ type: 'settings', focusPath: `settings.ownerLabels.${g.owner}` }); }}
        minZoom={0.1} maxZoom={2} nodesConnectable={false} zoomOnScroll zoomOnPinch panOnDrag panOnScroll={false} proOptions={{ hideAttribution: true }}>
        <ViewportPortal><svg className="map-blobs" aria-hidden="true">{blobs.ownerPaths.map((p) => <path key={p.key} d={p.d} fill={p.fill} />)}{blobs.groupPaths.map((p) => <path key={p.key} d={p.d} fill={p.fill} fillOpacity="0.9" stroke="#ffffff" strokeWidth="2" />)}</svg></ViewportPortal>
      </ReactFlow>
      <div className="zoom-controls" role="group" aria-label="Zoom">
        <button type="button" onClick={() => rf.zoomOut({ duration: 150 })} aria-label="Zoom out"><MagnifyingGlassMinus size={17} /></button>
        <span aria-live="polite">{Math.round(zoom * 100)}%</span>
        <button type="button" onClick={() => rf.zoomIn({ duration: 150 })} aria-label="Zoom in"><MagnifyingGlassPlus size={17} /></button>
        <button type="button" onClick={() => rf.fitView({ padding: 0.12, duration: 250 })}><ArrowsOut size={16} /> Fit all</button>
        <button type="button" disabled={!selected || !graphById.has(capNodeId(selected.id))} onClick={() => rf.fitView({ nodes: [{ id: capNodeId(selected.id) }], padding: 0.8, maxZoom: 1.2, duration: 250 })}><Crosshair size={16} /> Fit selection</button>
      </div>
      {(layout.running || preview) && <div className="layout-banner" role="status">{layout.running ? <>Arranging cards…<button type="button" className="outline-action compact" onClick={layout.cancel}>Cancel</button></> : <>Previewing a rebuilt layout (seed {preview.seed}{preview.reset ? ', manual positions reset' : ', pinned cards kept'}).<button type="button" className="primary-action compact" onClick={applyPreview}>Apply</button><button type="button" className="outline-action compact" onClick={() => setPreview(null)}>Cancel</button></>}</div>}
      {!capCount && <div className="map-empty">{doc.capabilities.length ? 'No cards match the map filters.' : 'No capabilities yet.'}</div>}
    </div>
      {selected && <aside className="domain-insight"><div className="eyebrow">What {audience.label.toLowerCase()} can see now</div><h3>Dependency across the boundary</h3><p><strong>{selected.name}</strong> depends on {selected.dependencies.length ? selected.dependencies.map((id) => doc.capabilities.find((cap) => cap.id === id)?.name).filter(Boolean).join(' and ') : 'no recorded upstream capability'}.</p><div className="map-alert"><WarningCircle size={20} /><div><strong>{selected.owner !== selected.futureOwner ? 'Handoff needs owner' : 'Review responsibility'}</strong><span>{selected.decision || 'No decision recorded.'}</span><button onClick={() => openTray({ type: 'capability', id: selected.id })}>Resolve ownership <ArrowRight size={15} /></button></div></div><div className="side-divider" /><h3>Wider scope</h3><p>Regions are sized from their cards. Domains connect to their owner at the Focus date; drag cards to pin them, or rebuild the layout.</p><div className="map-selected"><span>Selected capability</span><strong>{selected.name}</strong><small>M{maturityAt(selected, timeline, time.focus)} · {ownerLabels[focusOwner]} ownership · {periodLabel(time.focus, timeline.granularity)}{moving ? ` (from ${periodLabel(time.current, timeline.granularity)})` : ''}</small></div></aside>}
    </div>
    <div className="domain-legend"><span><i className="swatch appliance" /> {ownerLabels.appliance}</span><span><i className="swatch federated" /> {ownerLabels.federated}</span><span><i className="swatch planned" /> Planned maturity</span><span><i className="line dependency" /> Dependency</span><span><i className="line crossing" /> Crosses owners</span><span><i className="line membership" /> Domain membership</span><small>Maturity 8+ continues as the domain evolves.</small></div>
    {dialog?.kind === 'saveAs' && <NameDialog title="Save view as" initial={`View ${doc.mapViews.length + 1}`} onCancel={() => setDialog(null)} onSave={async (name) => { setDialog(null); await saveView({ asNew: true, name }); }} />}
    {dialog?.kind === 'rename' && <NameDialog title="Rename view" initial={savedView.name} action="Rename" onCancel={() => setDialog(null)} onSave={renameView} />}
    {dialog?.kind === 'duplicate' && <NameDialog title="Duplicate view" initial={`${savedView.name} copy`} action="Duplicate" onCancel={() => setDialog(null)} onSave={duplicateView} />}
    {dialog?.kind === 'rebuild' && <Dialog title="Rebuild layout" onCancel={() => setDialog(null)} actions={<><button type="button" className="primary-action compact" onClick={rebuild}>Preview layout</button><button type="button" className="outline-action compact" onClick={() => setDialog(null)}>Cancel</button></>}>
      <p>Generates a new organic arrangement (seed {working.view.layoutSeed + 1}) for this view. You preview it before applying, and Undo layout restores the previous arrangement. Other saved views are never changed.</p>
      <label className="checkbox-row"><input type="checkbox" checked={resetPins} onChange={(e) => setResetPins(e.target.checked)} /> Reset manual positions (otherwise pinned cards stay where you put them)</label>
    </Dialog>}
  </section>;
}

export function MapView(props) {
  return <ReactFlowProvider><MapCanvas {...props} /></ReactFlowProvider>;
}
