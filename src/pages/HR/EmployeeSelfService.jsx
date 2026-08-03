/**
 * Employee Self-Service (ESS) Portal
 * Route: /hr/leave
 * ============================================================
 * A standalone employee-facing dashboard. Read-only integration
 * with existing payroll, timesheet, and RBAC services.
 *
 * ZERO modification to payroll / attendance / employee business logic.
 * All data is consumed via existing service layer (read-only where applicable).
 *
 * Sections:
 *  0 \u2014 Overview (profile header + today's status + AI insights)
 *  1 \u2014 Leave (balance cards + request form)
 *  2 \u2014 Attendance (charts + calendar heatmap)
 *  3 \u2014 Timesheet (hours breakdown + trends)
 *  4 \u2014 Payroll (read-only snapshot)
 *  5 \u2014 Team Calendar (team availability)
 *  6 \u2014 Digital Twin (health scores)
 *  7 \u2014 Notifications
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSelector } from 'react-redux'
import * as HeroIcons from '@heroicons/react/24/outline'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  RadialBarChart, RadialBar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, AreaChart, Area,
} from 'recharts'
import PeopleNav from '../../components/PeopleNav/PeopleNav'
import rbacService   from '../../services/rbac.service'
import payrollService from '../../services/payroll.service'
import timesheetSvc   from '../../services/timesheet.service'
import { fmtCurrency } from '../../config/hrPayroll.config'
import { ESS_LEAVE_TYPE_CONFIG, ESS_FEATURES, ESS_LEAVE_FORM_FIELDS, LEAVE_YEAR, DAILY_TRACKER_PRIORITIES, DAILY_TRACKER_STATUSES, DAILY_TRACKER_PROJECT_CATEGORIES, DAILY_TRACKER_COPY, DAILY_TRACKER_APPROVAL_STATUSES, DAILY_TRACKER_WIZARD_STEPS, DAILY_TRACKER_SUBMIT_TO_OPTIONS, ESS_ATT_MONTHS_BACK, ESS_ATT_STANDARD_DAY_HRS, ESS_ATT_MAX_DAILY_HRS, ESS_ATT_STANDARD_WORKING_DAYS, ESS_ATT_RATE_GOOD, ESS_ATT_RATE_WARN, ESS_ATT_PARTIAL_DAY_HRS, ESS_ATT_OVERTIME_HRS, ESS_ATT_FEATURES, ESS_ATT_DAY_STATUS, ESS_ATT_DOW, ESS_ATT_COPY, ESS_TIMESHEET_TABS, ESS_TIMESHEET_DEFAULT_TAB, ESS_TIMESHEET_POLL_MS, ESS_TIMESHEET_COPY, ESS_TIMESHEET_STATUS } from '../../config/hrLeave.config'

// -----------------------------------------------------------------------------
// Soft-coded configuration
// -----------------------------------------------------------------------------

const ESS_TABS = [
  { id: 'overview',    label: 'Overview',        icon: 'HomeIcon' },
  { id: 'leave',       label: 'Leave',           icon: 'CalendarDaysIcon' },
  { id: 'attendance',  label: 'Attendance',      icon: 'ClipboardDocumentCheckIcon' },
  { id: 'timesheet',   label: 'Timesheet',       icon: 'ClockIcon' },
  { id: 'payroll',     label: 'Payroll',         icon: 'BanknotesIcon' },
  { id: 'team',          label: 'Team',            icon: 'UserGroupIcon' },
  { id: 'daily_tracker', label: 'Daily Tracker',   icon: 'ClipboardDocumentListIcon' },
  { id: 'site_visits', label: 'Site Visits',    icon: 'MapPinIcon' },
  { id: 'twin',        label: 'Digital Twin',    icon: 'SparklesIcon' },
  { id: 'notifications', label: 'Notifications', icon: 'BellIcon' },
]

// Leave type config sourced from hrLeave.config.js \u2014 single source of truth
const LEAVE_TYPE_CONFIG = ESS_LEAVE_TYPE_CONFIG

// -- Soft-coded display characters (Unicode escapes prevent encoding corruption)
const EMPTY_DISPLAY    = '\u2014'  // em dash   for null/undefined value fallback
const ELLIPSIS_DISPLAY = '\u2026'  // ellipsis  for loading/placeholder text
const BULLET_DISPLAY   = '\u00B7'  // middle dot for metadata separators

const ATTENDANCE_STATUS_MAP = {
  present:   { label: 'Present',         dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  absent:    { label: 'Absent',          dot: 'bg-rose-500',    badge: 'bg-rose-50 text-rose-700 border-rose-200' },
  leave:     { label: 'On Leave',        dot: 'bg-amber-500',   badge: 'bg-amber-50 text-amber-700 border-amber-200' },
  remote:    { label: 'Remote Work',     dot: 'bg-blue-500',    badge: 'bg-blue-50 text-blue-700 border-blue-200' },
  weekend:   { label: 'Weekend',         dot: 'bg-slate-400',   badge: 'bg-slate-50 text-slate-500 border-slate-200' },
  holiday:   { label: 'Public Holiday',  dot: 'bg-purple-500',  badge: 'bg-purple-50 text-purple-700 border-purple-200' },
  missing:   { label: 'Missing',         dot: 'bg-red-500',     badge: 'bg-red-50 text-red-700 border-red-200' },
}

const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

const SCORE_CONFIG = [
  { id: 'attendance',   label: 'Attendance',           color: '#3b82f6', icon: 'ClipboardDocumentCheckIcon' },
  { id: 'productivity', label: 'Productivity',          color: '#10b981', icon: 'ChartBarIcon' },
  { id: 'timesheet',    label: 'Timesheet Compliance', color: '#f59e0b', icon: 'ClockIcon' },
  { id: 'leave',        label: 'Leave Utilization',    color: '#8b5cf6', icon: 'CalendarDaysIcon' },
  { id: 'payroll',      label: 'Payroll Consistency',  color: '#ef4444', icon: 'BanknotesIcon' },
]

const STANDARD_DAILY_HOURS = 9
const STANDARD_MONTHLY_HOURS = 198   // ~22 days Ã\u2014 9 h
const NOTIFICATION_PRIORITY = {
  high:   { badge: 'bg-rose-100 text-rose-700',   dot: 'bg-rose-500' },
  medium: { badge: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  low:    { badge: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' },
}

// -----------------------------------------------------------------------------
// Micro-components (stable references outside main component)
// -----------------------------------------------------------------------------

const Spinner = ({ size = 'md' }) => {
  const s = size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-8 h-8' : 'w-5 h-5'
  return (
    <svg className={`animate-spin ${s} text-blue-500`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
    </svg>
  )
}

const Icon = ({ name, className = 'w-5 h-5' }) => {
  const C = HeroIcons[name] || HeroIcons.QuestionMarkCircleIcon
  return <C className={className} aria-hidden="true" />
}

const KpiCard = ({ icon, label, value, sub, tone = 'blue', trend = null }) => {
  const tones = {
    blue:   { bg: 'bg-blue-50',   border: 'border-blue-100',   text: 'text-blue-700',   icon: 'text-blue-500' },
    green:  { bg: 'bg-emerald-50',border: 'border-emerald-100',text: 'text-emerald-700',icon: 'text-emerald-500' },
    amber:  { bg: 'bg-amber-50',  border: 'border-amber-100',  text: 'text-amber-700',  icon: 'text-amber-500' },
    purple: { bg: 'bg-violet-50', border: 'border-violet-100', text: 'text-violet-700', icon: 'text-violet-500' },
    rose:   { bg: 'bg-rose-50',   border: 'border-rose-100',   text: 'text-rose-700',   icon: 'text-rose-500' },
    slate:  { bg: 'bg-slate-50',  border: 'border-slate-100',  text: 'text-slate-700',  icon: 'text-slate-500' },
  }
  const t = tones[tone] || tones.blue
  return (
    <div className={`${t.bg} ${t.border} border rounded-xl p-4 flex flex-col gap-1`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</span>
        <Icon name={icon} className={`w-4 h-4 ${t.icon}`} />
      </div>
      <div className={`text-2xl font-bold ${t.text}`}>{value ?? EMPTY_DISPLAY}</div>
      {sub && <div className="text-xs text-slate-400">{sub}</div>}
      {trend !== null && (
        <div className={`text-xs flex items-center gap-1 mt-0.5 ${trend >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
          <Icon name={trend >= 0 ? 'ArrowUpIcon' : 'ArrowDownIcon'} className="w-3 h-3" />
          {Math.abs(trend)}% vs last month
        </div>
      )}
    </div>
  )
}

const SectionCard = ({ title, subtitle, icon, action, children, className = '' }) => (
  <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden ${className}`}>
    <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
      <div className="flex items-center gap-2">
        {icon && <Icon name={icon} className="w-5 h-5 text-slate-500" />}
        <div>
          <h3 className="font-semibold text-slate-800 text-sm">{title}</h3>
          {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
    <div className="p-5">{children}</div>
  </div>
)

const ProgressBar = ({ value, max, color = 'bg-blue-500', label, showPct = false }) => {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  return (
    <div className="w-full">
      {label && (
        <div className="flex justify-between text-xs text-slate-500 mb-1">
          <span>{label}</span>
          <span>{showPct ? `${pct}%` : `${value} / ${max}`}</span>
        </div>
      )}
      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-2 rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

const SkeletonBox = ({ className = '' }) => (
  <div className={`bg-slate-100 rounded-lg animate-pulse ${className}`} />
)

const EmptyNotice = ({ icon = 'InboxIcon', message = 'No data available' }) => (
  <div className="flex flex-col items-center justify-center py-10 text-slate-400 gap-2">
    <Icon name={icon} className="w-8 h-8 opacity-50" />
    <span className="text-sm">{message}</span>
  </div>
)

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

const todayStr = () => new Date().toISOString().slice(0, 10)
const nowYear  = () => new Date().getFullYear()
const nowMonth = () => new Date().getMonth() + 1

const fmtDate = (d) => {
  if (!d) return EMPTY_DISPLAY
  const dt = new Date(d)
  return dt.toLocaleDateString('en-AE', { day: '2-digit', month: 'short', year: 'numeric' })
}

// Formats an ISO datetime string into a readable time (e.g. "07:45")
// Returns null if the value is empty or unparseable
const fmtTime = (raw) => {
  if (!raw) return null
  try {
    const d = new Date(raw)
    if (isNaN(d.getTime())) return null
    return d.toLocaleTimeString('en-AE', { hour: '2-digit', minute: '2-digit', hour12: false })
  } catch { return null }
}

const fmtHours = (h) => {
  if (h === null || h === undefined) return EMPTY_DISPLAY
  const n = Number(h)
  if (isNaN(n)) return EMPTY_DISPLAY
  const hrs = Math.floor(n)
  const mins = Math.round((n - hrs) * 60)
  return `${hrs}h${mins > 0 ? ` ${mins}m` : ''}`
}

const avatarInitials = (name) => {
  if (!name) return '??'
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('')
}

// Soft-coded: role entries from /rbac/users/me/ can be either a string or an
// object { id, name, code, level }. Centralise the extraction here so no
// component ever renders a raw object as a React child.
const ROLE_LABEL_FIELDS = ['name', 'code', 'label']
const roleLabel = (role) => {
  if (!role) return ''
  if (typeof role === 'string') return role
  for (const field of ROLE_LABEL_FIELDS) {
    if (role[field] && typeof role[field] === 'string') return role[field]
  }
  return String(role.id ?? '')
}

// Build a simple AI insight engine from live data
const generateInsights = ({ leaveRecord, monthlyTs, today, slips }) => {
  const insights = []
  const now = new Date()

  if (leaveRecord) {
    const bal = Number(leaveRecord.leave_balance) || 0
    const rate = leaveRecord.total_earned > 0
      ? Math.round((leaveRecord.total_taken / leaveRecord.total_earned) * 100)
      : 0
    insights.push({
      id: 'leave_balance',
      icon: 'CalendarDaysIcon',
      severity: bal < 3 ? 'warning' : 'info',
      title: `${bal.toFixed(1)} annual leave days remaining`,
      description: bal < 3
        ? 'Your leave balance is running low. Plan your time off accordingly.'
        : `You have used ${rate}% of your annual leave entitlement this year.`,
    })
  }

  if (monthlyTs) {
    const totalHrs = Number(monthlyTs.total_hours) || 0
    const otHrs    = Number(monthlyTs.total_overtime) || 0
    const days     = Number(monthlyTs.working_days) || 0
    const attRate  = days > 0 && monthlyTs.present_days != null
      ? Math.round((monthlyTs.present_days / days) * 100)
      : null

    if (attRate !== null) {
      insights.push({
        id: 'attendance_rate',
        icon: 'ClipboardDocumentCheckIcon',
        severity: attRate >= 95 ? 'success' : attRate >= 80 ? 'warning' : 'error',
        title: `Attendance rate this month: ${attRate}%`,
        description: attRate >= 95
          ? 'Excellent attendance \u2014 keep it up!'
          : `Your attendance is below target. ${days - (monthlyTs.present_days || 0)} working days were missed.`,
      })
    }

    if (otHrs > 0) {
      insights.push({
        id: 'overtime',
        icon: 'ClockIcon',
        severity: 'info',
        title: `${fmtHours(otHrs)} overtime worked this month`,
        description: otHrs > 20
          ? `High overtime detected. ${fmtHours(otHrs)} extra hours logged \u2014 consider discussing workload with your manager.`
          : `You logged ${fmtHours(otHrs)} overtime hours this month.`,
      })
    }

    if (totalHrs < STANDARD_MONTHLY_HOURS * 0.8 && days > 10) {
      insights.push({
        id: 'low_hours',
        icon: 'ExclamationCircleIcon',
        severity: 'warning',
        title: 'Total hours below expected',
        description: `You have logged ${fmtHours(totalHrs)} this month. Expected: ~${fmtHours(STANDARD_MONTHLY_HOURS)}.`,
      })
    }
  }

  if (slips && slips.length > 0) {
    const latest = slips[0]
    const net = parseFloat(latest.net_salary) || 0
    if (net > 0) {
      insights.push({
        id: 'payslip',
        icon: 'BanknotesIcon',
        severity: 'info',
        title: `Latest payslip: ${fmtCurrency(net)} net`,
        description: `Your most recent salary slip (${MONTH_SHORT[(latest.month || 1) - 1]} ${latest.year}) has status: ${latest.status || 'generated'}.`,
      })
    }
  }

  if (insights.length === 0) {
    insights.push({
      id: 'all_good',
      icon: 'CheckCircleIcon',
      severity: 'success',
      title: 'Everything looks good!',
      description: 'No outstanding items require your attention right now.',
    })
  }

  return insights
}

const INSIGHT_TONES = {
  success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  info:    'bg-blue-50 border-blue-200 text-blue-800',
  warning: 'bg-amber-50 border-amber-200 text-amber-800',
  error:   'bg-rose-50 border-rose-200 text-rose-800',
}

// -----------------------------------------------------------------------------
// Section: Employee Profile Header
// -----------------------------------------------------------------------------

const EmployeeProfileHeader = ({ profile, leaveRecord, monthlyTs, salaryInfo, loading }) => {
  const name = profile
    ? [profile.first_name, profile.last_name].filter(Boolean).join(' ') || profile.username
    : null
  const initials = name ? avatarInitials(name) : '??'

  const quickStats = [
    {
      label: 'Leave Balance',
      value: leaveRecord ? `${Number(leaveRecord.leave_balance).toFixed(1)} d` : EMPTY_DISPLAY,
      icon: 'CalendarDaysIcon',
      tone: 'blue',
    },
    {
      label: 'Month Hours',
      value: monthlyTs ? fmtHours(monthlyTs.total_hours) : EMPTY_DISPLAY,
      icon: 'ClockIcon',
      tone: 'green',
    },
    {
      label: 'Month OT',
      value: monthlyTs ? fmtHours(monthlyTs.total_overtime) : EMPTY_DISPLAY,
      icon: 'ArrowTrendingUpIcon',
      tone: 'amber',
    },
    {
      label: 'Basic Salary',
      value: salaryInfo ? fmtCurrency(salaryInfo.basic_salary) : EMPTY_DISPLAY,
      icon: 'BanknotesIcon',
      tone: 'purple',
    },
  ]

  return (
    <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 rounded-2xl shadow-lg overflow-hidden">
      <div className="px-6 py-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            {profile?.profile_picture ? (
              <img
                src={profile.profile_picture}
                alt={name}
                className="w-20 h-20 rounded-2xl object-cover border-4 border-white/30 shadow-lg"
              />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-white/20 border-4 border-white/30 flex items-center justify-center">
                <span className="text-2xl font-bold text-white">{initials}</span>
              </div>
            )}
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-400 border-2 border-white shadow" title="Active" />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            {loading ? (
              <div className="space-y-2">
                <SkeletonBox className="h-6 w-48 bg-white/20" />
                <SkeletonBox className="h-4 w-32 bg-white/20" />
              </div>
            ) : (
              <>
                <h1 className="text-2xl font-bold text-white truncate">{name || 'Employee'}</h1>
                <div className="flex flex-wrap gap-3 mt-1 text-blue-100 text-sm">
                  {profile?.employee_id && (
                    <span className="flex items-center gap-1">
                      <Icon name="IdentificationIcon" className="w-4 h-4" />
                      {profile.employee_id}
                    </span>
                  )}
                  {(profile?.engineer_profile?.designation || profile?.designation) && (
                    <span className="flex items-center gap-1">
                      <Icon name="BriefcaseIcon" className="w-4 h-4" />
                      {profile?.engineer_profile?.designation || profile?.designation}
                    </span>
                  )}
                  {profile?.department && (
                    <span className="flex items-center gap-1">
                      <Icon name="BuildingOfficeIcon" className="w-4 h-4" />
                      {profile.department}
                    </span>
                  )}
                  {profile?.email && (
                    <span className="flex items-center gap-1">
                      <Icon name="EnvelopeIcon" className="w-4 h-4" />
                      {profile.email}
                    </span>
                  )}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-400/20 text-emerald-200 text-xs font-medium border border-emerald-300/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    {profile?.is_active !== false ? 'Active Employee' : 'Inactive'}
                  </span>
                  {profile?.roles?.[0] && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/10 text-white/80 text-xs font-medium border border-white/20">
                      {roleLabel(profile.roles[0])}
                    </span>
                  )}
                </div>
              </>
            )}
          </div>

          {/* ESS badge */}
          <div className="hidden lg:flex flex-col items-end gap-1">
            <div className="flex items-center gap-2 bg-white/10 border border-white/20 rounded-xl px-4 py-2">
              <Icon name="SparklesIcon" className="w-5 h-5 text-blue-200" />
              <div>
                <div className="text-white font-semibold text-sm">My Workspace</div>
                <div className="text-blue-200 text-xs">My Profile</div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
          {quickStats.map((s) => (
            <div key={s.label} className="bg-white/10 border border-white/20 rounded-xl p-3 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-1">
                <span className="text-blue-200 text-xs">{s.label}</span>
                <Icon name={s.icon} className="w-4 h-4 text-blue-200" />
              </div>
              <div className="text-white font-bold text-lg">{s.value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// -----------------------------------------------------------------------------
// Section: Today's Status
// -----------------------------------------------------------------------------

const TodayStatusCard = ({ todayData, loading }) => {
  const status = todayData?.status || 'missing'
  const sm = ATTENDANCE_STATUS_MAP[status] || ATTENDANCE_STATUS_MAP.missing
  // Format raw ISO datetime → readable time string (e.g. "07:45"); null when no data
  const checkin  = fmtTime(todayData?.check_in_time  || todayData?.first_in)
  const checkout = fmtTime(todayData?.check_out_time || todayData?.last_out)
  // Backend returns 'hours_worked' from daily_report
  const rawHours = Number(todayData?.hours_worked || todayData?.total_hours) || 0
  // True when the API resolved but found no record for today
  const noRecord = !todayData
  // Apply max daily hours cap (soft-coded)
  const hours = Math.min(rawHours, ESS_ATT_MAX_DAILY_HRS)
  // Calculate overtime (hours beyond standard day, capped at max)
  const ot = ESS_ATT_FEATURES.showOvertime 
    ? Math.max(0, Math.min(rawHours - ESS_ATT_STANDARD_DAY_HRS, ESS_ATT_MAX_DAILY_HRS - ESS_ATT_STANDARD_DAY_HRS))
    : 0
  const utilPct  = hours > 0 ? Math.min(100, Math.round((hours / ESS_ATT_STANDARD_DAY_HRS) * 100)) : 0

  return (
    <SectionCard
      title="Today's Status"
      subtitle={fmtDate(new Date())}
      icon="SunIcon"
    >
      {loading ? (
        <div className="space-y-3">
          <SkeletonBox className="h-10 w-full" />
          <SkeletonBox className="h-6 w-3/4" />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Status badge — hidden when no biometric data is available for today */}
          {status !== 'missing' && (
            <div className="flex items-center gap-3">
              <span className={`w-3 h-3 rounded-full flex-shrink-0 ${sm.dot}`} />
              <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-semibold border ${sm.badge}`}>
                {sm.label}
              </span>
            </div>
          )}

          {/* No biometric record for today — show a neutral info strip */}
          {noRecord && (
            <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
              <Icon name="ClockIcon" className="w-3.5 h-3.5 flex-shrink-0" />
              <span>Attendance data syncs from the biometric system. Records for today will appear once available.</span>
            </div>
          )}

          <div className={`grid gap-3 ${ESS_ATT_FEATURES.showOvertime ? 'grid-cols-2' : 'grid-cols-3'}`}>
            <div className="bg-slate-50 rounded-lg p-3">
              <div className="text-xs text-slate-400 mb-1 flex items-center gap-1">
                <Icon name="ArrowRightCircleIcon" className="w-3.5 h-3.5 text-emerald-500" />
                Check-In
              </div>
              <div className={`font-bold ${checkin ? 'text-slate-800' : 'text-slate-400'}`}>{checkin ?? EMPTY_DISPLAY}</div>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <div className="text-xs text-slate-400 mb-1 flex items-center gap-1">
                <Icon name="ArrowLeftCircleIcon" className="w-3.5 h-3.5 text-rose-500" />
                Check-Out
              </div>
              <div className={`font-bold ${checkout ? 'text-slate-800' : 'text-slate-400'}`}>{checkout ?? EMPTY_DISPLAY}</div>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <div className="text-xs text-slate-400 mb-1 flex items-center gap-1">
                <Icon name="ClockIcon" className="w-3.5 h-3.5 text-blue-500" />
                Total Hours
              </div>
              <div className={`font-bold ${hours > 0 ? 'text-slate-800' : 'text-slate-400'}`}>{hours > 0 ? fmtHours(hours) : EMPTY_DISPLAY}</div>
            </div>
            {/* Overtime tile — shown only when ESS_ATT_FEATURES.showOvertime is true; set to false to hide */}
            {ESS_ATT_FEATURES.showOvertime && (
              <div className="bg-slate-50 rounded-lg p-3">
                <div className="text-xs text-slate-400 mb-1 flex items-center gap-1">
                  <Icon name="ArrowTrendingUpIcon" className="w-3.5 h-3.5 text-amber-500" />
                  Overtime
                </div>
                <div className="font-bold text-slate-800">{ot > 0 ? fmtHours(ot) : EMPTY_DISPLAY}</div>
              </div>
            )}
          </div>

          <div>
            <ProgressBar
              value={utilPct}
              max={100}
              color={utilPct >= 100 ? 'bg-emerald-500' : utilPct >= 70 ? 'bg-blue-500' : 'bg-amber-500'}
              label={`Day Utilization`}
              showPct
            />
          </div>
        </div>
      )}
    </SectionCard>
  )
}

// -----------------------------------------------------------------------------
// Section: AI Insights
// -----------------------------------------------------------------------------

const AIInsightsPanel = ({ insights, loading }) => (
  <SectionCard
    title="AI Insights"
    subtitle="Powered by RADAI Employee Intelligence"
    icon="SparklesIcon"
  >
    {loading ? (
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => <SkeletonBox key={i} className="h-14 w-full" />)}
      </div>
    ) : insights.length === 0 ? (
      <EmptyNotice icon="LightBulbIcon" message={"No insights yet \u2014 check back after data loads."} />
    ) : (
      <div className="space-y-3">
        {insights.map((ins) => (
          <div key={ins.id} className={`border rounded-xl p-3 ${INSIGHT_TONES[ins.severity] || INSIGHT_TONES.info}`}>
            <div className="flex items-start gap-2">
              <Icon name={ins.icon} className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-semibold">{ins.title}</div>
                <div className="text-xs opacity-80 mt-0.5">{ins.description}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    )}
  </SectionCard>
)

// -----------------------------------------------------------------------------
// Section: Leave Dashboard
// -----------------------------------------------------------------------------

const LeaveBalanceSection = ({ leaveRecord, requests, loading }) => {
  const taken     = Number(leaveRecord?.total_taken)    || 0
  const earned    = Number(leaveRecord?.total_earned)   || 0
  const encashed  = Number(leaveRecord?.total_encashed) || 0
  const balance   = Number(leaveRecord?.leave_balance)  || 0

  // Calculate taken days per leave type from requests (approved only)
  const approvedRequests = (requests || []).filter(r => r.status?.toUpperCase() === 'APPROVED')
  
  // Group approved requests by leave type and calculate total days taken
  const leaveTypeUsage = approvedRequests.reduce((acc, req) => {
    // Extract leave type name from API response
    // API returns: leave_type (ID) and leave_type_detail (object with name, code, etc.)
    let leaveTypeName = ''
    if (req.leave_type_detail && req.leave_type_detail.name) {
      leaveTypeName = req.leave_type_detail.name
    } else if (req.leave_type_detail && req.leave_type_detail.code) {
      leaveTypeName = req.leave_type_detail.code
    } else if (typeof req.leave_type_display === 'string') {
      leaveTypeName = req.leave_type_display
    } else if (typeof req.leave_type === 'string') {
      leaveTypeName = req.leave_type
    } else {
      leaveTypeName = 'annual'  // default fallback
    }
    
    leaveTypeName = String(leaveTypeName).toLowerCase()
    const days = Number(req.duration_days || req.days_requested || req.days || 0)
    
    // Match to config key (annual, sick, emergency, etc.)
    let configKey = 'annual'  // default
    if (leaveTypeName.includes('sick')) configKey = 'sick'
    else if (leaveTypeName.includes('emergency')) configKey = 'emergency'
    else if (leaveTypeName.includes('compassionate')) configKey = 'compassionate'
    else if (leaveTypeName.includes('maternity')) configKey = 'maternity'
    else if (leaveTypeName.includes('paternity')) configKey = 'paternity'
    else if (leaveTypeName.includes('study')) configKey = 'study'
    else if (leaveTypeName.includes('unpaid')) configKey = 'unpaid'
    else if (leaveTypeName.includes('annual')) configKey = 'annual'
    
    acc[configKey] = (acc[configKey] || 0) + days
    return acc
  }, {})

  // Filter to only show enabled leave types (soft-coded control)
  const leaveTypes = Object.entries(LEAVE_TYPE_CONFIG)
    .filter(([key, cfg]) => cfg.enabled !== false)  // Default to true if enabled flag not set
    .map(([key, cfg]) => ({
      ...cfg,
      key,
      balance: key === 'annual' ? balance : 0,
      taken:   leaveTypeUsage[key] || 0,  // Use calculated usage from requests
    }))

  const pieData = [
    { name: 'Taken',    value: taken,   fill: '#3b82f6' },
    { name: 'Balance',  value: balance, fill: '#10b981' },
    { name: 'Encashed', value: encashed, fill: '#f59e0b' },
  ].filter(d => d.value > 0)

  const pending  = (requests || []).filter(r => ['PENDING','RM_APPROVED'].includes(r.status?.toUpperCase()))
  const approved = (requests || []).filter(r => r.status?.toUpperCase() === 'APPROVED')
  const upcoming = approved.filter(r => new Date(r.start_date) >= new Date())

  // Check if we have leave data (for production data availability check)
  const hasLeaveData = leaveRecord && (balance > 0 || taken > 0 || earned > 0 || encashed > 0)

  return (
    <div className="space-y-5">
      {/* Leave Balance Snapshot */}
      {ESS_FEATURES.showLeaveBalanceSnapshot && (
        <>
          {(!hasLeaveData && ESS_FEATURES.requireLeaveDataForSnapshot) ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
              <div className="flex items-center gap-2">
                <Icon name="ExclamationTriangleIcon" className="w-5 h-5 flex-shrink-0" />
                <div>
                  <div className="font-semibold">Leave data not available</div>
                  <div className="text-xs text-amber-600 mt-1">
                    Leave balance records will appear here once your HR administrator configures your leave entitlement.
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <KpiCard icon="CalendarDaysIcon" label="Annual Balance"  value={`${balance.toFixed(1)} d`}  sub={`${earned.toFixed(1)} earned`} tone="blue" />
              <KpiCard icon="ClipboardDocumentCheckIcon" label="Days Taken" value={`${taken.toFixed(1)} d`} sub="This year" tone="green" />
              <KpiCard icon="BanknotesIcon" label="Encashed" value={`${encashed.toFixed(1)} d`} sub="Leave encashment" tone="amber" />
              <KpiCard icon="ClockIcon" label="Pending Requests" value={pending.length} sub="Awaiting approval" tone={pending.length > 0 ? 'rose' : 'slate'} />
            </div>
          )}
        </>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Leave type cards */}
        <div className="xl:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {leaveTypes.map((lt) => (
            <div key={lt.key} className={`${lt.bg} border rounded-xl p-4`}>
              <div className="flex items-center justify-between mb-3">
                <div className={`text-sm font-semibold ${lt.text}`}>{lt.label}</div>
                {lt.entitlement > 0 && (
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full bg-white/60 ${lt.text}`}>
                    {lt.entitlement} d/yr
                  </span>
                )}
              </div>
              {lt.key === 'annual' ? (
                <>
                  <div className={`text-3xl font-bold ${lt.text}`}>{balance.toFixed(1)}</div>
                  <div className="text-xs text-slate-500 mt-0.5">days remaining</div>
                  <div className="mt-3">
                    <ProgressBar
                      value={taken}
                      max={lt.entitlement}
                      color={lt.bar}
                      label="Used"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className={`text-3xl font-bold ${lt.text}`}>{lt.taken.toFixed(1)}</div>
                  <div className="text-xs text-slate-500 mt-0.5">days taken this year</div>
                  {lt.entitlement > 0 && (
                    <div className="mt-3">
                      <ProgressBar
                        value={lt.taken}
                        max={lt.entitlement}
                        color={lt.bar}
                        label="Used"
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>

        {/* Pie chart */}
        <SectionCard title="Leave Distribution" icon="ChartPieIcon">
          {loading ? (
            <SkeletonBox className="h-40 w-full" />
          ) : pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={pieData} dataKey="value" cx="50%" cy="50%" outerRadius={65} innerRadius={35}>
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => [`${Number(v).toFixed(1)} d`]} />
                <Legend iconType="circle" iconSize={8} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <EmptyNotice icon="ChartPieIcon" message="No leave data" />
          )}
        </SectionCard>
      </div>

      {/* Upcoming approved leaves */}
      {upcoming.length > 0 && (
        <SectionCard title="Upcoming Approved Leave" icon="CalendarDaysIcon">
          <div className="divide-y divide-slate-100">
            {upcoming.slice(0, 5).map((r) => (
              <div key={r.id} className="py-2.5 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-slate-800">{r.leave_type_display || r.leave_type || 'Leave'}</div>
                  <div className="text-xs text-slate-400">{fmtDate(r.start_date)} â†’ {fmtDate(r.end_date)}</div>
                </div>
                <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-full">
                  {r.duration_days || '?'} day{r.duration_days !== 1 ? 's' : ''}
                </span>
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  )
}

// -----------------------------------------------------------------------------
// Section: Leave Request Form
// -----------------------------------------------------------------------------

const LeaveRequestForm = ({ leaveTypes, leaveRecord, requests, onSubmit, submitting, submitResult }) => {
  const [form, setForm] = useState({
    leave_type: '',
    start_date: '',
    end_date: '',
    half_day: false,
    reason: '',
    // SOFT-CODED: Additional fields from ESS_LEAVE_FORM_FIELDS config
    contact_number: '',
    substitute_name: '',
    attachment: null,
  })
  const [calcDays, setCalcDays] = useState(null)
  const [conflict, setConflict] = useState(false)
  const fileInputRef = useRef(null)

  const balance = Number(leaveRecord?.leave_balance) || 0

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  useEffect(() => {
    if (!form.start_date || !form.end_date) { setCalcDays(null); return }
    const s = new Date(form.start_date)
    const e = new Date(form.end_date)
    if (e < s) { setCalcDays(null); return }
    let days = 0
    const d = new Date(s)
    while (d <= e) {
      const dow = d.getDay()
      if (dow !== 0 && dow !== 6) days++
      d.setDate(d.getDate() + 1)
    }
    if (form.half_day) days = Math.max(0.5, days - 0.5)
    setCalcDays(days)

    // Conflict detection against approved requests
    const hasConflict = (requests || []).some(r => {
      if (!['approved', 'pending'].includes(r.status)) return false
      const rs = new Date(r.start_date)
      const re = new Date(r.end_date)
      return s <= re && e >= rs
    })
    setConflict(hasConflict)
  }, [form.start_date, form.end_date, form.half_day, requests])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.leave_type || !form.start_date || !form.end_date) return
    onSubmit(form)
  }

  const insufficient = form.leave_type === 'annual' && calcDays !== null && calcDays > balance

  // Default leave types (fallback when API returns nothing) — mirrors
  // ESS_LEAVE_TYPE_CONFIG enabled entries; uses category as id so the
  // backend filter (t.category || t.code) resolves correctly.
  const defaultTypes = Object.entries(LEAVE_TYPE_CONFIG)
    .filter(([, cfg]) => cfg.enabled !== false)
    .map(([key, cfg]) => ({ id: key, name: cfg.label }))
  const types = leaveTypes?.length > 0 ? leaveTypes : defaultTypes

  return (
    <SectionCard title="Apply for Leave" subtitle="Submit a new leave request" icon="PencilSquareIcon">
      {submitResult?.success && (
        <div className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl p-3 text-sm flex items-center gap-2">
          <Icon name="CheckCircleIcon" className="w-4 h-4 flex-shrink-0" />
          {submitResult.message || 'Leave request submitted successfully!'}
        </div>
      )}
      {submitResult?.error && (
        <div className="mb-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-3 text-sm flex items-center gap-2">
          <Icon name="ExclamationCircleIcon" className="w-4 h-4 flex-shrink-0" />
          {submitResult.error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Leave type */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Leave Type *</label>
            <select
              value={form.leave_type}
              onChange={(e) => set('leave_type', e.target.value)}
              required
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
            >
              <option value="">Select leave type{ELLIPSIS_DISPLAY}</option>
              {types.map(t => (
                <option key={t.id || t.name} value={t.id || t.name}>{t.name || t.label}</option>
              ))}
            </select>
          </div>

          {/* Half day toggle */}
          <div className="flex items-end">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <div
                onClick={() => set('half_day', !form.half_day)}
                className={`w-10 h-5 rounded-full transition-colors ${form.half_day ? 'bg-blue-500' : 'bg-slate-200'} relative`}
              >
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${form.half_day ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </div>
              <span className="text-sm text-slate-600">Half Day</span>
            </label>
          </div>

          {/* Start date */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Start Date *</label>
            <input
              type="date"
              value={form.start_date}
              onChange={(e) => set('start_date', e.target.value)}
              required
              min={todayStr()}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          {/* End date */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">End Date *</label>
            <input
              type="date"
              value={form.end_date}
              onChange={(e) => set('end_date', e.target.value)}
              required
              min={form.start_date || todayStr()}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
        </div>

        {/* Reason */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Reason</label>
          <textarea
            value={form.reason}
            onChange={(e) => set('reason', e.target.value)}
            rows={3}
            placeholder={"Briefly describe your reason for leave\u2026"}
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
          />
        </div>
        
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* SOFT-CODED: Additional fields from ESS_LEAVE_FORM_FIELDS config     */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        
        {/* Contact Number */}
        {ESS_LEAVE_FORM_FIELDS.contact_number?.enabled && (
          <div className={ESS_LEAVE_FORM_FIELDS.contact_number.grid}>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              {ESS_LEAVE_FORM_FIELDS.contact_number.label}
              {ESS_LEAVE_FORM_FIELDS.contact_number.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <input
              type="tel"
              value={form.contact_number}
              onChange={(e) => set('contact_number', e.target.value)}
              required={ESS_LEAVE_FORM_FIELDS.contact_number.required}
              placeholder={ESS_LEAVE_FORM_FIELDS.contact_number.placeholder}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
        )}
        
        {/* Substitute Employee */}
        {ESS_LEAVE_FORM_FIELDS.substitute_name?.enabled && (
          <div className={ESS_LEAVE_FORM_FIELDS.substitute_name.grid}>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              {ESS_LEAVE_FORM_FIELDS.substitute_name.label}
              {ESS_LEAVE_FORM_FIELDS.substitute_name.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <input
              type="text"
              value={form.substitute_name}
              onChange={(e) => set('substitute_name', e.target.value)}
              required={ESS_LEAVE_FORM_FIELDS.substitute_name.required}
              placeholder={ESS_LEAVE_FORM_FIELDS.substitute_name.placeholder}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
        )}
        
        {/* Supporting Documents */}
        {ESS_LEAVE_FORM_FIELDS.attachment?.enabled && (
          <div className={ESS_LEAVE_FORM_FIELDS.attachment.grid}>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              {ESS_LEAVE_FORM_FIELDS.attachment.label}
              {ESS_LEAVE_FORM_FIELDS.attachment.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <div className="relative">
              <input
                ref={fileInputRef}
                type="file"
                accept={ESS_LEAVE_FORM_FIELDS.attachment.accept}
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file && file.size > ESS_LEAVE_FORM_FIELDS.attachment.maxSize) {
                    alert(`File size must be less than ${ESS_LEAVE_FORM_FIELDS.attachment.maxSize / 1048576}MB`)
                    e.target.value = ''
                    return
                  }
                  set('attachment', file)
                }}
                required={ESS_LEAVE_FORM_FIELDS.attachment.required}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              {form.attachment && (
                <div className="mt-1 text-xs text-slate-600 flex items-center gap-2">
                  <Icon name="DocumentIcon" className="w-3 h-3" />
                  <span className="truncate">{form.attachment.name}</span>
                  <span className="text-slate-400">({(form.attachment.size / 1024).toFixed(1)} KB)</span>
                </div>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Accepted formats: PDF, JPG, PNG, DOC, DOCX (max {ESS_LEAVE_FORM_FIELDS.attachment.maxSize / 1048576}MB)
            </p>
          </div>
        )}

        {/* Impact preview */}
        {calcDays !== null && (
          <div className={`rounded-xl p-3 border text-sm ${
            insufficient ? 'bg-rose-50 border-rose-200 text-rose-700'
            : conflict    ? 'bg-amber-50 border-amber-200 text-amber-700'
            : 'bg-blue-50 border-blue-200 text-blue-700'
          }`}>
            <div className="flex items-center gap-2 font-semibold mb-1">
              <Icon name={insufficient ? 'ExclamationCircleIcon' : conflict ? 'ExclamationTriangleIcon' : 'InformationCircleIcon'} className="w-4 h-4" />
              Leave Impact Preview
            </div>
            <div className="text-xs space-y-0.5">
              <div>Duration: <strong>{calcDays} working day{calcDays !== 1 ? 's' : ''}</strong></div>
              {form.leave_type === 'annual' && (
                <div>Balance after approval: <strong>{(balance - calcDays).toFixed(1)} days</strong></div>
              )}
              {conflict && <div>âš  Overlapping leave request detected</div>}
              {insufficient && <div>Insufficient annual leave balance</div>}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-1">
          <div className="text-xs text-slate-400">
            Request will go to your manager for approval
          </div>
          <button
            type="submit"
            disabled={submitting || insufficient || !form.leave_type || !form.start_date || !form.end_date}
            className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? <Spinner size="sm" /> : <Icon name="PaperAirplaneIcon" className="w-4 h-4" />}
            Submit Request
          </button>
        </div>
      </form>
    </SectionCard>
  )
}

// -----------------------------------------------------------------------------
// Section: Attendance Analytics (individual — month-selectable)
// -----------------------------------------------------------------------------

const AttendanceAnalytics = ({ profile, monthlyTs, loading: parentLoading }) => {
  const now = new Date()
  const [selYear,   setSelYear]   = useState(now.getFullYear())
  const [selMonth,  setSelMonth]  = useState(now.getMonth() + 1)
  const [selData,   setSelData]   = useState(null)   // filtered employee record
  const [fetching,  setFetching]  = useState(false)

  // On initial render, seed with already-loaded parent data (avoids extra request)
  useEffect(() => {
    if (monthlyTs && selYear === now.getFullYear() && selMonth === now.getMonth() + 1) {
      setSelData(monthlyTs)
    }
  }, [monthlyTs])

  // Fetch a different month when selector changes
  useEffect(() => {
    const isCurrent = selYear === now.getFullYear() && selMonth === now.getMonth() + 1
    if (isCurrent && monthlyTs) { setSelData(monthlyTs); return }
    const code = profile?.employee_id || profile?.engineer_profile?.employee_code
    if (!code) return
    setFetching(true)
    // Use new self-service endpoint that auto-filters by logged-in user
    timesheetSvc.fetchMyMonthlyAttendance(selYear, selMonth)
      .then(res => {
        // New endpoint returns { data: {...}, employee_code, email, year, month }
        if (res?.data) {
          setSelData(res.data)
        } else {
          setSelData(null)
        }
      })
      .catch(() => setSelData(null))
      .finally(() => setFetching(false))
  }, [selYear, selMonth, profile])

  const loading = parentLoading || fetching
  const data    = selData

  // ── Derive stats ───────────────────────────────────────────────────────────
  // working_days comes from the response-level field (injected during fetch)
  const presentDays = Number(data?.days_present || data?.present_days)   || 0
  const workingDays = Number(data?.working_days || data?.working_days_in_month || data?.total_working_days || ESS_ATT_STANDARD_WORKING_DAYS)
  const absentDays  = data ? Math.max(0, workingDays - presentDays) : 0
  const attRate     = (data && workingDays > 0) ? Math.round((presentDays / workingDays) * 100) : 0

  // ── Build per-day rows from days_detail (monthly API field) ───────────────
  const dayRows = useMemo(() => {
    const details = data?.days_detail || data?.daily_breakdown || []
    const today   = new Date()
    return details.map(d => {
      const date   = d.date || d.day || ''
      const dt     = date ? new Date(date) : null
      const dow    = dt ? ESS_ATT_DOW[dt.getDay()] : ''
      // Cap hours at configured maximum (default: 9 hours fixed)
      const rawHours = Number(d.hours_worked ?? d.hours ?? 0)
      const hours    = ESS_ATT_FEATURES.capHoursAtMax 
        ? Math.min(rawHours, ESS_ATT_MAX_DAILY_HRS)
        : rawHours
      const isWknd = dt ? (dt.getDay() === 0 || dt.getDay() === 6) : false
      const isFut  = dt ? dt > today : false
      let status
      if (isWknd)       status = 'weekend'
      else if (isFut)   status = 'future'
      else if (hours >= ESS_ATT_PARTIAL_DAY_HRS) status = 'worked'
      else if (hours > 0) status = 'partial'
      else              status = 'absent'
      // Overtime calculation (only used if showOvertime is enabled)
      const ot = ESS_ATT_FEATURES.showOvertime 
        ? Math.max(0, rawHours - ESS_ATT_STANDARD_DAY_HRS)
        : 0
      return { date, dow, hours, status, ot }
    }).sort((a, b) => (a.date > b.date ? 1 : -1))
  }, [data])

  // ── Compute totals from dayRows (source of truth — API fields may be absent) ──
  const computedTotalHours   = useMemo(() => dayRows.reduce((s, r) => s + r.hours, 0), [dayRows])
  const computedOvertimeHrs  = useMemo(() => dayRows.reduce((s, r) => s + r.ot, 0), [dayRows])
  // Prefer API field for overtime if available (e.g. from userHistory), else use computed
  const overtime = Number(data?.total_overtime) > 0 ? Number(data.total_overtime) : computedOvertimeHrs

  // ── Chart data (trend line) ───────────────────────────────────────────────
  const trendData = useMemo(() =>
    dayRows
      .filter(r => r.status !== 'weekend' && r.status !== 'future')
      .map(r => ({
        date:  r.date.slice(5),   // MM-DD
        hours: r.hours,
        ot:    r.ot,
      })),
    [dayRows]
  )

  // ── Month/year selector helpers ──────────────────────────────────────────
  const monthOpts = useMemo(() => {
    const opts = []
    for (let i = 0; i <= ESS_ATT_MONTHS_BACK; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      opts.push({ year: d.getFullYear(), month: d.getMonth() + 1,
        label: `${MONTH_SHORT[d.getMonth()]} ${d.getFullYear()}` })
    }
    return opts
  }, [])

  const selectedLabel = `${MONTH_SHORT[selMonth - 1]} ${selYear}`
  const rateLabel = attRate >= ESS_ATT_RATE_GOOD
    ? ESS_ATT_COPY.rateExcellent : attRate >= ESS_ATT_RATE_WARN
    ? ESS_ATT_COPY.rateGood : ESS_ATT_COPY.rateNeeds
  const rateTone = attRate >= ESS_ATT_RATE_GOOD ? 'green' : attRate >= ESS_ATT_RATE_WARN ? 'amber' : 'rose'

  const summaryData = [
    { name: 'Present', value: presentDays, fill: '#10b981' },
    { name: 'Absent',  value: absentDays,  fill: '#ef4444' },
  ]

  return (
    <div className="space-y-5">
      {/* Month selector */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Icon name="CalendarDaysIcon" className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-700">{ESS_ATT_COPY.sectionTitle}</span>
          <span className="text-xs text-slate-400">{ESS_ATT_COPY.sectionSubtitle}</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <select
            value={`${selYear}-${selMonth}`}
            onChange={e => {
              const [y, m] = e.target.value.split('-').map(Number)
              setSelYear(y); setSelMonth(m)
            }}
            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            {monthOpts.map(o => (
              <option key={`${o.year}-${o.month}`} value={`${o.year}-${o.month}`}>{o.label}</option>
            ))}
          </select>
          {fetching && <Spinner size="sm" />}
        </div>
      </div>

      {/* KPI cards */}
      {!loading && !data ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400 text-sm space-y-2">
          <Icon name="ClipboardDocumentCheckIcon" className="w-8 h-8 mx-auto text-slate-200" />
          <p>No attendance records found for {selectedLabel}.</p>
          <p className="text-xs text-slate-300">Your employee profile may not yet be linked to the biometric system. Contact HR if this persists.</p>
        </div>
      ) : (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard icon="CheckCircleIcon"     label={ESS_ATT_COPY.kpiPresent}  value={loading ? EMPTY_DISPLAY : presentDays}          sub={`of ${workingDays} working days`}  tone="green" />
        <KpiCard icon="XCircleIcon"         label={ESS_ATT_COPY.kpiAbsent}   value={loading ? EMPTY_DISPLAY : absentDays}            sub={selectedLabel}                     tone={absentDays > 3 ? 'rose' : 'slate'} />
        <KpiCard icon="ChartBarIcon"        label={ESS_ATT_COPY.kpiRate}     value={loading ? EMPTY_DISPLAY : `${attRate}%`}         sub={rateLabel}                         tone={rateTone} />
        {ESS_ATT_FEATURES.showOvertime && (
          <KpiCard icon="ArrowTrendingUpIcon" label={ESS_ATT_COPY.kpiOvertime} value={loading ? EMPTY_DISPLAY : fmtHours(overtime)}    sub={selectedLabel}                     tone="amber" />
        )}
      </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Daily hours trend chart */}
        <div className="xl:col-span-2">
          <SectionCard title="Daily Hours Trend" subtitle={`Working hours per day — ${selectedLabel}`} icon="ClockIcon">
            {loading ? (
              <SkeletonBox className="h-52 w-full" />
            ) : trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height={210}>
                <AreaChart data={trendData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={3} />
                  <YAxis tick={{ fontSize: 10 }} domain={[0, 14]} />
                  <Tooltip formatter={(v) => [`${Number(v).toFixed(1)} h`]} />
                  <Area type="monotone" dataKey="hours" stroke="#3b82f6" fill="#dbeafe" name="Hours Worked" strokeWidth={2} />
                  {ESS_ATT_FEATURES.showOvertime && (
                    <Area type="monotone" dataKey="ot"    stroke="#f59e0b" fill="#fef3c7" name="Overtime"     strokeWidth={2} />
                  )}
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyNotice icon="ChartBarIcon" message={ESS_ATT_COPY.noData} />
            )}
          </SectionCard>
        </div>

        {/* Month summary pie */}
        <SectionCard title="Month Summary" subtitle={selectedLabel} icon="ChartPieIcon">
          {loading ? (
            <SkeletonBox className="h-52 w-full" />
          ) : (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={summaryData} dataKey="value" cx="50%" cy="50%" outerRadius={60} innerRadius={35}>
                    {summaryData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-2">
                {summaryData.map(s => (
                  <div key={s.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: s.fill }} />
                      {s.name}
                    </div>
                    <span className="font-semibold">{s.value} days</span>
                  </div>
                ))}
                <div className="pt-1 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-500">Attendance Rate</span>
                  <span className={`font-bold ${rateTone === 'green' ? 'text-emerald-600' : rateTone === 'amber' ? 'text-amber-600' : 'text-rose-600'}`}>{attRate}%</span>
                </div>
              </div>
            </>
          )}
        </SectionCard>
      </div>

      {/* Per-day detail table */}
      <SectionCard title={ESS_ATT_COPY.dailyTableTitle} subtitle={`Day-by-day log — ${selectedLabel}`} icon="TableCellsIcon">
        {loading ? (
          <SkeletonBox className="h-64 w-full" />
        ) : dayRows.length === 0 ? (
          <EmptyNotice icon="CalendarDaysIcon" message={ESS_ATT_COPY.noData} />
        ) : (
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">Date</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">Day</th>
                  <th className="px-3 py-2.5 text-center text-xs font-semibold text-slate-600 uppercase tracking-wide">Status</th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-600 uppercase tracking-wide">Hours</th>
                  {ESS_ATT_FEATURES.showOvertime && (
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-600 uppercase tracking-wide">Overtime</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {dayRows.map((row, i) => {
                  const sm = ESS_ATT_DAY_STATUS[row.status] || ESS_ATT_DAY_STATUS.absent
                  const isWknd = row.status === 'weekend'
                  return (
                    <tr key={row.date} className={`border-b border-slate-100 ${isWknd ? 'opacity-50' : ''} ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}>
                      <td className="px-4 py-2 text-slate-800 font-medium tabular-nums">{row.date}</td>
                      <td className="px-3 py-2 text-slate-500">{row.dow}</td>
                      <td className="px-3 py-2 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${sm.badge}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${sm.dot}`} />
                          {sm.label}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                        {row.status === 'weekend' || row.status === 'future' ? EMPTY_DISPLAY : `${row.hours.toFixed(1)} h`}
                      </td>
                      {ESS_ATT_FEATURES.showOvertime && (
                        <td className="px-3 py-2 text-right tabular-nums">
                          {row.ot > 0
                            ? <span className="text-amber-600 font-medium">{row.ot.toFixed(1)} h</span>
                            : <span className="text-slate-300">{EMPTY_DISPLAY}</span>
                          }
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
              {/* Footer totals */}
              <tfoot>
                <tr className="bg-slate-100 border-t-2 border-slate-200 font-semibold">
                  <td className="px-4 py-2 text-slate-700" colSpan={2}>Total</td>
                  <td className="px-3 py-2 text-center text-slate-600">{presentDays} days present</td>
                  <td className="px-3 py-2 text-right text-slate-700">{fmtHours(computedTotalHours)}</td>
                  {ESS_ATT_FEATURES.showOvertime && (
                    <td className="px-3 py-2 text-right text-amber-600">{computedOvertimeHrs > 0 ? fmtHours(computedOvertimeHrs) : EMPTY_DISPLAY}</td>
                  )}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  )
}



// -----------------------------------------------------------------------------
// Section: ESS Timesheet (Live / Daily / Monthly tabs)
// -----------------------------------------------------------------------------

const ESSTimesheetView = ({ profile }) => {
  const [activeTab, setActiveTab] = useState(ESS_TIMESHEET_DEFAULT_TAB)
  const [liveData, setLiveData] = useState(null)
  const [dailyData, setDailyData] = useState(null)
  const [monthlyData, setMonthlyData] = useState(null)
  const [loadingLive, setLoadingLive] = useState(false)
  const [loadingDaily, setLoadingDaily] = useState(false)
  const [loadingMonthly, setLoadingMonthly] = useState(false)
  const [error, setError] = useState(null)
  
  // Date selectors for Daily and Monthly tabs
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10))
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)

  // Auto-refresh for Live tab
  const [lastRefresh, setLastRefresh] = useState(Date.now())
  
  useEffect(() => {
    if (activeTab !== 'live') return
    const interval = setInterval(() => setLastRefresh(Date.now()), ESS_TIMESHEET_POLL_MS)
    return () => clearInterval(interval)
  }, [activeTab])

  // Fetch Live data
  useEffect(() => {
    if (activeTab !== 'live') return
    setLoadingLive(true)
    setError(null)
    timesheetSvc.fetchMyLiveAttendance()
      .then(data => {
        if (!data.configured) {
          setError(ESS_TIMESHEET_COPY.notConfigured)
          setLiveData(null)
        } else if (data.error) {
          setError(data.error)
          setLiveData(null)
        } else {
          setLiveData(data)
          setError(null)
        }
      })
      .catch(err => {
        console.error('[ESS Timesheet] Live fetch failed:', err)
        setError(err?.response?.data?.error || err.message || 'Failed to load live data')
        setLiveData(null)
      })
      .finally(() => setLoadingLive(false))
  }, [activeTab, lastRefresh])

  // Fetch Daily data
  useEffect(() => {
    if (activeTab !== 'daily') return
    setLoadingDaily(true)
    setError(null)
    timesheetSvc.fetchMyDailyAttendance(selectedDate)
      .then(data => {
        if (!data.configured) {
          setError(ESS_TIMESHEET_COPY.notConfigured)
          setDailyData(null)
        } else if (data.error) {
          setError(data.error)
          setDailyData(null)
        } else {
          setDailyData(data)
          setError(null)
        }
      })
      .catch(err => {
        console.error('[ESS Timesheet] Daily fetch failed:', err)
        setError(err?.response?.data?.error || err.message || 'Failed to load daily data')
        setDailyData(null)
      })
      .finally(() => setLoadingDaily(false))
  }, [activeTab, selectedDate])

  // Fetch Monthly data
  useEffect(() => {
    if (activeTab !== 'monthly') return
    setLoadingMonthly(true)
    setError(null)
    timesheetSvc.fetchMyMonthlyAttendance(selectedYear, selectedMonth)
      .then(data => {
        if (!data.configured) {
          setError(ESS_TIMESHEET_COPY.notConfigured)
          setMonthlyData(null)
        } else if (data.error) {
          setError(data.error)
          setMonthlyData(null)
        } else {
          setMonthlyData(data)
          setError(null)
        }
      })
      .catch(err => {
        console.error('[ESS Timesheet] Monthly fetch failed:', err)
        setError(err?.response?.data?.error || err.message || 'Failed to load monthly data')
        setMonthlyData(null)
      })
      .finally(() => setLoadingMonthly(false))
  }, [activeTab, selectedYear, selectedMonth])

  return (
    <div className="space-y-5">
      {/* Tab selector */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 p-2 border-b border-slate-100">
          {ESS_TIMESHEET_TABS.map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Icon name={tab.icon} className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
        <div className="p-4 bg-slate-50 border-b border-slate-100">
          <div className="text-xs text-slate-500">
            {ESS_TIMESHEET_TABS.find(t => t.id === activeTab)?.description || ''}
          </div>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Icon name="ExclamationTriangleIcon" className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-semibold text-amber-900 text-sm mb-1">
                Unable to Load Timesheet Data
              </div>
              <div className="text-amber-700 text-sm">{error}</div>
            </div>
          </div>
        </div>
      )}

      {/* Live Tab */}
      {activeTab === 'live' && (
        <div className="space-y-5">
          {loadingLive ? (
            <div className="flex items-center justify-center py-12">
              <Spinner />
              <span className="ml-3 text-sm text-slate-500">{ESS_TIMESHEET_COPY.loading}</span>
            </div>
          ) : !liveData?.data ? (
            <EmptyNotice icon="SignalIcon" message={ESS_TIMESHEET_COPY.liveNoData} />
          ) : (
            <SectionCard title="Current Status" subtitle={liveData.as_of ? `As of ${new Date(liveData.as_of).toLocaleString()}` : 'Real-time'} icon="ClockIcon">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 rounded-lg p-4">
                    <div className="text-xs text-slate-500 mb-1">Employee Code</div>
                    <div className="text-lg font-semibold text-slate-800">{liveData.employee_code || EMPTY_DISPLAY}</div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-4">
                    <div className="text-xs text-slate-500 mb-1">Status</div>
                    <div className="flex items-center gap-2">
                      {liveData.data.is_in ? (
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-medium border ${ESS_TIMESHEET_STATUS.in.bg} ${ESS_TIMESHEET_STATUS.in.text} ${ESS_TIMESHEET_STATUS.in.border}`}>
                          <span className={`w-2 h-2 rounded-full ${ESS_TIMESHEET_STATUS.in.dot}`} />
                          {ESS_TIMESHEET_STATUS.in.label}
                        </span>
                      ) : (
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-medium border ${ESS_TIMESHEET_STATUS.out.bg} ${ESS_TIMESHEET_STATUS.out.text} ${ESS_TIMESHEET_STATUS.out.border}`}>
                          <span className={`w-2 h-2 rounded-full ${ESS_TIMESHEET_STATUS.out.dot}`} />
                          {ESS_TIMESHEET_STATUS.out.label}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                  <div className="bg-slate-50 rounded-lg p-4">
                    <div className="text-xs text-slate-500 mb-1">First Punch IN</div>
                    <div className="text-lg font-semibold text-slate-800">
                      {liveData.data.first_in ? new Date(liveData.data.first_in).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : EMPTY_DISPLAY}
                    </div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-4">
                    <div className="text-xs text-slate-500 mb-1">Last Punch</div>
                    <div className="text-lg font-semibold text-slate-800">
                      {liveData.data.last_punch ? new Date(liveData.data.last_punch).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : EMPTY_DISPLAY}
                    </div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-4">
                    <div className="text-xs text-slate-500 mb-1">Hours Today</div>
                    <div className="text-lg font-semibold text-slate-800">
                      {liveData.data.hours_today != null ? `${Number(liveData.data.hours_today).toFixed(1)} h` : EMPTY_DISPLAY}
                    </div>
                  </div>
                  <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-200">
                    <div className="text-xs text-emerald-600 mb-1 font-medium">Punch IN Count</div>
                    <div className="text-lg font-bold text-emerald-700">
                      {liveData.data.punch_in_count != null ? liveData.data.punch_in_count : EMPTY_DISPLAY}
                    </div>
                  </div>
                  <div className="bg-rose-50 rounded-lg p-4 border border-rose-200">
                    <div className="text-xs text-rose-600 mb-1 font-medium">Punch OUT Count</div>
                    <div className="text-lg font-bold text-rose-700">
                      {liveData.data.punch_out_count != null ? liveData.data.punch_out_count : EMPTY_DISPLAY}
                    </div>
                  </div>
                </div>
                {liveData.data.is_late && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-sm text-amber-800">
                      <Icon name="ClockIcon" className="w-4 h-4" />
                      <span className="font-medium">Late Arrival</span>
                    </div>
                  </div>
                )}
              </div>
            </SectionCard>
          )}
        </div>
      )}

      {/* Daily Tab */}
      {activeTab === 'daily' && (
        <div className="space-y-5">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Icon name="CalendarDaysIcon" className="w-4 h-4 text-slate-400" />
              <span className="text-sm font-medium text-slate-700">Select Date</span>
            </div>
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          {loadingDaily ? (
            <div className="flex items-center justify-center py-12">
              <Spinner />
              <span className="ml-3 text-sm text-slate-500">{ESS_TIMESHEET_COPY.loading}</span>
            </div>
          ) : !dailyData?.data ? (
            <EmptyNotice icon="CalendarDaysIcon" message={ESS_TIMESHEET_COPY.dailyNoData} />
          ) : (
            <SectionCard title="Daily Attendance" subtitle={selectedDate} icon="ClipboardDocumentCheckIcon">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="text-xs text-slate-500 mb-1">First IN</div>
                  <div className="text-lg font-semibold text-slate-800">
                    {dailyData.data.first_in ? new Date(dailyData.data.first_in).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : EMPTY_DISPLAY}
                  </div>
                </div>
                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="text-xs text-slate-500 mb-1">Last OUT</div>
                  <div className="text-lg font-semibold text-slate-800">
                    {dailyData.data.last_out ? new Date(dailyData.data.last_out).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : EMPTY_DISPLAY}
                  </div>
                </div>
                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="text-xs text-slate-500 mb-1">Hours Worked</div>
                  <div className="text-lg font-semibold text-slate-800">
                    {dailyData.data.hours_worked != null ? `${Number(dailyData.data.hours_worked).toFixed(1)} h` : EMPTY_DISPLAY}
                  </div>
                </div>
                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="text-xs text-slate-500 mb-1">Punches</div>
                  <div className="text-lg font-semibold text-slate-800">
                    {dailyData.data.punch_count || 0}
                  </div>
                </div>
              </div>
            </SectionCard>
          )}
        </div>
      )}

      {/* Monthly Tab */}
      {activeTab === 'monthly' && (
        <div className="space-y-5">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Icon name="CalendarIcon" className="w-4 h-4 text-slate-400" />
              <span className="text-sm font-medium text-slate-700">Select Month</span>
            </div>
            <select
              value={`${selectedYear}-${selectedMonth}`}
              onChange={e => {
                const [y, m] = e.target.value.split('-').map(Number)
                setSelectedYear(y)
                setSelectedMonth(m)
              }}
              className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              {Array.from({length: 12}, (_, i) => {
                const d = new Date(new Date().getFullYear(), new Date().getMonth() - i, 1)
                return (
                  <option key={i} value={`${d.getFullYear()}-${d.getMonth() + 1}`}>
                    {MONTH_SHORT[d.getMonth()]} {d.getFullYear()}
                  </option>
                )
              })}
            </select>
          </div>
          {loadingMonthly ? (
            <div className="flex items-center justify-center py-12">
              <Spinner />
              <span className="ml-3 text-sm text-slate-500">{ESS_TIMESHEET_COPY.loading}</span>
            </div>
          ) : !monthlyData?.data ? (
            <EmptyNotice icon="CalendarIcon" message={ESS_TIMESHEET_COPY.monthlyNoData} />
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <KpiCard icon="ClockIcon" label="Total Hours" value={`${Number(monthlyData.data.total_hours || 0).toFixed(1)} h`} sub={`${MONTH_SHORT[selectedMonth-1]} ${selectedYear}`} tone="blue" />
                <KpiCard icon="CheckCircleIcon" label="Days Present" value={monthlyData.data.days_present || 0} sub={`of ${monthlyData.data.working_days || ESS_ATT_STANDARD_WORKING_DAYS} working days`} tone="green" />
                <KpiCard icon="ChartBarIcon" label="Avg Hours/Day" value={monthlyData.data.avg_hours_per_day ? `${Number(monthlyData.data.avg_hours_per_day).toFixed(1)} h` : EMPTY_DISPLAY} sub="Average" tone="purple" />
                <KpiCard icon="CalendarDaysIcon" label="Full Days" value={monthlyData.data.full_days || 0} sub="Full attendance" tone="emerald" />
              </div>
              {monthlyData.data.days_detail && monthlyData.data.days_detail.length > 0 && (
                <SectionCard title="Daily Breakdown" subtitle={`${MONTH_SHORT[selectedMonth-1]} ${selectedYear}`} icon="TableCellsIcon">
                  <div className="max-h-96 overflow-y-auto">
                    <table className="min-w-full text-sm">
                      <thead className="sticky top-0 bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase">Date</th>
                          <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-600 uppercase">Hours</th>
                        </tr>
                      </thead>
                      <tbody>
                        {monthlyData.data.days_detail.slice(0, 31).map((day, i) => (
                          <tr key={i} className={`border-b border-slate-100 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}>
                            <td className="px-4 py-2 text-slate-800 font-medium">{day.date || day.day}</td>
                            <td className="px-3 py-2 text-right text-slate-700">
                              {day.hours != null ? `${Number(day.hours).toFixed(1)} h` : EMPTY_DISPLAY}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </SectionCard>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// -----------------------------------------------------------------------------
// Section: Timesheet Insights (DEPRECATED — replaced by ESSTimesheetView)
// -----------------------------------------------------------------------------

const TimesheetInsights = ({ monthlyTs, userHistory, loading }) => {
  const totalHrs    = Number(monthlyTs?.total_hours) || 0
  // Cap total hours at max (configured max daily hours × working days)
  const cappedHrs   = ESS_ATT_FEATURES.capHoursAtMax 
    ? Math.min(totalHrs, ESS_ATT_MAX_DAILY_HRS * ESS_ATT_STANDARD_WORKING_DAYS)
    : totalHrs
  const totalOt     = Number(monthlyTs?.total_overtime) || 0
  const billable    = Number(monthlyTs?.billable_hours) || 0
  const utilPct     = STANDARD_MONTHLY_HOURS > 0 ? Math.min(100, Math.round((cappedHrs / STANDARD_MONTHLY_HOURS) * 100)) : 0

  // Weekly trend from user history
  const weeklyData = useMemo(() => {
    if (!userHistory?.weekly_summary) return []
    return (userHistory.weekly_summary || []).slice(-8).map((w) => ({
      week:  `W${w.week_number || '?'}`,
      hours: Number(w.total_hours) || 0,
    }))
  }, [userHistory])

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard icon="ClockIcon" label="Total Hours" value={fmtHours(cappedHrs)} sub={`of ~${fmtHours(STANDARD_MONTHLY_HOURS)} expected`} tone="blue" />
        {ESS_ATT_FEATURES.showOvertime && (
          <KpiCard icon="ArrowTrendingUpIcon" label="Overtime" value={fmtHours(totalOt)} sub="This month" tone="amber" />
        )}
        <KpiCard icon="CurrencyDollarIcon" label="Billable Hours" value={billable > 0 ? fmtHours(billable) : EMPTY_DISPLAY} sub="Chargeable to projects" tone="green" />
        <KpiCard icon="ChartBarIcon" label="Utilization" value={`${utilPct}%`} sub={utilPct >= 90 ? 'On track' : 'Below target'} tone={utilPct >= 90 ? 'green' : utilPct >= 70 ? 'amber' : 'rose'} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* Monthly utilization gauge */}
        <SectionCard title="Monthly Utilization" subtitle="Hours worked vs expected" icon="ChartBarSquareIcon">
          <div className="flex flex-col items-center py-4">
            <div className="relative w-36 h-36">
              <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                <circle cx="60" cy="60" r="50" fill="none" stroke="#f1f5f9" strokeWidth="12" />
                <circle
                  cx="60" cy="60" r="50" fill="none"
                  stroke={utilPct >= 90 ? '#10b981' : utilPct >= 70 ? '#f59e0b' : '#ef4444'}
                  strokeWidth="12"
                  strokeDasharray={`${2 * Math.PI * 50 * utilPct / 100} ${2 * Math.PI * 50}`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold text-slate-800">{utilPct}%</span>
                <span className="text-xs text-slate-400">Utilization</span>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4 w-full">
              <div className="text-center bg-slate-50 rounded-lg p-3">
                <div className="text-lg font-bold text-slate-800">{fmtHours(totalHrs)}</div>
                <div className="text-xs text-slate-400">Worked</div>
              </div>
              <div className="text-center bg-slate-50 rounded-lg p-3">
                <div className="text-lg font-bold text-slate-800">{fmtHours(STANDARD_MONTHLY_HOURS)}</div>
                <div className="text-xs text-slate-400">Expected</div>
              </div>
            </div>
          </div>
        </SectionCard>

        {/* Weekly trend */}
        {ESS_FEATURES.showWeeklyHoursTrend && (
          <SectionCard title="Weekly Hours Trend" subtitle="Last 8 weeks" icon="CalendarIcon">
            {loading ? (
              <SkeletonBox className="h-52 w-full" />
            ) : weeklyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={weeklyData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => [`${Number(v).toFixed(1)} h`, 'Hours']} />
                  <Bar dataKey="hours" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : ESS_FEATURES.requireTimesheetDataForTrend ? (
              <div className="h-52 flex items-center justify-center">
                <div className="text-center">
                  <Icon name="ClockIcon" className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                  <div className="text-sm text-slate-500">Timesheet data not available</div>
                  <div className="text-xs text-slate-400 mt-1">Weekly hours will appear once attendance is tracked</div>
                </div>
              </div>
            ) : (
              <EmptyNotice icon="CalendarIcon" message="Weekly data not available" />
            )}
          </SectionCard>
        )}
      </div>
    </div>
  )
}

// -----------------------------------------------------------------------------
// Section: Payroll Snapshot (read-only)
// -----------------------------------------------------------------------------

const PayrollSnapshot = ({ salaryInfo, slips, loading }) => {
  const latest = slips?.[0] || null
  const basic  = parseFloat(salaryInfo?.basic_salary)           || 0
  const gross  = parseFloat(latest?.gross_salary)               || 0
  const net    = parseFloat(latest?.net_salary)                 || 0
  const ot     = parseFloat(latest?.overtime_pay)               || 0
  const deductions = parseFloat(latest?.total_deductions)       || 0

  const history = useMemo(() => {
    return (slips || []).slice(0, 6).reverse().map((s) => ({
      label: `${MONTH_SHORT[(s.month || 1) - 1]} ${s.year || ''}`,
      net:   parseFloat(s.net_salary) || 0,
      gross: parseFloat(s.gross_salary) || 0,
    }))
  }, [slips])

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4">
        <KpiCard icon="BanknotesIcon"     label="Basic Salary"    value={basic > 0 ? fmtCurrency(basic) : EMPTY_DISPLAY} sub="Monthly" tone="blue" />
        <KpiCard icon="ArrowUpIcon"       label="Gross Earnings"  value={gross > 0 ? fmtCurrency(gross) : EMPTY_DISPLAY} sub={latest ? `${MONTH_SHORT[(latest.month||1)-1]} ${latest.year}` : 'Latest'} tone="green" />
        {ESS_ATT_FEATURES.showOvertime && (
          <KpiCard icon="ArrowTrendingUpIcon" label="Overtime Pay"  value={ot > 0 ? fmtCurrency(ot) : EMPTY_DISPLAY} sub="Included in gross" tone="amber" />
        )}
        <KpiCard icon="MinusCircleIcon"   label="Deductions"      value={deductions > 0 ? fmtCurrency(deductions) : EMPTY_DISPLAY} sub="This month" tone="rose" />
        <KpiCard icon="CurrencyDollarIcon" label="Net Salary"     value={net > 0 ? fmtCurrency(net) : EMPTY_DISPLAY} sub={latest?.status || EMPTY_DISPLAY} tone="purple" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* Salary trend chart */}
        <SectionCard title="Salary History" subtitle="Net vs Gross (last 6 months)" icon="ChartBarIcon">
          {loading ? (
            <SkeletonBox className="h-52 w-full" />
          ) : history.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={history} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={v => [fmtCurrency(v)]} />
                <Legend iconType="circle" iconSize={8} />
                <Bar dataKey="gross" name="Gross" fill="#bfdbfe" radius={[4, 4, 0, 0]} />
                <Bar dataKey="net"   name="Net"   fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyNotice icon="ChartBarIcon" message="No salary history available" />
          )}
        </SectionCard>

        {/* Payslip list */}
        <SectionCard
          title="Recent Payslips"
          icon="DocumentTextIcon"
          action={
            <span className="text-xs text-blue-600 font-medium">Read-only</span>
          }
        >
          {loading ? (
            <div className="space-y-2">{[...Array(4)].map((_, i) => <SkeletonBox key={i} className="h-10" />)}</div>
          ) : (slips || []).length > 0 ? (
            <div className="divide-y divide-slate-100">
              {(slips || []).slice(0, 6).map((s) => {
                const statusMeta = {
                  approved: 'bg-emerald-50 text-emerald-700',
                  sent:     'bg-purple-50 text-purple-700',
                  pending_approval: 'bg-amber-50 text-amber-700',
                  generated: 'bg-blue-50 text-blue-700',
                }[s.status] || 'bg-slate-50 text-slate-600'
                return (
                  <div key={s.id} className="py-2.5 flex items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-medium text-slate-800">
                        {MONTH_SHORT[(s.month || 1) - 1]} {s.year}
                      </div>
                      <div className="text-xs text-slate-400">Net: {fmtCurrency(s.net_salary)}</div>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusMeta}`}>
                      {s.status?.replace(/_/g, ' ') || 'generated'}
                    </span>
                  </div>
                )
              })}
            </div>
          ) : (
            <EmptyNotice icon="DocumentTextIcon" message="No payslips available" />
          )}
        </SectionCard>
      </div>
    </div>
  )
}

// -----------------------------------------------------------------------------
// Section: Team Availability Calendar
// -----------------------------------------------------------------------------

const TeamCalendar = ({ calendarData, loading }) => {
  const [viewMonth, setViewMonth] = useState({ year: nowYear(), month: nowMonth() })

  const prevMonth = () => setViewMonth(({ year, month }) =>
    month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 })
  const nextMonth = () => setViewMonth(({ year, month }) =>
    month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 })

  // Build calendar grid
  const days = useMemo(() => {
    const { year, month } = viewMonth
    const first = new Date(year, month - 1, 1).getDay()
    const total = new Date(year, month, 0).getDate()
    const grid = []
    for (let i = 0; i < first; i++) grid.push(null)
    for (let d = 1; d <= total; d++) grid.push(d)
    return grid
  }, [viewMonth])

  // Map leave events: { 'YYYY-MM-DD': [name, ...] }
  const leaveMap = useMemo(() => {
    const m = {}
    ;(calendarData || []).forEach(ev => {
      const key = ev.date || ev.leave_date
      if (!key) return
      if (!m[key]) m[key] = []
      m[key].push(ev.employee_name || ev.name || 'Employee')
    })
    return m
  }, [calendarData])

  const { year, month } = viewMonth
  const todayD = new Date()
  const isToday = (d) => d === todayD.getDate() && month === todayD.getMonth() + 1 && year === todayD.getFullYear()

  const dayKey = (d) => `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`

  return (
    <SectionCard
      title="Team Availability Calendar"
      subtitle={ESS_FEATURES.teamCalendarDescription || "Who's on leave this month"}
      icon="CalendarDaysIcon"
      action={
        <div className="flex items-center gap-1">
          <button onClick={prevMonth} className="p-1 hover:bg-slate-100 rounded-lg transition-colors">
            <Icon name="ChevronLeftIcon" className="w-4 h-4 text-slate-500" />
          </button>
          <span className="text-sm font-medium text-slate-700 min-w-[90px] text-center">
            {MONTH_SHORT[month - 1]} {year}
          </span>
          <button onClick={nextMonth} className="p-1 hover:bg-slate-100 rounded-lg transition-colors">
            <Icon name="ChevronRightIcon" className="w-4 h-4 text-slate-500" />
          </button>
        </div>
      }
    >
      {loading ? (
        <SkeletonBox className="h-64 w-full" />
      ) : (
        <>
          <div className="grid grid-cols-7 mb-2">
            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
              <div key={d} className="text-center text-xs font-semibold text-slate-400 py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((d, i) => {
              const key    = d ? dayKey(d) : null
              const events = key ? leaveMap[key] || [] : []
              const isWknd = d ? [0, 6].includes(new Date(year, month - 1, d).getDay()) : false

              return (
                <div
                  key={i}
                  className={`min-h-[56px] rounded-lg p-1 text-xs border transition-colors ${
                    !d ? 'bg-transparent border-transparent'
                    : isToday(d) ? 'bg-blue-50 border-blue-200'
                    : isWknd ? 'bg-slate-50 border-slate-100'
                    : 'bg-white border-slate-100 hover:bg-slate-50'
                  }`}
                >
                  {d && (
                    <>
                      <div className={`font-semibold mb-1 ${isToday(d) ? 'text-blue-600' : isWknd ? 'text-slate-400' : 'text-slate-700'}`}>
                        {d}
                      </div>
                      {events.slice(0, 2).map((name, ei) => (
                        <div key={ei} className="bg-amber-100 text-amber-700 rounded px-0.5 py-0.5 text-[10px] truncate mb-0.5">
                          {name}
                        </div>
                      ))}
                      {events.length > 2 && (
                        <div className="text-[10px] text-slate-400">+{events.length - 2} more</div>
                      )}
                    </>
                  )}
                </div>
              )
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-100 text-xs text-slate-500">
            <div className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-100 border border-blue-200" /> Today</div>
            <div className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-100" /> On Leave</div>
            <div className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-slate-50 border border-slate-100" /> Weekend</div>
          </div>
        </>
      )}
    </SectionCard>
  )
}

// -----------------------------------------------------------------------------
// Section: Notifications
// -----------------------------------------------------------------------------

const NotificationsCenter = ({ requests, loading }) => {
  const [readIds, setReadIds] = useState(new Set())

  const notifications = useMemo(() => {
    const items = []

    ;(requests || []).forEach(r => {
      if (r.status === 'approved') {
        items.push({
          id: `leave_approved_${r.id}`,
          type: 'leave',
          priority: 'medium',
          title: 'Leave Request Approved',
          message: `Your ${r.leave_type_display || 'leave'} request (${fmtDate(r.start_date)} \u2013 ${fmtDate(r.end_date)}) has been approved.`,
          icon: 'CheckCircleIcon',
          time: r.approved_at || r.updated_at,
        })
      }
      if (r.status === 'rejected') {
        items.push({
          id: `leave_rejected_${r.id}`,
          type: 'leave',
          priority: 'high',
          title: 'Leave Request Rejected',
          message: `Your ${r.leave_type_display || 'leave'} request was rejected.${r.rejection_note ? ` Reason: ${r.rejection_note}` : ''}`,
          icon: 'XCircleIcon',
          time: r.updated_at,
        })
      }
      if (r.status?.toUpperCase() === 'PENDING') {
        items.push({
          id: `leave_pending_${r.id}`,
          type: 'leave',
          priority: 'low',
          title: 'Leave Request Pending',
          message: `Your leave request for ${fmtDate(r.start_date)} is awaiting manager approval.`,
          icon: 'ClockIcon',
          time: r.created_at,
        })
      }
      if (r.status?.toUpperCase() === 'RM_APPROVED') {
        items.push({
          id: `leave_rm_approved_${r.id}`,
          type: 'leave',
          priority: 'medium',
          title: 'Manager Approved — Awaiting HR',
          message: `Your leave request for ${fmtDate(r.start_date)} was approved by your manager and is now awaiting HR final approval.`,
          icon: 'CheckBadgeIcon',
          time: r.rm_reviewed_at || r.updated_at,
        })
      }
    })

    return items.sort((a, b) => {
      const pri = { high: 0, medium: 1, low: 2 }
      return (pri[a.priority] || 2) - (pri[b.priority] || 2)
    })
  }, [requests])

  const unread = notifications.filter(n => !readIds.has(n.id)).length

  return (
    <SectionCard
      title="Notifications"
      subtitle={unread > 0 ? `${unread} unread` : 'All caught up'}
      icon="BellIcon"
      action={
        unread > 0 ? (
          <button
            onClick={() => setReadIds(new Set(notifications.map(n => n.id)))}
            className="text-xs text-blue-600 hover:text-blue-700 font-medium"
          >
            Mark all read
          </button>
        ) : null
      }
    >
      {loading ? (
        <div className="space-y-2">{[...Array(3)].map((_, i) => <SkeletonBox key={i} className="h-14" />)}</div>
      ) : notifications.length === 0 ? (
        <EmptyNotice icon="BellSlashIcon" message="No notifications at this time" />
      ) : (
        <div className="space-y-2">
          {notifications.map(n => {
            const isRead = readIds.has(n.id)
            const pm = NOTIFICATION_PRIORITY[n.priority] || NOTIFICATION_PRIORITY.low
            return (
              <div
                key={n.id}
                className={`rounded-xl border p-3 cursor-pointer transition-colors ${isRead ? 'bg-slate-50 border-slate-100' : 'bg-white border-slate-200 shadow-sm'}`}
                onClick={() => setReadIds(prev => new Set([...prev, n.id]))}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${pm.badge}`}>
                    <Icon name={n.icon} className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`text-sm font-medium ${isRead ? 'text-slate-500' : 'text-slate-800'}`}>{n.title}</span>
                      {!isRead && <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${pm.dot}`} />}
                    </div>
                    <p className="text-xs text-slate-500 line-clamp-2">{n.message}</p>
                    {n.time && <div className="text-[10px] text-slate-400 mt-1">{fmtDate(n.time)}</div>}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </SectionCard>
  )
}

// -----------------------------------------------------------------------------
// Section: Employee Digital Twin
// -----------------------------------------------------------------------------

const DigitalTwin = ({ monthlyTs, leaveRecord, slips, requests, loading }) => {
  const scores = useMemo(() => {
    const workingDays   = monthlyTs?.working_days || 22
    const presentDays   = monthlyTs?.present_days || 0
    const attScore      = workingDays > 0 ? Math.round((presentDays / workingDays) * 100) : 0

    const totalHrs      = Number(monthlyTs?.total_hours) || 0
    const prodScore     = STANDARD_MONTHLY_HOURS > 0
      ? Math.min(100, Math.round((totalHrs / STANDARD_MONTHLY_HOURS) * 100)) : 0

    const tsScore       = totalHrs > 0 ? Math.min(100, prodScore + 5) : 0

    const balance       = Number(leaveRecord?.leave_balance) || 0
    const earned        = Number(leaveRecord?.total_earned) || 0
    const leaveScore    = earned > 0 ? Math.min(100, Math.round((balance / earned) * 100)) : 50

    const paySlipCount  = (slips || []).filter(s => s.status === 'approved' || s.status === 'sent').length
    const payScore      = (slips || []).length > 0
      ? Math.min(100, Math.round((paySlipCount / Math.min(12, (slips || []).length)) * 100))
      : 0

    return [
      { ...SCORE_CONFIG[0], score: attScore },
      { ...SCORE_CONFIG[1], score: prodScore },
      { ...SCORE_CONFIG[2], score: tsScore },
      { ...SCORE_CONFIG[3], score: leaveScore },
      { ...SCORE_CONFIG[4], score: payScore },
    ]
  }, [monthlyTs, leaveRecord, slips])

  const healthIndex = scores.length > 0
    ? Math.round(scores.reduce((s, c) => s + c.score, 0) / scores.length)
    : 0

  const healthColor = healthIndex >= 80 ? '#10b981' : healthIndex >= 60 ? '#f59e0b' : '#ef4444'
  const healthLabel = healthIndex >= 80 ? 'Excellent' : healthIndex >= 60 ? 'Good' : 'Needs Attention'

  const radialData = [{ name: 'Health', value: healthIndex, fill: healthColor }]

  return (
    <div className="space-y-5">
      {/* Health Index */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <SectionCard title="RADAI Employee Health Index" subtitle="Composite score" icon="SparklesIcon">
          <div className="flex flex-col items-center py-2">
            <div className="relative w-40 h-40">
              <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                <circle cx="60" cy="60" r="50" fill="none" stroke="#f1f5f9" strokeWidth="12" />
                <circle
                  cx="60" cy="60" r="50" fill="none"
                  stroke={healthColor}
                  strokeWidth="12"
                  strokeDasharray={`${2 * Math.PI * 50 * healthIndex / 100} ${2 * Math.PI * 50}`}
                  strokeLinecap="round"
                  className="transition-all duration-1000"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-bold" style={{ color: healthColor }}>{healthIndex}</span>
                <span className="text-xs text-slate-500">/ 100</span>
              </div>
            </div>
            <div className="mt-3 font-semibold text-base" style={{ color: healthColor }}>{healthLabel}</div>
            <div className="text-xs text-slate-400 mt-1">Employee Health Score</div>
          </div>
        </SectionCard>

        {/* Score breakdown */}
        <div className="xl:col-span-2">
          <SectionCard title="Score Breakdown" subtitle="Individual performance dimensions" icon="ChartBarSquareIcon">
            {loading ? (
              <div className="space-y-3">{[...Array(5)].map((_, i) => <SkeletonBox key={i} className="h-10" />)}</div>
            ) : (
              <div className="space-y-4">
                {scores.map((s) => (
                  <div key={s.id}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <Icon name={s.icon} className="w-4 h-4 text-slate-400" />
                        <span className="text-sm text-slate-600">{s.label}</span>
                      </div>
                      <span className="text-sm font-bold" style={{ color: s.color }}>{s.score}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-2 rounded-full transition-all duration-700"
                        style={{ width: `${s.score}%`, background: s.color }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4">
        {scores.map((s) => {
          const tone = s.score >= 80 ? 'green' : s.score >= 60 ? 'amber' : 'rose'
          return (
            <KpiCard
              key={s.id}
              icon={s.icon}
              label={s.label}
              value={`${s.score}%`}
              sub={s.score >= 80 ? 'Excellent' : s.score >= 60 ? 'Good' : 'Attention'}
              tone={tone}
            />
          )
        })}
      </div>
    </div>
  )
}

// -----------------------------------------------------------------------------
// DAILY TRACKER TAB
// -----------------------------------------------------------------------------

// -- Config helpers ------------------------------------------------------------
function priorityConfig(id) {
  return DAILY_TRACKER_PRIORITIES.find(p => p.id === id) || DAILY_TRACKER_PRIORITIES[1]
}
function statusConfig(id) {
  return DAILY_TRACKER_STATUSES.find(s => s.id === id) || DAILY_TRACKER_STATUSES[0]
}
function approvalConfig(id) {
  return DAILY_TRACKER_APPROVAL_STATUSES.find(a => a.id === id) || DAILY_TRACKER_APPROVAL_STATUSES[0]
}

// -- 14-week rolling heatmap ---------------------------------------------------
function ActivityHeatmap({ summary }) {
  const cfg    = DAILY_TRACKER_COPY
  const weeks  = cfg.heatmapWeeks
  const today  = new Date()
  const dayOfWeek = (today.getDay() + 6) % 7
  const monday = new Date(today)
  monday.setDate(today.getDate() - dayOfWeek - (weeks - 1) * 7)
  monday.setHours(0, 0, 0, 0)

  const grid = []
  for (let w = 0; w < weeks; w++) {
    const week = []
    for (let d = 0; d < 7; d++) {
      const dt = new Date(monday)
      dt.setDate(monday.getDate() + w * 7 + d)
      week.push(dt.toISOString().slice(0, 10))
    }
    grid.push(week)
  }

  const hoursMap = {}
  ;(summary || []).forEach(r => { hoursMap[r.date] = r.total_hours })

  function cellColor(h) {
    if (!h)                return 'bg-slate-100'
    if (h >= cfg.heatHigh) return 'bg-emerald-600'
    if (h >= cfg.heatMed)  return 'bg-emerald-400'
    if (h >= cfg.heatLow)  return 'bg-emerald-200'
    return 'bg-slate-100'
  }

  const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

  return (
    <div>
      <p className="text-xs font-medium text-slate-500 mb-2">{cfg.heatmapTitle}</p>
      <div className="flex gap-[3px]">
        <div className="flex flex-col gap-[3px] mr-1 mt-[18px]">
          {dayLabels.map((l, i) => (
            <div key={i} className="h-3 w-3 text-[9px] text-slate-400 flex items-center justify-center">{l}</div>
          ))}
        </div>
        {grid.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-[3px]">
            <div className="h-[14px] text-[9px] text-slate-400">
              {week[0].slice(8, 10) === '01' ? new Date(week[0]).toLocaleString('default', { month: 'short' }) : ''}
            </div>
            {week.map(date => {
              const h = hoursMap[date] || 0
              return (
                <div key={date} title={`${date}: ${h} hrs`}
                  className={`h-3 w-3 rounded-sm ${cellColor(h)}`} />
              )
            })}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 mt-2 text-[10px] text-slate-400">
        <span>Less</span>
        {['bg-slate-100', 'bg-emerald-200', 'bg-emerald-400', 'bg-emerald-600'].map(c => (
          <div key={c} className={`h-3 w-3 rounded-sm ${c}`} />
        ))}
        <span>More</span>
      </div>
    </div>
  )
}

// -- Smart rotating placeholders -----------------------------------------------
// -- Quick Log Form (wide two-column layout)
const TASK_PLACEHOLDERS = [
  'Reviewed P&ID drawings for Train 2',
  'Attended client coordination meeting',
  'Completed instrument datasheet rev B',
  'Prepared progress report for PMC',
  'Performed quality check on deliverables',
  'Coordinated with procurement team',
]

const LOG_ACTIVITY_DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

function ActivityWizard({ initial, onSave, onClose, submitting, alreadyLoggedHours = 0 }) {
  const cfg      = DAILY_TRACKER_COPY
  const today    = new Date().toISOString().slice(0, 10)
  const yesterday = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10) })()

  const [form, setForm] = useState({
    log_date:          initial?.log_date         ?? today,
    task_title:        initial?.task_title        ?? '',
    notes:             initial?.notes             ?? '',
    hours_spent:       initial?.hours_spent != null ? String(parseFloat(initial.hours_spent)) : '1',
    project_category:  initial?.project_category  ?? '',
    priority:          initial?.priority          ?? 'medium',
    status:            initial?.status            ?? 'in_progress',
    submitted_to_role: initial?.submitted_to_role ?? 'reporting_manager',
  })
  const [customHours, setCustomHours] = useState('')
  const [phIndex,     setPhIndex]     = useState(0)
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  useEffect(() => {
    const t = setInterval(() => setPhIndex(i => (i + 1) % TASK_PLACEHOLDERS.length), 3500)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  function handleSubmit(e) {
    e.preventDefault()
    const h = parseFloat(form.hours_spent)
    if (!form.task_title.trim() || isNaN(h) || h <= 0) return
    if (h > cfg.maxHoursWarning && !window.confirm(`${h}h seems high. Continue?`)) return
    onSave({ ...form, hours_spent: h.toFixed(2) })
  }

  const selectedH   = parseFloat(form.hours_spent) || 0
  const remaining   = Math.max(0, 8 - alreadyLoggedHours)
  const canSubmit   = form.task_title.trim().length > 0 && selectedH > 0
  const isToday     = form.log_date === today
  const isYesterday = form.log_date === yesterday
  const todayPct    = Math.min(100, Math.round((alreadyLoggedHours / 8) * 100))
  const afterPct    = Math.min(100, Math.round(((alreadyLoggedHours + selectedH) / 8) * 100))
  const dateObj     = new Date(form.log_date + 'T12:00:00')
  const dayLabel    = LOG_ACTIVITY_DAY_NAMES[dateObj.getDay()]
  const monthLabel  = dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-3 py-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-violet-700 px-6 py-4 flex-shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-white font-bold text-lg leading-tight">
                {initial ? 'Edit Activity' : 'Log Activity'}
              </h2>
              <p className="text-white/70 text-xs mt-0.5">
                {dayLabel}, {monthLabel}
                {isToday && !initial && remaining > 0 ? ` \u00b7 ${remaining.toFixed(1)}h remaining` : ''}
                {isToday && !initial && remaining === 0 ? ' \u00b7 Day fully logged' : ''}
              </p>
            </div>
            <button onClick={onClose} className="text-white/70 hover:text-white transition-colors mt-0.5">
              <HeroIcons.XMarkIcon className="h-5 w-5" />
            </button>
          </div>
          {isToday && !initial && (
            <div className="mt-3">
              <div className="flex justify-between text-[10px] text-white/60 mb-1">
                <span>Today's logged hours</span>
                <span>{alreadyLoggedHours.toFixed(1)}h{selectedH > 0 ? ` + ${selectedH}h this entry` : ''} / 8h</span>
              </div>
              <div className="h-1.5 bg-white/20 rounded-full overflow-hidden relative">
                <div className="absolute inset-y-0 left-0 bg-white/40 rounded-full transition-all duration-300" style={{ width: `${afterPct}%` }} />
                <div className="absolute inset-y-0 left-0 bg-white rounded-full transition-all duration-300" style={{ width: `${todayPct}%` }} />
              </div>
            </div>
          )}
        </div>

        {/* BODY */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-[3fr_2fr] divide-y md:divide-y-0 md:divide-x divide-slate-100">

            {/* LEFT COL \u2014 main content */}
            <div className="p-5 space-y-4">

              {/* Task title */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">What did you work on? *</label>
                  <span className={`text-[10px] tabular-nums ${form.task_title.length > 180 ? 'text-red-400 font-bold' : 'text-slate-300'}`}>
                    {form.task_title.length}/200
                  </span>
                </div>
                <textarea
                  autoFocus
                  rows={4}
                  maxLength={200}
                  value={form.task_title}
                  onChange={e => set('task_title', e.target.value)}
                  placeholder={TASK_PLACEHOLDERS[phIndex]}
                  className="w-full text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white transition-all placeholder:text-slate-300 leading-relaxed"
                />
              </div>

              {/* Notes \u2014 always visible */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1.5">
                  Notes / Context
                </label>
                <textarea
                  rows={3}
                  value={form.notes}
                  onChange={e => set('notes', e.target.value)}
                  placeholder="Blockers, decisions, links, next steps..."
                  className="w-full text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:bg-white transition-all placeholder:text-slate-300 leading-relaxed"
                />
              </div>

              {/* Send for approval to */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-2">
                  Send for Approval to
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {DAILY_TRACKER_SUBMIT_TO_OPTIONS.map(opt => {
                    const active = form.submitted_to_role === opt.id
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => set('submitted_to_role', opt.id)}
                        className={`flex flex-col items-start gap-1 px-3 py-2.5 rounded-xl border text-left transition-all ${
                          active ? opt.activeTailwind + ' shadow-md ring-2 ring-offset-1 ring-current/20' : opt.chipTailwind + ' hover:shadow-sm'
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          {active
                            ? <HeroIcons.CheckCircleIcon className="h-3.5 w-3.5 flex-shrink-0" />
                            : <HeroIcons.UserCircleIcon className="h-3.5 w-3.5 flex-shrink-0 opacity-60" />
                          }
                          <span className="text-xs font-bold leading-tight">{opt.label}</span>
                        </div>
                        <span className={`text-[10px] leading-snug ${active ? 'text-white/80' : 'opacity-60'}`}>
                          {opt.description}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Date */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1.5">Date</label>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => set('log_date', today)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      isToday
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                        : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300 hover:text-indigo-600'
                    }`}>Today</button>
                  <button type="button" onClick={() => set('log_date', yesterday)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      isYesterday
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                        : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300 hover:text-indigo-600'
                    }`}>Yesterday</button>
                  <input
                    type="date"
                    value={form.log_date}
                    max={today}
                    onChange={e => set('log_date', e.target.value)}
                    className={`border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-all ${
                      !isToday && !isYesterday
                        ? 'border-indigo-300 bg-indigo-50 text-indigo-700 font-semibold'
                        : 'border-slate-200 bg-white text-slate-500'
                    }`}
                  />
                </div>
              </div>
            </div>

            {/* RIGHT COL \u2014 quick selectors */}
            <div className="p-5 space-y-5">

              {/* Hours */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Hours Spent *</label>
                  {selectedH > 0 && (
                    <span className="text-[10px] text-indigo-600 font-semibold bg-indigo-50 px-2 py-0.5 rounded-full">
                      {Math.round((selectedH / 8) * 100)}% of workday
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-4 gap-1.5 mb-2">
                  {cfg.quickHours.map(h => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => { set('hours_spent', String(h)); setCustomHours('') }}
                      className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                        selectedH === h && !customHours
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-md scale-105'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600'
                      }`}
                    >{h}h</button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0.25" max="24" step="0.25"
                    value={customHours}
                    onChange={e => { setCustomHours(e.target.value); if (e.target.value) set('hours_spent', e.target.value) }}
                    placeholder="Custom hours (e.g. 2.5)"
                    className="flex-1 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:bg-white transition-all"
                  />
                </div>
              </div>

              <div className="h-px bg-slate-100" />

              {/* Priority */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-2">Priority</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {DAILY_TRACKER_PRIORITIES.map(p => (
                    <button key={p.id} type="button" onClick={() => set('priority', p.id)}
                      className={`py-1.5 rounded-lg text-xs font-semibold border text-center transition-all ${
                        form.priority === p.id ? p.tailwind + ' shadow-sm' : 'bg-white text-slate-400 border-slate-100 hover:border-slate-300'
                      }`}>
                      {p.icon} {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-2">Status</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {DAILY_TRACKER_STATUSES.map(s => (
                    <button key={s.id} type="button" onClick={() => set('status', s.id)}
                      className={`py-1.5 rounded-lg text-xs font-semibold border text-center transition-all ${
                        form.status === s.id ? s.tailwind + ' shadow-sm' : 'bg-white text-slate-400 border-slate-100 hover:border-slate-300'
                      }`}>
                      {s.icon} {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-2">Category</label>
                <div className="flex flex-wrap gap-1.5">
                  {DAILY_TRACKER_PROJECT_CATEGORIES.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => set('project_category', form.project_category === c ? '' : c)}
                      className={`px-2 py-1 rounded-full text-[11px] font-medium border transition-all ${
                        form.project_category === c
                          ? 'bg-violet-600 text-white border-violet-600 shadow-sm'
                          : 'bg-white text-slate-500 border-slate-200 hover:border-violet-300 hover:text-violet-600'
                      }`}
                    >{c}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* FOOTER */}
          <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center gap-3 flex-shrink-0">
            <div className="flex-1 flex items-center gap-1.5 flex-wrap min-w-0">
              {selectedH > 0 && (
                <span className="inline-flex items-center gap-1 bg-indigo-100 text-indigo-700 rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
                  <HeroIcons.ClockIcon className="h-3 w-3" />{selectedH}h
                </span>
              )}
              {form.priority && (() => {
                const p = DAILY_TRACKER_PRIORITIES.find(x => x.id === form.priority)
                return p ? (
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold border ${p.tailwind}`}>{p.icon} {p.label}</span>
                ) : null
              })()}
              {form.status && (() => {
                const s = DAILY_TRACKER_STATUSES.find(x => x.id === form.status)
                return s ? (
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold border ${s.tailwind}`}>{s.icon} {s.label}</span>
                ) : null
              })()}
              {form.project_category && (
                <span className="inline-flex items-center gap-1 bg-violet-100 text-violet-700 rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
                  <HeroIcons.FolderIcon className="h-3 w-3" />{form.project_category}
                </span>
              )}
              {form.submitted_to_role && (() => {
                const opt = DAILY_TRACKER_SUBMIT_TO_OPTIONS.find(o => o.id === form.submitted_to_role)
                return opt ? (
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold border ${opt.chipTailwind}`}>
                    <HeroIcons.PaperAirplaneIcon className="h-3 w-3" />{opt.label}
                  </span>
                ) : null
              })()}
            </div>
            <button
              type="submit"
              disabled={!canSubmit || submitting}
              className="flex-shrink-0 px-6 py-2.5 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting ? 'Saving...' : initial ? 'Update Activity' : `Log ${selectedH > 0 ? selectedH + 'h' : 'Activity'}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
// -- Reject note mini-modal ----------------------------------------------------
function RejectModal({ onConfirm, onClose }) {
  const cfg = DAILY_TRACKER_COPY
  const [note, setNote] = useState('')
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-3">
          <div className="h-9 w-9 rounded-full bg-red-100 flex items-center justify-center">
            <HeroIcons.XCircleIcon className="h-5 w-5 text-red-600" />
          </div>
          <h3 className="font-semibold text-slate-800">Reject Activity</h3>
        </div>
        <textarea
          autoFocus
          rows={3}
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder={cfg.rejectNotePlaceholder}
          className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-300 bg-slate-50 mb-4"
        />
        <div className="flex gap-2">
          <button onClick={onClose}
            className="flex-1 py-2 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50">
            Cancel
          </button>
          <button
            onClick={() => note.trim() && onConfirm(note)}
            disabled={!note.trim()}
            className="flex-1 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-semibold disabled:opacity-40">
            Reject
          </button>
        </div>
      </div>
    </div>
  )
}

// -- Main Daily Tracker tab ----------------------------------------------------
function DailyTrackerTab({ currentUser }) {
  const cfg     = DAILY_TRACKER_COPY
  const isStaff = currentUser?.is_staff || currentUser?.is_superuser || false

  const [logs,            setLogs]            = useState([])
  const [summary,         setSummary]         = useState([])
  const [loading,         setLoading]         = useState(true)
  const [submitting,      setSubmitting]      = useState(false)
  const [exportLoading,   setExportLoading]   = useState(false)
  const [selectedDate,    setSelectedDate]    = useState(new Date().toISOString().slice(0, 10))
  const [wizardOpen,      setWizardOpen]      = useState(false)
  const [editingLog,      setEditingLog]      = useState(null)
  const [showTeam,        setShowTeam]        = useState(false)
  const [teamLogs,        setTeamLogs]        = useState([])
  const [teamLoading,     setTeamLoading]     = useState(false)
  const [approvalQueue,   setApprovalQueue]   = useState([])
  const [queueLoading,    setQueueLoading]    = useState(false)
  const [rejectTarget,    setRejectTarget]    = useState(null)  // log id pending rejection
  const [toast,           setToast]           = useState(null)

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  // -- Data loading ----------------------------------------------------------
  const loadLogs = useCallback(async () => {
    setLoading(true)
    try {
      const from14w = (() => { const d = new Date(); d.setDate(d.getDate() - 97); return d.toISOString().slice(0,10) })()
      const [logsRes, sumRes] = await Promise.all([
        payrollService.getDailyLogs({ date: selectedDate }),
        payrollService.getDailyLogSummary({ from: from14w }),
      ])
      setLogs(Array.isArray(logsRes) ? logsRes : logsRes.results ?? [])
      setSummary(Array.isArray(sumRes) ? sumRes : [])
    } catch {
      showToast('Failed to load logs.', 'error')
    } finally {
      setLoading(false)
    }
  }, [selectedDate])

  useEffect(() => { loadLogs() }, [loadLogs])

  const loadApprovalQueue = useCallback(async () => {
    if (!isStaff) return
    setQueueLoading(true)
    try {
      const res = await payrollService.getDailyApprovalQueue()
      setApprovalQueue(Array.isArray(res) ? res : res.results ?? [])
    } catch {
      setApprovalQueue([])
    } finally {
      setQueueLoading(false)
    }
  }, [isStaff])

  useEffect(() => { loadApprovalQueue() }, [loadApprovalQueue])

  const loadTeam = useCallback(async () => {
    if (!isStaff) return
    setTeamLoading(true)
    try {
      const res = await payrollService.getTeamDailyLogs({ date: selectedDate })
      setTeamLogs(Array.isArray(res) ? res : res.results ?? [])
    } catch { setTeamLogs([]) }
    finally { setTeamLoading(false) }
  }, [isStaff, selectedDate])

  useEffect(() => { if (showTeam) loadTeam() }, [showTeam, loadTeam])

  // -- Derived KPIs ----------------------------------------------------------
  const todayLogs    = logs
  const hoursToday   = todayLogs.reduce((a, l) => a + parseFloat(l.hours_spent || 0), 0)
  const tasksDone    = todayLogs.filter(l => l.status === 'done').length
  const blocked      = todayLogs.filter(l => l.status === 'blocked').length
  const pendingCount = todayLogs.filter(l => l.approval_status === 'pending').length

  const weekStart = (() => {
    const d = new Date(); const dow = (d.getDay() + 6) % 7
    d.setDate(d.getDate() - dow); return d.toISOString().slice(0, 10)
  })()
  const hoursWeek = summary.filter(r => r.date >= weekStart)
    .reduce((a, r) => a + (r.total_hours || 0), 0)

  const weekDays = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
  const weekChartData = weekDays.map((day, i) => {
    const d = new Date(weekStart); d.setDate(d.getDate() + i)
    const iso = d.toISOString().slice(0, 10)
    const row = summary.find(r => r.date === iso)
    return { day, hours: row ? parseFloat(row.total_hours.toFixed(1)) : 0 }
  })

  // -- CRUD handlers ---------------------------------------------------------
  async function handleSave(data) {
    setSubmitting(true)
    try {
      if (editingLog) {
        const updated = await payrollService.updateDailyLog(editingLog.id, data)
        setLogs(p => p.map(l => l.id === updated.id ? updated : l))
        showToast('Activity updated.')
      } else {
        const created = await payrollService.createDailyLog(data)
        if (data.log_date === selectedDate) setLogs(p => [created, ...p])
        showToast('Activity submitted \u2014 pending manager approval.')
      }
      setWizardOpen(false)
      setEditingLog(null)
      const from14w = (() => { const d = new Date(); d.setDate(d.getDate() - 97); return d.toISOString().slice(0,10) })()
      const sumRes = await payrollService.getDailyLogSummary({ from: from14w })
      setSummary(Array.isArray(sumRes) ? sumRes : [])
    } catch {
      showToast('Save failed.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this activity log?')) return
    try {
      await payrollService.deleteDailyLog(id)
      setLogs(p => p.filter(l => l.id !== id))
      showToast('Activity deleted.')
    } catch { showToast('Delete failed.', 'error') }
  }

  async function handleApprove(id) {
    try {
      const updated = await payrollService.approveDailyLog(id)
      setLogs(p => p.map(l => l.id === id ? updated : l))
      setApprovalQueue(p => p.filter(l => l.id !== id))
      showToast(cfg.approveSuccess)
    } catch { showToast('Approval failed.', 'error') }
  }

  async function handleReject(id, note) {
    try {
      const updated = await payrollService.rejectDailyLog(id, note)
      setLogs(p => p.map(l => l.id === id ? updated : l))
      setApprovalQueue(p => p.filter(l => l.id !== id))
      setRejectTarget(null)
      showToast(cfg.rejectSuccess)
    } catch { showToast('Rejection failed.', 'error') }
  }

  async function handleExport() {
    setExportLoading(true)
    try {
      const res = await payrollService.exportDailyLogsToS3()
      showToast(`${cfg.exportSuccess} (${res.count} records)`)
    } catch { showToast(cfg.exportError, 'error') }
    finally { setExportLoading(false) }
  }

  // -- Render ----------------------------------------------------------------
  return (
    <div className="space-y-5">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[60] px-4 py-3 rounded-xl shadow-lg text-sm font-medium transition-all ${
          toast.type === 'error'
            ? 'bg-red-50 text-red-700 border border-red-200'
            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
        }`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <HeroIcons.ClipboardDocumentListIcon className="h-5 w-5 text-indigo-600" />
          <h2 className="text-lg font-semibold text-slate-800">{cfg.tabLabel}</h2>
          <input
            type="date"
            value={selectedDate}
            max={new Date().toISOString().slice(0,10)}
            onChange={e => setSelectedDate(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>
        <div className="flex items-center gap-2">
          {isStaff && (
            <button onClick={() => setShowTeam(p => !p)}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                showTeam ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}>
              <HeroIcons.UserGroupIcon className="h-4 w-4 inline mr-1" />Team
            </button>
          )}
          <button onClick={handleExport} disabled={exportLoading}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 disabled:opacity-50">
            <HeroIcons.CloudArrowUpIcon className="h-4 w-4 inline mr-1" />
            {exportLoading ? 'Exporting\u2026' : cfg.exportButton}
          </button>
          <button onClick={() => { setEditingLog(null); setWizardOpen(true) }}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-sm transition-all">
            <HeroIcons.PlusIcon className="h-4 w-4 inline mr-1" />{cfg.addButton}
          </button>
        </div>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Hours Today',     value: hoursToday.toFixed(1), sub: `${pendingCount} pending approval`,  icon: 'ClockIcon',            color: 'text-indigo-600',  bg: 'bg-indigo-50'  },
          { label: 'Tasks Done',      value: tasksDone,             sub: 'approved + non-approved',           icon: 'CheckCircleIcon',      color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Blocked',         value: blocked,               sub: 'need attention',                    icon: 'ExclamationCircleIcon', color: 'text-red-500',    bg: 'bg-red-50'     },
          { label: 'Hours This Week', value: hoursWeek.toFixed(1),  sub: 'Mon\u2013today',                         icon: 'CalendarDaysIcon',     color: 'text-purple-600', bg: 'bg-purple-50'  },
        ].map(tile => {
          const Icon = HeroIcons[tile.icon]
          return (
            <div key={tile.label} className={`rounded-2xl p-4 ${tile.bg} border border-white/60`}>
              <div className="flex items-center gap-2 mb-1">
                {Icon && <Icon className={`h-4 w-4 ${tile.color}`} />}
                <span className="text-xs text-slate-500 font-medium">{tile.label}</span>
              </div>
              <p className={`text-2xl font-bold ${tile.color}`}>{tile.value}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">{tile.sub}</p>
            </div>
          )
        })}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm overflow-x-auto">
          <ActivityHeatmap summary={summary} />
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
          <p className="text-xs font-medium text-slate-500 mb-3">{cfg.weeklyChartTitle}</p>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={weekChartData} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                formatter={v => [`${v} hrs`, 'Hours']} />
              <Bar dataKey="hours" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Approval Queue \u2014 managers/staff only */}
      {isStaff && (
        <div className="bg-white rounded-2xl border border-amber-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-amber-50 flex items-center justify-between bg-amber-50/50">
            <div className="flex items-center gap-2">
              <HeroIcons.ClipboardDocumentCheckIcon className="h-4 w-4 text-amber-600" />
              <p className="font-semibold text-slate-700 text-sm">{cfg.approvalQueueTitle}</p>
              {approvalQueue.length > 0 && (
                <span className="px-2 py-0.5 bg-amber-500 text-white rounded-full text-[11px] font-bold">
                  {approvalQueue.length}
                </span>
              )}
            </div>
            <button onClick={loadApprovalQueue}
              className="text-slate-400 hover:text-indigo-600 transition-colors">
              <HeroIcons.ArrowPathIcon className="h-4 w-4" />
            </button>
          </div>

          {queueLoading ? (
            <div className="p-6 text-center text-slate-400 text-sm">Loading{ELLIPSIS_DISPLAY}</div>
          ) : approvalQueue.length === 0 ? (
            <div className="p-6 text-center text-slate-400 text-sm">
              <HeroIcons.CheckBadgeIcon className="h-8 w-8 mx-auto mb-2 text-emerald-300" />
              {cfg.approvalQueueEmpty}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-amber-50/40 text-[11px] text-slate-500 uppercase tracking-wide">
                    <th className="px-4 py-2 text-left">Employee</th>
                    <th className="px-4 py-2 text-left">Task</th>
                    <th className="px-4 py-2 text-center">Date</th>
                    <th className="px-4 py-2 text-center">Hrs</th>
                    <th className="px-4 py-2 text-left">Category</th>
                    <th className="px-4 py-2 text-center">Sent to</th>
                    <th className="px-4 py-2 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-50">
                  {approvalQueue.slice(0, cfg.teamPageSize).map(log => {
                    const routeOpt = DAILY_TRACKER_SUBMIT_TO_OPTIONS.find(o => o.id === log.submitted_to_role)
                    return (
                    <tr key={log.id} className="hover:bg-amber-50/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-700 whitespace-nowrap">{log.user_full_name}</td>
                      <td className="px-4 py-3 text-slate-800 max-w-[200px] truncate">{log.task_title}</td>
                      <td className="px-4 py-3 text-center text-slate-500 text-xs whitespace-nowrap">{log.log_date}</td>
                      <td className="px-4 py-3 text-center font-mono font-semibold text-slate-700">
                        {parseFloat(log.hours_spent).toFixed(1)}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{log.project_category || 'u2014'}</td>
                      <td className="px-4 py-3 text-center">
                        {routeOpt ? (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${routeOpt.chipTailwind}`}>
                            {routeOpt.label}
                          </span>
                        ) : (
                          <span className="text-slate-300 text-xs">&#x2014;</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleApprove(log.id)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-semibold hover:bg-emerald-100 transition-colors"
                          >
                            <HeroIcons.CheckIcon className="h-3 w-3" /> {cfg.approveButton}
                          </button>
                          <button
                            onClick={() => setRejectTarget(log.id)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded-lg text-xs font-semibold hover:bg-red-100 transition-colors"
                          >
                            <HeroIcons.XMarkIcon className="h-3 w-3" /> {cfg.rejectButton}
                          </button>
                        </div>
                      </td>
                    </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Personal log list */}
      {!showTeam && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
            <p className="font-semibold text-slate-700 text-sm">Activity Log {EMPTY_DISPLAY} {selectedDate}</p>
            <span className="text-xs text-slate-400">{todayLogs.length} {todayLogs.length === 1 ? 'entry' : 'entries'}</span>
          </div>

          {loading ? (
            <div className="p-8 text-center text-slate-400 text-sm">Loading{ELLIPSIS_DISPLAY}</div>
          ) : todayLogs.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <HeroIcons.ClipboardDocumentListIcon className="h-10 w-10 mx-auto text-slate-200" />
              <p className="text-slate-400 text-sm">{cfg.emptyLogs}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-[11px] text-slate-500 uppercase tracking-wide">
                    <th className="px-4 py-2 text-left">Task</th>
                    <th className="px-4 py-2 text-left">Category</th>
                    <th className="px-4 py-2 text-center">Hrs</th>
                    <th className="px-4 py-2 text-center">Priority</th>
                    <th className="px-4 py-2 text-center">Status</th>
                    <th className="px-4 py-2 text-center">Approval</th>
                    <th className="px-4 py-2 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {todayLogs.map(log => {
                    const pc = priorityConfig(log.priority)
                    const sc = statusConfig(log.status)
                    const ac = approvalConfig(log.approval_status)
                    return (
                      <tr key={log.id} className={`transition-colors hover:brightness-95 ${ac.rowBg}`}>
                        <td className="px-4 py-3 font-medium text-slate-800 max-w-[180px] truncate">{log.task_title}</td>
                        <td className="px-4 py-3 text-slate-500 text-xs">{log.project_category || EMPTY_DISPLAY}</td>
                        <td className="px-4 py-3 text-center font-mono font-semibold text-slate-700">
                          {parseFloat(log.hours_spent).toFixed(1)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border font-medium ${pc.tailwind}`}>
                            {pc.icon} {pc.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border font-medium ${sc.tailwind}`}>
                            {sc.icon} {sc.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border font-medium ${ac.tailwind}`}>
                            {ac.icon} {ac.label}
                          </span>
                          {log.approval_note && (
                            <p className="text-[10px] text-slate-400 mt-0.5 max-w-[120px] truncate">{log.approval_note}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            {/* Only allow editing pending/rejected logs */}
                            {log.approval_status !== 'approved' && (
                              <button onClick={() => { setEditingLog(log); setWizardOpen(true) }}
                                className="text-slate-400 hover:text-indigo-600 transition-colors" title="Edit">
                                <HeroIcons.PencilSquareIcon className="h-4 w-4" />
                              </button>
                            )}
                            {/* Manager approve/reject inline for logs they're viewing */}
                            {isStaff && log.approval_status === 'pending' && (
                              <>
                                <button onClick={() => handleApprove(log.id)}
                                  className="text-emerald-400 hover:text-emerald-600 transition-colors" title="Approve">
                                  <HeroIcons.CheckBadgeIcon className="h-4 w-4" />
                                </button>
                                <button onClick={() => setRejectTarget(log.id)}
                                  className="text-red-400 hover:text-red-600 transition-colors" title="Reject">
                                  <HeroIcons.XCircleIcon className="h-4 w-4" />
                                </button>
                              </>
                            )}
                            {log.approval_status !== 'approved' && (
                              <button onClick={() => handleDelete(log.id)}
                                className="text-slate-400 hover:text-red-500 transition-colors" title="Delete">
                                <HeroIcons.TrashIcon className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Team view */}
      {showTeam && isStaff && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-50">
            <p className="font-semibold text-slate-700 text-sm">{cfg.teamViewTitle} {EMPTY_DISPLAY} {selectedDate}</p>
          </div>
          {teamLoading ? (
            <div className="p-8 text-center text-slate-400 text-sm">Loading{ELLIPSIS_DISPLAY}</div>
          ) : teamLogs.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">No team logs for this date.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-[11px] text-slate-500 uppercase tracking-wide">
                    <th className="px-4 py-2 text-left">Employee</th>
                    <th className="px-4 py-2 text-left">Task</th>
                    <th className="px-4 py-2 text-left">Category</th>
                    <th className="px-4 py-2 text-center">Hrs</th>
                    <th className="px-4 py-2 text-center">Priority</th>
                    <th className="px-4 py-2 text-center">Status</th>
                    <th className="px-4 py-2 text-center">Approval</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {teamLogs.slice(0, cfg.teamPageSize).map(log => {
                    const pc = priorityConfig(log.priority)
                    const sc = statusConfig(log.status)
                    const ac = approvalConfig(log.approval_status)
                    return (
                      <tr key={log.id} className={`hover:brightness-95 transition-colors ${ac.rowBg}`}>
                        <td className="px-4 py-3 font-medium text-slate-700">{log.user_full_name}</td>
                        <td className="px-4 py-3 text-slate-800 max-w-[180px] truncate">{log.task_title}</td>
                        <td className="px-4 py-3 text-slate-500 text-xs">{log.project_category || EMPTY_DISPLAY}</td>
                        <td className="px-4 py-3 text-center font-mono font-semibold text-slate-700">
                          {parseFloat(log.hours_spent).toFixed(1)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border font-medium ${pc.tailwind}`}>
                            {pc.icon} {pc.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border font-medium ${sc.tailwind}`}>
                            {sc.icon} {sc.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border font-medium ${ac.tailwind}`}>
                              {ac.icon} {ac.label}
                            </span>
                            {log.approval_status === 'pending' && (
                              <>
                                <button onClick={() => handleApprove(log.id)}
                                  className="text-emerald-400 hover:text-emerald-600" title="Approve">
                                  <HeroIcons.CheckBadgeIcon className="h-4 w-4" />
                                </button>
                                <button onClick={() => setRejectTarget(log.id)}
                                  className="text-red-400 hover:text-red-600" title="Reject">
                                  <HeroIcons.XCircleIcon className="h-4 w-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Wizard form */}
      {wizardOpen && (
        <ActivityWizard
          initial={editingLog}
          onSave={handleSave}
          onClose={() => { setWizardOpen(false); setEditingLog(null) }}
          submitting={submitting}
          alreadyLoggedHours={hoursToday}
        />
      )}

      {/* Reject modal */}
      {rejectTarget && (
        <RejectModal
          onConfirm={note => handleReject(rejectTarget, note)}
          onClose={() => setRejectTarget(null)}
        />
      )}
    </div>
  )
}

// -----------------------------------------------------------------------------
// MAIN COMPONENT
// -----------------------------------------------------------------------------

export default function EmployeeSelfService() {
  const { user: authUser } = useSelector((s) => s.auth) || {}
  const { currentUser }    = useSelector((s) => s.rbac) || {}
  const authProfile = currentUser || authUser

  const now = new Date()
  const [activeTab, setActiveTab] = useState('overview')

  // -- Data state --------------------------------------------------------------
  const [profile,      setProfile]      = useState(null)
  const [monthlyTs,    setMonthlyTs]    = useState(null)
  const [todayTs,      setTodayTs]      = useState(null)
  const [userHistory,  setUserHistory]  = useState(null)
  const [leaveRecord,  setLeaveRecord]  = useState(null)
  const [leaveTypes,   setLeaveTypes]   = useState([])
  const [leaveRequests,setLeaveRequests]= useState([])
  const [calendarData, setCalendarData] = useState([])
  const [salaryInfo,   setSalaryInfo]   = useState(null)
  const [slips,        setSlips]        = useState([])

  // -- Loading / error state ---------------------------------------------------
  const [loadingProfile,  setLoadingProfile]  = useState(true)
  const [loadingTs,       setLoadingTs]       = useState(true)
  const [loadingLeave,    setLoadingLeave]    = useState(true)
  const [loadingPayroll,  setLoadingPayroll]  = useState(true)
  const [loadingCalendar, setLoadingCalendar] = useState(true)

  // -- Leave form state --------------------------------------------------------
  const [submitting,    setSubmitting]    = useState(false)
  const [submitResult,  setSubmitResult]  = useState(null)

  // -- Load profile ------------------------------------------------------------
  useEffect(() => {
    setLoadingProfile(true)
    rbacService.getCurrentUser()
      .then(r => setProfile(r?.data || r))
      .catch(() => setProfile(authProfile))
      .finally(() => setLoadingProfile(false))
  }, [])

  // -- Load timesheet data for current user ------------------------------------
  useEffect(() => {
    setLoadingTs(true)
    // Use new self-service endpoints that automatically filter by logged-in user
    const now = new Date()
    const employeeCode = profile?.employee_id || profile?.engineer_profile?.employee_code

    Promise.all([
      timesheetSvc.fetchMyMonthlyAttendance(now.getFullYear(), now.getMonth() + 1).catch(() => null),
      timesheetSvc.fetchMyDailyAttendance(todayStr()).catch(() => null),
      employeeCode
        ? timesheetSvc.fetchUserHistory({ code: employeeCode, limit: 60 }).catch(() => null)
        : Promise.resolve(null),
    ]).then(([monthly, daily, history]) => {
      // New self-service endpoints return { data: {...}, employee_code, email }
      // where data is the user's record directly, not an array to filter
      if (monthly?.data) {
        setMonthlyTs(monthly.data)
      } else if (monthly && !monthly.configured) {
        setMonthlyTs(null)
      } else {
        setMonthlyTs(null)
      }

      // Same for daily
      if (daily?.data) {
        setTodayTs(daily.data)
      } else if (daily && !daily.configured) {
        setTodayTs(null)
      } else {
        setTodayTs(null)
      }

      setUserHistory(history)
    }).finally(() => setLoadingTs(false))
  }, [profile])

  // -- Load leave data ---------------------------------------------------------
  useEffect(() => {
    setLoadingLeave(true)

    // employee.id from backend = Django User.id (not UserProfile.id)
    // employee_id on UserProfile = biometric employee code
    const userId = profile?.user?.id // Django User UUID — matches LeaveRequest.employee FK

    Promise.all([
      payrollService.getLeaveTypes().catch(() => []),
      // Backend auto-scopes to current user (via perform_create + get_queryset fix)
      payrollService.getLeaveRequests({ page_size: 50 }).catch(() => ({ results: [] })),
      // Backend auto-scopes to current user's employee_id with intelligent fallback
      // No need to pass employee_code or search - backend detects from auth user
      payrollService.getLeaveRecords({ page_size: 5 }).catch(() => ({ results: [] })),
    ]).then(([types, reqRes, recRes]) => {
      // Filter leave types to only show enabled types from ESS_LEAVE_TYPE_CONFIG.
      // To enable/disable a type, change `enabled` in hrLeave.config.js — no code change needed.
      const enabledCategories = Object.keys(LEAVE_TYPE_CONFIG).filter(
        key => LEAVE_TYPE_CONFIG[key].enabled !== false
      )
      const apiTypes = Array.isArray(types) ? types : types?.results || []
      const filteredTypes = apiTypes.filter(t => {
        const category = (t.category || t.code || '').toLowerCase()
        return enabledCategories.includes(category)
      })
      setLeaveTypes(filteredTypes)

      const reqs = Array.isArray(reqRes) ? reqRes : reqRes?.results || []
      // Backend scopes leave requests to the current user. As a safety net, also
      // filter client-side using the correct User UUID (not the UserProfile UUID).
      setLeaveRequests(
        userId
          ? reqs.filter(r => r.employee === userId)
          : reqs
      )

      const recs = Array.isArray(recRes) ? recRes : recRes?.results || []
      setLeaveRecord(recs.length > 0 ? recs[0] : null)
    }).finally(() => setLoadingLeave(false))
  }, [profile])

  // -- Load payroll data -------------------------------------------------------
  useEffect(() => {
    setLoadingPayroll(true)
    const userId  = profile?.user?.id   // Django User UUID for SalarySlip FK lookups
    const empCode = profile?.employee_id // biometric code for EmployeeSalaryInfo lookup

    Promise.all([
      // Backend SalarySlipViewSet filters by ?employee=<User UUID> (added in backend fix)
      userId
        ? payrollService.getSalarySlips({ employee: userId, page_size: 12 }).catch(() => ({ results: [] }))
        : payrollService.getSalarySlips({ page_size: 12 }).catch(() => ({ results: [] })),
      // EmployeeSalaryInfo: filter by user UUID (added in backend fix)
      userId
        ? payrollService.getEmployeeSalaryInfo({ employee: userId }).catch(() => null)
        : Promise.resolve(null),
    ]).then(([slipRes, info]) => {
      const slipList = Array.isArray(slipRes) ? slipRes : slipRes?.results || []
      setSlips(slipList)
      const infoList = Array.isArray(info) ? info : info?.results || [info]
      setSalaryInfo(infoList.find(Boolean) || null)
    }).finally(() => setLoadingPayroll(false))
  }, [profile])

  // -- Load team calendar ------------------------------------------------------
  useEffect(() => {
    setLoadingCalendar(true)
    payrollService.getLeaveCalendar(now.getFullYear(), now.getMonth() + 1)
      .then(data => setCalendarData(Array.isArray(data) ? data : data?.results || []))
      .catch(() => setCalendarData([]))
      .finally(() => setLoadingCalendar(false))
  }, [])

  // -- Derived: AI insights ----------------------------------------------------
  const insights = useMemo(() => generateInsights({
    leaveRecord,
    monthlyTs,
    today: todayTs,
    slips,
  }), [leaveRecord, monthlyTs, todayTs, slips])

  // -- Leave request submit ----------------------------------------------------
  const handleLeaveSubmit = useCallback(async (form) => {
    setSubmitting(true)
    setSubmitResult(null)
    try {
      // Use Django User UUID — matches the LeaveRequest.employee FK
      const userId  = profile?.user?.id
      const empCode = profile?.employee_id
      const empName = profile
        ? [profile.user?.first_name, profile.user?.last_name].filter(Boolean).join(' ') || profile.user?.username
        : null
      
      // SOFT-CODED: Handle file upload with FormData if attachment is present
      let response
      if (form.attachment) {
        const formData = new FormData()
        formData.append('leave_type', form.leave_type)
        formData.append('start_date', form.start_date)
        formData.append('end_date', form.end_date)
        formData.append('half_day', form.half_day ? 'true' : 'false')
        formData.append('reason', form.reason || '')
        formData.append('contact_number', form.contact_number || '')
        formData.append('substitute_name', form.substitute_name || '')
        formData.append('attachment', form.attachment)
        if (userId) formData.append('employee', userId)
        if (empCode) formData.append('employee_code', empCode)
        if (empName) formData.append('employee_name', empName)
        
        response = await payrollService.createLeaveRequest(formData, true) // true = multipart
      } else {
        // Regular JSON submission without attachment
        const payload = {
          ...form,
          // Backend perform_create also sets these — we send them for non-staff HR fallback
          ...(userId   ? { employee: userId }             : {}),
          ...(empCode  ? { employee_code: empCode }       : {}),
          ...(empName  ? { employee_name: empName }       : {}),
        }
        response = await payrollService.createLeaveRequest(payload)
      }
      
      setSubmitResult({ success: true, message: 'Leave request submitted successfully! Awaiting manager approval.' })
      // Reload requests — backend now scopes to current user
      const reqRes = await payrollService.getLeaveRequests({ page_size: 50 }).catch(() => ({ results: [] }))
      const reqs   = Array.isArray(reqRes) ? reqRes : reqRes?.results || []
      setLeaveRequests(userId ? reqs.filter(r => r.employee === userId) : reqs)
    } catch (err) {
      const msg = err?.response?.data?.detail ||
                  err?.response?.data?.non_field_errors?.[0] ||
                  Object.values(err?.response?.data || {})?.[0]?.[0] ||
                  'Failed to submit leave request. Please try again.'
      setSubmitResult({ error: msg })
    } finally {
      setSubmitting(false)
    }
  }, [profile])

  // -- Tab notification badges -------------------------------------------------
  const pendingLeave   = leaveRequests.filter(r => r.status?.toUpperCase() === 'PENDING').length
  const unreadNotifs   = leaveRequests.filter(r => ['APPROVED','REJECTED','RM_REJECTED'].includes(r.status?.toUpperCase())).length

  const tabBadges = {
    leave:         pendingLeave > 0 ? pendingLeave : null,
    notifications: unreadNotifs > 0 ? unreadNotifs : null,
  }

  // -- Section renders ---------------------------------------------------------
  const renderSection = () => {
    // Check if profile is incomplete (missing employee_id or has placeholder/marker)
    const empId = profile?.employee_id
    const invalidMarkers = ['DELETED', 'TEST_ACCOUNT', 'EXTERNAL']
    const needsConfig = !empId || empId === '' || empId.includes('@') || empId.startsWith('EMP') || invalidMarkers.includes(empId)
    
    switch (activeTab) {
      case 'overview':
        return (
          <div className="space-y-5">
            {/* Profile Configuration Alert */}
            {needsConfig && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Icon name="ExclamationTriangleIcon" className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="font-semibold text-amber-900 text-sm mb-1">
                      Profile Configuration Required
                    </div>
                    <div className="text-amber-700 text-sm leading-relaxed">
                      Your employee ID is not configured. Attendance and leave data require a valid employee ID linked to the biometric system.
                      Please contact HR (<a href="mailto:hr@rejlers.ae" className="underline hover:text-amber-900">hr@rejlers.ae</a>) to complete your profile setup.
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
              <div className="xl:col-span-2">
                <TodayStatusCard todayData={todayTs} loading={loadingTs} />
              </div>
              <AIInsightsPanel insights={insights} loading={loadingTs || loadingLeave || loadingPayroll} />
            </div>

            {/* Quick leave balance preview */}
            <SectionCard title="Leave Balance Snapshot" icon="CalendarDaysIcon">
              {loadingLeave ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[...Array(4)].map((_, i) => <SkeletonBox key={i} className="h-16" />)}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <KpiCard icon="CalendarDaysIcon" label="Annual Balance" value={`${Number(leaveRecord?.leave_balance||0).toFixed(1)} d`} sub="Remaining" tone="blue" />
                  <KpiCard icon="CheckCircleIcon" label="Days Taken" value={`${Number(leaveRecord?.total_taken||0).toFixed(1)} d`} sub="This year" tone="green" />
                  <KpiCard icon="ClockIcon" label="Pending" value={pendingLeave} sub="Awaiting approval" tone={pendingLeave ? 'amber' : 'slate'} />
                  <KpiCard icon="BanknotesIcon" label="Encashed" value={`${Number(leaveRecord?.total_encashed||0).toFixed(1)} d`} sub={`${new Date().toLocaleString('default',{month:'short',year:'numeric'})} YTD`} tone="purple" />
                </div>
              )}
            </SectionCard>
          </div>
        )

      case 'leave':
        return (
          <div className="space-y-5">
            {/* Profile Configuration Alert */}
            {needsConfig && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Icon name="ExclamationTriangleIcon" className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="font-semibold text-amber-900 text-sm mb-1">
                      Employee ID Required
                    </div>
                    <div className="text-amber-700 text-sm">
                      To view leave records, please contact HR to configure your employee ID. Current value: <code className="bg-amber-100 px-1 rounded">{empId || 'Not Set'}</code>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <LeaveBalanceSection
              leaveRecord={leaveRecord}
              requests={leaveRequests}
              loading={loadingLeave}
            />
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
              <LeaveRequestForm
                leaveTypes={leaveTypes}
                leaveRecord={leaveRecord}
                requests={leaveRequests}
                onSubmit={handleLeaveSubmit}
                submitting={submitting}
                submitResult={submitResult}
              />
              <SectionCard title="My Leave Requests" subtitle="Recent requests" icon="ClipboardDocumentListIcon">
                {loadingLeave ? (
                  <div className="space-y-2">{[...Array(4)].map((_, i) => <SkeletonBox key={i} className="h-12" />)}</div>
                ) : leaveRequests.length === 0 ? (
                  <EmptyNotice icon="CalendarDaysIcon" message="No leave requests found" />
                ) : (
                  <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
                    {leaveRequests.slice(0, 15).map(r => {
                      const st = (r.status || '').toUpperCase()
                      const sm = {
                        PENDING:     'bg-amber-50 text-amber-700 border-amber-200',
                        RM_APPROVED: 'bg-blue-50 text-blue-700 border-blue-200',
                        RM_REJECTED: 'bg-orange-50 text-orange-700 border-orange-200',
                        APPROVED:    'bg-emerald-50 text-emerald-700 border-emerald-200',
                        REJECTED:    'bg-rose-50 text-rose-700 border-rose-200',
                        CANCELLED:   'bg-slate-50 text-slate-500 border-slate-200',
                      }[st] || 'bg-slate-50 text-slate-500 border-slate-200'
                      const stLabel = r.status_display || {
                        PENDING:     'Pending',
                        RM_APPROVED: 'Awaiting HR',
                        RM_REJECTED: 'Rejected by Manager',
                        APPROVED:    'Approved',
                        REJECTED:    'Rejected',
                        CANCELLED:   'Cancelled',
                      }[st] || st
                      return (
                        <div key={r.id} className="py-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <div className="text-sm font-medium text-slate-800">
                                {r.leave_type_display || r.leave_type || 'Leave'}
                              </div>
                              <div className="text-xs text-slate-400">
                                {fmtDate(r.start_date)} {EMPTY_DISPLAY} {fmtDate(r.end_date)}
                                {r.duration_days ? ` ${BULLET_DISPLAY} ${r.duration_days}d` : ''}
                              </div>
                            </div>
                            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${sm}`}>
                              {stLabel}
                            </span>
                          </div>
                          {r.reason && <div className="text-xs text-slate-400 mt-0.5 truncate">{r.reason}</div>}
                          {/* Show RM reviewer when applicable */}
                          {(st === 'RM_APPROVED' || st === 'APPROVED') && r.rm_reviewed_by_name && (
                            <div className="text-xs text-blue-500 mt-0.5">
                              Manager: {r.rm_reviewed_by_name}
                              {r.rm_reviewed_at && ` · ${r.rm_reviewed_at.slice(0,10)}`}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </SectionCard>
            </div>
          </div>
        )

      case 'attendance':
        return <AttendanceAnalytics profile={profile} monthlyTs={monthlyTs} loading={loadingTs} />

      case 'timesheet':
        return <ESSTimesheetView profile={profile} />

      case 'payroll':
        return <PayrollSnapshot salaryInfo={salaryInfo} slips={slips} loading={loadingPayroll} />

      case 'team':
        return <TeamCalendar calendarData={calendarData} loading={loadingCalendar} />

      case 'daily_tracker':
        return <DailyTrackerTab currentUser={currentUser || authProfile} />

      case 'twin':
        return (
          <DigitalTwin
            monthlyTs={monthlyTs}
            leaveRecord={leaveRecord}
            slips={slips}
            requests={leaveRequests}
            loading={loadingTs || loadingLeave || loadingPayroll}
          />
        )

      case 'notifications':
        return <NotificationsCenter requests={leaveRequests} loading={loadingLeave} />

      case 'site_visits':
        return (
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>GPS-Based Site Visit Tracking</strong> - Request site visits, check-in/out with GPS, and track off-site attendance.
              </p>
              <a href="/hr/site-visits" className="mt-2 inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
                Open Site Visit Tracker →
              </a>
            </div>
            <p className="text-sm text-slate-500">
              Note: Site visit feature is available at <a href="/hr/site-visits" className="text-blue-600 underline">/hr/site-visits</a>
            </p>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="bg-slate-50">
      {/* People nav cross-link */}
      <div className="px-4 sm:px-6 lg:px-8 pt-4">
        <PeopleNav activeId="ess" />
      </div>

      <div className="px-4 sm:px-6 lg:px-8 py-5 space-y-5">
        {/* -- Profile Header -- */}
        <EmployeeProfileHeader
          profile={profile}
          leaveRecord={leaveRecord}
          monthlyTs={monthlyTs}
          salaryInfo={salaryInfo}
          loading={loadingProfile}
        />

        {/* -- Tab Navigation -- */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="px-4 pt-1 pb-0 flex gap-0.5 overflow-x-auto scrollbar-hide border-b border-slate-100">
            {ESS_TABS.map(tab => {
              const isActive = tab.id === activeTab
              const badge    = tabBadges[tab.id]
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium
                    whitespace-nowrap transition-colors flex-shrink-0 relative
                    border-b-2 -mb-px
                    ${isActive
                      ? 'bg-blue-50/70 text-blue-700 border-blue-500 rounded-t-lg'
                      : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50 border-transparent rounded-t-lg'}
                  `}
                >
                  <Icon name={tab.icon} className={`w-4 h-4 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                  {tab.label}
                  {badge && (
                    <span className="ml-1 min-w-[18px] h-[18px] px-1 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">
                      {badge}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* -- Active Section -- */}
        <div>
          {renderSection()}
        </div>

        {/* -- Footer -- */}
        <div className="pb-6 text-center text-xs text-slate-400 flex items-center justify-center gap-1">
          <Icon name="ShieldCheckIcon" className="w-3.5 h-3.5 text-emerald-400" />
          You are viewing your own personal workspace. Data is securely scoped to your account.
        </div>
      </div>
    </div>
  )
}
