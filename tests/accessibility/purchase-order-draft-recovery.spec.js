import { test, expect } from '@playwright/test'
import { Buffer } from 'node:buffer'
import { mkdir, writeFile } from 'node:fs/promises'
import { orderFormHarness, orderFormId, orderFormNumber, orderFormRecommendation } from '../fixtures/purchase-order-form.fixture'

test.setTimeout(150000)
test.use({ serviceWorkers: 'block', viewport: { width: 1659, height: 952 } })

const artifactDirectory = '../artifacts/po-draft-project-selection-20260923'
const projects = [
  { id: 17, project_number: '5900985', project_name: 'Original PR project', source: 'procurement', status: 'active' },
  { id: 18, project_number: '5901055', project_name: 'Additional engineering project', source: 'procurement', status: 'active' },
  { id: 19, project_number: '5901123', project_name: 'Additional construction project', source: 'procurement', status: 'active' },
]
const editor = page => page.locator('.purchase-order-form-workspace')
const tabs = page => page.getByRole('tablist', { name: 'Purchase order sections', exact: true })
const tab = (page, name) => tabs(page).getByRole('tab', { name, exact: true })
const title = page => page.locator('[name="title"]')
const projectOutput = page => page.getByRole('textbox', { name: 'Project Number', exact: true })
const selectionList = page => page.getByRole('list', { name: 'Selected projects', exact: true })
const lastSnapshot = state => state.requests.filter(request => request.path.endsWith('/preview-document/') && request.body?.format === 'pdf').at(-1)?.body.snapshot
const orderWrites = state => state.requests.filter(({ path, method }) => ['POST', 'PATCH'].includes(method) && /^\/api\/v1\/procurement\/orders\/(?:[^/]+\/)?$/.test(path) && !path.includes('/preview-document/') && !path.includes('/reserve-number/') && !path.includes('/create-project/'))
const clean = state => { expect(state.unknown).toEqual([]); expect(state.pageErrors).toEqual([]) }

async function openNew(page, prepare) {
  const state = await orderFormHarness(page, {
    prepare: fixture => { fixture.projects = projects.map(project => ({ ...project })); prepare?.(fixture) },
    handleRequest: async (route, fixture, url) => {
      if (url.pathname.endsWith('/preview-document/') && route.request().postData()?.includes('recovered-scope.txt')) {
        fixture.recoveredAttachmentContents ||= []
        fixture.recoveredAttachmentContents.push(route.request().postData().includes('Synthetic attachment content retained across reload.'))
      }
      if (url.pathname !== '/api/v1/procurement/orders/create-project/' || route.request().method() !== 'POST') return false
      const body = route.request().postDataJSON()
      const created = { id: 20, ...body, source: 'procurement', status: 'active' }
      fixture.projects.push(created)
      await route.fulfill({ status: 201, json: created })
      return true
    },
  })
  await expect(page.getByRole('heading', { name: 'New purchase order', exact: true })).toBeVisible({ timeout: 120000 })
  await page.locator('#po-pr-search').fill('9001')
  await page.getByRole('option', { name: new RegExp(orderFormRecommendation.pr_number) }).click()
  await expect(page.getByLabel('PO Number', { exact: true })).toHaveValue(orderFormNumber)
  await page.getByRole('combobox', { name: 'Price basis', exact: true }).selectOption('none')
  await page.locator('[name="payment_terms"]').fill('Net 45')
  return state
}

async function addProject(page, code) {
  await page.locator('#po-project-search').fill(code)
  await page.locator('#project-options').getByRole('option', { name: new RegExp(code) }).click()
  await expect(page.locator('#po-project-search')).toHaveValue('')
  await expect(selectionList(page).getByRole('button', { name: `Remove project ${code}`, exact: true })).toBeVisible()
}

async function expectFreshNewForm(page) {
  await page.goto('/procurement/orders/new', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'New purchase order', exact: true })).toBeVisible({ timeout: 90000 })
  await expect(title(page)).toHaveCount(0)
  await expect(editor(page)).toContainText('Select an existing PR to continue')
  await expect(page.locator('#po-pr-search')).toHaveValue('')
  await expect(projectOutput(page)).toHaveValue('')
  await expect(tab(page, 'Header, Buyer & Project')).toHaveAttribute('aria-selected', 'true')
  await expect(selectionList(page).getByRole('button')).toHaveCount(0)
}

