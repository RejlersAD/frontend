import { decisionText } from '../../utils/salesDecisionTerminology.js';
/**
 * salesBidDecision.js — helpers for the redesigned Record Bid / No-Bid Decision.
 * Traceability: Sales Opportunity lifecycle action `record-bid`.
 * Contract preserved: GO -> `bid`, NO-GO -> `no_bid` for
 * `salesService.recordBidDecision(id, decision, reason)`.
 */

export const GO = 'GO';
export const NO_GO = 'NO_GO';

export const BACKEND_DECISION = { [GO]: 'bid', [NO_GO]: 'no_bid' };

const text = (value) => (typeof value === 'string' ? value.trim() : '');
const num = (value) => {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const businessToday = () => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Dubai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const get = (type) => parts.find((part) => part.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
};

export const displayDate = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return 'Not provided';
  const parsed = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(parsed)) return 'Not provided';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(parsed));
};

export const displayDateTime = (value) => {
  const fallback = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Dubai',
  }).format(new Date());
  if (!value) return fallback;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Dubai',
  }).format(date);
};

export const formatMoney = (value, currency) => {
  const amount = num(value);
  if (amount === null) return 'Not provided';
  const plain = new Intl.NumberFormat('en-AE', { maximumFractionDigits: 0 }).format(amount);
  if (!currency || !/^[A-Z]{3}$/.test(currency)) return `${plain} (currency not provided)`;
  try {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return plain;
  }
};

export const humanize = (value) =>
  String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

export const typeLabel = (value) => {
  const map = {
    EOI: 'EOI',
    BUDGETARY: 'Budgetary',
    TECHNICAL: 'Technical',
    COMMERCIAL: 'Commercial',
    TECHNO_COMMERCIAL: 'Techno-Commercial',
    OTHER: 'Other',
    TENDER: 'Tender',
    RFQ: 'RFQ',
    DIRECT_ENQUIRY: 'Direct Enquiry',
  };
  const key = String(value || '').toUpperCase();
  return map[key] || humanize(value) || 'Not provided';
};

export const stageLabel = (value) => {
  const map = {
    LEAD: 'Open',
    QUALIFIED: 'Qualification',
    PROPOSAL: 'Proposal preparation',
    NEGOTIATION: 'Negotiation',
    AWARDED: 'Awarded',
    CONVERTED: 'Converted to project',
    LOST: 'Lost',
    NO_BID: 'No-Go',
    CANCELLED: 'Cancelled',
  };
  const key = String(value || '').toUpperCase();
  return map[key] || humanize(value) || 'Not provided';
};

export const daysToDeadline = (value, today = businessToday()) => {
  const parse = (input) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input || '')) return null;
    const parsed = Date.parse(`${input}T00:00:00Z`);
    return Number.isFinite(parsed) ? parsed : null;
  };
  const due = parse(value);
  const current = parse(today);
  if (due === null || current === null) return null;
  return Math.round((due - current) / 86400000);
};

const clientNameOf = (record = {}) =>
  text(record.client_name) ||
  text(record.client_details?.name) ||
  text(record.client?.name);

const ownerNameOf = (record = {}) =>
  text(record.owner_name) ||
  text(record.owner_details?.full_name) ||
  text(record.owner_details?.username);

const serviceLineOf = (record = {}) => {
  const list = Array.isArray(record.service_categories)
    ? record.service_categories.filter((i) => typeof i === 'string' && i.trim())
    : [];
  return list.map(humanize).join(', ');
};
const isStrategicClient = (record = {}) => {
  const hay = [record.client_tier, record.client_details?.tier, record.is_strategic_client];
  return hay.some((v) => {
    if (v === true) return true;
    return ['strategic', 'enterprise', 'premium', 'key', 'vip'].includes(String(v || '').toLowerCase());
  });
};

const isHighValue = (record = {}) => {
  const amount = num(record.estimated_value);
  return amount !== null && amount >= 500000;
};

