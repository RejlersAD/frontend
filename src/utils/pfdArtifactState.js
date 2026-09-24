// Review labels describe persisted evidence, never model confidence.
export function conversionReviewLabel(conversion) {
  const labels = {
    approved: 'Approved for this output',
    unreviewed: 'Unreviewed',
    legacy_approved: 'Legacy approval recorded; exact output binding unavailable',
    unavailable: 'Artifact unavailable',
    integrity_mismatch: 'Artifact integrity mismatch; approval cannot be confirmed',
  }
  return labels[conversion?.artifact?.review_state] || 'Review state unavailable'
}

export function hasConversionAction(conversion, action) {
  return Array.isArray(conversion?.allowed_actions) && conversion.allowed_actions.includes(action)
}

export function isNewUnreviewedArtifact(previous, result) {
  return Boolean(result?.id && result.id !== previous?.id && result.status === 'completed' &&
    typeof previous?.pfd_document === 'string' && previous.pfd_document && result.pfd_document === previous.pfd_document &&
    result.artifact?.identity === result.id && result.artifact?.available === true &&
    result.artifact?.source_conversion_id === previous?.id &&
    result.artifact?.review_state === 'unreviewed' && /^[a-f0-9]{64}$/i.test(result.artifact?.sha256 || '') &&
    !result.reviewed_by && !result.reviewed_at && !result.review_notes)
}

export function artifactDownloadFilename(conversion, headers = {}) {
  const contentType = String(headers['content-type'] || '').split(';')[0].trim().toLowerCase()
  const extensions = { 'application/pdf': 'pdf', 'image/png': 'png', 'image/jpeg': 'jpg' }
  const dispositionExtension = String(headers['content-disposition'] || '').match(/\.(pdf|png|jpe?g)(?:[";\s]|$)/i)?.[1]?.toLowerCase()
  const extension = extensions[contentType] || dispositionExtension || 'bin'
  const safe = value => Array.from(String(value || ''), character =>
    character.charCodeAt(0) < 32 || '<>:"/\\|?*'.includes(character) ? '_' : character).join('')
  return `${safe(conversion.pid_drawing_number || 'PID')}_${safe(conversion.pid_revision || 'revision')}_${safe(conversion.id)}.${extension}`
}

export async function pfdOperationError(error, fallback) {
  const source = error?.originalError || error
  let data = source?.response?.data
  if (typeof Blob !== 'undefined' && data instanceof Blob) {
    try { data = JSON.parse(await data.text()) } catch { data = null }
  }
  if (source?.response?.status === 403) return 'Access denied for this operation. The selected output is unchanged.'
  if (source?.response?.status === 409) return 'The output or its review changed. Reload outputs before retrying; the selected output has been preserved.'
  if (source?.code === 'ECONNABORTED' || source?.message?.includes('timeout')) {
    return 'The operation outcome is not confirmed. Reload outputs to check before retrying; the selected output has been preserved.'
  }
  return (typeof data?.error === 'string' && data.error) ||
    (typeof data?.detail === 'string' && data.detail) || fallback
}
