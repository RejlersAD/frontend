import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test.setTimeout(60000)

const scope = { id: 'scope-1', source: 'source-1', relative_path: '5900738 Project', project: 17, project_code: '5900738', project_name: 'Pilot project', access_enabled: true }
const entry = { id: 'file-1', source: 'source-1', scope: 'scope-1', relative_path: '5900738 Project/Report.txt', parent_path: '5900738 Project', name: 'Report.txt', is_directory: false, status: 'available', size_bytes: 120, content_type: 'text/plain', current_version: 'version-2', version_number: 2, modified_at: '2026-09-15T06:00:00Z' }
const extraction = { id: 'extract-1', entry: 'file-1', version: 'version-2', version_number: 2, status: 'pending_review', sections: [{ location: 'Line 1', text: 'Progress: 25%' }], suggestions: [{ label: 'Progress', value: '25%', location: 'Line 1', evidence: 'Progress: 25%' }], warnings: [], created_at: '2026-09-15T06:10:00Z', stale: false }
const source = { id: 'source-1', name: 'Pilot server', root_path: '\\\\server\\share\\Projects', included_paths: ['5900738 Project'], excluded_paths: [], mode: 'mirror', enabled: true, max_file_size_mb: 100, interval_seconds: 300, status: 'healthy' }
// Synthetic API records exercise supported mapping states; none are seeded into RADAI.
const adminScopes = [
  { ...scope, relative_path: '5900738 EPCM-Grid Power Integration Project' },
  { ...scope, id: 'scope-2', relative_path: '5900828 Migration of AVEVA Models to SmartPlant', project: null, project_code: '', project_name: '', access_enabled: false },
  { ...scope, id: 'scope-3', relative_path: '5900885 Habshan & Bab Telecom System Upgrade', project: 18, project_code: '5900885', project_name: 'Second project', access_enabled: false },
  { ...scope, id: 'scope-4', relative_path: '5900913 Residue Yield Improvement Project', project: 19, project_code: '5900913', project_name: 'Residue Yield Improvement', access_enabled: true },
  { ...scope, id: 'scope-5', relative_path: '5900927 New Sewage Treatment Plant', project: null, project_code: '', project_name: '', access_enabled: false },
  { ...scope, id: 'scope-6', relative_path: '5900942 Upgradation works at Al Ain MP Depot', project: 20, project_code: '5900942', project_name: 'Al Ain MP Depot', access_enabled: false },
  { ...scope, id: 'scope-7', relative_path: '5900978 Train 3 Decongestion Modifications', project: 21, project_code: '5900978', project_name: 'Train 3 Decongestion', access_enabled: true },
  { ...scope, id: 'scope-8', relative_path: 'Project archives', project: null, project_code: '', project_name: '', access_enabled: false },
]
const projects = [
  { id: 17, name: 'Pilot project', code: '5900738' }, { id: 18, name: 'Second project', code: '5900885' },
  { id: 19, name: 'Residue Yield Improvement', code: '5900913' }, { id: 20, name: 'Al Ain MP Depot', code: '5900942' },
  { id: 21, name: 'Train 3 Decongestion', code: '5900978' },
]
const pageOf = results => ({ count: results.length, next: null, previous: null, results })
const fulfil = (route, data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) })

