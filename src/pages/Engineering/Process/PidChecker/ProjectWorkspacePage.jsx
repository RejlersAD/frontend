/**
 * Screen 1 §2.2 — Project workspace (and §2.3 blocked variant).
 *
 * Sections in spec order: header with AI pill + actions · client profile
 * card · add-drawings drop zone · drawings table · drawing sets cards ·
 * 8-slot reference documents grid · register check. The blocked variant
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
import './pidchecker.css'

const DRAWING_TYPES = ['PFD', 'P&ID', 'UFD']

const REFERENCE_SLOTS = [
  { key: 'legend_pid', name: 'Legend P&ID', desc: 'Symbol and abbreviation legend sheets for this project.', unlocks: 'Symbol and abbreviation checks', link: { to: '/engineering/legends', label: 'Open Legend Manager' } },
  { key: 'line_list', name: 'Line list', desc: 'Master line list the line numbers are checked against.', unlocks: 'Line number, size and service checks' },
  { key: 'instrument_index', name: 'Instrument index', desc: 'Instrument tags with type and service.', unlocks: 'Instrument tag and function checks' },
  { key: 'equipment_list', name: 'Equipment list', desc: 'Equipment numbers and ratings.', unlocks: 'Equipment numbering and rating checks', link: { to: '/engineering/process/equipment-list', label: 'Open Equipment List' } },
  { key: 'piping_class_index', name: 'Piping class index', desc: 'Piping classes and their specifications.', unlocks: 'Piping class checks' },
  { key: 'document_register', name: 'Document register', desc: 'Register of project documents and revisions.', unlocks: 'Revision and document status checks', isRegister: true },
  { key: 'adnoc_dgs', name: 'ADNOC DGS', desc: 'Applicable ADNOC Design Guideline Specifications.', unlocks: 'Client standard checks' },
  { key: 'cause_effect', name: 'Cause & effect', desc: 'Cause and effect matrix for trip and alarm checks.', unlocks: 'Trip and alarm cross-checks' },
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
  const fileInputRef = useRef(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const [proj, docs] = await Promise.all([svc.getProject(projectId), svc.listDrawings(projectId)])
      setProject(proj)
      setDrawings(docs)
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

  const visibleDrawings = useMemo(
    () => (drawings || []).filter(d => filter === 'All' || d.type === filter),
    [drawings, filter],
  )

  const drawingCounts = useMemo(() => ({
    All: (drawings || []).length,
    PFD: (drawings || []).filter(d => d.type === 'PFD').length,
    'P&ID': (drawings || []).filter(d => d.type === 'P&ID').length,
  }), [drawings])

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

  const readTotals = useMemo(() => {
    const docs = drawings || []
    const lines = docs.reduce((n, d) => n + (d.lineNumbers ?? 0), 0)
    const tags = docs.reduce((n, d) => n + (d.tags ?? 0), 0)
    const known = docs.some(d => d.lineNumbers != null || d.tags != null)
    return { lines, tags, known }
  }, [drawings])

  const referencesByType = useMemo(() => {
    const map = {}
    for (const r of references || []) {
      const t = r.data_type ?? r.type
      if (t) map[t] = r
    }
    return map
  }, [references])

  const hasRegisters = useMemo(
    () => REFERENCE_SLOTS.some(s => referencesByType[s.key]),
    [referencesByType],
  )

  const uploadFiles = async files => {
    const pdfs = [...files].filter(f => /\.pdf$/i.test(f.name))
    if (pdfs.length === 0 || uploading) return
    setUploading(true)
    setUploadMessage(null)
    try {
      for (const file of pdfs) {
        await svc.uploadDrawing(projectId, file) // eslint-disable-line no-await-in-loop
      }
      setUploadMessage(`${pdfs.length} file${pdfs.length === 1 ? '' : 's'} uploaded. Reading starts in the background.`)
      await load()
    } catch (err) {
      setUploadMessage(err?.response?.data?.error || 'Upload failed. Please retry.')
    } finally {
      setUploading(false)
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

  const changeDrawingType = async (doc, type) => {
    try {
      await svc.updateDrawing(doc.id, { drawing_type: type })
      await load()
    } catch {
      setError('The drawing type could not be saved. Please retry.')
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

  // ── render ────────────────────────────────────────────────────────────

  const header = (
    <PageHeader
      breadcrumb={[{ label: 'PFD & P&ID Checker', to: '/engineering/process/pid-verification' }, { label: project?.name ?? '…' }]}
      title={project?.name ?? 'Project'}
      pill={<Pill label={aiPillLabel(aiSource, aiOnPrem)} tone={aiSource === 'off' ? 'neutral' : 'ai'} />}
      subtitle={project ? `${project.client ?? 'Client not set'}${project.number ? ` · ${project.number}` : ''}` : null}
      actions={(
        <>
          <button type="button" className="rd-btn rd-btn-secondary" onClick={() => setShowAiKeys(true)}>AI & keys</button>
          <button type="button" className="rd-btn rd-btn-secondary" disabled={blocked} title={blocked ? 'Checks are stopped — fix readability first' : undefined}>
            Re-run from saved results
          </button>
          <button type="button" className="rd-btn rd-btn-primary" disabled={blocked} title={blocked ? 'Checks are stopped — fix readability first' : undefined}>
            Re-run checks
          </button>
        </>
      )}
    />
  )

  if (error && !project) {
    return <div className="pc-page">{header}<p className="pc-error" role="alert">{error}</p></div>
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

        <section className="pc-section" aria-label="Reference documents">
          <h2 className="pc-section-title">Reference documents</h2>
          <p className="pc-muted" style={{ margin: 0, fontSize: 'var(--rd-text-table)' }}>
            Reference documents are carried over. PDF registers show Confirm columns before they are used.
          </p>
          <div className="pc-slot-grid">
            {REFERENCE_SLOTS.map(slot => (
              <ReferenceSlot
                key={slot.key}
                slot={slot}
                record={referencesByType[slot.key]}
                onUpload={file => uploadReference(slot.key, file)}
                onConfirmColumns={() => setConfirmRegister(slot.key)}
              />
            ))}
          </div>
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
          register={referencesByType[confirmRegister] ? { name: REFERENCE_SLOTS.find(s => s.key === confirmRegister)?.name, ...referencesByType[confirmRegister] } : null}
          onConfirm={() => setConfirmRegister(null)}
          onUploadExcel={() => setConfirmRegister(null)}
        />
        <AiKeysDrawer open={showAiKeys} onClose={() => setShowAiKeys(false)} projectId={projectId} onSourceChange={(s, op) => { setAiSource(s); setAiOnPrem(op) }} />
      </div>
    )
  }

  // ── §2.2 normal workspace ─────────────────────────────────────────────
  return (
    <div className="pc-page">
      {header}

      {error && <p className="pc-error" role="alert">{error}</p>}

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
        <h2 className="pc-section-title">Drawings</h2>
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
              <span className="pc-chip-count">{drawingCounts[name]}</span>
            </button>
          ))}
        </div>
        <div className="pc-card pc-table-wrap">
          {drawings === null ? (
            <div style={{ padding: '1rem' }}><div className="pc-skeleton" style={{ height: 96 }} /></div>
          ) : visibleDrawings.length === 0 ? (
            <EmptyState title={filter === 'All' ? 'No drawings yet.' : `No ${filter} drawings yet.`}>
              Upload PDF drawings above to start reading them.
            </EmptyState>
          ) : (
            <table className="pc-table">
              <thead>
                <tr>
                  <th>Drawing no.</th><th>Title</th><th>Type</th><th>Rev.</th><th>Readability</th>
                  <th>Read</th><th>Set</th><th>Findings</th><th>Open</th>
                </tr>
              </thead>
              <tbody>
                {visibleDrawings.map(d => (
                  <tr key={d.id} className="pc-row-clickable" onClick={() => openDrawing(d)}>
                    <td className="pc-mono">{d.drawingNo ?? '—'}</td>
                    <td>{d.title}</td>
                    <td onClick={e => e.stopPropagation()}>
                      <select
                        className="pc-select"
                        style={{ minHeight: 30 }}
                        value={d.type ?? ''}
                        onChange={e => changeDrawingType(d, e.target.value)}
                        aria-label={`Drawing type for ${d.drawingNo ?? d.title}`}
                      >
                        <option value="">—</option>
                        {DRAWING_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </td>
                    <td className="pc-mono">{d.rev ?? '—'}</td>
                    <td><ReadabilityPill readability={d.readability} /></td>
                    <td className="pc-muted">
                      {d.lineNumbers != null || d.tags != null
                        ? `${d.lineNumbers ?? 0} lines · ${d.tags ?? 0} tags`
                        : '—'}
                    </td>
                    <td>{d.set ?? '—'}</td>
                    <td>
                      {d.findingsOpen != null
                        ? <Pill label={`${d.findingsOpen} open`} tone={d.findingsOpen > 0 ? 'warning' : 'success'} />
                        : '—'}
                    </td>
                    <td>
                      <span className="rd-btn rd-btn-ghost rd-btn-sm">Open</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className="pc-section" aria-label="Drawing sets">
        <h2 className="pc-section-title">Drawing sets</h2>
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

      <section className="pc-section" aria-label="Reference documents">
        <h2 className="pc-section-title">Reference documents</h2>
        <div className="pc-slot-grid">
          {REFERENCE_SLOTS.map(slot => (
            <ReferenceSlot
              key={slot.key}
              slot={slot}
              record={referencesByType[slot.key]}
              onUpload={file => uploadReference(slot.key, file)}
              onConfirmColumns={() => setConfirmRegister(slot.key)}
            />
          ))}
        </div>
      </section>

      <section className="pc-section" aria-label="Register check">
        <h2 className="pc-section-title">Register check</h2>
        <div className="pc-card pc-card-pad">
          {hasRegisters ? (
            <p className="pc-muted" style={{ margin: 0, fontSize: 'var(--rd-text-table)' }}>
              Registers uploaded. The register check runs once per project — re-run it from the header after changing registers.
            </p>
          ) : (
            <EmptyState title="No registers uploaded yet.">
              {readTotals.known
                ? `Read from drawings so far: ${readTotals.lines} line numbers · ${readTotals.tags} instrument tags. Upload the document register above to check them.`
                : 'Counts read from drawings appear here once reading finishes. Upload the document register above to check them.'}
              {' '}The register check runs once per project, never per sheet.
            </EmptyState>
          )}
        </div>
      </section>

      <ConfirmColumnsDrawer
        open={Boolean(confirmRegister)}
        onClose={() => setConfirmRegister(null)}
        register={referencesByType[confirmRegister] ? { name: REFERENCE_SLOTS.find(s => s.key === confirmRegister)?.name, ...referencesByType[confirmRegister] } : null}
        onConfirm={() => setConfirmRegister(null)}
        onUploadExcel={() => setConfirmRegister(null)}
      />
      <AiKeysDrawer open={showAiKeys} onClose={() => setShowAiKeys(false)} projectId={projectId} onSourceChange={(s, op) => { setAiSource(s); setAiOnPrem(op) }} />
    </div>
  )
}

// ── reference slot card ─────────────────────────────────────────────────

function ReferenceSlot({ slot, record, onUpload, onConfirmColumns }) {
  const inputRef = useRef(null)
  const uploaded = Boolean(record)
  const isPdfRegister = slot.isRegister && uploaded && /\.pdf$/i.test(record.filename ?? record.name ?? '')

  return (
    <div className="pc-slot">
      <div className="pc-slot-top">
        <h3 className="pc-slot-name">{slot.name}</h3>
        <Pill label={uploaded ? 'Uploaded' : 'Missing'} tone={uploaded ? 'success' : 'warning'} />
      </div>
      <p className="pc-slot-desc">{slot.desc}</p>
      <p className="pc-slot-unlocks">Unlocks: {slot.unlocks}</p>
      {slot.link && (
        <p style={{ margin: 0 }}>
          <Link className="rd-btn rd-btn-ghost rd-btn-sm" to={slot.link.to}>{slot.link.label}</Link>
        </p>
      )}
      {isPdfRegister && (
        <div className="pc-slot-actions">
          <Pill label="Confirm columns" tone="warning" />
          <button type="button" className="rd-btn rd-btn-secondary rd-btn-sm" onClick={onConfirmColumns}>
            Preview &amp; confirm
          </button>
        </div>
      )}
      <div className="pc-slot-actions">
        <button type="button" className="rd-btn rd-btn-secondary rd-btn-sm" onClick={() => inputRef.current?.click()}>
          {uploaded ? 'Replace' : 'Upload'}
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
