import { test, expect } from '@playwright/test'

const names = ['Ahmed Ali', 'Sara Khan', 'John Smith', 'Hana Bekele', 'Omar Hassan', 'Priya Nair', 'Daniel Thomas', 'Test Candidate']
const positions = ['Accountant', 'HR Officer', 'Developer', 'Procurement Officer', 'Mechanical Engineer', 'Project Coordinator', 'Electrical Engineer', 'Engineer']
const stages = ['Interview', 'Selected', 'Invited', 'Applied', 'Pending docs', 'Interview', 'Applied', 'Applied']
async function setup(page, { fail = false, empty = false, submitted = false, longDetails = false } = {}) {
  const candidates = empty ? [] : names.map((name, i) => ({ id: i + 1, name, email: `${name.toLowerCase().replace(' ', '.')}@example.com`, reference: `CAN-000${i + 1}`, position: positions[i], status: stages[i], department: i === 1 ? 'HR & Administration' : 'Engineering', nationality: 'Pakistani', mobile: '+971 50 000 0000', education: 'MBA · Human Resource Management', experience: '6 years · HR operations & recruitment', skills: 'Recruitment, HRIS, Employee Relations', interview_notes: 'Strong communication and HR operations experience.', created_at: '2026-10-18T08:00:00Z', timeline: [{ label: 'Candidate updated', date: '2026-10-21T08:00:00Z' }, { label: 'Candidate created', date: '2026-10-18T08:00:00Z' }] }))
  if (longDetails) candidates[1].experience = 'Engineering and recruitment experience.\n'.repeat(120)
  if (submitted) Object.assign(candidates[1], {
    photo: { id: 21 }, documents: [{ id: 22, invitation: 10, kind: 'cv', name: 'submitted-cv.pdf', size: 2048, content_type: 'application/pdf' }],
    submitted_forms: [{ invitation: 10, version: 1, kind: 'cv' }],
    cv_details: { current_position: 'Recruitment specialist', languages: [{ language: 'English', proficiency: 'Fluent' }], achievements: 'Built a recruitment team' }
  })
  await page.route('**/hr/recruitment-candidates/**', async route => {
    const request = route.request()
    if (request.url().endsWith('/photo/')) return route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64') })
    if (fail) return route.fulfill({ status: 403, json: { detail: 'Forbidden' } })
    if (request.method() === 'POST') {
      const candidate = { ...request.postDataJSON(), id: 99, reference: 'CAN-0099', created_at: '2026-10-21T08:00:00Z', timeline: [] }
      candidates.unshift(candidate); return route.fulfill({ status: 201, json: candidate })
    }
    if (request.method() === 'PATCH') {
      const id = Number(new URL(request.url()).pathname.split('/').filter(Boolean).at(-1))
      const candidate = candidates.find(item => item.id === id)
      Object.assign(candidate, request.postDataJSON()); return route.fulfill({ json: candidate })
    }
    return route.fulfill({ json: { count: candidates.length, next: null, results: candidates } })
  })
  const openings = [{ id: 1, title: 'Engineer', department: 'Engineering', is_open: true }]
  const publicLinks = []
  await page.route('**/hr/recruitment-position-sync/', route => {
    if (route.request().method() === 'POST') {
      if (openings.length === 1) openings.push({ id: 2, title: 'Lead I&C Engineer', location: 'Abu Dhabi', department: '', is_open: true, source: 'rejlers_careers', source_url: 'https://www.rejlers.com/ae/careers/open-positions/lead-engineer/' })
      return route.fulfill({ json: { status: 'success', fetched: 1 } })
    }
    return route.fulfill({ json: { status: 'success', automatic_enabled: true, interval_seconds: 3600, last_success_at: '2026-10-22T10:00:00Z', counts: {} } })
  })
  await page.route('**/hr/recruitment-application-links/**', route => {
    const request = route.request(), path = new URL(request.url()).pathname
    if (path.endsWith('/revoke/')) {
      const item = publicLinks.find(row => row.id === Number(path.split('/').filter(Boolean).at(-2)))
      item.revoked = true; return route.fulfill({ json: item })
    }
    if (request.method() === 'POST') {
      const item = { ...request.postDataJSON(), id: publicLinks.length + 1, position: 'All open positions', submitted_applications: 0, expires_at: '2026-12-01T12:00:00Z', revoked: false, link: 'http://localhost:5173/candidate-forms#apply=synthetic-public-link' }
      publicLinks.unshift(item); return route.fulfill({ status: 201, json: item })
    }
    if (new URL(request.url()).searchParams.has('link')) return route.fulfill({ json: { applications: [] } })
    return route.fulfill({ json: publicLinks })
  })
  const invitations = []
  await page.route('**/hr/recruitment-forms/**', route => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    const payload = request.method() === 'POST' ? request.postDataJSON() : null
    if (path.includes('/schema/')) return route.fulfill({ json: { version: 'test', sections: [], declaration: '' } })
    if (path.endsWith('/command/')) {
      const item = invitations.find(row => row.id === Number(path.split('/').filter(Boolean).at(-2)))
      if (payload.action === 'revoke') item.revoked = true
      if (payload.action === 'send') item.delivery_status = 'sent'
      return route.fulfill({ json: item })
    }
    if (request.method() === 'POST') {
      const item = { ...payload, id: invitations.length + 1, recipient: 'candidate@example.test', position: 'Engineer', state: 'draft', delivery_status: 'link_created', versions: [], expires_at: '2026-12-01T12:00:00Z', revoked: false, token: 'test-only-link-token', link: 'http://localhost:5173/candidate-forms#invite=test-only-link-token' }
      invitations.unshift(item)
      return route.fulfill({ status: 201, json: item })
    }
    return route.fulfill({ json: invitations })
  })
  await page.route('**/hr/recruitment-openings/**', route => {
    const request = route.request()
    if (request.method() === 'POST') {
      const job = { ...request.postDataJSON(), id: openings.length + 1 }
      openings.push(job); return route.fulfill({ status: 201, json: job })
    }
    if (request.method() === 'PATCH') {
      const id = Number(new URL(request.url()).pathname.split('/').filter(Boolean).at(-1))
      const job = openings.find(item => item.id === id)
      Object.assign(job, request.postDataJSON()); return route.fulfill({ json: job })
    }
    return route.fulfill({ json: { count: openings.length, next: null, results: openings } })
  })
  await page.goto('/tests/hr-enhancements/talent.html')
  await expect(page.getByRole('heading', { name: 'Talent Acquisition', exact: true })).toBeVisible()
}

