// Synthetic aggregate-only DTO. No employee identifiers, names or pay data.
const metric = (id, label, value, extra = {}) => ({
  id, label, value, unit: 'count', status: 'available',
  description: `${label} from current authorized HR aggregates.`, definition: `${label} uses the source population and recorded lifecycle dates.`,
  source: 'Synthetic authorized HR aggregate', reason: null, target: null, trend: null, period: 'current_snapshot', ...extra,
});
const unknown = (id, label, unit = 'percent') => metric(id, label, null, { unit, status: 'unavailable', reason: 'An approved workforce reporting source for this measure is not connected.' });
const departments = [['engineering', 'Engineering', 48], ['project_control', 'Project Control', 22], ['finance', 'Finance', 12], ['sales', 'Sales', 8], ['procurement', 'Procurement', 10], ['qhse', 'QHSE', 8], ['hr', 'Human Resources', 7], ['it', 'Information Technology', 6], ['administration', 'Administration', 4], ['unassigned', 'Unassigned', 2]];
const distribution = (rows, description) => ({ status: 'available', rows: rows.map(([label, count]) => ({ label, count })), total: 127, unit: 'people', description });

export function workforceFixture(name = 'full') {
  const quality = [
    metric('missing_department', 'Missing department', 2), metric('missing_office', 'Missing office', 3),
    metric('missing_business_unit', 'Missing business unit', 1), metric('invalid_lifecycle_dates', 'Invalid lifecycle dates', 1),
  ];
  const actions = quality.map((row, index) => ({
    id: `workforce-action-${row.id}`, department: 'hr', title: `Review ${row.label.toLowerCase()}`,
    detail: `${row.value} aggregate HR records require ${row.label.toLowerCase()} review. Individual personnel details remain in the authorized HR workspace.`,
    severity: index === 3 ? 'high' : 'medium', owner: 'HR', action_label: 'Review HR records', route: '/hr/employees', due_date: null, impact: null,
  }));
  const dto = {
    status: 'available', scope: { label: 'Authorized current workforce aggregates', as_of_date: '2026-09-14', unit: 'people', aggregate_only: true },
    source_updated_at: '2026-09-13T12:00:00Z', source_timestamp_kind: 'latest_record_update',
    kpis: [metric('headcount', 'Headcount', 127), unknown('billable_utilisation', 'Billable utilisation'), unknown('critical_vacancies', 'Critical vacancies', 'count'), unknown('voluntary_turnover', 'Voluntary turnover'), unknown('capacity_coverage', 'Capacity coverage')],
    capacity_plan: { status: 'available', basis: 'department_headcount', unit: 'people', rows: departments.map(([id, department, headcount]) => ({
      id: `department-${id}`, department, headcount, fte: null, billable_utilisation: null, committed_demand: null, weighted_demand: null,
      capacity_gap: null, critical_roles: null, owner: null, health: 'unavailable', route: '/hr/employees',
    })), total_rows: departments.length, returned_rows: departments.length, truncated: false,
      description: 'Current employees grouped by recorded department. Department headcount is not FTE, discipline capacity or project staffing.' },
    actions, actions_status: 'available', action_count: actions.length, actions_returned: actions.length, actions_truncated: false,
    workforce_movement: { status: 'available', metrics: [metric('joiners_30d', 'Recorded joiners in 30 days', 3), metric('recorded_exits_30d', 'Recorded exits in 30 days', 3)],
      series: [['2026-04-01', 'Apr 2026', 2, 1], ['2026-05-01', 'May 2026', 4, 0], ['2026-06-01', 'Jun 2026', 3, 2], ['2026-07-01', 'Jul 2026', 5, 1], ['2026-08-01', 'Aug 2026', 2, 3], ['2026-09-01', 'Sep 2026', 1, 0]].map(([month, label, joiners, exits]) => ({ month, label, joiners, exits })),
      period_start: '2026-04-01', period_end: '2026-09-14', description: 'Recorded join and exit dates in the last six calendar months. Current month is partial through 14 September; these counts are not historical headcount.' },
    supply_demand_outlook: { status: 'unavailable', series: [], description: 'Approved staffing supply and committed/weighted demand series are not connected.' },
    critical_roles: { status: 'unavailable', rows: [], description: 'An approved critical-role register and vacancy requirements are not connected.' },
    project_coverage_risk: { status: 'unavailable', rows: [], description: 'Approved project staffing requirements and resource assignments are not connected.' },
    retention_mobility: { status: 'available', metrics: [metric('notice_period', 'Employees on notice', 5), unknown('voluntary_turnover', 'Voluntary turnover'), unknown('internal_mobility', 'Internal mobility'), unknown('retention_risk', 'Retention risk', 'count')], description: 'Notice status is an authorized current employee aggregate; individual retention predictions and mobility evidence are not connected.' },
    distribution: {
      office: distribution([['Dubai', 70], ['Abu Dhabi', 35], ['Sharjah', 19], ['Unassigned', 3]], 'Recorded office assignment of current employees.'),
      branch: distribution([['Gulf', 96], ['Europe', 31]], 'Recorded branch assignment of current employees.'),
      business_unit: distribution([['Energy', 74], ['Infrastructure', 52], ['Unassigned', 1]], 'Recorded business unit assignment of current employees.'),
      employment_type: { status: 'unavailable', rows: [], total: null, unit: 'people', description: 'Employment type is not recorded in this reporting source.' },
    },
    data_quality: { status: 'available', metrics: quality, description: 'Specific aggregate field and lifecycle-date checks; no individual records or salary data are returned.' },
  };
  if (name === 'workforce-missing') return undefined;
  if (name === 'workforce-zero') {
    dto.kpis[0].value = 0;
    Object.assign(dto.capacity_plan, { rows: [], total_rows: 0, returned_rows: 0 });
    dto.actions = []; dto.action_count = 0; dto.actions_returned = 0;
    dto.workforce_movement.metrics.forEach(row => { row.value = 0; });
    dto.workforce_movement.series.forEach(row => { row.joiners = 0; row.exits = 0; });
    dto.retention_mobility.metrics[0].value = 0;
    for (const key of ['office', 'branch', 'business_unit']) Object.assign(dto.distribution[key], { rows: [], total: 0 });
    dto.data_quality.metrics.forEach(row => { row.value = 0; });
  }
  if (['workforce-empty', 'workforce-restricted', 'workforce-error'].includes(name)) {
    const status = name === 'workforce-empty' ? 'unavailable' : name.slice('workforce-'.length);
    dto.status = status; dto.source_updated_at = null; dto.source_timestamp_kind = null;
    Object.assign(dto.kpis[0], { value: null, status, reason: `The authorized HR aggregate source is ${status}.` });
    Object.assign(dto.capacity_plan, { status, rows: [], total_rows: null, returned_rows: 0 });
    dto.actions = []; dto.actions_status = status; dto.action_count = null; dto.actions_returned = 0;
    Object.assign(dto.workforce_movement, { status, series: [], metrics: dto.workforce_movement.metrics.map(row => ({ ...row, value: null, status })) });
    dto.retention_mobility.status = status; Object.assign(dto.retention_mobility.metrics[0], { value: null, status });
    for (const key of ['office', 'branch', 'business_unit']) Object.assign(dto.distribution[key], { status, rows: [], total: null });
    dto.data_quality.status = status; dto.data_quality.metrics.forEach(row => { row.value = null; row.status = status; });
  }
  if (name === 'workforce-partial') {
    dto.status = 'partial';
    Object.assign(dto.workforce_movement, { status: 'error', series: [], metrics: dto.workforce_movement.metrics.map(row => ({ ...row, value: null, status: 'error' })) });
    dto.distribution.office = { ...dto.distribution.office, status: 'error', rows: [], total: null };
  }
  if (name === 'workforce-movement-zero') {
    dto.workforce_movement.metrics.forEach(row => { row.value = 0; });
    dto.workforce_movement.series.forEach(row => { row.joiners = 0; row.exits = 0; });
  }
  if (name === 'workforce-many-offices') dto.distribution.office = distribution([['Office A', 50], ['Office B', 30], ['Office C', 20], ['Office D', 15], ['Office E', 10], ['Unassigned', 2]], 'Recorded organizational office assignment of current employees.');
  if (name === 'workforce-distribution-incomplete') dto.distribution.office.total = 130;
  if (name === 'workforce-truncated') {
    Object.assign(dto.capacity_plan, { total_rows: 210, truncated: true });
    dto.action_count = 41; dto.actions_truncated = true;
  }
  return dto;
}
