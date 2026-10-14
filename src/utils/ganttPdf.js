import { jsPDF } from 'jspdf'
import { buildPrimaveraModel, flattenPrimaveraModel, isScheduleMilestone, scheduleDate, scheduleNumber } from './primaveraSchedule'
import { missingDateLabel, missingFloatLabel } from './planningDateEvidence'
import { durationUnit, missingSourceDuration } from './planningDurationEvidence'
import { scheduleActivityColor, scheduleGroupColor } from './primaveraColors'
import { scheduleDependencyEntries } from './primaveraDependencies'

const DAY = 86400000
const INK = '#10264b', BLUE = '#0060ff', GRID = '#dce5f1', MUTED = '#64748b', CRITICAL = '#ef4444'
const finite = value => value != null && value !== '' && Number.isFinite(Number(value))
const timestamp = value => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return NaN
  const result = Date.parse(`${value}T00:00:00Z`)
  return Number.isFinite(result) && new Date(result).toISOString().slice(0, 10) === value ? result : NaN
}
const iso = value => new Date(value).toISOString().slice(0, 10)
// Normalize typographic punctuation supported inconsistently by PDF base fonts.
const printable = value => {
  const result = String(value ?? '').replace(/[\u2010-\u2015\u2212]/g, '-').replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/\u2026/g, '...').replace(/\u2192/g, ' -> ')
  // Do not silently corrupt names that the bundled PDF base font cannot draw.
  if (/[^\u0020-\u007e\u00a0-\u00ff\u0152\u0153\u0160\u0161\u0178\u017d\u017e\u0192\u02c6\u02dc\u2020\u2021\u2022\u2030\u2039\u203a\u20ac]/.test(result.replace(/\s/g, ''))) {
    throw new Error('PDF export currently supports Latin text. This schedule contains characters that cannot be rendered faithfully.')
  }
  return result
}
const yieldToBrowser = () => new Promise(resolve => setTimeout(resolve, 0))

function duration(item, summary) {
  const planner = ['planner', 'manual', 'retained_manual', 'manual_unverified'].includes(item.duration_source)
  const original = !planner && finite(item.original_duration_days)
  const value = original ? item.original_duration_days : item.duration_days
  if (!summary && missingSourceDuration(item)) return 'Not Specified'
  if (!finite(value)) return '-'
  const unit = { hours: 'h', weeks: 'w', months: 'mo', calendar_days: 'cd' }[planner && !summary ? 'working_days' : durationUnit(item)] || 'd'
  return `${scheduleNumber(value)} ${unit}`
}

function baseline(task) {
  const start = timestamp(task.baseline_start_date), finish = timestamp(task.baseline_finish_date)
  return Number.isFinite(start) && Number.isFinite(finish) && finish >= start ? { start, finish } : null
}

function text(doc, value, x, y, { size = 8, bold = false, color = INK, ...options } = {}) {
  doc.setFont('helvetica', bold ? 'bold' : 'normal').setFontSize(size).setTextColor(color)
  doc.text(Array.isArray(value) ? value.map(printable) : printable(value), x, y, options)
}

function line(doc, x1, y1, x2, y2, color = GRID, width = 0.4) {
  doc.setDrawColor(color).setLineWidth(width).line(x1, y1, x2, y2)
}

function diamond(doc, x, y, radius, color) {
  doc.setFillColor(color).setDrawColor(color)
  doc.lines([[radius, radius], [-radius, radius], [-radius, -radius], [radius, -radius]], x, y - radius, [1, 1], 'F', true)
}

