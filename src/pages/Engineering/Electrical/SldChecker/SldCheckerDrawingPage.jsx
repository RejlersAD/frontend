/**
 * SLD Checker — analysis page (comparison reskin). Five steps with the
 * shared Stepper and deep links ?step=1..5&tab=&analysis=&row=&view=.
 *
 *  1 Upload files        (Stage1Files + SlotSummary)
 *  2 RADAI AI Engine     (Stage2Engine + ConnectKeyModal)
 *  3 Electrical legend   (Stage3Legend)
 *  4 Results             (KPIs · banner · tabs · Table | 2D alignment | 3D
 *                         views sharing filters + the row detail card)
 *  5 Export & history    (exportAnalysis + PreviousAnalyses)
 *
 * Only the staged comparison API is used (sldService — every value comes
 * from getAnalysis). Exports say 'SLD'. Dates use the RADAI format
 * '02 Nov 2026 17:54' (24h).
 */
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import svc from './sldChecker.service'
import { PageHeader, KpiTile, Pill, Stepper, EmptyState } from '../../Process/PidChecker/shared'
import {
  Stage1Files, Stage2Engine, Stage3Legend, ConnectKeyModal,
  EquipmentTable, LoadTable, EqLoadTable, DraftingTable, SimpleTable, PreviousAnalyses,
} from '../SLDComparison'
import buildAlignment, { normalizeTag } from './views/buildAlignment'
import AlignmentView from './views/AlignmentView'
import '../../Process/PidChecker/pidchecker.css'
import './sldchecker.css'

// three.js is heavy — the 3D view loads only when selected.
const ThreeDocs3D = lazy(() => import('./views/ThreeDocs3D'))

const STEPS = ['Upload files', 'RADAI AI Engine', 'Electrical legend', 'Results', 'Export & history']

const TABS = [
  { id: 'equipment', label: 'SLD vs Equipment List' },
  { id: 'load', label: 'SLD vs Load List' },
  { id: 'eqload', label: 'Equipment vs Load List' },
  { id: 'drafting', label: 'Drafting check' },
  { id: 'interfaces', label: 'Interfaces' },
  { id: 'cables', label: 'Cables' },
]

const EQ_STATUS_LABEL = {
  matched: 'Matched', 'not-on-sld': 'Not on SLD', 'sld-only': 'On SLD only',
  'sld-demolition': 'On SLD · demolition', 'cable-only': 'Cable reference only',
  'different-tag': 'Different tag on SLD', 'no-tag-in-list': 'No tag in list',
}
const LOAD_STATUS_LABEL = {
  agrees: 'Agrees', 'board-mismatch': 'Board mismatch', 'rating-mismatch': 'Rating mismatch',
  'tag-conflict': 'Tag conflict', 'not-on-sld': 'Not on SLD',
  'not-in-load-list': 'Not in Load List', 'board-not-covered': 'Board not covered',
}
const EQLOAD_STATUS_LABEL = {
  matched: 'Matched', 'not-in-equipment-list': 'Not in Equipment List',
  'board-covered': 'Board covered', 'board-not-covered': 'Board not covered',
}

const statusLabel = (tab, s) => (
  tab === 'equipment' ? EQ_STATUS_LABEL[s] : tab === 'load' ? LOAD_STATUS_LABEL[s] : tab === 'eqload' ? EQLOAD_STATUS_LABEL[s] : s
) ?? s ?? '—'

const isBadStatus = s => ['board-mismatch', 'rating-mismatch', 'tag-conflict', 'not-in-equipment-list', 'different-tag'].includes(s)

/** RADAI date format: '02 Nov 2026 17:54' (24h). */
export function radaiDate(iso) {
  if (!iso) return null
  try {
    const d = new Date(iso)
    const day = String(d.getDate()).padStart(2, '0')
    const month = d.toLocaleString('en-GB', { month: 'short' })
    const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    return `${day} ${month} ${d.getFullYear()} ${hm}`
  } catch {
    return null
  }
}

const VIEW_PREF = 'sldchk:view'

