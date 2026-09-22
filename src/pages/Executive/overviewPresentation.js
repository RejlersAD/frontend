import { internalRoute } from './executivePresentation.js';
import { invoicePerformanceModel } from './invoicePerformancePresentation.js';

const readable = status => ['available', 'partial'].includes(status);
const number = value => (typeof value === 'number' || typeof value === 'string')
  && String(value).trim() !== '' && Number.isFinite(Number(value)) ? Number(value) : null;
const severityOrder = { critical: 0, high: 1, medium: 2, low: 3, unknown: 4, clear: 5 };
const departmentNames = { engineering: 'Engineering', finance: 'Finance', hr: 'Human Resources', sales: 'Sales', project_control: 'Project Control', procurement: 'Procurement', qhse: 'QHSE' };
const unavailableText = status => status === 'restricted' ? 'Access restricted' : status === 'error' ? 'Source unavailable' : 'Not connected';
const textValue = value => typeof value === 'string' && value.trim() ? value.trim() : null;
const ownerName = value => textValue(value) || textValue(value?.name) || textValue(value?.full_name) || 'Unassigned';

export function overviewNumber(value, options = {}) {
  const amount = number(value);
  if (amount === null) return '—';
  const formatted = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1, ...options }).format(amount);
  return options.notation === 'compact' ? formatted.replace(/([kmbt])$/i, suffix => suffix.toUpperCase()) : formatted;
}

export function overviewMoney(value, currency = 'AED') {
  const amount = number(value);
  return amount === null ? '—' : `${currency || 'UNSPECIFIED'} ${overviewNumber(amount, { notation: Math.abs(amount) >= 1000 ? 'compact' : 'standard' })}`;
}

function unknownMetric(id, label, description, unit = 'count', status = 'unavailable') {
  return { id, label, value: null, status, unit, description, definition: description, source: 'Authorised reporting source required' };
}

function selectedMetric(metrics, id, currency, fallback) {
  const metric = metrics?.find(item => item.id === id) || fallback || unknownMetric(id, id, 'The reporting source is not connected.');
  if (!readable(metric.status)) return { ...metric, value: null };
  if (Array.isArray(metric.by_currency)) {
    const { by_currency: rows, ...base } = metric;
    const row = rows.find(item => (item.currency || 'UNSPECIFIED') === currency);
    return { ...base, currency, value: number(row?.amount), status: row ? metric.status : 'unavailable' };
  }
  if (metric.unit === 'currency' && (metric.currency || 'UNSPECIFIED') !== currency) return { ...metric, value: null, status: 'unavailable' };
  return { ...metric, value: number(metric.value) };
}

function metricValue(metric, currency) {
  if (!readable(metric?.status)) return '—';
  if (metric.unit === 'currency') return overviewMoney(metric.value, metric.currency || currency);
  return `${overviewNumber(metric.value)}${metric.unit === 'percent' && number(metric.value) !== null ? '%' : ''}`;
}

export function workbookMetric(summary, currency, field, id, label) {
  const row = summary?.status === 'available' && summary.schema_version === '1.0'
    ? summary.currency_breakdown?.find(item => item.currency === currency && item.currency_status === 'recorded') : null;
  const value = number(row?.[field]);
  const coverage = row?.coverage?.[field];
  const incomplete = coverage && ['blank_count', 'text_count', 'error_count'].some(key => number(coverage[key]) > 0);
  const description = `${field === 'invoice_amount' ? 'Recorded invoice amounts' : 'Recorded actual payments received'} in ${currency}, from the full invoice workbook. Only rows with a verified original currency are included. This is a recorded subtotal, not approved project value or recognised revenue. Missing amounts are excluded; no currency conversion is applied.`;
  return { ...unknownMetric(id, label, description, 'currency', summary?.status || 'unavailable'),
    value, currency, status: value === null ? summary?.status === 'restricted' ? 'restricted' : 'unavailable' : incomplete ? 'partial' : 'available',
    source: 'Invoice workbook · verified original currency', route: '/finance/outgoing-invoices',
    complete: value !== null && !!coverage && !incomplete };
}

