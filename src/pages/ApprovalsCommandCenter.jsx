/* eslint-disable react/prop-types */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import { ArrowDownTrayIcon, ArrowPathIcon, ArrowRightIcon, ChartBarIcon, ChartPieIcon, CheckCircleIcon, ChevronLeftIcon, ChevronRightIcon, ClockIcon, Cog6ToothIcon, ExclamationTriangleIcon, InformationCircleIcon, MagnifyingGlassIcon, UserIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { API_BASE_URL } from '../config/api.config'
import { API_CONFIG } from '../config/enterpriseDashboard.config'
import { getApprovalFilters, getEnabledApprovalTypes } from '../config/approvalsSystem.config'
import { fetchCurrentUser } from '../store/slices/rbacSlice'
import ApprovalDecisionSummary from '../components/approvals/ApprovalDecisionSummary'
import ApprovalReviewDialog from '../components/approvals/ApprovalReviewDialog'
import { QUEUE_LABELS, UNCONNECTED_QUEUES, approvalsCsv, filterApprovals, formatAge, formatDate, normalizeApproval, sortApprovals } from '../components/approvals/approvalQueue'
import './ApprovalsPage.css'

const INITIAL_FILTERS = { search: '', tab: 'mine' }
const PAGE_SIZE = 7

export default function ApprovalsCommandCenter() {
  const dispatch = useDispatch()
  const user = useSelector(state => state.auth.user)
  const rbac = useSelector(state => state.rbac?.currentUser)
  const token = localStorage.getItem('radai_access_token') || localStorage.getItem('access')
  const types = useMemo(() => user ? getEnabledApprovalTypes(user, rbac) : [], [user, rbac])
  const [sources, setSources] = useState({})
  const [loading, setLoading] = useState(true)
  const [updatedAt, setUpdatedAt] = useState(null)
  const [filters, setFilters] = useState(INITIAL_FILTERS)
  const [selection, setSelection] = useState(undefined)
  const [page, setPage] = useState(1)
  const [review, setReview] = useState(null)
  const [settings, setSettings] = useState(false)
  const [analytics, setAnalytics] = useState(false)
  const [notice, setNotice] = useState('')
  const request = useRef(null)
  const reviewOpen = useRef(false)
  const settingsButton = useRef(null)
  const reviewTrigger = useRef(null)
  reviewOpen.current = !!review

  useEffect(() => { if (token && !rbac) dispatch(fetchCurrentUser()) }, [dispatch, token, rbac])
  useEffect(() => { setReview(null) }, [types, token])

  const refresh = useCallback(async () => {
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setLoading(true)
    // A failed or newly restricted source must not retain actionable stale rows.
    setSources({})
    if (!token || !types.length) { setLoading(false); return }
    const results = await Promise.allSettled(types.map(async config => {
      if (UNCONNECTED_QUEUES[config.id]) return [config.id, { state: 'unconnected', rows: [] }]
      const params = new URLSearchParams({ ...getApprovalFilters(config.filterLogic, user, rbac), limit: '200', page_size: '200' })
      if (config.id === 'leave' || config.id === 'profile_document') params.set(`${config.statusField}__in`, config.pendingStatuses.join(','))
      const response = await fetch(`${API_BASE_URL}${config.apiEndpoint}?${params}`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal })
      if (!response.ok) throw new Error(response.status === 403 ? 'Access unavailable' : response.status === 401 ? 'Sign in again to load this queue' : 'Unable to load queue')
      const data = await response.json()
      const records = Array.isArray(data) ? data : data.results
      if (!Array.isArray(records) || records.some(item => !item || typeof item !== 'object' || item.id === undefined || item.id === null)) throw new Error('Queue response unavailable')
      const rows = records.map(item => normalizeApproval(item, config))
      const count = Number.isFinite(Number(data.count)) && Number(data.count) >= records.length ? Number(data.count) : records.length
      return [config.id, { state: 'ready', rows, count, truncated: !!data.next || count > rows.length }]
    }))
    if (controller.signal.aborted) return
    const next = {}
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') next[result.value[0]] = result.value[1]
      else next[types[index].id] = { state: 'error', rows: [], error: result.reason?.message || 'Unable to load queue' }
    })
    setSources(next)
    setUpdatedAt(new Date())
    setLoading(false)
  }, [token, types, user, rbac])

  useEffect(() => {
    refresh()
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible' && !reviewOpen.current) refresh() }, Math.max(API_CONFIG.dashboardRefreshInterval || 60000, 60000))
    return () => { clearInterval(timer); request.current?.abort() }
  }, [refresh])

  const rows = useMemo(() => sortApprovals(types.flatMap(type => sources[type.id]?.rows || [])), [sources, types])
  const filtered = useMemo(() => filterApprovals(rows, {
    search: filters.search, tab: filters.tab,
    queue: 'all', priority: 'all', age: 'all', amount: 'all', requester: 'all',
  }), [rows, filters])
  const selected = selection === null ? null : filtered.find(item => item._queueKey === selection) || filtered[0] || null
  const currentPage = Math.min(page, Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)))
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const ready = types.filter(type => sources[type.id]?.state === 'ready')
  const failed = types.filter(type => sources[type.id]?.state === 'error')
  const incomplete = failed.length > 0 || types.some(type => sources[type.id]?.truncated)
  const myRows = rows.filter(item => item._canDecide)
  const deadlines = myRows.filter(item => item._details.dueTime !== null)
  const overdue = deadlines.filter(item => item._details.overdue).length
  const dueToday = deadlines.filter(item => item._details.dueToday).length
  const oldest = rows.reduce((max, item) => item._details.ageHours === null ? max : Math.max(max ?? 0, item._details.ageHours), null)
  const chosenQueue = !['mine', 'all'].includes(filters.tab) ? filters.tab : null
  const unconnected = UNCONNECTED_QUEUES[chosenQueue]
  const noData = loading || !ready.length

  const changeFilter = (key, value) => {
    setFilters(current => ({ ...current, [key]: value }))
    setPage(1)
    setSelection(undefined)
  }
  const clearFilters = () => { setFilters(INITIAL_FILTERS); setPage(1); setSelection(undefined) }
  const openReview = (item, action = 'view') => { reviewTrigger.current = document.activeElement; setReview({ item, action, types, token }) }
  const goToPage = nextPage => { setPage(nextPage); setSelection(filtered[(nextPage - 1) * PAGE_SIZE]?._queueKey) }
  const closeReview = () => { setReview(null); requestAnimationFrame(() => reviewTrigger.current?.focus()) }
  const closeSettings = useCallback(() => { setSettings(false); requestAnimationFrame(() => settingsButton.current?.focus()) }, [])
  const exportRows = () => {
    const url = URL.createObjectURL(new Blob([approvalsCsv(filtered)], { type: 'text/csv;charset=utf-8;' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `approvals-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    setNotice(`Exported ${filtered.length} loaded requests matching your search and selected queue.`)
  }
  const queueCount = id => {
    const source = sources[id]
    return loading || !source || source.state !== 'ready' ? '—' : `${source.count}${source.truncated ? '*' : ''}`
  }
  const countValue = value => noData ? '—' : `${value}${incomplete ? '+' : ''}`

  return <><div className="apc-page" data-testid="approval-command-center">
    <header className="apc-page-header">
      <h1 className="apc-sr-only">Approvals</h1>
      <nav className="apc-breadcrumb" aria-label="Breadcrumb"><span>Management</span><span aria-hidden="true">/</span><strong>Approvals</strong></nav>
      <div className="apc-toolbar">
      <label className="apc-search"><MagnifyingGlassIcon aria-hidden="true" /><span className="apc-sr-only">Search approvals</span><input type="search" placeholder="Search approvals by reference, title, requester..." value={filters.search} onChange={event => changeFilter('search', event.target.value)} /></label>
      <div className="apc-header-actions">
        <button type="button" className="apc-button" onClick={refresh} disabled={loading}><ArrowPathIcon className={loading ? 'apc-spin' : ''} aria-hidden="true" />Refresh</button>
        <button type="button" className="apc-button" onClick={exportRows} disabled={loading || !filtered.length}><ArrowDownTrayIcon aria-hidden="true" />Export</button>
        <button type="button" ref={settingsButton} className="apc-button apc-button--primary" onClick={() => setSettings(true)}><Cog6ToothIcon aria-hidden="true" />Approval settings</button>
      </div>
      </div>
    </header>
    <div className="apc-workspace"><div className="apc-queue-column">
    <nav className="apc-tabs" aria-label="Approval queues">
      {[['mine', 'My approvals', countValue(myRows.length)], ['all', 'All available', countValue(rows.length)], ...types.map(type => [type.id, QUEUE_LABELS[type.id] || type.label, queueCount(type.id)])].map(([id, label, count]) => <button key={id} type="button" className={filters.tab === id ? 'is-active' : ''} aria-current={filters.tab === id ? 'page' : undefined} onClick={() => changeFilter('tab', id)}>{label}<span>{count}</span></button>)}
    </nav>
    <section className="apc-kpis" aria-label="Approval outcomes">
      <Kpi label="Awaiting my decision" value={countValue(myRows.length)} note={incomplete ? 'Loaded requests · partial coverage' : 'Your available approval queues'} icon={UserIcon} tone="blue" />
      <Kpi label="Overdue" value={noData || !deadlines.length && (myRows.length > 0 || incomplete) ? '—' : overdue} note={noData ? 'Waiting for queue data' : `${deadlines.length} of ${myRows.length} requests have deadlines`} icon={ExclamationTriangleIcon} tone="rose" />
      <Kpi label="Due today" value={noData || !deadlines.length && (myRows.length > 0 || incomplete) ? '—' : dueToday} note="Recorded approval deadlines" icon={ClockIcon} tone="amber" />
      <Kpi label="Approved this week" value="—" note="Approval history not connected" icon={CheckCircleIcon} tone="green" />
    </section>
    {failed.length > 0 && <div className="apc-status-message apc-status-message--error" role="alert"><ExclamationTriangleIcon aria-hidden="true" /><span>{failed.map(type => QUEUE_LABELS[type.id]).join(', ')} could not be loaded. Counts cover available queues only.</span><button className="apc-text-button" type="button" onClick={refresh}>Retry</button></div>}
    {types.some(type => sources[type.id]?.truncated) && <div className="apc-status-message" role="status"><InformationCircleIcon aria-hidden="true" /><span>Some queues have more requests than can be loaded at once. Search, metrics and exports cover loaded requests; * marks a full queue count.</span></div>}
    {notice && <div className="apc-status-message" role="status"><CheckCircleIcon aria-hidden="true" /><span>{notice}</span><button type="button" className="apc-icon-button" onClick={() => setNotice('')} aria-label="Dismiss export notification"><XMarkIcon aria-hidden="true" /></button></div>}
      <section className="apc-table-panel apc-panel" aria-label="Approval requests" aria-busy={loading}>
        {loading ? <EmptyState icon={ArrowPathIcon} title="Loading your approval queues" description="Retrieving requests and their current approval steps." />
          : unconnected ? <EmptyState icon={InformationCircleIcon} title="Approval queue not connected" description={unconnected.reason}><Link className="apc-button" to={unconnected.path}>{unconnected.label}<ArrowRightIcon aria-hidden="true" /></Link></EmptyState>
            : !ready.length && !failed.length ? <EmptyState icon={InformationCircleIcon} title='Approval queues are not available' description='No connected approval queues are available for this account.' /> : !filtered.length ? <EmptyState icon={failed.length ? ExclamationTriangleIcon : CheckCircleIcon} title={failed.length ? 'No requests available from the loaded queues' : rows.length ? 'No matching requests' : 'No pending requests'} description={failed.length ? 'Retry the unavailable queues to check for outstanding requests.' : rows.length ? 'Adjust your filters or select All available to see more requests.' : 'Your connected approval queues are clear.'}><button type="button" className="apc-button" onClick={failed.length ? refresh : clearFilters}>{failed.length ? 'Retry queues' : 'Reset filters'}</button></EmptyState>
              : <><div className="apc-table-scroll" tabIndex={0} role="region" aria-label="Scrollable approval requests"><table className="apc-table"><caption className="apc-sr-only">Requests available to you. Age is based on the recorded creation or submission date.</caption><thead><tr>{['Priority / age', 'Type', 'Reference & description', 'Requester', 'Amount', 'Stage', 'Due', 'Action'].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead><tbody>{pageRows.map(item => {
                const d = item._details
                return <tr key={item._queueKey} data-queue-key={item._queueKey} data-selected={selected?._queueKey === item._queueKey} data-priority={d.priority.code} onClick={() => setSelection(item._queueKey)}>
                  <td><span className={`apc-row-priority apc-priority--${d.priority.code}`}><i aria-hidden="true" />{d.priority.label}</span><small title={`${d.ageBasis}: ${formatDate(d.submittedAt)}`}>{d.ageLabel}</small></td>
                  <td><span className="apc-type-badge">{item._approvalType === 'purchase_order' ? 'Purchase order' : item._approvalLabel}</span></td>
                  <td className="apc-reference-cell"><button type="button" className="apc-reference-button" aria-pressed={selected?._queueKey === item._queueKey} onClick={() => setSelection(item._queueKey)}>{d.reference}</button><small title={d.title}>{d.title}</small></td>
                  <td className="apc-requester-cell"><span title={d.requester}>{d.requester}</span><small>{d.department}</small></td>
                  <td className="apc-amount">{d.amountText}</td><td><span className="apc-stage-badge">{d.stageLabel}</span></td>
                  <td className={d.overdue ? 'apc-due-overdue' : ''}>{d.dueTime !== null ? <><time dateTime={d.dueAt} title={formatDate(d.dueAt)}>{d.dueToday ? 'Today' : new Date(d.dueAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}</time><small>{d.overdue ? 'Overdue' : d.dueToday ? 'Due today' : 'Upcoming'}</small></> : <span className="apc-muted">Not set</span>}</td>
                  <td><button type="button" className={`apc-button apc-review-button ${selected?._queueKey === item._queueKey ? 'apc-button--primary' : ''}`} aria-label={`Review ${d.reference}`} onClick={() => setSelection(item._queueKey)}>Review</button></td>
                </tr>
              })}</tbody></table></div><div className="apc-table-footer"><span>{(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length} {incomplete ? 'loaded ' : ''}requests</span><div className="apc-pagination"><button type="button" className="apc-icon-button" aria-label="Previous page" disabled={currentPage <= 1} onClick={() => goToPage(currentPage - 1)}><ChevronLeftIcon aria-hidden="true" /></button><span>Page {currentPage} of {Math.ceil(filtered.length / PAGE_SIZE)}</span><button type="button" className="apc-icon-button" aria-label="Next page" disabled={currentPage * PAGE_SIZE >= filtered.length} onClick={() => goToPage(currentPage + 1)}><ChevronRightIcon aria-hidden="true" /></button></div></div></>}
      </section>
      <section className="apc-queue-health apc-panel" aria-label="Queue health"><h2><ChartBarIcon aria-hidden="true" />Queue health</h2><div><ClockIcon aria-hidden="true" /><span><small>Median decision time</small><strong title="Completed approval history is not connected">— <em>Not available</em></strong></span></div><div><ChartPieIcon aria-hidden="true" /><span><strong title="Completed approval history is not connected">— <em>Not available</em></strong><small>Within SLA</small></span></div><div><ClockIcon aria-hidden="true" /><span><small>Oldest item</small><strong>{noData || oldest === null ? '—' : formatAge(oldest)}</strong></span></div><button type="button" className="apc-text-button" aria-expanded={analytics} aria-controls="apc-queue-analytics" onClick={() => setAnalytics(value => !value)}>{analytics ? 'Hide analytics' : 'View analytics'}<ArrowRightIcon aria-hidden="true" /></button></section>
      {analytics && <section id="apc-queue-analytics" className="apc-analytics apc-panel"><h2>Queue coverage</h2><p>Approval metrics reflect connected queues. Completed decision history is needed for response time, weekly approvals and SLA performance.</p><QueueCoverage types={types} sources={sources} loading={loading} /></section>}
    </div><ApprovalDecisionSummary item={selected} details={selected?._details} onClose={() => setSelection(null)} onReview={item => openReview(item)} onReject={item => openReview(item, 'reject')} canDecide={selected?._canDecide === true} busy={loading} /></div>
    <footer className="apc-page-footer"><span><i className={failed.length ? 'is-partial' : ''} aria-hidden="true" />{loading ? 'Updating queues…' : updatedAt ? `Last refreshed ${updatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Awaiting queue data'}</span><span>Authorized queues · Amounts in original currency · Record age shown</span></footer>
    {settings && <SettingsDialog onClose={closeSettings}><h2 id="apc-settings-title">Approval settings</h2><p>Your available queues follow the approval routes and permissions set in each workspace.</p><QueueCoverage types={types} sources={sources} loading={loading} /><div className="apc-settings-note"><InformationCircleIcon aria-hidden="true" /><span>Assignment, required signatures and approval stages are managed in the source workflow.</span></div><button type="button" className="apc-button" disabled={loading} onClick={refresh}><ArrowPathIcon aria-hidden="true" />Refresh queues</button></SettingsDialog>}
  </div>{review && review.types === types && review.token === token && <ApprovalReviewDialog item={review.item} initialAction={review.action} onClose={closeReview} onDecision={refresh} />}</>
}

function Kpi({ label, value, note, icon: Icon, tone }) {
  return <article className={`apc-kpi apc-kpi--${tone}`}><div className="apc-kpi-icon"><Icon aria-hidden="true" /></div><div><h2>{label}</h2><strong>{value}</strong><p>{note}</p></div></article>
}
function EmptyState({ icon: Icon, title, description, children }) {
  return <div className="apc-empty"><Icon aria-hidden="true" /><h2>{title}</h2><p>{description}</p>{children}</div>
}
function QueueCoverage({ types, sources, loading }) {
  return <div className="apc-coverage-list">{types.map(type => {
    const source = sources[type.id]
    const unconnected = UNCONNECTED_QUEUES[type.id]
    return <div key={type.id}><strong>{QUEUE_LABELS[type.id] || type.label}</strong><span>{loading ? 'Loading…' : source?.state === 'ready' ? `${source.rows.length} loaded / ${source.count} available` : unconnected ? 'Not connected' : source?.error || 'Not available'}</span>{unconnected ? <Link to={unconnected.path}>{unconnected.label}<ArrowRightIcon aria-hidden="true" /></Link> : <small>{type.id === 'leave' ? 'Manager / HR review' : type.id === 'profile_document' ? 'Administrator verification' : 'Assigned approval stages'}</small>}</div>
  })}</div>
}
function SettingsDialog({ children, onClose }) {
  const dialog = useRef(null)
  useEffect(() => {
    const element = dialog.current
    element.showModal()
    const cancel = event => { event.preventDefault(); onClose() }
    const trapTab = event => {
      if (event.key !== 'Tab') return
      const controls = [...element.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), [tabindex="0"]')].filter(control => control.getClientRects().length > 0)
      const first = controls[0], last = controls[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    element.addEventListener('cancel', cancel)
    element.addEventListener('keydown', trapTab)
    return () => { element.removeEventListener('cancel', cancel); element.removeEventListener('keydown', trapTab); element.close() }
  }, [onClose])
  return <dialog ref={dialog} className="apc-settings-dialog" aria-labelledby="apc-settings-title"><button type="button" className="apc-icon-button apc-dialog-close" onClick={onClose} aria-label="Close approval settings"><XMarkIcon aria-hidden="true" /></button>{children}</dialog>
}
