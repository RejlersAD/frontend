// Synthetic commercial DTO only; previous executive tab fixtures are untouched.
const metric = (id, label, value, extra = {}) => ({
  id, label, value, unit: 'count', status: 'available',
  description: `${label} from the authorized CRM source.`, definition: `${label} uses the recorded authorized source values.`,
  source: 'Synthetic authorized CRM register', reason: null, target: null, trend: null, period: 'current_snapshot', ...extra,
});
const unknown = (id, label, unit = 'currency') => metric(id, label, null, { unit, status: 'unavailable', reason: 'A validated commercial reporting source is not connected.' });
const stageLabels = { lead: 'Lead', qualified: 'Qualified', proposal: 'Proposal', negotiation: 'Negotiation', award_pending: 'Award pending' };
const names = ['North offshore framework', 'Utility control upgrade', 'Coastal pipeline study', 'Eastern compressor services', 'Water treatment design', 'Terminal retrofit assessment', 'Desert gathering concept', 'Marine berth engineering', 'Control migration package', 'Regional grid connection', 'Coastal pumping concept', 'Substation advisory', 'Asset integrity services', 'Gas processing design', 'Northern terminal extension', 'Renewables interface study', 'District cooling review', 'Southern utilities concept', 'Offshore electrical package', 'Regional infrastructure design'];
const opportunities = names.map((name, index) => {
  const stage = ['proposal', 'qualified', 'proposal', 'negotiation', 'award_pending', 'lead'][index % 6];
  const probability = [0, 25, 50, 75, 90][index % 5];
  const value = (index + 1) * 175000;
  const due = stage === 'proposal' ? index === 0 ? '2026-09-12' : index === 2 ? '2026-09-14' : `2026-09-${Math.min(30, 14 + index)}` : null;
  return {
    id: `commercial-${index + 1}`, code: `OPP-${String(index + 1).padStart(3, '0')}`, name,
    client_id: `client-${index % 3 + 1}`, client_name: ['Northern Utility', 'Energy Services', 'Regional Engineering'][index % 3],
    stage, stage_label: stageLabels[stage], estimated_value: String(value), weighted_value: String(value * probability / 100),
    currency: index % 3 === 2 ? 'USD' : 'AED', probability,
    probability_basis: 'Stored CRM probability; normally assigned from the recorded stage.', probability_evidence: null,
    submission_due_date: due, submission_status: null, expected_close_date: `2026-10-${14 + index % 10}`, expected_award_date: null,
    owner: index === 1 ? 'Unassigned' : ['Alex Morgan', 'Sam Reed', 'Taylor Chen'][index % 3],
    bid_owner: null, business_unit: null, risk_level: ['high', 'medium', 'low'][index % 3],
    health: index < 7 ? 'attention' : 'no_recorded_flags',
    flags: index < 7 ? [{ code: 'missing_next_action', title: 'Next action not recorded', detail: 'Confirm the next CRM action and its accountable opportunity owner.' }] : [],
    route: `/sales/opportunities?record=commercial-${index + 1}`,
  };
});
const countCurrencies = rows => Object.fromEntries([...new Set(rows.map(row => row.currency))].map(currency => [currency, rows.filter(row => row.currency === currency).length]));
const sumCurrencies = (rows, key) => [...new Set(rows.map(row => row.currency))].map(currency => ({ currency, amount: String(rows.filter(row => row.currency === currency).reduce((sum, row) => sum + Number(row[key]), 0)) }));

