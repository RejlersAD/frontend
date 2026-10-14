import PlanningExportPanel from './PlanningExportPanel'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { AlertTriangle, CheckCircle2, ExternalLink, FileText, Link2, Loader2, RefreshCw, Search, ShieldCheck, X } from 'lucide-react'
import { planningIntelligenceService as service } from '../../services/planningIntelligence.service'
import { ProvenanceBadge, factProvenance } from './PlanningFieldProvenance'
import PlanningExtractionSummary from './PlanningExtractionSummary'
import PlanningBulkEvidenceReview from './PlanningBulkEvidenceReview'
import useBulkEvidenceReview from '../../hooks/useBulkEvidenceReview'
import './PlanningEvidenceReview.css'

const text = value => value == null || value === '' ? 'Not Specified'
  : Array.isArray(value) && !value.length ? 'Empty list (explicit value)'
  : typeof value === 'object' ? Object.entries(value).map(([key, item]) => `${key.replaceAll('_', ' ')}: ${text(item)}`).join('; ')
    : String(value)
const label = value => String(value || '').replaceAll('_', ' ')
const factValue = fact => {
  if (fact.value == null || fact.value === '') return 'Not Specified'
  if (fact.property === 'duration' && typeof fact.value === 'object' && !Array.isArray(fact.value)) return `${text(fact.value.value)} ${label(fact.value.unit) || 'unit Not Specified'}`
  if (fact.property === 'dependencies' && Array.isArray(fact.value) && !fact.value.length) return 'No predecessors (explicit value)'
  if (fact.property === 'constraints' && Array.isArray(fact.value) && !fact.value.length) return 'No date constraints (explicit value)'
  return `${text(fact.value)}${fact.unit ? ` ${label(fact.unit)}` : ''}`
}
const message = value => typeof value === 'string' ? value : value?.message || value?.detail || value?.title || value?.code || ''
const list = value => Array.isArray(value) ? value : []
const unresolved = issue => !['resolved', 'accepted', 'rejected', 'dismissed', 'superseded'].includes(issue.status)
const blocking = issue => list(issue.blocks).length > 0 || issue.severity === 'blocking' || issue.severity === 'error'
const provenance = value => ({ document_evidence: 'Document evidence', document: 'Document evidence', source_document: 'Document evidence', approved_planning_input: 'Approved planning input', planning_input: 'Planning input', deterministic_derivation: 'Deterministic derivation', derived: 'Deterministic derivation' }[value] || label(value) || 'Provenance not recorded')
const errorMessage = error => {
  const payload = error.response?.data
  if (payload && typeof payload === 'object' && !payload.detail && !payload.error) {
    const fields = Object.entries(payload).filter(([, value]) => typeof value === 'string' || Array.isArray(value))
    if (fields.length) return fields.map(([field, value]) => `${label(field)}: ${Array.isArray(value) ? value.join(' ') : value}`).join(' ')
  }
  const detail = payload?.detail || payload?.error || error.message
  return typeof detail === 'string' ? detail : message(detail) || 'Unable to complete the evidence review request.'
}
const sourceUrl = value => {
  if (typeof value !== 'string' || !value.trim()) return null
  try {
    const url = new URL(value, window.location.origin)
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null
  } catch { return null }
}
const locationLabel = locator => {
  if (!locator) return 'Location not recorded'
  if (typeof locator === 'string') return locator
  return [locator.sheet, locator.page != null && `Page ${locator.page}`, locator.table != null && `Table ${locator.table}`,
    locator.row != null && `Row ${locator.row}`, locator.cell || locator.cell_range,
    locator.line != null && `Line ${locator.line}`, locator.section,
  ].filter(Boolean).join(' · ') || 'Location not recorded'
}

function Citation({ source, canPreview }) {
  const url = canPreview ? sourceUrl(source.preview_url) : null
  return <section className="per-citation" aria-label={`Source: ${source.filename || 'Document'}`}>
    <strong><FileText size={15} />{source.filename || 'Source document'}</strong>
    <span>{locationLabel(source.locator)}{source.document_version != null && ` · Version ${source.document_version}`}</span>
    {source.excerpt ? <blockquote>{source.excerpt}</blockquote> : <p className="per-muted">Verbatim excerpt not available.</p>}
    {url ? <a href={url} target="_blank" rel="noopener noreferrer">Open source<ExternalLink size={13} /></a>
      : <small>File preview unavailable; review the source location above.</small>}
    {(source.sha256 || source.file_id != null) && <details><summary>Source identity</summary><dl>
      {source.file_id != null && <div><dt>File ID</dt><dd>{source.file_id}</dd></div>}
      {source.sha256 && <div><dt>Document hash</dt><dd>{source.sha256}</dd></div>}
    </dl></details>}
  </section>
}
Citation.propTypes = { source: PropTypes.object.isRequired, canPreview: PropTypes.bool }

