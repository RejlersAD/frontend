import { expect } from '@playwright/test';

export const frameworkTime = '2026-10-01T06:30:00Z';
export const frameworkId = index => `00000000-0000-4000-8000-${String(8001 + index).padStart(12, '0')}`;
export const frameworkClientId = index => `00000000-0000-4000-8000-${String(1001 + index).padStart(12, '0')}`;
const titles = ['Engineering Services Framework', 'Plant Support', 'Design Services', 'Specialist Studies', 'Asset Integrity', 'Technical Support'];
const statuses = ['active', 'active', 'active', 'draft', 'suspended', 'expired'];
const expiryDates = ['2026-12-31', '2027-06-30', '2027-03-31', '2027-12-31', '2026-12-31', '2026-08-31'];

// Synthetic records use FrameworkAgreementSerializer. Its remaining_value is
// ceiling minus committed; it has no reservation, revision or call-off registry.
export function frameworkRow(index = 0, changes = {}) {
  const slot = index % 6;
  const ceiling = slot === 0 ? '5000000.00' : slot === 1 ? '1000000.00' : slot === 2 ? '2000000.00' : null;
  const committed = slot === 0 ? '3200000.00' : slot === 1 ? '200000.00' : slot === 2 ? '800000.00' : '0.00';
  const record = {
    id: frameworkId(index), framework_number: `FW-2026-${String(7 - index > 0 ? 7 - index : 20 + index).padStart(4, '0')}`,
    title: titles[slot], client: frameworkClientId(slot), client_name: `Demo Client ${String.fromCharCode(65 + slot)}`,
    owner: 12, owner_name: 'Contracts team', status: statuses[slot],
    effective_date: '2026-01-01', expiry_date: expiryDates[slot], renewal_action_date: null,
    included_services: ['engineering_design', 'consulting'], disciplines: ['process', 'electrical'],
    geographic_coverage: ['United Arab Emirates'], currency: 'AED', ceiling_value: ceiling,
    committed_value: committed, invoiced_value: '1000000.00',
    remaining_value: ceiling === null ? null : (Number(ceiling) - Number(committed)).toFixed(2),
    is_eligible: statuses[slot] === 'active',
    rate_cards: slot === 0 ? [{ version: '2026.1', effective_from: '2026-01-01', status: 'approved' }] : [],
    rate_escalation_method: '', call_off_procedure: 'Written scope and purchase order required.',
    payment_terms: 'Net 30', liability_requirements: '', insurance_requirements: '', compliance_requirements: [],
    signed_document: slot === 0 ? 'agreements/FW-2026-0007-signed.pdf' : '', amendments: [],
    approved_by: statuses[slot] === 'active' ? 13 : null,
    approved_at: statuses[slot] === 'active' ? '2026-01-01T06:00:00Z' : null,
    created_at: '2026-01-01T05:00:00Z', updated_at: frameworkTime, ...changes,
  };
  return record;
}

const responseStatus = (configured, key) => {
  const value = typeof configured === 'number' || Array.isArray(configured) ? configured : configured?.[key];
  return Array.isArray(value) ? value.shift() || 200 : value || 200;
};

