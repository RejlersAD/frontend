const LINE_DETAIL_FIELDS = ['vat_rate', 'vendor_id', 'budget'];
const has = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

// Match the blank-row omission in requisition_validation.normalize_line_items.
// Nonblank invalid rows remain in the payload so server validation can report them.
const isBlankLine = (item) => {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
  const description = String(item.description || item.item || item.name || '').trim();
  const quantity = has(item, 'quantity') ? item.quantity : has(item, 'qty') ? item.qty : 1;
  const unitPrice = has(item, 'unit_price') ? item.unit_price : has(item, 'price') ? item.price : 0;
  const blankQuantity = quantity == null || quantity === '' || quantity === 1 || quantity === '1' || quantity === true;
  const blankPrice = unitPrice == null || unitPrice === '' || unitPrice === 0 || unitPrice === '0' || unitPrice === false;
  return !description && blankQuantity && blankPrice;
};

/**
 * Prepare a save without changing the live editing state or monetary contract.
 * The backend removes blank rows and only retains its canonical item fields.
 * Compact the parallel presentation metadata with those rows before saving it.
 */
export function prepareRecommendationPayload(formData, approvalWorkflow) {
  const metadata = { ...(formData.price_remarks_data || {}) };
  const payload = { ...formData, price_remarks_data: metadata };
  // JSON autosaves and multipart saves must clear optional values alike.
  for (const field of ['issued_date', 'total_price', 'net_total_excl_vat', 'estimated_budget', 'vendor']) {
    if (payload[field] === '') payload[field] = null;
  }

  if (Array.isArray(formData.items)) {
    const savedDetails = Array.isArray(metadata.line_details) ? metadata.line_details : [];
    const items = [];
    const lineDetails = [];
    formData.items.forEach((item, index) => {
      if (isBlankLine(item)) return;
      const priorDetails = savedDetails[index];
      const details = priorDetails && typeof priorDetails === 'object' && !Array.isArray(priorDetails)
        ? { ...priorDetails } : {};
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        const savedItem = { ...item };
        LINE_DETAIL_FIELDS.forEach((field) => {
          if (item[field] !== undefined) details[field] = item[field];
          delete savedItem[field];
        });
        items.push(savedItem);
      } else {
        items.push(item);
      }
      lineDetails.push(details);
    });
    payload.items = items;
    metadata.line_details = lineDetails;
  }

  if (approvalWorkflow !== undefined) {
    payload.approval_workflow_config = approvalWorkflow;
    metadata.approval_table_labels = Object.fromEntries(
      (Array.isArray(approvalWorkflow) ? approvalWorkflow : [])
        .filter((stage) => stage?.user_id && stage.approval_label)
        .map((stage) => [String(stage.user_id), stage.approval_label]),
    );
  }

  return payload;
}
