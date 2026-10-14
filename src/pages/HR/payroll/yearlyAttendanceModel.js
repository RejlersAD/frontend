import {
  ATT_GOOD_RATE_PCT, ATT_STANDARD_MONTHLY_WORKING_DAYS, MONTH_SHORT,
  empDept, empName, filterEmployeeRow,
} from '../../../config/hrAttendance.config.js'

const nonnegativeNumber = value => {
  if ((typeof value !== 'number' && typeof value !== 'string') ||
      (typeof value === 'string' && !value.trim())) return null
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? number : null
}

const identifier = value => typeof value === 'string' || typeof value === 'number'
  ? String(value).trim() : ''
const rateFor = (present, periods) => ATT_STANDARD_MONTHLY_WORKING_DAYS > 0 && periods > 0
  ? Math.min(100, Math.round(present / (ATT_STANDARD_MONTHLY_WORKING_DAYS * periods) * 100)) : 0
const knownTotal = values => {
  const known = values.filter(value => value !== null)
  return known.length ? Math.round(known.reduce((total, value) => total + value, 0) * 100) / 100 : null
}

/** Missing months describe source availability, never absence or import completion. */
export const buildYearlyEmployees = (months, { year, currentYear, currentMonth }) => {
  const states = MONTH_SHORT.map((_, index) => {
    if (year > currentYear || (year === currentYear && index + 1 > currentMonth)) return 'future'
    return months[index]?.state === 'loaded' && Array.isArray(months[index].rows)
      ? 'missing' : 'unavailable'
  })
  const employees = new Map()
  MONTH_SHORT.forEach((_, index) => {
    if (states[index] !== 'missing') return
    for (const row of months[index].rows) {
      if (!filterEmployeeRow(row)) continue
      const code = identifier(row.employee_code)
      const userId = identifier(row.radai_user_id)
      if (!code && !userId) continue
      const key = code ? `code:${code}` : `user:${userId}`
      if (!employees.has(key)) {
        employees.set(key, {
          key, code, name: empName(row), dept: empDept(row),
          months: MONTH_SHORT.map(() => null), monthStates: [...states],
        })
      }
      const employee = employees.get(key)
      const present = nonnegativeNumber(row.days_present)
      if (row.attendance_source === 'not_uploaded' || present === null) continue
      employee.months[index] = {
        present, rate: rateFor(present, 1), overtime: nonnegativeNumber(row.overtime_hours),
      }
      employee.monthStates[index] = 'recorded'
    }
  })
  return [...employees.values()].map(employee => {
    const recorded = employee.months.filter(cell => cell !== null)
    const fullYearRate = recorded.length === MONTH_SHORT.length
      ? rateFor(recorded.reduce((total, cell) => total + cell.present, 0), MONTH_SHORT.length) : null
    return {
      ...employee, fullYearRate,
      status: fullYearRate === null ? 'incomplete' : fullYearRate >= ATT_GOOD_RATE_PCT ? 'ready' : 'review',
      totalOvertime: knownTotal(recorded.map(cell => cell.overtime)),
      recordedMonths: recorded.length,
    }
  }).sort((a, b) => a.name.localeCompare(b.name) || a.key.localeCompare(b.key))
}

/** Summaries use only the passed employee subset and the retained configured basis. */
export const summarizeYearlyEmployees = employees => {
  const trend = MONTH_SHORT.map((month, index) => {
    const recorded = employees.map(employee => employee.months[index]).filter(cell => cell !== null)
    return {
      month,
      rate: recorded.length ? rateFor(recorded.reduce((total, cell) => total + cell.present, 0), recorded.length) : null,
      employees: recorded.length,
    }
  })
  const assessed = employees.filter(employee => employee.fullYearRate !== null)
  const recordedRates = trend.filter(point => point.rate !== null)
  return {
    trend,
    averageRecordedRate: recordedRates.length
      ? Math.round(recordedRates.reduce((total, point) => total + point.rate, 0) / recordedRates.length * 10) / 10 : null,
    belowTarget: assessed.length ? assessed.filter(employee => employee.fullYearRate < ATT_GOOD_RATE_PCT).length : null,
    assessedCount: assessed.length,
    fullYearRate: employees.length && assessed.length === employees.length
      ? rateFor(employees.reduce((total, employee) => total + employee.months.reduce((sum, cell) => sum + cell.present, 0), 0), employees.length * MONTH_SHORT.length) : null,
    monthsWithRecords: recordedRates.length,
    totalOvertime: knownTotal(employees.map(employee => employee.totalOvertime)),
  }
}
