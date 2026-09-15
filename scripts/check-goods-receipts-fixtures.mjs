// Synthetic receipt/PO records for isolated browser checks; no production identifiers or files.
export const RECEIPT_CHECK_TIME = '2026-09-14T09:00:00.000Z';
export const receiptUser = { id: 7001, first_name: 'Alex', last_name: 'Morgan', email: 'alex.morgan@example.test', is_superuser: true, is_staff: true, roles: [{ code: 'super_admin', name: 'Super Administrator' }] };
export const receiptId = number => `10000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
export const orderId = number => `20000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
const suppliers = ['Northshore Industrial', 'Atlas Equipment', 'Gulf Valve Services', 'Orion Instruments'];
const statuses = ['pending', 'pending', 'accepted', 'pending', 'partial', 'pending', 'rejected'];
const labels = { pending: 'Pending Inspection', accepted: 'Accepted', partial: 'Partially Accepted', rejected: 'Rejected' };

export function receiptOrders() {
  return Array.from({ length: 8 }, (_, index) => ({
    id: orderId(501 + index), po_number: `PO-SYN-${501 + index}`, title: ['Valve replacement package', 'Electrical distribution upgrade', 'Pressure instrument supply', 'Mechanical installation materials'][index % 4],
    vendor_name: suppliers[index % 4], vendor: `30000000-0000-4000-8000-${String(701 + index % 4).padStart(12, '0')}`, status: index % 2 ? 'acknowledged' : 'sent', currency: index % 3 ? 'AED' : 'USD', total_amount: '2100.00', delivery_date: '2026-09-18',
    items: [{ id: `40000000-0000-4000-8000-${String(901 + index).padStart(12, '0')}`, line_number: 1, description: 'Industrial isolation valve', quantity: '10.00', unit: 'EA', unit_price: '200.00', total_price: '2000.00' }],
    project: null, project_name: '', project_code: '', delivery_location: '',
  }));
}

export function receiptRows() {
  const orders = receiptOrders();
  return Array.from({ length: 16 }, (_, index) => {
    const number = 301 + index, status = statuses[index % statuses.length], order = orders[index % orders.length], inspected = status !== 'pending';
    const required = index % 4 ? ['MTC'] : [], declared = inspected ? ['MTC'] : [], assessed = required.length > 0;
    return {
      id: receiptId(number), receipt_number: `GRN-SYN-${number}`, purchase_order: order.id, po_number: order.po_number,
      vendor_id: order.vendor, vendor_name: order.vendor_name, project_id: index % 3 ? `core:${81 + index % 3}` : null, project_number: index % 3 ? `RAD-SYN-${81 + index % 3}` : '', project_name: index % 3 ? ['Water infrastructure', 'Industrial power', 'Process upgrade'][index % 3] : '', project_source: index % 3 ? 'core' : null, po_category: index % 2 ? 'instrumentation' : 'mechanical', required_certifications: required, heat_numbers_required: index % 3 === 1, ndt_requirements: index % 4 === 3 ? 'Radiographic testing' : '',
      evidence: { certificates: { status: assessed ? declared.length ? 'recorded' : 'missing' : 'unassessed', required, received: declared, missing: assessed && !declared.length ? required : [], required_count: assessed ? required.length : null, received_count: declared.length, matched_count: assessed ? declared.length : null, reason: assessed ? 'Compared recorded declarations to purchase-order requirements.' : 'No certificate requirement has been recorded.' }, traceability: { required: index % 3 === 1, heat_numbers: inspected ? [`HEAT-SYN-${number}`] : [], count: inspected ? 1 : 0, status: inspected ? 'recorded' : index % 3 === 1 ? 'missing' : 'not_required', reason: index % 3 === 1 ? 'Heat numbers are required by the purchase order.' : 'No heat-number requirement recorded.' }, ndt: { performed: false, results_recorded: false, status: index % 4 === 3 ? 'not_recorded' : 'unassessed', requirement_status: index % 4 === 3 ? 'required' : 'unassessed', reason: index % 4 === 3 ? 'Required NDT results are not recorded.' : 'No NDT requirement recorded.' } },
      capabilities: { update: true, accept: status === 'pending', reject: status === 'pending', export: true },
      receipt_date: `2026-09-${String(14 - index % 12).padStart(2, '0')}`, received_by: 7001, received_by_name: 'Alex Morgan', status, status_display: labels[status],
      items_received: [{ po_line_id: order.items[0].id, line_number: 1, item: order.items[0].description, uom: 'EA', ordered_qty: '10.00', received_qty: '8.00', accepted_qty: inspected ? status === 'rejected' ? '0.00' : status === 'partial' ? '6.00' : '8.00' : null, rejected_qty: status === 'rejected' ? '8.00' : status === 'partial' ? '2.00' : '0.00' }],
      quality_check_passed: status !== 'rejected', visual_inspection_passed: true, dimensional_check_passed: status !== 'partial', material_verification_passed: true,
      inspection_notes: inspected ? 'Recorded synthetic inspection results for browser verification.' : '', certificates_received: inspected ? ['MTC'] : [], heat_numbers: inspected ? [`HEAT-SYN-${number}`] : [], inspector_name: inspected ? 'Jordan Lee' : '', inspection_agency: inspected ? 'Synthetic Inspection Services' : '', inspection_report_number: inspected ? `IR-SYN-${number}` : '', ndt_performed: false, ndt_results: '',
      delivery_note_number: `DN-SYN-${number}`, notes: index === 0 ? 'Verify quantities against the purchase order before acceptance.' : '', attachments: [],
      created_at: `2026-09-${String(14 - index % 12).padStart(2, '0')}T08:00:00Z`, updated_at: RECEIPT_CHECK_TIME,
    };
  });
}

