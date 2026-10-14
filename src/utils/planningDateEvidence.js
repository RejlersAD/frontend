import { durationDisplayTask, missingSourceDuration, sourceReferenceLabel } from './planningDurationEvidence'

const validDate = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const timestamp = Date.parse(`${value}T00:00:00Z`)
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value ? value : null
}

const finiteNumber = value => value != null && value !== '' && Number.isFinite(Number(value))

// Printed float is independent evidence. It is never a CPM result and must
// survive the safeguards that hide stale calculated dates and float.
function withDisplayFloat(task) {
  const computed = finiteNumber(task.total_float_days)
  const source = !computed && task.source_total_float_status === 'extracted'
    && finiteNumber(task.source_total_float_days) && (task.calculated !== true || missingSourceDuration(task)
      || (task.duration_source === 'source_document' && task.duration_calendar_verified === false))
  return { ...task, display_total_float_days: computed ? task.total_float_days : source ? task.source_total_float_days : null,
    display_float_basis: computed ? 'calculated' : source ? 'source' : null }
}

export function floatEvidenceLabel(task) {
  if (task.display_float_basis === 'source') {
    const references = (task.source_total_float_references || []).map(sourceReferenceLabel).join('; ')
    return `Source total float${references ? ` · ${references}` : ''}. Value as printed; not calculated by RADAI. Source calendar and logic remain unverified.`
  }
  if (task.display_float_basis === 'calculated') return 'Calculated total float in working days.'
  if (['ambiguous', 'invalid', 'conflicting'].includes(task.source_total_float_status)) return 'Review source: the printed total float needs clarification.'
  return 'Total float has not been calculated for this row; no verified printed value is available.'
}

export function missingFloatLabel(task, { sourceOnly = false } = {}) {
  if (['ambiguous', 'invalid', 'conflicting'].includes(task.source_total_float_status)) return 'Review source'
  return sourceOnly ? 'Not calculated' : '\u2014'
}

// Display evidence without assigning source dates to editable/calculated fields.
// A duration is not needed to display two independently documented dates.
export function dateDisplayTask(task, { summary = false } = {}) {
  // A planner anchor is separate from the immutable printed dates. Without a
  // completed CPM run, showing the other printed endpoint would imply a new
  // duration/calendar calculation which has not happened.
  const plannerTiming = task.planner_timing || task.metadata?.planner_timing
  if (plannerTiming?.date && task.calculated !== true && ['start', 'finish'].includes(plannerTiming.anchor)) {
    const anchor = validDate(plannerTiming.date)
    const milestone = task.is_milestone === true || ['milestone', 'start_milestone', 'finish_milestone'].includes(task.activity_type)
    if (anchor) return { ...durationDisplayTask(task), planner_timing: plannerTiming, total_float_days: null, is_critical: null,
      display_start_date: milestone || plannerTiming.anchor === 'start' ? anchor : null,
      display_finish_date: milestone || plannerTiming.anchor === 'finish' ? anchor : null,
      display_date_basis: 'planner', display_total_float_days: null, display_float_basis: null }
  }
  // Proposed timing has its own display basis. It must not change source
  // duration provenance or pretend that the source calendar was verified.
  if (task.proposal_timing === true) {
    const start = validDate(task.planned_start_date), finish = validDate(task.planned_finish_date)
    if (start || finish) return withDisplayFloat({ ...task, display_start_date: start, display_finish_date: finish,
      display_date_basis: 'proposed', calculated: false })
  }
  const unverifiedSource = task.duration_source === 'source_document' && task.duration_calendar_verified === false
  const result = unverifiedSource ? { ...task, planned_start_date: null, planned_finish_date: null,
    total_float_days: null, is_critical: null } : summary ? task : durationDisplayTask(task)
  const plannedStart = unverifiedSource ? null : validDate(result.planned_start_date)
  const plannedFinish = unverifiedSource ? null : validDate(result.planned_finish_date)
  if (plannedStart || plannedFinish) return withDisplayFloat({ ...result,
    display_start_date: plannedStart, display_finish_date: plannedFinish,
    display_date_basis: task.calculated ? 'calculated' : 'planned',
  })
  const sourceDate = field => task[`source_${field}_status`] === 'extracted'
    ? validDate(task[`source_${field}_date`]) : null
  const start = sourceDate('start'), finish = sourceDate('finish')
  return withDisplayFloat({ ...result, display_start_date: start, display_finish_date: finish,
    display_date_basis: start || finish ? 'source' : null,
    ...(start || finish ? { total_float_days: null, is_critical: null, calculated: false } : {}) })
}

export function missingDateLabel(task, field, { sourceOnly = false, summary = false } = {}) {
  if (task.display_date_basis === 'planner') return 'Not calculated'
  if (['explicit_none', 'blank'].includes(task[`source_${field}_status`])) return '\u2014'
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
  if (task.display_date_basis === 'planner') return `Planner ${task.planner_timing?.anchor || 'date'} anchor; other dates and float await calculation. Original source evidence is retained.`
  if (task.display_date_basis !== 'source') return task.display_date_basis === 'calculated' ? 'Calculated dates' : 'Planned dates'
  const references = (task.source_date_references || []).map(sourceReferenceLabel).join('; ')
  return `Source dates${references ? ` · ${references}` : ''}. Calendar and dependency calculations are not verified.`
}