function portfolioModel(report) {
  const extended = report?.portfolio_performance;
  const original = report?.portfolio;
  const register = extended?.register || { status: original?.status, projects: original?.projects || [], total_rows: original?.total_rows ?? original?.counts?.total, truncated: (original?.counts?.total || 0) > (original?.projects?.length || 0) };
  const status = register?.status || 'unavailable';
  const total = readable(status) ? number(register.total_rows) : null;
  const health = extended?.health;
  const sourceCounts = readable(health?.status) ? health.counts : null;
  const countKeys = ['clear', 'high', 'medium', 'low', 'critical', 'unknown'];
  const countValues = countKeys.map(key => number(sourceCounts?.[key]));
  const countsComplete = total !== null && countValues.every(value => value !== null && value >= 0 && Number.isInteger(value))
    && countValues.reduce((sum, value) => sum + value, 0) === total;
  // Health and the full register must cover the same population. Never turn a
  // partial preview into percentages of the entire portfolio.
  const counts = countsComplete ? sourceCounts : null;
  const countOf = key => number(counts?.[key]);
  const reviewCounts = ['high', 'medium', 'low'].map(countOf);
  const review = reviewCounts.every(value => value !== null) ? reviewCounts.reduce((sum, value) => sum + value, 0) : null;
  const buckets = [
    { id: 'clear', label: 'No exceptions', count: countOf('clear'), color: '#00a66d' },
    { id: 'attention', label: 'Needs review', count: review, color: '#ffb51c' },
    { id: 'critical', label: 'Critical', count: countOf('critical'), color: '#ed4054' },
    { id: 'unknown', label: 'Not assessed', count: countOf('unknown'), color: '#aeb7c8' },
  ].map(row => ({ ...row, percent: total > 0 && row.count !== null ? row.count / total * 100 : total === 0 && row.count === 0 ? 0 : null }));
  const attentionCount = review !== null && countOf('critical') !== null ? review + countOf('critical') : null;
  const active = selectedMetric(extended?.kpis, 'active_projects', null,
    { ...unknownMetric('active_projects', 'Active projects', 'Projects recorded as active in the authorised register.'), status, value: original?.counts?.active });
  const rows = readable(status) ? (register.projects || [])
    .filter(project => ['critical', 'high', 'medium', 'low'].includes(project.health))
    .sort((left, right) => (severityOrder[left.health] ?? 9) - (severityOrder[right.health] ?? 9))
    .map(project => ({
      id: project.id, name: project.name || project.project_name || project.code || 'Unnamed project',
      client: project.client_name || 'Not recorded', progress: number(project.progress_pct),
      schedule: number(project.schedule_variance), margin: number(project.forecast_margin), health: project.health,
      owner: ownerName(project.owner),
      route: internalRoute(project.route), causes: project.causes || [],
    })) : [];
  return {
    status: health?.status || status, total, active: active.value, buckets, attentionCount,
    description: health?.description || 'Governed project exceptions. No exceptions does not establish verified delivery confidence.',
    register: { status, rows, total: attentionCount, truncated: !!register.truncated, description: register.description },
  };
}

