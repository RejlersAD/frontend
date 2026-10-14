// Synthetic additive DTO. Legacy Overview and Financial fixtures stay unchanged.
const metric = (id, label, value, extra = {}) => ({
  id, label, value, unit: 'count', status: 'available',
  definition: `${label} from authorized open project records.`,
  description: `${label} reflects the current accessible project register.`,
  source: 'Synthetic authorized project register', reason: null,
  target: null, trend: null, period: 'current_snapshot', ...extra,
});
const unknown = (id, label, unit = 'percent') => metric(id, label, null, {
  unit, status: 'unavailable', reason: 'A verified project reporting source is not connected.',
});
const names = ['North offshore upgrade', 'Utility connection', 'Pipeline integrity assessment', 'Eastern compressor station', 'Water treatment expansion', 'Terminal electrical retrofit', 'Desert gas gathering', 'Marine berth rehabilitation', 'Control system migration', 'Northwest solar connection', 'Coastal pumping station', 'Substation reliability review', 'Regional asset integrity'];
const projectRows = names.map((name, index) => ({
  id: `portfolio-${index + 1}`, code: `PRJ-${String(index + 1).padStart(3, '0')}`, name,
  status: ['active', 'planning', 'active', 'on_hold'][index % 4],
  client_name: ['Northern Utility', 'Energy Services', 'Regional Engineering'][index % 3],
  contract_value: String((index + 1) * 150000), currency: index % 3 === 1 ? 'USD' : 'AED',
  owner: index === 1 ? 'Unassigned' : ['Alex Morgan', 'Sam Reed', 'Taylor Chen'][index % 3],
  health: ['critical', 'high', 'medium', 'clear', 'low', 'unknown'][index % 6],
  exception_count: [4, 2, 1, 0, 1, 0][index % 6],
  progress_pct: index === 0 ? 0 : index === 1 ? null : Math.min(99, index * 7),
  phase: null, business_unit: null, schedule_variance: null, forecast_margin: null,
  route: `/projects?project=portfolio-${index + 1}&view=dashboard`,
  data_date: index === 1 ? null : '2026-09-13T10:00:00Z',
  next_milestone: index < 4 ? {
    id: `milestone-${index + 1}`, name: ['Design review', 'Equipment acceptance', 'Construction handover', 'Commissioning readiness'][index],
    due_date: ['2026-09-12', '2026-09-14', '2026-09-18', '2026-09-28'][index],
    status: ['overdue', 'due_today', 'upcoming', 'upcoming'][index], owner: null,
    project_owner: ['Alex Morgan', 'Unassigned', 'Taylor Chen', 'Alex Morgan'][index],
    readiness: null, route: `/projects?project=portfolio-${index + 1}&view=plan-baseline`,
  } : null,
  causes: index % 6 < 3 ? [{ code: `recorded-risk-${index}`, category: 'governance', title: 'Recorded delivery risk', detail: 'Review the recorded mitigation and confirm the accountable next action.', severity: ['critical', 'high', 'medium'][index % 6] }] : [],
}));

