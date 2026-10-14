import { useCallback, useMemo } from 'react'

const CLOSED = new Set(['closed', 'implemented', 'rejected'])
const PRIORITIES = ['critical', 'high', 'medium', 'low']
const STATUSES = ['open', 'in_review', 'approved', 'implemented', 'closed', 'rejected']
const TYPES = { risk: 'Risk', issue: 'Issue', change_request: 'Change request', action: 'Action', decision: 'Decision', document_change: 'Document finding' }
const sameId = (a, b) => a !== null && a !== undefined && b !== null && b !== undefined && String(a) === String(b)
const number = value => (typeof value === 'number' || typeof value === 'string') && String(value).trim() !== '' && Number.isFinite(Number(value)) ? Number(value) : null
const date = value => {
  const result = String(value || '').slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(result) && !Number.isNaN(Date.parse(`${result}T00:00:00Z`)) ? result : null
}
const label = value => String(value || '').replace(/[._]/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase())
const userName = user => user?.name || [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.email || null
const currency = value => typeof value === 'string' && /^[A-Z]{3}$/.test(value) ? value : null
const rating = value => Number.isInteger(number(value)) && number(value) >= 1 && number(value) <= 5 ? number(value) : null
const exposure = value => number(value) !== null && number(value) >= 0 ? number(value) : null
const impact = (value, assessed) => number(value) !== null && (number(value) !== 0 || assessed === true) ? number(value) : null

function assessmentFor(metadata) {
  const raw = metadata?.risk_control && typeof metadata.risk_control === 'object' ? metadata.risk_control : {}
  const inherentProbability = rating(raw.inherent_probability)
  const inherentImpact = rating(raw.inherent_impact)
  const residualProbability = rating(raw.residual_probability)
  const residualImpact = rating(raw.residual_impact)
  return {
    inherentProbability, inherentImpact, residualProbability, residualImpact,
    inherentCostExposure: exposure(raw.inherent_cost_exposure), residualCostExposure: exposure(raw.residual_cost_exposure),
    currency: currency(raw.currency), cause: raw.cause || null, event: raw.event || null, effect: raw.effect || null,
    responseStrategy: raw.response_strategy && raw.response_strategy !== 'unset' ? raw.response_strategy : null,
    inherentAssessed: inherentProbability !== null && inherentImpact !== null,
    residualAssessed: residualProbability !== null && residualImpact !== null,
    costImpactAssessed: raw.cost_impact_assessed === true, scheduleImpactAssessed: raw.schedule_impact_assessed === true,
  }
}

export function buildRiskChangeModel(project, documentChanges, scheduleModel = {}, scheduleData = null, options = {}) {
  const governance = scheduleData?.governance
  const workspace = scheduleData?.workspace
  const version = scheduleModel.version || scheduleData?.version || governance?.version
  const versionId = version?.id ?? null
  // A loaded empty planning listing is a genuine unconfigured source. A failed
  // source remains unavailable, including when the other source returned rows.
  const notConfigured = Array.isArray(scheduleData?.projects) && scheduleData.projects.length === 0
    || Array.isArray(scheduleData?.schedules) && scheduleData.schedules.length === 0
    || Array.isArray(scheduleData?.versions) && scheduleData.versions.length === 0
  const governanceAvailable = Array.isArray(governance?.items)
  const changesAvailable = Array.isArray(documentChanges)
  const countsComplete = (governanceAvailable || notConfigured) && changesAvailable
  const canManage = Boolean(governanceAvailable && governance.can_manage && versionId)
  const members = (governance?.members || []).map(user => ({ ...user, label: userName(user) || `User ${user.id}`, name: userName(user) }))
  const memberMap = new Map(members.map(user => [String(user.id), user.name]))
  const normalizedActivities = new Map((scheduleModel.activities || []).map(row => [String(row.id), row]))
  const activityOptions = (workspace?.activities || []).filter(row => !versionId || sameId(row.version, versionId)).map(activity => {
    const normalized = normalizedActivities.get(String(activity.id))
    return {
      id: activity.id, code: activity.external_id, name: activity.name,
      label: [activity.external_id, activity.name].filter(Boolean).join(' — '),
      targetDate: date(activity.planned_finish), baselineDate: scheduleModel.baselineApproved ? normalized?.baselineFinish || null : null,
      baselineApproved: Boolean(scheduleModel.baselineApproved && normalized?.baselineFinish),
      forecastDate: normalized?.forecastFinish || null, actualDate: normalized?.actualFinish || null,
      isCritical: Boolean(activity.is_critical), owner: normalized?.owner || null,
    }
  })
  const activityMap = new Map(activityOptions.map(row => [String(row.id), row]))
  const dataDate = date(scheduleModel.dataDate) || date(project?.custom_fields?.data_date)
  const today = date(options.today) || new Date().toISOString().slice(0, 10)
  const governanceRows = (governance?.items || []).filter(item => !versionId || sameId(item.version, versionId)).map(item => {
    const assessment = assessmentFor(item.metadata)
    const isOpen = !CLOSED.has(item.status)
    const row = {
      id: `governance:${item.id}`, source: 'governance', sourceId: item.id,
      sourceLabel: 'Schedule governance', code: `${item.item_type === 'risk' ? 'R' : item.item_type === 'issue' ? 'I' : item.item_type === 'change_request' ? 'CR' : item.item_type === 'action' ? 'A' : 'D'}-${item.id}`,
      type: item.item_type, typeLabel: TYPES[item.item_type] || label(item.item_type), title: item.title,
      description: item.description || '', status: item.status, statusLabel: label(item.status), priority: item.priority,
      owner: userName(item.owner), ownerId: item.owner?.id ?? null, dueDate: date(item.due_date),
      isOpen, isOverdue: isOpen && (typeof item.is_overdue === 'boolean' ? item.is_overdue : Boolean(date(item.due_date) && date(item.due_date) < today)),
      category: item.metadata?.risk_control?.category || null,
      scheduleImpactDays: impact(item.schedule_impact_days, assessment.scheduleImpactAssessed),
      costImpact: impact(item.cost_impact, assessment.costImpactAssessed), costCurrency: assessment.currency,
      assessment, riskScore: assessment.inherentAssessed ? assessment.inherentProbability * assessment.inherentImpact : null,
      residualScore: assessment.residualAssessed ? assessment.residualProbability * assessment.residualImpact : null,
      linkedActivity: activityMap.get(String(item.activity)) || null, activityId: item.activity ?? null,
      comments: Array.isArray(item.comments) ? item.comments.map(comment => ({
        id: comment.id, body: comment.body, author: userName(comment.author), authorId: comment.author?.id ?? null,
        date: comment.created_at, isResolved: Boolean(comment.is_resolved), parentId: comment.parent ?? null,
      })) : null,
      resolution: item.resolution || '', createdAt: item.created_at || null, updatedAt: item.updated_at || null,
      raisedBy: userName(item.raised_by), closedAt: item.closed_at || null,
      canEdit: canManage, canComment: Boolean(governanceAvailable && versionId), versionId,
      approvalNote: 'This is the recorded item status. Formal schedule-version reviews are separate.', raw: item,
    }
    return { ...row, tone: !isOpen ? 'success' : item.priority === 'critical' || row.isOverdue ? 'danger' : item.priority === 'high' ? 'warning' : 'blue' }
  })
  const documentRows = (documentChanges || []).filter(item => sameId(item.project, project?.id)).map(item => ({
    id: `document:${item.id}`, source: 'document', sourceId: item.id, sourceLabel: 'Document finding',
    code: `DOC-${item.id}`, type: 'document_change', typeLabel: TYPES.document_change,
    title: item.summary, description: item.description || '', status: item.status,
    statusLabel: item.status === 'reviewed' ? 'Under review' : label(item.status), priority: item.severity,
    owner: null, ownerId: null, dueDate: null, isOverdue: false,
    isOpen: !['accepted', 'rejected'].includes(item.status), category: null,
    scheduleImpactDays: null, costImpact: number(item.delta_amount), costCurrency: currency(item.delta_currency),
    assessment: assessmentFor(null), riskScore: null, residualScore: null,
    linkedActivity: null, activityId: null, comments: null, resolution: '',
    sourceDocumentId: item.source_document ?? null, reviewedById: item.reviewed_by ?? null,
    createdAt: item.detected_at || item.created_at || null, updatedAt: item.updated_at || null,
    canEdit: false, canComment: false, versionId: null,
    approvalNote: 'Document findings are separate from registered change requests and have no configured approval workflow.',
    tone: ['accepted', 'rejected'].includes(item.status) ? 'neutral' : item.severity === 'critical' ? 'danger' : item.severity === 'high' ? 'warning' : 'blue', raw: item,
  }))
  const rows = [...governanceRows, ...documentRows].sort((a, b) => Number(b.isOpen) - Number(a.isOpen) || PRIORITIES.indexOf(a.priority) - PRIORITIES.indexOf(b.priority) || String(a.dueDate || '9999').localeCompare(String(b.dueDate || '9999')))
  const risks = rows.filter(row => row.type === 'risk')
  const issueRows = rows.filter(row => row.type === 'issue')
  const changes = rows.filter(row => ['change_request', 'document_change'].includes(row.type))
  const actions = rows.filter(row => row.type === 'action')
  const openRisks = risks.filter(row => row.isOpen)
  const registeredChanges = changes.filter(row => row.source === 'governance')
  const counts = {
    total: rows.length, openRisks: openRisks.length,
    highRisks: openRisks.filter(row => ['critical', 'high'].includes(row.priority)).length,
    openIssues: issueRows.filter(row => row.isOpen).length,
    pendingChanges: changes.filter(row => row.source === 'governance' ? ['open', 'in_review'].includes(row.status) : ['detected', 'reviewed'].includes(row.status)).length,
    overdueActions: actions.filter(row => row.isOverdue).length,
  }
  const cellsFor = basis => Array.from({ length: 25 }, (_, index) => {
    const probability = Math.floor(index / 5) + 1
    const impact = index % 5 + 1
    const matches = openRisks.filter(row => row.assessment[`${basis}Probability`] === probability && row.assessment[`${basis}Impact`] === impact)
    return { probability, impact, count: matches.length, rowIds: matches.map(row => row.id) }
  })
  const heatmap = {
    inherent: cellsFor('inherent'), residual: cellsFor('residual'),
    assessed: openRisks.filter(row => row.assessment.inherentAssessed).length,
    unassessed: openRisks.filter(row => !row.assessment.inherentAssessed).length,
    residualAssessed: openRisks.filter(row => row.assessment.residualAssessed).length,
    residualUnassessed: openRisks.filter(row => !row.assessment.residualAssessed).length,
  }
  const exposureGroups = new Map()
  for (const row of openRisks) {
    const assessment = row.assessment
    if (!assessment.currency || assessment.inherentCostExposure === null && assessment.residualCostExposure === null) continue
    if (!exposureGroups.has(assessment.currency)) exposureGroups.set(assessment.currency, { currency: assessment.currency, inherent: null, residual: null, inherentCount: 0, residualCount: 0 })
    const group = exposureGroups.get(assessment.currency)
    for (const basis of ['inherent', 'residual']) if (assessment[`${basis}CostExposure`] !== null) {
      group[basis] = (group[basis] ?? 0) + assessment[`${basis}CostExposure`]
      group[`${basis}Count`] += 1
    }
  }
  const exposureByCurrency = [...exposureGroups.values()].sort((a, b) => a.currency.localeCompare(b.currency))
  const incompleteExposure = openRisks.filter(row => row.assessment.inherentCostExposure === null || row.assessment.residualCostExposure === null || !row.assessment.currency)
  const missingCurrency = rows.filter(row => row.costImpact !== null && !row.costCurrency || row.type === 'risk' && (row.assessment.inherentCostExposure !== null || row.assessment.residualCostExposure !== null) && !row.assessment.currency)
  const unassigned = governanceRows.filter(row => row.isOpen && !row.ownerId)
  const missingDates = governanceRows.filter(row => row.isOpen && !row.dueDate)
  const itemIds = new Set(governanceRows.map(row => String(row.sourceId)))
  const commentIds = new Set(governanceRows.flatMap(row => (row.comments || []).map(comment => String(comment.id))))
  const auditEvents = (governance?.audit_events || []).filter(event => event.entity_type === 'GovernanceItem' && itemIds.has(String(event.entity_id)) || event.entity_type === 'GovernanceComment' && commentIds.has(String(event.entity_id))).map(event => ({
    id: event.id, date: event.created_at, action: event.action, title: label(event.action),
    actor: memberMap.get(String(event.actor)) || null, actorId: event.actor ?? null,
    entityType: event.entity_type, entityId: event.entity_id, before: event.before, after: event.after,
  })).sort((a, b) => String(b.date).localeCompare(String(a.date)))
  const quality = [
    { id: 'register', label: 'Risk register', ready: governanceAvailable, status: governanceAvailable ? 'Connected' : notConfigured ? 'Not configured' : 'Unavailable', detail: 'The register is scoped to the current linked schedule version.' },
    { id: 'assessments', label: 'Risk assessments', ready: governanceAvailable && !heatmap.unassessed && !heatmap.residualUnassessed, status: !governanceAvailable ? 'Unavailable' : heatmap.unassessed || heatmap.residualUnassessed ? 'Incomplete' : 'Recorded', detail: `${heatmap.unassessed} open risks lack inherent ratings; ${heatmap.residualUnassessed} lack residual ratings. Ratings are user assessments on a 1–5 scale.` },
    { id: 'owners', label: 'Owners & due dates', ready: governanceAvailable && !unassigned.length && !missingDates.length, status: !governanceAvailable ? 'Unavailable' : unassigned.length || missingDates.length ? 'Review required' : 'Recorded', detail: `${unassigned.length} open governance items have no owner; ${missingDates.length} have no due date.` },
    { id: 'exposure', label: 'Cost exposure', ready: governanceAvailable && !incompleteExposure.length && !missingCurrency.length, status: !governanceAvailable ? 'Unavailable' : incompleteExposure.length || missingCurrency.length ? 'Incomplete' : 'Recorded', detail: `${incompleteExposure.length} open risks lack complete explicitly assessed exposure. Amounts are grouped by recorded currency; no probability-based exposure is inferred.` },
    { id: 'changes', label: 'Document findings', ready: changesAvailable, status: changesAvailable ? 'Available' : 'Unavailable', detail: 'Document findings retain their source status and are separate from registered change requests.' },
  ].map(row => ({ ...row, tone: row.ready ? 'success' : row.status === 'Unavailable' ? 'danger' : 'warning' }))
  const health = !project ? { label: 'Select a project', tone: 'neutral' }
    : !countsComplete ? { label: 'Data unavailable', tone: 'warning' }
      : counts.highRisks || issueRows.some(row => row.isOpen && ['critical', 'high'].includes(row.priority)) || counts.overdueActions ? { label: 'At risk', tone: 'danger' }
        : !governanceAvailable ? { label: 'Not configured', tone: 'neutral' }
          : quality.some(row => !row.ready) || counts.pendingChanges ? { label: 'Needs review', tone: 'warning' }
            : { label: 'Under control', tone: 'success' }
  return {
    rows, risks, issues: issueRows, changes, actions, counts, countsComplete, health,
    scopeLabel: versionId ? `Current linked schedule · ${version.label || `Version ${version.version ?? versionId}`}` : 'No linked schedule register',
    scopeNote: 'Governance records belong to the current linked schedule version. Document findings belong to this project. Other schedule versions are not included.',
    versionId, currentUserId: governance?.current_user_id ?? null, canCreate: canManage, canEdit: canManage, members, activityOptions,
    categories: [...new Set(rows.map(row => row.category).filter(Boolean))].sort(),
    owners: [...new Set(rows.map(row => row.owner).filter(Boolean))].sort(),
    dataDate, overdueAsOf: today, quality, auditEvents, auditNote: 'Matching events from the latest 40 project audit events; this is not the complete audit history.',
    reviews: governance?.reviews || [], heatmap, exposureByCurrency,
    exposureNote: 'Sum of explicitly recorded open-risk assessments, grouped by currency. Unassessed risks are excluded; this is not a probabilistic project forecast.',
    changePipeline: STATUSES.map(status => ({ status, label: label(status), count: registeredChanges.filter(row => row.status === status).length })),
    priorityDistribution: PRIORITIES.map(priority => ({ priority, label: label(priority), count: openRisks.filter(row => row.priority === priority).length })),
    availability: { governance: governanceAvailable, changes: changesAvailable, workspace: Boolean(workspace), notConfigured, audit: Array.isArray(governance?.audit_events) },
  }
}

export default function useRiskChangeControl(project, performance, schedulePerformance, options = {}) {
  const { enabled = true } = options
  const projectId = project?.id ?? null
  const projectMatches = sameId(performance?.projectId, projectId)
  const scheduleMatches = sameId(schedulePerformance?.projectId, projectId)
  const documentChanges = projectMatches && Array.isArray(performance?.rawData?.changes) ? performance.rawData.changes : null
  const scheduleModel = scheduleMatches ? schedulePerformance?.model : null
  const scheduleData = scheduleMatches ? schedulePerformance?.rawData : null
  const loading = Boolean(enabled && projectId && (!projectMatches || !scheduleMatches || performance?.loading || schedulePerformance?.loading))
  const issues = useMemo(() => {
    if (!enabled || !projectId || loading) return []
    const next = []
    if (documentChanges === null) next.push('Document change findings are unavailable. Retry to refresh this source.')
    const noRegister = Array.isArray(scheduleData?.projects) && scheduleData.projects.length === 0 || Array.isArray(scheduleData?.schedules) && scheduleData.schedules.length === 0 || Array.isArray(scheduleData?.versions) && scheduleData.versions.length === 0
    if (!noRegister && !Array.isArray(scheduleData?.governance?.items)) next.push('The linked schedule governance register is unavailable. Retry to refresh this source.')
    if (scheduleData?.version && !scheduleData?.workspace) next.push('Schedule activity links are unavailable. Governance records remain visible.')
    return next
  }, [enabled, projectId, loading, documentChanges, scheduleData])
  const projectReload = performance?.reload
  const scheduleReload = schedulePerformance?.reload
  const reload = useCallback(() => { projectReload?.(); scheduleReload?.() }, [projectReload, scheduleReload])
  const model = useMemo(() => buildRiskChangeModel(project, documentChanges, scheduleModel || {}, scheduleData), [project, documentChanges, scheduleModel, scheduleData])
  return { loading, issues, model, reload, loadedAt: scheduleMatches ? schedulePerformance?.loadedAt || null : null }
}
