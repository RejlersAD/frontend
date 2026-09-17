import { Buffer } from 'node:buffer'
import { recommendationPdfImportHarness, missingImportNumber } from './purchase-recommendation-pdf-import.fixture'
import { recommendationId } from './purchase-recommendations.fixture'

const syntheticPdf = text => {
  const stream = `BT /F1 16 Tf 40 740 Td (${text}) Tj ET`
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>', `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>']
  let pdf = '%PDF-1.4\n'
  const offsets = []
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${index + 1} 0 obj\n${object}\nendobj\n` })
  const xref = Buffer.byteLength(pdf)
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map(value => `${String(value).padStart(10, '0')} 00000 n `).join('\n')}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  return Buffer.from(pdf)
}
export const syntheticApprovedPdf = { name: 'approved-pr-paired.pdf', mimeType: 'application/pdf', buffer: syntheticPdf('SIGNED PR SOURCE - Synthetic fixture only') }
export const syntheticPoPdf = { name: 'approved-po-paired.pdf', mimeType: 'application/pdf', buffer: syntheticPdf('SIGNED PO SOURCE - Independent synthetic fixture') }
export const pairedPoNumber = 'RAD-PRJ-PUR-9002_SEP2026'
const reply = (route, body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })

function multipartFields(request) {
  const boundary = request.headers()['content-type'].match(/boundary=(?:"([^"]+)"|([^;]+))/)?.slice(1).find(Boolean)
  if (!boundary) throw new Error('Paired import must use multipart/form-data.')
  const result = {}
  for (const part of request.postDataBuffer().toString('utf8').split(`--${boundary}`)) {
    const name = part.match(/name="([^"]+)"/)?.[1]
    if (!name) continue
    const filename = part.match(/filename="([^"]+)"/)?.[1]
    const content = part.split('\r\n\r\n').slice(1).join('\r\n\r\n').replace(/\r\n$/, '')
    result[name] = filename ? { filename, content } : content
  }
  return result
}

export async function pairedImportHarness(page, options = {}) {
  const state = await recommendationPdfImportHarness(page, options)
  Object.assign(state, { pairPreviews: [], pairSaves: [], pairWrites: [], pairError: null, pairPreviewError: null, incompleteResponse: false })
  await page.route('**/api/v1/procurement/po-documents/approval-employees/**', route => reply(route, { results: [] }))
  await page.route('**/api/v1/procurement/requisitions/import-signed-pdf/', async route => {
    const body = multipartFields(route.request())
    if (!body.po_file) return route.fallback()
    const extracted = {
      pr_number: state.importNumber || missingImportNumber, issued_by_name: 'Maya Hassan', issued_date: '2026-09-15',
      product_service: 'PR scope from its own PDF', supplier_name: 'PR Supplier Ltd', description_reason: 'PR source justification',
      net_total: '12500.00', currency: 'AED', project_department: 'Engineering', project_number: '5900985',
    }
    const poFields = {
      po_number: pairedPoNumber, vendor_name: 'PO Supplier Ltd', summary: 'PO scope from its own PDF',
      currency: 'USD', total_amount: '9000.00', tax_amount: '0.00', gross_amount: '9000.00', po_date: '2026-09-12', expected_delivery: '2026-10-20',
      vendor_license_no: 'SOURCE-001', seller_email: 'source@example.test', seller_contact_person: 'Source seller contact', seller_phone: '', seller_address: 'Source supplier address', seller_country: '',
    }
    const approval = { signatures: { pm: true, moe: true, mop: true, vp: true }, approver_names: { pm: 'PR Signature Only' }, approval_date: '2026-09-15' }
    if (body.preview_only === 'true') {
      state.pairPreviews.push(body)
      if (state.pairPreviewError) return reply(route, state.pairPreviewError, 422)
      return reply(route, {
        success: true, preview_only: true, pr_number: extracted.pr_number,
        database_match: state.props.requisitions.some(row => row.pr_number === extracted.pr_number),
        extracted_data: extracted, approval_detection: approval, document_signed_off: true,
        mapping_issues: [], workflow_issues: [],
        po_preview: { extracted_data: poFields, reconciliation_issues: [], approval_evidence: {
          signature_detected: true, stamp_detected: true, approved_by_name: 'PO Approver Only', approved_by_title: 'PO Director', approved_date: '2026-09-12', issues: [],
        } },
      })
    }
    state.pairSaves.push(body)
    if (state.pairError) return reply(route, state.pairError.body, state.pairError.status)
    const fields = JSON.parse(body.manual_overrides || '{}')
    const reviewedPo = JSON.parse(body.po_reviewed_fields || '{}')
    const number = body.expected_pr_number || fields.pr_number || extracted.pr_number
    const previous = state.props.requisitions.find(row => row.pr_number === number)
    const prId = previous?.id || recommendationId(9002)
    const poId = recommendationId(9102)
    const poLink = { status: 'linked', po_id: poId, po_number: reviewedPo.po_number || pairedPoNumber, manual_link_required: false }
    const response = {
      success: true, created: !previous, requisition_id: prId, pr_number: number, status: 'converted',
      document_signed_off: true, approval_detection: approval, po_link: poLink, purchase_order_id: poId,
      purchase_order: { purchase_order_id: poId, po_number: poLink.po_number, pr_id: prId, po_link: poLink, operation: options.poOperation || 'created', reconciliation_issues: options.poIssues || [] }, mapping_issues: [], workflow_issues: [],
    }
    if (state.incompleteResponse) return reply(route, { ...response, purchase_order_id: null, purchase_order: null, po_link: { status: 'not_linked', manual_link_required: true } })
    const record = { ...(previous || state.props.requisitions[0]), ...(body.attach_only ? {} : fields), id: prId, pr_number: number, status: 'converted', linked_po_id: poId, price_remarks_data: { po_link: poLink } }
    state.props.requisitions = previous ? state.props.requisitions.map(row => row.id === prId ? record : row) : [...state.props.requisitions, record]
    state.details[prId] = record
    state.orders.push({ id: poId, ...reviewedPo, po_number: poLink.po_number, pr_reference: prId })
    state.pairWrites.push({ requisition_id: prId, purchase_order_id: poId })
    return reply(route, response, previous ? 200 : 201)
  })
  return state
}
