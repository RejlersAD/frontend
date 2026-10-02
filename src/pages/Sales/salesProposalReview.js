const reviewValidationFields = { file_id: 'PDF', file: 'PDF', body: 'Comment', anchor: 'Selection', page_number: 'Page', context: 'Context', kind: 'Comment type', note: 'Review note', outcome: 'Review decision', expected_version: 'Review version', expected_document_id: 'Document revision', expected_quote_updated_at: 'Proposal version', request_id: 'Request', is_resolved: 'Comment status', parent_id: 'Reply', document_id: 'Document', non_field_errors: '' };
const safeReviewErrorText = value => typeof value === 'string' && value.trim() && value.length <= 1000 && !/<\s*(?:!?doctype|\/?[a-z][^>]*>)/i.test(value) ? value.trim() : '';
export const proposalReviewError = (error, fallback = 'This action could not be completed. Your input is kept here.') => {
  const data = error?.response?.data;
  const detail = safeReviewErrorText(data?.detail);
  if (detail) return detail;
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const messages = Object.entries(reviewValidationFields).flatMap(([field, label]) => {
      const values = Array.isArray(data[field]) && data[field].length <= 10 ? data[field] : [data[field]];
      return values.map(safeReviewErrorText).filter(Boolean).map(message => label ? `${label}: ${message}` : message);
    });
    if (messages.length && messages.join(' ').length <= 1200) return messages.join(' ');
  }
  if (error?.response?.status === 403) return 'You no longer have permission for this action. Your input is kept here.';
  if (error?.response?.status === 404) return 'This proposal or document is no longer available.';
  return fallback;
};

export const reviewDate = value => {
  const date = value && new Date(value);
  return date && Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date) : 'Date unavailable';
};
export const reviewActor = actor => typeof actor?.name === 'string' && actor.name.trim() ? actor.name : 'Name unavailable';
export const reviewRevision = document => document ? `Revision ${String(document.revision).padStart(2, '0')}` : 'No document';
export const reviewStatus = value => value === 'internal_review' ? 'In review' : String(value || 'Status unavailable').replace(/_/g, ' ').replace(/^./, char => char.toUpperCase());

// Reject mismatched and incomplete envelopes before enabling a record command.
export const proposalReviewProjection = (data, proposalId, documentId = '') => {
  if (!data || String(data.quote?.id) !== String(proposalId) || !Array.isArray(data.documents) || !Array.isArray(data.comments) || !Array.isArray(data.submissions) || !data.capabilities || !data.counts) throw new Error('Invalid proposal review response.');
  const validDocument = doc => doc && typeof doc.id === 'string' && doc.id && typeof doc.name === 'string' && Number.isInteger(doc.revision) && doc.revision > 0 && Number.isInteger(doc.page_count) && doc.page_count > 0 && Number.isInteger(doc.feedback_version) && doc.feedback_version >= 0 && typeof doc.is_current === 'boolean';
  if (data.documents.some(doc => !validDocument(doc)) || (data.selected_document && !validDocument(data.selected_document))) throw new Error('Invalid proposal document response.');
  if (data.comments.some(comment => !comment || typeof comment.id !== 'string' || typeof comment.body !== 'string' || typeof comment.is_resolved !== 'boolean')) throw new Error('Invalid proposal comments response.');
  if (['all', 'open', 'resolved'].some(key => !Number.isInteger(data.counts[key]) || data.counts[key] < 0)) throw new Error('Invalid proposal comment counts.');
  if (documentId && data.selected_document?.id !== documentId) throw new Error('The selected revision did not match the response.');
  const capabilities = Object.fromEntries(['can_preview', 'can_download', 'can_bind', 'can_comment', 'can_resolve', 'can_submit'].map(key => [key, data.capabilities[key] === true]));
  return { ...data, capabilities: { ...capabilities, deny_reason: typeof data.capabilities.deny_reason === 'string' ? data.capabilities.deny_reason : '' } };
};

export const mergeReviewComments = (previous, next) => [...new Map([...previous, ...next].map(comment => [comment.id, comment])).values()];
export const proposalThreads = comments => comments.filter(comment => !comment.parent_id).map(comment => ({ ...comment, replies: comments.filter(reply => reply.parent_id === comment.id) }));
