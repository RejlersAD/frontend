import React, { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import PropTypes from 'prop-types'
import { AlertTriangle, CalendarDays, CheckCircle2, FileText, GitBranch, X } from 'lucide-react'
import { scheduleDate, scheduleNumber } from '../../utils/primaveraSchedule'
import './PlanningSourceVerification.css'

const readable = value => typeof value === 'string' ? value : value?.message || value?.description || ''
const sourceLabel = source => {
  if (typeof source === 'string') return source
  const locator = source?.locator || source?.source_locator || {}
  return [source?.filename || source?.source_filename || (source?.file_id != null ? `Source ${source.file_id}` : null),
    locator.sheet, locator.page != null ? `Page ${locator.page}` : null,
    locator.row != null ? `Row ${locator.row}` : locator.line != null ? `Line ${locator.line}` : null,
    locator.register_item != null ? `Register item ${locator.register_item}` : null,
  ].filter(Boolean).join(' · ')
}

function References({ sources }) {
  return <div className="psv-references">{sources.map((source, index) => <div key={index}>
    <small><FileText size={12} aria-hidden="true" />{sourceLabel(source) || 'Source reference unavailable'}</small>
    {source?.excerpt && <blockquote>{source.excerpt}</blockquote>}
  </div>)}</div>
}
References.propTypes = { sources: PropTypes.array.isRequired }

function SourceFiles({ files, empty }) {
  return files.length ? <ul className="psv-files">{files.map((file, index) => <li key={file.id ?? index}><FileText size={14} aria-hidden="true" /><span>{file.name || file.original_filename || 'Unnamed source'}{file.parse_status && <small>{file.parse_status}</small>}</span></li>)}</ul> : <p className="psv-muted">{empty}</p>
}
SourceFiles.propTypes = { files: PropTypes.array.isRequired, empty: PropTypes.string.isRequired }

export default function PlanningSourceVerification({ plan, onClose, onInputs }) {
  const dialogRef = useRef(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  const id = useId()
  const verification = plan.source_verification
  const register = verification?.document_register || {}
  const timing = verification?.timing || {}
  const calendar = verification?.calendar || {}
  const reference = verification?.schedule_reference || {}
  const requirements = verification?.source_requirements || []
  const summary = plan.project_summary || {}
  const exactRegister = register.status === 'matched'
  const registerStatus = { matched: 'Exact register match', mismatch: 'Differences found', incomplete: 'Comparison incomplete', missing: 'No register available' }[register.status] || 'Not available'
  const mismatches = [
    ...(register.missing || []).map(row => ({ ...row, difference: 'Missing from plan', expected_title: row.title, expected_discipline: row.discipline, expected_source_references: row.source_references, actual_title: null, actual_discipline: null })),
    ...(register.changed || []).map(row => ({ ...row, difference: 'Changed', actual_title: row.actual_title || row.title, actual_discipline: row.discipline })),
    ...(register.extra || []).map(row => ({ ...row, difference: 'No source match', expected_title: null, expected_discipline: null, actual_title: row.title, actual_discipline: row.discipline })),
  ]
  useEffect(() => {
    const trigger = document.activeElement
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
    return () => { dialog?.close(); if (trigger?.isConnected) trigger.focus() }
  }, [])

  return createPortal(<dialog ref={dialogRef} className="psv-dialog" aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`} onCancel={event => { event.preventDefault(); closeRef.current() }}>
    <header className="psv-header"><div><h2 id={`${id}-title`}>Source verification</h2><p id={`${id}-description`}>Compare this plan with its saved source documents.</p></div><button type="button" className="psv-close" aria-label="Close source verification" onClick={onClose}><X size={20} /></button></header>
    <div className="psv-content" tabIndex={0} role="region" aria-label="Source comparison details">
      {!verification ? <p className="psv-notice"><AlertTriangle size={18} aria-hidden="true" />Source verification is not available for this plan.</p> : <>
        <div className="psv-top-grid">
          <section className="psv-card" aria-label="Document register comparison"><header><h3>Document register</h3><span className={`psv-badge ${exactRegister ? 'is-matched' : 'is-unverified'}`}>{exactRegister ? <CheckCircle2 size={14} aria-hidden="true" /> : <AlertTriangle size={14} aria-hidden="true" />}{registerStatus}</span></header>
            <p className="psv-register-count"><strong>{scheduleNumber(register.matched_count)}</strong> of {scheduleNumber(register.expected_count)} parsed rows match</p>
            <p>{register.comparison || 'Exact titles and disciplines are compared with the parsed register rows.'}</p>
            {exactRegister && <p className="psv-muted">This confirms register content only. Schedule dates, logic and calendars are checked separately.</p>}
            <SourceFiles files={register.files || []} empty="No MDR or EDDR source is available." />
            {!!register.unparsed_files?.length && <div className="psv-file-issue"><strong>Files awaiting parsing</strong><SourceFiles files={register.unparsed_files} empty="" /></div>}
            {!!register.unrecognized_files?.length && <div className="psv-file-issue"><strong>Register rows not recognized</strong><SourceFiles files={register.unrecognized_files} empty="" /></div>}
          </section>
          <section className="psv-card" aria-label="Current calculated summary"><header><h3><CalendarDays size={16} aria-hidden="true" />Current calculated summary</h3><span className="psv-badge">Current plan</span></header>
            <dl className="psv-summary"><div><dt>Start</dt><dd>{scheduleDate(summary.planned_start_date)}</dd></div><div><dt>Finish</dt><dd>{scheduleDate(summary.planned_finish_date)}</dd></div><div><dt>Calendar span</dt><dd>{scheduleNumber(summary.duration_days)} <small>working days</small></dd></div><div><dt>Original schedule duration</dt><dd>Not verified</dd></div></dl>
            <p className="psv-muted">The current span uses this plan’s activity dates and calendar. It does not establish the original schedule duration.</p>
            {summary.complete === false && <p className="psv-file-issue">Some activity dates are missing from the current summary.</p>}
          </section>
        </div>

        {(reference.printed_schedules || []).filter(source => source.project_summary).map(source => <section key={source.id} className="psv-card" aria-label={`Printed schedule summary: ${source.name}`}>
          <header><h3><FileText size={16} aria-hidden="true" />{source.name}</h3><span className="psv-badge">Printed source values</span></header>
          <dl className="psv-summary"><div><dt>Source start</dt><dd>{scheduleDate(source.project_summary.planned_start_date)}</dd></div><div><dt>Source finish</dt><dd>{scheduleDate(source.project_summary.planned_finish_date)}</dd></div><div><dt>Original duration</dt><dd>{scheduleNumber(source.project_summary.original_duration_days)} <small>days as printed</small></dd></div><div><dt>Source activities</dt><dd>{scheduleNumber(source.activity_count)}</dd></div></dl>
          <References sources={[{ filename: source.name, source_locator: source.project_summary.source_locator }]} />
          <p className="psv-muted">These values are read from the saved document. They have not replaced the draft’s dates. The original working calendar and predecessor network remain unverified.</p>
          {source.status === 'partial' && <p className="psv-file-issue">Some printed rows could not be interpreted completely. Unknown values remain unset.</p>}
        </section>)}

        <section className="psv-card psv-schedule-check" aria-label="Schedule source checks"><header><h3>Schedule dates, logic and calendar</h3><span className="psv-badge is-unverified">{verification.status === 'unverified' ? 'Schedule unverified' : 'Source comparison'}</span></header>
          <div className="psv-check-grid"><div><h4>Original reference schedule</h4><strong>{reference.status === 'not_imported' ? 'Uploaded; not imported' : reference.status === 'missing' ? 'Not available' : 'Not verified'}</strong><SourceFiles files={reference.files || []} empty="No original reference schedule is uploaded." />{reference.blocker?.message && <p className="psv-muted">{reference.blocker.message}</p>}</div>
            <div><h4>Dates and predecessor logic</h4><dl className="psv-check-list"><div><dt>Dates compared with source</dt><dd>{timing.dates_verified === true ? 'Verified' : 'Not verified'}</dd></div><div><dt>Dependencies compared with source</dt><dd>{timing.dependencies_verified === true ? 'Verified' : 'Not verified'}</dd></div><div><dt>Verified source dates</dt><dd>{scheduleNumber(timing.source_date_count)}</dd></div></dl>{timing.source_date_reason && <p className="psv-muted">{timing.source_date_reason}</p>}</div>
            <div><h4>Calendar used by this plan</h4><strong>{calendar.name || 'Not available'}</strong><p>{calendar.status === 'configured_unverified' ? 'Configured calendar' : calendar.status === 'default_unverified' ? 'Default calendar' : 'Calendar configuration'} · {scheduleNumber(calendar.exception_count)} exceptions</p><p className="psv-muted">The original schedule calendar and its exceptions have not been verified.</p></div>
          </div>
          <div className="psv-proposals"><span><CalendarDays size={15} aria-hidden="true" /><strong>{scheduleNumber(timing.proposed_duration_count)}</strong> proposed durations</span><span><GitBranch size={15} aria-hidden="true" /><strong>{scheduleNumber(timing.inferred_relationship_count)}</strong> inferred predecessor links</span></div>
        </section>

        {register.status !== 'missing' && mismatches.length > 0 && <details className="psv-card psv-differences" open={mismatches.length <= 8}><summary>Rows needing review ({mismatches.length})</summary><p className="psv-muted">A missing source match refers to the parsed register rows. Unparsed documents may make this comparison incomplete.</p><div className="psv-table-scroll" tabIndex={0} role="region" aria-label="Register differences"><table><thead><tr><th>Difference</th><th>Source register</th><th>Current plan</th><th>Source reference</th></tr></thead><tbody>{mismatches.map((row, index) => <tr key={`${row.difference}-${row.id ?? index}`}><td>{row.difference}</td><td>{row.expected_title || 'No matching parsed source row'}{row.expected_discipline && <small>{row.expected_discipline}</small>}</td><td>{row.actual_title || 'No matching plan activity'}{row.actual_discipline && <small>{row.actual_discipline}</small>}</td><td><References sources={row.expected_source_references || row.source_references || []} /></td></tr>)}</tbody></table></div></details>}

        <section className="psv-card" aria-label="Source requirements"><header><h3>Source requirements</h3><span className="psv-badge">{requirements.length} extracted</span></header>{requirements.length ? <ul className="psv-requirements">{requirements.map((requirement, index) => <li key={index}><p>{readable(requirement)}{requirement.anchor_status === 'unconfirmed' && <span className="psv-badge is-unverified">Anchor unconfirmed</span>}</p><References sources={requirement.source_references || []} /></li>)}</ul> : <p className="psv-muted">No source requirements were extracted from the saved documents.</p>}</section>
      </>}
    </div>
    <footer className="psv-footer"><span>Read-only comparison</span><button type="button" className="psv-button" onClick={onClose}>Close</button>{onInputs && <button type="button" className="psv-button is-primary" onClick={() => { onClose(); onInputs() }}><FileText size={15} aria-hidden="true" />Project inputs</button>}</footer>
  </dialog>, document.body)
}

PlanningSourceVerification.propTypes = {
  plan: PropTypes.object.isRequired, onClose: PropTypes.func.isRequired, onInputs: PropTypes.func,
}
