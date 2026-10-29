import { useState } from 'react';
import { ListNumbers, Plus, Trash } from '@phosphor-icons/react';
import { DraftSummary, Field, FieldIssues, Panel } from '../../../components/Panel';
import { useDraft } from '../../../components/useDraft';
import { definitionFields } from '../../../domain/defaults';
import { uniqueId } from '../../../domain/ids';
import { addCapability, capabilityIndex, findCapability, newCapability, setGuidance, updateCapability } from '../../../domain/operations';
import { sectionConfig } from '../../../domain/selectors';
import { periodLabel, timelinePeriods } from '../../../domain/timeline';
import { ApplyBar, ReadOnlyId, useDeletion, useTray } from './common';

const applyExisting = (doc, draft) => updateCapability(doc, draft);
const applyNew = (doc, draft) => addCapability(doc, draft);

export function CapabilityTray({ doc, ctx, onCommit, onClose, confirm, confirmDelete, openTray, focusPath }) {
  const isNew = !ctx.id;
  const [initial] = useState(() => (isNew ? { ...newCapability(doc, ctx.name || 'New capability'), ...(ctx.patch || {}) } : { ...findCapability(doc, ctx.id), ...(ctx.patch || {}) }));
  const { draft, update, setDraft, candidate, issues, dirty, errors } = useDraft(doc, initial, isNew ? applyNew : applyExisting);
  const index = candidate ? capabilityIndex(candidate, draft.id) : -1;
  const base = `capabilities.${index}`;
  const fieldIssues = issues.filter((issue) => issue.path.startsWith(`${base}.`) || issue.path === base);
  const tray = useTray({ key: 'tray', label: draft.name || 'This capability', dirty, errors, candidate, message: isNew ? `${draft.name} created.` : 'Capability updated across all views.', onCommit, onClose, confirm });
  const remove = useDeletion({ doc, onCommit, confirmDelete, onDone: onClose });
  const [guidanceAudience, setGuidanceAudience] = useState(doc.settings.audiences[0]?.id);

  const periods = timelinePeriods(doc.settings.timeline, doc.timeSegments);
  const { ownerLabels, timeline } = doc.settings;
  const dateOptions = (value) => (value && !periods.some((p) => p.date === value) ? [...periods, { date: value, label: `${value} (outside timeline)` }] : periods);
  const levelOptions = draft.levels.map((level, rank) => <option key={level.id} value={rank}>M{rank} · {level.name}</option>);
  const setMilestone = (i, patch) => update('milestones', draft.milestones.map((m, j) => (j === i ? { ...m, ...patch } : m)));
  const ownerOptions = <><option value="appliance">{ownerLabels.appliance}</option><option value="federated">{ownerLabels.federated}</option></>;
  const others = doc.capabilities.filter((cap) => cap.id !== draft.id);
  const levelGuidance = (levelId) => draft.journey.guidance.find((g) => g.audienceId === guidanceAudience && g.levelId === levelId)?.text || '';
  const defaultGuidance = (levelId) => doc.presentation.defaultGuidance.find((g) => g.audienceId === guidanceAudience && g.levelId === levelId)?.text;

  return <Panel title={isNew ? 'New capability' : 'Edit capability'} eyebrow="Capability record" onClose={onClose} onSubmit={tray.submit} dirty={dirty} onDiscardRequest={tray.requestClose} focusPath={focusPath} wide>
    <p>Changes update every view after they pass validation.</p>
    <ReadOnlyId value={draft.id} hint={isNew ? 'Generated from the name when the capability is created. It will not change if you rename it later.' : undefined} />
    <Field label="Name" path={`${base}.name`} issues={fieldIssues}>{(a) => <input {...a} value={draft.name} onChange={(e) => (isNew ? setDraft((old) => ({ ...old, name: e.target.value, id: uniqueId(e.target.value, doc.capabilities.map((c) => c.id), 'capability') })) : update('name', e.target.value))} />}</Field>
    <Field label="Summary" path={`${base}.summary`} issues={fieldIssues}>{(a) => <textarea {...a} rows="2" value={draft.summary} onChange={(e) => update('summary', e.target.value)} />}</Field>
    <Field label="Scope decision" path={`${base}.decision`} issues={fieldIssues}>{(a) => <textarea {...a} rows="2" value={draft.decision} onChange={(e) => update('decision', e.target.value)} />}</Field>

    <fieldset><legend>Maturity and ownership</legend>
      <div className="form-pair">
        <Field label="Current maturity" path={`${base}.current`} issues={fieldIssues} hint={`Applies at ${periodLabel(timeline.asOf, timeline.granularity)}`}>{(a) => <select {...a} value={draft.current} onChange={(e) => update('current', Number(e.target.value))}>{levelOptions}</select>}</Field>
        <Field label="Target maturity" path={`${base}.target`} issues={fieldIssues} hint="Applies at the end of the timeline">{(a) => <select {...a} value={draft.target} onChange={(e) => update('target', Number(e.target.value))}>{levelOptions}</select>}</Field>
      </div>
      <div className="form-pair">
        <Field label="Current owner" path={`${base}.owner`} issues={fieldIssues}>{(a) => <select {...a} value={draft.owner} onChange={(e) => update('owner', e.target.value)}>{ownerOptions}</select>}</Field>
        <Field label="Future owner" path={`${base}.futureOwner`} issues={fieldIssues}>{(a) => <select {...a} value={draft.futureOwner} onChange={(e) => update('futureOwner', e.target.value)}>{ownerOptions}</select>}</Field>
      </div>
      <Field label="Handoff period" path={`${base}.handoffDate`} issues={fieldIssues}>{(a) => <select {...a} value={draft.handoffDate || ''} onChange={(e) => update('handoffDate', e.target.value || null)}><option value="">End of timeline</option>{dateOptions(draft.handoffDate).map((p) => <option key={p.date} value={p.date}>{p.label}</option>)}</select>}</Field>
      {!isNew && <button type="button" className="text-action" onClick={() => openTray({ type: 'levels', id: draft.id })}><ListNumbers size={16} /> Define maturity levels…</button>}
    </fieldset>

    <fieldset data-path={`${base}.milestones`} tabIndex={-1}><legend>Timeline milestones</legend><p>Current maturity applies at {periodLabel(timeline.asOf, timeline.granularity)} and target at the end of the timeline. Milestones shape the path between them or record the past.</p>
      {draft.milestones.map((m, i) => <div className="milestone-row wide" key={i}>
        <select aria-label="Milestone period" data-path={`${base}.milestones.${i}.date`} value={m.date} onChange={(e) => setMilestone(i, { date: e.target.value })}>{dateOptions(m.date).map((p) => <option key={p.date} value={p.date}>{p.label}</option>)}</select>
        <select aria-label="Milestone maturity" data-path={`${base}.milestones.${i}.maturity`} value={m.maturity} onChange={(e) => setMilestone(i, { maturity: Number(e.target.value) })}>{levelOptions}</select>
        <input aria-label="Milestone note" placeholder="Note" value={m.note} onChange={(e) => setMilestone(i, { note: e.target.value })} />
        <button type="button" className="icon-button" aria-label={`Remove milestone ${m.date}`} onClick={() => update('milestones', draft.milestones.filter((_, j) => j !== i))}><Trash size={18} /></button>
        <FieldIssues issues={fieldIssues.filter((x) => x.path.startsWith(`${base}.milestones.${i}.`))} />
      </div>)}
      <button type="button" className="text-action" onClick={() => update('milestones', [...draft.milestones, { date: periods.find((p) => p.date !== timeline.asOf && p.date !== periods.at(-1).date && !draft.milestones.some((m) => m.date === p.date))?.date || periods[0].date, maturity: draft.current, note: '' }])}><Plus size={16} /> Add milestone</button></fieldset>

    <fieldset><legend>Membership</legend>
      <Field label="Domain" path={`${base}.domainId`} issues={fieldIssues} hint="Domain is separate from ownership.">{(a) => <select {...a} value={draft.domainId || ''} onChange={(e) => update('domainId', e.target.value || null)}><option value="">Unassigned</option>{doc.domains.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>}</Field>
      <div className="checkbox-grid" role="group" aria-label="Audiences" data-path={`${base}.audienceIds`} tabIndex={-1}><span className="group-label">Audiences <small>(business membership; separate from the proposed DITA mapping)</small></span>
        {doc.settings.audiences.map((a) => <label className="checkbox-row" key={a.id}><input type="checkbox" checked={draft.audienceIds.includes(a.id)} onChange={(e) => update('audienceIds', e.target.checked ? [...draft.audienceIds, a.id] : draft.audienceIds.filter((id) => id !== a.id))} />{a.label}</label>)}
      </div>
      <FieldIssues issues={fieldIssues.filter((x) => x.path.startsWith(`${base}.audienceIds`))} />
    </fieldset>

    <fieldset><legend>Definition</legend>
      {definitionFields.map((field) => <Field key={field} label={sectionConfig(doc, field)?.label || field} path={`${base}.definition.${field}`} issues={fieldIssues}>{(a) => <textarea {...a} rows="2" value={draft.definition[field]} onChange={(e) => update('definition', { ...draft.definition, [field]: e.target.value })} />}</Field>)}
    </fieldset>

    <fieldset data-path={`${base}.journey`} tabIndex={-1}><legend>{sectionConfig(doc, 'audienceGuidance')?.label || 'Audience guidance'}</legend>
      <p>Guidance recorded here overrides the project default for this capability.</p>
      <label>Audience<select value={guidanceAudience} onChange={(e) => setGuidanceAudience(e.target.value)}>{doc.settings.audiences.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}</select></label>
      {draft.levels.map((level, rank) => <label key={level.id}>M{rank} · {level.name}<textarea rows="2" value={levelGuidance(level.id)} placeholder={defaultGuidance(level.id) ? `Default: ${defaultGuidance(level.id)}` : 'No guidance recorded.'} onChange={(e) => update('journey', { ...draft.journey, guidance: setGuidance(draft.journey.guidance, guidanceAudience, level.id, e.target.value) })} /></label>)}
      <FieldIssues issues={fieldIssues.filter((x) => x.path.startsWith(`${base}.journey`))} />
    </fieldset>

    <fieldset data-path={`${base}.dependencies`} tabIndex={-1}><legend>Dependencies</legend>
      {others.length ? others.map((cap) => <label className="checkbox-row" key={cap.id}><input type="checkbox" checked={draft.dependencies.includes(cap.id)} onChange={(e) => update('dependencies', e.target.checked ? [...draft.dependencies, cap.id] : draft.dependencies.filter((id) => id !== cap.id))} />{cap.name}</label>) : <p>No other capabilities yet.</p>}
      <FieldIssues issues={fieldIssues.filter((x) => x.path.startsWith(`${base}.dependencies`))} />
    </fieldset>

    <DraftSummary issues={[...issues, ...tray.serverIssues]} />
    <ApplyBar errors={errors} busy={tray.busy} label={isNew ? 'Create capability' : 'Apply changes'} onDelete={isNew ? null : () => remove({ type: 'capability', id: draft.id }, draft.name, others.map((c) => ({ id: c.id, label: c.name })))} deleteLabel="Delete capability" />
    {isNew && <button type="button" className="text-action" onClick={() => setDraft(initial)}>Reset form</button>}
  </Panel>;
}
