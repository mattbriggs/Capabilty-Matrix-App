import { useMemo, useState } from 'react';
import { CalendarBlank, Code, FolderSimple, Graph, ListNumbers, Plus, SquaresFour, Stack, UsersThree } from '@phosphor-icons/react';
import { IssueText } from '../../components/Panel';
import { findCapability } from '../../domain/operations';
import { timelinePeriods } from '../../domain/timeline';
import { RelationTable } from './RelationTable';
import { SourceEditor } from './SourceEditor';

const entityTypes = [
  { id: 'table', label: 'Relationship table', icon: SquaresFour },
  { id: 'capability', label: 'Capabilities', icon: FolderSimple },
  { id: 'level', label: 'Maturity levels', icon: ListNumbers },
  { id: 'audience', label: 'Audiences', icon: UsersThree },
  { id: 'domain', label: 'Domains', icon: Stack },
  { id: 'timeSegment', label: 'Time segments', icon: CalendarBlank },
  { id: 'source', label: 'YAML source', icon: Code },
];

function issueCount(issues, predicate) {
  const list = issues.filter(predicate);
  return list.length ? <span className={`count-badge ${list.some((i) => i.severity === 'error') ? 'error' : 'warning'}`} title={`${list.length} issue(s)`}>{list.length}</span> : null;
}

function RecordsTable({ caption, columns, rows, onOpen, empty, search }) {
  const filtered = rows.filter((row) => !search || row.search.toLowerCase().includes(search.toLowerCase()));
  if (!rows.length) return <div className="empty-state"><strong>{empty}</strong></div>;
  return <div className="records-scroll"><table className="records-table"><caption className="sr-only">{caption}</caption>
    <thead><tr>{columns.map((c) => <th key={c} scope="col">{c}</th>)}</tr></thead>
    <tbody>{filtered.map((row) => <tr key={row.key}>{row.cells.map((cell, i) => (i === 0 ? <th key={i} scope="row"><button type="button" className="record-link" onClick={() => onOpen(row.open)}>{cell}</button></th> : <td key={i}>{cell}</td>))}</tr>)}</tbody>
  </table>{!filtered.length && <p className="muted">No records match “{search}”.</p>}</div>;
}

