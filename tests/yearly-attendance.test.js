import test from 'node:test'
import assert from 'node:assert/strict'
import { buildYearlyEmployees, summarizeYearlyEmployees } from '../src/pages/HR/payroll/yearlyAttendanceModel.js'

const past = { year: 2025, currentYear: 2026, currentMonth: 9 }
const employee = (code = 'E001', values = {}) => ({
  employee_code: code, radai_user_id: code, name: `Employee ${code}`,
  department: 'Engineering', days_present: 22, overtime_hours: 1, ...values,
})
const loaded = rows => ({ state: 'loaded', rows })
const year = (rows = [employee()]) => Array.from({ length: 12 }, () => loaded(rows))

test('not-uploaded placeholders stay visible with missing cells, not zero attendance', () => {
  const [result] = buildYearlyEmployees(year([employee('E001', {
    attendance_source: 'not_uploaded', days_present: 0, overtime_hours: 0,
  })]), past)
  assert.equal(result.recordedMonths, 0)
  assert.equal(result.fullYearRate, null)
  assert.equal(result.totalOvertime, null)
  assert.equal(result.status, 'incomplete')
  assert.ok(result.months.every(cell => cell === null))
  assert.ok(result.monthStates.every(state => state === 'missing'))
})

test('explicit numeric and string zero remain recorded values', () => {
  const [result] = buildYearlyEmployees(year([employee('E001', { days_present: '0', overtime_hours: 0 })]), past)
  assert.equal(result.recordedMonths, 12)
  assert.deepEqual(result.months[0], { present: 0, rate: 0, overtime: 0 })
  assert.equal(result.fullYearRate, 0)
  assert.equal(result.status, 'review')
  assert.equal(result.totalOvertime, 0)
  const summary = summarizeYearlyEmployees([result])
  assert.equal(summary.fullYearRate, 0)
  assert.equal(summary.averageRecordedRate, 0)
  assert.equal(summary.belowTarget, 1)
})

test('errors, loading and successful missing rows remain distinct from recorded months', () => {
  const months = year()
  months[1] = { state: 'error', rows: [employee()] }
  months[2] = null
  months[3] = loaded([])
  months[4] = { state: 'loaded', rows: null }
  const [result] = buildYearlyEmployees(months, past)
  assert.deepEqual(result.monthStates.slice(0, 5), ['recorded', 'unavailable', 'unavailable', 'missing', 'unavailable'])
  assert.equal(result.fullYearRate, null)
  const summary = summarizeYearlyEmployees([result])
  assert.equal(summary.trend[1].rate, null)
  assert.equal(summary.trend[1].employees, 0)
  assert.equal(summary.monthsWithRecords, 8)
  assert.equal(summary.assessedCount, 0)
  assert.equal(summary.belowTarget, null)
})

test('future months are excluded and cannot introduce future-only employees', () => {
  const months = year()
  months[9] = loaded([employee('FUTURE')])
  const [result] = buildYearlyEmployees(months, { year: 2026, currentYear: 2026, currentMonth: 9 })
  assert.equal(result.code, 'E001')
  assert.equal(result.recordedMonths, 9)
  assert.deepEqual(result.monthStates.slice(9), ['future', 'future', 'future'])
  assert.equal(result.fullYearRate, null)
  assert.deepEqual(buildYearlyEmployees(months, { year: 2027, currentYear: 2026, currentMonth: 9 }), [])
})

test('existing 22-day monthly and 264-day annual basis and thresholds are retained', () => {
  const results = buildYearlyEmployees(year([
    employee('FULL', { days_present: 22 }),
    employee('READY', { days_present: 20 }),
    employee('REVIEW', { days_present: 19 }),
    employee('AMBER', { days_present: 16.5 }),
    employee('CAPPED', { days_present: 25 }),
  ]), past)
  const byCode = Object.fromEntries(results.map(result => [result.code, result]))
  assert.equal(byCode.FULL.fullYearRate, 100)
  assert.equal(byCode.READY.fullYearRate, 91)
  assert.equal(byCode.READY.status, 'ready')
  assert.equal(byCode.REVIEW.fullYearRate, 86)
  assert.equal(byCode.REVIEW.status, 'review')
  assert.equal(byCode.AMBER.months[0].rate, 75)
  assert.equal(byCode.CAPPED.fullYearRate, 100)
  assert.equal(summarizeYearlyEmployees(results).belowTarget, 2)
})

test('annual rate pools recorded days before rounding rather than averaging month rates', () => {
  const months = year([employee('E001', { days_present: 21 })])
  months[0] = loaded([employee('E001', { days_present: 20 })])
  const [result] = buildYearlyEmployees(months, past)
  assert.equal(result.fullYearRate, 95)
  assert.equal(summarizeYearlyEmployees([result]).fullYearRate, 95)
})

