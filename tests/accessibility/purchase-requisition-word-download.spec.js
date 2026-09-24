import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { recommendationHarness, recommendationId as id, recommendationNumber as number } from '../fixtures/purchase-recommendations.fixture'
import { requisitionWord, wordMime } from '../fixtures/purchase-requisition-word.fixture'
import { mixedSizePdf } from '../fixtures/mixed-size-pdf.fixture'

test.setTimeout(90000)
test.use({ serviceWorkers: 'block', viewport: { width: 1672, height: 941 } })

const wordHarness = (page, options = {}) => recommendationHarness(page, {
  ...options, realApp: true, prepare: fixture => {
    fixture.actor.module_actions.procurement_requisitions.push('export')
    options.prepare?.(fixture)
  },
})

const details = page => page.getByRole('complementary', { name: 'Recommendation details' })
const loaded = async page => {
  await expect(page.getByRole('heading', { name: 'Purchase Recommendations', exact: true })).toBeVisible()
  await expect(details(page)).toHaveAttribute('aria-busy', 'false')
}
const review = async (page, index = 1) => {
  await page.evaluate(recordId => {
    window.history.pushState({}, '', `/procurement/requisitions/${recordId}`)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, id(index + 200))
  await expect(page.getByRole('heading', { name: number(index), level: 1, exact: true })).toBeVisible()
}
const clean = state => {
  expect(state.unknown).toEqual([])
  expect(state.pageErrors).toEqual([])
  expect(state.requests.filter(request => request.path.includes('/procurement/') && request.method !== 'GET')).toEqual([])
}
const exportRoute = '**/api/v1/procurement/requisitions/*/export-word/'
const wordResponse = { status: 200, contentType: wordMime, headers: { 'content-disposition': 'attachment; filename="Synthetic-Purchase-Requisition.docx"' }, body: requisitionWord }
async function downloaded(page, button) {
  const pending = page.waitForEvent('download')
  await button.click()
  const result = await pending
  expect(result.suggestedFilename()).toBe('Synthetic-Purchase-Requisition.docx')
  expect(await readFile(await result.path())).toEqual(requisitionWord)
}

test('draft requisitions download Word from both register menus without saving or submitting', async ({ page }) => {
  const state = await wordHarness(page, { realApp: true })
  const exports = []
  await page.route(exportRoute, async route => { exports.push(route.request().url()); await route.fulfill(wordResponse) })
  await loaded(page)
  await page.getByRole('button', { name: `Actions for ${number(3)}`, exact: true }).click()
  await downloaded(page, page.getByRole('menuitem', { name: 'Download Word', exact: true }))
  await page.getByRole('button', { name: `Select ${number(3)}`, exact: true }).click()
  await expect(details(page)).toHaveAttribute('aria-busy', 'false')
  await details(page).getByRole('button', { name: 'More recommendation detail actions', exact: true }).click()
  await downloaded(page, page.getByRole('menuitem', { name: 'Download Word', exact: true }))
  expect(exports).toHaveLength(2)
  expect(exports.every(url => url.endsWith(`/${id(203)}/export-word/`))).toBe(true)
  expect(state.details[id(203)].status).toBe('draft')
  clean(state)
})

test('the review downloads saved Word while retaining its original signed PDF separately', async ({ page }) => {
  await page.route('**/__word-test-original.pdf', route => route.fulfill({ contentType: 'application/pdf', body: mixedSizePdf(1) }))
  const state = await wordHarness(page, { realApp: true, prepare: fixture => {
    fixture.details[id(204)].attachments = [{ type: 'signed_purchase_requisition_pdf', filename: 'Original-signed-PR.pdf', url: '/__word-test-original.pdf' }]
  } })
  const exports = []
  await page.route(exportRoute, async route => { exports.push(route.request().url()); await route.fulfill(wordResponse) })
  await loaded(page)
  await review(page, 4)
  await expect(page.getByRole('link', { name: 'Download original PDF', exact: true })).toBeVisible()
  await downloaded(page, page.getByRole('button', { name: 'Download Word', exact: true }))
  await expect(page.getByRole('link', { name: 'Download original PDF', exact: true })).toHaveAttribute('download', 'Original-signed-PR.pdf')
  expect(exports).toHaveLength(1)
  expect(exports[0]).toContain(`/${id(204)}/export-word/`)
  expect(state.details[id(204)].status).toBe('approved')
  clean(state)
})

for (const status of [403, 503]) {
  test(`Word export ${status} displays the server reason and allows a retry without changing the PR`, async ({ page }) => {
    const state = await wordHarness(page, { realApp: true })
    let fail = true
    const reason = status === 403 ? 'You do not have permission to export this requisition.' : 'Word document generation is temporarily unavailable.'
    await page.route(exportRoute, route => route.fulfill(fail ? { status, contentType: 'application/json', body: JSON.stringify({ detail: reason }) } : wordResponse))
    await loaded(page)
    await review(page)
    await page.getByRole('button', { name: 'Download Word', exact: true }).click()
    await expect(page.getByRole('alert').filter({ hasText: reason })).toBeVisible()
    await expect(page.getByRole('heading', { name: number(1), level: 1, exact: true })).toBeVisible()
    fail = false
    await downloaded(page, page.getByRole('button', { name: 'Download Word', exact: true }))
    await expect(page.getByRole('alert').filter({ hasText: reason })).toHaveCount(0)
    clean(state)
  })
}

for (const isAdmin of [false, true]) {
  test(`users with an explicit export denial do not receive Word actions (administrator: ${isAdmin})`, async ({ page }) => {
    const state = await wordHarness(page, { realApp: true, prepare: fixture => {
      fixture.actor.is_superuser = isAdmin
      fixture.actor.module_actions = { procurement_requisitions: ['read'], procurement_orders: ['read'] }
    } })
    await loaded(page)
    await page.getByRole('button', { name: `Actions for ${number(1)}`, exact: true }).click()
    await expect(page.getByRole('menuitem', { name: 'Download Word', exact: true })).toHaveCount(0)
    await page.keyboard.press('Escape')
    await details(page).getByRole('button', { name: 'More recommendation detail actions', exact: true }).click()
    await expect(page.getByRole('menuitem', { name: 'Download Word', exact: true })).toHaveCount(0)
    await page.keyboard.press('Escape')
    await review(page)
    await expect(page.getByRole('button', { name: 'Download Word', exact: true })).toHaveCount(0)
    clean(state)
  })
}

test('a delayed Word download shows progress and is cancelled when another PR is opened', async ({ page }) => {
  const state = await wordHarness(page, { realApp: true })
  let release
  let requested = false
  const pending = new Promise(resolve => { release = resolve })
  await page.route(exportRoute, async route => { requested = true; await pending; await route.fulfill(wordResponse) })
  const downloads = []
  page.on('download', file => downloads.push(file.suggestedFilename()))
  await loaded(page)
  await review(page)
  await page.getByRole('button', { name: 'Download Word', exact: true }).click()
  await expect.poll(() => requested).toBe(true)
  await expect(page.getByRole('button', { name: 'Preparing Word...', exact: true })).toBeDisabled()
  await review(page, 2)
  release()
  await expect(page.getByRole('button', { name: 'Download Word', exact: true })).toBeEnabled()
  await page.route(exportRoute, route => route.fulfill(wordResponse))
  await downloaded(page, page.getByRole('button', { name: 'Download Word', exact: true }))
  expect(downloads).toEqual(['Synthetic-Purchase-Requisition.docx'])
  clean(state)
})

test('an HTML success response is shown as an error instead of downloaded as a Word file', async ({ page }) => {
  const state = await wordHarness(page, { realApp: true })
  await page.route(exportRoute, route => route.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>Sign in</body></html>' }))
  const downloads = []
  page.on('download', file => downloads.push(file.suggestedFilename()))
  await loaded(page)
  await review(page)
  await page.getByRole('button', { name: 'Download Word', exact: true }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'did not return a valid Purchase Requisition Word document' })).toBeVisible()
  expect(downloads).toEqual([])
  clean(state)
})
