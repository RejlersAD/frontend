import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { createPortal } from 'react-dom'
import { ChevronDown, ChevronRight, Columns, GitBranch, Maximize, Printer, Trash2 } from 'lucide-react'

const DAY_MS = 86400000
const SUMMARY_HEIGHT = 28
const FIRST_SUMMARY_HEIGHT = 34
const ACTIVITY_HEIGHT = 28
const PRINT_ROWS_PER_PAGE = 40
const PRINT_DETAILS_WIDTH = 650
const PRINT_TIMELINE_WIDTH = 780
const PRINT_ROW_HEIGHT = 23

const COLUMN_LABELS = ['WBS / ID', 'Activity', 'Stage', 'Days', 'Start', 'Finish', 'Float', 'Pred.', 'Responsible', 'Actions']
const DEFAULT_COLUMN_WIDTHS = [100, 272, 88, 64, 106, 106, 52, 45, 120, 30]
const MIN_COLUMN_WIDTHS = [84, 160, 65, 58, 82, 82, 50, 45, 100, 30]
const MAX_COLUMN_WIDTHS = [260, 520, 220, 110, 130, 130, 100, 90, 260, 46]

const clampWidth = (value, index) => Math.min(MAX_COLUMN_WIDTHS[index], Math.max(MIN_COLUMN_WIDTHS[index], value))
const contentWidth = (values, index) => {
  const longest = values.reduce((length, value) => Math.max(length, String(value ?? '').length), COLUMN_LABELS[index].length)
  return clampWidth(Math.ceil(longest * 7.2 + 28), index)
}

