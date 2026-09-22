import { useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import { Activity, AlertCircle, AlertTriangle, ArrowRight, BarChart3, CalendarDays, CheckCircle2, ChevronRight, FileText, Flag, Info, ShieldCheck, Wallet } from 'lucide-react'
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import '@fontsource/ibm-plex-sans/400.css'
import '@fontsource/ibm-plex-sans/500.css'
import '@fontsource/ibm-plex-sans/600.css'
import '@fontsource/ibm-plex-sans/700.css'
import { formatDate, formatDateTime, formatMoney } from './useProjectPerformance'
import './ProjectDetailsOverview.css'

const known = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value))
const number = (value, digits = 1) => known(value) ? Number(value).toLocaleString('en-GB', { maximumFractionDigits: digits }) : '—'
const percent = value => known(value) ? `${number(value)}%` : 'Not available'
const index = value => known(value) ? Number(value).toFixed(2) : 'Not available'
const shortDate = value => formatDate(value, 'Not recorded')
const month = value => value ? new Date(`${String(value).slice(0, 10)}T12:00:00`).toLocaleDateString('en-GB', { month: 'short' }) : ''
const capitalize = value => String(value || 'Not specified').replaceAll('_', ' ').replace(/^./, letter => letter.toUpperCase())
const severity = value => ['critical', 'high', 'danger', 'error'].includes(value) ? 'danger' : ['medium', 'warning', 'pending', 'processing', 'queued'].includes(value) ? 'warning' : ['success', 'completed', 'done', 'processed', 'low'].includes(value) ? 'success' : 'neutral'
const compactMoney = (value, currency) => known(value) ? `${currency || ''} ${Number(value).toLocaleString('en-GB', { notation: 'compact', maximumFractionDigits: 1 })}`.trim() : 'Not available'
const exactMoney = (value, currency) => known(value) ? `${currency || 'Currency not recorded'} ${Number(value).toLocaleString('en-GB', { maximumFractionDigits: 20 })}` : 'Not available'
const panelNotes = {
  'Progress performance': 'Only recorded sealed reporting-period observations are shown. Open Reporting source for provenance.',
  'Priority actions': 'Actions identified from current project records. Suggested reviewers are not recorded assignments.',
  'Cost position': 'Recorded control budget, posted actual costs, commitments and the sealed estimate at completion. Commitments may overlap actual costs.',
  'Upcoming milestones': 'Outstanding recorded milestones, including overdue milestones, ordered by target date.',
  'Risk & change exposure': 'Open recorded risks and pending changes. The heatmap groups the original 1-5 assessment ratings into low, medium and high.',
  Deliverables: 'Uploaded project documents. Processing status does not indicate engineering approval.',
  'Recent activity': 'Recent commercial and planning audit entries, plus document registrations. This is a bounded recent history.',
}


function Panel({ title, children, action, className = '', controls }) {
  return <section className={`pdo-panel ${className}`} aria-label={title}><header className="pdo-panel-heading"><h2>{title}<span className="pdo-panel-info" title={panelNotes[title]}><Info size={13} aria-hidden="true" /></span></h2>{controls || action && <button type="button" className="pdo-text-button" onClick={action.onClick}>{action.label}<ChevronRight size={14} /></button>}</header>{children}</section>
}
Panel.propTypes = { title: PropTypes.string.isRequired, icon: PropTypes.elementType.isRequired, children: PropTypes.node.isRequired, action: PropTypes.object, className: PropTypes.string, controls: PropTypes.node }

function EmptyState({ children, unavailable = false }) {
  return <div className="pdo-empty">{unavailable ? <AlertCircle size={21} /> : <FileText size={21} />}<span>{children}</span></div>
}
EmptyState.propTypes = { children: PropTypes.node.isRequired, unavailable: PropTypes.bool }

