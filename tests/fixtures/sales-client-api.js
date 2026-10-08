import { expect } from '@playwright/test';

export const clientTime = '2026-10-01T06:30:00Z';
export const clientId = index => `00000000-0000-4000-8000-${String(1001 + index).padStart(12, '0')}`;
const owners = [
  { id: 11, first_name: 'Sales', last_name: 'team', name: 'Sales team', full_name: 'Sales team' },
  { id: 12, first_name: 'Regional', last_name: 'team', name: 'Regional team', full_name: 'Regional team' },
];
const countries = ['United Arab Emirates', 'Oman', 'Qatar', 'Saudi Arabia', 'Kuwait', 'Bahrain'];
const industries = ['oil_gas', 'manufacturing', 'construction', 'power_generation', 'other', 'manufacturing'];
const statuses = ['active', 'active', 'prospect', 'active', 'prospect', 'inactive'];
const listFields = ['id', 'client_code', 'company_name', 'industry_type', 'client_tier', 'status', 'account_manager',
  'account_manager_name', 'health_score', 'churn_risk', 'lifetime_value', 'last_contact_date', 'created_at',
  'primary_contact', 'active_deals_count', 'total_deal_value', 'tags', 'legal_name', 'trading_name', 'parent_client',
  'country', 'market_sectors', 'verification_status', 'new_proposals_permitted', 'email', 'website'];
const listProjection = row => Object.fromEntries(listFields.map(key => [key, row[key]]));
const detailProjection = row => Object.fromEntries(Object.entries(row).filter(([key]) => ![
  'account_manager_name', 'primary_contact', 'active_deals_count', 'total_deal_value',
].includes(key)));

// Synthetic API records only. Industry/status values follow the current model;
// Client deliberately has no currency field and no invented export endpoint.
export function clientRow(index, changes = {}) {
  const owner = index % 6 === 4 ? null : owners[index % 2];
  const letter = String.fromCharCode(65 + index);
  return {
    id: clientId(index), client_code: `CL-${String(index + 1).padStart(4, '0')}`,
    company_name: `Demo Client ${letter}`, legal_name: `Demo Client ${letter} LLC`, trading_name: '',
    industry_type: industries[index % 6], client_tier: 'bronze', status: statuses[index % 6],
    account_manager: owner?.id || null, account_manager_name: owner?.name || '', account_manager_details: owner,
    country: countries[index % 6], city: index === 0 ? 'Abu Dhabi' : '',
    website: `https://client-${letter.toLowerCase()}.example`, email: '', phone: '', address: '',
    health_score: 50, churn_risk: 'low', lifetime_value: '0.00', last_contact_date: null,
    tags: [], parent_client: null, market_sectors: [], verification_status: 'unverified',
    new_proposals_permitted: true, verified_by: null, verified_at: null, commercial_risks: '', notes: '',
    contacts: index === 0 ? [
      { id: 'contact-1', client: clientId(0), first_name: 'Procurement', last_name: 'desk', full_name: 'Procurement desk',
        email: 'procurement@client-a.example', role_type: 'procurement', is_primary: true, is_active: true },
      { id: 'contact-2', client: clientId(0), first_name: 'Engineering', last_name: 'coordinator', full_name: 'Engineering coordinator',
        email: 'engineering@client-a.example', role_type: 'technical', is_primary: false, is_active: true },
    ] : [],
    recent_activities: [], primary_contact: index === 0 ? 'Procurement desk' : null,
    active_deals_count: index === 0 ? 2 : 0, total_deal_value: index === 0 ? '350000.00' : null,
    deals_summary: { total_count: index === 0 ? 2 : 0, active_count: index === 0 ? 2 : 0, won_count: 0, lost_count: 0,
      total_value: index === 0 ? '350000.00' : null, pipeline_value: null },
    created_at: clientTime, updated_at: clientTime, ...changes,
  };
}

