import { test, expect } from '@playwright/test'

const now = new Date('2026-09-24T12:00:00Z')
const firstTitle = 'Purchase Order RAD-PRJ-PUR-0480_2026 created'
const relatedTitle = 'Purchase Order RAD-PRJ-PUR-0480_2026 ready for review'
const sampleNotifications = () => [
  { id: 101, title: firstTitle, message: 'Purchase Order RAD-PRJ-PUR-0480_2026 has been created and is available for review.', category_name: 'PROCUREMENT', priority: 'HIGH', is_read: false, age: 1, metadata: { entity_type: 'purchase_order', po_id: 'po-1', entity_id: 'po-1' } },
  { id: 102, title: relatedTitle, message: 'Review the procurement document.', category_name: 'INFO', priority: 'HIGH', is_read: true, age: 2, metadata: { entity_type: 'purchase_order', po_id: 'po-1', entity_id: 'po-1' } },
  { id: 103, title: 'Purchase Order RAD-PRJ-PUR-0481_2026 created', message: 'Another purchase order needs your attention.', category_name: 'PROCUREMENT', priority: 'URGENT', is_read: false, age: 3, metadata: { entity_type: 'purchase_order', po_id: 'po-2', entity_id: 'po-2' } },
  { id: 104, title: 'Maintenance completed', message: 'The scheduled service is available.', category_name: 'SYSTEM', priority: 'NORMAL', is_read: true, age: 4 },
  { id: 105, title: 'Leave request updated', message: 'Ten days requested; pending HR approval.', category_name: 'APPROVAL', priority: 'NORMAL', is_read: true, age: 48, action_url: '/hr/leave?request=105' },
  { id: 106, title: 'Employee profile updated', message: 'The employee profile was updated.', category_name: 'USER', priority: 'LOW', is_read: true, age: 49 },
  { id: 107, title: 'Recommendation requires your approval', message: 'Review the submitted recommendation.', category_name: 'APPROVAL', priority: 'CRITICAL', is_read: true, age: 240, metadata: { entity_type: 'purchase_recommendation', pr_id: 'pr-1', entity_id: 'pr-1' } },
  { id: 108, title: 'Project forecast changed', message: 'A permitted project forecast has changed.', category_name: 'PROJECT', priority: 'URGENT', is_read: true, age: 241, action_url: '/projects/42' },
  ...Array.from({ length: 6 }, (_, index) => ({ id: 109 + index, title: `Document ${index + 1} available`, message: `Document update ${index + 1}.`, category_name: 'DOCUMENT', priority: 'NORMAL', is_read: true, age: 242 + index })),
].map(({ age, ...item }) => ({ metadata: {}, ...item, created_at: new Date(now.getTime() - age * 3600000).toISOString() }))

