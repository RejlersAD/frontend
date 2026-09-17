import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { Buffer } from 'node:buffer'

test.setTimeout(120000)
test.use({ serviceWorkers: 'block', viewport: { width: 1672, height: 941 } })
const endpoint = '/api/v1/users/employees/my-digital-stamp/'
const stampBytes = await readFile(fileURLToPath(new URL('../../public/assets/procurement/commercial-license-stamp.png', import.meta.url)))
const stampImage = `data:image/png;base64,${stampBytes.toString('base64')}`
const png = { name: 'original-quality-stamp.png', mimeType: 'image/png', buffer: stampBytes }
const panel = page => page.getByRole('region', { name: 'My digital stamp', exact: true })
const fileInput = page => panel(page).getByLabel('Digital stamp image', { exact: true })
const reply = (route, data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) })

async function setup(page, options = {}) {
  const actor = { id: '00000000-0000-4000-8000-000000009011', username: 'synthetic-profile', first_name: 'Jarmo', last_name: 'Suominen', full_name: 'Jarmo Suominen', email: 'jarmo@example.test', is_active: true, is_superuser: false, roles: [], modules: [], module_actions: {}, ...options.actor }
  const state = { record: { can_manage: true, has_stamp: false, stamp: null, updated_at: null }, requests: [], uploads: [], deletes: 0, unexpected: [], errors: [], ...options }
  await page.addInitScript(user => {
    localStorage.setItem('radai_access_token', 'isolated-profile-fixture-token')
    localStorage.setItem('radai_user_data', JSON.stringify(user))
    localStorage.setItem('radai.sidebar.collapsed', 'false')
  }, actor)
  page.on('pageerror', error => state.errors.push(error.message))
  await page.route('**/api/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname, method = request.method()
    state.requests.push({ path, method })
    if (path === endpoint) {
      if (method === 'GET') return reply(route, state.loadError || state.record, state.loadError ? 503 : 200)
      if (method === 'POST') {
        const body = request.postDataBuffer(), start = body.indexOf('\r\n\r\n') + 4, end = body.lastIndexOf('\r\n--')
        state.uploads.push({ headers: body.subarray(0, start).toString(), bytes: body.subarray(start, end) })
        if (state.saveError) return reply(route, state.saveError, 503)
        state.record = { can_manage: true, has_stamp: true, stamp: stampImage, updated_at: '2026-09-17T12:00:00Z' }
        return reply(route, { ...state.record, success: true })
      }
      if (method === 'DELETE') {
        state.deletes += 1
        if (state.deleteError) return reply(route, state.deleteError, 503)
        state.record = { can_manage: true, has_stamp: false, stamp: null, updated_at: null }
        return reply(route, { ...state.record, success: true })
      }
    }
    if (path === '/api/v1/health/') return reply(route, { status: 'ok' })
    if (path === '/api/v1/users/check-first-login/') return reply(route, { must_reset_password: false })
    if (path.includes('check-password-expiry')) return reply(route, { is_expired: false, must_change_password: false, show_warning: false })
    if (path === '/api/v1/rbac/users/me/profile-completeness/') return reply(route, { is_complete: true, percentage: 100, missing_fields: [] })
    if (path === '/api/v1/rbac/users/me/') return reply(route, { ...actor, user: actor })
    if (path === '/api/v1/users/employees/my-signature/' && method === 'GET') return reply(route, { signature: null, updated_at: null })
    if (path === '/api/v1/users/employees/my-profile-photo/' && method === 'GET') return route.fulfill({ status: 204, body: '' })
    if (path === '/api/v1/notifications/unread_count/') return reply(route, { unread_count: 0 })
    if (path === '/api/v1/notifications/push-config/') return reply(route, { enabled: false, available: false })
    if (path.endsWith('/pending-for-me/')) return reply(route, { count: 0, results: [] })
    if (path.startsWith('/api/v1/ai-champion/') || path.startsWith('/api/v1/rbac/ai-champion/')) return reply(route, { success: true })
    // Unrelated profile panels remain isolated and empty; no real employee data is read.
    if (method === 'GET' && /^\/api\/v1\/(timesheet|payroll|payroll-engine|notifications)\//.test(path)) return reply(route, { count: 0, results: [], configured: false })
    if (method === 'GET' && ['/api/v1/rbac/users/reporting-managers/', '/api/v1/rbac/profile-documents/my_documents/', '/api/v1/finance/employee-salary-info/'].includes(path)) return reply(route, { count: 0, results: [] })
    state.unexpected.push({ path, method })
    return reply(route, { detail: 'Unexpected isolated profile request.' }, 400)
  })
  await page.goto('/profile?tab=signature', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'My Signature', exact: true })).toBeVisible({ timeout: 60000 })
  return state
}

function clean(state) {
  expect(state.unexpected).toEqual([])
  expect(state.errors).toEqual([])
  expect(state.requests.filter(request => !['GET', 'HEAD', 'OPTIONS'].includes(request.method) && request.path !== endpoint && !request.path.includes('ai-champion'))).toEqual([])
}

