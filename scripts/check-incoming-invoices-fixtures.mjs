// Synthetic invoice records only. No company, person, invoice or bank data is copied from production.
export const INVOICE_CHECK_TIME = '2026-09-14T08:00:00.000Z';
export const invoiceUser = { id: 601, username: 'alex.morgan', first_name: 'Alex', last_name: 'Morgan', email: 'alex.morgan@example.test', is_staff: true, is_superuser: true, roles: [{ code: 'super_admin', name: 'Super Administrator' }] };
const states = [
  ['procurement_review', 'exception', 'on_hold', 'AED'],
  ['ready_for_matching', 'unmatched', 'not_scheduled', 'AED'],
  ['finance_review', 'manual_matched', 'scheduled', 'USD'],
  ['approved_for_payment', 'verified', 'not_scheduled', 'EUR'],
  ['ocr_review', 'unmatched', 'not_scheduled', 'AED'],
  ['closed', 'verified', 'paid', 'AED'],
  ['rejected', 'exception', 'cancelled', 'USD'],
  ['procurement_review', 'auto_matched', 'partial', 'AED'],
  ['finance_review', 'verified', 'scheduled', 'GBP'],
  ['ready_for_matching', 'unmatched', 'not_scheduled', ''],
  ['approved_for_payment', 'manual_matched', 'not_scheduled', 'AED'],
  ['procurement_review', 'exception', 'on_hold', 'USD'],
];
const invoiceRows = Array.from({ length: 24 }, (_, index) => {
  const id = 101 + index;
  const [procurement_status, match_status, payment_status, currency] = states[index % states.length];
  const day = String(13 - index % 12).padStart(2, '0');
  return {
    id, tracking_id: `AP-2026-${String(id).padStart(5, '0')}`, invoice_number: `INV-SYN-${id}`,
    vendor: 201 + index % 5, vendor_master_name: ['Atlas Technical Supplies LLC', 'Cedar Engineering Services', 'Harbor Instrumentation International', 'Northstar Fabrication and Industrial Maintenance Services', 'Summit Digital Systems'][index % 5],
    vendor_name: ['Atlas Technical Supplies LLC', 'Cedar Engineering Services', 'Harbor Instrumentation International', 'Northstar Fabrication and Industrial Maintenance Services', 'Summit Digital Systems'][index % 5],
    invoice_date: `2026-09-${day}`, received_date: `2026-09-${day}`, due_date: index % 4 === 0 ? '2026-09-12' : index % 4 === 1 ? null : '2026-10-01',
    total_amount: index === 1 ? '0.00' : index === 9 ? null : String((index + 1) * 1267.5), currency,
    invoice_type: 'procurement', invoice_type_display: 'Procurement', status: index === 5 ? 'approved' : 'pending_approval', status_display: index === 5 ? 'Approved' : 'Pending approval',
    procurement_status, match_status, payment_status, manual_review_required: ['ocr_review', 'procurement_review'].includes(procurement_status),
    po_reference_text: index % 3 === 1 ? '' : `PO-SYN-${501 + index}`, created_at: `2026-09-${day}T05:00:00Z`, updated_at: `2026-09-${day}T06:00:00Z`,
  };
});