export function portfolioFixture(name = 'full') {
  const projects = structuredClone(projectRows);
  const byCurrency = ['AED', 'USD'].map(currency => ({ currency, amount: String(projects.filter(row => row.currency === currency).reduce((total, row) => total + Number(row.contract_value), 0)) }));
  const counts = { critical: 3, high: 2, medium: 2, low: 2, clear: 2, unknown: 2, total: 13 };
  const actions = projects.filter(row => row.causes.length).map((row, index) => ({
    id: `portfolio-action-${index + 1}`, department: 'project_control', project_id: row.id, project_name: row.name,
    title: `${row.code}: ${row.causes[0].title}`, detail: row.causes[0].detail,
    severity: row.health, owner: row.owner, due_date: null, impact: null,
    action_label: 'Review project', route: row.route,
  }));
  const milestones = projects.filter(row => row.next_milestone).map(row => ({ ...row.next_milestone, project_id: row.id, project_code: row.code, project_name: row.name }));
  const scope = { label: 'Authorized open projects', project_statuses: ['planning', 'active', 'on_hold'] };
  const dto = {
    status: 'available', scope, source_updated_at: '2026-09-13T10:00:00Z', source_timestamp_kind: 'latest_record_update',
    kpis: [metric('active_projects', 'Active projects', projects.filter(row => row.status === 'active').length), metric('contract_value', 'Contract value', null, { unit: 'currency', by_currency: byCurrency }), unknown('forecast_margin', 'Forecast margin'), unknown('schedule_confidence', 'Schedule confidence'), unknown('revenue_remaining', 'Revenue remaining', 'currency')],
    register: { status: 'available', projects, total_rows: projects.length, returned_rows: projects.length, truncated: false, scope },
    health: { status: 'available', counts, causes: [{ category: 'governance', label: 'Governance', project_count: 7, exception_count: 18 }], metrics: [metric('contract_value_at_risk', 'Contract value at risk', null, { unit: 'currency', by_currency: ['AED', 'USD'].map(currency => ({ currency, amount: String(projects.filter(row => ['critical', 'high'].includes(row.health) && row.currency === currency).reduce((sum, row) => sum + Number(row.contract_value), 0)) })) }), unknown('revenue_at_risk', 'Revenue at risk', 'currency')] },
    actions, action_count: actions.length, actions_returned: actions.length, actions_truncated: false, actions_status: 'available',
    milestones: { status: 'available', rows: milestones, total_rows: milestones.length, returned_rows: milestones.length, truncated: false,
      metrics: [metric('due_30d', 'Due in next 30 days', 3), metric('overdue', 'Overdue', 1), unknown('at_risk', 'At-risk milestones', 'count'), unknown('first_submission_acceptance', 'First submission acceptance')], source_updated_at: '2026-09-13T10:00:00Z', description: 'Recorded project milestones due within 30 days or overdue.' },
    delivery_capacity: { status: 'unavailable', rows: [], description: 'Project staffing demand and assigned capacity are not connected.' },
    concentration: { status: 'available', by_client: ['Northern Utility', 'Energy Services', 'Regional Engineering'].map(label => ({ label, project_count: projects.filter(row => row.client_name === label).length, by_currency: ['AED', 'USD'].flatMap(currency => { const rows = projects.filter(row => row.client_name === label && row.currency === currency); return rows.length ? [{ currency, amount: String(rows.reduce((sum, row) => sum + Number(row.contract_value), 0)) }] : []; }) })),
      by_currency: byCurrency.map(row => {
        const currencyProjects = projects.filter(project => project.currency === row.currency);
        const clients = ['Northern Utility', 'Energy Services', 'Regional Engineering'].map(label => ({ label, amount: currencyProjects.filter(project => project.client_name === label).reduce((sum, project) => sum + Number(project.contract_value), 0) })).sort((a, b) => b.amount - a.amount);
        const topFive = currencyProjects.map(project => Number(project.contract_value)).sort((a, b) => b - a).slice(0, 5).reduce((sum, amount) => sum + amount, 0);
        return { currency: row.currency, status: 'available', total: row.amount, top_client: { label: clients[0].label, amount: String(clients[0].amount), share_pct: clients[0].amount / Number(row.amount) * 100 }, top_five_projects: { amount: String(topFive), share_pct: topFive / Number(row.amount) * 100 }, missing_contract_count: 0 };
      }), description: 'Recorded contract exposure by client in original currencies. This is not revenue concentration.' },
    delivery_outlook: { status: 'unavailable', series: [], scatter: [], description: 'Baseline delivery phasing and project financial forecasts are not connected.' },
  };
  if (name === 'portfolio-missing') return undefined;
  if (name === 'portfolio-zero') {
    dto.kpis[0].value = 0;
    dto.kpis[1].by_currency = [];
    dto.register = { ...dto.register, projects: [], total_rows: 0, returned_rows: 0 };
    dto.health.counts = Object.fromEntries(Object.keys(counts).map(key => [key, 0]));
    dto.health.causes = [];
    dto.health.metrics[0].by_currency = [];
    dto.actions = []; dto.action_count = 0; dto.actions_returned = 0;
    dto.milestones.rows = []; dto.milestones.total_rows = 0; dto.milestones.returned_rows = 0;
    dto.milestones.metrics.slice(0, 2).forEach(row => { row.value = 0; });
    dto.concentration.by_client = []; dto.concentration.by_currency = [];
  }
  if (['portfolio-restricted', 'portfolio-error', 'portfolio-unavailable'].includes(name)) {
    const status = name.slice('portfolio-'.length);
    dto.status = status; dto.source_updated_at = null; dto.source_timestamp_kind = null;
    dto.kpis.forEach(row => { row.status = status; row.value = null; delete row.by_currency; row.reason = `Project register is ${status}.`; });
    dto.register = { ...dto.register, status, projects: [], total_rows: null, returned_rows: 0 };
    dto.actions = []; dto.action_count = null; dto.actions_returned = 0; dto.actions_status = status;
    dto.health = { status, counts: null, causes: [], metrics: [] };
    dto.milestones = { ...dto.milestones, status, rows: [], total_rows: null, returned_rows: 0, metrics: dto.milestones.metrics.map(row => ({ ...row, status, value: null })) };
    dto.concentration = { ...dto.concentration, status, by_client: [], by_currency: [] };
  }
  if (name === 'portfolio-incomplete') {
    dto.kpis[1].status = 'partial'; dto.kpis[1].by_currency = dto.kpis[1].by_currency.filter(row => row.currency === 'USD'); dto.kpis[1].incomplete_currencies = ['AED', 'UNSPECIFIED'];
    dto.register.projects[0].contract_value = null;
    dto.register.projects[2].currency = null;
    dto.concentration.by_currency = dto.concentration.by_currency.map(row => row.currency === 'AED' ? { ...row, status: 'incomplete', total: null, top_client: null, top_five_projects: null, missing_contract_count: 1 } : row);
    dto.concentration.by_currency.push({ currency: 'UNSPECIFIED', status: 'incomplete', total: null, top_client: null, top_five_projects: null, missing_contract_count: 1 });
  }
  if (name === 'portfolio-zero-contract') {
    dto.register.projects.forEach(row => { row.contract_value = '0.00'; });
    dto.kpis[1].by_currency.forEach(row => { row.amount = '0.00'; });
    dto.health.metrics[0].by_currency.forEach(row => { row.amount = '0.00'; });
    dto.concentration.by_client.forEach(client => client.by_currency.forEach(row => { row.amount = '0.00'; }));
    dto.concentration.by_currency.forEach(group => { group.total = '0.00'; group.top_client = null; group.top_five_projects = null; });
  }
  if (name === 'portfolio-health-error') {
    dto.health = { status: 'error', counts: null, causes: [], metrics: [] };
    dto.actions = []; dto.action_count = null; dto.actions_returned = 0; dto.actions_status = 'error';
    dto.register.projects.forEach(row => { row.health = 'unknown'; row.causes = []; row.exception_count = 0; });
  }
  if (name === 'portfolio-health-partial') {
    dto.status = 'partial'; dto.health.status = 'partial';
    dto.health.counts = { critical: 0, high: 0, medium: 0, low: 0, clear: 0, unknown: 13, total: 13 };
    dto.health.causes = [];
    dto.actions = []; dto.action_count = null; dto.actions_returned = 0; dto.actions_status = 'partial';
    dto.register.projects.forEach(row => { row.health = 'unknown'; row.causes = []; row.exception_count = 0; });
  }
  if (name === 'portfolio-milestone-error') {
    dto.milestones = { ...dto.milestones, status: 'error', rows: [], total_rows: null, returned_rows: 0, metrics: dto.milestones.metrics.map(row => ({ ...row, status: 'error', value: null })) };
    dto.register.projects.forEach(row => { row.next_milestone = null; });
  }
  if (name === 'portfolio-truncated') {
    Object.assign(dto.register, { total_rows: 213, truncated: true });
    dto.action_count = 87; dto.actions_truncated = true;
    Object.assign(dto.milestones, { total_rows: 41, truncated: true });
  }
  return dto;
}
