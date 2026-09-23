/* eslint-disable react/prop-types */
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowPathIcon, ArrowTrendingUpIcon, CalendarDaysIcon, ChartBarIcon, ChevronLeftIcon, ChevronRightIcon, ExclamationTriangleIcon, InformationCircleIcon, MagnifyingGlassIcon, RectangleStackIcon, UserGroupIcon, ViewfinderCircleIcon } from '@heroicons/react/24/outline';
import apiClient from '../../services/api.service';
import { EmptyState } from './ExecutivePrimitives';
import { formatDate } from './executivePresentation';
import { CapacityChart, RevenueBreakdownBars, RevenueForecastChart } from './PortfolioRevenueCharts';
import { REVENUE_REPORTED, revenueDecimal, revenueIdentity, revenueMetricNote, revenueMoney, revenueMonth, revenueNumber, revenuePercent } from './portfolioRevenuePresentation';
import PortfolioRevenueOverview, { compactRevenue } from './PortfolioRevenueOverview';
import usePortfolioInvoices from './usePortfolioInvoices';
import PortfolioRecordedInvoices from './PortfolioRecordedInvoices';
import PortfolioProjectConnections, { ProjectConnectionLinks, ProjectConnectionSummary } from './PortfolioProjectConnections';
import './PortfolioRevenueDashboard.css';

const PAGE_SIZE = 10;
const BLANK_FILTERS = { business_unit: '', client: '', pm: '', search: '' };
const HEADLINES = [
  ['total_revenue_actual', 'Actual revenue', 'blue'], ['current_forecast', 'Current forecast', 'teal'],
  ['pm_forecast', 'PM forecast', 'indigo'], ['variance', 'Variance', 'amber'],
  ['total_backlog', 'Backlog', 'blue'], ['total_poc_risk', 'POC risk', 'red'],
];
const BREAKDOWNS = [['business_unit', 'Business unit'], ['client', 'Client'], ['project_manager', 'Project manager']];
const BREAKDOWN_FIELDS = [['actual_revenue', 'Actual revenue'], ['forecast_revenue', 'Current forecast'], ['pm_forecast', 'PM forecast'], ['backlog', 'Backlog'], ['poc_risk', 'POC risk']];
const VIEWS = [['overview', 'Revenue overview'], ['projects', 'Projects & Delivery'], ['pm', 'PM Performance'], ['risk', 'Risk & Claims'], ['invoice', 'Invoice Control'], ['capacity', 'Capacity'], ['connections', 'Project connections']];
const HEADLINE_ICONS = { total_revenue_actual: ChartBarIcon, current_forecast: ArrowTrendingUpIcon, pm_forecast: UserGroupIcon, variance: ViewfinderCircleIcon, total_backlog: RectangleStackIcon, total_poc_risk: ExclamationTriangleIcon };

function Explain({ metric, onExplain, label }) {
  return <button type="button" className="cc-info-button" aria-label={`About ${label || metric?.label}`} onClick={() => onExplain?.({ ...metric, label: label || metric?.label, source: metric?.source || 'Uploaded portfolio workbook' })}><InformationCircleIcon aria-hidden="true" /></button>;
}

function Panel({ title, subtitle, children, controls, className = '', id, testId }) {
  return <section className={`prv-panel ${className}`} aria-label={title} id={id} tabIndex={id ? -1 : undefined} data-testid={testId}>
    <header className="prv-panel-heading"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{controls}</header>{children}
  </section>;
}

function Money({ value, signed = false }) {
  const amount = revenueNumber(value);
  const text = revenueMoney(value);
  return <span className={`prv-money${amount !== null && amount < 0 ? ' prv-negative-text' : ''}`} title={amount === null ? 'Not reported' : `AED ${text}`}>{signed && amount > 0 ? '+' : ''}{text}</span>;
}

