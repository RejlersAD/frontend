import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { masterScheduleHarness } from '../fixtures/master-schedule.fixture.js'
import { pageOf } from '../fixtures/schedule-performance.fixture.js'

test.setTimeout(60000)
test.use({ viewport: { width: 1672, height: 941 } })
const root = '/api/v1/planning-intelligence/agreement-workspaces/'
const dialog = page => page.getByRole('dialog', { name: 'Analyze & set up project', exact: true })
const setup = page => page.locator('header.pd-header').getByRole('button', { name: 'Analyze & set up project', exact: true })
const panel = page => dialog(page).getByRole('region', { name: 'Agreement project setup', exact: true })
const tabs = page => page.getByRole('navigation', { name: 'Project work areas', exact: true })
async function openSetup(page) {
  if (!await dialog(page).isVisible()) await setup(page).click()
  await expect(dialog(page)).toBeVisible()
  await expect(panel(page)).toBeVisible()
}
async function closeSetup(page) {
  await page.keyboard.press('Escape')
  await expect(dialog(page)).toBeHidden()
  await expect(setup(page)).toBeFocused()
}
const document = { name: 'agreement.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7\nsynthetic agreement browser fixture') }
const source = page => [{ file_id: 35, filename: 'agreement.pdf', page, quote: page === 4 ? 'Commencement 1 December 2025. Provisional acceptance eight months from commencement.' : 'The final FEED package is due at week 28 from effective award.', quote_verified: true }]
const input = (id, label, display, extra = {}) => ({ id, label, display_value: display, value: { text: display }, basis: 'document_fact', status: 'supported', sources: source(4), ...extra })
const makeDraft = (project = 17) => ({
  id: project + 1000, revision: 1, status: 'draft',
  counts: { document_facts: 8, supported: 7, proposals: 1, accepted: 0, exceptions: 2 },
  exceptions: [
    { key: 'timing', code: 'timing_reconciliation', label: 'Confirm contractual completion events', count: 2, details: 'Eight months from commencement and 28 weeks from effective award refer to different events. Confirm the governing programme.', fact_ids: ['eight-months', 'week-28'] },
    { key: 'calendar', code: 'missing_calendar', label: 'Working calendar and dependency logic', count: 1, details: 'Supply the approved work calendar and activity relationships before calculating float.' },
  ],
  projection: {
    overview: { items: [input('name', 'Project scope', `Project ${project} fire and gas engineering`), input('commencement', 'Commencement', '1 December 2025')] },
    schedule: { items: [input('eight-months', 'Provisional acceptance', '8 months from commencement'), input('week-28', 'Final FEED package', '28 weeks from effective award', { sources: source(57) })], wbs: [{ name: 'FEED', basis: 'ai_proposal', disciplines: [{ name: 'Instrumentation', deliverables: [{ id: 'wbs-1', name: 'Site survey and existing facilities review', status: 'supported', duration: null, dependencies: null }] }] }], calculation_ready: false },
    commercials: { items: [input('price', 'FEED contract value', 'USD 877,512.79', { value: { amount: '877512.79', currency: 'USD' } }), input('payment', 'Physical progress payments', '65% of the fee')] },
    milestones: { items: [input('week-28', 'Final FEED package', '28 weeks from effective award', { sources: source(57) })] },
    risks: { items: [input('risk-1', 'Client review delay', 'Confirm review capacity and turnaround with the client.', { basis: 'ai_proposal', status: 'proposed', sources: source(56) })] },
    estimates: { items: [input('estimate', 'EPC estimate accuracy requirement', '±15% accuracy; completed EPC estimate required', { sources: source(59) })] },
    documents: { items: [input('document-1', 'Required deliverable', 'Project definition report')], uploads: [{ file_id: 35, filename: 'agreement.pdf', page_count: 117 }] },
    activity: { items: [input('audit-1', 'Agreement analyzed', 'Document analysis completed and draft inputs prepared.', { basis: 'recorded', sources: [] })] },
  },
})
const envelope = (id = 17, draft = null) => ({ enterprise_project_id: id, planning_project_id: id + 54, workspace: draft, permissions: { can_analyze: true, can_accept: true }, active_job: null, latest_job: null, files: [{ id: 35, original_filename: 'agreement.pdf', category: 'agreement', parse_status: 'done', url: '/media/agreement.pdf' }], ai: { available: true, provider: 'anthropic', model: 'configured-project-model' } })
const startJob = (state, id = 17) => { state.agreements[id].active_job = { id: id + 2000, status: 'running', progress: 35, message: 'Reading source pages and extracting project facts.' }; return state.agreements[id] }
const complete = (state, id = 17) => { Object.assign(state.agreements[id], { workspace: makeDraft(id), latest_job: { ...state.agreements[id].active_job, status: 'succeeded', progress: 100 }, active_job: null }); return state.agreements[id] }
async function open(page, options = {}) {
  const state = await masterScheduleHarness(page, {
    query: options.query || 'project=17&shell=true',
    prepare(current) {
      current.agreements = { 17: envelope(17, options.draft ? makeDraft() : null), 18: envelope(18, options.draft ? makeDraft(18) : null) }
      current.agreementWrites = []; current.agreementReads = []
      options.prepare?.(current)
    },
    async handleRequest(context) {
      const { path, route, state: current, reply } = context
      if (await options.handleRequest?.(context)) return true
      if (path === root + 'create/') {
        const body = route.request().postData()
        current.agreementWrites.push({ path, body })
        current.records[99] = structuredClone(current.records[17])
        Object.assign(current.records[99].project, { id: 99, name: 'Agreement created project', code: 'AG-99' })
        Object.assign(current.records[99].planningProject, { id: 153, enterprise_project: 99 })
        current.agreements[99] = envelope(99)
        startJob(current, 99)
        await reply(route, { ...current.agreements[99], enterprise_project: current.records[99].project, planning_project: current.records[99].planningProject }, 202)
        return true
      }
      if (path.startsWith(root)) {
        const match = path.match(/\/projects\/(\d+)\/(.*)$/)
        const id = Number(match?.[1])
        if (route.request().method() === 'GET') {
          current.agreementReads.push(id)
          await reply(route, current.agreements[id])
        } else {
          const body = route.request().headers()['content-type']?.includes('application/json') ? route.request().postDataJSON() : route.request().postData()
          current.agreementWrites.push({ path, body })
          if (match[2] === 'analyze/') await reply(route, startJob(current, id), 202)
          else if (match[2] === 'accept/') {
            const draft = current.agreements[id].workspace
            draft.revision += 1; draft.status = 'partial'; draft.counts.accepted = draft.counts.supported; draft.counts.supported = 0
            for (const section of Object.values(draft.projection)) for (const item of section.items) if (item.status === 'supported' || body.selected_fact_ids?.includes(item.id)) item.status = 'accepted'
            await reply(route, current.agreements[id])
          } else await reply(route, { detail: 'Unknown mutation' }, 400)
        }
        return true
      }
      if (path.endsWith('/project-control/estimates/')) { await reply(route, pageOf([])); return true }
      if (path.endsWith('/project-control/documents/')) { await reply(route, { ...pageOf([]), capabilities: { can_upload: true, document_kinds: [], max_document_bytes: 20971520 } }); return true }
      return false
    },
  })
  if (!options.query?.includes('portfolio')) {
    await expect(setup(page)).toBeVisible()
    await expect(page.locator('.aw-workspace')).toBeHidden()
    if (options.openSetup !== false) await openSetup(page)
  }
  return state
}
const clean = state => { expect(state.pageErrors).toEqual([]); expect(state.unknown).toEqual([]); expect(state.unknownWrites).toEqual([]); expect(state.writes).toEqual([]) }

