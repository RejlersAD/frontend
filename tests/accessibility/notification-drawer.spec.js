import { test, expect } from '@playwright/test'

const titles = {
  leave: 'Leave request needs approval',
  purchase: 'Purchase requisition approved',
  forecast: 'Project forecast changed',
  system: 'Scheduled maintenance completed',
  supplier: 'Supplier data incomplete',
}

function sampleNotifications() {
  const now = Date.now()
  return [
    { id: 101, title: titles.leave, message: '10 days requested by Ahmed Karim.', category_name: 'APPROVAL', is_read: false, created_at: new Date(now - 12 * 60000).toISOString(), action_url: '/hr/leave?request=101', action_label: 'Review request' },
    { id: 102, title: titles.purchase, message: 'PR RAD-PRJ-PR-0426_2026 was approved by Tanzeem Agra.', category_name: 'APPROVAL', is_read: false, created_at: new Date(now - 3600000).toISOString(), metadata: { pr_id: 42 }, action_label: 'Open requisition' },
    { id: 103, title: titles.forecast, message: 'September forecast increased by AED 0.68M.', category_name: 'PROJECT', is_read: false, created_at: new Date(now - 3 * 3600000).toISOString(), action_url: '/projects/42', action_label: 'View forecast' },
    { id: 104, title: titles.system, message: 'Document indexing service is available.', category_name: 'SYSTEM', is_read: true, created_at: new Date(now - 26 * 3600000).toISOString() },
    { id: 105, title: titles.supplier, message: 'Three supplier records are missing required documents.', category_name: 'USER', is_read: true, created_at: new Date(now - 49 * 3600000).toISOString(), action_url: '/procurement/suppliers', action_label: 'Review suppliers' },
  ].map(notification => ({ status: notification.is_read ? 'READ' : 'UNREAD', priority: 'NORMAL', metadata: {}, ...notification }))
}

async function prepare(page, options = {}) {
  const state = { notifications: sampleNotifications(), requests: [], errors: [], failures: {}, hold: null, ...options }
  const unread = () => state.notifications.filter(notification => !notification.is_read).length
  page.on('pageerror', error => state.errors.push(error.message))
  await page.addInitScript(() => {
    localStorage.setItem('radai_access_token', 'notification-test-token')
    localStorage.setItem('radai_user_data', JSON.stringify({ id: 12, email: 'planner@example.test' }))
    localStorage.setItem('radai_notification_sound_enabled', 'false')
    window.notificationPushCalls = { subscribed: 0, unsubscribed: 0 }
    let subscription = null
    const registration = {
      active: { postMessage: () => {} },
      pushManager: {
        getSubscription: async () => subscription,
        subscribe: async () => {
          window.notificationPushCalls.subscribed++
          const endpoint = 'https://push.example.test/drawer'
          subscription = {
            endpoint,
            toJSON: () => ({ endpoint, keys: { p256dh: 'test-key', auth: 'test-auth' } }),
            unsubscribe: async () => { window.notificationPushCalls.unsubscribed++; subscription = null; return true },
          }
          return subscription
        },
      },
      getNotifications: async () => [],
    }
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { getRegistration: async () => registration } })
    Object.defineProperty(window, 'Notification', { configurable: true, value: { permission: 'granted', requestPermission: async () => 'granted' } })
    if (!window.PushManager) window.PushManager = function () {}
  })
  await page.route('**/api/v1/**', async route => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    const method = request.method()
    const key = `${method} ${path}`
    const body = request.postDataJSON()
    state.requests.push({ method, path, body, authorization: request.headers().authorization })
    if (state.hold?.key === key) await state.hold.promise
    if (state.failures[key]) {
      const failure = state.failures[key]
      return route.fulfill({ status: failure.status || 403, contentType: 'application/json', body: JSON.stringify({ detail: failure.message }) })
    }
    let response
    if (path.endsWith('/notifications/unread_count/')) response = { unread_count: unread() }
    else if (path.endsWith('/notifications/push-config/')) response = { available: true, public_key: 'AQID' }
    else if (path.endsWith('/notifications/push-subscribe/')) response = { subscribed: true, recipient_user_id: '12' }
    else if (path.endsWith('/notifications/push-unsubscribe/')) response = { subscribed: false }
    else if (method === 'POST' && path.endsWith('/notifications/mark_as_read/')) {
      let updated = 0
      for (const notification of state.notifications) {
        if (body.notification_ids.map(String).includes(String(notification.id)) && !notification.is_read) {
          notification.is_read = true
          notification.status = 'READ'
          updated++
        }
      }
      response = { status: 'success', marked_read: updated, unread_count: unread() }
    } else if (method === 'POST' && path.endsWith('/notifications/mark_all_as_read/')) {
      const updated = unread()
      state.notifications.forEach(notification => { notification.is_read = true; notification.status = 'READ' })
      response = { status: 'success', marked_read: updated, unread_count: 0 }
    } else if (method === 'DELETE' && /\/notifications\/\d+\/$/.test(path)) {
      const id = path.match(/\/notifications\/(\d+)\/$/)[1]
      state.notifications = state.notifications.filter(notification => String(notification.id) !== id)
      return route.fulfill({ status: 204 })
    } else if (method === 'GET' && path.endsWith('/notifications/')) {
      response = { count: state.notifications.length, next: null, previous: null, results: state.notifications.map(notification => ({ ...notification })) }
    } else {
      throw new Error(`Unexpected notification fixture API request: ${key}`)
    }
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(response) })
  })
  return state
}