function MetricCard({ metric = {}, id, label, tone, onExplain, varianceRatio }) {
  const value = REVENUE_REPORTED.has(metric.status) ? metric.value : null;
  const Icon = HEADLINE_ICONS[id];
  return <article className={`prv-kpi prv-kpi--${tone}`} data-testid={`revenue-kpi-${id}`}>
    <span className="prv-kpi-icon"><Icon aria-hidden="true" /></span><div className="prv-kpi-copy"><div className="prv-kpi-heading"><h2>{label}</h2><Explain metric={{ id, label, ...metric }} onExplain={onExplain} /></div>
    <strong className={`prv-kpi-value${id === 'variance' && revenueNumber(value) > 0 ? ' prv-positive-text' : id === 'variance' && revenueNumber(value) < 0 ? ' prv-negative-text' : ''}`} aria-label={value == null ? 'Total not reported' : `AED ${revenueMoney(value)}`} title={value == null ? 'Total not reported' : `AED ${revenueMoney(value)}`}><span>AED</span> {compactRevenue(value, id === 'variance')}</strong>
    <p title={value == null && revenueNumber(metric.known_value) !== null ? `Known subtotal AED ${revenueMoney(metric.known_value)}` : undefined}>{id === 'variance' && varianceRatio !== null ? `${varianceRatio > 0 ? '+' : ''}${revenuePercent(varianceRatio)} vs PM forecast` : value == null && revenueNumber(metric.known_value) !== null ? `Known subtotal ${compactRevenue(metric.known_value)} · ${revenueMetricNote(metric)}` : revenueMetricNote(metric)}</p></div>
  </article>;
}

function SectionMetrics({ metrics, onExplain }) {
  return <div className="prv-section-metrics">{metrics.map(([id, label, metric]) => <div key={id}><span>{label}<Explain metric={{ id, label, ...metric }} onExplain={onExplain} /></span><strong><Money value={REVENUE_REPORTED.has(metric?.status) ? metric.value : null} /></strong><small>{revenueMetricNote(metric)}</small>{metric?.value == null && revenueNumber(metric?.known_value) !== null && <small>{metric.known_value_label || 'Known subtotal'} <Money value={metric.known_value} /></small>}</div>)}</div>;
}

const WARNING_LABELS = {
  kpi_label_period_mismatch: 'The PM scorecard label differs from the revenue reporting date. Formulas mix current Report references and static inputs; these scores do not establish a historical or current-period assessment.',
  source_header_period_conflict: 'The invoice header period differs from its formula references. Use each row’s comparison date.',
  mixed_comparison_periods: 'Invoice comparisons use different revenue baseline dates. A combined comparison total is withheld; dated subtotals are shown separately.',
  unknown_comparison_period: 'Some invoice comparison dates are unknown. The comparison total is withheld.',
};
function SourceWarnings({ warnings = [] }) {
  const messages = [...new Set(warnings.map(item => typeof item === 'string' ? item : WARNING_LABELS[item.code] || item.message || null).filter(Boolean))];
  return messages.length ? <ul className="prv-source-warnings" aria-label="Source reporting notes">{messages.map(message => <li key={message}>{message}</li>)}</ul> : null;
}

function managerName(row) { return row.kpi?.name ? `${row.kpi.name} (${row.pm || row.label})` : row.label || row.pm || 'Unassigned'; }

