import test from 'node:test';
import assert from 'node:assert/strict';
import { requestError, validateExecutiveReport } from '../src/pages/Executive/executivePresentation.js';

const report = { schema_version: '1.0', kpis: [], departments: [], actions: [], scope: {}, portfolio: {}, generated_at: '2026-10-23T00:00:00Z' };

test('older report without access metadata stays hidden and explains the server update', () => {
  let failure;
  try { validateExecutiveReport(report); } catch (error) { failure = error; }
  assert.equal(failure?.code, 'EXECUTIVE_ACCESS_UPDATE_REQUIRED');
  assert.equal(requestError(failure).title, 'Executive update required');
});

test('server supplied tab decisions including no permitted tabs are preserved', () => {
  for (const allowed_tabs of [[], ['overview'], ['financial', 'portfolio']]) {
    const authorized = { ...report, allowed_tabs };
    assert.equal(validateExecutiveReport(authorized), authorized);
  }
});

test('malformed reports, denied access and request failures keep distinct error states', () => {
  assert.throws(() => validateExecutiveReport({ allowed_tabs: ['overview'] }));
  assert.equal(requestError({ response: { status: 403 } }).title, 'Executive access required');
  assert.equal(requestError({ response: { status: 401 } }).title, 'Please sign in again');
  assert.equal(requestError(new Error('Network unavailable')).title, 'Overview could not be loaded');
});
