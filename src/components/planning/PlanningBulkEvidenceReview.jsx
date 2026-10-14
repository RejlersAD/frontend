import React, { useState } from 'react'
import PropTypes from 'prop-types'
import { CheckCircle2, Loader2, Sparkles } from 'lucide-react'

const number = value => Number.isFinite(value) && value >= 0 ? value.toLocaleString() : 'Not available'
const groups = value => Array.isArray(value) ? value : []
const DEFAULT_REASON = 'Accept source-verified candidates through RADAI bulk review; leave missing or ambiguous evidence unresolved.'

export default function PlanningBulkEvidenceReview({ summary, review, operation, disabledReason, onGroup, group, onReload }) {
  const [reason, setReason] = useState(DEFAULT_REASON)
  if (!summary) return null
  const { job, running, starting, error, pollError, start, checkProgress } = operation
  const result = job?.result_data || {}
  const context = job?.progress_context || result.progress_context || {}
  const progressCounts = context.counts || context
  const counts = running || ['failed', 'cancelled'].includes(job?.status)
    ? { ...result.counts, ...progressCounts } : { ...progressCounts, ...result.counts }
  const finished = ['succeeded', 'failed', 'cancelled'].includes(job?.status)
  const complete = job?.status === 'succeeded' && result.review_complete === true
  const progress = Number.isFinite(job?.progress) ? Math.max(0, Math.min(100, job.progress)) : null
  const availableGroups = finished && Array.isArray(result.unresolved_groups) ? result.unresolved_groups : groups(summary.unresolved_groups)
  const blocked = disabledReason || (summary.enabled !== true ? 'Bulk review is unavailable for this review.' : '')
  const disabled = Boolean(blocked || running || error || !reason.trim())
  const sourceCount = summary.verified_unambiguous
  const conflictCount = summary.conflict_groups
  const hasVerified = Number.isFinite(sourceCount) && sourceCount > 0
  const hasAiWork = hasVerified || Number.isFinite(conflictCount) && conflictCount > 0
  const canRecheck = summary.eligibility_rechecked_on_run === true && summary.total_open > 0
  const processedIssuesKnown = Number.isFinite(counts.processed) && Number.isFinite(counts.total)
  const processedGroupsKnown = Number.isFinite(progressCounts.completed_groups) && Number.isFinite(progressCounts.total_groups)
  const recordedCounts = ['accepted_verified', 'accepted_ai', 'unresolved', 'skipped'].some(key => Number.isFinite(counts[key]))

  return <section className="per-bulk" aria-label="Bulk evidence review">
    <div className="per-bulk-heading"><div><h4>Review the full evidence queue</h4><p>Accept source-verified candidates in one run. Missing information and unresolved conflicts stay in the review queue.</p></div>
      <div className="per-bulk-actions">
        <button type="button" className="per-primary" disabled={disabled || summary.ai_available !== true || !hasAiWork && !canRecheck} onClick={() => start('ai_verified', reason)}><Sparkles size={15} aria-hidden="true" />AI resolve &amp; accept</button>
        <button type="button" disabled={disabled || !hasVerified && !canRecheck} onClick={() => start('verified', reason)}><CheckCircle2 size={15} aria-hidden="true" />Accept verified values</button>
      </div>
    </div>
    <dl className="per-bulk-counts" aria-label="Full evidence queue counts">
      <div><dt>Open issues</dt><dd>{number(summary.total_open)}</dd></div>
      <div><dt>Verified unambiguous values</dt><dd>{number(sourceCount)}</dd></div>
      <div><dt>Conflict groups</dt><dd>{number(conflictCount)}</dd></div>
    </dl>
    {blocked && <p className="per-bulk-note">{blocked}</p>}
    {summary.ai_available !== true && <p className="per-bulk-note">AI review unavailable: {summary.ai_reason || 'An enabled AI provider is required.'}</p>}
    {summary.eligibility_rechecked_on_run === true && <p className="per-bulk-note">Source eligibility is checked during each run, including citations that can be verified from the original files.</p>}
    {!blocked && !running && !hasAiWork && !canRecheck && <p className="per-bulk-note">No eligible source values are available for bulk acceptance. Review the remaining issues individually.</p>}
    <details className="per-bulk-reason"><summary>Decision reason</summary><label>Bulk decision reason<textarea aria-label="Bulk decision reason" maxLength={4000} value={reason} disabled={running} onChange={event => setReason(event.target.value)} /></label><small>This reason is recorded with the bulk decisions. Original source evidence is retained.</small></details>
    {error && <div className="per-message is-error" role="alert"><span>{error}</span><button type="button" onClick={onReload}>Reload review</button></div>}
    {(running || finished) && <div className="per-bulk-result">
      <p className="per-bulk-status" role="status">{running ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : complete ? <CheckCircle2 size={15} aria-hidden="true" /> : null}<strong>{starting ? 'Starting bulk review…' : running ? job.message || 'Reviewing source evidence…' : complete ? 'Bulk review complete' : job.status === 'succeeded' ? 'Bulk review finished with unresolved issues' : job.status === 'failed' ? 'Bulk review failed' : job.status === 'cancelled' ? 'Bulk review cancelled' : 'Bulk review needs attention'}</strong></p>
      {running && !starting && <><progress aria-label="Bulk review progress" max="100" {...(progress == null ? {} : { value: progress })} /><p className="per-bulk-note">{processedGroupsKnown ? `${number(progressCounts.completed_groups)} of ${number(progressCounts.total_groups)} conflict groups reviewed. ` : processedIssuesKnown ? `${number(counts.processed)} of ${number(counts.total)} issues processed. ` : ''}Processing continues if you leave this page.</p></>}
      {job && (finished || recordedCounts) && <dl className="per-bulk-counts" aria-label="Bulk review results"><div><dt>Source values accepted</dt><dd>{number(counts.accepted_verified)}</dd></div><div><dt>AI selections accepted</dt><dd>{number(counts.accepted_ai)}</dd></div><div><dt>Unresolved issues</dt><dd>{number(counts.unresolved)}</dd></div><div><dt>Skipped value groups</dt><dd>{number(counts.skipped)}</dd></div></dl>}
      {finished && job.status !== 'succeeded' && <p className="per-bulk-note">{job.error_message || job.message || 'The review did not finish.'} Recorded decisions are retained; check the remaining issues before starting another run.</p>}
      {finished && <p className="per-bulk-note">{result.calculation_ready === true ? 'Evidence is ready for calculation review.' : 'Check calculation readiness and the remaining issues below.'} Schedule creation, calculation and baseline approval remain separate actions.</p>}
      {groups(result.warnings).map((warning, index) => <p className="per-bulk-note" key={index}>{typeof warning === 'string' ? warning : warning.message || warning.code}</p>)}
    </div>}
    {pollError && <div className="per-message is-warning" role="alert"><span>Progress could not be checked. The job may still be running. {pollError}</span><button type="button" onClick={checkProgress}>Check progress</button></div>}
    {availableGroups.length > 0 && <div className="per-bulk-groups" aria-label="Unresolved evidence groups"><span>Review remaining issues</span>{availableGroups.filter(item => item.count > 0).map(item => <button type="button" key={item.key} aria-pressed={group === item.key} onClick={() => onGroup(item.key)}>{item.label || item.key} ({number(item.count)})</button>)}</div>}
    {group && <div className="per-bulk-filter"><span>Showing one issue group in the queue.</span><button type="button" onClick={() => onGroup('')}>Show all evidence issues</button></div>}
    <small className="per-bulk-note">Counts cover the full project review at revision {review.revision}. Individual decisions remain available below.</small>
  </section>
}

PlanningBulkEvidenceReview.propTypes = { summary: PropTypes.object, review: PropTypes.object.isRequired, operation: PropTypes.object.isRequired,
  disabledReason: PropTypes.string, onGroup: PropTypes.func.isRequired, group: PropTypes.string, onReload: PropTypes.func.isRequired }
