/* eslint-disable react/prop-types */
import { useEffect, useRef, useState } from 'react'
import { ArchiveBoxIcon, ArrowDownTrayIcon, ArrowPathIcon, ArrowUpIcon, CubeIcon, DocumentTextIcon, FolderIcon, InformationCircleIcon, MagnifyingGlassIcon, PhotoIcon, TableCellsIcon } from '@heroicons/react/24/outline'
import * as Replica from '../../services/fileReplica.service'
import ReplicaStatus, { dateLabel, sizeLabel } from './ReplicaStatus'

const buttonStyle = 'inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600'
const fieldStyle = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500'
const EMPTY_SYNC_REFRESH_MS = 10000
const extensionOf = entry => String(entry.file_extension || entry.name?.match(/\.([^.]+)$/)?.[1] || '').replace(/^\./, '').toLowerCase()
const typeLabel = entry => {
  if (entry.is_directory) return 'Folder'
  if (entry.type_label) return entry.type_label
  const extension = extensionOf(entry)
  const labels = { pdf: 'PDF document', doc: 'Word document', docx: 'Word document', xls: 'Excel workbook', xlsx: 'Excel workbook', xlsm: 'Excel workbook', csv: 'CSV file', txt: 'Text document', dwg: 'DWG drawing', dxf: 'DXF drawing', dgn: 'DGN drawing', zip: 'ZIP archive', rar: 'RAR archive', '7z': '7Z archive', jpg: 'JPEG image', jpeg: 'JPEG image', png: 'PNG image', gif: 'GIF image', webp: 'WebP image', json: 'JSON file' }
  return labels[extension] || (extension ? `${extension.toUpperCase()} file` : 'Unknown file')
}
function EntryIcon({ entry }) {
  const extension = extensionOf(entry)
  const [Icon, color] = entry.is_directory ? [FolderIcon, 'text-amber-600']
    : ['xls', 'xlsx', 'xlsm', 'csv', 'ods'].includes(extension) ? [TableCellsIcon, 'text-emerald-700']
      : ['dwg', 'dxf', 'dgn', 'rvt', 'ifc', 'step', 'stp'].includes(extension) ? [CubeIcon, 'text-violet-700']
        : ['zip', 'rar', '7z', 'tar', 'gz'].includes(extension) ? [ArchiveBoxIcon, 'text-amber-700']
          : ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tif', 'tiff'].includes(extension) ? [PhotoIcon, 'text-sky-700']
            : [DocumentTextIcon, extension === 'pdf' ? 'text-rose-700' : 'text-blue-700']
  return <Icon className={`h-5 w-5 shrink-0 ${color}`} aria-hidden="true" />
}
const contentLabel = entry => entry.is_directory && entry.status === 'indexed' ? 'Indexed folder' : entry.status === 'available' && entry.current_version ? 'Content available' : entry.status === 'indexed' ? 'Metadata only' : undefined
const emptyDescription = (scope, search, autoRefreshing = false) => {
  if (search) return 'No matching files or folders in this project catalogue. Search includes all indexed subfolders.'
  if (scope?.in_inventory_scope === false) return 'This project folder is outside the current inventory scope. Review the included and excluded paths in the connection settings.'
  if (autoRefreshing) return 'No contents are indexed in this folder yet. The server scan is running; this view refreshes automatically.'
  if (scope?.source_scan_state === 'discovery_only') return 'Project folders have been discovered, but their contents are not being scanned. An administrator must include the project folders in the connection settings, then run the connector.'
  if (scope?.source_scan_state === 'unscanned') return 'This folder has not been scanned with the current connection settings. Run the office connector, then refresh the catalogue.'
  if (scope?.source_scan_state === 'syncing') return 'The connector is still scanning. Refresh after synchronization to see newly catalogued files and subfolders.'
  if (scope?.source_scan_state === 'incomplete') return 'The latest scan is incomplete. The office connector must finish a successful synchronization to update this folder.'
  return 'No catalogued entries for this path. The catalogue contains only scanned, included paths; this does not confirm that the server folder is empty.'
}
const previewKind = entry => {
  const type = entry.content_type?.split(';')[0]?.toLowerCase()
  if (type === 'application/pdf') return 'pdf'
  if (['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/bmp'].includes(type)) return 'image'
  if (['text/plain', 'text/csv', 'application/json'].includes(type)) return 'text'
  return null
}