test('eligible own profile uploads original PNG and JPEG bytes, previews, replaces and removes its digital stamp', async ({ page }) => {
  const state = await setup(page)
  await expect(panel(page)).toBeVisible()
  await expect(panel(page)).toContainText('transparent PNG is recommended')
  await fileInput(page).setInputFiles(png)
  await expect(panel(page).getByRole('img', { name: 'Your saved digital stamp' })).toHaveAttribute('src', stampImage)
  await expect(panel(page).getByRole('img')).toHaveCSS('opacity', '1')
  expect(state.uploads).toHaveLength(1)
  expect(state.uploads[0].headers).toContain('name="stamp"; filename="original-quality-stamp.png"')
  expect(state.uploads[0].bytes).toEqual(stampBytes)
  const jpegData = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 320; canvas.height = 240
    const context = canvas.getContext('2d')
    context.fillStyle = 'white'; context.fillRect(0, 0, 320, 240)
    context.fillStyle = '#1744a0'; context.fillRect(30, 30, 200, 100)
    return canvas.toDataURL('image/jpeg', 0.95).split(',')[1]
  })
  const jpegBytes = Buffer.from(jpegData, 'base64')
  await fileInput(page).setInputFiles({ name: 'replacement-quality-stamp.jpg', mimeType: 'image/jpeg', buffer: jpegBytes })
  await expect(panel(page).getByRole('button', { name: /^Replace digital stamp/ })).toBeEnabled()
  expect(state.uploads).toHaveLength(2)
  expect(state.uploads[1].bytes).toEqual(jpegBytes)
  await panel(page).scrollIntoViewIfNeeded()
  await page.screenshot({ path: '../artifacts/profile-digital-stamp-desktop.png' })
  await page.setViewportSize({ width: 390, height: 844 })
  // Resizing the desktop shell can leave its animated drawer partially offscreen.
  // Dismiss it without waiting for a close button that has already slid away.
  await page.keyboard.press('Escape')
  await panel(page).scrollIntoViewIfNeeded()
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  await page.screenshot({ path: '../artifacts/profile-digital-stamp-mobile.png' })
  await panel(page).getByRole('button', { name: 'Remove digital stamp', exact: true }).click()
  await page.getByRole('dialog', { name: 'Confirm action' }).getByRole('button', { name: 'Cancel', exact: true }).click()
  expect(state.deletes).toBe(0)
  await panel(page).getByRole('button', { name: 'Remove digital stamp', exact: true }).click()
  await page.getByRole('dialog', { name: 'Confirm action' }).getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(panel(page).getByRole('img')).toHaveCount(0)
  await expect(panel(page)).toContainText('Generated completed PO documents will use the standard company stamp.')
  expect(state.deletes).toBe(1)
  clean(state)
})

test('profile stamp validates size and type locally, retries loading and retains the saved image on write errors', async ({ page }) => {
  const state = await setup(page, { loadError: { detail: 'Temporarily unavailable.' }, record: { can_manage: true, has_stamp: true, stamp: stampImage, updated_at: null } })
  await expect(panel(page)).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Retry profile artwork', exact: true })).toBeVisible()
  state.loadError = null
  await page.getByRole('button', { name: 'Retry profile artwork', exact: true }).click()
  await expect(panel(page).getByRole('img')).toBeVisible()
  await fileInput(page).setInputFiles({ name: 'not-an-image.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4') })
  await expect(panel(page).getByRole('alert')).toHaveText('Choose a PNG or JPEG image.')
  await fileInput(page).setInputFiles({ name: 'oversize.png', mimeType: 'image/png', buffer: Buffer.alloc(10 * 1024 * 1024 + 1) })
  await expect(panel(page).getByRole('alert')).toHaveText('The digital stamp image must be 10 MB or smaller.')
  expect(state.uploads).toHaveLength(0)
  state.saveError = { stamp: ['The stamp could not be saved. Please retry.'] }
  await fileInput(page).setInputFiles(png)
  await expect(panel(page).getByRole('alert')).toHaveText('The stamp could not be saved. Please retry.')
  await expect(panel(page).getByRole('img')).toHaveAttribute('src', stampImage)
  state.saveError = null
  await fileInput(page).setInputFiles(png)
  await expect(panel(page).getByRole('status')).toContainText('Your digital stamp is saved.')
  state.deleteError = { detail: 'Stamp removal unavailable. Please retry.' }
  await panel(page).getByRole('button', { name: 'Remove digital stamp', exact: true }).click()
  await page.getByRole('dialog', { name: 'Confirm action' }).getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(panel(page).getByRole('alert')).toHaveText('Stamp removal unavailable. Please retry.')
  await expect(panel(page).getByRole('img')).toHaveAttribute('src', stampImage)
  clean(state)
})

test('an ineligible profile has no digital stamp controls even for an administrator or matching display name', async ({ page }) => {
  const state = await setup(page, { actor: { is_superuser: true }, record: { can_manage: false, has_stamp: false, stamp: null, updated_at: null } })
  await expect.poll(() => state.requests.filter(request => request.path === endpoint).length).toBeGreaterThan(0)
  await expect(panel(page)).toHaveCount(0)
  await expect(page.getByLabel('Digital stamp image', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^Upload signature image/ })).toBeVisible()
  expect(state.uploads).toEqual([])
  expect(state.deletes).toBe(0)
  clean(state)
})
