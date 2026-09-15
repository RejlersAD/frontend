/* eslint-disable react/prop-types */
import React, { useEffect, useId, useRef, useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import * as PC from '../../../services/projectControl.service'

const today = () => new Date().toISOString().slice(0, 10)
const errorMessage = error => {
  const data = error?.response?.data
  if (typeof data?.detail === 'string') return data.detail
  if (data && typeof data === 'object') return Object.entries(data).map(([field, value]) => `${field}: ${Array.isArray(value) ? value.join(' ') : String(value)}`).join(' ')
  return error?.message || 'The milestone could not be saved. Try again.'
}

export function MilestoneDialog({ title, children, onClose, footer, busy = false }) {
  const ref = useRef(null), id = useId()
  useEffect(() => {
    const dialog = ref.current, opener = document.activeElement
    dialog.showModal()
    return () => { dialog.close(); if (opener?.isConnected) opener.focus({ preventScroll: true }) }
  }, [])
  return <dialog ref={ref} className="mc-dialog" aria-labelledby={id} onCancel={event => { event.preventDefault(); if (!busy) onClose() }} onClick={event => { if (!busy && event.target === event.currentTarget) onClose() }}><div className="mc-dialog-header"><h2 id={id}>{title}</h2><button type="button" className="pp-button pp-icon-button" onClick={onClose} disabled={busy} aria-label="Close dialog"><X size={18} /></button></div><div className="mc-dialog-body">{children}</div>{footer && <div className="mc-dialog-footer">{footer}</div>}</dialog>
}

export function MilestoneForm({ project, row, onClose, onSaved }) {
  const id = useId()
  const [name, setName] = useState(row?.name || '')
  const [target, setTarget] = useState(row?.targetDate || '')
  const [description, setDescription] = useState(row?.description || '')
  const [complete, setComplete] = useState(Boolean(row?.achieved))
  const [actualDate, setActualDate] = useState(row?.actualDate || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const submit = async event => {
    event.preventDefault()
    if (busy || !name.trim()) return
    setBusy(true); setError('')
    try {
      const payload = { name: name.trim(), description: [description.trim(), row?.importMarker].filter(Boolean).join('\n\n'), target_date: target, is_completed: complete, completed_date: complete ? actualDate : null }
      const saved = row ? await PC.updateProjectMilestone(row.sourceId, payload) : await PC.createProjectMilestone({ ...payload, project: project.id })
      onSaved(saved)
    } catch (failure) { setError(errorMessage(failure)); setBusy(false) }
  }
  return <MilestoneDialog title={row ? 'Edit milestone' : 'Add milestone'} onClose={onClose} busy={busy} footer={<><button type="button" className="pp-button" onClick={onClose} disabled={busy}>Cancel</button><button type="submit" form={id} className="pp-button pp-primary" disabled={busy || !name.trim()}>{busy ? 'Saving…' : row ? 'Save milestone' : 'Create milestone'}</button></>}>
    <form id={id} onSubmit={submit} className="mc-form-grid">
      {error && <div className="mc-form-error" role="alert">{error}</div>}
      <label className="mc-form-wide">Milestone name<input required maxLength={255} value={name} onChange={event => setName(event.target.value)} autoFocus /></label>
      <label>Target date<input type="date" required value={target} onChange={event => setTarget(event.target.value)} /></label>
      <label className="mc-form-check"><input type="checkbox" checked={complete} onChange={event => setComplete(event.target.checked)} />Completion reported</label>
      {complete && <label>Completion date<input type="date" required max={today()} value={actualDate} onChange={event => setActualDate(event.target.value)} /></label>}
      <label className="mc-form-wide">Description<textarea rows={4} value={description} onChange={event => setDescription(event.target.value)} /></label>
      <p className="mc-note mc-form-wide">This saves a project milestone target. Approved schedule baselines and evidence acceptance are managed separately.</p>
    </form>
  </MilestoneDialog>
}

export function MilestoneImport({ project, candidates = [], onClose, onSaved, onOpenSchedule }) {
  const [selected, setSelected] = useState(new Set())
  const [imported, setImported] = useState(new Set())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const close = () => onClose(imported.size > 0)
  const eligible = row => row.canImport && !row.alreadyImported && !imported.has(row.id) && Boolean(row.importTargetDate || row.targetDate) && Boolean(row.importMarker)
  const toggle = id => setSelected(previous => { const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next })
  const run = async () => {
    if (busy) return
    setBusy(true); setError('')
    let completed = 0
    try {
      // Refresh markers immediately before importing; retries skip rows already saved.
      const current = []
      for (let page = 1; page <= 100; page += 1) {
        const response = await PC.listProjectMilestones(project.id, { page })
        current.push(...(Array.isArray(response) ? response : response.results || []))
        if (!response.next) break
        if (page === 100) throw new Error('The milestone register is too large to verify duplicate imports.')
      }
      for (const row of candidates.filter(item => selected.has(item.id) && eligible(item))) {
        if (!current.some(item => item.description?.includes(row.importMarker))) {
          const created = await PC.createProjectMilestone({ project: project.id, name: row.name, target_date: row.importTargetDate || row.targetDate, description: [row.description, `Target imported from schedule activity ${row.code}.`, row.importMarker].filter(Boolean).join('\n\n') })
          current.push(created); completed += 1
        }
        setImported(previous => new Set([...previous, row.id]))
        setSelected(previous => { const next = new Set(previous); next.delete(row.id); return next })
      }
      onSaved(completed)
    } catch (failure) {
      setError(`${completed ? `${completed} milestone(s) saved. ` : ''}${errorMessage(failure)} Saved rows will be skipped if you retry.`)
      setBusy(false)
    }
  }
  return <MilestoneDialog title="Import milestones from schedule" onClose={close} busy={busy} footer={<><button type="button" className="pp-button" onClick={onOpenSchedule} disabled={busy}>Open schedule</button><button type="button" className="pp-button" onClick={close} disabled={busy}>Cancel</button><button type="button" className="pp-button pp-primary" disabled={busy || !candidates.some(row => selected.has(row.id) && eligible(row))} onClick={run}>{busy ? 'Importing…' : 'Import selected'}</button></>}>
    <p className="mc-note">Select schedule milestones to add to the project register. Target dates and source links are copied; baseline approval and evidence acceptance stay with the schedule.</p>
    {error && <div className="mc-form-error" role="alert"><AlertTriangle size={16} />{error}</div>}
    {candidates.length ? <div className="mc-table-wrap" role="region" aria-label="Schedule milestone import preview" tabIndex={0}><table className="mc-table"><thead><tr><th>Select</th><th>Schedule milestone</th><th>Target date</th><th>Status</th></tr></thead><tbody>{candidates.map(row => <tr key={row.id}><td><input type="checkbox" aria-label={`Import ${row.code} ${row.name}`} disabled={busy || !eligible(row)} checked={selected.has(row.id)} onChange={() => toggle(row.id)} /></td><td>{row.code} · {row.name}</td><td>{row.importTargetDate || row.targetDate || 'Missing target'}</td><td>{row.alreadyImported || imported.has(row.id) ? 'Already imported' : eligible(row) ? 'Available' : 'Target date required'}</td></tr>)}</tbody></table></div> : <p className="mc-empty">No schedule milestones are available to import. Add milestones in the planning workspace first.</p>}
  </MilestoneDialog>
}