export function receiptFixture(variant = 'full') {
  const rows = receiptRows(), orders = receiptOrders();
  if (variant === 'empty') return { rows: [], orders };
  if (variant === 'missing') return { rows: [{ ...rows[0], items_received: [], received_by_name: null, delivery_note_number: '', attachments: null }], orders: [] };
  if (variant === 'zero') return { rows: [{ ...rows[0], items_received: [{ item: 'Recorded zero receipt line', ordered_qty: '10.00', received_qty: '0.00', accepted_qty: '0.00', rejected_qty: '0.00', uom: 'EA' }] }], orders };
  if (variant === 'mixed_units') return { rows: [{ ...rows[0], items_received: [...rows[0].items_received, { item: 'Control cable', ordered_qty: '100.00', received_qty: '12.50', accepted_qty: '12.25', rejected_qty: '0.25', uom: 'm' }] }], orders };
  if (variant === 'malformed_detail') return { rows: [{ ...rows[0], items_received: [null, { item: { unexpected: 'object' }, ordered_qty: {}, received_qty: [], uom: {} }], heat_numbers: [null, { unexpected: 'object' }], certificates_received: [null, { unexpected: 'object' }] }], orders };
  if (variant === 'attachments') return { rows: [{ ...rows[0], attachments: [1, 2, 3].map(id => ({ id, name: `Receipt evidence ${id}.pdf`, file_url: `https://files.example.test/receipt-${id}.pdf` })) }], orders };
  if (variant === 'no_po_access') return { rows, orders, capabilities: { create: true, update: true, approve: true, export: true, read_purchase_orders: false } };
  if (variant === 'create_only') return { rows: rows.map(row => ({ ...row, capabilities: { ...row.capabilities, accept: false, reject: false } })), orders, capabilities: { create: true, update: true, approve: false, export: true, read_purchase_orders: true } };
  if (variant === 'readonly') return { rows: rows.map(row => ({ ...row, capabilities: { update: false, accept: false, reject: false, export: false } })), orders, capabilities: { create: false, update: false, approve: false, export: false } };
  if (variant === 'error' || variant === 'forbidden') return { rows: [], orders: [], failure: variant === 'forbidden' ? 403 : 503 };
  return { rows, orders };
}

