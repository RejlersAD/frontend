/* eslint-disable react/prop-types */
import React, { useMemo, useRef, useState } from 'react';
import { ArrowRightIcon, ArrowsUpDownIcon, CalendarDaysIcon, ChartBarIcon, ChartPieIcon, ChevronLeftIcon, ChevronRightIcon, CircleStackIcon, InformationCircleIcon, MagnifyingGlassIcon, Square3Stack3DIcon } from '@heroicons/react/24/outline';
import { EmptyState, RouteLink, Status } from './ExecutivePrimitives';
import { formatDate, formatNumber } from './executivePresentation';
import { HEALTH_LABELS, PORTFOLIO_OUTCOMES, PortfolioHealthBadge, PortfolioMetricValue, numberPresent, portfolioMetric, unknownPortfolioMetric } from './portfolioPresentation';
import { PortfolioConcentration, PortfolioDeliveryCapacity, PortfolioHealthSummary, PortfolioMilestones } from './PortfolioSidePanels';
import ExecutiveKpiCard from './ExecutiveKpiCard';
import './ProjectPortfolio.css';

const HEALTH_ORDER = { critical: 0, high: 1, medium: 2, low: 3, clear: 4, unavailable: 5, unknown: 5 };
const shortDate = value => value ? formatDate(value).replace(/ \d{4}$/, '') : '—';
const definition = (id, label, description, unit) => unknownPortfolioMetric(id, label, description, unit);

function PortfolioOutcomes({ portfolio, onExplain }) {
  const icons = [Square3Stack3DIcon, CircleStackIcon, ChartPieIcon, CalendarDaysIcon, ChartBarIcon];
  const tones = ['blue', 'purple', 'green', 'rose', 'amber'];
  return <section className="pp-outcomes" aria-label="Five portfolio outcomes" data-testid="portfolio-outcomes">
    {PORTFOLIO_OUTCOMES.map((item, index) => {
      const metric = portfolioMetric(portfolio, item.id);
      return <ExecutiveKpiCard key={item.id} className="pp-outcome"
        valueClassName={`pp-outcome-value ${metric.by_currency?.length > 1 ? 'pp-outcome-value--multiple' : ''}`}
        testId={`portfolio-kpi-${item.id}`} tone={tones[index]} icon={icons[index]} label={item.label}
        metric={metric} value={<PortfolioMetricValue metric={metric} />} onExplain={onExplain}>
          <p className="pp-outcome-basis">{['available', 'partial'].includes(metric.status) ? item.id === 'active_projects' ? 'Current active status' : 'Original contract currencies' : 'Verified source required'}</p>
          <Status status={metric.status} />
          {metric.incomplete_currencies?.length > 0 && <p className="pp-outcome-missing">{metric.incomplete_currencies.join(', ')} total withheld</p>}
      </ExecutiveKpiCard>;
    })}
  </section>;
}

