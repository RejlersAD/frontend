import { useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { ChevronDownIcon } from '@heroicons/react/24/outline'

export default function EmployeeOrganizationSelect({ id, name, label, value, options, onChange, loading, error, onRetry, invalid }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const input = useRef(null)
  const matches = options.filter(option => option.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
  const show = () => { setQuery(''); setActive(0); setOpen(true) }
  const choose = option => { onChange(option); setOpen(false); setQuery('') }
  const move = index => {
    setActive(index)
    document.getElementById(`${id}-option-${index}`)?.scrollIntoView({ block: 'nearest' })
  }
  return <div className="employee-organization-select" onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) { setOpen(false); setQuery('') }
  }}>
    <div className="employee-organization-control">
      <input ref={input} id={id} name={name} role="combobox" autoComplete="off"
        aria-label={label} aria-required="true" aria-invalid={invalid || undefined}
        aria-expanded={open} aria-autocomplete="list" aria-controls={open ? `${id}-options` : undefined}
        aria-activedescendant={open && matches[active] ? `${id}-option-${active}` : undefined}
        value={open ? query : value} placeholder={loading ? 'Loading options…' : `Select ${label.toLowerCase()}`}
        disabled={loading} onFocus={show}
        onChange={event => { setQuery(event.target.value); setActive(0); setOpen(true) }}
        onKeyDown={event => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            if (!open) show()
            else if (matches.length) move((active + (event.key === 'ArrowDown' ? 1 : -1) + matches.length) % matches.length)
          } else if (event.key === 'Enter' && open) {
            event.preventDefault()
            if (matches[active]) choose(matches[active])
          } else if (event.key === 'Escape' && open) {
            event.preventDefault(); event.stopPropagation(); setOpen(false); setQuery('')
          }
        }} />
      <button type="button" aria-label={`Open ${label.toLowerCase()} options`} disabled={loading}
        onMouseDown={event => event.preventDefault()} onClick={() => { if (open) setOpen(false); else { input.current?.focus(); show() } }}><ChevronDownIcon aria-hidden="true" /></button>
    </div>
    {open && <div className="employee-organization-popup">
      <ul id={`${id}-options`} role="listbox" aria-label={`${label} options`}>
        {matches.map((option, index) => <li key={option} id={`${id}-option-${index}`} role="option"
          aria-selected={option === value} className={index === active ? 'is-active' : ''}
          onMouseDown={event => event.preventDefault()} onMouseEnter={() => setActive(index)} onClick={() => choose(option)}>{option}</li>)}
      </ul>
      {!matches.length && <p role="status">{error || 'No matching options.'}</p>}
    </div>}
    {error && <p className="employee-create-error" role="status">{error}<button type="button" className="employee-create-link" onClick={onRetry}>Retry</button></p>}
  </div>
}

EmployeeOrganizationSelect.propTypes = {
  id: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
  options: PropTypes.arrayOf(PropTypes.string).isRequired,
  onChange: PropTypes.func.isRequired,
  loading: PropTypes.bool,
  error: PropTypes.string,
  onRetry: PropTypes.func.isRequired,
  invalid: PropTypes.bool,
}