const dayValue = value => value ? new Date(`${value}T00:00:00Z`).getTime() : null
const dayDiff = (start, end) => Math.round((end - start) / DAY_MS)
const shortDate = value => new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' }).format(new Date(value))
const displayDate = value => value ? new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`)).replace(/ (\d{4})$/, '$1') : '—'
const stageLabel = stage => ({ COMPANY_REVIEW: 'REVIEW', COMPANY_APPROVAL: 'APPR', FINAL_ISSUE: 'FINAL' }[stage] || stage)
const dayLabel = value => Number.isInteger(Number(value)) ? `${Number(value)}d` : `${Number(value).toFixed(1)}d`

const STAGE_COLORS = {
  IFR: '#2563eb', COMPANY_REVIEW: '#f59e0b', IFA: '#4f46e5',
  COMPANY_APPROVAL: '#8b5cf6', FINAL_ISSUE: '#10b981',
}

const DISCIPLINE_COLORS = {
  process: '#0f766e', piping: '#ea580c', mechanical: '#2563eb', electrical: '#eab308',
  instrumentation: '#7c3aed', civil: '#64748b', structural: '#475569', hse: '#dc2626',
  survey: '#0891b2', pdr: '#4f46e5', epc: '#9333ea', pm: '#334155',
}

const stageTone = stage => ({
  IFR: 'bg-blue-100 text-blue-700',
  COMPANY_REVIEW: 'bg-amber-100 text-amber-800',
  IFA: 'bg-indigo-100 text-indigo-700',
  COMPANY_APPROVAL: 'bg-violet-100 text-violet-700',
  FINAL_ISSUE: 'bg-emerald-100 text-emerald-700',
}[stage] || 'bg-slate-100 text-slate-600')

const barColor = item => {
  return STAGE_COLORS[item.metadata?.workflow_stage_code]
    || DISCIPLINE_COLORS[item.discipline?.toLowerCase()]
    || '#3b82f6'
}

export default function PlannerActivitiesGantt({
  activities, summaries, relationships, search, discipline, criticalOnly,
  immutable, dirtyIds, onUpdate, onDelete, projectName, scheduleName,
  versionLabel, dataDate, calculatedFinish, toolbarTarget,
}) {
  const [expanded, setExpanded] = useState(new Set())
  const [zoom, setZoom] = useState('week')
  const [fitTimeline, setFitTimeline] = useState(false)
  const [viewportWidth, setViewportWidth] = useState(1400)
  const [visibleColumns, setVisibleColumns] = useState(new Set([0, 1, 2, 3, 4, 5]))
  const [selectedId, setSelectedId] = useState(() => activities.find(activity => activity.metadata?.deliverable)?.id || null)
  const viewportRef = useRef(null)
  const [showLogic, setShowLogic] = useState(true)
  const [columnWidths, setColumnWidths] = useState(DEFAULT_COLUMN_WIDTHS)
  const columnResize = useRef(null)
  const markerPrefix = useId().replaceAll(':', '')

  const groups = useMemo(() => {
    const byDeliverable = new Map()
    activities.forEach(activity => {
      const deliverable = activity.metadata?.deliverable
      if (!deliverable) return
      const key = `${activity.discipline}::${deliverable}`
      if (!byDeliverable.has(key)) byDeliverable.set(key, [])
      byDeliverable.get(key).push(activity)
    })
    const needle = search.trim().toLowerCase()
    return (summaries || []).map((summary, index) => {
      const key = `${summary.discipline}::${summary.deliverable}`
      const children = (byDeliverable.get(key) || []).sort((left, right) => (
        Number(left.metadata?.workflow_stage_sequence ?? left.sort_order)
        - Number(right.metadata?.workflow_stage_sequence ?? right.sort_order)
      ))
      const childIds = new Set(children.map(item => item.id))
      const floatValues = children
        .filter(item => item.total_float_days !== null && item.total_float_days !== undefined)
        .map(item => Number(item.total_float_days))
        .filter(Number.isFinite)
      const externalPredecessors = new Set(
        relationships
          .filter(link => childIds.has(link.successor) && !childIds.has(link.predecessor))
          .map(link => link.predecessor),
      )
      return {
        ...summary,
        display_code: summary.wbs_code || `W${String(index + 1).padStart(2, '0')}`,
        key,
        children,
        duration_days: children.reduce((total, item) => total + Number(item.duration_days || 0), 0),
        total_float_days: floatValues.length ? Math.min(...floatValues) : null,
        predecessor_count: externalPredecessors.size,
      }
    }).filter(group => (
      (!needle || group.deliverable.toLowerCase().includes(needle)
        || group.children.some(item => item.external_id.toLowerCase().includes(needle) || item.name.toLowerCase().includes(needle)))
      && (discipline === 'all' || group.discipline === discipline)
      && (!criticalOnly || group.critical_task_count > 0)
    ))
  }, [activities, summaries, relationships, search, discipline, criticalOnly])

  useEffect(() => {
    setExpanded(current => current.size ? current : new Set(groups.slice(0, 3).map(group => group.key)))
  }, [groups])

  const milestoneRows = useMemo(() => activities.filter(activity => (
    !activity.metadata?.deliverable
    && (!search || activity.name.toLowerCase().includes(search.toLowerCase()) || activity.external_id.toLowerCase().includes(search.toLowerCase()))
    && (discipline === 'all' || activity.discipline === discipline)
    && (!criticalOnly || activity.is_critical)
  )), [activities, search, discipline, criticalOnly])

  const rows = useMemo(() => {
    const result = []
    groups.forEach(group => {
      result.push({ kind: 'summary', ...group })
      if (expanded.has(group.key)) group.children.forEach(activity => result.push({ kind: 'activity', activity }))
    })
    milestoneRows.forEach(activity => result.push({ kind: 'activity', activity, standalone: true }))
    return result
  }, [expanded, groups, milestoneRows])

  const displayWidths = columnWidths.map((width, index) => visibleColumns.has(index) ? width : 0)
  const detailsWidth = displayWidths.reduce((sum, width) => sum + width, 0)
  useEffect(() => {
    const element = viewportRef.current
    if (!element) return undefined
    const observer = new ResizeObserver(entries => setViewportWidth(entries[0].contentRect.width))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const fitColumns = () => {
    const values = COLUMN_LABELS.map(label => [label])
    rows.forEach(row => {
      const item = row.kind === 'summary' ? row : row.activity
      values[0].push(row.kind === 'summary' ? 'WBS' : item.external_id)
      values[1].push(row.kind === 'summary' ? row.deliverable : item.name)
      values[2].push(row.kind === 'summary' ? `${row.task_count} tasks` : (item.metadata?.workflow_stage_code || (item.is_milestone ? 'MILESTONE' : '')))
      values[3].push(row.kind === 'summary' ? dayLabel(row.duration_days) : item.duration_days)
      values[4].push(item.planned_start)
      values[5].push(item.planned_finish)
      values[6].push(row.kind === 'summary' ? row.total_float_days : item.total_float_days)
      values[7].push(row.kind === 'summary' ? row.predecessor_count : predecessorCounts[item.id] || 0)
      values[8].push(row.kind === 'summary' ? row.discipline : item.responsible_role)
    })
    setColumnWidths(values.map((column, index) => contentWidth(column, index)))
  }

  useEffect(() => {
    const handlePointerMove = event => {
      const active = columnResize.current
      if (!active) return
      const nextWidth = clampWidth(active.startWidth + event.clientX - active.startX, active.index)
      setColumnWidths(current => current.map((width, index) => index === active.index ? nextWidth : width))
    }
    const handlePointerUp = () => { columnResize.current = null }
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [])

  const startColumnResize = (event, index) => {
    event.preventDefault()
    columnResize.current = { index, startX: event.clientX, startWidth: columnWidths[index] }
  }

  const range = useMemo(() => {
    const dates = rows.flatMap(row => {
      const item = row.kind === 'summary' ? row : row.activity
      return [dayValue(item.planned_start), dayValue(item.planned_finish)].filter(value => value !== null)
    })
    const calculatedEnd = dayValue(calculatedFinish)
    if (Number.isFinite(calculatedEnd) && calculatedEnd !== null) dates.push(calculatedEnd)
    if (!dates.length) return null
    const start = Math.min(...dates)
    const finish = Math.max(...dates)
    return { start, finish, span: Math.max(1, dayDiff(start, finish) + 1) }
  }, [rows, calculatedFinish])

  const timelineWidth = useMemo(() => {
    const available = Math.max(360, viewportWidth - detailsWidth - 16)
    if (!range || fitTimeline) return available
    return Math.max(available, range.span * (zoom === 'day' ? 30 : zoom === 'week' ? 6.7 : 3.6))
  }, [range, zoom, fitTimeline, viewportWidth, detailsWidth])

  const scaleTicks = useMemo(() => {
    if (!range) return []
    const interval = zoom === 'day' ? 1 : zoom === 'week' ? 14 : 28
    const result = []
    for (let offset = 0; offset < range.span; offset += interval) {
      const coveredDays = Math.min(interval, range.span - offset)
      result.push({
        offset, x: (offset / range.span) * timelineWidth,
        width: (coveredDays / range.span) * timelineWidth,
        label: zoom === 'day' ? new Date(range.start + offset * DAY_MS).getUTCDate() : shortDate(range.start + offset * DAY_MS),
      })
    }
    return result
  }, [range, timelineWidth, zoom])

  const geometry = useMemo(() => {
    let top = 0
    const activityMap = new Map()
    const rowGeometry = rows.map((row, index) => {
      const height = row.kind === 'summary' ? (index === 0 ? FIRST_SUMMARY_HEIGHT : SUMMARY_HEIGHT) : ACTIVITY_HEIGHT
      const entry = { row, top, height, center: top + height / 2 }
      if (row.kind === 'activity') activityMap.set(row.activity.id, entry)
      top += height
      return entry
    })
    return { rows: rowGeometry, activityMap, height: top }
  }, [rows])

  const dateX = useCallback((value, finishEdge = false) => {
    if (!range || value === null) return 0
    return ((dayDiff(range.start, value) + (finishEdge ? 1 : 0)) / range.span) * timelineWidth
  }, [range, timelineWidth])

  const logicLines = useMemo(() => {
    if (!range || !showLogic) return []
    return relationships.map(link => {
      const predecessor = geometry.activityMap.get(link.predecessor)
      const successor = geometry.activityMap.get(link.successor)
      if (!predecessor || !successor) return null
      const predecessorItem = predecessor.row.activity
      const successorItem = successor.row.activity
      const type = link.relationship_type || 'FS'
      const fromFinish = type[0] === 'F'
      const toFinish = type[1] === 'F'
      const fromDate = dayValue(fromFinish ? predecessorItem.planned_finish : predecessorItem.planned_start)
      const toDate = dayValue(toFinish ? successorItem.planned_finish : successorItem.planned_start)
      if (fromDate === null || toDate === null) return null
      const fromX = dateX(fromDate, fromFinish)
      const toX = dateX(toDate, toFinish)
      const sourceStubX = fromX + (fromFinish ? 7 : -7)
      const targetStubX = toX + (toFinish ? 7 : -7)
      let routeX
      if (type === 'SS' || type === 'SF') {
        routeX = Math.min(sourceStubX, targetStubX) - 9
      } else if (type === 'FF') {
        routeX = Math.max(sourceStubX, targetStubX) + 9
      } else if (targetStubX > sourceStubX + 18) {
        routeX = sourceStubX + Math.min(18, (targetStubX - sourceStubX) / 2)
      } else {
        routeX = Math.max(sourceStubX, targetStubX) + 12
      }
      const path = `M ${fromX} ${predecessor.center} H ${sourceStubX} H ${routeX} V ${successor.center} H ${targetStubX} H ${toX}`
      return {
        ...link, fromX, toX, sourceStubX, targetStubX, routeX, path,
        fromY: predecessor.center, toY: successor.center,
        critical: predecessorItem.is_critical && successorItem.is_critical,
        predecessorLabel: predecessorItem.external_id,
        successorLabel: successorItem.external_id,
      }
    }).filter(Boolean)
  }, [geometry, range, relationships, showLogic, dateX])

  const predecessorCounts = useMemo(() => relationships.reduce((result, link) => {
    result[link.successor] = (result[link.successor] || 0) + 1
    return result
  }, {}), [relationships])

  const todayX = range ? dateX(dayValue(new Date().toISOString().slice(0, 10))) : null
  const todayVisible = todayX !== null && todayX >= 0 && todayX <= timelineWidth

  const toggle = key => setExpanded(current => {
    const next = new Set(current)
    if (next.has(key)) next.delete(key); else next.add(key)
    return next
  })

  const printGantt = () => {
    const previousTitle = document.title
    const safeName = `${projectName || 'Project'}_${versionLabel || 'Current'}_Gantt_Chart`
      .replace(/[^a-z0-9_-]+/gi, '_').replace(/^_+|_+$/g, '')
    document.title = safeName
    const restore = () => {
      document.title = previousTitle
    }
    window.addEventListener('afterprint', restore, { once: true })
    window.setTimeout(() => {
      window.print()
      // Some embedded browsers do not emit afterprint when the dialog is cancelled.
      window.setTimeout(() => { if (document.title === safeName) restore() }, 1500)
    }, 150)
  }

  const printedAt = new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium', timeStyle: 'short',
  }).format(new Date())
  const printRows = useMemo(() => [
    ...groups.flatMap(group => [
      { kind: 'summary', ...group },
      ...group.children.map(activity => ({ kind: 'activity', activity })),
    ]),
    ...milestoneRows.map(activity => ({ kind: 'activity', activity, standalone: true })),
  ], [groups, milestoneRows])
  const printPages = useMemo(() => {
    const pages = []
    for (let index = 0; index < printRows.length; index += PRINT_ROWS_PER_PAGE) {
      pages.push(printRows.slice(index, index + PRINT_ROWS_PER_PAGE))
    }
    return pages.length ? pages : [[]]
  }, [printRows])
  const printDateX = (value, finishEdge = false) => {
    const date = dayValue(value)
    if (!range || date === null) return 0
    return ((dayDiff(range.start, date) + (finishEdge ? 1 : 0)) / range.span) * PRINT_TIMELINE_WIDTH
  }
  const printTicks = useMemo(() => {
    if (!range) return []
    const interval = zoom === 'day' ? 7 : zoom === 'week' ? 14 : 30
    const ticks = []
    for (let offset = 0; offset < range.span; offset += interval) {
      const width = Math.min(interval, range.span - offset)
      ticks.push({
        offset, label: shortDate(range.start + offset * DAY_MS),
        left: offset / range.span * PRINT_TIMELINE_WIDTH,
        width: width / range.span * PRINT_TIMELINE_WIDTH,
      })
    }
    return ticks
  }, [range, zoom])

  const toolbar = <div className="pg-toolbar">
    <details className="pg-menu"><summary><Columns size={16} />Columns</summary><div className="pg-menu-panel">
      {COLUMN_LABELS.map((label, index) => <label key={label}><input type="checkbox" checked={visibleColumns.has(index)} disabled={index < 2} onChange={() => setVisibleColumns(current => { const next = new Set(current); if (next.has(index)) next.delete(index); else next.add(index); return next })} />{label}</label>)}
      <button type="button" onClick={fitColumns}>Fit columns to content</button>

      <button type="button" onClick={printGantt}><Printer size={15} />Print Gantt</button>
      <button type="button" onClick={() => setExpanded(new Set(groups.map(group => group.key)))}>Expand all</button>
      <button type="button" onClick={() => setExpanded(new Set())}>Collapse all</button>
    </div></details>
    <button type="button" className="pg-logic" aria-pressed={showLogic} onClick={() => setShowLogic(value => !value)}><GitBranch size={16} />{showLogic ? 'Logic on' : 'Logic off'}</button>
    <div className="pg-scale" role="group" aria-label="Timeline scale">{['day', 'week', 'month'].map(value => <button key={value} type="button" aria-pressed={zoom === value} onClick={() => { setZoom(value); setFitTimeline(false) }}>{value[0].toUpperCase() + value.slice(1)}</button>)}</div>
    <button type="button" aria-pressed={fitTimeline} onClick={() => setFitTimeline(value => !value)}><Maximize size={16} />Fit timeline</button>

  </div>
  return (
    <div className="planner-gantt-print-root" data-table-typography="preserve" data-visible-columns={[...visibleColumns].join(" ")}>
      <style>{`
        .planner-gantt-print-document { display: none; }
        @media print {
          @page { size: A3 landscape; margin: 8mm; }
          body * { visibility: hidden !important; }
          .planner-gantt-print-root, .planner-gantt-print-root * { visibility: visible !important; }
          .planner-gantt-print-root { position: absolute !important; inset: 0 auto auto 0 !important; background: white !important; }
          .planner-gantt-screen, .pg-legend, .pg-toolbar-fallback, .planner-gantt-no-print { display: none !important; }
          .planner-gantt-print-document { display: block !important; width: ${PRINT_DETAILS_WIDTH + PRINT_TIMELINE_WIDTH}px; }
          .planner-gantt-print-page { break-after: page; page-break-after: always; }
          .planner-gantt-print-page:last-child { break-after: auto; page-break-after: auto; }
          .planner-gantt-print-root * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}</style>
      {toolbarTarget ? createPortal(toolbar, toolbarTarget) : <div className="pg-toolbar-fallback">{toolbar}</div>}
      <div ref={viewportRef} className="planner-gantt-screen" role="region" aria-label="Activity table and Gantt timeline" tabIndex={0}>
        <div className="sticky top-0 z-50 flex shadow-sm" style={{ width: detailsWidth + timelineWidth, minWidth: detailsWidth + timelineWidth, height: 33 }}>
          <div className="planner-grid-header grid shrink-0 border-b border-r border-slate-400 bg-slate-100 text-xs font-semibold text-slate-600" style={{ width: detailsWidth, minWidth: detailsWidth, height: 33, gridTemplateColumns: displayWidths.map(width => `${width}px`).join(' ') }}>
            {COLUMN_LABELS.map((label, index) => <div key={`${label}-${index}`} style={{ display: visibleColumns.has(index) ? undefined : "none", gridColumn: index + 1 }} className="relative flex min-w-0 items-center overflow-hidden px-2"><span className="truncate">{label}</span>{index < COLUMN_LABELS.length - 1 && <button type="button" aria-label={`Resize ${label || 'action'} column`} title="Drag to resize column" onPointerDown={event => startColumnResize(event, index)} className="absolute -right-1 top-0 z-10 h-full w-2 cursor-col-resize touch-none border-r border-transparent hover:border-violet-500"/>}</div>)}
          </div>
          <div className="shrink-0 overflow-hidden border-b border-slate-400 bg-white" style={{ width: timelineWidth, minWidth: timelineWidth, height: 33 }}>
            {range ? <div style={{ position: 'relative', height: 33 }}>{scaleTicks.map(tick => <div key={tick.offset} className="flex items-center justify-center overflow-hidden whitespace-nowrap border-r border-slate-300 px-1 text-xs font-extrabold text-slate-800" style={{ position: 'absolute', top: 0, height: 33, left: tick.x, width: tick.width }}>{tick.label}</div>)}</div> : <div className="flex h-full items-center px-3 text-xs text-slate-500">Calculate the schedule to display the Gantt chart</div>}
          </div>
        </div>

        <div className="flex w-max flex-row items-start">
        <table className="planner-grid-table shrink-0 table-fixed border-r border-slate-300 text-xs" style={{ width: detailsWidth, minWidth: detailsWidth }}>
          <colgroup>{columnWidths.map((width, index) => visibleColumns.has(index) && <col key={index} style={{ width }}/>)}</colgroup>
          <tbody>{rows.map((row, rowIndex) => {
            if (row.kind === 'summary') {
              const open = expanded.has(row.key)
              const color = DISCIPLINE_COLORS[row.discipline?.toLowerCase()] || '#6d28d9'
              return <tr key={row.key} className="pg-summary-row" style={{ height: rowIndex === 0 ? FIRST_SUMMARY_HEIGHT : SUMMARY_HEIGHT }}><td className="border-l-4 px-2 font-mono font-bold text-violet-700" style={{ borderLeftColor: color }}><button type="button" className="pg-wbs-toggle" aria-label={`${expanded.has(row.key) ? "Collapse" : "Expand"} ${row.deliverable}`} onClick={() => toggle(row.key)}>{open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}{row.display_code}</button></td><td className="overflow-hidden px-2"><button type="button" onClick={() => toggle(row.key)} className="flex w-full min-w-0 items-center gap-2 overflow-hidden text-left font-bold text-slate-900"><span className="truncate">{row.deliverable}</span></button></td><td className="px-2"><span title={`${row.task_count} tasks`}>–</span></td><td className="px-2 font-semibold text-slate-700">{Number(row.duration_days).toFixed(1)}</td><td className="px-2 whitespace-nowrap font-semibold">{displayDate(row.planned_start)}</td><td className="px-2 whitespace-nowrap font-semibold">{displayDate(row.planned_finish)}</td><td className={`px-2 font-semibold ${Number(row.total_float_days) <= 0 ? 'text-rose-600' : 'text-slate-500'}`}>{row.total_float_days ?? '—'}</td><td className="px-2 text-center font-bold text-slate-600">{row.predecessor_count}</td><td className="px-2 capitalize text-slate-500">{row.discipline}</td><td/></tr>
            }
            const activity = row.activity
            const stage = activity.metadata?.workflow_stage_code
            const color = barColor(activity)
            return <tr key={activity.id} onClick={() => setSelectedId(activity.id)} style={{ height: ACTIVITY_HEIGHT }} className={`pg-activity-row ${selectedId === activity.id ? 'is-selected' : ''} ${dirtyIds.has(activity.id) ? 'is-dirty' : ''}`}>
              <td className="overflow-hidden border-l-4 px-2 font-mono font-semibold text-slate-600" style={{ borderLeftColor: color }}><span className="planner-activity-id block truncate" title={activity.external_id}>{activity.external_id}</span></td>
              <td className="overflow-hidden px-2"><div className="flex min-w-0 items-center"><input aria-label={`${activity.external_id} activity name`} title={activity.name} disabled={immutable} value={activity.name} onChange={event => onUpdate(activity.id, 'name', event.target.value)} className={`min-w-0 flex-1 rounded border-0 bg-transparent px-1 py-1 focus:ring-1 focus:ring-violet-400 disabled:text-slate-700 ${row.standalone ? 'font-semibold' : ''}`}/></div></td>
              <td className="overflow-hidden px-2">{stage ? <span className={`inline-block max-w-full truncate rounded-full px-2 py-1 text-xs font-bold ${stageTone(stage)}`}>{stageLabel(stage)}</span> : activity.is_milestone ? <span className="font-bold text-amber-700">MILESTONE</span> : '—'}</td><td className="px-2"><input aria-label={`${activity.external_id} duration in days`} disabled={immutable || activity.is_milestone} type="number" min="0" step="0.25" value={activity.duration_days} onChange={event => onUpdate(activity.id, 'duration_days', event.target.value)} className="w-full rounded bg-transparent px-1 disabled:text-slate-500"/></td><td className="px-2 whitespace-nowrap">{displayDate(activity.planned_start)}</td><td className="px-2 whitespace-nowrap">{displayDate(activity.planned_finish)}</td><td className={`px-2 font-semibold ${Number(activity.total_float_days) <= 0 ? 'text-rose-600' : 'text-slate-500'}`}>{activity.total_float_days ?? '—'}</td><td className="px-2 text-center font-bold text-slate-500">{predecessorCounts[activity.id] || 0}</td><td className="overflow-hidden px-2"><input aria-label={`${activity.external_id} responsible role`} disabled={immutable} value={activity.responsible_role || ''} onChange={event => onUpdate(activity.id, 'responsible_role', event.target.value)} className="w-full min-w-0 rounded bg-transparent px-1"/></td><td className="px-2"><button type="button" aria-label={`Delete ${activity.external_id}`} disabled={immutable} onClick={() => onDelete(activity)} className="text-slate-300 hover:text-rose-600 disabled:opacity-30"><Trash2 className="h-4 w-4"/></button></td></tr>
          })}</tbody>
        </table>

        <div className="relative shrink-0 bg-white" style={{ width: timelineWidth, minWidth: timelineWidth }}>
          <div className="relative" style={{ height: geometry.height }}>
            {geometry.rows.map(({ row, top, height }) => {
              const item = row.kind === 'summary' ? row : row.activity
              const start = dayValue(item.planned_start)
              const finish = dayValue(item.planned_finish)
              const left = start === null ? 0 : dateX(start)
              const right = finish === null ? left : dateX(finish, true)
              const milestone = row.kind === 'activity' && row.activity.is_milestone
              const color = row.kind === 'summary'
                ? (DISCIPLINE_COLORS[row.discipline?.toLowerCase()] || '#6d28d9')
                : barColor(row.activity)
              const gridSize = Math.max(1, timelineWidth / Math.max(1, range?.span || 1) * 7)
              return <div key={row.kind === 'summary' ? row.key : row.activity.id} className={`absolute left-0 border-b border-slate-300 ${row.kind === 'summary' ? 'pg-timeline-summary' : selectedId === row.activity.id ? 'pg-timeline-selected' : 'pg-timeline-activity'}`} style={{ top, height, width: timelineWidth, backgroundImage: `repeating-linear-gradient(to right, transparent 0, transparent ${gridSize - 1}px, rgba(100,116,139,.28) ${gridSize - 1}px, rgba(100,116,139,.28) ${gridSize}px)` }}>
                {start !== null && finish !== null && (milestone
                  ? <div title={`${item.name}: ${item.planned_start}`} className="absolute z-10 h-4 w-4 rotate-45 border border-amber-700 bg-amber-400 shadow-sm" style={{ left: left - 8, top: (height - 16) / 2 }}/>
                  : row.kind === 'summary'
                    ? <div title={`${item.deliverable}: ${item.planned_start} – ${item.planned_finish}`} className="absolute z-10 h-3" style={{ left, top: (height - 8) / 2, width: Math.max(5, right - left) }}><span className="absolute left-0 right-0 top-0 h-[2px] bg-slate-950"/><span className="absolute left-0 top-0 h-2 w-[2px] bg-slate-950"/><span className="absolute right-0 top-0 h-2 w-[2px] bg-slate-950"/><span className="absolute left-0 top-[6px] h-[2px] w-2 origin-left rotate-45 bg-slate-950"/><span className="absolute right-0 top-[6px] h-[2px] w-2 origin-right -rotate-45 bg-slate-950"/></div>
                    : <><div title={`${item.name}: ${item.planned_start} – ${item.planned_finish}`} className="absolute z-10 h-4 rounded-[1px] shadow-sm" style={{ left, top: (height - 17) / 2, width: Math.max(3, right - left), backgroundColor: color, border: item.is_critical ? '2px solid #ff152c' : '1px solid rgba(15,23,42,.35)' }}/>{right - left > 58 && <span className="absolute z-20 truncate px-1 text-[9px] font-bold text-white pg-bar-label" style={{ left: left + 2, top: (height - 16) / 2, maxWidth: right - left - 4 }}>{item.external_id}</span>}</>)}
              </div>
            })}

            {range && <svg className="pointer-events-none absolute inset-0 z-[5] overflow-visible" width={timelineWidth} height={geometry.height} aria-label="Activity relationship lines" shapeRendering="crispEdges">
              <defs>
                <marker id={`${markerPrefix}-arrow`} markerWidth="6" markerHeight="6" refX="5.5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill="#111827"/></marker>
                <marker id={`${markerPrefix}-critical-arrow`} markerWidth="6" markerHeight="6" refX="5.5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill="#dc2626"/></marker>
              </defs>
              {logicLines.map(line => <g key={line.id}>
                <path d={line.path} fill="none" stroke="rgba(255,255,255,.95)" strokeWidth="3.5" strokeLinejoin="miter"/>
                <path d={line.path} fill="none" stroke={line.critical ? '#dc2626' : '#111827'} strokeWidth={line.critical ? 1.6 : 1.1} strokeLinejoin="miter" markerEnd={`url(#${markerPrefix}-${line.critical ? 'critical-arrow' : 'arrow'})`}><title>{line.predecessorLabel} → {line.successorLabel} · {line.relationship_type}{Number(line.lag_days) ? ` ${Number(line.lag_days) > 0 ? '+' : ''}${line.lag_days}d` : ''}</title></path>
                <rect x={line.fromX - 1.5} y={line.fromY - 1.5} width="3" height="3" fill={line.critical ? '#dc2626' : '#111827'}/>
              </g>)}
            </svg>}

            {todayVisible && <div className="pointer-events-none absolute bottom-0 top-0 z-20 border-l-2 border-dashed border-blue-500" style={{ left: todayX }}><span className="absolute left-1 top-1 rounded bg-blue-600 px-1.5 py-0.5 text-[9px] font-bold text-white">TODAY</span></div>}
          </div>
        </div>
        </div>
      </div>

      <div className="pg-legend" aria-label="Schedule stage legend"><strong>Legend:</strong>{[
        ['IFR', 'Issue for review', '#2783ff'], ['Review', 'Company review', '#eda638'], ['IFA', 'Issue for approval', '#6260ff'], ['Approval', 'Company approval', '#9b67ee'], ['Final', 'Final issue', '#27b69c'], ['Critical', 'Critical path', null],
      ].map(([name, description, color]) => <span key={name}><i className={color ? '' : 'pg-critical-key'} style={color ? { background: color } : undefined} /><b>{name}</b> {'\u2013'} {description}</span>)}</div>
      <div className="planner-gantt-print-document">
        {printPages.map((pageRows, pageIndex) => {
          const activityPositions = new Map()
          pageRows.forEach((row, rowIndex) => {
            if (row.kind === 'activity') activityPositions.set(row.activity.id, rowIndex)
          })
          const pageLogic = showLogic ? relationships.map(link => {
            const fromRow = activityPositions.get(link.predecessor)
            const toRow = activityPositions.get(link.successor)
            if (fromRow === undefined || toRow === undefined) return null
            const predecessor = activities.find(item => item.id === link.predecessor)
            const successor = activities.find(item => item.id === link.successor)
            if (!predecessor || !successor) return null
            return {
              id: link.id, fromX: printDateX(predecessor.planned_finish, true),
              toX: printDateX(successor.planned_start),
              fromY: fromRow * PRINT_ROW_HEIGHT + PRINT_ROW_HEIGHT / 2,
              toY: toRow * PRINT_ROW_HEIGHT + PRINT_ROW_HEIGHT / 2,
              critical: predecessor.is_critical && successor.is_critical,
            }
          }).filter(Boolean) : []
          return <section key={pageIndex} className="planner-gantt-print-page bg-white">
            <header className="flex items-start justify-between gap-8 border-b-2 border-slate-900 pb-2">
              <div><h1 className="text-lg font-bold text-slate-950">{projectName || 'Project Schedule'} — Gantt Chart</h1><p className="mt-0.5 text-xs text-slate-600">{scheduleName || 'Master Schedule'} · {versionLabel || 'Current version'}</p></div>
              <div className="grid grid-cols-2 gap-x-5 text-xs text-slate-600"><span>Data date</span><b className="text-slate-900">{dataDate || '—'}</b><span>Calculated finish</span><b className="text-slate-900">{calculatedFinish || '—'}</b><span>Printed</span><b className="text-slate-900">{printedAt}</b></div>
            </header>
            <div className="mt-2 flex border border-slate-500 text-[9px]" style={{ width: PRINT_DETAILS_WIDTH + PRINT_TIMELINE_WIDTH }}>
              <div style={{ width: PRINT_DETAILS_WIDTH }}>
                <div className="grid h-7 items-center border-b border-slate-500 bg-slate-200 font-bold" style={{ gridTemplateColumns: '75px 260px 50px 82px 82px 55px 46px' }}><span className="px-1">ID</span><span className="px-1">Deliverable / Activity</span><span>Dur.</span><span>CPM Start</span><span>CPM Finish</span><span>Float</span><span>Pred.</span></div>
                {pageRows.map(row => {
                  const item = row.kind === 'summary' ? row : row.activity
                  const name = row.kind === 'summary' ? row.deliverable : item.name
                  const id = row.kind === 'summary' ? 'WBS' : item.external_id
                  const duration = row.kind === 'summary' ? row.duration_days : item.duration_days
                  const predecessorCount = row.kind === 'summary' ? row.predecessor_count : predecessorCounts[item.id] || 0
                  return <div key={row.kind === 'summary' ? row.key : item.id} className={`grid items-center border-b border-slate-300 ${row.kind === 'summary' ? 'bg-violet-50 font-bold' : item.is_critical ? 'bg-rose-50' : 'bg-white'}`} style={{ height: PRINT_ROW_HEIGHT, gridTemplateColumns: '75px 260px 50px 82px 82px 55px 46px' }}><span className="truncate px-1 font-mono">{id}</span><span className="truncate px-1">{name}</span><span>{dayLabel(duration || 0)}</span><span>{item.planned_start || '—'}</span><span>{item.planned_finish || '—'}</span><span className={Number(item.total_float_days) <= 0 ? 'font-bold text-rose-700' : ''}>{item.total_float_days ?? '—'}</span><span>{predecessorCount}</span></div>
                })}
              </div>
              <div className="relative border-l border-slate-500" style={{ width: PRINT_TIMELINE_WIDTH }}>
                <div className="relative h-7 border-b border-slate-500 bg-slate-100">{printTicks.map(tick => <span key={tick.offset} className="absolute flex h-7 items-center justify-center border-r border-slate-400 font-bold" style={{ left: tick.left, width: tick.width }}>{tick.label}</span>)}</div>
                <div className="relative" style={{ height: pageRows.length * PRINT_ROW_HEIGHT, backgroundImage: `repeating-linear-gradient(to right, transparent 0, transparent 96px, rgba(100,116,139,.24) 96px, rgba(100,116,139,.24) 97px)` }}>
                  {pageRows.map((row, rowIndex) => {
                    const item = row.kind === 'summary' ? row : row.activity
                    const left = printDateX(item.planned_start)
                    const right = printDateX(item.planned_finish, true)
                    const milestone = row.kind === 'activity' && item.is_milestone
                    const color = row.kind === 'summary' ? '#111827' : barColor(item)
                    return <div key={row.kind === 'summary' ? row.key : item.id} className={`absolute left-0 border-b border-slate-300 ${row.kind === 'summary' ? 'bg-violet-50/50' : item.is_critical ? 'bg-rose-50/40' : ''}`} style={{ top: rowIndex * PRINT_ROW_HEIGHT, height: PRINT_ROW_HEIGHT, width: PRINT_TIMELINE_WIDTH }}>{milestone ? <span className="absolute h-2.5 w-2.5 rotate-45 border border-amber-800 bg-amber-400" style={{ left: left - 5, top: 6 }}/> : <span className="absolute rounded-sm" style={{ left, top: row.kind === 'summary' ? 10 : 7, width: Math.max(3, right - left), height: row.kind === 'summary' ? 3 : 9, backgroundColor: color }}/>}</div>
                  })}
                  {pageLogic.length > 0 && <svg className="absolute inset-0" width={PRINT_TIMELINE_WIDTH} height={pageRows.length * PRINT_ROW_HEIGHT}>{pageLogic.map(line => { const routeX = Math.max(line.fromX + 5, Math.min(PRINT_TIMELINE_WIDTH - 3, (line.fromX + line.toX) / 2)); return <path key={line.id} d={`M ${line.fromX} ${line.fromY} H ${routeX} V ${line.toY} H ${line.toX}`} fill="none" stroke={line.critical ? '#dc2626' : '#334155'} strokeWidth="0.8"/> })}</svg>}
                </div>
              </div>
            </div>
            <footer className="mt-1 flex justify-between text-[9px] text-slate-500"><span>Filtered Gantt · {pageRows.length} rows on this page · Maximum {PRINT_ROWS_PER_PAGE}</span><span>Page {pageIndex + 1} of {printPages.length}</span></footer>
          </section>
        })}
      </div>
    </div>
  )
}

PlannerActivitiesGantt.propTypes = {
  activities: PropTypes.arrayOf(PropTypes.object).isRequired,
  summaries: PropTypes.arrayOf(PropTypes.object).isRequired,
  relationships: PropTypes.arrayOf(PropTypes.object).isRequired,
  search: PropTypes.string.isRequired,
  discipline: PropTypes.string.isRequired,
  criticalOnly: PropTypes.bool.isRequired,
  immutable: PropTypes.bool.isRequired,
  dirtyIds: PropTypes.instanceOf(Set).isRequired,
  onUpdate: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  projectName: PropTypes.string,
  scheduleName: PropTypes.string,
  versionLabel: PropTypes.string, toolbarTarget: PropTypes.object,
  dataDate: PropTypes.string,
  calculatedFinish: PropTypes.string,
}
