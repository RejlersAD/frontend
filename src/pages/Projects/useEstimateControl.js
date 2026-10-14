import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSelector } from 'react-redux'
import apiClient from '../../services/api.service'
import { PROJECT_CONTROL_ENDPOINTS as endpoints } from '../../config/projectControl.config'

const WRITE_ROLES = new Set(['project_manager', 'lead_engineer', 'engineer', 'designer'])
const KINDS = { estimate: 'Internal estimate', tender: 'Tender submitted', awarded: 'Awarded / contract', baseline: 'Baseline', revised: 'Revised' }
const number = value => (typeof value === 'number' || typeof value === 'string') && String(value).trim() !== '' && Number.isFinite(Number(value)) ? Number(value) : null
const round = value => value === null ? null : Math.round((value + Number.EPSILON) * 100) / 100
const sameId = (a, b) => a !== null && a !== undefined && b !== null && b !== undefined && String(a) === String(b)
const date = value => { const day = String(value || '').slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(day) && !Number.isNaN(Date.parse(`${day}T00:00:00Z`)) ? day : null }
const label = value => String(value || '').replaceAll('_', ' ').replace(/\b\w/g, char => char.toUpperCase())
const currency = value => typeof value === 'string' && value.trim() ? value.trim().toUpperCase() : null
const newest = (a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')) || Number(b.id) - Number(a.id)
const emptyData = () => ({ estimates: null, selected: null, comparison: null, selectedId: null, comparisonId: null })

export function calculateEstimateLineTotal(quantity, rate) {
  const units = value => {
    const match = String(value ?? '').match(/^([+-]?)(\d+)(?:\.(\d{0,4}))?$/)
    return match ? BigInt(`${match[2]}${(match[3] || '').padEnd(4, '0')}`) * (match[1] === '-' ? -1n : 1n) : null
  }
  const quantityUnits = units(quantity), rateUnits = units(rate)
  if (quantityUnits === null || rateUnits === null) return null
  const product = quantityUnits * rateUnits, absolute = product < 0n ? -product : product
  let cents = absolute / 1000000n
  const remainder = absolute % 1000000n
  // Match Decimal.quantize('0.01') in the existing importer and API.
  if (remainder > 500000n || remainder === 500000n && cents % 2n === 1n) cents += 1n
  return Number(cents) / 100 * (product < 0n ? -1 : 1)
}

function canWriteProject(user, project) {
  if (!user || !project) return false
  if (user.is_staff || user.is_superuser || sameId(project.owner?.id ?? project.owner_id, user.id)) return true
  return Boolean(project.team_members_data?.some(member => member.is_active && sameId(member.user?.id ?? member.user_id, user.id) && WRITE_ROLES.has(member.role)))
}

async function allPages(projectId, signal) {
  const rows = []
  for (let page = 1; page <= 100; page += 1) {
    const response = await apiClient.get(endpoints.estimates, { params: { project: projectId, page }, signal })
    const data = response.data
    if (!Array.isArray(data) && !Array.isArray(data?.results)) throw new Error('Invalid estimate register response.')
    rows.push(...(Array.isArray(data) ? data : data.results))
    if (!data?.next) return rows
  }
  throw new Error('The estimate register exceeds the supported page limit.')
}

function chooseEstimates(rows, estimateId, compareId) {
  const selected = rows.find(row => sameId(row.id, estimateId)) || [...rows].sort(newest)[0] || null
  const comparison = compareId === 'none' ? null : rows.find(row => sameId(row.id, compareId) && !sameId(row.id, selected?.id))
    || (!compareId && selected ? rows.filter(row => row.status === 'approved' && row.kind === selected.kind && currency(row.currency) === currency(selected.currency) && Number(row.version) < Number(selected.version)).sort((a, b) => Number(b.version) - Number(a.version) || newest(a, b))[0] : null)
  return { selected, comparison: comparison || null }
}

function estimateRow(row, details = null) {
  if (!row) return null
  const raw = details || row
  const versionLabel = `${raw.kind_display || KINDS[raw.kind] || label(raw.kind)} v${raw.version}`
  return {
    id: raw.id, label: `${versionLabel}${raw.title ? ` — ${raw.title}` : ''}`, title: raw.title || versionLabel,
    kind: raw.kind, kindLabel: raw.kind_display || KINDS[raw.kind] || label(raw.kind), version: raw.version,
    status: raw.status, statusLabel: raw.status_display || label(raw.status), currency: currency(raw.currency),
    totalAmount: number(raw.total_amount), lineCount: number(raw.line_item_count), snapshotDate: date(raw.snapshot_date),
    date: date(raw.snapshot_date) || date(raw.created_at), dateSource: date(raw.snapshot_date) ? 'Recorded estimate date' : 'Version creation date',
    notes: details ? raw.notes || '' : null, source: raw.source, sourceLabel: raw.source_display || label(raw.source),
    sourceDocumentId: raw.source_document ?? null, createdById: raw.created_by ?? null,
    createdAt: raw.created_at || null, updatedAt: raw.updated_at || null,
    canEdit: raw.can_edit === true && raw.status === 'draft', canApprove: raw.can_approve === true && raw.status === 'draft',
    canCopy: raw.can_copy === true, raw,
  }
}

function normalizedLines(details) {
  if (!Array.isArray(details?.line_items)) return null
  return details.line_items.filter(row => !row.is_deleted && sameId(row.estimate, details.id)).map(row => {
    const quantity = number(row.quantity), unitRate = number(row.unit_rate), lineTotal = number(row.line_total)
    const calculatedTotal = calculateEstimateLineTotal(row.quantity, row.unit_rate)
    return {
      id: row.id, wbsCode: row.wbs_code || null, description: row.description || '', discipline: row.discipline || null,
      category: row.category || null, unit: row.unit || null, quantity, unitRate, lineTotal, calculatedTotal,
      isOverride: lineTotal !== null && calculatedTotal !== null && Math.abs(lineTotal - calculatedTotal) > .005,
      sortOrder: row.sort_order, sourceRow: row.source_row || {}, raw: row,
    }
  }).sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0) || Number(a.id) - Number(b.id))
}

