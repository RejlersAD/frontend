import { useCallback, useEffect, useMemo, useState } from 'react'
import apiClient from '../../services/api.service'
import { PROJECT_CONTROL_ENDPOINTS as endpoints } from '../../config/projectControl.config'

const number = value => (typeof value === 'number' || typeof value === 'string') && String(value).trim() !== '' && Number.isFinite(Number(value)) ? Number(value) : null
const round = value => value === null ? null : Math.round(value * 100) / 100
const date = value => {
  const day = String(value || '').slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(day) && !Number.isNaN(Date.parse(`${day}T00:00:00Z`)) ? day : null
}
const rowsOf = value => Array.isArray(value) ? value : Array.isArray(value?.results) ? value.results : []
const currencyOf = value => typeof value === 'string' && value.trim() ? value.trim().toUpperCase() : null
const labelOf = value => String(value || '').replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase())
const emptyData = () => ({ budgets: null, ledger: null, periods: null })

async function allPages(endpoint, params, signal) {
  const result = []
  for (let page = 1; page <= 100; page += 1) {
    const response = await apiClient.get(endpoint, { params: { ...params, page }, signal })
    result.push(...rowsOf(response.data))
    if (!response.data?.next) return result
  }
  throw new Error('This register exceeds the supported page limit.')
}

const messageFor = (label, error) => [401, 403].includes(error?.response?.status)
  ? `${label} is unavailable for this account.`
  : `${label} could not be loaded. Retry to refresh this information.`

function latestSealedPeriods(snapshots) {
  const result = new Map()
  for (const row of snapshots || []) {
    if (!date(row.data_date) || !date(row.sealed_at)) continue
    const key = String(row.reporting_period ?? row.data_date)
    const previous = result.get(key)
    if (!previous || Number(row.version || 0) > Number(previous.version || 0) || (Number(row.version || 0) === Number(previous.version || 0) && String(row.sealed_at) > String(previous.sealed_at))) result.set(key, row)
  }
  return [...result.values()].sort((a, b) => String(a.data_date).localeCompare(String(b.data_date)) || String(a.sealed_at).localeCompare(String(b.sealed_at)))
}

