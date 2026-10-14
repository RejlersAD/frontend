import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { prepare, message, listing, detail, messagesPath, detailPath, assertReadOnly } from '../fixtures/sales-email-api-fixture.js'

const subject = 'Q-101371/ FW: Unpriced Technical Bid Invitation'
const older = message({ id: 'older-technical-bid', subject, received_at: '2025-05-01T08:00:00Z', is_read: true })
const recent = Array.from({ length: 50 }, (_, index) => message({ id: `recent-${index}`, subject: `Recent project update ${index + 1}` }))
const search = page => page.getByRole('searchbox', { name: 'Search all mail', exact: true })
const row = (page, record) => page.getByRole('button', { name: `Open email: ${record.subject}`, exact: true })
const preview = page => page.getByRole('region', { name: 'Email preview', exact: true })
const listRequests = state => state.requests.filter(request => request.path === messagesPath('shared-1'))
const queries = state => listRequests(state).map(request => Object.fromEntries(new URLSearchParams(request.query)))
const deferred = () => {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}
const detailsFor = records => ({ url }) => {
  const record = records.find(item => item.id === url.searchParams.get('message_id'))
  return { body: detail(record, { body_text: `Visible source for ${record.subject}` }) }
}

test('search finds an older subject outside the initial 50 and normalizes pasted spaces across all folders', async ({ page }, testInfo) => {
  const pasted = `  Q-101371/\u00a0 FW:  Unpriced Technical Bid Invitation\u00a0  `
  const state = await prepare(page, {
    messageHandler: ({ url }) => ({ body: listing(url.searchParams.get('search') === subject ? [older] : recent, url.searchParams.has('search') ? null : 'browse-next') }),
    detailHandler: detailsFor([...recent, older]),
  })
  await expect(row(page, recent[0])).toBeVisible()
  await expect(row(page, older)).toHaveCount(0)
  await expect(page.getByText('Page 1 · 50 emails on this page', { exact: true })).toBeVisible()
  await page.getByRole('navigation', { name: 'Email read status', exact: true }).getByRole('button', { name: /^Unread\b/ }).click()
  await search(page).fill(pasted)
  await expect(row(page, older)).toHaveAttribute('aria-pressed', 'true')
  await expect(preview(page)).toContainText(`Visible source for ${subject}`)
  await expect(search(page)).toHaveValue(pasted)
  await expect(page.getByRole('navigation', { name: 'Email read status', exact: true }).getByRole('button', { name: /^All mail\b/ })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText('Page 1 · 1 emails on this page', { exact: true })).toBeVisible()
  await expect(page.getByText('Search covers all folders (up to 1,000 matches). Filters and counts apply to this page.', { exact: true })).toBeVisible()
  expect(queries(state)).toEqual([{}, { search: subject }])
  const result = await new AxeBuilder({ page }).include('main').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
  expect(result.violations).toEqual([])
  await page.screenshot({ path: testInfo.outputPath('mailbox-wide-subject-search.png') })
  assertReadOnly(state)
})

test('query changes reset browsing and retain the query on next, previous, refresh and clear', async ({ page }) => {
  const second = message({ id: 'second-match', subject: 'RE: Q-101371 technical response' })
  const state = await prepare(page, {
    messageHandler: ({ url }) => ({ body: url.searchParams.has('search')
      ? url.searchParams.has('cursor') ? listing([second]) : listing([older], 'search-next')
      : url.searchParams.has('cursor') ? listing([recent[1]]) : listing([recent[0]], 'browse-next') }),
    detailHandler: detailsFor([...recent, older, second]),
  })
  await expect(row(page, recent[0])).toBeVisible()
  await page.getByRole('button', { name: 'Next page', exact: true }).click()
  await expect(row(page, recent[1])).toBeVisible()
  await search(page).fill('Q-101371')
  await expect(row(page, older)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Previous page', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Next page', exact: true }).click()
  await expect(row(page, second)).toBeVisible()
  await page.getByRole('button', { name: 'Previous page', exact: true }).click()
  await expect(row(page, older)).toBeVisible()
  await page.getByRole('button', { name: 'Refresh emails', exact: true }).click()
  await expect(row(page, older)).toBeVisible()
  await search(page).fill('')
  await expect(row(page, recent[0])).toBeVisible()
  await expect(page.getByRole('heading', { name: 'All mail', exact: true })).toBeVisible()
  expect(queries(state)).toEqual([{}, { cursor: 'browse-next' }, { search: 'Q-101371' }, { search: 'Q-101371', cursor: 'search-next' }, { search: 'Q-101371' }, { search: 'Q-101371' }, {}])
  assertReadOnly(state)
})

test('typing debounces requests and immediately hides old content while a slower search cannot replace newer results', async ({ page }) => {
  const hold = deferred()
  const outdated = message({ id: 'old-search-result', subject: 'Obsolete search result' })
  const state = await prepare(page, {
    messageHandler: ({ url }) => url.searchParams.get('search') === 'old query'
      ? { body: listing([outdated]), hold }
      : { body: listing(url.searchParams.has('search') ? [older] : [recent[0]]) },
    detailHandler: detailsFor([recent[0], older, outdated]),
  })
  await expect(preview(page)).toContainText(`Visible source for ${recent[0].subject}`)
  await page.clock.install({ time: new Date('2026-10-01T08:00:00Z') })
  await page.clock.pauseAt(new Date('2026-10-01T08:00:01Z'))
  await search(page).fill('old query')
  await expect(row(page, recent[0])).toHaveCount(0)
  await expect(preview(page)).not.toContainText('Visible source for')
  await page.clock.fastForward(351)
  await expect.poll(() => queries(state)).toEqual([{}, { search: 'old query' }])
  await search(page).fill('Q')
  await page.clock.fastForward(150)
  await search(page).fill('Q-101371')
  await page.clock.fastForward(349)
  expect(queries(state)).toHaveLength(2)
  await page.clock.fastForward(2)
  await expect(row(page, older)).toBeVisible()
  await expect(preview(page)).toContainText(`Visible source for ${subject}`)
  const arrived = page.waitForResponse(response => new URL(response.url()).searchParams.get('search') === 'old query')
  hold.resolve()
  await arrived
  await expect(row(page, outdated)).toHaveCount(0)
  await expect(preview(page)).toContainText(`Visible source for ${subject}`)
  expect(queries(state)).toEqual([{}, { search: 'old query' }, { search: 'Q-101371' }])
  assertReadOnly(state)
})

