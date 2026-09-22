import { missingSourceDuration } from './planningDurationEvidence'
import { dateDisplayTask } from './planningDateEvidence'

const DAY = 86400000
const key = value => value == null ? null : String(value)
const day = value => value ? Date.parse(`${String(value).slice(0, 10)}T00:00:00Z`) : NaN
const finite = value => value != null && value !== '' && Number.isFinite(Number(value))
const normalize = value => String(value || '').trim().toLowerCase()

export const isScheduleMilestone = task => task.is_milestone === true
  || ['milestone', 'start_milestone', 'finish_milestone'].includes(String(task.activity_type || '').toLowerCase())

export const scheduleDate = value => {
  const timestamp = day(value)
  if (!Number.isFinite(timestamp)) return '\u2014'
  const parts = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: '2-digit', timeZone: 'UTC' }).formatToParts(timestamp)
  return ['day', 'month', 'year'].map(type => parts.find(part => part.type === type)?.value).join('-')
}

export const scheduleNumber = value => finite(value) ? new Intl.NumberFormat('en', { maximumFractionDigits: 2 }).format(Number(value)) : '\u2014'

function calendarDuration(start, finish, calendar) {
  if (!calendar?.working_weekdays?.length || !start || !finish) return null
  const beginning = day(start), ending = day(finish)
  if (!Number.isFinite(beginning) || !Number.isFinite(ending) || ending < beginning || ending - beginning > DAY * 36525) return null
  const weekdays = new Set(calendar.working_weekdays.map(Number))
  const exceptions = new Map((calendar.exceptions || []).map(item => [String(item.date).slice(0, 10), item.is_working]))
  let duration = 0
  for (let date = beginning; date <= ending; date += DAY) {
    const value = new Date(date), iso = value.toISOString().slice(0, 10)
    if (exceptions.has(iso) ? exceptions.get(iso) : weekdays.has((value.getUTCDay() + 6) % 7)) duration += 1
  }
  return duration
}

function summarize(tasks, calendar) {
  const starts = tasks.map(task => task.planned_start_date).filter(Boolean).sort()
  const finishes = tasks.map(task => task.planned_finish_date).filter(Boolean).sort()
  const start = starts[0] || null, finish = finishes.at(-1) || null
  const complete = tasks.length > 0 && tasks.every(task => task.planned_start_date && task.planned_finish_date)
  return {
    planned_start_date: start, planned_finish_date: finish,
    duration_days: complete ? tasks.every(isScheduleMilestone) && start === finish ? 0 : calendarDuration(start, finish, calendar) : null,
    total_float_days: tasks.length && tasks.every(task => finite(task.total_float_days)) ? Math.min(...tasks.map(task => Number(task.total_float_days))) : null,
    task_count: tasks.length, complete,
  }
}

function withProjectSourceSummary(summary, projectSummary) {
  if (!projectSummary) return summary
  const result = { ...(summary || {}) }
  // Reusing a native project WBS must not discard independent, documented
  // project values. Preserve its own dates, conflicts and calculated values.
  let copiedDates = false
  for (const endpoint of ['start', 'finish']) {
    const status = `source_${endpoint}_status`, field = `source_${endpoint}_date`
    if ((!result[status] || result[status] === 'not_specified') && projectSummary[status]) {
      result[status] = projectSummary[status]
      result[field] = projectSummary[field]
      copiedDates = true
    }
  }
  if (copiedDates) result.source_date_references = [...(result.source_date_references || []), ...(projectSummary.source_date_references || [])]
  if ((!result.source_total_float_status || result.source_total_float_status === 'not_specified') && projectSummary.source_total_float_status) {
    for (const field of ['source_total_float_days', 'source_total_float_status', 'source_total_float_evidence', 'source_total_float_references']) result[field] = projectSummary[field]
  }
  if (!finite(result.original_duration_days) && finite(projectSummary.original_duration_days)) {
    result.original_duration_days = projectSummary.original_duration_days
    result.duration_unit = projectSummary.duration_unit || result.duration_unit
  }
  return result
}

