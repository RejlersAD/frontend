import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { RefreshCw, BookOpen, FileText, Maximize2, Eraser } from 'lucide-react'

import {
  extractLineTags, listExtractions, getExtraction, deleteExtraction,
  listLegends, listLineLists, listEquipmentLists, listInstrumentIndexes,
  MODE_OCR, MODE_VISION, VISION_PROVIDERS,
} from '../../../services/pidCheckerV2API'
import LegendSheetsModal from './components/LegendSheetsModal'
import InputsPanel from './components/InputsPanel'
import ResultsTabs from './components/ResultsTabs'

// ═════════════════════════════════════════════════════════════════════
// P&ID Checker V2 — Line-List Extractor
// All strings, colours, and thresholds are soft-coded here.
// ═════════════════════════════════════════════════════════════════════
const PAGE_TITLE = 'P&ID Checker V2'
const PAGE_SUBTITLE = 'Extract composite pipeline line tags from any P&ID or Line-List PDF'
const DOCS_ROUTE = '/engineering/process/pid-checker-v2/docs'
const LEGENDS_CANVAS_ROUTE = '/engineering/process/pid-checker-v2/legends'
const DOCS_BUTTON_LABEL = 'Docs & Workflow'
const DOCS_BUTTON_TITLE = 'Open documentation and recommended workflow'
const CLEAR_BUTTON_LABEL = 'Clear All'
const CLEAR_BUTTON_TITLE = 'Clear the uploaded file and current results so you can start over'
const CLEAR_CONFIRM_MSG = 'Clear the uploaded file and current results? This does not affect saved history or legends.'
const ACCEPTED_EXTENSIONS = '.pdf'
const MAX_UPLOAD_MB = 25

const THEME_PRIMARY = '#7c3aed'
const THEME_ACCENT = '#ec4899'
const THEME_TEXT = '#0f172a'
const THEME_MUTED = '#64748b'
const THEME_BORDER = '#e2e8f0'
const THEME_BG_SOFT = '#f8fafc'
const THEME_GRADIENT = `linear-gradient(135deg, ${THEME_PRIMARY} 0%, ${THEME_ACCENT} 100%)`

// Two-column workspace geometry (soft-coded)
const PAGE_MAX_WIDTH = 1440
const LEFT_COL_WIDTH = 460
const LAYOUT_BREAKPOINT_PX = 960
// Offset for the app's fixed top navigation so the page header doesn't overlap it
const TOP_NAV_OFFSET_PX = 64

const CSV_HEADER = ['tag', 'size', 'service', 'spec', 'serial', 'service_group']

// BYOK — sessionStorage keys (cleared when the browser tab closes)
const SS_KEY_PROVIDER = 'radai_pidv2_byok_provider'
const SS_KEY_APIKEY   = 'radai_pidv2_byok_apikey'
const SS_KEY_REMEMBER = 'radai_pidv2_byok_remember'


function toCsv(tags) {
  const rows = [CSV_HEADER.join(',')]
  for (const t of tags) {
    rows.push(CSV_HEADER.map((k) => `"${String(t[k] ?? '').replace(/"/g, '""')}"`).join(','))
  }
  return rows.join('\n')
}

function downloadBlob(content, filename, type) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}


