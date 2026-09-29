import { test, expect } from '@playwright/test'
import {
  prepare, message, secondMessage, mailbox, listing, paginated, detail,
  opportunityDetails, detected, detailPath, messagesPath, assertReadOnly,
} from '../fixtures/sales-email-api-fixture.js'

const inbox = page => page.getByRole('region', { name: 'Shared mailbox messages', exact: true })
const preview = page => page.getByRole('region', { name: 'Email preview', exact: true })
const review = page => page.getByRole('complementary', { name: 'Email review', exact: true })
const row = (page, record = message()) => page.getByRole('button', { name: `Open email: ${record.subject}`, exact: true })
const search = page => page.getByRole('searchbox', { name: 'Search emails on this page', exact: true })
const requests = state => state.requests.filter(request => request.path.endsWith('/message/'))
const requestedIds = state => requests(state).map(request => new URLSearchParams(request.query).get('message_id'))
const deferred = () => {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}
const bodyFor = record => detail(record, { body_text: `Source body for ${record.subject}` })
const records = [message(), secondMessage(), message({ id: 'draft-three', subject: 'Draft engineering response', is_draft: true, is_read: true })]
const detailsFor = ({ url }) => ({ body: bodyFor(records.find(record => record.id === url.searchParams.get('message_id'))) })

test('the first email opens automatically without moving focus and the visible introduction is removed', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1672, height: 941 })
  const hold = deferred()
  const state = await prepare(page, { shell: true, messageHold: hold, details: opportunityDetails() })
  await search(page).focus()
  const sidebar = page.getByRole('complementary', { name: 'Application navigation', exact: true })
  const sidebarMarkup = await sidebar.evaluate(node => node.outerHTML)
  hold.resolve()
  await expect(preview(page)).toContainText('Please confirm revision C')
  await expect(row(page)).toHaveAttribute('aria-pressed', 'true')
  await expect(search(page)).toBeFocused()
  await expect(review(page).getByRole('button', { name: 'Create opportunity', exact: true })).toBeDisabled()
  const heading = await page.getByRole('heading', { name: 'Email Intake', exact: true }).boundingBox()
  expect(heading.width).toBeLessThanOrEqual(1)
  expect(heading.height).toBeLessThanOrEqual(1)
  await expect(page.getByRole('navigation', { name: 'Breadcrumb', exact: true })).toHaveCount(0)
  await expect(page.getByText('Review shared emails and turn qualified enquiries into opportunities.', { exact: true })).toHaveCount(0)
  expect(requestedIds(state)).toEqual([message().id])
  expect(await sidebar.evaluate(node => node.outerHTML)).toBe(sidebarMarkup)
  await page.screenshot({ path: testInfo.outputPath('email-auto-open-desktop.png') })
  assertReadOnly(state)
})

test('same-row and Next step interactions reuse the automatic pending request and manual selection survives review rerenders', async ({ page }) => {
  const hold = deferred()
  const state = await prepare(page, { detailHandler: ({ url }) => ({ body: bodyFor(records.find(record => record.id === url.searchParams.get('message_id'))), ...(url.searchParams.get('message_id') === message().id ? { hold } : {}) }) })
  await expect.poll(() => requestedIds(state)).toEqual([message().id])
  await row(page).click()
  await inbox(page).getByRole('button', { name: `Next step: ${message().subject}`, exact: true }).click()
  expect(requestedIds(state)).toEqual([message().id])
  hold.resolve()
  await expect(review(page).getByRole('region', { name: 'Email review details', exact: true })).toBeFocused()
  await row(page, secondMessage()).click()
  await expect(preview(page)).toContainText('Source body for Site access update')
  await preview(page).getByRole('tab', { name: 'Extracted details', exact: true }).click()
  await review(page).getByRole('combobox', { name: 'Email type', exact: true }).selectOption('rfq')
  await review(page).getByRole('button', { name: 'Confirm classification', exact: true }).click()
  await row(page, secondMessage()).click()
  await expect(row(page, secondMessage())).toHaveAttribute('aria-pressed', 'true')
  expect(requestedIds(state)).toEqual([message().id, secondMessage().id])
  assertReadOnly(state)
})

test('read filters and search open the first visible result and empty results clear the old reader', async ({ page }) => {
  const state = await prepare(page, { messages: listing(records), detailHandler: detailsFor })
  await expect(preview(page)).toContainText(`Source body for ${message().subject}`)
  await row(page, secondMessage()).click()
  await expect(row(page, secondMessage())).toHaveAttribute('aria-pressed', 'true')
  await search(page).fill('a')
  await expect(row(page)).toHaveAttribute('aria-pressed', 'true')
  await search(page).fill('Site access')
  await expect(preview(page)).toContainText('Source body for Site access update')
  await expect(search(page)).toBeFocused()
  await search(page).fill('Nothing matches this phrase')
  await expect(review(page)).toHaveCount(0)
  await expect(preview(page)).not.toContainText('Source body for')
  const count = requests(state).length
  await search(page).fill('')
  await expect(row(page)).toHaveAttribute('aria-pressed', 'true')
  await expect.poll(() => requests(state).length).toBe(count + 1)
  await page.getByRole('navigation', { name: 'Email read status', exact: true }).getByRole('button', { name: /^Read\b/ }).click()
  await expect(row(page, secondMessage())).toHaveAttribute('aria-pressed', 'true')
  await expect(preview(page)).toContainText('Source body for Site access update')
  expect(state.requests.filter(request => request.path.endsWith('/messages/'))).toHaveLength(1)
  assertReadOnly(state)
})

