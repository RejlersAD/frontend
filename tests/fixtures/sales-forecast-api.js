import { expect } from '@playwright/test';

export const forecastTime = '2026-10-01T06:30:00Z';
export const forecastId = index => `00000000-0000-4000-8000-${String(7001 + index).padStart(12, '0')}`;

// Synthetic records follow SalesForecastSerializer and the generator's actual JSON
// shapes. It has no currency, monthly phasing, targets or reviewer-route fields.
export function forecastRow(index = 0, changes = {}) {
  return {
    id: forecastId(index), forecast_period: '2026-Q4', forecast_date: ['2026-10-01', '2026-09-30', '2026-09-29'][index % 3],
    status: index === 1 ? 'approved' : 'draft', predicted_revenue: index === 1 ? '1700000.00' : '1800000.00',
    confidence_level: 0.8, best_case: '2250000.00', worst_case: '1350000.00', actual_revenue: null, accuracy: null,
    model_version: 'v1.0', training_data_points: 24,
    features_used: ['historical_revenue', 'pipeline_weighted_value', 'deal_count', 'avg_deal_size', 'win_rate'],
    forecast_by_stage: { qualified: 400000, proposal: 650000, negotiation: 750000 },
    forecast_by_service: { engineering_design: 1200000, consulting: 600000 },
    top_deals_considered: [{ deal_code: 'VF-2026-0142', deal_name: 'Synthetic engineering study', weighted_value: 650000, probability: 65 }],
    category_totals: {}, demand_by_discipline: {}, manual_adjustments: [], source_snapshot: {},
    exchange_rate_date: null, exchange_rate_source: '', generated_by: 12, generated_by_name: 'Sales planning',
    approved_by: index === 1 ? 13 : null, approved_at: index === 1 ? '2026-09-30T07:00:00Z' : null,
    variance: null, created_at: forecastTime, updated_at: forecastTime, ...changes,
  };
}

const responseStatus = (configured, key) => {
  const value = typeof configured === 'number' || Array.isArray(configured) ? configured : configured?.[key];
  return Array.isArray(value) ? value.shift() || 200 : value || 200;
};

