const DAY = 86400000
const day = value => value ? Date.parse(`${String(value).slice(0, 10)}T00:00:00Z`) : NaN
const iso = value => new Date(value).toISOString().slice(0, 10)

function calendarBands(start, end, kind) {
  const bands = []
  for (let cursor = start; cursor < end;) {
    const date = new Date(cursor)
    const next = kind === 'year' ? Date.UTC(date.getUTCFullYear() + 1, 0, 1) : Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1)
    const finish = Math.min(next, end)
    bands.push({ offset: (cursor - start) / DAY, length: (finish - cursor) / DAY,
      label: kind === 'year' ? String(date.getUTCFullYear()) : date.toLocaleDateString('en-GB', { month: 'long', timeZone: 'UTC' }),
      shortLabel: kind === 'year' ? String(date.getUTCFullYear()) : date.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' }),
    })
    cursor = finish
  }
  return bands
}

// Every date label, grid line and activity bar uses this same calendar scale.
// Project boundaries extend the viewport; they never supply missing task dates.
export function buildPrimaveraTimeline({ plan, tasks, paneWidth, zoom = 'week', fit = false }) {
  const project = plan.project || {}
  const sources = [project, plan.project_summary, ...(plan.wbs_nodes || []).map(node => node.summary), ...tasks].filter(Boolean)
  const dates = sources.flatMap(source => [source.planned_start_date, source.planned_finish_date])
    .concat([project.start_date, project.end_date]).map(day).filter(Number.isFinite)
  const available = Math.max(1, paneWidth)
  if (!dates.length) return { hasDates: false, start: NaN, finish: NaN, days: 1, dayWidth: available,
    width: available, tickStep: 1, ticks: [], years: [], months: [], startDate: null, finishDate: null, horizonFinishDate: null }

  const first = Math.min(...dates), last = Math.max(...dates)
  const start = first - ((new Date(first).getUTCDay() + 6) % 7) * DAY
  const horizonFinish = last + 14 * DAY
  const horizonDays = Math.round((horizonFinish - start) / DAY) + 1
  const dayWidth = fit ? available / horizonDays : zoom === 'day' ? 24 : zoom === 'week' ? 11 : 4
  // A short schedule still has a fully labelled viewport. Extend the calendar
  // into the available space instead of stretching bars or leaving a blank tail.
  const days = fit ? horizonDays : Math.max(horizonDays, Math.ceil(available / dayWidth))
  const finish = start + (days - 1) * DAY
  const baseStep = fit ? Math.max(7, Math.ceil(days / Math.max(2, available / 50) / 7) * 7) : zoom === 'day' ? 1 : 7
  const tickStep = Math.max(baseStep, Math.ceil(days / 5000 / baseStep) * baseStep)
  const ticks = Array.from({ length: Math.ceil(days / tickStep) }, (_, index) => ({ offset: index * tickStep,
    label: new Date(start + index * tickStep * DAY).getUTCDate(), date: iso(start + index * tickStep * DAY),
  }))
  return { hasDates: true, start, finish, days, dayWidth, width: days * dayWidth, tickStep, ticks,
    years: calendarBands(start, finish + DAY, 'year'), months: calendarBands(start, finish + DAY, 'month'),
    startDate: iso(start), finishDate: iso(finish), horizonFinishDate: iso(last),
  }
}
