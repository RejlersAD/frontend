import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { mkdir, writeFile } from 'node:fs/promises'
import { harness, project } from '../fixtures/project-details-overview.fixture.js'

test.setTimeout(60000)
test.use({ viewport: { width: 1672, height: 941 } })

const section = (page, name) => page.getByRole('region', { name, exact: true })
const overview = page => section(page, 'Project overview')
const card = (page, name) => overview(page).getByRole('button', { name, exact: true })
const workAreas = page => page.getByRole('navigation', { name: 'Project work areas' })
const clean = state => {
  expect(state.pageErrors).toEqual([])
  expect(state.unknown).toEqual([])
  expect(state.requests.filter(request => request.method !== 'GET')).toEqual([])
}
const documents = [
  { id: 801, project: 17, title: 'Issued process design basis', kind: 'specification', original_filename: 'process-basis.pdf', parse_status: 'done', created_at: '2026-09-14T08:00:00Z', updated_at: '2026-09-14T09:00:00Z', uploaded_by_name: 'Maya Hassan', has_file: true, can_download: true },
  { id: 802, project: 17, title: 'Piping drawing package', kind: 'drawing', original_filename: 'piping-drawings.pdf', parse_status: 'pending', created_at: '2026-09-13T08:00:00Z', updated_at: '2026-09-13T08:00:00Z', uploaded_by_name: null, has_file: true, can_download: false },
  { id: 803, project: 17, title: 'Vendor reference register', kind: 'other', original_filename: 'vendor-register.xlsx', parse_status: 'failed', created_at: '2026-09-12T08:00:00Z', updated_at: '2026-09-12T08:00:00Z', uploaded_by_name: 'Omar Saleh', has_file: true, can_download: true },
]

async function open(page, { prepare, failures, dark = false, paginatedDocuments = false } = {}) {
  const state = await harness(page, 'project=17&shell=true', {
    failures,
    prepare(fixture) { fixture.documents = structuredClone(documents); prepare?.(fixture) },
    async handleRequest({ path, route, state: fixture, reply }) {
      const detail = path.match(/^\/api\/v1\/project-control\/documents\/(\d+)\/$/)
      if (detail) {
        const document = fixture.documents.find(row => String(row.id) === detail[1] && row.project === 17)
        await reply(route, document ? { ...document, parsed_data: {}, parse_error: '' } : { detail: 'Not found.' }, document ? 200 : 404)
        return true
      }
      if (path !== '/api/v1/project-control/documents/') return false
      if (fixture.failures.has('documents')) {
        await reply(route, { detail: 'Document register is temporarily unavailable.' }, 503)
      } else {
        const page = Number(new URL(route.request().url()).searchParams.get('page') || 1)
        const rows = paginatedDocuments ? fixture.documents.slice((page - 1) * 2, page * 2) : fixture.documents
        const next = paginatedDocuments && page * 2 < fixture.documents.length ? '/api/v1/project-control/documents/?project=17&page=' + (page + 1) : null
        await reply(route, { count: fixture.documents.length, next, previous: null, results: rows })
      }
      return true
    },
  })
  await expect(page.getByRole('heading', { name: project.name, exact: true })).toBeVisible()
  await expect(overview(page)).toBeVisible()
  if (dark) await page.evaluate(() => document.documentElement.classList.add('dark'))
  return state
}

async function more(page, label) {
  await page.locator('summary[aria-label="More project actions"]').click()
  await page.locator('.pd-menu').getByRole('button', { name: label, exact: true }).click()
}

test('project details show recorded performance, ledger position, milestones and real deliverables', async ({ page }) => {
  const state = await open(page)
  await expect(page.locator('.pp-details-workspace')).toContainText('5900913')
  await expect(page.locator('.pp-details-workspace')).toContainText('ADNOC Refining')
  await expect(card(page, 'Physical progress')).toContainText('42%')
  await expect(card(page, 'Schedule')).toContainText('0.84')
  await expect(card(page, 'Cost')).toContainText('0.91')
  await expect(card(page, 'Milestones')).toContainText(/1\s*(?:\/|of)\s*4/)
  await section(page, 'Progress performance').getByRole('tab', { name: 'Schedule', exact: true }).click()
  await expect(section(page, 'Progress performance')).toContainText(/-8/)
  await section(page, 'Progress performance').getByRole('tab', { name: 'Progress', exact: true }).click()
  await expect(section(page, 'Cost position')).toContainText(/10,000,000|10(?:\.0)?\s*[mM]/)
  await expect(section(page, 'Cost position')).toContainText(/4,600,000|4\.6\s*[mM]/)
  await expect(section(page, 'Upcoming milestones')).toContainText('Vendor data approval')
  await expect(section(page, 'Deliverables')).toContainText(documents[0].title)
  await expect(section(page, 'Recent activity')).toContainText(/Purchase order approved|Issued process design basis/)
  clean(state)
})

