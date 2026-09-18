import { test, expect } from '@playwright/test'
import { planningInputsHarness, workBreakdownRecord } from '../fixtures/planning-inputs.fixture'

test.setTimeout(90000)

// Preserve source spelling, punctuation and distinct locations. These entries
// exercise register titles that the generic engineering catalogue cannot model.
const registerGroups = {
  general: { name: 'GENERAL', titles: [
    'MASTER DELIVERABLE REGISTER',
    'INTERNAL QUALITY AUDIT REPORT @30% OF ENGINEERING COMPLETION',
    'INTERNAL QUALITY AUDIT REPORT @60% OF ENGINEERING COMPLETION',
    'INTERNAL QUALITY AUDIT REPORT @90% OF ENGINEERING COMPLETION',
  ] },
  hse: { name: 'HSE', titles: [
    'FIRE & GAS DETECTOR LOCATION LAYOUT FOR PENTANE PLUS TANKS (6D-151A / 6D-152A / 6D-151B / 6D-152B) & PENTANE PLUS LOADING PUMPS (6G-151 A/B/C)',
  ] },
  instrumentation: { name: 'INSTRUMENTATION', titles: ['FIELD INSTRUMENT DATA SHEETS'] },
  electrical: { name: 'ELECTRICAL', titles: ['ELECTRICAL LOAD LIST'] },
  civil: { name: 'CIVIL', titles: ['FOUNDATION DETAILS - AREA 6'] },
  hvac: { name: 'HVAC', titles: ['HVAC ADEQUEACY REPORT -FAR-0', 'HVAC ADEQUEACY REPORT -FAR-6'] },
}
const allTitles = Object.values(registerGroups).flatMap(group => group.titles)
const previewPanel = page => page.locator('.pln-intelligence-preview')
const titleCheckbox = (page, title) => previewPanel(page).locator('label').filter({ has: page.getByText(title, { exact: true }) }).getByRole('checkbox')
const clean = state => {
  expect(state.unknown).toEqual([])
  expect(state.pageErrors).toEqual([])
}

