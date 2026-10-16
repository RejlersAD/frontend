import { useCallback, useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { ArchiveBoxIcon, ArrowDownTrayIcon, ArrowPathIcon, CalendarDaysIcon, CheckCircleIcon, ChevronLeftIcon, ChevronRightIcon, ChevronUpDownIcon, ClockIcon, CubeIcon, DocumentTextIcon, EllipsisVerticalIcon, ExclamationTriangleIcon, FunnelIcon, MagnifyingGlassIcon, PaperClipIcon, PlusIcon } from '@heroicons/react/24/outline';
import goodsReceiptsService from '../../services/goodsReceipts.service';
import GoodsReceiptReview from './GoodsReceiptReview';
import GoodsReceiptActions from './GoodsReceiptActions';
import PurchaseOrderHandoff from './PurchaseOrderHandoff';
import { RECEIPT_FILTERS, RECEIPT_STATUS, receiptDate, receiptDocuments, receiptFilterMonth, receiptNumber, receiptRecentActivity, receiptTone, receiptsCsv, loadReceiptPages } from './goodsReceiptPresentation';
import { receiptReviewStatus } from './goodsReceiptReviewPresentation';
import './GoodsReceiptWorkspace.css';

const awaitingOrders = params => goodsReceiptsService.availableOrders({ ...params, queue: 'awaiting' });
const reconciliationOrders = params => goodsReceiptsService.availableOrders({ ...params, queue: 'reconciliation' });
const QUEUES = [['all', 'All'], ['pending', 'Awaiting'], ['partial', 'Partial'], ['exceptions', 'Exceptions'], ['accepted', 'Accepted']];
const number = value => receiptNumber(value)?.toLocaleString('en-GB', { maximumFractionDigits: 1 }) ?? '—';
const errorText = error => typeof error?.response?.data?.detail === 'string' ? error.response.data.detail : error?.message || 'Receipts could not be loaded.';
const Select = ({ label, value, options, onChange }) => <label className="grw-filter"><span>{label}</span><select aria-label={label} value={value} onChange={event => onChange(event.target.value)}><option value="">{label}</option>{options.map(([id, text]) => <option key={id} value={id}>{text}</option>)}</select></label>;
Select.propTypes = { label: PropTypes.string.isRequired, value: PropTypes.string.isRequired, options: PropTypes.array.isRequired, onChange: PropTypes.func.isRequired };

export default function GoodsReceiptWorkspace({ onRecord, onOpen, onDelete, onPrint, reloadKey = 0 }) {
  const [section, setSection] = useState('register');
  const [filters, setFilters] = useState(RECEIPT_FILTERS);
  const [queue, setQueue] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [ordering, setOrdering] = useState('-receipt_date');
  const [summary, setSummary] = useState(null);
  const [rows, setRows] = useState([]);
  const [count, setCount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [summaryError, setSummaryError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedId, setSelectedId] = useState(null);
  const [closed, setClosed] = useState(false);
  const [checked, setChecked] = useState([]);
  const [actionId, setActionId] = useState(null);
  const [more, setMore] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState('');
  const sequence = useRef(0);
  const checkRef = useRef(null);
  const refresh = useCallback(() => { setRefreshKey(value => value + 1); setMessage(''); }, []);

  useEffect(() => {
    const request = ++sequence.current;
    setLoading(true); setError(''); setSummaryError(''); setSummary(null); setRows([]); setCount(null); setChecked([]); setActionId(null);
    const timer = setTimeout(async () => {
      const params = { ...filters, queue, ordering };
      const [register, totals] = await Promise.allSettled([goodsReceiptsService.list({ ...params, page, page_size: pageSize }), goodsReceiptsService.summary(params)]);
      if (request !== sequence.current) return;
      if (register.status === 'rejected' && register.reason?.response?.status === 404 && page > 1 && totals.status === 'fulfilled' && Number.isInteger(totals.value?.filtered_count) && totals.value.filtered_count <= (page - 1) * pageSize) { setPage(Math.max(1, Math.ceil(totals.value.filtered_count / pageSize))); return; }
      if (register.status === 'fulfilled' && Array.isArray(register.value?.results) && Number.isInteger(register.value.count)) { setRows(register.value.results); setCount(register.value.count); }
      else setError(register.status === 'rejected' ? errorText(register.reason) : 'The receipt register returned an invalid response.');
      if (totals.status === 'fulfilled' && totals.value?.schema_version === '1.0') setSummary(totals.value);
      else setSummaryError(totals.status === 'rejected' ? errorText(totals.reason) : 'Receiving metrics are not available.');
      setLoading(false);
    }, filters.search ? 250 : 0);
    return () => { clearTimeout(timer); sequence.current += 1; };
  }, [filters, queue, page, pageSize, ordering, refreshKey, reloadKey]);
  const selected = closed || loading || error ? null : rows.find(row => row.id === selectedId) || rows[0] || null;
  const allChecked = rows.length > 0 && rows.every(row => checked.includes(row.id));
  useEffect(() => { if (checkRef.current) checkRef.current.indeterminate = !allChecked && checked.length > 0; }, [allChecked, checked]);
  const select = receipt => { setSelectedId(receipt.id); setClosed(false); setActionId(null); };
  const change = (key, value) => { setFilters(current => ({ ...current, [key]: value })); setPage(1); setMessage(''); };
  const changeQueue = value => { setQueue(value); setPage(1); setMessage(''); };
  const clear = () => { setFilters(RECEIPT_FILTERS); setQueue('all'); setPage(1); setOrdering('-receipt_date'); setMessage(''); };
  const sort = key => { setOrdering(current => current === key ? `-${key}` : key); setPage(1); };
  const canExport = summary?.capabilities?.export === true;
  const canRecord = summary?.capabilities?.create === true;
  const pages = Math.max(1, Math.ceil((count || 0) / pageSize));
  const activity = receiptRecentActivity(rows);
  const filtered = Object.values(filters).some(Boolean) || queue !== 'all';
  const filterMonth = receiptFilterMonth(filters);
  const exportRows = async () => {
    if (!canExport) return;
    setExporting(true); setMessage('');
    try {
      const exported = checked.length ? rows.filter(row => checked.includes(row.id)) : await loadReceiptPages(goodsReceiptsService.list, { ...filters, queue, ordering });
      const url = URL.createObjectURL(new Blob([receiptsCsv(exported)], { type: 'text/csv;charset=utf-8;' }));
      const link = document.createElement('a'); link.href = url; link.download = 'RADAI-goods-receipts.csv'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage(`Exported ${exported.length} ${checked.length ? 'selected' : 'filtered'} receipts.`);
    } catch (exportError) { setMessage(errorText(exportError)); }
    finally { setExporting(false); }
  };
  const cards = [
    { label: 'Awaiting confirmation', value: summary?.counts?.pending, icon: CubeIcon, tone: 'blue', note: 'Recorded deliveries to confirm' },
    { label: 'Partially accepted', value: summary?.counts?.partial, icon: ArchiveBoxIcon, tone: 'amber', note: 'Some received items rejected' },
    { label: 'Exceptions', value: summary?.counts?.exceptions, icon: ExclamationTriangleIcon, tone: 'red', note: 'Rejected receipts or failed quality checks' },
    { label: 'Accepted receipts', value: summary?.counts?.accepted, icon: CheckCircleIcon, tone: 'green', note: 'Accepted within selected filters' },
  ];
  const sortHeading = (label, key) => <th scope="col" aria-sort={ordering.replace('-', '') === key ? ordering.startsWith('-') ? 'descending' : 'ascending' : 'none'}><button type="button" onClick={() => sort(key)}>{label}<ChevronUpDownIcon /></button></th>;
  const rowContent = receipt => {
    const documents = receiptDocuments(receipt);
    const status = receiptReviewStatus(receipt);
    const StatusIcon = receipt.status === 'accepted' ? CheckCircleIcon : ['partial', 'rejected'].includes(receipt.status) ? ExclamationTriangleIcon : ClockIcon;
    const attachmentCount = Array.isArray(receipt.attachments) ? receipt.attachments.length : null;
    return <tr key={receipt.id} className={selected?.id === receipt.id ? 'grw-selected' : ''}>
      <td><input type="checkbox" aria-label={`Select receipt ${receipt.receipt_number}`} checked={checked.includes(receipt.id)} onChange={event => setChecked(current => event.target.checked ? [...current, receipt.id] : current.filter(id => id !== receipt.id))} /></td>
      <td><button type="button" className="grw-reference" title={receipt.po_number} onClick={() => select(receipt)}>{receipt.po_number || 'PO not recorded'}</button><span className="grw-receipt-number">{receipt.receipt_number || 'Receipt number not recorded'}</span></td>
      <td><span className="grw-supplier" title={receipt.vendor_name}>{receipt.vendor_name || 'Not recorded'}</span></td>
      <td title={receipt.project_name || undefined}>{receipt.project_number || '—'}</td><td>{receiptDate(receipt.receipt_date)}</td>
      <td>{Array.isArray(receipt.items_received) ? receipt.items_received.length : '—'}</td>
      <td><span className={`grw-badge grw-${receiptTone(receipt.status)}`} title={status.label}><StatusIcon />{receipt.status === 'pending' ? 'Awaiting' : receipt.status === 'partial' ? 'Partial' : RECEIPT_STATUS[receipt.status] || status.label}</span></td>
      <td>{attachmentCount > 0 ? <button type="button" className="grw-evidence-link" onClick={() => select(receipt)} title={`${attachmentCount} recorded attachments; not independently verified`}><PaperClipIcon />{attachmentCount} {attachmentCount === 1 ? 'file' : 'files'}</button> : <span className={`grw-evidence grw-${documents.tone}`} title={documents.note}><DocumentTextIcon />{documents.tone === 'amber' ? 'Missing' : attachmentCount === 0 ? 'No files' : 'Unknown'}</span>}</td>
      <td><div className="grw-row-actions"><button type="button" className="grw-row-action" aria-label={`Review receipt ${receipt.receipt_number || ''}`} onClick={() => select(receipt)}>Review</button><button type="button" className="grw-more-action" aria-label={`More actions for ${receipt.receipt_number || 'receipt'}`} aria-expanded={actionId === receipt.id} aria-controls={`grw-actions-${receipt.id}`} onClick={() => setActionId(current => current === receipt.id ? null : receipt.id)}><EllipsisVerticalIcon /></button></div></td>
    </tr>;
  };
  const actionReceipt = rows.find(row => row.id === actionId);

  return <div className="goods-receipts-workspace">
    <div className="grw-topline"><nav className="grw-breadcrumb" aria-label="Breadcrumb"><a href="/procurement">Procurement</a><span>/</span><span>Goods Receipts</span></nav><div className="grw-page-actions"><label className={`grw-period ${filterMonth ? '' : 'grw-period-unselected'}`}><CalendarDaysIcon />{!filterMonth && <span className="grw-period-placeholder" aria-hidden="true">{filters.received_from || filters.received_to ? 'Custom dates' : 'All dates'}</span>}<span className="grw-sr-only">Receipt month</span><input aria-label="Receipt month" type="month" value={filterMonth} onChange={event => {
      const value = event.target.value;
      const [year, month] = value.split('-').map(Number);
      setFilters(current => ({ ...current, received_from: value ? `${value}-01` : '', received_to: value ? `${value}-${new Date(year, month, 0).getDate()}` : '' })); setPage(1);
    }} /></label><button type="button" className="grw-button" onClick={exportRows} disabled={!canExport || loading || !count || exporting || !!error}><ArrowDownTrayIcon />{exporting ? 'Exporting…' : 'Export'}</button><button type="button" className="grw-button grw-primary" aria-label="Record goods receipt" onClick={() => onRecord(summary.capabilities)} disabled={!canRecord} title={canRecord ? undefined : 'Recording receipts is not available for your access'}><PlusIcon />Record receipt</button><button type="button" className="grw-freshness" aria-label="Refresh receipts" onClick={refresh} disabled={loading} title={summary?.generated_at ? `Metrics generated ${receiptDate(summary.generated_at, true)}` : 'Refresh receipts'}><span className={loading || error || summaryError ? 'is-pending' : ''} />{loading ? 'Updating…' : error || summaryError ? 'Retry update' : 'Data refreshed'}<ArrowPathIcon className={loading ? 'grw-spin' : ''} /></button></div></div>
    <header className="grw-page-heading"><h1>Goods Receipts &amp; Delivery Confirmation</h1><p>Confirm delivered goods and services against approved purchase orders.</p></header>
    {(message || summaryError) && <div className="grw-message" role="status">{message || `Receiving metrics could not be loaded. ${summaryError}`}{summaryError && <button type="button" className="grw-link" onClick={refresh}>Retry metrics</button>}</div>}
    <div className="grw-kpis" aria-label="Receipt metrics">{cards.map(({ label, value, icon: Icon, tone, note }) => <article className={`grw-kpi grw-kpi-${tone}`} key={label}><span className="grw-kpi-icon"><Icon aria-hidden="true" /></span><div><h2>{label}</h2><strong>{number(value)}</strong><p>{note}</p></div></article>)}</div>
    <nav className="grw-workspace-tabs" aria-label="Receiving workspace">{[['register', 'Receipt register'], ['awaiting', 'POs awaiting receipt / service acceptance'], ['reconciliation', 'Completed POs missing receipt evidence']].map(([id, label]) => <button type="button" key={id} aria-pressed={section === id} onClick={() => setSection(id)}>{label}</button>)}</nav>
    {section !== 'register' && <PurchaseOrderHandoff key={section} title={section === 'reconciliation' ? 'Completed POs missing receipt evidence' : 'POs awaiting receipt / service acceptance'} kind={section === 'reconciliation' ? 'reconciliation' : 'receipt'} fetchPage={section === 'reconciliation' ? reconciliationOrders : awaitingOrders} actionLabel={section === 'reconciliation' ? 'Reconcile receipt' : 'Record receipt'} onSelect={order => onRecord(summary?.capabilities, order, section === 'reconciliation')} reloadKey={reloadKey + refreshKey} />}
    <div hidden={section !== 'register'}><div className="grw-layout"><div className="grw-main">
      <section className="grw-panel grw-register" aria-label="Goods receipt register">
        <header className="grw-panel-heading"><div><h2>Receipt queue</h2><p>Recorded deliveries requiring confirmation and review</p></div>{filtered && <button type="button" className="grw-link" onClick={clear}>Clear filters</button>}</header>
        <div className="grw-toolbar"><label className="grw-search"><MagnifyingGlassIcon /><input type="search" aria-label="Search receipts" placeholder="Search PO, supplier, project or receipt…" value={filters.search} onChange={event => change('search', event.target.value)} /></label><Select label="Status" value={filters.status} options={Object.entries(RECEIPT_STATUS)} onChange={value => change('status', value)} /><Select label="Supplier" value={filters.vendor} options={(summary?.filter_options?.vendors || []).map(vendor => [vendor.id, vendor.name])} onChange={value => change('vendor', value)} /><Select label="Project" value={filters.project} options={(summary?.filter_options?.projects || []).map(project => [project.id, [project.number, project.name].filter(Boolean).join(' · ')])} onChange={value => change('project', value)} /><button type="button" className="grw-button" aria-expanded={more} aria-controls="grw-more-filters" onClick={() => setMore(value => !value)}><FunnelIcon />More filters</button></div>
        {more && <div className="grw-more-filters" id="grw-more-filters"><Select label="Quality checks" value={filters.quality_check} options={[['passed', 'Recorded pass'], ['failed', 'Failed'], ['pending', 'Pending without exceptions']]} onChange={value => change('quality_check', value)} /><Select label="Inspector" value={filters.inspector} options={(summary?.filter_options?.inspectors || []).map(inspector => [inspector.value, inspector.value])} onChange={value => change('inspector', value)} /><Select label="Evidence queue" value={['ndt_pending', 'missing_certificates', 'traceability_gaps', 'rejected'].includes(queue) ? queue : ''} options={[['ndt_pending', 'NDT pending'], ['missing_certificates', 'Missing certificates'], ['traceability_gaps', 'Traceability gaps'], ['rejected', 'Rejected']]} onChange={value => changeQueue(value || 'all')} /><label>Received from<input aria-label="Received from" type="date" value={filters.received_from} onChange={event => change('received_from', event.target.value)} /></label><label>Received to<input aria-label="Received to" type="date" value={filters.received_to} onChange={event => change('received_to', event.target.value)} /></label></div>}
        <nav className="grw-queues" aria-label="Receipt queues">{QUEUES.map(([id, label]) => <button type="button" key={id} className={queue === id ? 'is-active' : ''} aria-pressed={queue === id} title={id === 'pending' ? 'Awaiting confirmation' : id === 'partial' ? 'Partially accepted receipts' : undefined} onClick={() => changeQueue(id)}>{label}<span>{number(summary?.counts?.[id])}</span></button>)}</nav>
        <div className="grw-table-scroll" role="region" aria-label="Goods receipts table" tabIndex={0}><table className="grw-table"><colgroup>{[3, 20, 17, 8, 11, 5, 13, 10, 13].map((width, index) => <col key={index} style={{ width: `${width}%` }} />)}</colgroup><thead><tr><th scope="col"><input ref={checkRef} type="checkbox" aria-label="Select page receipts" checked={allChecked} disabled={!rows.length || loading} onChange={event => setChecked(event.target.checked ? rows.map(row => row.id) : [])} /></th><th scope="col">PO / Receipt number</th><th scope="col">Supplier</th><th scope="col">Project</th>{sortHeading('Receipt date', 'receipt_date')}<th scope="col">Items</th><th scope="col">Receipt status</th><th scope="col">Evidence</th><th scope="col">Action</th></tr></thead><tbody>{!loading && !error && rows.map(rowContent)}</tbody></table></div>
        {actionReceipt && <div className="grw-expanded-actions" id={`grw-actions-${actionReceipt.id}`} onKeyDown={event => { if (event.key === 'Escape') { setActionId(null); document.querySelector(`[aria-controls="grw-actions-${CSS.escape(String(actionReceipt.id))}"]`)?.focus(); } }}><strong>{actionReceipt.receipt_number}</strong><GoodsReceiptActions receipt={actionReceipt} onOpen={receipt => { setActionId(null); onOpen(receipt); }} onDelete={receipt => { setActionId(null); onDelete(receipt); }} showOpen /></div>}
        {loading && <div className="grw-empty" role="status"><ArrowPathIcon className="grw-spin" />Loading goods receipts…</div>}{!loading && error && <div className="grw-empty" role="alert"><strong>Receipts could not be loaded</strong><p>{error}</p><button type="button" className="grw-button" onClick={refresh}>Try again</button></div>}{!loading && !error && !rows.length && <div className="grw-empty"><ArchiveBoxIcon /><strong>No receipts match this queue</strong><p>Clear your filters or record a delivery to get started.</p><button type="button" className="grw-button" onClick={clear}>Show all receipts</button></div>}
        <footer className="grw-pagination"><span>{checked.length ? `${checked.length} selected` : count ? `Showing ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, count)} of ${number(count)}` : 'No receipts to show'}</span><label>Rows per page:<select aria-label="Rows per page" value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPage(1); }}>{[5, 10, 25, 50].map(size => <option key={size}>{size}</option>)}</select></label><div><button type="button" aria-label="Previous receipt page" disabled={page === 1 || loading} onClick={() => setPage(value => value - 1)}><ChevronLeftIcon /></button>{Array.from({ length: Math.min(3, pages) }, (_, index) => Math.max(1, Math.min(page - 1, pages - 2)) + index).map(value => <button type="button" key={value} aria-label={`Receipt page ${value}`} aria-current={value === page ? 'page' : undefined} disabled={loading} onClick={() => setPage(value)}>{value}</button>)}<button type="button" aria-label="Next receipt page" disabled={page >= pages || loading} onClick={() => setPage(value => value + 1)}><ChevronRightIcon /></button></div></footer>
      </section>
      <section className="grw-panel grw-activity" aria-label="Recent receipt activity"><header className="grw-panel-heading"><h2>Recent receipt activity</h2><span>From receipts on this page</span></header>{activity.length ? <ol>{activity.map(event => { const Icon = event.tone === 'green' ? CheckCircleIcon : event.tone === 'red' ? ExclamationTriangleIcon : DocumentTextIcon; return <li key={event.id}><span className={`grw-activity-icon grw-${event.tone}`}><Icon /></span><div><button type="button" onClick={() => select(event.receipt)}>{event.label}</button><p>{[event.receipt.po_number, event.receipt.vendor_name, event.receipt.project_number && `Project ${event.receipt.project_number}`].filter(Boolean).join(' · ')}</p></div><time dateTime={event.at}>{receiptDate(event.at, true)}</time></li>; })}</ol> : <p className="grw-activity-empty">{loading ? 'Loading recorded activity…' : 'No recorded activity is available for these receipts.'}</p>}</section>
    </div><GoodsReceiptReview receipt={selected} asOfDate={summary?.as_of_date} capabilities={summary?.capabilities} onClose={() => setClosed(true)} onOpen={onOpen} onDelete={onDelete} onPrint={onPrint} onChanged={refresh} /></div></div>
  </div>;
}
GoodsReceiptWorkspace.propTypes = { onRecord: PropTypes.func.isRequired, onOpen: PropTypes.func.isRequired, onDelete: PropTypes.func.isRequired, onPrint: PropTypes.func.isRequired, reloadKey: PropTypes.number };
