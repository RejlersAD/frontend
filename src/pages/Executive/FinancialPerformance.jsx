/* eslint-disable react/prop-types */
import React, { useState } from 'react';
import { ArrowRightIcon, BanknotesIcon, ChartBarIcon, ChartPieIcon, ClockIcon, CurrencyDollarIcon, InformationCircleIcon } from '@heroicons/react/24/outline';
import { formatDate } from './executivePresentation';
import { EmptyState, RouteLink, Status } from './ExecutivePrimitives';
import { FINANCIAL_KPIS, FinancialMetricValue, financialMetric, unavailableFinancialMetric } from './financialPresentation';
import { CashWorkingCapital, FinancialControls, ForecastBridge } from './FinancialSidePanels';
import ExecutiveKpiCard from './ExecutiveKpiCard';
import './FinancialPerformance.css';

const SOURCE_NOT_CONNECTED = 'Approved financial reporting source not connected';
const financeNote = (id, label, description, unit = 'count') => unavailableFinancialMetric(id, label, description, unit);

function FinancialOutcomes({ financial, currency, onExplain }) {
  const icons = [CurrencyDollarIcon, ChartBarIcon, ChartPieIcon, BanknotesIcon, ClockIcon];
  const tones = ['blue', 'purple', 'green', 'rose', 'amber'];
  return <section className="fp-outcomes" aria-label="Five financial outcomes" data-testid="financial-outcomes">
    {FINANCIAL_KPIS.map((item, index) => {
      const metric = financialMetric(financial, item.id, currency);
      return <ExecutiveKpiCard key={item.id} className="fp-outcome" valueClassName="fp-outcome-value"
        testId={`financial-kpi-${item.id}`} tone={tones[index]} icon={icons[index]} label={item.label}
        metric={metric} value={<FinancialMetricValue metric={metric} />} onExplain={onExplain}>
        <p className="fp-outcome-target">{item.id === 'dso' || item.id === 'operating_margin' ? 'Target' : item.id === 'cash_position' ? 'Plan' : 'Budget'}: not connected</p>
        <div className="fp-outcome-bottom"><Status status={metric.status} /><span>Comparison unavailable</span></div>
      </ExecutiveKpiCard>;
    })}
  </section>;
}

function FinancialActions({ financial, report, printing, onExplain }) {
  const [expanded, setExpanded] = useState(false);
  const order = { critical: 0, high: 1, medium: 2, low: 3 };
  const actions = [...(financial.actions || [])].sort((a, b) => (order[a.severity] ?? 9) - (order[b.severity] ?? 9));
  const visible = expanded || printing ? actions : actions.slice(0, 3);
  return <section className="fp-panel fp-actions-panel" aria-labelledby="fp-actions-heading" data-testid="financial-actions">
    <div className="fp-panel-heading"><h2 id="fp-actions-heading">Financial actions required</h2>{actions.length > 3 && <button className="cc-text-button cc-screen-only" onClick={() => setExpanded(value => !value)}>{expanded ? 'Show top 3 actions' : `View all ${actions.length} actions`}<ArrowRightIcon /></button>}</div>
    {visible.length ? <div className="cc-table-wrap" role="region" aria-label="Financial actions" tabIndex={0}><table className="cc-table fp-actions-table"><caption className="cc-sr-only">Financial actions, owners and due dates</caption><thead><tr><th scope="col">Priority</th><th scope="col">Action</th><th scope="col">Scope / Details</th><th scope="col">Financial impact</th><th scope="col">Owner</th><th scope="col">Due date</th><th scope="col">Action</th></tr></thead><tbody>{visible.map(action => <tr key={action.id} data-testid={`financial-action-${action.id}`}>
      <td><span className={`fp-priority fp-priority--${action.severity}`}>{action.severity}</span></td><th scope="row"><button className="cc-cell-button" title={action.title} onClick={() => onExplain({ id: action.id, label: action.title, description: action.detail, source: 'Authorised Finance source record', status: 'available', route: action.route })}>{action.title}</button></th><td><span className="fp-cell-truncate" title={action.detail}>{action.detail}</span></td><td>{action.impact || '—'}</td><td title={action.owner || 'Owner not recorded'}><span className="fp-cell-truncate">{action.owner || 'Unassigned'}</span></td><td className={action.due_date && action.due_date < report.generated_at.slice(0, 10) ? 'cc-danger-text' : ''}>{action.due_date ? formatDate(action.due_date).replace(/ \d{4}$/, '') : <span className="cc-muted">Not recorded</span>}</td><td><RouteLink route={action.route} className="cc-table-action">{action.action_label || 'Review'}</RouteLink></td>
    </tr>)}</tbody></table></div> : <EmptyState title={financial.status === 'restricted' ? 'Finance access required' : financial.status === 'error' ? 'Finance source unavailable' : 'No financial actions reported'} detail={financial.status === 'error' ? 'Financial actions could not be retrieved. Refresh the report to try again.' : 'This reflects the accessible Finance records, not a full financial risk assessment.'} />}
    <p className="fp-panel-note">Actions cover all authorised Finance records; the currency selector applies to reported monetary balances.</p>
  </section>;
}

