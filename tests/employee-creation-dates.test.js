import test from 'node:test'
import assert from 'node:assert/strict'
import { employeeDefaults, sixMonthsAfter, updateEmployeeField } from '../src/pages/HR/employeeCreationData.js'

test('probation clamps calendar month ends including leap years', () => {
  assert.equal(sixMonthsAfter('2026-08-31'), '2027-02-28')
  assert.equal(sixMonthsAfter('2027-08-31'), '2028-02-29')
})

test('joining date updates default probation but preserves HR custom dates', () => {
  let data = updateEmployeeField(employeeDefaults(), 'joining_date', '2026-01-31')
  assert.equal(data.probation_start_date, '2026-01-31')
  assert.equal(data.probation_end_date, '2026-07-31')
  data = updateEmployeeField(data, 'probation_end_date', '2026-05-15')
  data = updateEmployeeField(data, 'probation_start_date', '2026-02-01')
  data = updateEmployeeField(data, 'joining_date', '2026-03-01')
  assert.equal(data.probation_start_date, '2026-02-01')
  assert.equal(data.probation_end_date, '2026-05-15')
})
