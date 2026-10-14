import { calculateProcurementVat, roundProcurementMoney, procurementLineNet, sumProcurementMoney } from '../../utils/procurementVat.js';

const present = value => value !== null && value !== undefined && value !== '';
export const confirmedRecommendationVat = basis => ['exclusive', 'inclusive', 'none'].includes(basis);
export const recommendationLineDiscount = item => {
  const value = item?.discount ?? item?.line_discount ?? item?.discount_amount ?? 0;
  return value === '' ? 0 : value;
};

export const hasCompleteRecommendationPricing = item => Boolean(item
  && present(item.quantity) && present(item.unit_price)
  && Number(item.quantity) >= 0 && Number(item.unit_price) >= 0
  && procurementLineNet(item.quantity, item.unit_price, recommendationLineDiscount(item)) !== null);

export function recommendationEnteredAmount(record = {}) {
  if (present(record._vatEnteredAmount)) return record._vatEnteredAmount;
  if (Array.isArray(record.items) && record.items.length && record.items.every(hasCompleteRecommendationPricing)) {
    return sumProcurementMoney(record.items.map(item => procurementLineNet(item.quantity, item.unit_price, recommendationLineDiscount(item))));
  }
  const amount = record.vat_basis === 'inclusive' ? record.total_price
    : present(record.net_total_excl_vat) ? record.net_total_excl_vat : record.total_price;
  if (!present(amount)) return null;
  return sumProcurementMoney([amount, record.discount_amount ?? record.price_remarks_data?.discount_amount ?? 0]);
}

/** Unconfirmed records retain their recorded money; a VAT choice is never inferred. */
export function recommendationVat(record = {}, { recalculate = false } = {}) {
  const basis = record.vat_basis;
  if (!recalculate || !confirmedRecommendationVat(basis)) {
    const totalAmount = roundProcurementMoney(record.total_price);
    const netAmount = present(record.net_total_excl_vat) ? roundProcurementMoney(record.net_total_excl_vat) : totalAmount;
    const taxAmount = present(record.tax_amount) ? roundProcurementMoney(record.tax_amount)
      : totalAmount !== null && netAmount !== null ? sumProcurementMoney([totalAmount, -netAmount]) : null;
    return { subtotal: netAmount, discountAmount: null, netAmount, taxAmount, totalAmount,
      vatRate: confirmedRecommendationVat(basis) ? basis === 'none' ? 0 : 5 : null };
  }
  if (basis === 'inclusive' && present(record.total_price)) return calculateProcurementVat(record.total_price, 0, { basis });
  if (present(record.net_total_excl_vat)) return calculateProcurementVat(record.net_total_excl_vat, 0, { basis: basis === 'none' ? 'none' : 'exclusive' });
  const items = Array.isArray(record.items) && record.items.length ? record.items
    : Array.isArray(record.price_remarks_data?.price_lines) ? record.price_remarks_data.price_lines : [];
  const amounts = items.map(item => {
    if (!item || typeof item !== 'object') return null;
    const quantity = item.quantity ?? item.qty;
    const unitPrice = item.unit_price ?? item.price;
    if (present(quantity) && present(unitPrice)) return procurementLineNet(quantity, unitPrice, recommendationLineDiscount(item));
    return roundProcurementMoney(item.total ?? item.line_total ?? item.total_price ?? item.amount);
  });
  if (amounts.length && amounts.every(value => value !== null)) {
    return calculateProcurementVat(sumProcurementMoney(amounts), record.discount_amount ?? record.price_remarks_data?.discount_amount ?? 0, { basis });
  }
  return calculateProcurementVat(record.total_price, 0, { basis });
}
