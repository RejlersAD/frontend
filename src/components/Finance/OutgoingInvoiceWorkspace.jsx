import { useCallback, useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowDownTrayIcon, ArrowPathIcon, ArrowRightIcon, ArrowUpTrayIcon, Bars3Icon, BookmarkIcon, ChartBarIcon, ChevronLeftIcon, ChevronRightIcon, ChevronUpDownIcon, ClockIcon, EllipsisHorizontalIcon, MagnifyingGlassIcon, PlusCircleIcon, AdjustmentsHorizontalIcon, XMarkIcon } from '@heroicons/react/24/outline';
import invoiceTrackerService from '../../services/invoiceTracker.service';
import { PAYMENT_STATUSES } from '../../config/invoiceTracker.config';
import OutgoingInvoiceReview from './OutgoingInvoiceReview';
import OutgoingInvoiceCreate, { trapOutgoingDialogFocus } from './OutgoingInvoiceCreate';
import OutgoingInvoiceDuplicates from './OutgoingInvoiceDuplicates';
import { OUTGOING_QUEUES, OUTGOING_FILTERS, OUTGOING_AGES, outgoingCollectionCurrency, outgoingCsv, outgoingDate, outgoingMoney, outgoingBalance, outgoingNumber, outgoingState, outgoingToday, loadOutgoingExport } from './outgoingInvoicePresentation';
import './OutgoingInvoiceWorkspace.css';

const Select = ({ label, value, options, onChange }) => <select aria-label={label} title={label} value={value} onChange={event => onChange(event.target.value)}><option value="">{label}</option>{value && !options.some(option => String(Array.isArray(option) ? option[0] : option.value ?? option) === value) && <option value={value}>{value}</option>}{options.map(option => { const [id, text] = Array.isArray(option) ? option : [option.value ?? option, option.label ?? option.value ?? option]; return <option key={id} value={id}>{text}</option>; })}</select>;
Select.propTypes = { label: PropTypes.string.isRequired, value: PropTypes.string.isRequired, options: PropTypes.array.isRequired, onChange: PropTypes.func.isRequired };
const failText = error => error?.response?.data?.detail || error?.message || 'The invoice register could not be loaded.';
const countText = value => outgoingNumber(value)?.toLocaleString('en-GB') ?? '—';
const URL_FILTER_KEYS = [...Object.keys(OUTGOING_FILTERS), 'project_exact'];
const EMPTY_FILTERS = { ...OUTGOING_FILTERS, project_exact: '' };
const readUrlFilters = params => ({ ...EMPTY_FILTERS, ...Object.fromEntries(URL_FILTER_KEYS.filter(key => params.has(key)).map(key => [key, params.get(key)])) });
const readUrlQueue = params => ['all', 'open', 'overdue', 'due_soon', 'partial', 'paid'].includes(params.get('queue')) ? params.get('queue') : params.get('project_exact') ? 'all' : 'overdue';
const filterUrlKey = params => JSON.stringify([...URL_FILTER_KEYS, 'queue'].map(key => [key, params.get(key) || '']));

