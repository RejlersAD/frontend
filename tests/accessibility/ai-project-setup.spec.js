import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { scheduleHarness } from '../fixtures/schedule-performance.fixture'

test.setTimeout(60000)
const endpoint = '/api/v1/planning-intelligence/project-setup/'
const setupOptions = {
  project_types: [{ value: 'engineering', label: 'Engineering' }, { value: 'software', label: 'Software / IT' }, { value: 'internal', label: 'Internal project' }, { value: 'business', label: 'Business / Department' }],
  employees: [{ user_id: 7, name: 'Maya Hassan', department: 'Management', email: 'maya@example.test' }, { user_id: 8, name: 'Omar Saleh', department: 'IT', email: 'omar@example.test' }],
  ai_available: true,
  ai_settings: { provider: 'openai', model: 'gpt-4o', key_configured: false, last_tested_at: null, storage_available: true },
}
const makePlan = brief => ({
  project: { ...brief, scope_summary: brief.description, exclusions: 'New modules require approval.', planning_mode: 'manual' },
  tasks: [
    { id: 'scope-1', discipline: 'delivery', title: 'Confirm release scope', effort_hours: 12, duration_days: 2, planned_start_date: '2026-09-21', due_date: '2026-09-22', depends_on: [], acceptance_criteria: 'Approved release inventory.', assignee_id: 8, reviewer_id: 7, task_type: 'deliverable', priority: 'medium' },
    { id: 'release-1', discipline: 'delivery', title: 'Test release candidate', effort_hours: 24, duration_days: 3, planned_start_date: '2026-09-23', due_date: '2026-09-25', depends_on: ['scope-1'], acceptance_criteria: 'All mandatory tests pass.', assignee_id: 8, reviewer_id: 7, task_type: 'deliverable', priority: 'high' },
  ],
  disciplines: [{ code: 'delivery', name: 'Delivery' }], milestones: [{ name: 'Phase 1 launch', target_date: '2026-12-20' }],
  assumptions: ['One delivery employee is available.'], risks: ['Additional defects may require more effort.'],
  warnings: ['Review calendar exceptions and employee capacity.'], source: brief.generation_mode,
})

async function setup(page, options = {}) {
  const requests = [], errors = [], consoleMessages = []
  const control = { optionsStatus: 200, previewStatus: 200, createStatus: 201, byokStatus: 200, ...options }
  const connection = { ai_available: options.options?.ai_available ?? true, ai_message: options.options?.ai_message || '', ai_settings: { ...setupOptions.ai_settings, ...options.options?.ai_settings } }
  const serverAvailable = connection.ai_available && !connection.ai_settings.key_configured
  page.on('console', message => consoleMessages.push(message.text()))
  page.on('pageerror', error => errors.push(error.message))
  const planning = options.surface === 'planning'
  const query = planning ? 'project=17&view=plan-baseline&scheduleMode=planner&shell=true' : 'project=17&shell=true'
  const state = await scheduleHarness(page, { query, handleRequest: async ({ route, path, reply, state }) => {
    if (!path.startsWith(endpoint)) return false
    const body = route.request().method() === 'POST' ? route.request().postDataJSON() : null
    requests.push({ path, method: route.request().method(), body })
    if (path.endsWith('/options/')) await reply(route, control.optionsStatus === 200 ? { ...setupOptions, ...(control.options || {}), ...connection } : { detail: 'Employee directory temporarily unavailable.' }, control.optionsStatus)
    if (path.endsWith('/ai-settings/')) {
      if (route.request().method() === 'POST') {
        if (control.byokStatus !== 200) {
          await reply(route, { detail: 'OpenAI rejected this API key. Check the key and try again.' }, control.byokStatus)
          return true
        }
        Object.assign(connection, { ai_available: true, ai_message: '', ai_settings: { ...connection.ai_settings, model: body.model, key_configured: true, last_tested_at: '2026-09-18T10:00:00Z' } })
      }
      if (route.request().method() === 'DELETE') Object.assign(connection, { ai_available: serverAvailable, ai_message: serverAvailable ? '' : 'The server AI key is not configured.', ai_settings: { ...setupOptions.ai_settings } })
      await reply(route, connection)
    }
    if (path.endsWith('/preview/')) await reply(route, control.previewStatus === 200 ? { preview_token: 'signed-preview-test-only', plan: makePlan(body) } : { detail: 'AI provider unavailable. Retry or select the standard template.' }, control.previewStatus)
    if (path.endsWith('/create/')) {
      if (control.createStatus === 201) {
        Object.assign(state.records[17].project, { name: body.plan.project.name, code: body.plan.project.code })
        await reply(route, { enterprise_project: state.records[17].project, planning_project: state.records[17].planningProject, schedule_id: 81, schedule_version_id: 91 }, 201)
      } else await reply(route, { detail: 'The task dependencies contain a cycle. Review the selected predecessors.' }, control.createStatus)
    }
    return true
  } })
  await expect(page.getByRole('heading', { name: planning ? 'Project Planning' : 'Project Performance', exact: true })).toBeVisible()
  if (options.entry === 'legacy') {
    await page.locator('summary').filter({ hasText: 'More project actions' }).click()
    await page.getByRole('button', { name: 'New project', exact: true }).click()
    await page.getByRole('button', { name: 'Create with AI', exact: true }).click()
  } else {
    const action = page.locator('header.pp-header').getByRole('button', { name: 'Create project with AI', exact: true })
    await expect(action).toBeVisible()
    await expect(action).toBeInViewport()
    if (options.screenshot) await page.screenshot({ path: options.screenshot, animations: 'disabled' })
    await action.click()
  }
  const dialog = page.getByRole('dialog', { name: 'Create a project with AI', exact: true })
  await expect(dialog).toBeVisible()
  return { state, requests, errors, consoleMessages, control, dialog }
}

