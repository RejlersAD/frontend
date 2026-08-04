import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'react-toastify'
import {
  GitCompare, Loader2, Sparkles, Download,
  CheckCircle2, AlertTriangle, XCircle, PlusCircle, ChevronDown, ChevronRight,
} from 'lucide-react'

import { crossCheck } from '../../../../services/pidCheckerV2API'
import LineListHistoryPopover from './LineListHistoryPopover'
import { downloadCrossCheckExcel } from './crossCheckExcelExport'

// ─── Soft-coded theme (matches parent) ─────────────────────────────
const THEME_PRIMARY = '#7c3aed'
const THEME_ACCENT = '#ec4899'
const THEME_TEXT = '#0f172a'
const THEME_MUTED = '#64748b'
const THEME_BORDER = '#e2e8f0'
const THEME_BG_SOFT = '#f8fafc'
const THEME_GRADIENT = `linear-gradient(135deg, ${THEME_PRIMARY} 0%, ${THEME_ACCENT} 100%)`

// Backend finding kinds (mirror line_list_cross_check.py)
const K_MATCH        = 'match'
const K_MISSING      = 'missing_on_pid'
const K_EXTRA        = 'extra_on_pid'
const K_MISMATCH     = 'mismatch'

const KIND_META = {
  [K_MATCH]:    { label: 'Match',            colour: '#047857', bg: '#ecfdf5', border: '#a7f3d0', Icon: CheckCircle2 },
  [K_MISSING]:  { label: 'Missing on P&ID',  colour: '#b91c1c', bg: '#fef2f2', border: '#fecaca', Icon: XCircle },
  [K_EXTRA]:    { label: 'Extra on P&ID',    colour: '#b45309', bg: '#fffbeb', border: '#fcd34d', Icon: PlusCircle },
  [K_MISMATCH]: { label: 'Mismatch',         colour: '#b91c1c', bg: '#fef2f2', border: '#fecaca', Icon: AlertTriangle },
}

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: K_MISSING,  label: 'Missing on P&ID' },
  { id: K_EXTRA,    label: 'Extra on P&ID' },
  { id: K_MISMATCH, label: 'Mismatch' },
  { id: K_MATCH,    label: 'Match' },
]

/**
 * CrossCheckPanel
 *
 * Compares extracted P&ID tags against the active master Line List and,
 * optionally, asks the configured AI provider to correlate MISSING vs
 * EXTRA entries (typos / renumbering).
 *
 * Props:
 *   tags            — array of tag dicts from the extraction result
 *   activeLineList  — the currently-active Line List or null
 *   provider        — BYOK provider id (openai|claude) or null
 *   apiKey          — BYOK api key or null
 *   onLineListChange — called after activate / delete inside the popover
 */
