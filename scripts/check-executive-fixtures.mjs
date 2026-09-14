import { financialFixture } from './check-financial-fixtures.mjs';
import { portfolioFixture } from './check-portfolio-fixtures.mjs';
import { commercialFixture } from './check-commercial-fixtures.mjs';
import { workforceFixture } from './check-workforce-fixtures.mjs';
import { riskFixture } from './check-risk-fixtures.mjs';

// Deliberately synthetic data for the local UI checks. No fixture ships to the app.
const metric = (id, label, value, extra = {}) => ({
  id, label, value, unit: 'count', status: 'available',
  description: `${label} recorded in the authorized workspace.`,
  definition: `${label} counts the source records available to this account.`,
  source: 'Synthetic browser-check source', reason: null,
  target: null, trend: null, period: 'current_snapshot',
  ...extra,
});

const departmentNames = {
  engineering: 'Engineering', finance: 'Finance', hr: 'Human Resources',
  sales: 'Sales', project_control: 'Project Control', procurement: 'Procurement', qhse: 'QHSE',
};
const departmentRoutes = {
  engineering: '/engineering', finance: '/finance', hr: '/hr', sales: '/sales',
  project_control: '/projects', procurement: '/procurement/requisitions', qhse: '/qhse',
};

export const fullReport = {
  schema_version: '1.0',
  generated_at: '2026-09-14T08:30:00Z',
  scope: {
    label: 'Authorized RADAI workspace', type: 'authorized_workspace',
    period: 'current_snapshot', consolidated: false,
  },
  kpis: [
    ['revenue', 'Revenue', 'currency'],
    ['ebita_margin', 'EBITA margin', 'percent'],
    ['operating_cash_flow', 'Operating cash flow', 'currency'],
    ['signed_backlog', 'Signed backlog', 'currency'],
    ['utilisation', 'Billable utilisation', 'percent'],
  ].map(([id, label, unit]) => metric(id, label, null, {
    unit, status: 'unavailable',
    definition: `${label} requires a validated reporting source and a shared accounting period. Operational record totals do not establish this financial or workforce measure.`,
    reason: 'This workspace has no validated consolidated source for this measure.',
    source: 'No connected consolidated source',
  })).concat(metric('projects_at_risk', 'Projects at risk', 3, { route: '/projects' })),
  departments: Object.entries(departmentNames).map(([id, label], index) => ({
    id, label, status: 'available', route: departmentRoutes[id],
    source_updated_at: '2026-09-12T10:00:00Z', source_timestamp_kind: 'latest_record_update',
    metrics: [
      metric(`${id}_open`, `Open ${label.toLowerCase()} items`, 11 + index, { route: departmentRoutes[id] }),
      metric(`${id}_overdue`, `Overdue ${label.toLowerCase()} items`, index === 1 ? 0 : index + 1, { route: departmentRoutes[id] }),
    ],
    actions: [],
    limitations: [`${label} reflects current authorized records, not a historical trend.`],
  })),
  actions: Object.entries(departmentNames).map(([department, label], index) => ({
    id: `action-${department}`, department, title: `${label} review needed`,
    severity: ['critical', 'high', 'medium', 'low'][index % 4],
    owner: index === 2 ? null : `Fixture ${label} owner`,
    action_label: `Review ${label.toLowerCase()}`, route: departmentRoutes[department],
    detail: `Inspect the ${label.toLowerCase()} exception before assigning the next action.`,
    due_date: index === 0 ? '2026-09-13' : null,
  })),
  action_count: 7,
  portfolio: {
    status: 'available', counts: { total: 8, active: 5, at_risk: 3, with_exceptions: 4, clear: 4 },
    projects: [
      { id: 'one', code: 'TEST-001', name: 'Synthetic offshore upgrade', status: 'active', progress_pct: 42, owner: 'Fixture project owner', health: 'critical', exception_count: 4, route: '/projects?project=one', data_date: '2026-09-13' },
      { id: 'two', code: 'TEST-002', name: 'Synthetic utility connection', status: 'active', progress_pct: 0, owner: null, health: 'high', exception_count: 2, route: '/projects?project=two', data_date: null },
      { id: 'three', code: 'TEST-003', name: 'Synthetic pipeline integrity assessment with a longer project description', status: 'planning', progress_pct: null, owner: 'Fixture planning owner', health: 'medium', exception_count: 1, route: '/projects?project=three', data_date: null },
    ],
  },
  coverage: { available_departments: 7, total_departments: 7 },
  workforce: {
    status: 'available', unit: 'people',
    allocation: [{ label: 'Engineering', count: 78 }, { label: 'Project Control', count: 22 }, { label: 'Finance', count: 12 }, { label: 'Sales', count: 8 }, { label: 'Other recorded teams', count: 7 }],
    source: 'Authorized active employee records',
    description: 'Recorded department assignment for active employees. This does not establish planned capacity.',
    critical_roles: null, capacity_gap: null,
    source_updated_at: '2026-09-12T10:00:00Z', source_timestamp_kind: 'latest_record_update',
  },
  limitations: ['Figures describe authorized RADAI records. Financial consolidation is not available.'],
};

