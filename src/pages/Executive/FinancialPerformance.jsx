import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { ArrowRightIcon, ChartBarIcon, ChartPieIcon, Cog6ToothIcon, CreditCardIcon, DocumentTextIcon, InformationCircleIcon, RectangleStackIcon, ShieldCheckIcon, UsersIcon, XMarkIcon } from '@heroicons/react/24/outline';
import financeService from '../../services/finance.service';
import { financeCount, financeDate, financeNumber } from '../../components/Finance/financeCommandPresentation';
import { receivableCollectionRoute, receivableRawValue, receivableReadable, receivableValue } from '../../components/Finance/financeReceivablesPresentation';
import { outgoingReviewMoney } from '../../components/Finance/outgoingReviewPresentation';
import { WorkbookSummaryCards, PaymentStatusSummary } from '../../components/Finance/WorkbookSummary';
import { financialMetric, financialReport, unavailableFinancialMetric } from './financialPresentation';
import { portfolioReport } from './portfolioPresentation';
import { RouteLink } from './ExecutivePrimitives';
import { RevenueMarginChart, ForecastWaterfall, BusinessUnitBars, WorkingCapitalChart } from './ExecutiveFinancialCharts';
import '../../components/Finance/FinanceCommandCenter.css';
import './ExecutiveFinancialBoard.css';

const count = value => financeCount(value)?.toLocaleString('en-GB') ?? '—';
const compact = (value, currency = '') => financeNumber(value) === null ? '—' : `${currency ? `${currency} ` : ''}${Number(value).toLocaleString('en-GB', { notation: Math.abs(Number(value)) >= 1000000 ? 'compact' : 'standard', maximumFractionDigits: Math.abs(Number(value)) >= 1000000 ? 1 : 2 }).replace(/[kmb]$/i, suffix => suffix.toUpperCase())}`;
const exact = (value, currency = '') => outgoingReviewMoney(value, 'AED').replace(/^AED /, currency ? `${currency} ` : '');
const sourceReason = 'Approved revenue, budget and operating profit for a common reporting period are not connected.';
const forecastReason = 'An approved fiscal-year forecast, budget and forecast assumptions are not connected.';
const marginReason = 'Project names and owners come from the authorised project register. Recognised revenue, remaining cost and approved margin forecasts are not connected.';

function agedTotal(rows) {
  if (rows.length !== 2 || rows.some(row => receivableValue(row.receivables) === null)) return null;
  const cents = rows.reduce((total, row) => total + BigInt(exact(receivableRawValue(row.receivables)).replace(/[,.]/g, '')), 0n);
  return `${cents / 100n}.${String(cents % 100n).padStart(2, '0')}`;
}

function HourglassIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M5 3h14M5 21h14M7 3v4c0 2 3 4 5 5-2 1-5 3-5 5v4M17 3v4c0 2-3 4-5 5 2 1 5 3 5 5v4M8 18h8" /></svg>;
}

function Info({ title, description, onExplain }) {
  return <button type="button" className="ef-info" aria-label={`About ${title}`} onClick={() => onExplain(unavailableFinancialMetric(title, title, description))}><InformationCircleIcon aria-hidden="true" /></button>;
}
Info.propTypes = { title: PropTypes.string.isRequired, description: PropTypes.string.isRequired, onExplain: PropTypes.func.isRequired };

function Panel({ title, icon: Icon, children, extra, description, onExplain, id, className = '' }) {
  return <section className={`ef-panel ${className}`} aria-label={title} id={id} tabIndex={id ? -1 : undefined}><header className="ef-panel-heading"><Icon aria-hidden="true" /><h2>{title}</h2>{extra}{description && <Info title={title} description={description} onExplain={onExplain} />}</header>{children}</section>;
}
Panel.propTypes = { title: PropTypes.string.isRequired, icon: PropTypes.elementType.isRequired, children: PropTypes.node, extra: PropTypes.node, description: PropTypes.string, onExplain: PropTypes.func, id: PropTypes.string, className: PropTypes.string };

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

