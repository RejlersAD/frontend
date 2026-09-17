/* eslint-disable react/prop-types */
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowRight, BarChart3, Check, CheckCircle2, ChevronLeft, ChevronRight, Clock3, Download, ExternalLink, FileCheck2, FileText, Filter, Home, Plus, RefreshCw, Search, ShieldCheck, ShoppingCart, Unlink, Users, X, XCircle } from 'lucide-react'
import apiClient from '../../services/api.service'
import { procurementVatLabel } from '../../utils/procurementVat'
import { Field, KeyValues, Menu } from './ProcurementRegister'
import { filterRegisterRecords, formatRegisterDate as date, formatRegisterMoney as money, normalizeRegisterRecord, registerMetrics } from './procurementRegisterModel'
import { recommendationPresentation, recommendationWorkload } from './recommendationPresentation'
import './PurchaseRecommendations.css'
import PurchaseOrderLinkReview from './PurchaseOrderLinkReview'
import { getOriginalRecommendationDocuments, getOriginalRecommendationUrl } from './recommendationSourceDocuments'

const KIND = 'purchaseRequisitions'
const FILTERS = { search: '', status: 'all', project: 'all', requester: 'all', supplier: 'all', created: 'all', savedView: 'all', myActions: false, priority: 'all', type: 'all' }
const STATUS_OPTIONS = [['all', 'All statuses'], ['draft', 'Draft'], ['review', 'In review'], ['approved', 'Approved'], ['ready_for_po', 'Ready for PO'], ['converted', 'Converted'], ['exceptions', 'Exceptions'], ['rejected', 'Rejected'], ['cancelled', 'Cancelled']]
const SAVED_VIEWS = [['all', 'All recommendations'], ['my_queue', 'My procurement queue'], ['stale', 'Drafts 30 days or older'], ['incomplete', 'Incomplete records'], ['ready_for_po', 'Ready for purchase order']]
const CREATED_OPTIONS = [['all', 'All dates'], ['today', 'Today'], ['last30', 'Last 30 days'], ['older30', 'Older than 30 days'], ['undated', 'Not recorded']]
const isComplete = status => ['approved', 'complete', 'completed'].includes(status)
const deny = () => false

function RecommendationPOLink({ record, canLink, onLink }) {
  if (record.linkedPoId) {
    const number = record.raw.linked_po_number || record.poReference || 'Linked PO'
    return <Link className="prr-po-link is-linked" to={`/procurement/orders/${record.linkedPoId}`} aria-label={`Open purchase order ${number}`} title={number} onClick={event => event.stopPropagation()}><CheckCircle2 size={13} aria-hidden="true" /><span>PO: {number}</span></Link>
  }
  return <button type="button" className="prr-po-link is-unlinked" disabled={!canLink} aria-label={`Link purchase order for ${record.number}`} title={record.poReference ? `Unlinked reference: ${record.poReference}` : 'No linked purchase order'} onClick={event => { event.stopPropagation(); onLink(record) }}><Unlink size={13} aria-hidden="true" /><span>PO: Not linked</span></button>
}

function RecommendationStatus({ record }) {
  const Icon = record.status === 'rejected' ? XCircle : record.status === 'converted' ? FileCheck2 : record.status === 'approved' ? CheckCircle2 : record.awaitingApproval ? Users : Clock3
  return <span className={`prw-status prw-${record.tone}`}><Icon size={16} /><span><span className="prr-status-label" title={record.statusLabel}>{record.statusLabel}</span><small className="prw-secondary" title="Age since this recommendation was created">{record.ageDays == null ? 'Age unavailable' : `${record.ageDays}d`}</small></span></span>
}