test('reference layout, candidate selection, filtering and pagination', async ({ page }) => {
  await page.setViewportSize({ width: 1428, height: 885 })
  await setup(page)
  await expect(page.getByRole('complementary')).toHaveAccessibleName('Candidate details: Sara Khan')
  await expect(page.getByText('1 – 7 of 8 candidates')).toBeVisible()
  await page.getByRole('button', { name: 'Next page' }).click()
  await expect(page.getByRole('button', { name: 'View Test Candidate', exact: true })).toBeVisible()
  await page.getByRole('region', { name: 'Recruitment summary' }).getByRole('button', { name: 'Selected 1', exact: true }).click()
  await expect(page.getByText('1 – 1 of 1 candidates')).toBeVisible()
  await page.getByRole('button', { name: 'Columns' }).click()
  await page.getByRole('checkbox', { name: 'Position', exact: true }).uncheck()
  await expect(page.getByRole('columnheader', { name: 'Position', exact: true })).toHaveCount(0)
  await page.getByRole('checkbox', { name: 'Position', exact: true }).check()
  await page.getByRole('button', { name: 'Done', exact: true }).click()
  await page.reload()
  await expect(page.locator('.ta-table-scroll tbody tr')).toHaveCount(7)
  await page.screenshot({ path: '../artifacts/talent-acquisition-desktop.png', fullPage: true })
})

