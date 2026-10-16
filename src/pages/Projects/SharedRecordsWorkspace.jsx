import { useEffect, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { ArrowLeft, ChevronLeft, ChevronRight, Link2, RefreshCw } from 'lucide-react'
import { getSharedRecord, linkSharedRecord, listSharedRecords, sharedRecordError } from '../../services/sharedRecords.service'
import SharedRecordTargetSelector from './components/SharedRecordTargetSelector'
import './SharedRecordsWorkspace.css'

const states = { linked: 'Linked', unlinked: 'Unlinked', needs_review: 'Needs review', not_applicable: 'Not applicable' }
const recordKey = row => `${row.source_type}:${row.id}`
const label = value => value === null || value === undefined || value === '' ? 'Not recorded' : String(value)
const targetLabel = target => target ? [target.code, target.label].filter(Boolean).join(' · ') : 'Not linked'

function RecordReview({ sourceType, sourceId, onLinked }) {
  const [record, setRecord] = useState(null), [loading, setLoading] = useState(true), [loadError, setLoadError] = useState('')
  const [revision, setRevision] = useState(0), [reason, setReason] = useState(''), [targets, setTargets] = useState({})
  const [saving, setSaving] = useState(false), [saveError, setSaveError] = useState(''), [stale, setStale] = useState(false), [notice, setNotice] = useState('')
  const [uncertain, setUncertain] = useState(false)
  const initialized = useRef(false), active = useRef(true), mutation = useRef(false), command = useRef(null)
  useEffect(() => { active.current = true; return () => { active.current = false } }, [])
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setLoadError('')
    getSharedRecord(sourceType, sourceId, { signal: controller.signal }).then(result => {
      if (controller.signal.aborted) return
      setRecord(result); setStale(false)
      if (!initialized.current) { setTargets(result.links || {}); initialized.current = true }
    }).catch(error => {
      if (!controller.signal.aborted) setLoadError(sharedRecordError(error, 'The record could not be loaded.'))
    }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [sourceType, sourceId, revision])
  const refresh = () => {
    command.current = null; setUncertain(false); setSaveError(''); setNotice(''); setRevision(current => current + 1)
  }
  const selectedTargets = Object.fromEntries((record?.target_kinds || []).filter(kind => targets[kind]?.id).map(kind => [`${kind}_id`, String(targets[kind].id)]))
  const canSave = record?.can_link === true && !saving && !loading && !loadError && !stale && Boolean(record.expected_token) && Boolean(reason.trim()) && Object.keys(selectedTargets).length > 0
  const save = async event => {
    event.preventDefault()
    if (!canSave || mutation.current) return
    const body = { expected_token: record.expected_token, reason: reason.trim(), targets: selectedTargets }
    const signature = JSON.stringify(body)
    if (command.current?.signature !== signature) command.current = { signature, payload: { request_id: crypto.randomUUID(), ...body } }
    mutation.current = true; setSaving(true); setSaveError(''); setNotice('')
    try {
      const response = await linkSharedRecord(sourceType, sourceId, command.current.payload)
      if (!active.current) return
      setRecord(response.record); setTargets(response.record.links || {}); setReason(''); setStale(false); setUncertain(false); command.current = null
      setNotice(response.replayed ? 'The previously saved links are confirmed.' : 'Shared record links saved.')
      onLinked(response.record)
    } catch (error) {
      if (!active.current) return
      setSaveError(sharedRecordError(error, 'The links could not be confirmed. Retry to check and save this request.'))
      if (error.response?.status === 409) { setStale(true); setUncertain(false) }
      else setUncertain(!error.response || error.response.status >= 500)
    } finally { mutation.current = false; if (active.current) setSaving(false) }
  }
  const readDenied = Boolean(loadError)
  return <section className="sr-review sr-panel" aria-label="Record review" aria-busy={loading}>
    <header><div><h2>Review connection</h2><p>Verify the source and select the matching shared records.</p></div><button type="button" className="sr-button" onClick={refresh} disabled={saving || loading} aria-label="Refresh selected record"><RefreshCw size={15} aria-hidden="true" /></button></header>
    {loading && <p className="sr-feedback" role="status">Loading record…</p>}
    {loadError && <div className="sr-feedback sr-error" role="alert"><p>{loadError}</p><button type="button" className="sr-button" onClick={refresh}>Retry record</button></div>}
    {record && !readDenied && <>
      <div className="sr-record-heading"><strong>{record.reference}</strong><p>{record.label}</p><span className={`sr-badge sr-${record.state}`}>{states[record.state] || 'Review required'}</span></div>
      {record.warning && <p className="sr-feedback sr-warning">{record.warning}</p>}
      <section className="sr-facts"><h3>Source details</h3><dl>{Object.entries(record.source_values || {}).map(([key, value]) => <div key={key}><dt>{key.replaceAll('_', ' ')}</dt><dd>{label(value)}</dd></div>)}</dl></section>
      <section className="sr-facts"><h3>Current connections</h3><dl>{(record.target_kinds || []).map(kind => <div key={kind}><dt>{kind}</dt><dd>{targetLabel(record.links?.[kind])}</dd></div>)}</dl></section>
      {!record.can_link ? <p className="sr-feedback sr-warning" role="status">This connection is read-only.</p> : <form onSubmit={save}>
        {(record.target_kinds || []).map(kind => <SharedRecordTargetSelector key={kind} kind={kind} sourceType={sourceType} sourceId={sourceId} value={targets[kind] || null} disabled={saving || loading || uncertain} onChange={value => { setTargets(current => ({ ...current, [kind]: value })); setNotice('') }} />)}
        <label className="sr-reason">Reason for this connection<textarea value={reason} onChange={event => { setReason(event.target.value); setNotice('') }} disabled={saving || uncertain} rows={3} required maxLength={1000} /></label>
        {saveError && <div className="sr-feedback sr-error" role="alert"><p>{saveError}</p>{stale && <><p>Refresh the record, review the latest details, then save again. Your selections and reason will be kept.</p><button type="button" className="sr-button" onClick={refresh}>Refresh record to review</button></>}{uncertain && <p>The result is uncertain. Retry the same request to confirm it, or refresh the record before making changes.</p>}</div>}
        <button type="submit" className="sr-button sr-primary" disabled={!canSave}><Link2 size={15} aria-hidden="true" />{saving ? 'Saving…' : uncertain ? 'Retry same request' : 'Save connections'}</button>
      </form>}
    </>}
    {notice && <p className="sr-feedback sr-success" role="status">{notice}</p>}
  </section>
}
RecordReview.propTypes = { sourceType: PropTypes.string.isRequired, sourceId: PropTypes.string.isRequired, onLinked: PropTypes.func.isRequired }

export default function SharedRecordsWorkspace({ onBack }) {
  const [data, setData] = useState(null), [loading, setLoading] = useState(true), [error, setError] = useState('')
  const [sourceType, setSourceType] = useState('project_client'), [status, setStatus] = useState('unlinked'), [search, setSearch] = useState(''), [term, setTerm] = useState('')
  const [page, setPage] = useState(1), [revision, setRevision] = useState(0), [selected, setSelected] = useState(null)
  useEffect(() => {
    const timer = window.setTimeout(() => setTerm(search.trim()), 250)
    return () => window.clearTimeout(timer)
  }, [search])
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setError('')
    listSharedRecords({ ...(sourceType ? { source_type: sourceType } : {}), status, search: term, page }, { signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) setData(result) })
      .catch(failure => { if (!controller.signal.aborted) setError(sharedRecordError(failure, 'Shared records could not be loaded.')) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [sourceType, status, term, page, revision])
  const pending = loading || search.trim() !== term
  const records = !pending && !error ? data?.results || [] : []
  const pages = Math.max(1, Math.ceil((data?.count || 0) / (data?.page_size || 25)))
  return <section className="shared-records-workspace" aria-label="Shared records workspace">
    <header className="sr-page-heading"><div><button type="button" className="sr-back" onClick={onBack}><ArrowLeft size={15} aria-hidden="true" />Project Portfolio</button><h1>Shared records</h1><p>Connect client, project and employee references across your work.</p></div><button type="button" className="sr-button" disabled={loading} onClick={() => setRevision(current => current + 1)}><RefreshCw size={15} aria-hidden="true" />Refresh queue</button></header>
    <div className="sr-toolbar"><label>Source<select value={sourceType} onChange={event => { setSourceType(event.target.value); setPage(1) }}>{(data?.sources || [{ key: 'project_client', label: 'Project clients' }]).map(source => <option key={source.key} value={source.key}>{source.label}</option>)}</select></label><label>Connection status<select value={status} onChange={event => { setStatus(event.target.value); setPage(1) }}><option value="unlinked">Unlinked / needs review</option><option value="linked">Linked</option><option value="all">All statuses</option></select></label><label className="sr-search">Search records<input type="search" value={search} onChange={event => { setSearch(event.target.value); setPage(1) }} placeholder="Source name or reference" /></label></div>
    <div className="sr-columns"><section className="sr-register sr-panel" aria-label="Shared record queue">
      {error && <div className="sr-feedback sr-error" role="alert"><p>{error}</p><button type="button" className="sr-button" onClick={() => setRevision(current => current + 1)}>Retry queue</button></div>}
      {pending ? <p className="sr-empty" role="status">Loading shared records…</p> : <div className="sr-table-scroll"><table aria-label="Shared records"><thead><tr><th scope="col">Record</th><th scope="col">Source</th><th scope="col">Status</th><th scope="col">Action</th></tr></thead><tbody>{records.map(record => <tr key={recordKey(record)} className={selected && recordKey(selected) === recordKey(record) ? 'is-selected' : undefined}><td><strong>{record.reference}</strong><span>{record.label}</span></td><td>{data?.sources?.find(source => source.key === record.source_type)?.label || record.source_type.replaceAll('_', ' ')}</td><td><span className={`sr-badge sr-${record.state}`}>{states[record.state] || 'Review required'}</span></td><td><button type="button" className="sr-button" aria-label={`Review ${record.reference}`} onClick={() => setSelected(record)}>Review</button></td></tr>)}</tbody></table>{!records.length && !error && <div className="sr-empty"><h2>No records to review</h2><p>{search || sourceType || status !== 'all' ? 'Try another source, status or search.' : 'No shared records are available in your access scope.'}</p></div>}</div>}
      <footer className="sr-pagination"><span>{error ? 'Records unavailable' : pending ? 'Loading…' : `${data?.count || 0} records`}</span><div><button type="button" className="sr-button" aria-label="Previous records" disabled={page <= 1 || pending} onClick={() => setPage(current => current - 1)}><ChevronLeft size={15} aria-hidden="true" /></button><span>Page {page} of {pages}</span><button type="button" className="sr-button" aria-label="Next records" disabled={page >= pages || pending || Boolean(error)} onClick={() => setPage(current => current + 1)}><ChevronRight size={15} aria-hidden="true" /></button></div></footer>
    </section>{selected ? <RecordReview key={recordKey(selected)} sourceType={selected.source_type} sourceId={String(selected.id)} onLinked={() => setRevision(current => current + 1)} /> : <section className="sr-panel sr-empty" aria-label="Record review"><Link2 size={24} aria-hidden="true" /><h2>Select a record</h2><p>Review its original references and choose the matching shared records.</p></section>}</div>
  </section>
}
SharedRecordsWorkspace.propTypes = { onBack: PropTypes.func.isRequired }
