const DAY = 86400000;
const CLOSED = new Set(['completed', 'cancelled', 'rejected', 'converted']);
const REVIEW = new Set(['submitted', 'in_review', 'under_review', 'pending']);
const PENDING = new Set(['pending', 'in_review', 'under_review']);
const CURRENCIES = new Set(typeof Intl.supportedValuesOf === 'function'
  ? Intl.supportedValuesOf('currency')
  : ['AED', 'USD', 'EUR', 'GBP', 'INR', 'SAR', 'QAR', 'OMR', 'BHD', 'KWD', 'SEK', 'NOK', 'DKK', 'CHF', 'CAD', 'AUD', 'JPY', 'CNY', 'SGD']);
const text = value => typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
const firstText = (...values) => values.map(text).find(Boolean) || '';
const number = value => {
  const valueText = text(value);
  return valueText !== '' && /^[-+]?\d+(?:\.\d+)?$/.test(valueText) && Number.isFinite(Number(valueText)) ? Number(valueText) : null;
};
const array = value => Array.isArray(value) ? value.filter(item => item && typeof item === 'object') : [];
const dateValue = value => {
  const input = text(value);
  if (!/^\d{4}-\d{2}-\d{2}(?:T|$)/.test(input)) return null;
  const [year, month, day] = input.slice(0, 10).split('-').map(Number);
  const calendar = new Date(Date.UTC(year, month - 1, day));
  if (calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day) return null;
  const date = new Date(input.length === 10 ? `${input}T12:00:00` : input);
  return Number.isNaN(date.getTime()) ? null : date;
};
const dayValue = value => {
  const date = value instanceof Date ? value : dateValue(value);
  return date && !Number.isNaN(date.getTime()) ? Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) : null;
};
const currencyCode = value => text(value).toUpperCase();
const isCurrency = value => CURRENCIES.has(currencyCode(value));

export function formatRegisterMoney(amount, currency, { compact = false } = {}) {
  const parsed = number(amount);
  if (parsed === null) return '—';
  const rendered = new Intl.NumberFormat('en-GB', {
    maximumFractionDigits: compact ? 3 : 2,
    ...(compact ? { notation: 'compact' } : {}),
  }).format(parsed);
  return isCurrency(currency) ? `${currencyCode(currency)} ${rendered}` : `${rendered} · currency unverified`;
}