function RecommendationDetails({ panelRef, record, loading, error, onRetry, onOpen, onEdit, onConvert, onPdf, onAttachPdf, canModify, canConvert, pdfBusyId, converting }) {
  if (!record) return <aside ref={panelRef} tabIndex={-1} className="prw-panel prw-details" aria-label="Recommendation details"><div className="prw-panel-header"><h2>Recommendation details</h2></div><div className="prw-empty"><FileText size={32} /><h3>Select a recommendation</h3><p>Choose a record to review its sourcing decision, approvals and next step.</p></div></aside>
  const raw = record.raw
  const original = getOriginalRecommendationDocuments(raw.attachments, raw.price_remarks_data?.signed_document_verification?.document_sha256)[0]
  const originalUrl = getOriginalRecommendationUrl(original)
  const presentation = recommendationPresentation(record)
  const approved = record.approvalSummary === 'approved'
  const history = record.approvalHistory || []
  const steps = presentation.lifecycle
  const readiness = presentation.readiness
  const convertible = canConvert(raw) && record.status === 'approved' && !record.hasExistingPO && record.poApplicable
  return <aside ref={panelRef} tabIndex={-1} className="prw-panel prw-details" aria-label="Recommendation details" aria-busy={loading}>
    <div className="prw-panel-header"><div className="prr-details-title"><h2>{record.number}</h2>{originalUrl && <a className="prw-link prr-source-link" href={originalUrl} target="_blank" rel="noopener noreferrer" title={original.filename || 'Original uploaded PR'}>Open original PDF<ExternalLink size={14} aria-hidden="true" /></a>}</div><Menu label="More recommendation detail actions">{canModify(raw) && <button type="button" role="menuitem" disabled={loading || Boolean(error)} onClick={() => onEdit(raw)}>Edit recommendation</button>}{onAttachPdf && canModify(raw) && <button type="button" role="menuitem" onClick={() => onAttachPdf(raw)}>Attach signed PDF</button>}{['approved', 'converted'].includes(record.status) && <button type="button" role="menuitem" disabled={pdfBusyId === record.id || loading} onClick={() => onPdf(raw)}>Download PDF</button>}</Menu></div>
    <div className="prw-detail-body" tabIndex={0} role="region" aria-label="Recommendation decision and approvals">
      {loading && <p className="prw-secondary" role="status">Loading recommendation details…</p>}
      {error && <div className="prw-alert prw-error" role="alert"><span>{error}</span><button type="button" className="prw-link" onClick={onRetry}>Retry details</button></div>}
      <div className="prw-detail-heading"><div className="prr-detail-reference"><span className={`prw-badge prw-${record.tone}`}><CheckCircle2 size={11} />{record.statusLabel}</span>{record.priority && <span className="prw-badge prw-blue"><ShieldCheck size={11} />{record.priority} priority</span>}</div><h3>{record.title}</h3></div>
      <div className="prw-detail-meta">
        <dl className="prw-key-values">
          <div className="prr-meta-stacked"><dt>Recommended supplier</dt><dd>{record.supplier}</dd></div>
          <div className="prr-meta-stacked"><dt>Project</dt><dd>{record.project}</dd></div>
          <div><dt>Requester</dt><dd>{record.requester}</dd></div>
          <div><dt>Buyer</dt><dd>{record.buyer}</dd></div>
        </dl>
        <KeyValues rows={[
          ['Total', money(record.amount, record.currency)], ['VAT treatment', procurementVatLabel(raw.vat_basis)], ['Created', date(record.createdAt)], ['Required by', date(record.deliveryDate)],
        ]} />
      </div>
      <ol className="prw-timeline" tabIndex={0} aria-label="Recommendation lifecycle">
        {steps.map(step => <li key={step.key} className={`prw-step prr-step-${step.state}${step.state === 'complete' ? ' is-complete' : ''}${step.state === 'active' && step.key !== 'conversion' ? ' is-current' : ''}`} title={step.date ? date(step.date) : step.value}>
          <span className="prw-step-dot" aria-hidden="true">{step.state === 'complete' && <Check size={11} />}{step.state === 'rejected' && <X size={11} />}</span>
          <small>{step.label}</small><span className="prr-step-value">{step.key === 'approved' && record.status === 'approved' ? 'current' : step.state === 'complete' ? 'complete' : step.value}</span>
          <span className="prw-sr-only">{step.state === 'complete' ? 'Recorded' : step.state === 'active' ? 'Current' : 'Not recorded'}</span>
        </li>)}
      </ol>
      <section className="prr-decision"><h4>Decision summary</h4><div className="prr-decision-columns">
        <KeyValues rows={presentation.decisionLeft} /><KeyValues rows={presentation.decisionRight} />
      </div></section>
      <section className="prr-readiness"><h4>Readiness checks</h4><div className="prr-readiness-grid">{readiness.map(item => <div className="prr-readiness-item" key={item.key || item.label} title={item.detail || item.value}>{item.ready === true ? <CheckCircle2 className="prw-green" size={20} /> : item.ready === false ? <AlertTriangle className="prw-amber" size={20} /> : <Clock3 className="prw-slate" size={20} />}<span>{item.label}<strong className={item.ready === true ? 'prw-green' : item.ready === false ? 'prw-amber' : 'prw-secondary'}>{item.value}</strong></span></div>)}</div></section>
      <section className="prr-approval-history"><h4>Approval history</h4><div className="prr-history-content">
        {history.length ? <ol>{history.map((step, index) => <li className="prr-history-entry" key={`${index}-${step.label}`} title={`${step.label}: ${step.assignee}`}>
          {isComplete(step.status) ? <CheckCircle2 size={15} className="prw-green" /> : step.status === 'rejected' ? <XCircle size={15} className="prw-red" /> : <Clock3 size={15} className="prw-slate" />}
          <span className="prr-history-person"><span className="prr-history-role">{step.label}</span><span className="prr-history-name">{step.assignee === 'Not assigned' ? 'Approver not recorded' : step.assignee}</span></span><strong className={isComplete(step.status) ? 'prw-green' : step.status === 'rejected' ? 'prw-red' : 'prw-secondary'}>{step.status.replaceAll('_', ' ')}</strong><time>{date(step.date)}</time>
        </li>)}</ol> : <p className="prw-secondary">No approval stage history recorded.</p>}
        <button type="button" className="prw-link" onClick={() => onOpen(record.id)}>View approval record <ArrowRight size={12} /></button>
      </div></section>
    </div>
      <div className={`prr-conversion-footer${record.readyForPO || record.linkedPoId ? ' is-ready' : ''}`}><ShoppingCart size={23} /><div><strong>{record.linkedPoId ? 'Purchase order created' : record.status === 'converted' ? 'Conversion recorded' : record.readyForPO ? 'Ready to create purchase order' : approved ? 'Review conversion requirements' : 'Complete recommendation approval'}</strong><p>{record.linkedPoId ? 'Open the linked order to track supplier delivery.' : record.status === 'converted' ? 'The linked order is not available in this record.' : record.readyForPO ? 'Values copy into a new PO draft after final checks.' : record.status === 'approved' ? record.nextStep : 'Approval is required before creating a PO.'}</p></div><div className="prr-conversion-actions">{canModify(raw) && <button type="button" className="prw-button" disabled={loading || Boolean(error)} onClick={() => onEdit(raw)}>Edit recommendation</button>}{record.linkedPoId ? <Link className="prw-button prw-primary" to={`/procurement/orders/${record.linkedPoId}`}>View purchase order</Link> : convertible ? <button type="button" className="prw-button prw-primary" disabled={loading || Boolean(error) || converting} onClick={() => onConvert(raw)}>{converting ? 'Creating…' : record.readyForPO ? 'Create purchase order' : 'Validate & create PO'}</button> : null}</div></div>
  </aside>
}

