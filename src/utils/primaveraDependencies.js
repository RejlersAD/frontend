const COLORS = {
  survey: '#15803d', basis: '#4f46e5', study: '#087e8b', engineering: '#2563eb',
  review: '#b45309', package: '#7c3aed', closeout: '#0f766e', recurring: '#64748b',
  prepare: '#2563eb', check: '#b45309', approve: '#15803d', issue: '#7c3aed',
  ifr: '#2563eb', company_review: '#a16207', ifa: '#7c3aed', ifc: '#0f766e',
  company_approval: '#8b5cf6', final_issue: '#10b981',
}
const EXTRA_COLORS = ['#2563eb', '#7c3aed', '#0f766e', '#b45309', '#087e8b', '#4f46e5']
const RELATIONSHIPS = { FS: 'Finish to start', SS: 'Start to start', FF: 'Finish to finish', SF: 'Start to finish' }
const valueKey = value => value == null ? '' : String(value)

export function scheduleSequenceStyle(task) {
  const stage = task.stage
  const workflowCode = task.workflow_stage_code || task.metadata?.workflow_stage_code
  const source = workflowCode || task.schedule_phase
    || task.stage_code || (typeof stage === 'string' ? stage : stage?.code)
  if (!source) return { key: 'unspecified', label: 'Unspecified phase', color: '#475569' }
  const key = String(source).toLowerCase().replaceAll(' ', '_')
  const label = workflowCode
    ? task.workflow_stage_name || task.workflow_stage_label || task.metadata?.workflow_stage_name || task.metadata?.workflow_stage_label || String(workflowCode).replaceAll('_', ' ')
    : task.schedule_phase ? String(task.schedule_phase).replaceAll('_', ' ')
      : stage?.name || String(source).replaceAll('_', ' ')
  const hash = [...key].reduce((total, letter) => total + letter.charCodeAt(0), 0)
  return { key, label: label[0].toUpperCase() + label.slice(1), color: COLORS[key] || EXTRA_COLORS[hash % EXTRA_COLORS.length] }
}

function referenceLabel(reference) {
  if (typeof reference === 'string') return reference
  if (!reference) return ''
  const locator = reference.locator || reference.source_locator || reference
  const row = locator.row ?? locator.line
  return [reference.filename || reference.source_filename, locator.sheet,
    locator.page != null ? `Page ${locator.page}` : null, row != null ? `Row ${row}` : null,
    reference.excerpt,
  ].filter(Boolean).join(' · ')
}

function route(source, target, type, rowHeight, timelineWidth) {
  const sourceFinish = type[0] === 'F', targetFinish = type[1] === 'F'
  const edge = (position, finish) => position.milestone
    ? position.left + (finish ? 1 : -1) * Math.SQRT2 * 4
    : position.left + (finish ? position.width : 0)
  const sx = edge(source, sourceFinish), tx = edge(target, targetFinish)
  const sy = source.index * rowHeight + rowHeight / 2, ty = target.index * rowHeight + rowHeight / 2
  const corridor = value => Math.max(2, Math.min(timelineWidth - 2, value))
  const out = corridor(sx + (sourceFinish ? 10 : -10)), incoming = corridor(tx + (targetFinish ? 10 : -10))
  let points, label
  if (sourceFinish === targetFinish) {
    const trunk = sourceFinish ? Math.max(out, incoming) : Math.min(out, incoming)
    points = [[sx, sy], [trunk, sy], [trunk, ty], [tx, ty]]
    label = { x: trunk + 3, y: (sy + ty) / 2 - 2 }
  } else if (sourceFinish ? out <= incoming : out >= incoming) {
    const trunk = (out + incoming) / 2
    points = [[sx, sy], [trunk, sy], [trunk, ty], [tx, ty]]
    label = { x: trunk + 3, y: (sy + ty) / 2 - 2 }
  } else {
    // Wrap conflicting endpoints through a row boundary, rather than drawing
    // backwards through the predecessor or successor activity bar.
    const lane = sy + (ty > sy ? 1 : -1) * rowHeight / 2
    points = [[sx, sy], [out, sy], [out, lane], [incoming, lane], [incoming, ty], [tx, ty]]
    label = { x: (out + incoming) / 2 + 3, y: lane - 2 }
  }
  return { path: points.map(([x, y], index) => `${index ? 'L' : 'M'}${x},${y}`).join(' '),
    sourceX: sx, sourceY: sy, targetX: tx, targetY: ty, label }
}

// Rows already reflect filtering and WBS expansion. Only join two visible,
// dated activities; a collapsed group never invents a summary relationship.
export function buildPrimaveraDependencies(rows, positions, rowHeight = 16, timelineWidth = Infinity) {
  const tasks = new Map(rows.filter(row => row.kind === 'task').map(row => [valueKey(row.id), row.task]))
  const links = []
  for (const [successorId, successor] of tasks) {
    const target = positions.get(successorId)
    if (!target) continue
    const details = successor.dependency_details || []
    const incoming = new Set([...(successor.depends_on || []), ...details.map(item => item.task_id ?? item.predecessor_id)]
      .filter(id => id != null).map(valueKey))
    for (const predecessorId of incoming) {
      const predecessor = tasks.get(predecessorId), source = positions.get(predecessorId)
      if (!predecessor || !source || predecessorId === successorId) continue
      const detail = details.find(item => valueKey(item.task_id ?? item.predecessor_id) === predecessorId) || {}
      const reason = successor.dependency_rationales?.[predecessorId]
      const type = String(detail.type || detail.relationship_type || reason?.relationship_type || 'FS').toUpperCase()
      if (!RELATIONSHIPS[type]) continue
      const lagValue = detail.lag_days ?? reason?.lag_days
      const lag = Number.isFinite(Number(lagValue)) ? Number(lagValue) : 0
      const rationale = typeof reason === 'string' ? reason : reason?.rationale || reason?.message || reason?.description
      const sourceReferences = detail.source_references || reason?.source_references || []
      const sourceCode = predecessor.activity_code || predecessor.external_id || predecessorId
      const targetCode = successor.activity_code || successor.external_id || successorId
      const label = [type !== 'FS' || lag ? type : '', lag ? `${lag > 0 ? '+' : ''}${lag}d` : ''].filter(Boolean).join(' ')
      const description = [
        `${sourceCode} ${predecessor.title} → ${targetCode} ${successor.title}`,
        `${RELATIONSHIPS[type]} (${type}); lag ${lag > 0 ? '+' : ''}${lag} working days`,
        reason?.status === 'proposed' ? 'Proposed relationship' : null,
        reason?.evidence_type === 'planning_inference' ? 'Planning inference' : null,
        rationale, ...sourceReferences.map(referenceLabel),
      ].filter(Boolean).join('. ')
      const geometry = route(source, target, type, rowHeight, timelineWidth)
      geometry.label.x = Math.max(3, Math.min(timelineWidth - label.length * 5 - 3, geometry.label.x))
      links.push({ id: `${predecessorId}:${successorId}:${type}`, predecessorId, successorId, type, lag,
        labelText: label, description, successor: successor.originalTask || successor,
        ...geometry })
    }
  }
  return links
}
