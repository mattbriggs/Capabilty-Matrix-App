import { useState } from 'react';
import { ArrowDown, ArrowRight, ArrowUp, FolderSimple, Info, PencilSimple, Plus, Trash } from '@phosphor-icons/react';
import { DraftSummary, Field, FieldIssues, Panel } from '../../../components/Panel';
import { useDraft } from '../../../components/useDraft';
import { domainPalette } from '../../../domain/defaults';
import { uniqueId } from '../../../domain/ids';
import {
  applyLevels, capabilityIndex, findCapability, newAudience, newDomain, setGuidance, timelineImpact,
  updateCapability, upsertAudience, upsertDomain, upsertSegmentOverride,
} from '../../../domain/operations';
import { journeySections, knownLevels } from '../../../domain/selectors';
import { granularities, horizonDate, periodStarts, timelinePeriods } from '../../../domain/timeline';
import { ApplyBar, ReadOnlyId, useDeletion, useTray } from './common';

const prefixed = (issues, prefix) => issues.filter((issue) => issue.path === prefix || issue.path.startsWith(`${prefix}.`));

// ---------- Maturity levels (ordered list, by ID) ----------
const applyLevelRows = (doc, d) => updateCapability(doc, applyLevels(findCapability(doc, d.capabilityId), d.rows, d.remap));