export default function PurchaseRecommendations({ requisitions = [], loading = false, error = null, currentUserId, orderCount, onRefresh, onCreate, onImportPdf, onImportExcel, onExport, onOpen, onEdit, onDelete, onConvert, onPdf, onAttachPdf, onApproveSelected, canLinkPurchaseOrder = false, canUploadPurchaseOrder = false, canModify = deny, canDelete = deny, canConvert = deny, canApprove = deny, pdfBusyId, batchBusy = false, canCreate = true }) {
  const previewPanelRef = useRef(null)
  const previewRecord = row => {
    setSelectedId(row.id)
    window.requestAnimationFrame(() => {
      previewPanelRef.current?.focus({ preventScroll: true })
      previewPanelRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    })
  }
  const [linkRecord, setLinkRecord] = useState(null)
  const [linkUploadOpen, setLinkUploadOpen] = useState(false)
  const linkDialog = useRef(null)
  useEffect(() => {
    if (linkRecord && !linkUploadOpen) linkDialog.current?.showModal()
    else linkDialog.current?.close()
  }, [linkRecord, linkUploadOpen])
  const [filters, setFilters] = useState(FILTERS), [moreFilters, setMoreFilters] = useState(false)
  const [page, setPage] = useState(1), [pageSize, setPageSize] = useState(25), [selectedId, setSelectedId] = useState(null)
  const [sort, setSort] = useState({ key: 'createdAt', direction: 'desc' })
  const [dismissed, setDismissed] = useState(false), [detailRevision, setDetailRevision] = useState(0)
  const [detail, setDetail] = useState({ id: null, data: null, loading: false, error: '' })
  const [bulk, setBulk] = useState(false), [checkedIds, setCheckedIds] = useState([]), [converting, setConverting] = useState(false)
  const records = useMemo(() => requisitions.map(raw => normalizeRegisterRecord(raw, KIND, currentUserId)), [requisitions, currentUserId])
  const metrics = useMemo(() => registerMetrics(records, KIND), [records])
  const workload = useMemo(() => recommendationWorkload(records), [records])
  const filtered = useMemo(() => filterRegisterRecords(records, filters, currentUserId).sort((left, right) => {
    const a = left[sort.key] ?? '', b = right[sort.key] ?? ''
    const comparison = typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b), undefined, { numeric: true })
    return sort.direction === 'asc' ? comparison : -comparison
  }), [records, filters, currentUserId, sort])
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize)), currentPage = Math.min(page, pageCount)
  const offset = (currentPage - 1) * pageSize, visible = filtered.slice(offset, offset + pageSize)
  const selected = !loading && !error ? visible.find(row => String(row.id) === String(selectedId)) || visible[0] || null : null
  const activeId = selected?.id ?? null, selectedRaw = selected?.raw
  useEffect(() => {
    if (activeId == null) return undefined
    let current = true
    const controller = new AbortController()
    setDetail({ id: activeId, data: null, loading: true, error: '' })
    apiClient.get(`/procurement/requisitions/${activeId}/`, { signal: controller.signal }).then(response => {
      if (!current) return
      if (String(response.data?.id) !== String(activeId)) throw new Error('The details do not match the selected recommendation.')
      setDetail({ id: activeId, data: response.data, loading: false, error: '' })
    }).catch(problem => { if (current) setDetail({ id: activeId, data: null, loading: false, error: problem.response?.data?.detail || problem.message || 'Unable to load recommendation details.' }) })
    return () => { current = false; controller.abort() }
  }, [activeId, selectedRaw, detailRevision])
  const currentDetail = String(detail.id) === String(activeId) ? detail : { data: null, loading: Boolean(selected), error: '' }
  const detailed = selected ? normalizeRegisterRecord({ ...selected.raw, ...(currentDetail.data || {}) }, KIND, currentUserId) : null
  const change = (key, value) => { setFilters(previous => ({ ...previous, [key]: value })); setPage(1) }
  const reset = () => { setFilters(FILTERS); setPage(1) }
  const statusFilter = status => { setFilters({ ...FILTERS, status }); setPage(1) }
  const savedFilter = savedView => { setFilters({ ...FILTERS, savedView }); setPage(1) }
  const options = key => [...new Set(records.map(row => row[key]).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)))
  const drafts = records.filter(row => row.status === 'draft'), stale = drafts.filter(row => row.staleDraft), incomplete = records.filter(row => row.incomplete)
  const checked = records.filter(row => checkedIds.includes(String(row.id)))
  const approvable = checked.filter(row => canApprove(row.raw))
  const toggleChecked = id => setCheckedIds(previous => previous.includes(String(id)) ? previous.filter(value => value !== String(id)) : [...previous, String(id)])
  const allChecked = visible.length > 0 && visible.every(row => checkedIds.includes(String(row.id)))
  const convert = async raw => { if (converting) return; setConverting(true); try { await onConvert(raw) } finally { setConverting(false) } }
  const sortBy = key => setSort(previous => ({ key, direction: previous.key === key && previous.direction === 'asc' ? 'desc' : 'asc' }))
  const pages = Array.from({ length: Math.min(6, pageCount) }, (_, index) => Math.min(Math.max(1, currentPage - 2), Math.max(1, pageCount - 5)) + index)
  const chips = Object.entries(filters).filter(([key, value]) => key === 'myActions' ? value : value !== FILTERS[key]).map(([key, value]) => ({ key, label: key === 'myActions' ? 'My actions' : `${({ search: 'Search', status: 'Status', project: 'Project', requester: 'Requester', supplier: 'Supplier', created: 'Created', savedView: 'View', priority: 'Priority', type: 'Type' })[key]}: ${[...STATUS_OPTIONS, ...SAVED_VIEWS, ...CREATED_OPTIONS].find(([id]) => id === value)?.[1] || value}` }))
  const known = value => loading || error ? '—' : value

  return <section className="procurement-register-workspace purchase-recommendations-workspace" aria-label="Purchase recommendations workspace">
    <header className="prw-header"><div><nav className="prw-breadcrumb" aria-label="Breadcrumb"></nav><h1 className="prw-title">Purchase Recommendations</h1><p className="prw-subtitle">Prepare, review, approve and convert sourcing decisions into purchase orders.</p></div><div className="prw-header-right"><div className="prw-header-actions"><button type="button" className="prw-button" onClick={onRefresh} disabled={loading}><RefreshCw size={15} />Refresh</button><button type="button" className="prw-button" disabled={loading || !filtered.length} onClick={() => onExport(filtered.map(row => row.raw))}><Download size={15} />Export</button><Menu label="More recommendation actions"><button type="button" role="menuitem" disabled={!canCreate} onClick={onImportPdf}><FileText size={14} />Import signed PDF</button><button type="button" role="menuitem" disabled={!canCreate} onClick={onImportExcel}><Download size={14} />Import Excel</button></Menu><button type="button" className="prw-button prw-primary prw-new" disabled={!canCreate} onClick={onCreate}><Plus size={17} />New recommendation</button></div><nav className="prw-tabs" aria-label="Procurement registers"><Link className="prw-tab is-active" aria-current="page" to="/procurement/requisitions">Purchase Recommendations<span>{known(records.length)}</span></Link><Link className="prw-tab" to="/procurement/orders">Purchase Orders{orderCount != null && <span>{orderCount}</span>}</Link></nav></div></header>
    <div className="prw-kpis" aria-label="Recommendation statistics">{metrics.map((metric, index) => { const Icon = [FileText, Clock3, Users, CheckCircle2, ShoppingCart, FileCheck2, AlertTriangle][index] || FileText; return <button type="button" className={`prw-kpi prr-kpi-${metric.key}${filters.status === metric.filter ? ' is-selected' : ''}`} key={metric.key} onClick={() => statusFilter(metric.filter || 'all')} disabled={loading || Boolean(error)} aria-pressed={filters.status === metric.filter} title={metric.description || metric.label}><span className={`prw-kpi-icon prw-${['blue', 'amber', 'blue', 'green', 'green', 'blue', 'red'][index] || 'blue'}`}><Icon size={27} /></span><span><strong className="prw-kpi-value">{known(metric.value)}</strong><span className="prw-kpi-label">{({ review: 'In review', converted: 'Converted' })[metric.key] || metric.label}</span>{metric.key === 'draft' && records.length > 0 && !loading && !error && <small className="prr-kpi-note">{Math.round(drafts.length / records.length * 100)}% of register</small>}{metric.key === 'exceptions' && !loading && !error && <small className="prr-kpi-note">Requires review</small>}</span></button> })}</div>
    {error && <div className="prw-alert prw-error" role="alert"><AlertTriangle size={24} /><div className="prw-alert-copy"><strong>Recommendations could not be loaded</strong><p>{error.message || String(error)}</p></div><button type="button" className="prw-button" onClick={onRefresh}>Try again</button></div>}
    {!dismissed && !loading && !error && drafts.length > 0 && <div className="prw-alert prw-warning prr-banner-draft"><AlertTriangle size={31} /><div className="prw-alert-copy"><strong>{drafts.length} {drafts.length === 1 ? 'recommendation remains' : 'recommendations remain'} in draft</strong><p>{stale.length} {stale.length === 1 ? 'draft is' : 'drafts are'} 30 days or older. {incomplete.length} {incomplete.length === 1 ? 'record needs' : 'records need'} completion or evidence review.</p></div><div className="prw-alert-actions"><button type="button" className="prw-button" onClick={() => savedFilter('stale')}>Review stale drafts</button><button type="button" className="prw-button" onClick={() => savedFilter('incomplete')}>View incomplete records</button><button type="button" className="prw-button prw-icon-button" aria-label="Dismiss draft notice" onClick={() => setDismissed(true)}><X size={17} /></button></div></div>}
    <div className="prw-filters"><Field label="Saved view" value={filters.savedView} onChange={value => change('savedView', value)}>{SAVED_VIEWS.map(([value, label]) => <option key={value} value={value} disabled={value === 'my_queue' && !currentUserId}>{label}</option>)}</Field><label className="prw-field prw-search"><span className="prw-sr-only">Search recommendations</span><Search size={15} /><input value={filters.search} onChange={event => change('search', event.target.value)} placeholder="Search PR number, title, project or supplier" /></label><Field label="Status" value={filters.status} onChange={value => change('status', value)}>{STATUS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Field>{[['project', 'Project', 'All projects'], ['requester', 'Requester', 'All requesters'], ['supplier', 'Supplier', 'All suppliers']].map(([key, label, all]) => <Field key={key} label={label} value={filters[key]} onChange={value => change(key, value)}><option value="all">{all}</option>{options(key).map(value => <option key={value} value={value}>{value}</option>)}</Field>)}<Field label="Created date" value={filters.created} onChange={value => change('created', value)}>{CREATED_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Field><button type="button" className="prw-button" aria-expanded={moreFilters} onClick={() => setMoreFilters(value => !value)}><Filter size={16} />Filters</button><label className="prw-toggle"><input type="checkbox" role="switch" checked={filters.myActions} disabled={!currentUserId} onChange={event => change('myActions', event.target.checked)} /><span aria-hidden="true" />My actions</label><strong className="prw-filter-count">{known(filtered.length)} records</strong>{<div className="prr-filter-chips">{chips.map(chip => <button type="button" className="prr-filter-chip" key={chip.key} onClick={() => change(chip.key, FILTERS[chip.key])} aria-label={`Remove ${chip.label} filter`}>{chip.label}<X size={11} /></button>)}{chips.length > 0 && <button type="button" className="prw-link" onClick={reset}>Clear all</button>}</div>}</div>
    {moreFilters && <div className="prw-filter-more">{[['priority', 'Priority'], ['type', 'Requisition type']].map(([key, label]) => <Field key={key} label={label} value={filters[key]} onChange={value => change(key, value)}><option value="all">All {label.toLowerCase()}</option>{options(key).map(value => <option value={value} key={value}>{value}</option>)}</Field>)}<button type="button" className="prw-button" onClick={reset}>Clear all filters</button></div>}
    <div className="prw-grid"><div className="prw-main"><section className="prw-panel" aria-label="Recommendation register"><div className="prw-panel-header"><h2>Recommendation register</h2><Menu label="Recommendation register options"><button type="button" role="menuitem" onClick={() => setBulk(value => !value)}>{bulk ? 'Finish selecting' : 'Select records'}</button><button type="button" role="menuitem" onClick={() => onExport(filtered.map(row => row.raw))} disabled={!filtered.length}>Export filtered register</button><button type="button" role="menuitem" onClick={reset}>Reset filters</button></Menu></div>
    {bulk && <div className="prr-bulk-actions"><strong>{checked.length} selected</strong><button type="button" className="prw-button" disabled={!checked.length} onClick={() => onExport(checked.map(row => row.raw))}>Export selected</button><button type="button" className="prw-button prw-primary" disabled={!approvable.length || batchBusy || !onApproveSelected} onClick={async () => { const succeeded = await onApproveSelected(approvable.map(row => row.raw)); if (Array.isArray(succeeded)) setCheckedIds(previous => previous.filter(id => !succeeded.map(String).includes(id))) }}>{batchBusy ? 'Approving…' : `Approve selected (${approvable.length})`}</button><button type="button" className="prw-link" onClick={() => setCheckedIds([])}>Clear selection</button></div>}
    <div className="prw-table-scroll" tabIndex={0} role="region" aria-label="Recommendation register table"><table className={`prw-table prw-register-table${bulk ? ' prr-bulk-table' : ''}`} data-table-typography="preserve"><thead><tr>{bulk && <th scope="col"><input type="checkbox" aria-label="Select all visible recommendations" checked={allChecked} onChange={() => setCheckedIds(previous => allChecked ? previous.filter(id => !visible.some(row => String(row.id) === id)) : [...new Set([...previous, ...visible.map(row => String(row.id))])])} /></th>}<th scope="col">Status &amp; age</th><th scope="col" aria-sort={sort.key === 'number' ? sort.direction === 'asc' ? 'ascending' : 'descending' : 'none'}><button type="button" onClick={() => sortBy('number')}>PR number</button></th><th scope="col">Recommendation</th><th scope="col">Project</th><th scope="col">Recommended supplier</th><th scope="col" aria-sort={sort.key === 'amount' ? sort.direction === 'asc' ? 'ascending' : 'descending' : 'none'}><button type="button" onClick={() => sortBy('amount')}>Amount</button></th><th scope="col">Requester</th><th scope="col">Current owner</th><th scope="col">Next step</th><th scope="col">Action</th></tr></thead><tbody>
    {loading ? <tr><td colSpan={bulk ? 11 : 10}><div className="prw-loading" role="status"><RefreshCw size={20} />Loading recommendations…</div></td></tr> : !visible.length ? <tr><td colSpan={bulk ? 11 : 10}><div className="prw-empty"><FileText size={32} /><h3>{error ? 'Register unavailable' : records.length ? 'No matching recommendations' : 'No recommendations yet'}</h3><p>{error ? 'Refresh to try loading the register again.' : records.length ? 'Clear or adjust your filters to find a recommendation.' : 'Create a recommendation or import your existing register.'}</p>{!error && <button type="button" className="prw-button" disabled={!records.length && !canCreate} onClick={records.length ? reset : onCreate}>{records.length ? 'Clear filters' : 'New recommendation'}</button>}</div></td></tr> : visible.map(row => <tr key={row.id} className={`prr-data-row${row.id === activeId ? ' prw-selected-row' : ''}`} onClick={() => setSelectedId(row.id)}>{bulk && <td><input type="checkbox" aria-label={`Select for bulk ${row.number}`} checked={checkedIds.includes(String(row.id))} onClick={event => event.stopPropagation()} onChange={() => toggleChecked(row.id)} /></td>}<td><RecommendationStatus record={row} /></td><td><button type="button" className="prw-link prw-number" title={row.number} aria-label={`Select ${row.number}`} aria-pressed={row.id === activeId} onClick={() => setSelectedId(row.id)}>{row.number}</button><RecommendationPOLink record={row} canLink={canLinkPurchaseOrder || canUploadPurchaseOrder} onLink={setLinkRecord} /></td><td title={row.title}><span className="prr-cell-title">{row.title}</span></td><td title={row.project}><span className="prr-cell-project">{row.project}</span></td><td title={row.supplier}><span className="prr-cell-supplier">{row.supplier}</span></td><td className="prw-money"><span className="prr-cell-amount" title={money(row.amount, row.currency)}>{money(row.amount, row.currency)}</span></td><td><span className="prr-cell-text" title={row.requester}>{row.requester}</span></td><td><span className="prr-cell-text" title={row.currentOwner}>{row.currentOwner}</span></td><td className={row.approvalSummary === 'overdue' || row.hasException ? 'prw-amber' : ''}><span className="prr-cell-text" title={row.nextStep}>{row.nextStep}</span></td><td><div className="prw-row-actions"><button type="button" className="prw-button" onClick={event => { event.stopPropagation(); previewRecord(row) }}>Preview</button><Menu label={`Actions for ${row.number}`}><button type="button" role="menuitem" onClick={() => previewRecord(row)}>Preview recommendation</button>{canModify(row.raw) && <button type="button" role="menuitem" onClick={() => onEdit(row.raw)}>Edit recommendation</button>}{onAttachPdf && canModify(row.raw) && <button type="button" role="menuitem" onClick={() => onAttachPdf(row.raw)}>Attach signed PDF</button>}{['approved', 'converted'].includes(row.status) && <button type="button" role="menuitem" disabled={pdfBusyId === row.id} onClick={() => onPdf(row.raw)}>Download PDF</button>}{canDelete(row.raw) && <button type="button" role="menuitem" onClick={() => onDelete(row.raw)}>Delete recommendation</button>}</Menu></div></td></tr>)}
    </tbody></table></div><div className="prw-pagination"><span>{filtered.length ? `${offset + 1}–${Math.min(offset + pageSize, filtered.length)}` : '0'} of {filtered.length}</span><div className="prw-pages"><button type="button" className="prw-button prw-icon-button" aria-label="Previous page" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}><ChevronLeft size={15} /></button>{pages.map(value => <button type="button" className="prw-button" aria-label={`Page ${value}`} aria-current={value === currentPage ? 'page' : undefined} key={value} onClick={() => setPage(value)}>{value}</button>)}<button type="button" className="prw-button prw-icon-button" aria-label="Next page" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}><ChevronRight size={15} /></button></div><label>Rows per page<select value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPage(1) }}>{[10, 25, 50, 100].map(value => <option value={value} key={value}>{value}</option>)}</select></label></div></section>
    <section className="prw-panel prw-workload"><h2>Procurement workload</h2><div>
      {[
        [Clock3, drafts.length, 'Draft completeness', 'draft', `${stale.length} stale`, 'amber'],
        [Users, workload.technicalReviewCount, 'Awaiting technical review', 'review', null, 'blue'],
        [FileText, workload.commercialReviewCount, 'Awaiting commercial review', 'review', null, 'blue'],
        [ShoppingCart, records.filter(row => row.readyForPO).length, 'Approved awaiting PO', 'ready_for_po', null, 'green'],
        [FileCheck2, workload.convertedThisMonth, 'Converted this month', 'converted', null, 'blue'],
        [BarChart3, workload.medianCycleDays == null ? null : `${workload.medianCycleDays} days`, 'Median approval cycle', null, null, 'blue'],
      ].map(([Icon, value, label, status, note, tone]) => <button type="button" className={`prw-workload-item prr-workload-${tone}`} key={label} disabled={loading || Boolean(error) || !status} onClick={() => statusFilter(status)} title={value == null ? 'Not recorded: the required dates or review-stage assignments are unavailable.' : label}>
        <Icon size={24} /><span><strong>{known(value == null ? '\u2014' : value)}</strong><small>{label}</small>{note && !loading && !error && <small className="prw-amber">{note}</small>}</span>
      </button>)}
      <Link className="prw-link" to="/procurement">View workflow analytics <ArrowRight size={12} /></Link>
    </div></section></div>
    <RecommendationDetails panelRef={previewPanelRef} record={detailed} loading={currentDetail.loading} error={currentDetail.error} onRetry={() => setDetailRevision(value => value + 1)} onOpen={onOpen} onEdit={onEdit} onConvert={convert} onPdf={onPdf} onAttachPdf={onAttachPdf} canLinkPurchaseOrder={canLinkPurchaseOrder} canModify={canModify} canConvert={canConvert} pdfBusyId={pdfBusyId} converting={converting} />
    </div>
    <dialog ref={linkDialog} className="prr-link-dialog" aria-labelledby="prr-link-title" onCancel={() => setLinkRecord(null)}>
      <div className="prr-link-dialog-header"><h2 id="prr-link-title">Link purchase order</h2><button type="button" className="prw-button prw-icon-button" aria-label="Close purchase order linking" onClick={() => setLinkRecord(null)}><X size={18} /></button></div>
      {linkRecord && <PurchaseOrderLinkReview key={linkRecord.id} requisitionId={linkRecord.id} poLink={{ status: 'not_found', manual_link_required: true, message: `Select the purchase order for ${linkRecord.number}.` }} canLink={canLinkPurchaseOrder} canUpload={canUploadPurchaseOrder} canImportRequisition={canCreate} onUploadOpenChange={setLinkUploadOpen} onLinked={() => { setLinkRecord(null); setDetailRevision(value => value + 1); onRefresh?.() }} />}
    </dialog>
  </section>
}
