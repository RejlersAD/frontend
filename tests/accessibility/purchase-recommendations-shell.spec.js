import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { createHash } from 'node:crypto'
import { Buffer } from 'node:buffer'
import { readFile, writeFile } from 'node:fs/promises'
import { recommendationHarness } from '../fixtures/purchase-recommendations.fixture'

test.setTimeout(150000)
test.use({ serviceWorkers: 'block' })

const protectedFiles = ['src/components/Layout/Sidebar.jsx', 'src/components/Layout/Sidebar.css', 'src/config/layout.config.js']
const digest = async path => createHash('sha256').update(await readFile(path)).digest('hex')
const shellMeasurements = page => page.evaluate(() => {
  const measure = selector => {
    const element = document.querySelector(selector)
    if (!element) return null
    const bounds = element.getBoundingClientRect(), style = getComputedStyle(element)
    return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height, bottom: bounds.bottom, right: bounds.right,
      font: style.fontFamily, fontSize: style.fontSize, lineHeight: style.lineHeight, fontWeight: style.fontWeight,
      padding: style.padding, zoom: style.zoom, overflowX: style.overflowX, overflowY: style.overflowY,
      clientWidth: element.clientWidth, scrollWidth: element.scrollWidth, clientHeight: element.clientHeight, scrollHeight: element.scrollHeight }
  }
  return { location: location.href, width: innerWidth, height: innerHeight, devicePixelRatio, visualViewportScale: visualViewport?.scale,
    html: measure('html'), sidebar: measure('#application-sidebar'), header: measure('#application-content > header'),
    main: measure('main.main-content'), footer: measure('#application-content > footer'), workspace: measure('.purchase-recommendations-workspace'),
    pageHeader: measure('.purchase-recommendations-workspace .prw-header'), title: measure('.purchase-recommendations-workspace h1'), kpis: measure('.purchase-recommendations-workspace .prw-kpis'),
    filters: measure('.purchase-recommendations-workspace .prw-filters'), register: measure('[aria-label="Recommendation register"]'),
    table: measure('.purchase-recommendations-workspace .prw-register-table'), tableCell: measure('.purchase-recommendations-workspace .prw-register-table td'),
    grid: measure('.purchase-recommendations-workspace .prw-grid'), details: measure('[aria-label="Recommendation details"]'), workload: measure('.purchase-recommendations-workspace .prw-workload'),
    detailBlocks: [...document.querySelectorAll('[aria-label="Recommendation details"] > *, [aria-label="Recommendation details"] .prw-detail-body > *')].map(element => {
      const bounds = element.getBoundingClientRect(), style = getComputedStyle(element)
      return { tag: element.tagName, class: element.className, y: bounds.y, height: bounds.height, bottom: bounds.bottom, fontSize: style.fontSize, color: style.color }
    }) }
})

