import { useMemo } from 'react'
import PropTypes from 'prop-types'
import { AlertTriangle, FileSearch, RefreshCw } from 'lucide-react'
import PlanningSourceEvidenceTable from './PlanningSourceEvidenceTable'
import PlanningExtractionCoverage from './PlanningExtractionCoverage'
import { sourceReferenceLabel } from '../../utils/planningDurationEvidence'
import { aiAnalysisOutcome } from '../../utils/planningAnalysisOutcome'
import './GenerationEvidenceWorkspace.css'

const list = value => Array.isArray(value) ? value : []
const recorded = value => value == null || value === '' ? 'Not Specified' : String(value)
const references = value => list(value).map(sourceReferenceLabel).join('; ') || 'Not Specified'
const savedDraftReview = { rows: [] }

export default function GenerationEvidenceWorkspace({
  generation, issues = [], onReviewEvidence, onEditActivities, onBuildWorkBreakdown,
  onRefresh, refreshing = false, onAiSettings, onRetryAnalysis, view = 'all', navigation, analysisState,
}) {
  const analysisRunId = generation.analysis_run_id
  const engine = generation.intelligence?.schedule_engine || {}
  const activities = list(generation.activities)
  const wbs = list(generation.wbs)
  const relationships = list(generation.logic_matrix)
  const unmatchedRegister = list(engine.register_inventory).filter(row => !list(row.schedule_activity_ids).length)
  const validation = useMemo(() => {
    const seen = new Set()
    return [...list(generation.validation), ...list(issues)].filter(item => {
      const key = JSON.stringify([item.code || item.rule, item.activity_id, item.message])
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [generation.validation, issues])
  const tasks = useMemo(() => list(generation.activities).map(activity => ({
    ...activity,
    title: activity.name || activity.title || 'Not Specified',
    // Generation IDs are internal identities, not extracted activity numbers.
    external_id: activity.source_activity_id || activity.document_number || '',
    duration_days: activity.original_duration_days ?? null,
    ...(generation.parent_generation ? {
      duration_source: activity.original_duration_days == null ? 'missing_source' : 'revision_requires_review',
      duration_review_status: activity.original_duration_days == null ? 'missing_source' : 'revision_requires_review',
    } : {}),
  })), [generation.activities, generation.parent_generation])
  const names = new Map(activities.map(row => [String(row.id), row.name || row.title]))
  const missingDurations = activities.filter(row => row.original_duration_days == null || row.original_duration_days === '').length
  const aiOutcome = aiAnalysisOutcome(generation.intelligence?.ai_processing_coverage)
  const factCount = generation.intelligence?.evidence_summary?.fact_count
  const retainedFacts = Number.isInteger(factCount) && factCount > 0
    ? `${factCount.toLocaleString()} source ${factCount === 1 ? 'fact remains' : 'facts remain'} available for review; facts are not schedule activities.`
    : 'Review the saved source findings and missing planning inputs.'
  const emptyMessage = analysisRunId
    ? [`No schedule activities were extracted from ${analysisState?.pending ? 'the previous saved' : 'this'} analysis.`,
      aiOutcome.status === 'failed' ? `${analysisState?.pending ? 'The previous saved AI analysis' : 'AI analysis'} failed.`
        : aiOutcome.status === 'partial' ? `${analysisState?.pending ? 'The previous saved AI analysis' : 'AI analysis'} is incomplete.` : '',
      retainedFacts, 'Review source evidence before preparing a schedule draft.'].filter(Boolean).join(' ')
    : 'This saved generation contains no activities. Review its source evidence and validation findings.'

  return <section className="generation-evidence-workspace" aria-label={analysisRunId ? 'Document analysis workspace' : 'Saved generation workspace'}>
    <header className="gew-header">
      <div><p className="gew-eyebrow">{analysisRunId ? 'Source evidence review' : 'Master Schedule'}</p><h2>{analysisRunId ? `Document analysis #${analysisRunId}` : `Draft review · Generation v${generation.version}`}</h2></div>
      <span className="gew-state"><FileSearch size={15} aria-hidden="true" />{analysisRunId ? 'Evidence draft' : 'Evidence review required'}</span>
      <div className="gew-actions">
        {onReviewEvidence && <button type="button" onClick={onReviewEvidence}>Review source evidence</button>}
        {onEditActivities && <button type="button" onClick={onEditActivities}>Edit draft activities</button>}
        {onBuildWorkBreakdown && <button type="button" className="gew-primary" onClick={onBuildWorkBreakdown}>Review work breakdown</button>}
        {onRefresh && <button type="button" onClick={onRefresh} disabled={refreshing}><RefreshCw size={14} aria-hidden="true" />{refreshing ? 'Refreshing…' : analysisRunId ? 'Refresh analysis' : 'Refresh draft'}</button>}
      </div>
    </header>

    {navigation}

    {analysisRunId && analysisState?.pending && <p className="gew-gantt-pending" role="status">A new analysis is pending. The findings below are from the previous saved analysis. {analysisState.message}</p>}

    <div className="gew-readiness" role="status"><AlertTriangle size={18} aria-hidden="true" /><div>
      <strong>{analysisRunId ? 'Review the saved source findings for this analysis.' : 'Your saved draft is open for review.'}</strong>
      <p>Complete and verify planning inputs before schedule calculation. Calculated dates, float and critical path are unavailable in this draft view.</p>
      {missingDurations > 0 && <p>{missingDurations} of {activities.length} activities have no recorded duration.</p>}
      <p>{analysisRunId ? 'These are review-only findings from the selected analysis. Review source evidence to confirm or revise inputs before creating an editable schedule version.' : 'Use Edit draft activities to revise this generation, or Review work breakdown to review and revise its WBS. These edits remain subject to source review.'}</p>
      {generation.parent_generation && <p>This revision may contain planner edits. Its recorded values require review against the retained source evidence.</p>}
    </div></div>

    {analysisRunId && <PlanningExtractionCoverage coverage={generation.intelligence?.processing_coverage}
      aiCoverage={generation.intelligence?.ai_processing_coverage} onAiSettings={onAiSettings}
      onRetryAnalysis={onRetryAnalysis} busy={refreshing || Boolean(analysisState?.pending)} previousResult={Boolean(analysisState?.pending)} />}

    {!navigation && <dl className="gew-metrics">
      <div><dt>Activities</dt><dd>{activities.length}</dd></div>
      <div><dt>WBS nodes</dt><dd>{wbs.length}</dd></div>
      <div><dt>Recorded relationships</dt><dd>{relationships.length}</dd></div>
      <div><dt>Review findings</dt><dd>{validation.length}</dd></div>
    </dl>}

    {['all', 'activities', 'evidence'].includes(view) && <PlanningSourceEvidenceTable key={analysisRunId ? `analysis-${analysisRunId}` : generation.id} tasks={tasks} review={savedDraftReview} emptyMessage={emptyMessage} />}

    {view === 'activities' && <p className="gew-gantt-pending" role="status">Gantt dates are not calculated. Review durations, relationships and the working calendar before calculating a schedule. Missing dates remain Not Specified.</p>}
    {['all', 'activities'].includes(view) && <details className="gew-details"><summary>Recorded dates · Not calculated</summary>
      <p>{analysisRunId ? 'These values come from the analyzed source documents.' : 'These values belong to the saved draft.'} Missing endpoints remain Not Specified.</p>
      <div className="gew-table-scroll" tabIndex={0} role="region" aria-label="Recorded activity dates"><table>
        <thead><tr><th scope="col">Activity</th><th scope="col">Recorded start</th><th scope="col">Recorded finish</th><th scope="col">Calculated float</th></tr></thead>
        <tbody>{activities.map((row, index) => <tr key={row.id || index}><td>{row.name || row.title || 'Not Specified'}</td><td>{recorded(row.start_date)}</td><td>{recorded(row.finish_date)}</td><td>Not calculated</td></tr>)}</tbody>
      </table>{!activities.length && <p>No activity dates are available in this draft.</p>}</div>
    </details>}

    {['all', 'wbs', 'logic'].includes(view) && <details className="gew-details" open={view !== 'all'}><summary>{view === 'wbs' ? 'Recorded work breakdown' : view === 'logic' ? 'Recorded source logic' : 'WBS and recorded relationships'}</summary>
      {view !== 'logic' && <><h3>WBS nodes</h3>
      <ul>{wbs.map((row, index) => <li key={row.id || row.code || index}><strong>{recorded(row.code)} · {recorded(row.name)}</strong>{row.basis === 'project_record_container' && <span> — Project grouping; no source WBS hierarchy was supplied.</span>}</li>)}</ul>
      {!wbs.length && <p>No WBS nodes are recorded.</p>}</>}
      {view !== 'wbs' && <><h3>Recorded relationships</h3>
      {!relationships.length ? <p>No schedule relationships are mapped. Review source dependency findings before calculation.</p> : <div className="gew-table-scroll" tabIndex={0} role="region" aria-label="Recorded relationships"><table>
        <thead><tr><th scope="col">Predecessor</th><th scope="col">Successor</th><th scope="col">Type</th><th scope="col">Lag</th><th scope="col">Source reference</th></tr></thead>
        <tbody>{relationships.map((row, index) => <tr key={row.id || index}>
          <td>{recorded(row.predecessor_name || names.get(String(row.predecessor_id ?? row.predecessor)) || row.predecessor_id || row.predecessor)}</td>
          <td>{recorded(row.successor_name || names.get(String(row.activity_id ?? row.successor_id ?? row.successor)) || row.activity_id || row.successor_id || row.successor)}</td>
          <td>{recorded(row.type || row.relationship_type)}</td><td>{row.lag_days == null ? 'Not Specified' : `${row.lag_days} ${row.lag_unit || 'days'}`}</td><td>{references(row.source_references)}</td>
        </tr>)}</tbody>
      </table></div>}</>}
    </details>}

    {['all', 'evidence'].includes(view) && unmatchedRegister.length > 0 && <details className="gew-details"><summary>Register rows awaiting review ({unmatchedRegister.length})</summary>
      <p>These source rows are retained separately and have not been turned into activities.</p>
      <ul>{unmatchedRegister.map((row, index) => <li key={row.id || index}><strong>{recorded(row.title || row.name)}</strong><p>{references(row.source_references)}</p></li>)}</ul>
    </details>}

    {['all', 'evidence'].includes(view) && <details className="gew-details" open={view === 'evidence'}><summary>Validation and missing information ({validation.length})</summary>
      {validation.length ? <ul className="gew-findings">{validation.map((item, index) => <li key={index} className={['error', 'critical'].includes(item.severity) ? 'gew-error' : ''}>
        <span>{item.message || recorded(item.code || item.rule)}</span>
        {list(item.source_references).length > 0 && <small>{references(item.source_references)}</small>}
      </li>)}</ul> : <p>No validation details are recorded. This does not establish calculation readiness.</p>}
    </details>}
  </section>
}

GenerationEvidenceWorkspace.propTypes = {
  generation: PropTypes.object.isRequired,
  issues: PropTypes.array,
  onReviewEvidence: PropTypes.func,
  onEditActivities: PropTypes.func,
  onBuildWorkBreakdown: PropTypes.func,
  onRefresh: PropTypes.func,
  onAiSettings: PropTypes.func,
  onRetryAnalysis: PropTypes.func,
  refreshing: PropTypes.bool,
  view: PropTypes.oneOf(['all', 'activities', 'wbs', 'logic', 'evidence']),
  navigation: PropTypes.node,
  analysisState: PropTypes.shape({ pending: PropTypes.bool, message: PropTypes.string }),
}
