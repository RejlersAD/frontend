import { test, expect } from '@playwright/test'
import { recommendationHarness, recommendationId as id, recommendationNumber as number } from '../fixtures/purchase-recommendations.fixture'
import { mixedSizePdf } from '../fixtures/mixed-size-pdf.fixture'

test.setTimeout(90000)
test.use({ serviceWorkers: 'block' })
const source = '/__supplier-contact-fixture__/original-pr.pdf'
const supplierCard = page => page.getByRole('heading', { name: 'Vendor Details', exact: true }).locator('..')
const value = (page, label) => supplierCard(page).getByText(label, { exact: true }).locator('..').locator('dd')

async function open(page, records) {
  await page.route(`**${source}`, route => route.fulfill({ contentType: 'application/pdf', body: mixedSizePdf(1) }))
  const state = await recommendationHarness(page, { realApp: true, prepare: fixture => {
    records.forEach((record, index) => {
      const patch = { attachments: [{ type: 'signed_purchase_requisition_pdf', filename: 'original-pr.pdf', url: source }], ...record }
      Object.assign(fixture.props.requisitions[index], patch)
      Object.assign(fixture.details[id(201 + index)], patch)
      if (patch.linked_po_id) fixture.approvalRecords[id(201 + index)] = { body: mixedSizePdf(2) }
    })
  } })
  await expect(page.getByRole('heading', { name: 'Purchase Recommendations', exact: true })).toBeVisible()
  return state
}

async function review(page, index = 1) {
  await page.evaluate(recordId => {
    window.history.pushState({}, '', `/procurement/requisitions/${recordId}`)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, id(200 + index))
  await expect(page.getByRole('heading', { name: number(index), level: 1, exact: true })).toBeVisible()
}

function clean(state) {
  expect(state.unknown).toEqual([])
  expect(state.pageErrors).toEqual([])
  expect(state.requests.filter(request => request.path.startsWith('/api/v1/procurement/vendors/') || /^\/api\/v1\/procurement\/orders\/(?:\d+|[a-f0-9-]{36})\/$/.test(request.path))).toEqual([])
  expect(state.requests.filter(request => request.path.startsWith('/api/v1/procurement/') && request.method !== 'GET')).toEqual([])
}

test('PR with no vendor mapping displays effective supplier contact from its explicit linked PO without extra lookups', async ({ page }) => {
  const state = await open(page, [{
    vendor: null, vendor_details: null, selected_vendors: [], vendor_name: '', supplier_name: 'Source supplier spelling', linked_po_id: '101',
    supplier_contact_details: { vendor_id: '21', vendor_name: 'Effective linked supplier LLC', contact_person: 'Saved supplier contact', email: 'supplier-contact@example.test', sources: { contact_person: 'linked_po_vendor', email: 'linked_po_vendor' } },
  }])
  await review(page)
  await expect(value(page, 'Vendor Name')).toHaveText('Effective linked supplier LLC')
  await expect(value(page, 'Contact')).toHaveText('Saved supplier contact')
  await expect(value(page, 'Email')).toHaveText('supplier-contact@example.test')
  clean(state)
})

test('older PR payloads use master details or the actual supplier shortlist entry rather than the first bidder', async ({ page }) => {
  const otherBidder = { vendor_id: '22', vendor_name: 'Unselected bidder', contact_person: 'Wrong bidder contact', email: 'wrong-bidder@example.test' }
  const state = await open(page, [{
    vendor: 21, vendor_name: 'Selected supplier LLC', supplier_name: 'Selected supplier LLC',
    vendor_details: { id: 21, name: 'Selected supplier LLC', contact_person: 'Current master contact', email: '' },
    selected_vendors: [otherBidder, { vendor_id: '21', vendor_name: 'Selected supplier LLC', contact_person: 'Source contact', email: 'selected-supplier@example.test' }],
  }, {
    vendor: null, vendor_details: null, vendor_name: '', supplier_name: 'Legacy supplier LLC',
    selected_vendors: [otherBidder, { name: ' legacy supplier llc ', contact_person: 'Matched legacy contact', email: 'legacy-supplier@example.test' }],
  }, {
    vendor: 21, vendor_details: null, vendor_name: 'Selected supplier LLC', supplier_name: 'Selected supplier LLC',
    selected_vendors: [{ name: 'Selected supplier LLC', contact_person: 'Unverified name-only contact', email: 'unverified@example.test' }],
  }, {
    vendor: null, vendor_details: null, vendor_name: '', supplier_name: 'Ambiguous supplier LLC',
    selected_vendors: [21, 22].map(vendorId => ({ vendor_id: vendorId, name: 'Ambiguous supplier LLC', contact_person: `Ambiguous contact ${vendorId}`, email: `ambiguous-${vendorId}@example.test` })),
  }])
  await review(page)
  await expect(value(page, 'Contact')).toHaveText('Current master contact')
  await expect(value(page, 'Email')).toHaveText('selected-supplier@example.test')
  await expect(supplierCard(page)).not.toContainText('Wrong bidder contact')
  await review(page, 2)
  await expect(value(page, 'Contact')).toHaveText('Matched legacy contact')
  await expect(value(page, 'Email')).toHaveText('legacy-supplier@example.test')
  await expect(supplierCard(page)).not.toContainText('wrong-bidder@example.test')
  for (const index of [3, 4]) {
    await review(page, index)
    await expect(value(page, 'Contact')).toHaveText('—')
    await expect(value(page, 'Email')).toHaveText('—')
  }
  clean(state)
})

test('authoritative empty contact details do not revive stale vendor or other bidder contacts', async ({ page }) => {
  const state = await open(page, [{
    vendor_details: { id: 21, contact_person: 'Stale contact', email: 'stale@example.test' },
    selected_vendors: [{ vendor_id: '22', name: 'Other bidder', contact_person: 'Other contact', email: 'other@example.test' }],
    supplier_contact_details: { vendor_id: null, vendor_name: 'Unverified supplier', contact_person: '', email: '', sources: { contact_person: '', email: '' } },
  }])
  await review(page)
  await expect(value(page, 'Vendor Name')).toHaveText('Unverified supplier')
  await expect(value(page, 'Contact')).toHaveText('—')
  await expect(value(page, 'Email')).toHaveText('—')
  clean(state)
})