test('paginated deliverables stay project scoped and metadata processing never claims engineering approval', async ({ page }) => {
  const state = await open(page, { paginatedDocuments: true, prepare: fixture => {
    fixture.documents.push({ ...documents[0], id: 999, project: 18, title: 'Unrelated project confidential drawing' })
  } })
  const deliverables = section(page, 'Deliverables')
  await expect(deliverables).toContainText(documents[0].title)
  await expect(deliverables).not.toContainText('Unrelated project confidential drawing')
  await expect(deliverables).toContainText(/metadata|processing/i)
  await expect(deliverables).not.toContainText(/3 approved|100% approved/i)
  expect(state.requests.filter(request => request.path === '/api/v1/project-control/documents/').length).toBeGreaterThanOrEqual(2)
  clean(state)
})

test('empty records keep missing performance and monetary values unavailable while recorded document count is zero', async ({ page }) => {
  const state = await open(page, { prepare: fixture => {
    const record = fixture.records[17]
    record.snapshots = []; record.milestones = []; record.tasks = []; record.changes = []
    record.project.progress = null; record.project.contract_value = null; record.project.custom_fields = {}
    record.kpis = { currency: 'AED', budget: null, spent: null, committed: null, remaining: null, forecast: {} }
    record.commercial = { currency: 'AED', budget: null, actual: null, committed: null, recent_events: [] }
    fixture.documents = []
  } })
  await expect(card(page, 'Physical progress')).toContainText(/Not available|—/)
  await expect(card(page, 'Physical progress')).not.toContainText('0%')
  await expect(card(page, 'Schedule')).not.toContainText('1.00')
  await expect(card(page, 'Cost')).not.toContainText('1.00')
  await expect(section(page, 'Cost position')).not.toContainText(/AED\s*0|0\.0\s*[mM]/)
  await expect(section(page, 'Progress performance')).toContainText(/No recorded|No progress|No sealed/i)
  await expect(section(page, 'Deliverables')).toContainText(/No (?:project )?documents|No deliverables/i)
  clean(state)
})

