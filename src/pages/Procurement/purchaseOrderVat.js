import { calculateProcurementVat, procurementLineNet, roundProcurementMoney, sumProcurementMoney } from '../../utils/procurementVat.js'

export const purchaseOrderLineNet = item => {
  const quantity = item.quantity ?? item.qty ?? 1
  const rate = item.unit_price ?? item.unitPrice ?? item.price ?? item.rate
  if (rate !== undefined && rate !== null && rate !== '') {
    return procurementLineNet(quantity, rate, item.discount ?? item.discount_amount ?? 0)
  }
  return roundProcurementMoney(item.total ?? item.line_total ?? item.total_price ?? item.amount)
}

// Canonical orders store gross in total_amount; source PDF documents store net
// under that name; source reviews must pass their explicitly confirmed VAT basis.
export const purchaseOrderVat = (order = {}, { preferItems = false } = {}) => {
  const discount = roundProcurementMoney(order.discount_amount ?? 0) ?? 0
  const net = roundProcurementMoney(order.net_amount)
  const gross = roundProcurementMoney(order.total_amount)
  const tax = roundProcurementMoney(order.tax_amount)
  const basis = order.vat_basis || 'unconfirmed'
  // Reading an order never authorizes a financial correction. Keep the saved
  // amounts, including legacy VAT, until the user confirms treatment and saves.
  if (!preferItems || basis === 'unconfirmed') {
    const recordedNet = net ?? (gross !== null && tax !== null ? sumProcurementMoney([gross, -tax]) : null)
    return {
      subtotal: recordedNet === null ? null : sumProcurementMoney([basis === 'inclusive' && gross !== null ? gross : recordedNet, discount]),
      discountAmount: discount, netAmount: recordedNet,
      taxAmount: tax, totalAmount: gross,
      vatRate: roundProcurementMoney(order.vat_percentage),
    }
  }
  const options = { basis }
  const items = Array.isArray(order.items) ? order.items : []
  if (items.length) {
    return calculateProcurementVat(sumProcurementMoney(items.map(purchaseOrderLineNet)), discount, options)
  }
  if (order.price_amount !== undefined && order.price_amount !== null) {
    return calculateProcurementVat(order.price_amount, discount, options)
  }
  if (net !== null) {
    const basisAmount = basis === 'inclusive' && gross !== null ? gross : net
    return calculateProcurementVat(sumProcurementMoney([basisAmount, discount]), discount, options)
  }
  return calculateProcurementVat(gross === null ? null : sumProcurementMoney([gross, discount]), discount, options)
}