export default function PIDCheckerV2() {
  const navigate = useNavigate()
  const fileInputRef = useRef(null)
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [uploadPct, setUploadPct] = useState(0)
  const [result, setResult] = useState(null) // { filename, tags, summary }
  const [error, setError] = useState(null)
  const [forceOcr, setForceOcr] = useState(false)

  // ── Mode + BYOK (Bring Your Own Key) ──────────────────────────────
  const [mode, setMode] = useState(MODE_OCR)
  const [visionProvider, setVisionProvider] = useState(
    () => sessionStorage.getItem(SS_KEY_PROVIDER) || VISION_PROVIDERS[0].id
  )
  const [apiKey, setApiKey] = useState(() => sessionStorage.getItem(SS_KEY_APIKEY) || '')
  const [showKey, setShowKey] = useState(false)
  const [rememberKey, setRememberKey] = useState(
    () => sessionStorage.getItem(SS_KEY_REMEMBER) === '1'
  )

  // ── History (auto-saved extractions) ──────────────────────────────
  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)

  // ── Legend Sheets ─────────────────────────────────────────────────
  const LEGEND_SECTION = 'line_list'
  const [legendModalOpen, setLegendModalOpen] = useState(false)
  const [activeLegend, setActiveLegend] = useState(null)
  const [effectiveLegend, setEffectiveLegend] = useState(null) // active OR most-recent

  // ── Master Line List (Excel) ──────────────────────────────────────
  const [activeLineList, setActiveLineList] = useState(null)

  const refreshLineList = useCallback(async () => {
    try {
      const rows = await listLineLists()
      const list = Array.isArray(rows) ? rows : (rows?.results || [])
      setActiveLineList(list.find(r => r.is_active) || null)
    } catch (err) {
      console.warn('[PIDCheckerV2] line list fetch failed', err)
    }
  }, [])
  // ── Master Equipment List (Excel) ─────────────────────────
  const [activeEquipmentList, setActiveEquipmentList] = useState(null)

  const refreshEquipmentList = useCallback(async () => {
    try {
      const rows = await listEquipmentLists()
      const list = Array.isArray(rows) ? rows : (rows?.results || [])
      setActiveEquipmentList(list.find(r => r.is_active) || null)
    } catch (err) {
      console.warn('[PIDCheckerV2] equipment list fetch failed', err)
    }
  }, [])
  // ── Master Instrument Index (Excel) ─────────────────
  const [activeInstrumentIndex, setActiveInstrumentIndex] = useState(null)

  const refreshInstrumentIndex = useCallback(async () => {
    try {
      const rows = await listInstrumentIndexes()
      const list = Array.isArray(rows) ? rows : (rows?.results || [])
      setActiveInstrumentIndex(list.find(r => r.is_active) || null)
    } catch (err) {
      console.warn('[PIDCheckerV2] instrument index fetch failed', err)
    }
  }, [])
  const refreshActiveLegend = useCallback(async () => {
    try {
      const rows = await listLegends(LEGEND_SECTION)
      const list = rows || []
      const active = list.find(l => l.is_active) || null
      setActiveLegend(active)
      // "Effective" = what the backend will actually compare against.
      // Falls back to the most-recently-updated legend when nothing is active.
      const latest = list.slice().sort((a, b) =>
        String(b.updated_at || '').localeCompare(String(a.updated_at || ''))
      )[0] || null
      setEffectiveLegend(active || latest)
    } catch {
      // silent — auxiliary
    }
  }, [])

  useEffect(() => { refreshActiveLegend() }, [refreshActiveLegend])
  useEffect(() => { refreshLineList() }, [refreshLineList])
  useEffect(() => { refreshEquipmentList() }, [refreshEquipmentList])
  useEffect(() => { refreshInstrumentIndex() }, [refreshInstrumentIndex])

  const refreshHistory = useCallback(async () => {
    setHistoryLoading(true)
    try {
      const rows = await listExtractions()
      setHistory(Array.isArray(rows) ? rows : (rows?.results || []))
    } catch (err) {
      // silent — history is auxiliary
      console.warn('[PIDCheckerV2] history fetch failed', err)
    } finally {
      setHistoryLoading(false)
    }
  }, [])

  useEffect(() => { refreshHistory() }, [refreshHistory])

  const onPickFile = useCallback((e) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (!f.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Please choose a PDF file')
      return
    }
    if (f.size > MAX_UPLOAD_MB * 1024 * 1024) {
      toast.error(`File exceeds ${MAX_UPLOAD_MB} MB limit`)
      return
    }
    setFile(f)
    setResult(null)
    setError(null)
  }, [])

  const onExtract = useCallback(async () => {
    if (!file) {
      toast.warn('Choose a PDF first')
      return
    }
    if (mode === MODE_VISION && !apiKey.trim()) {
      toast.warn('Paste your AI API key to use Vision mode')
      return
    }
    // Persist / clear BYOK preference (sessionStorage only — cleared on tab close)
    if (mode === MODE_VISION && rememberKey) {
      sessionStorage.setItem(SS_KEY_PROVIDER, visionProvider)
      sessionStorage.setItem(SS_KEY_APIKEY, apiKey)
      sessionStorage.setItem(SS_KEY_REMEMBER, '1')
    } else {
      sessionStorage.removeItem(SS_KEY_APIKEY)
      sessionStorage.removeItem(SS_KEY_REMEMBER)
    }

    setLoading(true)
    setError(null)
    setUploadPct(0)
    try {
      const data = await extractLineTags(file, {
        mode,
        forceOcr,
        provider: visionProvider,
        apiKey: apiKey.trim(),
        onProgress: setUploadPct,
      })
      setResult(data)
      toast.success(`Extracted ${data?.tags?.length ?? 0} line tag(s)`)
      refreshHistory()   // auto-saved on server — refresh the panel
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || 'Extraction failed'
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }, [file, mode, forceOcr, visionProvider, apiKey, rememberKey, refreshHistory])

  const onReset = useCallback(() => {
    setFile(null)
    setResult(null)
    setError(null)
    setUploadPct(0)
    setForceOcr(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  const onClearAll = useCallback(() => {
    if (loading) {
      toast.info('Extraction is still running — please wait for it to finish.')
      return
    }
    if (!window.confirm(CLEAR_CONFIRM_MSG)) return
    onReset()
    toast.success('Inputs cleared — ready for a new upload')
  }, [loading, onReset])

  const onLoadHistory = useCallback(async (extractionId) => {
    try {
      const data = await getExtraction(extractionId)
      // detail endpoint uses `tags` array — shape matches result
      setResult({
        extraction_id: data.extraction_id,
        filename: data.filename,
        mode: data.mode,
        provider: data.provider,
        model: data.model,
        tags: data.tags || [],
        summary: data.summary_json || {},
        created_at: data.created_at,
      })
      setError(null)
      toast.info(`Loaded ${data.tag_count} tag(s) from history`)
    } catch (err) {
      toast.error('Failed to load extraction')
    }
  }, [])

  const onDeleteHistory = useCallback(async (extractionId) => {
    if (!window.confirm('Delete this saved extraction?')) return
    try {
      await deleteExtraction(extractionId)
      // if it was the currently displayed one, clear the results card
      setResult((r) => (r?.extraction_id === extractionId ? null : r))
      refreshHistory()
      toast.success('Extraction deleted')
    } catch (err) {
      toast.error('Delete failed')
    }
  }, [refreshHistory])

  const onExportCsv = useCallback(() => {
    if (!result?.tags?.length) return
    const base = (result.filename || 'pid').replace(/\.pdf$/i, '')
    downloadBlob(toCsv(result.tags), `${base}_line_tags.csv`, 'text/csv')
  }, [result])

  const onExportJson = useCallback(() => {
    if (!result) return
    const base = (result.filename || 'pid').replace(/\.pdf$/i, '')
    downloadBlob(JSON.stringify(result, null, 2), `${base}_line_tags.json`, 'application/json')
  }, [result])

  const grouped = useMemo(() => {
    const tags = result?.tags || []
    if (!tags.length) return []
    const map = new Map()
    for (const t of tags) {
      const g = t.service_group || t.service || 'Other'
      if (!map.has(g)) map.set(g, [])
      map.get(g).push(t)
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [result])

  return (
    <div style={{
      height: `calc(100vh - ${TOP_NAV_OFFSET_PX}px)`,
      marginTop: TOP_NAV_OFFSET_PX,
      overflow: 'hidden',
      background: THEME_BG_SOFT,
      display: 'flex', flexDirection: 'column',
    }}>
      {/* ── Compact header (fixed) ──────────────────────────────── */}
      <div style={{
        flex: '0 0 auto',
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 20px',
        background: '#fff', borderBottom: `1px solid ${THEME_BORDER}`,
      }}>
        <div style={{
          width: 34, height: 34, borderRadius: 8,
          background: THEME_GRADIENT, display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 10px rgba(124,58,237,0.25)',
        }}>
          <BookOpen size={16} color="#fff" />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: THEME_TEXT, lineHeight: 1.15 }}>
            {PAGE_TITLE}
          </div>
          <div style={{ fontSize: 11, color: THEME_MUTED, lineHeight: 1.2 }}>
            {PAGE_SUBTITLE}
          </div>
        </div>

        {/* Docs & Workflow — opens standalone documentation page */}
        <button
          type="button"
          onClick={() => navigate(DOCS_ROUTE)}
          title={DOCS_BUTTON_TITLE}
          style={{
            marginLeft: 'auto',
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 10px', borderRadius: 999,
            border: `1px solid ${THEME_BORDER}`, background: '#fff',
            fontSize: 11, color: THEME_TEXT, cursor: 'pointer',
          }}
        >
          <FileText size={12} color={THEME_PRIMARY} />
          <span style={{ color: THEME_TEXT, fontWeight: 600 }}>{DOCS_BUTTON_LABEL}</span>
        </button>

        {/* Legend status pill */}
        <button
          type="button" onClick={() => setLegendModalOpen(true)}
          title="Manage Legend Sheets"
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 10px', borderRadius: 999,
            border: `1px solid ${activeLegend ? '#a7f3d0' : (effectiveLegend ? '#fcd34d' : THEME_BORDER)}`,
            background: activeLegend ? '#ecfdf5' : (effectiveLegend ? '#fffbeb' : '#fff'),
            fontSize: 11, color: THEME_TEXT, cursor: 'pointer',
          }}
        >
          <BookOpen size={12} color={activeLegend ? '#047857' : (effectiveLegend ? '#b45309' : THEME_MUTED)} />
          <span style={{ color: THEME_MUTED }}>Legend:</span>
          <b style={{
            color: activeLegend ? '#047857' : (effectiveLegend ? '#b45309' : THEME_MUTED),
            maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {activeLegend?.name || effectiveLegend?.name || 'built-in default'}
          </b>
        </button>

        <button
          type="button"
          onClick={() => setLegendModalOpen(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', borderRadius: 8, border: 'none',
            background: THEME_GRADIENT, color: '#fff', fontWeight: 600, fontSize: 12,
            cursor: 'pointer', boxShadow: '0 4px 10px rgba(124,58,237,0.25)',
          }}
        >
          <BookOpen size={14} /> Legend Sheets
        </button>

        <button
          type="button"
          onClick={() => navigate(`${LEGENDS_CANVAS_ROUTE}?section=${LEGEND_SECTION}`)}
          title="Open the full-page Legend Sheets canvas"
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 12px', borderRadius: 8,
            border: `1px solid ${THEME_BORDER}`, background: '#fff',
            color: THEME_TEXT, fontWeight: 600, fontSize: 12, cursor: 'pointer',
          }}
        >
          <Maximize2 size={13} color={THEME_PRIMARY} /> Open Canvas
        </button>

        <button
          type="button"
          onClick={onClearAll}
          disabled={loading}
          title={CLEAR_BUTTON_TITLE}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 12px', borderRadius: 8,
            border: `1px solid ${THEME_BORDER}`,
            background: loading ? '#f1f5f9' : '#fff',
            color: loading ? THEME_MUTED : '#b91c1c',
            fontWeight: 600, fontSize: 12,
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1,
          }}
        >
          <Eraser size={13} /> {CLEAR_BUTTON_LABEL}
        </button>
      </div>

      {/* ── Two-column workspace (fills remaining viewport) ─────── */}
      <div className="pidcv2-workspace" style={{
        flex: '1 1 auto', minHeight: 0,
        display: 'grid',
        gridTemplateColumns: `${LEFT_COL_WIDTH}px 1fr`,
        gap: 16, padding: 16,
        overflow: 'hidden',
      }}>
        {/* ── Left column: inputs (scrolls internally if needed) ── */}
        <div className="pidcv2-left" style={{
          minHeight: 0, overflow: 'auto', paddingRight: 4,
        }}>
          <InputsPanel
            fileInputRef={fileInputRef}
            file={file}
            onPickFile={onPickFile}
            activeLineList={activeLineList}
            onLineListUploaded={refreshLineList}
            activeEquipmentList={activeEquipmentList}
            onEquipmentListUploaded={refreshEquipmentList}
            activeInstrumentIndex={activeInstrumentIndex}
            onInstrumentIndexUploaded={refreshInstrumentIndex}
            mode={mode}
            setMode={setMode}
            forceOcr={forceOcr}
            setForceOcr={setForceOcr}
            visionProvider={visionProvider}
            setVisionProvider={setVisionProvider}
            apiKey={apiKey}
            setApiKey={setApiKey}
            showKey={showKey}
            setShowKey={setShowKey}
            rememberKey={rememberKey}
            setRememberKey={setRememberKey}
            onSubmit={onExtract}
            loading={loading}
            uploadPct={uploadPct}
            activeLegend={activeLegend}
            effectiveLegend={effectiveLegend}
          />
          {loading && uploadPct >= 100 && (
            <p style={{ marginTop: 10, color: THEME_MUTED, fontSize: 12 }}>
              Upload complete — server is running {mode === MODE_VISION ? 'AI Vision extraction' : 'OCR'}.
              This can take {mode === MODE_VISION ? '1–2 minutes' : 'a few minutes'}.
            </p>
          )}
          {(file || result) && !loading && (
            <button
              type="button" onClick={onReset}
              style={{
                marginTop: 10, width: '100%',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '8px 14px', borderRadius: 8, border: `1px solid ${THEME_BORDER}`,
                background: '#fff', color: THEME_TEXT, cursor: 'pointer', fontSize: 12,
              }}
            >
              <RefreshCw size={12} /> Reset inputs
            </button>
          )}
        </div>

        {/* ── Right column: tabbed results ───────────────────────── */}
        <div className="pidcv2-right" style={{ minHeight: 0, minWidth: 0 }}>
          <ResultsTabs
            result={result}
            error={error}
            loading={loading}
            grouped={grouped}
            LEGEND_SECTION={LEGEND_SECTION}
            onExportCsv={onExportCsv}
            onExportJson={onExportJson}
            pdfFile={file}
            activeLegend={activeLegend}
            effectiveLegend={effectiveLegend}
            activeLineList={activeLineList}
            refreshLineList={refreshLineList}
            activeEquipmentList={activeEquipmentList}
            refreshEquipmentList={refreshEquipmentList}
            activeInstrumentIndex={activeInstrumentIndex}
            refreshInstrumentIndex={refreshInstrumentIndex}
            visionProvider={visionProvider}
            apiKey={apiKey}
            history={history}
            historyLoading={historyLoading}
            refreshHistory={refreshHistory}
            onLoadHistory={onLoadHistory}
            onDeleteHistory={onDeleteHistory}
          />
        </div>
      </div>

      {/* keyframes for loader spin + responsive workspace */}
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @media (max-width: ${LAYOUT_BREAKPOINT_PX}px) {
          .pidcv2-workspace { grid-template-columns: 1fr !important; grid-template-rows: auto 1fr !important; }
        }
      `}</style>

      {/* Legend Sheets modal */}
      <LegendSheetsModal
        open={legendModalOpen}
        section={LEGEND_SECTION}
        onClose={() => { setLegendModalOpen(false); refreshActiveLegend() }}
        onActiveChange={(a) => setActiveLegend(a)}
      />
    </div>
  )
}