const relatedDefaults = () => ({
  deals: [
    { id: 'deal-1', client: clientId(0), client_name: 'Demo Client A', deal_code: 'VF-2026-0142',
      deal_name: 'FEED Engineering Services', submission_due_date: '2026-10-09', stage: 'proposal',
      estimated_value: '250000.00', currency: 'AED', owner: 11, owner_name: 'Sales team', bid_decision: 'bid' },
    { id: 'deal-2', client: clientId(0), client_name: 'Demo Client A', deal_code: 'VF-2026-0138',
      deal_name: 'Process Safety Study', submission_due_date: '2026-11-02', stage: 'qualified',
      estimated_value: '100000.00', currency: 'AED', owner: 11, owner_name: 'Sales team', bid_decision: 'bid' },
  ],
  quotes: [
    { id: 'quote-1', client: clientId(0), client_name: 'Demo Client A', deal: 'deal-1', deal_code: 'VF-2026-0142',
      quote_number: 'P-2026-0142', deal_name: 'FEED Engineering Services', status: 'draft', version: 1, total_amount: '250000.00', currency: 'AED' },
    { id: 'quote-2', client: clientId(0), client_name: 'Demo Client A', deal: 'deal-2', deal_code: 'VF-2026-0138',
      quote_number: 'P-2026-0138', deal_name: 'Process Safety Study', status: 'draft', version: 1, total_amount: '100000.00', currency: 'AED' },
  ],
  frameworks: [{ id: 'framework-1', client: clientId(0), client_name: 'Demo Client A', framework_number: 'FW-2026-0007',
    title: 'Engineering Services Framework', status: 'active', effective_date: '2026-01-01', expiry_date: '2026-12-31', currency: 'AED', owner: 11 }],
  activities: [{ id: 'activity-1', client: clientId(0), client_name: 'Demo Client A', activity_type: 'meeting',
    activity_type_display: 'Meeting', subject: 'Quarterly relationship review', activity_date: '2026-09-30T08:00:00Z',
    performed_by: 11, performed_by_name: 'Sales team', outcome: 'Reviewed engineering requirements.', created_at: clientTime }],
});

const responseStatus = (configured, key) => {
  const value = typeof configured === 'number' || Array.isArray(configured) ? configured : configured?.[key];
  return Array.isArray(value) ? value.shift() || 200 : value || 200;
};

