import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ACTIVE_STAGES, DEFAULT_FILTERS, attentionItems, deadlineInfo, displayDate,
  filterOpportunities, loadOpportunityRegister, pipelineTotals,
} from '../src/pages/Sales/salesOpportunityRegister.js'

const today = '2026-09-30'
const record = (id, changes = {}) => ({ id, deal_code: `Q-${id}`, deal_name: `Package ${id}`,
  client_name: 'Synthetic Buyer', owner: 11, owner_name: 'Aisha Noor',
  stage: 'lead', bid_decision: 'pending', service_categories: [],
  submission_due_date: null, next_action_date: null, weighted_value: null, currency: '', ...changes })

test('date-only deadlines include today and do not invent missing or invalid dates', () => {
  assert.equal(deadlineInfo('2026-09-30', today).label, 'Due today')
  assert.equal(deadlineInfo('2026-10-01', today).days, 1)
  assert.equal(deadlineInfo('2026-09-29', today).label, 'Overdue by 1 day')
  for (const value of [null, '', '2026-02-30', '2026-09-31', '2026-09-30T08:00:00Z']) {
    assert.equal(deadlineInfo(value, today).days, null)
    assert.equal(displayDate(value), 'Not provided')
  }
})

test('weighted sums preserve decimal cents and keep each currency separate', () => {
  const result = pipelineTotals([
    { weighted_value: '9999999999999.99', currency: 'AED' },
    { weighted_value: '0.01', currency: 'AED' },
    { weighted_value: '125.25', currency: 'USD' },
    { weighted_value: '0.00', currency: 'OMR' },
  ])
  assert.deepEqual(result, { missing: 0, totals: [
    { currency: 'AED', value: '10000000000000.00' },
    { currency: 'OMR', value: '0.00' },
    { currency: 'USD', value: '125.25' },
  ] })
})

test('unknown amounts and currencies remain an explicit missing cohort', () => {
  const result = pipelineTotals([
    { weighted_value: '10.50', currency: 'AED' }, { weighted_value: null, currency: 'AED' },
    { weighted_value: '250.00', currency: '' }, { weighted_value: 'NaN', currency: 'USD' },
  ])
  assert.equal(result.missing, 3)
  assert.deepEqual(result.totals, [{ currency: 'AED', value: '10.50' }])
  assert.deepEqual(pipelineTotals([record(1)]), { missing: 1, totals: [] })
})

test('default open filter includes all active stages and excludes closed outcomes', () => {
  const rows = [...ACTIVE_STAGES, 'awarded', 'converted', 'lost', 'no_bid', 'cancelled']
    .map((stage, index) => record(index, { stage }))
  assert.deepEqual(filterOpportunities(rows, '', DEFAULT_FILTERS, today).map(row => row.stage), ACTIVE_STAGES)
})

test('search and structured filters combine across the complete supplied register', () => {
  const match = record(1, { deal_name: 'Offshore compressor replacement', owner: 12,
    stage: 'qualified', bid_decision: 'bid', service_categories: ['engineering_design'],
    submission_due_date: '2026-10-07', client_reference: 'ITT-70003' })
  const otherOwner = record(2, { ...match, id: 2, owner: 11 })
  const filters = { ...DEFAULT_FILTERS, status: 'qualified', bid: 'bid', service: 'engineering_design', owner: '12', deadline: 'week' }
  assert.deepEqual(filterOpportunities([match, otherOwner], 'itt-70003', filters, today).map(row => row.id), [1])
  assert.deepEqual(filterOpportunities([match], 'different client', filters, today), [])
})

test('deadline filters distinguish today, overdue and genuinely missing dates', () => {
  const rows = [record(1, { submission_due_date: today }), record(2, { submission_due_date: '2026-09-29' }),
    record(3), record(4, { submission_due_date: '2026-10-08' })]
  const filtered = deadline => filterOpportunities(rows, '', { ...DEFAULT_FILTERS, deadline }, today).map(row => row.id)
  assert.deepEqual(filtered('week'), [1])
  assert.deepEqual(filtered('overdue'), [2])
  assert.deepEqual(filtered('missing'), [3])
})

test('missing owner filter does not treat a named owner as unassigned', () => {
  const rows = [record(1), record(2, { owner: null, owner_name: '' })]
  assert.deepEqual(filterOpportunities(rows, '', { ...DEFAULT_FILTERS, owner: 'unassigned' }, today).map(row => row.id), [2])
})

test('attention requires recorded deadlines and never invents a Go/No-Go due date', () => {
  const rows = [record(1, { stage: 'qualified' }),
    record(2, { stage: 'qualified', next_action_date: '2026-09-29' }),
    record(3, { submission_due_date: '2026-09-29' }),
    record(4, { stage: 'lost', submission_due_date: '2026-09-29' }),
    record(5, { owner: null })]
  const result = attentionItems(rows, today)
  assert.deepEqual(result.map(item => [item.row.id, item.kind]), [[3, 'deadline'], [2, 'decision'], [5, 'owner']])
})

test('register loader reads every page before returning a complete count', async () => {
  const calls = []
  const result = await loadOpportunityRegister(async parameters => {
    calls.push(parameters.page)
    return parameters.page === 1
      ? { count: 2, next: '/api/v1/sales/deals/?page=2', results: [record(1)] }
      : { count: 2, next: null, results: [record(2)] }
  })
  assert.deepEqual(calls, [1, 2])
  assert.deepEqual(result.results.map(row => row.id), [1, 2])
  assert.equal(result.count, 2)
})

test('partial page failure cannot return a misleading partial register', async () => {
  await assert.rejects(loadOpportunityRegister(async ({ page }) => {
    if (page === 1) return { count: 2, next: '/next', results: [record(1)] }
    throw new Error('Synthetic second-page denial')
  }), /second-page denial/)
})

test('duplicate IDs and changed total counts fail complete loading', async () => {
  await assert.rejects(loadOpportunityRegister(async ({ page }) => ({
    count: 2, next: page === 1 ? '/next' : null, results: [record(1)],
  })), /changed while loading/)
  await assert.rejects(loadOpportunityRegister(async () => ({ count: 3, next: null, results: [record(1)] })), /changed while loading/)
  await assert.rejects(loadOpportunityRegister(async ({ page }) => ({
    count: page === 1 ? 2 : 3, next: page === 1 ? '/next' : null, results: [record(page)],
  })), /changed while loading/)
})

test('empty complete register is valid but malformed results are rejected', async () => {
  assert.deepEqual(await loadOpportunityRegister(async () => ({ count: 0, next: null, results: [] })), { count: 0, results: [] })
  await assert.rejects(loadOpportunityRegister(async () => ({ count: 1, next: null })), /incomplete response/)
})
