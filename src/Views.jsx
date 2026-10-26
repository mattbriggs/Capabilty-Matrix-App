import { useMemo, useState } from 'react';
import { ReactFlow, Handle, MarkerType, Position } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ArrowRight, FileText, FolderSimple, Graph, PencilSimple, WarningCircle } from '@phosphor-icons/react';
import { initialCapabilities, levelLabels, matrixRows, maturityAt, ownerAt, periodLabel } from './model';

const lookup = (list) => Object.fromEntries(list.map((cap) => [cap.id, cap]));
const columnCount = (capabilities) => Math.max(9, ...capabilities.map((cap) => cap.levels.length));
function useTime(settings, time) {
  const { timeline } = settings;
  const at = (cap, date) => maturityAt(cap, timeline, date);
  const label = (date) => periodLabel(date, timeline.granularity);
  return { at, label, currentLabel: label(time.current), focusLabel: label(time.focus) };
}
const audienceMilestones = {
  consultant: ['Relies on local knowledge and experience.', 'Clear implementation guidance is available.', 'Scenario-based guidance reduces time to value.', 'Federated delivery supports reuse across clients.'],
  client: ['Little help at the point of need.', 'In-device help covers common tasks.', 'Contextual guidance appears when needed.', 'Help follows the workflow across channels.'],
  'product-team': ['Content and decisions are hard to reuse.', 'Product metadata and topic structure are defined.', 'A stable data contract supports dynamic guidance.', 'Product metadata feeds the shared service.'],
  leadership: ['Scope is difficult to explain.', 'Product value and boundaries become visible.', 'Handoff cost and responsibility can be planned.', 'Wider-domain value can be assessed.'],
};

export function MatrixView({ capabilities, selected, settings, perspective, time, onSelect, onNavigate }) {
  const byId = lookup(capabilities);
  const { audiences, ownerLabels } = settings;
  const { at, currentLabel, focusLabel } = useTime(settings, time);
  const activeAudience = audiences.find((a) => a.id === perspective) || audiences[0];
  const columns = columnCount(capabilities);
  const phases = levelLabels(columns);
  const currentM = at(selected, time.current);
  const focusM = at(selected, time.focus);
  const marker = (value) => `${((Math.min(value, columns - 1) + .5) / columns) * 100}%`;
  const dependencyNames = selected.dependencies.map((id) => byId[id]?.name).filter(Boolean);
  return <div className="matrix-layout view-enter"><section className="matrix-surface" aria-label="Capability maturity by audience">
    <div className="section-heading"><div><h2>Capability maturity by audience</h2><p>Compare where capabilities sit and how responsibility changes.</p></div><div className="horizon-note">Higher maturity extends to a wider domain horizon <ArrowRight size={21} /></div></div>
    <div className="matrix-scroll"><div className="matrix-chart"><div className="matrix-corner">Audience</div><div className="phase-head" style={{ gridTemplateColumns: `repeat(${columns},1fr)` }}>{phases.map((label) => <span key={label}>{label}</span>)}</div>
      {audiences.map((audience) => {
        const row = matrixRows.find((item) => item.audience === audience.id);
        const bars = (row?.bars || []).map((item) => ({ ...item, cap: byId[item.id] })).filter((item) => item.cap);
        if (!bars.length) capabilities.filter((cap) => cap.dita?.audience?.includes(audience.id)).slice(0, 2).forEach((cap) => bars.push({ cap, start: Math.max(0, cap.current - 2), end: Math.min(columns, cap.target + 1) }));
        return <div className={`matrix-row ${audience.id === perspective ? 'perspective-active' : ''}`} key={audience.id}><div className="row-label"><strong>{audience.label}</strong><span>{audience.description}</span></div><div className="row-track"><div className="gridlines" style={{ gridTemplateColumns: `repeat(${columns},1fr)` }}>{phases.map((label) => <span key={label} />)}</div>
          {currentM !== focusM && <div className="phase-line current" style={{ left: marker(currentM) }} />}<div className="phase-line" style={{ left: marker(focusM) }} />
          {bars.map((item, index) => {
            const cap = item.cap;
            const base = initialCapabilities.find((candidate) => candidate.id === cap.id);
            const start = Math.max(0, Math.min(columns - .5, item.start + (base ? cap.current - base.current : 0)));
            const end = Math.max(start + .6, Math.min(columns, item.end + (base ? cap.target - base.target : 0)));
            return <button key={`${audience.id}-${cap.id}`} className={`capability-bar ${cap.owner} future-${cap.futureOwner} ${cap.id === selected.id ? 'active' : ''}`} style={{ left: `${((start + .12) / columns) * 100}%`, width: `${((end - start - .12) / columns) * 100}%`, top: `${21 + index * 32}px` }} onClick={() => onSelect(cap.id)} title={`Select ${cap.name}`}><span>{cap.name}</span><i aria-hidden="true" /></button>;
          })}
        </div></div>;
      })}
    </div></div>
    <div className="matrix-legend"><span><i className="swatch appliance" /> {ownerLabels.appliance} ownership</span><span><i className="swatch federated" /> {ownerLabels.federated} ownership</span><span><i className="swatch planned" /> Planned reach</span><span><i className="swatch marker" /> Focus maturity ({focusLabel})</span>{currentM !== focusM && <span><i className="swatch marker-current" /> Current maturity ({currentLabel})</span>}</div>
    <div className="explore-strip"><div><strong>Explore this capability across views</strong><span>{selected.name}, {activeAudience.label.toLowerCase()} perspective and the {currentLabel} to {focusLabel} timeline carry across.</span></div><button onClick={() => onNavigate('journey')}>Capability journey <ArrowRight size={17} /></button><button onClick={() => onNavigate('map')}>Domain map <ArrowRight size={17} /></button></div>
  </section><aside className="insight-panel"><div className="eyebrow">Selected capability</div><h2>{selected.name}</h2><p className="insight-meta">{activeAudience.label} perspective <span>·</span> Maturity M{currentM}{currentM !== focusM ? ` → M${focusM}` : ''}</p><p className="insight-summary">{selected.summary}</p>
    <div className="insight-section"><h3>What this perspective needs</h3><p>{activeAudience.need || 'No need recorded for this perspective.'}</p></div><div className="insight-section"><h3>Dependencies</h3><p>{dependencyNames.length ? dependencyNames.join(' and ') : 'No upstream dependencies recorded.'}</p></div><div className="insight-section"><h3>Ownership decision</h3><p>{selected.decision}</p></div>
    <button className="primary-action" onClick={() => onNavigate('map')}>Review handoff <ArrowRight size={18} /></button>
    <div className="mini-progress"><div className="progress-head"><span>{currentLabel} M{currentM}</span><span>{focusLabel} M{focusM}</span></div><div className="progress-line"><i style={{ left: `${(Math.min(currentM, columns - 1) / (columns - 1)) * 100}%` }} /><i className="target" style={{ left: `${(Math.min(focusM, columns - 1) / (columns - 1)) * 100}%` }} /></div><div className="progress-labels">{phases.map((p) => <span key={p}>{p}</span>)}</div><small>{columns - 1}+ is an evolving wider-domain horizon. Plan target: M{selected.target}.</small></div>
  </aside></div>;
}