test('actual App shell at three desktop widths serves current source and preserves Sidebar', async ({ page, request }) => {
  page.on('pageerror', error => console.log('Actual App runtime error:', error.message))
  const before = Object.fromEntries(await Promise.all(protectedFiles.map(async path => [path, await digest(path)])))
  const sourceResponse = await request.get('/src/pages/Procurement/PurchaseRecommendations.jsx')
  console.log('Current served source retrieved', sourceResponse.status())
  expect(sourceResponse.ok()).toBeTruthy()
  const servedSource = await sourceResponse.text()
  expect(servedSource).toContain('Purchase Recommendations')
  const sourceMap = servedSource.match(/sourceMappingURL=data:application\/json;base64,([^\s]+)/)
  const originalSource = sourceMap ? JSON.parse(Buffer.from(sourceMap[1], 'base64').toString()).sourcesContent?.[0] : null
  expect(originalSource, 'Vite source map must include the current component source').toBeTruthy()
  const diskSource = await readFile('src/pages/Procurement/PurchaseRecommendations.jsx', 'utf8')
  if (originalSource) expect(originalSource.replace(/\r\n/g, '\n')).toBe(diskSource.replace(/\r\n/g, '\n'))
  await page.setViewportSize({ width: 1672, height: 941 })
  const state = await recommendationHarness(page, { realApp: true })
  console.log('Actual App navigation completed', state.unknown)
  await expect(page.getByRole('heading', { name: 'Purchase Recommendations', exact: true })).toBeVisible({ timeout: 100000 })
  await expect(page.getByRole('complementary', { name: 'Recommendation details' })).toHaveAttribute('aria-busy', 'false')
  const details = page.getByRole('complementary', { name: 'Recommendation details' })
  await expect(details.getByRole('list', { name: 'Recommendation lifecycle' }).getByRole('listitem')).toHaveCount(5)
  for (const label of ['Scope & quantity', 'Supplier compliance', 'Commercial evaluation', 'Budget validation', 'Required attachments', 'Conflict declaration']) {
    await expect(details.locator('.prr-readiness-item').filter({ hasText: label })).toHaveCount(1)
  }
  await expect(details.locator('.prr-readiness-item').filter({ hasText: 'Supplier compliance' })).toContainText('Not recorded')
  await expect(details.locator('.prr-readiness-item').filter({ hasText: 'Required attachments' })).toContainText('Not recorded')
  // The reference shows a recommendation eligible for conversion. First verify
  // default selection above, then select the fixture's genuinely approved row.
  await page.getByRole('button', { name: 'Select RAD-PRJ-PR-0004_2026', exact: true }).click()
  await expect(details).toHaveAttribute('aria-busy', 'false')
  await expect(details).toContainText('Approved pump procurement package')
  await expect(page.locator('#application-sidebar')).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  const measurements = [], conversionChecks = []
  for (const width of [1672, 1440, 1366]) {
    await page.setViewportSize({ width, height: 941 })
    await page.locator('main.main-content').evaluate(element => { element.scrollTop = 0 })
    await expect.poll(async () => (await page.locator('#application-sidebar').boundingBox())?.width).toBe(250)
    measurements.push(await shellMeasurements(page))
    await page.screenshot({ path: `../artifacts/purchase-recommendations-real-shell-${width}.png` })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy()
    const conversion = await details.getByRole('button', { name: 'Create purchase order', exact: true }).boundingBox()
    const main = await page.locator('main.main-content').boundingBox()
    conversionChecks.push({ width, conversion, visibleMainBottom: main.y + main.height })
  }
  const accessibility = await new AxeBuilder({ page }).include('.purchase-recommendations-workspace').include('#application-content > footer').analyze()
  await page.locator('.purchase-recommendations-workspace').getByRole('link', { name: /^Purchase Orders/ }).click()
  await expect(page.getByRole('heading', { name: 'Purchase Orders', exact: true })).toBeVisible()
  await expect(page.locator('.purchase-recommendations-workspace')).toHaveCount(0)
  await expect.poll(async () => (await page.locator('#application-content > footer').boundingBox())?.height).toBe(69)
  const purchaseOrdersShell = await shellMeasurements(page)
  expect(purchaseOrdersShell.sidebar.width).toBe(250)
  expect(purchaseOrdersShell.header.height).toBe(56)
  const after = Object.fromEntries(await Promise.all(protectedFiles.map(async path => [path, await digest(path)])))
  expect(after).toEqual(before)
  const evidence = { capturedAt: new Date().toISOString(), servedUrl: sourceResponse.url(), servedStatus: sourceResponse.status(),
    currentSourceMatched: Boolean(originalSource), servedSourceSha256: createHash('sha256').update(servedSource).digest('hex'),
    protectedFilesBefore: before, protectedFilesAfter: after, measurements, conversionChecks, purchaseOrdersShell,
    accessibility: accessibility.violations.map(({ id, impact, nodes }) => ({ id, impact, nodes: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })) })),
    requests: state.requests, unknown: state.unknown, pageErrors: state.pageErrors }
  await writeFile('../artifacts/purchase-recommendations-real-shell-evidence.json', JSON.stringify(evidence, null, 2))
  console.log(JSON.stringify({ measurements, unknown: state.unknown, pageErrors: state.pageErrors, accessibility: evidence.accessibility }, null, 2))
  expect(state.pageErrors).toEqual([])
  expect(state.unknown).toEqual([])
  expect(state.requests.filter(({ path, method }) => method !== 'GET' && !path.includes('/ai-champion/'))).toEqual([])
  expect(accessibility.violations.filter(value => ['critical', 'serious'].includes(value.impact))).toEqual([])
  for (const { width, conversion, visibleMainBottom } of conversionChecks) {
    expect(conversion, 'An eligible recommendation must expose its conversion action').not.toBeNull()
    expect(conversion.y + conversion.height, `Conversion action must be above the shared footer at ${width}px`).toBeLessThanOrEqual(visibleMainBottom)
  }
})

test('actual App mobile shell keeps the register and navigation usable without page overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const state = await recommendationHarness(page, { realApp: true })
  await expect(page.getByRole('heading', { name: 'Purchase Recommendations', exact: true })).toBeVisible({ timeout: 100000 })
  await expect(page.getByRole('complementary', { name: 'Recommendation details' })).toHaveAttribute('aria-busy', 'false')
  await expect(page.getByRole('button', { name: 'Open sidebar', exact: true })).toBeVisible()
  const measurements = await shellMeasurements(page)
  expect(measurements.html.scrollWidth).toBe(390)
  expect(measurements.main.scrollWidth).toBe(measurements.main.clientWidth)
  const result = await new AxeBuilder({ page }).include('.purchase-recommendations-workspace').include('#application-content > footer').analyze()
  await page.locator('main.main-content').evaluate(element => { element.scrollTop = 0 })
  await page.screenshot({ path: '../artifacts/purchase-recommendations-real-shell-mobile.png' })
  await page.getByRole('complementary', { name: 'Recommendation details' }).getByRole('heading', { name: 'Recommendation details', exact: true }).scrollIntoViewIfNeeded()
  await page.screenshot({ path: '../artifacts/purchase-recommendations-real-shell-mobile-details.png' })
  await writeFile('../artifacts/purchase-recommendations-real-shell-mobile-evidence.json', JSON.stringify({ measurements, violations: result.violations, requests: state.requests, unknown: state.unknown, pageErrors: state.pageErrors }, null, 2))
  expect(state.pageErrors).toEqual([])
  expect(state.unknown).toEqual([])
  expect(state.requests.filter(({ path, method }) => method !== 'GET' && !path.includes('/ai-champion/'))).toEqual([])
  expect(result.violations.filter(value => ['critical', 'serious'].includes(value.impact))).toEqual([])
})
