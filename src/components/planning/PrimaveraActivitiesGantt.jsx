import React, { useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CalendarDays, ChevronDown, ChevronRight, Columns, Folder, Link2, Maximize, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import PropTypes from 'prop-types'
import { buildPrimaveraModel, flattenPrimaveraModel, isScheduleMilestone, scheduleDate, scheduleNumber } from '../../utils/primaveraSchedule'
import { buildPrimaveraTimeline } from '../../utils/primaveraTimeline'
import { buildPrimaveraDependencies, scheduleDependencyEntries, scheduleSequenceStyle } from '../../utils/primaveraDependencies'
import { durationEvidenceLabel, durationUnit, durationUnitLabel, missingSourceDuration } from '../../utils/planningDurationEvidence'
import { dateEvidenceLabel, floatEvidenceLabel, missingDateLabel, missingFloatLabel } from '../../utils/planningDateEvidence'
import { scheduleActivityColor, scheduleGroupColor } from '../../utils/primaveraColors'
import GanttCellEditor from './GanttCellEditor'
import './PrimaveraActivitiesGantt.css'

const DAY = 86400000
const ROW_HEIGHT = 32
const PALETTE = ['#bfdbfe', '#cbd5e1', '#dbeafe', '#cbd5e1', '#d1d5db']
const stamp = value => value ? Date.parse(`${String(value).slice(0, 10)}T00:00:00Z`) : NaN
const iso = value => new Date(value).toISOString().slice(0, 10)
const rowTone = depth => `p6-level-${depth % PALETTE.length}`
const clamp = (value, min, max) => Math.max(min, Math.min(max, value))
const defaultSplit = available => Math.max(400, Math.min(630, available * .58))
const baselineDates = task => {
  const startDate = String(task.baseline_start_date || '').slice(0, 10), finishDate = String(task.baseline_finish_date || '').slice(0, 10)
  const start = stamp(startDate), finish = stamp(finishDate)
  if (!Number.isFinite(start) || !Number.isFinite(finish) || finish < start || iso(start) !== startDate || iso(finish) !== finishDate) return null
  return { startDate, finishDate, start, finish }
}
const hasOriginalDuration = item => !['planner', 'manual', 'retained_manual', 'manual_unverified'].includes(item?.duration_source)
  && item?.original_duration_days != null && item.original_duration_days !== '' && Number.isFinite(Number(item.original_duration_days))
const durationDays = (value, unit = 'days') => {
  const formatted = scheduleNumber(value)
  const suffix = { hours: 'h', weeks: 'w', months: 'mo', calendar_days: 'cd' }[unit] || 'd'
  return formatted === '\u2014' ? formatted : `${formatted} ${suffix}`
}
const COLUMNS = [
  { key: 'activity-code', label: 'Activity ID', width: 104, min: 50, max: 480 },
  { key: 'activity-name', label: 'Activity Name', width: 184, min: 120, max: 1200 },
  { key: 'stage', label: 'Stage', width: 76, min: 46, max: 320 },
  { key: 'duration', label: 'Duration', width: 54, min: 42, max: 240 },
  { key: 'start', label: 'Start', width: 84, min: 66, max: 240 },
  { key: 'finish', label: 'Finish', width: 84, min: 66, max: 240 },
  { key: 'float', label: 'Total Float', width: 54, min: 44, max: 240 },
  { key: 'logic', label: 'Logic', width: 36, min: 30, max: 240 },
  { key: 'responsible', label: 'Responsible', width: 104, min: 72, max: 480 },
]

export default function PrimaveraActivitiesGantt({ plan, tasks, disciplines, search = '', discipline = 'all', criticalOnly = false,
  display = 'deliverables', level = 'activities', zoom = 'week', fitTimeline = false, selectedId, locked = false, showTimeline = true, showLogic = true,
  timelineFocus = false, showBaseline = false, toolbarTarget, legendTarget, displayOptionsTarget, onTimelineFocusChange, onShowLogicChange, onZoomChange, onFitTimelineChange,
  onSelect, onEdit, onDelete, onEditWbs, onDeleteWbs, canEditWbs, onInputs, onCellEdit, onLogicEdit }) {
  const [collapsed, setCollapsed] = useState(new Set())
  const [editing, setEditing] = useState(null)
  const editTrigger = useRef(null)
  const closeCell = () => { setEditing(null); requestAnimationFrame(() => editTrigger.current?.querySelector('button')?.focus({ preventScroll: true })) }
  const sourceOnly = plan.duration_policy === 'source_only' || plan.evidence_policy === 'document_driven' || Boolean(plan.duration_review)
  const displayedDate = (item, field, summary) => item[`display_${field}_date`]
    ? scheduleDate(item[`display_${field}_date`]) : missingDateLabel(item, field, { sourceOnly, summary })
  const [width, setWidth] = useState(1100)
  const [split, setSplit] = useState(() => defaultSplit(1100))
  const [columnWidths, setColumnWidths] = useState(() => Object.fromEntries(COLUMNS.map(column => [column.key, column.width])))
  const [hiddenColumns, setHiddenColumns] = useState(() => new Set(['stage', 'responsible']))
  const [stageColors, setStageColors] = useState(true)
  const visibleColumns = COLUMNS.filter(column => !hiddenColumns.has(column.key))
  const [gutter, setGutter] = useState(0)
  const markerId = `p6-arrow-${useId().replaceAll(':', '')}`
  const shellRef = useRef(null)
  const viewportRef = useRef(null)
  const columnsMenuRef = useRef(null)
  const moreMenuRef = useRef(null)
  const legendMenuRef = useRef(null)
  const leftScroll = useRef(null)
  const rightScroll = useRef(null)
  const dragging = useRef(null)
  const columnDragging = useRef(null)
  const pointerFocus = useRef(null)
  const splitTouched = useRef(false)
  const minSplit = Math.min(280, width * .42)
  const maxSplit = Math.max(minSplit, width - 170)
  const tablePane = showTimeline ? clamp(timelineFocus ? minSplit : split, minSplit, maxSplit) : width
  const tableContentWidth = 30 + visibleColumns.reduce((total, column) => total + columnWidths[column.key], 0)
  const columnTracks = `30px ${visibleColumns.map(column => `${columnWidths[column.key]}px`).join(' ')}`
  const ganttPane = Math.max(160, width - tablePane - 6)
  const model = useMemo(() => buildPrimaveraModel(plan, tasks, disciplines), [plan, tasks, disciplines])
  const disciplineNames = useMemo(() => new Map(disciplines.map(item => [String(item.code), item.name || item.code])), [disciplines])
  const allRows = useMemo(() => flattenPrimaveraModel(model), [model])
  const groupIds = useMemo(() => allRows.filter(row => row.kind === 'wbs').map(row => row.id), [allRows])
  const deliverableCount = allRows.filter(row => row.kind === 'wbs' && row.node.is_deliverable).length
  const rows = useMemo(() => flattenPrimaveraModel(model, { search, discipline, criticalOnly, collapsed, flat: level === 'activities' && display === 'activities', level }), [model, search, discipline, criticalOnly, collapsed, display, level])
  const baselineRows = useMemo(() => new Map(showBaseline ? tasks.flatMap(task => {
    const dates = baselineDates(task)
    return dates ? [[String(task.id), dates]] : []
  }) : []), [tasks, showBaseline])
  const timeline = useMemo(() => {
    // Extend only the calendar domain with explicit baseline dates. The live
    // activity model, duration evidence and displayed planned dates stay intact.
    const domainPlan = baselineRows.size ? { ...plan, wbs_nodes: [...(plan.wbs_nodes || []),
      ...Array.from(baselineRows.values(), dates => ({ summary: { planned_start_date: dates.startDate, planned_finish_date: dates.finishDate } }))] } : plan
    return buildPrimaveraTimeline({ plan: domainPlan, tasks, paneWidth: ganttPane, zoom, fit: fitTimeline })
  }, [plan, tasks, ganttPane, zoom, fitTimeline, baselineRows])
  const { start, days, dayWidth, width: timelineWidth, tickStep, ticks, years, months } = timeline
  const proposed = tasks.some(task => task.duration_source === 'proposed')
  const today = stamp(new Date().toISOString().slice(0, 10))
  const todayX = (today - start) / DAY * dayWidth
  const todayVisible = Number.isFinite(todayX) && todayX >= 0 && todayX <= timelineWidth

  useEffect(() => {
    if (!shellRef.current) return undefined
    const observer = new ResizeObserver(entries => {
      const scrollbar = viewportRef.current ? viewportRef.current.offsetWidth - viewportRef.current.clientWidth : 0
      const available = entries[0].contentRect.width - scrollbar
      setWidth(available)
      setGutter(scrollbar)
      if (!splitTouched.current) setSplit(defaultSplit(available))
    })
    observer.observe(shellRef.current)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    const element = rightScroll.current
    if (!element) return
    const left = fitTimeline ? 0 : Math.min(element.scrollLeft, Math.max(0, timelineWidth - ganttPane))
    element.scrollLeft = left
    shellRef.current?.style.setProperty('--p6-timeline-scroll', `${left}px`)
  }, [fitTimeline, zoom, timelineWidth, ganttPane])
  useEffect(() => {
    const element = leftScroll.current
    if (!element) return
    const left = Math.min(element.scrollLeft, Math.max(0, tableContentWidth - tablePane))
    element.scrollLeft = left
    shellRef.current?.style.setProperty('--p6-table-scroll', `${left}px`)
  }, [tableContentWidth, tablePane])
  useEffect(() => {
    const closeMenus = event => {
      for (const menu of [columnsMenuRef.current, moreMenuRef.current, legendMenuRef.current]) {
        if (!menu?.open) continue
        if (event.type === 'keydown' && event.key === 'Escape') {
          menu.open = false
          menu.querySelector('summary')?.focus()
        } else if (event.type === 'pointerdown' && !menu.contains(event.target)) menu.open = false
      }
    }
    document.addEventListener('pointerdown', closeMenus)
    document.addEventListener('keydown', closeMenus)
    return () => { document.removeEventListener('pointerdown', closeMenus); document.removeEventListener('keydown', closeMenus) }
  }, [])
  const scroll = (side, event) => shellRef.current?.style.setProperty(side === 'table' ? '--p6-table-scroll' : '--p6-timeline-scroll', `${event.currentTarget.scrollLeft}px`)
  const toggle = id => setCollapsed(current => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next })
  const adjustSplit = value => { splitTouched.current = true; onTimelineFocusChange?.(false); setSplit(clamp(value, minSplit, maxSplit)) }
  const resizeColumn = (column, value) => setColumnWidths(current => ({ ...current, [column.key]: clamp(value, column.min, column.max) }))
  const fitColumns = () => {
    const minimum = 30 + visibleColumns.reduce((total, column) => total + column.min, 0)
    const pane = showTimeline ? clamp(Math.max(tablePane, minimum), minSplit, maxSplit) : width
    const extra = Math.max(0, pane - minimum)
    const stretch = visibleColumns.reduce((total, column) => total + column.width - column.min, 0)
    setColumnWidths(current => ({ ...current, ...Object.fromEntries(visibleColumns.map(column => [column.key,
      clamp(column.min + Math.floor(extra * (column.width - column.min) / stretch), column.min, column.max)])) }))
    if (showTimeline) adjustSplit(pane)
    if (leftScroll.current) leftScroll.current.scrollLeft = 0
    shellRef.current?.style.setProperty('--p6-table-scroll', '0px')
  }
  const scrollToToday = () => {
    const element = rightScroll.current
    if (!element || !todayVisible) return
    element.scrollLeft = clamp(todayX - ganttPane / 3, 0, Math.max(0, timelineWidth - ganttPane))
    shellRef.current?.style.setProperty('--p6-timeline-scroll', `${element.scrollLeft}px`)
  }
  const changeScale = next => { onZoomChange?.(next); onFitTimelineChange?.(false) }
  const toggleColumn = key => setHiddenColumns(current => {
    const next = new Set(current)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    return next
  })
  const revealColumn = event => {
    const clip = event.target.closest?.('.p6-left-clip')
    const cell = event.target.closest?.('[role="gridcell"], [role="columnheader"]')
    const scrollbar = leftScroll.current
    if (!clip || !cell || !scrollbar) return
    // Synchronize keyboard focus across every row. Pointer focus waits until
    // click dispatch so a partly visible button cannot move before activation.
    clip.scrollLeft = 0
    const resizing = event.target.classList?.contains('p6-column-resizer')
    const left = cell.offsetLeft + (resizing ? event.target.offsetLeft : 0)
    const right = left + (resizing ? event.target.offsetWidth : cell.offsetWidth)
    const target = left < scrollbar.scrollLeft ? left : right > scrollbar.scrollLeft + tablePane ? right - tablePane : scrollbar.scrollLeft
    scrollbar.scrollLeft = Math.max(0, target)
    shellRef.current?.style.setProperty('--p6-table-scroll', `${scrollbar.scrollLeft}px`)
  }
  const barPosition = row => {
    const source = row.kind === 'wbs' ? row.node.summary : row.task
    const milestone = row.kind === 'task' && isScheduleMilestone(row.task)
    const anchor = milestone ? source.display_finish_date || source.display_start_date : source.display_start_date
    const beginning = stamp(anchor), ending = stamp(source.display_finish_date)
    if (!Number.isFinite(beginning) || !Number.isFinite(start) || (!milestone && (!Number.isFinite(ending) || ending < beginning))) return null
    return { left: ((beginning - start) / DAY + (milestone ? .5 : 0)) * dayWidth,
      width: milestone ? 0 : Math.max(2, ((ending - beginning) / DAY + 1) * dayWidth), milestone }
  }
  const taskPositions = new Map(rows.flatMap((row, index) => {
    if (row.kind !== 'task') return []
    const position = barPosition(row)
    return position ? [[String(row.id), { ...position, index }]] : []
  }))
  const dependencies = showTimeline && showLogic ? buildPrimaveraDependencies(rows, taskPositions, ROW_HEIGHT, timelineWidth, { sourceOnly }) : []
  const criticalIds = new Set(rows.filter(row => row.kind === 'task' && row.task.is_critical === true).map(row => String(row.id)))
  const phases = [...new Map(rows.filter(row => row.kind === 'task').map(row => {
    const phase = scheduleActivityColor(row.task, disciplineNames)
    return [phase.key, phase]
  })).values()]
  const originalDurations = tasks.length > 0 && tasks.every(hasOriginalDuration)
    && rows.filter(row => row.kind === 'wbs').every(row => hasOriginalDuration(row.node.summary))
  const durationHeading = originalDurations ? 'Original Duration' : 'Duration'
  const durationHelp = originalDurations ? 'Original durations preserved in their source units; this does not verify a working calendar.'
    : 'Working days in the current plan. WBS durations are calendar spans, not summed effort. Proposed durations remain estimates for review.'
  const floatHelp = plan.calculation_basis === 'source_rule_cpm'
    ? 'Draft total float calculated using the selected planning calendar, source release dates and stage rules. The partial project network still needs dependency review.'
    : plan.calculation_basis === 'draft_cpm'
    ? 'Draft total float in working days, calculated from the current calendar, dependencies and project target. Not verified against the original source schedule.'
    : plan.calculation_basis === 'saved_version_cpm'
      ? 'Total float in working days from the calculated saved schedule version. This does not verify the original source schedule.'
      : 'Calculated total float in working days. A dash means the value is not available.'

  const displayOptions = <div className={displayOptionsTarget ? 'p6-display-options-content' : 'p6-columns-content'} role="group" aria-label="Schedule display options">
    <button type="button" onClick={fitColumns} title="Fit visible activity columns to the table width">Fit columns</button>
    {display !== 'activities' && level !== 'project' && <><button type="button" disabled={!collapsed.size} onClick={() => setCollapsed(new Set())}>Expand all</button><button type="button" disabled={!groupIds.length || groupIds.every(id => collapsed.has(id))} onClick={() => setCollapsed(new Set(groupIds))}>Collapse all</button></>}
    {showTimeline && onTimelineFocusChange && <button type="button" aria-pressed={timelineFocus} onClick={() => onTimelineFocusChange(!timelineFocus)}>Focus timeline</button>}
    {showTimeline && onShowLogicChange && <button type="button" aria-label="Show dependency links" aria-pressed={showLogic} onClick={() => onShowLogicChange(!showLogic)}>Dependency links {showLogic ? 'on' : 'off'}</button>}
    {showTimeline && <label title="Workflow stages use their stage colors. Activities without a stage use their discipline color."><input type="checkbox" checked={stageColors} onChange={event => setStageColors(event.target.checked)} />Color bars by workflow stage</label>}
  </div>

  const displayControls = <div className={`p6-view-controls ${toolbarTarget ? 'p6-controls-portal' : ''}`} role="group" aria-label="Schedule display controls">
    {showTimeline && onZoomChange && <>
      <select aria-label="Timeline scale" value={zoom} onChange={event => changeScale(event.target.value)}>{['day', 'week', 'month'].map(scale => <option key={scale} value={scale}>{scale[0].toUpperCase() + scale.slice(1)}</option>)}</select>
      <button type="button" aria-label="Zoom out" title="Zoom out" disabled={!fitTimeline && zoom === 'month'} onClick={() => changeScale(zoom === 'day' ? 'week' : 'month')}>−</button>
    </>}
    {showTimeline && onFitTimelineChange && <button type="button" className="p6-fit-button" aria-label="Fit timeline" title="Fit timeline" aria-pressed={fitTimeline} onClick={() => onFitTimelineChange(!fitTimeline)}><Maximize size={14} aria-hidden="true" /></button>}
    {showTimeline && onZoomChange && <button type="button" aria-label="Zoom in" title="Zoom in" disabled={!fitTimeline && zoom === 'day'} onClick={() => changeScale(zoom === 'month' ? 'week' : 'day')}>+</button>}
    {showTimeline && <button type="button" className="p6-today-button" disabled={!todayVisible} onClick={scrollToToday} title={todayVisible ? 'Scroll the timeline to today' : 'Today is outside this schedule’s date range'}>Today</button>}
    <details ref={columnsMenuRef} className="p6-columns-menu">
      <summary aria-label="Schedule columns"><Columns size={13} aria-hidden="true" />Columns <span aria-hidden="true">⌄</span></summary>
      <div className="p6-columns-content">
        <fieldset><legend>Visible columns</legend>{COLUMNS.map(column => <label key={column.key} title={editing?.field === column.key ? 'Finish or cancel the cell edit before hiding this column' : undefined}><input type="checkbox" checked={!hiddenColumns.has(column.key)} disabled={column.key === 'activity-name' || editing?.field === column.key} onChange={() => toggleColumn(column.key)} />{column.label}</label>)}</fieldset>
      </div>
    </details>
    {displayOptionsTarget ? createPortal(displayOptions, displayOptionsTarget) : <details ref={moreMenuRef} className="p6-columns-menu p6-more-menu">
      <summary aria-label="Schedule display options" title="More display options"><MoreHorizontal size={16} aria-hidden="true" /></summary>
      {displayOptions}
    </details>}
  </div>

  const legend = <div className={`p6-legend ${legendTarget ? 'p6-legend-portal' : ''}`} role="region" aria-label="Schedule sequence legend"><details ref={legendMenuRef} className="p6-legend-menu" onToggle={event => {
    if (!event.currentTarget.open) return
    const bounds = event.currentTarget.getBoundingClientRect(), popupWidth = Math.min(340, window.innerWidth - 45)
    const left = clamp(bounds.left, 15, window.innerWidth - popupWidth - 15) - bounds.left
    event.currentTarget.style.setProperty('--p6-legend-popup-left', `${left}px`)
  }}><summary aria-label="Schedule legend">Legend <ChevronDown size={12} aria-hidden="true" /></summary><div className="p6-legend-content">
    <span><i style={{ background: '#005bff' }} aria-hidden="true" />Activity</span><span><i style={{ background: '#344f7c' }} aria-hidden="true" />WBS summary</span>
    {allRows.some(row => (row.kind === 'wbs' ? row.node.summary : row.task).display_date_basis === 'source') && <span title="Dates copied from uploaded source evidence; calendar and logic remain unverified."><i style={{ borderStyle: 'dotted' }} aria-hidden="true" />Source dates · not calculated</span>}
    {plan.source_logic && <span title="Dates and float calculated from the planning calendar, source release dates and deterministic stage rules; dependency review remains required.">{plan.calculation_available === true ? 'Calculated planning draft' : 'Planning rules: calculation pending'}</span>}
    {stageColors && phases.map(phase => <span key={phase.key} data-phase={phase.key} data-color-basis={phase.basis} title={phase.basis === 'discipline' ? `${phase.label}: used for activities without a workflow stage` : `Workflow stage: ${phase.label}`}><i style={{ background: phase.color }} aria-hidden="true" />{phase.label}{phase.basis === 'discipline' && <small>discipline</small>}</span>)}
    {tasks.some(isScheduleMilestone) && <span title="Zero-duration events retained from the schedule."><i className="p6-legend-milestone" aria-hidden="true" />Milestone</span>}
    {baselineRows.size > 0 && <span><i className="p6-legend-baseline" aria-hidden="true" />Baseline</span>}
    {criticalIds.size > 0 && <span><i className="p6-legend-critical" aria-hidden="true" />Critical path</span>}{proposed && <span title="Dashed bars indicate proposed duration estimates."><i style={{ borderStyle: 'dashed' }} aria-hidden="true" />Proposed durations</span>}
  </div></details>{showLogic && !legendTarget && <span className="p6-legend-links">{dependencies.length} visible {dependencies.length === 1 ? 'dependency' : 'dependencies'}</span>}</div>

  return <section className="primavera-gantt" aria-label="Schedule activities and Gantt" data-table-typography="preserve" data-view-level={level} data-hidden-columns={[...hiddenColumns].join(' ')} data-timeline-focus={timelineFocus && showTimeline ? 'true' : 'false'} style={{ '--p6-row-height': `${ROW_HEIGHT}px`, '--p6-left-width': `${tablePane}px`, '--p6-table-width': `${tableContentWidth}px`, '--p6-column-tracks': columnTracks, '--p6-gutter': `${gutter}px`, '--p6-split-width': showTimeline ? '6px' : '0px' }}>
    {toolbarTarget ? createPortal(displayControls, toolbarTarget) : <div className="p6-controls"><span className="p6-counts">{deliverableCount > 0 && <><strong>{deliverableCount}</strong> deliverables <span aria-hidden="true">·</span> </>}<strong>{tasks.length}</strong> activities</span>{displayControls}</div>}
    <div ref={shellRef} className="p6-shell">
      <div ref={viewportRef} className="p6-viewport" role="region" aria-label="Scroll project activities and dependencies" tabIndex={0}
        onPointerDownCapture={event => { pointerFocus.current = event.target.closest?.('button, [tabindex]') }}
        onPointerCancelCapture={() => { pointerFocus.current = null }}
        onKeyDownCapture={() => { pointerFocus.current = null }}
        onFocusCapture={event => { if (pointerFocus.current !== event.target) revealColumn(event) }}
        onClickCapture={event => { pointerFocus.current = null; if (!event.target.closest?.('.p6-column-resizer')) revealColumn(event) }}>
        <div className="p6-grid-content"><div role="treegrid" aria-label="Project activity schedule" aria-colcount={visibleColumns.length + (showTimeline ? 2 : 1)}>
        <div className="p6-heading p6-row" role="row"><div className="p6-left-clip"><div className="p6-table-row" role="presentation">
          <span role="columnheader" aria-label="Row number">#</span>{visibleColumns.map(column => <span key={column.key} role="columnheader" data-column={column.key} aria-label={column.key === 'duration' ? durationHeading : column.label} title={column.key === 'duration' ? durationHelp : column.key === 'float' ? floatHelp : column.label} className="p6-resizable-header">
            <span className="p6-column-label">{column.key === 'duration' ? originalDurations ? <>Original <br />Duration</> : 'Duration' : column.key === 'float' ? <>Total <br />Float</> : column.key === 'logic' ? <MoreHorizontal size={14} aria-hidden="true" /> : column.label}</span>
            <span role="separator" aria-label={`Resize ${column.label} column`} aria-orientation="vertical" aria-valuemin={column.min} aria-valuemax={column.max} aria-valuenow={columnWidths[column.key]} aria-valuetext={`${columnWidths[column.key]} pixels`} tabIndex={0} className="p6-column-resizer" title="Drag to resize; double-click to reset"
              onPointerDown={event => { event.preventDefault(); columnDragging.current = { key: column.key, x: event.clientX, width: columnWidths[column.key] }; event.currentTarget.setPointerCapture(event.pointerId) }}
              onPointerMove={event => { if (columnDragging.current?.key === column.key) resizeColumn(column, columnDragging.current.width + event.clientX - columnDragging.current.x) }}
              onPointerUp={event => { columnDragging.current = null; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId) }}
              onPointerCancel={() => { columnDragging.current = null }} onDoubleClick={() => resizeColumn(column, column.width)}
              onKeyDown={event => { if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) { event.preventDefault(); resizeColumn(column, event.key === 'Home' ? column.min : event.key === 'End' ? column.max : columnWidths[column.key] + (event.key === 'ArrowLeft' ? -1 : 1) * (event.shiftKey ? 50 : 10)) } }}
            />
          </span>)}
        </div></div><div className="p6-divider-cell" />{showTimeline && <div className="p6-right-clip" role="columnheader" aria-label="Schedule timeline"><div className="p6-timescale" data-start-date={timeline.startDate} data-finish-date={timeline.finishDate} data-horizon-finish-date={timeline.horizonFinishDate} style={{ width: timelineWidth }}>
          {years.map(item => <span key={`year-${item.offset}`} className="p6-year" style={{ left: item.offset * dayWidth, width: item.length * dayWidth }}><span>{item.label}</span></span>)}
          {months.map(item => <span key={`month-${item.offset}`} className="p6-month" title={item.label} style={{ left: item.offset * dayWidth, width: item.length * dayWidth }}><span>{item.length * dayWidth < 70 ? item.shortLabel : item.label}</span></span>)}
          {ticks.map(item => <span key={item.offset} className="p6-tick" style={{ left: item.offset * dayWidth, width: Math.min(tickStep, days - item.offset) * dayWidth }} title={scheduleDate(item.date)}><span>{item.label}</span></span>)}
          {!timeline.hasDates && <span className="p6-no-dates">Dates have not been set</span>}
        </div></div>}</div>
        <div className="p6-rows" role="rowgroup">{rows.map((row, index) => {
          const summary = row.kind === 'wbs'
          const deliverable = summary && row.node.is_deliverable
          const item = summary ? row.node.summary : row.task
          const summaryHelp = 'Summary timing comes from recorded source values or scheduled child activities and is read only. Expand this group to review its activities.'
          const dateHelp = `${dateEvidenceLabel(item)}${summary ? ` ${summaryHelp}` : ''}`
          const sourceDates = item.display_date_basis === 'source'
          const title = summary ? row.node.name : row.task.title
          const printedSummary = summary && row.node.code_source === 'printed_row_reference'
          const code = printedSummary ? row.node.is_project ? plan.project?.code || '' : '' : summary ? row.node.code : row.task.activity_code
          const codeTitle = printedSummary ? `Source summary, printed row ${row.node.source_row_number}; no WBS code printed` : code
          const treeLabel = printedSummary ? `${title}, source row ${row.node.source_row_number}` : [row.node?.code, title].filter(Boolean).join(' ')
          const position = barPosition(row)
          const baseline = summary ? null : baselineRows.get(String(row.id))
          const phase = summary ? null : scheduleActivityColor(row.task, disciplineNames)
          const workflowPhase = summary ? null : scheduleSequenceStyle(row.task)
          const groupColor = summary && stageColors ? scheduleGroupColor(row.node, disciplineNames) : null
          const barColor = stageColors ? phase?.color : '#005bff'
          const markerColor = !summary && row.task.is_critical === true ? '#ef4444' : barColor
          const stageLabel = summary ? null : row.task.workflow_stage_name || row.task.metadata?.workflow_stage_name
            || (row.task.workflow_stage_code || row.task.metadata?.workflow_stage_code)?.replaceAll('_', ' ')
          const responsible = summary ? '' : row.task.responsible_role || row.task.workflow_responsible_party || row.task.assignee?.name || row.task.owner || 'Unassigned'
          const plannerDuration = ['planner', 'manual', 'retained_manual', 'manual_unverified'].includes(item.duration_source)
          const originalDuration = !plannerDuration && hasOriginalDuration(item)
          const missingDuration = !summary && missingSourceDuration(row.task)
          const proposedDuration = !originalDuration && (summary ? row.node.descendantTasks.some(task => task.duration_source === 'proposed') : row.task.duration_source === 'proposed')
          const durationValue = originalDuration ? item.original_duration_days : item.duration_days
          const durationTitle = missingDuration ? 'Not Specified. No activity-specific planned duration was found in the uploaded documents.' : originalDuration ? 'Original duration preserved from the source schedule.' : summary
            ? `${durationValue == null ? 'Not calculated: review child activity dates, durations and the working calendar.' : `${proposedDuration ? 'Proposed' : 'Current'} calendar span of the activities in this group; not an imported original duration.`} ${summaryHelp}`
            : `${durationEvidenceLabel(row.task)}. Duration in ${durationUnitLabel(row.task)}.`
          const rowSelected = !summary && String(selectedId) === row.id
          const rawTask = row.task?.originalTask || row.task
          const editableWbs = summary && Boolean(canEditWbs?.(row.node))
          const summaryTitle = summary ? `${title}. ${summaryHelp}` : title
          const select = () => { if (!summary) onSelect(rawTask) }
          const edit = field => { if (!summary && !locked) onEdit(rawTask, field) }
          const startCell = (field, event) => {
            if (summary || locked || editing) return
            if (!onCellEdit) { edit(field); return }
            editTrigger.current = event.currentTarget.parentElement
            setEditing({ id: row.id, field })
          }
          const editableCell = (field, value, displayValue, help) => editing?.id === row.id && editing.field === field
            ? <GanttCellEditor key={`${row.id}:${field}`} field={field} title={title} initialValue={value} milestone={isScheduleMilestone(rawTask)}
              onSave={next => onCellEdit(rawTask, field, next)} onClose={closeCell} />
            : <button type="button" disabled={locked || (field === 'duration' && isScheduleMilestone(rawTask))} onClick={event => startCell(field, event)}
              onDoubleClick={event => event.stopPropagation()} aria-label={`Edit ${field} for ${title}`} aria-description={help} title={help}>{displayValue}</button>
          return <div key={`${row.kind}:${row.id}`} role="row" aria-level={display === 'activities' ? 1 : row.depth + 1} aria-expanded={summary ? !collapsed.has(row.id) : undefined} aria-selected={rowSelected}
            data-row-kind={deliverable ? 'deliverable' : row.kind} data-row-id={row.id} data-wbs-node-id={summary ? row.id : row.task.wbs_node_id ?? row.ancestors.at(-1)?.id}
            data-deliverable-id={deliverable ? row.node.deliverable_id : undefined} data-parent-deliverable-id={summary ? undefined : row.task.parent_deliverable_id}
            style={summary ? { '--p6-group-color': groupColor?.color || '#344f7c' } : undefined}
            className={`p6-row ${summary ? `p6-wbs ${rowTone(row.depth)} ${deliverable ? 'p6-deliverable' : ''}` : `p6-task ${row.task.is_critical === true ? 'is-critical' : ''}`} ${rowSelected ? 'is-selected' : ''}`}
            onDoubleClick={() => edit()} onKeyDown={event => { if (event.key === 'F2' && !summary && !locked) { event.preventDefault(); edit() } }}>
            <div className="p6-left-clip"><div className="p6-table-row" role="presentation">
              <span role="gridcell" className="p6-row-number">{index + 1}</span>
              <span role="gridcell" className="p6-code-cell" data-column="activity-code" style={{ paddingLeft: `${Math.min(row.depth, 8) * 6 + 3}px` }} title={codeTitle}>
                <span className="p6-ancestor-rails" aria-hidden="true">{row.ancestors.slice(0, 8).map((ancestor, depth) => <i key={ancestor.id} style={{ background: PALETTE[depth % PALETTE.length] }} />)}</span>
                {summary && level !== 'project' && <button type="button" className="p6-expand" aria-label={`${collapsed.has(row.id) ? 'Expand' : 'Collapse'} ${treeLabel}`} aria-expanded={!collapsed.has(row.id)} onClick={() => toggle(row.id)}>{collapsed.has(row.id) ? <ChevronRight size={12} aria-hidden="true" /> : <ChevronDown size={12} aria-hidden="true" />}</button>}
                {summary && (row.node.is_project ? <CalendarDays className="p6-code-icon" size={12} aria-hidden="true" /> : <Folder className="p6-code-icon" size={12} aria-hidden="true" />)}
                <span>{code || '—'}</span>
              </span>
              <span role="gridcell" data-column="activity-name" className="p6-name-cell" title={summaryTitle}>
                {summary ? <>{hiddenColumns.has('activity-code') && level !== 'project' && <button type="button" className="p6-expand" aria-label={`${collapsed.has(row.id) ? 'Expand' : 'Collapse'} ${treeLabel}`} aria-expanded={!collapsed.has(row.id)} onClick={() => toggle(row.id)}>{collapsed.has(row.id) ? <ChevronRight size={12} aria-hidden="true" /> : <ChevronDown size={12} aria-hidden="true" />}</button>}<strong>{title}</strong>{deliverable && <small className="p6-stage-count" title={`${row.node.descendantTasks.length} ${row.node.descendantTasks.length === 1 ? 'task' : 'tasks'}`}>{row.node.descendantTasks.length} {row.node.descendantTasks.length === 1 ? 'task' : 'tasks'}</small>}</>
                  : <button type="button" className="sc-task-name p6-task-name" aria-label={title} onClick={select}><i className="p6-task-marker" data-color-key={phase.key} data-color-basis={phase.basis} style={{ background: markerColor }} title={`${phase.label}${row.task.is_critical === true ? ' · Critical path' : ''}`} aria-hidden="true" /><span className="p6-task-title">{title}</span></button>}
                {(!summary || editableWbs) && <span className="p6-row-actions" onDoubleClick={event => event.stopPropagation()}>
                  <button type="button" aria-label={`${summary ? 'Edit WBS' : 'Edit activity'} ${title}`} title={summary ? 'Edit WBS details; timing comes from recorded source values or scheduled child activities' : 'Edit activity'} disabled={locked || (summary && !onEditWbs)} onClick={event => { event.stopPropagation(); if (summary) onEditWbs?.(row.node); else onEdit(rawTask) }}><Pencil size={13} aria-hidden="true" /></button>
                  {(!summary || !row.node.is_project) && <button type="button" className="p6-row-delete" aria-label={`${summary ? 'Delete WBS' : 'Delete activity'} ${title}`} title={summary ? 'Review WBS deletion and affected activities' : 'Review activity deletion'} disabled={locked || (summary ? !onDeleteWbs : !onDelete)} onClick={event => { event.stopPropagation(); if (summary) onDeleteWbs?.(row.node); else onDelete?.(rawTask) }}><Trash2 size={13} aria-hidden="true" /></button>}
                </span>}
              </span>
              <span role="gridcell" data-column="stage" title={stageLabel || workflowPhase?.label}>{!summary && (stageLabel || workflowPhase.key !== 'unspecified') ? <span className="p6-workflow-label" style={{ borderColor: workflowPhase.color }}>{stageLabel || workflowPhase.label}</span> : '—'}</span>
              <span role="gridcell" className="p6-numeric" data-column="duration" data-duration-kind={missingDuration ? 'missing_source' : originalDuration ? 'original' : proposedDuration ? 'proposed' : summary ? 'calculated' : 'planned'} title={durationTitle}>{summary ? durationDays(durationValue, durationUnit(item)) : editableCell('duration', rawTask.duration_days, missingDuration ? 'Not Specified' : durationDays(durationValue, plannerDuration ? 'working_days' : durationUnit(item)), isScheduleMilestone(rawTask) ? 'Milestones have zero duration. Edit Start or Finish to move the milestone.' : `${durationTitle} Enter the planner duration in working days.`)}</span>
              <span role="gridcell" data-column="start" data-date-basis={item.display_date_basis} title={dateHelp}>{summary ? displayedDate(item, 'start', true) : editableCell('start', item.display_start_date, displayedDate(item, 'start', false), `${dateHelp}. Set an exact start; finish recalculates from duration and calendar.`)}</span>
              <span role="gridcell" data-column="finish" data-date-basis={item.display_date_basis} title={dateHelp}>{summary ? displayedDate(item, 'finish', true) : editableCell('finish', item.display_finish_date, displayedDate(item, 'finish', false), `${dateHelp}. Set an exact finish; start recalculates from duration and calendar.`)}</span>
              <span role="gridcell" className="p6-numeric" data-column="float" data-float-basis={item.display_float_basis} data-calculation-basis={item.display_float_basis === 'source' ? 'source_document' : plan.calculation_basis} title={`${item.display_float_basis === 'calculated' ? floatHelp : floatEvidenceLabel(item)}${summary ? ` ${summaryHelp}` : ''}`}>{item.display_total_float_days == null ? missingFloatLabel(item, { sourceOnly }) : scheduleNumber(item.display_total_float_days)}</span>
              <span role="gridcell" data-column="logic">{!summary && <button type="button" className="p6-logic-cell-button" disabled={locked} aria-label={`Edit logic for ${title}`}
                title="Edit predecessors, successors, relationship types and lag" onClick={() => onLogicEdit ? onLogicEdit(rawTask) : edit('dependencies')}
                onDoubleClick={event => event.stopPropagation()}><Link2 size={11} aria-hidden="true" /><span>{scheduleDependencyEntries(rawTask, { sourceOnly }).length}</span></button>}</span>
              <span role="gridcell" data-column="responsible" title={responsible}>{responsible || '—'}</span>
            </div></div>
            <div className="p6-divider-cell" />
            {showTimeline && <div className="p6-right-clip" role="gridcell" aria-label={`${title} timeline`}><div className="p6-timeline-row" data-timeline-row-id={row.id} style={{ width: timelineWidth, backgroundSize: `${dayWidth * tickStep}px 100%` }}>
              {baseline && <span className="p6-baseline-bar" role="img" data-baseline-start-date={baseline.startDate} data-baseline-finish-date={baseline.finishDate} style={{ left: (baseline.start - start) / DAY * dayWidth, width: Math.max(2, ((baseline.finish - baseline.start) / DAY + 1) * dayWidth) }} title={`Baseline: ${scheduleDate(baseline.startDate)} to ${scheduleDate(baseline.finishDate)}`} aria-label={`${title} baseline: ${scheduleDate(baseline.startDate)} to ${scheduleDate(baseline.finishDate)}`} />}
              {position && (summary ? <span className={`p6-summary-bar ${sourceDates ? 'is-source-date' : ''}`} data-date-basis={item.display_date_basis} style={{ left: position.left, width: position.width }} title={dateHelp} aria-label={`${title}: ${scheduleDate(item.display_start_date)} to ${scheduleDate(item.display_finish_date)}. ${dateHelp}`} />
                : <button type="button" className={`${position.milestone ? 'p6-milestone' : 'p6-activity-bar'} ${sourceDates ? 'is-source-date' : ''} ${row.task.duration_source === 'proposed' ? 'is-proposed' : ''} ${row.task.is_critical === true ? 'is-critical' : ''}`} data-date-basis={item.display_date_basis} data-phase={phase.key} style={{ left: position.left, '--p6-phase-color': barColor, ...(position.milestone ? {} : { width: position.width }) }} onClick={select} title={`${title}: ${scheduleDate(item.display_start_date)} to ${scheduleDate(item.display_finish_date)}. ${phase.label}. ${dateHelp}${row.task.is_critical === true ? '. Critical path' : ''}`} aria-label={`View ${title}: ${scheduleDate(item.display_start_date)} to ${scheduleDate(item.display_finish_date)}. ${phase.label}. ${dateHelp}${row.task.is_critical === true ? '. Critical path' : ''}`} />)}
              {position && <span aria-hidden="true" className={`p6-bar-label ${summary ? 'is-summary' : ''}`} style={{ left: position.left + position.width + (position.milestone ? 8 : 5) }}>{title}</span>}
              {todayVisible && <span className="p6-today-line" style={{ left: todayX }} title={`Today: ${scheduleDate(iso(today))}`} />}
            </div></div>}
          </div>
        })}</div></div>
        {showTimeline && dependencies.length > 0 && <div className="p6-dependency-clip" style={{ left: tablePane + 6, width: ganttPane, height: rows.length * ROW_HEIGHT }}>
          <svg className="p6-dependency-layer" width={timelineWidth} height={rows.length * ROW_HEIGHT} role="group" aria-label="Activity dependency links">
            <defs>{['normal', 'critical'].map(tone => <marker key={tone} id={`${markerId}-${tone}`} viewBox="0 0 6 6" refX="5" refY="3" markerWidth="6" markerHeight="6" markerUnits="userSpaceOnUse" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill={tone === 'critical' ? '#ef4444' : '#94a3b8'} /></marker>)}</defs>
            {dependencies.map(link => <g key={link.id} className={`p6-dependency ${criticalIds.has(link.predecessorId) && criticalIds.has(link.successorId) ? 'is-critical' : ''}`} role="button" tabIndex={0} aria-label={link.description} onClick={() => !locked && onLogicEdit ? onLogicEdit(link.successor) : onSelect(link.successor)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); if (!locked && onLogicEdit) onLogicEdit(link.successor); else onSelect(link.successor) } }}>
              <title>{link.description}</title>
              <path className="p6-dependency-hit" d={link.path} />
              <path className="p6-dependency-link" data-predecessor-id={link.predecessorId} data-successor-id={link.successorId} data-relationship={link.type} data-lag-days={link.lag} data-source-x={link.sourceX} data-source-y={link.sourceY} data-target-x={link.targetX} data-target-y={link.targetY} d={link.path} markerEnd={`url(#${markerId}-${criticalIds.has(link.predecessorId) && criticalIds.has(link.successorId) ? 'critical' : 'normal'})`} />
              {link.labelText && <text className="p6-dependency-label" x={link.label.x} y={link.label.y}>{link.labelText}</text>}
            </g>)}
          </svg>
        </div>}
        </div>
        {(!rows.length || !tasks.length) && <div className="p6-empty">{tasks.length ? 'No activities match the selected filters.' : <>Add an activity or upload the project documents.<button type="button" onClick={onInputs}>Upload documents / Project inputs</button></>}</div>}
      </div>
      {showTimeline && <div role="separator" aria-label="Resize activity table and Gantt" aria-orientation="vertical" aria-valuemin={Math.round(minSplit)} aria-valuemax={Math.round(maxSplit)} aria-valuenow={Math.round(tablePane)} aria-valuetext={`Activity table ${Math.round(tablePane)} pixels`} tabIndex={0} className="p6-splitter" style={{ left: tablePane }}
        onPointerDown={event => { event.preventDefault(); dragging.current = { x: event.clientX, width: tablePane }; event.currentTarget.setPointerCapture(event.pointerId) }}
        onPointerMove={event => { if (dragging.current) adjustSplit(dragging.current.width + event.clientX - dragging.current.x) }}
        onPointerUp={event => { dragging.current = null; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId) }}
        onPointerCancel={() => { dragging.current = null }}
        onDoubleClick={() => { splitTouched.current = false; onTimelineFocusChange?.(false); setSplit(defaultSplit(width)) }}
        onKeyDown={event => { if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) { event.preventDefault(); adjustSplit(event.key === 'Home' ? minSplit : event.key === 'End' ? maxSplit : tablePane + (event.key === 'ArrowLeft' ? -1 : 1) * (event.shiftKey ? 60 : 20)) } }} />}
      <div className="p6-scrollbars"><div ref={leftScroll} className="p6-horizontal-scroll" role="region" aria-label="Scroll activity columns" tabIndex={0} onScroll={event => scroll('table', event)}><div style={{ width: tableContentWidth }} /></div><span />{showTimeline && <div ref={rightScroll} className="p6-horizontal-scroll" role="region" aria-label="Scroll Gantt timeline" tabIndex={0} onScroll={event => scroll('timeline', event)}><div style={{ width: timelineWidth }} /></div>}</div>
    </div>
    {showTimeline && (legendTarget ? createPortal(legend, legendTarget) : legend)}
  </section>
}

