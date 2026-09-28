import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { orderFormHarness, orderFormId, orderFormRecommendation } from '../fixtures/purchase-order-form.fixture'

test.setTimeout(180000)
test.use({ serviceWorkers: 'block', viewport: { width: 1780, height: 884 } })

const oldNumber = 'RAD-PRJ-PUR-9002_2026'
const correctedNumber = 'RAD-PRJ-PUR-9002_JUL2026'
const timestamp = '2026-09-15T08:00:00Z'
const correctionPath = `/api/v1/procurement/orders/${orderFormId}/correct-number/`
const artifactDirectory = '../artifacts/po-edit-reference-design-20260928'
const workspace = page => page.locator('.purchase-order-form-workspace')
const tabs = page => workspace(page).getByRole('tablist', { name: 'Purchase order sections', exact: true })
const source = page => workspace(page).getByRole('tab', { name: 'Original source', exact: true })
const save = page => workspace(page).getByRole('button', { name: 'Save changes', exact: true }).last()
const number = page => workspace(page).getByRole('textbox', { name: /^PO number$/i })
const clean = state => { expect(state.unknown).toEqual([]); expect(state.pageErrors).toEqual([]) }

async function open(page, options = {}) {
  const state = await orderFormHarness(page, {
    path: `/procurement/orders/${orderFormId}`,
    prepare: fixture => {
      fixture.record = {
        id: orderFormId, po_number: oldNumber, po_date: '2026-07-01', updated_at: timestamp,
        title: 'Synthetic engineering services', summary: 'Synthetic engineering services (2 months)',
        description: 'Original synthetic engineering scope', status: options.draft ? 'draft' : 'completed',
        commercial_edit_locked: !options.draft,
        vendor: 21, vendor_name: fixture.vendors[0].name, currency: 'USD',
        seller_reference: 'Synthetic Supplier Contact', seller_license_no: 'SYNTHETIC-TL-001',
        seller_email: 'supplier@example.test', seller_phone: '+971500000000', seller_address: 'Abu Dhabi, UAE',
        quote_ref: 'Synthetic quote dated 19.06.2026', pr_reference: orderFormRecommendation.id,
        pr_number: orderFormRecommendation.pr_number, project_number: '5900985',
        project_name: 'EPC for PE4 & PE5 Revamp', project_details: orderFormRecommendation.project_details,
        rad_project_no: '5900985', company_agreement_no: 'SYNTHETIC-AGREEMENT', end_client: 'Synthetic client',
        contractor: 'Synthetic engineering contractor', payment_terms: 'Net 30', payment_mode: 'Bank Transfer',
        marking: 'RAD-PRJ-PUR-9002', expected_delivery: '2026-10-20',
        vat_basis: 'exclusive', net_amount: '1000.00', total_amount: '1050.00',
        tax_amount: '50.00', vat_percentage: 5,
        contact_persons: { show_order_introduction: false, buyer_references: [
          { name: 'Synthetic primary buyer' }, { name: 'Synthetic second buyer' }, { name: 'Synthetic third buyer' },
        ] },
        items: [{ description: 'Synthetic engineering service', quantity: 1, unit_price: 1000, total: 1000 }],
        attachments: [], final_approver_notes: 'Synthetic approval evidence',
        approval_log: options.draft ? [] : [{ level: 1, status: 'approved', source: 'signed_po_pdf', signature_verified: true, user_name: 'Synthetic authorized signer' }],
      }
      fixture.orders = [fixture.record]
      const contentUrl = `/api/v1/procurement/orders/${orderFormId}/uploaded-documents/original/content/`
      fixture.uploadedDocuments = [{ id: 'original', filename: 'Synthetic-original-PO.pdf', content_url: contentUrl }]
      fixture.uploadedContent[contentUrl] = { body: fixture.generatedPdf }
      options.prepare?.(fixture)
    },
    handleRequest: async (route, fixture, url) => {
      if (url.pathname !== correctionPath) return false
      if (fixture.correctionError) {
        await route.fulfill({ status: 409, json: fixture.correctionError })
        return true
      }
      const body = route.request().postDataJSON()
      fixture.record = { ...fixture.record, po_number: body.po_number, updated_at: '2026-09-15T08:01:00Z' }
      fixture.orders = [fixture.record]
      fixture.acceptedWrites.push({ path: url.pathname, method: route.request().method(), body })
      await route.fulfill({ json: fixture.record })
      return true
    },
  })
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeVisible({ timeout: 120000 })
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await expect(workspace(page).getByRole('heading', { name: 'Edit purchase order', exact: true })).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  return state
}

