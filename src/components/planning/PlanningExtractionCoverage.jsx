import React from 'react'
import PropTypes from 'prop-types'
import { aiAnalysisOutcome } from '../../utils/planningAnalysisOutcome'
import './PlanningDurationEvidence.css'

const count = value => Number.isInteger(value) && value >= 0 ? value : 'Not Specified'
const statusLabel = status => ({
  complete: 'Text extraction complete', partial: 'Partial extraction',
  failed: 'Extraction failed', unsupported: 'Unsupported content',
  pending: 'Pending extraction', processing: 'Extracting',
})[status] || 'Not Specified'

export default function PlanningExtractionCoverage({ coverage, aiCoverage, onAiSettings, onRetryAnalysis, busy = false, previousResult = false }) {
  const ai = aiAnalysisOutcome(aiCoverage)
  const needsAttention = ['failed', 'partial'].includes(ai.status)
  return <section className="pde-summary" aria-label="Extraction coverage">
    <strong>{previousResult ? 'Previous saved analysis — ' : 'Extraction coverage: '}{statusLabel(coverage?.status)}</strong>
    <p>Reading every document page completes text extraction, not AI analysis. AI processing has its own status and chunk counts below. Review the source findings before planning.</p>
    {!coverage && <p>Coverage was not recorded for this analysis. Reanalyze the documents to obtain an extraction report.</p>}
    {coverage && <div><span>{count(coverage.analyzed_file_count)} of {count(coverage.file_count)} files analyzed</span><span>{count(coverage.complete_file_count)} files with complete text extraction</span></div>}
    {aiCoverage ? <p>{previousResult ? 'Previous AI analysis coverage' : 'AI analysis coverage'}: {ai.status === 'not_run' ? `Not run${aiCoverage.reason ? ` (${aiCoverage.reason})` : ''}` : <>{ai.label}; {count(aiCoverage.chunks_processed)} of {count(aiCoverage.chunks_total)} chunks processed, {count(aiCoverage.chunks_skipped)} skipped, {count(aiCoverage.chunks_failed)} failed. {count(aiCoverage.rejected_claim_count)} unsupported claims rejected.</>}</p> : <p>{previousResult ? 'Previous AI analysis coverage' : 'AI analysis coverage'}: Not recorded.</p>}
    {needsAttention && <aside className="pde-analysis-warning" role="status"><strong>{previousResult ? ai.status === 'failed' ? 'The previous saved AI analysis failed. Its source findings are retained.' : 'The previous saved AI analysis is incomplete. Its source findings are retained.' : ai.message}</strong>{ai.diagnostic && <p>{previousResult ? 'Saved diagnostic: ' : ''}{ai.diagnostic.message}</p>}{!ai.diagnostic && ai.status === 'failed' && <p>The failure reason was not recorded in this saved analysis.</p>}<p>{previousResult ? 'These counts and diagnostics do not describe the analysis currently being monitored. The new result will appear when its findings are saved.' : ai.recoveryMessage}</p><div className="pde-analysis-actions">{onAiSettings && (ai.recoveryAction === 'ai_settings' || !ai.diagnostic) && <button type="button" className="pln-button" disabled={busy} onClick={onAiSettings}>Review AI settings</button>}{onRetryAnalysis && <button type="button" className="pln-button" disabled={busy} onClick={onRetryAnalysis}>{busy ? 'Analyzing…' : 'Retry document analysis'}</button>}</div></aside>}
    {coverage?.files?.length > 0 && <details className="pde-packages"><summary>Document extraction details ({coverage.files.length})</summary>
      <div className="pde-package-scroll" tabIndex={0} role="region" aria-label="Document extraction details"><table><thead><tr><th>Document</th><th>Status</th><th>Processed / total</th><th>Issues</th></tr></thead><tbody>{coverage.files.map((file, index) => <tr key={file.file_id ?? index}><th scope="row">{file.filename || 'Not Specified'}</th><td>{statusLabel(file.status)}{file.included_in_analysis === false && <small>Not included in analysis</small>}</td><td>{count(file.units_processed)} / {count(file.units_total)} {file.unit_type || 'units'}</td><td>{file.text_truncated && <p>Extracted text was truncated.</p>}{(file.issues || []).map((issue, issueIndex) => <p key={issueIndex}>{issue.page != null && `Page ${issue.page}: `}{issue.sheet && `${issue.sheet}: `}{issue.message || issue.code || 'Review required'}</p>)}{!file.text_truncated && !file.issues?.length && 'No extraction issues reported'}</td></tr>)}</tbody></table></div>
    </details>}
  </section>
}
PlanningExtractionCoverage.propTypes = { coverage: PropTypes.object, aiCoverage: PropTypes.object, onAiSettings: PropTypes.func, onRetryAnalysis: PropTypes.func, busy: PropTypes.bool, previousResult: PropTypes.bool }
