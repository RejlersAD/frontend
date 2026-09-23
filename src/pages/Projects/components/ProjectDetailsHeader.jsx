/* eslint-disable react/prop-types */
import { useEffect, useRef, useState } from 'react'
import { AlertCircle, AlertTriangle, ArrowLeft, CalendarDays, CheckCircle2, ChevronDown, Clock3, Coins, Download, FileText, Flag, Folder, Home, MoreHorizontal, Pencil, Plus, RefreshCw, Save, Share, ShieldCheck, Sparkles, Upload } from 'lucide-react'
import { PROJECT_VIEW_MODES } from '../../../config/projectControl.config'
import { formatDate, projectManagerName } from '../useProjectPerformance'
import ProjectSelector from './ProjectSelector'
import '@fontsource/ibm-plex-sans/400.css'
import '@fontsource/ibm-plex-sans/500.css'
import '@fontsource/ibm-plex-sans/600.css'
import '@fontsource/ibm-plex-sans/700.css'
import '../ProjectDetailsHeader.css'

const AREAS = [
  { key: 'project-dashboard', label: 'Overview', icon: Home },
  { key: 'plan-baseline', label: 'Schedule', icon: CalendarDays },
  { key: 'commercial-dashboard', label: 'Cost & Commercial', icon: Coins },
  { key: 'milestones', label: 'Milestones', icon: Flag },
  { key: 'risk', label: 'Risks & Changes', icon: AlertTriangle },
  { key: 'estimates', label: 'Estimates', icon: FileText },
  { key: 'documents', label: 'Documents', icon: Folder },
  { key: 'activity', label: 'Activity & Audit', icon: Clock3, dialog: true },
]
const STATUS = { planning: 'Planning', active: 'In progress', on_hold: 'On hold', completed: 'Completed', cancelled: 'Cancelled' }

