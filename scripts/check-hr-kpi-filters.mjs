import assert from 'node:assert/strict';
import { HR_KPIS } from '../src/config/hrEmployees.config.js';

const today = new Date().toISOString();
const soon = new Date(Date.now() + 20 * 86400000).toISOString();
const later = new Date(Date.now() + 90 * 86400000).toISOString();
const employees = [
  { id: 1, status: 'active', join_date: today, created_at: today, department: 'Process', is_mfa_enabled: true, contract_end_date: soon },
  { id: 2, status: 'pending', created_at: '2000-01-01', department: 'Process', metadata: { notice_period_start: today } },
  { id: 3, status: 'inactive', resignation_date: today, contract_end_date: later, created_at: '2020-01-01' },
  { id: 4, status: 'inactive', employment_status: 'on_notice', department: 'Unclassified', created_at: '2020-01-01' },
];
const expected = {
  headcount: [1, 2, 3, 4], active: [1], new_joiners_month: [1],
  notice_period: [2, 4], resigned_month: [3], contract_expiring: [1],
  pending_onboarding: [2], new_joiners_30d: [1], departments: [1, 2, 4],
  disciplines: [1, 2], mfa_adoption: [1], long_tenure: [2],
};
for (const kpi of HR_KPIS) {
  assert.deepEqual(employees.filter(kpi.match).map(e => e.id), expected[kpi.id], kpi.id);
  if (!['departments', 'disciplines', 'mfa_adoption'].includes(kpi.id)) {
    assert.equal(kpi.compute(employees), expected[kpi.id].length, `${kpi.id} count`);
  }
  assert.equal(kpi.compute([]), kpi.id === 'mfa_adoption' ? '0%' : 0);
}
assert.equal(HR_KPIS.find(k => k.id === 'departments').compute(employees), 2);
assert.equal(HR_KPIS.find(k => k.id === 'disciplines').compute(employees), 1);
assert.equal(HR_KPIS.find(k => k.id === 'mfa_adoption').compute(employees), '25%');
const active = HR_KPIS.find(k => k.id === 'active');
assert.deepEqual(employees.filter(e => active.match(e) && e.department === 'Process').map(e => e.id), [1]);
assert.deepEqual(employees.filter(e => active.match(e) && e.department === 'Unclassified'), []);
console.log('All 12 KPI filters, counts, empty results and combined filtering passed.');
