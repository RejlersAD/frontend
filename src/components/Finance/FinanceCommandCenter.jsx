import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { ArrowDownTrayIcon, ArrowPathIcon, ArrowRightIcon, CalendarDaysIcon, ChevronDownIcon, EllipsisHorizontalIcon, InformationCircleIcon, UserIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { ExclamationTriangleIcon } from '@heroicons/react/24/solid';
import financeService from '../../services/finance.service';
import { financeCount, financeDate, financeNumber } from './financeCommandPresentation';
import { RECEIVABLE_AGES, RECEIVABLE_KPIS, receivableAlert, receivableChartRows, receivableCollectionRoute, receivableCustomer, receivableCustomerRows, receivableDate, receivableMetricNote, receivableMoney, receivableNumber, receivableRawValue, receivableReadable, receivablesCsv, receivablesToday, receivableValue } from './financeReceivablesPresentation';
import { CustomerBalancesChart, ExposureDonut, OverdueTrendChart, PaymentHistoryChart } from './ReceivablesDashboardCharts';
import CustomerInvoicesSection from './CustomerInvoicesSection';
import { WorkbookSummaryCards, PaymentStatusSummary } from './WorkbookSummary';
import './FinanceCommandCenter.css';

function Panel({ title, className = '', children, extra, info }) {
  return <section className={`ar-panel ${className}`} aria-label={title}><header className="ar-panel-heading"><h2>{title}{info && <span className="ar-info" role="img" tabIndex={0} aria-label={info} title={info}><InformationCircleIcon aria-hidden="true" /></span>}</h2>{extra}</header>{children}</section>;
}
Panel.propTypes = { title: PropTypes.string.isRequired, className: PropTypes.string, children: PropTypes.node, extra: PropTypes.node, info: PropTypes.string };

function CustomerTable({ rows, totals, total, currency, allCount, collectionRoute }) {
  const unknown = rows.some(row => row.unknown_due_date_count > 0) || (totals || []).some(row => row.id === 'unknown_due_date' && row.receivables?.count > 0);
  const ages = [...RECEIVABLE_AGES, ...(unknown ? [['unknown_due_date', 'Unknown']] : [])];
  const maxima = Object.fromEntries(ages.map(([key]) => [key, Math.max(1, ...rows.map(row => row.buckets[key] || 0))]));
  return <div className="ar-table-scroll" tabIndex={0} role="region" aria-label="Customer ageing summary"><table className="ar-table ar-ageing-table" data-table-typography="preserve"><caption className="sr-only">{rows.length} of {allCount} customers. Grand total includes all customers. Amounts in {currency}; asterisks indicate recorded subtotals.</caption>
    <thead><tr><th scope="col">Customer</th>{ages.map(([id, label]) => <th scope="col" key={id}>{label}</th>)}<th scope="col">Amount due</th></tr></thead>
    <tbody>{rows.map(row => <tr key={row.company}>
      <th scope="row">{row.company ? <Link to={collectionRoute(row.company)} title={row.customer}>{row.customer}</Link> : row.customer}</th>
      {ages.map(([id, label]) => <td key={id} className={`ar-heat ar-heat-${id}`} style={{ '--ar-heat': row.buckets[id] > 0 ? 0.16 + (row.buckets[id] / maxima[id]) * 0.25 : 0 }} title={`${row.customer}, ${label}: ${receivableMoney(row.bucket_display[id], currency)}`}>
        {receivableNumber(row.bucket_display[id])}{row.bucket_metrics?.[id]?.partial && <abbr title="Recorded subtotal; some balances are missing">*</abbr>}
      </td>)}<td className="ar-total-heat">{receivableNumber(row.display_amount)}{row.partial && <abbr title="Recorded subtotal; some invoice balances are missing">*</abbr>}</td>
    </tr>)}</tbody>
    {rows.length > 0 && <tfoot><tr><th scope="row">Grand total</th>{ages.map(([id]) => { const metric = totals?.find(row => row.id === id)?.receivables; return <td key={id}>{receivableNumber(receivableRawValue(metric))}{metric?.partial && <abbr title="Recorded subtotal">*</abbr>}</td>; })}<td>{receivableNumber(receivableRawValue(total))}{total?.partial && <abbr title="Recorded subtotal">*</abbr>}</td></tr></tfoot>}
  </table>{!rows.length && <p className="ar-table-empty">No customer balances available for these filters.</p>}</div>;
}
CustomerTable.propTypes = { rows: PropTypes.array.isRequired, totals: PropTypes.array, total: PropTypes.object, currency: PropTypes.string, allCount: PropTypes.number, collectionRoute: PropTypes.func.isRequired };

function InvoiceTable({ rows, total, currency, count }) {
  return <div className="ar-table-scroll" tabIndex={0} role="region" aria-label="Unpaid invoices requiring action"><table className="ar-table ar-invoice-table" data-table-typography="preserve"><caption className="sr-only">Priority invoices shown; grand total covers all {count ?? ''} open invoices in {currency}. Owners are recorded project managers.</caption>
    <thead><tr><th scope="col">Customer</th><th scope="col">Invoice</th><th scope="col">Due date</th><th scope="col">Days overdue</th><th scope="col">Amount due</th><th scope="col">Owner</th><th scope="col">Action</th></tr></thead>
    <tbody>{rows.map((row, index) => <tr key={row.id}><th scope="row" title={receivableCustomer(row)}>{receivableCustomer(row)}</th><td>{row.invoice_number}</td><td>{row.due_date ? receivableDate(row.due_date) : 'Not recorded'}</td><td className={row.days_overdue > 0 ? 'ar-overdue-days' : 'ar-future-days'}>{financeNumber(row.days_overdue) ?? '—'}</td><td className="ar-total-heat">{receivableNumber(row.balance)}</td><td title={row.owner || 'Project manager not recorded'}>{row.owner || 'Not recorded'}</td><td><Link className={index === 0 ? 'ar-review-link' : 'ar-invoice-more'} to={`/finance/outgoing-invoices/${encodeURIComponent(row.id)}`} aria-label={`Review invoice ${row.invoice_number}`}>{index === 0 ? 'Review' : <EllipsisHorizontalIcon aria-hidden="true" />}</Link></td></tr>)}</tbody>
    {rows.length > 0 && <tfoot><tr><th scope="row" colSpan={4}>Grand total <span className="ar-table-scope">{count > rows.length ? `· all ${count} open invoices` : ''}</span></th><td>{receivableNumber(receivableRawValue(total))}{total?.partial && <abbr title="Recorded subtotal">*</abbr>}</td><td colSpan={2} /></tr></tfoot>}
  </table>{!rows.length && <p className="ar-table-empty">No unpaid invoices requiring action in this view.</p>}</div>;
}
InvoiceTable.propTypes = { rows: PropTypes.array.isRequired, total: PropTypes.object, currency: PropTypes.string, count: PropTypes.number };

export default function FinanceCommandCenter({ embedded = false, dataScope = 'finance', refreshKey = 0, printing = false, onSnapshotChange }) {
  const [data, setData] = useState(null);
  const [filters, setFilters] = useState({ currency: '', company: '', months: '12', as_of: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [dialog, setDialog] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const [exportMessage, setExportMessage] = useState('');
  const [options, setOptions] = useState({ currencies: [], companies: [] });
  const [registerSnapshot, setRegisterSnapshot] = useState({ data: null, loading: true, error: '' });
  const sequence = useRef(0), dialogRef = useRef(null), menuRef = useRef(null);
  useEffect(() => {
    const request = ++sequence.current;
    setLoading(true); setError(''); setData(null); setDismissed(false); setExportMessage('');
    const fetchDashboard = dataScope === 'executive' ? financeService.getExecutiveReceivablesDashboard : financeService.getReceivablesDashboard;
    fetchDashboard(filters).then(response => {
      if (request !== sequence.current) return;
      if (response?.schema_version !== '1.0' || !response.sources || !response.kpis || !Array.isArray(response.customers)) throw new Error('The receivables response is incomplete. Please refresh.');
      setData(response); setOptions({ currencies: [...new Set([...(response.filters?.currencies || []), ...(receivableReadable(response.sources.receivables) && response.currency ? [response.currency] : [])])], companies: response.filters?.companies || [] });
    }).catch(requestError => {
      if (request !== sequence.current) return;
      const detail = requestError?.response?.data;
      setError(typeof detail?.detail === 'string' ? detail.detail : requestError?.response?.status === 403 ? 'You do not have access to this finance dashboard.' : detail && typeof detail === 'object' ? Object.values(detail).flat().join(' ') : requestError?.message || 'The receivables dashboard could not be loaded.');
    }).finally(() => { if (request === sequence.current) setLoading(false); });
    return () => { sequence.current += 1; };
  }, [filters, refresh, refreshKey, dataScope]);
  useEffect(() => {
    if (!dialog) return undefined;
    const previous = document.activeElement, element = dialogRef.current;
    element?.showModal();
    return () => { element?.close(); if (previous instanceof HTMLElement && previous.isConnected) previous.focus(); };
  }, [dialog]);
  const change = (key, value) => setFilters(current => ({ ...current, [key]: value }));
  const currency = data?.currency || filters.currency || options.currencies[0] || '';
  const asOf = filters.as_of || data?.as_of_date || receivablesToday();
  const readable = receivableReadable(data?.sources?.receivables);
  const registerScope = JSON.stringify([currency, filters.company, `${refreshKey}:${refresh}`, dataScope, asOf]);
  const registerCurrent = !loading && readable && registerSnapshot.scope === registerScope;
  useLayoutEffect(() => {
    onSnapshotChange?.({ receivables: data, customer_invoice_register: registerCurrent ? registerSnapshot.data : null, customer_invoice_register_error: registerCurrent ? registerSnapshot.error : '', loading: loading || (readable && (!registerCurrent || registerSnapshot.loading)), error });
  }, [data, loading, error, readable, registerCurrent, registerSnapshot, onSnapshotChange]);
  const customers = receivableCustomerRows(data), charts = receivableChartRows(data), alert = receivableAlert(data);
  const partial = readable && !!data?.kpis?.unpaid?.partial;
  const comparisonPartial = rows => (rows || []).some(row => (receivableReadable(data?.sources?.receivables) && row.receivables?.partial) || (receivableReadable(data?.sources?.payables) && row.payables?.partial));
  const paymentsPartial = readable && (data?.paid_unpaid_by_month || []).some(row => row.paid?.partial || row.unpaid?.partial);
  const unknownDueDates = financeCount(data?.sources?.receivables?.unknown_due_date_count);
  const invoices = readable ? data?.priority_invoices || [] : [];
  const primaryOwner = invoices.find(row => row.days_overdue > 0 && row.owner)?.owner;
  const unpaidCount = financeCount(data?.kpis?.unpaid?.count);
  const collectionRoute = useCallback(company => receivableCollectionRoute({ currency, company: filters.company }, company), [currency, filters.company]);
  const hideMenu = () => { if (menuRef.current) { menuRef.current.open = false; menuRef.current.querySelector('summary')?.focus(); } };
  const reload = () => { hideMenu(); setRefresh(value => value + 1); };
  const exportReport = () => {
    if (!data || !readable || loading) return;
    const url = URL.createObjectURL(new Blob([receivablesCsv(data)], { type: 'text/csv;charset=utf-8;' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `RADAI-receivables-${asOf}-${currency}.csv`; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000); setExportMessage('Receivables report exported.');
  };
  const chartState = children => loading ? <div className="ar-loading-chart" role="status"><span />Loading recorded balances…</div> : !data ? <div className="ar-table-empty">Financial data is unavailable.</div> : children;

  return <div className={`finance-command-center ar-dashboard${embedded ? ' ar-dashboard-embedded' : ''}`} aria-busy={loading}>
    {embedded && <p className="ar-print-scope">{filters.company || 'All customers'} · {currency || 'Currency unavailable'} · Ageing as of {receivableDate(asOf)} · Monthly charts: last {filters.months} months</p>}
    <header className="ar-page-header">{!embedded && <div className="ar-page-title"><h1>Accounts Receivable</h1><p>Monitor collections, ageing and customer exposure</p></div>}
      <div className="ar-filters" role="group" aria-label="Receivables filters">
        <label className="ar-filter ar-entity"><span>Customer</span><div><select aria-label="Customer" title="Customer from the invoice COMPANY column" value={filters.company} onChange={event => change('company', event.target.value)}><option value="">All customers</option>{options.companies.map(option => { const value = typeof option === 'string' ? option : option.value; return <option key={value} value={value}>{value}</option>; })}</select><ChevronDownIcon aria-hidden="true" /></div></label>
        <label className="ar-filter ar-currency"><span>Reporting currency <button type="button" className="ar-info" aria-label="About reporting currency" title="Amounts retain their original invoice currency. Currency conversion is not applied." onClick={() => setDialog('sources')}><InformationCircleIcon aria-hidden="true" /></button></span><div><select aria-label="Reporting currency" value={currency} disabled={!options.currencies.length} onChange={event => change('currency', event.target.value)}>{!options.currencies.length && <option value="">{loading ? 'Loading…' : 'No currency'}</option>}{options.currencies.map(code => <option key={code} value={code}>{code === 'UNSPECIFIED' ? 'Unspecified' : code}</option>)}</select><ChevronDownIcon aria-hidden="true" /></div></label>
        <label className="ar-filter ar-period"><span>Period</span><div><select aria-label="Period" title="Monthly chart window; current totals include all open invoices" value={filters.months} onChange={event => change('months', event.target.value)}><option value="6">Last 6 months</option><option value="12">Last 12 months</option><option value="24">Last 24 months</option></select><ChevronDownIcon aria-hidden="true" /></div></label>
        <label className="ar-filter ar-asof"><span>As of</span><div><input aria-label="As of" type="date" value={asOf} max={receivablesToday()} onChange={event => change('as_of', event.target.value)} title="Age current recorded balances relative to this date" /><span className="ar-date-display" aria-hidden="true">{receivableDate(asOf)}</span></div></label>
      </div>
      <div className="ar-header-actions"><div><Link className={`ar-button ar-primary${!readable ? ' is-disabled' : ''}`} to={readable ? collectionRoute() : '#'} aria-disabled={!readable} onClick={event => { if (!readable) event.preventDefault(); }}>Open collection queue</Link><button type="button" className="ar-button ar-export" onClick={exportReport} disabled={loading || !readable}><ArrowDownTrayIcon />Export</button><details className="ar-more-menu" ref={menuRef} onKeyDown={event => { if (event.key === 'Escape') { hideMenu(); event.currentTarget.querySelector('summary')?.focus(); } }}><summary className="ar-button ar-icon-button" aria-label="More dashboard options"><EllipsisHorizontalIcon /></summary><div><button type="button" onClick={reload} disabled={loading}><ArrowPathIcon />Refresh data</button><button type="button" onClick={() => { hideMenu(); setDialog('sources'); }}><InformationCircleIcon />Source coverage</button><button type="button" disabled={!readable} onClick={() => { hideMenu(); setDialog('customers'); }}><UserIcon />View all customers</button></div></details></div><p className="ar-updated">{loading ? 'Updating receivables…' : data?.source_updated_at ? `Last updated: ${financeDate(data.source_updated_at, true)}` : 'Source update not recorded'}</p></div>
    </header>
    {error && <div className="ar-error" role="alert"><ExclamationTriangleIcon /><span>{error}</span><button type="button" onClick={reload}>Try again</button></div>}
    {exportMessage && <p className="ar-export-message" role="status">{exportMessage}<button type="button" aria-label="Dismiss export message" onClick={() => setExportMessage('')}><XMarkIcon /></button></p>}
    <WorkbookSummaryCards summary={data?.workbook_summary} loading={loading} />
    <section className="ar-kpis" aria-label="Receivables key performance indicators">{RECEIVABLE_KPIS.map(([id, label, tone]) => <article className={`ar-kpi ar-kpi-${tone}`} key={id} data-testid={`finance-kpi-${id}`}><h2>{label}</h2><div><strong>{loading ? '—' : receivableMoney(receivableRawValue(data?.kpis?.[id]), currency)}</strong><span title={receivableMetricNote(data?.kpis?.[id])}>{loading ? 'Loading balances…' : receivableMetricNote(data?.kpis?.[id])}</span></div></article>)}</section>
    {!dismissed && <section className={`ar-collection-alert${!loading && readable && receivableValue(data?.kpis?.overdue) === 0 ? ' ar-alert-clear' : ''}`} aria-label="Collection priorities"><ExclamationTriangleIcon className="ar-alert-symbol" aria-hidden="true" /><div className="ar-alert-copy"><h2>{loading ? 'Reviewing collection priorities…' : alert.title}</h2><p>{loading ? 'Retrieving current customer balances and due dates.' : alert.detail}</p></div><div className="ar-alert-owner"><UserIcon aria-hidden="true" /><div><span>Owner</span><strong>{primaryOwner || 'Not assigned'}</strong></div></div><div className="ar-alert-due"><CalendarDaysIcon aria-hidden="true" /><div><span>Next action due</span><strong>Not scheduled</strong></div></div>{readable && <Link to={collectionRoute()} className="ar-button ar-primary ar-priority-button">Review priority accounts</Link>}<button type="button" className="ar-alert-close" aria-label="Dismiss collection alert" onClick={() => setDismissed(true)}><XMarkIcon /></button></section>}
    <div className="ar-analysis-grid">
      <Panel title="Unpaid amount by customer" className="ar-customer-panel" extra={partial && <span className="ar-partial-tag">Recorded balances</span>}>{chartState(<CustomerBalancesChart rows={charts.customers} currency={currency} partial={partial} />)}</Panel>
      <Panel title="Exposure concentration" className="ar-exposure-panel" info={partial ? 'Shares use recorded balances only; missing balances may change the distribution.' : 'Share of unpaid customer balances in the selected currency.'}>{chartState(<ExposureDonut rows={charts.customers} total={receivableValue(data?.kpis?.unpaid)} currency={currency} partial={partial} />)}</Panel>
      <Panel title="Payment status" className="ar-ageing-panel ar-payment-status-panel" info="Recorded payment status across the full workbook snapshot, including paid and cancelled invoices. Dashboard filters do not change these counts." extra={<span className="ar-panel-caption">Full workbook</span>}><PaymentStatusSummary summary={data?.workbook_summary} loading={loading} /></Panel>
      <Panel title="Overdue amount over time" className="ar-trend-panel" info="Current overdue balances grouped by due month. This chart is not a historical month-end balance series." extra={<span className="ar-panel-caption">By due month</span>}>{chartState(<OverdueTrendChart rows={charts.overdue} currency={currency} partial={comparisonPartial(data?.overdue_by_month)} />)}</Panel>
      <Panel title="AR ageing summary" className="ar-summary-panel" extra={<><span className="ar-panel-currency">{currency}</span>{!printing && customers.length > 5 && <button type="button" className="ar-text-button" onClick={() => setDialog('customers')}>Top 5 of {customers.length}<ArrowRightIcon /></button>}</>}><CustomerTable rows={printing ? customers : customers.slice(0, 5)} totals={data?.ageing} total={data?.kpis?.unpaid} currency={currency} allCount={customers.length} collectionRoute={collectionRoute} /></Panel>
      <Panel title="Unpaid invoices requiring action" className="ar-invoices-panel" extra={<span className="ar-panel-currency">{currency}</span>}><InvoiceTable rows={printing ? invoices : invoices.slice(0, 5)} total={data?.kpis?.unpaid} currency={currency} count={unpaidCount} /></Panel>
    </div>
    {partial && <p className="ar-data-note">* Recorded subtotals exclude missing balances. <button type="button" onClick={() => setDialog('sources')}>View source coverage</button></p>}
    {unknownDueDates > 0 && <p className="ar-data-note">{unknownDueDates} open {unknownDueDates === 1 ? 'invoice has' : 'invoices have'} no due date and cannot be classified as overdue.</p>}
    {asOf !== receivablesToday() && <p className="ar-data-note">Ageing uses {receivableDate(asOf)} with current recorded balances. Historical balance snapshots are not available.</p>}
    <div className="ar-invoice-overview">
      <Panel title="Paid vs unpaid invoices" className="ar-history-panel" info="Recorded payments and current unpaid balances grouped by invoice issue month. This is not a cash receipts timeline." extra={readable && <Link className="ar-text-button" to={receivableCollectionRoute({ currency, company: filters.company }).replace('queue=overdue', 'queue=all')}>View invoice register<ArrowRightIcon /></Link>}>{chartState(<PaymentHistoryChart rows={charts.payments} currency={currency} partial={paymentsPartial} />)}</Panel>
      <CustomerInvoicesSection currency={currency} company={filters.company} asOf={asOf} refreshKey={`${refreshKey}:${refresh}`} enabled={!loading && readable} dataScope={dataScope} onSnapshotChange={setRegisterSnapshot} />
    </div>
    {dialog && <dialog ref={dialogRef} className="ar-dialog" aria-labelledby="ar-dialog-title" onCancel={() => setDialog(null)} onKeyDown={event => {
      if (event.key !== 'Tab') return;
      const elements = [...event.currentTarget.querySelectorAll('button:not(:disabled), a[href], [tabindex="0"]')].filter(element => element.getClientRects().length), first = elements[0], last = elements.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }}><header><div><span>Finance / Receivables</span><h2 id="ar-dialog-title">{dialog === 'customers' ? 'Customer ageing summary' : 'Source coverage and reporting basis'}</h2></div><button type="button" className="ar-icon-button" aria-label="Close financial dialog" onClick={() => setDialog(null)}><XMarkIcon /></button></header><div className="ar-dialog-body">
      {dialog === 'customers' ? <CustomerTable rows={customers} totals={data?.ageing} total={data?.kpis?.unpaid} currency={currency} allCount={customers.length} collectionRoute={collectionRoute} /> : <><p>Amounts are shown in their original invoice currency. No currency conversion is applied. Customer names, grouping and filters use the invoice COMPANY column.</p><p>Balance = Invoice Amount (column L) minus Actual Payment Received (column AA). Blank payments count as zero; missing invoice amounts remain unknown. Overdue totals include positive balances on unsettled invoices whose due date is before the selected as-of date.</p><p>The as-of date sets ageing bands for current recorded balances. Monthly charts group these balances by invoice or due month; they do not reconstruct past ledger balances.</p>{Object.entries(data?.sources || {}).map(([key, source]) => <section className="ar-source" key={key}><h3>{key === 'receivables' ? 'Customer invoice register' : 'Supplier invoice register'}</h3><p><strong>{source.status === 'available' ? 'Connected' : source.status === 'incomplete' ? 'Incomplete balances' : source.status === 'restricted' ? 'Access restricted' : 'Unavailable'}</strong>{source.reason ? ` · ${source.reason}` : ''}</p>{key === 'receivables' && financeCount(data?.kpis?.unpaid?.missing_count) !== null && <p>{data.kpis.unpaid.missing_count} of {unpaidCount ?? 'unknown'} open invoices have missing balances. Recorded amounts are shown as partial subtotals.</p>}{source.route && source.status !== 'restricted' && <Link to={source.route} className="ar-text-button">Open register<ArrowRightIcon /></Link>}</section>)}{!data && <p>Load the dashboard to see source coverage.</p>}<p>Collection ownership uses the recorded project manager. Action deadlines are shown only when a scheduling source is connected.</p></>}
    </div><footer><button type="button" className="ar-button" onClick={() => setDialog(null)}>Close</button><button type="button" className="ar-button ar-primary" onClick={exportReport} disabled={!readable}><ArrowDownTrayIcon />Export</button></footer></dialog>}
  </div>;
}

FinanceCommandCenter.propTypes = { embedded: PropTypes.bool, dataScope: PropTypes.oneOf(['finance', 'executive']), refreshKey: PropTypes.oneOfType([PropTypes.string, PropTypes.number]), printing: PropTypes.bool, onSnapshotChange: PropTypes.func };