export function JourneyView({ capabilities, selected, settings, perspective, time, onNavigate, onUpdate, onDefineLevels, onManageDependencies }) {
  const { audiences, ownerLabels } = settings;
  const { at, currentLabel, focusLabel } = useTime(settings, time);
  const audience = audiences.find((a) => a.id === perspective) || audiences[0];
  const byId = lookup(capabilities);
  const [inspected, setInspected] = useState(null);
  const levels = selected.levels;
  const phases = levelLabels(levels.length);
  const currentM = at(selected, time.current);
  const focusM = at(selected, time.focus);
  const ownerNow = ownerAt(selected, settings.timeline, time.current);
  const ownerFocus = ownerAt(selected, settings.timeline, time.focus);
  const transition = selected.owner !== selected.futureOwner;
  const inspect = inspected !== null && levels[inspected] ? inspected : null;
  const setMaturity = (field, value) => onUpdate({ ...selected, [field]: value, ...(field === 'current' && selected.target < value ? { target: value } : {}), ...(field === 'target' && selected.current > value ? { current: value } : {}) });
  return <section className="journey-view view-enter"><div className="journey-intro"><div><div className="eyebrow">Capability journey</div><h2>{selected.name}</h2><p>{selected.summary}</p></div><div className="journey-thesis"><h3>{transition ? `From ${ownerLabels[selected.owner].toLowerCase()} delivery to ${ownerLabels[selected.futureOwner].toLowerCase()} handoff` : 'A capability with a clear ownership path'}</h3><p>{selected.decision}</p></div></div>
    <div className="journey-overline"><span>Early exploration</span><span>Product capability</span><span>Wider-domain solution</span></div><div className="stage-notes" style={{ gridTemplateColumns: `repeat(${levels.length},1fr)` }}>{levels.map((level, index) => <span key={index}>{level.description}</span>)}</div>
    <div className="journey-track" style={{ gridTemplateColumns: `repeat(${levels.length},1fr)` }}>{phases.map((phase, index) => <div key={phase} role="button" tabIndex={0} onClick={() => setInspected(index === inspect ? null : index)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setInspected(index === inspect ? null : index); } }} className={`journey-phase ${index === currentM ? 'current' : ''} ${index === focusM ? 'target' : ''} ${index === focusM ? 'viewed' : ''} ${index === inspect ? 'inspected' : ''}`}><span className="phase-title">{index === currentM ? 'CURRENT' : index === focusM ? 'FOCUS' : index === selected.target ? 'TARGET' : ' '}</span><span className="phase-dot">{phase}</span><span className="phase-caption">{levels[index].name}</span></div>)}</div>
    {inspect !== null ? <div className="level-card"><div><strong>M{phases[inspect]} · {levels[inspect].name}</strong><span>{levels[inspect].description || 'No description yet.'}</span></div><div className="level-card-actions"><button className="outline-action" onClick={() => setMaturity('current', inspect)} disabled={selected.current === inspect}>Set as current</button><button className="outline-action" onClick={() => setMaturity('target', inspect)} disabled={selected.target === inspect}>Set as target</button></div></div> : <p className="level-hint">Select a maturity level to read it or to set it as the current maturity or the target.</p>}
    <div className="journey-detail-grid"><div className="journey-main"><div className="owner-ribbon"><div className={`owner-segment ${ownerNow}`}>{ownerLabels[ownerNow]} scope <span>M{currentM} · {currentLabel}</span></div><div className={`owner-segment ${ownerFocus}`}>{ownerLabels[ownerFocus]} scope <span>M{focusM} · {focusLabel}</span></div></div>
      <div className="journey-deps"><div className="journey-deps-head"><h3>Key dependencies</h3><button className="text-action" onClick={onManageDependencies}><PencilSimple size={16} /> Manage dependencies</button></div>{selected.dependencies.length ? selected.dependencies.map((id) => byId[id]).filter(Boolean).map((dep) => <button className="dependency-row" key={dep.id} onClick={() => onNavigate('map')}><FolderSimple size={23} /><span><strong>{dep.name}</strong><small>{dep.summary}</small></span><ArrowRight size={17} /></button>) : <p>No dependencies recorded yet. Use Manage dependencies to add one.</p>}</div>
      <div className="audience-impact"><h3>Why it matters at each stage</h3>{audiences.filter((item) => audienceMilestones[item.id]).map((item) => <div className={`impact-lane ${item.id === perspective ? 'active' : ''}`} key={item.id}><strong>{item.label}</strong>{audienceMilestones[item.id].map((milestone, index) => <span key={index}>{milestone}</span>)}</div>)}</div>
    </div><aside className="journey-side"><div className="eyebrow">{audience.label} lens</div><h3>Scope decision</h3><p>{selected.decision}</p><div className="side-divider" /><h4>Maturity levels</h4><p>{levels.length} levels defined. Target is M{selected.target}.</p><button className="outline-action" onClick={onDefineLevels}>Define maturity levels <PencilSimple size={16} /></button><div className="side-divider" /><h4>Content provenance</h4><p>YAML capability record → DITA mapping → embedded help and PDF manual.</p><button className="outline-action" onClick={() => onNavigate('matrix')}>Compare perspectives <ArrowRight size={17} /></button></aside></div>
  </section>;
}