function RevenueMarginPerformance({ onExplain }) {
  const metric = financeNote('financial_history', 'Revenue and margin performance', 'Recognised revenue, approved budget, forecast and operating margin must share a reporting period and currency. No historical performance series is connected.');
  return <section className="fp-panel fp-revenue-panel" aria-labelledby="fp-revenue-heading" data-testid="financial-revenue-margin">
    <div className="fp-panel-heading"><h2 id="fp-revenue-heading">Revenue and margin performance</h2><button className="cc-info-button" aria-label="About revenue and margin performance" onClick={() => onExplain(metric)}><InformationCircleIcon /></button></div>
    <div className="fp-revenue-grid"><div className="fp-combined-chart"><div className="fp-axis-labels"><span>Revenue<br /><small>Reporting series unavailable</small></span><span>Operating margin (%)</span></div>
      <div className="fp-revenue-empty" role="img" aria-label="Revenue and operating margin chart unavailable: approved actual, forecast and budget series are not connected"><div className="fp-chart-grid" aria-hidden="true" /><div className="fp-chart-message"><InformationCircleIcon aria-hidden="true" /><strong>Revenue and margin history not connected</strong><span>Actual, forecast and budget require a common reporting period.</span></div></div>
      <div className="fp-chart-legend"><span><i className="fp-legend-actual" />Actual revenue</span><span><i className="fp-legend-forecast" />Forecast revenue</span><span><i className="fp-legend-budget" />Budget</span><span><i className="fp-legend-margin" />Operating margin</span></div>
    </div><aside className="fp-fy-summary" aria-label="Full year forecast summary"><h3>FY forecast summary</h3><dl>{[
      ['fy_forecast', 'FY forecast', 'Approved full-year forecast revenue is not connected.', 'currency'],
      ['annual_budget', 'Budget', 'An approved full-year budget is not connected.', 'currency'],
      ['forecast_margin', 'Forecast margin', 'Operating profit and forecast revenue for the same year are required.', 'percent'],
      ['forecast_confidence', 'Forecast confidence', 'A governed forecast confidence assessment is not connected.', 'percent'],
    ].map(([id, label, reason, unit]) => <div key={id}><dt><button onClick={() => onExplain(financeNote(id, label, reason, unit))}>{label}</button></dt><dd>—</dd></div>)}</dl><p>Approved forecast required</p></aside></div>
  </section>;
}

