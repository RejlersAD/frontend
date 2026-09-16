// Source decisions are historical evidence, never assignments for a live workflow.
export function recommendationSourceApprovals(requisition) {
  const rows = requisition?.price_remarks_data?.signed_document_verification?.source_approval_rows;
  if (!Array.isArray(rows)) return [];
  return rows.filter(row => row && typeof row === 'object' && row.external === true
    && row.source === 'signed_purchase_requisition_pdf').map(row => ({
    ...row,
    status: row.signature_verified === false ? 'not_recorded' : row.status || 'not_recorded',
    approved_at: row.signature_verified === false ? null : row.approved_at,
  }));
}