function groupLines(lines, groupBy) {
  if (lines === null) return null
  const groups = new Map()
  const property = groupBy === 'wbs' ? 'wbsCode' : groupBy
  for (const row of lines) {
    const key = row[property] || 'Unclassified'
    if (!groups.has(key)) groups.set(key, { id: key, key, label: key, amount: 0, lineCount: 0, missingAmount: false })
    const group = groups.get(key)
    group.lineCount += 1
    if (row.lineTotal === null) group.missingAmount = true
    else group.amount += row.lineTotal
  }
  const total = lines.every(row => row.lineTotal !== null) ? lines.reduce((sum, row) => sum + row.lineTotal, 0) : null
  return [...groups.values()].map(group => ({ ...group, amount: group.missingAmount ? null : round(group.amount), sharePct: !group.missingAmount && total > 0 ? round(group.amount / total * 100) : null })).sort((a, b) => a.label.localeCompare(b.label))
}

export function buildEstimateModel(project, data, issues = [], options = {}) {
  const groupBy = ['wbs', 'discipline', 'category'].includes(options.groupBy) ? options.groupBy : 'wbs'
  const list = Array.isArray(data?.estimates) ? data.estimates.filter(row => sameId(row.project, project?.id)) : null
  const estimates = (list || []).map(row => estimateRow(row)).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)) || Number(b.id) - Number(a.id))
  const currentSummary = (list || []).find(row => sameId(row.id, data?.selectedId))
  const baseSummary = (list || []).find(row => sameId(row.id, data?.comparisonId))
  const currentDetail = sameId(data?.selected?.id, currentSummary?.id) && sameId(data?.selected?.project, project?.id) ? data.selected : null
  const baseDetail = sameId(data?.comparison?.id, baseSummary?.id) && sameId(data?.comparison?.project, project?.id) ? data.comparison : null
  const selected = estimateRow(currentSummary, currentDetail)
  const comparison = estimateRow(baseSummary, baseDetail)
  const lines = normalizedLines(currentDetail), baseLines = normalizedLines(baseDetail)
  const groupsBy = Object.fromEntries(['wbs', 'discipline', 'category'].map(key => [key, groupLines(lines, key)]))
  const groupRows = groupsBy[groupBy]
  const lineTotal = lines !== null && lines.every(row => row.lineTotal !== null) ? round(lines.reduce((sum, row) => sum + row.lineTotal, 0)) : null
  const baseLineTotal = baseLines !== null && baseLines.every(row => row.lineTotal !== null) ? round(baseLines.reduce((sum, row) => sum + row.lineTotal, 0)) : null
  const reconciled = selected?.totalAmount !== null && lineTotal !== null && Math.abs(selected.totalAmount - lineTotal) < .005
  const baseReconciled = comparison?.totalAmount !== null && baseLineTotal !== null && Math.abs(comparison.totalAmount - baseLineTotal) < .005
  const compatible = Boolean(selected && comparison && selected.kind === comparison.kind && selected.currency && selected.currency === comparison.currency)
  const comparable = compatible && lines !== null && baseLines !== null
  const comparisonReason = !comparison ? 'Select another estimate of the same kind and currency to compare.'
    : selected?.kind !== comparison.kind ? 'These estimates have different kinds. Compare the same kind to keep estimate, tender and contract values separate.'
      : !selected?.currency || selected.currency !== comparison.currency ? 'These estimates have different or missing currencies. No currency conversion is applied.'
        : !currentDetail || !baseDetail ? 'Both estimate details must be available for a comparison.'
          : !reconciled || !baseReconciled ? 'Recorded totals do not reconcile to the active lines. Group differences are available; the waterfall is withheld.'
            : 'Comparison uses recorded line amounts from the same estimate kind and currency.'
  let comparisonRows = null
  if (comparable) {
    const baseGroups = new Map(groupLines(baseLines, groupBy).map(row => [row.key, row]))
    const currentGroups = new Map(groupRows.map(row => [row.key, row]))
    comparisonRows = [...new Set([...baseGroups.keys(), ...currentGroups.keys()])].sort().map(key => {
      const base = baseGroups.get(key), current = currentGroups.get(key)
      const baseAmount = base ? base.amount : 0, currentAmount = current ? current.amount : 0
      const delta = baseAmount !== null && currentAmount !== null ? round(currentAmount - baseAmount) : null
      return { id: key, key, label: key, baseAmount, currentAmount, delta, deltaPct: delta !== null && baseAmount !== 0 ? round(delta / Math.abs(baseAmount) * 100) : null, baseLines: base?.lineCount || 0, currentLines: current?.lineCount || 0 }
    })
  }
  const delta = compatible && selected.totalAmount !== null && comparison.totalAmount !== null ? round(selected.totalAmount - comparison.totalAmount) : null
  const deltaPct = delta !== null && comparison.totalAmount !== 0 ? round(delta / Math.abs(comparison.totalAmount) * 100) : null
  let waterfall = null
  if (comparable && reconciled && baseReconciled) {
    let running = comparison.totalAmount
    waterfall = [{ id: 'base', label: `v${comparison.version}`, type: 'total', amount: running, start: 0, end: running }]
    for (const row of comparisonRows) { waterfall.push({ id: row.id, label: row.label, type: 'delta', amount: row.delta, start: running, end: round(running + row.delta) }); running = round(running + row.delta) }
    waterfall.push({ id: 'current', label: `v${selected.version}`, type: 'total', amount: selected.totalAmount, start: 0, end: selected.totalAmount })
  }
  const composition = groupsBy.category
  const costType = category => {
    const key = String(category || '').trim().toLowerCase().replace(/[_-]/g, ' ').replace(/\s+/g, ' ')
    return ['direct', 'direct cost', 'direct costs'].includes(key) ? 'direct'
      : ['indirect', 'indirect cost', 'indirect costs'].includes(key) ? 'indirect'
        : ['contingency', 'contingency allowance'].includes(key) ? 'contingency' : 'unclassified'
  }
  const sumType = type => { const rows = lines?.filter(row => costType(row.category) === type); return rows?.length && rows.every(row => row.lineTotal !== null) ? round(rows.reduce((sum, row) => sum + row.lineTotal, 0)) : null }
  const directCost = sumType('direct'), indirectCost = sumType('indirect'), contingency = sumType('contingency'), unclassifiedCost = sumType('unclassified')
  const trendPoints = selected ? estimates.filter(row => row.kind === selected.kind && row.currency === selected.currency && row.totalAmount !== null).sort((a, b) => Number(a.version) - Number(b.version)).map(row => ({ id: row.id, label: `v${row.version}`, version: row.version, date: row.date, dateSource: row.dateSource, amount: row.totalAmount, status: row.status, currency: row.currency, kind: row.kind })) : []
  const missingClassification = lines?.filter(row => !row.category || !row.wbsCode).length ?? null
  const overrides = lines?.filter(row => row.isOverride) || []
  const unknownAmounts = lines?.filter(row => row.lineTotal === null) || []
  const quality = [
    { id: 'register', label: 'Estimate register', ready: list !== null, status: list !== null ? 'Available' : 'Unavailable', detail: `${estimates.length} persisted estimate versions. Values of different kinds and currencies are not added together.` },
    { id: 'lines', label: 'Line completeness', ready: Boolean(lines?.length) && !unknownAmounts.length && !missingClassification, status: lines === null ? 'Unavailable' : !lines.length ? 'Empty' : unknownAmounts.length || missingClassification ? 'Review required' : 'Recorded', detail: `${lines?.length || 0} active lines; ${missingClassification ?? 'unknown'} lack a WBS code or category. ${overrides.length} recorded amounts differ from quantity × rate.` },
    { id: 'totals', label: 'Total reconciliation', ready: reconciled, status: !currentDetail ? 'Unavailable' : reconciled ? 'Reconciled' : 'Review required', detail: 'The selected estimate total is checked against its active line amounts. Explicit imported or manually recorded line amounts are preserved.' },
    { id: 'basis', label: 'Basis & assumptions', ready: Boolean(selected?.notes?.trim()), status: !currentDetail ? 'Unavailable' : selected.notes?.trim() ? 'Notes recorded' : 'Not recorded', detail: 'Basis, assumptions and qualifications are stored as estimate notes. Notes are not an approval or completeness assessment.' },
    { id: 'approval', label: 'Approval status', ready: selected?.status === 'approved', status: selected ? selected.statusLabel : 'Not selected', detail: 'Only the recorded estimate status is available. No named approver, approval date, workflow stages or confidence percentage are inferred.' },
  ].map(row => ({ ...row, tone: row.ready ? 'success' : row.status === 'Unavailable' ? 'danger' : 'warning' }))
  const exceptions = []
  const add = (id, priority, title, detail, view = 'builder') => exceptions.push({ id, priority, title, detail, view, button: view === 'builder' ? 'Open builder' : 'Review' })
  if (issues.length) add('unavailable', 'high', 'Refresh unavailable estimate data', issues.join(' '), 'quality')
  if (selected && lines && !lines.length) add('empty', 'high', 'Add estimate lines', 'A blank draft needs at least one cost line before approval.')
  if (currentDetail && !reconciled) add('reconciliation', 'high', 'Review estimate total reconciliation', 'The recorded total differs from the sum of active lines.')
  if (missingClassification) add('classification', 'medium', 'Complete WBS and category assignments', `${missingClassification} lines lack a WBS code or category.`)
  if (currentDetail && !selected.notes?.trim()) add('basis', 'medium', 'Record the estimate basis', 'Add source assumptions and qualifications to the estimate notes.', 'basis')
  if (overrides.length) add('overrides', 'medium', 'Review explicit line amounts', `${overrides.length} lines use a recorded amount different from quantity × rate. These values are included in totals.`)
  const canCreate = canWriteProject(options.user, project)
  const health = !project ? { label: 'Select a project', tone: 'neutral' }
    : issues.length || list === null ? { label: 'Data unavailable', tone: 'warning' }
      : !selected ? { label: 'Not prepared', tone: 'neutral' }
        : !reconciled || !lines?.length ? { label: 'Needs review', tone: 'warning' }
          : { label: selected.statusLabel, tone: selected.status === 'approved' ? 'success' : 'blue' }
  return {
    estimates, options: estimates, selected, comparison, lines, baseLines, groupsBy, groupRows, groupBy,
    comparisonRows, comparisonReason, compatible, comparable, delta, deltaPct, waterfall,
    composition, directCost, indirectCost, contingency, unclassifiedCost, lineTotal, reconciled, baseReconciled,
    trendPoints, trendNote: 'Current recorded totals by estimate version, for the selected kind and currency. Draft versions can change; these are not sealed historical cost snapshots.',
    quality, exceptions, health, dataDate: selected?.date || null, dataDateSource: selected?.dateSource || null,
    counts: { total: estimates.length, draft: estimates.filter(row => row.status === 'draft').length, approved: estimates.filter(row => row.status === 'approved').length, superseded: estimates.filter(row => row.status === 'superseded').length },
    canCreate, canEdit: Boolean(currentDetail && selected?.canEdit), canApprove: Boolean(currentDetail && selected?.canApprove && lines?.length && reconciled), canCopy: Boolean(currentDetail && selected?.canCopy),
    availability: { list: list !== null, selected: currentDetail !== null, comparison: baseDetail !== null },
    compositionNote: 'Category totals use recorded line classifications. Direct, indirect and contingency are not estimated from the overall total.',
    approvalNote: 'Estimate approval records its status and locks this version. It does not create an approved project budget or schedule baseline.',
  }
}

