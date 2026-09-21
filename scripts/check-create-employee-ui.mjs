import assert from 'node:assert/strict';
import AxeBuilder from '@axe-core/playwright';

const photo = {
  name: 'employee-photo.png', mimeType: 'image/png',
  buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jM5kAAAAASUVORK5CYII=', 'base64'),
};

async function field(page, name, value) {
  const input = page.locator(`[name="${name}"]`);
  const tag = await input.evaluate(element => element.tagName);
  if (tag === 'SELECT') await input.selectOption({ label: value });
  else await input.fill(value);
}

async function personalDetails(page) {
  await field(page, 'first_name', 'Maya');
  await field(page, 'surname', 'Andersson');
  await field(page, 'mobile_phone', '512345678');
  await field(page, 'country', 'United Arab Emirates');
  const manager = page.locator('[name="manager_search"]');
  const tag = await manager.evaluate(element => element.tagName);
  if (tag === 'SELECT') {
    const option = manager.locator('option').filter({ hasText: 'Julia Svensson' });
    await manager.selectOption(await option.getAttribute('value'));
  } else {
    const listId = await manager.getAttribute('list');
    if (listId) {
      const options = page.locator(`datalist[id="${listId}"] option`);
      await options.first().waitFor({ state: 'attached' });
      const label = (await options.evaluateAll(items => items.map(option => option.value))).find(value => value.includes('Julia Svensson'));
      assert.ok(label, 'Active manager choices include the fixture manager');
      await manager.fill(label);
    } else {
      await manager.fill('Julia');
      await page.getByRole('option', { name: /Julia Svensson/ }).click();
    }
  }
}

