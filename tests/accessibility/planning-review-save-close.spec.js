import { test, expect } from '@playwright/test'
import { planningInputsHarness } from '../fixtures/planning-inputs.fixture.js'

test.setTimeout(90000)

const dialog = page => page.getByRole('dialog', { name: 'Review & confirm inputs', exact: true })
const reviewPanel = page => page.getByRole('complementary', { name: 'AI input review', exact: true })
const factRow = page => dialog(page).locator('.pln-review-list > li').filter({ hasText: 'Process design basis' })
const savedNotice = 'Review saved. You can close this window.'

function deferred() {
  let release
  const promise = new Promise(resolve => { release = resolve })
  return { promise, release }
}

async function harness(page, options = {}) {
  return planningInputsHarness(page, {
    populated: true,
    harnessPath: '/tests/fixtures/planning-review-panel-harness.jsx',
    prepare(state) {
      state.reviewWriteStarted = 0
      state.reviewWriteSucceeded = false
      state.reviewRefreshStarted = 0
      state.reviewRefreshError = null
    },
    async handleRequest({ path, route, state, reply, url }) {
      const method = route.request().method()
      if (method === 'POST' && /\/intelligence-(facts\/\d+\/review|conflicts\/\d+\/resolve)\/$/.test(path)) {
        state.reviewWriteStarted += 1
        if (options.writeGate) await options.writeGate.promise
        if (options.writeError) {
          await reply(route, options.writeError.body, options.writeError.status)
          return true
        }
        state.reviewWriteSucceeded = true
      }
      if (method === 'GET' && path.endsWith('/intelligence-facts/') && url.searchParams.get('run') === '901' && state.reviewWriteSucceeded) {
        state.reviewRefreshStarted += 1
        if (options.refreshGate) await options.refreshGate.promise
        if (state.reviewRefreshError) {
          await reply(route, { detail: state.reviewRefreshError }, 503)
          return true
        }
      }
      return false
    },
  })
}

async function openReview(page) {
  await expect(reviewPanel(page)).toHaveAttribute('aria-busy', 'false', { timeout: 45000 })
  await page.getByRole('button', { name: /View all \d+ (requirements|findings)/ }).click()
  await expect(dialog(page)).toBeVisible()
  await expect(factRow(page)).toBeVisible()
}

function clean(state) {
  expect(state.unknown).toEqual([])
  expect(state.pageErrors).toEqual([])
}

test('an outstanding review write protects Close and Escape until the server accepts it', async ({ page }) => {
  const writeGate = deferred()
  const state = await harness(page, { writeGate })
  try {
    await openReview(page)
    await factRow(page).getByRole('button', { name: 'Confirm', exact: true }).click()
    await expect.poll(() => state.reviewWriteStarted).toBe(1)
    await expect(dialog(page).getByText('Saving review…', { exact: true })).toBeVisible()
    await expect(dialog(page).getByRole('button', { name: 'Close', exact: true })).toBeDisabled()
    await expect(dialog(page).getByRole('button', { name: 'Close input review', exact: true })).toBeDisabled()
    await page.keyboard.press('Escape')
    await expect(dialog(page)).toBeVisible()
    await expect(dialog(page)).not.toContainText(savedNotice)
    await expect(factRow(page).locator('.pln-status')).toHaveText('detected')
  } finally { writeGate.release() }
  await expect(dialog(page)).toContainText(savedNotice)
  await expect(factRow(page).locator('.pln-status')).toHaveText('confirmed')
  await dialog(page).getByRole('button', { name: 'Close', exact: true }).click()
  await expect(dialog(page)).not.toBeVisible()
  expect(state.writes.filter(write => write.path.endsWith('/review/'))).toHaveLength(1)
  clean(state)
})

for (const [action, status, close] of [['Confirm', 'confirmed', 'button'], ['Reject', 'rejected', 'Escape']]) {
  test(`saved ${status} finding remains visible and ${close} closes during a held refresh`, async ({ page }) => {
    const refreshGate = deferred()
    const state = await harness(page, { refreshGate })
    try {
      await openReview(page)
      await factRow(page).getByRole('button', { name: action, exact: true }).click()
      await expect.poll(() => state.reviewRefreshStarted).toBe(1)
      await expect(dialog(page)).toContainText(savedNotice)
      await expect(dialog(page)).toContainText('Refreshing saved findings… You can close this window.')
      await expect(factRow(page).locator('.pln-status')).toHaveText(status)
      await expect(dialog(page)).not.toContainText('No extracted inputs were found')
      await expect(dialog(page).getByRole('button', { name: 'Close', exact: true })).toBeEnabled()
      await expect(dialog(page).getByRole('button', { name: 'Close input review', exact: true })).toBeEnabled()
      if (close === 'Escape') await page.keyboard.press('Escape')
      else await dialog(page).getByRole('button', { name: 'Close', exact: true }).click()
      await expect(dialog(page)).not.toBeVisible()
    } finally { refreshGate.release() }
    await openReview(page)
    await expect(factRow(page).locator('.pln-status')).toHaveText(status)
    expect(state.writes.filter(write => write.path.endsWith('/review/'))).toHaveLength(1)
    clean(state)
  })
}

