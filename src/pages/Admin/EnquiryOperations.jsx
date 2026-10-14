/* eslint-disable react/prop-types */
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useSelector } from 'react-redux'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowDownTrayIcon, ArrowPathIcon, ArrowRightIcon, ChartBarIcon, ChartPieIcon,
  CheckCircleIcon, ChevronLeftIcon, ChevronRightIcon, ClockIcon, DocumentTextIcon,
  ExclamationTriangleIcon, FunnelIcon, InformationCircleIcon, ListBulletIcon, MagnifyingGlassIcon,
  PlusCircleIcon, SignalIcon, UserIcon, UsersIcon, XMarkIcon,
} from '@heroicons/react/24/outline'
import apiService from '../../services/api.service'
import EnquiryTriageSummary from '../../components/enquiries/EnquiryTriageSummary'
import EnquiryAssignDialog from '../../components/enquiries/EnquiryAssignDialog'
import {
  ENQUIRY_PAGE_SIZE, ENQUIRY_PRIORITIES, ENQUIRY_STATUSES, INITIAL_ENQUIRY_FILTERS,
  dateTime, enquiriesCsv, enquiryAge, enquiryMetrics, enquiryParams, metricText,
  priorityLabel, readEnquiryList, statusLabel,
} from '../../components/enquiries/enquiryOperations'
import './EnquiryOperations.css'

const requestError = (error, fallback) => typeof error?.response?.data?.detail === 'string'
  ? error.response.data.detail : error?.response?.status === 403 ? 'Your account does not have access to enquiry operations.' : error?.message || fallback

