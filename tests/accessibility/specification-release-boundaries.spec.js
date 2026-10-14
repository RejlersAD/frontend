import { test, expect } from '@playwright/test';

test.setTimeout(90000);
test.use({ serviceWorkers: 'block', actionTimeout: 10000, navigationTimeout: 30000 });

// These synthetic values test display behavior, not engineering ratings.
const job = { id: 'synthetic-job', status: 'completed', document: { title: 'Synthetic specification', filename: 'synthetic.pdf' } };
const pipingClass = number => ({
  id: `synthetic-class-${number}`, class_code: `SYN-${String(number).padStart(3, '0')}`,
  material_grade: 'TEST', pressure_rating: 'CLASS 150', components_count: 1,
  pt_rating_table: [{ temperature_c: 100, pressure_bar_g: 9 }],
  components: [{ id: `synthetic-component-${number}`, component_type: 'pipe', description: 'Synthetic description', revision_number: '0', notes: 'Synthetic note' }],
});
const covered = { temperature_c: 100, spec_bar_g: 9, allowed_bar_g: 10, delta_bar_g: 1, method: 'exact', ok: true };
const uncovered = { temperature_c: 1000, spec_bar_g: 1, allowed_bar_g: null, method: 'no_data', ok: null };

async function openFixture(page, { response, count = 1, view = 'classes', failure } = {}) {
  const state = { errors: [], requests: [], validations: 0, failure, response, count };
  page.on('pageerror', error => state.errors.push(error.message));
  await page.addInitScript(fixture => {
    window.specificationFixture = fixture;
    localStorage.setItem('radai_access_token', 'synthetic-specification-token');
    localStorage.setItem('specCustomization.sheetRail.open', 'true');
    localStorage.setItem('specCustomization.chatbot.open', 'false');
  }, { job, view });
  await page.route('**/api/**', async route => {
    const { pathname: path } = new URL(route.request().url());
    state.requests.push({ path, method: route.request().method() });
    let body = { results: [] };
    if (path.endsWith('/asme-validation/')) {
      state.validations++;
      if (state.failure === 'network') return route.abort('failed');
      if (state.failure === 'denied') return route.fulfill({ status: 403, json: { detail: 'You do not have access to this piping class.' } });
      body = state.response;
    } else if (/\/paper-spec\/classes\/[^/]+\/$/.test(path)) {
      body = pipingClass(Number(path.match(/synthetic-class-(\d+)/)?.[1] || 1));
    } else if (path.endsWith('/classes/')) {
      body = Array.from({ length: path.includes('synthetic-job-next') ? 1 : state.count }, (_, index) => pipingClass(index + 1));
    } else if (path.endsWith('/workbook/')) {
      body = { workbook: 'spec', sheets: ['Sheet A', 'Sheet B'].map(name => ({
        name, headers: ['Description', 'Class'], row_count: 1,
        rows: [{ row_key: `${name}-row`, cells: { Description: `${name} preserved value`, Class: 'SYN-001' } }],
      })) };
    } else if (/\/paper-spec\/jobs\/[^/]+\/$/.test(path)) {
      body = path.includes('synthetic-job-next') ? { ...job, id: 'synthetic-job-next' } : job;
    } else if (path.endsWith('/spec-customization/config/')) {
      body = { accepted_extensions: ['pdf'], byok: { enabled: false } };
    }
    return route.fulfill({ json: body });
  });
  await page.goto('/tests/fixtures/specification-release.html', { waitUntil: 'domcontentloaded' });
  if (view === 'classes') await expect(page.getByText('SYN-001', { exact: true }).first()).toBeVisible();
  return state;
}

const openClass = page => page.getByText('SYN-001', { exact: true }).first().click();
const assertReadOnly = state => {
  expect(state.errors).toEqual([]);
  expect(state.requests.filter(request => !['GET', 'HEAD', 'OPTIONS'].includes(request.method))).toEqual([]);
};