/** Export the schedule model, never a screenshot of the virtualized viewport. */
export async function createGanttPdf({ plan, tasks, disciplines = [], scope = 'all', filters = {}, paper = 'a3', zoom = 'week', showLogic = true, showBaseline = false }) {
  if (!plan || !Array.isArray(tasks)) throw new Error('The schedule is not available for PDF export.')
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: paper === 'a4' ? 'a4' : 'a3', compress: true, precision: 3 })
  const pageWidth = doc.internal.pageSize.getWidth(), pageHeight = doc.internal.pageSize.getHeight()
  const margin = 28, available = pageWidth - margin * 2, bottom = pageHeight - 68
  const sourceOnly = plan.duration_policy === 'source_only' || plan.evidence_policy === 'document_driven' || Boolean(plan.duration_review)
  const rows = flattenPrimaveraModel(buildPrimaveraModel(plan, tasks, disciplines), scope === 'filtered' ? {
    search: filters.search || '', discipline: filters.discipline || 'all', criticalOnly: Boolean(filters.criticalOnly),
  } : {})
  if (!rows.length) throw new Error('No schedule rows match this export. Clear the filters and try again.')
  const names = new Map(disciplines.map(item => [String(item.code), item.name]))
  const project = plan.project || {}
  const projectName = project.name || plan.project_name || 'Project schedule'
  const version = plan.version_number ?? plan.canonical_version?.version_number ?? plan.canonical_version?.version
  const versionId = plan.version_id ?? plan.canonical_version?.id
  const state = plan.viewing_history ? 'Historical snapshot' : plan.state === 'baselined' ? 'Baseline snapshot' : plan.state === 'submitted' ? 'In review' : 'Draft'
  const context = `${project.code || project.id || ''} | ${state}${version != null ? ` | Version ${version}` : versionId != null ? ` | Schedule ID ${versionId}` : ' | Working schedule'} | ${scope === 'filtered' ? 'Filtered schedule' : 'Full schedule'}`
  const filterLabel = scope === 'filtered' ? [filters.search && `Search: ${filters.search}`, filters.discipline && filters.discipline !== 'all' && `Discipline: ${names.get(filters.discipline) || filters.discipline}`, filters.criticalOnly && 'Critical activities only'].filter(Boolean).join(' | ') : ''
  const columns = [{ label: '#', width: 24 }, { label: 'Activity ID', width: 67 },
    { label: 'Activity / WBS name', width: paper === 'a4' ? 151 : 211 },
    { label: 'Duration', width: 48 }, { label: 'Start', width: 65 }, { label: 'Finish', width: 65 }, { label: 'Total float', width: 58 }]
  let offset = margin
  for (const column of columns) { column.x = offset; offset += column.width }
  const timelineX = offset, timelineWidth = pageWidth - margin - timelineX
  const titleLines = doc.setFont('helvetica', 'bold').setFontSize(14).splitTextToSize(printable(projectName), available)
  const contextLines = doc.setFont('helvetica', 'normal').setFontSize(8).splitTextToSize(printable(context), available)
  const filterLines = filterLabel ? doc.splitTextToSize(printable(filterLabel), available) : []
  const headingBottom = 38 + titleLines.length * 16 + contextLines.length * 10 + filterLines.length * 10
  const headerTop = headingBottom + 24, bodyTop = headerTop + 34
  if (bodyTop > bottom - 80) throw new Error('The project title or filter is too long to fit on a PDF page.')
  const prepared = rows.map((row, index) => {
    const summary = row.kind === 'wbs', item = summary ? row.node.summary : row.task
    const node = row.node, style = summary ? scheduleGroupColor(node, names) : scheduleActivityColor(item, names)
    const critical = !summary && item.is_critical === true
    const color = critical ? CRITICAL : style?.color || '#344e78'
    const indent = Math.min(row.depth, 8) * 7
    const code = summary ? node.code_source === 'printed_row_reference' ? node.is_project ? project.code || '' : '' : node.code || '' : item.activity_code || String(row.id)
    const dateBasis = ['source', 'proposed', 'planner'].includes(item.display_date_basis) ? ` (${item.display_date_basis})` : ''
    const values = [String(index + 1), code, summary ? node.name : item.title || item.name || '', duration(item, summary),
      item.display_start_date ? scheduleDate(item.display_start_date) + dateBasis : missingDateLabel(item, 'start', { sourceOnly, summary }),
      item.display_finish_date ? scheduleDate(item.display_finish_date) + dateBasis : missingDateLabel(item, 'finish', { sourceOnly, summary }),
      finite(item.display_total_float_days) ? `${scheduleNumber(item.display_total_float_days)} d${item.display_float_basis === 'source' ? ' (source)' : ''}` : missingFloatLabel(item, { sourceOnly })]
    const wrapped = values.map((value, i) => doc.setFont('helvetica', summary ? 'bold' : 'normal').setFontSize(i >= 3 ? 7 : 8)
      .splitTextToSize(printable(value), columns[i].width - 10 - (i === 2 ? indent + 7 : 0)))
    const height = Math.max(24, Math.max(...wrapped.map(value => value.length)) * 9.2 + 10)
    if (height > bottom - bodyTop) throw new Error(`Activity ${code || index + 1} has more text than fits on one PDF page.`)
    return { row, item, summary, color, style, critical, code, indent, wrapped, height,
      start: timestamp(item.display_start_date), finish: timestamp(item.display_finish_date),
      milestone: !summary && isScheduleMilestone(item), baseline: !summary && showBaseline ? baseline(item) : null }
  })
  const dateValues = prepared.flatMap(item => [item.start, item.finish, item.baseline?.start, item.baseline?.finish]).filter(Number.isFinite)
  const hasDates = dateValues.length > 0
  const earliest = hasDates ? dateValues.reduce((a, b) => Math.min(a, b)) : 0
  const latest = hasDates ? dateValues.reduce((a, b) => Math.max(a, b)) : 0
  const start = earliest - ((new Date(earliest).getUTCDay() + 6) % 7) * DAY
  const minDayWidth = zoom === 'day' ? 12 : zoom === 'month' ? 2 : 4
  const windowDays = Math.max(7, Math.floor(timelineWidth / minDayWidth / 7) * 7)
  const totalDays = hasDates ? Math.round((latest - start) / DAY) + 2 : 1
  const windows = hasDates ? Math.ceil(totalDays / windowDays) : 1
  const dayWidth = timelineWidth / windowDays
  const chunks = []
  let chunk = [], height = 0
  for (const item of prepared) {
    if (chunk.length && height + item.height > bottom - bodyTop) { chunks.push(chunk); chunk = []; height = 0 }
    chunk.push(item); height += item.height
  }
  if (chunk.length) chunks.push(chunk)
  if (chunks.length * windows > 1000) throw new Error('This schedule would exceed 1,000 PDF pages. Choose Month scale or export a filtered schedule.')
  const selectedIds = new Set(prepared.filter(item => !item.summary).map(item => String(item.row.id)))
  const taskById = new Map(tasks.map(task => [String(task.id), task]))
  const dependencies = showLogic ? prepared.filter(item => !item.summary).flatMap(item => scheduleDependencyEntries(item.item, { sourceOnly }).map(link => ({ ...link, successor: item }))) : []
  const generatedAt = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC'
  const activityCount = prepared.filter(item => !item.summary).length
  const heading = (subtitle) => {
    text(doc, 'MASTER SCHEDULE / GANTT', margin, 23, { size: 8, bold: true, color: BLUE })
    text(doc, titleLines, margin, 42, { size: 14, bold: true, lineHeightFactor: 16 / 14 })
    text(doc, contextLines, margin, 44 + titleLines.length * 16, { size: 8, lineHeightFactor: 1.25 })
    if (filterLines.length) text(doc, filterLines, margin, 46 + titleLines.length * 16 + contextLines.length * 10, { size: 8, color: MUTED, lineHeightFactor: 1.25 })
    text(doc, subtitle, margin, headingBottom + 15, { size: 8, color: MUTED })
  }
  const newPage = () => { if (doc.__ganttHasPage) doc.addPage(); doc.__ganttHasPage = true }
  for (let w = 0; w < windows; w++) {
    const windowStart = start + w * windowDays * DAY, windowEnd = windowStart + windowDays * DAY
    const xFor = date => timelineX + (date - windowStart) / DAY * dayWidth
    for (let r = 0; r < chunks.length; r++) {
      newPage()
      heading(`${activityCount} activities | ${rows.length - activityCount} WBS groups | Rows ${r + 1}/${chunks.length} | Time window ${w + 1}/${windows}${hasDates ? `: ${scheduleDate(iso(windowStart))} to ${scheduleDate(iso(windowEnd - DAY))}` : ' | No dated activities'}`)
      doc.setFillColor('#f1f5fb').rect(margin, headerTop, available, 34, 'F')
      columns.forEach(column => text(doc, column.label, column.x + 5, headerTop + 20, { size: 7.5, bold: true }))
      const bodyHeight = chunks[r].reduce((sum, item) => sum + item.height, 0)
      if (hasDates) {
        for (let cursor = windowStart; cursor < windowEnd;) {
          const date = new Date(cursor), next = Math.min(windowEnd, Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1))
          const left = xFor(cursor), right = xFor(next)
          const label = date.toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' })
          if (right - left > 36) text(doc, label, (left + right) / 2, headerTop + 12, { size: 7.5, bold: true, align: 'center' })
          line(doc, left, headerTop, left, bodyTop + bodyHeight)
          cursor = next
        }
        const step = zoom === 'day' ? 1 : 7
        for (let d = 0; d < windowDays; d += step) {
          const x = timelineX + d * dayWidth
          text(doc, new Date(windowStart + d * DAY).getUTCDate(), x + step * dayWidth / 2, headerTop + 27, { size: 6.5, align: 'center' })
          line(doc, x, headerTop + 17, x, bodyTop + bodyHeight)
        }
      } else text(doc, 'Dates not available', timelineX + 10, headerTop + 20, { color: MUTED })
      const positions = new Map()
      let y = bodyTop
      for (const item of chunks[r]) {
        if (item.summary) doc.setFillColor('#eef3fa').rect(margin, y, available, item.height, 'F')
        item.wrapped.forEach((value, i) => text(doc, value, columns[i].x + 5 + (i === 2 ? item.indent + 7 : 0), y + 12, { size: i >= 3 ? 7 : 8, bold: item.summary, lineHeightFactor: i >= 3 ? 9.2 / 7 : 9.2 / 8 }))
        doc.setFillColor(item.color).rect(columns[2].x + 4 + item.indent, y + 6, 3, Math.min(12, item.height - 10), 'F')
        const centerY = y + item.height / 2
        const validSpan = Number.isFinite(item.start) && Number.isFinite(item.finish) && item.finish >= item.start
        if (validSpan && item.finish >= windowStart && item.start < windowEnd) {
          const left = Math.max(timelineX + 1, xFor(item.start)), right = Math.min(pageWidth - margin - 1, xFor(item.finish + (item.milestone ? 0 : DAY)))
          if (item.milestone) diamond(doc, left, centerY, 4, item.color)
          else {
            doc.setFillColor(item.color).rect(left, centerY - (item.summary ? 3 : 4), Math.max(1, right - left), item.summary ? 6 : 8, 'F')
            if (item.start < windowStart) text(doc, '<', left + 1, centerY + 2, { size: 7, bold: true, color: '#ffffff' })
            if (item.finish >= windowEnd) text(doc, '>', right - 5, centerY + 2, { size: 7, bold: true, color: '#ffffff' })
          }
          if (!item.summary) positions.set(String(item.row.id), { item, y: centerY, start: xFor(item.start), finish: xFor(item.finish + (item.milestone ? 0 : DAY)) })
        }
        if (item.baseline && item.baseline.finish >= windowStart && item.baseline.start < windowEnd) {
          const left = Math.max(timelineX + 1, xFor(item.baseline.start)), right = Math.min(pageWidth - margin - 1, xFor(item.baseline.finish + DAY))
          doc.setFillColor('#94a3b8').rect(left, centerY + 7, Math.max(1, right - left), 2, 'F')
        }
        line(doc, margin, y + item.height, pageWidth - margin, y + item.height)
        y += item.height
      }
      // Only connect actual endpoints on this page. The register below retains
      // every incoming link, including cross-page and outside-filter endpoints.
      for (const link of dependencies) {
        if (!['FS', 'SS', 'FF', 'SF'].includes(link.type) || sourceOnly && !finite(link.lagValue)) continue
        const from = positions.get(link.predecessorId), to = positions.get(String(link.successor.row.id))
        if (!from || !to || from === to) continue
        const sx = link.type[0] === 'F' ? from.finish : from.start, tx = link.type[1] === 'F' ? to.finish : to.start
        if (sx < timelineX + 5 || sx > pageWidth - margin - 5 || tx < timelineX + 5 || tx > pageWidth - margin - 5) continue
        const out = sx + (link.type[0] === 'F' ? 4 : -4), into = tx + (link.type[1] === 'F' ? 4 : -4)
        const lane = from.y + (to.y >= from.y ? 1 : -1) * (from.item.height / 2 - 1)
        const color = from.item.critical && to.item.critical ? CRITICAL : MUTED
        for (const [a, b, c, d] of [[sx, from.y, out, from.y], [out, from.y, out, lane], [out, lane, into, lane], [into, lane, into, to.y], [into, to.y, tx, to.y]]) line(doc, a, b, c, d, color, 0.6)
        const arrow = link.type[1] === 'F' ? 2.5 : -2.5
        line(doc, tx + arrow, to.y - 2, tx, to.y, color, 0.6)
        line(doc, tx + arrow, to.y + 2, tx, to.y, color, 0.6)
      }
      for (const column of columns) line(doc, column.x, headerTop, column.x, y)
      line(doc, timelineX, headerTop, timelineX, y, '#9db4d6', 0.8)
      line(doc, pageWidth - margin, headerTop, pageWidth - margin, y)
      await yieldToBrowser()
    }
  }
  // A text register makes off-page and undated relationships reviewable without
  // inventing summary links or reducing a large schedule to an unreadable image.
  let noteY = 0
  const notesPage = title => { newPage(); heading(title); noteY = headerTop + 12 }
  const note = (value, { color, bold = false } = {}) => {
    const lines = doc.setFont('helvetica', bold ? 'bold' : 'normal').setFontSize(8).splitTextToSize(printable(value), available - 20)
    for (const entry of lines) {
      if (noteY > bottom - 15) notesPage('Export notes and dependency register (continued)')
      if (color) doc.setFillColor(color).rect(margin, noteY - 6, 7, 7, 'F')
      text(doc, entry, margin + 14, noteY, { size: 8, bold })
      noteY += 12
    }
    noteY += 4
  }
  notesPage('Export notes and color legend')
  note('This PDF is a snapshot of the selected schedule. Exporting does not calculate dates, approve the plan, or change the baseline.')
  note('All matching WBS and activity rows are expanded, including rows outside the screen. WBS summaries retain their full-group values when activity filters are applied.')
  note('Date evidence: ' + [...new Set(prepared.map(item => item.item.display_date_basis).filter(Boolean))].join(', ') + '. Source and proposed dates are not verified CPM results. Missing or unverified values retain their schedule labels.')
  note('Duration units: d = days, cd = calendar days, h = hours, w = weeks, mo = months. Source duration units remain as recorded; source total float is marked (source).')
  note('Bars marked < or > continue into another time window. Empty timeline cells can indicate undated activities or dates outside that page. Diamonds identify milestones.')
  note(showLogic ? 'Dependency arrows connect known endpoints on the same page. The register includes every incoming relationship for exported activities, including cross-page links and predecessors outside a filter.' : 'Dependency links were hidden in the selected Gantt view and are excluded from this export.')
  if (showBaseline) note('Gray bars show the recorded baseline dates where both endpoints are available.', { color: '#94a3b8' })
  note('Critical activity (only when identified by the schedule)', { color: CRITICAL })
  const legend = new Map(prepared.filter(item => !item.summary && item.style).map(item => [item.style.key, item.style]))
  for (const style of legend.values()) note(style.label, { color: style.color })
  if (dependencies.length) {
    note(`Dependency register - ${dependencies.length} relationships`, { bold: true })
    for (const [index, link] of dependencies.entries()) {
      const predecessor = taskById.get(link.predecessorId)
      const lagUnit = link.detail.lag_unit || link.detail.metadata?.lag_unit || link.reason?.lag_unit
      const lagSuffix = { hours: 'h', weeks: 'w', months: 'mo', calendar_days: 'cd', working_days: 'working d', days: 'd' }[lagUnit] || lagUnit || (sourceOnly ? '(unit Not Specified)' : 'working d')
      const lag = finite(link.lagValue) ? `${Number(link.lagValue) > 0 ? '+' : ''}${Number(link.lagValue)} ${lagSuffix}` : sourceOnly ? 'Not Specified' : '0 working d'
      const from = predecessor ? predecessor.activity_code || predecessor.external_id || link.predecessorId : link.predecessorId
      const outside = !selectedIds.has(link.predecessorId) ? predecessor ? ' | Predecessor outside export filters' : ' | Predecessor unavailable' : ''
      const status = link.detail.status || link.reason?.status
      note(`${from} -> ${link.successor.code} | ${link.type || 'Type Not Specified'} | Lag ${lag}${status ? ` | ${status}` : ''}${outside}`)
      if (index % 100 === 0) await yieldToBrowser()
    }
  }
  const pageCount = doc.getNumberOfPages()
  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page)
    line(doc, margin, pageHeight - 52, pageWidth - margin, pageHeight - 52)
    text(doc, 'Schedule snapshot | Dates and logic retain their displayed verification status. See export notes.', margin, pageHeight - 38, { size: 7, color: MUTED })
    text(doc, `Generated ${generatedAt}`, margin, pageHeight - 24, { size: 7, color: MUTED })
    text(doc, `Page ${page} of ${pageCount}`, pageWidth - margin, pageHeight - 24, { size: 7, color: MUTED, align: 'right' })
  }
  doc.setProperties({ title: `${projectName} - Gantt schedule`, subject: context, creator: 'RADAI Project Planning', author: 'RADAI' })
  const stem = String(project.code || project.id || 'project').replace(/[^a-zA-Z0-9_-]/g, '_')
  return { blob: doc.output('blob'), filename: `${stem}-gantt-${new Date().toISOString().slice(0, 10)}.pdf`, pageCount, rowCount: rows.length }
}
