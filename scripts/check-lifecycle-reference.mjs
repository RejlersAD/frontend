import assert from 'node:assert/strict'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { build } from 'esbuild'
import { launchBrowser } from './ui-check-support.mjs'
const root = process.cwd()
const artifacts = path.resolve(root, '../artifacts/onboarding-reference')
await mkdir(artifacts, { recursive: true })
const bundle = await build({ stdin: { contents: `import React from 'react';import{createRoot}from'react-dom/client';import Workspace from './src/pages/HR/LifecycleWorkspace';createRoot(document.getElementById('root')).render(<div className="employee-lifecycle employee-lifecycle-reference"><nav className="lifecycle-breadcrumb">Human Resources　/　Employee Lifecycle</nav><Workspace onOpenOnboarding={r=>window.reviewed=r.id} onOpenOffboarding={r=>window.reviewed=r.id} onOpenRegister={type=>window.register=type} onStart={type=>window.started=type}/></div>);`, loader: 'jsx', resolveDir: root }, bundle: true, write: false, jsx: 'automatic', format: 'iife', loader: { '.css': 'empty' }, plugins: [{ name: 'api', setup(b) { b.onLoad({ filter: /services[\\/]api.service.js$/ }, () => ({ contents: `export default {get:async url=>{const response=await fetch('/api/v1'+url);if(!response.ok)throw Error('failed');return{data:await response.json()}}}`, loader: 'js' })) } }] })
const css = await readFile(path.join(root, 'src/pages/HR/LifecycleWorkspace.css'), 'utf8')
const names = ['Firaol For Trailer', 'Sara Khan', 'Ahmed Ali', 'Priya Nair', 'Daniel Thomas', 'Hana Bekele', 'Lucas Müller', 'Employee Eight']
const rows = names.map((employee_name, index) => ({ id: index + 1, employee_name, position: ['HOD Electrical', 'HR Officer', 'Accountant', 'Project Coordinator'][index % 4], department: index % 2 ? 'HR' : 'Engineering', branch: 'RAD', status: 'documentation', joining_date: `2026-10-${23 + index}`, created_at: '2026-10-01' }))
const tasks = rows.flatMap(row => ['Employee data complete', 'Documents verified', 'IT access', 'Equipment', 'Workplace access', 'Manager welcome'].map((task_name, index) => ({ id: row.id * 10 + index, onboarding_record: row.id, task_name, stage: index === 2 ? 'it_provisioning' : 'pre_hire', completed: index < 2, due_date: '2026-09-17' })))
const browser = await launchBrowser()
const page = await browser.newPage()
const errors = []
page.on('pageerror', error => errors.push(error.message))
let fail = false
await page.route('http://lifecycle.test/**', async route => {
  const url = route.request().url()
  if (url.includes('/api/')) return route.fulfill(fail ? { status: 503, json: {} } : { json: url.includes('/checklist/') ? tasks : url.includes('/onboarding/onboarding/') ? rows : [] })
  return route.fulfill({ contentType: 'text/html', body: `<!doctype html><html><head><meta charset="utf-8"><style>@font-face{font-family:'Lifecycle Roboto';src:url('http://localhost:5173/fonts/roboto/roboto-latin.woff2')}body{margin:0;background:#f3f7fb}button,input,select{font:inherit}button{border:0}button,summary{cursor:pointer}*{box-sizing:border-box}h1,h2,h3,p{margin:0}${css}</style></head><body><div id="root"></div><script>${bundle.outputFiles[0].text}</script></body></html>` })
})
await page.setViewportSize({ width: 1457, height: 890 })
await page.goto('http://lifecycle.test/')
await page.getByRole('heading', { name: 'Employee workflows', exact: true }).waitFor()
assert.equal(await page.locator('.lw-workflow-table tbody tr').count(), 7)
await page.getByRole('button', { name: 'Next page', exact: true }).click()
assert.equal(await page.locator('.lw-workflow-table tbody tr').count(), 1)
await page.getByRole('button', { name: 'Previous page', exact: true }).click()
await page.getByLabel('Search employee', { exact: true }).fill('Sara')
assert.equal(await page.locator('.lw-workflow-table tbody tr').count(), 1)
assert.match(await page.locator('.lw-details').innerText(), /Sara Khan/)
await page.locator('.lw-workflow-table .lw-review').click()
assert.equal(await page.evaluate(() => window.reviewed), 2)
await page.getByRole('button', { name: 'More actions for Sara Khan', exact: true }).click()
assert.equal(await page.evaluate(() => window.register), 'onboarding')
await page.getByLabel('Search employee', { exact: true }).fill('')
await page.locator('.lw-start-menu summary').click()
await page.getByRole('button', { name: 'Start onboarding', exact: true }).click()
assert.equal(await page.evaluate(() => window.started), 'onboarding')
await page.getByRole('button', { name: 'Manage templates', exact: true }).click()
assert.equal(await page.locator('dialog[open]').count(), 1)
await page.getByRole('button', { name: 'Close templates', exact: true }).click()
await page.screenshot({ path: path.join(artifacts, 'desktop.png'), fullPage: true })
await page.getByRole('tab', { name: /Offboarding/ }).click()
assert.match(await page.locator('.lw-workflow-table').innerText(), /No employee workflows/)
await page.getByRole('tab', { name: 'Overview', exact: true }).click()
for (const width of [1024, 390]) {
  await page.setViewportSize({ width, height: 900 })
  const overflow = await page.evaluate(() => [...document.querySelectorAll('body *')].filter(element => element.getBoundingClientRect().right > innerWidth + 1 && !element.closest('.lw-table-scroll')).map(element => ({ tag: element.tagName, class: element.className, right: element.getBoundingClientRect().right })))
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `No page overflow at ${width}: ${JSON.stringify(overflow)}`)
  await page.screenshot({ path: path.join(artifacts, `viewport-${width}.png`), fullPage: true })
}
fail = true
await page.reload()
await page.getByRole('alert').waitFor()
fail = false
await page.getByRole('button', { name: 'Try again' }).click()
await page.getByRole('heading', { name: 'Employee workflows', exact: true }).waitFor()
assert.deepEqual(errors, [])
await browser.close()
await writeFile(path.join(artifacts, 'checks.json'), JSON.stringify({ passed: true, checks: ['pagination', 'search', 'selected checklist', 'review routing', 'start workflow', 'template inspection', 'empty state', 'error retry', 'desktop/tablet/mobile geometry', 'no browser errors'] }, null, 2))
console.log('Lifecycle reference browser checks passed')
