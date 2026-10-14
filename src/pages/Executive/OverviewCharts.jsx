import { useEffect, useId, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import './OverviewCharts.css';

const PALETTE = { invoiced: '#2783ff', received: '#94c4ff', outstanding: '#f6b72b', budget: 'var(--eov-chart-budget, #98a3b8)', collection: 'var(--eov-chart-collection, #00a76f)', margin: 'var(--eov-chart-margin, #8b5cf6)' };
const number = value => (typeof value === 'number' || (typeof value === 'string' && value.trim() !== '')) && Number.isFinite(Number(value)) ? Number(value) : null;
const valueType = PropTypes.oneOfType([PropTypes.number, PropTypes.string]);
const amount = (value, currency) => `${currency} ${value.toLocaleString('en-GB', { maximumFractionDigits: 0 })}`;
const millionLabel = value => (value / 1000000).toLocaleString('en-GB', { maximumFractionDigits: 3 });

function monthLabel(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})(?:-\d{2})?/);
  if (!match || Number(match[2]) < 1 || Number(match[2]) > 12) return String(value || '');
  return `${new Date(Number(match[1]), Number(match[2]) - 1, 1).toLocaleString('en-GB', { month: 'short' }).replace('Sept', 'Sep')} ${match[1]}`;
}

function axis(values, fallback = 10000000, intervals = 5) {
  const recorded = values.map(number).filter(value => value !== null);
  const low = Math.min(0, ...recorded);
  const high = Math.max(0, ...recorded);
  const rough = ((high - low) || fallback) / intervals;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].find(value => value * magnitude >= rough) * magnitude;
  const min = Math.floor(low / step) * step;
  const max = high === low ? min + intervals * step : Math.ceil(high / step) * step;
  return { min, max, ticks: Array.from({ length: Math.round((max - min) / step) + 1 }, (_, index) => min + index * step) };
}

