import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const collection = '/api/v1/sales/mailbox-connections/'
const recordId = '246ed81a-f7fb-4075-8b68-36c98aac413d'
const testPath = `${collection}${recordId}/test-connection/`
const syncPath = `${collection}${recordId}/configure-sync/`
const messagesPath = `${collection}${recordId}/messages/`
const privateDetail = 'PRIVATE_PROVIDER_DIAGNOSTIC_DO_NOT_DISPLAY_5480'
const values = {
  name: 'Sales regional shared mailbox',
  mailbox_address: 'sales@example.test',
  tenant_id: '59c13c24-c08a-4308-8b63-45fb9a810bc2',
  client_id: '1d8efbeb-9c08-4e0d-941a-5bdc1c2de24f',
}
const profile = (overrides = {}) => ({
  id: 900,
  user: { id: 11, email: 'administrator@example.test' },
  roles: [{ code: 'ict_admin', is_active: true }],
  module_actions: { sales_email_intake: ['read', 'create', 'update'] },
  ...overrides,
})
const connection = (overrides = {}) => ({
  id: recordId, ...values, auth_mode: 'application', enabled: false,
  secret_configured: true, last_status: 'not_tested', last_health_check_at: null,
  created_by: 11, sync: { enabled: false, status: 'not_configured' },
  ...overrides,
})
const queued = () => ({
  enabled: true,
  sync: {
    enabled: true, status: 'queued', initial_sync_complete: false,
    saved_count: 0, pending_count: 0, failed_count: 0,
    last_successful_sync_at: null,
  },
})
const verified = () => ({ connected: true, mailbox_address: values.mailbox_address, total_item_count: 12, unread_item_count: 2 })
const deferred = () => {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}
const dialog = page => page.getByRole('dialog', { name: 'Add shared mailbox', exact: true })
const addButton = page => page.getByRole('button', { name: 'Add shared mailbox', exact: true })
const posts = (state, path) => state.requests.filter(request => request.method === 'POST' && request.path === path)

async function prepare(page, options = {}) {
  const session = {
    authenticated: true,
    authUser: profile(),
    profile: profile(),
    ...options.session,
  }
  const state = {
    requests: [], unexpected: [], errors: [], connections: [],
    listResponse: null,
    createResponse: { status: 201, body: connection() },
    testResponse: { status: 200, body: verified() },
    syncResponse: { status: 200, body: queued() },
    ...options,
  }
  page.on('pageerror', error => state.errors.push(error.message))
  await page.addInitScript(({ session }) => {
    window.salesMailboxSetupSession = session
    window.salesMailboxSetupDiagnostics = []
    for (const method of ['log', 'warn', 'error', 'info']) {
      const original = console[method].bind(console)
      console[method] = (...args) => {
        window.salesMailboxSetupDiagnostics.push(args.map(value => {
          try { return JSON.stringify(value) ?? String(value) } catch { return String(value) }
        }).join(' '))
        original(...args)
      }
    }
    if (session.authenticated && session.authUser) {
      localStorage.setItem('radai_access_token', 'mailbox-setup-fixture-11')
      localStorage.setItem('radai_user_data', JSON.stringify(session.authUser))
    }
  }, { session })
  await page.route('**/*', async route => {
    const request = route.request()
    const url = new URL(request.url())
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) {
      state.unexpected.push(`External request: ${url.origin}`)
      return route.abort()
    }
    if (!url.pathname.startsWith('/api/v1/')) return route.continue()
    const method = request.method()
    const raw = request.postData()
    state.requests.push({ path: url.pathname, method, body: raw ? request.postDataJSON() : null, query: url.search })
    let response
    if (method === 'GET' && url.pathname === collection) {
      response = state.listResponse || { status: 200, body: { count: state.connections.length, results: structuredClone(state.connections), next: null } }
    } else if (method === 'POST' && url.pathname === collection) {
      response = { ...state.createResponse, body: structuredClone(state.createResponse.body) }
      if (response.status === 201 && response.body?.id && response.body.auth_mode === 'application') {
        state.connections = [...state.connections.filter(row => row.id !== response.body.id), response.body]
      }
    } else if (method === 'POST' && url.pathname === testPath) {
      response = { ...state.testResponse, body: structuredClone(state.testResponse.body) }
    } else if (method === 'PATCH' && url.pathname === `${collection}${recordId}/`) {
      response = state.patchResponse || { status: 200, body: connection(request.postDataJSON()) }
    } else if (method === 'POST' && url.pathname === syncPath) {
      response = { ...state.syncResponse, body: structuredClone(state.syncResponse.body) }
    } else if (method === 'GET' && url.pathname === messagesPath) {
      response = { status: 200, body: { mailbox_address: values.mailbox_address, results: [], next_cursor: null } }
    } else {
      state.unexpected.push(`${method} ${url.pathname}`)
      response = { status: 405, body: { detail: 'Unexpected fixture request.' } }
    }
    if (response.hold) await response.hold.promise
    if (response.abort) return route.abort(response.abort)
    return route.fulfill({ status: response.status ?? 200, json: response.body })
  })
  await page.goto('/tests/fixtures/sales-shared-mailbox-setup.html')
  await expect(page.getByRole('region', { name: 'Email Intake workspace', exact: true })).toBeVisible()
  return state
}

