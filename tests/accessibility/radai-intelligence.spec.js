import { test, expect } from '@playwright/test'
import { Buffer } from 'node:buffer'

test.setTimeout(90000)

async function setup(page, authenticated = true) {
  if (authenticated) await page.addInitScript(() => {
    localStorage.setItem('radai_access_token', 'synthetic-browser-token')
    localStorage.setItem('radai_user_data', JSON.stringify({ id: 41, first_name: 'Test', last_name: 'Engineer' }))
  })
  let project = null
  let instructions = { version: 0, can_edit: true, role_behavior: '', goals: '', response_format: '', terminology: '', standards: '', evidence_requirements: '', constraints: '' }
  let knowledge = []
  let members = []
  const calls = []
  await page.route('**/api/v1/**', route => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    calls.push(`${request.method()} ${path}`)
    if (path.endsWith('/rbac/users/me/') && !authenticated) return route.fulfill({ status: 401, json: { detail: 'Authentication required.' } })
    if (path.endsWith('/rbac/users/me/')) return route.fulfill({ json: { id: 41, user: { id: 41, first_name: 'Test' }, roles: [], modules: [], module_actions: {}, must_change_password: false } })
    if (path.endsWith('/users/check-first-login/')) return route.fulfill({ json: { must_reset_password: false } })
    if (path.endsWith('/rbac/users/me/profile-completeness/')) return route.fulfill({ json: { is_complete: true } })
    if (path.endsWith('/ai-workspaces/models/')) return route.fulfill({ json: { models: [{ provider: 'ollama', model_id: 'qwen3:8b', label: 'Qwen3 8B' }], default_model: 'qwen3:8b' } })
    if (path.endsWith('/ai-workspaces/')) {
      if (request.method() === 'POST') project = { id: 701, name: request.postDataJSON().name, description: request.postDataJSON().description, folder: '', visibility: 'private', role: 'owner', owner_id: 41 }
      return route.fulfill({ json: request.method() === 'POST' ? project : { results: project ? [project] : [] } })
    }
    if (/\/ai-workspaces\/\d+\/$/.test(path)) return route.fulfill({ json: project })
    if (path.endsWith('/instructions/')) {
      if (request.method() === 'PUT') instructions = { ...instructions, ...request.postDataJSON(), version: instructions.version + 1 }
      return route.fulfill({ json: instructions })
    }
    if (path.endsWith('/knowledge/')) {
      if (request.method() === 'POST') knowledge = [{ id: 88, name: 'pms.pdf', version: 1, status: 'ready', approval: 'unverified' }]
      return route.fulfill({ json: request.method() === 'POST' ? knowledge[0] : { results: knowledge, can_edit: true } })
    }
    if (/\/knowledge\/\d+\/$/.test(path)) return route.fulfill({ json: { ...knowledge[0], pages: [{ location: 'page 1', text: 'ASTM A106 Grade B pipe' }] } })
    if (path.endsWith('/members/')) {
      if (request.method() === 'POST') members.push({ user_id: 42, email: 'colleague@example.test', role: 'viewer' })
      return route.fulfill({ json: request.method() === 'POST' ? members.at(-1) : { results: [{ user_id: 41, email: 'owner@example.test', role: 'owner' }, ...members] } })
    }
    if (path.endsWith('/activity/')) return route.fulfill({ json: [] })
    if (path.endsWith('/conversations/')) return route.fulfill({ json: request.method() === 'POST' ? { id: 9, title: 'New conversation' } : { results: [] } })
    if (path.endsWith('/send/') && path.includes('/general/')) return route.fulfill({ json: { conversation: { messages: [{ id: 1, role: 'user', content: 'Hello' }, { id: 2, role: 'assistant', content: '**Source Evidence**\n\n- General answer\n\n<script>alert(1)</script>', sources: [] }] } } })
    if (path.endsWith('/send/')) return route.fulfill({ json: { conversation: { messages: [{ id: 1, role: 'user', content: 'What is P-101?' }, { id: 2, role: 'assistant', content: 'Draft description', sources: [{ source_id: 88, document: 'pms.pdf', revision: '1', location: 'page 1', approval: 'unverified' }] }] } } })
    return route.fulfill({ json: {} })
  })
  return calls
}

test('AI project, instructions, knowledge, chat and member UI without engineering-project access', async ({ page }) => {
  const calls = await setup(page)
  await page.goto('/radai-intelligence', { waitUntil: 'commit' })
  await page.getByRole('button', { name: 'Projects', exact: true }).click()
  await page.getByPlaceholder('Piping Specification Assistant').fill('Piping Specification Assistant')
  await page.getByRole('button', { name: 'Create project' }).click()
  await expect(page.getByRole('heading', { name: 'Piping Specification Assistant' })).toBeVisible()
  await page.getByLabel('AI role and behavior').fill('Use the company template and cite the specification.')
  await page.getByRole('button', { name: 'Save instructions' }).click()
  await page.getByRole('tab', { name: 'Knowledge' }).click()
  await page.getByLabel('Upload knowledge').setInputFiles({ name: 'pms.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7 test') })
  await expect(page.getByText('pms.pdf')).toBeVisible()
  await page.getByRole('tab', { name: 'Members' }).click()
  await page.getByPlaceholder('Employee email').fill('colleague@example.test')
  await page.getByRole('button', { name: 'Add' }).click()
  await expect(page.getByText('colleague@example.test')).toBeVisible()
  await page.getByRole('button', { name: 'Open chat' }).click()
  await page.getByPlaceholder('Message RADAI Intelligence').fill('What is P-101?')
  await page.getByRole('button', { name: 'Send message' }).click()
  await expect(page.getByText('Draft description')).toBeVisible()
  await expect(page.getByText(/pms.pdf · v1 · page 1/)).toBeVisible()
  expect(calls.some(call => call.includes('/projects/'))).toBe(false)
})

test('authentication protects the new workspace', async ({ page }) => {
  const calls = await setup(page, false)
  await page.goto('/radai-intelligence', { waitUntil: 'commit' })
  await expect(page).toHaveURL(/\/login/, { timeout: 60000 })
  expect(calls.some(call => call.includes('/ai-workspaces/'))).toBe(false)
})

test('general chat works without selecting a project', async ({ page }) => {
  const calls = await setup(page)
  await page.goto('/radai-intelligence', { waitUntil: 'commit' })
  await expect(page.getByRole('combobox', { name: 'Chat model' })).toContainText('Qwen3 8B', { timeout: 30000 })
  expect((await page.locator('form').first().innerText()).split(/\s+/)).not.toContain('0')
  await expect(page.getByRole('button', { name: 'Add files or actions' })).toBeVisible()
  await page.getByPlaceholder('Message RADAI Intelligence').fill('Hello')
  await page.getByRole('button', { name: 'Send message' }).click()
  await expect(page.getByText('General answer')).toBeVisible()
  await expect(page.locator('[aria-live="polite"] strong')).toHaveText('Source Evidence')
  expect(await page.locator('[aria-live="polite"] script').count()).toBe(0)
  expect(calls).toContain('POST /api/v1/ai-workspaces/general/conversations/')
  expect(calls.some(call => call.includes('/general/conversations/9/send/'))).toBe(true)
})

test('mobile internal navigation opens without horizontal overflow', async ({ page }) => {
  await setup(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/radai-intelligence', { waitUntil: 'commit' })
  await page.getByRole('button', { name: 'Open workspace navigation' }).click()
  await expect(page.getByRole('navigation', { name: 'Workspace sections' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})
