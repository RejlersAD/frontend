const milestone = task => task?.is_milestone === true
  || ['milestone', 'start_milestone', 'finish_milestone'].includes(String(task?.activity_type || '').toLowerCase())

export const NOT_SPECIFIED = 'Not Specified'

export const missingSourceDuration = task => (task?.duration_days == null || task?.duration_days === ''
  || task?.duration_source === 'missing_source'
  || (task?.duration_source === 'source_requirement' && task.duration_days == null))
  && !(milestone(task) && task.duration_days === 0)

// Stale calculated dates must not make an activity with an unknown duration
// appear scheduled. Keep the original object for editing and persistence.
export const durationDisplayTask = task => missingSourceDuration(task) ? {
  ...task, duration_days: null, original_duration_days: null,
  planned_start_date: null, planned_finish_date: null,
  total_float_days: null, is_critical: null,
} : task

export const durationEvidenceStatus = (task, row) => row?.status || task?.duration_review_status || task?.duration_source || ''
export const durationEvidenceLabel = (task, row) => {
  const status = durationEvidenceStatus(task, row)
  if (['missing_source', 'missing'].includes(status) || (!status && missingSourceDuration(task))) return NOT_SPECIFIED
  if (['source_document', 'source_backed', 'source_verified'].includes(status)) return 'Source duration'
  if (['source_requirement', 'requirement_needs_review'].includes(status)) return 'Source requirement · review activity timing'
  if (['retained_manual', 'planner', 'manual', 'manual_unverified'].includes(status)) return 'Planner duration · not source verified'
  if (status === 'started_unverified') return 'Started activity retained · duration not source verified'
  if (status === 'proposed' && (task?.selection_basis === 'all_extracted_requirements' || task?.duration_policy === 'planning_assumptions')) return 'Provisional duration · project date allocation'
  if (status === 'proposed') return task?.field_provenance?.duration_days?.label === 'AI proposal' ? 'AI-proposed duration' : 'Unverified template duration'
  return 'Duration not source verified'
}

export const dependencyEvidenceLabel = evidence => {
  if (evidence?.source === 'source_stage_rule' || evidence?.metadata?.source === 'source_stage_rule') return 'Deterministic stage rule · planning assumption'
  if (evidence?.source === 'workflow_template' || evidence?.evidence_type === 'workflow_template') return 'User-configured workflow'
  if (evidence?.evidence_type === 'planning_inference' || evidence?.status === 'proposed') return 'Unverified inference'
  if (['planner', 'manual', 'user'].includes(evidence?.source) || evidence?.evidence_type === 'planner_defined') return 'Planner-defined relationship'
  if (evidence?.source_references?.length) return 'Source reference available'
  return NOT_SPECIFIED
}

export const durationEvidenceRow = (review, task) => (review?.rows || []).find(row => String(row.task_id) === String(task?.id))
export const durationReferences = (task, row) => row?.source_references || task?.duration_evidence?.source_references || task?.duration_source_references || []
export const durationUnit = task => task?.duration_unit || task?.duration_evidence?.values?.duration_unit || task?.duration_evidence?.duration?.unit

export const durationUnitLabel = task => {
  const unit = durationUnit(task)
  if (unit === 'working_days') return 'working days'
  if (unit === 'calendar_days') return 'calendar days'
  if (unit === 'days') return 'days'
  if (unit === 'hours') return 'hours'
  if (unit === 'weeks') return 'weeks'
  if (unit === 'months') return 'months'
  return task?.duration_source === 'source_document' ? 'd as printed (calendar Not Specified)' : 'working days'
}

export const sourceReferenceLabel = source => {
  if (typeof source === 'string') return source
  const locator = source?.locator || source?.source_locator || source || {}
  return [source?.filename || source?.source_filename,
    locator.page != null ? `Page ${locator.page}` : null, locator.sheet,
    locator.row != null ? `Row ${locator.row}` : locator.line != null ? `Line ${locator.line}` : null,
  ].filter(Boolean).join(' · ') || 'Uploaded document'
}