const isCloseDeadline = (record = {}) => {
  const days = daysToDeadline(record.submission_due_date);
  return days !== null && days <= 14;
};

const isEOI = (record = {}) => String(record.opportunity_type || '').toLowerCase() === 'eoi';

const joinSentences = (parts) => parts.filter(Boolean).join(' ');

/** SMART AUTOMATION RULES -> signals used by justification + insights. */
export function decisionSignals(record = {}) {
  const winProb = num(record.win_probability);
  const days = daysToDeadline(record.submission_due_date);
  return {
    winProb,
    positiveBias: winProb !== null && winProb >= 60,
    lowWinProb: winProb !== null && winProb < 40,
    strategicClient: isStrategicClient(record),
    highValue: isHighValue(record),
    hasValue: num(record.estimated_value) !== null,
    closeDeadline: isCloseDeadline(record),
    overdue: days !== null && days < 0,
    daysLeft: days,
    isEOI: isEOI(record),
    hasServices: serviceLineOf(record).length > 0,
    hasClient: clientNameOf(record).length > 0,
  };
}
/** Instant (<2s) executive justification from real opportunity fields.
 * Pass `intelligence` (from intelligenceOf(analysis)) to ground the draft in
 * RADAI Opportunity Intelligence findings instead of generic statements.
 * Signature stays backward compatible: 4th arg is optional. */
export const JUSTIFICATION_MAX_WORDS = 60;

// Reject raw correspondence and oversized generated paragraphs rather than
// cutting off a sentence and accidentally losing its qualification or negation.
export function conciseGeneratedJustification(value, fallback = '') {
  const candidate = decisionText(text(value)).replace(/\s+/g, ' ');
  if (!candidate || wordCount(candidate) > JUSTIFICATION_MAX_WORDS || candidate.length > 600
      || /https?:|www\.|safelinks|%[0-9a-f]{2}|\b(?:message id|from|subject|realm):|<[^>]+>/i.test(candidate)) return fallback;
  return candidate;
}

const shortFact = (items) => (Array.isArray(items) ? items : [])
  .map((item) => text(item?.text))
  .find((value) => value && value.length <= 130 && wordCount(value) <= 17
    && !/https?:|www\.|safelinks|\b(?:from|subject|message-id):/i.test(value)) || '';
const sentence = (value) => text(value).replace(/[.!?]+$/, '');
const safeName = (value) => {
  const candidate = text(value);
  return candidate.length <= 100 && wordCount(candidate) <= 15
    && !/https?:|www\.|safelinks|\b(?:from|subject|message-id):|not provided|clarification required/i.test(candidate)
    ? candidate : '';
};

const optionEvidence = (items) => {
  const item = (Array.isArray(items) ? items : []).find((row) =>
    shortFact([row]) && text(row?.source));
  return item ? { fact: sentence(shortFact([item])), source: text(item.source) } : null;
};

/** Three reviewable No-Go hypotheses. Tender evidence supports the stated
 * workload/terms; internal capacity, margins and strategy remain conditional. */
export function noGoReasonOptions(intelligence = null) {
  const capacity = optionEvidence(intelligence?.timeline) || optionEvidence(intelligence?.deliverables)
    || optionEvidence(intelligence?.scope);
  const commercial = optionEvidence(intelligence?.paymentTerms) || optionEvidence(intelligence?.deliverables)
    || optionEvidence(intelligence?.scope);
  const strategy = optionEvidence(intelligence?.scope) || optionEvidence(intelligence?.deliverables);
  return [
    {
      id: 'capacity', label: 'Resource capacity risk', evidence: capacity,
      reason: `If the required specialists cannot be committed for this scope${capacity ? ` (${capacity.fact})` : ''}, delivery capacity may be insufficient.`,
      prediction: 'Resource bottlenecks could delay delivery, increase subcontracting cost and erode margin.',
    },
    {
      id: 'commercial', label: 'Commercial and margin uncertainty', evidence: commercial,
      reason: `If the cost model cannot support the required effort and terms${commercial ? ` (${commercial.fact})` : ''}, the expected return may fall below the target margin.`,
      prediction: 'Extra engineering hours or review cycles could reduce profitability despite an acceptable contract value.',
    },
    {
      id: 'strategy', label: 'Strategic priority mismatch', evidence: strategy,
      reason: `If the requested work${strategy ? ` (${strategy.fact})` : ''} falls outside our priority services or offers limited differentiation, it may not justify committing key experts.`,
      prediction: 'This pursuit could reduce capacity for higher priority or higher margin work.',
    },
  ];
}