async function organisationDetails(page) {
  await page.getByRole('button', { name: 'Continue to organisation', exact: true }).click();
  await page.getByRole('heading', { name: 'Organisation', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Continue to employment', exact: true }).click();
  await page.getByRole('heading', { name: 'Organisation', exact: true }).waitFor();
  assert.ok(await page.locator('[aria-invalid="true"]').count() > 0, 'Organisation cannot advance with missing required details');
  for (const [name, value] of Object.entries({ business_unit: 'Industrial engineering', division: 'Engineering', business_area: 'Consulting', office: 'Abu Dhabi', job_title_uae: 'Project Engineer' })) await field(page, name, value);
}

async function reviewEmployee(page, joiningDate = '2025-05-12') {
  await personalDetails(page);
  await organisationDetails(page);
  await page.getByRole('button', { name: 'Continue to employment', exact: true }).click();
  await page.getByRole('heading', { name: 'Employment', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Review & create', exact: true }).click();
  await page.getByRole('heading', { name: 'Employment', exact: true }).waitFor();
  await field(page, 'joining_date', joiningDate);
  await page.locator('[name="branch"]').selectOption('RAD');
  await page.getByRole('button', { name: 'Review & create', exact: true }).click();
  await page.getByRole('heading', { name: 'Review & create', exact: true }).waitFor();
}

export async function checkCreateEmployeeVisuals({ open, capture, geometry, record, accessibility, selectedViewport }) {
  const settings = selectedViewport ? [{ width: selectedViewport }] : [{ width: 1672 }, { width: 1280 }, { width: 390 }, { width: 1672, dark: true }];
  for (const setting of settings) {
    const state = await open({ ...setting, mode: 'create' });
    try {
      await state.page.getByRole('button', { name: 'Continue to organisation', exact: true }).waitFor();
      assert.equal(await state.page.getByRole('heading', { name: 'Employee Lifecycle', exact: true }).count(), 0, 'Wizard has its own page hierarchy');
      await capture(state.page, `create-employee-${setting.width}${setting.dark ? '-dark' : ''}`);
      await geometry(state.page, setting.width, 'create');
      const result = await new AxeBuilder({ page: state.page }).include('main.main-content').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      accessibility.push({ mode: 'create', ...setting, violations: result.violations.map(({ id, impact, nodes }) => ({ id, impact, nodes: nodes.map(node => ({ target: node.target, summary: node.failureSummary })) })) });
      assert.deepEqual(result.violations.map(item => item.id), [], `Create wizard ${setting.width}: no accessibility violations`);
      assert.ok(state.control.requests.every(request => request.method === 'GET'), 'Opening the creation wizard does not create employees');
      record(`Create employee ${setting.width}px${setting.dark ? ' dark' : ''}: page hierarchy, sidebar, overflow, and accessibility pass`);
    } finally { await state.close(); }
  }
}

export async function checkCreateEmployeeWorkflows({ open, capture, record }) {
  const state = await open({ mode: 'create' }), { page, control } = state;
  try {
    await page.getByRole('button', { name: 'Continue to organisation', exact: true }).click();
    assert.equal(control.createdPayloads.length, 0, 'An incomplete first step never creates an employee');
    assert.ok(await page.locator('[aria-invalid="true"]').count() > 0, 'Required fields expose validation errors');
    await personalDetails(page);
    await page.locator('[name="manager_search"]').fill('Unknown manager');
    assert.equal(await page.locator('[name="manager_id"]').inputValue(), '', 'Editing manager text clears the selected identity');
    await page.getByRole('button', { name: 'Continue to organisation', exact: true }).click();
    await page.getByRole('heading', { name: 'Personal details', exact: true }).waitFor();
    await personalDetails(page);
    await page.locator('input[type="file"]').setInputFiles({ name: 'invalid.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 synthetic file') });
    await page.getByRole('alert').filter({ hasText: 'Choose a JPG or PNG image, no larger than 5 MB.' }).waitFor();
    await page.locator('input[type="file"]').setInputFiles(photo);
    await page.getByAltText('Selected employee profile', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Remove photo', exact: true }).click();
    await page.getByAltText('Selected employee profile', { exact: true }).waitFor({ state: 'detached' });
    await page.locator('input[type="file"]').setInputFiles(photo);
    assert.equal(await page.locator('[name="manager_id"]').inputValue(), '7001');
    await page.getByRole('button', { name: 'Save draft', exact: true }).click();
    const saved = await page.evaluate(() => Object.entries(sessionStorage).filter(([, value]) => value.includes('Maya') && value.includes('Andersson')));
    assert.equal(saved.length, 1, 'A single browser-session draft holds the entered employee data');
    assert.ok(saved[0][0].includes('7001'), 'The draft is scoped to the current user');
    assert.ok(!saved[0][1].includes('data:image'), 'The uploaded photo is not persisted in session storage');
    await page.reload();
    await page.getByRole('heading', { name: 'Create new employee', exact: true }).waitFor();
    assert.equal(await page.locator('[name="first_name"]').inputValue(), 'Maya');
    assert.equal(await page.locator('[name="surname"]').inputValue(), 'Andersson');
    assert.equal(await page.locator('[name="country"]').inputValue(), 'United Arab Emirates');
    await capture(page, 'create-employee-draft-restored');
    await page.evaluate(() => {
      const key = 'employee-create-draft:7001';
      const draft = JSON.parse(sessionStorage.getItem(key));
      draft.data.manager_id = '99999'; draft.step = 0;
      sessionStorage.setItem(key, JSON.stringify(draft));
    });
    await page.reload();
    await page.locator('#employee-manager-options option').first().waitFor({ state: 'attached' });
    await page.getByRole('button', { name: 'Continue to organisation', exact: true }).click();
    await page.getByRole('heading', { name: 'Personal details', exact: true }).waitFor();
    await page.getByText('Select an active reporting manager from the list', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.getByRole('heading', { name: 'Employee Lifecycle', exact: true }).waitFor();
    assert.equal(control.createdPayloads.length, 0);
    record('Create wizard validates personal data and stale draft managers, uploads a photo, saves/restores a user-scoped session draft, and cancels without creating an employee');
  } finally { await state.close(); }

  for (const { createResult, joiningDate } of [
    { createResult: 'success', joiningDate: '2025-05-12' },
    { createResult: 'success', joiningDate: '2025-07-12' },
    { createResult: 'success', joiningDate: '2025-04-20' },
    { createResult: 'error', joiningDate: '2025-05-12' },
  ]) {
    const state = await open({ mode: 'create' }), { page, control } = state;
    control.createResult = createResult;
    control.createDelayMs = 300;
    try {
      await page.locator('input[type="file"]').setInputFiles(photo);
      await reviewEmployee(page, joiningDate);
      assert.equal(control.createdPayloads.length, 0, 'Completing wizard steps does not submit prematurely');
      await capture(page, `create-employee-review-${createResult}`);
      await page.getByRole('button', { name: 'Create employee', exact: true }).dblclick();
      if (createResult === 'success') {
        await page.getByRole('heading', { name: 'Employee created', exact: true }).waitFor();
        await page.getByRole('button', { name: 'Open onboarding', exact: true }).waitFor();
        await capture(page, 'create-employee-success');
        assert.equal(await page.evaluate(() => sessionStorage.getItem('employee-create-draft:7001')), null, 'Successful creation clears its draft');
      } else {
        await page.getByText('Synthetic employee creation failed. Please try again.', { exact: true }).waitFor();
        await page.getByRole('heading', { name: 'Review & create', exact: true }).waitFor();
        await capture(page, 'create-employee-error');
      }
      assert.equal(control.createdPayloads.length, 1, 'A rapid double click issues exactly one synthetic creation request');
      const payload = control.createdPayloads[0];
      assert.equal(payload.first_name, 'Maya');
      assert.equal(payload.surname, 'Andersson');
      assert.equal(payload.manager_id, '7001');
      assert.equal(payload.email, 'maya.andersson@rejlers.ae');
      assert.equal(payload.mobile_phone, '+971512345678');
      assert.equal(payload.joining_date, joiningDate);
      assert.equal(payload.branch, 'RAD');
      assert.equal(payload.division, 'Engineering');
      assert.deepEqual(payload.photo, { name: photo.name, type: photo.mimeType, size: photo.buffer.length });
      assert.equal(control.requests.filter(request => request.method !== 'GET').length, 1);
      if (createResult === 'success') {
        await page.getByRole('button', { name: 'Open onboarding', exact: true }).click();
        await page.locator('.onboarding-case').waitFor();
        await page.getByRole('heading', { name: 'Pre-Hire Initiation', exact: true, level: 2 }).waitFor();
        assert.ok(control.requests.some(request => request.endpoint === '/onboarding/onboarding/901/'), 'The new onboarding record is opened directly');
        assert.equal(control.requests.filter(request => request.method !== 'GET').length, 1, 'Opening newly created onboarding adds no further writes');
        await page.getByRole('button', { name: 'Back to onboarding', exact: true }).click();
        await page.locator('.onboarding-kpi[data-metric="active"] strong').filter({ hasText: /^19$/ }).waitFor();
        await page.locator('.onboarding-kpi[data-metric="active"]').click();
        const activeDialog = page.getByRole('dialog', { name: 'Active onboardings (19)', exact: true });
        await activeDialog.getByRole('button', { name: 'View Maya Andersson onboarding details', exact: true }).waitFor();
        await activeDialog.locator('.onboarding-dialog-record').first().getByRole('button', { name: 'View Maya Andersson onboarding details', exact: true }).waitFor();
        await activeDialog.getByLabel('Search active employees', { exact: true }).fill('maya.andersson@rejlers.ae');
        assert.equal(await activeDialog.locator('.onboarding-dialog-record').count(), 1);
        await activeDialog.getByRole('button', { name: 'Close active onboardings', exact: true }).click();
        const upcoming = page.locator('.onboarding-panel--upcoming');
        if (joiningDate > '2025-05-26') {
          await upcoming.getByRole('button', { name: 'Show all upcoming', exact: true }).click();
          assert.equal(await page.getByLabel('Date range', { exact: true }).inputValue(), 'all');
        } else {
          await page.getByLabel('Date range', { exact: true }).selectOption({ label: 'All dates' });
          await upcoming.getByRole('button', { name: /^View all/ }).click();
        }
        if (joiningDate >= '2025-04-26') await upcoming.getByRole('button', { name: 'View Maya Andersson onboarding details', exact: true }).waitFor();
        else {
          assert.equal(await upcoming.getByRole('button', { name: 'View Maya Andersson onboarding details', exact: true }).count(), 0, 'Past joining dates remain Active instead of appearing as future joiners');
          await upcoming.getByRole('button', { name: 'View active employees', exact: true }).click();
          await activeDialog.getByRole('button', { name: 'View Maya Andersson onboarding details', exact: true }).waitFor();
          await activeDialog.getByRole('button', { name: 'Close active onboardings', exact: true }).click();
        }
        await page.getByLabel('Date range', { exact: true }).selectOption({ label: 'Next 7 days' });
        await page.locator('.onboarding-kpi[data-metric="active"] strong').filter({ hasText: /^19$/ }).waitFor();
        assert.equal(control.requests.filter(request => request.method !== 'GET').length, 1, 'Refreshing and filtering the created record issues no further writes');
        record(`New employee joining ${joiningDate} appears immediately in searchable Active onboardings; ${joiningDate < '2025-04-26' ? 'a past-date explanation links to its active case' : 'Upcoming joiners reveals its future date'} and date filtering preserves its active case`);
      }
      record(`Create wizard ${createResult}: complete review, correct multipart payload and photo, exactly one synthetic request on a double click`);
    } finally { await state.close(); }
  }

  const duplicate = await open({ mode: 'create' });
  duplicate.control.identityResult = 'duplicate';
  try {
    await reviewEmployee(duplicate.page);
    await duplicate.page.locator('.employee-create-duplicate').getByText('This company email is already assigned.', { exact: true }).waitFor();
    assert.equal(await duplicate.page.getByRole('button', { name: 'Create employee', exact: true }).isDisabled(), true);
    duplicate.control.identityResult = 'available';
    await duplicate.page.getByRole('button', { name: 'Use maya.andersson2@rejlers.ae', exact: true }).click();
    await duplicate.page.locator('.employee-create-duplicate').getByText('No duplicate found', { exact: true }).waitFor();
    assert.equal(await duplicate.page.getByRole('button', { name: 'Create employee', exact: true }).isEnabled(), true);
    assert.equal(duplicate.control.createdPayloads.length, 0);
    record('Email collision blocks creation and the checked suggested email restores creation availability without writes');
  } finally { await duplicate.close(); }

  const previewFailure = await open({ mode: 'create' });
  previewFailure.control.identityResult = 'error';
  try {
    await personalDetails(previewFailure.page);
    await previewFailure.page.getByRole('button', { name: 'Retry duplicate check', exact: true }).waitFor();
    previewFailure.control.identityResult = 'available';
    await previewFailure.page.getByRole('button', { name: 'Retry duplicate check', exact: true }).click();
    await previewFailure.page.locator('.employee-create-duplicate').getByText('No duplicate found', { exact: true }).waitFor();
    assert.equal(previewFailure.control.createdPayloads.length, 0);
    record('Failed duplicate checks retry successfully without creating an employee');
  } finally { await previewFailure.close(); }

  for (const managerFixture of ['not-found', 'forbidden']) {
    const state = await open({ mode: 'create', managerFixture });
    try {
      if (managerFixture === 'not-found') {
        await personalDetails(state.page);
        assert.equal(await state.page.locator('[name="manager_id"]').inputValue(), '7001');
        assert.ok(state.control.requests.some(request => request.endpoint === '/users/employees/active_employees/'));
        record('A missing manager-options endpoint recovers through the compatible active-employees endpoint');
      } else {
        await state.page.getByText('Managers could not be loaded.', { exact: false }).waitFor();
        assert.equal(state.control.requests.some(request => request.endpoint === '/users/employees/active_employees/'), false, 'Permission denial must not trigger the compatibility fallback');
        state.control.managerResult = 'ready';
        await state.page.getByRole('button', { name: 'Retry', exact: true }).click();
        await personalDetails(state.page);
        assert.equal(await state.page.locator('[name="manager_id"]').inputValue(), '7001');
        record('Manager permission errors do not use a fallback; an explicit successful retry restores selection');
      }
      assert.ok(state.control.requests.every(request => request.method === 'GET'));
    } finally { await state.close(); }
  }
}