async function fill(page, overrides = {}) {
  const data = { ...values, ...overrides }
  await dialog(page).getByLabel('Connection name', { exact: true }).fill(data.name)
  await dialog(page).getByLabel('Mailbox address', { exact: true }).fill(data.mailbox_address)
  await dialog(page).getByLabel('Directory (tenant) ID', { exact: true }).fill(data.tenant_id)
  await dialog(page).getByLabel('Application (client) ID', { exact: true }).fill(data.client_id)
}

async function openFilled(page, overrides) {
  await addButton(page).click()
  await expect(dialog(page)).toBeVisible()
  await fill(page, overrides)
}

async function save(page) {
  await dialog(page).getByRole('button', { name: 'Save mailbox', exact: true }).click()
  await expect(dialog(page).getByRole('button', { name: 'Test connection', exact: true })).toBeVisible()
}

async function assertSafe(page, state) {
  expect(state.errors).toEqual([])
  expect(state.unexpected).toEqual([])
  await expect(page.locator('body')).not.toContainText(privateDetail)
  const diagnostics = await page.evaluate(() => window.salesMailboxSetupDiagnostics.join('\n'))
  expect(diagnostics).not.toContain(privateDetail)
  expect(state.requests.every(request => !request.path.includes('connect-my-outlook') && !request.path.includes('convert-to-opportunity'))).toBe(true)
}

for (const role of ['admin', 'super_admin', 'ict_admin']) {
  test(`${role} with current matching intake grants can open the blank shared mailbox setup`, async ({ page }) => {
    const state = await prepare(page, { session: { profile: profile({ roles: [{ code: role, is_active: true }] }) } })
    await expect(page.getByText('No shared mailbox is available to your account.', { exact: true })).toBeVisible()
    await addButton(page).click()
    for (const name of ['Connection name', 'Mailbox address', 'Directory (tenant) ID', 'Application (client) ID']) {
      await expect(dialog(page).getByLabel(name, { exact: true })).toHaveValue('')
    }
    await expect(dialog(page).getByLabel(/secret|password/i)).toHaveCount(0)
    expect(state.requests.every(request => request.method === 'GET')).toBe(true)
    await assertSafe(page, state)
  })
}

for (const scenario of [
  { name: 'ordinary Sales user', current: profile({ roles: [{ code: 'employee', is_active: true }] }) },
  { name: 'staff flag without administrator role', current: profile({ roles: [], user: { id: 11, is_staff: true } }) },
  { name: 'administrator missing create', current: profile({ module_actions: { sales_email_intake: ['read', 'update'] } }) },
  { name: 'administrator missing read', current: profile({ module_actions: { sales_email_intake: ['create', 'update'] } }) },
  { name: 'administrator without resolved grants', current: profile({ module_actions: undefined }) },
  { name: 'unloaded profile', current: null },
  { name: 'profile from another account', current: profile({ user: { id: 77 } }) },
]) {
  test(`${scenario.name} cannot start application mailbox configuration`, async ({ page }) => {
    const state = await prepare(page, { session: { profile: scenario.current } })
    await expect(page.getByText('No shared mailbox is available to your account.', { exact: true })).toBeVisible()
    await expect(addButton(page)).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Mailbox setup', exact: true })).toHaveCount(0)
    expect(state.requests.every(request => request.method === 'GET')).toBe(true)
    await assertSafe(page, state)
  })
}