test('failed sources remain unavailable and Retry data restores actual records', async ({ page }) => {
  const state = await open(page, { failures: ['snapshots', 'kpis', 'commercial', 'milestones', 'documents'] })
  await expect(page.getByRole('alert')).toContainText(/unavailable/i)
  await expect(card(page, 'Physical progress')).toContainText(/Not available|—/)
  await expect(section(page, 'Deliverables')).toContainText(/unavailable|could not be loaded/i)
  await expect(section(page, 'Deliverables')).not.toContainText(/No documents|No deliverables/i)
  await expect(section(page, 'Recent activity')).toContainText(/unavailable/i)
  state.failures.clear()
  await page.getByRole('button', { name: 'Retry data', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(card(page, 'Physical progress')).toContainText('42%')
  await expect(section(page, 'Deliverables')).toContainText(documents[0].title)
  clean(state)
})

test('risk exposure preserves currencies and current version scope without adding risks into a forecast', async ({ page }) => {
  const state = await open(page, { prepare: fixture => {
    const risk = (id, version, currency, cost, days) => ({
      id, version, item_type: 'risk', title: `Assessed risk ${id}`, priority: 'high', status: 'open',
      schedule_impact_days: days,
      metadata: { risk_control: { currency, inherent_cost_exposure: cost, residual_cost_exposure: '0', schedule_impact_assessed: true,
        inherent_probability: id === 701 ? 1 : 5, inherent_impact: id === 701 ? 5 : 1 } },
    })
    fixture.linkedRegister = {
      project: { id: 81, enterprise_project: 17, created_at: '2026-01-01T00:00:00Z' },
      schedule: { id: 91, project: 81, status: 'active', created_at: '2026-01-01T00:00:00Z' },
      versions: [{ id: 101, schedule: 91, version: 3, status: 'draft' }, { id: 100, schedule: 91, version: 2, status: 'superseded' }],
      governance: { version: { id: 101, version: 3, status: 'draft' }, members: [], audit_events: [], reviews: [],
        items: [risk(701, 101, 'AED', '4000', 7), risk(702, 101, 'USD', '2000', 5), risk(703, 100, 'AED', '990000', 100)],
      },
    }
  } })
  const exposure = section(page, 'Risk & change exposure')
  await expect(exposure).toContainText('AED')
  await expect(exposure).toContainText('$2,000')
  await expect(exposure).toContainText(/4,000|4(?:\.0)?\s*[kK]/)
  await expect(exposure).toContainText(/2,000|2(?:\.0)?\s*[kK]/)
  await expect(exposure).not.toContainText(/990,000|12\s*days|100\s*days/)
  const highImpact = exposure.getByTitle('Low probability / High impact: 1 open risks', { exact: true })
  const highProbability = exposure.getByTitle('High probability / Low impact: 1 open risks', { exact: true })
  await expect(highImpact).toHaveText('1')
  await expect(highProbability).toHaveText('1')
  const topLeft = await highImpact.boundingBox(), bottomRight = await highProbability.boundingBox()
  expect(topLeft.x).toBeLessThan(bottomRight.x)
  expect(topLeft.y).toBeLessThan(bottomRight.y)
  expect(state.requests.filter(request => request.path.endsWith('/governance/')).every(request => request.path.includes('/101/'))).toBe(true)
  clean(state)
})

test('header reporting, issue resolution, update, export and Back to projects use existing actions', async ({ page }) => {
  const state = await open(page)
  await card(page, 'Physical progress').click()
  const source = page.getByRole('dialog', { name: 'Reporting source', exact: true })
  await expect(source).toContainText(state.records[17].snapshots.at(-1).id)
  await expect(source).toContainText('Sealed reporting period')
  await page.keyboard.press('Escape')
  await expect(card(page, 'Physical progress')).toBeFocused()
  await page.getByRole('button', { name: /^Resolve \d+ issues?$/ }).click()
  await expect(page.getByRole('dialog', { name: 'Management actions', exact: true })).toContainText('Review schedule variance')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Update progress', exact: true }).click()
  await expect(page.getByRole('dialog').getByRole('heading', { name: /Edit project/i })).toBeVisible()
  await page.keyboard.press('Escape')
  await more(page, 'Data quality')
  await expect(page.getByRole('dialog', { name: 'Data quality review', exact: true })).toContainText('not a prediction confidence score')
  await page.keyboard.press('Escape')
  await page.evaluate(() => { window.__printed = 0; window.print = () => { window.__printed += 1 } })
  await page.getByRole('button', { name: 'Export', exact: true }).click()
  expect(await page.evaluate(() => window.__printed)).toBe(1)
  await page.getByRole('button', { name: 'Back to projects', exact: true }).click()
  await expect(section(page, 'Project portfolio')).toBeVisible()
  expect(new URL(page.url()).search).toBe('')
  clean(state)
})

test('overview links open their existing project work areas and activity audit dialog', async ({ page }) => {
  const state = await open(page)
  const destinations = [
    ['Open schedule', 'plan-baseline'], ['Open cost control', 'commercial-dashboard'],
    ['View all milestones', 'milestones'], ['View risk register', 'risk'], ['View all deliverables', 'documents'],
  ]
  for (const [label, view] of destinations) {
    if (label === 'Open schedule') await section(page, 'Progress performance').getByRole('tab', { name: 'Schedule', exact: true }).click()
    await overview(page).getByRole('button', { name: label, exact: true }).click()
    await expect(page).toHaveURL(new RegExp('view=' + view))
    await workAreas(page).getByRole('button', { name: 'Overview', exact: true }).click()
    await expect(overview(page)).toBeVisible()
  }
  await workAreas(page).getByRole('button', { name: 'Activity & Audit', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Project activity', exact: true })).toContainText('Purchase order approved')
  await page.keyboard.press('Escape')
  await expect(workAreas(page).getByRole('button', { name: 'Schedule', exact: true })).toBeVisible()
  clean(state)
})

for (const viewport of [
  { name: 'desktop', width: 1672, height: 941 },
  { name: 'mobile', width: 390, height: 844 },
  { name: 'dark', width: 1672, height: 941, dark: true },
]) {
  test(`project details ${viewport.name} supports readable responsive layout and accessible controls`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    const state = await open(page, { dark: viewport.dark })
    const dimensions = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }))
    expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.width + 1)
    if (viewport.dark) {
      const background = await page.locator('.pp-details-workspace').evaluate(element => getComputedStyle(element).backgroundColor.match(/[\d.]+/g).slice(0, 3).map(Number))
      expect(background.reduce((total, channel) => total + channel, 0) / 3).toBeLessThan(100)
    }
    const scan = await new AxeBuilder({ page }).include('.pp-details-workspace').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
    await mkdir('../artifacts/project-details-overview', { recursive: true })
    await writeFile(`../artifacts/project-details-overview/axe-${viewport.name}.json`, JSON.stringify(scan.violations, null, 2))
    await page.screenshot({ path: `../artifacts/project-details-overview/${viewport.name}-${viewport.width}.png`, animations: 'disabled' })
    const blocking = scan.violations.filter(issue => ['critical', 'serious'].includes(issue.impact))
      .map(issue => ({ id: issue.id, impact: issue.impact, nodes: issue.nodes.slice(0, 10).map(node => ({ target: node.target, summary: node.failureSummary })) }))
    expect(blocking).toEqual([])
    clean(state)
  })
}
