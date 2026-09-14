import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { loadSnapshot } from './ui-check-support.mjs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import AxeBuilder from '@axe-core/playwright';

// Invoked by check-executive-ui.mjs, sharing its isolated real-shell fixture harness.
export async function runFinancialPerformanceChecks({ frontend, newPage, assertGeometry, reportFixture, verification }) {
  const artifacts = verification?.artifacts || path.resolve(frontend, '../artifacts/financial-performance');
  await mkdir(artifacts, { recursive: true });
  const protectedPaths = [
    'src/components/Layout/Sidebar.jsx', 'src/components/Layout/Sidebar.css',
    'src/config/layout.config.js', 'src/config/navigationLabels.config.js',
    'src/hooks/useSidebarLayout.js', 'src/hooks/useSidebarDrawer.js',
    'src/pages/Executive/ExecutiveMainPanels.jsx', 'src/pages/Executive/ExecutiveSidePanels.jsx',
  ];
  let checkProtectedFiles = verification?.assertProtected;
  if (!verification) {
  const baselinePath = path.join(artifacts, 'protected-baseline-sha256.json');
  const baseline = await loadSnapshot(frontend, baselinePath);
  checkProtectedFiles = async () => {
    assert.equal(baseline.length, protectedPaths.length);
    for (const row of baseline) assert.equal(createHash('sha256').update(await readFile(row.Path)).digest('hex').toUpperCase(), row.Hash, `Protected file changed: ${row.Path}`);
  };
  }
  await checkProtectedFiles();
  // A polish run uses immutable task-scoped source and geometry guards in the parent harness.
  const checks = [];
  const accessibilityIssues = [];
  const financialReady = async page => {
    await page.getByRole('heading', { name: 'Financial Performance', exact: true }).waitFor();
    await page.getByTestId('financial-outcomes').waitFor();
  };
  const openFinancial = async (options = {}) => {
    const state = await newPage({ ...options, route: '/executive?tab=financial' });
    if (!options.loading && (!options.status || options.status === 200)) await financialReady(state.page);
    return state;
  };
  const capture = async (page, name, print = false) => {
    await page.locator('main.main-content').evaluate(main => main.scrollTo(0, 0));
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(artifacts, `${name}.png`), fullPage: print });
  };
  const value = (page, id) => page.getByTestId(`financial-cash-metric-${id}`).locator('strong');
  const assertFiveUnknownKpis = async page => {
    assert.equal(await page.locator('[data-testid^="financial-kpi-"]').count(), 5);
    assert.deepEqual(await page.locator('[data-testid^="financial-kpi-"] .fp-outcome-value').allTextContents(), Array(5).fill('—'));
  };

  let comparison = verification ? { mode: verification.comparisonMode || 'tabs_polish_guard' } : null;
  if (!verification) {
  // Compare the untouched Overview against the screenshot captured before this task.
  const overview = await newPage();
  await overview.page.getByTestId('executive-outcomes').waitFor();
  await assertGeometry(overview.page, 1672);
  await capture(overview.page, 'overview-after');
  const beforePath = path.join(artifacts, 'overview-before.png');
  const before = await readFile(beforePath);
  const after = await readFile(path.join(artifacts, 'overview-after.png'));
  comparison = await overview.page.evaluate(async images => {
    const decoded = await Promise.all(images.map(async source => { const image = new Image(); image.src = source; await image.decode(); return image; }));
    if (decoded[0].width !== decoded[1].width || decoded[0].height !== decoded[1].height) return { dimensionsMatch: false };
    const canvas = document.createElement('canvas');
    canvas.width = decoded[0].width; canvas.height = decoded[0].height;
    const context = canvas.getContext('2d');
    const pixels = decoded.map(image => { context.clearRect(0, 0, canvas.width, canvas.height); context.drawImage(image, 0, 0); return context.getImageData(0, 0, canvas.width, canvas.height).data; });
    let changedPixels = 0;
    for (let index = 0; index < pixels[0].length; index += 4) if ([0, 1, 2, 3].some(channel => Math.abs(pixels[0][index + channel] - pixels[1][index + channel]) > 3)) changedPixels++;
    return { dimensionsMatch: true, width: canvas.width, height: canvas.height, changedPixels };
  }, [before, after].map(bytes => `data:image/png;base64,${bytes.toString('base64')}`));
  await writeFile(path.join(artifacts, 'overview-comparison.json'), JSON.stringify(comparison, null, 2));
  assert.equal(comparison.dimensionsMatch, true);
  assert.equal(comparison.changedPixels, 0, 'Overview is visually unchanged by the financial tab');
  checks.push('Overview screenshot unchanged and eight protected product files retain their original hashes');

  }
  const { page } = await openFinancial();
  const currency = page.getByRole('combobox', { name: 'Financial reporting currency', exact: true });
  assert.equal(await currency.inputValue(), 'AED');
  await assertFiveUnknownKpis(page);
  for (const width of [1672, 1440, 1024, 390]) {
    await assertGeometry(page, width);
    if (width === 1672) {
      const main = await page.getByTestId('financial-main-column').boundingBox();
      const right = await page.getByTestId('financial-right-column').boundingBox();
      const outcomes = await page.getByTestId('financial-outcomes').boundingBox();
      assert.ok(main.width / (main.width + right.width) >= .58 && main.width / (main.width + right.width) <= .66, 'Financial reference columns use approximately 62% / 38%');
      assert.ok(outcomes.width > main.width && Math.abs(main.y - right.y) < 3);
      const boxes = await Promise.all(['financial-actions', 'financial-revenue-margin', 'financial-business-units', 'financial-project-exposure'].map(id => page.getByTestId(id).boundingBox()));
      assert.ok(boxes.every((box, index) => !index || box.y >= boxes[index - 1].y + boxes[index - 1].height), 'Financial main panels follow the reference order');
    }
    await capture(page, `financial-${width}`);
  }
  await assertGeometry(page, 1672);
  checks.push('Financial title, five outcomes, 62/38 desktop composition and 1440/1024/390 responsive layouts');

  assert.match(await value(page, 'receivables').innerText(), /AED\s+125,000/);
  assert.match(await value(page, 'receivables_over60').innerText(), /AED\s+25,000/);
  assert.equal(await value(page, 'cash_position').innerText(), '—');
  assert.equal(await value(page, 'dso').innerText(), '—');
  assert.equal(await page.getByTestId('financial-aging-bucket-unknown_due_date').locator('strong').innerText(), '10,000');
  const percentages = await page.locator('.fp-aging-segment').evaluateAll(nodes => nodes.map(node => parseFloat(node.style.width)));
  assert.ok(Math.abs(percentages.reduce((sum, number) => sum + number, 0) - 100) < .01);
  assert.match(await page.getByTestId('financial-control-data-quality-detail').innerText(), /2 missing due dates/);
  assert.match(await page.getByTestId('financial-control-financial_data_quality').innerText(), /Review/);
  await currency.selectOption('USD');
  assert.match(await value(page, 'receivables').innerText(), /USD\s+90,000/);
  assert.match(await value(page, 'receivables_over60').innerText(), /USD\s+10,000/);
  assert.equal(await page.getByTestId('financial-aging-bucket-unknown_due_date').locator('strong').innerText(), '0');
  assert.equal(await page.getByTestId('financial-control-data-quality-detail').count(), 0, 'Currency-specific quality issues do not leak from AED into USD');
  assert.match(await page.getByTestId('financial-control-financial_data_quality').innerText(), /Not assessed/);
  await currency.selectOption('AED');
  checks.push('Original-currency receivables/aging totals, unknown due-date isolation and scoped quality issues; no invented cash or DSO');

  assert.equal(await page.getByRole('img', { name: /Revenue and operating margin chart unavailable/ }).count(), 1);
  assert.equal(await page.getByTestId('financial-forecast-bridge-unavailable').count(), 1);
  assert.match(await page.getByTestId('financial-business-units').innerText(), /financial reporting not connected/i);
  assert.deepEqual(await page.getByTestId('financial-project-one').locator('td').allTextContents().then(cells => cells.slice(0, 4)), Array(4).fill('—'));
  assert.equal(await page.getByTestId('financial-project-one').locator('td').nth(5).innerText(), 'Not connected', 'Unfetched corrective-plan data is identified as not connected');
  for (const id of ['month_close', 'forecast_submissions', 'cost_reports_overdue', 'unapproved_variations']) assert.match(await page.getByTestId(`financial-control-${id}`).innerText(), /Not assessed/);
  checks.push('Financial history, FY forecasts, business-unit measures, project margins and close controls remain explicitly unavailable');

  const explain = page.getByRole('button', { name: 'About Revenue YTD', exact: true });
  await explain.click();
  const dialog = page.getByRole('dialog');
  await dialog.waitFor();
  assert.match(await dialog.innerText(), /Approved financial reporting source/);
  for (const key of ['Tab', 'Shift+Tab']) { await page.keyboard.press(key); assert.equal(await dialog.evaluate(node => node.contains(document.activeElement)), true); }
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'hidden' });
  assert.equal(await explain.evaluate(node => node === document.activeElement), true);
  await page.getByRole('button', { name: 'About Cash & working capital', exact: true }).click();
  await dialog.waitFor();
  assert.match(await dialog.innerText(), /Receivables/);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(350);
  await capture(page, 'financial-definitions-mobile');
  await page.getByRole('button', { name: 'Close definitions', exact: true }).click();
  await assertGeometry(page, 1672);

  assert.equal(await page.locator('[data-testid^="financial-action-"]').count(), 3);
  await page.getByRole('button', { name: 'View all 6 actions', exact: true }).click();
  assert.equal(await page.locator('[data-testid^="financial-action-"]').count(), 6);
  await page.getByRole('button', { name: 'Show top 3 actions', exact: true }).click();
  await page.getByTestId('financial-action-financial-invoice-1').getByRole('button').click();
  await dialog.waitFor();
  assert.match(await dialog.innerText(), /Confirm the recorded invoice balance/);
  await page.getByRole('button', { name: 'Close definitions', exact: true }).click();
  await page.getByTestId('financial-action-financial-invoice-1').getByRole('link').click();
  await page.waitForFunction(() => window.executiveRoute === '/finance/outgoing-invoices/financial-1');
  await page.evaluate(() => window.executiveNavigate('/executive?tab=financial'));
  await financialReady(page);
  await page.reload();
  await financialReady(page);
  checks.push('Definitions/focus, full action context, view-all, invoice drilldowns and persistent financial deep link');

  await page.getByRole('button', { name: 'Export board report', exact: true }).click();
  const printed = await page.evaluate(() => window.executivePrintSnapshot);
  assert.equal(printed.title, 'Financial Performance');
  assert.equal(printed.financialActions.length, 6);
  assert.equal(printed.actions.length, 0, 'Financial export does not silently print Overview decisions');
  assert.equal(printed.notesOpen, true);
  assert.equal(await page.locator('[data-testid^="financial-action-"]').count(), 3);
  assert.equal(await page.locator('#application-sidebar').isVisible(), true);
  await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
  await page.emulateMedia({ media: 'print' });
  await capture(page, 'financial-board-print', true);
  await page.pdf({ path: path.join(artifacts, 'financial-board-report.pdf'), format: 'A4', preferCSSPageSize: true, printBackground: true });
  await page.emulateMedia({ media: 'screen' });
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  await financialReady(page);
  assert.equal(await page.locator('[data-testid^="financial-action-"]').count(), 3);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export snapshot', exact: true }).click();
  assert.deepEqual(JSON.parse(await readFile(await (await downloadPromise).path(), 'utf8')), reportFixture());
  checks.push('Current financial tab exports all financial actions, preserves screen state and exports the exact API snapshot');

  for (const mode of ['light', 'dark']) {
    await page.evaluate(dark => document.documentElement.classList.toggle('dark', dark), mode === 'dark');
    await capture(page, `financial-${mode}`);
    const result = await new AxeBuilder({ page }).include('main.main-content').withRules(['color-contrast', 'button-name', 'label', 'aria-valid-attr-value']).analyze();
    if (result.violations.length) accessibilityIssues.push({ mode, violations: result.violations });
  }
  checks.push('Light and dark financial accessibility checks');

  for (const fixture of ['financial-usd-only', 'financial-zero-buckets', 'financial-unspecified', 'financial-incomplete', 'financial-settled', 'financial-missing', 'financial-restricted', 'financial-error']) {
    const state = await openFinancial({ fixture });
    const selector = state.page.getByRole('combobox', { name: 'Financial reporting currency' });
    await assertFiveUnknownKpis(state.page);
    assert.doesNotMatch(await state.page.getByTestId('financial-performance').innerText(), /NaN|Infinity|undefined/);
    if (fixture === 'financial-usd-only') {
      assert.equal(await selector.inputValue(), 'USD');
      assert.deepEqual(await selector.locator('option').allTextContents(), ['USD']);
      assert.match(await value(state.page, 'receivables').innerText(), /USD\s+90,000/);
    }
    if (fixture === 'financial-zero-buckets') {
      assert.equal(await selector.inputValue(), 'USD');
      assert.match(await value(state.page, 'receivables_over60').innerText(), /USD\s+0/);
      assert.equal(await state.page.getByTestId('financial-aging-bucket-over60').locator('strong').innerText(), '0');
      assert.equal(await state.page.locator('.fp-aging-segment').count(), 1);
    }
    if (fixture === 'financial-unspecified') assert.equal(await selector.inputValue(), 'UNSPECIFIED');
    if (fixture === 'financial-incomplete') {
      assert.equal(await selector.inputValue(), 'AED');
      assert.equal(await value(state.page, 'receivables').innerText(), '—');
      assert.match(await state.page.getByTestId('financial-aging-unavailable').innerText(), /Aging incomplete/);
      assert.equal(await state.page.getByTestId('financial-aging-bar').count(), 0);
      await selector.selectOption('USD');
      assert.match(await value(state.page, 'receivables').innerText(), /USD\s+90,000/);
      assert.equal(await state.page.getByTestId('financial-aging-bar').count(), 1);
      await selector.selectOption('AED');
    }
    if (fixture === 'financial-settled') {
      assert.equal(await selector.inputValue(), '');
      assert.equal(await state.page.getByTestId('financial-aging-settled').count(), 1);
      assert.equal(await state.page.getByTestId('financial-aging-bar').count(), 0);
    }
    if (fixture === 'financial-missing') assert.equal(await state.page.getByTestId('financial-aging-unavailable').count(), 1);
    if (fixture === 'financial-restricted') {
      assert.equal(await state.page.locator('[data-testid^="financial-action-"]').count(), 0);
      assert.match(await state.page.getByTestId('financial-aging-unavailable').innerText(), /Receivables access required/);
      assert.equal(await state.page.getByTestId('financial-cash-working-capital').getByRole('link').count(), 0);
    }
    if (fixture === 'financial-error') {
      assert.equal(await state.page.locator('[data-testid^="financial-action-"]').count(), 0);
      assert.match(await state.page.getByTestId('financial-actions').innerText(), /Finance source unavailable/);
      assert.match(await state.page.getByTestId('financial-aging-unavailable').innerText(), /Receivables source unavailable/);
      await state.page.getByRole('button', { name: 'About Receivables', exact: true }).click();
      const sourceDialog = state.page.getByRole('dialog');
      await sourceDialog.waitFor();
      assert.match(await sourceDialog.innerText(), /Source unavailable/);
      assert.match(await sourceDialog.innerText(), /customer invoice source could not be read/);
      await state.page.getByRole('button', { name: 'Close definitions', exact: true }).click();
    }
    await capture(state.page, fixture);
  }
  checks.push('USD fallback, explicit unspecified currency, true zero buckets, incomplete-currency suppression, settled currencyless source, missing DTO, restricted data and source errors');

  const loading = await openFinancial({ loading: true });
  assert.equal(await loading.page.locator('[data-testid^="financial-kpi-"]').count(), 0);
  await capture(loading.page, 'financial-loading');
  await loading.control.release();
  await financialReady(loading.page);
  for (const status of [403, 503]) {
    const state = await openFinancial({ status });
    await state.page.getByRole('alert').waitFor();
    assert.equal(await state.page.getByTestId('financial-performance').count(), 0);
    await capture(state.page, `financial-error-${status}`);
    state.control.status = 200;
    await state.page.getByRole('button', { name: 'Try again', exact: true }).click();
    await financialReady(state.page);
  }
  checks.push('Financial deep-link loading, 403/service errors and retry recovery');
  await checkProtectedFiles();
  await writeFile(path.join(artifacts, 'accessibility.json'), JSON.stringify(accessibilityIssues, null, 2));
  assert.deepEqual(accessibilityIssues, [], 'Financial contrast and accessible controls');
  await writeFile(path.join(artifacts, 'checks.json'), JSON.stringify({ checks, overviewComparison: comparison, protectedHashesUnchanged: true }, null, 2));
  console.log('PASS financial: ' + checks.join('; ') + '.');
  console.log('Financial artifacts: ' + artifacts);
}
