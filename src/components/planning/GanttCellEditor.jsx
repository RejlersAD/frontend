import React, { useEffect, useId, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { createPortal } from 'react-dom'

// Mounted only for the active cell: a large schedule does not need thousands
// of hidden input controls or blur handlers.
export default function GanttCellEditor({ field, title, initialValue, milestone, onSave, onClose }) {
  const [value, setValue] = useState(initialValue == null ? '' : String(initialValue))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const input = useRef(null)
  const pending = useRef(false)
  const cancelled = useRef(false)
  const errorId = useId()
  const portalHost = useRef(document.activeElement?.closest('dialog[open]') || document.body)
  const label = `${field[0].toUpperCase()}${field.slice(1)} for ${title}`
  useEffect(() => { input.current?.focus(); if (field === 'duration') input.current?.select() }, [field])
  const save = async () => {
    if (pending.current || cancelled.current) return
    if (value === (initialValue == null ? '' : String(initialValue))) { onClose(); return }
    const number = value === '' ? null : Number(value)
    if (field === 'duration' && value !== '' && (!Number.isFinite(number) || number < 0 || (milestone && number !== 0) || (!milestone && number === 0))) {
      setError(milestone ? 'Milestones must have zero duration.' : 'Enter a duration greater than zero, or leave it blank when unknown.')
      input.current?.focus()
      return
    }
    if (field !== 'duration' && value && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !input.current?.validity.valid)) {
      setError('Enter a valid date.'); input.current?.focus(); return
    }
    pending.current = true; setSaving(true); setError('')
    try {
      const saved = await onSave(field === 'duration' ? number : value || null)
      if (saved) onClose()
      else { setError('Could not save this change. Review the schedule message, then retry.'); input.current?.focus() }
    } catch (reason) { setError(reason.message || 'Could not save this change. Please retry.'); input.current?.focus() }
    finally { pending.current = false; setSaving(false) }
  }
  return <span className="p6-cell-editor" onDoubleClick={event => event.stopPropagation()}>
    <input ref={input} type={field === 'duration' ? 'number' : 'date'} min={field === 'duration' ? milestone ? 0 : 0.01 : undefined}
      max={field === 'duration' && milestone ? 0 : undefined} step={field === 'duration' ? 'any' : undefined}
      aria-label={label} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} aria-busy={saving}
      readOnly={saving} value={value} onChange={event => { setValue(event.target.value); setError('') }}
      onBlur={save} onKeyDown={event => {
        event.stopPropagation()
        if (event.key === 'Enter') { event.preventDefault(); save() }
        if (event.key === 'Escape' && !pending.current) { event.preventDefault(); cancelled.current = true; onClose() }
      }} />
    {error && createPortal(<span id={errorId} role="alert" className="p6-cell-error">{error}</span>, portalHost.current)}
  </span>
}
GanttCellEditor.propTypes = { field: PropTypes.string.isRequired, title: PropTypes.string.isRequired,
  initialValue: PropTypes.oneOfType([PropTypes.number, PropTypes.string]), milestone: PropTypes.bool,
  onSave: PropTypes.func.isRequired, onClose: PropTypes.func.isRequired }
