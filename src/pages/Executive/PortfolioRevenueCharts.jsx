/* eslint-disable react/prop-types */
import { useId, useLayoutEffect, useRef, useState } from 'react';
import { EmptyState } from './ExecutivePrimitives';
import { revenueCompact, revenueDecimal, revenueMoney, revenueMonth, revenueNumber } from './portfolioRevenuePresentation';
import './PortfolioRevenueCharts.css';

const SERIES = [
  { key: 'actual_revenue', label: 'Actual revenue', color: '#2874e8' },
  { key: 'forecast_revenue', label: 'Current forecast', color: '#119a82' },
  { key: 'pm_forecast', label: 'PM forecast', color: '#be7a06' },
];
const observed = (row, key) => row[key] ?? row.known_values?.[key] ?? null;
const partial = (row, key) => row[key] == null && revenueNumber(row.known_values?.[key]) !== null;
const partialLabel = (row, key) => `Known subtotal${row.coverage?.[key] ? ` · ${row.coverage[key].known_rows}/${row.coverage[key].included_rows} rows` : ''}`;
const shortMonth = value => revenueMonth(value).split(' ')[0].replace('Sept', 'Sep');
const compactAmount = value => revenueNumber(value) === null ? '—' : new Intl.NumberFormat('en-GB', { notation: 'compact', maximumFractionDigits: 2 }).format(revenueNumber(value));
function forecastWindow(rows, period) {
  if (rows.length <= 12) return rows;
  const current = rows.findIndex(row => String(row.period).slice(0, 7) >= String(period).slice(0, 7));
  const start = Math.max(0, Math.min((current < 0 ? rows.length - 1 : current) - 3, rows.length - 12));
  return rows.slice(start, start + 12);
}

function segments(rows, key, x, y) {
  const paths = [];
  let current = '';
  rows.forEach((row, index) => {
    const value = revenueNumber(row[key]);
    if (value === null) { if (current) paths.push(current); current = ''; }
    else current += `${current ? ' L' : 'M'}${x(index)},${y(value)}`;
  });
  if (current) paths.push(current);
  return paths;
}

function roundedAxis(values) {
  const lowest = Math.min(0, ...values), highest = Math.max(0, ...values);
  const roughStep = (highest - lowest) / 4 || 1;
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const step = [1, 2, 3, 5, 10].find(value => value >= roughStep / magnitude) * magnitude;
  const minimum = Math.floor(lowest / step) * step;
  const maximum = highest === lowest ? minimum + step * 4 : Math.ceil(highest / step) * step;
  const ticks = Array.from({ length: Math.round((maximum - minimum) / step) + 1 }, (_, index) => minimum + step * index);
  return { minimum, maximum, ticks };
}