export async function prepareFrameworks(page, configuration = {}) {
  const state = {
    rows: Array.from({ length: 6 }, (_, index) => frameworkRow(index)),
    clients: Array.from({ length: 6 }, (_, index) => ({ id: frameworkClientId(index), client_code: `CL-${String(index + 1).padStart(4, '0')}`,
      company_name: `Demo Client ${String.fromCharCode(65 + index)}`, legal_name: `Demo Client ${String.fromCharCode(65 + index)} LLC`, status: 'active' })),
    listStatus: 200, listPageSize: 3, listHold: null, detailStatuses: {}, detailHolds: {},
    patchStatuses: {}, createStatuses: [], activateStatuses: [], requests: [], mutations: [], unexpected: [], pageErrors: [],
    ...configuration,
  };
  page.on('pageerror', error => state.pageErrors.push(error.message));
  await page.clock.setFixedTime(new Date(frameworkTime));
  await page.addInitScript(() => localStorage.setItem('radai_access_token', 'synthetic-framework-user'));
  const paginated = (url, records, size) => {
    const pageNumber = Math.max(1, Number(url.searchParams.get('page')) || 1);
    const pageSize = Math.min(Number(url.searchParams.get('page_size')) || size, size);
    const start = (pageNumber - 1) * pageSize;
    const nextUrl = new URL(url); nextUrl.searchParams.set('page', String(pageNumber + 1));
    return { count: records.length, results: records.slice(start, start + pageSize),
      next: start + pageSize < records.length ? `${nextUrl.pathname}${nextUrl.search}` : null };
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
    if (path.endsWith('/frameworks/') && method === 'GET') {
      const snapshot = structuredClone(paginated(url, state.rows, state.listPageSize));
      if (state.listHold) await state.listHold;
      const status = responseStatus(state.listStatus);
      return route.fulfill({ status, json: status === 200 ? snapshot : { detail: 'The framework register could not be loaded.' } });
    }
    if (path.endsWith('/frameworks/') && method === 'POST') {
      state.mutations.push({ action: 'create', body, path });
      const status = responseStatus(state.createStatuses);
      if (status !== 200) return route.fulfill({ status, json: { title: ['The framework could not be saved. Check the agreement details and retry.'] } });
      const created = frameworkRow(30 + state.mutations.length, { ...body, client_name: state.clients.find(client => client.id === body.client)?.company_name,
        is_eligible: false, approved_by: null, approved_at: null, rate_cards: [], remaining_value: body.ceiling_value });
      state.rows.unshift(created);
      return route.fulfill({ status: 201, json: created });
    }
    const detailMatch = path.match(/\/sales\/frameworks\/([^/]+)\/$/);
    if (detailMatch) {
      const row = state.rows.find(item => item.id === detailMatch[1]);
      if (!row) return route.fulfill({ status: 404, json: { detail: 'This framework is unavailable.' } });
      if (method === 'GET') {
        const snapshot = structuredClone(row);
        if (state.detailHolds[row.id]) await state.detailHolds[row.id];
        const status = responseStatus(state.detailStatuses, row.id);
        return route.fulfill({ status, json: status === 200 ? snapshot : { detail: 'This agreement is no longer available to you.' } });
      }
      if (method === 'PATCH') {
        state.mutations.push({ action: 'edit', body, path });
        const status = responseStatus(state.patchStatuses, row.id);
        if (status !== 200) return route.fulfill({ status, json: { detail: 'Changes could not be saved. Your draft is retained.' } });
        Object.assign(row, body);
        return route.fulfill({ json: row });
      }
    }
    const activateMatch = path.match(/\/sales\/frameworks\/([^/]+)\/activate\/$/);
    if (activateMatch && method === 'POST') {
      state.mutations.push({ action: 'activate', body, path });
      const status = responseStatus(state.activateStatuses);
      if (status !== 200) return route.fulfill({ status, json: { detail: 'You do not have permission to activate this agreement.' } });
      const row = state.rows.find(item => item.id === activateMatch[1]);
      Object.assign(row, { status: 'active', is_eligible: true, approved_by: 11, approved_at: frameworkTime });
      return route.fulfill({ json: row });
    }
    if (path.endsWith('/clients/') && method === 'GET') return route.fulfill({ json: paginated(url, state.clients, 100) });
    const clientMatch = path.match(/\/sales\/clients\/([^/]+)\/$/);
    if (clientMatch && method === 'GET') return route.fulfill({ json: state.clients.find(client => client.id === clientMatch[1]) });
    if (method === 'GET' && /\/sales\/(deals|quotes|forecasts|activities|project-handovers|email-intakes)\/$/.test(path))
      return route.fulfill({ json: { count: 0, results: [], next: null } });
    state.unexpected.push({ path, method });
    return route.fulfill({ status: 404, json: { detail: 'Unexpected synthetic API request.' } });
  });
  const entry = configuration.entry || '/sales/frameworks';
  await page.goto(`/tests/fixtures/sales-workspace-shell.html?entry=${encodeURIComponent(entry)}`, { waitUntil: 'domcontentloaded' });
  await expect.poll(async () => state.pageErrors.length > 0 || await page.getByRole('region', { name: 'Framework register', exact: true }).count() > 0,
    { timeout: 70000 }).toBe(true);
  expect(state.pageErrors).toEqual([]);
  await expect(page.getByRole('region', { name: 'Framework register', exact: true })).toBeVisible({ timeout: 70000 });
  return state;
}
