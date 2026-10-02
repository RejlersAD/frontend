import { useEffect, useId, useState } from 'react'
import PropTypes from 'prop-types'
import { findSharedRecordCandidates, findSharedTargets, sharedRecordError } from '../../../services/sharedRecords.service'

const labels = { client: 'Client', project: 'Project', employee: 'Employee' }
const title = item => [item.code, item.label].filter(Boolean).join(' · ')

export default function SharedRecordTargetSelector({ kind, sourceType, sourceId, projectId, value, onChange, disabled = false }) {
  const id = useId()
  const [search, setSearch] = useState(''), [term, setTerm] = useState(''), [revision, setRevision] = useState(0)
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [data, setData] = useState(null)
  const label = labels[kind] || kind
  useEffect(() => {
    const timer = window.setTimeout(() => setTerm(search.trim()), 250)
    return () => window.clearTimeout(timer)
  }, [search])
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setError(''); setData(null)
    const request = sourceType && sourceId
      ? findSharedRecordCandidates(sourceType, sourceId, { kind, search: term }, { signal: controller.signal })
      : findSharedTargets({ kind, search: term, ...(projectId ? { project_id: projectId } : {}) }, { signal: controller.signal })
    request.then(result => { if (!controller.signal.aborted) setData(result) })
      .catch(failure => { if (!controller.signal.aborted) setError(sharedRecordError(failure, `${label} records could not be loaded.`)) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [sourceType, sourceId, projectId, kind, term, label, revision])
  const results = data?.results || []
  const options = value && !results.some(item => String(item.id) === String(value.id)) ? [value, ...results] : results
  const pending = loading || search.trim() !== term
  return <fieldset className="shared-target" disabled={disabled}>
    <legend>{label}</legend>
    <label htmlFor={`${id}-search`}>Search {label.toLowerCase()} records</label>
    <input id={`${id}-search`} type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Name or code" />
    <label htmlFor={`${id}-choice`}>Selected {label.toLowerCase()}</label>
    <select id={`${id}-choice`} value={value?.id ?? ''} disabled={disabled || pending || Boolean(error)} onChange={event => onChange(options.find(item => String(item.id) === event.target.value) || null)}>
      <option value="">Choose a {label.toLowerCase()}</option>
      {options.map(item => <option key={item.id} value={item.id}>{title(item)}</option>)}
    </select>
    {pending ? <p role="status">Loading {label.toLowerCase()} records…</p>
      : error ? <div role="alert"><p>{error}</p><button type="button" onClick={() => setRevision(current => current + 1)}>Retry {label.toLowerCase()} search</button></div>
        : <p>{data?.has_more ? 'More matches available. Narrow your search.' : results.length ? `${results.length} matching ${results.length === 1 ? 'record' : 'records'}. Choose after review.` : 'No matching records. Try another name or code.'}</p>}
  </fieldset>
}

SharedRecordTargetSelector.propTypes = {
  kind: PropTypes.string.isRequired, sourceType: PropTypes.string, sourceId: PropTypes.string,
  projectId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  value: PropTypes.object, onChange: PropTypes.func.isRequired, disabled: PropTypes.bool,
}