export default function SldCheckerDrawingPage() {
  const { projectId } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()

  const step = Math.min(5, Math.max(1, Number(searchParams.get('step')) || 1)) - 1
  const setStep = (index, extra = {}) => {
    const next = new URLSearchParams(searchParams)
    next.set('step', String(index + 1))
    for (const [k, v] of Object.entries(extra)) {
      if (v == null) next.delete(k); else next.set(k, v)
    }
    setSearchParams(next, { replace: false })
  }
  const patchParams = extra => {
    const next = new URLSearchParams(searchParams)
    for (const [k, v] of Object.entries(extra)) {
      if (v == null) next.delete(k); else next.set(k, v)
    }
    setSearchParams(next)
  }

  const [project, setProject] = useState(null)
  const [state, setState] = useState(null)
  const [error, setError] = useState(null)
  const [toast, setToast] = useState(null)
  const [analysing, setAnalysing] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [headline, setHeadline] = useState(null) // loaded analysis headline — one source for stepper/KPI/banner

  const showToast = useCallback(text => {
    setToast(text)
    setTimeout(() => setToast(null), 6000)
  }, [])

  const load = useCallback(async () => {
    setError(null)
    try {
      const st = await svc.getState(projectId)
      setState(st)
      let name = st.project_name ?? st.name ?? null
      if (!name) {
        // Fall back to the project list so the header never shows 'Project'
        // or the UUID once loaded.
        try {
          const all = await svc.listProjects()
          const raw = Array.isArray(all) ? all : (all?.projects || all?.results || [])
          name = raw.find(p => String(p.project_id ?? p.id) === String(projectId))?.project_name ?? null
        } catch { /* keep null */ }
      }
      setProject({ project_id: projectId, project_name: name })
    } catch (err) {
      setError(err?.response?.data?.error || 'The project could not be loaded.')
    }
  }, [projectId])

  useEffect(() => { load() }, [load])

  const byKind = useMemo(() => Object.fromEntries((state?.files || []).map(f => [f.kind, f])), [state])
  const hasSld = Boolean(byKind.sld)
  const fileCount = (state?.files || []).length
  const stage1 = fileCount >= 2
  const notNeeded = !hasSld && stage1
  const stage2 = notNeeded || Boolean(state?.byok)
  const stage3 = notNeeded || state?.stage_state?.['3'] === 'complete' || Boolean(state?.legend?.source)
  const missingStage = !stage1 ? 1 : !stage2 ? 2 : !stage3 ? 3 : null

  const analysesCount = state?.analyses_count ?? 0
  const sldSummary = byKind.sld?.summary ?? null
  const drawingNo = sldSummary?.drawing_no ?? null
  const rev = sldSummary?.rev ?? null
  const sheetCount = (sldSummary?.sheets || []).length || sldSummary?.page_count || null

  const analysisParam = searchParams.get('analysis')
  const analysisId = analysisParam ?? state?.latest_analysis?.id ?? null

  const analyse = async () => {
    if (analysing || missingStage) return
    setAnalysing(true)
    try {
      const { analysisId: newId } = await svc.analyse(projectId)
      const poll = async () => {
        try {
          const a = await svc.getAnalysis(projectId, newId)
          if (a.status === 'completed') {
            showToast(`Analysis complete · ${a.headline?.loadConflicts ?? 0} Load List conflicts · ${a.headline?.draftingTotal ?? 0} drafting findings`)
            await load()
            patchParams({ step: '4', analysis: String(newId) })
            return
          }
          if (a.status === 'failed') { showToast(a.error || 'Analysis failed.'); await load(); return }
        } catch { /* keep polling */ }
        setTimeout(poll, 4000)
      }
      poll()
      showToast('Analysis started')
    } catch (err) {
      showToast(err?.response?.data?.error || 'The analysis could not be started.')
    } finally {
      setAnalysing(false)
    }
  }

  // Step status text — conflicts read from the SAME loaded headline as the
  // KPI tiles and the banner (never a second source).
  const conflicts = headline?.loadConflicts ?? null
  const stepStates = useMemo(() => ([
    { state: stage1 ? 'done' : 'todo', statusText: `${fileCount} of 3 files${drawingNo ? ` · ${drawingNo}` : ''}` },
    { state: notNeeded ? 'done' : state?.byok ? 'done' : 'warning', statusText: notNeeded ? 'Not needed — no SLD uploaded' : state?.byok ? `Using your key ••••${state.byok.last4}` : 'Key not connected' },
    { state: notNeeded ? 'done' : state?.stage_state?.['3'] === 'needs-recheck' ? 'warning' : state?.legend?.source ? 'done' : 'todo', statusText: notNeeded ? 'Not needed — no SLD uploaded' : state?.stage_state?.['3'] === 'needs-recheck' ? 'Re-check after SLD replace' : state?.legend?.source ? 'Legend from drawing (sheet 002)' : 'Not active' },
    { state: analysisId ? 'done' : 'todo', statusText: analysisId ? `${radaiDate(state?.latest_analysis?.created_at) ?? ''}${conflicts != null ? ` · ${conflicts} conflicts` : ''}`.trim() : 'No analysis' },
    { state: analysesCount > 0 ? 'done' : 'todo', statusText: `${analysesCount} ${analysesCount === 1 ? 'analysis' : 'analyses'}` },
  ]), [stage1, fileCount, drawingNo, notNeeded, state, analysisId, analysesCount, conflicts])

  const header = (
    <PageHeader
      breadcrumb={[
        { label: 'Engineering' },
        { label: '1.4 Electrical' },
        { label: 'SLD Checker', to: '/engineering/electrical/sld' },
        { label: project?.project_name ?? '…', to: `/engineering/electrical/sld/projects/${projectId}` },
        { label: drawingNo ?? 'Analysis' },
      ]}
      title="SLD Checker"
      pill={(
        <>
          <Pill label={`${drawingNo ?? 'Drawing not read'}${rev ? ` · Rev ${rev}` : ''}`} tone="neutral" />
          <Pill label={analysisId ? `Analysed${sheetCount ? ` · ${sheetCount} sheets` : ''}` : 'Draft'} tone={analysisId ? 'success' : 'warning'} />
        </>
      )}
      subtitle={project?.project_name ? `${project.project_name} · Compare the single line diagram with the Equipment List and Load List before issue.` : null}
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
              disabled={!analysisId}
              title={analysisId ? undefined : 'Available after the first analysis'}
              aria-haspopup="menu"
              aria-expanded={exportOpen}
              onClick={() => setExportOpen(v => !v)}
            >
              Export ▾
            </button>
            {exportOpen && analysisId && (
              <div className="sc-menu" role="menu">
                <button type="button" role="menuitem" className="sc-menu-item" onClick={() => { setExportOpen(false); svc.exportAnalysis(projectId, analysisId, 'workbook') }}>
                  SLD comparison workbook (.xlsx)
                </button>
                <button type="button" role="menuitem" className="sc-menu-item" onClick={() => { setExportOpen(false); svc.exportAnalysis(projectId, analysisId, 'drafting') }}>
                  SLD drafting comments (.xlsx)
                </button>
              </div>
            )}
          </div>
          <button
            type="button"
            className="rd-btn rd-btn-primary sc-analyse"
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
        <div className="pc-card pc-card-pad" style={{ marginBottom: '1rem' }}><div className="pc-skeleton" style={{ height: 72 }} /></div>
        <div className="pc-card pc-card-pad"><div className="pc-skeleton" style={{ height: 320 }} /></div>
      </div>
    )
  }

  return (
    <div className="pc-page">
      {header}

      <Stepper
        steps={STEPS.map((label, i) => ({ label, state: stepStates[i].state, statusText: stepStates[i].statusText }))}
        current={step}
        onSelect={i => {
          if (i === 3 && !analysisId) return // step 4 disabled until an analysis exists
          setStep(i)
        }}
      />

      {toast && (
        <p className="pc-note pc-note-warning" role="status" style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center' }}>
          <span>{toast}</span>
          <button type="button" className="pc-icon-btn" style={{ minWidth: 30, minHeight: 30 }} aria-label="Dismiss message" onClick={() => setToast(null)}>×</button>
        </p>
      )}

      {step === 0 && (
        <section className="pc-section" aria-label="Upload files">
          <Stage1Files project={project} byKind={byKind} reload={load} setToast={showToast} locked={false} />
        </section>
      )}
      {step === 1 && (
        <section className="pc-section" aria-label="RADAI AI Engine">
          <Stage2Engine state={state} reload={load} locked={!stage1 && hasSld} notNeeded={notNeeded} />
        </section>
      )}
      {step === 2 && (
        <section className="pc-section" aria-label="Electrical legend">
          <Stage3Legend project={project} state={state} reload={load} locked={!stage2} notNeeded={notNeeded} />
        </section>
      )}
      {step === 3 && analysisId && (
        <StepResults
          projectId={projectId}
          analysisId={analysisId}
          byKind={byKind}
          searchParams={searchParams}
          patchParams={patchParams}
          onHeadline={setHeadline}
        />
      )}
      {step === 4 && (
        <section className="pc-section" aria-label="Export and history">
          <div className="pc-card pc-card-pad" style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            <h2 className="pc-card-title">Export</h2>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button type="button" className="rd-btn rd-btn-secondary" disabled={!analysisId} title={analysisId ? undefined : 'Available after the first analysis'} onClick={() => svc.exportAnalysis(projectId, analysisId, 'workbook')}>
                SLD comparison workbook (.xlsx)
              </button>
              <button type="button" className="rd-btn rd-btn-secondary" disabled={!analysisId} title={analysisId ? undefined : 'Available after the first analysis'} onClick={() => svc.exportAnalysis(projectId, analysisId, 'drafting')}>
                SLD drafting comments (.xlsx)
              </button>
            </div>
          </div>
          <div style={{ marginTop: '0.875rem' }}>
            <PreviousAnalyses
              project={project}
              reload={load}
              onView={id => setStep(3, { analysis: String(id) })}
            />
          </div>
        </section>
      )}

      {showKey && <ConnectKeyModal onClose={() => setShowKey(false)} onSaved={async () => { setShowKey(false); await load() }} />}
    </div>
  )
}

