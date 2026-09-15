/* eslint-disable react/prop-types */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useSelector } from 'react-redux'
import { AlertTriangle, ArrowDown, ArrowUp, Ban, Brain, CheckCircle2, ChevronRight, Clock, Copy, Database, FileText, Folder, FolderOpen, History, Key, Link as LinkIcon, Lock, MinusCircle, MoreHorizontal, Plus, RefreshCw, Search, Server, Settings, Users, X } from 'lucide-react'
import * as Replica from '../../services/fileReplica.service'
import { listProjects } from '../../services/projectControl.service'
import ServerFileBrowser from '../../components/fileReplica/ServerFileBrowser'
import './FileServerReplica.css'

const FOLDERS_PER_PAGE = 5
const defaults = { name: '', root_path: '', included_paths: [], excluded_paths: [], mode: 'catalogue', enabled: true, max_file_size_mb: 100, interval_seconds: 300 }
const splitPaths = value => value.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
const normalized = value => String(value || '').replaceAll('\\', '/').toLowerCase()
const within = (path, parent) => normalized(path) === normalized(parent) || normalized(path).startsWith(`${normalized(parent)}/`)
const isExcluded = (scope, source) => (source?.excluded_paths || []).some(path => within(scope.relative_path, path))
const isIncluded = (scope, source) => !isExcluded(scope, source) && (source?.included_paths?.length ? source.included_paths.some(path => within(scope.relative_path, path) || within(path, scope.relative_path)) : !normalized(scope.relative_path).includes('/'))
const projectAccess = (scope, source) => Boolean(scope.project && scope.access_enabled && source?.enabled && isIncluded(scope, source))
const mappingState = (scope, source) => isExcluded(scope, source) ? 'excluded' : !scope.project ? 'unmapped' : scope.access_enabled ? 'mapped' : 'review'
const projectCode = project => project?.project_code || project?.project_number || project?.code || ''
const projectName = project => project?.name || project?.project_name || project?.title || ''
const dateLabel = value => value ? new Date(value).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Never'
const networkPath = (source, scope) => `${source.root_path.replace(/[\\/]+$/, '')}\\${scope.relative_path.replaceAll('/', '\\')}`
const contactLabel = value => {
  if (!value) return 'Awaiting first contact'
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000))
  return minutes < 1 ? 'Last contact just now' : minutes < 60 ? `Last contact ${minutes} min ago` : minutes < 1440 ? `Last contact ${Math.floor(minutes / 60)} hr ago` : `Last contact ${Math.floor(minutes / 1440)} days ago`
}

function Pill({ tone = 'neutral', icon: Icon, children }) {
  return <span className={`rf-pill rf-${tone}`}>{Icon && <Icon size={13} aria-hidden="true" />}{children}</span>
}

function MappingPill({ scope, source }) {
  const options = { excluded: ['danger', Ban, 'Excluded'], unmapped: ['neutral', MinusCircle, 'Unmapped'], review: ['warning', AlertTriangle, 'Review mapping'], mapped: ['success', CheckCircle2, 'Mapped'] }
  const [tone, icon, label] = options[mappingState(scope, source)]
  return <Pill tone={tone} icon={icon}>{label}</Pill>
}

function Dialog({ title, children, onClose, wide = false, busy = false }) {
  const ref = useRef(null)
  useEffect(() => {
    const dialog = ref.current, opener = document.activeElement
    dialog.showModal()
    return () => { dialog.close(); if (opener?.isConnected && typeof opener.focus === 'function') opener.focus({ preventScroll: true }) }
  }, [])
  return <dialog ref={ref} aria-label={title} className={`rf-dialog${wide ? ' rf-dialog-wide' : ''}`} onCancel={event => { event.preventDefault(); onClose() }} onClick={event => { if (event.target === ref.current) onClose() }}>
    <header className="rf-dialog-header"><h2>{title}</h2><button type="button" className="rf-button rf-icon-button" aria-label="Close dialog" onClick={onClose} disabled={busy}><X size={18} /></button></header>
    <div className="rf-dialog-body">{children}</div>
  </dialog>
}