test('refresh restores unsaved PO fields, linked PR, multiple projects, line edits, attachment bytes and active tab', async ({ page }) => {
  const state = await openNew(page)
  await title(page).fill('Recovered engineering purchase order')
  await page.getByRole('textbox', { name: 'Seller Reference', exact: true }).fill('Vinoth')
  await addProject(page, '5901055')
  await tab(page, 'PO Description & Scope').click()
  await page.getByRole('textbox', { name: 'PO Narrative', exact: true }).fill('Unsaved narrative retained after refreshing the browser.')
  await tab(page, 'Summary of Prices').click()
  await page.locator('[data-cell="0-4"]').fill('2')
  await page.locator('[data-cell="0-6"]').fill('125')
  await page.locator('[data-cell="0-6"]').press('Tab')
  await tab(page, 'Attachments').click()
  await page.locator('#po-attachment-multiple').setInputFiles({ name: 'recovered-scope.txt', mimeType: 'text/plain', buffer: Buffer.from('Synthetic attachment content retained across reload.') })
  await page.getByRole('textbox', { name: 'Attachment 1 title', exact: true }).fill('Recovered scope title')
  await page.getByRole('textbox', { name: 'Attachment 1 description', exact: true }).fill('Retained attachment description')
  await expect.poll(() => state.requests.filter(request => request.path.endsWith('/preview-document/')).at(-1)?.body.attachment_metadata?.[0]?.title).toBe('Recovered scope title')
  // File bytes are asynchronous; reload once browser storage has committed them.
  await expect.poll(() => page.evaluate(() => new Promise(resolve => {
    const opening = indexedDB.open('radai-purchase-order-drafts')
    opening.onerror = () => resolve(false)
    opening.onsuccess = () => {
      const database = opening.result
      if (!database.objectStoreNames.contains('drafts')) { database.close(); resolve(false); return }
      const reading = database.transaction('drafts', 'readonly').objectStore('drafts').getAll()
      reading.onerror = () => { database.close(); resolve(false) }
      reading.onsuccess = () => {
        const stored = reading.result.some(record => record.files?.some(entry => entry.file instanceof Blob && entry.file.size > 0 && entry.name === 'recovered-scope.txt'))
        database.close()
        resolve(stored)
      }
    }
  }))).toBe(true)
  const reservations = state.requests.filter(request => request.path.endsWith('/reserve-number/')).length
  const attachmentPreviews = state.recoveredAttachmentContents.length

  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'New purchase order', exact: true })).toBeVisible({ timeout: 90000 })
  await expect(tab(page, 'Attachments')).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('textbox', { name: 'Attachment 1 title', exact: true })).toHaveValue('Recovered scope title')
  await expect(page.getByRole('textbox', { name: 'Attachment 1 description', exact: true })).toHaveValue('Retained attachment description')
  await expect(editor(page)).toContainText('recovered-scope.txt')
  await expect.poll(() => state.requests.filter(request => request.path.endsWith('/preview-document/')).at(-1)?.body.attachments?.filename).toBe('recovered-scope.txt')
  await expect.poll(() => state.recoveredAttachmentContents.length).toBeGreaterThan(attachmentPreviews)
  expect(state.recoveredAttachmentContents.at(-1)).toBe(true)
  await mkdir(artifactDirectory, { recursive: true })
  await page.screenshot({ path: `${artifactDirectory}/recovered-attachment-tab.png` })
  await tab(page, 'Header, Buyer & Project').click()
  await expect(title(page)).toHaveValue('Recovered engineering purchase order')
  await expect(page.locator('#po-pr-search')).toHaveValue(orderFormRecommendation.pr_number)
  await expect(page.getByLabel('PO Number', { exact: true })).toHaveValue(orderFormNumber)
  await expect(projectOutput(page)).toHaveValue('5900985, 5901055')
  await expect(page.getByRole('textbox', { name: 'Seller Reference', exact: true })).toHaveValue('Vinoth')
  await expect(page.locator('[name="payment_terms"]')).toHaveValue('Net 45')
  await expect(page.getByRole('combobox', { name: 'Price basis', exact: true })).toHaveValue('none')
  await tab(page, 'PO Description & Scope').click()
  await expect(page.getByRole('textbox', { name: 'PO Narrative', exact: true })).toContainText('Unsaved narrative retained after refreshing the browser.')
  await tab(page, 'Summary of Prices').click()
  await expect(page.locator('[data-cell="0-4"]')).toHaveValue('2')
  await expect(page.locator('[data-cell="0-6"]')).toHaveValue('125')
  await expect.poll(() => Number(lastSnapshot(state)?.total_amount)).toBe(250)
  expect(state.requests.filter(request => request.path.endsWith('/reserve-number/'))).toHaveLength(reservations)
  expect(orderWrites(state)).toEqual([])
  clean(state)
})

test('explicit Cancel discards the local PO and reopening starts a clean form', async ({ page }) => {
  const state = await openNew(page)
  await title(page).fill('Discard this unsaved order')
  await addProject(page, '5901055')
  await expect.poll(() => lastSnapshot(state)?.title).toBe('Discard this unsaved order')
  await editor(page).getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Purchase Orders', exact: true })).toBeVisible()
  await expectFreshNewForm(page)
  expect(orderWrites(state)).toEqual([])
  clean(state)
})

