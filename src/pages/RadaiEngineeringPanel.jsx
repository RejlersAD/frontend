import { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { Link } from 'react-router-dom'
import {
  compareKnowledgeRevisions, getEngineeringReview, listEngineeringEvidence,
  listEPCWorkItems, listLineLists, listProjectKnowledge, submitEngineeringReview, validateEngineeringEvidence,
} from '../services/radaiIntelligence.service'

const rows = result => Array.isArray(result) ? result : (result?.results || [])

export default function RadaiEngineeringPanel({ projectId }) {
  const [evidence, setEvidence] = useState([])
  const [workItems, setWorkItems] = useState([])
  const [lineLists, setLineLists] = useState([])
  const [knowledge, setKnowledge] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [review, setReview] = useState(null)
  const [lineListId, setLineListId] = useState('')
  const [leftId, setLeftId] = useState('')
  const [rightId, setRightId] = useState('')
  const [comparison, setComparison] = useState(null)
  const [confirmSubmit, setConfirmSubmit] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    Promise.allSettled([
      listEngineeringEvidence(projectId), listEPCWorkItems(projectId),
      listLineLists(), listProjectKnowledge(projectId),
    ]).then(results => {
      if (!active) return
      setEvidence(results[0].status === 'fulfilled' ? rows(results[0].value) : [])
      setWorkItems(results[1].status === 'fulfilled' ? rows(results[1].value) : [])
      setLineLists(results[2].status === 'fulfilled' ? rows(results[2].value) : [])
      setKnowledge(results[3].status === 'fulfilled' ? rows(results[3].value) : [])
      if (results[0].status === 'rejected') setError('Engineering evidence is unavailable or your role lacks P&ID and CRS read access.')
    })
    return () => { active = false }
  }, [projectId])

  const loadReview = async id => {
    setSelectedId(id); setReview(null); setConfirmSubmit(false); setError('')
    if (!id) return
    try {
      const details = await getEngineeringReview(id)
      if (String(details.project_id) !== String(projectId)) throw new Error('Project mismatch')
      setReview(details)
    } catch { setError('The exact engineering review could not be loaded.') }
  }

  const run = async operation => {
    setBusy(true); setError('')
    try {
      const result = await operation()
      if (String(result.project_id) !== String(projectId) || result.extraction_id !== selectedId) throw new Error('Evidence identity mismatch')
      setReview(result); setConfirmSubmit(false)
    } catch (requestError) {
      const detail = requestError?.response?.data?.detail || requestError?.response?.data?.validation
      setError(typeof detail === 'string' ? detail : 'The action was rejected. Check source identity, validation, and your authority.')
    } finally { setBusy(false) }
  }

  const compare = async () => {
    setBusy(true); setError(''); setComparison(null)
    try { setComparison(await compareKnowledgeRevisions(projectId, Number(leftId), Number(rightId))) }
    catch { setError('Revision comparison requires two accessible, processed revisions from the same CRS chain.') }
    finally { setBusy(false) }
  }

  const exact = evidence.find(item => item.extraction_id === selectedId)
  const crsSources = knowledge.filter(source => source.crs_revision_id && source.status === 'ready')

  return <div className="mt-8 space-y-6 border-t border-[var(--rd-border-soft)] pt-6 text-sm">
    <div><h2 className="text-base font-semibold">Engineering actions</h2><p className="mt-1 text-[var(--rd-text-muted)]">These controls call the existing P&ID and Project Control APIs. Technical approval, controlled issue, and EPC acceptance remain in their formal workflows.</p></div>
    {error && <p role="alert" className="text-[var(--rd-danger)]">{error}</p>}
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="space-y-3"><h3 className="font-semibold">Review P&ID evidence</h3><label htmlFor="engineering-evidence" className="block text-xs text-[var(--rd-text-muted)]">Linked extraction and exact CRS revision</label><select id="engineering-evidence" className="rd-input w-full" value={selectedId} onChange={event => loadReview(event.target.value)}><option value="">Select linked extraction</option>{evidence.map(item => <option key={item.extraction_id} value={item.extraction_id}>{item.extraction_id} · {item.revision_label}</option>)}</select>
        {review && <div className="space-y-2 rounded-lg border border-[var(--rd-border-soft)] p-3"><p><strong>State:</strong> {review.review_state} · <strong>Revision:</strong> {exact?.revision_label || review.revision_id}</p><p><strong>Evidence:</strong> {review.evidence_current ? 'Current' : 'Missing or changed'} · <strong>Validation:</strong> {review.validation?.passed ? 'Passed' : 'Incomplete or failed'}</p><p className="break-all text-xs text-[var(--rd-text-muted)]">Fingerprint: {review.evidence_fingerprint || 'Not recorded'}</p><p className="text-xs text-[var(--rd-text-muted)]">Work item {review.work_item_id}; CRS revision {review.revision_id}; source document {review.crs_document_id}.</p>
          <label htmlFor="engineering-line-list" className="block text-xs font-medium">Active Line List upload</label><select id="engineering-line-list" value={lineListId} onChange={event => setLineListId(event.target.value)} className="rd-input w-full"><option value="">Select a Line List</option>{lineLists.filter(item => item.is_active).map(item => <option key={item.line_list_id} value={item.line_list_id}>{item.filename} · {item.line_list_id}</option>)}</select><button type="button" disabled={!lineListId || busy || !['draft', 'validated', 'returned'].includes(review.review_state)} onClick={() => run(() => validateEngineeringEvidence(selectedId, lineListId))} className="rd-btn">Run deterministic validation</button>
          {review.review_state === 'validated' && review.validation?.passed && review.evidence_current && <div className="pt-2">{confirmSubmit ? <div className="flex flex-wrap items-center gap-2"><span className="text-xs">Send this exact evidence for human review?</span><button type="button" disabled={busy} onClick={() => run(() => submitEngineeringReview(selectedId))} className="rd-btn rd-btn-primary">Confirm submission</button><button type="button" onClick={() => setConfirmSubmit(false)} className="rd-btn">Cancel</button></div> : <button type="button" onClick={() => setConfirmSubmit(true)} className="rd-btn">Submit for review</button>}</div>}
          <Link className="inline-block text-xs text-[var(--rd-primary)] underline-offset-2 hover:underline" to="/engineering/process/pid-checker-v2">Open P&ID module</Link>
        </div>}
        {!evidence.length && <p className="text-xs text-[var(--rd-text-muted)]">No linked P&ID evidence is available for this project.</p>}
      </section>
      <section className="space-y-3"><h3 className="font-semibold">Compare CRS revisions</h3><p className="text-xs text-[var(--rd-text-muted)]">Only embedded text from explicitly linked revisions in the same controlled CRS chain can be compared.</p><select aria-label="Earlier CRS revision" className="rd-input w-full" value={leftId} onChange={event => setLeftId(event.target.value)}><option value="">Earlier revision</option>{crsSources.map(source => <option key={source.id} value={source.id}>{source.name} · {source.revision}</option>)}</select><select aria-label="Later CRS revision" className="rd-input w-full" value={rightId} onChange={event => setRightId(event.target.value)}><option value="">Later revision</option>{crsSources.map(source => <option key={source.id} value={source.id}>{source.name} · {source.revision}</option>)}</select><button type="button" disabled={!leftId || !rightId || leftId === rightId || busy} onClick={compare} className="rd-btn">Compare extracted text</button>{comparison && <div className="rounded-lg border border-[var(--rd-border-soft)] p-3"><p className="font-medium">{comparison.left.revision} to {comparison.right.revision}</p><pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words text-xs">{comparison.changes.length ? comparison.changes.join('\n') : 'No embedded-text differences found.'}</pre>{comparison.truncated && <p className="text-xs">Output truncated.</p>}</div>}</section>
    </div>
    <section><h3 className="font-semibold">Project coordination</h3>{workItems.length ? <ul className="mt-2 divide-y divide-[var(--rd-border-soft)]">{workItems.slice(0, 10).map(item => <li key={item.id} className="flex flex-wrap justify-between gap-2 py-2"><span>{item.code} · {item.title}</span><span className="text-[var(--rd-text-muted)]">{item.status}</span></li>)}</ul> : <p className="mt-2 text-xs text-[var(--rd-text-muted)]">No accessible EPC work items are available.</p>}<Link className="mt-3 inline-block text-xs text-[var(--rd-primary)] underline-offset-2 hover:underline" to="/projects">Open Project Control</Link></section>
  </div>
}

RadaiEngineeringPanel.propTypes = { projectId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired }
