/**
 * Payroll Intelligence Platform — Main Shell
 * Route: /hr/payroll
 *
 * Tab container for all 6 payroll modules.
 * Hoists shared state (activeRunId, selectedEmployee) and passes down as props.
 * 
 * Notification Integration:
 *   When user clicks a workflow notification, they're navigated here with ?run=<id>
 *   The component auto-switches to the "engine" tab and selects that payroll run.
 */
import { useState, useEffect, useCallback } from 'react'
import { useSelector } from 'react-redux'
import { useSearchParams } from 'react-router-dom'
import * as HeroIcons from '@heroicons/react/24/outline'
import {
  PAYROLL_TABS,
  PAYROLL_DEFAULT_TAB,
  PAYROLL_COPY,
  PAYROLL_FULLSCREEN_ENABLED,
} from '../../config/hrPayroll.config'

// Lazy-import modules (all exist in the payroll/ subfolder)
import PayrollDashboard      from './payroll/PayrollDashboard'
import AttendanceDashboard   from './payroll/AttendanceDashboard'
import LeaveDashboard        from './payroll/LeaveDashboard'
import PayrollEngine         from './payroll/PayrollEngine'
import ApprovalTracker       from './payroll/ApprovalTracker'

const TAB_COMPONENTS = {
  dashboard:  PayrollDashboard,
  attendance: AttendanceDashboard,
  leave:      LeaveDashboard,
  engine:     PayrollEngine,
  salary:     PayrollEngine,
  tracker:    ApprovalTracker,
}

export default function Payroll() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [activeTab,    setActiveTab]    = useState(PAYROLL_DEFAULT_TAB)
  const [activeRunId,  setActiveRunId]  = useState(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  // ── Notification deep-link handling ────────────────────────────────────────
  // When user clicks a workflow notification, auto-switch to engine tab and select the run
  useEffect(() => {
    const runIdFromUrl = searchParams.get('run')
    const tabFromUrl = searchParams.get('tab')
    if (runIdFromUrl) {
      setActiveRunId(runIdFromUrl)
      setActiveTab('salary')
      console.log(`[Payroll] Notification deep-link detected: run=${runIdFromUrl}, switching to Salary Management`)
    } else {
      // `engine` was the former top-level route. Keep bookmarks and
      // notifications working while presenting one canonical workspace.
      const canonicalTab = tabFromUrl === 'engine' ? 'salary' : tabFromUrl
      if (canonicalTab && PAYROLL_TABS.some((tab) => tab.id === canonicalTab)) {
        setActiveTab(canonicalTab)
        if (tabFromUrl === 'engine') {
          const next = new URLSearchParams(searchParams)
          next.set('tab', 'salary')
          setSearchParams(next, { replace: true })
        }
      }
    }
  }, [searchParams, setSearchParams])

  const selectTab = useCallback((tabId) => {
    const canonicalTab = tabId === 'engine' ? 'salary' : tabId
    setActiveTab(canonicalTab)
    if (canonicalTab !== 'salary') setActiveRunId(null)
    const next = new URLSearchParams(searchParams)
    next.set('tab', canonicalTab)
    if (canonicalTab !== 'salary') next.delete('run')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  // Sync state with native fullscreenchange so the button icon stays accurate
  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [])

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {})
    } else {
      document.exitFullscreen().catch(() => {})
    }
  }, [])

  // ── Role-based tab visibility ────────────────────────────────────────────
  const rbacUser   = useSelector(s => s.rbac?.currentUser)
  const authUser   = useSelector(s => s.auth?.user)
  const isHRManager = (
    authUser?.is_staff ||
    authUser?.is_superuser ||
    rbacUser?.roles?.some(r =>
      r.code?.startsWith('hr') || r.code === 'admin' || r.code === 'superadmin'
    )
  ) ?? false
  // Approval Tracker is restricted to super-admins and platform admins
  const isSuperAdmin = (
    authUser?.is_superuser ||
    rbacUser?.roles?.some(r => r.code === 'superadmin' || r.code === 'admin')
  ) ?? false
  const visibleTabs = PAYROLL_TABS.filter(tab =>
    (!tab.hrOnly || isHRManager) && (!tab.adminOnly || isSuperAdmin)
  )

  const ActiveModule = TAB_COMPONENTS[activeTab]

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Page Header */}
      <div className="border-b border-slate-200 bg-white">
        <div className="px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-slate-950 via-blue-950 to-blue-800 px-5 py-5 text-white shadow-lg shadow-blue-950/10 sm:px-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">Human Resources · Payroll</p>
              <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold tracking-tight text-white">
                <HeroIcons.BanknotesIcon className="h-6 w-6 text-cyan-300" />
                {PAYROLL_COPY.pageTitle}
              </h1>
              <p className="mt-1 text-sm text-blue-100">One employee record across attendance, leave, salary, payroll runs and approvals.</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-xs text-blue-100">
                <HeroIcons.ShieldCheckIcon className="h-4 w-4 text-emerald-300" />
                PostgreSQL · AWS S3 · Rule-based AI
              </div>
              {PAYROLL_FULLSCREEN_ENABLED && (
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  title={PAYROLL_COPY.fullscreenTitle}
                  className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-white/20"
                >
                  {isFullscreen
                    ? <HeroIcons.ArrowsPointingInIcon  className="w-4 h-4" />
                    : <HeroIcons.ArrowsPointingOutIcon className="w-4 h-4" />
                  }
                  {isFullscreen ? PAYROLL_COPY.fullscreenExit : PAYROLL_COPY.fullscreenEnter}
                </button>
              )}
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {visibleTabs.map((tab) => {
              const Icon = HeroIcons[tab.icon] || HeroIcons.ChartBarIcon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => selectTab(tab.id)}
                  title={tab.description}
                  className={`flex min-w-0 items-center gap-2 rounded-xl border px-3 py-3 text-sm font-semibold transition-all ${
                    isActive
                      ? 'border-blue-300 bg-blue-50 text-blue-800 shadow-sm ring-1 ring-blue-100'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${isActive ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}><Icon className="h-4 w-4" /></span>
                  <span className="truncate">{tab.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Module Content */}
      <div className="px-4 py-6 sm:px-6 lg:px-8">
        {ActiveModule ? (
          <ActiveModule
            activeRunId={activeRunId}
            initialTab={activeTab === 'salary' && !activeRunId ? 'employees' : undefined}
            onSelectRun={(run) => {
              const id = typeof run === 'string' ? run : run?.id
              setActiveRunId(id)
            }}
            onSwitchTab={selectTab}
          />
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 p-14 text-center text-slate-400">
            <HeroIcons.CpuChipIcon className="w-12 h-12 mx-auto mb-2 opacity-30" />
            <p>Module not found</p>
          </div>
        )}
      </div>
    </div>
  )
}
