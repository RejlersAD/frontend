import React from 'react'
import PropTypes from 'prop-types'
import { durationEvidenceLabel, durationEvidenceStatus, durationReferences, sourceReferenceLabel } from '../../utils/planningDurationEvidence'
import { scheduleNumber } from '../../utils/primaveraSchedule'
import './PlanningDurationEvidence.css'

export function ActivityDurationEvidence({ task, row }) {
  const sources = durationReferences(task, row)
  return <div className="pde-activity" data-duration-source={durationEvidenceStatus(task, row)}>
    <strong>{durationEvidenceLabel(task, row)}</strong>
    {(row?.reason || task?.duration_review_reason) && <small>{row?.reason || task.duration_review_reason}</small>}
    {task?.duration_evidence?.values?.required_review_days != null && <small>Required review period: {task.duration_evidence.values.required_review_days} days. Activity duration remains unconfirmed.</small>}
    {task?.duration_source === 'source_document' && task.duration_calendar_verified === false && <small>Source calendar has not been verified.</small>}
    {sources.map((source, index) => <small key={index}>{sourceReferenceLabel(source)}{source.excerpt && <q>{source.excerpt}</q>}</small>)}
  </div>
}
ActivityDurationEvidence.propTypes = { task: PropTypes.object, row: PropTypes.object }

export default function PlanningDurationEvidence({ review }) {
  if (!review) return null
  return <section className="pde-summary" aria-label="Duration source review">
    <strong>Duration source review</strong>
    <div><span><b>{review.source_document_count ?? review.source_backed_count ?? 0}</b> source durations</span><span><b>{review.missing_source_count ?? review.missing_count ?? 0}</b> Not Specified</span>{review.source_requirement_count > 0 && <span><b>{review.source_requirement_count}</b> source requirements to review</span>}{(review.manual_unverified_count ?? review.retained_manual_count ?? 0) > 0 && <span><b>{review.manual_unverified_count ?? review.retained_manual_count}</b> planner durations retained</span>}{review.started_unverified_count > 0 && <span><b>{review.started_unverified_count}</b> started activities retained for review</span>}</div>
    <p>Durations absent from the documents are Not Specified. Review requirements and planner values remain separate from source activity durations.</p>
    {review.package_reviews?.length > 0 && <details className="pde-packages"><summary>Package duration evidence ({review.package_reviews.length})</summary>
      <p>Printed package duration is separate from the sum of stage durations. Stage totals do not establish elapsed package duration or verify its calendar.</p>
      <div className="pde-package-scroll" tabIndex={0} role="region" aria-label="Package duration evidence"><table><thead><tr><th>Package</th><th>Source package duration</th><th>Stage duration sum</th><th>Missing stage durations</th><th>Source reference</th></tr></thead><tbody>{review.package_reviews.map(item => <tr key={item.parent_deliverable_id}><th scope="row">{item.title}</th><td>{item.source_original_duration_days == null ? 'Not Specified' : `${scheduleNumber(item.source_original_duration_days)} d as printed`}</td><td>{item.duration_complete && item.duration_days != null ? `${scheduleNumber(item.duration_days)} d (sum only)` : 'Not calculated'}</td><td>{item.missing_duration_count ?? '—'}</td><td>{(item.source_references || []).map((source, index) => <small key={index}>{sourceReferenceLabel(source)}</small>)}</td></tr>)}</tbody></table></div>
    </details>}
  </section>
}
PlanningDurationEvidence.propTypes = { review: PropTypes.object }
