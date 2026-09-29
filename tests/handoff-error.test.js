import test from 'node:test';
import assert from 'node:assert/strict';
import { handoffError } from '../src/components/Procurement/handoffError.js';

const problem = (data, status = 400, headers = {}) => ({ response: { data, status, headers }, message: 'Request failed with status code ' + status });
const fallback = 'The request could not be completed. Please try again.';
const serverFailure = 'The server could not complete the request. Please try again.';

test('server responses never expose HTML, diagnostic JSON or plaintext exceptions', () => {
  for (const data of ['<!DOCTYPE html><html>private diagnostic</html>', { detail: 'private diagnostic' }, 'TypeError: private diagnostic']) {
    assert.equal(handoffError(problem(data, 500)), serverFailure);
  }
});

test('invalid error statuses still cannot display HTML, encoded markup or tracebacks', () => {
  for (const data of ['<html>private diagnostic</html>', { detail: '<!DOCTYPE html>private diagnostic' }, '&lt;html&gt;private diagnostic', 'Traceback (most recent call last): private diagnostic', 'Exception Type: TypeError', 'File "private.py", line 123', 'at handler (private.js:12:34)']) {
    assert.equal(handoffError(problem(data)), fallback);
  }
  assert.equal(handoffError(problem('private diagnostic', 400, { 'content-type': 'text/html' })), fallback);
});

test('concise field validation and local receipt recovery messages remain actionable', () => {
  assert.equal(handoffError(problem({ delivery_location: ['Enter the delivery location.'], items_received: [{ received_qty: ['Enter a positive quantity.'] }] })), 'Enter the delivery location. Enter a positive quantity.');
  assert.equal(handoffError(problem({ non_field_errors: ['Review the source.\nTry again.'] }, 422)), 'Review the source. Try again.');
  const message = 'The receiving basis response could not be verified. Refresh receipt balances.';
  assert.equal(handoffError(new Error(message)), message);
});

test('denied and stale errors retain their existing guarded recovery messages', () => {
  assert.equal(handoffError(problem('<html>debug</html>', 403)), 'You do not have access to these purchase orders.');
  assert.equal(handoffError(problem('<html>debug</html>', 409)), 'This record changed. Refresh its details before trying again.');
});

test('diagnostic keys are omitted and ordinary detail takes priority over extra payloads', () => {
  assert.equal(handoffError(problem({ traceback: 'private stack', settings: 'private setting', quantity: ['Enter a positive quantity.'] })), 'Enter a positive quantity.');
  assert.equal(handoffError(problem({ detail: 'Choose a purchase order.', arbitrary: 'private extra data' })), 'Choose a purchase order.');
});

test('unbounded responses and cycles cannot create unbounded UI text or recursion', () => {
  assert.equal(handoffError(problem('x'.repeat(10000))), fallback);
  assert.equal(handoffError(new Error('x'.repeat(10000))), fallback);
  const cyclic = {}; cyclic.child = cyclic;
  assert.equal(handoffError(problem(cyclic)), fallback);
  let deep = 'Do not expose a deeply nested diagnostic.';
  for (let index = 0; index < 100; index += 1) deep = { child: deep };
  assert.equal(handoffError(problem(deep)), fallback);
  const many = Array(10000).fill('Review this field.');
  assert.equal(handoffError(problem(many)), 'Review this field. Review this field. Review this field.');
  assert.ok(handoffError(problem(Array(8).fill('x'.repeat(180)))).length <= 300);
});

test('missing and unsupported payloads use a concise fallback', () => {
  for (const data of [null, 12, false, {}, ['']]) assert.equal(handoffError(problem(data)), fallback);
  assert.equal(handoffError(), fallback);
  assert.equal(handoffError(new Error('TypeError: private diagnostic')), fallback);
});
