import { expect, test } from '@playwright/test'
import { Buffer } from 'node:buffer'
import * as XLSX from 'xlsx'

const archivePath = '/process-datasheet/datasheets/hmb-stream-consolidator/archive/'
const staleProject = '11111111-1111-4111-8111-111111111111'
const newProject = '22222222-2222-4222-8222-222222222222'
const storageKey = 'hmbExtractorActiveProject'

async function loadCase(page) {
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
    ['Stream', 'Temperature', 'Pressure', 'Mass Flow', 'Molecular Weight', 'Vapour Fraction'],
    ['(units)', 'F', 'psig', 'lb/hr', '', ''],
    ['2', 112.2, 180.8, 52870, 19.02, 0.002],
  ]), 'Streams')
  await page.goto('/tests/fixtures/hmb-stream-table-consolidator.html')
  await page.locator('input[type=file]').first().setInputFiles({
    name: 'Recovery.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }),
  })
  await expect(page.locator('.hmbc-case-panel').getByText('Recovery', { exact: true })).toBeVisible()
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(({ key, id }) => {
    localStorage.setItem(key, JSON.stringify({ project_id: id, name: 'Old project' }))
  }, { key: storageKey, id: staleProject })
})

for (const legacy of [false, true]) {
  test(`Save recovers from a missing project without losing extracted values (${legacy ? 'legacy' : 'coded'} response)`, async ({ page }) => {
    const submissions = []
    let saved = false
    const missing = { error: 'Project not found.', ...(legacy ? {} : { code: 'project_not_found' }) }
    await page.route('**/api/v1/**', async route => {
      const request = route.request()
      const url = new URL(request.url())
      if (url.pathname.endsWith('/project-organizer/projects/') && request.method() === 'POST') {
        await route.fulfill({ status: 201, json: { project_id: newProject, name: 'Recovered project' } })
        return
      }
      if (url.pathname.endsWith(archivePath)) {
        if (request.method() === 'POST') {
          const body = request.postDataBuffer()
          submissions.push(body)
          if (body.toString('latin1').includes(staleProject)) {
            await route.fulfill({ status: 404, json: missing })
            return
          }
          expect(body.toString('latin1')).toContain(newProject)
          const boundary = request.headers()['content-type'].split('boundary=')[1].replaceAll('"', '')
          const start = body.indexOf(Buffer.from('\r\n\r\n')) + 4
          const end = body.indexOf(Buffer.from(`\r\n--${boundary}`), start)
          const workbook = XLSX.read(body.subarray(start, end), { type: 'buffer' })
          expect(workbook.SheetNames).toEqual(['Summary', 'Comparison'])
          const rows = XLSX.utils.sheet_to_json(workbook.Sheets.Comparison, { header: 1 })
          expect(rows.flat()).toContain(112.2)
          saved = true
          await route.fulfill({ status: 201, json: { success: true, archive: { filename: 'Recovered.xlsx' } } })
          return
        }
        if (url.searchParams.get('project_id') === staleProject) {
          await route.fulfill({ status: 404, json: missing })
          return
        }
        await route.fulfill({ json: { success: true, results: saved ? [{
          id: '33333333-3333-4333-8333-333333333333', filename: 'Recovered.xlsx',
          created_at: '2026-10-30T12:00:00Z', case_count: 1,
        }] : [] } })
        return
      }
      await route.fulfill({ json: {} })
    })

    await loadCase(page)
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Create new project' })).toBeVisible()
    await expect(page.getByText(/The selected project could not be found/)).toBeVisible()
    expect(await page.evaluate(key => localStorage.getItem(key), storageKey)).toBeNull()
    await expect(page.locator('.hmbc-case-panel').getByText('Recovery', { exact: true })).toBeVisible()
    await page.getByPlaceholder('e.g., ADNOC LNG Train-3').fill('Recovered project')
    await page.getByRole('button', { name: 'Create project', exact: true }).click()
    await page.getByRole('tab', { name: 'Saved', exact: true }).click()
    await expect(page.getByText('Recovered.xlsx', { exact: true })).toBeVisible()
    expect(submissions).toHaveLength(2)
    const active = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey)
    expect(active.project_id).toBe(newProject)
    await expect(page.locator('.hmbc-case-panel').getByText('Recovery', { exact: true })).toBeVisible()
  })
}

for (const status of [403, 404]) {
  test(`Save HTTP ${status} without a missing-project response preserves project selection`, async ({ page }) => {
    await page.route('**/api/v1/**', async route => {
      if (route.request().method() === 'POST' && new URL(route.request().url()).pathname.endsWith(archivePath)) {
        await route.fulfill({ status, json: { error: status === 403 ? 'Access denied for this project.' : 'Not found.' } })
      } else {
        await route.fulfill({ json: { success: true, results: [] } })
      }
    })
    await loadCase(page)
    const response = page.waitForResponse(r => r.url().includes(archivePath) && r.request().method() === 'POST')
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await response
    await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeEnabled()
    await expect(page.getByRole('heading', { name: 'Create new project' })).toHaveCount(0)
    const active = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey)
    expect(active.project_id).toBe(staleProject)
    await expect(page.locator('.hmbc-case-panel').getByText('Recovery', { exact: true })).toBeVisible()
  })
}
