/* eslint-disable react/prop-types */
import React, { useCallback, useEffect, useId, useRef, useState } from 'react'
import {
  AlertTriangle, ArrowLeftRight, ArrowRight, BarChart3, CalendarDays, CheckCircle2,
  ClipboardList, Clock3, Info, Link2, ListFilter, Lock, ShieldCheck, Target, Timer, TrendingUp, X,
} from 'lucide-react'
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import PlanningPackagePage from '../../PlanningPackagePage'
import PlanningBackgroundMonitor from '../../../components/planning/PlanningBackgroundMonitor'
import PlannerWorkspacePage from '../../PlannerWorkspacePage'
import { resolvePlanningSchedule } from '../../../services/planningScheduleSelection'
import { radaiConfirm } from '../../../services/radaiDialog'

const DAY = 86400000
const numeric = value => value !== null && value !== undefined && Number.isFinite(Number(value))
const pct = value => numeric(value) ? `${Number(value).toLocaleString('en-GB', { maximumFractionDigits: 1 })}%` : 'Unavailable'
const pp = value => numeric(value) ? `${Number(value) > 0 ? '+' : ''}${Number(value).toLocaleString('en-GB', { maximumFractionDigits: 1 })} pp` : 'Unavailable'
const dateValue = value => value ? Date.parse(String(value).slice(0, 10) + 'T00:00:00Z') : NaN
const dateLabel = (value, options = {}) => Number.isFinite(dateValue(value)) ? new Date(dateValue(value)).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC', ...options }) : '—'
const dateAt = value => new Date(value).toISOString().slice(0, 10)
const varianceLabel = value => numeric(value) ? Number(value) > 0 ? `${value}d late` : Number(value) < 0 ? `${Math.abs(value)}d early` : 'On time' : '—'
const toneOf = value => ['danger', 'warning', 'success', 'blue', 'neutral'].includes(value) ? value : 'neutral'
const labelOf = value => String(value || '').replaceAll('_', ' ').replace(/\b\w/g, character => character.toUpperCase())
const responsibility = value => value === 'owned' ? 'Controlled scope' : value === 'dependency' ? 'External dependency' : 'Scope to confirm'

