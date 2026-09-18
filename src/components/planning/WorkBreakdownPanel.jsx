import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import PropTypes from 'prop-types'
import { AlertTriangle, ArrowLeft, ArrowRight, Check, CheckCircle2, ChevronDown, ChevronRight, ClipboardList, Clock3, FileSpreadsheet, FileText, Info, Loader2, Plus, Save, Sparkles, Trash2, User, X } from 'lucide-react'
import planningIntelligenceService from '../../services/planningIntelligence.service'
import useModalAccessibility from '../../hooks/useModalAccessibility'
import './WorkBreakdownPanel.css'

const hours = value => new Intl.NumberFormat('en', { maximumFractionDigits: 2 }).format(value)
const newId = () => `task-${crypto.randomUUID()}`
const errorMessage = error => {
  const data = error?.response?.data
  const flatten = value => typeof value === 'string' ? [value] : value && typeof value === 'object' ? Object.values(value).flatMap(flatten) : []
  return data?.error || data?.detail || flatten(data).join(' ') || error?.message || 'Unable to save work breakdown. Please try again.'
}
const emptyTask = discipline => ({ id: newId(), discipline, title: '', owner: '', effort_hours: null, depends_on: [], acceptance_criteria: '', reviewer: '', source_references: [] })

function Dialog({ title, children, onClose, footer }) {
  const ref = useModalAccessibility(true, onClose)
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [])
  return createPortal(<div className="wbd-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <section ref={ref} className="wbd-dialog" role="dialog" aria-modal="true" aria-labelledby="wbd-dialog-title" tabIndex={-1}>
      <header><h2 id="wbd-dialog-title">{title}</h2><button type="button" className="wbd-icon-button" aria-label="Close dialog" onClick={onClose}><X size={20} /></button></header>
      <div className="wbd-dialog-body">{children}</div><footer>{footer}</footer>
    </section>
  </div>, document.body)
}
Dialog.propTypes = { title: PropTypes.string.isRequired, children: PropTypes.node, onClose: PropTypes.func.isRequired, footer: PropTypes.node }