test('single upload analyzes in the background and accepts supported inputs together without changing actual records', async ({ page }) => {
  const state = await open(page)
  const records = structuredClone(state.records)
  await panel(page).getByLabel('Agreement document', { exact: true }).setInputFiles(document)
  await panel(page).getByRole('button', { name: 'Analyze & set up project', exact: true }).click()
  await expect(panel(page).getByRole('progressbar', { name: 'Agreement analysis progress' })).toHaveAttribute('value', '35')
  expect(state.agreementWrites).toHaveLength(1)
  expect(state.agreementWrites[0].path).toBe(root + 'projects/17/analyze/')
  expect(state.agreementWrites[0].body).toContain('filename="agreement.pdf"')
  expect(state.agreementWrites[0].body).toContain('name="idempotency_key"')
  complete(state)
  await expect(panel(page)).toContainText('2 exception groups need attention')
  await panel(page).getByRole('button', { name: 'Accept supported inputs & build draft', exact: true }).click()
  await expect(panel(page).getByRole('button', { name: 'Accept supported inputs & build draft', exact: true })).toBeDisabled()
  expect(state.agreementWrites[1].body).toMatchObject({ workspace_id: 1017, revision: 1 })
  expect(state.agreementWrites[1].body.selected_fact_ids).toBeUndefined()
  await expect(panel(page)).toContainText('Working calendar and dependency logic')
  expect(state.records).toEqual(records)
  clean(state)
})