export function RevenueForecastChart({ rows: allRows = [], period = '', compact = false }) {
  const id = useId();
  const frameRef = useRef(null);
  const [frameWidth, setFrameWidth] = useState(640);
  const [frameHeight, setFrameHeight] = useState(145);
  const selectedRows = forecastWindow(allRows, period);
  const rows = selectedRows.map(row => ({ ...row, ...Object.fromEntries(SERIES.map(series => [series.key, observed(row, series.key)])) }));
  const values = rows.flatMap(row => SERIES.map(series => revenueNumber(row[series.key]))).filter(value => value !== null);
  const hasValues = values.length > 0;
  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!compact || !hasValues || !frame) return undefined;
    const measure = () => {
      const measured = Math.round(frame.getBoundingClientRect().width);
      if (measured > 0) setFrameWidth(previous => previous === measured ? previous : measured);
      const measuredHeight = Math.round(frame.querySelector('svg')?.getBoundingClientRect().height || 0);
      if (measuredHeight > 0) setFrameHeight(previous => previous === measuredHeight ? previous : measuredHeight);
    };
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(frame);
    window.addEventListener('resize', measure);
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure); };
  }, [compact, hasValues]);
  if (!values.length) return <EmptyState title="Monthly revenue series not reported" detail="Actuals and forecasts appear when the uploaded workbook supplies comparable monthly figures." />;
  const width = compact ? frameWidth : 740, height = compact ? frameHeight : 245;
  const left = compact ? 43 : 55, right = width - 12, top = 12, bottom = height - (compact ? 35 : 44);
  const { minimum, maximum, ticks } = roundedAxis(values);
  const range = maximum - minimum || 1;
  const y = value => bottom - (value - minimum) / range * (bottom - top);
  const spacing = (right - left) / Math.max(rows.length, 1);
  const x = index => left + spacing * (index + .5);
  const barWidth = Math.min(compact ? 21 : 27, spacing * .42);
  const labelEvery = compact ? 1 : Math.max(1, Math.ceil(rows.length / 10));
  const hasPartial = selectedRows.some(row => SERIES.some(series => partial(row, series.key)));
  const pointTitle = (row, key, label, index) => `${revenueMonth(row.period)} ${label}: AED ${revenueMoney(row[key])}${partial(selectedRows[index], key) ? ` · ${partialLabel(selectedRows[index], key)}` : ''}`;
  return <div ref={frameRef} className={`prv-revenue-visual${compact ? ' prv-revenue-visual--compact' : ''}`}>
    <ul className="prv-chart-legend" aria-label="Monthly revenue series">{SERIES.map((series, index) => {
      const incomplete = selectedRows.some(row => partial(row, series.key));
      return <li key={series.key}><i className={index === 0 ? 'prv-series-bar' : index === 1 ? 'prv-series-line' : 'prv-series-line prv-series-line--dashed'} style={{ '--series-color': series.color }} />{series.label}{incomplete && <span className="prv-chart-partial" title="Matched source-row subtotal; coverage is incomplete" aria-label="Partial series: known source-row subtotals">*</span>}</li>;
    })}</ul>
    <svg className="prv-revenue-chart" data-testid="revenue-forecast-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby={`${id}-title ${id}-description`}>
      <title id={`${id}-title`}>Monthly actual revenue, current forecast and PM forecast in AED</title><desc id={`${id}-description`}>Only recorded values are plotted. Identified partial series show matched source-row subtotals. Missing observations create gaps. {compact ? 'Detailed monthly figures and coverage are available in the revenue details.' : 'Exact values and coverage are available in the monthly figures table.'}</desc>
      {ticks.map((value, index) => <g key={index}><line className="prv-chart-grid" x1={left} x2={right} y1={y(value)} y2={y(value)} /><text className="prv-chart-tick" x={left - 8} y={y(value) + 4} textAnchor="end">{revenueCompact(value)}</text></g>)}
      {rows.map((row, index) => { const value = revenueNumber(row.actual_revenue); return value === null ? null : <rect data-series="actual_revenue" data-period={row.period} key={row.period} fill={SERIES[0].color} opacity=".86" x={x(index) - barWidth / 2} y={Math.min(y(value), y(0))} width={barWidth} height={Math.max(value === 0 ? 1 : 0, Math.abs(y(value) - y(0)))} rx="2"><title>{pointTitle(row, 'actual_revenue', 'actual revenue', index)}</title></rect>; })}
      {SERIES.slice(1).map(series => <g key={series.key}>{segments(rows, series.key, x, y).map((path, index) => <path key={index} data-series={series.key} d={path} stroke={series.color} strokeWidth={compact ? '2' : '2.4'} strokeDasharray={series.key === 'pm_forecast' ? '5 4' : undefined} fill="none" />)}{rows.map((row, index) => { const value = revenueNumber(row[series.key]); return value === null ? null : <circle data-series={series.key} data-period={row.period} key={row.period} cx={x(index)} cy={y(value)} r={compact ? '2.6' : '3.2'} fill={series.color} stroke="var(--cc-surface, #fff)" strokeWidth="1"><title>{pointTitle(row, series.key, series.label, index)}</title></circle>; })}</g>)}
      {rows.map((row, index) => {
        const current = Boolean(period) && String(row.period).slice(0, 7) === String(period).slice(0, 7);
        return index % labelEvery === 0 || index === rows.length - 1 || current ? <text key={row.period} className={`prv-chart-tick${current ? ' prv-chart-tick--current' : ''}`} data-current-period={current ? 'true' : undefined} x={x(index)} y={height - (compact ? 20 : 22)} textAnchor="middle">{compact ? <><tspan x={x(index)}>{shortMonth(row.period)}</tspan><tspan className="prv-chart-year" x={x(index)} dy="11">{String(row.period).slice(0, 4)}</tspan></> : revenueMonth(row.period)}</text> : null;
      })}
    </svg>
    {(hasPartial || !compact) && <p className="prv-chart-coverage">{compact ? '* Known subtotals; source coverage is incomplete.' : `Chart: ${revenueMonth(rows[0]?.period)}–${revenueMonth(rows.at(-1)?.period)}. Partial series show known subtotals, with coverage in the table.`}</p>}
    {!compact && <details className="prv-chart-values"><summary>All {allRows.length} monthly figures</summary><div className="prv-table-wrap" tabIndex={0} role="region" aria-label="Monthly revenue figures"><table><caption className="cc-sr-only">Monthly revenue in AED with partial subtotal coverage</caption><thead><tr><th scope="col">Period</th>{SERIES.map(series => <th key={series.key} scope="col">{series.label}</th>)}</tr></thead><tbody>{allRows.map(row => <tr key={row.period}><th scope="row">{revenueMonth(row.period)}</th>{SERIES.map(series => <td key={series.key} className="prv-money">{revenueMoney(observed(row, series.key))}{partial(row, series.key) && <small>{partialLabel(row, series.key)}</small>}</td>)}</tr>)}</tbody></table></div></details>}
  </div>;
}

