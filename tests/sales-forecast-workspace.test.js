import test from 'node:test';
import assert from 'node:assert/strict';
import {
  forecastDifference, forecastMonths, forecastNumber, forecastPeriodLabel, forecastReviewInputs,
  forecastScenarioValue, forecastSnapshotLabel, loadForecastRegister, samePeriodSnapshots, scenarioField,
} from '../src/pages/Sales/salesForecastWorkspace.js';

test('complete forecast register follows service page numbers without following response URLs', async () => {
  const calls = [];
  const result = await loadForecastRegister(async params => {
    calls.push(params);
    return params.page === 1
      ? { count: 2, results: [{ id: 'one' }], next: 'https://untrusted.example/account' }
      : { count: 2, results: [{ id: 'two' }], next: null };
  });
  assert.deepEqual(result, { count: 2, results: [{ id: 'one' }, { id: 'two' }] });
  assert.deepEqual(calls, [1, 2].map(page => ({ page, page_size: 100, ordering: '-forecast_date,-id' })));
  assert.deepEqual(await loadForecastRegister(async () => []), { results: [], count: 0 });
});

test('changed, cyclic, truncated and denied forecast pages never publish partial totals', async () => {
  for (const second of [
    { count: 3, results: [{ id: 'two' }], next: null },
    { count: 2, results: [{ id: 'one' }], next: '?page=1' },
    { count: 2, results: [], next: null },
    { count: 2, results: [{}], next: null },
  ]) {
    await assert.rejects(() => loadForecastRegister(async ({ page }) => page === 1
      ? { count: 2, results: [{ id: 'one' }], next: '?page=2' } : second), /changed while loading/);
  }
  await assert.rejects(() => loadForecastRegister(async () => ({ results: null })), /loaded completely/);
  await assert.rejects(() => loadForecastRegister(async ({ page }) => {
    if (page === 2) throw new Error('Access denied');
    return { count: 2, results: [{ id: 'one' }], next: '?page=2' };
  }), /Access denied/);
});

test('periods provide only validated months and preserve unsupported period labels', () => {
  assert.equal(forecastPeriodLabel('2026-Q4'), 'Q4 2026');
  assert.deepEqual(forecastMonths('2026-Q4'), [
    { key: '2026-10', label: 'Oct 2026' }, { key: '2026-11', label: 'Nov 2026' }, { key: '2026-12', label: 'Dec 2026' },
  ]);
  assert.equal(forecastPeriodLabel('2026-10'), 'Oct 2026');
  assert.equal(forecastPeriodLabel('2026-10-01'), '01 Oct 2026');
  assert.deepEqual(forecastMonths('2026-10-01'), [{ key: '2026-10', label: 'Oct 2026' }]);
  assert.equal(forecastMonths('2026').length, 12);
  assert.equal(forecastMonths('2024-02-29').length, 1);
  for (const value of ['2026-Q5', '2026-00', '2026-13', '2026-02-29', '1900-02-29', '2026-04-31', '0000', 'FY26', '', null]) {
    assert.deepEqual(forecastMonths(value), []);
  }
  assert.equal(forecastPeriodLabel('FY26'), 'FY26');
  assert.equal(forecastPeriodLabel(null), '—');
});

test('decimal rendering preserves zero and exact digits beyond floating-point precision', () => {
  assert.equal(forecastNumber('0.00'), '0');
  assert.equal(forecastNumber(0), '0');
  assert.equal(forecastNumber('-0.001', { decimals: 2 }), '0.00');
  assert.equal(forecastNumber('9007199254740993.25', { decimals: 2 }), '9,007,199,254,740,993.25');
  assert.equal(forecastNumber('1234.565', { decimals: 2 }), '1,234.57');
  assert.equal(forecastNumber('-1234.565', { decimals: 2 }), '-1,234.57');
  assert.equal(forecastNumber('1800000.00', { compact: true, decimals: 2 }), '1.80m');
  assert.equal(forecastNumber('12000', { compact: true }), '12k');
  assert.equal(forecastNumber('12.34', { compact: true, decimals: 2 }), '12.34');
});