export function downloadScheduleCsv(model, project) {
  if (!model?.activities?.length) return
  const cell = value => {
    let text = String(value ?? '')
    if (/^[\s]*[=+@-]/.test(text)) text = `'${text}`
    return `"${text.replaceAll('"', '""')}"`
  }
  const rows = [['Project', 'Schedule version', 'Baseline', 'Data date', 'Activity ID', 'Activity', 'Discipline', 'Owner', 'Progress %', 'Status', 'Baseline start', 'Baseline finish', 'Current start', 'Current finish', 'Reported forecast finish', 'Variance days', 'Critical', 'Blocker', 'Responsibility'],
    ...model.activities.map(row => [project?.code || project?.name, model.version?.label || model.version?.name || model.version?.version_number, model.baselineLabel, model.dataDate, row.code, row.name, row.discipline, row.owner, row.progress, row.status, row.baselineStart, row.baselineFinish, row.currentStart, row.currentFinish, row.forecastFinish, row.varianceDays, row.isCritical ? 'Yes' : 'No', row.blocker, model.detailedEngineering ? responsibility(row.controlRole) : ''])]
  const url = URL.createObjectURL(new Blob(['\uFEFF' + rows.map(row => row.map(cell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${String(project?.code || 'project').replace(/[^a-z0-9_-]/gi, '-')}-schedule.csv`
  document.body.appendChild(anchor); anchor.click(); anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function Panel({ title, icon: Icon, actions, className = '', children }) {
  const id = useId()
  return <section className={`sp-panel ${className}`} aria-labelledby={id}><header><h2 id={id}><Icon size={16} aria-hidden="true" />{title}</h2>{actions && <div className="sp-panel-actions">{actions}</div>}</header>{children}</section>
}
const TextAction = ({ children, onClick }) => <button type="button" className="sp-text-button" onClick={onClick}>{children}<ArrowRight size={14} aria-hidden="true" /></button>
const Empty = ({ children }) => <div className="sp-empty"><Info size={22} aria-hidden="true" /><p>{children}</p></div>
const ScrollTable = ({ children, label }) => <div className="sp-table-wrap" role="region" aria-label={label} tabIndex={0}>{children}</div>
const Status = ({ tone = 'neutral', children }) => <span className={`sp-status sp-${toneOf(tone)}`}>{tone === 'success' ? <CheckCircle2 size={13} aria-hidden="true" /> : ['danger', 'warning'].includes(tone) ? <AlertTriangle size={13} aria-hidden="true" /> : <span className="sp-status-dot" aria-hidden="true" />}{children}</span>

function ScheduleDialog({ title, onClose, children, footer }) {
  const ref = useRef(null)
  const id = useId()
  useEffect(() => {
    const dialog = ref.current, opener = document.activeElement
    dialog.showModal()
    return () => { dialog.close(); if (opener?.isConnected) opener.focus({ preventScroll: true }) }
  }, [])
  return <dialog ref={ref} className="sp-dialog" aria-labelledby={id} onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose() }}><div className="sp-dialog-header"><h2 id={id}>{title}</h2><button type="button" className="pp-button pp-icon-button" aria-label="Close dialog" onClick={onClose}><X size={18} /></button></div><div className="sp-dialog-body">{children}</div><div className="sp-dialog-footer"><button type="button" className="pp-button" onClick={onClose}>Close</button>{footer}</div></dialog>
}

function ExceptionsTable({ rows, onAction }) {
  return <ScrollTable label="Schedule exception records"><table className="sp-table sp-exceptions-table"><thead><tr><th>Priority</th><th>Exception</th><th>Owner</th><th>Due date</th><th>Action</th></tr></thead><tbody>{rows.map(row => <tr key={row.id}><td><Status tone={row.priority === 'critical' ? 'danger' : row.priority === 'high' ? 'warning' : 'blue'}>{labelOf(row.priority)}</Status></td><td><strong>{row.title}</strong><small title={row.detail}>{row.detail}</small></td><td>{row.owner || 'Unassigned'}</td><td>{dateLabel(row.dueDate)}</td><td><button type="button" className="pp-button" onClick={() => onAction(row)}>{row.button || 'Review'}</button></td></tr>)}</tbody></table></ScrollTable>
}

function Comparison({ model, rows, mode, dataDate }) {
  const hasHistory = rows.some(row => numeric(row.planned) || numeric(row.actual))
  const baselineLegend = model.chartBaselineLabel || 'Recorded planned progress'
  const chartRows = rows.map(row => ({ ...row, date: dateValue(row.date) }))
  return <div className="sp-chart-body"><div className="sp-chart-main">
    {mode === 'table' ? rows.length ? <ScrollTable label="Recorded schedule progress"><table className="sp-table"><thead><tr><th>Data date</th><th>{baselineLegend}</th><th>Actual progress</th><th>Variance</th></tr></thead><tbody>{rows.map(row => <tr key={row.date}><td>{dateLabel(row.date)}</td><td>{numeric(row.planned) ? pct(row.planned) : '—'}</td><td>{numeric(row.actual) ? pct(row.actual) : '—'}</td><td>{numeric(row.variance) ? pp(row.variance) : '—'}</td></tr>)}</tbody></table></ScrollTable> : <Empty>No recorded progress for this time range.</Empty> : hasHistory ? <>
      <div className="sp-chart-legend"><span className="sp-legend-baseline">{baselineLegend}</span><span className="sp-legend-actual">Actual progress</span></div>
      <div className="sp-chart-plot" role="img" aria-label={`Schedule comparison: ${rows.filter(row => numeric(row.actual)).length} recorded updates. Planned ${pct(model.plannedProgress)}, actual ${pct(model.actualProgress)}.`}>
        <ResponsiveContainer width="100%" height="100%"><LineChart data={chartRows} margin={{ top: 13, right: 22, bottom: 4, left: -17 }} accessibilityLayer>
          <CartesianGrid stroke="#e4ebf5" vertical /><XAxis dataKey="date" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={value => dateLabel(dateAt(value), { year: undefined })} tick={{ fontSize: 10, fill: '#456086' }} axisLine={{ stroke: '#c9d6e8' }} tickLine={false} minTickGap={24} />
          <YAxis domain={[0, 100]} ticks={[0, 20, 40, 60, 80, 100]} interval={0} tickFormatter={value => `${value}%`} tick={{ fontSize: 10, fill: '#456086' }} axisLine={false} tickLine={false} />
          <Tooltip labelFormatter={value => dateLabel(dateAt(value))} formatter={(value, name) => [pct(value), name]} contentStyle={{ fontSize: 12, borderColor: '#dbe5f1', borderRadius: 5 }} />
          <Line name={baselineLegend} dataKey="planned" type="linear" stroke="#0961ff" strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} connectNulls={false} isAnimationActive={false} />
          <Line name="Actual progress" dataKey="actual" type="linear" stroke="#d30038" strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} connectNulls isAnimationActive={false} />
          {chartRows.some(row => row.date === dateValue(dataDate)) && <ReferenceLine x={dateValue(dataDate)} stroke="#7993b4" strokeDasharray="3 3" />}
        </LineChart></ResponsiveContainer>
      </div>
    </> : <Empty>{model.version && model.availability?.controls === false ? 'Schedule progress is unavailable. Retry the schedule data.' : 'No recorded progress for this time range.'}</Empty>}
    <p className="sp-note" title={model.chartNote}>{model.chartNote || 'Recorded progress only. A forecast curve has not been published.'}</p>
  </div><dl className="sp-chart-summary"><div><dt>Planned progress</dt><dd>{pct(model.plannedProgress)}</dd></div><div><dt>Actual progress</dt><dd className={model.variance < 0 ? 'sp-danger' : 'sp-blue'}>{pct(model.actualProgress)}</dd></div><div><dt>Variance</dt><dd>{pp(model.variance)}</dd></div></dl></div>
}

function Timeline({ rows, start, end, onOpen }) {
  const from = dateValue(start), to = dateValue(end)
  if (!rows.length || !Number.isFinite(from) || !Number.isFinite(to) || to <= from) return <Empty>No scheduled activities match the six-week window and filters.</Empty>
  const bar = (a, b) => {
    const left = dateValue(a), right = dateValue(b)
    if (!Number.isFinite(left) || !Number.isFinite(right) || right < from || left > to) return null
    return { left: `${Math.max(0, (left - from) / (to - from) * 100)}%`, width: `${Math.max(.5, (Math.min(to, Math.max(left, right)) - Math.max(from, left)) / (to - from) * 100)}%` }
  }
  return <ScrollTable label="Six-week activity timeline"><table className="sp-table sp-lookahead-table"><thead><tr><th className="sp-activity-cell">Activity</th><th className="sp-percent-cell">% complete</th><th className="sp-status-cell">Status</th><th colSpan={7}><div className="sp-timeline-heading">{Array.from({ length: 7 }, (_, index) => <span key={index}>{dateLabel(dateAt(from + index * (to - from) / 6), { year: undefined })}</span>)}</div></th></tr></thead><tbody>{rows.map(row => {
    const baseline = bar(row.baselineStart, row.baselineFinish), current = bar(row.currentStart, row.currentFinish)
    return <tr key={row.id}><td><button type="button" className="sp-row-link" onClick={() => onOpen(row)}>{row.name}</button></td><td>{pct(row.progress)}</td><td><Status tone={row.tone}>{row.status}</Status></td><td colSpan={7} className="sp-timeline-cell"><div className="sp-timeline-track"><span className="sp-today-line" aria-hidden="true" />{baseline && <span className="sp-bar-baseline" style={baseline} title={`Baseline: ${dateLabel(row.baselineStart)} – ${dateLabel(row.baselineFinish)}`} />}{current && <span className={`sp-bar-current sp-bar-${toneOf(row.tone)}`} style={current} title={`Current schedule: ${dateLabel(row.currentStart)} – ${dateLabel(row.currentFinish)}`} />}</div></td></tr>
  })}</tbody></table></ScrollTable>
}

export default function PlanBaselineTab(props) {
  return <PlanBaselineContent key={props.project.id} {...props} />
}

function PlanBaselineContent(props) {
  const mode = props.scheduleMode === 'documents' ? 'documents' : 'planner'
  const [visited, setVisited] = useState(() => new Set([mode]))
  const [handoff, setHandoff] = useState(null)
  const [generationRequest, setGenerationRequest] = useState(0)
  const [scheduleWorkspaceRequest, setScheduleWorkspaceRequest] = useState(0)
  const [documentReviewRequest, setDocumentReviewRequest] = useState(null)
  const [plannerDirty, setPlannerDirty] = useState(false)
  const [analysisState, setAnalysisState] = useState(null)
  const [backgroundJob, setBackgroundJob] = useState(null)
  const acceptBackgroundJob = useCallback(job => setBackgroundJob(job), [])
  const documentsMounted = mode === 'documents' || visited.has('documents') || Boolean(backgroundJob)
  useEffect(() => { setHandoff(null); setDocumentReviewRequest(null); setGenerationRequest(0); setScheduleWorkspaceRequest(0); setPlannerDirty(false); setAnalysisState(null) }, [props.project.id])
  useEffect(() => { setVisited(previous => previous.has(mode) ? previous : new Set([...previous, mode])) }, [mode])
  const openPlanner = async selection => {
    if (plannerDirty && !(await radaiConfirm('Discard unsaved activity changes and open this schedule?'))) return
    setPlannerDirty(false)
    if (selection?.generationId || selection?.analysisRunId) props.onScheduleSelection?.({ planningProjectId: selection.planningProjectId, generationId: selection.generationId, analysisRunId: selection.analysisRunId, scheduleId: null, versionId: null })
    setHandoff({ ...selection, request: Date.now() })
    props.onScheduleMode('planner', selection?.initialTab || 'activities')
  }
  const openDocuments = () => props.onScheduleMode('documents')
  const openGeneration = () => { setGenerationRequest(value => value + 1); openDocuments() }
  const openDocumentStep = request => { setDocumentReviewRequest({ ...request, requestId: Date.now() }); openDocuments() }
  const selectMode = value => {
    const selectedVersionId = props.schedulePerformance?.model?.version?.id || handoff?.versionId
    if (value === 'planner' && mode === 'documents' && !plannerDirty && analysisState?.savedRunId
      && (!analysisState.packageVersionId || String(analysisState.packageVersionId) !== String(selectedVersionId))) {
      setScheduleWorkspaceRequest(request => request + 1)
      return
    }
    props.onScheduleMode(value)
  }
  return <div className="planning-design">
    <nav className="pln-task-tabs" aria-label="Schedule workspace">
      {[['documents', 'Document Intelligence'], ['planner', 'Master Schedule']].map(([value, label]) =>
        <button type="button" key={value} aria-pressed={mode === value} onClick={() => selectMode(value)}>{label}</button>)}
    </nav>
    {!documentsMounted && <PlanningBackgroundMonitor enterpriseProjectId={props.project.id} onState={setAnalysisState} onReady={acceptBackgroundJob} />}
    {documentsMounted && <div hidden={mode !== 'documents'}><PlanningPackagePage key={props.project.id} embedded documentWorkflow enterpriseProject={props.project} recoveredJob={backgroundJob} generationRequest={generationRequest} scheduleWorkspaceRequest={scheduleWorkspaceRequest} documentReviewRequest={documentReviewRequest} onOpenPlanner={openPlanner} onAnalysisStateChange={setAnalysisState} onBackToPortfolio={() => props.onSelectView?.('project-dashboard')} /></div>}
    {(visited.has('planner') || mode === 'planner') && <div hidden={mode !== 'planner'}><UnifiedScheduleWorkspace key={props.project.id} {...props} handoff={handoff} analysisState={analysisState} onDirtyChange={setPlannerDirty} onOpenDocuments={openDocuments} onOpenGeneration={openGeneration} onOpenDocumentStep={openDocumentStep} /></div>}
  </div>
}

function UnifiedScheduleWorkspace({ project, handoff, analysisState, scheduleTab, scheduleMode, onScheduleTab, onScheduleSelection, onOpenDocuments, onOpenGeneration, onOpenDocumentStep, onDirtyChange, ...props }) {
  const [attempt, setAttempt] = useState(0)
  const [selection, setSelection] = useState({ loading: true })
  // This read resolves selection only. Activities always come from the retained
  // relational workspace, never from the separate simple-plan task draft.
  useEffect(() => {
    let current = true
    const controller = new AbortController()
    setSelection({ loading: true })
    resolvePlanningSchedule(project.id, handoff || {}, { signal: controller.signal })
      .then(data => { if (current) setSelection({ ...data, loading: false }) })
      .catch(error => {
        if (!current) return
        const denied = [401, 403].includes(error?.response?.status)
        setSelection({ loading: false, error: denied ? 'This account cannot access the schedule workspace.' : error.message || 'The schedule workspace could not be loaded.' })
      })
    return () => { current = false; controller.abort() }
  }, [project.id, handoff, attempt])
  if (selection.loading) return <div className="pln-section" role="status">Loading Master Schedule…</div>
  if (selection.error) return <div className="pln-section" role="alert"><p>{selection.error}</p><button type="button" className="pln-button" onClick={() => setAttempt(value => value + 1)}>Retry schedule workspace</button></div>
  if (!selection.linkedProject) return <div className="pln-section"><h2>Master Schedule</h2><p>Set up project inputs to create a schedule workspace.</p><button type="button" className="pln-button pln-primary" onClick={onOpenDocuments}>Open Document Intelligence</button><button type="button" className="pln-button" onClick={() => setAttempt(value => value + 1)}>Refresh schedules</button></div>
  return <PlannerWorkspacePage key={selection.linkedProject.id} embedded planningProjectId={selection.linkedProject.id}
    compactHeader headerContainer={scheduleMode === 'documents' ? null : props.scheduleControlsHost} workspaceActive={scheduleMode !== 'documents'}
    initialScheduleId={selection.schedule?.id} initialVersionId={selection.version?.id}
    initialGenerationId={handoff?.generationId}
    initialAnalysisRunId={handoff?.analysisRunId}
    analysisState={String(analysisState?.projectId) === String(selection.linkedProject.id) ? analysisState : null}
    initialTab={scheduleTab || (scheduleMode === 'management' ? 'performance' : 'activities')}
    onTabChange={onScheduleTab} onBack={onOpenDocuments} onOpenGenerationWizard={onOpenGeneration}
    onOpenDocumentStep={onOpenDocumentStep}
    onDirtyChange={onDirtyChange}
    onSelectionChange={value => onScheduleSelection?.({ ...value, planningProjectId: selection.linkedProject.id })}
    onWorkspaceChanged={props.schedulePerformance?.reload}
    performancePanel={({ scheduleId, versionId, onOpenActivities }) => {
      const performance = props.schedulePerformance
      const matches = String(performance?.model?.linkedProject?.id) === String(selection.linkedProject.id)
        && String(performance?.model?.schedule?.id) === String(scheduleId)
        && String(performance?.model?.version?.id) === String(versionId)
      if (!matches && !performance?.loading && performance?.issues?.length) return <div role="alert" className="sp-empty"><p>Performance for this schedule version could not be loaded.</p><button type="button" className="pp-button" onClick={performance.reload}>Retry schedule data</button></div>
      if (!matches) return <div className="sp-empty" role="status">Loading performance for the selected schedule version…</div>
      return <SchedulePerformancePanel {...props} project={project} integrated onOpenPlanner={onOpenActivities} scheduleMode="management" />
    }} />
}

export function SchedulePerformancePanel({ project, schedulePerformance, scheduleMode = 'management', onScheduleMode, onSelectBaseline, onSelectVersion, onSelectView, integrated = false, onOpenPlanner }) {
  const [chartMode, setChartMode] = useState('chart')
  const [timeRange, setTimeRange] = useState('full')
  const [showFilters, setShowFilters] = useState(false)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [discipline, setDiscipline] = useState('all')
  const [owner, setOwner] = useState('all')
  const [criticalOnly, setCriticalOnly] = useState(false)
  const [dialog, setDialog] = useState(null)
  useEffect(() => { setDialog(null); setSearch(''); setStatus('all'); setDiscipline('all'); setOwner('all'); setCriticalOnly(false) }, [project.id])
  const { model, loading, issues = [], reload } = schedulePerformance
  const openPlanner = () => { setDialog(null); if (onOpenPlanner) onOpenPlanner(); else onScheduleMode('planner') }
  const action = row => row.view === 'quality' ? setDialog({ type: 'quality' }) : row.activityId ? setDialog({ type: 'activity', row: model.activities?.find(item => String(item.id) === String(row.activityId)) }) : openPlanner()
  const activities = model?.activities || []
  const disciplines = [...new Set(activities.map(row => row.discipline).filter(Boolean))].sort()
  const owners = [...new Set(activities.map(row => row.owner).filter(Boolean))].sort()
  const matches = row => {
    if (search && ![row.code, row.name, row.owner, row.discipline].some(value => String(value || '').toLowerCase().includes(search.toLowerCase()))) return false
    if (discipline !== 'all' && row.discipline !== discipline) return false
    if (owner !== 'all' && row.owner !== owner) return false
    if (criticalOnly && !row.isCritical) return false
    if (status === 'late' && !(row.currentVarianceDays > 0 || /late|overdue/i.test(row.status))) return false
    if (status === 'blocked' && !row.blocker && !/blocked/i.test(row.status)) return false
    if (status === 'not-started' && (row.progress !== 0 || /blocked/i.test(row.status))) return false
    if (status === 'complete' && row.progress !== 100) return false
    return true
  }
  const date = dateValue(model?.dataDate)
  const chartRows = (model?.chartPoints || []).filter(row => timeRange === 'full' || (timeRange === 'recent' ? dateValue(row.date) >= date - 90 * DAY && dateValue(row.date) <= date : dateValue(row.date) >= date && dateValue(row.date) <= date + 42 * DAY))
  const exceptionRows = model?.exceptions || []
  const lookAheadRows = (model?.lookAheadActivities || []).filter(matches)
  const criticalRows = (model?.criticalActivities || []).filter(matches)
  const milestones = (model?.milestones || []).filter(matches)
  const clearFilters = () => { setSearch(''); setStatus('all'); setDiscipline('all'); setOwner('all'); setCriticalOnly(false) }
  const hasFilters = search || status !== 'all' || discipline !== 'all' || owner !== 'all' || criticalOnly
  const cards = model ? [
    { label: 'Schedule health', value: model.health?.label || 'Not assessed', detail: model.health?.detail || model.health?.reason || 'Review schedule exceptions', tone: model.health?.tone || 'neutral', icon: AlertTriangle },
    { label: 'Planned progress', value: pct(model.plannedProgress), progress: model.plannedProgress, detail: model.plannedProgress === null ? 'Baseline data required' : null, tone: 'blue', icon: Target },
    { label: 'Actual progress', value: pct(model.actualProgress), progress: model.actualProgress, detail: model.actualProgress === null ? 'Progress update required' : null, tone: model.variance < 0 ? 'danger' : 'blue', icon: TrendingUp },
    { label: 'Variance', value: pp(model.variance), detail: model.variance === null ? 'Comparison unavailable' : model.variance < 0 ? 'Behind plan' : 'On or ahead of plan', tone: model.variance === null ? 'neutral' : model.variance < 0 ? 'danger' : 'success', icon: ArrowLeftRight },
    { label: 'SPI', value: numeric(model.spi) ? Number(model.spi).toFixed(2) : 'Unavailable', detail: !numeric(model.spi) ? 'Comparable progress required' : model.spi < .9 ? 'Below 0.90 threshold' : model.spi < 1 ? 'Below plan' : 'On or ahead of plan', tone: !numeric(model.spi) ? 'neutral' : model.spi < 1 ? 'danger' : 'success', icon: BarChart3 },
    { label: 'Forecast finish', value: model.forecastFinish ? dateLabel(model.forecastFinish) : 'Pending update', detail: model.forecastFinish ? model.detailedEngineering ? 'Engineering forecast' : 'Reported forecast' : 'Forecast not published', tone: model.forecastFinish ? 'blue' : 'danger', icon: CalendarDays },
  ] : []
  return <div className={`sp-workspace${scheduleMode === 'planner' ? ' sp-planning' : ''}`}>
    <div className="sp-toolbar">{!integrated && <div className="sp-mode-switch" role="group" aria-label="Schedule workspace mode">{[['management', 'Performance'], ['planner', 'Planning']].map(([mode, label]) => <button type="button" key={mode} aria-pressed={scheduleMode === mode} onClick={() => onScheduleMode(mode)}>{label}</button>)}</div>}
      {scheduleMode === 'management' && <><label className="sp-toolbar-field">Baseline<select value={model?.baseline?.id || ''} disabled={loading || !model?.baselines?.length} onChange={event => onSelectBaseline(event.target.value)}>{!model?.baselines?.length && <option value="">No approved baseline</option>}{model?.baselines?.map(item => <option key={item.id} value={item.id}>{item.label || item.name || `Baseline ${item.id}`}</option>)}</select></label><span className="sp-lock" title={model?.baselineApproved ? 'Approved baseline — read only' : 'No approved baseline'}><Lock size={15} aria-label={model?.baselineApproved ? 'Approved baseline — read only' : 'Baseline not approved'} /></span>{!integrated && <label className="sp-toolbar-field">Compare<select value={model?.version?.id || ''} disabled={loading || !model?.versions?.length} onChange={event => onSelectVersion(event.target.value)}>{!model?.versions?.length && <option value="">No schedule version</option>}{model?.versions?.map(item => <option key={item.id} value={item.id}>{item.label || item.name || `Version ${item.version_number}`}</option>)}</select></label>}<label className="sp-toolbar-field">Time range<select value={timeRange} onChange={event => setTimeRange(event.target.value)}><option value="full">Full project</option><option value="recent">Last 3 months</option><option value="next">Next 6 weeks</option></select></label><button type="button" className="pp-button" aria-expanded={showFilters} aria-controls="schedule-activity-filters" onClick={() => setShowFilters(value => !value)}><ListFilter size={15} />Filters</button><span className="sp-toolbar-date"><CalendarDays size={15} aria-hidden="true" />Data date: {dateLabel(model?.dataDate)}</span></>}
    </div>
    {scheduleMode === 'planner' ? <div className="sp-planner-container"><PlanningPackagePage key={project.id} embedded enterpriseProject={project} onBackToPortfolio={() => onSelectView?.('project-dashboard')} /></div> : <>
      {showFilters && <div id="schedule-activity-filters" className="sp-filters"><label>Search activities<input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Activity ID, name, discipline or owner" /></label><label>Status<select value={status} onChange={event => setStatus(event.target.value)}><option value="all">All statuses</option><option value="late">Late</option><option value="blocked">Blocked</option><option value="not-started">Not started</option><option value="complete">Complete</option></select></label><button type="button" className="pp-button" onClick={clearFilters}>Clear filters</button><span>Activity filters apply to the lists below. Progress totals remain {model?.detailedEngineering ? 'within controlled engineering scope' : 'project-wide'}.</span></div>}
      {loading ? <div className="sp-empty" role="status">Loading schedule performance…</div> : !model ? <Empty>Schedule performance is unavailable.</Empty> : <>
        {issues.length > 0 && <div className="sp-warning-note" role="alert"><AlertTriangle size={18} /><span>Some schedule data is unavailable. {issues.map(item => typeof item === 'string' ? item : item.message || item.label).filter(Boolean).join(' ')}</span><button type="button" className="pp-button" onClick={reload}>Retry schedule data</button></div>}
        {!model.linkedProject && !issues.length && <div className="sp-warning-note"><Info size={17} /><span>Connect a planning workspace to compare approved baselines and manage schedule activities.</span><button type="button" className="pp-button" onClick={openPlanner}>Set up schedule</button></div>}
        {model.detailedEngineering && <p className={model.scopeReady ? "sp-note" : "sp-warning-note"}>{model.scopeNote}</p>}
        <section className="sp-kpis" aria-label="Schedule indicators">{cards.map(({ label, value, detail, tone, icon: Icon, progress }) => <article className={`sp-kpi sp-${toneOf(tone)}`} key={label} title={label === 'SPI' ? model.spiNote : label === 'Variance' ? model.comparisonNote : label === 'Actual progress' ? model.progressNote : undefined}><Icon size={27} aria-hidden="true" /><div className="sp-kpi-copy"><span>{label}</span><strong>{value}</strong>{numeric(progress) && <div className="sp-progress" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><span style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} /></div>}{detail && <small>{detail}</small>}</div></article>)}</section>
        <div className="sp-grid">
          <Panel title="Baseline vs actual" icon={Timer} className="sp-chart-panel" actions={<><TextAction onClick={openPlanner}>Open full schedule</TextAction><div className="sp-segmented" role="group" aria-label="Schedule comparison view">{['chart', 'table'].map(mode => <button type="button" key={mode} aria-pressed={chartMode === mode} onClick={() => setChartMode(mode)}>{labelOf(mode)}</button>)}</div></>}><Comparison model={model} rows={chartRows} mode={chartMode} dataDate={model.dataDate} /></Panel>
          <Panel title="Schedule exceptions" icon={ClipboardList} className="sp-exceptions-panel" actions={<><span className="sp-count">{exceptionRows.length}</span><TextAction onClick={() => setDialog({ type: 'exceptions' })}>View all</TextAction></>}>{exceptionRows.length ? <ExceptionsTable rows={exceptionRows.slice(0, 4)} onAction={action} /> : <Empty>No schedule exceptions identified from the available records.</Empty>}</Panel>
          <Panel title="Six-week look-ahead" icon={Clock3} className="sp-lookahead-panel" actions={<span>{dateLabel(model.lookAheadStart, { year: undefined })} – {dateLabel(model.lookAheadEnd)}</span>}>
            <div className="sp-lookahead-filters"><label>Discipline<select value={discipline} onChange={event => setDiscipline(event.target.value)}><option value="all">All</option>{disciplines.map(value => <option key={value}>{value}</option>)}</select></label><label>Owner<select value={owner} onChange={event => setOwner(event.target.value)}><option value="all">All</option>{owners.map(value => <option key={value}>{value}</option>)}</select></label><label className="sp-critical-toggle"><input type="checkbox" checked={criticalOnly} onChange={event => setCriticalOnly(event.target.checked)} />Critical only</label><span className="sp-legend-baseline">Baseline</span><span className="sp-legend-current">Current</span><span className="sp-legend-date">Data date</span>{hasFilters && <button type="button" className="sp-text-button" onClick={clearFilters}>Clear</button>}</div>
            {model.activities === null && model.version ? <Empty>Schedule activities are unavailable.</Empty> : <Timeline rows={lookAheadRows.slice(0, 5)} start={model.lookAheadStart} end={model.lookAheadEnd} onOpen={row => setDialog({ type: 'activity', row })} />}{lookAheadRows.length > 5 && <p className="sp-note">Showing 5 of {lookAheadRows.length} activities. <button type="button" className="sp-text-button" onClick={openPlanner}>Open all in Planner</button></p>}
          </Panel>
          <Panel title="Milestone outlook" icon={ShieldCheck} className="sp-milestones-panel" actions={<TextAction onClick={openPlanner}>Manage milestones</TextAction>}>
            {milestones.length ? <ScrollTable label="Schedule milestone records"><table className="sp-table"><thead><tr><th>Milestone</th><th>Baseline date</th><th>Forecast date</th><th>Variance</th><th>Status</th></tr></thead><tbody>{milestones.slice(0, 4).map(row => <tr key={row.id}><td><button type="button" className="sp-row-link" onClick={() => setDialog({ type: 'activity', row })}>{row.name}</button></td><td>{dateLabel(row.baselineFinish)}</td><td className={row.varianceDays > 0 ? 'sp-danger' : ''}>{dateLabel(row.forecastFinish)}</td><td className={row.varianceDays > 0 ? 'sp-danger' : ''}>{varianceLabel(row.varianceDays)}</td><td><Status tone={row.tone}>{row.status}</Status></td></tr>)}</tbody></table></ScrollTable> : <Empty>{model.milestones === null && model.version ? 'Milestone data is unavailable.' : hasFilters ? 'No milestones match these filters.' : 'No schedule milestones recorded.'}</Empty>}
            <div className="sp-warning-note"><AlertTriangle size={14} /><span>{model.quality?.find(item => item.id === 'milestones')?.detail || 'Review contractual milestones and missing forecast dates before relying on the finish forecast.'}</span></div>
          </Panel>
          <Panel title="Critical and late activities" icon={Info} className="sp-critical-panel" actions={criticalRows.length > 4 && <TextAction onClick={openPlanner}>View all {criticalRows.length}</TextAction>}>
            {criticalRows.length ? <ScrollTable label="Critical and late activity records"><table className="sp-table sp-critical-table"><thead><tr><th>ID</th><th>Activity</th><th>Discipline</th><th>Owner</th><th>Baseline finish</th><th>Current finish</th><th>Variance</th><th>Blocker</th><th>Action</th></tr></thead><tbody>{criticalRows.slice(0, 4).map(row => <tr key={row.id}><td>{row.code}</td><td>{row.name}</td><td>{row.discipline || '—'}</td><td>{row.owner || 'Unassigned'}</td><td>{dateLabel(row.baselineFinish)}</td><td className={row.currentVarianceDays > 0 ? 'sp-danger' : ''} title={row.currentFinishSource}>{dateLabel(row.currentFinish)}</td><td className={row.currentVarianceDays > 0 ? 'sp-danger' : ''}>{varianceLabel(row.currentVarianceDays)}</td><td>{row.blocker && <Link2 size={12} aria-hidden="true" />}{row.blocker || '—'}</td><td><button type="button" className="pp-button" onClick={() => setDialog({ type: 'activity', row })}>Open</button></td></tr>)}</tbody></table></ScrollTable> : <Empty>{model.activities === null && model.version ? 'Schedule activities are unavailable.' : 'No critical or late activities match the current filters.'}</Empty>}
          </Panel>
          <Panel title="Recovery impact" icon={ClipboardList} className="sp-recovery-panel" actions={<TextAction onClick={openPlanner}>Build recovery scenario</TextAction>}>
            {model.recoveryScenarios?.length ? <ScrollTable label="Recorded recovery scenarios"><table className="sp-table"><thead><tr><th>Recovery scenario</th><th>Required recovery</th><th>Cost impact</th><th>Risk</th></tr></thead><tbody>{model.recoveryScenarios.slice(0, 3).map(row => <tr key={row.id}><td>{row.name}</td><td><strong>{numeric(row.requiredReductionDays) ? `${row.requiredReductionDays} days` : 'Not assessed'}</strong></td><td>{row.costImpact ?? 'Not estimated'}</td><td>{row.risk || 'Not assessed'}</td></tr>)}</tbody></table></ScrollTable> : <Empty>{model.recoveryScenarios === null && model.version ? 'Recovery analysis is unavailable.' : 'No recovery scenarios recorded.'}</Empty>}
            <p className="sp-note"><Info size={13} aria-hidden="true" />Recovery targets are planning estimates, not approved forecast gains.</p>
          </Panel>
        </div>
        <section className="sp-quality" aria-label="Schedule data quality"><h2>Schedule data quality</h2>{model.quality?.map(item => <button type="button" key={item.id} onClick={() => setDialog({ type: 'quality' })} title={item.detail}><span className={`sp-${toneOf(item.tone)}`}>{item.ready ? <CheckCircle2 size={21} /> : <AlertTriangle size={21} />}</span><span><span>{item.label}</span><strong className={`sp-${toneOf(item.tone)}`}>{item.status}</strong></span></button>)}<button type="button" className="pp-button" onClick={() => setDialog({ type: 'quality' })}>Review schedule data</button></section>
      </>}
    </>}
    {dialog && <ScheduleDialog title={dialog.type === 'quality' ? 'Schedule data quality' : dialog.type === 'exceptions' ? 'Schedule exceptions' : 'Activity details'} onClose={() => setDialog(null)} footer={<button type="button" className="pp-button pp-primary" onClick={openPlanner}>Open Planner</button>}>
      {dialog.type === 'quality' ? <><dl className="sp-detail-grid">{model.quality?.map(item => <div key={item.id}><dt>{item.label}</dt><dd><Status tone={item.tone}>{item.status}</Status><p>{item.detail}</p></dd></div>)}</dl><p className="sp-note">{model.baselineNote}</p><p className="sp-note">{model.progressNote}</p><p className="sp-note">{model.forecastNote}</p></> : dialog.type === 'exceptions' ? exceptionRows.length ? <ExceptionsTable rows={exceptionRows} onAction={action} /> : <Empty>No schedule exceptions recorded.</Empty> : dialog.row ? <><h3>{dialog.row.code} — {dialog.row.name}</h3><dl className="sp-detail-grid">{[...(model.detailedEngineering ? [['Responsibility', responsibility(dialog.row.controlRole)]] : []), ['Discipline', dialog.row.discipline], ['Owner', dialog.row.owner || 'Unassigned'], ['Progress', pct(dialog.row.progress)], ['Status', dialog.row.status], ['Baseline start', dateLabel(dialog.row.baselineStart)], ['Baseline finish', dateLabel(dialog.row.baselineFinish)], ['Current start', dateLabel(dialog.row.currentStart)], ['Current finish', dateLabel(dialog.row.currentFinish)], ['Reported forecast finish', dateLabel(dialog.row.forecastFinish)], ['Current finish variance', varianceLabel(dialog.row.currentVarianceDays)], ['Reported forecast variance', varianceLabel(dialog.row.varianceDays)], ['Critical path', dialog.row.isCritical ? 'Yes' : 'No'], ['Blocker', dialog.row.blocker || 'None recorded'], ['Last progress report', dateLabel(dialog.row.lastReportedDate)]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || '—'}</dd></div>)}</dl></> : <Empty>This activity is no longer in the selected schedule version.</Empty>}
    </ScheduleDialog>}
  </div>
}
