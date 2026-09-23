/* eslint-disable react/prop-types */
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AlertTriangle, ArrowRight, BarChart3, Check, CheckCircle2, ChevronLeft, ChevronRight, Clock3, Database, Download, FileCheck2, FileText, Filter, History, Home, Link2, MoreHorizontal, Plus, RefreshCw, Search, Send, ShoppingCart, Truck, Unlink, X } from 'lucide-react'
import apiClient from '../../services/api.service'
import { procurementVatLabel } from '../../utils/procurementVat'
import { purchaseOrderLifecycleBlockReason } from '../../utils/procurementApproval'
import { filterRegisterRecords, formatRegisterDate as date, formatRegisterMoney as money, normalizeRegisterRecord, registerMetrics } from './procurementRegisterModel'
import './ProcurementRegister.css'
import UploadedPurchaseOrderPreview from './UploadedPurchaseOrderPreview'
import PurchaseRequisitionLinkDialog from './PurchaseRequisitionLinkDialog'

const KIND = 'purchaseOrders'
const INITIAL_FILTERS = { search: '', status: 'all', supplier: 'all', project: 'all', buyer: 'all', delivery: 'all', savedView: 'all', myActions: false, priority: 'all', type: 'all' }
const STATUS_OPTIONS = [['all', 'All statuses'], ['pending_reconciliation', 'Pending reconciliation'], ['draft', 'Draft'], ['review', 'Awaiting approval'], ['issued', 'Issued'], ['acknowledgement', 'Awaiting acknowledgement'], ['acknowledged', 'Acknowledged'], ['in_delivery', 'In delivery'], ['completed', 'Completed'], ['cancelled', 'Cancelled']]
const STATUS_ALIASES = { sent: 'issued', awaiting_approval: 'review', under_review: 'review', in_progress: 'in_delivery', partially_received: 'in_delivery' }
const ICONS = { shopping_cart: ShoppingCart, cart: ShoppingCart, orders: ShoppingCart, file: FileText, document: FileText, draft: FileText, clock: Clock3, review: Clock3, send: Send, issued: Send, alert: AlertTriangle, warning: AlertTriangle, acknowledgement: AlertTriangle, truck: Truck, delivery: Truck, check: CheckCircle2, completed: CheckCircle2, database: Database, value: Database }

export const isRegisterControl = target => Boolean(target.closest('button, a, input, select, textarea, label, summary, [role="button"], [role="link"], [role="checkbox"], [role="menuitem"], [role="switch"], [role="combobox"], [role="textbox"], [contenteditable]:not([contenteditable="false"])'))

export function Menu({ label, children }) {
  const [open, setOpen] = useState(false)
  const root = useRef(null), trigger = useRef(null), popup = useRef(null)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const toggle = () => {
    const rect = trigger.current.getBoundingClientRect()
    setPosition({ top: Math.min(rect.bottom + 5, window.innerHeight - 210), left: Math.max(8, Math.min(rect.right - 200, window.innerWidth - 208)) })
    setOpen(value => !value)
  }
  useEffect(() => {
    if (!open) return undefined
    const close = event => { if (!root.current?.contains(event.target) && !popup.current?.contains(event.target)) setOpen(false) }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [open])
  const keyDown = event => {
    // Portal events also bubble through the logical menu parent in React.
    event.stopPropagation()
    if (event.key === 'Escape') { event.preventDefault(); setOpen(false); trigger.current?.focus() }
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault()
      if (!open) { toggle(); return }
      const items = [...popup.current.querySelectorAll('button:not(:disabled)')]
      const index = items.indexOf(document.activeElement)
      items[event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + (event.key === 'ArrowUp' ? -1 : 1) + items.length) % items.length]?.focus()
    }
  }
  return <div className="prw-menu" ref={root} onKeyDown={keyDown} onClick={event => event.stopPropagation()}>
    <button type="button" className="prw-button prw-icon-button" aria-label={label} aria-haspopup="menu" aria-expanded={open} ref={trigger} onClick={toggle}><MoreHorizontal size={18} /></button>
    {open && createPortal(<div className="procurement-register-workspace prw-menu-portal" ref={popup} style={{ position: 'fixed', ...position, width: 200, padding: 0, minHeight: 0, background: 'transparent', zIndex: 80 }} onKeyDown={keyDown}><div className="prw-dropdown" style={{ position: 'static', margin: 0 }} role="menu" aria-label={label} onClick={() => setOpen(false)}>{children}</div></div>, document.body)}
  </div>
}

export function Field({ label, value, onChange, children }) {
  return <label className="prw-field"><span>{label}</span><select value={value} onChange={event => onChange(event.target.value)}>{children}</select></label>
}

