const present = value => value !== undefined && value !== null && String(value).trim() !== '';
const identity = vendor => String(vendor?.vendor_id ?? vendor?.id ?? '');
const supplierName = value => String(value || '').trim().toLowerCase();

/** Resolve the chosen supplier, never the first entry in a competitive shortlist. */
export function selectedRecommendationVendor(requisition = {}, vendors = []) {
  const vendorId = typeof requisition.vendor === 'object'
    ? identity(requisition.vendor) : String(requisition.vendor ?? '');
  const name = supplierName(requisition.preferred_supplier_if_any || requisition.supplier_name);
  if (!vendorId && !name) return null;
  const matches = vendor => vendor && (vendorId ? identity(vendor) === vendorId
    : supplierName(vendor.name || vendor.vendor_name) === name);
  const shortlist = Array.isArray(requisition.selected_vendors) ? requisition.selected_vendors : [];
  const shortlisted = shortlist.find(matches);
  const details = matches(requisition.vendor_details) ? requisition.vendor_details : null;
  const master = vendors.find(matches);
  if (!shortlisted && !details && !master) return null;
  const selected = { ...shortlisted, ...details, ...master };
  // An explicit current value (including null) supersedes the legacy alias.
  if (Object.hasOwn(details || {}, 'icv_percentage') || Object.hasOwn(master || {}, 'icv_percentage')) {
    delete selected.icv_value;
  }
  return selected;
}

/** Keep captured import values, otherwise use the chosen supplier's ICV. */
export function recommendationIcv(requisition = {}) {
  const recorded = requisition.price_remarks_data?.icv;
  if (present(recorded)) return formatRecommendationIcv(recorded);
  const selected = selectedRecommendationVendor(requisition);
  const value = [selected?.icv_percentage, selected?.icv_value].find(present);
  if (present(value)) return formatRecommendationIcv(value);
  return '';
}

export function formatRecommendationIcv(value) {
  if (!present(value)) return '';
  const text = String(value).trim();
  const numeric = Number(text.replace(/\s*%$/, ''));
  return Number.isFinite(numeric) && numeric >= 0 && numeric <= 100 ? `${numeric}%` : text;
}
