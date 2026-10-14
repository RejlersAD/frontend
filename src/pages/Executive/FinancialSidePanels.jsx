/* eslint-disable react/prop-types */
import React from 'react';
import { InformationCircleIcon } from '@heroicons/react/24/outline';
import { EmptyState, RouteLink, Status } from './ExecutivePrimitives';
import { formatNumber } from './executivePresentation';
import { financialMetric, FinancialMetricValue, unavailableFinancialMetric } from './financialPresentation';

const REPORTED = new Set(['available', 'partial']);
const CASH_METRICS = [
  { id: 'cash_position', label: 'Cash', unit: 'currency', reason: 'Verified bank and cash balances are not connected.' },
  { id: 'receivables', label: 'Receivables', unit: 'currency', reason: 'Outstanding customer invoice balances are not available.' },
  { id: 'receivables_over60', label: 'Over 60 days', unit: 'currency', reason: 'Outstanding balances more than 60 days past their due date are not available.' },
  { id: 'unbilled_wip', label: 'Unbilled WIP', unit: 'currency', reason: 'An approved unbilled work-in-progress balance is not connected.' },
  { id: 'dso', label: 'DSO', unit: 'days', reason: 'Credit sales and receivables for a common reporting period are required.' },
];
const CONTROLS = [
  { id: 'month_close', label: 'Month close', reason: 'A governed financial close checklist and reporting period are not connected. Project period locks do not establish a financial close.' },
  { id: 'forecast_submissions', label: 'Forecast submissions', reason: 'The expected submissions, accountable owners and submitted forecasts for a common period are not connected.' },
  { id: 'cost_reports_overdue', label: 'Cost reports overdue', reason: 'A complete register of required financial cost reports and their due dates is not connected.' },
  { id: 'unapproved_variations', label: 'Unapproved variations', reason: 'A governed financial variation and approval register is not connected.' },
];
const AGING_IDS = new Set(['current', 'days_1_30', 'days_31_60', 'over60', 'unknown_due_date']);
const numberPresent = value => value != null && value !== '' && Number.isFinite(Number(value));

function ExplainButton({ metric, onExplain }) {
  return <button type="button" className="cc-info-button" onClick={() => onExplain?.(metric)}
    aria-label={`About ${metric.label}`} title={metric.reason || metric.description}>
    <InformationCircleIcon aria-hidden="true" />
  </button>;
}

function cashMetric(financial, item, currency) {
  const exists = [...(financial?.kpis || []), ...(financial?.working_capital?.metrics || [])].some(metric => metric.id === item.id);
  return exists ? financialMetric(financial, item.id, currency)
    : unavailableFinancialMetric(item.id, item.label, item.reason, item.unit);
}

function agingData(financial, currency) {
  const aging = financial?.working_capital?.aging || {};
  const permitted = financial?.status !== 'restricted' && ['available', 'partial', 'incomplete'].includes(aging.status);
  const group = permitted ? aging.by_currency?.find(row => row.currency === currency) : null;
  const buckets = Array.isArray(group?.buckets) ? group.buckets : [];
  const sum = buckets.reduce((total, bucket) => total + (numberPresent(bucket.amount) ? Number(bucket.amount) : 0), 0);
  const valid = group?.status === 'available' && numberPresent(group.total) && Number(group.total) >= 0
    && buckets.length > 0 && buckets.every(bucket => AGING_IDS.has(bucket.id) && numberPresent(bucket.amount) && Number(bucket.amount) >= 0)
    && Math.abs(sum - Number(group.total)) <= Math.max(0.01, Math.abs(Number(group.total)) * 1e-8);
  return { aging, group, buckets, valid, total: valid ? Number(group.total) : null };
}

