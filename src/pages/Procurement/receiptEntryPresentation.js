import { buildReceivingLines } from './receiptHandoff.js';

const decimal = (value, optional = false) => {
  const text = String(value ?? '').trim();
  if (optional && !text) return '0';
  return /^\d+(?:\.\d+)?$/.test(text) ? text : null;
};
const calculate = (left, right, subtract = false) => {
  if (left === null || right === null) return null;
  const scale = Math.max(left.split('.')[1]?.length || 0, right.split('.')[1]?.length || 0);
  const integer = value => {
    const [whole, fraction = ''] = value.split('.');
    return BigInt(whole + fraction.padEnd(scale, '0'));
  };
  const result = integer(left) + (subtract ? -integer(right) : integer(right));
  if (result < 0n) return null;
  const digits = result.toString().padStart(scale + 1, '0');
  return scale ? `${digits.slice(0, -scale)}.${digits.slice(-scale)}`.replace(/\.?0+$/, '') : digits;
};
const positive = value => value !== null && /[1-9]/.test(value);
const amountValid = value => /^\d{1,18}(?:\.\d{1,6})?$/.test(String(value ?? '').trim());
const precisionMessage = (value, service) => {
  if (!amountValid(value)) return 'Use a non-negative decimal with at most 18 integer digits and six decimal places.';
  if (service && /[1-9]/.test(String(value).split('.')[1]?.slice(2) || '')) return 'Service values must use at most two decimal places.';
  return '';
};
const unitText = value => typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').toUpperCase() : '';
const fields = ['ordered', 'previouslyReceived', 'received', 'balance'];

// A receipt's quantity totals are meaningful only within the same unit.
// Unknown source amounts remain unknown; decimal strings never pass through Number.
export function receiptEntrySummary(summary, drafts = {}, currency = '') {
  const groups = new Map();
  const lines = Array.isArray(summary?.lines) ? summary.lines : [];
  const service = summary?.basis === 'service_value';
  const basisValid = service || summary?.basis === 'quantity';
  const serviceCurrency = unitText(currency) || unitText(summary?.currency);
  const ids = new Set();
  let sourceValid = basisValid && lines.length > 0;
  let enteredLineCount = 0;
  let allDeliveredRejected = true;
  for (const [index, line] of lines.entries()) {
    const id = typeof line?.line_id === 'string' || typeof line?.line_id === 'number' ? String(line.line_id).trim() : '';
    const unique = Boolean(id) && !ids.has(id);
    ids.add(id);
    const unit = basisValid ? (service ? serviceCurrency : unitText(line?.uom)) : '';
    const key = unit ? `${service ? 'currency' : 'quantity'}:${unit}` : `unknown:${index}`;
    const label = unit || (service ? 'Currency not recorded' : 'Unit not recorded');
    if (!groups.has(key)) groups.set(key, { key, label, ordered: '0', previouslyReceived: '0', received: '0', balance: '0' });
    const ordered = decimal(line?.ordered);
    const previouslyReceived = calculate(decimal(line?.accepted), decimal(line?.pending));
    const available = decimal(line?.available);
    const received = decimal(drafts?.[id]?.received, true);
    const rejected = decimal(drafts?.[id]?.rejected, true);
    const proposedAccepted = calculate(received, rejected, true);
    const balance = calculate(available, received, true) === null ? null : calculate(available, proposedAccepted, true);
    const accountedFor = calculate(previouslyReceived, available);
    const sourceLineValid = Boolean(unit) && (!service || unitText(line?.uom) === unit) && unique && ['ordered', 'accepted', 'pending', 'available'].every(field => amountValid(line?.[field])) && positive(ordered) && accountedFor !== null && calculate(ordered, accountedFor, true) === '0';
    sourceValid = sourceValid && sourceLineValid;
    if (sourceLineValid && positive(received) && balance !== null && !precisionMessage(received, service) && !precisionMessage(rejected, service)) enteredLineCount += 1;
    if (positive(received) && proposedAccepted !== '0') allDeliveredRejected = false;
    const values = { ordered, previouslyReceived, received, balance };
    const group = groups.get(key);
    for (const field of fields) group[field] = sourceLineValid ? calculate(group[field], values[field]) : null;
  }
  let validationMessage = '';
  if (!sourceValid) validationMessage = 'Receipt balances are unavailable. Refresh the purchase order balances.';
  else {
    try {
      const receivedLines = buildReceivingLines(summary, drafts || {});
      const suffix = service ? 'amount' : 'qty';
      for (const line of receivedLines) {
        validationMessage = precisionMessage(line[`received_${suffix}`], service) || precisionMessage(line[`rejected_${suffix}`], service);
        if (validationMessage) break;
      }
    }
    catch (error) { validationMessage = error.message; }
  }
  const resultGroups = [...groups.values()];
  const valid = validationMessage === '';
  const complete = valid && resultGroups.every(group => group.balance === '0');
  return {
    groups: resultGroups,
    enteredLineCount,
    complete,
    deliveryStatus: !valid ? '' : complete ? 'full' : allDeliveredRejected ? 'rejected' : 'partial',
    valid,
    validationMessage,
  };
}
