import { test, expect } from '@playwright/test'
import { Buffer } from 'node:buffer'

test.setTimeout(60000)

async function open(page, view, overrides = {}) {
  const state = {
    approval: { can_approve: false, already_decided: false, level_name: 'Finance', approval_level: 2 },
    invoice: { invoice_number: 'TEST-INVOICE', total_amount: '100', currency: 'AED' },
    run: { id: 4, cycle_code: 'TEST-CYCLE', status: 'draft', employee_count: 0, total_net_pay: 0 },
    document: { id: 4, can_review: false, verification_status: 'pending', employee_name: 'Test Employee' },
    notification: { id: 8, title: 'Exit approval', message: 'Review exit request', created_at: '2026-09-16T10:00:00Z', metadata: { action_type: 'offboarding_project_manager_decision', decision_status: 'pending', requires_action: true, offboarding_id: 4 } },
    offboarding: { can_project_manager_decide: false },
    ...overrides,
  }
  const requests = [], errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.addInitScript(value => { window.globalApprovalFixture = value; localStorage.setItem('radai_access_token', 'fixture-token') }, state)
  await page.route('**/api/v1/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname
    requests.push({ method: request.method(), path, authorization: request.headers().authorization })
    let body = {}
    if (path.includes('/finance/approval/')) body = { approval: state.approval, invoice: state.invoice }
    else if (path.endsWith('/runs/4/')) body = state.run
    else if (path.endsWith('/workflow-log/') || path.endsWith('/payslips/')) body = []
    else if (path.endsWith('/profile-documents/4/')) body = state.document
    else if (path.endsWith('/content/')) return route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aDCEAAAAASUVORK5CYII=', 'base64') })
    else if (path.endsWith('/notifications/unread_count/')) body = { unread_count: 1 }
    else if (path.endsWith('/notifications/')) body = { results: [state.notification] }
    else if (path.endsWith('/offboarding/4/')) body = state.offboarding
    else if (path.endsWith('/governance/')) body = state.governance
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) })
  })
  await page.goto(`/tests/fixtures/global-approval.html?view=${view}`)
  return { state, requests, errors }
}

test('planning assurance cannot use broad project control as approval authority', async ({ page }) => {
  const assurance = { id: 2, status: 'ready', blockers: [], warnings: [], calculated_state_at: '2026-09-16T10:00:00Z' }
  const observed = await open(page, 'assurance', { assurance })
  await expect(page.getByRole('button', { name: 'Run again', exact: true })).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Approve assurance', exact: true })).toBeDisabled()
  await page.screenshot({ path: '../artifacts/planning-approval-capabilities.png' })
  expect(observed.errors).toEqual([])
})

test('planning assurance enables the explicitly authorized actor', async ({ page }) => {
  const observed = await open(page, 'assurance', { assurance: { status: 'ready', can_approve: true, blockers: [], warnings: [], calculated_state_at: '2026-09-16T10:00:00Z' } })
  await expect(page.getByRole('button', { name: 'Approve assurance', exact: true })).toBeEnabled()
  expect(observed.errors).toEqual([])
})

test('recalculated formal review exposes rejection only at the assigned stage', async ({ page }) => {
  const observed = await open(page, 'governance', { governance: {
    items: [], members: [], current_user_id: 99, can_manage: true,
    summary: { pending_reviews: 1 }, audit_events: [],
    reviews: [{ id: 2, title: 'Recalculated schedule', status: 'pending', can_decide: false, can_reject: true, comments: [], decisions: [{ id: 3, reviewer: { id: 99, name: 'Current reviewer' }, status: 'pending' }] }],
  } })
  await page.getByRole('button', { name: 'Reviews & Approvals', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Approve', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Reject', exact: true })).toBeEnabled()
  expect(observed.errors).toEqual([])
})

test('invoice approval links require sign-in and preserve the exact return destination', async ({ page }) => {
  const requests = []
  await page.route('**/api/v1/**', async route => {
    requests.push(new URL(route.request().url()).pathname)
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ results: [] }) })
  })
  const destination = '/finance/approve/fixture-token?source=notification'
  await page.goto(destination)
  await expect(page).toHaveURL(/\/login$/)
  expect(await page.evaluate(() => history.state?.usr?.from)).toBe(destination)
  expect(requests.filter(path => path.includes('/finance/approval/'))).toEqual([])
})