export default function FinancialPerformance({ report, currency = 'AED', refreshKey = 0, printing = false, onSnapshotChange, onExplain }) {
  const [data, setData] = useState(null), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [retry, setRetry] = useState(0), [mode, setMode] = useState('monthly'), [workbookOpen, setWorkbookOpen] = useState(false);
  const sequence = useRef(0);
  useEffect(() => {
    const request = ++sequence.current;
    setLoading(true); setData(null); setError('');
    financeService.getExecutiveReceivablesDashboard({ currency, months: '12' }).then(response => {
      if (request !== sequence.current) return;
      if (response?.schema_version !== '1.0' || !response.sources || !response.kpis || !Array.isArray(response.customers)) throw new Error('Incomplete financial response');
      setData(response);
    }).catch(problem => {
      if (request === sequence.current) setError(problem?.response?.status === 403 ? 'You do not have access to the financial invoice summary.' : 'The financial invoice summary could not be loaded. Please try again.');
    }).finally(() => { if (request === sequence.current) setLoading(false); });
    return () => { sequence.current += 1; };
  }, [currency, refreshKey, retry]);
  useLayoutEffect(() => { onSnapshotChange?.({ receivables: data?.currency === currency ? data : null, loading: loading || !!(data && data.currency !== currency), error }); }, [data, currency, loading, error, onSnapshotChange]);

  const readable = !loading && data?.currency === currency && receivableReadable(data?.sources?.receivables);
  const summary = data?.workbook_summary;
  const workbookReadable = !loading && summary?.status === 'available' && summary?.schema_version === '1.0';
  const totals = workbookReadable ? summary.totals : {};
  const statusRow = id => workbookReadable ? summary.payment_status?.find(row => row.id === id) : null;
  const paid = statusRow('paid'), pending = statusRow('pending');
  const invoiceCount = workbookReadable ? financeCount(summary.invoice_count) : null;
  const revenue = financialMetric(financialReport(report), 'revenue_ytd', currency);
  const revenueReadable = ['available', 'partial'].includes(revenue.status);
  const workbookNote = loading ? 'Loading workbook…' : summary?.status === 'restricted' ? 'Access restricted' : 'Workbook not available';
  const openWorkbook = () => setWorkbookOpen(true);
  const explain = (label, description) => onExplain(unavailableFinancialMetric(label, label, description));
  const cards = [
    { id: 'revenue', label: 'Revenue', icon: ChartBarIcon, tone: 'blue', value: compact(revenueReadable ? revenue.value : null, revenue.currency || currency), note: revenueReadable ? 'Recognised revenue' : 'Revenue source not connected', explain: () => onExplain(revenue) },
    { id: 'total_amount', label: 'Total amount', icon: RectangleStackIcon, tone: 'violet', value: compact(totals?.invoice_amount), note: workbookReadable ? `${compact(totals?.invoice_amount_aed, 'AED')} recorded subtotal` : workbookNote, currencies: true },
    { id: 'amount_received', label: 'Total amount received', icon: CreditCardIcon, tone: 'green', value: compact(totals?.actual_payment_received), note: workbookReadable ? `${count(paid?.count)} invoice rows marked paid` : workbookNote, currencies: true, progress: invoiceCount > 0 && financeCount(paid?.count) !== null ? paid.count / invoiceCount * 100 : null },
    { id: 'amount_pending', label: 'Total amount pending', icon: HourglassIcon, tone: 'amber', value: compact(pending?.amount_aed, 'AED'), note: workbookReadable ? `${count(pending?.count)} invoice rows marked pending` : workbookNote, progress: invoiceCount > 0 && financeCount(pending?.count) !== null ? pending.count / invoiceCount * 100 : null },
    { id: 'total_projects', label: 'Total projects', icon: UsersIcon, tone: 'blue', value: count(totals?.project_count), note: workbookReadable ? 'Unique RAD project numbers' : workbookNote },
  ];
  const overdue = readable ? data.kpis.overdue : null;
  const overdueAmount = receivableValue(overdue);
  const overdueText = `${compact(receivableRawValue(overdue), currency)}${overdue?.partial ? '*' : ''}`;
  const collectionRoute = receivableCollectionRoute({ currency });
  const registerRoute = collectionRoute.replace('queue=overdue', 'queue=all');
  const agedRows = readable ? (data.ageing || []).filter(row => ['days_61_90', 'over90'].includes(row.id)) : [];
  const agedPartial = agedRows.some(row => row.receivables?.partial);
  const portfolio = portfolioReport(report);
  const projectsReadable = ['available', 'partial'].includes(portfolio.register?.status);
  const projects = projectsReadable ? portfolio.register.projects || [] : [];
  const missing = readable ? financeCount(data.kpis.unpaid?.missing_count) : null;
  const currencyIssues = workbookReadable ? (summary.currency_breakdown || []).filter(row => !row.currency).reduce((total, row) => total + (financeCount(row.coverage?.invoice_amount?.numeric_count) || 0) + (financeCount(row.coverage?.actual_payment_received?.numeric_count) || 0), 0) : 0;
  const actions = [
    ...(overdueAmount > 0 ? [{ label: 'Reduce overdue receivables', impact: overdueText, status: 'High', tone: 'high', route: collectionRoute }] : []),
    ...(missing > 0 ? [{ label: 'Complete invoice balances', impact: `${count(missing)} ${missing === 1 ? 'invoice' : 'invoices'}`, status: 'Review', tone: 'review', route: registerRoute }] : []),
    ...(currencyIssues > 0 ? [{ label: 'Review currency labels', impact: `${count(currencyIssues)} amount cells`, status: 'Review', tone: 'review', onClick: openWorkbook }] : []),
  ];
  const numericAmounts = workbookReadable ? financeCount(summary.coverage?.invoice_amount_aed?.numeric_count) : null;
  const coverage = invoiceCount > 0 && numericAmounts !== null ? numericAmounts / invoiceCount * 100 : null;

  return <div className="financial-performance ef-board" data-testid="financial-performance" aria-busy={loading}>
    {error && <div className="ef-error" role="alert"><InformationCircleIcon /><span>{error}</span><button className="cc-button" type="button" onClick={() => setRetry(value => value + 1)}>Try again</button></div>}
    <section className="ef-kpis" aria-label="Financial performance indicators">{cards.map(({ id, label, icon: Icon, tone, value, note, progress, currencies, explain: explainCard }) => <article className={`ef-kpi ef-kpi-${tone}`} key={id} data-testid={`financial-kpi-${id}`}>
      <div className="ef-kpi-icon"><Icon aria-hidden="true" /></div><div className="ef-kpi-content"><div className="ef-kpi-heading"><h2>{label}</h2><button type="button" onClick={explainCard || openWorkbook} aria-label={`How ${label} is calculated`}><InformationCircleIcon aria-hidden="true" /><span>How calculated</span></button></div><strong className="ef-kpi-value" title={id === 'total_amount' ? exact(totals?.invoice_amount) : id === 'amount_received' ? exact(totals?.actual_payment_received) : id === 'amount_pending' ? exact(pending?.amount_aed, 'AED') : undefined}>{value}</strong><p>{note}</p>{progress !== null && progress !== undefined && <div className="ef-progress" role="img" aria-label={`${progress.toFixed(1)}% of workbook invoice rows`}><i style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} /></div>}{currencies && <button className="ef-text-button ef-currency-detail" type="button" onClick={openWorkbook}>View currency breakdown<ArrowRightIcon /></button>}</div>
    </article>)}</section>
    <p className="ef-scope-note">Invoice cards: {workbookReadable ? <>full workbook · {count(invoiceCount)} rows · Snapshot {financeDate(summary.source?.snapshot_at)}</> : workbookNote}. Receivables: {currency === 'UNSPECIFIED' ? 'unspecified currency' : currency} · {data?.as_of_date ? `As of ${financeDate(data.as_of_date)}` : 'Current snapshot'}. No currency conversion applied.</p>

    <section className={`ef-action-banner${overdueAmount > 0 ? '' : ' ef-banner-neutral'}`} aria-label="Executive financial priority"><span className="ef-priority-icon" aria-hidden="true">!</span><p><strong>{overdueAmount > 0 ? 'Executive action required:' : 'Receivables position:'}</strong> {loading ? 'Loading current balances…' : overdueAmount === null ? data?.sources?.receivables?.status === 'restricted' ? 'Access restricted' : 'Balances unavailable' : overdueAmount > 0 ? `${overdueText} overdue receivables` : 'No recorded overdue balance'}</p>{readable && <span className="ef-action-context">{count(overdue?.count)} invoices · Owner unassigned · Review not scheduled</span>}{readable && <RouteLink route={collectionRoute} className="cc-button cc-button--primary">Open receivables</RouteLink>}</section>
    {overdue?.partial && <p className="ef-basis-note">* Recorded subtotal; missing invoice balances are excluded.</p>}

    <div className="ef-panel-row ef-primary-row">
      <Panel title="Revenue and margin performance" icon={ChartBarIcon} description={sourceReason} onExplain={onExplain} extra={<div className="ef-period-toggle" role="group" aria-label="Revenue reporting period"><button type="button" aria-pressed={mode === 'monthly'} onClick={() => setMode('monthly')}>Monthly</button><button type="button" aria-pressed={mode === 'ytd'} onClick={() => setMode('ytd')}>YTD</button></div>}><RevenueMarginChart rows={[]} currency={currency} mode={mode} /></Panel>
      <Panel title="FY forecast" icon={DocumentTextIcon} description={forecastReason} onExplain={onExplain}><div className="ef-forecast-stats">{['Forecast revenue', 'Budget', 'Forecast profit', 'Forecast margin', 'Confidence'].map(label => <div key={label}><span>{label}</span>{label === 'Confidence' ? <strong className="ef-confidence">Not assessed</strong> : <strong>—</strong>}</div>)}</div><p className="ef-chart-caption">Revenue bridge ({currency})</p><ForecastWaterfall rows={[]} currency={currency} /><button className="ef-text-button ef-panel-link" type="button" onClick={() => explain('Forecast assumptions', forecastReason)}>Review forecast assumptions<ArrowRightIcon /></button></Panel>
    </div>
    <div className="ef-panel-row ef-secondary-row">
      <Panel title="Business unit performance" icon={RectangleStackIcon} description="Recognised revenue, approved budgets and operating margins by business unit are not connected." onExplain={onExplain}><BusinessUnitBars rows={[]} currency={currency} /></Panel>
      <Panel title="Cash & working capital" icon={ChartPieIcon} description="Receivables use Invoice Amount minus Actual Payment Received on unsettled invoices in the selected currency. Over 60 days uses due dates more than 60 days before the snapshot date. Blank payments count as zero; missing invoice amounts remain unknown. Treasury, unbilled work, credit sales and historical working-capital snapshots are not connected." onExplain={onExplain}>
        <div className="ef-cash-stats"><div><span>Receivables</span><strong>{compact(readable ? receivableRawValue(data.kpis.unpaid) : null, currency)}{readable && data.kpis.unpaid?.partial ? '*' : ''}</strong></div><div><span>Over 60 days</span><strong>{compact(agedTotal(agedRows), currency)}{agedPartial ? '*' : ''}</strong></div><div><span>Unbilled WIP</span><strong>—</strong></div><div><span>DSO</span><strong>—</strong></div></div><p className="ef-chart-caption">Working capital ({currency})</p><WorkingCapitalChart rows={[]} currency={currency} />{(agedPartial || (readable && data.kpis.unpaid?.partial)) && <p className="ef-basis-note">* Recorded subtotals; missing balances excluded.</p>}
      </Panel>
    </div>
    <div className="ef-panel-row ef-tertiary-row">
      <Panel title="Project margin exposure" icon={DocumentTextIcon} description={marginReason} onExplain={onExplain}><div className="ef-table-scroll" role="region" aria-label="Project margin register" tabIndex={0}><table className="ef-table ef-project-table" data-table-typography="preserve"><thead><tr>{['Project', 'Revenue remaining', 'Current margin', 'Forecast margin', 'Variance', 'Owner', 'Status', 'Action'].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>{(printing ? projects : projects.slice(0, 5)).map(project => <tr key={project.id}><th scope="row" title={project.name || project.project_name}>{project.name || project.project_name || project.project_code || 'Unnamed project'}</th><td>—</td><td>—</td><td>—</td><td>—</td><td title={project.owner || ''}>{project.owner || 'Unassigned'}</td><td>Not assessed</td><td><RouteLink className="ef-table-open" route={project.route}>Open</RouteLink></td></tr>)}</tbody></table>{!projects.length && <p className="ef-empty-table">{projectsReadable ? 'No projects recorded in this register.' : portfolio.register?.status === 'restricted' ? 'Project register access restricted.' : 'Project register unavailable.'}</p>}</div><p className="ef-basis-note">Project register · Margin reporting not connected</p></Panel>
      <Panel title="Management actions" icon={ShieldCheckIcon} id="ef-management-actions"><div className="ef-table-scroll" role="region" aria-label="Financial management actions" tabIndex={0}><table className="ef-table ef-actions-table" data-table-typography="preserve"><thead><tr>{['#', 'Action', 'Impact', 'Owner', 'Due date', 'Status', 'Open'].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead><tbody>{actions.map((action, index) => <tr key={action.label}><td>{index + 1}</td><th scope="row">{action.label}</th><td className={action.tone === 'high' ? 'ef-danger' : ''}>{action.impact}</td><td>Unassigned</td><td>Not scheduled</td><td><span className={`ef-action-status ef-status-${action.tone}`}>{action.status}</span></td><td>{action.onClick ? <button className="ef-table-open" type="button" onClick={action.onClick} aria-label={`Open ${action.label}`}>Open</button> : <RouteLink route={action.route} className="ef-table-open">Open</RouteLink>}</td></tr>)}</tbody></table>{!actions.length && <p className="ef-empty-table">{loading ? 'Reviewing financial priorities…' : readable ? 'No recorded financial actions in this view.' : 'Financial actions unavailable.'}</p>}</div></Panel>
    </div>
    <section className="ef-controls" aria-label="Financial controls"><div className="ef-controls-title"><Cog6ToothIcon /><h2>Financial controls</h2><Info title="Financial controls" description="Month-end close and forecast submission workflows are not connected. No currency conversion is applied. Invoice amount coverage measures numeric recorded AED amount cells divided by all workbook invoice rows; it does not measure the completeness of the balance sheet." onExplain={onExplain} /></div><div><span>Month-end close</span><strong>Not connected</strong></div><div><span>Forecast submissions</span><strong>Not connected</strong></div><div><span>Currency conversion</span><strong>Not applied</strong></div><div className="ef-coverage-control"><span>Invoice amount coverage</span>{coverage !== null && <i className="ef-control-track" aria-hidden="true"><b style={{ width: `${coverage}%` }} /></i>}<strong>{coverage === null ? '—' : `${coverage.toFixed(1)}%`}</strong></div><button type="button" className="ef-text-button" onClick={() => explain('Financial controls', 'Close and forecast workflows are not connected. Invoice amount coverage is the count of numeric Inv Amt. (AED) cells divided by full workbook invoice rows. Blank, text and error cells are excluded. No exchange rates are assumed.')}>View financial controls<ArrowRightIcon /></button></section>
    <WorkbookDialog open={workbookOpen && !printing} onClose={() => setWorkbookOpen(false)} summary={summary} loading={loading} />
  </div>;
}
FinancialPerformance.propTypes = { report: PropTypes.object, currency: PropTypes.string, refreshKey: PropTypes.number, printing: PropTypes.bool, onSnapshotChange: PropTypes.func, onExplain: PropTypes.func.isRequired };
