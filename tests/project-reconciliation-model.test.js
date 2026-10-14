import test from 'node:test'
import assert from 'node:assert/strict'
import { ISSUE_LABELS, recordKey, formatMoney, filterReconciliationRecords, reconciliationSummary, projectCandidates } from '../src/pages/Procurement/projectReconciliationModel.js'
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
  assert.match(formatMoney('150000', 'AED', true), /^AED 150[kK]$/)
  for (const amount of [null, undefined, '', 'invalid', Infinity]) assert.equal(formatMoney(amount, 'AED'), '—')
})

test('all projects includes every registered choice beyond twelve while preserving suggestion evidence', () => {
  const projects = Array.from({ length: 25 }, (_, index) => ({ id: index + 1, code: `P-${String(index + 1).padStart(3, '0')}`, name: `Plant ${index + 1}`, currency: 'AED' }))
  const record = { suggested_projects: [{ id: '25', code: 'P-025', name: 'Plant 25', match_strength: 'high', reasons: ['Exact source code.'] }] }
  const before = structuredClone({ record, projects })
  assert.deepEqual(projectCandidates(record, projects).map(project => project.id), ['25'])
  const all = projectCandidates(record, projects, '', { includeAll: true })
  assert.equal(all.length, 25)
  assert.equal(all.at(-1).id, '25')
  assert.equal(all.at(-1).currency, 'AED')
  assert.deepEqual(all.at(-1).reasons, ['Exact source code.'])
  assert.equal(all.filter(project => Object.hasOwn(project, 'match_strength')).length, 1)
  assert.deepEqual({ record, projects }, before)
})

test('default suggestions preserve server order and show only three distinct real candidates', () => {
  const suggestions = [4, 2, '4', 1, 3].map(id => ({ id, code: `P-${id}`, match_strength: 'medium', reasons: ['Recorded evidence.'] }))
  assert.deepEqual(projectCandidates({ suggested_projects: suggestions }, []).map(project => String(project.id)), ['4', '2', '1'])
  assert.equal(projectCandidates({ suggested_projects: suggestions }, [], '', { includeAll: true }).length, 4)
})

test('search includes all matches without a hidden result cap even when suggestions exist', () => {
  const projects = Array.from({ length: 30 }, (_, index) => ({ id: index, code: `P-${String(index).padStart(3, '0')}`, name: `Shared project ${index}`, client_name: 'Regional Client' }))
  const record = { suggested_projects: [projects[0]] }
  for (const options of [{}, { includeAll: true }]) {
    assert.equal(projectCandidates(record, projects, ' shared ', options).length, 30)
    assert.equal(projectCandidates(record, projects, 'regional CLIENT', options).length, 30)
    assert.deepEqual(projectCandidates(record, projects, 'P-029', options).map(project => project.id), [29])
  }
  assert.equal(projectCandidates(null, projects).length, 30)
  assert.deepEqual(projectCandidates(record, projects, 'not present'), [])
})

test('project search ranks exact and partial codes before name and client matches', () => {
  const projects = [
    { id: 'client', code: '0001', name: 'Station', client_name: 'Client 590' },
    { id: 'name', code: '0002', name: 'Station 590' },
    { id: 'code-partial', code: '1590', name: 'Other' },
    { id: 'code-prefix', code: '5901', name: 'Other' },
    { id: 'exact', code: '590', name: 'Other' },
  ]
  assert.deepEqual(projectCandidates(null, projects, '590').map(project => project.id), ['exact', 'code-prefix', 'code-partial', 'name', 'client'])
})

test('exact-code records are described as needing review and remain in the filtered queue', () => {
  assert.equal(ISSUE_LABELS.exact_match_available, 'Exact code ready for review')
  const row = { id: 'exact', record_type: 'purchase_order', reason: 'exact_match_available', suggested_projects: [{ id: '17', match_strength: 'high', reasons: ['Exact source project code.'] }] }
  assert.deepEqual(filterReconciliationRecords([row], { issue: 'exact_match_available' }), [row])
})
