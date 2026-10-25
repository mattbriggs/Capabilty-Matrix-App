import { useMemo } from 'react';
import { ReactFlow, Handle, MarkerType, Position } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ArrowRight, FileText, FolderSimple, Graph, WarningCircle } from '@phosphor-icons/react';
import { audiences, audienceNeeds, initialCapabilities, matrixRows } from './model';

const phases = ['0', '1', '2', '3', '4', '5', '6', '7', '8+'];
const lookup = (list) => Object.fromEntries(list.map((cap) => [cap.id, cap]));
const guidanceStages = ['Ad hoc content with no shared approach.', 'Basic in-app help and FAQs.', 'Consistent topics and terminology.', 'Product-owned guidance delivered in device.', 'Contextual, task-based guidance.', 'Shared guidance across products.', 'Partners and clients integrated.', 'Guidance across workflows and channels.', 'Continuing wider-domain evolution.'];
const generalStages = ['Explore the need.', 'Describe the capability.', 'Define the model.', 'Operate a first version.', 'Measure outcomes.', 'Optimize the handoff.', 'Scale to more contexts.', 'Connect across domains.', 'Continue domain evolution.'];
const audienceMilestones = {
  consultant: ['Relies on local knowledge and experience.', 'Clear implementation guidance is available.', 'Scenario-based guidance reduces time to value.', 'Federated delivery supports reuse across clients.'],
  client: ['Little help at the point of need.', 'In-device help covers common tasks.', 'Contextual guidance appears when needed.', 'Help follows the workflow across channels.'],
  'product-team': ['Content and decisions are hard to reuse.', 'Product metadata and topic structure are defined.', 'A stable data contract supports dynamic guidance.', 'Product metadata feeds the shared service.'],
  leadership: ['Scope is difficult to explain.', 'Product value and boundaries become visible.', 'Handoff cost and responsibility can be planned.', 'Wider-domain value can be assessed.'],
};

export function MatrixView({ capabilities, selected, perspective, state, onSelect, onNavigate }) {
  const byId = lookup(capabilities);
  const activeAudience = audiences.find((a) => a.id === perspective);
  const maturity = state === 'current' ? selected.current : selected.target;
  const dependencyNames = selected.dependencies.map((id) => byId[id]?.name).filter(Boolean);
  return <div className="matrix-layout view-enter"><section className="matrix-surface" aria-label="Capability maturity by audience">
    <div className="section-heading"><div><h2>Capability maturity by audience</h2><p>Compare where capabilities sit and how responsibility changes.</p></div><div className="horizon-note">Higher maturity extends to a wider domain horizon <ArrowRight size={21} /></div></div>
    <div className="matrix-scroll"><div className="matrix-chart"><div className="matrix-corner">Audience</div><div className="phase-head">{phases.map((label) => <span key={label}>{label}</span>)}</div>
      {matrixRows.map((row) => {
        const audience = audiences.find((item) => item.id === row.audience);
        const bars = row.bars.map((item) => ({ ...item, cap: byId[item.id] })).filter((item) => item.cap);
        if (!bars.length) capabilities.filter((cap) => cap.dita?.audience?.includes(row.audience)).slice(0, 2).forEach((cap) => bars.push({ cap, start: Math.max(0, cap.current - 2), end: Math.min(9, cap.target + 1) }));
        return <div className={`matrix-row ${row.audience === perspective ? 'perspective-active' : ''}`} key={row.audience}><div className="row-label"><strong>{audience.label}</strong><span>{audience.description}</span></div><div className="row-track"><div className="gridlines">{phases.map((label) => <span key={label} />)}</div><div className="phase-line" style={{ left: `${((Math.min(maturity, 8) + .5) / 9) * 100}%` }} />
          {bars.map((item, index) => {
            const cap = item.cap;
            const base = initialCapabilities.find((candidate) => candidate.id === cap.id);
            const start = Math.max(0, Math.min(8.5, item.start + (base ? cap.current - base.current : 0)));
            const end = Math.max(start + .6, Math.min(9, item.end + (base ? cap.target - base.target : 0)));
            return <button key={`${row.audience}-${cap.id}`} className={`capability-bar ${cap.owner} future-${cap.futureOwner} ${cap.id === selected.id ? 'active' : ''}`} style={{ left: `${((start + .12) / 9) * 100}%`, width: `${((end - start - .12) / 9) * 100}%`, top: `${21 + index * 32}px` }} onClick={() => onSelect(cap.id)} title={`Select ${cap.name}`}><span>{cap.name}</span><i aria-hidden="true" /></button>;
          })}
        </div></div>;
      })}
    </div></div>
    <div className="matrix-legend"><span><i className="swatch appliance" /> Appliance ownership</span><span><i className="swatch federated" /> Federated ownership</span><span><i className="swatch planned" /> Planned reach</span><span><i className="swatch marker" /> {state === 'current' ? 'Current' : 'Future'} maturity</span></div>
    <div className="explore-strip"><div><strong>Explore this capability across views</strong><span>{selected.name}, {activeAudience.label.toLowerCase()} perspective and {state} state carry across.</span></div><button onClick={() => onNavigate('journey')}>Capability journey <ArrowRight size={17} /></button><button onClick={() => onNavigate('map')}>Domain map <ArrowRight size={17} /></button></div>
  </section><aside className="insight-panel"><div className="eyebrow">Selected capability</div><h2>{selected.name}</h2><p className="insight-meta">{activeAudience.label} perspective <span>·</span> Maturity phase {maturity}</p><p className="insight-summary">{selected.summary}</p>
    <div className="insight-section"><h3>What this perspective needs</h3><p>{audienceNeeds[perspective]}</p></div><div className="insight-section"><h3>Dependencies</h3><p>{dependencyNames.length ? dependencyNames.join(' and ') : 'No upstream dependencies recorded.'}</p></div><div className="insight-section"><h3>Ownership decision</h3><p>{selected.decision}</p></div>
    <button className="primary-action" onClick={() => onNavigate('map')}>Review handoff <ArrowRight size={18} /></button>
    <div className="mini-progress"><div className="progress-head"><span>Current M{selected.current}</span><span>Planned M{selected.target}</span></div><div className="progress-line"><i style={{ left: `${(Math.min(selected.current, 8) / 8) * 100}%` }} /><i className="target" style={{ left: `${(Math.min(selected.target, 8) / 8) * 100}%` }} /></div><div className="progress-labels">{phases.map((p) => <span key={p}>{p}</span>)}</div><small>8+ is an evolving wider-domain horizon.</small></div>
  </aside></div>;
}

