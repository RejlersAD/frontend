import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, ArrowRight, Check, CheckCircle2, ChevronLeft, ChevronRight, ExternalLink, FolderOpen, Link2, Loader2, Plus, RefreshCw, Search, ShoppingCart, Unlink } from 'lucide-react'
import apiClient from '../../services/api.service'
import PurchaseOrderForm from './PurchaseOrderForm'
import PortfolioWorkbookImport from './PortfolioWorkbookImport'
import './ProjectLinks.css'

const PAGE_SIZE = 15
const projectLabel = project => project ? [project.code, project.name].filter(Boolean).join(' · ') : 'Not connected'
const money = (amount, currency) => {
  if (amount === null || amount === undefined || amount === '') return 'Value not recorded'
  try { return new Intl.NumberFormat('en-GB', { style: 'currency', currency: currency || 'AED', maximumFractionDigits: 2 }).format(Number(amount)) }
  catch { return `${currency || ''} ${amount}`.trim() }
}
const errorMessage = (error, fallback) => {
  const body = error?.response?.data
  if (typeof body?.detail === 'string') return body.detail
  if (typeof body?.error === 'string') return body.error
  return body && typeof body === 'object' ? Object.values(body).flat().filter(item => typeof item === 'string').join(' ') || fallback : fallback
}

