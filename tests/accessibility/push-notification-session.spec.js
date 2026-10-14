import { test, expect } from '@playwright/test'

async function prepare(page, fixture = {}) {
  const requests = [], errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.addInitScript(value => {
    window.pushFixture = { actor: { id: 12, email: 'assigned@example.test' }, ...value }
    localStorage.setItem('radai_access_token', 'synthetic-token')
    localStorage.setItem('radai_user_data', JSON.stringify(window.pushFixture.actor))
    window.pushCalls = { subscribed: 0, unsubscribed: 0, closed: 0, messages: [] }
    let subscription = null
    const registration = {
      active: { postMessage: message => window.pushCalls.messages.push(message) },
      pushManager: {
        getSubscription: async () => subscription,
        subscribe: async () => {
          const endpoint = `https://push.example.test/${++window.pushCalls.subscribed}`
          subscription = { endpoint, toJSON: () => ({ endpoint, keys: { p256dh: 'test-key', auth: 'test-auth' } }), unsubscribe: async () => { window.pushCalls.unsubscribed++; subscription = null; return true } }
          return subscription
        },
      },
      getNotifications: async () => [{ close: () => window.pushCalls.closed++ }],
    }
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { getRegistration: async () => registration } })
    Object.defineProperty(window, 'Notification', { configurable: true, value: { permission: 'granted', requestPermission: async () => 'granted' } })
    if (!window.PushManager) window.PushManager = function () {}
  }, fixture)
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname
    requests.push({ path, method: route.request().method(), authorization: route.request().headers().authorization })
    let body = { results: [], count: 0 }
    if (path.includes('push-config')) body = { available: true, public_key: 'AQID' }
    else if (path.includes('push-subscribe')) body = { subscribed: true, recipient_user_id: await page.evaluate(() => String(JSON.parse(localStorage.getItem('radai_user_data')).id)) }
    else if (path.includes('/requisitions/') || path.includes('/orders/')) body = fixture.record || {}
    else if (path.includes('/stats/')) body = { total: 0, unread: 0, by_priority: {}, by_type: {} }
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) })
  })
  return { requests, errors }
}
const owner = page => page.evaluate(() => JSON.parse(localStorage.getItem('radai_push_owner') || 'null'))
const sessionOwner = page => page.evaluate(async () => (await (await (await caches.open('radai-push-session-v1')).match('/__radai_push_session__')).json()).userId)