async function fillBrief(dialog) {
  await dialog.getByLabel('What do you want to achieve?').fill('Launch the currently developed software modules after testing and fixes.')
  await dialog.getByLabel('Project name', { exact: false }).fill('Internal Software Launch')
  await dialog.getByLabel('Project code', { exact: false }).fill('TEST-SW-2026')
  await dialog.getByLabel('Project type').selectOption('software')
  await dialog.getByLabel('Department', { exact: true }).fill('IT')
  await dialog.getByLabel('Project start date').fill('2026-09-21')
  await dialog.getByLabel('Project end date').fill('2026-12-20')
  await dialog.getByLabel('Project manager').selectOption('7')
  await dialog.getByRole('textbox', { name: 'Search team members' }).fill('omar@example.test')
  await dialog.getByRole('checkbox', { name: /Omar Saleh/ }).check()
}
const previewDialog = page => page.getByRole('dialog', { name: 'Review your project plan', exact: true })

for (const surface of ['overview', 'planning']) {
  test(`${surface} header opens AI project setup directly without creating any records`, async ({ page }) => {
    const { dialog, requests, errors } = await setup(page, {
      surface, screenshot: `../artifacts/ai-project-setup-${surface}-entry.png`,
    })
    await expect(dialog.getByLabel('Project name')).toHaveValue('')
    await expect(dialog.getByLabel('Project code')).toHaveValue('')
    await expect(dialog.getByRole('button', { name: 'Generate plan preview' })).toBeVisible()
    expect(requests.filter(item => item.method === 'POST')).toEqual([])
    expect(errors).toEqual([])
  })
}

test('existing New project dialog still provides AI project setup', async ({ page }) => {
  const { dialog, requests, errors } = await setup(page, { entry: 'legacy' })
  await expect(dialog.getByRole('button', { name: 'Generate plan preview' })).toBeVisible()
  expect(requests.filter(item => item.method === 'POST')).toEqual([])
  expect(errors).toEqual([])
})

test('preview needs no uploads, uses employee identities and makes no project writes until create', async ({ page }) => {
  const { dialog, requests, errors } = await setup(page)
  await fillBrief(dialog)
  await dialog.getByRole('button', { name: 'Generate plan preview', exact: true }).click()
  const review = previewDialog(page)
  await expect(review).toBeVisible()
  await expect(review.getByText('AI draft · review required')).toBeVisible()
  await expect(review.getByLabel('Task 1 start date')).toHaveValue('2026-09-21')
  await expect(review.getByLabel('Task 1 assigned to')).toHaveValue('8')
  const generated = requests.find(item => item.path.endsWith('/preview/'))
  expect(generated.body).toMatchObject({ project_type: 'software', department: 'IT', project_manager_id: 7, team_member_ids: [8], generation_mode: 'ai' })
  expect(requests.filter(item => item.path.endsWith('/create/'))).toEqual([])
  await review.getByLabel('Task 1 / deliverable').fill('Approve developed module inventory')
  await review.getByLabel('Task 1 effort (hours)').fill('16')
  await review.getByRole('button', { name: 'Create project & plan', exact: true }).click()
  await expect(review).toHaveCount(0)
  await expect(page).toHaveURL(/view=plan-baseline&scheduleMode=planner/)
  const writes = requests.filter(item => item.path.endsWith('/create/'))
  expect(writes).toHaveLength(1)
  expect(writes[0].body.preview_token).toBe('signed-preview-test-only')
  expect(writes[0].body.plan.tasks[0]).toMatchObject({ title: 'Approve developed module inventory', effort_hours: 16, assignee_id: 8, reviewer_id: 7 })
  expect(errors).toEqual([])
})

