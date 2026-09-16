import { PROCUREMENT_VAT_OPTIONS } from '../../utils/procurementVat.js';

// Only explicitly reviewed records have canonical net/gross semantics. Keep
// historical export values untouched until their VAT treatment is confirmed.
export function procurementVatExportValue(record, column, kind) {
  if (!PROCUREMENT_VAT_OPTIONS.some(option => option.value === record?.vat_basis)) return undefined;
  if (kind === 'po') {
    if (column === 'Amount Curr.') return record.net_amount ?? '';
    if (column === 'Amount including VAT') return record.total_amount ?? '';
    if (column === 'Amount Inc VAT in AED' && record.currency === 'AED') return record.total_amount ?? '';
  } else {
    if (column === 'PO Amount w/o VAT') return record.net_total_excl_vat ?? '';
    if (column === 'PO Amount including VAT') return record.total_price ?? '';
    if (column === 'Amount Excl VAT in AED' && record.currency === 'AED') return record.net_total_excl_vat ?? '';
  }
  return undefined;
}
