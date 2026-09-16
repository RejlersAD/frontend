import { test, expect } from '@playwright/test'
import { recommendationFormHarness, formReference } from '../fixtures/purchase-recommendation-form.fixture'

test.setTimeout(90000)
test.use({ serviceWorkers: 'block', viewport: { width: 1672, height: 941 } })

test('Level 1 saves selected employees without a business position', async ({ page }) => {
  const workflow = formReference().approval_workflow_config.map(stage => ({ ...stage, business_position: '' }))
  const state = await recommendationFormHarness(page, { edit: true, record: { approval_workflow_config: workflow } })
  await page.getByRole('button', { name: 'Review & submit', exact: true }).click()
  await expect(page.getByRole('combobox', { name: /Business position for/ })).toHaveCount(0)
  await page.getByRole('button', { name: 'Save draft', exact: true }).first().click()
  await expect.poll(() => state.requests.filter(row => row.method === 'PATCH').length).toBeGreaterThan(0)
  const levelOne = state.record.approval_workflow_config.find(stage => Number(stage.level) === 1)
  expect(String(levelOne.user_id)).toBe('8')
  expect(levelOne).not.toHaveProperty('business_position')
  expect(state.unknown).toEqual([])
  expect(state.pageErrors).toEqual([])
})

test('existing draft no longer asks for a saved Level 1 position', async ({ page }) => {
  const workflow = formReference().approval_workflow_config.map(stage => Number(stage.level) === 1 ? { ...stage, business_position: 'legacy/Position' } : stage)
  const state = await recommendationFormHarness(page, { edit: true, record: { approval_workflow_config: workflow } })
  await page.getByRole('button', { name: 'Review & submit', exact: true }).click()
  await expect(page.getByRole('combobox', { name: /Business position for/ })).toHaveCount(0)
  await page.getByRole('button', { name: 'Save draft', exact: true }).first().click()
  await expect.poll(() => state.requests.filter(row => row.method === 'PATCH').length).toBeGreaterThan(0)
  expect(state.record.approval_workflow_config.find(stage => Number(stage.level) === 1)).not.toHaveProperty('business_position')
  expect(state.unknown).toEqual([])
  expect(state.pageErrors).toEqual([])
})

test('any active employee can join multiple Level 1 approvers without the organization catalog', async ({ page }) => {
  const developer = { id: 12, full_name: 'Layla Hassan', first_name: 'Layla', last_name: 'Hassan', email: 'layla@example.test', job_title: 'Software Developer', is_active: true }
  const state = await recommendationFormHarness(page, {
    edit: true,
    catalogUnavailable: true,
    additionalEmployees: [developer],
    record: { vendor_selection_reason: '', management_approval: true, management_approval_remarks: 'Approved for the fixture.', management_approval_evidence: [{ filename: 'approval.pdf' }] },
  })
  await page.getByRole('button', { name: 'Review & submit', exact: true }).click()
  await expect(page.getByRole('combobox', { name: /Business position for/ })).toHaveCount(0)
  await expect(page.getByText('Organization structure is unavailable. Please retry.')).toHaveCount(0)
  expect(state.approverRoles).toContain('any_active')
  await page.getByRole('spinbutton', { name: 'Level 1 required', exact: true }).fill('2')
  await page.getByRole('button', { name: 'Submit for approval', exact: true }).click()
  expect(state.submissions).toEqual([])
  await expect(page.getByRole('paragraph').filter({ hasText: 'Complete the required approval levels before submitting.' })).toBeVisible()
  await page.getByRole('textbox', { name: 'Add Level 1 approver', exact: true }).fill('layla@example.test')
  await page.getByRole('button', { name: 'Layla Hassan Software Developer', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Add Level 1 approver', exact: true })).toBeDisabled()
  await page.getByRole('textbox', { name: 'Approval table level for Layla Hassan', exact: true }).scrollIntoViewIfNeeded()
  await page.screenshot({ path: '../artifacts/procurement-level-one-any-employee.png' })
  await page.getByRole('button', { name: 'Submit for approval', exact: true }).click()
  await expect.poll(() => state.submissions.length).toBe(1)
  expect(state.submissions[0].vendor_selection_reason).toBe('')
  const levelOne = state.submissions[0].approval_workflow_config.filter(stage => Number(stage.level) === 1)
  expect(levelOne.map(stage => String(stage.user_id))).toEqual(['8', '12'])
  for (const stage of levelOne) {
    expect(stage).toMatchObject({ role: 'Level 1 Approver', approval_group: 'level_1', group_mode: 'all' })
    expect(stage).not.toHaveProperty('business_position')
  }
  expect(state.requests.filter(row => row.path.endsWith('/organization-catalog/'))).toEqual([])
  expect(state.unknown).toEqual([])
  expect(state.pageErrors).toEqual([])
})

test('general Vice President stage requires an explicit saved business position', async ({ page }) => {
  const workflow = formReference().approval_workflow_config.filter(stage => Number(stage.level) !== 3)
    .map(stage => Number(stage.level) === 4 ? { ...stage, level: 2, role: 'Vice President', stage: 'Level 2 - Vice President', business_position: '' } : stage)
  const state = await recommendationFormHarness(page, { edit: true, record: { requisition_type: 'general', approval_workflow_config: workflow } })
  await page.getByRole('button', { name: 'Review & submit', exact: true }).click()
  const position = page.getByRole('combobox', { name: 'Business position for Vice President stage' })
  await expect(position).toHaveValue('')
  await page.getByRole('button', { name: 'Save draft', exact: true }).first().click()
  await expect(page.getByText('Select the designated business position for the Vice President approval stage.', { exact: true })).toBeVisible()
  expect(state.requests.filter(row => row.method === 'PATCH')).toEqual([])
  await position.selectOption('cfo')
  await page.getByRole('button', { name: 'Save draft', exact: true }).first().click()
  await expect.poll(() => state.record.approval_workflow_config.find(stage => stage.role === 'Vice President').business_position).toBe('cfo')
  expect(state.unknown).toEqual([])
  expect(state.pageErrors).toEqual([])
})

test('submitted workflow positions are immutable during unrelated edits', async ({ page }) => {
  const state = await recommendationFormHarness(page, { edit: true, record: { status: 'submitted' } })
  await page.getByRole('textbox', { name: 'Product / service', exact: true }).fill('Updated description')
  await page.getByRole('navigation', { name: 'Recommendation steps' }).getByRole('button', { name: /Approval & submit/ }).click()
  await expect(page.getByRole('combobox', { name: /Business position for/ })).toHaveCount(0)
  await page.getByRole('button', { name: 'Save changes', exact: true }).first().click()
  await expect.poll(() => state.requests.filter(row => row.method === 'PATCH').length).toBeGreaterThan(0)
  const saves = state.requests.filter(row => row.method === 'PATCH' && row.path.includes('/requisitions/'))
  for (const save of saves) expect(save.body).not.toHaveProperty('approval_workflow_config')
  expect(state.pageErrors).toEqual([])
})
