import { test, expect } from '@playwright/test'
import { masterScheduleHarness } from '../fixtures/master-schedule.fixture.js'
import { pageOf } from '../fixtures/schedule-performance.fixture.js'

test.setTimeout(60000)
test.use({ viewport: { width: 1672, height: 941 } })

const AREAS = [
  ['Overview', 'project-dashboard'], ['Schedule', 'plan-baseline'],
  ['Cost & Commercial', 'commercial-dashboard'], ['Milestones', 'milestones'],
  ['Risks & Changes', 'risk'], ['Estimates', 'estimates'], ['Documents', 'documents'],
]
const LABELS = [...AREAS.map(([label]) => label), 'Activity & Audit']
const header = page => page.locator('header.pd-header')
const tabs = page => page.getByRole('navigation', { name: 'Project work areas', exact: true })

async function openWorkspace(page, query = 'project=17&shell=true') {
  const state = await masterScheduleHarness(page, {
    query,
    prepare(fixture) {
      for (const record of Object.values(fixture.records)) {
        record.project.portfolio = { baseline: null, missing_owner: false, entity: null,
          health: { key: 'needs_review', label: 'Needs review', reason: 'Draft schedule awaits review.' } }
        record.milestones = record.milestones.map(row => ({ ...row, project: record.project.id }))
        Object.assign(record.governance, { version: record.versions[0], can_manage: true,
          members: [{ id: 7, name: 'Maya Hassan' }], audit_events: [] })
      }
    },
    async handleRequest({ path, route, url, record, state: fixture, reply }) {
      // These browser tests open existing controls only. Never forward mutations.
      if (route.request().method() !== 'GET') {
        await reply(route, { detail: 'Navigation checks are read only.' }, 405)
        return true
      }
      if (path.endsWith('/project-control/documents/')) {
        await reply(route, { ...pageOf([]), capabilities: { can_upload: true,
          max_document_bytes: 20 * 1024 * 1024,
          document_kinds: [{ value: 'drawing', label: 'Drawing' }, { value: 'other', label: 'Other' }] } })
        return true
      }
      if (path.endsWith('/project-control/estimates/')) {
        await reply(route, pageOf([]))
        return true
      }
      if (path.endsWith('/projects/milestones/') || path.endsWith('/projects/tasks/')) {
        const selected = fixture.records[url.searchParams.get('project_id')] || record
        await reply(route, pageOf(path.endsWith('/milestones/') ? selected.milestones : selected.tasks))
        return true
      }
      return false
    },
  })
  return state
}

async function expectSharedHeader(page, project, activeLabel, view) {
  await expect(header(page)).toHaveCount(1)
  await expect(header(page).getByRole('heading', { level: 1 })).toHaveText(project.name)
  await expect(page.getByRole('heading', { level: 1, name: project.name, exact: true })).toHaveCount(1)
  await expect(tabs(page)).toHaveCount(1)
  await expect(tabs(page).getByRole('button')).toHaveText(LABELS)
  await expect(tabs(page).locator('[aria-current="page"]')).toHaveCount(1)
  await expect(tabs(page).getByRole('button', { name: activeLabel, exact: true })).toHaveAttribute('aria-current', 'page')
  await expect(header(page)).toContainText(project.code)
  await expect(header(page)).toContainText(project.client_name)
  await expect(header(page)).toContainText('Baseline not approved')
  await expect(page.locator('header.pp-header')).toHaveCount(0)
  await expect(page.locator('nav.pp-tabs')).toHaveCount(0)
  for (const title of ['Project Performance', 'Schedule Performance', 'Cost & Commercial Performance', 'Milestone Control', 'Risk & Change Control', 'Project Estimates', 'Project Documents']) {
    await expect(page.getByRole('heading', { level: 1, name: title, exact: true })).toHaveCount(0)
  }
  await expect(page).toHaveURL(url => url.searchParams.get('project') === String(project.id)
    && (url.searchParams.get('view') || 'project-dashboard') === view)
}

async function goTo(page, project, label, view) {
  await tabs(page).getByRole('button', { name: label, exact: true }).click()
  await expectSharedHeader(page, project, label, view)
}

function expectReadOnly(state) {
  expect(state.pageErrors).toEqual([])
  expect(state.unknown).toEqual([])
  expect(state.requests.filter(request => request.method !== 'GET')).toEqual([])
  expect(state.writes).toEqual([])
}

