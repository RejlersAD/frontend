import { useCallback, useEffect, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { Link } from 'react-router-dom'
import { AlertCircle, ExternalLink, RefreshCw } from 'lucide-react'
import * as service from '../../services/proposalPreparation.service'
import './SalesProposalPreparation.css'

const fields = { scope: 'Scope', deliverables: 'Deliverables', assumptions: 'Assumptions', exclusions: 'Exclusions', disciplines: 'Disciplines', estimated_hours: 'Estimated hours', risks: 'Risks' }
const label = value => String(value || '').replaceAll('_', ' ')
const sourceName = source => `${source.proposal_number || source.title || source.id} · Technical revision ${source.revision ?? 'not recorded'} · ${label(source.status)}`
const workspaceName = source => source.name || source.title || String(source.id)
const unknown = value => value === null || value === undefined || value === ''

function Facts({ value }) {
  if (unknown(value)) return <span className="spp-muted">Not recorded</span>
  if (Array.isArray(value)) return value.length ? <ul>{value.map((item, index) => <li key={index}><Facts value={item} /></li>)}</ul> : <span className="spp-muted">No entries</span>
  if (typeof value === 'object') return <dl className="spp-values">{Object.entries(value).map(([key, item]) => <div key={key}><dt>{label(key)}</dt><dd><Facts value={item} /></dd></div>)}</dl>
  return <span>{typeof value === 'boolean' ? value ? 'Yes' : 'No' : String(value)}</span>
}
Facts.propTypes = { value: PropTypes.any }

function CandidateSelector({ kind, ownerId, value, onChange, disabled, refresh }) {
  const [search, setSearch] = useState(''), [page, setPage] = useState(1)
  const [data, setData] = useState(null), [loading, setLoading] = useState(true), [error, setError] = useState(''), [retry, setRetry] = useState(0)
  const isWorkspace = kind === 'workspace', title = isWorkspace ? 'Planning workspace' : 'Technical proposal revision'
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setError('')
    const timer = setTimeout(() => {
      const request = isWorkspace ? service.listBidWorkspaces : service.listPreparationSources
      request(ownerId, { search: search.trim(), page }, controller.signal).then(result => {
        if (!Array.isArray(result?.results)) throw new Error('Invalid candidates response.')
        if (!controller.signal.aborted) setData(result)
      }).catch(caught => { if (!controller.signal.aborted) { setData(null); setError(service.preparationError(caught, `${title} choices could not be loaded.`)) } }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    }, search ? 250 : 0)
    return () => { clearTimeout(timer); controller.abort() }
  }, [ownerId, isWorkspace, search, page, retry, refresh, title])
  const rows = data?.results || [], name = isWorkspace ? workspaceName : sourceName
  const shown = value && !rows.some(row => String(row.id) === String(value.id)) ? [value, ...rows] : rows
  return <div className="spp-picker" aria-busy={loading}>
    <label>Search {title.toLowerCase()}<input type="search" value={search} disabled={disabled} onChange={event => { setSearch(event.target.value); setPage(1) }} /></label>
    <label>{title}<select value={value?.id || ''} disabled={disabled || loading || !!error} onChange={event => onChange(shown.find(row => String(row.id) === event.target.value) || null)}><option value="">Choose {isWorkspace ? 'a workspace' : 'an exact revision'}</option>{shown.map(row => <option key={row.id} value={row.id}>{name(row)}</option>)}</select></label>
    {loading && <p role="status">Loading choices…</p>}
    {error && <p role="alert" className="spp-error">{error}<button type="button" disabled={disabled} onClick={() => setRetry(value => value + 1)}>Retry choices</button></p>}
    {!loading && !error && !rows.length && <p>No matching {isWorkspace ? 'eligible workspaces' : 'technical revisions'}. {isWorkspace ? 'Create a bid workspace or change the search.' : 'Create a technical revision in the connected Planning workspace, then refresh.'}</p>}
    {data && (page > 1 || data.count > data.page_size) && <div className="spp-actions"><button type="button" disabled={disabled || loading || page <= 1} onClick={() => setPage(value => value - 1)}>Previous choices</button><span>Page {page}</span><button type="button" disabled={disabled || loading || page * data.page_size >= data.count} onClick={() => setPage(value => value + 1)}>Next choices</button></div>}
  </div>
}
CandidateSelector.propTypes = { kind: PropTypes.string.isRequired, ownerId: PropTypes.string.isRequired, value: PropTypes.object, onChange: PropTypes.func.isRequired, disabled: PropTypes.bool, refresh: PropTypes.number }

