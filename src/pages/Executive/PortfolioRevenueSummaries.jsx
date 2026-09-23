/* eslint-disable react/prop-types */
import { ArrowRightIcon, InformationCircleIcon } from '@heroicons/react/24/outline';
import { revenueMoney, revenueNumber, revenuePercent, revenueIdentity } from './portfolioRevenuePresentation';
import './PortfolioRevenueSummaries.css';

const compact = value => {
  const amount = revenueNumber(value);
  if (amount === null) return '—';
  const magnitude = Math.abs(amount);
  return `${amount < 0 ? '−' : ''}${magnitude >= 1e6 ? `${(magnitude / 1e6).toFixed(2)}M` : magnitude >= 1e3 ? `${(magnitude / 1e3).toFixed(0)}K` : new Intl.NumberFormat('en-GB', { maximumFractionDigits: 2 }).format(magnitude)}`;
};

function SummaryPanel({ title, subtitle, action, children, testId, className = '' }) {
  return <section className={`prv-overview-panel prv-reference-summary ${className}`} aria-label={title} data-testid={testId} data-table-typography="preserve">
    <header><div><h2>{title}</h2><p>{subtitle}</p></div>{action}</header>{children}
  </section>;
}

function OpenSection({ children, section, onNavigate }) {
  return <button type="button" onClick={() => onNavigate(section)}>{children}<ArrowRightIcon aria-hidden="true" /></button>;
}

export function ForecastAttainment({ data, onNavigate }) {
  const rows = [...(data.pm_performance?.rows || [])]
    .filter(row => revenueNumber(row.actual_revenue) !== null || revenueNumber(row.pm_forecast) !== null)
    .sort((a, b) => (revenueNumber(b.actual_revenue) ?? -Infinity) - (revenueNumber(a.actual_revenue) ?? -Infinity)).slice(0, 6);
  return <SummaryPanel title="PM forecast attainment" subtitle="Actual revenue vs PM forecast (AED)" testId="revenue-overview-attainment" className="prv-attainment-panel"
    action={<OpenSection section="pm" onNavigate={onNavigate}>View all project managers</OpenSection>}>
    <div className="prv-summary-table-wrap" tabIndex={0} role="region" aria-label="PM forecast attainment"><table className="prv-attainment-table"><caption className="cc-sr-only">Current-month actual revenue through the reporting cutoff as a percentage of each project manager’s forecast. Bars are capped visually at 100%; reported percentages are uncapped.</caption>
      <thead><tr><th scope="col">Project manager</th><th scope="col">Actual</th><th scope="col">PM forecast</th><th scope="col">Attainment</th></tr></thead>
      <tbody>{rows.map((row, index) => {
        const actual = revenueNumber(row.actual_revenue), forecast = revenueNumber(row.pm_forecast);
        const ratio = actual !== null && forecast !== null && forecast > 0 ? actual / forecast * 100 : null;
        const name = row.kpi?.name ? `${row.kpi.name} (${row.pm || row.label})` : row.label || row.pm || 'Unassigned';
        return <tr key={row.pm || index}><th scope="row"><button type="button" onClick={() => onNavigate('pm')} title={name}>{name}</button></th>
          <td title={`AED ${revenueMoney(row.actual_revenue)}`}>{compact(row.actual_revenue)}</td><td title={`AED ${revenueMoney(row.pm_forecast)}`}>{compact(row.pm_forecast)}</td>
          <td><span className="prv-attainment-meter"><i aria-hidden="true">{ratio !== null && <b className={ratio >= 100 ? 'prv-attainment-met' : 'prv-attainment-progress'} style={{ width: `${Math.min(100, Math.max(0, ratio))}%` }} />}</i><strong>{revenuePercent(ratio)}</strong></span></td></tr>;
      })}</tbody></table></div>
    {!rows.length && <p className="prv-overview-empty">PM forecasts are not reported in this scope.</p>}
  </SummaryPanel>;
}

export function ExposureSummary({ data, onNavigate }) {
  const rows = [...(data.risks?.rows || [])].sort((a, b) => (revenueNumber(b.amount) ?? -Infinity) - (revenueNumber(a.amount) ?? -Infinity)).slice(0, 4);
  return <SummaryPanel title="Exposure requiring action" subtitle="Top items by value · AED" testId="revenue-overview-risks" className="prv-exposure-summary"
    action={<OpenSection section="risk" onNavigate={onNavigate}>View all {data.risks?.total_rows ?? ''}</OpenSection>}>
    <div className="prv-summary-table-wrap" tabIndex={0} role="region" aria-label="Exposure requiring action"><table className="prv-exposure-table"><caption className="cc-sr-only">Largest recorded contract exposures with source project manager and exact AED amounts</caption>
      <thead><tr><th scope="col">Project</th><th scope="col">Type</th><th scope="col">Owner</th><th scope="col">Amount</th></tr></thead>
      <tbody>{rows.map((row, index) => <tr key={`${row.id}-${row.type}-${index}`}><th scope="row"><button type="button" title={row.title || revenueIdentity(row)} onClick={() => onNavigate('risk')}>{row.title || revenueIdentity(row)}</button></th>
        <td><span className={`prv-risk-tag prv-risk-tag--${row.type}`}>{({ poc: 'POC overclaim', ld: 'LD exposure', prolongation: 'Prolongation' })[row.type] || row.label}</span></td><td>{row.pm || '—'}</td><td>{revenueMoney(row.amount)}</td></tr>)}</tbody></table></div>
    {!rows.length && <p className="prv-overview-empty">{data.risks?.missing_count ? 'Exposure coverage is incomplete.' : 'No recorded exposures in this scope.'}</p>}
  </SummaryPanel>;
}

export function InvoicePosition({ data, onNavigate }) {
  const source = data.invoicing || {};
  const mixed = source.comparison_period_status === 'mixed' || source.comparison_periods?.length > 1;
  return <SummaryPanel title="Invoice position" subtitle="Workbook invoicing and revenue comparison" testId="revenue-overview-invoice" className="prv-invoice-summary"
    action={<OpenSection section="invoice" onNavigate={onNavigate}>Open invoice control</OpenSection>}>
    <div className="prv-invoice-reference-stats">{[['invoiced_aed', 'Invoiced'], ['balance_aed', 'Balance to invoice'], ['variance_aed', mixed ? 'Mixed-period gap' : 'Revenue / invoice gap']].map(([key, title]) => {
      const metric = source.totals?.[key];
      const partial = metric?.value == null && metric?.known_value != null;
      const value = metric?.value ?? metric?.known_value;
      const label = partial && key === 'invoiced_aed' ? 'Known invoiced' : partial && key === 'balance_aed' ? 'Known balance to invoice' : title;
      const note = partial ? metric.known_value_label || 'Known subtotal; complete total is unavailable' : metric?.missing_count ? 'Partial source coverage' : 'Recorded source total';
      return <div key={key}><span>{label}</span><strong className={revenueNumber(value) < 0 ? 'prv-negative-text' : undefined} title={`${note} · AED ${revenueMoney(value)}`} aria-label={`${label}: AED ${revenueMoney(value)}. ${note}`}><small>AED</small> {compact(value)}</strong></div>;
    })}</div>
    <p className="prv-invoice-reference-note"><InformationCircleIcon aria-hidden="true" />{mixed ? 'Comparison dates differ; shown gap is a mixed-period subtotal.' : source.comparison_period_status === 'unknown' ? 'Some comparison dates are unknown; totals remain withheld.' : 'Source inclusion and comparison dates apply.'}</p>
  </SummaryPanel>;
}
