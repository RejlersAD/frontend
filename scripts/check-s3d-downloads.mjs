import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import { readFile, mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import process from 'node:process';
import ExcelJS from 'exceljs';

// Exercise the real menu, HTTP client and Blob handling. Only unrelated child
// workspaces are replaced; all network requests use synthetic responses.
const bundle = await build({
  stdin: { contents: `import React from 'react';import {createRoot} from 'react-dom/client';import Hub from './src/pages/Engineering/Digitization/components/S3DDataExtractionHub';createRoot(document.getElementById('root')).render(<Hub jobId="download-fixture"/>);`, resolveDir: process.cwd(), loader: 'jsx' },
  bundle: true, write: false, format: 'iife', outdir: 'out',
  define: { 'import.meta.env': '{}', 'process.env.NODE_ENV': '"test"' },
  plugins: [{ name: 'child-workspaces', setup(builder) {
    builder.onLoad({ filter: /components[\\/](PaperSpecExtractor|S3DReviewWorkspace|MatchReviewQueue|ControlledReleasePanel|ComponentMatchingWorkbookManager)\.jsx$/ }, () => ({
      contents: `import React from 'react';export default React.forwardRef(function Stub(props,ref){React.useImperativeHandle(ref,()=>({saveChanges:async()=>{}}));return null;});`, loader: 'jsx',
    }));
  } }],
});
const workbook = await readFile('../backend/apps/spec_customization/services/templates/smartplant_spec_template.xlsx');
const out = '../artifacts/s3d-download-browser';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage();
  const errors = [], requests = [];
  let failDownload = false;
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body><div id="root"></div></body></html>' });
    if (url.pathname.includes('/export')) {
      requests.push(url);
      if (failDownload) return route.fulfill({ status: 409, json: { error: 'No component rows are available for a review workbook.' } });
      if (url.searchParams.get('export_format') === 'json') return route.fulfill({ json: { job_id: 'download-fixture', classes: [] } });
      return route.fulfill({ contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', body: workbook });
    }
    return route.fulfill({ json: { id: 'download-fixture', status: 'completed', extraction_completeness: { state: 'partial' }, document_meta: { original_filename: 'source.pdf' } } });
  });
  await page.goto('http://s3d-download.test/');
  for (const output of bundle.outputFiles) {
    if (output.path.endsWith('.js')) await page.addScriptTag({ content: output.text });
    else if (output.path.endsWith('.css')) await page.addStyleTag({ content: output.text });
  }
  for (const [label, suffix] of [['SPEC workbook.xlsx (review)', '_SPEC.xlsx'], ['CAT workbook.xlsx (review)', '_CAT.xlsx'], ['Raw source rows.xlsx', '.xlsx'], ['Source data.json', '.json']]) {
    await page.getByRole('button', { name: 'Export', exact: true }).click();
    const pending = page.waitForEvent('download');
    await page.getByRole('menuitem', { name: new RegExp(label.replaceAll('.', '\\.').replaceAll('(', '\\(').replaceAll(')', '\\)')) }).click();
    const download = await pending;
    assert.ok(download.suggestedFilename().endsWith(suffix));
    const path = `${out}/${download.suggestedFilename()}`;
    await download.saveAs(path);
    if (suffix === '.json') assert.equal(JSON.parse(await readFile(path, 'utf8')).job_id, 'download-fixture');
    else {
      const book = new ExcelJS.Workbook(); await book.xlsx.readFile(path);
      assert.equal(book.worksheets.length, 50);
      assert.equal(book.worksheets[0].name, 'Revision History');
    }
  }
  for (const url of requests.slice(0, 2)) {
    assert.equal(url.searchParams.get('draft'), '1');
    assert.equal(url.searchParams.get('review'), '1');
  }
  assert.equal(requests[2].searchParams.get('export_format'), 'xlsx');
  failDownload = true;
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await page.getByRole('menuitem', { name: /SPEC workbook/ }).click();
  await page.getByRole('dialog').getByText('Export failed: No component rows are available for a review workbook.', { exact: true }).waitFor();
  await page.screenshot({ path: `${out}/server-error.png` });
  assert.deepEqual(errors, []);
  console.log('PASS: four menu downloads, review parameters, 50-sheet XLSX parsing, JSON and readable server errors.');
} finally { await browser.close(); }
