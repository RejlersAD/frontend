import { Buffer } from 'node:buffer'
import { recommendationHarness, recommendationId, recommendationNumber } from './purchase-recommendations.fixture'

export const missingImportNumber = 'RAD-PRJ-PR-9002_2026'
export const existingImportNumber = recommendationNumber(2)
export const syntheticApprovedPdf = {
  name: 'approved-pr-synthetic.pdf', mimeType: 'application/pdf',
  buffer: Buffer.from('%PDF-1.4\n% Synthetic fixture; no business PDF or live OCR is used.\n%%EOF'),
}

const reply = (route, body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })

function multipartFields(request) {
  const boundary = request.headers()['content-type'].match(/boundary=(?:"([^"]+)"|([^;]+))/)?.slice(1).find(Boolean)
  if (!boundary) throw new Error('The PDF import must send multipart/form-data.')
  const fields = {}
  for (const part of request.postDataBuffer().toString('utf8').split(`--${boundary}`)) {
    const name = part.match(/name="([^"]+)"/)?.[1]
    if (!name) continue
    const filename = part.match(/filename="([^"]+)"/)?.[1]
    fields[name] = filename ? { filename } : part.split('\r\n\r\n').slice(1).join('\r\n\r\n').replace(/\r\n$/, '')
  }
  return fields
}

export async function recommendationPdfImportHarness(page, options = {}) {
  // The existing harness intercepts every App API request before navigation.
  // These later, specific handlers intercept multipart imports before its JSON
  // request parser, with all preview/save behavior confined to synthetic state.
  const state = await recommendationHarness(page, { realApp: true, prepare: options.prepare })
  Object.assign(state, {
    importRequests: [], previewRequests: [], saveRequests: [], numberChecks: [],
    importNumber: options.extracted?.pr_number || (options.existing ? existingImportNumber : missingImportNumber),
    saveError: null, savePending: null, deferSave: false,
    linkRequests: [], linkError: null,
  })
  await page.route('**/api/v1/procurement/orders/?*', async route => {
    if (!options.poOptions) return route.fallback()
    state.requests.push({ path: new URL(route.request().url()).pathname, method: 'GET' })
    return reply(route, { results: options.poOptions, next: null, count: options.poOptions.length })
  })
  await page.route('**/api/v1/procurement/requisitions/*/link-purchase-order/', async route => {
    const body = route.request().postDataJSON()
    state.linkRequests.push(body)
    state.requests.push({ path: new URL(route.request().url()).pathname, method: 'POST', body })
    if (state.linkError) return reply(route, { error: state.linkError }, 409)
    const order = (options.poOptions || []).find(row => String(row.id) === String(body.purchase_order_id))
    if (!order) return reply(route, { error: 'Purchase order not found.' }, 404)
    const id = new URL(route.request().url()).pathname.split('/').at(-3)
    const poLink = { status: 'linked', po_id: order.id, po_number: order.po_number, manual_link_required: false }
    const row = state.props.requisitions.find(item => item.id === id)
    if (row) { row.linked_po_id = order.id; row.price_remarks_data = { ...row.price_remarks_data, po_link: poLink }; state.details[id] = row }
    return reply(route, { requisition_id: id, po_link: poLink })
  })
  await page.route('**/api/v1/procurement/requisitions/check_pr_number/', async route => {
    const body = route.request().postDataJSON()
    state.numberChecks.push(body)
    state.requests.push({ path: new URL(route.request().url()).pathname, method: 'POST', body })
    return reply(route, { exists: state.props.requisitions.some(row => row.pr_number === body.pr_number) })
  })
  await page.route('**/api/v1/procurement/requisitions/import-signed-pdf/', async route => {
    const body = multipartFields(route.request())
    state.importRequests.push(body)
    state.requests.push({ path: new URL(route.request().url()).pathname, method: 'POST', body })
    const extracted = {
      pr_number: state.importNumber, issued_by_name: 'Maya Hassan', issued_date: '2026-09-15',
      product_service: 'Synthetic imported pump package', supplier_name: 'Atlas Industrial Supplies',
      project_department: 'Engineering', project_number: '5900985',
      description_reason: 'Pump package for the approved synthetic engineering scope.',
      preferred_supplier: 'Atlas Industrial Supplies', net_total: '12500.00', currency: 'AED',
      field_confidence: { pr_number: 'high', issued_by: 'high', supplier: 'high', price: 'high' },
      ...(options.extracted || {}),
    }
    const approvalDetection = {
      signatures: { pm: false, moe: false, mop: false, vp: false },
      approver_names: {}, approval_date: '',
      ...(options.approvalDetection || {}),
    }
    if (body.preview_only === 'true') {
      state.previewRequests.push(body)
      return reply(route, {
        success: true, preview_only: true, pr_number: extracted.pr_number,
        database_match: state.props.requisitions.some(row => row.pr_number === extracted.pr_number),
        extracted_data: extracted, approval_detection: approvalDetection,
        document_signed_off: Boolean(options.documentSignedOff),
        document_comparison: options.documentComparison,
        requires_manual_review: true, mapping_issues: options.mappingIssues || [], workflow_issues: [],
      })
    }
    state.saveRequests.push(body)
    if (state.deferSave) await new Promise(resolve => { state.savePending = resolve })
    if (state.saveError) return reply(route, state.saveError.body, state.saveError.status || 400)
    const overrides = JSON.parse(body.manual_overrides || '{}')
    const number = body.expected_pr_number || overrides.pr_number || extracted.pr_number
    const previous = state.props.requisitions.find(row => row.pr_number === number)
    const record = {
      ...(previous || state.props.requisitions[0]), id: previous?.id || recommendationId(9002),
      pr_number: number, product_service: body.attach_only === 'true' ? previous.product_service : overrides.product_service || extracted.product_service,
      status: previous?.status === 'converted' ? 'converted' : options.documentSignedOff || previous ? 'approved' : 'draft', total_price: body.attach_only === 'true' ? previous.total_price : overrides.net_total || extracted.net_total,
      attachments: options.savedAttachments || [{ filename: syntheticApprovedPdf.name, s3_key: 'synthetic-only/approved-pr.pdf' }],
      ...(options.savedVerification ? { price_remarks_data: { ...(previous?.price_remarks_data || {}), signed_document_verification: options.savedVerification } } : {}),
    }
    state.details[record.id] = record
    state.props.requisitions = previous
      ? state.props.requisitions.map(row => row.id === previous.id ? record : row)
      : [...state.props.requisitions, record]
    return reply(route, {
      success: true, pr_number: number, status: record.status, created: !previous,
      requisition_id: record.id, approval_detection: approvalDetection,
      document_signed_off: Boolean(options.documentSignedOff), po_link: options.poLink,
      mapping_issues: [], workflow_issues: [],
    }, previous ? 200 : 201)
  })
  return state
}