function Readiness({ title, assessment, baseline = false }) {
  const known = assessment && typeof (baseline ? assessment.eligible ?? assessment.ready : assessment.ready) === 'boolean'
  const ready = known && (baseline ? assessment.eligible ?? assessment.ready : assessment.ready)
  const reasons = list(assessment?.reasons)
  return <section className={`per-readiness ${ready ? 'is-ready' : known ? 'needs-review' : ''}`} aria-label={`${title} readiness`}>
    {ready ? <CheckCircle2 size={18} /> : known ? <AlertTriangle size={18} /> : <ShieldCheck size={18} />}
    <div><h4>{title}</h4><strong>{ready ? (baseline ? 'Eligible for approval review' : 'Ready to calculate') : known ? (baseline ? 'Not eligible for baseline' : 'Not ready to calculate') : 'Not assessed'}</strong>
      {reasons.length > 0 && <details><summary>{reasons.length} {reasons.length === 1 ? 'reason' : 'reasons'}</summary><ul>{reasons.slice(0, 10).map((reason, index) => <li key={reason.code || index}>{message(reason)}</li>)}</ul>{reasons.length > 10 && <p>{reasons.length - 10} more reasons. Use the paginated review queue to inspect all issues.</p>}</details>}
    </div>
  </section>
}
Readiness.propTypes = { title: PropTypes.string.isRequired, assessment: PropTypes.object, baseline: PropTypes.bool }

function schemaType(schema) {
  return Array.isArray(schema?.type) ? schema.type.find(type => type !== 'null') : schema?.type
}
function supportedSchema(schema, property) {
  if (!schema) return false
  if (['dependencies', 'constraints'].includes(property)) return schema.type === 'array' && supportedSchema(schema.items)
  if (property === 'calendar') return schema.type === 'object' && schema.properties?.working_weekdays?.type === 'array'
    && supportedSchema(schema.properties.exceptions?.items)
  const type = schemaType(schema)
  if (['string', 'number', 'integer', 'boolean'].includes(type)) return true
  return type === 'object' && Object.keys(schema.properties || {}).length > 0
    && Object.values(schema.properties).every(property => ['string', 'number', 'integer', 'boolean'].includes(schemaType(property)))
}
function initialValue(schema, value, property) {
  if (['dependencies', 'constraints'].includes(property)) return { rows: list(value).map(item => initialValue(schema.items, item)), confirmed_empty: false }
  if (property === 'calendar') return {
    working_weekdays: list(value?.working_weekdays), hours_per_day: value?.hours_per_day == null ? '' : String(value.hours_per_day),
    timezone: value?.timezone || '', exceptions: list(value?.exceptions).map(item => initialValue(schema.properties.exceptions.items, item)),
    confirmed_no_exceptions: false,
  }
  if (schemaType(schema) === 'object') return Object.fromEntries(Object.entries(schema.properties || {}).map(([key, property]) => [key, initialValue(property, value?.[key])]))
  return value == null ? '' : String(value)
}
function parseValue(schema, value, property) {
  if (['dependencies', 'constraints'].includes(property)) {
    if (!value.rows.length && !value.confirmed_empty) throw new Error(property === 'constraints' ? 'Add date constraints or explicitly confirm there are no date constraints.' : 'Add predecessor relationships or explicitly confirm this activity has no predecessors.')
    return value.rows.map(item => parseValue(schema.items, item))
  }
  if (property === 'calendar') {
    if (!value.working_weekdays.length) throw new Error('Select the approved working weekdays.')
    if (!value.exceptions.length && !value.confirmed_no_exceptions) throw new Error('Add calendar exceptions or explicitly confirm there are no exceptions.')
    if (Number(value.hours_per_day) <= 0) throw new Error('Specify positive working hours per day.')
    return { working_weekdays: value.working_weekdays, hours_per_day: parseValue(schema.properties.hours_per_day, value.hours_per_day),
      timezone: parseValue(schema.properties.timezone, value.timezone), exceptions: value.exceptions.map(item => {
        const parsed = parseValue(schema.properties.exceptions.items, item)
        if (parsed.is_working && (parsed.working_hours == null || parsed.working_hours <= 0)) throw new Error('Specify working hours for each working calendar exception.')
        return parsed
      }) }
  }
  const type = schemaType(schema)
  if (type === 'object') {
    const result = {}
    for (const [key, property] of Object.entries(schema.properties || {})) {
      if (list(schema.required).includes(key) && (value?.[key] === '' || value?.[key] == null)) throw new Error(`Enter ${label(key)}.`)
      if (value?.[key] !== '' && value?.[key] != null) result[key] = parseValue(property, value[key])
    }
    return result
  }
  if (value === '' || value == null) throw new Error('Enter the reviewed value.')
  if (type === 'boolean') return value === 'true'
  if (type === 'number' || type === 'integer') {
    const number = Number(value)
    if (!Number.isFinite(number) || type === 'integer' && !Number.isInteger(number)) throw new Error('Enter a valid number.')
    return number
  }
  return value
}

