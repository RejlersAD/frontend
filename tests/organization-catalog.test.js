import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeOrganizationCatalog, organizationDepartmentOptions, organizationRoleLabels, organizationDepartmentGroups } from '../src/utils/organizationCatalog.js'

const catalog = {
  source: { document_id: 'TEST-CHART', revision: 6, date: '2025-12-12' },
  departments: [
    { code: 'management', label: 'Management', head_role_code: 'ceo' },
    { code: 'operations', label: 'Operations & Project Delivery', parent_code: 'management', head_role_code: 'operations_head', functions: ['Project delivery'] },
  ],
  organizational_roles: [
    { code: 'ceo', label: 'Chief Executive Officer', department_code: 'management', holder_name: 'Synthetic Leader' },
    { code: 'operations_head', label: 'Head of Operations', department_code: 'operations', reports_to_role_code: 'ceo', holder_name: 'Synthetic Manager', acting: true, additional_titles: ['Vice President'] },
    { code: 'project_manager', label: 'Project Manager', department_code: 'operations', reports_to_role_code: 'operations_head' },
  ],
}

test('catalog options preserve existing department slugs and legacy names without modifying records', () => {
  const before = structuredClone(catalog)
  for (const value of ['operations', 'Legacy Engineering', ' engineering ']) {
    const options = organizationDepartmentOptions(catalog, value)
    assert.equal(options[0].value, value)
    assert.ok(options.some(option => option.value === 'Operations & Project Delivery'))
    assert.equal(options.filter(option => option.value === value).length, 1)
  }
  assert.equal(organizationDepartmentOptions(catalog, 'operations')[0].label, 'Operations & Project Delivery')
  assert.deepEqual(catalog, before)
  assert.deepEqual(organizationDepartmentOptions(null, 'legacy'), [{ value: 'legacy', label: 'legacy' }])
  assert.equal(organizationDepartmentOptions(catalog, 'Management').filter(option => option.value === 'Management').length, 1)
})

test('organizational role suggestions retain dual titles without generating application access roles', () => {
  assert.deepEqual(organizationRoleLabels(catalog), ['Chief Executive Officer', 'Head of Operations', 'Vice President', 'Project Manager'])
  assert.deepEqual(organizationRoleLabels(null), [])
  const payload = normalizeOrganizationCatalog({ ...catalog, roles: [{ code: 'admin' }], permissions: ['write'] })
  assert.equal('roles' in payload, false)
  assert.equal('permissions' in payload, false)
  assert.throws(() => normalizeOrganizationCatalog({ departments: [] }), /could not be loaded/)
})

test('structure resolves reporting lines and filters by incumbent, function and additional title', () => {
  const groups = organizationDepartmentGroups(catalog)
  assert.equal(groups[1].parentLabel, 'Management')
  assert.equal(groups[1].headLabel, 'Head of Operations')
  assert.equal(groups[1].roles[0].reportsToLabel, 'Chief Executive Officer')
  assert.equal(groups[1].roles[0].acting, true)
  for (const query of ['synthetic manager', 'VICE PRESIDENT', 'project delivery']) {
    assert.deepEqual(organizationDepartmentGroups(catalog, query).map(group => group.code), ['operations'])
  }
  assert.deepEqual(organizationDepartmentGroups(catalog, 'absent'), [])
  assert.deepEqual(organizationDepartmentGroups(null), [])
})
