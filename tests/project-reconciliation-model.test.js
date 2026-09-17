import test from 'node:test'
import assert from 'node:assert/strict'
import { recordKey, formatMoney, filterReconciliationRecords, reconciliationSummary, projectCandidates } from '../src/pages/Procurement/projectReconciliationModel.js'
import { reconciliationProjects, reconciliationRows, reconciliationReport } from './fixtures/project-reconciliation.fixture.js'

test('record identity includes the source type so unrelated numeric IDs cannot collide', () => {
  assert.notEqual(recordKey({ id: '42', record_type: 'purchase_order' }), recordKey({ id: '42', record_type: 'purchase_requisition' }))
  assert.equal(recordKey(null), '')
})

test('review filters combine source type, issue, currency and legacy reference search', () => {
  const result = filterReconciliationRecords(reconciliationRows, { type: 'purchase_requisition', issue: 'no_exact_match', currency: 'AED', search: '  REVISION a  ' })
  assert.deepEqual(result.map(row => row.id), ['pr-001'])
  assert.deepEqual(filterReconciliationRecords(reconciliationRows, { type: 'invoice', currency: 'USD' }), [])
})

test('saved exceptions remain available without occupying the active review queue', () => {
  assert.equal(filterReconciliationRecords(reconciliationRows).some(row => row.id === 'pr-002'), false)
  assert.deepEqual(filterReconciliationRecords(reconciliationRows, { status: 'exceptions' }).map(row => row.id), ['pr-002'])
  assert.equal(filterReconciliationRecords(reconciliationRows, { status: 'all' }).length, reconciliationRows.length)
})

test('value ordering groups currencies instead of treating USD and AED as equivalent', () => {
  const rows = [
    { id: 'usd', record_type: 'invoice', amount: '999999.00', currency: 'USD' },
    { id: 'aed-low', record_type: 'invoice', amount: '10.00', currency: 'AED' },
    { id: 'aed-high', record_type: 'invoice', amount: '20.00', currency: 'AED' },
  ]
  const snapshot = structuredClone(rows)
  assert.deepEqual(filterReconciliationRecords(rows, { sort: 'value' }).map(row => row.id), ['aed-high', 'aed-low', 'usd'])
  assert.deepEqual(rows, snapshot)
})

test('date ordering changes review order without changing source records', () => {
  const snapshot = structuredClone(reconciliationRows)
  assert.equal(filterReconciliationRecords(reconciliationRows, { sort: 'newest' })[0].id, 'po-001')
  assert.equal(filterReconciliationRecords(reconciliationRows, { sort: 'oldest' })[0].id, 'master-001')
  assert.deepEqual(reconciliationRows, snapshot)
})

test('metrics use full report totals for a sampled queue and session count for safe links', () => {
  const report = reconciliationReport(reconciliationRows.slice(0, 1))
  report.summary = { ...report.summary, unresolved_total: 500, suggested_record_count: 120, sample_count: 1, sample_complete: false, unresolved_amounts_by_currency: [{ currency: 'AED', amount: '800000.00', record_count: 400 }, { currency: 'USD', amount: '10000.00', record_count: 100 }] }
  const result = reconciliationSummary(report, 2)
  assert.equal(result.unresolved, 500)
  assert.equal(result.suggested, 120)
  assert.equal(result.linked, 2)
  assert.equal(result.sampleCount, 1)
  assert.equal(result.complete, false)
  assert.deepEqual(result.values, report.summary.unresolved_amounts_by_currency)
  assert.equal(reconciliationSummary(report).linked, 0)
})

test('fallback financial metrics keep currencies separate and ignore missing or invalid values', () => {
  const result = reconciliationSummary({ unresolved: [
    { amount: '0.10', currency: 'AED' }, { amount: '0.20', currency: 'AED' },
    { amount: '12.75', currency: 'USD' }, { amount: null, currency: 'AED' },
    { amount: 'invalid', currency: 'AED' }, { amount: '1000.00', currency: '' },
  ] })
  assert.deepEqual(result.values, [{ currency: 'AED', amount: 0.3, record_count: 2 }, { currency: 'USD', amount: 12.75, record_count: 1 }])
})

test('suggestions retain server evidence without inventing confidence scores', () => {
  const candidates = projectCandidates(reconciliationRows[0], reconciliationProjects)
  assert.deepEqual(candidates.map(project => project.id), ['17', '18'])
  assert.equal(candidates[0].match_strength, 'high')
  assert.deepEqual(candidates[0].reasons, ['Project code appears in the legacy reference.'])
  for (const candidate of candidates) {
    assert.equal(Object.hasOwn(candidate, 'confidence'), false)
    assert.equal(Object.hasOwn(candidate, 'score'), false)
    assert.equal(Object.hasOwn(candidate, 'percentage'), false)
  }
})

test('project search reaches unsuggested choices and does not manufacture matching evidence', () => {
  const snapshot = structuredClone(reconciliationProjects)
  const candidates = projectCandidates(reconciliationRows[0], reconciliationProjects, '  grid OPERATIONS ')
  assert.deepEqual(candidates.map(project => project.id), ['19'])
  assert.equal(Object.hasOwn(candidates[0], 'match_strength'), false)
  assert.equal(Object.hasOwn(candidates[0], 'reasons'), false)
  assert.deepEqual(reconciliationProjects, snapshot)
})

test('financial formatting retains the currency and never coerces missing amounts to zero', () => {
  assert.equal(formatMoney('150000.50', 'AED'), 'AED 150,000.5')
  assert.equal(formatMoney('150000', 'AED', true), 'AED 150K')
  for (const amount of [null, undefined, '', 'invalid', Infinity]) assert.equal(formatMoney(amount, 'AED'), '—')
})