export function generateBidJustification(record = {}, decision, variant = 0, intelligence = null, managerReason = '') {
  const client = safeName(intelligence?.client);
  const subject = `for ${client || safeName(record.deal_name) || 'this opportunity'}`;
  const scope = shortFact(intelligence?.scope) || shortFact(intelligence?.needs);
  const deliverable = shortFact((intelligence?.deliverables || []).filter((item) =>
    /^(?:submit|issue|develop|prepare|provide|deliver|create|generate|produce|complete|conduct)\b/i.test(text(item?.text))));
  const timing = shortFact(intelligence?.timeline);
  const payment = shortFact(intelligence?.paymentTerms);
  const context = [scope && `Tender scope: ${sentence(scope)}.`,
    deliverable && `Required output: ${sentence(deliverable)}.`,
    timing && `Delivery timing: ${sentence(timing)}.`,
    payment && `Payment basis: ${sentence(payment)}.`].filter(Boolean);
  if (decision === NO_GO) {
    const reason = text(managerReason);
    return joinSentences([
      `${variant % 2 ? 'Decline this pursuit' : 'No-Go is proposed'} ${subject}.`,
      ...context,
      reason ? `Manager reason: ${sentence(reason)}.` : 'Add the specific business reason before recording this decision.',
      num(record.estimated_value) === null && 'Commercial value is unconfirmed.',
    ]);
  }
  return joinSentences([
    `${variant % 2 ? 'Pursue this opportunity' : 'Go is proposed'} ${subject}.`,
    ...context,
    'Confirm delivery capability, named resources and commercial terms before committing.',
    num(record.estimated_value) === null && 'Commercial value is unconfirmed.',
  ]);
}

export function wordCount(value) {
  return text(value).split(/\s+/).filter(Boolean).length;
}

/**
 * RADAI Opportunity Intelligence (analysis report) -> compact digest for the
 * bid decision. Shape mirrors SalesOpportunityAnalysis:
 * data = { status, counts, coverage_note, result: { review_note, sections: {
 *   brief[], client_need[], submission[], risk[], action[], deadline[],
 *   next_step[] } } }, items = { text, name, location, excerpt, date }.
 * Never throws; returns empty lists when analysis is missing/not ready.
 */
const intelItems = (data, key, limit = 3) => {
  const list = data?.result?.sections?.[key];
  if (!Array.isArray(list)) return [];
  return list
    .filter((item) => item && typeof item.text === 'string' && item.text.trim())
    .slice(0, limit)
    .map((item) => ({
      text: item.text.trim(),
      source: text(item.name) || '',
      location: text(item.location) || '',
    }));
};

