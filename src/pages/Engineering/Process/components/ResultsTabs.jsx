import React, { useCallback, useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import {
  Sparkles, CheckCircle2, Save, Download, FileText, Loader2, History as HistoryIcon,
  RefreshCw, Trash2, ShieldCheck, GitCompare, LayoutGrid, AlertCircle, Boxes, Gauge,
  FileSpreadsheet, Coins, FileDown,
} from 'lucide-react'

import {
  MODE_VISION,
  getUsageSummary,
  downloadTokenReport,
} from '../../../../services/pidCheckerV2API'
import LegendValidationPanel from './LegendValidationPanel'
import CrossCheckPanel from './CrossCheckPanel'
import EquipmentCrossCheckPanel from './EquipmentCrossCheckPanel'
import InstrumentCrossCheckPanel from './InstrumentCrossCheckPanel'
import { downloadCombinedWorkbook } from './crossCheckExcelExport'

// ─── Soft-coded theme (matches parent) ─────────────────────────────
const THEME_PRIMARY = '#7c3aed'
const THEME_ACCENT  = '#ec4899'
const THEME_TEXT    = '#0f172a'
const THEME_MUTED   = '#64748b'
const THEME_BORDER  = '#e2e8f0'
const THEME_BG_SOFT = '#f8fafc'
const THEME_GRADIENT = `linear-gradient(135deg, ${THEME_PRIMARY} 0%, ${THEME_ACCENT} 100%)`

// Soft-coded tab ids
const TAB_OVERVIEW    = 'overview'
const TAB_LEGEND      = 'legend'
const TAB_CROSSCHECK  = 'crosscheck'
const TAB_EQUIPMENT   = 'equipment'
const TAB_INSTRUMENT  = 'instrument'
const TAB_HISTORY     = 'history'

const TABS = [
  { id: TAB_OVERVIEW,   label: 'Overview',    Icon: LayoutGrid },
  { id: TAB_LEGEND,     label: 'Legend',      Icon: ShieldCheck },
  { id: TAB_CROSSCHECK, label: 'Line List',   Icon: GitCompare },
  { id: TAB_EQUIPMENT,  label: 'Equipment',   Icon: Boxes },
  { id: TAB_INSTRUMENT, label: 'Instrument',  Icon: Gauge },
  { id: TAB_HISTORY,    label: 'History',     Icon: HistoryIcon },
]

/**
 * ResultsTabs — single-viewport tabbed results container.
 *
 * Renders a horizontal tab bar and a scrollable body that hosts one
 * of: extraction overview, legend validation, cross-check, or saved history.
 * All state lives in the parent; this component is purely presentational.
 */
export default function ResultsTabs({
  // Extraction result
  result, error, loading, grouped, section, LEGEND_SECTION,
  onExportCsv, onExportJson,
  // Raw uploaded PDF (source for BYOK Vision extraction inside panels)
  pdfFile,
  // Legend
  activeLegend, effectiveLegend,
  // Cross-check (Line List)
  activeLineList, refreshLineList,
  // Cross-check (Equipment List)
  activeEquipmentList, refreshEquipmentList,
  // Cross-check (Instrument Index)
  activeInstrumentIndex, refreshInstrumentIndex,
  // BYOK for Legend + Cross-check
  visionProvider, apiKey,
  // History
  history, historyLoading, refreshHistory, onLoadHistory, onDeleteHistory,
}) {
  const [tab, setTab] = useState(TAB_OVERVIEW)

  // Latest cross-check result per variant — populated via onResultChange callbacks
  // from each panel. Used to assemble the combined workbook download.
  const [lineListResult,   setLineListResult]   = useState(null)
  const [equipmentResult,  setEquipmentResult]  = useState(null)
  const [instrumentResult, setInstrumentResult] = useState(null)

  const canDownloadCombined = Boolean(
    result?.tags?.length || lineListResult || equipmentResult || instrumentResult
  )

  const onDownloadCombined = useCallback(() => {
    try {
      downloadCombinedWorkbook(
        {
          overview:   result || undefined,
          legend:     activeLegend || effectiveLegend || undefined,
          lineList:   lineListResult || undefined,
          equipment:  equipmentResult || undefined,
          instrument: instrumentResult || undefined,
        },
        {
          reportTitle: result?.filename ? `P&ID Checker report — ${result.filename}` : 'P&ID Checker report',
        },
      )
    } catch (err) {
      toast.warn(err?.message || 'Nothing to export yet')
    }
  }, [result, activeLegend, effectiveLegend, lineListResult, equipmentResult, instrumentResult])

  const badgeFor = (id) => {
    if (id === TAB_OVERVIEW)   return result?.summary?.total ?? (result?.tags?.length ?? 0)
    if (id === TAB_HISTORY)    return history?.length ?? 0
    if (id === TAB_LEGEND)     return result?.tags?.length ? '\u2022' : 0
    if (id === TAB_CROSSCHECK) return activeLineList ? '\u2022' : 0
    if (id === TAB_EQUIPMENT)  return activeEquipmentList ? '\u2022' : 0
    if (id === TAB_INSTRUMENT) return activeInstrumentIndex ? '\u2022' : 0
    return 0
  }

  return (
    <div style={{
      background: '#fff', border: `1px solid ${THEME_BORDER}`, borderRadius: 12,
      display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden', height: '100%',
    }}>
      {/* ── Tab bar ─────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', gap: 8, padding: '8px 8px 0', alignItems: 'flex-end',
        borderBottom: `1px solid ${THEME_BORDER}`,
        flex: '0 0 auto', minWidth: 0,
      }}>
        {/* Tabs scroll horizontally on their own when the container is too
            narrow to fit all of them — keeps labels on one line (no wrap)
            and guarantees the download button (outside this scroller,
            flexShrink: 0 below) is never pushed off-screen or clipped. */}
        <div style={{
          display: 'flex', gap: 4, overflowX: 'auto', minWidth: 0,
          scrollbarWidth: 'thin',
        }}>
          {TABS.map(({ id, label, Icon }) => {
            const active = tab === id
            const badge = badgeFor(id)
            return (
              <button
                key={id} type="button" onClick={() => setTab(id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '10px 14px', borderRadius: '8px 8px 0 0',
                  border: 'none',
                  borderBottom: `2px solid ${active ? THEME_PRIMARY : 'transparent'}`,
                  background: active ? '#fff' : 'transparent',
                  color: active ? THEME_PRIMARY : THEME_MUTED,
                  fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  position: 'relative', marginBottom: -1,
                  whiteSpace: 'nowrap', flexShrink: 0,
                }}
              >
                <Icon size={14} /> {label}
                {Boolean(badge) && badge !== '•' && (
                  <span style={{
                    padding: '1px 7px', borderRadius: 999, fontSize: 10,
                    background: active ? THEME_PRIMARY : THEME_BG_SOFT,
                    color: active ? '#fff' : THEME_MUTED, fontWeight: 700,
                  }}>{badge}</span>
                )}
                {badge === '•' && (
                  <span style={{
                    width: 6, height: 6, borderRadius: 999,
                    background: active ? THEME_PRIMARY : '#a3a3a3',
                    flexShrink: 0,
                  }} />
                )}
              </button>
            )
          })}
        </div>

        {/* Combined "Download full report" button — lives after the last tab
            and is visible on every tab so users always see it. flexShrink: 0
            + marginLeft: auto keeps it fully visible and pinned right,
            never clipped, regardless of how narrow the tab bar gets. */}
        <button
          type="button"
          onClick={onDownloadCombined}
          disabled={!canDownloadCombined}
          title={canDownloadCombined
            ? 'Download Overview, Legend, Line List, Equipment and Instrument results as one Excel workbook'
            : 'Run at least one extraction or cross-check first'}
          style={{
            marginLeft: 'auto', marginBottom: 6, flexShrink: 0,
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 12px', borderRadius: 8,
            border: 'none', color: '#fff',
            background: canDownloadCombined ? THEME_GRADIENT : '#cbd5e1',
            fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
            cursor: canDownloadCombined ? 'pointer' : 'not-allowed',
          }}
        >
          <FileSpreadsheet size={14} /> Download full report
        </button>
      </div>

      {/* ── Tab body (scrollable) ───────────────────────────────── */}
      <div style={{ flex: 1, overflow: 'auto', padding: 16, minHeight: 0 }}>
        {/* Error is global — always visible on any tab */}
        {error && (
          <div style={{
            display: 'flex', gap: 10, alignItems: 'flex-start',
            padding: 12, borderRadius: 10, border: '1px solid #fecaca',
            background: '#fef2f2', color: '#b91c1c', fontSize: 13, marginBottom: 14,
          }}>
            <AlertCircle size={16} /><div>{error}</div>
          </div>
        )}

        {tab === TAB_OVERVIEW && (
          <OverviewTab
            result={result} loading={loading} grouped={grouped}
            onExportCsv={onExportCsv} onExportJson={onExportJson}
          />
        )}

        {/*
          The four result-bearing panels keep their own internal state
          (cross-check results, vision-extracted tags, filter selections,
          manual entries). We render them all the time and only toggle
          visibility so switching tabs never loses that state.
        */}
        <div style={{ display: tab === TAB_LEGEND ? 'block' : 'none' }}>
          {result?.tags?.length > 0
            ? <LegendValidationPanel
                tags={result.tags}
                activeLegend={activeLegend || effectiveLegend}
                provider={visionProvider} apiKey={apiKey}
                section={section || LEGEND_SECTION}
              />
            : <EmptyState
                Icon={ShieldCheck} title="Legend check needs extracted tags"
                message="Run Analyse P&ID on the left to populate tags for legend validation." />}
        </div>

        <div style={{ display: tab === TAB_CROSSCHECK ? 'block' : 'none' }}>
          {result?.tags?.length > 0
            ? <CrossCheckPanel
                tags={result.tags} activeLineList={activeLineList}
                provider={visionProvider} apiKey={apiKey}
                onLineListChange={refreshLineList}
                onResultChange={setLineListResult} />
            : <EmptyState
                Icon={GitCompare} title="Cross-check needs extracted tags"
                message="Run Analyse P&ID on the left, then compare against the master Line List." />}
        </div>

        <div style={{ display: tab === TAB_EQUIPMENT ? 'block' : 'none' }}>
          <EquipmentCrossCheckPanel
            tags={result?.tags || []}
            pdfFile={pdfFile}
            activeEquipmentList={activeEquipmentList}
            provider={visionProvider} apiKey={apiKey}
            onEquipmentListChange={refreshEquipmentList}
            onResultChange={setEquipmentResult}
          />
        </div>

        <div style={{ display: tab === TAB_INSTRUMENT ? 'block' : 'none' }}>
          <InstrumentCrossCheckPanel
            tags={result?.tags || []}
            pdfFile={pdfFile}
            activeInstrumentIndex={activeInstrumentIndex}
            provider={visionProvider} apiKey={apiKey}
            onInstrumentIndexChange={refreshInstrumentIndex}
            onResultChange={setInstrumentResult}
          />
        </div>

        {tab === TAB_HISTORY && (
          <HistoryTab
            result={result}
            history={history} historyLoading={historyLoading}
            refreshHistory={refreshHistory}
            onLoadHistory={onLoadHistory} onDeleteHistory={onDeleteHistory}
          />
        )}
      </div>
    </div>
  )
}

// ─── Overview tab (extraction summary + grouped tags) ──────────────
function OverviewTab({ result, loading, grouped, onExportCsv, onExportJson }) {
  if (!result) {
    return (
      <EmptyState
        Icon={FileText}
        title={loading ? 'Analysing…' : 'Results will appear here'}
        message={loading
          ? 'Extraction in progress.'
          : 'Choose a P&ID PDF on the left (optionally a master Line List Excel) and click Analyse P&ID.'} />
    )
  }
  const isVision = result.mode === MODE_VISION
  return (
    <div>
      <div style={{
        display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap',
        padding: '12px 14px', borderRadius: 10, marginBottom: 14,
        background: '#ecfdf5', border: '1px solid #a7f3d0',
      }}>
        <CheckCircle2 size={18} color="#16a34a" />
        <div style={{ fontSize: 15, fontWeight: 700, color: THEME_TEXT }}>
          {result.summary?.total ?? result.tags?.length ?? 0} unique line tags
        </div>
        <div style={{ color: THEME_MUTED, fontSize: 12 }}>
          from <span style={{ fontWeight: 500 }}>{result.filename}</span>
        </div>
        {isVision && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '2px 8px', borderRadius: 999, fontSize: 11,
            background: '#faf5ff', color: THEME_PRIMARY, border: `1px solid ${THEME_PRIMARY}`,
          }}>
            <Sparkles size={11} /> {result.model || 'AI Vision'}
          </span>
        )}
        {result.extraction_id && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '2px 8px', borderRadius: 999, fontSize: 11,
            background: '#fff', color: '#047857', border: '1px solid #a7f3d0',
          }}>
            <Save size={11} /> Auto-saved
          </span>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button
            type="button" onClick={onExportCsv} disabled={!result.tags?.length}
            style={pillBtn()}
          ><Download size={12} /> CSV</button>
          <button type="button" onClick={onExportJson} style={pillBtn()}>
            <Download size={12} /> JSON
          </button>
        </div>
      </div>

      {grouped.length === 0
        ? <div style={{ padding: 20, textAlign: 'center', color: THEME_MUTED, fontSize: 13 }}>
            No line tags matched. Try enabling <em>Force OCR</em>.
          </div>
        : grouped.map(([group, tags]) => (
            <div key={group} style={{ marginBottom: 18 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8,
                paddingBottom: 6, borderBottom: `2px solid ${THEME_PRIMARY}`,
              }}>
                <span style={{ fontWeight: 600, color: THEME_TEXT, fontSize: 13 }}>{group}</span>
                <span style={{
                  padding: '2px 8px', borderRadius: 999, fontSize: 11,
                  background: THEME_BG_SOFT, color: THEME_MUTED,
                }}>{tags.length}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 6 }}>
                {tags.map((t) => (
                  <div key={t.tag} style={{
                    padding: '6px 10px', borderRadius: 6,
                    border: `1px solid ${THEME_BORDER}`, background: THEME_BG_SOFT,
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                    fontSize: 12, color: THEME_TEXT,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{t.tag}</div>
                ))}
              </div>
            </div>
          ))
      }
    </div>
  )
}