function BusinessUnitPerformance({ onExplain }) {
  return <section className="fp-panel fp-business-panel" aria-labelledby="fp-business-heading" data-testid="financial-business-units">
    <div className="fp-panel-heading"><h2 id="fp-business-heading">Business unit performance</h2><button className="cc-info-button" aria-label="About business unit performance" onClick={() => onExplain(financeNote('business_unit_financials', 'Business unit performance', 'Reconciled business-unit revenue, budget, margin, backlog and utilisation are not connected. Project or employee department labels do not establish consolidated business-unit financials.'))}><InformationCircleIcon /></button></div>
    <div className="cc-table-wrap" role="region" aria-label="Business unit financial reporting" tabIndex={0}><table className="cc-table fp-business-table"><caption className="cc-sr-only">Business unit financial reporting coverage</caption><thead><tr>{['Business unit', 'Revenue YTD', 'vs Budget', 'Margin', 'Backlog', 'Utilisation', 'Forecast confidence', 'Status', 'Action'].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead><tbody><tr><td colSpan={9}><EmptyState title="Business-unit financial reporting not connected" detail="Approved reporting by business unit is required to populate this table." /></td></tr></tbody></table></div>
  </section>;
}

function ProjectMarginExposure({ report, printing, onExplain }) {
  const [expanded, setExpanded] = useState(false);
  const portfolio = report.portfolio;
  const projects = portfolio.projects || [];
  const visible = expanded || printing ? projects : projects.slice(0, 3);
  return <section className="fp-panel fp-exposure-panel" aria-labelledby="fp-exposure-heading" data-testid="financial-project-exposure">
    <div className="fp-panel-heading"><h2 id="fp-exposure-heading">Project margin exposure</h2><div className="cc-inline-controls"><button className="cc-info-button" aria-label="About project margin exposure" onClick={() => onExplain(financeNote('project_margin_exposure', 'Project margin exposure', 'Remaining recognised revenue, current margin and forecast margin are not connected. Listed projects are accessible project records; their inclusion does not establish margin exposure.'))}><InformationCircleIcon /></button>{projects.length > 3 && <button className="cc-text-button cc-screen-only" onClick={() => setExpanded(value => !value)}>{expanded ? 'Show top 3 projects' : 'Show more projects'}<ArrowRightIcon /></button>}</div></div>
    {portfolio.status === 'available' && visible.length ? <div className="cc-table-wrap" role="region" aria-label="Project margin reporting" tabIndex={0}><table className="cc-table fp-exposure-table"><caption className="cc-sr-only">Accessible projects awaiting verified margin measures</caption><thead><tr>{['Project', 'Revenue remaining', 'Current margin', 'Forecast margin', 'Variance', 'Owner', 'Corrective plan', 'Action'].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>{visible.map(project => <tr key={project.id} data-testid={`financial-project-${project.id}`}><th scope="row"><span className="fp-cell-truncate" title={project.name}>{project.name}</span></th><td>—</td><td>—</td><td>—</td><td>—</td><td><span className="fp-cell-truncate" title={project.owner || 'Owner not recorded'}>{project.owner || 'Unassigned'}</span></td><td className="cc-muted">Not connected</td><td><RouteLink route={project.route} className="cc-table-action">Open</RouteLink></td></tr>)}</tbody></table></div> : <EmptyState title={portfolio.status === 'restricted' ? 'Project access required' : portfolio.status === 'error' ? 'Project source unavailable' : 'No project records available'} detail="Verified project margin measures are not connected." />}
    <p className="fp-panel-note">Margin measures are unavailable. {portfolio.status === 'available' && <>Showing {visible.length} of {portfolio.counts?.total ?? projects.length} accessible projects; </>}contract value is not revenue remaining.</p>
  </section>;
}

export default function FinancialPerformance({ report, financial, currency, onExplain, printing = false }) {
  return <div className="financial-performance" data-testid="financial-performance">
    <FinancialOutcomes financial={financial} currency={currency} onExplain={onExplain} />
    <div className="fp-layout"><div className="fp-main-column" data-testid="financial-main-column"><FinancialActions financial={financial} report={report} printing={printing} onExplain={onExplain} /><RevenueMarginPerformance onExplain={onExplain} /><BusinessUnitPerformance onExplain={onExplain} /><ProjectMarginExposure report={report} printing={printing} onExplain={onExplain} /></div>
      <aside className="fp-right-column" aria-label="Cash, forecast and financial controls" data-testid="financial-right-column"><CashWorkingCapital report={report} financial={financial} currency={currency} onExplain={onExplain} /><ForecastBridge report={report} financial={financial} currency={currency} onExplain={onExplain} /><FinancialControls report={report} financial={financial} currency={currency} onExplain={onExplain} /></aside></div>
    <div className="fp-financial-note"><InformationCircleIcon aria-hidden="true" /><span>Current management snapshot. Approved financial statements, forecast history and month-end controls are not connected.</span><button className="cc-text-button cc-screen-only" onClick={() => onExplain({ id: 'financial_scope', label: 'Financial reporting scope', description: 'Financial headline outcomes and historical reports require an authoritative accounting source. Invoice balances and aging are operational receivables measures kept separate by original currency.', source: SOURCE_NOT_CONNECTED, status: financial.status })}>Source details</button></div>
  </div>;
}