test('invoice decisions require the authenticated server capability', async ({ page }) => {
  const observed = await open(page, 'invoice')
  await expect(page.getByText('TEST-INVOICE', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /APPROVE|REJECT/ })).toHaveCount(0)
  expect(observed.requests.find(row => row.path.includes('/finance/approval/')).authorization).toBe('Bearer fixture-token')
  expect(observed.errors).toEqual([])
})

test('an eligible invoice actor sees decisions and loses them after server rejection', async ({ page }) => {
  const observed = await open(page, 'invoice', { approval: { can_approve: true, already_decided: false, level_name: 'Finance', approval_level: 2 } })
  await page.route('**/finance/approval/*/submit/', route => route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ error: 'Current stage changed.' }) }))
  await page.getByRole('button', { name: /APPROVE/ }).click()
  await expect(page.getByText('Current stage changed.')).toBeVisible()
  await expect(page.getByRole('button', { name: /APPROVE|REJECT/ })).toHaveCount(0)
  expect(observed.errors).toEqual([])
})

test('payroll pending status and superadmin access alone do not expose approval', async ({ page }) => {
  const observed = await open(page, 'payroll')
  await expect(page.getByRole('heading', { name: /Payroll Run TEST-CYCLE/ })).toBeVisible()
  await expect(page.getByRole('button', { name: 'HR Approve', exact: true })).toHaveCount(0)
  expect(observed.errors).toEqual([])
})

test('payroll rechecks capability before submitting a staged decision', async ({ page }) => {
  const observed = await open(page, 'payroll', { run: { id: 4, status: 'draft', cycle_code: 'TEST-CYCLE', can_hr_approve: true } })
  await page.getByRole('button', { name: 'HR Approve', exact: true }).click()
  observed.state.run.can_hr_approve = false
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(page.getByText('This approval is no longer available to you at the current stage.')).toBeVisible()
  expect(observed.requests.filter(row => row.method === 'POST')).toEqual([])
  expect(observed.errors).toEqual([])
})

test('a profile reviewer with a fresh capability can act', async ({ page }) => {
  const observed = await open(page, 'document', { document: { id: 4, can_review: true, verification_status: 'pending' } })
  await expect(page.getByRole('button', { name: 'Approve', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Reject', exact: true })).toBeVisible()
  expect(observed.errors).toEqual([])
})

test('an obsolete offboarding notification has no decision buttons', async ({ page }) => {
  const observed = await open(page, 'notification', { notification: { id: 8, title: 'Exit approval', created_at: '2026-09-16T10:00:00Z', metadata: { action_type: 'offboarding_project_manager_decision', decision_status: 'pending', requires_action: false, offboarding_id: 4 } } })
  await page.getByRole('button', { name: 'Notifications', exact: true }).click()
  await expect(page.getByText('Exit approval', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Approve', exact: true })).toHaveCount(0)
  await page.screenshot({ path: '../artifacts/global-approval-obsolete-notification.png' })
  expect(observed.requests.filter(row => row.method === 'POST')).toEqual([])
  expect(observed.errors).toEqual([])
})

test('profile document review discards stale queue approval rights', async ({ page }) => {
  const observed = await open(page, 'document')
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect.poll(() => observed.requests.some(row => row.path.endsWith('/profile-documents/4/'))).toBe(true)
  await expect(page.getByRole('button', { name: 'Approve', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Reject', exact: true })).toHaveCount(0)
  expect(observed.errors).toEqual([])
})

test('stale offboarding notification rechecks the current designated actor before posting', async ({ page }) => {
  const observed = await open(page, 'notification')
  await page.getByRole('button', { name: 'Notifications', exact: true }).click()
  await page.getByRole('button', { name: 'Approve', exact: true }).click()
  await page.getByRole('dialog', { name: 'Confirm action', exact: true }).getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(page.getByText('This exit approval is no longer available to you at the current stage.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Approve', exact: true })).toHaveCount(0)
  expect(observed.requests.filter(row => row.method === 'POST')).toEqual([])
  expect(observed.errors).toEqual([])
})
