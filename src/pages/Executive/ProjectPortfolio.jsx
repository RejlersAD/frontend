/* eslint-disable react/prop-types */
import React, { useMemo, useRef, useState } from 'react';
import { ArrowRightIcon, ArrowsUpDownIcon, CalendarDaysIcon, ChartBarIcon, CheckCircleIcon, ChevronLeftIcon, ChevronRightIcon, DocumentTextIcon, ExclamationTriangleIcon, InformationCircleIcon, MagnifyingGlassIcon, Square3Stack3DIcon } from '@heroicons/react/24/outline';
import { EmptyState, RouteLink, Status } from './ExecutivePrimitives';
import { formatDate, formatNumber } from './executivePresentation';
import { HEALTH_LABELS, PortfolioHealthBadge, PortfolioMetricValue, numberPresent, portfolioCurrencyMetric, unknownPortfolioMetric } from './portfolioPresentation';
import { PortfolioConcentration, PortfolioDeliveryCapacity, PortfolioHealthSummary, PortfolioMilestones } from './PortfolioSidePanels';
import { PortfolioDeliveryScatter, PortfolioMarginScheduleTrend } from './PortfolioReferenceCharts';
import PortfolioKpiGraphic from './PortfolioKpiGraphic';
import PortfolioRevenueDashboard from './PortfolioRevenueDashboard';
import './ProjectPortfolio.css';

const EMPTY_PROJECTS = [];
const HEALTH_ORDER = { critical: 0, high: 1, medium: 2, low: 3, clear: 4, unavailable: 5, unknown: 5 };
const shortDate = value => value ? formatDate(value).replace(/ \d{4}$/, '') : '—';
const definition = (id, label, description, unit) => unknownPortfolioMetric(id, label, description, unit);

const reported = status => ['available', 'partial'].includes(status);

export function reviewPortfolioInterventions() {
  const target = document.getElementById('pp-decisions');
  target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  target?.focus({ preventScroll: true });
}

function PortfolioInfo({ id, label, description, onExplain, metric }) {
  return <button type="button" className="cc-info-button" aria-label={`About ${label}`} onClick={() => onExplain(metric || definition(id, label, description))}><InformationCircleIcon aria-hidden="true" /></button>;
}

function PercentIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="7" cy="7" r="2.5" /><circle cx="17" cy="17" r="2.5" /><path d="M6 19 18 5" /></svg>;
}

function PortfolioOutcomes({ portfolio, currency, onExplain }) {
  const cards = [
    ['active_projects', 'Active projects', Square3Stack3DIcon, 'blue', numberPresent(portfolio.register?.total_rows) ? `${formatNumber(portfolio.register.total_rows)} open in portfolio` : 'Current active status'],
    ['contract_value', 'Total contract value', DocumentTextIcon, 'blue', `${currency} · recorded value`],
    ['revenue_remaining', 'Revenue remaining', ChartBarIcon, 'green', 'Finance report pending'],
    ['forecast_margin', 'Forecast margin', PercentIcon, 'amber', 'Matching costs pending'],
    ['schedule_confidence', 'Schedule confidence', CalendarDaysIcon, 'amber', 'Assessment pending'],
  ];
  return <section className="pp-outcomes" aria-label="Five portfolio outcomes" data-testid="portfolio-outcomes">{cards.map(([id, label, Icon, tone, note]) => {
    const metric = portfolioCurrencyMetric(portfolio, id, currency);
    const original = portfolio.kpis?.find(item => item.id === id);
    const trend = original?.trend;
    const sameCurrency = metric.unit !== 'currency' || trend?.currency === currency || (!original?.by_currency && original?.currency === currency);
    const values = reported(metric.status) && sameCurrency && Array.isArray(trend?.values) ? trend.values : [];
    return <article className={`pp-outcome pp-outcome--${tone}`} key={id} data-testid={`portfolio-kpi-${id}`}>
      <span className="pp-outcome-icon" aria-hidden="true"><Icon /></span><div className="pp-outcome-body"><div className="pp-outcome-heading"><h2>{label}</h2><PortfolioInfo metric={{ ...metric, label }} label={label} onExplain={onExplain} /></div><strong className="pp-outcome-value"><PortfolioMetricValue metric={metric} /></strong><p className="pp-outcome-basis">{['restricted', 'error'].includes(metric.status) ? metric.status === 'restricted' ? 'Access restricted' : 'Source unavailable' : id === 'contract_value' && metric.status === 'unavailable' ? 'Contract data incomplete' : reported(metric.status) && metric.unit === 'percent' && numberPresent(metric.target) ? `Target ${formatNumber(metric.target)}%` : reported(metric.status) && ['forecast_margin', 'schedule_confidence'].includes(id) ? 'Approved project assessment' : reported(metric.status) && id === 'revenue_remaining' ? `${currency} · approved value` : note}</p></div><PortfolioKpiGraphic id={id} values={values} kind={id === 'active_projects' ? 'bars' : 'line'} label={`${label} history`} color={tone === 'green' ? '#00a977' : tone === 'amber' ? '#f7a400' : '#1674ff'} />
    </article>;
  })}</section>;
}

