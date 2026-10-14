import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import PropTypes from 'prop-types'
import { AlertTriangle, Loader2, X } from 'lucide-react'

const date = value => value ? new Date(`${value}T12:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Not Specified'

export default function PlanningSourceScheduleImport({ proposal, projectName, projectWindow, busy, error, stale, onClose, onRetry, onApply }) {
  const dialogRef = useRef(null), titleId = useId()
  const [reason, setReason] = useState(''), [confirmed, setConfirmed] = useState(false)
  const summary = proposal?.summary || {}
  useEffect(() => {
    const dialog = dialogRef.current, opener = document.activeElement
    dialog.showModal()
    return () => { dialog.close(); if (opener?.isConnected) opener.focus({ preventScroll: true }) }
  }, [])
  useEffect(() => { setConfirmed(false) }, [proposal?.proposal_token])
  return createPortal(<dialog ref={dialogRef} className="psp-import-dialog" aria-labelledby={titleId} onCancel={event => { event.preventDefault(); if (!busy) onClose() }}>
    <header><div><h2 id={titleId}>Use source schedule in Master Schedule</h2><p>{projectName || 'Current project'}</p></div><button type="button" aria-label="Close source schedule review" disabled={busy} onClick={onClose}><X size={19} /></button></header>
    <form onSubmit={event => { event.preventDefault(); if (!busy && !stale && confirmed && reason.trim() && proposal?.can_apply === true) onApply(reason.trim()) }}>
      <div className="psp-import-content">
        {busy && <p className="psp-status" role="status"><Loader2 size={17} className="animate-spin" />{proposal ? 'Opening source activities in Master Schedule...' : 'Preparing source schedule review...'}</p>}
        {error && <p className="psp-error" role="alert">{error}</p>}
        {proposal && <>
          <p>Use the extracted activities and printed dates from <strong>{summary.source_file?.name}</strong> as a new Master Schedule draft.</p>
          <dl className="psp-import-summary"><div><dt>Activities</dt><dd>{summary.activity_count ?? 0}</dd></div><div><dt>With source durations</dt><dd>{summary.duration_count ?? 0}</dd></div><div><dt>Explicit relationships</dt><dd>{summary.relationship_count ?? 0}</dd></div><div><dt>MDR rows awaiting links</dt><dd>{summary.unmapped_register_count ?? 0}</dd></div><div><dt>Source dates</dt><dd>{date(summary.start_date)} - {date(summary.finish_date)}</dd></div><div><dt>Project window</dt><dd>{date(projectWindow?.start_date)} - {date(projectWindow?.finish_date)}</dd></div></dl>
          <p>Your current MDR working draft, employee assignments and history are retained. Project dates remain unchanged. This imports source timing; calendar, logic, float and baseline approval still require review.</p>
          {(proposal.warnings || []).length > 0 && <ul className="psp-import-warnings">{proposal.warnings.map((warning, index) => <li key={warning.code || index}><AlertTriangle size={16} /><span>{typeof warning === 'string' ? warning : warning.message || warning.code}{warning.count > 1 ? ` (${warning.count})` : ''}</span></li>)}</ul>}
          <label className="psp-import-confirm"><input type="checkbox" checked={confirmed} disabled={busy || stale} onChange={event => setConfirmed(event.target.checked)} />I confirm this source schedule applies to {projectName || 'the current project'}.</label>
          <label className="psp-import-reason">Review note<textarea aria-label="Source schedule review note" value={reason} disabled={busy || stale} required maxLength={2000} onChange={event => setReason(event.target.value)} placeholder="Record why this source schedule is applicable." /></label>
          {proposal.can_apply !== true && <p className="psp-error">Resolve the import findings before using this source schedule.</p>}
        </>}
      </div>
      <footer><button type="button" disabled={busy} onClick={onClose}>Cancel</button>{(stale || !proposal && error) && <button type="button" disabled={busy} onClick={onRetry}>Review latest source</button>}<button type="submit" className="psp-primary" disabled={busy || stale || !confirmed || !reason.trim() || proposal?.can_apply !== true}>Use in Master Schedule</button></footer>
    </form>
  </dialog>, document.body)
}
PlanningSourceScheduleImport.propTypes = {
  proposal: PropTypes.object, projectName: PropTypes.string, projectWindow: PropTypes.object,
  busy: PropTypes.bool, error: PropTypes.string, stale: PropTypes.bool,
  onClose: PropTypes.func.isRequired, onRetry: PropTypes.func.isRequired, onApply: PropTypes.func.isRequired,
}
