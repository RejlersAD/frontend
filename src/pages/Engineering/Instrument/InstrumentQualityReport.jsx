/**
 * InstrumentQualityReport
 * ────────────────────────────────────────────────────────────────────────────
 * Sophisticated, soft-coded quality report block — modelled after the look &
 * feel of the P&ID Verification report (Process › PID Verification) and
 * tailored to the Instrument Tools (IO List / Cable Block / Cable Schedule).
 *
 * Consumes the already-existing QC payload from the backend:
 *   • result.summary  → { total_rows, errors, warnings, pass }
 *   • result.issues[] → { row, field, severity, message, value,
 *                          explanation?, suggested_fix?, rule_id?, category? }
 *   • result.ai       → { header_confidence, header_method, tag_pattern,
 *                          unmapped_headers, cabinet_utilisation,
 *                          loop_expansion, anomaly, ... }
 *
 * Every threshold, weight, label, color and section toggle is soft-coded at
 * the top of this file. No core data/logic is duplicated from the backend —
 * we only derive presentation views.
 */
import { Fragment, useMemo, useState } from 'react'
import {
  CheckBadgeIcon,
  ExclamationTriangleIcon,
  ExclamationCircleIcon,
  InformationCircleIcon,
  ShieldCheckIcon,
  ChartBarIcon,
  SparklesIcon,
  CpuChipIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ClipboardDocumentCheckIcon,
  ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/outline'

// ─────────────────────────────────────────────────────────────────────────────
// SOFT-CODED CONFIG — single source of truth for the whole report.
// ─────────────────────────────────────────────────────────────────────────────

// QC overall score weights (must sum to 1.0).
//   errorPenalty  — each error subtracts this fraction (× error count / rows)
//   warningPenalty— each warning subtracts this fraction (× warn count / rows)
//   aiConfBoost   — fraction of the score derived from AI header confidence
const QC_SCORE_WEIGHTS = { errorPenalty: 0.65, warningPenalty: 0.20, aiConfBoost: 0.15 }

// Score breakpoints (0–100). Anything below 'moderate' is rendered red.
const QC_SCORE_THRESHOLDS = { high: 85, moderate: 60 }

// Severity styling — drives pills, dots, bars, banner gradients.
const SEVERITY_META = {
  error:   { label: 'Error',   color: '#dc2626', light: '#fef2f2', border: '#fecaca', dot: 'bg-red-500',    pill: 'bg-red-100 text-red-800 border-red-200',     icon: ExclamationCircleIcon },
  warning: { label: 'Warning', color: '#f59e0b', light: '#fffbeb', border: '#fde68a', dot: 'bg-amber-400',  pill: 'bg-amber-100 text-amber-800 border-amber-200', icon: ExclamationTriangleIcon },
  info:    { label: 'Info',    color: '#3b82f6', light: '#eff6ff', border: '#bfdbfe', dot: 'bg-blue-400',   pill: 'bg-blue-100 text-blue-800 border-blue-200',  icon: InformationCircleIcon },
}
const SEVERITY_ORDER = ['error', 'warning', 'info']
const SEVERITY_RANK  = { error: 3, warning: 2, info: 1 }

// Field → category friendly grouping.  Add prefixes here to auto-classify
// new issue fields without touching any rule logic.
const FIELD_CATEGORY_RULES = [
  { match: /^tag$|tag_no|tag_number/i,                 label: 'Tag / Identifier' },
  { match: /service|description/i,                     label: 'Service / Description' },
  { match: /signal|io_type|io_kind|loop/i,             label: 'Signal & Loop' },
  { match: /cabinet|panel|rack|slot|channel|address/i, label: 'Cabinet / Channel' },
  { match: /cable|core|conductor|gland|drum/i,         label: 'Cable & Conductor' },
  { match: /range|alarm|trip|set|unit|eu/i,            label: 'Range / Alarm / Units' },
  { match: /location|area|zone|hazardous/i,            label: 'Location / Area' },
  { match: /power|24v|loop_power|supply/i,             label: 'Power Supply' },
]
const FIELD_CATEGORY_FALLBACK = 'General'

// Top-N caps for the leaderboards.
const TOP_FIELDS_COUNT   = 8
const TOP_RULES_COUNT    = 8
const TOP_CATS_COUNT     = 6
const MAX_FINDING_PREVIEW = 500

// Animation timing (kept consistent with the parent hub).
const _FADE_KEYFRAMES = `
  @keyframes iqrFadeUp { from { opacity:0; transform:translateY(10px) } to { opacity:1; transform:translateY(0) } }
  @keyframes iqrGrowBar { from { transform:scaleX(0); transform-origin:left } to { transform:scaleX(1); transform-origin:left } }
  @keyframes iqrPulse  { 0%,100% { opacity:1 } 50% { opacity:.55 } }
`

// ─────────────────────────────────────────────────────────────────────────────
// Pure helpers
// ─────────────────────────────────────────────────────────────────────────────

function _classifyField(field) {
  const f = String(field || '')
  for (const rule of FIELD_CATEGORY_RULES) {
    if (rule.match.test(f)) return rule.label
  }
  return FIELD_CATEGORY_FALLBACK
}

function _clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)) }

