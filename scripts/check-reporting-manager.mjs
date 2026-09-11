import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';

const employees = Array.from({ length: 355 }, (_, index) => ({
  id: String(index), name: `Employee ${index}`, email: `person${index}@example.test`,
  employee_id: `EMP${index}`, department: index === 354 ? 'Sales' : 'Finance', job_title: 'Account Executive',
}));
const bundle = await build({
  stdin: { contents: `import React, {useState} from 'react'; import {createRoot} from 'react-dom/client';
    import Select from './src/components/Profile/ReportingManagerSelect';
    function Fixture(){const [value,setValue]=useState('');return <Select employees={${JSON.stringify(employees)}} value={value} onChange={v=>{setValue(v);window.selected=v}}/>}
    createRoot(document.getElementById('root')).render(<Fixture/>);`, resolveDir: process.cwd(), loader: 'jsx' },
  bundle: true, write: false, format: 'iife',
});
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setContent('<div id="root"></div>');
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  const select = page.getByLabel('Reporting Manager', { exact: true });
  await select.waitFor();
  assert.equal(await select.locator('option').count(), 356);
  const search = page.getByRole('searchbox');
  for (const query of ['sales', 'EMP354', 'person354@example.test', 'employee 354']) {
    await search.fill(query);
    assert.equal(await select.locator('option').count(), 2);
  }
  await select.selectOption('354');
  assert.equal(await page.evaluate(() => window.selected), '354');
  await search.fill('no such employee');
  await page.getByRole('status').filter({ hasText: 'No employees match' }).waitFor();
  assert.equal(await select.inputValue(), '354');
  await search.clear();
  assert.equal(await select.locator('option').count(), 356);
  await select.selectOption('');
  assert.equal(await page.evaluate(() => window.selected), '');
  assert.deepEqual(errors, []);
  console.log('PASS: all 355 employees, search by department/ID/email/name, selection preserved during search, and clearing.');
} finally { await browser.close(); }