export function JourneyView({ capabilities, selected, perspective, state, onNavigate }) {
  const audience = audiences.find((a) => a.id === perspective);
  const byId = lookup(capabilities);
  const viewedPhase = state === 'current' ? selected.current : selected.target;
  const transition = selected.owner !== selected.futureOwner;
  return <section className="journey-view view-enter"><div className="journey-intro"><div><div className="eyebrow">Capability journey</div><h2>{selected.name}</h2><p>{selected.summary}</p></div><div className="journey-thesis"><h3>{transition ? 'From appliance delivery to federated handoff' : 'A capability with a clear ownership path'}</h3><p>{selected.decision}</p></div></div>
    <div className="journey-overline"><span>Early exploration</span><span>Product capability</span><span>Wider-domain solution</span></div><div className="stage-notes">{(selected.id === 'contextual-guidance' ? guidanceStages : generalStages).map((note, index) => <span key={index}>{note}</span>)}</div><div className="journey-track">{phases.map((phase, index) => <div key={phase} className={`journey-phase ${index === selected.current ? 'current' : ''} ${index === selected.target ? 'target' : ''} ${index === viewedPhase ? 'viewed' : ''}`}><span className="phase-title">{index === selected.current ? 'CURRENT' : index === selected.target ? 'TARGET' : '\u00a0'}</span><span className="phase-dot">{phase}</span><span className="phase-caption">{['Emerging', 'Initial', 'Defined', 'Managed', 'Measured', 'Optimized', 'Scaled', 'Extended', 'Ecosystem'][index]}</span></div>)}</div>
    <div className="journey-detail-grid"><div className="journey-main"><div className="owner-ribbon"><div className="owner-segment appliance">Appliance scope <span>M{selected.current} today</span></div><div className={`owner-segment ${selected.futureOwner}`}>{selected.futureOwner === 'federated' ? 'Federated scope' : 'Appliance scope'} <span>M{selected.target} target</span></div></div>
      <div className="journey-deps"><h3>Key dependencies</h3>{selected.dependencies.length ? selected.dependencies.map((id) => byId[id]).filter(Boolean).map((dep) => <button className="dependency-row" key={dep.id} onClick={() => onNavigate('map')}><FolderSimple size={23} /><span><strong>{dep.name}</strong><small>{dep.summary}</small></span><ArrowRight size={17} /></button>) : <p>No dependencies recorded yet. Add one while editing this capability.</p>}</div>
      <div className="audience-impact"><h3>Why it matters at each stage</h3>{audiences.slice(0, 4).map((item) => <div className={`impact-lane ${item.id === perspective ? 'active' : ''}`} key={item.id}><strong>{item.label}</strong>{audienceMilestones[item.id].map((milestone, index) => <span key={index}>{milestone}</span>)}</div>)}</div>
    </div><aside className="journey-side"><div className="eyebrow">{audience.label} lens</div><h3>Scope decision</h3><p>{selected.decision}</p><div className="side-divider" /><h4>Content provenance</h4><p>YAML capability record → DITA mapping → embedded help and PDF manual.</p><button className="outline-action" onClick={() => onNavigate('matrix')}>Compare perspectives <ArrowRight size={17} /></button></aside></div>
  </section>;
}