function Status({ record }) {
  const Icon = record.tone === 'green' ? CheckCircle2 : record.tone === 'red' ? AlertTriangle : Clock3
  return <span className={`prw-status prw-${record.tone || 'slate'}`}><Icon size={16} /><span><span className="pow-status-label" title={record.statusLabel}>{record.statusLabel}</span><small className="prw-secondary" title="Age since this record was created">{record.ageDays == null ? 'Age unavailable' : `${record.ageDays}d`}</small></span></span>
}

function CheckRow({ label, value, ready }) {
  return <div><span>{ready === true ? <CheckCircle2 size={13} className="prw-green" /> : ready === false ? <AlertTriangle size={13} className="prw-amber" /> : <Clock3 size={13} className="prw-slate" />}{label}</span><strong className={ready === true ? 'prw-green' : ready === false ? 'prw-amber' : 'prw-secondary'}>{value}</strong></div>
}

export function KeyValues({ rows }) {
  return <dl className="prw-key-values">{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value ?? '—'}</dd></div>)}</dl>
}

function RequisitionLinkStatus({ record, onLink, onEditDocument, canEdit = true }) {
  if (record.linkedPrId) return <Link className="prw-pr-link is-linked" to={`/procurement/requisitions/${record.linkedPrId}`} title={`Open purchase recommendation: ${record.linkedPrNumber || 'Linked PR'}`} onClick={event => event.stopPropagation()}><CheckCircle2 size={13} aria-hidden="true" /><span>{record.linkedPrNumber || 'Linked PR'}</span></Link>
  return <button type="button" className="prw-pr-link is-unlinked" title="Link a purchase recommendation" disabled={!canEdit} aria-label={`Reconcile purchase recommendation for ${record.number}`} onClick={event => { event.stopPropagation(); if (record.isPendingDocument) onEditDocument(record.raw.po_document_id); else onLink(record.raw) }}><Unlink size={13} aria-hidden="true" /><span>Not reconciled</span></button>
}

function PendingDocumentDetails({ record, onEditDocument, onDeleteDocument, canEdit, canDelete }) {
  return <aside className="prw-panel prw-details" aria-label="Uploaded purchase order details" tabIndex={-1}>
    <div className="prw-panel-header"><h2>{record.number}</h2><span className="prw-badge prw-amber">Pending reconciliation</span></div>
    <div className="prw-detail-body" tabIndex={0} role="region" aria-label="Uploaded purchase order detail content">
      <div className="prw-detail-heading"><p className="prw-secondary">{record.number}</p><RequisitionLinkStatus record={record} onEditDocument={onEditDocument} canEdit={canEdit} /><h3 className="prw-pending-title" title={record.title}>{record.title}</h3></div>
      <KeyValues rows={[
        ['Supplier in PDF', record.supplier], ['Project in PDF', record.project],
        ['Document value', money(record.amount, record.currency)], ['Order date in PDF', date(record.date)],
        ['Source file', record.raw.source_filename || 'Uploaded PDF'], ['Uploaded', date(record.createdAt, { includeTime: true })],
      ]} />
      <div className="pow-source-preview"><UploadedPurchaseOrderPreview documentId={record.raw.po_document_id} filename={record.raw.source_filename} /></div><div className="prw-detail-footer">{canEdit && <button className="prw-button" type="button" onClick={() => onEditDocument(record.raw.po_document_id)}>Edit</button>}{canDelete && <Menu label="Uploaded PDF actions"><button role="menuitem" type="button" onClick={() => onDeleteDocument(record.raw)}>Delete uploaded PDF</button></Menu>}</div>
    </div>
  </aside>
}