test('paging and refresh automatically load the first visible email from the returned page', async ({ page }) => {
  const older = message({ id: 'older-row', subject: 'Older engineering request' })
  const state = await prepare(page, {
    messageHandler: ({ url }) => ({ body: url.searchParams.get('cursor') ? listing([older]) : listing([message(), secondMessage()], 'signed-next-page') }),
    detailHandler: ({ url }) => ({ body: bodyFor([message(), secondMessage(), older].find(record => record.id === url.searchParams.get('message_id'))) }),
  })
  await expect(row(page)).toHaveAttribute('aria-pressed', 'true')
  await row(page, secondMessage()).click()
  await expect(preview(page)).toContainText('Source body for Site access update')
  await inbox(page).getByRole('button', { name: 'Next page', exact: true }).click()
  await expect(preview(page)).toContainText('Source body for Older engineering request')
  await inbox(page).getByRole('button', { name: 'Previous page', exact: true }).click()
  await expect(preview(page)).toContainText(`Source body for ${message().subject}`)
  await row(page, secondMessage()).click()
  await inbox(page).getByRole('button', { name: 'Refresh emails', exact: true }).click()
  await expect(row(page)).toHaveAttribute('aria-pressed', 'true')
  await expect(preview(page)).toContainText(`Source body for ${message().subject}`)
  expect(requestedIds(state)).toEqual([message().id, secondMessage().id, older.id, message().id, secondMessage().id, message().id])
  assertReadOnly(state)
})

test('a late automatic detail cannot replace a manually selected email or reset its classification', async ({ page }) => {
  const hold = deferred()
  const state = await prepare(page, { detailHandler: ({ url }) => ({ body: bodyFor(records.find(record => record.id === url.searchParams.get('message_id'))), ...(url.searchParams.get('message_id') === message().id ? { hold } : {}) }) })
  await expect.poll(() => requestedIds(state)).toEqual([message().id])
  await row(page, secondMessage()).click()
  await expect(preview(page)).toContainText('Source body for Site access update')
  const type = review(page).getByRole('combobox', { name: 'Email type', exact: true })
  await type.selectOption('rfq')
  await review(page).getByRole('button', { name: 'Confirm classification', exact: true }).click()
  await search(page).focus()
  const arrived = page.waitForResponse(response => new URL(response.url()).searchParams.get('message_id') === message().id)
  hold.resolve()
  await arrived
  await expect(preview(page)).toContainText('Source body for Site access update')
  await expect(preview(page)).not.toContainText(`Source body for ${message().subject}`)
  await expect(review(page).getByRole('button', { name: 'Confirm classification', exact: true })).toHaveCount(0)
  await expect(search(page)).toBeFocused()
  assertReadOnly(state)
})

for (const reset of ['mailbox', 'account']) {
  test(`${reset} changes discard a pending automatic detail and automatically open the replacement inbox`, async ({ page }) => {
    const hold = deferred()
    const replacement = message({ id: 'replacement-email', subject: 'Replacement inbox email' })
    const state = await prepare(page, {
      ...(reset === 'mailbox' ? { connections: paginated([mailbox(), mailbox({ id: 'shared-2', mailbox_address: 'projects@example.test' })]) } : {}),
      messageHandler: ({ request, url }) => ({ body: listing(url.pathname === messagesPath('shared-2') || request.headers().authorization.endsWith('-22') ? [replacement] : [message()], null, url.pathname === messagesPath('shared-2') ? 'projects@example.test' : 'sales@example.test') }),
      detailHandler: ({ url }) => url.searchParams.get('message_id') === message().id ? { body: bodyFor(message()), hold } : { body: bodyFor(replacement) },
    })
    if (reset === 'mailbox') await page.getByRole('combobox', { name: 'Mailbox', exact: true }).selectOption('shared-1')
    await expect.poll(() => requestedIds(state)).toEqual([message().id])
    if (reset === 'mailbox') await page.getByRole('combobox', { name: 'Mailbox', exact: true }).selectOption('shared-2')
    else await page.evaluate(() => window.setSalesMailboxMessageActor({ id: 900, user: { id: 22 }, email: 'second-admin@example.test' }))
    await expect(preview(page)).toContainText('Source body for Replacement inbox email')
    await search(page).focus()
    const arrived = page.waitForResponse(response => new URL(response.url()).pathname === detailPath('shared-1') && new URL(response.url()).searchParams.get('message_id') === message().id)
    hold.resolve()
    await arrived
    await expect(row(page, replacement)).toHaveAttribute('aria-pressed', 'true')
    await expect(preview(page)).not.toContainText(`Source body for ${message().subject}`)
    await expect(search(page)).toBeFocused()
    expect(requestedIds(state)).toEqual([message().id, replacement.id])
    assertReadOnly(state)
  })
}

