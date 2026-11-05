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

export function generateBidJustification(record = {}, decision, variant = 0, intelligence = null) {
  const opening = decision === GO
    ? ['Proceed with this opportunity, subject to confirming delivery capability and commercial terms.',
      'Pursue this opportunity after confirming capability, resources and commercial acceptance.'][variant % 2]
    : ['Do not pursue this opportunity.', 'Decline this pursuit.'][variant % 2];
  const observations = [];
  if (num(record.estimated_value) === null) observations.push('Commercial value is unconfirmed.');
  const risk = intelligence?.available ? intelligence.risks?.map(item =>
    conciseGeneratedJustification(item.text)).find(value => value && wordCount(value) <= 18 && value.length <= 180) : '';
  if (risk) observations.push(`Review the reported risk: ${risk.replace(/[.!?]$/, '')}.`);
  const closing = decision === NO_GO
    ? 'Confirm the specific reason for declining before saving.'
    : 'Verify the bid conditions before committing resources.';
  return conciseGeneratedJustification(joinSentences([opening, ...observations.slice(0, 1), closing]),
    joinSentences([opening, closing]));
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
    return { available: false, status: 'missing', brief: [], needs: [], submissions: [], risks: [], actions: [], deadlines: [], nextSteps: [], counts: null, reviewNote: '', coverageNote: '' };
  }
  const status = typeof data.status === 'string' ? data.status : 'missing';
  const ready = status === 'ready' || status === 'partial';
  return {
    available: ready,
    status,
    brief: intelItems(data, 'brief', 2),
    needs: intelItems(data, 'client_need', 3),
    submissions: intelItems(data, 'submission', 3),
    risks: intelItems(data, 'risk', 3),
    actions: intelItems(data, 'action', 2),
    deadlines: intelItems(data, 'deadline', 2),
    nextSteps: intelItems(data, 'next_step', 2),
    counts: data.counts && typeof data.counts === 'object' ? data.counts : null,
    reviewNote: typeof data.result?.review_note === 'string' ? data.result.review_note : '',
    coverageNote: typeof data.coverage_note === 'string' ? data.coverage_note : '',
  };
}

export function goInsights() {
  return [
    { label: 'Strategic fit', hint: 'Strategy alignment' },
    { label: 'Service capability alignment', hint: 'Delivery match' },
    { label: 'Commercial potential', hint: 'Value and win chance' },
    { label: 'Client relationship', hint: 'Account strength' },
    { label: 'Resource availability', hint: 'Capacity to deliver' },
  ];
}

export function noGoInsights() {
  return [
    { label: 'Limited strategic value', hint: 'Low fit' },
    { label: 'Resource constraints', hint: 'Capacity pressure' },
    { label: 'Low win probability', hint: 'Weak return odds' },
    { label: 'Commercial concerns', hint: 'Value vs cost' },
    { label: 'Capacity conflicts', hint: 'Pipeline overload' },
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
