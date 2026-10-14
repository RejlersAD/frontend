import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import {
  prepare, message, listing, detail, detected, assertReadOnly,
} from '../fixtures/sales-email-api-fixture.js'

const first = () => message({ direction: 'incoming', subject: 'Gentle reminder — supplier certification renewal' })
const second = () => message({ id: 'second-compact-source', direction: 'incoming', subject: 'Separate engineering enquiry' })
const information = () => detected({
  detection_version: 2,
  classification: { version: 1, status: 'classified', code: 'general_communication', needs_review: true, evidence: [], alternatives: [] },
})
const emailDetail = (record, body) => detail(record, { body_text: body || 'Please review the supplier certification renewal and confirm the exact date from the original notice.', extracted_information: information() })
const insights = page => page.getByRole('complementary', { name: 'Email review', exact: true })
const tabs = page => insights(page).getByRole('tablist', { name: 'AI insights tabs', exact: true })
const selectTab = (page, name) => tabs(page).getByRole('tab', { name, exact: true }).click()
const assistant = page => insights(page).getByRole('region', { name: 'Ask RADAI', exact: true })
const question = page => assistant(page).getByRole('textbox', { name: 'Ask about the selected email', exact: true })
const draft = page => assistant(page).getByRole('textbox', { name: 'Reply draft', exact: true })
const reader = page => page.getByRole('region', { name: 'Email preview', exact: true })
const row = (page, record) => page.getByRole('button', { name: `Open email: ${record.subject}`, exact: true })
const ready = async (page, options = {}) => {
  const state = await prepare(page, {
    shell: true, messages: listing([first(), second()]), details: emailDetail(first()), ...options,
  })
  await expect(insights(page).getByRole('heading', { name: 'AI insights', exact: true })).toBeVisible()
  return state
}
const mockAssistant = async (page, wait = Promise.resolve()) => {
  const calls = []
  await page.route('**/api/v1/sales/**/review-assistant/', async route => {
    const payload = route.request().postDataJSON()
    calls.push(payload)
    await wait
    await route.fulfill({ status: 200, json: {
      version: 1, kind: payload.action === 'draft_reply' ? 'reply_draft' : 'answer',
      answer: payload.action === 'draft_reply' ? 'Dear sender,\nPlease confirm the certification expiry date.' : 'The exact date requires confirmation.',
      citations: [{ source_id: 'selected-email', excerpt: 'Please review the supplier certification renewal and confirm the exact date from the original notice.' }],
      provider: 'anthropic', model: 'synthetic-test-model', coverage: { messages_reviewed: 1 }, partial: false, needs_review: true,
    } })
  })
  return calls
}
const noOverflow = async page => expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
const separate = (a, b) => a.x + a.width <= b.x + 1 || b.x + b.width <= a.x + 1 || a.y + a.height <= b.y + 1 || b.y + b.height <= a.y + 1