async function prepare(page, options = {}) {
  const state = { notifications: sampleNotifications(), requests: [], errors: [], failures: {}, hold: null, ...options }
  page.on('pageerror', error => state.errors.push(error.message))
  await page.clock.install({ time: now })
  await page.addInitScript(() => {
    localStorage.setItem('radai_access_token', 'notification-center-user-12')
    localStorage.setItem('radai_user_data', JSON.stringify({ id: 12, email: 'recipient@example.test' }))
  })
  const unread = () => state.notifications.filter(item => !item.is_read).length
  await page.route('**/api/v1/**', async route => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname
    const method = request.method()
    const key = `${method} ${path}`
    const body = request.postDataJSON()
    state.requests.push({ method, path, body, query: url.search, authorization: request.headers().authorization })
    if (state.hold?.key === key) await state.hold.promise
    if (state.failures[`${key}${url.search}`] || state.failures[key]) {
      const failure = state.failures[`${key}${url.search}`] || state.failures[key]
      return route.fulfill({ status: failure.status || 403, contentType: 'application/json', body: JSON.stringify({ detail: failure.message || 'Action unavailable.' }) })
    }
    let response
    if (path.endsWith('/notifications/stats/')) response = {
      total_count: state.notifications.length, unread_count: unread(), read_count: state.notifications.length - unread(),
      by_priority: state.notifications.reduce((result, item) => ({ ...result, [item.priority]: (result[item.priority] || 0) + 1 }), {}),
      by_category: state.notifications.reduce((result, item) => ({ ...result, [item.category_name]: (result[item.category_name] || 0) + 1 }), {}),
    }
    else if (path.endsWith('/notifications/categories/')) response = [...new Set(state.notifications.map(item => item.category_name))].map((name, index) => ({ id: index + 1, name, is_active: true }))
    else if (path.endsWith('/notifications/unread_count/')) response = { unread_count: unread() }
    else if (method === 'GET' && path.endsWith('/notifications/')) {
      const pageNumber = Number(url.searchParams.get('page') || 1)
      state.onListRequest?.(pageNumber, state)
      const serverPageSize = state.serverPageSize || state.notifications.length || 1
      const offset = (pageNumber - 1) * serverPageSize
      response = { count: state.countOverride ?? state.notifications.length, next: offset + serverPageSize < state.notifications.length ? `/api/v1/notifications/?page=${pageNumber + 1}` : null, previous: null, results: structuredClone(state.notifications.slice(offset, offset + serverPageSize)), ...state.listResponseOverride }
    } else if (method === 'POST' && path.endsWith('/notifications/mark_as_read/')) {
      let changed = 0
      state.notifications.forEach(item => {
        if (body.notification_ids.map(String).includes(String(item.id)) && !item.is_read) { item.is_read = true; changed++ }
      })
      response = { status: 'success', marked_read: changed, unread_count: unread() }
    } else if (method === 'POST' && path.endsWith('/notifications/mark_all_as_read/')) {
      const changed = unread()
      state.notifications.forEach(item => { item.is_read = true })
      response = { status: 'success', marked_read: changed, unread_count: 0 }
    } else if (method === 'DELETE' && /\/notifications\/\d+\/$/.test(path)) {
      const id = path.match(/\/notifications\/(\d+)\/$/)[1]
      state.notifications = state.notifications.filter(item => String(item.id) !== id)
      return route.fulfill({ status: 204 })
    } else if (method === 'GET' && path.endsWith('/procurement/orders/po-1/')) {
      response = { id: 'po-1', po_number: 'RAD-PRJ-PUR-0480_2026', title: 'Synthetic purchase order', status: 'draft', can_approve: false, items: [], attachments: [], currency: 'AED', subtotal: '0.00', total_amount: '0.00' }
    } else throw new Error(`Unexpected API request in isolated notification fixture: ${key}`)
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(response) })
  })
  await page.goto('/tests/fixtures/notification-center.html')
  return state
}

const views = page => page.getByRole('group', { name: 'Notification views' })
const rows = page => page.getByRole('button', { name: /^View notification:/ })
const row = (page, title) => page.getByRole('button', { name: `View notification: ${title}`, exact: true })
const details = page => page.getByRole('complementary', { name: 'Notification details' })
const stat = (page, label, count) => page.getByRole('button', { name: `${label} notifications: ${count}`, exact: true })
const writes = state => state.requests.filter(request => request.method !== 'GET')
async function ready(page) { await expect(row(page, firstTitle)).toBeVisible() }

test('desktop inbox matches the master-detail layout with real totals, date groups and selection', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1536, height: 900 })
  const state = await prepare(page)
  await ready(page)
  await expect(page.getByRole('heading', { name: 'Notification Center', exact: true })).toBeVisible()
  await expect(stat(page, 'All', 14)).toBeVisible()
  await expect(stat(page, 'Unread', 2)).toBeVisible()
  await expect(stat(page, 'Urgent', 5)).toBeVisible()
  await expect(stat(page, 'Approval', 2)).toBeVisible()
  await expect(rows(page)).toHaveCount(10)
  await expect(page.getByText('Today', { exact: true })).toBeVisible()
  await expect(page.getByText('Earlier this week', { exact: true })).toBeVisible()
  await expect(page.getByText('Older', { exact: true })).toBeVisible()
  await row(page, firstTitle).click()
  await expect(row(page, firstTitle)).toHaveAttribute('aria-pressed', 'true')
  await expect(details(page).getByRole('heading', { name: firstTitle, exact: true })).toBeVisible()
  const rowBox = await row(page, firstTitle).boundingBox()
  const detailBox = await details(page).boundingBox()
  expect(detailBox.x).toBeGreaterThan(rowBox.x + rowBox.width)
  await expect(details(page).getByRole('button', { name: 'Open purchase order', exact: true })).toBeInViewport()
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeInViewport()
  expect(writes(state)).toEqual([])
  await page.screenshot({ path: testInfo.outputPath('notification-center-desktop.png'), fullPage: true })
  expect(state.errors).toEqual([])
})