function SourceForm({ source, onSaved, onCancel, disabled = false, onBusyChange }) {
  const [form, setForm] = useState(() => ({ ...defaults, ...source, included_paths: (source?.included_paths || []).join('\n'), excluded_paths: (source?.excluded_paths || []).join('\n') }))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const change = (field, value) => setForm(previous => ({ ...previous, [field]: value }))
  const submit = async event => {
    event.preventDefault()
    if (busy || disabled) return
    setBusy(true); onBusyChange?.(true); setError('')
    const body = { name: form.name.trim(), root_path: form.root_path.trim(), included_paths: splitPaths(form.included_paths), excluded_paths: splitPaths(form.excluded_paths), mode: form.mode, enabled: form.enabled, max_file_size_mb: Number(form.max_file_size_mb), interval_seconds: Number(form.interval_seconds) }
    try { await onSaved(source?.id ? await Replica.updateSource(source.id, body) : await Replica.createSource(body)) }
    catch (err) { setError(Replica.replicaError(err)) }
    finally { setBusy(false); onBusyChange?.(false) }
  }
  return <form onSubmit={submit} className="rf-source-form">
    <fieldset className="rf-form-grid" disabled={busy || disabled}>
      <label className="rf-field">Connection name<input required maxLength={160} value={form.name} onChange={event => change('name', event.target.value)} placeholder="RAD File Server — Projects" /></label>
      <label className="rf-field">Network folder path<input required value={form.root_path} onChange={event => change('root_path', event.target.value)} placeholder="\\server\share\Projects" /><small>Use the full network path accessible to the office connector. The root cannot change after synchronization.</small></label>
      <label className="rf-field">Included folders<textarea rows={3} value={form.included_paths} onChange={event => change('included_paths', event.target.value)} /><small>One source-relative project folder per line, including its subfolders. Leave empty to discover project folder names only; their files will not be scanned.</small></label>
      <label className="rf-field">Excluded folders<textarea rows={3} value={form.excluded_paths} onChange={event => change('excluded_paths', event.target.value)} /><small>Each source-relative path excludes its files and subfolders.</small></label>
      <label className="rf-field">Synchronization mode<select value={form.mode} onChange={event => change('mode', event.target.value)}><option value="catalogue">Catalogue — folder and file details</option><option value="mirror">Mirror — copy included files</option></select><small>Viewing, downloading, and extraction require copied file contents.</small></label>
      <label className="rf-field">Maximum file size (MB)<input type="number" required min={1} max={1024} value={form.max_file_size_mb} onChange={event => change('max_file_size_mb', event.target.value)} /></label>
      <label className="rf-field">Synchronization interval (seconds)<input type="number" required min={60} max={86400} value={form.interval_seconds} onChange={event => change('interval_seconds', event.target.value)} /></label>
      <label className="rf-acknowledgement"><input type="checkbox" checked={form.enabled} onChange={event => change('enabled', event.target.checked)} />Enable this connection</label>
    </fieldset>
    <p className="rf-message rf-notice">The office connector reads the source folder and sends updates to RADAI from a machine with access to the file server.</p>
    {error && <p role="alert" className="rf-message rf-error">{error}</p>}
    <div className="rf-dialog-actions"><button type="button" className="rf-button" onClick={onCancel} disabled={busy || disabled}>Cancel</button><button type="submit" className="rf-button rf-primary" disabled={busy || disabled}>{busy ? 'Saving…' : 'Save connection'}</button></div>
  </form>
}

function ReviewMapping({ scope, source, projects, onSaved, onCancel, onCopy, focusRequested, onFocusHandled }) {
  const panelRef = useRef(null)
  const projectSelectRef = useRef(null)
  const [project, setProject] = useState(String(scope.project || ''))
  const [audience, setAudience] = useState(scope.access_enabled && !isExcluded(scope, source) ? 'project' : 'admin')
  const [acknowledged, setAcknowledged] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const excluded = isExcluded(scope, source)
  const available = source.enabled && isIncluded(scope, source)
  const chosen = projects.find(item => String(item.id) === project)
  const code = projectCode(chosen) || (String(scope.project) === project ? scope.project_code : '')
  const codeMatched = Boolean(code && scope.relative_path.match(/^\d+/)?.[0] === String(code))
  const canEnable = Boolean(project && audience === 'project' && acknowledged && available)
  useEffect(() => {
    if (!focusRequested) return
    panelRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    projectSelectRef.current?.focus()
    onFocusHandled()
  }, [focusRequested, onFocusHandled])
  const save = async enable => {
    if (enable && !canEnable) return
    setBusy(true); setError('')
    try {
      const body = { project: project || null }
      if (enable) body.access_enabled = true
      else if (audience === 'admin' || String(scope.project || '') !== project || excluded) body.access_enabled = false
      const result = await Replica.updateScope(scope.id, body)
      onSaved(result); setAcknowledged(false)
    } catch (err) { setError(Replica.replicaError(err)) }
    finally { setBusy(false) }
  }
  return <section ref={panelRef} id="replica-mapping-review" className="rf-panel rf-review-panel" aria-label="Review mapping">
    <div className="rf-panel-heading"><FolderOpen size={20} /><h2>Review mapping</h2></div>
    <div className="rf-review-body">
      <h3>{scope.relative_path}</h3>
      {!scope.project && <p id="replica-mapping-guidance" className="rf-mapping-guidance">Choose the matching RADAI project below, then click <strong>Save mapping</strong> to link this folder. Project access is enabled separately.</p>}
      <label className="rf-field">Path<div className="rf-path"><input readOnly value={networkPath(source, scope)} /><button type="button" className="rf-button rf-icon-button" aria-label="Copy folder path" onClick={() => onCopy(networkPath(source, scope))}><Copy size={16} /></button></div></label>
      <section className="rf-review-section"><h4>1. Suggested match</h4><div className="rf-match-grid">
        <label className="rf-field">RADAI project<select ref={projectSelectRef} aria-describedby={!scope.project ? "replica-mapping-guidance" : undefined} value={project} onChange={event => { setProject(event.target.value); setAudience('admin'); setAcknowledged(false) }}><option value="">Unmapped — administrator access only</option>{project && !chosen && <option value={project}>{scope.project_code} — {scope.project_name || project}</option>}{projects.map(item => <option key={item.id} value={item.id}>{projectCode(item)} — {projectName(item)}</option>)}</select></label>
        <div className="rf-match-detail"><span>Match basis</span><Pill tone={codeMatched ? 'success' : 'neutral'} icon={codeMatched ? CheckCircle2 : LinkIcon}>{codeMatched ? 'Code match' : project ? 'Selected project' : 'No match'}</Pill><small>{codeMatched ? 'Project code matches the folder.' : project ? 'Review this project selection.' : 'Select a RADAI project.'}</small></div>
      </div></section>
      <section className="rf-review-section"><h4>2. Access scope</h4>
        <label className="rf-radio"><input type="radio" name="replica-audience" value="admin" checked={audience === 'admin'} onChange={() => { setAudience('admin'); setAcknowledged(false) }} /><span><strong>Administrators only</strong><small>Only administrators can access this folder.</small></span></label>
        <label className="rf-radio"><input type="radio" name="replica-audience" value="project" checked={audience === 'project'} disabled={!project || !available} onChange={() => setAudience('project')} /><span><strong>Project owner and active members</strong><small>Grant access to the project owner and all active project members.</small></span></label>
        <label className="rf-radio"><input type="radio" name="replica-audience" value="custom" disabled /><span><strong>Custom roles…</strong><small>Not configured. Manage this audience through project membership.</small></span></label>
        <div className="rf-warning-box"><AlertTriangle size={21} /><span>{excluded ? 'This folder is excluded. Include it again before enabling project access.' : !source.enabled ? 'This connection is disabled. Enable it in Manage connection before granting project access.' : !available ? 'This folder is outside the included paths. Review the connection settings before granting project access.' : 'Windows folder permissions are not imported. Review restricted subfolders before enabling project access.'}</span></div>
        <label className="rf-acknowledgement"><input type="checkbox" checked={acknowledged} disabled={audience !== 'project' || !available} onChange={event => setAcknowledged(event.target.checked)} /><span>I reviewed restricted folders and confirm this audience</span></label>
      </section>
      <section className="rf-review-section"><h4>3. Indexing</h4><div className="rf-indexing-grid">
        <div><FileText size={16} /><span>Document browsing</span><Pill tone={available ? 'success' : 'neutral'} icon={CheckCircle2}>{available ? 'On' : 'Off'}</Pill></div>
        <div><Database size={16} /><span>File size limit</span><strong>{source.max_file_size_mb} MB</strong></div>
        <div><Brain size={16} /><span>Information extraction</span><Pill tone={source.mode === 'mirror' && available ? 'success' : 'neutral'} icon={CheckCircle2}>{source.mode === 'mirror' && available ? 'On demand' : 'Off'}</Pill></div>
        <div><Folder size={16} /><span>Excluded folders</span><strong>{source.excluded_paths?.length || 0} configured</strong></div>
      </div></section>
      {error && <p role="alert" className="rf-message rf-error">{error}</p>}
    </div>
    <footer className="rf-review-footer"><div><button type="button" className="rf-button" onClick={onCancel} disabled={busy}>Cancel</button><button type="button" className="rf-button" onClick={() => save(false)} disabled={busy}>{busy ? 'Saving…' : 'Save mapping'}</button><button type="button" className="rf-button rf-primary" disabled={busy || !canEnable} onClick={() => save(true)}>Save &amp; enable access</button></div><small>{canEnable ? 'The selected project audience will receive access.' : 'Confirm access review to enable this action.'}</small></footer>
  </section>
}