const mapPositions = { 'contextual-guidance': { x: 20, y: 72 }, 'deployment-metadata': { x: 20, y: 350 }, 'identity-service': { x: 320, y: 62 }, 'audit-trail': { x: 320, y: 375 }, 'content-service': { x: 620, y: 230 }, 'domain-insight': { x: 875, y: 360 } };
const mapIcons = { 'contextual-guidance': FileText, 'deployment-metadata': FolderSimple, 'identity-service': Graph, 'audit-trail': FileText, 'content-service': FolderSimple, 'domain-insight': Graph };

function CapabilityNode({ data }) {
  const Icon = data.icon;
  return <div className={`map-node ${data.owner} ${data.active ? 'active' : ''} ${data.planned ? 'planned' : ''}`}><Handle type="target" position={Position.Left} className="map-handle" /><div className="map-node-icon"><Icon size={24} /></div><div><div className="map-node-phase">{data.phase}</div><div className="map-node-name">{data.name}</div><div className="map-node-summary">{data.summary}</div></div><Handle type="source" position={Position.Right} className="map-handle" /></div>;
}
const nodeTypes = { capability: CapabilityNode };

export function MapView({ capabilities, selected, settings, perspective, time, onSelect, onEdit }) {
  const { audiences, ownerLabels, timeline } = settings;
  const audience = audiences.find((a) => a.id === perspective) || audiences[0];
  const ids = useMemo(() => new Set(capabilities.map((cap) => cap.id)), [capabilities]);
  const { currentLabel, focusLabel } = useTime(settings, time);
  const moving = time.current !== time.focus;
  const nodes = useMemo(() => capabilities.map((cap, index) => {
    const from = maturityAt(cap, timeline, time.current);
    const to = maturityAt(cap, timeline, time.focus);
    return { id: cap.id, type: 'capability', position: mapPositions[cap.id] || { x: 290 + (index % 3) * 250, y: 130 + Math.floor(index / 3) * 170 }, draggable: false, data: { ...cap, owner: ownerAt(cap, timeline, time.focus), phase: moving ? `M${from} → M${to}` : `M${to}`, icon: mapIcons[cap.id] || FolderSimple, active: cap.id === selected.id, planned: to > from } };
  }), [capabilities, selected.id, timeline, time.current, time.focus, moving]);
  const edges = useMemo(() => capabilities.flatMap((cap) => cap.dependencies.filter((dep) => ids.has(dep)).map((dep) => { const handoff = dep === 'deployment-metadata' && cap.id === 'content-service'; return { id: `${dep}-${cap.id}`, source: dep, target: cap.id, markerEnd: { type: MarkerType.ArrowClosed, color: handoff ? '#db6c54' : '#415b64' }, style: { stroke: handoff ? '#db6c54' : '#415b64', strokeWidth: handoff ? 2.5 : 1.5, strokeDasharray: moving ? '5 4' : 'none' } }; })), [capabilities, ids, moving]);
  const focusOwner = ownerAt(selected, timeline, time.focus);
  return <section className="domain-view view-enter"><div className="domain-intro"><div><div className="eyebrow">Systems view</div><h2>Federated domain map</h2><p>Explore dependencies, boundaries and unresolved ownership across the environment.</p></div><div className="domain-perspective"><span>Perspective</span><strong>{audience.label} lens</strong><small>{audience.need}</small></div></div>
    <div className="domain-layout"><div className="domain-canvas"><div className="map-zones"><div className="appliance-zone"><span>{ownerLabels.appliance}</span><small>Managed product scope</small></div><div className="federated-zone"><span>{ownerLabels.federated} environment</span><small>Partner and IT ecosystem</small></div></div><div className="boundary-label">Responsibility boundary</div><ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodeClick={(_, node) => onSelect(node.id)} fitView fitViewOptions={{ padding: .03, minZoom: .75, maxZoom: 1 }} minZoom={.55} maxZoom={1.2} nodesDraggable={false} nodesConnectable={false} zoomOnScroll={false} panOnScroll={false} zoomOnPinch proOptions={{ hideAttribution: true }} /></div>
      <aside className="domain-insight"><div className="eyebrow">What {audience.label.toLowerCase()} can see now</div><h3>Dependency across the boundary</h3><p><strong>{selected.name}</strong> depends on {selected.dependencies.length ? selected.dependencies.map((id) => capabilities.find((cap) => cap.id === id)?.name).filter(Boolean).join(' and ') : 'no recorded upstream capability'}.</p><div className="map-alert"><WarningCircle size={20} /><div><strong>{selected.owner !== selected.futureOwner ? 'Handoff needs owner' : 'Review responsibility'}</strong><span>{selected.decision}</span><button onClick={onEdit}>Resolve ownership <ArrowRight size={15} /></button></div></div><div className="side-divider" /><h3>Wider scope</h3><p>The map shows how the chosen capability relies on other services and where the appliance boundary sits.</p><div className="map-selected"><span>Selected capability</span><strong>{selected.name}</strong><small>M{maturityAt(selected, timeline, time.focus)} · {ownerLabels[focusOwner]} ownership · {focusLabel}{moving ? ` (from ${currentLabel})` : ''}</small></div></aside></div>
    <div className="domain-legend"><span><i className="swatch appliance" /> {ownerLabels.appliance}</span><span><i className="swatch federated" /> {ownerLabels.federated}</span><span><i className="swatch planned" /> Planned maturity</span><small>Maturity 8+ continues as the domain evolves.</small></div>
  </section>;
}
