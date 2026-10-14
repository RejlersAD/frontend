import { build } from 'esbuild'
import { chromium } from 'playwright-core'
import assert from 'node:assert/strict'
import postcss from 'postcss'
import tailwind from 'tailwindcss'
import { mkdir } from 'node:fs/promises'
const output = '../artifacts/leave-review'
await mkdir(output, { recursive: true })
const css = await postcss([tailwind({ content: ['./src/components/approvals/LeaveApprovalReview.jsx', './src/pages/HR/LeaveRequestReviewPage.jsx'] })]).process('@tailwind base; @tailwind components; @tailwind utilities;', { from: undefined })
const bundle = await build({ stdin: { contents: `import React from 'react'; import { createRoot } from 'react-dom/client'; import { MemoryRouter, Routes, Route } from 'react-router-dom'; import Page from './src/pages/HR/LeaveRequestReviewPage.jsx'; createRoot(document.getElementById('root')).render(<MemoryRouter initialEntries={['/hr/leave-requests']}><Routes><Route path="/hr/leave-requests/:requestId?" element={<Page />} /></Routes></MemoryRouter>);`, loader: 'jsx', resolveDir: process.cwd() }, bundle: true, write: false, format: 'iife', jsx: 'automatic', define: { 'import.meta.env': '{}' }, logLevel: 'silent' })
const browser = await chromium.launch({ channel: 'chrome', headless: true })
try {
 const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
 let item = { employee_photo_url: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect width="48" height="48" fill="indigo"/></svg>'), id: 'request-1', employee_name: 'Ahmed Ali', days_requested: '5', status: 'PENDING', status_display: 'Awaiting manager', start_date: '2026-10-05', end_date: '2026-10-09', created_at: '2026-09-10T09:00:00Z', leave_type_detail: { name: 'Annual leave' }, reason: 'Family holiday', can_review: true }
 let action = null
 await page.route('**/*', route => {
   const url = route.request().url()
   if (url.includes('/payroll/leave-requests/')) {
     if (route.request().method() === 'POST') { action = url; item = { ...item, status: 'RM_APPROVED', status_display: 'Awaiting HR', can_review: false } }
     if (!url.includes('request-1')) assert.ok(!url.includes('status__in'), 'Table must include all statuses')
     if (url.includes('request-1') || url.includes('/older-')) return route.fulfill({ json: item })
     if (new URL(url).searchParams.get('search') === 'nobody') return route.fulfill({ json: { results: [], count: 0, next: null, previous: null } })
     const secondPage = new URL(url).searchParams.get('page') === '2'
     assert.equal(new URL(url).searchParams.get('page_size'), '10')
     const firstRows = [item, ...Array.from({ length: 9 }, (_, index) => ({ ...item, id: `older-${index}`, employee_name: `Employee ${index}`, created_at: '2026-09-01T09:00:00Z' }))]
     return route.fulfill({ json: { results: secondPage ? [{ ...item, id: 'last', employee_name: 'Last Employee' }] : firstRows, count: 11, next: secondPage ? null : '/payroll/leave-requests/?page=2&page_size=10&ordering=-created_at', previous: secondPage ? '/payroll/leave-requests/?page_size=10&ordering=-created_at' : null } })
   }
   return route.fulfill({ contentType: 'text/html', body: '<html><body><div id="root"></div></body></html>' })
 })
 await page.goto('http://localhost:5187/')
 await page.addStyleTag({ content: css.css + 'body {font-family:Segoe UI,sans-serif;background:#f8fafc}' })
 await page.addScriptTag({ content: bundle.outputFiles[0].text })
 assert.equal(await page.getByRole('button', { name: 'Previous', exact: true }).isDisabled(), true)
 await page.getByRole('link', { name: /Ahmed Ali/ }).waitFor()
 assert.equal(await page.locator('tbody tr').count(), 10)
 await page.getByRole('button', { name: 'Next', exact: true }).click()
 await page.getByRole('link', { name: 'Last Employee', exact: true }).waitFor()
 assert.equal(await page.locator('tbody tr').count(), 1)
 assert.equal(await page.getByRole('button', { name: 'Next', exact: true }).isDisabled(), true)
 await page.getByRole('button', { name: 'Previous', exact: true }).click()
 await page.getByRole('searchbox').fill('nobody')
 await page.getByText('No leave requests found.', { exact: true }).waitFor()
 await page.getByRole('searchbox').fill('')
 await page.getByRole('link', { name: /Ahmed Ali/ }).click()
 await page.getByRole('heading', { name: /Ahmed Ali/ }).waitFor()
 await page.getByRole('img', { name: 'Ahmed Ali profile' }).waitFor()
 assert.ok(await page.getByRole('img', { name: 'Ahmed Ali profile' }).evaluate(image => image.complete && image.naturalWidth > 0))
 assert.equal(await page.getByRole('table').count(), 1)
 assert.ok(await page.getByRole('table').evaluate(table => table.parentElement.scrollWidth <= table.parentElement.clientWidth), 'All columns fit without horizontal scrolling')
 assert.equal(await page.getByRole('columnheader').count(), 7)
 assert.equal(await page.getByRole('columnheader').first().getAttribute('aria-sort'), 'descending')
 await page.getByRole('cell', { name: 'Oct 12, 2026', exact: true }).first().waitFor()
 await page.getByText('Family holiday', { exact: true }).waitFor()
 assert.equal(await page.getByRole('dialog').count(), 0)
 await page.screenshot({ path: `${output}/desktop.png`, fullPage: true })
 await page.setViewportSize({ width: 390, height: 844 })
 assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'Mobile content should not overflow')
 await page.screenshot({ path: `${output}/mobile.png`, fullPage: true })
 await page.setViewportSize({ width: 1440, height: 1000 })
 await page.getByRole('button', { name: 'Reject', exact: true }).click()
 await page.getByRole('alert').filter({ hasText: 'rejection reason' }).waitFor()
 assert.equal(action, null)
 await page.getByRole('button', { name: 'Approve and send to HR' }).click()
 await page.locator('[aria-label="Selected leave request"]').getByText('Awaiting HR', { exact: true }).waitFor()
 assert.ok(action.endsWith('/request-1/rm-approve/'))
 assert.equal(await page.getByRole('button', { name: 'Approve and send to HR' }).count(), 0)
 assert.equal(await page.getByRole('button', { name: 'Print', exact: true }).isDisabled(), true)
 await page.getByRole('link', { name: 'Employee 0', exact: true }).click()
 await page.getByRole('heading', { name: 'All leave requests' }).waitFor()
 item = { ...item, status: 'PENDING', review_stage: 'hr_review', status_display: 'Pending', can_review: true }
 await page.getByRole('link', { name: /Ahmed Ali/ }).click()
 await page.getByRole('button', { name: 'Approve leave', exact: true }).waitFor()
 await page.getByText('No manager assigned', { exact: true }).first().waitFor()
 await page.getByRole('button', { name: 'Approve leave', exact: true }).click()
 await page.waitForFunction(() => ![...document.querySelectorAll('button')].some(button => button.textContent === 'Approve leave'))
 assert.ok(action.endsWith('/request-1/approve/'))
 await page.getByRole('link', { name: 'Employee 0', exact: true }).click()
 item = { ...item, status: 'APPROVED', workflow_status: 'approved', can_review: false, reviewed_by_name: 'HR Reviewer', reviewed_at: '2026-09-10T10:00:00Z' }
 await page.getByRole('link', { name: /Ahmed Ali/ }).click()
 await page.getByRole('button', { name: 'Print', exact: true }).waitFor()
 assert.equal(await page.getByRole('button', { name: 'Print', exact: true }).isEnabled(), true)
 await page.getByRole('button', { name: 'Print', exact: true }).click()
 const printFrame = page.frameLocator('iframe[title="Selected leave request print document"]')
 await printFrame.getByRole('heading', { name: 'Ahmed Ali', exact: true }).waitFor()
 assert.equal(await printFrame.getByRole('table').count(), 0)
 assert.equal(await printFrame.getByRole('button').count(), 0)
 await printFrame.getByText('Family holiday', { exact: true }).waitFor()
 console.log('Passed: employee selection, exact request page, rejection validation, manager approval endpoint, post-action rights, return to list.')
} finally { await browser.close() }
