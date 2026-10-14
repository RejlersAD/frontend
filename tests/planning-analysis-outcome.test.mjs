import assert from 'node:assert/strict'
import test from 'node:test'
import { aiAnalysisOutcome, planningAnalysisOutcome } from '../src/utils/planningAnalysisOutcome.js'

const failed = errors => ({ status: 'partial', chunks_total: 2, chunks_processed: 0, chunks_failed: 2,
  chunks_skipped: 0, chunks_remaining: 0, chunks: errors.map(error => ({ status: 'failed', error })) })

for (const code of ['provider_timeout', 'provider_unavailable', 'rate_limited', 'empty_response']) {
  test(`${code} retains failed evidence and recommends analysis retry without diagnosing the key`, () => {
    const coverage = failed([{ code, message: 'The saved provider attempt did not return usable analysis.', next_action: 'retry_analysis' }])
    const outcome = aiAnalysisOutcome(coverage)
    assert.equal(outcome.status, 'failed')
    assert.equal(outcome.recoveryAction, 'retry_analysis')
    const notice = planningAnalysisOutcome({ ai_processing_coverage: coverage })
    assert.equal(notice.type, 'warning')
    assert.match(notice.message, /Retry document analysis/)
    assert.doesNotMatch(notice.message, /settings|key|authentication/i)
    assert.equal(coverage.chunks_failed, 2)
  })
}

test('an explicit authentication diagnostic takes priority when chunk failure causes differ', () => {
  const coverage = failed([
    { code: 'provider_timeout', message: 'Request timed out.', next_action: 'retry_analysis' },
    { code: 'authentication_failed', message: 'Provider authentication failed.', next_action: 'ai_settings' },
  ])
  const outcome = aiAnalysisOutcome(coverage)
  assert.equal(outcome.diagnostic.code, 'authentication_failed')
  assert.equal(outcome.recoveryAction, 'ai_settings')
  assert.match(planningAnalysisOutcome({ ai_processing_coverage: coverage }).message, /Review AI settings/)
})

test('historical missing diagnostics never invent a credential failure or completed analysis', () => {
  const outcome = aiAnalysisOutcome(failed([]))
  assert.equal(outcome.status, 'failed')
  assert.equal(outcome.diagnostic, undefined)
  assert.match(outcome.recoveryMessage, /does not identify a connection problem/)
  assert.equal(planningAnalysisOutcome({ ai_processing_coverage: failed([]) }).type, 'warning')
})

test('output-limited analysis recommends smaller source sections without claiming recovery already succeeded', () => {
  const coverage = failed([{ code: 'output_limit', message: 'The response exceeded the provider output limit.', next_action: 'retry_analysis' }])
  const outcome = aiAnalysisOutcome(coverage)
  assert.equal(outcome.status, 'failed')
  assert.equal(outcome.recoveryAction, 'retry_analysis')
  assert.match(outcome.recoveryMessage, /failed or remaining source sections in smaller parts/)
  const notice = planningAnalysisOutcome({ ai_processing_coverage: coverage })
  assert.equal(notice.type, 'warning')
  assert.doesNotMatch(notice.message, /settings|key|completed|succeeded/i)
  assert.equal(coverage.chunks_processed, 0)
})

test('partial coverage retains retry guidance even when the saved aggregate status says complete', () => {
  const coverage = { ...failed([{ code: 'empty_response', message: 'No usable analysis returned.', next_action: 'retry_analysis' }]),
    status: 'complete', chunks_processed: 1, chunks_failed: 1 }
  assert.equal(aiAnalysisOutcome(coverage).status, 'partial')
  assert.equal(planningAnalysisOutcome({ ai_processing_coverage: coverage }).type, 'warning')
})

test('insufficient credits explains the account action and preserves partial progress', () => {
  const coverage = {
    status: 'partial', chunks_total: 61, chunks_processed: 44, chunks_failed: 1,
    chunks_skipped: 16, chunks_remaining: 17,
    chunks: [{ status: 'failed', error: {
      code: 'credit_balance_exhausted', message: 'The provider reported insufficient API credits.',
      next_action: 'ai_settings',
    } }],
  }
  const outcome = aiAnalysisOutcome(coverage)
  assert.equal(outcome.status, 'partial')
  assert.equal(outcome.recoveryAction, 'ai_settings')
  const notice = planningAnalysisOutcome({ ai_processing_coverage: coverage })
  assert.equal(notice.type, 'warning')
  assert.match(notice.message, /Restore the API account credit balance/)
  assert.match(notice.message, /Completed sections are retained/)
  assert.doesNotMatch(notice.message, /test the connection|invalid key|analysis completed/i)
  assert.equal(coverage.chunks_processed, 44)
})