export default function EnquiryOperations() {
  const navigate = useNavigate()
  const user = useSelector(state => state.auth?.user)
  const [filters, setFilters] = useState(INITIAL_ENQUIRY_FILTERS)
  const [page, setPage] = useState(1)
  const [revision, setRevision] = useState(0)
  const [register, setRegister] = useState({ items: [], count: 0, loading: true, error: '', key: '' })
  const [statistics, setStatistics] = useState({ data: null, loading: true, error: '' })
  const [selectedId, setSelectedId] = useState(undefined)
  const [detail, setDetail] = useState({ data: null, loading: false, error: '', id: null })
  const [detailRevision, setDetailRevision] = useState(0)
  const [assignment, setAssignment] = useState(null)
  const [analytics, setAnalytics] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [notice, setNotice] = useState(null)
  const exportController = useRef(null)
  const queueNavigation = useRef(null)
  const params = useMemo(() => enquiryParams(filters, page), [filters, page])
  const queryKey = JSON.stringify(params)

  useEffect(() => {
    const controller = new AbortController()
    setRegister({ items: [], count: 0, loading: true, error: '', key: queryKey })
    const timer = window.setTimeout(async () => {
      try {
        const { data } = await apiService.get('/enquiry/', { params, signal: controller.signal, suppressErrorToast: true })
        const result = readEnquiryList(data)
        if (!controller.signal.aborted) {
          const lastPage = Math.max(1, Math.ceil(result.count / ENQUIRY_PAGE_SIZE))
          if (params.page > lastPage) { setPage(lastPage); setSelectedId(undefined); return }
          setRegister({ ...result, key: queryKey, loading: false, error: '', updatedAt: new Date() })
        }
      } catch (error) {
        if (!controller.signal.aborted) setRegister({ items: [], count: 0, loading: false, error: requestError(error, 'Could not load enquiries.'), key: queryKey })
      }
    }, filters.search ? 250 : 0)
    return () => { clearTimeout(timer); controller.abort() }
  }, [params, queryKey, revision, user, filters.search])

  useEffect(() => {
    const controller = new AbortController()
    setStatistics({ data: null, loading: true, error: '' })
    apiService.get('/enquiry/stats/', { signal: controller.signal, suppressErrorToast: true }).then(({ data }) => {
      if (!data || typeof data !== 'object' || Array.isArray(data) || !Object.hasOwn(data, 'total')) throw new Error('Service metrics are not available.')
      if (!controller.signal.aborted) setStatistics({ data, loading: false, error: '' })
    }).catch(error => {
      if (!controller.signal.aborted) setStatistics({ data: null, loading: false, error: requestError(error, 'Could not load service metrics.') })
    })
    return () => controller.abort()
  }, [revision, user])

  useEffect(() => {
    setAssignment(null)
    setSelectedId(undefined)
    setExporting(false)
    setNotice(null)
    return () => exportController.current?.abort()
  }, [user])

  useEffect(() => {
    const revealQueue = () => {
      const navigation = queueNavigation.current
      const active = navigation?.querySelector('[aria-current="page"]')
      if (navigation && active) {
        const left = active.getBoundingClientRect().left - navigation.getBoundingClientRect().left + navigation.scrollLeft
        if (left < navigation.scrollLeft || left + active.offsetWidth > navigation.scrollLeft + navigation.clientWidth) navigation.scrollLeft = Math.max(0, left - (navigation.clientWidth - active.offsetWidth) / 2)
      }
    }
    revealQueue()
    window.addEventListener('resize', revealQueue)
    return () => window.removeEventListener('resize', revealQueue)
  }, [filters.queue])

  const loading = register.loading || register.key !== queryKey
  const items = loading || register.error ? [] : register.items
  const selected = selectedId === null ? null : items.find(row => String(row.id) === String(selectedId)) || items[0] || null
  const selectedKey = selected?.id ?? null

  useEffect(() => {
    const controller = new AbortController()
    if (selectedKey === null) { setDetail({ data: null, loading: false, error: '', id: null }); return () => controller.abort() }
    setDetail({ data: null, loading: true, error: '', id: selectedKey })
    apiService.get(`/enquiry/${selectedKey}/`, { signal: controller.signal, suppressErrorToast: true }).then(({ data }) => {
      if (String(data?.enquiry?.id) !== String(selectedKey)) throw new Error('This enquiry could not be loaded. Please retry.')
      if (!controller.signal.aborted) setDetail({ data: data.enquiry, loading: false, error: '', id: selectedKey })
    }).catch(error => {
      if (!controller.signal.aborted) setDetail({ data: null, loading: false, error: requestError(error, 'Could not load enquiry details.'), id: selectedKey })
    })
    return () => controller.abort()
  }, [selectedKey, detailRevision, revision, user])

  const metrics = enquiryMetrics(statistics.data)
  const departments = (Array.isArray(statistics.data?.by_department) ? statistics.data.by_department : []).filter(row => row.name && row.name !== 'Unrouted').map(row => [row.name, row.name])
  const owners = (Array.isArray(statistics.data?.owners) ? statistics.data.owners : []).map(owner => [String(owner.id), owner.name])
  const totalPages = Math.max(1, Math.ceil(register.count / ENQUIRY_PAGE_SIZE))
  const detailMatches = selectedKey !== null && detail.id === selectedKey
  const detailLoading = selectedKey !== null && (!detailMatches || detail.loading)
  const detailReady = detailMatches && !detail.loading && !detail.error && !!detail.data

  const setFilter = (name, value) => { exportController.current?.abort(); setExporting(false); setFilters(current => ({ ...current, [name]: value })); setPage(1); setSelectedId(undefined); setNotice(null) }
  const clearFilters = () => { exportController.current?.abort(); setExporting(false); setFilters(INITIAL_ENQUIRY_FILTERS); setPage(1); setSelectedId(undefined); setNotice(null) }
  const refresh = () => { setRevision(value => value + 1); setNotice(null) }
  const goToPage = next => { setPage(next); setSelectedId(undefined) }
  const openDetail = record => navigate(`/admin/enquiries/${record.id}`)
  const selectRow = row => {
    setSelectedId(row.id)
    if (window.innerWidth < 1200) requestAnimationFrame(() => document.getElementById('eop-triage-summary-title')?.scrollIntoView({ block: 'start', behavior: 'auto' }))
  }

  const exportFiltered = async () => {
    if (exporting) return
    exportController.current?.abort()
    const controller = new AbortController()
    exportController.current = controller
    setExporting(true)
    setNotice(null)
    try {
      const records = []
      let expected = null
      for (let exportPage = 1; ; exportPage += 1) {
        const { data } = await apiService.get('/enquiry/', { params: enquiryParams(filters, exportPage, 100), signal: controller.signal, suppressErrorToast: true })
        const result = readEnquiryList(data)
        if (result.count > 5000) throw new Error('Narrow your filters to export up to 5,000 enquiries at a time.')
        if (expected !== null && result.count !== expected) throw new Error('Enquiries changed during export. Refresh and try again.')
        expected = result.count
        records.push(...result.items)
        if (records.length >= expected) break
        if (!result.items.length || exportPage >= 50) throw new Error('The export was incomplete. Refresh and try again.')
      }
      if (controller.signal.aborted) return
      if (records.length !== expected || new Set(records.map(row => row.id)).size !== expected) throw new Error('Enquiries changed during export. Refresh and try again.')
      const url = URL.createObjectURL(new Blob([enquiriesCsv(records)], { type: 'text/csv;charset=utf-8;' }))
      const link = document.createElement('a')
      link.href = url
      link.download = `enquiries-${new Date().toISOString().slice(0, 10)}.csv`
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      setNotice({ message: `Exported ${records.length} enquiries matching your selected filters.`, tone: 'success' })
    } catch (error) {
      if (!controller.signal.aborted) setNotice({ message: requestError(error, 'Could not export enquiries.'), tone: 'error' })
    } finally { if (!controller.signal.aborted) setExporting(false) }
  }

  return <div className="eop-page" data-testid="enquiry-operations">
    <header className="eop-page-header">
      <div><nav className="eop-breadcrumb" aria-label="Breadcrumb"><span>Operations</span><span aria-hidden="true">/</span><span>Enquiries</span></nav><h1>Enquiry Operations</h1><p>Triage, assign and resolve employee service requests.</p></div>
      <div className="eop-header-actions">
        <button type="button" className="eop-button" disabled={exporting || loading || !!register.error || !register.count} onClick={exportFiltered}><ArrowDownTrayIcon aria-hidden="true" />{exporting ? 'Exporting…' : 'Export'}</button>
        <button type="button" className="eop-button" onClick={refresh} disabled={loading || statistics.loading}><ArrowPathIcon aria-hidden="true" className={loading ? 'eop-spin' : ''} />Refresh</button>
        <Link className="eop-button eop-button--primary" to="/enquiry"><PlusCircleIcon aria-hidden="true" />New enquiry</Link>
      </div>
    </header>

    <section className="eop-filters eop-panel" aria-label="Enquiry filters">
      <label className="eop-search"><MagnifyingGlassIcon aria-hidden="true" /><span className="eop-sr-only">Search enquiries</span><input type="search" value={filters.search} onChange={event => setFilter('search', event.target.value)} placeholder="Search enquiries by reference, request or requester..." /></label>
      <Filter label="Status" value={filters.status} options={ENQUIRY_STATUSES} onChange={value => setFilter('status', value)} />
      <Filter label="Priority" value={filters.urgency} options={ENQUIRY_PRIORITIES} onChange={value => setFilter('urgency', value)} />
      <Filter label="Department" value={filters.department} options={[[ '', 'All departments' ], ...departments]} onChange={value => setFilter('department', value)} />
      <Filter label="Owner" value={filters.owner} options={[[ '', 'All owners' ], ['unassigned', 'Unassigned'], ...owners]} onChange={value => setFilter('owner', value)} />
      <Filter label="SLA" value={filters.sla} options={[[ '', 'All' ], ['overdue', 'Overdue'], ['on_track', 'Within SLA'], ['due_today', 'Due today'], ['no_deadline', 'No deadline']]} onChange={value => setFilter('sla', value)} />
      <button type="button" className="eop-button eop-clear" onClick={clearFilters}><FunnelIcon aria-hidden="true" />Clear filters</button>
    </section>

    <section className="eop-kpis" aria-label="Service outcomes">
      <Kpi title="Open enquiries" value={metricText(metrics.open)} icon={DocumentTextIcon} tone="blue" description="Excludes resolved, closed and spam enquiries" />
      <Kpi title="Unassigned" value={metricText(metrics.unassigned)} icon={UsersIcon} tone="amber" description="Open enquiries without a current owner" />
      <Kpi title="Overdue SLA" value={metricText(metrics.overdue)} icon={ClockIcon} tone="rose" description="Active requests beyond their recorded deadline; excludes awaiting confirmation" />
      <Kpi title="Median response" value={metrics.median === null ? '—' : `${metricText(metrics.median)}h`} icon={ChartBarIcon} tone="green" description={metrics.responseCount > 0 ? `Median time to first response across ${metrics.responseCount} enquiries` : 'No measured first-response sample available'} />
    </section>

    {statistics.error && <div className="eop-message eop-message--warning" role="status"><InformationCircleIcon aria-hidden="true" /><span>Service metrics could not be loaded. Available enquiries are shown below.</span><button type="button" onClick={refresh}>Retry metrics</button></div>}
    {notice && <div className={`eop-message eop-message--${notice.tone}`} role={notice.tone === 'error' ? 'alert' : 'status'}><InformationCircleIcon aria-hidden="true" /><span>{notice.message}</span><button type="button" className="eop-icon-button" aria-label="Dismiss notification" onClick={() => setNotice(null)}><XMarkIcon aria-hidden="true" /></button></div>}

    <div className="eop-workspace">
      <section className="eop-register eop-panel" aria-label="Enquiry register" aria-busy={loading}>
        <nav ref={queueNavigation} className="eop-queues" aria-label="Enquiry queues">{[
          ['mine', 'My queue', metrics.mine, UserIcon], ['unassigned', 'Unassigned', metrics.unassigned, UsersIcon],
          ['at_risk', 'At risk', metrics.overdue, ExclamationTriangleIcon], ['all', 'All enquiries', metrics.total, ListBulletIcon],
        ].map(([code, label, count, Icon]) => <button key={code} type="button" className={filters.queue === code ? 'is-active' : ''} aria-current={filters.queue === code ? 'page' : undefined} title={code === 'at_risk' ? 'Enquiries with overdue SLA deadlines' : label} onClick={() => setFilter('queue', code)}><Icon aria-hidden="true" />{label}<span>{metricText(count)}</span></button>)}</nav>
        {loading ? <EmptyState icon={ArrowPathIcon} title="Loading enquiries" message="Retrieving your service request queue." />
          : register.error ? <EmptyState icon={ExclamationTriangleIcon} title="Enquiries could not be loaded" message={register.error} error><button className="eop-button" type="button" onClick={refresh}>Retry enquiries</button></EmptyState>
            : !items.length ? <EmptyState icon={CheckCircleIcon} title={Object.entries(filters).some(([key, value]) => key === 'queue' ? value !== 'all' : !!value) ? 'No matching enquiries' : 'No enquiries yet'} message="New enquiries will appear here. Adjust the filters to check other queues."><button className="eop-button" type="button" onClick={clearFilters}>Clear filters</button></EmptyState>
              : <div className="eop-table-scroll" role="region" aria-label="Scrollable enquiry register" tabIndex={0}><table className="eop-table"><caption className="eop-sr-only">Enquiries matching your selected filters. Open a row to see its triage summary.</caption>
                <thead><tr>{['SLA / age', 'Reference', 'Request & requester', 'Department', 'Owner', 'Priority', 'Status', 'Due', 'Action'].map(heading => <th scope="col" key={heading}>{heading}</th>)}</tr></thead>
                <tbody>{items.map(row => <tr key={row.id} data-enquiry-id={row.id} data-selected={selectedKey === row.id} data-overdue={row.is_overdue === true} onClick={() => setSelectedId(row.id)}>
                  <td className={row.is_overdue ? 'eop-overdue' : 'eop-muted'} title={`Received ${dateTime(row.created_at)}${row.is_overdue ? ` · Deadline ${dateTime(row.due_at)}` : ''}`}>{enquiryAge(row)}</td>
                  <td><Link className="eop-reference" to={`/admin/enquiries/${row.id}`} onClick={event => event.stopPropagation()}>{row.reference || `ENQ-${row.id}`}</Link></td>
                  <td className="eop-request-cell"><button type="button" className="eop-request-title" onClick={() => selectRow(row)} aria-pressed={selectedKey === row.id} title={row.subject}>{row.subject || 'Untitled enquiry'}</button><small title={row.name}>{row.name || 'Requester not recorded'}</small></td>
                  <td><span className="eop-cell-text" title={row.department}>{row.department || 'Not routed'}</span></td>
                  <td><span className="eop-cell-text" title={row.assigned_to?.name}>{row.assigned_to?.name || (row.assigned_to === null ? 'Unassigned' : 'Not recorded')}</span></td>
                  <td><span className={`eop-priority eop-priority--${['urgent', 'high', 'normal', 'low'].includes(row.urgency) ? row.urgency : 'unknown'}`}>{priorityLabel(row.urgency)}</span></td>
                  <td><span className={`eop-status eop-status--${row.status || 'unknown'}`}>{statusLabel(row.status)}</span></td>
                  <td className={row.is_overdue ? 'eop-due eop-overdue' : 'eop-due'}><DueDate value={row.due_at} /></td>
                  <td><button type="button" className="eop-button eop-open" aria-label={`Open ${row.reference || row.id} summary`} onClick={() => selectRow(row)}>Open</button></td>
                </tr>)}</tbody>
              </table></div>}
        {!loading && !register.error && register.count > 0 && <footer className="eop-pagination"><span>{(page - 1) * ENQUIRY_PAGE_SIZE + 1}–{Math.min(page * ENQUIRY_PAGE_SIZE, register.count)} of {register.count} enquiries</span><div><button type="button" className="eop-icon-button" aria-label="Previous page" disabled={page <= 1} onClick={() => goToPage(page - 1)}><ChevronLeftIcon aria-hidden="true" /></button><span>Page {page} of {totalPages}</span><button type="button" className="eop-icon-button" aria-label="Next page" disabled={page >= totalPages} onClick={() => goToPage(page + 1)}><ChevronRightIcon aria-hidden="true" /></button></div></footer>}
      </section>

      <EnquiryTriageSummary item={selected} detail={detailMatches ? detail.data : null} loading={detailLoading} error={detailMatches ? detail.error : ''} onRetry={() => setDetailRevision(value => value + 1)} onClose={() => setSelectedId(null)} onAssign={record => { if (detailReady) setAssignment({ record, user }) }} onOpen={openDetail} canAssign={detailReady} />
    </div>

    <section className="eop-service-health eop-panel" aria-label="Service health"><h2><SignalIcon aria-hidden="true" />Service health</h2>
      <Health icon={ChartPieIcon} value={metrics.firstResponseSla === null ? '—' : `${metricText(metrics.firstResponseSla)}%`} label="First response within SLA" tone="green" description={metrics.slaCount > 0 ? `${metrics.slaCount} measured first responses with valid deadlines` : 'No measured first-response SLA sample available'} />
      <Health icon={ExclamationTriangleIcon} value={metricText(metrics.overdue)} label="Overdue" tone="rose" />
      <Health icon={UsersIcon} value={metricText(metrics.unassigned)} label="Unassigned" />
      <Health icon={CheckCircleIcon} value={metricText(metrics.resolvedWeek)} label="Resolved this week" tone="green" description="Resolved since Monday in the service timezone; currently resolved or closed" />
      <button type="button" className="eop-link-button" aria-expanded={analytics} aria-controls="eop-service-analytics" onClick={() => setAnalytics(value => !value)}>{analytics ? 'Hide service analytics' : 'View service analytics'}<ArrowRightIcon aria-hidden="true" /></button>
    </section>

    {analytics && <ServiceAnalytics statistics={statistics} metrics={metrics} onRetry={refresh} />}
    <footer className="eop-data-note"><span>{register.updatedAt && !register.error && !loading ? `Updated ${register.updatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : loading ? 'Updating enquiries…' : 'Queue data unavailable'}</span><span>Service metrics cover all authorized enquiries · Filters apply to the register</span></footer>
    {assignment && assignment.user === user && <EnquiryAssignDialog item={assignment.record} onClose={() => setAssignment(null)} onAssigned={record => { setSelectedId(record.id); setRevision(value => value + 1); setNotice({ message: `Assignment saved for ${record.reference}.`, tone: 'success' }) }} />}
  </div>
}

function Filter({ label, value, options, onChange }) {
  return <label className="eop-filter"><span>{label}</span><select aria-label={label} value={value} onChange={event => onChange(event.target.value)}>{options.map(([code, name]) => <option value={code} key={code}>{name}</option>)}</select></label>
}
function Kpi({ title, value, icon: Icon, tone, description }) {
  return <article className={`eop-kpi eop-kpi--${tone}`} title={description}><span className="eop-kpi-icon"><Icon aria-hidden="true" /></span><div><h2>{title}</h2><strong>{value}</strong></div></article>
}
function Health({ icon: Icon, value, label, tone = 'neutral', description }) {
  return <div className={`eop-health-metric eop-health-metric--${tone}`} title={description}><Icon aria-hidden="true" /><span><strong>{value}</strong><small>{label}</small></span></div>
}
function DueDate({ value }) {
  if (!value || !Number.isFinite(Date.parse(value))) return <span className="eop-muted">Not set</span>
  const date = new Date(value)
  return <time dateTime={value} title={dateTime(value)}><span>{date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', ...(date.getFullYear() !== new Date().getFullYear() ? { year: '2-digit' } : {}) })}</span><span>{date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true })}</span></time>
}
function EmptyState({ icon: Icon, title, message, error, children }) {
  return <div className={`eop-empty${error ? ' eop-empty--error' : ''}`} role={error ? 'alert' : 'status'}><Icon aria-hidden="true" /><h2>{title}</h2><p>{message}</p>{children}</div>
}
function ServiceAnalytics({ statistics, metrics, onRetry }) {
  return <section id="eop-service-analytics" className="eop-analytics eop-panel"><header><h2>Service analytics</h2><p>All authorized enquiries. Response metrics use recorded first responses; weekly resolutions run from Monday to now.</p></header>
    {statistics.error ? <div className="eop-message eop-message--warning"><span>Service analytics are unavailable.</span><button type="button" onClick={onRetry}>Retry analytics</button></div> : <div className="eop-analytics-grid"><section><h3>Request status</h3><dl>{ENQUIRY_STATUSES.filter(([code]) => code && Object.hasOwn(statistics.data?.by_status || {}, code)).map(([code, label]) => <div key={code}><dt>{label}</dt><dd>{metricText(statistics.data.by_status[code])}</dd></div>)}</dl></section><section><h3>Departments</h3><dl>{(Array.isArray(statistics.data?.by_department) ? statistics.data.by_department : []).map(row => <div key={row.name}><dt>{row.name}</dt><dd>{metricText(row.count)}</dd></div>)}</dl></section><section><h3>Measurement coverage</h3><dl><div><dt>First responses measured</dt><dd>{metricText(metrics.responseCount)}</dd></div><div><dt>Responses with valid SLA deadlines</dt><dd>{metricText(metrics.slaCount)}</dd></div><div><dt>Median response</dt><dd>{metrics.median === null ? 'Not available' : `${metricText(metrics.median)}h`}</dd></div><div><dt>First response within SLA</dt><dd>{metrics.firstResponseSla === null ? 'Not available' : `${metricText(metrics.firstResponseSla)}%`}</dd></div></dl></section></div>}
  </section>
}