fullReport.departments.find(row => row.id === 'finance').metrics.push(metric(
  'finance_recorded_invoice_value', 'Recorded invoice value', null,
  { unit: 'currency', by_currency: [{ currency: 'AED', amount: '123456.78' }, { currency: 'USD', amount: '23456.78' }] },
));
fullReport.departments.find(row => row.id === 'hr').metrics.push(metric(
  'headcount', 'Active employees', 127,
  { source: 'Authorized active employee records', route: '/hr' },
));
fullReport.departments.find(row => row.id === 'qhse').metrics.push(
  metric('safety_incidents', 'Recorded safety incidents', 0, { source: 'Authorized QHSE records', route: '/qhse' }),
  metric('delayed_audit_projects', 'Projects with delayed audits', 2, { source: 'Authorized QHSE records', route: '/qhse' }),
);
fullReport.departments.find(row => row.id === 'hr').workforce_by_department = fullReport.workforce.allocation;
fullReport.departments.find(row => row.id === 'sales').pipeline_stages = [
  { stage: 'proposal', label: 'Proposal', count: 4, by_currency: [{ currency: 'AED', amount: '1450000.00', weighted_amount: '580000.00' }, { currency: 'USD', amount: '90000.00', weighted_amount: '36000.00' }] },
  { stage: 'negotiation', label: 'Negotiation', count: 2, by_currency: [{ currency: 'AED', amount: '420000.00', weighted_amount: '294000.00' }] },
  { stage: 'qualified', label: 'Qualified', count: 3, by_currency: [{ currency: 'AED', amount: '320000.00', weighted_amount: '96000.00' }] },
];
fullReport.departments.find(row => row.id === 'sales').metrics.push(
  metric('active_opportunities', 'Active opportunities', 9, { source: 'CRM opportunity register' }),
  metric('weighted_pipeline', 'Weighted pipeline', null, {
    unit: 'currency', source: 'CRM opportunity register',
    by_currency: [{ currency: 'AED', amount: '970000.00' }, { currency: 'USD', amount: '36000.00' }],
  }),
);
fullReport.portfolio.projects.forEach((project, index) => Object.assign(project, {
  client_name: ['Fixture northern utility', 'Fixture energy services', 'Fixture regional engineering'][index],
  contract_value: ['1200000.00', '980000.00', null][index],
  currency: ['AED', 'USD', null][index],
  business_unit: null, schedule_variance: null, forecast_margin: null,
}));
fullReport.departments.forEach(department => {
  department.actions = fullReport.actions.filter(action => action.department === department.id);
});

export function reportFixture(name = 'full') {
  const report = structuredClone(fullReport);
  report.financial_performance = financialFixture(name);
  report.portfolio_performance = portfolioFixture(name);
  report.commercial_performance = commercialFixture(name);
  report.workforce_performance = workforceFixture(name);
  report.risk_compliance = riskFixture(name);
  if (name === 'zero') {
    report.kpis.find(row => row.id === 'projects_at_risk').value = 0;
    report.departments.forEach(department => {
      department.actions = [];
      department.metrics.forEach(row => {
        row.value = 0;
        row.status = 'available';
        delete row.by_currency;
      });
    });
    report.actions = [];
    report.portfolio.counts = { total: 0, active: 0, at_risk: 0, with_exceptions: 0, clear: 0 };
    report.portfolio.projects = [];
    report.workforce.allocation = [];
    report.departments.find(row => row.id === 'hr').workforce_by_department = [];
    report.departments.find(row => row.id === 'sales').pipeline_stages = [];
  }
  if (name === 'partial') {
    report.coverage.available_departments = 4;
    for (const [id, status] of [['finance', 'restricted'], ['procurement', 'error'], ['qhse', 'unavailable']]) {
      const department = report.departments.find(row => row.id === id);
      department.status = status;
      department.actions = [];
      department.metrics.forEach(row => Object.assign(row, {
        status, value: null, by_currency: undefined,
        reason: status === 'restricted' ? 'Not included in your access.' : 'This source is currently unavailable.',
      }));
      department.limitations = [`${department.label} source is ${status}.`];
    }
    report.actions = report.actions.filter(row => !['finance', 'procurement', 'qhse'].includes(row.department));
  }
  if (name === 'empty') {
    report.coverage.available_departments = 0;
    report.kpis.forEach(row => Object.assign(row, { value: null, status: 'unavailable', reason: 'No source records are available.' }));
    report.departments.forEach(department => Object.assign(department, { status: 'unavailable', metrics: [], actions: [], limitations: ['No source records are available.'] }));
    report.actions = [];
    report.portfolio = { status: 'unavailable', counts: null, projects: [] };
    report.workforce = { ...report.workforce, status: 'unavailable', allocation: [], source_updated_at: null, source_timestamp_kind: null };
    report.departments.find(row => row.id === 'hr').workforce_by_department = [];
    report.departments.find(row => row.id === 'sales').pipeline_stages = [];
  }
  report.action_count = report.actions.length;
  if (name === 'truncated') report.action_count = 57;
  return report;
}