for (const [width, height] of [[1672, 941], [1366, 768], [390, 844]]) {
  test(`compact workspace keeps the email and AI in separate regions at ${width}x${height}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height })
    const body = Array.from({ length: 65 }, (_, i) => `Requirement ${i + 1}: review the supplier certification source and confirm missing facts.`).join('\n\n')
    const state = await ready(page, { details: emailDetail(first(), body) })
    const received = insights(page).getByRole('region', { name: 'Email Summary', exact: true }).locator('dt').filter({ hasText: /^Received$/ }).locator('xpath=following-sibling::dd[1]')
    await expect(received).toContainText('12:15')
    await expect(received).not.toContainText('12:14')
    await expect(page.locator('.sales-email-page-header')).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Breadcrumb', exact: true })).toHaveCount(0)
    await expect(page.getByText('Understand every email. Review the next action.', { exact: true })).toHaveCount(0)
    const toolbar = await page.locator('.sales-email-toolbar').boundingBox()
    const center = await page.locator('.sales-email-reading-pane').boundingBox()
    const side = await insights(page).boundingBox()
    expect(separate(center, side)).toBe(true)
    if (width >= 1024) {
      const compactHeader = await page.locator('.sales-email-page-header').boundingBox()
      const title = await page.getByRole('heading', { name: 'Email Intake', exact: true }).boundingBox()
      expect(compactHeader.height).toBeLessThanOrEqual(64)
      expect(title.height).toBeLessThanOrEqual(28)
      expect(title.x + title.width).toBeLessThanOrEqual(toolbar.x)
      expect(Math.abs((title.y + title.height / 2) - (toolbar.y + toolbar.height / 2))).toBeLessThanOrEqual(8)
      expect(toolbar.height).toBeLessThanOrEqual(64)
      expect((await page.locator('.sales-email-preview-header').boundingBox()).y).toBeLessThan(150)
      expect((await page.locator('.sales-email-reader-content').boundingBox()).height).toBeGreaterThan(200)
      expect(center.width).toBeGreaterThan(side.width)
      expect(center.x + center.width).toBeLessThanOrEqual(side.x)
      const reading = page.locator('.sales-email-reader-content')
      const before = await page.evaluate(() => ({ main: document.querySelector('main.main-content').scrollTop, page: document.scrollingElement.scrollTop, insights: document.querySelector('.sales-email-context__scroll').scrollTop }))
      await reading.focus()
      await page.keyboard.press('PageDown')
      await expect.poll(() => reading.evaluate(node => node.scrollTop)).toBeGreaterThan(0)
      expect(await page.evaluate(() => ({ main: document.querySelector('main.main-content').scrollTop, page: document.scrollingElement.scrollTop, insights: document.querySelector('.sales-email-context__scroll').scrollTop }))).toEqual(before)
      expect(await page.locator('.sales-email-toolbar').boundingBox()).toEqual(toolbar)
    } else {
      expect(side.y).toBeGreaterThanOrEqual(center.y + center.height - 1)
    }
    await selectTab(page, 'Ask AI')
    await expect(assistant(page)).toBeVisible()
    expect(await page.locator('.sales-email-reading-pane').getByRole('region', { name: 'Ask RADAI', exact: true }).count()).toBe(0)
    expect(separate(await page.locator('.sales-email-reading-pane').boundingBox(), await assistant(page).boundingBox())).toBe(true)
    await noOverflow(page)
    const accessibility = await new AxeBuilder({ page }).include('.sales-email-workspace').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
    expect(accessibility.violations).toEqual([])
    await page.screenshot({ path: testInfo.outputPath(`compact-insights-${width}x${height}.png`) })
    assertReadOnly(state)
  })
}

test('AI tabs support keyboard navigation while preserving the question and edited reply across tabs', async ({ page }) => {
  const state = await ready(page)
  const calls = await mockAssistant(page)
  const summary = tabs(page).getByRole('tab', { name: 'Summary', exact: true })
  await expect(summary).toHaveAttribute('aria-selected', 'true')
  await summary.focus()
  await page.keyboard.press('ArrowRight')
  await expect(tabs(page).getByRole('tab', { name: 'Evidence', exact: true })).toBeFocused()
  await page.keyboard.press('End')
  await expect(tabs(page).getByRole('tab', { name: 'Ask AI', exact: true })).toBeFocused()
  await question(page).fill('Which date needs confirmation?')
  await assistant(page).getByRole('button', { name: 'Draft reply', exact: true }).click()
  await expect(draft(page)).toBeVisible()
  await draft(page).fill('Please confirm the exact date before we proceed.')
  await selectTab(page, 'Summary')
  await expect(assistant(page)).toHaveCount(0)
  await expect(insights(page).getByRole('combobox', { name: 'Email type', exact: true })).toBeVisible()
  await selectTab(page, 'Evidence')
  await selectTab(page, 'Ask AI')
  await expect(question(page)).toHaveValue('Which date needs confirmation?')
  await expect(draft(page)).toHaveValue('Please confirm the exact date before we proceed.')
  expect(calls).toHaveLength(1)
  await tabs(page).getByRole('tab', { name: 'Ask AI', exact: true }).focus()
  await page.keyboard.press('Home')
  await expect(summary).toBeFocused()
  await expect(summary).toHaveAttribute('aria-selected', 'true')
  assertReadOnly(state)
})

test('changing source resets AI text and draft even after the assistant was hidden', async ({ page }) => {
  const state = await ready(page, { detailHandler: ({ url }) => ({ body: emailDetail(url.searchParams.get('message_id') === second().id ? second() : first()) }) })
  const calls = await mockAssistant(page)
  await selectTab(page, 'Ask AI')
  await question(page).fill('Private question for first source')
  await assistant(page).getByRole('button', { name: 'Draft reply', exact: true }).click()
  await expect(draft(page)).toBeVisible()
  await draft(page).fill('Private draft for first source')
  await selectTab(page, 'Summary')
  await row(page, second()).click()
  await expect(row(page, second())).toHaveAttribute('aria-pressed', 'true')
  await selectTab(page, 'Ask AI')
  await expect(question(page)).toHaveValue('')
  await expect(draft(page)).toHaveCount(0)
  await expect(insights(page)).not.toContainText('Private draft for first source')
  expect(calls).toHaveLength(1)
  assertReadOnly(state)
})

test('a pending answer completes in the correct AI tab after returning from Summary', async ({ page }) => {
  const state = await ready(page)
  let release
  const pending = new Promise(resolve => { release = resolve })
  const calls = await mockAssistant(page, pending)
  await selectTab(page, 'Ask AI')
  await question(page).fill('What is missing?')
  await assistant(page).getByRole('button', { name: 'Ask RADAI', exact: true }).click()
  await expect.poll(() => calls.length).toBe(1)
  await selectTab(page, 'Summary')
  release()
  await selectTab(page, 'Ask AI')
  await expect(assistant(page)).toContainText('The exact date requires confirmation.')
  await expect(question(page)).toHaveValue('What is missing?')
  expect(calls).toHaveLength(1)
  assertReadOnly(state)
})

test('the reader Reply action opens the local AI draft controls without submitting or sending', async ({ page }) => {
  const state = await ready(page)
  const calls = await mockAssistant(page)
  await reader(page).getByRole('button', { name: 'Reply', exact: true }).click()
  await expect(tabs(page).getByRole('tab', { name: 'Ask AI', exact: true })).toHaveAttribute('aria-selected', 'true')
  await expect(assistant(page).getByRole('button', { name: 'Draft reply', exact: true })).toBeVisible()
  expect(calls).toHaveLength(0)
  await assistant(page).getByRole('button', { name: 'Draft reply', exact: true }).click()
  await expect(draft(page)).toBeVisible()
  expect(calls.map(call => call.action)).toEqual(['draft_reply'])
  assertReadOnly(state)
})

test('the full subject expands safely and retains a usable reading area for a long hostile subject', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 })
  const subject = `Reminder ${'supplier certification renewal '.repeat(22)} <img src="https://untrusted.example.test/pixel" onerror="window.subjectInjected=true">`
  const record = first()
  record.subject = subject
  const state = await ready(page, { messages: listing([record]), details: emailDetail(record) })
  const title = reader(page).getByRole('heading', { name: subject, exact: true })
  const initial = await title.boundingBox()
  expect(initial.height).toBeLessThanOrEqual(64)
  const expand = reader(page).getByRole('button', { name: 'Full subject', exact: true })
  await expand.click()
  await expect(title).toHaveText(subject)
  await expect(reader(page).locator('img[src*="untrusted.example.test"]')).toHaveCount(0)
  expect(await page.evaluate(() => window.subjectInjected)).toBeUndefined()
  expect((await page.locator('.sales-email-reader-content').boundingBox()).height).toBeGreaterThan(100)
  await noOverflow(page)
  assertReadOnly(state)
})
