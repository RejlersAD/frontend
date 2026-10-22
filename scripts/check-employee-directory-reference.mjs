import assert from 'node:assert/strict'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { build } from 'esbuild'
import { launchBrowser } from './ui-check-support.mjs'
const root = process.cwd()
const artifacts = path.resolve(root, '../artifacts/employees-reference')
await mkdir(artifacts, { recursive: true })
const names = ['Aamir Shaikh Shaikh', 'Aarekh Mehrotra', 'Abdul Aziz', 'Abdul Rahman Alyhyai', 'Abdul Kadir Kadri', 'Abdullah Hasan Omar Al Menhali', 'Abeer Alkhalifi', 'Mohammed Al Suwaidi', 'Zara Test']
const employees = names.map((name, index) => ({ id: index + 1, user: { id: index + 100, first_name: name.split(' ')[0], last_name: name.split(' ').slice(1).join(' '), email: `${name.split(' ')[0].toLowerCase()}@example.test` }, employee_id: 22451 + index, job_title: ['Lead Civil & Structural Engineer', 'Senior Project Engineer', 'Procurement Engineer', 'Trainee Procurement Engineer'][index % 4], status: 'active', department: index % 2 ? 'Engineering' : 'Delivery – ADNOC Distr.', location: 'Abu Dhabi', phone: '+971 50 834 5341', organization_name: 'Default Organization', join_date: '2024-07-01', is_mfa_enabled: false }))
const entry = `import React,{useState}from'react';import{createRoot}from'react-dom/client';import Workspace from './src/pages/HR/EmployeeDirectoryWorkspace';import{HR_KPIS,HR_FILTERS,fullName}from './src/config/hrEmployees.config';const rows=${JSON.stringify(employees)};function Harness(){const[q,Q]=useState('');const[f,F]=useState({});const[k,K]=useState(null);const[p,P]=useState(0);const[s,S]=useState(8);const[v,V]=useState('table');const filtered=rows.filter(e=>(!k||HR_KPIS.find(a=>a.id===k).match(e))&&HR_FILTERS.every(a=>a.match(e,f[a.id]||'all'))&&fullName(e).toLowerCase().includes(q.toLowerCase()));return <div className="employee-directory-reference"><Workspace employees={rows} filteredEmployees={filtered} paginated={filtered.slice(p*s,(p+1)*s)} loading={false} query={q} onQuery={value=>{Q(value);P(0)}} onSubmitSearch={term=>window.searched=term} filters={f} onFilter={(id,value)=>{F(prev=>({...prev,[id]:value}));P(0)}} onReset={()=>{Q('');F({});K(null);P(0)}} selectedKpi={k} onKpi={value=>{K(value);P(0)}} pageIndex={p} onPage={P} pageSize={s} onPageSize={value=>{S(value);P(0)}} totalPages={Math.max(1,Math.ceil(filtered.length/s))} viewMode={v} onViewMode={V} onOpenProfile={(employee,tab)=>window.profile={id:employee.id,tab}} onAction={(employee,action)=>window.action={id:employee.id,action}} onNavigate={url=>window.destination=url} canEdit={true} organizationContent={<div>Organization view retained</div>} timesheetContent={<div>Timesheets view retained</div>} probationSummary={()=>({label:'Probation completed'})}/></div>}createRoot(document.getElementById('root')).render(<Harness/>);`
const bundle = await build({ stdin: { contents: entry, loader: 'jsx', resolveDir: root }, bundle: true, write: false, jsx: 'automatic', format: 'iife', loader: { '.css': 'empty' }, plugins: [{ name: 'api', setup(builder) { builder.onLoad({ filter: /services[\\/]rbac.service.js$/ }, () => ({ contents: `export default{getUserById:async id=>{const response=await fetch('/api/employees/'+id);if(!response.ok)throw Error('Unavailable');return await response.json()}}`, loader: 'js' })) } }] })
const css = await readFile(path.join(root, 'src/pages/HR/EmployeeDirectoryWorkspace.css'), 'utf8')
const browser = await launchBrowser()
const page = await browser.newPage({ acceptDownloads: true })
const errors = []
page.on('pageerror', error => errors.push(error.message))
let failDetails = false
await page.route('http://employees.test/**', route => {
  if (route.request().url().includes('/api/')) { const id = Number(route.request().url().split('/').at(-1)); return route.fulfill(failDetails ? { status: 503, json: {} } : { json: employees.find(employee => employee.id === id) }) }
  return route.fulfill({ contentType: 'text/html', body: `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0}*{box-sizing:border-box}button{font:inherit}a{color:inherit}${css}</style></head><body><div id="root"></div><script>${bundle.outputFiles[0].text}</script></body></html>` })
})
try {
  await page.setViewportSize({ width: 1530, height: 830 })
  await page.goto('http://employees.test/')
  await page.getByRole('heading', { name: 'Contact information', exact: true }).waitFor()
  await page.getByText('Loading full details…').waitFor({ state: 'hidden' })
  assert.equal(await page.locator('tbody tr').count(), 8)
  await page.screenshot({ path: path.join(artifacts, 'desktop.png'), fullPage: true })
  await page.getByRole('button', { name: 'Next page', exact: true }).click()
  assert.equal(await page.locator('tbody tr').count(), 1)
  await page.getByRole('button', { name: 'Previous page', exact: true }).click()
  await page.getByLabel('Search employees', { exact: true }).fill('Aarekh')
  assert.equal(await page.locator('tbody tr').count(), 1)
  assert.match(await page.locator('.ed-details').innerText(), /Aarekh Mehrotra/)
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  assert.deepEqual(await page.evaluate(() => window.action), { id: 2, action: 'edit' })
  await page.getByRole('button', { name: 'Open full profile', exact: true }).click()
  assert.equal(await page.evaluate(() => window.profile.id), 2)
  const downloadEvent = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export', exact: true }).click()
  const download = await downloadEvent
  const csv = await readFile(await download.path(), 'utf8')
  assert.match(csv, /Aarekh/); assert.ok(!csv.includes('Aamir'))
  await page.getByLabel('Search employees', { exact: true }).fill('')
  await page.locator('.ed-filter-menu>summary').click()
  await page.getByLabel('Department', { exact: true }).selectOption('Engineering')
  assert.equal(await page.locator('tbody tr').count(), 4)
  await page.getByRole('button', { name: 'Reset all filters', exact: true }).click()
  await page.locator('.ed-filter-menu>summary').click()
  await page.locator('.ed-directory-controls>details').last().locator('summary').click()
  await page.getByLabel('Employee ID', { exact: true }).uncheck()
  assert.equal(await page.getByRole('columnheader', { name: 'Employee ID', exact: true }).count(), 0)
  await page.getByLabel('Employee ID', { exact: true }).check()
  await page.locator('.ed-directory-controls>details').last().locator('summary').click()
  await page.getByRole('button', { name: 'Close employee details' }).click()
  assert.equal(await page.getByRole('complementary', { name: 'Employee details' }).count(), 0)
  await page.locator('.ed-person').first().click()
  await page.getByRole('complementary', { name: 'Employee details' }).waitFor()
  await page.getByRole('button', { name: 'Organization', exact: true }).click()
  await page.getByText('Organization view retained').waitFor()
  await page.getByRole('button', { name: 'Timesheets', exact: true }).click()
  await page.getByText('Timesheets view retained').waitFor()
  await page.getByRole('button', { name: 'Directory', exact: true }).click()
  await page.getByRole('button', { name: 'Add employee', exact: true }).click()
  assert.equal(await page.evaluate(() => window.destination), '/admin/users?action=create')
  for (const width of [1024, 390]) {
    await page.setViewportSize({ width, height: 900 })
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `No overflow at ${width}`)
    await page.screenshot({ path: path.join(artifacts, `viewport-${width}.png`), fullPage: true })
  }
  failDetails = true
  await page.locator('.ed-person').nth(1).click()
  await page.getByRole('alert').waitFor()
  failDetails = false
  await page.getByRole('button', { name: 'Retry details', exact: true }).click()
  await page.getByRole('alert').waitFor({ state: 'hidden' })
  await page.getByLabel('Search employees', { exact: true }).fill('No such employee')
  await page.getByText('No employees match your search or filters.').waitFor()
  assert.deepEqual(errors, [])
  await writeFile(path.join(artifacts, 'checks.json'), JSON.stringify({ passed: true, checks: ['eight-row directory', 'pagination', 'search', 'selected employee details', 'existing edit/full-profile actions', 'filtered CSV export', 'department filtering', 'column controls', 'close/reopen details', 'organization/timesheet views', 'existing create destination', 'desktop/tablet/mobile geometry', 'detail failure/retry', 'empty state', 'no browser errors'] }, null, 2))
  console.log('Employee directory reference checks passed')
} finally { await browser.close() }