function PortfolioInterventionLauncher({ portfolio }) {
  const status = portfolio.actions_status || portfolio.status;
  const known = reported(status) && numberPresent(portfolio.action_count) && Number(portfolio.action_count) >= 0;
  const count = known ? Number(portfolio.action_count) : null;
  const coverage = status === 'restricted' ? 'Restricted' : status === 'error' ? 'Unavailable' : status === 'partial' ? 'Incomplete' : 'Not reported';
  const label = count === null ? `Interventions · ${coverage}` : `${formatNumber(count)} ${count === 1 ? 'intervention' : 'interventions'}`;
  const Icon = count > 0 ? ExclamationTriangleIcon : count === 0 ? CheckCircleIcon : InformationCircleIcon;
  return <button type="button" className={`pp-intervention-launcher cc-screen-only${count > 0 ? ' pp-intervention-launcher--attention' : ''}`} data-testid="portfolio-intervention-launcher" aria-label={count === null ? `Review portfolio interventions: ${coverage.toLowerCase()}` : `Review ${formatNumber(count)} portfolio ${count === 1 ? 'intervention' : 'interventions'}`} aria-controls="pp-decisions" title={`${label}${status === 'partial' && count !== null ? ' · Partial coverage' : ''}${portfolio.actions_truncated ? ' · Returned preview limited' : ''}`} onClick={reviewPortfolioInterventions}>
    <Icon aria-hidden="true" /><span>{label}</span>{status === 'partial' && count !== null && <small>Partial</small>}<ArrowRightIcon aria-hidden="true" />
  </button>;
}

