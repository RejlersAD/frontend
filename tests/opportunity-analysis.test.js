import test from 'node:test';
import assert from 'node:assert/strict';
import { analysisDeadline, analysisFailureMessage, analysisMarkdown, analysisSectionMessage, analysisSourceError, validateAnalysis } from '../src/pages/Sales/salesOpportunityAnalysis.js';

test('a response for another opportunity is rejected', () => {
  assert.throws(() => validateAnalysis({ opportunity_id: 'other', status: 'ready' }, 'current'));
  assert.equal(validateAnalysis({ opportunity_id: 'current', status: 'partial' }, 'current').status, 'partial');
});

test('deadline urgency uses the Dubai calendar day without promoting past evidence', () => {
  const now = new Date('2026-10-15T22:00:00Z');
  assert.equal(analysisDeadline('2026-10-16', now), 'Today');
  assert.equal(analysisDeadline('2026-10-17', now), 'In 1 day');
  assert.match(analysisDeadline('2026-10-15', now), /Past date/);
  assert.equal(analysisDeadline('', now), 'Date needs review');
});

test('the downloaded brief includes citations, gaps and review status', () => {
  const markdown = analysisMarkdown({ deal_code: 'Q-TEST', deal_name: 'Inspection' }, {
    status: 'partial', counts: { total: 500, ready: 499, partial: 1 }, coverage_note: 'One scan needs OCR.',
    result: { review_note: 'Human review required.', sections: { submission: [
      { text: 'Submit inspection plan.', name: 'scope.pdf', location: 'Page 9', excerpt: 'Inspection plan is mandatory.' },
    ] } },
  });
  assert.match(markdown, /499/);
  assert.match(markdown, /One scan needs OCR/);
  assert.match(markdown, /Human review required/);
  assert.match(markdown, /scope.pdf, Page 9/);
  assert.match(markdown, /Inspection plan is mandatory/);
});

test('failed analysis does not present absent findings as an empty opportunity', () => {
  const failed = { status: 'failed', error_code: 'no_verified_source_results',
    counts: { total: 3, ready: 0, partial: 3, chunks_failed: 3 },
    result: { sections: { brief: [], risk: [] } } };
  assert.match(analysisFailureMessage(failed), /3 text sections failed AI analysis/);
  assert.match(analysisSourceError('invalid_evidence'), /could not be verified/);
  assert.match(analysisSourceError('provider_or_evidence_failed'), /exact cause was not recorded/);
  assert.match(analysisSourceError('provider_rate_limit'), /Retry later/);
  assert.match(analysisSectionMessage('submission', failed), /incomplete/);
  const markdown = analysisMarkdown({ deal_code: 'Q-TEST' }, failed);
  assert.doesNotMatch(markdown, /Not established from the analyzed sources/);
  assert.match(markdown, /No findings were verified/);
});