async function typography(locator, expected, pseudo = null) {
  await expect(locator).toBeVisible()
  const value = await locator.evaluate((element, pseudoElement) => {
    const style = getComputedStyle(element, pseudoElement)
    return [style.fontSize, style.fontWeight, style.lineHeight]
  }, pseudo)
  expect(value).toEqual(expected.map(String))
  return value
}

async function measure(page) {
  return page.evaluate(() => {
    const box = selector => {
      const element = document.querySelector(selector)
      const { left, top, right, bottom, width, height } = element.getBoundingClientRect()
      return { left, top, right, bottom, width, height }
    }
    return {
      viewport: innerWidth, pageWidth: document.documentElement.scrollWidth,
      content: box('#application-content > main'), sidebar: box('#application-sidebar'),
      editor: box('.pof-editor'), workspace: box('.purchase-order-form-workspace'),
      preview: box('.pop-preview'), actions: box('.pof-actionbar'),
    }
  })
}

test('approved uploaded PO uses the reference card arrangement and exact typography', async ({ page }) => {
  const state = await open(page)
  for (const label of ['Order & parties', 'Scope & pricing', 'Projects & delivery', 'Approval']) {
    await expect(tabs(page).getByRole('tab', { name: label, exact: true })).toBeVisible()
  }
  for (const label of ['Order & seller', 'Buyer & commercial', 'Scope & projects', 'Approval notes', 'Final signatory']) {
    await expect(workspace(page).getByRole('heading', { name: label, exact: true })).toBeVisible()
  }
  await expect(workspace(page).getByRole('textbox', { name: 'Primary Buyer', exact: true })).toHaveValue('Synthetic primary buyer')
  await expect(workspace(page).getByRole('textbox', { name: 'Reference 2', exact: true })).toHaveValue('Synthetic second buyer')
  await expect(workspace(page).getByRole('textbox', { name: 'Reference 3', exact: true })).toHaveValue('Synthetic third buyer')
  await expect(workspace(page).getByRole('textbox', { name: 'Price Before Discount', exact: true })).toHaveValue('1000')
  const fonts = {
    page: await typography(workspace(page).getByRole('heading', { name: 'Edit purchase order', exact: true }), ['22px', 700, '28px']),
    panel: await typography(workspace(page).getByRole('heading', { name: 'Purchase order preview', exact: true }), ['16px', 700, '22px']),
    section: await typography(workspace(page).getByRole('heading', { name: 'Order & seller', exact: true }), ['14px', 600, '20px']),
    step: await typography(tabs(page).getByRole('tab', { name: 'Order & parties', exact: true }), ['12px', 500, '16px']),
    label: await typography(number(page).locator('..').locator('> span').first(), ['11px', 500, '16px']),
    input: await typography(number(page), ['12px', 400, '18px']),
    placeholder: await typography(number(page), ['12px', 400, '18px'], '::placeholder'),
    button: await typography(save(page), ['12px', 600, '18px']),
    helper: await typography(workspace(page).locator('.pof-ref-vendor summary span'), ['10px', 400, '14px']),
  }
  await expect(source(page)).toHaveAttribute('aria-selected', 'true')
  await expect(workspace(page).locator('.pop-preview canvas').first()).toBeVisible({ timeout: 30000 })
  const geometry = await measure(page)
  expect(geometry.workspace.left).toBeGreaterThanOrEqual(geometry.sidebar.right - 1)
  expect(geometry.preview.left).toBeGreaterThan(geometry.editor.left + geometry.editor.width - 2)
  expect(geometry.preview.width / geometry.workspace.width).toBeGreaterThan(0.36)
  expect(geometry.preview.width / geometry.workspace.width).toBeLessThan(0.43)
  expect(geometry.actions.bottom).toBeLessThanOrEqual(geometry.content.bottom + 1)
  expect(geometry.pageWidth).toBeLessThanOrEqual(geometry.viewport)
  await mkdir(artifactDirectory, { recursive: true })
  await page.screenshot({ path: `${artifactDirectory}/approved-edit-desktop-1780.png` })
  await writeFile(`${artifactDirectory}/desktop-evidence.json`, JSON.stringify({ fonts, geometry }, null, 2))
  const audit = await new AxeBuilder({ page }).include('.purchase-order-form-workspace').analyze()
  await writeFile(`${artifactDirectory}/desktop-accessibility-evidence.json`, JSON.stringify(audit.violations, null, 2))
  expect(audit.violations.filter(({ impact }) => ['serious', 'critical'].includes(impact))).toEqual([])
  expect(state.acceptedWrites).toEqual([])
  clean(state)
})