export function buildCommercialModel(project, sharedData, data, issues = []) {
  const commercial = sharedData?.commercial || null
  const kpis = sharedData?.kpis || null
  const snapshots = Array.isArray(sharedData?.snapshots) ? sharedData.snapshots : null
  const currency = currencyOf(project?.currency) || currencyOf(commercial?.currency) || currencyOf(kpis?.currency) || 'AED'
  const summaryCurrency = currencyOf(commercial?.currency) || currency
  const contractCurrency = summaryCurrency
  // Preserve the six existing commercial dashboard facts. A failed summary is
  // not replaced with zeros or an unrelated reporting-period forecast.
  const contractValue = number(commercial?.contract_value)
  const controlBudget = number(commercial?.budget)
  const committed = number(commercial?.committed)
  const actual = number(commercial?.actual)
  const paid = number(commercial?.paid)
  const unpaid = number(commercial?.unpaid_actual)
  const remaining = number(commercial?.remaining_budget)
  const outstandingCommitment = number(commercial?.outstanding_commitment)
  const invoiceScheduledAmount = number(commercial?.scheduled_payments)
  const budgets = data.budgets?.map(row => ({
    id: row.id, code: row.code, name: row.name, wbsId: row.wbs_node, wbsCode: row.wbs_code || null,
    wbsName: row.wbs_name || null, category: row.category || null, amount: number(row.amount),
    currency: currencyOf(row.currency), currencyMatches: currencyOf(row.currency) === currency,
    status: row.status, statusLabel: labelOf(row.status), approvedAt: row.approved_at || null,
    approvedBy: row.approved_by_name || null, approved: row.status === 'approved' && Boolean(date(row.approved_at)),
    notes: row.notes || '',
  })) ?? null
  const approvedBudgets = budgets?.filter(row => row.approved) ?? null
  const draftBudgets = budgets?.filter(row => row.status === 'draft') ?? null
  const ledger = data.ledger?.filter(row => row.status === 'posted').map(row => ({
    id: row.id, date: date(row.entry_date), type: row.entry_type, typeLabel: labelOf(row.entry_type),
    amount: number(row.amount), currency: currencyOf(row.currency), currencyMatches: currencyOf(row.currency) === currency,
    reference: row.source_reference || row.entry_key || null, sourceType: row.source_type || null,
    wbsId: row.wbs_node || null, wbsCode: row.wbs_code || 'UNALLOCATED', wbsName: row.wbs_name || 'Unallocated',
    status: row.status, periodId: row.reporting_period || null, controlAccountId: row.control_account || null,
    budgetAllocationId: row.budget_allocation || null,
  })).sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))) ?? null
  const periods = data.periods?.map(row => ({
    id: row.id, name: row.name, sequence: row.sequence, dataDate: date(row.data_date),
    startDate: date(row.start_date), endDate: date(row.end_date), status: row.status,
    statusLabel: row.status_display || labelOf(row.status), lockedAt: row.locked_at || null,
    lockedBy: row.locked_by_name || null, notes: row.notes || '',
  })).sort((a, b) => String(b.dataDate || '').localeCompare(String(a.dataDate || '')) || Number(b.sequence) - Number(a.sequence)) ?? null
  const periodMap = new Map((periods || []).map(row => [String(row.id), row]))
  const sealedPeriods = latestSealedPeriods(snapshots)
  const excludedSnapshots = sealedPeriods.filter(row => currencyOf(row.currency) !== currency)
  const chartPoints = snapshots === null ? null : sealedPeriods.filter(row => currencyOf(row.currency) === currency).map(row => ({
    id: row.id, date: date(row.data_date), pv: number(row.planned_value), ev: number(row.earned_value),
    ac: row.actual_cost_basis === 'legacy_period' ? null : number(row.actual_cost), bac: number(row.budget_at_completion), currency: currencyOf(row.currency),
    cpi: row.actual_cost_basis === 'legacy_period' ? null : number(row.cpi), eac: row.actual_cost_basis === 'legacy_period' ? null : number(row.estimate_at_completion), costVariance: row.actual_cost_basis === 'legacy_period' ? null : number(row.cost_variance),
    varianceAtCompletion: row.actual_cost_basis === 'legacy_period' ? null : number(row.variance_at_completion), commitments: number(row.commitments),
    legacyCostBasis: row.actual_cost_basis === 'legacy_period', recordedActual: number(row.actual_cost), actualCostBasis: row.actual_cost_basis || null,
    periodId: row.reporting_period, periodName: periodMap.get(String(row.reporting_period))?.name || null,
    version: row.version, sealedAt: row.sealed_at,
  })).filter(row => [row.pv, row.ev, row.ac, row.bac].some(value => value !== null))
  const latestSnapshot = [...sealedPeriods].reverse().find(row => currencyOf(row.currency) === currency) || null
  const dataDate = date(latestSnapshot?.data_date)
  const legacyCostBasis = latestSnapshot?.actual_cost_basis === 'legacy_period'
  const legacyPeriods = (chartPoints || []).filter(row => row.legacyCostBasis)
  const cpi = legacyCostBasis ? null : number(latestSnapshot?.cpi)
  const eac = legacyCostBasis ? null : number(latestSnapshot?.estimate_at_completion)
  const costVariance = legacyCostBasis ? null : number(latestSnapshot?.cost_variance)
  const varianceAtCompletion = legacyCostBasis ? null : number(latestSnapshot?.variance_at_completion)
  const historicalBudget = number(latestSnapshot?.budget_at_completion)
  const latestActual = number(latestSnapshot?.actual_cost)
  const sameCurrencyLedger = (ledger || []).filter(row => row.currencyMatches)
  const foreignLedger = (ledger || []).filter(row => !row.currencyMatches)
  const foreignBudgets = (budgets || []).filter(row => !row.currencyMatches)
  const invalidLedger = sameCurrencyLedger.filter(row => row.amount === null)
  const wbsMap = new Map()
  for (const row of sameCurrencyLedger) {
    if (!['budget', 'commitment', 'actual', 'adjustment'].includes(row.type)) continue
    const key = String(row.wbsId || row.wbsCode)
    if (!wbsMap.has(key)) wbsMap.set(key, { id: key, code: row.wbsCode, name: row.wbsName, currency, budget: 0, committed: 0, actual: 0, ledgerCount: 0, invalid: false })
    const group = wbsMap.get(key)
    const field = row.type === 'budget' ? 'budget' : row.type === 'commitment' ? 'committed' : 'actual'
    group.ledgerCount += 1
    if (row.amount === null) group.invalid = true
    else group[field] += row.amount
  }
  // The legacy WBS summary combines currencies and omits adjustment entries.
  // The detailed posted ledger permits a consistent single-currency position.
  const wbs = ledger === null ? null : [...wbsMap.values()].map(row => {
    const budget = row.invalid ? null : round(row.budget)
    const actual = row.invalid ? null : round(row.actual)
    const committed = row.invalid ? null : round(row.committed)
    const remaining = budget !== null && actual !== null ? round(budget - actual) : null
    const availableToCommit = budget !== null && committed !== null ? round(budget - committed) : null
    const utilization = budget > 0 && actual !== null ? round(actual / budget * 100) : null
    return { ...row, budget, committed, actual, remaining, availableToCommit, utilization,
      tone: remaining !== null && remaining < 0 ? 'danger' : availableToCommit !== null && availableToCommit < 0 || budget === 0 && actual > 0 ? 'warning' : 'neutral',
    }
  }).sort((a, b) => String(a.code).localeCompare(String(b.code)))
  const auditEvents = Array.isArray(commercial?.recent_events) ? commercial.recent_events.map(row => ({
    id: row.id, date: row.event_at || null, eventType: row.event_type, eventTypeLabel: row.event_type_display || labelOf(row.event_type),
    reference: row.source_reference || null, sourceType: row.source_type || null, actor: row.actor || 'System',
    amount: number(row.amount), currency: currencyOf(row.currency), processingError: row.processing_error || null,
    ledgerRebuilt: Boolean(row.ledger_rebuilt),
  })).sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))) : null
  const counts = commercial?.counts ? {
    approvedPurchaseOrders: number(commercial.counts.approved_purchase_orders), acceptedReceipts: number(commercial.counts.accepted_receipts),
    verifiedInvoices: number(commercial.counts.verified_invoices), payments: number(commercial.counts.payments),
    purchaseOrders: number(commercial.counts.purchase_orders), receipts: number(commercial.counts.receipts),
  } : null
  const currencyMismatch = summaryCurrency !== currency || foreignLedger.length > 0 || foreignBudgets.length > 0 || excludedSnapshots.length > 0
  const summariesUnsafe = summaryCurrency !== currency || foreignLedger.length > 0
  const failedEvents = (auditEvents || []).filter(row => row.processingError)
  const unallocated = sameCurrencyLedger.filter(row => row.wbsCode === 'UNALLOCATED' && ['actual', 'adjustment', 'commitment'].includes(row.type))
  const unlockedPeriods = (periods || []).filter(row => row.status !== 'locked')
  const unassignedPeriodEntries = sameCurrencyLedger.filter(row => !row.periodId && ['actual', 'adjustment'].includes(row.type))
  const incompleteApprovals = (budgets || []).filter(row => row.status === 'approved' && !row.approved)
  const exceptions = []
  const add = (id, priority, title, detail, view = 'controls', button = 'Review') => exceptions.push({ id, priority, title, detail, owner: null, dueDate: null, view, button })
  if (issues.length) add('data-unavailable', 'high', 'Review unavailable commercial data', issues.join(' '), 'quality')
  if (legacyPeriods.length) add('legacy-cost-basis', 'high', 'Review legacy reporting cost basis', `${legacyPeriods.length} reporting periods use period-only actual cost. Their cumulative actual cost and derived cost performance are unavailable; historical records remain unchanged.`, 'quality')
  if (currencyMismatch) add('currency-mismatch', 'high', 'Review currency differences', `${foreignLedger.length} ledger entries, ${foreignBudgets.length} budget allocations and ${excludedSnapshots.length} reporting periods do not match ${currency}. Chart and WBS totals exclude them.`, 'quality')
  if (invalidLedger.length) add('ledger-values', 'high', 'Review incomplete ledger values', `${invalidLedger.length} posted entries have no usable amount. Affected WBS totals are unavailable.`, 'quality')
  if (!summariesUnsafe && controlBudget !== null && actual !== null && actual > controlBudget) add('budget-overrun', 'critical', 'Review the cost overrun', 'Verified actual cost exceeds the current control budget.')
  if (!summariesUnsafe && controlBudget !== null && committed !== null && committed > controlBudget) add('commitments-over-budget', 'high', 'Review commitments above budget', 'Posted commitments exceed the current control budget. Commitments are not added to actual cost.')
  if (!summariesUnsafe && controlBudget !== null && contractValue !== null && controlBudget > contractValue) add('contract-budget-review', 'high', 'Review contract and control budget', 'Control budget exceeds the recorded contract value. Review approved scope and allowances.')
  if (commercial && !(controlBudget > 0)) add('budget-missing', 'high', 'Establish the control budget', 'No positive posted control budget is recorded.', 'controls', 'Open')
  if (draftBudgets?.length) add('draft-budgets', 'medium', `Review ${draftBudgets.length} draft budget allocations`, 'Draft allocations do not contribute to the approved control budget.')
  if (incompleteApprovals.length) add('approval-evidence', 'high', 'Review budget approval records', `${incompleteApprovals.length} approved allocations have no recorded approval date.`, 'quality')
  if (unallocated.length) add('unallocated-wbs', 'high', `Allocate ${unallocated.length} commercial postings`, 'These commitment or actual entries have no WBS allocation.')
  if (unassignedPeriodEntries.length) add('period-allocation', 'medium', 'Review reporting period allocation', `${unassignedPeriodEntries.length} actual cost entries have no reporting period.`, 'quality')
  if (failedEvents.length) add('audit-errors', 'high', `Review ${failedEvents.length} commercial event errors`, failedEvents[0].processingError, 'audit')
  if (cpi !== null && cpi < 1) add('cost-performance', 'high', 'Review cost performance', `Latest sealed CPI is ${cpi.toFixed(2)}; earned value is below actual cost.`)
  if (snapshots !== null && !latestSnapshot) add('reporting-history', 'medium', 'Seal a commercial reporting period', 'No sealed monetary reporting history is available in the project currency.', 'quality')
  const severity = { critical: 0, high: 1, medium: 2 }
  exceptions.sort((a, b) => (severity[a.priority] ?? 3) - (severity[b.priority] ?? 3))
  const approvedBudgetCount = (approvedBudgets || []).filter(row => row.currencyMatches).length
  const ledgerReady = ledger !== null && ledger.length > 0 && !foreignLedger.length && !invalidLedger.length
  const currencyVerified = commercial !== null && ledger !== null && budgets !== null && snapshots !== null
  const quality = [
    { id: 'budget', label: 'Budget approvals', ready: approvedBudgetCount > 0 && !incompleteApprovals.length, status: budgets === null ? 'Unavailable' : incompleteApprovals.length ? 'Incomplete evidence' : approvedBudgetCount ? 'Recorded' : 'Not recorded', detail: `${approvedBudgetCount} approved allocations in ${currency}. Draft allocations remain outside posted budget totals.` },
    { id: 'ledger', label: 'Posted ledger', ready: ledgerReady, status: ledger === null ? 'Unavailable' : invalidLedger.length ? 'Incomplete values' : foreignLedger.length ? 'Currency review' : ledger.length ? 'Recorded' : 'No postings', detail: 'Current commercial facts use posted entries. Actual cost includes actual and adjustment entries; commitments remain separate.' },
    { id: 'currency', label: 'Currency', ready: currencyVerified && !currencyMismatch, status: !currencyVerified ? 'Not verified' : currencyMismatch ? 'Review required' : 'Consistent', detail: `Chart and WBS arithmetic use ${currency} only. Individual records retain their original currency.` },
    { id: 'periods', label: 'Reporting periods', ready: periods !== null && Boolean(latestSnapshot), status: snapshots === null || periods === null ? 'Unavailable' : latestSnapshot ? 'Sealed history' : 'No sealed history', detail: `${chartPoints?.length || 0} latest sealed period observations. ${unlockedPeriods.length} reporting periods remain open, submitted or reopened.` },
    { id: 'audit', label: 'Commercial audit', ready: auditEvents !== null && auditEvents.length > 0 && !failedEvents.length, status: auditEvents === null ? 'Unavailable' : failedEvents.length ? 'Errors recorded' : auditEvents.length ? 'Recorded' : 'No events', detail: 'The source provides the latest 30 immutable commercial events. Event dates do not represent payment due dates.' },
  ].map(row => ({ ...row, tone: row.ready ? 'success' : ['Unavailable', 'Not verified', 'No events'].includes(row.status) ? 'neutral' : 'warning' }))
  const health = !project ? { label: 'Select a project', tone: 'neutral' }
    : issues.length ? { label: 'Data unavailable', tone: 'warning' }
      : exceptions.some(row => row.priority === 'critical') || cpi !== null && cpi < 1 ? { label: 'At risk', tone: 'danger' }
        : exceptions.some(row => row.priority === 'high') || quality.some(row => !row.ready) ? { label: 'Needs review', tone: 'warning' }
          : { label: 'Within control', tone: 'success' }
  return {
    currency, summaryCurrency, contractCurrency, contractValue, controlBudget, committed, actual, paid, unpaid,
    canExport: commercial !== null,
    remaining, outstandingCommitment, invoiceScheduledAmount, counts, chartPoints, latestSnapshot, dataDate,
    cpi, eac, costVariance, varianceAtCompletion, historicalBudget, latestActual, legacyCostBasis,
    wbs, budgets, approvedBudgets, draftBudgets, ledger, periods, auditEvents, exceptions, quality, health,
    currencyMismatch, summariesUnsafe, excludedSnapshotCount: excludedSnapshots.length,
    summaryNote: summariesUnsafe ? 'Original commercial summary values are shown. Detected currency differences require review before comparing totals.' : 'Current posted commercial position. Commitments are shown separately from verified actual cost.',
    chartNote: 'Latest sealed version of each reporting period, in the project currency. Actual cost uses the cumulative reporting basis. Legacy period-only cost observations are omitted from the cumulative actual line and derived performance; their original amounts remain available in the table.',
    wbsNote: `Posted ledger grouped by WBS in ${currency}. Actual includes posted adjustments; foreign-currency entries are excluded. Remaining equals budget minus actual cost.`,
    paymentNote: 'Supplier paid and approved/unpaid are the existing project commercial facts. Invoice scheduled amount covers invoice-level scheduling operations; it is not a project-allocated payment forecast or due-date schedule.',
    forecastNote: legacyCostBasis ? 'The latest sealed report uses legacy period-only actual cost. CPI and estimate at completion are unavailable until a report with cumulative actual cost is sealed.' : 'CPI and estimate at completion come from the latest sealed monetary reporting period. No future cash flow or payment due dates are inferred.',
    availability: { commercial: commercial !== null, kpis: kpis !== null, snapshots: snapshots !== null, budgets: budgets !== null, ledger: ledger !== null, periods: periods !== null, audit: auditEvents !== null },
  }
}