export default function CrossCheckPanel({ tags, activeLineList, provider, apiKey, onLineListChange, onResultChange }) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [useAi, setUseAi] = useState(true)
  const [filter, setFilter] = useState('all')
  const [expanded, setExpanded] = useState(null)

  const canAi = Boolean(provider && apiKey)
  const hasTags = Array.isArray(tags) && tags.length > 0
  const disabled = loading || !hasTags || !activeLineList

  const onRun = useCallback(async () => {
    if (!hasTags) { toast.warn('No P&ID tags to cross-check'); return }
    if (!activeLineList) { toast.warn('Upload and activate a Line List first'); return }
    setLoading(true)
    try {
      const data = await crossCheck({
        tags,
        lineListId: activeLineList.line_list_id,
        useAi: useAi && canAi,
        provider,
        apiKey,
      })
      setResult(data)
      const s = data.summary || {}
      toast.success(
        `Cross-check: ${s.match || 0} match · ${s.missing_on_pid || 0} missing · `
        + `${s.extra_on_pid || 0} extra · ${s.mismatch || 0} mismatch`
      )
    } catch (err) {
      toast.error(err?.response?.data?.error || err.message || 'Cross-check failed')
    } finally {
      setLoading(false)
    }
  }, [tags, activeLineList, useAi, canAi, provider, apiKey, hasTags])

  // Bubble the latest cross-check result up so the parent can build a combined workbook
  useEffect(() => { if (typeof onResultChange === 'function') onResultChange(result) }, [result, onResultChange])

  const findings = result?.findings || []
  const filtered = useMemo(() => {
    if (filter === 'all') return findings
    return findings.filter(f => f.kind === filter)
  }, [findings, filter])

  const s = result?.summary || {}

  return (
    <div style={{
      background: '#fff', border: `1px solid ${THEME_BORDER}`, borderRadius: 12,
      padding: 20, marginTop: 20,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: THEME_GRADIENT, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <GitCompare size={16} color="#fff" />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: THEME_TEXT }}>
            Cross-check vs Master Line List
          </div>
          <div style={{ fontSize: 12, color: THEME_MUTED }}>
            {activeLineList
              ? `Comparing against: ${activeLineList.title || activeLineList.filename} · ${activeLineList.total_rows} lines`
              : 'No active Line List — upload one above.'}
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

        <LineListHistoryPopover
          activeLineList={activeLineList}
          onChange={onLineListChange}
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
            onClick={() => downloadCrossCheckExcel(result, 'line_list', {
              contextTitle: activeLineList
                ? (activeLineList.title || activeLineList.filename)
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

      {/* Summary pills */}
      {result && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
          <SummaryPill label="P&ID tags"     value={s.pid_total ?? 0} />
          <SummaryPill label="Line List"     value={s.line_list_total ?? 0} />
          <SummaryPill label="Match"         value={s.match ?? 0}         tone="ok" />
          <SummaryPill label="Missing on P&ID" value={s.missing_on_pid ?? 0} tone="err" />
          <SummaryPill label="Extra on P&ID"   value={s.extra_on_pid ?? 0}   tone="warn" />
          <SummaryPill label="Mismatch"      value={s.mismatch ?? 0}      tone="err" />
          <SummaryPill label="Coverage"      value={`${s.coverage_pct ?? 0}%`} tone={
            (s.coverage_pct ?? 0) >= 95 ? 'ok' : (s.coverage_pct ?? 0) >= 75 ? 'warn' : 'err'
          } />
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
                const meta = KIND_META[f.kind] || KIND_META[K_MISMATCH]
                const key = `${f.kind}::${f.tag || f.expected_tag || idx}`
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
                        {f.tag || f.expected_tag || '(no tag)'}
                      </span>
                      <span style={{
                        padding: '2px 8px', borderRadius: 999, fontSize: 11,
                        background: '#fff', color: meta.colour,
                        border: `1px solid ${meta.border}`,
                      }}>
                        {meta.label}
                      </span>
                      <span style={{ marginLeft: 'auto', color: THEME_MUTED, fontSize: 12 }}>
                        {f.message || ''}
                      </span>
                      {isOpen ? <ChevronDown size={14} color={THEME_MUTED} /> : <ChevronRight size={14} color={THEME_MUTED} />}
                    </button>

                    {isOpen && (
                      <div style={{
                        padding: '4px 14px 12px 40px', fontSize: 12, color: THEME_TEXT,
                        display: 'grid', gap: 4,
                      }}>
                        {f.details && Object.entries(f.details).map(([k, v]) => (
                          <div key={k}>
                            <span style={{ color: THEME_MUTED }}>{k}:</span>{' '}
                            <span>{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
                          </div>
                        ))}
                        {f.ai_suggested_match && (
                          <div style={{
                            marginTop: 6, padding: '6px 10px', borderRadius: 8,
                            background: '#faf5ff', border: `1px solid ${THEME_PRIMARY}`,
                            display: 'flex', alignItems: 'center', gap: 6,
                          }}>
                            <Sparkles size={12} color={THEME_PRIMARY} />
                            <span style={{ color: THEME_PRIMARY, fontWeight: 600 }}>
                              AI suggests → {f.ai_suggested_match}
                            </span>
                            {typeof f.ai_confidence === 'number' && (
                              <span style={{ color: THEME_MUTED }}>
                                ({Math.round(f.ai_confidence * 100)}% confidence)
                              </span>
                            )}
                            {f.ai_reason && (
                              <span style={{ color: THEME_MUTED, marginLeft: 4 }}>— {f.ai_reason}</span>
                            )}
                          </div>
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
          {activeLineList
            ? 'Click "Run cross-check" to compare the extracted tags against the master Line List.'
            : 'Upload a master Line List (Excel) above to enable this cross-check.'}
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
