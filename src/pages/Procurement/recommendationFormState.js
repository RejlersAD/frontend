import { procurementLineNet } from '../../utils/procurementVat.js';
import { recommendationLineDiscount } from './recommendationVat.js';
import { selectedRecommendationVendor } from './recommendationIcv.js';
import { recommendationProjectNumbers, reconcileRecommendationProjectDetails } from './recommendationProjectNumbers.js';

const absent = value => value === undefined || value === null || value === '';
const finiteAmount = value => !absent(value) && Number.isFinite(Number(value)) && procurementLineNet(value, 1) !== null;

// Older signed imports recorded a quoted lump sum, without quantity/unit-price
// columns. Represent that same amount explicitly; never repair an inconsistent
// quantity or price by guessing which recorded value was intended.
export function hydrateRecommendationItem(item) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
  const quantity = item.quantity ?? item.qty;
  const unitPrice = item.unit_price ?? item.price;
  const total = item.total ?? item.line_total;
  const normalized = {
    ...item,
    description: item.description ?? item.item ?? item.name ?? '',
    ...(quantity !== undefined ? { quantity } : {}),
    ...(unitPrice !== undefined ? { unit_price: unitPrice } : {}),
    ...(total !== undefined ? { total } : {}),
    ...(item.unit || item.uom ? { unit: item.unit || item.uom } : {}),
  };
  if (!['quantity', 'qty', 'unit_price', 'price'].some(key => Object.hasOwn(item, key)) && finiteAmount(total) && Number(total) >= 0) {
    return { ...normalized, quantity: '1', unit: normalized.unit || 'LS', unit_price: String(total) };
  }
  return normalized;
}

export function hydrateRecommendationReferences(record = {}) {
  const projects = Array.isArray(record.project_details) ? record.project_details : [];
  const projectText = String(record.project_department || '').trim();
  const vendors = Array.isArray(record.selected_vendors) ? record.selected_vendors : [];
  const selectedVendor = selectedRecommendationVendor(record);
  const items = Array.isArray(record.items) && record.items.length ? record.items
    : Array.isArray(record.price_remarks_data?.price_lines) ? record.price_remarks_data.price_lines : [];
  const projectNumbers = recommendationProjectNumbers(record);
  const projectDetails = projects.length || !projectText ? projects : [{
    value: projectText, label: projectText, source: 'recorded',
    type: record.requisition_type === 'general' ? 'department' : 'project',
  }];
  return {
    project: projectNumbers.join(', '),
    // A recorded text reference is not a match to an enterprise project ID.
    project_details: reconcileRecommendationProjectDetails(projectNumbers, projectDetails),
    // A supplier name alone must not be converted into a fabricated vendor ID.
    selected_vendors: vendors.length ? vendors.map(vendor => (
      String(vendor.vendor_id || vendor.id) === String(record.vendor)
        ? selectedVendor || vendor : vendor
    )) : !record.vendor ? [] : [{
      ...selectedVendor, vendor_id: record.vendor, name: record.supplier_name || record.preferred_supplier_if_any || selectedVendor?.name || '',
    }],
    items: items.map(hydrateRecommendationItem),
  };
}

export function preserveRecordedApprovalWorkflow(record) {
  if (!record?.id) return false;
  return !['draft', 'submitted', 'in_review', 'pending_approval'].includes(String(record.status || 'draft').toLowerCase())
    || (record.price_remarks_data?.import_source === 'signed_pr_pdf'
      && !record.price_remarks_data?.approval_revision_history?.length)
    || Boolean(record.price_remarks_data?.signed_document_verification?.signed_off)
    || (record.approval_workflow_config || []).some(stage => stage?.external
      || stage?.source === 'signed_purchase_requisition_pdf'
      || !['pending', 'in_review'].includes(String(stage?.status || 'pending').toLowerCase())
      || stage?.approved_at || stage?.rejected_at || stage?.signature || stage?.approved_by_id);
}

export function recommendationLineError(items = []) {
  for (const [index, item] of items.entries()) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return `Line item ${index + 1} must contain valid item details.`;
    if (!absent(item.quantity) && (!finiteAmount(item.quantity) || Number(item.quantity) < 0)) {
      return `Line item ${index + 1} quantity must be a valid non-negative number.`;
    }
    if (!absent(item.unit_price) && (!finiteAmount(item.unit_price) || Number(item.unit_price) < 0)) {
      return `Line item ${index + 1} unit price must be a valid non-negative number.`;
    }
    if (!absent(item.total) && (!finiteAmount(item.total) || Number(item.total) < 0)) {
      return `Line item ${index + 1} total must be a valid non-negative number.`;
    }
    const discount = recommendationLineDiscount(item);
    if (!finiteAmount(discount) || Number(discount) < 0) return `Line item ${index + 1} requires a valid non-negative discount.`;
    if (absent(item.quantity) || absent(item.unit_price)) continue;
    const quantity = Number(Number(item.quantity).toFixed(4));
    const price = Number(Number(item.unit_price).toFixed(2));
    const calculatedCents = Math.round(procurementLineNet(quantity, price, discount) * 100);
    if (!absent(item.total) && (!finiteAmount(item.total)
      || Math.round(Number(item.total) * 100) !== calculatedCents)) {
      return `Line item ${index + 1} total must equal quantity multiplied by unit price${Number(discount) ? ' minus discount' : ''}.`;
    }
  }
  return '';
}