function ReplicaConsole() {
  const [sources, setSources] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [scopes, setScopes] = useState([])
  const [projects, setProjects] = useState([])
  const [folderDates, setFolderDates] = useState({})
  const [activeId, setActiveId] = useState('')
  const [reviewRequest, setReviewRequest] = useState(null)
  const [checkedIds, setCheckedIds] = useState([])
  const [loading, setLoading] = useState(true)
  const [scopeLoading, setScopeLoading] = useState(false)
  const [error, setError] = useState('')
  const [scopeError, setScopeError] = useState('')
  const [sourceError, setSourceError] = useState('')
  const [notice, setNotice] = useState('')
  const [revision, setRevision] = useState(0)
  const [query, setQuery] = useState('')
  const [mappingFilter, setMappingFilter] = useState('all')
  const [accessFilter, setAccessFilter] = useState('all')
  const [ascending, setAscending] = useState(true)
  const [page, setPage] = useState(1)
  const [modal, setModal] = useState(null)
  const [menu, setMenu] = useState(false)
  const [token, setToken] = useState('')
  const [tokenBusy, setTokenBusy] = useState(false)
  const [sourceBusy, setSourceBusy] = useState(false)
  const [modalError, setModalError] = useState('')
  const [mutationBusy, setMutationBusy] = useState(false)
  const [history, setHistory] = useState({ loading: false, items: [], error: '' })
  const selectAllRef = useRef(null)
  const sourcesRequest = useRef(null)
  const source = sources.find(item => String(item.id) === selectedId)
  const activeScope = scopes.find(item => item.id === activeId)
  const reviewFolder = id => { setActiveId(id); setReviewRequest({ scopeId: id }) }
  const reviewFocused = useCallback(() => setReviewRequest(null), [])
  const openModal = value => { setModalError(''); setToken(''); setMenu(false); setModal(value) }
  const closeModal = () => { if (!mutationBusy && !tokenBusy && !sourceBusy) { setModal(null); setToken(''); setModalError('') } }
  const reload = useCallback(async () => {
    sourcesRequest.current?.abort()
    const controller = new AbortController()
    sourcesRequest.current = controller
    setLoading(true); setSourceError('')
    try {
      const data = Replica.itemsFrom(await Replica.listSources(controller.signal))
      if (controller.signal.aborted) return
      setSources(data); setSelectedId(previous => data.some(item => String(item.id) === previous) ? previous : String(data[0]?.id || ''))
    }
    catch (err) {
      if (!controller.signal.aborted) setSourceError(err?.response?.status === 404 ? 'The File Server Replica service is unavailable on the server.' : Replica.replicaError(err))
    }
    finally { if (!controller.signal.aborted) setLoading(false) }
  }, [])
  useEffect(() => { reload(); return () => sourcesRequest.current?.abort() }, [reload])
  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        let pageNumber = 1; const items = []; let next = true
        while (active && next) { const data = await listProjects({ page: pageNumber, page_size: 100 }); items.push(...Replica.itemsFrom(data)); next = Boolean(data.next); pageNumber += 1 }
        if (active) setProjects(items)
      } catch (err) { if (active) setError(`Project choices could not be loaded. ${Replica.replicaError(err)}`) }
    }
    load(); return () => { active = false }
  }, [])
  useEffect(() => { setActiveId(''); setReviewRequest(null); setCheckedIds([]); setToken(''); setQuery(''); setMappingFilter('all'); setAccessFilter('all'); setMenu(false) }, [selectedId])
  useEffect(() => {
    if (!selectedId) { setScopes([]); setScopeLoading(false); setScopeError(''); setFolderDates({}); return }
    const controller = new AbortController()
    setScopeLoading(true); setScopeError(''); setScopes([]); setFolderDates({})
    Replica.listScopes({ source: selectedId }, controller.signal).then(data => {
      if (controller.signal.aborted) return
      const items = Replica.itemsFrom(data); setScopes(items)
      setCheckedIds(previous => previous.filter(id => items.some(item => item.id === id)))
      setActiveId(previous => items.some(item => item.id === previous) ? previous : (items.find(item => item.project && !item.access_enabled) || items[0])?.id || '')
    }).catch(err => { if (!controller.signal.aborted) setScopeError(Replica.replicaError(err)) }).finally(() => { if (!controller.signal.aborted) setScopeLoading(false) })
    const loadDates = async () => {
      try {
        const dates = {}; let pageNumber = 1; let next = true
        while (!controller.signal.aborted && next) {
          const data = await Replica.listEntries({ source: selectedId, parent_path: '', page: pageNumber }, controller.signal)
          Replica.itemsFrom(data).forEach(entry => { if (entry.is_directory) dates[entry.relative_path] = entry.last_seen_at })
          next = Boolean(data.next); pageNumber += 1
        }
        if (!controller.signal.aborted) setFolderDates(dates)
      } catch { /* Mapping remains usable when catalogue dates are unavailable. */ }
    }
    loadDates(); return () => controller.abort()
  }, [selectedId, revision])
  useEffect(() => {
    if (modal?.type !== 'history' || !selectedId) return
    let active = true; setHistory({ loading: true, items: [], error: '' })
    Replica.listScans(selectedId).then(data => { if (active) setHistory({ loading: false, items: Replica.itemsFrom(data), error: '' }) }).catch(err => { if (active) setHistory({ loading: false, items: [], error: Replica.replicaError(err) }) })
    return () => { active = false }
  }, [modal?.type, selectedId])
  useEffect(() => {
    if (!menu) return
    const dismiss = event => { if (event.type === 'keydown' ? event.key === 'Escape' : !event.target.closest('.rf-menu-wrapper')) setMenu(false) }
    document.addEventListener('click', dismiss); document.addEventListener('keydown', dismiss)
    return () => { document.removeEventListener('click', dismiss); document.removeEventListener('keydown', dismiss) }
  }, [menu])
  useEffect(() => { setPage(1) }, [query, mappingFilter, accessFilter, selectedId])
  const filtered = scopes.filter(scope => {
    const state = mappingState(scope, source)
    const mappingMatches = mappingFilter === 'all' || (mappingFilter === 'linked' ? scope.project && state !== 'excluded' : mappingFilter === 'needs_review' ? ['review', 'unmapped'].includes(state) : state === mappingFilter)
    const enabled = projectAccess(scope, source)
    return mappingMatches && (accessFilter === 'all' || (accessFilter === 'enabled' ? enabled : !enabled)) && `${scope.relative_path} ${scope.project_code || ''} ${scope.project_name || ''}`.toLowerCase().includes(query.toLowerCase())
  }).sort((a, b) => (ascending ? 1 : -1) * a.relative_path.localeCompare(b.relative_path, undefined, { numeric: true }))
  const pageCount = Math.max(1, Math.ceil(filtered.length / FOLDERS_PER_PAGE))
  const currentPage = Math.min(page, pageCount)
  const visibleScopes = filtered.slice((currentPage - 1) * FOLDERS_PER_PAGE, currentPage * FOLDERS_PER_PAGE)
  const allChecked = visibleScopes.length > 0 && visibleScopes.every(item => checkedIds.includes(item.id))
  useEffect(() => { if (selectAllRef.current) selectAllRef.current.indeterminate = !allChecked && visibleScopes.some(item => checkedIds.includes(item.id)) }, [allChecked, visibleScopes, checkedIds])
  const refresh = () => { reload(); setRevision(value => value + 1) }
  const copy = async value => { try { await navigator.clipboard.writeText(value); setNotice('Copied to clipboard.') } catch { setError('Could not copy. Select and copy the displayed path manually.') } }
  const savedSource = async updated => { setSources(previous => previous.some(item => item.id === updated.id) ? previous.map(item => item.id === updated.id ? updated : item) : [...previous, updated]); setSelectedId(String(updated.id)); setModal(null); setRevision(value => value + 1); setNotice('Connection saved. The office connector will use these settings on its next synchronization.') }
  const savedScope = updated => { setScopes(previous => previous.map(item => item.id === updated.id ? updated : item)); setNotice('Mapping saved. Project folder access updated.') }
  const rotate = async () => {
    if (sourceBusy || tokenBusy) return
    setTokenBusy(true); setModalError(''); setToken('')
    try { const data = await Replica.rotateToken(selectedId); setToken(data.token) }
    catch (err) { setModalError(Replica.replicaError(err)) }
    finally { setTokenBusy(false) }
  }
  const excludeSelected = async () => {
    setMutationBusy(true); setModalError('')
    try {
      const paths = modal.scopes.map(item => item.relative_path)
      const updated = await Replica.updateSource(selectedId, { excluded_paths: [...new Set([...(source.excluded_paths || []), ...paths])] })
      setSources(previous => previous.map(item => item.id === updated.id ? updated : item)); setCheckedIds([]); setModal(null); setNotice(`${paths.length} folder${paths.length === 1 ? '' : 's'} excluded from synchronization and project access.`)
    } catch (err) { setModalError(Replica.replicaError(err)) }
    finally { setMutationBusy(false) }
  }
  const restoreFolder = async scope => {
    setMutationBusy(true); setModalError('')
    try {
      const saved = await Replica.updateScope(scope.id, { project: scope.project, access_enabled: false })
      setScopes(previous => previous.map(item => item.id === saved.id ? saved : item))
      const updated = await Replica.updateSource(selectedId, { excluded_paths: (source.excluded_paths || []).filter(path => !within(scope.relative_path, path)) })
      setSources(previous => previous.map(item => item.id === updated.id ? updated : item)); setModal(null); setActiveId(scope.id); setNotice('Folder included again with administrator access. Review the project audience before enabling access.')
    } catch (err) { setModalError(Replica.replicaError(err)) }
    finally { setMutationBusy(false) }
  }
  const health = loading ? ['neutral', 'Checking…'] : sourceError ? ['warning', 'Unavailable'] : !source ? ['neutral', 'Not configured'] : !source.enabled ? ['neutral', 'Disabled'] : ({ connected: ['success', 'Healthy'], syncing: ['blue', 'Syncing'], error: ['danger', 'Error'], offline: ['warning', 'Offline'], not_connected: ['neutral', 'Not connected'] }[source.status] || ['neutral', 'Unknown'])
  const unavailable = loading || Boolean(sourceError)
  const countsUnavailable = unavailable || scopeLoading || Boolean(scopeError)
  const mappedCount = new Set(scopes.filter(scope => scope.project && !isExcluded(scope, source)).map(scope => scope.project)).size
  const reviewCount = scopes.filter(scope => ['review', 'unmapped'].includes(mappingState(scope, source))).length
  const resetFilters = () => { setMappingFilter('all'); setAccessFilter('all'); setQuery('') }
  const metrics = [
    { label: 'Connection', value: health[1], detail: loading ? 'Loading connection status' : sourceError ? 'Connection status unavailable' : source ? contactLabel(source.last_heartbeat) : 'No server connection configured', icon: Server, tone: health[0] === 'success' ? 'green' : 'amber', onClick: () => source && openModal({ type: 'manage' }) },
    { label: 'Last sync', value: unavailable || !source ? '—' : dateLabel(source.last_success_at), detail: loading ? 'Loading sync status' : sourceError ? 'Sync status unavailable' : !source ? 'No connection configured' : source.last_success_at ? 'Completed' : 'Awaiting synchronization', icon: RefreshCw, tone: unavailable ? 'blue' : 'green', onClick: () => source && openModal({ type: 'history' }) },
    { label: 'Discovered folders', value: countsUnavailable ? '—' : scopes.length, icon: Folder, tone: 'blue', onClick: resetFilters },
    { label: 'Mapped projects', value: countsUnavailable ? '—' : mappedCount, icon: LinkIcon, tone: 'blue', onClick: () => { resetFilters(); setMappingFilter('linked') } },
    { label: 'Review required', value: countsUnavailable ? '—' : reviewCount, icon: AlertTriangle, tone: 'amber', onClick: () => { resetFilters(); setMappingFilter('needs_review') } },
  ]
  return <div className="file-replica-workspace">
    <header className="rf-page-header"><div><nav className="rf-breadcrumb" aria-label="Breadcrumb"><a href="/admin/dashboard">Administration</a><span>/</span><span>Integrations</span><span>/</span><span aria-current="page">File Server Replica</span></nav><h1>File Server Replica</h1><p className="rf-subtitle">Connect approved server folders to projects for secure browsing and document indexing.</p></div><div className="rf-header-actions"><button type="button" className="rf-button" disabled={!source} onClick={() => openModal({ type: 'history' })}><History size={16} />View audit log</button><button type="button" className="rf-button" disabled={loading || scopeLoading} onClick={refresh}><RefreshCw size={16} className={loading ? 'animate-spin' : ''} />Refresh</button><button type="button" className="rf-button rf-primary" onClick={() => openModal({ type: 'add' })}><Plus size={17} />Add connection</button></div></header>
    {error && <p role="alert" className="rf-message rf-error">{error}</p>}{notice && <p role="status" className="rf-message rf-notice">{notice}<button type="button" aria-label="Dismiss notification" onClick={() => setNotice('')}><X size={14} /></button></p>}
    {sourceError && <div role="alert" className="rf-message rf-error"><span>Could not load server connections. {sourceError}</span><button type="button" className="rf-button" onClick={reload}>Retry connections</button></div>}
    <section className="rf-metrics" aria-label="File server summary" aria-busy={loading}>{metrics.map(({ label, value, detail, icon: Icon, tone, onClick }) => <button type="button" key={label} className="rf-metric" onClick={onClick}><span className={`rf-metric-icon rf-${tone}`}><Icon size={26} /></span><span className="rf-metric-copy"><span>{label}</span><strong>{value}</strong>{detail && <small>{label === 'Last sync' && !unavailable && source?.last_success_at && <CheckCircle2 size={12} />}{detail}</small>}</span><ChevronRight size={17} className="rf-chevron" /></button>)}</section>
    {loading && !source && <p role="status" className="rf-empty">Loading server connections…</p>}
    {!loading && !source && !sourceError && !error && <section className="rf-panel rf-empty"><Server size={40} /><h2>Connect your first server folder</h2><p>Add a connection to discover project folders and review access.</p><button type="button" className="rf-button rf-primary" onClick={() => openModal({ type: 'add' })}><Plus size={16} />Add connection</button></section>}
    {source && <>
      <section className="rf-connection" aria-label="Server connection"><div className="rf-connection-identity"><Server size={36} /><div><div><h2>{source.name}</h2><Pill tone={health[0]} icon={CheckCircle2}>{health[1] === 'Healthy' ? 'Connected' : health[1]}</Pill></div><p title={source.root_path}>{source.root_path}</p></div></div><dl className="rf-connection-facts">{[['Mode', source.mode === 'mirror' ? 'Mirror files' : 'Catalogue'], ['Last successful sync', unavailable ? 'Unavailable' : dateLabel(source.last_success_at)], ['Connector version', source.connector_version || 'Not reported'], ['Credential last rotated', source.token_rotated_at ? dateLabel(source.token_rotated_at) : 'Not reported']].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><div className="rf-connection-actions"><button type="button" className="rf-button" onClick={() => openModal({ type: 'manage' })}><Settings size={17} />Manage connection</button><div className="rf-menu-wrapper"><button type="button" className="rf-button rf-icon-button" aria-label="More connection actions" aria-expanded={menu} onClick={() => setMenu(previous => !previous)}><MoreHorizontal size={19} /></button>{menu && <div className="rf-menu"><button type="button" onClick={() => { copy(source.id); setMenu(false) }}><Copy size={15} />Copy source ID</button><button type="button" onClick={() => openModal({ type: 'manage' })}><Key size={15} />Connector credentials</button><button type="button" onClick={() => openModal({ type: 'history' })}><History size={15} />Synchronization history</button></div>}</div></div></section>
      {source.last_error && <p role="alert" className="rf-message rf-error">{source.last_error}</p>}
      {!unavailable && source.status === 'offline' && <div className="rf-message rf-connection-note" role="status"><Clock size={17} aria-hidden="true" /><div><strong>Office connector offline</strong><p>Offline means RADAI has not received a recent connector heartbeat. Last contact: {dateLabel(source.last_heartbeat)}. Cached folders remain browsable; updates resume when the office connector reconnects.</p></div><button type="button" className="rf-button" onClick={() => openModal({ type: 'manage' })}>Check connection</button></div>}
      {!unavailable && source.status === 'not_connected' && <div className="rf-message rf-connection-note" role="status"><Server size={17} aria-hidden="true" /><div><strong>Awaiting office connector</strong><p>The connector has not contacted RADAI yet. Start it on a machine that can access {source.root_path}, then refresh this page.</p></div></div>}
      {!unavailable && source.status === 'syncing' && source.latest_scan && <div className="rf-message rf-connection-note" role="status"><RefreshCw size={17} aria-hidden="true" /><div><strong>Folder scan in progress</strong><p>Started {dateLabel(source.latest_scan.started_at)}{source.latest_scan.entry_count != null ? ` · ${source.latest_scan.entry_count.toLocaleString()} catalogue entries seen` : ''}. Refresh to load the latest discovered folders and files.</p></div></div>}
      {source.scan_state === 'discovery_only' && <p className="rf-message"><FolderOpen size={17} aria-hidden="true" />This connection currently discovers project folder names only. Include the project folders in Manage connection to scan their subfolders and files.</p>}
      <div className="rf-workbench">
        <section className="rf-panel rf-mapping-panel" aria-label="Folder mappings"><div className="rf-panel-heading"><FolderOpen size={20} /><h2>Folder mappings</h2></div><div className="rf-tools">
          <div className="rf-search-row"><select aria-label="Server connection" value={selectedId} onChange={event => setSelectedId(event.target.value)}>{sources.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select><div className="rf-search"><Search size={16} /><input aria-label="Search folders" placeholder="Search folder, project code or name…" value={query} onChange={event => setQuery(event.target.value)} /></div></div>
          <div className="rf-filters"><label>Mapping status<select value={mappingFilter} onChange={event => setMappingFilter(event.target.value)}><option value="all">All</option><option value="unmapped">Unmapped</option><option value="review">Review mapping</option><option value="mapped">Mapped</option><option value="linked">Linked to project</option><option value="needs_review">Review required</option><option value="excluded">Excluded</option></select></label><label>Access status<select value={accessFilter} onChange={event => setAccessFilter(event.target.value)}><option value="all">All</option><option value="admin">Admin only</option><option value="enabled">Enabled</option></select></label><button type="button" className="rf-button" onClick={() => openModal({ type: 'discover' })}><FolderOpen size={18} />Discover folders</button></div>
          <div className="rf-bulk-toolbar"><label className="rf-selection-count"><input type="checkbox" ref={selectAllRef} aria-label="Select all visible folders" checked={allChecked} disabled={!visibleScopes.length} onChange={() => setCheckedIds(previous => allChecked ? previous.filter(id => !visibleScopes.some(item => item.id === id)) : [...new Set([...previous, ...visibleScopes.map(item => item.id)])])} /><strong>{checkedIds.length} selected</strong></label><button type="button" className="rf-button" disabled={!checkedIds.length} onClick={() => { reviewFolder(checkedIds[0]); if (checkedIds.length > 1) setNotice('Review and save each selected folder individually before enabling its project audience.') }}><Users size={17} />Review access</button><button type="button" className="rf-button" disabled={!checkedIds.length} onClick={() => openModal({ type: 'exclude', scopes: scopes.filter(item => checkedIds.includes(item.id)) })}><Ban size={17} />Exclude</button><span className="rf-folder-count">{filtered.length} folders</span></div>
          <p className="rf-browse-hint">Click a folder name or Browse to open its catalogue. Map links the folder to a RADAI project; it is not required for administrator browsing.</p>
        </div>
        <div className="rf-table-wrap" tabIndex={0} role="region" aria-label="Discovered project folders"><table className="rf-table" data-table-typography="preserve"><colgroup>{[5, 23, 16, 14, 12, 12, 18].map((width, index) => <col key={index} style={{ width: `${width}%` }} />)}</colgroup><thead><tr><th scope="col"><span className="sr-only">Selection</span></th><th scope="col" aria-sort={ascending ? 'ascending' : 'descending'}><button type="button" onClick={() => setAscending(value => !value)}>Folder {ascending ? <ArrowUp size={12} /> : <ArrowDown size={12} />}</button></th><th scope="col">Detected project</th><th scope="col">Mapping</th><th scope="col">Access</th><th scope="col" title="Last time the folder was seen in the synchronized catalogue">Last indexed</th><th scope="col">Actions</th></tr></thead><tbody>
          {scopeLoading ? <tr><td colSpan={7}><p role="status" className="rf-empty">Loading discovered folders…</p></td></tr> : scopeError ? <tr><td colSpan={7}><p role="alert" className="rf-message rf-error">{scopeError}</p></td></tr> : !visibleScopes.length ? <tr><td colSpan={7}><div className="rf-empty"><FolderOpen size={30} /><p>{scopes.length ? 'No folders match these filters.' : 'No folders discovered yet. Run the office connector, then refresh.'}</p>{scopes.length > 0 && <button type="button" className="rf-button" onClick={resetFilters}>Clear filters</button>}</div></td></tr> : visibleScopes.map(scope => {
            const state = mappingState(scope, source); const enabled = projectAccess(scope, source)
            return <tr key={scope.id} className={checkedIds.includes(scope.id) || activeId === scope.id ? 'rf-selected' : ''}>
              <td><input type="checkbox" aria-label={`Select ${scope.relative_path}`} checked={checkedIds.includes(scope.id)} onChange={event => setCheckedIds(previous => event.target.checked ? [...previous, scope.id] : previous.filter(id => id !== scope.id))} /></td>
              <td><button type="button" className="rf-folder-cell" title={`Browse ${scope.relative_path}`} onClick={() => openModal({ type: 'browse', scope })}><Folder size={16} /><span>{scope.relative_path}</span></button></td>
              <td><div className="rf-project-cell">{scope.project ? <><strong>{scope.project_code}</strong><span>{scope.project_name}</span></> : <span className="rf-muted">No matching project</span>}</div></td><td><MappingPill scope={scope} source={source} /></td><td><Pill tone={enabled ? 'success' : 'blue'} icon={enabled ? Users : Lock}>{enabled ? 'Enabled' : state === 'excluded' ? 'Admin only' : !source.enabled ? 'Paused' : !isIncluded(scope, source) ? 'Not included' : 'Admin only'}</Pill></td><td><span className="rf-indexed-date">{folderDates[scope.relative_path] ? dateLabel(folderDates[scope.relative_path]) : state === 'excluded' ? 'Not indexed' : 'Never'}</span></td>
              <td><div className="rf-row-actions"><button type="button" className="rf-button rf-browse-button" aria-label={`Browse ${scope.relative_path}`} onClick={() => openModal({ type: 'browse', scope })}>Browse</button><button type="button" className="rf-button rf-map-button" aria-controls="replica-mapping-review" title={state === 'unmapped' ? 'Link this folder to a RADAI project' : 'Review project mapping and access'} onClick={() => reviewFolder(scope.id)}>{state === 'unmapped' ? 'Map' : 'Review'}</button><button type="button" className="rf-icon-button" aria-label={`More actions for ${scope.relative_path}`} onClick={() => openModal({ type: 'folder', scope })}><MoreHorizontal size={17} /></button></div></td>
            </tr>
          })}
        </tbody></table></div>
        {filtered.length > FOLDERS_PER_PAGE && <footer className="rf-pagination"><span>{(currentPage - 1) * FOLDERS_PER_PAGE + 1}–{Math.min(currentPage * FOLDERS_PER_PAGE, filtered.length)} of {filtered.length} folders</span><div><button type="button" className="rf-button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Previous</button><span>Page {currentPage} of {pageCount}</span><button type="button" className="rf-button" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>Next</button></div></footer>}
        </section>
        {activeScope ? <ReviewMapping key={`${activeScope.id}:${activeScope.project}:${activeScope.access_enabled}:${isExcluded(activeScope, source)}`} scope={activeScope} source={source} projects={projects} onSaved={savedScope} onCancel={() => { setActiveId(''); setReviewRequest(null) }} onCopy={copy} focusRequested={reviewRequest?.scopeId === activeScope.id} onFocusHandled={reviewFocused} /> : <section id="replica-mapping-review" className="rf-panel rf-review-panel" aria-label="Review mapping"><div className="rf-panel-heading"><FolderOpen size={20} /><h2>Review mapping</h2></div><div className="rf-empty"><FolderOpen size={32} /><p>Select a folder to review its project and access settings.</p></div></section>}
      </div>
    </>}
    {modal && <Dialog title={{ add: 'Add connection', manage: 'Manage connection', history: 'Synchronization history', discover: 'Discover folders', exclude: 'Exclude folders', folder: 'Folder actions', browse: 'Server files' }[modal.type]} wide={modal.type === 'browse'} busy={sourceBusy || tokenBusy || mutationBusy} onClose={closeModal}>
      {modalError && <p role="alert" className="rf-message rf-error">{modalError}</p>}
      {modal.type === 'add' && <SourceForm onSaved={savedSource} onCancel={closeModal} onBusyChange={setSourceBusy} />}
      {modal.type === 'manage' && source && <><label className="rf-field">Source ID<div className="rf-path"><input readOnly value={source.id} onFocus={event => event.target.select()} /><button type="button" className="rf-button rf-icon-button" aria-label="Copy source ID" onClick={() => copy(source.id)}><Copy size={16} /></button></div></label><SourceForm key={source.id} source={source} onSaved={savedSource} onCancel={closeModal} disabled={tokenBusy} onBusyChange={setSourceBusy} /><section className="rf-credentials"><h3><Key size={17} />Connector credentials</h3><p>Replacing a token invalidates the previous token. Update the office connector with the new value.</p><button type="button" className="rf-button" disabled={tokenBusy || sourceBusy} onClick={rotate}>{tokenBusy ? 'Creating token…' : 'Create / replace connector token'}</button>{token && <div className="rf-message rf-notice"><label className="rf-field">Connector token — shown once<input readOnly value={token} onFocus={event => event.target.select()} autoComplete="off" spellCheck={false} /></label><button type="button" className="rf-button" onClick={() => setToken('')}>Hide token</button></div>}</section></>}
      {modal.type === 'history' && <><p className="rf-muted">Recent synchronization runs for {source?.name}. Mapping and permission changes are not included in this history.</p>{history.loading ? <p role="status" className="rf-empty">Loading synchronization history…</p> : history.error ? <p role="alert" className="rf-message rf-error">{history.error}</p> : !history.items.length ? <p className="rf-empty">No synchronization runs recorded.</p> : <div className="rf-history-list">{history.items.map(scan => <article key={scan.id} className="rf-history-item"><div><Clock size={17} /><strong>{dateLabel(scan.started_at)}</strong><Pill tone={scan.status === 'completed' ? 'success' : scan.status === 'failed' ? 'danger' : 'neutral'}>{scan.status.replaceAll('_', ' ')}</Pill></div><p>Completed: {dateLabel(scan.completed_at)}</p>{scan.error && <p className="rf-message rf-error">{scan.error}</p>}</article>)}</div>}</>}
      {modal.type === 'discover' && source && <><p>Folder discovery runs through the office connector on a machine that can access <strong>{source.root_path}</strong>.</p><div className="rf-message rf-notice">The connector checks for updates every {source.interval_seconds} seconds while it is running. Start a synchronization on that machine, then refresh the catalogue here.</div><p className="rf-muted">{contactLabel(source.last_heartbeat)} · Last successful sync: {dateLabel(source.last_success_at)}</p><div className="rf-dialog-actions"><button type="button" className="rf-button" onClick={() => openModal({ type: 'manage' })}>Manage connection</button><button type="button" className="rf-button rf-primary" onClick={() => { refresh(); closeModal() }}><RefreshCw size={16} />Refresh catalogue</button></div></>}
      {modal.type === 'exclude' && <><p>Exclude these folders from synchronization and project access? Files on your server are preserved.</p><ul className="rf-exclusion-list">{modal.scopes.map(scope => <li key={scope.id}>{scope.relative_path}</li>)}</ul><div className="rf-dialog-actions"><button type="button" className="rf-button" disabled={mutationBusy} onClick={closeModal}>Cancel</button><button type="button" className="rf-button rf-danger" disabled={mutationBusy} onClick={excludeSelected}>{mutationBusy ? 'Excluding…' : 'Exclude folders'}</button></div></>}
      {modal.type === 'folder' && <><h3>{modal.scope.relative_path}</h3><p className="rf-muted">{networkPath(source, modal.scope)}</p><div className="rf-dialog-actions"><button type="button" className="rf-button" onClick={() => copy(networkPath(source, modal.scope))}><Copy size={16} />Copy folder path</button><button type="button" className="rf-button" onClick={() => openModal({ type: 'browse', scope: modal.scope })}><FolderOpen size={16} />Browse synchronized files</button>{isExcluded(modal.scope, source) && <button type="button" className="rf-button rf-primary" disabled={mutationBusy} onClick={() => restoreFolder(modal.scope)}>Include folder again</button>}</div></>}
      {modal.type === 'browse' && <ServerFileBrowser sourceId={selectedId} source={source} initialScopeId={modal.scope.id} revision={revision} />}
    </Dialog>}
  </div>
}

export default function FileServerReplica() {
  const user = useSelector(state => state.auth?.user)
  if (!Replica.canManageReplica(user)) return <section className="m-6 rounded-xl border border-slate-200 bg-white p-6"><h1 className="text-xl font-semibold text-slate-900">Administrator access required</h1><p className="mt-2 text-sm text-slate-600">Your account cannot manage file server connections.</p></section>
  return <ReplicaConsole />
}
