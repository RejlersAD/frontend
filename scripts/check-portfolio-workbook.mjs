import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import postcss from 'postcss';
import tailwind from 'tailwindcss';
import tailwindConfig from '../tailwind.config.js';
import AxeBuilder from '@axe-core/playwright';
import { checkArtifacts, inlineLocalCssImports, launchBrowser } from './ui-check-support.mjs';

// Portable component/integration check. Every upload response is synthetic; no API is called.
const frontend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const artifacts = checkArtifacts(frontend, 'portfolio-workbook');
const amount = value => ({ value, status: value === null ? 'unavailable' : 'available', missing_count: 0 });
const fixture = {
  status: 'available', source: { kind: 'sharepoint', sync_enabled: true, file_name: 'Synthetic portfolio.xlsx', reporting_date: '2026-09-18', imported_at: '2026-09-23T08:00:00Z', last_success_at: '2026-09-23T09:00:00Z', sync_status: 'current', is_stale: false },
  scope: { label: 'Authorized workbook projects' }, project_count: 12, row_count: 12, returned_rows: 12, truncated: false,
  totals: { contract_value_aed: amount('9999999999999999.99'), recognized_revenue_aed: amount('0.00'), period_revenue_aed: amount(null), backlog_without_pt_aed: amount('12500.50'), backlog_with_pt_aed: amount('15000.00'), overclaim_aed: amount('-120.00') },
  rows: Array.from({ length: 12 }, (_, i) => ({ project_code: `TEST-${i + 1}`, subproject_code: `SUB-${i + 1}`, title: `Synthetic project ${i + 1}`, pm: `Manager ${i + 1}`, business_unit: i === 0 ? 'Unit needle' : 'Delivery', client: `Client ${i + 1}`, currency: i % 2 ? 'USD' : 'AED', contract_value_aed: i ? '100.00' : '0.00', recognized_revenue_aed: null, period_revenue_aed: '0.00', backlog_without_pt_aed: '100.00', backlog_with_pt_aed: null, poc_pct: '0.00', eddr_pct: i ? null : '25.00', forecast_margin_pct: null, forecast_finish: null, include_without_pt: i !== 0, include_with_pt: true })),
  forecast: [{ period: '2026-10-01', revenue_aed: '0.00', status: 'available', missing_count: 0 }, { period: '2026-11-01', revenue_aed: null, status: 'incomplete', missing_count: 2 }],
};
const entry = `
import React from 'react';import {createRoot} from 'react-dom/client';import {MemoryRouter} from 'react-router-dom';
import ProjectPortfolio from './src/pages/Executive/ProjectPortfolio.jsx';
import {portfolioFixture} from './scripts/check-portfolio-fixtures.mjs';
const root=createRoot(document.getElementById('root'));window.fixture=${JSON.stringify(fixture)};let generation=0;
window.workbookCalls=[];window.workbookRefreshes=0;
window.renderWorkbook=({workbook=window.fixture,currency='AED',printing=false}={})=>{window.renderGeneration=++generation;root.render(<MemoryRouter key={generation}><main data-fixture-generation={generation} className='cc-command-center cc-radai-page cc-portfolio-page'><h1>Project portfolio check</h1><ProjectPortfolio report={{generated_at:'2026-09-23T10:00:00Z'}} portfolio={{...portfolioFixture(),workbook}} currency={currency} printing={printing} onExplain={()=>{}} onNavigate={()=>{}} /></main></MemoryRouter>)};
window.renderWorkbook();`;
const reconciliationEntry = `
import React from 'react';import {createRoot} from 'react-dom/client';import {MemoryRouter,Route,Routes,useLocation} from 'react-router-dom';
import ProjectLinks from './src/pages/Procurement/ProjectLinks.jsx';
const root=createRoot(document.getElementById('root'));let generation=0;
window.workbookCalls=[];window.workbookGets=[];window.workbookRefreshes=0;
window.currentWorkbook={...${JSON.stringify(fixture)},can_upload:true};
function RouteMarker(){const location=useLocation();window.reconciliationRoute=location.pathname;return null;}
window.renderReconciliation=({canUpload=true,sourceMode=''}={})=>{
 window.currentWorkbook={...window.currentWorkbook,can_upload:canUpload};window.sourceMode=sourceMode;
 window.renderGeneration=++generation;
 root.render(<MemoryRouter key={generation} initialEntries={['/procurement/projects/reconciliation']}><RouteMarker/><main data-fixture-generation={generation}><Routes><Route path='/procurement/projects/reconciliation' element={<ProjectLinks/>}/><Route path='*' element={<p>Unexpected reconciliation route</p>}/></Routes></main></MemoryRouter>);
};window.renderReconciliation();`;
const apiStub = `export default {get:async(url,config)=>{
 if(url==='/procurement/projects/link-workspace/')return {data:{projects:[{id:'scope-1',scope_id:'scope-1',project_id:'project-1',code:'TEST-1',name:'Synthetic linked project',client_name:'Synthetic client',purchase_order_count:0}],purchase_orders:{results:[],count:0,total_pages:1},permissions:{can_connect:false,can_create_po:false}}};
 if(url!=='/dashboard/executive/portfolio-workbook/')throw new Error('Unexpected fixture GET '+url);
 window.workbookGets.push({url,params:config?.params});
 if(window.pendingWorkbookRefresh){window.workbookRefreshes++;if(window.failRefresh)throw new Error('Synthetic refresh failure');window.pendingWorkbookRefresh=false;}
 if(window.sourceMode){const problem=new Error('Synthetic source failure');problem.response={status:window.sourceMode==='forbidden'?403:500,data:{detail:'Synthetic workbook source failure'}};throw problem;}
 return {data:structuredClone(window.currentWorkbook)};
},post:async(url,form,config)=>{
 if(!(form instanceof FormData))throw new Error('Upload must use FormData');
 const file=form.get('file');const preview=url.endsWith('/preview/');
 window.workbookCalls.push({url,file:file.name,size:file.size,preview_token:form.get('preview_token')});
 if(window.uploadMode===(preview?'deferred-preview':'deferred-import'))await new Promise(resolve=>{window.finishUpload=resolve});
 if(window.uploadMode===(preview?'preview-error':'import-error')){const problem=new Error('Synthetic validation failure');problem.response={status:400,data:{file:preview?'POC sheet is missing.':'Workbook reporting date is older than the active snapshot.'}};throw problem;}
 if(!preview&&window.uploadMode==='token-error'){const problem=new Error('Synthetic token failure');problem.response={status:400,data:{preview_token:'The preview has expired. Preview the workbook again.'}};throw problem;}
 if(!preview){window.pendingWorkbookRefresh=true;window.currentWorkbook={...window.currentWorkbook,source:{...window.currentWorkbook.source,kind:'manual',file_name:file.name,reporting_date:'2026-09-23',last_uploaded_at:'2026-09-23T10:30:00Z'}};}
 return {data:preview?{file_name:file.name,reporting_date:'2026-09-23',row_count:12,preview_token:'token:'+file.name,reconciliation:{project_count:10},warnings:[{sheet:'POC',cell:'A8',field:'poc_pct',code:'formula_cache_missing'}]}:{file_name:file.name,reporting_date:'2026-09-23',row_count:12,created:true,activated:true,snapshot_id:42}};
}};`;
const bundle = await build({ stdin: { contents: entry, loader: 'jsx', resolveDir: frontend }, jsx: 'automatic', bundle: true, write: false, format: 'iife', loader: { '.css': 'empty' }, plugins: [{ name: 'workbook-upload-fixture', setup(builder) { builder.onLoad({ filter: /services[\\/]api\.service\.js$/ }, () => ({ contents: apiStub, loader: 'js' })); } }] });
const css = (await Promise.all(['ExecutiveDashboard.css', 'ProjectPortfolio.css', 'PortfolioKpiGraphic.css', 'PortfolioReferenceCharts.css'].map(file => readFile(path.join(frontend, 'src/pages/Executive', file), 'utf8')))).join('\n');
const reconciliationStyles = new Set();
const reconciliationBundle = await build({ stdin: { contents: reconciliationEntry, loader: 'jsx', resolveDir: frontend }, jsx: 'automatic', bundle: true, write: false, metafile: true, format: 'iife', plugins: [{ name: 'reconciliation-workbook-fixture', setup(builder) {
  builder.onLoad({ filter: /services[\\/]api\.service\.js$/ }, () => ({ contents: apiStub, loader: 'js' }));
  builder.onLoad({ filter: /Procurement[\\/]PurchaseOrderForm\.jsx$/ }, () => ({ contents: 'export default function PurchaseOrderForm(){return null}', loader: 'jsx' }));
  builder.onLoad({ filter: /\.css$/ }, args => { reconciliationStyles.add(args.path); return { contents: '', loader: 'empty' }; });
} }] });
assert.ok([...reconciliationStyles].every(file => !file.replaceAll('\\', '/').includes('/pages/Executive/')), 'Reconciliation does not depend on Executive CSS');
const reconciliationSources = await Promise.all(Object.keys(reconciliationBundle.metafile.inputs).filter(file => file.replaceAll('\\', '/').startsWith('src/') && /\.[jt]sx?$/.test(file)).map(file => readFile(path.join(frontend, file), 'utf8')));
const applicationCss = await postcss([tailwind({ ...tailwindConfig, content: [{ raw: [reconciliationEntry, ...reconciliationSources].join('\n'), extension: 'jsx' }] })]).process(await inlineLocalCssImports(await readFile(path.join(frontend, 'src/index.css'), 'utf8'), path.join(frontend, 'src/index.css'), file => readFile(file, 'utf8')), { from: undefined });
const reconciliationCss = [applicationCss.css, ...await Promise.all([...reconciliationStyles].map(file => readFile(file, 'utf8')))].join('\n');
await mkdir(artifacts, { recursive: true });
const browser = await launchBrowser();
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  let page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => route.abort());
  await page.setContent('<html lang="en"><head><title>Portfolio workbook check</title></head><body><div id="root"></div></body></html>');
  await page.addStyleTag({ content: `*{box-sizing:border-box}body{margin:0}main{padding:16px}${css}\n.cc-command-center{height:auto;overflow:visible}` });
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  await page.evaluate(() => window.renderWorkbook({ workbook: null }));
  await page.waitForFunction(() => document.querySelector('main')?.dataset.fixtureGeneration === String(window.renderGeneration));
  const baselineKpis = await page.getByTestId('portfolio-outcomes').textContent();
  assert.ok(baselineKpis.trim(), 'Executive portfolio KPIs remain visible');
  for (const [status, canUpload, printing] of [['available', false, false], ['available', true, false], ['available', true, true], ['unavailable', true, false]]) {
    await page.evaluate(([value, allowed, print]) => window.renderWorkbook({ workbook: { ...window.fixture, status: value, can_upload: allowed }, printing: print }), [status, canUpload, printing]);
    await page.waitForFunction(() => document.querySelector('main')?.dataset.fixtureGeneration === String(window.renderGeneration));
    assert.equal(await page.getByTestId('portfolio-workbook').count(), 0, 'Executive omits the workbook panel for every upload capability');
    assert.equal(await page.getByTestId('portfolio-workbook-upload').count(), 0, 'Workbook upload belongs on reconciliation');
    assert.equal(await page.getByRole('button', { name: 'Upload Excel workbook' }).count(), 0);
    assert.doesNotMatch(await page.locator('main').innerText(), /Portfolio workbook|Uploaded workbook|Synthetic portfolio\.xlsx/);
    assert.equal(await page.getByTestId('portfolio-outcomes').textContent(), baselineKpis, 'Executive KPIs are unchanged by workbook availability or upload permission');
  }
  assert.equal(await page.evaluate(() => window.workbookCalls.length), 0, 'Executive presentation never calls an upload API');

  // A separate document prevents Executive styles from hiding missing styles
  // in the actual Procurement reconciliation route.
  page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => route.abort());
  await page.setContent('<html lang="en"><head><title>Project Links workbook upload check</title></head><body><div id="root"></div></body></html>');
  await page.addStyleTag({ content: reconciliationCss });
  await page.addScriptTag({ content: reconciliationBundle.outputFiles[0].text });
  const management = page.getByTestId('portfolio-workbook-import');
  const sourceStatus = page.getByTestId('portfolio-workbook-import-source');
  const upload = page.getByTestId('portfolio-workbook-upload');
  await page.getByRole('heading', { name: 'Project Links', exact: true }).waitFor();
  await management.waitFor();
  assert.equal(await page.evaluate(() => window.reconciliationRoute), '/procurement/projects/reconciliation');
  assert.ok(await page.getByRole('button', { name: /TEST-1.*Synthetic linked project/ }).count(), 'The real ProjectLinks page loads alongside workbook management');
  assert.deepEqual(await page.evaluate(() => window.workbookGets.at(-1)), { url: '/dashboard/executive/portfolio-workbook/', params: { limit: 1 } });
  assert.match(await sourceStatus.innerText(), /Synthetic portfolio.xlsx.*18 Sept 2026/s);
  assert.equal(await sourceStatus.getByRole('link', { name: 'Open project portfolio' }).getAttribute('href'), '/executive?tab=portfolio');
  await page.evaluate(() => window.renderReconciliation({ canUpload: false }));
  await management.waitFor({ state: 'detached' });
  assert.equal(await upload.count(), 0, 'Reconciliation hides upload controls without the administrator capability');
  await page.evaluate(() => window.renderReconciliation({ sourceMode: 'forbidden' }));
  await page.getByRole('heading', { name: 'Project Links', exact: true }).waitFor();
  assert.equal(await upload.count(), 0, 'Denied workbook access does not prevent using Project Links');
  await page.evaluate(() => window.renderReconciliation({ sourceMode: 'error' }));
  await page.getByRole('button', { name: 'Retry workbook options' }).waitFor();
  assert.equal(await upload.count(), 0, 'A failed capability lookup cannot grant upload access');
  await page.evaluate(() => { window.sourceMode = ''; });
  await page.getByRole('button', { name: 'Retry workbook options' }).click();
  await upload.waitFor();
  const selectFile = async (name = 'upload.xlsx') => upload.getByLabel('Excel workbook (.xlsx)').setInputFiles({ name, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from('synthetic workbook content') });
  const previewFile = async () => {
    await upload.getByRole('button', { name: 'Preview workbook', exact: true }).click();
    await upload.getByRole('heading', { name: 'Workbook import preview' }).waitFor();
  };
  const closedUploadAccessibility = await new AxeBuilder({ page }).include('[data-testid="portfolio-workbook-upload"]').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  assert.deepEqual(closedUploadAccessibility.violations.map(({ id }) => id), [], 'Closed upload controls are accessible');
  await upload.getByRole('button', { name: 'Upload Excel workbook' }).focus();
  await page.keyboard.press('Enter');
  await upload.getByLabel('Excel workbook (.xlsx)').waitFor();
  assert.ok(await upload.getByLabel('Excel workbook (.xlsx)').evaluate(node => node === document.activeElement), 'Keyboard opening moves focus to file selection');
  assert.equal(await upload.getByRole('button', { name: 'Preview workbook', exact: true }).isDisabled(), true);
  await selectFile('invalid.xls');
  await upload.getByRole('alert').filter({ hasText: '.xlsx format' }).waitFor();
  assert.equal(await page.evaluate(() => window.workbookCalls.length), 0);
  await upload.getByLabel('Excel workbook (.xlsx)').evaluate(node => { const transfer = new DataTransfer(); transfer.items.add(new File([new Uint8Array(25 * 1024 * 1024 + 1)], 'large.xlsx')); node.files = transfer.files; node.dispatchEvent(new Event('change', { bubbles: true })); });
  await upload.getByRole('alert').filter({ hasText: 'up to 25 MB' }).waitFor();
  assert.equal(await page.evaluate(() => window.workbookCalls.length), 0);
  await selectFile();
  await page.evaluate(() => { window.uploadMode = 'preview-error'; });
  await upload.getByRole('button', { name: 'Preview workbook', exact: true }).click();
  await upload.getByRole('alert').filter({ hasText: 'POC sheet is missing.' }).waitFor();
  assert.equal(await upload.getByRole('button', { name: 'Confirm import', exact: true }).count(), 0);
  await page.evaluate(() => { window.uploadMode = 'deferred-preview'; });
  await upload.getByRole('button', { name: 'Preview workbook', exact: true }).click();
  await upload.getByRole('button', { name: 'Reading workbook…' }).waitFor();
  await upload.getByRole('button', { name: 'Cancel upload' }).click();
  await page.evaluate(() => { window.finishUpload(); window.uploadMode = ''; });
  assert.equal(await upload.locator('form').count(), 0, 'Cancelling an in-flight preview closes it');
  await upload.getByRole('button', { name: 'Upload Excel workbook' }).click();
  assert.equal(await upload.getByRole('button', { name: 'Confirm import', exact: true }).count(), 0, 'A late cancelled response cannot restore a preview');
  await selectFile();
  await previewFile();
  assert.match(await upload.innerText(), /23 Sept 2026/);
  await upload.locator('details > summary').focus();
  await page.keyboard.press('Space');
  assert.match(await upload.innerText(), /POC · A8 · poc pct · formula cache missing/);
  await selectFile('changed.xlsx');
  assert.equal(await upload.getByRole('button', { name: 'Confirm import', exact: true }).count(), 0, 'Changing files invalidates the previous preview token');
  await previewFile();
  await page.evaluate(() => { window.uploadMode = 'deferred-import'; });
  await upload.getByRole('button', { name: 'Confirm import', exact: true }).click();
  await upload.getByRole('button', { name: 'Importing workbook…' }).waitFor();
  assert.equal(await upload.getByLabel('Excel workbook (.xlsx)').isDisabled(), true);
  assert.equal(await upload.getByRole('button', { name: 'Cancel upload' }).isDisabled(), true, 'An active commit cannot appear cancelled');
  await page.evaluate(() => { window.finishUpload(); window.uploadMode = ''; });
  await upload.getByRole('status').filter({ hasText: 'changed.xlsx was imported' }).waitFor();
  await sourceStatus.getByText('changed.xlsx', { exact: true }).waitFor();
  assert.match(await sourceStatus.innerText(), /Reporting date: 23 Sept 2026.*Last uploaded/s);
  assert.equal(await page.evaluate(() => window.workbookRefreshes), 1);
  assert.deepEqual(await page.evaluate(() => window.workbookCalls.at(-1)), { url: '/dashboard/executive/portfolio-workbook/import/', file: 'changed.xlsx', size: 26, preview_token: 'token:changed.xlsx' });

  await upload.getByRole('button', { name: 'Upload Excel workbook' }).click();
  const previousSnapshot = await sourceStatus.innerText();
  await selectFile(); await previewFile();
  for (const dark of [false, true]) {
    await page.evaluate(value => document.documentElement.classList.toggle('dark', value), dark);
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 950 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Actual reconciliation page has no overflow at ${width}px`);
      assert.ok(await upload.locator('button,input,summary').evaluateAll(nodes => nodes.every(node => { const rect = node.getBoundingClientRect(); return rect.width === 0 || rect.left >= -1 && rect.right <= innerWidth + 1; })), 'Upload controls are contained, not merely clipped by global overflow rules');
      await management.screenshot({ path: path.join(artifacts, `reconciliation-upload-${dark ? 'dark' : 'light'}-${width}.png`) });
    }
    const result = await new AxeBuilder({ page }).include('[data-testid="portfolio-workbook-import"]').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    assert.deepEqual(result.violations.map(({ id }) => id), [], 'Upload preview accessibility');
  }
  await page.evaluate(() => { window.uploadMode = 'import-error'; });
  await upload.getByRole('button', { name: 'Confirm import', exact: true }).click();
  await upload.getByRole('alert').filter({ hasText: 'older than the active snapshot' }).waitFor();
  assert.equal(await page.evaluate(() => window.workbookRefreshes), 1, 'Failed import does not refresh or publish new data');
  assert.equal(await sourceStatus.innerText(), previousSnapshot, 'The previous workbook status stays visible after import failure');
  assert.equal(await upload.getByRole('button', { name: 'Confirm import', exact: true }).count(), 0, 'Retry requires a fresh preview');
  await page.evaluate(() => { window.uploadMode = 'token-error'; });
  await previewFile();
  await upload.getByRole('button', { name: 'Confirm import', exact: true }).click();
  await upload.getByRole('alert').filter({ hasText: 'preview has expired' }).waitFor();
  assert.equal(await upload.getByRole('button', { name: 'Confirm import', exact: true }).count(), 0, 'An expired token requires a new preview');
  await page.evaluate(() => { window.uploadMode = ''; window.failRefresh = true; });
  await previewFile();
  await upload.getByRole('button', { name: 'Confirm import', exact: true }).click();
  await upload.getByRole('button', { name: 'Retry workbook refresh' }).waitFor();
  assert.equal(await sourceStatus.innerText(), previousSnapshot, 'Refresh failure keeps the displayed source status');
  const callsAfterCommit = await page.evaluate(() => window.workbookCalls.length);
  await page.evaluate(() => { window.failRefresh = false; });
  await upload.getByRole('button', { name: 'Retry workbook refresh' }).click();
  await upload.getByRole('button', { name: 'Retry workbook refresh' }).waitFor({ state: 'detached' });
  await sourceStatus.getByText('upload.xlsx', { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => window.workbookCalls.length), callsAfterCommit, 'Refresh retry never re-imports the workbook');
  assert.equal(await page.evaluate(() => window.workbookRefreshes), 3);
  assert.deepEqual(errors, []);
  console.log('PASS: Executive workbook panel and upload absent, KPIs unchanged; actual Project Links reconciliation upload placement, permissions, validation, preview, token, cancellation, import and status-refresh recovery; independent route styles, mobile/light/dark containment and accessibility.');
} finally {
  await browser.close();
}
