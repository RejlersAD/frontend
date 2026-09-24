const sameValue = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const plainObject = value => value != null && typeof value === 'object' && !Array.isArray(value);

// A save acknowledges the submitted values, never text entered after the request.
export function mergeSavedPurchaseOrder(current, submitted, saved) {
  if (sameValue(current, submitted)) return saved;
  if (!plainObject(current) || !plainObject(submitted) || !plainObject(saved)) return current;
  const result = { ...current };
  for (const key of Object.keys(saved)) {
    if (!Object.hasOwn(current, key) && Object.hasOwn(submitted, key)) continue;
    result[key] = mergeSavedPurchaseOrder(current[key], submitted[key], saved[key]);
  }
  return result;
}

export function purchaseOrderSavedValues(submitted, order) {
  return Object.fromEntries(Object.entries(submitted).map(([key, value]) => {
    const saved = key === 'price_amount' && order.total_amount != null
      ? purchaseOrderVat(order).subtotal ?? sumProcurementMoney([order.total_amount, order.discount_amount || 0])
      : key === 'summary' && Object.hasOwn(order.contact_persons || {}, 'purchase_summary')
        ? order.contact_persons.purchase_summary : Object.hasOwn(order, key) ? order[key] : value;
    return [key, saved == null && typeof value === 'string' ? ''
      : saved == null && Array.isArray(value) ? [] : saved == null && plainObject(value) ? {} : saved];
  }));
}

export const purchaseOrderAttachmentKey = attachment => attachment && (
  attachment.s3_key || attachment.id || attachment.document_id || attachment.url
  || attachment.s3_url || `${attachment.filename || ''}:${attachment.uploaded_at || ''}`
);
const attachmentKey = purchaseOrderAttachmentKey;

export const purchaseOrderAttachmentSlots = attachments => (attachments || []).map((attachment, index) => ({
  title: attachment.title || attachment.filename || `Item ${index + 1}`,
  description: attachment.description || '', file: null,
  existingAttachment: attachment, existingAttachmentIndex: index,
}));

export function mergeSavedPurchaseOrderAttachments(current, submitted, attachments) {
  const savedSlots = purchaseOrderAttachmentSlots(attachments);
  const uploads = submitted.filter(slot => slot.file);
  // The API appends uploads after retained/protected attachments in request order.
  const uploaded = savedSlots.slice(Math.max(0, savedSlots.length - uploads.length));
  const findSaved = slot => slot.file
    ? uploaded[uploads.findIndex(item => item.file === slot.file)]
    : savedSlots.find(item => attachmentKey(item.existingAttachment) === attachmentKey(slot.existingAttachment));
  const result = current.map(slot => {
    const sent = submitted.find(item => slot.file
      ? item.file === slot.file
      : attachmentKey(item.existingAttachment) === attachmentKey(slot.existingAttachment));
    const saved = sent && findSaved(sent);
    return saved ? {
      ...saved,
      title: slot.title === sent.title ? saved.title : slot.title,
      description: slot.description === sent.description ? saved.description : slot.description,
    } : slot;
  });
  // Include protected attachments restored by the server, but respect a removal
  // the user made while this save was in flight.
  for (const saved of savedSlots) {
    const key = attachmentKey(saved.existingAttachment);
    if (result.some(slot => attachmentKey(slot.existingAttachment) === key)) continue;
    if (submitted.some(slot => attachmentKey(findSaved(slot)?.existingAttachment) === key)) continue;
    result.push(saved);
  }
  return result;
}
import { purchaseOrderVat } from './purchaseOrderVat.js';
import { sumProcurementMoney } from '../../utils/procurementVat.js';
