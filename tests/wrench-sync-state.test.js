import test from 'node:test'
import assert from 'node:assert/strict'
import {
  syncOutcome, jobOutcome, isTransientWrenchError,
  MAX_READ_ATTEMPTS, READ_RETRY_DELAY_MS, MAX_POLL_FAILURES,
} from '../src/utils/wrenchSyncState.js'

const log = overrides => ({
  id: 71, status: 'success', records_requested: 2, records_synced: 2, records_failed: 0,
  error_message: '', sync_details: { retrieval_validated: true, effect: 'metadata_retrieval' },
  ...overrides,
})
const job = overrides => ({
  id: 72, status: 'success', records_exported: 2, records_failed: 0,
  completed_at: '2026-09-24T12:00:00Z', error_message: '', ...overrides,
})
const unconfirmed = outcome => {
  assert.equal(outcome.type, 'warning')
  assert.match(outcome.message, /unconfirmed/)
  assert.doesNotMatch(outcome.message, /completed|successfully/)
}

test('validated metadata retrieval reports its narrow effect and supports a genuine empty result', () => {
  for (const amount of [0, 2]) {
    const outcome = syncOutcome(log({ records_requested: amount, records_synced: amount }))
    assert.equal(outcome.type, 'success')
    assert.match(outcome.message, new RegExp(`${amount} records retrieved`))
    assert.match(outcome.message, /No RADAI records were imported/)
  }
})

test('created logs and misleading success-shaped metadata responses cannot prove completion', () => {
  for (const data of [
    undefined, null, {}, { id: 71 }, { status: 'success' },
    log({ id: null }), log({ id: {} }), log({ status: 'complete' }),
    log({ sync_details: {} }), log({ sync_details: { retrieval_validated: 'true', effect: 'metadata_retrieval' } }),
    log({ sync_details: { retrieval_validated: true, effect: 'canonical_import' } }),
    log({ error: 'SYNTHETIC-SENSITIVE-ERROR' }), log({ success: false }),
    log({ error_message: 'SYNTHETIC-SENSITIVE-ERROR' }), log({ error_message: undefined }),
    log({ records_requested: 3 }), log({ records_failed: 1 }),
  ]) unconfirmed(syncOutcome(data))
})

test('missing, invalid or coerced metadata counts never become a completed zero result', () => {
  for (const field of ['records_requested', 'records_synced', 'records_failed']) {
    for (const value of [undefined, null, '', '0', false, -1, 0.5, NaN, Infinity]) {
      unconfirmed(syncOutcome(log({ [field]: value })))
    }
  }
})

test('partial retrieval preserves counts and does not imply an import or a completed full retrieval', () => {
  const outcome = syncOutcome(log({ status: 'partial', records_requested: 4, records_synced: 2, records_failed: 1 }))
  assert.equal(outcome.type, 'warning')
  assert.match(outcome.message, /2 of 4 records retrieved; 1 reported failures/)
  assert.match(outcome.message, /Additional requested records were not retrieved/)
  assert.match(outcome.message, /No RADAI records were imported/)
  unconfirmed(syncOutcome(log({ status: 'partial', sync_details: {} })))
})

