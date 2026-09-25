const decimal = (value, name, optional = false) => {
  const text = String(value ?? '').trim();
  if (optional && !text) return '0';
  if (!/^\d+(?:\.\d+)?$/.test(text)) throw new Error(`${name} must be a non-negative number.`);
  return text;
};
const compare = (left, right) => {
  const scale = Math.max(left.split('.')[1]?.length || 0, right.split('.')[1]?.length || 0);
  const integer = value => { const [whole, fraction = ''] = value.split('.'); return BigInt(whole + fraction.padEnd(scale, '0')); };
  const difference = integer(left) - integer(right);
  return difference < 0n ? -1 : difference > 0n ? 1 : 0;
};

// Keep quantity and service-value previews exact, including fractional balances.
const calculate = (left, right, subtract = false) => {
  const scale = Math.max(left.split('.')[1]?.length || 0, right.split('.')[1]?.length || 0);
  const integer = value => { const [whole, fraction = ''] = value.split('.'); return BigInt(whole + fraction.padEnd(scale, '0')); };
  const result = integer(left) + (subtract ? -integer(right) : integer(right));
  const digits = (result < 0n ? -result : result).toString().padStart(scale + 1, '0');
  const text = scale ? `${digits.slice(0, -scale)}.${digits.slice(-scale)}`.replace(/\.?0+$/, '') : digits;
  return `${result < 0n ? '-' : ''}${text}`;
};

export function receivingLinePreview(line, received = '') {
  try {
    const accepted = decimal(line.accepted, 'Accepted quantity');
    const pending = decimal(line.pending, 'Pending quantity');
    const available = decimal(line.available, 'Available balance');
    const previouslyReceived = calculate(accepted, pending);
    const entered = decimal(received, 'Received quantity', true);
    if (compare(entered, available) > 0) return { previouslyReceived, balance: null, status: null, awaitingConfirmation: compare(pending, '0') > 0 };
    const balance = calculate(available, entered, true);
    return {
      previouslyReceived,
      balance,
      status: compare(balance, '0') === 0 ? 'Complete' : compare(calculate(previouslyReceived, entered), '0') > 0 ? 'Partial' : 'Not received',
      awaitingConfirmation: compare(calculate(pending, entered), '0') > 0,
    };
  } catch {
    return { previouslyReceived: null, balance: null, status: null, awaitingConfirmation: false };
  }
}

export function localReceiptDate(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function buildReceivingLines(receiving, drafts) {
  if (!['quantity', 'service_value'].includes(receiving?.basis) || !Array.isArray(receiving.lines)) throw new Error('Receipt balances are unavailable.');
  const service = receiving.basis === 'service_value';
  const lines = receiving.lines.flatMap(line => {
    const draft = drafts[line.line_id] || {};
    const received = decimal(draft.received, `${line.description} received`, true);
    const rejected = decimal(draft.rejected, `${line.description} rejected`, true);
    const available = decimal(line.available, 'Available balance');
    if (compare(rejected, received) > 0) throw new Error('Rejected quantity or value cannot exceed the received amount.');
    if (compare(received, available) > 0) throw new Error(`${line.description} exceeds its available balance.`);
    if (compare(received, '0') === 0) return [];
    return [{ line_id: line.line_id, [service ? 'received_amount' : 'received_qty']: received, [service ? 'rejected_amount' : 'rejected_qty']: rejected }];
  });
  if (!lines.length) throw new Error('Enter a received quantity or service value greater than zero.');
  return lines;
}

export function receiptOperation(previous, payload, makeKey = () => crypto.randomUUID()) {
  const signature = JSON.stringify(payload);
  return previous?.signature === signature ? previous : { signature, key: makeKey() };
}
