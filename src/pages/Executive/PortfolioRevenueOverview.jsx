/* eslint-disable react/prop-types */
import { useState } from 'react';
import { ArrowRightIcon, ChartBarIcon, ExclamationTriangleIcon, InformationCircleIcon, MagnifyingGlassIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import { RevenueBreakdownBars, RevenueForecastChart } from './PortfolioRevenueCharts';
import { ForecastAttainment, ExposureSummary, InvoicePosition } from './PortfolioRevenueSummaries';
import { revenueDecimal, revenueIdentity, revenueMoney, revenueMonth, revenueNumber, revenuePercent } from './portfolioRevenuePresentation';
import { formatDate } from './executivePresentation';

export function compactRevenue(value, signed = false) {
  const number = revenueNumber(value);
  if (number === null) return '—';
  const absolute = Math.abs(number);
  const amount = absolute >= 1e6 ? `${(absolute / 1e6).toFixed(2)}M` : absolute >= 1e3 ? `${(absolute / 1e3).toFixed(0)}K` : new Intl.NumberFormat('en-GB', { maximumFractionDigits: 2 }).format(absolute);
  return `${number < 0 ? '−' : signed && number > 0 ? '+' : ''}${amount}`;
}

function OverviewPanel({ title, note, children, action, testId, className = '' }) {
  return <section className={`prv-overview-panel ${className}`} data-testid={testId} aria-label={title}><header><h2>{title}</h2>{action || (note && <span>{note}</span>)}</header>{children}</section>;
}

function ShortAmount({ value, signed = false }) {
  return <span className={revenueNumber(value) < 0 ? 'prv-negative-text' : undefined} title={revenueNumber(value) === null ? 'Not reported' : `AED ${revenueMoney(value)}`}>{compactRevenue(value, signed)}</span>;
}

export function RevenueInterventionStrip({ data, onNavigate }) {
  const risk = data.risks || {};
  const count = revenueNumber(risk.total_rows);
  const unknown = count === null || (count === 0 && Number(risk.missing_count) > 0);
  return <div className={`prv-intervention-strip${count === 0 && !unknown ? ' prv-intervention-strip--clear' : ''}`} data-testid="revenue-intervention-strip">
    <ExclamationTriangleIcon aria-hidden="true" /><div className="prv-intervention-copy"><strong>{unknown ? 'Portfolio exposure coverage requires review' : count ? `${revenueDecimal(count)} portfolio interventions require attention` : 'No recorded portfolio interventions'}</strong><span>{Number(risk.missing_count) > 0 ? 'Reported exposures · Source coverage is partial' : 'POC risk, liquidated damages and prolongation exposure'}</span></div>
    <div className="prv-intervention-chips">{[['poc', 'POC risk'], ['ld', 'LD'], ['prolongation', 'Prolongation']].map(([key, label]) => { const metric = risk.totals?.[key]; return <span key={key} title={metric?.value == null && metric?.known_value != null ? 'Known subtotal; full total unavailable' : undefined}>{label} <b>{compactRevenue(metric?.value ?? metric?.known_value)}</b>{metric?.value == null && metric?.known_value != null ? '*' : ''}</span>; })}</div>
    <button type="button" onClick={() => onNavigate('risk')}>Review interventions<ArrowRightIcon aria-hidden="true" /></button>
  </div>;
}

function ManagementWatchlist({ data, onNavigate, onExplain, searchText, onSearch, businessUnit, businessUnits, onBusinessUnit }) {
  const [exception, setException] = useState('all');
  const exposure = new Map();
  const riskTypes = new Map();
  for (const row of data.risks?.rows || []) {
    const key = `${row.project_code}/${row.subproject_code}`;
    exposure.set(key, (exposure.get(key) || 0) + (revenueNumber(row.amount) || 0));
    const types = riskTypes.get(key) || []; types.push(row.type); riskTypes.set(key, types);
  }
  const flags = row => [...new Set([...(riskTypes.get(`${row.project_code}/${row.subproject_code}`) || []), ...(revenueNumber(row.variance) < 0 ? ['forecast'] : []), ...(revenueNumber(row.delay_days) > 0 ? ['delay'] : [])])];
  const labels = { poc: 'POC risk', ld: 'LD exposure', prolongation: 'Prolongation', forecast: 'Forecast gap', delay: 'Delivery delay' };
  const rows = [...(data.projects?.rows || [])].filter(row => exception === 'all' || flags(row).includes(exception)).sort((a, b) => (exposure.get(`${b.project_code}/${b.subproject_code}`) || 0) - (exposure.get(`${a.project_code}/${a.subproject_code}`) || 0) || (revenueNumber(a.variance) ?? Infinity) - (revenueNumber(b.variance) ?? Infinity)).slice(0, 5);
  const openProject = row => onExplain?.({ id: `watch-${row.id}`, label: row.title || revenueIdentity(row), status: 'available', source: 'Uploaded portfolio workbook', description: `${revenueIdentity(row)} · ${row.client || 'Client not reported'}. Actual revenue AED ${revenueMoney(row.actual_revenue)}; current forecast AED ${revenueMoney(row.forecast_revenue)}; PM forecast AED ${revenueMoney(row.pm_forecast)}. POC ${revenuePercent(row.poc_pct)}; EDDR ${revenuePercent(row.eddr_pct)}. Forecast margin ${revenuePercent(row.forecast_margin_pct)}. Forecast finish ${formatDate(row.forecast_finish)}.`, reason: 'Select Projects & Delivery for the complete source register and detailed delivery observations.' });
  return <OverviewPanel title="Management watchlist" testId="revenue-watchlist" className="prv-watchlist-panel" action={<div className="prv-watchlist-actions"><label className="prv-overview-search"><MagnifyingGlassIcon aria-hidden="true" /><input type="search" aria-label="Search revenue portfolio" placeholder="Search projects" value={searchText} onChange={event => onSearch(event.target.value)} /></label><select aria-label="Watchlist business unit" value={businessUnit} onChange={event => onBusinessUnit(event.target.value)}><option value="">All BUs</option>{businessUnits.map(value => <option key={value} value={value}>{value}</option>)}</select><select aria-label="Watchlist exception" value={exception} onChange={event => setException(event.target.value)}><option value="all">All exceptions</option>{Object.entries(labels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><button type="button" onClick={() => onNavigate('projects')}>View all<ArrowRightIcon /></button></div>}>
    <div className="prv-table-wrap" tabIndex={0} role="region" aria-label="Management watchlist"><table data-table-typography="preserve"><caption className="cc-sr-only">Project watchlist ranked by recorded exposure, then forecast variance. Monetary figures in AED. Progress bars show financial POC; EDDR is separately labelled.</caption><thead><tr>{['Project / client', 'PM / BU', 'Actual revenue', 'Current forecast', 'Variance', 'Backlog', 'POC / EDDR', 'Forecast margin', 'Forecast finish', 'Exception', 'Action'].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>{rows.map((row, index) => { const rowFlags = flags(row), primary = rowFlags[0]; return <tr key={row.id || index}><th scope="row"><span className="prv-watch-project" title={`${row.title || revenueIdentity(row)} · ${row.client || 'Client not reported'} · ${revenueIdentity(row)}`}>{row.title || revenueIdentity(row)}</span></th><td>{row.pm || '—'} / {row.business_unit || '—'}</td>{['actual_revenue', 'forecast_revenue', 'variance', 'backlog'].map(field => <td key={field}><ShortAmount value={row[field]} signed={field === 'variance'} /></td>)}<td><div className="prv-watch-progress" title={`Financial POC ${revenuePercent(row.poc_pct)}; engineering EDDR ${revenuePercent(row.eddr_pct)}`}><i aria-hidden="true">{revenueNumber(row.poc_pct) !== null && <b style={{ width: `${Math.max(0, Math.min(100, Number(row.poc_pct)))}%` }} />}</i><span aria-label={`POC ${revenuePercent(row.poc_pct)}; EDDR ${revenuePercent(row.eddr_pct)}`}>{revenuePercent(row.poc_pct)} / {revenuePercent(row.eddr_pct)}</span></div></td><td>{revenuePercent(row.forecast_margin_pct)}</td><td>{row.forecast_finish ? formatDate(row.forecast_finish) : '—'}</td><td><span className={`prv-risk-tag${primary === 'poc' ? ' prv-risk-tag--poc' : ''}`} title={rowFlags.map(flag => labels[flag]).join(', ') || 'No recorded exception in the returned source facts'}>{labels[primary] || 'No recorded flag'}</span></td><td><button type="button" className="prv-watch-open" aria-label={`Open ${row.title || revenueIdentity(row)}`} onClick={() => openProject(row)}>Open</button></td></tr>; })}</tbody></table></div>
    {!rows.length && <p className="prv-overview-empty">No project rows are reported in this scope.</p>}
    {data.projects?.truncated && <p className="prv-overview-footnote">Watchlist uses {data.projects.returned_rows || data.projects.rows?.length} returned rows; totals cover all matching projects.</p>}
  </OverviewPanel>;
}

export default function PortfolioRevenueOverview({ data, recordedInvoices, onNavigate, onExplain, searchText, onSearch, businessUnit, businessUnits, onBusinessUnit }) {
  const businessBreakdown = [...(data.breakdowns?.business_unit || [])].sort((a, b) => (revenueNumber(b.actual_revenue ?? b.coverage?.actual_revenue?.known_value) ?? -Infinity) - (revenueNumber(a.actual_revenue ?? a.coverage?.actual_revenue?.known_value) ?? -Infinity));
  const comparedManagers = (data.pm_performance?.rows || []).filter(row => revenueNumber(row.actual_revenue) !== null && revenueNumber(row.pm_forecast) !== null);
  const belowForecast = comparedManagers.filter(row => Number(row.actual_revenue) < Number(row.pm_forecast)).length;
  const capacityMonth = (data.capacity?.rows || []).find(row => String(row.period).slice(0, 7) === data.period);
  const backlogMissing = Number(data.kpis?.find(metric => metric.id === 'total_backlog')?.missing_count) || 0;
  const missingValues = (data.kpis || []).reduce((sum, metric) => sum + (Number(metric.missing_count) || 0), 0);
  return <div className="prv-overview" data-testid="revenue-overview">
    <RevenueInterventionStrip data={data} onNavigate={onNavigate} />
    <div className="prv-overview-top"><OverviewPanel title="Revenue outlook" action={<button type="button" onClick={() => onNavigate('projects')}>Open forecast<ArrowRightIcon aria-hidden="true" /></button>} testId="revenue-overview-outlook" className="prv-overview-outlook"><RevenueForecastChart rows={data.forecast || []} period={data.period} compact /></OverviewPanel><ForecastAttainment data={data} onNavigate={onNavigate} /></div>
    <div className="prv-overview-middle"><OverviewPanel title="Revenue by business unit" note="Actual revenue · AED" testId="revenue-overview-bu"><RevenueBreakdownBars rows={businessBreakdown} field="actual_revenue" label="Actual revenue" compact maxRows={6} /></OverviewPanel><ExposureSummary data={data} onNavigate={onNavigate} /><InvoicePosition recordedInvoices={recordedInvoices} onNavigate={onNavigate} /></div>
    <ManagementWatchlist data={data} onNavigate={onNavigate} onExplain={onExplain} searchText={searchText} onSearch={onSearch} businessUnit={businessUnit} businessUnits={businessUnits} onBusinessUnit={onBusinessUnit} />
    <div className="prv-overview-links"><button type="button" onClick={() => onNavigate('pm')}><ChartBarIcon /><span>PM Performance <small>{comparedManagers.length ? `${belowForecast} PM${belowForecast === 1 ? '' : 's'} below forecast` : 'Comparison unavailable'}</small></span><ArrowRightIcon /></button><button type="button" onClick={() => onNavigate('capacity')}><UserGroupIcon /><span>Capacity <small>{revenueNumber(capacityMonth?.gap_manhours) !== null ? `${revenueMonth(capacityMonth.period)} gap ${compactRevenue(capacityMonth.gap_manhours)} manhours` : 'Plan unavailable in this scope'}</small></span><ArrowRightIcon /></button><button type="button" onClick={() => onExplain?.({ id: 'revenue-source-coverage', label: 'Data coverage & reporting basis', status: data.status, source: data.source?.file_name || 'Uploaded portfolio workbook', description: `${data.scope?.label || 'Authorized portfolio scope'}. Reporting cutoff ${formatDate(data.source?.reporting_date)}. ${(data.definitions || []).join(' ')}`, reason: 'Partial values and mixed-period source observations are identified in their respective sections.' })}><InformationCircleIcon /><span>Data coverage <small>{backlogMissing ? `${backlogMissing} backlog values missing` : missingValues ? `${missingValues} missing source values` : 'Headline source values reported'}</small></span><ArrowRightIcon /></button></div>
  </div>;
}
