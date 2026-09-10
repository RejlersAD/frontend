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
import './payroll/radaiPayroll.css'
import { useState, useEffect, useCallback } from 'react'
import { useSelector } from 'react-redux'
import { Navigate, useSearchParams } from 'react-router-dom'
import * as HeroIcons from '@heroicons/react/24/outline'
import {
  PAYROLL_TABS,
  PAYROLL_DEFAULT_TAB,
} from '../../config/hrPayroll.config'

// Lazy-import modules (all exist in the payroll/ subfolder)
import PayrollDashboard      from './payroll/PayrollDashboard'
import AttendanceDashboard   from './payroll/AttendanceDashboard'
import LeaveDashboard        from './payroll/LeaveDashboard'
import ApprovalTracker       from './payroll/ApprovalTracker'

const TAB_COMPONENTS = {
  dashboard:  PayrollDashboard,
  attendance: AttendanceDashboard,
  leave:      LeaveDashboard,
  engine:     PayrollDashboard,
  salary:     PayrollDashboard,
  tracker:    ApprovalTracker,
}

export default function Payroll({ module = 'payroll' }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const [activeTab,    setActiveTab]    = useState(module === 'payroll' ? PAYROLL_DEFAULT_TAB : module)
  const [activeRunId,  setActiveRunId]  = useState(null)

  // ── Notification deep-link handling ────────────────────────────────────────
  // When user clicks a workflow notification, auto-switch to engine tab and select the run
  useEffect(() => {
    if (module !== 'payroll') { setActiveTab(module); setActiveRunId(null); return }
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
  }, [searchParams, setSearchParams, module])

  const selectTab = useCallback((tabId) => {
    const canonicalTab = tabId === 'engine' ? 'salary' : tabId
    setActiveTab(canonicalTab)
    if (canonicalTab !== 'salary') setActiveRunId(null)
    const next = new URLSearchParams(searchParams)
    next.set('tab', canonicalTab)
    if (canonicalTab !== 'salary') next.delete('run')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  // ── Role-based tab visibility ────────────────────────────────────────────
  const rbacUser   = useSelector(s => s.rbac?.currentUser)
  const authUser   = useSelector(s => s.auth?.user)
  const isHRManager = (
    authUser?.is_staff ||
    authUser?.is_superuser ||
    rbacUser?.roles?.some(r =>
      r.code?.startsWith('hr') || ['admin', 'superadmin', 'super_admin'].includes(r.code)
    )
  ) ?? false
  // Approval Tracker is restricted to super-admins and platform admins
  const isSuperAdmin = (
    authUser?.is_superuser ||
    rbacUser?.roles?.some(r => ['admin', 'superadmin', 'super_admin'].includes(r.code))
  ) ?? false
  const visibleTabs = PAYROLL_TABS.filter(tab =>
    tab.id !== 'salary' && (!tab.hrOnly || isHRManager) && (!tab.adminOnly || isSuperAdmin)
  )

  const [headerActions, setHeaderActions] = useState(null)
  const effectiveTab = module === 'payroll' ? activeTab : module
  const ActiveModule = TAB_COMPONENTS[effectiveTab]
  const title = module === 'attendance' ? 'Attendance Management' : module === 'leave' ? 'Leave Management' : 'Payroll Management'
  const ModuleIcon = module === 'attendance' ? HeroIcons.ClipboardDocumentCheckIcon : module === 'leave' ? HeroIcons.CalendarDaysIcon : HeroIcons.BanknotesIcon
  const legacyTab = searchParams.get('tab')?.replace(/,$/, '')
  if (module === 'payroll' && ['attendance', 'leave'].includes(legacyTab)) {
    const remaining = new URLSearchParams(searchParams)
    remaining.delete('tab')
    return <Navigate to={{ pathname: `/hr/${legacyTab}`, search: remaining.toString() }} replace />
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Page Header */}
      <div className="border-b border-slate-200 bg-white">
        <div className="px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="flex items-center gap-3 text-xl font-semibold tracking-tight text-slate-900">
                <span className="rounded-lg border border-indigo-100 bg-indigo-50 p-2"><ModuleIcon className="h-5 w-5 text-indigo-600" /></span>
                {title}
              </h1>
            </div>
            {module === 'leave' && <div ref={setHeaderActions} />}

          </div>

          {/* Tab Navigation */}
          {module === 'payroll' && visibleTabs.length > 1 && <div className="mt-4 flex flex-wrap gap-1 rounded-lg bg-slate-50 p-1">
            {visibleTabs.map((tab) => {
              const Icon = HeroIcons[tab.icon] || HeroIcons.ChartBarIcon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => selectTab(tab.id)}
                  title={tab.description}
                  className={`flex min-w-0 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-all ${
                    isActive
                      ? 'border-indigo-200 bg-white text-indigo-700 shadow-sm'
                      : 'border-transparent bg-transparent text-slate-600 hover:bg-white hover:text-indigo-700'
                  }`}
                >
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center ${isActive ? 'text-indigo-600' : 'text-slate-400'}`}><Icon className="h-4 w-4" /></span>
                  <span className="truncate">{tab.label}</span>
                </button>
              )
            })}
          </div>}
        </div>
      </div>

      {/* Module Content */}
      <div className={`px-4 py-5 sm:px-6 lg:px-8 ${effectiveTab !== 'dashboard' ? 'radai-payroll-module' : ''}`}>
        {ActiveModule ? (
          <ActiveModule
            headerActions={headerActions}
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