const bell = page => page.getByRole('button', { name: 'Notifications', exact: true })
const drawer = page => page.getByRole('dialog', { name: 'Notifications', exact: true })
const filter = (page, name) => drawer(page).getByRole('group', { name: 'Filter notifications' }).getByRole('button', { name: new RegExp(`^${name}(?:\\s|$)`) })

async function open(page) {
  await bell(page).click()
  await expect(drawer(page)).toBeVisible()
  await expect(drawer(page).getByRole('heading', { name: titles.leave, exact: true })).toBeVisible()
}

async function rowAction(page, title, action) {
  await drawer(page).getByRole('button', { name: `Actions for ${title}`, exact: true }).click()
  await drawer(page).getByRole('button', { name: action, exact: true }).click()
}

async function reopen(page) {
  await drawer(page).getByRole('button', { name: 'Close notifications', exact: true }).click()
  await bell(page).click()
  await expect(drawer(page)).toBeVisible()
}

test('read one and read all persist on the server after close/reopen and reload', async ({ page }) => {
  const state = await prepare(page)
  await page.goto('/tests/fixtures/notification-drawer.html')
  await expect(bell(page)).toHaveText('3')
  await open(page)
  await rowAction(page, titles.leave, 'Mark as read')
  await expect(bell(page)).toHaveText('2')
  expect(state.notifications.find(notification => notification.id === 101).is_read).toBe(true)
  await reopen(page)
  await drawer(page).getByRole('button', { name: `Actions for ${titles.leave}` }).click()
  await expect(drawer(page).getByRole('button', { name: 'Mark as read', exact: true })).toHaveCount(0)
  await drawer(page).getByRole('button', { name: `Actions for ${titles.leave}` }).click()
  await drawer(page).getByRole('button', { name: 'Mark all read', exact: true }).click()
  await expect(bell(page)).toHaveText('')
  expect(state.notifications.every(notification => notification.is_read)).toBe(true)
  await page.reload()
  await open(page)
  await filter(page, 'Unread').click()
  await expect(drawer(page).getByRole('heading', { name: titles.leave, exact: true })).toHaveCount(0)
  await expect(drawer(page).getByRole('button', { name: 'Mark all read', exact: true })).toBeDisabled()
  expect(state.requests.filter(request => request.method === 'POST').map(request => request.path)).toEqual(['/api/v1/notifications/mark_as_read/', '/api/v1/notifications/mark_all_as_read/'])
  expect(state.requests.find(request => request.method === 'POST').authorization).toBe('Bearer notification-test-token')
  expect(state.errors).toEqual([])
})

