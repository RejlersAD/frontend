import { useCallback, useEffect, useMemo, useState } from 'react'
import apiClient from '../../services/api.service'
import { PLANNING_ENDPOINTS as endpoints } from '../../config/planningIntelligence.config'
import { resolvePlanningSchedule } from '../../services/planningScheduleSelection'

const DAY = 86400000
const number = value => (typeof value === 'number' || typeof value === 'string') && String(value).trim() && Number.isFinite(Number(value)) ? Number(value) : null
const percent = value => { const result = number(value); return result !== null && result >= 0 && result <= 100 ? result : null }
const date = value => {
  const candidate = String(value || '').slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(candidate) && !Number.isNaN(Date.parse(`${candidate}T00:00:00Z`)) ? candidate : null
}
const days = value => date(value) ? Date.parse(`${date(value)}T00:00:00Z`) / DAY : null
const addDays = (value, offset) => new Date((days(value) + offset) * DAY).toISOString().slice(0, 10)
const difference = (later, earlier) => days(later) !== null && days(earlier) !== null ? days(later) - days(earlier) : null
const round = value => value === null ? null : Math.round(value * 100) / 100
const byNewest = (a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')) || Number(b.id) - Number(a.id)
const versionOption = row => row ? { ...row, label: `Version ${row.version} · ${row.status}` } : null
const closed = item => ['closed', 'implemented', 'rejected'].includes(item.status)
const userName = user => typeof user === 'string' ? user : user?.name || [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.email || null
const emptyData = () => ({ projects: null, schedules: null, versions: null, linkedProject: null, schedule: null, version: null, workspace: null, controls: null, governance: null })

const messageFor = (label, error) => {
  if ([401, 403].includes(error?.response?.status)) return `${label} is unavailable for this account.`
  if (error?.code === 'planning_selection_invalid') return error.message
  return `${label} could not be loaded. Retry to refresh this information.`
}

// This deliberately mirrors the scheduling service's duration-weighted planned
// fraction, using the immutable approved snapshot rather than revised dates.
function plannedFraction(activity, dataDate) {
  const start = days(activity.planned_start)
  const finish = days(activity.planned_finish)
  const at = days(dataDate)
  if (start === null || finish === null || at === null || finish < start) return null
  if (at < start) return 0
  if (at >= finish) return 1
  return (at - start + 1) / Math.max(1, finish - start + 1)
}

function plannedPercent(activities, dataDate) {
  if (!activities.length || !dataDate) return null
  let weighted = 0
  let total = 0
  for (const activity of activities) {
    const fraction = plannedFraction(activity, dataDate)
    if (fraction === null) return null
    const weight = Math.max(number(activity.duration_days) || 0, 1)
    total += weight
    weighted += fraction * weight
  }
  return total ? round(weighted / total * 100) : null
}

function uniqueCodes(activities) {
  const map = new Map()
  for (const activity of activities) {
    if (!activity.external_id || map.has(activity.external_id)) return null
    map.set(activity.external_id, activity)
  }
  return map
}

export function buildScheduleModel(project, performance, data, issues = [], options = {}) {
  const workspace = data.workspace
  const controls = data.controls
  const schedule = workspace?.schedule || data.schedule
  const version = versionOption(workspace?.version || data.version)
  const baselines = [...(workspace?.baselines || [])].sort((a, b) => String(b.approved_at || '').localeCompare(String(a.approved_at || '')) || byNewest(a, b)).map(row => ({
    ...row, approved: Boolean(date(row.approved_at)),
    label: `${row.name || `Baseline ${row.id}`}${date(row.approved_at) ? '' : ' (unapproved)'}`,
  }))
  const baseline = baselines.find(row => String(row.id) === String(options.baselineId)) || baselines.find(row => row.approved) || baselines[0] || null
  const baselineApproved = Boolean(baseline?.approved)
  const baselineActivities = baselineApproved && Array.isArray(baseline?.snapshot?.activities) ? baseline.snapshot.activities : []
  const baselineByCode = uniqueCodes(baselineActivities)
  const sourceActivities = Array.isArray(workspace?.activities) ? workspace.activities : null
  const controlActivities = Array.isArray(controls?.activities) ? controls.activities : null
  const progressById = new Map((controlActivities || []).map(row => [String(row.id), row]))
  const detailedEngineering = project?.scope_type === 'detailed_engineering'
  const controlScope = controls?.control_scope || null
  const ownedIds = new Set((Array.isArray(controlScope?.owned_activity_ids) ? controlScope.owned_activity_ids : []).map(String))
  const sourceIds = new Set((sourceActivities || []).map(row => String(row.id)))
  const scopeReady = !detailedEngineering || Boolean(controlScope?.scope_type === 'detailed_engineering' && controlScope?.ready === true && ownedIds.size > 0 && [...ownedIds].every(id => sourceIds.has(id) && progressById.has(id)))
  const scopeNote = !detailedEngineering ? '' : scopeReady
    ? 'Controlled progress, baseline comparison and forecast cover engineering only. External dependencies remain in the activity register.'
    : `Controlled engineering scope is unavailable. ${(controlScope?.blockers || []).join(' ') || 'Complete and validate the activity ownership links before reporting aggregate progress.'}`
  const aggregateSourceActivities = detailedEngineering ? (sourceActivities || []).filter(row => ownedIds.has(String(row.id))) : sourceActivities || []
  const currentByCode = uniqueCodes(aggregateSourceActivities)
  // IDs change between schedule versions; unique external codes preserve the
  // selected owned activity population in an older immutable baseline.
  const aggregateBaselineActivities = detailedEngineering
    ? baselineByCode && currentByCode ? baselineActivities.filter(row => currentByCode.has(row.external_id)) : []
    : baselineActivities
  const aggregateBaselineByCode = uniqueCodes(aggregateBaselineActivities)
  const baselineScopeComparable = Boolean(scopeReady && currentByCode && aggregateBaselineByCode && aggregateBaselineActivities.length > 0 && currentByCode.size === aggregateBaselineByCode.size && [...currentByCode.keys()].every(code => aggregateBaselineByCode.has(code)))
  // The controls aggregate uses current duration weights. The baseline aggregate
  // is comparable only while its activity population and weights still agree.
  const baselineWeightsComparable = baselineScopeComparable && [...currentByCode].every(([code, activity]) => Math.max(number(activity.duration_days) || 0, 1) === Math.max(number(aggregateBaselineByCode.get(code).duration_days) || 0, 1))
  const progressComparable = scopeReady && (!baselineApproved || baselineWeightsComparable)
  const comparisonNote = !scopeReady ? scopeNote : !baselineApproved ? 'Progress is compared with the current schedule plan.'
    : !baselineScopeComparable ? 'Baseline and current schedule activity scopes differ. Progress percentages are shown separately; their variance is unavailable.'
      : !baselineWeightsComparable ? 'Baseline and current schedule duration weights differ. Progress percentages are shown separately; their variance is unavailable.'
        : 'Baseline and current progress use matching activities and duration weights.'
  const openItems = Array.isArray(data.governance?.items) ? data.governance.items.filter(row => !closed(row)) : null
  const dataDate = date(controls?.data_date) || date(schedule?.data_date)
  const lookAheadStart = dataDate
  const lookAheadEnd = lookAheadStart ? addDays(lookAheadStart, 42) : null
  const activities = sourceActivities?.map(activity => {
    const update = progressById.get(String(activity.id))
    const reported = Boolean(date(update?.last_reported_date))
    const progress = reported ? percent(update?.physical_progress_pct) : null
    const baselineRow = baselineByCode?.get(activity.external_id)
    const baselineStart = date(baselineRow?.planned_start)
    const baselineFinish = date(baselineRow?.planned_finish)
    const actualFinish = date(update?.actual_finish)
    // The controls API substitutes planned_finish when no update exists. A
    // forecast must therefore have a real progress report as its provenance.
    const forecastFinish = reported ? date(update?.forecast_finish) : null
    const currentStart = date(update?.actual_start) || date(activity.planned_start)
    const currentFinish = actualFinish || forecastFinish || date(activity.planned_finish)
    const varianceDays = difference(forecastFinish, baselineFinish)
    const currentVarianceDays = difference(currentFinish, baselineFinish)
    const currentFinishSource = actualFinish ? 'Recorded actual finish' : forecastFinish ? 'Reported forecast finish' : date(activity.planned_finish) ? 'Current schedule plan' : 'Unavailable'
    const overdueDays = progress !== 100 ? Math.max(0, difference(dataDate, baselineFinish || activity.planned_finish) || 0) : 0
    const activityItems = (openItems || []).filter(item => String(item.activity) === String(activity.id))
    const blockerItem = activityItems.find(item => ['issue', 'risk'].includes(item.item_type))
    const blocker = blockerItem?.title || null
    const owner = userName(activityItems.find(item => item.owner)?.owner) || activity.responsible_role || null
    const late = (currentVarianceDays || 0) > 0 || overdueDays > 0
    const completed = progress === 100 || Boolean(actualFinish)
    const status = completed ? 'Complete' : blocker ? 'Blocked' : !controlActivities ? 'Unavailable' : late ? `Late ${Math.max(currentVarianceDays || 0, overdueDays)}d` : progress === null ? 'Not reported' : progress === 0 ? 'Not started' : 'On plan'
    return {
      id: activity.id, code: activity.external_id || String(activity.id), name: activity.name,
      controlRole: update?.control_role || (detailedEngineering ? ownedIds.has(String(activity.id)) ? 'owned' : controlScope?.dependency_activity_ids?.some(id => String(id) === String(activity.id)) ? 'dependency' : 'unconfirmed' : 'owned'),
      discipline: activity.discipline || 'Unassigned', owner, progress, status,
      tone: completed ? 'success' : blocker || late ? 'danger' : progress === null || progress === 0 ? 'neutral' : 'success',
      baselineStart, baselineFinish, currentStart, currentFinish, start: currentStart, finish: currentFinish,
      forecastFinish, actualFinish, varianceDays, currentVarianceDays, currentFinishSource, overdueDays, isLate: late, completed,
      isCritical: Boolean(activity.is_critical), isMilestone: Boolean(activity.is_milestone || ['start_milestone', 'finish_milestone'].includes(activity.activity_type)),
      blocker, blockerId: blockerItem?.id || null, lastReportedDate: date(update?.last_reported_date),
      plannedProgress: percent(update?.planned_progress_pct), totalFloatDays: number(activity.total_float_days),
    }
  }) ?? null
  const aggregateActivities = detailedEngineering ? activities?.filter(row => ownedIds.has(String(row.id))) : activities
  const reportedActivities = aggregateActivities?.filter(row => row.lastReportedDate) || []
  const actualProgress = scopeReady && controls && reportedActivities.length ? percent(controls.progress_pct) : null
  const plannedProgress = !scopeReady || (detailedEngineering && baselineApproved && !baselineScopeComparable) ? null : baselineApproved ? plannedPercent(aggregateBaselineActivities, dataDate) : controls && aggregateSourceActivities.length ? percent(controls.planned_progress_pct) : null
  const variance = progressComparable && actualProgress !== null && plannedProgress !== null ? round(actualProgress - plannedProgress) : null
  let spi = null
  let spiNote = 'SPI requires reported earned value and planned value from a comparable schedule.'
  if (actualProgress !== null && baselineApproved) {
    if (baselineScopeComparable && (detailedEngineering ? aggregateSourceActivities.every(row => progressById.has(String(row.id))) : controlActivities?.length === sourceActivities?.length)) {
      let plannedValue = 0
      let earnedValue = 0
      let valid = true
      for (const activity of aggregateSourceActivities) {
        const status = progressById.get(String(activity.id))
        const budget = number(status?.budgeted_cost)
        const fraction = plannedFraction(aggregateBaselineByCode.get(activity.external_id), dataDate)
        const progress = percent(status?.physical_progress_pct)
        if (budget === null || fraction === null || progress === null) { valid = false; break }
        plannedValue += budget * fraction
        earnedValue += budget * progress / 100
      }
      if (valid && plannedValue > 0) spi = round(earnedValue / plannedValue)
    }
    spiNote = spi === null ? 'SPI is unavailable: approved baseline activities and current resource budgets cannot be compared completely.' : 'Earned value divided by planned value at the data date, using selected approved baseline dates and current activity cost weights.'
  } else if (actualProgress !== null && !baselineApproved) {
    spi = number(controls?.spi)
    spiNote = 'Earned value divided by planned value against the current schedule; no approved baseline is selected.'
  }
  const fullForecastCoverage = scopeReady && aggregateActivities?.length > 0 && aggregateActivities.every(row => row.actualFinish || row.forecastFinish)
  const forecastFinish = fullForecastCoverage ? aggregateActivities.map(row => row.actualFinish || row.forecastFinish).sort().at(-1) : null
  const milestones = activities?.filter(row => row.isMilestone).sort((a, b) => String(a.baselineFinish || a.currentFinish || '9999').localeCompare(String(b.baselineFinish || b.currentFinish || '9999'))) ?? null
  const criticalActivities = activities?.filter(row => row.isCritical || row.isLate || row.blocker).sort((a, b) => Number(Boolean(b.blocker)) - Number(Boolean(a.blocker)) || Number(b.isLate) - Number(a.isLate) || (b.currentVarianceDays || b.overdueDays) - (a.currentVarianceDays || a.overdueDays)) ?? null
  const lookAheadActivities = activities?.filter(row => lookAheadStart && lookAheadEnd && !row.completed && row.currentStart && row.currentFinish && row.currentStart <= lookAheadEnd && row.currentFinish >= lookAheadStart).sort((a, b) => String(a.currentStart).localeCompare(String(b.currentStart))) ?? null
  const assurance = workspace?.schedule_assurance
  const assuranceCurrent = Boolean(assurance && version?.calculated_at && assurance.calculated_state_at === version.calculated_at && assurance.status !== 'superseded')
  const criticalValidated = Boolean(assuranceCurrent && assurance.status === 'approved' && !assurance.blockers?.length)
  const chartMap = new Map()
  const putDate = value => {
    const day = date(value)
    if (day && !chartMap.has(day)) chartMap.set(day, { date: day, planned: null, actual: null })
    return day ? chartMap.get(day) : null
  }
  // Captured points are observations; the service's generated curve carries
  // actual values into the future, so it is used only for planned dates.
  for (const point of controls?.curve || []) {
    const row = putDate(point.date)
    if (row && scopeReady && !baselineApproved) row.planned = percent(point.planned_progress_pct)
  }
  for (const activity of aggregateBaselineActivities) { putDate(activity.planned_start); putDate(activity.planned_finish) }
  if (dataDate) putDate(dataDate)
  const captured = [...(controls?.snapshots || [])].sort((a, b) => String(a.data_date || '').localeCompare(String(b.data_date || '')) || Number(a.revision || 0) - Number(b.revision || 0) || String(a.updated_at || a.created_at || '').localeCompare(String(b.updated_at || b.created_at || '')) || String(a.id || '').localeCompare(String(b.id || ''), undefined, { numeric: true }))
  for (const point of captured) {
    if (!date(point.data_date) || !dataDate || point.data_date > dataDate) continue
    if (detailedEngineering) {
      const capturedScope = point.payload?.control_scope
      const capturedIds = new Set((Array.isArray(capturedScope?.owned_activity_ids) ? capturedScope.owned_activity_ids : []).map(String))
      if (!scopeReady || capturedScope?.ready !== true || capturedScope?.scope_type !== 'detailed_engineering' || capturedIds.size !== ownedIds.size || [...capturedIds].some(id => !ownedIds.has(id))) continue
    }
    const row = putDate(point.data_date)
    if (row) row.actual = percent(point.progress_pct)
  }
  if (actualProgress !== null && dataDate) putDate(dataDate).actual = actualProgress
  const chartPoints = [...chartMap.values()].sort((a, b) => a.date.localeCompare(b.date)).map(row => ({
    ...row, planned: !scopeReady || (detailedEngineering && baselineApproved && !baselineScopeComparable) ? null : baselineApproved ? plannedPercent(aggregateBaselineActivities, row.date) : row.planned,
  })).filter(row => row.planned !== null || row.actual !== null).map(row => ({
    ...row, variance: progressComparable && row.actual !== null && row.planned !== null ? round(row.actual - row.planned) : null,
  }))
  const baselineLabel = baseline?.label || 'No approved baseline'
  const chartBaselineLabel = baselineApproved ? 'Approved baseline' : 'Current schedule plan'
  const chartNote = `${scopeNote ? `${scopeNote} ` : ''}${baselineApproved ? 'Planned progress is duration-weighted from the selected approved baseline dates.' : 'Planned progress follows current schedule dates; it is not an approved baseline.'}${progressComparable ? '' : ` ${comparisonNote}`} Actual points are captured schedule controls and the current reported update.${detailedEngineering ? ' Historical observations with a different or unrecorded controlled scope are excluded.' : ''} No future actual progress or forecast curve is inferred.`
  const staleActivities = aggregateActivities?.filter(row => !row.completed && row.lastReportedDate && difference(dataDate, row.lastReportedDate) > 14) || []
  const missingReports = controlActivities ? aggregateActivities?.filter(row => !row.lastReportedDate) || [] : []
  const exceptions = (openItems || []).map(item => ({
    id: `governance-${item.id}`, priority: item.priority || 'medium', title: item.title, detail: item.description || '',
    owner: userName(item.owner), dueDate: date(item.due_date), button: 'Review', view: 'planner', activityId: item.activity || null,
  }))
  const addException = (id, priority, title, detail, view = 'planner', button = 'Review') => exceptions.push({ id, priority, title, detail, owner: null, dueDate: null, view, button })
  if (issues.length) addException('data-unavailable', 'high', 'Review unavailable schedule data', issues.join(' '), 'quality')
  if (detailedEngineering && !scopeReady) addException('control-scope', 'high', 'Confirm engineering activity ownership', scopeNote, 'quality')
  if (data.projects && !data.linkedProject) addException('workspace-missing', 'high', 'Connect the planning workspace', 'No planning workspace is linked to this enterprise project.', 'planner', 'Open')
  else if (data.linkedProject && data.schedules && !schedule) addException('schedule-missing', 'high', 'Create the project schedule', 'The linked workspace has no schedule.', 'planner', 'Open')
  if (workspace && !baselineApproved) addException('baseline-missing', 'high', 'Establish an approved baseline', 'No approved baseline is selected for this schedule.')
  if (workspace && baselineApproved && !progressComparable) addException('baseline-comparison', 'high', 'Review baseline comparability', comparisonNote, 'quality')
  if (variance !== null && variance < 0) addException('recovery-plan', spi !== null && spi < 0.9 ? 'critical' : 'high', 'Review the recovery schedule', `Reported progress is ${Math.abs(variance)} percentage points behind the selected plan.`, 'planner', 'Update')
  if (milestones && !milestones.length) addException('milestones-missing', 'high', 'Add schedule milestones', 'No milestones are recorded in this schedule.', 'planner', 'Add')
  if (workspace && !criticalValidated) addException('critical-validation', 'high', 'Validate the critical path', assuranceCurrent ? 'The current schedule assurance has not been approved.' : 'An approved assurance review is required for the current calculated state.')
  if (staleActivities.length) addException('stale-activities', 'medium', `Update ${staleActivities.length} stale activities`, 'The last reported status is more than 14 days before the data date.', 'planner', 'Open')
  if (missingReports.length) addException('missing-progress', 'medium', `Report progress for ${missingReports.length} activities`, 'These activities have no recorded progress update.', 'planner', 'Update')
  const severity = { critical: 0, high: 1, medium: 2, low: 3 }
  exceptions.sort((a, b) => (severity[a.priority] ?? 2) - (severity[b.priority] ?? 2))
  const recoveryScenarios = workspace ? (assuranceCurrent && assurance?.contract_scenarios?.available ? (assurance.contract_scenarios.scenarios || []).filter(row => number(row.required_reduction_working_days) !== null).map(row => ({
    id: row.code, name: row.label, requiredReductionDays: number(row.required_reduction_working_days),
    forecastFinish: date(row.forecast_finish), risk: row.feasibility === 'high_risk' ? 'High' : row.feasibility === 'met' ? 'Target met' : 'Needs review',
    costImpact: null, note: row.note || 'Analytical target only; recovery gains require a reviewed schedule revision.',
  })) : []) : null
  const progressCurrent = actualProgress !== null && !staleActivities.length && !missingReports.length
  const quality = [
    { id: 'baseline', label: 'Baseline', ready: baselineApproved && progressComparable, status: workspace ? baselineApproved ? progressComparable ? 'Approved' : 'Review comparison' : 'Missing approval' : 'Unavailable', detail: baselineApproved ? `${baselineLabel}; approved ${String(baseline.approved_at).slice(0, 10)}. ${comparisonNote}` : 'Select or establish an approved schedule baseline.' },
    { id: 'progress', label: 'Progress update', ready: progressCurrent, status: !controls || !scopeReady ? 'Unavailable' : progressCurrent ? 'Current' : reportedActivities.length ? 'Incomplete' : 'Not reported', detail: !scopeReady ? scopeNote : `${reportedActivities.length} of ${aggregateActivities?.length || 0} ${detailedEngineering ? 'controlled engineering ' : ''}activities have reports; ${staleActivities.length} are more than 14 days old at the data date.` },
    { id: 'milestones', label: 'Milestones', ready: Boolean(milestones?.length), status: milestones === null ? 'Unavailable' : milestones.length ? 'Recorded' : 'Missing', detail: milestones?.length ? `${milestones.length} schedule milestones recorded. Contractual completeness requires review.` : 'No milestone readiness can be confirmed.' },
    { id: 'critical-path', label: 'Critical path', ready: criticalValidated, status: !workspace ? 'Unavailable' : criticalValidated ? 'Validated' : 'Needs validation', detail: criticalValidated ? 'Current calculated state has an approved schedule assurance review.' : 'No current approved assurance confirms the critical path.' },
    { id: 'forecast', label: 'Forecast confidence', ready: false, status: forecastFinish ? 'Not assessed' : 'Pending update', detail: `No forecast confidence percentage has been calculated. A ${detailedEngineering ? 'controlled engineering' : 'project'} finish requires explicit actual or forecast finishes for every ${detailedEngineering ? 'owned' : 'schedule'} activity.` },
  ].map(row => ({ ...row, tone: row.ready ? 'success' : row.status === 'Unavailable' ? 'neutral' : 'warning' }))
  const health = !project ? { label: 'Select a project', tone: 'neutral' }
    : issues.length ? { label: 'Data unavailable', tone: 'warning' }
      : exceptions.some(row => row.priority === 'critical') || (spi !== null && spi < 0.9) || (variance !== null && variance < 0) || activities?.some(row => row.isLate && !row.completed) ? { label: 'At risk', tone: 'danger' }
        : quality.some(row => !row.ready && row.id !== 'forecast') ? { label: 'Needs review', tone: 'warning' }
          : { label: 'On plan', tone: 'success' }
  return {
    linkedProject: data.linkedProject, schedule, version, projects: data.projects,
    schedules: data.schedules, versions: (data.versions || []).map(versionOption),
    baseline, baselines, baselineApproved, baselineLabel, chartBaselineLabel,
    baselineNote: baselineApproved ? 'Approved baseline — read only' : 'An approved baseline is required for a controlled comparison.',
    dataDate, projectDataDate: date(performance?.dataDate), plannedProgress, actualProgress, spi, spiNote, variance, forecastFinish,
    progressComparable, baselineScopeComparable, comparisonNote, controlScope, scopeReady, scopeNote, detailedEngineering,
    forecastNote: `${scopeNote ? `${scopeNote} ` : ''}${forecastFinish ? 'Latest of the explicit activity forecasts and recorded actual finishes; confidence has not been assessed.' : 'Complete activity forecast updates are required. Planned dates are not substituted for forecasts.'}`,
    progressNote: `${scopeNote ? `${scopeNote} ` : ''}Duration-weighted schedule progress at the data date. Unreported activities contribute zero to the aggregate but remain marked Not reported in the activity register. ${comparisonNote}`,
    chartPoints, chartNote, activities, criticalActivities, lookAheadActivities, lookAheadStart, lookAheadEnd,
    milestones, exceptions, recoveryScenarios, quality, health,
    canEdit: Boolean(workspace?.can_edit), canControl: Boolean(workspace?.can_control),
    disciplines: [...new Set((activities || []).map(row => row.discipline))].sort(),
    owners: [...new Set((activities || []).map(row => row.owner).filter(Boolean))].sort(),
    availability: { projects: data.projects !== null, schedules: data.schedules !== null, workspace: workspace !== null, controls: controls !== null, governance: data.governance !== null },
  }
}

export default function useSchedulePerformance(project, projectPerformance, revision = 0, options = {}) {
  const { enabled = true, baselineId = null, planningProjectId = null, scheduleId = null, versionId = null, generationId = null, analysisRunId = null } = options
  const [reloadToken, setReloadToken] = useState(0)
  const [state, setState] = useState({ key: null, loading: false, issues: [], data: emptyData(), loadedAt: null })
  const projectId = project?.id ?? null
  const updatedAt = project?.updated_at ?? null
  const key = `${projectId || ''}:${planningProjectId || ''}:${scheduleId || ''}:${versionId || ''}:${generationId || ''}:${analysisRunId || ''}`
  const reload = useCallback(() => setReloadToken(value => value + 1), [])
  useEffect(() => {
    // A document draft has no selected relational version. Do not silently
    // substitute an older canonical schedule in its header or export action.
    if (!enabled || !projectId || generationId || analysisRunId) return undefined
    let current = true
    const controller = new AbortController()
    const signal = controller.signal
    setState({ key, loading: true, issues: [], data: emptyData(), loadedAt: null })
    const load = async () => {
      const data = emptyData()
      const issues = []
      const stage = 'Project schedule selection'
      try {
        Object.assign(data, await resolvePlanningSchedule(projectId, { planningProjectId, scheduleId, versionId }, { signal }))
        if (!current) return
        if (!data.version) return
        const requests = [
          ['workspace', 'Schedule workspace', endpoints.scheduleWorkspace(data.version.id)],
          ['controls', 'Schedule progress', endpoints.scheduleControls(data.version.id)],
          ['governance', 'Schedule exceptions', endpoints.scheduleGovernance(data.version.id)],
        ]
        const results = await Promise.allSettled(requests.map(([field, , endpoint]) => apiClient.get(endpoint, {
          signal, suppressErrorToast: true,
          ...(field === 'controls' && data.schedule.data_date ? { params: { data_date: data.schedule.data_date } } : {}),
        })))
        results.forEach((result, index) => {
          const [field, label] = requests[index]
          if (result.status === 'fulfilled') data[field] = result.value.data
          else issues.push(messageFor(label, result.reason))
        })
      } catch (error) {
        if (!signal.aborted) issues.push(messageFor(stage, error))
      } finally {
        if (current) setState({ key, loading: false, data, issues, loadedAt: new Date().toISOString() })
      }
    }
    load()
    return () => { current = false; controller.abort() }
  }, [enabled, projectId, updatedAt, revision, reloadToken, planningProjectId, scheduleId, versionId, generationId, analysisRunId, key])
  const matches = state.key === key
  const performanceModel = projectPerformance?.model || projectPerformance
  const model = useMemo(() => ({ ...buildScheduleModel(project, performanceModel, matches ? state.data : emptyData(), matches ? state.issues : [], { baselineId }), generationId, analysisRunId }), [project, performanceModel, matches, state.data, state.issues, baselineId, generationId, analysisRunId])
  return { loading: Boolean(enabled && projectId && !generationId && !analysisRunId && (!matches || state.loading)), issues: matches ? state.issues : [], model, reload, loadedAt: matches ? state.loadedAt : null, rawData: matches ? state.data : null, projectId }
}
