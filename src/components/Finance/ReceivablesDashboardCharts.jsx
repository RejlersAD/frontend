import { useEffect, useId, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import './ReceivablesDashboardCharts.css';

const COLOURS = ['#00769e', '#2fb9de', '#91d7ef', '#b5ddfb', '#d4e9fa', '#809bcc'];
const SERIES = [{ key: 'invoices', label: 'Invoices', colour: '#05b8c7' }, { key: 'bills', label: 'Bills', colour: '#5066dc' }];
const finite = value => typeof value === 'number' && Number.isFinite(value);
const number = value => new Intl.NumberFormat('en-GB', { maximumFractionDigits: 2 }).format(value);
const compact = value => new Intl.NumberFormat('en-GB', { notation: 'compact', maximumFractionDigits: 1 }).format(value).replace(/k$/, 'K');
const money = (value, currency) => finite(value) ? `${currency} ${number(value)}` : 'Not recorded';
const thousands = value => number(value / 1000);
const shorten = (value, length) => value.length > length ? `${value.slice(0, length - 1)}…` : value;

function monthParts(month) {
  const value = String(month || '');
  if (!/^\d{4}-\d{2}(?:-\d{2})?$/.test(value)) return [value, ''];
  const date = new Date(`${value.slice(0, 7)}-01T12:00:00`);
  if (!Number.isFinite(date.getTime())) return [value, ''];
  return [date.toLocaleDateString('en-GB', { month: 'short' }).replace('Sept', 'Sep'), String(date.getFullYear())];
}

function scaleFor(values, tickCount = 4) {
  const recorded = values.filter(finite);
  const min = Math.min(0, ...recorded);
  const max = Math.max(0, ...recorded);
  const roughStep = (max - min || 1000) / tickCount;
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const step = [1, 2, 2.5, 5, 10].find(option => option * magnitude >= roughStep) * magnitude;
  const lower = Math.floor(min / step) * step;
  const upper = max === min ? lower + step * tickCount : Math.ceil(max / step) * step;
  const ticks = Array.from({ length: Math.round((upper - lower) / step) + 1 }, (_, index) => lower + index * step);
  return { min: lower, max: upper, ticks };
}

function useChart() {
  const ref = useRef(null);
  const [width, setWidth] = useState(600);
  const [tooltip, setTooltip] = useState(null);
  const id = useId().replace(/:/g, '');
  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    const measure = () => setWidth(Math.max(240, Math.round(element.getBoundingClientRect().width)));
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const mark = label => ({
    tabIndex: 0,
    role: 'img',
    'aria-label': label,
    onMouseEnter: () => setTooltip(label),
    onMouseLeave: () => setTooltip(null),
    onFocus: () => setTooltip(label),
    onBlur: () => setTooltip(null),
    onKeyDown: event => { if (event.key === 'Escape') setTooltip(null); },
  });
  return { ref, width, id, tooltip, mark };
}

function ChartEmpty({ children }) {
  return <div className="ar-chart-empty"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 4v16h16M8 15v-4m5 4V7m5 8v-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg><span>{children}</span></div>;
}
ChartEmpty.propTypes = { children: PropTypes.node.isRequired };

function ChartOverlay({ tooltip, partial }) {
  return <>{tooltip && <div className="ar-chart-tooltip" role="tooltip">{tooltip}</div>}{partial && <span className="ar-chart-recorded">Recorded balances only</span>}</>;
}
ChartOverlay.propTypes = { tooltip: PropTypes.string, partial: PropTypes.bool };

function Legend({ series = SERIES, line = false }) {
  return <ul className={`ar-chart-legend${line ? ' ar-chart-legend-lines' : ''}`} aria-label="Chart series">{series.map(item => <li key={item.key}><i style={{ '--ar-series': item.colour }} aria-hidden="true" />{item.label}</li>)}</ul>;
}
Legend.propTypes = { series: PropTypes.arrayOf(PropTypes.object), line: PropTypes.bool };

function SvgTitle({ id, title, description }) {
  return <><title id={`${id}-title`}>{title}</title><desc id={`${id}-description`}>{description} Hover over or focus a chart mark for the exact recorded amount.</desc></>;
}
SvgTitle.propTypes = { id: PropTypes.string.isRequired, title: PropTypes.string.isRequired, description: PropTypes.string.isRequired };

export function CustomerBalancesChart({ rows = [], currency = 'AED', partial = false }) {
  const chart = useChart();
  const data = rows.slice(0, 5);
  const height = 186;
  const left = Math.min(145, chart.width * 0.28);
  const right = 61;
  const top = 24;
  const bottom = height - 22;
  const scale = scaleFor(data.map(row => row.amount), 6);
  const x = value => left + (value - scale.min) / (scale.max - scale.min) * (chart.width - left - right);
  const slot = (bottom - top) / Math.max(data.length, 1);
  const barHeight = Math.min(19, slot * 0.72);
  const hasData = data.some(row => finite(row.amount));
  return <div className="ar-chart ar-chart-customers" ref={chart.ref} data-testid="ar-customer-balances-chart">
    {hasData ? <><span className="ar-chart-unit">{currency} &apos;000</span><svg viewBox={`0 0 ${chart.width} ${height}`} role="img" aria-labelledby={`${chart.id}-title ${chart.id}-description`}>
      <SvgTitle id={chart.id} title={`Unpaid amount by customer in ${currency}`} description="Up to five customers with the largest recorded unpaid balances. Axis values are in thousands. Missing balances are labelled as not recorded." />
      <defs><linearGradient id={`${chart.id}-bar`} x1="0" x2="1"><stop offset="0%" stopColor="#33bdd1" /><stop offset="100%" stopColor="#22bdd6" /></linearGradient></defs>
      {scale.ticks.map(tick => <g className="ar-chart-grid" key={tick}><line x1={x(tick)} x2={x(tick)} y1={top - 3} y2={bottom} /><text x={x(tick)} y={height - 5} textAnchor="middle">{thousands(tick)}</text></g>)}
      <line className="ar-chart-baseline" x1={left} x2={chart.width - right} y1={bottom} y2={bottom} />
      {data.map((row, index) => {
        const y = top + slot * (index + 0.5);
        const recorded = finite(row.amount);
        const label = `${row.customer}: ${money(row.amount, currency)}`;
        return <g key={`${row.customer}-${index}`} className="ar-chart-customer-row">
          <text className="ar-chart-customer-label" x={left - 11} y={y + 4} textAnchor="end"><title>{row.customer}</title>{shorten(String(row.customer), chart.width < 450 ? 17 : 25)}</text>
          {recorded && <rect className="ar-chart-mark" {...chart.mark(label)} x={Math.min(x(0), x(row.amount))} y={y - barHeight / 2} width={Math.max(row.amount === 0 ? 1 : 0, Math.abs(x(row.amount) - x(0)))} height={barHeight} fill={`url(#${chart.id}-bar)`}><title>{label}</title></rect>}
          <text className="ar-chart-value" x={recorded ? x(Math.max(0, row.amount)) + 9 : left + 9} y={y + 4}>{recorded ? number(row.amount) : '—'}</text>
        </g>;
      })}
    </svg></> : <ChartEmpty>No recorded customer balances for these filters</ChartEmpty>}
    <ChartOverlay tooltip={chart.tooltip} partial={partial} />
  </div>;
}
CustomerBalancesChart.propTypes = { rows: PropTypes.arrayOf(PropTypes.shape({ customer: PropTypes.string.isRequired, amount: PropTypes.number })), currency: PropTypes.string, partial: PropTypes.bool };

export function ExposureDonut({ rows = [], total, currency = 'AED', partial = false }) {
  const chart = useChart();
  const signedBalances = rows.some(row => finite(row.amount) && row.amount < 0);
  const recorded = rows.slice(0, 5).filter(row => finite(row.amount) && row.amount > 0);
  const recordedTotal = recorded.reduce((sum, row) => sum + row.amount, 0);
  const denominator = finite(total) && total > recordedTotal ? total : recordedTotal;
  const remainder = denominator - recordedTotal;
  const data = remainder > 0.005 ? [...recorded, { customer: 'Other customers', amount: remainder }] : recorded;
  const circumference = 2 * Math.PI * 65;
  let offset = 0;
  return <div className="ar-chart ar-chart-exposure" ref={chart.ref} data-testid="ar-exposure-chart">
    {signedBalances ? <ChartEmpty>Negative customer balances are included in unpaid totals. See the customer balances and ageing summary; percentage shares do not apply.</ChartEmpty> : denominator > 0 ? <div className="ar-chart-donut-layout"><svg className="ar-chart-donut" viewBox="0 0 238 186" role="img" aria-labelledby={`${chart.id}-title ${chart.id}-description`}>
      <SvgTitle id={chart.id} title={`Customer exposure concentration in ${currency}`} description={`Shares of ${money(denominator, currency)} in ${partial ? 'recorded' : 'unpaid'} customer balances. Any remaining balance is shown as other customers.`} />
      {data.map((row, index) => {
        const share = row.amount / denominator;
        const part = share * circumference;
        const start = offset;
        const angle = (start + part / 2) / circumference * Math.PI * 2 - Math.PI / 2;
        offset += part;
        const percentage = `${number(share * 100)}%`;
        const label = `${row.customer}: ${money(row.amount, currency)}, ${percentage} of ${partial ? 'recorded' : 'total'} unpaid`;
        return <g key={`${row.customer}-${index}`}>
          <circle className="ar-chart-mark ar-chart-donut-segment" {...chart.mark(label)} cx="116" cy="94" r="65" fill="none" stroke={COLOURS[index % COLOURS.length]} strokeWidth="44" strokeDasharray={`${Math.max(0, part - (data.length > 1 ? 1.1 : 0))} ${circumference}`} strokeDashoffset={-start} transform="rotate(-90 116 94)"><title>{label}</title></circle>
          {share >= 0.065 && <text className={`ar-chart-donut-share${index < 2 ? ' ar-chart-donut-share-light' : ''}`} x={116 + Math.cos(angle) * 66} y={97 + Math.sin(angle) * 66} textAnchor="middle">{(share * 100).toFixed(1)}%</text>}
        </g>;
      })}
      <text className="ar-chart-donut-total" x="116" y="91" textAnchor="middle">{currency} {compact(denominator)}</text>
      <text className="ar-chart-donut-caption" x="116" y="107" textAnchor="middle">{partial ? 'recorded unpaid' : 'total unpaid'}</text>
    </svg><ul className="ar-chart-exposure-legend" aria-label="Customer shares">{data.map((row, index) => <li key={`${row.customer}-${index}`} {...chart.mark(`${row.customer}: ${money(row.amount, currency)}, ${(row.amount / denominator * 100).toFixed(1)}%`)} role="listitem"><i style={{ backgroundColor: COLOURS[index % COLOURS.length] }} aria-hidden="true" /><span title={row.customer}>{row.customer}</span><strong>{(row.amount / denominator * 100).toFixed(1)}%</strong></li>)}</ul></div> : <ChartEmpty>No unpaid customer balances to display</ChartEmpty>}
    <ChartOverlay tooltip={chart.tooltip} partial={partial} />
  </div>;
}
ExposureDonut.propTypes = { rows: PropTypes.arrayOf(PropTypes.shape({ customer: PropTypes.string.isRequired, amount: PropTypes.number, share: PropTypes.number })), total: PropTypes.number, currency: PropTypes.string, partial: PropTypes.bool };

function VerticalGrid({ ticks, y, left, right }) {
  return <>{ticks.map(tick => <g className="ar-chart-grid" key={tick}><line x1={left} x2={right} y1={y(tick)} y2={y(tick)} /><text x={left - 6} y={y(tick) + 3} textAnchor="end">{thousands(tick)}</text></g>)}</>;
}
VerticalGrid.propTypes = { ticks: PropTypes.arrayOf(PropTypes.number).isRequired, y: PropTypes.func.isRequired, left: PropTypes.number.isRequired, right: PropTypes.number.isRequired };

export function AgeingComparisonChart({ rows = [], currency = 'AED', partial = false }) {
  const chart = useChart();
  const height = 125;
  const top = 24;
  const bottom = height - 23;
  const left = 39;
  const right = chart.width - 12;
  const scale = scaleFor(rows.flatMap(row => [row.invoices, row.bills]));
  const y = value => top + (scale.max - value) / (scale.max - scale.min) * (bottom - top);
  const slot = (right - left) / Math.max(rows.length, 1);
  const barWidth = Math.min(42, slot * 0.33);
  const hasData = rows.some(row => finite(row.invoices) || finite(row.bills));
  return <div className="ar-chart ar-chart-ageing" ref={chart.ref} data-testid="ar-ageing-comparison-chart">
    {hasData ? <><span className="ar-chart-unit">{currency} &apos;000</span><Legend /><svg viewBox={`0 0 ${chart.width} ${height}`} role="img" aria-labelledby={`${chart.id}-title ${chart.id}-description`}>
      <SvgTitle id={chart.id} title={`Ageing by due period in ${currency}`} description="Invoices and bills grouped by days past due. Values are in thousands. Unrecorded series leave gaps." />
      <VerticalGrid ticks={scale.ticks} y={y} left={left} right={right} />
      <line className="ar-chart-baseline" x1={left} x2={right} y1={y(0)} y2={y(0)} />
      {rows.map((row, index) => <g key={row.id || row.label}>
        {SERIES.map((series, seriesIndex) => {
          const amount = row[series.key];
          if (!finite(amount)) return null;
          const x = left + slot * (index + 0.5) + (seriesIndex - 1) * barWidth;
          const label = `${row.label}, ${series.label}: ${money(amount, currency)}`;
          return <g key={series.key}><rect className="ar-chart-mark" {...chart.mark(label)} x={x} y={Math.min(y(0), y(amount))} width={Math.max(1, barWidth - 1)} height={Math.max(amount === 0 ? 1 : 0, Math.abs(y(amount) - y(0)))} fill={series.colour}><title>{label}</title></rect>
            <text className="ar-chart-bar-label" x={x + barWidth / 2} y={amount < 0 ? y(amount) + 11 : y(amount) - 6} textAnchor="middle">{(amount / 1000).toFixed(1)}</text></g>;
        })}
        <text className="ar-chart-axis-label" x={left + slot * (index + 0.5)} y={height - 6} textAnchor="middle">{row.label}</text>
      </g>)}
    </svg></> : <ChartEmpty>No recorded ageing balances for these filters</ChartEmpty>}
    <ChartOverlay tooltip={chart.tooltip} partial={partial} />
  </div>;
}
AgeingComparisonChart.propTypes = { rows: PropTypes.arrayOf(PropTypes.shape({ id: PropTypes.string, label: PropTypes.string.isRequired, invoices: PropTypes.number, bills: PropTypes.number })), currency: PropTypes.string, partial: PropTypes.bool };

function segments(rows, key) {
  const result = [];
  let current = [];
  rows.forEach((row, index) => {
    if (finite(row[key])) current.push({ index, value: row[key], month: row.month });
    else if (current.length) { result.push(current); current = []; }
  });
  if (current.length) result.push(current);
  return result;
}

export function OverdueTrendChart({ rows = [], currency = 'AED', partial = false }) {
  const chart = useChart();
  const height = 125;
  const top = 23;
  const bottom = height - 32;
  const left = 40;
  const right = chart.width - 37;
  const scale = scaleFor(rows.flatMap(row => [row.invoices, row.bills]));
  const x = index => left + index / Math.max(rows.length - 1, 1) * (right - left);
  const y = value => top + (scale.max - value) / (scale.max - scale.min) * (bottom - top);
  const tickEvery = Math.max(1, Math.ceil(rows.length / (chart.width < 450 ? 6 : 13)));
  const hasData = rows.some(row => finite(row.invoices) || finite(row.bills));
  const lastRow = rows[rows.length - 1];
  return <div className="ar-chart ar-chart-trend" ref={chart.ref} data-testid="ar-overdue-trend-chart">
    {hasData ? <><span className="ar-chart-unit">{currency} &apos;000</span><Legend line /><svg viewBox={`0 0 ${chart.width} ${height}`} role="img" aria-labelledby={`${chart.id}-title ${chart.id}-description`}>
      <SvgTitle id={chart.id} title={`Current overdue amount by due month in ${currency}`} description="Current recorded overdue invoice and bill balances grouped by contractual due month. This is not a history of month-end balances. Axis values are in thousands. Unrecorded amounts leave gaps." />
      <VerticalGrid ticks={scale.ticks} y={y} left={left} right={right} />
      {rows.map((row, index) => <line key={`${row.month}-${index}`} className="ar-chart-vertical-grid" x1={x(index)} x2={x(index)} y1={top} y2={bottom} />)}
      <line className="ar-chart-baseline" x1={left} x2={right} y1={y(0)} y2={y(0)} />
      {SERIES.map(series => <g key={series.key}>
        {segments(rows, series.key).map((segment, index) => <g key={index}>
          {segment.length > 1 && <><polygon points={`${x(segment[0].index)},${y(0)} ${segment.map(point => `${x(point.index)},${y(point.value)}`).join(' ')} ${x(segment[segment.length - 1].index)},${y(0)}`} fill={series.colour} opacity="0.09" /><polyline points={segment.map(point => `${x(point.index)},${y(point.value)}`).join(' ')} fill="none" stroke={series.colour} strokeWidth="1.5" /></>}
          {segment.map(point => {
            const label = `Due ${monthParts(point.month).join(' ')}, ${series.label}: ${money(point.value, currency)} currently overdue`;
            return <circle className="ar-chart-mark" {...chart.mark(label)} key={point.index} cx={x(point.index)} cy={y(point.value)} r="3.1" fill={series.colour}><title>{label}</title></circle>;
          })}
        </g>)}
      </g>)}
      {SERIES.map((series, index) => {
        if (!lastRow || !finite(lastRow[series.key])) return null;
        const isClose = finite(lastRow.invoices) && finite(lastRow.bills) && Math.abs(y(lastRow.invoices) - y(lastRow.bills)) < 18;
        const labelY = Math.max(4, Math.min(bottom - 15, y(lastRow[series.key]) - 20 + (isClose && index === 0 ? 19 : 0)));
        return <g key={series.key} className="ar-chart-endpoint"><rect x={right - 1} y={labelY} width="38" height="16" rx="3" fill={series.colour} /><text x={right + 18} y={labelY + 11.5} textAnchor="middle">{compact(lastRow[series.key])}</text></g>;
      })}
      {rows.map((row, index) => {
        if (index % tickEvery !== 0 && index !== rows.length - 1) return null;
        const [month, year] = monthParts(row.month);
        return <text className="ar-chart-axis-label" key={`${row.month}-${index}`} x={x(index)} y={height - 17} textAnchor="middle"><tspan x={x(index)}>{month}</tspan><tspan x={x(index)} dy="11">{year}</tspan></text>;
      })}
    </svg></> : <ChartEmpty>No recorded overdue balances by due month</ChartEmpty>}
    <ChartOverlay tooltip={chart.tooltip} partial={partial} />
  </div>;
}
OverdueTrendChart.propTypes = { rows: PropTypes.arrayOf(PropTypes.shape({ month: PropTypes.string.isRequired, invoices: PropTypes.number, bills: PropTypes.number })), currency: PropTypes.string, partial: PropTypes.bool };

export function PaymentHistoryChart({ rows = [], currency = 'AED', partial = false }) {
  const chart = useChart();
  const height = 300;
  const top = 30;
  const bottom = height - 32;
  const left = 39;
  const right = chart.width - 12;
  const unpaidBase = row => finite(row.paid) && row.paid * row.unpaid >= 0 ? row.paid : 0;
  const scale = scaleFor(rows.flatMap(row => [row.paid, finite(row.unpaid) ? unpaidBase(row) + row.unpaid : null]), 3);
  const y = value => top + (scale.max - value) / (scale.max - scale.min) * (bottom - top);
  const slot = (right - left) / Math.max(rows.length, 1);
  const barWidth = Math.min(71, slot * 0.72);
  const hasData = rows.some(row => finite(row.paid) || finite(row.unpaid));
  const tickEvery = Math.max(1, Math.ceil(rows.length / Math.max(1, Math.floor((right - left) / 48))));
  return <div className="ar-chart ar-chart-payments" ref={chart.ref} data-testid="ar-payment-history-chart">
    {hasData ? <><span className="ar-chart-unit">{currency} &apos;000</span><Legend series={[{ key: 'paid', label: 'Paid', colour: '#4aa8fa' }, { key: 'unpaid', label: 'Unpaid', colour: '#c4d9e7' }]} /><svg viewBox={`0 0 ${chart.width} ${height}`} role="img" aria-labelledby={`${chart.id}-title ${chart.id}-description`}>
      <SvgTitle id={chart.id} title={`Paid and unpaid invoices by issue month in ${currency}`} description="Recorded payments and current unpaid balances grouped by invoice issue month. This is not a cash receipts timeline. Values are in thousands. Unrecorded amounts are omitted; their absence does not mean zero." />
      <VerticalGrid ticks={scale.ticks} y={y} left={left} right={right} />
      <line className="ar-chart-baseline" x1={left} x2={right} y1={y(0)} y2={y(0)} />
      {rows.map((row, index) => {
        const x = left + slot * (index + 0.5);
        const paid = finite(row.paid) ? row.paid : 0;
        const base = unpaidBase(row);
        const [month, year] = monthParts(row.month);
        return <g key={`${row.month}-${index}`}>
          {finite(row.paid) && <rect className="ar-chart-mark" {...chart.mark(`Invoices issued ${month} ${year}, recorded payments: ${money(row.paid, currency)}`)} x={x - barWidth / 2} y={Math.min(y(paid), y(0))} width={barWidth} height={Math.max(paid === 0 ? 1 : 0, Math.abs(y(0) - y(paid)))} fill="#4aa8fa" stroke="var(--ar-panel, white)" strokeWidth="0.75"><title>{`Invoices issued ${month} ${year}, recorded payments: ${money(row.paid, currency)}`}</title></rect>}
          {finite(row.unpaid) && <rect className="ar-chart-mark" {...chart.mark(`Invoices issued ${month} ${year}, currently unpaid: ${money(row.unpaid, currency)}${finite(row.paid) ? '' : '; payments not recorded'}`)} x={x - barWidth / 2} y={Math.min(y(base + row.unpaid), y(base))} width={barWidth} height={Math.max(row.unpaid === 0 ? 1 : 0, Math.abs(y(base) - y(base + row.unpaid)))} fill="#c4d9e7" stroke="var(--ar-panel, white)" strokeWidth="0.75"><title>{`Invoices issued ${month} ${year}, currently unpaid: ${money(row.unpaid, currency)}`}</title></rect>}
          {((index % tickEvery === 0 && index <= rows.length - 1 - tickEvery / 2) || index === rows.length - 1) && <text className="ar-chart-axis-label" x={x} y={height - 17} textAnchor="middle"><tspan x={x}>{month}</tspan><tspan x={x} dy="11">{year}</tspan></text>}
        </g>;
      })}
    </svg></> : <ChartEmpty>No recorded payments or unpaid balances by invoice issue month</ChartEmpty>}
    <ChartOverlay tooltip={chart.tooltip} partial={partial} />
  </div>;
}
PaymentHistoryChart.propTypes = { rows: PropTypes.arrayOf(PropTypes.shape({ month: PropTypes.string.isRequired, paid: PropTypes.number, unpaid: PropTypes.number })), currency: PropTypes.string, partial: PropTypes.bool };
