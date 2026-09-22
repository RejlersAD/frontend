import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { ArrowRightIcon, ChartBarIcon, ChartPieIcon, Cog6ToothIcon, CreditCardIcon, DocumentTextIcon, InformationCircleIcon, RectangleStackIcon, ShieldCheckIcon, UsersIcon, XMarkIcon } from '@heroicons/react/24/outline';
import financeService from '../../services/finance.service';
import { financeCount, financeDate, financeNumber } from '../../components/Finance/financeCommandPresentation';
import { receivableCollectionRoute, receivableRawValue, receivableReadable, receivableValue } from '../../components/Finance/financeReceivablesPresentation';
import { outgoingReviewMoney } from '../../components/Finance/outgoingReviewPresentation';
import { WorkbookSummaryCards, PaymentStatusSummary } from '../../components/Finance/WorkbookSummary';
import { unavailableFinancialMetric } from './financialPresentation';
import { financialInvoiceModel } from './financialInvoicePresentation';
import { invoiceMonthLabel } from './invoicePerformancePresentation';
import { RouteLink } from './ExecutivePrimitives';
import { InvoiceOutlookChart, CustomerReceivablesChart, ReceivablesAgeingChart } from './ExecutiveFinancialCharts';
import { CompanyPerformanceChart } from './OverviewCharts';
import PortfolioKpiGraphic from './PortfolioKpiGraphic';
import '../../components/Finance/FinanceCommandCenter.css';
import './ExecutiveFinancialBoard.css';

const count = value => financeCount(value)?.toLocaleString('en-GB') ?? '—';
const compact = (value, currency = '') => financeNumber(value) === null ? '—' : `${currency ? `${currency} ` : ''}${Number(value).toLocaleString('en-GB', { notation: Math.abs(Number(value)) >= 1000000 ? 'compact' : 'standard', maximumFractionDigits: Math.abs(Number(value)) >= 1000000 ? 1 : 2 }).replace(/[kmb]$/i, suffix => suffix.toUpperCase())}`;
const exact = (value, currency = '') => outgoingReviewMoney(value, 'AED').replace(/^AED /, currency ? `${currency} ` : '');
const metricMoney = (metric, currency) => `${compact(metric?.value, currency)}${metric?.status === 'partial' && financeNumber(metric?.value) !== null ? '*' : ''}`;
const cohortMoney = (metric, currency) => `${compact(metric?.amount ?? metric?.known_amount, currency)}${metric?.partial && financeNumber(metric?.known_amount) !== null ? '*' : ''}`;
const percent = value => financeNumber(value) === null ? '—' : `${Number(value).toLocaleString('en-GB', { maximumFractionDigits: 1 })}%`;

function PeriodToggle({ mode, onChange, label }) {
  return <div className="ef-period-toggle" role="group" aria-label={label}><button type="button" aria-pressed={mode === 'monthly'} onClick={() => onChange('monthly')}>Monthly</button><button type="button" aria-pressed={mode === 'ytd'} onClick={() => onChange('ytd')}>YTD</button></div>;
}
PeriodToggle.propTypes = { mode: PropTypes.string.isRequired, onChange: PropTypes.func.isRequired, label: PropTypes.string.isRequired };

function agedTotal(rows) {
  if (rows.length !== 2 || rows.some(row => receivableValue(row.receivables) === null)) return null;
  const cents = rows.reduce((total, row) => total + BigInt(exact(receivableRawValue(row.receivables)).replace(/[,.]/g, '')), 0n);
  return `${cents / 100n}.${String(cents % 100n).padStart(2, '0')}`;
}

function HourglassIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M5 3h14M5 21h14M7 3v4c0 2 3 4 5 5-2 1-5 3-5 5v4M17 3v4c0 2-3 4-5 5 2 1 5 3 5 5v4M8 18h8" /></svg>;
}

function Info({ title, description, onExplain, status = 'unavailable' }) {
  return <button type="button" className="ef-info" aria-label={`About ${title}`} onClick={() => onExplain({ ...unavailableFinancialMetric(title, title, description), status })}><InformationCircleIcon aria-hidden="true" /></button>;
}
Info.propTypes = { title: PropTypes.string.isRequired, description: PropTypes.string.isRequired, onExplain: PropTypes.func.isRequired, status: PropTypes.string };