function ProgressChart({ model, tab, onSelect }) {
  const points = model.chartPoints || []
  const hasPlanned = points.some(point => known(point.planned)), hasActual = points.some(point => known(point.actual))
  const latest = points.at(-1)
  if (tab === 'schedule') return <div className="pdo-schedule-view"><dl>
    <div><dt>Schedule performance index</dt><dd>{index(model.spi)}</dd></div>
    <div><dt>{model.baselineApproved ? 'Approved baseline finish' : 'Working planned finish'}</dt><dd>{shortDate(model.baselineFinish)}</dd></div>
    <div><dt>Working forecast finish</dt><dd>{shortDate(model.forecastFinish)}</dd></div>
    <div><dt>Progress variance</dt><dd>{known(model.variance) ? `${model.variance > 0 ? '+' : ''}${number(model.variance)} percentage points` : 'Not available'}</dd></div>
  </dl><p>{model.forecastWarning || model.baselineSource || 'Review the recorded dates and reporting period before interpreting schedule performance.'}</p><button type="button" className="pdo-button" onClick={() => onSelect('plan-baseline')}>Open schedule<ArrowRight size={14} /></button></div>
  return <>
    <div className="pdo-chart-legend">{hasPlanned && <span><i className="pdo-planned" />Planned</span>}{hasActual && <span><i className="pdo-actual" />Actual</span>}<span className="pdo-chart-date">{model.dataDate ? `Data date: ${shortDate(model.dataDate)}` : 'Data date not recorded'}</span></div>
    {points.length && (hasPlanned || hasActual) ? <div className="pdo-chart-canvas" role="img" aria-label={`Progress history: ${points.length} recorded periods. Latest planned ${percent(latest?.planned)}, actual ${percent(latest?.actual)}.`}>
      <ResponsiveContainer width="100%" height="100%"><LineChart data={points} margin={{ top: 5, right: 17, bottom: 0, left: -15 }}>
        <CartesianGrid vertical={false} stroke="var(--pdo-grid)" strokeDasharray="3 3" />
        <XAxis dataKey="date" tickFormatter={month} tick={{ fill: 'var(--pdo-muted)', fontSize: 10 }} axisLine={{ stroke: 'var(--pdo-line)' }} tickLine={false} minTickGap={25} />
        <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={value => `${value}%`} tick={{ fill: 'var(--pdo-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
        <Tooltip labelFormatter={shortDate} formatter={(value, label) => [percent(value), label]} contentStyle={{ background: 'var(--pdo-surface)', color: 'var(--pdo-ink)', borderColor: 'var(--pdo-line)', borderRadius: 5, fontSize: 12 }} />
        {latest?.date && <ReferenceLine x={latest.date} stroke="var(--pdo-muted)" strokeDasharray="3 3" />}
        {hasPlanned && <Line name="Planned progress" dataKey="planned" type="linear" stroke="#3976ec" strokeWidth={2} dot={{ r: 2.5 }} activeDot={{ r: 4 }} connectNulls={false} isAnimationActive={false} />}
        {hasActual && <Line name="Actual progress" dataKey="actual" type="linear" stroke="#169c5a" strokeWidth={2.5} dot={{ r: 2.5 }} activeDot={{ r: 4 }} connectNulls={false} isAnimationActive={false} />}
      </LineChart></ResponsiveContainer>
    </div> : <EmptyState unavailable={model.availability?.snapshots === false}>{model.availability?.snapshots === false ? 'Progress history unavailable.' : 'No sealed progress history is recorded.'}</EmptyState>}
    <div className="pdo-chart-source"><span title={model.chartNote}>{model.chartSource || 'Sealed reporting periods'}{model.reportingVersion != null ? ` · v${model.reportingVersion}` : ''}. Recorded observations only.</span><button type="button" onClick={() => onSelect('reporting-source')}>Reporting source<ChevronRight size={12} /></button></div>
  </>
}
ProgressChart.propTypes = { model: PropTypes.object.isRequired, tab: PropTypes.string.isRequired, onSelect: PropTypes.func.isRequired }

function RiskHeatmap({ risk, available }) {
  const map = useMemo(() => {
    const cells = Array.from({ length: 9 }, () => 0)
    let assessed = 0, unassessed = 0
    const bin = rating => rating <= 2 ? 0 : rating === 3 ? 1 : 2
    for (const row of risk?.risks || []) {
      if (!row.isOpen) continue
      const probability = row.assessment?.inherentProbability, impact = row.assessment?.inherentImpact
      if (![probability, impact].every(value => Number.isInteger(value) && value >= 1 && value <= 5)) { unassessed += 1; continue }
      cells[bin(probability) * 3 + bin(impact)] += 1; assessed += 1
    }
    return { cells, assessed, unassessed }
  }, [risk])
  if (!available) return <EmptyState unavailable>{risk?.availability?.notConfigured ? 'Risk register not connected.' : 'Risk register unavailable.'}</EmptyState>
  return <div className="pdo-risk-map" role="img" aria-label={`Open risk assessment heatmap. Impact increases vertically; probability increases horizontally. ${map.assessed} assessed, ${map.unassessed} unassessed. Ratings 1–2 low, 3 medium, 4–5 high.`}>
    <span className="pdo-heatmap-y-label">Impact</span><div className="pdo-heatmap">{[2, 1, 0].flatMap(impact => [0, 1, 2].map(probability => <span key={`${probability}-${impact}`} className={`pdo-heat-cell pdo-heat-${probability + impact}`} title={`${['Low', 'Medium', 'High'][probability]} probability / ${['Low', 'Medium', 'High'][impact]} impact: ${map.cells[probability * 3 + impact]} open risks`}>{map.cells[probability * 3 + impact] || '·'}</span>))}</div>
    <span className="pdo-heatmap-x-label">Probability →</span><small>{map.unassessed} unassessed</small><span className="pdo-heatmap-note">Low 1–2 · Medium 3 · High 4–5</span>
  </div>
}
RiskHeatmap.propTypes = { risk: PropTypes.object, available: PropTypes.bool }

export function OverviewActivityList({ activity, onSelect, limit = 5 }) {
  if (!activity?.available) return <EmptyState unavailable>Recent activity is unavailable.</EmptyState>
  if (!activity.rows?.length) return <EmptyState>{activity.complete === false ? 'No activity in the available sources. Some activity sources are unavailable.' : 'No recorded project activity.'}</EmptyState>
  return <>{activity.complete === false && <p className="pdo-partial-note">Some activity sources are unavailable; this history is incomplete.</p>}<div className="pdo-table-scroll"><table className="pdo-activity-table" data-table-typography="preserve" aria-label="Recent activity records"><thead><tr><th scope="col">Date &amp; time</th><th scope="col">User</th><th scope="col">Activity</th><th scope="col">Details</th><th scope="col">View</th></tr></thead><tbody>{activity.rows.slice(0, limit).map(event => <tr key={event.id}><td title={formatDateTime(event.date)}><time>{formatDateTime(event.date, 'Not recorded')}</time></td><td title={event.actor || 'Not recorded'}>{event.actor || 'Not recorded'}</td><td title={event.title}>{event.title}</td><td title={event.detail || event.source}>{event.detail || event.source || 'Not recorded'}</td><td><button type="button" className="pdo-event-open" aria-label={`View ${event.title}`} onClick={() => onSelect(event.view || 'activity', event.documentId)}><ChevronRight size={13} /></button></td></tr>)}</tbody></table></div></>
}
OverviewActivityList.propTypes = { activity: PropTypes.object, onSelect: PropTypes.func.isRequired, limit: PropTypes.number }

export default function ProjectDetailsOverview({ performance, onSelectView, onEdit, onOpenDialog, onOpenDocument }) {
  const [chartTab, setChartTab] = useState('progress')
  const { model, loading, issues = [], reload } = performance
  const action = (view, documentId) => {
    if (documentId != null && onOpenDocument) onOpenDocument(documentId)
    else if (view === 'edit-project') onEdit()
    else if (['data-quality', 'actions', 'activity', 'reporting-source'].includes(view)) onOpenDialog(view)
    else onSelectView(view || 'project-dashboard')
  }
  if (loading || !model) return <div className="project-details-overview pd-overview pdo-loading" role="status"><span>Loading project performance...</span><div /><div /><div /></div>
  const milestoneRows = model.milestones || [], completed = milestoneRows.filter(item => item.is_completed).length
  const milestonesKnown = model.milestones != null, openMilestones = milestoneRows.filter(item => !item.is_completed).slice(0, 3)
  const progressKnown = known(model.progress), milestonePercent = milestonesKnown && milestoneRows.length ? completed / milestoneRows.length * 100 : null
  const actions = model.actions || [], priorityActions = actions.slice(0, 3)
  const nextMilestone = milestoneRows.find(item => !item.is_completed && item.target_date && !(model.overdueMilestones || []).some(overdue => overdue.id === item.id))
  const hasAttention = actions.length > 0 || issues.length > 0
  const deliverables = model.deliverables, activity = model.recentActivity || {
    available: model.recentEvents != null, rows: (model.recentEvents || []).map(event => ({ id: `commercial-${event.id}`, date: event.event_at,
      title: event.event_type_display || capitalize(event.event_type), actor: event.actor, source: capitalize(event.source_type), view: 'commercial-dashboard' })),
  }
  const exposure = model.riskExposure, costGroups = exposure?.costByCurrency || []
  const costComparable = model.costPositionComparable === true && known(model.budget) && model.budget > 0 && known(model.actual) && model.actual >= 0
  const spentPercent = costComparable ? Math.min(100, model.actual / model.budget * 100) : null
  const spiHistory = model.spiHistory || [], spiObservationCount = spiHistory.filter(point => known(point.spi)).length
  const kpis = [
    { label: 'Physical progress', value: percent(model.progress), detail: known(model.plannedProgress) ? `Planned ${percent(model.plannedProgress)}${known(model.variance) ? ` · ${model.variance > 0 ? '+' : ''}${number(model.variance)} pp` : ''}` : model.progressSource || 'Reporting source unavailable', icon: BarChart3, tone: 'warning', progress: progressKnown ? model.progress : null, view: 'reporting-source' },
    { label: 'Schedule', value: known(model.spi) ? model.spi < 1 ? 'At risk' : 'On plan' : 'Not available', detail: known(model.spi) ? `SPI ${index(model.spi)} · Sealed reporting period` : 'No sealed performance index', icon: CalendarDays, tone: known(model.spi) && model.spi < 1 ? 'warning' : 'blue', view: 'reporting-source' },
    { label: 'Cost', value: known(model.cpi) ? model.cpi >= 1 ? 'Within cost plan' : 'Over cost plan' : 'Not available', detail: model.legacyCostBasis ? 'Legacy period cost basis' : known(model.cpi) ? `CPI ${index(model.cpi)}${known(model.eac) ? ` · EAC ${formatMoney(model.eac, model.reportingCurrency || model.currency)}` : ''}` : 'No sealed performance index', icon: Wallet, tone: known(model.cpi) ? model.cpi >= 1 ? 'success' : 'warning' : 'neutral', view: 'reporting-source' },
    { label: 'Milestones', value: milestonesKnown ? `${completed} of ${milestoneRows.length} achieved` : 'Not available', detail: !milestonesKnown ? 'Milestone register unavailable' : nextMilestone ? `Next due ${shortDate(nextMilestone.target_date)}` : model.overdueMilestones?.length ? `${model.overdueMilestones.length} overdue milestones` : milestoneRows.length ? `${milestoneRows.length - completed} outstanding milestones` : 'No milestones recorded', icon: Flag, tone: 'blue', progress: milestonePercent, view: 'milestones' },
  ]
  return <div className="project-details-overview pd-overview" role="region" aria-label="Project overview">
    <section className="pdo-kpis" aria-label="Performance indicators">{kpis.map(({ label, value, detail, icon: Icon, tone, progress, view }) => <button type="button" className={`pdo-kpi pdo-${tone}`} key={label} aria-label={label} onClick={() => action(view)}><span className="pdo-kpi-top"><span>{label}</span><Icon size={20} /></span><strong className={value === 'Not available' ? 'is-unavailable' : label === 'Physical progress' ? undefined : 'pdo-status-value'}>{value}</strong>{label === 'Schedule' && spiObservationCount >= 2 && <span className="pdo-kpi-sparkline" role="img" aria-label={`Schedule SPI history: ${spiObservationCount} recorded sealed observations`}><ResponsiveContainer width="100%" height="100%"><LineChart data={spiHistory} margin={{ top: 2, right: 1, bottom: 2, left: 1 }}><Line dataKey="spi" type="linear" stroke="var(--pdo-accent)" strokeWidth={1.5} dot={false} connectNulls={false} isAnimationActive={false} /></LineChart></ResponsiveContainer></span>}<span className="pdo-kpi-detail" title={detail}>{detail}<ChevronRight size={13} /></span>{progress != null && <span className="pdo-kpi-track" aria-hidden="true"><i style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} /></span>}</button>)}</section>
    <section className={`pdo-attention ${hasAttention ? 'pdo-warning' : 'pdo-success'}`} aria-label="Project attention"><span>{hasAttention ? <AlertTriangle size={17} /> : <CheckCircle2 size={17} />}<strong>{hasAttention ? 'Attention required' : 'No flagged exceptions'}</strong><span>{issues.length ? `${issues.length} project data source${issues.length === 1 ? ' is' : 's are'} unavailable.` : actions.length ? `${actions.length} ${actions.length === 1 ? 'item needs' : 'items need'} review. ${actions[0]?.title || ''}` : 'Review the current project data and reporting source.'}</span></span><button type="button" onClick={() => action(issues.length ? 'data-quality' : 'actions')}>{issues.length ? 'Review data' : 'Review actions'}<ArrowRight size={14} /></button></section>
    {issues.length > 0 && <div className="pdo-data-issues" role="alert"><span>{issues.map(issue => typeof issue === 'string' ? issue : issue.message).join(' ')}</span><button type="button" className="pdo-text-button" onClick={reload}>Retry data</button></div>}
    <div className="pdo-main-row">
      <Panel title="Progress performance" icon={BarChart3} className="pdo-progress-panel" controls={<div className="pdo-tabs" role="tablist" aria-label="Performance chart view"><button type="button" role="tab" aria-selected={chartTab === 'progress'} onClick={() => setChartTab('progress')}>Progress</button><button type="button" role="tab" aria-selected={chartTab === 'schedule'} onClick={() => setChartTab('schedule')}>Schedule</button></div>}><ProgressChart model={model} tab={chartTab} onSelect={action} /></Panel>
      <Panel title="Priority actions" icon={AlertTriangle} className="pdo-actions-panel" action={{ label: 'View all actions', onClick: () => action('actions') }}>
        {priorityActions.length ? <div className="pdo-table-scroll"><table data-table-typography="preserve" aria-label="Priority actions"><thead><tr><th scope="col">Action</th><th scope="col">Priority</th><th scope="col">Owner</th><th scope="col">Due date</th><th scope="col">Status</th></tr></thead><tbody>{priorityActions.map(item => <tr key={item.id}><td><strong title={item.title}>{item.title}</strong><small title={item.detail}>{item.detail}</small></td><td><span className={`pdo-pill pdo-${severity(item.priority)}`}>{capitalize(item.priority)}</span></td><td title={item.suggestedOwner ? `Suggested reviewer: ${item.suggestedOwner}. No assignment is recorded.` : undefined}>{item.ownerConfirmed === true ? item.owner || 'Not assigned' : 'Not assigned'}</td><td>{shortDate(item.dueDate)}</td><td><button type="button" className="pdo-row-action" aria-label={`Review ${item.title}`} onClick={() => action(item.view)}>{item.button || 'Review'}<ChevronRight size={12} /></button></td></tr>)}</tbody></table></div> : <EmptyState>No priority actions identified from available data.</EmptyState>}
      </Panel>
    </div>
    <div className="pdo-middle-row">
      <Panel title="Cost position" icon={Wallet} className="pdo-cost-panel" action={{ label: 'Open cost control', onClick: () => action('commercial-dashboard') }}>
        <dl className="pdo-cost-values">{[['Control budget', model.budget, model.currency], ['Actual cost', model.actual, model.currency], ['Commitments', model.committed, model.currency], ['EAC', model.eac, model.reportingCurrency || model.currency]].map(([label, value, currency]) => <div key={label}><dt title={label === 'EAC' ? 'Estimate at completion' : label}>{label}</dt><dd title={exactMoney(value, currency)} aria-label={exactMoney(value, currency)}>{compactMoney(value, currency)}</dd></div>)}</dl>
        {costComparable ? <div className="pdo-cost-bar" title="Posted actual cost as a proportion of the control budget. Commitments may overlap actual cost and are not added to this bar."><div role="img" aria-label={`${number(model.actual / model.budget * 100)} percent of the control budget spent`}><i style={{ width: `${spentPercent}%` }} /></div><span><i />Actual cost <strong>{number(model.actual / model.budget * 100)}%</strong><span>{model.actual > model.budget ? 'Over control budget' : 'Unspent budget'}</span></span></div> : <p className="pdo-cost-note">{model.costWarning || 'A comparable control budget and actual cost are required for the cost bar.'}</p>}
        {model.costWarning && costComparable && <p className="pdo-cost-note" title={model.costWarning}>Cost position requires review.</p>}
      </Panel>
      <Panel title="Upcoming milestones" icon={Flag} className="pdo-milestone-panel" action={{ label: 'View all milestones', onClick: () => action('milestones') }}>
        {openMilestones.length ? <ul className="pdo-milestone-list">{openMilestones.map(item => { const overdue = (model.overdueMilestones || []).some(row => row.id === item.id); return <li key={item.id}><Flag size={13} /><button type="button" onClick={() => action('milestones')} title={item.name}>{item.name}</button><span className={overdue ? 'pdo-overdue' : ''}>{shortDate(item.target_date)}</span></li> })}</ul> : <EmptyState unavailable={!milestonesKnown}>{!milestonesKnown ? 'Milestones unavailable.' : milestoneRows.length ? 'No outstanding milestones.' : 'No milestones recorded.'}</EmptyState>}
      </Panel>
      <Panel title="Risk & change exposure" icon={ShieldCheck} className="pdo-risk-panel" action={{ label: 'View risk register', onClick: () => action('risk') }}><div className="pdo-risk-body"><dl className="pdo-risk-values"><div><dt>Open risks</dt><dd>{model.riskAvailable ? number(model.risk?.counts?.openRisks, 0) : 'Not available'}</dd></div><div><dt>Pending changes</dt><dd>{model.risk?.countsComplete ? number(model.risk.counts.pendingChanges, 0) : 'Not available'}</dd></div><div><dt>Assessed cost exposure</dt><dd>{costGroups.length ? costGroups.map(group => <span key={group.currency}>{formatMoney(group.inherent, group.currency)}</span>) : 'Not available'}</dd></div></dl><RiskHeatmap risk={model.risk} available={model.riskAvailable} /></div></Panel>
    </div>
    <div className="pdo-bottom-row">
      <Panel title="Deliverables" icon={FileText} className="pdo-deliverable-panel" action={{ label: 'View all deliverables', onClick: () => action('documents') }}>
        {deliverables?.available && deliverables.rows?.length ? <div className="pdo-table-scroll"><table data-table-typography="preserve" aria-label="Deliverables"><thead><tr><th scope="col">Document</th><th scope="col">Type</th><th scope="col">Processing</th><th scope="col">Uploaded by</th><th scope="col">Updated</th></tr></thead><tbody>{deliverables.rows.slice(0, 4).map(row => <tr key={row.id}><td><button type="button" className="pdo-document-button" title={row.title || row.filename} onClick={() => action('documents', row.id)}>{row.title || row.filename || 'Untitled document'}</button></td><td>{row.kindLabel || 'Not specified'}</td><td><span className={`pdo-pill pdo-${severity(row.tone || row.parseStatus)}`}>{row.parseLabel || 'Not specified'}</span></td><td>{row.uploadedBy || 'Not recorded'}</td><td>{shortDate(row.updatedAt || row.createdAt)}</td></tr>)}</tbody></table></div> : <EmptyState unavailable={!deliverables?.available}>{deliverables?.available ? 'No project documents recorded.' : 'Project document register unavailable.'}</EmptyState>}
      </Panel>
      <Panel title="Recent activity" icon={Activity} className="pdo-activity-panel" action={{ label: 'View all activity', onClick: () => action('activity') }}><OverviewActivityList activity={activity} onSelect={action} /></Panel>
    </div>
  </div>
}

ProjectDetailsOverview.propTypes = { performance: PropTypes.object.isRequired, onSelectView: PropTypes.func.isRequired, onEdit: PropTypes.func.isRequired, onOpenDialog: PropTypes.func.isRequired, onOpenDocument: PropTypes.func }
