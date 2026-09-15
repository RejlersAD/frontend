import { commercialNow, newCommercialState } from './commercial-performance.fixture'
import { Buffer } from 'node:buffer'

export const documentNow = commercialNow
export const documentKinds = [
  { value: 'boq', label: 'BOQ' }, { value: 'tender', label: 'Tender' }, { value: 'contract', label: 'Contract' },
  { value: 'change_order', label: 'Change Order' }, { value: 'drawing', label: 'Drawing' }, { value: 'progress_report', label: 'Progress Report' },
  { value: 'minutes', label: 'Meeting Minutes' }, { value: 'specification', label: 'Specification' }, { value: 'other', label: 'Other' },
]
const processingLabels = { done: 'Parsed', pending: 'Pending', queued: 'Queued', failed: 'Failed', skipped: 'Skipped' }
const reply = (route, data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) })
const pageOf = results => ({ count: results.length, next: null, previous: null, results })
const downloadPath = id => `/api/v1/project-control/documents/${id}/download/`
const tinyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jN1kAAAAASUVORK5CYII=', 'base64')

function pdfFile(text) {
  const stream = `BT /F1 12 Tf 40 760 Td (${text.replace(/[()\\]/g, '')}) Tj ET`
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>', `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>']
  let pdf = '%PDF-1.4\n', offsets = [0]
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${index + 1} 0 obj\n${object}\nendobj\n` })
  const xref = Buffer.byteLength(pdf)
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(value => `${String(value).padStart(10, '0')} 00000 n `).join('\n')}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  return Buffer.from(pdf)
}

export function documentUpload() {
  return { name: 'Vendor-review-note.txt', mimeType: 'text/plain', buffer: Buffer.from('Vendor review note\nRecorded equipment clarification for project 5900913.\n') }
}

export function prepareDocuments(state) {
  for (const record of Object.values(state.records)) {
    const offset = record.project.id === 17 ? 0 : 1000
    const definitions = [
      ['Process P&ID package', '5900913-PID-001.pdf', 'drawing', 'done', '2026-09-15', 7, 'Maya Hassan'],
      ['September progress report', 'September-progress.pdf', 'progress_report', 'pending', '2026-09-14', 8, 'Omar Saleh'],
      ['Tender quantity schedule', 'Tender-BOQ.xlsx', 'boq', 'done', '2026-09-13', 7, 'Maya Hassan'],
      ['Pump equipment specification', 'Pump-specification.pdf', 'specification', 'failed', '2026-09-12', 8, 'Omar Saleh'],
      ['Contract scope addendum', 'Contract-addendum.pdf', 'contract', 'done', '2026-09-11', 7, 'Maya Hassan'],
      ['Design coordination minutes', 'Coordination-minutes.docx', 'minutes', 'done', '2026-09-10', 8, 'Omar Saleh'],
      ['Construction lift plan', 'Crane-lift-plan.pdf', 'other', 'skipped', '2026-09-09', 7, 'Maya Hassan'],
      ['Instrument data sheet', 'Instrument-data.pdf', 'drawing', 'queued', '2026-09-08', 8, 'Omar Saleh'],
      ['', 'Unclassified-reference.txt', 'other', 'done', '2026-09-07', null, null],
      ['Site survey photo', 'Site-survey.png', 'other', 'done', '2026-08-31', 7, 'Maya Hassan'],
      ['Commissioning procedure', 'Commissioning-procedure.txt', 'specification', 'done', '2026-08-20', 8, 'Omar Saleh'],
      ['Legacy handover record', '', 'other', 'done', '2026-07-31', null, null],
    ]
    record.documents = definitions.map(([title, filename, kind, status, day, userId, userName], index) => {
      const id = 7101 + index + offset, hasFile = Boolean(filename)
      const contentType = filename.endsWith('.pdf') ? 'application/pdf' : filename.endsWith('.png') ? 'image/png' : filename.endsWith('.xlsx') ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : filename.endsWith('.docx') ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : filename ? 'text/plain' : ''
      return {
        id, project: record.project.id, kind, kind_display: documentKinds.find(item => item.value === kind).label,
        title, original_filename: filename, content_type: contentType, size_bytes: hasFile ? 16384 + index * 4096 : 0,
        file_url: hasFile ? downloadPath(id) : null, download_url: hasFile ? downloadPath(id) : null,
        parse_status: status, parse_status_display: processingLabels[status],
        parsed_data: status === 'done' ? { phase: 1, note: 'Metadata-only parse — AI extraction lands in Phase 2/4.' } : {},
        parse_error: status === 'failed' ? 'Metadata processing failed for this uploaded file.' : '',
        uploaded_by: userId, uploaded_by_name: userName, created_at: day + 'T06:00:00Z', updated_at: day + 'T06:20:00Z',
        has_file: hasFile, can_edit: true, can_delete: true, can_download: hasFile, can_upload: true,
      }
    })
    record.serverScope = { id: `scope-${record.project.id}`, source: 'source-projects', relative_path: `${record.project.code} Project`, project: record.project.id, project_code: record.project.code, project_name: record.project.name, access_enabled: true }
    record.serverEntries = [
      { id: `folder-${record.project.id}`, source: 'source-projects', scope: record.serverScope.id, name: 'Reports', relative_path: `${record.project.code} Project/Reports`, parent_path: record.serverScope.relative_path, is_directory: true, status: 'indexed', size_bytes: 0, content_type: '', current_version: null, version_number: null, modified_at: '2026-09-14T06:00:00Z' },
      { id: `server-file-${record.project.id}`, source: 'source-projects', scope: record.serverScope.id, name: 'Server progress.txt', relative_path: `${record.project.code} Project/Reports/Server progress.txt`, parent_path: `${record.project.code} Project/Reports`, is_directory: false, status: 'available', size_bytes: 32, content_type: 'text/plain', current_version: `server-version-${record.project.id}`, version_number: 2, modified_at: '2026-09-15T06:00:00Z' },
    ]
    record.extractions = []
    record.documentContents = {}
  }
  state.writes = []
  state.canWrite = true
  state.saveFailure = false
  state.listPageSize = 5
  state.maxDocumentBytes = 104857600
}

export function newDocumentState() {
  const state = newCommercialState()
  prepareDocuments(state)
  return state
}

function fieldsFrom(request) {
  if (!request.headers()['content-type']?.includes('multipart/form-data')) return request.postDataJSON()
  const boundary = request.headers()['content-type'].match(/boundary=(.+)$/)?.[1]?.replace(/^"|"$/g, ''), fields = {}
  for (const part of (request.postDataBuffer()?.toString('latin1') || '').split('--' + boundary)) {
    const name = part.match(/name="([^"]+)"/)?.[1]
    if (!name) continue
    const filename = part.match(/filename="([^"]*)"/)?.[1], value = part.split('\r\n\r\n').slice(1).join('\r\n\r\n').replace(/\r\n$/, '')
    fields[name] = filename == null ? value : { filename, size: Buffer.byteLength(value, 'latin1'), contentType: part.match(/Content-Type: ([^\r\n]+)/i)?.[1] || 'application/octet-stream', text: value }
  }
  return fields
}
const capabilityRecord = (document, state) => ({ ...document, can_edit: state.canWrite, can_delete: state.canWrite, can_upload: state.canWrite, can_download: document.has_file })

export async function documentHarness(page, options = {}) {
  const state = newDocumentState()
  options.prepare?.(state)
  await page.clock.setFixedTime(new Date(documentNow))
  await page.route(url => url.pathname === '/projects', route => route.fulfill({
    contentType: 'text/html',
    body: '<!doctype html><html lang="en"><head><title>Project Documents interaction test</title><script type="module">import RefreshRuntime from "/@react-refresh"; RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => (type) => type; window.__vite_plugin_react_preamble_installed__ = true;</script></head><body><div id="performance-test"></div><script type="module" src="/tests/fixtures/project-performance-harness.jsx"></script></body></html>',
  }))
  await page.route('**/api/v1/**', route => {
    const request = route.request(), method = request.method(), url = new URL(request.url()), path = url.pathname
    const body = ['GET', 'DELETE'].includes(method) ? null : fieldsFrom(request)
    const documentMatch = path.match(/\/project-control\/documents\/(\d+)\/(download\/|presign-download\/)?$/)
    const document = documentMatch ? Object.values(state.records).flatMap(item => item.documents).find(item => String(item.id) === documentMatch[1]) : null
    const projectId = document?.project || body?.project || url.searchParams.get('project') || url.searchParams.get('project_id') || path.match(/\/projects\/(\d+)\/$/)?.[1] || path.match(/\/(?:server-file|extract)-(\d+)\//)?.[1] || '17'
    const record = state.records[projectId] || state.records[17]
    state.requests.push({ method, path, query: Object.fromEntries(url.searchParams), project: record.project.id })
    if ([...state.failures].some(resource => path.includes(resource))) return reply(route, { detail: 'Document service is temporarily unavailable.' }, 503)
    if (path.includes('/project-control/documents/')) {
      if (method !== 'GET') {
        state.writes.push({ method, path, body, project: record.project.id })
        if (!state.canWrite) return reply(route, { detail: 'You cannot modify this project.' }, 403)
        if (state.saveFailure) return reply(route, { detail: 'Document could not be saved. Please retry.' }, 400)
      }
      if (method === 'GET' && path.endsWith('/documents/')) {
        const pageNumber = Number(url.searchParams.get('page') || 1), pageSize = state.listPageSize || 100
        const start = (pageNumber - 1) * pageSize
        return reply(route, { count: record.documents.length, previous: pageNumber > 1 ? '?page=' + (pageNumber - 1) : null, next: start + pageSize < record.documents.length ? `${url.origin}${path}?project=${record.project.id}&page=${pageNumber + 1}` : null, results: record.documents.slice(start, start + pageSize).map(item => capabilityRecord(item, state)), capabilities: { can_upload: state.canWrite, max_document_bytes: state.maxDocumentBytes, document_kinds: documentKinds } })
      }
      if (method === 'GET' && path.endsWith('/presign-download/')) return reply(route, { document_id: document.id, download_url: downloadPath(document.id), requires_auth: true })
      if (method === 'GET' && path.endsWith('/download/')) {
        if (!document?.has_file) return reply(route, { detail: 'No stored file is available.' }, 404)
        const data = document.content_type === 'application/pdf' ? pdfFile(document.title) : document.content_type === 'image/png' ? tinyPng : Buffer.from(record.documentContents[document.id] || `${document.title}\nRecorded document content for project ${record.project.code}.\n`)
        return route.fulfill({ status: 200, contentType: 'application/octet-stream', headers: { 'Content-Disposition': `attachment; filename="${document.original_filename}"`, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' }, body: data })
      }
      if (method === 'GET' && documentMatch) return document ? reply(route, capabilityRecord(document, state)) : reply(route, { detail: 'Document not found.' }, 404)
      if (method === 'POST' && path.endsWith('/documents/')) {
        if (!body.file || !body.project) return reply(route, { detail: 'A project and file are required.' }, 400)
        const id = Math.max(7100, ...Object.values(state.records).flatMap(item => item.documents.map(value => value.id))) + 1
        const created = { id, project: record.project.id, title: body.title || '', kind: body.kind || 'other', kind_display: documentKinds.find(item => item.value === (body.kind || 'other')).label, original_filename: body.file.filename, content_type: body.file.contentType, size_bytes: body.file.size, parse_status: 'queued', parse_status_display: 'Queued', parsed_data: {}, parse_error: '', uploaded_by: 7, uploaded_by_name: 'Maya Hassan', created_at: documentNow, updated_at: documentNow, has_file: true, can_edit: true, can_delete: true, can_download: true, can_upload: true, file_url: downloadPath(id), download_url: downloadPath(id) }
        record.documentContents[id] = body.file.text
        record.documents.unshift(created)
        return reply(route, created, 201)
      }
      if (method === 'PATCH' && document) {
        if (Object.hasOwn(body, 'project') && String(body.project) !== String(document.project)) return reply(route, { project: 'The project association cannot be changed.' }, 400)
        for (const key of ['title', 'kind']) if (Object.hasOwn(body, key)) document[key] = body[key]
        document.kind_display = documentKinds.find(item => item.value === document.kind).label; document.updated_at = documentNow
        return reply(route, capabilityRecord(document, state))
      }
      if (method === 'DELETE' && document) { record.documents = record.documents.filter(item => item.id !== document.id); return route.fulfill({ status: 204, body: '' }) }
      return reply(route, { detail: 'Unsupported document fixture request.' }, 405)
    }
    if (path.includes('/file-replica/')) {
      if (path.endsWith('/scopes/')) return reply(route, pageOf([record.serverScope]))
      if (path.endsWith('/entries/')) {
        const values = record.serverEntries.filter(item => url.searchParams.get('search') ? item.name.toLowerCase().includes(url.searchParams.get('search').toLowerCase()) : item.parent_path === url.searchParams.get('parent_path'))
        return reply(route, pageOf(values))
      }
      if (path.endsWith('/extractions/')) return reply(route, record.extractions)
      if (path.endsWith('/download/')) return route.fulfill({ contentType: 'text/plain', body: 'Progress: 25%\nSource report only.' })
      if (path.endsWith('/extract/')) {
        const extracted = { id: `extract-${record.project.id}`, entry: `server-file-${record.project.id}`, version: `server-version-${record.project.id}`, version_number: 2, status: 'pending_review', sections: [{ location: 'Line 1', text: 'Progress: 25%' }], suggestions: [{ label: 'Progress', value: '25%', location: 'Line 1', evidence: 'Progress: 25%' }], warnings: [], created_at: documentNow, stale: false }
        record.extractions.push(extracted); state.writes.push({ method, path, body, project: record.project.id })
        return reply(route, extracted)
      }
      if (path.endsWith('/review/')) {
        const extracted = record.extractions[0]
        Object.assign(extracted, { status: body.status, review_notes: body.notes, reviewed_at: documentNow })
        state.writes.push({ method, path, body, project: record.project.id })
        return reply(route, extracted)
      }
    }
    if (path.endsWith('/phase-flags/')) return reply(route, { phase_flags: { phase_1_project_dashboard: true, phase_1_cost_dashboard: true, phase_1_estimate_variance: true, phase_1_documents: true, phase_1_finance_sync: true, phase_2_ai_takeoff: false } })
    if (path.endsWith('/planning-intelligence/projects/')) return reply(route, pageOf([]))
    if (path.endsWith('/projects/')) return reply(route, pageOf(Object.values(state.records).map(item => item.project)))
    if (/\/projects\/\d+\/$/.test(path)) return reply(route, record.project)
    const resource = [['/analytics/commercial-dashboard/', 'commercial'], ['/analytics/cost-kpis/', 'kpis'], ['/reporting-periods/', 'periods'], ['/integrated-snapshots/', 'snapshots'], ['/cost-ledger/', 'ledger'], ['/projects/tasks/', 'tasks'], ['/projects/milestones/', 'milestones'], ['/change-events/', 'changes'], ['/wbs-nodes/', 'wbsNodes'], ['/budget-allocations/', 'budgets']].find(([suffix]) => path.endsWith(suffix))
    if (resource) return reply(route, ['commercial', 'kpis'].includes(resource[1]) ? record[resource[1]] : pageOf(record[resource[1]]))
    if (['/control-accounts/', '/approved-hours/', '/estimates/'].some(suffix => path.endsWith(suffix))) return reply(route, pageOf([]))
    state.unknown.push(path)
    return reply(route, { detail: 'Endpoint not configured in Documents browser fixture.' }, 404)
  })
  await page.goto('/projects?' + (options.query || 'project=17&view=documents&shell=true'))
  return state
}