export function RevenueBreakdownBars({ rows = [], field, label, compact = false, maxRows }) {
  const amount = row => row[field] ?? row.coverage?.[field]?.known_value;
  const known = rows.filter(row => revenueNumber(amount(row)) !== null);
  const maximum = Math.max(0, ...known.map(row => Math.abs(revenueNumber(amount(row))))) || 1;
  const signed = known.some(row => revenueNumber(amount(row)) < 0);
  const visible = rows.slice(0, maxRows ?? (compact ? 6 : 8));
  return rows.length ? <div className={`prv-breakdown-bars${compact ? ' prv-breakdown-bars--compact' : ''}`} aria-label={`${label} in AED`}>{visible.map(row => {
    const value = revenueNumber(amount(row));
    const width = value === null ? 0 : Math.abs(value) / maximum * (signed ? 50 : 100);
    const incomplete = ['partial', 'incomplete'].includes(row.coverage?.[field]?.status);
    const coverage = incomplete ? `${row[field] == null && value !== null ? 'Known subtotal' : 'Partial coverage'} · ${row.coverage[field].missing_count} missing values` : '';
    const track = <span className={`prv-bar-track${signed ? ' prv-bar-track--signed' : ''}`} aria-hidden="true">{value !== null && <i style={{ width: `${width}%`, marginLeft: `${signed ? value < 0 ? 50 - width : 50 : 0}%` }} className={value < 0 ? 'prv-negative' : ''} />}</span>;
    const figure = <strong title={value === null ? 'Not reported' : `AED ${revenueMoney(amount(row))}${coverage ? ` · ${coverage}` : ''}`}>{compactAmount(amount(row))}{compact && incomplete && <span className="prv-chart-partial" aria-label={coverage}>*</span>}</strong>;
    return compact ? <div className="prv-breakdown-row prv-breakdown-row--compact" key={row.label}><span className="prv-breakdown-label" title={row.label}>{row.label || 'Not assigned'}</span>{track}{figure}</div> : <div className="prv-breakdown-row" key={row.label}><div><span title={row.label}>{row.label || 'Not assigned'}</span>{figure}</div>{track}{incomplete && <small>{coverage}</small>}</div>;
  })}</div> : <EmptyState title="No breakdown rows in this scope" />;
}

export function CapacityChart({ rows: allRows = [], period = '' }) {
  const upcoming = allRows.filter(row => String(row.period).slice(0, 7) >= period);
  const rows = (upcoming.length ? upcoming : allRows.slice(-12)).slice(0, 12);
  const series = [{ key: 'demand_manhours', label: 'Demand', color: '#2874e8' }, { key: 'adjusted_capacity_manhours', label: 'Adjusted capacity', color: '#119a82' }];
  const maximum = Math.max(0, ...rows.flatMap(row => series.map(item => revenueNumber(row[item.key]) || 0))) || 1;
  if (!rows.some(row => series.some(item => revenueNumber(row[item.key]) !== null))) return null;
  return <div className="prv-capacity-chart" aria-label="Recorded demand and adjusted capacity in manhours"><ul className="prv-chart-legend">{series.map(item => <li key={item.key}><i style={{ background: item.color }} />{item.label}</li>)}</ul>{rows.slice(0, 12).map(row => <div className="prv-capacity-period" key={row.period}><span>{revenueMonth(row.period)}</span><div>{series.map(item => <span className="prv-capacity-track" key={item.key} title={`${item.label}: ${revenueDecimal(row[item.key])} manhours`}>{revenueNumber(row[item.key]) !== null && <i style={{ width: `${Math.max(0, revenueNumber(row[item.key])) / maximum * 100}%`, background: item.color }} />}</span>)}</div><strong>{revenueCompact(row.gap_manhours)}</strong></div>)}</div>;
}
