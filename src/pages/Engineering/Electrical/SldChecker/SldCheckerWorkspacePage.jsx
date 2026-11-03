/**
 * SLD Checker — project page (comparison reskin). Only the staged
 * comparison API is called (sldService via ./sldChecker.service).
 *
 * Header: breadcrumb · project name (never the UUID; skeleton until
 * loaded) · client / project no. / 1 SLD · n sheets pills · sub-line ·
 * violet AI key pill · Export ▾ (latest analysis) · primary Analyse
 * (disabled with 'Complete Stage n first' until the stages allow).
 *
 * Sections: Comparison overview (inputs drawn as an SLD + last-analysis
 * side panel) · Inputs + RADAI noticed · SLD sheets compact table with
 * Previous analyses in a Drawer.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import svc from './sldChecker.service'
import { PageHeader, Pill, Drawer, EmptyState } from '../../Process/PidChecker/shared'
import { ConnectKeyModal, PreviousAnalyses } from '../SLDComparison'
import ComparisonSld from './overview/ComparisonSld'
import '../../Process/PidChecker/pidchecker.css'
import './sldchecker.css'

const BASE = '/engineering/electrical/sld'
const pad = n => String(n).padStart(3, '0')

const fmtDateTime = iso => {
  if (!iso) return null
  try { return new Date(iso).toLocaleString() } catch { return null }
}

const PDF_TYPE_LABEL = {
  'vector-text': 'Vector — text layer',
  'vector-outlines': 'Vector — outlines (OCR used)',
  scanned: 'Scanned image',
}

const BANNER_WORDS = {
  boardMismatch: 'board mismatch',
  tagConflict: 'tag conflict',
  ratingMismatch: 'rating mismatch',
  wrongAreaCode: 'wrong area code',
}

// ── stage gating (mirrors the staged comparison flow) ───────────────────

function useStages(state) {
  return useMemo(() => {
    const files = state?.files || []
    const byKind = Object.fromEntries(files.map(f => [f.kind, f]))
    const hasSld = Boolean(byKind.sld)
    const fileCount = files.length
    const stage1 = fileCount >= 2
    const notNeeded = !hasSld && stage1
    const stage2 = notNeeded || Boolean(state?.byok)
    const stage3 = notNeeded || state?.stage_state?.['3'] === 'complete' || Boolean(state?.legend?.source)
    return { byKind, hasSld, fileCount, stage1, stage2, stage3, notNeeded, allReady: stage1 && stage2 && stage3 }
  }, [state])
}

const firstIncompleteStage = s => (!s.stage1 ? 1 : !s.stage2 ? 2 : !s.stage3 ? 3 : null)

// ═══════════════════════════════════════════════════════════════════════

export default function SldCheckerWorkspacePage() {
  const { projectId } = useParams()
  const navigate = useNavigate()

  const [project, setProject] = useState(null)
  const [state, setState] = useState(null)
  const [analysis, setAnalysis] = useState(null) // latest analysis detail (headline + banner)
  const [eqRows, setEqRows] = useState([])
  const [eqloadRows, setEqloadRows] = useState([])
  const [cableRows, setCableRows] = useState([])
  const [error, setError] = useState(null)
  const [toasts, setToasts] = useState([])
  const [analysing, setAnalysing] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const [showPrevious, setShowPrevious] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const toastId = useRef(0)
  const inputBus = useRef({}) // InputsCard registers openPicker(kind)

  const pushToast = useCallback((text, tone = 'info') => {
    const id = ++toastId.current
    setToasts(prev => [...prev, { id, text, tone }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 8000)
  }, [])

  const stages = useStages(state)
  const { byKind } = stages
  const sldFileId = byKind.sld?.id ?? byKind.sld?.file_id ?? null
  const latestId = state?.latest_analysis?.id ?? null

  const load = useCallback(async () => {
    setError(null)
    let st = null
    try {
      st = await svc.getState(projectId)
      setState(st)
      setProject({ id: projectId, name: st.project_name ?? st.name ?? 'Project' })
    } catch (err) {
      setError(err?.response?.data?.error || 'The project could not be loaded.')
      return null
    }
    const aid = st?.latest_analysis?.id ?? null
    if (aid) {
      try { setAnalysis(await svc.getAnalysis(projectId, aid)) } catch { setAnalysis(null) }
      try { setEqRows((await svc.getAnalysis(projectId, aid, 'equipment'))?.rows || []) } catch { setEqRows([]) }
      try { setEqloadRows((await svc.getAnalysis(projectId, aid, 'eqload'))?.rows || []) } catch { setEqloadRows([]) }
      try { setCableRows((await svc.getAnalysis(projectId, aid, 'cables'))?.rows || []) } catch { setCableRows([]) }
    } else {
      setAnalysis(null); setEqRows([]); setEqloadRows([]); setCableRows([])
    }
    return st
  }, [projectId])

  useEffect(() => { load() }, [load])

  const analyse = async () => {
    const missingStage = firstIncompleteStage(stages)
    if (analysing || missingStage) return
    setAnalysing(true)
    try {
      const { analysisId } = await svc.analyse(projectId)
      const poll = async () => {
        try {
          const a = await svc.getAnalysis(projectId, analysisId)
          if (a.status === 'completed') {
            pushToast(`Analysis complete · ${a.headline?.loadConflicts ?? 0} Load List conflicts · ${a.headline?.draftingTotal ?? 0} drafting findings`, 'success')
            await load()
            return
          }
          if (a.status === 'failed') { pushToast(a.error || 'Analysis failed.', 'danger'); await load(); return }
        } catch { /* keep polling — transient errors */ }
        setTimeout(poll, 4000)
      }
      poll()
      pushToast('Analysis started')
    } catch (err) {
      pushToast(err?.response?.data?.error || 'The analysis could not be started. Please retry.', 'danger')
    } finally {
      setAnalysing(false)
    }
  }

  const onIncomer = id => {
    if (id === 'ai') { setShowKey(true); return }
    if (id === 'lg') {
      if (sldFileId) navigate(`${BASE}/projects/${projectId}/drawings/${sldFileId}?step=3`)
      else pushToast('Upload the SLD drawing first — the legend is built from it.')
      return
    }
    const kind = { sld: 'sld', el: 'equipment', ll: 'load' }[id] ?? id
    inputBus.current.openPicker?.(kind)
  }

  const onFeeder = tab => {
    if (!latestId) return
    navigate(`${BASE}/projects/${projectId}/drawings/${sldFileId ?? 'latest'}?step=4&tab=${tab}&analysis=${latestId}`)
  }

  // ── derived values ────────────────────────────────────────────────────
  const headline = analysis?.headline ?? null
  const banner = analysis?.banner ?? null
  const analysesCount = state?.analyses_count ?? 0
  const lastDate = fmtDateTime(state?.latest_analysis?.created_at)
  const client = state?.client ?? state?.client_profile ?? null
  const projectNumber = state?.project_number ?? state?.number ?? null
  const sldSummary = byKind.sld?.summary ?? null
  const sheetRows = useMemo(() => (sldSummary?.sheets || []).map((s, i) => ({
    name: s.name ?? `Sheet ${pad(i + 1)}`,
    drawingNo: s.drawing_no ?? null,
    rev: s.rev ?? null,
    index: i,
  })), [sldSummary])
  const pageCount = sheetRows.length || sldSummary?.page_count || 0

  const boardsOnSheet = useCallback(sheetName => {
    const want = String(sheetName).toLowerCase()
    const tags = eqRows
      .filter(r => ['board', 'transformer', 'generator'].includes(String(r.category || '').toLowerCase())
        && String(r.onSld || '').toLowerCase() === want)
      .map(r => r.tag)
      .filter(Boolean)
    return tags
  }, [eqRows])

  // Incomer states for the overview diagram.
  const incomers = useMemo(() => {
    const file = (id, kind, code, name) => ({
      id, code, name,
      status: { state: byKind[kind] ? 'closed' : 'missing' },
      ariaLabel: `${name}, ${byKind[kind] ? 'uploaded' : 'missing'}, ${byKind[kind] ? 'replace' : 'upload'}`,
    })
    const aiState = stages.notNeeded ? 'not-needed' : state?.byok ? 'closed' : 'connect'
    const lgState = stages.notNeeded ? 'not-needed' : state?.stage_state?.['3'] === 'needs-recheck' ? 'recheck' : state?.legend?.source ? 'closed' : 'missing'
    return [
      file('sld', 'sld', 'SLD', 'SLD drawing'),
      file('el', 'equipment', 'EL', 'Equipment List'),
      file('ll', 'load', 'LL', 'Load List'),
      {
        id: 'ai', code: 'AI', name: 'RADAI AI Engine',
        status: { state: aiState },
        ariaLabel: `RADAI AI Engine, ${aiState === 'closed' ? `using your key ••••${state.byok.last4}` : aiState === 'connect' ? 'key not set, connect' : 'not needed, no SLD uploaded'}`,
      },
      {
        id: 'lg', code: 'LG', name: 'Electrical legend',
        status: { state: lgState },
        ariaLabel: `Electrical legend, ${lgState === 'closed' ? (state.legend?.name || 'active') : lgState === 'recheck' ? 'needs re-check after SLD replace' : lgState === 'not-needed' ? 'not needed, no SLD uploaded' : 'missing'}, review`,
      },
    ]
  }, [byKind, stages, state])

  // Outgoing feeders from the LATEST analysis only.
  const feeders = useMemo(() => {
    const h = headline
    const largestBanner = banner
      ? Object.entries(BANNER_WORDS).filter(([k]) => (banner[k] ?? 0) > 0).sort((a, b) => (banner[b[0]] ?? 0) - (banner[a[0]] ?? 0))[0]?.[1]
      : null
    const need = (codes, tab) => {
      const missing = codes.filter(c => !byKind[c])
      if (missing.length > 0) {
        const names = missing.map(c => ({ sld: 'SLD', equipment: 'Equipment List', load: 'Load List' }[c])).join(' + ')
        return { id: tab, tone: 'grey', value: '—', sub: `needs ${names}` }
      }
      return null
    }
    const mk = (tab, name, needs, value, sub, tone) => ({
      id: tab, name, ...(need(needs, tab) || { value, sub, tone }),
      ariaLabel: `${name}: ${need(needs, tab) ? `needs ${needs.join(' and ')}` : `${value}, ${sub}`}, open results`,
    })
    return [
      mk('equipment', 'SLD vs Equipment List', ['sld', 'equipment'],
        h ? `${h.matched ?? 0} / ${h.matchedTotal ?? 0}` : '—', `matched · ${eqRows.filter(r => r.status === 'sld-only').length} on SLD only`,
        h && (h.matched ?? 0) < (h.matchedTotal ?? 0) ? 'amber' : 'green'),
      mk('load', 'SLD vs Load List', ['sld', 'load'],
        h ? `${h.loadConflicts ?? 0} / ${h.loadTotal ?? 0}` : '—', `conflicts${largestBanner ? ` · ${largestBanner}` : ''}`,
        h && (h.loadConflicts ?? 0) > 0 ? 'red' : 'green'),
      mk('eqload', 'Equipment vs Load List', ['equipment', 'load'],
        String(eqloadRows.filter(r => r.status === 'board-covered' || r.status === 'matched').length),
        `covered · ${eqloadRows.filter(r => r.status === 'not-in-equipment-list').length} not in EL`,
        eqloadRows.some(r => r.status === 'not-in-equipment-list') ? 'red' : 'green'),
      mk('drafting', 'Drafting check', ['sld'],
        h ? String(h.draftingTotal ?? 0) : '—', `${h?.draftingHigh ?? 0} high · ${h?.draftingMedium ?? 0} medium`,
        h && (h.draftingTotal ?? 0) > 0 ? 'red' : 'green'),
      mk('interfaces', 'Interfaces', ['sld'],
        h ? String(h.interfaces ?? 0) : '—', 'other areas · not compared', 'green'),
      mk('cables', 'Cables', ['sld'],
        String(cableRows.length), 'cable tags on SLD', 'green'),
    ]
  }, [headline, banner, byKind, eqRows, eqloadRows, cableRows])

  const busLabel = `RADAI COMPARISON BUS · ${lastDate ? `LAST ANALYSIS ${lastDate}` : 'NOT ANALYSED YET'}`

  // Before-the-next-analysis rows.
  const nextSteps = useMemo(() => {
    const out = []
    if (!stages.notNeeded && !state?.byok) out.push({ label: 'Connect your AI key', onClick: () => setShowKey(true) })
    if (state?.stage_state?.['3'] === 'needs-recheck') out.push({ label: 'Re-check the legend', onClick: () => onIncomer('lg') })
    for (const kind of ['sld', 'equipment', 'load']) {
      if (!byKind[kind]) out.push({ label: `Upload ${{ sld: 'the SLD drawing', equipment: 'the Equipment List', load: 'the Load List' }[kind]}`, onClick: () => inputBus.current.openPicker?.(kind) })
    }
    return out.slice(0, 3)
  }, [stages, state, byKind]) // eslint-disable-line react-hooks/exhaustive-deps

  const missingStage = firstIncompleteStage(stages)

  const header = (
    <PageHeader
      breadcrumb={[
        { label: 'Engineering' },
        { label: '1.4 Electrical' },
        { label: 'SLD Checker', to: BASE },
        { label: project?.name ?? '…' },
      ]}
      title={project?.name ?? 'Project'}
      pill={(
        <>
          <Pill label={client ?? 'Client not set'} tone={client ? 'success' : 'neutral'} />
          {projectNumber && <Pill label={projectNumber} tone="neutral" />}
          <Pill label={`${byKind.sld ? 1 : 0} SLD · ${pageCount} sheets`} tone="info" />
        </>
      )}
      subtitle={`Last analysis ${lastDate ?? '—'} · ${analysesCount} ${analysesCount === 1 ? 'analysis' : 'analyses'} · compares the SLD with the Equipment List and Load List`}
      actions={(
        <>
          <button
            type="button"
            className={`pc-pill ${state?.byok ? 'pc-pill-ai' : 'pc-pill-warning'}`}
            style={{ minHeight: 30, cursor: 'pointer' }}
            onClick={() => setShowKey(true)}
            title={state?.byok ? 'Personal AI key connected' : 'Connect your AI key'}
          >
            {state?.byok ? `Using your key ••••${state.byok.last4}` : 'AI key not set · Connect'}
          </button>
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              className="rd-btn rd-btn-secondary"
              disabled={!latestId}
              title={latestId ? undefined : 'Available after the first analysis'}
              aria-haspopup="menu"
              aria-expanded={exportOpen}
              onClick={() => setExportOpen(v => !v)}
            >
              Export ▾
            </button>
            {exportOpen && latestId && (
              <div className="sc-menu" role="menu">
                <button type="button" role="menuitem" className="sc-menu-item" onClick={() => { setExportOpen(false); svc.exportAnalysis(projectId, latestId, 'workbook') }}>
                  Comparison workbook (.xlsx)
                </button>
                <button type="button" role="menuitem" className="sc-menu-item" onClick={() => { setExportOpen(false); svc.exportAnalysis(projectId, latestId, 'drafting') }}>
                  Drafting comments (.xlsx)
                </button>
              </div>
            )}
          </div>
          <button
            type="button"
            className="rd-btn rd-btn-primary"
            disabled={analysing || Boolean(missingStage)}
            title={missingStage ? `Complete Stage ${missingStage} first` : undefined}
            onClick={analyse}
          >
            {analysing ? 'Analysing…' : 'Analyse'}
          </button>
        </>
      )}
    />
  )

  if (error && !state) {
    return <div className="pc-page">{header}<p className="pc-error" role="alert">{error}</p></div>
  }

  if (!state) {
    return (
      <div className="pc-page">
        {header}
        <div className="pc-card pc-card-pad" style={{ marginBottom: '1rem' }}><div className="pc-skeleton" style={{ height: 330 }} /></div>
        <div className="pc-card pc-card-pad"><div className="pc-skeleton" style={{ height: 200 }} /></div>
      </div>
    )
  }

  return (
    <div className="pc-page">
      {header}
      {error && <p className="pc-error" role="alert">{error}</p>}

      {/* Comparison overview */}
      <section className="pc-section" aria-label="Comparison overview">
        <div className="pc-card">
          <div className="pc-card-header">
            <h2 className="pc-card-title">Comparison overview</h2>
            <Pill label={analysis ? (analysis.status === 'completed' ? 'Analysed' : analysis.status) : 'Draft'} tone={analysis?.status === 'completed' ? 'success' : 'warning'} />
          </div>
          <div className="sc-overview">
            <ComparisonSld incomers={incomers} feeders={feeders} busLabel={busLabel} onIncomer={onIncomer} onFeeder={onFeeder} />
            <div className="sc-opanel">
              <p className="sc-opanel-title">Last analysis</p>
              <div className="sc-orow">
                {analysis ? (
                  <>
                    <Pill label={state.latest_analysis?.outdated ? 'Outdated' : analysis.status === 'completed' ? 'Completed' : analysis.status === 'failed' ? 'Failed' : 'Running'} tone={state.latest_analysis?.outdated ? 'warning' : analysis.status === 'completed' ? 'success' : analysis.status === 'failed' ? 'danger' : 'info'} />
                    <span className="pc-muted" style={{ fontSize: 'var(--rd-text-caption)' }}>{lastDate ?? '—'}</span>
                  </>
                ) : <Pill label="Not analysed yet" tone="neutral" />}
              </div>
              {analysis?.status === 'failed' && analysis?.error && (
                <p className="pc-note pc-note-danger" style={{ margin: 0 }}>{analysis.error}</p>
              )}
              <div className="sc-otiles">
                <div className="rd-kpi">
                  <div className="rd-kpi-value">{headline?.boards ?? '—'}</div>
                  <div className="rd-kpi-label">Boards on SLD</div>
                  <div className="rd-text-muted" style={{ fontSize: 'var(--rd-text-caption)' }}>
                    +{headline?.transformers ?? 0} TF · {headline?.generators ?? 0} generator{(headline?.generators ?? 0) === 1 ? '' : 's'}
                  </div>
                </div>
                <div className="rd-kpi" style={(headline?.loadConflicts ?? 0) > 0 ? { borderColor: 'var(--rd-danger)' } : undefined}>
                  <div className="rd-kpi-value" style={(headline?.loadConflicts ?? 0) > 0 ? { color: 'var(--rd-danger)' } : undefined}>
                    {headline ? `${headline.loadConflicts ?? 0} of ${headline.loadTotal ?? 0}` : '—'}
                  </div>
                  <div className="rd-kpi-label">Load List conflicts</div>
                </div>
              </div>
              <p className="sc-opanel-title">Before the next analysis</p>
              {nextSteps.map((s, i) => (
                <button key={i} type="button" className="sc-orow" style={{ background: 'none', border: 0, cursor: 'pointer', color: 'var(--rd-accent)', textAlign: 'left', padding: 0 }} onClick={s.onClick}>
                  {s.label}
                </button>
              ))}
              <div className="sc-orow">
                <button
                  type="button"
                  className="rd-btn rd-btn-primary rd-btn-sm"
                  disabled={analysing || Boolean(missingStage)}
                  title={missingStage ? `Complete Stage ${missingStage} first` : undefined}
                  onClick={analyse}
                >
                  Analyse
                </button>
                {missingStage && <span className="sc-orow-locked" style={{ fontSize: 'var(--rd-text-caption)' }}>Locked · complete Stage {missingStage} first</span>}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Inputs + RADAI noticed */}
      <section className="pc-section sc-duo" aria-label="Inputs and observations">
        <InputsCard projectId={projectId} byKind={byKind} state={state} reload={load} setToast={pushToast} actionBus={inputBus} />
        <NoticedCard sldSummary={sldSummary} byKind={byKind} eqRows={eqRows} />
      </section>

      {/* SLD sheets compact table */}
      <section className="pc-section" aria-label="SLD sheets">
        <div className="pc-card pc-table-wrap">
          <div className="pc-card-header">
            <h2 className="pc-card-title">SLD sheets</h2>
            <button type="button" className="rd-btn rd-btn-secondary rd-btn-sm" onClick={() => setShowPrevious(true)}>
              Previous analyses ({analysesCount})
            </button>
          </div>
          {sheetRows.length === 0 ? (
            <EmptyState title="No SLD uploaded yet.">
              Upload the SLD drawing in the Inputs card; its sheets appear here once it has been read.
            </EmptyState>
          ) : (
            <table className="pc-table">
              <thead>
                <tr><th>Sheet</th><th>Drawing no.</th><th>Rev</th><th>Readability</th><th>Boards on sheet</th><th>Open results</th></tr>
              </thead>
              <tbody>
                {sheetRows.map(s => {
                  const boards = boardsOnSheet(s.name)
                  const revDiffers = s.rev && sldSummary?.rev && s.rev !== sldSummary.rev
                  return (
                    <tr key={s.name}>
                      <td className="pc-mono">{s.name}</td>
                      <td>
                        {s.drawingNo ? <span className="pc-mono">{s.drawingNo}</span> : <Pill label="Not read" tone="warning" />}
                      </td>
                      <td className="pc-mono">
                        {sldSummary?.rev ?? s.rev ?? '—'}
                        {revDiffers && <span className="pc-faint"> (sheet {s.name.replace(/\D/g, '') || s.name}: {s.rev})</span>}
                      </td>
                      <td className="pc-muted">{PDF_TYPE_LABEL[sldSummary?.pdf_type] ?? sldSummary?.pdf_type ?? '—'}</td>
                      <td>
                        {boards.length === 0 ? '—' : `${boards.slice(0, 5).join(', ')}${boards.length > 5 ? ` +${boards.length - 5}` : ''}`}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="rd-btn rd-btn-ghost rd-btn-sm"
                          disabled={!latestId}
                          title={latestId ? undefined : 'Available after the first analysis'}
                          onClick={() => sldFileId && navigate(`${BASE}/projects/${projectId}/drawings/${sldFileId}?step=4${latestId ? `&analysis=${latestId}` : ''}`)}
                        >
                          Open results
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Connect key */}
      {showKey && (
        <ConnectKeyModal onClose={() => setShowKey(false)} onSaved={async () => { setShowKey(false); await load() }} />
      )}

      {/* Previous analyses */}
      <Drawer open={showPrevious} onClose={() => setShowPrevious(false)} title="Previous analyses" wide>
        <PreviousAnalyses
          project={{ project_id: projectId, project_name: project?.name }}
          reload={load}
          onView={id => {
            setShowPrevious(false)
            navigate(`${BASE}/projects/${projectId}/drawings/${sldFileId ?? 'latest'}?step=4&analysis=${id}`)
          }}
        />
      </Drawer>

      <Toasts toasts={toasts} />
    </div>
  )
}

// ── Inputs card ─────────────────────────────────────────────────────────

const INPUT_ROWS = [
  { kind: 'sld', code: 'SLD', name: 'SLD drawing', accept: '.pdf', color: 'var(--rd-primary)' },
  { kind: 'equipment', code: 'EL', name: 'Equipment List', accept: '.xlsx,.xls,.pdf', color: 'var(--rd-info)' },
  { kind: 'load', code: 'LL', name: 'Load List', accept: '.xlsx,.xls,.pdf', color: 'var(--rd-success)' },
]

function rowChips(kind, summary) {
  if (!summary) return { facts: [], warnings: [], rewrites: [] }
  const facts = []
  const warnings = []
  if (kind === 'sld') {
    if (summary.drawing_no) facts.push({ text: summary.drawing_no, mono: true })
    if (summary.rev) facts.push({ text: `Rev ${summary.rev}${summary.sheets_agree ? ' · sheets agree' : ' · differs between sheets'}` })
    if (summary.pdf_type) facts.push({ text: PDF_TYPE_LABEL[summary.pdf_type] ?? summary.pdf_type })
    if (summary.scope) warnings.push(`Scope clouds: ${summary.scope}`)
  } else {
    if (summary.document) facts.push({ text: `${summary.document}${summary.rev ? ` · Rev ${summary.rev}` : ''}`, mono: true })
    for (const s of summary.sheets || []) facts.push({ text: `${s.name} · ${s.row_count} rows${s.status ? ` · ${s.status}` : ''}` })
    if (kind === 'load' && summary.board) facts.push({ text: `Board ${summary.board}${summary.section ? ` (${summary.section})` : ''} · ${(summary.loads || []).length} loads` })
    for (const n of summary.notes || []) warnings.push(n)
  }
  return { facts, warnings, rewrites: summary.rewrites || [] }
}

function InputsCard({ projectId, byKind, state, reload, setToast, actionBus }) {
  const [dragActive, setDragActive] = useState(false)
  const [pending, setPending] = useState(null) // { file, kind } or { file, ask: true }
  const [busy, setBusy] = useState(null)
  const [drawerData, setDrawerData] = useState(null) // { title, rewrites?, mapping? }
  const [showKey, setShowKey] = useState(false)
  const inputRefs = { sld: useRef(null), equipment: useRef(null), load: useRef(null) }

  const upload = async (kind, file) => {
    if (!file || busy) return
    setBusy(kind)
    try {
      await svc.uploadFile(projectId, kind, file)
      await reload()
      setToast(`${INPUT_ROWS.find(r => r.kind === kind)?.name ?? 'File'} ${byKind[kind] ? 'replaced' : 'uploaded'}.`, 'success')
    } catch (err) {
      setToast(err?.response?.data?.error || 'The upload failed. Please retry.', 'danger')
    } finally {
      setBusy(null)
    }
  }

  useEffect(() => {
    if (!actionBus) return undefined
    actionBus.current.openPicker = kind => {
      if (kind === 'ai') { setShowKey(true); return }
      if (kind === 'lg') { setToast('Review the legend on the analysis page, step 3.'); return }
      inputRefs[kind]?.current?.click()
    }
    return () => { delete actionBus.current.openPicker }
  }) // eslint-disable-line react-hooks/exhaustive-deps

  const onDrop = files => {
    const file = [...(files || [])][0]
    if (!file) return
    const lower = file.name.toLowerCase()
    if (/\.pdf$/.test(lower)) {
      if (byKind.sld) setPending({ file, kind: 'sld' })
      else upload('sld', file)
    } else if (/\.(xlsx|xls|csv)$/.test(lower)) {
      setPending({ file, ask: true }) // ask: Equipment List or Load List?
    } else {
      setToast('That file type is not one of the inputs (PDF or Excel).', 'warning')
    }
  }

  const legendRecheck = state?.stage_state?.['3'] === 'needs-recheck'
  const legendProvided = Boolean(state?.legend?.source)

  const saveMapping = async (fileId, sheetName, status) => {
    try {
      await svc.updateMapping(projectId, fileId, { sheet_status: { [sheetName]: status } })
      await reload()
      setToast(`Sheet ${sheetName} marked ${status}.`, 'success')
    } catch (err) {
      setToast(err?.response?.data?.error || 'The mapping could not be saved.', 'danger')
    }
  }

  return (
    <div
      className={`pc-card sc-inputs${dragActive ? ' sc-inputs-drag' : ''}`}
      onDragOver={e => { e.preventDefault(); setDragActive(true) }}
      onDragLeave={() => setDragActive(false)}
      onDrop={e => { e.preventDefault(); setDragActive(false); onDrop(e.dataTransfer.files) }}
    >
      <div className="pc-card-header">
        <h2 className="pc-card-title">Inputs</h2>
        <button type="button" className="rd-btn rd-btn-secondary rd-btn-sm" onClick={() => inputRefs.sld.current?.click()}>
          Drop or browse files
        </button>
      </div>

      {pending?.ask && (
        <div className="pc-banner pc-banner-warning" role="alert" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', margin: '0 1rem' }}>
          <p style={{ margin: 0 }}>{pending.file.name} — Equipment List or Load List?</p>
          <span style={{ display: 'inline-flex', gap: '0.375rem' }}>
            <button type="button" className="rd-btn rd-btn-primary rd-btn-sm" onClick={() => { const p = pending; setPending(null); byKind.equipment ? setPending({ file: p.file, kind: 'equipment' }) : upload('equipment', p.file) }}>Equipment List</button>
            <button type="button" className="rd-btn rd-btn-secondary rd-btn-sm" onClick={() => { const p = pending; setPending(null); byKind.load ? setPending({ file: p.file, kind: 'load' }) : upload('load', p.file) }}>Load List</button>
            <button type="button" className="rd-btn rd-btn-ghost rd-btn-sm" onClick={() => setPending(null)}>Cancel</button>
          </span>
        </div>
      )}
      {pending?.kind && (
        <div className="pc-banner pc-banner-warning" role="alert" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', margin: '0 1rem' }}>
          <p style={{ margin: 0 }}>Replace the {INPUT_ROWS.find(r => r.kind === pending.kind)?.name} with {pending.file.name}?</p>
          <span style={{ display: 'inline-flex', gap: '0.375rem' }}>
            <button type="button" className="rd-btn rd-btn-primary rd-btn-sm" onClick={() => { const p = pending; setPending(null); upload(p.kind, p.file) }}>Replace</button>
            <button type="button" className="rd-btn rd-btn-ghost rd-btn-sm" onClick={() => setPending(null)}>Cancel</button>
          </span>
        </div>
      )}

      <div className="pc-card-pad" style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
        {INPUT_ROWS.map(row => {
          const f = byKind[row.kind]
          const { facts, warnings, rewrites } = rowChips(row.kind, f?.summary)
          return (
            <div key={row.kind} className="sc-inrow">
              <span className="sc-intile" style={{ background: row.color }} aria-hidden="true">{row.code}</span>
              <div className="sc-inbody">
                <div className="sc-inhead">
                  <strong>{row.name}</strong>
                  <Pill label={f ? 'Provided' : 'Missing'} tone={f ? 'success' : 'danger'} />
                </div>
                {f && (
                  <div className="sc-inchips">
                    {facts.slice(0, 6).map((c, i) => <span key={i} className={`sc-chip${c.mono ? ' pc-mono' : ''}`}>{c.text}</span>)}
                    {warnings.slice(0, 4).map((c, i) => <span key={`w${i}`} className="sc-chip sc-chip-amber">{c}</span>)}
                    {rewrites.length > 0 && (
                      <button type="button" className="sc-chip sc-chip-link" onClick={() => setDrawerData({ title: `${rewrites.length} tag rewrites`, rewrites })}>
                        {rewrites.length} tag rewrites
                      </button>
                    )}
                    {(f?.summary?.sheets || []).length > 0 && row.kind !== 'sld' && (
                      <button type="button" className="sc-chip sc-chip-link" onClick={() => setDrawerData({ title: `${row.name} — sheet mapping`, mapping: { fileId: f.id ?? f.file_id, sheets: f.summary.sheets } })}>
                        Sheet mapping
                      </button>
                    )}
                  </div>
                )}
              </div>
              <button
                type="button"
                className={`rd-btn rd-btn-sm ${f ? 'rd-btn-secondary' : 'rd-btn-primary'}`}
                disabled={busy === row.kind}
                onClick={() => inputRefs[row.kind].current?.click()}
              >
                {busy === row.kind ? 'Reading…' : f ? 'Replace' : 'Upload'}
              </button>
              <input
                ref={inputRefs[row.kind]}
                type="file"
                accept={row.accept}
                hidden
                onChange={e => {
                  const file = e.target.files?.[0]
                  e.target.value = ''
                  if (file && f) setPending({ file, kind: row.kind })
                  else if (file) upload(row.kind, file)
                }}
                aria-label={`Upload ${row.name}`}
              />
            </div>
          )
        })}

        {/* Electrical legend */}
        <div className="sc-inrow">
          <span className="sc-intile" style={{ background: 'var(--rd-warning)' }} aria-hidden="true">LG</span>
          <div className="sc-inbody">
            <div className="sc-inhead">
              <strong>Electrical legend</strong>
              <Pill label={legendRecheck ? 'Re-check' : legendProvided ? 'Provided' : 'Missing'} tone={legendRecheck ? 'warning' : legendProvided ? 'success' : 'danger'} />
            </div>
            {legendProvided && <div className="sc-inchips"><span className="sc-chip">{state.legend.name || 'Legend active'}</span></div>}
          </div>
          <button type="button" className="rd-btn rd-btn-secondary rd-btn-sm" onClick={() => setToast('Review the legend on the analysis page, step 3.')}>
            Review
          </button>
        </div>

        {/* RADAI AI Engine (BYOK) */}
        <div className="sc-inrow">
          <span className="sc-intile" style={{ background: 'var(--rd-ai, var(--rd-accent))' }} aria-hidden="true">AI</span>
          <div className="sc-inbody">
            <div className="sc-inhead">
              <strong>RADAI AI Engine (BYOK)</strong>
              <Pill label={state?.byok ? 'Provided' : 'Not connected'} tone={state?.byok ? 'ai' : 'warning'} />
            </div>
            {state?.byok && (
              <div className="sc-inchips">
                <span className="sc-chip">Key ••••{state.byok.last4}</span>
                {state.byok.last_tested_at && <span className="sc-chip">Tested {fmtDateTime(state.byok.last_tested_at)}</span>}
              </div>
            )}
          </div>
          <button type="button" className="rd-btn rd-btn-secondary rd-btn-sm" onClick={() => setShowKey(true)}>
            {state?.byok ? 'Replace' : 'Connect'}
          </button>
        </div>
      </div>

      {showKey && <ConnectKeyModal onClose={() => setShowKey(false)} onSaved={async () => { setShowKey(false); await reload() }} />}

      <Drawer open={Boolean(drawerData)} onClose={() => setDrawerData(null)} title={drawerData?.title ?? ''}>
        {drawerData?.rewrites && (
          <div className="pc-card pc-table-wrap">
            <table className="pc-table">
              <thead><tr><th>#</th><th>Rewrite</th></tr></thead>
              <tbody>
                {drawerData.rewrites.map((r, i) => <tr key={i}><td className="pc-mono">{i + 1}</td><td className="pc-mono">{r}</td></tr>)}
              </tbody>
            </table>
          </div>
        )}
        {drawerData?.mapping && (
          <div className="pc-card pc-table-wrap">
            <table className="pc-table">
              <thead><tr><th>Sheet</th><th>Rows</th><th>Mapping</th></tr></thead>
              <tbody>
                {drawerData.mapping.sheets.map(s => (
                  <tr key={s.name}>
                    <td className="pc-mono">{s.name}</td>
                    <td>{s.row_count ?? '—'}</td>
                    <td>
                      <select
                        className="pc-select"
                        style={{ minHeight: 30 }}
                        value={s.status ?? 'new'}
                        onChange={e => saveMapping(drawerData.mapping.fileId, s.name, e.target.value)}
                        aria-label={`Mapping for sheet ${s.name}`}
                      >
                        <option value="new">New</option>
                        <option value="demolition">Demolition</option>
                        <option value="ignore">Ignore</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Drawer>
    </div>
  )
}

// ── RADAI noticed in your files (read-only, from existing summaries) ────

function NoticedCard({ sldSummary, byKind, eqRows }) {
  const items = useMemo(() => {
    const out = []
    for (const s of sldSummary?.sheets || []) {
      if (!s.drawing_no) {
        out.push({ id: `sheet-${s.name}`, kind: 'action', text: `Sheet ${s.name} has no drawing number${s.rev ? ` (read rev ${s.rev})` : ''}` })
      }
    }
    const demoNoTag = (eqRows || []).filter(r => r.listSheet === 'Demolition' && !r.tag)
    if (demoNoTag.length > 0) {
      out.push({
        id: 'demo-no-tag', kind: 'action', text: `${demoNoTag.length} Demolition rows have no tag`,
        rows: demoNoTag,
      })
    }
    const loadSummary = byKind.load?.summary
    if (loadSummary?.board) {
      out.push({ id: 'load-board', kind: 'info', text: `The Load List covers board ${loadSummary.board}${loadSummary.section ? ` (${loadSummary.section})` : ''} — loads on other boards are listed, not compared.` })
    }
    const fromDesc = byKind.equipment?.summary?.tags_from_description ?? byKind.load?.summary?.tags_from_description
    if (fromDesc) {
      out.push({ id: 'tag-from-desc', kind: 'info', text: `${fromDesc} tag${fromDesc === 1 ? '' : 's'} taken from the description cell.` })
    }
    return out
  }, [sldSummary, byKind, eqRows])

  const [showRows, setShowRows] = useState(null)

  return (
    <div className="pc-card sc-noticed">
      <div className="pc-card-header">
        <h2 className="pc-card-title">RADAI noticed in your files</h2>
      </div>
      <div className="pc-card-pad" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {items.length === 0 ? (
          <EmptyState title="Nothing to flag in the uploaded files.">
            Pre-check observations appear here as soon as the files have been read.
          </EmptyState>
        ) : items.map(it => (
          <div key={it.id} className="sc-notice">
            <span className={`sc-dot ${it.kind === 'action' ? 'sc-dot-amber' : 'sc-dot-blue'}`} aria-hidden="true" />
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 'var(--rd-text-table)' }}>{it.text}</p>
              {it.rows && (
                <div style={{ marginTop: '0.25rem' }}>
                  <button type="button" className="rd-btn rd-btn-ghost rd-btn-sm" onClick={() => setShowRows(it.rows)}>Show rows</button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      <Drawer open={Boolean(showRows)} onClose={() => setShowRows(null)} title="Demolition rows without a tag">
        {showRows && (
          <div className="pc-card pc-table-wrap">
            <table className="pc-table">
              <thead><tr><th>Description</th><th>List sheet</th><th>Status</th></tr></thead>
              <tbody>
                {showRows.map((r, i) => (
                  <tr key={i}><td>{r.description ?? '—'}</td><td>{r.listSheet ?? '—'}</td><td className="pc-muted">{r.status ?? '—'}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Drawer>
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
