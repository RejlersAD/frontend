import { test, expect } from '@playwright/test'

const privateValues = {
  authorization: 'PRIVATE_AUTHORIZATION_FIXTURE_9181',
  cursor: 'PRIVATE_CURSOR_FIXTURE_7261',
  messageId: 'PRIVATE_MESSAGE_ID_FIXTURE_6154',
  sourceToken: 'PRIVATE_SOURCE_TOKEN_FIXTURE_5132',
  title: 'PRIVATE_REVIEWED_TITLE_FIXTURE_4281',
  description: 'PRIVATE_REVIEWED_DESCRIPTION_FIXTURE_3156',
  providerDetail: 'PRIVATE_PROVIDER_DETAIL_FIXTURE_2074',
}
const connectionPath = '/api/v1/sales/mailbox-connections/'
const liveConversion = `${connectionPath}privacy-connection/convert-to-opportunity/`
const importedConversion = '/api/v1/sales/email-intakes/privacy-intake/convert-to-opportunity/'
const allowed = new Map([
  [connectionPath, { method: 'GET', status: 403 }],
  [`${connectionPath}privacy-connection/messages/`, { method: 'GET', status: 502 }],
  [`${connectionPath}privacy-connection/message/`, { method: 'GET', status: 400 }],
  [liveConversion, { method: 'POST', status: 409 }],
  [importedConversion, { method: 'POST', status: 400 }],
])

for (const mode of ['http', 'network']) {
  test(`${mode} mailbox failures keep private request and response values out of console logs and toasts`, async ({ page }) => {
    const requests = []
    const unexpected = []
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.addInitScript(({ authorization }) => {
      localStorage.setItem('radai_access_token', authorization)
      window.mailboxDiagnosticCapture = []
      for (const method of ['log', 'info', 'warn', 'error', 'group', 'groupCollapsed']) {
        const original = console[method].bind(console)
        console[method] = (...args) => {
          window.mailboxDiagnosticCapture.push(args.map(value => {
            try { return JSON.stringify(value) ?? String(value) } catch { return String(value) }
          }).join(' '))
          original(...args)
        }
      }
      console.info('PUBLIC_DIAGNOSTIC_CONTROL')
    }, privateValues)
    await page.route('**/*', async route => {
      const request = route.request()
      const url = new URL(request.url())
      if (!['127.0.0.1', 'localhost'].includes(url.hostname)) {
        unexpected.push(`External request: ${url.origin}`)
        return route.abort()
      }
      if (!url.pathname.startsWith('/api/v1/')) return route.continue()
      requests.push({ path: url.pathname, method: request.method(), query: url.search, body: request.method() === 'POST' ? request.postDataJSON() : null })
      const expected = allowed.get(url.pathname)
      if (!expected || expected.method !== request.method() || (mode === 'network' && url.pathname !== liveConversion)) {
        unexpected.push(`${request.method()} ${url.pathname}`)
        return route.fulfill({ status: 405, json: { detail: 'Unexpected fixture request.' } })
      }
      if (mode === 'network') return route.abort('failed')
      return route.fulfill({ status: expected.status, json: { detail: privateValues.providerDetail } })
    })
    await page.goto('/tests/fixtures/sales-mailbox-privacy.html')
    await expect(page.getByRole('heading', { name: 'Sales mailbox failure privacy fixture' })).toBeVisible()
    const results = await page.evaluate(({ mode, privateValues }) => window.runSalesMailboxFailureProbe(mode, privateValues), { mode, privateValues })
    expect(results).toHaveLength(mode === 'http' ? 5 : 1)
    expect(results.every(result => result.status === 'rejected')).toBe(true)
    if (mode === 'http') expect(results.map(result => result.httpStatus)).toEqual([403, 502, 400, 409, 400])
    else expect(results[0].isNetworkError).toBe(true)
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    const diagnostics = await page.evaluate(() => window.mailboxDiagnosticCapture.join('\n'))
    expect(diagnostics).toContain('PUBLIC_DIAGNOSTIC_CONTROL')
    for (const value of Object.values(privateValues)) expect(diagnostics).not.toContain(value)
    await expect(page.locator('.Toastify__toast')).toHaveCount(0)
    expect(requests).toHaveLength(mode === 'http' ? 5 : 1)
    expect(requests.find(request => request.path === liveConversion).body.source_token).toBe(privateValues.sourceToken)
    if (mode === 'http') {
      expect(new URLSearchParams(requests.find(request => request.path.endsWith('/messages/')).query).get('cursor')).toBe(privateValues.cursor)
      expect(new URLSearchParams(requests.find(request => request.path.endsWith('/message/')).query).get('message_id')).toBe(privateValues.messageId)
    }
    // Positive controls make empty capture/toast assertions meaningful.
    await page.evaluate(() => window.showSalesMailboxPrivacyControlToast())
    await expect(page.getByRole('alert')).toHaveText('Public toast control')
    expect(errors).toEqual([])
    expect(unexpected).toEqual([])
  })
}
