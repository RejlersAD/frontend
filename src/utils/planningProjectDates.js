const DAY_MS = 24 * 60 * 60 * 1000

const utcDate = (year, month, day) => {
  const date = new Date(0)
  date.setUTCFullYear(year, month, day)
  return date
}

const parseDateOnly = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [year, month, day] = value.split('-').map(Number)
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31) return null
  const date = utcDate(year, month - 1, day)
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date : null
}

const addCalendarMonths = (date, months) => {
  const year = date.getUTCFullYear(), month = date.getUTCMonth() + months
  const lastDay = utcDate(year, month + 1, 0).getUTCDate()
  return utcDate(year, month, Math.min(date.getUTCDate(), lastDay))
}

/** End minus start in days; calendar months use the backend's clamped anniversary dates. */
export function calculatePlanningDuration(startValue, endValue) {
  const start = parseDateOnly(startValue), end = parseDateOnly(endValue)
  if (!start || !end || end <= start) return null

  let wholeMonths = (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + end.getUTCMonth() - start.getUTCMonth()
  let anchor = addCalendarMonths(start, wholeMonths)
  if (anchor > end) {
    wholeMonths -= 1
    anchor = addCalendarMonths(start, wholeMonths)
  }
  const nextAnchor = addCalendarMonths(start, wholeMonths + 1)
  const remainingDays = (end - anchor) / DAY_MS
  const monthDays = (nextAnchor - anchor) / DAY_MS
  return {
    days: (end - start) / DAY_MS,
    months: Math.round((wholeMonths * monthDays + remainingDays) * 10000 / monthDays) / 10000,
  }
}