function nestedRecords(folder, catalogue = false) {
  const definitions = [
    ['Reports', true], ['Reports/2026', true], ['Reports/2026/September', true],
    ['Reports/2026/September/Progress.PDF', false, 'application/pdf'],
    ['Reports/2026/September/Progress.xlsx', false, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    ['Reports/2026/September/Model.dwg', false, 'application/octet-stream'],
    ['Reports/2026/September/Archive.zip', false, 'application/zip'],
    ['Reports/2026/September/Site.JPG', false, 'image/jpeg'],
    ['Reports/2026/September/README', false, 'application/octet-stream'],
    ['Reports/2026/September/Vendor.xyz', false, 'application/octet-stream'],
    ['Reports/2026/August', true], ['Reports/2026/August/Progress.txt', false, 'text/plain'],
    ['Drawings', true], ['Drawings/Progress-layout.dwg', false, 'application/octet-stream'],
  ]
  return definitions.map(([path, isDirectory, contentType = ''], index) => ({
    ...entry, id: `${folder.id}-entry-${index}`, source: folder.source, scope: folder.id,
    relative_path: `${folder.relative_path}/${path}`, parent_path: `${folder.relative_path}/${path}`.split('/').slice(0, -1).join('/'),
    name: path.split('/').at(-1), is_directory: isDirectory, content_type: contentType,
    file_extension: isDirectory || !path.split('/').at(-1).includes('.') ? '' : path.split('.').at(-1).toLowerCase(),
    type_label: isDirectory ? 'Folder' : path.split('/').at(-1).includes('.') ? `${path.split('.').at(-1).toUpperCase()} file` : 'File (no extension)',
    status: isDirectory || catalogue ? 'indexed' : 'available', current_version: isDirectory || catalogue ? null : `version-${index}`,
    version_number: isDirectory || catalogue ? null : 1, size_bytes: isDirectory ? 0 : 2048 + index * 100,
  }))
}

async function harness(page, query = '') {
  const adminView = new URLSearchParams(query).get('view') === 'admin'
  const state = {
    source: adminView ? { ...source, name: 'RAD File Server — Projects', status: 'connected', root_path: '\\\\uaeser2\\RAD_FILE_SERVER\\Projects', included_paths: adminScopes.map(item => item.relative_path), excluded_paths: ['Project archives'], last_heartbeat: '2026-09-15T06:20:00Z', last_success_at: '2026-09-15T06:18:00Z' } : { ...source },
    scopes: structuredClone(adminView ? adminScopes : [scope]),
    requests: [], writes: [],
  }
  if (new URLSearchParams(query).get('catalogue') === 'true') state.source.mode = 'catalogue'
  if (new URLSearchParams(query).get('offline') === 'true') Object.assign(state.source, { status: 'offline', last_heartbeat: '2026-09-13T06:20:00Z', last_success_at: '2026-09-13T06:18:00Z' })
  Object.assign(state.source, { active_run: null, scan_state: 'ready', latest_scan: { id: 'scan-1', status: 'completed', started_at: state.source.last_success_at || '2026-09-15T06:18:00Z', updated_at: state.source.last_success_at || '2026-09-15T06:18:00Z', completed_at: state.source.last_success_at || '2026-09-15T06:18:00Z', entry_count: 8 } })
  const scopeMetadata = folder => ({ ...folder, source_mode: state.source.mode, source_status: state.source.status, source_last_heartbeat: state.source.last_heartbeat, source_last_success_at: state.source.last_success_at, source_scan_state: state.source.scan_state, in_inventory_scope: !state.source.excluded_paths.includes(folder.relative_path) })
  const nested = new URLSearchParams(query).get('nested') === 'true'
  await page.route(url => url.pathname === '/replica-test', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="en"><head><title>File replica interaction test</title><script type="module">import RefreshRuntime from "/@react-refresh"; RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => (type) => type; window.__vite_plugin_react_preamble_installed__ = true;</script></head><body><div id="replica-test"></div><script type="module" src="/tests/fixtures/file-replica-harness.jsx"></script></body></html>' }))
  await page.route('**/api/v1/**', route => {
    const path = new URL(route.request().url()).pathname
    state.requests.push({ path, method: route.request().method(), query: Object.fromEntries(new URL(route.request().url()).searchParams) })
    if (route.request().method() !== 'GET') state.writes.push({ path, method: route.request().method(), body: route.request().postDataJSON() })
    if (path.includes('/project-control/documents/')) return fulfil(route, pageOf([]))
    if (path.endsWith('/projects/')) return fulfil(route, pageOf(projects))
    if (path.endsWith('/file-replica/scopes/')) return fulfil(route, pageOf(state.scopes.map(scopeMetadata)))
    if (path.endsWith('/file-replica/sources/')) return fulfil(route, pageOf([state.source]))
    if (path.endsWith('/file-replica/sources/source-1/')) {
      if (route.request().method() === 'PATCH') state.source = { ...state.source, ...route.request().postDataJSON() }
      return fulfil(route, state.source)
    }
    if (path.endsWith('/file-replica/sources/source-1/scans/')) return fulfil(route, [
      { id: 'scan-1', status: 'completed', started_at: '2026-09-15T06:16:00Z', completed_at: '2026-09-15T06:18:00Z', error: '' },
      { id: 'scan-2', status: 'failed', started_at: '2026-09-15T05:50:00Z', completed_at: '2026-09-15T05:50:12Z', error: 'Server share unavailable during this scan.' },
    ])
    const selectedScope = path.match(/\/file-replica\/scopes\/([^/]+)\/$/)
    if (selectedScope && route.request().method() === 'PATCH') {
      const index = state.scopes.findIndex(item => item.id === selectedScope[1])
      const payload = route.request().postDataJSON()
      const project = projects.find(item => String(item.id) === String(payload.project ?? state.scopes[index].project))
      state.scopes[index] = { ...state.scopes[index], ...payload, project: payload.project === null ? null : project?.id || null,
        project_code: payload.project === null ? '' : project?.code || '', project_name: payload.project === null ? '' : project?.name || '' }
      return fulfil(route, state.scopes[index])
    }
    if (path.endsWith('/file-replica/entries/')) {
      const params = new URL(route.request().url()).searchParams
      if (adminView && params.get('parent_path') === '' && !params.get('scope')) return fulfil(route, pageOf(state.scopes.map(item => ({
        ...entry, id: 'root-' + item.id, scope: item.id, name: item.relative_path, relative_path: item.relative_path,
        parent_path: '', is_directory: true, status: 'indexed', size_bytes: 0, last_seen_at: '2026-09-15T06:18:00Z',
        current_version: null, version_number: null, content_type: '', checksum: '',
      }))))
      if (nested) {
        const selected = state.scopes.find(item => item.id === params.get('scope')) || state.scopes[0]
        const records = nestedRecords(selected, state.source.mode === 'catalogue')
        const filtered = records.filter(item => params.get('search') ? item.name.toLowerCase().includes(params.get('search').toLowerCase()) : item.parent_path === params.get('parent_path'))
        return fulfil(route, pageOf(filtered))
      }
      return fulfil(route, pageOf([entry]))
    }
    if (path.endsWith('/extractions/')) return fulfil(route, [])
    return fulfil(route, {})
  })
  await page.goto(`/replica-test?${query}`)
  return state
}

test('project documents browse, preview, extract, and review source evidence', async ({ page }) => {
  await harness(page)
  await page.route('**/file-replica/entries/file-1/download/?inline=1', route => route.fulfill({ contentType: 'text/plain', body: 'Progress: 25%' }))
  await page.route('**/file-replica/entries/file-1/extract/', route => fulfil(route, extraction))
  let reviewBody
  await page.route('**/file-replica/extractions/extract-1/review/', route => {
    reviewBody = route.request().postDataJSON()
    return fulfil(route, { ...extraction, status: reviewBody.status, reviewed_at: '2026-09-15T06:15:00Z', review_notes: reviewBody.notes })
  })
  await page.getByRole('button', { name: 'Server files', exact: true }).click()
  await page.getByRole('button', { name: 'Report.txt', exact: true }).click()
  await page.getByRole('button', { name: 'Preview', exact: true }).click()
  await expect(page.locator('pre')).toHaveText('Progress: 25%')
  await page.getByRole('button', { name: 'Extract information', exact: true }).click()
  await expect(page.getByText('Source: Line 1')).toBeVisible()
  await page.getByLabel('Review notes').fill('Checked against the current report.')
  await page.getByRole('button', { name: 'Accept evidence' }).click()
  await expect(page.getByText('accepted', { exact: true })).toBeVisible()
  expect(reviewBody).toEqual({ status: 'accepted', notes: 'Checked against the current report.' })
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
  expect(results.violations.filter(item => ['critical', 'serious'].includes(item.impact))).toEqual([])
})

test('catalogue files cannot download and stale evidence cannot be accepted', async ({ page }) => {
  await harness(page)
  await page.route('**/file-replica/entries/?*', route => fulfil(route, pageOf([{ ...entry, status: 'indexed', current_version: null }])))
  await page.route('**/file-replica/entries/file-1/extractions/', route => fulfil(route, [{ ...extraction, stale: true }]))
  await page.getByRole('button', { name: 'Server files', exact: true }).click()
  await page.getByRole('button', { name: 'Report.txt', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Download', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Extract information', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Accept evidence' })).toBeDisabled()
})

test('folder browsing and paginated search send the selected project scope', async ({ page }) => {
  await harness(page)
  const requests = []
  await page.route('**/file-replica/entries/?*', route => {
    const params = Object.fromEntries(new URL(route.request().url()).searchParams)
    requests.push(params)
    if (params.search) return fulfil(route, params.page === '2'
      ? pageOf([{ ...entry, id: 'file-2', name: 'Report 2.txt' }])
      : { ...pageOf([entry]), count: 2, next: '?page=2' })
    return fulfil(route, pageOf(params.parent_path.endsWith('/Reports') ? [entry] : [{ ...entry, id: 'folder-1', name: 'Reports', is_directory: true, relative_path: '5900738 Project/Reports' }]))
  })
  await page.getByRole('button', { name: 'Server files', exact: true }).click()
  await page.getByRole('button', { name: 'Reports', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Report.txt', exact: true })).toBeVisible()
  expect(requests.at(-1)).toMatchObject({ project: '17', scope: 'scope-1', parent_path: '5900738 Project/Reports' })
  await page.getByLabel('Search this connected folder').fill('Report')
  await page.getByRole('button', { name: 'Search server files' }).click()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Report 2.txt', exact: true })).toBeVisible()
  expect(requests.at(-1)).toMatchObject({ project: '17', scope: 'scope-1', search: 'Report', page: '2' })
  expect(requests.at(-1)).not.toHaveProperty('parent_path')
})

test('nested folders and breadcrumbs navigate three levels and preserve the selected scope', async ({ page }) => {
  const state = await harness(page, 'nested=true')
  await page.getByRole('button', { name: 'Server files', exact: true }).click()
  const browser = page.getByRole('region', { name: 'Server files', exact: true })
  for (const folder of ['Reports', '2026', 'September']) await browser.getByRole('button', { name: folder, exact: true }).click()
  await expect(browser.getByRole('button', { name: 'Progress.PDF', exact: true })).toBeVisible()
  const breadcrumb = browser.getByRole('navigation', { name: 'Server folder breadcrumb', exact: true })
  for (const folder of [scope.relative_path, 'Reports', '2026', 'September']) await expect(breadcrumb.getByRole('button', { name: folder, exact: true })).toBeVisible()
  expect(state.requests.filter(item => item.path.endsWith('/entries/')).at(-1).query).toMatchObject({ project: '17', scope: 'scope-1', parent_path: scope.relative_path + '/Reports/2026/September' })
  await browser.getByRole('button', { name: 'Refresh', exact: true }).click()
  await expect(browser.getByRole('button', { name: 'Progress.PDF', exact: true })).toBeVisible()
  await expect(breadcrumb.getByRole('button', { name: 'September', exact: true })).toHaveAttribute('aria-current', 'location')
  await browser.getByRole('button', { name: 'Up one folder', exact: true }).click()
  await expect(browser.getByRole('button', { name: 'August', exact: true })).toBeVisible()
  await breadcrumb.getByRole('button', { name: 'Reports', exact: true }).click()
  await expect(browser.getByRole('button', { name: '2026', exact: true })).toBeVisible()
  await breadcrumb.getByRole('button', { name: scope.relative_path, exact: true }).click()
  await expect(browser.getByRole('button', { name: 'Drawings', exact: true })).toBeVisible()
  await expect(browser.getByRole('button', { name: 'Up one folder', exact: true })).toBeDisabled()
  expect(state.writes).toEqual([])
})

test('recursive search finds files across sibling subtrees and Clear search restores the current folder', async ({ page }) => {
  const state = await harness(page, 'nested=true')
  await page.getByRole('button', { name: 'Server files', exact: true }).click()
  const browser = page.getByRole('region', { name: 'Server files', exact: true })
  for (const folder of ['Reports', '2026', 'September']) await browser.getByRole('button', { name: folder, exact: true }).click()
  await browser.getByLabel('Search this connected folder').fill('Progress')
  await browser.getByRole('button', { name: 'Search server files', exact: true }).click()
  for (const file of ['Progress.PDF', 'Progress.xlsx', 'Progress.txt', 'Progress-layout.dwg']) await expect(browser.getByRole('button', { name: file, exact: true })).toBeVisible()
  const request = state.requests.filter(item => item.path.endsWith('/entries/')).at(-1)
  expect(request.query).toMatchObject({ project: '17', scope: 'scope-1', search: 'Progress', page: '1' })
  expect(request.query).not.toHaveProperty('parent_path')
  await browser.getByRole('button', { name: 'Clear search', exact: true }).click()
  await expect(browser.getByLabel('Search this connected folder')).toHaveValue('')
  await expect(browser.getByRole('button', { name: 'Model.dwg', exact: true })).toBeVisible()
  await expect(browser.getByRole('button', { name: 'Progress-layout.dwg', exact: true })).toHaveCount(0)
})

test('catalogue lists every file type and keeps metadata separate from downloadable content', async ({ page }) => {
  const state = await harness(page, 'nested=true&catalogue=true')
  await page.getByRole('button', { name: 'Server files', exact: true }).click()
  const browser = page.getByRole('region', { name: 'Server files', exact: true })
  for (const folder of ['Reports', '2026', 'September']) await browser.getByRole('button', { name: folder, exact: true }).click()
  await expect(browser.getByRole('columnheader', { name: 'Type', exact: true })).toBeVisible()
  for (const file of ['Progress.PDF', 'Progress.xlsx', 'Model.dwg', 'Archive.zip', 'Site.JPG', 'README', 'Vendor.xyz']) await expect(browser.getByRole('button', { name: file, exact: true })).toBeVisible()
  for (const [file, type] of [['Progress.PDF', /PDF/i], ['Progress.xlsx', /Excel|XLSX|spreadsheet/i], ['Model.dwg', /DWG|drawing/i], ['Archive.zip', /ZIP|archive/i], ['README', /File|unknown|other/i]]) {
    const row = browser.getByRole('row').filter({ has: page.getByRole('button', { name: file, exact: true }) })
    await expect(row.getByRole('cell').nth(1)).toContainText(type)
    await expect(row).toContainText('Metadata only')
  }
  await browser.getByRole('button', { name: 'Progress.PDF', exact: true }).click()
  const detail = browser.getByRole('region', { name: 'File details: Progress.PDF', exact: true })
  await expect(detail.getByRole('button', { name: 'Preview', exact: true })).toBeDisabled()
  await expect(detail.getByRole('button', { name: 'Download', exact: true })).toBeDisabled()
  await expect(detail.getByRole('button', { name: 'Extract information', exact: true })).toBeDisabled()
  await expect(detail).toContainText(/metadata|catalogue/i)
  expect(state.requests.some(item => /\/(download|extract)\/$/.test(item.path))).toBe(false)
  expect(state.writes).toEqual([])
})

test('an unmapped folder opens directly through Browse while Map remains a separate project action', async ({ page }) => {
  const state = await harness(page, 'view=admin&admin=true&nested=true&catalogue=true')
  const folder = adminScopes[1].relative_path
  const row = page.getByRole('row').filter({ has: page.getByRole('button', { name: folder, exact: true }) })
  await row.getByRole('button', { name: `Browse ${folder}`, exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Server files', exact: true })
  await expect(dialog.getByRole('combobox', { name: 'Connected folder' })).toHaveValue('scope-2')
  await dialog.getByRole('button', { name: 'Reports', exact: true }).click()
  await expect(dialog.getByRole('button', { name: '2026', exact: true })).toBeVisible()
  await dialog.getByRole('button', { name: 'Close dialog', exact: true }).click()
  expect(state.scopes[1].project).toBeNull()
  expect(state.writes).toEqual([])
  await row.getByRole('button', { name: 'Map', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Server files', exact: true })).toHaveCount(0)
  const review = page.getByRole('region', { name: 'Review mapping', exact: true })
  await expect(review.getByRole('heading', { level: 3 })).toHaveText(folder)
  await expect(review.getByRole('combobox', { name: /RADAI project/ })).toBeFocused()
})

test('empty listings distinguish unscanned running incomplete and recorded inventory states', async ({ page }) => {
  const state = await harness(page, 'nested=true&catalogue=true')
  await page.route('**/file-replica/entries/?*', route => fulfil(route, pageOf([])))
  state.source.scan_state = 'unscanned'
  await page.getByRole('button', { name: 'Server files', exact: true }).click()
  const browser = page.getByRole('region', { name: 'Server files', exact: true })
  await expect(browser).toContainText('has not been scanned with the current connection settings')
  for (const [status, text] of [['syncing', 'The connector is still scanning'], ['incomplete', 'The latest scan is incomplete'], ['ready', 'this does not confirm that the server folder is empty']]) {
    state.source.scan_state = status
    await browser.getByRole('button', { name: 'Refresh', exact: true }).click()
    await expect(browser).toContainText(text)
  }
  expect(state.writes).toEqual([])
})

test('offline source explains connector heartbeat and keeps cached nested folders browsable', async ({ page }) => {
  await page.setViewportSize({ width: 1672, height: 941 })
  await page.clock.setFixedTime(new Date('2026-09-15T06:22:00Z'))
  const state = await harness(page, 'view=admin&admin=true&nested=true&catalogue=true&offline=true&shell=true')
  await expect(page.getByText(/Offline means RADAI has not received a recent connector heartbeat/)).toBeVisible()
  await expect(page.getByText(/Cached folders remain browsable/)).toBeVisible()
  await page.screenshot({ path: '../artifacts/file-replica-offline-desktop.png', animations: 'disabled' })
  await page.getByRole('button', { name: adminScopes[1].relative_path, exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Server files', exact: true })
  for (const folder of ['Reports', '2026', 'September']) await dialog.getByRole('button', { name: folder, exact: true }).click()
  await expect(dialog.getByRole('button', { name: 'Vendor.xyz', exact: true })).toBeVisible()
  await page.screenshot({ path: '../artifacts/file-replica-browser-desktop.png', animations: 'disabled' })
  const scan = await new AxeBuilder({ page }).include('dialog[open]').analyze()
  expect(scan.violations.filter(item => ['critical', 'serious'].includes(item.impact))).toEqual([])
  expect(state.writes).toEqual([])
})

test('mobile nested browser has accessible file tables without page overflow and restores Browse focus', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await harness(page, 'view=admin&admin=true&nested=true&catalogue=true')
  const browse = page.getByRole('button', { name: `Browse ${adminScopes[1].relative_path}`, exact: true })
  await browse.click()
  const dialog = page.getByRole('dialog', { name: 'Server files', exact: true })
  for (const folder of ['Reports', '2026', 'September']) await dialog.getByRole('button', { name: folder, exact: true }).click()
  await expect(dialog.getByRole('button', { name: 'Model.dwg', exact: true })).toBeVisible()
  const bounds = await dialog.boundingBox()
  expect(bounds.x).toBeGreaterThanOrEqual(0)
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(390)
  const widths = await page.evaluate(() => ({ document: document.documentElement.scrollWidth, viewport: innerWidth }))
  expect(widths.document).toBeLessThanOrEqual(widths.viewport)
  const scan = await new AxeBuilder({ page }).include('dialog[open]').analyze()
  expect(scan.violations.filter(item => ['critical', 'serious'].includes(item.impact))).toEqual([])
  await page.screenshot({ path: '../artifacts/file-replica-browser-mobile.png', animations: 'disabled' })
  await dialog.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(browse).toBeFocused()
})

test('manage connection exposes source ID and saves configured folders and copy mode', async ({ page }) => {
  const state = await harness(page, 'view=admin&admin=true')
  await page.getByRole('button', { name: 'Manage connection', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Manage connection', exact: true })
  await expect(dialog.getByRole('textbox', { name: /Source ID/ })).toHaveValue('source-1')
  const excludedPath = adminScopes[0].relative_path + '/Restricted'
  await dialog.getByLabel('Excluded folders').fill('Project archives\n' + excludedPath)
  await dialog.getByLabel('Synchronization mode').selectOption('catalogue')
  await dialog.getByRole('button', { name: 'Save connection', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  await expect(page.getByText('Connection saved.', { exact: false })).toBeVisible()
  expect(state.source.excluded_paths).toEqual(['Project archives', excludedPath])
  expect(state.source.mode).toBe('catalogue')
  expect(state.source.included_paths).toEqual(adminScopes.map(item => item.relative_path))
})

test('changing project resets audience and requires a fresh access acknowledgement', async ({ page }) => {
  const state = await harness(page, 'view=admin&admin=true')
  const row = page.getByRole('row').filter({ has: page.getByRole('button', { name: adminScopes[0].relative_path, exact: true }) })
  await row.getByRole('button', { name: 'Review', exact: true }).click()
  const review = page.getByRole('region', { name: 'Review mapping', exact: true })
  const confirmation = review.getByRole('checkbox', { name: /I reviewed restricted folders/ })
  const enable = review.getByRole('button', { name: 'Save & enable access', exact: true })
  await expect(enable).toBeDisabled()
  const plainSave = page.waitForRequest(request => request.method() === 'PATCH' && request.url().includes('/file-replica/scopes/scope-1/'))
  await review.getByRole('button', { name: 'Save mapping', exact: true }).click()
  expect((await plainSave).postDataJSON()).not.toHaveProperty('access_enabled')
  await expect(review.getByRole('button', { name: 'Save mapping', exact: true })).toBeEnabled()
  await confirmation.check()
  await expect(enable).toBeEnabled()
  await review.getByRole('combobox', { name: /RADAI project/ }).selectOption('18')
  await expect(confirmation).not.toBeChecked()
  await expect(review.getByRole('radio', { name: /Administrators only/ })).toBeChecked()
  await expect(enable).toBeDisabled()
  await review.getByRole('button', { name: 'Save mapping', exact: true }).click()
  await expect(page.getByText('Mapping saved.', { exact: false })).toBeVisible()
  expect(state.scopes[0]).toMatchObject({ project: 18, access_enabled: false })
  await review.getByRole('radio', { name: /Project owner and active members/ }).check()
  await expect(enable).toBeDisabled()
  await confirmation.check()
  await enable.click()
  await expect(review.getByRole('checkbox', { name: /I reviewed restricted folders/ })).not.toBeChecked()
  expect(state.scopes[0]).toMatchObject({ project: 18, access_enabled: true })
  await expect(review.getByRole('radio', { name: /Custom roles/ })).toBeDisabled()
})

test('Map reveals and focuses the mobile project selector on repeated clicks, then saves an admin-only link', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const state = await harness(page, 'view=admin&admin=true')
  const review = page.getByRole('region', { name: 'Review mapping', exact: true })
  const projectSelector = review.getByRole('combobox', { name: /RADAI project/ })
  await expect(review.getByRole('heading', { level: 3 })).toHaveText(adminScopes[2].relative_path)
  await expect(projectSelector).not.toBeFocused()
  const row = page.getByRole('row').filter({ has: page.getByRole('button', { name: adminScopes[1].relative_path, exact: true }) })
  const map = row.getByRole('button', { name: 'Map', exact: true })
  await map.click()
  await expect(review.getByRole('heading', { level: 3 })).toHaveText(adminScopes[1].relative_path)
  await expect(projectSelector).toBeFocused()
  await expect(projectSelector).toBeInViewport({ ratio: 1 })
  await map.click()
  await expect(projectSelector).toBeFocused()
  await expect(projectSelector).toBeInViewport({ ratio: 1 })
  await projectSelector.selectOption('18')
  const saveRequest = page.waitForRequest(request => request.method() === 'PATCH' && request.url().includes('/file-replica/scopes/scope-2/'))
  await review.getByRole('button', { name: 'Save mapping', exact: true }).click()
  expect((await saveRequest).postDataJSON()).toEqual({ project: '18', access_enabled: false })
  await expect(row).toContainText('Second project')
  await expect(row).toContainText('Admin only')
  expect(state.scopes[1]).toMatchObject({ project: 18, access_enabled: false, project_name: 'Second project' })
  await row.getByRole('button', { name: 'Review', exact: true }).click()
  await expect(projectSelector).toBeFocused()
  await expect(projectSelector).toBeInViewport({ ratio: 1 })
})

test('pending token rotation prevents saving or closing the connection dialog', async ({ page }) => {
  await harness(page, 'view=admin&admin=true')
  let releaseToken
  await page.route('**/file-replica/sources/source-1/rotate-token/', route => new Promise(resolve => {
    releaseToken = async () => { await fulfil(route, { token: 'synthetic-connector-token' }); resolve() }
  }))
  await page.getByRole('button', { name: 'Manage connection', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Manage connection', exact: true })
  await dialog.getByRole('button', { name: 'Create / replace connector token', exact: true }).click()
  await expect.poll(() => typeof releaseToken).toBe('function')
  await expect(dialog.getByRole('button', { name: 'Save connection', exact: true })).toBeDisabled()
  await expect(dialog.getByRole('button', { name: 'Close dialog' })).toBeDisabled()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeVisible()
  await releaseToken()
  await expect(dialog.getByRole('textbox', { name: /Connector token/ })).toHaveValue('synthetic-connector-token')
  await expect(dialog.getByRole('button', { name: 'Save connection', exact: true })).toBeEnabled()
  await dialog.getByRole('button', { name: 'Hide token', exact: true }).click()
  await expect(dialog.getByRole('textbox', { name: /Connector token/ })).toHaveCount(0)
})

test('mapping filters constrain selection and bulk exclusion preserves existing exclusions', async ({ page }) => {
  const state = await harness(page, 'view=admin&admin=true')
  const mappings = page.getByRole('region', { name: 'Folder mappings', exact: true })
  await mappings.getByRole('combobox', { name: 'Mapping status' }).selectOption('unmapped')
  await expect(mappings.getByRole('button', { name: adminScopes[1].relative_path, exact: true })).toBeVisible()
  await expect(mappings.getByRole('button', { name: adminScopes[4].relative_path, exact: true })).toBeVisible()
  await expect(mappings.getByRole('button', { name: adminScopes[0].relative_path, exact: true })).toHaveCount(0)
  await mappings.getByRole('combobox', { name: 'Access status' }).selectOption('enabled')
  await expect(mappings.getByText('No folders match these filters.')).toBeVisible()
  await mappings.getByRole('combobox', { name: 'Access status' }).selectOption('all')
  await mappings.getByRole('textbox', { name: 'Search folders' }).fill('5900828')
  await expect(mappings.getByRole('button', { name: adminScopes[4].relative_path, exact: true })).toHaveCount(0)
  await mappings.getByRole('textbox', { name: 'Search folders' }).clear()
  await expect(mappings.getByRole('button', { name: 'Exclude', exact: true })).toBeDisabled()
  await mappings.getByRole('checkbox', { name: 'Select all visible folders' }).check()
  await expect(mappings.getByText('2 selected', { exact: true })).toBeVisible()
  await mappings.getByRole('button', { name: 'Exclude', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Exclude folders', exact: true })
  await expect(dialog.getByText(adminScopes[1].relative_path, { exact: true })).toBeVisible()
  await expect(dialog.getByText(adminScopes[4].relative_path, { exact: true })).toBeVisible()
  await dialog.getByRole('button', { name: 'Exclude folders', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  expect(state.source.excluded_paths).toEqual(['Project archives', adminScopes[1].relative_path, adminScopes[4].relative_path])
  await expect(mappings.getByText('0 selected', { exact: true })).toBeVisible()
  await mappings.getByRole('combobox', { name: 'Mapping status' }).selectOption('excluded')
  await expect(mappings.getByRole('button', { name: 'Project archives', exact: true })).toBeVisible()
})

test('synchronization history displays recorded failures and handles request failure', async ({ page }) => {
  await harness(page, 'view=admin&admin=true')
  await page.getByRole('button', { name: 'View audit log', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Synchronization history', exact: true })
  await expect(dialog.getByText('Server share unavailable during this scan.')).toBeVisible()
  await expect(dialog.getByText('completed', { exact: true })).toBeVisible()
  await dialog.getByRole('button', { name: 'Close dialog' }).click()
  await page.route('**/file-replica/sources/source-1/scans/', route => fulfil(route, { detail: 'Synchronization history is temporarily unavailable.' }, 503))
  await page.getByRole('button', { name: 'View audit log', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText('Synchronization history is temporarily unavailable.')
  await expect(dialog.getByText('No synchronization runs recorded.')).toHaveCount(0)
})

test('Browse launches the file browser at the selected mapped folder', async ({ page }) => {
  await harness(page, 'view=admin&admin=true')
  const row = page.getByRole('row').filter({ has: page.getByRole('button', { name: adminScopes[3].relative_path, exact: true }) })
  await row.getByRole('button', { name: `Browse ${adminScopes[3].relative_path}`, exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Server files', exact: true })
  await expect(dialog.getByRole('combobox', { name: 'Connected folder' })).toHaveValue('scope-4')
  await expect(dialog.getByRole('button', { name: 'Report.txt', exact: true })).toBeVisible()
})

test('desktop workspace has accessible controls and a review screenshot', async ({ page }) => {
  await page.setViewportSize({ width: 1672, height: 941 })
  await page.clock.setFixedTime(new Date('2026-09-15T06:22:00Z'))
  await harness(page, 'view=admin&admin=true&catalogue=true&shell=true')
  await expect(page.getByRole('button', { name: /Discovered folders 8/ })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Review mapping' }).getByRole('heading', { level: 3 })).toHaveText(adminScopes[2].relative_path)
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: '../artifacts/file-replica-desktop.png', animations: 'disabled' })
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
  expect(results.violations.filter(item => ['critical', 'serious'].includes(item.impact))).toEqual([])
})

test('mobile workspace and connection dialog remain within the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.clock.setFixedTime(new Date('2026-09-15T06:22:00Z'))
  await harness(page, 'view=admin&admin=true&catalogue=true&shell=true')
  await expect(page.getByRole('button', { name: /Discovered folders 8/ })).toBeVisible()
  const dimensions = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }))
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.width)
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: '../artifacts/file-replica-mobile.png', animations: 'disabled' })
  await page.screenshot({ path: '../artifacts/file-replica-mobile-full.png', fullPage: true, animations: 'disabled' })
  await page.getByRole('button', { name: 'Manage connection', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Manage connection', exact: true })
  await expect(dialog.getByRole('textbox', { name: /Source ID/ })).toHaveValue('source-1')
  const bounds = await dialog.boundingBox()
  expect(bounds.x).toBeGreaterThanOrEqual(0)
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(390)
  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible()
})

for (const query of ['view=admin&admin=false', 'view=admin&inactive_admin=true']) {
test(`unauthorized account cannot render connector settings or request credentials (${query})`, async ({ page }) => {
  const requests = []
  page.on('request', request => { if (request.url().includes('/file-replica/')) requests.push(request.url()) })
  await harness(page, query)
  await expect(page.getByRole('heading', { name: 'Administrator access required' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add connection' })).toHaveCount(0)
  expect(requests).toEqual([])
})
}
