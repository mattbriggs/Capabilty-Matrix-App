import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowsLeftRight, DownloadSimple, FunnelSimple, PencilSimple } from '@phosphor-icons/react';
import { Dialog } from '../../components/Panel';
import { dimensions } from '../../domain/defaults';
import { findCapability, toggleAudienceMembership, setCapabilityDomain, updateCapability } from '../../domain/operations';
import { buildRelationTable, cellKey, dimensionLabel, tableReportCsv, UNASSIGNED } from '../../domain/projection';
import { horizonDate, setMaturityAtDate } from '../../domain/timeline';

const COL_W = 184; const ROW_H = 82; const HEAD_H = 58; const LABEL_W = 210; const OVERSCAN = 3;

// What an explicit "Edit relationship" does for a pair, or null when the cell is calculated/aggregate.
function relationshipAction(doc, config, row, column, items, focusDate) {
  const pick = (dim) => (config.xAxis === dim ? column : config.yAxis === dim ? row : null);
  const cap = pick('capability'); const audience = pick('audience'); const domain = pick('domain'); const time = pick('time'); const maturity = pick('maturity');
  if (!cap) return null;
  const record = findCapability(doc, cap.key);
  if (audience && audience.key !== UNASSIGNED) {
    const member = record.audienceIds.includes(audience.key);
    return { label: member ? `Remove ${record.name} from ${audience.label}` : `Add ${record.name} to ${audience.label}`, short: member ? 'Remove membership' : 'Add membership', run: (d) => toggleAudienceMembership(d, record.id, audience.key), message: 'Audience membership updated.' };
  }
  if (domain) {
    if (domain.key === UNASSIGNED) return record.domainId ? { label: `Unassign ${record.name} from its domain`, short: 'Unassign', run: (d) => setCapabilityDomain(d, record.id, null), message: 'Domain assignment updated.' } : null;
    return record.domainId === domain.key
      ? { label: `Unassign ${record.name} from ${domain.label}`, short: 'Unassign', run: (d) => setCapabilityDomain(d, record.id, null), message: 'Domain assignment updated.' }
      : { label: `Assign ${record.name} to ${domain.label}`, short: 'Assign to domain', run: (d) => setCapabilityDomain(d, record.id, domain.key), message: 'Domain assignment updated.' };
  }
  if (time) return { label: `Edit the dated value for ${record.name} at ${time.label}`, short: 'Edit milestone', tray: { date: time.key } };
  if (maturity && !items.length && Number(maturity.key) < record.levels.length) {
    return { label: `Record ${record.name} at M${maturity.key} for the Focus date`, short: 'Set at Focus', run: (d) => updateCapability(d, setMaturityAtDate(findCapability(d, record.id), d.settings.timeline, focusDate, Number(maturity.key))), message: 'Maturity recorded for the Focus date.' };
  }
  return null;
}

