import * as XLSX from 'xlsx'
import { commercialNow, newCommercialState } from './commercial-performance.fixture'

export const estimateNow = commercialNow
const kindLabels = { estimate: 'Internal Estimate', tender: 'Tender Submitted', awarded: 'Awarded / Contract', baseline: 'Baseline (locked)', revised: 'Revised' }
const statusLabels = { draft: 'Draft', approved: 'Approved', superseded: 'Superseded' }
const sourceLabels = { manual: 'Manual entry', excel: 'Excel BOQ import' }
const reply = (route, data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) })
const pageOf = results => ({ count: results.length, next: null, previous: null, results })
const amount = value => Number(value).toFixed(2)
const sum = lines => amount(lines.reduce((total, line) => total + Number(line.line_total), 0))

export function prepareEstimates(state) {
  for (const record of Object.values(state.records)) {
    const offset = record.project.id === 17 ? 0 : 1000
    const definitions = [
      { id: 5101, kind: 'baseline', version: 1, status: 'approved', title: 'Approved control baseline', date: '2026-01-15', totals: [1000000, 2000000, 3000000, 1500000, 2000000, 500000] },
      { id: 5102, kind: 'tender', version: 1, status: 'approved', title: 'Tender commercial submission', date: '2026-02-20', totals: [1050000, 2100000, 3150000, 1575000, 2100000, 525000] },
      { id: 5103, kind: 'revised', version: 1, status: 'superseded', title: 'First scope revision', date: '2026-04-30', totals: [1100000, 2200000, 3300000, 1650000, 2200000, 550000] },
      { id: 5104, kind: 'revised', version: 2, status: 'approved', title: 'Approved August revision', date: '2026-08-31', totals: [1100000, 2400000, 3400000, 1600000, 2500000, 700000] },
      { id: 5105, kind: 'revised', version: 3, status: 'draft', title: 'September working estimate', date: '2026-09-15', totals: [1100000, 2500000, 3500000, 1600000, 2700000, 750000], source: 'excel', source_document: 9003 + offset },
      { id: 5106, kind: 'estimate', version: 1, status: 'draft', title: 'Supplier package in USD', date: '2026-09-08', totals: [250000], currency: 'USD' },
    ]
    record.estimates = definitions.map(definition => {
      const rows = [
        ['01.01', 'Process engineering hours', 'Process', 'Indirect', 'hr', 10000],
        ['01.02', 'Piping materials package', 'Piping', 'Direct', 'm', 2000],
        ['02.01', 'Rotating equipment package', 'Mechanical', 'Direct', 'each', 10],
        ['03.01', 'Electrical installation', 'Electrical', 'Direct', 'hr', 10000],
        ['04.01', 'Civil construction works', 'Civil', 'Direct', 'hr', 20000],
        ['05.01', 'Recorded contingency allowance', '', 'Contingency', 'lot', 1],
      ]
      const id = definition.id + offset
      const lines = definition.totals.map((total, index) => {
        const [wbs_code, description, discipline, category, unit, quantity] = rows[index]
        return {
          id: id * 10 + index, estimate: id, wbs_code, description, discipline, category, unit,
          quantity: quantity.toFixed(4), unit_rate: (total / quantity).toFixed(4), line_total: amount(total), sort_order: index,
          source_row: definition.source === 'excel' ? { '0': wbs_code, '1': description, '2': String(quantity), '3': String(total / quantity), '4': String(total) } : {},
          created_at: definition.date + 'T06:00:00Z', updated_at: definition.date + 'T06:00:00Z',
        }
      })
      // A source workbook amount can intentionally differ from quantity × rate.
      if (definition.id === 5105) lines[4].unit_rate = '130.0000'
      return {
        id, project: record.project.id, kind: definition.kind, kind_display: kindLabels[definition.kind], version: definition.version,
        status: definition.status, status_display: statusLabels[definition.status], source: definition.source || 'manual', source_display: sourceLabels[definition.source || 'manual'],
        title: definition.title, currency: definition.currency || 'AED', total_amount: sum(lines), snapshot_date: definition.date,
        notes: definition.id === 5105 ? 'Basis: September engineering quantities and vendor budget quotations.\nAssumptions: Site access during normal working hours.\nExclusions: Client supplied spares.\nQualification: Civil amount follows the recorded workbook total.' : 'Basis: Recorded project scope and quantity schedule.',
        source_document: definition.source_document || null, created_by: 7, line_items: lines, line_item_count: lines.length,
        created_at: definition.date + 'T06:00:00Z', updated_at: definition.date + 'T06:00:00Z',
        can_edit: definition.status === 'draft', can_approve: definition.status === 'draft', can_copy: true,
      }
    }).sort((first, second) => second.created_at.localeCompare(first.created_at))
    record.documents = [{ id: 9003 + offset, project: record.project.id, kind: 'boq', kind_display: 'BOQ', title: 'September estimate source workbook', original_filename: 'September-BOQ.xlsx', content_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', size_bytes: 10240, parse_status: 'done', parsed_data: {}, parse_error: '', uploaded_by: 7, created_at: '2026-09-15T06:00:00Z', updated_at: estimateNow }]
  }
  state.writes = []
  state.saveFailure = false
  state.canWrite = true
  state.listPageSize = 3
}

export function newEstimateState() {
  const state = newCommercialState()
  prepareEstimates(state)
  return state
}

const listRecord = estimate => Object.fromEntries(Object.entries(estimate).filter(([key]) => !['line_items', 'notes', 'source_document', 'created_by', 'source_display'].includes(key)))
const permissions = (estimate, state) => ({ ...estimate, can_edit: state.canWrite && estimate.status === 'draft', can_approve: state.canWrite && estimate.status === 'draft', can_copy: state.canWrite })
const recalculate = estimate => { estimate.total_amount = sum(estimate.line_items); estimate.line_item_count = estimate.line_items.length; estimate.updated_at = estimateNow }

export function estimateWorkbook() {
  const workbook = XLSX.utils.book_new()
  const sheet = XLSX.utils.aoa_to_sheet([
    ['WBS', 'Description', 'Discipline', 'Unit', 'Quantity', 'Unit Rate', 'Amount'],
    ['01.03', 'Imported process study', 'Process', 'hr', 10, 125, 1250],
    ['02.02', 'Client supplied spare', 'Mechanical', 'each', 2, 500, 0],
  ])
  XLSX.utils.book_append_sheet(workbook, sheet, 'BOQ')
  return { name: 'Estimate-browser-fixture.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' }) }
}