for (const scenario of [
  { name: 'out-of-range coverage stays skipped', status: 'skipped', label: 'No PT data to validate', points: [uncovered], checked: 0, failed: 0, passRows: 0, failRows: 0 },
  { name: 'partial reference coverage cannot pass the whole table', status: 'skipped', label: 'Incomplete PT reference data', points: [covered, uncovered], checked: 1, failed: 0, passRows: 1, failRows: 0 },
  { name: 'confirmed exceedance remains failed beside uncovered points', status: 'fail', label: 'PT exceeds ASME limits', points: [{ ...covered, spec_bar_g: 11, delta_bar_g: -1, ok: false }, uncovered], checked: 1, failed: 1, passRows: 0, failRows: 1 },
  { name: 'fully checked reference points retain their pass result', status: 'pass', label: 'PT within ASME limits', points: [covered], checked: 1, failed: 0, passRows: 1, failRows: 0 },
  { name: 'server advisory error remains unavailable', status: 'error', label: 'ASME validation unavailable', points: [], checked: 0, failed: 0, passRows: 0, failRows: 0 },
]) test(scenario.name, async ({ page }) => {
  const state = await openFixture(page, { response: {
    status: scenario.status, label: scenario.label, points: scenario.points,
    points_checked: scenario.checked, points_failed: scenario.failed,
  } });
  await openClass(page);
  const validation = page.getByRole('heading', { name: 'ASME Validation', exact: true }).locator('../..');
  await expect(validation).toContainText(scenario.label);
  await expect(validation.getByText('PASS', { exact: true })).toHaveCount(scenario.passRows);
  await expect(validation.getByText('FAIL', { exact: true })).toHaveCount(scenario.failRows);
  await expect(validation.getByText('N/A', { exact: true })).toHaveCount(scenario.points.filter(point => point.ok === null).length);
  await expect(page.getByText('ASME ✓', { exact: true })).toHaveCount(scenario.status === 'pass' ? 1 : 0);
  await expect(page.getByText('ASME ✗', { exact: true })).toHaveCount(scenario.status === 'fail' ? 1 : 0);
  await expect(page.getByText('Validating against ASME B16.34…', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('columnheader', { name: 'Rev No', exact: true })).toBeVisible();
  await expect(page.getByText('Synthetic note', { exact: true })).toBeVisible();
  if (scenario.status === 'skipped') await page.screenshot({ path: `../.codex-temp/release-all-20260924/frontend-spec-${scenario.checked ? 'partial' : 'skipped'}.png`, fullPage: true });
  assertReadOnly(state);
});

for (const failure of ['network', 'denied']) test(`ASME ${failure} failure ends loading and a later explicit expansion can retry`, async ({ page }) => {
  const state = await openFixture(page, { failure, response: { status: 'skipped', label: 'No PT data to validate', points: [uncovered], points_checked: 0, points_failed: 0 } });
  await openClass(page);
  await expect(page.getByText('ASME validation unavailable', { exact: true })).toBeVisible();
  await expect(page.getByText('Validating against ASME B16.34…', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Synthetic description', { exact: true })).toBeVisible();
  expect(state.validations).toBe(1);
  state.failure = null;
  await openClass(page);
  await openClass(page);
  await expect(page.getByText('No PT data to validate', { exact: true })).toBeVisible();
  expect(state.validations).toBe(2);
  assertReadOnly(state);
});

test('a new smaller job starts on a valid class page without hiding its results', async ({ page }) => {
  const state = await openFixture(page, { count: 21 });
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByText('SYN-021', { exact: true })).toBeVisible();
  await page.evaluate(nextJob => window.renderSpecificationFixture({ view: 'classes', job: nextJob }), { ...job, id: 'synthetic-job-next' });
  await expect(page.getByText('SYN-001', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Previous', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeDisabled();
  await expect(page.getByText(/Page\s+1\s*\/\s*1/)).toBeVisible();
  assertReadOnly(state);
});

test('column visibility preserves values and per-sheet choices without writing workbook data', async ({ page }) => {
  const state = await openFixture(page, { view: 'workbook' });
  await expect(page.getByRole('columnheader', { name: 'Description', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /^Columns/ }).click();
  await page.getByRole('checkbox', { name: 'Description', exact: true }).uncheck();
  await expect(page.getByRole('columnheader', { name: 'Description', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: /^Sheet B/ }).click();
  await expect(page.getByRole('columnheader', { name: 'Description', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /^Sheet A/ }).click();
  await expect(page.getByRole('columnheader', { name: 'Description', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Hide all', exact: true }).click();
  await expect(page.getByRole('columnheader', { name: 'Class', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Show all', exact: true }).click();
  await expect(page.getByRole('columnheader', { name: 'Description', exact: true })).toBeVisible();
  await expect(page.locator('input[value="Sheet A preserved value"]')).toBeVisible();
  assertReadOnly(state);
});