function commercialModel(report, currency) {
  const sales = report?.departments?.find(section => section.id === 'sales');
  const commercial = report?.commercial_performance;
  const status = commercial?.status || sales?.status || 'unavailable';
  const stageOrder = { lead: 0, qualified: 1, proposal: 2, negotiation: 3, award_pending: 4 };
  let sourceStages = readable(status) ? commercial ? commercial.pipeline_stages || [] : sales?.pipeline_stages || [] : [];
  // Older extended responses omit stage aggregates. Derive them only from a complete
  // register; the bounded preview must never become a claimed pipeline total.
  const register = commercial?.register;
  if (readable(status) && commercial && !sourceStages.length && readable(register?.status)
    && !register.truncated && number(register.total_rows) === register.opportunities?.length) {
    const opportunities = register.opportunities.filter(row => (row.currency || 'UNSPECIFIED') === currency);
    const hasCurrency = opportunities.length > 0 || (commercial.currencies || []).some(row => (typeof row === 'string' ? row : row.currency) === currency);
    const sum = (rows, key) => rows.every(row => number(row[key]) !== null) ? rows.reduce((total, row) => total + number(row[key]), 0) : null;
    sourceStages = Object.keys(stageOrder).map(stage => {
      const rows = opportunities.filter(row => row.stage === stage);
      return { stage, label: { lead: 'Lead', qualified: 'Qualified', proposal: 'Proposal', negotiation: 'Negotiation', award_pending: 'Award pending' }[stage],
        by_currency: hasCurrency ? [{ currency, amount: sum(rows, 'estimated_value'), weighted_amount: sum(rows, 'weighted_value') }] : [] };
    });
  }
  const stages = sourceStages.map(stage => {
    const money = stage.by_currency?.find(row => (row.currency || 'UNSPECIFIED') === currency);
    return { id: stage.stage, label: stage.label || stage.stage, value: number(money?.amount), weighted: number(money?.weighted_amount) };
  }).sort((left, right) => (stageOrder[left.id] ?? 9) - (stageOrder[right.id] ?? 9));
  const total = stages.length && stages.every(stage => stage.value !== null) ? stages.reduce((sum, stage) => sum + stage.value, 0) : null;
  const weighted = selectedMetric(readable(status) ? commercial?.kpis || sales?.metrics : [], 'weighted_pipeline', currency,
    unknownMetric('weighted_pipeline', 'Weighted pipeline', 'Stored probability-weighted open CRM opportunity values, kept in original currencies.', 'currency', status));
  const ratio = total > 0 && weighted.value !== null && weighted.value >= 0 && weighted.value <= total ? weighted.value / total * 100 : null;
  return { status, total: overviewMoney(total, currency), weighted: metricValue(weighted, currency),
    conversion: ratio === null ? '—' : `${overviewNumber(ratio)}%`, conversionLabel: 'Weighted share', stages,
    description: 'Open CRM opportunities in their recorded currency. Weighted share is weighted pipeline divided by total pipeline; it is not a win rate or an approved revenue forecast.',
    metric: weighted };
}

function workforceModel(report) {
  const workforce = report?.workforce_performance;
  const hr = report?.departments?.find(section => section.id === 'hr');
  const status = workforce?.status || hr?.status || 'unavailable';
  const definitions = [
    ['headcount', 'Headcount', 'count', 'Current employees in the authorised employee master. This counts people, not FTE.'],
    ['billable_utilisation', 'Billable utilisation', 'percent', 'Approved billable and available hours are not connected.'],
    ['critical_vacancies', 'Critical roles', 'count', 'Approved vacancies linked to critical delivery skills are not connected.'],
    ['capacity_gaps', 'Capacity gaps', 'count', 'Approved capacity and forecast demand are not connected.'],
  ];
  const metrics = definitions.map(([id, label, unit, description]) => {
    const metric = selectedMetric(readable(status) ? workforce?.kpis || hr?.metrics : [], id, null,
      unknownMetric(id, label, description, unit, readable(status) ? 'unavailable' : status));
    return { id, label, value: metricValue(metric), metric };
  });
  const distribution = workforce?.distribution?.business_unit;
  const capacity = workforce?.capacity_plan;
  const useBusinessUnits = readable(status) && readable(distribution?.status) && distribution.rows?.length;
  const allocation = useBusinessUnits ? distribution.rows
    : readable(status) && readable(capacity?.status) ? (capacity.rows || []).map(row => ({ label: row.department, count: row.headcount }))
      : readable(report?.workforce?.status) && !workforce ? report.workforce.allocation || [] : [];
  const rows = allocation.map((row, index) => ({ id: row.id || `workforce-${index}`, label: row.label || 'Unassigned', value: number(row.count) }))
    .filter(row => row.value !== null).sort((left, right) => right.value - left.value);
  return { status, metrics, rows, chartLabel: `Workforce by ${useBusinessUnits ? 'business unit' : 'department'}`, unit: 'people',
    description: useBusinessUnits ? distribution.description : capacity?.description || 'Recorded workforce headcount. Approved utilisation and capacity planning are not connected.' };
}

