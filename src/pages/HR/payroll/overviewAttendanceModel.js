import { empDept, empName } from '../../../config/hrAttendance.config.js'

export const overviewNumber = value => {
  if ((typeof value !== 'number' && typeof value !== 'string') ||
      (typeof value === 'string' && !value.trim())) return null
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? number : null
}

const localDateKey = date => `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

/** Seven calendar days ending at the selection, without conversion to UTC. */
export const overviewDateKeys = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return []
  const selected = new Date(`${value}T12:00:00`)
  if (!Number.isFinite(selected.getTime()) || localDateKey(selected) !== value) return []
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(selected)
    date.setDate(date.getDate() - (6 - index))
    return localDateKey(date)
  })
}

const sumHours = values => values.some(value => value === null)
  ? null : Math.round(values.reduce((total, value) => total + value, 0) * 100) / 100
const regularHours = row => overviewNumber(row.regular_hours ?? row.hours_worked)
const totalsFor = rows => ({
  records: rows.length,
  checkIns: rows.filter(row => Boolean(row.first_in)).length,
  late: rows.filter(row => row.is_late === true).length,
  openShifts: rows.every(row => typeof row.open_shift === 'boolean')
    ? rows.filter(row => row.open_shift === true).length : null,
  regularHours: sumHours(rows.map(regularHours)),
  overtimeHours: sumHours(rows.map(row => overviewNumber(row.overtime_hours))),
})

/** Input rows already have the existing employee and requested scope filters. */
export const buildOverviewDay = rows => {
  const departments = new Map()
  const attention = []
  rows.forEach((row, index) => {
    const dept = empDept(row)
    if (!departments.has(dept)) departments.set(dept, [])
    departments.get(dept).push(row)
    const overtime = overviewNumber(row.overtime_hours)
    const item = row.open_shift === true
      ? { type: 'open_shift', issue: 'Open shift', tone: 'warning', detail: 'An open attendance session is recorded.' }
      : row.is_late === true
        ? { type: 'late', issue: 'Late arrival', tone: 'warning', detail: 'Marked late in the attendance source.' }
        : overtime !== null && overtime > 0
          ? { type: 'overtime', issue: 'Recorded overtime', tone: 'info', detail: `${overtime.toLocaleString('en-US', { maximumFractionDigits: 2 })} h recorded; approval is separate.` }
          : null
    if (item) {
      attention.push({
        ...item, row,
        key: `${item.type}:${row.employee_code || row.radai_user_id || empName(row)}:${row.first_in || ''}:${index}`,
      })
    }
  })
  return {
    ...totalsFor(rows),
    attention,
    departments: [...departments.entries()].map(([dept, records]) => {
      const totals = totalsFor(records)
      return {
        dept, ...totals,
        checkInShare: totals.records ? Math.round(totals.checkIns / totals.records * 1000) / 10 : null,
      }
    }).sort((a, b) => a.dept.localeCompare(b.dept)),
  }
}
