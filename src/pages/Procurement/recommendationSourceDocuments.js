// Only designated PR source files belong in the PR preview, not quotations or
// other supporting attachments. A missing link still counts as an original.
export const getOriginalRecommendationDocuments = attachments => (
  (Array.isArray(attachments) ? attachments : []).filter(item => item && (
    item.type === 'signed_purchase_requisition_pdf'
    || item.document_type === 'signed_purchase_requisition_pdf'
  ))
)

export const getOriginalRecommendationUrl = attachment => (
  [attachment?.url, attachment?.s3_url].find(value => (
    typeof value === 'string' && /^(https?:\/\/|\/(?!\/))/i.test(value)
  )) || ''
)