test('tabs combine with search and category without changing global counts', async ({ page }) => {
  const state = await prepare(page)
  await ready(page)
  await views(page).getByRole('button', { name: 'Unread', exact: true }).click()
  await expect(rows(page)).toHaveCount(2)
  await views(page).getByRole('button', { name: 'Urgent', exact: true }).click()
  await expect(rows(page)).toHaveCount(5)
  await views(page).getByRole('button', { name: 'Approvals', exact: true }).click()
  await expect(rows(page)).toHaveCount(2)
  await page.getByRole('searchbox', { name: 'Search notifications' }).fill('Ten days')
  await expect(rows(page)).toHaveCount(1)
  await expect(row(page, 'Leave request updated')).toBeVisible()
  await page.getByRole('searchbox', { name: 'Search notifications' }).fill('')
  await views(page).getByRole('button', { name: 'All', exact: true }).click()
  await page.getByRole('combobox', { name: 'Category', exact: true }).selectOption({ label: 'PROCUREMENT' })
  await expect(rows(page)).toHaveCount(2)
  await expect(stat(page, 'All', 14)).toBeVisible()
  await expect(stat(page, 'Unread', 2)).toBeVisible()
  expect(writes(state)).toEqual([])
  expect(state.errors).toEqual([])
})

test('sort and pagination use actual filtered records and reset after changing filters', async ({ page }) => {
  await prepare(page)
  await ready(page)
  await expect(rows(page).first()).toHaveAccessibleName(`View notification: ${firstTitle}`)
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(rows(page)).toHaveCount(4)
  await expect(row(page, 'Document 6 available')).toBeVisible()
  await page.getByRole('combobox', { name: 'Sort notifications' }).selectOption('oldest')
  await expect(rows(page)).toHaveCount(10)
  await expect(rows(page).first()).toHaveAccessibleName('View notification: Document 6 available')
  await page.getByRole('searchbox', { name: 'Search notifications' }).fill('Document 6')
  await expect(rows(page)).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeDisabled()
})

test('related updates require the same canonical source and opening a PO keeps existing preview authority', async ({ page }) => {
  const state = await prepare(page)
  await ready(page)
  await row(page, firstTitle).click()
  await expect(details(page).getByText(relatedTitle, { exact: true })).toBeVisible()
  await expect(details(page).getByText('Purchase Order RAD-PRJ-PUR-0481_2026 created', { exact: true })).toHaveCount(0)
  await details(page).getByRole('button', { name: 'Open purchase order', exact: true }).click()
  const preview = page.getByRole('dialog', { name: /Purchase Order.*RAD-PRJ-PUR-0480_2026/ })
  await expect(preview).toBeVisible()
  await expect(preview.getByRole('button', { name: 'Approve', exact: true })).toHaveCount(0)
  await expect(page.getByLabel('Current route')).toHaveText('/notifications?preview=po&id=po-1')
  expect(state.notifications.find(item => item.id === 101).is_read).toBe(true)
  expect(writes(state).map(request => request.path)).toEqual(['/api/v1/notifications/mark_as_read/'])
  expect(state.errors).toEqual([])
})

test('explicit read, dismiss and read-all persist and update totals only after successful responses', async ({ page }) => {
  const state = await prepare(page)
  await ready(page)
  await row(page, firstTitle).click()
  await details(page).getByRole('button', { name: 'Mark as read', exact: true }).click()
  await expect(stat(page, 'Unread', 1)).toBeVisible()
  await details(page).getByRole('button', { name: 'Dismiss', exact: true }).click()
  await expect(row(page, firstTitle)).toHaveCount(0)
  await expect(stat(page, 'All', 13)).toBeVisible()
  await page.getByRole('button', { name: 'Mark all as read', exact: true }).click()
  await expect(stat(page, 'Unread', 0)).toBeVisible()
  await page.reload()
  await expect(row(page, relatedTitle)).toBeVisible()
  await expect(row(page, firstTitle)).toHaveCount(0)
  await expect(stat(page, 'All', 13)).toBeVisible()
  await expect(stat(page, 'Unread', 0)).toBeVisible()
  expect(writes(state).map(request => request.path)).toEqual(['/api/v1/notifications/mark_as_read/', '/api/v1/notifications/101/', '/api/v1/notifications/mark_all_as_read/'])
  expect(state.errors).toEqual([])
})