test('unavailable AI offers an explicitly labeled template with no silent fallback', async ({ page }) => {
  const { dialog, requests, errors } = await setup(page, { options: { ai_available: false, ai_message: 'AI is not configured. Use the standard template or contact your administrator.' } })
  await expect(dialog.getByRole('button', { name: 'Generate plan preview' })).toBeDisabled()
  await expect(dialog.getByRole('status')).toContainText('AI is not configured')
  await fillBrief(dialog)
  await dialog.getByRole('button', { name: 'Use standard template' }).click()
  await expect(previewDialog(page).getByText('Standard template · not AI generated')).toBeVisible()
  expect(requests.find(item => item.path.endsWith('/preview/')).body.generation_mode).toBe('template')
  expect(requests.filter(item => item.path.endsWith('/create/'))).toHaveLength(0)
  expect(errors).toEqual([])
})

test('provider failure preserves the brief and only uses the template after user selection', async ({ page }) => {
  const { dialog, requests, control } = await setup(page, { previewStatus: 503 })
  await fillBrief(dialog)
  await dialog.getByRole('button', { name: 'Generate plan preview' }).click()
  await expect(dialog.getByRole('alert')).toContainText('AI provider unavailable')
  await expect(dialog.getByLabel('Project name')).toHaveValue('Internal Software Launch')
  expect(requests.filter(item => item.method === 'POST')).toHaveLength(1)
  control.previewStatus = 200
  await dialog.getByRole('button', { name: 'Use standard template' }).click()
  await expect(previewDialog(page)).toBeVisible()
  expect(requests.filter(item => item.path.endsWith('/preview/')).map(item => item.body.generation_mode)).toEqual(['ai', 'template'])
})

test('server rejection retains edited tasks for correction and retry', async ({ page }) => {
  const { dialog, requests, control } = await setup(page, { createStatus: 400 })
  await fillBrief(dialog)
  await dialog.getByRole('button', { name: 'Generate plan preview' }).click()
  const review = previewDialog(page)
  await review.getByLabel('Task 1 / deliverable').fill('Reviewed release scope')
  await review.getByRole('button', { name: 'Create project & plan' }).click()
  await expect(review.getByRole('alert')).toContainText('dependencies contain a cycle')
  await expect(review.getByLabel('Task 1 / deliverable')).toHaveValue('Reviewed release scope')
  control.createStatus = 201
  await review.getByRole('button', { name: 'Create project & plan' }).click()
  await expect(review).toHaveCount(0)
  expect(requests.filter(item => item.path.endsWith('/create/'))).toHaveLength(2)
  expect(requests.filter(item => item.path.endsWith('/create/')).every(item => item.body.preview_token === 'signed-preview-test-only')).toBe(true)
})

test('employee options failure is recoverable without losing dialog or writing projects', async ({ page }) => {
  const { dialog, requests, control } = await setup(page, { optionsStatus: 503 })
  await expect(dialog.getByRole('alert')).toContainText('Employee directory temporarily unavailable')
  await expect(dialog.getByRole('button', { name: 'Generate plan preview' })).toBeDisabled()
  control.optionsStatus = 200
  await dialog.getByRole('button', { name: 'Retry loading' }).click()
  await expect(dialog.getByLabel('Project manager')).toBeVisible()
  expect(requests.filter(item => item.method === 'POST')).toEqual([])
})

test('date edits recalculate working duration and expose a late forecast without concealing the draft', async ({ page }) => {
  const { dialog, requests } = await setup(page)
  await fillBrief(dialog)
  await dialog.getByRole('button', { name: 'Generate plan preview' }).click()
  const review = previewDialog(page)
  await review.getByLabel('Task 1 start date').fill('2026-09-25')
  await expect(review.getByLabel('Task 1 due date')).toHaveValue('2026-09-28')
  await review.getByLabel('Task 2 start date').fill('2026-12-17')
  await expect(review.getByLabel('Task 2 due date')).toHaveValue('2026-12-21')
  await expect(review.getByRole('status')).toContainText('after the project target of 2026-12-20')
  await expect(review.getByText('Original preview notes.', { exact: false })).toBeVisible()
  await review.getByLabel('Task 2 due date').fill('2026-12-22')
  await review.getByLabel('Task 1 effort (hours)').fill('12.25')
  await review.getByRole('button', { name: 'Create project & plan' }).click()
  await expect(review).toHaveCount(0)
  const sent = requests.find(item => item.path.endsWith('/create/')).body.plan
  expect(sent.tasks[0]).toMatchObject({ duration_days: 2, planned_start_date: '2026-09-25', due_date: '2026-09-28', effort_hours: 12.25 })
  expect(sent.tasks[1]).toMatchObject({ duration_days: 4, planned_start_date: '2026-12-17', due_date: '2026-12-22' })
})

