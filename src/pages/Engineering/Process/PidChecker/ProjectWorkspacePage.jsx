/**
 * Screen 1 §2.2 — Project workspace (and §2.3 blocked variant).
 *
 * Sections in spec order: header with AI pill + actions · required inputs
 * card (drawings · legend sheets · checklist — all three compulsory) ·
 * client profile card · add-drawings drop zone · drawings table · drawing
 * sets cards · legend & checklist (the only two reference slots). No line
 * list, instrument index, equipment list or register slots (spec §2.2).
 * The blocked variant
 * renders when the project has an unreadable/blocked state: red banner,
 * sheets table, read-only previous-results card; Re-run checks disabled.
 *
 * Every count is derived at render time from the same drawings /
 * reference-data lists (spec §5). Missing backend data renders "—" or the
 * spec's honest empty state — nothing is invented.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import * as svc from './pidChecker.service'
import { PageHeader, Pill, ReadabilityPill, EmptyState } from './shared'
import AiKeysDrawer from './AiKeysDrawer'
import ConfirmColumnsDrawer from './ConfirmColumnsDrawer'
import ScopeSwitch from './shared/ScopeSwitch'
import './pidchecker.css'

// Spec §2.2: the ONLY reference inputs are legend sheets and the checklist,
// and both are compulsory (decision 29 Oct 2026). No line list, instrument
// index, equipment list or other register slots.
const DEFAULT_CHECKLIST = 'AI-PID-02 · 125 points'

const REFERENCE_SLOTS = [
  { key: 'legend_pid', name: 'Legend sheets', desc: 'Symbol and abbreviation legend sheets for this project.', unlocks: '1.1, 10.2, 12.6', link: { to: '/engineering/legends', label: 'Open Legend Manager' } },
  { key: 'checklist', name: 'Checklist', desc: 'The checklist every drawing is checked against.', unlocks: 'All checklist points' },
]

const aiPillLabel = (source, onPrem) => {
  const base = { org: 'AI: organisation key', byok: 'AI: my key (BYOK)', byokUnset: 'AI: my key — not set', off: 'AI: off' }[source] ?? 'AI: organisation key'
  return onPrem && source !== 'off' ? `${base} · on-prem only` : base
}

export default function ProjectWorkspacePage() {
  const { projectId } = useParams()
  const navigate = useNavigate()

  const [project, setProject] = useState(null)
  const [drawings, setDrawings] = useState(null)
  const [sheets, setSheets] = useState(null) // one row per sheet (spec B5)
  const [selectedDocs, setSelectedDocs] = useState([]) // document ids (selection toolbar)
  const [dupConflict, setDupConflict] = useState(null) // { file, drawing_no, rev, document_id }
  const [references, setReferences] = useState(null)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('All')
  const [showAiKeys, setShowAiKeys] = useState(false)
  const [confirmRegister, setConfirmRegister] = useState(null) // slot key or null
  const [aiSource, setAiSource] = useState('org')
  const [aiOnPrem, setAiOnPrem] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadMessage, setUploadMessage] = useState(null)
  const [runningDocs, setRunningDocs] = useState({}) // docId -> startedAt ISO (spec A)
  const [toasts, setToasts] = useState([]) // { id, text, tone }
  const fileInputRef = useRef(null)
  const legendInputRef = useRef(null)
  const toastId = useRef(0)

  const pushToast = useCallback((text, tone = 'info') => {
    const id = ++toastId.current
    setToasts(prev => [...prev, { id, text, tone }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 8000)
  }, [])

  const load = useCallback(async () => {
    setError(null)
    try {
      const [proj, docs, sheetRows] = await Promise.all([
        svc.getProject(projectId),
        svc.listDrawings(projectId),
        svc.getProjectSheets(projectId).catch(() => []),
      ])
      setProject(proj)
      setDrawings(docs)
      setSheets(sheetRows)
    } catch (err) {
      setError(err?.response?.data?.error || 'The project could not be loaded.')
    }
    try {
      setReferences(await svc.listReferenceData(projectId))
    } catch {
      setReferences([])
    }
  }, [projectId])

  useEffect(() => { load() }, [load])

  const blocked = useMemo(() => {
    const s = (project?.status || '').toLowerCase()
    if (s.includes('block')) return true
    return (drawings || []).some(d => d.readability === 'unreadable')
  }, [project, drawings])

  // ── sheet rows (spec B5: one row per sheet, not per file) ────────────
  const [sheetEditId, setSheetEditId] = useState(null)
  const [sheetEditValue, setSheetEditValue] = useState('')

  const sheetCounts = useMemo(() => ({
    All: (sheets || []).length,
    PFD: (sheets || []).filter(s => (s.drawing_type ?? 'P&ID') === 'PFD').length,
    'P&ID': (sheets || []).filter(s => (s.drawing_type ?? 'P&ID') === 'P&ID').length,
  }), [sheets])

  const visibleSheets = useMemo(
    () => (sheets || []).filter(s => filter === 'All' || (s.drawing_type ?? 'P&ID') === filter),
    [sheets, filter],
  )

  const toggleDocSelected = id => setSelectedDocs(prev => (
    prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
  ))

  const runSelected = async () => {
    const ids = [...selectedDocs]
    setSelectedDocs([])
    const startedAt = new Date().toISOString()
    for (const id of ids) {
      try {
        await svc.reprocess(id) // eslint-disable-line no-await-in-loop
        setRunningDocs(prev => ({ ...prev, [id]: startedAt }))
      } catch { /* row-level Retry stays available */ }
    }
    pushToast(`Checks started on ${ids.length} file${ids.length === 1 ? '' : 's'}`)
  }

  const deleteSelected = async () => {
    const ids = [...selectedDocs]
    setSelectedDocs([])
    for (const id of ids) {
      try { await svc.deleteDrawing(id) } catch { /* keep going */ } // eslint-disable-line no-await-in-loop
    }
    await load()
    pushToast(`${ids.length} file${ids.length === 1 ? '' : 's'} deleted.`)
  }

  const openSheetRow = s => {
    const docObj = (drawings || []).find(d => String(d.id) === String(s.document_id))
    if (s.drawing_type === 'PFD' && docObj) return openDrawing(docObj)
    navigate(`/engineering/process/pid-verification/projects/${projectId}/drawings/${s.document_id}?sheet=${s.page_index + 1}`)
  }

  const saveSheetNumber = async s => {
    const no = sheetEditValue.trim()
    if (!no) { setSheetEditId(null); return }
    try {
      await svc.patchSheet(s.sheet_id, { drawing_no: no })
      setSheetEditId(null)
      await load()
      pushToast('Drawing number confirmed.')
    } catch (err) {
      pushToast(err?.response?.data?.error || 'The drawing number could not be saved.', 'danger')
    }
  }

  const sets = useMemo(() => {
    const bySet = new Map()
    for (const d of drawings || []) {
      const key = d.set || null
      if (!key) continue
      if (!bySet.has(key)) bySet.set(key, [])
      bySet.get(key).push(d)
    }
    return [...bySet.entries()].map(([name, members]) => {
      const pfd = members.find(m => m.type === 'PFD')
      const open = members.reduce((n, m) => n + (m.findingsOpen ?? 0), 0)
      return { name, members, pfd, open }
    })
  }, [drawings])

  const referencesByType = useMemo(() => {
    const map = {}
    for (const r of references || []) {
      const t = r.data_type ?? r.type
      if (t) map[t] = r
    }
    return map
  }, [references])

  const drawingsProvided = (drawings || []).length > 0
  const legendProvided = Boolean(referencesByType.legend_pid)
  // The default checklist (PRO-001 Rev A) applies unless the client uploaded
  // their own; an explicit upload replaces it. Either way it counts provided.
  const checklistRecord = referencesByType.checklist ?? null
  const checklistProvided = true // default checklist always available
  const providedCount = [drawingsProvided, legendProvided, checklistProvided].filter(Boolean).length
  const missingInputs = [
    !drawingsProvided && 'drawings',
    !legendProvided && 'legend sheets',
  ].filter(Boolean)
  const inputsMissing = missingInputs.length > 0

  const [rerunning, setRerunning] = useState(false)
  const reRunChecks = async () => {
    if (rerunning || inputsMissing || blocked) return
    setRerunning(true)
    setError(null)
    try {
      const startedAt = new Date().toISOString()
      const ids = (drawings || []).map(d => d.id)
      for (const d of drawings || []) {
        await svc.reprocess(d.id) // eslint-disable-line no-await-in-loop
      }
      setRunningDocs(prev => ({ ...prev, ...Object.fromEntries(ids.map(id => [id, startedAt])) }))
      pushToast(`Checks started on ${ids.length} drawing${ids.length === 1 ? '' : 's'}`)
    } catch (err) {
      setError(err?.response?.data?.error || 'The re-run could not be started. Please retry.')
    } finally {
      setRerunning(false)
    }
  }

  const retryDocument = async doc => {
    try {
      await svc.reprocess(doc.id)
      setRunningDocs(prev => ({ ...prev, [doc.id]: new Date().toISOString() }))
      pushToast(`Check started on ${doc.fileName ?? doc.drawingNo ?? 'drawing'}`)
    } catch (err) {
      pushToast(err?.response?.data?.error || 'The retry could not be started.', 'danger')
    }
  }

  // Spec A: poll every 5 s while any row is running; toast on completion,
  // red pill + Retry on failure, stuck-note after 15 min.
  useEffect(() => {
    const runningIds = Object.keys(runningDocs)
    const anyProcessing = (drawings || []).some(d => String(d.status).toLowerCase() === 'processing')
    if (runningIds.length === 0 && !anyProcessing) return undefined
    const timer = setInterval(async () => {
      try {
        const docs = await svc.listDrawings(projectId)
        setDrawings(prev => {
          const byId = Object.fromEntries(docs.map(d => [String(d.id), d]))
          for (const id of runningIds) {
            const before = (prev || []).find(d => String(d.id) === id)
            const after = byId[id]
            if (!after) continue
            const s = String(after.status).toLowerCase()
            if (s === 'completed' && String(before?.status).toLowerCase() !== 'completed') {
              pushToast(`${after.fileName ?? after.drawingNo ?? 'Drawing'} checked — ${after.findingsOpen ?? 0} findings`, 'success')
              setRunningDocs(prev2 => { const n = { ...prev2 }; delete n[id]; return n })
            } else if ((s === 'failed' || s === 'error') && String(before?.status).toLowerCase() !== s) {
              pushToast(`${after.fileName ?? after.drawingNo ?? 'Drawing'} failed — see the row for details`, 'danger')
              setRunningDocs(prev2 => { const n = { ...prev2 }; delete n[id]; return n })
            }
          }
          return docs
        })
      } catch { /* keep polling — transient network errors */ }
    }, 5000)
    return () => clearInterval(timer)
  }, [runningDocs, drawings, projectId, pushToast])

  const uploadFiles = async (files, { allowDuplicate = false } = {}) => {
    const pdfs = [...files].filter(f => /\.pdf$/i.test(f.name))
    if (pdfs.length === 0 || uploading) return
    setUploading(true)
    setUploadMessage(null)
    try {
      for (const file of pdfs) {
        try {
          await svc.uploadDrawing(projectId, file, { allowDuplicate }) // eslint-disable-line no-await-in-loop
        } catch (err) {
          // Same drawing number at the same revision — ask "Replace or keep both".
          if (err?.response?.status === 409 && err.response.data?.conflict === 'duplicate_revision') {
            setDupConflict({ file, ...err.response.data })
            continue
          }
          throw err
        }
      }
      setUploadMessage(`${pdfs.length} file${pdfs.length === 1 ? '' : 's'} uploaded. Reading starts in the background.`)
      await load()
    } catch (err) {
      setUploadMessage(err?.response?.data?.error || 'Upload failed. Please retry.')
    } finally {
      setUploading(false)
    }
  }

  // Duplicate-revision resolution (spec A1.3): "Replace" removes the old
  // file and uploads again; "Keep both" re-uploads with the duplicate flag.
  const resolveDupConflict = async mode => {
    const c = dupConflict
    setDupConflict(null)
    if (!c) return
    try {
      if (mode === 'replace' && c.document_id) {
        await svc.deleteDrawing(c.document_id)
      }
      await svc.uploadDrawing(projectId, c.file, { allowDuplicate: true })
      pushToast(mode === 'replace' ? `${c.drawing_no} replaced.` : `${c.drawing_no} uploaded — both copies kept.`)
      await load()
    } catch (err) {
      pushToast(err?.response?.data?.error || 'The upload failed.', 'danger')
    }
  }

  const uploadReference = async (slotKey, file) => {
    if (!file) return
    try {
      await svc.uploadReferenceData(projectId, slotKey, file)
      await load()
    } catch (err) {
      setError(err?.response?.data?.error || `The ${slotKey} upload failed.`)
    }
  }

  const previousResults = project?.raw?.previous_results ?? project?.raw?.last_v1_results ?? null

  const openDrawing = doc => {
    const base = `/engineering/process/pid-verification/projects/${projectId}`
    if (doc.type === 'PFD') {
      navigate(`${base}/sets/${encodeURIComponent(doc.set || doc.id)}`)
    } else {
      navigate(`${base}/drawings/${doc.id}`)
    }
  }

  // Cross-sheet tag occurrences (formerly XREF-001 findings) — the data
  // for the "Tags across sheets" table in Drawing sets.
  const tagsAcrossSheetsRows = useMemo(
    () => (drawings || []).flatMap(d =>
      (d.tagsAcrossSheets || []).map(t => ({ doc: d, tag: t.tag, type: t.tag_type, pages: t.pages || [] }))),
    [drawings],
  )

  // ── render ────────────────────────────────────────────────────────────

  const header = (
    <PageHeader
      breadcrumb={[{ label: 'PFD & P&ID Checker', to: '/engineering/process/pid-verification' }, { label: project?.name ?? '…' }]}
      title={project?.name ?? 'Project'}
      pill={<Pill label={aiPillLabel(aiSource, aiOnPrem)} tone={aiSource === 'off' ? 'neutral' : 'ai'} />}
      subtitle={project ? `${project.client ?? 'Client not set'}${project.number ? ` · ${project.number}` : ''}` : null}
      actions={(
        <>
          <ScopeSwitch projectId={projectId} sheetCount={(sheets || []).filter(s => !s.superseded).length || null} active="one" />
          <button type="button" className="rd-btn rd-btn-secondary" onClick={() => setShowAiKeys(true)}>AI & keys</button>
          <button
            type="button"
            className="rd-btn rd-btn-secondary"
            disabled={blocked || inputsMissing || rerunning}
            title={blocked ? 'Checks are stopped — fix readability first' : inputsMissing ? 'Add the compulsory inputs first — see Required inputs below' : 'Re-render results from the saved extraction and findings'}
            onClick={() => load()}
          >
            Re-run from saved results
          </button>
          <button
            type="button"
            className="rd-btn rd-btn-primary"
            disabled={blocked || inputsMissing || rerunning}
            title={blocked ? 'Checks are stopped — fix readability first' : inputsMissing ? 'Checks cannot run — drawings, legend sheets and checklist are all compulsory' : undefined}
            onClick={reRunChecks}
          >
            {rerunning ? 'Re-running…' : 'Re-run checks'}
          </button>
        </>
      )}
    />
  )

  if (error && !project) {
    return <div className="pc-page">{header}<p className="pc-error" role="alert">{error}</p></div>
  }

  // Spec F: skeleton on first load — never a blank white page.
  if (!project) {
    return (
      <div className="pc-page">
        {header}
        <div className="pc-card pc-card-pad" style={{ marginBottom: '1rem' }}><div className="pc-skeleton" style={{ height: 96 }} /></div>
        <div className="pc-card pc-card-pad"><div className="pc-skeleton" style={{ height: 220 }} /></div>
      </div>
    )
  }

  // ── §2.3 blocked variant ──────────────────────────────────────────────
  if (blocked) {
    const unreadable = (drawings || []).filter(d => d.readability === 'unreadable')
    return (
      <div className="pc-page">
        {header}

        <div className="pc-banner pc-banner-danger" role="alert">
          <div>
            <p className="pc-banner-title">Checks stopped: no line numbers could be read from these sheets</p>
            <p>
              {unreadable.length > 0
                ? `${unreadable.length} sheet${unreadable.length === 1 ? '' : 's'} read by OCR returned characters but 0 line numbers. Findings from these sheets would be unreliable, so the check run is stopped for this project.`
                : 'Characters were read but 0 line numbers were found. Findings would be unreliable, so the check run is stopped for this project.'}
            </p>
            <div className="pc-banner-actions">
              <button type="button" className="rd-btn rd-btn-secondary" onClick={() => fileInputRef.current?.click()}>
                Upload vector PDF
              </button>
              {unreadable[0] && (
                <button type="button" className="rd-btn rd-btn-secondary" onClick={() => openDrawing(unreadable[0])}>
                  Review OCR on sheet 1
                </button>
              )}
            </div>
          </div>
        </div>

        <section className="pc-section" aria-label="Sheets">
          <h2 className="pc-section-title">Sheets</h2>
          <div className="pc-card pc-table-wrap">
            <table className="pc-table">
              <thead>
                <tr><th>Sheet</th><th>Readability</th><th>Characters read</th><th>Line numbers</th><th>Instrument tags</th><th>Status</th></tr>
              </thead>
              <tbody>
                {(drawings || []).map(d => (
                  <tr key={d.id}>
                    <td className="pc-mono">{d.drawingNo ?? d.title}</td>
                    <td><ReadabilityPill readability={d.readability} /></td>
                    <td>{d.charactersRead ?? '—'}</td>
                    <td>{d.lineNumbers ?? '—'}</td>
                    <td>{d.tags ?? '—'}</td>
                    <td><Pill label={d.readability === 'unreadable' ? 'Not OK' : (d.status ?? 'Waiting')} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="pc-section" aria-label="Legend and checklist">
          <h2 className="pc-section-title">Legend &amp; checklist</h2>
          <div className="pc-slot-grid">
            {REFERENCE_SLOTS.map(slot => (
              <ReferenceSlot
                key={slot.key}
                slot={slot}
                record={slot.key === 'checklist' ? checklistRecord : referencesByType[slot.key]}
                defaultLabel={slot.key === 'checklist' ? DEFAULT_CHECKLIST : null}
                onUpload={file => uploadReference(slot.key, file)}
                onConfirmColumns={slot.key === 'checklist' ? () => setConfirmRegister('checklist') : null}
              />
            ))}
          </div>
          <p className="pc-note" style={{ margin: 0 }}>
            The line list, equipment list and instrument index uploaded in V2 are kept on file but are no longer used.
          </p>
        </section>

        <section className="pc-section" aria-label="Previous results">
          <h2 className="pc-section-title">Previous engine results</h2>
          <div className="pc-card pc-card-pad" aria-readonly="true">
            {previousResults ? (
              <>
                <dl className="pc-kv">
                  <dt>Run date</dt><dd>{previousResults.date ?? '—'}</dd>
                  <dt>Total findings</dt><dd>{previousResults.total ?? '—'}</dd>
                </dl>
                {previousResults.report_url && (
                  <p style={{ margin: '0.75rem 0 0' }}>
                    <a className="rd-btn rd-btn-ghost rd-btn-sm" href={previousResults.report_url}>Open old report</a>
                  </p>
                )}
                <p className="pc-note pc-note-warning" style={{ margin: '0.75rem 0 0' }}>
                  These results come from the previous engine and are shown here only. They do not appear in any counts, tiles or reports on the new screens.
                </p>
              </>
            ) : (
              <EmptyState title="No previous engine results are stored for this project.">
                Results from earlier runs appear here once the backend provides them.
              </EmptyState>
            )}
          </div>
        </section>

        <ConfirmColumnsDrawer
          open={Boolean(confirmRegister)}
          onClose={() => setConfirmRegister(null)}
          mode="checklist"
          projectId={projectId}
          register={referencesByType.checklist ? { name: referencesByType.checklist.filename ?? 'Client checklist', ...referencesByType.checklist } : { name: DEFAULT_CHECKLIST }}
          onConfirm={() => setConfirmRegister(null)}
          onUseDefault={() => setConfirmRegister(null)}
        />
        <AiKeysDrawer open={showAiKeys} onClose={() => setShowAiKeys(false)} projectId={projectId} onSourceChange={(s, op) => { setAiSource(s); setAiOnPrem(op) }} />
        <Toasts toasts={toasts} />
      </div>
    )
  }

  // ── §2.2 normal workspace ─────────────────────────────────────────────
  return (
    <div className="pc-page">
      {header}

      {error && <p className="pc-error" role="alert">{error}</p>}

      <section className="pc-section" aria-label="Required inputs">
        <div className="pc-card">
          <div className="pc-card-header">
            <h2 className="pc-card-title">Required inputs</h2>
            <Pill label={`${providedCount} of 3 provided`} tone={providedCount === 3 ? 'success' : 'danger'} />
          </div>
          <div className="pc-card-pad" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <RequiredInputRow
              name="Drawings (PFDs and P&IDs)"
              provided={drawingsProvided}
              description="The PDF drawings the checks run on. PFDs are optional; P&IDs are required."
              actionLabel="Add"
              onAction={() => fileInputRef.current?.click()}
            />
            <RequiredInputRow
              name="Legend sheets"
              provided={legendProvided}
              description="Symbol and abbreviation legend. Unlocks checks 1.1, 10.2 and 12.6."
              actionLabel={legendProvided ? 'Replace' : 'Add'}
              onAction={() => legendInputRef.current?.click()}
            />
            <RequiredInputRow
              name="Checklist"
              provided={checklistProvided}
              description={checklistRecord ? `Client checklist: ${checklistRecord.filename ?? checklistRecord.name ?? 'uploaded'}` : `${DEFAULT_CHECKLIST} (default)`}
              actionLabel={checklistRecord ? 'Replace' : 'Upload client checklist'}
              onAction={() => setConfirmRegister('checklist')}
            />
            {inputsMissing && (
              <p className="pc-note pc-note-danger" role="alert" style={{ margin: 0 }}>
                Checks cannot run. Add the {missingInputs.join(' and ')} — all three inputs are compulsory.
              </p>
            )}
          </div>
        </div>
        <input
          ref={legendInputRef}
          type="file"
          hidden
          onChange={e => { uploadReference('legend_pid', e.target.files?.[0]); e.target.value = '' }}
          aria-label="Upload legend sheets"
        />
      </section>

      <section className="pc-section" aria-label="Client profile">
        <div className="pc-card">
          <div className="pc-card-header">
            <h2 className="pc-card-title">Client profile</h2>
            <Pill label={project?.client ?? 'Not set'} tone={project?.client ? 'success' : 'warning'} />
          </div>
          <div className="pc-card-pad">
            <dl className="pc-kv">
              <dt>Client</dt><dd>{project?.client ?? '—'}</dd>
              <dt>Project number</dt><dd className="pc-mono">{project?.number ?? '—'}</dd>
              <dt>Checklist</dt><dd>—</dd>
              <dt>Numbering rules</dt><dd>—</dd>
            </dl>
            <p className="pc-help" style={{ marginTop: '0.75rem' }}>
              Profile details are available once the client profile is configured. <Link to="/engineering/legends">View profile</Link>
            </p>
          </div>
        </div>
      </section>

      <section className="pc-section" aria-label="Add drawings">
        <h2 className="pc-section-title">Add drawings</h2>
        <div
          className={`pc-dropzone${dragActive ? ' pc-dropzone-active' : ''}`}
          role="button"
          tabIndex={0}
          aria-label="Upload PDF drawings"
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInputRef.current?.click() } }}
          onDragOver={e => { e.preventDefault(); setDragActive(true) }}
          onDragLeave={() => setDragActive(false)}
          onDrop={e => { e.preventDefault(); setDragActive(false); uploadFiles(e.dataTransfer.files) }}
        >
          <p className="pc-dropzone-title">{uploading ? 'Uploading…' : 'Drop PDF drawings here'}</p>
          <p className="pc-dropzone-help">Vector PDFs are read exactly; scans and outlined text are read by OCR.</p>
          <span className="rd-btn rd-btn-secondary rd-btn-sm">Browse files</span>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          hidden
          onChange={e => { uploadFiles(e.target.files); e.target.value = '' }}
        />
        {uploadMessage && <p className="pc-note pc-note-warning" style={{ margin: 0 }} role="status">{uploadMessage}</p>}
      </section>

      <section className="pc-section" aria-label="Drawings">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h2 className="pc-section-title" style={{ margin: 0 }}>Drawings</h2>
          <button
            type="button"
            className="rd-btn rd-btn-secondary rd-btn-sm"
            onClick={reRunChecks}
            disabled={rerunning || inputsMissing || blocked}
            title={inputsMissing ? 'Checks cannot run — add the compulsory inputs first' : undefined}
          >
            {rerunning ? 'Starting…' : 'Run checks on all'}
          </button>
        </div>

        {dupConflict && (
          <div className="pc-banner pc-banner-warning" role="alert" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
            <p style={{ margin: 0 }}>
              <span className="pc-mono">{dupConflict.drawing_no}</span>{dupConflict.rev ? ` Rev ${dupConflict.rev}` : ''} is already in the project at this revision. Replace it, or keep both?
            </p>
            <span style={{ display: 'inline-flex', gap: '0.375rem' }}>
              <button type="button" className="rd-btn rd-btn-primary rd-btn-sm" onClick={() => resolveDupConflict('replace')}>Replace</button>
              <button type="button" className="rd-btn rd-btn-secondary rd-btn-sm" onClick={() => resolveDupConflict('keep')}>Keep both</button>
              <button type="button" className="rd-btn rd-btn-ghost rd-btn-sm" onClick={() => setDupConflict(null)}>Cancel</button>
            </span>
          </div>
        )}

        <div className="pc-chips" role="group" aria-label="Filter drawings by type">
          {['All', 'PFD', 'P&ID'].map(name => (
            <button
              key={name}
              type="button"
              className={`pc-chip${filter === name ? ' pc-chip-active' : ''}`}
              aria-pressed={filter === name}
              onClick={() => setFilter(name)}
            >
              {name}
              <span className="pc-chip-count">{sheetCounts[name]}</span>
            </button>
          ))}
        </div>

        {selectedDocs.length > 0 && (
          <div className="pc-banner" role="toolbar" aria-label="Selected files" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 'var(--rd-text-table)' }}>
              {selectedDocs.length} file{selectedDocs.length === 1 ? '' : 's'} selected
            </span>
            <button type="button" className="rd-btn rd-btn-secondary rd-btn-sm" onClick={runSelected}>Run</button>
            <button type="button" className="rd-btn rd-btn-ghost rd-btn-sm" onClick={deleteSelected}>Delete</button>
            <button type="button" className="rd-btn rd-btn-ghost rd-btn-sm" onClick={() => setSelectedDocs([])}>Clear</button>
          </div>
        )}

        <div className="pc-card pc-table-wrap">
          {sheets === null ? (
            <div style={{ padding: '1rem' }}><div className="pc-skeleton" style={{ height: 96 }} /></div>
          ) : visibleSheets.length === 0 ? (
            <EmptyState title={filter === 'All' ? 'No drawings yet.' : `No ${filter} drawings yet.`}>
              Upload PDF drawings above to start reading them.
            </EmptyState>
          ) : (
            <table className="pc-table">
              <thead>
                <tr>
                  <th aria-label="Select" />
                  <th>Drawing no.</th><th>Title</th><th>Source</th><th>Rev.</th>
                  <th>Status</th><th>Findings</th><th>Cross</th><th>Open</th>
                </tr>
              </thead>
              <tbody>
                {visibleSheets.map(s => {
                  const startedAt = runningDocs[s.document_id]
                  const running = Boolean(startedAt) || String(s.status).toLowerCase() === 'processing'
                  const failed = ['failed', 'error'].includes(String(s.status).toLowerCase()) && !running
                  const checked = selectedDocs.includes(s.document_id)
                  return (
                    <tr
                      key={s.sheet_id}
                      className="pc-row-clickable"
                      style={s.superseded ? { opacity: 0.55 } : undefined}
                      onClick={() => openSheetRow(s)}
                    >
                      <td onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleDocSelected(s.document_id)}
                          aria-label={`Select ${s.file_name}`}
                          style={{ width: 18, height: 18, accentColor: 'var(--rd-primary)' }}
                        />
                      </td>
                      <td className="pc-mono" onClick={sheetEditId === s.sheet_id ? e => e.stopPropagation() : undefined}>
                        {sheetEditId === s.sheet_id ? (
                          <span style={{ display: 'inline-flex', gap: '0.375rem', alignItems: 'center' }}>
                            <input
                              className="pc-input pc-mono"
                              style={{ minHeight: 30, minWidth: 180 }}
                              value={sheetEditValue}
                              autoFocus
                              onChange={e => setSheetEditValue(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') saveSheetNumber(s)
                                if (e.key === 'Escape') setSheetEditId(null)
                              }}
                              aria-label={`Confirm drawing number for page ${s.page_index + 1}`}
                            />
                            <button type="button" className="rd-btn rd-btn-primary rd-btn-sm" onClick={() => saveSheetNumber(s)}>Save</button>
                            <button type="button" className="rd-btn rd-btn-ghost rd-btn-sm" onClick={() => setSheetEditId(null)}>Cancel</button>
                          </span>
                        ) : (
                          <>
                            {s.drawing_no ?? '—'}
                            {!s.drawing_no_confirmed && (
                              <button
                                type="button"
                                className="rd-btn rd-btn-ghost rd-btn-sm"
                                style={{ color: 'var(--rd-warning, #b45309)' }}
                                onClick={e => { e.stopPropagation(); setSheetEditId(s.sheet_id); setSheetEditValue(s.drawing_no ?? '') }}
                                title="Drawing number to confirm"
                              >
                                To confirm
                              </button>
                            )}
                            {s.superseded && (
                              <span className="pc-faint" style={{ marginLeft: '0.375rem', fontSize: 'var(--rd-text-caption)' }}>
                                Superseded by Rev {s.superseded_by_rev ?? '?'}
                              </span>
                            )}
                          </>
                        )}
                      </td>
                      <td>{s.title ?? '—'}</td>
                      <td className="pc-muted">{s.file_name} · p.{s.page_index + 1}</td>
                      <td className="pc-mono">{s.rev ?? '—'}</td>
                      <td onClick={e => e.stopPropagation()}>
                        {running ? (
                          <Pill label="Running" tone="info" />
                        ) : failed ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}>
                            <Pill label="Failed" tone="danger" />
                            <button type="button" className="rd-btn rd-btn-secondary rd-btn-sm" onClick={() => retryDocument({ id: s.document_id, fileName: s.file_name, drawingNo: s.drawing_no })}>Retry</button>
                          </span>
                        ) : (
                          <Pill label={s.status === 'completed' ? 'Checked' : (s.status || 'Queued')} />
                        )}
                      </td>
                      <td className="pc-mono">{s.findings ?? '—'}</td>
                      <td>{(s.cross ?? 0) > 0 ? <Pill label={`${s.cross} X`} tone="warning" /> : '—'}</td>
                      <td>
                        <span className="rd-btn rd-btn-ghost rd-btn-sm">Open</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className="pc-section" aria-label="Drawing sets">
        <h2 className="pc-section-title">Drawing sets</h2>
        {tagsAcrossSheetsRows.length > 0 && (
          <div className="pc-card pc-table-wrap" style={{ marginBottom: '0.875rem' }}>
            <div className="pc-card-header">
              <h3 className="pc-card-title">Tags across sheets</h3>
              <span className="pc-faint" style={{ fontSize: 'var(--rd-text-caption)' }}>
                Cross-sheet tag occurrences — information, not findings
              </span>
            </div>
            <table className="pc-table">
              <thead>
                <tr><th>Drawing</th><th>Tag</th><th>Type</th><th>Sheets</th></tr>
              </thead>
              <tbody>
                {tagsAcrossSheetsRows.map(row => (
                  <tr key={`${row.doc.id}:${row.tag}`}>
                    <td className="pc-mono">{row.doc.drawingNo ?? row.doc.fileName ?? '—'}</td>
                    <td className="pc-mono">{row.tag}</td>
                    <td>{row.type || '—'}</td>
                    <td>
                      {row.pages.map(p => (
                        <button
                          key={p}
                          type="button"
                          className="rd-btn rd-btn-ghost rd-btn-sm"
                          onClick={() => navigate(`/engineering/process/pid-verification/projects/${projectId}/drawings/${row.doc.id}?sheet=${p + 1}`)}
                        >
                          {p + 1}
                        </button>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {sets.length === 0 ? (
          <div className="pc-card">
            <EmptyState title="No drawing sets yet.">
              Sets appear when a PFD and its covering P&amp;IDs have been read. Available after the first drawings are uploaded.
            </EmptyState>
          </div>
        ) : (
          <div className="pc-card-grid">
            {sets.map(set => (
              <div key={set.name} className="pc-card pc-card-pad" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div className="pc-slot-top">
                  <h3 className="pc-card-title">{set.name}</h3>
                  <Pill label={`${set.open} open`} tone={set.open > 0 ? 'warning' : 'success'} />
                </div>
                <p className="pc-slot-desc">
                  PFD <span className="pc-mono">{set.pfd?.drawingNo ?? '—'}</span> · {set.members.filter(m => m.type === 'P&ID').length} P&amp;IDs
                </p>
                <p className="pc-slot-unlocks">Connectors: waiting for the set check run</p>
                <div>
                  <button
                    type="button"
                    className="rd-btn rd-btn-secondary rd-btn-sm"
                    onClick={() => navigate(`/engineering/process/pid-verification/projects/${projectId}/sets/${encodeURIComponent(set.name)}`)}
                  >
                    Open set
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="pc-section" aria-label="Legend and checklist">
        <h2 className="pc-section-title">Legend &amp; checklist</h2>
        <p className="pc-muted" style={{ margin: 0, fontSize: 'var(--rd-text-table)' }}>
          The only two reference inputs — both compulsory. No line list, instrument index, equipment list or other registers are used.
        </p>
        <div className="pc-slot-grid">
          {REFERENCE_SLOTS.map(slot => (
            <ReferenceSlot
              key={slot.key}
              slot={slot}
              record={slot.key === 'checklist' ? checklistRecord : referencesByType[slot.key]}
              defaultLabel={slot.key === 'checklist' ? DEFAULT_CHECKLIST : null}
              onUpload={file => uploadReference(slot.key, file)}
              onConfirmColumns={slot.key === 'checklist' ? () => setConfirmRegister('checklist') : null}
            />
          ))}
        </div>
      </section>

      <ConfirmColumnsDrawer
        open={Boolean(confirmRegister)}
        onClose={() => setConfirmRegister(null)}
        mode="checklist"
        projectId={projectId}
        register={referencesByType.checklist ? { name: referencesByType.checklist.filename ?? 'Client checklist', ...referencesByType.checklist } : { name: DEFAULT_CHECKLIST }}
        onConfirm={() => setConfirmRegister(null)}
        onUseDefault={() => setConfirmRegister(null)}
      />
      <AiKeysDrawer open={showAiKeys} onClose={() => setShowAiKeys(false)} projectId={projectId} onSourceChange={(s, op) => { setAiSource(s); setAiOnPrem(op) }} />
      <Toasts toasts={toasts} />
    </div>
  )
}

// ── toasts (spec A) ─────────────────────────────────────────────────────

function Toasts({ toasts }) {
  if (!toasts.length) return null
  return (
    <div className="pc-toasts" role="status" aria-live="polite">
      {toasts.map(t => (
        <p key={t.id} className={`pc-toast pc-toast-${t.tone}`}>{t.text}</p>
      ))}
    </div>
  )
}

// ── required input row (§2.2) ───────────────────────────────────────────

function RequiredInputRow({ name, provided, description, actionLabel, onAction }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
      <span className="pc-slot-name" style={{ minWidth: 160 }}>
        <span className="pc-required" aria-hidden="true">*</span> {name}
      </span>
      <Pill label={provided ? 'Provided' : 'Missing'} tone={provided ? 'success' : 'danger'} />
      <span className="pc-muted" style={{ flex: 1, minWidth: 220, fontSize: 'var(--rd-text-table)' }}>{description}</span>
      <button
        type="button"
        className={`rd-btn rd-btn-sm ${provided ? 'rd-btn-secondary' : 'rd-btn-primary'}`}
        onClick={onAction}
      >
        {actionLabel}
      </button>
    </div>
  )
}

// ── reference slot card (§2.2: provided → Replace only, never Remove) ───

function ReferenceSlot({ slot, record, defaultLabel = null, onUpload, onConfirmColumns }) {
  const inputRef = useRef(null)
  const uploaded = Boolean(record) || Boolean(defaultLabel)
  const isChecklist = slot.key === 'checklist'

  return (
    <div className="pc-slot">
      <div className="pc-slot-top">
        <h3 className="pc-slot-name">
          <span className="pc-required" aria-hidden="true">*</span> {slot.name}
        </h3>
        <Pill label={uploaded ? 'Provided' : 'Required — missing'} tone={uploaded ? 'success' : 'danger'} />
      </div>
      <p className="pc-slot-desc">{slot.desc}</p>
      <p className="pc-slot-unlocks">Unlocks: {slot.unlocks}</p>
      {record && (
        <p className="pc-muted" style={{ margin: 0, fontSize: 'var(--rd-text-table)' }}>
          <span className="pc-mono">{record.file_name ?? record.filename ?? 'uploaded file'}</span>
          {' · '}{/\.(xlsx?|csv)$/i.test(record.file_name ?? record.filename ?? '') ? 'Excel register' : 'PDF'}
          {(record.revision ?? record.rev) ? ` · Rev ${record.revision ?? record.rev}` : ''}
        </p>
      )}
      {isChecklist && (
        <p className="pc-muted" style={{ margin: 0, fontSize: 'var(--rd-text-table)' }}>
          {record ? (record.filename ?? record.name ?? 'Client checklist uploaded') : `${defaultLabel} (default)`}
        </p>
      )}
      {slot.link && (
        <p style={{ margin: 0 }}>
          <Link className="rd-btn rd-btn-ghost rd-btn-sm" to={slot.link.to}>{slot.link.label}</Link>
        </p>
      )}
      <div className="pc-slot-actions">
        {isChecklist && onConfirmColumns && (
          <button
            type="button"
            className={`rd-btn rd-btn-sm ${uploaded ? 'rd-btn-secondary' : 'rd-btn-primary'}`}
            onClick={onConfirmColumns}
          >
            Upload client checklist
          </button>
        )}
        <button
          type="button"
          className={`rd-btn rd-btn-sm ${!isChecklist && !uploaded ? 'rd-btn-primary' : 'rd-btn-secondary'}`}
          onClick={() => inputRef.current?.click()}
        >
          {uploaded && !isChecklist ? 'Replace' : isChecklist ? (record ? 'Replace' : 'Upload file') : 'Upload'}
        </button>
        <input
          ref={inputRef}
          type="file"
          hidden
          onChange={e => { onUpload(e.target.files?.[0]); e.target.value = '' }}
          aria-label={`Upload ${slot.name}`}
        />
      </div>
    </div>
  )
}