test('approved number correction retains input after conflict and saves only the requested number', async ({ page }) => {
  const state = await open(page, { prepare: fixture => { fixture.correctionError = { error: 'This purchase order changed. Refresh before saving its number.' } } })
  const original = structuredClone(state.record)
  await number(page).fill(correctedNumber)
  await save(page).click()
  const error = workspace(page).getByRole('alert').filter({ hasText: state.correctionError.error })
  await expect(error).toContainText(state.correctionError.error)
  await typography(error, ['11px', 500, '16px'])
  await expect(number(page)).toHaveValue(correctedNumber)
  expect(state.acceptedWrites).toEqual([])
  state.correctionError = null
  await save(page).click()
  await expect.poll(() => state.acceptedWrites.length).toBe(1)
  expect(state.acceptedWrites).toEqual([{ path: correctionPath, method: 'POST', body: { po_number: correctedNumber, expected_updated_at: timestamp } }])
  expect(state.record.approval_log).toEqual(original.approval_log)
  expect(state.record.total_amount).toBe(original.total_amount)
  expect(state.record.status).toBe('completed')
  await workspace(page).getByRole('button', { name: 'Cancel', exact: true }).click()
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: correctedNumber, exact: true })).toBeVisible()
  clean(state)
})

test('number changes survive keyboard step navigation and protected context stays read-only', async ({ page }) => {
  const state = await open(page)
  await number(page).fill(correctedNumber)
  const first = tabs(page).getByRole('tab', { name: 'Order & parties', exact: true })
  await first.focus()
  await first.press('ArrowRight')
  await expect(tabs(page).getByRole('tab', { name: 'Scope & pricing', exact: true })).toBeFocused()
  await expect(tabs(page).getByRole('tab', { name: 'Scope & pricing', exact: true })).toHaveAttribute('aria-selected', 'true')
  await page.keyboard.press('End')
  await expect(tabs(page).getByRole('tab', { name: 'Approval', exact: true })).toBeFocused()
  await typography(workspace(page).locator('.pof-ref-badge').first(), ['10px', 600, '14px'])
  await page.keyboard.press('Home')
  await expect(first).toBeFocused()
  await expect(number(page)).toHaveValue(correctedNumber)
  const writable = await workspace(page).locator('.pof-section-panel input, .pof-section-panel textarea, .pof-section-panel select').evaluateAll(elements => elements.filter(element => !element.disabled && !element.readOnly).map(element => element.getAttribute('aria-label') || element.name || element.id))
  expect(writable).toHaveLength(1)
  expect(state.acceptedWrites).toEqual([])
  clean(state)
})

test('narrow edit layouts keep all controls reachable without horizontal page overflow', async ({ page }) => {
  const state = await open(page)
  const measurements = []
  for (const width of [1024, 390]) {
    await page.setViewportSize({ width, height: 844 })
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    await expect(save(page)).toBeEnabled()
    await number(page).scrollIntoViewIfNeeded()
    await expect(number(page)).toBeInViewport()
    await typography(number(page), ['12px', 400, '18px'])
    measurements.push(await measure(page))
    await page.screenshot({ path: `${artifactDirectory}/approved-edit-${width}.png` })
  }
  await expect(page.getByRole('button', { name: 'Open sidebar', exact: true })).toBeVisible()
  await workspace(page).locator('.pop-preview').scrollIntoViewIfNeeded()
  await expect(workspace(page).locator('.pop-preview')).toBeInViewport()
  await page.screenshot({ path: `${artifactDirectory}/approved-edit-mobile-preview.png` })
  await writeFile(`${artifactDirectory}/narrow-evidence.json`, JSON.stringify(measurements, null, 2))
  const audit = await new AxeBuilder({ page }).include('.purchase-order-form-workspace').analyze()
  await writeFile(`${artifactDirectory}/accessibility-evidence.json`, JSON.stringify(audit.violations, null, 2))
  expect(audit.violations.filter(({ impact }) => ['serious', 'critical'].includes(impact))).toEqual([])
  expect(state.acceptedWrites).toEqual([])
  clean(state)
})

