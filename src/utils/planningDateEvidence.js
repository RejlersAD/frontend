import { durationDisplayTask, missingSourceDuration, sourceReferenceLabel } from './planningDurationEvidence'

const validDate = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const timestamp = Date.parse(`${value}T00:00:00Z`)
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value ? value : null
}

// Display evidence without assigning source dates to editable/calculated fields.
// A duration is not needed to display two independently documented dates.
export function dateDisplayTask(task, { summary = false } = {}) {
  // Proposed timing has its own display basis. It must not change source
  // duration provenance or pretend that the source calendar was verified.
  if (task.proposal_timing === true) {
    const start = validDate(task.planned_start_date), finish = validDate(task.planned_finish_date)
    if (start || finish) return { ...task, display_start_date: start, display_finish_date: finish,
      display_date_basis: 'proposed', calculated: false }
  }
  const unverifiedSource = task.duration_source === 'source_document' && task.duration_calendar_verified === false
  const result = unverifiedSource ? { ...task, planned_start_date: null, planned_finish_date: null,
    total_float_days: null, is_critical: null } : summary ? task : durationDisplayTask(task)
  const plannedStart = unverifiedSource ? null : validDate(result.planned_start_date)
  const plannedFinish = unverifiedSource ? null : validDate(result.planned_finish_date)
  if (plannedStart || plannedFinish) return { ...result,
    display_start_date: plannedStart, display_finish_date: plannedFinish,
    display_date_basis: task.calculated ? 'calculated' : 'planned',
  }
  const sourceDate = field => task[`source_${field}_status`] === 'extracted'
    ? validDate(task[`source_${field}_date`]) : null
  const start = sourceDate('start'), finish = sourceDate('finish')
  return { ...result, display_start_date: start, display_finish_date: finish,
    display_date_basis: start || finish ? 'source' : null,
    ...(start || finish ? { total_float_days: null, is_critical: null, calculated: false } : {}) }
}

export function missingDateLabel(task, field, { sourceOnly = false, summary = false } = {}) {
  if (['ambiguous', 'invalid', 'conflicting'].includes(task[`source_${field}_status`])) return 'Review source'
  if (task.display_date_basis === 'source') return 'Not Specified'
  if (!sourceOnly) return '\u2014'
  return summary || !missingSourceDuration(task) ? 'Not calculated' : 'Not Specified'
}

export function dateEvidenceLabel(task) {
  if (!task.display_date_basis) return ['source_start_status', 'source_finish_status'].some(field => ['ambiguous', 'invalid', 'conflicting'].includes(task[field]))
    ? 'Review source: the documented dates need clarification before they can be displayed.'
    : 'No dates to display. A missing source value is Not Specified; a pending schedule calculation is Not calculated.'
  if (task.display_date_basis === 'proposed') return 'Proposed dates for review; source timing and calendar verification remain separate.'
  if (task.display_date_basis !== 'source') return task.display_date_basis === 'calculated' ? 'Calculated dates' : 'Planned dates'
  const references = (task.source_date_references || []).map(sourceReferenceLabel).join('; ')
  return `Source dates${references ? ` · ${references}` : ''}. Calendar and dependency calculations are not verified.`
}