function ExtractionCard({ extraction, onReviewed }) {
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const review = async status => {
    setBusy(true); setError('')
    try { onReviewed(await Replica.reviewExtraction(extraction.id, { status, notes })) }
    catch (err) { setError(Replica.replicaError(err)) }
    finally { setBusy(false) }
  }
  return <article className="space-y-3 rounded-lg border border-slate-200 p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h4 className="text-sm font-semibold text-slate-900">Version {extraction.version_number || '—'} · {dateLabel(extraction.created_at)}</h4>
      <ReplicaStatus status={extraction.status} />
    </div>
    {extraction.stale && <p className="rounded bg-amber-50 p-2 text-sm text-amber-900">The server file has changed. Extract the current version before accepting information.</p>}
    {extraction.error && <p role="alert" className="text-sm text-rose-700">{extraction.error}</p>}
    {extraction.warnings?.map((warning, index) => <p key={index} className="text-sm text-amber-900">{warning}</p>)}
    {!!extraction.suggestions?.length && <div className="space-y-2">
      <h5 className="text-sm font-semibold text-slate-800">Proposed information</h5>
      {extraction.suggestions.map((item, index) => <div key={index} className="rounded-md bg-slate-50 p-3 text-sm">
        <p className="font-medium text-slate-900">{item.label}: {typeof item.value === 'object' ? JSON.stringify(item.value) : String(item.value ?? '')}</p>
        <p className="mt-1 whitespace-pre-wrap break-words text-slate-600">{item.evidence}</p>
        <p className="mt-1 text-xs text-slate-500">Source: {item.location}</p>
      </div>)}
    </div>}
    {!!extraction.sections?.length && <details className="rounded-md border border-slate-200 p-3">
      <summary className="cursor-pointer text-sm font-medium text-indigo-700">Read extracted text ({extraction.sections.length} sections)</summary>
      <div className="mt-3 max-h-96 space-y-4 overflow-auto">
        {extraction.sections.map((section, index) => <section key={index}><h5 className="text-xs font-semibold text-slate-600">{section.location}</h5><p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-800">{section.text}</p></section>)}
      </div>
    </details>}
    {extraction.status === 'pending_review' && <div className="space-y-2 border-t border-slate-100 pt-3">
      <label className="block text-sm text-slate-700">Review notes<textarea value={notes} onChange={event => setNotes(event.target.value)} rows={2} className={`${fieldStyle} mt-1`} /></label>
      <p className="text-xs text-slate-600">Accepting saves reviewed evidence. Project progress and baselines require a separate update.</p>
      <div className="flex flex-wrap gap-2"><button type="button" className={buttonStyle} disabled={busy || extraction.stale} onClick={() => review('accepted')}>Accept evidence</button><button type="button" className={buttonStyle} disabled={busy} onClick={() => review('rejected')}>Reject</button></div>
    </div>}
    {extraction.reviewed_at && <p className="text-xs text-slate-600">Reviewed {dateLabel(extraction.reviewed_at)}{extraction.review_notes ? ` · ${extraction.review_notes}` : ''}</p>}
    {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
  </article>
}

function FileDetails({ entry, mode, onClose }) {
  const [extractions, setExtractions] = useState([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const [preview, setPreview] = useState(null)
  const previewUrl = useRef(null)
  const active = useRef(true)
  const kind = previewKind(entry)
  const available = entry.status === 'available' && Boolean(entry.current_version)

  useEffect(() => {
    const controller = new AbortController()
    active.current = true
    Replica.listExtractions(entry.id, controller.signal).then(data => {
      if (!controller.signal.aborted) setExtractions(Replica.itemsFrom(data))
    }).catch(err => { if (!controller.signal.aborted) setError(Replica.replicaError(err)) })
      .finally(() => { if (!controller.signal.aborted) setHistoryLoading(false) })
    return () => { controller.abort(); active.current = false; if (previewUrl.current) URL.revokeObjectURL(previewUrl.current) }
  }, [entry.id])

  const getFile = async inline => {
    setBusy(inline ? 'preview' : 'download'); setError('')
    try {
      const blob = await Replica.downloadEntry(entry.id, inline)
      if (!active.current) return
      if (inline && kind === 'text') {
        const text = await blob.text()
        if (active.current) setPreview({ kind, text })
      } else {
        const url = URL.createObjectURL(blob)
        if (inline) {
          if (previewUrl.current) URL.revokeObjectURL(previewUrl.current)
          previewUrl.current = url; setPreview({ kind, url })
        } else {
          const link = document.createElement('a'); link.href = url; link.download = entry.name
          document.body.appendChild(link); link.click(); link.remove()
          window.setTimeout(() => URL.revokeObjectURL(url), 1000)
        }
      }
    } catch (err) {
      if (active.current) {
        if (err.response?.data instanceof Blob) {
          try { err.response.data = JSON.parse(await err.response.data.text()) } catch { /* Use normal request error for a non-JSON response. */ }
        }
        setError(Replica.replicaError(err))
      }
    } finally { if (active.current) setBusy('') }
  }
  const extract = async () => {
    setBusy('extract'); setError('')
    try {
      const data = await Replica.extractEntry(entry.id)
      if (active.current) setExtractions(previous => [data, ...previous.filter(item => item.id !== data.id)])
    } catch (err) { if (active.current) setError(Replica.replicaError(err)) }
    finally { if (active.current) setBusy('') }
  }

  return <section aria-label={`File details: ${entry.name}`} className="space-y-4 border-t border-slate-200 bg-white p-5">
    <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="break-words font-semibold text-slate-900">{entry.name}</h3><p className="mt-1 break-words text-xs text-slate-500">{entry.relative_path} · Version {entry.version_number || '—'}</p></div><button type="button" className={buttonStyle} onClick={onClose}>Close details</button></div>
    <div className="flex flex-wrap items-center gap-2"><ReplicaStatus status={entry.status} label={contentLabel(entry)} /><span className="text-xs text-slate-600">{typeLabel(entry)} · {sizeLabel(entry.size_bytes)} · Modified {dateLabel(entry.modified_at)}</span></div>
    <p className="text-xs text-slate-500">Last seen on server: {dateLabel(entry.last_seen_at)}</p>
    {entry.error && <p className="text-sm text-rose-700">{entry.error}</p>}
    {!available && <p className="text-sm text-slate-600">{mode === 'catalogue' ? 'Catalogue mode stores folder names, file types and metadata. Preview, download and extraction require Mirror mode and a successfully copied file version.' : 'File contents are not available for this version. Your administrator can check replication settings and synchronization.'}</p>}
    <div className="flex flex-wrap gap-2">
      {kind && <button type="button" className={buttonStyle} disabled={!available || !!busy} onClick={() => getFile(true)}>{busy === 'preview' ? 'Loading preview…' : 'Preview'}</button>}
      <button type="button" className={buttonStyle} disabled={!available || !!busy} onClick={() => getFile(false)}><ArrowDownTrayIcon className="h-4 w-4" aria-hidden="true" />{busy === 'download' ? 'Downloading…' : 'Download'}</button>
      <button type="button" className={buttonStyle} disabled={!available || !!busy} onClick={extract}>{busy === 'extract' ? 'Extracting information…' : 'Extract information'}</button>
    </div>
    {!kind && available && <p className="text-xs text-slate-600">Download this format to view it in its desktop application.</p>}
    {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
    {preview?.kind === 'pdf' && <iframe title={`Preview of ${entry.name}`} src={preview.url} className="h-[32rem] w-full rounded-lg border border-slate-200" sandbox="allow-same-origin" />}
    {preview?.kind === 'image' && <img src={preview.url} alt={`Preview of ${entry.name}`} className="max-h-[32rem] max-w-full rounded-lg object-contain" />}
    {preview?.kind === 'text' && <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-4 text-sm text-slate-800">{preview.text}</pre>}
    <div className="space-y-3"><h3 className="font-semibold text-slate-900">Extracted information</h3>
      <p className="text-xs text-slate-600">Supported documents can provide text and proposed values with their source locations. Review the evidence before using it.</p>
      {historyLoading ? <p role="status" className="text-sm text-slate-500">Loading extraction history…</p> : !extractions.length && <p className="text-sm text-slate-500">No extraction has been run for this file.</p>}
      {extractions.map(extraction => <ExtractionCard key={extraction.id} extraction={extraction} onReviewed={updated => setExtractions(previous => previous.map(item => item.id === updated.id ? updated : item))} />)}
    </div>
  </section>
}

export default function ServerFileBrowser({ projectId, sourceId, initialScopeId, source, revision = 0 }) {
  const [scopes, setScopes] = useState([])
  const [scopeId, setScopeId] = useState('')
  const [scopeLoading, setScopeLoading] = useState(true)
  const [scopeError, setScopeError] = useState('')
  const [parentPath, setParentPath] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [refresh, setRefresh] = useState(0)
  const [listing, setListing] = useState({ items: [], count: 0, loading: false, error: '' })
  const [selected, setSelected] = useState(null)
  const contextRef = useRef('')
  const navigationRef = useRef({ scopeId: '', parentPath: '' })
  const scope = scopes.find(item => String(item.id) === scopeId)
  const rootPath = scope?.relative_path || ''
  const mode = scope?.source_mode || source?.mode
  const sourceStatus = scope?.source_status || source?.status
  const scanState = scope?.source_scan_state || source?.scan_state
  const lastHeartbeat = scope?.source_last_heartbeat || source?.last_heartbeat
  const lastSuccess = scope?.source_last_success_at || source?.last_success_at
  useEffect(() => { navigationRef.current = { scopeId, parentPath } }, [scopeId, parentPath])

  useEffect(() => {
    const controller = new AbortController()
    const context = `${projectId || ''}:${sourceId || ''}:${initialScopeId || ''}`
    const changed = contextRef.current !== context
    const previous = navigationRef.current
    contextRef.current = context
    setScopeLoading(true); setScopeError(''); setSelected(null)
    if (changed) { setScopes([]); setScopeId(''); setParentPath(''); setSearch(''); setSearchInput(''); setPage(1) }
    Replica.listScopes({ ...(projectId ? { project: projectId } : { source: sourceId }) }, controller.signal).then(data => {
      if (controller.signal.aborted) return
      const items = Replica.itemsFrom(data)
      setScopes(items)
      const initial = !changed && items.find(item => String(item.id) === previous.scopeId) || items.find(item => String(item.id) === String(initialScopeId)) || items[0]
      if (initial) {
        const keepPath = !changed && String(initial.id) === previous.scopeId && (previous.parentPath === initial.relative_path || previous.parentPath.startsWith(`${initial.relative_path}/`))
        setScopeId(String(initial.id)); setParentPath(keepPath ? previous.parentPath : initial.relative_path)
        if (!keepPath) setPage(1)
      } else { setScopeId(''); setParentPath('') }
    }).catch(err => { if (!controller.signal.aborted) setScopeError(Replica.replicaError(err)) })
      .finally(() => { if (!controller.signal.aborted) setScopeLoading(false) })
    return () => controller.abort()
  }, [projectId, sourceId, initialScopeId, revision, refresh])

  useEffect(() => {
    if (!scopeId || scopeLoading) { setListing({ items: [], count: 0, loading: false, error: '' }); return }
    const controller = new AbortController()
    setSelected(null); setListing({ items: [], count: 0, loading: true, error: '' })
    const params = { ...(projectId ? { project: projectId } : { source: sourceId }), scope: scopeId, page,
      ...(search ? { search } : { parent_path: parentPath }) }
    Replica.listEntries(params, controller.signal).then(data => {
      if (!controller.signal.aborted) setListing({ items: Replica.itemsFrom(data), count: data.count ?? Replica.itemsFrom(data).length, next: data.next, previous: data.previous, loading: false, error: '' })
    }).catch(err => { if (!controller.signal.aborted) setListing({ items: [], count: 0, loading: false, error: Replica.replicaError(err) }) })
    return () => controller.abort()
  }, [projectId, sourceId, scopeId, scopeLoading, parentPath, search, page])

  const autoRefreshing = Boolean(scopeId && !scopeLoading && !scopeError && !listing.loading && !listing.error
    && !listing.items.length && listing.count === 0 && !selected && !search && !searchInput && page === 1
    && scope?.in_inventory_scope !== false && scanState === 'syncing' && sourceStatus !== 'offline')
  useEffect(() => {
    if (!autoRefreshing) return undefined
    const timer = window.setTimeout(() => setRefresh(value => value + 1), EMPTY_SYNC_REFRESH_MS)
    return () => window.clearTimeout(timer)
  }, [autoRefreshing, projectId, sourceId, initialScopeId, scopeId, parentPath, revision])

  const navigate = path => { setParentPath(path); setSearch(''); setSearchInput(''); setPage(1); setSelected(null) }
  const relative = rootPath && parentPath.startsWith(rootPath) ? parentPath.slice(rootPath.length).replace(/^\//, '') : ''
  const segments = relative.split('/').filter(Boolean)

  return <section aria-label="Server files" className="server-file-browser min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white">
    <div className="sfb-header flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-5"><div className="min-w-0"><h2 className="text-base font-semibold text-slate-900">Server files</h2><p className="mt-1 text-sm text-slate-600">Browse projects, subfolders and files in the synchronized catalogue.</p></div><button type="button" className={buttonStyle} onClick={() => setRefresh(value => value + 1)} disabled={scopeLoading || listing.loading}><ArrowPathIcon className="h-4 w-4" aria-hidden="true" />Refresh</button></div>
    {scopeLoading ? <p role="status" className="p-5 text-sm text-slate-500">Loading connected folders…</p> : scopeError ? <p role="alert" className="p-5 text-sm text-rose-700">{scopeError}</p> : !scopes.length ? <div className="p-8 text-center"><FolderIcon className="mx-auto h-9 w-9 text-slate-400" aria-hidden="true" /><p className="mt-3 text-sm font-medium text-slate-800">No server folders are available yet</p><p className="mt-1 text-sm text-slate-500">{projectId ? 'An administrator must connect, synchronize, and enable a folder for this project.' : 'Run the office connector to discover folders, then refresh the catalogue.'}</p></div> : <>
      <div className="sfb-catalogue-note flex items-start gap-2 border-b border-blue-100 bg-blue-50 px-5 py-3 text-xs text-blue-900"><InformationCircleIcon className="h-4 w-4 shrink-0" aria-hidden="true" /><div><strong>{mode === 'catalogue' ? 'Catalogue mode · metadata only' : mode === 'mirror' ? 'Mirror mode · copied file contents' : 'Synchronized folder catalogue'}</strong><p className="mt-1">{mode === 'catalogue' ? 'Folder names, file types, sizes and dates are available. Preview, download and extraction require a copied file version in Mirror mode.' : 'Open folders to browse deeper. Preview, download and extraction are available for files marked Content available.'}</p>{lastSuccess && <p className="mt-1">Last successful sync: {dateLabel(lastSuccess)}</p>}</div></div>
      {sourceStatus === 'offline' && <p role="status" className="sfb-offline-note border-b border-amber-100 bg-amber-50 px-5 py-3 text-xs text-amber-900">The office connector is offline. Last contact: {dateLabel(lastHeartbeat)}. Cached folders remain browsable; updates resume when the connector reconnects.</p>}
      <div className="sfb-toolbar grid gap-4 p-5 md:grid-cols-2"><label className="block min-w-0 text-xs font-medium text-slate-600">Connected folder<select className={`${fieldStyle} mt-1`} value={scopeId} onChange={event => { setScopeId(event.target.value); navigate(scopes.find(item => String(item.id) === event.target.value)?.relative_path || '') }}>{scopes.map(item => <option key={item.id} value={item.id}>{item.relative_path}</option>)}</select></label>
        <form className="flex min-w-0 items-end gap-2" onSubmit={event => { event.preventDefault(); setSearch(searchInput.trim()); setPage(1) }}><label className="block min-w-0 flex-1 text-xs font-medium text-slate-600">Search this connected folder<input type="search" value={searchInput} onChange={event => setSearchInput(event.target.value)} className={`${fieldStyle} mt-1`} placeholder="Search all indexed subfolders" /></label><button className={buttonStyle} type="submit"><MagnifyingGlassIcon className="h-4 w-4" aria-hidden="true" /><span className="sr-only">Search server files</span></button></form>
      </div>
      <nav aria-label="Server folder breadcrumb" className="sfb-breadcrumb flex flex-wrap items-center gap-2 border-y border-slate-100 bg-slate-50 px-5 py-3 text-xs">
        <button type="button" aria-label="Up one folder" title="Up one folder" className={buttonStyle} disabled={!segments.length} onClick={() => navigate(segments.length > 1 ? `${rootPath}/${segments.slice(0, -1).join('/')}` : rootPath)}><ArrowUpIcon className="h-4 w-4" aria-hidden="true" /></button>
        <button type="button" className="min-w-0 break-all font-medium text-indigo-700 hover:underline" aria-current={!segments.length && !search ? 'location' : undefined} onClick={() => navigate(rootPath)}>{rootPath || 'Folders'}</button>{segments.map((segment, index) => <span key={index} className="inline-flex min-w-0 items-center gap-2"><span aria-hidden="true">/</span><button type="button" className="min-w-0 break-all text-indigo-700 hover:underline" aria-current={index === segments.length - 1 && !search ? 'location' : undefined} onClick={() => navigate(`${rootPath}/${segments.slice(0, index + 1).join('/')}`)}>{segment}</button></span>)}
        {search && <span className="inline-flex min-w-0 flex-wrap items-center gap-2 text-slate-600"><span className="break-all">Search all subfolders: “{search}”</span><button type="button" className="font-medium text-indigo-700 hover:underline" onClick={() => navigate(parentPath)}>Clear search</button></span>}
      </nav>
      {listing.error && <p role="alert" className="p-5 text-sm text-rose-700">{listing.error}</p>}
      <div className="sfb-table-wrap overflow-x-auto" role="region" aria-label="Server folder contents" tabIndex={0}><table className="sfb-table min-w-full text-left text-sm"><caption className="sr-only">Synchronized files and folders</caption><thead className="bg-slate-50 text-xs text-slate-600"><tr><th scope="col" className="px-5 py-3">Name</th><th scope="col" className="px-3 py-3">Type</th><th scope="col" className="px-3 py-3">Content status</th><th scope="col" className="px-3 py-3">Size</th><th scope="col" className="px-3 py-3">Modified</th></tr></thead><tbody className="divide-y divide-slate-100">
        {listing.loading && <tr><td colSpan={5} className="p-6 text-center text-slate-500" role="status">Loading files…</td></tr>}
        {!listing.loading && !listing.error && !listing.items.length && <tr><td colSpan={5} className="p-6 text-center text-slate-600"><p className="mx-auto max-w-2xl">{emptyDescription(scope, search, autoRefreshing)}</p></td></tr>}
        {listing.items.map(entry => <tr key={entry.id} className={selected?.id === entry.id ? 'bg-indigo-50' : 'hover:bg-slate-50'}><td className="max-w-lg px-5 py-3"><button type="button" onClick={() => entry.is_directory ? navigate(entry.relative_path) : setSelected(entry)} className="inline-flex max-w-full items-center gap-2 text-left font-medium text-indigo-700 hover:underline"><EntryIcon entry={entry} /><span className="break-words">{entry.name}</span></button>{search && <p className="mt-1 break-words text-xs text-slate-500">{entry.parent_path}</p>}</td><td className="whitespace-nowrap px-3 py-3 text-xs text-slate-600">{typeLabel(entry)}</td><td className="px-3 py-3"><ReplicaStatus status={entry.status} label={contentLabel(entry)} /></td><td className="whitespace-nowrap px-3 py-3 text-slate-600">{entry.is_directory ? '—' : sizeLabel(entry.size_bytes)}</td><td className="whitespace-nowrap px-3 py-3 text-xs text-slate-600">{dateLabel(entry.modified_at)}</td></tr>)}
      </tbody></table></div>
      <div className="sfb-pagination flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-3"><p className="text-xs text-slate-600" role="status">{listing.count} item(s) · Page {page}</p><div className="flex gap-2"><button type="button" className={buttonStyle} disabled={page === 1 || listing.loading} onClick={() => setPage(value => value - 1)}>Previous</button><button type="button" className={buttonStyle} disabled={!listing.next || listing.loading} onClick={() => setPage(value => value + 1)}>Next</button></div></div>
      {selected && <FileDetails key={`${selected.id}:${selected.current_version}`} entry={selected} mode={mode} onClose={() => setSelected(null)} />}
    </>}
  </section>
}