// The tree retains source WBS identity. Discipline labels are not unique keys:
// two different branches may both legitimately contain Process Engineering.
export function buildPrimaveraModel(plan, tasks, disciplines) {
  const project = plan.project || {}
  const calendar = plan.work_calendar || plan.calendar
  const suppliedNodes = Array.isArray(plan.wbs_nodes) ? plan.wbs_nodes : []
  const sourceHierarchy = suppliedNodes.length && !suppliedNodes.every(node => node.is_derived || String(node.id).startsWith('draft:'))
  const nodeMap = new Map()
  const source = suppliedNodes.length ? suppliedNodes : disciplines.map((group, index) => ({
    id: `draft:${group.code}`, code: String(index + 1), name: group.name, discipline: group.code,
    parent_id: null, sort_order: index, is_derived: true,
  }))
  source.forEach((node, index) => {
    const id = key(node.id)
    if (id == null || nodeMap.has(id)) return
    nodeMap.set(id, { ...node, id, parent_id: key(node.parent_id), name: node.name || node.code || id, children: [], tasks: [], sourceIndex: index })
  })
  const deliverableNodes = new Map()
  const parentByTask = new Map()
  for (const [index, deliverable] of (plan.deliverables || []).entries()) {
    const deliverableId = key(deliverable.id)
    if (deliverableId == null || deliverableNodes.has(deliverableId)) continue
    const workflowIds = deliverable.workflow_task_ids || deliverable.task_ids || []
    workflowIds.forEach(taskId => { if (!parentByTask.has(key(taskId))) parentByTask.set(key(taskId), deliverableId) })
    const existing = nodeMap.get(key(deliverable.wbs_node_id))
    // A persisted deliverable WBS already owns its children. Preserve that
    // identity; draft deliverables get presentation-only summary nodes.
    const reuse = existing && !existing.is_derived && !existing.is_deliverable
    const enclosing = nodeMap.get(key(deliverable.parent_wbs_node_id))
    const candidates = [...nodeMap.values()].filter(node => !node.is_deliverable && node.discipline === deliverable.discipline)
    const parent = enclosing || (candidates.length === 1 ? candidates[0] : null)
    const node = reuse ? existing : {
      id: `deliverable:${deliverableId}`, parent_id: parent?.id || null,
      children: [], tasks: [], sourceIndex: index, sort_order: deliverable.sort_order ?? index,
      is_derived: true,
    }
    Object.assign(node, {
      is_deliverable: true, deliverable_id: deliverableId, deliverable,
      name: deliverable.title || node.name || 'Deliverable',
      code: deliverable.activity_code || deliverable.document_number || node.code || '',
      discipline: deliverable.discipline || node.discipline,
      summary: deliverable.summary || node.summary,
      workflowOrder: new Map(workflowIds.map((taskId, taskIndex) => [key(taskId), taskIndex])),
    })
    nodeMap.set(node.id, node)
    deliverableNodes.set(deliverableId, node)
  }
  const rootId = `project:${project.id ?? project.code ?? 'current'}`
  const projectRoot = {
    id: rootId, code: project.code || '', name: project.name || plan.project_name || 'Project schedule',
    children: [], tasks: [], summary: plan.project_summary, is_project: true, sourceIndex: -2,
  }
  const roots = []
  for (const node of nodeMap.values()) {
    const parent = nodeMap.get(node.parent_id)
    if (parent && parent.id !== node.id) parent.children.push(node)
    else roots.push(node)
  }
  // Detach cyclic/unreachable branches from their bad parent instead of losing
  // their activities or following an infinite parent chain.
  const reachable = new Set()
  const visit = (node, ancestors = new Set()) => {
    if (ancestors.has(node.id) || reachable.has(node.id)) return
    reachable.add(node.id)
    const chain = new Set([...ancestors, node.id])
    node.children = node.children.filter(child => !chain.has(child.id))
    node.children.forEach(child => visit(child, chain))
  }
  roots.forEach(node => visit(node))
  for (const node of nodeMap.values()) if (!reachable.has(node.id)) { roots.push(node); visit(node) }
  const order = (left, right) => Number(left.sort_order ?? left.sourceIndex ?? 0) - Number(right.sort_order ?? right.sourceIndex ?? 0)
  for (const node of nodeMap.values()) node.children.sort(order)
  roots.sort(order)

  tasks.forEach((task, index) => {
    const deliverableId = key(task.parent_deliverable_id) || parentByTask.get(key(task.id))
    let parent = deliverableNodes.get(deliverableId) || nodeMap.get(key(task.wbs_node_id))
    if (!parent && !sourceHierarchy) parent = [...nodeMap.values()].find(node => node.discipline === task.discipline)
    const code = task.activity_code || task.external_id || task.document_number || String(task.id)
    const row = { ...dateDisplayTask(task), id: key(task.id), activity_code: code, sourceIndex: index, originalTask: task,
      parent_deliverable_id: deliverableId || task.parent_deliverable_id }
    if (parent) parent.tasks.push(row)
    else projectRoot.tasks.push(row)
  })
  for (const node of nodeMap.values()) node.tasks.sort((left, right) => {
    if (!node.is_deliverable) return order(left, right)
    const stageOrder = task => node.workflowOrder.get(task.id) ?? task.workflow_stage_sequence ?? task.metadata?.workflow_stage_sequence ?? task.sort_order ?? task.sourceIndex
    return Number(stageOrder(left)) - Number(stageOrder(right)) || order(left, right)
  })
  projectRoot.tasks.sort(order)
  const matchingProjectRoot = roots.length === 1 && (
    roots[0].is_source_project === true
    || (project.code && normalize(roots[0].code) === normalize(project.code))
    || (project.name && normalize(roots[0].name) === normalize(project.name))
  )
  let tree
  if (matchingProjectRoot && !projectRoot.tasks.length) {
    tree = roots
    tree[0].is_project = true
  } else {
    if (!sourceHierarchy && project.phase) {
      projectRoot.children = [{ id: `phase:${rootId}`, code: '', name: String(project.phase), children: roots,
        tasks: [], is_derived: true, summary: plan.project_summary, sourceIndex: -1 }]
    } else projectRoot.children = roots
    tree = [projectRoot]
  }
  const seen = new Set()
  const prepare = (node, ancestors) => {
    if (seen.has(node.id)) return []
    seen.add(node.id)
    node.depth = ancestors.length
    node.ancestors = ancestors
    node.tasks.forEach(task => { task.ancestors = [...ancestors, node] })
    node.children = node.children.filter(child => !seen.has(child.id))
    const allTasks = [...node.tasks, ...node.children.flatMap(child => prepare(child, [...ancestors, node]))]
    node.descendantTasks = allTasks
    // A supplied null means unknown; never replace it with an inferred total.
    node.summary = withProjectSourceSummary(node.summary || summarize(allTasks, calendar), node.is_project ? plan.project_summary : null)
    if (allTasks.some(missingSourceDuration) && !finite(node.summary.original_duration_days)) {
      node.summary = { ...node.summary, planned_start_date: null, planned_finish_date: null,
        duration_days: null, total_float_days: null, complete: false }
    }
    // Independent source-summary evidence remains visible when child durations
    // are missing; never derive a calendar duration from those source dates.
    node.summary = dateDisplayTask(node.summary, { summary: true })
    return allTasks
  }
  tree.forEach(node => prepare(node, []))
  // A source WBS can already contain the project root. Keep its own summary,
  // while allowing a separately supplied original project duration to appear
  // without duplicating the project row or replacing its current dates/span.
  const displayedProject = tree.length === 1 && tree[0].is_project ? tree[0] : null
  if (displayedProject && displayedProject.summary.original_duration_days == null
      && plan.project_summary?.original_duration_days != null) {
    displayedProject.summary = { ...displayedProject.summary, original_duration_days: plan.project_summary.original_duration_days }
  }
  return { tree, tasks, sourceHierarchy }
}