// Safe stringifier — some backend AI fields (e.g. header_method, tag_pattern.label)
// can legitimately be objects/arrays. Never let React try to render one directly.
function _str(v, fallback = '') {
  if (v == null) return fallback
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v)
  if (Array.isArray(v)) return v.map(x => _str(x)).filter(Boolean).join(', ') || fallback
  if (typeof v === 'object') {
    // Prefer common label-ish keys before falling back to JSON.
    for (const k of ['label', 'name', 'value', 'method', 'pattern', 'text']) {
      if (v[k] != null && (typeof v[k] === 'string' || typeof v[k] === 'number')) return String(v[k])
    }
    try {
      const j = JSON.stringify(v)
      return (j && j !== '{}') ? j : fallback
    } catch { return fallback }
  }
  return String(v)
}

function _scoreQuality(score) {
  if (score == null) return { color: '#94a3b8', label: 'No data' }
  if (score >= QC_SCORE_THRESHOLDS.high)     return { color: '#10b981', label: 'High'     }
  if (score >= QC_SCORE_THRESHOLDS.moderate) return { color: '#f59e0b', label: 'Moderate' }
  return { color: '#ef4444', label: 'Low' }
}

// Compute the overall QC score (0–100) from the existing summary + AI meta.
// Soft-coded weights — adjust QC_SCORE_WEIGHTS to retune.
function _computeQcScore(summary, ai) {
  const rows = Math.max(1, summary?.total_rows || 0)
  const errors   = summary?.errors   || 0
  const warnings = summary?.warnings || 0
  const errorRatio = _clamp(errors   / rows, 0, 1)
  const warnRatio  = _clamp(warnings / rows, 0, 1)
  const aiConf     = _clamp(ai?.header_confidence || 0, 0, 1)
  const base = 1
    - QC_SCORE_WEIGHTS.errorPenalty   * errorRatio
    - QC_SCORE_WEIGHTS.warningPenalty * warnRatio
  // AI confidence pulls a small fraction of the score up regardless of errors.
  const blended = base * (1 - QC_SCORE_WEIGHTS.aiConfBoost)
                + aiConf * QC_SCORE_WEIGHTS.aiConfBoost
  return Math.round(_clamp(blended, 0, 1) * 100)
}

// Half-circle gauge — purely cosmetic.
function GaugeArc({ pct, color, size = 90 }) {
  const r = (size / 90) * 36
  const w = size
  const h = (size / 90) * 52
  const circ = Math.PI * r
  const dash = pct != null ? (pct / 100) * circ : 0
  const cx = w / 2
  const cy = h - (size / 90) * 6
  const startX = cx - r
  const startY = cy
  const endX = cx + r
  const endY = cy
  const arc = `M${startX},${startY} A${r},${r} 0 0,1 ${endX},${endY}`
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <path d={arc} fill="none" stroke="#e2e8f0" strokeWidth={(size / 90) * 8} strokeLinecap="round" />
      <path
        d={arc} fill="none" stroke={color}
        strokeWidth={(size / 90) * 8}
        strokeLinecap="round"
        strokeDasharray={`${dash} ${circ}`}
        style={{ transition: 'stroke-dasharray 0.9s ease' }}
      />
    </svg>
  )
}