function decisionsModel(report) {
  const sections = (report?.departments || []).filter(section => readable(section.status));
  const allowedDepartments = new Set(sections.map(section => section.id));
  const sourceRows = (report?.actions || []).filter(row => !row.department || allowedDepartments.has(row.department));
  const impactLabel = impact => {
    if (textValue(impact)) return textValue(impact);
    if (typeof impact === 'number' && Number.isFinite(impact)) return overviewNumber(impact);
    if (!impact || typeof impact !== 'object' || (impact.status && !readable(impact.status))) return 'Source review';
    if (number(impact.amount) !== null && textValue(impact.currency)) return overviewMoney(impact.amount, impact.currency);
    if (number(impact.value) !== null && textValue(impact.unit)) {
      if (impact.unit === 'currency') return overviewMoney(impact.value, textValue(impact.currency) || 'UNSPECIFIED');
      return `${overviewNumber(impact.value)}${impact.unit === 'percent' ? '%' : ` ${impact.unit}`}`;
    }
    return textValue(impact.label) || 'Source review';
  };
  const rows = sourceRows.map(row => ({ ...row, title: textValue(row.title) || 'Review source item', impact: impactLabel(row.impact),
      owner: ownerName(row.owner), department: departmentNames[row.department] || textValue(row.department) || 'Unassigned',
      dueDate: textValue(row.due_date), route: internalRoute(row.route) }))
    .sort((left, right) => (severityOrder[left.severity] ?? 9) - (severityOrder[right.severity] ?? 9)
      || (left.dueDate || '9999').localeCompare(right.dueDate || '9999'));
  const filtered = sourceRows.length !== (report?.actions?.length || 0);
  const knownCounts = sections.map(section => number(section.action_count));
  const availableCount = knownCounts.every(count => count !== null) ? knownCounts.reduce((sum, count) => sum + count, 0) : rows.length;
  const total = filtered ? availableCount : number(report?.action_count) ?? rows.length;
  return { rows, total: Math.max(total, rows.length), truncated: !!report?.actions_truncated || total > rows.length,
    status: sections.length ? 'available' : 'unavailable' };
}

function controlsModel(report, workforce) {
  const projectSection = report?.departments?.find(section => section.id === 'project_control');
  const sealed = selectedMetric(readable(projectSection?.status) ? projectSection.metrics : [], 'sealed_projects');
  const projectCount = readable(report?.portfolio?.status) ? number(report.portfolio.counts?.total) : null;
  const coverage = projectCount > 0 && sealed.value !== null && sealed.value >= 0 && sealed.value <= projectCount ? sealed.value / projectCount * 100 : null;
  const headcount = workforce.metrics.find(metric => metric.id === 'headcount')?.metric.value;
  const quality = report?.workforce_performance?.data_quality;
  const missing = selectedMetric(readable(quality?.status) ? quality.metrics : [], 'missing_business_unit');
  const mapping = headcount > 0 && missing.value !== null && missing.value >= 0 && missing.value <= headcount ? (headcount - missing.value) / headcount * 100 : null;
  const risk = unknownMetric('risk_reviews', 'Risk reviews', 'Approved enterprise risk review deadlines are not connected. QHSE audit dates do not establish enterprise risk reviews.');
  const finance = unknownMetric('financial_reporting', 'Financial reporting', 'Financial reporting reflects provisional operational source records. An approved close and consolidated ledger are not connected.');
  const coverageDescription = 'Accessible projects with at least one sealed management snapshot divided by all accessible projects. A sealed snapshot does not establish complete project controls.';
  const mappingDescription = 'Current employee records with a recorded business unit divided by current headcount. This is mapping completeness, not overall workforce data quality.';
  return [
    { id: 'financial', label: 'Financial reporting', value: 'Provisional', metric: finance },
    { id: 'project', label: 'Project reporting coverage', value: coverage === null ? '—' : `${overviewNumber(coverage)}%`, metric: { ...sealed, label: 'Project reporting coverage', value: coverage, unit: 'percent', status: coverage === null ? readable(sealed.status) ? 'unavailable' : sealed.status : sealed.status, description: coverageDescription, definition: coverageDescription } },
    { id: 'risk', label: 'Risk reviews', value: 'Not connected', metric: risk },
    { id: 'workforce', label: 'Workforce BU mapping', value: mapping === null ? '—' : `${overviewNumber(mapping)}%`, metric: { ...missing, label: 'Workforce business-unit mapping', value: mapping, unit: 'percent', status: mapping === null ? readable(missing.status) ? 'unavailable' : missing.status : missing.status, description: mappingDescription, definition: mappingDescription } },
  ];
}