export async function prepareForecasts(page, configuration = {}) {
  const state = {
    rows: [forecastRow(), forecastRow(1), forecastRow(2, { forecast_period: '2026-Q3' })],
    listStatus: 200, listPageSize: 2, listHold: null, detailStatuses: {}, detailHolds: {},
    patchStatuses: {}, generateStatuses: [], approveStatuses: [], requests: [], mutations: [], unexpected: [], pageErrors: [],
    ...configuration,
  };
  page.on('pageerror', error => state.pageErrors.push(error.message));
  await page.clock.setFixedTime(new Date(forecastTime));
  await page.addInitScript(() => localStorage.setItem('radai_access_token', 'synthetic-forecast-user'));
  const paginated = url => {
    const pageNumber = Math.max(1, Number(url.searchParams.get('page')) || 1);
    const pageSize = Math.min(Number(url.searchParams.get('page_size')) || state.listPageSize, state.listPageSize);
    const start = (pageNumber - 1) * pageSize;
    const nextUrl = new URL(url); nextUrl.searchParams.set('page', String(pageNumber + 1));
    return { count: state.rows.length, results: state.rows.slice(start, start + pageSize),
      next: start + pageSize < state.rows.length ? `${nextUrl.pathname}${nextUrl.search}` : null };
  };
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname, method = request.method();
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) return route.abort();
    if (!path.startsWith('/api/v1/')) return route.continue();
    const body = ['POST', 'PATCH'].includes(method) && request.headers()['content-type']?.includes('json') ? request.postDataJSON() : null;
    state.requests.push({ path, search: url.search, method, body });
    if (path.endsWith('/rbac/users/me/')) return route.fulfill({ json: { id: 11,
      user: { id: 11, first_name: 'Aisha', last_name: 'Noor', email: 'aisha@example.test', is_superuser: true },
      roles: [{ code: 'super_admin', name: 'Super Administrator' }], modules: [] } });
    if (path.endsWith('/my-profile-photo/')) return route.fulfill({ status: 204, body: '' });
    if (path.endsWith('/notifications/push-config/')) return route.fulfill({ json: { available: false, public_key: '' } });
    if (path.endsWith('/notifications/unread_count/')) return route.fulfill({ json: { unread_count: 0 } });
    if (/\/procurement\/(requisitions|orders)\/pending-for-me\/$/.test(path)) return route.fulfill({ json: { count: 0, results: [] } });
    if (path.endsWith('/forecasts/') && method === 'GET') {
      const snapshot = structuredClone(paginated(url));
      if (state.listHold) await state.listHold;
      const status = responseStatus(state.listStatus);
      return route.fulfill({ status, json: status === 200 ? snapshot : { detail: 'The forecast register could not be loaded.' } });
    }
    if (path.endsWith('/forecasts/generate_forecast/') && method === 'POST') {
      state.mutations.push({ action: 'generate', body, path });
      const status = responseStatus(state.generateStatuses);
      if (status !== 200) return route.fulfill({ status, json: { detail: 'The forecast could not be generated. Your input is retained.' } });
      const created = forecastRow(20 + state.mutations.length, { forecast_period: body.period, status: 'draft', generated_by: 11 });
      state.rows.unshift(created);
      return route.fulfill({ json: { success: true, forecast_id: created.id, forecast: created, insights: [] } });
    }
    const detailMatch = path.match(/\/sales\/forecasts\/([^/]+)\/$/);
    if (detailMatch) {
      const row = state.rows.find(item => item.id === detailMatch[1]);
      if (!row) return route.fulfill({ status: 404, json: { detail: 'This forecast is unavailable.' } });
      if (method === 'GET') {
        const snapshot = structuredClone(row);
        if (state.detailHolds[row.id]) await state.detailHolds[row.id];
        const status = responseStatus(state.detailStatuses, row.id);
        return route.fulfill({ status, json: status === 200 ? snapshot : { detail: 'This snapshot is no longer available to you.' } });
      }
      if (method === 'PATCH') {
        state.mutations.push({ action: 'edit', body, path });
        const status = responseStatus(state.patchStatuses, row.id);
        if (status !== 200) return route.fulfill({ status, json: { detail: status === 409 ? 'Approved forecast snapshots are immutable.' : 'Changes could not be saved. Your draft is retained.' } });
        Object.assign(row, body);
        return route.fulfill({ json: row });
      }
    }
    const approveMatch = path.match(/\/sales\/forecasts\/([^/]+)\/approve\/$/);
    if (approveMatch && method === 'POST') {
      state.mutations.push({ action: 'approve', body, path });
      const status = responseStatus(state.approveStatuses);
      if (status !== 200) return route.fulfill({ status, json: { detail: 'You do not have permission to approve this snapshot.' } });
      const row = state.rows.find(item => item.id === approveMatch[1]);
      state.rows.filter(item => item.forecast_period === row.forecast_period && item.status === 'approved').forEach(item => { item.status = 'superseded'; });
      Object.assign(row, { status: 'approved', approved_by: 11, approved_at: forecastTime });
      return route.fulfill({ json: row });
    }
    if (method === 'GET' && /\/sales\/(clients|deals|quotes|frameworks|project-handovers|email-intakes)\/$/.test(path))
      return route.fulfill({ json: { count: 0, results: [], next: null } });
    state.unexpected.push({ path, method });
    return route.fulfill({ status: 404, json: { detail: 'Unexpected synthetic API request.' } });
  });
  const entry = configuration.entry || '/sales/forecasts';
  await page.goto(`/tests/fixtures/sales-workspace-shell.html?entry=${encodeURIComponent(entry)}`, { waitUntil: 'domcontentloaded' });
  await expect.poll(async () => state.pageErrors.length > 0 || await page.getByRole('region', { name: 'Forecast planning workspace', exact: true }).count() > 0,
    { timeout: 70000 }).toBe(true);
  expect(state.pageErrors).toEqual([]);
  await expect(page.getByRole('region', { name: 'Forecast planning workspace', exact: true })).toBeVisible({ timeout: 70000 });
  return state;
}