test('saving sends reviewed application identity once and Done refreshes and selects the saved mailbox without testing or syncing', async ({ page }) => {
  const hold = deferred()
  const state = await prepare(page, { createResponse: { status: 201, body: connection(), hold } })
  await openFilled(page, { name: ` ${values.name} `, mailbox_address: ' SALES@EXAMPLE.TEST ', tenant_id: ` ${values.tenant_id} `, client_id: ` ${values.client_id} ` })
  const saveButton = dialog(page).getByRole('button', { name: /^(Save mailbox|Saving…|Saving\.\.\.)$/ })
  await saveButton.click()
  await expect.poll(() => posts(state, collection).length).toBe(1)
  await expect(saveButton).toBeDisabled()
  await page.keyboard.press('Enter')
  expect(posts(state, collection)).toHaveLength(1)
  hold.resolve()
  await expect(dialog(page).getByRole('button', { name: 'Test connection', exact: true })).toBeVisible()
  expect(posts(state, collection)[0].body).toEqual({ ...values, auth_mode: 'application', enabled: false })
  expect(posts(state, testPath)).toHaveLength(0)
  expect(posts(state, syncPath)).toHaveLength(0)
  await dialog(page).getByRole('button', { name: 'Done', exact: true }).click()
  await expect(dialog(page)).toHaveCount(0)
  await expect(page.getByText('No emails in this mailbox.', { exact: true })).toBeVisible()
  expect(state.requests.filter(request => request.method === 'GET' && request.path === collection).length).toBeGreaterThanOrEqual(2)
  expect(state.requests.some(request => request.path === messagesPath)).toBe(true)
  expect(posts(state, collection)).toHaveLength(1)
  await assertSafe(page, state)
})

test('required fields and invalid mailbox input never submit or discard other input', async ({ page }) => {
  const state = await prepare(page)
  await addButton(page).click()
  await dialog(page).getByRole('button', { name: 'Save mailbox', exact: true }).click()
  expect(posts(state, collection)).toHaveLength(0)
  await fill(page, { mailbox_address: 'not-an-email' })
  await dialog(page).getByRole('button', { name: 'Save mailbox', exact: true }).click()
  expect(posts(state, collection)).toHaveLength(0)
  await expect(dialog(page).getByLabel('Connection name', { exact: true })).toHaveValue(values.name)
  await expect(dialog(page).getByLabel('Directory (tenant) ID', { exact: true })).toHaveValue(values.tenant_id)
  await assertSafe(page, state)
})

test('server validation including duplicate mailbox preserves inputs and permits an explicit corrected retry', async ({ page }) => {
  const state = await prepare(page, { createResponse: { status: 400, body: { mailbox_address: ['A mailbox connection with this mailbox address already exists.'], detail: privateDetail } } })
  await openFilled(page)
  await dialog(page).getByRole('button', { name: 'Save mailbox', exact: true }).click()
  await expect(dialog(page).getByRole('alert')).toBeVisible()
  for (const [label, value] of [['Connection name', values.name], ['Mailbox address', values.mailbox_address], ['Directory (tenant) ID', values.tenant_id], ['Application (client) ID', values.client_id]]) {
    await expect(dialog(page).getByLabel(label, { exact: true })).toHaveValue(value)
  }
  expect(posts(state, collection)).toHaveLength(1)
  await dialog(page).getByLabel('Mailbox address', { exact: true }).fill('other-sales@example.test')
  state.createResponse = { status: 201, body: connection({ mailbox_address: 'other-sales@example.test' }) }
  await save(page)
  expect(posts(state, collection)).toHaveLength(2)
  expect(posts(state, collection)[1].body.mailbox_address).toBe('other-sales@example.test')
  expect(posts(state, syncPath)).toHaveLength(0)
  await assertSafe(page, state)
})

test('a lost create response preserves input and never automatically repeats the mutation', async ({ page }) => {
  const state = await prepare(page, { createResponse: { abort: 'timedout', body: null } })
  await openFilled(page)
  await dialog(page).getByRole('button', { name: 'Save mailbox', exact: true }).click()
  await expect(dialog(page).getByRole('alert')).toBeVisible()
  await expect(dialog(page).getByLabel('Mailbox address', { exact: true })).toHaveValue(values.mailbox_address)
  await expect(dialog(page).getByLabel('Application (client) ID', { exact: true })).toHaveValue(values.client_id)
  for (const label of ['Connection name', 'Mailbox address', 'Directory (tenant) ID', 'Application (client) ID']) {
    await expect(dialog(page).getByLabel(label, { exact: true })).toBeDisabled()
  }
  expect(posts(state, collection)).toHaveLength(1)
  expect(posts(state, testPath)).toHaveLength(0)
  expect(posts(state, syncPath)).toHaveLength(0)
  await dialog(page).getByRole('button', { name: 'Check saved mailbox', exact: true }).click()
  await expect(dialog(page).getByLabel('Mailbox address', { exact: true })).toBeEnabled()
  await expect(dialog(page).getByLabel('Mailbox address', { exact: true })).toHaveValue(values.mailbox_address)
  await assertSafe(page, state)
})

