import { normalizeProjectDocument } from './useDocumentControl'

const sameId = (a, b) => a !== null && a !== undefined && b !== null && b !== undefined && String(a) === String(b)
const text = value => typeof value === 'string' ? value.trim() : ''
const timestamp = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : null
const label = value => text(value).replace(/[._]/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase())
const newest = (a, b) => Date.parse(b.date || b.createdAt || '') - Date.parse(a.date || a.createdAt || '') || String(b.id).localeCompare(String(a.id))

export function buildProjectDetailsData(project, data = {}, risk = {}) {
  const documentsAvailable = Array.isArray(data.documents)
  const documentRows = (documentsAvailable ? data.documents : [])
    .filter(row => sameId(row.project, project?.id) && row.is_deleted !== true)
    .map(row => normalizeProjectDocument(row)).sort(newest)
  const countDocuments = predicate => documentsAvailable ? documentRows.filter(predicate).length : null
  const deliverables = {
    available: documentsAvailable, rows: documentRows,
    counts: {
      total: documentsAvailable ? documentRows.length : null,
      processed: countDocuments(row => row.parseStatus === 'done'),
      pending: countDocuments(row => ['pending', 'queued'].includes(row.parseStatus)),
      failed: countDocuments(row => row.parseStatus === 'failed'),
      approved: null, inReview: null,
    },
    source: 'Project document register',
    note: 'Uploaded project documents. Processing status is not engineering approval; approval, review and revision records are not stored in this register.',
  }

  const governance = data.governance?.governance
  const planningProjectId = data.governance?.projects?.[0]?.id
  const memberNames = new Map((risk.members || []).map(member => [String(member.id), member.name]))
  const sources = {
    commercial: Array.isArray(data.commercial?.recent_events),
    planning: Array.isArray(governance?.audit_events), documents: documentsAvailable,
  }
  const commercialEvents = (sources.commercial ? data.commercial.recent_events : []).map(event => ({
    id: `commercial:${event.id}`, date: timestamp(event.event_at),
    title: text(event.event_type_display) || label(event.event_type) || 'Commercial event',
    detail: text(event.source_reference), actor: text(event.actor) || null,
    source: 'Commercial audit', view: 'commercial-dashboard',
  }))
  const planningEvents = (sources.planning ? governance.audit_events : [])
    .filter(event => event.project == null || sameId(event.project, planningProjectId))
    .map(event => ({
      id: `planning:${event.id}`, date: timestamp(event.created_at),
      title: label(event.action) || 'Planning event',
      detail: text(event.after?.title) || text(event.after?.name) || text(event.before?.title) || text(event.before?.name),
      actor: memberNames.get(String(event.actor)) || null,
      source: 'Planning audit', view: /^(GovernanceItem|GovernanceComment)$/.test(event.entity_type) ? 'risk' : 'plan-baseline',
    }))
  const documentEvents = documentRows.map(row => ({
    id: `document:${row.id}`, date: row.createdAt, title: 'Document registered', detail: row.title,
    actor: row.uploadedBy, source: 'Document register', view: 'documents', documentId: row.id,
  }))
  const recentActivity = {
    available: Object.values(sources).some(Boolean), complete: Object.values(sources).every(Boolean), sources,
    rows: [...commercialEvents, ...planningEvents, ...documentEvents].filter(row => row.date).sort(newest),
    note: 'Recent commercial and planning audit records, plus document registration dates. Audit APIs return bounded recent history; this is not a complete project audit log.',
  }

  const riskAvailable = risk.availability?.governance === true
  const openRisks = riskAvailable ? (risk.risks || []).filter(row => row.isOpen) : []
  const assessed = openRisks.filter(row => typeof row.scheduleImpactDays === 'number' && Number.isFinite(row.scheduleImpactDays))
  const riskExposure = {
    available: riskAvailable,
    costByCurrency: riskAvailable ? risk.exposureByCurrency || [] : [],
    schedule: {
      maxDays: assessed.length ? Math.max(...assessed.map(row => row.scheduleImpactDays)) : null,
      assessedCount: riskAvailable ? assessed.length : null,
      openRiskCount: riskAvailable ? openRisks.length : null,
      complete: riskAvailable && assessed.length === openRisks.length,
    },
    note: 'Open risks from the current linked schedule register. Cost exposure uses recorded assessments grouped by currency. Schedule impact is the largest individual recorded impact, not a summed project delay or forecast.',
  }
  return { deliverables, recentActivity, riskExposure }
}
