import React, { useEffect, useId, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { Check, Search, User, X } from 'lucide-react'
import planningIntelligenceService from '../../services/planningIntelligence.service'

export default function PlanningEmployeePicker({ projectId, label, value, onChange, disabled = false, autoFocus = false, legacyName = '' }) {
  const id = useId()
  const wrapper = useRef(null), input = useRef(null)
  const [query, setQuery] = useState(value?.name || '')
  const [open, setOpen] = useState(false)
  const [options, setOptions] = useState([])
  const [activeIndex, setActiveIndex] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  useEffect(() => { if (value) setQuery(value.name) }, [value])
  useEffect(() => { if (autoFocus) input.current?.focus() }, [autoFocus])
  useEffect(() => {
    input.current?.setCustomValidity(query.trim() && (!value || query !== value.name) ? 'Select an employee from the search results, or clear the search to leave this unassigned.' : '')
  }, [query, value])
  useEffect(() => {
    if (!open || disabled) return undefined
    const controller = new AbortController()
    setLoading(true); setError(''); setOptions([])
    const timer = window.setTimeout(async () => {
      try {
        const data = await planningIntelligenceService.listEligibleEmployees(projectId, value && query === value.name ? '' : query.trim(), controller.signal)
        if (!controller.signal.aborted) {
          if (!Array.isArray(data.results)) throw new Error('Employee search is unavailable.')
          setOptions(data.results); setActiveIndex(0)
        }
      } catch (reason) { if (!controller.signal.aborted) setError(reason?.response?.data?.detail || 'Employee search is unavailable. Please retry.') }
      finally { if (!controller.signal.aborted) setLoading(false) }
    }, 250)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [projectId, query, value, open, disabled, revision])
  useEffect(() => { if (open && options[activeIndex]) document.getElementById(`${id}-option-${activeIndex}`)?.scrollIntoView({ block: 'nearest' }) }, [open, options, activeIndex, id])
  const select = employee => { onChange(employee); setQuery(employee.name); setOpen(false) }
  const keyDown = event => {
    if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); setOpen(false) }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault(); setOpen(true)
      setActiveIndex(index => event.key === 'ArrowDown' ? Math.min(index + 1, Math.max(options.length - 1, 0)) : Math.max(index - 1, 0))
    }
    if (event.key === 'Enter' && open) { event.preventDefault(); if (options[activeIndex]) select(options[activeIndex]) }
  }
  return <div ref={wrapper} className="wbd-employee-picker" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false) }}>
    <label htmlFor={id}>{label}</label>
    <div className="wbd-employee-input"><Search size={15} aria-hidden="true" /><input ref={input} id={id} role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={open ? `${id}-results` : undefined} aria-activedescendant={open && options[activeIndex] ? `${id}-option-${activeIndex}` : undefined}
      autoComplete="off" disabled={disabled} value={query} placeholder="Search name or employee code" onFocus={() => setOpen(true)} onClick={() => setOpen(true)} onKeyDown={keyDown}
      onChange={event => { setQuery(event.target.value); if (value) onChange(null); setOpen(true) }} />
      {(query || value || legacyName) && <button type="button" disabled={disabled} className="wbd-picker-clear" aria-label={`Clear ${label.toLowerCase()}`} onClick={() => { onChange(null); setQuery(''); input.current?.focus() }}><X size={15} /></button>}
    </div>
    {open && <div className="wbd-employee-results"><div id={`${id}-results`} role="listbox" aria-label={`${label} employees`}>
      {options.map((employee, index) => <button key={employee.user_id} id={`${id}-option-${index}`} type="button" role="option" aria-selected={String(value?.user_id) === String(employee.user_id)} tabIndex={-1} className={activeIndex === index ? 'is-active' : ''} onMouseDown={event => event.preventDefault()} onMouseMove={() => setActiveIndex(index)} onClick={() => select(employee)}>
        <span className="wbd-person-avatar" aria-hidden="true">{employee.name.split(/\s+/).filter(Boolean).slice(0, 2).map(name => name[0]).join('').toUpperCase()}</span><span><strong>{employee.name}</strong><small>{[employee.employee_code, employee.job_title || employee.department].filter(Boolean).join(' · ')}</small></span>{String(value?.user_id) === String(employee.user_id) && <Check size={15} />}
      </button>)}
    </div><p role="status">{loading ? 'Searching employees…' : error ? <>{error} <button type="button" onClick={() => setRevision(current => current + 1)}>Retry employee search</button></> : !options.length ? 'No active RADAI employees match your search.' : 'Select an employee to assign this work.'}</p></div>}
    {!open && value && <small className="wbd-employee-selected"><User size={12} />{[value.employee_code, value.job_title || value.department].filter(Boolean).join(' · ') || 'RADAI employee selected'}</small>}
    {!value && legacyName && <small className="wbd-legacy-owner">Previous name: {legacyName}. Select a RADAI employee to assign this work.</small>}
  </div>
}
PlanningEmployeePicker.propTypes = { projectId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired, label: PropTypes.string.isRequired, value: PropTypes.object, onChange: PropTypes.func.isRequired, disabled: PropTypes.bool, autoFocus: PropTypes.bool, legacyName: PropTypes.string }
