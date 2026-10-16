import test from 'node:test'
import assert from 'node:assert/strict'
import { loadAttendanceOverrides } from '../src/utils/attendanceOverrides.js'

const row = id => ({ id, employee_code: `ATT${id}`, date: '2026-09-02', override_hours: '6.00' })
const page = (results, count = results.length, next = null) => ({ count, next, previous: null, results })

test('empty DRF response means no corrections, not a loading failure', async () => {
  assert.deepEqual(await loadAttendanceOverrides(async () => page([])), [])
})

test('one page retains correction fields and decimal hours', async () => {
  assert.deepEqual(await loadAttendanceOverrides(async () => page([row(1)])), [row(1)])
})

test('collects corrections beyond the backend default 500-row page', async () => {
  const records = Array.from({ length: 501 }, (_, i) => row(i + 1))
  const requests = []
  const result = await loadAttendanceOverrides(async number => {
    requests.push(number)
    return number === 1
      ? page(records.slice(0, 500), 501, 'http://localhost:8000/api/v1/payroll/attendance-overrides/?year=2026&month=9&page=2')
      : page(records.slice(500), 501)
  })
  assert.deepEqual(result, records)
  assert.deepEqual(requests, [1, 2])
})

test('supports a legacy unpaginated array', async () => {
  assert.deepEqual(await loadAttendanceOverrides(async () => [row(1)]), [row(1)])
})

for (const status of [401, 403, 500]) {
  test(`page-two HTTP ${status} rejects without publishing partial corrections; retry starts fresh`, async () => {
    const failure = Object.assign(new Error('Synthetic read failure'), { response: { status } })
    const requests = []
    let failed = true
    const fetchPage = async number => {
      requests.push(number)
      if (number === 2 && failed) throw failure
      return number === 1 ? page([row(1)], 2, '?page=2') : page([row(2)], 2)
    }
    await assert.rejects(loadAttendanceOverrides(fetchPage), error => error === failure)
    failed = false
    assert.deepEqual(await loadAttendanceOverrides(fetchPage), [row(1), row(2)])
    assert.deepEqual(requests, [1, 2, 1, 2])
  })
}

for (const [label, response] of [
  ['missing results', { count: 0, next: null }],
  ['missing continuation', { count: 1, results: [row(1)] }],
  ['invalid count', page([], '0')],
  ['truncated rows', page([row(1)], 2)],
  ['extra rows', page([row(1)], 0)],
  ['repeated page', page([row(1)], 2, '?page=1')],
  ['skipped page', page([row(1)], 2, '?page=3')],
  ['invalid next link', page([row(1)], 2, {})],
  ['empty continuation', page([], 1, '?page=2')],
]) {
  test(`rejects ${label} instead of reporting complete totals`, async () => {
    await assert.rejects(loadAttendanceOverrides(async () => response), /could not be loaded completely/)
  })
}

test('a changed count during pagination remains incomplete until retried', async () => {
  await assert.rejects(loadAttendanceOverrides(async number => number === 1
    ? page([row(1)], 2, '?page=2')
    : page([row(2)], 3)), /could not be loaded completely/)
})
