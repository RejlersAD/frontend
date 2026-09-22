import React from 'react'
import PropTypes from 'prop-types'
import './PlanningDurationEvidence.css'

const count = value => Number.isInteger(value) && value >= 0 ? value : 'Not Specified'
const statusLabel = status => ({
  complete: 'Text extraction complete', partial: 'Partial extraction',
  failed: 'Extraction failed', unsupported: 'Unsupported content',
  pending: 'Pending extraction', processing: 'Extracting',
})[status] || 'Not Specified'

export default function PlanningExtractionCoverage({ coverage, aiCoverage }) {
  return <section className="pde-summary" aria-label="Extraction coverage">
    <strong>Extraction coverage: {statusLabel(coverage?.status)}</strong>
    <p>Text extraction does not confirm that every requirement or relationship has been understood. Review the source findings before planning.</p>
    {!coverage && <p>Coverage was not recorded for this analysis. Reanalyze the documents to obtain an extraction report.</p>}
    {coverage && <div><span>{count(coverage.analyzed_file_count)} of {count(coverage.file_count)} files analyzed</span><span>{count(coverage.complete_file_count)} files with complete text extraction</span></div>}
    {aiCoverage && <p>AI analysis coverage: {aiCoverage.status === 'not_run' ? `Not run${aiCoverage.reason ? ` (${aiCoverage.reason})` : ''}` : <>{aiCoverage.status === 'complete' ? 'All stored text chunks processed' : 'Partial'}; {count(aiCoverage.chunks_processed)} of {count(aiCoverage.chunks_total)} chunks processed, {count(aiCoverage.chunks_skipped)} skipped, {count(aiCoverage.chunks_failed)} failed. {count(aiCoverage.rejected_claim_count)} unsupported claims rejected.</>}</p>}
    {coverage?.files?.length > 0 && <details className="pde-packages"><summary>Document extraction details ({coverage.files.length})</summary>
      <div className="pde-package-scroll" tabIndex={0} role="region" aria-label="Document extraction details"><table><thead><tr><th>Document</th><th>Status</th><th>Processed / total</th><th>Issues</th></tr></thead><tbody>{coverage.files.map((file, index) => <tr key={file.file_id ?? index}><th scope="row">{file.filename || 'Not Specified'}</th><td>{statusLabel(file.status)}{file.included_in_analysis === false && <small>Not included in analysis</small>}</td><td>{count(file.units_processed)} / {count(file.units_total)} {file.unit_type || 'units'}</td><td>{file.text_truncated && <p>Extracted text was truncated.</p>}{(file.issues || []).map((issue, issueIndex) => <p key={issueIndex}>{issue.page != null && `Page ${issue.page}: `}{issue.sheet && `${issue.sheet}: `}{issue.message || issue.code || 'Review required'}</p>)}{!file.text_truncated && !file.issues?.length && 'No extraction issues reported'}</td></tr>)}</tbody></table></div>
    </details>}
  </section>
}
PlanningExtractionCoverage.propTypes = { coverage: PropTypes.object, aiCoverage: PropTypes.object }
