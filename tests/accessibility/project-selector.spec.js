import { test, expect } from '@playwright/test'
import { scheduleHarness } from '../fixtures/schedule-performance.fixture'

test.setTimeout(60000)
test.use({ viewport: { width: 1440, height: 900 } })

const lateProject = {
  id: 149, code: '5901999', name: 'Replacement and Upgrade of Wellhead SCADA System at Central Control Room and Offshore Production Facilities including Telecommunications Integration',
  client_name: 'ADNOC Offshore', status: 'planning',
}
const picker = page => page.getByRole('combobox', { name: 'Active Project', exact: true, includeHidden: true })
const options = page => page.getByRole('listbox', { name: 'Active Project results', exact: true })
const reply = (route, body) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) })

async function harness(page) {
  const state = await scheduleHarness(page, { query: 'project=17&shell=true', prepare: fixture => {
    const base = fixture.records[17], linked = fixture.records[18]
    fixture.records = { 17: base }
    for (let index = 0; index < 50; index += 1) {
      const id = 100 + index, record = structuredClone(index === 49 ? linked : base)
      record.project = { ...record.project, id, code: String(5900800 + index), name: `Engineering and Procurement Services for Process Facilities Package ${index + 1}`, client_name: 'ADNOC Onshore', status: 'planning' }
      if (index === 0) Object.assign(record.project, { code: '5900738', name: 'EPCM-Grid Power Integration Project', client_name: 'Grid Operations' })
      if (index === 47) Object.assign(record.project, { code: '5900738-10', name: 'Grid Power Integration Phase 10' })
      if (index === 48) Object.assign(record.project, { code: '5900738-2', name: 'Grid Power Integration Phase 2' })
      if (index === 49) Object.assign(record.project, lateProject)
      Object.assign(record.planningProject, { enterprise_project: id, name: record.project.name, client: record.project.client_name })
      fixture.records[id] = record
    }
  } })
  state.pageErrors = []
  page.on('pageerror', error => state.pageErrors.push(error.message))
  await expect(page.getByRole('heading', { name: 'Residue Yield Improvement Project', exact: true })).toBeVisible()
  await page.locator('summary[aria-label="More project actions"]').click()
  await expect(picker(page)).toBeEnabled()
  return state
}

test('Active Project includes Planning records and searches combined code, full name, and client across 51 projects', async ({ page }) => {
  const state = await harness(page)
  const selector = picker(page)
  await selector.fill('')
  await expect(options(page).getByRole('option')).toHaveCount(51)
  await expect(options(page).getByRole('option').nth(0)).toContainText('5900738')
  await expect(options(page).getByRole('option').nth(1)).toContainText('5900738-2')
  await expect(options(page).getByRole('option').nth(2)).toContainText('5900738-10')
  await page.screenshot({ path: '../artifacts/active-project-dropdown.png' })
  for (const query of ['EPCM-Grid', 'Grid Operations', '5900738 EPCM', '5900738 EPCM Grid Operations']) {
    await selector.fill(query)
    await expect(options(page).getByRole('option')).toHaveCount(1)
    await expect(options(page).getByRole('option')).toContainText('EPCM-Grid Power Integration Project')
  }
  expect(state.records[100].project.status).toBe('planning')
  await expect(page).toHaveURL(/project=17/)
  await selector.press('Escape')
  await expect(selector).toHaveValue('5900913 — Residue Yield Improvement Project')
  expect(state.requests.filter(request => request.method !== 'GET')).toEqual([])
  expect(state.unknown).toEqual([])
  expect(state.pageErrors).toEqual([])
})

