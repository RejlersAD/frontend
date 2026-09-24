export const RECEIPT_QUEUES = [['all', 'All receipts'], ['pending', 'Awaiting confirmation'], ['exceptions', 'Exceptions'], ['accepted', 'Accepted'], ['rejected', 'Rejected'], ['ndt_pending', 'NDT pending']];
export const RECEIPT_FILTERS = { search: '', status: '', quality_check: '', vendor: '', project: '', received_from: '', received_to: '', inspector: '' };
export const RECEIPT_STATUS = { pending: 'Awaiting confirmation', accepted: 'Accepted', rejected: 'Rejected', partial: 'Partially accepted' };
export const receiptNumber = value => (typeof value === 'number' || typeof value === 'string') && String(value).trim() !== '' && /^[-+]?\d*(?:\.\d+)?$/.test(String(value).trim()) && Number.isFinite(Number(value)) ? Number(value) : null;
export const receiptDate = (value, time = false) => {
  if (!value) return '—';
  const parsed = new Date(time ? value : `${String(value).slice(0, 10)}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleString('en-GB', time ? { dateStyle: 'medium', timeStyle: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' });
};
export const receiptTone = status => ({ accepted: 'green', rejected: 'red', partial: 'amber', pending: 'blue', passed: 'green', failed: 'red', missing: 'amber', recorded: 'green', complete: 'green', unassessed: 'muted' })[status] || 'muted';
export function receiptInspection(receipt) {
  if (['quality_check_passed', 'visual_inspection_passed', 'dimensional_check_passed', 'material_verification_passed'].some(key => receipt[key] === false)) return { label: 'Failed', tone: 'red' };
  if (receipt.confirmation?.confirmed_at) return { label: 'Not assessed', tone: 'muted' };
  if (receipt.status === 'rejected') return { label: 'Failed', tone: 'red' };
  if (receipt.status === 'pending') return { label: 'Not assessed', tone: 'muted' };
  if (receipt.status === 'partial') return { label: 'Partial', tone: 'amber' };
  if (receipt.status === 'accepted' && receipt.quality_check_passed === true && !receipt.confirmation?.confirmed_at) return { label: 'Recorded pass', tone: 'green' };
  return { label: 'Not recorded', tone: 'muted' };
}
export function receiptAge(receipt, asOfDate) {
  const current = asOfDate || new Date().toLocaleDateString('en-CA');
  const then = new Date(`${String(receipt.receipt_date || '').slice(0, 10)}T00:00:00Z`).getTime();
  const today = new Date(`${current}T00:00:00Z`).getTime();
  const days = Number.isFinite(then) && Number.isFinite(today) && today >= then ? Math.floor((today - then) / 86400000) : null;
  const age = days === null ? 'Date not recorded' : days === 0 ? 'Today' : `${days} ${days === 1 ? 'day' : 'days'}`;
  const inspection = receiptInspection(receipt);
  return { label: inspection.tone === 'red' ? 'Action required' : receipt.status === 'accepted' ? 'Accepted' : '', age, tone: inspection.tone === 'red' ? 'red' : receipt.status === 'accepted' ? 'green' : 'amber' };
}
export function receiptDocuments(receipt) {
  const evidence = receipt.evidence?.certificates;
  if (!evidence || !['recorded', 'missing'].includes(evidence.status)) return { label: 'Not assessed', tone: 'muted', note: evidence?.reason || 'Certificate requirements have not been assessed.' };
  const required = receiptNumber(evidence.required_count);
  const received = receiptNumber(evidence.matched_count);
  return { label: required !== null && received !== null ? `${received} of ${required}` : evidence.status === 'not_required' ? 'Not required' : 'Not assessed', tone: receiptTone(evidence.status), note: evidence.definition || 'Recorded certificate declarations compared with purchase order requirements.' };
}
const csvCell = value => { const raw = String(value ?? ''); const safe = /^[\s]*[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw; return `"${safe.replaceAll('"', '""')}"`; };
export function receiptsCsv(rows) {
  const data = [['GR number', 'PO number', 'Supplier', 'Project', 'Received date', 'Delivery note', 'Received by', 'Delivery confirmation by', 'Confirmed by', 'Confirmed at', 'Technical inspector', 'Item lines', 'Receipt status', 'Technical checks', 'Certificates'], ...rows.map(row => [row.receipt_number, row.po_number, row.vendor_name, row.project_number, row.receipt_date, row.delivery_note_number, row.received_by_name, row.confirmation?.responsible_user_name, row.confirmation?.confirmed_by_name, row.confirmation?.confirmed_at, row.inspector_name, Array.isArray(row.items_received) ? row.items_received.length : '', receiptReviewStatus(row).label, receiptInspection(row).label, receiptDocuments(row).label])];
  return '\uFEFF' + data.map(row => row.map(csvCell).join(',')).join('\r\n');
}
export async function loadReceiptPages(list, filters = {}) {
  const rows = []; const ids = new Set(); let expected = null;
  for (let page = 1; page <= 10000; page += 1) {
    const data = await list({ ...filters, page, page_size: 200 });
    if (!Array.isArray(data?.results) || !Number.isInteger(data.count) || data.count < 0) throw new Error('The receipt register returned an invalid response.');
    if (expected === null) expected = data.count;
    if (data.count !== expected) throw new Error('The register changed. Refresh and try again.');
    for (const row of data.results) { if (!row.id || ids.has(String(row.id))) throw new Error('The register returned duplicate records. Refresh and try again.'); ids.add(String(row.id)); rows.push(row); }
    if (rows.length === expected) return rows;
    if (!data.next || !data.results.length || rows.length > expected) throw new Error('The complete receipt register could not be loaded.');
  }
  throw new Error('The register exceeded the supported size.');
}
import { receiptReviewStatus } from './goodsReceiptReviewPresentation.js';