function ValueField({ schema, value, onChange, name, required = true, property }) {
  if (['dependencies', 'constraints'].includes(property)) {
    const constraint = property === 'constraints'
    const itemLabel = constraint ? 'date constraint' : 'predecessor'
    return <fieldset className="per-structured"><legend>{constraint ? 'Date constraints' : 'Predecessor relationships'}</legend><p>{constraint ? 'Record each source or approved date constraint. Dates are preserved as entered.' : 'Use exact evidence entity IDs. Relationship type, lag and unit must be specified for each link.'}</p>
      {value.rows.map((row, index) => <fieldset key={index} className="per-structured-row"><legend>{constraint ? 'Date constraint' : 'Predecessor'} {index + 1}</legend><ValueField schema={schema.items} value={row} name={`${itemLabel} ${index + 1}`} onChange={next => onChange({ ...value, rows: value.rows.map((item, position) => position === index ? next : item) })} /><button type="button" onClick={() => onChange({ ...value, rows: value.rows.filter((_, position) => position !== index), confirmed_empty: false })}>Remove {itemLabel} {index + 1}</button></fieldset>)}
      <button type="button" onClick={() => onChange({ ...value, rows: [...value.rows, initialValue(schema.items, null)], confirmed_empty: false })}>Add {itemLabel}</button>
      {!value.rows.length && <label className="per-check"><input type="checkbox" checked={value.confirmed_empty} onChange={event => onChange({ ...value, confirmed_empty: event.target.checked })} />{constraint ? 'Confirm no date constraints' : 'I confirm this activity has no predecessors.'}</label>}
    </fieldset>
  }
  if (property === 'calendar') return <fieldset className="per-structured"><legend>Approved working calendar</legend><fieldset className="per-weekdays"><legend>Working weekdays</legend>{['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day, index) => <label key={day} className="per-check"><input type="checkbox" checked={value.working_weekdays.includes(index)} onChange={event => onChange({ ...value, working_weekdays: event.target.checked ? [...value.working_weekdays, index].sort() : value.working_weekdays.filter(item => item !== index) })} />{day}</label>)}</fieldset>
    <div className="per-value-fields"><ValueField schema={schema.properties.hours_per_day} name="Working hours per day" value={value.hours_per_day} onChange={next => onChange({ ...value, hours_per_day: next })} /><ValueField schema={schema.properties.timezone} name="Calendar timezone (IANA)" value={value.timezone} onChange={next => onChange({ ...value, timezone: next })} /></div>
    {value.exceptions.map((exception, index) => <fieldset className="per-structured-row" key={index}><legend>Calendar exception {index + 1}</legend><ValueField schema={schema.properties.exceptions.items} name={`Calendar exception ${index + 1}`} value={exception} onChange={next => onChange({ ...value, exceptions: value.exceptions.map((item, position) => position === index ? next : item) })} /><button type="button" onClick={() => onChange({ ...value, exceptions: value.exceptions.filter((_, position) => position !== index), confirmed_no_exceptions: false })}>Remove exception {index + 1}</button></fieldset>)}
    <button type="button" onClick={() => onChange({ ...value, exceptions: [...value.exceptions, initialValue(schema.properties.exceptions.items, null)], confirmed_no_exceptions: false })}>Add calendar exception</button>
    {!value.exceptions.length && <label className="per-check"><input type="checkbox" checked={value.confirmed_no_exceptions} onChange={event => onChange({ ...value, confirmed_no_exceptions: event.target.checked })} />I confirm this calendar has no exceptions.</label>}
  </fieldset>
  const type = schemaType(schema)
  if (type === 'object') return <div className="per-value-fields">{Object.entries(schema.properties || {}).map(([key, property]) => <ValueField key={key} schema={property} value={value?.[key] ?? ''} name={property.title || label(key)} required={list(schema.required).includes(key)} onChange={next => onChange({ ...value, [key]: next })} />)}</div>
  const options = schema.enum || (type === 'boolean' ? [true, false] : null)
  return <label>{name}{!required && <small> Optional</small>}
    {options ? <select aria-label={name} required={required} value={value} onChange={event => onChange(event.target.value)}><option value="">Select a value</option>{options.map(option => <option key={String(option)} value={String(option)}>{String(option)}</option>)}</select>
      : <input aria-label={name} type={schema.format === 'date' ? 'date' : ['number', 'integer'].includes(type) ? 'number' : 'text'} step={type === 'integer' ? 1 : 'any'} min={schema.minimum} max={schema.maximum} minLength={schema.minLength} maxLength={schema.maxLength} required={required} value={value} onChange={event => onChange(event.target.value)} />}
    {schema.description && <small>{schema.description}</small>}
  </label>
}
ValueField.propTypes = { schema: PropTypes.object.isRequired, value: PropTypes.any, onChange: PropTypes.func.isRequired, name: PropTypes.string.isRequired, required: PropTypes.bool, property: PropTypes.string }

function EvidenceReview({ projectId, readOnly = false, focusFactId, scheduleVersionId, onScheduleCreated }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [stale, setStale] = useState(false)
  const [offset, setOffset] = useState(0)
  const [reload, setReload] = useState(0)
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState('')
  const [selectedIssueId, setSelectedIssueId] = useState(null)
  const [selectedFactId, setSelectedFactId] = useState(null)
  const [action, setAction] = useState('')
  const [value, setValue] = useState('')
  const [reason, setReason] = useState('')
  const [target, setTarget] = useState('')
  const [showExports, setShowExports] = useState(false)
  const [createdSchedule, setCreatedSchedule] = useState(null)
  const requestNumber = useRef(0)
  const formRef = useRef(null)
  const detailRef = useRef(null)
  const focusPreparedReview = useRef(false)

  useEffect(() => {
    const controller = new AbortController()
    const request = ++requestNumber.current
    setLoading(true); setError(''); setAction('')
    if (!projectId) { setLoading(false); setData(null); return () => controller.abort() }
    service.getEvidenceReview(projectId, { offset, limit: 100, ...(group ? { group } : {}), ...(focusFactId && !group ? { fact_id: focusFactId } : {}) }, controller.signal)
      .then(result => { if (!controller.signal.aborted && request === requestNumber.current) { setData(result); setStale(Boolean(result.graph_id && result.readiness?.stale)) } })
      .catch(caught => { if (!controller.signal.aborted && request === requestNumber.current) { setError(errorMessage(caught)); setData(null) } })
      .finally(() => { if (!controller.signal.aborted && request === requestNumber.current) setLoading(false) })
    return () => controller.abort()
  }, [projectId, offset, reload, focusFactId, group])

  const bulk = useBulkEvidenceReview({ projectId, data,
    onComplete: () => { setAction(''); setReload(current => current + 1) },
    onConflict: caught => handleError(caught),
  })
  const activeBulkJob = data?.bulk_review?.active_job
  const bulkRunning = bulk.running || activeBulkJob?.job_type === 'evidence_bulk'
    && String(activeBulkJob.project) === String(projectId) && ['queued', 'running'].includes(activeBulkJob.status)
  const reviewParams = { offset, limit: 100, ...(group ? { group } : {}), ...(focusFactId && !group ? { fact_id: focusFactId } : {}) }
  const showGroup = key => { setGroup(key); setOffset(0); setFilter('all'); setQuery(''); setSelectedIssueId(null); setAction('') }

  const facts = useMemo(() => list(data?.facts), [data])
  const factMap = useMemo(() => new Map(facts.map(fact => [String(fact.id), fact])), [facts])
  const issues = list(data?.issues)
  const visibleIssues = issues.filter(issue => {
    if (filter === 'blocking' && !blocking(issue)) return false
    if (filter === 'missing' && !String(issue.kind).includes('missing')) return false
    if (filter === 'conflicts' && !String(issue.kind).includes('conflict')) return false
    if (filter === 'unreviewed' && !['unreviewed', 'review_required', 'unreviewed_fact'].includes(issue.kind)) return false
    if (filter !== 'all' && !unresolved(issue)) return false
    const searchable = [issue.title, issue.message, issue.field, ...list(issue.affected_entities).map(entity => typeof entity === 'object' ? entity.name || entity.id : entity)].join(' ')
    return searchable.toLowerCase().includes(query.trim().toLowerCase())
  })
  const issue = visibleIssues.find(item => String(item.id) === String(selectedIssueId))
    || (focusFactId && visibleIssues.find(item => list(item.candidate_fact_ids).some(id => String(id) === String(focusFactId)))) || visibleIssues[0]
  const candidates = list(issue?.candidate_fact_ids).map(id => factMap.get(String(id))).filter(Boolean)
  const selectedFact = candidates.find(fact => String(fact.id) === String(selectedFactId)) || (candidates.length === 1 ? candidates[0] : null)
  const schema = selectedFact?.input_schema || issue?.input_schema
  const property = selectedFact?.property || issue?.field
  const permissions = data?.permissions || {}
  const capabilities = data?.capabilities || {}
  const editable = !readOnly && !loading && !busy && !bulkRunning && !stale && Number.isInteger(data?.revision)
  const allowed = name => (name !== 'link' || selectedFact?.property === 'identity')
    && (!issue?.allowed_actions || issue.allowed_actions.includes(name))
    && (!selectedFact?.allowed_actions || selectedFact.allowed_actions.includes(name))
  const canReview = editable && permissions.can_review === true
  const canContinueExtraction = !readOnly && !loading && !busy && !bulkRunning && permissions.can_review === true && Boolean(data?.extraction?.run_id && data.extraction.resume_available)
  const canCorrect = editable && permissions.can_supply_inputs === true && capabilities.correct === true && supportedSchema(schema, property)
  const canLink = editable && permissions.can_link === true && capabilities.link === true
  const decisionHelp = readOnly ? 'This saved schedule is read only. Open the current working plan to record decisions.'
    : permissions.can_review !== true ? 'Your account can view this evidence but cannot record review decisions.'
      : stale ? 'Refresh evidence before accepting a value because the source inputs have changed.'
        : bulkRunning ? 'Bulk review is running. You can inspect evidence while review decisions are being recorded.'
        : !unresolved(issue || {}) ? 'This issue has a recorded decision. Select another open issue to continue.'
          : !candidates.length || candidates.every(fact => fact.value == null) ? 'No extracted value is available to accept. Use Correct / supply value to provide the missing planning input when available.'
            : candidates.length > 1 && !selectedFact ? 'Select one of the source values below to enable Accept value.'
              : selectedFact?.validation?.error ? `This value needs correction: ${selectedFact.validation.error}`
                : !allowed('accept') ? 'This issue requires the action shown below before a value can be accepted.'
                  : 'Check the selected value and its source, then select Accept value and record your reason.'
  const pagination = data?.pagination || { offset: 0, total: issues.length, limit: issues.length, has_more: false }
  const pageOffset = Number(pagination.offset) || 0
  const total = Number(pagination.total_filtered ?? pagination.total) || 0
  const selectedIssueKey = issue?.id
  useEffect(() => { setSelectedFactId(null); setAction(''); setReason(''); setTarget('') }, [selectedIssueKey])
  useEffect(() => { if (action) formRef.current?.querySelector('input, select, textarea')?.focus() }, [action])
  const focusReview = () => {
    detailRef.current?.focus({ preventScroll: true })
    detailRef.current?.scrollIntoView({ block: 'nearest' })
  }
  useEffect(() => {
    if (focusPreparedReview.current && data?.graph_id && !loading) {
      focusPreparedReview.current = false
      detailRef.current?.focus({ preventScroll: true })
      detailRef.current?.scrollIntoView({ block: 'nearest' })
    }
  }, [data, loading])

  const openAction = next => {
    setAction(next); setReason(''); setTarget(''); setError(''); setNotice('')
    if (next === 'correct') setValue(initialValue(schema, selectedFact?.value, property))
  }
  const acceptResponse = result => {
    setData(result); setStale(Boolean(result.graph_id && result.readiness?.stale)); setAction(''); setReason(''); setTarget(''); setSelectedFactId(null)
    const responseOffset = Number(result.pagination?.offset) || 0
    if (responseOffset !== offset) setOffset(responseOffset)
  }
  const handleError = caught => {
    const code = caught.response?.data?.code
    if (code === 'evidence_sources_changed') { setStale(true); setError('Sources or planning inputs changed. Select Refresh evidence before reviewing another value.') }
    else if (caught.response?.status === 409 && (!code || code === 'evidence_revision_conflict')) { setStale(true); setError('Evidence changed in another session. Reload review before making another decision.') }
    else setError(errorMessage(caught))
  }
  const refresh = async () => {
    if (bulkRunning) return
    focusPreparedReview.current = !data?.graph_id
    setBusy(true); setError(''); setNotice(''); ++requestNumber.current
    try {
      acceptResponse(await service.refreshEvidenceReview(projectId, { ...(Number.isInteger(data?.revision) ? { revision: data.revision } : {}) }, reviewParams))
      setNotice('Evidence refreshed. Review the findings before calculation or approval.')
    } catch (caught) { handleError(caught) } finally { setBusy(false) }
  }
  const decide = async event => {
    event.preventDefault()
    if (!editable || !action || !reason.trim()) return
    const payload = { revision: data.revision, action, reason: reason.trim(), ...(issue?.id ? { issue_id: issue.id } : {}), ...(selectedFact?.id ? { fact_id: selectedFact.id } : {}) }
    try {
      if (action === 'correct') payload.value = parseValue(schema, value, property)
      if (action === 'link') {
        if (!target.trim()) throw new Error('Choose or enter the fact to link.')
        payload.target_fact_id = target.trim()
      }
      setBusy(true); setError(''); setNotice('')
      acceptResponse(await service.decideEvidenceReview(projectId, payload, reviewParams))
      setNotice('Review decision saved. Schedule values and project dates have not been changed.')
    } catch (caught) { handleError(caught) } finally { setBusy(false) }
  }
  const createSchedule = async () => {
    if (!canReview || data.readiness?.calculation?.ready !== true || !Number.isInteger(data.master_revision)) return
    setBusy(true); setError(''); setNotice('')
    try {
      const result = await service.materializeAcceptedEvidence(projectId, data.revision, true, data.master_revision)
      if (!result.schedule_version_id) throw new Error(result.message || 'The server did not return a schedule version.')
      setCreatedSchedule(result)
      setNotice(result.message || `${result.created ? 'A new schedule draft was created' : 'The schedule for these accepted inputs is available'}. Calculation and approval are separate actions.`)
      if (onScheduleCreated) onScheduleCreated(result)
      else acceptResponse(await service.getEvidenceReview(projectId, reviewParams))
    } catch (caught) { handleError(caught) } finally { setBusy(false) }
  }
  const continueExtraction = async () => {
    if (!canContinueExtraction) return
    setBusy(true); setError(''); setNotice('')
    try {
      await service.resumeIntelligenceRun(data.extraction.run_id)
      acceptResponse(await service.getEvidenceReview(projectId, reviewParams))
      setNotice('Extraction pass completed. Refresh evidence to review the latest findings.')
    } catch (caught) { handleError(caught) } finally { setBusy(false) }
  }

  return <section className="planning-evidence-review" aria-label="Document evidence review" aria-busy={loading || busy}>
    <header className="per-heading"><div><h3>Evidence review</h3><p>Resolve missing information and conflicting source values before calculating or approving the plan.</p></div>
      <div className="per-heading-actions">
        {data?.graph_id && issue && permissions.can_review && !readOnly && <button type="button" className="per-primary" disabled={busy || loading} onClick={focusReview}><CheckCircle2 size={15} />Review &amp; accept</button>}
        <button type="button" className={!data?.graph_id ? 'per-primary' : undefined} disabled={readOnly || busy || bulkRunning || loading || !projectId || data?.permissions?.can_review === false} onClick={refresh}>{busy ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}{data && !data.graph_id ? 'Prepare review' : 'Refresh evidence'}</button>
      </div>
    </header>
    {error && <div className="per-message is-error" role="alert"><AlertTriangle size={17} /><span>{error}</span><button type="button" disabled={busy || loading} onClick={() => { setAction(''); setReload(current => current + 1) }}>Reload review</button></div>}
    {notice && <p className="per-message" role="status"><CheckCircle2 size={17} />{notice}</p>}
    {loading ? <p className="per-loading" role="status"><Loader2 size={18} className="animate-spin" />Loading evidence review…</p>
      : !projectId ? <p className="per-empty">Link a planning project to review its source evidence.</p>
        : data && <>
          <PlanningBulkEvidenceReview summary={data.bulk_review} review={data} operation={bulk} group={group} onGroup={showGroup}
            onReload={() => { bulk.clearError(); setAction(''); setReload(current => current + 1) }}
            disabledReason={readOnly ? 'Open the current working plan to run bulk evidence review.' : permissions.can_review !== true ? 'Planning update permission is required for bulk acceptance.' : !data.graph_id ? 'Prepare review first to load source candidates.' : stale ? 'Refresh evidence before bulk acceptance because the source inputs changed.' : busy || loading ? 'Wait for the current review request to finish.' : !Number.isInteger(data.revision) ? 'Reload review to obtain its current revision.' : ''} />
          {readOnly && <p className="per-message"><ShieldCheck size={17} />Read only. Evidence below belongs to the current project review; it does not change this saved schedule.</p>}
          {data.graph_id && data.readiness?.stale && <p className="per-message is-warning"><AlertTriangle size={17} />Sources or planning inputs changed. Refresh evidence before making decisions.</p>}
          {list(data.warnings).map((warning, index) => <p className="per-message is-warning" key={warning.code || index}><AlertTriangle size={17} />{message(warning)}</p>)}
          <PlanningExtractionSummary summary={data.extraction || data.extraction_summary} />
          {data.extraction?.resume_available && permissions.can_review && <div className="per-materialize"><button type="button" disabled={!canContinueExtraction} onClick={continueExtraction}>{busy && <Loader2 size={15} className="animate-spin" />}Continue extraction</button><span>Processes the next document portion. Review remains required.</span></div>}
          <div className="per-readiness-grid"><Readiness title="Calculation" assessment={data.readiness?.calculation} /><Readiness title="Baseline" assessment={data.readiness?.baseline} baseline /></div>
          {permissions.can_review && <div className="per-materialize"><button type="button" className="per-primary" disabled={!canReview || data.readiness?.calculation?.ready !== true || !Number.isInteger(data.master_revision)} onClick={createSchedule}>Create schedule from accepted inputs</button><span>{!Number.isInteger(data.master_revision) ? 'Refresh evidence to load the current Master Schedule revision.' : data.readiness?.calculation?.ready === true ? 'Opens an active draft here in Master Schedule. Calculation and approval remain separate.' : 'Resolve calculation readiness issues first.'}</span></div>}
          {createdSchedule?.schedule_version_id && <p className="per-message">Master Schedule version {createdSchedule.schedule_version_id} is available for calculation and review.</p>}
          {list(data.category_summary).length > 0 && <details className="per-audit"><summary>Extracted document content</summary><ul>{data.category_summary.map(item => <li key={item.category}><strong>{item.label || label(item.category)}</strong>: {item.count}</li>)}</ul></details>}
          {!data.graph_id && <div className="per-prepare-notice"><FileText size={20} aria-hidden="true" /><div><strong>Prepare the review to see acceptance controls</strong><p>{readOnly ? 'Open the current working plan to prepare and review its evidence.' : permissions.can_review ? 'Select Prepare review above to load the review queue from your uploaded documents. Select a source value in the queue to review and accept it.' : 'A project member with planning update permission must prepare this review.'}</p><small>Preparing the queue does not accept evidence or change schedule dates.</small></div></div>}
          {data.graph_id && <>
            <div className="per-workspace">
              <aside className="per-queue" aria-label="Evidence review queue">
                <div className="per-queue-controls"><h4>Review queue <span>{total}</span></h4><label className="per-search"><Search size={14} /><input value={query} onChange={event => setQuery(event.target.value)} aria-label="Search this evidence page" placeholder="Search this page" /></label>
                  <select aria-label="Evidence issue filter" value={filter} onChange={event => setFilter(event.target.value)}><option value="all">All issues</option><option value="blocking">Blocking</option><option value="missing">Missing information</option><option value="conflicts">Conflicts</option><option value="unreviewed">Unreviewed evidence</option></select>
                </div>
                <div className="per-queue-items">{visibleIssues.map(item => <button type="button" key={item.id} aria-pressed={issue?.id === item.id} disabled={busy} onClick={() => { setSelectedIssueId(item.id); setNotice('') }}>
                  {unresolved(item) ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}<span><strong>{item.title || label(item.kind)}</strong><small>{label(item.kind)} · {label(item.status || 'open')}</small>{blocking(item) && unresolved(item) && <em>Blocks {list(item.blocks).join(' and ') || 'readiness'}</em>}</span>
                </button>)}{!visibleIssues.length && <p className="per-empty">{issues.length ? 'No matching issues on this page.' : 'No issues returned. Check the readiness assessment above.'}</p>}</div>
                <nav className="per-pagination" aria-label="Evidence queue pages"><span>{total ? `${pageOffset + 1}–${Math.min(pageOffset + issues.length, total)} of ${total}` : '0 issues'}</span><button type="button" disabled={busy || pageOffset <= 0} onClick={() => { setOffset(Math.max(0, pageOffset - (Number(pagination.limit) || 100))); setSelectedIssueId(null) }}>Previous</button><button type="button" disabled={busy || !pagination.has_more} onClick={() => { setOffset(pagination.next_offset ?? pageOffset + (Number(pagination.limit) || 100)); setSelectedIssueId(null) }}>Next</button></nav>
              </aside>
              <section ref={detailRef} className="per-detail" tabIndex={-1} aria-label="Selected evidence issue">
                {issue ? <>
                  <header><span className="per-eyebrow">{label(issue.kind)} · {label(issue.status || 'open')}</span><h4>{issue.title || 'Review source evidence'}</h4><p>{issue.message}</p>{issue.required_decision && <p className="per-required">{message(issue.required_decision) || label(issue.required_decision)}</p>}</header>
                  {list(issue.affected_entities).length > 0 && <p className="per-affected">Applies to: {issue.affected_entities.map(entity => typeof entity === 'object' ? entity.name || entity.id : entity).join(', ')}</p>}
                  <div className="per-decision-bar">
                    {selectedFact && <p className="per-selected-value"><strong>Selected value</strong><span title={factValue(selectedFact)}>{label(selectedFact.property)}: {factValue(selectedFact)}</span></p>}
                    <p className="per-decision-help">{decisionHelp}</p>
                  {unresolved(issue) && !readOnly && <div className="per-actions" aria-label="Evidence decision actions">
                    {permissions.can_review && allowed('accept') && <button type="button" disabled={!canReview || !selectedFact || selectedFact.value == null || Boolean(selectedFact.validation?.error)} onClick={() => openAction('accept')}><CheckCircle2 size={15} />Accept value</button>}
                    {permissions.can_review && allowed('reject') && <button type="button" disabled={!canReview || !selectedFact} onClick={() => openAction('reject')}><X size={15} />Reject value</button>}
                    {permissions.can_supply_inputs && capabilities.correct && allowed('correct') && <button type="button" disabled={!canCorrect || candidates.length > 1 && !selectedFact} onClick={() => openAction('correct')}>Correct / supply value</button>}
                    {permissions.can_link && capabilities.link && allowed('link') && <button type="button" disabled={!canLink || !selectedFact} onClick={() => openAction('link')}><Link2 size={15} />Link fact</button>}
                  </div>}
                  {candidates.length > 1 && !selectedFact && <p className="per-muted">Select a source value to review. No candidate is accepted automatically.</p>}
                  {!readOnly && allowed('correct') && capabilities.correct && schema && !supportedSchema(schema, property) && <p className="per-muted">This structured value needs advanced inputs. Its editor is not yet available in this review view; no value will be guessed.</p>}
                  {action && !stale && <form ref={formRef} className="per-decision-form" onSubmit={decide} aria-label="Record evidence decision"><h5>{({ accept: 'Accept selected value', reject: 'Reject selected value', correct: 'Correct or supply a planning value', link: 'Link selected fact' })[action]}</h5>
                    {action === 'correct' && <><p>A supplied value is recorded as planning input. The original source remains unchanged.</p><ValueField schema={schema} property={property} value={value} onChange={setValue} name={schema.title || 'Reviewed value'} /></>}
                    {action === 'link' && <><p>Select the exact identity fact ID for the same entity in another source. This records a reviewed identity link; it does not merge activities or add a dependency.</p><label>Target fact ID<input aria-label="Target fact ID" list="per-target-facts" required value={target} onChange={event => setTarget(event.target.value)} /><datalist id="per-target-facts">{facts.filter(fact => fact.property === 'identity' && fact.entity_id !== selectedFact?.entity_id).map(fact => <option key={fact.id} value={fact.id}>{fact.entity_name} · {text(fact.value)}</option>)}</datalist></label><small>Enter an exact fact ID for evidence on another page.</small></>}
                    <label>Reason<textarea aria-label="Decision reason" required maxLength={4000} value={reason} onChange={event => setReason(event.target.value)} placeholder="Explain the evidence and your decision" /></label><div><button type="submit" className="per-primary" disabled={!editable || !reason.trim()}>{busy && <Loader2 size={14} className="animate-spin" />}Save decision</button><button type="button" disabled={busy} onClick={() => setAction('')}>Cancel</button></div>
                  </form>}
                  </div>
                  <div className="per-candidates">{candidates.map(fact => <article className={`per-fact ${selectedFact?.id === fact.id ? 'is-selected' : ''}`} key={fact.id} aria-label={`Evidence value ${text(fact.value)}`}>
                    <header><span className="per-provenance">{provenance(fact.provenance_type)}</span><ProvenanceBadge provenance={factProvenance(fact)} /></header>
                    {fact.category && <small className="per-muted">Category: {label(fact.category)}</small>}
                    <h5>{fact.entity_name || issue.field || label(fact.property)}</h5><span className="per-property">{label(fact.property)}</span><p className="per-value">{factValue(fact)}</p>
                    {candidates.length > 1 && <button type="button" className="per-select-fact" aria-pressed={selectedFact?.id === fact.id} disabled={busy} onClick={() => { setSelectedFactId(fact.id); setAction('') }}>Select this value</button>}
                    {list(fact.sources).map((source, index) => <Citation key={`${source.file_id || index}-${index}`} source={source} canPreview={capabilities.source_preview === true} />)}
                    {!list(fact.sources).length && <p className="per-muted">{fact.provenance_type === 'approved_planning_input' ? 'Entered and reviewed as planning input.' : 'Source evidence not available.'}</p>}
                    <details className="per-technical"><summary>Fact details</summary><dl><div><dt>Fact ID</dt><dd>{fact.id}</dd></div><div><dt>Entity ID</dt><dd>{text(fact.entity_id)}</dd></div>{fact.confidence != null && <div><dt>Extraction confidence (reported)</dt><dd>{text(fact.confidence)}</dd></div>}</dl></details>
                    {fact.validation?.error && <p className="per-muted">Validation: {fact.validation.error}</p>}
                  </article>)}</div>
                  {!candidates.length && <p className="per-empty">Not Specified. No candidate fact was provided for this issue.</p>}

                </> : <p className="per-empty">Select a review issue to inspect its values and source evidence.</p>}
              </section>
            </div>
            <p className="per-footnote">Decisions update accepted project knowledge. Calculation and baseline approval remain separate actions.</p>
            <details className="per-audit"><summary>Review history and identity</summary><p>Graph {data.graph_id} · Revision {data.revision}</p>{list(data.decisions).length ? <ol>{data.decisions.map((decision, index) => <li key={decision.id || index}><strong>{label(decision.action)}</strong> · {decision.actor_name || decision.reviewed_by_name || (decision.actor_id ? `Reviewer ${decision.actor_id}` : 'Reviewer not provided')}{decision.created_at && <time> · {new Date(decision.created_at).toLocaleString()}</time>}<p>{decision.reason}</p></li>)}</ol> : <p>No review decisions returned.</p>}</details>
          </>}
          <details className="per-audit" onToggle={event => setShowExports(event.currentTarget.open)}><summary>Export format support</summary>{showExports && <PlanningExportPanel key={scheduleVersionId || 'no-version'} versionId={scheduleVersionId} />}</details>
        </>}
  </section>
}
EvidenceReview.propTypes = { projectId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]), readOnly: PropTypes.bool, focusFactId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]), scheduleVersionId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]), onScheduleCreated: PropTypes.func }

export default function PlanningEvidenceReview(props) {
  return <EvidenceReview key={String(props.projectId)} {...props} />
}
PlanningEvidenceReview.propTypes = EvidenceReview.propTypes