test('a lost response after a successful save recovers the authorized matching mailbox without a second create', async ({ page }) => {
  const state = await prepare(page, { createResponse: { status: 201, body: connection(), abort: 'timedout' } })
  await openFilled(page)
  await dialog(page).getByRole('button', { name: 'Save mailbox', exact: true }).click()
  await expect(dialog(page).getByRole('alert')).toBeVisible()
  await expect(dialog(page).getByRole('button', { name: 'Save mailbox', exact: true })).toBeDisabled()
  await dialog(page).getByRole('button', { name: 'Check saved mailbox', exact: true }).click()
  await expect(dialog(page).getByRole('button', { name: 'Test connection', exact: true })).toBeVisible()
  await expect(dialog(page).getByLabel('Mailbox address', { exact: true })).toHaveValue(values.mailbox_address)
  expect(posts(state, collection)).toHaveLength(1)
  expect(posts(state, testPath)).toHaveLength(0)
  expect(posts(state, syncPath)).toHaveLength(0)
  await assertSafe(page, state)
})

test('save recovery cannot adopt another application identity just because the mailbox address matches', async ({ page }) => {
  const state = await prepare(page, { createResponse: { abort: 'timedout', body: null } })
  await openFilled(page)
  await dialog(page).getByRole('button', { name: 'Save mailbox', exact: true }).click()
  await expect(dialog(page).getByRole('alert')).toBeVisible()
  state.connections = [connection({ client_id: 'e6ad18f9-b1af-455b-8a21-91a11dfd9b5b' })]
  await dialog(page).getByRole('button', { name: 'Check saved mailbox', exact: true }).click()
  await expect(dialog(page).getByRole('button', { name: 'Save mailbox', exact: true })).toBeEnabled()
  await expect(dialog(page).getByRole('button', { name: 'Test connection', exact: true })).toHaveCount(0)
  await expect(dialog(page).getByLabel('Application (client) ID', { exact: true })).toHaveValue(values.client_id)
  expect(posts(state, collection)).toHaveLength(1)
  await assertSafe(page, state)
})

test('field-shaped provider diagnostics never become rendered validation or console output', async ({ page }) => {
  const state = await prepare(page, { createResponse: { status: 400, body: { tenant_id: [privateDetail], client_id: privateDetail } } })
  await openFilled(page)
  await dialog(page).getByRole('button', { name: 'Save mailbox', exact: true }).click()
  await expect(dialog(page).getByRole('alert')).toBeVisible()
  await expect(dialog(page).getByLabel('Directory (tenant) ID', { exact: true })).toHaveValue(values.tenant_id)
  expect(posts(state, collection)).toHaveLength(1)
  await assertSafe(page, state)
})

test('server denial retains reviewed input and prevents further writes in the denied dialog', async ({ page }) => {
  const state = await prepare(page, { createResponse: { status: 403, body: { detail: privateDetail } } })
  await openFilled(page)
  await dialog(page).getByRole('button', { name: 'Save mailbox', exact: true }).click()
  await expect(dialog(page).getByRole('alert')).toBeVisible()
  await expect(dialog(page).getByLabel('Connection name', { exact: true })).toHaveValue(values.name)
  await expect(dialog(page).getByRole('button', { name: 'Save mailbox', exact: true })).toBeDisabled()
  expect(posts(state, collection)).toHaveLength(1)
  await assertSafe(page, state)
})

