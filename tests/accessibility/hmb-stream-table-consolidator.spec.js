import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { Buffer } from 'node:buffer'
import { readFile } from 'node:fs/promises'
import * as XLSX from 'xlsx'

test('HMB Stream Table Consolidator loads supplied demos and builds the large comparison', async ({ page }) => {
  test.setTimeout(300000)
  let archivedWorkbook = null
  await page.addInitScript(() => {
    localStorage.setItem('hmbExtractorActiveProject', JSON.stringify({
      project_id: '11111111-1111-4111-8111-111111111111',
      name: 'Archive test project',
    }))
  })
  await page.route('**/api/v1/process-datasheet/datasheets/hmb-stream-consolidator/archive/**', async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname.endsWith('/download/')) {
      await route.fulfill({
        status: archivedWorkbook ? 200 : 404,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        body: archivedWorkbook || Buffer.from(''),
      })
      return
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        count: archivedWorkbook ? 1 : 0,
        results: archivedWorkbook ? [{
          id: '22222222-2222-4222-8222-222222222222',
          filename: 'HMB_Comparison_saved.xlsx',
          size_bytes: archivedWorkbook.length,
          created_at: '2026-10-05T12:00:00Z',
          case_count: 3,
          included_stream_count: 779,
          edited_value_count: 0,
        }] : [],
      }),
    })
  })
  await page.goto('/tests/fixtures/hmb-stream-table-consolidator.html')

  await expect(page.getByRole('heading', { name: 'HMB Stream Table Consolidator', level: 1 })).toBeVisible()
  await expect(page.getByText('Your source workbooks stay in this browser session.')).toBeVisible()

  const initialAccessibility = await new AxeBuilder({ page })
    .include('.hmbc-page')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze()
  expect(initialAccessibility.violations).toEqual([])

  await page.getByRole('button', { name: 'Load three real demo cases' }).click()
  await expect(page.getByText('3 cases', { exact: true })).toBeVisible({ timeout: 60000 })
  await expect(page.getByText('266/266 streams')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Case_A1b_HYSYS_Streams' })).toBeVisible()

  await page.getByRole('tab', { name: 'Comparison' }).click()
  await expect(page.getByRole('heading', { name: 'Cross-case comparison' })).toBeVisible({ timeout: 60000 })
  await expect(page.getByText('283 streams · 56,914 rows · 3 cases')).toBeVisible()
  await expect(page.getByText('12,940', { exact: true })).toBeVisible()

  const firstColumnFilter = page.getByRole('combobox', { name: 'Filter by stream or property' })
  await firstColumnFilter.selectOption({ index: 1 })
  const selectedStream = (await firstColumnFilter.locator('option:checked').textContent()).trim()
  await expect(page.locator('.hmbc-stream-band th')).toHaveCount(1)
  await expect(page.locator('.hmbc-stream-band th')).toHaveText(selectedStream)

  const propertyValue = await firstColumnFilter.locator('option').evaluateAll((options) =>
    options.find((option) => option.value.startsWith('property:'))?.value,
  )
  await firstColumnFilter.selectOption(propertyValue)
  const selectedProperty = propertyValue.slice('property:'.length)
  const filteredProperties = page.locator('.hmbc-comparison-table tbody tr:not(.hmbc-stream-band) th.is-sticky')
  await expect(filteredProperties.first()).toHaveText(selectedProperty)
  expect((await filteredProperties.allTextContents()).every((value) => value === selectedProperty)).toBe(true)
  await firstColumnFilter.selectOption('all')

  await page.getByRole('button', { name: 'Export Excel' }).click()
  const dialog = page.getByRole('dialog', { name: 'Export Excel comparison' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText('Summary sheet')).toBeVisible()
  await expect(dialog.getByText('Highlight cross-case variation')).toBeVisible()
  await expect(dialog.getByText('Flag reviewed overrides')).toBeVisible()

  const downloadPromise = page.waitForEvent('download')
  await dialog.getByRole('button', { name: 'Download workbook' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^HMB_Comparison_\d{4}-\d{2}-\d{2}\.xlsx$/)
  const workbookPath = await download.path()
  archivedWorkbook = await readFile(workbookPath)
  const workbook = XLSX.read(archivedWorkbook, { type: 'buffer' })
  expect(workbook.SheetNames).toEqual(['Summary', 'Comparison'])
  expect(XLSX.utils.decode_range(workbook.Sheets.Comparison['!ref']).e.r).toBeGreaterThan(56900)
  await expect(dialog).toHaveCount(0)

  await page.getByRole('button', { name: 'Reset session' }).click()
  await page.getByRole('alertdialog', { name: 'Reset this browser session?' })
    .getByRole('button', { name: 'Reset session' }).click()
  await expect(page.getByText('3 cases', { exact: true })).toHaveCount(0)

  await page.getByRole('button', { name: 'Open', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Saved project workbook' })).toBeVisible()
  await expect(page.getByText('HMB_Comparison_saved.xlsx', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Open workbook' }).click()

  await expect(page.getByText('3 cases', { exact: true })).toBeVisible({ timeout: 60000 })
  await expect(page.getByText('266/266 streams')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Case_A1b_HYSYS_Streams' })).toBeVisible()
})

test('reset requires explicit confirmation and can be cancelled', async ({ page }) => {
  test.setTimeout(120000)
  await page.goto('/tests/fixtures/hmb-stream-table-consolidator.html')
  await page.getByRole('button', { name: 'Load three real demo cases' }).click()
  await expect(page.getByText('3 cases', { exact: true })).toBeVisible({ timeout: 60000 })

  await page.getByRole('button', { name: 'Reset session' }).click()
  const dialog = page.getByRole('alertdialog', { name: 'Reset this browser session?' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Keep session' }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByText('3 cases', { exact: true })).toBeVisible()
})
