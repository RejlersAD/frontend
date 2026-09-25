// Source decisions are historical evidence, never assignments for a live workflow.
export function recommendationSourceApprovals(requisition) {
  const rows = requisition?.price_remarks_data?.signed_document_verification?.source_approval_rows;
  if (!Array.isArray(rows)) return [];
  return rows.map((row, source_row_index) => ({ ...row, source_row_index }))
    .filter(row => row.external === true
    && row.source === 'signed_purchase_requisition_pdf').map(row => ({
    ...row,
    status: row.signature_verified === false ? 'not_recorded' : row.status || 'not_recorded',
    approved_at: row.signature_verified === false ? null : row.approved_at,
  }));
}

const text = value => typeof value === 'string' ? value.trim() : '';
const ROLES = ['pm', 'moe', 'mop', 'vp'];
const normalizedName = value => text(value).toLowerCase().replace(/[^a-z ]/g, '').replace(/\s+/g, ' ');
const RICHA_NAMES = new Set(['richa', 'richa thomas', 'richa hannah thomas']);

export function isLevelZeroApprover(value, reference) {
  const row = typeof value === 'string' ? { user_name: value } : value || {};
  const referenceId = reference?.id || reference?.user_id;
  return Boolean(referenceId && row.user_id && String(row.user_id) === String(referenceId))
    || RICHA_NAMES.has(normalizedName(row.user_name || row.approved_by_name || row.name));
}

export const isUnknownApprover = value => !text(value)
  || /^(?:unknown(?:\s+.*)?|not\s+(?:detected|recorded|known|available)|unidentified|unreadable|n\/?a|none|null|[-?\d\s]+)$/i.test(text(value));

export function normalizeSourceApprovalReview(review) {
  const approval_labels = Object.fromEntries(ROLES.map(role => [role, text(review?.approval_labels?.[role])]).filter(([, label]) => label));
  const approver_notes = Object.fromEntries(ROLES.map(role => [role, text(review?.approver_notes?.[role])]).filter(([, note]) => note));
  const additional = review?.additional_approver;
  const name = text(additional?.name);
  const approval_label = text(additional?.approval_label);
  const signature_verified = additional?.signature_verified === true;
  const special_note = text(additional?.special_note);
  return {
    approval_labels,
    ...(Object.keys(approver_notes).length ? { approver_notes } : {}),
    additional_approver: name || approval_label || signature_verified || special_note
      ? { name, approval_label, signature_verified, ...(special_note ? { special_note } : {}) } : null,
  };
}

export function recommendationSourceReview(requisition) {
  if (requisition?.source_approval_review) return normalizeSourceApprovalReview(requisition.source_approval_review);
  const metadata = requisition?.price_remarks_data;
  const saved = metadata?.signed_approval_evidence?.source_approval_review;
  return normalizeSourceApprovalReview(saved?.document_sha256
    && saved.document_sha256 === metadata?.signed_document_verification?.document_sha256 ? saved.review : undefined);
}

export function approvalLevelLabel(row) {
  const label = text(row?.approval_label);
  if (label) return /^\d+$/.test(label) ? `Level ${label}` : label;
  return row?.level !== undefined && row.level !== null && String(row.level).trim() !== '' ? `Level ${row.level}` : '';
}

const canonicalRole = row => {
  if (ROLES.includes(row?.role_key)) return row.role_key;
  const role = text(row?.role || row?.stage).toLowerCase().replace(/[^a-z ]/g, '').replace(/\s+/g, ' ');
  if (/\bpm\b|^project manager$/.test(role)) return 'pm';
  if (/\b(?:moe|engineering manager|manager of engineering)\b/.test(role)) return 'moe';
  if (/\b(?:mop|manager of projects|projects manager)\b/.test(role)) return 'mop';
  if (/\b(?:vp|vp op|vp operations|vice president operations)\b/.test(role)) return 'vp';
  return '';
};

// Presentation only. Callers must continue using the saved workflow for authority.
export function recommendationDisplayApprovals(requisition, displayedWorkflow = []) {
  const review = recommendationSourceReview(requisition);
  const sourceRows = recommendationSourceApprovals(requisition);
  const rows = (displayedWorkflow.length ? displayedWorkflow : sourceRows)
    .filter(row => row && typeof row === 'object' && !Array.isArray(row)).map(row => {
    const role = canonicalRole(row);
    const source = row.external && sourceRows.find(item => item.step === row.step
      && item.role === row.role && item.user_name === row.user_name);
    return { ...row, ...(source ? { source_row_index: source.source_row_index } : {}),
      ...(role && review.approval_labels[role] ? { approval_label: review.approval_labels[role] } : {}),
      ...(role && review.approver_notes?.[role] ? { special_note: review.approver_notes[role] } : {}) };
  });
  if (review.additional_approver) {
    const additional = review.additional_approver;
    rows.push({ role: 'Additional', user_name: additional.name, approval_label: additional.approval_label,
      special_note: additional.special_note || '', signature_verified: additional.signature_verified,
      status: additional.signature_verified ? 'verified' : 'not_recorded', approved_at: null,
      source_review_annotation: true });
  }
  const reference = requisition?.default_level_zero_approver;
  const referenceId = reference?.id || reference?.user_id;
  const richaIndex = rows.findIndex(row => isLevelZeroApprover(row, reference));
  if (richaIndex >= 0) {
    const [richa] = rows.splice(richaIndex, 1);
    rows.unshift({ ...richa, level: 0, approval_label: '0' });
  } else {
    rows.unshift({ role: 'Procurement', level: 0, approval_label: '0',
      user_name: text(reference?.full_name || reference?.user_name || reference?.name) || 'Richa Hannah Thomas',
      ...(referenceId ? { user_id: referenceId } : {}), status: 'not_recorded', approved_at: null,
      signature_verified: false, default_level_zero: true });
  }
  return rows;
}