export default function OutgoingInvoiceWorkspace({ onImport, reloadKey = 0 }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState(() => readUrlFilters(searchParams));
  const [queue, setQueue] = useState(() => readUrlQueue(searchParams));
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(7);
  const [ordering, setOrdering] = useState('due_date');
  const [rows, setRows] = useState([]);
  const [count, setCount] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [summaryError, setSummaryError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedId, setSelectedId] = useState(null);
  const [panelClosed, setPanelClosed] = useState(false);
  const [checked, setChecked] = useState([]);
  const [more, setMore] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [duplicateFilter, setDuplicateFilter] = useState(() => searchParams.get('review_duplicates'));
  const [message, setMessage] = useState('');
  const [exporting, setExporting] = useState(false);
  const [healthCurrency, setHealthCurrency] = useState('');
  const [density, setDensity] = useState('compact');
  const sequence = useRef(0);
  const checkRef = useRef(null);
  const analysisRef = useRef(null);
  const moreActionsRef = useRef(null);
  const duplicateTriggerRef = useRef(null);
  const appliedUrlScope = useRef(filterUrlKey(searchParams));
  const requestFilters = { ...filters, queue, ordering };

  useEffect(() => {
    const nextKey = filterUrlKey(searchParams);
    if (nextKey === appliedUrlScope.current) return;
    appliedUrlScope.current = nextKey;
    setFilters(readUrlFilters(searchParams)); setQueue(readUrlQueue(searchParams)); setPage(1);
    setSelectedId(null); setPanelClosed(false); setMessage('');
  }, [searchParams]);
  const writeFilterUrl = (nextFilters, nextQueue) => {
    const params = new URLSearchParams(searchParams);
    URL_FILTER_KEYS.forEach(key => { params.delete(key); if (nextFilters[key]) params.set(key, nextFilters[key]); });
    params.set('queue', nextQueue);
    appliedUrlScope.current = filterUrlKey(params);
    setSearchParams(params, { replace: true });
  };

  const refresh = useCallback(() => { setRefreshKey(value => value + 1); setMessage(''); }, []);
  const reviewDuplicates = id => { duplicateTriggerRef.current = document.activeElement; setDuplicateFilter(String(id ?? '')); };
  useEffect(() => { if (searchParams.has('review_duplicates')) setDuplicateFilter(searchParams.get('review_duplicates')); }, [searchParams]);
  const closeDuplicates = () => {
    setDuplicateFilter(null);
    if (searchParams.has('review_duplicates')) { const params = new URLSearchParams(searchParams); params.delete('review_duplicates'); setSearchParams(params, { replace: true }); }
    requestAnimationFrame(() => {
      const trigger = duplicateTriggerRef.current;
      if (trigger?.isConnected && !trigger.closest('details:not([open])')) trigger.focus();
      else moreActionsRef.current?.focus();
    });
  };
  useEffect(() => {
    const request = ++sequence.current;
    setLoading(true); setError(''); setSummaryError(''); setRows([]); setSummary(null); setCount(null); setChecked([]);
    const timer = setTimeout(async () => {
      const params = { ...filters, queue, ordering };
      const [register, totals] = await Promise.allSettled([
        invoiceTrackerService.list({ ...params, page, page_size: pageSize }),
        invoiceTrackerService.collectionsSummary(params),
      ]);
      if (request !== sequence.current) return;
      if (register.status === 'rejected' && register.reason?.response?.status === 404 && page > 1 && totals.status === 'fulfilled' && Number.isInteger(totals.value?.filtered_count) && totals.value.filtered_count <= (page - 1) * pageSize) {
        setPage(Math.max(1, Math.ceil(totals.value.filtered_count / pageSize)));
        return;
      }
      if (register.status === 'fulfilled' && Array.isArray(register.value?.results) && Number.isInteger(register.value.count)) {
        const data = register.value;
        if (page > 1 && !data.results.length && data.count <= (page - 1) * pageSize) setPage(Math.max(1, Math.ceil(data.count / pageSize)));
        setRows(data.results); setCount(data.count);
      } else setError(register.status === 'rejected' ? failText(register.reason) : 'The invoice register returned an invalid response.');
      if (totals.status === 'fulfilled' && totals.value?.schema_version === '1.0') setSummary(totals.value);
      else setSummaryError(totals.status === 'rejected' ? failText(totals.reason) : 'Collection totals are not available.');
      setLoading(false);
    }, filters.search || filters.account || filters.project ? 250 : 0);
    return () => { clearTimeout(timer); sequence.current += 1; };
  }, [filters, queue, ordering, page, pageSize, refreshKey, reloadKey]);

  const selected = panelClosed || loading || error ? null : rows.find(row => row.id === selectedId) || rows[0] || null;
  const allChecked = rows.length > 0 && rows.every(row => checked.includes(row.id));
  useEffect(() => { if (checkRef.current) checkRef.current.indeterminate = !allChecked && checked.length > 0; }, [checked, allChecked]);
  const change = (key, value) => { setFilters(current => ({ ...current, [key]: value })); setPage(1); setMessage(''); };
  const changeQueue = value => { setQueue(value); setPage(1); setMessage(''); };
  const clear = () => { setFilters(EMPTY_FILTERS); setQueue('overdue'); setPage(1); setOrdering('due_date'); setMessage(''); writeFilterUrl(EMPTY_FILTERS, 'overdue'); };
  const clearProjectScope = () => { const next = { ...filters, project_exact: '' }; setFilters(next); setPage(1); writeFilterUrl(next, queue); };
  const openInvoice = invoice => navigate(`/finance/outgoing-invoices/${encodeURIComponent(invoice.id)}`);
  const selectInvoice = invoice => { setSelectedId(invoice.id); setPanelClosed(false); };
  const sort = key => { setOrdering(current => current === key ? `-${key}` : key); setPage(1); };
  const exportInvoices = async () => {
    setExporting(true); setMessage('');
    if (summary?.capabilities?.export !== true) { setExporting(false); return; }
    try {
      const exported = checked.length ? rows.filter(row => checked.includes(row.id)) : await loadOutgoingExport(params => invoiceTrackerService.list(params), requestFilters);
      const blob = new Blob([outgoingCsv(exported, summary?.as_of_date)], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob); const link = document.createElement('a');
      link.href = url; link.download = `RADAI-outgoing-invoices-${outgoingToday()}.csv`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage(`Exported ${exported.length} ${checked.length ? 'selected' : 'filtered'} invoices.`);
    } catch (exportError) { setMessage(failText(exportError)); }
    finally { setExporting(false); }
  };
  const currencies = summary?.currencies || [];
  const currency = filters.currency || (currencies.includes(healthCurrency) ? healthCurrency : currencies[0]) || '';
  const health = summary?.collection_health;
  const currencyHealth = outgoingCollectionCurrency(summary, currency);
  const pages = Math.max(1, Math.ceil((count || 0) / pageSize));
  const moreCount = ['category', 'account', 'project', 'date_from', 'date_to'].filter(key => filters[key]).length;
  const unavailable = id => summary?.unavailable_metrics?.find(metric => metric.id === id)?.reason || 'Not recorded in the invoice register.';
  const canCreate = summary?.capabilities?.create === true;
  const canImport = summary?.capabilities?.import === true;
  const canExport = summary?.capabilities?.export === true;
  useEffect(() => { if ((summary && summary.capabilities?.create !== true) || summaryError) setCreateOpen(false); }, [summary, summaryError]);
  const sortHeader = (label, key) => <th scope="col" aria-sort={ordering.replace('-', '') === key ? ordering.startsWith('-') ? 'descending' : 'ascending' : 'none'}><button type="button" onClick={() => sort(key)}>{label}<ChevronUpDownIcon /></button></th>;

  return <div className="outgoing-collections">
    <nav className="oc-breadcrumb" aria-label="Breadcrumb"><a href="/finance">Finance</a><span>/</span><span>Accounts Receivable</span><span>/</span><strong>Outgoing invoices</strong></nav>
    <header className="oc-page-heading"><div><h1>Outgoing Invoices &amp; Collections</h1><p>Track customer invoices, resolve disputes and accelerate collection.</p></div><div className="oc-page-actions">
      <span className="oc-updated"><ClockIcon />{summary?.source_updated_at ? `Updated ${outgoingDate(summary.source_updated_at, true)}` : loading ? 'Updating…' : 'Update time unavailable'}</span>
      <button type="button" className="oc-button" onClick={exportInvoices} disabled={loading || !!error || exporting || !count || !canExport}><ArrowDownTrayIcon />{exporting ? 'Exporting…' : 'Export'}</button>
      <button type="button" className="oc-button" onClick={refresh} disabled={loading}><ArrowPathIcon className={loading ? 'oc-spin' : ''} />Refresh</button>
      <button type="button" className="oc-button oc-primary" disabled={!canCreate} title={canCreate ? undefined : "Invoice creation is not available for your access"} onClick={() => setCreateOpen(true)}><PlusCircleIcon />Create invoice</button>
      <details className="oc-overflow"><summary ref={moreActionsRef} className="oc-button" aria-label="More invoice actions"><EllipsisHorizontalIcon /></summary><div><button type="button" disabled={!canImport} title={canImport ? undefined : "Invoice import is not available for your access"} onClick={event => { if (canImport) { event.currentTarget.closest('details').open = false; onImport(); } }}><ArrowUpTrayIcon />Import Excel</button><button type="button" onClick={event => { event.currentTarget.closest('details').open = false; reviewDuplicates(''); }}>Review duplicates</button><button type="button" onClick={() => changeQueue('all')}>View complete register</button></div></details>
    </div></header>

    <div className="oc-queues" aria-label="Invoice queues">{OUTGOING_QUEUES.map(([id, label]) => <button type="button" key={id} className={`${queue === id ? 'is-active' : ''} ${id === 'overdue' || id === 'disputed' ? 'oc-danger' : ''}`} aria-pressed={queue === id} disabled={id === 'disputed'} title={id === 'disputed' ? unavailable('disputes') : id === 'due_soon' ? `Due through ${outgoingDate(summary?.due_soon_through)}` : undefined} onClick={() => changeQueue(id)}><span>{label}</span><strong>{countText(summary?.counts?.[id])}</strong></button>)}</div>

    <section className="oc-filter-bar" aria-label="Invoice filters">
      <label className="oc-queue-select"><BookmarkIcon /><select aria-label="Collection queue" value={queue} onChange={event => changeQueue(event.target.value)}><option value="overdue">Overdue collection queue</option><option value="open">All open invoices</option><option value="due_soon">Due this week</option><option value="partial">Partially paid invoices</option><option value="paid">Settled invoices</option><option value="all">Complete invoice register</option></select></label>
      <label className="oc-search"><MagnifyingGlassIcon /><input aria-label="Search outgoing invoices" type="search" placeholder="Search invoice, customer, project or reference…" value={filters.search} onChange={event => change('search', event.target.value)} /></label>
      <Select label="Company" value={filters.company} options={summary?.filter_options?.companies || []} onChange={value => change('company', value)} />
      <Select label="Project manager" value={filters.pm} options={summary?.filter_options?.project_managers || []} onChange={value => change('pm', value)} />
      <Select label="Ageing bucket" value={filters.ageing} options={OUTGOING_AGES} onChange={value => change('ageing', value)} />
      <Select label="Status" value={filters.payment_status} options={PAYMENT_STATUSES.filter(status => status.key).map(status => [status.key, status.label])} onChange={value => change('payment_status', value)} />
      <Select label="Currency" value={filters.currency} options={currencies} onChange={value => change('currency', value)} />
      <button type="button" className="oc-button" aria-expanded={more} onClick={() => setMore(value => !value)}><AdjustmentsHorizontalIcon />More filters{moreCount ? ` (${moreCount})` : ''}</button>
      <button type="button" className="oc-link" onClick={clear}>Clear</button>
    </section>
    {more && <div className="oc-more-filters"><Select label="Category" value={filters.category} options={[['external', 'External (Customer)'], ['internal', 'Internal (Rejlers Group)']]} onChange={value => change('category', value)} /><input aria-label="Customer account" placeholder="Customer account" value={filters.account} onChange={event => change('account', event.target.value)} /><input aria-label="Project reference" placeholder="Project reference" value={filters.project} onChange={event => change('project', event.target.value)} /><label>Invoice date from<input type="date" aria-label="Invoice date from" value={filters.date_from} onChange={event => change('date_from', event.target.value)} /></label><label>Invoice date to<input type="date" aria-label="Invoice date to" value={filters.date_to} onChange={event => change('date_to', event.target.value)} /></label></div>}
    {filters.project_exact && <div className="oc-message" data-testid="outgoing-project-scope">Exact project reference: <strong>{filters.project_exact}</strong> · {queue === 'all' ? 'Complete invoice register' : 'Selected collection queue'} <button type="button" className="oc-link" onClick={clearProjectScope}>Clear project scope</button></div>}
    {(message || summaryError) && <div className="oc-message" role="status">{message || `Collection totals could not be loaded. ${summaryError}`} {summaryError && <button type="button" className="oc-link" onClick={refresh}>Retry totals</button>}</div>}
    <div className={`oc-workspace ${selected ? '' : 'oc-without-review'}`}>
      <div className="oc-register-column">
        <section className="oc-panel oc-register" aria-label="Outgoing invoice register" aria-busy={loading}>
          <div className="oc-register-heading"><strong>{loading ? 'Loading invoices…' : count === null ? 'Invoice register' : `${countText(count)} invoices`}{checked.length > 0 && <small> · {checked.length} selected</small>}</strong><label><Bars3Icon /><select aria-label="Table density" value={density} onChange={event => setDensity(event.target.value)}><option value="compact">Compact</option><option value="comfortable">Comfortable</option></select></label></div>
          <div className="oc-table-scroll" role="region" aria-label="Invoices table" tabIndex={0}><table className={`oc-table oc-${density}`}><colgroup>{[3, 8, 10, 14, 8, 8, 12, 10, 9, 10, 8].map((width, i) => <col key={i} style={{ width: `${width}%` }} />)}</colgroup><thead><tr>
            <th scope="col"><input ref={checkRef} type="checkbox" aria-label="Select page invoices" checked={allChecked} disabled={loading || !rows.length} onChange={event => setChecked(event.target.checked ? rows.map(row => row.id) : [])} /></th><th scope="col">Risk / Age</th>{sortHeader('Invoice', 'invoice_number')}<th scope="col">Customer / Project</th>{sortHeader('Invoice date', 'invoice_date')}{sortHeader('Due date', 'due_date')}{sortHeader('Outstanding', 'balance_to_be_received')}<th scope="col">Collection status</th><th scope="col" title="The recorded project manager; collection ownership is not recorded.">Project manager</th><th scope="col" title="Suggested from the invoice balance and contractual due date.">Suggested action</th><th scope="col">Action</th>
          </tr></thead><tbody>{!loading && !error && rows.map(invoice => { const state = outgoingState(invoice, summary?.as_of_date); const active = invoice.id === selected?.id; return <tr key={invoice.id} className={active ? `oc-selected oc-selected-${state.tone}` : ''}>
            <td><input type="checkbox" aria-label={`Select invoice ${invoice.invoice_number}`} checked={checked.includes(invoice.id)} onChange={event => setChecked(current => event.target.checked ? [...current, invoice.id] : current.filter(id => id !== invoice.id))} /></td>
            <td><span className={`oc-badge oc-${state.tone}`}>{state.age}</span></td>
            <td><button type="button" className="oc-invoice-link" onClick={() => selectInvoice(invoice)}>{invoice.invoice_number || 'No reference'}</button></td>
            <td><strong className="oc-customer" title={invoice.account || invoice.company}>{invoice.account || invoice.company || 'Not recorded'}</strong><span className="oc-project" title={invoice.project_name || invoice.rad_project_no}>{invoice.rad_project_no || invoice.project_id || invoice.project_name || '—'}</span></td>
            <td>{outgoingDate(invoice.invoice_date)}</td><td>{outgoingDate(invoice.due_date)}</td>
            <td className="oc-money" title={!invoice.currency ? 'Currency not recorded' : undefined}>{outgoingMoney(outgoingBalance(invoice), invoice.currency)}</td>
            <td><span className={`oc-badge oc-${state.tone}`}>{state.label}</span></td><td>{invoice.pm || <span className="oc-muted">Not recorded</span>}</td><td>{state.next}</td>
            <td><button type="button" aria-label={`Review invoice ${invoice.invoice_number}`} className={`oc-row-button ${active ? 'oc-primary' : ''}`} onClick={() => selectInvoice(invoice)}>{state.label === 'Settled' ? 'Open' : 'Review'}</button></td>
          </tr>; })}</tbody></table></div>
          {loading && <div className="oc-empty" role="status"><ArrowPathIcon className="oc-spin" />Loading the collection queue…</div>}
          {!loading && error && <div className="oc-empty" role="alert"><strong>Invoices could not be loaded</strong><p>{error}</p><button type="button" className="oc-button" onClick={refresh}>Try again</button></div>}
          {!loading && !error && !rows.length && <div className="oc-empty"><strong>No invoices in this queue</strong><p>Choose another queue or clear your filters.</p><button type="button" className="oc-button" onClick={() => { setFilters(EMPTY_FILTERS); changeQueue('open'); writeFilterUrl(EMPTY_FILTERS, 'open'); }}>View all open invoices</button></div>}
          <footer className="oc-pagination"><span>{count ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, count)} of ${countText(count)} invoices` : 'No invoices to show'}</span><div><button type="button" aria-label="Previous invoice page" disabled={loading || page === 1} onClick={() => setPage(value => value - 1)}><ChevronLeftIcon /></button><span>Page <b>{page}</b> of {pages}</span><button type="button" aria-label="Next invoice page" disabled={loading || page >= pages} onClick={() => setPage(value => value + 1)}><ChevronRightIcon /></button></div><label>Rows per page<select aria-label="Rows per page" value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPage(1); }}>{[7, 15, 25, 50].map(size => <option key={size}>{size}</option>)}</select></label></footer>
        </section>

        <section className="oc-panel oc-health"><header><h2><ChartBarIcon />Collection health</h2><button type="button" className="oc-link" onClick={() => analysisRef.current?.showModal()}>View ageing analysis<ArrowRightIcon /></button></header><div className="oc-health-metrics">
          <div title={unavailable('dso')}><strong>—</strong><span>DSO</span><small>Not available</small></div><div className="oc-red"><strong>{countText(health?.overdue_count)}</strong><span>overdue</span></div><div className="oc-red"><strong>{outgoingMoney(currencyHealth?.overdue, currency)}</strong><label>overdue<select aria-label="Health currency" value={currency} disabled={!!filters.currency || !currencies.length} onChange={event => setHealthCurrency(event.target.value)}>{!currencies.length && <option value="">No currency</option>}{currencies.map(unit => <option key={unit}>{unit}</option>)}</select></label></div><div title={unavailable('disputes')}><strong>—</strong><span>disputes</span><small>Not recorded</small></div><div title={unavailable('promises')}><strong>—</strong><span>promises pending</span><small>Not recorded</small></div><div title={unavailable('contacted')}><strong>—</strong><span>contacted within SLA</span><small>Not recorded</small></div>
        </div><p className="oc-health-scope">Across filtered invoices, before queue selection. Amounts remain in their original currency.{health?.missing_balance_count > 0 ? ` ${health.missing_balance_count} balances missing.` : ''}{health?.missing_currency_count > 0 ? ` ${health.missing_currency_count} currencies missing.` : ''}</p></section>
      </div>
      {selected && <OutgoingInvoiceReview invoice={selected} asOfDate={summary?.as_of_date} onClose={() => setPanelClosed(true)} onOpen={openInvoice} onChanged={refresh} onReviewDuplicates={reviewDuplicates} />}
    </div>
    <dialog ref={analysisRef} onKeyDown={trapOutgoingDialogFocus} className="oc-dialog" aria-labelledby="oc-ageing-title"><header><h2 id="oc-ageing-title">Receivables ageing</h2><button type="button" aria-label="Close ageing analysis" onClick={() => analysisRef.current.close()}><XMarkIcon /></button></header><p>Open invoices by contractual due date. Amounts are shown in the selected original currency.</p><Select label="Analysis currency" value={currency} options={currencies} onChange={value => { if (filters.currency) change('currency', value); setHealthCurrency(value); }} /><div className="oc-ageing-rows">{currencyHealth?.buckets?.map(bucket => <div key={bucket.id}><span>{bucket.label}</span><span>{bucket.count} invoices</span><strong>{outgoingMoney(bucket.amount, currency)}</strong></div>) || <p>Ageing data is not available.</p>}</div>{currencyHealth?.status === 'incomplete' && <p>Some balances or currencies are missing. Incomplete monetary totals are withheld.</p>}<button type="button" className="oc-button" onClick={() => analysisRef.current.close()}>Close</button></dialog>
    <OutgoingInvoiceCreate open={createOpen && canCreate} onClose={() => setCreateOpen(false)} onCreated={invoice => { setCreateOpen(false); openInvoice(invoice); }} />
    {duplicateFilter !== null && <OutgoingInvoiceDuplicates initialInvoiceId={duplicateFilter} onClose={closeDuplicates} onResolved={refresh} />}
  </div>;
}
OutgoingInvoiceWorkspace.propTypes = { onImport: PropTypes.func.isRequired, reloadKey: PropTypes.number };
