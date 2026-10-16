import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveLevelZeroApprover } from '../src/pages/Procurement/recommendationApprovalDefaults.js';

test('canonical active Richa email wins before a name alias or another procurement employee', () => {
  const emailMatch = { id: 19, full_name: 'Recorded account name', email: ' RICHA@REJLERS.AE ', is_active: true };
  const nameMatch = { id: 9, full_name: 'Richa Thomas', email: 'other@example.test', is_active: true };
  const anotherEmployee = { id: 12, full_name: 'Procurement Reviewer', job_title: 'Procurement Manager', is_active: true };
  assert.equal(resolveLevelZeroApprover([anotherEmployee, nameMatch, emailMatch]), emailMatch);
});

test('the shared exact Richa name aliases resolve from actual employee names', () => {
  for (const full_name of ['Richa', 'Richa Thomas', ' Richa  Hannah Thomas ']) {
    const employee = Object.freeze({ id: 9, full_name, is_active: true });
    assert.equal(resolveLevelZeroApprover(Object.freeze([employee])), employee);
  }
  const employee = { id: 9, first_name: 'Richa', last_name: 'Hannah Thomas' };
  assert.equal(resolveLevelZeroApprover([employee]), employee);
});

test('inactive or unbound Richa entries and unrelated procurement employees leave the default unresolved', () => {
  assert.equal(resolveLevelZeroApprover([
    { id: 9, full_name: 'Richa Hannah Thomas', email: 'richa@rejlers.ae', is_active: false },
    { full_name: 'Richa Thomas', email: 'richa@rejlers.ae', is_active: true },
    { id: 12, full_name: 'Other Procurement Manager', is_active: true },
    { id: 13, full_name: 'Richa Patel', is_active: true },
    { id: 14, username: 'richa', email: 'richa@example.test', is_active: true },
  ]), null);
  assert.equal(resolveLevelZeroApprover(null), null);
});

test('an inactive canonical email cannot override an active exact-name match', () => {
  const active = { id: 9, full_name: 'Richa Thomas', is_active: true };
  assert.equal(resolveLevelZeroApprover([
    { id: 19, email: 'richa@rejlers.ae', is_active: false }, active,
  ]), active);
});