test('long project names wrap fully and keyboard matching selects the correct naturally sorted option', async ({ page }) => {
  const state = await harness(page)
  const selector = picker(page)
  await selector.fill(lateProject.code)
  const name = options(page).getByText(lateProject.name, { exact: true })
  await expect(name).toBeVisible()
  const layout = await name.evaluate(element => ({ height: element.getBoundingClientRect().height, lineHeight: parseFloat(getComputedStyle(element).lineHeight), width: element.clientWidth, scrollWidth: element.scrollWidth, whiteSpace: getComputedStyle(element).whiteSpace, textOverflow: getComputedStyle(element).textOverflow }))
  expect(layout.height).toBeGreaterThan(layout.lineHeight)
  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.width)
  expect(layout.whiteSpace).toBe('normal')
  expect(layout.textOverflow).not.toBe('ellipsis')
  await selector.fill('no matching project')
  await expect(options(page)).toContainText('No projects match your search.')
  await selector.press('ArrowDown'); await selector.press('Enter')
  await expect(page).toHaveURL(/project=17/)
  await selector.fill('5900738')
  await expect(options(page).getByRole('option')).toHaveCount(3)
  await selector.press('ArrowDown'); await selector.press('Enter')
  await expect(page).toHaveURL(/project=148/)
  await expect(selector).toHaveValue('5900738-2 — Grid Power Integration Phase 2')
  await expect(selector).toHaveAttribute('title', '5900738-2 — Grid Power Integration Phase 2')
  await expect(selector).toHaveAttribute('aria-expanded', 'false')
  expect(state.pageErrors).toEqual([])
})

test('a project beyond the first API page keeps its selected identity when opening Master Schedule', async ({ page }) => {
  const state = await harness(page)
  const projectPages = []
  const records = Object.values(state.records).map(record => record.project)
  await page.route(url => url.pathname === '/api/v1/projects/', route => {
    const pageNumber = Number(new URL(route.request().url()).searchParams.get('page') || 1)
    projectPages.push(pageNumber)
    return reply(route, { count: records.length, next: pageNumber === 1 ? '/api/v1/projects/?page=2' : null, previous: pageNumber === 2 ? '/api/v1/projects/?page=1' : null, results: pageNumber === 1 ? records.slice(0, 50) : records.slice(50) })
  })
  await page.getByRole('button', { name: 'Refresh project', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Update progress', exact: true })).toBeEnabled()
  expect(projectPages).toEqual([1, 2])
  await page.locator('summary[aria-label="More project actions"]').click()
  const selector = picker(page)
  await selector.fill(lateProject.code)
  await options(page).getByRole('option', { name: new RegExp(lateProject.code) }).click()
  await expect(page).toHaveURL(/project=149/)
  await expect(selector).toHaveValue(`${lateProject.code} — ${lateProject.name}`)
  await page.locator('summary[aria-label="More project actions"]').click()
  await selector.press('ArrowDown')
  const activeId = await selector.getAttribute('aria-activedescendant')
  const activeOption = page.locator(`[id="${activeId}"]`)
  await expect(activeOption).toHaveAttribute('aria-selected', 'true')
  const optionBox = await activeOption.boundingBox(), listBox = await options(page).boundingBox()
  expect(optionBox.y).toBeGreaterThanOrEqual(listBox.y)
  expect(optionBox.y + optionBox.height).toBeLessThanOrEqual(listBox.y + listBox.height + 1)
  await selector.press('Escape')
  const target = state.records[lateProject.id]
  await page.route('**/planning-intelligence/projects/1071/enterprise-contract/', route => reply(route, { project: target.planningProject, enterprise_project: target.project, linked: true, in_sync: true, differences: [], lifecycle: 'baselined', baseline_locked: true, baseline: target.baselines[0] }))
  await page.route(`**/planning-intelligence/projects/${target.planningProject.id}/simple-plan/`, route => {
    if (route.request().method() !== 'GET') return route.fallback()
    return reply(route, { project_id: target.planningProject.id, state: 'inputs', revision: 0, tasks: [], disciplines: [], permissions: { can_edit: false } })
  })
  const beforePlanner = state.requests.length
  await page.getByRole('navigation', { name: 'Project work areas', exact: true }).getByRole('button', { name: 'Schedule', exact: true }).click()
  await expect(page).toHaveURL(/project=149/)
  await expect(page).toHaveURL(/view=plan-baseline/)
  await expect(page.getByRole('region', { name: 'Master schedule workspace', exact: true }).getByRole('heading', { name: 'Master Schedule', exact: true })).toBeVisible()
  await expect(selector).toHaveValue(`${lateProject.code} — ${lateProject.name}`)
  await expect.poll(() => state.requests.slice(beforePlanner).some(request => request.path.endsWith('/planning-intelligence/projects/') && request.query.enterprise_project === String(lateProject.id))).toBe(true)
  expect(state.requests.filter(request => request.method !== 'GET')).toEqual([])
  expect(state.unknown).toEqual([])
  expect(state.pageErrors).toEqual([])
})