test('logout clears subscription, worker recipient binding, and displayed notifications before another account opts in', async ({ page }) => {
  const state = await prepare(page)
  await page.goto('/tests/fixtures/push-notifications.html')
  await page.getByRole('button', { name: 'Enable push' }).click()
  await expect.poll(() => owner(page)).toMatchObject({ userId: '12' })
  expect(await sessionOwner(page)).toBe('12')
  await page.getByRole('button', { name: 'Logout', exact: true }).click()
  await expect.poll(() => owner(page)).toBeNull()
  await expect.poll(() => sessionOwner(page)).toBe('')
  await expect.poll(() => page.evaluate(() => window.pushCalls.unsubscribed)).toBe(1)
  expect(state.requests.find(row => row.path.includes('push-unsubscribe'))?.authorization).toBe('Bearer synthetic-token')
  expect(await page.evaluate(() => window.pushCalls.closed)).toBeGreaterThan(0)
  await page.evaluate(() => { localStorage.setItem('radai_access_token', 'second-token'); localStorage.setItem('radai_user_data', JSON.stringify({ id: 99, email: 'ceo@example.test' })) })
  await page.getByRole('button', { name: 'Check push' }).click()
  await expect(page.getByRole('status')).toContainText('"enabled":false')
  await page.getByRole('button', { name: 'Enable push' }).click()
  await expect.poll(() => owner(page)).toMatchObject({ userId: '99', endpoint: 'https://push.example.test/2' })
  expect(await sessionOwner(page)).toBe('99')
  expect(state.errors).toEqual([])
})
test('API failure cannot leave local browser push active after disabling', async ({ page }) => {
  const state = await prepare(page)
  await page.goto('/tests/fixtures/push-notifications.html')
  await page.getByRole('button', { name: 'Enable push' }).click()
  await expect.poll(() => owner(page)).toMatchObject({ userId: '12' })
  await page.route('**/api/v1/notifications/push-unsubscribe/', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }))
  await page.getByRole('button', { name: 'Disable push' }).click()
  await expect.poll(() => owner(page)).toBeNull()
  await expect.poll(() => sessionOwner(page)).toBe('')
  expect(await page.evaluate(() => window.pushCalls.unsubscribed)).toBe(1)
  expect(state.errors).toEqual([])
})
test('an account switch during registration cannot bind the prior account after its request completes', async ({ page }) => {
  const state = await prepare(page)
  let release
  const registered = new Promise(resolve => { release = resolve })
  await page.route('**/api/v1/notifications/push-subscribe/', async route => { await registered; await route.fulfill({ contentType: 'application/json', body: '{"subscribed":true}' }) })
  await page.goto('/tests/fixtures/push-notifications.html')
  const sent = page.waitForRequest('**/api/v1/notifications/push-subscribe/')
  await page.getByRole('button', { name: 'Enable push' }).click()
  await sent
  await page.evaluate(() => { localStorage.setItem('radai_access_token', 'second-token'); localStorage.setItem('radai_user_data', JSON.stringify({ id: 99 })) })
  release()
  await expect(page.getByRole('status')).toContainText('Your account changed')
  expect(await owner(page)).toBeNull()
  expect(await sessionOwner(page)).toBe('')
  expect(await page.evaluate(() => window.pushCalls.unsubscribed)).toBe(1)
  expect(state.errors).toEqual([])
})
test('cross-tab account changes clear the previous browser recipient', async ({ page }) => {
  const state = await prepare(page)
  await page.goto('/tests/fixtures/push-notifications.html')
  await page.getByRole('button', { name: 'Enable push' }).click()
  await expect.poll(() => owner(page)).toMatchObject({ userId: '12' })
  await page.evaluate(() => {
    localStorage.setItem('radai_user_data', JSON.stringify({ id: 99 }))
    window.dispatchEvent(new StorageEvent('storage', { key: 'radai_user_data' }))
  })
  await expect.poll(() => owner(page)).toBeNull()
  await expect.poll(() => sessionOwner(page)).toBe('')
  await expect.poll(() => page.evaluate(() => window.pushCalls.unsubscribed)).toBe(1)
  expect(state.errors).toEqual([])
})
test('subscription registration must confirm the same authenticated recipient as the browser session', async ({ page }) => {
  const state = await prepare(page)
  await page.route('**/api/v1/notifications/push-subscribe/', route => route.fulfill({ contentType: 'application/json', body: '{"subscribed":true,"recipient_user_id":"99"}' }))
  await page.goto('/tests/fixtures/push-notifications.html')
  await page.getByRole('button', { name: 'Enable push' }).click()
  await expect(page.getByRole('status')).toContainText('notification account could not be verified')
  expect(await owner(page)).toBeNull()
  expect(await sessionOwner(page)).toBe('')
  expect(await page.evaluate(() => window.pushCalls.unsubscribed)).toBe(1)
  expect(state.errors).toEqual([])
})
for (const type of ['pr', 'po']) test(`${type.toUpperCase()} push deep link uses fresh eligibility and hides stale or other-user actions`, async ({ page }) => {
  const stage = { level: 0, status: 'pending', user_id: 12, user_email: 'assigned@example.test', stage: 'Procurement' }
  const record = { id: 42, [type === 'po' ? 'po_number' : 'pr_number']: `PUSH-${type.toUpperCase()}-42`, can_approve: false, approval_workflow_config: [stage], approval_log: [stage], items: [] }
  const state = await prepare(page, { type, record, actor: { id: 99, email: 'ceo@example.test', is_superuser: true } })
  await page.goto('/tests/fixtures/push-notifications.html?view=notification')
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByRole('heading', { name: new RegExp(`PUSH-${type.toUpperCase()}-42`) })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Approve/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^Reject/ })).toHaveCount(0)
  expect(state.requests.filter(row => row.method !== 'GET')).toEqual([])
  expect(state.errors).toEqual([])
})
test('current assigned approver sees decision controls after opening the PR push route', async ({ page }) => {
  const stage = { level: 0, status: 'pending', user_id: 12, user_email: 'assigned@example.test', stage: 'Procurement' }
  const state = await prepare(page, { record: { id: 42, pr_number: 'PUSH-PR-42', can_approve: true, approval_workflow_config: [stage], items: [] } })
  await page.goto('/tests/fixtures/push-notifications.html?view=notification')
  await expect(page.getByRole('button', { name: /^Approve/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Reject/ })).toBeVisible()
  expect(state.requests.filter(row => row.method !== 'GET')).toEqual([])
  expect(state.errors).toEqual([])
})
