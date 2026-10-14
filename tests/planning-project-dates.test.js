import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import process from 'node:process'
import test from 'node:test'
import { calculatePlanningDuration } from '../src/utils/planningProjectDates.js'

test('duration counts elapsed days rather than including both endpoints', () => {
  assert.deepEqual(calculatePlanningDuration('2026-10-05', '2026-10-06'), { days: 1, months: 0.0323 })
  assert.deepEqual(calculatePlanningDuration('2026-10-05', '2026-12-18'), { days: 74, months: 2.4194 })
})

test('month-end anniversaries clamp to the final day of shorter months', () => {
  assert.deepEqual(calculatePlanningDuration('2023-01-31', '2023-02-28'), { days: 28, months: 1 })
  assert.deepEqual(calculatePlanningDuration('2024-01-31', '2024-02-29'), { days: 29, months: 1 })
  assert.deepEqual(calculatePlanningDuration('2024-01-31', '2024-03-30'), { days: 59, months: 1.9677 })
  assert.deepEqual(calculatePlanningDuration('2024-01-31', '2024-03-31'), { days: 60, months: 2 })
})

test('leap days and year transitions retain calendar month interpolation', () => {
  assert.deepEqual(calculatePlanningDuration('2024-02-28', '2024-03-01'), { days: 2, months: 0.069 })
  assert.deepEqual(calculatePlanningDuration('2024-02-29', '2025-02-28'), { days: 365, months: 12 })
  assert.deepEqual(calculatePlanningDuration('2023-12-15', '2024-01-15'), { days: 31, months: 1 })
  assert.deepEqual(calculatePlanningDuration('2023-12-31', '2024-01-01'), { days: 1, months: 0.0323 })
  assert.deepEqual(calculatePlanningDuration('0099-12-31', '0100-01-01'), { days: 1, months: 0.0323 })
})

test('missing, malformed, overflowed, equal and reversed dates are rejected', () => {
  for (const value of [undefined, null, '', 20260101, new Date(), 'not-a-date', '2024-2-01', '2024-02-1', ' 2024-02-01', '2024-02-01 ', '2024-02-01T00:00:00Z', '0000-01-01', '2024-00-01', '2024-13-01', '2024-02-00', '2024-01-32', '2023-02-29', '2024-02-30', '2024-04-31', '1900-02-29']) {
    assert.equal(calculatePlanningDuration(value, '2026-01-01'), null, `invalid start: ${value}`)
    assert.equal(calculatePlanningDuration('2020-01-01', value), null, `invalid finish: ${value}`)
  }
  assert.equal(calculatePlanningDuration('2026-01-01', '2026-01-01'), null)
  assert.equal(calculatePlanningDuration('2026-01-02', '2026-01-01'), null)
  assert.deepEqual(calculatePlanningDuration('2000-02-29', '2000-03-01'), { days: 1, months: 0.0345 })
})

test('elapsed days and fractional months do not change across time zones or DST transitions', () => {
  const moduleUrl = new URL('../src/utils/planningProjectDates.js', import.meta.url).href
  const script = `import { calculatePlanningDuration } from ${JSON.stringify(moduleUrl)};
    process.stdout.write(JSON.stringify([
      calculatePlanningDuration('2024-03-09', '2024-03-11'),
      calculatePlanningDuration('2024-11-02', '2024-11-04')
    ]));`
  for (const zone of ['UTC', 'America/New_York', 'Asia/Dubai', 'Pacific/Auckland']) {
    const result = execFileSync(process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8', env: { ...process.env, TZ: zone } })
    assert.deepEqual(JSON.parse(result), [{ days: 2, months: 0.0645 }, { days: 2, months: 0.0667 }], zone)
  }
})
