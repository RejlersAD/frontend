import { useCallback, useEffect, useMemo, useState } from 'react'
import apiClient from '../../services/api.service'
import * as PC from '../../services/projectControl.service'
import { PROJECT_CONTROL_ENDPOINTS } from '../../config/projectControl.config'
import { PLANNING_ENDPOINTS } from '../../config/planningIntelligence.config'
import { buildRiskChangeModel } from './useRiskChangeControl'

const rowsOf = value => Array.isArray(value) ? value : value?.results || []
const numeric = value => (typeof value === 'number' || typeof value === 'string') && String(value).trim() !== '' && Number.isFinite(Number(value)) ? Number(value) : null
const firstNumber = (...values) => values.map(numeric).find(value => value !== null) ?? null
const progressNumber = value => {
  const number = numeric(value)
  return number !== null && number >= 0 && number <= 100 ? number : null
}
const parsedDate = value => {
  if (!value) return null
  const parsed = new Date(String(value).length === 10 ? `${value}T00:00:00` : value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}
const dateOnly = value => {
  const date = parsedDate(value)
  return date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` : null
}

export const formatDate = (value, fallback = 'Not provided') => parsedDate(value)?.toLocaleDateString(undefined, {
  day: 'numeric', month: 'short', year: 'numeric',
}) || fallback

export const formatDateTime = (value, fallback = '—') => parsedDate(value)?.toLocaleString(undefined, {
  day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
}) || fallback

export const formatMoney = (value, currency = 'AED', fallback = 'Not available') => {
  const amount = numeric(value)
  if (amount === null) return fallback
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)
  } catch {
    return `${currency} ${amount.toLocaleString()}`
  }
}

export const projectManagerName = project => {
  const manager = project?.team_members_data?.find(item => item.role === 'project_manager' && item.is_active)?.user
  const owner = manager || project?.owner
  return owner ? [owner.first_name, owner.last_name].filter(Boolean).join(' ') || owner.email || 'Not assigned' : project?.owner_name || 'Not assigned'
}

async function allPages(firstRequest, nextRequest, isCurrent) {
  let data = await firstRequest()
  const rows = [...rowsOf(data)]
  let page = 1
  while (data?.next && isCurrent()) {
    if (page >= 100) throw new Error('The record list exceeds the dashboard history limit.')
    data = await nextRequest(++page)
    rows.push(...rowsOf(data))
  }
  return rows
}

function latestPeriods(rows) {
  const periods = new Map()
  for (const row of rows) {
    if (!parsedDate(row.data_date) || !parsedDate(row.sealed_at)) continue
    const key = String(row.reporting_period ?? row.data_date)
    const previous = periods.get(key)
    if (!previous || Number(row.version || 0) > Number(previous.version || 0) || (
      Number(row.version || 0) === Number(previous.version || 0) && String(row.sealed_at) > String(previous.sealed_at)
    )) periods.set(key, row)
  }
  return [...periods.values()].sort((a, b) => String(a.data_date).localeCompare(String(b.data_date)) || String(a.sealed_at).localeCompare(String(b.sealed_at)))
}

function issueMessage(label, error) {
  const status = error?.response?.status
  if (status === 401 || status === 403) return `${label} is unavailable for this account.`
  if (status === 404 || status >= 500) return `${label} is temporarily unavailable.`
  if (error?.message === 'The record list exceeds the dashboard history limit.') return `${label} exceeds the dashboard history limit; review the full register.`
  return `${label} could not be loaded. Retry to refresh this information.`
}

export function buildProjectPerformanceModel(project, data, issues = []) {
  const kpis = data.kpis
  const commercial = data.commercial
  const currency = kpis?.currency || commercial?.currency || project?.currency || 'AED'
  const contractCurrency = project?.currency || commercial?.currency || kpis?.currency || 'AED'
  const periods = latestPeriods(data.snapshots || [])
  const latestSnapshot = periods.at(-1) || null
  const legacyCostBasis = latestSnapshot?.actual_cost_basis === 'legacy_period'
  const snapshotProgress = progressNumber(latestSnapshot?.progress_pct)
  const workingProgressConfirmed = project?.custom_fields?.control_setup?.progress_confirmed !== false
  const currentProgress = workingProgressConfirmed ? progressNumber(project?.progress) : null
  const historyAvailable = Array.isArray(data.snapshots)
  const noSealedPeriods = historyAvailable && !latestSnapshot && data.snapshots.length === 0
  const workingFallback = noSealedPeriods && workingProgressConfirmed
  const progress = latestSnapshot ? snapshotProgress : workingFallback ? currentProgress : null
  const plannedProgress = progressNumber(latestSnapshot?.planned_progress_pct)
  const forecast = kpis?.forecast || {}
  // One immutable observation supplies every reported performance metric.
  // Neither newer working values nor an independently loaded forecast can fill
  // missing fields or move the data date of this sealed reporting period.
  const spi = numeric(latestSnapshot?.spi)
  const cpi = legacyCostBasis ? null : numeric(latestSnapshot?.cpi)
  const eac = legacyCostBasis ? null : numeric(latestSnapshot?.estimate_at_completion)
  const budget = firstNumber(kpis?.budget, commercial?.budget)
  const actual = firstNumber(kpis?.spent, commercial?.actual)
  const committed = firstNumber(kpis?.committed, commercial?.committed)
  const remaining = firstNumber(kpis?.remaining, commercial?.remaining_budget, budget !== null && actual !== null ? budget - actual : null)
  // The commercial endpoint converts a missing contract to zero. Prefer the
  // project field so an unknown contract is never represented as a real zero.
  const contract = numeric(project?.contract_value)
  const baselineFinish = dateOnly(project?.end_date)
  const forecastFinish = dateOnly(forecast.forecast_finish || forecast.finish_date || project?.custom_fields?.forecast_finish)
  const dataDate = latestSnapshot?.data_date || (workingFallback ? dateOnly(project?.custom_fields?.data_date) : null)
  const variance = progress !== null && plannedProgress !== null ? Math.round((progress - plannedProgress) * 100) / 100 : null
  const progressSource = latestSnapshot ? 'Sealed reporting period' : noSealedPeriods && !workingProgressConfirmed ? 'Progress to confirm' : workingFallback ? 'Working project record' : 'Reporting source unavailable'
  const reportingNote = latestSnapshot
    ? 'Progress, planned progress, variance, SPI, CPI and estimate at completion use this sealed reporting period. Current schedule updates may be newer.'
    : noSealedPeriods && !workingProgressConfirmed
      ? 'Operational progress has not been confirmed. Administrative setup values are not reported as actual progress, and no sealed reporting periods exist.'
    : workingFallback
      ? 'No sealed reporting periods exist. Progress is the manually reported working project value; no planned progress, variance or performance indices are inferred.'
      : 'Sealed reporting history could not be verified. Working project progress is not substituted for a governed report.'
  const risk = buildRiskChangeModel(project, data.changes, {}, data.governance)
  const riskAvailable = risk.availability.governance
  const milestones = [...(data.milestones || [])].sort((a, b) => (a.target_date || '9999').localeCompare(b.target_date || '9999'))
  const tasks = data.tasks || []
  const openChanges = (data.changes || []).filter(change => ['detected', 'reviewed'].includes(change.status))
  const recentEvents = [...(commercial?.recent_events || [])].sort((a, b) => String(b.event_at).localeCompare(String(a.event_at)))
  const chartPoints = periods.map(row => ({
    date: dateOnly(row.data_date), planned: progressNumber(row.planned_progress_pct), actual: progressNumber(row.progress_pct),
  })).filter(row => row.date && (row.planned !== null || row.actual !== null))
  const fallbackPeriods = periods.some(row => row.source_manifest?.schedule_source !== 'approved_schedule_snapshot')
  const chartNote = chartPoints.length ? (
    fallbackPeriods
      ? 'Sealed period values include recorded project progress or control-account date calculations. They are not all derived from approved schedule snapshots.'
      : 'Values come from sealed reporting periods linked to approved schedule snapshots. Lines connect recorded observations; no future progress is inferred.'
  ) : data.snapshots === null
    ? 'Reporting history is unavailable. A progress curve cannot be shown.'
    : 'No sealed reporting periods are available. Planned or historical progress is not inferred from the current project record.'
  const manager = projectManagerName(project)
  const today = parsedDate(dateOnly(new Date()))
  const soon = today ? new Date(today.getTime() + 14 * 86400000) : null
  const overdueMilestones = milestones.filter(item => !item.is_completed && parsedDate(item.target_date) && parsedDate(item.target_date) < today)
  const dueMilestones = milestones.filter(item => !item.is_completed && parsedDate(item.target_date) && parsedDate(item.target_date) >= today && parsedDate(item.target_date) <= soon)
  const costKnown = kpis !== null && kpis !== undefined || commercial !== null && commercial !== undefined
  const currenciesMatch = String(currency).toUpperCase() === String(contractCurrency).toUpperCase()
  const budgetAboveContract = currenciesMatch && budget !== null && contract !== null && budget > contract
  const costWarning = !currenciesMatch && contract !== null
    ? 'Cost and contract figures use different currencies. Review them before comparing amounts.'
    : budgetAboveContract
      ? 'Control budget exceeds the recorded contract value. Review scope and approved allowances before using the forecast.'
      : costKnown && !(budget > 0)
        ? 'A control budget has not been established. Forecast cost performance requires a budget and a reported EVM period.'
        : ''
  const forecastWarning = data.milestones === null
    ? 'Milestone information is unavailable, so forecast readiness cannot be confirmed.'
    : milestones.length === 0
      ? 'No project milestones are recorded. A reliable finish forecast cannot be confirmed.'
      : !forecastFinish ? 'No explicit forecast finish has been recorded.' : ''

  const confidence = [
    { label: 'Schedule data', ready: chartPoints.length > 0, status: data.snapshots === null ? 'Unavailable' : chartPoints.length ? 'Recorded' : 'Missing', view: 'controls-periods' },
    { label: 'Cost baseline', ready: budget > 0 && !costWarning, status: budget > 0 && !costWarning ? 'Established' : 'Review required', view: 'cost-dashboard' },
    { label: 'Ledger postings', ready: Number(kpis?.ledger_entry_count) > 0, status: !kpis ? 'Unavailable' : Number(kpis.ledger_entry_count) > 0 ? 'Recorded' : 'No postings', view: 'cost-dashboard' },
    { label: 'Milestones', ready: milestones.length > 0, status: data.milestones === null ? 'Unavailable' : milestones.length ? 'Recorded' : 'Missing', view: 'milestones' },
    { label: 'Risk register', ready: riskAvailable, status: riskAvailable ? 'Connected' : risk.availability.notConfigured ? 'Not connected' : 'Unavailable', view: 'risk' },
  ].map(row => ({ ...row, tone: row.ready ? 'success' : ['Unavailable', 'Not connected'].includes(row.status) ? 'neutral' : 'warning' }))
  const readinessCompleted = confidence.filter(row => row.ready).length
  const readinessTotal = confidence.length
  const actions = []
  const addAction = (id, priority, title, detail, owner, button, view, dueDate = null) => actions.push({ id, priority, title, detail, owner, dueDate, button, view })
  if (issues.length) addAction('data-unavailable', 'high', 'Review unavailable project data', issues.join(' '), 'Project Controls', 'Review data', 'data-quality')
  if (costWarning) addAction('budget-review', 'high', budgetAboveContract ? 'Review project budget' : budget > 0 ? 'Review cost currency' : 'Establish control budget', budgetAboveContract ? `Contract ${formatMoney(contract, project?.currency || currency)}; budget ${formatMoney(budget, currency)}` : budget > 0 ? 'Cost and contract currencies differ.' : 'No control budget recorded.', 'Project Controls', 'Review', 'cost-dashboard')
  if (project && (!project.client_name || !project.scope_type)) addAction('project-details', 'medium', 'Complete project details', [!project.client_name && 'Client is missing.', !project.scope_type && 'Scope type is missing.'].filter(Boolean).join(' '), manager, 'Edit project', 'edit-project')
  if (data.milestones !== null && milestones.length === 0 && project) addAction('milestones-missing', 'high', 'Add project milestones', 'No milestones recorded.', manager, 'Add', 'milestones')
  if (overdueMilestones.length) addAction('milestones-overdue', 'high', `${overdueMilestones.length} overdue milestone${overdueMilestones.length === 1 ? '' : 's'}`, overdueMilestones.slice(0, 2).map(item => item.name).join(' · '), manager, 'Review', 'milestones', overdueMilestones[0].target_date)
  if (dueMilestones.length) addAction('milestones-due', 'medium', `${dueMilestones.length} milestone${dueMilestones.length === 1 ? '' : 's'} due within 14 days`, dueMilestones.slice(0, 2).map(item => item.name).join(' · '), manager, 'Review', 'milestones', dueMilestones[0].target_date)
  if (spi !== null && spi < 1) addAction('schedule-variance', 'high', 'Review schedule variance', `SPI ${spi.toFixed(2)} — behind plan.`, manager, 'Update', 'plan-baseline')
  if (cpi !== null && cpi < 1) addAction('cost-performance', 'high', 'Review cost performance', `CPI ${cpi.toFixed(2)} — below plan.`, 'Project Controls', 'Review', 'commercial-dashboard')
  if (legacyCostBasis) addAction('legacy-cost-basis', 'high', 'Review legacy reporting cost basis', 'The sealed record uses period-only actual cost. CPI and estimate at completion require a cumulative cost basis and are unavailable.', 'Project Controls', 'Review', 'controls-periods')
  if (openChanges.length) addAction('changes-review', openChanges.some(row => row.severity === 'critical') ? 'critical' : openChanges.some(row => row.severity === 'high') ? 'high' : 'medium', `${openChanges.length} change${openChanges.length === 1 ? '' : 's'} awaiting review`, openChanges.slice(0, 2).map(row => row.summary).join(' · '), manager, 'Review', 'risk')
  if (project && !riskAvailable) addAction('risk-coverage', 'medium', risk.availability.notConfigured ? 'Connect the risk register' : 'Review unavailable risk data', risk.availability.notConfigured ? 'No current linked schedule register is configured.' : 'The current linked schedule register could not be loaded.', 'Project Controls', 'Review', 'risk')
  if (riskAvailable && risk.counts.highRisks) addAction('high-risks', 'high', `${risk.counts.highRisks} high or critical open risk${risk.counts.highRisks === 1 ? '' : 's'}`, risk.risks.filter(row => row.isOpen && ['critical', 'high'].includes(row.priority)).slice(0, 2).map(row => row.title).join(' · '), 'Project Controls', 'Review', 'risk')
  if (riskAvailable && risk.counts.overdueActions) addAction('risk-actions', 'high', `${risk.counts.overdueActions} overdue register action${risk.counts.overdueActions === 1 ? '' : 's'}`, 'Review assigned actions in the current linked schedule register.', 'Project Controls', 'Review', 'risk')
  const pendingRegisteredChanges = risk.changes.filter(row => row.source === 'governance' && ['open', 'in_review'].includes(row.status))
  if (riskAvailable && pendingRegisteredChanges.length) addAction('registered-changes', 'medium', `${pendingRegisteredChanges.length} registered change${pendingRegisteredChanges.length === 1 ? '' : 's'} awaiting decision`, pendingRegisteredChanges.slice(0, 2).map(row => row.title).join(' · '), 'Project Controls', 'Review', 'risk')
  actions.sort((a, b) => ({ critical: 0, high: 1, medium: 2 }[a.priority] - { critical: 0, high: 1, medium: 2 }[b.priority]))
  const attention = openChanges.some(row => row.severity === 'critical') || riskAvailable && risk.health.tone === 'danger' || overdueMilestones.length > 0 || budget > 0 && actual !== null && actual > budget
  const health = !project ? { label: 'Select a project', tone: 'neutral' }
    : spi !== null && spi < 1 || cpi !== null && cpi < 1 ? { label: 'At risk', tone: 'danger' }
      : attention ? { label: 'Needs attention', tone: 'danger' }
      : issues.length ? { label: 'Data unavailable', tone: 'warning' }
        : actions.some(row => row.priority === 'high') || openChanges.length || riskAvailable && risk.health.tone === 'warning' || readinessCompleted < readinessTotal || forecastWarning
          ? { label: 'Needs review', tone: 'warning' }
          : { label: 'No flagged exceptions', tone: 'success' }

  return {
    progress, plannedProgress, spi, cpi, eac, budget, actual, committed, remaining, contract,
    currency, contractCurrency, dataDate, baselineFinish, baselineApproved: false,
    baselineSource: 'Recorded project plan', forecastFinish, variance, varianceUnit: 'percentage points',
    chartPoints, chartSource: 'Sealed reporting periods', chartNote, latestSnapshot,
    progressSource, reportingNote, reportingView: latestSnapshot ? 'controls-periods' : workingFallback ? 'edit-project' : 'data-quality',
    workingProgress: currentProgress, workingProgressConfirmed, workingDataDate: workingProgressConfirmed ? dateOnly(project?.custom_fields?.data_date) : null, workingUpdatedAt: project?.updated_at || null,
    reportingCurrency: latestSnapshot?.currency || currency, reportingVersion: latestSnapshot?.version ?? null,
    workingFallback, forecastFinishSource: 'Current working finish forecast',
    legacyCostBasis, reportingCostNote: legacyCostBasis ? 'This sealed record uses legacy period-only actual cost. CPI and estimate at completion are suppressed; the historical record remains unchanged.' : '',
    costSource: kpis ? 'Posted cost ledger' : commercial ? 'Commercial summary from the posted cost ledger' : 'Unavailable',
    forecastDataDate: latestSnapshot?.data_date || null,
    milestones: data.milestones === null ? null : milestones,
    tasks: data.tasks === null ? null : tasks,
    openChanges: data.changes === null ? null : openChanges,
    recentEvents: commercial === null || commercial === undefined ? null : recentEvents,
    actions, health, costWarning, forecastWarning,
    confidence, readinessScore: Math.round(readinessCompleted / readinessTotal * 100),
    readinessCompleted, readinessTotal, readinessNote: 'Completeness of the five listed data checks; not a prediction confidence score.',
    riskAvailable, risk, manager, overdueMilestones, dueMilestones,
    availability: {
      costs: costKnown, milestones: data.milestones !== null, tasks: data.tasks !== null,
      changes: data.changes !== null, activity: commercial !== null && commercial !== undefined,
      snapshots: data.snapshots !== null,
    },
  }
}

const emptyData = () => ({ kpis: null, commercial: null, milestones: null, tasks: null, changes: null, snapshots: null, governance: null })

// Resolve the same default scope as Schedule and Risks & Changes: latest linked
// planning project, active schedule, newest non-superseded version. Do not merge
// records from older versions or unrelated workspaces into the current register.
async function loadCurrentGovernance(projectId, signal, isCurrent) {
  const list = (endpoint, params) => allPages(
    () => apiClient.get(endpoint, { params, signal }).then(response => response.data),
    page => apiClient.get(endpoint, { params: { ...params, page }, signal }).then(response => response.data), isCurrent,
  )
  const newest = (a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')) || Number(b.id) - Number(a.id)
  const data = { projects: null, schedules: null, versions: null, version: null, governance: null }
  data.projects = (await list(PLANNING_ENDPOINTS.projects, { enterprise_project: projectId })).filter(row => String(row.enterprise_project) === String(projectId)).sort(newest)
  if (!data.projects.length || !isCurrent()) return data
  data.schedules = (await list(PLANNING_ENDPOINTS.schedules, { project: data.projects[0].id })).sort((a, b) => Number(b.status === 'active') - Number(a.status === 'active') || newest(a, b))
  if (!data.schedules.length || !isCurrent()) return data
  data.versions = (await list(PLANNING_ENDPOINTS.scheduleVersions, { schedule: data.schedules[0].id })).sort((a, b) => Number(b.version) - Number(a.version))
  data.version = data.versions.find(row => row.status !== 'superseded') || data.versions[0] || null
  if (!data.version || !isCurrent()) return data
  data.governance = (await apiClient.get(PLANNING_ENDPOINTS.scheduleGovernance(data.version.id), { signal })).data
  return data
}

export default function useProjectPerformance(project, revision = 0) {
  const [reloadToken, setReloadToken] = useState(0)
  const [state, setState] = useState({ projectId: null, loading: false, issues: [], data: emptyData() })
  const projectId = project?.id ?? null
  const projectUpdatedAt = project?.updated_at ?? null
  const reload = useCallback(() => setReloadToken(value => value + 1), [])

  useEffect(() => {
    if (!projectId) {
      setState({ projectId: null, loading: false, issues: [], data: emptyData() })
      return undefined
    }
    let current = true
    const controller = new AbortController()
    const active = () => current
    setState({ projectId, loading: true, issues: [], data: emptyData() })
    const requests = [
      ['kpis', 'Cost performance', () => PC.getCostKpis(projectId)],
      ['commercial', 'Commercial activity', () => PC.getCommercialDashboard(projectId)],
      ['milestones', 'Project milestones', () => allPages(() => PC.listProjectMilestones(projectId), page => PC.listProjectMilestones(projectId, { page }), active)],
      ['tasks', 'Project tasks', () => allPages(() => PC.listProjectTasks(projectId), page => PC.listProjectTasks(projectId, { page }), active)],
      ['changes', 'Project changes', () => allPages(() => PC.listChangeEvents(projectId), page => PC.listChangeEvents(projectId, { page }), active)],
      ['governance', 'Risk register', () => loadCurrentGovernance(projectId, controller.signal, active)],
      ['snapshots', 'Reporting history', () => allPages(
        () => PC.listIntegratedSnapshots(projectId),
        // The existing helper accepts only a project ID. Use the same fixed
        // endpoint for later pages rather than following a server-supplied URL.
        page => apiClient.get(PROJECT_CONTROL_ENDPOINTS.integratedSnapshots, { params: { project: projectId, page }, signal: controller.signal }).then(response => response.data),
        active,
      )],
    ]
    Promise.allSettled(requests.map(([, , request]) => Promise.resolve().then(request))).then(results => {
      if (!current) return
      const data = emptyData()
      const issues = []
      results.forEach((result, index) => {
        const [key, label] = requests[index]
        if (result.status === 'fulfilled') data[key] = result.value
        else issues.push(issueMessage(label, result.reason))
      })
      setState({ projectId, loading: false, issues, data })
    })
    return () => { current = false; controller.abort() }
  }, [projectId, projectUpdatedAt, revision, reloadToken])

  const matches = state.projectId === projectId
  const issues = matches ? state.issues : []
  const model = useMemo(() => buildProjectPerformanceModel(project, matches ? state.data : emptyData(), matches ? state.issues : []), [project, matches, state.data, state.issues])
  return { loading: Boolean(projectId) && (!matches || state.loading), issues, model, reload, rawData: matches ? state.data : null, projectId }
}
