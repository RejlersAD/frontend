// Read retries only. Mutations with unknown effects must not be replayed automatically.
export const MAX_READ_ATTEMPTS = 2
export const READ_RETRY_DELAY_MS = 4000
export const MAX_POLL_FAILURES = 2

const countKnown = value => Number.isSafeInteger(value) && value >= 0
const hasId = data => Number.isSafeInteger(data?.id) && data.id > 0 ||
  typeof data?.id === 'string' && /^[1-9]\d*$/.test(data.id)
const reference = (data, kind) => hasId(data) ? ` (${kind} #${data.id})` : ''
const hasError = data => Boolean(data?.error) || data?.success === false ||
  Boolean(data?.error_message) || Boolean(data?.errors)
const unconfirmed = label => ({
  type: 'warning',
  message: `${label} outcome is unconfirmed. Review the recorded status before retrying; completion has not been verified.`,
})

/** Classify the existing metadata-retrieval log, never the HTTP response code. */
export function syncOutcome(data) {
  const log = reference(data, 'log')
  if (data?.status === 'failed') {
    return { type: 'error', message: `Metadata retrieval failed${log}. Review Sync History before retrying.` }
  }
  if (!hasId(data)) return unconfirmed('Metadata retrieval')
  if (data.status === 'pending' || data.status === 'in_progress') {
    return {
      type: hasError(data) ? 'warning' : 'info',
      message: `Metadata retrieval is ${data.status === 'pending' ? 'pending' : 'in progress'}${log}. Completion has not been confirmed.${hasError(data) ? ' The run also reports an error; review Sync History.' : ''}`,
    }
  }

  const validated = data.sync_details?.retrieval_validated === true &&
    data.sync_details?.effect === 'metadata_retrieval'
  const countsKnown = [data.records_requested, data.records_synced, data.records_failed].every(countKnown) &&
    data.records_requested >= data.records_synced
  if (!validated || !countsKnown) return unconfirmed('Metadata retrieval')

  if (data.status === 'success' && data.records_failed === 0 &&
      data.records_requested === data.records_synced && data.error_message === '' && !hasError(data)) {
    return {
      type: 'success',
      message: `Metadata retrieval completed${log}: ${data.records_synced} records retrieved. No RADAI records were imported.`,
    }
  }
  if (data.status === 'partial') {
    const remaining = data.records_requested > data.records_synced
      ? ' Additional requested records were not retrieved in this run.' : ''
    return {
      type: 'warning',
      message: `Metadata retrieval partially completed${log}: ${data.records_synced} of ${data.records_requested} records retrieved; ${data.records_failed} reported failures.${remaining} No RADAI records were imported.`,
    }
  }
  return unconfirmed('Metadata retrieval')
}

/** Existing S3 jobs expose pending acceptance separately from verified completion. */
export function jobOutcome(data, label = 'Export') {
  const job = reference(data, 'job')
  if (data?.status === 'failed') {
    const effects = countKnown(data.records_exported) && data.records_exported > 0
      ? ` ${data.records_exported} records were exported before failure; completed effects may remain.` : ''
    const failures = countKnown(data.records_failed)
      ? ` Reported failures: ${data.records_failed}.` : ''
    return { type: 'error', message: `${label} failed${job}.${effects}${failures} Review job history before retrying.` }
  }
  if (!hasId(data)) return unconfirmed(label)
  if (data.status === 'pending' || data.status === 'in_progress') {
    return {
      type: hasError(data) ? 'warning' : 'info',
      message: `${label} is ${data.status === 'pending' ? 'pending' : 'in progress'}${job}. Completion has not been confirmed.${hasError(data) ? ' The job also reports an error; review job history.' : ''}`,
    }
  }
  if (data.status === 'stopped') {
    return { type: 'info', message: `${label} stopped${job}. Stopping does not undo completed effects.` }
  }
  if (data.status === 'success' && countKnown(data.records_exported) &&
      data.records_failed === 0 && typeof data.completed_at === 'string' &&
      Number.isFinite(Date.parse(data.completed_at)) && data.error_message === '' && !hasError(data)) {
    return { type: 'success', message: `${label} completed${job}: ${data.records_exported} records exported.` }
  }
  return unconfirmed(label)
}

/** Axios may wrap transport failures; any permanent authorization failure wins. */
export function isTransientWrenchError(error) {
  const seen = new Set()
  const chain = []
  let current = error
  while (current && typeof current === 'object' && !seen.has(current)) {
    chain.push(current)
    seen.add(current)
    current = current.originalError
  }
  const statuses = chain.map(item => item.response?.status).filter(value => value != null)
  if (statuses.some(status => status === 401 || status === 403) ||
      chain.some(item => item.code === 'ERR_CANCELED')) return false
  // A concrete permanent HTTP response takes precedence over transport flags.
  if (statuses.length) return statuses.every(status => [408, 429, 500, 502, 503, 504].includes(status))
  return chain.some(item => item.isNetworkError === true || item.isTimeout === true ||
    ['ECONNABORTED', 'ETIMEDOUT', 'ERR_NETWORK'].includes(item.code))
}
