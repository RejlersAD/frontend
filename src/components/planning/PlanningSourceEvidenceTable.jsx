import { Fragment, useId, useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import { ChevronDown, ChevronLeft, ChevronRight, FileText, Search, X } from 'lucide-react'
import { ActivityDurationEvidence } from './PlanningDurationEvidence'
import {
  durationEvidenceLabel, durationEvidenceStatus, durationReferences, durationUnit, durationUnitLabel, missingSourceDuration, sourceReferenceLabel,
} from '../../utils/planningDurationEvidence'
import './PlanningSourceEvidenceTable.css'

const list = value => Array.isArray(value) ? value : []
const text = value => typeof value === 'string' || typeof value === 'number' ? String(value) : ''
const known = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value))
const sourceTone = status => ['source_document', 'source_backed', 'source_verified'].includes(status) ? 'verified'
  : ['missing', 'missing_source', 'source_requirement', 'requirement_needs_review'].includes(status) ? 'warning' : 'neutral'
const compactStatus = (task, row) => {
  const status = durationEvidenceStatus(task, row)
  if (['source_requirement', 'requirement_needs_review'].includes(status)) return 'Requirement to review'
  if (['retained_manual', 'planner', 'manual', 'manual_unverified'].includes(status)) return 'Planner duration'
  if (status === 'started_unverified') return 'Started / unverified'
  return durationEvidenceLabel(task, row)
}

function SourceReferences({ sources }) {
  if (!sources.length) return <p className="pse-unavailable">Not Specified</p>
  return <ul className="pse-full-sources">{sources.map((source, index) => <li key={index}>
    <span><FileText size={13} aria-hidden="true" />{sourceReferenceLabel(source)}</span>
    {typeof source === 'object' && source?.excerpt && <blockquote>{source.excerpt}</blockquote>}
  </li>)}</ul>
}
SourceReferences.propTypes = { sources: PropTypes.array.isRequired }