test('create, edit, refresh and honest workflow integration states', async ({ page }) => {
  await setup(page, { empty: true })
  await expect(page.getByText('Your candidate register is ready')).toBeVisible()
  await page.getByRole('button', { name: 'New Candidate', exact: true }).click()
  await page.getByLabel('Full name *').fill('New Person')
  await page.getByLabel('Email *').fill('new@example.test')
  await page.getByLabel('Position applied *').fill('Engineer')
  await page.getByLabel('Department *').fill('Engineering')
  await page.getByRole('button', { name: 'Save candidate' }).click()
  await expect(page.getByRole('complementary')).toHaveAccessibleName('Candidate details: New Person')
  await page.getByRole('button', { name: 'Edit candidate', exact: true }).click()
  await page.getByLabel('Interview notes', { exact: true }).fill('Ready for review')
  await page.getByRole('button', { name: 'Save candidate' }).click()
  await expect(page.getByText('Ready for review', { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByText('Ready for review', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Create invitation link', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Create invitation link', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Create link', exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).not.toBeVisible()
})

test('permission failure shows retry without fabricated empty data', async ({ page }) => {
  await setup(page, { fail: true })
  await expect(page.getByRole('alert')).toContainText('HR permission is required')
  await expect(page.getByText('Candidate register unavailable')).toBeVisible()
  await expect(page.getByRole('button', { name: 'New Candidate', exact: true })).toBeDisabled()
})

test('HR can add and close an explicitly maintained opening', async ({ page }) => {
  await setup(page)
  await page.getByRole('button', { name: 'Open Jobs' }).click()
  await page.getByLabel('Job title *').fill('Project Manager')
  await page.getByLabel('Department *').fill('Project Delivery')
  await page.getByRole('button', { name: 'Add position', exact: true }).click()
  await expect(page.getByRole('dialog').getByText('Project Manager', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Close position', exact: true }).last().click()
  await expect(page.getByText('Project Delivery · Closed')).toBeVisible()
})

test('failed save keeps candidate input for correction', async ({ page }) => {
  await setup(page)
  await page.route('**/hr/recruitment-candidates/', async route => {
    if (route.request().method() === 'POST') return route.fulfill({ status: 400, json: { email: ['Enter a valid email address.'] } })
    return route.fallback()
  })
  await page.getByRole('button', { name: 'New Candidate', exact: true }).click()
  await page.getByLabel('Full name *').fill('Retain My Input')
  await page.getByLabel('Email *').fill('retain@example.test')
  await page.getByLabel('Position applied *').fill('Engineer')
  await page.getByLabel('Department *').fill('Engineering')
  await page.getByRole('button', { name: 'Save candidate' }).click()
  await expect(page.getByRole('alert')).toContainText('Enter a valid email address.')
  await expect(page.getByLabel('Full name *')).toHaveValue('Retain My Input')
})

test('mobile main content has no document overflow and details remain accessible', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await setup(page)
  await expect(page.getByRole('complementary')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: '../artifacts/talent-acquisition-mobile.png', fullPage: true })
})

test('HR creates and copies a CV invitation in the simple dialog', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { value: { writeText: async value => { window.copiedInvitation = value } }, configurable: true }))
  await setup(page, { empty: true })
  await page.getByRole('button', { name: 'Create invitation link', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('combobox')).toHaveCount(0)
  await expect(dialog.getByRole('button', { name: 'Private candidate invitation', exact: true })).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Create link', exact: true }).click()
  await expect(dialog.getByLabel('Invitation link', { exact: true })).toHaveValue(/#apply=/)
  await dialog.getByRole('button', { name: 'Copy link', exact: true }).click()
  await expect(dialog.getByRole('status')).toHaveText('Link copied.')
  expect(await page.evaluate(() => window.copiedInvitation)).toContain('#apply=')
  await page.screenshot({ path: '../artifacts/simple-create-invitation-link.png', fullPage: true })
})

test('HR creates a Pre-Onboarding link without candidate or position selection', async ({ page }) => {
  await setup(page, { empty: true })
  await page.getByRole('button', { name: 'Create invitation link', exact: true }).click()
  await page.getByRole('radio', { name: 'Pre-Onboarding Employee Form', exact: true }).check()
  const pending = page.waitForRequest(request => request.method() === 'POST' && request.url().includes('/hr/recruitment-application-links/'))
  await page.getByRole('button', { name: 'Create link', exact: true }).click()
  const request = await pending
  expect(request.postDataJSON()).toEqual({ kind: 'pre_onboarding', opening: null })
  await expect(page.getByLabel('Invitation link', { exact: true })).toHaveValue(/#apply=/)
  await expect(page.getByRole('dialog').getByRole('combobox')).toHaveCount(0)
})

test('interview outcome is maintained in the candidate edit form', async ({ page }) => {
  await setup(page)
  await page.getByRole('button', { name: 'Edit candidate', exact: true }).click()
  await page.getByLabel('Interview outcome', { exact: true }).selectOption('suitable')
  await page.getByRole('button', { name: 'Save candidate', exact: true }).click()
  await page.getByRole('button', { name: 'Edit candidate', exact: true }).click()
  await expect(page.getByLabel('Interview outcome', { exact: true })).toHaveValue('suitable')
})

test('candidate submissions are reviewed separately from creating invitation links', async ({ page }) => {
  await setup(page)
  await page.route('**/hr/recruitment-forms/**', route => {
    const item = { id: 77, kind: 'cv', position: 'Engineer', state: 'submitted', versions: [{ id: 1, version: 1 }] }
    if (new URL(route.request().url()).pathname.endsWith('/review/')) return route.fulfill({ json: { ...item, schema: { sections: [{ key: 'candidate', title: 'Candidate details', repeatable: false, fields: [{ key: 'name', label: 'Full name', type: 'text' }] }] }, submissions: [{ id: 1, version: 1, created_at: '2026-10-22T10:00:00Z', data: { candidate: { name: 'Submitted Applicant' } } }] } })
    return route.fulfill({ json: [item] })
  })
  await page.getByRole('button', { name: 'More actions for Sara Khan', exact: true }).click()
  await page.getByRole('button', { name: 'Review submitted forms', exact: true }).click()
  await page.getByRole('button', { name: 'View submission', exact: true }).click()
  await expect(page.getByText('Submitted Applicant', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Download Word', exact: true })).toBeVisible()
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Create link', exact: true })).toHaveCount(0)
})

test('HR synchronization updates open positions and shows website-managed vacancies', async ({ page }) => {
  await setup(page)
  await page.getByRole('button', { name: 'Open Jobs 1', exact: true }).click()
  await page.getByRole('button', { name: 'Sync positions now', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Open Jobs 2', exact: true })).toBeVisible()
  await expect(page.getByText('Lead I&C Engineer', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'View vacancy', exact: true })).toHaveAttribute('href', /rejlers\.com/)
})


test('confirmed candidate details show photo, documents and complete submission access', async ({ page }) => {
  await page.route('**/hr/recruitment-forms/10/attachments/22/', route => route.fulfill({ contentType: 'application/pdf', body: '%PDF-1.4\n%%EOF' }))
  await setup(page, { submitted: true })
  const panel = page.getByRole('complementary')
  await expect(panel.locator('.ta-avatar img')).toHaveAttribute('src', /^blob:/)
  await expect(panel.getByText('English', { exact: false })).toBeVisible()
  await expect(panel.getByText('Built a recruitment team')).toBeVisible()
  await expect(panel.getByText('submitted-cv.pdf', { exact: true })).toBeVisible()
  await panel.getByRole('button', { name: 'Preview submitted-cv.pdf' }).click()
  await expect(page.getByRole('dialog').getByTitle('submitted-cv.pdf')).toHaveAttribute('src', /^blob:/)
  await page.getByRole('button', { name: 'Close dialog' }).click()
  const download = page.waitForEvent('download')
  await panel.getByRole('button', { name: 'Download submitted-cv.pdf' }).click()
  expect((await download).suggestedFilename()).toBe('submitted-cv.pdf')
  await panel.getByRole('button', { name: 'View complete submitted form' }).click()
  await expect(page.getByRole('heading', { name: 'Submitted candidate forms' })).toBeVisible()
})


test('candidate list search resets pagination and details scroll independently', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await setup(page, { longDetails: true })
  await page.addStyleTag({ content: 'html,body,#root{height:100%;margin:0}' })
  await expect(page.getByRole('complementary')).toBeVisible()
  await page.getByRole('button', { name: 'Next page' }).click()
  await page.getByRole('searchbox', { name: 'Search candidates' }).fill('sara.khan')
  await expect(page.locator('.ta-table-scroll tbody tr')).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'View Sara Khan', exact: true })).toBeVisible()
  await expect(page.getByText('1 \u2013 1 of 1 candidates')).toBeVisible()
  const body = page.getByRole('region', { name: 'Candidate information', exact: true })
  const initial = await page.locator('.ta-register-heading').boundingBox()
  await body.hover()
  await page.mouse.wheel(0, 700)
  await expect.poll(() => body.evaluate(element => element.scrollTop)).toBeGreaterThan(0)
  expect(await page.evaluate(() => window.scrollY)).toBe(0)
  expect((await page.locator('.ta-register-heading').boundingBox()).y).toBe(initial.y)
  await expect(page.getByRole('button', { name: 'Edit candidate', exact: true })).toBeVisible()
  await page.getByRole('searchbox', { name: 'Search candidates' }).fill('')
  await page.getByRole('button', { name: 'View Ahmed Ali', exact: true }).click()
  await expect.poll(() => body.evaluate(element => element.scrollTop)).toBe(0)
  await page.screenshot({ path: '../artifacts/talent-search-independent-scroll.png', fullPage: true })
})