test('Graph failure and successful retry retain one saved mailbox and never implicitly enable sync', async ({ page }) => {
  const state = await prepare(page, { testResponse: { status: 502, body: { connected: false, error: privateDetail } } })
  await openFilled(page)
  await save(page)
  await dialog(page).getByRole('button', { name: 'Test connection', exact: true }).click()
  await expect(dialog(page).getByRole('alert')).toBeVisible()
  expect(posts(state, collection)).toHaveLength(1)
  expect(posts(state, syncPath)).toHaveLength(0)
  state.testResponse = { status: 200, body: verified() }
  await dialog(page).getByRole('button', { name: 'Test connection', exact: true }).click()
  await expect(dialog(page).getByRole('button', { name: 'Enable automatic sync', exact: true })).toBeEnabled()
  expect(posts(state, collection)).toHaveLength(1)
  expect(posts(state, testPath)).toHaveLength(2)
  expect(posts(state, testPath).every(request => request.body == null || Object.keys(request.body).length === 0)).toBe(true)
  expect(posts(state, syncPath)).toHaveLength(0)
  await assertSafe(page, state)
})

for (const result of [{ connected: false }, { status: 'connected' }, { connected: 'true' }, { connected: true, mailbox_address: 'changed-mailbox@example.test' }]) {
  test(`HTTP success with ${JSON.stringify(result)} cannot certify the mailbox connection`, async ({ page }) => {
    const state = await prepare(page, { testResponse: { status: 200, body: result } })
    await openFilled(page)
    await save(page)
    await dialog(page).getByRole('button', { name: 'Test connection', exact: true }).click()
    await expect(dialog(page).getByRole('alert')).toBeVisible()
    const enable = dialog(page).getByRole('button', { name: 'Enable automatic sync', exact: true })
    if (await enable.count()) await expect(enable).toBeDisabled()
    expect(posts(state, collection)).toHaveLength(1)
    expect(posts(state, syncPath)).toHaveLength(0)
    await assertSafe(page, state)
  })
}

test('a missing deployment secret preserves the saved connection without requesting a secret in the browser', async ({ page }) => {
  const state = await prepare(page, {
    createResponse: { status: 201, body: connection({ secret_configured: false }) },
    testResponse: { status: 400, body: { connected: false, error: privateDetail } },
  })
  await openFilled(page)
  await save(page)
  await expect(dialog(page)).toContainText(/secret|configuration|administrator/i)
  await expect(dialog(page).getByLabel(/secret|password/i)).toHaveCount(0)
  expect(posts(state, collection)).toHaveLength(1)
  expect(posts(state, syncPath)).toHaveLength(0)
  await dialog(page).getByRole('button', { name: 'Done', exact: true }).click()
  await expect(page.getByText('No emails in this mailbox.', { exact: true })).toBeVisible()
  await page.getByLabel('Mailbox options', { exact: true }).click()
  await page.getByRole('button', { name: 'Mailbox setup', exact: true }).click()
  await expect(page.getByRole('dialog').getByLabel('Mailbox address', { exact: true })).toHaveValue(values.mailbox_address)
  expect(posts(state, collection)).toHaveLength(1)
  await assertSafe(page, state)
})

test('editing a saved unprotected identity preserves failed corrections and retries PATCH without recreating or retaining old verification', async ({ page }) => {
  const state = await prepare(page)
  await openFilled(page)
  await save(page)
  await dialog(page).getByRole('button', { name: 'Test connection', exact: true }).click()
  await expect(dialog(page).getByRole('button', { name: 'Enable automatic sync', exact: true })).toBeEnabled()
  await dialog(page).getByRole('button', { name: 'Edit details', exact: true }).click()
  const changedClient = 'cc9b1374-c5cb-443b-ad05-89b77b161448'
  await dialog(page).getByLabel('Application (client) ID', { exact: true }).fill(changedClient)
  state.patchResponse = { status: 400, body: { client_id: [privateDetail] } }
  await dialog(page).getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(dialog(page).getByRole('alert')).toBeVisible()
  await expect(dialog(page).getByLabel('Application (client) ID', { exact: true })).toHaveValue(changedClient)
  state.patchResponse = null
  await dialog(page).getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(dialog(page).getByRole('button', { name: 'Test connection', exact: true })).toBeEnabled()
  await expect(dialog(page).getByRole('button', { name: 'Enable automatic sync', exact: true })).toBeDisabled()
  const patches = state.requests.filter(request => request.method === 'PATCH')
  expect(patches).toHaveLength(2)
  expect(patches[1].body).toEqual({ ...values, client_id: changedClient })
  expect(posts(state, collection)).toHaveLength(1)
  expect(posts(state, syncPath)).toHaveLength(0)
  await assertSafe(page, state)
})

