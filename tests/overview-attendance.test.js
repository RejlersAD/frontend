import test from 'node:test'
import assert from 'node:assert/strict'
import { buildOverviewDay, overviewDateKeys, overviewNumber } from '../src/pages/HR/payroll/overviewAttendanceModel.js'

const record = (overrides = {}) => ({
  employee_code: 'E001', name: 'Ava', department: 'Engineering',
  first_in: '2026-09-30T08:00:00', last_out: '2026-09-30T17:00:00',
  regular_hours: 9, overtime_hours: 0, open_shift: false, is_late: false,
  ...overrides,
})

test('numeric values preserve explicit zero and reject missing, malformed or negative hours', () => {
  assert.equal(overviewNumber(0), 0)
  assert.equal(overviewNumber('0.00'), 0)
  assert.equal(overviewNumber(' 1.25 '), 1.25)
  for (const value of [null, undefined, '', ' ', true, false, -1, '-0.5', Infinity, NaN, 'invalid', {}, []]) {
    assert.equal(overviewNumber(value), null, `Expected unknown for ${String(value)}`)
  }
})

test('date range ends at selected day and crosses month and year boundaries locally', () => {
  assert.deepEqual(overviewDateKeys('2026-01-03'), [
    '2025-12-28', '2025-12-29', '2025-12-30', '2025-12-31', '2026-01-01', '2026-01-02', '2026-01-03',
  ])
  assert.deepEqual(overviewDateKeys('2026-09-30'), [
    '2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27', '2026-09-28', '2026-09-29', '2026-09-30',
  ])
})

test('leap dates are retained and invalid dates never roll into another month', () => {
  assert.deepEqual(overviewDateKeys('2024-03-02'), [
    '2024-02-25', '2024-02-26', '2024-02-27', '2024-02-28', '2024-02-29', '2024-03-01', '2024-03-02',
  ])
  for (const value of ['2025-02-29', '2026-02-30', '2026-13-01', '2026-00-01', '2026-09-00', '2026-9-30', '2026-09-30T00:00:00Z', '', null]) {
    assert.deepEqual(overviewDateKeys(value), [])
  }
})

test('empty successful rows mean known zero counts/hours and no departments', () => {
  assert.deepEqual(buildOverviewDay([]), {
    records: 0, checkIns: 0, late: 0, openShifts: 0, regularHours: 0, overtimeHours: 0,
    attention: [], departments: [],
  })
})

test('duplicate employee sessions stay distinct records and attention items', () => {
  const rows = [record({ is_late: true }), record({ is_late: true })]
  const day = buildOverviewDay(rows)
  assert.equal(day.records, 2)
  assert.equal(day.checkIns, 2)
  assert.equal(day.late, 2)
  assert.equal(day.regularHours, 18)
  assert.equal(day.attention.length, 2)
  assert.notEqual(day.attention[0].key, day.attention[1].key)
  assert.equal(day.attention[0].row, rows[0])
  assert.equal(day.departments[0].records, 2)
})

test('manual records without timestamps retain hours without invented absence attention', () => {
  const day = buildOverviewDay([record({ attendance_source: 'manual_upload', first_in: null, last_out: null, regular_hours: '7.25' })])
  assert.equal(day.records, 1)
  assert.equal(day.checkIns, 0)
  assert.equal(day.regularHours, 7.25)
  assert.equal(day.attention.length, 0)
  assert.equal(day.departments[0].checkInShare, 0)
})

test('open-shift availability requires explicit booleans across all selected records', () => {
  const known = buildOverviewDay([record({ open_shift: true }), record()])
  assert.equal(known.openShifts, 1)
  for (const open_shift of [undefined, null, 0, 'false', 'true']) {
    const unknown = buildOverviewDay([record({ open_shift: true }), record({ open_shift })])
    assert.equal(unknown.openShifts, null)
    assert.equal(unknown.departments[0].openShifts, null)
  }
})

test('hours become unknown when any contributing value is missing or invalid', () => {
  const day = buildOverviewDay([
    record({ regular_hours: '2.10', overtime_hours: '0.25' }),
    record({ regular_hours: undefined, overtime_hours: undefined }),
  ])
  assert.equal(day.regularHours, null)
  assert.equal(day.overtimeHours, null)
  assert.equal(day.departments[0].regularHours, null)
  assert.equal(day.departments[0].overtimeHours, null)
  const legacy = buildOverviewDay([record({ regular_hours: undefined, hours_worked: 5.5 })])
  assert.equal(legacy.regularHours, 5.5)
  const invalid = buildOverviewDay([record({ regular_hours: 'bad', hours_worked: 5.5 })])
  assert.equal(invalid.regularHours, null)
})

test('zero hours and decimal totals remain known', () => {
  const day = buildOverviewDay([
    record({ regular_hours: '0', overtime_hours: '0' }),
    record({ regular_hours: '0.1', overtime_hours: '0.1' }),
    record({ regular_hours: '0.2', overtime_hours: '0.2' }),
  ])
  assert.equal(day.regularHours, 0.3)
  assert.equal(day.overtimeHours, 0.3)
})

test('attention preserves one issue per record in explicit open/late/overtime priority', () => {
  const day = buildOverviewDay([
    record({ open_shift: true, is_late: true, overtime_hours: 2 }),
    record({ is_late: true, overtime_hours: 2 }),
    record({ overtime_hours: '1.25' }),
    record({ first_in: null }),
  ])
  assert.deepEqual(day.attention.map(item => [item.type, item.issue, item.tone]), [
    ['open_shift', 'Open shift', 'warning'],
    ['late', 'Late arrival', 'warning'],
    ['overtime', 'Recorded overtime', 'info'],
  ])
  assert.match(day.attention[2].detail, /1.25 h recorded/)
  assert.match(day.attention[2].detail, /approval is separate/)
})

test('late count uses only explicit true flags, not truthy strings', () => {
  const day = buildOverviewDay([record({ is_late: true }), record({ is_late: 'true' }), record({ is_late: 1 })])
  assert.equal(day.late, 1)
  assert.equal(day.attention.length, 1)
})

test('department summaries use existing identity fields and their own availability/scope', () => {
  const day = buildOverviewDay([
    record({ radai_department: 'Delivery', department: 'Legacy', first_in: null }),
    record({ department: 'Engineering', open_shift: undefined, regular_hours: undefined }),
    record({ radai_department: 'Delivery', is_late: true, overtime_hours: 1 }),
    record({ department: '' }),
  ])
  assert.deepEqual(day.departments.map(item => item.dept), ['Delivery', 'Engineering', 'General'])
  const delivery = day.departments[0]
  assert.equal(delivery.records, 2)
  assert.equal(delivery.checkIns, 1)
  assert.equal(delivery.checkInShare, 50)
  assert.equal(delivery.regularHours, 18)
  assert.equal(delivery.overtimeHours, 1)
  assert.equal(day.departments[1].regularHours, null)
  assert.equal(day.regularHours, null)
})