test('deleting read and unread notifications preserves the correct unread badge and persists', async ({ page }) => {
  const state = await prepare(page)
  await page.goto('/tests/fixtures/notification-drawer.html')
  await open(page)
  await rowAction(page, titles.system, 'Delete notification')
  await expect(drawer(page).getByRole('heading', { name: titles.system, exact: true })).toHaveCount(0)
  await expect(bell(page)).toHaveText('3')
  await rowAction(page, titles.leave, 'Delete notification')
  await expect(drawer(page).getByRole('heading', { name: titles.leave, exact: true })).toHaveCount(0)
  await expect(bell(page)).toHaveText('2')
  await reopen(page)
  await expect(drawer(page).getByRole('heading', { name: titles.purchase, exact: true })).toBeVisible()
  await expect(drawer(page).getByRole('heading', { name: titles.system, exact: true })).toHaveCount(0)
  await expect(drawer(page).getByRole('heading', { name: titles.leave, exact: true })).toHaveCount(0)
  await page.reload()
  await bell(page).click()
  await expect(drawer(page).getByRole('heading', { name: titles.purchase, exact: true })).toBeVisible()
  expect(state.notifications.map(notification => notification.id)).toEqual([102, 103, 105])
  await expect(bell(page)).toHaveText('2')
  expect(state.errors).toEqual([])
})

for (const operation of [
  { action: 'Mark as read', key: 'POST /api/v1/notifications/mark_as_read/', resultCount: '2' },
  { action: 'Delete notification', key: 'DELETE /api/v1/notifications/101/', resultCount: '2' },
  { action: 'Mark all read', key: 'POST /api/v1/notifications/mark_all_as_read/', resultCount: '' },
]) test(`${operation.action} failure preserves notifications and count, displays an error, and supports retry`, async ({ page }) => {
  const message = 'Your notification could not be updated. Please try again.'
  const state = await prepare(page, { failures: { [operation.key]: { message } } })
  await page.goto('/tests/fixtures/notification-drawer.html')
  await open(page)
  const act = () => operation.action === 'Mark all read'
    ? drawer(page).getByRole('button', { name: operation.action, exact: true }).click()
    : rowAction(page, titles.leave, operation.action)
  await act()
  await expect(drawer(page).getByRole('alert')).toContainText(/Unable to .*Your account is not allowed to perform this action/)
  await expect(drawer(page).getByRole('heading', { name: titles.leave, exact: true })).toBeVisible()
  await expect(bell(page)).toHaveText('3')
  expect(state.notifications).toHaveLength(5)
  expect(state.notifications.find(notification => notification.id === 101).is_read).toBe(false)
  delete state.failures[operation.key]
  await act()
  await expect(bell(page)).toHaveText(operation.resultCount)
  await expect(drawer(page).getByRole('alert')).toHaveCount(0)
  expect(state.errors).toEqual([])
})

test('pending writes disable duplicate row actions and read all until the response arrives', async ({ page }) => {
  let release
  const promise = new Promise(resolve => { release = resolve })
  const key = 'POST /api/v1/notifications/mark_as_read/'
  const state = await prepare(page, { hold: { key, promise } })
  await page.goto('/tests/fixtures/notification-drawer.html')
  await open(page)
  await rowAction(page, titles.leave, 'Mark as read')
  await expect.poll(() => state.requests.filter(request => `${request.method} ${request.path}` === key).length).toBe(1)
  await expect(drawer(page).getByRole('button', { name: `Actions for ${titles.leave}`, exact: true })).toBeDisabled()
  await expect(drawer(page).getByRole('button', { name: 'Mark all read', exact: true })).toBeDisabled()
  await expect(bell(page)).toHaveText('3')
  release()
  await expect(bell(page)).toHaveText('2')
  await expect(drawer(page).getByRole('button', { name: `Actions for ${titles.leave}`, exact: true })).toBeEnabled()
  expect(state.requests.filter(request => `${request.method} ${request.path}` === key)).toHaveLength(1)
  expect(state.errors).toEqual([])
})

