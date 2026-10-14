import { useCallback, useMemo } from 'react'
import { useSelector } from 'react-redux'

const DAY = 86400000
const WRITE_ROLES = new Set(['project_manager', 'lead_engineer', 'engineer', 'designer'])
const MARKER = /\[RADAI schedule milestone: ([^:\]\r\n]+):([^:\]\r\n]+):([^\]\r\n]+)\]/g
const date = value => {
  const day = String(value || '').slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(day) && !Number.isNaN(Date.parse(`${day}T00:00:00Z`)) ? day : null
}
const number = value => (typeof value === 'number' || typeof value === 'string') && String(value).trim() !== '' && Number.isFinite(Number(value)) ? Number(value) : null
const days = value => date(value) ? Date.parse(`${date(value)}T00:00:00Z`) / DAY : null
const difference = (a, b) => days(a) !== null && days(b) !== null ? days(a) - days(b) : null
const labelOf = value => String(value || '').replace(/[._]/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase())
const sameId = (a, b) => a !== undefined && a !== null && b !== undefined && b !== null && String(a) === String(b)

export const milestoneImportMarker = (planningProjectId, scheduleId, activityCode) => (
  planningProjectId && scheduleId && activityCode
    ? `[RADAI schedule milestone: ${planningProjectId}:${scheduleId}:${activityCode}]`
    : null
)

function importProvenance(description) {
  const matches = [...String(description || '').matchAll(MARKER)]
  // Multiple different markers are ambiguous. Keep them visible and do not
  // attach the project record to an arbitrary schedule activity.
  const markers = [...new Set(matches.map(row => row[0]))]
  if (markers.length !== 1) return null
  const match = matches[0]
  return { marker: match[0], planningProjectId: match[1], scheduleId: match[2], activityCode: match[3] }
}

function canWriteProject(user, project) {
  if (!user || !project) return false
  if (user.is_staff || user.is_superuser || sameId(project.owner?.id ?? project.owner_id, user.id)) return true
  return Boolean(project.team_members_data?.some(member => member.is_active && sameId(member.user?.id ?? member.user_id, user.id) && WRITE_ROLES.has(member.role)))
}

function classify(row, dataDate) {
  const comparisonDate = row.baselineApproved ? row.baselineDate : row.targetDate
  const daysUntil = difference(comparisonDate, dataDate)
  const overdue = !row.achieved && daysUntil !== null && daysUntil < 0
  const dueSoon = !row.achieved && daysUntil !== null && daysUntil >= 0 && daysUntil <= 30
  const varianceDays = difference(row.actualDate || row.forecastDate, comparisonDate)
  const status = row.achieved ? 'Achieved' : row.blocker ? 'Blocked' : overdue ? 'Overdue'
    : varianceDays > 0 ? 'At risk' : dueSoon ? 'Due soon' : comparisonDate ? 'Upcoming' : 'Unscheduled'
  return {
    ...row, comparisonDate, daysUntil, overdue, dueSoon, blocked: Boolean(row.blocker && !row.achieved),
    varianceDays, varianceBasis: row.baselineApproved ? 'Approved schedule baseline' : row.source === 'project' ? 'Project target' : 'Current schedule target',
    status, tone: row.achieved ? 'success' : ['Blocked', 'Overdue'].includes(status) ? 'danger' : ['At risk', 'Due soon', 'Unscheduled'].includes(status) ? 'warning' : 'blue',
  }
}

