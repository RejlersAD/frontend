import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import * as XLSX from 'xlsx'
import { make1032Cases } from '../fixtures/hmb-governing-cases.mjs'

test.use({ serviceWorkers: 'block' })

function sourceWorkbook(item) {
  const properties = item.streams[0].properties
  const workbook = XLSX.utils.book_new()
  const overall = properties.filter(p => !p.section)
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
    [item.name], ['Stream', ...overall.map(p => p.name)],
    ['(units)', ...overall.map(p => p.unit)], ['1032', ...overall.map(p => p.value)],
  ]), 'Streams')
  const phaseProperties = properties.filter(p => p.section && p.section !== 'Composition')
  const names = [...new Set(phaseProperties.map(p => p.name))]
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
    ['Stream', 'Phase', ...names],
    ['', '', ...names.map(name => phaseProperties.find(p => p.name === name).unit)],
    ...['Vapour', 'Light Liquid', 'Heavy Liquid'].map(section => [
      '1032', { Vapour: 'Vapour Phase', 'Light Liquid': 'Liquid Phase', 'Heavy Liquid': 'Aqueous Phase' }[section],
      ...names.map(name => phaseProperties.find(p => p.name === name && p.section === section)?.value ?? null),
    ]),
  ]), 'Phase Properties')
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
    ['Stream', 'Phase', 'Component', 'Mole Fraction'], ['', '', '', 'mol frac.'],
    ...properties.filter(p => p.section === 'Composition').map(p => ['1032', 'Overall', p.name, p.value]),
  ]), 'Compositions')
  return { name: item.fileName, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) }
}

test('1032 Max Gas/Liquid/Water copy complete phase-aware case columns in the table and XLSX', async ({ page }) => {
  test.setTimeout(90000)
  await page.route('**/api/v1/**', route => route.fulfill({ json: { results: [] } }))
  await page.goto('/tests/fixtures/hmb-stream-table-consolidator.html')
  await page.locator('input[type=file]').first().setInputFiles(make1032Cases().map(sourceWorkbook))
  await expect(page.getByText('8 cases', { exact: true })).toBeVisible()
  await page.getByRole('tab', { name: 'Compare', exact: true }).click()
  await page.getByRole('combobox', { name: 'Filter by stream or property' }).selectOption('stream:1032')
  const names = (await page.locator('.hmbc-column-case').allTextContents()).map(name => name.trim())
  const indices = ['B1a', 'B1a', 'A2b'].map(name => names.indexOf(name))
  expect(indices.every(index => index >= 0)).toBe(true)
  const rows = await page.locator('.hmbc-comparison-table tbody tr:not(.hmbc-stream-band)').evaluateAll(elements => {
    let section = ''
    return elements.map(row => {
      if (row.querySelector('.hmbc-phase-cell')) section = row.querySelector('.hmbc-phase-cell').textContent.trim()
      return { section, property: row.querySelector('.hmbc-property-cell').textContent.trim(),
        values: [...row.querySelectorAll('td')].map(cell => cell.textContent.trim()),
        titles: [...row.querySelectorAll('.hmbc-max-cell')].map(cell => cell.title) }
    })
  })
  expect(rows.length).toBeGreaterThan(50)
  for (const row of rows) {
    indices.forEach((index, maxIndex) => {
      expect(row.values[names.length + 1 + maxIndex], `${row.section} / ${row.property}`).toBe(row.values[index + 1])
      expect(row.titles[maxIndex]).toContain(`governing case: ${['B1a', 'B1a', 'A2b'][maxIndex]}`)
    })
  }
  const gas = rows.find(row => row.section === 'Vapour' && row.property === 'Std Gas Flow')
  expect(gas.values[names.length + 2]).toBe('5.632')
  const compressibility = rows.find(row => row.section === 'Vapour' && row.property === 'Compressibility')
  expect(compressibility.values[names.length + 2]).not.toBe('—')

  await page.getByRole('button', { name: 'Export Excel', exact: true }).click()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download workbook', exact: true }).click()
  const download = await downloadPromise
  const workbook = XLSX.read(await readFile(await download.path()), { type: 'buffer' })
  const sheetRows = XLSX.utils.sheet_to_json(workbook.Sheets.Comparison, { header: 1, defval: null })
  const header = sheetRows[1]
  for (const row of sheetRows.slice(2).filter(row => row[1])) {
    expect(row[header.indexOf('Max Gas')]).toBe(row[header.indexOf('B1a')])
    expect(row[header.indexOf('Max Liquid')]).toBe(row[header.indexOf('B1a')])
    expect(row[header.indexOf('Max Water')]).toBe(row[header.indexOf('A2b')])
  }
  expect(sheetRows.find(row => row[1] === 'Mass Flow [Vapour]')[header.indexOf('Max Gas')]).toBe(14900)
  expect(sheetRows.find(row => row[1] === 'Mass Flow [Light Liquid]')[header.indexOf('Max Liquid')]).toBe(305800)
  expect(sheetRows.find(row => row[1] === 'Mass Flow [Heavy Liquid]')[header.indexOf('Max Water')]).toBe(1386000)
})
