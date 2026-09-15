import { formatRegisterMoney } from './procurementRegisterModel.js';

const DAY = 86400000;
const NOT_RECORDED = 'Not recorded';
const COMPLETE = new Set(['approved', 'complete', 'completed']);
const REVIEW = new Set(['submitted', 'in_review']);
const PENDING = new Set(['pending', 'in_review', 'under_review']);
const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const rows = value => Array.isArray(value) ? value.filter(item => item && typeof item === 'object' && !Array.isArray(item)) : [];
const text = value => typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
const first = (...values) => values.map(text).find(Boolean) || '';
const number = value => {
  const input = text(value);
  return /^[-+]?\d+(?:\.\d+)?$/.test(input) && Number.isFinite(Number(input)) ? Number(input) : null;
};

// Lifecycle duration needs a recorded timestamp, not a date guessed from an import or an update.
function timestamp(value) {
  const input = text(value);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/.test(input)) return null;
  const [year, month, day] = input.slice(0, 10).split('-').map(Number);
  const calendar = new Date(Date.UTC(year, month - 1, day));
  if (calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day) return null;
  const parsed = new Date(input).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function stepKinds(step) {
  const original = object(step.raw);
  const identity = [step.label, original.stage, original.role].map(text).join(' ').toLowerCase();
  return {
    technical: /\b(?:technical|engineering)\b/.test(identity),
    commercial: /\b(?:commercial|financial|finance)\b/.test(identity),
  };
}

function reviewGroups(record) {
  const steps = rows(record.approvalSteps);
  return {
    technical: steps.filter(step => stepKinds(step).technical),
    commercial: steps.filter(step => stepKinds(step).commercial),
    steps,
  };
}

function groupState(steps) {
  if (!steps.length) {
    return { state: 'unknown', tone: 'muted', value: NOT_RECORDED, date: null };
  }
  if (steps.some(step => ['rejected', 'not_approved'].includes(text(step.status).toLowerCase()))) {
    const rejected = steps.find(step => ['rejected', 'not_approved'].includes(text(step.status).toLowerCase()));
    return { state: 'rejected', tone: 'red', value: 'Rejected', date: rejected.date || null };
  }
  if (steps.some(step => ['not_recorded', 'unknown', ''].includes(text(step.status).toLowerCase()))) {
    return { state: 'unknown', tone: 'muted', value: NOT_RECORDED, date: null };
  }
  if (steps.every(step => COMPLETE.has(text(step.status).toLowerCase()))) {
    const dated = steps.filter(step => timestamp(step.date) !== null).sort((left, right) => timestamp(right.date) - timestamp(left.date));
    return { state: 'complete', tone: 'green', value: 'Approved', date: dated[0]?.date || null };
  }
  if (steps.some(step => step.active && PENDING.has(text(step.status).toLowerCase()))) {
    return { state: 'active', tone: 'blue', value: 'In review', date: null };
  }
  if (steps.every(step => PENDING.has(text(step.status).toLowerCase()) || COMPLETE.has(text(step.status).toLowerCase()))) {
    return { state: 'pending', tone: 'muted', value: 'Pending', date: null };
  }
  return { state: 'unknown', tone: 'muted', value: NOT_RECORDED, date: null };
}

function recordedSavings(pricing) {
  const register = object(pricing.procurement_register);
  const budget = number(pricing.budget_in_aed) ?? number(register['Budget in AED']);
  const cost = number(register['Final Negotiated price in AED'])
    ?? number(pricing.amount_excl_vat_aed) ?? number(register['Amount Excl VAT in AED']);
  if (budget !== null && budget > 0 && cost !== null && cost >= 0) {
    const difference = Math.round((budget - cost) * 100) / 100;
    const percentage = Math.round(difference / budget * 1000) / 10;
    return `${formatRegisterMoney(difference, 'AED')} (${percentage}%)`;
  }
  const source = text(register['%Savings from Budget']);
  // Spreadsheet percentage cells may be exported as fractions. Preserve their
  // source value instead of inventing a factor of 100 or an exchange rate.
  if (/^[-+]?\d+(?:\.\d+)?\s*%?$/.test(source)) return `${source} (source)`;
  return NOT_RECORDED;
}

