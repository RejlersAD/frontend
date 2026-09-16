const absent = value => value === undefined || value === null || value === '';
const finiteAmount = value => !absent(value) && Number.isFinite(Number(value));

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
  if (absent(quantity) && absent(unitPrice) && finiteAmount(total) && Number(total) >= 0) {
    return { ...normalized, quantity: '1', unit: normalized.unit || 'LS', unit_price: String(total) };
  }
  return normalized;
}

export function hydrateRecommendationReferences(record = {}) {
  const projects = Array.isArray(record.project_details) ? record.project_details : [];
  const projectText = String(record.project_department || '').trim();
  const vendors = Array.isArray(record.selected_vendors) ? record.selected_vendors : [];
  const items = Array.isArray(record.items) && record.items.length ? record.items
    : Array.isArray(record.price_remarks_data?.price_lines) ? record.price_remarks_data.price_lines : [];
  return {
    // A recorded text reference is not a match to an enterprise project ID.
    project_details: projects.length || !projectText ? projects : [{
      value: projectText, label: projectText, source: 'recorded',
      type: record.requisition_type === 'general' ? 'department' : 'project',
    }],
    // A supplier name alone must not be converted into a fabricated vendor ID.
    selected_vendors: vendors.length || !record.vendor ? vendors : [{
      vendor_id: record.vendor, name: record.supplier_name || record.preferred_supplier_if_any || '',
    }],
    items: items.map(hydrateRecommendationItem),
  };
}

export function preserveRecordedApprovalWorkflow(record) {
  if (!record?.id) return false;
  return String(record.status || 'draft').toLowerCase() !== 'draft'
    || record.price_remarks_data?.import_source === 'signed_pr_pdf'
    || (record.approval_workflow_config || []).some(stage => stage?.external
      || stage?.source === 'signed_purchase_requisition_pdf');
}

export function recommendationLineError(items = []) {
  for (const [index, item] of items.entries()) {
    if (!item || !String(item.description || '').trim()
      || !finiteAmount(item.quantity) || Number(item.quantity) <= 0
      || !finiteAmount(item.unit_price) || Number(item.unit_price) < 0) {
      return `Line item ${index + 1} requires a description, positive quantity, and valid unit price.`;
    }
    const quantity = Number(Number(item.quantity).toFixed(4));
    const price = Number(Number(item.unit_price).toFixed(2));
    const calculatedCents = Math.round((quantity * price + Number.EPSILON) * 100);
    if (!absent(item.total) && (!finiteAmount(item.total)
      || Math.round(Number(item.total) * 100) !== calculatedCents)) {
      return `Line item ${index + 1} total must equal quantity multiplied by unit price.`;
    }
  }
  return '';
}
