import { planningGet } from './planningReads'
import { PLANNING_ENDPOINTS as endpoints } from '../config/planningIntelligence.config'

const sameId = (left, right) => String(left?.id ?? left) === String(right?.id ?? right)
const newest = (left, right) => String(right.created_at || '').localeCompare(String(left.created_at || '')) || Number(right.id) - Number(left.id)
const newestVersion = (left, right) => Number(right.version) - Number(left.version) || newest(left, right)

function invalidSelection(message) {
  const error = new Error(message)
  error.code = 'planning_selection_invalid'
  return error
}

function selectionId(value, label, optional = true) {
  if (optional && (value === null || value === undefined || value === '')) return null
  const id = String(value ?? '').trim()
  if (!/^[1-9]\d*$/.test(id)) throw invalidSelection(`Select a valid ${label}.`)
  return id
}

// Follow only the scoped endpoint, never a server-provided cross-origin next URL.
export async function listPlanningRows(endpoint, params, { signal } = {}) {
  const rows = []
  for (let page = 1; page <= 100; page += 1) {
    const response = await planningGet(endpoint, { params: { ...params, page }, signal, suppressErrorToast: true })
    const batch = Array.isArray(response.data) ? response.data : response.data?.results
    if (!Array.isArray(batch)) throw new Error('The planning register returned an invalid response. Retry to refresh it.')
    rows.push(...batch)
    if (!response.data?.next) return rows
  }
  throw new Error('This planning register exceeds the supported page limit.')
}

/** Resolve existing records only. Opening a selection never activates a version. */
export async function resolvePlanningSchedule(enterpriseProjectId, requested = {}, { signal } = {}) {
  const enterpriseId = selectionId(enterpriseProjectId, 'enterprise project', false)
  const planningProjectId = selectionId(requested.planningProjectId, 'planning workspace')
  const scheduleId = selectionId(requested.scheduleId, 'schedule')
  const versionId = selectionId(requested.versionId, 'schedule version')
  const generationId = selectionId(requested.generationId, 'saved generation')
  const analysisRunId = selectionId(requested.analysisRunId, 'document analysis')
  const projects = (await listPlanningRows(endpoints.projects, { enterprise_project: enterpriseId }, { signal }))
    .filter(row => sameId(row.enterprise_project, enterpriseId) && row.is_deleted !== true).sort(newest)
  const linkedProject = planningProjectId ? projects.find(row => sameId(row.id, planningProjectId)) : projects[0]
  if (!linkedProject) {
    if (planningProjectId || scheduleId || versionId || generationId || analysisRunId) throw invalidSelection('The selected planning workspace is not linked to this project or is no longer available.')
    return { linkedProject: null, schedule: null, version: null, projects, schedules: [], versions: [] }
  }

  if (analysisRunId && !versionId && !scheduleId) return { linkedProject, schedule: null, version: null, projects, schedules: [], versions: [] }

  const schedules = (await listPlanningRows(endpoints.schedules, { project: linkedProject.id }, { signal }))
    .filter(row => sameId(row.project, linkedProject.id) && row.is_deleted !== true)
    .sort((left, right) => Number(right.status === 'active') - Number(left.status === 'active') || newest(left, right))
  let schedule = scheduleId ? schedules.find(row => sameId(row.id, scheduleId)) : null
  if (scheduleId && !schedule) throw invalidSelection('The selected schedule does not belong to this planning workspace or is no longer available.')
  // The evidence workspace loads and validates the exact generation itself.
  // A saved draft does not depend on an older calculated master being readable.
  if ((generationId || analysisRunId) && !versionId && !scheduleId) return { linkedProject, schedule: null, version: null, projects, schedules, versions: [] }
  if (!schedules.length) {
    if (versionId) throw invalidSelection('The selected version does not belong to an available project schedule.')
    return { linkedProject, schedule: null, version: null, projects, schedules, versions: [] }
  }

  let selectedVersionId = versionId
  if (!selectedVersionId) {
    const { data: master } = await planningGet(`${endpoints.project(linkedProject.id)}simple-plan/`, { signal, suppressErrorToast: true })
    if (!master || !sameId(master.project_id, linkedProject.id)) throw invalidSelection('The current schedule selection could not be verified for this project.')
    selectedVersionId = selectionId(master.master_version_id, 'current master schedule version')
  }
  let selectedVersion = null
  if (selectedVersionId) {
    const { data: candidate } = await planningGet(endpoints.scheduleVersion(selectedVersionId), { signal, suppressErrorToast: true })
    const candidateSchedule = schedules.find(row => sameId(row.id, candidate?.schedule))
    if (!candidate || !sameId(candidate.id, selectedVersionId) || !candidateSchedule || candidate.is_deleted === true) {
      throw invalidSelection('The selected version does not belong to an available project schedule.')
    }
    if (versionId && schedule && !sameId(schedule.id, candidateSchedule.id)) {
      throw invalidSelection('The selected version does not belong to the selected schedule.')
    }
    // An explicit schedule handoff may intentionally open a different schedule
    // from the canonical master. The master remains unchanged.
    if (!schedule || sameId(schedule.id, candidateSchedule.id)) {
      schedule = candidateSchedule
      selectedVersion = candidate
    }
  }
  schedule ||= schedules[0]
  const versions = (await listPlanningRows(endpoints.scheduleVersions, { schedule: schedule.id }, { signal }))
    .filter(row => sameId(row.schedule, schedule.id) && row.is_deleted !== true).sort(newestVersion)
  if (selectedVersion && !versions.some(row => sameId(row.id, selectedVersion.id))) {
    throw invalidSelection('The selected schedule version changed or is no longer available. Refresh the schedule.')
  }
  const version = selectedVersion ? versions.find(row => sameId(row.id, selectedVersion.id))
    : versions.find(row => row.status !== 'superseded') || versions[0] || null
  return { linkedProject, schedule, version, projects, schedules, versions }
}

export default resolvePlanningSchedule