export default function PlanningSourceEvidenceTable({ tasks = [], review, sourceDocuments = [] }) {
  const instanceId = useId()
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(25)
  const [expanded, setExpanded] = useState(() => new Set())
  const rows = useMemo(() => {
    const reviewRows = new Map(list(review?.rows).map(row => [String(row.task_id), row]))
    const documents = new Map(list(sourceDocuments).filter(document => document?.id != null).map(document => [String(document.id), document]))
    const resolve = source => {
      if (!source || typeof source !== 'object' || source.filename || source.source_filename) return source
      const document = documents.get(String(source.file_id ?? source.source_file_id ?? source.source_file))
      const filename = document?.name || document?.original_filename || document?.filename
      return filename ? { ...source, filename } : source
    }
    return list(tasks).filter(task => review || list(task.source_references).length || list(durationReferences(task)).length).map((task, position) => {
      const durationRow = reviewRows.get(String(task.id))
      const sources = list(task.source_references).map(resolve)
      const durationSources = list(durationReferences(task, durationRow)).map(resolve)
      const allSources = [...sources, ...durationSources]
      const sourceLabels = [...new Set(allSources.map(sourceReferenceLabel))]
      const title = task.title || 'Untitled activity'
      const code = text(task.activity_code || task.external_id || task.document_number || task.code)
      const label = durationEvidenceLabel(task, durationRow)
      const resolvedRow = durationRow ? { ...durationRow, source_references: durationSources } : { source_references: durationSources }
      return {
        task, title, code, sources, durationRow: resolvedRow, sourceLabels,
        key: String(task.id ?? `row-${position}`), label,
        status: compactStatus(task, durationRow), tone: sourceTone(durationEvidenceStatus(task, durationRow)),
        searchable: [title, code, label, durationRow?.reason, task.duration_review_reason,
          ...sourceLabels, ...allSources.map(source => typeof source === 'object' ? source?.excerpt : ''),
        ].filter(Boolean).join(' ').toLocaleLowerCase(),
      }
    })
  }, [tasks, review, sourceDocuments])
  const search = query.trim().toLocaleLowerCase()
  const filtered = useMemo(() => search ? rows.filter(row => row.searchable.includes(search)) : rows, [rows, search])
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, pageCount - 1)
  const first = currentPage * pageSize
  const visible = filtered.slice(first, first + pageSize)
  const toggle = key => setExpanded(previous => {
    const next = new Set(previous)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    return next
  })

  return <section className="planning-source-evidence" aria-label="Activity source evidence">
    <header className="pse-toolbar">
      <div className="pse-heading"><h4>Activity source evidence</h4><span>{rows.length.toLocaleString()} {rows.length === 1 ? 'activity' : 'activities'}</span></div>
      <div className="pse-search"><Search size={14} aria-hidden="true" /><label className="pse-sr-only" htmlFor={`${instanceId}-search`}>Search source evidence</label><input id={`${instanceId}-search`} type="search" value={query} placeholder="Search deliverable or source" onChange={event => { setQuery(event.target.value); setPage(0) }} />{query && <button type="button" aria-label="Clear source evidence search" onClick={() => { setQuery(''); setPage(0) }}><X size={13} aria-hidden="true" /></button>}</div>
    </header>
    <div className="pse-table-scroll" tabIndex={0} role="region" aria-label="Source evidence rows">
      <table className="pse-table" data-table-typography="preserve" aria-label="Activity source evidence">
        <thead><tr><th scope="col">Deliverable</th><th scope="col">Source reference</th><th scope="col">Duration evidence</th></tr></thead>
        <tbody>{visible.map((row, index) => {
          const open = expanded.has(row.key)
          const detailsId = `${instanceId}-details-${first + index}`
          const duration = !missingSourceDuration(row.task) && known(row.task.duration_days) ? Number(row.task.duration_days).toLocaleString('en-GB', { maximumFractionDigits: 2 }) : null
          const unit = durationUnit(row.task)
          return <Fragment key={row.key}>
            <tr className={`pse-row${open ? ' is-expanded' : ''}`}>
              <td><button type="button" className="pse-disclosure" aria-label={`${open ? 'Hide' : 'Show'} evidence for ${row.title}`} aria-expanded={open} aria-controls={open ? detailsId : undefined} title={row.title} onClick={() => toggle(row.key)}><ChevronDown size={14} aria-hidden="true" /><span>{row.code && <small>{row.code}</small>}<strong>{row.title}</strong></span></button></td>
              <td><div className="pse-reference" title={row.sourceLabels.join('\n') || 'Not Specified'}><FileText size={13} aria-hidden="true" /><span>{row.sourceLabels[0] || 'Not Specified'}</span>{row.sourceLabels.length > 1 && <small>+{row.sourceLabels.length - 1}</small>}</div></td>
              <td><span className={`pse-status pse-${row.tone}`} title={row.label}>{row.status}</span>{duration !== null && <small className="pse-duration-value" title={`${duration} ${durationUnitLabel(row.task)}`}>{duration} {unit === 'hours' ? 'h' : unit === 'weeks' ? 'weeks' : unit === 'months' ? 'months' : 'd'}</small>}</td>
            </tr>
            {open && <tr className="pse-detail-row"><td colSpan={3}><div id={detailsId} className="pse-details" role="region" aria-label={`Evidence for ${row.title}`}><h5>{row.title}</h5><div className="pse-details-grid"><section aria-label="Deliverable source references"><h6>Source references</h6><SourceReferences sources={row.sources} /></section><section aria-label="Full duration evidence"><h6>Duration evidence</h6><ActivityDurationEvidence task={row.task} row={row.durationRow} /></section></div></div></td></tr>}
          </Fragment>
        })}{!visible.length && <tr><td colSpan={3} className="pse-empty">{rows.length ? 'No evidence matches your search.' : 'No document source references. Activities may be created directly from project scope.'}</td></tr>}</tbody>
      </table>
    </div>
    <footer className="pse-footer"><span aria-live="polite">{filtered.length ? `${first + 1}-${Math.min(first + pageSize, filtered.length)} of ${filtered.length.toLocaleString()}` : '0 activities'}{search && rows.length !== filtered.length ? ` (${rows.length.toLocaleString()} total)` : ''}</span><label htmlFor={`${instanceId}-page-size`}>Rows per page<select id={`${instanceId}-page-size`} aria-label="Evidence rows per page" value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPage(0) }}>{[10, 25, 50].map(size => <option key={size} value={size}>{size}</option>)}</select></label><nav aria-label="Source evidence pagination"><button type="button" aria-label="Previous evidence page" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}><ChevronLeft size={15} aria-hidden="true" /></button><span>Page {currentPage + 1} of {pageCount}</span><button type="button" aria-label="Next evidence page" disabled={currentPage >= pageCount - 1} onClick={() => setPage(currentPage + 1)}><ChevronRight size={15} aria-hidden="true" /></button></nav></footer>
  </section>
}

PlanningSourceEvidenceTable.propTypes = { tasks: PropTypes.array, review: PropTypes.object, sourceDocuments: PropTypes.array }