test('BYOK can be tested before completing a brief and never enters project payloads or browser storage', async ({ page }) => {
  const { dialog, requests, errors, consoleMessages } = await setup(page, { options: { ai_available: false, ai_message: 'The server AI key is not configured.' } })
  const sampleKey = 'sk-playwright-private-key-not-a-real-credential'
  const keyInput = dialog.getByLabel('OpenAI API key', { exact: true })
  await expect(keyInput).toHaveAttribute('type', 'password')
  await expect(dialog.getByRole('button', { name: 'Generate plan preview' })).toBeDisabled()
  await keyInput.fill(sampleKey)
  await dialog.getByLabel('AI model', { exact: true }).fill('gpt-4o')
  await dialog.getByRole('button', { name: 'Test & save key', exact: true }).click()
  await expect(keyInput).toHaveValue('')
  await expect(dialog.getByRole('button', { name: 'Generate plan preview' })).toBeEnabled()
  const save = requests.find(item => item.path.endsWith('/ai-settings/') && item.method === 'POST')
  expect(save.body).toEqual({ api_key: sampleKey, model: 'gpt-4o' })
  expect(requests.filter(item => item.path.endsWith('/preview/') || item.path.endsWith('/create/'))).toEqual([])
  await fillBrief(dialog)
  await dialog.getByRole('button', { name: 'Generate plan preview' }).click()
  await expect(previewDialog(page)).toBeVisible()
  const generated = requests.find(item => item.path.endsWith('/preview/'))
  expect(JSON.stringify(generated.body)).not.toContain(sampleKey)
  expect(generated.body).not.toHaveProperty('api_key')
  await previewDialog(page).getByRole('button', { name: 'Create project & plan' }).click()
  await expect(previewDialog(page)).toHaveCount(0)
  expect(JSON.stringify(requests.find(item => item.path.endsWith('/create/')).body)).not.toContain(sampleKey)
  const storage = await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }))
  expect(storage).not.toContain(sampleKey)
  expect(consoleMessages.join('\n')).not.toContain(sampleKey)
  expect(errors).toEqual([])
})

test('failed BYOK testing preserves the entered project and does not generate or expose the key', async ({ page }) => {
  const { dialog, requests, consoleMessages, errors } = await setup(page, { byokStatus: 400, options: { ai_available: false } })
  await fillBrief(dialog)
  const sampleKey = 'sk-playwright-rejected-key-not-real'
  await dialog.getByLabel('OpenAI API key', { exact: true }).fill(sampleKey)
  await dialog.getByRole('button', { name: 'Test & save key', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText('OpenAI rejected this API key')
  await expect(dialog.getByLabel('Project name')).toHaveValue('Internal Software Launch')
  await expect(dialog.getByRole('button', { name: 'Generate plan preview' })).toBeDisabled()
  expect(requests.filter(item => item.path.endsWith('/preview/') || item.path.endsWith('/create/'))).toEqual([])
  expect(consoleMessages.join('\n')).not.toContain(sampleKey)
  expect(await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }))).not.toContain(sampleKey)
  expect(errors).toEqual([])
})

test('saved personal connection survives reopening and can be removed without losing the brief', async ({ page }) => {
  const { dialog, requests, errors } = await setup(page, { options: { ai_available: false } })
  await dialog.getByLabel('OpenAI API key', { exact: true }).fill('sk-playwright-session-key-not-real')
  await dialog.getByRole('button', { name: 'Test & save key', exact: true }).click()
  await expect(dialog.getByRole('button', { name: 'Remove saved key', exact: true })).toBeVisible()
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  await page.locator('header.pp-header').getByRole('button', { name: 'Create project with AI', exact: true }).click()
  await expect(dialog.getByLabel('OpenAI API key', { exact: true })).toHaveValue('')
  await expect(dialog.getByRole('button', { name: 'Generate plan preview' })).toBeEnabled()
  await fillBrief(dialog)
  await dialog.getByRole('button', { name: 'Test & save key', exact: true }).click()
  const saves = requests.filter(item => item.path.endsWith('/ai-settings/') && item.method === 'POST')
  expect(saves).toHaveLength(2)
  expect(saves[1].body).toEqual({ model: 'gpt-4o' })
  await dialog.getByRole('button', { name: 'Remove saved key', exact: true }).click()
  await expect(dialog.getByRole('button', { name: 'Remove saved key', exact: true })).toHaveCount(0)
  await expect(dialog.getByRole('button', { name: 'Generate plan preview' })).toBeDisabled()
  await expect(dialog.getByLabel('Project name')).toHaveValue('Internal Software Launch')
  expect(requests.filter(item => item.method === 'DELETE')).toHaveLength(1)
  expect(requests.filter(item => item.path.endsWith('/create/'))).toEqual([])
  expect(errors).toEqual([])
})