function Breakdown({ data }) {
  const [dimension, setDimension] = useState('business_unit');
  const [field, setField] = useState('actual_revenue');
  const [all, setAll] = useState(false);
  const amount = row => row[field] ?? row.coverage?.[field]?.known_value;
  const names = new Map((data.pm_performance?.rows || []).map(row => [row.pm, managerName(row)]));
  const rows = [...(data.breakdowns?.[dimension] || [])].map(row => ({ ...row, label: dimension === 'project_manager' ? names.get(row.label) || row.label : row.label })).sort((a, b) => (revenueNumber(amount(b)) ?? -Infinity) - (revenueNumber(amount(a)) ?? -Infinity));
  return <Panel title="Revenue distribution" subtitle="Selected portfolio scope · AED" className="prv-breakdown-panel" controls={<select aria-label="Revenue breakdown measure" value={field} onChange={event => setField(event.target.value)}>{BREAKDOWN_FIELDS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>}>
    <div className="prv-segmented" role="group" aria-label="Revenue breakdown dimension">{BREAKDOWNS.map(([key, label]) => <button type="button" key={key} aria-pressed={dimension === key} onClick={() => { setDimension(key); setAll(false); }}>{label}</button>)}</div>
    <RevenueBreakdownBars rows={rows} field={field} label={BREAKDOWN_FIELDS.find(([key]) => key === field)[1]} />
    {rows.length > 0 && <details className="prv-chart-values" open={all || undefined} onToggle={event => setAll(event.currentTarget.open)}><summary>All {rows.length} groups</summary><div className="prv-table-wrap" tabIndex={0} role="region" aria-label="Revenue breakdown figures"><table><caption className="cc-sr-only">Full selected revenue breakdown in AED</caption><thead><tr><th scope="col">Group</th><th scope="col">Projects</th><th scope="col">Amount</th></tr></thead><tbody>{rows.map(row => <tr key={row.label}><th scope="row">{row.label || 'Not assigned'}</th><td>{revenueDecimal(row.project_count)}</td><td><Money value={amount(row)} />{row[field] == null && amount(row) != null && <small>Known subtotal · {row.coverage?.[field]?.missing_count} missing values</small>}</td></tr>)}</tbody></table></div></details>}
  </Panel>;
}

function Progress({ poc, eddr }) {
  return <div className="prv-progress-pair">{[['POC', poc], ['EDDR', eddr]].map(([label, value]) => <div key={label}><span>{label}</span><i>{revenueNumber(value) !== null && <b style={{ width: `${Math.max(0, Math.min(100, Number(value)))}%` }} />}</i><strong>{revenuePercent(value)}</strong></div>)}</div>;
}

function ProjectRegister({ data, page, onPage, printing, onExplain, onReviewConnections }) {
  const source = data.projects || {};
  const rows = Array.isArray(source.rows) ? source.rows : [];
  const visible = printing ? rows : rows.slice(0, PAGE_SIZE);
  const total = Number(source.total_rows) || 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const connections = new Map((data.connections?.rows || []).map(row => [String(row.portfolio_row_id), row]));
  const columns = ['Project / client', 'PM / business unit', 'Contract', 'Recognized to date', 'Actual revenue', 'Current forecast', 'PM forecast', 'Variance', 'Backlog', 'POC / EDDR', 'Forecast margin', 'Forecast finish', 'Connected records'];
  const explainProject = row => onExplain?.({ id: `source-project-${row.id}`, label: row.title || revenueIdentity(row), metrics: [
    ['Revenue & delivery', `${revenueIdentity(row)}. ${row.client || 'Client not reported'}. Cumulative recognized revenue AED ${revenueMoney(row.recognized_revenue_aed)}. POC ${revenuePercent(row.poc_pct)}; EDDR ${revenuePercent(row.eddr_pct)}. Target margin ${revenuePercent(row.target_margin_pct)}; forecast margin ${revenuePercent(row.forecast_margin_pct)}. Start ${formatDate(row.start_date)}; contractual finish ${formatDate(row.contractual_finish)}; forecast finish ${formatDate(row.forecast_finish)}.`],
    ['Delay & contract exposure', `LD exposure AED ${revenueMoney(row.ld_exposure_aed)}; prolongation AED ${revenueMoney(row.prolongation_cost_aed)}. LD possible: ${row.ld_possible ?? 'Not reported'}; frequency: ${row.ld_frequency || 'Not reported'}; minimum ${revenuePercent(row.ld_min_pct)}, maximum ${revenuePercent(row.ld_max_pct)}. Delay ${revenueDecimal(row.delay_days)} days. Extension resources per day ${revenueDecimal(row.extension_resources_per_day)}; hourly cost AED ${revenueMoney(row.extension_cost_per_hour_aed)}.`],
    ['Resources & costs', `Actual manhours ${revenueDecimal(row.actual_manhours)}. AED costs: direct ${revenueMoney(row.direct_cost_aed)}; labor ${revenueMoney(row.labor_cost_aed)}; resources ${revenueMoney(row.resource_cost_aed)}; head office ${revenueMoney(row.head_office_cost_aed)}; other ${revenueMoney(row.other_cost_aed)}.`],
  ].map(([label, description], index) => ({ id: `${row.id}-${index}`, label, description, status: 'available', source: 'Uploaded portfolio workbook', reason: 'Financial POC and engineering delivery progress remain separate source measures. Missing source facts are shown as a dash. Monetary values are workbook-converted AED.' })) });
  return <Panel title="Projects & delivery" subtitle={`${revenueDecimal(total)} project / subproject rows · All financial values in AED`} className="prv-project-panel" testId="revenue-projects" controls={<span className="prv-caption">POC financial progress · EDDR delivery progress</span>}>
    {visible.length ? <div className="prv-table-wrap" tabIndex={0} role="region" aria-label="Revenue project register"><table className="prv-project-table"><caption className="cc-sr-only">Portfolio project and subproject financial and delivery register</caption><thead><tr>{columns.map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>{visible.map((row, index) => <tr key={row.id || `${row.project_code}-${row.subproject_code}-${index}`}>
      <th scope="row"><button type="button" className="prv-project-link" onClick={() => explainProject(row)}>{row.title || revenueIdentity(row)}</button><small>{revenueIdentity(row)} · {row.client || 'Client not reported'}</small></th>
      <td>{row.pm || 'Unassigned'}<small>{row.business_unit || 'Not assigned'}</small></td>
      {['contract_value_aed', 'recognized_revenue_aed', 'actual_revenue', 'forecast_revenue', 'pm_forecast', 'variance', 'backlog'].map(field => <td key={field}><Money value={row[field]} signed={field === 'variance'} /></td>)}
      <td><Progress poc={row.poc_pct} eddr={row.eddr_pct} /></td><td>{revenuePercent(row.forecast_margin_pct)}</td><td>{row.forecast_finish ? formatDate(row.forecast_finish) : '—'}</td><td><ProjectConnectionLinks connection={connections.get(String(row.id))} onReview={onReviewConnections} /></td>
    </tr>)}</tbody></table></div> : <EmptyState title="No projects match this scope" detail="Change the business unit, client, project manager or search filters." />}
    <div className="prv-pagination"><span>{visible.length ? `${page * PAGE_SIZE + 1}–${page * PAGE_SIZE + visible.length} of ${revenueDecimal(total)} rows` : '0 rows'}</span>{!printing && <nav aria-label="Revenue project pages"><button type="button" aria-label="Previous revenue project page" disabled={page === 0} onClick={() => onPage(page - 1)}><ChevronLeftIcon /></button><span>Page {page + 1} of {pages}</span><button type="button" aria-label="Next revenue project page" disabled={page + 1 >= pages} onClick={() => onPage(page + 1)}><ChevronRightIcon /></button></nav>}<span>Totals cover all matching rows</span></div>
    {printing && total > visible.length && <p className="prv-note">This report contains {visible.length} of {total} project rows. Portfolio totals cover the complete selected scope.</p>}
  </Panel>;
}

function RiskReview({ data, onExplain, printing }) {
  const [type, setType] = useState('all');
  const [expanded, setExpanded] = useState(false);
  const risk = data.risks || {};
  const rows = (risk.rows || []).filter(row => type === 'all' || row.type === type);
  const visible = printing || expanded ? rows : rows.slice(0, 5);
  return <Panel title="Risk & contract exposure" subtitle="Recorded POC, delay and prolongation exposure" className="prv-risk-panel" id="pp-decisions" testId="revenue-risks" controls={<select aria-label="Workbook risk type" value={type} onChange={event => setType(event.target.value)}><option value="all">All exposures</option><option value="poc">POC risk</option><option value="ld">Liquidated damages</option><option value="prolongation">Prolongation</option></select>}>
    <SectionMetrics onExplain={onExplain} metrics={['poc', 'ld', 'prolongation'].map((key, index) => [key, ['POC risk', 'LD exposure', 'Prolongation'][index], risk.totals?.[key]])} />
    {visible.length ? <div className="prv-table-wrap" tabIndex={0} role="region" aria-label="Workbook risk review"><table><caption className="cc-sr-only">Workbook risk exposure in AED</caption><thead><tr><th scope="col">Project / owner</th><th scope="col">Exposure</th><th scope="col">Amount</th></tr></thead><tbody>{visible.map((row, index) => <tr key={`${row.id || row.subproject_code}-${row.type}-${index}`}><th scope="row">{row.title || revenueIdentity(row)}<small>{revenueIdentity(row)} · {row.pm || 'Unassigned'}</small></th><td><span className={`prv-exposure prv-exposure--${row.type}`}>{row.label || row.type}</span>{row.detail && <small>{row.detail}</small>}</td><td><Money value={row.amount} /></td></tr>)}</tbody></table></div> : <EmptyState title={risk.status === 'unavailable' ? 'Risk coverage is not available' : 'No recorded exposures in this view'} detail={risk.missing_count ? `${revenueDecimal(risk.missing_count)} source values are missing; absence of recorded exposure does not establish zero risk.` : undefined} />}
    {rows.length > 5 && !printing && <button type="button" className="cc-text-button prv-show-all" onClick={() => setExpanded(value => !value)}>{expanded ? 'Show top 5 exposures' : `Show all ${rows.length} exposures`}</button>}
    {[[risk.poc_history, 'Weekly POC risk history', ['poc_risk_aed']], [risk.history, 'Dated contract risk history', ['poc_risk_aed', 'ld_exposure_aed', 'prolongation_cost_aed']]].map(([history, title, fields]) => history?.length > 0 && <details className="prv-chart-values" key={title}><summary>{title}</summary><div className="prv-table-wrap" tabIndex={0} role="region" aria-label={title}><table><caption className="cc-sr-only">{title} in AED; source dates retain their original year</caption><thead><tr><th scope="col">Source date</th>{fields.map(field => <th scope="col" key={field}>{({ poc_risk_aed: 'POC risk', ld_exposure_aed: 'LD exposure', prolongation_cost_aed: 'Prolongation' })[field]}</th>)}</tr></thead><tbody>{history.map((row, index) => <tr key={`${row.date}-${index}`}><th scope="row">{formatDate(row.date)}</th>{fields.map(field => <td key={field}><Money value={row[field]} /></td>)}</tr>)}</tbody></table></div><p className="prv-note">Source observations may belong to different years; they are not treated as current-period exposure.</p></details>)}
  </Panel>;
}

function InvoiceControl({ data, onExplain, printing, recordedInvoices, onRefreshWorkbook, onReviewConnections }) {
  const [expanded, setExpanded] = useState(false);
  const source = data.invoicing || {};
  const rows = source.rows || [];
  const visible = printing || expanded ? rows : rows.slice(0, 5);
  return <section className="prc-invoice-control" data-testid="revenue-invoicing" aria-label="Invoice control">
    <PortfolioRecordedInvoices state={recordedInvoices} connections={data.connections} onRefreshWorkbook={onRefreshWorkbook} onReviewConnections={onReviewConnections} printing={printing} />
    <details className="prc-workbook-comparison" open={printing || undefined}><summary>Workbook reconciliation</summary><Panel title="Workbook invoice comparison" subtitle="Uploaded source observations, inclusion rules and revenue baseline dates" className="prv-invoice-panel">
    <div className="prv-section-metrics">{[['invoiced_aed', 'Workbook invoiced'], ['balance_aed', 'Balance to invoice'], ['variance_aed', 'Revenue / invoice comparison']].map(([id, label]) => { const metric = source.totals?.[id]; const readable = REVENUE_REPORTED.has(metric?.status); const partial = readable && metric.value == null && metric.known_value != null; return <div key={id}><span>{label}<Explain metric={{ id, label, ...metric }} onExplain={onExplain} /></span><strong><Money value={readable ? metric.value ?? metric.known_value : null} /></strong><small>{partial ? metric.known_value_label || 'Known subtotal · Complete total unavailable' : revenueMetricNote(metric)}</small>{partial && <small>{revenueMetricNote(metric)}</small>}</div>; })}</div>
    {source.description && <p className="prv-note">{source.description}</p>}
    <SourceWarnings warnings={source.warnings} />
    {source.comparison_periods?.length > 1 && <details className="prv-chart-values"><summary>Revenue comparisons by baseline date</summary><div className="prv-table-wrap" tabIndex={0} role="region" aria-label="Invoice comparison baselines"><table><caption className="cc-sr-only">Invoice comparison subtotals separated by source revenue baseline date</caption><thead><tr><th scope="col">Baseline</th><th scope="col">Rows</th><th scope="col">Comparison revenue</th><th scope="col">Gap</th></tr></thead><tbody>{source.comparison_periods.map(group => <tr key={group.comparison_date || 'unknown'}><th scope="row">{group.comparison_date ? formatDate(group.comparison_date) : 'Unknown date'}</th><td>{revenueDecimal(group.included_rows)}</td>{['comparison_revenue_aed', 'variance_aed'].map(field => <td key={field}><Money value={group.totals?.[field]?.value ?? group.totals?.[field]?.known_value} />{group.totals?.[field]?.value == null && <small>Known subtotal</small>}</td>)}</tr>)}</tbody></table></div></details>}
    {visible.length ? <div className="prv-table-wrap" tabIndex={0} role="region" aria-label="Portfolio invoice controls"><table><caption className="cc-sr-only">Invoicing controls in AED with source comparison periods</caption><thead><tr><th scope="col">Project</th><th scope="col">Invoiced</th><th scope="col">Balance</th><th scope="col">Gap</th><th scope="col">Period basis</th></tr></thead><tbody>{visible.map((row, index) => <tr key={row.id || `${row.project_code}-${row.subproject_code}-${index}`}><th scope="row">{row.title || revenueIdentity(row)}<small>{revenueIdentity(row)}</small></th><td><Money value={row.invoiced_aed} /></td><td><Money value={row.balance_aed} /></td><td><Money value={row.variance_aed} signed /></td><td>{row.reporting_date ? revenueMonth(row.reporting_date) : 'Not reported'}<small>Revenue: {row.comparison_date ? revenueMonth(row.comparison_date) : 'Not reported'}</small></td></tr>)}</tbody></table></div> : <EmptyState title="Invoice comparison is not available" detail="Only aligned source invoicing and revenue observations are presented." />}
    {rows.length > 5 && !printing && <button type="button" className="cc-text-button prv-show-all" onClick={() => setExpanded(value => !value)}>{expanded ? 'Show top 5 invoice rows' : `Show all ${rows.length} invoice rows`}</button>}
  </Panel></details></section>;
}

const ratioPercent = value => revenueNumber(value) === null ? '—' : revenuePercent(Number(value) * 100);
function PmPerformance({ data }) {
  const source = data.pm_performance || {};
  const rows = source.rows || [];
  return <Panel title="Project manager performance" subtitle="Current portfolio results and source-labelled PM scorecards" className="prv-pm-panel" testId="revenue-pm-performance">
    {source.description && <p className="prv-note">{source.description}</p>}
    <SourceWarnings warnings={source.warnings} />
    {rows.length ? <div className="prv-table-wrap" tabIndex={0} role="region" aria-label="Project manager performance"><table><caption className="cc-sr-only">PM revenue, delivered margin and source-labelled KPI scores with mixed-period formula limitations</caption><thead><tr>{['Project manager', 'Actual revenue', 'PM forecast', 'Forecast variance', 'Delivered GM', 'KPI period', 'Revenue KPI', 'Invoice KPI', 'CPI score', 'Overall KPI'].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={row.pm || row.label || index}><th scope="row">{managerName(row)}<small>{revenueDecimal(row.project_count)} projects</small></th><td><Money value={row.actual_revenue} /></td><td><Money value={row.pm_forecast} /></td><td><Money value={row.variance} signed /></td><td>{revenuePercent(row.delivered_margin_pct)}</td><td>{row.kpi?.period_label || (row.kpi?.period ? revenueMonth(row.kpi.period) : 'Not reported')}</td><td>{ratioPercent(row.kpi?.revenue_ratio)}</td><td>{ratioPercent(row.kpi?.invoicing_ratio)}</td><td>{revenueNumber(row.kpi?.cpi_ratio) === null ? '—' : revenueDecimal(row.kpi.cpi_ratio)}</td><td>{ratioPercent(row.kpi?.overall_ratio)}</td></tr>)}</tbody></table></div> : <EmptyState title="PM performance is not reported" />}
    <p className="prv-note">PM scorecards retain their source labels and formula limitations. Delivery efficiency is not inferred from financial POC. CPI score is the workbook’s capped revenue/direct-cost score, not an earned-value index.</p>
  </Panel>;
}

function Capacity({ data }) {
  const source = data.capacity || {};
  const rows = source.rows || [];
  return <Panel title="Delivery capacity" subtitle="Resource demand and available manhours" className="prv-capacity-panel" testId="revenue-capacity">
    {REVENUE_REPORTED.has(source.status) && rows.length ? <><CapacityChart rows={rows} period={data.period} /><details className="prv-chart-values"><summary>Capacity plan figures</summary><div className="prv-table-wrap" tabIndex={0} role="region" aria-label="Capacity plan figures"><table><caption className="cc-sr-only">Capacity planning in source manhours</caption><thead><tr><th scope="col">Month</th><th scope="col">Demand</th><th scope="col">Gross capacity</th><th scope="col">Adjusted capacity</th><th scope="col">Gap</th></tr></thead><tbody>{rows.map(row => <tr key={row.period}><th scope="row">{revenueMonth(row.period)}</th>{['demand_manhours', 'gross_capacity_manhours', 'adjusted_capacity_manhours', 'gap_manhours'].map(field => <td key={field}>{revenueDecimal(row[field])}</td>)}</tr>)}</tbody></table></div></details></> : <EmptyState title="Capacity plan unavailable in this scope" detail={source.description || 'The workbook does not supply an aligned capacity plan for the selected scope.'} />}
    <p className="prv-note">{REVENUE_REPORTED.has(source.status) ? source.description : ''} Figures retain source manhours. An FTE conversion requires a stated hours-per-FTE basis.</p>
    {source.staffing?.length > 0 && <div className="prv-staffing"><h3>Staffing plan · Undated source</h3><div className="prv-staffing-grid">{source.staffing.map((row, index) => <div key={`${row.label}-${index}`}><span>{row.label}</span><strong>{revenueDecimal(row.value)} <small>{row.unit === 'fte' ? 'FTE' : row.unit === 'mixed_source_units' ? 'mixed planning units' : 'source units'}</small></strong></div>)}</div></div>}
    <SourceWarnings warnings={source.warnings} />
  </Panel>;
}

export default function PortfolioRevenueDashboard({ initial, onExplain, onSnapshotChange, onRefreshWorkbook, printing = false, navigationRequest }) {
  const [filters, setFilters] = useState(BLANK_FILTERS);
  const [searchText, setSearchText] = useState('');
  const [page, setPage] = useState(0);
  const [retry, setRetry] = useState(0);
  const [remote, setRemote] = useState({ key: '', data: null, error: null });
  const [section, setSection] = useState('overview');
  const [filterPortal, setFilterPortal] = useState(null);
  useEffect(() => { setFilterPortal(document.getElementById('executive-revenue-filters')); }, []);
  const navigate = next => {
    if (!VIEWS.some(([id]) => id === next)) return;
    setSection(next);
    setPage(0);
    requestAnimationFrame(() => { const target = document.getElementById(next === 'risk' ? 'pp-decisions' : 'revenue-content'); target?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); target?.focus({ preventScroll: true }); });
  };
  useEffect(() => {
    if (!navigationRequest?.section || !VIEWS.some(([id]) => id === navigationRequest.section)) return;
    setSection(navigationRequest.section);
    setPage(0);
    const frame = requestAnimationFrame(() => { const target = document.getElementById(navigationRequest.section === 'risk' ? 'pp-decisions' : 'revenue-content'); target?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); target?.focus({ preventScroll: true }); });
    return () => cancelAnimationFrame(frame);
  }, [navigationRequest]);
  useEffect(() => { const timer = setTimeout(() => { setFilters(current => current.search === searchText.trim() ? current : { ...current, search: searchText.trim() }); setPage(0); }, 300); return () => clearTimeout(timer); }, [searchText]);
  const queryLimit = ['overview', 'connections'].includes(section) ? 200 : PAGE_SIZE;
  const query = useMemo(() => ({ ...filters, limit: queryLimit, offset: page * queryLimit }), [filters, page, queryLimit]);
  const key = JSON.stringify(query);
  const useInitial = !Object.values(filters).some(Boolean) && page === 0 && retry === 0;
  useEffect(() => {
    if (useInitial) return undefined;
    const controller = new AbortController();
    setRemote({ key, data: null, error: null });
    apiClient.get('/dashboard/executive/portfolio-workbook/revenue/', { params: query, signal: controller.signal }).then(({ data }) => {
      if (!controller.signal.aborted) setRemote({ key, data, error: null });
    }).catch(error => {
      if (!controller.signal.aborted) setRemote({ key, data: null, error: error.response?.status === 403 ? 'Revenue dashboard access is restricted.' : 'The selected portfolio scope could not be loaded.' });
    });
    return () => controller.abort();
  }, [initial, key, query, retry, useInitial]);
  const data = useInitial ? initial : remote.key === key ? remote.data : null;
  const error = !useInitial && remote.key === key ? remote.error : null;
  const loading = !data && !error;
  const recordedInvoices = usePortfolioInvoices(data, filters);
  useEffect(() => { onSnapshotChange?.({ data, loading, error, filters, section, recordedInvoices: recordedInvoices.loading || recordedInvoices.error ? null : recordedInvoices.data }); }, [data, loading, error, filters, section, recordedInvoices.data, recordedInvoices.loading, recordedInvoices.error, onSnapshotChange]);
  const updateFilter = (field, value) => { setFilters(current => ({ ...current, [field]: value })); setPage(0); };
  const options = initial.filters || {};
  const managerNames = new Map((initial.pm_performance?.rows || []).map(row => [row.pm, managerName(row)]));
  const emptyScope = ['available', 'partial', 'unavailable'].includes(data?.status) && data?.source?.snapshot_id != null && data?.projects?.total_rows === 0 && Object.values(filters).some(Boolean);
  const usable = data && REVENUE_REPORTED.has(data.status);
  const varianceValue = revenueNumber(data?.kpis?.find(metric => metric.id === 'variance')?.value);
  const pmForecastValue = revenueNumber(data?.kpis?.find(metric => metric.id === 'pm_forecast')?.value);
  const varianceRatio = varianceValue !== null && pmForecastValue > 0 ? varianceValue / pmForecastValue * 100 : null;
  const filterControls = <div className="prv-header-filters cc-screen-only">
    <span className="prv-source-period" aria-label="Revenue source month" title="Latest uploaded reporting month"><CalendarDaysIcon aria-hidden="true" />{revenueMonth(data?.period || initial.period)}</span>
    {[['business_unit', 'Business unit', 'business_units', 'All Business Units'], ['client', 'Client', 'clients', 'All Clients'], ['pm', 'Project manager', 'project_managers', 'All PMs']].map(([field, label, values, allLabel]) => <label key={field}><span className="cc-sr-only">{label}</span><select aria-label={`Revenue ${label.toLowerCase()}`} value={filters[field]} onChange={event => updateFilter(field, event.target.value)}><option value="">{allLabel}</option>{(options[values] || []).map(value => <option key={value} value={value}>{field === 'pm' ? managerNames.get(value) || value : value}</option>)}</select></label>)}
    <span className="prv-source-currency" aria-label="Revenue currency AED">AED</span>
    {Object.values(filters).some(Boolean) && <button type="button" className="cc-text-button" onClick={() => { setSearchText(''); setFilters(BLANK_FILTERS); setPage(0); }}>Clear filters</button>}
  </div>;

  return <div className="portfolio-performance prv-dashboard" data-testid="portfolio-revenue-dashboard" aria-busy={loading}>
    {filterPortal ? createPortal(filterControls, filterPortal) : filterControls}
    {section !== 'overview' && !printing && <button type="button" className="prv-back-button cc-screen-only" onClick={() => navigate('overview')}><ChevronLeftIcon aria-hidden="true" />Back to Project Portfolio</button>}
    {loading ? <div className="prv-state" role="status"><ArrowPathIcon className="cc-spinning" />Updating portfolio figures…</div> : error ? <div className="prv-state" role="alert"><p>{error}</p><button type="button" className="cc-button" onClick={() => setRetry(value => value + 1)}>Retry revenue dashboard</button></div> : emptyScope ? <EmptyState title="No projects match this scope" detail="Change or clear the business unit, client, project manager or search filters." /> : !usable ? <EmptyState title={data?.status === 'restricted' ? 'Revenue access restricted' : 'Revenue dashboard unavailable'} detail={data?.description || 'Uploaded workbook figures could not be read. Refresh to try again.'} /> : <>
      {data.source?.is_stale && <p className="prv-scope-caption"><strong>Reporting date is older than the freshness window</strong></p>}
      <section className="prv-kpis" aria-label="Executive revenue outcomes">{HEADLINES.map(([id, label, tone]) => <MetricCard key={id} id={id} label={label} tone={tone} metric={data.kpis?.find(metric => metric.id === id)} onExplain={onExplain} varianceRatio={varianceRatio} />)}</section>
      <ProjectConnectionSummary connections={data.connections} onReview={() => navigate('connections')} onProjects={() => navigate('projects')} />
      <div id="revenue-content" className="prv-view-content" role="region" tabIndex={-1} aria-label={VIEWS.find(([id]) => id === section)?.[1] || 'Project Portfolio'}>
        {section === 'overview' && !printing && <PortfolioRevenueOverview data={data} recordedInvoices={recordedInvoices} onNavigate={navigate} onExplain={onExplain} searchText={searchText} onSearch={setSearchText} businessUnit={filters.business_unit} businessUnits={options.business_units || []} onBusinessUnit={value => updateFilter('business_unit', value)} />}
        {(section === 'projects' || printing) && <><div className="prv-detail-search cc-screen-only"><label className="prv-overview-search"><MagnifyingGlassIcon aria-hidden="true" /><input type="search" aria-label="Search revenue portfolio" placeholder="Search project, client or code" value={searchText} onChange={event => setSearchText(event.target.value)} /></label><span>{data.scope?.label}</span></div><ProjectRegister data={data} page={page} onPage={setPage} printing={printing} onExplain={onExplain} onReviewConnections={() => navigate('connections')} /><div className="prv-outlook-grid"><Panel title="Monthly revenue outlook" subtitle="Actual revenue and forward forecasts · AED" className="prv-forecast-panel"><RevenueForecastChart rows={data.forecast || []} period={data.period} /></Panel><Breakdown data={data} /></div></>}
        {(section === 'pm' || printing) && <PmPerformance data={data} />}
        {(section === 'risk' || printing) && <RiskReview data={data} onExplain={onExplain} printing={printing} />}
        {(section === 'invoice' || printing) && <InvoiceControl data={data} onExplain={onExplain} printing={printing} recordedInvoices={recordedInvoices} onRefreshWorkbook={onRefreshWorkbook} onReviewConnections={() => navigate('connections')} />}
        {(section === 'connections' || printing) && <PortfolioProjectConnections data={data} page={page} onPage={setPage} printing={printing} />}
        {(section === 'capacity' || printing) && <Capacity data={data} />}
      </div>
    </>}
  </div>;
}
