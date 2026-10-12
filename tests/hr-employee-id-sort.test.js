import test from 'node:test';
import assert from 'node:assert/strict';
import { HR_TABLE_COLUMNS, sortEmployeesById } from '../src/config/hrEmployees.config.js';

test('only Employee ID opts into table header sorting', () => {
  assert.deepEqual(HR_TABLE_COLUMNS.filter(column => column.sortable).map(column => column.id), ['employee_id']);
});

test('Employee IDs sort naturally in both directions without changing source records', () => {
  const employees = ['EMP10', 'EMP2', 'EMP1'].map(employee_id => ({ employee_id }));
  const original = [...employees];
  assert.deepEqual(sortEmployeesById(employees, 'ascending').map(row => row.employee_id), ['EMP1', 'EMP2', 'EMP10']);
  assert.deepEqual(sortEmployeesById(employees, 'descending').map(row => row.employee_id), ['EMP10', 'EMP2', 'EMP1']);
  assert.deepEqual(employees, original);
  assert.equal(sortEmployeesById(employees, 'ascending')[0], employees[2]);
});

test('numeric IDs and leading zeros compare numerically', () => {
  const employees = [100, '002', '10', 0].map(employee_id => ({ employee_id }));
  assert.deepEqual(sortEmployeesById(employees, 'ascending').map(row => row.employee_id), [0, '002', '10', 100]);
});

test('missing IDs remain last and equal IDs retain their original order', () => {
  const employees = [
    { id: 'missing', employee_id: null }, { id: 'first', employee_id: ' emp2 ' },
    { id: 'blank', employee_id: ' ' }, { id: 'second', employee_id: 'EMP2' },
    { id: 'next', employee_id: 'EMP10' }, { id: 'undefined' },
  ];
  for (const direction of ['ascending', 'descending']) {
    const sorted = sortEmployeesById(employees, direction);
    assert.deepEqual(sorted.slice(-3).map(row => row.id), ['missing', 'blank', 'undefined']);
    assert.deepEqual(sorted.filter(row => ['first', 'second'].includes(row.id)).map(row => row.id), ['first', 'second']);
  }
});

test('sorting the full filtered list before pagination produces globally ordered pages', () => {
  const employees = ['EMP20', 'EMP3', 'EMP10', 'EMP2'].map(employee_id => ({ employee_id }));
  const sorted = sortEmployeesById(employees, 'ascending');
  assert.deepEqual(sorted.slice(0, 2).map(row => row.employee_id), ['EMP2', 'EMP3']);
  assert.deepEqual(sorted.slice(2, 4).map(row => row.employee_id), ['EMP10', 'EMP20']);
  assert.throws(() => sortEmployeesById(employees, 'invalid'), RangeError);
});
