import { test, expect } from '@playwright/test'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { orderFormHarness, orderFormId, orderFormNumber, orderFormRecommendation } from '../fixtures/purchase-order-form.fixture'

test.setTimeout(120000)
test.use({ serviceWorkers: 'block', viewport: { width: 1659, height: 952 } })

const artifactDirectory = '../artifacts/po-document-fields-20260923'
const projectNumbers = ['5900985', '5901055', '5901123']
const projectText = projectNumbers.join(', ')
const projectDetails = projectNumbers.map((project_number, index) => ({ project_id: 17 + index, project_number, project_name: `Synthetic project ${index + 1}`, type: 'project' }))
const preview = page => page.getByRole('complementary', { name: 'Live purchase order preview', exact: true })
const previewRequests = state => state.requests.filter(request => request.path.endsWith('/preview-document/'))
const lastSnapshot = state => previewRequests(state).filter(request => request.body.format === 'pdf').at(-1)?.body.snapshot
const clean = state => {
  expect(state.acceptedWrites).toEqual([])
  expect(state.unknown).toEqual([])
  expect(state.pageErrors).toEqual([])
}
async function download(page, name, filename) {
  const pending = page.waitForEvent('download')
  await preview(page).getByRole('button', { name, exact: true }).click()
  const result = await pending
  await result.saveAs(`${artifactDirectory}/${filename}`)
  return readFile(await result.path())
}

test('a three-project PR keeps every project in current PDF and Word snapshots while seller reference leaves confirmation contact blank', async ({ page }) => {
  const state = await orderFormHarness(page, {
    recommendation: { project_details: projectDetails, project_department: 'Synthetic project 1 (5900985)' },
    prepare: fixture => { fixture.projects = projectDetails.map(project => ({ id: project.project_id, project_number: project.project_number, project_name: project.project_name, source: 'procurement', status: 'active' })) },
  })
  await expect(page.getByRole('heading', { name: 'New purchase order', exact: true })).toBeVisible({ timeout: 90000 })
  await page.locator('#po-pr-search').fill('9001')
  await page.getByRole('option', { name: new RegExp(orderFormRecommendation.pr_number) }).click()
  await expect(page.getByRole('textbox', { name: 'Project Number', exact: true })).toHaveValue(projectText)
  await page.getByRole('textbox', { name: 'Seller Reference', exact: true }).fill('Vinoth')
  await expect.poll(() => lastSnapshot(state)?.seller_reference).toBe('Vinoth')
  await expect.poll(() => lastSnapshot(state)?.seller_contact_person).toBe('')

  // Selecting a primary master record must not discard the linked PR's other projects.
  await page.locator('#po-project-search').fill('5900')
  await page.getByRole('option', { name: /5900985.*Synthetic project 1/ }).click()
  await expect(page.getByRole('textbox', { name: 'Project Number', exact: true })).toHaveValue(projectText)
  await expect.poll(() => lastSnapshot(state)?.project_number).toBe(projectText)
  await expect(preview(page).getByRole('button', { name: 'Download PDF', exact: true })).toBeEnabled({ timeout: 30000 })
  const pdfSnapshot = structuredClone(lastSnapshot(state))
  await mkdir(artifactDirectory, { recursive: true })
  const pdfCount = previewRequests(state).length
  expect(await download(page, 'Download PDF', 'browser-preview-transport.pdf')).toEqual(state.generatedPdf)
  expect(previewRequests(state)).toHaveLength(pdfCount)
  expect((await download(page, 'Download Word', 'browser-preview-transport.docx')).toString()).toBe(state.generatedWord)
  const word = previewRequests(state).at(-1).body
  expect(word.format).toBe('word')
  expect(word.snapshot).toEqual(pdfSnapshot)
  expect(word.snapshot).toMatchObject({ project_number: projectText, seller_reference: 'Vinoth', seller_contact_person: '', status: 'draft' })
  expect(word.snapshot.approval_signature).toBe('')
  expect(word.snapshot.approved_at).toBe('')
  expect(word.snapshot.approved_date).toBe('')
  expect(word.snapshot.approval_log.every(entry => String(entry.status).toLowerCase() === 'pending')).toBe(true)
  await writeFile(`${artifactDirectory}/current-document-snapshots.json`, JSON.stringify({ pdf: pdfSnapshot, word: word.snapshot }, null, 2))
  await page.screenshot({ path: `${artifactDirectory}/three-project-order-form.png` })
  clean(state)
})

