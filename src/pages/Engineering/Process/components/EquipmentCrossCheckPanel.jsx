import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'react-toastify'
import {
  GitCompare, Loader2, Sparkles, Wand2, Download,
  CheckCircle2, XCircle, PlusCircle, ChevronDown, ChevronRight, Boxes,
} from 'lucide-react'

import {
  equipmentCrossCheck, filterEquipmentTags, extractEquipmentTagsFromPid,
} from '../../../../services/pidCheckerV2API'
import EquipmentListHistoryPopover from './EquipmentListHistoryPopover'
import { downloadCrossCheckExcel } from './crossCheckExcelExport'

// ─── Soft-coded theme ─────────────────────────────────────────────
const THEME_PRIMARY = '#7c3aed'
const THEME_ACCENT = '#ec4899'
const THEME_TEXT = '#0f172a'
const THEME_MUTED = '#64748b'
const THEME_BORDER = '#e2e8f0'
const THEME_BG_SOFT = '#f8fafc'
const THEME_GRADIENT = `linear-gradient(135deg, ${THEME_PRIMARY} 0%, ${THEME_ACCENT} 100%)`

// Backend finding kinds (mirror equipment_cross_check.py)
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

// Overall per-tag attribute severity (mirror equipment_cross_check.py)
const SEV_OK       = 'ok'
const SEV_MINOR    = 'minor'
const SEV_CRITICAL = 'critical'

const SEVERITY_META = {
  [SEV_OK]:       { label: 'All attrs OK',   colour: '#047857', bg: '#ecfdf5', border: '#a7f3d0' },
  [SEV_MINOR]:    { label: 'Minor diffs',    colour: '#b45309', bg: '#fffbeb', border: '#fcd34d' },
  [SEV_CRITICAL]: { label: 'Critical diffs', colour: '#b91c1c', bg: '#fef2f2', border: '#fecaca' },
}

// Per-cell attribute status (mirror equipment_cross_check.py)
const ATTR_STATUS_META = {
  match:         { label: 'Match',         colour: '#047857', bg: '#ecfdf5' },
  mismatch:      { label: 'Mismatch',      colour: '#b91c1c', bg: '#fef2f2' },
  missing_pid:   { label: 'Missing (P&ID)',   colour: '#b45309', bg: '#fffbeb' },
  missing_excel: { label: 'Missing (Excel)',  colour: '#b45309', bg: '#fffbeb' },
  both_empty:    { label: '—',             colour: '#94a3b8', bg: '#f8fafc' },
}

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: K_MISSING, label: 'Missing on P&ID' },
  { id: K_EXTRA,   label: 'Extra on P&ID' },
  { id: K_MATCH,   label: 'Match' },
  { id: K_ATTR_DIFF, label: 'Attribute diffs' },
]

/**
 * EquipmentCrossCheckPanel
 *
 * Compares equipment tags detected on the P&ID against the active master
 * Equipment List.  The equipment tags are extracted from the base
 * `tags` list by pattern-matching (V-###-XX, P-###, etc.); the user may
 * also add tags manually via a text field.
 *
 * Props:
 *   tags                 — line-tag dicts from the extraction result (source for pattern-detected equipment tags)
 *   pdfFile              — the raw PDF file the user uploaded, enabling on-demand Vision extraction of equipment tags
 *   activeEquipmentList  — active EL or null
 *   provider, apiKey     — BYOK
 *   onEquipmentListChange — refetch trigger after activate/delete
 */