test('unsaved BYOK edits cannot generate with the previous connection and Enter tests only the key', async ({ page }) => {
  const { dialog, requests, errors } = await setup(page)
  await fillBrief(dialog)
  await expect(dialog.getByRole('button', { name: 'Generate plan preview' })).toBeEnabled()
  await dialog.getByLabel('AI model', { exact: true }).fill('gpt-4o-mini')
  await expect(dialog.getByRole('button', { name: 'Generate plan preview' })).toBeDisabled()
  await expect(dialog.getByRole('button', { name: 'Use standard template' })).toBeEnabled()
  await dialog.getByLabel('OpenAI API key', { exact: true }).fill('sk-playwright-enter-key-not-real')
  await dialog.getByLabel('OpenAI API key', { exact: true }).press('Enter')
  await expect(dialog.getByRole('button', { name: 'Generate plan preview' })).toBeEnabled()
  expect(requests.filter(item => item.method === 'POST').map(item => item.path)).toEqual([`${endpoint}ai-settings/`])
  expect(requests.find(item => item.method === 'POST').body.model).toBe('gpt-4o-mini')
  await expect(dialog.getByLabel('Project name')).toHaveValue('Internal Software Launch')
  expect(errors).toEqual([])
})

test('saved key needing attention is not shown as connected', async ({ page }) => {
  const { dialog } = await setup(page, { options: { ai_available: false, ai_message: 'Your saved API key could not be opened.', ai_settings: { ...setupOptions.ai_settings, key_configured: true } } })
  await expect(dialog.getByText('Saved key needs attention', { exact: true })).toBeVisible()
  await expect(dialog.getByText('Personal key connected', { exact: true })).toHaveCount(0)
  await expect(dialog.getByRole('button', { name: 'Generate plan preview' })).toBeDisabled()
})

test('BYOK storage unavailable keeps template planning usable', async ({ page }) => {
  const { dialog, requests, errors } = await setup(page, { options: { ai_available: false, ai_settings: { storage_available: false } } })
  await expect(dialog.getByRole('button', { name: 'Test & save key', exact: true })).toBeDisabled()
  await expect(dialog.getByRole('button', { name: 'Generate plan preview' })).toBeDisabled()
  await fillBrief(dialog)
  await dialog.getByRole('button', { name: 'Use standard template' }).click()
  await expect(previewDialog(page)).toBeVisible()
  expect(requests.some(item => item.path.endsWith('/ai-settings/') && item.method === 'POST')).toBe(false)
  expect(errors).toEqual([])
})

test('mobile setup and preview stay centered and keyboard-accessible', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const { dialog, errors } = await setup(page)
  await expect(dialog.getByLabel('Project name')).toBeVisible()
  await page.screenshot({ path: '../artifacts/ai-project-setup-byok-mobile.png', animations: 'disabled' })
  const box = await dialog.boundingBox()
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(390)
  expect(box.y).toBeGreaterThanOrEqual(0)
  expect(box.y + box.height).toBeLessThanOrEqual(844)
  expect(Math.abs(box.x + box.width / 2 - 195)).toBeLessThan(2)
  const scan = await new AxeBuilder({ page }).include('.aps-dialog').analyze()
  expect(scan.violations.filter(item => ['serious', 'critical'].includes(item.impact))).toEqual([])
  await fillBrief(dialog)
  await dialog.getByRole('button', { name: 'Generate plan preview' }).click()
  const review = previewDialog(page)
  await expect(review).toBeVisible()
  expect(await review.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
  const previewScan = await new AxeBuilder({ page }).include('.aps-dialog').analyze()
  expect(previewScan.violations.filter(item => ['serious', 'critical'].includes(item.impact))).toEqual([])
  await page.screenshot({ path: '../artifacts/ai-project-setup-mobile.png', animations: 'disabled' })
  await page.keyboard.press('Escape')
  await expect(review).toHaveCount(0)
  expect(errors).toEqual([])
})
