import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'react-toastify'
import {
  GitCompare, Loader2, Sparkles, Wand2, Download,
  CheckCircle2, XCircle, PlusCircle, ChevronDown, ChevronRight, Gauge,
} from 'lucide-react'

import {
  instrumentCrossCheck, filterInstrumentTags, extractInstrumentTagsFromPid,
} from '../../../../services/pidCheckerV2API'
import InstrumentIndexHistoryPopover from './InstrumentIndexHistoryPopover'
import { downloadCrossCheckExcel } from './crossCheckExcelExport'

// ─── Soft-coded theme ─────────────────────────────────────────────
const THEME_PRIMARY = '#7c3aed'
const THEME_ACCENT = '#ec4899'
const THEME_TEXT = '#0f172a'
const THEME_MUTED = '#64748b'
const THEME_BORDER = '#e2e8f0'
const THEME_BG_SOFT = '#f8fafc'
const THEME_GRADIENT = `linear-gradient(135deg, ${THEME_PRIMARY} 0%, ${THEME_ACCENT} 100%)`

// Backend finding kinds (mirror instrument_cross_check.py)
const K_MATCH   = 'match'
const K_MISSING = 'missing_on_pid'
const K_EXTRA   = 'extra_on_pid'
// Pseudo-filter: matches with attribute mismatches
const K_ATTR_DIFF = 'attribute_mismatch'

const KIND_META = {
  [K_MATCH]:   { label: 'Match',           colour: '#047857', bg: '#ecfdf5', border: '#a7f3d0', Icon: CheckCircle2 },
  [K_MISSING]: { label: 'Missing on P&ID', colour: '#b91c1c', bg: '#fef2f2', border: '#fecaca', Icon: XCircle },
  [K_EXTRA]:   { label: 'Extra on P&ID',   colour: '#b45309', bg: '#fffbeb', border: '#fcd34d', Icon: PlusCircle },
}

// Overall per-tag attribute severity (mirror instrument_cross_check.py)
const SEV_OK       = 'ok'
const SEV_MINOR    = 'minor'
const SEV_CRITICAL = 'critical'

const SEVERITY_META = {
  [SEV_OK]:       { label: 'All attrs OK',   colour: '#047857', bg: '#ecfdf5', border: '#a7f3d0' },
  [SEV_MINOR]:    { label: 'Minor diffs',    colour: '#b45309', bg: '#fffbeb', border: '#fcd34d' },
  [SEV_CRITICAL]: { label: 'Critical diffs', colour: '#b91c1c', bg: '#fef2f2', border: '#fecaca' },
}

// Per-cell attribute status (mirror instrument_cross_check.py)
const ATTR_STATUS_META = {
  match:         { label: 'Match',            colour: '#047857', bg: '#ecfdf5' },
  mismatch:      { label: 'Mismatch',         colour: '#b91c1c', bg: '#fef2f2' },
  missing_pid:   { label: 'Missing (P&ID)',   colour: '#b45309', bg: '#fffbeb' },
  missing_excel: { label: 'Missing (Excel)',  colour: '#b45309', bg: '#fffbeb' },
  both_empty:    { label: '—',                colour: '#94a3b8', bg: '#f8fafc' },
}

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: K_MISSING, label: 'Missing on P&ID' },
  { id: K_EXTRA,   label: 'Extra on P&ID' },
  { id: K_MATCH,   label: 'Match' },
  { id: K_ATTR_DIFF, label: 'Attribute diffs' },
]

/**
 * InstrumentCrossCheckPanel
 *
 * Compares instrument tags detected on the P&ID against the active master
 * Instrument Index. Instrument tags are extracted from the base `tags`
 * list by pattern-matching (LT-8019, PT-8003ATF, PCV-8004B TF, …); the
 * user may also add tags manually via a text field.
 *
 * Props:
 *   tags                    — line-tag dicts from the extraction result
 *   pdfFile                 — raw uploaded PDF, enables on-demand Vision extraction
 *   activeInstrumentIndex   — active II or null
 *   provider, apiKey        — BYOK
 *   onInstrumentIndexChange — refetch trigger after activate/delete
 */