for (const action of [
  { name: 'Mark as read', key: 'POST /api/v1/notifications/mark_as_read/', count: 1 },
  { name: 'Dismiss', key: 'DELETE /api/v1/notifications/101/', count: 1 },
  { name: 'Mark all as read', key: 'POST /api/v1/notifications/mark_all_as_read/', count: 0 },
]) test(`${action.name} failure preserves selection, records and search and allows retry`, async ({ page }) => {
  const state = await prepare(page, { failures: { [action.key]: { status: 403 } } })
  await ready(page)
  await page.getByRole('searchbox', { name: 'Search notifications' }).fill('0480')
  await row(page, firstTitle).click()
  const control = action.name === 'Mark all as read' ? page.getByRole('button', { name: action.name, exact: true }) : details(page).getByRole('button', { name: action.name, exact: true })
  await control.click()
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(row(page, firstTitle)).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('searchbox', { name: 'Search notifications' })).toHaveValue('0480')
  await expect(stat(page, 'Unread', 2)).toBeVisible()
  expect(state.notifications).toHaveLength(14)
  delete state.failures[action.key]
  await control.click()
  await expect(stat(page, 'Unread', action.count)).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
  expect(state.errors).toEqual([])
})

test('pending action prevents duplicate writes and retains unread count until committed', async ({ page }) => {
  let release
  const promise = new Promise(resolve => { release = resolve })
  const key = 'POST /api/v1/notifications/mark_as_read/'
  const state = await prepare(page, { hold: { key, promise } })
  await ready(page)
  await row(page, firstTitle).click()
  await details(page).getByRole('button', { name: 'Mark as read', exact: true }).click()
  await expect.poll(() => writes(state).length).toBe(1)
  await expect(details(page).getByRole('button', { name: /Mark as read|Updating/ }).first()).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Mark all as read', exact: true })).toBeDisabled()
  await expect(stat(page, 'Unread', 2)).toBeVisible()
  release()
  await expect(stat(page, 'Unread', 1)).toBeVisible()
  expect(writes(state)).toHaveLength(1)
})

test('empty and no-match states retain useful controls and never invent counts', async ({ page }) => {
  const state = await prepare(page, { notifications: [] })
  await expect(stat(page, 'All', 0)).toBeVisible()
  await expect(rows(page)).toHaveCount(0)
  await expect(page.getByText(/all caught up/i).first()).toBeVisible()
  state.notifications = sampleNotifications()
  await page.reload()
  await ready(page)
  await page.getByRole('searchbox', { name: 'Search notifications' }).fill('unknown search phrase')
  await expect(rows(page)).toHaveCount(0)
  await expect(page.getByRole('searchbox', { name: 'Search notifications' })).toHaveValue('unknown search phrase')
  await expect(stat(page, 'All', 14)).toBeVisible()
})

test('loading and denied inbox states do not render confidential notification content', async ({ page }) => {
  let release
  const promise = new Promise(resolve => { release = resolve })
  const key = 'GET /api/v1/notifications/'
  const state = await prepare(page, { hold: { key, promise }, failures: { [key]: { status: 403 } } })
  await expect(page.getByText(/Loading notifications/i)).toBeVisible()
  await expect(rows(page)).toHaveCount(0)
  release()
  await expect(page.getByRole('alert')).toContainText(/permission|allowed/i)
  await expect(rows(page)).toHaveCount(0)
  await expect(page.getByText(firstTitle, { exact: true })).toHaveCount(0)
  expect(writes(state)).toEqual([])
})