export function buildMilestoneModel(project, projectRows, scheduleModel = {}, scheduleData = null, user = null, options = {}) {
  const workspace = scheduleData?.workspace
  const governance = scheduleData?.governance
  const schedule = scheduleModel.schedule || workspace?.schedule
  const scheduleVersion = scheduleModel.version || workspace?.version
  const planningProjectId = scheduleModel.linkedProject?.id || scheduleData?.linkedProject?.id
  const dataDate = date(scheduleModel.dataDate) || date(project?.custom_fields?.data_date) || date(options.today) || new Date().toISOString().slice(0, 10)
  const dataDateSource = date(scheduleModel.dataDate) ? 'Schedule reporting date' : date(project?.custom_fields?.data_date) ? 'Project reporting date' : 'Current date; no reporting date is recorded'
  const canEdit = canWriteProject(user, project)
  const activities = scheduleModel.activities || []
  const activityMap = new Map(activities.map(row => [String(row.id), row]))
  const plannedActivityMap = new Map((workspace?.activities || []).map(row => [String(row.id), row]))
  const relationships = Array.isArray(workspace?.relationships) ? workspace.relationships : null
  const auditEvents = Array.isArray(governance?.audit_events) ? governance.audit_events : null
  const auditUsers = new Map((governance?.members || []).map(row => [String(row.id), row.name || row.email || null]))
  const governanceItems = Array.isArray(governance?.items) ? governance.items : null
  const dependenciesFor = activityId => relationships?.filter(row => sameId(row.predecessor, activityId) || sameId(row.successor, activityId)).map(row => {
    const predecessor = sameId(row.successor, activityId)
    const relatedId = predecessor ? row.predecessor : row.successor
    const activity = activityMap.get(String(relatedId))
    return {
      id: row.id, activityId: relatedId, code: activity?.code || null, name: activity?.name || `Activity ${relatedId}`,
      direction: predecessor ? 'predecessor' : 'successor', relationshipType: row.relationship_type,
      lagDays: number(row.lag_days), targetDate: date(plannedActivityMap.get(String(relatedId))?.planned_finish),
      baselineDate: scheduleModel.baselineApproved ? activity?.baselineFinish || null : null,
      forecastDate: activity?.forecastFinish || null, actualDate: activity?.actualFinish || null,
      status: activity?.status || 'Unavailable', isCritical: Boolean(activity?.isCritical),
    }
  }) ?? null
  const historyFor = activityId => {
    if (auditEvents === null) return null
    const linkedItems = new Set((governanceItems || []).filter(row => sameId(row.activity, activityId)).map(row => String(row.id)))
    return auditEvents.filter(event => event.entity_type === 'ScheduleActivity' && sameId(event.entity_id, activityId) || event.entity_type === 'GovernanceItem' && linkedItems.has(String(event.entity_id))).map(event => ({
      id: event.id, date: event.created_at, action: event.action, title: labelOf(event.action),
      actor: auditUsers.get(String(event.actor)) || null, entityType: event.entity_type,
      before: event.before, after: event.after,
    })).sort((a, b) => String(b.date).localeCompare(String(a.date)))
  }
  const sourceScheduleRows = Array.isArray(scheduleModel.milestones) ? scheduleModel.milestones.map(activity => {
    const importMarker = milestoneImportMarker(planningProjectId, schedule?.id, activity.code)
    const linkedActivity = {
      id: activity.id, code: activity.code, name: activity.name, planningProjectId,
      scheduleId: schedule?.id || null, scheduleName: schedule?.name || null, versionId: scheduleVersion?.id || null,
      baselineDate: scheduleModel.baselineApproved ? activity.baselineFinish : null,
      baselineApproved: Boolean(scheduleModel.baselineApproved && activity.baselineFinish),
      forecastDate: activity.forecastFinish || null, actualDate: activity.actualFinish || null,
    }
    return classify({
      id: `schedule:${activity.id}`, source: 'schedule', sourceId: activity.id, code: activity.code,
      name: activity.name, type: 'schedule', typeLabel: 'Schedule milestone', sourceLabel: 'Schedule activity',
      owner: activity.owner || null, ownerSource: activity.owner ? 'Schedule responsibility or governance assignment' : null,
      targetDate: date(plannedActivityMap.get(String(activity.id))?.planned_finish), baselineDate: linkedActivity.baselineDate,
      baselineApproved: linkedActivity.baselineApproved, forecastDate: activity.forecastFinish || null,
      actualDate: activity.actualFinish || null, forecastSource: activity.forecastFinish ? 'Schedule progress report' : null,
      achieved: Boolean(activity.completed), isCritical: Boolean(activity.isCritical), blocker: activity.blocker || null,
      blockerAvailable: governanceItems !== null,
      progress: activity.progress, description: '', persistedDescription: '', imported: false,
      importMarker, linkedActivity, criteria: null, evidence: null, dependencies: dependenciesFor(activity.id),
      activityHistory: historyFor(activity.id), lastReportedDate: activity.lastReportedDate || null,
      canEdit: false, canOpenPlanner: true,
    }, dataDate)
  }) : []
  const byMarker = new Map(sourceScheduleRows.filter(row => row.importMarker).map(row => [row.importMarker, row]))
  const importedMarkers = new Set()
  const sourceProjectRows = (projectRows || []).map(record => {
    const imported = importProvenance(record.description)
    const linked = imported ? byMarker.get(imported.marker) : null
    if (imported) importedMarkers.add(imported.marker)
    return classify({
      id: `project:${record.id}`, source: 'project', sourceId: record.id, code: `PRJ-${record.id}`,
      name: record.name, type: 'project', typeLabel: 'Project milestone', sourceLabel: imported ? 'Imported project milestone' : 'Project register',
      owner: linked?.owner || null, ownerSource: linked?.owner ? 'Linked schedule activity' : null,
      targetDate: date(record.target_date), baselineDate: null, baselineApproved: false,
      forecastDate: linked?.forecastDate || null, actualDate: date(record.completed_date),
      forecastSource: linked?.forecastDate ? 'Linked schedule progress report' : null,
      achieved: Boolean(record.is_completed), isCritical: Boolean(linked?.isCritical), blocker: linked?.blocker || null,
      blockerAvailable: Boolean(linked?.blockerAvailable),
      progress: record.is_completed ? 100 : null,
      description: imported ? String(record.description || '').replaceAll(imported.marker, '').trim() : record.description || '',
      persistedDescription: record.description || '', imported: Boolean(imported), importMarker: imported?.marker || null,
      linkedActivity: linked?.linkedActivity || (imported ? {
        id: null, code: imported.activityCode, name: null, planningProjectId: imported.planningProjectId,
        scheduleId: imported.scheduleId, scheduleName: null, versionId: null,
        baselineDate: null, baselineApproved: false, forecastDate: null, actualDate: null,
      } : null),
      criteria: null, evidence: null, dependencies: linked?.dependencies ?? null,
      activityHistory: linked?.activityHistory ?? null, createdAt: record.created_at || null, updatedAt: record.updated_at || null,
      canEdit, canOpenPlanner: Boolean(linked),
    }, dataDate)
  })
  const importCandidates = sourceScheduleRows.map(row => ({
    ...row, alreadyImported: Boolean(row.importMarker && importedMarkers.has(row.importMarker)),
    targetDate: row.baselineApproved ? row.baselineDate : row.targetDate,
    importTargetSource: row.baselineApproved ? 'Approved schedule baseline date, copied as a project target' : 'Current schedule finish, copied as a project target',
    canImport: Boolean(canEdit && row.importMarker && (row.baselineApproved ? row.baselineDate : row.targetDate)),
  }))
  const rows = [...sourceProjectRows, ...sourceScheduleRows.filter(row => !row.importMarker || !importedMarkers.has(row.importMarker))]
    .sort((a, b) => String(a.comparisonDate || '9999').localeCompare(String(b.comparisonDate || '9999')) || a.name.localeCompare(b.name))
  const counts = {
    total: rows.length, achieved: rows.filter(row => row.achieved).length,
    dueSoon: rows.filter(row => row.dueSoon).length, overdue: rows.filter(row => row.overdue).length,
    blocked: rows.filter(row => row.blocked).length,
  }
  const scheduleConfigured = Boolean(schedule)
  const projectAvailable = projectRows !== null
  const scheduleAvailable = Array.isArray(scheduleModel.milestones) || Array.isArray(scheduleData?.projects) && scheduleData.projects.length === 0 || Array.isArray(scheduleData?.schedules) && scheduleData.schedules.length === 0 || Array.isArray(scheduleData?.versions) && scheduleData.versions.length === 0
  const countsComplete = projectAvailable && scheduleAvailable && (!scheduleConfigured || scheduleData?.controls !== null && scheduleData?.controls !== undefined && governanceItems !== null)
  const completionMissingDates = rows.filter(row => row.achieved && !row.actualDate)
  const ambiguousCompletions = sourceProjectRows.filter(row => !row.achieved && row.actualDate)
  const issues = options.issues || []
  const actions = []
  const add = (id, priority, title, detail, view = 'quality', rowId = null) => actions.push({ id, priority, title, detail, view, rowId, button: view === 'planner' ? 'Open planner' : 'Review' })
  if (issues.length) add('unavailable', 'high', 'Review unavailable milestone data', issues.join(' '))
  if (counts.overdue) add('overdue', 'high', `Review ${counts.overdue} overdue milestones`, 'Open target or baseline dates are earlier than the reporting date.', 'register')
  if (counts.blocked) add('blocked', 'high', `Resolve ${counts.blocked} milestone blockers`, 'Review the recorded schedule governance issues.', 'register')
  if (completionMissingDates.length) add('actual-dates', 'medium', 'Record actual completion dates', `${completionMissingDates.length} achieved milestones have no actual date recorded.`, 'register')
  if (ambiguousCompletions.length) add('completion-status', 'high', 'Review milestone completion status', `${ambiguousCompletions.length} project milestones have an actual date but are not marked completed.`, 'register')
  if (scheduleConfigured && !scheduleModel.baselineApproved) add('baseline', 'high', 'Review milestone baseline approval', 'Current schedule targets are available, but no approved baseline has been selected.', 'planner')
  if (!rows.length && projectAvailable && scheduleAvailable) add('empty-register', 'medium', 'Add project milestones', 'Create a project target or import an available schedule milestone.', 'register')
  const quality = [
    { id: 'register', label: 'Project register', ready: projectAvailable, status: projectAvailable ? 'Available' : 'Unavailable', detail: `${sourceProjectRows.length} persisted project milestones. Project targets are editable; they do not represent approved schedule baselines.` },
    { id: 'schedule', label: 'Schedule linkage', ready: scheduleAvailable, status: scheduleConfigured ? scheduleAvailable ? 'Connected' : 'Unavailable' : scheduleAvailable ? 'Not configured' : 'Unavailable', detail: 'Schedule relationships, forecasts, owners and blockers come from the linked schedule workspace.' },
    { id: 'actuals', label: 'Actual dates', ready: countsComplete && !completionMissingDates.length && !ambiguousCompletions.length, status: !countsComplete ? 'Unavailable' : completionMissingDates.length || ambiguousCompletions.length ? 'Review required' : 'No date issues', detail: `${completionMissingDates.length} achieved records have no actual completion date. Completion is not inferred from an elapsed target date.` },
    { id: 'criteria', label: 'Acceptance criteria', ready: false, status: 'Not configured', detail: 'The existing milestone register has no persisted acceptance-criteria fields.' },
    { id: 'evidence', label: 'Completion evidence', ready: false, status: 'Not configured', detail: 'The existing milestone register has no evidence attachments or acceptance workflow.' },
  ].map(row => ({ ...row, tone: row.ready ? 'success' : row.status === 'Unavailable' ? 'danger' : 'warning' }))
  const health = !project ? { label: 'Select a project', tone: 'neutral' }
    : issues.length ? { label: 'Data unavailable', tone: 'warning' }
      : counts.blocked || counts.overdue ? { label: 'At risk', tone: 'danger' }
        : rows.some(row => row.status === 'At risk') || completionMissingDates.length || ambiguousCompletions.length ? { label: 'Needs review', tone: 'warning' }
          : rows.length ? { label: 'On track', tone: 'success' } : { label: 'Not planned', tone: 'neutral' }
  return {
    rows, counts, ...counts, health, dataDate, dataDateSource, dueSoonDays: 30, quality, actions,
    canCreate: canEdit, canEdit, importCandidates,
    readinessNote: 'Milestone readiness uses recorded dates and schedule dependencies. Acceptance criteria and evidence are not configured; no completion-confidence percentage is calculated.',
    availability: { project: projectAvailable, schedule: scheduleAvailable, dependencies: relationships !== null, history: auditEvents !== null },
    countsComplete,
    owners: [...new Set(rows.map(row => row.owner).filter(Boolean))].sort(),
    types: [{ id: 'project', label: 'Project milestone' }, { id: 'schedule', label: 'Schedule milestone' }],
  }
}