export function inReceiptQueue(row, queue) {
  const failed = row.status === 'rejected' || ['quality_check_passed', 'visual_inspection_passed', 'dimensional_check_passed', 'material_verification_passed'].some(key => row[key] === false);
  const missing = row.evidence?.certificates?.status === 'missing', traceability = row.evidence?.traceability?.status === 'missing', ndt = row.evidence?.ndt?.status === 'not_recorded' && row.evidence?.ndt?.requirement_status === 'required';
  return ({ all: true, pending: row.status === 'pending', exceptions: failed, accepted: row.status === 'accepted', rejected: row.status === 'rejected', partial: row.status === 'partial', ndt_pending: ndt, missing_certificates: missing, traceability_gaps: traceability })[queue] ?? false;
}
export function filterReceiptRows(rows, params) {
  const value = key => params.get(key) || '';
  let result = rows.filter(row => {
    if (value('queue') && !inReceiptQueue(row, value('queue'))) return false;
    for (const [param, key] of [['status', 'status'], ['vendor', 'vendor_id'], ['project', 'project_id'], ['inspector', 'inspector_name'], ['category', 'po_category']]) if (value(param) && row[key] !== value(param)) return false;
    const failed = row.status === 'rejected' || ['quality_check_passed', 'visual_inspection_passed', 'dimensional_check_passed', 'material_verification_passed'].some(key => row[key] === false);
    if (value('quality_check') === 'failed' && !failed) return false;
    if (value('quality_check') === 'passed' && !(row.status === 'accepted' && row.quality_check_passed === true && !failed)) return false;
    if (value('quality_check') === 'pending' && !(row.status === 'pending' && !failed)) return false;
    if (value('received_from') && row.receipt_date < value('received_from')) return false;
    if (value('received_to') && row.receipt_date > value('received_to')) return false;
    if (value('search') && ![row.receipt_number, row.po_number, row.delivery_note_number, row.vendor_name, row.project_number, row.project_name, row.inspector_name].join(' ').toLowerCase().includes(value('search').toLowerCase())) return false;
    return true;
  });
  const fields = [value('ordering') || '-created_at', 'id'];
  result = result.toSorted((a, b) => { for (const field of fields) { const key = field.replace(/^-/, ''), compared = String(a[key] ?? '').localeCompare(String(b[key] ?? ''), 'en', { numeric: true }); if (compared) return field.startsWith('-') ? -compared : compared; } return 0; });
  return result;
}

export function receiptSummary(rows, params = new URLSearchParams()) {
  const unqueued = new URLSearchParams(params); unqueued.delete('queue');
  const scope = filterReceiptRows(rows, unqueued), filtered = filterReceiptRows(rows, params);
  const counts = Object.fromEntries(['all', 'pending', 'exceptions', 'accepted', 'rejected', 'ndt_pending', 'partial', 'missing_certificates', 'traceability_gaps'].map(queue => [queue, scope.filter(row => inReceiptQueue(row, queue)).length]));
  const metric = (value, definition, extra = {}) => ({ status: value === null ? 'unavailable' : 'available', value, definition, ...extra });
  const dispositions = counts.accepted + counts.partial + counts.rejected;
  const assessed = scope.filter(row => row.evidence.certificates.status !== 'unassessed').length;
  const traceability = scope.filter(row => row.evidence.traceability.required === true);
  const options = (key, label, keys = {}) => [...new Set(scope.map(row => row[key]).filter(Boolean))].map(id => ({ id, [label]: scope.find(row => row[key] === id)[keys.label || label], count: scope.filter(row => row[key] === id).length, ...(keys.number ? { number: scope.find(row => row[key] === id)[keys.number] } : {}) }));
  return {
    schema_version: '1.0', status: 'available', generated_at: RECEIPT_CHECK_TIME, as_of_date: '2026-09-14', selected_queue: params.get('queue') || 'all', filtered_count: filtered.length, counts,
    source_updated_at: rows.length ? RECEIPT_CHECK_TIME : null, source_timestamp_kind: 'record_updated_at',
    capabilities: { create: true, update: true, approve: true, export: true, read_purchase_orders: true },
    kpis: {
      receipts_this_month: metric(scope.filter(row => row.receipt_date >= '2026-09-01' && row.receipt_date <= '2026-09-14').length, 'Receipts dated from the start of this month through today.', { period_start: '2026-09-01', period_end: '2026-09-14' }),
      open_inspections: metric(counts.pending, 'Receipts with a recorded pending inspection disposition.'),
      missing_certificates: metric(assessed ? counts.missing_certificates : null, 'Receipts missing at least one certificate required by a recorded purchase-order declaration.', { status: assessed ? assessed < scope.length ? 'partial' : 'available' : 'unavailable', assessed_count: assessed, unassessed_count: scope.length - assessed }),
      acceptance_rate: metric(dispositions ? counts.accepted / dispositions * 100 : null, 'Accepted receipts divided by accepted, partially accepted and rejected receipts.', { numerator: counts.accepted, denominator: dispositions }),
      traceability_coverage: metric(traceability.length ? traceability.filter(row => row.evidence.traceability.status === 'recorded').length / traceability.length * 100 : null, 'Recorded heat numbers among receipts with a known traceability requirement.'),
    },
    filter_options: { vendors: options('vendor_id', 'name', { label: 'vendor_name' }), projects: options('project_id', 'name', { label: 'project_name', number: 'project_number' }), inspectors: [...new Set(scope.map(row => row.inspector_name).filter(Boolean))].map(value => ({ value, count: scope.filter(row => row.inspector_name === value).length })), truncated: { vendors: false, projects: false, inspectors: false } },
  };
}
