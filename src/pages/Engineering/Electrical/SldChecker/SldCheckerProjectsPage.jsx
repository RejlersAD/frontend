/**
 * SLD Checker — projects list. Mirrors the P&ID checker ProjectsPage:
 * filter chips with counts, KPI tiles, project cards, New project drawer.
 * Every count is derived from the same project + state lists at render
 * time — nothing is invented.
 */
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as svc from './sldChecker.service'
import { PageHeader, KpiTile, Pill, Drawer, EmptyState } from '../../Process/PidChecker/shared'
import '../../Process/PidChecker/pidchecker.css'
import './sldchecker.css'

const BASE = '/engineering/electrical/sld'

const fmtDate = iso => {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return '—'
  }
}

function normalizeProject(p = {}) {
  return {
    id: p.project_id ?? p.id ?? null,
    name: p.project_name ?? p.name ?? 'Untitled project',
    description: p.description ?? '',
    updatedAt: p.updated_at ?? p.modified_at ?? p.created_at ?? null,
    raw: p,
  }
}

// ── New project drawer ──────────────────────────────────────────────────

function NewProjectDrawer({ open, onClose, onCreated, existingNames }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const submit = async () => {
    const trimmed = name.trim()
    if (!trimmed || busy) return
    if (existingNames.includes(trimmed.toLowerCase())) {
      setError(`A project named "${trimmed}" already exists`)
      return
    }
    setBusy(true)
    setError(null)
    try {
      const p = await svc.createProject({ projectName: trimmed, description: description.trim() })
      onCreated(normalizeProject(p.project_id ? p : { ...p, project_id: p.project_id ?? p.id, project_name: trimmed }))
      setName(''); setDescription('')
    } catch (err) {
      setError(err?.response?.data?.error || 'The project could not be created. Please retry.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="New project"
      footer={(
        <>
          <button type="button" className="rd-btn rd-btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="rd-btn rd-btn-primary" disabled={!name.trim() || busy} onClick={submit}>
            {busy ? 'Creating…' : 'Create project'}
          </button>
        </>
      )}
    >
      <div className="pc-field">
        <label className="pc-label" htmlFor="sc-np-name">Project name</label>
        <input id="sc-np-name" className="pc-input" value={name} onChange={e => setName(e.target.value)} />
      </div>
      <div className="pc-field">
        <label className="pc-label" htmlFor="pc-np-desc">Description</label>
        <textarea
          id="pc-np-desc"
          className="pc-input"
          style={{ minHeight: 72, padding: '0.5rem 0.625rem' }}
          value={description}
          onChange={e => setDescription(e.target.value)}
        />
      </div>
      {error && <p className="pc-error" role="alert">{error}</p>}
      <p className="pc-note" style={{ margin: 0 }}>
        After creating the project, add the required inputs: the SLD drawing, the Equipment List,
        the Load List, the legend and checklist AI-SLD-01.
      </p>
    </Drawer>
  )
}

// ── page ────────────────────────────────────────────────────────────────

export default function SldCheckerProjectsPage() {
  const navigate = useNavigate()
  const [projects, setProjects] = useState(null)
  const [stateByProject, setStateByProject] = useState({})
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('All')
  const [showNew, setShowNew] = useState(false)
  const [deleting, setDeleting] = useState(null)
  const [notice, setNotice] = useState(null) // { text, tone }
  const [reloadTick, setReloadTick] = useState(0)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const data = await svc.listProjects()
        const list = (Array.isArray(data) ? data : (data?.projects || data?.results || [])).map(normalizeProject)
        if (!alive) return
        setProjects(list)
        // Real per-project staged state drives every count on this screen.
        const entries = await Promise.all(list.map(async p => {
          try {
            return [p.id, await svc.getState(p.id)]
          } catch {
            return [p.id, null] // unknown — tiles show "—", never invented
          }
        }))
        if (!alive) return
        setStateByProject(Object.fromEntries(entries))
      } catch (err) {
        if (alive) setError(err?.response?.data?.error || 'Projects could not be loaded.')
      }
    })()
    return () => { alive = false }
  }, [reloadTick])

  const statesLoaded = useMemo(
    () => (projects || []).length > 0 && (projects || []).every(p => stateByProject[p.id] !== undefined),
    [projects, stateByProject],
  )

  const statusOf = state => {
    if (!state) return 'Draft'
    return (state.analyses_count ?? 0) > 0 ? 'Analysed' : 'Draft'
  }

  const kpis = useMemo(() => {
    const list = projects || []
    if (!statesLoaded) return { projects: list.length, files: null, analysed: null, byok: null }
    const states = list.map(p => stateByProject[p.id]).filter(Boolean)
    return {
      projects: list.length,
      files: states.reduce((n, s) => n + (s.files?.length ?? 0), 0),
      analysed: states.filter(s => (s.analyses_count ?? 0) > 0).length,
      byok: states.filter(s => s.byok).length,
    }
  }, [projects, stateByProject, statesLoaded])

  const chips = useMemo(() => {
    const list = projects || []
    const analysed = list.filter(p => (stateByProject[p.id]?.analyses_count ?? 0) > 0).length
    return [
      { name: 'All', count: list.length },
      { name: 'Analysed', count: statesLoaded ? analysed : null },
      { name: 'Draft', count: statesLoaded ? list.length - analysed : null },
    ]
  }, [projects, stateByProject, statesLoaded])

  const visible = useMemo(() => (projects || []).filter(p => {
    if (filter === 'All') return true
    return statusOf(stateByProject[p.id]) === filter
  }), [projects, filter, stateByProject])

  return (
    <div className="pc-page">
      <PageHeader
        title="SLD Checker"
        subtitle="Check single line diagrams against the Equipment List, the Load List, the legend and checklist AI-SLD-01."
        actions={(
          <>
            <button
              type="button"
              className="rd-btn rd-btn-secondary"
              onClick={() => navigate(`${BASE}/classic`)}
            >
              Classic comparison
            </button>
            <button type="button" className="rd-btn rd-btn-primary" onClick={() => setShowNew(true)}>
              New project
            </button>
          </>
        )}
      />

      <div className="pc-chips" role="group" aria-label="Filter projects">
        {chips.map(chip => (
          <button
            key={chip.name}
            type="button"
            className={`pc-chip${filter === chip.name ? ' pc-chip-active' : ''}`}
            aria-pressed={filter === chip.name}
            onClick={() => setFilter(chip.name)}
          >
            {chip.name}
            {chip.count != null && <span className="pc-chip-count">{chip.count}</span>}
          </button>
        ))}
      </div>

      <div className="pc-kpi-grid">
        <KpiTile label="Projects" value={kpis.projects} />
        <KpiTile
          label="Files uploaded"
          value={kpis.files ?? '—'}
          meta={kpis.files == null ? 'Available once the project states are loaded' : 'SLD drawings, Equipment Lists and Load Lists'}
        />
        <KpiTile
          label="Analysed"
          value={kpis.analysed ?? '—'}
          meta={kpis.analysed != null ? 'projects with at least one analysis' : null}
        />
        <KpiTile
          label="AI key connected"
          value={kpis.byok ?? '—'}
          meta={kpis.byok != null ? 'projects with a personal key (BYOK)' : null}
        />
      </div>

      {error && <p className="pc-error" role="alert">{error}</p>}
      {!error && projects === null && (
        <div className="pc-card-grid" aria-label="Loading projects">
          {[0, 1, 2].map(i => <div key={i} className="pc-skeleton" style={{ height: 140 }} />)}
        </div>
      )}

      {projects !== null && visible.length === 0 && (
        <EmptyState
          title={filter === 'All' ? 'No projects yet.' : `No ${filter.toLowerCase()} projects.`}
          action={(
            <button type="button" className="rd-btn rd-btn-primary" onClick={() => setShowNew(true)}>
              New project
            </button>
          )}
        >
          Create a project to upload the SLD, the Equipment List and the Load List and start the check run.
        </EmptyState>
      )}

      <div className="pc-card-grid">
        {visible.map(project => {
          const state = stateByProject[project.id]
          const files = state?.files?.length ?? 0
          const analyses = state?.analyses_count ?? 0
          const status = statusOf(state)
          return (
            <div
              key={project.id}
              className="pc-project-card pc-row-clickable"
              role="button"
              tabIndex={0}
              onClick={() => navigate(`${BASE}/projects/${project.id}`)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`${BASE}/projects/${project.id}`) } }}
            >
              <div className="pc-project-card-top">
                <h2 className="pc-project-name">{project.name}</h2>
                <Pill label={status} tone={status === 'Analysed' ? 'success' : 'warning'} />
              </div>
              {project.description && <p className="pc-project-desc">{project.description}</p>}
              <div className="pc-pillrow">
                <Pill label={`${files} of 3 files`} tone={files >= 2 ? 'info' : 'neutral'} />
                <Pill label={`${analyses} analyses`} tone="neutral" />
                {state?.byok && <Pill label="AI: my key (BYOK)" tone="ai" />}
              </div>
              <span className="pc-project-meta">
                {analyses > 0 ? `Latest analysis ${state?.latest_analysis?.id ?? ''}` : 'Not analysed yet'}
                {' · '}updated {fmtDate(project.updatedAt)}
              </span>
              <span
                className="pc-project-actions"
                onClick={e => e.stopPropagation()}
                onKeyDown={e => e.stopPropagation()}
              >
                {deleting?.id === project.id ? (
                  <>
                    <span className="pc-faint" style={{ fontSize: 'var(--rd-text-caption)' }}>
                      Delete this project and its files?
                    </span>
                    <button type="button" className="rd-btn rd-btn-primary rd-btn-sm" style={{ background: 'var(--rd-danger)', borderColor: 'var(--rd-danger)' }} onClick={async () => {
                      try {
                        await svc.deleteProject(project.id)
                        setDeleting(null)
                        setNotice({ text: `${project.name} deleted.`, tone: 'success' })
                        setReloadTick(t => t + 1)
                      } catch (err) {
                        setNotice({ text: err?.response?.data?.error || 'The project could not be deleted.', tone: 'danger' })
                        setDeleting(null)
                      }
                    }}>Confirm</button>
                    <button type="button" className="rd-btn rd-btn-ghost rd-btn-sm" onClick={() => setDeleting(null)}>Cancel</button>
                  </>
                ) : (
                  <button type="button" className="rd-btn rd-btn-ghost rd-btn-sm" onClick={() => setDeleting(project)} aria-label={`Delete ${project.name}`}>Delete</button>
                )}
              </span>
            </div>
          )
        })}
      </div>

      {notice && (
        <p className={`pc-note ${notice.tone === 'danger' ? 'pc-note-danger' : 'pc-note-success'}`} role="status" style={{ marginTop: '0.75rem' }}>
          {notice.text}
        </p>
      )}

      <NewProjectDrawer
        open={showNew}
        onClose={() => setShowNew(false)}
        existingNames={(projects || []).map(p => p.name.toLowerCase())}
        onCreated={project => {
          setShowNew(false)
          navigate(`${BASE}/projects/${project.id}`)
        }}
      />
    </div>
  )
}