test('a pending old detail is discarded as soon as search text changes', async ({ page }) => {
  const hold = deferred()
  const state = await prepare(page, {
    messageHandler: ({ url }) => ({ body: listing(url.searchParams.has('search') ? [older] : [recent[0]]) }),
    detailHandler: ({ url }) => url.searchParams.get('message_id') === recent[0].id
      ? { body: detail(recent[0], { body_text: 'Private obsolete body' }), hold }
      : detailsFor([older])({ url }),
  })
  await expect.poll(() => state.requests.filter(request => request.path === detailPath('shared-1')).length).toBe(1)
  await search(page).fill('Q-101371')
  const arrived = page.waitForResponse(response => new URL(response.url()).searchParams.get('message_id') === recent[0].id)
  hold.resolve()
  await arrived
  await expect(preview(page)).not.toContainText('Private obsolete body')
  await expect(preview(page)).toContainText(`Visible source for ${subject}`)
  assertReadOnly(state)
})

test('search failures retain input for retry and access denial clears all private content', async ({ page }) => {
  let status = 502
  const state = await prepare(page, {
    messageHandler: ({ url }) => url.searchParams.has('search')
      ? { status, body: status === 200 ? listing([older]) : { detail: 'Private provider diagnostic must not render.' } }
      : { body: listing([recent[0]]) },
    detailHandler: detailsFor([recent[0], older]),
  })
  await expect(row(page, recent[0])).toBeVisible()
  await search(page).fill('Q-101371')
  await expect(page.getByRole('alert')).toContainText('Mailbox emails could not be loaded.')
  await expect(search(page)).toHaveValue('Q-101371')
  await expect(preview(page)).not.toContainText('Visible source for')
  status = 200
  await page.getByRole('button', { name: 'Try again', exact: true }).click()
  await expect(preview(page)).toContainText(`Visible source for ${subject}`)
  status = 403
  await page.getByRole('button', { name: 'Refresh emails', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('You do not have access to this mailbox.')
  await expect(search(page)).toHaveValue('Q-101371')
  await expect(page.getByRole('button', { name: /^Open email:/ })).toHaveCount(0)
  await expect(preview(page)).not.toContainText('Visible source for')
  await expect(page.locator('body')).not.toContainText('Private provider diagnostic')
  expect(queries(state)).toEqual([{}, { search: 'Q-101371' }, { search: 'Q-101371' }, { search: 'Q-101371' }])
  assertReadOnly(state)
})

test('empty search results provide useful recovery and clearing restores unfiltered mail', async ({ page }) => {
  const state = await prepare(page, {
    messageHandler: ({ url }) => ({ body: listing(url.searchParams.has('search') ? [] : [recent[0]]) }),
    detailHandler: detailsFor(recent),
  })
  await expect(row(page, recent[0])).toBeVisible()
  await search(page).fill('missing reference')
  await expect(page.getByText('No matching emails found. Try a shorter subject or reference.', { exact: true })).toBeVisible()
  await expect(search(page)).toHaveValue('missing reference')
  await expect(page.getByRole('button', { name: 'Next page', exact: true })).toBeDisabled()
  await search(page).fill('')
  await expect(row(page, recent[0])).toBeVisible()
  expect(queries(state)).toEqual([{}, { search: 'missing reference' }, {}])
  assertReadOnly(state)
})

test('oversized search is explained without truncating user input or issuing a mailbox request', async ({ page }) => {
  const state = await prepare(page)
  await expect(row(page, message())).toBeVisible()
  const longQuery = 'Q'.repeat(257)
  await search(page).fill(longQuery)
  await expect(page.getByRole('alert')).toContainText('Use 256 characters or fewer to search mail.')
  await expect(search(page)).toHaveValue(longQuery)
  expect(queries(state)).toEqual([{}])
  assertReadOnly(state)
})

test('expired search pagination retains the query and refresh restarts the same search', async ({ page }) => {
  const state = await prepare(page, {
    messageHandler: ({ url }) => url.searchParams.has('cursor')
      ? { status: 410, body: { detail: 'Expired cursor.' } }
      : { body: listing(url.searchParams.has('search') ? [older] : [recent[0]], 'search-next') },
    detailHandler: detailsFor([recent[0], older]),
  })
  await expect(row(page, recent[0])).toBeVisible()
  await search(page).fill('Q-101371')
  await expect(row(page, older)).toBeVisible()
  await page.getByRole('button', { name: 'Next page', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Mailbox page has expired.')
  await expect(search(page)).toHaveValue('Q-101371')
  await page.getByRole('button', { name: 'Refresh emails', exact: true }).click()
  await expect(row(page, older)).toBeVisible()
  expect(queries(state)).toEqual([{}, { search: 'Q-101371' }, { cursor: 'search-next', search: 'Q-101371' }, { search: 'Q-101371' }])
  assertReadOnly(state)
})