function TaskDialog({ task, tasks, disciplines, isNew, initialField, onSave, onDelete, onClose }) {
  const [draft, setDraft] = useState({ ...task, depends_on: [...task.depends_on] })
  const [error, setError] = useState('')
  const ownerRef = useRef(null)
  useEffect(() => { if (initialField === 'owner') ownerRef.current?.focus() }, [initialField])
  const change = (key, value) => setDraft(current => ({ ...current, [key]: value }))
  const save = event => {
    event.preventDefault()
    const value = { ...draft, title: draft.title.trim(), owner: draft.owner.trim(), reviewer: draft.reviewer.trim(), effort_hours: draft.effort_hours === '' || draft.effort_hours == null ? null : Number(draft.effort_hours) }
    if (!value.title) { setError('Enter a task or deliverable name.'); return }
    if (value.effort_hours !== null && (!Number.isFinite(value.effort_hours) || value.effort_hours < 0)) { setError('Enter a valid planned effort of zero or more hours.'); return }
    const graph = new Map([...tasks.filter(row => row.id !== value.id), value].map(row => [row.id, row.depends_on]))
    const visiting = new Set(), visited = new Set()
    const cycle = id => { if (visiting.has(id)) return true; if (visited.has(id)) return false; visiting.add(id); if ((graph.get(id) || []).some(cycle)) return true; visiting.delete(id); visited.add(id); return false }
    if ([...graph.keys()].some(cycle)) { setError('These dependencies create a circular sequence. Select an earlier task.'); return }
    onSave(value)
  }
  return <Dialog title={isNew ? 'Add task' : 'Edit task'} onClose={onClose} footer={<>
    {!isNew && <button type="button" className="wbd-button wbd-delete" onClick={() => onDelete(task.id)}><Trash2 size={15} />Remove task</button>}
    <button type="button" className="wbd-button" onClick={onClose}>Cancel</button><button type="submit" form="wbd-task-form" className="wbd-button wbd-primary">{isNew ? 'Add task' : 'Save task'}</button>
  </>}>
    <form id="wbd-task-form" onSubmit={save}>
      {error && <p className="wbd-error" role="alert">{error}</p>}
      <label>Task / deliverable<input required maxLength={500} value={draft.title} onChange={event => change('title', event.target.value)} /></label>
      <div className="wbd-form-grid"><label>Discipline<select value={draft.discipline} onChange={event => change('discipline', event.target.value)}>{disciplines.map(row => <option key={row.code} value={row.code}>{row.name}</option>)}</select></label>
        <label>Owner<input ref={ownerRef} maxLength={120} value={draft.owner} onChange={event => change('owner', event.target.value)} placeholder="Enter owner name" /></label>
        <label>Planned effort (hours)<input type="number" min="0" step="0.01" value={draft.effort_hours ?? ''} onChange={event => change('effort_hours', event.target.value)} placeholder="Enter hours" /></label>
        <label>Reviewer<input maxLength={120} value={draft.reviewer} onChange={event => change('reviewer', event.target.value)} placeholder="Enter reviewer name" /></label></div>
      <fieldset className="wbd-dependencies"><legend>Depends on</legend>{tasks.filter(row => row.id !== task.id).length ? tasks.filter(row => row.id !== task.id).map(row => <label key={row.id}><input type="checkbox" checked={draft.depends_on.includes(row.id)} onChange={event => change('depends_on', event.target.checked ? [...draft.depends_on, row.id] : draft.depends_on.filter(id => id !== row.id))} />{row.title}</label>) : <p>No other tasks yet.</p>}</fieldset>
      <label>Acceptance criteria<textarea rows={3} maxLength={5000} value={draft.acceptance_criteria} onChange={event => change('acceptance_criteria', event.target.value)} placeholder="Describe what must be checked before this task is complete" /></label>
    </form>
  </Dialog>
}
TaskDialog.propTypes = { task: PropTypes.object.isRequired, tasks: PropTypes.array.isRequired, disciplines: PropTypes.array.isRequired, isNew: PropTypes.bool, initialField: PropTypes.string, onSave: PropTypes.func.isRequired, onDelete: PropTypes.func.isRequired, onClose: PropTypes.func.isRequired }

function TemplateDialog({ disciplines, onApply, onClose }) {
  const [discipline, setDiscipline] = useState(disciplines[0]?.code || 'general')
  const [name, setName] = useState('')
  return <Dialog title="Use template" onClose={onClose} footer={<><button type="button" className="wbd-button" onClick={onClose}>Cancel</button><button type="submit" form="wbd-template-form" className="wbd-button wbd-primary">Add template tasks</button></>}>
    <form id="wbd-template-form" onSubmit={event => { event.preventDefault(); onApply(discipline, name.trim()) }}>
      <p className="wbd-muted">Engineering delivery: prepare, review and issue a deliverable.</p>
      <label>Deliverable name<input required maxLength={400} value={name} onChange={event => setName(event.target.value)} placeholder="e.g. Design package" /></label>
      <label>Discipline<select value={discipline} onChange={event => setDiscipline(event.target.value)}>{disciplines.map(row => <option key={row.code} value={row.code}>{row.name}</option>)}</select></label>
      <ol className="wbd-template-preview"><li>Prepare {name || 'deliverable'}</li><li>Review {name || 'deliverable'}</li><li>Issue {name || 'deliverable'}</li></ol>
      <p className="wbd-note"><Info size={15} />Set owners and effort after adding these tasks.</p>
    </form>
  </Dialog>
}
TemplateDialog.propTypes = { disciplines: PropTypes.array.isRequired, onApply: PropTypes.func.isRequired, onClose: PropTypes.func.isRequired }

