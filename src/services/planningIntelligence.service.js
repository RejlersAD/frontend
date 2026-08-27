import apiClient, { apiClientLongTimeout } from './api.service'
import { PLANNING_ENDPOINTS } from '../config/planningIntelligence.config'

const unwrapList = (response) => response.data?.results ?? response.data ?? []
const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))
const awaitJob = async (initialJob, timeoutMs = 15 * 60 * 1000) => {
  let job = initialJob
  const started = Date.now()
  while (!['succeeded', 'failed', 'cancelled'].includes(job.status)) {
    if (Date.now() - started > timeoutMs) throw new Error(`Background job ${job.id} is still running. Its progress is saved and can be resumed.`)
    await wait(1500)
    job = (await apiClient.get(PLANNING_ENDPOINTS.job(job.id))).data
  }
  if (job.status !== 'succeeded') throw new Error(job.error_message || job.message || `Background job ${job.id} failed.`)
  return job
}

export const planningIntelligenceService = {
  listProjects: async () => unwrapList(await apiClient.get(PLANNING_ENDPOINTS.projects)),
  getProject: async (projectId) => (await apiClient.get(PLANNING_ENDPOINTS.project(projectId))).data,
  listFiles: async (projectId) => unwrapList(await apiClient.get(PLANNING_ENDPOINTS.files, { params: { project: projectId } })),
  listGenerations: async (projectId) => unwrapList(await apiClient.get(PLANNING_ENDPOINTS.generations, { params: { project: projectId } })),
  getGeneration: async (generationId) => (await apiClient.get(PLANNING_ENDPOINTS.generation(generationId))).data,
  startAnalysis: async (projectId) => (await apiClient.post(PLANNING_ENDPOINTS.analyze(projectId))).data,
  startGeneration: async (projectId, payload = {}) => (await apiClient.post(PLANNING_ENDPOINTS.generate(projectId), payload)).data,
  previewGeneration: async (projectId, payload = {}) => {
    const job = (await apiClient.post(PLANNING_ENDPOINTS.generationPreview(projectId), payload)).data
    const completed = await awaitJob(job)
    return completed.result_data?.preview
  },
  listWorkflowTemplates: async projectId => unwrapList(await apiClient.get(
    PLANNING_ENDPOINTS.workflowTemplates, { params: { project: projectId } },
  )),
  listDependencyTemplates: async projectId => unwrapList(await apiClient.get(
    PLANNING_ENDPOINTS.dependencyTemplates, { params: { project: projectId } },
  )),
  listScheduleConfigurations: async projectId => unwrapList(await apiClient.get(
    PLANNING_ENDPOINTS.scheduleConfigurations, { params: { project: projectId } },
  )),
  updateScheduleConfiguration: async (id, payload) => (
    await apiClient.patch(PLANNING_ENDPOINTS.scheduleConfiguration(id), payload)
  ).data,
  listScheduleDefaultProposals: async projectId => unwrapList(await apiClient.get(
    PLANNING_ENDPOINTS.scheduleDefaultProposals, { params: { project: projectId } },
  )),
  createScheduleDefaultProposal: async payload => (
    await apiClient.post(PLANNING_ENDPOINTS.scheduleDefaultProposals, payload)
  ).data,
  decideScheduleDefaultProposal: async (id, decision, comment = '') => (
    await apiClient.post(PLANNING_ENDPOINTS.scheduleDefaultProposalDecision(id), { decision, comment })
  ).data,
  getJob: async (jobId) => (await apiClient.get(PLANNING_ENDPOINTS.job(jobId))).data,
  listJobs: async projectId => unwrapList(await apiClient.get(
    PLANNING_ENDPOINTS.jobs, { params: projectId ? { project: projectId } : {} },
  )),
  cancelJob: async (jobId) => (await apiClient.post(PLANNING_ENDPOINTS.cancelJob(jobId))).data,
  listAuditEvents: async (projectId) => unwrapList(await apiClient.get(PLANNING_ENDPOINTS.auditEvents, { params: { project: projectId } })),
  buildWorkablePlan: async (projectId, decisions = null) => (
    await apiClient.post(PLANNING_ENDPOINTS.buildWorkablePlan(projectId), decisions ? { decisions } : {})
  ).data,
  getWorkablePlanStatus: async projectId => (
    await apiClient.get(PLANNING_ENDPOINTS.workablePlanStatus(projectId))
  ).data,
  approveWorkableBaseline: async (projectId, scheduleVersionId, name = '') => (
    await apiClient.post(PLANNING_ENDPOINTS.approveWorkableBaseline(projectId), {
      schedule_version_id: scheduleVersionId, ...(name ? { name } : {}),
    })
  ).data,
  materializeGeneration: async (generationId) => (await apiClient.post(PLANNING_ENDPOINTS.materializeGeneration(generationId))).data,
  listCalendars: async (projectId) => unwrapList(await apiClient.get(PLANNING_ENDPOINTS.calendars, { params: { project: projectId } })),
  listSchedules: async (projectId) => unwrapList(await apiClient.get(PLANNING_ENDPOINTS.schedules, { params: { project: projectId } })),
  getSchedule: async (scheduleId) => (await apiClient.get(PLANNING_ENDPOINTS.schedule(scheduleId))).data,
  listScheduleVersions: async (scheduleId) => unwrapList(await apiClient.get(PLANNING_ENDPOINTS.scheduleVersions, { params: { schedule: scheduleId } })),
  getScheduleVersion: async (versionId) => (await apiClient.get(PLANNING_ENDPOINTS.scheduleVersion(versionId))).data,
  getScheduleWorkspace: async (versionId) => (await apiClient.get(PLANNING_ENDPOINTS.scheduleWorkspace(versionId))).data,
  bulkUpdateActivities: async (versionId, expectedUpdatedAt, activities) => (
    await apiClient.patch(PLANNING_ENDPOINTS.bulkScheduleActivities(versionId), {
      expected_updated_at: expectedUpdatedAt,
      activities,
    })
  ).data,
  createScheduleVersion: async (scheduleId, changeSummary = '') => (
    await apiClientLongTimeout.post(
      PLANNING_ENDPOINTS.createScheduleVersion(scheduleId), { change_summary: changeSummary },
    )
  ).data,
  calculateScheduleVersion: async (versionId) => (
    await apiClient.post(PLANNING_ENDPOINTS.calculateScheduleVersion(versionId))
  ).data,
  rebuildScheduleLogic: async (versionId) => (
    await apiClientLongTimeout.post(PLANNING_ENDPOINTS.rebuildScheduleLogic(versionId))
  ).data,
  approveScheduleVersion: async (versionId) => (await apiClient.post(PLANNING_ENDPOINTS.approveScheduleVersion(versionId))).data,
  runScheduleAssurance: async versionId => (
    await apiClient.post(PLANNING_ENDPOINTS.runScheduleAssurance(versionId))
  ).data,
  approveScheduleAssurance: async versionId => (
    await apiClient.post(PLANNING_ENDPOINTS.approveScheduleAssurance(versionId))
  ).data,
  baselineScheduleVersion: async (versionId, name) => (
    await apiClient.post(PLANNING_ENDPOINTS.baselineScheduleVersion(versionId), { name })
  ).data,
  getScheduleControls: async (versionId, dataDate) => (
    await apiClient.get(PLANNING_ENDPOINTS.scheduleControls(versionId), {
      params: dataDate ? { data_date: dataDate } : {},
    })
  ).data,
  updateScheduleProgress: async (versionId, dataDate, updates) => (
    await apiClient.post(PLANNING_ENDPOINTS.scheduleProgress(versionId), { data_date: dataDate, updates })
  ).data,
  captureScheduleControls: async (versionId, dataDate) => (
    await apiClient.post(PLANNING_ENDPOINTS.captureScheduleControls(versionId), { data_date: dataDate })
  ).data,
  listDailyFieldUpdates: async (versionId, params = {}) => unwrapList(await apiClient.get(
    PLANNING_ENDPOINTS.dailyFieldUpdates, { params: { version: versionId, ...params } },
  )),
  createDailyFieldUpdate: async payload => {
    const form = new FormData()
    Object.entries(payload).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') form.append(key, value)
    })
    return (await apiClient.post(PLANNING_ENDPOINTS.dailyFieldUpdates, form)).data
  },
  updateDailyFieldUpdate: async (id, payload) => {
    const form = new FormData()
    Object.entries(payload).forEach(([key, value]) => {
      if (key === 'evidence' && !value) return
      if (value !== null && value !== undefined) form.append(key, value)
    })
    return (await apiClient.patch(PLANNING_ENDPOINTS.dailyFieldUpdate(id), form)).data
  },
  submitDailyFieldUpdate: async id => (
    await apiClient.post(PLANNING_ENDPOINTS.submitDailyFieldUpdate(id))
  ).data,
  approveDailyFieldUpdate: async (id, comment = '') => (
    await apiClient.post(PLANNING_ENDPOINTS.approveDailyFieldUpdate(id), { comment })
  ).data,
  rejectDailyFieldUpdate: async (id, comment) => (
    await apiClient.post(PLANNING_ENDPOINTS.rejectDailyFieldUpdate(id), { comment })
  ).data,
  deleteDailyFieldUpdate: async id => apiClient.delete(PLANNING_ENDPOINTS.dailyFieldUpdate(id)),
  getScheduleGovernance: async (versionId) => (await apiClient.get(PLANNING_ENDPOINTS.scheduleGovernance(versionId))).data,
  createGovernanceItem: async (versionId, payload) => (
    await apiClient.post(PLANNING_ENDPOINTS.governanceItems(versionId), payload)
  ).data,
  updateGovernanceItem: async (versionId, payload) => (
    await apiClient.patch(PLANNING_ENDPOINTS.governanceItem(versionId), payload)
  ).data,
  addGovernanceComment: async (versionId, payload) => (
    await apiClient.post(PLANNING_ENDPOINTS.governanceComments(versionId), payload)
  ).data,
  resolveGovernanceComment: async (versionId, commentId, isResolved = true) => (
    await apiClient.post(PLANNING_ENDPOINTS.resolveGovernanceComment(versionId), {
      comment_id: commentId, is_resolved: isResolved,
    })
  ).data,
  createScheduleReview: async (versionId, payload) => (
    await apiClient.post(PLANNING_ENDPOINTS.scheduleReviews(versionId), payload)
  ).data,
  decideScheduleReview: async (versionId, payload) => (
    await apiClient.post(PLANNING_ENDPOINTS.scheduleReviewDecision(versionId), payload)
  ).data,
  downloadScheduleExport: async (versionId, format) => (
    await apiClient.get(PLANNING_ENDPOINTS.exportScheduleVersion(versionId, format), { responseType: 'blob' })
  ),
  listIntegrationEndpoints: async (projectId) => unwrapList(await apiClient.get(
    PLANNING_ENDPOINTS.integrationEndpoints, { params: { project: projectId } },
  )),
  createIntegrationEndpoint: async payload => (
    await apiClient.post(PLANNING_ENDPOINTS.integrationEndpoints, payload)
  ).data,
  updateIntegrationEndpoint: async (id, payload) => (
    await apiClient.patch(PLANNING_ENDPOINTS.integrationEndpoint(id), payload)
  ).data,
  deleteIntegrationEndpoint: async id => apiClient.delete(PLANNING_ENDPOINTS.integrationEndpoint(id)),
  publishIntegration: async (id, payload) => (
    await apiClient.post(PLANNING_ENDPOINTS.publishIntegration(id), payload)
  ).data,
  listIntegrationDeliveries: async projectId => unwrapList(await apiClient.get(
    PLANNING_ENDPOINTS.integrationDeliveries, { params: { project: projectId } },
  )),
  retryIntegrationDelivery: async id => (
    await apiClient.post(PLANNING_ENDPOINTS.retryIntegrationDelivery(id))
  ).data,
  listScheduleExportRecords: async projectId => unwrapList(await apiClient.get(
    PLANNING_ENDPOINTS.scheduleExportRecords, { params: { project: projectId } },
  )),
  listTechnicalProposals: async projectId => unwrapList(await apiClient.get(
    PLANNING_ENDPOINTS.technicalProposals, { params: { project: projectId } },
  )),
  createTechnicalProposal: async payload => (
    await apiClient.post(PLANNING_ENDPOINTS.technicalProposals, payload)
  ).data,
  updateTechnicalProposal: async (id, payload) => (
    await apiClient.patch(PLANNING_ENDPOINTS.technicalProposal(id), payload)
  ).data,
  transitionTechnicalProposal: async (id, status) => (
    await apiClient.post(PLANNING_ENDPOINTS.proposalTransition(id), { status })
  ).data,
  refreshTechnicalProposal: async id => (
    await apiClient.post(PLANNING_ENDPOINTS.proposalRefresh(id))
  ).data,
  downloadTechnicalProposal: async (id, format) => (
    await apiClient.get(PLANNING_ENDPOINTS.proposalExport(id, format), { responseType: 'blob' })
  ),
  listProposalExportRecords: async proposalId => unwrapList(await apiClient.get(
    PLANNING_ENDPOINTS.proposalExportRecords, { params: { proposal: proposalId } },
  )),
  getEnterprisePortfolio: async () => (await apiClient.get(PLANNING_ENDPOINTS.enterprisePortfolio)).data,
  getEnterpriseReadiness: async projectId => (
    await apiClient.get(PLANNING_ENDPOINTS.enterpriseReadiness, { params: { project: projectId } })
  ).data,
  getRetentionPolicy: async projectId => (
    await apiClient.get(PLANNING_ENDPOINTS.enterpriseRetention, { params: { project: projectId } })
  ).data,
  updateRetentionPolicy: async (projectId, payload) => (
    await apiClient.put(PLANNING_ENDPOINTS.enterpriseRetention, payload, { params: { project: projectId } })
  ).data,
  previewRetentionCleanup: async projectId => (
    await apiClient.post(PLANNING_ENDPOINTS.enterpriseRetentionCleanup, { project: projectId, execute: false })
  ).data,
  executeRetentionCleanup: async (projectId, confirmation) => (
    await apiClient.post(PLANNING_ENDPOINTS.enterpriseRetentionCleanup, {
      project: projectId, execute: true, confirmation,
    })
  ).data,
  listWbsNodes: async (versionId) => unwrapList(await apiClient.get(PLANNING_ENDPOINTS.wbsNodes, { params: { version: versionId } })),
  createWbsNode: async (payload) => (await apiClient.post(PLANNING_ENDPOINTS.wbsNodes, payload)).data,
  updateWbsNode: async (id, payload) => (await apiClient.patch(PLANNING_ENDPOINTS.wbsNode(id), payload)).data,
  deleteWbsNode: async (id) => apiClient.delete(PLANNING_ENDPOINTS.wbsNode(id)),
  listActivities: async (versionId) => unwrapList(await apiClient.get(PLANNING_ENDPOINTS.activities, { params: { version: versionId } })),
  createActivity: async (payload) => (await apiClient.post(PLANNING_ENDPOINTS.activities, payload)).data,
  updateActivity: async (id, payload) => (await apiClient.patch(PLANNING_ENDPOINTS.activity(id), payload)).data,
  deleteActivity: async (id) => apiClient.delete(PLANNING_ENDPOINTS.activity(id)),
  listRelationships: async (versionId) => unwrapList(await apiClient.get(PLANNING_ENDPOINTS.relationships, { params: { version: versionId } })),
  createRelationship: async (payload) => (await apiClient.post(PLANNING_ENDPOINTS.relationships, payload)).data,
  deleteRelationship: async (id) => apiClient.delete(PLANNING_ENDPOINTS.relationship(id)),
  listResources: async (projectId) => unwrapList(await apiClient.get(PLANNING_ENDPOINTS.resources, { params: { project: projectId } })),
  createResource: async (payload) => (await apiClient.post(PLANNING_ENDPOINTS.resources, payload)).data,
  updateResource: async (id, payload) => (await apiClient.patch(PLANNING_ENDPOINTS.resource(id), payload)).data,
  createAssignment: async (payload) => (await apiClient.post(PLANNING_ENDPOINTS.assignments, payload)).data,
  deleteAssignment: async (id) => apiClient.delete(PLANNING_ENDPOINTS.assignment(id)),
  listBaselines: async (scheduleId) => unwrapList(await apiClient.get(PLANNING_ENDPOINTS.baselines, { params: { schedule: scheduleId } })),
  listCalculationRuns: async (versionId) => unwrapList(await apiClient.get(PLANNING_ENDPOINTS.calculationRuns, { params: { version: versionId } })),
  listDocumentProfiles: async (projectId) => unwrapList(await apiClient.get(PLANNING_ENDPOINTS.documentProfiles, { params: { project: projectId } })),
  listIntelligenceRuns: async (projectId) => unwrapList(await apiClient.get(PLANNING_ENDPOINTS.intelligenceRuns, { params: { project: projectId } })),
  getIntelligenceRun: async (runId) => (await apiClient.get(PLANNING_ENDPOINTS.intelligenceRun(runId))).data,
  listIntelligenceFacts: async (runId, params = {}) => unwrapList(await apiClient.get(PLANNING_ENDPOINTS.intelligenceFacts, { params: { run: runId, ...params } })),
  reviewIntelligenceFact: async (factId, status) => (await apiClient.post(PLANNING_ENDPOINTS.reviewIntelligenceFact(factId), { status })).data,
  addIntelligenceFact: async (runId, fact) => (await apiClient.post(PLANNING_ENDPOINTS.addIntelligenceFact(runId), fact)).data,
  listIntelligenceConflicts: async (runId, params = {}) => unwrapList(await apiClient.get(PLANNING_ENDPOINTS.intelligenceConflicts, { params: { run: runId, ...params } })),
  resolveIntelligenceConflict: async (conflictId, resolution) => (
    await apiClient.post(PLANNING_ENDPOINTS.resolveIntelligenceConflict(conflictId), resolution)
  ).data,
  listDocumentAuthorityRules: async () => unwrapList(await apiClient.get(PLANNING_ENDPOINTS.documentAuthorityRules)),
  listScheduleBases: async projectId => unwrapList(await apiClient.get(
    PLANNING_ENDPOINTS.scheduleBases, { params: { project: projectId } },
  )),
  buildScheduleBasis: async runId => (
    await apiClient.post(PLANNING_ENDPOINTS.buildScheduleBasis(runId))
  ).data,
  updateScheduleBasis: async (basisId, payload) => (
    await apiClient.patch(PLANNING_ENDPOINTS.scheduleBasis(basisId), payload)
  ).data,
  approveScheduleBasis: async basisId => (
    await apiClient.post(PLANNING_ENDPOINTS.approveScheduleBasis(basisId))
  ).data,
  reviewBasisDeliverables: async (basisId, status, deliverableIds) => (
    await apiClient.post(PLANNING_ENDPOINTS.reviewBasisDeliverables(basisId), {
      status, ...(deliverableIds?.length ? { deliverable_ids: deliverableIds } : {}),
    })
  ).data,
  reviewBasisDeliverable: async (deliverableId, status) => (
    await apiClient.post(PLANNING_ENDPOINTS.reviewBasisDeliverable(deliverableId), { status })
  ).data,
  listGenerationPlans: async projectId => unwrapList(await apiClient.get(
    PLANNING_ENDPOINTS.generationPlans, { params: { project: projectId } },
  )),
  buildGenerationPlan: async basisId => (
    await apiClient.post(PLANNING_ENDPOINTS.buildGenerationPlan(basisId))
  ).data,
  updateGenerationPlan: async (id, payload) => (
    await apiClient.patch(PLANNING_ENDPOINTS.generationPlan(id), payload)
  ).data,
  approveGenerationPlan: async id => (
    await apiClient.post(PLANNING_ENDPOINTS.approveGenerationPlan(id))
  ).data,
  reviewGenerationDependencies: async (id, status, dependencyIds) => (
    await apiClient.post(PLANNING_ENDPOINTS.reviewGenerationDependencies(id), {
      status, ...(dependencyIds?.length ? { dependency_ids: dependencyIds } : {}),
    })
  ).data,
  addGenerationDependency: async (id, payload) => (
    await apiClient.post(PLANNING_ENDPOINTS.addGenerationDependency(id), payload)
  ).data,
  updatePlanDeliverable: async (id, payload) => (
    await apiClient.patch(PLANNING_ENDPOINTS.planDeliverable(id), payload)
  ).data,
  updateGenerationDependency: async (id, payload) => (
    await apiClient.patch(PLANNING_ENDPOINTS.generationDependency(id), payload)
  ).data,
}

export default planningIntelligenceService