function lifecycle(record, groups) {
  const raw = object(record.raw);
  const status = text(record.status || raw.status).toLowerCase();
  const unknown = { state: 'unknown', tone: 'muted', value: NOT_RECORDED, date: null };
  const pending = { state: 'pending', tone: 'muted', value: 'Pending', date: null };
  const submitted = timestamp(raw.submitted_at);
  const approvalTimestamp = timestamp(raw.approved_at);
  const hasDecisions = groups.steps.length > 0 && groups.steps.every(step => COMPLETE.has(text(step.status).toLowerCase()));
  let draft = unknown;
  if (status === 'draft') draft = { state: 'active', tone: 'blue', value: 'Draft', date: raw.created_at || null };
  else if (submitted !== null || REVIEW.has(status)) draft = { state: 'complete', tone: 'green', value: 'Submitted', date: submitted !== null ? raw.submitted_at : null };
  let approved = unknown;
  if (status === 'approved' || status === 'converted' && (approvalTimestamp !== null || hasDecisions)) {
    approved = { state: 'complete', tone: 'green', value: 'Approved', date: approvalTimestamp !== null ? raw.approved_at : null };
  } else if (status === 'rejected') approved = { state: 'rejected', tone: 'red', value: 'Not approved', date: null };
  else if (status === 'draft' || REVIEW.has(status)) approved = pending;
  let conversion = unknown;
  if (record.linkedPoId || raw.linked_po_id || status === 'converted') {
    conversion = { state: 'complete', tone: 'green', value: 'Converted', date: timestamp(raw.converted_at) !== null ? raw.converted_at : null };
  } else if (raw.po_applicable === false) conversion = { ...unknown, value: 'Not applicable' };
  else if (record.poReference) conversion = { ...unknown, value: 'Reference recorded' };
  else if (record.readyForPO) conversion = { state: 'active', tone: 'blue', value: 'Ready for PO', date: null };
  else if (status === 'draft' || REVIEW.has(status) || status === 'approved') conversion = pending;
  return [
    { key: 'draft', label: 'Draft', ...draft },
    { key: 'technical', label: 'Technical review', ...groupState(groups.technical) },
    { key: 'commercial', label: 'Commercial review', ...groupState(groups.commercial) },
    { key: 'approved', label: 'Approved', ...approved },
    { key: 'conversion', label: 'PO conversion', ...conversion },
  ];
}

/** Fixed screenshot slots, with values limited to what the recommendation records. */
export function recommendationPresentation(record = {}) {
  const raw = object(record.raw);
  const pricing = object(raw.price_remarks_data);
  const groups = reviewGroups(record);
  const quotes = rows(pricing.comparative_prices).filter(quote => first(quote.vendor, quote.vendor_name)
    && number(quote.price ?? quote.amount) !== null && number(quote.price ?? quote.amount) >= 0);
  const justification = text(raw.single_source_justification);
  const linkedSupplier = Boolean(raw.vendor || object(raw.vendor_details).id);
  const supplier = first(raw.vendor_name, object(raw.vendor_details).name, raw.supplier_name, raw.preferred_supplier_if_any);
  const need = first(raw.description_reason, raw.product_service, raw.title);
  const items = rows(raw.items);
  const validItems = items.length > 0 && items.every(item => first(item.description, item.item, item.name)
    && number(item.quantity ?? item.qty) !== null && number(item.quantity ?? item.qty) > 0);
  const scope = validItems ? { value: 'Recorded', ready: true }
    : items.length > 0 ? { value: 'Quantity needs review', ready: false }
      : { value: need ? 'Quantity not recorded' : NOT_RECORDED, ready: null };
  const commercial = groupState(groups.commercial);
  const commercialReadiness = commercial.state === 'complete' ? { value: 'Review approved', ready: true }
    : commercial.state === 'rejected' ? { value: 'Review rejected', ready: false }
      : ['active', 'pending'].includes(commercial.state) ? { value: commercial.state === 'active' ? 'In review' : 'Review pending', ready: false }
        : { value: NOT_RECORDED, ready: null };
  const auditStatus = text(object(raw.vendor_details).audit_status);
  return {
    decisionLeft: [
      ['Need', need || NOT_RECORDED],
      ['Sourcing method', justification ? 'Single-source justification recorded' : NOT_RECORDED],
      ['Quotes evaluated', quotes.length ? `${quotes.length} ${quotes.length === 1 ? 'price' : 'prices'} recorded` : NOT_RECORDED],
      ['Selected supplier', supplier ? linkedSupplier ? supplier : `Proposed: ${supplier}` : NOT_RECORDED],
    ],
    decisionRight: [
      ['Selection reason', first(raw.vendor_selection_reason, raw.purchase_recommendation, justification) || NOT_RECORDED],
      ['Savings vs budget', recordedSavings(pricing)],
      ['Budget code', text(pricing.budget_allocation) || NOT_RECORDED],
      ['Funding status', NOT_RECORDED],
    ],
    readiness: [
      { label: 'Scope & quantity', ...scope },
      { label: 'Supplier compliance', value: auditStatus ? `Audit: ${auditStatus}` : NOT_RECORDED, ready: null },
      { label: 'Commercial evaluation', ...commercialReadiness },
      { label: 'Budget validation', value: NOT_RECORDED, ready: null },
      { label: 'Required attachments', value: NOT_RECORDED, ready: null },
      { label: 'Conflict declaration', value: NOT_RECORDED, ready: null },
    ],
    lifecycle: lifecycle(record, groups),
  };
}