test('existing sync history keeps mailbox identity read-only while offering explicit connection verification', async ({ page }) => {
  const state = await prepare(page, { connections: [connection({ sync: { status: 'paused', enabled: false, saved_count: 4 } })] })
  await expect(page.getByText('No emails in this mailbox.', { exact: true })).toBeVisible()
  await page.getByLabel('Mailbox options', { exact: true }).click()
  await page.getByRole('button', { name: 'Mailbox setup', exact: true }).click()
  const setup = page.getByRole('dialog', { name: 'Shared mailbox setup', exact: true })
  await expect(setup.getByRole('button', { name: 'Edit details', exact: true })).toHaveCount(0)
  for (const label of ['Connection name', 'Mailbox address', 'Directory (tenant) ID', 'Application (client) ID']) {
    await expect(setup.getByLabel(label, { exact: true })).toBeDisabled()
  }
  await expect(setup.getByRole('button', { name: 'Test connection', exact: true })).toBeEnabled()
  expect(state.requests.every(request => request.method === 'GET')).toBe(true)
  await assertSafe(page, state)
})

test('explicit sync enabling reports queued work without claiming completed import', async ({ page }) => {
  const state = await prepare(page)
  await openFilled(page)
  await save(page)
  await dialog(page).getByRole('button', { name: 'Test connection', exact: true }).click()
  const enable = dialog(page).getByRole('button', { name: 'Enable automatic sync', exact: true })
  await expect(enable).toBeEnabled()
  expect(posts(state, syncPath)).toHaveLength(0)
  await enable.click()
  await expect(dialog(page)).toContainText(/queued|scheduled|waiting/i)
  await expect(dialog(page)).not.toContainText(/import complete|sync complete|all emails imported/i)
  expect(posts(state, syncPath)).toHaveLength(1)
  expect(posts(state, syncPath)[0].body).toEqual({
    enabled: true,
    expected_identity: { mailbox_address: values.mailbox_address, tenant_id: values.tenant_id, client_id: values.client_id },
  })
  expect(posts(state, collection)).toHaveLength(1)
  await assertSafe(page, state)
})

test('runtime-disabled sync shows failure and a later explicit retry never re-creates the connection', async ({ page }) => {
  const state = await prepare(page, { syncResponse: { status: 503, body: { detail: 'Automatic email sync is disabled for this deployment.', provider: privateDetail } } })
  await openFilled(page)
  await save(page)
  await dialog(page).getByRole('button', { name: 'Test connection', exact: true }).click()
  await dialog(page).getByRole('button', { name: 'Enable automatic sync', exact: true }).click()
  await expect(dialog(page).getByRole('alert')).toBeVisible()
  expect(posts(state, collection)).toHaveLength(1)
  expect(posts(state, syncPath)).toHaveLength(1)
  state.syncResponse = { status: 200, body: queued() }
  await dialog(page).getByRole('button', { name: 'Enable automatic sync', exact: true }).click()
  await expect(dialog(page)).toContainText(/queued|scheduled|waiting/i)
  expect(posts(state, syncPath)).toHaveLength(2)
  expect(posts(state, collection)).toHaveLength(1)
  await assertSafe(page, state)
})

test('stale identity conflict prevents sync retry until the mailbox has been reviewed again', async ({ page }) => {
  const state = await prepare(page, { syncResponse: { status: 409, body: { detail: 'Mailbox identity changed. Reload and review the mailbox before changing sync.', code: 'mailbox_identity_changed' } } })
  await openFilled(page)
  await save(page)
  await dialog(page).getByRole('button', { name: 'Test connection', exact: true }).click()
  await dialog(page).getByRole('button', { name: 'Enable automatic sync', exact: true }).click()
  await expect(dialog(page).getByRole('alert')).toContainText(/review|reopen|reload|changed/i)
  await expect(dialog(page).getByRole('button', { name: 'Enable automatic sync', exact: true })).toBeDisabled()
  expect(posts(state, syncPath)).toHaveLength(1)
  expect(posts(state, collection)).toHaveLength(1)
  await assertSafe(page, state)
})

test('administrator without update can save and test but cannot enable automatic sync', async ({ page }) => {
  const state = await prepare(page, { session: { profile: profile({ module_actions: { sales_email_intake: ['read', 'create'] } }) } })
  await openFilled(page)
  await save(page)
  await dialog(page).getByRole('button', { name: 'Test connection', exact: true }).click()
  await expect.poll(() => posts(state, testPath).length).toBe(1)
  await expect(dialog(page).getByRole('button', { name: 'Enable automatic sync', exact: true })).toHaveCount(0)
  expect(posts(state, syncPath)).toHaveLength(0)
  await assertSafe(page, state)
})

