import { test, expect } from '@playwright/test'
import { planningInputsHarness } from '../fixtures/planning-inputs.fixture'
import { pageOf } from '../fixtures/schedule-performance.fixture'

test.setTimeout(60000)

const review = page => page.getByRole('complementary', { name: 'AI input review', exact: true })
const sourceRow = page => page.getByRole('row').filter({ hasText: '5900913-scope-of-work.pdf' })

test('completed source files stay analyzed while a large findings list loads, without fetching older run pages', async ({ page }) => {
  let releaseFacts
  const pendingFacts = new Promise(resolve => { releaseFacts = resolve })
  const state = await planningInputsHarness(page, {
    populated: true,
    async handleRequest({ path, url, route, state: current, reply }) {
      if (path.endsWith('/intelligence-runs/')) {
        await reply(route, { ...pageOf(current.records[17].runs), next: '?page=2' })
        return true
      }
      if (path.endsWith('/intelligence-facts/')) {
        const facts = current.records[17].facts
        if (url.searchParams.get('page') === '2') {
          await pendingFacts
          await reply(route, pageOf(facts.slice(2)))
        } else await reply(route, { ...pageOf(facts.slice(0, 2)), next: '?page=2' })
        return true
      }
      return false
    },
  })
  try {
    await expect(review(page)).toHaveAttribute('aria-busy', 'true')
    await expect(review(page)).toContainText('Loading review')
    await expect(sourceRow(page)).toContainText('Analyzed')
    await expect(sourceRow(page)).not.toContainText('Ready to analyze')
    await expect(review(page)).not.toContainText('Review unavailable')
    await expect(review(page)).not.toContainText('No requirements were extracted')
    await expect.poll(() => state.requests.filter(row => row.path.endsWith('/intelligence-facts/') && row.query.page === '2').length).toBe(1)
    expect(state.requests.filter(row => row.path.endsWith('/intelligence-runs/') && row.query.page === '2')).toHaveLength(0)
  } finally { releaseFacts() }
  await expect(review(page)).toHaveAttribute('aria-busy', 'false')
  await expect(review(page)).toContainText('Process design basis')
  await expect(review(page)).toContainText('Needs confirmation')
  await expect(page.locator('.pln-metrics')).toContainText('4requirements extracted')
  expect(state.unknown).toEqual([])
  expect(state.pageErrors).toEqual([])
  expect(state.writes).toEqual([])
})

test('a findings fetch error does not report completed analysis as missing and can be retried', async ({ page }) => {
  let failFacts = true
  const state = await planningInputsHarness(page, {
    populated: true,
    async handleRequest({ path, route, reply }) {
      if (failFacts && path.endsWith('/intelligence-facts/')) {
        await reply(route, { detail: 'Findings temporarily unavailable.' }, 503)
        return true
      }
      return false
    },
  })
  await expect(review(page)).toContainText('Review unavailable')
  await expect(review(page)).toContainText('Findings temporarily unavailable.')
  await expect(sourceRow(page)).toContainText('Analyzed')
  await expect(review(page)).not.toContainText('No requirements were extracted')
  failFacts = false
  await review(page).getByRole('button', { name: 'Retry input review', exact: true }).click()
  await expect(review(page)).toContainText('Process design basis')
  await expect(review(page)).not.toContainText('Review unavailable')
  expect(state.pageErrors).toEqual([])
  expect(state.writes).toEqual([])
})

test('switching projects cancels the pending review and never shows the previous project findings', async ({ page }) => {
  let releaseFacts
  const pendingFacts = new Promise(resolve => { releaseFacts = resolve })
  const state = await planningInputsHarness(page, {
    populated: true,
    async handleRequest({ path, url, route, state: current, reply }) {
      if (path.endsWith('/intelligence-facts/') && url.searchParams.get('run') === '901') {
        await pendingFacts
        await reply(route, pageOf(current.records[17].facts))
        return true
      }
      return false
    },
  })
  try {
    await expect(sourceRow(page)).toContainText('Analyzed')
    await expect(review(page)).toHaveAttribute('aria-busy', 'true')
    const selector = page.getByRole('combobox', { name: 'Active Project', exact: true })
    await selector.fill('5900738')
    await selector.press('Enter')
    await expect(page).toHaveURL(/project=18(?:&|$)/)
    await expect(review(page)).toContainText('Awaiting documents')
  } finally { releaseFacts() }
  await expect(review(page)).not.toContainText('Process design basis')
  await expect(review(page)).toHaveAttribute('aria-busy', 'false')
  await expect(page.getByText('No reference documents uploaded yet.', { exact: true })).toBeVisible()
  expect(state.pageErrors).toEqual([])
  expect(state.writes).toEqual([])
})