const mapPositions = { 'contextual-guidance': { x: 20, y: 72 }, 'deployment-metadata': { x: 20, y: 350 }, 'identity-service': { x: 320, y: 62 }, 'audit-trail': { x: 320, y: 375 }, 'content-service': { x: 620, y: 230 }, 'domain-insight': { x: 875, y: 360 } };
const mapIcons = { 'contextual-guidance': FileText, 'deployment-metadata': FolderSimple, 'identity-service': Graph, 'audit-trail': FileText, 'content-service': FolderSimple, 'domain-insight': Graph };

function CapabilityNode({ data }) {
  const Icon = data.icon;
  return <div className={`map-node ${data.owner} ${data.active ? 'active' : ''} ${data.planned ? 'planned' : ''}`}><Handle type="target" position={Position.Left} className="map-handle" /><div className="map-node-icon"><Icon size={24} /></div><div><div className="map-node-phase">M{data.current} / target M{data.target}</div><div className="map-node-name">{data.name}</div><div className="map-node-summary">{data.summary}</div></div><Handle type="source" position={Position.Right} className="map-handle" /></div>;
}
const nodeTypes = { capability: CapabilityNode };

export function MapView({ capabilities, selected, perspective, state, onSelect, onEdit }) {
  const audience = audiences.find((a) => a.id === perspective);
  const ids = useMemo(() => new Set(capabilities.map((cap) => cap.id)), [capabilities]);
  const nodes = useMemo(() => capabilities.map((cap, index) => ({ id: cap.id, type: 'capability', position: mapPositions[cap.id] || { x: 290 + (index % 3) * 250, y: 130 + Math.floor(index / 3) * 170 }, draggable: false, data: { ...cap, icon: mapIcons[cap.id] || FolderSimple, active: cap.id === selected.id, planned: state === 'future' && cap.target > cap.current } })), [capabilities, selected.id, state]);
  const edges = useMemo(() => capabilities.flatMap((cap) => cap.dependencies.filter((dep) => ids.has(dep)).map((dep) => { const handoff = dep === 'deployment-metadata' && cap.id === 'content-service'; return { id: `${dep}-${cap.id}`, source: dep, target: cap.id, markerEnd: { type: MarkerType.ArrowClosed, color: handoff ? '#db6c54' : '#415b64' }, style: { stroke: handoff ? '#db6c54' : '#415b64', strokeWidth: handoff ? 2.5 : 1.5, strokeDasharray: state === 'future' ? '5 4' : 'none' } }; })), [capabilities, ids, state]);
  return <section className="domain-view view-enter"><div className="domain-intro"><div><div className="eyebrow">Systems view</div><h2>Federated domain map</h2><p>Explore dependencies, boundaries and unresolved ownership across the environment.</p></div><div className="domain-perspective"><span>Perspective</span><strong>{audience.label} lens</strong><small>{audienceNeeds[perspective]}</small></div></div>
    <div className="domain-layout"><div className="domain-canvas"><div className="map-zones"><div className="appliance-zone"><span>Appliance</span><small>Managed product scope</small></div><div className="federated-zone"><span>Federated environment</span><small>Partner and IT ecosystem</small></div></div><div className="boundary-label">Responsibility boundary</div><ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodeClick={(_, node) => onSelect(node.id)} fitView fitViewOptions={{ padding: .03, minZoom: .75, maxZoom: 1 }} minZoom={.55} maxZoom={1.2} nodesDraggable={false} nodesConnectable={false} zoomOnScroll={false} panOnScroll={false} zoomOnPinch proOptions={{ hideAttribution: true }} /></div>
      <aside className="domain-insight"><div className="eyebrow">What {audience.label.toLowerCase()} can see now</div><h3>Dependency across the boundary</h3><p><strong>{selected.name}</strong> depends on {selected.dependencies.length ? selected.dependencies.map((id) => capabilities.find((cap) => cap.id === id)?.name).filter(Boolean).join(' and ') : 'no recorded upstream capability'}.</p><div className="map-alert"><WarningCircle size={20} /><div><strong>{selected.owner !== selected.futureOwner ? 'Handoff needs owner' : 'Review responsibility'}</strong><span>{selected.decision}</span><button onClick={onEdit}>Resolve ownership <ArrowRight size={15} /></button></div></div><div className="side-divider" /><h3>Wider scope</h3><p>The map shows how the chosen capability relies on other services and where the appliance boundary sits.</p><div className="map-selected"><span>Selected capability</span><strong>{selected.name}</strong><small>M{state === 'current' ? selected.current : selected.target} · {state === 'current' ? selected.owner : selected.futureOwner} ownership</small></div></aside></div>
    <div className="domain-legend"><span><i className="swatch appliance" /> Appliance</span><span><i className="swatch federated" /> Federated</span><span><i className="swatch planned" /> Planned maturity</span><small>Maturity 8+ continues as the domain evolves.</small></div>
  </section>;
}
