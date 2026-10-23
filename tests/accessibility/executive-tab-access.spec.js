import { expect, test } from '@playwright/test';

const permissions = [
  { id: 'read', action: 'read', code: 'executive_dashboard.read', name: 'Executive View' },
  ...['overview', 'financial', 'portfolio'].map(tab => ({ id: tab, action: `view_${tab}`, code: `executive_dashboard.view_${tab}`, name: `Executive ${tab}` })),
].map(p => ({ ...p, module: 'executive', is_active: true, inherited: p.id === 'read', effect: 'inherit' }));

async function editor(page, user = false) {
  const writes = [];
  await page.route('**/api/**', async route => {
    const request = route.request();
    if (request.method() !== 'GET') writes.push({ path: new URL(request.url()).pathname, data: request.postDataJSON() });
    const data = request.url().includes('/permissions/by_module/') ? permissions
      : { permissions, snapshot: 'test-snapshot', locked: false };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
  });
  await page.goto(`/tests/fixtures/executive-access-editor.html${user ? '?user=1' : ''}`);
  return writes;
}

test('existing role review adds one tab permission and retains application/read grants', async ({ page }) => {
  const writes = await editor(page);
  const financial = page.getByRole('checkbox', { name: 'Executive Financial performance: access', exact: true });
  await financial.check();
  await expect(page.getByRole('checkbox', { name: 'Executive Overview: access', exact: true })).not.toBeChecked();
  await page.getByRole('button', { name: 'Review changes', exact: true }).click();
  await page.getByRole('textbox', { name: 'Reason for change' }).fill('Finance reader access');
  await page.getByRole('button', { name: 'Confirm changes', exact: true }).click();
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0].data.module_ids).toEqual(['executive']);
  expect(writes[0].data.permission_ids.sort()).toEqual(['financial', 'read']);
});

test('individual tab decisions use reviewed overrides without changing roles', async ({ page }) => {
  const writes = await editor(page, true);
  await page.getByRole('combobox', { name: 'Executive Overview: access', exact: true }).selectOption('deny');
  await page.getByRole('combobox', { name: 'Executive Financial performance: access', exact: true }).selectOption('allow');
  await page.getByRole('textbox', { name: 'Reason for user permission change' }).fill('Only Financial performance for this user');
  await page.getByRole('button', { name: 'Save user permissions' }).click();
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0].path).toContain('/users/test-user/permission-overrides/');
  expect(writes[0].data.changes).toEqual([{ permission_id: 'overview', effect: 'deny' }, { permission_id: 'financial', effect: 'allow' }]);
  expect(writes[0].data.snapshot).toBe('test-snapshot');
});

test('Use role permissions restores tab inheritance', async ({ page }) => {
  await editor(page, true);
  const financial = page.getByRole('combobox', { name: 'Executive Financial performance: access', exact: true });
  await financial.selectOption('allow');
  await page.getByRole('button', { name: 'Use role permissions', exact: true }).click();
  await expect(financial).toHaveValue('inherit');
});

