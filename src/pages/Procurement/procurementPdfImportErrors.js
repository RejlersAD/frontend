export const importDetailText = detail => {
  if (typeof detail === 'string') return detail.trim();
  if (Array.isArray(detail)) return detail.map(importDetailText).filter(Boolean).join(' ');
  if (!detail || typeof detail !== 'object') return '';
  const labels = { approved_by_name: 'Approver name', approved_by_title: 'Approver title', approved_date: 'Approval date', file: 'PDF file' };
  return Object.entries(detail).map(([field, value]) => {
    const message = importDetailText(value);
    if (!message) return '';
    return field === 'non_field_errors' ? message : `${labels[field] || field.replaceAll('_', ' ')}: ${message}`;
  }).filter(Boolean).join(' ');
};

export const importErrorMessage = problem => {
  const original = problem.originalError || problem;
  const response = problem.response || original.response;
  const status = response?.status;
  const details = response?.data;
  const message = details && typeof details === 'object'
    ? importDetailText(details.error || details.detail || details.message || details.errors
      || ([400, 422].includes(status) ? details : null))
    : '';
  if (message) return message;
  if (problem.isTimeout || ['ECONNABORTED', 'ETIMEDOUT'].includes(original.code) || [408, 504].includes(status)) {
    return 'PDF import timed out before completion could be confirmed. Check the purchase order register before retrying; the upload may have completed.';
  }
  if (problem.isNetworkError || original.code === 'ERR_NETWORK') {
    return 'The connection was interrupted before the import could be confirmed. Check your connection and the purchase order register before retrying.';
  }
  if (status === 413) return 'The server rejected the PDF because it is too large. Choose a smaller PDF and try again.';
  if (status >= 500) {
    return 'The server could not complete the PDF import. Check the purchase order register before retrying; the upload may have completed.';
  }
  return 'The signed PO PDF could not be imported. Please try again.';
};