/** Count only recorded events and explicitly classified active review stages. */
export function recommendationWorkload(records = [], now = new Date()) {
  const current = now instanceof Date ? now : new Date(now);
  const asOf = current.getTime();
  const durations = [];
  let approvalCycleMissingCount = 0;
  let convertedKnownThisMonth = 0;
  let conversionDateMissingCount = 0;
  let knownTechnicalReviewCount = 0;
  let knownCommercialReviewCount = 0;
  let unclassifiedReviewCount = 0;
  for (const record of records) {
    const raw = object(record.raw);
    const status = text(record.status || raw.status).toLowerCase();
    if (['approved', 'converted'].includes(status)) {
      const submission = timestamp(raw.submitted_at);
      const approval = timestamp(raw.approved_at);
      if (submission !== null && approval !== null && approval >= submission && approval <= asOf) durations.push((approval - submission) / DAY);
      else approvalCycleMissingCount += 1;
    }
    if (status === 'converted' || record.linkedPoId || raw.linked_po_id) {
      const converted = timestamp(raw.converted_at);
      if (converted === null || converted > asOf) conversionDateMissingCount += 1;
      else {
        const date = new Date(converted);
        if (date.getFullYear() === current.getFullYear() && date.getMonth() === current.getMonth()) convertedKnownThisMonth += 1;
      }
    }
    if (REVIEW.has(status)) {
      const active = rows(record.approvalSteps).filter(step => step.active && PENDING.has(text(step.status).toLowerCase()));
      if (!active.length || active.some(step => !stepKinds(step).technical && !stepKinds(step).commercial)) unclassifiedReviewCount += 1;
      if (active.some(step => stepKinds(step).technical)) knownTechnicalReviewCount += 1;
      if (active.some(step => stepKinds(step).commercial)) knownCommercialReviewCount += 1;
    }
  }
  durations.sort((left, right) => left - right);
  const midpoint = Math.floor(durations.length / 2);
  const median = durations.length ? durations.length % 2 ? durations[midpoint] : (durations[midpoint - 1] + durations[midpoint]) / 2 : null;
  return {
    medianCycleDays: median === null ? null : Math.round(median * 10) / 10,
    convertedThisMonth: conversionDateMissingCount ? null : convertedKnownThisMonth,
    technicalReviewCount: unclassifiedReviewCount ? null : knownTechnicalReviewCount,
    commercialReviewCount: unclassifiedReviewCount ? null : knownCommercialReviewCount,
    approvalCycleSampleSize: durations.length, approvalCycleMissingCount,
    conversionDateMissingCount, convertedKnownThisMonth,
    knownTechnicalReviewCount, knownCommercialReviewCount, unclassifiedReviewCount,
  };
}