export default function useMilestoneControl(project, performance, schedulePerformance, options = {}) {
  const { enabled = true } = options
  const user = useSelector(state => state.auth?.user || null)
  const projectId = project?.id ?? null
  const projectMatches = sameId(performance?.projectId, projectId)
  const scheduleMatches = sameId(schedulePerformance?.projectId, projectId)
  const projectRows = projectMatches && Array.isArray(performance?.rawData?.milestones) ? performance.rawData.milestones : null
  const scheduleModel = scheduleMatches ? schedulePerformance?.model : null
  const scheduleData = scheduleMatches ? schedulePerformance?.rawData : null
  const projectLoading = Boolean(performance?.loading)
  const scheduleLoading = Boolean(schedulePerformance?.loading)
  const scheduleIssues = schedulePerformance?.issues
  const loading = Boolean(enabled && projectId && (!projectMatches || !scheduleMatches || projectLoading || scheduleLoading))
  const issues = useMemo(() => {
    if (!enabled || !projectId || loading) return []
    const next = []
    if (projectRows === null) next.push('Project milestones are unavailable. Retry to refresh the register.')
    if (scheduleMatches) next.push(...(scheduleIssues || []))
    return next
  }, [enabled, projectId, loading, projectRows, scheduleMatches, scheduleIssues])
  const projectReload = performance?.reload
  const scheduleReload = schedulePerformance?.reload
  const reload = useCallback(() => { projectReload?.(); scheduleReload?.() }, [projectReload, scheduleReload])
  const model = useMemo(() => buildMilestoneModel(project, projectRows, scheduleModel || {}, scheduleData, user, { issues }), [project, projectRows, scheduleModel, scheduleData, user, issues])
  return { loading, issues, model, reload, loadedAt: scheduleMatches ? schedulePerformance?.loadedAt || null : null }
}