test('successful Save draft persists once and clears the recovery copy for the next new order', async ({ page }) => {
  const state = await openNew(page)
  await title(page).fill('Successfully saved recovered order')
  await addProject(page, '5901055')
  await editor(page).getByRole('button', { name: 'Save draft', exact: true }).first().click()
  await expect(page.getByRole('heading', { name: 'Purchase Orders', exact: true })).toBeVisible()
  expect(state.acceptedWrites).toHaveLength(1)
  expect(state.record).toMatchObject({ title: 'Successfully saved recovered order', status: 'draft', project_number: '5900985, 5901055' })
  await expectFreshNewForm(page)
  expect(orderWrites(state)).toHaveLength(1)
  clean(state)
})

test('a failed Save draft preserves unsaved values through refresh without automatically retrying the API write', async ({ page }) => {
  const state = await openNew(page, fixture => { fixture.saveError = { detail: 'Synthetic save failure. Retry after reviewing the order.' } })
  await title(page).fill('Keep this rejected draft')
  await addProject(page, '5901055')
  await editor(page).getByRole('button', { name: 'Save draft', exact: true }).first().click()
  await expect(editor(page).getByRole('alert')).toContainText('Synthetic save failure.')
  expect(orderWrites(state)).toHaveLength(1)
  expect(state.acceptedWrites).toEqual([])
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'New purchase order', exact: true })).toBeVisible({ timeout: 90000 })
  await expect(title(page)).toHaveValue('Keep this rejected draft')
  await expect(projectOutput(page)).toHaveValue('5900985, 5901055')
  await expect(page.locator('#po-pr-search')).toHaveValue(orderFormRecommendation.pr_number)
  await expect.poll(() => lastSnapshot(state)?.title).toBe('Keep this rejected draft')
  expect(orderWrites(state)).toHaveLength(1)
  expect(state.acceptedWrites).toEqual([])
  clean(state)
})

test('project search adds several selections, removes and readds one, avoids duplicates and creates another project', async ({ page }) => {
  const state = await openNew(page)
  await expect(projectOutput(page)).toHaveAttribute('readonly', '')
  await addProject(page, '5901055')
  await addProject(page, '5901123')
  await expect(projectOutput(page)).toHaveValue('5900985, 5901055, 5901123')
  await selectionList(page).getByRole('button', { name: 'Remove project 5901055', exact: true }).click()
  await expect(projectOutput(page)).toHaveValue('5900985, 5901123')
  await addProject(page, '5901055')
  await addProject(page, '5901055')
  await expect(projectOutput(page)).toHaveValue('5900985, 5901123, 5901055')
  await expect(selectionList(page).getByRole('button')).toHaveCount(3)
  await page.getByRole('button', { name: '+ Create New Project', exact: true }).click()
  await page.getByRole('textbox', { name: 'New project number', exact: true }).fill('5901999')
  await page.getByRole('textbox', { name: 'New project title', exact: true }).fill('Synthetic newly created project')
  await page.getByRole('button', { name: /^Create and (?:Select|Add) Project$/ }).click()
  await expect(selectionList(page).getByRole('button', { name: 'Remove project 5901999', exact: true })).toBeVisible()
  await expect(page.locator('#po-project-search')).toHaveValue('')
  await expect(projectOutput(page)).toHaveValue('5900985, 5901123, 5901055, 5901999')
  const creates = state.requests.filter(request => request.path.endsWith('/create-project/'))
  expect(creates).toHaveLength(1)
  expect(creates[0].body).toEqual({ project_number: '5901999', project_name: 'Synthetic newly created project' })
  await expect.poll(() => lastSnapshot(state)?.project_number).toBe('5900985, 5901123, 5901055, 5901999')
  await mkdir(artifactDirectory, { recursive: true })
  await writeFile(`${artifactDirectory}/multiple-project-snapshot.json`, JSON.stringify(lastSnapshot(state), null, 2))
  await expect(page.getByRole('complementary', { name: 'Live purchase order preview', exact: true }).getByRole('button', { name: 'Download PDF', exact: true })).toBeEnabled({ timeout: 30000 })
  await selectionList(page).scrollIntoViewIfNeeded()
  await page.screenshot({ path: `${artifactDirectory}/selected-projects-desktop.png` })
  await page.setViewportSize({ width: 390, height: 844 })
  await selectionList(page).scrollIntoViewIfNeeded()
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  await page.screenshot({ path: `${artifactDirectory}/selected-projects-mobile.png` })
  for (const code of ['5900985', '5901123', '5901055', '5901999']) await selectionList(page).getByRole('button', { name: `Remove project ${code}`, exact: true }).click()
  await expect(projectOutput(page)).toHaveValue('')
  await expect.poll(() => lastSnapshot(state)?.contact_persons?.project_selections).toEqual([])
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'New purchase order', exact: true })).toBeVisible({ timeout: 90000 })
  await expect(projectOutput(page)).toHaveValue('')
  await expect(selectionList(page).getByRole('button')).toHaveCount(0)
  expect(orderWrites(state)).toEqual([])
  clean(state)
})