export function DataWorkspace({ doc, issues, focusDate, focusLabel, selectedId, openTray, onCommit, onConfig, openIssue, download, onApplySource, sidecarCheck, desktop }) {
  const [entity, setEntity] = useState('table');
  const [search, setSearch] = useState('');
  const [levelCap, setLevelCap] = useState(selectedId || doc.capabilities[0]?.id);
  const [issueSearch, setIssueSearch] = useState('');
  const [severity, setSeverity] = useState('all');
  const [pythonReport, setPythonReport] = useState(null);
  const { ownerLabels } = doc.settings;
  const domainName = (id) => doc.domains.find((d) => d.id === id)?.name;
  const periods = useMemo(() => timelinePeriods(doc.settings.timeline, doc.timeSegments), [doc]);
  const levelCapability = findCapability(doc, levelCap) || doc.capabilities[0];
  const counts = { capability: doc.capabilities.length, level: levelCapability?.levels.length || 0, audience: doc.settings.audiences.length, domain: doc.domains.length, timeSegment: periods.length };
  const capIssues = (index) => issueCount(issues, (i) => i.path.startsWith(`capabilities.${index}.`) || i.path === `capabilities.${index}`);

  const records = {
    capability: { caption: 'Capabilities', columns: ['Name', 'ID', 'Domain', 'Owner (now → future)', 'Maturity', 'Audiences', 'Issues'], empty: 'No capabilities yet. Use “New capability” to add the first one.', newTray: { type: 'capability' }, newLabel: 'New capability',
      rows: doc.capabilities.map((cap, index) => ({ key: cap.id, open: { type: 'capability', id: cap.id }, search: `${cap.name} ${cap.id}`, cells: [cap.name, <code>{cap.id}</code>, domainName(cap.domainId) || <span className="muted">Unassigned</span>, `${ownerLabels[cap.owner]} → ${ownerLabels[cap.futureOwner]}`, `M${cap.current} → M${cap.target}`, cap.audienceIds.length || <span className="muted">Unassigned</span>, capIssues(index)] })) },
    level: { caption: 'Maturity levels', columns: ['Level', 'ID', 'Description', 'Used by', 'Outcomes / exit criteria'], empty: 'Add a capability to define its maturity levels.', newTray: levelCapability && { type: 'levels', id: levelCapability.id }, newLabel: 'Add, reorder or remove levels',
      rows: (levelCapability?.levels || []).map((level, rank) => ({ key: level.id, open: { type: 'level', capabilityId: levelCapability.id, id: level.id }, search: `${level.name} ${level.id}`, cells: [`M${rank} · ${level.name}`, <code>{level.id}</code>, level.description || <span className="muted">—</span>, [levelCapability.current === rank && 'current', levelCapability.target === rank && 'target', ...levelCapability.milestones.filter((m) => m.maturity === rank).map((m) => `milestone ${m.date}`)].filter(Boolean).join(', ') || <span className="muted">—</span>, level.outcomes || level.exitCriteria ? 'Recorded' : <span className="muted">Not recorded</span>] })) },
    audience: { caption: 'Audiences', columns: ['Audience', 'ID', 'Role', 'Members', 'Default guidance', 'Issues'], empty: 'No audiences.', newTray: { type: 'audience' }, newLabel: 'New audience',
      rows: doc.settings.audiences.map((a, index) => ({ key: a.id, open: { type: 'audience', id: a.id }, search: `${a.label} ${a.id}`, cells: [a.label, <code>{a.id}</code>, a.description, doc.capabilities.filter((c) => c.audienceIds.includes(a.id)).length, doc.presentation.defaultGuidance.filter((g) => g.audienceId === a.id).length, issueCount(issues, (i) => i.path.startsWith(`settings.audiences.${index}.`))] })) },
    domain: { caption: 'Domains', columns: ['Domain', 'ID', 'Description', 'Members', 'Issues'], empty: 'No domains yet. Capabilities without a domain appear in the Unassigned region of the map.', newTray: { type: 'domain' }, newLabel: 'New domain',
      rows: doc.domains.map((d, index) => ({ key: d.id, open: { type: 'domain', id: d.id }, search: `${d.name} ${d.id}`, cells: [<span className="domain-name"><i style={{ background: d.color || '#eef1f3' }} />{d.name}</span>, <code>{d.id}</code>, d.description, doc.capabilities.filter((c) => c.domainId === d.id).length, issueCount(issues, (i) => i.path.startsWith(`domains.${index}.`))] })) },
    timeSegment: { caption: 'Time segments', columns: ['Segment', 'Start date', 'Notes', 'Milestones', 'Anchor'], empty: 'No time segments.', newTray: { type: 'timeline' }, newLabel: 'Edit timeline structure',
      rows: periods.map((p, index) => ({ key: p.date, open: { type: 'timeSegment', id: p.date }, search: `${p.label} ${p.date}`, cells: [p.label, <code>{p.date}</code>, p.description || <span className="muted">—</span>, doc.capabilities.reduce((n, cap) => n + cap.milestones.filter((m) => m.date >= p.date && (!periods[index + 1] || m.date < periods[index + 1].date)).length, 0), p.date === doc.settings.timeline.asOf ? 'Current anchor' : index === periods.length - 1 ? 'Target anchor' : ''] })) },
  };
  const active = records[entity];
  const shownIssues = issues.filter((i) => (severity === 'all' || i.severity === severity) && (!issueSearch || `${i.message} ${i.path} ${i.entityId}`.toLowerCase().includes(issueSearch.toLowerCase())));
  const errors = issues.filter((i) => i.severity === 'error').length;

  return <section className="data-workspace view-enter" aria-label="Data workspace">
    <div className="data-intro"><div><div className="eyebrow">Data entry and validation</div><h2>Data workspace</h2><p>Create, edit and check every record. Changes apply only after the whole project passes validation.</p></div></div>
    <div className="data-layout">
      <nav className="entity-list" aria-label="Record types">{entityTypes.map(({ id, label, icon: Icon }) => <button type="button" key={id} className={entity === id ? 'active' : ''} aria-current={entity === id ? 'page' : undefined} onClick={() => { setEntity(id); setSearch(''); }}><Icon size={19} />{label}{counts[id] !== undefined && <span className="entity-count">{counts[id]}</span>}</button>)}</nav>
      <div className="data-main">
        {entity === 'table' && <RelationTable doc={doc} focusDate={focusDate} focusLabel={focusLabel} openTray={openTray} onCommit={onCommit} onConfig={onConfig} download={download} />}
        {entity === 'source' && <SourceEditor doc={doc} onApply={onApplySource} />}
        {active && <>
          <div className="records-toolbar">
            {entity === 'level' && <label className="axis-select">Capability<select value={levelCapability?.id || ''} onChange={(e) => setLevelCap(e.target.value)} disabled={!doc.capabilities.length}>{doc.capabilities.map((cap) => <option key={cap.id} value={cap.id}>{cap.name}</option>)}</select></label>}
            <label className="axis-select grow">Search<input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`Search ${active.caption.toLowerCase()}`} /></label>
            {active.newTray && <button type="button" className="edit-action" onClick={() => openTray(active.newTray)}><Plus size={16} /> {active.newLabel}</button>}
          </div>
          <RecordsTable {...active} search={search} onOpen={openTray} />
        </>}
      </div>
      <aside className="validation-panel" aria-label="Validation">
        <div className="validation-head"><h3>Validation</h3><span role="status" aria-live="polite">{errors ? `${errors} error${errors === 1 ? '' : 's'}` : 'No errors'}{issues.length - errors ? `, ${issues.length - errors} warning${issues.length - errors === 1 ? '' : 's'}` : ''}</span></div>
        <div className="validation-filters"><input type="search" aria-label="Search issues" placeholder="Search issues" value={issueSearch} onChange={(e) => setIssueSearch(e.target.value)} />
          <select aria-label="Severity" value={severity} onChange={(e) => setSeverity(e.target.value)}><option value="all">All</option><option value="error">Errors</option><option value="warning">Warnings</option></select></div>
        {shownIssues.length ? <ul className="issue-list">{shownIssues.map((issue) => <li key={`${issue.path}-${issue.code}`}><button type="button" onClick={() => openIssue(issue)}><span className="issue-entity">{issue.entityType}{issue.entityId ? ` · ${issue.entityId}` : ''}</span><span><IssueText issue={issue} /></span><code>{issue.path || '(document)'}</code></button></li>)}</ul>
          : <p className="muted">{issues.length ? 'No issues match.' : 'The project passes every structural and cross-record check.'}</p>}
        {desktop && <button type="button" className="text-action" onClick={async () => setPythonReport(await sidecarCheck())}><Graph size={15} /> Re-check with the Python validator</button>}
        {pythonReport && <p className="muted" role="status">{pythonReport}</p>}
      </aside>
    </div>
  </section>;
}