test('missing or noncanonical decimal input stays missing instead of being coerced to zero', () => {
  for (const value of [undefined, null, '', ' ', ' 1', '01', '+1', '1,000', '1e3', '1.', '.5', 'NaN', NaN, Infinity, true, {}, [], Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(forecastNumber(value), '—', String(value));
    assert.equal(forecastDifference(value, '0'), null, String(value));
  }
});

test('differences use exact signed decimal arithmetic and normalize trailing fractional zeros', () => {
  assert.equal(forecastDifference('1800000.00', '2000000.00'), '-200000');
  assert.equal(forecastDifference('0.3', '0.2'), '0.1');
  assert.equal(forecastDifference('9007199254740993.01', '9007199254740992.99'), '0.02');
  assert.equal(forecastDifference('1', '1.000'), '0');
  assert.equal(forecastDifference('100.00', '0'), '100');
  assert.equal(forecastDifference('-2.1', '-3.123'), '1.023');
  assert.equal(forecastDifference('0', '0.000001'), '-0.000001');
});

test('scenario selection reads only the supported stored fields without changing their representation', () => {
  const row = { predicted_revenue: '0.00', best_case: '2.30', worst_case: '0.10' };
  assert.equal(scenarioField('base'), 'predicted_revenue');
  assert.equal(scenarioField('best'), 'best_case');
  assert.equal(scenarioField('worst'), 'worst_case');
  assert.equal(scenarioField('toString'), null);
  assert.equal(forecastScenarioValue(row, 'base'), '0.00');
  assert.equal(forecastScenarioValue(row, 'best'), '2.30');
  assert.equal(forecastScenarioValue(row, 'unknown'), null);
  assert.equal(forecastScenarioValue({}, 'base'), null);
});

test('snapshot comparison remains within the exact period with deterministic newest-first dates', () => {
  const rows = [
    { id: 'b', forecast_period: '2026-Q4', forecast_date: '2026-10-01', status: 'draft' },
    { id: 'a', forecast_period: '2026-Q4', forecast_date: '2026-10-01', status: 'draft' },
    { id: 'prior', forecast_period: '2026-Q4', forecast_date: '2026-09-30', status: 'approved' },
    { id: 'other', forecast_period: '2026-Q3', forecast_date: '2026-10-02', status: 'approved' },
    { id: 'overlap', forecast_period: '2026-10', forecast_date: '2026-10-02', status: 'approved' },
    { id: 'invalid-date', forecast_period: '2026-Q4', forecast_date: '2026-13-40' },
  ];
  const original = rows.map(row => row.id);
  const selected = samePeriodSnapshots(rows, '2026-Q4');
  assert.deepEqual(selected.map(row => row.id), ['b', 'a', 'prior', 'invalid-date']);
  assert.equal(selected.find(row => row.status === 'approved').id, 'prior');
  assert.deepEqual(rows.map(row => row.id), original);
  assert.deepEqual(samePeriodSnapshots(rows, null), []);
  assert.deepEqual(samePeriodSnapshots([], '2026-Q4'), []);
});

test('snapshot labels use the recorded calendar date and never the AI model version', () => {
  assert.equal(forecastSnapshotLabel({ forecast_date: '2026-10-01', model_version: 'v03' }), '01 Oct 2026');
  assert.equal(forecastSnapshotLabel({ forecast_date: '2026-02-30', model_version: 'v03' }), 'Date unavailable');
  assert.equal(forecastSnapshotLabel({ model_version: 'v03' }), 'Date unavailable');
});

test('input review names only actual contract gaps without fabricated opportunities or approval policy', () => {
  assert.deepEqual(forecastReviewInputs(null), []);
  const gaps = forecastReviewInputs({ id: 'saved', predicted_revenue: '1.00', model_version: 'v1' });
  assert.deepEqual(gaps.map(gap => gap.input), ['Currency', 'Delivery phasing', 'Capacity', 'Margin target']);
  assert.ok(gaps.every(gap => gap.source === 'Forecast snapshot' && !('blocking' in gap) && !('opportunity_id' in gap)));
});
