import { useEffect, useId, useMemo, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { Download, FileText, Loader2 } from 'lucide-react'
import rbacService from '../../services/rbac.service'
import './GanttPdfExportPanel.css'

const exportAllowed = response => {
  const profile = response?.data?.data || response?.data || response
  const actions = profile?.module_actions?.planning_package
  return Array.isArray(actions) && actions.includes('export')
}
const deniedMessage = 'Your account does not have permission to export planning packages.'

export default function GanttPdfExportPanel({ plan, tasks, disciplines, filters, zoom, showLogic, showBaseline }) {
  const [scope, setScope] = useState('all')
  const [paper, setPaper] = useState('a3')
  const [permission, setPermission] = useState('loading')
  const [permissionAttempt, setPermissionAttempt] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  // The parent decorates plan with a fresh object on every render. Track the
  // actual schedule data so a notification disappearing cannot cancel export.
  const contextKey = JSON.stringify([
    plan.project_id, plan.project?.id, plan.project?.code, plan.project?.name, plan.project?.phase, plan.project_name,
    plan.version_id, plan.version_number, plan.canonical_version?.id, plan.canonical_version?.version, plan.canonical_version?.version_number,
    plan.revision, plan.master_revision, plan.state, plan.viewing_history, plan.duration_policy, plan.evidence_policy,
    filters?.search, filters?.discipline, filters?.criticalOnly, zoom, showLogic, showBaseline,
  ])
  const context = useMemo(() => ({
    key: contextKey, tasks, disciplines, wbs: plan.wbs_nodes, deliverables: plan.deliverables,
    calendar: plan.work_calendar || plan.calendar, summary: plan.project_summary, durationReview: plan.duration_review,
  }), [contextKey, tasks, disciplines, plan.wbs_nodes, plan.deliverables, plan.work_calendar, plan.calendar, plan.project_summary, plan.duration_review])
  const mounted = useRef(false), pending = useRef(false), currentContext = useRef(context)
  const scopeId = useId(), noteId = useId()
  currentContext.current = context

  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  useEffect(() => {
    let active = true
    setPermission('loading')
    rbacService.getCurrentUser().then(response => {
      if (active) setPermission(exportAllowed(response) ? 'allowed' : 'denied')
    }).catch(() => { if (active) setPermission('error') })
    return () => { active = false }
  }, [permissionAttempt])
  useEffect(() => { setError(''); setNotice('') }, [context])

  const download = async () => {
    if (pending.current || permission !== 'allowed' || !tasks.length) return
    pending.current = true
    setBusy(true); setError(''); setNotice('')
    const isCurrent = () => mounted.current && currentContext.current === context
    try {
      // Recheck the explicit export action before generating a local file.
      const response = await rbacService.getCurrentUser()
      if (!isCurrent()) return
      if (!exportAllowed(response)) { setPermission('denied'); return }
      const { createGanttPdf } = await import('../../utils/ganttPdf')
      if (!isCurrent()) return
      const { blob, filename, pageCount, rowCount } = await createGanttPdf({ plan, tasks, disciplines, scope, filters, paper, zoom, showLogic, showBaseline })
      if (!isCurrent()) return
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      try {
        anchor.href = url; anchor.download = filename
        document.body.appendChild(anchor); anchor.click()
      } finally {
        anchor.remove()
        window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      }
      setNotice(`PDF prepared: ${filename}. ${pageCount} ${pageCount === 1 ? 'page' : 'pages'}, ${rowCount} ${rowCount === 1 ? 'row' : 'rows'}.`)
    } catch (caught) {
      if (isCurrent()) setError(caught.message || 'The Gantt PDF could not be prepared. Please try again.')
    } finally {
      pending.current = false
      if (mounted.current) setBusy(false)
    }
  }

  return <section className="gantt-pdf-export" aria-label="Gantt PDF export" aria-busy={busy}>
    <header><FileText size={18} aria-hidden="true" /><h3>Gantt chart PDF</h3></header>
    <p>Download the schedule table and Gantt chart as a landscape PDF.</p>
    <p className="gpe-note">PDF labels currently support Latin text.</p>
    <fieldset disabled={busy} aria-describedby={noteId}>
      <legend>Rows to export</legend>
      <label className="gpe-radio"><input type="radio" name={scopeId} value="all" checked={scope === 'all'} onChange={() => setScope('all')} />Full schedule</label>
      <label className="gpe-radio"><input type="radio" name={scopeId} value="filtered" checked={scope === 'filtered'} onChange={() => setScope('filtered')} />Current filters</label>
    </fieldset>
    <p id={noteId} className="gpe-note">Includes collapsed groups and rows outside the visible area. Current filters uses the search, discipline and critical path filters.</p>
    <div className="gpe-options"><label>Paper size<select aria-label="PDF paper size" value={paper} disabled={busy} onChange={event => setPaper(event.target.value)}><option value="a3">A3 landscape</option><option value="a4">A4 landscape</option></select></label><p className="gpe-note">Uses the current timeline zoom, dependency links and baseline display settings.</p></div>
    {permission === 'loading' && <p role="status">Checking export permission…</p>}
    {permission === 'denied' && <p className="gpe-note" role="status">{deniedMessage}</p>}
    {permission === 'error' && <div className="gpe-error"><p role="alert">Export permission could not be checked. Please try again.</p><button type="button" onClick={() => setPermissionAttempt(value => value + 1)}>Retry permission check</button></div>}
    {!tasks.length && <p className="gpe-note">Add or import schedule activities before exporting.</p>}
    {error && <p className="gpe-error" role="alert">{error}</p>}
    {notice && <p className="gpe-success" role="status">{notice}</p>}
    <button type="button" className="gpe-download" disabled={busy || permission !== 'allowed' || !tasks.length} onClick={download}>{busy ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Download size={16} aria-hidden="true" />}{busy ? 'Preparing Gantt PDF…' : 'Export Gantt PDF'}</button>
  </section>
}

GanttPdfExportPanel.propTypes = {
  plan: PropTypes.object.isRequired,
  tasks: PropTypes.array.isRequired,
  disciplines: PropTypes.array.isRequired,
  filters: PropTypes.shape({ search: PropTypes.string, discipline: PropTypes.string, criticalOnly: PropTypes.bool }),
  zoom: PropTypes.oneOf(['day', 'week', 'month']),
  showLogic: PropTypes.bool,
  showBaseline: PropTypes.bool,
}