function Panel({ title, icon: Icon, children, extra, description, onExplain, status, id, className = '' }) {
  return <section className={`ef-panel ${className}`} aria-label={title} id={id} tabIndex={id ? -1 : undefined}><header className="ef-panel-heading"><Icon aria-hidden="true" /><h2>{title}</h2>{extra}{description && <Info title={title} description={description} onExplain={onExplain} status={status} />}</header>{children}</section>;
}
Panel.propTypes = { title: PropTypes.string.isRequired, icon: PropTypes.elementType.isRequired, children: PropTypes.node, extra: PropTypes.node, description: PropTypes.string, onExplain: PropTypes.func, status: PropTypes.string, id: PropTypes.string, className: PropTypes.string };

function WorkbookDialog({ open, onClose, summary, loading }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement, dialog = ref.current;
    dialog?.showModal();
    return () => { dialog?.close(); if (previous instanceof HTMLElement && previous.isConnected) previous.focus(); };
  }, [open]);
  if (!open) return null;
  return <dialog ref={ref} className="ef-workbook-dialog" aria-labelledby="ef-workbook-title" onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <header><div><h2 id="ef-workbook-title">Workbook totals and payment status</h2><p>Recorded invoice amounts, currencies and project counts</p></div><button type="button" aria-label="Close workbook details" onClick={onClose}><XMarkIcon /></button></header>
    <div className="ar-dashboard ef-workbook-dialog-body"><WorkbookSummaryCards summary={summary} loading={loading} /><section className="ar-panel" aria-label="Payment status"><header className="ar-panel-heading"><h2>Payment status</h2><span>Full workbook</span></header><PaymentStatusSummary summary={summary} loading={loading} /></section></div>
    <footer><button type="button" className="cc-button" onClick={onClose}>Close</button></footer>
  </dialog>;
}
WorkbookDialog.propTypes = { open: PropTypes.bool.isRequired, onClose: PropTypes.func.isRequired, summary: PropTypes.object, loading: PropTypes.bool };