export function intelligenceOf(data) {
  if (!data || typeof data !== 'object') {
    return { available: false, status: 'missing', client: '', opportunitySummary: null, scope: [], deliverables: [], timeline: [], paymentTerms: [], brief: [], needs: [], submissions: [], risks: [], actions: [], deadlines: [], nextSteps: [], counts: null, reviewNote: '', coverageNote: '' };
  }
  const status = typeof data.status === 'string' ? data.status : 'missing';
  const ready = status === 'ready' || status === 'partial';
  const evaluation = data.result?.manager_review?.tender_evaluation || {};
  const facts = evaluation.opportunity_summary?.project_facts || {};
  const hasFacts = Object.values(facts).some((rows) => Array.isArray(rows)
    && rows.some((row) => row?.source_file && (row.value || row.finding)));
  const hasSections = Object.values(data.result?.sections || {}).some((rows) => Array.isArray(rows) && rows.length > 0);
  const factItems = (key, limit = 3) => (Array.isArray(facts[key]) ? facts[key] : [])
    .filter((row) => row?.source_file && typeof (row.value || row.finding) === 'string')
    .slice(0, limit).map((row) => ({ text: text(row.value || row.finding),
      source: [text(row.source_file), text(row.source_page)].filter(Boolean).join(', '),
      location: text(row.source_page) }));
  return {
    available: ready && (hasFacts || hasSections),
    status,
    client: text(evaluation.opportunity_summary?.client_name),
    opportunitySummary: evaluation.opportunity_summary || null,
    scope: factItems('scope'),
    deliverables: factItems('deliverables'),
    timeline: factItems('timeline'),
    paymentTerms: factItems('payment_terms'),
    brief: intelItems(data, 'brief', 2),
    needs: factItems('scope').length ? factItems('scope') : intelItems(data, 'client_need', 3),
    submissions: factItems('submission_details').length ? factItems('submission_details') : intelItems(data, 'submission', 3),
    risks: factItems('key_risks').length ? factItems('key_risks') : intelItems(data, 'risk', 3),
    actions: intelItems(data, 'action', 2),
    deadlines: factItems('submission_details').length ? factItems('submission_details', 2) : intelItems(data, 'deadline', 2),
    nextSteps: intelItems(data, 'next_step', 2),
    counts: data.counts && typeof data.counts === 'object' ? data.counts : null,
    reviewNote: typeof data.result?.review_note === 'string' ? data.result.review_note : '',
    coverageNote: typeof data.coverage_note === 'string' ? data.coverage_note : '',
  };
}

export function goInsights(intelligence = null) {
  return [
    { label: 'Tender scope', hint: intelligence?.scope?.length ? 'Source identified' : 'Needs source review', evidence: Boolean(intelligence?.scope?.length) },
    { label: 'Required output', hint: intelligence?.deliverables?.length ? 'Source identified' : 'Needs source review', evidence: Boolean(intelligence?.deliverables?.length) },
    { label: 'Submission timing', hint: intelligence?.deadlines?.length ? 'Source identified; verify feasibility' : 'Needs confirmation', evidence: Boolean(intelligence?.deadlines?.length) },
    { label: 'Company capability and capacity', hint: 'Internal confirmation required', evidence: false },
    { label: 'Commercial return', hint: 'Estimate and terms require review', evidence: false },
  ];
}

export function noGoInsights(intelligence = null, managerReason = '') {
  return [
    { label: 'Tender scope', hint: intelligence?.scope?.length ? 'Source identified' : 'Needs source review', evidence: Boolean(intelligence?.scope?.length) },
    { label: 'Tender risks', hint: intelligence?.risks?.length ? 'Source identified' : 'No source risk established', evidence: Boolean(intelligence?.risks?.length) },
    { label: 'Business reason for No-Go', hint: managerReason.trim() ? 'Manager supplied' : 'Manager input required', evidence: Boolean(managerReason.trim()) },
    { label: 'Company capability and capacity', hint: 'Internal confirmation required', evidence: false },
  ];
}

export const summaryOf = (record = {}) => ({
  id: text(record.deal_code) || 'Not provided',
  title: text(record.deal_name) || 'Not provided',
  client: clientNameOf(record) || 'Not provided',
  type: typeLabel(record.opportunity_type),
  owner: ownerNameOf(record) || 'Unassigned',
  deadline: displayDate(record.submission_due_date),
  daysLeft: daysToDeadline(record.submission_due_date),
  value: formatMoney(record.estimated_value, record.currency),
  winProb: num(record.win_probability),
  stage: stageLabel(record.stage),
  serviceLine: serviceLineOf(record) || 'Not provided',
});

export const currentUserName = (user) => {
  if (!user || typeof user !== 'object') return 'Current User';
  return text(user.full_name) || text(user.username) || text(user.email) || 'Current User';
};