export function CashWorkingCapital({ report, financial, currency, onExplain }) {
  const finance = report?.departments?.find(section => section.id === 'finance');
  const { aging, group, buckets, valid, total } = agingData(financial, currency);
  const sourceRestricted = financial?.status === 'restricted' || finance?.status === 'restricted';
  const restricted = sourceRestricted || aging.status === 'restricted';
  const incomplete = group?.status === 'incomplete';
  const settled = !restricted && aging.status === 'available' && aging.invoice_count === 0
    && Array.isArray(aging.by_currency) && aging.by_currency.length === 0;
  const metrics = CASH_METRICS.map(item => ({ ...cashMetric(financial, item, currency), displayLabel: item.label,
    ...(sourceRestricted ? { status: 'restricted', value: null } : {}),
  }));
  const info = {
    ...unavailableFinancialMetric('working_capital_coverage', 'Cash & working capital',
      'Outstanding customer invoices are grouped by original currency and days past their due date. Unknown due dates stay separate. Invoice balances do not establish cash, unbilled work or DSO.'),
    status: restricted ? 'restricted' : valid ? 'available' : incomplete ? 'partial' : 'unavailable',
    source: 'Customer invoice register', metrics,
  };
  const sourceRoute = !restricted && ['available', 'partial', 'incomplete'].includes(aging.status)
    ? '/finance/outgoing-invoices' : null;

  return <section className="fp-panel fp-cash-panel" aria-labelledby="fp-cash-title" data-testid="financial-cash-working-capital">
    <div className="fp-panel-heading"><h2 id="fp-cash-title">Cash &amp; working capital</h2><ExplainButton metric={info} onExplain={onExplain} /></div>
    <div className="fp-cash-stats">{metrics.map(metric => <button type="button" key={metric.id} className={`fp-cash-stat${metric.id === 'receivables_over60' && REPORTED.has(metric.status) && Number(metric.value) > 0 ? ' fp-cash-stat--overdue' : ''}`}
      data-testid={`financial-cash-metric-${metric.id}`} onClick={() => onExplain?.(metric)}
      aria-label={`About ${metric.displayLabel}`} title={metric.reason || metric.description}>
      <span>{metric.displayLabel}</span><strong><FinancialMetricValue metric={metric} /></strong>
    </button>)}</div>
    <div className="fp-aging-heading"><h3>Receivables aging</h3><span>{currency || 'Currency not recorded'}</span></div>
    {!restricted && valid ? <div className="fp-aging" data-testid="financial-aging">
      <div className="fp-aging-bar" data-testid="financial-aging-bar" role="img"
        aria-label={total > 0 ? `Receivables aging in ${currency}: ${buckets.map(bucket => `${bucket.label} ${formatNumber(bucket.amount)}`).join('; ')}` : `No outstanding receivables in ${currency}`}>
        {total > 0 && buckets.filter(bucket => Number(bucket.amount) > 0).map(bucket => <span key={bucket.id}
          className={`fp-aging-segment fp-aging-${bucket.id}`} style={{ width: `${Number(bucket.amount) / total * 100}%` }}
          title={`${bucket.label}: ${currency} ${formatNumber(bucket.amount)}`} aria-hidden="true">{Number(bucket.amount) / total >= .12 ? formatNumber(bucket.amount, { notation: 'compact', maximumFractionDigits: 1 }) : ''}</span>)}
      </div>
      {total === 0 && <p className="fp-panel-note">No outstanding receivables</p>}
      <div className="fp-aging-legend">{buckets.map(bucket => <div key={bucket.id} data-testid={`financial-aging-bucket-${bucket.id}`}>
        <span><i className={`fp-aging-swatch fp-aging-${bucket.id}`} aria-hidden="true" />{bucket.label}</span>
        <strong>{formatNumber(bucket.amount, { notation: Math.abs(Number(bucket.amount)) >= 1000000 ? 'compact' : 'standard' })}</strong>
      </div>)}</div>
      {Number(group.unknown_due_date_count) > 0 && <p className="fp-panel-note">{formatNumber(group.unknown_due_date_count)} invoices have no due date; their balances remain separate.</p>}
    </div> : settled ? <div className="fp-aging-settled" data-testid="financial-aging-settled"><EmptyState
      title="No outstanding receivables" detail="The accessible invoice register has no outstanding balances to age." />
    </div> : <div className="fp-aging-unavailable" data-testid="financial-aging-unavailable"><EmptyState
      title={restricted ? 'Receivables access required' : incomplete ? 'Aging incomplete' : aging.status === 'error' ? 'Receivables source unavailable' : 'Aging not available'}
      detail={restricted ? 'Customer invoice access is required.' : incomplete
        ? `${formatNumber(group.missing_balance_count)} invoices lack a balance. ${currency} totals and aging are withheld.`
        : `No complete aging breakdown is reported${currency ? ` for ${currency}` : ''}.`} /></div>}
    <div className="fp-panel-footer"><span className="fp-panel-note">Original currency · days past due</span><RouteLink route={sourceRoute}>Open receivables</RouteLink></div>
  </section>;
}