export default function FinancialPerformance({ currency = 'AED', refreshKey = 0, printing = false, onSnapshotChange, onExplain }) {
  const [data, setData] = useState(null), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [retry, setRetry] = useState(0), [mode, setMode] = useState('monthly'), [workbookOpen, setWorkbookOpen] = useState(false);
  const [month, setMonth] = useState('');
  const sequence = useRef(0);
  useEffect(() => {
    const request = ++sequence.current;
    setLoading(true); setData(null); setError('');
    financeService.getExecutiveReceivablesDashboard({ currency, months: '12' }).then(response => {
      if (request !== sequence.current) return;
      if (response?.schema_version !== '1.0' || !response.sources || !response.kpis || !Array.isArray(response.customers)) throw new Error('Incomplete financial response');
      setData(response);
      if (response.invoice_performance?.schema_version !== '1.0') setError('The server has not supplied invoice performance data. Refresh after the Finance service is updated; current workbook totals remain available.');
    }).catch(problem => {
      if (request === sequence.current) setError(problem?.response?.status === 403 ? 'You do not have access to the financial invoice summary.' : 'The financial invoice summary could not be loaded. Please try again.');
    }).finally(() => { if (request === sequence.current) setLoading(false); });
    return () => { sequence.current += 1; };
  }, [currency, refreshKey, retry]);
  const model = useMemo(() => financialInvoiceModel(loading ? null : data, currency, mode, month), [data, currency, loading, mode, month]);
  useLayoutEffect(() => { onSnapshotChange?.({ receivables: data?.currency === currency ? data : null, loading: loading || !!(data && data.currency !== currency), error,
    revenue: model.revenue, reporting_period: { mode, month: model.performance.selectedMonth }, source_description: 'Invoice-date performance and current receivables in their original currency.' }); }, [data, currency, loading, error, onSnapshotChange, model, mode]);

  const readable = !loading && data?.currency === currency && receivableReadable(data?.sources?.receivables);
  const summary = data?.workbook_summary;
  const workbookReadable = !loading && summary?.status === 'available' && summary?.schema_version === '1.0';
  const invoiceCount = workbookReadable ? financeCount(summary.invoice_count) : null;
  const revenue = model.revenue;
  const workbookNote = loading ? 'Loading workbook…' : summary?.status === 'restricted' ? 'Access restricted' : 'Workbook not available';
  const openWorkbook = () => setWorkbookOpen(true);
  const explain = (label, description) => onExplain(unavailableFinancialMetric(label, label, description));
  const cards = [
    { id: 'revenue', label: 'Invoiced revenue', icon: ChartBarIcon, tone: 'blue', value: metricMoney(revenue, currency), raw: revenue.value, note: model.note, explain: () => onExplain(revenue), graphic: 'contract_value', graphValues: model.performance.rows.map(row => row.invoiced), graphLabel: `Invoiced revenue by invoice month, ${mode === 'ytd' ? 'YTD' : 'Monthly'}, ${currency}`, graphColor: '#1674ff' },
    { id: 'total_amount', label: 'Total amount', icon: RectangleStackIcon, tone: 'violet', value: metricMoney(model.amount, currency), raw: model.amount.value, note: workbookReadable ? `All workbook periods · ${currency} invoice value${model.amount.status === 'partial' ? ' · known subtotal*' : ''}` : workbookNote, currencies: true, explain: () => onExplain(model.amount), graphic: 'contract_value', graphColor: '#7774f5' },
    { id: 'amount_received', label: 'Total amount received', icon: CreditCardIcon, tone: 'green', value: metricMoney(model.received, currency), raw: model.received.value, note: workbookReadable ? `All workbook periods · ${model.received.status === 'partial' ? 'known receipts*' : 'recorded receipts'}` : workbookNote, currencies: true, explain: () => onExplain(model.received), graphic: 'revenue_remaining', graphColor: '#00a977' },
    { id: 'amount_pending', label: 'Total amount pending', icon: HourglassIcon, tone: 'amber', value: metricMoney(model.pending, currency), raw: model.pending.value, note: model.receivablesReadable ? `${count(model.pendingSource?.count)} open invoices${model.pendingSource?.partial ? ' · known balance*' : ''}` : 'Current receivables unavailable', explain: () => onExplain(model.pending), graphic: 'forecast_margin', graphColor: '#f7a400' },
    { id: 'total_projects', label: 'Total projects', icon: UsersIcon, tone: 'blue', value: count(model.projectCount), note: workbookReadable ? 'Unique RAD project numbers · all currencies' : workbookNote, graphic: 'active_projects', graphColor: '#1674ff' },
  ];
  const overdue = readable ? data.kpis.overdue : null;
  const overdueAmount = receivableValue(overdue);
  const overdueText = `${compact(receivableRawValue(overdue), currency)}${overdue?.partial ? '*' : ''}`;
  const workbookMode = data?.sources?.receivables?.mode === 'workbook';
  const collectionRoute = workbookMode ? null : receivableCollectionRoute({ currency });
  const registerRoute = workbookMode ? null : `/finance/outgoing-invoices?${new URLSearchParams({ queue: 'all', currency })}`;
  const agedRows = readable ? (data.ageing || []).filter(row => ['days_61_90', 'over90'].includes(row.id)) : [];
  const agedPartial = agedRows.some(row => row.receivables?.partial);
  const missing = readable ? financeCount(data.kpis.unpaid?.missing_count) : null;
  const currencyIssues = workbookReadable ? (summary.currency_breakdown || []).filter(row => !row.currency).reduce((total, row) => total + (financeCount(row.coverage?.invoice_amount?.numeric_count) || 0) + (financeCount(row.coverage?.actual_payment_received?.numeric_count) || 0), 0) : 0;
  const actions = [
    ...(overdueAmount > 0 ? [{ label: 'Reduce overdue receivables', impact: overdueText, status: 'High', tone: 'high', route: collectionRoute }] : []),
    ...(missing > 0 ? [{ label: 'Complete invoice balances', impact: `${count(missing)} ${missing === 1 ? 'invoice' : 'invoices'}`, status: 'Review', tone: 'review', route: registerRoute }] : []),
    ...(currencyIssues > 0 ? [{ label: 'Review currency labels', impact: `${count(currencyIssues)} amount cells`, status: 'Review', tone: 'review', onClick: openWorkbook }] : []),
  ];
  const coverage = model.amountCoverage;
  const lastPerformance = model.performance.rows.at(-1);
  const approvedMargin = lastPerformance?.operating_margin;

  return <div className="financial-performance ef-board" data-testid="financial-performance" aria-busy={loading}>
    {error && <div className="ef-error" role="alert"><InformationCircleIcon /><span>{error}</span><button className="cc-button" type="button" onClick={() => setRetry(value => value + 1)}>Try again</button></div>}
    <section className="ef-kpis" aria-label="Financial performance indicators">{cards.map(({ id, label, icon: Icon, tone, value, raw, note, currencies, explain: explainCard, graphic, graphValues, graphLabel, graphColor }) => <article className={`ef-kpi ef-kpi-${tone}`} key={id} data-testid={`financial-kpi-${id}`}>
      <div className="ef-kpi-icon"><Icon aria-hidden="true" /></div><div className="ef-kpi-content"><div className="ef-kpi-heading"><h2>{label}</h2><button type="button" onClick={explainCard || openWorkbook} aria-label={`How ${label} is calculated`}><InformationCircleIcon aria-hidden="true" /><span>How calculated</span></button></div><strong className="ef-kpi-value" title={raw == null ? undefined : exact(raw, currency)}>{value}</strong><p>{note}</p>{id === 'revenue' && <PeriodToggle mode={mode} onChange={setMode} label="Invoiced revenue period" />}{currencies && <button className="ef-text-button ef-currency-detail" type="button" onClick={openWorkbook}>View currency breakdown<ArrowRightIcon /></button>}</div>
      <PortfolioKpiGraphic id={graphic} values={graphValues} label={graphLabel || label} color={graphColor} kind={id === 'total_projects' ? 'bars' : 'line'} />
    </article>)}</section>
    <p className="ef-scope-note">{currency === 'UNSPECIFIED' ? 'Unspecified currency' : currency} · Revenue: {model.performance.period}. Workbook totals: {workbookReadable ? <>all periods · {count(invoiceCount)} rows across currencies · Snapshot {financeDate(summary.source?.snapshot_at)}</> : workbookNote}. Receivables: {data?.as_of_date ? `current as of ${financeDate(data.as_of_date)}` : 'current snapshot'}. No currency conversion applied.</p>

    <section className={`ef-action-banner${overdueAmount > 0 ? '' : ' ef-banner-neutral'}`} aria-label="Executive financial priority"><span className="ef-priority-icon" aria-hidden="true">!</span><p><strong>{overdueAmount > 0 ? 'Executive action required:' : 'Receivables position:'}</strong> {loading ? 'Loading current balances…' : overdueAmount === null ? data?.sources?.receivables?.status === 'restricted' ? 'Access restricted' : 'Balances unavailable' : overdueAmount > 0 ? `${overdueText} overdue receivables` : 'No recorded overdue balance'}</p>{readable && <span className="ef-action-context">{count(overdue?.count)} invoices · Owner unassigned · Review not scheduled</span>}{readable && <RouteLink route={collectionRoute} className="cc-button cc-button--primary">Open receivables</RouteLink>}</section>
    {overdue?.partial && <p className="ef-basis-note">* Recorded subtotal; missing invoice balances are excluded.</p>}

    <div className="ef-panel-row ef-primary-row">
      <Panel title="Invoicing and collections" status={model.performance.status} icon={ChartBarIcon} description={model.performance.metric.description} onExplain={onExplain} extra={<div className="ef-invoice-period-controls"><select aria-label="Financial invoicing month" value={model.performance.selectedMonth} disabled={!model.performance.months.length} onChange={event => setMonth(event.target.value)}>{!model.performance.months.length && <option value="">No invoice periods</option>}{model.performance.months.map(value => <option key={value} value={value}>{invoiceMonthLabel(value)}</option>)}</select><PeriodToggle mode={mode} onChange={setMode} label="Revenue reporting period" /></div>}>
        <div className="ef-invoice-stats"><span>Collected against invoices <strong>{cohortMoney(model.performance.amounts.received, currency)}</strong></span><span>Outstanding <strong>{cohortMoney(model.performance.amounts.outstanding, currency)}</strong></span><span>Collection rate <strong>{percent(model.performance.collectionRate)}</strong></span></div>
        <CompanyPerformanceChart rows={model.performance.rows} currency={currency} mode={mode} />
        <div className="ef-finance-inputs"><button type="button" onClick={() => onExplain(model.performance.budget.metric)}><InformationCircleIcon />{lastPerformance?.budget != null ? `Approved budget: ${compact(lastPerformance.budget, currency)}` : model.performance.budget.status === 'restricted' ? 'Budget: access restricted' : model.performance.budget.status === 'error' ? 'Budget: source unavailable' : 'Budget: awaiting Finance plan'}</button><button type="button" onClick={() => onExplain(model.performance.margin.metric)}><InformationCircleIcon />{financeNumber(approvedMargin) !== null ? `Operating margin: ${percent(approvedMargin)}` : model.performance.margin.status === 'restricted' ? 'Operating margin: access restricted' : model.performance.margin.status === 'error' ? 'Operating margin: source unavailable' : 'Operating margin: awaiting matching Finance costs'}</button></div>
        <p className="ef-basis-note">{model.performance.period}. Invoiced value, not recognised accounting revenue. Current collections grouped by invoice month.{model.performance.partial && ' *Known incomplete subtotals; rates require complete amounts.'} {model.performance.coverageNote}{model.performance.latestInvoice && ` Latest invoice: ${financeDate(model.performance.latestInvoice)}.`}</p>
      </Panel>
      <Panel title="Invoicing outlook" status={model.forecast.basis} icon={DocumentTextIcon} description={model.forecast.description} onExplain={onExplain}>
        <div className="ef-forecast-stats ef-invoice-outlook-stats"><div><span>{model.forecast.partial ? 'Known forecast subtotal' : 'Next 12 months'}</span><strong>{compact(model.forecast.total, currency)}{model.forecast.partial ? '*' : ''}</strong></div><div><span>Basis</span><strong className="ef-confidence">{model.forecast.basis === 'estimated' ? 'Estimate · 3-month average' : model.forecast.basis === 'approved' ? 'Finance approved' : 'Awaiting Finance / history'}</strong></div><div><span>Months covered</span><strong>{model.forecast.coveredMonths} / 12</strong></div></div>
        <InvoiceOutlookChart rows={model.forecast.rows} currency={currency} basis={model.forecast.basis} />
        <p className="ef-basis-note">{model.forecast.basis === 'estimated' ? 'Illustrative estimate from the last three completed invoice months; not a Finance-approved plan.' : model.forecast.basis === 'approved' ? 'Approved Finance invoicing plan; unprovided months stay blank.' : model.forecast.description}{model.forecast.partial && ' *Only supplied forecast months are included.'}</p><button className="ef-text-button ef-panel-link" type="button" onClick={() => onExplain(model.forecast.metric)}>Review forecast assumptions<ArrowRightIcon /></button>
      </Panel>
    </div>
    <div className="ef-panel-row ef-secondary-row">
      <Panel title="Receivables by client" status={model.receivablesReadable ? model.pending.status : data?.sources?.receivables?.status || 'unavailable'} icon={RectangleStackIcon} description={model.definitions.customer} onExplain={onExplain}><CustomerReceivablesChart rows={printing ? model.customers : model.customers.slice(0, 6)} currency={currency} /><p className="ef-basis-note">{model.customers.length ? `${printing ? model.customers.length : Math.min(6, model.customers.length)} of ${model.customers.length} clients · Current outstanding balances.` : model.receivablesReadable ? 'No open client balances in this currency.' : 'Client balances unavailable.'} Business-unit financial attribution awaits Finance mapping.</p><RouteLink route={registerRoute} className="ef-text-button ef-panel-link">Open client balances<ArrowRightIcon /></RouteLink></Panel>
      <Panel title="Receivables ageing" status={model.receivablesReadable ? model.pending.status : data?.sources?.receivables?.status || 'unavailable'} icon={ChartPieIcon} description={model.definitions.ageing} onExplain={onExplain}>
        <div className="ef-cash-stats"><div><span>Receivables</span><strong>{metricMoney(model.pending, currency)}</strong></div><div><span>Over 60 days</span><strong>{compact(agedTotal(agedRows), currency)}{agedPartial ? '*' : ''}</strong></div><div><span>Overdue invoices</span><strong>{readable ? count(data.kpis.overdue?.count) : '—'}</strong></div><div><span>Missing due dates</span><strong>{readable ? count(data.sources.receivables.unknown_due_date_count) : '—'}</strong></div></div><ReceivablesAgeingChart rows={model.ageing} currency={currency} /><p className="ef-basis-note">{workbookMode ? data.definitions?.unpaid : 'Current collection register: blank receipts count as zero; missing invoice amounts remain unknown.'} This is not a cash balance or historical working-capital trend.</p>
      </Panel>
    </div>
    <div className="ef-panel-row ef-tertiary-row">
      <Panel title="Invoice collection priorities" status={model.receivablesReadable ? model.pending.status : data?.sources?.receivables?.status || 'unavailable'} icon={DocumentTextIcon} description={model.definitions.priorities} onExplain={onExplain}><div className="ef-table-scroll" role="region" aria-label="Invoice collection register" tabIndex={0}><table className="ef-table ef-invoice-table" data-table-typography="preserve"><thead><tr>{['Invoice', 'Client', 'Balance due', 'Due date', 'Days overdue', 'Project manager', 'Action'].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>{model.priorities.map(invoice => <tr key={invoice.id}><th scope="row" title={invoice.invoice_number}>{invoice.invoice_number || 'Not recorded'}</th><td title={invoice.customer}>{invoice.customer || 'Customer not recorded'}</td><td>{compact(invoice.balance, currency)}</td><td>{invoice.due_date ? financeDate(invoice.due_date) : 'Not recorded'}</td><td>{financeNumber(invoice.days_overdue) === null ? '—' : Number(invoice.days_overdue) > 0 ? count(invoice.days_overdue) : 'Current'}</td><td title={invoice.owner || ''}>{invoice.owner || 'Unassigned'}</td><td>{workbookMode || invoice.source_snapshot ? <span>Workbook row{invoice.source_row ? ` ${invoice.source_row}` : ''}</span> : <RouteLink className="ef-table-open" route={receivableCollectionRoute({ currency }, invoice.company || '').replace('queue=overdue', 'queue=open')}>Open</RouteLink>}</td></tr>)}</tbody></table>{!model.priorities.length && <p className="ef-empty-table">{model.receivablesReadable ? 'No open invoices recorded in this currency.' : 'Invoice register unavailable or access restricted.'}</p>}</div><p className="ef-basis-note">{model.priorities.length ? `Top ${model.priorities.length} of ${count(data?.priority_invoice_count)} open invoices by days past due and balance. ` : ''}Project profitability requires approved project revenue and matching costs.</p></Panel>
      <Panel title="Management actions" icon={ShieldCheckIcon} id="ef-management-actions"><div className="ef-table-scroll" role="region" aria-label="Financial management actions" tabIndex={0}><table className="ef-table ef-actions-table" data-table-typography="preserve"><thead><tr>{['#', 'Action', 'Impact', 'Owner', 'Due date', 'Status', 'Open'].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead><tbody>{actions.map((action, index) => <tr key={action.label}><td>{index + 1}</td><th scope="row">{action.label}</th><td className={action.tone === 'high' ? 'ef-danger' : ''}>{action.impact}</td><td>Unassigned</td><td>Not scheduled</td><td><span className={`ef-action-status ef-status-${action.tone}`}>{action.status}</span></td><td>{action.onClick ? <button className="ef-table-open" type="button" onClick={action.onClick} aria-label={`Open ${action.label}`}>Open</button> : workbookMode ? <span>Workbook source</span> : <RouteLink route={action.route} className="ef-table-open">Open</RouteLink>}</td></tr>)}</tbody></table>{!actions.length && <p className="ef-empty-table">{loading ? 'Reviewing financial priorities…' : readable ? 'No recorded financial actions in this view.' : 'Financial actions unavailable.'}</p>}</div></Panel>
    </div>
    <section className="ef-controls" aria-label="Financial controls"><div className="ef-controls-title"><Cog6ToothIcon /><h2>Financial controls</h2><Info title="Financial controls" description="Month-end close, bank balances, unbilled WIP and DSO are not connected. Invoice amount coverage measures numeric original-currency invoice cells within the selected verified currency group; it does not measure balance-sheet completeness. Business-unit and project profitability need approved mapping and matched costs." onExplain={onExplain} /></div><div><span>Month-end close</span><strong>Awaiting Finance</strong></div><div><span>Forecast basis</span><strong>{model.forecast.basis === 'approved' ? 'Finance approved' : model.forecast.basis === 'estimated' ? 'Estimate' : 'Awaiting Finance'}</strong></div><div><span>Currency conversion</span><strong>Not applied</strong></div><div className="ef-coverage-control"><span>{currency} invoice amount coverage</span>{coverage !== null && <i className="ef-control-track" aria-hidden="true"><b style={{ width: `${coverage}%` }} /></i>}<strong>{coverage === null ? '—' : `${coverage.toFixed(1)}%`}</strong></div><button type="button" className="ef-text-button" onClick={() => explain('Financial controls', 'Close, cash balances, WIP and DSO await Finance sources. Business-unit attribution and project profitability require approved financial mapping and matching costs. No exchange rates are assumed.')}>View financial controls<ArrowRightIcon /></button></section>
    <WorkbookDialog open={workbookOpen && !printing} onClose={() => setWorkbookOpen(false)} summary={summary} loading={loading} />
  </div>;
}
FinancialPerformance.propTypes = { report: PropTypes.object, currency: PropTypes.string, refreshKey: PropTypes.number, printing: PropTypes.bool, onSnapshotChange: PropTypes.func, onExplain: PropTypes.func.isRequired };