for (const status of [401, 403, 404]) {
  test(`automatic detail ${status} clears source content and never retries without user action`, async ({ page }) => {
    const state = await prepare(page, { detailStatus: status, details: { detail: 'Private provider failure' } })
    await expect(inbox(page).getByRole('alert')).toBeVisible()
    await expect(row(page)).toHaveCount(0)
    await expect(review(page)).toHaveCount(0)
    await expect(preview(page)).not.toContainText('Please confirm revision C')
    await search(page).fill('Retry must remain explicit')
    expect(requestedIds(state)).toEqual([message().id])
    assertReadOnly(state)
  })
}

test('a failed automatic preview stays selected until an explicit retry', async ({ page }) => {
  const state = await prepare(page, { detailStatus: 503, details: { detail: 'Private provider failure' } })
  await expect(preview(page).getByRole('alert')).toContainText('Email could not be loaded')
  await expect(row(page)).toHaveAttribute('aria-pressed', 'true')
  await search(page).focus()
  expect(requestedIds(state)).toEqual([message().id])
  state.detailStatus = 200
  state.details = detail()
  await preview(page).getByRole('button', { name: 'Retry email', exact: true }).click()
  await expect(preview(page)).toContainText('Please confirm revision C')
  expect(requestedIds(state)).toEqual([message().id, message().id])
  assertReadOnly(state)
})

test('View original reveals and selects an imported original hidden by the duplicate filter', async ({ page }) => {
  const original = { ...message({ id: 'saved-original' }), status: 'received', extracted_information: detected(), attachments: [] }
  const duplicate = { ...secondMessage(), id: 'saved-duplicate', status: 'duplicate', duplicate_of: original.id, duplicate_of_subject: original.subject, extracted_information: detected(), attachments: [] }
  const state = await prepare(page, { view: 'imported', imported: paginated([original, duplicate]) })
  const reader = page.locator('.sales-email-preview-header')
  await expect(reader).toContainText(original.subject)
  const filters = page.getByRole('navigation', { name: 'Email intake status', exact: true })
  await filters.getByRole('button', { name: /^Duplicate/ }).click()
  await expect(reader).toContainText(duplicate.subject)
  await page.getByRole('button', { name: `View original: ${original.subject}`, exact: true }).click()
  await expect(reader).toContainText(original.subject)
  await expect(filters.getByRole('button', { name: /^All\d*$/ })).toHaveAttribute('aria-pressed', 'true')
  assertReadOnly(state)
})

test('an unavailable imported original leaves the duplicate selected with an honest notice', async ({ page }) => {
  const unrelated = { ...message(), status: 'received', extracted_information: detected(), attachments: [] }
  const duplicate = { ...secondMessage(), status: 'duplicate', duplicate_of: 'not-in-loaded-enquiries', duplicate_of_subject: 'Unavailable original', extracted_information: detected(), attachments: [] }
  const state = await prepare(page, { view: 'imported', imported: paginated([unrelated, duplicate]) })
  const filters = page.getByRole('navigation', { name: 'Email intake status', exact: true })
  await filters.getByRole('button', { name: /^Duplicate/ }).click()
  const reader = page.locator('.sales-email-preview-header')
  await expect(reader).toContainText(duplicate.subject)
  await page.getByRole('button', { name: 'View original: Unavailable original', exact: true }).click()
  await expect(page.getByText('The original email is not in the loaded enquiries.', { exact: true })).toBeVisible()
  await expect(reader).toContainText(duplicate.subject)
  await expect(reader).not.toContainText(unrelated.subject)
  await expect(filters.getByRole('button', { name: /^Duplicate/ })).toHaveAttribute('aria-pressed', 'true')
  assertReadOnly(state)
})

test('imported search and status filters replace hidden selections and clear empty readers', async ({ page }) => {
  const saved = records.slice(0, 2).map((record, index) => ({ ...record, status: index ? 'under_review' : 'received', can_create_opportunity: true, extracted_information: detected(), attachments: [] }))
  const state = await prepare(page, { view: 'imported', imported: paginated(saved) })
  const reader = page.locator('.sales-email-preview-header')
  await expect(reader).toContainText(message().subject)
  const field = page.getByRole('searchbox', { name: 'Search email intake', exact: true })
  await field.fill('Site access')
  await expect(reader).toContainText(secondMessage().subject)
  await field.fill('No saved email matches')
  await expect(review(page)).toHaveCount(0)
  await expect(reader).toHaveCount(0)
  await field.fill('')
  await expect(reader).toContainText(message().subject)
  await page.getByRole('navigation', { name: 'Email intake status', exact: true }).getByRole('button', { name: /^Under review/ }).click()
  await expect(reader).toContainText(secondMessage().subject)
  await expect(review(page).getByRole('button', { name: 'Create opportunity', exact: true })).toBeDisabled()
  expect(requests(state)).toHaveLength(0)
  assertReadOnly(state)
})
