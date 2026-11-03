/**
 * SLD Checker — Projects. Cards 3–4 per row: name · n/3 files · last
 * analysis date · Matched m/t · Conflicts c (from the latest analysis
 * headline — never invented). New Project keeps the existing createProject
 * with unique case-insensitive names.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import svc from './sldChecker.service'
import { PageHeader, Pill, Drawer, EmptyState } from '../../Process/PidChecker/shared'
import '../../Process/PidChecker/pidchecker.css'
import './sldchecker.css'

const BASE = '/engineering/electrical/sld'

const fmtDate = iso => {
  if (!iso) return null
  try {
    return new Date(iso).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch {
    return null
  }
}

function NewProjectDrawer({ open, onClose, onCreated, existingNames }) {
  const [name, setName] = useState('')
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
      const p = await svc.createProject({ projectName: trimmed })
      onCreated({ id: p.project_id ?? p.id, name: p.project_name ?? trimmed })
      setName('')
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
      {error && <p className="pc-error" role="alert">{error}</p>}
      <p className="pc-note" style={{ margin: 0 }}>
        Upload the SLD drawing, the Equipment List and the Load List, then analyse.
      </p>
    </Drawer>
  )
}

export default function SldCheckerProjectsPage() {
  const navigate = useNavigate()
  const [projects, setProjects] = useState(null)
  const [stateByProject, setStateByProject] = useState({})
  const [error, setError] = useState(null)
  const [showNew, setShowNew] = useState(false)
  const [deleting, setDeleting] = useState(null)
  const [notice, setNotice] = useState(null)
  const [reloadTick, setReloadTick] = useState(0)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const data = await svc.listProjects()
        const raw = Array.isArray(data) ? data : (data?.projects || data?.results || [])
        const list = raw.map(p => ({ id: p.project_id ?? p.id, name: p.project_name ?? p.name ?? 'Untitled project' }))
        if (!alive) return
        setProjects(list)
        const entries = await Promise.all(list.map(async p => {
          try { return [p.id, await svc.getState(p.id)] } catch { return [p.id, null] }
        }))
        if (!alive) return
        setStateByProject(Object.fromEntries(entries))
      } catch (err) {
        if (alive) setError(err?.response?.data?.error || 'Projects could not be loaded.')
      }
    })()
    return () => { alive = false }
  }, [reloadTick])

  return (
    <div className="pc-page">
      <PageHeader
        title="SLD Checker — Projects"
        subtitle="Compare the single line diagram with the Equipment List and Load List before issue."
        actions={(
          <button type="button" className="rd-btn rd-btn-primary" onClick={() => setShowNew(true)}>
            New Project
          </button>
        )}
      />

      {error && <p className="pc-error" role="alert">{error}</p>}
      {!error && projects === null && (
        <div className="pc-card-grid" aria-label="Loading projects">
          {[0, 1, 2].map(i => <div key={i} className="pc-skeleton" style={{ height: 120 }} />)}
        </div>
      )}

      {projects !== null && projects.length === 0 && (
        <EmptyState
          title="No projects yet."
          action={<button type="button" className="rd-btn rd-btn-primary" onClick={() => setShowNew(true)}>New Project</button>}
        >
          Create a project to upload the SLD, the Equipment List and the Load List.
        </EmptyState>
      )}

      <div className="pc-card-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
        {(projects || []).map(project => {
          const st = stateByProject[project.id]
          const files = st?.files?.length ?? null
          const latest = st?.latest_analysis ?? null
          const h = latest?.headline ?? null
          const lastDate = fmtDate(latest?.created_at)
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
                {latest && <Pill label={latest.status === 'completed' ? 'Analysed' : (latest.status ?? 'Draft')} tone={latest.status === 'completed' ? 'success' : 'warning'} />}
              </div>
              <div className="pc-pillrow">
                <Pill label={`${files ?? '—'}/3 files`} tone={files != null && files >= 2 ? 'info' : 'neutral'} />
                {st?.byok && <Pill label="AI: my key" tone="ai" />}
              </div>
              <span className="pc-project-meta">
                {lastDate ? `Last analysis ${lastDate}` : 'Not analysed yet'}
              </span>
              {h && (
                <span className="pc-project-meta">
                  Matched {h.matched ?? 0}/{h.matchedTotal ?? 0} · Conflicts {h.loadConflicts ?? 0}
                </span>
              )}
              <span
                className="pc-project-actions"
                onClick={e => e.stopPropagation()}
                onKeyDown={e => e.stopPropagation()}
              >
                {deleting?.id === project.id ? (
                  <>
                    <span className="pc-faint" style={{ fontSize: 'var(--rd-text-caption)' }}>Delete this project and its files?</span>
                    <button type="button" className="rd-btn rd-btn-primary rd-btn-sm" style={{ background: 'var(--rd-danger)', borderColor: 'var(--rd-danger)' }} onClick={async () => {
                      try {
                        await svc.deleteProject(project.id)
                        setDeleting(null)
                        setNotice(`${project.name} deleted.`)
                        setReloadTick(t => t + 1)
                      } catch (err) {
                        setNotice(err?.response?.data?.error || 'The project could not be deleted.')
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

      {notice && <p className="pc-note pc-note-success" role="status" style={{ marginTop: '0.75rem' }}>{notice}</p>}

      <NewProjectDrawer
        open={showNew}
        onClose={() => setShowNew(false)}
        existingNames={(projects || []).map(p => p.name.toLowerCase())}
        onCreated={project => { setShowNew(false); navigate(`${BASE}/projects/${project.id}`) }}
      />
    </div>
  )
}