// ─── History tab ───────────────────────────────────────────────────
function HistoryTab({ result, history, historyLoading, refreshHistory, onLoadHistory, onDeleteHistory }) {
  // Token-usage strip (soft-coded, always visible above the runs list).
  const [usage, setUsage] = useState(null)
  const [usageLoading, setUsageLoading] = useState(false)
  const [reportBusy, setReportBusy] = useState(false)

  const loadUsage = useCallback(async () => {
    setUsageLoading(true)
    try {
      const data = await getUsageSummary()
      setUsage(data)
    } catch (err) {
      console.warn('[PIDCheckerV2] usage summary fetch failed', err)
      setUsage(null)
    } finally {
      setUsageLoading(false)
    }
  }, [])

  useEffect(() => { loadUsage() }, [loadUsage, history?.length])

  const handleReport = useCallback(async (format) => {
    setReportBusy(true)
    try {
      const { filename } = await downloadTokenReport({ format })
      toast.success(`Downloaded ${filename}`)
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || 'Report generation failed'
      toast.error(msg)
    } finally {
      setReportBusy(false)
    }
  }, [])

  const totals = usage?.total || null
  const fmtCost = (v) => {
    const n = Number(v || 0)
    return `$${n.toFixed(6)}`
  }
  const fmtInt = (v) => Number(v || 0).toLocaleString()

  return (
    <div>
      {/* Token-cost strip */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr)) auto',
        gap: 10, marginBottom: 12, padding: 12,
        borderRadius: 10, background: THEME_GRADIENT, color: '#fff',
      }}>
        <StripStat label="Total AI calls"     value={usageLoading ? '…' : fmtInt(totals?.calls)} />
        <StripStat label="Input tokens"       value={usageLoading ? '…' : fmtInt(totals?.input_tokens)} />
        <StripStat label="Output tokens"      value={usageLoading ? '…' : fmtInt(totals?.output_tokens)} />
        <StripStat label="Total cost (USD)"   value={usageLoading ? '…' : fmtCost(totals?.cost_usd)} icon={<Coins size={13} />} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'stretch' }}>
          <button
            type="button" onClick={() => handleReport('xlsx')} disabled={reportBusy}
            style={reportBtnStyle(reportBusy)}
          >
            {reportBusy ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} />
                        : <FileSpreadsheet size={11} />}
            Excel report
          </button>
          <button
            type="button" onClick={() => handleReport('pdf')} disabled={reportBusy}
            style={reportBtnStyle(reportBusy)}
          >
            {reportBusy ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} />
                        : <FileDown size={11} />}
            PDF report
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: THEME_TEXT }}>
          Saved extractions
        </div>
        <span style={{
          padding: '2px 8px', borderRadius: 999, fontSize: 11,
          background: THEME_BG_SOFT, color: THEME_MUTED,
        }}>{history.length}</span>
        <button
          type="button" onClick={() => { refreshHistory(); loadUsage() }} disabled={historyLoading}
          style={{
            marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6,
            padding: '5px 10px', borderRadius: 8,
            border: `1px solid ${THEME_BORDER}`, background: '#fff', color: THEME_TEXT,
            fontSize: 11, cursor: historyLoading ? 'wait' : 'pointer',
          }}
        >
          {historyLoading
            ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} />
            : <RefreshCw size={11} />}
          Refresh
        </button>
      </div>

      {history.length === 0
        ? <div style={{ padding: 20, textAlign: 'center', color: THEME_MUTED, fontSize: 13 }}>
            No saved extractions yet — run one and it will appear here automatically.
          </div>
        : <div style={{ display: 'grid', gap: 6 }}>
            {history.map((h) => {
              const active = result?.extraction_id === h.extraction_id
              const when = h.created_at ? new Date(h.created_at).toLocaleString() : ''
              return (
                <div key={h.extraction_id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 10px', borderRadius: 8,
                  border: `1px solid ${active ? THEME_PRIMARY : THEME_BORDER}`,
                  background: active ? '#faf5ff' : '#fff',
                }}>
                  {h.mode === MODE_VISION
                    ? <Sparkles size={12} color={THEME_PRIMARY} />
                    : <FileText size={12} color={THEME_MUTED} />}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{
                      fontSize: 12, fontWeight: 500, color: THEME_TEXT,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{h.filename}</div>
                    <div style={{ fontSize: 10, color: THEME_MUTED, marginTop: 2 }}>
                      {when} · {h.tag_count} tags · {h.mode === MODE_VISION ? (h.model || 'AI Vision') : 'OCR'}
                    </div>
                  </div>
                  <button type="button" onClick={() => onLoadHistory(h.extraction_id)} style={pillBtn()}>
                    <Save size={11} /> Load
                  </button>
                  <button
                    type="button" onClick={() => onDeleteHistory(h.extraction_id)}
                    title="Delete"
                    style={{
                      display: 'flex', alignItems: 'center',
                      padding: 5, borderRadius: 6,
                      border: `1px solid ${THEME_BORDER}`, background: '#fff', color: '#b91c1c',
                      cursor: 'pointer',
                    }}
                  ><Trash2 size={11} /></button>
                </div>
              )
            })}
          </div>
      }
    </div>
  )
}