function PortfolioDecisions({ report, portfolio, onExplain, printing }) {
  const [expanded, setExpanded] = useState(false);
  const [sort, setSort] = useState({ key: 'priority', direction: 'asc' });
  const sourceStatus = portfolio.actions_status || portfolio.status;
  const actions = reported(sourceStatus) ? [...(portfolio.actions || [])].sort((a, b) => {
    const left = sort.key === 'priority' ? HEALTH_ORDER[a.severity] ?? 9 : a.due_date || '9999';
    const right = sort.key === 'priority' ? HEALTH_ORDER[b.severity] ?? 9 : b.due_date || '9999';
    return (left < right ? -1 : left > right ? 1 : 0) * (sort.direction === 'asc' ? 1 : -1);
  }) : [];
  const visible = printing || expanded ? actions : actions.slice(0, 3);
  const sortColumn = key => setSort(current => ({ key, direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc' }));
  const explain = action => onExplain({ id: action.id, label: action.title, description: [action.project_name, action.detail].filter(Boolean).join(' · '), source: 'Governed project control exceptions', status: 'available', route: action.route });
  return <section id="pp-decisions" tabIndex={-1} className="pp-decisions" aria-labelledby="pp-decisions-title" data-testid="portfolio-decisions">
    <div className="pp-panel-heading"><h2 id="pp-decisions-title">Executive interventions</h2><PortfolioInfo id="portfolio_interventions" label="Executive interventions" description="Recorded project control exceptions, with source owners. Missing financial impacts and intervention due dates remain unreported." onExplain={onExplain} />{actions.length > 3 && <button type="button" className="cc-text-button cc-screen-only pp-heading-link" onClick={() => setExpanded(value => !value)}>{expanded ? 'Show top 3 interventions' : `Show ${actions.length} interventions`}<ArrowRightIcon /></button>}</div>
    {visible.length ? <div className="cc-table-wrap" role="region" aria-label="Portfolio decisions" tabIndex={0}><table className="cc-table pp-decisions-table" data-table-typography="preserve"><caption className="cc-sr-only">Portfolio interventions, source context, owners and due dates</caption><thead><tr><th scope="col">#</th><th scope="col">Intervention</th><th scope="col" aria-sort={sort.key === 'priority' ? sort.direction === 'asc' ? 'ascending' : 'descending' : 'none'}><button type="button" className="pp-sort" onClick={() => sortColumn('priority')}>Priority<ArrowsUpDownIcon /></button></th><th scope="col">Impact</th><th scope="col">Owner</th><th scope="col" aria-sort={sort.key === 'due_date' ? sort.direction === 'asc' ? 'ascending' : 'descending' : 'none'}><button type="button" className="pp-sort" onClick={() => sortColumn('due_date')}>Due date<ArrowsUpDownIcon /></button></th><th scope="col">Action</th></tr></thead><tbody>{visible.map((action, index) => <tr key={action.id} data-testid={`portfolio-action-${action.id}`}><td>{index + 1}</td><th scope="row"><button type="button" className="cc-cell-button pp-truncate" onClick={() => explain(action)} title={`${action.title} · ${action.detail || ''}`}>{action.title}</button></th><td><PortfolioHealthBadge health={action.severity} /></td><td title={action.detail || 'Financial impact not reported'}>{action.impact || '—'}</td><td><span className="pp-truncate" title={action.owner || 'Owner not recorded'}>{action.owner || 'Unassigned'}</span></td><td className={action.due_date && action.due_date < report.generated_at.slice(0, 10) ? 'cc-danger-text' : ''}>{shortDate(action.due_date)}</td><td><RouteLink route={action.route} className="cc-table-action">Review</RouteLink></td></tr>)}</tbody></table></div> : <EmptyState title={sourceStatus === 'restricted' ? 'Project access required' : sourceStatus === 'error' ? 'Project source unavailable' : sourceStatus === 'partial' ? 'Exception coverage incomplete' : 'No interventions reported'} detail="Interventions reflect recorded project control exceptions." />}
    {sourceStatus === 'partial' && <p className="pp-panel-note">Exception coverage is incomplete; returned interventions do not establish the portfolio total.</p>}
    {portfolio.actions_truncated && <p className="pp-panel-note">This report includes {actions.length}{numberPresent(portfolio.action_count) ? ` of ${formatNumber(portfolio.action_count)}` : ''} interventions. <RouteLink route="/projects?view=portfolio-exceptions">Open full exception register</RouteLink></p>}
  </section>;
}

const REGISTER_COLUMNS = [
  ['name', 'Project'], ['client_name', 'Client'], ['contract_value', 'Contract value'], ['progress_pct', 'Progress'],
  ['schedule_variance', 'Schedule variance'], ['forecast_margin', 'Forecast margin'], ['health', 'Health'], ['owner', 'Owner'],
];
function compareProjects(a, b, key, direction) {
  const numeric = ['progress_pct', 'forecast_margin', 'contract_value'].includes(key);
  const read = project => key === 'health' ? HEALTH_ORDER[project.health] ?? 9
    : key === 'next_milestone' ? project.next_milestone?.due_date || project.next_milestone?.target_date
      : project[key];
  const left = read(a), right = read(b);
  const leftMissing = left == null || left === '' || numeric && !numberPresent(left);
  const rightMissing = right == null || right === '' || numeric && !numberPresent(right);
  if (leftMissing !== rightMissing) return leftMissing ? 1 : -1;
  if (leftMissing) return String(a.name || '').localeCompare(String(b.name || ''));
  // Currency groups stay separate; cross-currency amounts are never ranked as a common value.
  if (key === 'contract_value' && (a.currency || 'UNSPECIFIED') !== (b.currency || 'UNSPECIFIED')) return (a.currency || 'UNSPECIFIED').localeCompare(b.currency || 'UNSPECIFIED');
  const result = numeric || key === 'health' ? Number(left) - Number(right) : String(left).localeCompare(String(right));
  return (result || String(a.name || '').localeCompare(String(b.name || ''))) * (direction === 'asc' ? 1 : -1);
}

function PortfolioRegister({ portfolio, printing, registerRef }) {
  const register = portfolio.register || {};
  const projects = register.projects || EMPTY_PROJECTS;
  const [filters, setFilters] = useState({ search: '', business_unit: 'all', health: 'all', phase: 'all', owner: 'all' });
  const [sort, setSort] = useState({ key: 'health', direction: 'asc' });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [allProjects, setAllProjects] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const optionValues = key => [...new Set(projects.map(project => project[key]).filter(Boolean))].sort();
  const updateFilter = (key, value) => { setFilters(current => ({ ...current, [key]: value })); setPage(1); };
  const filtered = useMemo(() => projects.filter(project => printing || (
    (allProjects || ['critical', 'high', 'medium', 'low'].includes(project.health))
      && [project.name, project.code, project.client_name].some(value => String(value || '').toLowerCase().includes(filters.search.trim().toLowerCase()))
      && ['business_unit', 'health', 'phase', 'owner'].every(key => filters[key] === 'all' || project[key] === filters[key])
  )).sort((a, b) => compareProjects(a, b, sort.key, sort.direction)), [projects, filters, sort, printing, allProjects]);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pages);
  const start = printing ? 0 : (currentPage - 1) * pageSize;
  const visible = printing ? filtered : filtered.slice(start, start + pageSize);
  const options = [
    ['business_unit', 'Business unit'], ['health', 'Health'], ['phase', 'Project phase'], ['owner', 'Project owner'],
  ];
  const available = register.status === 'available';
  const pageNumbers = Array.from({ length: pages }, (_, index) => index + 1).filter(number => number === 1 || number === pages || Math.abs(number - currentPage) <= 1);
  const sortColumn = key => { setSort(current => ({ key, direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc' })); setPage(1); };
  return <section ref={registerRef} tabIndex={-1} className="pp-panel pp-register" aria-labelledby="pp-register-title" data-testid="portfolio-register">
    <div className="pp-panel-heading"><h2 id="pp-register-title">{allProjects ? 'Project portfolio register' : 'Projects requiring intervention'}</h2><div className="pp-register-tools cc-screen-only"><button type="button" className="cc-text-button" aria-expanded={filtersOpen} aria-controls="pp-project-filters" onClick={() => setFiltersOpen(value => !value)}>Filter projects</button><button type="button" className="cc-text-button" onClick={() => { setAllProjects(value => !value); setPage(1); }}>{allProjects ? 'Interventions only' : 'All projects'}<ArrowRightIcon /></button></div><span className="pp-register-count">{available && numberPresent(register.total_rows) ? <><strong>{formatNumber(register.total_rows)}</strong> projects in scope</> : <Status status={register.status || portfolio.status} />}</span></div>
    {available ? <><div id="pp-project-filters" hidden={!filtersOpen} className="pp-register-filters cc-screen-only"><label className="pp-search"><span className="cc-sr-only">Search portfolio</span><MagnifyingGlassIcon /><input type="search" aria-label="Search portfolio" placeholder="Search project, client or code…" value={filters.search} onChange={event => updateFilter('search', event.target.value)} /></label>
      {options.map(([key, label]) => { const values = optionValues(key); return <label key={key}>{label}<select aria-label={`Portfolio ${label.toLowerCase()}`} value={filters[key]} disabled={!values.length} title={!values.length ? `${label} is not recorded in this source.` : undefined} onChange={event => updateFilter(key, event.target.value)}><option value="all">All</option>{values.map(value => <option key={value} value={value}>{key === 'health' ? HEALTH_LABELS[value] || 'Not assessed' : value}</option>)}</select></label>; })}
    </div>
    {visible.length ? <div className="cc-table-wrap" role="region" aria-label="Project portfolio register" tabIndex={0}><table className="cc-table pp-register-table" data-table-typography="preserve"><caption className="cc-sr-only">Project portfolio register; financial measures remain in original currencies</caption><thead><tr>{REGISTER_COLUMNS.map(([key, label]) => <th key={key} scope="col" aria-sort={sort.key === key ? sort.direction === 'asc' ? 'ascending' : 'descending' : 'none'}><button className="pp-sort" onClick={() => sortColumn(key)} title={key === 'contract_value' ? 'Sort within original currency groups' : `Sort by ${label.toLowerCase()}`}>{label}<ArrowsUpDownIcon /></button></th>)}<th scope="col">Action</th></tr></thead><tbody>{visible.map(project => <tr key={project.id} className={['critical', 'high'].includes(project.health) ? 'pp-risk-row' : ''} data-testid={`portfolio-project-${project.id}`}>
      <th scope="row"><span className="pp-truncate" title={`${project.code || ''} · ${project.name}`}>{project.name}</span></th><td><span className="pp-truncate" title={project.client_name}>{project.client_name || '—'}</span></td><td className="pp-contract-cell">{numberPresent(project.contract_value) ? `${project.currency || 'UNSPECIFIED'} ${formatNumber(project.contract_value, { notation: Math.abs(Number(project.contract_value)) >= 1000000 ? 'compact' : 'standard' })}` : '—'}</td>
      <td>{numberPresent(project.progress_pct) ? <div className="pp-progress"><strong>{formatNumber(project.progress_pct)}%</strong><span role="progressbar" aria-label={`${project.name} progress`} aria-valuenow={Math.max(0, Math.min(100, Number(project.progress_pct)))} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${Math.max(0, Math.min(100, Number(project.progress_pct)))}%` }} /></span></div> : '—'}</td>
      <td className={numberPresent(project.schedule_variance) ? Number(project.schedule_variance) > 0 ? 'pp-cell-late' : 'pp-cell-clear' : ''}>{numberPresent(project.schedule_variance) ? Number(project.schedule_variance) === 0 ? 'On plan' : `${Number(project.schedule_variance) > 0 ? '+' : ''}${formatNumber(project.schedule_variance)} days` : project.schedule_variance || '—'}</td><td>{numberPresent(project.forecast_margin) ? `${formatNumber(project.forecast_margin)}%` : '—'}</td><td><PortfolioHealthBadge health={project.health} /></td><td><span className="pp-truncate" title={project.owner || 'Project owner not recorded'}>{project.owner || 'Unassigned'}</span></td><td><RouteLink route={project.route} className={`cc-table-action ${['critical', 'high'].includes(project.health) ? 'pp-review-action' : ''}`}>{['critical', 'high'].includes(project.health) ? 'Review' : 'Open'}</RouteLink></td>
    </tr>)}</tbody></table></div> : <EmptyState title={projects.length ? allProjects ? 'No projects match these filters' : 'No recorded interventions match this view' : 'No projects in scope'} />}
    <div className="pp-pagination"><span>{filtered.length ? `Showing ${start + 1}–${start + visible.length} of ${filtered.length}` : 'Showing 0'} {register.truncated ? 'loaded projects' : 'projects'}</span><nav aria-label="Portfolio register pages" className="cc-screen-only"><button aria-label="Previous project page" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}><ChevronLeftIcon /></button>{pageNumbers.map((number, index) => <React.Fragment key={number}>{index > 0 && number > pageNumbers[index - 1] + 1 && <span>…</span>}<button aria-label={`Project page ${number}`} aria-current={currentPage === number ? 'page' : undefined} onClick={() => setPage(number)}>{number}</button></React.Fragment>)}<button aria-label="Next project page" disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}><ChevronRightIcon /></button></nav><label className="cc-screen-only">Rows per page<select aria-label="Projects per page" value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPage(1); }}>{[5, 10, 20].map(value => <option key={value}>{value}</option>)}</select></label></div>
    {register.truncated && <p className="pp-panel-note">The report includes {projects.length} of {formatNumber(register.total_rows)} projects. Search, filters and pages apply to the loaded rows. <RouteLink route="/projects">Open full register</RouteLink></p>}
    </> : <EmptyState title={register.status === 'restricted' ? 'Project access required' : register.status === 'error' ? 'Project source unavailable' : 'Project register not connected'} detail="The project register requires an accessible source." />}
    <p className="pp-panel-note">Recorded project exceptions · Contract amounts retain their original currencies. Unreported margin and schedule measures remain blank.</p>
  </section>;
}

function DeliveryOutlook({ portfolio, currency, onExplain }) {
  const source = portfolio.delivery_outlook || {};
  const available = reported(portfolio.status) && reported(source.status);
  return <section className="pp-panel pp-delivery-outlook" aria-labelledby="pp-outlook-title" data-testid="portfolio-delivery-outlook"><div className="pp-panel-heading"><h2 id="pp-outlook-title">Portfolio delivery outlook</h2><PortfolioInfo id="delivery_outlook" label="Portfolio delivery outlook" description="Projects require approved forecast margin and schedule variance on a common reporting basis. Bubble sizes use remaining revenue in the selected original currency. Progress is a separate measure." onExplain={onExplain} /><RouteLink className="pp-heading-link" route="/projects?view=portfolio-exceptions">Open portfolio analysis<ArrowRightIcon /></RouteLink></div><PortfolioDeliveryScatter rows={available ? source.scatter || [] : []} currency={currency} targetMargin={available ? source.target_margin : null} /></section>;
}

function MarginScheduleTrend({ portfolio, onExplain }) {
  const source = portfolio.delivery_outlook || {};
  const available = reported(portfolio.status) && reported(source.status);
  return <section className="pp-panel pp-trend-panel" aria-labelledby="pp-trend-title" data-testid="portfolio-margin-schedule"><div className="pp-panel-heading"><h2 id="pp-trend-title">Margin &amp; schedule trend</h2><PortfolioInfo id="margin_schedule_trend" label="Margin and schedule trend" description="Monthly forecast margin and average schedule variance require approved comparable historical snapshots. Current project progress does not establish a history." onExplain={onExplain} /></div><PortfolioMarginScheduleTrend rows={available ? source.series || [] : []} targetMargin={available ? source.target_margin : null} /></section>;
}

function PortfolioControls({ portfolio, onExplain, onNavigate }) {
  const register = portfolio.register || {};
  const projects = register.projects || EMPTY_PROJECTS;
  const coverage = register.status === 'available' && !register.truncated && projects.length > 0 ? projects.filter(project => !!project.data_date).length / projects.length * 100 : null;
  const items = [
    ['reporting_coverage', 'Reporting coverage', numberPresent(coverage) ? `${formatNumber(coverage)}%` : 'Not assessed', 'Share of the complete open-project register with a recorded control snapshot date. A snapshot does not establish approved financial reporting.', numberPresent(coverage)],
    ['baseline_coverage', 'Baseline coverage', 'Not assessed', 'Approved project baseline coverage is not supplied by this portfolio source.', false],
    ['cost_control_coverage', 'Cost-control coverage', 'Not assessed', 'Approved cost-control coverage is not supplied by this portfolio source.', false],
    ['risk_reviews', 'Risk reviews', 'Not assessed', 'Project-specific risk review deadlines and completion evidence are not connected.', false],
    ['data_confidence', 'Data confidence', portfolio.status === 'restricted' ? 'Restricted' : 'Incomplete', 'Margin, remaining revenue, schedule confidence and capacity require approved reporting sources.', false],
  ];
  return <section className="pp-controls" aria-label="Portfolio controls"><h2>Portfolio controls</h2>{items.map(([id, label, value, description, known]) => <button type="button" key={id} onClick={() => onExplain({ ...definition(id, label, description), status: known ? 'available' : 'unavailable' })}>{known ? <CheckCircleIcon className="pp-control-known" /> : <InformationCircleIcon />}<span>{label} <strong>{value}</strong></span></button>)}<button type="button" className="cc-text-button" onClick={() => onNavigate('risk')}>View governance status<ArrowRightIcon /></button></section>;
}

export default function ProjectPortfolio({ report, portfolio, currency = 'AED', onExplain, onNavigate, printing = false, onRevenueSnapshotChange, revenueNavigationRequest, onRefreshWorkbook }) {
  const registerRef = useRef(null);
  if (portfolio.revenue_dashboard?.enabled) return <PortfolioRevenueDashboard initial={portfolio.revenue_dashboard} onExplain={onExplain} printing={printing} onSnapshotChange={onRevenueSnapshotChange} navigationRequest={revenueNavigationRequest} onRefreshWorkbook={onRefreshWorkbook} renderInterventions={risk => <PortfolioInterventionLauncher portfolio={risk} />} />;
  return <div className="portfolio-performance" data-testid="project-portfolio"><PortfolioOutcomes portfolio={portfolio} currency={currency} onExplain={onExplain} />{!printing && <PortfolioInterventionLauncher portfolio={portfolio} />}<div className="pp-reference-grid"><DeliveryOutlook portfolio={portfolio} currency={currency} onExplain={onExplain} /><PortfolioHealthSummary portfolio={portfolio} onExplain={onExplain} printing={printing} /><PortfolioRegister portfolio={portfolio} printing={printing} registerRef={registerRef} /><div className="pp-panel pp-interventions-panel"><PortfolioDecisions report={report} portfolio={portfolio} onExplain={onExplain} printing={printing} /><PortfolioMilestones portfolio={portfolio} onExplain={onExplain} printing={printing} /></div><MarginScheduleTrend portfolio={portfolio} onExplain={onExplain} /><PortfolioDeliveryCapacity portfolio={portfolio} onExplain={onExplain} onNavigate={onNavigate} /></div><PortfolioControls portfolio={portfolio} onExplain={onExplain} onNavigate={onNavigate} /><details className="pp-additional-details" open={printing || undefined}><summary>Contract concentration and reporting basis</summary><PortfolioConcentration portfolio={portfolio} onExplain={onExplain} printing={printing} /></details><p className="pp-scope-note">All figures are provisional until portfolio reporting closes. {currency} amount cards use original currencies; no FX conversion is applied. Counts and health cover all accessible open projects.</p></div>;
}
