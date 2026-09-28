// Phase one ends at issue. Keep stored later-stage values intact for phase two.
const ISSUED_STATUSES = new Set(['sent', 'acknowledged', 'in_progress', 'partially_received', 'completed']);

export const isPurchaseOrderIssued = status => ISSUED_STATUSES.has(status);
export const purchaseOrderPhaseStatus = status => isPurchaseOrderIssued(status) ? 'sent' : status;
