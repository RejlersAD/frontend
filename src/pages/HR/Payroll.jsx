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
  tracker:    ApprovalTracker,
}

export default function Payroll() {
  const [searchParams] = useSearchParams()
  const [activeTab,    setActiveTab]    = useState(PAYROLL_DEFAULT_TAB)
  const [activeRunId,  setActiveRunId]  = useState(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  // ── Notification deep-link handling ────────────────────────────────────────
  // When user clicks a workflow notification, auto-switch to engine tab and select the run
  useEffect(() => {
    const runIdFromUrl = searchParams.get('run')
    if (runIdFromUrl) {
      setActiveRunId(runIdFromUrl)
      setActiveTab('engine')  // Auto-switch to engine tab
      console.log(`[Payroll] Notification deep-link detected: run=${runIdFromUrl}, switching to engine tab`)
    }
  }, [searchParams])

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
    <div className="bg-slate-50">
      {/* Page Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <HeroIcons.BanknotesIcon className="w-6 h-6 text-blue-600" />
                {PAYROLL_COPY.pageTitle}
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">{PAYROLL_COPY.pageSubtitle}</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
                <HeroIcons.ShieldCheckIcon className="w-4 h-4 text-emerald-500" />
                PostgreSQL · AWS S3 · Rule-based AI
              </div>
              {PAYROLL_FULLSCREEN_ENABLED && (
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  title={PAYROLL_COPY.fullscreenTitle}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-slate-50 text-slate-600 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 transition-colors"
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
          <div className="mt-4 flex gap-1 overflow-x-auto pb-0.5 scrollbar-hide">
            {visibleTabs.map((tab) => {
              const Icon = HeroIcons[tab.icon] || HeroIcons.ChartBarIcon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  title={tab.description}
                  className={`flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-t-lg border-b-2 whitespace-nowrap transition-colors ${
                    isActive
                      ? 'border-blue-600 text-blue-700 bg-blue-50/60'
                      : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Module Content */}
      <div className="px-4 sm:px-6 lg:px-8 py-6">
        {ActiveModule ? (
          <ActiveModule
            activeRunId={activeRunId}
            onSelectRun={(run) => {
              const id = typeof run === 'string' ? run : run?.id
              setActiveRunId(id)
            }}
            onSwitchTab={(tabId) => setActiveTab(tabId)}
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