test('delayed refresh responses cannot restore deleted notifications, unread state or the old badge', async ({ page }) => {
  const state = await prepare(page)
  await page.goto('/tests/fixtures/notification-drawer.html')
  await open(page)
  const oldNotifications = structuredClone(state.notifications)
  let release
  const pending = new Promise(resolve => { release = resolve })
  const held = new Set()
  const finished = new Set()
  await page.route('**/api/v1/notifications/**', async route => {
    const path = new URL(route.request().url()).pathname
    const endpoints = ['/api/v1/notifications/', '/api/v1/notifications/unread_count/']
    if (route.request().method() !== 'GET' || !endpoints.includes(path) || held.has(path)) return route.fallback()
    held.add(path)
    await pending
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(path.endsWith('/unread_count/')
      ? { unread_count: 3 } : { results: oldNotifications, count: oldNotifications.length, next: null }) })
    finished.add(path)
  })
  await drawer(page).getByRole('button', { name: 'Refresh notifications', exact: true }).click()
  await expect.poll(() => held.size).toBe(2)
  await rowAction(page, titles.leave, 'Mark as read')
  await expect(bell(page)).toHaveText('2')
  await rowAction(page, titles.purchase, 'Delete notification')
  await expect(bell(page)).toHaveText('1')
  release()
  await expect.poll(() => finished.size).toBe(2)
  await expect(drawer(page).getByRole('heading', { name: titles.purchase, exact: true })).toHaveCount(0)
  await filter(page, 'Unread').click()
  await expect(drawer(page).getByRole('heading', { name: titles.leave, exact: true })).toHaveCount(0)
  await expect(drawer(page).getByRole('heading', { name: titles.forecast, exact: true })).toBeVisible()
  await expect(bell(page)).toHaveText('1')
  expect(state.errors).toEqual([])
})

test('unread, approval and system filters combine with notification search', async ({ page }) => {
  const state = await prepare(page)
  await page.goto('/tests/fixtures/notification-drawer.html')
  await open(page)
  await filter(page, 'Unread').click()
  await expect(drawer(page).getByRole('heading', { name: titles.leave, exact: true })).toBeVisible()
  await expect(drawer(page).getByRole('heading', { name: titles.system, exact: true })).toHaveCount(0)
  await filter(page, 'Approvals').click()
  await expect(drawer(page).getByRole('heading', { name: titles.purchase, exact: true })).toBeVisible()
  await expect(drawer(page).getByRole('heading', { name: titles.forecast, exact: true })).toHaveCount(0)
  await filter(page, 'System').click()
  await expect(drawer(page).getByRole('heading', { name: titles.system, exact: true })).toBeVisible()
  await expect(drawer(page).getByRole('heading', { name: titles.leave, exact: true })).toHaveCount(0)
  await filter(page, 'All').click()
  await drawer(page).getByRole('button', { name: 'Search notifications', exact: true }).click()
  await drawer(page).getByRole('searchbox', { name: 'Search notifications', exact: true }).fill('Tanzeem')
  await expect(drawer(page).getByRole('heading', { name: titles.purchase, exact: true })).toBeVisible()
  await expect(drawer(page).getByRole('heading', { name: titles.leave, exact: true })).toHaveCount(0)
  await drawer(page).getByRole('searchbox', { name: 'Search notifications', exact: true }).fill('no such notification')
  await expect(drawer(page).getByRole('heading', { name: titles.purchase, exact: true })).toHaveCount(0)
  await expect(bell(page)).toHaveText('3')
  expect(state.requests.filter(request => request.method !== 'GET')).toEqual([])
  expect(state.errors).toEqual([])
})

test('preferences keep sound setting and enable or disable recipient-bound browser push', async ({ page }) => {
  const state = await prepare(page)
  await page.goto('/tests/fixtures/notification-drawer.html')
  await open(page)
  await drawer(page).getByRole('button', { name: 'Notification preferences', exact: true }).first().click()
  const sound = drawer(page).getByRole('switch', { name: 'Notification sounds', exact: true })
  await expect(sound).not.toBeChecked()
  await sound.click()
  await expect(sound).toBeChecked()
  expect(await page.evaluate(() => localStorage.getItem('radai_notification_sound_enabled'))).toBe('true')
  const push = drawer(page).getByRole('switch', { name: 'Browser push notifications', exact: true })
  await expect(push).not.toBeChecked()
  await push.click()
  await expect(push).toBeChecked()
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('radai_push_owner')))).toMatchObject({ userId: '12' })
  await push.click()
  await expect(push).not.toBeChecked()
  expect(await page.evaluate(() => localStorage.getItem('radai_push_owner'))).toBeNull()
  await reopen(page)
  await drawer(page).getByRole('button', { name: 'Notification preferences', exact: true }).first().click()
  await expect(sound).toBeChecked()
  expect(state.requests.filter(request => request.method === 'POST').map(request => request.path)).toEqual(['/api/v1/notifications/push-subscribe/', '/api/v1/notifications/push-unsubscribe/'])
  expect(state.errors).toEqual([])
})

