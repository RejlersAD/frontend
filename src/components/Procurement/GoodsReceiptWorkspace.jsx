import { useCallback, useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { ArrowDownTrayIcon, ArrowPathIcon, ArrowRightIcon, BeakerIcon, ChartBarIcon, CheckCircleIcon, ChevronLeftIcon, ChevronRightIcon, ChevronUpDownIcon, ClockIcon, DocumentTextIcon, ExclamationTriangleIcon, FunnelIcon, ListBulletIcon, MagnifyingGlassIcon, PlusIcon, ShieldCheckIcon, Squares2X2Icon, XMarkIcon } from '@heroicons/react/24/outline';
import goodsReceiptsService from '../../services/goodsReceipts.service';
import GoodsReceiptReview from './GoodsReceiptReview';
import GoodsReceiptActions from './GoodsReceiptActions';
import PurchaseOrderHandoff from './PurchaseOrderHandoff';
import { RECEIPT_QUEUES, RECEIPT_FILTERS, RECEIPT_STATUS, receiptAge, receiptDate, receiptDocuments, receiptInspection, receiptNumber, receiptTone, receiptsCsv, loadReceiptPages } from './goodsReceiptPresentation';
import { receiptReviewStatus } from './goodsReceiptReviewPresentation';
import './GoodsReceiptWorkspace.css';

const awaitingOrders = params => goodsReceiptsService.availableOrders({ ...params, queue: 'awaiting' });
const reconciliationOrders = params => goodsReceiptsService.availableOrders({ ...params, queue: 'reconciliation' });
const QUEUE_ICONS = [DocumentTextIcon, MagnifyingGlassIcon, ExclamationTriangleIcon, CheckCircleIcon, XMarkIcon, BeakerIcon];
const number = value => receiptNumber(value)?.toLocaleString('en-GB', { maximumFractionDigits: 1 }) ?? '—';
const errorText = error => typeof error?.response?.data?.detail === 'string' ? error.response.data.detail : error?.message || 'Receipts could not be loaded.';
const Select = ({ label, value, options, onChange }) => <label className="grw-filter"><span>{label}</span><select aria-label={label} value={value} onChange={event => onChange(event.target.value)}><option value="">All</option>{options.map(([id, text]) => <option key={id} value={id}>{text}</option>)}</select></label>;
Select.propTypes = { label: PropTypes.string.isRequired, value: PropTypes.string.isRequired, options: PropTypes.array.isRequired, onChange: PropTypes.func.isRequired };
const Badge = ({ label, tone }) => <span className={`grw-badge grw-${tone}`}>{label}</span>;
Badge.propTypes = { label: PropTypes.string.isRequired, tone: PropTypes.string.isRequired };

export default function GoodsReceiptWorkspace({ onRecord, onOpen, onDelete, onPrint, reloadKey = 0 }) {
  const [section, setSection] = useState('register');
  const [filters, setFilters] = useState(RECEIPT_FILTERS);
  const [queue, setQueue] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);
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
  const [view, setView] = useState('list');
  const [more, setMore] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState('');
  const sequence = useRef(0);
  const checkRef = useRef(null);
  const analytics = useRef(null);
  const refresh = useCallback(() => { setRefreshKey(value => value + 1); setMessage(''); }, []);

  useEffect(() => {
    const request = ++sequence.current;
    setLoading(true); setError(''); setSummaryError(''); setSummary(null); setRows([]); setCount(null); setChecked([]);
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
  const select = receipt => { setSelectedId(receipt.id); setClosed(false); };
  const change = (key, value) => { setFilters(current => ({ ...current, [key]: value })); setPage(1); setMessage(''); };
  const changeQueue = value => { setQueue(value); setPage(1); setMessage(''); };
  const clear = () => { setFilters(RECEIPT_FILTERS); setQueue('all'); setPage(1); setOrdering('-receipt_date'); setMessage(''); };
  const sort = key => { setOrdering(current => current === key ? `-${key}` : key); setPage(1); };
  const kpis = summary?.kpis;
  const canExport = summary?.capabilities?.export === true;
  const canRecord = summary?.capabilities?.create === true;
  const pages = Math.max(1, Math.ceil((count || 0) / pageSize));
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
    { label: 'Receipts this month', metric: kpis?.receipts_this_month, icon: DocumentTextIcon, tone: 'blue' },
    { label: 'Awaiting confirmation', metric: kpis?.open_inspections, icon: ClockIcon, tone: 'amber' },
    { label: 'Missing certificates', metric: kpis?.missing_certificates, icon: DocumentTextIcon, tone: 'red' },
    { label: 'Acceptance rate', metric: kpis?.acceptance_rate, icon: ChartBarIcon, tone: 'green', suffix: '%' },
  ];
  const metricValue = (metric, suffix = '') => receiptNumber(metric?.value) === null ? '—' : `${number(metric.value)}${suffix}`;
  const sortHeading = (label, key) => <th scope="col" aria-sort={ordering.replace('-', '') === key ? ordering.startsWith('-') ? 'descending' : 'ascending' : 'none'}><button type="button" onClick={() => sort(key)}>{label}<ChevronUpDownIcon /></button></th>;
  const rowContent = receipt => {
    const age = receiptAge(receipt, summary?.as_of_date); const inspection = receiptInspection(receipt); const documents = receiptDocuments(receipt); const RiskIcon = age.tone === 'red' ? ExclamationTriangleIcon : age.tone === 'green' ? CheckCircleIcon : ClockIcon;
    return <tr key={receipt.id} className={selected?.id === receipt.id ? `grw-selected grw-selected-${age.tone}` : ''}>
      <td><input type="checkbox" aria-label={`Select receipt ${receipt.receipt_number}`} checked={checked.includes(receipt.id)} onChange={event => setChecked(current => event.target.checked ? [...current, receipt.id] : current.filter(id => id !== receipt.id))} /></td>
      <td><div className={`grw-age grw-${age.tone}`}><RiskIcon /><span>{age.label && <strong>{age.label}</strong>}{age.age}</span></div></td>
      <td><button type="button" className="grw-reference" onClick={() => select(receipt)}>{receipt.receipt_number || 'No reference'}</button></td>
      <td><strong className="grw-po" title={receipt.po_number}>{receipt.po_number || 'PO not recorded'}</strong><span className="grw-supplier" title={receipt.vendor_name}>{receipt.vendor_name || 'Supplier not recorded'}</span></td>
      <td title={receipt.project_name || undefined}>{receipt.project_number || 'Not recorded'}</td><td>{receiptDate(receipt.receipt_date)}</td>
      <td>{Array.isArray(receipt.items_received) ? `${receipt.items_received.length} ${receipt.items_received.length === 1 ? 'line' : 'lines'}` : '—'}</td>
      <td><span className={`grw-documents grw-${documents.tone}`} title={documents.note}>{documents.label}{documents.tone === 'amber' ? <ExclamationTriangleIcon /> : documents.tone === 'green' ? <CheckCircleIcon /> : null}</span></td>
      <td><Badge label={inspection.label} tone={inspection.tone} /></td><td><Badge label={receiptReviewStatus(receipt).label} tone={receiptTone(receipt.status)} /></td>
      <td><GoodsReceiptActions receipt={receipt} onOpen={onOpen} onDelete={onDelete} showOpen /></td>
    </tr>;
  };
  return <div className="goods-receipts-workspace">
    <nav className="grw-breadcrumb" aria-label="Breadcrumb"><a href="/procurement">Procurement</a><span>/</span><span>Receiving</span><span>/</span><strong>Goods receipts</strong></nav>
    <header className="grw-page-heading"><div><h1>Goods Receipts &amp; Delivery Confirmation</h1><p>Record deliveries, confirm received quantities and review supporting evidence.</p></div><div className="grw-page-actions"><span className="grw-period">{summary?.as_of_date ? new Date(`${summary.as_of_date}T12:00:00`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) : 'Receiving operations'}</span><button type="button" className="grw-button" onClick={exportRows} disabled={!canExport || loading || !count || exporting || !!error}><ArrowDownTrayIcon />{exporting ? 'Exporting…' : 'Export'}</button><button type="button" className="grw-button" onClick={refresh} disabled={loading}><ArrowPathIcon className={loading ? 'grw-spin' : ''} />Refresh</button><button type="button" className="grw-button grw-primary" onClick={() => onRecord(summary.capabilities)} disabled={!canRecord} title={canRecord ? undefined : 'Recording receipts is not available for your access'}><PlusIcon />Record goods receipt</button></div></header>
    {(message || summaryError) && <div className="grw-message" role="status">{message || `Receiving metrics could not be loaded. ${summaryError}`}{summaryError && <button type="button" className="grw-link" onClick={refresh}>Retry metrics</button>}</div>}
    <nav className="po-handoff-tabs" aria-label="Receiving workspace">{[['register', 'Receipt register'], ['awaiting', 'POs awaiting receipt / service acceptance'], ['reconciliation', 'Completed POs missing receipt evidence']].map(([id, label]) => <button type="button" key={id} aria-pressed={section === id} onClick={() => setSection(id)}>{label}</button>)}</nav>
    {section !== 'register' && <PurchaseOrderHandoff key={section} title={section === 'reconciliation' ? 'Completed POs missing receipt evidence' : 'POs awaiting receipt / service acceptance'} kind={section === 'reconciliation' ? 'reconciliation' : 'receipt'} fetchPage={section === 'reconciliation' ? reconciliationOrders : awaitingOrders} actionLabel={section === 'reconciliation' ? 'Reconcile receipt' : 'Record receipt'} onSelect={order => onRecord(summary?.capabilities, order, section === 'reconciliation')} reloadKey={reloadKey + refreshKey} />}
    <div hidden={section !== 'register'}><div className={`grw-layout ${selected ? '' : 'grw-without-review'}`}><div className="grw-main">
      <div className="grw-queues" aria-label="Receipt queues">{RECEIPT_QUEUES.map(([id, label], index) => { const Icon = QUEUE_ICONS[index]; return <button type="button" key={id} aria-pressed={queue === id} className={`${queue === id ? 'is-active' : ''} grw-queue-${id}`} onClick={() => changeQueue(id)}><Icon /><span>{label}</span><strong>{number(summary?.counts?.[id])}</strong></button>; })}</div>
      <div className="grw-kpis">{cards.map(({ label, metric, icon: Icon, tone, suffix }) => <section key={label} className={`grw-kpi grw-kpi-${tone}`} title={metric?.definition || metric?.reason || undefined}><span className="grw-kpi-icon"><Icon /></span><div><h2>{label}</h2><strong>{metricValue(metric, suffix)}</strong>{metric?.unassessed_count > 0 && <small>{metric.unassessed_count} unassessed</small>}</div></section>)}</div>
      <section className="grw-panel grw-register" aria-label="Goods receipt register" aria-busy={loading}>
        <div className="grw-toolbar"><label className="grw-queue-select"><DocumentTextIcon /><select aria-label="Receipt queue" value={queue} onChange={event => changeQueue(event.target.value)}><option value="all">All receipt queues</option><option value="pending">Awaiting confirmation</option><option value="exceptions">Receipt exceptions</option><option value="accepted">Accepted receipts</option><option value="rejected">Rejected receipts</option><option value="partial">Partially accepted</option><option value="ndt_pending">NDT pending</option><option value="missing_certificates">Missing certificates</option><option value="traceability_gaps">Traceability gaps</option></select></label><label className="grw-search"><MagnifyingGlassIcon /><input type="search" aria-label="Search goods receipts" placeholder="Search GR, PO, supplier, project or delivery note" value={filters.search} onChange={event => change('search', event.target.value)} /></label><button type="button" className="grw-button" aria-expanded={more} onClick={() => setMore(value => !value)}><FunnelIcon />More filters</button><button type="button" className="grw-button" onClick={clear}>Clear</button><span className="grw-result-count">{loading ? 'Loading…' : `${rows.length} of ${number(count)} receipts`}</span><div className="grw-view"><button type="button" aria-label="List view" aria-pressed={view === 'list'} onClick={() => setView('list')}><ListBulletIcon /></button><button type="button" aria-label="Card view" aria-pressed={view === 'cards'} onClick={() => setView('cards')}><Squares2X2Icon /></button></div></div>
        <div className="grw-filters"><Select label="Receipt status" value={filters.status} options={Object.entries(RECEIPT_STATUS)} onChange={value => change('status', value)} /><Select label="Quality status" value={filters.quality_check} options={[[ 'pending', 'Pending'], ['passed', 'Recorded pass'], ['failed', 'Failed']]} onChange={value => change('quality_check', value)} /><Select label="Supplier" value={filters.vendor} options={(summary?.filter_options?.vendors || []).map(vendor => [vendor.id, vendor.name])} onChange={value => change('vendor', value)} /><Select label="Project" value={filters.project} options={(summary?.filter_options?.projects || []).map(project => [project.id, project.number || project.name])} onChange={value => change('project', value)} /><label className="grw-filter grw-date-filter"><span>Received from</span><input type="date" aria-label="Received from" value={filters.received_from} onChange={event => change('received_from', event.target.value)} /></label><label className="grw-filter grw-date-filter"><span>to</span><input type="date" aria-label="Received to" value={filters.received_to} onChange={event => change('received_to', event.target.value)} /></label></div>
        {more && <div className="grw-more-filters"><Select label="Inspector" value={filters.inspector} options={(summary?.filter_options?.inspectors || []).map(inspector => [inspector.value, inspector.value])} onChange={value => change('inspector', value)} /><p>Queues use recorded receipt and quality status. Certificate counts compare declarations with known purchase order requirements.</p></div>}
        {view === 'list' ? <div className="grw-table-scroll" role="region" aria-label="Goods receipts table" tabIndex={0}><table className="grw-table"><colgroup>{[3, 7, 10, 14, 6, 8, 5, 7, 7, 10, 23].map((width, index) => <col key={index} style={{ width: `${width}%` }} />)}</colgroup><thead><tr><th scope="col"><input ref={checkRef} type="checkbox" aria-label="Select page receipts" checked={allChecked} disabled={!rows.length || loading} onChange={event => setChecked(event.target.checked ? rows.map(row => row.id) : [])} /></th><th scope="col">Risk / Age</th>{sortHeading('GR number', 'receipt_number')}<th scope="col">PO / Supplier</th><th scope="col">Project</th>{sortHeading('Received', 'receipt_date')}<th scope="col">Items</th><th scope="col" title="Recorded certificates against purchase order requirements">Documents</th><th scope="col">Technical checks</th><th scope="col">Status</th><th scope="col">Action</th></tr></thead><tbody>{!loading && !error && rows.map(rowContent)}</tbody></table></div> : <div className="grw-receipt-cards">{!loading && !error && rows.map(receipt => <article key={receipt.id} className={selected?.id === receipt.id ? 'is-selected' : ''}><button type="button" className="grw-card-identity" onClick={() => select(receipt)}><DocumentTextIcon /><strong>{receipt.receipt_number}</strong><span>{receipt.po_number}</span><span>{receipt.vendor_name || 'Supplier not recorded'}</span><Badge label={receiptReviewStatus(receipt).label} tone={receiptTone(receipt.status)} /><span>Received {receiptDate(receipt.receipt_date)}</span></button><GoodsReceiptActions receipt={receipt} onOpen={onOpen} onDelete={onDelete} showOpen /></article>)}</div>}
        {loading && <div className="grw-empty" role="status"><ArrowPathIcon className="grw-spin" />Loading goods receipts…</div>}{!loading && error && <div className="grw-empty" role="alert"><strong>Receipts could not be loaded</strong><p>{error}</p><button type="button" className="grw-button" onClick={refresh}>Try again</button></div>}{!loading && !error && !rows.length && <div className="grw-empty"><strong>No receipts match this queue</strong><p>Clear your filters or select another receipt queue.</p><button type="button" className="grw-button" onClick={clear}>Show all receipts</button></div>}
        <footer className="grw-pagination"><span>{checked.length ? `${checked.length} selected` : count ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, count)} of ${number(count)} receipts` : 'No receipts to show'}</span><div><button type="button" aria-label="Previous receipt page" disabled={page === 1 || loading} onClick={() => setPage(value => value - 1)}><ChevronLeftIcon /></button><span>Page {page} of {pages}</span><button type="button" aria-label="Next receipt page" disabled={page >= pages || loading} onClick={() => setPage(value => value + 1)}><ChevronRightIcon /></button></div><label>Rows per page<select aria-label="Rows per page" value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPage(1); }}>{[6, 12, 24, 50].map(size => <option key={size}>{size}</option>)}</select></label></footer>
      </section>
      <section className="grw-panel grw-health"><header><h2><ChartBarIcon />Receiving health</h2><button type="button" className="grw-link" onClick={() => analytics.current?.showModal()}>View quality analytics<ArrowRightIcon /></button></header><div className="grw-health-metrics">{[
        { label: 'Awaiting confirmation', value: metricValue(kpis?.open_inspections), Icon: ClockIcon, tone: 'amber' },
        { label: 'Certificates missing', value: metricValue(kpis?.missing_certificates), Icon: DocumentTextIcon, tone: 'red' },
        { label: 'NCR open', value: '—', Icon: ExclamationTriangleIcon, tone: 'red', note: 'NCR records are not connected' },
        { label: 'Avg. inspection time', value: '—', Icon: ClockIcon, tone: 'blue', note: 'Inspection event times are not recorded' },
        { label: 'Acceptance rate', value: metricValue(kpis?.acceptance_rate, '%'), Icon: ChartBarIcon, tone: 'blue' },
        { label: 'Traceability recorded', value: metricValue(kpis?.traceability_coverage, '%'), Icon: ShieldCheckIcon, tone: 'green', note: kpis?.traceability_coverage?.definition || 'Required heat-number declarations; full item traceability is not verified' },
      ].map(({ label, value, Icon, tone, note }) => <div key={label} title={note}><Icon className={`grw-${tone}`} /><div><strong>{value}</strong><span>{label}</span></div></div>)}</div><p>Based on filtered receipts before queue selection. Unrecorded measures remain unavailable.</p></section>
    </div>{selected && <GoodsReceiptReview receipt={selected} asOfDate={summary?.as_of_date} capabilities={summary?.capabilities} onClose={() => setClosed(true)} onOpen={onOpen} onDelete={onDelete} onPrint={onPrint} onChanged={refresh} />}</div>
    </div>
    <dialog ref={analytics} className="grw-dialog" aria-labelledby="grw-analytics-title" onKeyDown={event => { if (event.key !== 'Tab') return; const buttons = [...event.currentTarget.querySelectorAll('button')]; if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons.at(-1).focus(); } else if (!event.shiftKey && document.activeElement === buttons.at(-1)) { event.preventDefault(); buttons[0].focus(); } }}><header><h2 id="grw-analytics-title">Receiving quality analytics</h2><button type="button" aria-label="Close quality analytics" onClick={() => analytics.current.close()}><XMarkIcon /></button></header><p>Current receipt register · {receiptDate(summary?.as_of_date)}</p>{cards.map(({ label, metric, suffix }) => <section key={label}><h3>{label}<strong>{metricValue(metric, suffix)}</strong></h3><p>{metric?.definition || metric?.reason || (label === 'Receipts this month' ? `Received ${receiptDate(metric?.period_start)} to ${receiptDate(metric?.period_end)}.` : 'Recorded receipt status in the filtered register.')}</p></section>)}<p>Technical inspection duration and NCR status are unavailable. Delivery confirmation details are shown on each receipt.</p><button type="button" className="grw-button" onClick={() => analytics.current.close()}>Close</button></dialog>
  </div>;
}
GoodsReceiptWorkspace.propTypes = { onRecord: PropTypes.func.isRequired, onOpen: PropTypes.func.isRequired, onDelete: PropTypes.func.isRequired, onPrint: PropTypes.func.isRequired, reloadKey: PropTypes.number };
