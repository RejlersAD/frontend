// Only designated PR source files belong in the PR preview, not quotations or
// other supporting attachments. A missing link still counts as an original.
export const getOriginalRecommendationDocuments = (attachments, documentSha = '') => (
  (Array.isArray(attachments) ? attachments : []).filter(item => item && (
    item.type === 'signed_purchase_requisition_pdf'
    || item.document_type === 'signed_purchase_requisition_pdf'
  )).sort((left, right) => {
    // The approval evidence identifies the current signed document, including
    // older imports that did not record an upload time. Keep earlier files
    // available in the selector without defaulting to superseded evidence.
    const current = item => Boolean(documentSha && item.sha256 === documentSha)
    return Number(current(right)) - Number(current(left))
      || (Date.parse(right.uploaded_at || '') || 0) - (Date.parse(left.uploaded_at || '') || 0)
  })
)

export const getOriginalRecommendationUrl = attachment => (
  [attachment?.url, attachment?.s3_url].find(value => (
    typeof value === 'string' && /^(https?:\/\/|\/(?!\/))/i.test(value)
  )) || ''
)