test('conflict resolution protects the write but permits closing during the following refresh', async ({ page }) => {
  const writeGate = deferred(), refreshGate = deferred()
  const state = await harness(page, { writeGate, refreshGate })
  try {
    await openReview(page)
    await dialog(page).getByRole('button', { name: 'Use this value', exact: true }).first().click()
    await expect.poll(() => state.reviewWriteStarted).toBe(1)
    await expect(dialog(page).getByRole('button', { name: 'Close', exact: true })).toBeDisabled()
    await page.keyboard.press('Escape')
    await expect(dialog(page)).toBeVisible()
    writeGate.release()
    await expect.poll(() => state.reviewRefreshStarted).toBe(1)
    await expect(dialog(page)).toContainText(savedNotice)
    await expect(factRow(page)).toBeVisible()
    await expect(dialog(page)).not.toContainText('No extracted inputs were found')
    await expect(dialog(page).getByRole('button', { name: 'Close', exact: true })).toBeEnabled()
    await page.keyboard.press('Escape')
    await expect(dialog(page)).not.toBeVisible()
  } finally { writeGate.release(); refreshGate.release() }
  await openReview(page)
  await expect(dialog(page).getByRole('heading', { name: 'Clarifications required' })).toHaveCount(0)
  await expect(dialog(page).locator('.pln-review-list > li').filter({ hasText: '2026-01-05' }).locator('.pln-status')).toHaveText('confirmed')
  expect(state.writes.filter(write => write.path.endsWith('/resolve/'))).toHaveLength(1)
  clean(state)
})

test('refresh failure preserves the saved finding and retries reads without repeating its write', async ({ page }) => {
  const state = await harness(page)
  await openReview(page)
  state.reviewRefreshError = 'Saved findings temporarily unavailable.'
  await factRow(page).getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(dialog(page)).toContainText(savedNotice)
  await expect(dialog(page).getByRole('alert')).toHaveText(state.reviewRefreshError)
  await expect(factRow(page).locator('.pln-status')).toHaveText('confirmed')
  await expect(dialog(page)).not.toContainText('No extracted inputs were found')
  await expect(dialog(page).getByRole('button', { name: 'Close', exact: true })).toBeEnabled()
  state.reviewRefreshError = null
  await dialog(page).getByRole('button', { name: 'Retry input review', exact: true }).click()
  await expect(dialog(page).getByRole('alert')).toHaveCount(0)
  await expect(factRow(page).locator('.pln-status')).toHaveText('confirmed')
  await expect(dialog(page).locator('.pln-dialog-body')).toHaveAttribute('aria-busy', 'false')
  expect(state.writes.filter(write => write.path.endsWith('/review/'))).toHaveLength(1)
  expect(state.reviewRefreshStarted).toBe(2)
  clean(state)
})

test('a rejected write retains detected state, reports failure and permits closing without claiming success', async ({ page }) => {
  const state = await harness(page, { writeError: { status: 403, body: { detail: 'You cannot review this finding.' } } })
  await openReview(page)
  await factRow(page).getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(dialog(page).getByRole('alert')).toHaveText('You cannot review this finding.')
  await expect(dialog(page)).not.toContainText(savedNotice)
  await expect(factRow(page).locator('.pln-status')).toHaveText('detected')
  await expect(dialog(page).getByRole('button', { name: 'Close', exact: true })).toBeEnabled()
  await page.keyboard.press('Escape')
  await expect(dialog(page)).not.toBeVisible()
  expect(state.reviewWriteStarted).toBe(1)
  expect(state.reviewRefreshStarted).toBe(0)
  expect(state.writes).toEqual([])
  clean(state)
})

test('a late write from an unmounted project cannot reopen its findings or start a stale refresh', async ({ page }) => {
  const writeGate = deferred()
  const state = await harness(page, { writeGate })
  const writeResponse = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith('/review/'))
  try {
    await openReview(page)
    await factRow(page).getByRole('button', { name: 'Confirm', exact: true }).click()
    await expect.poll(() => state.reviewWriteStarted).toBe(1)
    await page.evaluate(() => {
      const next = new URL(window.location.href)
      next.searchParams.set('project', '18')
      window.history.pushState({}, '', next)
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    await expect(page).toHaveURL(/project=18(?:&|$)/)
    await expect(reviewPanel(page)).toContainText('Awaiting documents')
    await expect(dialog(page)).not.toBeVisible()
  } finally { writeGate.release() }
  await writeResponse
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  await expect.poll(() => state.writes.filter(write => write.path.endsWith('/review/')).length).toBe(1)
  await expect(reviewPanel(page)).not.toContainText('Process design basis')
  await expect(page.getByText(savedNotice, { exact: true })).toHaveCount(0)
  await expect(reviewPanel(page)).toHaveAttribute('aria-busy', 'false')
  expect(state.reviewRefreshStarted).toBe(0)
  clean(state)
})
