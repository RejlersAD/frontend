/* eslint-disable react/prop-types */
import { useEffect, useId, useRef, useState } from 'react';
import './PortfolioReferenceCharts.css';

const BLUE = '#2166ee';
const GREEN = '#00a477';
const AMBER = '#f0a719';
const RED = '#e43d57';
const GREY = '#8f9caf';
const numeric = value => typeof value === 'number' && Number.isFinite(value) ? value
  : typeof value === 'string' && /^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(value.trim()) && Number.isFinite(Number(value)) ? Number(value) : null;
const exact = value => value.toLocaleString('en-GB', { maximumFractionDigits: 10 });
const tick = value => value.toLocaleString('en-GB', { maximumFractionDigits: 2 });
const healthStyles = {
  critical: { label: 'Critical', color: RED }, high: { label: 'High risk', color: AMBER },
  medium: { label: 'At risk', color: AMBER }, low: { label: 'Low risk', color: GREEN },
  clear: { label: 'No exceptions', color: GREEN }, on_track: { label: 'On track', color: GREEN },
  at_risk: { label: 'At risk', color: AMBER }, unknown: { label: 'Not assessed', color: GREY },
};

function monthLabel(value, full = false) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})(?:-\d{2})?$/);
  if (!match || Number(match[2]) < 1 || Number(match[2]) > 12) return String(value || 'Undated');
  return new Date(Number(match[1]), Number(match[2]) - 1, 1).toLocaleDateString('en-GB', { month: full ? 'long' : 'short', year: 'numeric' }).replace(/\bSept\b/, 'Sep');
}

function extent(values, steps = 4) {
  const recorded = values.map(numeric).filter(value => value !== null);
  const low = Math.min(0, ...recorded), high = Math.max(0, ...recorded);
  const rough = (high - low || 1) / steps;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].find(value => value * magnitude >= rough) * magnitude;
  const min = Math.floor(low / step) * step;
  const max = high === low ? min + steps * step : Math.ceil(high / step) * step;
  return { min, max, ticks: Array.from({ length: Math.round((max - min) / step) + 1 }, (_, index) => min + index * step) };
}

function segments(rows, key) {
  const result = [];
  let current = [];
  rows.forEach((row, index) => {
    const value = numeric(row[key]);
    if (value !== null) current.push({ index, value });
    else if (current.length) { result.push(current); current = []; }
  });
  if (current.length) result.push(current);
  return result;
}

