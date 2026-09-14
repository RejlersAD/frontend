import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { loadSnapshot } from './ui-check-support.mjs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import AxeBuilder from '@axe-core/playwright';

// Sixth executive tab: real application shell with synthetic source responses.
export async function runRiskComplianceChecks({ frontend, newPage, assertGeometry, reportFixture, verification }) {
  const artifacts = verification?.artifacts || path.resolve(frontend, '../artifacts/risk-compliance');
  await mkdir(artifacts, { recursive: true });
  const protectedFiles = [
    'src/components/Layout/Sidebar.jsx', 'src/components/Layout/Sidebar.css',
    'src/config/layout.config.js', 'src/config/navigationLabels.config.js',
    'src/hooks/useSidebarLayout.js', 'src/hooks/useSidebarDrawer.js',
    'src/pages/Executive/ExecutiveMainPanels.jsx', 'src/pages/Executive/ExecutiveSidePanels.jsx',
    ...['FinancialPerformance.jsx', 'FinancialPerformance.css', 'financialPresentation.jsx', 'FinancialSidePanels.jsx',
      'ProjectPortfolio.jsx', 'ProjectPortfolio.css', 'portfolioPresentation.jsx', 'PortfolioSidePanels.jsx',
      'CommercialPipeline.jsx', 'CommercialPipeline.css', 'commercialPresentation.jsx', 'CommercialSidePanels.jsx',
      'WorkforcePerformance.jsx', 'WorkforcePerformance.css', 'workforcePresentation.jsx', 'WorkforceSidePanels.jsx',
    ].map(file => `src/pages/Executive/${file}`),
  ];
  let checkProtectedFiles = verification?.assertProtected;
  if (!verification) {
  const baselinePath = path.join(artifacts, 'protected-baseline-sha256.json');
  const baseline = await loadSnapshot(frontend, baselinePath);
  checkProtectedFiles = async () => {
    assert.equal(baseline.length, protectedFiles.length, 'Sidebar and five completed tabs were captured before Risk work');
    for (const row of baseline) assert.equal(createHash('sha256').update(await readFile(row.Path)).digest('hex').toUpperCase(), row.Hash, `Protected file changed: ${row.Path}`);
  };
  }
  await checkProtectedFiles();
  // A polish run uses immutable task-scoped source and geometry guards in the parent harness.
  const checks = [];
  const capture = async (page, name, print = false) => {
    for (const selector of ['main.main-content', '.cc-command-center']) await page.locator(selector).evaluate(node => node.scrollTo({ top: 0, left: 0, behavior: 'instant' }));
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.screenshot({ path: path.join(artifacts, `${name}.png`), fullPage: print });
  };
  const comparisons = {};
  if (!verification) {
  for (const [name, route, readyId] of [
    ['overview', '/executive', 'executive-outcomes'], ['financial', '/executive?tab=financial', 'financial-outcomes'],
    ['portfolio', '/executive?tab=portfolio', 'portfolio-outcomes'], ['commercial', '/executive?tab=commercial', 'commercial-outcomes'],
    ['workforce', '/executive?tab=workforce', 'workforce-outcomes'],
  ]) {
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
    assert.equal(comparisons[name].changedPixels, 0, `${name} is visually unchanged by Risk & Compliance`);
    await page.context().close();
  }
  checks.push('Five completed views remain pixel-identical; all 24 protected product files retain original hashes');
  }
  const accessibilityIssues = [];
  const ready = async page => {
    await page.getByTestId('risk-compliance').waitFor();
    await page.getByRole('heading', { name: /^Risk & compliance$/i, exact: true }).waitFor();
  };
  const open = async (options = {}) => {
    const state = await newPage({ ...options, route: '/executive?tab=risk' });
    if (!options.loading && (!options.status || options.status === 200)) await ready(state.page);
    return state;
  };
  const followups = page => page.getByTestId('risk-source-followups').locator('tbody tr');
  const actions = page => page.getByTestId('risk-actions').locator('tbody tr');
  const calendar = page => page.getByTestId('risk-compliance-calendar').locator('tbody tr');
  const projectIds = ['open_cars', 'delayed_car_projects', 'open_observations', 'delayed_observation_projects', 'delayed_audit_projects'];
  const auditIds = ['scheduled_audits', 'delayed_audits', 'completed_audits'];
  const outcomeIds = ['high_enterprise_risks', 'overdue_mitigations', 'recordable_qhse_incidents', 'compliance_obligations_on_time', 'open_audit_findings'];
  const displayed = async (page, prefix, ids) => Promise.all(ids.map(id => page.getByTestId(`${prefix}-${id}`).locator('strong').innerText()));
  const unavailableMeasures = async page => {
    for (const id of outcomeIds) assert.equal(await page.getByTestId(`risk-kpi-${id}`).locator('.rc-outcome-value').innerText(), '\u2014');
    for (const id of ['recordable_incidents', 'lost_time_injuries', 'near_misses', 'quality_nonconformances', 'environmental_events', 'overdue_corrective_actions']) {
      assert.equal(await page.getByTestId(`risk-qhse-${id}`).locator('strong').innerText(), '\u2014');
    }
    assert.deepEqual(await displayed(page, 'risk-control', ['controls_tested', 'control_effectiveness', 'control_deficiencies', 'open_audit_findings']), Array(4).fill('\u2014'));
    assert.match(await page.getByTestId('risk-register').innerText(), /Enterprise risk register not connected/);
    assert.match(await page.getByTestId('risk-exposure').innerText(), /Risk matrix unavailable/);
    assert.match(await page.getByTestId('risk-exposure').innerText(), /Risk history not connected/);
    assert.match(await page.getByTestId('risk-mitigations').innerText(), /Treatment evidence not connected/);
    assert.match(await page.getByTestId('risk-concentration').innerText(), /Residual exposure not available/);
  };
  const { page } = await open();
  // Capture the reference viewport before deeper assertions so visual review can begin immediately.
  await assertGeometry(page, 1672);
  await capture(page, 'risk-1672');
  console.log('Risk first reference screenshot: ' + path.join(artifacts, 'risk-1672.png'));
  await unavailableMeasures(page);
  assert.equal(await page.locator('[data-testid^="risk-kpi-"]').count(), 5);
  for (const width of [1672, 1440, 1024, 390]) {
    await assertGeometry(page, width);
    await capture(page, `risk-${width}`);
    const geometry = await page.locator('.cc-command-center').evaluate(node => ({ client: node.clientWidth, scroll: node.scrollWidth }));
    assert.ok(geometry.scroll <= geometry.client + 1, `Risk content fits at ${width}: ${JSON.stringify(geometry)}`);
    if (width === 1672) {
      const main = await page.getByTestId('risk-main-column').boundingBox();
      const right = await page.getByTestId('risk-right-column').boundingBox();
      const outcomes = await page.getByTestId('risk-outcomes').boundingBox();
      assert.ok(main.width > right.width && main.width / (main.width + right.width) < .76);
      assert.ok(right.x >= main.x + main.width && Math.abs(main.y - right.y) < 3);
      assert.ok(Math.abs(outcomes.width - main.width) < 2 && Math.abs(outcomes.y - main.y) < 2, 'Five outcomes belong to the left column');
      const mainPanels = await Promise.all(['risk-outcomes', 'risk-actions', 'risk-register', 'risk-exposure'].map(id => page.getByTestId(id).boundingBox()));
      assert.ok(mainPanels.every((box, index) => !index || box.y >= mainPanels[index - 1].y + mainPanels[index - 1].height));
    }
    if (width === 390) {
      const tab = await page.getByRole('tab', { name: 'Risk & compliance', exact: true }).boundingBox();
      const strip = await page.locator('.cc-tabs').boundingBox();
      assert.ok(tab.x >= strip.x && tab.x + tab.width <= strip.x + strip.width + 1, 'Active mobile Risk tab is visible');
    }
  }
  await assertGeometry(page, 1672);
  checks.push('Five unavailable enterprise outcomes in the reference left column; responsive 1672/1440/1024/390 layout and visible mobile Risk tab preserve the sidebar');

  assert.deepEqual(await displayed(page, 'risk-qhse-project', projectIds), ['17', '3', '9', '2', '2']);
  assert.deepEqual(await displayed(page, 'risk-audit', auditIds), ['8', '3', '5']);
  assert.match(await page.getByTestId('risk-qhse-performance').innerText(), /Rates per hours worked are not available/);
  const register = page.getByTestId('risk-source-followups');
  const search = page.getByRole('searchbox', { name: 'Search assurance follow-ups', exact: true });
  const category = page.getByRole('combobox', { name: 'Assurance category', exact: true });
  const owner = page.getByRole('combobox', { name: 'Assurance recorded owner', exact: true });
  const statusFilter = page.getByRole('combobox', { name: 'Assurance follow-up status', exact: true });
  const pageSize = page.getByRole('combobox', { name: 'Assurance rows per page', exact: true });
  assert.equal(await followups(page).count(), 6);
  const firstRows = await followups(page).locator('td:nth-of-type(2)').allTextContents();
  assert.equal(await page.getByRole('button', { name: 'Previous assurance page', exact: true }).isDisabled(), true);
  await page.getByRole('button', { name: 'Next assurance page', exact: true }).click();
  assert.equal(await followups(page).count(), 6);
  assert.equal((await followups(page).locator('td:nth-of-type(2)').allTextContents()).some(code => firstRows.includes(code)), false);
  assert.equal(await page.getByRole('button', { name: 'Next assurance page', exact: true }).isDisabled(), true);
  await search.fill('aSs-002');
  assert.equal(await followups(page).count(), 1);
  assert.match(await followups(page).innerText(), /Utility connection|ASS-002/);
  await category.selectOption('audit_schedule');
  assert.equal(await followups(page).count(), 0);
  assert.match(await register.innerText(), /No follow-ups match these filters/);
  await search.fill('');
  assert.equal(await followups(page).count(), 4);
  await category.selectOption('quality');
  await owner.selectOption('Recorded project manager A');
  await statusFilter.selectOption('past_target_date');
  assert.equal(await followups(page).count(), 0);
  await statusFilter.selectOption('reported_delay');
  assert.equal(await followups(page).count(), 4);
  await owner.selectOption(''); await category.selectOption(''); await statusFilter.selectOption('');
  await pageSize.selectOption('20');
  assert.equal(await followups(page).count(), 12);
  await register.getByRole('button', { name: /^Project/ }).click();
  const codes = await followups(page).locator('td:nth-of-type(2)').allTextContents();
  assert.deepEqual(codes, Array.from({ length: 12 }, (_, index) => `ASS-${String(index + 1).padStart(3, '0')}`));
  await register.getByRole('button', { name: /^Project/ }).click();
  assert.deepEqual(await followups(page).locator('td:nth-of-type(2)').allTextContents(), [...codes].reverse());
  assert.equal(await register.getByRole('columnheader', { name: /^Project/ }).getAttribute('aria-sort'), 'descending');
  assert.match(await register.innerText(), /Not recorded/);
  assert.doesNotMatch(await register.innerText(), /High risk|Risk owner|Mitigation owner/);
  await unavailableMeasures(page);
  checks.push('Recorded follow-up search, intersecting category/owner/status filters, sorting and pagination work without inventing enterprise ratings or owners');

  assert.equal(await calendar(page).count(), 3);
  assert.match(await page.getByTestId('risk-calendar-audit-target-1').innerText(), /Target date passed/);
  assert.match(await page.getByTestId('risk-calendar-audit-target-2').innerText(), /Due today/);
  assert.match(await page.getByTestId('risk-calendar-audit-target-3').innerText(), /Unassigned/);
  await page.getByRole('button', { name: 'View returned audits', exact: true }).click();
  assert.equal(await calendar(page).count(), 6);
  await page.getByTestId('risk-compliance-calendar').getByRole('button', { name: 'Show top 3', exact: true }).click();
  assert.equal(await actions(page).count(), 3);
  assert.deepEqual(await actions(page).locator('td:nth-of-type(4)').allTextContents(), Array(3).fill('QHSE'));
  assert.deepEqual(await actions(page).locator('td:nth-of-type(5)').allTextContents(), Array(3).fill('\u2014'));
  await page.getByRole('button', { name: 'View all 12 actions', exact: true }).click();
  assert.equal(await actions(page).count(), 12);
  const dialog = page.getByRole('dialog');
  await actions(page).first().getByRole('button').click();
  await dialog.waitFor();
  assert.match(await dialog.innerText(), /completion evidence is not inferred/);
  await page.getByRole('button', { name: 'Close definitions', exact: true }).click();
  await page.getByRole('button', { name: 'Show top 3 actions', exact: true }).click();
  const explain = page.getByRole('button', { name: 'About High enterprise risks', exact: true });
  await explain.click(); await dialog.waitFor();
  assert.match(await dialog.innerText(), /Verified assurance register required/);
  for (const key of ['Tab', 'Shift+Tab']) { await page.keyboard.press(key); assert.equal(await dialog.evaluate(node => node.contains(document.activeElement)), true); }
  await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' });
  assert.equal(await explain.evaluate(node => node === document.activeElement), true);
  await page.getByTestId('risk-register').getByRole('button', { name: 'Reporting basis', exact: true }).click();
  await dialog.waitFor();
  assert.match(await dialog.innerText(), /governed enterprise risk register/i);
  await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(350);
  await capture(page, 'risk-definitions-mobile');
  assert.equal(await dialog.evaluate(node => { const box = node.getBoundingClientRect(); return box.x >= 0 && box.right <= innerWidth && box.bottom <= innerHeight; }), true);
  await page.getByRole('button', { name: 'Close definitions', exact: true }).click();
  await assertGeometry(page, 1672);
  await page.getByRole('button', { name: 'View source follow-ups', exact: true }).click();
  assert.equal(await page.getByTestId('risk-register').evaluate(node => document.activeElement === node), true);
  await page.getByTestId('risk-calendar-audit-target-1').getByRole('link').click();
  await page.waitForFunction(route => window.executiveRoute === route, reportFixture().risk_compliance.compliance_calendar.rows[0].route);
  await page.evaluate(() => window.executiveNavigate('/executive?tab=risk')); await ready(page); await page.reload(); await ready(page);
  await page.getByRole('tab', { name: 'Risk & compliance', exact: true }).focus();
  await page.keyboard.press('ArrowLeft'); await page.getByTestId('workforce-outcomes').waitFor();
  await page.keyboard.press('ArrowRight'); await ready(page);
  checks.push('Separate project-quality/audit aggregates, honest dated audit targets, expanded actions/calendar, source definitions, focus containment, authorized links and persistent keyboard-accessible Risk route');

  await search.fill('ASS-002'); assert.equal(await followups(page).count(), 1);
  await page.getByRole('button', { name: 'Export board report', exact: true }).click();
  const printed = await page.evaluate(() => window.executivePrintSnapshot);
  assert.match(printed.title, /^Risk & compliance$/i);
  assert.equal(printed.riskRows.length, 12); assert.equal(printed.riskActions.length, 12); assert.equal(printed.riskCalendar.length, 6);
  assert.equal(printed.actions.length + printed.financialActions.length + printed.portfolioProjects.length + printed.commercialOpportunities.length + printed.workforceCapacity.length, 0);
  assert.equal(printed.notesOpen, true);
  assert.equal(await followups(page).count(), 1); assert.equal(await search.inputValue(), 'ASS-002');
  assert.equal(await page.locator('#application-sidebar').isVisible(), true);
  await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
  await page.emulateMedia({ media: 'print' });
  await capture(page, 'risk-board-print', true);
  await page.pdf({ path: path.join(artifacts, 'risk-board-report.pdf'), format: 'A4', preferCSSPageSize: true, printBackground: true });
  await page.emulateMedia({ media: 'screen' }); await page.evaluate(() => window.dispatchEvent(new Event('afterprint'))); await ready(page);
  assert.equal(await followups(page).count(), 1);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export snapshot', exact: true }).click();
  assert.deepEqual(JSON.parse(await readFile(await (await downloadPromise).path(), 'utf8')), reportFixture());
  await search.fill('');
  checks.push('Active Risk print includes all returned source follow-ups/actions/audit targets, restores filters/sidebar and exports the exact API snapshot');

  for (const mode of ['light', 'dark']) {
    await page.evaluate(dark => document.documentElement.classList.toggle('dark', dark), mode === 'dark');
    await capture(page, `risk-${mode}`);
    const result = await new AxeBuilder({ page }).include('main.main-content').withRules(['color-contrast', 'button-name', 'label', 'aria-valid-attr-value']).analyze();
    if (result.violations.length) accessibilityIssues.push({ mode, violations: result.violations });
  }
  for (const fixture of ['risk-zero', 'risk-empty', 'risk-restricted', 'risk-error', 'risk-missing', 'risk-partial-error', 'risk-partial-restricted', 'risk-partial-unavailable', 'risk-partial-zero', 'risk-null-project-counter', 'risk-calendar-basis-missing', 'risk-audit-restricted', 'risk-truncated']) {
    const state = await open({ fixture });
    await unavailableMeasures(state.page);
    assert.doesNotMatch(await state.page.getByTestId('risk-compliance').innerText(), /NaN|Infinity|undefined/);
    if (fixture === 'risk-zero') {
      assert.deepEqual(await displayed(state.page, 'risk-qhse-project', projectIds), Array(5).fill('0'));
      assert.deepEqual(await displayed(state.page, 'risk-audit', auditIds), Array(3).fill('0'));
      assert.equal(await followups(state.page).count(), 0); assert.equal(await actions(state.page).count(), 0); assert.equal(await calendar(state.page).count(), 0);
      assert.match(await state.page.getByTestId('risk-source-followups').innerText(), /No recorded assurance follow-ups/);
      assert.match(await state.page.getByTestId('risk-compliance-calendar').innerText(), /No pending audit dates in this window/);
    }
    if (['risk-empty', 'risk-restricted', 'risk-error', 'risk-missing'].includes(fixture)) {
      assert.deepEqual(await displayed(state.page, 'risk-qhse-project', projectIds), Array(5).fill('\u2014'));
      assert.deepEqual(await displayed(state.page, 'risk-audit', auditIds), Array(3).fill('\u2014'));
      assert.equal(await followups(state.page).count(), 0); assert.equal(await actions(state.page).count(), 0); assert.equal(await calendar(state.page).count(), 0);
      assert.equal(await state.page.getByRole('button', { name: 'Next assurance page', exact: true }).count(), 0);
      assert.equal(await state.page.getByRole('searchbox', { name: 'Search assurance follow-ups', exact: true }).count(), 0);
      assert.equal(await state.page.getByTestId('risk-compliance').getByRole('link').count(), 0);
      assert.doesNotMatch(await state.page.getByTestId('risk-source-followups').innerText(), /0 matching|No recorded assurance follow-ups/);
      assert.doesNotMatch(await state.page.getByTestId('risk-compliance-calendar').innerText(), /No pending audit dates/);
      assert.match(await state.page.getByTestId('risk-source-followups').innerText(), fixture === 'risk-error' ? /Assurance source unavailable/ : fixture === 'risk-restricted' ? /Source access required/ : /Assurance follow-ups unavailable/);
    }
    if (['risk-partial-error', 'risk-partial-restricted', 'risk-partial-unavailable'].includes(fixture)) {
      assert.deepEqual(await displayed(state.page, 'risk-qhse-project', projectIds), Array(5).fill('\u2014'));
      assert.deepEqual(await displayed(state.page, 'risk-audit', auditIds), ['8', '3', '5']);
      assert.equal(await followups(state.page).count(), 4); assert.equal(await calendar(state.page).count(), 3);
      assert.equal(await state.page.getByTestId('risk-qhse-performance').getByRole('link').count(), 0);
      assert.match(await state.page.getByTestId('risk-actions').innerText(), /Some source coverage is unavailable/);
    }
    if (fixture === 'risk-partial-zero') {
      assert.deepEqual(await displayed(state.page, 'risk-qhse-project', projectIds), Array(5).fill('\u2014'));
      assert.deepEqual(await displayed(state.page, 'risk-audit', auditIds), Array(3).fill('0'));
      assert.equal(await followups(state.page).count(), 0); assert.equal(await actions(state.page).count(), 0);
      assert.match(await state.page.getByTestId('risk-source-followups').innerText(), /Follow-up coverage incomplete/);
      assert.match(await state.page.getByTestId('risk-actions').innerText(), /Follow-up coverage incomplete/);
      assert.match(await state.page.getByTestId('risk-compliance-calendar').innerText(), /No pending audit dates in this window/);
    }
    if (fixture === 'risk-null-project-counter') {
      assert.deepEqual(await displayed(state.page, 'risk-qhse-project', projectIds), ['\u2014', '3', '9', '2', '2']);
    }
    if (fixture === 'risk-calendar-basis-missing') {
      assert.equal(await calendar(state.page).count(), 0);
      assert.match(await state.page.getByTestId('risk-compliance-calendar').innerText(), /QHSE audit schedule not available/);
      assert.doesNotMatch(await state.page.getByTestId('risk-compliance-calendar').innerText(), /No pending audit dates/);
    }
    if (fixture === 'risk-audit-restricted') {
      assert.deepEqual(await displayed(state.page, 'risk-qhse-project', projectIds), ['17', '3', '9', '2', '2']);
      assert.deepEqual(await displayed(state.page, 'risk-audit', auditIds), Array(3).fill('\u2014'));
      assert.equal(await calendar(state.page).count(), 0);
      assert.equal(await state.page.getByTestId('risk-audit-controls').getByRole('link').count(), 0);
      assert.match(await state.page.getByTestId('risk-compliance-calendar').innerText(), /Source access required/);
      assert.equal(await followups(state.page).count(), 6);
    }
    if (fixture === 'risk-truncated') {
      assert.match(await state.page.getByTestId('risk-source-followups').innerText(), /12 of 230 follow-ups/);
      assert.match(await state.page.getByTestId('risk-actions').innerText(), /12 of 70 source actions/);
      assert.match(await state.page.getByTestId('risk-compliance-calendar').innerText(), /3 of 60 audit dates/);
      await state.page.getByRole('button', { name: 'Export board report', exact: true }).click();
      const snapshot = await state.page.evaluate(() => window.executivePrintSnapshot);
      assert.match(snapshot.riskText, /12 of 230 follow-ups/); assert.match(snapshot.riskText, /12 of 70 source actions/); assert.match(snapshot.riskText, /6 of 60 audit dates/);
    }
    await capture(state.page, fixture); await state.page.context().close();
  }
  checks.push('Known source zeros remain distinct from missing/error/restricted data; project-quality and audit permissions are independent, partial coverage and API caps stay explicit');
  const loading = await open({ loading: true });
  assert.equal(await loading.page.getByTestId('risk-compliance').count(), 0);
  await capture(loading.page, 'risk-loading'); await loading.control.release(); await ready(loading.page);
  for (const status of [403, 503]) {
    const state = await open({ status }); await state.page.getByRole('alert').waitFor();
    assert.equal(await state.page.getByTestId('risk-compliance').count(), 0); await capture(state.page, `risk-error-${status}`);
    state.control.status = 200; await state.page.getByRole('button', { name: 'Try again', exact: true }).click(); await ready(state.page); await state.page.context().close();
  }
  const refreshed = await open(); refreshed.control.status = 503;
  await refreshed.page.getByRole('button', { name: 'Refresh overview', exact: true }).click(); await refreshed.page.getByRole('alert').waitFor();
  assert.equal(await refreshed.page.getByTestId('risk-compliance').count(), 0, 'Failed refresh removes stale assurance data');
  checks.push('Light/dark accessibility, initial loading, HTTP permission/service errors, retries and failed-refresh stale-data removal');
  await checkProtectedFiles();
  await writeFile(path.join(artifacts, 'accessibility.json'), JSON.stringify(accessibilityIssues, null, 2));
  assert.deepEqual(accessibilityIssues, [], 'Risk contrast and accessible controls');
  await writeFile(path.join(artifacts, 'checks.json'), JSON.stringify({ checks, comparisons, comparisonMode: verification?.comparisonMode || (verification ? "tabs_polish_guard" : "historical_snapshot"), protectedHashesUnchanged: true }, null, 2));
  console.log('PASS Risk: ' + checks.join('; ') + '.');
}
