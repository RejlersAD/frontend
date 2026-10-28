/** Editable draft assignments may change until they carry approval evidence. */
export const canConfigurePurchaseOrderRoute = order => {
  if (!order) return true;
  if (String(order.status || '').toLowerCase() !== 'draft') return false;
  if (order.approval_log && !Array.isArray(order.approval_log)) return false;
  const hasRecordedRouteEvidence = (order.approval_log || []).some(entry => {
    if (!entry || entry.external || entry.evidence_document_id) return true;
    const status = String(entry.status || 'pending').trim().toLowerCase();
    return status !== 'pending'
      || Boolean(entry.signature || entry.signature_verified || entry.decided_at || entry.decided_by_id);
  });
  if (hasRecordedRouteEvidence) return false;
  if (['approved_by', 'approved_by_id', 'approved_by_name', 'approved_at', 'approved_date', 'approval_signature']
    .some(field => Boolean(order[field]))) return false;
  return !(Array.isArray(order.attachments) ? order.attachments : []).some(attachment => (
    ['signed_purchase_order_pdf', 'po_excel_import_source'].includes(attachment?.type)
  ));
};
