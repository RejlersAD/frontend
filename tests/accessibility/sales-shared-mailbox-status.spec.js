import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const mailboxPath = '/api/v1/sales/mailbox-connections/'
const checkedAt = '2026-09-28T08:15:00Z'
const shared = (overrides = {}) => ({
  id: 'shared-1', auth_mode: 'application', name: 'Sales shared inbox',
  mailbox_address: 'sales@example.test', mailbox_display_name: 'Inbox',
  last_status: 'connected', last_health_check_at: checkedAt, enabled: false,
  created_by: null, tenant_id: 'private-tenant-value', client_id: 'private-client-value',
  last_error: 'private-diagnostic-value', total_item_count: 47, unread_item_count: 3,
  ...overrides,
})
const paginated = (results, next = null) => ({ count: results.length, results, next })
const region = page => page.getByRole('region', { name: 'Shared mailbox', exact: true })
const refresh = page => region(page).getByRole('button', { name: 'Refresh mailbox status', exact: true })
const deferred = () => {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}

async function prepare(page, options = {}) {
  const state = {
    requests: [], errors: [], unexpected: [], calls: 0,
    response: paginated([shared()]), status: 200, hold: null,
    ...options,
  }
  page.on('pageerror', error => state.errors.push(error.message))
  await page.addInitScript(() => {
    localStorage.setItem('radai_access_token', 'mailbox-fixture-user-11')
    localStorage.setItem('radai_user_data', JSON.stringify({ id: 900, user: { id: 11 }, email: 'first-admin@example.test' }))
  })
  await page.route('https://graph.microsoft.com/**', route => {
    state.unexpected.push('Microsoft Graph request')
    return route.abort()
  })
  await page.route('https://login.microsoftonline.com/**', route => {
    state.unexpected.push('Microsoft identity request')
    return route.abort()
  })
  await page.route('**/api/v1/**', async route => {
    const request = route.request()
    const url = new URL(request.url())
    state.requests.push({ path: url.pathname, method: request.method(), query: url.search, authorization: request.headers().authorization })
    if (request.method() !== 'GET') {
      state.unexpected.push(`${request.method()} ${url.pathname}`)
      return route.fulfill({ status: 405, json: { detail: 'Only reads allowed in fixture.' } })
    }
    if (url.pathname === mailboxPath) {
      const call = ++state.calls
      const response = state.handler
        ? await state.handler({ page: Number(url.searchParams.get('page') || 1), call, request, url })
        : { status: state.status, body: structuredClone(state.response), hold: state.hold }
      if (response.hold) await response.hold.promise
      return route.fulfill({ status: response.status ?? 200, json: response.body })
    }
    if (['/api/v1/sales/deals/', '/api/v1/sales/clients/', '/api/v1/sales/quotes/'].includes(url.pathname)) {
      return route.fulfill({ json: paginated([]) })
    }
    state.unexpected.push(`${request.method()} ${url.pathname}`)
    return route.fulfill({ status: 404, json: { detail: 'Unexpected fixture request.' } })
  })
  await page.goto(`/tests/fixtures/sales-shared-mailbox-status.html${options.mode === 'page' ? '?mode=page' : ''}`)
  return state
}

function assertReadOnly(state) {
  expect(state.unexpected).toEqual([])
  expect(state.errors).toEqual([])
  expect(state.requests.every(request => request.method === 'GET')).toBe(true)
  expect(state.requests.filter(request => request.path === mailboxPath).every(request => !new URLSearchParams(request.query).has('mine'))).toBe(true)
}

test('saved shared connection shows Connected separately from intake off and exposes no configuration details', async ({ page }) => {
  const state = await prepare(page, { response: paginated([
    { ...shared(), id: 'personal', auth_mode: 'delegated', mailbox_address: 'personal@example.test' },
    shared(),
  ]) })
  await expect(region(page).getByText('sales@example.test', { exact: true })).toBeVisible()
  await expect(region(page).getByText('Sales shared inbox', { exact: true })).toBeVisible()
  await expect(region(page).getByText('Connected', { exact: true })).toBeVisible()
  await expect(region(page).getByText('Email intake off', { exact: true })).toBeVisible()
  await expect(region(page).locator('time')).toHaveAttribute('datetime', '2026-09-28T08:15:00.000Z')
  await expect(region(page).getByText('personal@example.test')).toHaveCount(0)
  await expect(region(page)).not.toContainText(/private-tenant-value|private-client-value|private-diagnostic-value/)
  await expect(region(page).getByRole('button')).toHaveCount(1)
  expect(state.calls).toBe(1)
  assertReadOnly(state)
})

