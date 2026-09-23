/** Existing decision/source evidence must never become a new editable route. */
export const canConfigurePurchaseOrderRoute = order => {
  if (!order) return true;
  if (String(order.status || '').toLowerCase() !== 'draft') return false;
  if (order.approval_log && (!Array.isArray(order.approval_log) || order.approval_log.length)) return false;
  if (['approved_by', 'approved_by_id', 'approved_by_name', 'approved_at', 'approved_date', 'approval_signature']
    .some(field => Boolean(order[field]))) return false;
  return !(Array.isArray(order.attachments) ? order.attachments : []).some(attachment => (
    ['signed_purchase_order_pdf', 'po_excel_import_source'].includes(attachment?.type)
  ));
};
