import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { loadSnapshot } from './ui-check-support.mjs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import AxeBuilder from '@axe-core/playwright';

// Runs inside the executive real-shell harness. Every API response is synthetic.
export async function runProjectPortfolioChecks({ frontend, newPage, assertGeometry, reportFixture, verification }) {
  const artifacts = verification?.artifacts || path.resolve(frontend, '../artifacts/project-portfolio');
  await mkdir(artifacts, { recursive: true });
  const protectedFiles = [
    'src/components/Layout/Sidebar.jsx', 'src/components/Layout/Sidebar.css',
    'src/config/layout.config.js', 'src/config/navigationLabels.config.js',
    'src/hooks/useSidebarLayout.js', 'src/hooks/useSidebarDrawer.js',
    'src/pages/Executive/ExecutiveMainPanels.jsx', 'src/pages/Executive/ExecutiveSidePanels.jsx',
    'src/pages/Executive/FinancialPerformance.jsx', 'src/pages/Executive/FinancialPerformance.css',
    'src/pages/Executive/financialPresentation.jsx', 'src/pages/Executive/FinancialSidePanels.jsx',
  ];
  let checkProtectedFiles = verification?.assertProtected;
  if (!verification) {
  const baselinePath = path.join(artifacts, 'protected-baseline-sha256.json');
  const baseline = await loadSnapshot(frontend, baselinePath);
  checkProtectedFiles = async () => {
    assert.equal(baseline.length, protectedFiles.length, 'All sidebar, Overview panels and Financial files were captured before portfolio work');
    for (const row of baseline) assert.equal(createHash('sha256').update(await readFile(row.Path)).digest('hex').toUpperCase(), row.Hash, `Protected file changed: ${row.Path}`);
  };
  }
  await checkProtectedFiles();
  // A polish run uses immutable task-scoped source and geometry guards in the parent harness.
  const checks = [];
  const accessibilityIssues = [];
  const capture = async (page, name, print = false) => {
    await page.locator('main.main-content').evaluate(main => main.scrollTo({ top: 0, left: 0, behavior: 'instant' }));
    await page.locator('.cc-command-center').evaluate(center => center.scrollTo({ top: 0, left: 0, behavior: 'instant' }));
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(artifacts, `${name}.png`), fullPage: print });
  };
  const comparisons = {};
  if (!verification) {
  for (const [name, route, readyId] of [['overview', '/executive', 'executive-outcomes'], ['financial', '/executive?tab=financial', 'financial-outcomes']]) {
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
    assert.equal(comparisons[name].changedPixels, 0, `${name} is visually unchanged by the portfolio tab`);
    await page.context().close();
  }
  checks.push('Overview and Financial screenshots unchanged; all 12 protected files retain original hashes');
  }

  const portfolioReady = async page => {
    await page.getByRole('heading', { name: 'Project Portfolio', exact: true }).waitFor();
    await page.getByTestId('portfolio-outcomes').waitFor();
  };
  const openPortfolio = async (options = {}) => {
    const state = await newPage({ ...options, route: '/executive?tab=portfolio' });
    if (!options.loading && (!options.status || options.status === 200)) await portfolioReady(state.page);
    return state;
  };
  const rows = page => page.locator('[data-testid^="portfolio-project-"]');
  const actionRows = page => page.locator('[data-testid^="portfolio-action-"]');
  const openRegisterTools = async (page, filters = false) => {
    const all = page.getByRole('button', { name: 'All projects', exact: true });
    if (await all.count()) await all.click();
    const filter = page.getByRole('button', { name: 'Filter projects', exact: true });
    if (filters && await filter.getAttribute('aria-expanded') !== 'true') await filter.click();
  };
  const unknownOutcomes = async page => {
    for (const id of ['forecast_margin', 'schedule_confidence', 'revenue_remaining']) assert.equal(await page.getByTestId(`portfolio-kpi-${id}`).locator('.pp-outcome-value').innerText(), '—');
  };
  const { page } = await openPortfolio();
  assert.equal(await page.locator('[data-testid^="portfolio-kpi-"]').count(), 5);
  assert.equal(await page.getByRole('tab', { name: 'Project portfolio', exact: true }).getAttribute('aria-selected'), 'true');
  assert.equal(await page.getByRole('combobox', { name: 'Financial reporting currency' }).count(), 0);
  assert.equal(await page.locator('.pp-intervention-banner').count(), 0, 'Full-width intervention banner is removed');
  const launcher = page.getByTestId('portfolio-intervention-launcher');
  assert.equal(await launcher.innerText(), '7 interventions', 'Floating count comes from the report');
  await unknownOutcomes(page);
  for (const width of [1672, 1440, 1024, 390]) {
    await assertGeometry(page, width);
    const floating = await launcher.boundingBox();
    const viewport = page.viewportSize();
    const inset = width <= 640 ? 12 : 20;
    assert.equal(await launcher.evaluate(node => getComputedStyle(node).position), 'fixed');
    assert.ok(Math.abs(viewport.width - floating.x - floating.width - inset) < 2, 'Interventions float against the right safe edge');
    assert.ok(Math.abs(viewport.height - floating.y - floating.height - inset) < 2, 'Interventions float against the bottom safe edge');
    assert.ok(floating.height >= 44 && floating.width < 300 && floating.x >= 0, 'Floating control is compact and has a usable target');
    const graphics = page.locator('.pp-kpi-graphic');
    assert.equal(await graphics.count(), 5, 'Each portfolio outcome has a mini chart');
    for (const [index, graphic] of (await graphics.all()).entries()) {
      assert.equal(await graphic.isVisible(), true, `Mini chart ${index + 1} is visible at ${width}px`);
      const svg = graphic.locator('svg');
      const box = await svg.boundingBox();
      assert.ok(box.width > 30 && box.height > 20, `Mini chart ${index + 1} retains useful dimensions at ${width}px`);
      const card = await graphic.locator('xpath=ancestor::*[starts-with(@data-testid, "portfolio-kpi-")]').boundingBox();
      assert.ok(box.x + box.width / 2 > card.x + card.width / 2, 'Mini charts remain right aligned within their cards');
      assert.equal(await graphic.locator('.pp-kpi-graphic-caption').innerText(), 'Illustrative', 'Missing histories are visibly identified as illustrations');
      assert.equal(await graphic.locator('.pp-kpi-graphic-caption').isVisible(), true);
      assert.match(await svg.locator('title').textContent(), /illustrative reference graphic, not historical data/i);
      if (index === 0) assert.ok(await svg.locator('rect').count() > 1, 'Active projects uses a bar mini chart');
      else {
        assert.ok(await svg.locator('path[stroke]').count() > 0, 'Other portfolio outcomes use line mini charts');
        assert.ok(await svg.locator('path[fill^="url"]').count() > 0, 'Line mini charts include the reference area fill');
      }
    }
    if (width === 1672) {
      const outlook = await page.getByTestId('portfolio-delivery-outlook').boundingBox();
      const health = await page.getByTestId('portfolio-health-summary').boundingBox();
      const outcomes = await page.getByTestId('portfolio-outcomes').boundingBox();
      const register = await page.getByTestId('portfolio-register').boundingBox();
      const decisions = await page.locator('.pp-interventions-panel').boundingBox();
      const trend = await page.getByTestId('portfolio-margin-schedule').boundingBox();
      const capacity = await page.getByTestId('portfolio-delivery-capacity').boundingBox();
      assert.ok(outlook.width / (outlook.width + health.width) >= .54 && outlook.width / (outlook.width + health.width) <= .60, 'Portfolio uses the reference 57/43 paired layout');
      assert.ok(Math.abs(outlook.y - health.y) < 3 && health.x >= outlook.x + outlook.width, 'Delivery outlook and health share the first content row');
      assert.ok(outcomes.width >= outlook.width + health.width, 'Five KPI cards span the full content width');
      assert.ok(outlook.y >= outcomes.y + outcomes.height && outlook.y - outcomes.y - outcomes.height < 20, 'Charts follow KPI cards without the old intervention strip');
      assert.ok(register.y >= outlook.y + outlook.height && Math.abs(register.y - decisions.y) < 3, 'Intervention register and decisions share the second row');
      assert.ok(trend.y >= register.y + register.height && Math.abs(trend.y - capacity.y) < 3, 'Historical trend and capacity share the third row');
      const cards = await page.locator('[data-testid^="portfolio-kpi-"]').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().y));
      assert.ok(cards.every(y => Math.abs(y - cards[0]) < 1), 'All five cards align on the desktop row');
    }
    await capture(page, `portfolio-${width}`);
    if (width === 1672) await page.getByTestId('portfolio-outcomes').screenshot({ path: path.join(artifacts, 'portfolio-kpi-row.png') });
    if (width === 390) {
      const result = await new AxeBuilder({ page }).include('main.main-content').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      if (result.violations.length) accessibilityIssues.push({ mode: 'mobile', violations: result.violations });
    }
  }
  await assertGeometry(page, 1672);
  checks.push('Five outcomes and 57/43 paired content rows retain their layout; compact interventions control floats bottom-right at 1672/1440/1024/390 widths');
  checks.push('All five right-aligned mini charts remain visible at every viewport: one bar chart, four line/area charts, and explicit illustrative captions for unavailable histories');

  if (process.argv.includes('--portfolio-visuals-only')) {
    for (const [mode, dark] of [['light', false], ['dark', true]]) {
      const state = await openPortfolio({ dark });
      await assertGeometry(state.page, 1672);
      await capture(state.page, `portfolio-${mode}`);
      const result = await new AxeBuilder({ page: state.page }).include('main.main-content').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      if (result.violations.length) accessibilityIssues.push({ mode, violations: result.violations });
      await state.page.context().close();
    }
    await checkProtectedFiles();
    await writeFile(path.join(artifacts, 'accessibility.json'), JSON.stringify(accessibilityIssues, null, 2));
    assert.deepEqual(accessibilityIssues, [], 'Portfolio responsive light/dark accessibility');
    checks.push('Final desktop/mobile layout and light/dark WCAG scans; protected sources unchanged');
    await writeFile(path.join(artifacts, 'checks.json'), JSON.stringify({ checks, mode: 'portfolio_visuals_only', protectedHashesUnchanged: true }, null, 2));
    await page.context().close();
    for (const check of checks) console.log(`PASS portfolio: ${check}`);
    return;
  }

  const register = page.getByTestId('portfolio-register');
  assert.equal(await page.getByRole('button', { name: 'Filter projects', exact: true }).getAttribute('aria-expanded'), 'false');
  assert.match(await register.getByRole('heading').innerText(), /requiring intervention/);
  await openRegisterTools(page, true);
  const search = page.getByRole('searchbox', { name: 'Search portfolio', exact: true });
  const health = page.getByRole('combobox', { name: 'Portfolio health', exact: true });
  const owner = page.getByRole('combobox', { name: 'Portfolio project owner', exact: true });
  const pageSize = page.getByRole('combobox', { name: 'Projects per page', exact: true });
  assert.equal(await page.getByRole('combobox', { name: 'Portfolio business unit', exact: true }).isDisabled(), true);
  assert.equal(await page.getByRole('combobox', { name: 'Portfolio project phase', exact: true }).isDisabled(), true);
  assert.equal(await rows(page).count(), 5);
  assert.equal(await page.getByRole('button', { name: 'Previous project page', exact: true }).isDisabled(), true);
  const firstPage = await rows(page).evaluateAll(nodes => nodes.map(node => node.dataset.testid));
  await page.getByRole('button', { name: 'Next project page', exact: true }).click();
  const secondPage = await rows(page).evaluateAll(nodes => nodes.map(node => node.dataset.testid));
  assert.equal(firstPage.some(id => secondPage.includes(id)), false);
  await page.getByRole('button', { name: 'Project page 3', exact: true }).click();
  assert.equal(await rows(page).count(), 3);
  assert.equal(await page.getByRole('button', { name: 'Next project page', exact: true }).isDisabled(), true);
  await search.fill('PRJ-001');
  assert.equal(await rows(page).count(), 1);
  assert.equal(await page.getByTestId('portfolio-project-portfolio-1').count(), 1);
  await search.fill('nOrThErN uTiLiTy');
  assert.equal(await rows(page).count(), 5, 'Search matches clients without case sensitivity');
  await search.fill('');
  await health.selectOption('critical');
  assert.equal(await rows(page).count(), 3);
  await owner.selectOption('Taylor Chen');
  assert.match(await register.innerText(), /No projects match these filters/);
  await owner.selectOption('Alex Morgan');
  assert.equal(await rows(page).count(), 3);
  await health.selectOption('all');
  assert.equal(await rows(page).count(), 5);
  await owner.selectOption('Unassigned');
  assert.equal(await rows(page).count(), 1);
  assert.equal(await page.getByTestId('portfolio-project-portfolio-2').count(), 1);
  await owner.selectOption('all');
  await pageSize.selectOption('20');
  assert.equal(await rows(page).count(), 13);
  await register.getByRole('button', { name: 'Project', exact: true }).click();
  const names = await rows(page).locator('th').allTextContents();
  assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b)));
  assert.equal(await register.getByRole('columnheader', { name: 'Project', exact: true }).getAttribute('aria-sort'), 'ascending');
  await register.getByRole('button', { name: 'Project', exact: true }).click();
  assert.deepEqual(await rows(page).locator('th').allTextContents(), [...names].reverse());
  await register.getByRole('button', { name: 'Contract value', exact: true }).click();
  const sortedIds = await rows(page).evaluateAll(nodes => nodes.map(node => node.dataset.testid.replace('portfolio-project-', '')));
  const expected = [...reportFixture().portfolio_performance.register.projects].sort((a, b) => a.currency.localeCompare(b.currency) || Number(a.contract_value) - Number(b.contract_value));
  assert.deepEqual(sortedIds, expected.map(row => row.id), 'Contract amount sorting groups original currencies');
  await register.getByRole('button', { name: 'Progress', exact: true }).click();
  assert.equal(await rows(page).first().getAttribute('data-testid'), 'portfolio-project-portfolio-1');
  assert.equal(await rows(page).last().getAttribute('data-testid'), 'portfolio-project-portfolio-2', 'Missing progress sorts after genuine zero');
  const zeroProgress = page.getByTestId('portfolio-project-portfolio-1').getByRole('progressbar');
  assert.equal(await zeroProgress.getAttribute('aria-valuenow'), '0');
  assert.equal(await page.getByTestId('portfolio-project-portfolio-2').getByRole('progressbar').count(), 0);
  checks.push('Real register search/client/code filtering, health/owner intersection, disabled unknown phase/business unit, pagination and currency-aware sorting');

  const contractText = await page.getByTestId('portfolio-kpi-contract_value').locator('.pp-outcome-value').innerText();
  assert.match(contractText, /AED/); assert.doesNotMatch(contractText, /USD/);
  const projectCurrency = page.getByRole('combobox', { name: 'Portfolio reporting currency', exact: true });
  const currencyRowsBefore = await rows(page).evaluateAll(nodes => nodes.map(node => node.dataset.testid));
  await projectCurrency.selectOption('USD');
  assert.match(await page.getByTestId('portfolio-kpi-contract_value').locator('.pp-outcome-value').innerText(), /USD 3\.9M/i);
  assert.deepEqual(await rows(page).evaluateAll(nodes => nodes.map(node => node.dataset.testid)), currencyRowsBefore, 'Amount currency selector does not filter the original-currency project register');
  await projectCurrency.selectOption('AED');
  assert.equal(await page.getByTestId('portfolio-kpi-active_projects').locator('.pp-outcome-value').innerText(), '7');
  for (const row of await rows(page).all()) {
    assert.equal(await row.locator('td').nth(3).innerText(), '—', 'Schedule variances remain unknown');
    assert.equal(await row.locator('td').nth(4).innerText(), '—', 'Forecast margins remain unknown');
  }
  assert.match(await page.getByTestId('portfolio-project-portfolio-4').innerText(), /No exceptions/);
  assert.doesNotMatch(await page.getByTestId('project-portfolio').innerText(), /On track|NaN|Infinity|undefined/);
  assert.match(await page.getByTestId('portfolio-delivery-capacity').innerText(), /not connected|unavailable/i);
  assert.match(await page.getByTestId('portfolio-delivery-outlook').innerText(), /Awaiting approved margin and schedule reports/);
  assert.match(await page.getByTestId('portfolio-margin-schedule').innerText(), /Awaiting approved monthly margin and schedule reports/);
  assert.equal(await page.locator('.ppr-chart-mark').count(), 0, 'Unavailable source charts contain no invented project positions or historical points');
  assert.equal(await page.getByTestId('portfolio-health-count-critical').locator('strong').innerText(), '3');
  assert.equal(await page.getByTestId('portfolio-health-count-unknown').locator('strong').innerText(), '2');
  assert.equal(await page.getByTestId('portfolio-health-count-review').locator('strong').innerText(), '6', 'Needs review combines high, medium and low without double counting');
  const distribution = await page.locator('.pp-health-segment').evaluateAll(nodes => nodes.map(node => parseFloat(node.getAttribute('stroke-dasharray'))));
  assert.ok(Math.abs(distribution.reduce((sum, number) => sum + number, 0) - 100) < .01);
  assert.match(await page.getByTestId('portfolio-health-cause-governance').getAttribute('title'), /7 projects/);
  await page.locator('.pp-health-details > summary').click();
  assert.equal(await page.getByTestId('portfolio-side-metric-revenue_at_risk').locator('strong').innerText(), '—');
  await page.locator('.pp-additional-details > summary').click();
  assert.match(await page.getByTestId('portfolio-concentration-USD').innerText(), /100%/);
  assert.equal(await page.locator('[data-testid^="portfolio-milestone-"]').count(), 3);
  await page.getByRole('button', { name: 'View returned milestones', exact: true }).click();
  assert.equal(await page.locator('[data-testid^="portfolio-milestone-"]').count(), 4);
  assert.equal(await page.getByTestId('portfolio-milestone-milestone-1').locator('td').nth(2).innerText(), '—', 'Milestone readiness is not fabricated from target date');
  await page.getByTestId('portfolio-milestones').getByRole('button', { name: 'Show top 3', exact: true }).click();
  checks.push('Original currencies, actual active count and zero progress; financial forecast, schedule, phase and capacity gaps never become invented values');

  const explain = page.getByRole('button', { name: 'About Total contract value', exact: true });
  await explain.click();
  const dialog = page.getByRole('dialog');
  await dialog.waitFor();
  assert.match(await dialog.innerText(), /Synthetic authorized project register/);
  for (const key of ['Tab', 'Shift+Tab']) { await page.keyboard.press(key); assert.equal(await dialog.evaluate(node => node.contains(document.activeElement)), true); }
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'hidden' });
  assert.equal(await explain.evaluate(node => node === document.activeElement), true);
  await explain.click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(350);
  await capture(page, 'portfolio-definitions-mobile');
  assert.equal(await dialog.evaluate(node => node.getBoundingClientRect().right <= innerWidth), true);
  await page.getByRole('button', { name: 'Close definitions', exact: true }).click();
  await assertGeometry(page, 1672);
  await page.getByRole('button', { name: 'Review interventions', exact: true }).click();
  assert.equal(await page.getByTestId('portfolio-decisions').evaluate(node => node === document.activeElement), true);
  const floatingBeforeScroll = await launcher.boundingBox();
  await page.locator('.cc-command-center').evaluate(node => node.scrollTo({ top: node.scrollHeight, behavior: 'instant' }));
  const floatingAfterScroll = await launcher.boundingBox();
  assert.ok(Math.abs(floatingBeforeScroll.y - floatingAfterScroll.y) < 1, 'Floating control remains available while the board scrolls');
  await launcher.focus();
  await launcher.press('Enter');
  assert.equal(await page.getByTestId('portfolio-decisions').evaluate(node => node === document.activeElement), true, 'Keyboard activation focuses the existing interventions section');
  assert.equal(await actionRows(page).count(), 3);
  await page.getByRole('button', { name: 'Show 7 interventions', exact: true }).click();
  assert.equal(await actionRows(page).count(), 7);
  await page.getByRole('button', { name: 'Show top 3 interventions', exact: true }).click();
  await page.getByTestId('portfolio-action-portfolio-action-1').getByRole('button').click();
  await dialog.waitFor();
  assert.match(await dialog.innerText(), /confirm the accountable next action/);
  await page.getByRole('button', { name: 'Close definitions', exact: true }).click();
  await page.getByTestId('portfolio-project-portfolio-1').getByRole('link', { name: 'Review', exact: true }).click();
  await page.waitForFunction(() => window.executiveRoute === '/projects?project=portfolio-1&view=dashboard');
  await page.evaluate(() => window.executiveNavigate('/executive?tab=portfolio'));
  await portfolioReady(page);
  await page.getByTestId('portfolio-milestone-milestone-1').getByRole('link', { name: 'Open milestone Design review', exact: true }).click();
  await page.waitForFunction(() => window.executiveRoute === '/projects?project=portfolio-1&view=plan-baseline');
  await page.evaluate(() => window.executiveNavigate('/executive?tab=portfolio'));
  await portfolioReady(page);
  await page.reload();
  await portfolioReady(page);
  await openRegisterTools(page, true);
  checks.push('Definition focus/Escape/mobile containment, action expansion/context, intervention focus shortcut, authorized project links and persistent portfolio route');

  await search.fill('PRJ-001');
  assert.equal(await rows(page).count(), 1);
  await page.getByRole('button', { name: 'Export board report', exact: true }).click();
  const printed = await page.evaluate(() => window.executivePrintSnapshot);
  assert.equal(printed.title, 'Project Portfolio');
  assert.equal(printed.portfolioProjects.length, 13);
  assert.equal(printed.portfolioExceptions.length, 7);
  assert.equal(printed.actions.length, 0);
  assert.equal(printed.financialActions.length, 0);
  assert.equal(printed.notesOpen, true);
  assert.equal(await rows(page).count(), 1);
  assert.equal(await search.inputValue(), 'PRJ-001');
  assert.equal(await page.locator('#application-sidebar').isVisible(), true);
  await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
  await page.emulateMedia({ media: 'print' });
  assert.equal(await launcher.count(), 0, 'Floating interventions control is omitted from print');
  await capture(page, 'portfolio-board-print', true);
  await page.pdf({ path: path.join(artifacts, 'portfolio-board-report.pdf'), format: 'A4', preferCSSPageSize: true, printBackground: true });
  await page.emulateMedia({ media: 'screen' });
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  await portfolioReady(page);
  assert.equal(await rows(page).count(), 1);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export snapshot', exact: true }).click();
  assert.deepEqual(JSON.parse(await readFile(await (await downloadPromise).path(), 'utf8')), reportFixture());
  await search.fill('');
  checks.push('Portfolio print exports all returned projects/interventions, preserves filters/sidebar, uses CSS landscape and exports exact API snapshot');

  for (const mode of ['light', 'dark']) {
    await page.evaluate(dark => document.documentElement.classList.toggle('dark', dark), mode === 'dark');
    await capture(page, `portfolio-${mode}`);
    const result = await new AxeBuilder({ page }).include('main.main-content').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    if (result.violations.length) accessibilityIssues.push({ mode, violations: result.violations });
  }

  for (const fixture of ['portfolio-zero', 'portfolio-zero-contract', 'portfolio-incomplete', 'portfolio-missing', 'portfolio-restricted', 'portfolio-error', 'portfolio-health-error', 'portfolio-health-partial', 'portfolio-milestone-error', 'portfolio-unavailable', 'portfolio-truncated']) {
    const state = await openPortfolio({ fixture });
    await openRegisterTools(state.page);
    await state.page.locator('.pp-additional-details > summary').click();
    await unknownOutcomes(state.page);
    assert.doesNotMatch(await state.page.getByTestId('project-portfolio').innerText(), /NaN|Infinity|undefined/);
    if (fixture === 'portfolio-zero') {
      assert.equal(await state.page.getByTestId('portfolio-intervention-launcher').innerText(), '0 interventions', 'A reported zero stays zero');
      assert.equal(await state.page.getByTestId('portfolio-kpi-active_projects').locator('.pp-outcome-value').innerText(), '0');
      assert.equal(await state.page.getByTestId('portfolio-kpi-contract_value').locator('.pp-outcome-value').innerText(), '—');
      assert.equal(await rows(state.page).count(), 0);
      assert.match(await state.page.getByTestId('portfolio-register').innerText(), /No projects in scope/);
      assert.equal(await state.page.getByTestId('portfolio-health-count-critical').locator('strong').innerText(), '0');
      assert.equal(await state.page.locator('.pp-health-segment').count(), 0);
      assert.match(await state.page.getByTestId('portfolio-milestones').innerText(), /No milestones requiring attention/);
    }
    if (fixture === 'portfolio-incomplete') {
      const kpi = state.page.getByTestId('portfolio-kpi-contract_value');
      assert.equal(await kpi.locator('.pp-outcome-value').innerText(), '—');
      assert.match(await kpi.innerText(), /Contract data incomplete/);
      assert.equal(await state.page.getByRole('combobox', { name: 'Portfolio reporting currency', exact: true }).inputValue(), 'AED', 'Incomplete amount remains withheld in the selected original currency');
      await state.page.getByRole('combobox', { name: 'Portfolio reporting currency', exact: true }).selectOption('USD');
      assert.match(await kpi.locator('.pp-outcome-value').innerText(), /USD/);
      assert.doesNotMatch(await kpi.locator('.pp-outcome-value').innerText(), /AED|UNSPECIFIED/);
      await state.page.getByRole('combobox', { name: 'Portfolio reporting currency', exact: true }).selectOption('AED');
      assert.equal(await state.page.getByTestId('portfolio-project-portfolio-1').locator('td').nth(1).innerText(), '—');
      assert.deepEqual(await state.page.getByTestId('portfolio-concentration-AED').locator('td').allTextContents(), ['—', '—', '—']);
      assert.match(await state.page.getByTestId('portfolio-concentration-USD').innerText(), /100%/);
      assert.equal(await state.page.getByTestId('portfolio-concentration-incomplete').count(), 1);
      await state.page.getByRole('combobox', { name: 'Projects per page', exact: true }).selectOption('20');
      assert.match(await state.page.getByTestId('portfolio-project-portfolio-3').locator('td').nth(1).innerText(), /UNSPECIFIED/);
    }
    if (fixture === 'portfolio-zero-contract') {
      const amounts = await state.page.getByTestId('portfolio-kpi-contract_value').locator('.pp-outcome-value').innerText();
      assert.equal(amounts, 'AED 0');
      await state.page.getByRole('combobox', { name: 'Portfolio reporting currency', exact: true }).selectOption('USD');
      assert.equal(await state.page.getByTestId('portfolio-kpi-contract_value').locator('.pp-outcome-value').innerText(), 'USD 0');
      await state.page.getByRole('combobox', { name: 'Portfolio reporting currency', exact: true }).selectOption('AED');
      assert.equal(await state.page.getByTestId('portfolio-project-portfolio-1').locator('td').nth(1).innerText(), 'AED 0');
      assert.deepEqual(await state.page.getByTestId('portfolio-concentration-AED').locator('td').allTextContents(), ['—', '—', '—'], 'Zero denominator does not become a percentage share');
    }
    if (fixture === 'portfolio-health-error') {
      assert.equal(await state.page.getByTestId('portfolio-intervention-launcher').innerText(), 'Interventions · Unavailable');
      assert.equal(await rows(state.page).count(), 5, 'Register stays available when the exception source fails');
      assert.match(await state.page.getByTestId('portfolio-decisions').innerText(), /source unavailable/i);
      assert.match(await state.page.getByTestId('portfolio-health-summary').innerText(), /Project source unavailable/);
      assert.equal(await state.page.getByTestId('portfolio-health-bar').count(), 0);
    }
    if (fixture === 'portfolio-health-partial') {
      assert.equal(await state.page.getByTestId('portfolio-intervention-launcher').innerText(), 'Interventions · Incomplete');
      assert.equal(await rows(state.page).count(), 5);
      assert.match(await state.page.getByTestId('portfolio-decisions').innerText(), /Exception coverage incomplete/);
      assert.match(await state.page.getByTestId('portfolio-decisions').innerText(), /do not establish the portfolio total/);
      assert.equal(await state.page.getByTestId('portfolio-health-count-unknown').locator('strong').innerText(), '13');
    }
    if (fixture === 'portfolio-milestone-error') {
      assert.equal(await rows(state.page).count(), 5);
      assert.match(await state.page.getByTestId('portfolio-milestones').innerText(), /Project source unavailable/);
      assert.equal(await state.page.locator('[data-testid^="portfolio-milestone-"]').count(), 0);
    }
    if (fixture === 'portfolio-missing') {
      assert.equal(await state.page.getByTestId('portfolio-kpi-active_projects').locator('.pp-outcome-value').innerText(), '5', 'Legacy fallback uses actual recorded active count');
      assert.match(await state.page.getByTestId('portfolio-register').innerText(), /3 of 8 projects/, 'Legacy preview explicitly discloses its partial register coverage');
    }
    if (['portfolio-restricted', 'portfolio-error', 'portfolio-unavailable'].includes(fixture)) {
      const text = await state.page.getByTestId('portfolio-intervention-launcher').innerText();
      assert.equal(text, fixture === 'portfolio-restricted' ? 'Interventions · Restricted' : fixture === 'portfolio-error' ? 'Interventions · Unavailable' : 'Interventions · Not reported');
      assert.doesNotMatch(text, /0 interventions/, 'Unavailable counts never become zero');
      assert.equal(await rows(state.page).count(), 0);
      assert.equal(await actionRows(state.page).count(), 0);
      assert.equal(await state.page.getByTestId('portfolio-kpi-active_projects').locator('.pp-outcome-value').innerText(), '—');
      assert.equal(await state.page.getByTestId('portfolio-register').getByRole('link').count(), 0);
      assert.match(await state.page.getByTestId('portfolio-register').innerText(), fixture === 'portfolio-restricted' ? /Project access required/ : fixture === 'portfolio-error' ? /Project source unavailable/ : /Project register not connected/);
      if (fixture !== 'portfolio-unavailable') assert.match(await state.page.getByTestId('portfolio-decisions').innerText(), fixture === 'portfolio-restricted' ? /Project access required/ : /Project source unavailable/);
    }
    if (fixture === 'portfolio-truncated') {
      assert.equal(await state.page.getByTestId('portfolio-intervention-launcher').innerText(), '87 interventions', 'Floating count uses the full reported total, not the returned preview');
      assert.match(await state.page.getByTestId('portfolio-register').innerText(), /13 of 213 projects/);
      assert.match(await state.page.getByTestId('portfolio-decisions').innerText(), /7 of 87/);
      await state.page.getByRole('button', { name: 'Export board report', exact: true }).click();
      assert.match(await state.page.evaluate(() => window.executivePrintSnapshot.portfolioText), /13 of 213 projects/);
      assert.match(await state.page.evaluate(() => window.executivePrintSnapshot.portfolioText), /7 of 87/);
    }
    await capture(state.page, fixture);
    await state.page.context().close();
  }
  checks.push('Available empty source preserves zero, incomplete currency totals withheld, old DTO fallback, restricted/error/unavailable sources and truncated register/actions disclosures');

  const loading = await openPortfolio({ loading: true });
  assert.equal(await loading.page.getByTestId('project-portfolio').count(), 0);
  await capture(loading.page, 'portfolio-loading');
  await loading.control.release();
  await portfolioReady(loading.page);
  for (const status of [403, 503]) {
    const state = await openPortfolio({ status });
    await state.page.getByRole('alert').waitFor();
    assert.equal(await state.page.getByTestId('project-portfolio').count(), 0);
    await capture(state.page, `portfolio-error-${status}`);
    state.control.status = 200;
    await state.page.getByRole('button', { name: 'Try again', exact: true }).click();
    await portfolioReady(state.page);
    await state.page.context().close();
  }
  checks.push('Portfolio light/dark accessibility, loading, 403/service errors and retry recovery');
  await checkProtectedFiles();
  await writeFile(path.join(artifacts, 'accessibility.json'), JSON.stringify(accessibilityIssues, null, 2));
  assert.deepEqual(accessibilityIssues, [], 'Portfolio contrast and accessible controls');
  await writeFile(path.join(artifacts, 'checks.json'), JSON.stringify({ checks, comparisons, comparisonMode: verification?.comparisonMode || (verification ? "tabs_polish_guard" : "historical_snapshot"), protectedHashesUnchanged: true }, null, 2));
  console.log('PASS portfolio: ' + checks.join('; ') + '.');
  console.log('Portfolio artifacts: ' + artifacts);
}