test('pagination waits for the complete permitted list before showing shared mailboxes', async ({ page }) => {
  const hold = deferred()
  const state = await prepare(page, { handler: ({ page: pageNumber }) => pageNumber === 1
    ? { body: paginated([shared({ mailbox_address: 'first@example.test' })], `${mailboxPath}?page=2`) }
    : { body: paginated([shared({ id: 'shared-2', mailbox_address: 'second@example.test', last_status: 'not_tested', last_health_check_at: null, enabled: true })]), hold },
  })
  await expect.poll(() => state.calls).toBe(2)
  await expect(region(page).getByText(/Loading shared mailbox status/)).toBeVisible()
  await expect(region(page).getByText('first@example.test')).toHaveCount(0)
  hold.resolve()
  await expect(region(page).getByText('first@example.test', { exact: true })).toBeVisible()
  await expect(region(page).getByText('second@example.test', { exact: true })).toBeVisible()
  await expect(region(page).getByText('Not tested', { exact: true })).toBeVisible()
  await expect(region(page).getByText('Email intake enabled', { exact: true })).toBeVisible()
  await expect(region(page)).toContainText('Not checked')
  expect(state.requests.filter(request => request.path === mailboxPath).map(request => new URLSearchParams(request.query).get('page'))).toEqual(['1', '2'])
  assertReadOnly(state)
})

test('loading and empty states never imply a connected mailbox', async ({ page }) => {
  const hold = deferred()
  const state = await prepare(page, { response: [], hold })
  await expect(region(page).getByText(/Loading shared mailbox status/)).toBeVisible()
  await expect(refresh(page)).toBeDisabled()
  hold.resolve()
  await expect(region(page).getByText('No shared mailbox is available to your account.')).toBeVisible()
  await expect(region(page).getByText('Connected', { exact: true })).toHaveCount(0)
  await expect(refresh(page)).toBeEnabled()
  assertReadOnly(state)
})

test('revoked access removes saved metadata and reports denial rather than empty results', async ({ page }) => {
  const state = await prepare(page)
  await expect(region(page).getByText('sales@example.test')).toBeVisible()
  state.status = 403
  state.response = { detail: 'private-error-payload@example.test' }
  await refresh(page).click()
  await expect(region(page).getByRole('alert')).toHaveText('You do not have access to shared mailbox status.')
  await expect(region(page).getByText('sales@example.test')).toHaveCount(0)
  await expect(region(page).locator('time')).toHaveCount(0)
  await expect(region(page)).not.toContainText(/Connected|private-error-payload|No shared mailbox/)
  assertReadOnly(state)
})

test('transient refresh failure marks retained metadata outdated and keyboard retry replaces it', async ({ page }) => {
  const state = await prepare(page)
  await expect(region(page).getByText('sales@example.test')).toBeVisible()
  state.status = 503
  state.response = { detail: 'private service diagnostic' }
  await refresh(page).focus()
  await page.keyboard.press('Enter')
  await expect(region(page).getByRole('alert')).toHaveText('Mailbox status is outdated. Refresh failed. Try again.')
  await expect(region(page).getByText('sales@example.test')).toBeVisible()
  const hold = deferred()
  state.status = 200
  state.response = paginated([shared({ mailbox_address: 'updated@example.test', last_status: 'error' })])
  state.hold = hold
  await refresh(page).focus()
  await page.keyboard.press('Enter')
  await expect(region(page).getByText('Mailbox status is outdated.', { exact: true })).toBeVisible()
  await expect(refresh(page)).toBeDisabled()
  hold.resolve()
  await expect(region(page).getByText('updated@example.test')).toBeVisible()
  await expect(region(page).getByText('Needs attention', { exact: true })).toBeVisible()
  await expect(region(page).getByText('sales@example.test')).toHaveCount(0)
  await expect(region(page)).not.toContainText(/outdated|private service diagnostic/)
  expect(state.calls).toBe(3)
  assertReadOnly(state)
})