test('canonical identities stay separate even for identical employee names', () => {
  const rows = [
    employee(' E001 ', { name: 'Same Name' }),
    employee('E002', { name: 'Same Name' }),
    employee('', { radai_user_id: 14, name: 'Same Name' }),
    employee('', { radai_user_id: null, name: 'Same Name', attendance_source: 'manual_upload' }),
  ]
  const results = buildYearlyEmployees(year(rows), past)
  assert.deepEqual(results.map(result => result.key), ['code:E001', 'code:E002', 'user:14'])
  assert.equal(results[2].code, '')
})

test('uses existing employee visibility and display-name/department helpers', () => {
  const results = buildYearlyEmployees(year([
    employee('UNMATCHED', { radai_user_id: null }),
    employee('IMPORTED', { radai_user_id: null, attendance_source: 'manual_upload', name: 'Zora' }),
    employee('MATCHED', { radai_full_name: 'Anna', radai_department: 'Delivery', name: 'Other' }),
  ]), past)
  assert.deepEqual(results.map(result => result.name), ['Anna', 'Zora'])
  assert.equal(results[0].dept, 'Delivery')
})

test('missing and invalid present counts never become recorded zero', () => {
  for (const days_present of [undefined, null, '', ' ', false, true, 'invalid', -1, Infinity, NaN]) {
    const [result] = buildYearlyEmployees(year([employee('E001', { days_present })]), past)
    assert.equal(result.recordedMonths, 0, `Unexpected recorded count for ${String(days_present)}`)
    assert.equal(result.fullYearRate, null)
  }
})

test('overtime totals sum available recorded values without defaulting unknown values to zero', () => {
  const months = year([employee('E001', { overtime_hours: null })])
  months[0] = loaded([employee('E001', { overtime_hours: '1.25' })])
  months[1] = loaded([employee('E001', { overtime_hours: '2.50' })])
  months[2] = loaded([employee('E001', { overtime_hours: -1 })])
  const [result] = buildYearlyEmployees(months, past)
  assert.equal(result.totalOvertime, 3.75)
  assert.equal(result.months[2].overtime, null)
  assert.equal(summarizeYearlyEmployees([result]).totalOvertime, 3.75)
  const unknown = buildYearlyEmployees(year([employee('E002', { overtime_hours: undefined })]), past)
  assert.equal(unknown[0].totalOvertime, null)
  assert.equal(summarizeYearlyEmployees(unknown).totalOvertime, null)
})

test('summary recalculates only the supplied filtered employees and known monthly records', () => {
  const months = Array.from({ length: 12 }, () => loaded([]))
  months[0] = loaded([employee('A', { days_present: 22 }), employee('B', { days_present: 11 })])
  months[1] = loaded([employee('A', { days_present: 11 }), employee('B', { attendance_source: 'not_uploaded' })])
  const results = buildYearlyEmployees(months, past)
  const all = summarizeYearlyEmployees(results)
  assert.deepEqual(all.trend.slice(0, 3), [
    { month: 'Jan', rate: 75, employees: 2 },
    { month: 'Feb', rate: 50, employees: 1 },
    { month: 'Mar', rate: null, employees: 0 },
  ])
  assert.equal(all.averageRecordedRate, 62.5)
  assert.equal(all.fullYearRate, null)
  const subset = summarizeYearlyEmployees(results.filter(result => result.code === 'A'))
  assert.equal(subset.trend[0].rate, 100)
  assert.equal(subset.averageRecordedRate, 75)
})

test('partial employees do not enter annual threshold counts or a complete annual aggregate', () => {
  const months = year([employee('A'), employee('B', { days_present: 11 })])
  months[4] = loaded([employee('A')])
  const summary = summarizeYearlyEmployees(buildYearlyEmployees(months, past))
  assert.equal(summary.assessedCount, 1)
  assert.equal(summary.belowTarget, 0)
  assert.equal(summary.fullYearRate, null)
  assert.equal(summary.monthsWithRecords, 12)
})

test('empty employees produce no invented zero rates, overtime or threshold counts', () => {
  const summary = summarizeYearlyEmployees([])
  assert.equal(summary.averageRecordedRate, null)
  assert.equal(summary.fullYearRate, null)
  assert.equal(summary.totalOvertime, null)
  assert.equal(summary.belowTarget, null)
  assert.equal(summary.assessedCount, 0)
  assert.equal(summary.monthsWithRecords, 0)
  assert.ok(summary.trend.every(point => point.rate === null && point.employees === 0))
})