function OrderDetails({ record, loading, error, onOpen, onEdit, onLink, onPdf, onAcknowledge, onRetry, onIssue, onPreviewDocument, onEditDocument, onDeleteDocument, pdfBusy, canEdit, canDelete }) {
  const navigate = useNavigate()
  if (record?.isPendingDocument) return <PendingDocumentDetails record={record} onPreviewDocument={onPreviewDocument} onEditDocument={onEditDocument} onDeleteDocument={onDeleteDocument} canEdit={canEdit} canDelete={canDelete} />
  if (!record) return <aside className="prw-panel prw-details" aria-label="Purchase order details"><div className="prw-panel-header"><h2>Purchase order details</h2></div><div className="prw-empty"><ShoppingCart size={32} /><h3>Select a purchase order</h3><p>Choose an order in the register to review its details and next step.</p></div></aside>
  const raw = record.raw
  const approved = record.approvalSummary === 'approved'
  const issued = ['sent', 'acknowledged', 'in_progress', 'partially_received', 'completed'].includes(record.status)
  const acknowledged = Boolean(raw.confirmation_date || ['acknowledged', 'in_progress', 'partially_received', 'completed'].includes(record.status))
  const steps = [
    ['Draft', true, false], ['Submitted', approved || record.awaitingApproval || issued, record.awaitingApproval],
    ['Approved', approved, !issued && approved], ['Issued', issued, issued && !acknowledged],
    ['Acknowledged', acknowledged, acknowledged && record.status !== 'completed'],
    ['Received', record.receiptPercent === 100, false], ['Invoice matched', record.invoiceMatch === 'Matched', false], ['Closed', record.status === 'completed', record.status === 'completed'],
  ]
  const items = record.items || []
  return <aside className="prw-panel prw-details" aria-label="Purchase order details" aria-busy={loading} tabIndex={-1}>
    <div className="prw-panel-header"><h2>{record.number}</h2><div className="prw-detail-tools">
      <button className="prw-link" type="button" onClick={() => onPdf(raw)} disabled={loading || pdfBusy}><FileText size={12} />{pdfBusy ? 'Preparing PDF…' : 'Download order PDF'}</button>
      <button className="prw-link" type="button" onClick={() => onOpen(record.id)}><Link2 size={12} />View approval record</button>
      <Menu label="More detail actions"><button type="button" role="menuitem" onClick={() => onOpen(record.id)}><History size={14} />Order history</button>{canEdit && record.status !== 'completed' && <button type="button" role="menuitem" onClick={() => onEdit(raw)}>Edit order</button>}</Menu>
    </div></div>
    <div className="prw-detail-body" tabIndex={0} role="region" aria-label="Purchase order detail content">
      {loading && <p className="prw-secondary" role="status">Loading current order details…</p>}
      {error && <div className="prw-alert prw-error" role="alert"><span>{error}</span><button type="button" className="prw-link" onClick={onRetry}>Retry details</button></div>}
      <div className="prw-detail-heading"><p className="prw-secondary">{record.number}</p><h3>{record.title}</h3><div className="prw-detail-badges"><span className={`prw-badge prw-${record.tone}`}><CheckCircle2 size={12} />{record.statusLabel}</span>{record.awaitingAcknowledgement && <span className="prw-badge prw-amber"><Clock3 size={12} />Awaiting acknowledgement</span>}</div></div>
      <div className="prw-detail-meta"><KeyValues rows={[
        ['Supplier', record.supplier], ['Source PR', <RequisitionLinkStatus key='source-pr' record={record} onLink={onLink} canEdit={canEdit && !loading && !error} />],
        ['Project', record.project], ['Buyer', record.buyer],
      ]} /><KeyValues rows={[
        ['Order value', money(record.amount, record.currency)], ['Currency', record.currency || 'Not recorded'], ['Order date', date(record.date)], ['Promised delivery', date(record.deliveryDate)], ['Supplier reference', raw.seller_reference || 'Not recorded'],
      ]} /></div>
      <ol className="prw-timeline" tabIndex={0} aria-label="Purchase order lifecycle">{steps.map(([label, complete, current]) => <li className={`prw-step${complete ? ' is-complete' : ''}${current ? ' is-current' : ''}`} key={label}><span className="prw-step-dot" aria-hidden="true">{complete && <Check size={11} />}</span><small>{label}</small><span className="prw-sr-only">{complete ? 'Recorded' : 'Not recorded'}</span></li>)}</ol>
      {record.awaitingAcknowledgement && <div className="prw-alert prw-warning"><AlertTriangle size={21} /><div className="prw-alert-copy"><strong>Supplier acknowledgement is pending</strong><p>Confirm the supplier has accepted the order before marking it acknowledged.</p></div><button className="prw-button prw-primary" type="button" onClick={() => onAcknowledge(raw)} disabled={!canEdit || loading || Boolean(error)}>Mark acknowledged</button></div>}
      {record.awaitingApproval && <div className="prw-alert prw-warning"><Clock3 size={20} /><div className="prw-alert-copy"><strong>Purchase order is awaiting approval</strong><p>Review the current approval stage and supporting order documents.</p></div><button className="prw-button" type="button" onClick={() => onOpen(record.id)}>Review</button></div>}
      {!issued && approved && raw.can_send_to_vendor !== true && <p id="po-register-issue-block-reason" className="prw-alert prw-warning" role="status">{purchaseOrderLifecycleBlockReason(raw)}</p>}
      <div className="prw-readiness"><section><h4>Order readiness and controls</h4><div className="prw-checks">
        <CheckRow label="Approval record" ready={approved} value={approved ? 'Recorded' : record.awaitingApproval ? 'Awaiting approval' : 'Not recorded'} />
        <CheckRow label="Supplier" ready={Boolean(raw.vendor)} value={raw.vendor ? 'Selected' : 'Not linked'} />
        <CheckRow label="Project link" ready={Boolean(raw.enterprise_project || raw.project)} value={raw.enterprise_project || raw.project ? 'Linked' : 'Not linked'} />
        <CheckRow label="Delivery date" ready={Boolean(record.deliveryDate)} value={record.deliveryDate ? 'Recorded' : 'Not set'} />
        <CheckRow label="Payment terms" ready={Boolean(raw.payment_terms)} value={raw.payment_terms ? 'Recorded' : 'Not set'} />
      </div></section><section><h4>Financial & fulfilment</h4><KeyValues rows={[
        ['Ordered', money(record.amount, record.currency)], ['VAT', raw.tax_amount == null ? 'Not available' : money(raw.tax_amount, record.currency)], ['VAT treatment', procurementVatLabel(raw.vat_basis)],
        ['Receipt progress', record.receiptPercent == null ? 'Not available' : `${record.receiptPercent}%`], ['Invoice matching', record.invoiceMatch || 'Not available'], ['No. of lines', items.length || 'Not recorded'],
      ]} /></section></div>
      <section className="prw-items"><h4>Line items</h4><div className="prw-table-scroll" tabIndex={0} role="region" aria-label="Purchase order line items"><table className="prw-table" data-table-typography="preserve"><thead><tr><th scope="col">#</th><th scope="col">Description</th><th scope="col">Qty</th><th scope="col">Unit</th><th scope="col">Total</th></tr></thead><tbody>{items.length ? items.map((item, index) => <tr key={item.id || index}><td>{String(index + 1).padStart(3, '0')}</td><td>{item.description || item.item_description || item.name || 'Not recorded'}</td><td>{item.quantity ?? item.qty ?? '—'}</td><td>{item.unit || item.unit_of_measure || '—'}</td><td>{money(item.total ?? item.total_amount ?? item.total_price ?? item.amount, record.currency)}</td></tr>) : <tr><td colSpan={5} className="prw-secondary">{loading ? 'Loading line items…' : 'No line items recorded.'}</td></tr>}</tbody></table></div></section>
      <div className="prw-detail-footer"><button className="prw-link" type="button" onClick={() => navigate('/procurement/receipts')}><Truck size={14} />Open receipts <ArrowRight size={13} /></button>{!issued && approved && <button type="button" className="prw-button prw-primary" onClick={() => onIssue(raw)} disabled={!canEdit || loading || Boolean(error) || raw.can_send_to_vendor !== true} aria-describedby={raw.can_send_to_vendor !== true ? 'po-register-issue-block-reason' : undefined}><Send size={14} />Issue order</button>}{canEdit && record.status !== 'completed' && <button type="button" className="prw-button" onClick={() => onEdit(raw)}>Edit order</button>}</div>
    </div>
  </aside>
}

