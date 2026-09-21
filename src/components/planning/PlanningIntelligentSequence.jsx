import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import PropTypes from 'prop-types'
import { AlertTriangle, GitBranch, Loader2, Search, Settings2, Sparkles, X } from 'lucide-react'
import { planningIntelligenceService as service } from '../../services/planningIntelligence.service'
import PrimaveraActivitiesGantt from './PrimaveraActivitiesGantt'
import PlanningAIConnection from './PlanningAIConnection'
import { dateDisplayTask, dateEvidenceLabel } from '../../utils/planningDateEvidence'
import { scheduleDate } from '../../utils/primaveraSchedule'
import './PlanningSequenceReview.css'
import './PlanningIntelligentSequence.css'

const noop = () => {}
const EMPTY_TASKS = []
const text = value => typeof value === 'string' ? value : value?.message || value?.rationale || value?.description || ''
const code = task => task?.activity_code || task?.external_id || task?.id
const errorText = caught => {
  const body = caught.response?.data
  return text(body?.error) || text(body?.detail) || caught.message || 'Unable to generate the sequence. Try again or check AI settings.'
}

export default function PlanningIntelligentSequence({ projectId, revision, onClose, onApplied }) {
  const dialogRef = useRef(null), started = useRef(false), alive = useRef(true), inFlight = useRef(false)
  const [result, setResult] = useState(null), [busy, setBusy] = useState(false), [applying, setApplying] = useState(false)
  const [error, setError] = useState(''), [stale, setStale] = useState(false), [providerError, setProviderError] = useState(false)
  const [showConnection, setShowConnection] = useState(false), [connectionBusy, setConnectionBusy] = useState(false), [connectionReady, setConnectionReady] = useState(false)
  const [tab, setTab] = useState('gantt'), [search, setSearch] = useState(''), [selected, setSelected] = useState(null)
  const generate = useCallback(async (fresh = false) => {
    if (inFlight.current || connectionBusy) return
    inFlight.current = true; setBusy(true); setResult(null); setError(''); setStale(false); setProviderError(false); setSelected(null); setTab('gantt')
    setShowConnection(false); setConnectionReady(false)
    try {
      let currentRevision = revision
      if (fresh) {
        const current = await service.getCurrentMasterSchedule(projectId)
        if (!alive.current) return
        if (current.permissions?.can_propose_sequence !== true) throw new Error('This Master Schedule no longer permits generating a sequence. Refresh the project to review its status.')
        currentRevision = current.revision
      }
      const preview = await service.proposeIntelligentSequence(projectId, { revision: currentRevision })
      if (alive.current) setResult(preview)
    } catch (caught) {
      if (alive.current) {
        setError(errorText(caught)); setStale(caught.response?.status === 409)
        const needsProvider = ['intelligent_sequence_unavailable', 'intelligent_sequence_ai_unavailable'].includes(caught.response?.data?.code) || /credential|provider|api key|AI configuration/i.test(errorText(caught))
        setProviderError(needsProvider); if (needsProvider) setShowConnection(true)
      }
    } finally { inFlight.current = false; if (alive.current) setBusy(false) }
  }, [projectId, revision, connectionBusy])
  useEffect(() => {
    const dialog = dialogRef.current, opener = document.activeElement
    dialog.showModal()
    return () => { dialog.close(); if (opener?.isConnected) opener.focus({ preventScroll: true }) }
  }, [])
  useEffect(() => {
    alive.current = true
    if (!started.current) { started.current = true; generate() }
    return () => { alive.current = false }
  }, [generate])
  const proposal = result?.proposal, plan = result?.plan || {}, tasks = plan.tasks || EMPTY_TASKS
  const relations = useMemo(() => {
    const byId = new Map(tasks.map(task => [String(task.id), task]))
    return tasks.flatMap(successor => (successor.dependency_details || []).map(link => {
    const predecessor = byId.get(String(link.task_id ?? link.predecessor_id))
    const reason = successor.dependency_rationales?.[String(link.task_id ?? link.predecessor_id)]
    return { predecessor, successor, link, rationale: text(link.rationale) || text(reason),
      proposed: link.status === 'proposed' || link.evidence_type === 'planning_inference' || reason?.status === 'proposed' }
  })) }, [tasks])
  const visibleRelations = relations.filter(item => `${code(item.predecessor)} ${item.predecessor?.title} ${code(item.successor)} ${item.successor.title} ${item.rationale}`.toLowerCase().includes(search.toLowerCase()))
  const apply = async () => {
    if (inFlight.current || connectionBusy || stale || !proposal?.token) return
    inFlight.current = true; setBusy(true); setApplying(true); setError('')
    try {
      const saved = await service.applyIntelligentSequence(projectId, { proposal_token: proposal.token })
      if (alive.current) onApplied(saved)
    } catch (caught) {
      if (alive.current) { setError(errorText(caught)); setStale(caught.response?.status === 409) }
    } finally { inFlight.current = false; if (alive.current) { setBusy(false); setApplying(false) } }
  }
  const selectedDates = selected && dateDisplayTask(selected)
  return createPortal(<dialog ref={dialogRef} className="psq-dialog pis-dialog" aria-labelledby="pis-title" aria-describedby="pis-description" onCancel={event => { event.preventDefault(); if (!busy && !connectionBusy) onClose() }}>
    <header className="psq-header"><div><h2 id="pis-title"><Sparkles size={20} />AI logic & sequence <span>Proposal</span></h2><p id="pis-description">Review the proposed timeline and dependency links. Source evidence stays identifiable; the baseline is unchanged.</p></div><div className="pis-header-actions"><button type="button" className="psq-button" disabled={busy || connectionBusy} aria-expanded={showConnection} onClick={() => setShowConnection(value => !value)}><Settings2 size={15} />AI settings</button><button type="button" className="psq-close" aria-label="Close AI sequence preview" disabled={busy || connectionBusy} onClick={onClose}><X size={20} /></button></div></header>
    <div className="psq-content" aria-busy={busy || connectionBusy}>
      {busy && <p className="pis-loading" role="status"><Loader2 size={20} className="animate-spin" />{applying ? 'Saving the reviewed sequence as a new Master Schedule draft...' : 'Analyzing the activities and proposing their sequence. This can take a few minutes.'}</p>}
      {error && <div className="psq-error" role="alert"><p>{error}</p><div><button type="button" className="psq-button" disabled={busy || connectionBusy} onClick={() => generate(true)}>{stale ? 'Regenerate from latest plan' : 'Try again'}</button>{providerError && !showConnection && <button type="button" className="psq-button" disabled={busy || connectionBusy} onClick={() => setShowConnection(true)}>Configure AI connection</button>}</div></div>}
      {showConnection && <PlanningAIConnection disabled={busy} onBusyChange={setConnectionBusy} onConnected={() => { setError(''); setProviderError(false); setConnectionReady(true) }} />}
      {connectionReady && <p><button type="button" className="psq-button psq-primary" disabled={busy || connectionBusy} onClick={() => generate(true)}><Sparkles size={16} />Generate sequence</button></p>}
      {proposal && <>
        <div className="psq-summary"><span><strong>{proposal.activity_count ?? tasks.length}</strong> activities</span><span><GitBranch size={15} /><strong>{proposal.relationship_count ?? relations.length}</strong> relationships</span><span><strong>{proposal.proposed_relationship_count ?? 0}</strong> AI-proposed links</span><span><strong>{proposal.proposed_duration_count ?? 0}</strong> proposed durations</span><span>Timeline <strong>{scheduleDate(proposal.start_date)} - {scheduleDate(proposal.finish_date)}</strong></span><span>Project target <strong>{scheduleDate(proposal.target_finish_date)}</strong></span></div>
        <div className="psq-toolbar"><div role="group" aria-label="AI sequence preview view"><button type="button" aria-pressed={tab === 'gantt'} onClick={() => setTab('gantt')}>Activities & Gantt</button><button type="button" aria-pressed={tab === 'logic'} onClick={() => setTab('logic')}>Logic & rationale</button></div><label><Search size={15} /><input aria-label="Search AI sequence activities" value={search} onChange={event => setSearch(event.target.value)} placeholder="Activity ID or name" /></label></div>
        {tab === 'gantt' ? <PrimaveraActivitiesGantt plan={plan} tasks={tasks} disciplines={plan.disciplines || []} display="activities" search={search} fitTimeline showLogic locked selectedId={selected?.id} onSelect={setSelected} onEdit={noop} onInputs={noop} />
          : <div className="psq-table-scroll" tabIndex={0} role="region" aria-label="AI sequence relationships"><table><thead><tr><th>Predecessor</th><th>Successor</th><th>Type / lag</th><th>Basis</th><th>Rationale</th></tr></thead><tbody>{visibleRelations.map(({ predecessor, successor, link, rationale, proposed }, index) => <tr key={`${code(predecessor)}:${code(successor)}:${index}`}><td>{code(predecessor) || link.task_id}<small>{predecessor?.title}</small></td><td>{code(successor)}<small>{successor.title}</small></td><td>{link.type || link.relationship_type || 'Not Specified'} / {link.lag_days == null ? 'Not Specified' : `${link.lag_days} d`}</td><td>{proposed ? 'AI proposal' : 'Retained input'}</td><td>{rationale || 'No rationale recorded'}</td></tr>)}</tbody></table>{!visibleRelations.length && <p className="psq-empty">No relationships match this view.</p>}</div>}
        {selected && tab === 'gantt' && <section className="psq-selected" aria-label="AI proposed activity details"><strong>{code(selected)} - {selected.title}</strong><p>{selected.schedule_rationale || selected.duration_rationale || 'Review this activity and its incoming links.'}</p><p>{scheduleDate(selectedDates.display_start_date)} - {scheduleDate(selectedDates.display_finish_date)}. {dateEvidenceLabel(selectedDates)}</p></section>}
        <details className="psq-assumptions"><summary>Planning basis & warnings ({proposal.warnings?.length || 0})</summary><p>Calendar: {proposal.calendar?.name || 'Not Specified'}{proposal.calendar?.proposed && ' (proposed)'}. {proposal.calendar?.hours_per_day != null && `${proposal.calendar.hours_per_day} hours per day.`} Working days: {(proposal.calendar?.working_weekdays || []).map(day => ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][day]).filter(Boolean).join(', ') || 'Not Specified'}.</p><ul>{(proposal.warnings || []).map((warning, index) => <li key={index}><AlertTriangle size={14} /> {text(warning)}</li>)}</ul><p>AI suggestions are planning proposals. Review the stated reasoning before accepting them as your draft.</p></details>
      </>}
    </div>
    <footer className="psq-footer"><span>Creates a new draft. Approval and baseline publication remain separate.</span><button type="button" className="psq-button" disabled={busy || connectionBusy} onClick={onClose}>Cancel</button><button type="button" className="psq-button psq-primary" disabled={busy || connectionBusy || stale || !proposal?.token} onClick={apply}>{applying && <Loader2 size={16} className="animate-spin" />}Use proposed sequence</button></footer>
  </dialog>, document.body)
}
PlanningIntelligentSequence.propTypes = { projectId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired, revision: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired, onClose: PropTypes.func.isRequired, onApplied: PropTypes.func.isRequired }