export function LevelsTray({ doc, ctx, onCommit, onClose, confirm }) {
  const cap = findCapability(doc, ctx.id);
  const { draft, setDraft, candidate, issues, dirty, errors } = useDraft(doc, { capabilityId: cap.id, rows: cap.levels.map((l) => ({ ...l })), remap: {} }, applyLevelRows);
  const tray = useTray({ key: 'tray', label: `${cap.name} levels`, dirty, errors, candidate, message: 'Maturity levels updated.', onCommit, onClose, confirm });
  const rows = draft.rows;
  const setRows = (next) => setDraft((old) => ({ ...old, rows: typeof next === 'function' ? next(old.rows) : next }));
  const setRow = (i, patch) => setRows((old) => old.map((row, j) => (j === i ? { ...row, ...patch } : row)));
  const move = (i, by) => setRows((old) => { const next = [...old]; const [row] = next.splice(i, 1); next.splice(i + by, 0, row); return next; });
  const removeRow = (i) => setDraft((old) => {
    const removed = old.rows[i];
    const neighbor = old.rows[i - 1] || old.rows[i + 1];
    const remap = cap.levels.some((l) => l.id === removed.id) ? { ...old.remap, [removed.id]: neighbor?.id } : old.remap;
    return { ...old, rows: old.rows.filter((_, j) => j !== i), remap };
  });
  const removed = Object.keys(draft.remap).filter((id) => !rows.some((r) => r.id === id));
  const after = candidate ? findCapability(candidate, cap.id) : null;
  const name = (list, rank) => (list[rank] ? `M${rank} ${list[rank].name}` : `M${rank}`);
  const effects = after ? [
    cap.current !== after.current || cap.levels[cap.current]?.id !== after.levels[after.current]?.id ? `Current: ${name(cap.levels, cap.current)} → ${name(after.levels, after.current)}` : null,
    cap.target !== after.target || cap.levels[cap.target]?.id !== after.levels[after.target]?.id ? `Target: ${name(cap.levels, cap.target)} → ${name(after.levels, after.target)}` : null,
    ...cap.milestones.map((m, i) => (m.maturity !== after.milestones[i]?.maturity ? `Milestone ${m.date}: ${name(cap.levels, m.maturity)} → ${name(after.levels, after.milestones[i].maturity)}` : null)),
  ].filter(Boolean) : [];
  const base = `capabilities.${candidate ? capabilityIndex(candidate, cap.id) : 0}`;
  return <Panel title="Maturity levels" eyebrow={cap.name} onClose={onClose} onSubmit={tray.submit} dirty={dirty} onDiscardRequest={tray.requestClose}>
    <p>Add, rename, reorder or remove levels. Each level keeps a stable ID; current, target, milestones and guidance follow their level when it moves. The last level is the open-ended wider-domain horizon.</p>
    {rows.map((row, i) => <fieldset className="level-row" key={row.id}><legend>M{i}{i === rows.length - 1 ? '+' : ''} <code>{row.id}</code></legend>
      <Field label="Name" path={`${base}.levels.${i}.name`} issues={issues}>{(a) => <input {...a} value={row.name} onChange={(e) => setRow(i, { name: e.target.value })} />}</Field>
      <label>Description<textarea rows="2" value={row.description} onChange={(e) => setRow(i, { description: e.target.value })} /></label>
      <div className="row-actions"><button type="button" className="icon-button" aria-label={`Move ${row.name} up`} disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp size={18} /></button><button type="button" className="icon-button" aria-label={`Move ${row.name} down`} disabled={i === rows.length - 1} onClick={() => move(i, 1)}><ArrowDown size={18} /></button><button type="button" className="icon-button" aria-label={`Delete ${row.name}`} disabled={rows.length <= 2} onClick={() => removeRow(i)}><Trash size={18} /></button></div>
    </fieldset>)}
    <button type="button" className="text-action" disabled={rows.length >= 20} onClick={() => setRows((old) => [...old, { id: uniqueId(`level ${old.length}`, old.map((r) => r.id), 'level'), name: `Level ${old.length}`, description: '', outcomes: '', exitCriteria: '' }])}><Plus size={16} /> Add level</button>
    {removed.length > 0 && <fieldset><legend>Removed levels</legend>{removed.map((id) => <label key={id}>References to “{cap.levels.find((l) => l.id === id)?.name}” move to<select value={draft.remap[id] || ''} onChange={(e) => setDraft((old) => ({ ...old, remap: { ...old.remap, [id]: e.target.value } }))}>{rows.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>)}</fieldset>}
    {effects.length > 0 && <div className="effects-preview" role="status"><strong>Effect on recorded maturity</strong><ul>{effects.map((e) => <li key={e}>{e}</li>)}</ul></div>}
    <DraftSummary issues={[...prefixed(issues, base), ...tray.serverIssues]} />
    <ApplyBar errors={errors} busy={tray.busy} label="Save levels" />
  </Panel>;
}

// ---------- One maturity level ----------
function applyLevel(doc, d) {
  const cap = findCapability(doc, d.capabilityId);
  let guidance = cap.journey.guidance;
  Object.entries(d.guidance).forEach(([audienceId, text]) => { guidance = setGuidance(guidance, audienceId, d.level.id, text); });
  return updateCapability(doc, { ...cap, levels: cap.levels.map((l) => (l.id === d.level.id ? d.level : l)), journey: { ...cap.journey, guidance } });
}

export function LevelTray({ doc, ctx, onCommit, onClose, confirm, confirmDelete, focusPath }) {
  const cap = findCapability(doc, ctx.capabilityId);
  const rank = cap.levels.findIndex((l) => l.id === ctx.id);
  const level = cap.levels[rank];
  const initialGuidance = Object.fromEntries(doc.settings.audiences.map((a) => [a.id, cap.journey.guidance.find((g) => g.audienceId === a.id && g.levelId === level.id)?.text || '']));
  const { draft, setDraft, candidate, issues, dirty, errors } = useDraft(doc, { capabilityId: cap.id, level: { ...level }, guidance: initialGuidance }, applyLevel);
  const tray = useTray({ key: 'tray', label: `${level.name} level`, dirty, errors, candidate, message: 'Maturity level updated.', onCommit, onClose, confirm });
  const remove = useDeletion({ doc, onCommit, confirmDelete, onDone: onClose });
  const base = `capabilities.${capabilityIndex(doc, cap.id)}.levels.${rank}`;
  const set = (patch) => setDraft((old) => ({ ...old, level: { ...old.level, ...patch } }));
  const fallback = (audienceId) => doc.presentation.defaultGuidance.find((g) => g.audienceId === audienceId && g.levelId === level.id)?.text;
  return <Panel title={`M${rank} · ${draft.level.name}`} eyebrow={`${cap.name} maturity level`} onClose={onClose} onSubmit={tray.submit} dirty={dirty} onDiscardRequest={tray.requestClose} focusPath={focusPath}>
    <ReadOnlyId value={level.id} />
    <Field label="Name" path={`${base}.name`} issues={issues}>{(a) => <input {...a} value={draft.level.name} onChange={(e) => set({ name: e.target.value })} />}</Field>
    <Field label="Description" path={`${base}.description`} issues={issues}>{(a) => <textarea {...a} rows="2" value={draft.level.description} onChange={(e) => set({ description: e.target.value })} />}</Field>
    <Field label="Outcomes at this stage" path={`${base}.outcomes`} issues={issues}>{(a) => <textarea {...a} rows="2" value={draft.level.outcomes} onChange={(e) => set({ outcomes: e.target.value })} />}</Field>
    <Field label="Evidence and exit criteria" path={`${base}.exitCriteria`} issues={issues}>{(a) => <textarea {...a} rows="2" value={draft.level.exitCriteria} onChange={(e) => set({ exitCriteria: e.target.value })} />}</Field>
    <fieldset><legend>Audience guidance at this stage</legend>
      {doc.settings.audiences.map((a) => <label key={a.id}>{a.label}<textarea rows="2" value={draft.guidance[a.id]} placeholder={fallback(a.id) ? `Default: ${fallback(a.id)}` : 'No guidance recorded.'} onChange={(e) => setDraft((old) => ({ ...old, guidance: { ...old.guidance, [a.id]: e.target.value } }))} /></label>)}
    </fieldset>
    <DraftSummary issues={[...prefixed(issues, `capabilities.${capabilityIndex(doc, cap.id)}`), ...tray.serverIssues]} />
    <ApplyBar errors={errors} busy={tray.busy} onDelete={cap.levels.length > 2 ? () => remove({ type: 'level', capabilityId: cap.id, id: level.id }, `level ${level.name}`, cap.levels.filter((l) => l.id !== level.id).map((l) => ({ id: l.id, label: l.name }))) : null} deleteLabel="Delete level" />
  </Panel>;
}

// ---------- Dependencies ----------
const applyDeps = (doc, d) => updateCapability(doc, { ...findCapability(doc, d.capabilityId), dependencies: d.deps });
export function DependenciesTray({ doc, ctx, onCommit, onClose, confirm }) {
  const cap = findCapability(doc, ctx.id);
  const { draft, setDraft, candidate, issues, dirty, errors } = useDraft(doc, { capabilityId: cap.id, deps: cap.dependencies }, applyDeps);
  const tray = useTray({ key: 'tray', label: `${cap.name} dependencies`, dirty, errors, candidate, message: 'Dependencies updated.', onCommit, onClose, confirm });
  const byId = Object.fromEntries(doc.capabilities.map((c) => [c.id, c]));
  const available = doc.capabilities.filter((c) => c.id !== cap.id && !draft.deps.includes(c.id));
  const [pick, setPick] = useState('');
  const choice = available.some((c) => c.id === pick) ? pick : available[0]?.id || '';
  const cycleWarnings = issues.filter((i) => i.code === 'dependency.cycle');
  return <Panel title="Dependencies" eyebrow={cap.name} onClose={onClose} onSubmit={tray.submit} dirty={dirty} onDiscardRequest={tray.requestClose}>
    <p>Capabilities that {cap.name} relies on. They appear in the journey and as links on the domain map.</p>
    {draft.deps.length ? draft.deps.map((id) => <div className="dependency-edit" key={id}><FolderSimple size={20} /><span><strong>{byId[id]?.name || id}</strong><small>{byId[id]?.summary || 'Capability not found.'}</small></span><button type="button" className="icon-button" aria-label={`Remove ${byId[id]?.name || id}`} onClick={() => setDraft((old) => ({ ...old, deps: old.deps.filter((d) => d !== id) }))}><Trash size={18} /></button></div>) : <p>No dependencies recorded.</p>}
    <div className="add-row"><select aria-label="Dependency to add" value={choice} onChange={(e) => setPick(e.target.value)} disabled={!available.length}>{available.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select><button type="button" className="text-action" disabled={!choice} onClick={() => setDraft((old) => ({ ...old, deps: [...old.deps, choice] }))}><Plus size={16} /> Add</button></div>
    <FieldIssues issues={cycleWarnings} />
    <DraftSummary issues={[...issues, ...tray.serverIssues]} />
    <ApplyBar errors={errors} busy={tray.busy} label="Save dependencies" />
  </Panel>;
}

// ---------- Audience ----------
function applyAudience(doc, d) {
  let next = upsertAudience(doc, d.audience);
  let defaults = next.presentation.defaultGuidance;
  Object.entries(d.defaults).forEach(([levelId, text]) => { defaults = setGuidance(defaults, d.audience.id, levelId, text); });
  next = { ...next, presentation: { ...next.presentation, defaultGuidance: defaults } };
  return { ...next, capabilities: next.capabilities.map((cap) => {
    const member = d.members.includes(cap.id); const has = cap.audienceIds.includes(d.audience.id);
    if (member === has) return cap;
    return { ...cap, audienceIds: member ? [...cap.audienceIds, d.audience.id] : cap.audienceIds.filter((id) => id !== d.audience.id) };
  }) };
}

export function AudienceTray({ doc, ctx, onCommit, onClose, confirm, confirmDelete, focusPath }) {
  const isNew = !ctx.id;
  const audience = isNew ? newAudience(doc) : doc.settings.audiences.find((a) => a.id === ctx.id);
  const levels = knownLevels(doc);
  const defaults = Object.fromEntries(levels.map((l) => [l.id, doc.presentation.defaultGuidance.find((g) => g.audienceId === audience.id && g.levelId === l.id)?.text || '']));
  const { draft, setDraft, candidate, issues, dirty, errors } = useDraft(doc, { audience: { ...audience }, defaults, members: doc.capabilities.filter((c) => c.audienceIds.includes(audience.id)).map((c) => c.id) }, applyAudience);
  const tray = useTray({ key: 'tray', label: draft.audience.label || 'This audience', dirty, errors, candidate, message: isNew ? 'Audience added.' : 'Audience updated.', onCommit, onClose, confirm });
  const remove = useDeletion({ doc, onCommit, confirmDelete, onDone: onClose });
  const index = candidate ? candidate.settings.audiences.findIndex((a) => a.id === draft.audience.id) : 0;
  const base = `settings.audiences.${index}`;
  const set = (patch) => setDraft((old) => ({ ...old, audience: { ...old.audience, ...patch } }));
  const others = doc.settings.audiences.filter((a) => a.id !== audience.id);
  return <Panel title={isNew ? 'New audience' : draft.audience.label || 'Audience'} eyebrow="Audience perspective" onClose={onClose} onSubmit={tray.submit} dirty={dirty} onDiscardRequest={tray.requestClose} focusPath={focusPath}>
    <ReadOnlyId value={draft.audience.id} />
    <Field label="Name" path={`${base}.label`} issues={issues}>{(a) => <input {...a} value={draft.audience.label} onChange={(e) => set({ label: e.target.value, ...(isNew ? { id: uniqueId(e.target.value, doc.settings.audiences.map((x) => x.id), 'audience') } : {}) })} />}</Field>
    <Field label="Role" path={`${base}.description`} issues={issues}>{(a) => <input {...a} value={draft.audience.description} onChange={(e) => set({ description: e.target.value })} />}</Field>
    <Field label="What this perspective needs" path={`${base}.need`} issues={issues}>{(a) => <textarea {...a} rows="2" value={draft.audience.need} onChange={(e) => set({ need: e.target.value })} />}</Field>
    <fieldset><legend>Member capabilities</legend>{doc.capabilities.length ? doc.capabilities.map((cap) => <label className="checkbox-row" key={cap.id}><input type="checkbox" checked={draft.members.includes(cap.id)} onChange={(e) => setDraft((old) => ({ ...old, members: e.target.checked ? [...old.members, cap.id] : old.members.filter((id) => id !== cap.id) }))} />{cap.name}</label>) : <p>No capabilities yet.</p>}</fieldset>
    <fieldset><legend>Default guidance by stage</legend><p>Shown in the journey for any capability with a level of this ID, unless the capability records its own guidance.</p>
      {levels.length ? levels.map((l) => <label key={l.id}>{l.name} <code>{l.id}</code><textarea rows="2" value={draft.defaults[l.id]} onChange={(e) => setDraft((old) => ({ ...old, defaults: { ...old.defaults, [l.id]: e.target.value } }))} /></label>) : <p>Add a capability to define stages.</p>}
    </fieldset>
    <DraftSummary issues={[...issues, ...tray.serverIssues]} />
    <ApplyBar errors={errors} busy={tray.busy} label={isNew ? 'Add audience' : 'Apply changes'} onDelete={!isNew && others.length ? () => remove({ type: 'audience', id: audience.id }, audience.label, others.map((a) => ({ id: a.id, label: a.label }))) : null} deleteLabel="Delete audience" />
  </Panel>;
}

// ---------- Domain ----------
function applyDomain(doc, d) {
  const next = upsertDomain(doc, d.domain);
  return { ...next, capabilities: next.capabilities.map((cap) => {
    if (d.members.includes(cap.id)) return cap.domainId === d.domain.id ? cap : { ...cap, domainId: d.domain.id };
    return cap.domainId === d.domain.id ? { ...cap, domainId: null } : cap;
  }) };
}

export function DomainTray({ doc, ctx, onCommit, onClose, confirm, confirmDelete, focusPath }) {
  const isNew = !ctx.id;
  const domain = isNew ? newDomain(doc, 'New domain', domainPalette[doc.domains.length % domainPalette.length]) : doc.domains.find((d) => d.id === ctx.id);
  const { draft, setDraft, candidate, issues, dirty, errors } = useDraft(doc, { domain: { ...domain }, members: doc.capabilities.filter((c) => c.domainId === domain.id).map((c) => c.id) }, applyDomain);
  const tray = useTray({ key: 'tray', label: draft.domain.name || 'This domain', dirty, errors, candidate, message: isNew ? 'Domain added.' : 'Domain updated.', onCommit, onClose, confirm });
  const remove = useDeletion({ doc, onCommit, confirmDelete, onDone: onClose });
  const index = candidate ? candidate.domains.findIndex((x) => x.id === draft.domain.id) : 0;
  const base = `domains.${index}`;
  const set = (patch) => setDraft((old) => ({ ...old, domain: { ...old.domain, ...patch } }));
  const moving = draft.members.filter((id) => { const cap = findCapability(doc, id); return cap.domainId && cap.domainId !== draft.domain.id; });
  return <Panel title={isNew ? 'New domain' : draft.domain.name || 'Domain'} eyebrow="Domain" onClose={onClose} onSubmit={tray.submit} dirty={dirty} onDiscardRequest={tray.requestClose} focusPath={focusPath}>
    <p>A domain groups capabilities on the map. It is separate from ownership; a domain can span both owners.</p>
    <ReadOnlyId value={draft.domain.id} />
    <Field label="Name" path={`${base}.name`} issues={issues}>{(a) => <input {...a} value={draft.domain.name} onChange={(e) => set({ name: e.target.value, ...(isNew ? { id: uniqueId(e.target.value, doc.domains.map((x) => x.id), 'domain') } : {}) })} />}</Field>
    <Field label="Description" path={`${base}.description`} issues={issues}>{(a) => <textarea {...a} rows="2" value={draft.domain.description} onChange={(e) => set({ description: e.target.value })} />}</Field>
    <div className="swatch-picker" role="radiogroup" aria-label="Region colour">{domainPalette.map((color) => <button key={color} type="button" role="radio" aria-checked={draft.domain.color === color} aria-label={`Colour ${color}`} className={draft.domain.color === color ? 'selected' : ''} style={{ background: color }} onClick={() => set({ color })} />)}</div>
    <fieldset><legend>Member capabilities</legend><p>A capability belongs to at most one domain.</p>{doc.capabilities.length ? doc.capabilities.map((cap) => <label className="checkbox-row" key={cap.id}><input type="checkbox" checked={draft.members.includes(cap.id)} onChange={(e) => setDraft((old) => ({ ...old, members: e.target.checked ? [...old.members, cap.id] : old.members.filter((id) => id !== cap.id) }))} />{cap.name}{cap.domainId && cap.domainId !== domain.id && <small className="muted"> (now in {doc.domains.find((d) => d.id === cap.domainId)?.name})</small>}</label>) : <p>No capabilities yet.</p>}</fieldset>
    {moving.length > 0 && <p className="effects-preview" role="status">{moving.length} capabilit{moving.length === 1 ? 'y moves' : 'ies move'} out of another domain.</p>}
    <DraftSummary issues={[...issues, ...tray.serverIssues]} />
    <ApplyBar errors={errors} busy={tray.busy} label={isNew ? 'Add domain' : 'Apply changes'} onDelete={isNew ? null : () => remove({ type: 'domain', id: domain.id }, domain.name, doc.domains.filter((d) => d.id !== domain.id).map((d) => ({ id: d.id, label: d.name })))} deleteLabel="Delete domain" />
  </Panel>;
}

// ---------- Time segment (label/notes only; structure follows the timeline) ----------
const applySegment = (doc, d) => upsertSegmentOverride(doc, d);
export function TimeSegmentTray({ doc, ctx, onCommit, onClose, confirm, openTray, focusPath }) {
  const period = timelinePeriods(doc.settings.timeline, doc.timeSegments).find((p) => p.date === ctx.id);
  const existing = doc.timeSegments.find((s) => s.date === ctx.id);
  const { draft, setDraft, candidate, issues, dirty, errors } = useDraft(doc, { date: ctx.id, label: existing?.label || '', description: existing?.description || '' }, applySegment);
  const tray = useTray({ key: 'tray', label: `Segment ${ctx.id}`, dirty, errors, candidate, message: 'Time segment updated.', onCommit, onClose, confirm });
  const periods = timelinePeriods(doc.settings.timeline);
  const nextStart = periods[periods.findIndex((p) => p.date === ctx.id) + 1]?.date;
  const inSegment = doc.capabilities.flatMap((cap) => cap.milestones.filter((m) => m.date >= ctx.id && (!nextStart || m.date < nextStart)).map((m) => ({ cap, m })));
  return <Panel title={period?.label || ctx.id} eyebrow="Time segment" onClose={onClose} onSubmit={tray.submit} dirty={dirty} onDiscardRequest={tray.requestClose} focusPath={focusPath}>
    <p>Segments are generated from the timeline and identified by their start date ({ctx.id}). You can relabel and annotate them; overrides survive granularity changes.</p>
    <Field label="Label" path="timeSegments" issues={[]} hint={`Generated label: ${period?.generatedLabel || ctx.id}. Leave blank to use it.`}>{(a) => <input {...a} value={draft.label} placeholder={period?.generatedLabel} onChange={(e) => setDraft((old) => ({ ...old, label: e.target.value }))} />}</Field>
    <label>Notes<textarea rows="3" value={draft.description} onChange={(e) => setDraft((old) => ({ ...old, description: e.target.value }))} /></label>
    <fieldset><legend>Milestones in this segment</legend>{inSegment.length ? inSegment.map(({ cap, m }) => <button type="button" className="dependency-row" key={`${cap.id}-${m.date}`} onClick={() => openTray({ type: 'capability', id: cap.id, focusPath: `capabilities.${capabilityIndex(doc, cap.id)}.milestones.${cap.milestones.indexOf(m)}.date` })}><span><strong>{cap.name}</strong><small>{m.date} · M{m.maturity}{m.note ? ` · ${m.note}` : ''}</small></span><ArrowRight size={16} /></button>) : <p>No milestones recorded in this segment.</p>}</fieldset>
    <button type="button" className="text-action" onClick={() => openTray({ type: 'timeline' })}><PencilSimple size={16} /> Edit timeline structure (dates, count, granularity)…</button>
    <DraftSummary issues={[...issues, ...tray.serverIssues]} />
    <ApplyBar errors={errors} busy={tray.busy} />
  </Panel>;
}

// ---------- Timeline structure ----------
function applyTimeline(doc, d) {
  const { removeOutside, ...timeline } = d;
  const next = { ...doc, settings: { ...doc.settings, timeline } };
  if (!removeOutside) return next;
  const dates = periodStarts(timeline.granularity, timeline.start, timeline.periods);
  const ok = (date) => date >= dates[0] && date <= dates.at(-1) && date !== timeline.asOf && date !== dates.at(-1);
  return { ...next, capabilities: next.capabilities.map((cap) => ({ ...cap, milestones: cap.milestones.filter((m) => ok(m.date)) })) };
}

export function TimelineTray({ doc, onCommit, onClose, confirm, focusPath }) {
  const { draft, setDraft, candidate, issues, dirty, errors } = useDraft(doc, { ...doc.settings.timeline, removeOutside: false }, applyTimeline);
  const tray = useTray({ key: 'tray', label: 'The timeline', dirty, errors, candidate, message: 'Timeline updated.', onCommit, onClose, confirm });
  const set = (patch) => setDraft((old) => ({ ...old, ...patch }));
  const { removeOutside, ...nextTimeline } = draft;
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(nextTimeline.start) && nextTimeline.periods >= 2 && nextTimeline.periods <= 60;
  const impact = valid ? timelineImpact(doc, nextTimeline, periodStarts) : [];
  const periods = valid ? timelinePeriods(nextTimeline) : [];
  return <Panel title="Timeline" eyebrow="Time segments" onClose={onClose} onSubmit={tray.submit} dirty={dirty} onDiscardRequest={tray.requestClose} focusPath={focusPath}>
    <p>Current maturity is anchored at the “as of” period and target maturity at the last period. Selectors for Current and Focus inspect dates; they never move these anchors.</p>
    <div className="form-pair">
      <Field label="Granularity" path="settings.timeline.granularity" issues={issues}>{(a) => <select {...a} value={draft.granularity} onChange={(e) => set({ granularity: e.target.value })}>{granularities.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}</select>}</Field>
      <Field label="Number of periods" path="settings.timeline.periods" issues={issues}>{(a) => <input {...a} type="number" min="2" max="60" step="1" value={draft.periods} onChange={(e) => set({ periods: Number.parseInt(e.target.value, 10) || 0 })} />}</Field>
    </div>
    <div className="form-pair">
      <Field label="Start date" path="settings.timeline.start" issues={issues}>{(a) => <input {...a} type="date" value={draft.start} onChange={(e) => e.target.value && set({ start: e.target.value })} />}</Field>
      <Field label="Current maturity applies at" path="settings.timeline.asOf" issues={issues}>{(a) => <select {...a} value={draft.asOf} onChange={(e) => set({ asOf: e.target.value })}>{!periods.some((p) => p.date === draft.asOf) && <option value={draft.asOf}>{draft.asOf} (outside)</option>}{periods.map((p) => <option key={p.date} value={p.date}>{p.label}</option>)}</select>}</Field>
    </div>
    {valid && <p>Range: {periods[0]?.label} to {periods.at(-1)?.label} (target anchored at {horizonDate(nextTimeline)}).</p>}
    {dirty && impact.length > 0 && <div className="effects-preview" role="status"><strong>Impact preview</strong><ul>{impact.map((ref, i) => <li key={i}><strong>{ref.label}</strong> {ref.detail}</li>)}</ul>
      <label className="checkbox-row"><input type="checkbox" checked={removeOutside} onChange={(e) => set({ removeOutside: e.target.checked })} /> Remove milestones that fall outside the new timeline or on its anchors</label></div>}
    <DraftSummary issues={[...issues, ...tray.serverIssues]} />
    <ApplyBar errors={errors} busy={tray.busy} label="Apply timeline" />
  </Panel>;
}

// ---------- Settings: owner names, perspectives, journey sections ----------
const applySettings = (doc, d) => ({ ...doc, settings: { ...doc.settings, ownerLabels: d.ownerLabels }, presentation: { ...doc.presentation, journeySections: d.sections } });
export function SettingsTray({ doc, onCommit, onClose, confirm, openTray, focusPath }) {
  const { draft, setDraft, candidate, issues, dirty, errors } = useDraft(doc, { ownerLabels: { ...doc.settings.ownerLabels }, sections: journeySections(doc).map((s) => ({ ...s })) }, applySettings);
  const tray = useTray({ key: 'tray', label: 'Settings', dirty, errors, candidate, message: 'Settings updated.', onCommit, onClose, confirm });
  const setSection = (i, patch) => setDraft((old) => ({ ...old, sections: old.sections.map((s, j) => (j === i ? { ...s, ...patch } : s)) }));
  const moveSection = (i, by) => setDraft((old) => { const next = [...old.sections]; const [row] = next.splice(i, 1); next.splice(i + by, 0, row); return { ...old, sections: next }; });
  return <Panel title="Settings" eyebrow="Names, perspectives and presentation" onClose={onClose} onSubmit={tray.submit} dirty={dirty} onDiscardRequest={tray.requestClose} focusPath={focusPath} wide>
    <fieldset><legend>Owner names</legend><p>These names replace “Appliance” and “Federated” in every view. Owner IDs stay appliance and federated.</p>
      <div className="form-pair">
        <Field label="Product-side owner" path="settings.ownerLabels.appliance" issues={issues}>{(a) => <input {...a} value={draft.ownerLabels.appliance} onChange={(e) => setDraft((old) => ({ ...old, ownerLabels: { ...old.ownerLabels, appliance: e.target.value } }))} />}</Field>
        <Field label="Wider-environment owner" path="settings.ownerLabels.federated" issues={issues}>{(a) => <input {...a} value={draft.ownerLabels.federated} onChange={(e) => setDraft((old) => ({ ...old, ownerLabels: { ...old.ownerLabels, federated: e.target.value } }))} />}</Field>
      </div></fieldset>
    <fieldset><legend>Perspectives</legend>
      {doc.settings.audiences.map((a) => <div className="settings-row" key={a.id}><span><strong>{a.label}</strong><small>{a.description}</small></span><button type="button" className="text-action" onClick={() => openTray({ type: 'audience', id: a.id })}><PencilSimple size={15} /> Edit</button></div>)}
      <button type="button" className="text-action" onClick={() => openTray({ type: 'audience' })}><Plus size={16} /> Add perspective</button></fieldset>
    <fieldset><legend>Timeline</legend><p>{granularities.find((g) => g.id === doc.settings.timeline.granularity)?.label}, {doc.settings.timeline.periods} periods from {doc.settings.timeline.start}.</p><button type="button" className="text-action" onClick={() => openTray({ type: 'timeline' })}><PencilSimple size={15} /> Edit timeline…</button></fieldset>
    <fieldset><legend>Journey sections</legend><p>Rename, reorder or hide the definition and guidance sections shown in the Capability journey.</p>
      {draft.sections.map((s, i) => <div className="section-row" key={s.id}>
        <label className="checkbox-row"><input type="checkbox" checked={s.visible} onChange={(e) => setSection(i, { visible: e.target.checked })} aria-label={`Show ${s.label}`} /></label>
        <Field label={<code>{s.id}</code>} path={`presentation.journeySections.${i}.label`} issues={issues}>{(a) => <input {...a} value={s.label} onChange={(e) => setSection(i, { label: e.target.value })} />}</Field>
        <div className="row-actions"><button type="button" className="icon-button" aria-label={`Move ${s.label} up`} disabled={i === 0} onClick={() => moveSection(i, -1)}><ArrowUp size={16} /></button><button type="button" className="icon-button" aria-label={`Move ${s.label} down`} disabled={i === draft.sections.length - 1} onClick={() => moveSection(i, 1)}><ArrowDown size={16} /></button></div>
      </div>)}</fieldset>
    <DraftSummary issues={[...issues, ...tray.serverIssues]} />
    <ApplyBar errors={errors} busy={tray.busy} label="Save settings" />
  </Panel>;
}

// ---------- Project details ----------
const applyProject = (doc, d) => ({ ...doc, project: { ...doc.project, name: d.name, description: d.description } });
export function ProjectTray({ doc, onCommit, onClose, confirm, focusPath }) {
  const { draft, setDraft, candidate, issues, dirty, errors } = useDraft(doc, { name: doc.project.name, description: doc.project.description }, applyProject);
  const tray = useTray({ key: 'tray', label: 'Project details', dirty, errors, candidate, message: 'Project details updated.', onCommit, onClose, confirm });
  return <Panel title="Project details" eyebrow="Project" onClose={onClose} onSubmit={tray.submit} dirty={dirty} onDiscardRequest={tray.requestClose} focusPath={focusPath}>
    <ReadOnlyId value={doc.project.id} hint="Immutable project identity. Renaming or moving the file never changes it." />
    <Field label="Name" path="project.name" issues={issues}>{(a) => <input {...a} value={draft.name} onChange={(e) => setDraft((old) => ({ ...old, name: e.target.value }))} />}</Field>
    <Field label="Description" path="project.description" issues={issues}>{(a) => <textarea {...a} rows="3" value={draft.description} onChange={(e) => setDraft((old) => ({ ...old, description: e.target.value }))} />}</Field>
    <dl className="meta-list"><dt>Created</dt><dd>{doc.project.createdAt}</dd><dt>Updated</dt><dd>{doc.project.updatedAt}</dd></dl>
    <DraftSummary issues={[...issues, ...tray.serverIssues]} />
    <ApplyBar errors={errors} busy={tray.busy} />
  </Panel>;
}

// ---------- DITA mapping (proposed; read-only) ----------
export function DitaPanel({ doc, ctx, onClose }) {
  const cap = findCapability(doc, ctx.id);
  const mapping = cap.dita;
  const names = (ids) => ids.map((id) => doc.settings.audiences.find((a) => a.id === id)?.label || id).join(', ');
  return <Panel title="DITA mapping" eyebrow="Content trace" onClose={onClose} className="mapping-panel">
    <p>Planning metadata for <strong>{cap.name}</strong>. Attribute names remain hypotheses until the content model is defined.</p>
    <div className="mapping-steps"><span>YAML capability</span><ArrowRight size={16} /><span>DITA tags and DITAVals</span><ArrowRight size={16} /><span>Embedded help + PDF</span></div>
    <dl><dt>Audience</dt><dd>{mapping.audience.length ? mapping.audience.join(', ') : 'Unmapped'}</dd><dt>Maturity</dt><dd>{mapping.maturity || 'Unmapped'}</dd><dt>Ownership</dt><dd>{mapping.ownership || 'Unmapped'}</dd><dt>Business audiences</dt><dd>{cap.audienceIds.length ? names(cap.audienceIds) : 'None'} <small className="muted">(recorded separately)</small></dd></dl>
    <div className="mapping-note"><Info size={21} /><span>These are proposed mappings, not a validated CCMS configuration. CCMS deployment and PDF Gen mappings need validation against the eventual DITA content stock. This view records intent; it does not publish content.</span></div>
  </Panel>;
}