export async function prepareClients(page, configuration = {}) {
  const state = {
    rows: Array.from({ length: 6 }, (_, index) => clientRow(index)), ...relatedDefaults(),
    listStatus: 200, listPageSize: 3, relatedPageSize: 1, detailStatuses: {}, detailHolds: {},
    relatedStatuses: {}, relatedHolds: {}, patchStatuses: {}, createStatuses: [], contactStatuses: [], activityStatuses: [],
    requests: [], mutations: [], unexpected: [], pageErrors: [], ...configuration,
  };
  page.on('pageerror', error => state.pageErrors.push(error.message));
  await page.clock.setFixedTime(new Date(clientTime));
  await page.addInitScript(() => localStorage.setItem('radai_access_token', 'synthetic-client-user'));
  const paginated = (url, rows, size) => {
    const pageNumber = Math.max(1, Number(url.searchParams.get('page')) || 1);
    const pageSize = Math.min(Number(url.searchParams.get('page_size')) || size, size);
    const start = (pageNumber - 1) * pageSize;
    const nextUrl = new URL(url); nextUrl.searchParams.set('page', String(pageNumber + 1));
    return { count: rows.length, results: rows.slice(start, start + pageSize),
      next: start + pageSize < rows.length ? `${nextUrl.pathname}${nextUrl.search}` : null };
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
    if (path.endsWith('/deals/registration-options/')) return route.fulfill({ json: { owners,
      opportunity_types: [
        { value: 'eio', label: 'EIO' }, { value: 'budgetary', label: 'Budgetary' },
        { value: 'technical', label: 'Technical' }, { value: 'commercial', label: 'Commercial' },
        { value: 'techno_commercial', label: 'Techno Commerical' }, { value: 'other', label: 'Others' },
        { value: 'tender', label: 'Tender' }, { value: 'rfq', label: 'RFQ' },
        { value: 'eoi', label: 'EOI' }, { value: 'direct_enquiry', label: 'Direct enquiry' },
      ], default_owner: 11 } });
    if (path.endsWith('/clients/') && method === 'GET') {
      if (state.listStatus !== 200) return route.fulfill({ status: state.listStatus, json: { detail: 'The client register could not be loaded.' } });
      return route.fulfill({ json: paginated(url, state.rows.map(listProjection), state.listPageSize) });
    }
    if (path.endsWith('/clients/') && method === 'POST') {
      state.mutations.push({ action: 'create', body, path });
      const status = responseStatus(state.createStatuses);
      if (status !== 200) return route.fulfill({ status, json: { company_name: ['The client could not be saved. Check the company name and retry.'] } });
      const created = clientRow(state.rows.length + 30, body); state.rows.unshift(created);
      return route.fulfill({ status: 201, json: detailProjection(created) });
    }
    const clientMatch = path.match(/\/sales\/clients\/([^/]+)\/$/);
    if (clientMatch) {
      const row = state.rows.find(item => item.id === clientMatch[1]);
      if (!row) return route.fulfill({ status: 404, json: { detail: 'This client is unavailable.' } });
      if (method === 'GET') {
        const snapshot = structuredClone(detailProjection(row));
        if (state.detailHolds[row.id]) await state.detailHolds[row.id];
        const status = responseStatus(state.detailStatuses, row.id);
        return route.fulfill({ status, json: status === 200 ? snapshot : { detail: 'This client is no longer available to you.' } });
      }
      if (method === 'PATCH') {
        state.mutations.push({ action: 'edit', body, path });
        const status = responseStatus(state.patchStatuses, row.id);
        if (status !== 200) return route.fulfill({ status, json: { detail: 'Changes could not be saved. Your draft is retained.' } });
        Object.assign(row, body);
        return route.fulfill({ json: detailProjection(row) });
      }
    }
    const relatedMatch = path.match(/\/sales\/(deals|quotes|frameworks|activities)\/$/);
    if (relatedMatch && method === 'GET') {
      const resource = relatedMatch[1], client = url.searchParams.get('client');
      const scopedRows = state[resource].filter(row => !client || row.client === client);
      const snapshot = structuredClone(paginated(url, scopedRows, state.relatedPageSize));
      const key = `${resource}:${client || 'all'}`;
      if (state.relatedHolds[key]) await state.relatedHolds[key];
      const status = responseStatus(state.relatedStatuses, key);
      return route.fulfill({ status, json: status === 200 ? snapshot : { detail: 'Linked records are unavailable.' } });
    }
    if (path.endsWith('/contacts/') && method === 'GET') {
      const client = url.searchParams.get('client');
      return route.fulfill({ json: paginated(url, state.rows.flatMap(row => row.contacts).filter(row => !client || row.client === client), 3) });
    }
    if (path.endsWith('/contacts/') && method === 'POST') {
      state.mutations.push({ action: 'contact', body, path });
      const status = responseStatus(state.contactStatuses);
      if (status !== 200) return route.fulfill({ status, json: { detail: 'Contact could not be saved. Your input is retained.' } });
      const created = { ...body, id: `contact-${state.mutations.length + 10}`, full_name: `${body.first_name} ${body.last_name}` };
      state.rows.find(row => row.id === body.client)?.contacts.push(created);
      return route.fulfill({ status: 201, json: created });
    }
    if (path.endsWith('/activities/') && method === 'POST') {
      state.mutations.push({ action: 'activity', body, path });
      const status = responseStatus(state.activityStatuses);
      if (status !== 200) return route.fulfill({ status, json: { detail: 'Activity could not be saved. Your input is retained.' } });
      const created = { ...body, id: `activity-${state.mutations.length + 10}`, performed_by: 11, performed_by_name: 'Sales team', created_at: clientTime };
      state.activities.unshift(created);
      return route.fulfill({ status: 201, json: created });
    }
    if (method === 'GET' && /\/sales\/(forecasts|project-handovers|email-intakes)\/$/.test(path))
      return route.fulfill({ json: { count: 0, results: [], next: null } });
    state.unexpected.push({ path, method });
    return route.fulfill({ status: 404, json: { detail: 'Unexpected synthetic API request.' } });
  });
  const entry = configuration.entry || '/sales/clients';
  await page.goto(`/tests/fixtures/sales-workspace-shell.html?entry=${encodeURIComponent(entry)}`, { waitUntil: 'domcontentloaded' });
  await expect.poll(async () => state.pageErrors.length > 0 || await page.getByRole('region', { name: 'Client register', exact: true }).count() > 0,
    { timeout: 70000 }).toBe(true);
  expect(state.pageErrors).toEqual([]);
  await expect(page.getByRole('region', { name: 'Client register', exact: true })).toBeVisible({ timeout: 70000 });
  return state;
}
