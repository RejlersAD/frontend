/**
 * HR · Consolidated Command Center (`/hr`)
 * ----------------------------------------
 * The HR Vice President's single-pane real-time dashboard.
 *
 * Data sources (all existing — NO core logic was modified):
 *   • timesheetService.fetchLive()    → live IN/OUT summary + roster
 *   • timesheetService.fetchDaily()   → today's per-user hours
 *   • timesheetService.fetchMonthly() → month-to-date rollup
 *   • rbacService.getUsers()          → workforce master directory
 *
 * Every label, KPI, polling interval, colour, section and link is read from
 * `frontend/src/config/hrDashboard.config.js`. The component is intentionally
 * a thin renderer over that config so HR can re-tune the dashboard without
 * any JSX edits.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import * as HeroIcons from '@heroicons/react/24/outline'

import rbacService from '../../services/rbac.service'
import timesheetService from '../../services/timesheet.service'
import payrollService from '../../services/payroll.service'
import { fmtCurrency, PAYROLL_WORKFLOW_STAGES } from '../../config/hrPayroll.config'

import {
  HR_DASHBOARD_POLL_MS,
  HR_DASHBOARD_FETCH_PAGE_SIZE,
  HR_DASHBOARD_COPY,
  HR_DASHBOARD_KPIS,
  HR_DASHBOARD_PAYROLL_KPIS,
  HR_DASHBOARD_SECTIONS,
  HR_DASHBOARD_QUICK_LINKS,
  HR_DASHBOARD_PENDING_TYPES,
  HR_DASHBOARD_KPI_REPORTS,
  HR_DASHBOARD_LEAVE_REPORT,
  buildTotalPending,
  buildDepartmentBreakdown,
  buildDisciplineBreakdown,
  buildTodayPunctuality,
  buildMonthRollup,
  buildRecentJoiners,
  buildLiveFeed,
  buildStatusDistribution,
  formatPunchTime,
  getGreeting,
  formatLeaveRecord,
} from '../../config/hrDashboard.config'

import {
  fullName,
  initials,
  normalizeEmployee,
  getEmail,
  formatDate,
} from '../../config/hrEmployees.config'

// ─────────────────────────────────────────────────────────────────────────────
// Tiny helpers — kept local so the page stays self-contained.
// ─────────────────────────────────────────────────────────────────────────────
const Icon = ({ name, className = 'w-5 h-5' }) => {
  const C = HeroIcons[name] || HeroIcons.QuestionMarkCircleIcon
  return <C className={className} aria-hidden="true" />
}

const formatTime = (d) =>
  d ? new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'

// ─────────────────────────────────────────────────────────────────────────────
// Badge palette for KPI report modal cells (status codes → Tailwind classes)
// ─────────────────────────────────────────────────────────────────────────────
const STATUS_BADGE_STYLES = {
  active:    'bg-emerald-100 text-emerald-700 border-emerald-200',
  pending:   'bg-amber-100   text-amber-700   border-amber-200',
  inactive:  'bg-slate-100   text-slate-600   border-slate-200',
  suspended: 'bg-red-100     text-red-700     border-red-200',
  on_leave:  'bg-blue-100    text-blue-700    border-blue-200',
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-component: KPI drill-down report modal (full-screen overlay)
// ─────────────────────────────────────────────────────────────────────────────
const KpiReportModal = ({ reportId, ctx, onClose }) => {
  const [search, setSearch] = useState('')
  const config = HR_DASHBOARD_KPI_REPORTS[reportId]

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  if (!config) return null

  const allRows = config.getRows(ctx)
  const filteredRows = search.trim()
    ? allRows.filter((r) => config.searchFn(r).includes(search.toLowerCase()))
    : allRows

  const renderCell = (col, row) => {
    const val = col.render(row)
    if (col.statusBadge) {
      const style =
        STATUS_BADGE_STYLES[String(val).toLowerCase()] ||
        'bg-slate-100 text-slate-600 border-slate-200'
      return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border capitalize ${style}`}>
          {val}
        </span>
      )
    }
    if (col.mfaBadge) {
      const enabled = String(val) === 'Enabled'
      return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
          enabled
            ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
            : 'bg-rose-100 text-rose-700 border-rose-200'
        }`}>
          {enabled ? '✓ Enabled' : '✗ Disabled'}
        </span>
      )
    }
    if (col.lateBadge) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border bg-amber-100 text-amber-700 border-amber-200">
          ⏰ Late
        </span>
      )
    }
    if (col.attendanceBadge) {
      const isLate = String(val) === 'Late'
      return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
          isLate
            ? 'bg-amber-100 text-amber-700 border-amber-200'
            : 'bg-emerald-100 text-emerald-700 border-emerald-200'
        }`}>
          {isLate ? '⏰ Late' : '✓ On Time'}
        </span>
      )
    }
    if (col.mono) {
      return <span className="font-mono text-xs text-slate-500">{val}</span>
    }
    return val
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-8 bg-black/50 backdrop-blur-sm overflow-y-auto"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl my-auto">
        {/* ── Gradient header ── */}
        <div className={`bg-gradient-to-r ${config.accentGradient} rounded-t-2xl p-5 text-white`}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                <Icon name={config.icon} className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold">{config.title}</h2>
                <p className="text-sm text-white/80 mt-0.5 max-w-xl">{config.description}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center flex-shrink-0 transition-colors"
              title="Close (Esc)"
            >
              <Icon name="XMarkIcon" className="w-5 h-5" />
            </button>
          </div>
          {/* Summary stats bar */}
          <div className="mt-4 flex items-center gap-4 flex-wrap text-sm text-white/90">
            <span className="inline-flex items-center gap-1.5">
              <Icon name="TableCellsIcon" className="w-4 h-4 opacity-80" />
              <strong>{allRows.length}</strong> total records
            </span>
            {search.trim() && (
              <span className="inline-flex items-center gap-1.5">
                <Icon name="FunnelIcon" className="w-4 h-4 opacity-80" />
                <strong>{filteredRows.length}</strong> matching filter
              </span>
            )}
          </div>
        </div>

        {/* ── Search bar ── */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-slate-100 bg-slate-50/60">
          <div className="relative flex-1">
            <Icon name="MagnifyingGlassIcon" className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by name, email, department…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              autoFocus
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <Icon name="XMarkIcon" className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors whitespace-nowrap"
          >
            ← Close Report
          </button>
        </div>

        {/* ── Data table ── */}
        <div className="overflow-x-auto" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          {filteredRows.length === 0 ? (
            <div className="text-sm text-slate-500 italic py-14 text-center">
              {search.trim() ? 'No records match your search.' : config.emptyMsg}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white border-b border-slate-200 shadow-sm z-10">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide w-10">#</th>
                  {config.columns.map((col) => (
                    <th key={col.key} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRows.map((row, idx) => (
                  <tr
                    key={row.id || row.user?.id || row.employee_code || idx}
                    className="hover:bg-slate-50/80 transition-colors"
                  >
                    <td className="px-4 py-2.5 text-xs text-slate-400 font-mono">{idx + 1}</td>
                    {config.columns.map((col) => (
                      <td key={col.key} className="px-4 py-2.5 text-slate-800 max-w-xs truncate">
                        {renderCell(col, row)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="px-5 py-3 border-t border-slate-100 rounded-b-2xl bg-slate-50/40 flex items-center justify-between gap-2 text-xs text-slate-400">
          <span>Live data — auto-refresh every {Math.round(HR_DASHBOARD_POLL_MS / 1000)}s</span>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-500 hover:text-slate-800 font-medium transition-colors"
          >
            Close ✕
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-component: top KPI tile — clickable, opens drill-down report
// ─────────────────────────────────────────────────────────────────────────────
const KpiTile = ({ kpi, value, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${kpi.accent} text-white p-5 shadow-md hover:shadow-xl hover:scale-[1.03] active:scale-[0.98] transition-all cursor-pointer text-left w-full group`}
    title={`Click to view ${kpi.label} report`}
  >
    <div className="flex items-start justify-between">
      <div className="opacity-90">
        <Icon name={kpi.icon} className="w-7 h-7" />
      </div>
      <span className="text-[10px] uppercase tracking-wider opacity-80">{kpi.sub}</span>
    </div>
    <div className="mt-3 text-3xl font-bold leading-tight">
      {value === null || value === undefined ? '—' : value}
    </div>
    <div className="mt-1 text-sm font-medium opacity-95">{kpi.label}</div>
    {/* Click hint — appears on hover */}
    <div className="absolute bottom-2.5 right-3 opacity-0 group-hover:opacity-80 transition-opacity text-[10px] uppercase tracking-widest flex items-center gap-1">
      <Icon name="ArrowTopRightOnSquareIcon" className="w-3 h-3" />
      View report
    </div>
  </button>
)

// ─────────────────────────────────────────────────────────────────────────────
// Sub-component: payroll / pending KPI tile (compact secondary strip)
// ─────────────────────────────────────────────────────────────────────────────
const PayrollKpiTile = ({ kpi, value, onClick }) => {
  const isUrgent = kpi.urgent && value > 0
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative overflow-hidden rounded-xl p-4 text-left w-full transition-all shadow-sm hover:shadow-md
        ${isUrgent
          ? `bg-gradient-to-br ${kpi.accent} text-white`
          : 'bg-white border border-slate-200 text-slate-800'}`}
    >
      <div className="flex items-center justify-between mb-2">
        <Icon name={kpi.icon} className={`w-5 h-5 ${isUrgent ? 'text-white/90' : 'text-slate-500'}`} />
        {isUrgent && (
          <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
        )}
      </div>
      <div className={`text-2xl font-bold ${isUrgent ? 'text-white' : 'text-slate-900'}`}>
        {value === null || value === undefined ? '—' : value}
      </div>
      <div className={`text-xs mt-0.5 font-medium ${isUrgent ? 'text-white/80' : 'text-slate-500'}`}>
        {kpi.label}
      </div>
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-component: section card wrapper
// ─────────────────────────────────────────────────────────────────────────────
const Section = ({ title, hint, icon, children, action }) => (
  <section className="bg-white border border-slate-200 rounded-2xl shadow-sm">
    <header className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-100">
      <div className="flex items-start gap-3 min-w-0">
        {icon && (
          <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center flex-shrink-0">
            <Icon name={icon} className="w-5 h-5" />
          </div>
        )}
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-slate-900 truncate">{title}</h2>
          {hint && <p className="text-xs text-slate-500 mt-0.5">{hint}</p>}
        </div>
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </header>
    <div className="p-5">{children}</div>
  </section>
)

// ─────────────────────────────────────────────────────────────────────────────
// Sub-component: horizontal bar chart (no chart library — pure tailwind)
// ─────────────────────────────────────────────────────────────────────────────
const BarChart = ({ items, emptyMessage }) => {
  if (!items || items.length === 0) {
    return <div className="text-sm text-slate-500 italic py-6 text-center">{emptyMessage}</div>
  }
  const max = Math.max(...items.map((i) => i.count), 1)
  return (
    <div className="space-y-2">
      {items.map((item) => {
        const pct = Math.max(2, Math.round((item.count / max) * 100))
        return (
          <div key={item.label} className="grid grid-cols-12 gap-2 items-center text-sm">
            <div className="col-span-5 truncate text-slate-700" title={item.label}>
              {item.label}
            </div>
            <div className="col-span-6">
              <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full bg-gradient-to-r ${item.accent || 'from-blue-400 to-blue-600'} rounded-full transition-all`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
            <div className="col-span-1 text-right font-semibold text-slate-900">{item.count}</div>
          </div>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-component: status distribution stack bar
// ─────────────────────────────────────────────────────────────────────────────
const StatusStack = ({ items, total }) => {
  if (!items || items.length === 0 || total === 0) {
    return <div className="text-sm text-slate-500 italic">No status data</div>
  }
  return (
    <div className="space-y-3">
      <div className="flex h-3 w-full rounded-full overflow-hidden bg-slate-100">
        {items.map((s) => {
          const pct = Math.max(0.5, (s.count / total) * 100)
          return (
            <div
              key={s.code}
              className={s.bar}
              style={{ width: `${pct}%` }}
              title={`${s.label}: ${s.count}`}
            />
          )
        })}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {items.map((s) => (
          <div key={s.code} className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-sm ${s.bar}`} />
            <span className={`font-medium ${s.text}`}>{s.label}</span>
            <span className="text-slate-500">({s.count})</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-component: live activity feed row
// ─────────────────────────────────────────────────────────────────────────────
const LiveFeedRow = ({ row }) => {
  const t = formatPunchTime(row)
  const type = (row.punch_type || '').toString().toUpperCase()
  const isIn = type === 'IN' || type === '1'
  const name = row.radai_full_name || row.name || row.employee_name || row.employee_code
  const dept = row.radai_department || row.department || ''
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-slate-100 last:border-b-0">
      <div
        className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${
          isIn ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'
        }`}
      >
        {(name || '?').toString().slice(0, 2).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-slate-900 truncate">{name}</div>
        <div className="text-xs text-slate-500 truncate">{dept || row.employee_code}</div>
      </div>
      <div className="text-right flex-shrink-0">
        <div
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold ${
            isIn
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-slate-100 text-slate-600 border border-slate-200'
          }`}
        >
          <Icon
            name={isIn ? 'ArrowRightOnRectangleIcon' : 'ArrowLeftOnRectangleIcon'}
            className="w-3 h-3"
          />
          {isIn ? 'IN' : 'OUT'}
        </div>
        <div className={`text-[11px] mt-0.5 ${t.stale ? 'text-slate-400' : 'text-slate-500'}`}>
          {t.time}
          {t.minutesAgo !== null && t.minutesAgo < 999 && (
            <span className="ml-1 text-slate-400">· {t.minutesAgo}m ago</span>
          )}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-component: recent joiner card
// ─────────────────────────────────────────────────────────────────────────────
const JoinerCard = ({ emp }) => (
  <Link
    to="/hr/employees"
    className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:border-purple-300 hover:bg-purple-50/40 transition-colors"
  >
    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-fuchsia-600 text-white flex items-center justify-center text-sm font-semibold flex-shrink-0">
      {initials(emp)}
    </div>
    <div className="flex-1 min-w-0">
      <div className="text-sm font-semibold text-slate-900 truncate">{fullName(emp)}</div>
      <div className="text-xs text-slate-500 truncate">{getEmail(emp) || emp.department || '—'}</div>
    </div>
    <div className="text-[11px] text-slate-500 flex-shrink-0">
      {formatDate(emp.created_at)}
    </div>
  </Link>
)

// ─────────────────────────────────────────────────────────────────────────────
// Sub-component: quick link tile
// ─────────────────────────────────────────────────────────────────────────────
const QuickLink = ({ link }) => (
  <Link
    to={link.to}
    className={`flex items-start gap-3 p-4 rounded-xl border transition-colors ${link.tone}`}
  >
    <div className="w-10 h-10 rounded-lg bg-white/80 flex items-center justify-center flex-shrink-0 shadow-sm">
      <Icon name={link.icon} className="w-5 h-5" />
    </div>
    <div className="min-w-0">
      <div className="text-sm font-semibold">{link.label}</div>
      <div className="text-xs opacity-80 mt-0.5">{link.description}</div>
    </div>
  </Link>
)

// ─────────────────────────────────────────────────────────────────────────────
// Sub-component: pending action card (one per category)
// ─────────────────────────────────────────────────────────────────────────────
const PendingActionCard = ({ type, pending, navigate }) => {
  const count   = type.getCount(pending)
  const items   = type.getItems(pending)
  const hasItems = count > 0
  return (
    <div className={`rounded-xl border p-4 flex flex-col gap-3 transition-all ${hasItems ? `${type.bg} ${type.border}` : 'bg-white border-slate-200'}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${hasItems ? 'bg-white/70' : 'bg-slate-100'}`}>
            <Icon name={type.icon} className={`w-4 h-4 ${hasItems ? type.text : 'text-slate-400'}`} />
          </div>
          <span className={`text-sm font-semibold ${hasItems ? type.text : 'text-slate-500'}`}>{type.label}</span>
        </div>
        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${hasItems ? type.badge : 'bg-slate-100 text-slate-400 border-slate-200'}`}>
          {count}
        </span>
      </div>
      {/* Item list (top 3) */}
      {hasItems ? (
        <div className="space-y-2">
          {items.map((r, i) => (
            <div key={r.id || i} className="flex items-start gap-2 text-sm">
              <span className={`mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 ${type.dot}`} />
              <div className="min-w-0">
                <div className={`font-medium truncate ${type.text}`}>{type.getRowLabel(r)}</div>
                <div className="text-xs text-slate-500 truncate">{type.getRowSub(r)}</div>
              </div>
            </div>
          ))}
          {count > items.length && (
            <div className={`text-xs ${type.text} opacity-70`}>+ {count - items.length} more</div>
          )}
        </div>
      ) : (
        <p className="text-xs text-slate-400">{type.zeroMsg}</p>
      )}
      {/* CTA */}
      <button
        type="button"
        onClick={() => navigate(type.route)}
        className={`mt-auto text-xs font-semibold py-1.5 px-3 rounded-lg border transition-colors
          ${hasItems
            ? 'bg-white/80 border-white/50 hover:bg-white ' + type.text
            : 'bg-slate-50 border-slate-200 text-slate-400 hover:bg-slate-100 hover:text-slate-600'}`}
      >
        {type.actionLabel} →
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-component: notification dropdown (bell click)
// ─────────────────────────────────────────────────────────────────────────────
const NotifDropdown = ({ pending, total, navigate, onClose }) => (
  <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl border border-slate-200 shadow-xl z-50 overflow-hidden">
    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
      <div className="flex items-center gap-2">
        <Icon name="BellIcon" className="w-4 h-4 text-slate-600" />
        <span className="text-sm font-semibold text-slate-800">{HR_DASHBOARD_COPY.notifTitle}</span>
      </div>
      {total > 0 && (
        <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white text-[11px] font-bold">{total}</span>
      )}
      <button onClick={onClose} className="ml-auto text-slate-400 hover:text-slate-700">
        <Icon name="XMarkIcon" className="w-4 h-4" />
      </button>
    </div>
    <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
      {total === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 gap-2 text-slate-400">
          <Icon name="CheckCircleIcon" className="w-8 h-8 text-emerald-400" />
          <span className="text-sm">{HR_DASHBOARD_COPY.notifClear}</span>
        </div>
      ) : (
        HR_DASHBOARD_PENDING_TYPES.map((type) => {
          const count = type.getCount(pending)
          if (count === 0) return null
          return (
            <button
              key={type.id}
              type="button"
              onClick={() => { navigate(type.route); onClose() }}
              className={`w-full flex items-center gap-3 px-4 py-3 hover:${type.bg} transition-colors text-left`}
            >
              <div className={`w-8 h-8 rounded-lg ${type.bg} ${type.border} border flex items-center justify-center flex-shrink-0`}>
                <Icon name={type.icon} className={`w-4 h-4 ${type.text}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-medium ${type.text}`}>{type.label}</div>
                <div className="text-xs text-slate-500">
                  {count} {count === 1 ? type.singularMsg : type.pluralMsg}
                </div>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${type.badge}`}>{count}</span>
            </button>
          )
        })
      )}
    </div>
    <div className="px-4 py-3 border-t border-slate-100">
      <button
        type="button"
        onClick={() => { navigate('/hr/payroll'); onClose() }}
        className="w-full text-center text-xs font-semibold text-blue-600 hover:text-blue-800"
      >
        Open Payroll & Salary →
      </button>
    </div>
  </div>
)

// ─────────────────────────────────────────────────────────────────────────────
// Approval Pipeline Widget — compact tracker embedded in the HR Dashboard.
// Gated by isSuperAdmin; clicking "Full Tracker" navigates to /hr/payroll.
// ─────────────────────────────────────────────────────────────────────────────
const PIPELINE_STAGE_KPIS = [
  { key: 'draft',            label: 'Draft',         cls: 'bg-slate-100  text-slate-700  border-slate-200'  },
  { key: 'frozen',           label: 'Frozen',        cls: 'bg-blue-100   text-blue-700   border-blue-200'   },
  { key: 'hr_approved',      label: 'HR Approved',   cls: 'bg-violet-100 text-violet-700 border-violet-200' },
  { key: 'finance_review',   label: 'In Finance',    cls: 'bg-amber-100  text-amber-700  border-amber-200'  },
  { key: 'finance_approved', label: 'Fin. Approved', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { key: 'released',         label: 'Released',      cls: 'bg-green-100  text-green-700  border-green-200'  },
]

function ApprovalPipelineWidget({ data, onViewAll }) {
  const { summary = {}, results = [] } = data
  const active = [...results]
    .filter(r => r.workflow_stage !== 'released')
    .sort((a, b) => {
      const rank = { overdue: 0, warning: 1, ok: 2 }
      return (rank[a.current_sla_status] ?? 2) - (rank[b.current_sla_status] ?? 2)
    })
    .slice(0, 5)
  const overdueCount = summary.overdue_count ?? 0
  const warningCount = summary.warning_count ?? 0

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center">
            <HeroIcons.ClipboardDocumentListIcon className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-700">Payroll Approval Pipeline</h3>
            <p className="text-[10px] text-slate-400">{summary.total ?? 0} master payroll file{(summary.total ?? 0) !== 1 ? 's' : ''}</p>
          </div>
          {overdueCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-700 border border-rose-200">
              <HeroIcons.ExclamationCircleIcon className="w-3.5 h-3.5" />
              {overdueCount} overdue
            </span>
          )}
          {warningCount > 0 && overdueCount === 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 border border-amber-200">
              <HeroIcons.ExclamationTriangleIcon className="w-3.5 h-3.5" />
              {warningCount} at risk
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onViewAll}
          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline transition-colors"
        >
          Full Tracker
          <HeroIcons.ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Stage KPI mini-bar */}
      <div className="grid grid-cols-6 gap-2 mb-4">
        {PIPELINE_STAGE_KPIS.map(({ key, label, cls }) => (
          <div key={key} className={`rounded-lg border px-2 py-2 text-center ${cls}`}>
            <div className="text-lg font-bold leading-tight">{summary.by_stage?.[key] ?? 0}</div>
            <div className="text-[10px] font-medium opacity-70 leading-tight mt-0.5 truncate">{label}</div>
          </div>
        ))}
      </div>

      {/* Active files list */}
      {active.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Active Files</p>
          {active.map(row => {
            const stageDef = PAYROLL_WORKFLOW_STAGES.find(s => s.key === row.workflow_stage)
            const StagIcon = stageDef ? (HeroIcons[stageDef.icon] || HeroIcons.DocumentTextIcon) : HeroIcons.DocumentTextIcon
            const isOverdue = row.current_sla_status === 'overdue'
            const isWarning = row.current_sla_status === 'warning'
            return (
              <div
                key={row.id}
                className={`flex items-center justify-between px-3 py-2 rounded-lg border ${
                  isOverdue ? 'bg-rose-50/60 border-rose-200'
                  : isWarning ? 'bg-amber-50/60 border-amber-200'
                  : 'bg-slate-50 border-slate-100'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {stageDef && (
                    <div className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center ${stageDef.activeBg} border ${stageDef.activeBorder}`}>
                      <StagIcon className={`w-3 h-3 ${stageDef.activeText}`} />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-700 leading-tight">{row.period}</p>
                    <p className="text-[10px] text-slate-400">{row.total_rows} employees</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {stageDef && (
                    <span className={`hidden sm:inline-flex text-[10px] font-medium px-2 py-0.5 rounded-full border ${stageDef.activeBg} ${stageDef.activeText} ${stageDef.activeBorder}`}>
                      {stageDef.label}
                    </span>
                  )}
                  {row.days_in_current_stage != null && (
                    <span className={`text-[10px] font-medium ${
                      isOverdue ? 'text-rose-600' : isWarning ? 'text-amber-600' : 'text-slate-400'
                    }`}>
                      {row.days_in_current_stage}d{row.current_sla_days ? `/${row.current_sla_days}d` : ''}
                    </span>
                  )}
                  {row.pending_role && (
                    <span className="hidden md:inline-flex items-center gap-0.5 text-[10px] text-slate-400">
                      <HeroIcons.UserIcon className="w-3 h-3" />
                      {row.pending_role}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : summary.total > 0 ? (
        <p className="text-xs text-emerald-600 text-center py-3 flex items-center justify-center gap-1.5">
          <HeroIcons.CheckCircleIcon className="w-4 h-4" />
          All payroll files have been released.
        </p>
      ) : (
        <p className="text-xs text-slate-400 text-center py-4">No master payroll files yet.</p>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────
export default function HRDashboard() {
  const currentUser = useSelector((state) => state.auth?.user)
  const navigate = useNavigate()
  const notifRef = useRef(null)

  const [workforce, setWorkforce] = useState([])
  const [live, setLive] = useState(null)
  const [daily, setDaily] = useState(null)
  const [monthly, setMonthly] = useState(null)

  // KPI drill-down report — id of the tile that was clicked (null = closed)
  const [reportKpiId, setReportKpiId] = useState(null)

  // Payroll / leave / salary pending data (from 4.2 + 4.3)
  const [pending, setPending] = useState({
    pendingLeave: [], pendingLeaveCount: 0,
    pendingAlerts: [], pendingAlertsCount: 0,
    pendingSalary: [], pendingSalaryCount: 0,
    pendingSlips: [], pendingSlipsCount: 0,
    payrollSummary: null,
  })
  const [notifOpen, setNotifOpen] = useState(false)
  const [loadingPayroll, setLoadingPayroll] = useState(false)

  // ═══════════════════════════════════════════════════════════════════════════
  // SOFT-CODED: Consolidated Leave Records State (for HR Manager dashboard)
  // ═══════════════════════════════════════════════════════════════════════════
  const [allLeaveRecords, setAllLeaveRecords] = useState([])
  const [filteredLeaveRecords, setFilteredLeaveRecords] = useState([])
  const [loadingLeaveRecords, setLoadingLeaveRecords] = useState(false)
  const [leaveStatusFilter, setLeaveStatusFilter] = useState('ALL')
  const [leaveTypeFilter, setLeaveTypeFilter] = useState('ALL')
  const [leaveSearchQuery, setLeaveSearchQuery] = useState('')
  const [leaveCurrentPage, setLeaveCurrentPage] = useState(1)
  const [leavePageSize, setLeavePageSize] = useState(25)

  const [loadingWorkforce, setLoadingWorkforce] = useState(true)
  const [loadingLive, setLoadingLive] = useState(true)
  const [workforceError, setWorkforceError] = useState(null)
  const [timesheetError, setTimesheetError] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [now, setNow] = useState(new Date())

  // Approval Tracker widget (super-admin only, non-blocking)
  const [trackerData, setTrackerData] = useState(null)
  const userData = currentUser?.user || currentUser
  const isSuperAdmin = !!(
    userData?.is_staff ||
    userData?.is_superuser ||
    currentUser?.roles?.some(r => r.code === 'super_admin' || r.name === 'Super Administrator')
  )

  // Close notif dropdown when clicking outside
  useEffect(() => {
    if (!notifOpen) return
    const handler = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [notifOpen])

  // ── Fetch workforce (one-time on mount; doesn't need to poll every 30s)
  const loadWorkforce = useCallback(async () => {
    setLoadingWorkforce(true)
    setWorkforceError(null)
    try {
      const resp = await rbacService.getUsers({ page_size: HR_DASHBOARD_FETCH_PAGE_SIZE })
      const raw = Array.isArray(resp?.data?.results)
        ? resp.data.results
        : Array.isArray(resp?.results)
          ? resp.results
          : Array.isArray(resp?.data)
            ? resp.data
            : Array.isArray(resp)
              ? resp
              : []
      setWorkforce(raw.map(normalizeEmployee))
    } catch (err) {
      console.warn('[HRDashboard] workforce load failed', err)
      setWorkforceError(err)
      setWorkforce([])
    } finally {
      setLoadingWorkforce(false)
    }
  }, [])

  // ── Fetch live + today + month rollup (polled)
  const loadTimesheets = useCallback(async () => {
    setLoadingLive(true)
    setTimesheetError(null)
    try {
      const [liveResp, dailyResp, monthlyResp] = await Promise.allSettled([
        timesheetService.fetchLive(),
        timesheetService.fetchDaily(),
        timesheetService.fetchMonthly(),
      ])
      if (liveResp.status === 'fulfilled') setLive(liveResp.value)
      if (dailyResp.status === 'fulfilled') setDaily(dailyResp.value)
      if (monthlyResp.status === 'fulfilled') setMonthly(monthlyResp.value)
      const anyOk =
        liveResp.status === 'fulfilled' ||
        dailyResp.status === 'fulfilled' ||
        monthlyResp.status === 'fulfilled'
      if (!anyOk) setTimesheetError(liveResp.reason || new Error('Timesheet unavailable'))
      setLastUpdated(new Date())
    } catch (err) {
      console.warn('[HRDashboard] timesheet load failed', err)
      setTimesheetError(err)
    } finally {
      setLoadingLive(false)
    }
  }, [])

  // ── Fetch pending actions from 4.2 Payroll + 4.3 Leave/Salary (polled)
  const loadPayrollData = useCallback(async () => {
    if (!HR_DASHBOARD_SECTIONS.pendingActions && !HR_DASHBOARD_SECTIONS.payrollSnapshot) return
    setLoadingPayroll(true)
    try {
      const [leaveRes, alertsRes, salaryRes, slipsRes, summaryRes] = await Promise.allSettled([
        payrollService.getLeaveRequests({ status: 'PENDING', page_size: 10 }),
        payrollService.getAuditAlerts({ status: 'open', page_size: 10 }),
        payrollService.getPendingSalaryStructures(),
        payrollService.getSalarySlips({ status: 'pending_approval', page_size: 10 }),
        payrollService.getDashboardSummary(),
      ])

      const leaveList   = leaveRes.status   === 'fulfilled' ? (leaveRes.value?.results   ?? leaveRes.value   ?? []) : []
      const alertsList  = alertsRes.status  === 'fulfilled' ? (alertsRes.value?.results  ?? alertsRes.value  ?? []) : []
      const salaryList  = salaryRes.status  === 'fulfilled' ? (salaryRes.value?.results  ?? Array.isArray(salaryRes.value) ? salaryRes.value : []) : []
      const slipsList   = slipsRes.status   === 'fulfilled' ? (slipsRes.value?.results   ?? slipsRes.value   ?? []) : []
      const summary     = summaryRes.status === 'fulfilled' ? summaryRes.value : null

      setPending({
        pendingLeave:        Array.isArray(leaveList)  ? leaveList  : [],
        pendingLeaveCount:   leaveRes.status  === 'fulfilled' ? (leaveRes.value?.count  ?? leaveList.length)  : 0,
        pendingAlerts:       Array.isArray(alertsList) ? alertsList : [],
        pendingAlertsCount:  alertsRes.status === 'fulfilled' ? (alertsRes.value?.count ?? alertsList.length) : 0,
        pendingSalary:       Array.isArray(salaryList) ? salaryList : [],
        pendingSalaryCount:  Array.isArray(salaryList) ? salaryList.length : 0,
        pendingSlips:        Array.isArray(slipsList)  ? slipsList  : [],
        pendingSlipsCount:   slipsRes.status  === 'fulfilled' ? (slipsRes.value?.count  ?? slipsList.length)  : 0,
        payrollSummary:      summary,
      })
    } catch (err) {
      console.warn('[HRDashboard] payroll data load failed', err)
    } finally {
      setLoadingPayroll(false)
    }
  }, [])

  // ═══════════════════════════════════════════════════════════════════════════
  // SOFT-CODED: Load consolidated leave records for HR Manager dashboard
  // ═══════════════════════════════════════════════════════════════════════════
  const loadAllLeaveRecords = useCallback(async () => {
    if (!HR_DASHBOARD_SECTIONS.leaveRecordsConsolidated) return
    setLoadingLeaveRecords(true)
    try {
      // Fetch ALL leave records (not just pending) with large page size
      const response = await payrollService.getLeaveRequests({ page_size: 500 })
      const records = Array.isArray(response?.results) ? response.results : Array.isArray(response) ? response : []
      setAllLeaveRecords(records)
    } catch (err) {
      console.warn('[HRDashboard] leave records load failed', err)
      setAllLeaveRecords([])
    } finally {
      setLoadingLeaveRecords(false)
    }
  }, [])

  // ═══════════════════════════════════════════════════════════════════════════
  // SOFT-CODED: Filter leave records based on status, type, and search query
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    let filtered = [...allLeaveRecords]
    
    // Filter by status
    if (leaveStatusFilter !== 'ALL') {
      filtered = filtered.filter(record => record.status === leaveStatusFilter)
    }
    
    // Filter by leave type
    if (leaveTypeFilter !== 'ALL') {
      filtered = filtered.filter(record => 
        (record.leave_type_detail?.code || record.leave_type || '').toLowerCase() === leaveTypeFilter.toLowerCase()
      )
    }
    
    // Filter by search query (employee name, reason)
    if (leaveSearchQuery.trim()) {
      const query = leaveSearchQuery.toLowerCase()
      filtered = filtered.filter(record => 
        (record.employee_name || '').toLowerCase().includes(query) ||
        (record.reason || '').toLowerCase().includes(query)
      )
    }
    
    setFilteredLeaveRecords(filtered)
    setLeaveCurrentPage(1) // Reset to first page when filters change
  }, [allLeaveRecords, leaveStatusFilter, leaveTypeFilter, leaveSearchQuery])

  // ── Initial mount
  useEffect(() => {
    loadWorkforce()
    loadTimesheets()
    loadPayrollData()
    loadAllLeaveRecords() // Load consolidated leave records
  }, [loadWorkforce, loadTimesheets, loadPayrollData, loadAllLeaveRecords])

  // ── Auto-refresh timer
  useEffect(() => {
    if (!autoRefresh) return undefined
    const id = setInterval(() => {
      loadTimesheets()
      loadPayrollData()
    }, HR_DASHBOARD_POLL_MS)
    return () => clearInterval(id)
  }, [autoRefresh, loadTimesheets, loadPayrollData])

  // ── Live clock for the header
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  // ── Approval tracker (DISABLED - feature not implemented yet)
  // useEffect(() => {
  //   if (!isSuperAdmin) return
  //   payrollService.getApprovalTracker()
  //     .then(data => setTrackerData(data))
  //     .catch(() => { /* non-fatal — widget stays hidden */ })
  // }, [isSuperAdmin])

  // ── Derived data (memoised so re-renders stay cheap)
  const ctx = useMemo(
    () => ({ workforce, live, daily, monthly }),
    [workforce, live, daily, monthly]
  )
  const liveFeed = useMemo(() => buildLiveFeed(live), [live])
  const deptBars = useMemo(() => buildDepartmentBreakdown(workforce), [workforce])
  const disciplineBars = useMemo(
    () => buildDisciplineBreakdown(workforce).slice(0, 8).map((d) => ({
      label: d.label,
      count: d.count,
      accent: 'from-rose-400 to-pink-600',
    })),
    [workforce]
  )
  const statusDist = useMemo(() => buildStatusDistribution(workforce), [workforce])
  const punctuality = useMemo(() => buildTodayPunctuality(daily?.rows), [daily])
  const monthRollup = useMemo(() => buildMonthRollup(monthly?.rows), [monthly])
  const joiners = useMemo(() => buildRecentJoiners(workforce), [workforce])

  // Derived pending counts (update with each `pending` state change)
  const totalPending = useMemo(() => buildTotalPending(pending), [pending])
  const payrollKpiValues = useMemo(
    () =>
      HR_DASHBOARD_PAYROLL_KPIS.map((kpi) =>
        kpi.compute({
          pendingLeaveCount:  pending.pendingLeaveCount,
          pendingAlertsCount: pending.pendingAlertsCount,
          pendingSalaryCount: pending.pendingSalaryCount,
          pendingSlipsCount:  pending.pendingSlipsCount,
          payrollSummary:     pending.payrollSummary,
        })
      ),
    [pending]
  )

  const greeting = getGreeting()
  const userFirstName =
    currentUser?.first_name ||
    (currentUser?.full_name ? currentUser.full_name.split(/\s+/)[0] : '') ||
    'there'

  return (
    <div className="bg-gradient-to-br from-slate-50 via-white to-blue-50/40 p-4 sm:p-6 lg:p-8">
      <div className="space-y-6">

        {/* ── Header ───────────────────────────────────────────────────── */}
        <header className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center shadow-md">
                <Icon name="PresentationChartBarIcon" className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                  {HR_DASHBOARD_COPY.pageTitle}
                </h1>
                <p className="text-sm text-slate-600">
                  {greeting}, <span className="font-semibold">{userFirstName}</span>.{' '}
                  {HR_DASHBOARD_COPY.pageSubtitle}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-sm text-slate-700 font-mono">
              {formatTime(now)}
            </div>

            {/* ── Notification Bell ─────────────────────────────────── */}
            {HR_DASHBOARD_SECTIONS.pendingActions && (
              <div ref={notifRef} className="relative">
                <button
                  type="button"
                  onClick={() => setNotifOpen((v) => !v)}
                  className="relative px-3 py-1.5 rounded-lg border bg-white border-slate-200 text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 transition-colors"
                  title="Pending actions"
                >
                  <Icon name="BellIcon" className="w-4 h-4" />
                  {totalPending > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white px-1 shadow">
                      {totalPending > 99 ? '99+' : totalPending}
                    </span>
                  )}
                </button>
                {notifOpen && (
                  <NotifDropdown
                    pending={pending}
                    total={totalPending}
                    navigate={navigate}
                    onClose={() => setNotifOpen(false)}
                  />
                )}
              </div>
            )}

            <button
              type="button"
              onClick={() => setAutoRefresh((v) => !v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                autoRefresh
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
              title={`Polling every ${Math.round(HR_DASHBOARD_POLL_MS / 1000)}s`}
            >
              <span
                className={`inline-block w-2 h-2 rounded-full mr-1.5 ${
                  autoRefresh ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                }`}
              />
              {autoRefresh ? HR_DASHBOARD_COPY.autoRefreshOn : HR_DASHBOARD_COPY.autoRefreshOff}
            </button>
            <button
              type="button"
              onClick={() => { loadTimesheets(); loadPayrollData() }}
              disabled={loadingLive || loadingPayroll}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold border bg-white border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              <Icon name="ArrowPathIcon" className={`w-3.5 h-3.5 inline mr-1 ${loadingLive || loadingPayroll ? 'animate-spin' : ''}`} />
              {loadingLive || loadingPayroll ? HR_DASHBOARD_COPY.refreshing : HR_DASHBOARD_COPY.manualRefresh}
            </button>
            {lastUpdated && (
              <div className="text-[11px] text-slate-500 ml-1">
                {HR_DASHBOARD_COPY.lastUpdated}: {formatTime(lastUpdated)}
              </div>
            )}
          </div>
        </header>

        {/* ── Error banners ────────────────────────────────────────────── */}
        {(workforceError || timesheetError) && (
          <div className="space-y-2">
            {workforceError && (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-3 text-sm">
                <Icon name="ExclamationTriangleIcon" className="w-5 h-5 flex-shrink-0" />
                <span>{HR_DASHBOARD_COPY.workforceError}</span>
              </div>
            )}
            {timesheetError && (
              <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 text-blue-800 rounded-lg p-3 text-sm">
                <Icon name="InformationCircleIcon" className="w-5 h-5 flex-shrink-0" />
                <span>{HR_DASHBOARD_COPY.timesheetUnavailable}</span>
              </div>
            )}
          </div>
        )}

        {/* ── KPI tile strip ───────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-3 sm:gap-4">
          {HR_DASHBOARD_KPIS.map((kpi) => (
            <KpiTile
              key={kpi.id}
              kpi={kpi}
              value={kpi.compute(ctx)}
              onClick={() => setReportKpiId(kpi.id)}
            />
          ))}
        </div>

        {/* ── KPI drill-down report modal ──────────────────────────────── */}
        {reportKpiId && (
          <KpiReportModal
            reportId={reportKpiId}
            ctx={ctx}
            onClose={() => setReportKpiId(null)}
          />
        )}

        {/* ── Payroll Snapshot KPI strip (secondary row) ───────────────── */}
        {HR_DASHBOARD_SECTIONS.payrollSnapshot && (
          <div>
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                {HR_DASHBOARD_COPY.sectionPayrollSnapshot}
              </span>
              {loadingPayroll && (
                <Icon name="ArrowPathIcon" className="w-3.5 h-3.5 text-slate-400 animate-spin" />
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {HR_DASHBOARD_PAYROLL_KPIS.map((kpi, idx) => (
                <PayrollKpiTile
                  key={kpi.id}
                  kpi={kpi}
                  value={payrollKpiValues[idx]}
                  onClick={() => navigate('/hr/payroll')}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Approval Pipeline Tracker (DISABLED - feature not implemented yet) ─────────────── */}
        {/* {isSuperAdmin && trackerData && (
          <ApprovalPipelineWidget
            data={trackerData}
            onViewAll={() => navigate('/hr/payroll')}
          />
        )} */}

        {/* ── Pending Actions inbox ────────────────────────────────────── */}
        {HR_DASHBOARD_SECTIONS.pendingActions && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">{HR_DASHBOARD_COPY.sectionPending}</h2>
                <p className="text-xs text-slate-500">{HR_DASHBOARD_COPY.sectionPendingHint}</p>
              </div>
              {totalPending === 0 && (
                <div className="flex items-center gap-1.5 text-emerald-600 text-xs font-semibold bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg">
                  <Icon name="CheckCircleIcon" className="w-4 h-4" />
                  {HR_DASHBOARD_COPY.emptyPending}
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {HR_DASHBOARD_PENDING_TYPES.map((type) => (
                <PendingActionCard key={type.id} type={type} pending={pending} navigate={navigate} />
              ))}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* SOFT-CODED: Consolidated Leave Records Report (HR Manager Dashboard) */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {HR_DASHBOARD_SECTIONS.leaveRecordsConsolidated && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            {/* Header */}
            <div className={`bg-gradient-to-r ${HR_DASHBOARD_LEAVE_REPORT.accentGradient} rounded-xl p-5 mb-6 text-white`}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center">
                  <Icon name={HR_DASHBOARD_LEAVE_REPORT.icon} className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">{HR_DASHBOARD_LEAVE_REPORT.title}</h2>
                  <p className="text-sm text-white/80">{HR_DASHBOARD_LEAVE_REPORT.subtitle}</p>
                </div>
              </div>
              
              {/* Quick Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {HR_DASHBOARD_LEAVE_REPORT.quickStats.map(stat => {
                  const count = stat.key === 'total' ? filteredLeaveRecords.length :
                                stat.key === 'pending' ? filteredLeaveRecords.filter(r => r.status === 'PENDING').length :
                                stat.key === 'approved' ? filteredLeaveRecords.filter(r => r.status === 'APPROVED').length :
                                stat.key === 'rejected' ? filteredLeaveRecords.filter(r => ['REJECTED', 'RM_REJECTED'].includes(r.status)).length : 0
                  return (
                    <div key={stat.key} className="bg-white/10 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Icon name={stat.icon} className="w-4 h-4" />
                        <span className="text-xs text-white/70">{stat.label}</span>
                      </div>
                      <div className="text-2xl font-bold">{count}</div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3 mb-4">
              {/* Search */}
              <div className="relative flex-1 min-w-[200px]">
                <Icon name="MagnifyingGlassIcon" className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by employee or reason..."
                  value={leaveSearchQuery}
                  onChange={(e) => setLeaveSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              
              {/* Status Filter */}
              <select
                value={leaveStatusFilter}
                onChange={(e) => setLeaveStatusFilter(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                {HR_DASHBOARD_LEAVE_REPORT.statusFilters.map(f => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
              
              {/* Type Filter */}
              <select
                value={leaveTypeFilter}
                onChange={(e) => setLeaveTypeFilter(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                {HR_DASHBOARD_LEAVE_REPORT.leaveTypeFilters.map(f => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
              
              {/* Page Size */}
              <select
                value={leavePageSize}
                onChange={(e) => setLeavePageSize(Number(e.target.value))}
                className="px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                {HR_DASHBOARD_LEAVE_REPORT.pageSizeOptions.map(size => (
                  <option key={size} value={size}>{size} per page</option>
                ))}
              </select>
            </div>

            {/* Table */}
            {loadingLeaveRecords ? (
              <div className="text-center py-12 text-slate-500">Loading leave records...</div>
            ) : filteredLeaveRecords.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <Icon name="InboxIcon" className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                <p>No leave records found matching your filters</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200">
                        {HR_DASHBOARD_LEAVE_REPORT.columns.map(col => (
                          <th key={col.key} className={`${col.width} px-3 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider`}>
                            {col.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredLeaveRecords.slice((leaveCurrentPage - 1) * leavePageSize, leaveCurrentPage * leavePageSize).map((record, idx) => (
                        <tr key={record.id || idx} className="hover:bg-slate-50">
                          {HR_DASHBOARD_LEAVE_REPORT.columns.map(col => {
                            const value = record[col.key]
                            if (col.type === 'status-badge') {
                              const colors = HR_DASHBOARD_LEAVE_REPORT.statusColors[value] || HR_DASHBOARD_LEAVE_REPORT.statusColors.PENDING
                              return (
                                <td key={col.key} className="px-3 py-3">
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold border ${colors.bg} ${colors.text} ${colors.border}`}>
                                    {value || 'Unknown'}
                                  </span>
                                </td>
                              )
                            } else if (col.type === 'badge') {
                              const leaveTypeKey = (record.leave_type_detail?.code || value || 'other').toLowerCase()
                              const colors = HR_DASHBOARD_LEAVE_REPORT.leaveTypeColors[leaveTypeKey] || HR_DASHBOARD_LEAVE_REPORT.leaveTypeColors.other
                              return (
                                <td key={col.key} className="px-3 py-3">
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold ${colors.bg} ${colors.text}`}>
                                    {record.leave_type_detail?.name || value || 'Unknown'}
                                  </span>
                                </td>
                              )
                            } else if (col.type === 'date') {
                              return <td key={col.key} className="px-3 py-3 text-slate-600">{value ? formatDate(value) : '—'}</td>
                            } else if (col.type === 'datetime') {
                              return <td key={col.key} className="px-3 py-3 text-slate-600 text-xs">{value ? new Date(value).toLocaleString() : '—'}</td>
                            } else if (col.type === 'number') {
                              return <td key={col.key} className="px-3 py-3 text-slate-900 font-semibold">{value ?? '—'}</td>
                            } else {
                              return <td key={col.key} className="px-3 py-3 text-slate-600">{value || '—'}</td>
                            }
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                {/* Pagination */}
                {filteredLeaveRecords.length > leavePageSize && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-200">
                    <div className="text-sm text-slate-500">
                      Showing {((leaveCurrentPage - 1) * leavePageSize) + 1} to {Math.min(leaveCurrentPage * leavePageSize, filteredLeaveRecords.length)} of {filteredLeaveRecords.length} records
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setLeaveCurrentPage(p => Math.max(1, p - 1))}
                        disabled={leaveCurrentPage === 1}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Previous
                      </button>
                      <span className="text-sm text-slate-600">
                        Page {leaveCurrentPage} of {Math.ceil(filteredLeaveRecords.length / leavePageSize)}
                      </span>
                      <button
                        onClick={() => setLeaveCurrentPage(p => Math.min(Math.ceil(filteredLeaveRecords.length / leavePageSize), p + 1))}
                        disabled={leaveCurrentPage >= Math.ceil(filteredLeaveRecords.length / leavePageSize)}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Main grid ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Live activity feed (spans 1 col, tall) */}
          {HR_DASHBOARD_SECTIONS.liveFeed && (
            <div className="lg:row-span-2">
              <Section
                title={HR_DASHBOARD_COPY.sectionLive}
                hint={HR_DASHBOARD_COPY.sectionLiveHint}
                icon="SignalIcon"
                action={
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700 text-[10px] font-bold tracking-wider">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                    {HR_DASHBOARD_COPY.liveBadge}
                  </span>
                }
              >
                {liveFeed.length === 0 ? (
                  <div className="text-sm text-slate-500 italic py-6 text-center">
                    {HR_DASHBOARD_COPY.emptyLive}
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 -my-2">
                    {liveFeed.map((row, i) => (
                      <LiveFeedRow key={`${row.employee_code || i}-${row.punch_time || i}`} row={row} />
                    ))}
                  </div>
                )}
              </Section>
            </div>
          )}

          {/* Today punctuality */}
          {HR_DASHBOARD_SECTIONS.todayPunctuality && (
            <Section
              title={HR_DASHBOARD_COPY.sectionToday}
              hint={HR_DASHBOARD_COPY.sectionTodayHint}
              icon="ClockIcon"
            >
              {punctuality.total === 0 ? (
                <div className="text-sm text-slate-500 italic py-6 text-center">
                  {HR_DASHBOARD_COPY.emptyDaily}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3">
                      <div className="text-2xl font-bold text-emerald-700">{punctuality.onTime}</div>
                      <div className="text-[11px] text-emerald-600 uppercase tracking-wider mt-0.5">On time</div>
                    </div>
                    <div className="rounded-xl bg-amber-50 border border-amber-100 p-3">
                      <div className="text-2xl font-bold text-amber-700">{punctuality.late}</div>
                      <div className="text-[11px] text-amber-600 uppercase tracking-wider mt-0.5">Late</div>
                    </div>
                    <div className="rounded-xl bg-blue-50 border border-blue-100 p-3">
                      <div className="text-2xl font-bold text-blue-700">{punctuality.full}</div>
                      <div className="text-[11px] text-blue-600 uppercase tracking-wider mt-0.5">Full day</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
                      <span className="text-slate-600">On-time rate</span>
                      <span className="font-semibold text-slate-900">{punctuality.onTimePct}</span>
                    </div>
                    <div className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
                      <span className="text-slate-600">Full-day rate</span>
                      <span className="font-semibold text-slate-900">{punctuality.fullPct}</span>
                    </div>
                  </div>
                </div>
              )}
            </Section>
          )}

          {/* Month-to-date */}
          {HR_DASHBOARD_SECTIONS.monthRollup && (
            <Section
              title={HR_DASHBOARD_COPY.sectionMonth}
              hint={HR_DASHBOARD_COPY.sectionMonthHint}
              icon="CalendarIcon"
            >
              {monthRollup.employees === 0 ? (
                <div className="text-sm text-slate-500 italic py-6 text-center">
                  {HR_DASHBOARD_COPY.emptyMonthly}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                    <div className="text-2xl font-bold text-slate-900">{monthRollup.totalHours.toLocaleString()}</div>
                    <div className="text-[11px] text-slate-500 uppercase tracking-wider mt-0.5">Total hours</div>
                  </div>
                  <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                    <div className="text-2xl font-bold text-slate-900">{monthRollup.avgHoursPerEmployee}</div>
                    <div className="text-[11px] text-slate-500 uppercase tracking-wider mt-0.5">Avg hrs / emp</div>
                  </div>
                  <div className="rounded-xl bg-blue-50 border border-blue-100 p-3">
                    <div className="text-2xl font-bold text-blue-700">{monthRollup.totalFull.toLocaleString()}</div>
                    <div className="text-[11px] text-blue-600 uppercase tracking-wider mt-0.5">Full days</div>
                  </div>
                  <div className="rounded-xl bg-amber-50 border border-amber-100 p-3">
                    <div className="text-2xl font-bold text-amber-700">{monthRollup.totalLate.toLocaleString()}</div>
                    <div className="text-[11px] text-amber-600 uppercase tracking-wider mt-0.5">Late arrivals</div>
                  </div>
                </div>
              )}
            </Section>
          )}

          {/* Workforce composition — Status + Department */}
          {HR_DASHBOARD_SECTIONS.workforceComposition && (
            <Section
              title={HR_DASHBOARD_COPY.sectionWorkforce}
              hint={HR_DASHBOARD_COPY.sectionWorkforceHint}
              icon="UsersIcon"
              action={
                <Link to="/hr/employees" className="text-xs font-semibold text-blue-600 hover:underline">
                  View directory →
                </Link>
              }
            >
              {loadingWorkforce ? (
                <div className="text-sm text-slate-500 italic py-6 text-center">
                  {HR_DASHBOARD_COPY.loading}
                </div>
              ) : workforce.length === 0 ? (
                <div className="text-sm text-slate-500 italic py-6 text-center">
                  {HR_DASHBOARD_COPY.emptyDept}
                </div>
              ) : (
                <div className="space-y-5">
                  <div>
                    <div className="text-xs text-slate-500 mb-2 uppercase tracking-wider">Status distribution</div>
                    <StatusStack items={statusDist} total={workforce.length} />
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 mb-2 uppercase tracking-wider">Top departments</div>
                    <BarChart items={deptBars} emptyMessage={HR_DASHBOARD_COPY.emptyDept} />
                  </div>
                </div>
              )}
            </Section>
          )}

          {/* Discipline coverage */}
          {HR_DASHBOARD_SECTIONS.workforceComposition && (
            <Section
              title="Engineering disciplines"
              hint="Workforce spread across Oil & Gas EPC specialisations"
              icon="BeakerIcon"
            >
              {loadingWorkforce ? (
                <div className="text-sm text-slate-500 italic py-6 text-center">
                  {HR_DASHBOARD_COPY.loading}
                </div>
              ) : (
                <BarChart items={disciplineBars} emptyMessage={HR_DASHBOARD_COPY.emptyDiscipline} />
              )}
            </Section>
          )}
        </div>

        {/* ── Recent joiners ─────────────────────────────────────────── */}
        {HR_DASHBOARD_SECTIONS.recentJoiners && (
          <Section
            title={HR_DASHBOARD_COPY.sectionJoiners}
            hint={HR_DASHBOARD_COPY.sectionJoinersHint}
            icon="SparklesIcon"
          >
            {joiners.length === 0 ? (
              <div className="text-sm text-slate-500 italic py-6 text-center">
                {HR_DASHBOARD_COPY.emptyJoiners}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {joiners.map((emp) => (
                  <JoinerCard key={emp.id || emp.user?.id || emp.employee_id} emp={emp} />
                ))}
              </div>
            )}
          </Section>
        )}

        {/* ── Quick links ─────────────────────────────────────────────── */}
        {HR_DASHBOARD_SECTIONS.quickLinks && (
          <Section title={HR_DASHBOARD_COPY.sectionLinks} icon="BoltIcon">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {HR_DASHBOARD_QUICK_LINKS.map((link) => (
                <QuickLink key={link.id} link={link} />
              ))}
            </div>
          </Section>
        )}

        {/* ── Footer note ─────────────────────────────────────────────── */}
        <div className="text-center text-[11px] text-slate-400 py-2">
          Data sources: RBAC users · biometric timesheet · activity feed —
          auto-refresh every {Math.round(HR_DASHBOARD_POLL_MS / 1000)} seconds
        </div>
      </div>
    </div>
  )
}