async function openRegisterPreview(page) {
  const state = await planningInputsHarness(page, {
    populated: true,
    prepare(current) {
      const record = current.records[17]
      const run = record.runs.find(item => item.status === 'succeeded')
      record.conflicts = []
      record.files[0] = { ...record.files[0], category: 'mdr', original_filename: 'MDR.xlsx', content_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
      const factTemplate = record.facts[0]
      record.facts = []
      let item = 0
      const disciplines = Object.fromEntries(Object.entries(registerGroups).map(([code, group]) => {
        const registerRows = group.titles.map(title => ({ title, register_item: ++item, source_file_id: 801, sheet: 'MDR', line: item + 10 }))
        record.facts.push(...registerRows.map(row => ({ ...factTemplate,
          id: 1000 + row.register_item, fact_type: 'deliverable', key: `${code}:${row.register_item}`,
          value: { discipline: code, name: row.title }, source_filename: 'MDR.xlsx', source_excerpt: row.title,
          source_locator: { sheet: row.sheet, line: row.line, register_item: row.register_item }, status: 'detected',
        })))
        return [code, { name: group.name, in_scope: true, deliverables: [...group.titles], mentioned_in_source: [...group.titles], ai_discovered: [], excluded_deliverables: [], register_rows: registerRows }]
      }))
      Object.assign(run, { fact_count: record.facts.length, conflict_count: 0 })
      Object.assign(run.intelligence, {
        deliverable_source: 'register', register_summary: { row_count: allTitles.length, source_file_count: 1 },
        disciplines, hse_studies: [], available_hse_studies: [], ai_review: null, ai_scope: null,
        evidence_summary: { fact_count: record.facts.length, confirmed_count: 0, conflict_count: 0 }, open_conflicts: [], notes: [],
      })
    },
    async handleRequest({ route, path, state, reply }) {
      if (path.endsWith('/work-breakdown/') && route.request().method() === 'GET') {
        const body = workBreakdownRecord(state.records[17])
        body.disciplines = body.disciplines.map(group => ({ ...group, name: registerGroups[group.code].name }))
        await reply(route, body)
        return true
      }
      return false
    },
  })
  await expect(page.locator('.planning-design')).toBeVisible()
  await expect(page.getByRole('complementary', { name: 'AI input review', exact: true })).not.toContainText('Loading extracted inputs')
  await page.getByRole('navigation', { name: 'Planning stages', exact: true }).getByRole('button', { name: /Work breakdown/ }).click()
  await expect(page.getByRole('heading', { name: 'Document Intelligence Preview', exact: true })).toBeVisible()
  return state
}

test('register preview preserves exact source groups and titles through confirmation, WBS and reload', async ({ page }) => {
  const state = await openRegisterPreview(page)
  const preview = previewPanel(page)
  await expect(preview.getByText(`${allTitles.length} register deliverables`, { exact: true })).toBeVisible()
  for (const group of Object.values(registerGroups)) await expect(preview.getByRole('checkbox', { name: new RegExp(`${group.name}$`) })).toBeChecked()
  for (const title of allTitles) await expect(titleCheckbox(page, title)).toBeChecked()
  await expect(preview.getByRole('checkbox')).toHaveCount(allTitles.length + Object.keys(registerGroups).length)
  await expect(preview.getByText('Piping Material Specification', { exact: true })).toHaveCount(0)
  await expect(preview.getByRole('heading', { name: 'HSE Studies', exact: true })).toHaveCount(0)
  await preview.getByRole('button', { name: /HVAC.*2\/2 deliverable/ }).click()
  await expect(preview.getByText('Deliverables from the uploaded register for HVAC. Titles and order match the source rows.', { exact: true })).toBeVisible()
  await expect(preview.getByText(/the rest fall back to the standard catalogue/)).toHaveCount(0)
  await preview.getByRole('button', { name: /HVAC.*2\/2 deliverable/ }).click()

  await page.getByRole('button', { name: /^Confirm & save.*Work breakdown$/ }).click()
  await expect(page.getByRole('heading', { name: 'Work breakdown', exact: true })).toBeVisible()
  const confirmation = state.writes.find(write => write.path.endsWith('/confirm-preview/'))
  expect(Object.keys(confirmation.data.preview.disciplines)).toEqual(Object.keys(registerGroups))
  expect(confirmation.data.preview.hse_studies).toEqual([])
  for (const [code, group] of Object.entries(registerGroups)) {
    expect(confirmation.data.preview.disciplines[code]).toEqual({ in_scope: true, deliverables: group.titles, excluded_deliverables: [] })
    await expect(page.getByRole('button', { name: `Collapse ${group.name}`, exact: true })).toBeVisible()
  }
  const table = page.getByRole('region', { name: 'Work breakdown tasks', exact: true })
  await expect(table.locator('.wbd-task-title')).toHaveText(allTitles)

  await page.reload()
  await page.getByRole('button', { name: 'Next: Document Intelligence Preview', exact: true }).click()
  for (const title of allTitles) await expect(titleCheckbox(page, title)).toBeChecked()
  await expect(page.getByRole('button', { name: 'Continue to Work breakdown', exact: true })).toBeEnabled()
  clean(state)
})

test('long register titles wrap on narrow screens and distinct FAR locations remain individually selectable', async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 932 })
  const state = await openRegisterPreview(page)
  const longTitle = registerGroups.hse.titles[0]
  const text = previewPanel(page).getByText(longTitle, { exact: true })
  await expect(text).toBeVisible()
  const dimensions = await text.evaluate(element => ({
    whiteSpace: getComputedStyle(element).whiteSpace,
    textOverflow: getComputedStyle(element).textOverflow,
    width: element.clientWidth,
    scrollWidth: element.scrollWidth,
    height: element.clientHeight,
    lineHeight: parseFloat(getComputedStyle(element).lineHeight),
  }))
  expect(dimensions.whiteSpace).toBe('normal')
  expect(dimensions.textOverflow).not.toBe('ellipsis')
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width + 1)
  expect(dimensions.height).toBeGreaterThan(dimensions.lineHeight * 2)
  await titleCheckbox(page, 'HVAC ADEQUEACY REPORT -FAR-0').uncheck()
  await expect(titleCheckbox(page, 'HVAC ADEQUEACY REPORT -FAR-6')).toBeChecked()
  await page.getByRole('button', { name: /^Confirm & save.*Work breakdown$/ }).click()
  await expect(page.getByRole('heading', { name: 'Work breakdown', exact: true })).toBeVisible()
  const preview = state.writes.find(write => write.path.endsWith('/confirm-preview/')).data.preview
  expect(preview.disciplines.hvac.deliverables).toEqual(registerGroups.hvac.titles)
  expect(preview.disciplines.hvac.excluded_deliverables).toEqual(['HVAC ADEQUEACY REPORT -FAR-0'])
  const table = page.getByRole('region', { name: 'Work breakdown tasks', exact: true })
  await expect(table.getByRole('button', { name: 'HVAC ADEQUEACY REPORT -FAR-0', exact: true })).toHaveCount(0)
  await expect(table.getByRole('button', { name: 'HVAC ADEQUEACY REPORT -FAR-6', exact: true })).toBeVisible()
  clean(state)
})