function multipartFields(request) {
  const boundary = request.headers()['content-type']?.match(/boundary=(.+)$/)?.[1]?.replace(/^"|"$/g, '')
  const fields = {}
  for (const part of (request.postDataBuffer()?.toString('latin1') || '').split('--' + boundary)) {
    const name = part.match(/name="([^"]+)"/)?.[1]
    if (!name) continue
    const filename = part.match(/filename="([^"]*)"/)?.[1]
    fields[name] = filename == null ? part.split('\r\n\r\n').slice(1).join('\r\n\r\n').replace(/\r\n$/, '') : { filename, bytes: part.split('\r\n\r\n').slice(1).join('\r\n\r\n').length }
  }
  return fields
}

export async function estimateHarness(page, options = {}) {
  const state = newEstimateState()
  options.prepare?.(state)
  await page.clock.setFixedTime(new Date(estimateNow))
  await page.route(url => url.pathname === '/projects', route => route.fulfill({
    contentType: 'text/html',
    body: '<!doctype html><html lang="en"><head><title>Project Estimates interaction test</title><script type="module">import RefreshRuntime from "/@react-refresh"; RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => (type) => type; window.__vite_plugin_react_preamble_installed__ = true;</script></head><body><div id="performance-test"></div><script type="module" src="/tests/fixtures/project-performance-harness.jsx"></script></body></html>',
  }))
  await page.route('**/api/v1/**', route => {
    const request = route.request(), method = request.method(), url = new URL(request.url()), path = url.pathname
    const estimateMatch = path.match(/\/estimates\/(\d+)\/(copy-version\/|approve\/|supersede\/)?$/)
    const lineMatch = path.match(/\/estimate-line-items\/(\d+)\/$/)
    const raw = ['GET', 'DELETE'].includes(method) ? null : path.endsWith('/import-boq/') ? multipartFields(request) : request.postDataJSON()
    const projectId = raw?.project || url.searchParams.get('project') || url.searchParams.get('project_id') || path.match(/\/projects\/(\d+)\/$/)?.[1] || '17'
    let record = state.records[projectId] || state.records[17]
    let estimate = estimateMatch ? Object.values(state.records).flatMap(item => item.estimates).find(item => String(item.id) === estimateMatch[1]) : null
    let line = null
    if (lineMatch) {
      estimate = Object.values(state.records).flatMap(item => item.estimates).find(item => item.line_items.some(value => String(value.id) === lineMatch[1]))
      line = estimate?.line_items.find(item => String(item.id) === lineMatch[1])
    }
    if (!estimate && raw?.estimate) estimate = Object.values(state.records).flatMap(item => item.estimates).find(item => String(item.id) === String(raw.estimate))
    if (estimate) record = state.records[estimate.project]
    state.requests.push({ path, method, query: Object.fromEntries(url.searchParams), project: record.project.id })
    if ([...state.failures].some(resource => path.includes(resource))) return reply(route, { detail: 'Estimate source temporarily unavailable.' }, 503)

    if (/\/project-control\/(estimates|estimate-line-items)\//.test(path) || path.endsWith('/documents/import-boq/')) {
      if (method !== 'GET') {
        state.writes.push({ path, method, project: record.project.id, body: raw })
        if (!state.canWrite) return reply(route, { detail: 'You cannot modify this project.' }, 403)
        if (state.saveFailure) return reply(route, { detail: 'The estimate could not be saved. Please retry.' }, 400)
      }
      if (method === 'GET' && path.endsWith('/estimates/')) {
        const number = Number(url.searchParams.get('page') || 1), size = state.listPageSize || 100
        const values = record.estimates.slice((number - 1) * size, number * size).map(item => listRecord(permissions(item, state)))
        return reply(route, { count: record.estimates.length, next: number * size < record.estimates.length ? url.origin + path + '?project=' + record.project.id + '&page=' + (number + 1) : null, previous: number > 1 ? url.origin + path + '?project=' + record.project.id + '&page=' + (number - 1) : null, results: values })
      }
      if (method === 'GET' && estimateMatch) return estimate ? reply(route, permissions(estimate, state)) : reply(route, { detail: 'Not found.' }, 404)
      if (method === 'GET' && path.endsWith('/estimate-line-items/')) {
        const selected = record.estimates.find(item => String(item.id) === url.searchParams.get('estimate'))
        return reply(route, pageOf(selected?.line_items || []))
      }
      if (method === 'POST' && (path.endsWith('/estimates/') || path.endsWith('/copy-version/'))) {
        const source = path.endsWith('/copy-version/') ? estimate : null
        const kind = source?.kind || raw.kind || 'estimate'
        const id = Math.max(5100, ...Object.values(state.records).flatMap(item => item.estimates.map(value => value.id))) + 1
        const version = Math.max(0, ...record.estimates.filter(item => item.kind === kind).map(item => item.version)) + 1
        const created = {
          id, project: record.project.id, kind, kind_display: kindLabels[kind], version, status: 'draft', status_display: 'Draft', source: 'manual', source_display: 'Manual entry',
          title: raw.title || (source ? source.title + ' (copy)' : ''), currency: source?.currency || raw.currency || record.project.currency,
          snapshot_date: source?.snapshot_date || raw.snapshot_date || null, notes: source?.notes || raw.notes || '', source_document: source?.source_document || raw.source_document || null,
          created_by: 7, line_items: source ? source.line_items.map((item, index) => ({ ...structuredClone(item), id: id * 10 + index, estimate: id, created_at: estimateNow, updated_at: estimateNow })) : [],
          created_at: estimateNow, updated_at: estimateNow, can_edit: true, can_approve: true, can_copy: true,
        }
        recalculate(created)
        if (source) created.total_amount = source.total_amount
        record.estimates.unshift(created)
        return reply(route, created, 201)
      }
      if (method === 'POST' && path.endsWith('/approve/')) {
        if (!estimate || estimate.status !== 'draft' || !estimate.line_items.length) return reply(route, { detail: 'Only a nonempty draft estimate can be approved.' }, 400)
        Object.assign(estimate, { status: 'approved', status_display: 'Approved', updated_at: estimateNow })
        return reply(route, permissions(estimate, state))
      }
      if (method === 'POST' && path.endsWith('/supersede/')) {
        Object.assign(estimate, { status: 'superseded', status_display: 'Superseded', updated_at: estimateNow })
        return reply(route, permissions(estimate, state))
      }
      if (method === 'PATCH' && estimateMatch) {
        if (estimate.status !== 'draft') return reply(route, { detail: 'Only draft estimates can be edited.' }, 400)
        for (const key of ['title', 'currency', 'snapshot_date', 'notes', 'source_document']) if (Object.hasOwn(raw, key)) estimate[key] = raw[key]
        estimate.updated_at = estimateNow
        return reply(route, permissions(estimate, state))
      }
      if (path.includes('/estimate-line-items/') && ['POST', 'PATCH', 'DELETE'].includes(method)) {
        if (!estimate || estimate.status !== 'draft') return reply(route, { detail: 'Only draft estimate lines can be edited.' }, 400)
        if (method === 'DELETE') { estimate.line_items = estimate.line_items.filter(item => item.id !== line.id); recalculate(estimate); return route.fulfill({ status: 204, body: '' }) }
        if (method === 'POST') {
          line = { id: Math.max(0, ...Object.values(state.records).flatMap(item => item.estimates.flatMap(value => value.line_items.map(row => row.id)))) + 1, estimate: estimate.id, wbs_code: '', description: '', discipline: '', category: '', unit: '', quantity: '0.0000', unit_rate: '0.0000', line_total: '0.00', sort_order: estimate.line_items.length, source_row: {}, created_at: estimateNow, updated_at: estimateNow }
          estimate.line_items.push(line)
        }
        const previousTotal = line.line_total
        for (const key of ['wbs_code', 'description', 'discipline', 'category', 'unit', 'quantity', 'unit_rate', 'line_total', 'sort_order']) if (Object.hasOwn(raw, key)) line[key] = raw[key]
        line.quantity = Number(line.quantity).toFixed(4); line.unit_rate = Number(line.unit_rate).toFixed(4)
        line.line_total = Object.hasOwn(raw, 'line_total') ? amount(raw.line_total) : method === 'POST' || Object.hasOwn(raw, 'quantity') || Object.hasOwn(raw, 'unit_rate') ? amount(Number(line.quantity) * Number(line.unit_rate)) : previousTotal
        line.updated_at = estimateNow; recalculate(estimate)
        return reply(route, line, method === 'POST' ? 201 : 200)
      }
      if (method === 'POST' && path.endsWith('/import-boq/')) {
        const id = Math.max(0, ...Object.values(state.records).flatMap(item => item.estimates.map(value => value.id))) + 1
        const kind = raw.kind || 'estimate', version = Math.max(0, ...record.estimates.filter(item => item.kind === kind).map(item => item.version)) + 1
        const lines = [
          { id: id * 10, estimate: id, wbs_code: '01.03', description: 'Imported process study', discipline: 'Process', category: '', unit: 'hr', quantity: '10.0000', unit_rate: '125.0000', line_total: '1250.00', sort_order: 0, source_row: { '0': '01.03', '1': 'Imported process study' }, created_at: estimateNow, updated_at: estimateNow },
          { id: id * 10 + 1, estimate: id, wbs_code: '02.02', description: 'Client supplied spare', discipline: 'Mechanical', category: '', unit: 'each', quantity: '2.0000', unit_rate: '500.0000', line_total: '0.00', sort_order: 1, source_row: { '0': '02.02', '1': 'Client supplied spare', '6': '0' }, created_at: estimateNow, updated_at: estimateNow },
        ]
        const document = { ...record.documents[0], id: 9900 + state.writes.length, title: raw.title || raw.file.filename, original_filename: raw.file.filename, created_at: estimateNow, updated_at: estimateNow }
        const created = { id, project: record.project.id, kind, kind_display: kindLabels[kind], version, source: 'excel', source_display: 'Excel BOQ import', status: 'draft', status_display: 'Draft', title: raw.title || 'Imported BOQ', currency: raw.currency || record.project.currency, total_amount: '1250.00', snapshot_date: null, notes: raw.notes || '', source_document: document.id, created_by: 7, line_items: lines, line_item_count: 2, created_at: estimateNow, updated_at: estimateNow, can_edit: true, can_approve: true, can_copy: true }
        record.estimates.unshift(created); record.documents.push(document)
        return reply(route, { document, summary: { estimate_id: id, version, kind, header_row_index: 0, detected_columns: { wbs: 0, description: 1, discipline: 2, unit: 3, quantity: 4, unit_rate: 5, line_total: 6 }, imported_rows: 2, skipped_rows: 0, total_amount: '1250.00', currency: created.currency } }, 201)
      }
      return reply(route, { detail: 'Unsupported estimate fixture request.' }, 405)
    }

    if (path.endsWith('/phase-flags/')) return reply(route, { phase_flags: { phase_1_project_dashboard: true, phase_1_cost_dashboard: true, phase_1_estimate_variance: true, phase_1_documents: true, phase_1_finance_sync: true, phase_2_ai_takeoff: false } })
    if (path.endsWith('/planning-intelligence/projects/')) return reply(route, pageOf([]))
    if (path.endsWith('/projects/')) return reply(route, pageOf(Object.values(state.records).map(item => item.project)))
    if (/\/projects\/\d+\/$/.test(path)) return reply(route, record.project)
    const resource = [['/analytics/commercial-dashboard/', 'commercial'], ['/analytics/cost-kpis/', 'kpis'], ['/reporting-periods/', 'periods'], ['/integrated-snapshots/', 'snapshots'], ['/cost-ledger/', 'ledger'], ['/projects/tasks/', 'tasks'], ['/projects/milestones/', 'milestones'], ['/change-events/', 'changes'], ['/wbs-nodes/', 'wbsNodes'], ['/budget-allocations/', 'budgets'], ['/documents/', 'documents']].find(([suffix]) => path.endsWith(suffix))
    if (resource) return reply(route, ['commercial', 'kpis'].includes(resource[1]) ? record[resource[1]] : pageOf(record[resource[1]]))
    const documentMatch = path.match(/\/documents\/(\d+)\/$/)
    if (documentMatch) return reply(route, Object.values(state.records).flatMap(item => item.documents).find(item => String(item.id) === documentMatch[1]))
    if (['/control-accounts/', '/approved-hours/'].some(suffix => path.endsWith(suffix))) return reply(route, pageOf([]))
    state.unknown.push(path)
    return reply(route, { detail: 'Endpoint not configured in Estimate browser fixture.' }, 404)
  })
  await page.goto('/projects?' + (options.query || 'project=17&view=estimates&shell=true'))
  return state
}
