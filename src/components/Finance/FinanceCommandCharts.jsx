import { useEffect, useId, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { ArrowPathIcon, ChartBarIcon, ChartPieIcon, ExclamationTriangleIcon, InformationCircleIcon, LockClosedIcon } from '@heroicons/react/24/outline';
import {
  FINANCE_TREND_SERIES, financeChartCurrency, financeChartMoney, financeLineSegments,
  prepareCashTrend, prepareReceivablesAgeing,
} from './financeCommandChartPresentation';
import './FinanceCommandCharts.css';

const shortNumber = value => new Intl.NumberFormat('en-GB', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
const percent = value => value === null ? '—' : value > 0 && value < 0.1 ? '<0.1%' : `${new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1 }).format(value)}%`;
const monthDate = month => new Date(`${month}-01T12:00:00`);
const monthLabel = month => monthDate(month).toLocaleDateString('en-GB', { month: 'short' });
const fullMonth = month => monthDate(month).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

function useChartWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(520);
  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    const measure = () => setWidth(Math.max(280, Math.round(element.getBoundingClientRect().width)));
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

const ChartState = ({ state, kind }) => {
  const status = state.status;
  const Icon = status === 'loading' ? ArrowPathIcon : status === 'restricted' ? LockClosedIcon : ['error', 'incomplete'].includes(status) ? ExclamationTriangleIcon : InformationCircleIcon;
  const title = status === 'loading' ? 'Loading chart…' : status === 'restricted' ? 'Access restricted'
    : status === 'error' ? `${kind} could not be loaded` : status === 'incomplete' ? `${kind} data is incomplete`
      : status === 'empty' ? 'No open receivables' : `${kind} data unavailable`;
  const detail = state.reason || (status === 'loading' ? 'Retrieving recorded values.' : status === 'restricted' ? 'You do not have access to this financial source.'
    : status === 'error' ? 'Refresh the dashboard to try again.' : kind === 'Trend' ? 'Monthly cash and working capital records are not connected.' : 'Complete balances are needed to show this chart.');
  return <div className="finance-command-charts-state" data-state={status} role={status === 'loading' ? 'status' : status === 'error' ? 'alert' : undefined}>
    <span className="finance-command-charts-state-icon"><Icon className={status === 'loading' ? 'finance-command-charts-spinner' : undefined} aria-hidden="true" /></span>
    <strong>{title}</strong><p>{detail}</p>
  </div>;
};
ChartState.propTypes = { state: PropTypes.object.isRequired, kind: PropTypes.string.isRequired };

const ChartHeader = ({ title, currency, icon: Icon }) => <header className="finance-command-charts-header">
  <h2><Icon aria-hidden="true" />{title}</h2><span>{financeChartCurrency(currency)}</span>
</header>;
ChartHeader.propTypes = { title: PropTypes.string.isRequired, currency: PropTypes.string, icon: PropTypes.elementType.isRequired };

const TrendLegend = () => <ul className="finance-command-charts-legend" aria-label="Trend series">{FINANCE_TREND_SERIES.map(series => <li key={series.key}>
  <span data-series={series.kind} aria-hidden="true" />{series.label}
</li>)}</ul>;

function TrendPlot({ state, currency, width, titleId, descriptionId }) {
  const height = 120;
  const left = 44;
  const right = 12;
  const top = 10;
  const bottom = 23;
  const values = state.rows.flatMap(row => FINANCE_TREND_SERIES.map(series => row[series.key]).filter(value => value !== null));
  const lower = Math.min(0, ...values);
  const upper = Math.max(0, ...values);
  const rawStep = (upper - lower || 1) / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const step = [1, 2, 5, 10].find(value => value * magnitude >= rawStep) * magnitude;
  const minimum = Math.floor(lower / step) * step;
  const maximum = upper === lower ? minimum + step * 4 : Math.ceil(upper / step) * step;
  const plotHeight = height - top - bottom;
  const slot = (width - left - right) / state.rows.length;
  const x = index => left + slot * (index + 0.5);
  const y = value => top + (maximum - value) / (maximum - minimum) * plotHeight;
  const ticks = Array.from({ length: Math.round((maximum - minimum) / step) + 1 }, (_, index) => minimum + index * step);
  const baseline = y(0);
  return <svg className="finance-command-charts-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby={`${titleId} ${descriptionId}`} data-testid="finance-cash-trend-svg">
    <title id={titleId}>{`Cash and working capital trend in ${financeChartCurrency(currency)}`}</title>
    <desc id={descriptionId}>Monthly recorded values from {fullMonth(state.periodStart)} to {fullMonth(state.periodEnd)}. Missing values leave gaps. Exact values are available in the chart data table.</desc>
    {ticks.map((value, index) => <g key={index} className="finance-command-charts-grid"><line x1={left} x2={width - right} y1={y(value)} y2={y(value)} /><text x={left - 6} y={y(value) + 3} textAnchor="end">{shortNumber(value)}</text></g>)}
    {state.rows.map((row, index) => row.cash_actual === null ? null : <rect key={row.month} className="finance-command-charts-cash-bar" x={x(index) - Math.min(18, slot * 0.42) / 2} y={Math.min(baseline, y(row.cash_actual))}
      width={Math.min(18, slot * 0.42)} height={Math.abs(baseline - y(row.cash_actual))} rx="1.5" data-month={row.month} data-value={row.cash_actual}>
      <title>{`${fullMonth(row.month)}: cash actual ${financeChartMoney(row.cash_actual, currency)}`}</title>
    </rect>)}
    {FINANCE_TREND_SERIES.filter(series => series.kind !== 'bar').map(series => <g key={series.key} className="finance-command-charts-line-series" data-series={series.kind}>
      {financeLineSegments(state.rows, series.key).map((segment, index) => <g key={index}>
        {segment.length > 1 && <polyline points={segment.map(point => `${x(point.index)},${y(point.value)}`).join(' ')} />}
        {segment.map(point => <circle key={point.index} cx={x(point.index)} cy={y(point.value)} r="2.2"><title>{`${fullMonth(state.rows[point.index].month)}: ${series.label} ${financeChartMoney(point.value, currency)}`}</title></circle>)}
      </g>)}
    </g>)}
    {state.rows.map((row, index) => <text className="finance-command-charts-axis-label" key={row.month} x={x(index)} y={height - 8} textAnchor="middle">{monthLabel(row.month)}</text>)}
  </svg>;
}
TrendPlot.propTypes = { state: PropTypes.object.isRequired, currency: PropTypes.string, width: PropTypes.number.isRequired, titleId: PropTypes.string.isRequired, descriptionId: PropTypes.string.isRequired };

export function CashWorkingCapitalTrend({ trend, currency }) {
  const state = prepareCashTrend(trend);
  const [container, width] = useChartWidth();
  const uniqueId = useId();
  return <section className="finance-command-charts finance-command-charts-trend" aria-label="Cash and working capital trend" data-testid="finance-cash-working-capital-trend">
    <ChartHeader title="Cash & working capital trend" currency={currency} icon={ChartBarIcon} />
    <div className="finance-command-charts-plot" ref={container}>{state.status === 'available'
      ? <TrendPlot state={state} currency={currency} width={width} titleId={`${uniqueId}-title`} descriptionId={`${uniqueId}-description`} />
      : <ChartState state={state} kind="Trend" />}</div>
    <TrendLegend />
    {state.status === 'available' && <div className="finance-command-charts-footer"><p>12 months to {fullMonth(state.periodEnd)}{state.hasGaps ? ' · Gaps are not recorded' : ''}</p>
      <details className="finance-command-charts-data"><summary>View chart data</summary><div className="finance-command-charts-table-wrap" role="region" aria-label="Cash and working capital data" tabIndex={0}>
        <table><caption>Monthly values in {financeChartCurrency(currency)}</caption><thead><tr><th scope="col">Month</th>{FINANCE_TREND_SERIES.map(series => <th scope="col" key={series.key}>{series.label}</th>)}</tr></thead>
          <tbody>{state.rows.map(row => <tr key={row.month}><th scope="row">{fullMonth(row.month)}</th>{FINANCE_TREND_SERIES.map(series => <td key={series.key}>{financeChartMoney(row[series.key], currency)}</td>)}</tr>)}</tbody></table>
      </div></details></div>}
  </section>;
}
CashWorkingCapitalTrend.propTypes = { trend: PropTypes.object, currency: PropTypes.string };

function AgeingPlot({ state, width, titleId, descriptionId }) {
  const height = 136;
  const left = state.unknownDueDate ? 108 : 84;
  const right = 104;
  const trackWidth = Math.max(30, width - left - right);
  const rowHeight = 20;
  const firstRow = 17;
  const amountLabel = amount => `${state.currency} ${new Intl.NumberFormat('en-GB', { notation: 'compact', maximumFractionDigits: 2 }).format(amount)}`;
  return <svg className="finance-command-charts-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby={`${titleId} ${descriptionId}`} data-testid="finance-receivables-ageing-svg">
    <title id={titleId}>{`Receivables ageing in ${state.currency}`}</title>
    <desc id={descriptionId}>{state.outstanding === 0 ? 'Outstanding is zero, so percentage shares do not apply.' : `Each bar shows its share of the recorded outstanding balance of ${financeChartMoney(state.outstanding, state.currency)}.`} Unknown due dates are kept separate. Exact amounts and invoice counts are available in the chart data table.</desc>
    {state.rows.map((row, index) => {
      const y = firstRow + index * rowHeight;
      const barWidth = row.share === null ? 0 : row.share / 100 * trackWidth;
      return <g key={row.id} className="finance-command-charts-age-bucket" data-bucket={row.id}>
        <text className="finance-command-charts-age-label" x="11" y={y + 3}>{row.label}</text>
        <rect className="finance-command-charts-age-track" x={left} y={y - 4} width={trackWidth} height="8" rx="4" aria-hidden="true" />
        <rect className="finance-command-charts-age-value" x={left} y={y - 4} width={barWidth} height="8" rx="4" data-testid={`finance-ageing-bar-${row.id}`} data-amount={row.amount} data-share={row.share ?? undefined}>
          <title>{`${row.label}: ${financeChartMoney(row.amount, state.currency)}; ${row.share === null ? 'percentage not applicable' : `${percent(row.share)} of outstanding`}${row.count === null ? '' : `; ${row.count} invoices`}`}</title>
        </rect>
        <text className="finance-command-charts-age-amount" x={width - 11} y={y + 3} textAnchor="end"><title>{financeChartMoney(row.amount, state.currency)}</title>{amountLabel(row.amount)}</text>
      </g>;
    })}
  </svg>;
}
AgeingPlot.propTypes = { state: PropTypes.object.isRequired, width: PropTypes.number.isRequired, titleId: PropTypes.string.isRequired, descriptionId: PropTypes.string.isRequired };

export function ReceivablesAgeing({ source, currency }) {
  const state = prepareReceivablesAgeing(source, currency);
  const [container, width] = useChartWidth();
  const uniqueId = useId();
  return <section className="finance-command-charts finance-command-charts-ageing" aria-label="Receivables ageing" data-testid="finance-receivables-ageing">
    <ChartHeader title="Receivables ageing" currency={currency} icon={ChartPieIcon} />
    <div className="finance-command-charts-plot" ref={container}>{state.status === 'available'
      ? <AgeingPlot state={state} width={width} titleId={`${uniqueId}-title`} descriptionId={`${uniqueId}-description`} />
      : <ChartState state={state} kind="Ageing" />}</div>
    {state.status === 'available' && <div className="finance-command-charts-footer"><p>{state.outstanding === 0 ? 'Outstanding is zero; shares do not apply.' : `Share of ${financeChartMoney(state.outstanding, state.currency)} outstanding`}</p>
      <details className="finance-command-charts-data"><summary>View chart data</summary><div className="finance-command-charts-table-wrap" role="region" aria-label="Receivables ageing data" tabIndex={0}>
        <table><caption>Recorded receivables in {state.currency}</caption><thead><tr><th scope="col">Ageing bucket</th><th scope="col">Outstanding</th><th scope="col">Share</th><th scope="col">Invoices</th></tr></thead>
          <tbody>{state.rows.map(row => <tr key={row.id}><th scope="row">{row.label}</th><td>{financeChartMoney(row.amount, state.currency)}</td><td>{percent(row.share)}</td><td>{row.count ?? '—'}</td></tr>)}</tbody></table>
      </div></details>
      {(state.unknownDueDate || state.partialSource) && <p className="finance-command-charts-coverage">{state.unknownDueDate ? 'Unknown due dates are included in outstanding.' : ''}{state.partialSource ? ' Other currency records are incomplete.' : ''}</p>}
    </div>}
  </section>;
}
ReceivablesAgeing.propTypes = { source: PropTypes.object, currency: PropTypes.string };
