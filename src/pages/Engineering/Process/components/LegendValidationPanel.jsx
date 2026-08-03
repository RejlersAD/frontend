import React, { useCallback, useMemo, useState } from 'react'
import { toast } from 'react-toastify'
import {
  ShieldCheck, Loader2, Sparkles,
  CheckCircle2, AlertTriangle, XCircle, ChevronDown, ChevronRight,
} from 'lucide-react'

import { validateLineTags } from '../../../../services/pidCheckerV2API'

// ─── Soft-coded theme (matches parent) ─────────────────────────────
const THEME_PRIMARY = '#7c3aed'
const THEME_ACCENT = '#ec4899'
const THEME_TEXT = '#0f172a'
const THEME_MUTED = '#64748b'
const THEME_BORDER = '#e2e8f0'
const THEME_BG_SOFT = '#f8fafc'
const THEME_GRADIENT = `linear-gradient(135deg, ${THEME_PRIMARY} 0%, ${THEME_ACCENT} 100%)`

const SEVERITY_OK = 'ok'
const SEVERITY_WARNING = 'warning'
const SEVERITY_ERROR = 'error'
const FILTERS = [
  { id: 'all', label: 'All' },
  { id: SEVERITY_ERROR, label: 'Errors' },
  { id: SEVERITY_WARNING, label: 'Warnings' },
  { id: SEVERITY_OK, label: 'Valid' },
]

const LEGEND_SOURCE_LABELS = {
  explicit: 'chosen',
  active:   'active',
  latest:   'most-recent',
  default:  'built-in default',
}

/**
 * LegendValidationPanel
 *
 * Compares extracted tags against the currently-active Legend Sheet and,
 * optionally, asks the configured AI provider to diagnose the failing
 * ones in plain English.
 *
 * Props:
 *   tags          — array of {tag, ...} from the extraction result
 *   activeLegend  — the currently-active legend or null
 *   provider      — BYOK provider id (openai|claude) or null
 *   apiKey        — BYOK api key or null
 *   section       — legend section (default 'line_list')
 */