export function commercialFixture(name = 'full') {
  const rows = structuredClone(opportunities);
  const actions = rows.slice(0, 7).map((row, index) => ({
    id: `commercial-action-${index + 1}`, department: 'sales', opportunity_id: row.id, opportunity_name: row.name,
    title: `${row.code}: Next action not recorded`, detail: row.flags[0].detail, severity: ['high', 'medium', 'low'][index % 3],
    owner: row.owner, due_date: null, impact: null, currency: row.currency, action_label: 'Review opportunity', route: row.route,
  }));
  const calendar = rows.filter(row => row.stage === 'proposal').map(row => ({
    ...row, due_date: row.submission_due_date, readiness: null,
    status: row.submission_due_date < '2026-09-14' ? 'past_target_date' : row.submission_due_date === '2026-09-14' ? 'due_today' : 'upcoming',
  }));
  const currencyTotals = sumCurrencies(rows, 'estimated_value');
  const scope = { label: 'Authorized open CRM opportunities', stages: ['lead', 'qualified', 'proposal', 'negotiation', 'award_pending'] };
  const dto = {
    status: 'available', scope, currencies: ['AED', 'USD'], source_updated_at: '2026-09-13T11:00:00Z', source_timestamp_kind: 'latest_record_update',
    kpis: [
      metric('qualified_pipeline', 'Qualified pipeline', null, { unit: 'currency', by_currency: sumCurrencies(rows.filter(row => row.stage !== 'lead'), 'estimated_value') }),
      metric('weighted_pipeline', 'Weighted pipeline', null, { unit: 'currency', by_currency: sumCurrencies(rows, 'weighted_value'), definition: 'Recorded CRM weighted values for open opportunities. Stored probability is normally assigned from the recorded stage; evidence-based win probability is not connected.' }),
      metric('win_rate', 'Win rate', 62.5, { unit: 'percent', definition: 'Recorded awarded and converted outcomes divided by awarded, converted and lost outcomes with close dates in the trailing 365 days. Authorized source across currencies.' }),
      metric('proposals_due_30d', 'Proposals due in 30 days', 6, { definition: 'Proposal-stage opportunities with submission target dates from today through 30 days ahead. Submission completion and readiness are not recorded.' }),
      unknown('framework_backlog', 'Framework backlog'),
    ],
    register: { status: 'available', opportunities: rows, total_rows: rows.length, total_rows_by_currency: countCurrencies(rows), returned_rows: rows.length, truncated: false, scope },
    actions, actions_status: 'available', action_count: actions.length, actions_returned: actions.length, actions_truncated: false,
    bid_calendar: { status: 'available', rows: calendar, total_rows: calendar.length, total_rows_by_currency: countCurrencies(calendar), returned_rows: calendar.length, truncated: false, description: 'Recorded proposal submission target dates, including past target dates; readiness is not recorded.' },
    client_concentration: { status: 'available', by_currency: currencyTotals.map(group => {
      const clients = ['Northern Utility', 'Energy Services', 'Regional Engineering'].map((label, index) => {
        const amount = rows.filter(row => row.currency === group.currency && row.client_name === label).reduce((sum, row) => sum + Number(row.estimated_value), 0);
        return { id: `client-${index + 1}`, label, amount: String(amount), share_pct: amount / Number(group.amount) * 100 };
      }).filter(row => Number(row.amount) > 0).sort((a, b) => Number(b.amount) - Number(a.amount));
      return { currency: group.currency, status: 'available', total: group.amount, clients, top_client_share: clients[0]?.share_pct ?? null, missing_value_count: 0 };
    }), description: 'Recorded open opportunity value by client in each original currency, without FX conversion or inferred concentration thresholds.' },
    resource_demand: { status: 'unavailable', rows: [], description: 'Approved bid staffing demand by discipline is not connected.' },
    pipeline_outlook: { status: 'unavailable', series: [], description: 'Dated award forecasts and an approved pipeline baseline are not connected.' },
    pipeline_movement: { status: 'unavailable', rows: [], description: 'Historical stage transitions and a common reporting baseline are not connected.' },
    commercial_quality: { status: 'available', metrics: [
      metric('missing_owner', 'Missing opportunity owner', 1), metric('missing_next_action', 'Missing next action', 7),
      metric('missing_submission_date', 'Missing proposal target date', 0), metric('invalid_probability', 'Invalid probability', 0),
      metric('weighted_value_mismatches', 'Weighted value mismatches', 0),
    ], description: 'Recorded CRM hygiene checks across authorized open opportunities; no bid readiness or evidence score inferred.' },
    won_handoff: { status: 'available', count: 2, route: '/sales/project-handovers', rows: [], description: 'Approved awarded opportunities without a converted project. Handover readiness is not assessed.' },
  };
  if (name === 'commercial-missing') return undefined;
  if (name === 'commercial-zero' || name === 'commercial-zero-values') {
    dto.register.opportunities.forEach(row => { row.estimated_value = '0.00'; row.weighted_value = '0.00'; row.probability = 0; });
    dto.bid_calendar.rows.forEach(row => { row.estimated_value = '0.00'; row.weighted_value = '0.00'; row.probability = 0; });
    dto.kpis.slice(0, 2).forEach(item => item.by_currency.forEach(group => { group.amount = '0.00'; }));
    dto.client_concentration.by_currency.forEach(group => { group.total = '0.00'; group.top_client_share = null; group.clients.forEach(row => { row.amount = '0.00'; row.share_pct = null; }); });
  }
  if (name === 'commercial-empty') {
    dto.currencies = [];
    dto.kpis.slice(0, 2).forEach(item => { item.by_currency = []; });
    dto.kpis[2] = { ...dto.kpis[2], value: null, status: 'unavailable', reason: 'No recorded closed outcomes in the reporting period.' };
    dto.kpis[3].value = 0;
    Object.assign(dto.register, { opportunities: [], total_rows: 0, total_rows_by_currency: {}, returned_rows: 0 });
    Object.assign(dto.bid_calendar, { rows: [], total_rows: 0, total_rows_by_currency: {}, returned_rows: 0 });
    dto.actions = []; dto.action_count = 0; dto.actions_returned = 0;
    dto.client_concentration.by_currency = [];
    dto.commercial_quality.metrics.forEach(item => { item.value = 0; });
    dto.won_handoff.count = 0;
  }
  if (['commercial-restricted', 'commercial-error'].includes(name)) {
    const status = name.slice('commercial-'.length);
    dto.status = status; dto.currencies = []; dto.source_updated_at = null;
    dto.kpis.forEach(item => { item.status = status; item.value = null; delete item.by_currency; item.reason = `Commercial source is ${status}.`; });
    Object.assign(dto.register, { status, opportunities: [], total_rows: null, total_rows_by_currency: {}, returned_rows: 0 });
    Object.assign(dto.bid_calendar, { status, rows: [], total_rows: null, total_rows_by_currency: {}, returned_rows: 0 });
    dto.actions = []; dto.action_count = null; dto.actions_returned = 0; dto.actions_status = status;
    dto.client_concentration.status = status; dto.client_concentration.by_currency = [];
    dto.commercial_quality.status = status; dto.commercial_quality.metrics.forEach(item => { item.status = status; item.value = null; });
    dto.won_handoff = { ...dto.won_handoff, status, count: null, route: null };
  }
  if (name === 'commercial-incomplete') {
    dto.status = 'partial';
    dto.register.opportunities[0].estimated_value = null; dto.register.opportunities[0].weighted_value = null; dto.register.opportunities[0].probability = null;
    Object.assign(dto.bid_calendar.rows[0], { estimated_value: null, weighted_value: null, probability: null });
    dto.commercial_quality.metrics.find(item => item.id === 'invalid_probability').value = 1;
    dto.kpis.slice(0, 2).forEach(item => { item.status = 'partial'; item.incomplete_currencies = ['AED']; item.by_currency = item.by_currency.filter(group => group.currency === 'USD'); });
    dto.client_concentration.status = 'partial';
    Object.assign(dto.client_concentration.by_currency[0], { status: 'incomplete', total: null, clients: [], top_client_share: null, missing_value_count: 1 });
  }
  if (name === 'commercial-no-handoff-access') dto.won_handoff.route = null;
  if (name === 'commercial-invalid-weighting') {
    const row = dto.register.opportunities[0];
    row.weighted_value = '999999.00';
    row.flags.push({ code: 'invalid_weighting', title: 'Stored weighting is inconsistent', detail: 'The stored weighted amount does not match the recorded value and probability.' });
    const weighted = dto.kpis.find(item => item.id === 'weighted_pipeline');
    weighted.status = 'partial'; weighted.incomplete_currencies = ['AED']; weighted.by_currency = weighted.by_currency.filter(group => group.currency === 'USD');
    dto.commercial_quality.metrics.find(item => item.id === 'weighted_value_mismatches').value = 1;
  }
  if (name === 'commercial-quality-error') {
    dto.commercial_quality.status = 'error';
    dto.commercial_quality.metrics.forEach(item => { item.value = null; item.status = 'error'; item.reason = 'The CRM hygiene source could not be read.'; });
  }
  if (name === 'commercial-many-clients') {
    dto.register.opportunities.forEach((row, index) => { row.client_id = `many-client-${index + 1}`; row.client_name = `Recorded client ${index + 1}`; });
    dto.bid_calendar.rows.forEach(row => { const source = dto.register.opportunities.find(item => item.id === row.id); row.client_id = source.client_id; row.client_name = source.client_name; });
    dto.client_concentration.by_currency.forEach(group => {
      group.clients = dto.register.opportunities.filter(row => row.currency === group.currency).map(row => ({ id: row.client_id, label: row.client_name, amount: row.estimated_value, share_pct: Number(row.estimated_value) / Number(group.total) * 100 })).sort((a, b) => Number(b.amount) - Number(a.amount));
      group.top_client_share = group.clients[0].share_pct;
    });
  }
  if (name === 'commercial-unspecified') {
    dto.currencies = ['UNSPECIFIED'];
    dto.register.opportunities.forEach(row => { row.currency = 'UNSPECIFIED'; });
    dto.register.total_rows_by_currency = { UNSPECIFIED: dto.register.opportunities.length };
    dto.bid_calendar.rows.forEach(row => { row.currency = 'UNSPECIFIED'; });
    dto.bid_calendar.total_rows_by_currency = { UNSPECIFIED: dto.bid_calendar.rows.length };
    dto.actions.forEach(row => { row.currency = 'UNSPECIFIED'; });
    dto.kpis.slice(0, 2).forEach(item => { item.status = 'partial'; item.by_currency = []; item.incomplete_currencies = ['UNSPECIFIED']; });
    dto.client_concentration = { ...dto.client_concentration, status: 'partial', by_currency: [{ currency: 'UNSPECIFIED', status: 'incomplete', total: null, clients: [], top_client_share: null, missing_value_count: 0 }] };
  }
  if (name === 'commercial-winrate-unavailable') Object.assign(dto.kpis[2], { value: null, status: 'unavailable', reason: 'Missing or future close dates prevent a complete closed-outcome denominator.' });
  if (name === 'commercial-truncated') {
    Object.assign(dto.register, { total_rows: 213, total_rows_by_currency: { AED: 153, USD: 60 }, truncated: true });
    Object.assign(dto.bid_calendar, { total_rows: 41, total_rows_by_currency: { AED: 30, USD: 11 }, truncated: true });
    dto.action_count = 87; dto.actions_truncated = true;
  }
  if (name === 'commercial-currency-not-returned') {
    dto.currencies.push('EUR');
    Object.assign(dto.register, { total_rows: 40, total_rows_by_currency: { AED: 14, USD: 6, EUR: 20 }, truncated: true });
    Object.assign(dto.bid_calendar, { total_rows: 12, total_rows_by_currency: { AED: 4, USD: 3, EUR: 5 }, truncated: true });
    dto.kpis[0].by_currency.push({ currency: 'EUR', amount: '500000.00' });
    dto.kpis[1].by_currency.push({ currency: 'EUR', amount: '200000.00' });
    dto.client_concentration.by_currency.push({ currency: 'EUR', status: 'available', total: '500000.00', clients: [{ id: 'eur-client', label: 'Recorded European client', amount: '500000.00', share_pct: 100 }], top_client_share: 100, missing_value_count: 0 });
  }
  if (name === 'commercial-usd-only') {
    dto.currencies = ['USD'];
    dto.register.opportunities = dto.register.opportunities.filter(row => row.currency === 'USD');
    dto.register.total_rows = dto.register.returned_rows = dto.register.opportunities.length;
    dto.register.total_rows_by_currency = countCurrencies(dto.register.opportunities);
    dto.bid_calendar.rows = dto.bid_calendar.rows.filter(row => row.currency === 'USD');
    dto.bid_calendar.total_rows = dto.bid_calendar.returned_rows = dto.bid_calendar.rows.length;
    dto.bid_calendar.total_rows_by_currency = countCurrencies(dto.bid_calendar.rows);
    dto.kpis.slice(0, 2).forEach(item => { item.by_currency = item.by_currency.filter(group => group.currency === 'USD'); });
    dto.client_concentration.by_currency = dto.client_concentration.by_currency.filter(group => group.currency === 'USD');
    dto.actions = dto.actions.filter(row => row.currency === 'USD');
    dto.action_count = dto.actions_returned = dto.actions.length;
    dto.kpis.find(item => item.id === 'proposals_due_30d').value = 3;
    dto.commercial_quality.metrics.find(item => item.id === 'missing_owner').value = 0;
    dto.commercial_quality.metrics.find(item => item.id === 'missing_next_action').value = 2;
  }
  return dto;
}
