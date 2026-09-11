import assert from 'node:assert/strict';
import { canAccessRouteModule, resolveQhseApiPrefix, viewableModuleCodes } from '../src/config/serviceAccess.config.js';

const profile = { user: { is_superuser: true }, modules: [{ code: 'pid_analysis' }, { code: 'finance_incoming' }],
  module_actions: { pid_analysis: ['create'], finance_incoming: ['read', 'export'] } };
assert.deepEqual(viewableModuleCodes(profile), ['finance_incoming']);
assert.deepEqual(viewableModuleCodes({ modules: profile.modules }), []);
assert.equal(canAccessRouteModule(['project_control'], 'planning_package'), false);
assert.equal(canAccessRouteModule(['planning_package'], 'planning_package'), true);
for (const area of ['detailed', 'quality', 'health-safety', 'environmental', 'energy']) {
  assert.equal(resolveQhseApiPrefix(`/qhse/general/${area}`), `/qhse/areas/${area}`);
}
assert.equal(resolveQhseApiPrefix('/qhse/general'), '/qhse');
assert.equal(resolveQhseApiPrefix('/engineering/process/quality'), '/qhse');
console.log('Passed: View denial applies to admins, missing policy fails closed, child grants stay separate, QHSE areas select their guarded APIs.');