export function RelationTable({ doc, focusDate, focusLabel, openTray, onCommit, onConfig, download }) {
  const config = doc.presentation.dataTable;
  const [search, setSearch] = useState(config.filters.search);
  useEffect(() => setSearch(config.filters.search), [config.filters.search]);
  useEffect(() => {
    if (search === config.filters.search) return undefined;
    const timer = setTimeout(() => onConfig({ ...config, filters: { ...config.filters, search } }), 350);
    return () => clearTimeout(timer);
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps
  const table = useMemo(() => buildRelationTable(doc, { ...config, filters: { ...config.filters, search } }, focusDate), [doc, config, search, focusDate]);
  const scroller = useRef(null);
  const [viewport, setViewport] = useState({ top: 0, left: 0, width: 900, height: 520 });
  const [active, setActive] = useState({ r: 0, c: 0 });
  const [drill, setDrill] = useState(null);
  const focusPending = useRef(false);
  useLayoutEffect(() => {
    const node = scroller.current; if (!node) return undefined;
    const measure = () => setViewport({ top: node.scrollTop, left: node.scrollLeft, width: node.clientWidth, height: node.clientHeight });
    measure();
    const observer = new ResizeObserver(measure); observer.observe(node);
    return () => observer.disconnect();
  }, [table.status]);
  const rows = table.rows; const columns = table.columns;
  const firstRow = Math.max(0, Math.floor(viewport.top / ROW_H) - OVERSCAN);
  const lastRow = Math.min(rows.length - 1, Math.ceil((viewport.top + viewport.height) / ROW_H) + OVERSCAN);
  const firstCol = Math.max(0, Math.floor((viewport.left) / COL_W) - OVERSCAN);
  const lastCol = Math.min(columns.length - 1, Math.ceil((viewport.left + viewport.width) / COL_W) + OVERSCAN);
  const r = Math.min(active.r, Math.max(0, rows.length - 1)); const c = Math.min(active.c, Math.max(0, columns.length - 1));

  useEffect(() => {
    if (!focusPending.current) return;
    focusPending.current = false;
    scroller.current?.querySelector(`[data-cell="${r}:${c}"]`)?.focus();
  });
  function move(dr, dc, event) {
    event.preventDefault();
    const nr = Math.max(0, Math.min(rows.length - 1, r + dr)); const nc = Math.max(0, Math.min(columns.length - 1, c + dc));
    const node = scroller.current;
    const top = nr * ROW_H; const left = nc * COL_W;
    if (top < node.scrollTop) node.scrollTop = top; else if (top + ROW_H > node.scrollTop + node.clientHeight - HEAD_H) node.scrollTop = top + ROW_H - node.clientHeight + HEAD_H;
    if (left < node.scrollLeft) node.scrollLeft = left; else if (left + COL_W > node.scrollLeft + node.clientWidth - LABEL_W) node.scrollLeft = left + COL_W - node.clientWidth + LABEL_W;
    focusPending.current = true;
    setActive({ r: nr, c: nc });
  }
  const onKeyDown = (event) => {
    if (event.target.dataset.cell === undefined) return;
    const keys = { ArrowDown: [1, 0], ArrowUp: [-1, 0], ArrowRight: [0, 1], ArrowLeft: [0, -1], PageDown: [10, 0], PageUp: [-10, 0], Home: [0, -columns.length], End: [0, columns.length] };
    if (keys[event.key]) move(...keys[event.key], event);
    if (event.key === 'Enter') { event.preventDefault(); event.target.querySelector('button')?.focus(); }
  };
  const setAxis = (axis, value) => onConfig({ ...config, [axis]: value });
  const capabilityFilter = config.filters.capabilityIds;
  const toggleFilter = (id) => onConfig({ ...config, filters: { ...config.filters, capabilityIds: capabilityFilter.includes(id) ? capabilityFilter.filter((x) => x !== id) : [...capabilityFilter, id] } });
  const runAction = async (action, row, column) => {
    if (action.tray) {
      const cap = findCapability(doc, (config.xAxis === 'capability' ? column : row).key);
      const date = action.tray.date;
      const anchor = date === doc.settings.timeline.asOf ? 'current' : date === horizonDate(doc.settings.timeline) ? 'target' : null;
      const index = doc.capabilities.indexOf(cap);
      if (anchor) { openTray({ type: 'capability', id: cap.id, focusPath: `capabilities.${index}.${anchor}` }); return; }
      const existing = cap.milestones.findIndex((m) => m.date === date);
      const milestones = existing >= 0 ? cap.milestones : [...cap.milestones, { date, maturity: cap.current, note: '' }].sort((a, b) => a.date.localeCompare(b.date));
      openTray({ type: 'capability', id: cap.id, patch: { milestones }, focusPath: `capabilities.${index}.milestones.${milestones.findIndex((m) => m.date === date)}.maturity`, nonce: Date.now() });
      return;
    }
    await onCommit(action.run(doc), action.message);
  };
  const headerButton = (header, axis) => (header.entity
    ? <button type="button" className="rt-header-button" onClick={() => openTray(header.entity.type === 'level' ? { type: 'level', capabilityId: header.entity.capabilityId, id: header.entity.id } : { type: header.entity.type, id: header.entity.id })} title={`Open ${header.label}`}><strong>{header.label}</strong><small>{header.sublabel}</small></button>
    : <span className={`rt-header-static ${header.unassigned ? 'unassigned' : ''}`} title={axis}><strong>{header.label}</strong><small>{header.sublabel}</small></span>);
  const totalW = LABEL_W + columns.length * COL_W; const totalH = HEAD_H + rows.length * ROW_H;
  const timeAxis = config.xAxis === 'time' || config.yAxis === 'time';
  const filled = [...table.cells.values()].filter((list) => list.length).length;

  return <section className="relation-table" aria-label="Relationship table">
    <div className="rt-toolbar">
      <label className="axis-select">Rows (Y)<select value={config.yAxis} onChange={(e) => setAxis('yAxis', e.target.value)}>{dimensions.map((d) => <option key={d.id} value={d.id} disabled={d.id === config.xAxis}>{d.label}</option>)}</select></label>
      <button type="button" className="icon-button swap" onClick={() => onConfig({ ...config, xAxis: config.yAxis, yAxis: config.xAxis })} aria-label="Swap rows and columns" title="Swap axes"><ArrowsLeftRight size={18} /></button>
      <label className="axis-select">Columns (X)<select value={config.xAxis} onChange={(e) => setAxis('xAxis', e.target.value)}>{dimensions.map((d) => <option key={d.id} value={d.id} disabled={d.id === config.yAxis}>{d.label}</option>)}</select></label>
      <label className="axis-select grow">Search capabilities<input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter by name or ID" /></label>
      <details className="filter-pop"><summary><FunnelSimple size={16} /> Capabilities {capabilityFilter.length ? `(${capabilityFilter.length})` : '(all)'}</summary>
        <div className="filter-list">{doc.capabilities.map((cap) => <label className="checkbox-row" key={cap.id}><input type="checkbox" checked={capabilityFilter.includes(cap.id)} onChange={() => toggleFilter(cap.id)} />{cap.name}</label>)}
          {capabilityFilter.length > 0 && <button type="button" className="text-action" onClick={() => onConfig({ ...config, filters: { ...config.filters, capabilityIds: [] } })}>Clear filter</button>}</div></details>
      <button type="button" className="text-action" disabled={table.status !== 'ok'} onClick={() => download(tableReportCsv(table, config, doc.settings.ownerLabels), `${dimensionLabel(config.yAxis)}-by-${dimensionLabel(config.xAxis)}-report.csv`.toLowerCase().replace(/\s+/g, '-'), 'text/csv')}><DownloadSimple size={16} /> Export table report</button>
    </div>
    <p className="rt-caption">{timeAxis ? 'Maturity and owner are calculated at each segment start; edit the dated milestone, not the calculated number.' : `Relationships at the Focus date (${focusLabel}).`} {table.status === 'ok' && `${rows.length} × ${columns.length}; ${filled} cells with relationships.`} Report exports are readable summaries, not an import format.</p>
    {table.status === 'needsCapabilityFilter' && <div className="empty-state"><strong>Choose capabilities to compare maturity stages.</strong><p>Stage definitions belong to each capability, so the Maturity stage axis needs a capability filter. Use the Capabilities filter above.</p></div>}
    {table.status === 'ok' && (rows.length && columns.length ? <div className="rt-scroller" ref={scroller} role="grid" aria-rowcount={rows.length + 1} aria-colcount={columns.length + 1} onKeyDown={onKeyDown} onScroll={(e) => setViewport((old) => ({ ...old, top: e.currentTarget.scrollTop, left: e.currentTarget.scrollLeft }))}>
      <div className="rt-canvas" style={{ width: totalW, height: totalH }}>
        <div className="rt-head" role="row" aria-rowindex={1} style={{ width: totalW, height: HEAD_H }}>
          <div className="rt-corner" role="columnheader" style={{ width: LABEL_W, height: HEAD_H }}><span>{dimensionLabel(config.yAxis)}</span><small>by {dimensionLabel(config.xAxis).toLowerCase()}</small></div>
          {columns.slice(firstCol, lastCol + 1).map((column, i) => <div key={column.key} role="columnheader" aria-colindex={firstCol + i + 2} className="rt-colhead" style={{ left: LABEL_W + (firstCol + i) * COL_W, width: COL_W, height: HEAD_H }}>{headerButton(column, 'column')}</div>)}
        </div>
        {rows.slice(firstRow, lastRow + 1).map((row, ri) => {
          const rowIndex = firstRow + ri;
          return <div key={row.key} role="row" aria-rowindex={rowIndex + 2} className="rt-row" style={{ top: HEAD_H + rowIndex * ROW_H, height: ROW_H, width: totalW }}>
            <div className="rt-rowhead" role="rowheader" style={{ width: LABEL_W, height: ROW_H }}>{headerButton(row, 'row')}</div>
            {columns.slice(firstCol, lastCol + 1).map((column, ci) => {
              const colIndex = firstCol + ci;
              const items = table.cells.get(cellKey(row.key, column.key)) || [];
              const action = relationshipAction(doc, config, row, column, items, focusDate);
              const isActive = rowIndex === r && colIndex === c;
              return <div key={column.key} role="gridcell" aria-colindex={colIndex + 2} data-cell={`${rowIndex}:${colIndex}`} tabIndex={isActive ? 0 : -1} onFocus={() => (isActive ? null : setActive({ r: rowIndex, c: colIndex }))} className={`rt-cell ${items.length ? 'filled' : 'empty'}`} style={{ left: LABEL_W + colIndex * COL_W, width: COL_W, height: ROW_H }} aria-label={`${row.label}, ${column.label}: ${items.length ? `${items.length} capabilit${items.length === 1 ? 'y' : 'ies'}` : 'No recorded relationship'}`}>
                {items.length ? <>
                  <span className="rt-count" aria-hidden="true">{items.length}</span>
                  <div className="rt-chips">{items.slice(0, 2).map((item) => <button type="button" tabIndex={-1} key={`${item.capabilityId}-${item.date}`} className={`rt-chip ${item.owner}`} onClick={() => openTray({ type: 'capability', id: item.capabilityId })} title={`Open ${item.name}`}>{item.name}{timeAxis && <small> M{item.rank} · {doc.settings.ownerLabels[item.owner]}</small>}</button>)}
                    {items.length > 2 && <button type="button" tabIndex={-1} className="rt-more" onClick={() => setDrill({ row, column, items })}>+{items.length - 2} more</button>}</div>
                </> : <span className="rt-empty">No recorded relationship</span>}
                {action && <button type="button" tabIndex={-1} className="rt-edit" onClick={() => runAction(action, row, column)} title={action.label} aria-label={action.label}><PencilSimple size={13} /> {action.short}</button>}
              </div>;
            })}
          </div>;
        })}
      </div>
    </div> : <div className="empty-state"><strong>Nothing to show.</strong><p>{doc.capabilities.length ? 'No capabilities match the current filters.' : 'This project has no capabilities yet. Create one from the Capabilities list.'}</p></div>)}
    {drill && <Dialog title={`${drill.row.label} × ${drill.column.label}`} onCancel={() => setDrill(null)} actions={<button type="button" className="outline-action compact" onClick={() => setDrill(null)}>Close</button>}>
      <p>{drill.items.length} capabilities. Choose one to edit it; bare cells never guess which record to change.</p>
      <ul className="drill-list">{drill.items.map((item) => <li key={`${item.capabilityId}-${item.date}`}><button type="button" className="dependency-row" onClick={() => { setDrill(null); openTray({ type: 'capability', id: item.capabilityId }); }}><span><strong>{item.name}</strong><small>M{item.rank}{item.levelName ? ` · ${item.levelName}` : ''} · {doc.settings.ownerLabels[item.owner]}</small></span></button></li>)}</ul>
    </Dialog>}
  </section>;
}