test('editing seller reference preserves an intentional saved confirmation contact independently', async ({ page }) => {
  const state = await orderFormHarness(page, { path: '/procurement/orders', prepare: fixture => {
    fixture.record = {
      id: orderFormId, po_number: orderFormNumber, po_date: '2026-09-15', status: 'draft',
      title: 'Existing intentional confirmation contact', vendor: 21, vendor_name: fixture.vendors[0].name,
      pr_reference: orderFormRecommendation.id, pr_number: orderFormRecommendation.pr_number,
      seller_reference: 'Original supplier reference', seller_contact_person: 'Explicit confirmation contact',
      project_number: projectText, currency: 'AED', total_amount: '100.00', net_amount: '100.00',
      tax_amount: '0.00', vat_basis: 'none', items: [], attachments: [], approval_log: [],
    }
    fixture.orders = [fixture.record]
  } })
  await page.getByRole('button', { name: `Actions for ${orderFormNumber}`, exact: true }).click()
  await page.getByRole('menuitem', { name: 'Edit order', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Edit purchase order', exact: true })).toBeVisible({ timeout: 90000 })
  await page.getByRole('textbox', { name: 'Seller Reference', exact: true }).fill('Vinoth')
  await expect.poll(() => lastSnapshot(state)?.seller_reference).toBe('Vinoth')
  expect(lastSnapshot(state).seller_contact_person).toBe('Explicit confirmation contact')
  expect(lastSnapshot(state).project_number).toBe(projectText)
  clean(state)
})

test('historical PR project labels preserve three seven-digit project numbers without including shorter work references', async ({ page }) => {
  const labels = [
    '5901142-SARB PRODUCED WATER TREATMENT PROJECT',
    'C & F CED.FWA T31 Plant Modifications (MOCs) for Upper Zakum Package 5901086',
    'DETAILED ENGINEERING FOR A SYNTHETIC PACKAGE (NEB) (10522 & 10523), 5901056',
  ]
  const expected = '5901142, 5901086, 5901056'
  const state = await orderFormHarness(page, { recommendation: {
    project_details: labels.map(label => ({ source: 'historical', label, value: label })),
    project_department: labels.join('; '),
  } })
  await expect(page.getByRole('heading', { name: 'New purchase order', exact: true })).toBeVisible({ timeout: 90000 })
  await page.locator('#po-pr-search').fill('9001')
  await page.getByRole('option', { name: new RegExp(orderFormRecommendation.pr_number) }).click()
  await expect(page.getByRole('textbox', { name: 'Project Number', exact: true })).toHaveValue(expected)
  await expect.poll(() => lastSnapshot(state)?.project_number).toBe(expected)
  expect(lastSnapshot(state).project_number).not.toContain('10522')
  expect(lastSnapshot(state).project_number).not.toContain('10523')
  await mkdir(artifactDirectory, { recursive: true })
  await writeFile(`${artifactDirectory}/historical-project-snapshot.json`, JSON.stringify(lastSnapshot(state), null, 2))
  clean(state)
})

test('the first PO document page shows pending CEO identity but no signature, stamp or approval timestamp and leaves confirmation contact blank', async ({ page }) => {
  const requests = [], errors = []
  const signature = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aDCEAAAAASUVORK5CYII='
  const po = {
    id: orderFormId, po_number: orderFormNumber, status: 'draft', seller_reference: 'Vinoth', seller_contact_person: '',
    project_number: projectText, title: 'Pending CEO document identity', currency: 'AED', total_amount: '100.00', net_amount: '100.00', tax_amount: '0.00', vat_basis: 'none', items: [],
    approved_by_name: 'Jarmo Suominen', approved_by_title: 'Sr. Vice President, Middle East\nCEO, Rejlers Abu Dhabi',
    // Stale saved evidence must not turn a pending assignment into an approval.
    approval_signature: signature, approved_at: '2026-09-14T08:15:00Z', approved_date: '2026-09-14',
    approval_log: [{ stage: 'Final Management Sign-off', level: 5, approver: 'Jarmo Suominen', designation: 'Sr. Vice President, Middle East\nCEO, Rejlers Abu Dhabi', user_id: 11, status: 'pending', signature, approved_at: '2026-09-14T08:15:00Z' }],
  }
  await page.addInitScript(value => { window.approvalFixture = value }, { actor: {}, pr: { id: 'synthetic-pr', pr_number: 'SYNTHETIC-PR', items: [], attachments: [] }, po })
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/api/**', route => { requests.push(route.request().url()); return route.fulfill({ status: 400, json: { detail: 'No API requests are expected in the document fixture.' } }) })
  await page.goto('/tests/fixtures/procurement-approval.html?view=documents', { waitUntil: 'domcontentloaded' })
  const firstPage = page.locator('.po-template-page').first()
  await expect(firstPage.getByText('Jarmo Suominen', { exact: true })).toBeVisible()
  await expect(firstPage.getByText('Sr. Vice President, Middle East CEO, Rejlers Abu Dhabi', { exact: true })).toBeVisible()
  await expect(firstPage.getByText('Project:', { exact: true }).locator('..')).toHaveText(`Project:${projectText}`)
  await expect(firstPage.getByText('Seller Reference:', { exact: true }).locator('..')).toHaveText('Seller Reference:Vinoth')
  const confirmation = firstPage.locator('section').filter({ has: page.getByText('Order Confirmation:', { exact: true }) })
  await expect(confirmation.getByText('Contact Person:', { exact: true }).locator('..').locator('span')).toBeEmpty()
  await expect(firstPage.getByText('Approval pending:', { exact: true })).toBeVisible()
  await expect(firstPage.getByText('Approved by:', { exact: true })).toHaveCount(0)
  const signatory = firstPage.locator('section').filter({ has: page.getByText('Approval pending:', { exact: true }) })
  await expect(signatory.getByText('Date:', { exact: true }).locator('..')).toHaveText('Date:')
  await expect(firstPage.getByRole('img', { name: /signature/i })).toHaveCount(0)
  // The page component keeps a transparent stamp placeholder for print spacing.
  for (const stamp of await firstPage.getByRole('img', { name: /approval stamp/i }).all()) await expect(stamp).toHaveCSS('opacity', '0')
  await expect(firstPage).not.toContainText('14 Sept 2026')
  await expect(firstPage).not.toContainText('08:15')
  await mkdir(artifactDirectory, { recursive: true })
  await firstPage.screenshot({ path: `${artifactDirectory}/pending-ceo-first-page.png` })
  expect(requests).toEqual([])
  expect(errors).toEqual([])
})
