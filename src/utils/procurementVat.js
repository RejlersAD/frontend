// Calculate only a user-confirmed VAT treatment. Existing unconfirmed records
// must retain their saved financial values, not infer tax from these helpers.
export const PROCUREMENT_VAT_RATE = 5;
export const PROCUREMENT_VAT_OPTIONS = [
  { value: 'exclusive', label: 'Add 5% VAT' },
  { value: 'inclusive', label: 'Price includes 5% VAT' },
  { value: 'none', label: 'No VAT' },
];
export const procurementVatLabel = basis => PROCUREMENT_VAT_OPTIONS.find(option => option.value === basis)?.label || 'VAT not confirmed';

const decimal = value => {
  if (value === null || value === undefined || typeof value === 'boolean') return null;
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  const text = String(value).trim().replace(/^([+-]?)\./, (_, sign) => `${sign}0.`);
  const match = text.match(/^([+-]?)(\d+)(?:\.(\d*))?(?:e([+-]?\d+))?$/i);
  if (!match) return null;
  const exponent = Number(match[4] || 0);
  if (!Number.isInteger(exponent) || Math.abs(exponent) > 100) return null;
  const digits = match[2] + (match[3] || '');
  if (digits.length > 100) return null;
  return { value: BigInt(digits) * (match[1] === '-' ? -1n : 1n), scale: (match[3] || '').length - exponent };
};

const roundedCents = ({ value, scale }) => {
  const shift = 2 - scale;
  if (shift >= 0) return value * 10n ** BigInt(shift);
  const divisor = 10n ** BigInt(-shift);
  const sign = value < 0n ? -1n : 1n;
  return sign * ((value * sign + divisor / 2n) / divisor);
};
const cents = value => {
  const parsed = decimal(value);
  if (!parsed) return null;
  const amount = roundedCents(parsed);
  return amount <= BigInt(Number.MAX_SAFE_INTEGER) && amount >= BigInt(Number.MIN_SAFE_INTEGER) ? amount : null;
};
const amount = value => Number(value) / 100;

export const roundProcurementMoney = value => {
  const parsed = cents(value);
  return parsed === null ? null : amount(parsed);
};

export function sumProcurementMoney(values) {
  let total = 0n;
  for (const value of values) {
    const parsed = cents(value);
    if (parsed === null) return null;
    total += parsed;
  }
  return total <= BigInt(Number.MAX_SAFE_INTEGER) && total >= BigInt(Number.MIN_SAFE_INTEGER) ? amount(total) : null;
}

export function procurementLineNet(quantity, unitPrice, discount = 0) {
  const count = decimal(quantity), price = decimal(unitPrice), reduction = decimal(discount === '' ? 0 : discount);
  if (!count || !price || !reduction) return null;
  const product = { value: count.value * price.value, scale: count.scale + price.scale };
  const scale = Math.max(product.scale, reduction.scale);
  const net = product.value * 10n ** BigInt(scale - product.scale) - reduction.value * 10n ** BigInt(scale - reduction.scale);
  const rounded = roundedCents({ value: net < 0n ? 0n : net, scale });
  return rounded <= BigInt(Number.MAX_SAFE_INTEGER) ? amount(rounded) : null;
}

export function calculateProcurementVat(subtotal, discountAmount = 0, { basis = 'unconfirmed' } = {}) {
  const base = cents(subtotal), discount = cents(discountAmount === '' ? 0 : discountAmount);
  const confirmed = PROCUREMENT_VAT_OPTIONS.some(option => option.value === basis);
  const rate = confirmed ? basis === 'none' ? 0 : PROCUREMENT_VAT_RATE : null;
  const empty = { subtotal: null, discountAmount: null, netAmount: null, taxAmount: null, totalAmount: null, vatRate: rate };
  if (!confirmed) return empty;
  if (base === null || discount === null || base < 0n || discount < 0n) return empty;
  const input = base > discount ? base - discount : 0n;
  const net = basis === 'inclusive' ? (input * 100n + 52n) / 105n : input;
  const tax = basis === 'inclusive' ? input - net : basis === 'none' ? 0n : (net * BigInt(PROCUREMENT_VAT_RATE) + 50n) / 100n;
  if (net + tax > BigInt(Number.MAX_SAFE_INTEGER)) return empty;
  return { subtotal: amount(base), discountAmount: amount(discount), netAmount: amount(net), taxAmount: amount(tax), totalAmount: amount(net + tax), vatRate: rate };
}