export default function WorkBreakdownPanel({ projectId, intelligenceRunId, previewConfirmedAt, canEdit = true, baselinePublished = false, onBack, onContinue, onDirtyChanged, onSavingChanged }) {
  const [draft, setDraft] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [dirty, setDirty] = useState(false)
  const [collapsed, setCollapsed] = useState(new Set())
  const [details, setDetails] = useState(false)
  const [dialog, setDialog] = useState(null)
  const [loadRevision, setLoadRevision] = useState(0)
  const inFlight = useRef(false)
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  useEffect(() => {
    let active = true
    setLoading(true); setError('')
    planningIntelligenceService.getWorkBreakdown(projectId, intelligenceRunId).then(data => {
      if (!active) return
      if (data.preview_confirmed_at !== previewConfirmedAt) throw new Error('Review and confirm the latest Document Intelligence Preview before editing this work breakdown.')
      setDraft(data); setDirty(false)
    }).catch(reason => { if (active) setError(errorMessage(reason)) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [projectId, intelligenceRunId, previewConfirmedAt, loadRevision])
  useEffect(() => { onDirtyChanged?.(dirty); return () => onDirtyChanged?.(false) }, [dirty, onDirtyChanged])
  useEffect(() => { onSavingChanged?.(saving); return () => onSavingChanged?.(false) }, [saving, onSavingChanged])
  useEffect(() => {
    const beforeUnload = event => { if (dirty) { event.preventDefault(); event.returnValue = '' } }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [dirty])
  const tasks = draft?.tasks || []
  const disciplines = useMemo(() => {
    const rows = [...(draft?.disciplines || [])]
    for (const task of draft?.tasks || []) if (!rows.some(row => row.code === task.discipline)) rows.push({ code: task.discipline, name: task.discipline.replaceAll('_', ' ') })
    if (!rows.length) rows.push({ code: 'general', name: 'General' })
    return rows
  }, [draft])
  const groups = [...new Set(tasks.map(task => task.discipline))].map(code => ({
    ...disciplines.find(row => row.code === code), tasks: tasks.filter(task => task.discipline === code),
  }))
  const codes = new Map(groups.flatMap((group, groupIndex) => group.tasks.map((task, index) => [task.id, `${groupIndex + 1}.${index + 1}`])))
  const unassigned = tasks.filter(task => !task.owner?.trim())
  const unestimated = tasks.filter(task => task.effort_hours == null)
  const totalEffort = tasks.reduce((sum, task) => sum + Number(task.effort_hours || 0), 0)
  const checks = tasks.flatMap(task => [!task.owner?.trim() && { task, kind: 'owner', label: 'Owner required', action: 'Assign' }, task.effort_hours == null && { task, kind: 'effort', label: 'Effort required', action: 'Estimate' }].filter(Boolean))
  const hasReview = tasks.some(task => /interdisciplin|multi.disciplin/i.test(task.title) && /review/i.test(task.title))
  const suggestReview = groups.length > 1 && !hasReview
  const locked = !canEdit || saving || loading
  const updateTasks = next => { setDraft(current => ({ ...current, tasks: next })); setDirty(true); setNotice(''); setError('') }
  const editTask = (task, field) => { if (!locked) setDialog({ type: 'task', task, field, isNew: false }) }
  const save = async advance => {
    if (!draft || locked || inFlight.current) return
    inFlight.current = true; setSaving(true); setError(''); setNotice('')
    try {
      const result = await planningIntelligenceService.saveWorkBreakdown(projectId, {
        intelligence_run_id: intelligenceRunId, preview_confirmed_at: previewConfirmedAt,
        revision: draft.revision, tasks, ...(advance ? { advance: true } : {}),
      })
      if (!mounted.current) return
      setDraft(result); setDirty(false); setNotice('Work breakdown saved.')
      if (advance) onContinue(result)
    } catch (reason) { if (mounted.current) setError(errorMessage(reason)) }
    finally { inFlight.current = false; if (mounted.current) setSaving(false) }
  }
  const leave = action => { if (dirty) setDialog({ type: 'leave', action }); else action() }
  const applyTemplate = (discipline, name) => {
    const rows = ['Prepare', 'Review', 'Issue'].map(verb => ({ ...emptyTask(discipline), title: `${verb} ${name}` }))
    rows[1].depends_on = [rows[0].id]; rows[2].depends_on = [rows[1].id]
    updateTasks([...tasks, ...rows]); setDialog(null)
  }
  if (loading) return <section className="work-breakdown"><form id="project-planning-work-breakdown-form" onSubmit={event => event.preventDefault()} /><div className="wbd-loading" role="status"><Loader2 size={19} className="animate-spin" />Loading work breakdown…</div></section>
  if (!draft) return <section className="work-breakdown"><div className="wbd-error" role="alert">{error || 'Work breakdown is unavailable.'}</div><div className="wbd-actions"><button type="button" className="wbd-button" onClick={onBack}><ArrowLeft size={16} />Back to inputs</button><button type="button" className="wbd-button" onClick={() => setLoadRevision(value => value + 1)}>Retry</button></div></section>
  return <section className="work-breakdown" aria-label="Work breakdown planning" aria-busy={saving}>
    <form id="project-planning-work-breakdown-form" onSubmit={event => { event.preventDefault(); save(false) }} />
    {error && <div className="wbd-error" role="alert">{error}</div>}
    {notice && <div className="wbd-success" role="status"><CheckCircle2 size={16} />{notice}</div>}
    <div className="wbd-metrics" aria-label="Work breakdown totals"><span><ClipboardList size={20} /><strong>{tasks.length}</strong>Planned tasks</span><span><Clock3 size={20} /><strong>{hours(totalEffort)} h</strong>Planned effort</span><span className={unassigned.length ? 'wbd-warning' : 'wbd-good'}>{unassigned.length ? <AlertTriangle size={20} /> : <CheckCircle2 size={20} />}<strong>{unassigned.length}</strong>Unassigned tasks</span></div>
    <div className="wbd-columns">
      <div className="wbd-card wbd-main"><header className="wbd-card-header"><div><h2>Work breakdown</h2><p>Define deliverables, effort and responsibility.</p></div><div className="wbd-actions"><button type="button" className="wbd-button" disabled={locked} onClick={() => setDialog({ type: 'task', task: emptyTask(disciplines[0].code), isNew: true })}><Plus size={17} />Add task</button><button type="button" className="wbd-button wbd-secondary" disabled={locked} onClick={() => setDialog({ type: 'template' })}><FileText size={17} />Use template</button></div></header>
        <div className="wbd-table-scroll" tabIndex={0} role="region" aria-label="Work breakdown tasks"><table className="wbd-table"><thead><tr><th scope="col">WBS</th><th scope="col">Task / deliverable</th><th scope="col">Owner</th><th scope="col">Effort</th><th scope="col">Depends on</th></tr></thead><tbody>
          {groups.map((group, groupIndex) => <React.Fragment key={group.code}><tr className="wbd-group"><th scope="row"><button type="button" aria-label={`${collapsed.has(group.code) ? 'Expand' : 'Collapse'} ${group.name}`} aria-expanded={!collapsed.has(group.code)} onClick={() => setCollapsed(current => { const next = new Set(current); if (next.has(group.code)) next.delete(group.code); else next.add(group.code); return next })}>{collapsed.has(group.code) ? <ChevronRight size={17} /> : <ChevronDown size={17} />}{groupIndex + 1}.0</button></th><td colSpan={2}>{group.name}</td><td>{hours(group.tasks.reduce((sum, task) => sum + Number(task.effort_hours || 0), 0))} h</td><td /></tr>
            {!collapsed.has(group.code) && group.tasks.map(task => <React.Fragment key={task.id}><tr><td>{codes.get(task.id)}</td><td><button type="button" className="wbd-task-title" disabled={locked} onClick={() => editTask(task)}>{task.title}</button></td><td>{task.owner ? <button type="button" className="wbd-owner" disabled={locked} aria-label={`Edit owner for ${task.title}`} onClick={() => editTask(task, 'owner')}>{task.owner}</button> : <button type="button" className="wbd-assign" disabled={locked} aria-label={`Assign owner for ${task.title}`} onClick={() => editTask(task, 'owner')}><User size={15} />Assign owner</button>}</td><td><button type="button" className={`wbd-effort ${task.effort_hours == null ? 'wbd-missing' : ''}`} disabled={locked} aria-label={`Edit effort for ${task.title}`} onClick={() => editTask(task, 'effort')}>{task.effort_hours == null ? 'Set effort' : `${hours(task.effort_hours)} h`}</button></td><td className="wbd-muted">{task.depends_on.map(id => codes.get(id)).filter(Boolean).join(', ') || '—'}</td></tr>
              {details && <tr className="wbd-detail-row"><td /><td colSpan={4}><div><strong>Acceptance criteria</strong><span>{task.acceptance_criteria || 'Not specified'}</span></div><div><strong>Reviewer</strong><span>{task.reviewer || 'Not assigned'}</span></div></td></tr>}</React.Fragment>)}
          </React.Fragment>)}
          {!tasks.length && <tr><td colSpan={5} className="wbd-empty">Add a task or use a template to begin the work breakdown.</td></tr>}
        </tbody><tfoot><tr><th colSpan={3} scope="row">Total planned effort</th><td>{hours(totalEffort)} h</td><td /></tr></tfoot></table></div>
        <div className="wbd-table-footer"><button type="button" className="wbd-link" aria-expanded={details} onClick={() => setDetails(value => !value)}>{details ? 'Hide' : 'Show'} acceptance criteria and reviewers<ChevronDown size={15} /></button><button type="submit" form="project-planning-work-breakdown-form" className="wbd-link" disabled={locked} aria-label="Save work breakdown">{saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}{saving ? 'Saving…' : dirty ? 'Save changes' : 'Save draft'}</button></div>
      </div>
      <aside className="wbd-side"><section className="wbd-card"><header className="wbd-side-heading"><h2>Planning checks</h2><span className={`wbd-badge ${checks.length ? 'is-warning' : 'is-good'}`}>{checks.length ? <User size={13} /> : <Check size={13} />}{checks.length} {checks.length === 1 ? 'action' : 'actions'}</span></header>
        <ul className="wbd-checks">{checks.slice(0, 6).map(({ task, kind, label, action }) => <li key={`${task.id}-${kind}`}><AlertTriangle size={20} /><div><strong>{task.title}</strong><small>{label}</small></div><button type="button" className="wbd-link" disabled={locked} aria-label={`${action} ${task.title}`} onClick={() => editTask(task, kind)}>{action}</button></li>)}</ul>
        {checks.length > 6 && <p className="wbd-muted wbd-more">{checks.length - 6} more actions in the task table.</p>}
        <p className={`wbd-check-result ${unestimated.length ? 'wbd-muted' : 'wbd-good'}`}>{unestimated.length ? <Info size={18} /> : <CheckCircle2 size={20} />}<span>{unestimated.length ? `${unestimated.length} ${unestimated.length === 1 ? 'task needs' : 'tasks need'} an effort estimate.` : tasks.length ? 'Task effort totals verified' : 'Add tasks to begin planning checks.'}</span></p>
      </section><section className="wbd-card"><header className="wbd-side-heading"><h2>AI planning assistant</h2><span className="wbd-badge is-suggestion"><Sparkles size={13} />Suggestion</span></header>
        <div className="wbd-suggestion"><Sparkles size={28} /><div><p>{suggestReview ? 'Add an interdisciplinary review before final issue.' : hasReview ? 'An interdisciplinary review is included in your plan.' : 'Review deliverable acceptance criteria before scheduling.'}</p><small>{suggestReview ? 'Proposed task · Estimate needs review' : 'Based on the current work breakdown'}</small></div></div>
        {suggestReview && <><p className="wbd-info"><Info size={15} />This is a suggestion, not an applied change.</p><button type="button" className="wbd-button wbd-review-suggestion" disabled={locked} onClick={() => setDialog({ type: 'task', isNew: true, task: { ...emptyTask(disciplines[0].code), title: 'Interdisciplinary review', depends_on: tasks.filter(task => !tasks.some(other => other.depends_on.includes(task.id))).map(task => task.id), acceptance_criteria: 'Record and close interdisciplinary comments before final issue.' } })}>Review suggestion</button></>}
        <div className="wbd-sources"><h3>Source documents</h3><ul>{(draft.source_documents || []).map(file => <li key={file.id}>{/xlsx?|csv|mdr/i.test(`${file.name} ${file.category}`) ? <FileSpreadsheet size={22} className="wbd-sheet-icon" /> : <FileText size={22} className="wbd-pdf-icon" />}<span title={file.name}>{file.name}</span><small><CheckCircle2 size={14} />Reviewed</small></li>)}</ul>{!draft.source_documents?.length && <p className="wbd-muted">No source documents in the confirmed preview.</p>}<button type="button" className="wbd-link" disabled={saving} onClick={() => leave(onBack)}>Manage inputs<ArrowRight size={14} /></button></div>
      </section></aside>
    </div>
    <footer className="wbd-bottom"><button type="button" className="wbd-button wbd-secondary" disabled={saving} onClick={() => leave(onBack)}><ArrowLeft size={17} />Back to inputs</button><div><span>{baselinePublished ? 'Draft revision · Published baseline retained' : 'Draft plan · No baseline published'}</span><small>{dirty ? 'Unsaved changes' : draft.saved_at ? 'Work breakdown saved' : 'From confirmed Document Intelligence'}</small></div><button type="button" className="wbd-button wbd-primary" disabled={locked || !tasks.length} onClick={() => save(true)}>{saving ? <Loader2 size={17} className="animate-spin" /> : null}Continue to schedule<ArrowRight size={17} /></button></footer>
    {dialog?.type === 'task' && <TaskDialog task={dialog.task} tasks={tasks} disciplines={disciplines} isNew={dialog.isNew} initialField={dialog.field} onClose={() => setDialog(null)} onSave={task => { updateTasks(dialog.isNew ? [...tasks, task] : tasks.map(row => row.id === task.id ? task : row)); setDialog(null) }} onDelete={id => { updateTasks(tasks.filter(task => task.id !== id).map(task => ({ ...task, depends_on: task.depends_on.filter(value => value !== id) }))); setDialog(null) }} />}
    {dialog?.type === 'template' && <TemplateDialog disciplines={disciplines} onApply={applyTemplate} onClose={() => setDialog(null)} />}
    {dialog?.type === 'leave' && <Dialog title="Save work breakdown?" onClose={() => setDialog(null)} footer={<><button type="button" className="wbd-button" onClick={() => { const action = dialog.action; setDialog(null); action() }}>Discard changes</button><button type="button" className="wbd-button wbd-primary" onClick={() => setDialog(null)}>Keep editing</button></>}><p>Your task changes have not been saved. Save the work breakdown before leaving to keep them.</p></Dialog>}
  </section>
}
WorkBreakdownPanel.propTypes = { projectId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired, intelligenceRunId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired, previewConfirmedAt: PropTypes.string.isRequired, canEdit: PropTypes.bool, baselinePublished: PropTypes.bool, onBack: PropTypes.func.isRequired, onContinue: PropTypes.func.isRequired, onDirtyChanged: PropTypes.func, onSavingChanged: PropTypes.func }
