import React, { useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import { GitBranch, Plus, Trash2 } from 'lucide-react'
import { Dialog } from './WorkBreakdownPanel'
import { scheduleDependencyEntries } from '../../utils/primaveraDependencies'

const TYPES = { FS: 'Finish to start', SS: 'Start to start', FF: 'Finish to finish', SF: 'Start to finish' }
const key = value => String(value)
const label = task => [task.activity_code || task.external_id, task.title].filter(Boolean).join(' · ')
const signature = links => JSON.stringify(links.map(link => [link.predecessor, link.successor, link.type,
  link.lag_days === '' ? '' : Number(link.lag_days)]).sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))))

export default function GanttLogicDialog({ task, tasks, sourceOnly, busy, saveError, onSave, onClose }) {
  const [direction, setDirection] = useState('predecessors')
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const taskMap = useMemo(() => new Map(tasks.map(row => [key(row.id), row])), [tasks])
  const allLinks = useMemo(() => tasks.flatMap(successor => scheduleDependencyEntries(successor, { sourceOnly }).map((entry, index) => ({
    id: `${successor.id}:${entry.predecessorId}:${index}`, predecessor: entry.predecessorId, successor: key(successor.id),
    type: entry.type, lag_days: entry.lagValue ?? (sourceOnly ? '' : 0), detail: entry.detail,
  }))), [tasks, sourceOnly])
  const [links, setLinks] = useState(() => allLinks.filter(link => link.predecessor === key(task.id) || link.successor === key(task.id)))
  const incoming = direction === 'predecessors'
  const visible = links.filter(link => (incoming ? link.successor : link.predecessor) === key(task.id))
  const query = search.trim().toLowerCase()
  const results = query ? tasks.filter(row => key(row.id) !== key(task.id) && label(row).toLowerCase().includes(query)).slice(0, 30) : []
  const change = (id, field, value) => { setLinks(current => current.map(link => link.id === id ? { ...link, [field]: value } : link)); setError('') }
  const add = row => {
    const predecessor = key(incoming ? row.id : task.id), successor = key(incoming ? task.id : row.id)
    if (links.some(link => link.predecessor === predecessor && link.successor === successor && link.type === 'FS')) {
      setError('This finish-to-start relationship already exists. Edit its type or lag below.'); return
    }
    setLinks(current => [...current, { id: crypto.randomUUID(), predecessor, successor, type: 'FS', lag_days: 0, detail: {} }])
    setSearch(''); setError('')
  }
  const save = async event => {
    event.preventDefault()
    if (busy) return
    if (signature(links) === signature(allLinks.filter(link => link.predecessor === key(task.id) || link.successor === key(task.id)))) { onClose(); return }
    if (links.some(link => !TYPES[link.type])) { setError('Choose a relationship type for every link.'); return }
    if (links.some(link => link.lag_days === '' || !Number.isFinite(Number(link.lag_days)) || Math.abs(Number(link.lag_days)) > 365)) {
      setError('Enter a lag between -365 and 365 working days for every link.'); return
    }
    if (new Set(links.map(link => `${link.predecessor}:${link.successor}:${link.type}`)).size !== links.length) {
      setError('The same activity pair cannot repeat a relationship type.'); return
    }
    const merged = [...allLinks.filter(link => link.predecessor !== key(task.id) && link.successor !== key(task.id)), ...links]
    const graph = new Map(tasks.map(row => [key(row.id), []]))
    for (const link of merged) graph.get(link.successor)?.push(link.predecessor)
    const active = new Set(), visited = new Set()
    const cycle = id => {
      if (active.has(id)) return true
      if (visited.has(id)) return false
      active.add(id)
      if ((graph.get(id) || []).some(cycle)) return true
      active.delete(id); visited.add(id); return false
    }
    if ([...graph.keys()].some(cycle)) { setError('These relationships create a circular sequence. Remove or reverse the conflicting link.'); return }
    const affected = new Set([...allLinks, ...links].filter(link => link.predecessor === key(task.id) || link.successor === key(task.id)).map(link => link.successor))
    affected.add(key(task.id))
    const nextTasks = tasks.map(row => {
      if (!affected.has(key(row.id))) return row
      const predecessors = merged.filter(link => link.successor === key(row.id))
      if (signature(predecessors) === signature(allLinks.filter(link => link.successor === key(row.id)))) return row
      return { ...row, depends_on: [...new Set(predecessors.map(link => taskMap.get(link.predecessor)?.id || link.predecessor))],
        dependency_details: predecessors.map(link => ({ ...link.detail, task_id: taskMap.get(link.predecessor)?.id || link.predecessor,
          type: link.type, lag_days: Number(link.lag_days) })) }
    })
    if (await onSave(nextTasks)) onClose()
  }
  return <Dialog title="Activity logic" busy={busy} onClose={onClose} footer={<>
    <button type="button" className="wbd-button" disabled={busy} onClick={onClose}>Cancel</button>
    <button type="submit" form="p6-logic-form" className="wbd-button wbd-primary" disabled={busy}>{busy ? 'Saving…' : 'Save logic'}</button>
  </>}>
    <form id="p6-logic-form" className="p6-logic-form" onSubmit={save}>
      <p className="p6-logic-activity"><GitBranch size={16} />{label(task)}</p>
      <p className="wbd-note">Positive lag adds waiting time; negative lag allows overlap. All lags use working days.</p>
      {(error || saveError) && <p className="wbd-error" role="alert">{error || saveError}</p>}
      <fieldset disabled={busy}>
        <div role="group" aria-label="Relationship direction" className="p6-logic-directions">
          {['predecessors', 'successors'].map(value => <button key={value} type="button" aria-pressed={direction === value}
            onClick={() => { setDirection(value); setSearch(''); setError('') }}>{value === 'predecessors' ? 'Predecessors' : 'Successors'}</button>)}
        </div>
        <label className="p6-logic-search">{incoming ? 'Add predecessor' : 'Add successor'}
          <input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search activity name or ID" />
        </label>
        {query && <div className="p6-logic-results" aria-label="Matching activities">
          {results.map(row => <button key={row.id} type="button" onClick={() => add(row)} aria-label={`Add ${incoming ? 'predecessor' : 'successor'} ${label(row)}`}><Plus size={14} />{label(row)}</button>)}
          {!results.length && <p>No matching activities.</p>}
        </div>}
        <div className="p6-logic-table"><table><thead><tr><th>{incoming ? 'Predecessor' : 'Successor'}</th><th>Relationship</th><th>Lag (days)</th><th><span className="sr-only">Action</span></th></tr></thead><tbody>
          {visible.map(link => {
            const related = taskMap.get(incoming ? link.predecessor : link.successor)
            const name = related ? label(related) : incoming ? link.predecessor : link.successor
            return <tr key={link.id}><td title={name}>{name}</td><td>
              <select aria-label={`Relationship type for ${name}`} value={link.type} onChange={event => change(link.id, 'type', event.target.value)}>
                <option value="" disabled>Choose type</option>{Object.entries(TYPES).map(([value, text]) => <option key={value} value={value}>{value} — {text}</option>)}
              </select></td><td><input aria-label={`Lag for ${name}`} type="number" min="-365" max="365" step="any" value={link.lag_days} onChange={event => change(link.id, 'lag_days', event.target.value)} /></td>
              <td><button type="button" className="p6-logic-remove" aria-label={`Remove relationship with ${name}`} onClick={() => { setLinks(current => current.filter(item => item.id !== link.id)); setError('') }}><Trash2 size={15} /></button></td></tr>
          })}
          {!visible.length && <tr><td colSpan={4}>No {direction}. Search above to add a relationship.</td></tr>}
        </tbody></table></div>
      </fieldset>
    </form>
  </Dialog>
}
GanttLogicDialog.propTypes = { task: PropTypes.object.isRequired, tasks: PropTypes.array.isRequired, sourceOnly: PropTypes.bool,
  busy: PropTypes.bool, saveError: PropTypes.string, onSave: PropTypes.func.isRequired, onClose: PropTypes.func.isRequired }