export default function useEstimateControl(project, revision = 0, options = {}) {
  const { enabled = true, estimateId = null, compareId = null, groupBy = 'wbs' } = options
  const user = useSelector(state => state.auth?.user || null)
  const projectId = project?.id ?? null
  const [reloadToken, setReloadToken] = useState(0)
  const [state, setState] = useState({ key: null, data: emptyData(), loading: false, issues: [], loadedAt: null })
  const key = `${projectId || ''}:${estimateId || ''}:${compareId || ''}`
  const reload = useCallback(() => setReloadToken(value => value + 1), [])
  useEffect(() => {
    if (!enabled || !projectId) return undefined
    let current = true
    const controller = new AbortController()
    setState({ key, data: emptyData(), loading: true, issues: [], loadedAt: null })
    const load = async () => {
      const data = emptyData(), issues = []
      try {
        data.estimates = (await allPages(projectId, controller.signal)).filter(row => sameId(row.project, projectId))
        const choices = chooseEstimates(data.estimates, estimateId, compareId)
        data.selectedId = choices.selected?.id ?? null
        data.comparisonId = choices.comparison?.id ?? null
        const requests = [['selected', choices.selected], ['comparison', choices.comparison]].filter(([, row]) => row)
        const results = await Promise.allSettled(requests.map(([, row]) => apiClient.get(`${endpoints.estimates}${row.id}/`, { signal: controller.signal })))
        results.forEach((result, index) => {
          const [field, row] = requests[index]
          if (result.status === 'fulfilled' && sameId(result.value.data?.project, projectId) && sameId(result.value.data?.id, row.id)) data[field] = result.value.data
          else issues.push(`${field === 'selected' ? 'Selected estimate' : 'Comparison estimate'} details are unavailable. Refresh to retry.`)
        })
      } catch { issues.push('The estimate register is unavailable. Refresh to retry.') }
      finally { if (current) setState({ key, data, loading: false, issues, loadedAt: new Date().toISOString() }) }
    }
    load()
    return () => { current = false; controller.abort() }
  }, [enabled, projectId, project?.updated_at, revision, reloadToken, estimateId, compareId, key])
  const matches = state.key === key
  const model = useMemo(() => buildEstimateModel(project, matches ? state.data : emptyData(), matches ? state.issues : [], { user, groupBy }), [project, matches, state.data, state.issues, user, groupBy])
  return { loading: Boolean(enabled && projectId && (!matches || state.loading)), issues: matches ? state.issues : [], model, reload, loadedAt: matches ? state.loadedAt : null }
}