// ── Step 4: Results (Table | 2D alignment | 3D, shared filters) ─────────

function StepResults({ projectId, analysisId, byKind, searchParams, patchParams, onHeadline }) {
  const [data, setData] = useState(null)
  const [rowsByTab, setRowsByTab] = useState(null) // { tab: rows[] }
  const [metaByTab, setMetaByTab] = useState({})
  const [error, setError] = useState(null)
  const [statusFilter, setStatusFilter] = useState('All')
  const [boardFilter, setBoardFilter] = useState(null)
  const [q, setQ] = useState('')
  const listRef = useRef(null)

  const tab = TABS.some(t => t.id === searchParams.get('tab')) ? searchParams.get('tab') : 'equipment'
  const rowParam = searchParams.get('row')
  const view = ['table', 'align', '3d'].includes(searchParams.get('view')) ? searchParams.get('view') : null
  const viewMode = view ?? (() => { try { return localStorage.getItem(VIEW_PREF) || 'table' } catch { return 'table' } })()
  const setViewMode = v => {
    try { localStorage.setItem(VIEW_PREF, v) } catch { /* blocked */ }
    patchParams({ view: v === 'table' ? null : v })
  }

  useEffect(() => {
    let alive = true
    setData(null)
    setRowsByTab(null)
    ;(async () => {
      try {
        const d = await svc.getAnalysis(projectId, analysisId)
        if (!alive) return
        setData(d)
        onHeadline?.(d?.headline ?? null)
        if (d.status === 'completed') {
          // All six tabs feed the tab pills, the alignment and the 3D view.
          const entries = await Promise.all(TABS.map(async t => {
            try {
              const td = await svc.getAnalysis(projectId, analysisId, t.id)
              return [t.id, { rows: td.rows || [], meta: td.meta || {} }]
            } catch {
              return [t.id, { rows: [], meta: {} }]
            }
          }))
          if (!alive) return
          setRowsByTab(Object.fromEntries(entries.map(([k, v]) => [k, v.rows])))
          setMetaByTab(Object.fromEntries(entries.map(([k, v]) => [k, v.meta])))
        }
      } catch {
        if (alive) setError('The analysis could not be loaded.')
      }
    })()
    return () => { alive = false }
  }, [projectId, analysisId]) // eslint-disable-line react-hooks/exhaustive-deps

  const h = data?.headline ?? null
  const b = data?.banner ?? {}
  const bannerChips = [
    ['boardMismatch', 'Board mismatch'], ['tagConflict', 'Tag conflict'],
    ['ratingMismatch', 'Rating mismatch'], ['wrongAreaCode', 'Wrong area code'],
  ].filter(([k]) => (b[k] ?? 0) > 0)

  // Meta lines: from the tab meta, filled from the file summaries when the
  // analysis meta has gaps (never invented).
  const mergedMeta = useMemo(() => {
    const out = { ...metaByTab }
    const eqSummary = byKind.equipment?.summary
    if (eqSummary && !out.equipment?.summary) {
      const sheets = {}
      for (const s of eqSummary.sheets || []) sheets[s.name] = { row_count: s.row_count, tag_count: s.tag_count }
      out.equipment = { ...(out.equipment || {}), summary: { ...sheets, rewrites: eqSummary.rewrites } }
    }
    const loadSummary = byKind.load?.summary
    out.load = { ...(out.load || {}), board: out.load?.board ?? loadSummary?.board, section: out.load?.section ?? loadSummary?.section, notInListCount: out.load?.notInListCount ?? ((loadSummary?.loads || []).length || undefined) }
    return out
  }, [metaByTab, byKind])

  const rows = rowsByTab?.[tab] ?? null

  const filtered = useMemo(() => {
    let out = rows || []
    if (statusFilter !== 'All') out = out.filter(r => r.status === statusFilter)
    if (boardFilter) out = out.filter(r => (r.boardSld ?? r.board) === boardFilter)
    if (q.trim()) {
      const needle = q.trim().toLowerCase()
      out = out.filter(r => String(r.tag ?? r.check ?? '').toLowerCase().includes(needle))
    }
    return out
  }, [rows, statusFilter, boardFilter, q])

  const statusChips = useMemo(() => {
    const counts = {}
    for (const r of rows || []) {
      const s = r.status ?? r.severity ?? '—'
      counts[s] = (counts[s] ?? 0) + 1
    }
    return Object.entries(counts)
  }, [rows])

  const selected = useMemo(() => {
    if (rowParam != null) {
      const idx = Number(rowParam)
      if (Number.isInteger(idx) && filtered[idx]) return { row: filtered[idx], index: idx }
    }
    return filtered.length > 0 ? { row: filtered[0], index: 0 } : null
  }, [filtered, rowParam])

  const selectedTag = selected ? normalizeTag(selected.row.tag ?? selected.row.check) : null

  const selectRow = idx => {
    if (idx == null || idx < 0 || idx >= filtered.length) return
    patchParams({ row: String(idx) })
  }

  // Cross-view selection: a tag picked in the alignment or 3D view selects
  // the same row in the table (source tab + index from the alignment).
  const selectAlignRow = useCallback(alignRow => {
    const src = alignRow.source?.[0]
    if (!src) return
    const tabRows = rowsByTab?.[src.tab] ?? []
    const idx = tabRows.findIndex(r => normalizeTag(r.tag ?? r.check) === alignRow.tag)
    setStatusFilter('All')
    setQ('')
    setBoardFilter(null)
    patchParams({ tab: src.tab === 'equipment' ? null : src.tab, row: idx >= 0 ? String(idx) : null })
  }, [rowsByTab, patchParams])

  const alignment = useMemo(() => (rowsByTab ? buildAlignment({
    equipment: rowsByTab.equipment || [],
    load: rowsByTab.load || [],
    eqload: rowsByTab.eqload || [],
    interfaces: rowsByTab.interfaces || [],
    cables: rowsByTab.cables || [],
    loadMeta: mergedMeta.load || {},
  }) : null), [rowsByTab, mergedMeta])

  const docs = useMemo(() => ({
    sld: [byKind.sld?.summary?.drawing_no, byKind.sld?.summary?.rev && `Rev ${byKind.sld.summary.rev}`].filter(Boolean).join(' · ') || null,
    el: [byKind.equipment?.summary?.document, byKind.equipment?.summary?.rev && `Rev ${byKind.equipment.summary.rev}`].filter(Boolean).join(' · ') || null,
    ll: [byKind.load?.summary?.document, byKind.load?.summary?.rev && `Rev ${byKind.load.summary.rev}`].filter(Boolean).join(' · ') || null,
  }), [byKind])

  const onKeyDown = e => {
    if (!selected || viewMode !== 'table') return
    if (e.key === 'ArrowDown') { e.preventDefault(); selectRow(selected.index + 1) }
    if (e.key === 'ArrowUp') { e.preventDefault(); selectRow(selected.index - 1) }
  }

  if (error) return <p className="pc-error" role="alert">{error}</p>
  if (!data || !rowsByTab) {
    return (
      <section className="pc-section" aria-label="Results">
        <div className="pc-card pc-card-pad"><div className="pc-skeleton" style={{ height: 320 }} /></div>
      </section>
    )
  }
  if (data.status !== 'completed') {
    return (
      <section className="pc-section" aria-label="Results">
        <div className="pc-card">
          <EmptyState title={`Analysis ${data.status}…`}>The results appear here when the analysis completes.</EmptyState>
        </div>
      </section>
    )
  }

  // Row-count pill per tab: red for Load List conflicts > 0, amber for
  // drafting > 0, neutral otherwise.
  const tabPill = t => {
    const count = (rowsByTab[t.id] || []).length
    if (t.id === 'load') {
      const c = h?.loadConflicts ?? 0
      return { text: c > 0 ? `${c}/${h?.loadTotal ?? count}` : String(count), tone: c > 0 ? 'var(--rd-danger)' : null }
    }
    if (t.id === 'drafting') {
      const c = h?.draftingTotal ?? count
      return { text: String(c), tone: c > 0 ? 'var(--rd-warning)' : null }
    }
    return { text: String(count), tone: null }
  }

  return (
    <section className="pc-section" aria-label="Results">
      {/* KPI tiles from the headline — click opens the matching tab */}
      <div className="pc-kpi-grid-7" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }} aria-label="Analysis summary">
        <KpiTile label="Boards on SLD" value={h?.boards ?? '—'} meta={`+ ${h?.transformers ?? 0} transformers · ${h?.generators ?? 0} generator${(h?.generators ?? 0) === 1 ? '' : 's'}`} />
        <KpiTile label="Matched with Equipment List" value={h ? `${h.matched ?? 0} of ${h.matchedTotal ?? 0}` : '—'} meta={`${h?.notOnSldByType ?? 0} not on SLD by type`} onClick={() => patchParams({ tab: 'equipment', row: null })} />
        <KpiTile label="Load List conflicts" value={h ? `${h.loadConflicts ?? 0} of ${h.loadTotal ?? 0}` : '—'} danger={(h?.loadConflicts ?? 0) > 0} meta="Board, rating or tag" onClick={() => patchParams({ tab: 'load', row: null })} />
        <KpiTile label="Drafting issues" value={h?.draftingTotal ?? '—'} meta={`${h?.draftingHigh ?? 0} high · ${h?.draftingMedium ?? 0} medium`} onClick={() => patchParams({ tab: 'drafting', row: null })} />
        <KpiTile label="Interfaces" value={h?.interfaces ?? '—'} meta="other areas · not compared" onClick={() => patchParams({ tab: 'interfaces', row: null })} />
      </div>

      {/* Review-before-issue banner — same headline value as the KPI */}
      {bannerChips.length > 0 && (
        <div className="pc-banner pc-banner-warning" role="alert" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
          <span style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <strong>Review before issue</strong>
            {bannerChips.map(([k, label]) => (
              <Pill key={k} label={`${label} | ${b[k]}`} tone={k === 'wrongAreaCode' ? 'warning' : 'danger'} />
            ))}
          </span>
          <button type="button" className="rd-btn rd-btn-primary rd-btn-sm" onClick={() => patchParams({ tab: 'load', row: null })}>
            Open Load List conflicts →
          </button>
        </div>
      )}

      <div className="pc-split" style={{ gridTemplateColumns: 'minmax(0, 1fr) 380px' }}>
        {/* left: view switch + views */}
        <div className="pc-card" style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', padding: '0.625rem 1rem 0' }}>
            <div className="pc-seg" role="group" aria-label="Results view">
              {[['table', 'Table'], ['align', '2D alignment'], ['3d', '3D']].map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`pc-seg-btn${viewMode === id ? ' pc-seg-btn-active' : ''}`}
                  aria-pressed={viewMode === id}
                  onClick={() => setViewMode(id)}
                >
                  {label}
                </button>
              ))}
            </div>
            {/* status chips + search are shared by all three views */}
            <div className="pc-chips" role="group" aria-label="Filter by status" style={{ marginLeft: 'auto' }}>
              <button type="button" className={`pc-chip${statusFilter === 'All' ? ' pc-chip-active' : ''}`} style={{ minHeight: 30 }} aria-pressed={statusFilter === 'All'} onClick={() => { setStatusFilter('All'); patchParams({ row: null }) }}>
                All <span className="pc-chip-count">{(rows || []).length}</span>
              </button>
              {statusChips.map(([s, n]) => (
                <button key={s} type="button" className={`pc-chip${statusFilter === s ? ' pc-chip-active' : ''}`} style={{ minHeight: 30 }} aria-pressed={statusFilter === s} onClick={() => { setStatusFilter(s); patchParams({ row: null }) }}>
                  {statusLabel(tab, s)} <span className="pc-chip-count">{n}</span>
                </button>
              ))}
              {boardFilter && (
                <button type="button" className="pc-chip pc-chip-active" style={{ minHeight: 30 }} onClick={() => setBoardFilter(null)} aria-label={`Clear board filter ${boardFilter}`}>
                  Board {boardFilter} ×
                </button>
              )}
              <input
                type="search"
                className="pc-input"
                style={{ minHeight: 30, minWidth: 150 }}
                placeholder="Search tag"
                aria-label="Search tag"
                value={q}
                onChange={e => { setQ(e.target.value); patchParams({ row: null }) }}
              />
            </div>
          </div>

          {viewMode !== 'table' && (
            <div className="pc-tabs" role="tablist" style={{ padding: '0 1rem' }}>
              {TABS.map(t => {
                const p = tabPill(t)
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={t.id === tab}
                    className={`pc-tab${t.id === tab ? ' pc-tab-active' : ''}`}
                    onClick={() => patchParams({ tab: t.id === 'equipment' ? null : t.id, row: null })}
                  >
                    {t.label}
                    <span className="pc-tab-count" style={p.tone ? { color: p.tone } : undefined}>{p.text}</span>
                  </button>
                )
              })}
            </div>
          )}

          {viewMode === 'table' && (
            <>
              <div className="pc-tabs" role="tablist" style={{ padding: '0 1rem' }}>
                {TABS.map(t => {
                  const p = tabPill(t)
                  return (
                    <button
                      key={t.id}
                      type="button"
                      role="tab"
                      aria-selected={t.id === tab}
                      className={`pc-tab${t.id === tab ? ' pc-tab-active' : ''}`}
                      onClick={() => patchParams({ tab: t.id === 'equipment' ? null : t.id, row: null })}
                    >
                      {t.label}
                      <span className="pc-tab-count" style={p.tone ? { color: p.tone } : undefined}>{p.text}</span>
                    </button>
                  )
                })}
              </div>
              <div
                className="pc-table-wrap sc-results-table"
                style={{ padding: '0.5rem 1rem 1rem' }}
                tabIndex={0}
                ref={listRef}
                onKeyDown={onKeyDown}
                aria-label="Results table — arrow keys move the selection"
              >
                {rows === null ? (
                  <div className="pc-skeleton" style={{ height: 160 }} />
                ) : filtered.length === 0 ? (
                  <EmptyState title={(rows || []).length === 0 ? 'No rows in this tab.' : 'No rows match these filters.'}>
                    {(rows || []).length === 0 ? 'This comparison produced no rows.' : 'Change the status filter or the search text.'}
                  </EmptyState>
                ) : (
                  <SelectableTable tab={tab} rows={filtered} meta={mergedMeta[tab] ?? {}} selectedIndex={selected?.index ?? null} onSelect={selectRow} />
                )}
                {tab === 'load' && rows !== null && (mergedMeta.load?.board || mergedMeta.load?.notInListCount != null) && (
                  <p className="pc-faint" style={{ fontSize: 'var(--rd-text-caption)', margin: '0.5rem 0 0' }}>
                    Board {mergedMeta.load?.board ?? '—'}{mergedMeta.load?.section ? ` (${mergedMeta.load.section})` : ''}
                    {mergedMeta.load?.notInListCount != null && ` · ${mergedMeta.load.notInListCount} other loads on the SLD are Not in Load List`}
                    {mergedMeta.load?.notCoveredCount != null && ` · ${mergedMeta.load.notCoveredCount} loads on other boards are Board not covered and are not counted as extra`}
                  </p>
                )}
              </div>
            </>
          )}

          {viewMode === 'align' && alignment && (
            <AlignmentView
              alignment={alignment}
              docs={docs}
              search={q}
              statusFilter={statusFilter}
              selectedTag={selectedTag}
              onSelect={selectAlignRow}
            />
          )}

          {viewMode === '3d' && alignment && (
            <div style={{ padding: '0.5rem 1rem 1rem' }}>
              <Suspense fallback={<div className="pc-skeleton" style={{ height: 480 }} />}>
                <ThreeDocs3D
                  alignment={alignment}
                  docs={docs}
                  analysisDate={radaiDate(data?.created_at ?? data?.updated_at)}
                  statusFilter={statusFilter}
                  selectedTag={selectedTag}
                  onSelect={tag => {
                    const hit = alignment.rows.find(r => r.tag === tag)
                    if (hit) selectAlignRow(hit)
                  }}
                />
              </Suspense>
            </div>
          )}
        </div>

        {/* right: row detail card — shared by all three views */}
        <div style={{ minWidth: 0 }}>
          {selected ? (
            <RowDetail
              tab={tab}
              row={selected.row}
              index={selected.index}
              total={filtered.length}
              rows={filtered}
              onNext={() => selectRow(selected.index + 1)}
              onFilterBoard={board => { setBoardFilter(board); patchParams({ row: null }) }}
            />
          ) : (
            <div className="pc-card">
              <EmptyState title="Select a row to see the detail." />
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

/** Clickable-row wrapper around the existing tab tables: selection by
 *  index via event delegation so the tables stay unmodified. */
function SelectableTable({ tab, rows, meta, selectedIndex, onSelect }) {
  const wrapRef = useRef(null)

  useEffect(() => {
    const trs = wrapRef.current?.querySelectorAll('tbody tr') ?? []
    trs.forEach((tr, i) => {
      if (i === selectedIndex) tr.style.background = 'var(--rd-primary-soft)'
      else tr.style.background = ''
    })
  }, [rows, selectedIndex])

  const onClick = e => {
    const tr = e.target.closest('tbody tr')
    if (!tr) return
    const idx = [...tr.parentNode.children].indexOf(tr)
    onSelect(idx)
  }

  return (
    <div ref={wrapRef} onClick={onClick} role="presentation">
      {tab === 'equipment' && <EquipmentTable rows={rows} meta={meta} hideFilter hideEmptyColumns />}
      {tab === 'load' && <LoadTable rows={rows} meta={meta} />}
      {tab === 'eqload' && <EqLoadTable rows={rows} meta={meta} />}
      {tab === 'drafting' && <DraftingTable rows={rows} meta={meta} />}
      {tab === 'interfaces' && <SimpleTable rows={rows} cols={['Tag', 'Where on SLD', 'Meaning']} keys={['tag', 'where', 'meaning']} subtitle="Tags of other areas or drawings. Listed for reference — never counted as extra." />}
      {tab === 'cables' && <SimpleTable rows={rows} cols={['Cable tag', 'Size', 'Sheet']} keys={['tag', 'size', 'sheet']} subtitle="Matched before equipment rules, so a cable tag can never become a panel." />}
    </div>
  )
}

// ── row detail card: rows = fields, columns = List vs SLD ───────────────

function RowDetail({ tab, row, index, total, rows, onNext, onFilterBoard }) {
  const [copied, setCopied] = useState(false)
  const status = row.status ?? row.severity ?? null
  const issue = row.issue ?? row.reason ?? row.result ?? null
  const board = row.boardSld ?? row.board ?? null

  // Field rows of the row's own fields; differing cell red; empty = '—'.
  const fields = useMemo(() => {
    if (tab === 'load') {
      return [
        { label: 'Tag', list: row.tag, sld: row.tag },
        { label: 'Fed from', list: row.boardList, sld: row.boardSld, diff: Boolean(row.boardSld && row.boardList && row.boardSld !== row.boardList) },
        { label: 'Rated kW', list: row.kwList, sld: row.kwSld, diff: row.kwSld != null && row.kwList != null && String(row.kwSld) !== String(row.kwList) },
        { label: 'Description', list: row.description, sld: row.descriptionSld ?? row.description },
      ]
    }
    if (tab === 'equipment') {
      return [
        { label: 'Description', list: row.description, sld: row.descriptionSld ?? row.description },
        { label: 'List sheet', list: row.listSheet, sld: null },
        { label: 'On SLD', list: null, sld: row.onSld },
        { label: 'Category', list: row.category, sld: row.category },
      ]
    }
    if (tab === 'eqload') {
      return [
        { label: 'Tag', list: row.tag, sld: row.tag },
        { label: 'Board', list: row.board, sld: row.board },
        { label: 'Rated kW', list: row.ratedKw, sld: row.ratedKw },
        { label: 'Description', list: row.description, sld: row.equipmentDescription, diff: Boolean(row.equipmentDescription && row.description && row.equipmentDescription !== row.description) },
      ]
    }
    if (tab === 'drafting') {
      return [
        { label: 'Check', list: row.check, sld: row.check },
        { label: 'Location', list: null, sld: row.location },
      ]
    }
    return [
      { label: 'Tag', list: row.tag, sld: row.tag },
      { label: tab === 'interfaces' ? 'Where on SLD' : 'Sheet', list: null, sld: row.where ?? row.sheet },
      ...(tab === 'interfaces' ? [{ label: 'Meaning', list: null, sld: row.meaning }] : [{ label: 'Size', list: null, sld: row.size }]),
    ]
  }, [tab, row])

  const sameBoard = useMemo(() => {
    if (!board) return []
    return rows.filter(r => (r.boardSld ?? r.board) === board && r !== row).map(r => r.tag).filter(Boolean).slice(0, 12)
  }, [rows, row, board])

  const copyComment = async () => {
    const text = `${row.tag ?? row.check ?? 'Row'} · ${statusLabel(tab, status)} · ${issue ?? '—'}`
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch { /* clipboard blocked */ }
  }

  const listHead = tab === 'equipment' ? 'Equipment List' : tab === 'load' || tab === 'eqload' ? 'Load List' : 'List'

  return (
    <article className="pc-finding-card">
      <div className="pc-finding-head">
        <h3 className="pc-finding-title pc-mono" style={{ fontSize: '1rem' }}>{row.tag ?? row.check ?? 'Row'}</h3>
        {status && <Pill label={statusLabel(tab, status)} tone={isBadStatus(status) || status === 'high' ? 'danger' : undefined} />}
      </div>
      <p className="pc-faint" style={{ margin: 0, fontSize: 'var(--rd-text-caption)' }}>
        row {index + 1} of {total}
      </p>

      <table className="sc-cmp" aria-label="List versus SLD comparison">
        <thead>
          <tr><th /> <th>{listHead}</th><th>SLD</th></tr>
        </thead>
        <tbody>
          {fields.map(f => (
            <tr key={f.label}>
              <th>{f.label}</th>
              <td className="pc-mono">{f.list ?? '—'}</td>
              <td className={`pc-mono${f.diff ? ' sc-detail-diff' : ''}`}>{f.sld ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {issue && (
        <dl className="pc-kv">
          <dt>{tab === 'equipment' ? 'Reason' : tab === 'drafting' ? 'Result' : 'Issue'}</dt>
          <dd>{issue}</dd>
        </dl>
      )}

      <div className="pc-finding-actions">
        <button type="button" className="rd-btn rd-btn-secondary rd-btn-sm" onClick={copyComment}>
          {copied ? 'Copied' : 'Copy as comment'}
        </button>
        {board && (
          <button type="button" className="rd-btn rd-btn-ghost rd-btn-sm" onClick={() => onFilterBoard(board)}>
            Filter this board
          </button>
        )}
        {index + 1 < total && (
          <button type="button" className="rd-btn rd-btn-ghost rd-btn-sm" onClick={onNext}>Next ›</button>
        )}
      </div>

      {sameBoard.length > 0 && (
        <div>
          <p className="pc-label" style={{ margin: '0 0 0.25rem' }}>Same board (SLD):</p>
          <div className="sc-board-chips">
            {sameBoard.map(t => <span key={t} className="sc-chip pc-mono">{t}</span>)}
          </div>
        </div>
      )}
    </article>
  )
}
