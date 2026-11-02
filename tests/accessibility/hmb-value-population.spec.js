import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import * as XLSX from 'xlsx'

test.use({ serviceWorkers: 'block' })

test('Review populates converted actual flows for every stream, including zero/tiny values, and edits preserve source units', async ({ page }) => {
  test.setTimeout(90000)
  await page.route('**/api/v1/**', route => route.fulfill({ json: { results: [] } }))
  const workbook = XLSX.utils.book_new()
  const streams = ['7', '12', '33']
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
    ['Stream', 'Temperature', 'Pressure', 'Mass Flow', 'Molecular Weight', 'Vapour / Phase Fraction'],
    ['(units)', 'F', 'psig', 'lb/hr', '', ''],
    ...streams.map(name => [name, 100, 150, 1000, 20, 0.5]),
  ]), 'Streams')
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
    ['Stream', 'Phase', 'Mass Flow', 'Std. Gas Flow', 'Act. Volume Flow'],
    ['', '', 'lb/hr', 'MMSCFD', 'barrel/day'],
    ...streams.flatMap((name, i) => [
      [name, 'Vapour Phase', 100, i + 1, [0, 240, 3.826e-10][i]],
      [name, 'Liquid Phase', 200, 10, [0, 24, 12][i]],
      [name, 'Aqueous Phase', 300, 20, [0, 10, 1][i]],
    ]),
  ]), 'Phase Properties')
  await page.goto('/tests/fixtures/hmb-stream-table-consolidator.html')
  await page.locator('input[type=file]').first().setInputFiles({
    name: 'AllStreams.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }),
  })
  const rows = page.locator('.hmbc-table tbody tr')
    .filter({ has: page.locator('.hmbc-property-cell', { hasText: /^Actual Volume Flow$/ }) })
    .filter({ has: page.locator('.hmbc-unit', { hasText: /^ft3\/hr$/ }) })
  await expect(rows).toHaveCount(3)
  const values = rows.first().locator('.hmbc-review-value button')
  await expect(values.nth(0)).toHaveText('0')
  await expect(values.nth(1)).toHaveText('56.1458')
  await expect(values.nth(2)).toHaveText('8.951e-11')
  await values.nth(1).click()
  await page.getByRole('textbox', { name: 'Edit extracted value', exact: true }).fill('100')
  await page.getByRole('textbox', { name: 'Edit extracted value', exact: true }).press('Enter')
  await expect(values.nth(1)).toHaveText('100')
  await page.getByRole('tab', { name: 'Compare', exact: true }).click()
  const compared = await page.locator('.hmbc-comparison-table tbody tr').evaluateAll(rows => {
    let stream = '', section = ''
    for (const row of rows) {
      if (row.classList.contains('hmbc-stream-band')) { stream = row.textContent.trim(); continue }
      if (row.querySelector('.hmbc-phase-cell')) section = row.querySelector('.hmbc-phase-cell').textContent.trim()
      if (stream === '12' && section === 'Vapour' && row.querySelector('.hmbc-property-cell')?.textContent === 'Actual Volume Flow') {
        return row.querySelectorAll('td')[1].textContent
      }
    }
    return null
  })
  expect(compared).toBe('100')
  await page.getByRole('button', { name: 'Export Excel', exact: true }).click()
  const downloading = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download workbook', exact: true }).click()
  const file = await downloading
  const saved = XLSX.read(await readFile(await file.path()), { type: 'buffer' })
  const exported = XLSX.utils.sheet_to_json(saved.Sheets.Comparison, { header: 1, defval: null })
  let stream = '', sourceRow
  for (const row of exported.slice(2)) {
    if (row[0] && !row[1]) stream = String(row[0])
    if (stream === '12' && row[1] === 'Act. Volume Flow [Vapour]') sourceRow = row
  }
  expect(sourceRow[2]).toBe('barrel/day')
  expect(sourceRow[3]).toBeCloseTo(100 * 24 / 5.614583333333333, 8)
})