test('all project work areas retain the project header and the same eight navigation tabs', async ({ page }) => {
  const state = await openWorkspace(page)
  const project = state.records[17].project
  await expect(page.getByRole('region', { name: 'Project overview', exact: true })).toBeVisible()
  await expectSharedHeader(page, project, 'Overview', 'project-dashboard')

  for (const [label, view] of AREAS.slice(1)) {
    await goTo(page, project, label, view)
    if (view === 'plan-baseline') {
      await expect(page.getByRole('heading', { name: 'Master Schedule', exact: true })).toBeVisible()
      await expect(header(page).getByRole('button', { name: 'Save draft', exact: true })).toBeEnabled()
    }
  }
  await goTo(page, project, 'Overview', 'project-dashboard')
  const originalUrl = page.url()
  await tabs(page).getByRole('button', { name: 'Activity & Audit', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Project activity', exact: true })).toBeVisible()
  await expect(page).toHaveURL(originalUrl)
  await page.keyboard.press('Escape')
  await expectSharedHeader(page, project, 'Overview', 'project-dashboard')
  await expect(tabs(page).getByRole('button', { name: 'Activity & Audit', exact: true })).toBeFocused()
  expectReadOnly(state)
})

test('shared header keeps the area controls and opens their existing dialogs without writing data', async ({ page }) => {
  const state = await openWorkspace(page)
  const project = state.records[17].project
  await expect(page.getByRole('region', { name: 'Project overview', exact: true })).toBeVisible()

  await goTo(page, project, 'Milestones', 'milestones')
  await expect(header(page).getByRole('button', { name: 'Add milestone', exact: true })).toBeEnabled()
  await header(page).getByRole('button', { name: 'Add milestone', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Add milestone', exact: true })).toBeVisible()
  await page.keyboard.press('Escape')

  await goTo(page, project, 'Risks & Changes', 'risk')
  const riskAdd = header(page).locator('summary[aria-label="Add"]')
  await expect(riskAdd).toHaveAttribute('aria-disabled', 'false')
  await riskAdd.click()
  await header(page).getByRole('button', { name: 'Add risk', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Add risk', exact: true })).toBeVisible()
  await page.keyboard.press('Escape')

  await goTo(page, project, 'Estimates', 'estimates')
  const newEstimate = header(page).locator('summary[aria-label="New estimate"]')
  await expect(newEstimate).toHaveAttribute('aria-disabled', 'false')
  await newEstimate.click()
  await header(page).getByRole('button', { name: 'Blank estimate', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Blank estimate', exact: true })).toBeVisible()
  await page.keyboard.press('Escape')

  await goTo(page, project, 'Documents', 'documents')
  const addDocument = header(page).locator('summary[aria-label="Add document"]')
  await expect(addDocument).toHaveAttribute('aria-disabled', 'false')
  await addDocument.click()
  await header(page).getByRole('button', { name: 'New document', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'New document', exact: true })).toBeVisible()
  await page.keyboard.press('Escape')

  await goTo(page, project, 'Schedule', 'plan-baseline')
  await expect(header(page).getByRole('button', { name: 'Save draft', exact: true })).toBeEnabled()
  await expect(header(page).getByRole('button', { name: 'Add milestone', exact: true })).toHaveCount(0)
  expectReadOnly(state)
})

test('direct work-area links and project switching preserve selected project and active tab', async ({ page }) => {
  const state = await openWorkspace(page, 'project=17&view=milestones&shell=true')
  await expectSharedHeader(page, state.records[17].project, 'Milestones', 'milestones')
  await expect(header(page).getByRole('button', { name: 'Add milestone', exact: true })).toBeEnabled()
  await header(page).locator('summary[aria-label="More project actions"]').click()
  await header(page).getByRole('combobox', { name: 'Active Project', exact: true }).fill('Grid Power')
  await header(page).getByRole('option').filter({ hasText: state.records[18].project.name }).click()
  await expectSharedHeader(page, state.records[18].project, 'Milestones', 'milestones')
  await goTo(page, state.records[18].project, 'Documents', 'documents')
  await expect(header(page).locator('summary[aria-label="Add document"]')).toHaveAttribute('aria-disabled', 'false')
  expect(state.requests.some(request => request.path.endsWith('/project-control/documents/') && request.query.project === '18')).toBe(true)
  await header(page).getByRole('button', { name: 'Back to projects', exact: true }).click()
  await expect(page).toHaveURL(url => url.pathname === '/projects' && !url.searchParams.get('project'))
  await expect(page.getByRole('heading', { level: 1, name: 'Project Portfolio', exact: true })).toBeVisible()
  await expect(header(page)).toHaveCount(0)
  expectReadOnly(state)
})
