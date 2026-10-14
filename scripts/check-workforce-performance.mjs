import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { loadSnapshot } from './ui-check-support.mjs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import AxeBuilder from '@axe-core/playwright';

// Fifth executive tab: real shell, synthetic aggregate-only workforce response.
export async function runWorkforcePerformanceChecks({ frontend, newPage, assertGeometry, reportFixture, verification }) {
  const artifacts = verification?.artifacts || path.resolve(frontend, '../artifacts/workforce-performance');
  await mkdir(artifacts, { recursive: true });
  const protectedFiles = [
    'src/components/Layout/Sidebar.jsx', 'src/components/Layout/Sidebar.css',
    'src/config/layout.config.js', 'src/config/navigationLabels.config.js',
    'src/hooks/useSidebarLayout.js', 'src/hooks/useSidebarDrawer.js',
    'src/pages/Executive/ExecutiveMainPanels.jsx', 'src/pages/Executive/ExecutiveSidePanels.jsx',
    'src/pages/Executive/FinancialPerformance.jsx', 'src/pages/Executive/FinancialPerformance.css',
    'src/pages/Executive/financialPresentation.jsx', 'src/pages/Executive/FinancialSidePanels.jsx',
    'src/pages/Executive/ProjectPortfolio.jsx', 'src/pages/Executive/ProjectPortfolio.css',
    'src/pages/Executive/portfolioPresentation.jsx', 'src/pages/Executive/PortfolioSidePanels.jsx',
    'src/pages/Executive/CommercialPipeline.jsx', 'src/pages/Executive/CommercialPipeline.css',
    'src/pages/Executive/commercialPresentation.jsx', 'src/pages/Executive/CommercialSidePanels.jsx',
  ];
  let checkProtectedFiles = verification?.assertProtected;
  if (!verification) {
  const baselinePath = path.join(artifacts, 'protected-baseline-sha256.json');
  const baseline = await loadSnapshot(frontend, baselinePath);
  checkProtectedFiles = async () => {
    assert.equal(baseline.length, protectedFiles.length, 'Sidebar and all four completed tabs were captured before workforce work');
    for (const row of baseline) assert.equal(createHash('sha256').update(await readFile(row.Path)).digest('hex').toUpperCase(), row.Hash, `Protected file changed: ${row.Path}`);
  };
  }
  await checkProtectedFiles();
  // A polish run uses immutable task-scoped source and geometry guards in the parent harness.
  const checks = [];
  const accessibilityIssues = [];
  const capture = async (page, name, print = false) => {
    for (const selector of ['main.main-content', '.cc-command-center']) await page.locator(selector).evaluate(node => node.scrollTo({ top: 0, left: 0, behavior: 'instant' }));
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.screenshot({ path: path.join(artifacts, `${name}.png`), fullPage: print });
  };
  const comparisons = {};
  if (!verification) {
  for (const [name, route, readyId] of [['overview', '/executive', 'executive-outcomes'], ['financial', '/executive?tab=financial', 'financial-outcomes'], ['portfolio', '/executive?tab=portfolio', 'portfolio-outcomes'], ['commercial', '/executive?tab=commercial', 'commercial-outcomes']]) {
    const { page } = await newPage({ route });
    await page.getByTestId(readyId).waitFor();
    await assertGeometry(page, 1672);
    await capture(page, `${name}-after`);
    await readFile(path.join(artifacts, `${name}-before.png`));
    const images = await Promise.all(['before', 'after'].map(suffix => readFile(path.join(artifacts, `${name}-${suffix}.png`))));
    comparisons[name] = await page.evaluate(async sources => {
      const decoded = await Promise.all(sources.map(async source => { const image = new Image(); image.src = source; await image.decode(); return image; }));
      if (decoded[0].width !== decoded[1].width || decoded[0].height !== decoded[1].height) return { dimensionsMatch: false };
      const canvas = document.createElement('canvas');
      canvas.width = decoded[0].width; canvas.height = decoded[0].height;
      const context = canvas.getContext('2d');
      const pixels = decoded.map(image => { context.clearRect(0, 0, canvas.width, canvas.height); context.drawImage(image, 0, 0); return context.getImageData(0, 0, canvas.width, canvas.height).data; });
      let changedPixels = 0;
      for (let index = 0; index < pixels[0].length; index += 4) if ([0, 1, 2, 3].some(channel => Math.abs(pixels[0][index + channel] - pixels[1][index + channel]) > 3)) changedPixels++;
      return { dimensionsMatch: true, width: canvas.width, height: canvas.height, changedPixels };
    }, images.map(bytes => `data:image/png;base64,${bytes.toString('base64')}`));
    await writeFile(path.join(artifacts, `${name}-comparison.json`), JSON.stringify(comparisons[name], null, 2));
    assert.equal(comparisons[name].dimensionsMatch, true);
    assert.equal(comparisons[name].changedPixels, 0, `${name} is visually unchanged by the workforce tab`);
    await page.context().close();
  }
  checks.push('Four completed views remain pixel-identical; all 20 protected product files retain original hashes');
  }

  const workforceReady = async page => {
    await page.getByRole('heading', { name: 'Workforce', exact: true }).waitFor();
    await page.getByTestId('workforce-outcomes').waitFor();
  };
  const openWorkforce = async (options = {}) => {
    const state = await newPage({ ...options, route: '/executive?tab=workforce' });
    if (!options.loading && (!options.status || options.status === 200)) await workforceReady(state.page);
    return state;
  };
  const capacityRows = page => page.getByTestId('workforce-capacity-plan').locator('tbody tr');
  const actions = page => page.getByTestId('workforce-decisions').locator('tbody tr');
  const kpi = (page, id) => page.getByTestId(`workforce-kpi-${id}`).locator('.wf-outcome-value');
  const assertUnsupportedUnknown = async page => {
    for (const id of ['billable_utilisation', 'critical_vacancies', 'voluntary_turnover', 'capacity_coverage']) assert.equal(await kpi(page, id).innerText(), '—');
  };
  const forbiddenFields = new Set(['employee_id', 'employee_name', 'personal_email', 'work_email', 'date_of_birth', 'bank_account', 'salary', 'total_compensation']);
  const inspectAggregate = value => {
    if (!value || typeof value !== 'object') return;
    for (const [key, nested] of Object.entries(value)) { assert.equal(forbiddenFields.has(key), false, `Workforce response is aggregate-only: ${key}`); inspectAggregate(nested); }
  };
  inspectAggregate(reportFixture().workforce_performance);

  const { page } = await openWorkforce();
  assert.equal(await page.locator('[data-testid^="workforce-kpi-"]').count(), 5);
  assert.equal(await kpi(page, 'headcount').innerText(), '127');
  await assertUnsupportedUnknown(page);
  assert.equal(await page.getByRole('tab', { name: 'Workforce', exact: true }).getAttribute('aria-selected'), 'true');
  assert.equal(await page.getByRole('combobox', { name: 'Commercial reporting currency' }).count(), 0);
  for (const width of [1672, 1440, 1024, 390]) {
    await assertGeometry(page, width);
    await capture(page, `workforce-${width}`);
    const overflow = await page.locator('.cc-command-center').evaluate(node => ({ clientWidth: node.clientWidth, scrollWidth: node.scrollWidth, outside: [...node.querySelectorAll('*')].filter(child => child.getBoundingClientRect().right > node.getBoundingClientRect().right + 1 && !child.closest('.cc-table-wrap, .wf-side-table-wrap')).map(child => ({ tag: child.tagName, className: child.className, right: Math.round(child.getBoundingClientRect().right) })).slice(0, 30) }));
    assert.ok(overflow.scrollWidth <= overflow.clientWidth + 1, `Workforce content fits at ${width}: ${JSON.stringify(overflow)}`);
    if (width === 1672) {
      const outcomes = await page.getByTestId('workforce-outcomes').boundingBox();
      const main = await page.locator('.wf-main-column').boundingBox();
      const right = await page.locator('.wf-right-column').boundingBox();
      assert.ok(outcomes.width > main.width + right.width && main.y >= outcomes.y + outcomes.height);
      assert.ok(main.width / (main.width + right.width) >= .56 && main.width / (main.width + right.width) <= .62);
      assert.ok(Math.abs(main.y - right.y) < 3);
      const boxes = await Promise.all(['workforce-decisions', 'workforce-capacity-plan', 'workforce-supply-demand', 'workforce-movement'].map(id => page.getByTestId(id).boundingBox()));
      assert.ok(boxes.every((box, index) => !index || box.y >= boxes[index - 1].y + boxes[index - 1].height), 'Workforce reference panels retain their sequence');
    }
    if (width === 390) {
      const selected = await page.getByRole('tab', { name: 'Workforce', exact: true }).boundingBox();
      const strip = await page.locator('.cc-tabs').boundingBox();
      assert.ok(selected.x >= strip.x && selected.x + selected.width <= strip.x + strip.width, 'Active mobile Workforce tab is fully visible');
    }
    await capture(page, `workforce-${width}`);
  }
  await assertGeometry(page, 1672);
  checks.push('Five truthful outcomes and reference panel sequence at 1672/1440/1024/390; active mobile tab visible and original sidebar unchanged');

  const capacity = page.getByTestId('workforce-capacity-plan');
  const search = page.getByRole('textbox', { name: 'Search workforce departments', exact: true });
  const department = page.getByRole('combobox', { name: 'Workforce department', exact: true });
  const pageSize = page.getByRole('combobox', { name: 'Workforce rows per page', exact: true });
  for (const name of ['Capacity business unit', 'Capacity location', 'Capacity demand source']) assert.equal(await page.getByRole('combobox', { name, exact: true }).isDisabled(), true);
  assert.equal(await capacityRows(page).count(), 6);
  assert.equal(await page.getByRole('button', { name: 'Previous workforce page', exact: true }).isDisabled(), true);
  const firstPage = await capacityRows(page).locator('th').allTextContents();
  await page.getByRole('button', { name: 'Next workforce page', exact: true }).click();
  assert.equal(await capacityRows(page).count(), 4);
  assert.equal((await capacityRows(page).locator('th').allTextContents()).some(name => firstPage.includes(name)), false);
  assert.equal(await page.getByRole('button', { name: 'Next workforce page', exact: true }).isDisabled(), true);
  await search.fill('eNgInEeR');
  assert.equal(await capacityRows(page).count(), 1);
  assert.equal(await capacityRows(page).first().locator('th').innerText(), 'Engineering');
  assert.equal(await kpi(page, 'headcount').innerText(), '127', 'Capacity filtering does not change the full workforce population');
  await department.selectOption('Finance');
  assert.match(await capacity.innerText(), /No departments match your filters/);
  await search.fill('');
  assert.equal(await capacityRows(page).first().locator('th').innerText(), 'Finance');
  await department.selectOption('');
  await pageSize.selectOption('20');
  assert.equal(await capacityRows(page).count(), 10);
  await capacity.getByRole('button', { name: /^Headcount/ }).click();
  assert.equal(await capacityRows(page).first().locator('th').innerText(), 'Unassigned');
  await capacity.getByRole('button', { name: /^Headcount/ }).click();
  assert.equal(await capacityRows(page).first().locator('th').innerText(), 'Engineering');
  assert.equal(await capacity.getByRole('columnheader', { name: /^Headcount/ }).getAttribute('aria-sort'), 'descending');
  await capacity.getByRole('button', { name: /^Department/ }).click();
  const sortedNames = await capacityRows(page).locator('th').allTextContents();
  assert.deepEqual(sortedNames, [...sortedNames].sort((a, b) => a.localeCompare(b)));
  assert.equal((await capacityRows(page).locator('td:first-of-type strong').allTextContents()).reduce((sum, value) => sum + Number(value), 0), 127);
  for (const row of await capacityRows(page).all()) {
    assert.deepEqual(await row.locator('td').allTextContents().then(cells => cells.slice(1, 7)), Array(6).fill('—'));
    assert.match(await row.innerText(), /Not assessed/);
  }
  checks.push('Aggregate department search/filter/sort/pagination, explicit Unassigned bucket and full-population total; unavailable capacity/FTE controls and measures remain unavailable');

  assert.deepEqual(await page.locator('.wf-movement-month strong').allTextContents(), ['2', '1', '4', '0', '3', '2', '5', '1', '2', '3', '1', '0']);
  assert.deepEqual(await page.locator('.wf-movement-summary button strong').allTextContents(), ['3', '3']);
  assert.match(await page.getByTestId('workforce-movement').innerText(), /not historical headcount/);
  assert.match(await page.getByTestId('workforce-supply-demand').innerText(), /Capacity forecast unavailable/);
  assert.match(await page.getByTestId('workforce-critical-roles').innerText(), /not connected/);
  assert.match(await page.getByTestId('workforce-project-coverage-risk').innerText(), /not connected/);
  for (const id of ['fully_covered', 'require_reallocation', 'depend_on_recruitment', 'depend_on_subcontractor']) {
    assert.equal(await page.getByTestId(`workforce-coverage-${id}`).locator('strong').innerText(), '\u2014');
  }
  assert.equal(await page.getByTestId('workforce-retention-notice_period').locator('strong').innerText(), '5');
  assert.match(await page.getByTestId('workforce-retention-notice_period').innerText(), /Reported/);
  assert.doesNotMatch(await page.getByTestId('workforce-retention-notice_period').innerText(), /High risk|Attention|Review/);
  for (const id of ['voluntary_turnover', 'internal_mobility', 'retention_risk']) assert.equal(await page.getByTestId(`workforce-retention-${id}`).locator('strong').innerText(), '—');
  const distribution = page.getByRole('combobox', { name: 'Workforce distribution by', exact: true });
  for (const [dimension, expected] of [['office', ['70', '35', '19', '3']], ['business_unit', ['74', '52', '1']], ['branch', ['96', '31']]]) {
    await distribution.selectOption(dimension);
    assert.equal(await page.getByTestId('workforce-distribution-total').innerText(), '127 people');
    assert.deepEqual(await page.getByTestId('workforce-distribution-row').locator('strong').allTextContents(), expected);
    const shares = await page.locator('.wf-distribution-track > span').evaluateAll(nodes => nodes.map(node => parseFloat(node.style.width)));
    assert.ok(Math.abs(shares.reduce((sum, value) => sum + value, 0) - 100) < .01);
  }
  await distribution.selectOption('office');
  assert.match(await page.getByTestId('workforce-distribution-employment-type').innerText(), /Employment type not connected/);
  checks.push('Recorded join/exit movement includes real zeros; notice count stays neutral; organizational distributions preserve totals without invented employment types or retention scores');

  const explain = page.getByRole('button', { name: 'About Headcount', exact: true });
  await explain.click();
  const dialog = page.getByRole('dialog');
  await dialog.waitFor();
  assert.match(await dialog.innerText(), /Synthetic authorized HR aggregate/);
  for (const key of ['Tab', 'Shift+Tab']) { await page.keyboard.press(key); assert.equal(await dialog.evaluate(node => node.contains(document.activeElement)), true); }
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'hidden' });
  assert.equal(await explain.evaluate(node => node === document.activeElement), true);
  await capacity.getByRole('button', { name: 'Reporting basis', exact: true }).click();
  await dialog.waitFor();
  assert.match(await dialog.innerText(), /Missing department/);
  assert.match(await dialog.innerText(), /Invalid lifecycle dates/);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(350);
  await capture(page, 'workforce-definitions-mobile');
  assert.equal(await dialog.evaluate(node => { const rect = node.getBoundingClientRect(); return rect.x >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight; }), true);
  await page.getByRole('button', { name: 'Close definitions', exact: true }).click();
  await assertGeometry(page, 1672);
  await page.getByTestId('workforce-coverage-fully_covered').click();
  await dialog.waitFor();
  assert.match(await dialog.innerText(), /Project coverage risk/);
  assert.match(await dialog.innerText(), /not connected/);
  await page.getByRole('button', { name: 'Close definitions', exact: true }).click();
  assert.equal(await actions(page).count(), 3);
  await page.getByRole('button', { name: 'View all 4 decisions', exact: true }).click();
  assert.equal(await actions(page).count(), 4);
  await actions(page).first().getByRole('button').click();
  await dialog.waitFor();
  assert.match(await dialog.innerText(), /aggregate HR records/);
  await page.getByRole('button', { name: 'Close definitions', exact: true }).click();
  await page.getByRole('button', { name: 'Show top 3 decisions', exact: true }).click();
  await capacityRows(page).first().getByRole('link', { name: 'Open', exact: true }).click();
  await page.waitForFunction(() => window.executiveRoute === '/hr/employees');
  await page.evaluate(() => window.executiveNavigate('/executive?tab=workforce'));
  await workforceReady(page);
  await page.reload();
  await workforceReady(page);
  await page.getByRole('tab', { name: 'Workforce', exact: true }).focus();
  await page.keyboard.press('ArrowLeft');
  await page.getByTestId('commercial-outcomes').waitFor();
  await page.keyboard.press('ArrowRight');
  await workforceReady(page);
  checks.push('Metric and reporting-basis dialogs, keyboard/mobile focus, aggregate action context, HR source links, persistent deep link and adjacent-tab keyboard navigation');

  await search.fill('Engineering');
  assert.equal(await capacityRows(page).count(), 1);
  await page.getByRole('button', { name: 'Export board report', exact: true }).click();
  const printed = await page.evaluate(() => window.executivePrintSnapshot);
  assert.equal(printed.title, 'Workforce');
  assert.equal(printed.workforceCapacity.length, 10);
  assert.equal(printed.workforceActions.length, 4);
  assert.equal(printed.workforceDistribution.length, 4);
  assert.equal(printed.actions.length + printed.financialActions.length + printed.portfolioProjects.length + printed.commercialOpportunities.length, 0);
  assert.equal(printed.notesOpen, true);
  assert.equal(await capacityRows(page).count(), 1);
  assert.equal(await search.inputValue(), 'Engineering');
  assert.equal(await page.locator('#application-sidebar').isVisible(), true);
  await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
  await page.emulateMedia({ media: 'print' });
  await capture(page, 'workforce-board-print', true);
  await page.pdf({ path: path.join(artifacts, 'workforce-board-report.pdf'), format: 'A4', preferCSSPageSize: true, printBackground: true });
  await page.emulateMedia({ media: 'screen' });
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  await workforceReady(page);
  assert.equal(await capacityRows(page).count(), 1);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export snapshot', exact: true }).click();
  assert.deepEqual(JSON.parse(await readFile(await (await downloadPromise).path(), 'utf8')), reportFixture());
  await search.fill('');
  checks.push('Current Workforce print includes all returned departments/actions, preserves filters/sidebar, and exports the exact aggregate API snapshot');

  for (const mode of ['light', 'dark']) {
    await page.evaluate(dark => document.documentElement.classList.toggle('dark', dark), mode === 'dark');
    await capture(page, `workforce-${mode}`);
    const result = await new AxeBuilder({ page }).include('main.main-content').withRules(['color-contrast', 'button-name', 'label', 'aria-valid-attr-value']).analyze();
    if (result.violations.length) accessibilityIssues.push({ mode, violations: result.violations });
  }
  for (const fixture of ['workforce-zero', 'workforce-empty', 'workforce-partial', 'workforce-restricted', 'workforce-error', 'workforce-missing', 'workforce-movement-zero', 'workforce-many-offices', 'workforce-distribution-incomplete', 'workforce-truncated']) {
    const state = await openWorkforce({ fixture });
    await assertUnsupportedUnknown(state.page);
    assert.doesNotMatch(await state.page.getByTestId('workforce-performance').innerText(), /NaN|Infinity|undefined/);
    inspectAggregate(reportFixture(fixture).workforce_performance);
    if (fixture === 'workforce-zero') {
      assert.equal(await kpi(state.page, 'headcount').innerText(), '0');
      assert.equal(await capacityRows(state.page).count(), 0);
      assert.equal(await state.page.getByTestId('workforce-distribution-total').innerText(), '0 people');
      assert.equal(await state.page.getByTestId('workforce-distribution-zero').count(), 1);
      assert.equal(await state.page.getByTestId('workforce-retention-notice_period').locator('strong').innerText(), '0');
      assert.match(await state.page.getByTestId('workforce-capacity-plan').innerText(), /No current employees reported/);
    }
    if (['workforce-empty', 'workforce-restricted', 'workforce-error', 'workforce-missing'].includes(fixture)) {
      assert.equal(await kpi(state.page, 'headcount').innerText(), '—');
      assert.equal(await capacityRows(state.page).count(), 0);
      assert.equal(await actions(state.page).count(), 0);
      assert.equal(await state.page.getByTestId('workforce-distribution-total').innerText(), '— people');
      assert.equal(await state.page.getByTestId('workforce-distribution-zero').count(), 0);
      assert.equal(await state.page.getByTestId('workforce-capacity-plan').getByRole('link').count(), 0);
      assert.equal(await state.page.getByRole('button', { name: 'Next workforce page', exact: true }).count(), 0);
      assert.doesNotMatch(await state.page.getByTestId('workforce-capacity-plan').innerText(), /matching departments|Page 1 of 1/);
      assert.match(await state.page.getByTestId('workforce-capacity-plan').innerText(), fixture === 'workforce-restricted' ? /HR access required/ : fixture === 'workforce-error' ? /HR source unavailable/ : /Capacity reporting unavailable/);
    }
    if (fixture === 'workforce-partial') {
      assert.equal(await kpi(state.page, 'headcount').innerText(), '127');
      assert.equal(await capacityRows(state.page).count(), 6);
      assert.match(await state.page.getByTestId('workforce-movement').innerText(), /HR source unavailable/);
      assert.equal(await state.page.locator('.wf-movement-month').count(), 0);
      assert.equal(await state.page.getByTestId('workforce-distribution-total').innerText(), '— people');
      await state.page.getByRole('combobox', { name: 'Workforce distribution by', exact: true }).selectOption('branch');
      assert.equal(await state.page.getByTestId('workforce-distribution-total').innerText(), '127 people');
    }
    if (fixture === 'workforce-movement-zero') {
      assert.equal(await state.page.locator('.wf-movement-month').count(), 6);
      assert.deepEqual(await state.page.locator('.wf-movement-month strong').allTextContents(), Array(12).fill('0'));
      assert.equal(await state.page.locator('.wf-movement-pair i').evaluateAll(nodes => nodes.every(node => parseFloat(node.style.height) === 0)), true);
    }
    if (fixture === 'workforce-many-offices') {
      assert.equal(await state.page.getByTestId('workforce-distribution-row').count(), 4);
      assert.match(await state.page.getByTestId('workforce-distribution').innerText(), /Other groups/);
      await state.page.getByRole('button', { name: 'Export board report', exact: true }).click();
      assert.equal(await state.page.evaluate(() => window.executivePrintSnapshot.workforceDistribution.length), 6);
      assert.equal(await state.page.getByTestId('workforce-distribution-row').count(), 4);
    }
    if (fixture === 'workforce-distribution-incomplete') {
      assert.equal(await state.page.getByTestId('workforce-distribution-total').innerText(), '— people');
      assert.equal(await state.page.getByTestId('workforce-distribution-row').count(), 0);
      assert.match(await state.page.getByTestId('workforce-distribution').innerText(), /distribution not available/);
    }
    if (fixture === 'workforce-truncated') {
      assert.match(await state.page.getByTestId('workforce-capacity-plan').innerText(), /10 of 210 departments/);
      assert.match(await state.page.getByTestId('workforce-decisions').innerText(), /4 of 41 source actions/);
      await state.page.getByRole('button', { name: 'Export board report', exact: true }).click();
      const text = await state.page.evaluate(() => window.executivePrintSnapshot.workforceText);
      assert.match(text, /10 of 210 departments/); assert.match(text, /4 of 41 source actions/);
    }
    await capture(state.page, fixture);
    await state.page.context().close();
  }
  checks.push('Available zero population versus unavailable empty source, partial section errors, permissions, missing DTO, zero movement, grouped distributions and truthful source caps');

  const loading = await openWorkforce({ loading: true });
  assert.equal(await loading.page.getByTestId('workforce-performance').count(), 0);
  await capture(loading.page, 'workforce-loading');
  await loading.control.release();
  await workforceReady(loading.page);
  for (const status of [403, 503]) {
    const state = await openWorkforce({ status });
    await state.page.getByRole('alert').waitFor();
    assert.equal(await state.page.getByTestId('workforce-performance').count(), 0);
    await capture(state.page, `workforce-error-${status}`);
    state.control.status = 200;
    await state.page.getByRole('button', { name: 'Try again', exact: true }).click();
    await workforceReady(state.page);
    await state.page.context().close();
  }
  const refreshed = await openWorkforce();
  refreshed.control.status = 503;
  await refreshed.page.getByRole('button', { name: 'Refresh overview', exact: true }).click();
  await refreshed.page.getByRole('alert').waitFor();
  assert.equal(await refreshed.page.getByTestId('workforce-performance').count(), 0, 'Failed refresh removes stale workforce data');
  checks.push('Light/dark accessibility, initial loading, HTTP errors/retry and failed-refresh stale-data removal');
  await checkProtectedFiles();
  await writeFile(path.join(artifacts, 'accessibility.json'), JSON.stringify(accessibilityIssues, null, 2));
  assert.deepEqual(accessibilityIssues, [], 'Workforce contrast and accessible controls');
  await writeFile(path.join(artifacts, 'checks.json'), JSON.stringify({ checks, comparisons, comparisonMode: verification?.comparisonMode || (verification ? "tabs_polish_guard" : "historical_snapshot"), protectedHashesUnchanged: true }, null, 2));
  console.log('PASS workforce: ' + checks.join('; ') + '.');
  console.log('Workforce artifacts: ' + artifacts);
}