export function formatRegisterDate(value, { includeTime = false } = {}) {
  const parsed = dateValue(value);
  if (!parsed) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    ...(includeTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(parsed);
}

function approvalSteps(raw, isOrder) {
  const workflow = array(isOrder ? raw.approval_log : raw.approval_workflow_config || raw.approval_hierarchy);
  const steps = workflow.map((entry, index) => ({
    label: firstText(entry.stage, entry.role, entry.title, `Approval ${index + 1}`),
    assignee: isOrder ? firstText(entry.approver, entry.user_name, entry.approver_name, 'Not assigned')
      : firstText(entry.user_name, entry.approver_name, entry.approver, 'Not assigned'),
    status: text(entry.status || 'pending').toLowerCase(),
    date: entry.approved_at || (!isOrder && entry.rejected_at) || entry.date || null,
    level: number(entry.level) ?? (isOrder ? index : number(`${entry.stage || ''} ${entry.role || ''}`.match(/\blevel\s*(\d+)\b/i)?.[1]) ?? index + 1),
    raw: entry,
  }));
  const levels = steps.filter(step => PENDING.has(step.status)).map(step => step.level);
  const activeLevel = levels.length ? Math.min(...levels) : null;
  return steps.map(step => ({ ...step, active: PENDING.has(step.status) && step.level === activeLevel }));
}

const ORDER_STATUS = {
  pending_reconciliation: ['Pending reconciliation', 'amber'],
  draft: ['Draft', 'muted'], sent: ['Issued', 'blue'], acknowledged: ['Acknowledged', 'green'],
  in_progress: ['In delivery', 'blue'], partially_received: ['Partially received', 'amber'],
  completed: ['Completed', 'green'], cancelled: ['Cancelled', 'muted'],
};

/** A saved source PDF is a register entry, not a committed purchase order. */
export function pendingPurchaseOrderDocument(document = {}) {
  const fields = document.extracted_data || {};
  const summary = firstText(fields.summary, document.original_filename, 'Uploaded purchase order').replace(/\s+/g, ' ');
  return {
    id: `document:${document.id}`, po_document_id: document.id, is_pending_document: true,
    source_document: document, status: 'pending_reconciliation',
    po_number: firstText(fields.source_po_number, fields.po_number, 'Number not recorded'),
    title: summary.length > 200 ? `${summary.slice(0, 197)}…` : summary,
    pr_reference: firstText(fields.pr_id) || null, pr_number: text(fields.pr_number),
    vendor_name: firstText(fields.vendor_name, fields.ocr_vendor_name),
    project_number: text(fields.project_number), total_amount: fields.total_amount ?? null,
    currency: text(fields.currency), po_date: fields.po_date || null,
    expected_delivery: fields.expected_delivery || null, created_at: document.created_at,
    created_by: document.uploaded_by, created_by_name: document.uploaded_by_name || '',
    source_filename: document.original_filename || '',
    reconciliation_issues: Array.isArray(fields.reconciliation_issues) ? fields.reconciliation_issues.filter(value => typeof value === 'string') : [],
  };
}
const PR_STATUS = {
  draft: ['Draft', 'muted'], submitted: ['Submitted', 'blue'], in_review: ['Under review', 'amber'],
  approved: ['Approved', 'green'], rejected: ['Rejected', 'red'], converted: ['Converted to PO', 'green'], cancelled: ['Cancelled', 'muted'],
};

const APPROVAL_COMPLETE = new Set(['approved', 'complete', 'completed']);
const NO_PO_REFERENCE = new Set(['', 'n/a', 'na', 'not applicable', 'none', '-']);
export const RECOMMENDATION_STALE_DAYS = 30;

function recommendationFields(record, currentUserId, now) {
  const { raw, status } = record;
  const requesterId = firstText(raw.issued_by, raw.requested_by);
  const requester = firstText(raw.requester_name, raw.issued_by_name, raw.requested_by_name, 'Not recorded');
  const isReview = REVIEW.has(status);
  const approvalRecovery = status === 'converted' && record.approvalSteps.some(step => PENDING.has(step.status) && step.raw.evidence_requested_at);
  const steps = record.approvalSteps.map(step => ({
    ...step,
    active: step.active && (isReview || approvalRecovery),
    // Historical converted records can carry unrecorded legacy decisions.
    status: status === 'converted' && PENDING.has(step.status) && !step.raw.evidence_requested_at ? 'not_recorded' : step.status,
  }));
  const active = steps.filter(step => step.active && PENDING.has(step.status));
  const reviewDeadline = dateValue(raw.review_due_at);
  const reviewOverdue = isReview && reviewDeadline !== null && reviewDeadline.getTime() < now.getTime();
  const currentOwnerIds = active.map(step => firstText(step.raw.user_id, step.raw.approver_id)).filter(Boolean);
  const currentOwner = active.length ? [...new Set(active.map(step => step.assignee))].join(', ')
    : ['draft', 'rejected'].includes(status) ? requester : 'Not assigned';
  const actorIsRequester = Boolean(currentUserId) && requesterId === String(currentUserId);
  const actorIsApprover = Boolean(currentUserId) && currentOwnerIds.includes(String(currentUserId));
  const linkedPoId = firstText(raw.linked_po_id) || null;
  const poReference = NO_PO_REFERENCE.has(text(raw.po_number_reference).toLowerCase()) ? '' : text(raw.po_number_reference);
  const hasExistingPO = Boolean(linkedPoId || poReference || status === 'converted');
  const poApplicable = raw.po_applicable !== false;
  const positiveValue = record.amount !== null && record.amount > 0;
  const supplierLinked = Boolean(raw.vendor || raw.vendor_details?.id);
  const supplierActive = supplierLinked && raw.vendor_details?.status === 'active';
  const workflowProvided = raw.approval_workflow_config || raw.approval_hierarchy;
  const workflowValid = Array.isArray(workflowProvided) && workflowProvided.length > 0
    && workflowProvided.every(step => step && typeof step === 'object' && !Array.isArray(step));
  const allApproved = workflowValid && steps.every(step => APPROVAL_COMPLETE.has(step.status));
  const numberVerified = /^RAD-(GEN|PRJ)-PR-\d{4,}_\d{4}$/.test(text(raw.pr_number));
  const descriptionPresent = Boolean(firstText(raw.product_service, raw.title, raw.description_reason, raw.price_description));
  const readiness = [
    { key: 'description', label: 'Purchase description', value: descriptionPresent ? 'Recorded' : 'Missing', ready: descriptionPresent, detail: 'Description recorded on this recommendation.' },
    { key: 'supplier', label: 'Supplier master link', value: supplierActive ? 'Active supplier linked' : supplierLinked ? raw.vendor_details?.status ? `Supplier ${raw.vendor_details.status}` : 'Status not recorded' : 'Link or verify supplier', ready: supplierActive ? true : supplierLinked && raw.vendor_details?.status ? false : null, detail: 'A supplier name alone does not verify a unique active vendor. The server can resolve an exact match during conversion.' },
    { key: 'value', label: 'Value and currency', value: positiveValue && record.currencyValid ? 'Recorded' : !positiveValue ? 'Positive value required' : 'Currency needs verification', ready: positiveValue && record.currencyValid, detail: 'Values are kept in their recorded currency. No exchange rate or approved funding is assumed.' },
    { key: 'approvals', label: 'Approval workflow', value: !workflowValid ? 'Not recorded' : allApproved && ['approved', 'converted'].includes(status) ? 'All stages approved' : `${steps.filter(step => APPROVAL_COMPLETE.has(step.status)).length}/${steps.length} stages approved`, ready: !workflowValid ? null : allApproved && ['approved', 'converted'].includes(status), detail: 'Configured approval stages only; sourcing, budget and compliance approval are not inferred.' },
    { key: 'number', label: 'PR number', value: numberVerified ? 'Format verified' : 'Needs verification', ready: numberVerified, detail: 'Company format: RAD-GEN-PR-####_YYYY or RAD-PRJ-PR-####_YYYY. The server checks PO number availability during conversion.' },
    { key: 'purchase_order', label: 'PO conversion', value: hasExistingPO ? linkedPoId ? 'Purchase order linked' : 'PO reference recorded' : !poApplicable ? 'Not applicable' : status === 'approved' ? 'No linked PO' : 'Awaiting approval', ready: hasExistingPO || !poApplicable ? null : status === 'approved', detail: hasExistingPO ? 'Existing PO records must be reviewed before creating another order.' : 'Conversion creates a draft purchase order and validates the current server records.' },
  ];
  const readyForPO = status === 'approved' && poApplicable && !hasExistingPO && readiness.every(check => check.ready === true);
  const incompleteFields = [
    ...(!descriptionPresent ? ['Purchase description'] : []),
    ...(!requesterId && requester === 'Not recorded' ? ['Requester'] : []),
    ...(!firstText(raw.enterprise_project_code, raw.project_department, raw.project, raw.department) && !array(raw.project_details).length ? ['Project or department'] : []),
    ...(!firstText(raw.vendor_name, raw.supplier_name, raw.vendor_details?.name, raw.preferred_supplier_if_any) ? ['Supplier'] : []),
    ...(!positiveValue ? ['Positive recommendation value'] : []),
    ...(!record.currencyValid ? ['Verified currency'] : []),
    ...(!numberVerified ? ['Company PR number'] : []),
    ...(!workflowValid ? ['Approval workflow'] : []),
    ...(workflowValid && steps.some(step => !firstText(step.raw.user_id, step.raw.approver_id, step.raw.user_email, step.raw.approver_email)) ? ['Assigned approvers'] : []),
  ];
  const ageDays = record.ageDays;
  const staleDraft = status === 'draft' && ageDays !== null && ageDays >= RECOMMENDATION_STALE_DAYS;
  const updatedDay = dayValue(raw.updated_at || raw.created_at);
  const today = dayValue(now);
  const inactiveDays = updatedDay !== null && today !== null && today >= updatedDay ? Math.floor((today - updatedDay) / DAY) : null;
  const missingHistory = status === 'converted' && (!workflowValid || steps.some(step => step.status === 'not_recorded'));
  const exceptionReasons = [
    ...(reviewOverdue ? ['Approval review overdue'] : []),
    ...(status === 'rejected' ? ['Recommendation rejected'] : []),
    ...(staleDraft ? ['Draft is 30+ days old'] : []),
    ...(incompleteFields.length ? ['Required record information incomplete'] : []),
    ...(status === 'approved' && poApplicable && !hasExistingPO && !readyForPO ? ['PO preparation checks need review'] : []),
    ...(status === 'approved' && hasExistingPO ? ['Existing PO reference needs review'] : []),
    ...(missingHistory ? ['Historical approval evidence not recorded'] : []),
    ...(approvalRecovery ? ['Approval evidence requested'] : []),
  ];
  const shortlisted = array(raw.selected_vendors);
  const supplierIdentities = new Set(shortlisted.map(vendor => firstText(vendor.vendor_id, vendor.vendor_name).toLowerCase()).filter(Boolean));
  const pricing = raw.price_remarks_data && typeof raw.price_remarks_data === 'object' && !Array.isArray(raw.price_remarks_data) ? raw.price_remarks_data : {};
  const quotes = array(pricing.comparative_prices).filter(quote => firstText(quote.vendor, quote.vendor_name) && number(quote.price ?? quote.amount) !== null);
  const nextStep = status === 'draft' ? incompleteFields.length ? 'Complete recommendation details' : 'Submit for approval'
    : approvalRecovery ? 'Review requested approval evidence'
      : isReview ? active.length ? `Review: ${active.map(step => step.label).join(', ')}` : 'Review approval assignments'
        : status === 'approved' ? hasExistingPO ? 'Review existing purchase order' : !poApplicable ? 'View approved recommendation' : readyForPO ? 'Create purchase order' : 'Review PO preparation checks'
          : status === 'converted' ? linkedPoId ? 'Open linked purchase order' : 'Review recorded PO reference'
            : status === 'rejected' ? 'Review rejection and resolution' : 'View record';
  return {
    requester, requesterId, buyer: 'Not assigned', buyerId: '', currentOwner, currentOwnerIds,
    linkedPoId, poReference, poApplicable, hasExistingPO, readiness, readyForPO,
    incomplete: incompleteFields.length > 0, incompleteFields, staleDraft, inactiveDays,
    exceptionReasons, hasException: exceptionReasons.length > 0,
    approvalSteps: steps,
    approvalHistory: steps.filter(step => APPROVAL_COMPLETE.has(step.status) || ['rejected', 'not_recorded'].includes(step.status)).map(step => ({
      label: step.label, assignee: firstText(step.raw.approved_by_name, step.raw.rejected_by_name, step.assignee), status: step.status, date: step.date,
    })),
    approvalRecovery,
    approvalSummary: status === 'converted' ? approvalRecovery ? 'evidence_requested' : missingHistory ? 'not_recorded' : allApproved ? 'approved' : 'not_recorded'
      : isReview ? reviewOverdue ? 'overdue' : 'under_review' : status === 'approved' ? 'approved' : status === 'rejected' ? 'rejected' : status === 'draft' ? 'not_started' : 'not_recorded',
    mine: actorIsApprover && (isReview || approvalRecovery) || actorIsRequester && ['draft', 'rejected'].includes(status),
    primaryAction: status === 'draft' ? 'edit' : isReview || approvalRecovery ? 'review' : readyForPO ? 'convert' : 'open',
    nextStep,
    decisionSummary: {
      supplierCount: supplierIdentities.size || null, quoteCount: quotes.length || null,
      shortlistedSuppliers: shortlisted, comparativePrices: quotes,
      justification: text(raw.single_source_justification), recommendation: text(raw.purchase_recommendation),
      vendorSelectionReason: text(raw.vendor_selection_reason), negotiationRemarks: text(raw.price_remarks),
      budgetAmount: number(raw.estimated_budget), budgetCurrency: null,
      managementApproval: typeof raw.management_approval === 'boolean' ? raw.management_approval : null,
      managementRemarks: text(raw.management_approval_remarks), managementEvidenceCount: array(raw.management_approval_evidence).length,
      attachmentCount: array(raw.attachments).length,
    },
  };
}

/** Keep absent operational evidence unknown; register metadata is not proof of receipt or invoice matching. */
export function normalizeRegisterRecord(raw = {}, kind = 'purchaseOrders', currentUserId, now = new Date()) {
  const isOrder = kind === 'purchaseOrders';
  const isPendingDocument = isOrder && raw.is_pending_document === true;
  const status = text(raw.status || 'unknown').toLowerCase();
  const steps = approvalSteps(raw, isOrder);
  const awaitingApproval = !CLOSED.has(status) && (isOrder
    ? status === 'draft' && (Boolean(raw.current_approval) || steps.some(step => step.active)) && !raw.approved_at && !raw.approved_by
    : REVIEW.has(status));
  const reviewDate = dateValue(raw.review_due_at);
  const reviewOverdue = !isOrder && awaitingApproval && reviewDate !== null && reviewDate.getTime() < now.getTime();
  const approved = Boolean(raw.approved_at || raw.approved_by) || (!isOrder && ['approved', 'converted'].includes(status));
  const summary = status === 'rejected' || steps.some(step => step.status === 'rejected') ? 'rejected'
    : approved ? 'approved' : reviewOverdue ? 'overdue' : awaitingApproval ? 'under_review'
      : status === 'draft' ? 'not_started' : 'not_recorded';
  const awaitingAcknowledgement = isOrder && status === 'sent' && !raw.confirmation_date;
  const buyerId = isOrder ? raw.created_by : raw.issued_by || raw.requested_by;
  const assigned = Boolean(currentUserId) && steps.some(step => step.active
    && String(step.raw.user_id || step.raw.approver_id || '') === String(currentUserId));
  const mine = !CLOSED.has(status) && (raw.can_approve === true || (!isOrder && assigned)
    || Boolean(currentUserId) && String(buyerId || '') === String(currentUserId));
  const deliveryDate = isOrder ? raw.expected_delivery || null : raw.required_date || null;
  const deliveryDay = dayValue(deliveryDate);
  const today = dayValue(now);
  const deliveryOverdue = deliveryDay !== null && today !== null && deliveryDay < today && !CLOSED.has(status);
  const createdAt = raw.created_at || null;
  const createdDay = dayValue(createdAt);
  const amount = number(isOrder ? raw.total_amount : raw.total_price);
  const currency = currencyCode(raw.currency);
  const validCurrency = isCurrency(currency);
  const statusMeta = (isOrder ? ORDER_STATUS : PR_STATUS)[status] || [firstText(raw.status_display, 'Unknown'), 'muted'];
  const nextStep = status === 'draft' ? awaitingApproval ? 'Review approval' : approved ? 'Ready to issue' : 'Complete order details'
    : awaitingAcknowledgement ? 'Confirm supplier acknowledgement'
      : deliveryOverdue ? 'Review delivery date'
        : status === 'acknowledged' || status === 'in_progress' ? 'Track delivery'
          : status === 'partially_received' ? 'Review remaining delivery'
            : awaitingApproval ? 'Review recommendation' : !isOrder && status === 'approved' ? 'Create purchase order'
              : CLOSED.has(status) ? 'View record' : 'Open record';
  const explicitReceipt = number(raw.receipt_percent);
  const record = {
    id: raw.id, raw, kind, isPendingDocument,
    linkedPrId: isOrder ? firstText(raw.pr_reference?.id, raw.pr_reference) || null : null,
    linkedPrNumber: isOrder ? firstText(raw.pr_number, raw.pr_reference?.pr_number) : '',
    number: firstText(isOrder ? raw.po_number : raw.pr_number, 'Number not recorded'),
    title: firstText(isOrder ? raw.title : raw.product_service, raw.title, raw.description, 'Untitled'),
    supplier: firstText(raw.vendor_name, raw.supplier_name, raw.vendor_details?.name, 'Not recorded'),
    supplierId: firstText(raw.vendor?.id, raw.vendor),
    project: firstText(raw.enterprise_project_code && [raw.enterprise_project_code, raw.enterprise_project_name].filter(Boolean).join(' — '), raw.project_display, raw.project_number, raw.project_department, raw.project_name, raw.project, 'Not recorded'),
    projectId: firstText(raw.enterprise_project && `core:${raw.enterprise_project}`, raw.project?.id, raw.project),
    buyer: firstText(isOrder ? raw.buyer_reference_pm : raw.requester_name, raw.issued_by_name, raw.created_by_name, 'Not recorded'),
    buyerId: buyerId == null ? '' : String(buyerId),
    status, statusLabel: awaitingApproval && isOrder ? 'Awaiting approval' : reviewOverdue ? 'Review overdue' : statusMeta[0],
    tone: reviewOverdue ? 'red' : awaitingApproval && isOrder ? 'amber' : statusMeta[1],
    createdAt, date: isOrder ? raw.po_date || null : raw.issued_date || null,
    deliveryDate, amount, currency, currencyValid: validCurrency,
    valueIssue: amount === null ? 'Amount not recorded' : !validCurrency ? 'Currency not verified' : '',
    ageDays: createdDay !== null && today !== null && today >= createdDay ? Math.floor((today - createdDay) / DAY) : null,
    approvalSummary: summary, approvalSteps: steps, mine,
    primaryAction: awaitingApproval ? 'review' : status === 'draft' ? 'edit' : awaitingAcknowledgement ? 'follow_up'
      : !isOrder && status === 'approved' ? 'convert' : 'open',
    nextStep, awaitingApproval, awaitingAcknowledgement, isDeliveryOverdue: deliveryOverdue,
    reviewDueAt: raw.review_due_at || null,
    receiptPercent: explicitReceipt !== null && explicitReceipt >= 0 && explicitReceipt <= 100 ? explicitReceipt : null,
    invoiceMatch: typeof raw.invoice_match_status === 'string' && raw.invoice_match_status.trim() ? raw.invoice_match_status : null,
    priority: text(raw.priority), type: text(raw.requisition_type || raw.category),
    items: array(raw.items).map((item, index) => {
      const quantity = number(item.quantity ?? item.qty);
      const unitPrice = number(item.unit_price);
      const discount = item.discount == null || item.discount === '' ? 0 : number(item.discount);
      const storedTotal = number(item.total ?? item.total_price ?? item.amount);
      const calculatedTotal = quantity !== null && unitPrice !== null && discount !== null
        ? Math.max(0, quantity * unitPrice - discount) : null;
      return {
      id: firstText(item.id, item.line_number, item.line_code, index + 1),
      description: firstText(item.description, item.item, item.item_name, item.name, 'Description not recorded'),
      quantity, unit: firstText(item.unit, item.uom, '—'),
      unitPrice, total: storedTotal ?? calculatedTotal, raw: item,
    }; }),
  };
  if (isPendingDocument) return {
    ...record, primaryAction: 'preview', nextStep: 'Review imported PDF',
    awaitingApproval: false, awaitingAcknowledgement: false, isDeliveryOverdue: false,
    approvalSummary: 'not_recorded', receiptPercent: null, invoiceMatch: null,
  };
  return isOrder ? record : { ...record, ...recommendationFields(record, currentUserId, now) };
}

function matchesStatus(record, filter) {
  if (!filter || ['all', 'value'].includes(filter)) return true;
  if (filter === 'ready_for_po') return record.readyForPO === true;
  if (filter === 'exceptions') return record.hasException === true;
  if (filter === 'incomplete') return record.incomplete === true;
  if (filter === 'stale') return record.staleDraft === true;
  if (filter === 'my_queue') return record.mine === true;
  if (filter === 'draft') return record.status === 'draft' && !record.awaitingApproval;
  if (['review', 'under_review', 'awaiting_approval'].includes(filter)) return record.awaitingApproval;
  if (filter === 'issued') return record.status === 'sent';
  if (filter === 'acknowledgement') return record.awaitingAcknowledgement;
  if (filter === 'in_delivery') return ['in_progress', 'partially_received'].includes(record.status);
  if (filter === 'overdue') return record.kind === 'purchaseOrders' ? record.isDeliveryOverdue : record.approvalSummary === 'overdue';
  if (filter === 'approved' && record.kind === 'purchaseOrders') return record.approvalSummary === 'approved';
  return record.status === filter;
}

export function filterRegisterRecords(records, filters = {}, currentUserId, now = new Date()) {
  const today = dayValue(now);
  const query = text(filters.search).toLowerCase();
  return records.filter(record => {
    if (query && ![record.number, record.title, record.supplier, record.project, record.buyer, record.requester, record.currentOwner, record.raw.pr_number, record.raw.description, record.raw.description_reason, record.raw.po_number_reference].join(' ').toLowerCase().includes(query)) return false;
    if (!matchesStatus(record, filters.status)) return false;
    for (const key of ['supplier', 'project', 'buyer', 'requester']) {
      const value = text(filters[key]);
      if (value && value !== 'all' && value !== record[key] && value !== record[`${key}Id`]) return false;
    }
    const saved = filters.savedView;
    if (saved === 'open' && (CLOSED.has(record.status) || record.isPendingDocument)) return false;
    if (saved && !['all', 'open'].includes(saved) && !matchesStatus(record, saved)) return false;
    if (filters.myActions && !(record.mine && currentUserId)) return false;
    const created = dayValue(record.createdAt);
    const age = created !== null && today !== null ? Math.floor((today - created) / DAY) : null;
    if (filters.created === 'today' && age !== 0) return false;
    if (filters.created === 'last30' && (age === null || age < 0 || age >= 30)) return false;
    if (filters.created === 'older30' && (age === null || age < 30)) return false;
    if (filters.created === 'undated' && created !== null) return false;
    if (filters.priority && filters.priority !== 'all' && record.priority !== filters.priority) return false;
    if (filters.type && filters.type !== 'all' && record.type !== filters.type) return false;
    const delivery = dayValue(record.deliveryDate);
    if (filters.delivery === 'overdue' && !record.isDeliveryOverdue) return false;
    if (filters.delivery === 'undated' && delivery !== null) return false;
    if (filters.delivery === 'next14' && (delivery === null || today === null || delivery < today || delivery > today + 14 * DAY || CLOSED.has(record.status))) return false;
    return true;
  });
}

export function registerMetrics(records, kind = 'purchaseOrders') {
  const isOrder = kind === 'purchaseOrders';
  if (isOrder) records = records.filter(record => !record.isPendingDocument);
  const descriptors = isOrder ? [
    ['all', 'All orders', 'ShoppingCartIcon', 'blue'], ['draft', 'Draft', 'DocumentTextIcon', 'muted'],
    ['review', 'Awaiting approval', 'ClockIcon', 'amber'], ['issued', 'Issued', 'PaperAirplaneIcon', 'blue'],
    ['acknowledgement', 'Awaiting acknowledgement', 'ExclamationTriangleIcon', 'amber'],
    ['in_delivery', 'In delivery', 'TruckIcon', 'green'], ['completed', 'Completed', 'CheckCircleIcon', 'green'],
  ] : [
    ['all', 'All recommendations', 'DocumentTextIcon', 'blue'], ['draft', 'Draft', 'DocumentTextIcon', 'muted'],
    ['review', 'Under review', 'ClockIcon', 'amber'], ['approved', 'Approved', 'CheckCircleIcon', 'green'],
    ['ready_for_po', 'Ready for PO', 'DocumentCheckIcon', 'blue'],
    ['converted', 'Converted to PO', 'ShoppingCartIcon', 'green'], ['exceptions', 'Exceptions', 'ExclamationTriangleIcon', 'amber'],
  ];
  const metrics = descriptors.map(([key, label, icon, tone]) => ({ key, label, icon, tone, filter: key, value: records.filter(record => matchesStatus(record, key)).length }));
  if (!isOrder) return metrics;
  const totals = new Map();
  let unverifiedCount = 0;
  for (const record of records) {
    if (record.amount === null || !record.currencyValid) { unverifiedCount += 1; continue; }
    totals.set(record.currency, (totals.get(record.currency) || 0) + record.amount);
  }
  const currencies = [...totals].sort(([left], [right]) => left.localeCompare(right));
  const summary = currencies.map(([currency, amount]) => formatRegisterMoney(amount, currency)).join(' · ');
  metrics.push({
    key: 'value', label: isOrder ? 'Total order value' : 'Total recommendation value',
    value: currencies.length === 1 ? formatRegisterMoney(currencies[0][1], currencies[0][0], { compact: true })
      : currencies.length > 1 ? `${currencies.length} currencies` : '—',
    icon: 'CurrencyDollarIcon', tone: 'blue', filter: 'all',
    description: [summary, unverifiedCount ? `${unverifiedCount} ${unverifiedCount === 1 ? 'record needs' : 'records need'} value verification` : ''].filter(Boolean).join(' · '),
    currencyTotals: currencies.map(([currency, amount]) => ({ currency, amount })), unverifiedCount,
  });
  return metrics;
}