export function flattenPrimaveraModel(model, { search = '', discipline = 'all', criticalOnly = false, collapsed = new Set(), flat = false, level = 'activities' } = {}) {
  const needle = search.trim().toLowerCase()
  const filtersActive = Boolean(needle || discipline !== 'all' || criticalOnly)
  const matchesTask = (task, ancestorMatch) => (!needle || ancestorMatch || task.ancestors?.some(node => `${node.code} ${node.name}`.toLowerCase().includes(needle)) || `${task.activity_code} ${task.title} ${task.owner || ''} ${task.assignee?.name || ''}`.toLowerCase().includes(needle))
    && (discipline === 'all' || task.discipline === discipline) && (!criticalOnly || task.is_critical === true)
  const rows = []
  const walk = (node, ancestorMatch = false) => {
    const matchesGroup = ancestorMatch || (needle && `${node.code} ${node.name}`.toLowerCase().includes(needle))
    const descendants = node.descendantTasks.filter(task => matchesTask(task, matchesGroup))
    const nestedMatch = node.children.some(child => `${child.code} ${child.name}`.toLowerCase().includes(needle))
    if (filtersActive && !descendants.length && !(needle && (matchesGroup || nestedMatch) && !criticalOnly && discipline === 'all')) return
    if (!flat) rows.push({ kind: 'wbs', id: node.id, node, depth: node.depth, ancestors: node.ancestors })
    if (!flat && !filtersActive && collapsed.has(node.id)) return
    for (const child of node.children) walk(child, matchesGroup)
    for (const task of node.tasks) if (matchesTask(task, matchesGroup)) rows.push({ kind: 'task', id: task.id, task, depth: node.depth + 1, ancestors: [...node.ancestors, node] })
  }
  model.tree.forEach(node => walk(node))
  if (level === 'project') return rows.filter(row => row.kind === 'wbs' && row.node.is_project)
  if (level === 'wbs') return rows.filter(row => row.kind === 'wbs' && !row.node.is_deliverable)
  return rows
}
