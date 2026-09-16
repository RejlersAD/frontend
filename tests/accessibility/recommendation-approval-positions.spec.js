import { test, expect } from '@playwright/test'
import { recommendationFormHarness, formReference } from '../fixtures/purchase-recommendation-form.fixture'

test.setTimeout(90000)
test.use({ serviceWorkers: 'block', viewport: { width: 1672, height: 941 } })

test('Level 1 requires an explicit business position and persists the selected code', async ({ page }) => {
  const workflow = formReference().approval_workflow_config.map(stage => ({ ...stage, business_position: '' }))
  const state = await recommendationFormHarness(page, { edit: true, record: { approval_workflow_config: workflow } })
  await page.getByRole('button', { name: 'Review & submit', exact: true }).click()
  const position = page.getByRole('combobox', { name: 'Business position for Samir Ali' })
  await expect(position).toHaveValue('')
  await page.getByRole('button', { name: 'Save draft', exact: true }).first().click()
  await expect(page.getByText('Select the designated business position for every Level 1 approver.', { exact: true })).toBeVisible()
  expect(state.requests.filter(row => row.method === 'PATCH')).toEqual([])
  await position.selectOption('project_manager')
  await page.getByRole('button', { name: 'Save draft', exact: true }).first().click()
  await expect.poll(() => state.requests.filter(row => row.method === 'PATCH').length).toBeGreaterThan(0)
  expect(state.record.approval_workflow_config.find(stage => Number(stage.level) === 1).business_position).toBe('project_manager')
  await position.scrollIntoViewIfNeeded()
  await page.screenshot({ path: '../artifacts/procurement-business-position.png' })
  expect(state.unknown).toEqual([])
  expect(state.pageErrors).toEqual([])
})

test('existing draft position is preserved without catalog normalization', async ({ page }) => {
  const workflow = formReference().approval_workflow_config.map(stage => Number(stage.level) === 1 ? { ...stage, business_position: 'legacy/Position' } : stage)
  const state = await recommendationFormHarness(page, { edit: true, record: { approval_workflow_config: workflow } })
  await page.getByRole('button', { name: 'Review & submit', exact: true }).click()
  await expect(page.getByRole('combobox', { name: 'Business position for Samir Ali' })).toHaveValue('legacy/Position')
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
