/** Business service grants. Keep parity with backend service_catalogue.py. */
export const BUSINESS_SERVICES = [
  {"code": "finance_salary", "name": "Salary Slips", "parent": "finance", "path": "/finance/salary-slip"},
  {
    "code": "finance_overview",
    "name": "Finance Overview",
    "parent": "finance",
    "path": "/finance"
  },
  {
    "code": "finance_incoming",
    "name": "Incoming Invoices",
    "parent": "finance",
    "path": "/finance/incoming-invoices"
  },
  {
    "code": "finance_outgoing",
    "name": "Outgoing Invoices",
    "parent": "finance",
    "path": "/finance/outgoing-invoices"
  },
  {
    "code": "sales_overview",
    "name": "Sales Overview",
    "parent": "sales",
    "path": "/sales"
  },
  {
    "code": "sales_opportunities",
    "name": "Sales Opportunities",
    "parent": "sales",
    "path": "/sales/opportunities"
  },
  {
    "code": "sales_proposals",
    "name": "Sales Proposals",
    "parent": "sales",
    "path": "/sales/proposals"
  },
  {
    "code": "sales_clients",
    "name": "Sales Clients & Contacts",
    "parent": "sales",
    "path": "/sales/clients"
  },
  {
    "code": "sales_frameworks",
    "name": "Sales Framework Agreements",
    "parent": "sales",
    "path": "/sales/frameworks"
  },
  {
    "code": "sales_forecasts",
    "name": "Sales Forecasts",
    "parent": "sales",
    "path": "/sales/forecasts"
  },
  {
    "code": "sales_handovers",
    "name": "Sales Project Handovers",
    "parent": "sales",
    "path": "/sales/project-handovers"
  },
  {
    "code": "sales_email_intake",
    "name": "Sales Email Intake",
    "parent": "sales",
    "path": "/sales/email-intake"
  }
];
export const SERVICE_PARENTS = Object.fromEntries(BUSINESS_SERVICES.map(service => [service.code, service.parent]));
export const hasAssignedModule = (codes, code) => codes.includes(code);
export const resolveRouteModule = (moduleCode, pathname, search = '') => {
  if (moduleCode === 'qhse') {
    const areas = { detailed: 'qhse_detailed', quality: 'qhse_quality', 'health-safety': 'qhse_health_safety', environmental: 'qhse_environmental', energy: 'qhse_energy' };
    return areas[pathname.split('/')[3]] || 'qhse';
  }
  if (moduleCode === 'finance' || moduleCode === 'sales') {
    if (pathname === '/finance/salary-slip') return 'finance_salary';
    if (pathname === '/finance/sales') return 'sales_overview';
    const service = [...BUSINESS_SERVICES].sort((a, b) => b.path.length - a.path.length).find(item =>
      item.parent === moduleCode && (pathname === item.path || pathname.startsWith(item.path + '/'))
    );
    // Dynamic Sales areas must not fall through to the overview grant.
    if (moduleCode === 'sales' && service?.code === 'sales_overview' && pathname !== '/sales') return 'sales_unknown';
    return service?.code || moduleCode;
  }
  if (moduleCode === 'project_control' && (new URLSearchParams(search).get('view') === 'plan-baseline' || pathname.startsWith('/planning-'))) return 'planning_package';
  return moduleCode;
};
export const canAccessRouteModule = (codes, code) => hasAssignedModule(codes, code);

export const viewableModuleCodes = (profile) => (profile?.modules || [])
  .filter(module => profile.module_actions?.[module.code]?.includes('read'))
  .map(module => module.code);

export const resolveQhseApiPrefix = (pathname = '') => {
  const area = pathname.split('/')[3];
  return pathname.startsWith('/qhse/') && ['detailed', 'quality', 'health-safety', 'environmental', 'energy'].includes(area)
    ? `/qhse/areas/${area}` : '/qhse';
};
