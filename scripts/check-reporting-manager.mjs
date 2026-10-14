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
    function Fixture(){const [value,setValue]=useState('');const [compact,setCompact]=useState(false);return <><button onClick={()=>setCompact(true)}>Compact mode</button><Select compact={compact} employees={${JSON.stringify(employees)}} value={value} onChange={v=>{setValue(v);window.selected=v}}/></>}
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
  await page.getByRole('button', {name:'Compact mode'}).click();
  assert.equal(await page.getByRole('searchbox').count(), 0);
  const trigger = page.getByLabel('Reporting Manager', {exact:true});
  await trigger.click();
  const popup = page.getByRole('dialog', {name:'Choose reporting manager'});
  assert.equal(await popup.getByRole('button').count(),356);
  assert.equal(await search.evaluate(el=>el===document.activeElement),true);
  for (const query of ['sales','EMP354','person354@example.test','employee 354']) {
    await search.fill(query);
    assert.equal(await popup.getByRole('button').count(),2);
  }
  await popup.getByRole('button').filter({hasText:'Employee 354'}).click();
  assert.equal(await page.evaluate(()=>window.selected),'354');
  assert.equal(await page.getByRole('searchbox').count(),0);
  assert.ok((await trigger.innerText()).includes('Employee 354'));
  await trigger.click();
  await search.fill('no such employee');
  await popup.getByRole('status').waitFor();
  await search.press('Escape');
  assert.equal(await trigger.getAttribute('aria-expanded'),'false');
  assert.equal(await page.evaluate(()=>window.selected),'354');
  await trigger.click();
  await search.press('ArrowDown');
  await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(()=>window.selected),'');
  await trigger.click();
  await page.getByRole('button',{name:'Compact mode'}).click();
  assert.equal(await trigger.getAttribute('aria-expanded'),'false');
  assert.deepEqual(errors, []);
  console.log('PASS: all 355 employees, search by department/ID/email/name, selection preserved during search, and clearing.');
} finally { await browser.close(); }
