import { ArrowRight } from '@phosphor-icons/react';
import { audienceMembers, unassignedToAudience } from '../domain/selectors';
import { levelLabels, maturityAt, periodLabel } from '../domain/timeline';

const columnCount = (capabilities) => Math.max(9, ...capabilities.map((cap) => cap.levels.length));

export function EmptyProject({ doc, onCreate, onNavigate }) {
  return <div className="empty-state large"><div className="eyebrow">{doc.project.name}</div><h2>This project has no capabilities yet</h2>
    <p>Create a capability, or import a YAML or CSV project. The Matrix, Capability journey and Domain map fill in as you add records.</p>
    <div className="empty-actions"><button type="button" className="primary-action compact" onClick={onCreate}>Create a capability</button><button type="button" className="outline-action compact" onClick={() => onNavigate('projects')}>Import or switch project</button></div></div>;
}

export function MatrixView({ doc, selected, perspective, time, onSelect, onNavigate }) {
  const { audiences, ownerLabels, timeline } = doc.settings;
  const capabilities = doc.capabilities;
  const at = (cap, date) => maturityAt(cap, timeline, date);
  const currentLabel = periodLabel(time.current, timeline.granularity); const focusLabel = periodLabel(time.focus, timeline.granularity);
  const activeAudience = audiences.find((a) => a.id === perspective) || audiences[0];
  const columns = columnCount(capabilities);
  const phases = levelLabels(columns);
  const currentM = at(selected, time.current);
  const focusM = at(selected, time.focus);
  const marker = (value) => `${((Math.min(value, columns - 1) + 0.5) / columns) * 100}%`;
  const byId = new Map(capabilities.map((cap) => [cap.id, cap]));
  const dependencyNames = selected.dependencies.map((id) => byId.get(id)?.name).filter(Boolean);
  const unassigned = unassignedToAudience(doc);
  const lanes = [...audiences.map((audience) => ({ audience, members: audienceMembers(doc, audience.id) })), ...(unassigned.length ? [{ audience: { id: '__unassigned', label: 'Unassigned', description: 'No audience recorded' }, members: unassigned }] : [])];
  return <div className="matrix-layout view-enter"><section className="matrix-surface" aria-label="Capability maturity by audience">
    <div className="section-heading"><div><h2>Capability maturity by audience</h2><p>Compare where capabilities sit and how responsibility changes.</p></div><div className="horizon-note">Higher maturity extends to a wider domain horizon <ArrowRight size={21} /></div></div>
    <div className="matrix-scroll"><div className="matrix-chart"><div className="matrix-corner">Audience</div><div className="phase-head" style={{ gridTemplateColumns: `repeat(${columns},1fr)` }}>{phases.map((label) => <span key={label}>{label}</span>)}</div>
      {lanes.map(({ audience, members }) => {
        // Each member spans from its maturity at the Current date to its planned reach (target or Focus, whichever is higher).
        const bars = members.map((cap) => { const start = at(cap, time.current); return { cap, start, end: Math.max(start + 0.6, Math.max(cap.target, at(cap, time.focus)) + 1) }; });
        const height = Math.max(108, 26 + bars.length * 32);
        return <div className={`matrix-row ${audience.id === perspective ? 'perspective-active' : ''}`} key={audience.id}><div className="row-label" style={{ height }}><strong>{audience.label}</strong><span>{audience.description}</span></div><div className="row-track" style={{ height }}><div className="gridlines" style={{ gridTemplateColumns: `repeat(${columns},1fr)` }}>{phases.map((label) => <span key={label} />)}</div>
          {currentM !== focusM && <div className="phase-line current" style={{ left: marker(currentM) }} />}<div className="phase-line" style={{ left: marker(focusM) }} />
          {bars.length ? bars.map((item, index) => {
            const { cap } = item;
            const start = Math.max(0, Math.min(columns - 0.5, item.start));
            const end = Math.max(start + 0.6, Math.min(columns, item.end));
            return <button key={`${audience.id}-${cap.id}`} className={`capability-bar ${cap.owner} future-${cap.futureOwner} ${cap.id === selected.id ? 'active' : ''}`} style={{ left: `${((start + 0.12) / columns) * 100}%`, width: `${((end - start - 0.12) / columns) * 100}%`, top: `${21 + index * 32}px` }} onClick={() => onSelect(cap.id)} title={`Select ${cap.name}`}><span>{cap.name}</span><i aria-hidden="true" /></button>;
          }) : <span className="row-empty">No capabilities recorded for this audience.</span>}
        </div></div>;
      })}
    </div></div>
    <div className="matrix-legend"><span><i className="swatch appliance" /> {ownerLabels.appliance} ownership</span><span><i className="swatch federated" /> {ownerLabels.federated} ownership</span><span><i className="swatch planned" /> Planned reach</span><span><i className="swatch marker" /> Focus maturity ({focusLabel})</span>{currentM !== focusM && <span><i className="swatch marker-current" /> Current maturity ({currentLabel})</span>}</div>
    <div className="explore-strip"><div><strong>Explore this capability across views</strong><span>{selected.name}, {activeAudience.label.toLowerCase()} perspective and the {currentLabel} to {focusLabel} timeline carry across.</span></div><button onClick={() => onNavigate('journey')}>Capability journey <ArrowRight size={17} /></button><button onClick={() => onNavigate('map')}>Domain map <ArrowRight size={17} /></button></div>
  </section><aside className="insight-panel"><div className="eyebrow">Selected capability</div><h2>{selected.name}</h2><p className="insight-meta">{activeAudience.label} perspective <span>·</span> Maturity M{currentM}{currentM !== focusM ? ` → M${focusM}` : ''}</p><p className="insight-summary">{selected.summary || 'No summary recorded.'}</p>
    <div className="insight-section"><h3>What this perspective needs</h3><p>{activeAudience.need || 'No need recorded for this perspective.'}</p></div><div className="insight-section"><h3>Dependencies</h3><p>{dependencyNames.length ? dependencyNames.join(' and ') : 'No upstream dependencies recorded.'}</p></div><div className="insight-section"><h3>Ownership decision</h3><p>{selected.decision || 'No decision recorded.'}</p></div>
    <button className="primary-action" onClick={() => onNavigate('map')}>Review handoff <ArrowRight size={18} /></button>
    <div className="mini-progress"><div className="progress-head"><span>{currentLabel} M{currentM}</span><span>{focusLabel} M{focusM}</span></div><div className="progress-line"><i style={{ left: `${(Math.min(currentM, columns - 1) / (columns - 1)) * 100}%` }} /><i className="target" style={{ left: `${(Math.min(focusM, columns - 1) / (columns - 1)) * 100}%` }} /></div><div className="progress-labels">{phases.map((p) => <span key={p}>{p}</span>)}</div><small>{columns - 1}+ is an evolving wider-domain horizon. Plan target: M{selected.target}.</small></div>
  </aside></div>;
}
