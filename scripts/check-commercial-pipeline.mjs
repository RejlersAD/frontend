import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { loadSnapshot } from './ui-check-support.mjs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import AxeBuilder from '@axe-core/playwright';

// Fourth executive tab, reusing the intercepted real-shell browser harness.
export async function runCommercialPipelineChecks({ frontend, newPage, assertGeometry, reportFixture, verification }) {
  const artifacts = verification?.artifacts || path.resolve(frontend, '../artifacts/commercial-pipeline');
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
  ];
  let checkProtectedFiles = verification?.assertProtected;
  if (!verification) {
  const baselinePath = path.join(artifacts, 'protected-baseline-sha256.json');
  const baseline = await loadSnapshot(frontend, baselinePath);
  checkProtectedFiles = async () => {
    assert.equal(baseline.length, protectedFiles.length, 'Sidebar and all three completed tabs were captured before commercial work');
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
  for (const [name, route, readyId] of [['overview', '/executive', 'executive-outcomes'], ['financial', '/executive?tab=financial', 'financial-outcomes'], ['portfolio', '/executive?tab=portfolio', 'portfolio-outcomes']]) {
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
    assert.equal(comparisons[name].changedPixels, 0, `${name} is visually unchanged by the commercial tab`);
    await page.context().close();
  }
  checks.push('Overview, Financial and Portfolio screenshots unchanged; all 16 protected files retain original hashes');
  }

  const commercialReady = async page => {
    await page.getByRole('heading', { name: 'Commercial Pipeline', exact: true }).waitFor();
    await page.getByTestId('commercial-outcomes').waitFor();
  };
  const openCommercial = async (options = {}) => {
    const state = await newPage({ ...options, route: '/executive?tab=commercial' });
    if (!options.loading && (!options.status || options.status === 200)) await commercialReady(state.page);
    return state;
  };
  const rowSelector = '[data-testid^="commercial-opportunity-"]';
  const actionSelector = '[data-testid^="commercial-action-"]';
  const bidSelector = 'tr[data-testid^="commercial-bid-"]';
  const rows = page => page.locator(rowSelector);
  const kpi = (page, id) => page.getByTestId(`commercial-kpi-${id}`).locator('.cp-outcome-value');
  const { page } = await openCommercial();
  const currency = page.getByRole('combobox', { name: 'Commercial reporting currency', exact: true });
  assert.equal(await currency.inputValue(), 'AED');
  assert.equal(await page.getByRole('tab', { name: 'Commercial pipeline', exact: true }).getAttribute('aria-selected'), 'true');
  assert.equal(await page.locator('[data-testid^="commercial-kpi-"]').count(), 5);
  assert.equal(await kpi(page, 'framework_backlog').innerText(), '—');
  for (const width of [1672, 1440, 1024, 390]) {
    await assertGeometry(page, width);
    assert.equal(await page.locator('.cc-command-center').evaluate(node => node.scrollWidth <= node.clientWidth + 1), true, `Commercial content fits at ${width}`);
    if (width === 1672) {
      const outcomes = await page.getByTestId('commercial-outcomes').boundingBox();
      const main = await page.getByTestId('commercial-main-column').boundingBox();
      const right = await page.getByTestId('commercial-right-column').boundingBox();
      assert.ok(outcomes.width > main.width + right.width, 'Five outcomes span both reference columns');
      assert.ok(Math.abs(main.y - right.y) < 3 && main.y >= outcomes.y + outcomes.height);
      assert.ok(main.width / (main.width + right.width) >= .62 && main.width / (main.width + right.width) <= .76);
      const boxes = await Promise.all(['commercial-decisions', 'commercial-register', 'commercial-pipeline-outlook'].map(id => page.getByTestId(id).boundingBox()));
      assert.ok(boxes.every((box, index) => !index || box.y >= boxes[index - 1].y + boxes[index - 1].height));
      const movement = await page.getByTestId('commercial-pipeline-movement').boundingBox();
      assert.ok(movement.x >= boxes[2].x + boxes[2].width && Math.abs(movement.y - boxes[2].y) < 3);
      assert.equal(await page.getByTestId('commercial-register').locator('thead button').evaluateAll(nodes => nodes.every(node => node.scrollWidth <= node.clientWidth + 1)), true, 'Register headers fit without splitting words');
    }
    if (width === 390) {
      const selectedTab = await page.getByRole('tab', { name: 'Commercial pipeline', exact: true }).boundingBox();
      const tabStrip = await page.locator('.cc-tabs').boundingBox();
      assert.ok(selectedTab.x >= tabStrip.x && selectedTab.x + selectedTab.width <= tabStrip.x + tabStrip.width, 'Commercial deep link keeps its active mobile tab fully visible');
    }
    await capture(page, `commercial-${width}`);
  }
  await assertGeometry(page, 1672);
  checks.push('Full-width five outcomes and reference panel order; 1672/1440/1024/390 layouts preserve the existing sidebar');

  const register = page.getByTestId('commercial-register');
  const search = page.getByRole('searchbox', { name: 'Search opportunities', exact: true });
  const stage = page.getByRole('combobox', { name: 'Commercial stage', exact: true });
  const client = page.getByRole('combobox', { name: 'Commercial client', exact: true });
  const owner = page.getByRole('combobox', { name: 'Commercial opportunity owner', exact: true });
  const size = page.getByRole('combobox', { name: 'Opportunities per page', exact: true });
  assert.equal(await page.getByRole('combobox', { name: 'Commercial business unit', exact: true }).isDisabled(), true);
  assert.equal(await rows(page).count(), 5);
  assert.match(await register.innerText(), /14 open opportunities/);
  assert.equal(await page.getByRole('button', { name: 'Previous opportunity page', exact: true }).isDisabled(), true);
  const firstPage = await rows(page).evaluateAll(nodes => nodes.map(node => node.dataset.testid));
  await page.getByRole('button', { name: 'Next opportunity page', exact: true }).click();
  assert.equal((await rows(page).evaluateAll(nodes => nodes.map(node => node.dataset.testid))).some(id => firstPage.includes(id)), false);
  await page.getByRole('button', { name: 'Opportunity page 3', exact: true }).click();
  assert.equal(await rows(page).count(), 4);
  assert.equal(await page.getByRole('button', { name: 'Next opportunity page', exact: true }).isDisabled(), true);
  await search.fill('OPP-001');
  assert.equal(await rows(page).count(), 1);
  assert.equal(await page.getByTestId('commercial-opportunity-commercial-1').count(), 1);
  await size.selectOption('20');
  await search.fill('nOrThErN uTiLiTy');
  assert.equal(await rows(page).count(), 7);
  await search.fill('');
  await stage.selectOption('proposal');
  assert.equal(await rows(page).count(), 4);
  await client.selectOption('client-1');
  await owner.selectOption('Sam Reed');
  assert.match(await register.innerText(), /No opportunities match these filters/);
  await owner.selectOption('Alex Morgan');
  assert.equal(await rows(page).count(), 4);
  await stage.selectOption('all'); await client.selectOption('all'); await owner.selectOption('Unassigned');
  assert.equal(await rows(page).count(), 1);
  await owner.selectOption('all');
  await register.getByRole('button', { name: 'Opportunity', exact: true }).click();
  const names = await rows(page).locator('th').allTextContents();
  assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b)));
  await register.getByRole('button', { name: 'Opportunity', exact: true }).click();
  assert.deepEqual(await rows(page).locator('th').allTextContents(), [...names].reverse());
  await register.getByRole('button', { name: 'Unweighted value', exact: true }).click();
  assert.equal(await rows(page).first().getAttribute('data-testid'), 'commercial-opportunity-commercial-1');
  await register.getByRole('button', { name: 'Unweighted value', exact: true }).click();
  assert.equal(await rows(page).first().getAttribute('data-testid'), 'commercial-opportunity-commercial-20');
  checks.push('Selected-currency register pagination, client/reference search, intersecting stage/client/owner filters and real sorting; unrecorded business unit stays disabled');

  assert.equal(await kpi(page, 'qualified_pipeline').innerText(), 'AED 25.7m');
  assert.equal(await kpi(page, 'weighted_pipeline').innerText(), 'AED 13.3m');
  assert.equal(await kpi(page, 'win_rate').innerText(), '62.5%');
  assert.equal(await kpi(page, 'proposals_due_30d').innerText(), '6');
  assert.equal(await page.getByTestId('commercial-won-handoff').locator('b').innerText(), '2');
  const globalDecisions = await page.locator(actionSelector).allTextContents();
  const globalQuality = await page.getByTestId('commercial-quality').innerText();
  await stage.selectOption('proposal');
  await owner.selectOption('Alex Morgan');
  await currency.selectOption('USD');
  assert.equal(await stage.inputValue(), 'all');
  assert.equal(await owner.inputValue(), 'all');
  assert.equal(await rows(page).count(), 6);
  assert.equal(await kpi(page, 'qualified_pipeline').innerText(), 'USD 4.7m');
  assert.equal(await kpi(page, 'weighted_pipeline').innerText(), 'USD 5.9m');
  assert.doesNotMatch(await register.locator('tbody').innerText(), /AED/);
  assert.equal(await kpi(page, 'win_rate').innerText(), '62.5%');
  assert.equal(await kpi(page, 'proposals_due_30d').innerText(), '6');
  assert.equal(await page.getByTestId('commercial-won-handoff').locator('b').innerText(), '2');
  assert.deepEqual(await page.locator(actionSelector).allTextContents(), globalDecisions);
  assert.equal(await page.getByTestId('commercial-quality').innerText(), globalQuality);
  assert.match(await page.getByTestId('commercial-concentration-total').innerText(), /USD/);
  assert.match(await page.getByTestId('commercial-client-concentration').innerText(), /100%/);
  await currency.selectOption('AED');
  assert.equal(await page.getByTestId('commercial-quality-invalid_probability').locator('strong').innerText(), '0');
  assert.match(await page.getByTestId('commercial-quality-invalid_probability').innerText(), /No recorded issues/);
  assert.match(await page.getByTestId('commercial-resource-demand').innerText(), /not connected/);
  assert.match(await page.getByTestId('commercial-pipeline-outlook').innerText(), /Award forecast not connected/);
  assert.match(await page.getByTestId('commercial-pipeline-movement').innerText(), /Pipeline movement not connected/);
  checks.push('Currency changes only currency-scoped values; global win rate/proposal targets/decisions/quality stay global, with no FX or invented forecasts');

  await search.fill('OPP-001');
  const probability = page.getByRole('button', { name: 'Probability evidence for North offshore framework', exact: true });
  assert.match(await probability.innerText(), /0%/);
  await probability.hover();
  const tooltip = page.getByRole('tooltip');
  await tooltip.waitFor();
  assert.match(await tooltip.innerText(), /normally assigned from the recorded stage/);
  assert.match(await tooltip.innerText(), /Scored evidence.*not connected/);
  await page.mouse.move(0, 0);
  await tooltip.waitFor({ state: 'hidden' });
  await probability.focus();
  await tooltip.waitFor();
  await page.keyboard.press('Escape');
  await tooltip.waitFor({ state: 'hidden' });
  await probability.click();
  const dialog = page.getByRole('dialog');
  await dialog.waitFor();
  assert.match(await dialog.innerText(), /stored CRM probability/i);
  assert.match(await dialog.innerText(), /Scored evidence.*not connected/);
  for (let index = 0; index < 4; index++) { await page.keyboard.press('Tab'); assert.equal(await dialog.evaluate(node => node.contains(document.activeElement)), true); }
  for (let index = 0; index < 4; index++) { await page.keyboard.press('Shift+Tab'); assert.equal(await dialog.evaluate(node => node.contains(document.activeElement)), true); }
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'hidden' });
  assert.equal(await probability.evaluate(node => node === document.activeElement), true);
  await probability.click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(350);
  await capture(page, 'commercial-probability-mobile');
  assert.equal(await dialog.evaluate(node => { const rect = node.getBoundingClientRect(); return rect.x >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight; }), true);
  await page.getByRole('button', { name: 'Close definitions', exact: true }).click();
  await probability.scrollIntoViewIfNeeded();
  await probability.hover();
  await tooltip.waitFor();
  assert.equal(await tooltip.evaluate(node => { const rect = node.getBoundingClientRect(); return rect.x >= 0 && rect.right <= innerWidth && rect.y >= 0 && rect.bottom <= innerHeight; }), true, 'Probability tooltip fits the mobile viewport');
  await page.mouse.move(0, 0);
  await assertGeometry(page, 1672);
  await search.fill('');
  assert.equal(await page.locator(bidSelector).count(), 3);
  assert.match(await page.getByTestId('commercial-bid-commercial-1').innerText(), /Target date passed/);
  assert.equal(await page.getByTestId('commercial-bid-commercial-1').locator('td').nth(2).innerText(), '—', 'Past target dates do not establish bid readiness');
  await page.getByRole('button', { name: 'View returned targets', exact: true }).click();
  assert.equal(await page.locator(bidSelector).count(), 4);
  await page.getByTestId('commercial-bid-calendar').getByRole('button', { name: 'Show top 3', exact: true }).click();
  await page.getByRole('button', { name: 'Show 7 decisions', exact: true }).click();
  assert.equal(await page.locator(actionSelector).count(), 7);
  await page.getByRole('button', { name: 'Show top 3 decisions', exact: true }).click();
  await page.getByTestId('commercial-action-commercial-action-1').getByRole('button').click();
  await dialog.waitFor();
  assert.match(await dialog.innerText(), /accountable opportunity owner/);
  await page.getByRole('button', { name: 'Close definitions', exact: true }).click();
  checks.push('Stored probability zero, truthful focus/hover evidence tooltip, keyboard-safe source dialog, target/readiness distinction and expanded decisions/calendar');

  await page.getByTestId('commercial-opportunity-commercial-1').getByRole('link', { name: 'Review', exact: true }).click();
  await page.waitForFunction(() => window.executiveRoute === '/sales/opportunities?record=commercial-1');
  await page.evaluate(() => window.executiveNavigate('/executive?tab=commercial'));
  await commercialReady(page);
  await page.getByTestId('commercial-bid-commercial-1').getByRole('link', { name: 'Open bid opportunity North offshore framework', exact: true }).click();
  await page.waitForFunction(() => window.executiveRoute === '/sales/opportunities?record=commercial-1');
  await page.evaluate(() => window.executiveNavigate('/executive?tab=commercial'));
  await commercialReady(page);
  await page.getByTestId('commercial-won-handoff').getByRole('link', { name: 'Open project handovers', exact: true }).click();
  await page.waitForFunction(() => window.executiveRoute === '/sales/project-handovers');
  await page.evaluate(() => window.executiveNavigate('/executive?tab=commercial'));
  await commercialReady(page);
  await page.reload();
  await commercialReady(page);
  checks.push('Authorized opportunity/calendar/handover drilldowns and persistent Commercial Pipeline deep link');

  await currency.selectOption('USD');
  await search.fill('OPP-003');
  assert.equal(await rows(page).count(), 1);
  await page.getByRole('button', { name: 'Export board report', exact: true }).click();
  const printed = await page.evaluate(() => window.executivePrintSnapshot);
  assert.equal(printed.title, 'Commercial Pipeline');
  assert.equal(printed.commercialOpportunities.length, 6);
  assert.equal(printed.commercialActions.length, 7);
  assert.equal(printed.commercialBids.length, 3);
  assert.equal(printed.commercialCurrency, 'USD');
  assert.equal(printed.notesOpen, true);
  assert.equal(printed.actions.length + printed.financialActions.length + printed.portfolioProjects.length, 0);
  assert.equal(await search.inputValue(), 'OPP-003');
  assert.equal(await rows(page).count(), 1);
  assert.equal(await page.locator('#application-sidebar').isVisible(), true);
  await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
  await page.emulateMedia({ media: 'print' });
  await capture(page, 'commercial-board-print', true);
  await page.pdf({ path: path.join(artifacts, 'commercial-board-report.pdf'), format: 'A4', preferCSSPageSize: true, printBackground: true });
  await page.emulateMedia({ media: 'screen' });
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  await commercialReady(page);
  assert.equal(await rows(page).count(), 1);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export snapshot', exact: true }).click();
  assert.deepEqual(JSON.parse(await readFile(await (await downloadPromise).path(), 'utf8')), reportFixture());
  await search.fill(''); await currency.selectOption('AED');
  checks.push('Commercial print retains selected currency, includes all returned matching rows/calendar and global decisions, restores filters and exports exact API snapshot');

  for (const mode of ['light', 'dark']) {
    await page.evaluate(dark => document.documentElement.classList.toggle('dark', dark), mode === 'dark');
    await capture(page, `commercial-${mode}`);
    const result = await new AxeBuilder({ page }).include('main.main-content').withRules(['color-contrast', 'button-name', 'label', 'aria-valid-attr-value']).analyze();
    if (result.violations.length) accessibilityIssues.push({ mode, violations: result.violations });
  }

  for (const fixture of ['commercial-zero-values', 'commercial-empty', 'commercial-incomplete', 'commercial-unspecified', 'commercial-usd-only', 'commercial-missing', 'commercial-restricted', 'commercial-error', 'commercial-winrate-unavailable', 'commercial-no-handoff-access', 'commercial-many-clients', 'commercial-truncated', 'commercial-currency-not-returned', 'commercial-invalid-weighting', 'commercial-quality-error']) {
    const state = await openCommercial({ fixture });
    const select = state.page.getByRole('combobox', { name: 'Commercial reporting currency', exact: true });
    assert.equal(await kpi(state.page, 'framework_backlog').innerText(), '—');
    assert.doesNotMatch(await state.page.getByTestId('commercial-pipeline').innerText(), /NaN|Infinity|undefined/);
    if (fixture === 'commercial-zero-values') {
      assert.equal(await kpi(state.page, 'qualified_pipeline').innerText(), 'AED 0');
      assert.equal(await kpi(state.page, 'weighted_pipeline').innerText(), 'AED 0');
      assert.equal(await state.page.getByTestId('commercial-concentration-total').innerText(), 'AED 0');
      assert.equal(await state.page.locator('.cp-concentration-row').count(), 0);
      assert.match(await state.page.getByTestId('commercial-client-concentration').innerText(), /positive denominator/);
    }
    if (fixture === 'commercial-empty') {
      assert.equal(await select.inputValue(), '');
      assert.equal(await kpi(state.page, 'qualified_pipeline').innerText(), '—');
      assert.equal(await kpi(state.page, 'proposals_due_30d').innerText(), '0');
      assert.equal(await rows(state.page).count(), 0);
      assert.match(await state.page.getByTestId('commercial-bid-calendar').innerText(), /No submission targets in this scope/);
      assert.equal(await state.page.getByTestId('commercial-won-handoff').locator('b').innerText(), '0');
    }
    if (fixture === 'commercial-incomplete') {
      assert.equal(await kpi(state.page, 'qualified_pipeline').innerText(), '—');
      assert.equal(await kpi(state.page, 'weighted_pipeline').innerText(), '—');
      assert.match(await state.page.getByTestId('commercial-client-concentration').innerText(), /incomplete/);
      await state.page.getByRole('searchbox', { name: 'Search opportunities', exact: true }).fill('OPP-001');
      assert.equal(await state.page.getByTestId('commercial-opportunity-commercial-1').getByRole('button').innerText(), '—');
      await state.page.getByRole('searchbox', { name: 'Search opportunities', exact: true }).fill('');
      await select.selectOption('USD');
      assert.match(await kpi(state.page, 'qualified_pipeline').innerText(), /USD/);
    }
    if (fixture === 'commercial-unspecified') {
      assert.equal(await select.inputValue(), 'UNSPECIFIED');
      assert.equal(await kpi(state.page, 'qualified_pipeline').innerText(), '—');
      assert.match(await rows(state.page).first().innerText(), /UNSPECIFIED/);
    }
    if (fixture === 'commercial-usd-only') {
      assert.equal(await select.inputValue(), 'USD');
      assert.deepEqual(await select.locator('option').allTextContents(), ['USD']);
    }
    if (fixture === 'commercial-missing') {
      assert.equal(await rows(state.page).count(), 0);
      assert.equal(await kpi(state.page, 'qualified_pipeline').innerText(), '—');
      assert.match(await state.page.getByTestId('commercial-register').innerText(), /not connected/);
    }
    if (['commercial-restricted', 'commercial-error'].includes(fixture)) {
      assert.equal(await rows(state.page).count(), 0);
      assert.equal(await state.page.locator(actionSelector).count(), 0);
      assert.equal(await state.page.getByTestId('commercial-register').getByRole('link').count(), 0);
      assert.match(await state.page.getByTestId('commercial-register').innerText(), fixture === 'commercial-restricted' ? /Commercial access required/ : /CRM source unavailable/);
      assert.equal(await state.page.getByTestId('commercial-won-handoff').getByRole('link').count(), 0);
    }
    if (fixture === 'commercial-winrate-unavailable') {
      assert.equal(await kpi(state.page, 'win_rate').innerText(), '—');
      await state.page.getByRole('button', { name: 'About Win rate', exact: true }).click();
      await state.page.getByRole('dialog').waitFor();
      assert.match(await state.page.getByRole('dialog').innerText(), /Missing or future close dates/);
      await state.page.getByRole('button', { name: 'Close definitions', exact: true }).click();
    }
    if (fixture === 'commercial-no-handoff-access') {
      const handoff = state.page.getByTestId('commercial-won-handoff');
      assert.equal(await handoff.getByRole('link').count(), 0);
      await handoff.getByRole('button', { name: 'Source details', exact: true }).click();
      await state.page.getByRole('dialog').waitFor();
      assert.equal(await state.page.getByRole('dialog').getByRole('link').count(), 0);
      await state.page.getByRole('button', { name: 'Close definitions', exact: true }).click();
    }
    if (fixture === 'commercial-many-clients') {
      assert.equal(await state.page.locator('.cp-concentration-row').count(), 5);
      await state.page.getByRole('button', { name: 'View all clients', exact: true }).click();
      assert.equal(await state.page.locator('.cp-concentration-row').count(), 14);
      const shares = await state.page.locator('.cp-concentration-track > span').evaluateAll(nodes => nodes.map(node => parseFloat(node.style.width)));
      assert.ok(Math.abs(shares.reduce((sum, number) => sum + number, 0) - 100) < .01);
    }
    if (fixture === 'commercial-truncated') {
      assert.match(await state.page.getByTestId('commercial-register').innerText(), /153 open opportunities/);
      assert.match(await state.page.getByTestId('commercial-register').innerText(), /20 of 213/);
      assert.match(await state.page.getByTestId('commercial-decisions').innerText(), /7 of 87/);
      assert.match(await state.page.getByTestId('commercial-bid-cap').innerText(), /7 of 41/);
      await state.page.getByRole('button', { name: 'Export board report', exact: true }).click();
      const text = await state.page.evaluate(() => window.executivePrintSnapshot.commercialText);
      assert.match(text, /20 of 213/); assert.match(text, /7 of 87/); assert.match(text, /7 of 41/);
    }
    if (fixture === 'commercial-currency-not-returned') {
      await select.selectOption('EUR');
      assert.equal(await rows(state.page).count(), 0);
      assert.match(await state.page.getByTestId('commercial-register').innerText(), /20 open opportunities/);
      assert.match(await state.page.getByTestId('commercial-register').innerText(), /No loaded opportunities in EUR/);
      assert.match(await state.page.getByTestId('commercial-bid-calendar').innerText(), /Target rows not included in this preview/);
      assert.doesNotMatch(await state.page.getByTestId('commercial-bid-calendar').innerText(), /No submission targets/);
      assert.match(await kpi(state.page, 'qualified_pipeline').innerText(), /EUR/);
    }
    if (fixture === 'commercial-invalid-weighting') {
      await state.page.getByRole('combobox', { name: 'Opportunities per page', exact: true }).selectOption('20');
      const sourceRow = state.page.getByTestId('commercial-opportunity-commercial-1');
      assert.equal(await sourceRow.locator('td').nth(4).innerText(), '—');
      await state.page.getByTestId('commercial-register').getByRole('button', { name: 'Weighted value', exact: true }).click();
      assert.equal(await rows(state.page).last().getAttribute('data-testid'), 'commercial-opportunity-commercial-1');
      assert.match(await state.page.getByTestId('commercial-quality-weighted_value_mismatches').innerText(), /Review/);
    }
    if (fixture === 'commercial-quality-error') {
      assert.equal(await rows(state.page).count(), 5);
      assert.match(await state.page.getByTestId('commercial-quality').innerText(), /Source unavailable/);
      assert.doesNotMatch(await state.page.getByTestId('commercial-quality').innerText(), /No recorded issues/);
    }
    await capture(state.page, fixture);
    await state.page.context().close();
  }
  checks.push('True monetary zeros, empty sources, incomplete/unspecified currencies, USD fallback, missing DTO, source/access errors, unavailable win-rate denominator, separate handover permission and full-denominator client expansion');

  const loading = await openCommercial({ loading: true });
  assert.equal(await loading.page.getByTestId('commercial-pipeline').count(), 0);
  await capture(loading.page, 'commercial-loading');
  await loading.control.release();
  await commercialReady(loading.page);
  for (const status of [403, 503]) {
    const state = await openCommercial({ status });
    await state.page.getByRole('alert').waitFor();
    assert.equal(await state.page.getByTestId('commercial-pipeline').count(), 0);
    await capture(state.page, `commercial-error-${status}`);
    state.control.status = 200;
    await state.page.getByRole('button', { name: 'Try again', exact: true }).click();
    await commercialReady(state.page);
    await state.page.context().close();
  }
  checks.push('Light/dark accessibility, loading, HTTP permission/service errors and retry recovery');
  await checkProtectedFiles();
  await writeFile(path.join(artifacts, 'accessibility.json'), JSON.stringify(accessibilityIssues, null, 2));
  assert.deepEqual(accessibilityIssues, [], 'Commercial contrast and accessible controls');
  await writeFile(path.join(artifacts, 'checks.json'), JSON.stringify({ checks, comparisons, comparisonMode: verification?.comparisonMode || (verification ? "tabs_polish_guard" : "historical_snapshot"), protectedHashesUnchanged: true }, null, 2));
  console.log('PASS commercial: ' + checks.join('; ') + '.');
  console.log('Commercial artifacts: ' + artifacts);
}