test('opening a notification preserves navigation and persists its read state', async ({ page }) => {
  const state = await prepare(page)
  await page.goto('/tests/fixtures/notification-drawer.html')
  await open(page)
  await drawer(page).getByRole('link', { name: /Review request/ }).click()
  await expect(page.getByLabel('Current route')).toHaveText('/hr/leave?request=101')
  await expect(drawer(page)).toHaveCount(0)
  await expect(bell(page)).toHaveText('2')
  expect(state.notifications.find(notification => notification.id === 101).is_read).toBe(true)
  expect(state.errors).toEqual([])
})

test('desktop drawer supports keyboard dismissal, focus restoration and notification center navigation', async ({ page }, testInfo) => {
  const state = await prepare(page)
  await page.goto('/tests/fixtures/notification-drawer.html')
  await open(page)
  await expect(drawer(page)).toHaveAttribute('aria-modal', 'true')
  await expect.poll(() => drawer(page).evaluate(element => element.contains(document.activeElement))).toBe(true)
  await page.screenshot({ path: testInfo.outputPath('notification-drawer-desktop.png'), fullPage: true })
  await page.keyboard.press('Escape')
  await expect(drawer(page)).toHaveCount(0)
  await expect(bell(page)).toBeFocused()
  await bell(page).click()
  await drawer(page).getByRole('link', { name: /View notification center/ }).click()
  await expect(page.getByLabel('Current route')).toHaveText('/notifications')
  await expect(drawer(page)).toHaveCount(0)
  expect(state.errors).toEqual([])
})

test('mobile drawer fits the viewport with reachable actions and no horizontal clipping', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 375, height: 667 })
  const state = await prepare(page)
  await page.goto('/tests/fixtures/notification-drawer.html')
  await open(page)
  const bounds = await drawer(page).boundingBox()
  expect(bounds.x).toBeGreaterThanOrEqual(0)
  expect(bounds.y).toBeGreaterThanOrEqual(0)
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(376)
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(668)
  expect(await drawer(page).evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
  await expect(drawer(page).getByRole('button', { name: 'Close notifications', exact: true })).toBeInViewport()
  await expect(drawer(page).getByRole('link', { name: /View notification center/ })).toBeInViewport()
  await page.screenshot({ path: testInfo.outputPath('notification-drawer-mobile.png'), fullPage: true })
  await rowAction(page, titles.leave, 'Mark as read')
  await expect(bell(page)).toHaveText('2')
  await drawer(page).getByRole('button', { name: 'Close notifications', exact: true }).click()
  await expect(bell(page)).toBeFocused()
  expect(state.errors).toEqual([])
})

test('last-row actions stay inside the scrolling drawer and filtered row removal preserves keyboard focus', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 })
  const state = await prepare(page)
  await page.goto('/tests/fixtures/notification-drawer.html')
  await open(page)
  await drawer(page).getByRole('button', { name: `Actions for ${titles.supplier}`, exact: true }).click()
  const deleteAction = drawer(page).getByRole('button', { name: 'Delete notification', exact: true })
  await expect(deleteAction).toBeInViewport()
  expect(await deleteAction.evaluate(element => {
    const rect = element.getBoundingClientRect()
    const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)
    return element.contains(hit)
  })).toBe(true)
  await deleteAction.click()
  await expect(drawer(page).getByRole('heading', { name: titles.supplier, exact: true })).toHaveCount(0)
  await expect.poll(() => drawer(page).evaluate(element => element.contains(document.activeElement))).toBe(true)
  await filter(page, 'Unread').click()
  await rowAction(page, titles.leave, 'Mark as read')
  await expect(drawer(page).getByRole('heading', { name: titles.leave, exact: true })).toHaveCount(0)
  await expect.poll(() => drawer(page).evaluate(element => element.contains(document.activeElement))).toBe(true)
  await page.keyboard.press('Tab')
  await expect.poll(() => drawer(page).evaluate(element => element.contains(document.activeElement))).toBe(true)
  expect(state.errors).toEqual([])
})