export default function LegendValidationPanel({ tags, activeLegend, provider, apiKey, section = 'line_list' }) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [useAi, setUseAi] = useState(true)
  const [filter, setFilter] = useState('all')
  const [expandedTag, setExpandedTag] = useState(null)

  const canAi = Boolean(provider && apiKey)
  const hasTags = Array.isArray(tags) && tags.length > 0
  // Smart mode: even without an activated legend, the backend falls back
  // to the user's latest legend or the built-in default. So the button
  // is enabled whenever we have tags.
  const disabled = loading || !hasTags

  const onRun = useCallback(async () => {
    if (!hasTags) { toast.warn('No tags to validate'); return }
    setLoading(true)
    try {
      const data = await validateLineTags({
        tags,
        section,
        // Only pin the legend when the parent explicitly has one active.
        legendId: activeLegend?.legend_id,
        useAi: useAi && canAi,
        provider,
        apiKey,
      })
      setResult(data)
      const s = data.summary || {}
      const src = LEGEND_SOURCE_LABELS[data.legend_source] || ''
      toast.success(
        `Validated with ${data.legend_name || 'legend'}${src ? ` (${src})` : ''} — ` +
        `${s.ok || 0} OK, ${s.warnings || 0} warn, ${s.errors || 0} err`
      )
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || 'Validation failed'
      toast.error(String(msg))
    } finally {
      setLoading(false)
    }
  }, [activeLegend, hasTags, tags, section, useAi, canAi, provider, apiKey])

  const filteredFindings = useMemo(() => {
    if (!result?.findings) return []
    if (filter === 'all') return result.findings
    return result.findings.filter(f => f.severity === filter)
  }, [result, filter])

  return (
    <div style={{
      background: '#fff', border: `1px solid ${THEME_BORDER}`, borderRadius: 12,
      padding: 20, marginTop: 20,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <ShieldCheck size={20} color={THEME_PRIMARY} />
        <div style={{ fontSize: 15, fontWeight: 700, color: THEME_TEXT }}>
          Legend Compliance Check
        </div>
        <div style={{ fontSize: 12, color: THEME_MUTED }}>
          Compare extracted tags against the active legend and let AI diagnose failures.
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <label
            title={canAi ? 'Use AI to explain each failure' : 'Enter your BYOK Vision key to enable AI diagnosis'}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, fontSize: 12,
              color: canAi ? THEME_TEXT : THEME_MUTED,
              cursor: canAi ? 'pointer' : 'not-allowed',
            }}
          >
            <input
              type="checkbox"
              checked={useAi && canAi}
              disabled={!canAi}
              onChange={(e) => setUseAi(e.target.checked)}
            />
            <Sparkles size={13} /> Use AI diagnosis
          </label>
          <button
            type="button" onClick={onRun} disabled={disabled}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '9px 16px', borderRadius: 10, border: 'none',
              background: disabled ? '#cbd5e1' : THEME_GRADIENT,
              color: '#fff', fontWeight: 600, fontSize: 13,
              cursor: disabled ? 'not-allowed' : 'pointer',
              boxShadow: disabled ? 'none' : '0 4px 12px rgba(124,58,237,0.30)',
            }}
          >
            {loading
              ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Analysing…</>
              : <><ShieldCheck size={14} /> Validate against Legend</>}
          </button>
        </div>
      </div>

      {/* Pre-run help */}
      {!result && !loading && (
        <div style={{
          padding: 10, borderRadius: 8, border: `1px dashed ${THEME_BORDER}`,
          fontSize: 12, color: THEME_MUTED, background: THEME_BG_SOFT,
        }}>
          {activeLegend ? (
            <>Ready to validate <b>{tags?.length ?? 0}</b> tag(s) against the active legend <b>{activeLegend.name}</b>.</>
          ) : (
            <>Ready to validate <b>{tags?.length ?? 0}</b> tag(s). No legend is activated for this section — will auto-fall back to your most-recent legend or the built-in default template.</>
          )}
        </div>
      )}

      {/* Post-run: which legend was used */}
      {result?.legend_name && (
        <div style={{
          padding: '8px 12px', borderRadius: 8, marginBottom: 12,
          border: `1px solid ${result.legend_source === 'default' ? '#fcd34d' : '#a7f3d0'}`,
          background: result.legend_source === 'default' ? '#fffbeb' : '#ecfdf5',
          color: result.legend_source === 'default' ? '#b45309' : '#047857',
          fontSize: 12, display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <ShieldCheck size={13} />
          Compared against <b>{result.legend_name}</b>
          <span style={{ opacity: 0.75 }}>({LEGEND_SOURCE_LABELS[result.legend_source] || 'legend'})</span>
        </div>
      )}

      {/* Summary */}
      {result?.summary && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
          <SummaryPill icon={CheckCircle2} label="Valid" value={result.summary.ok} color="#047857" bg="#ecfdf5" border="#a7f3d0" />
          <SummaryPill icon={AlertTriangle} label="Warnings" value={result.summary.warnings} color="#b45309" bg="#fffbeb" border="#fcd34d" />
          <SummaryPill icon={XCircle} label="Errors" value={result.summary.errors} color="#b91c1c" bg="#fef2f2" border="#fecaca" />
          <div style={{
            padding: '8px 14px', borderRadius: 8, border: `1px solid ${THEME_BORDER}`,
            background: '#fff', fontSize: 12, color: THEME_MUTED,
          }}>
            Compliance: <b style={{ color: THEME_TEXT }}>{result.summary.valid_pct}%</b> of {result.summary.total}
            {result.ai_used && (
              <span style={{ marginLeft: 8, color: THEME_PRIMARY, fontWeight: 600 }}>
                <Sparkles size={11} style={{ verticalAlign: -1 }} /> AI diagnosis included
              </span>
            )}
          </div>
        </div>
      )}

      {/* Filter tabs */}
      {result && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
          {FILTERS.map(f => {
            const isActive = filter === f.id
            const count = f.id === 'all' ? result.findings.length
              : result.findings.filter(x => x.severity === f.id).length
            return (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                style={{
                  padding: '5px 10px', borderRadius: 999, fontSize: 12, cursor: 'pointer',
                  border: `1px solid ${isActive ? THEME_PRIMARY : THEME_BORDER}`,
                  background: isActive ? '#faf5ff' : '#fff',
                  color: isActive ? THEME_PRIMARY : THEME_TEXT, fontWeight: isActive ? 600 : 400,
                }}
              >
                {f.label} <span style={{ opacity: 0.6, marginLeft: 3 }}>({count})</span>
              </button>
            )
          })}
        </div>
      )}

      {/* Findings list */}
      {result && filteredFindings.length === 0 && (
        <div style={{ padding: 20, textAlign: 'center', color: THEME_MUTED, fontSize: 13 }}>
          No findings in this category.
        </div>
      )}

      {filteredFindings.map((f) => {
        const isExpanded = expandedTag === f.tag
        const styles = severityStyles(f.severity)
        return (
          <div key={f.tag || Math.random()}
            style={{
              border: `1px solid ${styles.border}`, borderRadius: 10, marginBottom: 8,
              background: '#fff', overflow: 'hidden',
            }}>
            <div
              onClick={() => setExpandedTag(isExpanded ? null : f.tag)}
              style={{
                padding: '10px 12px', display: 'flex', gap: 10, alignItems: 'center',
                cursor: 'pointer', background: styles.bg,
              }}>
              {isExpanded
                ? <ChevronDown size={14} color={styles.color} />
                : <ChevronRight size={14} color={styles.color} />}
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '2px 8px', borderRadius: 999, fontSize: 11,
                background: '#fff', color: styles.color, border: `1px solid ${styles.border}`,
                fontWeight: 600, textTransform: 'uppercase',
              }}>
                <styles.Icon size={11} /> {f.severity}
              </span>
              <code style={{
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                fontSize: 13, color: THEME_TEXT, fontWeight: 600,
              }}>
                {f.tag || '(empty)'}
              </code>
              <span style={{ color: THEME_MUTED, fontSize: 12, flex: 1, minWidth: 0,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {f.message}
              </span>
              {f.ai_suggestion && (
                <span style={{
                  padding: '2px 8px', borderRadius: 999, fontSize: 11,
                  background: '#faf5ff', color: THEME_PRIMARY, border: `1px solid ${THEME_PRIMARY}`,
                  fontWeight: 600, whiteSpace: 'nowrap',
                }}>
                  <Sparkles size={10} /> Suggested: {f.ai_suggestion}
                </span>
              )}
            </div>
            {isExpanded && (
              <div style={{ padding: 14, borderTop: `1px solid ${THEME_BORDER}` }}>
                {/* Per-field breakdown */}
                {Array.isArray(f.field_findings) && f.field_findings.length > 0 && (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: THEME_BG_SOFT }}>
                        <Th>Field</Th>
                        <Th>Value</Th>
                        <Th>Resolved</Th>
                        <Th>Status</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {f.field_findings.map((ff, i) => (
                        <tr key={i} style={{ borderTop: `1px solid ${THEME_BORDER}` }}>
                          <Td>{ff.label}</Td>
                          <Td mono>{ff.value || <span style={{ color: THEME_MUTED }}>—</span>}</Td>
                          <Td>{ff.resolved_label || <span style={{ color: THEME_MUTED }}>—</span>}</Td>
                          <Td>
                            {ff.ok ? (
                              <span style={{ color: '#047857', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                <CheckCircle2 size={12} /> OK
                              </span>
                            ) : (
                              <span style={{ color: '#b91c1c' }}>{ff.problem || 'Invalid'}</span>
                            )}
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {/* AI section */}
                {(f.ai_diagnosis || f.ai_suggestion) && (
                  <div style={{
                    marginTop: 12, padding: 10, borderRadius: 8,
                    background: '#faf5ff', border: `1px solid ${THEME_PRIMARY}`,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <Sparkles size={13} color={THEME_PRIMARY} />
                      <span style={{ fontSize: 12, fontWeight: 700, color: THEME_PRIMARY }}>
                        AI diagnosis
                      </span>
                      {f.ai_confidence && (
                        <span style={{
                          marginLeft: 'auto', fontSize: 10, padding: '1px 6px',
                          borderRadius: 999, background: '#fff', color: THEME_PRIMARY,
                          border: `1px solid ${THEME_PRIMARY}`, textTransform: 'uppercase',
                        }}>
                          {f.ai_confidence} confidence
                        </span>
                      )}
                    </div>
                    {f.ai_diagnosis && (
                      <div style={{ fontSize: 12, color: THEME_TEXT, marginBottom: 6 }}>
                        {f.ai_diagnosis}
                      </div>
                    )}
                    {f.ai_suggestion && (
                      <div style={{ fontSize: 12, color: THEME_TEXT }}>
                        Suggested correction:&nbsp;
                        <code style={{
                          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                          fontSize: 12, fontWeight: 600, background: '#fff', padding: '2px 6px',
                          borderRadius: 4, border: `1px solid ${THEME_BORDER}`,
                        }}>
                          {f.ai_suggestion}
                        </code>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}


// ─── Sub-components ──────────────────────────────────────────────────
function SummaryPill({ icon: Icon, label, value, color, bg, border }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '8px 14px', borderRadius: 8,
      background: bg, border: `1px solid ${border}`, color,
    }}>
      <Icon size={14} />
      <span style={{ fontSize: 12, fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 16, fontWeight: 700 }}>{value ?? 0}</span>
    </div>
  )
}

function Th({ children }) {
  return (
    <th style={{
      padding: '6px 8px', textAlign: 'left', fontSize: 11,
      color: THEME_MUTED, fontWeight: 600, textTransform: 'uppercase',
    }}>{children}</th>
  )
}
function Td({ children, mono }) {
  return (
    <td style={{
      padding: '6px 8px', color: THEME_TEXT, fontSize: 12,
      fontFamily: mono ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : 'inherit',
    }}>{children}</td>
  )
}

function severityStyles(sev) {
  if (sev === SEVERITY_OK)      return { color: '#047857', bg: '#ecfdf5', border: '#a7f3d0', Icon: CheckCircle2 }
  if (sev === SEVERITY_WARNING) return { color: '#b45309', bg: '#fffbeb', border: '#fcd34d', Icon: AlertTriangle }
  return { color: '#b91c1c', bg: '#fef2f2', border: '#fecaca', Icon: XCircle }
}