function SourceIdentity({ source, quoteId }) {
  if (!source) return null
  const projectId = source.planning_project_id, technicalId = source.technical_proposal_id || source.id
  return <div className="spp-source-identity">
    <strong>{source.proposal_number || source.title || 'Technical proposal'} · Technical revision {source.revision ?? 'not recorded'}</strong>
    <p>{label(source.status)} · {source.planning_project_name || `Planning workspace ${projectId || 'not recorded'}`}</p>
    <p>Schedule version {source.schedule_version ?? 'not recorded'} · Generation {source.generation_version ?? source.generation_id ?? 'not recorded'}</p>
    {projectId && technicalId && <Link to={`/proposal-workspace/${encodeURIComponent(projectId)}?proposalId=${encodeURIComponent(technicalId)}&salesProposal=${encodeURIComponent(quoteId)}`}>Open exact technical revision<ExternalLink size={14} /></Link>}
  </div>
}
SourceIdentity.propTypes = { source: PropTypes.object, quoteId: PropTypes.string.isRequired }

export default function SalesProposalPreparation({ quoteId, dealId, onPrepared }) {
  const [data, setData] = useState(null), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false)
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [stale, setStale] = useState(false), [uncertain, setUncertain] = useState(false)
  const [mode, setMode] = useState('create'), [workspace, setWorkspace] = useState(null), [connectionReason, setConnectionReason] = useState('')
  const [duration, setDuration] = useState('')
  const [source, setSource] = useState(null), [preview, setPreview] = useState(null), [previewLoading, setPreviewLoading] = useState(false)
  const [selected, setSelected] = useState([]), [reason, setReason] = useState(''), [refresh, setRefresh] = useState(0)
  const alive = useRef(true), loadRequest = useRef(0), previewRequest = useRef(0), pending = useRef(null), submitting = useRef(false)
  useEffect(() => { const requests = [loadRequest, previewRequest]; alive.current = true; return () => { alive.current = false; requests.forEach(request => { ++request.current }) } }, [])
  const load = useCallback(async signal => {
    const request = ++loadRequest.current
    setLoading(true)
    try {
      const result = await service.getProposalPreparation(quoteId, signal)
      if (String(result?.quote?.id) !== quoteId) throw new Error('Invalid preparation response.')
      if (alive.current && request === loadRequest.current) setData(result)
      return result
    } catch (caught) {
      if (alive.current && request === loadRequest.current && !signal?.aborted) { setData(null); setError(service.preparationError(caught, 'Proposal preparation could not be loaded.')) }
      return null
    } finally { if (alive.current && request === loadRequest.current && !signal?.aborted) setLoading(false) }
  }, [quoteId])
  useEffect(() => { const controller = new AbortController(); load(controller.signal); return () => controller.abort() }, [load])

  const readPreview = async (choice = source) => {
    if (!choice) return null
    const request = ++previewRequest.current
    setPreviewLoading(true); setError('')
    try {
      const result = await service.previewProposalPreparation(quoteId, String(choice.id))
      if (!result?.expected_token || !Array.isArray(result.supported_fields) || String(result.source?.technical_proposal_id ?? result.source?.id) !== String(choice.id)) throw new Error('Invalid preview response.')
      if (alive.current && request === previewRequest.current) { setPreview(result); return result }
    } catch (caught) { if (alive.current && request === previewRequest.current) { setPreview(null); setError(service.preparationError(caught, 'The selected source could not be previewed.')) } }
    finally { if (alive.current && request === previewRequest.current) setPreviewLoading(false) }
    return null
  }
  const refreshSources = async () => {
    if (submitting.current) return
    setError(''); setNotice(''); setPreview(null)
    pending.current = null; setUncertain(false); setStale(false)
    const result = await load()
    if (!alive.current) return
    setRefresh(value => value + 1)
    if (result && source) await readPreview()
  }
  const changeSource = value => {
    ++previewRequest.current
    setSource(value); setPreview(null); setPreviewLoading(false); setSelected([]); setReason(''); setError(''); setNotice(''); setStale(false)
  }
  const execute = async kind => {
    if (submitting.current) return
    const bid = data?.bid_preparation
    const payload = pending.current?.payload || (kind === 'connect'
      ? { request_id: crypto.randomUUID(), expected_token: bid.expected_token, mode, ...(mode === 'attach' ? { planning_project_id: String(workspace.id) } : bid.requires_duration ? { duration_months: duration } : {}), reason: connectionReason.trim() }
      : { request_id: crypto.randomUUID(), expected_token: preview.expected_token, technical_proposal_id: String(source.id), selected_fields: selected, reason: reason.trim() })
    pending.current = { kind, payload }; submitting.current = true
    setBusy(true); setError(''); setNotice('')
    let result
    try {
      result = kind === 'connect' ? await service.connectBidPreparation(dealId, payload) : await service.prepareProposal(quoteId, payload)
      if (kind === 'connect' ? !result?.bid_preparation?.connection : String(result?.preparation?.quote?.id) !== quoteId) throw new Error('The command result could not be verified.')
    } catch (caught) {
      result = null
      if (alive.current) {
        const status = caught?.response?.status, ambiguous = !status || status >= 500
        setUncertain(ambiguous); setStale(status === 409)
        if (!ambiguous) pending.current = null
        setError(service.preparationError(caught, ambiguous ? 'The result could not be confirmed. Retry the same request or refresh before changing it.' : 'The preparation command was not saved. Your choices and reason are retained.'))
      }
    } finally { submitting.current = false; if (alive.current) setBusy(false) }
    if (!result || !alive.current) return
    pending.current = null; setUncertain(false); setStale(false)
    if (kind === 'connect') {
      setConnectionReason(''); setWorkspace(null); setData(current => ({ ...current, bid_preparation: result.bid_preparation, connection: result.bid_preparation.connection }))
      await load(); if (alive.current) { setRefresh(value => value + 1); setNotice(result.replayed ? 'The bid workspace connection was already saved.' : 'Bid workspace connected. Prepare sources in Planning, then choose an exact technical revision here.') }
    } else {
      setData(result.preparation); setPreview(null); setSelected([]); setReason('')
      setNotice(result.replayed ? 'This preparation revision was already saved. No duplicate was created.' : 'Preparation revision saved. The selected proposal fields are updated.')
      try { await onPrepared(quoteId) } catch { if (alive.current) setError('Preparation was saved, but the proposal details could not be refreshed. Refresh the proposal to load its saved fields.') }
    }
  }
  const bid = data?.bid_preparation, connection = data?.connection || bid?.connection, project = connection?.planning_project
  const locked = busy || uncertain || loading || previewLoading
  const supported = (preview?.supported_fields || []).filter(field => Object.hasOwn(fields, field))
  const canConnect = mode === 'create' ? bid?.capabilities?.can_create === true : bid?.capabilities?.can_attach === true
  const canPrepare = data?.capabilities?.can_prepare === true
  const evidence = preview?.evidence || {}
  return <section className="spp-preparation" aria-label="Proposal preparation" aria-busy={loading || busy}>
    <div className="spp-heading"><div><h3>Bid &amp; proposal preparation</h3><p>Review connected source evidence before updating this proposal.</p></div><button type="button" className="spg-button" disabled={busy || loading || previewLoading} onClick={refreshSources}><RefreshCw size={15} />Refresh preparation</button></div>
    {error && <p className="spp-error" role="alert"><AlertCircle size={17} />{error}</p>}
    {notice && <p className="spp-notice" role="status">{notice}</p>}
    {stale && <p className="spp-warning">The proposal or source changed. Refresh preparation to review the current values. Your choices and reason will be retained.</p>}
    {uncertain && <div className="spp-warning"><p>The previous result is uncertain. Your original request is retained while this review remains open.</p><button type="button" className="spg-button" disabled={busy} onClick={() => execute(pending.current.kind)}>Retry same request</button><p>Refresh preparation to inspect saved history before starting a new request.</p></div>}
    {loading && <p role="status">Loading preparation…</p>}
    {!loading && data && <>
      <div className="spp-bid"><strong>{bid?.opportunity?.code || 'Opportunity'} · {bid?.opportunity?.name}</strong><p>Bid decision: <strong>{label(bid?.opportunity?.bid_decision) || 'Not recorded'}</strong> · Stage: {label(bid?.opportunity?.stage) || 'Not recorded'}</p>{dealId && <Link to={`/sales/opportunities?record=${encodeURIComponent(dealId)}&workspace=1&folder=tender`}>Open RFP and opportunity documents<ExternalLink size={14} /></Link>}</div>
      {!connection ? <form aria-label="Connect bid workspace" onSubmit={event => { event.preventDefault(); execute('connect') }}>
        <h4>Connect a Planning workspace</h4><p>Create a workspace from the opportunity facts or explicitly attach an eligible existing workspace.</p>
        <fieldset disabled={locked}><label>Connection mode<select value={mode} onChange={event => setMode(event.target.value)}><option value="create">Create from opportunity</option><option value="attach">Attach existing workspace</option></select></label>
          {mode === 'attach' && <CandidateSelector kind="workspace" ownerId={dealId} value={workspace} onChange={setWorkspace} disabled={locked} refresh={refresh} />}
          {mode === 'create' && bid?.requires_duration && <><label>Draft planning duration (months)<input type="number" min="0.0001" step="0.0001" required value={duration} onChange={event => setDuration(event.target.value)} /></label><p>This is a planning assumption for the bid workspace, not an approved schedule.</p></>}
          <label>Connection reason<textarea maxLength={1000} rows={3} required value={connectionReason} onChange={event => setConnectionReason(event.target.value)} /></label>
        </fieldset>
        {!canConnect && <p className="spp-warning">{bid?.capabilities?.reason || 'You cannot connect a workspace for this opportunity.'}</p>}
        <button type="submit" className="spg-button spg-primary" disabled={locked || stale || !canConnect || !connectionReason.trim() || (mode === 'attach' && !workspace) || (mode === 'create' && bid?.requires_duration && !(Number(duration) > 0))}>{busy ? 'Connecting…' : mode === 'create' ? 'Create bid workspace' : 'Attach bid workspace'}</button>
      </form> : <>
        <div className="spp-connected"><h4>{project?.name || 'Connected Planning workspace'}</h4><div className="spp-links">{project?.id && <><Link to={`/planning-workspace/${encodeURIComponent(project.id)}`}>Open schedule, resources &amp; risks<ExternalLink size={14} /></Link><Link to={`/proposal-workspace/${encodeURIComponent(project.id)}?salesProposal=${encodeURIComponent(quoteId)}`}>Open technical proposal studio<ExternalLink size={14} /></Link></>}</div><p>Source access and technical workflow permissions apply in Planning.</p></div>
        {!canPrepare && <p className="spp-warning">{data.capabilities?.reason || 'Preparation is read-only for this proposal.'}</p>}
        <CandidateSelector kind="source" ownerId={quoteId} value={source} onChange={changeSource} disabled={locked} refresh={refresh} />
        <button type="button" className="spg-button" disabled={locked || !source} onClick={() => readPreview()}>{previewLoading ? 'Loading preview…' : 'Preview selected source'}</button>
        {preview && <div className="spp-preview">
          <SourceIdentity source={preview.source} quoteId={quoteId} />
          {(preview.warnings || []).map((warning, index) => <p className="spp-warning" key={index}>{warning}</p>)}
          <h4>Choose fields to apply</h4><p>Only checked fields replace their current values. Commercial price, cost, currency and approval remain controlled in the existing proposal forms.</p>
          <fieldset disabled={locked || !canPrepare} className="spp-mapping">{Object.entries(fields).map(([key, name]) => <section key={key} aria-label={`${name} comparison`}><label className="spp-field-choice"><input type="checkbox" checked={selected.includes(key)} disabled={!supported.includes(key) || locked || !canPrepare} onChange={event => setSelected(values => event.target.checked ? [...values, key] : values.filter(value => value !== key))} />Apply {name.toLowerCase()}</label><div className="spp-comparison"><div><h5>Current proposal</h5><Facts value={preview.current_fields?.[key]} /></div><div><h5>Proposed source</h5>{supported.includes(key) ? <Facts value={preview.proposed_fields?.[key]} /> : <span className="spp-muted">No supported source value</span>}</div></div></section>)}</fieldset>
          <details className="spp-evidence"><summary>Review source evidence to capture</summary>{evidence.basis && <p>{evidence.basis}</p>}{[['technical', 'Solution design'], ['schedule', 'Schedule basis'], ['generation', 'Generation basis'], ['deliverables', 'Deliverables'], ['effort', 'Recorded effort'], ['frozen_resources', 'Frozen resource requirements'], ['resources', 'Current resource catalog'], ['assignments', 'Current planned allocations'], ['risks', 'Current risk assessment'], ['provenance', 'Source provenance']].map(([key, title]) => <details key={key}><summary>{title}</summary><Facts value={evidence[key]} /></details>)}<p>Planned demand and allocations do not confirm staffing availability or approve estimated hours.</p></details>
          <form aria-label="Apply preparation fields" onSubmit={event => { event.preventDefault(); execute('prepare') }}><label>Preparation review reason<textarea required rows={3} maxLength={1000} disabled={locked || !canPrepare} value={reason} onChange={event => setReason(event.target.value)} /></label><button type="submit" className="spg-button spg-primary" disabled={locked || stale || !canPrepare || !reason.trim() || !selected.length || selected.some(field => !supported.includes(field))}>{busy ? 'Saving preparation…' : 'Apply selected fields & save revision'}</button></form>
        </div>}
      </>}
      <section className="spp-history" aria-label="Preparation history"><h4>Captured preparation revisions</h4>{data.history_count > (data.history?.length || 0) && <p>Showing the latest {data.history.length} of {data.history_count} captured revisions.</p>}{data.history?.length ? data.history.map(entry => <details key={entry.id}><summary>Preparation revision {entry.revision} · {entry.source_state === 'current' ? 'Source unchanged' : entry.source_state === 'changed' ? 'Source changed since capture' : 'Source unavailable'}</summary><SourceIdentity source={entry.source} quoteId={quoteId} /><p>Applied fields: {(entry.selected_fields || []).map(field => fields[field] || label(field)).join(', ') || 'Evidence only'}</p><p>Review reason: {entry.reason}</p><p>Captured: {entry.created_at || 'Not recorded'}{entry.created_by?.name ? ` · ${entry.created_by.name}` : ''}</p></details>) : <p>No preparation revision has been captured.</p>}</section>
    </>}
  </section>
}
SalesProposalPreparation.propTypes = { quoteId: PropTypes.string.isRequired, dealId: PropTypes.string.isRequired, onPrepared: PropTypes.func.isRequired }
