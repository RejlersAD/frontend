import { test, expect } from '@playwright/test'
import { writeFile } from 'node:fs/promises'
import { orderFormHarness, orderFormId, orderFormNumber } from '../fixtures/purchase-order-form.fixture'

test.setTimeout(90000)
const html = `<h3>Commercial conditions</h3><p id="format-target">Current narrative text</p>
<p>Supplier:&nbsp;&nbsp;&nbsp;&nbsp;Example Engineering LLC</p>
<p><a href="mailto:supplier@example.test">supplier@example.test</a></p>
<table style="width:80%;border-collapse:collapse"><tbody><tr style="height:48pt">
<th style="width:30%">Discipline</th><td style="padding:3pt 9pt 6pt 2pt;vertical-align:middle"><span style="font-family:'Times New Roman';font-size:14pt;font-weight:700;color:#c00000;text-decoration:underline">Authored amount</span></td>
</tr></tbody></table>`

async function openEditor(page) {
  const state = await orderFormHarness(page, { path: '/procurement/orders', prepare(fixture) {
    fixture.record = { id: orderFormId, po_number: orderFormNumber, status: 'draft',
      vendor: fixture.vendors[0].id, vendor_name: fixture.vendors[0].name,
      pr_reference: fixture.recommendation.id, pr_number: fixture.recommendation.pr_number,
      title: 'Narrative formatting', description: html, total_amount: '100.00',
      currency: 'USD', items: [], attachments: [], contact_persons: {} }
    fixture.orders = [fixture.record]
  } })
  await page.getByRole('button', { name: `Actions for ${orderFormNumber}`, exact: true }).click()
  await page.getByRole('menuitem', { name: 'Edit order', exact: true }).click()
  await page.getByRole('tab', { name: 'PO Description & Scope', exact: true }).click()
  return state
}

async function selectText(editor, selector) {
  await editor.locator(selector).evaluate(element => {
    const range = document.createRange()
    range.selectNodeContents(element)
    const selection = window.getSelection()
    selection.removeAllRanges()
    selection.addRange(range)
    element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
  })
}

test('authored narrative typography and table metrics are independent of application table styles', async ({ page }) => {
  const state = await openEditor(page)
  const editor = page.getByRole('textbox', { name: 'PO Narrative', exact: true })
  await page.setViewportSize({ width: 1920, height: 1080 })
  await expect(editor).toHaveCSS('font-size', '14px')
  await expect(editor).toHaveCSS('color', 'rgb(0, 0, 0)')
  await expect(editor).toHaveCSS('line-height', '18.2px')
  await expect(editor.locator('h3')).toHaveCSS('font-size', '21.3333px')
  await expect(editor.locator('h3')).toHaveCSS('font-weight', '700')
  await expect(editor.locator('a')).toHaveCSS('color', 'rgb(29, 78, 216)')
  await expect(editor.locator('a')).toHaveCSS('text-decoration-line', 'underline')
  const amount = editor.locator('td span')
  await expect(amount).toHaveCSS('font-size', '18.6667px')
  await expect(amount).toHaveCSS('font-weight', '700')
  await expect(amount).toHaveCSS('color', 'rgb(192, 0, 0)')
  await expect(amount).toHaveCSS('text-decoration-line', 'underline')
  await expect(editor.locator('td')).toHaveCSS('padding-top', '4px')
  await expect(editor.locator('td')).toHaveCSS('padding-right', '12px')
  await expect(editor.locator('td')).toHaveCSS('vertical-align', 'middle')
  await expect(editor.locator('tr')).toHaveCSS('height', '64px')
  const widths = await editor.evaluate(element => ({
    table: element.querySelector('table').getBoundingClientRect().width,
    content: element.clientWidth - parseFloat(getComputedStyle(element).paddingLeft) - parseFloat(getComputedStyle(element).paddingRight),
  }))
  expect(widths.table / widths.content).toBeCloseTo(.8, 1)
  expect(widths.content).toBeCloseTo((210 - 32) * 96 / 25.4 - 16, 0)
  expect(state.acceptedWrites).toEqual([])
  expect(state.unknown).toEqual([])
  expect(state.pageErrors).toEqual([])
})

test('real bold underline colour and font-size commands retain their formatting in the current export snapshot', async ({ page }) => {
  const state = await openEditor(page)
  const editor = page.getByRole('textbox', { name: 'PO Narrative', exact: true })
  await selectText(editor, '#format-target')
  await expect(page.getByRole('combobox', { name: 'Font size', exact: true })).toHaveValue('current')
  await page.getByTitle('B', { exact: true }).click()
  await page.getByTitle('U', { exact: true }).click()
  await page.getByLabel('Font colour', { exact: true }).fill('#c00000')
  await page.getByRole('combobox', { name: 'Font size', exact: true }).selectOption('4')
  const computed = await editor.locator('#format-target').evaluate(element => {
    const leaf = [...element.querySelectorAll('*')].at(-1) || element
    const style = getComputedStyle(leaf)
    return { color: style.color, weight: style.fontWeight, size: style.fontSize,
      underlined: [element, ...element.querySelectorAll('*')].some(node => getComputedStyle(node).textDecorationLine.includes('underline')) }
  })
  expect(computed).toEqual({ color: 'rgb(192, 0, 0)', weight: '700', size: '18px', underlined: true })
  const currentHtml = await editor.innerHTML()
  await expect.poll(() => state.requests.filter(row => row.path.endsWith('/preview-document/') && row.body?.format === 'pdf').at(-1)?.body.snapshot.description).toBe(currentHtml)
  await writeFile('../artifacts/po-browser-formatted-narrative.html', currentHtml)
  expect(state.acceptedWrites).toEqual([])
  expect(state.unknown).toEqual([])
  expect(state.pageErrors).toEqual([])
})