function useChartWidth(initial) {
  const ref = useRef(null);
  const [width, setWidth] = useState(initial);
  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    const update = () => setWidth(Math.max(240, Math.round(node.getBoundingClientRect().width)));
    update();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

function linePath(rows, field, x, y) {
  let connected = false;
  return rows.map((row, index) => {
    const value = number(row[field]);
    if (value === null) { connected = false; return ''; }
    const command = connected ? 'L' : 'M';
    connected = true;
    return `${command}${x(index)},${y(value)}`;
  }).join(' ');
}

export function CompanyPerformanceChart({ rows = [], currency = 'AED', mode = 'monthly', basis = 'invoicing' }) {
  const [ref, width] = useChartWidth(790);
  const id = useId().replace(/:/g, '');
  // The overview model supplies monthly or YTD values, including the corresponding rate.
  const records = rows;
  const height = 160;
  const plot = { left: 46, right: width - 46, top: 9, bottom: 119 };
  const moneyAxis = axis(records.flatMap(row => [row.invoiced, row.received, row.outstanding, row.budget]));
  const rateAxis = axis(records.flatMap(row => [row.collection_rate, row.operating_margin]), 100, 4);
  const slots = Math.max(records.length, 12);
  const cell = (plot.right - plot.left) / slots;
  const x = index => plot.left + cell * (index + 0.5);
  const y = value => plot.bottom - (value - moneyAxis.min) / (moneyAxis.max - moneyAxis.min) * (plot.bottom - plot.top);
  const rateY = value => plot.bottom - (value - rateAxis.min) / (rateAxis.max - rateAxis.min) * (plot.bottom - plot.top);
  const barWidth = Math.min(14, cell * 0.23);
  const hasMoneyData = records.some(row => ['invoiced', 'received', 'outstanding', 'budget'].some(key => number(row[key]) !== null));
  const hasBudgetData = records.some(row => number(row.budget) !== null);
  const hasMarginData = records.some(row => number(row.operating_margin) !== null);
  const hasRateData = records.some(row => number(row.collection_rate) !== null) || hasMarginData;
  const hasData = hasMoneyData || hasRateData;
  const moneySeries = [{ field: 'invoiced', label: 'Invoiced' }, { field: 'received', label: 'Collected against invoices' }, { field: 'outstanding', label: 'Outstanding' }];
  const rateSeries = [{ field: 'collection_rate', label: 'Collection rate', color: PALETTE.collection }, ...(hasMarginData ? [{ field: 'operating_margin', label: 'Operating margin', color: PALETTE.margin }] : [])];
  const labelEvery = Math.max(1, Math.ceil(records.length / (width < 600 ? 6 : 12)));

  return <div className="eov-chart eov-chart-company" data-basis={basis} ref={ref}>
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" role="img" aria-labelledby={`${id}-title ${id}-description`}>
      <title id={`${id}-title`}>Company performance: invoicing and collections</title>
      <desc id={`${id}-description`}>{mode === 'ytd' ? 'Year-to-date invoiced amounts, amounts collected against those invoices, outstanding balances and collection rate.' : 'Monthly invoiced amounts, amounts collected against those invoices, outstanding balances and collection rate.'} {hasBudgetData ? 'Approved budget is shown as a dashed line.' : ''} {hasMarginData ? 'Operating margin is shown as a separate percentage line.' : ''} {hasData ? 'Hover over a chart mark to read its recorded value. Missing values leave gaps.' : 'Invoicing data unavailable.'}</desc>
      <defs><linearGradient id={`${id}-invoiced`} x1="0" x2="1"><stop stopColor="#1674ff" /><stop offset="1" stopColor="#3b91ff" /></linearGradient><linearGradient id={`${id}-received`} x1="0" x2="1"><stop stopColor="#94c4ff" /><stop offset="1" stopColor="#c1dcff" /></linearGradient><linearGradient id={`${id}-outstanding`} x1="0" x2="1"><stop stopColor="#f3ac19" /><stop offset="1" stopColor="#ffd46c" /></linearGradient></defs>
      {moneyAxis.ticks.map(tick => <g className="eov-chart-grid" key={tick}><line x1={plot.left} x2={plot.right} y1={y(tick)} y2={y(tick)} />{hasMoneyData && <text x={plot.left - 10} y={y(tick) + 3} textAnchor="end">{millionLabel(tick)}</text>}</g>)}
      {Array.from({ length: slots + 1 }, (_, index) => <line className="eov-chart-grid-line" key={index} x1={plot.left + cell * index} x2={plot.left + cell * index} y1={plot.top} y2={plot.bottom} />)}
      {hasRateData && rateAxis.ticks.map(tick => <text className="eov-chart-axis" key={tick} x={plot.right + 10} y={rateY(tick) + 3}>{tick.toLocaleString('en-GB', { maximumFractionDigits: 1 })}%</text>)}
      <text className="eov-chart-axis-title" transform={`translate(11 ${(plot.top + plot.bottom) / 2}) rotate(-90)`} textAnchor="middle">Invoicing ({currency} millions)</text>
      <text className="eov-chart-axis-title" transform={`translate(${width - 3} ${(plot.top + plot.bottom) / 2}) rotate(-90)`} textAnchor="middle">{hasMarginData ? 'Collection / margin (%)' : 'Collection rate (%)'}</text>
      {records.map((row, index) => <g key={`${row.month}-${index}`}>
        {moneySeries.map(({ field, label }, seriesIndex) => {
          const value = number(row[field]);
          if (value === null) return null;
          return <rect key={field} x={x(index) + (seriesIndex - 1.5) * barWidth} y={Math.min(y(value), y(0))} width={barWidth} height={Math.abs(y(value) - y(0))} fill={`url(#${id}-${field})`}><title>{`${monthLabel(row.month)} · ${label}: ${amount(value, currency)}`}</title></rect>;
        })}
        {index % labelEvery === 0 && <text className="eov-chart-month" x={x(index)} y={138} textAnchor="middle">{monthLabel(row.month)}</text>}
      </g>)}
      {hasBudgetData && <path d={linePath(records, 'budget', x, y)} stroke={PALETTE.budget} strokeWidth="1.7" strokeDasharray="6 4" fill="none" />}
      {rateSeries.map(series => <path key={series.field} d={linePath(records, series.field, x, rateY)} stroke={series.color} strokeWidth="1.8" fill="none" />)}
      {records.map((row, index) => <g key={`points-${row.month}-${index}`}>
        {number(row.budget) !== null && <circle cx={x(index)} cy={y(number(row.budget))} r="2.5" fill={PALETTE.budget}><title>{`${monthLabel(row.month)} · Approved budget: ${amount(number(row.budget), currency)}`}</title></circle>}
        {rateSeries.map(series => number(row[series.field]) !== null && <circle key={series.field} cx={x(index)} cy={rateY(number(row[series.field]))} r="3.3" fill={series.color} stroke="var(--cc-surface, #fff)" strokeWidth="0.8"><title>{`${monthLabel(row.month)} · ${series.label}: ${number(row[series.field]).toLocaleString('en-GB', { maximumFractionDigits: 1 })}%`}</title></circle>)}
      </g>)}
    </svg>
    {!hasData && <div className="eov-chart-empty">Invoicing data unavailable</div>}
    <div className="eov-chart-legend" aria-label="Chart legend">{moneySeries.map(series => <span key={series.field}><i style={{ background: PALETTE[series.field] }} />{series.label}</span>)}<span><i className="eov-chart-key-collection" />Collection rate (%)</span>{hasBudgetData && <span><i className="eov-chart-key-budget" />Approved budget</span>}{hasMarginData && <span><i className="eov-chart-key-margin" />Operating margin</span>}</div>
  </div>;
}

CompanyPerformanceChart.propTypes = { rows: PropTypes.arrayOf(PropTypes.shape({ month: PropTypes.string, invoiced: valueType, received: valueType, outstanding: valueType, collection_rate: valueType, budget: valueType, operating_margin: valueType })), currency: PropTypes.string, mode: PropTypes.string, basis: PropTypes.oneOf(['invoicing']) };

export function RevenueForecastChart({ rows = [], currency = 'AED', basis = 'unavailable' }) {
  const [ref, width] = useChartWidth(290);
  const id = useId().replace(/:/g, '');
  const records = basis === 'unavailable' ? [] : rows;
  const label = basis === 'estimated' ? 'Estimated invoicing' : basis === 'approved' ? 'Approved forecast' : 'Invoicing forecast';
  const emptyLabel = `${label} unavailable`;
  const plot = { left: 21, right: width - 9, top: 8, bottom: 92 };
  const scale = axis(records.map(row => row.value), 8000000, 4);
  const slots = Math.max(records.length, 12);
  const x = index => plot.left + (plot.right - plot.left) * (index + 0.3) / slots;
  const y = value => plot.bottom - (value - scale.min) / (scale.max - scale.min) * (plot.bottom - plot.top);
  const hasData = records.some(row => number(row.value) !== null);
  const labelEvery = Math.max(1, Math.ceil(records.length / 4));
  return <div className="eov-chart eov-chart-forecast" data-basis={basis} ref={ref}>
    <svg viewBox={`0 0 ${width} 118`} preserveAspectRatio="xMidYMid meet" role="img" aria-labelledby={`${id}-title ${id}-description`}>
      <title id={`${id}-title`}>{`${label} in ${currency} millions`}</title><desc id={`${id}-description`}>{hasData ? `${label} by month.${basis === 'estimated' ? ' Dashed line indicates estimated amounts.' : ''} Missing values leave gaps.` : `${emptyLabel}.`}</desc>
      {scale.ticks.map(tick => <g key={tick} className="eov-chart-grid"><line x1={plot.left} x2={plot.right} y1={y(tick)} y2={y(tick)} />{hasData && <text x={plot.left - 8} y={y(tick) + 3} textAnchor="end">{millionLabel(tick)}</text>}</g>)}
      {Array.from({ length: 5 }, (_, index) => <line className="eov-chart-grid-line" key={index} x1={plot.left + (plot.right - plot.left) * index / 4} x2={plot.left + (plot.right - plot.left) * index / 4} y1={plot.top} y2={plot.bottom} />)}
      <path d={linePath(records, 'value', x, y)} fill="none" stroke="var(--eov-chart-forecast, #103bff)" strokeWidth="1.8" strokeDasharray={basis === 'estimated' ? '5 3' : undefined} />
      {records.map((row, index) => <g key={`${row.month}-${index}`}>
        {number(row.value) !== null && <circle cx={x(index)} cy={y(number(row.value))} r="3.3" fill="var(--eov-chart-forecast, #103bff)" stroke="var(--cc-surface, #fff)" strokeWidth="0.8"><title>{`${monthLabel(row.month)} · ${label}: ${amount(number(row.value), currency)}`}</title></circle>}
        {index % labelEvery === 0 && <text className="eov-chart-month" x={x(index)} y="111" textAnchor="middle">{monthLabel(row.month)}</text>}
      </g>)}
    </svg>
    {!hasData && <div className="eov-chart-empty">{emptyLabel}</div>}
    <div className="eov-chart-legend">{basis !== 'unavailable' && <span><i className={`eov-chart-key-line${basis === 'estimated' ? ' eov-chart-key-estimated' : ''}`} />{label}</span>}</div>
  </div>;
}
RevenueForecastChart.propTypes = { rows: PropTypes.arrayOf(PropTypes.shape({ month: PropTypes.string, value: valueType })), currency: PropTypes.string, basis: PropTypes.oneOf(['estimated', 'approved', 'unavailable']) };

export function PortfolioDonut({ buckets = [], total = null }) {
  const id = useId().replace(/:/g, '');
  const segments = buckets.filter(bucket => number(bucket.count) > 0);
  const sum = segments.reduce((result, bucket) => result + number(bucket.count), 0);
  const displayedTotal = number(total) ?? (buckets.some(bucket => number(bucket.count) !== null) ? sum : null);
  const circumference = 2 * Math.PI * 54;
  let offset = 0;
  return <div className="eov-chart-donut"><svg viewBox="0 0 150 150" preserveAspectRatio="xMidYMid meet" role="img" aria-labelledby={`${id}-title ${id}-description`}>
    <title id={`${id}-title`}>{`Portfolio health: ${displayedTotal === null ? 'project count unavailable' : `${displayedTotal} projects`}`}</title><desc id={`${id}-description`}>{segments.length ? segments.map(bucket => `${bucket.label}: ${bucket.count}`).join('. ') : 'No project health data available.'}</desc>
    <circle cx="75" cy="75" r="54" fill="none" stroke="var(--cc-border, #e7ecf4)" strokeWidth="27" />
    {segments.map((bucket, index) => {
      const length = number(bucket.count) / sum * circumference;
      const segmentOffset = offset;
      offset += length;
      return <circle key={bucket.id || bucket.label || index} cx="75" cy="75" r="54" fill="none" stroke={bucket.color || ['#00a56c', '#ffb51c', '#ed3c4c', '#aeb7c7'][index % 4]} strokeWidth="27" strokeDasharray={`${Math.max(0, length - (segments.length > 1 ? 1 : 0))} ${circumference}`} strokeDashoffset={-segmentOffset} transform="rotate(-90 75 75)"><title>{`${bucket.label}: ${bucket.count} projects (${Math.round(number(bucket.count) / sum * 100)}%)`}</title></circle>;
    })}
    <text className="eov-chart-donut-total" x="75" y="76" textAnchor="middle">{displayedTotal === null ? '—' : displayedTotal.toLocaleString('en-GB')}</text><text className="eov-chart-donut-caption" x="75" y="92" textAnchor="middle">projects</text>
  </svg></div>;
}
PortfolioDonut.propTypes = { buckets: PropTypes.arrayOf(PropTypes.shape({ id: PropTypes.string, label: PropTypes.string, count: valueType, color: PropTypes.string })), total: valueType };