export default function ProjectLinks() {
  const [data, setData] = useState(null), [loading, setLoading] = useState(true), [loadError, setLoadError] = useState('')
  const [projectSearch, setProjectSearch] = useState(''), [projectId, setProjectId] = useState('')
  const [search, setSearch] = useState(''), [debouncedSearch, setDebouncedSearch] = useState(''), [filter, setFilter] = useState('unlinked')
  const [page, setPage] = useState(1), [selectedOrderId, setSelectedOrderId] = useState(''), [revision, setRevision] = useState(0)
  const [saving, setSaving] = useState(false), [saveError, setSaveError] = useState(''), [notice, setNotice] = useState(''), [conflict, setConflict] = useState(false)
  const [createProject, setCreateProject] = useState(null), [preparing, setPreparing] = useState(false)
  const requestSequence = useRef(0), mutationInFlight = useRef(false), active = useRef(true)
  useEffect(() => { active.current = true; return () => { active.current = false } }, [])
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 250)
    return () => window.clearTimeout(timer)
  }, [search])

  useEffect(() => {
    const sequence = ++requestSequence.current, controller = new AbortController()
    setLoading(true); setLoadError('')
    const params = { page, page_size: PAGE_SIZE, search: debouncedSearch,
      link_status: filter === 'unlinked' ? 'unlinked' : filter === 'project' ? 'linked' : 'all',
      ...(filter === 'project' && projectId ? { scope_id: projectId } : {}) }
    apiClient.get('/procurement/projects/link-workspace/', { params, signal: controller.signal, suppressErrorToast: true }).then(response => {
      if (controller.signal.aborted || sequence !== requestSequence.current) return
      setData(response.data); setConflict(false)
    }).catch(error => {
      if (!controller.signal.aborted && sequence === requestSequence.current) setLoadError(errorMessage(error, 'Project links could not be loaded. Please try again.'))
    }).finally(() => { if (!controller.signal.aborted && sequence === requestSequence.current) setLoading(false) })
    return () => controller.abort()
  }, [debouncedSearch, filter, page, projectId, revision])

  const projects = data?.projects || []
  const target = projects.find(project => String(project.id) === projectId)
  const visibleProjects = projects.filter(project => `${project.code} ${project.name} ${project.folder_name || ''} ${project.client_name || ''}`.toLowerCase().includes(projectSearch.trim().toLowerCase()))
  const projectRequired = filter === 'project' && !target
  const orders = !projectRequired && !loading && !loadError ? data?.purchase_orders?.results || [] : []
  const selectedOrder = orders.find(order => String(order.id) === selectedOrderId)
  const count = projectRequired ? 0 : data?.purchase_orders?.count || 0
  const totalPages = Math.max(1, data?.purchase_orders?.total_pages || 1)
  const alreadyLinked = Boolean(target?.project_id && selectedOrder?.current_project && String(selectedOrder.current_project.id) === String(target.project_id))
  const canConnect = data?.permissions?.can_connect === true
  const canCreate = data?.permissions?.can_create_po === true
  const queryPending = search.trim() !== debouncedSearch
  const targetReady = Boolean(target && (target.project_id || target.can_prepare))
  const busy = saving || preparing
  const connectEnabled = Boolean(targetReady && selectedOrder && canConnect && !alreadyLinked && !busy && !loading && !queryPending && !loadError && !conflict)
  const refresh = useCallback(() => { setSaveError(''); setRevision(value => value + 1) }, [])
  const chooseProject = project => { setProjectId(String(project.id)); setSelectedOrderId(''); setPage(1); setSaveError(''); setNotice('') }
  const changeFilter = value => { setFilter(value); setPage(1); setSelectedOrderId(''); setSaveError(''); setNotice('') }
  const chooseOrder = order => { setSelectedOrderId(String(order.id)); setSaveError(''); setNotice('') }

  const connect = async () => {
    if (!connectEnabled || mutationInFlight.current) return
    mutationInFlight.current = true; setSaving(true); setSaveError(''); setNotice('')
    const order = selectedOrder, project = target
    try {
      await apiClient.post('/procurement/projects/connect-folder-order/', {
        scope_id: project.scope_id, order_id: order.id,
        expected_project_id: order.current_project?.id ?? null,
        expected_folder_project_id: project.project_id ?? null,
      }, { suppressErrorToast: true })
      if (!active.current) return
      setNotice(`${order.po_number} is connected to ${projectLabel(project)}.`)
      setFilter('project'); setSearch(''); setDebouncedSearch(''); setPage(1); setRevision(value => value + 1)
    } catch (error) {
      if (!active.current) return
      setSaveError(errorMessage(error, 'The purchase order could not be connected. Please try again.'))
      if (error.response?.status === 409 || error.response?.data?.expected_project_id || error.response?.data?.expected_folder_project_id) setConflict(true)
    } finally { mutationInFlight.current = false; if (active.current) setSaving(false) }
  }
  const openCreate = async () => {
    if (!targetReady || !canCreate || busy || mutationInFlight.current) return
    mutationInFlight.current = true; setPreparing(true); setSaveError(''); setNotice('')
    try {
      const response = await apiClient.post('/procurement/projects/prepare-folder-project/', {
        scope_id: target.scope_id, expected_folder_project_id: target.project_id ?? null,
      }, { suppressErrorToast: true })
      if (active.current) { setCreateProject(response.data); setRevision(value => value + 1) }
    } catch (error) {
      if (!active.current) return
      setSaveError(errorMessage(error, 'The project could not be prepared for a purchase order. Please try again.'))
      if (error.response?.status === 409 || error.response?.data?.expected_folder_project_id) setConflict(true)
    } finally { mutationInFlight.current = false; if (active.current) setPreparing(false) }
  }
  const created = (order, { close = false } = {}) => {
    if (close) setCreateProject(null)
    setFilter('all'); setSearch(order?.po_number || ''); setDebouncedSearch(order?.po_number || ''); setPage(1)
    setSelectedOrderId(order?.id ? String(order.id) : ''); setRevision(value => value + 1)
    setNotice(order?.po_number ? `${order.po_number} was saved.` : 'Purchase order saved.')
  }

  return <div className="project-links-workspace">
    <header className="plw-header"><div><p className="plw-eyebrow">PROCUREMENT / 7.2</p><h1>Project Links</h1><p>Choose a project, then connect an existing purchase order or create a new one.</p></div>
      <div className="plw-header-actions"><Link className="plw-text-link" to="/procurement/projects/reconciliation/advanced">Advanced reconciliation <ExternalLink size={13} aria-hidden="true" /></Link><button type="button" className="plw-button" onClick={refresh} disabled={loading || busy}><RefreshCw size={15} aria-hidden="true" />Refresh</button></div>
    </header>
    <PortfolioWorkbookImport />
    {loadError && <div className="plw-message plw-error" role="alert"><AlertCircle size={18} aria-hidden="true" /><span>{loadError}</span><button type="button" className="plw-button" onClick={refresh}>Retry</button></div>}
    {notice && <div className="plw-message plw-success" role="status"><CheckCircle2 size={18} aria-hidden="true" /><span>{notice}</span></div>}
    <div className="plw-columns">
      <section className="plw-projects plw-panel" aria-label="Projects">
        <div className="plw-panel-heading"><div><span className="plw-step">1</span><h2>Select a project</h2></div><span className="plw-count">{projects.length}</span></div>
        <label className="plw-search"><Search size={17} aria-hidden="true" /><span className="plw-sr-only">Search projects</span><input type="search" value={projectSearch} disabled={busy} onChange={event => setProjectSearch(event.target.value)} placeholder="Project name or code" /></label>
        <div className="plw-project-list" aria-label="Project list" role="group">
          {!data && loading ? <div className="plw-empty" role="status"><Loader2 size={22} className="plw-spin" aria-hidden="true" /><p>Loading projects…</p></div> : !visibleProjects.length ? <div className="plw-empty"><FolderOpen size={27} aria-hidden="true" /><p>{loadError ? 'Projects are unavailable.' : projects.length ? 'No projects match your search.' : 'No project folders are available yet.'}</p></div> : visibleProjects.map(project => <button type="button" className={`plw-project${String(project.id) === projectId ? ' is-selected' : ''}`} key={project.id} title={project.folder_name} aria-pressed={String(project.id) === projectId} disabled={busy || loading && !data} onClick={() => chooseProject(project)}>
            <span className="plw-project-icon"><FolderOpen size={19} aria-hidden="true" /></span><span className="plw-project-copy"><span className="plw-project-code">{project.code || 'No project code'}</span><strong>{project.name}</strong><small>{project.purchase_order_count || 0} PO{project.purchase_order_count === 1 ? '' : 's'}{project.client_name ? ` · ${project.client_name}` : ''}</small></span>{String(project.id) === projectId && <Check size={17} className="plw-selected-check" aria-hidden="true" />}
          </button>)}
        </div>
        <div className="plw-project-footer">{visibleProjects.length} of {projects.length} projects</div>
      </section>

      <section className="plw-orders plw-panel" aria-label="Purchase orders">
        <div className="plw-orders-heading"><div><div className="plw-order-title"><span className="plw-step">2</span><h2>{target ? target.name : 'Select a purchase order'}</h2></div><p>{target ? <><span className="plw-project-code">{target.code}</span><span className="plw-dot">·</span>Selected project</> : 'Your selected project will appear here.'}</p></div><button type="button" className="plw-button plw-primary" disabled={!targetReady || !canCreate || busy || loading || Boolean(loadError) || conflict} onClick={openCreate} title={!target ? 'Select a project first' : !canCreate ? 'Purchase order create access is required' : `Create a PO for ${target.code}`}>{preparing ? <Loader2 size={17} className="plw-spin" aria-hidden="true" /> : <Plus size={17} aria-hidden="true" />}{preparing ? 'Preparing\u2026' : 'Create PO'}</button></div>
        <div className="plw-order-tools"><div className="plw-tabs" role="group" aria-label="Purchase order filter">{[['unlinked', 'Unlinked'], ['project', "Selected project's POs"], ['all', 'All POs']].map(([value, label]) => <button type="button" key={value} aria-pressed={filter === value} onClick={() => changeFilter(value)} disabled={busy}>{label}</button>)}</div><label className="plw-search"><Search size={16} aria-hidden="true" /><span className="plw-sr-only">Search purchase orders</span><input type="search" value={search} disabled={busy} onChange={event => { setSearch(event.target.value); setPage(1); setSelectedOrderId('') }} placeholder="Search PO number, supplier or title" /></label></div>
        <div className="plw-po-list" role="group" aria-label="Purchase order list" aria-busy={loading || queryPending}>
          {loading || queryPending ? <div className="plw-empty" role="status"><Loader2 size={24} className="plw-spin" aria-hidden="true" /><p>Loading purchase orders…</p></div> : !orders.length ? <div className="plw-empty"><ShoppingCart size={32} aria-hidden="true" /><h3>{loadError ? 'Purchase orders unavailable' : projectRequired ? 'Select a project on the left' : search ? 'No matching purchase orders' : filter === 'unlinked' ? 'All purchase orders are connected' : filter === 'project' ? 'No purchase orders connected yet' : 'No purchase orders yet'}</h3><p>{loadError ? 'Refresh to try again.' : projectRequired ? 'See the purchase orders connected to that project.' : search ? 'Try a different PO number, supplier or title.' : filter === 'project' ? 'Choose Unlinked or All POs to connect an existing order, or create a new PO.' : filter === 'unlinked' ? 'Choose All POs to review an existing connection.' : 'Create a PO for your selected project.'}</p></div> : orders.map(order => {
            const isSelected = String(order.id) === selectedOrderId, onTarget = target?.project_id && String(order.current_project?.id) === String(target.project_id)
            return <button type="button" key={order.id} className={`plw-po${isSelected ? ' is-selected' : ''}`} aria-label={`Select ${order.po_number}`} aria-pressed={isSelected} disabled={busy} onClick={() => chooseOrder(order)}>
              <span className="plw-po-select" aria-hidden="true">{isSelected && <Check size={13} />}</span><span className="plw-po-main"><span className="plw-po-reference">{order.po_number}<span className="plw-order-status">{String(order.status || 'Status unavailable').replaceAll('_', ' ')}</span></span><strong>{order.title || 'Untitled purchase order'}</strong><span className="plw-supplier">{order.vendor_name || 'Supplier not recorded'}</span><span className={`plw-assignment${onTarget ? ' on-project' : ''}`}>{order.current_project ? <Link2 size={12} aria-hidden="true" /> : <Unlink size={12} aria-hidden="true" />}{order.current_project ? projectLabel(order.current_project) : 'Not connected to a project'}</span></span><span className="plw-po-amount">{money(order.total_amount, order.currency)}<small>{order.po_date || 'Date not recorded'}</small></span>
            </button>
          })}
        </div>
        <div className="plw-pagination"><span>{loading ? 'Loading…' : `${count} purchase order${count === 1 ? '' : 's'}`}</span><div><button type="button" className="plw-button plw-icon-button" aria-label="Previous purchase orders" disabled={page <= 1 || loading || busy || projectRequired} onClick={() => { setPage(value => value - 1); setSelectedOrderId('') }}><ChevronLeft size={17} aria-hidden="true" /></button><span>Page {page} of {totalPages}</span><button type="button" className="plw-button plw-icon-button" aria-label="Next purchase orders" disabled={page >= totalPages || loading || busy || projectRequired} onClick={() => { setPage(value => value + 1); setSelectedOrderId('') }}><ChevronRight size={17} aria-hidden="true" /></button></div></div>
        <footer className="plw-connect" aria-label="Connect purchase order">
          {saveError && <div className="plw-message plw-error" role="alert"><AlertCircle size={17} aria-hidden="true" /><span>{saveError}</span>{conflict && <button type="button" className="plw-button" onClick={refresh}>Refresh records</button>}</div>}
          <div className="plw-connect-content"><div className="plw-connect-copy">{selectedOrder ? <><div><strong>{selectedOrder.po_number}</strong><Link to={`/procurement/orders/${encodeURIComponent(selectedOrder.id)}`} className="plw-text-link" aria-label={`Open ${selectedOrder.po_number}`}><ExternalLink size={13} aria-hidden="true" />Open PO</Link></div><p><span>Current: {projectLabel(selectedOrder.current_project)}</span><ArrowRight size={14} aria-hidden="true" /><span>Target: {target ? projectLabel(target) : 'Select a project'}</span></p>{selectedOrder.current_project && target && !alreadyLinked && <small className="plw-reassign">This changes the PO connection from {selectedOrder.current_project.code} to {target.code}.</small>}</> : <><strong>{target ? 'Select a PO to connect' : 'Start with a project on the left'}</strong><p>{target ? `Connect a purchase order to ${target.code}.` : 'Choose a project and a purchase order to see their connection.'}</p></>}{target && !targetReady && <small>{target.preparation_error || "This folder needs a project connection before you can add purchase orders."}</small>}{!canConnect && data && <small>Procurement update access is required to connect orders.</small>}</div><button type="button" className="plw-button plw-primary plw-connect-button" disabled={!connectEnabled} onClick={connect}>{saving ? <Loader2 size={16} className="plw-spin" aria-hidden="true" /> : alreadyLinked ? <CheckCircle2 size={16} aria-hidden="true" /> : <Link2 size={16} aria-hidden="true" />}{saving ? 'Connecting…' : alreadyLinked ? 'Connected' : 'Connect PO to project'}</button></div>
        </footer>
      </section>
    </div>
    {createProject && <PurchaseOrderForm key={createProject.id} isOpen onClose={() => setCreateProject(null)} onSuccess={created} initialProject={createProject} />}
  </div>
}