for (const operation of ['save', 'test']) {
  test(`account switch during ${operation} ignores the old result and closes the previous account form`, async ({ page }) => {
    const hold = deferred()
    const state = await prepare(page, operation === 'save'
      ? { createResponse: { status: 201, body: connection(), hold } }
      : { testResponse: { status: 200, body: verified(), hold } })
    await openFilled(page)
    if (operation === 'save') await dialog(page).getByRole('button', { name: 'Save mailbox', exact: true }).click()
    else {
      await save(page)
      await dialog(page).getByRole('button', { name: 'Test connection', exact: true }).click()
    }
    await expect.poll(() => posts(state, operation === 'save' ? collection : testPath).length).toBe(1)
    state.connections = []
    const next = profile({ id: 901, user: { id: 12 }, roles: [{ code: 'employee', is_active: true }] })
    await page.evaluate(next => window.setSalesMailboxSetupSession({ authUser: next, profile: next }), next)
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(addButton(page)).toHaveCount(0)
    hold.resolve()
    await expect(page.getByText('No shared mailbox is available to your account.', { exact: true })).toBeVisible()
    await expect(page.locator('body')).not.toContainText(values.mailbox_address)
    expect(posts(state, syncPath)).toHaveLength(0)
    expect(posts(state, collection)).toHaveLength(1)
    await assertSafe(page, state)
  })
}

test('permission revocation while a form is open prevents the pending identity from being saved', async ({ page }) => {
  const state = await prepare(page)
  await openFilled(page)
  await page.evaluate(next => window.setSalesMailboxSetupSession({ authUser: next, profile: next }), profile({ module_actions: { sales_email_intake: ['read'] } }))
  await expect(addButton(page)).toHaveCount(0)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(posts(state, collection)).toHaveLength(0)
  await assertSafe(page, state)
})

test('pending save keeps Tab and Shift+Tab inside the dialog while every command and input is disabled', async ({ page }) => {
  const hold = deferred()
  const state = await prepare(page, { createResponse: { status: 201, body: connection(), hold } })
  await openFilled(page)
  await dialog(page).getByRole('button', { name: 'Save mailbox', exact: true }).click()
  await expect.poll(() => posts(state, collection).length).toBe(1)
  for (const label of ['Connection name', 'Mailbox address', 'Directory (tenant) ID', 'Application (client) ID']) {
    await expect(dialog(page).getByLabel(label, { exact: true })).toBeDisabled()
  }
  for (const key of ['Tab', 'Tab', 'Shift+Tab', 'Shift+Tab']) {
    await page.keyboard.press(key)
    expect(await dialog(page).evaluate(element => element.contains(document.activeElement))).toBe(true)
  }
  await page.keyboard.press('Escape')
  await expect(dialog(page)).toBeVisible()
  hold.resolve()
  await expect(dialog(page).getByRole('button', { name: 'Test connection', exact: true })).toBeEnabled()
  expect(posts(state, collection)).toHaveLength(1)
  await assertSafe(page, state)
})

test('dialog traps keyboard focus restores its opener and fits a narrow screen with accessible labels', async ({ page }, testInfo) => {
  const state = await prepare(page)
  await addButton(page).focus()
  await page.keyboard.press('Enter')
  await expect(dialog(page)).toBeVisible()
  const controls = dialog(page).locator('button:not([disabled]), input:not([disabled]), [tabindex="0"]')
  await controls.first().focus()
  await page.keyboard.press('Shift+Tab')
  await expect(controls.last()).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(controls.first()).toBeFocused()
  await fill(page)
  await page.screenshot({ path: testInfo.outputPath('shared-mailbox-setup-desktop.png'), fullPage: true })
  await page.setViewportSize({ width: 360, height: 800 })
  const accessibility = await new AxeBuilder({ page }).include('[role="dialog"]').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
  expect(accessibility.violations).toEqual([])
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath('shared-mailbox-setup-mobile.png'), fullPage: true })
  await page.keyboard.press('Escape')
  await expect(dialog(page)).toHaveCount(0)
  await expect(addButton(page)).toBeFocused()
  expect(posts(state, collection)).toHaveLength(0)
  await assertSafe(page, state)
})
