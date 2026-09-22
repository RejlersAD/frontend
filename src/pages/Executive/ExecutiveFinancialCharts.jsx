import { useEffect, useId, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import './ExecutiveFinancialCharts.css';

const BLUE = '#1672ef';
const LIGHT_BLUE = '#8ecbff';
const TEAL = '#009d91';
const RED = '#df5263';
const GREY = '#9caec2';
const numeric = value => typeof value === 'number' && Number.isFinite(value) ? value : typeof value === 'string' && /^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(value.trim()) && Number.isFinite(Number(value)) ? Number(value) : null;
const money = (value, currency) => numeric(value) === null ? 'Not recorded' : `${currency ? `${currency} ` : ''}${numeric(value).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const compact = value => value.toLocaleString('en-GB', { notation: 'compact', maximumFractionDigits: 1 }).replace(/k$/, 'K');
const short = (value, length) => String(value || '').length > length ? `${String(value).slice(0, length - 1)}…` : String(value || '');
const percent = value => numeric(value) === null ? 'Not recorded' : `${numeric(value).toLocaleString('en-GB', { maximumFractionDigits: 1 })}%`;
const hasValues = (rows, keys) => rows.some(row => keys.some(key => numeric(row[key]) !== null));
const currencyProp = PropTypes.string;
const numberProp = PropTypes.oneOfType([PropTypes.number, PropTypes.string]);

function monthParts(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})(?:-\d{2})?$/);
  if (!match || Number(match[2]) < 1 || Number(match[2]) > 12) return [String(value || ''), ''];
  const date = new Date(Number(match[1]), Number(match[2]) - 1, 1);
  return [date.toLocaleDateString('en-GB', { month: 'short' }).replace('Sept', 'Sep'), match[1]];
}

function extent(values, count = 4) {
  const recorded = values.map(numeric).filter(value => value !== null);
  const minimum = Math.min(0, ...recorded);
  const maximum = Math.max(0, ...recorded);
  const rough = (maximum - minimum || 1) / count;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].find(value => value * magnitude >= rough) * magnitude;
  const min = Math.floor(minimum / step) * step;
  const max = maximum === minimum ? min + count * step : Math.ceil(maximum / step) * step;
  return { min, max, ticks: Array.from({ length: Math.round((max - min) / step) + 1 }, (_, index) => min + index * step) };
}

function useChart() {
  const ref = useRef(null);
  const [width, setWidth] = useState(560);
  const [tooltip, setTooltip] = useState(null);
  const id = useId().replace(/:/g, '');
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
  const mark = label => ({ tabIndex: 0, role: 'img', 'aria-label': label, onFocus: () => setTooltip(label), onBlur: () => setTooltip(null), onMouseEnter: () => setTooltip(label), onMouseLeave: () => setTooltip(null), onKeyDown: event => { if (event.key === 'Escape') setTooltip(null); } });
  return { ref, width, id, tooltip, mark };
}

function Legend({ series }) {
  return <ul className="ef-chart-legend" aria-label="Chart series">{series.map(series => <li key={series.label}><i className={series.line ? `ef-chart-legend-line${series.dashed ? ' ef-chart-legend-dashed' : ''}` : ''} style={{ '--ef-series': series.colour }} aria-hidden="true" />{series.label}</li>)}</ul>;
}
Legend.propTypes = { series: PropTypes.arrayOf(PropTypes.shape({ label: PropTypes.string.isRequired, colour: PropTypes.string.isRequired, line: PropTypes.bool, dashed: PropTypes.bool })).isRequired };

function ChartTitle({ id, title, description }) {
  return <><title id={`${id}-title`}>{title}</title><desc id={`${id}-description`}>{description} Focus a recorded chart mark to read its value. Missing values leave gaps.</desc></>;
}
ChartTitle.propTypes = { id: PropTypes.string.isRequired, title: PropTypes.string.isRequired, description: PropTypes.string.isRequired };

function Grid({ scale, left, right, top, bottom, showValues = true }) {
  const y = value => top + (scale.max - value) / (scale.max - scale.min) * (bottom - top);
  return <>{scale.ticks.map(tick => <g className="ef-chart-grid" key={tick}><line x1={left} x2={right} y1={y(tick)} y2={y(tick)} />{showValues && <text x={left - 7} y={y(tick) + 3} textAnchor="end">{compact(tick)}</text>}</g>)}</>;
}
Grid.propTypes = { scale: PropTypes.object.isRequired, left: PropTypes.number.isRequired, right: PropTypes.number.isRequired, top: PropTypes.number.isRequired, bottom: PropTypes.number.isRequired, showValues: PropTypes.bool };

function MonthLabels({ rows, x, y, width }) {
  const every = Math.max(1, Math.ceil(rows.length / (width < 420 ? 5 : 12)));
  return rows.map((row, index) => {
    if (index % every !== 0 && (index !== rows.length - 1 || index % every < Math.ceil(every * 0.75))) return null;
    const [month, year] = monthParts(row.month);
    return <text className="ef-chart-month" key={`${row.month}-${index}`} x={x(index)} y={y} textAnchor="middle"><tspan x={x(index)}>{month}</tspan>{year && <tspan x={x(index)} dy="11" className="ef-chart-year">{year}</tspan>}</text>;
  });
}
MonthLabels.propTypes = { rows: PropTypes.array.isRequired, x: PropTypes.func.isRequired, y: PropTypes.number.isRequired, width: PropTypes.number.isRequired };

function lines(rows, key) {
  const segments = [];
  let segment = [];
  rows.forEach((row, index) => {
    const value = numeric(row[key]);
    if (value !== null) segment.push({ index, value });
    else if (segment.length) { segments.push(segment); segment = []; }
  });
  if (segment.length) segments.push(segment);
  return segments;
}

function EmptyState({ message }) {
  return <div className="ef-chart-empty"><span>{message}</span></div>;
}
EmptyState.propTypes = { message: PropTypes.string.isRequired };

function Tooltip({ text }) {
  return text ? <div className="ef-chart-tooltip" role="tooltip">{text}</div> : null;
}
Tooltip.propTypes = { text: PropTypes.string };

export function RevenueMarginChart({ rows = [], currency = '', mode = 'monthly' }) {
  const chart = useChart();
  const height = 190, left = 40, right = chart.width - 35, top = 31, bottom = 158;
  const hasRevenue = hasValues(rows, ['revenue', 'forecast', 'budget']);
  const hasMargin = hasValues(rows, ['margin']);
  const hasData = hasRevenue || hasMargin;
  const scale = extent(rows.flatMap(row => [row.revenue, row.forecast, row.budget]));
  const marginScale = extent(rows.map(row => row.margin));
  const y = value => top + (scale.max - value) / (scale.max - scale.min) * (bottom - top);
  const marginY = value => top + (marginScale.max - value) / (marginScale.max - marginScale.min) * (bottom - top);
  const slot = (right - left) / Math.max(rows.length, 1);
  const x = index => left + slot * (index + 0.5);
  const bar = Math.min(23, slot * 0.34);
  const series = [{ label: 'Actual', colour: BLUE }, { label: 'Forecast', colour: LIGHT_BLUE }, { label: 'Budget', colour: BLUE, line: true, dashed: true }, { label: 'Margin', colour: TEAL, line: true }];
  return <div className="ef-chart ef-chart-revenue" ref={chart.ref} data-testid="ef-revenue-margin-chart"><span className="ef-chart-unit">{currency}</span><Legend series={series} /><svg viewBox={`0 0 ${chart.width} ${height}`} role="img" aria-labelledby={`${chart.id}-title ${chart.id}-description`}><ChartTitle id={chart.id} title={`${mode === 'monthly' ? 'Monthly' : 'Year-to-date'} revenue and margin`} description={`Revenue, forecast and budget in ${currency || 'the selected currency'}; margin is a percentage on the right axis.`} /><Grid scale={scale} left={left} right={right} top={top} bottom={bottom} showValues={hasRevenue} />
    {hasMargin && marginScale.ticks.map(tick => <text className="ef-chart-margin-tick" key={tick} x={right + 6} y={marginY(tick) + 3}>{compact(tick)}%</text>)}
    {rows.map((row, index) => <g key={`${row.month}-${index}`}>{[['revenue', 'Actual', BLUE], ['forecast', 'Forecast', LIGHT_BLUE]].map(([key, label, colour], seriesIndex) => {
      const value = numeric(row[key]);
      if (value === null) return null;
      const both = numeric(row.revenue) !== null && numeric(row.forecast) !== null;
      const width = both ? bar : bar * 1.6;
      const position = x(index) - (both ? (seriesIndex === 0 ? bar : 0) : width / 2);
      const title = `${monthParts(row.month).join(' ')}, ${label}: ${money(value, currency)}`;
      return <rect key={key} className="ef-chart-mark" {...chart.mark(title)} x={position} y={Math.min(y(0), y(value))} width={Math.max(1, width - 1)} height={Math.max(1, Math.abs(y(value) - y(0)))} fill={colour} rx="1"><title>{title}</title></rect>;
    })}</g>)}
    {[{ key: 'budget', label: 'Budget', colour: BLUE, y, dashed: true }, { key: 'margin', label: 'Margin', colour: TEAL, y: marginY }].map(series => <g key={series.key}>{lines(rows, series.key).map((segment, segmentIndex) => <g key={segmentIndex}>{segment.length > 1 && <polyline points={segment.map(point => `${x(point.index)},${series.y(point.value)}`).join(' ')} stroke={series.colour} strokeWidth="1.7" strokeDasharray={series.dashed ? '4 3' : undefined} fill="none" />}{segment.map(point => {
      const title = `${monthParts(rows[point.index].month).join(' ')}, ${series.label}: ${series.key === 'margin' ? percent(point.value) : money(point.value, currency)}`;
      return <circle className="ef-chart-mark" {...chart.mark(title)} key={point.index} cx={x(point.index)} cy={series.y(point.value)} r="3" fill={series.colour} stroke="white" strokeWidth="1"><title>{title}</title></circle>;
    })}</g>)}</g>)}
    <MonthLabels rows={rows} x={x} y={height - 17} width={chart.width} />
  </svg>{!hasData && <EmptyState message="Revenue data not connected" />}<Tooltip text={chart.tooltip} /></div>;
}
RevenueMarginChart.propTypes = { rows: PropTypes.arrayOf(PropTypes.shape({ month: PropTypes.string.isRequired, revenue: numberProp, forecast: numberProp, budget: numberProp, margin: numberProp })), currency: currencyProp, mode: PropTypes.oneOf(['monthly', 'ytd']) };

export function ForecastWaterfall({ rows = [], currency = '' }) {
  const chart = useChart();
  const height = 126, left = 38, right = chart.width - 12, top = 27, bottom = 99;
  let running = null;
  const entries = rows.map(row => {
    const amount = numeric(row.amount);
    const start = row.kind === 'total' ? 0 : running;
    const end = amount === null || start === null ? null : row.kind === 'total' ? amount : start + amount;
    running = end;
    return { ...row, amount, start, end };
  });
  const hasData = entries.some(row => row.end !== null);
  const scale = extent(entries.flatMap(row => [row.start, row.end]));
  const y = value => top + (scale.max - value) / (scale.max - scale.min) * (bottom - top);
  const slot = (right - left) / Math.max(entries.length, 1);
  const width = Math.min(44, slot * 0.56);
  const x = index => left + slot * (index + 0.5);
  return <div className="ef-chart ef-chart-waterfall" ref={chart.ref} data-testid="ef-forecast-waterfall"><span className="ef-chart-unit">{currency}</span><Legend series={[{ label: 'Baseline', colour: GREY }, { label: 'Increase', colour: TEAL }, { label: 'Decrease', colour: RED }, { label: 'Forecast', colour: BLUE }]} /><svg viewBox={`0 0 ${chart.width} ${height}`} role="img" aria-labelledby={`${chart.id}-title ${chart.id}-description`}><ChartTitle id={chart.id} title="Forecast bridge" description={`Recorded budget and changes leading to the latest forecast in ${currency || 'the selected currency'}.`} /><Grid scale={scale} left={left} right={right} top={top} bottom={bottom} showValues={hasData} />{entries.map((row, index) => {
    const recorded = row.end !== null;
    const colour = row.kind === 'total' ? index === entries.length - 1 ? BLUE : GREY : row.amount < 0 ? RED : TEAL;
    const title = `${row.label}: ${money(row.amount, currency)}${row.kind === 'change' && recorded ? `; running forecast ${money(row.end, currency)}` : ''}`;
    return <g key={`${row.label}-${index}`}>{recorded && <>{index > 0 && row.kind === 'change' && entries[index - 1].end !== null && <line className="ef-chart-waterfall-connector" x1={x(index - 1) + width / 2} x2={x(index) - width / 2} y1={y(row.start)} y2={y(row.start)} />}<rect className="ef-chart-mark" {...chart.mark(title)} x={x(index) - width / 2} y={Math.min(y(row.start), y(row.end))} width={width} height={Math.max(1, Math.abs(y(row.start) - y(row.end)))} fill={colour} rx="1"><title>{title}</title></rect><text className="ef-chart-value" x={x(index)} y={Math.min(y(row.start), y(row.end)) - 4} textAnchor="middle">{row.kind === 'change' && row.amount > 0 ? '+' : ''}{compact(row.amount)}</text></>}<text className="ef-chart-category" x={x(index)} y={height - 11} textAnchor="middle"><title>{row.label}</title>{short(row.label, chart.width < 420 ? 10 : 17)}</text></g>;
  })}</svg>{!hasData && <EmptyState message="Forecast data not connected" />}<Tooltip text={chart.tooltip} /></div>;
}
ForecastWaterfall.propTypes = { rows: PropTypes.arrayOf(PropTypes.shape({ label: PropTypes.string.isRequired, amount: numberProp, kind: PropTypes.oneOf(['total', 'change']).isRequired })), currency: currencyProp };

export function BusinessUnitBars({ rows = [], currency = '' }) {
  const chart = useChart();
  const height = Math.max(136, rows.length * 23 + 28);
  const left = Math.min(128, chart.width * 0.27), right = chart.width - 87, top = 28, bottom = height - 9;
  const hasData = hasValues(rows, ['revenue', 'budget', 'margin']);
  const scale = extent(rows.flatMap(row => [row.revenue, row.budget]));
  const x = value => left + (value - scale.min) / (scale.max - scale.min) * (right - left);
  const slot = (bottom - top) / Math.max(rows.length, 1);
  return <div className="ef-chart ef-chart-business-units" ref={chart.ref} data-testid="ef-business-unit-bars" style={{ '--ef-chart-height': `${height}px` }}><span className="ef-chart-unit">{currency}</span><Legend series={[{ label: 'Revenue', colour: BLUE }, { label: 'Budget', colour: GREY, line: true }, { label: 'Margin', colour: TEAL, line: true }]} /><svg viewBox={`0 0 ${chart.width} ${height}`} role="img" aria-labelledby={`${chart.id}-title ${chart.id}-description`}><ChartTitle id={chart.id} title="Business unit performance" description={`Revenue against budget in ${currency || 'the selected currency'}, with recorded margin percentages.`} />{scale.ticks.map(tick => <line className="ef-chart-vertical-grid" key={tick} x1={x(tick)} x2={x(tick)} y1={top} y2={bottom} />)}{rows.map((row, index) => {
    const y = top + slot * (index + 0.5), revenue = numeric(row.revenue), budget = numeric(row.budget);
    const title = `${row.name}, revenue: ${money(revenue, currency)}; budget: ${money(budget, currency)}; margin: ${percent(row.margin)}`;
    return <g key={row.id || `${row.name}-${index}`}><text className="ef-chart-business-name" x={left - 8} y={y + 3} textAnchor="end"><title>{row.name}</title>{short(row.name, chart.width < 420 ? 13 : 23)}</text>{revenue !== null && <rect className="ef-chart-mark" {...chart.mark(title)} x={Math.min(x(0), x(revenue))} y={y - 4} width={Math.max(1, Math.abs(x(revenue) - x(0)))} height="8" fill={BLUE} rx="1"><title>{title}</title></rect>}{budget !== null && <line className="ef-chart-mark" {...chart.mark(`${row.name}, budget: ${money(budget, currency)}`)} x1={x(budget)} x2={x(budget)} y1={y - 7} y2={y + 7} stroke={GREY} strokeWidth="2"><title>{`${row.name}, budget: ${money(budget, currency)}`}</title></line>}<text className="ef-chart-value" x={right + 8} y={y + 3}>{revenue === null ? '—' : compact(revenue)}</text><text className="ef-chart-business-margin" x={chart.width - 4} y={y + 3} textAnchor="end">{numeric(row.margin) === null ? '—' : percent(row.margin)}</text></g>;
  })}</svg>{!hasData && <EmptyState message="Business unit data not connected" />}<Tooltip text={chart.tooltip} /></div>;
}
BusinessUnitBars.propTypes = { rows: PropTypes.arrayOf(PropTypes.shape({ id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]), name: PropTypes.string.isRequired, revenue: numberProp, budget: numberProp, margin: numberProp })), currency: currencyProp };

export function WorkingCapitalChart({ rows = [], currency = '' }) {
  const chart = useChart();
  const height = 80, left = 39, right = chart.width - 15, top = 21, bottom = 48;
  const hasData = hasValues(rows, ['actual', 'plan']);
  const scale = extent(rows.flatMap(row => [row.actual, row.plan]), 2);
  const x = index => left + (index + 0.5) / Math.max(rows.length, 1) * (right - left);
  const y = value => top + (scale.max - value) / (scale.max - scale.min) * (bottom - top);
  const series = [{ key: 'actual', label: 'Actual', colour: TEAL }, { key: 'plan', label: 'Plan', colour: BLUE, dashed: true }];
  return <div className="ef-chart ef-chart-working-capital" ref={chart.ref} data-testid="ef-working-capital-chart"><span className="ef-chart-unit">{currency}</span><Legend series={series.map(series => ({ ...series, line: true }))} /><svg viewBox={`0 0 ${chart.width} ${height}`} role="img" aria-labelledby={`${chart.id}-title ${chart.id}-description`}><ChartTitle id={chart.id} title="Working capital trend" description={`Recorded working capital actual and plan in ${currency || 'the selected currency'}.`} /><Grid scale={scale} left={left} right={right} top={top} bottom={bottom} showValues={hasData} />{series.map(series => <g key={series.key}>{lines(rows, series.key).map((segment, segmentIndex) => <g key={segmentIndex}>{segment.length > 1 && <polyline points={segment.map(point => `${x(point.index)},${y(point.value)}`).join(' ')} fill="none" stroke={series.colour} strokeWidth="1.7" strokeDasharray={series.dashed ? '4 3' : undefined} />}{segment.map(point => {
    const title = `${monthParts(rows[point.index].month).join(' ')}, ${series.label}: ${money(point.value, currency)}`;
    return <circle key={point.index} className="ef-chart-mark" {...chart.mark(title)} cx={x(point.index)} cy={y(point.value)} r="2.7" fill={series.colour}><title>{title}</title></circle>;
  })}</g>)}</g>)}<MonthLabels rows={rows} x={x} y={height - 16} width={chart.width} /></svg>{!hasData && <EmptyState message="Working capital data not connected" />}<Tooltip text={chart.tooltip} /></div>;
}
WorkingCapitalChart.propTypes = { rows: PropTypes.arrayOf(PropTypes.shape({ month: PropTypes.string.isRequired, actual: numberProp, plan: numberProp })), currency: currencyProp };

/** Next-period invoicing, preserving the Finance approval or estimate basis. */
export function InvoiceOutlookChart({ rows = [], currency = 'AED', basis = 'unavailable' }) {
  const chart = useChart();
  const records = ['estimated', 'approved'].includes(basis) ? rows : [];
  const label = basis === 'estimated' ? 'Estimated invoicing' : basis === 'approved' ? 'Approved forecast' : 'Invoicing forecast';
  const colour = 'var(--ef-invoice-colour, #1672ef)';
  const height = 150, left = 43, right = chart.width - 12, top = 28, bottom = 117;
  const hasData = hasValues(records, ['value']);
  const scale = extent(records.map(row => row.value));
  const x = index => left + (index + 0.5) / Math.max(records.length, 1) * (right - left);
  const y = value => top + (scale.max - value) / (scale.max - scale.min) * (bottom - top);
  const description = basis === 'estimated'
    ? `Estimated invoice amounts for the next calendar months in ${currency}. Dashed lines indicate estimates, not an approved Finance forecast.`
    : `Finance-approved invoice forecast for the next calendar months in ${currency}.`;
  return <div className="ef-chart ef-chart-invoice-outlook" ref={chart.ref} data-testid="ef-invoice-outlook-chart" data-basis={basis}>
    <span className="ef-chart-unit">{currency}</span>
    {basis !== 'unavailable' && <Legend series={[{ label, colour, line: true, dashed: basis === 'estimated' }]} />}
    <svg viewBox={`0 0 ${chart.width} ${height}`} preserveAspectRatio="xMidYMid meet" role="img" aria-labelledby={`${chart.id}-title ${chart.id}-description`}>
      <ChartTitle id={chart.id} title={label} description={hasData ? description : `${label} unavailable.`} />
      <Grid scale={scale} left={left} right={right} top={top} bottom={bottom} showValues={hasData} />
      {lines(records, 'value').map((segment, segmentIndex) => <g key={segmentIndex}>
        {segment.length > 1 && <polyline points={segment.map(point => `${x(point.index)},${y(point.value)}`).join(' ')} fill="none" stroke={colour} strokeWidth="1.8" strokeDasharray={basis === 'estimated' ? '5 3' : undefined} />}
        {segment.map(point => {
          const title = `${monthParts(records[point.index].month).join(' ')}, ${label}: ${money(point.value, currency)}`;
          return <circle key={point.index} className="ef-chart-mark" {...chart.mark(title)} cx={x(point.index)} cy={y(point.value)} r="3.2" fill={colour} stroke="var(--cc-surface, #fff)" strokeWidth="1"><title>{title}</title></circle>;
        })}
      </g>)}
      <MonthLabels rows={records} x={x} y={height - 17} width={chart.width} />
    </svg>
    {!hasData && <EmptyState message={`${label} unavailable`} />}
    <Tooltip text={chart.tooltip} />
  </div>;
}
InvoiceOutlookChart.propTypes = { rows: PropTypes.arrayOf(PropTypes.shape({ month: PropTypes.string.isRequired, value: numberProp })), currency: currencyProp, basis: PropTypes.oneOf(['estimated', 'approved', 'unavailable']) };

function ReceivablesBars({ rows, currency, title, description, testId }) {
  const chart = useChart();
  const height = Math.max(150, rows.length * 19 + 45);
  const left = Math.min(146, chart.width * 0.34), right = chart.width - 76, top = 25, bottom = height - 37;
  const hasData = hasValues(rows, ['value']);
  const partial = rows.some(row => row.partial && numeric(row.value) !== null);
  const colour = 'var(--ef-invoice-colour, #1672ef)';
  const scale = extent(rows.map(row => row.value));
  const x = value => left + (value - scale.min) / (scale.max - scale.min) * (right - left);
  const slot = (bottom - top) / Math.max(rows.length, 1);
  return <div className="ef-chart ef-chart-receivables-bars" ref={chart.ref} data-testid={testId} style={{ '--ef-chart-height': `${height}px` }}>
    <span className="ef-chart-unit">{currency}</span><Legend series={[{ label: 'Current receivables', colour }]} />
    <svg viewBox={`0 0 ${chart.width} ${height}`} preserveAspectRatio="xMidYMid meet" role="img" aria-labelledby={`${chart.id}-title ${chart.id}-description`}>
      <ChartTitle id={chart.id} title={title} description={`${description} Amounts are in ${currency}. ${partial ? 'Asterisks mark known subtotals with missing balances excluded.' : ''}`} />
      {scale.ticks.map(tick => <g key={tick}><line className="ef-chart-vertical-grid" x1={x(tick)} x2={x(tick)} y1={top - 3} y2={bottom} />{hasData && <text className="ef-chart-category" x={x(tick)} y={height - 23} textAnchor="middle">{compact(tick)}</text>}</g>)}
      {rows.map((row, index) => {
        const value = numeric(row.value), y = top + slot * (index + 0.5);
        const label = `${row.label}, current receivables: ${money(value, currency)}${row.partial && value !== null ? '; known subtotal, missing balances excluded' : ''}`;
        return <g key={row.id || `${row.label}-${index}`}>
          <text className="ef-chart-business-name" x={left - 8} y={y + 3} textAnchor="end"><title>{row.label}</title>{short(row.label, chart.width < 380 ? 15 : 25)}</text>
          {value !== null && (value === 0
            ? <line className="ef-chart-mark" {...chart.mark(label)} x1={x(0)} x2={x(0)} y1={y - 4} y2={y + 4} stroke={colour} strokeWidth="2"><title>{label}</title></line>
            : <rect className="ef-chart-mark" {...chart.mark(label)} x={Math.min(x(0), x(value))} y={y - 4} width={Math.abs(x(value) - x(0))} height="8" fill={colour} fillOpacity={row.partial ? 0.75 : 1} rx="1"><title>{label}</title></rect>)}
          <text className="ef-chart-value" x={right + 9} y={y + 3}>{value === null ? '—' : `${compact(value)}${row.partial ? '*' : ''}`}</text>
        </g>;
      })}
    </svg>
    {!hasData && <EmptyState message="Receivables data unavailable" />}
    {partial && <p className="ef-chart-subtotal-note">* Known subtotals; missing balances excluded.</p>}
    <Tooltip text={chart.tooltip} />
  </div>;
}
const receivablesRowsProp = PropTypes.arrayOf(PropTypes.shape({ id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]), label: PropTypes.string.isRequired, value: numberProp, partial: PropTypes.bool }));
ReceivablesBars.propTypes = { rows: receivablesRowsProp.isRequired, currency: currencyProp.isRequired, title: PropTypes.string.isRequired, description: PropTypes.string.isRequired, testId: PropTypes.string.isRequired };

export function ReceivablesAgeingChart({ rows = [], currency = 'AED' }) {
  return <ReceivablesBars rows={rows} currency={currency} title="Current receivables ageing" description="Current outstanding invoice balances grouped by days past due; this is a current balance distribution, not a historical working-capital trend." testId="ef-receivables-ageing-chart" />;
}
ReceivablesAgeingChart.propTypes = { rows: receivablesRowsProp, currency: currencyProp };

export function CustomerReceivablesChart({ rows = [], currency = 'AED' }) {
  return <ReceivablesBars rows={rows} currency={currency} title="Receivables by client" description="Current outstanding invoice balances for the displayed clients; these are receivables, not business-unit revenue." testId="ef-customer-receivables-chart" />;
}
CustomerReceivablesChart.propTypes = { rows: receivablesRowsProp, currency: currencyProp };
