/* eslint-disable react/prop-types */
import React, { useId, useState } from 'react'
import { CheckCircle2, ClipboardCheck, FileText, ListChecks, Plus, ShieldCheck } from 'lucide-react'
import * as EPC from '../../../services/epcLifecycle.service'
import { EPCBlockers, EPCEmpty, EPCFacts, EPCModal, EPCNotice, EPCPanel, EPCScroll, EPCStatus, epcDate, epcError, epcId, epcLabel, epcControlScope, epcWbsPhase } from './EPCLifecycleCommon'

const nullableId = value => value === '' || value === null || value === undefined ? null : value
const matching = (value, id) => String(epcId(value)) === String(id)
const documentLabel = row => row.title || row.original_filename || `Document ${row.id}`

function Choices({ label, rows, selected, onChange, getLabel, empty }) {
  return <fieldset className="epc-wide"><legend>{label}</legend>{rows.length ? <div className="epc-check-list">{rows.map(row => <label className="epc-check" key={row.id}><input type="checkbox" checked={selected.some(id => matching(id, row.id))} onChange={event => onChange(event.target.checked ? [...selected, row.id] : selected.filter(id => !matching(id, row.id)))} /><span>{getLabel(row)}</span></label>)}</div> : <p className="epc-note">{empty}</p>}</fieldset>
}