function StripStat({ label, value, icon }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.14)', borderRadius: 8,
      padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 2,
    }}>
      <div style={{
        fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.4,
        opacity: 0.85, display: 'flex', alignItems: 'center', gap: 4,
      }}>{icon}{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700 }}>{value ?? '—'}</div>
    </div>
  )
}

function reportBtnStyle(busy) {
  return {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
    border: '1px solid rgba(255,255,255,0.4)',
    background: 'rgba(255,255,255,0.14)', color: '#fff',
    cursor: busy ? 'wait' : 'pointer', whiteSpace: 'nowrap',
  }
}

// ─── Shared bits ───────────────────────────────────────────────────
function EmptyState({ Icon, title, message }) {
  return (
    <div style={{
      padding: 32, textAlign: 'center', border: `1px dashed ${THEME_BORDER}`,
      borderRadius: 12, background: THEME_BG_SOFT,
    }}>
      <div style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 48, height: 48, borderRadius: 12,
        background: '#fff', border: `1px solid ${THEME_BORDER}`, marginBottom: 10,
      }}>
        <Icon size={22} color={THEME_MUTED} />
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: THEME_TEXT, marginBottom: 4 }}>
        {title}
      </div>
      <div style={{ fontSize: 12, color: THEME_MUTED, maxWidth: 360, margin: '0 auto' }}>
        {message}
      </div>
    </div>
  )
}

function pillBtn() {
  return {
    display: 'flex', alignItems: 'center', gap: 4,
    padding: '5px 10px', borderRadius: 8,
    border: `1px solid ${THEME_BORDER}`, background: '#fff', color: THEME_TEXT,
    fontSize: 11, cursor: 'pointer',
  }
}
