import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import {
  ArrowDownTrayIcon, ArrowPathIcon, ArrowUpTrayIcon, Bars3Icon, BanknotesIcon, ChartBarIcon,
  CheckCircleIcon, ChevronLeftIcon, ChevronRightIcon, ChevronUpDownIcon, ClockIcon,
  DocumentMagnifyingGlassIcon, DocumentTextIcon, ExclamationTriangleIcon, FunnelIcon,
  LinkIcon, ShieldCheckIcon, Squares2X2Icon, StarIcon, MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import financeService from '../../services/finance.service';
import IncomingInvoiceReview from './IncomingInvoiceReview';
import ConfirmedPurchaseOrderLinks from './ConfirmedPurchaseOrderLinks';
import PurchaseOrderHandoff from '../Procurement/PurchaseOrderHandoff';
import {
  INVOICE_QUEUES, INVOICE_LABELS, INITIAL_INVOICE_FILTERS, filterInvoices, inInvoiceQueue,
  invoiceAge, invoiceDate, invoiceMetrics, invoiceMoney, invoiceOverdue, invoiceRisk,
  invoiceTone, invoicesCsv, loadInvoiceRegister, sortInvoices,
} from './incomingInvoiceRegister';
import '../../pages/Finance/IncomingInvoices.css';

const QUEUE_ICONS = [BanknotesIcon, DocumentMagnifyingGlassIcon, ExclamationTriangleIcon, LinkIcon, CheckCircleIcon, ShieldCheckIcon];
const MATCH_STATES = ['unmatched', 'auto_matched', 'manual_matched', 'exception', 'verified'];
const WORKFLOW_STATES = ['ocr_review', 'ready_for_matching', 'procurement_review', 'finance_review', 'approved_for_payment', 'rejected', 'closed'];
const PAYMENT_STATES = ['not_scheduled', 'scheduled', 'partial', 'paid', 'on_hold', 'cancelled'];

const Badge = ({ value }) => <span className={`incoming-status incoming-${invoiceTone(value)}`}>{INVOICE_LABELS[value] || (value ? value.replaceAll('_', ' ') : 'Not recorded')}</span>;
Badge.propTypes = { value: PropTypes.string };

const Select = ({ label, value, onChange, options, placeholder = 'All' }) => <label className="incoming-filter"><span>{label}</span><select aria-label={label} value={value} onChange={event => onChange(event.target.value)}><option value="">{placeholder}</option>{options.map(option => { const [id, text] = Array.isArray(option) ? option : [option, INVOICE_LABELS[option] || option]; return <option key={id} value={id}>{text}</option>; })}</select></label>;
Select.propTypes = { label: PropTypes.string.isRequired, value: PropTypes.string.isRequired, onChange: PropTypes.func.isRequired, options: PropTypes.array.isRequired, placeholder: PropTypes.string };

export default function IncomingInvoiceWorkspace({ onImport, reloadKey = 0 }) {
  const navigate = useNavigate();
  const [section, setSection] = useState('register');
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState(INITIAL_INVOICE_FILTERS);
  const [queue, setQueue] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(7);
  const [sort, setSort] = useState({ key: '', direction: 'asc' });
  const [moreFilters, setMoreFilters] = useState(false);
  const [view, setView] = useState('list');
  const [selectedId, setSelectedId] = useState(null);
  const [panelClosed, setPanelClosed] = useState(false);
  const [checked, setChecked] = useState([]);
  const [exportMessage, setExportMessage] = useState('');
  const sequence = useRef(0);
  const selectPageRef = useRef(null);

  const load = useCallback(async () => {
    const request = ++sequence.current;
    setLoading(true); setError('');
    try {
      const rows = await loadInvoiceRegister(params => financeService.getInvoices(params));
      if (request === sequence.current) { setInvoices(rows); setChecked([]); }
    } catch (requestError) {
      if (request === sequence.current) setError(requestError?.response?.data?.detail || requestError?.message || 'The invoice register could not be loaded.');
    } finally { if (request === sequence.current) setLoading(false); }
  }, []);

  useEffect(() => { load(); return () => { sequence.current += 1; }; }, [load, reloadKey]);
  const stats = useMemo(() => invoiceMetrics(invoices), [invoices]);
  const filtered = useMemo(() => sortInvoices(filterInvoices(invoices, filters, queue), sort.key, sort.direction), [invoices, filters, queue, sort]);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pages);
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const selected = panelClosed ? null : visible.find(invoice => invoice.id === selectedId) || visible[0] || null;
  const allChecked = visible.length > 0 && visible.every(invoice => checked.includes(invoice.id));
  const currencies = [...new Set(invoices.map(invoice => invoice.currency).filter(Boolean))].sort();
  const vendors = [...new Set(invoices.map(invoice => invoice.vendor_master_name || invoice.vendor_name).filter(Boolean))].sort();
  const moreCount = ['vendor', 'currency', 'payment'].filter(key => filters[key]).length;

  useEffect(() => { if (selectPageRef.current) selectPageRef.current.indeterminate = !allChecked && visible.some(invoice => checked.includes(invoice.id)); }, [visible, checked, allChecked]);

  const changeFilter = (key, value) => { setFilters(current => ({ ...current, [key]: value })); setPage(1); setChecked([]); setExportMessage(''); };
  const changeQueue = value => { setQueue(value); setPage(1); setChecked([]); setExportMessage(''); };
  const clearFilters = () => { setFilters(INITIAL_INVOICE_FILTERS); setQueue('all'); setPage(1); setChecked([]); setSort({ key: '', direction: 'asc' }); setExportMessage(''); };
  const selectInvoice = invoice => { setSelectedId(invoice.id); setPanelClosed(false); };
  const toggleCheck = id => setChecked(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]);
  const toggleSort = key => setSort(current => ({ key, direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc' }));
  const exportRows = () => {
    const rows = checked.length ? filtered.filter(invoice => checked.includes(invoice.id)) : filtered;
    const url = URL.createObjectURL(new Blob([invoicesCsv(rows)], { type: 'text/csv;charset=utf-8;' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `incoming-invoices-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor); anchor.click(); anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setExportMessage(`Exported ${rows.length} ${rows.length === 1 ? 'invoice' : 'invoices'}.`);
  };
  const pagination = Array.from({ length: pages }, (_, index) => index + 1).filter(number => number === 1 || number === pages || Math.abs(number - currentPage) <= 1);
  const heading = (label, key) => <th scope="col" aria-sort={sort.key === key ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}><button type="button" onClick={() => toggleSort(key)} aria-label={`Sort by ${label}`} title={key === 'total_amount' ? 'Sort numeric amounts; currencies remain separate' : `Sort by ${label}`}>{label}<ChevronUpDownIcon /></button></th>;
  const riskCell = invoice => { const risk = invoiceRisk(invoice); const Icon = risk.tone === 'green' ? CheckCircleIcon : risk.tone === 'neutral' ? ClockIcon : ExclamationTriangleIcon; const age = invoiceAge(invoice); return <span className={`incoming-risk incoming-text-${risk.tone}`} title={`${risk.label} · ${age === null ? 'Received date not recorded' : `${age} days since received`}`}><Icon aria-hidden="true" /><span className="sr-only">{risk.label}, </span>{age === null ? '—' : `${age}d`}</span>; };

  return <div className="incoming-invoices">
    <header className="incoming-page-header">
      <div><nav aria-label="Breadcrumb">Finance <span>/</span> Accounts Payable <span>/</span> Incoming invoices</nav><h1>Incoming Invoices</h1><p>Validate, match and prepare supplier invoices for approval and payment.</p></div>
      <div className="incoming-header-actions"><button type="button" className="incoming-button" onClick={exportRows} disabled={loading || !!error || !filtered.length} title={checked.length ? 'Export selected invoices as CSV' : 'Export filtered invoices as CSV'}><ArrowDownTrayIcon />Export</button><button type="button" className="incoming-button" onClick={load} disabled={loading}><ArrowPathIcon className={loading ? 'incoming-spin' : ''} />Refresh</button><button type="button" className="incoming-button incoming-primary" onClick={() => onImport()}><ArrowUpTrayIcon />Import invoice</button></div>
    </header>

    <nav className="po-handoff-tabs" aria-label="Incoming invoice workspace">{[['register', 'Invoice register'], ['awaiting', 'POs awaiting supplier invoice']].map(([id, label]) => <button type="button" key={id} aria-pressed={section === id} onClick={() => setSection(id)}>{label}</button>)}</nav>
    {section === 'awaiting' && <PurchaseOrderHandoff title="POs awaiting supplier invoice" kind="invoice" fetchPage={financeService.getAwaitingPurchaseOrders} onSelect={onImport} actionLabel="Import invoice" reloadKey={reloadKey} />}
    <div hidden={section !== 'register'}><div className="incoming-queue-tabs" role="tablist" aria-label="Invoice queues">{INVOICE_QUEUES.map(({ id, label }, index) => { const Icon = QUEUE_ICONS[index]; return <button type="button" role="tab" id={`incoming-tab-${id}`} aria-controls="incoming-register" aria-selected={queue === id} key={id} onClick={() => changeQueue(id)} onKeyDown={event => { if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return; event.preventDefault(); const next = event.key === 'Home' ? 0 : event.key === 'End' ? INVOICE_QUEUES.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + INVOICE_QUEUES.length) % INVOICE_QUEUES.length; changeQueue(INVOICE_QUEUES[next].id); document.getElementById(`incoming-tab-${INVOICE_QUEUES[next].id}`)?.focus(); }} tabIndex={queue === id ? 0 : -1}><Icon /><span>{label}</span><strong className={id === 'exceptions' ? 'incoming-text-red' : ''}>{loading || error ? '—' : stats[id]}</strong></button>; })}</div>

    <section className="incoming-toolbar" aria-label="Filter invoices">
      <label className="incoming-search"><MagnifyingGlassIcon /><input aria-label="Search invoices" placeholder="Search invoice, supplier, PO or tracking ID" value={filters.search} onChange={event => changeFilter('search', event.target.value)} /></label>
      <label className="incoming-filter incoming-company" title="Company coding is not recorded on invoices yet"><span>Company</span><select aria-label="Company" disabled><option>All companies</option></select></label>
      <Select label="Matching status" value={filters.match} onChange={value => changeFilter('match', value)} options={MATCH_STATES} />
      <Select label="Workflow stage" value={filters.workflow} onChange={value => changeFilter('workflow', value)} options={WORKFLOW_STATES} />
      <Select label="Due date" value={filters.due} onChange={value => changeFilter('due', value)} placeholder="Any date" options={[["overdue", "Overdue"], ["today", "Due today"], ["week", "Next 7 days"], ["not_set", "Not recorded"]]} />
      <button type="button" className={`incoming-button ${moreCount ? 'incoming-filter-active' : ''}`} aria-expanded={moreFilters} aria-controls="incoming-more-filters" onClick={() => setMoreFilters(value => !value)}><FunnelIcon />More filters{moreCount > 0 && <span>{moreCount}</span>}</button>
      <button type="button" className="incoming-clear" onClick={clearFilters}>Clear</button>
      <label className="incoming-ap-queue"><StarIcon /><select aria-label="AP queue" value={['review', 'payment_ready'].includes(queue) ? queue : 'all'} onChange={event => changeQueue(event.target.value)}><option value="all">All AP invoices</option><option value="review">Review queue</option><option value="payment_ready">Payment queue</option></select></label>
      <span className="incoming-record-count" aria-live="polite">{loading || error ? '— invoices' : checked.length ? `${checked.length} selected` : `${filtered.length} invoices`}</span>
      <div className="incoming-view-toggle" aria-label="Invoice display"><button type="button" aria-label="List view" aria-pressed={view === 'list'} onClick={() => setView('list')}><Bars3Icon /></button><button type="button" aria-label="Invoice cards" aria-pressed={view === 'cards'} onClick={() => setView('cards')}><Squares2X2Icon /></button></div>
      {moreFilters && <div id="incoming-more-filters" className="incoming-more-filters"><Select label="Supplier" value={filters.vendor} onChange={value => changeFilter('vendor', value)} placeholder="All suppliers" options={vendors} /><Select label="Currency" value={filters.currency} onChange={value => changeFilter('currency', value)} placeholder="All currencies" options={currencies} /><Select label="Payment status" value={filters.payment} onChange={value => changeFilter('payment', value)} options={PAYMENT_STATES} /><p>Company and personal assignment are not recorded for this register.</p></div>}
    </section>

    {exportMessage && <p className="incoming-export-message" role="status">{exportMessage}</p>}
    <div className="incoming-workspace-grid">
      <div className="incoming-register-column">
        <section className="incoming-register" id="incoming-register" role="tabpanel" aria-labelledby={`incoming-tab-${queue}`} aria-busy={loading}>
          {loading ? <div className="incoming-empty" role="status"><ArrowPathIcon className="incoming-spin" /><h2>Loading invoices…</h2></div> : error ? <div className="incoming-empty incoming-error" role="alert"><ExclamationTriangleIcon /><h2>Unable to load invoices</h2><p>{error}</p><button type="button" className="incoming-button" onClick={load}>Try again</button></div> : !visible.length ? <div className="incoming-empty"><DocumentTextIcon /><h2>{invoices.length ? 'No invoices match your filters' : 'No incoming invoices yet'}</h2><p>{invoices.length ? 'Try another queue or clear the filters.' : 'Import a supplier invoice to begin validation and matching.'}</p><button type="button" className="incoming-button" onClick={invoices.length ? clearFilters : () => onImport()}>{invoices.length ? 'Clear filters' : 'Import invoice'}</button></div> : view === 'list' ? <div className="incoming-table-scroll"><table className="incoming-invoice-table"><caption className="sr-only">Incoming invoices. Select a row to review its details.</caption><thead><tr>
            <th scope="col"><input ref={selectPageRef} type="checkbox" aria-label="Select all invoices on this page" checked={allChecked} onChange={() => setChecked(current => allChecked ? current.filter(id => !visible.some(invoice => invoice.id === id)) : [...new Set([...current, ...visible.map(invoice => invoice.id)])])} /></th>
            <th scope="col">Risk/Age</th>{heading('Invoice', 'invoice_number')}{heading('Supplier', 'vendor_master_name')}<th scope="col">PO reference</th>{heading('Invoice date', 'invoice_date')}{heading('Due date', 'due_date')}{heading('Total', 'total_amount')}<th scope="col">Match</th><th scope="col">Workflow</th><th scope="col">Action</th>
          </tr></thead><tbody>{visible.map(invoice => <tr key={invoice.id} aria-selected={selected?.id === invoice.id} onClick={() => selectInvoice(invoice)} onDoubleClick={() => navigate(`/finance/incoming-invoices/${invoice.id}`)}>
            <td onClick={event => event.stopPropagation()}><input type="checkbox" aria-label={`Select invoice ${invoice.invoice_number}`} checked={checked.includes(invoice.id)} onChange={() => toggleCheck(invoice.id)} /></td><td>{riskCell(invoice)}</td>
            <td className="incoming-invoice-id"><button type="button" title={invoice.tracking_id || invoice.invoice_number} onClick={() => selectInvoice(invoice)}>{invoice.invoice_number}</button></td>
            <td className="incoming-supplier"><span title={invoice.vendor_master_name || invoice.vendor_name}>{invoice.vendor_master_name || invoice.vendor_name || 'Not recorded'}</span></td>
            <td className="incoming-po"><ConfirmedPurchaseOrderLinks invoice={invoice} /></td><td className="incoming-date">{invoiceDate(invoice.invoice_date)}</td><td className={`incoming-date ${invoiceOverdue(invoice) ? 'incoming-text-red' : ''}`}>{invoiceDate(invoice.due_date)}</td><td className="incoming-amount">{invoiceMoney(invoice.total_amount, invoice.currency)}</td><td><Badge value={invoice.match_status} /></td><td><Badge value={invoice.procurement_status} /></td>
            <td><button type="button" aria-label={`Review invoice ${invoice.invoice_number}`} onClick={() => selectInvoice(invoice)} className={`incoming-row-action ${inInvoiceQueue(invoice, 'review') || inInvoiceQueue(invoice, 'exceptions') ? 'incoming-primary' : ''}`}>{inInvoiceQueue(invoice, 'review') || inInvoiceQueue(invoice, 'exceptions') ? 'Review' : 'Open'}</button></td>
          </tr>)}</tbody></table></div> : <div className="incoming-card-grid">{visible.map(invoice => <article key={invoice.id} className={selected?.id === invoice.id ? 'incoming-card-selected' : ''}><div><input type="checkbox" aria-label={`Select invoice ${invoice.invoice_number}`} checked={checked.includes(invoice.id)} onChange={() => toggleCheck(invoice.id)} />{riskCell(invoice)}<Badge value={invoice.procurement_status} /></div><button type="button" className="incoming-card-title" onClick={() => selectInvoice(invoice)}>{invoice.invoice_number}</button><p>{invoice.vendor_master_name || invoice.vendor_name || 'Supplier not recorded'}</p><strong>{invoiceMoney(invoice.total_amount, invoice.currency)}</strong><dl><dt>Due date</dt><dd>{invoiceDate(invoice.due_date)}</dd><dt>PO reference</dt><dd><ConfirmedPurchaseOrderLinks invoice={invoice} /></dd></dl><footer><Badge value={invoice.match_status} /><button type="button" className="incoming-row-action" onClick={() => selectInvoice(invoice)}>Review</button></footer></article>)}</div>}
          {!loading && !error && <footer className="incoming-pagination"><span>{visible.length ? (currentPage - 1) * pageSize + 1 : 0}–{Math.min(currentPage * pageSize, filtered.length)} of {filtered.length} invoices</span><nav aria-label="Invoice pagination"><button type="button" aria-label="Previous page" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}><ChevronLeftIcon /></button>{pagination.map((number, index) => <span key={number}>{index > 0 && number - pagination[index - 1] > 1 && <span className="incoming-page-gap">…</span>}<button type="button" aria-label={`Go to page ${number}`} aria-current={currentPage === number ? 'page' : undefined} onClick={() => setPage(number)}>{number}</button></span>)}<button type="button" aria-label="Next page" disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}><ChevronRightIcon /></button></nav><label>Rows per page<select aria-label="Rows per page" value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPage(1); }}>{[7, 10, 25, 50].map(number => <option key={number}>{number}</option>)}</select></label></footer>}
        </section>
        <section className="incoming-queue-health" aria-label="Queue health"><h2><ChartBarIcon />Queue health</h2>{[[DocumentMagnifyingGlassIcon, stats.review, 'needing review', 'amber'], [ExclamationTriangleIcon, stats.exceptions, 'exceptions', 'red'], [ClockIcon, stats.overdue, 'overdue', 'red'], [ClockIcon, null, 'median processing time', 'neutral'], [ChartBarIcon, null, 'within SLA', 'green']].map(([Icon, value, label, tone]) => <div key={label} title={value === null ? 'Processing time and SLA measurements are not recorded yet' : undefined}><Icon className={`incoming-text-${tone}`} /><span><strong>{loading || error || value === null ? '—' : value}</strong><small>{label}</small></span></div>)}</section>
      </div>
      <IncomingInvoiceReview invoice={loading || error ? null : selected} onClose={() => setPanelClosed(true)} onRefresh={load} />
    </div></div>
  </div>;
}

IncomingInvoiceWorkspace.propTypes = { onImport: PropTypes.func.isRequired, reloadKey: PropTypes.number };