function Bar({ value, max, color, height = '6px' }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div style={{ height, borderRadius: '4px', background: '#f1f5f9', overflow: 'hidden', flex: 1 }}>
      <div
        style={{
          height: '100%',
          width:  `${pct}%`,
          background: color,
          borderRadius: '4px',
          transformOrigin: 'left',
          animation: 'iqrGrowBar 0.65s ease-out both',
          transition: 'width 0.4s ease',
        }}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function InstrumentQualityReport({ result, tool, accent }) {
  const summary = result?.summary || {}
  const issues  = result?.issues  || []
  const ai      = result?.ai      || null

  const totalRows = summary.total_rows || 0
  const errors    = summary.errors   || 0
  const warnings  = summary.warnings || 0
  const pass      = !!summary.pass

  // ── Soft-derived metrics ──────────────────────────────────────────────────
  const qcScore = useMemo(() => _computeQcScore(summary, ai), [summary, ai])
  const qcQual  = _scoreQuality(qcScore)

  // Severity breakdown
  const sevCount = useMemo(() => {
    const out = { error: 0, warning: 0, info: 0 }
    for (const it of issues) {
      const s = (it.severity || 'info').toLowerCase()
      out[s] = (out[s] || 0) + 1
    }
    return out
  }, [issues])

  // Category breakdown (by field-prefix classifier)
  const catList = useMemo(() => {
    const acc = {}
    for (const it of issues) {
      const cat = it.category || _classifyField(it.field)
      acc[cat] = (acc[cat] || 0) + 1
    }
    return Object.entries(acc).sort((a, b) => b[1] - a[1]).slice(0, TOP_CATS_COUNT)
  }, [issues])

  // Field leaderboard
  const fieldList = useMemo(() => {
    const acc = {}
    for (const it of issues) {
      const f = it.field || '—'
      acc[f] = (acc[f] || 0) + 1
    }
    return Object.entries(acc).sort((a, b) => b[1] - a[1]).slice(0, TOP_FIELDS_COUNT)
  }, [issues])

  // Rule leaderboard (only if rule_id is present in issues)
  const ruleList = useMemo(() => {
    const acc = {}
    for (const it of issues) {
      const r = it.rule_id
      if (!r) continue
      acc[r] = (acc[r] || 0) + 1
    }
    return Object.entries(acc).sort((a, b) => b[1] - a[1]).slice(0, TOP_RULES_COUNT)
  }, [issues])

  // ── Filters ──────────────────────────────────────────────────────────────
  const [search,      setSearch]      = useState('')
  const [sevFilter,   setSevFilter]   = useState('all')
  const [catFilter,   setCatFilter]   = useState('all')
  const [expandedIdx, setExpandedIdx] = useState(null)
  const q = search.trim().toLowerCase()

  const filteredIssues = useMemo(() => {
    return issues.filter((it) => {
      if (sevFilter !== 'all' && (it.severity || 'info').toLowerCase() !== sevFilter) return false
      if (catFilter !== 'all' && (it.category || _classifyField(it.field)) !== catFilter) return false
      if (q) {
        const hay = `${it.field || ''} ${it.message || ''} ${it.value || ''} ${it.rule_id || ''} ${it.explanation || ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [issues, q, sevFilter, catFilter])

  // ── Render ────────────────────────────────────────────────────────────────
  const aiConfPct = ai?.header_confidence != null ? Math.round(ai.header_confidence * 100) : null
  const passBanner = pass
    ? { bg: 'linear-gradient(135deg,#dcfce7,#bbf7d0)', border: '#86efac', color: '#15803d', icon: CheckBadgeIcon, text: 'PASS — no blocking errors' }
    : { bg: 'linear-gradient(135deg,#fee2e2,#fecaca)', border: '#fca5a5', color: '#b91c1c', icon: ExclamationTriangleIcon, text: 'FAIL — review findings before release' }

  return (
    <div className="mt-6 space-y-4" style={{ animation: 'iqrFadeUp 0.45s ease-out both' }}>
      <style>{_FADE_KEYFRAMES}</style>

      {/* ══ Section 1: Hero score card ══ */}
      <div
        className="rounded-2xl overflow-hidden bg-white shadow-lg"
        style={{ border: `1.5px solid ${qcQual.color}40`, boxShadow: `0 8px 28px ${qcQual.color}1a` }}
      >
        <div
          className="px-6 py-5 flex items-center gap-5 flex-wrap"
          style={{ background: `linear-gradient(135deg, ${qcQual.color}14, ${qcQual.color}06)` }}
        >
          {/* Big gauge */}
          <div className="flex flex-col items-center justify-center shrink-0" style={{ minWidth: 110 }}>
            <GaugeArc pct={qcScore} color={qcQual.color} size={110} />
            <p className="text-3xl font-black -mt-4" style={{ color: qcQual.color }}>{qcScore}%</p>
            <span
              className="text-[10px] font-black px-2 py-0.5 rounded-full mt-0.5"
              style={{ background: `${qcQual.color}20`, color: qcQual.color }}
            >
              {qcQual.label} Quality
            </span>
          </div>

          {/* Title block */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <ShieldCheckIcon className="h-5 w-5 text-slate-700" />
              <h2 className="text-lg font-extrabold text-slate-900">{tool?.title || 'Quality Report'}</h2>
              <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-500">
                QC v1
              </span>
            </div>
            <p className="text-xs text-slate-600 max-w-2xl">
              Composite score blends error and warning ratios against total rows, weighted by AI header-mapping confidence.
              Adjust thresholds in <code className="font-mono text-[10px] bg-white px-1 rounded border border-slate-200">QC_SCORE_WEIGHTS</code> to retune.
            </p>

            {/* Pass / Fail banner */}
            <div
              className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-bold"
              style={{ background: passBanner.bg, borderColor: passBanner.border, color: passBanner.color }}
            >
              <passBanner.icon className="h-4 w-4" />
              {passBanner.text}
            </div>
          </div>

          {/* Score pills */}
          <div className="flex flex-col gap-1.5">
            {[
              { label: 'Rows',     val: totalRows, color: '#0f172a' },
              { label: 'Errors',   val: errors,    color: SEVERITY_META.error.color },
              { label: 'Warnings', val: warnings,  color: SEVERITY_META.warning.color },
              { label: 'AI Conf.', val: aiConfPct != null ? `${aiConfPct}%` : '—', color: '#7c3aed' },
            ].map(p => (
              <div
                key={p.label}
                className="flex items-center justify-between gap-3 px-3 py-1.5 rounded-lg bg-white"
                style={{ border: '1px solid #e2e8f0', minWidth: 150 }}
              >
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{p.label}</span>
                <span className="text-sm font-black" style={{ color: p.color }}>{p.val}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══ Section 2: Score gauges row (3 sub-scores) ══ */}
      <div className="rounded-2xl overflow-hidden bg-white shadow-sm border border-slate-200">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2 bg-gradient-to-r from-slate-50 to-white">
          <ChartBarIcon className="h-4 w-4 text-slate-500" />
          <p className="text-sm font-bold text-slate-800">Quality Sub-Scores</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
          {(() => {
            const errorScore = totalRows === 0 ? null : Math.round((1 - _clamp(errors / Math.max(1, totalRows), 0, 1)) * 100)
            const warnScore  = totalRows === 0 ? null : Math.round((1 - _clamp(warnings / Math.max(1, totalRows), 0, 1)) * 100)
            const aiScore    = aiConfPct
            const cards = [
              { label: 'Error-Free Rate',   pct: errorScore, sub: `${totalRows - errors}/${totalRows} rows clean` },
              { label: 'Warning-Free Rate', pct: warnScore,  sub: `${totalRows - warnings}/${totalRows} rows w/o warnings` },
              { label: 'AI Header Confidence', pct: aiScore, sub: _str(ai?.header_method, 'No AI mapping') },
            ]
            return cards.map((c, i) => {
              const q = _scoreQuality(c.pct)
              return (
                <div key={i} className="px-4 py-4 flex flex-col items-center gap-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{c.label}</p>
                  <GaugeArc pct={c.pct} color={q.color} />
                  <p className="text-xl font-black -mt-3" style={{ color: q.color }}>
                    {c.pct != null ? `${c.pct}%` : '—'}
                  </p>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${q.color}18`, color: q.color }}>
                    {q.label}
                  </span>
                  <p className="text-[10px] text-slate-400 text-center mt-0.5 truncate max-w-full" title={c.sub}>{c.sub}</p>
                </div>
              )
            })
          })()}
        </div>
      </div>

      {/* ══ Section 3: Severity & Category distribution ══ */}
      {issues.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Severity */}
          <div className="rounded-2xl overflow-hidden bg-white shadow-sm border border-slate-200">
            <div className="px-4 py-3 border-b border-slate-100">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Severity Breakdown</p>
            </div>
            <div className="px-4 py-3 space-y-2.5">
              {SEVERITY_ORDER.map(sev => {
                const n = sevCount[sev] || 0
                const meta = SEVERITY_META[sev]
                const pct = issues.length > 0 ? Math.round((n / issues.length) * 100) : 0
                return (
                  <div key={sev} className="flex items-center gap-2">
                    <span className="w-16 text-[10px] font-bold capitalize flex items-center gap-1" style={{ color: meta.color }}>
                      <span className={`w-2 h-2 rounded-full ${meta.dot}`} /> {meta.label}
                    </span>
                    <Bar value={n} max={issues.length} color={meta.color} />
                    <span className="text-[10px] text-slate-500 w-8 text-right">{pct}%</span>
                    <span className="text-[10px] font-bold text-slate-700 w-6 text-right">×{n}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Category */}
          <div className="rounded-2xl overflow-hidden bg-white shadow-sm border border-slate-200">
            <div className="px-4 py-3 border-b border-slate-100">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Top Categories</p>
            </div>
            <div className="px-4 py-3 space-y-2.5">
              {catList.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No findings to categorise.</p>
              ) : catList.map(([cat, n]) => {
                const pct = Math.round((n / issues.length) * 100)
                return (
                  <div key={cat} className="flex items-center gap-2">
                    <span className="w-32 text-[10px] font-medium text-slate-700 truncate" title={cat}>{cat}</span>
                    <Bar value={n} max={catList[0]?.[1] || 1} color="#6366f1" />
                    <span className="text-[10px] text-slate-500 w-8 text-right">{pct}%</span>
                    <span className="text-[10px] font-bold text-slate-700 w-6 text-right">×{n}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ══ Section 4: Top Fields & Rules leaderboards ══ */}
      {(fieldList.length > 0 || ruleList.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {fieldList.length > 0 && (
            <div className="rounded-2xl overflow-hidden bg-white shadow-sm border border-slate-200">
              <div className="px-4 py-3 border-b border-slate-100">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Top Fields with Issues</p>
              </div>
              <div className="px-4 py-3 space-y-2">
                {fieldList.map(([field, n], i) => (
                  <div key={field} className="flex items-center gap-2.5">
                    <span className="text-[10px] font-black text-slate-300 w-4 shrink-0">{i + 1}</span>
                    <code className="text-[10px] font-mono font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded w-32 shrink-0 truncate" title={field}>{field}</code>
                    <Bar value={n} max={fieldList[0]?.[1] || 1} color="#a855f7" />
                    <span className="text-[10px] font-bold text-slate-600 shrink-0">×{n}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {ruleList.length > 0 && (
            <div className="rounded-2xl overflow-hidden bg-white shadow-sm border border-slate-200">
              <div className="px-4 py-3 border-b border-slate-100">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Top Triggered Rules</p>
              </div>
              <div className="px-4 py-3 space-y-2">
                {ruleList.map(([rule, n], i) => (
                  <div key={rule} className="flex items-center gap-2.5">
                    <span className="text-[10px] font-black text-slate-300 w-4 shrink-0">{i + 1}</span>
                    <code className="text-[10px] font-mono font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded w-24 shrink-0 truncate" title={rule}>{rule}</code>
                    <Bar value={n} max={ruleList[0]?.[1] || 1} color="#6366f1" />
                    <span className="text-[10px] font-bold text-slate-600 shrink-0">×{n}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ Section 5: AI Insights panel ══ */}
      {ai && (
        <div className="rounded-2xl bg-gradient-to-br from-purple-50 via-white to-fuchsia-50 border border-purple-200 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <SparklesIcon className="h-5 w-5 text-purple-600" />
            <h2 className="text-sm font-bold text-slate-800">AI Insights</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {aiConfPct != null && (
              <InsightTile label="Header Mapping" value={`${aiConfPct}%`} detail={_str(ai.header_method, 'auto')} accent="#7c3aed" />
            )}
            {ai.tag_pattern?.pattern && (
              <InsightTile
                label="Tag Pattern"
                value={_str(ai.tag_pattern.label || ai.tag_pattern.pattern)}
                detail={`coverage ${Math.round((ai.tag_pattern.coverage || 0) * 100)}%`}
                accent="#0ea5e9"
              />
            )}
            {Array.isArray(ai.unmapped_headers) && ai.unmapped_headers.length > 0 && (
              <InsightTile
                label="Unmapped Headers"
                value={ai.unmapped_headers.length}
                detail={ai.unmapped_headers.slice(0, 3).map(h => _str(h)).join(', ')}
                accent="#f59e0b"
              />
            )}
            {Array.isArray(ai.cabinet_utilisation) && ai.cabinet_utilisation.length > 0 && (
              <InsightTile
                label="Cabinets"
                value={ai.cabinet_utilisation.length}
                detail={`max ${Math.round(Math.max(0, ...ai.cabinet_utilisation.map(c => Number(c?.utilisation) || 0)) * 100)}% used`}
                accent="#10b981"
              />
            )}
            {ai.loop_expansion?.families && Object.keys(ai.loop_expansion.families).length > 0 && (
              <InsightTile
                label="Loops Expanded"
                value={Object.values(ai.loop_expansion.families).reduce((a, b) => a + (Number(b) || 0), 0)}
                detail={Object.keys(ai.loop_expansion.families).join(', ')}
                accent="#0891b2"
              />
            )}
            {Array.isArray(ai.anomaly) && ai.anomaly.length > 0 && (
              <InsightTile
                label="Anomalies"
                value={ai.anomaly.length}
                detail="cross-row checks"
                accent="#ef4444"
              />
            )}
          </div>
        </div>
      )}

      {/* ══ Section 6: Findings table — filters + expandable rows ══ */}
      {issues.length > 0 && (
        <div className="rounded-2xl overflow-hidden bg-white shadow-sm border border-slate-200">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-3 flex-wrap bg-gradient-to-r from-slate-50 to-white">
            <ClipboardDocumentCheckIcon className="h-4 w-4 text-slate-500" />
            <h2 className="text-sm font-bold text-slate-800">Findings ({filteredIssues.length} of {issues.length})</h2>

            <div className="ml-auto flex items-center gap-2 flex-wrap">
              {/* Search */}
              <div className="relative">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search field, message, value…"
                  className="text-xs pl-7 pr-7 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 placeholder-slate-400 outline-none focus:border-purple-300 focus:ring-2 focus:ring-purple-100 transition"
                />
                <MagnifyingGlassIcon className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                {search && (
                  <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    <XMarkIcon className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Severity filter */}
              <select
                value={sevFilter}
                onChange={(e) => setSevFilter(e.target.value)}
                className="text-xs px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 outline-none cursor-pointer hover:border-slate-400"
              >
                <option value="all">All severities</option>
                {SEVERITY_ORDER.map(s => (
                  <option key={s} value={s}>{SEVERITY_META[s].label}</option>
                ))}
              </select>

              {/* Category filter */}
              {catList.length > 0 && (
                <select
                  value={catFilter}
                  onChange={(e) => setCatFilter(e.target.value)}
                  className="text-xs px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 outline-none cursor-pointer hover:border-slate-400"
                >
                  <option value="all">All categories</option>
                  {catList.map(([cat]) => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  {['#', 'Severity', 'Row', 'Field', 'Category', 'Message', 'Value', ''].map(h => (
                    <th key={h} className="px-3 py-2 text-left font-bold uppercase tracking-wide text-[10px] whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredIssues.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-10 text-center text-sm text-slate-400">No findings match your filters.</td>
                  </tr>
                )}
                {filteredIssues.slice(0, MAX_FINDING_PREVIEW).map((it, i) => {
                  const sev = (it.severity || 'info').toLowerCase()
                  const meta = SEVERITY_META[sev] || SEVERITY_META.info
                  const cat = it.category || _classifyField(it.field)
                  const isExp = expandedIdx === i
                  const hasDetail = it.explanation || it.suggested_fix || it.rule_id
                  return (
                    <Fragment key={i}>
                      <tr
                        className={`border-t border-slate-100 transition-colors cursor-pointer ${isExp ? 'bg-purple-50/60' : 'hover:bg-purple-50/30'}`}
                        onClick={() => hasDetail && setExpandedIdx(isExp ? null : i)}
                      >
                        <td className="px-3 py-2 align-top text-[10px] font-mono text-slate-400">{i + 1}</td>
                        <td className="px-3 py-2 align-top">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] rounded-full border ${meta.pill}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                            {meta.label}
                          </span>
                        </td>
                        <td className="px-3 py-2 align-top font-mono text-xs text-slate-600">{_str(it.row, '—')}</td>
                        <td className="px-3 py-2 align-top font-mono text-xs text-slate-700">{_str(it.field, '—')}</td>
                        <td className="px-3 py-2 align-top">
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">{_str(cat)}</span>
                        </td>
                        <td className="px-3 py-2 align-top text-slate-800">{_str(it.message)}</td>
                        <td className="px-3 py-2 align-top text-slate-500 font-mono text-xs truncate max-w-[180px]" title={_str(it.value)}>{_str(it.value)}</td>
                        <td className="px-3 py-2 align-top text-slate-400">
                          {hasDetail && (isExp ? <ChevronUpIcon className="h-3.5 w-3.5" /> : <ChevronDownIcon className="h-3.5 w-3.5" />)}
                        </td>
                      </tr>
                      {isExp && hasDetail && (
                        <tr className="bg-purple-50/40">
                          <td colSpan={8} className="px-4 py-3 text-xs text-slate-700">
                            {it.rule_id && (
                              <div className="mb-1.5 flex items-center gap-2">
                                <span className="text-[10px] font-black uppercase tracking-widest text-purple-700">Rule</span>
                                <code className="font-mono text-[10px] bg-white px-1.5 py-0.5 rounded border border-purple-200">{_str(it.rule_id)}</code>
                              </div>
                            )}
                            {it.explanation && (
                              <div className="mb-1.5">
                                <span className="font-bold text-purple-700">Why: </span>
                                <span className="text-slate-700">{_str(it.explanation)}</span>
                              </div>
                            )}
                            {it.suggested_fix && (
                              <div>
                                <span className="font-bold text-purple-700">Fix: </span>
                                <span className="text-slate-700">{_str(it.suggested_fix)}</span>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>

          {filteredIssues.length > MAX_FINDING_PREVIEW && (
            <div className="px-4 py-2 border-t border-slate-100 bg-slate-50/60 text-[10px] text-slate-500">
              Showing first {MAX_FINDING_PREVIEW} findings — refine your filters to see the rest.
            </div>
          )}
        </div>
      )}

      {/* ══ Section 7: Empty perfection state ══ */}
      {issues.length === 0 && (
        <div className="rounded-2xl bg-gradient-to-br from-emerald-50 to-white border border-emerald-200 p-8 text-center">
          <CheckBadgeIcon className="h-12 w-12 text-emerald-500 mx-auto" />
          <p className="mt-3 text-base font-bold text-emerald-800">No findings — clean dataset!</p>
          <p className="mt-1 text-xs text-emerald-700">Every row passed every rule across {totalRows} entries.</p>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function InsightTile({ label, value, detail, accent = '#7c3aed' }) {
  const safeValue  = _str(value, '—')
  const safeDetail = detail == null ? '' : _str(detail)
  return (
    <div
      className="rounded-xl bg-white/80 backdrop-blur-sm p-3 shadow-sm hover:shadow-md transition-all"
      style={{ border: `1px solid ${accent}33` }}
    >
      <div className="text-[10px] uppercase tracking-widest font-bold" style={{ color: accent }}>{_str(label)}</div>
      <div className="text-lg font-extrabold text-slate-900 mt-0.5 truncate" title={safeValue}>{safeValue}</div>
      {safeDetail && <div className="text-[10px] text-slate-500 mt-0.5 truncate" title={safeDetail}>{safeDetail}</div>}
    </div>
  )
}
