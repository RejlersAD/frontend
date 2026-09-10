import { build } from 'esbuild'
import { chromium } from 'playwright-core'
import postcss from 'postcss'
import tailwind from 'tailwindcss'
import { mkdir, writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
const output = '../artifacts/profile-leave'
await mkdir(output, { recursive: true })
const fixture = {
  leaveRecord: { leave_balance: 3.7, total_earned: 3.7, total_encashed: 0, annual_entitlement: 22 },
  requests: [
    { id: '1', status: 'RM_REJECTED', leave_type: 1, leave_type_detail: { name: 'Annual leave', category: 'annual' }, start_date: '2026-08-21', end_date: '2026-08-22', days_requested: 1, reason: 'Relaxation', rm_note: 'Please arrange cover.', created_at: '2026-08-20T10:00:00Z' },
    { id: '2', status: 'RM_APPROVED', leave_type_detail: { name: 'Annual leave', category: 'annual' }, start_date: '2026-10-05', end_date: '2026-10-06', days_requested: 2, created_at: '2026-09-10T10:00:00Z', rm_reviewed_by_name: 'Line Manager' },
  ],
  typeConfig: { annual: { label: 'Annual Leave', entitlement: 22 }, sick: { label: 'Sick Leave', entitlement: 15 } },
}
const bundle = await build({ stdin: { contents: `import React from 'react'; import { createRoot } from 'react-dom/client'; import { ProfileLeaveSummary, ProfileLeaveRequests } from './src/components/HR/ProfileLeaveWorkspace.jsx'; const fixture = ${JSON.stringify(fixture)}; createRoot(document.getElementById('root')).render(<main className="space-y-4 p-6"><ProfileLeaveSummary {...fixture} /><ProfileLeaveRequests requests={fixture.requests} /></main>);`, resolveDir: process.cwd(), loader: 'jsx' }, bundle: true, write: false, format: 'iife', jsx: 'automatic' })
const css = await postcss([tailwind({ content: ['./src/components/HR/ProfileLeaveWorkspace.jsx'], corePlugins: { preflight: true }, theme: { extend: {} } })]).process('@tailwind base; @tailwind components; @tailwind utilities;', { from: undefined })
const browser = await chromium.launch({ channel: 'chrome', headless: true })
try {
 const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
 await page.setContent('<html lang="en"><head><title>Profile leave</title></head><body style="font-family:Segoe UI;background:#f8fafc"><div id="root"></div></body></html>')
 await page.addStyleTag({ content: css.css })
 await page.addScriptTag({ content: bundle.outputFiles[0].text })
 await page.getByText('Available annual leave', { exact: true }).waitFor()
 assert.equal(await page.getByText('Awaiting HR', { exact: true }).count(), 1)
 await page.getByRole('button', { name: 'Awaiting approval', exact: true }).click()
 assert.equal(await page.getByText('Declined by manager', { exact: true }).count(), 0)
 await page.getByRole('button', { name: 'Closed', exact: true }).click()
 await page.locator('summary').filter({ hasText: 'Annual leave' }).click()
 await page.getByText('Please arrange cover.').waitFor({ state: 'visible' })
 await page.getByRole('button', { name: 'Approved', exact: true }).click()
 await page.getByText('No requests match this filter').waitFor()
 await page.getByRole('button', { name: 'All requests', exact: true }).click()
 await page.screenshot({ path: `${output}/desktop.png`, fullPage: true })
 await page.setViewportSize({ width: 390, height: 844 })
 assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
 await page.screenshot({ path: `${output}/mobile.png`, fullPage: true })
 await writeFile(`${output}/checks.txt`, 'Passed: manager/HR status display, status filters, rejection detail expansion, empty state, mobile width.\n')
 console.log('Profile leave UI checks passed; desktop and mobile screenshots saved.')
} finally { await browser.close() }
