/* eslint-disable react/prop-types */
import React, { useMemo, useState } from 'react'
import { AlertTriangle, ArrowRight, BarChart3, CalendarDays, CheckCircle2, Clock3, Flag, Info, Link2, ListChecks, Lock, Paperclip, Search, ShieldCheck, SlidersHorizontal, XCircle } from 'lucide-react'
import { MilestoneDialog, MilestoneForm, MilestoneImport } from '../components/MilestoneControlDialogs'

const DAY = 86400000
const time = value => value ? Date.parse(`${String(value).slice(0, 10)}T00:00:00Z`) : NaN
const date = value => Number.isFinite(time(value)) ? new Date(time(value)).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : 'Not recorded'
const shortDate = value => Number.isFinite(time(value)) ? new Date(time(value)).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : ''
const variance = value => value == null ? '—' : `${value > 0 ? '+' : ''}${value}d`
const missingSetup = row => !row.comparisonDate || !row.criteria?.length || !row.evidence?.length || (row.achieved && !row.actualDate)
const csvCell = value => { const str = String(value ?? ''); return `"${(/^[=+@\-\t\r]/.test(str) ? `'${str}` : str).replaceAll('"', '""')}"` }

export function downloadMilestoneCsv(model, project) {
  const columns = ['Project', 'Reference', 'Milestone', 'Source', 'Target date', 'Approved baseline', 'Forecast', 'Actual', 'Status', 'Owner', 'Variance (days)', 'Variance basis', 'Linked activity', 'Evidence', 'Reporting date']
  const records = (model?.rows || []).map(row => [project?.project_number || project?.code || project?.id, row.code, row.name, row.sourceLabel, row.targetDate, row.baselineApproved ? row.baselineDate : '', row.forecastDate, row.actualDate, row.status, row.owner, row.varianceDays, row.varianceBasis, row.linkedActivity?.code, row.evidence ? `${row.evidence.length} items` : 'Not configured', model.dataDate])
  const blob = new Blob(['\uFEFF' + [columns, ...records].map(record => record.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob), anchor = document.createElement('a')
  anchor.href = url; anchor.download = `milestones-${String(project?.project_number || project?.code || project?.id || 'project').replace(/[^a-z0-9_-]/gi, '-')}.csv`
  document.body.appendChild(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function Panel({ title, icon: Icon = Flag, actions, className = '', children }) {
  return <section className={`mc-panel ${className}`} aria-label={title}><header><h2><Icon aria-hidden="true" />{title}</h2>{actions && <div className="mc-panel-actions">{actions}</div>}</header>{children}</section>
}
function TextButton({ children, onClick, arrow = false }) { return <button type="button" className="mc-text-button" onClick={onClick}>{children}{arrow && <ArrowRight aria-hidden="true" />}</button> }
function Status({ label, tone = 'neutral' }) {
  const Icon = tone === 'success' ? CheckCircle2 : ['danger', 'warning', 'critical', 'high'].includes(tone) ? AlertTriangle : Info
  return <span className={`mc-status mc-${tone}`}><Icon aria-hidden="true" />{label}</span>
}
function Empty({ children }) { return <div className="mc-empty"><Flag aria-hidden="true" /><p>{children}</p></div> }
function Table({ name, headings, children, className = '' }) { return <div className="mc-table-wrap" role="region" aria-label={name} tabIndex={0}><table className={`mc-table ${className}`}><thead><tr>{headings.map((label, index) => <th scope="col" key={`${label}-${index}`}>{label}</th>)}</tr></thead><tbody>{children}</tbody></table></div> }
function Field({ label, value, onChange, options }) { return <label className="mc-toolbar-field">{label}<select value={value} onChange={event => onChange(event.target.value)}>{options.map(option => <option value={option.id} key={option.id}>{option.label}</option>)}</select></label> }

function Roadmap({ rows, dataDate, selectedId, onSelect, onOpenSchedule, view, onView }) {
  const dates = rows.flatMap(row => [row.baselineDate, row.targetDate, row.forecastDate, row.actualDate]).concat(dataDate).map(time).filter(Number.isFinite)
  const first = dates.length ? new Date(Math.min(...dates)) : new Date(), last = dates.length ? new Date(Math.max(...dates)) : first
  const start = Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), 1), end = Date.UTC(last.getUTCFullYear(), last.getUTCMonth() + 1, 1)
  const position = value => Math.max(1, Math.min(94, 2 + (time(value) - start) / Math.max(DAY, end - start) * 90))
  const monthCount = (last.getUTCFullYear() - first.getUTCFullYear()) * 12 + last.getUTCMonth() - first.getUTCMonth() + 1
  const months = Array.from({ length: Math.min(8, monthCount) }, (_, index) => {
    const monthDate = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + Math.floor(index * monthCount / Math.min(8, monthCount)), 1))
    return { label: monthDate.toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' }), left: position(monthDate.toISOString()) }
  })
  const calendar = new Map()
  for (const row of rows) {
    const value = row.actualDate || row.forecastDate || row.comparisonDate
    const key = value ? value.slice(0, 7) : 'Unscheduled'
    if (!calendar.has(key)) calendar.set(key, [])
    calendar.get(key).push({ row, value, kind: row.actualDate ? 'Actual' : row.forecastDate ? 'Forecast' : row.baselineApproved ? 'Baseline' : 'Target' })
  }
  return <Panel title="Milestone roadmap" icon={CalendarDays} className="mc-roadmap-panel" actions={<><div className="mc-segmented">{['Timeline', 'Calendar'].map(item => <button type="button" key={item} aria-pressed={view === item.toLowerCase()} onClick={() => onView(item.toLowerCase())}>{item}</button>)}</div><TextButton onClick={onOpenSchedule} arrow>Open schedule</TextButton></>}>
    {!rows.length ? <Empty>No dated milestones match the current filters.</Empty> : view === 'calendar' ? <div className="mc-calendar" aria-label="Milestone calendar">{[...calendar].sort(([a], [b]) => a.localeCompare(b)).map(([month, items]) => <section key={month}><h3>{month === 'Unscheduled' ? month : new Date(`${month}-01T00:00:00Z`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</h3><ul>{items.map(({ row, value, kind }) => <li key={row.id}><time dateTime={value || undefined}>{shortDate(value) || '—'}</time><button type="button" className="mc-row-link" onClick={() => onSelect(row.id)}>{row.name}<small>{kind} · {row.status}</small></button></li>)}</ul></section>)}</div> : <>
      <div className="mc-roadmap-legend"><span className="mc-legend-baseline">Baseline / target date</span><span className="mc-legend-current">Forecast / actual date</span><span className="mc-legend-variance">Variance</span><Status label="Achieved" tone="success" /><Status label="At risk" tone="warning" /><Status label="Overdue / blocked" tone="danger" /><span className="mc-legend-data-date">Data date {shortDate(dataDate)}</span></div>
      <div className="mc-roadmap-scroll" role="region" aria-label="Milestone timeline" tabIndex={0}><table className="mc-roadmap"><thead><tr><th scope="col">Milestone</th><th scope="col"><div className="mc-roadmap-heading">{months.map(month => <span key={month.label} style={{ left: `${month.left}%` }}>{month.label}</span>)}</div></th></tr></thead><tbody>{rows.map(row => {
        const baseline = row.comparisonDate, current = row.actualDate || row.forecastDate, basis = row.baselineApproved ? 'Approved baseline' : 'Target'
        const labelPosition = Math.max(baseline ? position(baseline) : 0, current ? position(current) : 0)
        return <tr key={row.id} className={`mc-roadmap-row ${selectedId === row.id ? 'is-selected' : ''}`}><td title={row.name}><button type="button" className="mc-row-link" onClick={() => onSelect(row.id)}>{row.name}</button></td><td><div className="mc-roadmap-track">{months.map(month => <span key={month.label} className="mc-month-gridline" style={{ left: `${month.left}%` }} />)}
          {baseline && current && <span className={`mc-variance-line mc-${row.tone}`} style={{ left: `${Math.min(position(baseline), position(current))}%`, width: `${Math.abs(position(current) - position(baseline))}%` }} />}
          {baseline && <button type="button" className="mc-baseline-point" style={{ left: `${position(baseline)}%` }} aria-label={`${row.name}: ${basis} ${date(baseline)}`} title={`${basis}: ${date(baseline)}`} onClick={() => onSelect(row.id)} />}
          {current && <button type="button" className={`mc-current-point mc-${row.tone}`} style={{ left: `${position(current)}%` }} aria-label={`${row.name}: ${row.actualDate ? 'Actual' : 'Forecast'} ${date(current)}`} title={`${row.actualDate ? 'Actual' : 'Forecast'}: ${date(current)}`} onClick={() => onSelect(row.id)} />}
          {(current || baseline) && <span className="mc-point-label" style={{ left: `${labelPosition}%`, ...(labelPosition > 82 ? { transform: 'translateX(-100%)', marginLeft: '-8px' } : {}) }}>{shortDate(current || baseline)}{row.varianceDays > 0 ? ` +${row.varianceDays}d` : ''}</span>}
          {!current && !baseline && <span className="mc-point-label">Date missing</span>}
          {dataDate && <span className="mc-data-date-line" style={{ left: `${position(dataDate)}%` }} />}
        </div></td></tr>
      })}</tbody></table></div>
    </>}
  </Panel>
}

function Register({ rows, total, selectedId, onSelect, unavailable, loading }) {
  return <Panel title="Milestone register" icon={ListChecks} className="mc-register-panel" actions={<span>{rows.length === total ? `${total} milestones` : `${rows.length} of ${total} milestones`}</span>}>
    {rows.length ? <Table name="Milestone register records" className="mc-register-table" headings={['ID', 'Milestone', 'Type', 'Baseline / target', 'Forecast / Actual', 'Variance', 'Status', 'Owner', 'Evidence', 'Action']}>{rows.map(row => <tr key={row.id} className={selectedId === row.id ? 'is-selected' : ''}><td>{row.code}</td><td><button type="button" className="mc-row-link" onClick={() => onSelect(row.id)}>{row.name}</button></td><td>{row.type === 'project' ? 'Project' : 'Schedule'}</td><td title={row.varianceBasis}>{date(row.comparisonDate)}{!row.baselineApproved && <small>Target</small>}</td><td>{row.actualDate ? <>{date(row.actualDate)}<small>Actual</small></> : row.forecastDate ? date(row.forecastDate) : 'Not recorded'}</td><td className={row.varianceDays > 0 ? 'mc-danger' : ''} title={row.varianceBasis}>{variance(row.varianceDays)}</td><td><Status label={row.status} tone={row.tone} /></td><td>{row.owner || 'Unassigned'}</td><td>{row.evidence ? `${row.evidence.length} items` : 'Not configured'}</td><td><button type="button" className="pp-button" onClick={() => onSelect(row.id)}>{['Blocked', 'Overdue', 'At risk'].includes(row.status) ? 'Review' : 'Open'}</button></td></tr>)}</Table> : <Empty>{loading ? 'Loading milestones…' : unavailable ? 'Milestone data is unavailable. Refresh to retry.' : total ? 'No milestones match these filters.' : 'No milestones recorded. Add a project milestone or import from schedule.'}</Empty>}
  </Panel>
}

function Details({ row, onEdit, onOpenSchedule, onDialog }) {
  const predecessors = row?.dependencies?.filter(item => item.direction === 'predecessor') || []
  return <Panel title="Milestone details" icon={ListChecks} className="mc-details-panel" actions={<TextButton onClick={() => onDialog({ type: 'history', rowId: row?.id })} arrow>Activity history</TextButton>}>
    {!row ? <Empty>Select a milestone to view its dates, dependencies, and evidence readiness.</Empty> : <>
      <div className="mc-details-title"><div><h3>{row.name}</h3><small>{row.code} · {row.typeLabel} · <Status label={row.status} tone={row.tone} /></small></div><div className="mc-panel-actions">{row.canEdit && <button type="button" className="pp-button pp-primary" onClick={() => onEdit(row)}>Edit milestone</button>}{row.source === 'schedule' && <button type="button" className="pp-button pp-primary" onClick={onOpenSchedule}>Update forecast</button>}</div></div>
      <dl className="mc-details-facts"><div><dt>{row.baselineApproved ? 'Baseline date' : 'Target date'}</dt><dd>{date(row.comparisonDate)} {row.baselineApproved && <Lock size={11} aria-label="Approved baseline" />}</dd></div><div><dt>{row.actualDate ? 'Actual completion' : 'Current forecast'}</dt><dd>{date(row.actualDate || row.forecastDate)}</dd></div><div><dt>Variance</dt><dd className={row.varianceDays > 0 ? 'mc-danger' : ''}>{variance(row.varianceDays)}</dd></div><div><dt>Owner</dt><dd>{row.owner || 'Unassigned'}</dd></div></dl>
      <div className="mc-details-body"><div><h4>Linked schedule activity</h4>{row.linkedActivity ? <><TextButton onClick={onOpenSchedule}><Link2 aria-hidden="true" />{row.linkedActivity.code} {row.linkedActivity.name || ''}</TextButton>{row.imported && <p>Imported target. Approved dates remain in the linked schedule.</p>}</> : <p>No schedule activity linked.</p>}<h4>Acceptance criteria</h4>{row.criteria?.length ? <ul className="mc-criteria-list">{row.criteria.map(item => <li key={item.id}>{item.name}</li>)}</ul> : <p>Not configured for this milestone. Completion is recorded separately from acceptance.</p>}<h4>Recorded blocker</h4><p>{row.blocker || (row.blockerAvailable ? 'No open blocker recorded.' : 'Blocker tracking is unavailable for this record.')}</p></div><div><h4><Paperclip size={13} aria-hidden="true" /> Evidence</h4><p>{row.evidence?.length ? `${row.evidence.length} items linked.` : 'No milestone evidence linked. Acceptance has not been verified.'}</p><h4>Dependency</h4>{predecessors.length ? predecessors.map(item => <p key={item.id}>{item.name} · {item.relationshipType}{item.lagDays ? ` +${item.lagDays}d` : ''}</p>) : <p>{row.dependencies ? 'No predecessor relationship recorded.' : 'Dependencies are not available for this record.'}</p>}<h4>Recorded notes</h4><p>{row.description || 'No forecast rationale recorded.'}</p></div></div>
    </>}
  </Panel>
}

function Actions({ actions, onAction, onViewAll, all = false }) {
  const shown = all ? actions : actions.slice(0, 4)
  const table = actions.length ? <Table name="Milestone action records" headings={['Priority', 'Action', 'Owner', 'Due date', 'Action']} className="mc-actions-table">{shown.map(action => <tr key={action.id}><td><Status label={action.priority === 'high' ? 'High' : 'Medium'} tone={action.priority} /></td><td><strong>{action.title}</strong>{all && <small>{action.detail}</small>}</td><td>Unassigned</td><td>—</td><td><button type="button" className="pp-button" onClick={() => onAction(action)}>{action.button}</button></td></tr>)}</Table> : <Empty>No actions derived from the available milestone records.</Empty>
  return all ? table : <Panel title="Milestone actions" icon={ListChecks} className="mc-actions-panel" actions={<><span>{actions.length} open actions</span><TextButton onClick={onViewAll} arrow>View all</TextButton></>}>{table}</Panel>
}

function Evidence({ rows, onReview, all = false }) {
  return <Panel title="Acceptance & evidence" icon={ShieldCheck} className="mc-evidence-panel" actions={onReview && <TextButton onClick={onReview}>Review evidence</TextButton>}>
    {rows.length ? <Table name="Milestone evidence readiness" headings={['Milestone', 'Milestone owner', 'Required item', 'Baseline / target', 'Status']}>{(all ? rows : rows.slice(0, 4)).map(row => <tr key={row.id}><td>{row.code} {row.name}</td><td>{row.owner || 'Unassigned'}</td><td>Not configured</td><td>{date(row.comparisonDate)}</td><td><Status label="Not assessed" tone="warning" /></td></tr>)}</Table> : <Empty>No milestone evidence records available.</Empty>}
  </Panel>
}
function Downstream({ row, onOpenSchedule }) {
  const dependencies = row?.dependencies?.filter(item => item.direction === 'successor') || []
  return <Panel title="Downstream impact" icon={Link2} className="mc-downstream-panel" actions={<TextButton onClick={onOpenSchedule}>Review dependencies</TextButton>}>
    {dependencies.length ? <Table name="Downstream schedule dependencies" headings={['Linked activity', 'Relationship', 'Recorded date', 'Status']}>{dependencies.map(item => <tr key={item.id}><td>{item.name}</td><td>{item.relationshipType}{item.lagDays ? ` +${item.lagDays}d` : ''}</td><td>{date(item.actualDate || item.forecastDate || item.targetDate)}<small>{item.actualDate ? 'Actual' : item.forecastDate ? 'Forecast' : 'Target'}</small></td><td>{item.status}</td></tr>)}</Table> : <p className="mc-note"><Info aria-hidden="true" />{row?.dependencies ? 'No downstream relationships recorded for the selected milestone.' : 'Select a linked schedule milestone to review its recorded dependencies.'}</p>}
    <p className="mc-warning-note"><AlertTriangle aria-hidden="true" />Finish impact is not calculated until dependencies and milestone dates are validated.</p>
  </Panel>
}

export default function MilestoneControlTab({ project, milestoneControl, milestoneDialog, onMilestoneDialog, onOpenSchedule, onSelectView }) {
  const { model, loading, issues, reload } = milestoneControl
  const [mode, setMode] = useState('management'), [roadmapView, setRoadmapView] = useState('timeline')
  const [selectedId, setSelectedId] = useState(null), [search, setSearch] = useState('')
  const [type, setType] = useState('all'), [status, setStatus] = useState('all'), [owner, setOwner] = useState('all'), [dateRange, setDateRange] = useState('all')
  const [filters, setFilters] = useState(false), [source, setSource] = useState('all'), [critical, setCritical] = useState(false), [missingOnly, setMissingOnly] = useState(false)
  const [feedback, setFeedback] = useState('')
  const filtered = useMemo(() => model.rows.filter(row => (type === 'all' || row.type === type) && (status === 'all' || row.status === status) && (owner === 'all' || (owner === 'unassigned' ? !row.owner : row.owner === owner)) && (source === 'all' || row.source === source) && (!critical || row.isCritical) && (!missingOnly || missingSetup(row)) && (dateRange === 'all' || (dateRange === 'next30' ? row.dueSoon : row.overdue)) && `${row.name} ${row.code} ${row.linkedActivity?.code || ''}`.toLowerCase().includes(search.trim().toLowerCase())), [model.rows, type, status, owner, source, critical, missingOnly, dateRange, search])
  const selected = filtered.find(row => row.id === selectedId) || filtered[0] || null
  const dialogRow = milestoneDialog?.rowId ? model.rows.find(row => row.id === milestoneDialog.rowId) : selected
  const openDialog = onMilestoneDialog
  const closeDialog = () => openDialog(null)
  const openSchedule = () => { openDialog(null); onOpenSchedule() }
  const clearFilters = () => { setSearch(''); setType('all'); setStatus('all'); setOwner('all'); setSource('all'); setCritical(false); setMissingOnly(false); setDateRange('all') }
  const action = item => {
    if (item.view === 'planner') { openSchedule(); return }
    openDialog(null)
    if (item.view === 'register') { clearFilters(); setMode('register'); if (item.id === 'overdue') setDateRange('overdue'); if (item.id === 'blocked') setStatus('Blocked'); if (item.rowId) setSelectedId(item.rowId) }
    else openDialog({ type: 'quality' })
  }
  const saved = row => { openDialog(null); clearFilters(); setSelectedId(`project:${row.id}`); setFeedback('Milestone saved.'); reload() }
  const kpis = [
    { label: 'Total milestones', value: model.counts.total, hint: model.countsComplete ? 'Combined project register' : 'Available records', icon: Flag },
    { label: 'Achieved', value: model.counts.achieved, hint: 'Completion reported', icon: CheckCircle2, tone: 'success' },
    { label: 'Due next 30 days', value: model.counts.dueSoon, hint: 'From the reporting date', icon: CalendarDays },
    { label: 'Overdue', value: model.counts.overdue, hint: 'Action required', icon: Clock3, tone: 'danger' },
    { label: 'Blocked', value: model.counts.blocked, hint: 'Recorded schedule blockers', icon: XCircle, tone: 'danger' },
    { label: 'Forecast confidence', value: 'Not assessed', hint: 'Setup incomplete', icon: BarChart3, tone: 'warning' },
  ]
  const register = <Register rows={filtered} total={model.rows.length} selectedId={selected?.id} onSelect={setSelectedId} unavailable={issues.length > 0} loading={loading} />
  const details = <Details row={selected} onEdit={row => openDialog({ type: 'edit', rowId: row.id })} onOpenSchedule={openSchedule} onDialog={openDialog} />
  return <div className="mc-workspace" aria-busy={loading}>
    <div className="mc-toolbar"><div className="mc-mode-switch">{['Management', 'Register'].map(item => <button type="button" key={item} aria-pressed={mode === item.toLowerCase()} onClick={() => setMode(item.toLowerCase())}>{item}</button>)}</div>
      <Field label="Type" value={type} onChange={setType} options={[{ id: 'all', label: 'All types' }, ...model.types]} />
      <Field label="Status" value={status} onChange={setStatus} options={[{ id: 'all', label: 'All statuses' }, ...['Achieved', 'Overdue', 'Blocked', 'At risk', 'Due soon', 'Upcoming', 'Unscheduled'].map(label => ({ id: label, label }))]} />
      <Field label="Owner" value={owner} onChange={setOwner} options={[{ id: 'all', label: 'All owners' }, { id: 'unassigned', label: 'Unassigned' }, ...model.owners.map(label => ({ id: label, label }))]} />
      <Field label="Date range" value={dateRange} onChange={setDateRange} options={[{ id: 'all', label: 'Full project' }, { id: 'next30', label: 'Next 30 days' }, { id: 'overdue', label: 'Overdue' }]} />
      <label className="mc-toolbar-search"><Search aria-hidden="true" /><input type="search" aria-label="Search milestone or reference" placeholder="Search milestone or reference" value={search} onChange={event => setSearch(event.target.value)} /></label>
      <button type="button" className="pp-button" aria-expanded={filters} onClick={() => setFilters(!filters)}><SlidersHorizontal aria-hidden="true" />Filters</button><label className="mc-critical-toggle"><input type="checkbox" checked={critical} onChange={event => setCritical(event.target.checked)} />Critical only</label><span className="mc-readonly-note"><Info aria-hidden="true" />Approved baseline dates are read only.</span>
    </div>
    {filters && <div className="mc-filters"><Field label="Source" value={source} onChange={setSource} options={[{ id: 'all', label: 'All sources' }, { id: 'project', label: 'Project register' }, { id: 'schedule', label: 'Schedule activity' }]} /><label><input type="checkbox" checked={missingOnly} onChange={event => setMissingOnly(event.target.checked)} />Missing setup only</label><TextButton onClick={clearFilters}>Clear filters</TextButton><span title={model.dataDateSource}>Data date: {date(model.dataDate)}</span></div>}
    {!!issues.length && <div className="mc-warning-note" role="alert"><AlertTriangle aria-hidden="true" />{issues.join(' ')}</div>}
    {feedback && <div className="mc-note" role="status"><CheckCircle2 aria-hidden="true" />{feedback}</div>}
    <div className="mc-setup-warning"><AlertTriangle aria-hidden="true" /><span><strong>Milestone setup is incomplete</strong><br />Record milestone dates, acceptance criteria and evidence before relying on finish forecasts.</span><div className="mc-warning-actions"><button type="button" className="pp-button pp-primary" onClick={() => openDialog({ type: 'quality' })}>Review missing milestones</button><button type="button" className="pp-button" disabled={!model.canCreate} onClick={() => openDialog({ type: 'import' })}>Import from schedule</button></div></div>
    <section className="mc-kpis" aria-label="Milestone indicators">{kpis.map(({ label, value, hint, icon: Icon, tone = 'blue' }) => <article key={label} className={`mc-kpi mc-${tone}`}><Icon aria-hidden="true" /><div className="mc-kpi-copy"><span>{label}</span><strong>{loading ? '…' : !model.rows.length && issues.length && typeof value === 'number' ? '—' : value}</strong><small>{!model.countsComplete && typeof value === 'number' ? 'Partial data ? ' : ''}{hint}</small></div></article>)}</section>
    {mode === 'management' ? <div className="mc-grid"><div className="mc-left"><Roadmap rows={filtered} selectedId={selected?.id} onSelect={setSelectedId} dataDate={model.dataDate} onOpenSchedule={openSchedule} view={roadmapView} onView={setRoadmapView} />{register}<Evidence rows={filtered} onReview={() => openDialog({ type: 'evidence' })} /></div><div className="mc-right"><Actions actions={model.actions} onAction={action} onViewAll={() => openDialog({ type: 'actions' })} />{details}<Downstream row={selected} onOpenSchedule={openSchedule} /></div></div> : <div className="mc-register-mode">{register}{details}</div>}
    <section className="mc-quality" aria-label="Milestone data quality"><h2>Milestone data quality</h2>{model.quality.map(item => <button type="button" key={item.id} className={`mc-${item.tone}`} onClick={() => openDialog({ type: 'quality' })}>{item.ready ? <CheckCircle2 aria-hidden="true" /> : <AlertTriangle aria-hidden="true" />}<span><small>{item.label}</small><strong>{item.status}</strong></span></button>)}<button type="button" className="pp-button" onClick={() => openDialog({ type: 'quality' })}>Review milestone data</button></section>
    {milestoneDialog?.type === 'create' && model.canCreate && <MilestoneForm project={project} onClose={closeDialog} onSaved={saved} />}
    {milestoneDialog?.type === 'edit' && dialogRow?.canEdit && <MilestoneForm project={project} row={dialogRow} onClose={closeDialog} onSaved={saved} />}
    {milestoneDialog?.type === 'import' && model.canCreate && <MilestoneImport project={project} candidates={model.importCandidates} onClose={changed => { closeDialog(); if (changed) reload() }} onOpenSchedule={openSchedule} onSaved={count => { openDialog(null); clearFilters(); setFeedback(`${count} milestone${count === 1 ? '' : 's'} imported.`); reload() }} />}
    {milestoneDialog?.type === 'actions' && <MilestoneDialog title="Milestone actions" onClose={closeDialog}><Actions actions={model.actions} onAction={action} all /></MilestoneDialog>}
    {milestoneDialog?.type === 'quality' && <MilestoneDialog title="Milestone data quality" onClose={closeDialog} footer={<><button type="button" className="pp-button" onClick={closeDialog}>Close</button><button type="button" className="pp-button pp-primary" onClick={openSchedule}>Open schedule</button></>}><p>{model.readinessNote}</p><Table name="Milestone source readiness" headings={['Source', 'Status', 'Details']}>{model.quality.map(item => <tr key={item.id}><td>{item.label}</td><td><Status label={item.status} tone={item.tone} /></td><td>{item.detail}</td></tr>)}</Table><p className="mc-note">Data date: {date(model.dataDate)}. {model.dataDateSource}. Project targets do not change approved schedule baselines.</p></MilestoneDialog>}
    {milestoneDialog?.type === 'evidence' && <MilestoneDialog title="Milestone evidence" onClose={closeDialog} footer={<><button type="button" className="pp-button" onClick={closeDialog}>Close</button><button type="button" className="pp-button pp-primary" onClick={() => { openDialog(null); onSelectView('documents') }}>Open project documents</button></>}><p>No milestone evidence is linked. The project register does not yet record acceptance criteria, evidence attachments, or approvals.</p><p>Project documents are available separately; a document alone does not confirm milestone acceptance.</p><Evidence rows={model.rows} all /></MilestoneDialog>}
    {milestoneDialog?.type === 'history' && <MilestoneDialog title="Milestone activity history" onClose={closeDialog}><h3>{dialogRow?.name || 'Select a milestone'}</h3>{dialogRow?.activityHistory?.length ? <Table name="Recorded milestone history" headings={['Time', 'Action', 'User', 'Source']}>{dialogRow.activityHistory.map(event => <tr key={event.id}><td>{date(event.date)}</td><td>{event.title}</td><td>{event.actor || 'Not recorded'}</td><td>{event.entityType}</td></tr>)}</Table> : <p>{dialogRow?.activityHistory ? 'No changes are recorded for this linked schedule activity.' : 'Activity history is unavailable for this milestone.'}</p>}{dialogRow?.createdAt && <p>Project record created: {date(dialogRow.createdAt)}</p>}</MilestoneDialog>}
  </div>
}
