const quantity = (value, label, optional = false) => {
  const text = String(value ?? '').trim();
  if (!text && optional) return '0';
  if (!/^\d+(?:\.\d+)?$/.test(text)) throw new Error(`${label} must be a non-negative quantity.`);
  return text;
};
const subtract = (received, rejected) => {
  const precision = Math.max(received.split('.')[1]?.length || 0, rejected.split('.')[1]?.length || 0);
  const integer = value => { const [whole, fraction = ''] = value.split('.'); return BigInt(whole + fraction.padEnd(precision, '0')); };
  const difference = integer(received) - integer(rejected);
  if (difference < 0n) throw new Error('Rejected quantity cannot exceed received quantity.');
  const digits = difference.toString().padStart(precision + 1, '0');
  return precision ? `${digits.slice(0, -precision)}.${digits.slice(-precision)}` : digits;
};
const hasQuantity = value => /[1-9]/.test(value);
const sourceItems = po => Array.isArray(po?.items) ? po.items.filter(item => item && typeof item === 'object' && !Array.isArray(item)) : [];
export const receiptLineDrafts = po => sourceItems(po).map(item => ({ received_qty: '', rejected_qty: '0', uom: String(item.unit || item.uom || '').trim() }));

export function buildReceiptItems(po, drafts, fallback = {}) {
  const items = sourceItems(po);
  if (items.length) {
    if (!Array.isArray(drafts) || drafts.length !== items.length) throw new Error('Enter quantities for the current purchase-order lines.');
    const receivedLines = items.flatMap((item, index) => {
      const draft = drafts[index];
      const received = quantity(draft?.received_qty, `Line ${index + 1} received quantity`, true);
      const rejected = quantity(draft?.rejected_qty, `Line ${index + 1} rejected quantity`, true);
      const accepted = subtract(received, rejected);
      if (!hasQuantity(received)) return [];
      const uom = String(item.unit || item.uom || draft?.uom || '').trim();
      if (!uom) throw new Error(`Enter the unit of measure for line ${index + 1}.`);
      const ordered = item.quantity ?? item.ordered_qty;
      return [{ po_line_id: item.id || item.po_line_id || null, line_number: item.line_number || index + 1, item: item.description || item.item || item.name || `PO line ${index + 1}`, uom,
        ordered_qty: ordered === null || ordered === undefined || String(ordered).trim() === '' ? null : quantity(ordered, `Line ${index + 1} ordered quantity`), received_qty: received, accepted_qty: accepted, rejected_qty: rejected }];
    });
    if (!receivedLines.length) throw new Error('Enter a received quantity greater than zero for at least one purchase-order line.');
    return receivedLines;
  }
  const received = quantity(fallback.quantity_received, 'Received quantity');
  const rejected = quantity(fallback.quantity_rejected, 'Rejected quantity', true);
  if (!hasQuantity(received)) throw new Error('Quantity received must be greater than zero.');
  const accepted = subtract(received, rejected), uom = String(fallback.quantity_uom || '').trim();
  if (!uom) throw new Error('Enter the unit of measure for the received quantity.');
  return [{ line_number: 1, item: po?.title || po?.description || 'Goods received against purchase order', uom, ordered_qty: null, received_qty: received, accepted_qty: accepted, rejected_qty: rejected }];
}