/** Adapt authorised source facts to the overview without inventing forecasts or combining currencies. */
export function overviewModel(report, currency = 'AED', receivables = null, mode = 'monthly', monthChoice = '') {
  const portfolio = portfolioModel(report);
  const workforce = workforceModel(report);
  const invoicing = invoicePerformanceModel(receivables?.invoice_performance, currency, mode, monthChoice);
  const revenue = invoicing.revenue;
  const summary = receivables?.workbook_summary;
  const amount = workbookMetric(summary, currency, 'invoice_amount', 'total_amount', 'Total amount');
  const received = workbookMetric(summary, currency, 'actual_payment_received', 'amount_received', 'Total amount received');
  const source = receivables?.currency === currency ? receivables.sources?.receivables : null;
  const invoiceReadable = ['available', 'incomplete', 'partial'].includes(source?.status);
  const unpaid = invoiceReadable ? receivables.kpis?.unpaid : null;
  const pendingAmount = number(unpaid?.amount) ?? number(unpaid?.known_amount);
  const pending = { ...unknownMetric('amount_pending', 'Total amount pending', receivables?.definitions?.unpaid || 'Current unsettled invoice amounts less recorded receipts in the selected currency. Missing invoice amounts are excluded from recorded subtotals.', 'currency', source?.status || 'unavailable'),
    value: pendingAmount, currency, status: pendingAmount === null ? source?.status === 'restricted' ? 'restricted' : 'unavailable' : unpaid?.partial ? 'partial' : 'available',
    source: 'Current authorised invoice register', route: internalRoute(source?.route) };
  const progress = amount.complete && received.complete && amount.value > 0 && received.value >= 0 && received.value <= amount.value ? received.value / amount.value * 100 : null;
  const projectsMetric = { ...unknownMetric('total_projects', 'Total projects', 'Accessible open projects, including planning, active and on-hold projects.', 'count', portfolio.register.status), value: portfolio.total, route: '/projects' };
  const cards = [
    { id: 'revenue', label: 'Invoiced revenue', value: `${metricValue(revenue, currency)}${revenue.status === 'partial' && revenue.value !== null ? '*' : ''}`, note: invoicing.note, metric: revenue, tone: 'blue' },
    { id: 'total_amount', label: 'Total amount', value: `${metricValue(amount, currency)}${amount.status === 'partial' && amount.value !== null ? '*' : ''}`, note: readable(amount.status) ? amount.status === 'partial' ? 'Known subtotal · invoice value' : 'Recorded invoice value' : unavailableText(amount.status), metric: amount, tone: 'violet' },
    { id: 'amount_received', label: 'Total amount received', value: `${metricValue(received, currency)}${received.status === 'partial' && received.value !== null ? '*' : ''}`, note: progress === null ? readable(received.status) ? received.status === 'partial' ? 'Known subtotal · workbook receipts' : 'Recorded workbook receipts' : unavailableText(received.status) : `${overviewNumber(progress)}% of recorded invoice value`, progress, metric: received, tone: 'green' },
    { id: 'amount_pending', label: 'Total amount pending', value: metricValue(pending, currency), note: readable(pending.status) ? unpaid?.partial ? 'Known current balance · partial' : 'Current outstanding balance' : unavailableText(pending.status), metric: pending, tone: 'amber' },
    { id: 'total_projects', label: 'Total projects', value: overviewNumber(portfolio.total), note: portfolio.total === null ? unavailableText(portfolio.register.status) : `${overviewNumber(portfolio.active)} active · Open portfolio`, metric: projectsMetric, tone: 'blue' },
  ];
  return { currency, cards, portfolio, commercial: commercialModel(report, currency), workforce,
    projects: portfolio.register, decisions: decisionsModel(report), controls: controlsModel(report, workforce),
    performance: invoicing.performance, forecast: invoicing.forecast };
}
