// ─────────────────────────────────────────────────────────────────────────────
// Instrument Cable Schedule — Project Persistence Service
// ─────────────────────────────────────────────────────────────────────────────
// Thin CRUD wrapper. Today: localStorage adapter (no backend touch). Tomorrow:
// flip CABLE_SCHEDULE_PROJECT_STORAGE.adapter to 'api' in the config to migrate
// to a DRF ViewSet without changing the page.
// ─────────────────────────────────────────────────────────────────────────────

import {
  CABLE_SCHEDULE_PROJECT_STORAGE,
  CABLE_SCHEDULE_PROJECT_LIMITS,
  makeCableScheduleProject,
} from '../config/cableScheduleProjects.config'

const KEY = CABLE_SCHEDULE_PROJECT_STORAGE.storageKey

function readAll() {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

function writeAll(projects) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(projects))
  } catch (err) {
    console.warn('[cableScheduleProjectsService] persist failed:', err)
  }
}

export function listProjects({ search = '' } = {}) {
  const all = readAll().sort((a, b) =>
    String(b.updated_at || '').localeCompare(String(a.updated_at || '')),
  )
  if (!search.trim()) return all
  const q = search.trim().toLowerCase()
  return all.filter((p) =>
    [p.project_name, p.pid_no, p.description]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(q)),
  )
}

export function getProject(id) {
  return readAll().find((p) => p.id === id) || null
}

export function createProject(input) {
  const existing = readAll()
  if (existing.length >= CABLE_SCHEDULE_PROJECT_LIMITS.maxProjects) {
    throw new Error(`Maximum of ${CABLE_SCHEDULE_PROJECT_LIMITS.maxProjects} Cable Schedule projects reached. Delete some first.`)
  }
  const project = makeCableScheduleProject(input)
  if (!project.project_name) throw new Error('Project name is required.')
  writeAll([project, ...existing])
  return project
}

export function updateProject(id, patch = {}) {
  const all = readAll()
  const idx = all.findIndex((p) => p.id === id)
  if (idx < 0) throw new Error('Project not found.')
  const merged = makeCableScheduleProject({ ...all[idx], ...patch, id: all[idx].id, created_at: all[idx].created_at })
  all[idx] = merged
  writeAll(all)
  return merged
}

export function deleteProject(id) {
  writeAll(readAll().filter((p) => p.id !== id))
}

export function attachCableScheduleToProject(id, { rows, source_count, last_source_name }) {
  return updateProject(id, {
    cable_schedule_rows: rows,
    source_count:        source_count,
    last_source_name:    last_source_name,
    status:              rows && rows.length ? 'generated' : 'draft',
  })
}
