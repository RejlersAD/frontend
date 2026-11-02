/**
 * SLD Checker — project workspace. Mirrors the P&ID checker
 * ProjectWorkspacePage: header with AI pill + actions, required-inputs
 * card (SLD drawing · Equipment List · Load List · legend · checklist
 * AI-SLD-01), upload slots, and a drawings table with ONE ROW PER SLD
 * SHEET (checker workspace endpoint), with Re-run buttons.
 *
 * Every count is derived at render time from the same state/sheets lists.
 * Where the checker backend has no data yet, the honest empty state is
 * rendered — nothing is invented.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import * as svc from './sldChecker.service'
import { PageHeader, Pill, EmptyState } from '../../Process/PidChecker/shared'
import { SlotSummary } from '../SLDComparison'
import '../../Process/PidChecker/pidchecker.css'
import './sldchecker.css'

const BASE = '/engineering/electrical/sld'
const DEFAULT_CHECKLIST = 'AI-SLD-01 · 54 points'

const FILE_SLOTS = [
  { kind: 'sld', label: 'SLD drawing (PDF)', accept: '.pdf' },
  { kind: 'equipment', label: 'Equipment List', accept: '.xlsx,.xls,.pdf' },
  { kind: 'load', label: 'Load List', accept: '.xlsx,.xls,.pdf' },
]

const normSheet = (s = {}, i = 0) => ({
  id: s.sheet_id ?? s.id ?? `sheet-${i}`,
  fileId: s.file_id ?? s.file ?? null,
  pageIndex: s.page_index ?? s.page ?? i,
  drawingNo: s.drawing_no ?? s.drawing_number ?? null,
  drawingNoConfirmed: s.drawing_no_confirmed ?? Boolean(s.drawing_no ?? s.drawing_number),
  rev: s.rev ?? s.revision ?? null,
  title: s.title ?? null,
  fileName: s.file_name ?? s.filename ?? null,
  status: s.status ?? null,
  findings: s.findings ?? s.findings_count ?? null,
  raw: s,
})

function sheetStatusLabel(s) {
  const v = String(s.status || '').toLowerCase()
  if (v === 'processing' || v === 'running') return 'Running'
  if (v === 'completed' || v === 'complete' || v === 'checked') return 'Checked'
  if (v === 'failed' || v === 'error') return 'Failed'
  return 'Queued'
}

// ── required-input row (same pattern as the P&ID workspace) ────────────

function RequiredInputRow({ name, provided, description, actionLabel, onAction, disabled = false, disabledHint = null }) {
  return (
    <div className="sc-input-row">
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, fontWeight: 600, fontSize: 'var(--rd-text-table)' }}>
          <span className="pc-required" aria-hidden="true">*</span> {name}
        </p>
        <p className="pc-help" style={{ margin: '0.125rem 0 0' }}>{description}</p>
      </div>
      <Pill label={provided ? 'Provided' : 'Required — missing'} tone={provided ? 'success' : 'danger'} />
      <button
        type="button"
        className={`rd-btn rd-btn-sm ${provided ? 'rd-btn-secondary' : 'rd-btn-primary'}`}
        onClick={onAction}
        disabled={disabled}
        title={disabled ? (disabledHint || undefined) : undefined}
      >
        {actionLabel}
      </button>
    </div>
  )
}

export default function SldCheckerWorkspacePage() {
  const { projectId } = useParams()
  const navigate = useNavigate()

  const [project, setProject] = useState(null)
  const [state, setState] = useState(null) // core staged state
  const [sheets, setSheets] = useState(null) // one row per SLD sheet (checker)
  const [workspaceAvailable, setWorkspaceAvailable] = useState(true)
  const [error, setError] = useState(null)
  const [toasts, setToasts] = useState([]) // { id, text, tone }
  const [rerunning, setRerunning] = useState(false)
  const [uploading, setUploading] = useState(null) // slot kind
  const toastId = useRef(0)
  const inputRefs = { sld: useRef(null), equipment: useRef(null), load: useRef(null) }

  const pushToast = useCallback((text, tone = 'info') => {
    const id = ++toastId.current
    setToasts(prev => [...prev, { id, text, tone }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 8000)
  }, [])

  const load = useCallback(async () => {
    setError(null)
    let st = null
    try {
      st = await svc.getState(projectId)
      setState(st)
      setProject({ id: projectId, name: st.project_name ?? st.name ?? `Project ${projectId}`, raw: st })
    } catch (err) {
      setError(err?.response?.data?.error || 'The project could not be loaded.')
    }
    try {
      const data = await svc.workspace(projectId)
      setSheets((Array.isArray(data) ? data : data?.sheets || []).map(normSheet))
      setWorkspaceAvailable(true)
    } catch (err) {
      if (err?.response?.status === 404) {
        // Checker backend not deployed yet — the sheet table shows its
        // honest empty state; the core slots above keep working.
        setWorkspaceAvailable(false)
        setSheets([])
      } else {
        setSheets([])
      }
    }
    return st
  }, [projectId])

  useEffect(() => { load() }, [load])

  const byKind = useMemo(
    () => Object.fromEntries((state?.files || []).map(f => [f.kind, f])),
    [state],
  )

  const sldProvided = Boolean(byKind.sld)
  const equipmentProvided = Boolean(byKind.equipment)
  const loadProvided = Boolean(byKind.load)
  const legendProvided = Boolean(state?.legend?.source)
  const checklistProvided = true // AI-SLD-01 default applies unless replaced
  const providedCount = [sldProvided, equipmentProvided, loadProvided, legendProvided, checklistProvided].filter(Boolean).length
  const missingInputs = [
    !sldProvided && 'SLD drawing',
    !equipmentProvided && 'Equipment List',
    !loadProvided && 'Load List',
    !legendProvided && 'legend',
  ].filter(Boolean)
  const inputsMissing = missingInputs.length > 0

  const upload = async (kind, file) => {
    if (!file || uploading) return
    setUploading(kind)
    try {
      await svc.uploadFile(projectId, kind, file)
      await load()
      pushToast(`${FILE_SLOTS.find(s => s.kind === kind)?.label ?? 'File'} uploaded.`)
    } catch (err) {
      pushToast(err?.response?.data?.error || 'The upload failed. Please retry.', 'danger')
    } finally {
      setUploading(null)
    }
  }

  const reRunChecks = async () => {
    if (rerunning || inputsMissing) return
    setRerunning(true)
    try {
      const { analysisId } = await svc.analyse(projectId)
      // Poll the core analysis, then run the checker rules on it.
      const poll = async () => {
        try {
          const a = await svc.getAnalysis(projectId, analysisId)
          if (a.status === 'completed') {
            try {
              await svc.run(analysisId)
              pushToast('Analysis complete — checker rules started.', 'success')
            } catch {
              pushToast('Analysis complete — the checker backend is not available yet.', 'warning')
            }
            await load()
            return
          }
          if (a.status === 'failed') {
            pushToast(a.error || 'Analysis failed.', 'danger')
            await load()
            return
          }
        } catch { /* keep polling — transient network errors */ }
        setTimeout(poll, 4000)
      }
      poll()
      pushToast('Checks started')
    } catch (err) {
      pushToast(err?.response?.data?.error || 'The re-run could not be started. Please retry.', 'danger')
      setRerunning(false)
      return
    }
    setRerunning(false)
  }

  const analysesCount = state?.analyses_count ?? 0
  const latestAnalysisId = state?.latest_analysis?.id ?? null

  const header = (
    <PageHeader
      breadcrumb={[{ label: 'SLD Checker', to: BASE }, { label: project?.name ?? '…' }]}
      title={project?.name ?? 'Project'}
      pill={<Pill label={state?.byok ? `AI: my key ••••${state.byok.last4}` : 'AI: my key — not set'} tone={state?.byok ? 'ai' : 'neutral'} />}
      subtitle={project ? `${(state?.files || []).length} of 3 files · ${analysesCount} analyses` : null}
      actions={(
        <>
          <SldScopeSwitch projectId={projectId} sheetCount={(sheets || []).length || null} active="one" />
          <button type="button" className="rd-btn rd-btn-secondary" onClick={() => navigate(`${BASE}/classic`)}>
            Classic comparison
          </button>
          <button
            type="button"
            className="rd-btn rd-btn-primary"
            disabled={inputsMissing || rerunning}
            title={inputsMissing ? 'Checks cannot run — add the required inputs first' : undefined}
            onClick={reRunChecks}
          >
            {rerunning ? 'Re-running…' : 'Re-run checks'}
          </button>
        </>
      )}
    />
  )

  if (error && !state) {
    return <div className="pc-page">{header}<p className="pc-error" role="alert">{error}</p></div>
  }

  // Skeleton on first load — never an input/worker alarm on half-loaded state.
  if (!state) {
    return (
      <div className="pc-page">
        {header}
        <div className="pc-card pc-card-pad" style={{ marginBottom: '1rem' }}><div className="pc-skeleton" style={{ height: 72 }} /></div>
        <div className="pc-card pc-card-pad"><div className="pc-skeleton" style={{ height: 320 }} /></div>
      </div>
    )
  }

  return (
    <div className="pc-page">
      {header}

      {error && <p className="pc-error" role="alert">{error}</p>}

      <section className="pc-section" aria-label="Required inputs">
        <div className="pc-card">
          <div className="pc-card-header">
            <h2 className="pc-card-title">Required inputs</h2>
            <Pill label={`${providedCount} of 5 provided`} tone={providedCount === 5 ? 'success' : 'danger'} />
          </div>
          <div className="pc-card-pad" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <RequiredInputRow
              name="SLD drawing"
              provided={sldProvided}
              description={byKind.sld ? `${byKind.sld.summary?.drawing_no ?? byKind.sld.file_name ?? 'uploaded'}${byKind.sld.summary?.rev ? ` · Rev ${byKind.sld.summary.rev}` : ''}` : 'The PDF single line diagram the checks run on.'}
              actionLabel={sldProvided ? 'Replace' : 'Add'}
              onAction={() => inputRefs.sld.current?.click()}
            />
            <RequiredInputRow
              name="Equipment List"
              provided={equipmentProvided}
              description={byKind.equipment ? `${byKind.equipment.summary?.document ?? 'uploaded'} · Rev ${byKind.equipment.summary?.rev ?? '—'}` : 'Boards, transformers and generators the SLD is compared against.'}
              actionLabel={equipmentProvided ? 'Replace' : 'Add'}
              onAction={() => inputRefs.equipment.current?.click()}
            />
            <RequiredInputRow
              name="Load List"
              provided={loadProvided}
              description={byKind.load ? `${byKind.load.summary?.document ?? 'uploaded'} · board ${byKind.load.summary?.board ?? '—'}` : 'Every load must trace to a board on the SLD.'}
              actionLabel={loadProvided ? 'Replace' : 'Add'}
              onAction={() => inputRefs.load.current?.click()}
            />
            <RequiredInputRow
              name="Legend"
              provided={legendProvided}
              description={legendProvided ? (state.legend.name || 'Legend active') : 'Symbols and tag rules used to sort every tag before checking.'}
              actionLabel={legendProvided ? 'Review' : 'Activate'}
              onAction={() => {
                const fileId = byKind.sld?.id ?? byKind.sld?.file_id
                if (fileId) navigate(`${BASE}/projects/${projectId}/drawings/${fileId}?step=2`)
              }}
            />
            <RequiredInputRow
              name="Checklist"
              provided={checklistProvided}
              description={`${DEFAULT_CHECKLIST} (default)`}
              actionLabel="Open"
              onAction={() => {
                const fileId = byKind.sld?.id ?? byKind.sld?.file_id
                if (fileId && latestAnalysisId) navigate(`${BASE}/projects/${projectId}/drawings/${fileId}?step=4`)
              }}
            />
            {inputsMissing && (
              <p className="pc-note pc-note-danger" role="alert" style={{ margin: 0 }}>
                Checks cannot run. Add the {missingInputs.join(', ')} — all five inputs are compulsory.
              </p>
            )}
          </div>
        </div>
        {FILE_SLOTS.map(slot => (
          <input
            key={slot.kind}
            ref={inputRefs[slot.kind]}
            type="file"
            accept={slot.accept}
            hidden
            onChange={e => { upload(slot.kind, e.target.files?.[0]); e.target.value = '' }}
            aria-label={`Upload ${slot.label}`}
          />
        ))}
      </section>

      <section className="pc-section" aria-label="Files">
        <h2 className="pc-section-title">Files</h2>
        <div className="sc-slot-grid">
          {FILE_SLOTS.map(slot => {
            const f = byKind[slot.kind]
            return (
              <div key={slot.kind} className="pc-card pc-card-pad" style={f ? { borderColor: 'var(--rd-success)' } : undefined}>
                <div className="pc-slot-top">
                  <h3 className="pc-card-title">{slot.label}</h3>
                  <Pill label={f ? 'Provided' : 'Required — missing'} tone={f ? 'success' : 'danger'} />
                </div>
                {f && <SlotSummary kind={slot.kind} summary={f.summary} />}
                <div>
                  <button
                    type="button"
                    className={`rd-btn rd-btn-sm ${f ? 'rd-btn-secondary' : 'rd-btn-primary'}`}
                    disabled={uploading === slot.kind}
                    onClick={() => inputRefs[slot.kind].current?.click()}
                  >
                    {uploading === slot.kind ? 'Reading…' : f ? 'Replace' : 'Upload'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <section className="pc-section" aria-label="SLD sheets">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h2 className="pc-section-title" style={{ margin: 0 }}>SLD sheets</h2>
          <button
            type="button"
            className="rd-btn rd-btn-secondary rd-btn-sm"
            onClick={reRunChecks}
            disabled={rerunning || inputsMissing}
            title={inputsMissing ? 'Checks cannot run — add the required inputs first' : undefined}
          >
            {rerunning ? 'Starting…' : 'Run checks on all'}
          </button>
        </div>
        <div className="pc-card pc-table-wrap">
          {sheets === null ? (
            <div style={{ padding: '1rem' }}><div className="pc-skeleton" style={{ height: 96 }} /></div>
          ) : sheets.length === 0 ? (
            <EmptyState title={workspaceAvailable ? 'No SLD sheets yet.' : 'The checker sheet list is not available yet.'}>
              {workspaceAvailable
                ? 'Upload an SLD drawing above; its sheets appear here once it has been read.'
                : 'Available after the checker backend is connected. Upload and analyse still work.'}
            </EmptyState>
          ) : (
            <table className="pc-table">
              <thead>
                <tr><th>Drawing no.</th><th>Title</th><th>Source</th><th>Rev.</th><th>Status</th><th>Findings</th><th>Open</th></tr>
              </thead>
              <tbody>
                {sheets.map(s => (
                  <tr
                    key={s.id}
                    className="pc-row-clickable"
                    onClick={() => navigate(`${BASE}/projects/${projectId}/drawings/${s.fileId ?? byKind.sld?.id}?sheet=${s.pageIndex + 1}`)}
                  >
                    <td className="pc-mono">
                      {s.drawingNo ?? 'Drawing number to confirm'}
                      {!s.drawingNoConfirmed && (
                        <span className="pc-faint" style={{ marginLeft: '0.375rem', fontSize: 'var(--rd-text-caption)' }} title="Drawing number to confirm">
                          To confirm
                        </span>
                      )}
                    </td>
                    <td>{s.title ?? '—'}</td>
                    <td className="pc-muted">{s.fileName ? `${s.fileName} · p.${s.pageIndex + 1}` : `Sheet ${s.pageIndex + 1}`}</td>
                    <td className="pc-mono">{s.rev ?? '—'}</td>
                    <td><Pill label={sheetStatusLabel(s)} /></td>
                    <td className="pc-mono">{s.findings ?? '—'}</td>
                    <td><span className="rd-btn rd-btn-ghost rd-btn-sm">Open</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <p className="pc-help">
          Prefer the staged comparison flow? <Link to={`${BASE}/classic`}>Open the classic comparison</Link>.
        </p>
      </section>

      <Toasts toasts={toasts} />
    </div>
  )
}

// ── Scope toggle ("This SLD | All SLDs") — ScopeSwitch-style, SLD routes ─

export function SldScopeSwitch({ projectId, drawingNo = null, sheetCount = null, active = 'one', fileId = null }) {
  const navigate = useNavigate()
  const base = `${BASE}/projects/${projectId}`

  const choose = next => {
    if (next === 'all') {
      navigate(`${base}/review`)
      return
    }
    if (fileId) {
      navigate(`${base}/drawings/${fileId}?sheet=1`)
    } else {
      navigate(base)
    }
  }

  return (
    <div className="pc-seg" role="group" aria-label="Review scope" style={{ height: 36 }}>
      <button
        type="button"
        className={`pc-seg-btn${active === 'one' ? ' pc-seg-btn-active' : ''}`}
        style={{ minHeight: 36 }}
        aria-pressed={active === 'one'}
        onClick={() => choose('one')}
      >
        This SLD{drawingNo ? ` · ${drawingNo}` : ''}
      </button>
      <button
        type="button"
        className={`pc-seg-btn${active === 'all' ? ' pc-seg-btn-active' : ''}`}
        style={{ minHeight: 36 }}
        aria-pressed={active === 'all'}
        onClick={() => choose('all')}
      >
        All SLDs{sheetCount != null ? ` · ${sheetCount}` : ''}
      </button>
    </div>
  )
}

// ── toasts ──────────────────────────────────────────────────────────────

function Toasts({ toasts }) {
  if (toasts.length === 0) return null
  return (
    <div className="sc-toasts" role="status" aria-live="polite">
      {toasts.map(t => (
        <p key={t.id} className={`pc-note ${t.tone === 'danger' ? 'pc-note-danger' : t.tone === 'success' ? 'pc-note-success' : t.tone === 'warning' ? 'pc-note-warning' : ''}`} style={{ margin: 0 }}>
          {t.text}
        </p>
      ))}
    </div>
  )
}
