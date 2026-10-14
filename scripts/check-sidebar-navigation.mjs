import assert from 'node:assert/strict';
import { getActiveSidebarItem } from '../src/utils/sidebarNavigation.js';

const menu = [
  { id: 'dashboard', type: 'single', path: '/dashboard' },
  { id: 'myProfile', type: 'single', path: '/hr/Employeprofile' },
  {
    id: 'human_resource', type: 'section', children: [
      { id: 'hrDashboard', path: '/hr' },
      { id: 'hrEmployees', path: '/hr/employees' },
    ],
  },
  {
    id: 'projectControl', type: 'section', children: [
      { id: 'projectManagement', path: '/projects' },
      { id: 'planningPackage', path: '/projects?view=plan-baseline' },
      { id: 'projectCosts', path: '/projects/costs' },
    ],
  },
  {
    id: 'processEngineering', type: 'section', children: [
      { id: 'process', type: 'subsection', children: [
        { id: 'processOverview', path: '/engineering/process' },
        { id: 'pid', path: '/engineering/process/pid' },
      ] },
    ],
  },
  {
    id: 'sales', type: 'section', path: '/sales', children: [
      { id: 'salesOverview', path: '/sales' },
      { id: 'salesOpportunities', path: '/sales/opportunities' },
    ],
  },
];

const active = (pathname, search = '') => getActiveSidebarItem(menu, { pathname, search });
const none = { itemId: null, sectionId: null, subsectionId: null };

// Query-only navigation, including back/forward, must immediately change selection.
assert.equal(active('/projects', '?view=plan-baseline').itemId, 'planningPackage');
assert.equal(active('/projects', '?view=portfolio').itemId, 'projectManagement');
assert.equal(active('/projects').itemId, 'projectManagement');
assert.equal(active('/projects', '?sort=name&view=plan-baseline').itemId, 'planningPackage');
assert.equal(active('/projects', '?view=plan-baseline-old').itemId, 'projectManagement');
assert.equal(active('/projects', '?view=plan%2Dbaseline').itemId, 'planningPackage');
assert.equal(active('/projects', '?view=plan-baseline').itemId, 'planningPackage');

// A deeper destination wins over both its overview and a query-specific parent.
assert.deepEqual(active('/projects/costs/42', '?view=plan-baseline'), {
  itemId: 'projectCosts', sectionId: 'projectControl', subsectionId: null,
});
assert.deepEqual(active('/engineering/process/pid/reports/42'), {
  itemId: 'pid', sectionId: 'processEngineering', subsectionId: 'process',
});
assert.deepEqual(active('/engineering/process/other'), {
  itemId: 'processOverview', sectionId: 'processEngineering', subsectionId: 'process',
});

// Moving self-service above departments must not also select the HR dashboard.
assert.deepEqual(active('/hr/Employeprofile', '?tab=leave'), {
  itemId: 'myProfile', sectionId: null, subsectionId: null,
});
assert.deepEqual(active('/hr/employees/42'), {
  itemId: 'hrEmployees', sectionId: 'human_resource', subsectionId: null,
});
assert.deepEqual(active('/hr'), {
  itemId: 'hrDashboard', sectionId: 'human_resource', subsectionId: null,
});

// Match path segments rather than arbitrary prefixes; normalize trailing slashes.
assert.deepEqual(active('/projects-archive'), none);
assert.deepEqual(active('/hris'), none);
assert.equal(active('/projects/', '?view=plan-baseline').itemId, 'planningPackage');
assert.equal(active('/sales/').itemId, 'salesOverview');
assert.equal(active('/sales/opportunities/42').itemId, 'salesOpportunities');
assert.deepEqual(active('/sales/unlisted'), none);

// Tied duplicate paths still return one destination, consistently in menu order.
assert.deepEqual(getActiveSidebarItem([
  { id: 'first', type: 'single', path: '/dashboard' },
  { id: 'duplicate', type: 'single', path: '/dashboard' },
], { pathname: '/dashboard' }), { itemId: 'first', sectionId: null, subsectionId: null });

// Permission filtering is performed by the caller; removed leaves never reappear.
const accessibleMenu = menu.map((item) => item.id === 'projectControl'
  ? { ...item, children: item.children.filter((child) => child.id !== 'planningPackage') }
  : item);
assert.equal(getActiveSidebarItem(accessibleMenu, {
  pathname: '/projects', search: '?view=plan-baseline',
}).itemId, 'projectManagement');
assert.deepEqual(getActiveSidebarItem([], { pathname: '/projects' }), none);
assert.deepEqual(getActiveSidebarItem(undefined), none);
assert.deepEqual(getActiveSidebarItem([
  { id: 'disabled', type: 'section', enabled: false, children: [{ id: 'secret', path: '/secret' }] },
  { id: 'hidden', type: 'single', hidden: true, path: '/secret' },
  { id: 'empty', type: 'section', path: '/secret', children: [] },
  { id: 'external', type: 'single', path: 'https://example.com/secret' },
  { id: 'protocolRelative', type: 'single', path: '//example.com/secret' },
], { pathname: '/secret' }), none);

console.log('Passed: sidebar query selection, deepest destination, ancestor highlights, segment boundaries, and filtered menus.');
