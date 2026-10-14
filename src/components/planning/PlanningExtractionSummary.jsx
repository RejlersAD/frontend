import PropTypes from 'prop-types'

export default function PlanningExtractionSummary({ summary }) {
  if (!summary) return null
  return <section className="per-message" aria-label="Document extraction summary"><div><strong>{summary.status === 'partial' || summary.chunks_remaining > 0 ? 'More document content remains to process' : 'Document processing pass recorded'}</strong>
    <p>{summary.fact_count != null ? `${summary.fact_count} extracted findings. ` : ''}Review their meaning and source evidence before use.</p>
    {summary.chunks_remaining > 0 && <p>{summary.chunks_remaining} processing {summary.chunks_remaining === 1 ? 'chunk remains' : 'chunks remain'}.</p>}
    {Object.keys(summary.facts_by_type || {}).length > 0 && <details><summary>Finding categories</summary><ul>{Object.entries(summary.facts_by_type).map(([type, count]) => <li key={type}>{type.replaceAll('_', ' ')}: {count}</li>)}</ul></details>}
  </div></section>
}
PlanningExtractionSummary.propTypes = { summary: PropTypes.object }