function useChart() {
  const ref = useRef(null);
  const id = useId().replace(/:/g, '');
  const [width, setWidth] = useState(680);
  const [tooltip, setTooltip] = useState(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    const measure = () => setWidth(Math.max(220, Math.round(element.getBoundingClientRect().width)));
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const mark = label => ({ tabIndex: 0, role: 'img', 'aria-label': label,
    'aria-describedby': tooltip === label ? `${id}-tooltip` : undefined,
    onFocus: () => setTooltip(label), onBlur: () => setTooltip(null),
    onMouseEnter: () => setTooltip(label), onMouseLeave: () => setTooltip(null),
    onKeyDown: event => { if (event.key === 'Escape') setTooltip(null); } });
  return { ref, width, id, tooltip, mark };
}

function ChartDescription({ id, title, children }) {
  return <><title id={`${id}-title`}>{title}</title><desc id={`${id}-description`}>{children} Focus a recorded mark to read its exact value.</desc></>;
}

function EmptyChart({ children }) {
  return <div className="ppr-chart-empty"><span>{children}</span></div>;
}

function Tooltip({ chart }) {
  return chart.tooltip ? <div className="ppr-chart-tooltip" id={`${chart.id}-tooltip`} role="tooltip">{chart.tooltip}</div> : null;
}

function Legend({ items }) {
  return <ul className="ppr-chart-legend" aria-label="Chart series">{items.map(item => <li key={item.label}><i className={`${item.line ? 'ppr-chart-legend-line' : 'ppr-chart-legend-dot'}${item.dashed ? ' ppr-chart-legend-dashed' : ''}`} style={{ '--ppr-series': item.color }} aria-hidden="true" />{item.label}</li>)}</ul>;
}

/** Rows must contain approved project reporting measures, in their original currency. */
export function PortfolioDeliveryScatter({ rows = [], currency = 'AED', targetMargin = null, recoveryZone = null, emptyMessage = 'Awaiting approved margin and schedule reports' }) {
  const chart = useChart();
  const selectedCurrency = String(currency || '').toUpperCase();
  const points = rows.filter(row => String(row.currency || '').toUpperCase() === selectedCurrency && selectedCurrency)
    .map(row => ({ ...row, schedule: numeric(row.schedule_variance), margin: numeric(row.forecast_margin), remaining: numeric(row.revenue_remaining) }))
    .filter(row => row.schedule !== null && row.margin !== null);
  const target = numeric(targetMargin);
  const recovery = recoveryZone?.status === 'approved' && numeric(recoveryZone.schedule_variance_min) !== null && numeric(recoveryZone.forecast_margin_max) !== null
    ? { schedule: numeric(recoveryZone.schedule_variance_min), margin: numeric(recoveryZone.forecast_margin_max) } : null;
  const hasData = points.length > 0;
  const height = 160, left = 43, right = chart.width - 19, top = 24, bottom = height - 37;
  const xScale = extent([...points.map(point => point.schedule), ...(hasData && recovery ? [recovery.schedule] : [])]);
  const yScale = extent([...points.map(point => point.margin), ...(hasData && target !== null ? [target] : []), ...(hasData && recovery ? [recovery.margin] : [])]);
  const x = value => left + 12 + (value - xScale.min) / (xScale.max - xScale.min) * (right - left - 24);
  const y = value => bottom - 12 - (value - yScale.min) / (yScale.max - yScale.min) * (bottom - top - 24);
  const maximumRemaining = Math.max(0, ...points.filter(point => point.remaining !== null && point.remaining >= 0).map(point => point.remaining));
  const legend = [{ label: 'No exceptions', color: GREEN }, { label: 'Needs review', color: AMBER }, { label: 'Critical', color: RED }, { label: 'Not assessed', color: GREY }];
  if (target !== null && hasData) legend.push({ label: `Approved target ${exact(target)}%`, color: '#8797b0', line: true, dashed: true });
  return <div className="ppr-chart ppr-chart-scatter" data-testid="portfolio-delivery-scatter" ref={chart.ref}>
    <svg viewBox={`0 0 ${chart.width} ${height}`} preserveAspectRatio="xMidYMid meet" role="group" aria-labelledby={`${chart.id}-title ${chart.id}-description`}>
      <ChartDescription id={chart.id} title="Portfolio delivery outlook">Schedule variance in days on the horizontal axis and forecast margin percentage on the vertical axis. Positive schedule variance means delay. Bubble size uses recorded revenue remaining in {selectedCurrency || 'the selected original currency'}. Outlined markers have zero or unrecorded remaining revenue.</ChartDescription>
      {hasData && recovery && <g className="ppr-chart-recovery"><rect x={x(recovery.schedule)} y={y(recovery.margin)} width={Math.max(0, right - x(recovery.schedule))} height={Math.max(0, bottom - y(recovery.margin))} /><text x={right - 5} y={bottom - 6} textAnchor="end">Approved recovery zone</text></g>}
      {yScale.ticks.map(value => <g className="ppr-chart-grid" key={`y-${value}`}><line x1={left} x2={right} y1={y(value)} y2={y(value)} />{hasData && <text x={left - 7} y={y(value) + 3} textAnchor="end">{tick(value)}%</text>}</g>)}
      {xScale.ticks.map(value => <g className="ppr-chart-grid" key={`x-${value}`}><line x1={x(value)} x2={x(value)} y1={top} y2={bottom} />{hasData && <text x={x(value)} y={bottom + 14} textAnchor="middle">{tick(value)}</text>}</g>)}
      <text className="ppr-chart-axis" x={left} y={12}>Forecast margin (%)</text>
      <text className="ppr-chart-axis" x={(left + right) / 2} y={height - 3} textAnchor="middle">Schedule variance (days)</text>
      {target !== null && hasData && <line className="ppr-chart-target" x1={left} x2={right} y1={y(target)} y2={y(target)} />}
      {points.map((point, index) => {
        const health = healthStyles[point.health] || healthStyles.unknown;
        const sized = point.remaining !== null && point.remaining > 0;
        const radius = sized ? Math.max(2.5, Math.sqrt(point.remaining / maximumRemaining) * 12) : 5;
        const remaining = point.remaining !== null && point.remaining >= 0 ? `${selectedCurrency} ${point.remaining.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 10 })}` : 'Not recorded';
        const label = `${point.name || point.id || 'Project'}: schedule variance ${exact(point.schedule)} days; forecast margin ${exact(point.margin)}%; revenue remaining ${remaining}; ${health.label}.`;
        return <g className="ppr-chart-mark" key={`${point.id || point.name}-${index}`} {...chart.mark(label)}><circle cx={x(point.schedule)} cy={y(point.margin)} r={Math.max(10, radius + 3)} fill="transparent" /><circle className="ppr-chart-symbol" cx={x(point.schedule)} cy={y(point.margin)} r={radius} fill={sized ? health.color : 'var(--cc-surface, #fff)'} fillOpacity={sized ? .84 : 1} stroke={health.color} strokeWidth="1.5" strokeDasharray={point.remaining === null || point.remaining < 0 ? '2 2' : undefined} /><title>{label}</title></g>;
      })}
    </svg>
    {!hasData && <EmptyChart>{emptyMessage}</EmptyChart>}
    <div className="ppr-chart-footer"><Legend items={legend} />{hasData && <span className="ppr-chart-size-note">Size: revenue remaining ({selectedCurrency})</span>}</div>
    <Tooltip chart={chart} />
  </div>;
}

/** Monthly points are supplied by the reporting source; no interpolation or aggregation is inferred. */
export function PortfolioMarginScheduleTrend({ rows = [], targetMargin = null, emptyMessage = 'Awaiting approved monthly margin and schedule reports' }) {
  const chart = useChart();
  const target = numeric(targetMargin);
  const hasMargin = rows.some(row => numeric(row.forecast_margin) !== null);
  const hasSchedule = rows.some(row => numeric(row.schedule_variance) !== null);
  const hasData = hasMargin || hasSchedule;
  const height = 116, left = 42, right = chart.width - 43, top = 25, bottom = height - 25;
  const marginScale = extent([...rows.map(row => row.forecast_margin), ...(hasMargin && target !== null ? [target] : [])]);
  const scheduleScale = extent(rows.map(row => row.schedule_variance));
  const x = index => left + 5 + (right - left - 10) * (rows.length > 1 ? index / (rows.length - 1) : .5);
  const marginY = value => top + (marginScale.max - value) / (marginScale.max - marginScale.min) * (bottom - top);
  const scheduleY = value => top + (scheduleScale.max - value) / (scheduleScale.max - scheduleScale.min) * (bottom - top);
  const series = [{ key: 'forecast_margin', label: 'Forecast margin', color: GREEN, y: marginY, unit: '%' }, { key: 'schedule_variance', label: 'Average schedule variance', color: BLUE, y: scheduleY, unit: ' days' }];
  const legend = series.map(item => ({ ...item, line: true }));
  if (hasMargin && target !== null) legend.push({ label: `Approved target ${exact(target)}%`, color: '#8797b0', line: true, dashed: true });
  const every = Math.max(1, Math.ceil(rows.length / (chart.width < 450 ? 4 : 8)));
  return <div className="ppr-chart ppr-chart-trend" data-testid="portfolio-margin-schedule-trend" ref={chart.ref}>
    <svg viewBox={`0 0 ${chart.width} ${height}`} preserveAspectRatio="xMidYMid meet" role="group" aria-labelledby={`${chart.id}-title ${chart.id}-description`}>
      <ChartDescription id={chart.id} title="Portfolio margin and schedule trend">Approved monthly forecast margin on the left percentage axis, and schedule variance in days on the right axis. Missing observations leave gaps; the two series use separate scales.</ChartDescription>
      {marginScale.ticks.map(value => <g className="ppr-chart-grid" key={value}><line x1={left} x2={right} y1={marginY(value)} y2={marginY(value)} />{hasMargin && <text x={left - 7} y={marginY(value) + 3} textAnchor="end">{tick(value)}%</text>}</g>)}
      {hasSchedule && scheduleScale.ticks.map(value => <text className="ppr-chart-tick" key={value} x={right + 6} y={scheduleY(value) + 3}>{tick(value)}</text>)}
      <text className="ppr-chart-axis" x={left} y={12}>Forecast margin (%)</text>
      <text className="ppr-chart-axis" x={right} y={12} textAnchor="end">Schedule variance (days)</text>
      {rows.map((row, index) => index % every === 0 || index === rows.length - 1 && index % every >= every * .7 ? <g className="ppr-chart-grid" key={`${row.month}-${index}`}><line x1={x(index)} x2={x(index)} y1={top} y2={bottom} /><text x={x(index)} y={height - 8} textAnchor="middle">{monthLabel(row.month)}</text></g> : null)}
      {hasMargin && target !== null && <line className="ppr-chart-target" x1={left} x2={right} y1={marginY(target)} y2={marginY(target)} />}
      {series.map(item => <g key={item.key}>{segments(rows, item.key).map((segment, index) => <g key={index}>
        {segment.length > 1 && <polyline className="ppr-chart-trace" points={segment.map(point => `${x(point.index)},${item.y(point.value)}`).join(' ')} stroke={item.color} fill="none" strokeWidth="1.8" />}
        {segment.map(point => {
          const label = `${monthLabel(rows[point.index].month, true)}: ${item.label} ${exact(point.value)}${item.unit}.`;
          return <g className="ppr-chart-mark" key={point.index} {...chart.mark(label)}><circle cx={x(point.index)} cy={item.y(point.value)} r="9" fill="transparent" /><circle className="ppr-chart-symbol" cx={x(point.index)} cy={item.y(point.value)} r="3" fill={item.color} stroke="var(--cc-surface, #fff)" strokeWidth="1" /><title>{label}</title></g>;
        })}
      </g>)}</g>)}
    </svg>
    {!hasData && <EmptyChart>{emptyMessage}</EmptyChart>}
    <Legend items={legend} />
    <Tooltip chart={chart} />
  </div>;
}

/** One real observation renders a dot; missing periods always break the line. */
export function PortfolioKpiSparkline({ values = [], label = 'Recorded trend', color = BLUE }) {
  const observations = values.map(value => ({ value: numeric(value) }));
  const recorded = observations.map(row => row.value).filter(value => value !== null);
  const id = useId().replace(/:/g, '');
  if (!recorded.length) return null;
  const min = Math.min(...recorded), max = Math.max(...recorded);
  const x = index => 3 + 88 * (values.length > 1 ? index / (values.length - 1) : .5);
  const y = value => max === min ? 15 : 26 - (value - min) / (max - min) * 22;
  return <svg className="ppr-kpi-sparkline" viewBox="0 0 94 30" preserveAspectRatio="none" role="img" aria-labelledby={`${id}-sparkline-title`}>
    <title id={`${id}-sparkline-title`}>{`${label}: ${observations.map(row => row.value === null ? 'not recorded' : exact(row.value)).join(', ')}.`}</title>
    {segments(observations, 'value').map((segment, index) => <g key={index}>{segment.length > 1 ? <polyline points={segment.map(point => `${x(point.index)},${y(point.value)}`).join(' ')} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" /> : <circle cx={x(segment[0].index)} cy={y(segment[0].value)} r="1.8" fill={color} />}</g>)}
  </svg>;
}
