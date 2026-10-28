/**
 * Screen 1 §2.1 — Projects list for the PFD & P&ID Checker.
 * Client filter chips with counts, 4 KPI tiles, project cards,
 * New project drawer. Every count is derived from the same project +
 * drawing lists at render time (spec §5 rule 1).
 */
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as svc from './pidChecker.service'
import { PageHeader, KpiTile, Pill, ReadabilityPill, Drawer, EmptyState } from './shared'
import './pidchecker.css'

const CLIENTS = ['ADNOC Onshore', 'ADNOC Offshore', 'ADNOC Gas']

const clientOf = project => {
  const c = (project.client || '').toLowerCase()
  for (const name of CLIENTS) if (c === name.toLowerCase()) return name
  return 'Not set'
}

const fmtDate = iso => {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return '—'
  }
}

function projectStatus(project, drawings) {
  const s = (project.status || '').toLowerCase()
  if (s.includes('block')) return 'Blocked — drawing not readable'
  if (s.includes('sign')) return 'Signed'
  if (drawings.some(d => d.readability === 'unreadable')) return 'Blocked — drawing not readable'
  if (drawings.length > 0 && drawings.every(d => d.signed)) return 'Signed'
  return 'In check'
}

// ── New project drawer ──────────────────────────────────────────────────

const PROFILE_CARDS = [
  { id: 'ADNOC Onshore', status: 'Configured' },
  { id: 'ADNOC Offshore', status: 'Not configured' },
  { id: 'ADNOC Gas', status: 'Not configured' },
  { id: 'Other client', status: 'Template' },
]

const SET_COLUMNS = ['Template', 'Drawing number', 'Tag prefix', 'Line number', 'Legend', 'Checklist', 'Specifications']