PrimaveraActivitiesGantt.propTypes = {
  plan: PropTypes.object.isRequired, tasks: PropTypes.array.isRequired, disciplines: PropTypes.array.isRequired,
  search: PropTypes.string, discipline: PropTypes.string, criticalOnly: PropTypes.bool, display: PropTypes.string, level: PropTypes.oneOf(['project', 'wbs', 'activities']),
  zoom: PropTypes.oneOf(['day', 'week', 'month']), fitTimeline: PropTypes.bool, selectedId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  locked: PropTypes.bool, showTimeline: PropTypes.bool, showLogic: PropTypes.bool, onSelect: PropTypes.func.isRequired, onEdit: PropTypes.func.isRequired, onInputs: PropTypes.func.isRequired,
  timelineFocus: PropTypes.bool, showBaseline: PropTypes.bool, toolbarTarget: PropTypes.object, legendTarget: PropTypes.object, displayOptionsTarget: PropTypes.object, onTimelineFocusChange: PropTypes.func, onCellEdit: PropTypes.func, onLogicEdit: PropTypes.func,
  onShowLogicChange: PropTypes.func, onZoomChange: PropTypes.func, onFitTimelineChange: PropTypes.func,
  onDelete: PropTypes.func, onEditWbs: PropTypes.func, onDeleteWbs: PropTypes.func, canEditWbs: PropTypes.func,
}
