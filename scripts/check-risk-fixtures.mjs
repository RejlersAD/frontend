// Deliberately synthetic source facts; never substitutes QHSE flags for enterprise risks.
const metric = (id, label, value, extra = {}) => ({
  id, label, value, unit: 'count', status: 'available',
  source: 'Synthetic authorized assurance source', description: `${label} reported by the authorized source.`,
  definition: `${label} counts the specified source records, not enterprise risks or safety incidents.`,
  reason: null, target: null, trend: null, period: 'current_snapshot', ...extra,
});
const unknown = (id, label, unit = 'count') => metric(id, label, null, {
  unit, status: 'unavailable', source: 'Verified assurance register required',
  reason: 'The required enterprise risk, mitigation, incident, obligation or item-level finding register is not connected.',
});
const sourceStamp = { source_updated_at: '2026-09-13T10:00:00Z', source_timestamp_kind: 'latest_record_update' };
const blank = description => ({ status: 'unavailable', rows: [], description });

export function riskFixture(name = 'full') {
  const followups = Array.from({ length: 12 }, (_, index) => {
    const audit = index % 3 === 0;
    return {
      id: `assurance-${index + 1}`, source_type: audit ? 'qhse_audit' : 'project_quality',
      source: audit ? 'Authorized QHSE audit schedule' : 'Authorized project quality records',
      project_code: `ASS-${String(index + 1).padStart(3, '0')}`,
      project_name: ['Offshore upgrade', 'Utility connection', 'Pipeline integrity', 'Terminal expansion'][index % 4],
      category: audit ? 'audit_schedule' : 'quality', title: audit ? 'Audit target date passed' : index % 2 ? 'Recorded corrective-action delay' : 'Recorded observation delay',
      detail: audit ? 'The recorded audit target date is in the past; completion evidence is not inferred from the schedule.' : 'A project-level quality delay flag is recorded. This does not establish an overdue individual mitigation or finding.',
      recorded_owner: index === 4 ? null : audit ? 'Recorded auditor A' : index % 2 ? 'Recorded project manager A' : 'Recorded project manager B',
      owner_label: audit ? 'Auditor' : 'Project manager', status: audit ? 'past_target_date' : 'reported_delay',
      due_date: audit ? `2026-09-${String(5 + index % 5).padStart(2, '0')}` : null,
      route: '/qhse/general/quality',
    };
  });
  const actions = followups.map((row, index) => ({
    id: `assurance-action-${index + 1}`, department: 'qhse', title: `${row.project_code}: ${row.title.toLowerCase()}`,
    detail: row.detail, severity: index === 0 ? 'high' : 'medium', owner: 'QHSE',
    action_label: 'Review source', route: row.route, due_date: null, source_target_date: row.due_date, impact: null,
    source_type: row.source_type, project_code: row.project_code,
  }));
  const dto = {
    status: 'available', coverage_complete: true, ...sourceStamp,
    scope: { label: 'Authorized assurance source records', period: 'current_snapshot', consolidated: false },
    kpis: [unknown('high_enterprise_risks', 'High enterprise risks'), unknown('overdue_mitigations', 'Overdue mitigations'),
      unknown('recordable_qhse_incidents', 'Recordable QHSE incidents'), unknown('compliance_obligations_on_time', 'Compliance obligations on time', 'percent'), unknown('open_audit_findings', 'Open audit findings')],
    register: { status: 'unavailable', risks: [], total_rows: null, returned_rows: 0, truncated: false,
      description: 'A governed enterprise risk register with ratings, appetite and accountable mitigation ownership is not connected.' },
    source_followups: { status: 'available', rows: followups, total_rows: followups.length, returned_rows: followups.length, truncated: false, coverage_complete: true,
      description: 'Recorded project-level quality delays and past audit target dates. These are source follow-ups, not assessed enterprise risks.' },
    actions, actions_status: 'available', action_count: actions.length, actions_returned: actions.length, actions_truncated: false,
    qhse_performance: { status: 'available', route: '/qhse/general/quality', ...sourceStamp,
      metrics: [unknown('recordable_incidents', 'Recordable incidents'), unknown('lost_time_injuries', 'Lost-time injuries'), unknown('near_misses', 'Near misses'),
        unknown('quality_nonconformances', 'Quality nonconformances'), unknown('environmental_events', 'Environmental events'), unknown('overdue_corrective_actions', 'Overdue corrective actions')],
      project_metrics: [metric('open_cars', 'Recorded open corrective actions', 17), metric('delayed_car_projects', 'Projects reporting corrective-action delays', 3),
        metric('open_observations', 'Recorded open observations', 9), metric('delayed_observation_projects', 'Projects reporting observation delays', 2), metric('delayed_audit_projects', 'Projects reporting audit delays', 2)],
      description: 'Project quality aggregates are available. Incident and item-level finding registers are not connected.' },
    compliance_calendar: { status: 'available', basis: 'qhse_audit_schedule', route: '/qhse/general/quality', ...sourceStamp,
      rows: Array.from({ length: 6 }, (_, index) => ({
        id: `audit-target-${index + 1}`, title: ['Quality system audit', 'Project assurance review', 'Site process audit'][index % 3],
        project_code: `ASS-${String(index + 1).padStart(3, '0')}`, project_name: followups[index].project_name,
        date: ['2026-09-08', '2026-09-14', '2026-09-18', '2026-09-22', '2026-10-01', '2026-10-10'][index],
        date_status: index === 0 ? 'past_target_date' : index === 1 ? 'due_today' : 'upcoming', status: index === 0 ? 'DELAYED' : 'SCHEDULED',
        owner: null, recorded_auditor: index === 2 ? null : 'Recorded auditor A', source: 'Authorized QHSE audit schedule', route: '/qhse/general/quality',
      })), total_rows: 6, returned_rows: 6, truncated: false, period_end: '2026-10-14',
      description: 'Active-project audits scheduled through the next 30 days, including past target dates. This does not establish compliance obligations or completion evidence.' },
    audit_controls: { status: 'available', route: '/qhse/general/quality', ...sourceStamp,
      metrics: [metric('scheduled_audits', 'Scheduled audits', 8), metric('delayed_audits', 'Delayed audits', 3), metric('completed_audits', 'Completed audits', 5), unknown('open_audit_findings', 'Open audit findings'), unknown('control_effectiveness', 'Control effectiveness', 'percent')],
      description: 'Recorded audit schedule statuses, not finding closure or effectiveness assessments.' },
    risk_concentration: { ...blank('Verified enterprise risk exposure and common assessment scales are not connected.'), by_currency: [] },
    heatmap: { status: 'unavailable', cells: [], description: 'Verified risk likelihood and impact ratings are not connected.' },
    risk_movement: { status: 'unavailable', series: [], description: 'Dated enterprise risk rating snapshots are not connected.' },
    mitigation_effectiveness: { ...blank('Item-level mitigation ownership, deadlines and effectiveness evidence are not connected.'), metrics: [] },
    sources: [
      { id: 'project_quality', description: 'Authorized project quality records', status: 'available', route: '/qhse/general/quality', ...sourceStamp },
      { id: 'qhse_audits', description: 'Authorized QHSE audit schedule', status: 'available', route: '/qhse/general/quality', ...sourceStamp },
    ],
  };
  if (name === 'risk-missing') return undefined;
  if (name === 'risk-zero') {
    Object.assign(dto.source_followups, { rows: [], total_rows: 0, returned_rows: 0 });
    dto.actions = []; dto.action_count = 0; dto.actions_returned = 0;
    Object.assign(dto.compliance_calendar, { rows: [], total_rows: 0, returned_rows: 0 });
    dto.qhse_performance.project_metrics.forEach(row => { row.value = 0; });
    dto.audit_controls.metrics.filter(row => row.status === 'available').forEach(row => { row.value = 0; });
  }
  if (['risk-empty', 'risk-restricted', 'risk-error'].includes(name)) {
    const status = name === 'risk-empty' ? 'unavailable' : name.slice(5);
    dto.status = status; dto.coverage_complete = false; dto.source_updated_at = null; dto.source_timestamp_kind = null;
    dto.actions = []; dto.actions_status = status; dto.action_count = null; dto.actions_returned = 0;
    Object.assign(dto.source_followups, { status, rows: [], total_rows: null, returned_rows: 0 });
    Object.assign(dto.compliance_calendar, { status, rows: [], total_rows: null, returned_rows: 0 });
    dto.qhse_performance.status = status;
    dto.qhse_performance.project_metrics.forEach(row => { row.status = status; row.value = null; });
    dto.audit_controls.status = status;
    dto.audit_controls.metrics.filter(row => row.status === 'available').forEach(row => { row.status = status; row.value = null; });
    dto.sources.forEach(row => { row.status = status; row.source_updated_at = null; row.source_timestamp_kind = null; if (status === 'restricted') row.route = null; });
  }
  if (['risk-partial-error', 'risk-partial-restricted', 'risk-partial-unavailable'].includes(name)) {
    const status = name.slice('risk-partial-'.length);
    dto.status = 'partial'; dto.coverage_complete = false; dto.sources[0].status = status;
    dto.qhse_performance.status = status;
    dto.qhse_performance.project_metrics.forEach(row => { row.status = status; row.value = null; });
    dto.source_followups.status = 'partial'; dto.source_followups.rows = followups.filter(row => row.source_type === 'qhse_audit');
    dto.source_followups.total_rows = dto.source_followups.rows.length; dto.source_followups.returned_rows = dto.source_followups.rows.length;
    dto.actions_status = 'partial'; dto.actions = actions.filter(row => row.source_type === 'qhse_audit');
    dto.action_count = dto.actions.length; dto.actions_returned = dto.actions.length;
  }
  if (name === 'risk-audit-restricted') {
    dto.status = 'partial'; dto.coverage_complete = false; dto.sources[1].status = 'restricted'; dto.sources[1].route = null;
    Object.assign(dto.audit_controls, { status: 'restricted', route: null });
    dto.audit_controls.metrics.filter(row => row.status === 'available').forEach(row => { row.status = 'restricted'; row.value = null; });
    Object.assign(dto.compliance_calendar, { status: 'restricted', rows: [], total_rows: null, returned_rows: 0 });
    dto.source_followups.status = 'partial'; dto.source_followups.rows = followups.filter(row => row.source_type === 'project_quality');
    dto.source_followups.total_rows = dto.source_followups.rows.length; dto.source_followups.returned_rows = dto.source_followups.rows.length;
    dto.actions_status = 'partial'; dto.actions = actions.filter(row => row.source_type === 'project_quality');
    dto.action_count = dto.actions.length; dto.actions_returned = dto.actions.length;
    dto.qhse_performance.route = '/qhse/general/detailed'; dto.sources[0].route = '/qhse/general/detailed';
    dto.source_followups.rows.forEach(row => { row.route = '/qhse/general/detailed'; });
    dto.actions.forEach(row => { row.route = '/qhse/general/detailed'; });
  }
  if (name === 'risk-partial-zero') {
    dto.status = 'partial'; dto.coverage_complete = false; dto.sources[0].status = 'unavailable';
    dto.qhse_performance.status = 'unavailable';
    dto.qhse_performance.project_metrics.forEach(row => { row.value = null; row.status = 'unavailable'; });
    Object.assign(dto.source_followups, { status: 'partial', rows: [], total_rows: 0, returned_rows: 0 });
    dto.actions = []; dto.actions_status = 'partial'; dto.action_count = 0; dto.actions_returned = 0;
    Object.assign(dto.compliance_calendar, { rows: [], total_rows: 0, returned_rows: 0 });
    dto.audit_controls.metrics.filter(row => row.status === 'available').forEach(row => { row.value = 0; });
  }
  if (name === 'risk-null-project-counter') dto.qhse_performance.project_metrics[0].value = null;
  if (name === 'risk-calendar-basis-missing') delete dto.compliance_calendar.basis;
  if (name === 'risk-truncated') {
    Object.assign(dto.source_followups, { total_rows: 230, truncated: true });
    Object.assign(dto.compliance_calendar, { total_rows: 60, truncated: true });
    dto.action_count = 70; dto.actions_truncated = true;
  }
  dto.source_followups.coverage_complete = dto.coverage_complete;
  return dto;
}
