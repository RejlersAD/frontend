import { test, expect } from '@playwright/test'
import { harness as projectDetailsHarness, project, secondProject } from '../fixtures/project-details-overview.fixture.js'

test.setTimeout(60000)

const confirmation = page => page.getByRole('dialog', { name: 'Confirm action', exact: true })
const portfolio = page => page.getByRole('region', { name: 'Project portfolio', exact: true })
const projectHeading = page => page.getByRole('heading', { name: project.name, exact: true })
const deleteAction = page => page.locator('.pd-menu').getByRole('button', { name: /^(?:Delete project|Deleting project…)$/ })

async function harness(page, options = {}) {
  const state = await projectDetailsHarness(page, 'project=17&shell=true', {
    prepare(current) {
      current.deleteRequests = []
      current.unexpectedWrites = []
    },
    async handleRequest(context) {
      const { path, route, state: current, reply } = context
      const method = route.request().method()
      if (method === 'DELETE' && path === '/api/v1/projects/17/') {
        current.deleteRequests.push({ path, data: route.request().postDataJSON() })
        if (options.beforeDelete) await options.beforeDelete(context)
        if (options.failure) {
          await reply(route, options.failure.body, options.failure.status)
          return true
        }
        delete current.records[17]
        if (options.response) await reply(route, options.response.body, options.response.status)
        else await route.fulfill({ status: 204 })
        return true
      }
      if (!['GET', 'OPTIONS'].includes(method)) {
        current.unexpectedWrites.push({ path, method, data: route.request().postDataJSON() })
        await reply(route, { detail: 'Unexpected write blocked by the synthetic project fixture.' }, 400)
        return true
      }
      if (path === '/api/v1/projects/17/' && !current.records[17]) {
        await reply(route, { detail: 'Not found.' }, 404)
        return true
      }
      return false
    },
  })
  await expect(projectHeading(page)).toBeVisible()
  // The list projection does not include updated_at; wait for the selected record hydration.
  await expect.poll(() => state.requests.some(request => request.path === '/api/v1/projects/17/' && request.method === 'GET')).toBe(true)
  await expect(page.getByRole('region', { name: 'Project overview', exact: true })).toBeVisible()
  return state
}

async function openDelete(page) {
  await page.locator('summary[aria-label="More project actions"]').click()
  await deleteAction(page).click()
  await expect(confirmation(page)).toBeVisible()
  await expect(confirmation(page)).toContainText('Permanently delete project')
  await expect(confirmation(page)).toContainText(project.name)
}

const expectedDelete = state => {
  expect(state.deleteRequests).toEqual([{
    path: '/api/v1/projects/17/', data: { permanent: true, expected_updated_at: project.updated_at },
  }])
}

function clean(state) {
  expect(state.unknown).toEqual([])
  expect(state.pageErrors).toEqual([])
  expect(state.unexpectedWrites).toEqual([])
  expect(state.requests.filter(request => !['GET', 'DELETE', 'OPTIONS'].includes(request.method))).toEqual([])
}

test('cancelling permanent project deletion keeps the project and sends no write', async ({ page }) => {
  const state = await harness(page)
  await openDelete(page)
  await expect(confirmation(page).getByRole('button', { name: 'Delete permanently', exact: true })).toBeVisible()
  await confirmation(page).getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(confirmation(page)).toHaveCount(0)
  await expect(projectHeading(page)).toBeVisible()
  expect(new URL(page.url()).searchParams.get('project')).toBe('17')
  expect(state.deleteRequests).toEqual([])
  expect(state.records[17].project.status).toBe('active')
  clean(state)
})

test('confirmed permanent deletion sends the saved freshness token and removes the project from the portfolio after reload', async ({ page }) => {
  const state = await harness(page)
  await openDelete(page)
  await confirmation(page).getByRole('button', { name: 'Delete permanently', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: /permanently deleted/i })).toBeVisible()
  await expect(page).toHaveURL(/\/projects$/)
  await expect(portfolio(page)).toBeVisible()
  await expect(portfolio(page)).not.toContainText(project.name)
  await expect(portfolio(page)).toContainText(secondProject.name)
  await expect(projectHeading(page)).toHaveCount(0)
  expectedDelete(state)
  expect(state.records[17]).toBeUndefined()
  await page.reload()
  await expect(portfolio(page)).toContainText(secondProject.name)
  await expect(portfolio(page)).not.toContainText(project.name)
  expectedDelete(state)
  clean(state)
})

for (const failure of [
  { status: 403, body: { detail: 'You do not have permission to permanently delete this project.' } },
  { status: 409, body: { detail: 'The project changed after you opened it. Reload the project before deleting it.', code: 'stale_project' } },
]) test(`a ${failure.status} deletion response preserves the selected project and never archives it`, async ({ page }) => {
  const state = await harness(page, { failure })
  const originalProject = structuredClone(state.records[17].project)
  await openDelete(page)
  await confirmation(page).getByRole('button', { name: 'Delete permanently', exact: true }).click()
  await expect(page.getByRole('alert').filter({ hasText: failure.body.detail })).toBeVisible()
  await expect(projectHeading(page)).toBeVisible()
  expect(new URL(page.url()).searchParams.get('project')).toBe('17')
  await expect(page.getByRole('status').filter({ hasText: /permanently deleted|archived/i })).toHaveCount(0)
  expect(state.records[17].project).toEqual(originalProject)
  expectedDelete(state)
  await openDelete(page)
  await confirmation(page).getByRole('button', { name: 'Cancel', exact: true }).click()
  expectedDelete(state)
  clean(state)
})

test('accepted deletion with pending file cleanup removes the project without claiming the uploads are gone', async ({ page }) => {
  const state = await harness(page, { response: { status: 202, body: { cleanup_pending: true } } })
  await openDelete(page)
  await confirmation(page).getByRole('button', { name: 'Delete permanently', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Project removed. Some uploaded files are awaiting deletion.' })).toBeVisible()
  await expect(page.getByRole('status').filter({ hasText: /permanently deleted/i })).toHaveCount(0)
  await expect(page).toHaveURL(/\/projects$/)
  await expect(portfolio(page)).not.toContainText(project.name)
  await expect(portfolio(page)).toContainText(secondProject.name)
  expectedDelete(state)
  expect(state.records[17]).toBeUndefined()
  clean(state)
})

test('an in-flight permanent deletion blocks another attempt and waits for the server before removing the project', async ({ page }) => {
  let release
  const pending = new Promise(resolve => { release = resolve })
  const state = await harness(page, { beforeDelete: () => pending })
  await openDelete(page)
  try {
    await confirmation(page).getByRole('button', { name: 'Delete permanently', exact: true }).click()
    await expect.poll(() => state.deleteRequests.length).toBe(1)
    await expect(projectHeading(page)).toBeVisible()
    await expect(page.getByRole('status').filter({ hasText: /permanently deleted/i })).toHaveCount(0)
    await page.locator('summary[aria-label="More project actions"]').click()
    await expect(deleteAction(page)).toBeDisabled()
    await expect(confirmation(page)).toHaveCount(0)
    expectedDelete(state)
    expect(state.records[17]).toBeDefined()
  } finally { release() }
  await expect(portfolio(page)).toBeVisible()
  await expect(portfolio(page)).not.toContainText(project.name)
  expectedDelete(state)
  clean(state)
})
