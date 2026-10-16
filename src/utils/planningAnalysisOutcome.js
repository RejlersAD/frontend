const knownCount = value => Number.isInteger(value) && value >= 0

export function aiAnalysisOutcome(coverage) {
  if (!coverage) return { status: 'unknown', label: 'Not recorded' }
  if (coverage.status === 'not_run') return { status: 'not_run', label: 'Not run' }
  const processed = coverage.chunks_processed
  const failed = coverage.chunks_failed
  const incomplete = failed > 0 || coverage.chunks_skipped > 0 || coverage.chunks_remaining > 0
    || (knownCount(processed) && knownCount(coverage.chunks_total) && processed < coverage.chunks_total)
  const diagnostics = (Array.isArray(coverage.chunks) ? coverage.chunks : []).map(chunk => chunk.error).filter(error =>
    error && typeof error.message === 'string' && ['ai_settings', 'retry_analysis'].includes(error.next_action))
  const diagnostic = diagnostics.find(error => error.next_action === 'ai_settings') || diagnostics[0]
  const recoveryAction = diagnostic?.next_action || 'retry_analysis'
  const recoveryMessage = diagnostic?.code === 'credit_balance_exhausted'
    ? 'Restore the API account credit balance, then resume the unfinished analysis. Completed sections are retained.'
    : recoveryAction === 'ai_settings'
    ? 'Review AI settings and test the connection before retrying document analysis.'
    : diagnostic
      ? diagnostic.code === 'output_limit'
        ? 'Retry document analysis to process failed or remaining source sections in smaller parts.'
        : 'Retry document analysis to process the failed or remaining chunks.'
      : 'Review the saved findings and retry document analysis. The saved result does not identify a connection problem.'
  const recovery = { diagnostic, recoveryAction, recoveryMessage }
  if (coverage.status === 'failed' || (processed === 0 && failed > 0)) {
    return { status: 'failed', label: 'Failed', ...recovery, message: 'AI analysis failed. Extracted source facts are still available for review.' }
  }
  if (coverage.status === 'partial' || incomplete) {
    return { status: 'partial', label: 'Partial', ...recovery, message: 'AI analysis is incomplete. Review the failed or unprocessed chunks before relying on its findings.' }
  }
  if (coverage.status === 'complete' && knownCount(processed) && processed === coverage.chunks_total) {
    return { status: 'complete', label: 'All stored text chunks processed' }
  }
  return { status: 'unknown', label: 'Not Specified' }
}

export function planningAnalysisOutcome(intelligence) {
  if (!intelligence) return { type: 'error', message: 'Document analysis returned no findings. Please retry analysis.' }
  const ai = aiAnalysisOutcome(intelligence.ai_processing_coverage)
  if (ai.status === 'failed') return { type: 'warning', message: `Document analysis needs attention: AI analysis failed. Extracted source facts remain available. ${ai.recoveryMessage}` }
  if (ai.status === 'partial') return { type: 'warning', message: `Document analysis is incomplete. Some AI chunks were not processed. ${ai.recoveryMessage}` }
  const extraction = intelligence.processing_coverage?.status
  if (['partial', 'failed', 'unsupported', 'pending', 'processing'].includes(extraction)) {
    return { type: 'warning', message: 'Document analysis needs attention: text extraction is incomplete. Review the document extraction details.' }
  }
  if (ai.status === 'not_run') return { type: 'info', message: 'Source analysis finished. AI analysis was not run; review the extracted findings.' }
  if (extraction !== 'complete' || ai.status === 'unknown') return { type: 'info', message: 'Document analysis finished. Coverage was not fully recorded; review the extracted findings.' }
  return { type: 'success', message: 'Document analysis completed. Review the extracted findings.' }
}