export default function EquipmentCrossCheckPanel({
  tags, pdfFile, activeEquipmentList, provider, apiKey, onEquipmentListChange, onResultChange,
}) {
  const [loading, setLoading] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [visionExtracted, setVisionExtracted] = useState([]) // [{tag, kind, description}]
  const [result, setResult] = useState(null)
  const [useAi, setUseAi] = useState(true)
  const [filter, setFilter] = useState('all')
  const [expanded, setExpanded] = useState(null)
  const [manualInput, setManualInput] = useState('')

  const canAi = Boolean(provider && apiKey)

  // Auto-detect equipment tags from the extracted result set
  const detectedTags = useMemo(() => {
    if (!Array.isArray(tags)) return []
    const tokens = tags.map(t => t?.tag).filter(Boolean)
    return filterEquipmentTags(tokens)
  }, [tags])

  const manualTags = useMemo(() => {
    if (!manualInput.trim()) return []
    const raw = manualInput.split(/[,\s;\n]+/).map(s => s.trim().toUpperCase()).filter(Boolean)
    return Array.from(new Set(raw))
  }, [manualInput])

  // Union of all three sources: line-tag pattern hits, on-demand Vision, manual input
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
      // Skip if every value is empty — no point sending
      const anyValue = Object.values(v.attributes).some(x => x && String(x).trim())
      if (!anyValue) continue
      map[v.tag] = v.attributes
    }
    return map
  }, [visionExtracted])

  const hasAttributes = Object.keys(attributesByTag).length > 0
  const hasTags = finalTags.length > 0
  const disabled = loading || !activeEquipmentList
  const canExtract = Boolean(pdfFile && canAi) && !extracting && !loading

  const onExtractFromPid = useCallback(async () => {
    if (!pdfFile) { toast.warn('Upload a P&ID PDF on the left first'); return }
    if (!canAi)   { toast.warn('Enter a BYOK API key on the left to enable Vision extraction'); return }
    setExtracting(true)
    try {
      const data = await extractEquipmentTagsFromPid(pdfFile, { provider, apiKey })
      const list = Array.isArray(data?.tags) ? data.tags : []
      setVisionExtracted(list)
      toast.success(`Vision extracted ${list.length} equipment tag(s) from the P&ID`)
    } catch (err) {
      toast.error(err?.response?.data?.error || err.message || 'Vision extraction failed')
    } finally {
      setExtracting(false)
    }
  }, [pdfFile, canAi, provider, apiKey])

  const onRun = useCallback(async () => {
    if (!activeEquipmentList) { toast.warn('Upload and activate an Equipment List first'); return }
    if (hasAttributes && !canAi) {
      toast.warn('Attribute cross-check needs a BYOK API key — running tag-only comparison')
    }
    setLoading(true)
    try {
      const data = await equipmentCrossCheck({
        equipmentTags: finalTags,
        equipmentListId: activeEquipmentList.equipment_list_id,
        useAi: useAi && canAi,
        provider,
        apiKey,
        equipmentAttributes: canAi ? attributesByTag : undefined,
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
  }, [finalTags, activeEquipmentList, useAi, canAi, provider, apiKey, attributesByTag, hasAttributes])

  // Reset stale result when the active list changes
  useEffect(() => { setResult(null); setExpanded(null) }, [activeEquipmentList?.equipment_list_id])

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
          <Boxes size={16} color="#fff" />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: THEME_TEXT }}>
            Cross-check vs Master Equipment List
          </div>
          <div style={{ fontSize: 12, color: THEME_MUTED }}>
            {activeEquipmentList
              ? `Comparing against: ${activeEquipmentList.title || activeEquipmentList.filename} · ${activeEquipmentList.total_rows} items`
              : 'No active Equipment List — upload one on the left.'}
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

        <EquipmentListHistoryPopover
          activeEquipmentList={activeEquipmentList}
          onChange={onEquipmentListChange}
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
            onClick={() => downloadCrossCheckExcel(result, 'equipment_list', {
              contextTitle: activeEquipmentList
                ? (activeEquipmentList.title || activeEquipmentList.filename)
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

      {/* Detected + manual equipment tag inputs */}
      <div style={{
        marginBottom: 14, padding: 12, borderRadius: 10,
        border: `1px solid ${THEME_BORDER}`, background: THEME_BG_SOFT,
      }}>
        {/* Vision extraction — the accurate path */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
          padding: '8px 10px', marginBottom: 10, borderRadius: 8,
          border: `1px solid ${visionExtracted.length ? '#a7f3d0' : THEME_BORDER}`,
          background: visionExtracted.length ? '#ecfdf5' : '#fff',
        }}>
          <Wand2 size={14} color={visionExtracted.length ? '#047857' : THEME_PRIMARY} />
          <div style={{ fontSize: 12, color: THEME_TEXT, minWidth: 0 }}>
            <b>Vision extraction:</b>{' '}
            {visionExtracted.length
              ? <span style={{ color: '#047857' }}>{visionExtracted.length} equipment tag(s) detected on the P&amp;ID</span>
              : <span style={{ color: THEME_MUTED }}>Run a targeted AI pass to pull equipment tags directly from the drawing.</span>}
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

        {visionExtracted.length > 0 && (
          <div style={{
            marginBottom: 10, padding: 8, borderRadius: 8,
            background: '#fff', border: `1px solid ${THEME_BORDER}`,
            fontSize: 11, color: THEME_TEXT, maxHeight: 120, overflow: 'auto',
          }}>
            <div style={{ color: THEME_MUTED, marginBottom: 4, fontSize: 10, letterSpacing: 0.3, textTransform: 'uppercase' }}>
              AI-extracted equipment
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {visionExtracted.map(v => (
                <span key={v.tag} title={v.description || v.kind || ''}
                  style={{
                    padding: '2px 8px', borderRadius: 999, fontSize: 11,
                    background: '#f5f3ff', color: THEME_PRIMARY,
                    border: `1px solid #e9d5ff`,
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                  }}>
                  {v.tag}{v.kind && v.kind !== 'other' ? ` · ${v.kind}` : ''}
                </span>
              ))}
            </div>
          </div>
        )}

        <div style={{ fontSize: 12, color: THEME_MUTED, marginBottom: 6 }}>
          <b style={{ color: THEME_TEXT }}>{detectedTags.length}</b> extra equipment-shaped tag(s) auto-detected from line extraction
          {detectedTags.length > 0 && (
            <span style={{ marginLeft: 8, color: THEME_TEXT, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
              {detectedTags.slice(0, 8).join(', ')}{detectedTags.length > 8 ? ` … +${detectedTags.length - 8}` : ''}
            </span>
          )}
        </div>
        <div style={{ fontSize: 11, color: THEME_MUTED, marginBottom: 6 }}>
          Add extra equipment tags manually (comma / space / newline separated):
        </div>
        <input
          type="text" value={manualInput} onChange={(e) => setManualInput(e.target.value)}
          placeholder="e.g. V-803-TF, P-101A, E-2001"
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
          <SummaryPill label="P&ID tags"       value={s.pid_total ?? 0} />
          <SummaryPill label="Equipment List"  value={s.equipment_list_total ?? 0} />
          <SummaryPill label="Match"           value={s.match ?? 0}          tone="ok" />
          <SummaryPill label="Missing on P&ID" value={s.missing_on_pid ?? 0} tone="err" />
          <SummaryPill label="Extra on P&ID"   value={s.extra_on_pid ?? 0}   tone="warn" />
          <SummaryPill label="Coverage"        value={`${s.coverage_pct ?? 0}%`} tone={
            (s.coverage_pct ?? 0) >= 95 ? 'ok' : (s.coverage_pct ?? 0) >= 75 ? 'warn' : 'err'
          } />
          {(s.attribute_mismatches ?? 0) > 0 && (
            <SummaryPill label="Attr diffs" value={s.attribute_mismatches ?? 0}
              tone={(s.attribute_critical ?? 0) > 0 ? 'err' : 'warn'} />
          )}
          {(s.attribute_critical ?? 0) > 0 && (
            <SummaryPill label="Critical" value={s.attribute_critical} tone="err" />
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
                      {f.description && (
                        <span style={{ color: THEME_MUTED, fontSize: 12 }}>
                          {f.description}
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
                        {f.description && (
                          <div><span style={{ color: THEME_MUTED }}>Description:</span> {f.description}</div>
                        )}
                        {f.pid_no && (
                          <div><span style={{ color: THEME_MUTED }}>P&amp;ID:</span> {f.pid_no}</div>
                        )}
                        {f.moc && (
                          <div><span style={{ color: THEME_MUTED }}>MOC:</span> {f.moc}</div>
                        )}
                        {f.phase && (
                          <div><span style={{ color: THEME_MUTED }}>Phase:</span> {f.phase}</div>
                        )}
                        {f.equipment_list_row && (
                          <div><span style={{ color: THEME_MUTED }}>Excel row:</span> {f.equipment_list_row}</div>
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
          {activeEquipmentList
            ? 'Click "Run cross-check" to compare the equipment tags against the master Equipment List.'
            : 'Upload a master Equipment List (Excel) on the left to enable this cross-check.'}
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
        <span>Equipment List</span>
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
