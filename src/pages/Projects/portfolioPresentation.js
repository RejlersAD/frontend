const STATUS = {
  planning: ['Planning', 'blue'], active: ['In progress', 'blue'], in_progress: ['In progress', 'blue'],
  draft: ['Draft', 'slate'], review: ['Review', 'purple'], on_hold: ['On hold', 'amber'],
  completed: ['Completed', 'green'], cancelled: ['Cancelled', 'slate'],
}

const HEALTH = {
  needs_review: { key: 'needs_review', label: 'Needs review', tone: 'amber' },
  at_risk: { key: 'at_risk', label: 'At risk', tone: 'amber' },
  on_track: { key: 'on_track', label: 'On track', tone: 'green' },
  needs_setup: { key: 'needs_setup', label: 'Needs setup', tone: 'slate' },
  unknown: { key: 'unknown', label: 'Not assessed', tone: 'slate' },
}

const clean = value => typeof value === 'string' ? value.trim() : ''
const personName = person => person && typeof person === 'object'
  ? [person.first_name, person.last_name].filter(Boolean).join(' ').trim() || clean(person.name) || clean(person.email)
  : ''
const assignedName = value => clean(value) && !/^(unassigned|not assigned|not recorded|unknown|—)$/i.test(clean(value))
const dateOnly = value => {
  const valueDate = typeof value === 'string' ? value.slice(0, 10) : ''
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valueDate)) return null
  const date = new Date(`${valueDate}T00:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === valueDate ? valueDate : null
}

export const portfolioNeedsReview = row => ['needs_review', 'at_risk'].includes(row.health.key)

export function buildPortfolioRows(projects = []) {
  return projects.map(project => {
    const portfolio = project.portfolio || {}
    const baseline = portfolio.baseline
    const baselineKnown = Object.prototype.hasOwnProperty.call(portfolio, 'baseline')
    const baselineApproved = baselineKnown && baseline?.approved === true
    const ownerName = personName(project.owner) || clean(project.owner_name) || 'Unassigned'
    const creatorName = clean(project.creator_name) || 'Not recorded'
    const missingOwner = typeof portfolio.missing_owner === 'boolean' ? portfolio.missing_owner
      : Object.prototype.hasOwnProperty.call(project, 'owner_id') ? project.owner_id == null
        : !assignedName(ownerName)
    const status = STATUS[project.status] || [clean(project.status).replaceAll('_', ' ') || 'Not specified', 'slate']
    const health = HEALTH[portfolio.health?.key] || HEALTH.unknown
    return {
      ...project,
      client: clean(project.client_name) || 'Client not specified',
      ownerName, creatorName,
      initials: creatorName === 'Not recorded' ? '—' : creatorName.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase(),
      baselineKnown, baselineApproved,
      baselineStart: baselineApproved ? dateOnly(baseline.start_date) : null,
      baselineFinish: baselineApproved ? dateOnly(baseline.finish_date) : null,
      health: { ...health, label: clean(portfolio.health?.label) || health.label,
        reason: clean(portfolio.health?.reason) || 'No current portfolio assessment is recorded.' },
      statusLabel: status[0], statusTone: status[1], missingOwner,
      entity: clean(portfolio.entity),
      updatedAt: dateOnly(project.updated_at) && Number.isFinite(Date.parse(project.updated_at))
        ? new Date(project.updated_at).toISOString() : null,
    }
  })
}

export function getPortfolioSummary(rows = []) {
  return {
    total: rows.length,
    needsReview: rows.filter(portfolioNeedsReview).length,
    baselineApproved: rows.filter(row => row.baselineApproved).length,
    missingOwner: rows.filter(row => row.missingOwner).length,
  }
}

export function portfolioCsv(rows) {
  const cell = value => {
    const text = String(value ?? '')
    const safe = /^[\s]*[=+@-]|^[\t\r\n]/.test(text) ? `'${text}` : text
    return `"${safe.replaceAll('"', '""')}"`
  }
  const lines = [
    ['Project Name', 'Client', 'Project Code', 'Baseline Start', 'Baseline Finish', 'Baseline Status',
      'Author / Creator', 'Project Owner', 'Project Status', 'Overall Health', 'Last Updated'],
    ...rows.map(row => [row.name, row.client, row.code, row.baselineStart, row.baselineFinish,
      !row.baselineKnown ? 'Unavailable' : row.baselineApproved ? 'Approved' : 'Not approved',
      row.creatorName, row.ownerName, row.statusLabel, row.health.label, row.updatedAt]),
  ]
  return '\uFEFF' + lines.map(line => line.map(cell).join(',')).join('\r\n')
}

export function exportPortfolioCsv(rows) {
  const url = URL.createObjectURL(new Blob([portfolioCsv(rows)], { type: 'text/csv;charset=utf-8;' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `project-portfolio-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