test('simple assignment selects a user and tabs then saves only their Executive decisions', async ({ page }) => {
  const writes = [];
  await page.route('**/api/**', async route => {
    const request = route.request();
    let data;
    if (request.url().includes('/permission-overrides/')) {
      if (request.method() === 'PATCH') {
        const payload = request.postDataJSON();
        writes.push(payload);
        data = { permissions: permissions.map(p => {
          const change = payload.changes.find(c => c.permission_id === p.id);
          return change ? { ...p, effect: change.effect, effective: change.effect === 'allow' } : p;
        }), snapshot: 'updated', locked: false };
      } else data = { permissions: permissions.map(p => ({ ...p, effective: p.inherited })), snapshot: 'original', locked: false };
    } else data = { results: [{ id: 'test-user', user: { first_name: 'Alex', email: 'alex@example.test' } }] };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
  });
  await page.goto('/tests/fixtures/executive-access-editor.html?assign=1');
  await page.getByRole('button', { name: /Alex alex@example.test/ }).click();
  await page.getByRole('checkbox', { name: 'Overview', exact: true }).check();
  await page.getByRole('checkbox', { name: 'Project portfolio', exact: true }).check();
  await page.getByRole('button', { name: 'Assign', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Tab access assigned to Alex.');
  expect(writes).toHaveLength(1);
  expect(writes[0].changes).toEqual([
    { permission_id: 'overview', effect: 'allow' },
    { permission_id: 'financial', effect: 'deny' },
    { permission_id: 'portfolio', effect: 'allow' },
  ]);
  expect(writes[0].reason).toContain('Overview, Project portfolio');
  expect(writes[0].snapshot).toBe('original');
  await page.getByRole('button', { name: 'Assign', exact: true }).click();
  expect(writes).toHaveLength(1);
  await expect(page.getByRole('status')).toContainText('already has the selected tab access');
});

test('simple assignment keeps selections after a stale-access conflict', async ({ page }) => {
  await page.route('**/api/**', async route => {
    const permissionRequest = route.request().url().includes('/permission-overrides/');
    const conflict = route.request().method() === 'PATCH';
    const data = conflict ? { detail: 'Stale snapshot' } : permissionRequest
      ? { permissions: permissions.map(p => ({ ...p, effective: p.inherited })), snapshot: 'original', locked: false }
      : { results: [{ id: 'test-user', user: { email: 'alex@example.test' } }] };
    await route.fulfill({ status: conflict ? 409 : 200, contentType: 'application/json', body: JSON.stringify(data) });
  });
  await page.goto('/tests/fixtures/executive-access-editor.html?assign=1');
  await page.getByRole('button', { name: /alex@example.test/ }).click();
  await page.getByRole('checkbox', { name: 'Overview', exact: true }).check();
  await page.getByRole('button', { name: 'Assign', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('access changed');
  await expect(page.getByRole('checkbox', { name: 'Overview', exact: true })).toBeChecked();
});

test('simple assignment preserves the existing self-edit lock', async ({ page }) => {
  await page.route('**/api/**', async route => {
    const data = route.request().url().includes('/permission-overrides/')
      ? { permissions: permissions.map(p => ({ ...p, effective: p.inherited })), snapshot: 'original', locked: true, lock_reason: 'Another Super Administrator must edit your permissions.' }
      : { results: [{ id: 'test-user', user: { email: 'alex@example.test' } }] };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
  });
  await page.goto('/tests/fixtures/executive-access-editor.html?assign=1');
  await page.getByRole('button', { name: /alex@example.test/ }).click();
  await expect(page.getByRole('button', { name: 'Assign', exact: true })).toBeDisabled();
  await expect(page.getByRole('checkbox', { name: 'Overview', exact: true })).toBeDisabled();
  await expect(page.getByText('Another Super Administrator must edit your permissions.')).toBeVisible();
});

test('assignment layout keeps search, user rows and tab controls visible at desktop and mobile sizes', async ({ page }, testInfo) => {
  await page.route('**/api/**', async route => {
    const data = route.request().url().includes('/permission-overrides/')
      ? { permissions: permissions.map(p => ({ ...p, effective: p.inherited })), snapshot: 'original', locked: false }
      : { results: Array.from({ length: 20 }, (_, i) => ({ id: `user-${i}`, user: { first_name: `Alex ${i}`, email: `alex.long.employee.email.${i}@example.test` } })) };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
  });
  for (const width of [1440, 1024, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/tests/fixtures/executive-access-editor.html?assign=1');
    // Reserve the existing sidebar width when checking desktop/tablet content.
    if (width >= 768) await page.locator('.roles-access').evaluate(element => { element.style.marginLeft = '244px'; });
    await expect(page.getByRole('button', { name: /Alex 0 / })).toBeVisible();
    const search = page.getByRole('textbox', { name: 'Search user for Executive access' });
    await expect(search).toBeVisible();
    const geometry = await search.evaluate(input => {
      const box = input.getBoundingClientRect();
      const field = input.parentElement.getBoundingClientRect();
      const label = document.querySelector('label[for="executive-user-search"]').getBoundingClientRect();
      return { height: box.height, contained: box.top >= field.top && box.bottom <= field.bottom,
        belowLabel: box.top >= label.bottom, noOverflow: document.documentElement.scrollWidth <= window.innerWidth };
    });
    expect(geometry.height).toBeGreaterThanOrEqual(36);
    expect(geometry.contained).toBe(true);
    expect(geometry.belowLabel).toBe(true);
    expect(geometry.noOverflow).toBe(true);
    if (width === 1440) await page.screenshot({ path: testInfo.outputPath('desktop-empty.png'), fullPage: true });
    await page.getByRole('button', { name: /Alex 0 / }).click();
    await page.getByRole('checkbox', { name: 'Overview', exact: true }).check();
    await expect(page.getByRole('button', { name: 'Assign', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    if (width === 1440 || width === 390) await page.screenshot({ path: testInfo.outputPath(`selected-${width}.png`), fullPage: true });
  }
});