test('all eight existing work areas show shared inputs with basis and source pages while relative dates stay relative', async ({ page }) => {
  const state = await open(page, { draft: true })
  for (const [label, expected] of [['Overview', 'Project 17 fire and gas engineering'], ['Schedule', '28 weeks from effective award'], ['Cost & Commercial', 'USD 877,512.79'], ['Milestones', '28 weeks from effective award'], ['Risks & Changes', 'Client review delay'], ['Estimates', '±15% accuracy'], ['Documents', 'Project definition report']]) {
    await closeSetup(page)
    await tabs(page).getByRole('button', { name: label, exact: true }).click()
    await expect(tabs(page).getByRole('button')).toHaveCount(8)
    await openSetup(page)
    const section = panel(page).getByRole('region', { name: `Agreement ${label}`, exact: true })
    await expect(section).toContainText(expected)
  }
  await closeSetup(page)
  await tabs(page).getByRole('button', { name: 'Activity & Audit', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Project activity', exact: true }).getByRole('region', { name: 'Agreement Activity & Audit', exact: true })).toContainText('Agreement analyzed')
  await page.keyboard.press('Escape')
  await tabs(page).getByRole('button', { name: 'Schedule', exact: true }).click()
  await openSetup(page)
  await expect(panel(page)).toContainText('8 months from commencement')
  await expect(panel(page)).toContainText('28 weeks from effective award')
  await panel(page).getByText('Draft work breakdown · 1 deliverable', { exact: true }).click()
  await expect(panel(page).getByText('Instrumentation', { exact: true })).toBeVisible()
  await expect(panel(page).getByText('Site survey and existing facilities review', { exact: true })).toBeVisible()
  await panel(page).getByText('agreement.pdf · p. 57', { exact: true }).click()
  await expect(panel(page).getByRole('link', { name: 'Open source page 57', exact: true })).toHaveAttribute('href', '/media/agreement.pdf#page=57')
  await expect(panel(page)).not.toContainText('Total float: 0')
  expect(state.agreementWrites).toEqual([])
  clean(state)
})

test('saved agreement starts analysis without uploading the file again, including a file categorized as other', async ({ page }) => {
  const state = await open(page, { prepare(current) { current.agreements[17].files[0].category = 'other' } })
  await panel(page).getByLabel('Saved agreement', { exact: true }).selectOption('35')
  await closeSetup(page)
  await openSetup(page)
  await expect(panel(page).getByLabel('Saved agreement', { exact: true })).toHaveValue('35')
  expect(state.agreementWrites).toEqual([])
  await panel(page).getByRole('button', { name: 'Analyze & set up project', exact: true }).click()
  await expect(panel(page).getByRole('progressbar')).toBeVisible()
  expect(state.agreementWrites[0].body).toMatchObject({ file_ids: [35], idempotency_key: expect.any(String) })
  clean(state)
})

test('changed sources remain clearly marked after acceptance and can be analyzed again', async ({ page }) => {
  const state = await open(page, { draft: true, prepare(current) {
    current.agreements[17].workspace.status = 'accepted'
    current.agreements[17].workspace.stale = true
    current.agreements[17].permissions.can_accept = false
  } })
  await expect(panel(page).getByRole('alert')).toContainText('Agreement sources have changed.')
  await panel(page).getByRole('button', { name: 'Analyze another agreement', exact: true }).click()
  await expect(panel(page).getByLabel('Saved agreement', { exact: true })).toBeEnabled()
  expect(state.agreementWrites).toEqual([])
  clean(state)
})

test('active analysis resumes on refresh and across tabs without repeating the start request', async ({ page }) => {
  const state = await open(page, { prepare(current) { startJob(current) } })
  await expect(panel(page).getByRole('progressbar')).toBeVisible()
  await closeSetup(page)
  await tabs(page).getByRole('button', { name: 'Documents', exact: true }).click()
  await page.reload()
  await openSetup(page)
  await expect(panel(page).getByRole('progressbar')).toBeVisible()
  complete(state)
  await expect(panel(page)).toContainText('Project definition report')
  expect(state.agreementWrites).toEqual([])
  clean(state)
})

test('failed progress request stops polling and checking progress resumes with a GET only', async ({ page }) => {
  let fail = false
  const state = await open(page, { prepare(current) { startJob(current) }, async handleRequest({ path, route, reply }) {
    if (fail && path === root + 'projects/17/' && route.request().method() === 'GET') { await reply(route, { detail: 'Source service is temporarily unavailable.' }, 503); return true }
    return false
  } })
  await expect(panel(page).getByRole('progressbar')).toBeVisible()
  fail = true
  await expect(panel(page).getByRole('alert')).toContainText('Source service is temporarily unavailable.')
  fail = false; complete(state)
  await panel(page).getByRole('button', { name: 'Check progress', exact: true }).click()
  await expect(panel(page)).toContainText('Agreement project draft')
  expect(state.agreementWrites).toEqual([])
  clean(state)
})

test('read-only permissions keep evidence visible and disable every acceptance or upload control', async ({ page }) => {
  const state = await open(page, { draft: true, prepare(current) { current.agreements[17].permissions = { can_analyze: false, can_accept: false } } })
  await expect(panel(page).getByRole('button', { name: 'Accept supported inputs & build draft', exact: true })).toBeDisabled()
  await expect(panel(page).getByRole('button', { name: 'Analyze another agreement', exact: true })).toBeDisabled()
  await expect(panel(page)).toContainText('Project update permission is required to accept supported inputs.')
  expect(state.agreementWrites).toEqual([])
  clean(state)
})

for (const status of ['draft', 'accepted']) test(`${status} workspace conflicts offer grouped choices with a required reason and preserve alternatives`, async ({ page }) => {
  const state = await open(page, { draft: true, prepare(current) {
    const draft = current.agreements[17].workspace
    draft.status = status
    draft.counts.supported = 0
    draft.projection.overview.items = [input('client-a', 'Client', 'ADNOC Gas', { status: 'conflict' }), input('client-b', 'Client', 'ADNOC Refining', { status: 'conflict', sources: source(57) })]
    draft.exceptions = [{ key: 'client-choice', code: 'source_conflicts', label: 'Choose client', count: 2, fact_ids: ['client-a', 'client-b'], details: 'Two source passages give different clients.' }]
  } })
  const accept = panel(page).getByRole('button', { name: 'Accept supported inputs & build draft', exact: true })
  await expect(accept).toBeDisabled()
  await panel(page).getByText('Review source options', { exact: true }).click()
  await panel(page).getByRole('radio', { name: 'ADNOC Gas', exact: false }).check()
  await expect(accept).toBeDisabled()
  await panel(page).getByLabel('Source decision reason', { exact: true }).fill('The executed work order identifies ADNOC Gas as the contracting client.')
  await expect(accept).toBeEnabled()
  await accept.click()
  await expect.poll(() => state.agreementWrites.length).toBe(1)
  expect(state.agreementWrites[0].body).toMatchObject({ selected_fact_ids: ['client-a'], reason: 'The executed work order identifies ADNOC Gas as the contracting client.' })
  await expect(panel(page)).toContainText('ADNOC Refining')
  clean(state)
})

test('a repeated acceptance click submits one decision while the server is working', async ({ page }) => {
  let requests = 0
  const state = await open(page, { draft: true, async handleRequest({ path, route, state: current, reply }) {
    if (path === root + 'projects/17/accept/') {
      requests += 1
      await new Promise(resolve => setTimeout(resolve, 400))
      current.agreements[17].workspace.status = 'accepted'
      current.agreements[17].workspace.revision += 1
      await reply(route, current.agreements[17])
      return true
    }
    return false
  } })
  await panel(page).getByRole('button', { name: 'Accept supported inputs & build draft', exact: true }).evaluate(button => { button.click(); button.click() })
  await expect(panel(page)).toContainText('Supported inputs accepted')
  expect(requests).toBe(1)
  clean(state)
})

test('a response for another project is rejected and cannot expose acceptance controls', async ({ page }) => {
  const state = await open(page, { draft: true, async handleRequest({ path, route, reply }) {
    if (path === root + 'projects/17/' && route.request().method() === 'GET') { await reply(route, envelope(18, makeDraft(18))); return true }
    return false
  } })
  await expect(panel(page).getByRole('alert')).toContainText('different project')
  await expect(panel(page)).not.toContainText('Project 18 fire and gas engineering')
  await expect(panel(page).getByRole('button', { name: 'Accept supported inputs & build draft', exact: true })).toHaveCount(0)
  expect(state.agreementWrites).toEqual([])
  clean(state)
})

test('stale acceptance displays the server conflict and refreshes the current workspace without automatic retry', async ({ page }) => {
  let attempts = 0
  const state = await open(page, { draft: true, async handleRequest({ path, route, state: current, reply }) {
    if (path === root + 'projects/17/accept/') { attempts += 1; current.agreements[17].workspace.revision = 2; await reply(route, { detail: 'Agreement sources changed. Reload the workspace before accepting.' }, 409); return true }
    return false
  } })
  await panel(page).getByRole('button', { name: 'Accept supported inputs & build draft', exact: true }).click()
  await expect(panel(page).getByRole('alert')).toContainText('Agreement sources changed.')
  await panel(page).getByRole('button', { name: 'Check progress', exact: true }).click()
  await expect(panel(page).getByRole('alert')).toHaveCount(0)
  expect(attempts).toBe(1)
  clean(state)
})

test('new project can be created from one agreement through the existing create-project entry', async ({ page }) => {
  const state = await open(page, { query: 'view=portfolio' })
  await page.getByRole('button', { name: 'Create project', exact: true }).first().click()
  await page.getByRole('button', { name: 'Set up from agreement', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Create project from an agreement', exact: true })
  await dialog.getByLabel('Agreement document', { exact: true }).setInputFiles(document)
  await dialog.getByLabel('Project name', { exact: false }).fill('Agreement created project')
  await dialog.getByRole('button', { name: 'Analyze & set up project', exact: true }).click()
  await expect(page).toHaveURL(/project=99/)
  await openSetup(page)
  await expect(panel(page).getByRole('progressbar')).toBeVisible()
  expect(state.agreementWrites).toHaveLength(1)
  expect(state.agreementWrites[0].path).toBe(root + 'create/')
  expect(state.agreementWrites[0].body).not.toContain('ai_api_key')
  clean(state)
})

test('upload validation explains an unsupported format without sending a request', async ({ page }) => {
  const state = await open(page)
  await panel(page).getByLabel('Agreement document', { exact: true }).setInputFiles({ ...document, name: 'unexpected.exe' })
  await expect(panel(page).getByRole('alert')).toContainText('Choose a PDF, Word document, spreadsheet, CSV or text file.')
  await expect(panel(page).getByRole('button', { name: 'Analyze & set up project', exact: true })).toBeDisabled()
  expect(state.agreementWrites).toEqual([])
  clean(state)
})

test('new-project field errors are readable and retries reuse a key until the request inputs change', async ({ page }) => {
  const bodies = []
  const state = await open(page, { query: 'view=portfolio', async handleRequest({ path, route, reply }) {
    if (path === root + 'create/') { bodies.push(route.request().postData()); await reply(route, { ai_model: ['Choose an available Anthropic model.'] }, 400); return true }
    return false
  } })
  await page.getByRole('button', { name: 'Create project', exact: true }).first().click()
  await page.getByRole('button', { name: 'Set up from agreement', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Create project from an agreement', exact: true })
  await dialog.getByLabel('Agreement document', { exact: true }).setInputFiles({ ...document, name: 'agreement.docx' })
  const submit = dialog.getByRole('button', { name: 'Analyze & set up project', exact: true })
  await submit.click()
  await expect(dialog.getByRole('alert')).toContainText('ai model: Choose an available Anthropic model.')
  await submit.click()
  await expect.poll(() => bodies.length).toBe(2)
  const key = body => body.match(/name="idempotency_key"\r\n\r\n([^\r]+)/)?.[1]
  expect(key(bodies[0])).toMatch(/^[0-9a-f-]{36}$/)
  expect(key(bodies[1])).toBe(key(bodies[0]))
  await dialog.getByLabel('Project name', { exact: false }).fill('Updated project name')
  await submit.click()
  await expect.poll(() => bodies.length).toBe(3)
  expect(key(bodies[2])).not.toBe(key(bodies[1]))
  await dialog.getByText('Connect Anthropic for AI suggestions (optional)', { exact: true }).click()
  await dialog.getByLabel('Anthropic model', { exact: false }).fill('claude-project-model')
  await submit.click()
  await expect.poll(() => bodies.length).toBe(4)
  expect(key(bodies[3])).not.toBe(key(bodies[2]))
  await expect(dialog.getByLabel('Anthropic API key', { exact: true })).toHaveAttribute('type', 'password')
  clean(state)
})

test('a duplicate project code explains the field error without exposing a machine error code', async ({ page }) => {
  let requests = 0
  const state = await open(page, { query: 'view=portfolio', async handleRequest({ path, route, reply }) {
    if (path === root + 'create/') {
      requests += 1
      await reply(route, requests === 1 ? { code: ['A project already uses this code.'] } : { code: 'agreement_request_conflict', detail: 'Use a new request key after changing the agreement inputs.' }, requests === 1 ? 400 : 409)
      return true
    }
    return false
  } })
  await page.getByRole('button', { name: 'Create project', exact: true }).first().click()
  await page.getByRole('button', { name: 'Set up from agreement', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Create project from an agreement', exact: true })
  await dialog.getByLabel('Agreement document', { exact: true }).setInputFiles(document)
  await dialog.getByLabel('Project code', { exact: false }).fill('EXISTING-17')
  await dialog.getByRole('button', { name: 'Analyze & set up project', exact: true }).click()
  await expect(dialog.getByRole('alert')).toHaveText('code: A project already uses this code.')
  await dialog.getByLabel('Project code', { exact: false }).fill('NEW-19')
  await dialog.getByRole('button', { name: 'Analyze & set up project', exact: true }).click()
  await expect(dialog.getByRole('alert')).toHaveText('Use a new request key after changing the agreement inputs.')
  await expect(dialog.getByRole('alert')).not.toContainText('agreement_request_conflict')
  clean(state)
})

test('switching projects hides the previous agreement immediately and ignores a delayed old response', async ({ page }) => {
  let release
  let block = false
  const gate = new Promise(resolve => { release = resolve })
  const state = await open(page, { draft: true, async handleRequest({ path, route, reply }) {
    if (block && path === root + 'projects/17/' && route.request().method() === 'GET') { await gate; await reply(route, envelope(17, makeDraft(17))); return true }
    return false
  } })
  await expect(panel(page)).toContainText('Project 17 fire and gas engineering')
  await page.evaluate(() => { window.history.pushState({}, '', '/projects?project=18'); window.dispatchEvent(new PopStateEvent('popstate')) })
  await expect(dialog(page)).toBeHidden()
  await openSetup(page)
  await expect(panel(page)).toContainText('Project 18 fire and gas engineering')
  await expect(panel(page)).not.toContainText('Project 17 fire and gas engineering')
  block = true
  await page.evaluate(() => { window.history.pushState({}, '', '/projects?project=17'); window.dispatchEvent(new PopStateEvent('popstate')) })
  await expect(dialog(page)).toBeHidden()
  await openSetup(page)
  await expect(panel(page)).toContainText('Loading saved agreement workspace')
  await page.evaluate(() => { window.history.pushState({}, '', '/projects?project=18'); window.dispatchEvent(new PopStateEvent('popstate')) })
  await expect(dialog(page)).toBeHidden()
  await openSetup(page)
  await expect(panel(page)).toContainText('Project 18 fire and gas engineering')
  release()
  await expect(panel(page)).not.toContainText('Project 17 fire and gas engineering')
  expect(state.agreementWrites).toEqual([])
  clean(state)
})

test('header setup action replaces the panel, restores keyboard focus and stays accessible at desktop and narrow widths', async ({ page }) => {
  const state = await open(page, { draft: true, openSetup: false })
  await page.evaluate(() => window.document.fonts.ready)
  const dateBox = await page.locator('.pd-report-date').boundingBox()
  const actionBox = await setup(page).boundingBox()
  expect(actionBox.x).toBeGreaterThanOrEqual(dateBox.x + dateBox.width - 1)
  expect(Math.abs(actionBox.y + actionBox.height / 2 - dateBox.y - dateBox.height / 2)).toBeLessThan(24)
  await expect(page.getByText('Set up project from an agreement', { exact: true })).toHaveCount(0)
  await page.screenshot({ path: 'artifacts/agreement-header-action-desktop.png', fullPage: false })
  await setup(page).focus()
  await page.keyboard.press('Enter')
  await expect(dialog(page)).toBeVisible()
  const dialogBox = await dialog(page).boundingBox()
  expect(Math.abs(dialogBox.x - (1672 - dialogBox.width) / 2)).toBeLessThan(2)
  expect(Math.abs(dialogBox.y - (941 - dialogBox.height) / 2)).toBeLessThan(2)
  const font = await panel(page).evaluate(element => getComputedStyle(element).fontFamily)
  expect(font).toContain('IBM Plex Sans')
  const result = await new AxeBuilder({ page }).include('dialog[open]').analyze()
  expect(result.violations).toEqual([])
  const width = await page.evaluate(() => ({ body: window.document.body.scrollWidth, viewport: window.innerWidth }))
  expect(width.body).toBeLessThanOrEqual(width.viewport)
  await page.screenshot({ path: 'artifacts/agreement-workspace-desktop.png', fullPage: false })
  await closeSetup(page)
  await page.setViewportSize({ width: 760, height: 900 })
  await expect(setup(page)).toBeVisible()
  const narrowWidth = await page.evaluate(() => ({ body: window.document.body.scrollWidth, viewport: window.innerWidth }))
  expect(narrowWidth.body).toBeLessThanOrEqual(narrowWidth.viewport)
  await openSetup(page)
  await expect(panel(page).getByRole('button', { name: 'Accept supported inputs & build draft', exact: true })).toBeVisible()
  await expect(panel(page).getByRole('region', { name: 'Overview agreement inputs', exact: true })).toBeVisible()
  await closeSetup(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await openSetup(page)
  const mobileBox = await dialog(page).boundingBox()
  expect(mobileBox.x).toBeGreaterThanOrEqual(0)
  expect(mobileBox.x + mobileBox.width).toBeLessThanOrEqual(390)
  expect(mobileBox.y).toBeGreaterThanOrEqual(0)
  expect(mobileBox.y + mobileBox.height).toBeLessThanOrEqual(844)
  await expect(dialog(page).getByRole('button', { name: 'Close agreement setup', exact: true })).toBeVisible()
  await page.screenshot({ path: 'artifacts/agreement-header-mobile-dialog.png', fullPage: false })
  await closeSetup(page)
  clean(state)
})
