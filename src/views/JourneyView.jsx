import { useState } from 'react';
import { ArrowRight, FolderSimple, PencilSimple } from '@phosphor-icons/react';
import { definitionFields } from '../domain/defaults';
import { guidanceFor, journeySections } from '../domain/selectors';
import { levelLabels, maturityAt, ownerAt, periodLabel } from '../domain/timeline';

export function JourneyView({ doc, selected, perspective, time, onNavigate, onUpdate, openTray }) {
  const { audiences, ownerLabels, timeline } = doc.settings;
  const at = (date) => maturityAt(selected, timeline, date);
  const currentLabel = periodLabel(time.current, timeline.granularity); const focusLabel = periodLabel(time.focus, timeline.granularity);
  const audience = audiences.find((a) => a.id === perspective) || audiences[0];
  const byId = new Map(doc.capabilities.map((cap) => [cap.id, cap]));
  const [inspected, setInspected] = useState(null);
  const { levels } = selected;
  const phases = levelLabels(levels.length);
  const currentM = at(time.current);
  const focusM = at(time.focus);
  const ownerNow = ownerAt(selected, timeline, time.current);
  const ownerFocus = ownerAt(selected, timeline, time.focus);
  const transition = selected.owner !== selected.futureOwner;
  const inspect = inspected !== null && levels[inspected] ? inspected : null;
  const sections = journeySections(doc);
  const visible = (id) => sections.find((s) => s.id === id)?.visible !== false;
  const label = (id) => sections.find((s) => s.id === id)?.label;
  const definitionSections = sections.filter((s) => definitionFields.includes(s.id) && s.visible);
  const setMaturity = (field, value) => onUpdate({ ...selected, [field]: value, ...(field === 'current' && selected.target < value ? { target: value } : {}), ...(field === 'target' && selected.current > value ? { current: value } : {}) });
  const capIndex = doc.capabilities.indexOf(selected);

  return <section className="journey-view view-enter"><div className="journey-intro"><div><div className="eyebrow">Capability journey</div><h2>{selected.name}</h2><p>{selected.summary || 'No summary recorded.'}</p></div><div className="journey-thesis"><h3>{transition ? `From ${ownerLabels[selected.owner].toLowerCase()} delivery to ${ownerLabels[selected.futureOwner].toLowerCase()} handoff` : 'A capability with a clear ownership path'}</h3><p>{selected.decision || 'No scope decision recorded.'}</p></div></div>
    <div className="journey-overline"><span>Early exploration</span><span>Product capability</span><span>Wider-domain solution</span></div><div className="stage-notes" style={{ gridTemplateColumns: `repeat(${levels.length},minmax(0,1fr))` }}>{levels.map((level) => <span key={level.id}>{level.description}</span>)}</div>
    <div className="journey-track" style={{ gridTemplateColumns: `repeat(${levels.length},1fr)` }}>{phases.map((phase, index) => <div key={levels[index].id} role="button" tabIndex={0} aria-pressed={index === inspect} onClick={() => setInspected(index === inspect ? null : index)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setInspected(index === inspect ? null : index); } }} className={`journey-phase ${index === currentM ? 'current' : ''} ${index === focusM ? 'target viewed' : ''} ${index === inspect ? 'inspected' : ''}`}><span className="phase-title">{index === currentM ? 'CURRENT' : index === focusM ? 'FOCUS' : index === selected.target ? 'TARGET' : ' '}</span><span className="phase-dot">{phase}</span><span className="phase-caption">{levels[index].name}</span></div>)}</div>
    {inspect !== null ? <div className="level-card"><div><strong>M{phases[inspect]} · {levels[inspect].name}</strong><span>{levels[inspect].description || 'No description yet.'}</span>
      {visible('stageCriteria') && <dl className="level-criteria"><dt>Outcomes</dt><dd>{levels[inspect].outcomes || <span className="muted">Not recorded</span>}</dd><dt>Evidence / exit criteria</dt><dd>{levels[inspect].exitCriteria || <span className="muted">Not recorded</span>}</dd></dl>}</div>
      <div className="level-card-actions"><button className="outline-action" onClick={() => setMaturity('current', inspect)} disabled={selected.current === inspect}>Set as current</button><button className="outline-action" onClick={() => setMaturity('target', inspect)} disabled={selected.target === inspect}>Set as target</button><button className="outline-action" onClick={() => openTray({ type: 'level', capabilityId: selected.id, id: levels[inspect].id })}><PencilSimple size={14} /> Edit level</button></div></div>
      : <p className="level-hint">Select a maturity level to read it or to set it as the current maturity or the target.</p>}
    <div className="journey-detail-grid"><div className="journey-main"><div className="owner-ribbon"><div className={`owner-segment ${ownerNow}`}>{ownerLabels[ownerNow]} scope <span>M{currentM} · {currentLabel}</span></div><div className={`owner-segment ${ownerFocus}`}>{ownerLabels[ownerFocus]} scope <span>M{focusM} · {focusLabel}</span></div></div>
      {definitionSections.length > 0 && <div className="definition-grid">{definitionSections.map((section) => <div className="definition-item" key={section.id}><h4>{section.label}</h4>{selected.definition[section.id]?.trim() ? <p>{selected.definition[section.id]}</p> : <button type="button" className="empty-field" onClick={() => openTray({ type: 'capability', id: selected.id, focusPath: `capabilities.${capIndex}.definition.${section.id}` })}>Not recorded yet. Add it</button>}</div>)}</div>}
      <div className="journey-deps"><div className="journey-deps-head"><h3>Key dependencies</h3><button className="text-action" onClick={() => openTray({ type: 'dependencies', id: selected.id })}><PencilSimple size={16} /> Manage dependencies</button></div>{selected.dependencies.length ? selected.dependencies.map((id) => byId.get(id)).filter(Boolean).map((dep) => <button className="dependency-row" key={dep.id} onClick={() => onNavigate('map')}><FolderSimple size={23} /><span><strong>{dep.name}</strong><small>{dep.summary}</small></span><ArrowRight size={17} /></button>) : <p>No dependencies recorded yet. Use Manage dependencies to add one.</p>}</div>
      {visible('audienceGuidance') && <div className="audience-impact"><h3>{label('audienceGuidance')}</h3>{audiences.map((item) => {
        const entries = levels.map((level, rank) => ({ level, rank, guidance: guidanceFor(doc, selected, item.id, level.id) })).filter((e) => e.guidance);
        return <div className={`impact-lane ${item.id === perspective ? 'active' : ''}`} key={item.id} style={{ gridTemplateColumns: `116px repeat(${Math.max(entries.length, 1)},minmax(0,1fr))` }}><strong>{item.label}</strong>
          {entries.length ? entries.map(({ level, rank, guidance }) => <span key={level.id}><em className="stage-tag">M{rank} {level.name}{guidance.source === 'default' ? ' · default' : ''}</em>{guidance.text}</span>) : <span className="muted">No guidance recorded for this audience.</span>}</div>;
      })}</div>}
    </div><aside className="journey-side"><div className="eyebrow">{audience.label} lens</div><h3>Scope decision</h3><p>{selected.decision || 'No scope decision recorded.'}</p><div className="side-divider" /><h4>Maturity levels</h4><p>{levels.length} levels defined. Target is M{selected.target}.</p><button className="outline-action" onClick={() => openTray({ type: 'levels', id: selected.id })}>Define maturity levels <PencilSimple size={16} /></button><div className="side-divider" /><h4>Content provenance</h4><p>YAML capability record → proposed DITA mapping → embedded help and PDF manual (future CCMS integrations).</p><button className="outline-action" onClick={() => onNavigate('matrix')}>Compare perspectives <ArrowRight size={17} /></button></aside></div>
  </section>;
}
