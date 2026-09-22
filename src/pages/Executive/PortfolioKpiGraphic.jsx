/* eslint-disable react/prop-types */
import { useId } from 'react';
import './PortfolioKpiGraphic.css';

const numeric = value => typeof value === 'number' && Number.isFinite(value) ? value
  : typeof value === 'string' && /^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(value.trim()) && Number.isFinite(Number(value)) ? Number(value) : null;
const referencePatterns = {
  active_projects: [12, 18, 25, 31, 40, 48, 30, 20],
  contract_value: [6, 12, 10, 23, 17, 16, 22, 18, 24, 29, 28, 27, 35, 38, 35, 40, 39],
  revenue_remaining: [9, 10, 15, 29, 17, 21, 31, 24, 27, 30, 34, 49, 42, 41, 33],
  forecast_margin: [11, 24, 9, 29, 20, 28, 17, 33, 24, 41, 31, 36, 23, 44, 35, 29],
  schedule_confidence: [10, 21, 14, 19, 13, 26, 18, 35, 23, 40, 29, 34, 28, 36],
};

function segments(values) {
  const result = [];
  let current = [];
  values.forEach((value, index) => {
    if (value !== null) current.push({ index, value });
    else if (current.length) { result.push(current); current = []; }
  });
  if (current.length) result.push(current);
  return result;
}

export default function PortfolioKpiGraphic({ id, label, values = [], color, kind = 'line' }) {
  const graphicId = useId().replace(/:/g, '');
  const observations = values.map(numeric);
  const illustrative = !observations.some(value => value !== null);
  const plotted = illustrative ? referencePatterns[id] || referencePatterns.contract_value : observations;
  const bars = kind === 'bars' || kind === 'bar' || id === 'active_projects';
  const seriesColor = color || (id === 'revenue_remaining' ? '#00a977' : ['forecast_margin', 'schedule_confidence'].includes(id) ? '#f7a400' : '#1674ff');
  const recorded = plotted.filter(value => value !== null);
  const min = bars ? Math.min(0, ...recorded) : Math.min(...recorded);
  const max = bars ? Math.max(0, ...recorded) : Math.max(...recorded);
  const y = value => max === min ? 20 : 36 - (value - min) / (max - min) * 31;
  const x = index => 3 + 66 * (plotted.length > 1 ? index / (plotted.length - 1) : .5);
  const step = 68 / plotted.length;
  const title = illustrative
    ? `${label || id}: illustrative reference graphic, not historical data.`
    : `${label || id}: recorded history, ${observations.map(value => value === null ? 'not recorded' : value.toLocaleString('en-GB', { maximumFractionDigits: 10 })).join(', ')}. Missing observations leave gaps.`;
  return <span className={`pp-kpi-graphic${illustrative ? ' pp-kpi-graphic--illustrative' : ''}`}>
    <svg viewBox="0 0 72 40" preserveAspectRatio="none" role="img" aria-labelledby={`${graphicId}-title`}>
      <title id={`${graphicId}-title`}>{title}</title>
      <defs><linearGradient id={`${graphicId}-fill`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={seriesColor} stopOpacity={bars ? .95 : .23} /><stop offset="100%" stopColor={seriesColor} stopOpacity={bars ? .6 : .02} /></linearGradient></defs>
      {bars ? plotted.map((value, index) => value === null || value === 0 ? null : <rect key={index} x={2 + step * index + step * .14} y={Math.min(y(0), y(value))} width={step * .65} height={Math.abs(y(0) - y(value))} fill={`url(#${graphicId}-fill)`} rx=".3" />)
        : segments(plotted).map((segment, index) => {
          const path = segment.map((point, position) => `${position ? 'L' : 'M'}${x(point.index)},${y(point.value)}`).join(' ');
          return <g key={index}>{segment.length > 1 ? <><path d={`${path} L${x(segment[segment.length - 1].index)},39 L${x(segment[0].index)},39 Z`} fill={`url(#${graphicId}-fill)`} /><path d={path} fill="none" stroke={seriesColor} strokeWidth="1.2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" /></> : <path d={`M${x(segment[0].index) - .5},${y(segment[0].value)} h1`} stroke={seriesColor} strokeWidth="1.2" strokeLinecap="round" vectorEffect="non-scaling-stroke" />}</g>;
        })}
    </svg>
    {illustrative && <span className="pp-kpi-graphic-caption" aria-hidden="true">Illustrative</span>}
  </span>;
}