for (const scenario of [
  { name: 'malformed page', second: { results: 'not-a-list', next: null } },
  { name: 'cyclic pagination', second: paginated([shared({ id: 'shared-2', mailbox_address: 'second@example.test' })], `${mailboxPath}?page=1`) },
]) {
  test(`${scenario.name} never publishes a partial successful list`, async ({ page }) => {
    const state = await prepare(page, { handler: ({ page: pageNumber }) => ({ body: pageNumber === 1
      ? paginated([shared()], `${mailboxPath}?page=2`)
      : scenario.second }),
    })
    await expect(region(page).getByRole('alert')).toHaveText('Mailbox status could not be loaded. Try again.')
    await expect(region(page)).not.toContainText(/sales@example.test|second@example.test|Connected|No shared mailbox/)
    await expect(refresh(page)).toBeEnabled()
    expect(state.calls).toBe(2)
    assertReadOnly(state)
  })
}

test('unmount discards late responses and stops following their next page', async ({ page }) => {
  const hold = deferred()
  const state = await prepare(page, { response: paginated([shared()], `${mailboxPath}?page=2`), hold })
  await expect.poll(() => state.calls).toBe(1)
  await page.evaluate(() => window.setSalesMailboxFixtureMounted(false))
  await expect(region(page)).toHaveCount(0)
  const responseArrived = page.waitForResponse(response => new URL(response.url()).pathname === mailboxPath)
  hold.resolve()
  await responseArrived
  state.response = []
  state.hold = null
  await page.evaluate(() => window.setSalesMailboxFixtureMounted(true))
  await expect(region(page).getByText('No shared mailbox is available to your account.')).toBeVisible()
  expect(state.requests.filter(request => request.path === mailboxPath).map(request => new URLSearchParams(request.query).get('page'))).toEqual(['1', '1'])
  assertReadOnly(state)
})

test('real Sales workspace clears mailbox metadata when nested account identity changes or signs out', async ({ page }, testInfo) => {
  const hold = deferred()
  const state = await prepare(page, { mode: 'page', handler: ({ request }) => request.headers().authorization === 'Bearer mailbox-fixture-user-11'
    ? { body: paginated([shared()]) }
    : { body: paginated([shared({ mailbox_address: 'new-account@example.test' })]), hold },
  })
  await expect(region(page).getByText('sales@example.test')).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('sales-shared-mailbox-integrated.png'), fullPage: true })
  await page.evaluate(() => window.setSalesMailboxFixtureActor({ id: 900, user: { id: 22 }, email: 'second-admin@example.test' }))
  await expect(region(page).getByText(/Loading shared mailbox status/)).toBeVisible()
  await expect(region(page).getByText('sales@example.test')).toHaveCount(0)
  await expect.poll(() => state.calls).toBe(2)
  hold.resolve()
  await expect(region(page).getByText('new-account@example.test')).toBeVisible()
  await page.evaluate(() => window.setSalesMailboxFixtureActor(null))
  await expect(region(page)).toHaveCount(0)
  assertReadOnly(state)
})

test('shared mailbox card remains readable at narrow widths and meets automated accessibility checks', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 360, height: 780 })
  const state = await prepare(page, { response: [shared({
    mailbox_address: 'very-long-sales-mailbox-name-for-responsive-checks@example.test',
    name: 'Regional shared Sales correspondence inbox',
  })] })
  await expect(region(page).getByText('Connected', { exact: true })).toBeVisible()
  const sizes = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: window.innerWidth }))
  expect(sizes.scroll).toBeLessThanOrEqual(sizes.width)
  await expect(refresh(page)).toBeInViewport()
  await page.keyboard.press('Tab')
  await expect(refresh(page)).toBeFocused()
  const accessibility = await new AxeBuilder({ page }).include('main').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
  expect(accessibility.violations).toEqual([])
  await page.screenshot({ path: testInfo.outputPath('sales-shared-mailbox-narrow.png'), fullPage: true })
  assertReadOnly(state)
})