export default function InstrumentCrossCheckPanel({
  tags, pdfFile, activeInstrumentIndex, provider, apiKey, onInstrumentIndexChange, onResultChange,
}) {
  const [loading, setLoading] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [extractStatus, setExtractStatus] = useState('')
  const [visionExtracted, setVisionExtracted] = useState([]) // [{tag, function_code, service}]
  const [result, setResult] = useState(null)
  const [useAi, setUseAi] = useState(true)
  const [filter, setFilter] = useState('all')
  const [expanded, setExpanded] = useState(null)
  const [manualInput, setManualInput] = useState('')

  const canAi = Boolean(provider && apiKey)

  // Auto-detect instrument tags from the extracted result set
  const detectedTags = useMemo(() => {
    if (!Array.isArray(tags)) return []
    const tokens = tags.map(t => t?.tag).filter(Boolean)
    return filterInstrumentTags(tokens)
  }, [tags])

  const manualTags = useMemo(() => {
    if (!manualInput.trim()) return []
    const raw = manualInput.split(/[,;\n]+/).map(s => s.trim().toUpperCase().replace(/\s+/g, '')).filter(Boolean)
    return Array.from(new Set(raw))
  }, [manualInput])

  const finalTags = useMemo(() => {
    const set = new Set([
      ...detectedTags,
      ...visionExtracted.map(v => v.tag).filter(Boolean),
      ...manualTags,
    ])
    return Array.from(set)
  }, [detectedTags, visionExtracted, manualTags])

  // Per-tag attribute dictionary sourced from Vision extraction only.
  // Backend triggers the deep attribute cross-check whenever this object
  // is non-empty (and BYOK creds are set).
  const attributesByTag = useMemo(() => {
    const map = {}
    for (const v of visionExtracted) {
      if (!v?.tag || !v?.attributes || typeof v.attributes !== 'object') continue
      const anyValue = Object.values(v.attributes).some(x => x && String(x).trim())
      if (!anyValue) continue
      map[v.tag] = v.attributes
    }
    return map
  }, [visionExtracted])

  const hasAttributes = Object.keys(attributesByTag).length > 0
  const hasTags = finalTags.length > 0
  const disabled = loading || !activeInstrumentIndex
  const canExtract = Boolean(pdfFile && canAi) && !extracting && !loading

  const onExtractFromPid = useCallback(async () => {
    if (!pdfFile) { toast.warn('Upload a P&ID PDF on the left first'); return }
    if (!canAi)   { toast.warn('Enter a BYOK API key on the left to enable Vision extraction'); return }
    setExtracting(true)
    setExtractStatus('Queued for extraction…')
    try {
      const data = await extractInstrumentTagsFromPid(pdfFile, {
        provider, apiKey,
        onProgress: (pct, msg) => setExtractStatus(`${msg || 'Working…'} (${pct}%)`),
      })
      const list = Array.isArray(data?.tags) ? data.tags : []
      setVisionExtracted(list)
      toast.success(`Vision extracted ${list.length} instrument tag(s) from the P&ID`)
    } catch (err) {
      toast.error(err?.response?.data?.error || err.message || 'Vision extraction failed')
    } finally {
      setExtracting(false)
      setExtractStatus('')
    }
  }, [pdfFile, canAi, provider, apiKey])

  const onRun = useCallback(async () => {
    if (!activeInstrumentIndex) { toast.warn('Upload and activate an Instrument Index first'); return }
    if (hasAttributes && !canAi) {
      toast.warn('Attribute cross-check needs a BYOK API key — running tag-only comparison')
    }
    setLoading(true)
    try {
      const data = await instrumentCrossCheck({
        instrumentTags: finalTags,
        instrumentIndexId: activeInstrumentIndex.instrument_index_id,
        useAi: useAi && canAi,
        provider,
        apiKey,
        instrumentAttributes: canAi ? attributesByTag : undefined,
      })
      setResult(data)
      const s = data.summary || {}
      const attrNote = (s.attribute_mismatches || 0)
        ? ` · ${s.attribute_mismatches} attr diff(s)${s.attribute_critical ? ` (${s.attribute_critical} critical)` : ''}`
        : ''
      toast.success(
        `Cross-check: ${s.match || 0} match · ${s.missing_on_pid || 0} missing · `
        + `${s.extra_on_pid || 0} extra${attrNote}`
      )
    } catch (err) {
      toast.error(err?.response?.data?.error || err.message || 'Cross-check failed')
    } finally {
      setLoading(false)
    }
  }, [finalTags, activeInstrumentIndex, useAi, canAi, provider, apiKey, attributesByTag, hasAttributes])

  // Reset stale result when the active index changes
  useEffect(() => { setResult(null); setExpanded(null) }, [activeInstrumentIndex?.instrument_index_id])

  // Clear vision extraction when the PDF is swapped out
  useEffect(() => { setVisionExtracted([]) }, [pdfFile])

  // Bubble the latest cross-check result up so the parent can build a combined workbook
  useEffect(() => { if (typeof onResultChange === 'function') onResultChange(result) }, [result, onResultChange])

  const findings = result?.findings || []
  const filtered = useMemo(() => {
    if (filter === 'all') return findings
    if (filter === K_ATTR_DIFF) {
      return findings.filter(f => f.kind === K_MATCH
        && (f.severity === SEV_MINOR || f.severity === SEV_CRITICAL))
    }
    return findings.filter(f => f.kind === filter)
  }, [findings, filter])

  const s = result?.summary || {}

  return (
    <div style={{
      background: '#fff', border: `1px solid ${THEME_BORDER}`, borderRadius: 12,
      padding: 20,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: THEME_GRADIENT, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Gauge size={16} color="#fff" />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: THEME_TEXT }}>
            Cross-check vs Master Instrument Index
          </div>
          <div style={{ fontSize: 12, color: THEME_MUTED }}>
            {activeInstrumentIndex
              ? `Comparing against: ${activeInstrumentIndex.title || activeInstrumentIndex.filename} · ${activeInstrumentIndex.total_rows} tags`
              : 'No active Instrument Index — upload one on the left.'}
          </div>
        </div>

        <label
          title={canAi ? '' : 'Enter a BYOK API key in the extraction panel first'}
          style={{
            marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 12, color: canAi ? THEME_TEXT : THEME_MUTED,
            cursor: canAi ? 'pointer' : 'not-allowed', userSelect: 'none',
          }}
        >
          <input
            type="checkbox" checked={useAi && canAi} disabled={!canAi}
            onChange={(e) => setUseAi(e.target.checked)}
          />
          <Sparkles size={12} color={THEME_PRIMARY} /> AI-assisted correlation
        </label>

        <InstrumentIndexHistoryPopover
          activeInstrumentIndex={activeInstrumentIndex}
          onChange={onInstrumentIndexChange}
        />

        <button
          type="button" onClick={onRun} disabled={disabled}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', borderRadius: 8,
            border: 'none', color: '#fff',
            background: disabled ? '#cbd5e1' : THEME_GRADIENT,
            fontSize: 12, fontWeight: 600,
            cursor: disabled ? 'not-allowed' : 'pointer',
          }}
        >
          {loading
            ? <><Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> Comparing…</>
            : <><GitCompare size={12} /> Run cross-check</>}
        </button>

        {result && (
          <button
            type="button"
            onClick={() => downloadCrossCheckExcel(result, 'instrument_index', {
              contextTitle: activeInstrumentIndex
                ? (activeInstrumentIndex.title || activeInstrumentIndex.filename)
                : '',
            })}
            title="Download this cross-check as an Excel workbook"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 12px', borderRadius: 8,
              border: `1px solid ${THEME_BORDER}`,
              background: '#fff', color: THEME_TEXT,
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}
          >
            <Download size={12} /> Excel
          </button>
        )}
      </div>

      {/* Detected + manual instrument tag inputs */}
      <div style={{
        marginBottom: 14, padding: 12, borderRadius: 10,
        border: `1px solid ${THEME_BORDER}`, background: THEME_BG_SOFT,
      }}>
        {/* Vision extraction — the accurate path */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
          padding: '8px 10px', marginBottom: 10, borderRadius: 8,
          border: `1px solid ${visionExtracted.length ? '#fde68a' : THEME_BORDER}`,
          background: visionExtracted.length ? '#fffbeb' : '#fff',
        }}>
          <Wand2 size={14} color={visionExtracted.length ? '#b45309' : THEME_PRIMARY} />
          <div style={{ fontSize: 12, color: THEME_TEXT, minWidth: 0 }}>
            <b>Vision extraction:</b>{' '}
            {visionExtracted.length
              ? <span style={{ color: '#b45309' }}>{visionExtracted.length} instrument tag(s) detected on the P&amp;ID</span>
              : <span style={{ color: THEME_MUTED }}>Run a targeted AI pass to pull ISA-5.1 instrument tags directly from the drawing.</span>}
          </div>
          <button
            type="button" onClick={onExtractFromPid} disabled={!canExtract}
            title={
              !pdfFile ? 'Upload a P&ID PDF on the left first'
                : !canAi ? 'Enter a BYOK API key on the left first'
                : 'Run Vision extraction (BYOK)'
            }
            style={{
              marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 12px', borderRadius: 8,
              border: 'none', color: '#fff',
              background: canExtract ? THEME_GRADIENT : '#cbd5e1',
              fontSize: 12, fontWeight: 600,
              cursor: canExtract ? 'pointer' : 'not-allowed',
            }}
          >
            {extracting
              ? <><Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> Extracting…</>
              : <><Wand2 size={12} /> {visionExtracted.length ? 'Re-extract' : 'Extract from P&ID'}</>}
          </button>
        </div>

        {extracting && extractStatus && (
          <div style={{
            marginBottom: 10, padding: '6px 10px', borderRadius: 6,
            background: '#fef3c7', border: '1px solid #fde68a',
            color: '#92400e', fontSize: 11,
          }}>
            {extractStatus}
          </div>
        )}

        {visionExtracted.length > 0 && (
          <div style={{
            marginBottom: 10, padding: 8, borderRadius: 8,
            background: '#fff', border: `1px solid ${THEME_BORDER}`,
            fontSize: 11, color: THEME_TEXT, maxHeight: 120, overflow: 'auto',
          }}>
            <div style={{ color: THEME_MUTED, marginBottom: 4, fontSize: 10, letterSpacing: 0.3, textTransform: 'uppercase' }}>
              AI-extracted instruments
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {visionExtracted.map(v => (
                <span key={v.tag} title={v.service || v.function_code || ''}
                  style={{
                    padding: '2px 8px', borderRadius: 999, fontSize: 11,
                    background: '#fef3c7', color: '#92400e',
                    border: `1px solid #fde68a`,
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                  }}>
                  {v.tag}{v.function_code ? ` · ${v.function_code}` : ''}
                </span>
              ))}
            </div>
          </div>
        )}

        <div style={{ fontSize: 12, color: THEME_MUTED, marginBottom: 6 }}>
          <b style={{ color: THEME_TEXT }}>{detectedTags.length}</b> extra instrument-shaped tag(s) auto-detected from line extraction
          {detectedTags.length > 0 && (
            <span style={{ marginLeft: 8, color: THEME_TEXT, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
              {detectedTags.slice(0, 8).join(', ')}{detectedTags.length > 8 ? ` … +${detectedTags.length - 8}` : ''}
            </span>
          )}
        </div>
        <div style={{ fontSize: 11, color: THEME_MUTED, marginBottom: 6 }}>
          Add extra instrument tags manually (comma / newline separated — spaces inside a tag are OK):
        </div>
        <input
          type="text" value={manualInput} onChange={(e) => setManualInput(e.target.value)}
          placeholder="e.g. LT-8019 TF, PT-8003ATF, PCV-8004B TF"
          style={{
            width: '100%', padding: '8px 10px', borderRadius: 8,
            border: `1px solid ${THEME_BORDER}`, background: '#fff',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12,
            color: THEME_TEXT, outline: 'none',
          }}
        />
        <div style={{ marginTop: 6, fontSize: 11, color: THEME_MUTED }}>
          Total tags to compare: <b style={{ color: THEME_TEXT }}>{finalTags.length}</b>
          {!hasTags && ' — enter at least one tag to compare.'}
        </div>
      </div>

      {/* Summary pills */}
      {result && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
          <SummaryPill label="P&ID tags"        value={s.pid_total ?? 0} />
          <SummaryPill label="Instrument Index" value={s.instrument_index_total ?? 0} />
          <SummaryPill label="Match"            value={s.match ?? 0}          tone="ok" />
          <SummaryPill label="Missing on P&ID"  value={s.missing_on_pid ?? 0} tone="err" />
          <SummaryPill label="Extra on P&ID"    value={s.extra_on_pid ?? 0}   tone="warn" />
          <SummaryPill label="Coverage"         value={`${s.coverage_pct ?? 0}%`} tone={
            (s.coverage_pct ?? 0) >= 95 ? 'ok' : (s.coverage_pct ?? 0) >= 75 ? 'warn' : 'err'
          } />
          {(s.attribute_mismatches ?? 0) > 0 && (
            <SummaryPill label="Attr diffs" value={s.attribute_mismatches ?? 0}
              tone={(s.attribute_critical ?? 0) > 0 ? 'err' : 'warn'} />
          )}
          {(s.attribute_critical ?? 0) > 0 && (
            <SummaryPill label="Critical" value={s.attribute_critical} tone="err" />
          )}
          {(s.fuzzy_pairs ?? 0) > 0 && (
            <SummaryPill label="Fuzzy-paired" value={s.fuzzy_pairs} tone="warn" />
          )}
          {(s.ai_promoted_pairs ?? 0) > 0 && (
            <SummaryPill label="AI-paired" value={s.ai_promoted_pairs} tone="warn" />
          )}
          {result.ai_attributes_used && (
            <span style={{
              padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600,
              color: '#fff', background: THEME_GRADIENT,
              display: 'inline-flex', alignItems: 'center', gap: 4,
            }}>
              <Sparkles size={11} /> AI attribute judge
            </span>
          )}
          {result.ai_used && (
            <span style={{
              padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600,
              color: '#fff', background: THEME_GRADIENT,
              display: 'inline-flex', alignItems: 'center', gap: 4,
            }}>
              <Sparkles size={11} /> AI enrichment applied
            </span>
          )}
        </div>
      )}

      {/* Filter tabs */}
      {result && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {FILTERS.map(f => (
            <button
              key={f.id} type="button" onClick={() => setFilter(f.id)}
              style={{
                padding: '5px 10px', borderRadius: 999, fontSize: 12,
                border: `1px solid ${filter === f.id ? THEME_PRIMARY : THEME_BORDER}`,
                background: filter === f.id ? '#faf5ff' : '#fff',
                color: filter === f.id ? THEME_PRIMARY : THEME_TEXT,
                fontWeight: filter === f.id ? 600 : 500, cursor: 'pointer',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {/* Findings */}
      {result && (
        filtered.length === 0
          ? (
            <div style={{ padding: 14, textAlign: 'center', color: THEME_MUTED, fontSize: 13 }}>
              No findings in this category.
            </div>
          )
          : (
            <div style={{ display: 'grid', gap: 6 }}>
              {filtered.map((f, idx) => {
                const meta = KIND_META[f.kind] || KIND_META[K_MATCH]
                const key = `${f.kind}::${f.tag || idx}`
                const isOpen = expanded === key
                return (
                  <div key={key} style={{
                    borderRadius: 10, border: `1px solid ${meta.border}`, background: meta.bg,
                  }}>
                    <button
                      type="button" onClick={() => setExpanded(isOpen ? null : key)}
                      style={{
                        width: '100%', textAlign: 'left',
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '10px 12px', border: 'none', background: 'transparent',
                        cursor: 'pointer',
                      }}
                    >
                      <meta.Icon size={14} color={meta.colour} />
                      <span style={{
                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                        fontSize: 13, fontWeight: 600, color: THEME_TEXT,
                      }}>
                        {f.tag || '(no tag)'}
                      </span>
                      <span style={{
                        padding: '2px 8px', borderRadius: 999, fontSize: 11,
                        background: '#fff', color: meta.colour,
                        border: `1px solid ${meta.border}`,
                      }}>
                        {meta.label}
                      </span>
                      {f.fuzzy_match && (
                        <span title="Paired by deterministic fuzzy match" style={{
                          padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600,
                          background: '#fffbeb', color: '#b45309',
                          border: '1px solid #fcd34d',
                        }}>Fuzzy</span>
                      )}
                      {f.ai_probable_match && (
                        <span title="Paired by AI recommendation" style={{
                          padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600,
                          color: '#fff', background: THEME_GRADIENT,
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                        }}>
                          <Sparkles size={10} /> AI paired
                        </span>
                      )}
                      {f.kind === K_MATCH && f.severity && SEVERITY_META[f.severity] && (
                        <span title={SEVERITY_META[f.severity].label} style={{
                          padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600,
                          background: SEVERITY_META[f.severity].bg,
                          color: SEVERITY_META[f.severity].colour,
                          border: `1px solid ${SEVERITY_META[f.severity].border}`,
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                        }}>
                          <span style={{
                            width: 6, height: 6, borderRadius: '50%',
                            background: SEVERITY_META[f.severity].colour, display: 'inline-block',
                          }} />
                          {SEVERITY_META[f.severity].label}
                        </span>
                      )}
                      {f.instrument_type && (
                        <span style={{ color: THEME_MUTED, fontSize: 12 }}>
                          {f.instrument_type}
                        </span>
                      )}
                      <span style={{ marginLeft: 'auto' }}>
                        {isOpen ? <ChevronDown size={14} color={THEME_MUTED} /> : <ChevronRight size={14} color={THEME_MUTED} />}
                      </span>
                    </button>

                    {isOpen && (
                      <div style={{
                        padding: '4px 14px 12px 40px', fontSize: 12, color: THEME_TEXT,
                        display: 'grid', gap: 4,
                      }}>
                        {f.message && (
                          <div style={{ color: THEME_MUTED }}>{f.message}</div>
                        )}
                        {f.instrument_type && (
                          <div><span style={{ color: THEME_MUTED }}>Type:</span> {f.instrument_type}</div>
                        )}
                        {f.service_description && (
                          <div><span style={{ color: THEME_MUTED }}>Service:</span> {f.service_description}</div>
                        )}
                        {f.eqpt_no && f.eqpt_no !== '-' && (
                          <div><span style={{ color: THEME_MUTED }}>Attached to equipment:</span> {f.eqpt_no}</div>
                        )}
                        {f.line_no && f.line_no !== '-' && (
                          <div><span style={{ color: THEME_MUTED }}>Line:</span> {f.line_no}</div>
                        )}
                        {f.pid_no && (
                          <div><span style={{ color: THEME_MUTED }}>P&amp;ID:</span> {f.pid_no}</div>
                        )}
                        {f.instrument_index_row && (
                          <div><span style={{ color: THEME_MUTED }}>Excel row:</span> {f.instrument_index_row}</div>
                        )}
                        {f.ai_suggested_match && (
                          <div style={{
                            marginTop: 6, padding: '6px 10px', borderRadius: 8,
                            background: '#faf5ff', border: `1px solid ${THEME_PRIMARY}`,
                            display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
                          }}>
                            <Sparkles size={12} color={THEME_PRIMARY} />
                            <span style={{ color: THEME_PRIMARY, fontWeight: 600 }}>
                              AI suggests → {f.ai_suggested_match}
                            </span>
                            {f.ai_confidence && (
                              <span style={{ color: THEME_MUTED }}>({f.ai_confidence})</span>
                            )}
                            {f.ai_reason && (
                              <span style={{ color: THEME_MUTED, marginLeft: 4 }}>— {f.ai_reason}</span>
                            )}
                          </div>
                        )}
                        {Array.isArray(f.attributes) && f.attributes.length > 0 && (
                          <AttributeGrid attributes={f.attributes} />
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )
      )}

      {!result && (
        <div style={{ padding: 14, textAlign: 'center', color: THEME_MUTED, fontSize: 13 }}>
          {activeInstrumentIndex
            ? 'Click "Run cross-check" to compare the instrument tags against the master Instrument Index.'
            : 'Upload a master Instrument Index (Excel) on the left to enable this cross-check.'}
        </div>
      )}
    </div>
  )
}

function SummaryPill({ label, value, tone = 'neutral' }) {
  const TONE = {
    neutral: { bg: '#f1f5f9', fg: '#0f172a', border: '#e2e8f0' },
    ok:      { bg: '#ecfdf5', fg: '#047857', border: '#a7f3d0' },
    warn:    { bg: '#fffbeb', fg: '#b45309', border: '#fcd34d' },
    err:     { bg: '#fef2f2', fg: '#b91c1c', border: '#fecaca' },
  }[tone] || {}
  return (
    <span style={{
      padding: '5px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600,
      background: TONE.bg, color: TONE.fg, border: `1px solid ${TONE.border}`,
      display: 'inline-flex', alignItems: 'center', gap: 6,
    }}>
      <span style={{ opacity: 0.75 }}>{label}</span>
      <span>{value}</span>
    </span>
  )
}

function AttributeGrid({ attributes }) {
  return (
    <div style={{
      marginTop: 8, borderRadius: 8, border: '1px solid #e2e8f0',
      background: '#fff', overflow: 'hidden',
    }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1.4fr 1.2fr 1.2fr 0.9fr',
        fontSize: 11, fontWeight: 600, color: '#64748b',
        background: '#f8fafc', padding: '6px 10px',
        borderBottom: '1px solid #e2e8f0',
        textTransform: 'uppercase', letterSpacing: 0.3,
      }}>
        <span>Attribute</span>
        <span>P&amp;ID Value</span>
        <span>Instrument Index</span>
        <span>Status</span>
      </div>
      {attributes.map((a, i) => {
        const meta = ATTR_STATUS_META[a.status] || ATTR_STATUS_META.both_empty
        return (
          <div key={`${a.key}-${i}`} style={{
            display: 'grid',
            gridTemplateColumns: '1.4fr 1.2fr 1.2fr 0.9fr',
            fontSize: 12, padding: '6px 10px',
            borderTop: i === 0 ? 'none' : '1px solid #f1f5f9',
            alignItems: 'center',
            background: a.status === 'mismatch' ? '#fef2f2'
              : a.status === 'missing_pid' || a.status === 'missing_excel' ? '#fffbeb'
              : '#fff',
          }}>
            <span style={{ color: '#0f172a', fontWeight: 500 }}>{a.label || a.key}</span>
            <span style={{ color: '#0f172a', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
              {a.pid_value || <span style={{ color: '#94a3b8' }}>—</span>}
            </span>
            <span style={{ color: '#0f172a', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
              {a.excel_value || <span style={{ color: '#94a3b8' }}>—</span>}
            </span>
            <span>
              <span title={a.note || ''} style={{
                padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600,
                background: meta.bg, color: meta.colour,
                border: `1px solid ${meta.colour}22`,
              }}>
                {meta.label}
              </span>
              {a.note && (
                <div style={{ marginTop: 3, color: '#64748b', fontSize: 11 }}>{a.note}</div>
              )}
            </span>
          </div>
        )
      })}
    </div>
  )
}
