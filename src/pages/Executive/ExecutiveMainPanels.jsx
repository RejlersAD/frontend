/* eslint-disable react/prop-types */
import React, { useMemo, useState } from 'react';
import { ArrowRightIcon, BanknotesIcon, BriefcaseIcon, ChartPieIcon, FunnelIcon, InformationCircleIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import { DEPARTMENTS, formatDate, formatNumber } from './executivePresentation';
import { EmptyState, MetricValue, RouteLink, Status } from './ExecutivePrimitives';

const ORDER = { critical: 0, high: 1, medium: 2, low: 3 };
const numberPresent = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));

export function OutcomeCards({ report, onExplain, financial = false }) {
  const ids = financial ? ['revenue', 'ebita_margin', 'operating_cash_flow', 'signed_backlog', 'utilisation', 'projects_at_risk'] : ['revenue', 'ebita_margin', 'signed_backlog', 'utilisation'];
  const treatments = {
    revenue: { tone: 'blue', icon: BanknotesIcon },
    ebita_margin: { tone: 'purple', icon: ChartPieIcon },
    signed_backlog: { tone: 'green', icon: BriefcaseIcon },
    utilisation: { tone: 'rose', icon: UserGroupIcon },
  };
  return <section className={`cc-outcomes ${financial ? 'cc-outcomes--financial' : ''}`} aria-label="Executive key performance indicators" data-testid="executive-outcomes">
    {ids.map(id => report.kpis.find(item => item.id === id)).filter(Boolean).map(metric => {
      const { tone, icon: Icon } = treatments[metric.id] || treatments.revenue;
      return <article key={metric.id} className={`cc-outcome cc-overview-kpi--${tone}`} data-testid={`executive-kpi-${metric.id}`}>
        <span className="cc-overview-kpi-icon" aria-hidden="true"><Icon /></span>
        <div className="cc-overview-kpi-body">
          <div className="cc-outcome-title"><h2>{metric.label}</h2><button className="cc-info-button" onClick={() => onExplain(metric)} aria-label={`About ${metric.label}`}><InformationCircleIcon /></button></div>
          <div className="cc-outcome-value"><MetricValue metric={metric} /></div>
          <div className="cc-outcome-footer" title={metric.reason || metric.description}><Status status={metric.status} />{metric.target != null && <span>Target {formatNumber(metric.target)}</span>}</div>
        </div>
      </article>;
    })}
  </section>;
}