function NewProjectDrawer({ open, onClose, onCreated }) {
  const [name, setName] = useState('')
  const [number, setNumber] = useState('')
  const [profile, setProfile] = useState('ADNOC Onshore')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const configured = PROFILE_CARDS.find(c => c.id === profile)?.status === 'Configured'

  const submit = async () => {
    if (!name.trim() || busy) return
    setBusy(true)
    setError(null)
    try {
      const project = await svc.createProject({ name: name.trim(), number: number.trim(), client: profile })
      onCreated(project)
      setName(''); setNumber(''); setProfile('ADNOC Onshore')
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
        <label className="pc-label" htmlFor="pc-np-name">Project name</label>
        <input id="pc-np-name" className="pc-input" value={name} onChange={e => setName(e.target.value)} />
      </div>
      <div className="pc-field">
        <label className="pc-label" htmlFor="pc-np-number">Project number</label>
        <input id="pc-np-number" className="pc-input pc-mono" value={number} onChange={e => setNumber(e.target.value)} />
      </div>

      <div className="pc-field">
        <span className="pc-label">Client profile</span>
        <div className="pc-choice-grid">
          {PROFILE_CARDS.map(card => (
            <button
              key={card.id}
              type="button"
              className={`pc-choice-card${profile === card.id ? ' pc-choice-card-active' : ''}`}
              aria-pressed={profile === card.id}
              onClick={() => setProfile(card.id)}
            >
              <span className="pc-choice-name">{card.id}</span>
              <Pill label={card.status} />
            </button>
          ))}
        </div>
      </div>

      {!configured && (
        <p className="pc-note pc-note-warning" style={{ margin: 0 }}>
          This client profile is not configured yet. The project starts from the template set below; confirm the
          template, numbering and checklist with the client before running checks.
        </p>
      )}

      <div className="pc-field">
        <span className="pc-label">{profile} sets</span>
        <div className="pc-table-wrap pc-card">
          <table className="pc-table">
            <thead>
              <tr>{SET_COLUMNS.map(c => <th key={c}>{c}</th>)}</tr>
            </thead>
            <tbody>
              <tr>
                {SET_COLUMNS.map(c => <td key={c} className="pc-faint">—</td>)}
              </tr>
            </tbody>
          </table>
        </div>
        <p className="pc-help">
          Set details come from the client profile configuration. Available after the profile is configured for this client.
        </p>
      </div>

      {error && <p className="pc-error" role="alert">{error}</p>}
    </Drawer>
  )
}

// ── page ────────────────────────────────────────────────────────────────

export default function ProjectsPage() {
  const navigate = useNavigate()
  const [projects, setProjects] = useState(null)
  const [drawingsByProject, setDrawingsByProject] = useState({})
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('All')
  const [showNew, setShowNew] = useState(false)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const list = await svc.listProjects()
        if (!alive) return
        setProjects(list)
        // Real per-project drawing lists drive every count on this screen.
        const entries = await Promise.all(list.map(async p => {
          try {
            return [p.id, await svc.listDrawings(p.id)]
          } catch {
            return [p.id, null] // unknown — tiles show "—", never invented
          }
        }))
        if (!alive) return
        setDrawingsByProject(Object.fromEntries(entries))
      } catch (err) {
        if (alive) setError(err?.response?.data?.error || 'Projects could not be loaded.')
      }
    })()
    return () => { alive = false }
  }, [])

  const drawingsLoaded = useMemo(
    () => (projects || []).length > 0 && (projects || []).every(p => drawingsByProject[p.id] != null),
    [projects, drawingsByProject],
  )

  const allDrawings = useMemo(
    () => Object.values(drawingsByProject).filter(Boolean).flat(),
    [drawingsByProject],
  )

  const kpis = useMemo(() => {
    const list = projects || []
    if (!drawingsLoaded) {
      return { projects: list.length, drawings: null, pfd: null, pid: null, findingsOpen: null, awaitingSignoff: null }
    }
    const pfd = allDrawings.filter(d => d.type === 'PFD').length
    const pid = allDrawings.filter(d => d.type === 'P&ID').length
    const withFindings = allDrawings.filter(d => d.findingsOpen != null)
    const findingsOpen = withFindings.length === allDrawings.length
      ? withFindings.reduce((n, d) => n + d.findingsOpen, 0)
      : null
    const awaitingSignoff = allDrawings.filter(d => !d.signed).length
    return { projects: list.length, drawings: allDrawings.length, pfd, pid, findingsOpen, awaitingSignoff }
  }, [projects, allDrawings, drawingsLoaded])

  const chips = useMemo(() => {
    const list = projects || []
    const counts = { All: list.length }
    for (const c of [...CLIENTS, 'Not set']) counts[c] = 0
    for (const p of list) counts[clientOf(p)] += 1
    return ['All', ...CLIENTS, 'Not set'].map(name => ({ name, count: counts[name] }))
  }, [projects])

  const visible = useMemo(
    () => (projects || []).filter(p => filter === 'All' || clientOf(p) === filter),
    [projects, filter],
  )

  return (
    <div className="pc-page">
      <PageHeader
        title="PFD & P&ID Checker"
        subtitle="Check PFDs and P&IDs against the project checklist, client references and each other."
        actions={(
          <button type="button" className="rd-btn rd-btn-primary" onClick={() => setShowNew(true)}>
            New project
          </button>
        )}
      />

      <div className="pc-chips" role="group" aria-label="Filter by client">
        {chips.map(chip => (
          <button
            key={chip.name}
            type="button"
            className={`pc-chip${filter === chip.name ? ' pc-chip-active' : ''}`}
            aria-pressed={filter === chip.name}
            onClick={() => setFilter(chip.name)}
          >
            {chip.name}
            <span className="pc-chip-count">{chip.count}</span>
          </button>
        ))}
      </div>

      <div className="pc-kpi-grid">
        <KpiTile label="Projects" value={kpis.projects} />
        <KpiTile
          label="Drawings"
          value={kpis.drawings ?? '—'}
          meta={kpis.drawings != null ? `${kpis.pfd} PFD · ${kpis.pid} P&ID` : 'Available once the drawing lists are loaded'}
        />
        <KpiTile
          label="Findings open"
          value={kpis.findingsOpen ?? '—'}
          danger={kpis.findingsOpen > 0}
          meta={kpis.findingsOpen == null ? 'Available after the first check run' : null}
        />
        <KpiTile
          label="Awaiting sign-off"
          value={kpis.awaitingSignoff ?? '—'}
          meta={kpis.awaitingSignoff != null ? 'drawings not signed' : null}
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
          title={`No projects for ${filter === 'All' ? 'this client' : filter} yet.`}
          action={(
            <button type="button" className="rd-btn rd-btn-primary" onClick={() => setShowNew(true)}>
              New project
            </button>
          )}
        >
          Create a project to upload drawings and start the checklist run.
        </EmptyState>
      )}

      <div className="pc-card-grid">
        {visible.map(project => {
          const drawings = drawingsByProject[project.id] || []
          const pfds = drawings.filter(d => d.type === 'PFD').length
          const pids = drawings.filter(d => d.type === 'P&ID').length
          const sets = new Set(drawings.map(d => d.set).filter(Boolean)).size
          const vector = drawings.filter(d => d.readability === 'vector').length
          const ocr = drawings.filter(d => d.readability === 'ocr' || d.readability === 'unreadable').length
          const findingsOpen = drawings.reduce((n, d) => n + (d.findingsOpen ?? 0), 0)
          const signed = drawings.filter(d => d.signed).length
          const status = projectStatus(project, drawings)
          return (
            <button
              key={project.id}
              type="button"
              className="pc-project-card"
              onClick={() => navigate(`/engineering/process/pid-verification/projects/${project.id}`)}
            >
              <div className="pc-project-card-top">
                <h2 className="pc-project-name">{project.name}</h2>
                <Pill label={status} />
              </div>
              <div className="pc-pillrow">
                <Pill label={clientOf(project)} tone="neutral" />
              </div>
              {project.description && <p className="pc-project-desc">{project.description}</p>}
              <div className="pc-pillrow">
                <Pill label={`${pfds} PFDs`} tone="info" />
                <Pill label={`${pids} P&IDs`} tone="neutral" />
                {sets > 0 && <Pill label={`${sets} sets`} tone="neutral" />}
                {drawings.length > 0 && (
                  <Pill label={`${vector} Vector · ${ocr} OCR`} tone={ocr > 0 ? 'warning' : 'success'} />
                )}
              </div>
              <span className="pc-project-meta">
                {drawings.length > 0 ? `${findingsOpen} findings open · ${signed} drawings signed` : 'No drawings yet'}
                {' · '}updated {fmtDate(project.updatedAt)}
              </span>
            </button>
          )
        })}
      </div>

      <NewProjectDrawer
        open={showNew}
        onClose={() => setShowNew(false)}
        onCreated={project => {
          setShowNew(false)
          navigate(`/engineering/process/pid-verification/projects/${project.id}`)
        }}
      />
    </div>
  )
}
