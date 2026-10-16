import { PROCUREMENT_VAT_RATE } from '../../utils/procurementVat.js';
import { confirmedRecommendationVat, recommendationEnteredAmount, recommendationVat } from './recommendationVat.js';
import { normalizeProjectNumbers, reconcileRecommendationProjectDetails } from './recommendationProjectNumbers.js';

const LINE_DETAIL_FIELDS = ['vat_rate', 'vendor_id', 'budget'];
const has = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const meaningfulDetail = value => {
  if (value == null || value === '') return false;
  if (typeof value === 'string') return Boolean(value.trim());
  if (typeof value === 'object') return Object.values(value).some(meaningfulDetail);
  return true;
};
const zeroAmount = value => ['number', 'string'].includes(typeof value) && String(value).trim() !== '' && Number(value) === 0;

// Match the blank-row omission in requisition_validation.normalize_line_items.
// Nonblank invalid rows remain in the payload so server validation can report them.
const isBlankLine = (item, details = {}) => {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
  const description = String(item.description || item.item || item.name || '').trim();
  const quantity = has(item, 'quantity') ? item.quantity : has(item, 'qty') ? item.qty : 1;
  const unitPrice = has(item, 'unit_price') ? item.unit_price : has(item, 'price') ? item.price : 0;
  const blankQuantity = quantity == null || quantity === '' || quantity === 1 || quantity === '1' || quantity === true;
  const blankPrice = unitPrice == null || unitPrice === '' || unitPrice === 0 || unitPrice === '0' || unitPrice === false;
  const total = item.total ?? item.line_total;
  const blankTotal = total == null || total === '' || zeroAmount(total);
  const code = String(item.code || item.sku || '').trim();
  const unit = String(item.unit || item.uom || '').trim();
  const hasDiscount = ['discount', 'line_discount', 'discount_amount'].some(key => item[key] != null && item[key] !== '' && !zeroAmount(item[key]));
  return !description && blankQuantity && blankPrice && blankTotal && !code
    && (!unit || unit.toUpperCase() === 'EA') && !hasDiscount && !meaningfulDetail(details);
};

/**
 * Prepare a save without changing the live editing state.
 * The backend removes blank rows and only retains its canonical item fields.
 * Compact the parallel presentation metadata with those rows before saving it.
 */
export function prepareRecommendationPayload(formData, approvalWorkflow) {
  const metadata = { ...(formData.price_remarks_data || {}) };
  const payload = { ...formData, price_remarks_data: metadata };
  // project_numbers is a read-only projection; native saves use project CSV.
  delete payload.project_numbers;
  if (has(formData, 'project')) {
    payload.project = normalizeProjectNumbers(formData.project);
    payload.project_details = reconcileRecommendationProjectDetails(payload.project, formData.project_details);
  }
  const recalculateVat = confirmedRecommendationVat(formData.vat_basis) && formData._vatPricingChanged !== false;
  delete payload._vatPricingChanged;
  delete payload._vatEnteredAmount;
  delete payload.entered_amount;
  if (!recalculateVat) delete payload.vat_basis;
  // JSON autosaves and multipart saves must clear optional values alike.
  for (const field of ['issued_date', 'total_price', 'net_total_excl_vat', 'estimated_budget', 'vendor']) {
    if (payload[field] === '') payload[field] = null;
  }

  if (Array.isArray(formData.items)) {
    const savedDetails = Array.isArray(metadata.line_details) ? metadata.line_details : [];
    const items = [];
    const lineDetails = [];
    formData.items.forEach((item, index) => {
      const priorDetails = savedDetails[index];
      const details = priorDetails && typeof priorDetails === 'object' && !Array.isArray(priorDetails)
        ? { ...priorDetails } : {};
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        const savedItem = { ...item };
        LINE_DETAIL_FIELDS.forEach((field) => {
          if (item[field] !== undefined) details[field] = item[field];
          delete savedItem[field];
        });
        if (isBlankLine(item, details)) return;
        items.push(savedItem);
      } else {
        items.push(item);
      }
      lineDetails.push(recalculateVat ? { ...details, vat_rate: String(formData.vat_basis === 'none' ? 0 : PROCUREMENT_VAT_RATE) } : details);
    });
    payload.items = items;
    metadata.line_details = lineDetails;
  }

  const amounts = recommendationVat(payload, { recalculate: recalculateVat });
  if (recalculateVat && amounts.netAmount !== null) {
    payload.entered_amount = recommendationEnteredAmount({ ...formData, items: payload.items });
    payload.net_total_excl_vat = amounts.netAmount.toFixed(2);
    payload.total_price = amounts.totalAmount.toFixed(2);
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
