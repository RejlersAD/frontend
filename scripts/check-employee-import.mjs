import assert from 'node:assert/strict'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { build } from 'esbuild'
import { launchBrowser } from './ui-check-support.mjs'
const root = process.cwd(), artifacts = path.resolve(root, '../artifacts/employee-import/browser')
await mkdir(artifacts, { recursive: true })
const api = `async function call(url,body){const response=await fetch('/api/'+url,{method:body?'POST':'GET',body});const data=await response.json();if(!response.ok){const error=Error('failed');error.response={data};throw error}return{data}}export default{getOrganizations:()=>call('organizations'),getRoles:()=>call('roles'),bulkUploadUsers:body=>call('import',body),downloadBulkUploadTemplate:()=>{throw Error('not in fixture')}}`
const bundle = await build({ stdin: { contents: `import React from 'react';import{createRoot}from'react-dom/client';import Import from './src/components/HR/EmployeeRegisterImport';createRoot(document.getElementById('root')).render(<Import onClose={()=>window.closedImport=true} onCompleted={()=>window.completed=true}/>);`, loader: 'jsx', resolveDir: root }, bundle: true, write: false, jsx: 'automatic', loader: { '.css': 'empty' }, plugins: [{ name: 'fixture', setup(builder) { builder.onLoad({ filter: /services[\\/]rbac.service.js$/ }, () => ({ contents: api, loader: 'js' })) } }] })
const css = await readFile(path.join(root, 'src/components/HR/EmployeeRegisterImport.css'), 'utf8')
const browser = await launchBrowser(), page = await browser.newPage()
const errors = [], requests = []
page.on('pageerror', error => errors.push(error.message))
let failPreview = false
await page.route('http://employee-import.test/**', async route => {
  const url = route.request().url()
  if (url.endsWith('/api/organizations')) return route.fulfill({ json: [{ id: 'org', name: 'Rejlers Abu Dhabi' }] })
  if (url.endsWith('/api/roles')) return route.fulfill({ json: [{ id: 'role', name: 'Default', code: 'default' }] })
  if (url.endsWith('/api/import')) {
    const body = route.request().postData(); requests.push(body)
    if (failPreview) return route.fulfill({ status: 400, json: { error: 'Preview temporarily unavailable' } })
    const preview = body.includes('name="preview_only"\r\n\r\ntrue')
    return route.fulfill({ json: preview ? { preview: true, summary: { existing: 1, new: 1, invalid: 1, ignored_blank: 4 }, rows: [{ row: 2, state: 'existing', name: 'Existing Employee', changed_fields: ['department'] }, { row: 3, state: 'new', name: 'New Employee' }, { row: 4, state: 'invalid', name: 'Missing Email', error: 'Email is missing' }] } : { summary: { updated: 1, created: 1, failed: 1, ignored_blank: 4 }, details: { updated: [{ row: 2, state: 'updated', name: 'Existing Employee' }], success: [{ row: 3, state: 'created', name: 'New Employee' }], failed: [{ row: 4, state: 'invalid', error: 'Email is missing' }] } } })
  }
  return route.fulfill({ contentType: 'text/html', body: `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0}button,input,select{font:inherit}${css}</style></head><body><div id="root"></div><script>${bundle.outputFiles[0].text}</script></body></html>` })
})
try {
  await page.setViewportSize({ width: 1200, height: 900 })
  await page.goto('http://employee-import.test/')
  await page.getByRole('dialog').waitFor()
  await page.getByLabel('Employee register file').setInputFiles({ name: 'employees.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from('synthetic fixture') })
  await page.getByRole('button', { name: 'Preview import', exact: true }).click()
  await page.getByText('Select an organization and role for new employees.', { exact: true }).waitFor()
  assert.equal(requests.length, 0)
  await page.getByLabel('Organization for new employees', { exact: true }).selectOption('org')
  await page.getByLabel('Role for new employees', { exact: true }).selectOption('role')
  assert.equal(await page.getByRole('button', { name: 'Import valid rows' }).isEnabled(), false)
  failPreview = true
  await page.getByRole('button', { name: 'Preview import', exact: true }).click()
  await page.getByRole('alert').waitFor()
  failPreview = false
  await page.getByRole('button', { name: 'Preview import', exact: true }).click()
  await page.getByRole('heading', { name: 'Review before import' }).waitFor()
  assert.ok(requests.at(-1).includes('name="import_mode"\r\n\r\nupsert'))
  assert.ok(requests.at(-1).includes('name="role_id"\r\n\r\nrole'))
  await page.getByLabel('Department', { exact: true }).uncheck()
  assert.equal(await page.getByRole('button', { name: 'Import valid rows' }).isEnabled(), false)
  await page.getByLabel('Department', { exact: true }).check()
  await page.getByRole('button', { name: 'Preview import', exact: true }).click()
  await page.getByRole('heading', { name: 'Review before import' }).waitFor()
  await page.screenshot({ path: path.join(artifacts, 'preview-desktop.png'), fullPage: true })
  await page.setViewportSize({ width: 390, height: 900 })
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
  await page.screenshot({ path: path.join(artifacts, 'preview-mobile.png'), fullPage: true })
  await page.getByRole('button', { name: 'Import valid rows', exact: true }).click()
  await page.getByRole('heading', { name: 'Import results', exact: true }).waitFor()
  assert.equal(await page.evaluate(() => window.completed), true)
  assert.ok(requests.at(-1).includes('name="preview_only"\r\n\r\nfalse'))
  assert.equal(await page.getByRole('button', { name: 'Import valid rows' }).count(), 0)
  await page.getByRole('button', { name: 'Done', exact: true }).click()
  assert.equal(await page.evaluate(() => window.closedImport), true)
  assert.deepEqual(errors, [])
  await writeFile(path.join(artifacts, 'checks.json'), JSON.stringify({ passed: true, checks: ['XLSX selection', 'required mappings', 'preview before write', 'preview error retry', 'field-change invalidates preview', 'upsert payload', 'desktop/mobile geometry', 'separate updated/created/failed results', 'refresh callback', 'no duplicate submit after completion', 'no browser errors'] }, null, 2))
  console.log('Employee import browser checks passed')
} finally { await browser.close() }