test('known failed retrieval is a failure even with a log and omits raw adapter errors', () => {
  const outcome = syncOutcome(log({ status: 'failed', error_message: 'SYNTHETIC-SENSITIVE-ERROR' }))
  assert.equal(outcome.type, 'error')
  assert.match(outcome.message, /failed.*log #71/)
  assert.doesNotMatch(outcome.message, /SENSITIVE|completed|successfully/)
})

test('pending and running retrieval remain unfinished and require a job reference', () => {
  for (const status of ['pending', 'in_progress']) {
    const outcome = syncOutcome({ id: 71, status })
    assert.equal(outcome.type, 'info')
    assert.match(outcome.message, /Completion has not been confirmed/)
    unconfirmed(syncOutcome({ status }))
  }
})

test('a terminal export with recorded counters can confirm success including legitimate zero', () => {
  for (const amount of [0, 2]) {
    const outcome = jobOutcome(job({ records_exported: amount }))
    assert.equal(outcome.type, 'success')
    assert.match(outcome.message, new RegExp(`${amount} records exported`))
  }
})

test('accepted export jobs remain pending or running rather than completed', () => {
  for (const status of ['pending', 'in_progress']) {
    const outcome = jobOutcome({ id: 72, status }, 'Library mirror')
    assert.equal(outcome.type, 'info')
    assert.match(outcome.message, /Library mirror is/)
    assert.match(outcome.message, /Completion has not been confirmed/)
    assert.doesNotMatch(outcome.message, /completed|successfully|will stay in sync/)
  }
})

test('export completion needs terminal evidence and safe known counters', () => {
  for (const data of [
    undefined, null, {}, { id: 72, status: 'success' }, job({ id: null }),
    job({ completed_at: null }), job({ completed_at: '' }), job({ completed_at: 'invalid' }),
    job({ completed_at: true }), job({ records_exported: '0' }), job({ records_exported: null }),
    job({ records_exported: -1 }), job({ records_exported: 0.5 }), job({ records_failed: '0' }),
    job({ records_failed: 1 }), job({ error: 'SYNTHETIC-SENSITIVE-ERROR' }), job({ success: false }),
    job({ error_message: 'SYNTHETIC-SENSITIVE-ERROR' }), job({ error_message: undefined }),
    job({ status: 'partial' }),
  ]) unconfirmed(jobOutcome(data))
})

test('failed exports disclose recorded partial effects without treating the job as successful', () => {
  const outcome = jobOutcome(job({ status: 'failed', records_exported: 2, records_failed: 1, error_message: 'SYNTHETIC-SENSITIVE-ERROR' }))
  assert.equal(outcome.type, 'error')
  assert.match(outcome.message, /2 records were exported before failure/)
  assert.match(outcome.message, /Reported failures: 1/)
  assert.match(outcome.message, /effects may remain/)
  assert.doesNotMatch(outcome.message, /SENSITIVE|successfully/)
})

test('stopping records a stopped outcome without claiming rollback', () => {
  const outcome = jobOutcome({ id: 72, status: 'stopped' }, 'Library mirror')
  assert.equal(outcome.type, 'info')
  assert.match(outcome.message, /Library mirror stopped/)
  assert.match(outcome.message, /does not undo completed effects/)
  unconfirmed(jobOutcome({ status: 'stopped' }))
})

test('transient read failures include selected HTTP statuses and wrapped transport errors', () => {
  for (const status of [408, 429, 500, 502, 503, 504]) {
    assert.equal(isTransientWrenchError({ response: { status } }), true)
  }
  for (const error of [
    { isNetworkError: true }, { isTimeout: true }, { code: 'ERR_NETWORK' },
    { originalError: { code: 'ECONNABORTED' } },
    { originalError: { originalError: { response: { status: 503 } } } },
  ]) assert.equal(isTransientWrenchError(error), true)
})

test('permanent authorization or request failures stop retries even under network wrappers', () => {
  for (const status of [400, 401, 403, 404, 409, 422, 424, 501]) {
    assert.equal(isTransientWrenchError({ response: { status } }), false)
    assert.equal(isTransientWrenchError({ isNetworkError: true, originalError: { response: { status } } }), false)
  }
  for (const error of [undefined, null, {}, new Error('Unknown failure'), { code: 'ERR_CANCELED', isNetworkError: true }]) {
    assert.equal(isTransientWrenchError(error), false)
  }
  const circular = { isNetworkError: true, response: { status: 403 } }
  circular.originalError = circular
  assert.equal(isTransientWrenchError(circular), false)
})

test('the read and polling budgets are finite and separate from mutation execution', () => {
  assert.equal(MAX_READ_ATTEMPTS, 2)
  assert.equal(READ_RETRY_DELAY_MS, 4000)
  assert.equal(MAX_POLL_FAILURES, 2)
})