export function ForecastBridge({ financial, onExplain }) {
  const metric = unavailableFinancialMetric('forecast_bridge', 'Forecast bridge',
    'Approved budget, actual results and forecast movements in the same currency and reporting period are not connected. Invoice balances and sales pipeline cannot substitute for a financial forecast.', 'currency');
  if (financial?.status === 'restricted') metric.status = 'restricted';
  return <section className="fp-panel fp-bridge-panel" aria-labelledby="fp-bridge-title" data-testid="financial-forecast-bridge">
    <div className="fp-panel-heading"><h2 id="fp-bridge-title">Forecast bridge</h2><ExplainButton metric={metric} onExplain={onExplain} /></div>
    <div className="fp-bridge-chart fp-chart-unavailable" data-testid="financial-forecast-bridge-unavailable">
      <EmptyState title="Forecast bridge not connected" detail="Approved budget, actual results and forecast movements are required." />
    </div>
    <div className="fp-panel-footer"><span className="fp-panel-note">Budget to latest forecast</span><Status status={metric.status} /></div>
  </section>;
}

export function FinancialControls({ report, financial, currency, onExplain }) {
  const finance = report?.departments?.find(section => section.id === 'finance');
  const restricted = financial?.status === 'restricted' || finance?.status === 'restricted';
  const { aging, group } = agingData(financial, currency);
  const missingBalances = numberPresent(group?.missing_balance_count) ? Number(group.missing_balance_count) : null;
  const unknownDates = numberPresent(group?.unknown_due_date_count) ? Number(group.unknown_due_date_count) : null;
  const issues = restricted ? [] : [
    missingBalances > 0 ? `${formatNumber(missingBalances)} missing invoice balances` : null,
    unknownDates > 0 ? `${formatNumber(unknownDates)} missing due dates` : null,
  ].filter(Boolean);
  const quality = {
    ...unavailableFinancialMetric('financial_data_quality', 'Data quality',
      issues?.length ? `${currency}: ${issues.join('; ')}. These are receivables source issues, not a complete financial data-quality assessment.`
        : 'A complete financial data-quality assessment is not connected. An absence of reported invoice issues does not establish complete financial coverage.'),
    source: issues?.length ? 'Customer invoice register' : 'Financial data-quality assessment required',
    status: restricted ? 'restricted' : issues?.length ? 'partial' : 'unavailable',
  };
  const rows = [...CONTROLS.map(item => ({ ...unavailableFinancialMetric(item.id, item.label, item.reason), status: restricted ? 'restricted' : 'unavailable' })), quality];
  const matching = finance?.metrics?.find(metric => metric.id === 'invoice_match_exceptions');
  const sourceRoute = !restricted && REPORTED.has(matching?.status) ? '/finance/incoming-invoices'
    : !restricted && ['available', 'partial', 'incomplete'].includes(aging.status) ? '/finance/outgoing-invoices' : null;
  const sourceLabel = sourceRoute === '/finance/incoming-invoices' ? 'Open invoice controls' : 'Open receivables';
  const info = { ...unavailableFinancialMetric('financial_controls_coverage', 'Financial controls',
    financial?.controls?.description || 'Financial close, submission and variation workflows are not connected. Operational invoice checks do not establish group financial control completion.'), metrics: rows };

  return <section className="fp-panel fp-controls-panel" aria-labelledby="fp-controls-title" data-testid="financial-controls">
    <div className="fp-panel-heading"><h2 id="fp-controls-title">Financial controls</h2><ExplainButton metric={info} onExplain={onExplain} /></div>
    <table className="fp-controls-table" aria-label="Financial control reporting">
      <thead><tr><th scope="col">Control</th><th scope="col">Status</th></tr></thead>
      <tbody>{rows.map(metric => <tr key={metric.id} data-testid={`financial-control-${metric.id}`}>
        <th scope="row"><button type="button" className="fp-control-name" onClick={() => onExplain?.(metric)}
          aria-label={`About ${metric.label}`} title={metric.reason}>{metric.label}</button></th>
        <td><Status status={metric.id === quality.id && issues?.length ? 'medium' : metric.status}>
          {metric.id === quality.id && issues?.length ? 'Review' : metric.status === 'restricted' ? 'Restricted' : 'Not assessed'}
        </Status></td>
      </tr>)}</tbody>
    </table>
    {issues?.length > 0 && <p className="fp-control-issues" data-testid="financial-control-data-quality-detail">{currency}: {issues.join(' · ')}</p>}
    <div className="fp-panel-footer"><span className="fp-panel-note">Approved reporting sources required</span><RouteLink route={sourceRoute}>{sourceLabel}</RouteLink></div>
  </section>;
}