export default function useCommercialPerformance(project, performance, revision = 0, options = {}) {
  const { enabled = true } = options
  const projectId = project?.id ?? null
  const updatedAt = project?.updated_at ?? null
  const rawData = performance?.rawData || null
  const sharedProjectId = performance?.projectId ?? null
  const sharedLoading = Boolean(performance?.loading)
  const sharedReload = performance?.reload
  const [reloadToken, setReloadToken] = useState(0)
  const [state, setState] = useState({ projectId: null, loading: false, data: emptyData(), issues: [], loadedAt: null })
  const [completed, setCompleted] = useState({ projectId: null, loadedAt: null })
  const reload = useCallback(() => { sharedReload?.(); setReloadToken(value => value + 1) }, [sharedReload])
  useEffect(() => {
    if (!enabled || !projectId) return undefined
    let current = true
    const controller = new AbortController()
    setState({ projectId, loading: true, data: emptyData(), issues: [], loadedAt: null })
    const requests = [
      ['budgets', 'Budget allocations', endpoints.budgetAllocations, {}],
      ['ledger', 'Posted cost ledger', endpoints.costLedger, { status: 'posted' }],
      ['periods', 'Reporting periods', endpoints.reportingPeriods, {}],
    ]
    Promise.allSettled(requests.map(([, , endpoint, params]) => allPages(endpoint, { project: projectId, ...params }, controller.signal))).then(results => {
      if (!current) return
      const data = emptyData()
      const issues = []
      results.forEach((result, index) => {
        const [field, label] = requests[index]
        if (result.status === 'fulfilled') data[field] = result.value
        else issues.push(messageFor(label, result.reason))
      })
      setState({ projectId, loading: false, data, issues, loadedAt: new Date().toISOString() })
    })
    return () => { current = false; controller.abort() }
  }, [enabled, projectId, updatedAt, revision, reloadToken])
  const matches = state.projectId === projectId
  const sharedMatches = sharedProjectId !== null && String(sharedProjectId) === String(projectId) && rawData !== null
  const loading = Boolean(enabled && projectId && (!matches || state.loading || !sharedMatches || sharedLoading))
  const issues = useMemo(() => {
    const next = matches ? [...state.issues] : []
    if (enabled && sharedMatches && !sharedLoading) {
      for (const [field, label] of [['commercial', 'Commercial summary'], ['kpis', 'Cost indicators'], ['snapshots', 'Sealed cost history']]) {
        if (rawData[field] === null || rawData[field] === undefined) next.push(`${label} is unavailable. Retry to refresh this information.`)
      }
    }
    return next
  }, [enabled, matches, state.issues, sharedMatches, sharedLoading, rawData])
  useEffect(() => {
    if (enabled && projectId && !loading && matches && sharedMatches) setCompleted({ projectId, loadedAt: new Date().toISOString() })
  }, [enabled, projectId, loading, matches, sharedMatches, state.loadedAt, rawData])
  const model = useMemo(() => buildCommercialModel(project, sharedMatches ? rawData : null, matches ? state.data : emptyData(), issues), [project, sharedMatches, rawData, matches, state.data, issues])
  return { loading, issues, model, reload, loadedAt: completed.projectId === projectId && !loading ? completed.loadedAt : null }
}
