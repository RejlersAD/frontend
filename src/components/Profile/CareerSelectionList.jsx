import React, { useId, useState } from 'react'
import PropTypes from 'prop-types'
import { Plus, X, Star } from 'lucide-react'

function ProficiencyStars({ label, value, onChange }) {
  const name = useId()
  return <div className="career-stars" role="radiogroup" aria-label={label}>
    {[1, 2, 3, 4, 5].map(rating => <label key={rating} title={`${rating} of 5 stars`}>
      <input className="sr-only" type="radio" name={name} aria-label={`${rating} ${rating === 1 ? 'star' : 'stars'}`}
        checked={Number(value) === rating} onChange={() => onChange(rating)} />
      <Star aria-hidden="true" className={rating <= Number(value) ? 'is-filled' : ''} />
    </label>)}
  </div>
}
ProficiencyStars.propTypes = { label: PropTypes.string.isRequired, value: PropTypes.number, onChange: PropTypes.func.isRequired }

export default function CareerSelectionList({ label, options, selected, onAdd, onRemove, onProficiency }) {
  const id = useId()
  const [custom, setCustom] = useState('')
  const [proficiency, setProficiency] = useState(3)
  const names = selected.map(item => typeof item === 'string' ? item : item.name)
  const available = options.filter(option => !names.some(name => name.toLowerCase() === option.toLowerCase()))
  const add = name => {
    const normalized = name.trim().replace(/\s+/g, ' ')
    if (!normalized || names.some(item => item.toLowerCase() === normalized.toLowerCase())) return
    onAdd(normalized, proficiency)
    setCustom('')
  }
  return <div className="career-selection">
    <label className="sr-only" htmlFor={id}>{label}</label>
    <div className="career-selection-controls">
      <select id={id} value="" onChange={event => add(event.target.value)}>
        <option value="">{available.length ? `Select ${label.toLowerCase()}` : 'All listed options selected'}</option>
        {available.map(option => <option key={option} value={option}>{option}</option>)}
      </select>
      {onProficiency && <ProficiencyStars label="New skill proficiency" value={proficiency} onChange={setProficiency} />}
    </div>
    <div className="career-selected-heading">Selected ({selected.length})</div>
    {selected.length ? <ul className="career-selected-list">{selected.map(item => {
      const name = typeof item === 'string' ? item : item.name
      return <li key={name}><span>{name}</span>
        {onProficiency && <ProficiencyStars label={`${name} proficiency`} value={Number(item.proficiency)} onChange={rating => onProficiency(name, rating)} />}
        <button type="button" aria-label={`Remove ${name}`} onClick={() => onRemove(name)}><X /></button>
      </li>
    })}</ul> : <p className="career-selection-empty">No selections yet. Choose an option above.</p>}
    <details className="career-custom"><summary>Add an option not listed</summary><div>
      <input aria-label={`Custom ${label.toLowerCase()}`} maxLength={100} value={custom} onChange={event => setCustom(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); add(custom) } }} placeholder="Enter a name" />
      <button type="button" onClick={() => add(custom)} disabled={!custom.trim() || names.some(name => name.toLowerCase() === custom.trim().toLowerCase())}><Plus /> Add</button>
    </div></details>
  </div>
}
CareerSelectionList.propTypes = { label: PropTypes.string.isRequired, options: PropTypes.array.isRequired, selected: PropTypes.array.isRequired, onAdd: PropTypes.func.isRequired, onRemove: PropTypes.func.isRequired, onProficiency: PropTypes.func }