test('an existing PO edit recovers after refresh and keeps the original PATCH baseline', async ({ page }) => {
  const state = await orderFormHarness(page, { path: '/procurement/orders', prepare: fixture => {
    fixture.record = {
      id: orderFormId, po_number: orderFormNumber, po_date: '2026-09-15', status: 'draft',
      title: 'Original saved order', vendor: 21, vendor_name: fixture.vendors[0].name,
      pr_reference: orderFormRecommendation.id, pr_number: orderFormRecommendation.pr_number,
      project_number: '5900985', currency: 'AED', total_amount: '100.00', net_amount: '100.00',
      tax_amount: '0.00', vat_basis: 'none', payment_terms: 'Net 30', items: [],
      attachments: [{ filename: 'original-saved-scope.txt', s3_key: 'original-scope' }], approval_log: [],
    }
    fixture.orders = [fixture.record]
  } })
  const openEdit = async () => {
    await page.getByRole('button', { name: `Actions for ${orderFormNumber}`, exact: true }).click()
    await page.getByRole('menuitem', { name: 'Edit order', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Edit purchase order', exact: true })).toBeVisible({ timeout: 90000 })
  }
  await openEdit()
  await title(page).fill('Recovered edit to existing order')
  await expect.poll(() => lastSnapshot(state)?.title).toBe('Recovered edit to existing order')
  state.record.attachments.push({ filename: 'new-server-attachment.txt', s3_key: 'server-latest' })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await openEdit()
  await expect(title(page)).toHaveValue('Recovered edit to existing order')
  await tab(page, 'Attachments').click()
  await expect(editor(page)).toContainText('original-saved-scope.txt')
  await expect(editor(page)).toContainText('new-server-attachment.txt')
  await editor(page).getByRole('button', { name: 'Save changes', exact: true }).first().click()
  await expect(page.getByRole('heading', { name: 'Purchase Orders', exact: true })).toBeVisible()
  expect(state.acceptedWrites).toHaveLength(1)
  expect(state.acceptedWrites[0]).toMatchObject({ method: 'PATCH', body: { title: 'Recovered edit to existing order' } })
  expect(Object.keys(state.acceptedWrites[0].body)).toEqual(['title'])
  expect(state.record.attachments).toHaveLength(2)
  clean(state)
})

test('refresh while the PO number is being reserved retries once and preserves the entered fields', async ({ page }) => {
  let releaseFirst
  const firstReservation = new Promise(resolve => { releaseFirst = resolve })
  let reservations = 0
  const state = await orderFormHarness(page, { handleRequest: async (route, _fixture, url) => {
    if (url.pathname !== '/api/v1/procurement/orders/reserve-number/' || route.request().method() !== 'POST') return false
    reservations += 1
    if (reservations !== 1) return false
    await firstReservation
    await route.abort().catch(() => {})
    return true
  } })
  try {
    await expect(page.getByRole('heading', { name: 'New purchase order', exact: true })).toBeVisible({ timeout: 120000 })
    await page.locator('#po-pr-search').fill('9001')
    await page.getByRole('option', { name: new RegExp(orderFormRecommendation.pr_number) }).click()
    await expect.poll(() => reservations).toBe(1)
    await expect(page.getByLabel('PO Number', { exact: true })).toHaveValue('')
    await title(page).fill('Entered before number reservation finished')
    await expect.poll(() => lastSnapshot(state)?.title).toBe('Entered before number reservation finished')
    await page.reload({ waitUntil: 'domcontentloaded' })
    releaseFirst()
    await expect(page.getByRole('heading', { name: 'New purchase order', exact: true })).toBeVisible({ timeout: 90000 })
    await expect(page.getByLabel('PO Number', { exact: true })).toHaveValue(orderFormNumber)
    await expect(title(page)).toHaveValue('Entered before number reservation finished')
    await expect(page.locator('#po-pr-search')).toHaveValue(orderFormRecommendation.pr_number)
    await expect(page.getByRole('complementary', { name: 'Live purchase order preview', exact: true }).getByRole('button', { name: 'Download PDF', exact: true })).toBeEnabled({ timeout: 30000 })
    expect(reservations).toBe(2)
    expect(orderWrites(state)).toEqual([])
    clean(state)
  } finally { releaseFirst() }
})
