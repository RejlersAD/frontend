import { useState } from 'react'
import PropTypes from 'prop-types'

export default function PlanningDelayActivityPicker({ activities, value, onChange, disabled, title = 'Affected activities', multiple = true }) {
  const [search, setSearch] = useState(''), [page, setPage] = useState(0)
  const matching = activities.filter(row => `${row.external_id} ${row.name}`.toLowerCase().includes(search.trim().toLowerCase()))
  const selected = multiple ? value || [] : value == null || value === '' ? [] : [value]
  const selectedRows = activities.filter(row => selected.some(id => String(id) === String(row.id)))
  return <fieldset className="pda-picker" disabled={disabled}><legend>{title}</legend><label>Search activities<input aria-label={`Search ${title}`} value={search} onChange={event => { setSearch(event.target.value); setPage(0) }} /></label>
    {multiple ? <><div className="pda-pick-list">{matching.slice(page * 20, (page + 1) * 20).map(row => <label className="poc-check" key={row.id}><input type="checkbox" checked={selected.some(id => String(id) === String(row.id))} onChange={event => onChange(event.target.checked ? [...selected, row.id] : selected.filter(id => String(id) !== String(row.id)))} />{row.external_id} · {row.name}</label>)}</div><div className="poc-pagination"><span>{selected.length} selected · {matching.length} matching</span><button type="button" disabled={disabled || page === 0} aria-label={`Previous ${title}`} onClick={() => setPage(page - 1)}>Previous</button><button type="button" disabled={disabled || (page + 1) * 20 >= matching.length} aria-label={`Next ${title}`} onClick={() => setPage(page + 1)}>Next</button></div></> : <select aria-label={title} required value={value ?? ''} onChange={event => onChange(event.target.value ? activities.find(row => String(row.id) === event.target.value)?.id ?? event.target.value : '')}><option value="">Select exact activity</option>{[...selectedRows, ...matching.filter(row => !selectedRows.some(selected => selected.id === row.id))].map(row => <option key={row.id} value={row.id}>{row.external_id} · {row.name}</option>)}</select>}
  </fieldset>
}
PlanningDelayActivityPicker.propTypes = { activities: PropTypes.array.isRequired, value: PropTypes.any, onChange: PropTypes.func.isRequired, disabled: PropTypes.bool, title: PropTypes.string, multiple: PropTypes.bool }
