/* eslint-disable react/prop-types */
import React, { useEffect, useRef } from 'react'
import { Download, FileText, MoreHorizontal, Plus, RefreshCw, Upload, Pencil, CalendarDays, LayoutGrid, CircleDollarSign, Flag, ShieldCheck, Briefcase, AlertTriangle, ChevronDown } from 'lucide-react'
import { PROJECT_VIEW_MODES } from '../../../config/projectControl.config'
import { formatDate, projectManagerName } from '../useProjectPerformance'
import ProjectSelector from './ProjectSelector'

const titleCase = value => String(value || '').replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase())

export default function ProjectControlHeader({
  projects, selectedProject, selectedProjectId, onSelectProject, loading, error,
  phaseFlags, activeView, onSelectView, onNavigate, onCreate, onEdit, onImport,
  onArchive, onRefresh, onExport, performance, lastRefreshed, onOpenDialog,
  schedulePerformance, onUpdateSchedule, commercialPerformance, onUpdateCommercial, milestoneControl, onAddMilestone, riskControl, onAddRiskRecord, estimateControl, onNewEstimate, documentControl, onAddDocument,
}) {
  const menuRef = useRef(null), addRef = useRef(null)
  useEffect(() => {
    const dismiss = event => {
      for (const ref of [menuRef, addRef]) {
        if (event.type === 'keydown' ? event.key === 'Escape' : !ref.current?.contains(event.target)) ref.current?.removeAttribute('open')
      }
    }
    document.addEventListener('pointerdown', dismiss); document.addEventListener('keydown', dismiss)
    return () => { document.removeEventListener('pointerdown', dismiss); document.removeEventListener('keydown', dismiss) }
  }, [])
  const run = action => { menuRef.current?.removeAttribute('open'); action?.() }
  const enabled = key => {
    const area = PROJECT_VIEW_MODES.find(item => item.key === key)
    return !area?.phaseFlag || phaseFlags[area.phaseFlag] !== false
  }
  const areas = [
    { key: 'project-dashboard', label: 'Overview', scheduleIcon: LayoutGrid },
    { key: 'plan-baseline', label: 'Schedule', scheduleIcon: CalendarDays },
    { key: 'commercial-dashboard', label: 'Cost & Commercial', scheduleIcon: CircleDollarSign },
    { key: 'milestones', label: 'Milestones', scheduleIcon: Flag },
    { key: 'risk', label: 'Risks & Changes', scheduleIcon: ShieldCheck },
    { key: 'estimates', label: 'Estimates', icon: FileText },
    { key: 'documents', label: 'Documents', scheduleIcon: Briefcase },
    { key: 'epc-lifecycle', label: 'EPC lifecycle', icon: ShieldCheck },
  ].filter(item => item.dialog || enabled(item.key))
  const extras = PROJECT_VIEW_MODES.filter(item => !areas.some(area => area.key === item.key) && (!item.phaseFlag || (item.phaseLabel ? phaseFlags[item.phaseFlag] === true : enabled(item.key))))
  const isSchedule = activeView === 'plan-baseline'
  const isCommercial = activeView === 'commercial-dashboard'
  const isMilestones = activeView === 'milestones'
  const isRisk = activeView === 'risk'
  const isEstimates = activeView === 'estimates'
  const isDocuments = activeView === 'documents'
  const isEPC = activeView === 'epc-lifecycle'
  const operationalStatusConfirmed = selectedProject?.custom_fields?.control_setup?.operational_status_confirmed !== false
  const isPerformanceArea = isSchedule || isCommercial || isMilestones || isRisk || isEstimates || isDocuments
  const activePerformance = isDocuments ? documentControl : isEstimates ? estimateControl : isRisk ? riskControl : isMilestones ? milestoneControl : isSchedule ? schedulePerformance : isCommercial ? commercialPerformance : performance
  const model = activePerformance?.model
  const health = isEPC ? null : model?.health
  const refreshed = isPerformanceArea ? activePerformance?.loadedAt : lastRefreshed
  const heading = !selectedProject ? 'Project Portfolio' : activeView === 'epc-lifecycle' ? 'EPC lifecycle' : isDocuments ? 'Project Documents' : isEstimates ? 'Project Estimates' : isRisk ? 'Risk & Change Control' : isMilestones ? 'Milestone Control' : isCommercial ? 'Cost & Commercial Performance' : isSchedule ? 'Schedule Performance' : activeView === 'portfolio-exceptions' ? 'Portfolio Exceptions' : 'Project Performance'
  const primaryAction = !selectedProject ? onCreate : isMilestones ? onAddMilestone : isCommercial ? onUpdateCommercial : isSchedule ? onUpdateSchedule : onEdit
  const primaryLabel = !selectedProject ? 'New project' : activeView === 'epc-lifecycle' ? 'Edit project details' : isMilestones ? 'Add milestone' : isCommercial ? 'Update commercial' : isSchedule ? 'Update schedule' : 'Update progress'
  const exportLabel = isDocuments ? 'Export register' : isEstimates ? 'Export estimate' : isRisk ? 'Export register' : isMilestones ? 'Export milestone report' : isCommercial ? 'Export commercial' : isSchedule ? 'Export schedule' : 'Export report'
  const exportDisabled = !selectedProject || (isDocuments && (!model?.availability?.list || activePerformance?.loading)) || (isEstimates && (!model?.availability?.selected || activePerformance?.loading)) || (isRisk && (!model?.rows?.length || activePerformance?.loading)) || (isMilestones && (!model?.rows?.length || activePerformance?.loading)) || (isSchedule && (!model?.activities?.length || activePerformance?.loading)) || (isCommercial && (!model?.availability?.commercial || activePerformance?.loading))
  return <header className="pp-header">
    <div className="pp-header-main">
      <div className="pp-project-picker"><nav className="pp-breadcrumb" aria-label="Breadcrumb"><span>Project Control</span><span>/</span><a href="/projects">Portfolio</a><span>/</span><span aria-current="page">{activeView === 'epc-lifecycle' ? 'EPC lifecycle' : isDocuments ? 'Documents' : isEstimates ? 'Estimates' : isRisk ? 'Risks & Changes' : isMilestones ? 'Milestones' : isCommercial ? 'Cost & Commercial' : isSchedule ? 'Schedule' : 'Project performance'}</span></nav>{isPerformanceArea && <span className={isDocuments ? "dc-picker-label" : isEstimates ? "ec-picker-label" : isRisk ? "rc-picker-label" : isMilestones ? "mc-picker-label" : isSchedule ? "sp-picker-label" : "cp-picker-label"} aria-hidden="true">Active project</span>}<ProjectSelector compact projects={projects} value={selectedProjectId} onChange={onSelectProject} loading={loading} error={error} label="Active Project" /></div>
      <div className="pp-project-heading"><div className="pp-title-row"><h1>{heading}</h1>{selectedProject && <><span className={`pp-badge pp-${operationalStatusConfirmed && selectedProject.status === 'active' ? 'success' : 'neutral'}`}>{operationalStatusConfirmed ? titleCase(selectedProject.status) : 'Status to confirm'}</span>{health && <span className={`pp-badge pp-${health.tone}`}>{isPerformanceArea && health.tone !== 'success' && <AlertTriangle size={12} aria-hidden="true" />}{health.label}</span>}</>}</div>
        {selectedProject ? <div className="pp-project-meta"><span>Client: {selectedProject.client_name || 'Not provided'}</span><span>Project manager: {projectManagerName(selectedProject)}</span>{!isPerformanceArea && <span>{formatDate(selectedProject.start_date)} – {formatDate(selectedProject.end_date)}</span>}{!isEPC && <span>Data date: {formatDate(model?.dataDate)}</span>}</div> : <p className="pp-muted">Open and manage the projects you are authorised to access.</p>}
      </div>
      <div className="pp-header-actions"><div><button type="button" className="pp-button" disabled={loading || performance?.loading || activePerformance?.loading} onClick={onRefresh}><RefreshCw size={16} />Refresh</button><button type="button" className="pp-button" disabled={exportDisabled} onClick={onExport} title={isDocuments ? 'Download the full project document register as CSV' : isEstimates ? 'Download the selected estimate and cost items as CSV' : isRisk ? 'Download the complete risk, issue and change register as CSV' : isMilestones ? 'Download the complete milestone register as CSV' : isCommercial ? 'Download the current commercial summary, WBS costs and postings as CSV' : isSchedule ? 'Download the selected schedule comparison as CSV' : 'Print or save this report as PDF'}><Download size={16} />{exportLabel}</button>
        <details ref={menuRef} className="pp-menu"><summary className="pp-button pp-icon-button"><span className="sr-only">More project actions</span><MoreHorizontal size={19} /></summary><div className="pp-menu-items">
          {selectedProject && <button type="button" onClick={() => run(onEdit)}><Pencil size={15} />Edit project details</button>}<button type="button" onClick={() => run(onImport)}><Upload size={15} />Import from QHSE</button><button type="button" onClick={() => run(onCreate)}><Plus size={15} />New project</button>
          {selectedProject && <>{extras.map(area => <button type="button" key={area.key} onClick={() => run(() => area.route ? onNavigate(area.route) : onSelectView(area.key))}>{area.label}</button>)}<button type="button" className="pp-danger" onClick={() => run(onArchive)}>Delete project</button></>}
        </div></details>
        {isDocuments && selectedProject ? <details ref={addRef} className="pp-menu dc-add-menu"><summary className="pp-button pp-primary" aria-label="Add document" aria-disabled={!model?.canUpload || activePerformance?.loading} onClick={event => { if (!model?.canUpload || activePerformance?.loading) event.preventDefault() }}><Plus size={15} aria-hidden="true" />Add<ChevronDown size={14} aria-hidden="true" /></summary><div className="pp-menu-items"><button type="button" onClick={() => { addRef.current?.removeAttribute('open'); addRef.current?.querySelector('summary')?.focus(); onAddDocument() }}><FileText size={14} aria-hidden="true" />New document</button><button type="button" disabled><Upload size={14} aria-hidden="true" />Upload revision</button><button type="button" disabled><Briefcase size={14} aria-hidden="true" />Create transmittal</button><p className="dc-menu-note">Revision control and transmittals are not configured for these documents.</p></div></details> : isEstimates && selectedProject ? <details ref={addRef} className="pp-menu ec-new-menu"><summary className="pp-button pp-primary" aria-label="New estimate" aria-disabled={!model?.canCreate || activePerformance?.loading} onClick={event => { if (!model?.canCreate || activePerformance?.loading) event.preventDefault() }}><Plus size={15} aria-hidden="true" />New estimate<ChevronDown size={14} aria-hidden="true" /></summary><div className="pp-menu-items">{[['create', 'Blank estimate'], ['copy', 'Copy version'], ['import', 'Import Excel']].map(([type, label]) => <button type="button" key={type} disabled={type === 'copy' && !model?.canCopy} onClick={() => { addRef.current?.removeAttribute('open'); addRef.current?.querySelector('summary')?.focus(); onNewEstimate(type) }}><FileText size={14} aria-hidden="true" />{label}</button>)}</div></details> : isRisk && selectedProject ? <details ref={addRef} className="pp-menu rc-add-menu"><summary className="pp-button pp-primary" aria-label="Add" aria-disabled={!model?.canCreate} onClick={event => { if (!model?.canCreate) event.preventDefault() }}><Plus size={15} aria-hidden="true" />Add<ChevronDown size={14} aria-hidden="true" /></summary><div className="pp-menu-items">{[['risk', 'Add risk', ShieldCheck], ['issue', 'Add issue', AlertTriangle], ['change_request', 'Add change', FileText]].map(([type, label, Icon]) => <button type="button" key={type} onClick={() => { addRef.current?.removeAttribute('open'); addRef.current?.querySelector('summary')?.focus(); onAddRiskRecord(type) }}><Icon size={14} aria-hidden="true" />{label}</button>)}</div></details> : <button type="button" className="pp-button pp-primary" disabled={isMilestones && !model?.canCreate} onClick={primaryAction}>{isMilestones && <Plus size={15} aria-hidden="true" />}{primaryLabel}</button>}</div>
        {refreshed && <small>Last refreshed: {new Date(refreshed).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</small>}
      </div>
    </div>
    {selectedProject && <nav className="pp-tabs" aria-label="Project work areas"><ul>{areas.map(({ key, label, icon, scheduleIcon, dialog }) => { const Icon = isPerformanceArea ? scheduleIcon || icon : icon; return <li key={key}><button type="button" aria-current={!dialog && activeView === key ? 'page' : undefined} onClick={() => dialog ? onOpenDialog(dialog) : onSelectView(key)}>{Icon && <Icon size={14} aria-hidden="true" />}{label}</button></li> })}</ul></nav>}
  </header>
}