test('account change clears old content and ignores a delayed old-account write', async ({ page }) => {
  let release
  const promise = new Promise(resolve => { release = resolve })
  const state = await prepare(page, { hold: { key: 'POST /api/v1/notifications/mark_as_read/', promise } })
  await ready(page)
  await row(page, firstTitle).click()
  await details(page).getByRole('button', { name: 'Mark as read', exact: true }).click()
  await expect.poll(() => writes(state).length).toBe(1)
  state.notifications = [{ id: 999, title: 'New account notification', message: 'Only this recipient can view this item.', category_name: 'INFO', priority: 'NORMAL', is_read: false, created_at: now.toISOString(), metadata: {} }]
  await page.evaluate(() => window.setNotificationFixtureActor({ id: 13, email: 'second@example.test', first_name: 'Other', last_name: 'Recipient' }))
  await expect(row(page, 'New account notification')).toBeVisible()
  await expect(row(page, firstTitle)).toHaveCount(0)
  release()
  await expect(stat(page, 'Unread', 1)).toBeVisible()
  await expect(stat(page, 'All', 1)).toBeVisible()
  await expect(row(page, firstTitle)).toHaveCount(0)
  expect(state.errors).toEqual([])
})

test('keyboard selection and details close return focus without recording a read', async ({ page }) => {
  const state = await prepare(page)
  await ready(page)
  await row(page, firstTitle).focus()
  await page.keyboard.press('Enter')
  await expect(details(page)).toBeVisible()
  await details(page).getByRole('button', { name: 'Close notification details' }).click()
  await expect(details(page)).toHaveCount(0)
  await expect(row(page, firstTitle)).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(details(page)).toBeVisible()
  expect(writes(state)).toEqual([])
})

test('mobile inbox and selected details stay readable without horizontal page overflow', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const state = await prepare(page)
  await ready(page)
  await row(page, firstTitle).click()
  await expect(details(page)).toBeVisible()
  await details(page).getByRole('button', { name: 'Dismiss', exact: true }).scrollIntoViewIfNeeded()
  await expect(details(page).getByRole('button', { name: 'Dismiss', exact: true })).toBeInViewport()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath('notification-center-mobile.png'), fullPage: true })
  expect(state.errors).toEqual([])
})

test('server pagination loads the complete inbox before calculating filters and totals', async ({ page }) => {
  const state = await prepare(page, { serverPageSize: 7 })
  await ready(page)
  await expect(stat(page, 'All', 14)).toBeVisible()
  await expect(stat(page, 'Unread', 2)).toBeVisible()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(row(page, 'Document 6 available')).toBeVisible()
  expect(state.requests.filter(request => request.path === '/api/v1/notifications/').map(request => new URLSearchParams(request.query).get('page'))).toEqual([null, '2'])
  expect(state.errors).toEqual([])
})

test('a terminal page with a stale server count loads actual notifications after one bounded retry', async ({ page }) => {
  const state = await prepare(page, { countOverride: 15 })
  await ready(page)
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(stat(page, 'All', 14)).toBeVisible()
  await expect(stat(page, 'Unread', 2)).toBeVisible()
  await expect(rows(page)).toHaveCount(10)
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(rows(page)).toHaveCount(4)
  await expect(row(page, 'Document 6 available')).toBeVisible()
  expect(state.requests.filter(request => request.path === '/api/v1/notifications/').map(request => new URLSearchParams(request.query).get('page'))).toEqual([null, null])
  expect(writes(state)).toEqual([])
  expect(state.errors).toEqual([])
})

test('notifications arriving between pages are recovered by a second traversal with actual totals', async ({ page }) => {
  let arrived = false
  const incomingTitle = 'New notification received during loading'
  const state = await prepare(page, {
    serverPageSize: 7,
    onListRequest: (pageNumber, fixture) => {
      if (pageNumber !== 2 || arrived) return
      arrived = true
      fixture.notifications.unshift({ id: 200, title: incomingTitle, message: 'A synthetic update arrived between page requests.', category_name: 'INFO', priority: 'NORMAL', is_read: false, created_at: now.toISOString(), metadata: {} })
    },
  })
  await ready(page)
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(stat(page, 'All', 15)).toBeVisible()
  await expect(stat(page, 'Unread', 3)).toBeVisible()
  await expect(row(page, incomingTitle)).toBeVisible()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(rows(page)).toHaveCount(5)
  await expect(row(page, 'Document 6 available')).toBeVisible()
  expect(state.requests.filter(request => request.path === '/api/v1/notifications/').map(request => new URLSearchParams(request.query).get('page'))).toEqual([null, '2', '3', null, '2', '3'])
  expect(writes(state)).toEqual([])
  expect(state.errors).toEqual([])
})

