import { scheduleSequenceStyle } from './primaveraDependencies'

const DISCIPLINE_COLORS = {
  process: '#2563eb', electrical: '#b45309', mechanical: '#0f766e', piping: '#7c3aed',
  instrumentation: '#0891b2', civil: '#4f46e5', structural: '#64748b', controls: '#059669',
  milestones: '#0284c7', management: '#475569', survey: '#0369a1', hse: '#a16207',
}
const EXTRA_COLORS = ['#2563eb', '#7c3aed', '#0f766e', '#b45309', '#0891b2', '#4f46e5', '#059669', '#a16207']
const normalize = value => String(value || '').trim().toLowerCase().replaceAll(/[^a-z0-9]+/g, '_').replaceAll(/^_|_$/g, '')
const aliases = {
  pro: 'process', proc: 'process', elec: 'electrical', ele: 'electrical', mech: 'mechanical', mec: 'mechanical',
  pip: 'piping', inst: 'instrumentation', ins: 'instrumentation', civ: 'civil', str: 'structural',
  control: 'controls', project_controls: 'controls', milestone: 'milestones', project_management: 'management',
}

function disciplineStyle(code, disciplineNames) {
  const key = normalize(code)
  if (!key) return { key: 'discipline:unassigned', label: 'Unassigned discipline', color: '#64748b', basis: 'discipline' }
  const name = disciplineNames.get(String(code)) || String(code).replaceAll('_', ' ')
  const canonical = aliases[key] || Object.keys(DISCIPLINE_COLORS).find(value => key === value || key.startsWith(`${value}_`))
    || Object.keys(DISCIPLINE_COLORS).find(value => normalize(name).startsWith(value))
  const hash = [...key].reduce((total, letter) => (total * 31 + letter.charCodeAt(0)) >>> 0, 0)
  return { key: `discipline:${key}`, label: name[0].toUpperCase() + name.slice(1),
    color: DISCIPLINE_COLORS[canonical] || EXTRA_COLORS[hash % EXTRA_COLORS.length], basis: 'discipline' }
}

// Keep a documented workflow phase ahead of the discipline fallback. These
// colors are display metadata and never change dates, float or relationships.
export function scheduleActivityColor(task, disciplineNames = new Map()) {
  const phase = scheduleSequenceStyle(task)
  return phase.key !== 'unspecified' ? { ...phase, basis: 'stage' } : disciplineStyle(task.discipline, disciplineNames)
}

export function scheduleGroupColor(node, disciplineNames = new Map()) {
  if (node.discipline) return disciplineStyle(node.discipline, disciplineNames)
  const disciplines = [...new Set((node.descendantTasks || []).map(task => task.discipline).filter(Boolean))]
  // A mixed-discipline summary keeps its neutral color instead of implying
  // that it belongs to whichever child happens to be rendered first.
  return disciplines.length === 1 ? disciplineStyle(disciplines[0], disciplineNames) : null
}