test('editable draft retains moved fields, narrative and commercial data when saving', async ({ page }) => {
  const state = await open(page, { draft: true })
  const editor = workspace(page)
  await editor.locator('[name="title"]').fill('Updated synthetic engineering scope')
  await tabs(page).getByRole('tab', { name: 'Scope & pricing', exact: true }).click()
  await editor.getByRole('textbox', { name: 'PO Narrative', exact: true }).fill('Retained narrative after moving between sections')
  await tabs(page).getByRole('tab', { name: 'Projects & delivery', exact: true }).click()
  await editor.locator('[name="company_agreement_no"]').fill('SYNTHETIC-AGREEMENT-EDITED')
  await editor.locator('[name="company_fax"]').fill('+97120000000')
  await tabs(page).getByRole('tab', { name: 'Approval', exact: true }).click()
  await editor.locator('[name="final_approver_notes"]').fill('Retained draft approval note')
  await tabs(page).getByRole('tab', { name: 'Order & parties', exact: true }).click()
  await expect(editor.locator('[name="title"]')).toHaveValue('Updated synthetic engineering scope')
  await save(page).click()
  await expect.poll(() => state.acceptedWrites.length).toBe(1)
  expect(state.acceptedWrites[0]).toMatchObject({ method: 'PATCH', path: `/api/v1/procurement/orders/${orderFormId}/`, body: {
    title: 'Updated synthetic engineering scope', description: 'Retained narrative after moving between sections',
    company_agreement_no: 'SYNTHETIC-AGREEMENT-EDITED', company_fax: '+97120000000', final_approver_notes: 'Retained draft approval note',
  } })
  expect(state.acceptedWrites[0].body).not.toHaveProperty('approval_log')
  expect(state.record.total_amount).toBe('1050.00')
  await expect(editor.getByRole('heading', { name: 'Edit purchase order', exact: true })).toBeVisible()
  await page.screenshot({ path: `${artifactDirectory}/draft-edit-desktop-1780.png` })
  clean(state)
})

for (const mismatch of [false, true]) {
  test(`saved reference context shows ${mismatch ? 'signature review' : 'final pending approval'} and safe rich scope accurately`, async ({ page }) => {
    const state = await open(page, { prepare: fixture => {
      fixture.record.approval_log = [
        { level: 1, stage: 'Technical review', status: 'approved', user_name: 'Earlier technical reviewer' },
        { level: 5, stage: 'Final sign-off', status: 'pending', user_name: 'Pending final approver' },
      ]
      fixture.record.signature_review_required = mismatch
      fixture.record.scope_of_services = '<p>Reviewed <strong>engineering</strong> scope.</p><script>window.referenceScopeExecuted = true</script>'
      fixture.record.items = [{ item: 'Legacy synthetic service', quantity: 2, unit_price: 500 }]
    } })
    await expect(workspace(page).getByRole('textbox', { name: 'Approval Stage', exact: true })).toHaveValue('Final sign-off')
    await expect(workspace(page).getByRole('textbox', { name: 'Approver', exact: true })).toHaveValue('Pending final approver')
    await expect(workspace(page).getByRole('textbox', { name: 'Approved By', exact: true })).toHaveValue(mismatch ? 'Review required' : 'pending')
    await tabs(page).getByRole('tab', { name: 'Scope & pricing', exact: true }).click()
    await expect(workspace(page).getByRole('textbox', { name: 'Scope of services', exact: true })).toHaveValue('Reviewed engineering scope.')
    await expect(workspace(page).getByRole('cell', { name: 'Legacy synthetic service', exact: true })).toBeVisible()
    expect(await page.evaluate(() => window.referenceScopeExecuted)).toBeUndefined()
    expect(state.acceptedWrites).toEqual([])
    clean(state)
  })
}

test('saved document refreshes after correction while original uploaded bytes remain available', async ({ page }) => {
  const state = await open(page)
  const preview = workspace(page).locator('.pop-preview')
  await expect(preview.getByRole('link', { name: 'Download uploaded PO', exact: true })).toBeVisible()
  await preview.getByRole('tab', { name: 'Document', exact: true }).click()
  await expect(preview.getByRole('button', { name: 'Download PDF', exact: true })).toBeEnabled({ timeout: 30000 })
  const exportCount = () => state.requests.filter(request => request.path.endsWith('/export-pdf/')).length
  const before = exportCount()
  await number(page).fill(correctedNumber)
  await save(page).click()
  await expect.poll(() => state.acceptedWrites.length).toBe(1)
  await expect.poll(exportCount).toBeGreaterThan(before)
  await expect(preview.getByRole('button', { name: 'Download PDF', exact: true })).toBeEnabled({ timeout: 30000 })
  expect(state.requests.filter(request => request.path.endsWith('/preview-document/'))).toEqual([])
  await source(page).click()
  const downloadEvent = page.waitForEvent('download')
  await preview.getByRole('link', { name: 'Download uploaded PO', exact: true }).click()
  expect(await readFile(await (await downloadEvent).path())).toEqual(state.generatedPdf)
  clean(state)
})