export default function ProjectDetailsHeader({ projects, selectedProject, selectedProjectId, onSelectProject, loading, error,
  phaseFlags, onSelectView, onNavigate, onCreate, onEdit, onImport, onArchive, onRefresh, onExport,
  performance, onOpenDialog, activeView = 'project-dashboard', scheduleMode = 'planner',
  schedulePerformance, onUpdateSchedule, commercialPerformance, onUpdateCommercial,
  milestoneControl, onAddMilestone, riskControl, onAddRiskRecord, estimateControl, onNewEstimate,
  documentControl, onAddDocument, onAnalyzeAgreement, agreementStatus }) {
  const menu = useRef(null), addMenu = useRef(null)
  const [scheduleState, setScheduleState] = useState(null)
  useEffect(() => {
    setScheduleState(null)
    const receive = event => { if (String(event.detail?.projectId) === String(selectedProjectId)) setScheduleState(event.detail) }
    window.addEventListener('radai:master-schedule-state', receive)
    return () => window.removeEventListener('radai:master-schedule-state', receive)
  }, [selectedProjectId])
  useEffect(() => {
    const dismiss = event => {
      for (const ref of [menu, addMenu]) {
        if (event.type === 'keydown') {
          if (event.key === 'Escape' && ref.current?.open) {
            ref.current.removeAttribute('open')
            ref.current.querySelector('summary')?.focus()
          }
        } else if (!ref.current?.contains(event.target)) ref.current?.removeAttribute('open')
      }
    }
    document.addEventListener('pointerdown', dismiss)
    document.addEventListener('keydown', dismiss)
    return () => { document.removeEventListener('pointerdown', dismiss); document.removeEventListener('keydown', dismiss) }
  }, [])
  useEffect(() => {
    menu.current?.removeAttribute('open')
    addMenu.current?.removeAttribute('open')
    if (activeView !== 'plan-baseline') setScheduleState(null)
  }, [activeView])
  const run = action => { menu.current?.removeAttribute('open'); action?.() }
  const add = action => { addMenu.current?.removeAttribute('open'); addMenu.current?.querySelector('summary')?.focus(); action?.() }
  const project = selectedProject
  const model = performance?.model
  const manager = projectManagerName(project)
  const managerRole = project?.team_members_data?.some(member => member.role === 'project_manager' && member.is_active) ? 'Project Manager' : 'Project owner'
  const initials = manager === 'Not assigned' ? '—' : manager.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase()
  const baselineKnown = Object.prototype.hasOwnProperty.call(project?.portfolio || {}, 'baseline')
  const baseline = project?.portfolio?.baseline
  const approved = baseline?.approved === true
  const health = model?.health
  const status = project?.custom_fields?.control_setup?.operational_status_confirmed === false ? 'Status to confirm' : STATUS[project?.status] || 'Not specified'
  const busy = loading || performance?.loading
  const isSchedule = activeView === 'plan-baseline', isCommercial = activeView === 'commercial-dashboard'
  const isMilestones = activeView === 'milestones', isRisk = activeView === 'risk'
  const isEstimates = activeView === 'estimates', isDocuments = activeView === 'documents'
  const activePerformance = isSchedule ? schedulePerformance : isCommercial ? commercialPerformance
    : isMilestones ? milestoneControl : isRisk ? riskControl : isEstimates ? estimateControl : isDocuments ? documentControl : performance
  const activeModel = activePerformance?.model
  const activeBusy = loading || activePerformance?.loading
  const primaryLabel = isSchedule ? scheduleMode === 'planner' ? 'Save draft' : 'Update schedule'
    : isCommercial ? 'Update commercial' : isMilestones ? 'Add milestone' : activeView === 'epc-lifecycle' ? 'Edit project details' : 'Update progress'
  const primaryAction = isSchedule ? scheduleMode === 'planner' ? () => window.dispatchEvent(new Event('radai:save-master-schedule')) : onUpdateSchedule
    : isCommercial ? onUpdateCommercial : isMilestones ? onAddMilestone : onEdit
  const PrimaryIcon = isSchedule ? Save : isMilestones ? Plus : Share
  const primaryDisabled = !project || activeBusy || (isSchedule && scheduleMode === 'planner' && !scheduleState?.canSave) || (isMilestones && !activeModel?.canCreate)
  const addLabel = isEstimates ? 'New estimate' : isDocuments ? 'Add document' : 'Add'
  const addDisabled = !project || activeBusy || (isDocuments ? !activeModel?.canUpload : !activeModel?.canCreate)
  const exportLabel = isDocuments || isRisk ? 'Export register' : isEstimates ? 'Export estimate' : isMilestones ? 'Export milestone report'
    : isSchedule ? 'Export schedule' : isCommercial ? 'Export commercial' : 'Export'
  const exportDisabled = !project || activeBusy || (isDocuments && !activeModel?.availability?.list)
    || (isEstimates && !activeModel?.availability?.selected) || ((isRisk || isMilestones) && !activeModel?.rows?.length)
    || (isSchedule && (scheduleMode === 'planner' ? !scheduleState?.hasActivities : !activeModel?.activities?.length)) || (isCommercial && !activeModel?.availability?.commercial)
  const exportAction = isSchedule && scheduleMode === 'planner'
    ? () => window.dispatchEvent(new CustomEvent('radai:export-master-schedule', { detail: { projectId: selectedProjectId } })) : onExport
  const enabled = key => {
    const area = PROJECT_VIEW_MODES.find(item => item.key === key)
    return !area?.phaseFlag || phaseFlags?.[area.phaseFlag] !== false
  }
  const extras = PROJECT_VIEW_MODES.filter(item => !AREAS.some(area => area.key === item.key)
    && (!item.phaseFlag || (item.phaseLabel ? phaseFlags?.[item.phaseFlag] === true : enabled(item.key))))
  const actionCount = model?.actions?.length ?? 0
  const scheduleIssueCount = Number.isFinite(scheduleState?.issueCount) ? scheduleState.issueCount : actionCount
  const scheduleDataDate = schedulePerformance?.model?.dataDate || model?.dataDate
  const HealthIcon = health?.tone === 'success' ? CheckCircle2 : AlertTriangle
  return <header className={`pd-header${isSchedule ? ' pd-schedule-header' : ''}`} aria-label="Project details">
    <div className="pd-heading-content">
      <div className="pd-location"><button type="button" aria-label={isSchedule ? 'Back to projects' : undefined} onClick={() => onNavigate('/projects')}><ArrowLeft size={16} />{!isSchedule && 'Back to projects'}</button>{!isSchedule && <span className="pd-location-divider" aria-hidden="true" />}
        <nav aria-label="Breadcrumb"><span>Project Control</span><span aria-hidden="true">/</span><button type="button" onClick={() => onNavigate('/projects')}>Portfolio</button><span aria-hidden="true">/</span><span aria-current={isSchedule ? undefined : 'page'}>{project?.code || 'Project details'}</span>{isSchedule && <><span aria-hidden="true">/</span><span aria-current="page">Schedule</span></>}</nav>
      </div>
      <h1 title={project?.name}>{project?.name || (loading ? 'Loading project…' : 'Select a project')}</h1>
      <div className="pd-header-actions">
        {isSchedule && <button type="button" className="pd-button pd-primary pd-resolve-action" onClick={() => window.dispatchEvent(new CustomEvent('radai:review-schedule-issues', { detail: { projectId: selectedProjectId } }))} disabled={!project || activeBusy}><AlertTriangle size={17} />{scheduleIssueCount ? `Resolve ${scheduleIssueCount} ${scheduleIssueCount === 1 ? 'issue' : 'issues'}` : 'Resolve issues'}</button>}
        {isRisk || isEstimates || isDocuments ? <details className="pd-menu pd-add-menu" ref={addMenu}><summary className="pd-button pd-primary" aria-label={addLabel} aria-disabled={addDisabled} onClick={event => { if (addDisabled) event.preventDefault() }}><Plus size={16} />{isEstimates ? 'New estimate' : 'Add'}<ChevronDown size={14} /></summary><div className="pd-menu-content">
          {isRisk && [['risk', 'Add risk', ShieldCheck], ['issue', 'Add issue', AlertTriangle], ['change_request', 'Add change', FileText]].map(([type, label, Icon]) => <button type="button" key={type} onClick={() => add(() => onAddRiskRecord(type))}><Icon size={15} />{label}</button>)}
          {isEstimates && [['create', 'Blank estimate'], ['copy', 'Copy version'], ['import', 'Import Excel']].map(([type, label]) => <button type="button" key={type} disabled={type === 'copy' && !activeModel?.canCopy} onClick={() => add(() => onNewEstimate(type))}><FileText size={15} />{label}</button>)}
          {isDocuments && <><button type="button" onClick={() => add(onAddDocument)}><FileText size={15} />New document</button><button type="button" disabled><Upload size={15} />Upload revision</button><button type="button" disabled><Folder size={15} />Create transmittal</button><p className="pd-menu-note">Revision control and transmittals are not configured for these documents.</p></>}
        </div></details> : <button type="button" className={`pd-button ${isSchedule ? 'pd-save-action' : 'pd-primary'}`} onClick={primaryAction} disabled={primaryDisabled}><PrimaryIcon size={16} />{primaryLabel}</button>}
        {!isSchedule && <button type="button" className="pd-button" onClick={() => onOpenDialog('actions')} disabled={!model || busy}><AlertCircle size={17} />{actionCount ? `Resolve ${actionCount} ${actionCount === 1 ? 'issue' : 'issues'}` : 'Review issues'}</button>}
        <button type="button" className="pd-button pd-export-action" aria-label={exportLabel} onClick={exportAction} disabled={exportDisabled} title={exportLabel === 'Export' ? 'Print or save the project report as PDF' : exportLabel}><Download size={18} />Export</button>
        <details className="pd-menu" ref={menu}><summary className="pd-button pd-icon-button" aria-label="More project actions"><MoreHorizontal size={19} /></summary><div className="pd-menu-content">
          <div className="pd-switch-project"><ProjectSelector compact projects={projects} value={selectedProjectId} onChange={id => run(() => onSelectProject(id))} loading={loading} error={error} label="Active Project" /></div>
          <button type="button" disabled={busy} onClick={() => run(onRefresh)}><RefreshCw size={15} />Refresh project</button>
          <button type="button" disabled={!project} onClick={() => run(onEdit)}><Pencil size={15} />Edit project details</button>
          {isSchedule && onAnalyzeAgreement && <><button type="button" onClick={() => run(onAnalyzeAgreement)} disabled={loading} aria-haspopup="dialog"><Sparkles size={15} />Analyze &amp; set up project</button>{agreementStatus && <p className="pd-menu-note" role="status">{agreementStatus}</p>}</>}
          <button type="button" disabled={!model} onClick={() => run(() => onOpenDialog('reporting-source'))}><CalendarDays size={15} />Reporting source</button>
          <button type="button" disabled={!model} onClick={() => run(() => onOpenDialog('data-quality'))}><ShieldCheck size={15} />Data quality</button>
          <button type="button" onClick={() => run(onImport)}><Upload size={15} />Import from QHSE</button>
          <button type="button" onClick={() => run(onCreate)}><Plus size={15} />New project</button>
          {extras.map(area => <button type="button" key={area.key} onClick={() => run(() => area.route ? onNavigate(area.route) : onSelectView(area.key))}>{area.label}</button>)}
          <button type="button" className="pd-danger-action" disabled={!project} onClick={() => run(onArchive)}>Delete project</button>
        </div></details>
      </div>
      {project && isSchedule ? <div className="pd-project-facts">
        <div className="pd-project-code">{project.code || 'Code not recorded'}</div>
        <div className="pd-client"><span className="pd-fact-label">Client:</span><strong>{project.client_name || 'Not recorded'}</strong></div>
        <div className="pd-manager"><span className="pd-fact-label">Project manager:</span><strong>{manager}</strong></div>
        <div className="pd-status"><span className="pd-fact-label">Status</span><span className={`pd-pill pd-status-${project.status}`}>{status}</span></div>
        <div className="pd-health"><span className="pd-fact-label">Overall health</span><span className={`pd-pill pd-health-${health?.tone || 'neutral'}`}>{health && <HealthIcon size={13} />}{health?.label || 'Not assessed'}</span></div>
        <div className="pd-baseline"><span className="pd-fact-label">Baseline</span><span className={`pd-pill ${approved ? 'pd-baseline-approved' : 'pd-baseline-unavailable'}`}>{approved ? 'Approved' : baselineKnown ? 'Not approved' : 'Unavailable'}</span></div>
        <div className="pd-report-date"><span className="pd-fact-label">Data date</span><span className="pd-pill pd-data-date">{formatDate(scheduleDataDate, 'Not set')}</span></div>
      </div> : project && <div className="pd-project-facts">
        <div className="pd-project-code">{project.code || 'Code not recorded'}</div>
        <div className="pd-client">Client: <strong>{project.client_name || 'Not recorded'}</strong></div>
        <div className="pd-manager"><span className="pd-person-avatar" aria-hidden="true">{initials}</span><span><strong>{manager}</strong><small>{managerRole}</small></span></div>
        <div className="pd-baseline"><CalendarDays size={21} /><span><small>Baseline</small><strong className={!approved ? 'pd-unavailable' : undefined}>{approved ? (baseline.start_date && baseline.finish_date ? `${formatDate(baseline.start_date)} – ${formatDate(baseline.finish_date)}` : 'Dates not recorded') : baselineKnown ? 'Baseline not approved' : 'Baseline unavailable'}</strong></span></div>
        <div className="pd-status"><small>Status</small><span className={`pd-pill pd-status-${project.status}`}>{status}</span></div>
        <div className="pd-health"><small>Overall health</small><span className={`pd-pill pd-health-${health?.tone || 'neutral'}`}>{health && <HealthIcon size={15} />}{health?.label || 'Not assessed'}</span></div>
        <div className="pd-report-date"><CalendarDays size={21} /><span><small>{model?.workingFallback ? 'Working data date' : 'Last reporting date'}</small><strong>{formatDate(model?.dataDate, 'Not recorded')}</strong></span></div>
        {onAnalyzeAgreement && <div className="pd-agreement-action"><button type="button" className="pd-button pd-primary" onClick={onAnalyzeAgreement} disabled={loading} aria-haspopup="dialog"><Sparkles size={16} aria-hidden="true" />Analyze &amp; set up project</button>{agreementStatus && <small role="status">{agreementStatus}</small>}</div>}
      </div>}
    </div>
    {project && <nav className="pd-tabs" aria-label="Project work areas"><ul>{AREAS.filter(area => area.dialog || enabled(area.key)).map(({ key, label, icon: Icon, dialog }) => <li key={key}><button type="button" aria-current={!dialog && (key === activeView || key === 'commercial-dashboard' && activeView === 'cost-dashboard') ? 'page' : undefined} onClick={() => dialog ? onOpenDialog(key) : onSelectView(key)}><Icon size={isSchedule ? 17 : 18} />{label}</button></li>)}</ul></nav>}
  </header>
}