export function invoiceDetail(row) {
  const allocation = row.po_reference_text ? [{
    id: row.id + 800, purchase_order: row.id + 400, purchase_order_number: row.po_reference_text,
    receipt_numbers: row.match_status === 'exception' ? [] : [`GRN-SYN-${row.id}`], allocated_amount: row.total_amount, currency: row.currency,
    match_method: 'manual', match_status: row.match_status, match_confidence: row.match_status === 'unmatched' ? null : '92.00',
    po_amount_at_match: row.match_status === 'exception' ? '1000.00' : row.total_amount, invoice_amount_at_match: row.total_amount,
    amount_variance: row.match_status === 'exception' ? '267.50' : '0.00', tolerance_percentage: '2.00', amount_within_tolerance: row.match_status !== 'exception',
    vendor_matched: true, currency_matched: true, receipt_required: true,
    exception_codes: row.match_status === 'exception' ? ['amount_exceeds_po_tolerance', 'missing_accepted_receipt'] : [],
    match_evidence: {}, line_items_matched: row.match_status !== 'exception', receipt_quantities_matched: row.match_status !== 'exception',
    review_notes: '', matched_by: 601, matched_at: row.updated_at, verified_by: null, verified_at: null,
  }] : [];
  return {
    ...row, amount: row.total_amount === null ? null : String(Number(row.total_amount) / 1.05), tax_amount: row.total_amount === null ? null : String(Number(row.total_amount) - Number(row.total_amount) / 1.05),
    vat_percentage: '5.00', vat_registration_number: 'SYNTHETIC-VAT-001', payment_terms: '30 days',
    original_filename: `synthetic-invoice-${row.id}.pdf`, file_path: `synthetic/invoices/${row.id}.pdf`, source_file_available: row.id !== 102,
    source_file_sha256: 'a'.repeat(64), ocr_confidence: row.id === 102 ? null : '94.50', ocr_metadata: {},
    structured_line_items: row.id === 102 ? [] : [{ id: row.id + 1000, line_number: 1, description: 'Synthetic engineering equipment package', quantity: '1.00', unit_price: row.total_amount, total_amount: row.total_amount, currency: row.currency, net_amount: row.total_amount, tax_rate: '5.00', tax_amount: '0.00', po_item_reference: '1', manually_verified: true }],
    po_allocations: allocation, approvals: [], audit_logs: [
      { id: row.id + 2000, action: 'imported', description: 'Reviewed invoice recorded.', metadata: {}, timestamp: row.created_at },
      { id: row.id + 3000, action: 'match_evaluated', description: 'Matching evidence reviewed.', metadata: {}, timestamp: row.updated_at },
      { id: row.id + 4000, action: 'document_captured', description: 'Source document captured.', metadata: {}, timestamp: row.created_at },
    ], payment_operations: [],
    procurement_reviewed_by: null, procurement_reviewed_at: null, finance_reviewed_by: null, finance_reviewed_at: null,
    scheduled_payment_date: null, payment_date: null, payment_reference: '', paid_amount: row.payment_status === 'paid' ? row.total_amount : '0.00',
  };
}

export function invoiceFixture(name = 'full') {
  const fixture = { rows: structuredClone(invoiceRows), failure: null, count: null };
  if (name === 'empty') fixture.rows = [];
  if (name === 'zero') fixture.rows = [structuredClone(invoiceRows[1])];
  if (name === 'error') { fixture.failure = 503; fixture.rows = []; }
  if (name === 'restricted') { fixture.failure = 403; fixture.rows = []; }
  if (name === 'partial') { fixture.rows = fixture.rows.slice(0, 15); fixture.count = 48; }
  if (name === 'unknown') fixture.rows = [{ ...structuredClone(invoiceRows[9]), total_amount: null, currency: '', due_date: null }];
  return fixture;
}

export const invoiceImportPreview = {
  source_file_sha256: 'b'.repeat(64), ocr_confidence: 93, warnings: [], extracted_text: 'Synthetic invoice used only for isolated browser verification.', field_confidence: {},
  extracted: { invoice_number: 'INV-SYN-NEW', vendor_name: 'Atlas Technical Supplies LLC', invoice_date: '2026-09-14', due_date: '2026-10-14', amount: '100.00', tax_amount: '5.00', total_amount: '105.00', currency: 'AED', po_reference_text: '', line_items: [] },
  vendor_options: [{ id: 201, name: 'Atlas Technical Supplies LLC', vendor_code: 'SYN-201', vat_registration_number: 'SYNTHETIC-VAT-001' }], purchase_order_options: [], purchase_order_suggestions: [],
};

// Minimal local PDF for the real upload/preview controls; it contains no real invoice data.
export const invoicePdf = '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 200]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n4 0 obj<</Length 68>>stream\nBT /F1 12 Tf 25 150 Td (Synthetic browser fixture invoice) Tj ET\nendstream endobj\n5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF';