export default function ProcurementRegister({ orders, loading, error, pendingUploadError, pendingUploadLoading = false, currentUserId, requisitionCount, onRefresh, onCreate, onImportPdf, onImportExcel, onPreviewDocument, onEditDocument, onDeleteDocument, onExport, onOpen, onEdit, onDelete, onIssue, onPdf, onAcknowledge, pdfBusy, canCreate = true, canEdit = true, canDelete = true }) {
  const location = useLocation()
  const requestedStatus = new URLSearchParams(location.search).get('status') || 'all'
  const mappedStatus = STATUS_ALIASES[requestedStatus] || requestedStatus
  const urlStatus = STATUS_OPTIONS.some(([value]) => value === mappedStatus) ? mappedStatus : 'all'
  const [filters, setFilters] = useState(() => ({ ...INITIAL_FILTERS, status: urlStatus })), [moreFilters, setMoreFilters] = useState(false)
  const [page, setPage] = useState(1), [pageSize, setPageSize] = useState(25), [selectedId, setSelectedId] = useState(null)
  const [dismissedAlert, setDismissedAlert] = useState(false), [detailRevision, setDetailRevision] = useState(0)
  const [linkOrder, setLinkOrder] = useState(null), [linkNotice, setLinkNotice] = useState('')
  const [detail, setDetail] = useState({ id: null, data: null, error: '', loading: false })
  const [sort, setSort] = useState({ key: 'createdAt', direction: 'desc' })
  useEffect(() => {
    // Dashboard deep links filter the register locally so portfolio totals stay intact.
    setFilters({ ...INITIAL_FILTERS, status: urlStatus })
    setPage(1)
    setSelectedId(null)
    setDismissedAlert(false)
  }, [location.key, urlStatus])
  const records = useMemo(() => orders.map(row => normalizeRegisterRecord(row, KIND, currentUserId)), [orders, currentUserId])
  const actualOrders = useMemo(() => records.filter(row => !row.isPendingDocument), [records])
  const metrics = useMemo(() => registerMetrics(records, KIND), [records])
  const filtered = useMemo(() => filterRegisterRecords(records, filters, currentUserId).sort((left, right) => {
    const a = left[sort.key] ?? '', b = right[sort.key] ?? ''
    const comparison = typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b), undefined, { numeric: true })
    return sort.direction === 'asc' ? comparison : -comparison
  }), [records, filters, currentUserId, sort])
  const exportableRows = filtered.filter(row => !row.isPendingDocument).map(row => row.raw)
  const filteredPendingCount = filtered.filter(row => row.isPendingDocument).length
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize)), currentPage = Math.min(page, pageCount)
  const offset = (currentPage - 1) * pageSize, visible = filtered.slice(offset, offset + pageSize)
  const selected = visible.find(row => String(row.id) === String(selectedId)) || visible[0] || null
  const selectedRaw = selected?.raw, activeId = selected?.id ?? null
  useEffect(() => {
    if (activeId == null) return undefined
    if (selectedRaw?.is_pending_document) {
      setDetail({ id: activeId, data: selectedRaw, error: '', loading: false })
      return undefined
    }
    let current = true
    const controller = new AbortController()
    setDetail({ id: activeId, data: null, error: '', loading: true })
    apiClient.get(`/procurement/orders/${activeId}/`, { signal: controller.signal }).then(response => {
      if (current) {
        if (String(response.data?.id) !== String(activeId)) throw new Error('The order details do not match the selected record.')
        setDetail({ id: activeId, data: response.data, error: '', loading: false })
      }
    }).catch(problem => { if (current) setDetail({ id: activeId, data: null, error: problem.response?.data?.detail || problem.message || 'Unable to load order details.', loading: false }) })
    return () => { current = false; controller.abort() }
  }, [activeId, selectedRaw, detailRevision])
  const currentDetail = String(detail.id) === String(activeId) ? detail : { data: null, error: '', loading: Boolean(selected) }
  const detailed = selected ? normalizeRegisterRecord({ ...selected.raw, ...(currentDetail.data || {}) }, KIND, currentUserId) : null
  const change = (key, value) => { setFilters(previous => ({ ...previous, [key]: value })); setPage(1) }
  const setStatus = value => { setFilters({ ...INITIAL_FILTERS, status: value === 'value' ? 'all' : value }); setPage(1); setDismissedAlert(false) }
  const options = key => [...new Set(records.map(row => row[key]).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)))
  const acknowledgementCount = records.filter(row => row.awaitingAcknowledgement).length
  const alertsVisible = acknowledgementCount > 0 && !dismissedAlert
  const needsDraftCompletion = records.filter(row => row.status === 'draft' && !row.awaitingApproval).length
  const approvals = records.filter(row => row.awaitingApproval).length
  const upcoming = filterRegisterRecords(actualOrders, { ...INITIAL_FILTERS, delivery: 'next14' }, currentUserId).length
  const preview = row => {
    if (row.isPendingDocument) {
      onPreviewDocument(row.raw.po_document_id)
      return
    }
    onOpen(row.id)
  }
  const sortBy = key => setSort(previous => ({ key, direction: previous.key === key && previous.direction === 'asc' ? 'desc' : 'asc' }))
  const beginLink = order => { setLinkNotice(''); setLinkOrder(order) }
  const linked = recommendation => {
    setLinkNotice(`${linkOrder.po_number} linked to ${recommendation.pr_number}.`)
    setLinkOrder(null)
    setDetailRevision(value => value + 1)
    onRefresh?.()
  }
  const pages = Array.from({ length: Math.min(6, pageCount) }, (_, index) => Math.min(Math.max(1, currentPage - 2), Math.max(1, pageCount - 5)) + index)
  return <section className="procurement-register-workspace purchase-orders-workspace" aria-label="Purchase orders workspace">
    <header className="prw-header"><div><nav className="prw-breadcrumb" aria-label="Breadcrumb"><Link to="/"><Home size={13} /><span className="prw-sr-only">Home</span></Link><ChevronRight size={10} /><Link to="/procurement">Procurement</Link><span>/</span><span>Purchase Orders</span></nav><h1 className="prw-title">Purchase Orders</h1><p className="prw-subtitle">Issue approved orders, track supplier acknowledgement, delivery, receipt and invoice matching.</p></div><div className="prw-header-right"><div className="prw-header-actions"><button type="button" className="prw-button" onClick={onRefresh} disabled={loading}><RefreshCw size={15} />Refresh</button><button type="button" className="prw-button" onClick={() => onExport(exportableRows)} disabled={loading || !exportableRows.length}><Download size={15} />Export register</button><Menu label="More purchase order actions"><button type="button" role="menuitem" disabled={!canCreate} onClick={onImportPdf}><FileText size={14} />Import signed PDF</button><button type="button" role="menuitem" disabled={!canCreate} onClick={onImportExcel}><Download size={14} />Import Excel</button></Menu><button type="button" className="prw-button prw-primary prw-new" disabled={!canCreate} onClick={onCreate}><Plus size={17} />New purchase order</button></div><nav className="prw-tabs" aria-label="Procurement registers"><Link className="prw-tab" to="/procurement/requisitions">Purchase Recommendations{requisitionCount != null && <span>{requisitionCount}</span>}</Link><Link className="prw-tab is-active" aria-current="page" to="/procurement/orders">Purchase Orders<span>{loading || error ? '—' : actualOrders.length}</span></Link></nav></div></header>
    <div className="prw-kpis" aria-label="Purchase order statistics">{metrics.map((metric, index) => {
      const Icon = ICONS[metric.icon] || [ShoppingCart, FileText, Clock3, Send, AlertTriangle, Truck, CheckCircle2, Database][index] || Database
      return <button type="button" className={`prw-kpi${filters.status === metric.filter && metric.key !== 'value' ? ' is-selected' : ''}`} key={metric.key} onClick={() => setStatus(metric.filter || 'all')} title={metric.description || metric.title || metric.details || metric.label} disabled={loading} aria-pressed={filters.status === metric.filter && metric.key !== 'value'}><span className={`prw-kpi-icon prw-${metric.tone || 'blue'}`}><Icon size={26} /></span><span><strong className="prw-kpi-value">{loading || error ? '—' : metric.value}</strong><span className="prw-kpi-label">{metric.label}</span></span></button>
    })}</div>
    {linkNotice && <div className="prw-alert" role="status"><CheckCircle2 size={20} /><span>{linkNotice}</span></div>}
    {error && <div className="prw-alert prw-error" role="alert"><AlertTriangle size={24} /><div className="prw-alert-copy"><strong>Purchase orders could not be loaded</strong><p>{error.message || String(error)}</p></div><button type="button" className="prw-button" onClick={onRefresh}>Try again</button></div>}
    {pendingUploadLoading && <div className="prw-alert" role="status"><RefreshCw size={20} /><span>Loading uploaded PDFs…</span></div>}
    {pendingUploadError && <div className="prw-alert prw-warning" role="alert"><AlertTriangle size={22} /><div className="prw-alert-copy"><strong>Uploaded PDFs could not be loaded</strong><p>{pendingUploadError}</p></div><button type="button" className="prw-button" onClick={onRefresh}>Retry</button></div>}
    {alertsVisible && !loading && <div className="prw-alert prw-warning"><AlertTriangle size={31} /><div className="prw-alert-copy"><strong>{acknowledgementCount} issued purchase {acknowledgementCount === 1 ? 'order requires' : 'orders require'} supplier acknowledgement</strong><p>Confirm supplier acceptance and review the promised delivery dates on each order.</p></div><div className="prw-alert-actions"><button type="button" className="prw-button" onClick={() => setStatus('acknowledgement')}>Review acknowledgement queue</button><button type="button" className="prw-button prw-icon-button" aria-label="Dismiss acknowledgement notice" onClick={() => setDismissedAlert(true)}><X size={17} /></button></div></div>}
    <div className="prw-filters"><Field label="Saved view" value={filters.savedView} onChange={value => change('savedView', value)}><option value="all">All purchase orders</option><option value="open">Open order commitments</option><option value="draft">Draft orders</option><option value="review">Awaiting approval</option><option value="approved">Approved orders</option></Field><label className="prw-field prw-search"><span className="prw-sr-only">Search purchase orders</span><Search size={15} /><input value={filters.search} onChange={event => change('search', event.target.value)} placeholder="Search PO, PR, supplier, project or description…" /></label><Field label="Status" value={filters.status} onChange={value => change('status', value)}>{STATUS_OPTIONS.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</Field><Field label="Supplier" value={filters.supplier} onChange={value => change('supplier', value)}><option value="all">All suppliers</option>{options('supplier').map(value => <option value={value} key={value}>{value}</option>)}</Field><Field label="Project" value={filters.project} onChange={value => change('project', value)}><option value="all">All projects</option>{options('project').map(value => <option value={value} key={value}>{value}</option>)}</Field><Field label="Buyer" value={filters.buyer} onChange={value => change('buyer', value)}><option value="all">All buyers</option>{options('buyer').map(value => <option value={value} key={value}>{value}</option>)}</Field><Field label="Delivery date" value={filters.delivery} onChange={value => change('delivery', value)}><option value="all">All dates</option><option value="next14">Next 14 days</option><option value="overdue">Past delivery date</option><option value="undated">Not set</option></Field><button className="prw-button" type="button" aria-expanded={moreFilters} onClick={() => setMoreFilters(value => !value)}><Filter size={16} />Filters</button><label className="prw-toggle"><input type="checkbox" role="switch" checked={filters.myActions} onChange={event => change('myActions', event.target.checked)} disabled={!currentUserId} /><span aria-hidden="true" />My actions</label><strong className="prw-filter-count">{filtered.length - filteredPendingCount} orders{filteredPendingCount > 0 && ` · ${filteredPendingCount} pending PDFs`}</strong></div>
    {moreFilters && <div className="prw-filter-more"><p>Choose a saved view, status, supplier, project, buyer or delivery window to narrow this register.</p><button type="button" className="prw-button" onClick={() => { setFilters(INITIAL_FILTERS); setPage(1) }}>Clear all filters</button></div>}
    <div className="prw-grid"><div className="prw-main"><section className="prw-panel" aria-label="Purchase order register"><div className="prw-panel-header"><h2>Purchase order register</h2><Menu label="Register options"><button type="button" role="menuitem" onClick={() => onExport(exportableRows)} disabled={!exportableRows.length}>Export filtered register</button><button type="button" role="menuitem" onClick={() => { setFilters(INITIAL_FILTERS); setPage(1) }}>Reset filters</button></Menu></div><div className="prw-table-scroll" tabIndex={0} role="region" aria-label="Purchase order register table"><table className="prw-table prw-register-table" data-table-typography="preserve"><thead><tr><th scope="col">Status &amp; age</th><th scope="col" aria-sort={sort.key === 'number' ? sort.direction === 'asc' ? 'ascending' : 'descending' : 'none'}><button onClick={() => sortBy('number')} type="button">PO number</button></th><th scope="col">Order / Supplier</th><th scope="col">Project</th><th scope="col" aria-sort={sort.key === 'amount' ? sort.direction === 'asc' ? 'ascending' : 'descending' : 'none'}><button onClick={() => sortBy('amount')} type="button">Value</button></th><th scope="col">Order date</th><th scope="col">Promised delivery</th><th scope="col">Receipt</th><th scope="col">Invoice match</th><th scope="col">Next step</th><th scope="col">Action</th></tr></thead><tbody>
      {loading ? <tr><td colSpan={11}><div className="prw-loading" role="status"><RefreshCw size={20} />Loading purchase orders…</div></td></tr> : !visible.length && pendingUploadLoading ? <tr><td colSpan={11}><div className="prw-loading">Checking uploaded PDFs…</div></td></tr> : !visible.length ? <tr><td colSpan={11}><div className="prw-empty"><ShoppingCart size={32} /><h3>{error ? 'Register unavailable' : records.length ? 'No matching purchase orders' : 'No purchase orders yet'}</h3><p>{error ? 'Refresh to try loading your orders again.' : records.length ? 'Clear or adjust your filters to find an order.' : 'Create an order or import your existing purchase order register.'}</p>{!error && <button className="prw-button" type="button" disabled={!records.length && !canCreate} onClick={records.length ? () => setFilters(INITIAL_FILTERS) : onCreate}>{records.length ? 'Clear filters' : 'New purchase order'}</button>}</div></td></tr> : visible.map(row => <tr key={row.id} className={`pow-data-row${row.id === activeId ? ' prw-selected-row' : ''}`} onClick={() => setSelectedId(row.id)} onDoubleClick={event => { if (!isRegisterControl(event.target)) preview(row) }}><td><Status record={row} /></td><td><button type="button" className="prw-link prw-number" title={row.number} aria-label={`Select ${row.number}`} aria-pressed={row.id === activeId} onClick={() => setSelectedId(row.id)}>{row.number}</button><RequisitionLinkStatus record={row} onLink={beginLink} onEditDocument={onEditDocument} canEdit={canEdit} /></td><td><span className="pow-cell-title" title={row.title}>{row.title}</span><small className="prw-secondary pow-cell-meta" title={[row.supplier, row.isPendingDocument && row.raw.source_filename].filter(Boolean).join(' | ')}>{row.supplier}{row.isPendingDocument && <> | <FileText size={11} aria-hidden="true" /> {row.raw.source_filename}</>}</small></td><td><span className="pow-cell-text" title={row.project}>{row.raw.enterprise_project_code || row.raw.project_number || row.project}</span></td><td className="prw-money"><span className="pow-cell-single" title={money(row.amount, row.currency)}>{money(row.amount, row.currency)}</span></td><td><span className="pow-cell-text" title={date(row.date)}>{date(row.date)}</span></td><td><span className="pow-cell-text" title={date(row.deliveryDate)}>{date(row.deliveryDate)}</span></td><td>{row.receiptPercent == null ? <span className="prw-secondary" title="Receipt progress is not available in this register">—</span> : <span className={`prw-badge ${row.receiptPercent === 100 ? 'prw-green' : 'prw-slate'}`}>{row.receiptPercent}%</span>}</td><td><span className="pow-cell-text prw-secondary" title={row.invoiceMatch || 'Not available'}>{row.invoiceMatch || 'Not available'}</span></td><td className={row.awaitingAcknowledgement || row.isDeliveryOverdue ? 'prw-amber' : ''}><span className="pow-cell-text" title={row.nextStep}>{row.nextStep}</span></td><td><div className="prw-row-actions"><button type="button" className="prw-button" onClick={event => { event.stopPropagation(); preview(row) }}>Preview</button>{row.isPendingDocument ? <Menu label={`Actions for ${row.number}`}><button role="menuitem" type="button" onClick={() => preview(row)}>Preview</button>{canEdit && <button role="menuitem" type="button" onClick={() => onEditDocument(row.raw.po_document_id)}>Edit uploaded PDF</button>}{canDelete && <button role="menuitem" type="button" onClick={() => onDeleteDocument(row.raw)}>Delete uploaded PDF</button>}</Menu> : <Menu label={`Actions for ${row.number}`}><button role="menuitem" type="button" onClick={() => preview(row)}>Preview</button>{canEdit && row.status !== 'completed' && <button role="menuitem" type="button" onClick={() => onEdit(row.raw)}>Edit order</button>}<button role="menuitem" type="button" onClick={() => onPdf(row.raw)}>Download PDF</button>{canDelete && <button role="menuitem" type="button" onClick={() => onDelete(row.raw)}>Delete order</button>}</Menu>}</div></td></tr>)}
    </tbody></table></div><div className="prw-pagination"><span>{filtered.length ? `${offset + 1}–${Math.min(offset + pageSize, filtered.length)}` : '0'} of {filtered.length}</span><div className="prw-pages"><button type="button" className="prw-button prw-icon-button" aria-label="Previous page" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}><ChevronLeft size={15} /></button>{pages.map(value => <button type="button" className={`prw-button${value === currentPage ? ' prw-primary' : ''}`} aria-label={`Page ${value}`} aria-current={value === currentPage ? 'page' : undefined} key={value} onClick={() => setPage(value)}>{value}</button>)}<button type="button" className="prw-button prw-icon-button" aria-label="Next page" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}><ChevronRight size={15} /></button></div><label>Rows per page<select value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPage(1) }}>{[10, 25, 50, 100].map(value => <option key={value} value={value}>{value}</option>)}</select></label></div></section>
    <section className="prw-panel prw-workload"><h2>Order workload</h2><div>{[[FileText, needsDraftCompletion, 'Drafts needing completion', 'draft'], [Clock3, approvals, 'Awaiting approval', 'review'], [AlertTriangle, acknowledgementCount, 'Acknowledgement pending', 'acknowledgement'], [Truck, upcoming, 'Deliveries due in 14 days', 'upcoming'], [FileCheck2, '—', 'Receipt exceptions', null], [FileText, '—', 'Invoice-match exceptions', null]].map(([Icon, value, label, action]) => <button type="button" className="prw-workload-item" key={label} disabled={!action || loading} onClick={() => action === 'upcoming' ? change('delivery', 'next14') : setStatus(action)} title={action ? `View ${label.toLowerCase()}` : 'Not available in the current register'}><Icon size={23} /><span><strong>{loading || error ? '—' : value}</strong><small>{label}</small></span></button>)}<Link className="prw-link" to="/procurement"><BarChart3 size={19} />View procurement analytics <ArrowRight size={12} /></Link></div></section></div>
    <OrderDetails record={!loading && (!error || detailed?.isPendingDocument) ? detailed : null} loading={currentDetail.loading} error={currentDetail.error} onOpen={onOpen} onEdit={onEdit} onLink={beginLink} onPdf={onPdf} onAcknowledge={onAcknowledge} onRetry={() => setDetailRevision(value => value + 1)} onIssue={onIssue} onPreviewDocument={onPreviewDocument} onEditDocument={onEditDocument} onDeleteDocument={onDeleteDocument} pdfBusy={pdfBusy} canEdit={canEdit} canDelete={canDelete} />
    </div>
    {linkOrder && <PurchaseRequisitionLinkDialog order={linkOrder} onClose={() => setLinkOrder(null)} onLinked={linked} />}
  </section>
}