function WorkEditor({ project, row, options, controlScope, onClose, onSaved }) {
  const formId = useId(), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const [form, setForm] = useState(() => ({ code: row?.code || '', title: row?.title || '', phase: row?.phase || '', wbs_node: String(epcId(row?.wbs_node)), owner: String(epcId(row?.owner)), reviewer: String(epcId(row?.reviewer)), activity: String(epcId(row?.activity)), baseline: String(epcId(row?.baseline)), purchase_order: String(epcId(row?.purchase_order)), milestone: String(epcId(row?.milestone)), requires_materials: row?.requires_materials === true, data_date: row?.data_date || '', evidence_note: row?.evidence_note || '', acceptance_criteria: (row?.acceptance_criteria || []).join('\n'), documents: (row?.documents || []).map(epcId), predecessors: (row?.predecessors || []).map(epcId) }))
  const field = (key, value) => setForm(current => ({ ...current, [key]: value }))
  const ownedPhases = controlScope.owned_phases
  const phaseOptions = (options.phases || []).filter(option => ownedPhases.includes(option.value))
  const wbsOptions = (options.wbs_nodes || []).filter(item => !epcWbsPhase(item, options.wbs_nodes) || ownedPhases.includes(epcWbsPhase(item, options.wbs_nodes)))
  const canEdit = (row ? row.can_edit === true : options.can_create === true) && (!row || ownedPhases.includes(row.phase))
  const activities = [...(options.activities || [])]
  if (row?.activity && !activities.some(item => matching(item.id, row.activity))) activities.push({ id: epcId(row.activity), external_id: 'Current activity', name: row.activity_name || `Activity ${epcId(row.activity)}` })
  const milestones = [...(options.milestones || [])]
  if (row?.milestone && !milestones.some(item => matching(item.id, row.milestone))) milestones.push({ id: epcId(row.milestone), name: row.milestone_name || `Current milestone ${epcId(row.milestone)}` })
  const save = async event => {
    event.preventDefault(); if (!canEdit || busy) return
    setBusy(true); setError('')
    const payload = { ...form, project: project.id, code: form.code.trim(), title: form.title.trim(), acceptance_criteria: form.acceptance_criteria.split('\n').map(line => line.trim()).filter(Boolean) }
    for (const key of ['activity', 'baseline', 'purchase_order', 'milestone']) payload[key] = nullableId(payload[key])
    try { const saved = row ? await EPC.updateWorkItem(row.id, payload) : await EPC.createWorkItem(payload); await onSaved('Execution work item saved as a draft.', false, saved.id); onClose() } catch (failure) { setError(epcError(failure)); setBusy(false) }
  }
  return <EPCModal title={row ? 'Edit work item' : 'New EPC work item'} onClose={onClose} busy={busy} footer={<><button type="button" className="pp-button" disabled={busy} onClick={onClose}>Cancel</button><button type="submit" form={formId} className="pp-button pp-primary" disabled={!canEdit || busy}>{busy ? 'Saving…' : 'Save draft'}</button></>}><form id={formId} className="epc-form" onSubmit={save}><div className="epc-wide"><EPCNotice error>{error}</EPCNotice></div>
    <label>Work item code<input required maxLength={64} value={form.code} onChange={event => field('code', event.target.value)} /></label>
    <label>Work item title<input required maxLength={255} value={form.title} onChange={event => field('title', event.target.value)} /></label>
    <label>Execution phase<select required value={form.phase} onChange={event => field('phase', event.target.value)}><option value="">Select phase</option>{phaseOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
    <label>Work package WBS<select required value={form.wbs_node} onChange={event => field('wbs_node', event.target.value)}><option value="">Select project WBS</option>{wbsOptions.map(item => <option key={item.id} value={item.id}>{item.code} — {item.name}</option>)}</select></label>
    <label>Work owner<select required value={form.owner} onChange={event => field('owner', event.target.value)}><option value="">Select owner</option>{(options.people || []).map(person => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
    <label>Evidence reviewer<select required value={form.reviewer} onChange={event => field('reviewer', event.target.value)}><option value="">Select reviewer</option>{(options.people || []).map(person => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
    <label>Progress activity<select value={form.activity} onChange={event => field('activity', event.target.value)}><option value="">Select when linked</option>{activities.map(item => <option key={item.id} value={item.id}>{item.external_id} — {item.name}</option>)}</select></label>
    <label>Integrated EPC baseline<select value={form.baseline} onChange={event => field('baseline', event.target.value)}><option value="">Select when captured</option>{(options.baselines || []).map(item => <option key={item.id} value={item.id}>Revision {item.revision} — {item.name}</option>)}</select></label>
    <label>Work data date<input type="date" required value={form.data_date} onChange={event => field('data_date', event.target.value)} /></label>
    <label>Linked milestone<select value={form.milestone} onChange={event => field('milestone', event.target.value)}><option value="">No milestone linked</option>{milestones.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    <label className="epc-check epc-wide"><input type="checkbox" checked={form.requires_materials} onChange={event => field('requires_materials', event.target.checked)} /><span>Material readiness is required for this work item.</span></label>
    <label className="epc-wide">Linked purchase order<select value={form.purchase_order} onChange={event => field('purchase_order', event.target.value)}><option value="">No purchase order linked</option>{(options.purchase_orders || []).map(item => <option key={item.id} value={item.id}>{item.po_number}</option>)}</select></label>
    <label className="epc-wide">Acceptance criteria<textarea required placeholder="One specific, verifiable criterion per line" value={form.acceptance_criteria} onChange={event => field('acceptance_criteria', event.target.value)} /></label>
    <Choices label="Evidence documents" rows={options.documents || []} selected={form.documents} onChange={value => field('documents', value)} getLabel={documentLabel} empty="No project documents are available. Upload evidence in the Documents tab, then refresh this workspace." />
    <label className="epc-wide">Evidence notes<textarea value={form.evidence_note} onChange={event => field('evidence_note', event.target.value)} /></label>
    <Choices label="Required predecessor work" rows={(options.predecessors || []).filter(item => !row || !matching(item.id, row.id))} selected={form.predecessors} onChange={value => field('predecessors', value)} getLabel={item => `${item.code} — ${item.title} (${epcLabel(item.status)})`} empty="No other project work items are available as predecessors." />
    <p className="epc-note epc-wide">{controlScope.description} Saving a draft earns no progress. Submission, evidence review and authorized acceptance must complete before this linked activity earns 100%.</p>
  </form></EPCModal>
}

function WorkAction({ action, row, onClose, onSaved, onOpenDocument }) {
  const formId = useId(), [busy, setBusy] = useState(false), [error, setError] = useState(''), [note, setNote] = useState(''), [decision, setDecision] = useState('approve'), [confirmed, setConfirmed] = useState(false)
  const allowed = row[`can_${action}`] === true
  const title = { submit: 'Submit work for review', review: 'Review work evidence', accept: 'Accept completed work' }[action]
  const button = { submit: 'Submit for review', review: decision === 'return' ? 'Return to draft' : 'Approve evidence review', accept: 'Accept work and post progress' }[action]
  const run = async event => {
    event.preventDefault(); if (busy || !allowed) return
    setBusy(true); setError('')
    try {
      const result = action === 'submit' ? await EPC.submitWorkItem(row.id) : action === 'review' ? await EPC.reviewWorkItem(row.id, { decision, note: note.trim(), criteria_confirmed: confirmed }) : await EPC.acceptWorkItem(row.id, { note: note.trim() })
      await onSaved(action === 'accept' ? 'Work accepted. The linked activity progress was posted and captured.' : action === 'review' && decision === 'return' ? 'Work returned to draft for correction.' : action === 'review' ? 'Evidence review approved. Acceptance remains a separate step.' : 'Work submitted to the assigned reviewer.', action === 'accept', result.id || row.id); onClose()
    } catch (failure) { setError(epcError(failure)); setBusy(false) }
  }
  return <EPCModal title={title} busy={busy} onClose={onClose} footer={<><button type="button" className="pp-button" disabled={busy} onClick={onClose}>Cancel</button><button type="submit" form={formId} className="pp-button pp-primary" disabled={busy || !allowed || action === 'review' && decision === 'approve' && !confirmed}>{button}</button></>}><p><strong>{row.code} — {row.title}</strong></p><EPCBlockers blockers={row.action_blockers?.[action] || []} /><form id={formId} className="epc-form" onSubmit={run}><div className="epc-wide"><EPCNotice error>{error}</EPCNotice></div>
    <div className="epc-wide"><h3>Acceptance criteria</h3>{row.acceptance_criteria?.length ? <ul className="epc-criteria">{row.acceptance_criteria.map((criterion, index) => <li key={index}>{criterion}</li>)}</ul> : <p className="epc-note">No acceptance criteria recorded.</p>}</div>
    <div className="epc-wide"><h3>Evidence documents</h3><div className="epc-actions">{(row.document_details || []).map(document => <button type="button" className="pp-button" key={document.id} disabled={busy} onClick={() => { onClose(); onOpenDocument(document.id) }}><FileText size={14} />{documentLabel(document)}</button>)}</div>{!row.document_details?.length && <p className="epc-note">No evidence documents linked.</p>}</div>
    {action === 'review' && <><label className="epc-wide">Review decision<select value={decision} onChange={event => setDecision(event.target.value)}><option value="approve">Approve evidence</option><option value="return">Return for correction</option></select></label><label className="epc-check epc-wide"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} /><span>I reviewed the linked evidence and confirmed every acceptance criterion.</span></label><p className="epc-note epc-wide">The assigned reviewer must perform this review using their own account.</p></>}
    {action !== 'submit' && <label className="epc-wide">{action === 'review' ? 'Review note' : 'Acceptance note'}<textarea required maxLength={4000} value={note} onChange={event => setNote(event.target.value)} /></label>}
    {action === 'submit' && <p className="epc-note epc-wide">Submission freezes this draft for evidence review. Ask the assigned reviewer to review or return it for correction.</p>}
    {action === 'accept' && <p className="epc-note epc-wide">Acceptance records the approval and posts 100% to the linked activity at {epcDate(row.data_date)}. Baseline links, evidence, predecessors and required material readiness are checked again by the server. The project is not marked complete.</p>}
  </form></EPCModal>
}

export default function EPCExecutionPanel({ project, rows, options, controlScope: suppliedScope, selected, loadingDetail, detailError, onSelect, onSaved, onSelectView, onOpenDocument }) {
  const [query, setQuery] = useState(''), [phase, setPhase] = useState(''), [status, setStatus] = useState(''), [dialog, setDialog] = useState(null)
  const controlScope = epcControlScope(project, suppliedScope || options?.control_scope)
  const selectedOwned = !selected || controlScope.owned_phases.includes(selected.phase)
  const filtered = rows.filter(row => (!phase || row.phase === phase) && (!status || row.status === status) && `${row.code} ${row.title} ${row.owner_name || ''}`.toLowerCase().includes(query.trim().toLowerCase()))
  const closed = () => setDialog(null)
  const nextAction = selected?.status === 'draft' ? 'submit' : selected?.status === 'submitted' ? 'review' : selected?.status === 'reviewed' ? 'accept' : null
  return <><div className="epc-section-grid"><EPCPanel title="Execution register" icon={ListChecks} actions={<button type="button" className="pp-button pp-primary" disabled={!options?.can_create} onClick={() => setDialog({ type: 'create' })}><Plus size={15} />New work item</button>}><div className="epc-toolbar"><label>Search work<input type="search" value={query} placeholder="Code, title or owner" onChange={event => setQuery(event.target.value)} /></label><label>Filter phase<select value={phase} onChange={event => setPhase(event.target.value)}><option value="">All phases</option>{(options?.phases || []).map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label>Filter status<select value={status} onChange={event => setStatus(event.target.value)}><option value="">All statuses</option>{['draft', 'submitted', 'reviewed', 'accepted'].map(value => <option key={value} value={value}>{epcLabel(value)}</option>)}</select></label></div>
    <p className="epc-note">{controlScope.description} Only controlled phases are available for execution acceptance.</p><EPCScroll label="EPC execution work items"><table className="epc-table"><thead><tr><th>Work item</th><th>Phase / WBS</th><th>Owner</th><th>Data date</th><th>Status</th><th>Earned activity progress</th></tr></thead><tbody>{filtered.map(row => <tr key={row.id} className={selected && matching(row.id, selected.id) ? 'is-selected' : ''}><td><button type="button" className="epc-row-link" aria-label={`Open work item ${row.code}`} onClick={() => onSelect(row.id)}>{row.code}</button><strong>{row.title}</strong></td><td>{epcLabel(row.phase)}<small>{row.wbs_code || `WBS ${epcId(row.wbs_node)}`}</small></td><td>{row.owner_name || 'Not assigned'}</td><td>{epcDate(row.data_date)}</td><td><EPCStatus value={row.status} /></td><td>{row.status === 'accepted' ? '100% posted' : 'Not earned'}</td></tr>)}</tbody></table></EPCScroll>{!filtered.length && <EPCEmpty>{rows.length ? 'No work items match these filters.' : 'No execution work items recorded. Create a draft with criteria and evidence links.'}</EPCEmpty>}<p className="epc-note">{filtered.length} of {rows.length} work items. Accepted work earns activity progress through the controlled acceptance action.</p>
  </EPCPanel><div className="epc-stack"><EPCPanel title="Work item detail" icon={ClipboardCheck} actions={selected && !loadingDetail && <EPCStatus value={selected.status} />}>
    {detailError ? <EPCNotice error>{detailError}</EPCNotice> : loadingDetail ? <EPCEmpty>Loading selected work item…</EPCEmpty> : !selected ? <EPCEmpty>Select a work item to review its evidence, requirements and next action.</EPCEmpty> : <><h3>{selected.code} — {selected.title}</h3><EPCFacts rows={[[ 'Phase / WBS', `${epcLabel(selected.phase)} · ${selected.wbs_code || epcId(selected.wbs_node)}`], ['Owner', selected.owner_name || 'Not assigned'], ['Evidence reviewer', selected.reviewer_name || 'Not assigned'], ['Activity', selected.activity_name || (selected.activity ? `Activity ${epcId(selected.activity)}` : 'Not linked')], ['Work data date', epcDate(selected.data_date)], ['Accepted', selected.accepted_at ? epcDate(selected.accepted_at) : 'Not accepted']]} />
      <h3>Acceptance criteria</h3>{selected.acceptance_criteria?.length ? <ul className="epc-criteria">{selected.acceptance_criteria.map((criterion, index) => <li key={index}>{criterion}</li>)}</ul> : <p className="epc-note">No acceptance criteria recorded.</p>}
      <h3>Evidence</h3><div className="epc-actions">{(selected.document_details || []).map(document => <button type="button" key={document.id} className="pp-button" onClick={() => onOpenDocument(document.id)}><FileText size={14} />{documentLabel(document)}</button>)}</div>{!selected.document_details?.length && <p className="epc-note">No project documents linked.</p>}{selected.evidence_note && <p className="epc-note epc-preserve">{selected.evidence_note}</p>}
      {selected.requires_materials && <EPCNotice success={selected.material_readiness?.ready === true}>{selected.material_readiness?.reason || 'Material readiness has not been returned.'}</EPCNotice>}
      {selected.predecessor_details?.length > 0 && <><h3>Required predecessor work</h3><ul className="epc-criteria">{selected.predecessor_details.map(row => <li key={row.id}><button type="button" className="epc-row-link" onClick={() => onSelect(row.id)}>{row.code} — {row.title}</button> <EPCStatus value={row.status} /></li>)}</ul></>}
      {nextAction && <EPCBlockers blockers={selected.action_blockers?.[nextAction] || []} title={`Requirements for ${epcLabel(nextAction).toLowerCase()}`} />}
      <div className="epc-actions"><button type="button" className="pp-button" disabled={!selected.can_edit || !options || !selectedOwned} onClick={() => setDialog({ type: 'edit' })}>Edit draft</button><button type="button" className="pp-button" disabled={!selected.can_submit || !selectedOwned} onClick={() => setDialog({ type: 'submit' })}>Submit for review</button><button type="button" className="pp-button" disabled={!selected.can_review || !selectedOwned} onClick={() => setDialog({ type: 'review' })}>Review evidence</button><button type="button" className="pp-button pp-primary" disabled={!selected.can_accept || !selectedOwned} onClick={() => setDialog({ type: 'accept' })}>Accept work</button></div>
      {selected.status === 'submitted' && <p className="epc-note">Review is assigned to {selected.reviewer_name || 'the recorded reviewer'} and requires their account.</p>}
      {selected.status === 'accepted' && <EPCNotice success><CheckCircle2 size={15} aria-hidden="true" /> Acceptance recorded. The linked activity progress was posted.</EPCNotice>}
      {selected.review_note && <p className="epc-note epc-preserve"><strong>Review note:</strong> {selected.review_note}</p>}
    </>}
  </EPCPanel><EPCPanel title="Review and acceptance history" icon={ShieldCheck}>{selected?.events?.length ? <ol className="epc-events">{selected.events.map((event, index) => <li key={event.id || index}><strong>{epcLabel(event.action)}</strong><span>{event.actor_name || 'Actor not recorded'} · {epcDate(event.created_at)}</span>{event.note && <p className="epc-preserve">{event.note}</p>}</li>)}</ol> : <EPCEmpty>No recorded workflow events for this selection.</EPCEmpty>}<button type="button" className="pp-button" onClick={() => onSelectView('documents')}>Open project documents</button></EPCPanel></div></div>
    {['create', 'edit'].includes(dialog?.type) && <WorkEditor project={project} row={dialog.type === 'edit' ? selected : null} options={options} controlScope={controlScope} onClose={closed} onSaved={onSaved} />}
    {['submit', 'review', 'accept'].includes(dialog?.type) && selected && <WorkAction action={dialog.type} row={selected} onSaved={onSaved} onClose={closed} onOpenDocument={onOpenDocument} />}
  </>
}