export function DecisionsRequired({ report, printing = false, onExplain }) {
  const [expanded, setExpanded] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [department, setDepartment] = useState('all');
  const [priority, setPriority] = useState('all');
  const [search, setSearch] = useState('');
  const actions = useMemo(() => [...report.actions].sort((a, b) => (ORDER[a.severity] ?? 9) - (ORDER[b.severity] ?? 9)), [report]);
  const filtered = actions.filter(action => (department === 'all' || action.department === department)
    && (priority === 'all' || (priority === 'urgent' && ['high', 'critical'].includes(action.severity)))
    && `${action.title} ${action.owner || ''} ${action.detail || ''}`.toLowerCase().includes(search.toLowerCase()));
  const visible = printing ? actions : expanded || filtersOpen ? filtered : filtered.slice(0, 3);
  return <section className="cc-panel cc-decisions" aria-labelledby="decisions-title" data-testid="executive-decisions">
    <div className="cc-panel-heading"><h2 id="decisions-title">Decisions required</h2><div className="cc-inline-controls"><button className="cc-icon-button cc-screen-only" onClick={() => setFiltersOpen(value => !value)} aria-label="Filter decisions" aria-expanded={filtersOpen}><FunnelIcon /></button>{actions.length > 3 && <button className="cc-text-button cc-screen-only" onClick={() => { setExpanded(value => !value); setFiltersOpen(false); setDepartment('all'); setPriority('all'); setSearch(''); }}>{expanded ? 'Show top 3 decisions' : `View all ${actions.length} decisions`}<ArrowRightIcon /></button>}</div></div>
    {filtersOpen && <div className="cc-decision-filters cc-screen-only"><input aria-label="Search management actions" type="search" value={search} placeholder="Search decision or owner…" onChange={event => setSearch(event.target.value)} /><select aria-label="Filter actions by department" value={department} onChange={event => setDepartment(event.target.value)}><option value="all">All departments</option>{DEPARTMENTS.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select><select aria-label="Filter decisions by priority" value={priority} onChange={event => setPriority(event.target.value)}><option value="all">All priorities</option><option value="urgent">High & critical</option></select></div>}
    {report.action_count > actions.length && <p className="cc-cap-note">Showing {actions.length} of {report.action_count} selected source alerts. Full records remain in each department.</p>}
    {visible.length ? <div className="cc-table-wrap" role="region" aria-label="Management decisions" tabIndex={0}><table className="cc-table cc-decisions-table"><caption className="cc-sr-only">Management decisions and accountable owners</caption><colgroup><col className="cc-col-priority" /><col className="cc-col-decision" /><col className="cc-col-detail" /><col className="cc-col-impact" /><col className="cc-col-owner" /><col className="cc-col-due" /><col className="cc-col-action" /></colgroup><thead><tr><th scope="col">Priority</th><th scope="col">Decision</th><th scope="col">Detail</th><th scope="col">Value / Impact</th><th scope="col">Owner</th><th scope="col">Due date</th><th scope="col">Action</th></tr></thead><tbody>
      {visible.map(action => <tr key={action.id} data-testid={`executive-action-${action.id}`}><td><Status status={action.severity} /></td><th scope="row"><button className="cc-cell-button" onClick={() => onExplain({ id: action.id, label: action.title, description: action.detail, source: 'Recorded department exception', status: 'available', route: action.route })}>{action.title}</button></th><td><span className="cc-cell-detail" title={action.detail}>{action.detail}</span></td><td>{action.impact || '—'}</td><td>{action.owner || 'Unassigned'}</td><td className={action.due_date && action.due_date < report.generated_at.slice(0, 10) ? 'cc-danger-text' : ''}>{action.due_date ? formatDate(action.due_date).replace(/ \d{4}$/, '') : <span className="cc-muted">Not recorded</span>}</td><td><RouteLink route={action.route} className={`cc-table-action ${['critical', 'high'].includes(action.severity) ? 'cc-table-action--primary' : ''}`}>{action.action_label === 'Open action' ? 'Open action' : 'Review'}</RouteLink></td></tr>)}
    </tbody></table></div> : <EmptyState title={actions.length ? 'No matching decisions' : 'No decisions reported'} detail={actions.length ? 'Change the search or filters to see other decisions.' : 'Available source reports contain no management alerts. Unreported risks may remain.'} />}
  </section>;
}

export function PortfolioHealth({ report, printing = false, full = false }) {
  const portfolio = report.portfolio;
  const projects = portfolio.projects || [];
  const [unit, setUnit] = useState('all');
  const [status, setStatus] = useState('all');
  const [owner, setOwner] = useState('all');
  const units = [...new Set(projects.map(row => row.business_unit).filter(Boolean))];
  const owners = [...new Set(projects.map(row => row.owner).filter(Boolean))];
  const statuses = [...new Set(projects.map(row => row.status).filter(Boolean))];
  const filtered = projects.filter(row => (unit === 'all' || row.business_unit === unit) && (status === 'all' || row.status === status) && (owner === 'all' || row.owner === owner));
  const visible = printing ? projects : full ? filtered : filtered.slice(0, 4);
  return <section className="cc-panel cc-portfolio" aria-labelledby="portfolio-title" data-testid="executive-portfolio-health">
    <div className="cc-panel-heading"><h2 id="portfolio-title">Portfolio health</h2><span className="cc-project-count">{portfolio.status === 'available' ? <><strong>{formatNumber(portfolio.counts?.active)}</strong> active projects</> : <Status status={portfolio.status} />}</span></div>
    {portfolio.status === 'available' ? <>
      <div className="cc-portfolio-filters cc-screen-only"><label>Business unit<select aria-label="Filter portfolio by business unit" value={unit} onChange={event => setUnit(event.target.value)} disabled={!units.length} title={!units.length ? 'Business units are not recorded in this source.' : undefined}><option value="all">All business units</option>{units.map(value => <option key={value}>{value}</option>)}</select></label><label>Project status<select aria-label="Filter portfolio by status" value={status} onChange={event => setStatus(event.target.value)}><option value="all">All statuses</option>{statuses.map(value => <option key={value} value={value}>{value.charAt(0).toUpperCase() + value.slice(1)}</option>)}</select></label><label>Project owner<select aria-label="Filter portfolio by owner" value={owner} onChange={event => setOwner(event.target.value)}><option value="all">All owners</option>{owners.map(value => <option key={value}>{value}</option>)}</select></label></div>
      {visible.length ? <div className="cc-table-wrap" role="region" aria-label="Overview project portfolio" tabIndex={0}><table className="cc-table cc-portfolio-table"><caption className="cc-sr-only">Project delivery, risk and responsible owners</caption><thead><tr><th scope="col">Project</th><th scope="col">Client</th><th scope="col">Contract value</th><th scope="col">Progress</th><th scope="col">Margin forecast</th><th scope="col">Schedule variance</th><th scope="col">Risk</th><th scope="col">Executive owner</th><th scope="col">Action</th></tr></thead><tbody>{visible.map(project => <tr key={project.id} className={['high', 'critical'].includes(project.health) ? 'cc-row-risk' : ''} data-testid={`executive-project-${project.id}`}>
        <th scope="row"><span className="cc-project-name" title={`${project.code || ''} · ${project.name}`}>{project.name}</span></th><td>{project.client_name || '—'}</td><td className="cc-money">{numberPresent(project.contract_value) ? `${project.currency || 'UNSPECIFIED'} ${formatNumber(project.contract_value, { notation: 'compact' })}` : '—'}</td><td>{numberPresent(project.progress_pct) ? <div className="cc-progress"><span>{formatNumber(project.progress_pct)}%</span><span className="cc-progress-track" role="progressbar" aria-label={`${project.name} progress`} aria-valuenow={Math.min(100, Math.max(0, Number(project.progress_pct)))} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${Math.min(100, Math.max(0, Number(project.progress_pct)))}%` }} /></span></div> : '—'}</td><td>{numberPresent(project.forecast_margin) ? `${formatNumber(project.forecast_margin)}%` : <span className="cc-muted" title="Forecast margin is not available from the current source.">—</span>}</td><td>{project.schedule_variance ?? <span className="cc-muted" title="Schedule variance is not available from the current source.">—</span>}</td><td><Status status={project.health} /></td><td title={project.data_date ? `Reporting date: ${formatDate(project.data_date)}` : 'Reporting date not recorded'}>{project.owner || 'Unassigned'}</td><td><RouteLink route={project.route} className={`cc-table-action ${['high', 'critical'].includes(project.health) ? 'cc-table-action--primary' : ''}`}>{['high', 'critical'].includes(project.health) ? 'Review' : 'Open'}</RouteLink></td>
      </tr>)}</tbody></table></div> : <EmptyState title={projects.length ? 'No projects match these filters' : 'No projects in scope'} />}
      <div className="cc-portfolio-note"><span>Showing {visible.length} of {formatNumber(portfolio.counts?.total)} projects. Risk reflects recorded control exceptions.</span><RouteLink route="/projects" arrow>Open portfolio</RouteLink></div>
    </> : <EmptyState title={portfolio.status === 'restricted' ? 'Project access required' : 'Project reporting unavailable'} detail="A verified, accessible project source is required to assess portfolio health." />}
  </section>;
}

export function CommercialOutlook({ report, onExplain }) {
  const sales = report.departments.find(section => section.id === 'sales');
  const stages = sales?.pipeline_stages || [];
  const weighted = sales?.metrics.find(metric => metric.id === 'weighted_pipeline');
  const currencies = [...new Set(stages.flatMap(stage => stage.by_currency.map(row => row.currency)))].sort();
  const [chosenCurrency, setChosenCurrency] = useState('');
  const currency = currencies.includes(chosenCurrency) ? chosenCurrency : currencies[0];
  const rows = stages.map(stage => ({ ...stage, amount: stage.by_currency.find(item => item.currency === currency)?.amount ?? '0' }));
  const max = Math.max(...rows.map(stage => Number(stage.amount)), 0);
  const weightedValue = weighted?.by_currency?.find(item => item.currency === currency)?.amount;
  return <section className="cc-panel cc-commercial" aria-labelledby="commercial-title" data-testid="executive-commercial-outlook">
    <div className="cc-panel-heading"><h2 id="commercial-title">Commercial outlook</h2></div>
    <div className="cc-commercial-grid"><div className="cc-revenue-forecast"><div className="cc-subheading"><h3>12-month revenue forecast</h3><button className="cc-info-button" aria-label="About revenue forecast" onClick={() => onExplain({ id: 'revenue_forecast', label: 'Revenue forecast', status: 'unavailable', description: 'An approved time series of recognised revenue, forecast and budget in a common currency and reporting period is required.', source: 'Financial reporting source not connected' })}><InformationCircleIcon /></button></div><div className="cc-chart-legend"><span><i className="cc-legend-actual" />Actual</span><span><i className="cc-legend-forecast" />Forecast</span><span><i className="cc-legend-budget" />Budget</span></div><div className="cc-forecast-empty" role="img" aria-label="Revenue forecast chart unavailable: actual, forecast and budget sources are not connected"><div className="cc-chart-grid" aria-hidden="true" /><div><InformationCircleIcon aria-hidden="true" /><strong>Revenue forecast not connected</strong><span>Actual, forecast and approved budget required</span></div></div></div>
      <div className="cc-pipeline"><div className="cc-subheading"><h3>Pipeline by stage</h3>{currencies.length > 0 && <select aria-label="Pipeline currency" value={currency} onChange={event => setChosenCurrency(event.target.value)} disabled={currencies.length < 2}>{currencies.map(value => <option key={value}>{value}</option>)}</select>}</div>{rows.length && sales.status === 'available' ? <><div className="cc-pipeline-stages">{rows.map(stage => <div className="cc-stage" key={stage.stage}><span>{stage.label}</span><span className="cc-stage-track"><i style={{ width: `${max > 0 ? Math.max(0, Number(stage.amount)) / max * 100 : 0}%` }} /></span><strong>{formatNumber(stage.amount, { notation: 'compact' })}</strong></div>)}</div><div className="cc-weighted"><span>Weighted pipeline</span><strong>{numberPresent(weightedValue) ? `${currency} ${formatNumber(weightedValue, { notation: 'compact' })}` : '—'}</strong></div></> : <EmptyState title={sales?.status === 'restricted' ? 'Sales access required' : 'Pipeline breakdown unavailable'} detail="Original currencies remain separate." />}</div>
      <div className="cc-forecast-confidence"><span>Forecast confidence</span><strong>—</strong><small>Not assessed</small><span>Latest CRM record</span><b>{sales?.source_updated_at ? formatDate(sales.source_updated_at, true) : 'Not recorded'}</b><RouteLink route={sales?.status === 'restricted' ? null : sales?.route} arrow>Open Sales</RouteLink></div>
    </div>
  </section>;
}

export function DepartmentDetail({ department, onExplain }) {
  if (!department) return null;
  return <section className="cc-panel cc-department-detail"><div className="cc-panel-heading"><h2>{department.label} performance</h2><Status status={department.status} /></div><div className="cc-detail-metrics">{department.metrics.map(metric => <button key={metric.id} onClick={() => onExplain(metric)}><span>{metric.label}<InformationCircleIcon aria-hidden="true" /></span><strong><MetricValue metric={metric} /></strong><small>{metric.description}</small></button>)}</div><div className="cc-panel-footer"><RouteLink route={department.status === 'restricted' ? null : department.route} arrow>Open {department.label}</RouteLink></div></section>;
}