test('priority filter clears cleanly and a row menu action persists without opening a source record', async ({ page }) => {
  const state = await prepare(page)
  await ready(page)
  await page.getByRole('button', { name: 'Filters', exact: true }).click()
  await page.getByRole('combobox', { name: 'Priority', exact: true }).selectOption('CRITICAL')
  await expect(rows(page)).toHaveCount(1)
  await expect(row(page, 'Recommendation requires your approval')).toBeVisible()
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click()
  await expect(rows(page)).toHaveCount(10)
  await page.getByRole('button', { name: `Actions for ${firstTitle}`, exact: true }).click()
  await page.locator('#notification-actions-101').getByRole('button', { name: 'Mark as read', exact: true }).click()
  await expect(stat(page, 'Unread', 1)).toBeVisible()
  await expect(page.getByLabel('Current route')).toHaveText('/notifications')
  expect(writes(state).map(request => request.path)).toEqual(['/api/v1/notifications/mark_as_read/'])
  expect(state.errors).toEqual([])
})

test('a cyclic next-page link preserves the previous inbox and allows retry', async ({ page }) => {
  const state = await prepare(page)
  await ready(page)
  await row(page, firstTitle).click()
  await page.getByRole('button', { name: 'Filters', exact: true }).click()
  state.listResponseOverride = { next: '/api/v1/notifications/?page=1' }
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('The complete notification inbox could not be loaded')
  await expect(stat(page, 'All', 14)).toBeVisible()
  await expect(row(page, firstTitle)).toHaveAttribute('aria-pressed', 'true')
  delete state.listResponseOverride
  await page.getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(stat(page, 'All', 14)).toBeVisible()
  expect(writes(state)).toEqual([])
  expect(state.errors).toEqual([])
})

test('a malformed refresh retains rows, selection and search until a successful retry', async ({ page }) => {
  const state = await prepare(page)
  await ready(page)
  await page.getByRole('searchbox', { name: 'Search notifications' }).fill('0480')
  await row(page, firstTitle).click()
  await page.getByRole('button', { name: 'Filters', exact: true }).click()
  state.listResponseOverride = { results: null }
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('The complete notification inbox could not be loaded')
  await expect(stat(page, 'All', 14)).toBeVisible()
  await expect(rows(page)).toHaveCount(2)
  await expect(row(page, firstTitle)).toHaveAttribute('aria-pressed', 'true')
  await expect(details(page).getByRole('heading', { name: firstTitle, exact: true })).toBeVisible()
  await expect(page.getByRole('searchbox', { name: 'Search notifications' })).toHaveValue('0480')
  delete state.listResponseOverride
  await page.getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(stat(page, 'All', 14)).toBeVisible()
  await expect(rows(page)).toHaveCount(2)
  await expect(row(page, firstTitle)).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('searchbox', { name: 'Search notifications' })).toHaveValue('0480')
  expect(writes(state)).toEqual([])
  expect(state.errors).toEqual([])
})

test('last-row actions remain reachable inside the scrolling inbox and Escape restores focus', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 700 })
  const state = await prepare(page)
  await ready(page)
  await page.getByRole('button', { name: 'Actions for Document 2 available', exact: true }).click()
  const dismiss = page.locator('#notification-actions-110').getByRole('button', { name: 'Dismiss', exact: true })
  await expect(dismiss).toBeInViewport()
  expect(await dismiss.evaluate(element => {
    const box = element.getBoundingClientRect()
    return element.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2))
  })).toBe(true)
  await page.keyboard.press('Escape')
  await expect(dismiss).toHaveCount(0)
  await expect(row(page, 'Document 2 available')).toBeFocused()
  expect(writes(state)).toEqual([])
})
