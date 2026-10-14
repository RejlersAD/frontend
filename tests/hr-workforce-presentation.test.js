import test from 'node:test';
import assert from 'node:assert/strict';
import { attendanceAvailability, buildDailyObservation, buildAttendancePattern, buildDepartmentReadiness } from '../src/pages/HR/hrWorkforcePresentation.js';

const today = new Date(2026, 8, 24, 12);
const report = (rows) => ({ configured: true, rows });

test('unavailable and success-shaped connection failures never become zero attendance', () => {
  for (const input of [null, {}, { configured: false, rows: [] }, { configured: false, reason: 'unreachable', rows: [] }, { rows: [], error: 'denied' }, report([null])]) {
    assert.equal(attendanceAvailability(input).available, false);
    const result = buildDailyObservation(input);
    for (const key of ['present', 'late', 'onTime', 'partial']) assert.equal(result[key], null);
  }
});

test('recorded empty daily response supports zero but missing flags remain unknown', () => {
  const empty = buildDailyObservation(report([]));
  assert.equal(empty.present, 0);
  assert.equal(empty.late, 0);
  const result = buildDailyObservation(report([
    { employee_code: ' A ', is_late: true, is_full_day: false },
    { employee_code: 'a', is_late: true, is_full_day: false },
    { employee_code: 'b' },
  ]));
  assert.equal(result.present, 2);
  assert.equal(result.late, null);
  assert.equal(result.onTime, null);
  assert.equal(result.partial, null);
});

test('monthly chart counts unique recorded check-ins and preserves gaps across a month boundary', () => {
  const input = report([
    { employee_code: 'one', days_detail: [
      { date: '2026-09-24', first_in: '2026-09-24T08:00:00', is_late: false },
      { date: '2026-09-24', first_in: '2026-09-24T09:00:00', is_late: false },
      { date: '2026-09-23', first_in: null, hours: 9 },
    ] },
    { employee_code: 'two', days_detail: [{ date: '2026-09-24', first_in: '09:15:00', is_late: true }] },
  ]);
  const result = buildAttendancePattern(input, today, 30);
  assert.equal(result.length, 30);
  assert.equal(result[0].date, '2026-08-26');
  assert.equal(result[0].present, null);
  assert.equal(result.at(-2).present, null);
  assert.equal(result.at(-1).present, 2);
  assert.equal(result.at(-1).late, 1);
  assert.equal(result.at(-1).onTime, 1);
  for (const item of result) {
    assert.equal(item.scheduled, null);
    assert.equal(item.rate, null);
  }
});

test('monthly flags, missing identities and invalid timestamp evidence are not invented', () => {
  const input = report([
    { employee_code: 'a', days_detail: [{ date: '2026-09-24', first_in: '2026-09-24T08:00:00' }] },
    { employee_code: 'b', days_detail: [{ date: '2026-09-24', first_in: 'unavailable' }] },
    { days_detail: [{ date: '2026-09-24', first_in: '08:00:00' }] },
  ]);
  const result = buildAttendancePattern(input, today, 1)[0];
  assert.equal(result.present, 1);
  assert.equal(result.late, null);
  assert.equal(result.onTime, null);
  assert.equal(buildAttendancePattern(report([]), today, 1)[0].present, null);
  assert.equal(buildAttendancePattern({ configured: false, rows: [] }, today, 1)[0].present, null);
});

test('department aggregation uses observed daily and live facts independently', () => {
  const daily = report([
    { employee_code: 'a', department: 'Engineering', is_late: false },
    { employee_code: 'b', department: 'Engineering', is_late: true },
    { employee_code: 'c', department: 'HR', is_late: false },
  ]);
  const live = report([
    { employee_code: 'a', department: 'Engineering', is_in: true },
    { employee_code: 'b', department: 'Engineering', is_in: false },
    { employee_code: 'd', department: 'Finance', punch_type: 'OUT' },
  ]);
  const rows = buildDepartmentReadiness(daily, live);
  assert.deepEqual(rows[0], { department: 'Engineering', present: 1, late: 1, observed: 2, coverage: 'Attendance records only' });
  assert.equal(rows[1].department, 'Finance');
  assert.equal(rows[1].present, 0);
  assert.equal(rows[1].observed, null);
  assert.equal(rows[2].present, null);
  assert.equal(rows[2].late, 0);
  const withoutLive = buildDepartmentReadiness(daily, { configured: false, rows: [] });
  assert.ok(withoutLive.every((row) => row.present === null));
});