function PortfolioDecisions({ report, portfolio, onExplain, printing }) {
  const [expanded, setExpanded] = useState(false);
  const [sort, setSort] = useState({ key: 'priority', direction: 'asc' });
  const sourceStatus = portfolio.actions_status || portfolio.status;
  const actions = [...(portfolio.actions || [])].sort((a, b) => {
    const left = sort.key === 'priority' ? HEALTH_ORDER[a.severity] ?? 9 : a.due_date || '9999';
    const right = sort.key === 'priority' ? HEALTH_ORDER[b.severity] ?? 9 : b.due_date || '9999';
    return (left < right ? -1 : left > right ? 1 : 0) * (sort.direction === 'asc' ? 1 : -1);
  });
  const visible = printing || expanded ? actions : actions.slice(0, 3);
  const sortColumn = key => setSort(current => ({ key, direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc' }));
  const explain = action => onExplain({ id: action.id, label: action.title, description: action.detail, source: 'Governed project control exceptions', status: 'available', route: action.route });
  return <section className="pp-panel pp-decisions" aria-labelledby="pp-decisions-title" data-testid="portfolio-decisions">
    <div className="pp-panel-heading"><h2 id="pp-decisions-title">Portfolio decisions required</h2>{actions.length > 3 && <button className="cc-text-button cc-screen-only" onClick={() => setExpanded(value => !value)}>{expanded ? 'Show top 3 interventions' : `Show ${actions.length} interventions`}<ArrowRightIcon /></button>}</div>
    {visible.length ? <div className="cc-table-wrap" role="region" aria-label="Portfolio decisions" tabIndex={0}><table className="cc-table pp-decisions-table"><caption className="cc-sr-only">Portfolio interventions, source context, owners and due dates</caption><thead><tr>
      <th scope="col" aria-sort={sort.key === 'priority' ? sort.direction === 'asc' ? 'ascending' : 'descending' : 'none'}><button className="pp-sort" onClick={() => sortColumn('priority')}>Priority<ArrowsUpDownIcon /></button></th><th scope="col">Action</th><th scope="col">Project</th><th scope="col">Impact / context</th><th scope="col">Owner</th>
      <th scope="col" aria-sort={sort.key === 'due_date' ? sort.direction === 'asc' ? 'ascending' : 'descending' : 'none'}><button className="pp-sort" onClick={() => sortColumn('due_date')}>Due date<ArrowsUpDownIcon /></button></th><th scope="col">Action</th>
    </tr></thead><tbody>{visible.map(action => <tr key={action.id} data-testid={`portfolio-action-${action.id}`}>
      <td><PortfolioHealthBadge health={action.severity} /></td><th scope="row"><button className="cc-cell-button pp-truncate" onClick={() => explain(action)} title={action.title}>{action.title}</button></th><td><span className="pp-truncate" title={action.project_name || action.project_code}>{action.project_name || action.project_code || '—'}</span></td><td><span className="pp-truncate" title={action.detail}>{action.detail || action.impact || 'Not connected'}</span></td><td><span className="pp-truncate" title={action.owner || 'Owner not recorded'}>{action.owner || 'Unassigned'}</span></td><td className={action.due_date && action.due_date < report.generated_at.slice(0, 10) ? 'cc-danger-text' : ''}>{shortDate(action.due_date)}</td><td><RouteLink route={action.route} className="cc-table-action">Review</RouteLink></td>
    </tr>)}</tbody></table></div> : <EmptyState title={sourceStatus === 'restricted' ? 'Project access required' : sourceStatus === 'error' ? 'Project source unavailable' : sourceStatus === 'partial' ? 'Exception coverage incomplete' : 'No interventions reported'} detail="Interventions reflect recorded project control exceptions." />}
    <p className="pp-panel-note">Recorded control exceptions; missing financial impacts and intervention due dates remain unreported.</p>
    {sourceStatus === 'partial' && <p className="pp-panel-note">Exception coverage is incomplete. The returned interventions do not establish the portfolio total.</p>}
    {portfolio.actions_truncated && <p className="pp-panel-note">This report includes {actions.length}{numberPresent(portfolio.action_count) ? ` of ${formatNumber(portfolio.action_count)}` : ''} interventions. <RouteLink route="/projects?view=portfolio-exceptions">Open full exception register</RouteLink></p>}
  </section>;
}

const REGISTER_COLUMNS = [
  ['name', 'Project'], ['client_name', 'Client'], ['contract_value', 'Contract value'], ['progress_pct', 'Progress'],
  ['forecast_margin', 'Forecast margin'], ['schedule_variance', 'Schedule variance'], ['next_milestone', 'Next milestone'], ['health', 'Health'], ['owner', 'Project owner'],
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
  const projects = register.projects || [];
  const [filters, setFilters] = useState({ search: '', business_unit: 'all', health: 'all', phase: 'all', owner: 'all' });
  const [sort, setSort] = useState({ key: 'health', direction: 'asc' });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const optionValues = key => [...new Set(projects.map(project => project[key]).filter(Boolean))].sort();
  const updateFilter = (key, value) => { setFilters(current => ({ ...current, [key]: value })); setPage(1); };
  const filtered = useMemo(() => projects.filter(project => printing || (
    [project.name, project.code, project.client_name].some(value => String(value || '').toLowerCase().includes(filters.search.trim().toLowerCase()))
      && ['business_unit', 'health', 'phase', 'owner'].every(key => filters[key] === 'all' || project[key] === filters[key])
  )).sort((a, b) => compareProjects(a, b, sort.key, sort.direction)), [projects, filters, sort, printing]);
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
    <div className="pp-panel-heading"><h2 id="pp-register-title">Portfolio register</h2><span className="pp-register-count">{available && numberPresent(register.total_rows) ? <><strong>{formatNumber(register.total_rows)}</strong> projects in scope</> : <Status status={register.status || portfolio.status} />}</span></div>
    {available ? <><div className="pp-register-filters cc-screen-only"><label className="pp-search"><span className="cc-sr-only">Search portfolio</span><MagnifyingGlassIcon /><input type="search" aria-label="Search portfolio" placeholder="Search project, client or code…" value={filters.search} onChange={event => updateFilter('search', event.target.value)} /></label>
      {options.map(([key, label]) => { const values = optionValues(key); return <label key={key}>{label}<select aria-label={`Portfolio ${label.toLowerCase()}`} value={filters[key]} disabled={!values.length} title={!values.length ? `${label} is not recorded in this source.` : undefined} onChange={event => updateFilter(key, event.target.value)}><option value="all">All</option>{values.map(value => <option key={value} value={value}>{key === 'health' ? HEALTH_LABELS[value] || 'Not assessed' : value}</option>)}</select></label>; })}
    </div>
    {visible.length ? <div className="cc-table-wrap" role="region" aria-label="Project portfolio register" tabIndex={0}><table className="cc-table pp-register-table"><caption className="cc-sr-only">Project portfolio register; financial measures remain in original currencies</caption><thead><tr>{REGISTER_COLUMNS.map(([key, label]) => <th key={key} scope="col" aria-sort={sort.key === key ? sort.direction === 'asc' ? 'ascending' : 'descending' : 'none'}><button className="pp-sort" onClick={() => sortColumn(key)} title={key === 'contract_value' ? 'Sort within original currency groups' : `Sort by ${label.toLowerCase()}`}>{label}<ArrowsUpDownIcon /></button></th>)}<th scope="col">Action</th></tr></thead><tbody>{visible.map(project => <tr key={project.id} className={['critical', 'high'].includes(project.health) ? 'pp-risk-row' : ''} data-testid={`portfolio-project-${project.id}`}>
      <th scope="row"><span className="pp-truncate" title={`${project.code || ''} · ${project.name}`}>{project.name}</span></th><td><span className="pp-truncate" title={project.client_name}>{project.client_name || '—'}</span></td><td className="pp-contract-cell">{numberPresent(project.contract_value) ? `${project.currency || 'UNSPECIFIED'} ${formatNumber(project.contract_value, { notation: Math.abs(Number(project.contract_value)) >= 1000000 ? 'compact' : 'standard' })}` : '—'}</td>
      <td>{numberPresent(project.progress_pct) ? <div className="pp-progress"><strong>{formatNumber(project.progress_pct)}%</strong><span role="progressbar" aria-label={`${project.name} progress`} aria-valuenow={Math.max(0, Math.min(100, Number(project.progress_pct)))} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${Math.max(0, Math.min(100, Number(project.progress_pct)))}%` }} /></span></div> : '—'}</td>
      <td>{numberPresent(project.forecast_margin) ? `${formatNumber(project.forecast_margin)}%` : '—'}</td><td>{project.schedule_variance ?? '—'}</td><td>{project.next_milestone ? <span className="pp-truncate" title={project.next_milestone.name}>{project.next_milestone.name} <span className="pp-nowrap">{shortDate(project.next_milestone.due_date || project.next_milestone.target_date)}</span></span> : '—'}</td><td><PortfolioHealthBadge health={project.health} /></td><td><span className="pp-truncate" title={project.owner || 'Project owner not recorded'}>{project.owner || 'Unassigned'}</span></td><td><RouteLink route={project.route} className={`cc-table-action ${['critical', 'high'].includes(project.health) ? 'pp-review-action' : ''}`}>{['critical', 'high'].includes(project.health) ? 'Review' : 'Open'}</RouteLink></td>
    </tr>)}</tbody></table></div> : <EmptyState title={projects.length ? 'No projects match these filters' : 'No projects in scope'} />}
    <div className="pp-pagination"><span>{filtered.length ? `Showing ${start + 1}–${start + visible.length} of ${filtered.length}` : 'Showing 0'} {register.truncated ? 'loaded projects' : 'projects'}</span><nav aria-label="Portfolio register pages" className="cc-screen-only"><button aria-label="Previous project page" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}><ChevronLeftIcon /></button>{pageNumbers.map((number, index) => <React.Fragment key={number}>{index > 0 && number > pageNumbers[index - 1] + 1 && <span>…</span>}<button aria-label={`Project page ${number}`} aria-current={currentPage === number ? 'page' : undefined} onClick={() => setPage(number)}>{number}</button></React.Fragment>)}<button aria-label="Next project page" disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}><ChevronRightIcon /></button></nav><label className="cc-screen-only">Rows per page<select aria-label="Projects per page" value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPage(1); }}>{[5, 10, 20].map(value => <option key={value}>{value}</option>)}</select></label></div>
    {register.truncated && <p className="pp-panel-note">The report includes {projects.length} of {formatNumber(register.total_rows)} projects. Search, filters and pages apply to the loaded rows. <RouteLink route="/projects">Open full register</RouteLink></p>}
    </> : <EmptyState title={register.status === 'restricted' ? 'Project access required' : register.status === 'error' ? 'Project source unavailable' : 'Project register not connected'} detail="The project register requires an accessible source." />}
    <p className="pp-panel-note">Health reflects governed control exceptions. Forecast margin and schedule variance require approved reporting; project owners are shown where recorded.</p>
  </section>;
}

function DeliveryOutlook({ portfolio, onExplain }) {
  const summary = portfolio.milestones?.metrics || [];
  return <section className="pp-panel pp-delivery-outlook" aria-labelledby="pp-outlook-title" data-testid="portfolio-delivery-outlook"><div className="pp-panel-heading"><h2 id="pp-outlook-title">Delivery outlook</h2><button className="cc-info-button" aria-label="About delivery outlook" onClick={() => onExplain(definition('delivery_outlook', 'Delivery outlook', 'A dated series of approved planned and forecast completions is not connected. Milestone target dates alone do not establish forecast completion.'))}><InformationCircleIcon /></button></div>
    <div className="pp-outlook-grid"><div><div className="pp-chart-legend"><span><i />Planned completions</span><span><i className="pp-legend-forecast" />Forecast completions</span></div><div className="pp-outlook-chart pp-empty-chart"><EmptyState title="Completion forecast not connected" detail="Approved planned and forecast series required." /></div></div>
      <aside className="pp-milestone-summary" aria-label="Milestone summary"><h3>Milestone summary</h3>{[
        ['due_30d', 'Due in 30 days'], ['at_risk', 'At risk'], ['overdue', 'Overdue'], ['first_submission_acceptance', 'Accepted first submission'],
      ].map(([id, label]) => { const metric = summary.find(item => item.id === id) || definition(id, label, 'This milestone assessment is not connected.'); return <button key={id} onClick={() => onExplain(metric)} aria-label={`About milestones ${label.toLowerCase()}`}><strong><PortfolioMetricValue metric={metric} /></strong><span>{label}</span></button>; })}</aside>
    </div></section>;
}

function MarginScheduleExposure({ onExplain, registerRef }) {
  const openRegister = () => { registerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); registerRef.current?.focus({ preventScroll: true }); };
  return <section className="pp-panel pp-exposure" aria-labelledby="pp-exposure-title" data-testid="portfolio-margin-schedule"><div className="pp-panel-heading"><h2 id="pp-exposure-title">Margin and schedule exposure</h2><button className="cc-info-button" aria-label="About margin and schedule exposure" onClick={() => onExplain(definition('margin_schedule_exposure', 'Margin and schedule exposure', 'Comparable forecast margins and signed schedule variance are not connected. Progress percentage cannot substitute for either measure.'))}><InformationCircleIcon /></button></div>
    <div className="pp-scatter-chart pp-empty-chart" role="img" aria-label="Margin and schedule exposure chart unavailable"><span className="pp-axis-y">Forecast margin (%)</span><EmptyState title="Margin and schedule measures not connected" detail="Verified project measures are required to position projects." /><span className="pp-axis-x">Schedule variance (days)</span></div>
    <div className="pp-panel-footer"><span className="pp-panel-note">Project-level reporting required</span><button className="cc-text-button cc-screen-only" onClick={openRegister}>View project register<ArrowRightIcon /></button></div></section>;
}

export default function ProjectPortfolio({ report, portfolio, onExplain, printing = false }) {
  const registerRef = useRef(null);
  return <div className="portfolio-performance" data-testid="project-portfolio"><div className="pp-layout"><div className="pp-main-column" data-testid="portfolio-main-column"><PortfolioOutcomes portfolio={portfolio} onExplain={onExplain} /><PortfolioDecisions report={report} portfolio={portfolio} onExplain={onExplain} printing={printing} /><PortfolioRegister portfolio={portfolio} printing={printing} registerRef={registerRef} /><div className="pp-bottom-grid"><DeliveryOutlook portfolio={portfolio} onExplain={onExplain} /><MarginScheduleExposure onExplain={onExplain} registerRef={registerRef} /></div></div>
    <aside className="pp-right-column" aria-label="Portfolio health, milestones and delivery capacity" data-testid="portfolio-right-column"><PortfolioHealthSummary report={report} portfolio={portfolio} onExplain={onExplain} printing={printing} /><PortfolioMilestones report={report} portfolio={portfolio} onExplain={onExplain} printing={printing} /><PortfolioDeliveryCapacity report={report} portfolio={portfolio} onExplain={onExplain} /><PortfolioConcentration report={report} portfolio={portfolio} onExplain={onExplain} printing={printing} /></aside></div><p className="pp-scope-note"><InformationCircleIcon aria-hidden="true" />{typeof portfolio.scope === 'string' ? portfolio.scope : portfolio.scope?.label || 'Accessible project records in the current workspace. Original currencies remain separate; missing measures remain unavailable.'}</p></div>;
}
