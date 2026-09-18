import React, { useEffect, useId, useMemo, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { buildPrimaveraModel, flattenPrimaveraModel, isScheduleMilestone, scheduleDate, scheduleNumber } from '../../utils/primaveraSchedule'
import { buildPrimaveraTimeline } from '../../utils/primaveraTimeline'
import { buildPrimaveraDependencies, scheduleSequenceStyle } from '../../utils/primaveraDependencies'
import './PrimaveraActivitiesGantt.css'

const DAY = 86400000
const PALETTE = ['#102bc5', '#62e648', '#fff04b', '#244fc6', '#bd2027']
const stamp = value => value ? Date.parse(`${String(value).slice(0, 10)}T00:00:00Z`) : NaN
const iso = value => new Date(value).toISOString().slice(0, 10)
const rowTone = depth => `p6-level-${depth % PALETTE.length}`
const clamp = (value, min, max) => Math.max(min, Math.min(max, value))
const defaultSplit = available => Math.max(400, available * .4)
const hasOriginalDuration = item => item?.original_duration_days != null && item.original_duration_days !== '' && Number.isFinite(Number(item.original_duration_days))
const durationDays = value => {
  const formatted = scheduleNumber(value)
  return formatted === '\u2014' ? formatted : `${formatted} d`
}
const COLUMNS = [
  { key: 'activity-code', label: 'Activity ID', width: 120, min: 60, max: 480 },
  { key: 'activity-name', label: 'Activity Name', width: 220, min: 100, max: 1200 },
  { key: 'duration', label: 'Duration', width: 72, min: 50, max: 240 },
  { key: 'start', label: 'Start', width: 80, min: 70, max: 240 },
  { key: 'finish', label: 'Finish', width: 80, min: 70, max: 240 },
  { key: 'float', label: 'Total Float', width: 64, min: 50, max: 240 },
]

export default function PrimaveraActivitiesGantt({ plan, tasks, disciplines, search = '', discipline = 'all', criticalOnly = false,
  display = 'deliverables', zoom = 'week', fitTimeline = false, selectedId, locked = false, showTimeline = true, showLogic = true,
  timelineFocus = false, onTimelineFocusChange, onSelect, onEdit, onInputs }) {
  const [collapsed, setCollapsed] = useState(new Set())
  const [width, setWidth] = useState(1100)
  const [split, setSplit] = useState(() => defaultSplit(1100))
  const [columnWidths, setColumnWidths] = useState(() => Object.fromEntries(COLUMNS.map(column => [column.key, column.width])))
  const [gutter, setGutter] = useState(0)
  const markerId = `p6-arrow-${useId().replaceAll(':', '')}`
  const shellRef = useRef(null)
  const viewportRef = useRef(null)
  const leftScroll = useRef(null)
  const rightScroll = useRef(null)
  const dragging = useRef(null)
  const columnDragging = useRef(null)
  const pointerFocus = useRef(null)
  const splitTouched = useRef(false)
  const minSplit = Math.min(280, width * .42)
  const maxSplit = Math.max(minSplit, width - 170)
  const tablePane = showTimeline ? clamp(timelineFocus ? minSplit : split, minSplit, maxSplit) : width
  const tableContentWidth = 30 + COLUMNS.reduce((total, column) => total + columnWidths[column.key], 0)
  const columnTracks = `30px ${COLUMNS.map(column => `${columnWidths[column.key]}px`).join(' ')}`
  const ganttPane = Math.max(160, width - tablePane - 6)
  const model = useMemo(() => buildPrimaveraModel(plan, tasks, disciplines), [plan, tasks, disciplines])
  const rows = useMemo(() => flattenPrimaveraModel(model, { search, discipline, criticalOnly, collapsed, flat: display === 'activities' }), [model, search, discipline, criticalOnly, collapsed, display])
  const timeline = useMemo(() => buildPrimaveraTimeline({ plan, tasks, paneWidth: ganttPane, zoom, fit: fitTimeline }), [plan, tasks, ganttPane, zoom, fitTimeline])
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
  const scroll = (side, event) => shellRef.current?.style.setProperty(side === 'table' ? '--p6-table-scroll' : '--p6-timeline-scroll', `${event.currentTarget.scrollLeft}px`)
  const toggle = id => setCollapsed(current => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next })
  const adjustSplit = value => { splitTouched.current = true; onTimelineFocusChange?.(false); setSplit(clamp(value, minSplit, maxSplit)) }
  const resizeColumn = (column, value) => setColumnWidths(current => ({ ...current, [column.key]: clamp(value, column.min, column.max) }))
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
    const anchor = milestone ? source.planned_finish_date || source.planned_start_date : source.planned_start_date
    const beginning = stamp(anchor), ending = stamp(source.planned_finish_date)
    if (!Number.isFinite(beginning) || !Number.isFinite(start) || (!milestone && (!Number.isFinite(ending) || ending < beginning))) return null
    return { left: ((beginning - start) / DAY + (milestone ? .5 : 0)) * dayWidth,
      width: milestone ? 0 : Math.max(2, ((ending - beginning) / DAY + 1) * dayWidth), milestone }
  }
  const taskPositions = new Map(rows.flatMap((row, index) => {
    if (row.kind !== 'task') return []
    const position = barPosition(row)
    return position ? [[String(row.id), { ...position, index }]] : []
  }))
  const dependencies = showTimeline && showLogic ? buildPrimaveraDependencies(rows, taskPositions, 16, timelineWidth) : []
  const phases = [...new Map(rows.filter(row => row.kind === 'task').map(row => {
    const phase = scheduleSequenceStyle(row.task)
    return [phase.key, phase]
  })).values()]
  const originalDurations = tasks.length > 0 && tasks.every(hasOriginalDuration)
    && rows.filter(row => row.kind === 'wbs').every(row => hasOriginalDuration(row.node.summary))
  const durationHeading = originalDurations ? 'Original Duration' : 'Duration'
  const durationHelp = originalDurations ? 'Original working-day durations preserved from the source schedule.'
    : 'Working days in the current plan. WBS durations are calendar spans, not summed effort. Proposed durations remain estimates for review.'
  const floatHelp = plan.calculation_basis === 'draft_cpm'
    ? 'Draft total float in working days, calculated from the current calendar, dependencies and project target. Not verified against the original source schedule.'
    : plan.calculation_basis === 'saved_version_cpm'
      ? 'Total float in working days from the calculated saved schedule version. This does not verify the original source schedule.'
      : 'Calculated total float in working days. A dash means the value is not available.'

  return <section className="primavera-gantt" aria-label="Schedule activities and Gantt" data-timeline-focus={timelineFocus && showTimeline ? 'true' : 'false'} style={{ '--p6-left-width': `${tablePane}px`, '--p6-table-width': `${tableContentWidth}px`, '--p6-column-tracks': columnTracks, '--p6-gutter': `${gutter}px`, '--p6-split-width': showTimeline ? '6px' : '0px' }}>
    <div ref={shellRef} className="p6-shell">
      <div ref={viewportRef} className="p6-viewport" role="region" aria-label="Scroll project activities and dependencies" tabIndex={0}
        onPointerDownCapture={event => { pointerFocus.current = event.target.closest?.('button, [tabindex]') }}
        onPointerCancelCapture={() => { pointerFocus.current = null }}
        onKeyDownCapture={() => { pointerFocus.current = null }}
        onFocusCapture={event => { if (pointerFocus.current !== event.target) revealColumn(event) }}
        onClickCapture={event => { pointerFocus.current = null; if (!event.target.closest?.('.p6-column-resizer')) revealColumn(event) }}>
        <div className="p6-grid-content"><div role="treegrid" aria-label="Project activity schedule" aria-colcount={showTimeline ? 8 : 7}>
        <div className="p6-heading p6-row" role="row"><div className="p6-left-clip"><div className="p6-table-row" role="presentation">
          <span role="columnheader" aria-label="Row number">#</span>{COLUMNS.map(column => <span key={column.key} role="columnheader" data-column={column.key} aria-label={column.key === 'duration' ? durationHeading : column.label} title={column.key === 'duration' ? durationHelp : column.key === 'float' ? floatHelp : column.label} className="p6-resizable-header">
            <span className="p6-column-label">{column.key === 'duration' ? originalDurations ? <>Original <br />Duration</> : 'Duration' : column.key === 'float' ? <>Total <br />Float</> : column.label}</span>
            <span role="separator" aria-label={`Resize ${column.label} column`} aria-orientation="vertical" aria-valuemin={column.min} aria-valuemax={column.max} aria-valuenow={columnWidths[column.key]} aria-valuetext={`${columnWidths[column.key]} pixels`} tabIndex={0} className="p6-column-resizer" title="Drag to resize; double-click to reset"
              onPointerDown={event => { event.preventDefault(); columnDragging.current = { key: column.key, x: event.clientX, width: columnWidths[column.key] }; event.currentTarget.setPointerCapture(event.pointerId) }}
              onPointerMove={event => { if (columnDragging.current?.key === column.key) resizeColumn(column, columnDragging.current.width + event.clientX - columnDragging.current.x) }}
              onPointerUp={event => { columnDragging.current = null; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId) }}
              onPointerCancel={() => { columnDragging.current = null }} onDoubleClick={() => resizeColumn(column, column.width)}
              onKeyDown={event => { if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) { event.preventDefault(); resizeColumn(column, event.key === 'Home' ? column.min : event.key === 'End' ? column.max : columnWidths[column.key] + (event.key === 'ArrowLeft' ? -1 : 1) * (event.shiftKey ? 50 : 10)) } }}
            />
          </span>)}
        </div></div><div className="p6-divider-cell" />{showTimeline && <div className="p6-right-clip" role="columnheader" aria-label="Schedule timeline"><div className="p6-timescale" data-start-date={timeline.startDate} data-finish-date={timeline.finishDate} data-horizon-finish-date={timeline.horizonFinishDate} style={{ width: timelineWidth }}>
          {years.map(item => <span key={`year-${item.offset}`} className="p6-year" style={{ left: item.offset * dayWidth, width: item.length * dayWidth }}>{item.label}</span>)}
          {months.map(item => <span key={`month-${item.offset}`} className="p6-month" title={item.label} style={{ left: item.offset * dayWidth, width: item.length * dayWidth }}>{item.length * dayWidth < 70 ? item.shortLabel : item.label}</span>)}
          {ticks.map(item => <span key={item.offset} className="p6-tick" style={{ left: item.offset * dayWidth, width: Math.min(tickStep, days - item.offset) * dayWidth }} title={scheduleDate(item.date)}>{item.label}</span>)}
          {!timeline.hasDates && <span className="p6-no-dates">Dates have not been set</span>}
        </div></div>}</div>
        <div className="p6-rows" role="rowgroup">{rows.map((row, index) => {
          const summary = row.kind === 'wbs'
          const deliverable = summary && row.node.is_deliverable
          const item = summary ? row.node.summary : row.task
          const title = summary ? row.node.name : row.task.title
          const code = summary ? row.node.code : row.task.activity_code
          const position = barPosition(row)
          const phase = summary ? null : scheduleSequenceStyle(row.task)
          const stageLabel = summary ? null : row.task.workflow_stage_name || row.task.metadata?.workflow_stage_name
            || (row.task.workflow_stage_code || row.task.metadata?.workflow_stage_code)?.replaceAll('_', ' ')
          const originalDuration = hasOriginalDuration(item)
          const proposedDuration = !originalDuration && (summary ? row.node.descendantTasks.some(task => task.duration_source === 'proposed') : row.task.duration_source === 'proposed')
          const durationValue = originalDuration ? item.original_duration_days : item.duration_days
          const durationTitle = originalDuration ? 'Original duration preserved from the source schedule.' : summary
            ? `${proposedDuration ? 'Proposed' : 'Current'} calendar span of the activities in this group; not an imported original duration.`
            : proposedDuration ? 'Proposed duration; review before approval' : 'Current planned duration in working days'
          const rowSelected = !summary && String(selectedId) === row.id
          const rawTask = row.task?.originalTask
          const select = () => { if (!summary) onSelect(rawTask) }
          const edit = field => { if (!summary && !locked) onEdit(rawTask, field) }
          return <div key={`${row.kind}:${row.id}`} role="row" aria-level={display === 'activities' ? 1 : row.depth + 1} aria-expanded={summary ? !collapsed.has(row.id) : undefined} aria-selected={rowSelected}
            data-row-kind={deliverable ? 'deliverable' : row.kind} data-row-id={row.id} data-wbs-node-id={summary ? row.id : row.task.wbs_node_id ?? row.ancestors.at(-1)?.id}
            data-deliverable-id={deliverable ? row.node.deliverable_id : undefined} data-parent-deliverable-id={summary ? undefined : row.task.parent_deliverable_id}
            className={`p6-row ${summary ? `p6-wbs ${rowTone(row.depth)} ${deliverable ? 'p6-deliverable' : ''}` : 'p6-task'} ${rowSelected ? 'is-selected' : ''}`}
            onDoubleClick={() => edit()} onKeyDown={event => { if (event.key === 'F2' && !summary && !locked) { event.preventDefault(); edit() } }}>
            <div className="p6-left-clip"><div className="p6-table-row" role="presentation">
              <span role="gridcell" className="p6-row-number">{index + 1}</span>
              <span role="gridcell" className="p6-code-cell" data-column="activity-code" style={{ paddingLeft: `${Math.min(row.depth, 8) * 6 + 3}px` }} title={code}>
                <span className="p6-ancestor-rails" aria-hidden="true">{row.ancestors.slice(0, 8).map((ancestor, depth) => <i key={ancestor.id} style={{ background: PALETTE[depth % PALETTE.length] }} />)}</span>
                {summary && <button type="button" className="p6-expand" aria-label={`${collapsed.has(row.id) ? 'Expand' : 'Collapse'} ${[row.node.code, title].filter(Boolean).join(' ')}`} aria-expanded={!collapsed.has(row.id)} onClick={() => toggle(row.id)}>{collapsed.has(row.id) ? '+' : '−'}</button>}
                <span>{code || '—'}</span>
              </span>
              <span role="gridcell" data-column="activity-name" className="p6-name-cell" title={title}>{summary ? <><strong>{title}</strong>{deliverable && <small className="p6-stage-count">{row.node.descendantTasks.length} {row.node.descendantTasks.length === 1 ? 'task' : 'tasks'}</small>}</> : <button type="button" className={`sc-task-name p6-task-name ${stageLabel ? 'has-workflow' : ''}`} aria-label={title} onClick={select}>{stageLabel && <span className="p6-workflow-label" style={{ borderColor: phase.color }}>{stageLabel}</span>}<span className="p6-task-title">{title}</span></button>}</span>
              <span role="gridcell" className="p6-numeric" data-column="duration" data-duration-kind={originalDuration ? 'original' : proposedDuration ? 'proposed' : summary ? 'calculated' : 'planned'} title={durationTitle}>{summary ? durationDays(durationValue) : <button type="button" disabled={locked} onClick={() => edit('duration')} aria-label={`Edit duration for ${title}`} aria-description={durationTitle} title={durationTitle}>{durationDays(durationValue)}</button>}</span>
              <span role="gridcell" data-column="start">{summary ? scheduleDate(item.planned_start_date) : <button type="button" disabled={locked} onClick={() => edit('start')} aria-label={`Edit start for ${title}`}>{scheduleDate(item.planned_start_date)}</button>}</span>
              <span role="gridcell" data-column="finish">{scheduleDate(item.planned_finish_date)}</span>
              <span role="gridcell" className="p6-numeric" data-column="float" data-calculation-basis={plan.calculation_basis} title={item.total_float_days == null ? 'Total float has not been calculated for this row.' : floatHelp}>{scheduleNumber(item.total_float_days)}</span>
            </div></div>
            <div className="p6-divider-cell" />
            {showTimeline && <div className="p6-right-clip" role="gridcell" aria-label={`${title} timeline`}><div className="p6-timeline-row" data-timeline-row-id={row.id} style={{ width: timelineWidth, backgroundSize: `${dayWidth * tickStep}px 3px` }}>
              {position && (summary ? <span className="p6-summary-bar" style={{ left: position.left, width: position.width }} aria-label={`${title}: ${scheduleDate(item.planned_start_date)} to ${scheduleDate(item.planned_finish_date)}`} />
                : <button type="button" className={`${position.milestone ? 'p6-milestone' : 'p6-activity-bar'} ${row.task.duration_source === 'proposed' ? 'is-proposed' : ''} ${row.task.is_critical === true ? 'is-critical' : ''}`} data-phase={phase.key} style={{ left: position.left, '--p6-phase-color': phase.color, ...(position.milestone ? {} : { width: position.width }) }} onClick={select} title={`${title}: ${scheduleDate(item.planned_start_date)} to ${scheduleDate(item.planned_finish_date)}. ${phase.label}${row.task.is_critical === true ? '. Critical path' : ''}`} aria-label={`View ${title}: ${scheduleDate(item.planned_start_date)} to ${scheduleDate(item.planned_finish_date)}. ${phase.label}${row.task.is_critical === true ? '. Critical path' : ''}`} />)}
              {position && <span className={`p6-bar-label ${summary ? 'is-summary' : ''}`} style={{ left: position.left + position.width + (position.milestone ? 8 : 5) }}>{title}</span>}
              {todayVisible && <span className="p6-today-line" style={{ left: todayX }} title={`Today: ${scheduleDate(iso(today))}`} />}
            </div></div>}
          </div>
        })}</div></div>
        {showTimeline && dependencies.length > 0 && <div className="p6-dependency-clip" style={{ left: tablePane + 6, width: ganttPane, height: rows.length * 16 }}>
          <svg className="p6-dependency-layer" width={timelineWidth} height={rows.length * 16} role="group" aria-label="Activity dependency links">
            <defs><marker id={markerId} viewBox="0 0 6 6" refX="5" refY="3" markerWidth="6" markerHeight="6" markerUnits="userSpaceOnUse" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#53677f" /></marker></defs>
            {dependencies.map(link => <g key={link.id} className="p6-dependency" role="button" tabIndex={0} aria-label={link.description} onClick={() => onSelect(link.successor)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(link.successor) } }}>
              <title>{link.description}</title>
              <path className="p6-dependency-hit" d={link.path} />
              <path className="p6-dependency-link" data-predecessor-id={link.predecessorId} data-successor-id={link.successorId} data-relationship={link.type} data-lag-days={link.lag} data-source-x={link.sourceX} data-source-y={link.sourceY} data-target-x={link.targetX} data-target-y={link.targetY} d={link.path} markerEnd={`url(#${markerId})`} />
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
    {showTimeline && <div className="p6-legend" role="region" aria-label="Schedule sequence legend" tabIndex={0}>{phases.map(phase => <span key={phase.key} data-phase={phase.key}><i style={{ background: phase.color }} aria-hidden="true" />{phase.label}</span>)}{tasks.some(isScheduleMilestone) && <span><i className="p6-legend-milestone" aria-hidden="true" />Milestone</span>}{tasks.some(task => task.is_critical === true) && <span><i className="p6-legend-critical" aria-hidden="true" />Critical path</span>}{proposed && <span title="Dashed bars indicate proposed duration estimates."><i style={{ borderStyle: 'dashed' }} aria-hidden="true" />Proposed durations</span>}{showLogic && <span className="p6-legend-links">{dependencies.length} visible {dependencies.length === 1 ? 'dependency' : 'dependencies'}</span>}</div>}
  </section>
}

PrimaveraActivitiesGantt.propTypes = {
  plan: PropTypes.object.isRequired, tasks: PropTypes.array.isRequired, disciplines: PropTypes.array.isRequired,
  search: PropTypes.string, discipline: PropTypes.string, criticalOnly: PropTypes.bool, display: PropTypes.string,
  zoom: PropTypes.oneOf(['day', 'week', 'month']), fitTimeline: PropTypes.bool, selectedId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  locked: PropTypes.bool, showTimeline: PropTypes.bool, showLogic: PropTypes.bool, onSelect: PropTypes.func.isRequired, onEdit: PropTypes.func.isRequired, onInputs: PropTypes.func.isRequired,
  timelineFocus: PropTypes.bool, onTimelineFocusChange: PropTypes.func,
}
