export const receiptReviewText = value => typeof value === 'string' && value.trim() ? value.trim() : null;
export const receiptReviewNumber = value => {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && !/^[+]?(?:\d+\.?\d*|\.\d+)$/.test(value.trim())) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
};
export const receiptReviewQuantity = value => {
  const number = receiptReviewNumber(value);
  return number === null ? '—' : number.toLocaleString('en-GB', { maximumFractionDigits: 20 });
};
export function receiptReviewDate(value, time = false) {
  if (!receiptReviewText(value)) return 'Not recorded';
  const onlyDate = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const date = onlyDate ? new Date(Number(onlyDate[1]), Number(onlyDate[2]) - 1, Number(onlyDate[3]), 12) : new Date(value);
  if (Number.isNaN(date.getTime()) || (onlyDate && (date.getFullYear() !== Number(onlyDate[1]) || date.getMonth() !== Number(onlyDate[2]) - 1 || date.getDate() !== Number(onlyDate[3])))) return 'Not recorded';
  return date.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', ...(time && !onlyDate ? { hour: '2-digit', minute: '2-digit' } : {}) });
}
export function receiptReviewStatus(receipt) {
  const states = { pending: ['Pending inspection', 'pending'], accepted: ['Accepted', 'accepted'], rejected: ['Rejected', 'rejected'], partial: ['Partially accepted', 'partial'] };
  const entry = Object.prototype.hasOwnProperty.call(states, receipt?.status) ? states[receipt.status] : null;
  return entry ? { label: entry[0], tone: entry[1] } : { label: receiptReviewText(receipt?.status_display) || 'Status not recorded', tone: 'unknown' };
}
export const RECEIPT_QUANTITY_FIELDS = [['ordered_qty', 'Ordered'], ['received_qty', 'Received'], ['accepted_qty', 'Accepted'], ['rejected_qty', 'Rejected']];
export function receiptReviewQuantities(receipt) {
  const rows = Array.isArray(receipt?.items_received) ? receipt.items_received.filter(row => row && typeof row === 'object' && !Array.isArray(row)) : [];
  const groups = new Map();
  for (const row of rows) {
    const unit = receiptReviewText(row.uom)?.toUpperCase() || null;
    const key = unit || 'missing-unit';
    if (!groups.has(key)) groups.set(key, { id: key, unit, label: unit || 'Unit not recorded', rows: [], values: {} });
    groups.get(key).rows.push(row);
  }
  for (const group of groups.values()) {
    for (const [field] of RECEIPT_QUANTITY_FIELDS) {
      const values = group.rows.map(row => receiptReviewNumber(row[field]));
      const sum = values.reduce((total, value) => total + (value ?? 0), 0);
      group.values[field] = group.unit && values.every(value => value !== null) && Number.isFinite(sum) ? sum : null;
    }
  }
  return { rows, groups: [...groups.values()] };
}
export function receiptReviewDeclarations(value) {
  if (!Array.isArray(value)) return [];
  return value.map(receiptReviewText).filter(Boolean);
}
export function receiptReviewChecklist(receipt) {
  const flagDetail = value => value === true ? 'Recorded as passed; a verified inspection result is not available.' : value === false ? 'Recorded as not passed; a verified inspection result is not available.' : 'No inspection result is recorded.';
  const flags = [
    ['dimensional', 'Dimensional check', receipt?.dimensional_check_passed],
    ['visual', 'Visual inspection', receipt?.visual_inspection_passed],
    ['material', 'Material verification', receipt?.material_verification_passed],
  ].map(([id, label, value]) => ({ id, label, value: 'Not verified', tone: 'unknown', detail: flagDetail(value) }));
  const certificates = receiptReviewDeclarations(receipt?.certificates_received);
  const certificateEvidence = receipt?.evidence?.certificates;
  flags.push({ id: 'certificates', label: 'Certificates', value: certificateEvidence?.status === 'missing' ? 'Missing declarations' : certificates.length ? `${certificates.length} declared` : 'Not recorded', tone: certificateEvidence?.status === 'missing' ? 'attention' : 'unknown', detail: receiptReviewText(certificateEvidence?.reason) || 'Certificate declarations do not confirm document verification.' });
  const ndtResults = receiptReviewText(receipt?.ndt_results);
  flags.push({ id: 'ndt', label: 'NDT', value: receipt?.evidence?.ndt?.status === 'not_required' ? 'Not required' : ndtResults ? 'Results recorded' : receipt?.ndt_performed === true ? 'Declared performed' : 'Not recorded', tone: 'unknown', detail: receiptReviewText(receipt?.evidence?.ndt?.reason) || 'A recorded NDT declaration or result does not establish inspection approval.' });
  return flags;
}
export function receiptReviewAttachment(attachment, index = 0) {
  const raw = typeof attachment === 'string' ? { filename: attachment, url: attachment } : attachment;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const candidates = [raw.url, raw.s3_url, raw.file_url, raw.file];
  let url = null;
  for (const candidate of candidates) {
    const value = receiptReviewText(candidate);
    if (!value || [...value].some(char => char === '\\' || char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)) continue;
    if (value.startsWith('/') && !value.startsWith('//')) { url = value; break; }
    try { const parsed = new URL(value); if (['http:', 'https:'].includes(parsed.protocol) && !parsed.username && !parsed.password) { url = value; break; } } catch { /* Unavailable document link. */ }
  }
  let name = receiptReviewText(raw.original_filename) || receiptReviewText(raw.filename) || receiptReviewText(raw.name) || receiptReviewText(raw.title);
  if (name && /^(?:https?:|\/)/i.test(name)) name = null;
  return { id: raw.id ?? index, name: name || `Attachment ${index + 1}`, url, uploadedAt: receiptReviewText(raw.uploaded_at) };
}
export function receiptReviewTimeline(receipt) {
  return [
    { id: 'received', label: 'Receipt date', date: receipt?.receipt_date, time: false },
    { id: 'created', label: 'Record created', date: receipt?.created_at, time: true },
    { id: 'updated', label: 'Last updated', date: receipt?.updated_at, time: true },
  ].filter(row => receiptReviewDate(row.date, row.time) !== 'Not recorded');
}
