/**
 * PersonalDashboard — Role-based personalized dashboard.
 * Rendered inside Dashboard.jsx for all non-super-admin users.
 * Thin renderer: all layout decisions driven by personalDashboard.config.js.
 *
 * Data flow (apiService baseURL already includes /api/v1):
 *   GET /dashboard/personal/          → role-scoped bundle (polls every 60s)
 *   GET /dashboard/personal/insights/ → AI insights (once on mount)
 */
import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useSelector } from 'react-redux'

import { PERSONAL_DASHBOARD_CONFIG, ROLE_LAYOUTS } from '../config/personalDashboard.config'
import { getPersona } from '../config/personalDashboardPersona.config'

import WelcomeHero          from './PersonalDashboard/WelcomeHero'
import AIInsightsStrip      from './PersonalDashboard/AIInsightsStrip'
import MyModulesGrid        from './PersonalDashboard/MyModulesGrid'
import ActivityFeed         from './PersonalDashboard/ActivityFeed'
import PendingActionsWidget from './PersonalDashboard/PendingActionsWidget'
import UsageStatsChart      from './PersonalDashboard/UsageStatsChart'
import QuickActionsBar      from './PersonalDashboard/QuickActionsBar'
import ProjectPortfolio     from './PersonalDashboard/ProjectPortfolio'
import EVMHealthGauges      from './PersonalDashboard/EVMHealthGauges'
import MilestonesTimeline   from './PersonalDashboard/MilestonesTimeline'
import MyTasksWidget        from './PersonalDashboard/MyTasksWidget'
import RecentChangesWidget  from './PersonalDashboard/RecentChangesWidget'

// ─── Customisable-layout stack (drag / hide / reset) ────────────────────────
import usePersonalDashboardLayout from './PersonalDashboard/usePersonalDashboardLayout'
import SortableWidget             from './PersonalDashboard/SortableWidget'
import CustomizeToolbar           from './PersonalDashboard/CustomizeToolbar'
import AIDashboardStyles          from './PersonalDashboard/AIDashboardStyles'
import {
  DndContext, PointerSensor, KeyboardSensor,
  useSensor, useSensors, closestCenter,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy,
  arrayMove, sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'

import apiService from '../services/api.service'

// ─── API helpers ─────────────────────────────────────────────────────────────
const fetchPersonalDashboard = () =>
  apiService.get('/dashboard/personal/')

const fetchPersonalInsights = () =>
  apiService.get('/dashboard/personal/insights/')

const fetchPersonaBundle = (path) =>
  apiService.get(path)
// ─────────────────────────────────────────────────────────────────────────────

// Team snapshot inline component
function TeamSnapshotCard({ teamSnapshot }) {
  if (!teamSnapshot) return null
  const activePct = teamSnapshot.team_total
    ? Math.round((teamSnapshot.active_today / teamSnapshot.team_total) * 100)
    : 0
  return (
    <div className="relative overflow-hidden bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <div className="pointer-events-none absolute -top-8 -right-8 h-24 w-24 rounded-full bg-indigo-100 blur-2xl opacity-70" />
      <div className="relative">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-base shadow-md">👥</div>
            <div>
              <h2 className="text-base font-bold text-slate-800 leading-tight">Team Snapshot</h2>
              <p className="text-[11px] text-slate-500 truncate max-w-[180px]">{teamSnapshot.department}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-indigo-50 to-purple-100 border border-indigo-200 p-3">
            <p className="text-[10px] uppercase tracking-widest font-bold text-indigo-700">Members</p>
            <p className="text-2xl font-black text-indigo-800 leading-tight mt-0.5">{teamSnapshot.team_total}</p>
          </div>
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-emerald-50 to-teal-100 border border-emerald-200 p-3">
            <p className="text-[10px] uppercase tracking-widest font-bold text-emerald-700">Active</p>
            <p className="text-2xl font-black text-emerald-800 leading-tight mt-0.5">{teamSnapshot.active_today}</p>
          </div>
        </div>

        {/* Active-today progress */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-semibold text-slate-500">Active today</span>
            <span className="text-[11px] font-bold text-slate-700">{activePct}%</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-500 transition-all duration-700"
              style={{ width: `${activePct}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

// Notifications preview inline component
function NotificationsCard({ notifications }) {
  const items = notifications?.recent || []
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center text-white text-base shadow-md">
            🔔
            {notifications?.unread_count > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1 ring-2 ring-white">
                {notifications.unread_count > 9 ? '9+' : notifications.unread_count}
              </span>
            )}
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800 leading-tight">Notifications</h2>
            <p className="text-[11px] text-slate-500">
              {notifications?.unread_count > 0
                ? <><span className="font-bold text-rose-600">{notifications.unread_count}</span> unread</>
                : 'All caught up'}
            </p>
          </div>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-6">
          <div className="text-3xl mb-1 opacity-60">📭</div>
          <p className="text-xs text-slate-400">No notifications yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.slice(0, 4).map(n => (
            <div
              key={n.id}
              className={`flex gap-2.5 p-2.5 rounded-xl border transition-colors cursor-pointer ${
                n.is_read
                  ? 'bg-slate-50 border-slate-100 hover:bg-slate-100'
                  : 'bg-blue-50/60 border-blue-100 hover:bg-blue-100/60'
              }`}
            >
              <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${n.is_read ? 'bg-slate-300' : 'bg-blue-500 animate-pulse'}`} />
              <div className="flex-1 min-w-0">
                <p className={`text-xs leading-snug truncate ${n.is_read ? 'text-slate-600 font-medium' : 'text-slate-800 font-bold'}`}>
                  {n.title}
                </p>
                <p className="text-[11px] text-slate-500 truncate mt-0.5">{n.message}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}


export default function PersonalDashboard() {
  const { user } = useSelector(s => s.auth)

  const [dashData, setDashData]       = useState(null)
  const [insights, setInsights]       = useState([])
  const [personaBundle, setPersonaBundle] = useState(null)
  const [loadingMain, setLoadingMain] = useState(true)
  const [loadingInsights, setLoadingInsights] = useState(true)
  const [loadingPersona, setLoadingPersona]   = useState(false)
  const [error, setError]             = useState(null)
  const pollRef                       = useRef(null)

  // Determine role + persona
  const roleCode   = dashData?.user_context?.role_code || 'default'
  const layout     = ROLE_LAYOUTS[roleCode] || ROLE_LAYOUTS.default
  const personaCode = dashData?.user_context?.persona || 'default'
  const persona    = useMemo(() => getPersona(personaCode), [personaCode])

  const loadDashboard = useCallback(async () => {
    try {
      const res = await fetchPersonalDashboard()
      if (res.status === 204) return
      setDashData(res.data)
      setError(null)
    } catch (err) {
      if (err?.response?.status !== 204) {
        setError('Failed to load dashboard data')
      }
    } finally {
      setLoadingMain(false)
    }
  }, [])

  const loadInsights = useCallback(async () => {
    try {
      const res = await fetchPersonalInsights()
      setInsights(res.data?.insights || [])
    } catch {
      setInsights([])
    } finally {
      setLoadingInsights(false)
    }
  }, [])

  // Initial load
  useEffect(() => {
    loadDashboard()
    loadInsights()
  }, [loadDashboard, loadInsights])

  // Load persona bundle whenever persona changes and has one.
  // Extracted so we can call it from both the effect and the polling interval.
  const loadPersonaBundle = useCallback(async (path, showSpinner = true) => {
    if (showSpinner) setLoadingPersona(true)
    try {
      const res = await fetchPersonaBundle(path)
      setPersonaBundle(res.data)
    } catch {
      // Keep previous bundle on transient failure; only clear on first load
      if (showSpinner) setPersonaBundle(null)
    } finally {
      if (showSpinner) setLoadingPersona(false)
    }
  }, [])

  useEffect(() => {
    if (!persona?.api_bundle) {
      setPersonaBundle(null)
      return
    }
    loadPersonaBundle(persona.api_bundle, true)
  }, [persona, loadPersonaBundle])

  // Polling — refresh main dashboard AND persona bundle so numbers stay live.
  useEffect(() => {
    pollRef.current = setInterval(() => {
      loadDashboard()
      if (persona?.api_bundle) {
        loadPersonaBundle(persona.api_bundle, false) // silent refresh
      }
    }, PERSONAL_DASHBOARD_CONFIG.pollIntervalMs)
    return () => clearInterval(pollRef.current)
  }, [loadDashboard, loadPersonaBundle, persona])

  if (error) {
    return (
      <div className="p-10 text-center bg-white rounded-2xl border border-red-200 shadow-sm max-w-md mx-auto mt-8">
        <div className="text-4xl mb-3">⚠️</div>
        <p className="text-slate-800 font-semibold mb-1">Something went wrong</p>
        <p className="text-sm text-slate-500 mb-4">{error}</p>
        <button
          onClick={loadDashboard}
          className="inline-flex items-center gap-1.5 text-sm bg-blue-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          🔄 Try again
        </button>
      </div>
    )
  }

  const d = dashData || {}
  const pb = personaBundle || {}

  // ─── Widget registry — resolves widget keys from persona config to JSX ───
  const WIDGET_REGISTRY = {
    quick_actions: () => (
      <QuickActionsBar actions={persona.quick_actions} personaLabel={persona.label} />
    ),
    welcome_hero: () => {
      // Persona overrides generic backend KPIs when it provides a builder
      // and the persona bundle is loaded. Falls back to backend kpis otherwise.
      const personaKpis = persona.kpi_builder && personaBundle
        ? persona.kpi_builder(personaBundle)
        : null
      const effectiveKpis = personaKpis?.length ? personaKpis : d.kpis
      return (
        <WelcomeHero
          userContext={d.user_context}
          kpis={effectiveKpis}
          roleLayout={layout}
          loading={loadingMain || (persona.kpi_builder && loadingPersona)}
          generatedAt={personaBundle?.generated_at}
        />
      )
    },
    ai_insights: () => (
      <AIInsightsStrip insights={insights} loading={loadingInsights} />
    ),
    my_modules: () => (
      <MyModulesGrid modules={d.my_modules} loading={loadingMain} />
    ),
    project_portfolio: () => (
      <ProjectPortfolio portfolio={pb.portfolio} projects={pb.projects} loading={loadingPersona} />
    ),
    evm_health: () => (
      <EVMHealthGauges portfolio={pb.portfolio} loading={loadingPersona} />
    ),
    milestones_timeline: () => (
      <MilestonesTimeline milestones={pb.upcoming_milestones} loading={loadingPersona} />
    ),
    my_tasks: () => (
      <MyTasksWidget tasks={pb.my_tasks} loading={loadingPersona} />
    ),
    recent_changes: () => (
      <RecentChangesWidget changes={pb.recent_changes} loading={loadingPersona} />
    ),
    activity_feed: () => (
      <ActivityFeed activities={d.activity_feed} loading={loadingMain} />
    ),
    notifications: () => (
      <NotificationsCard notifications={d.notifications} />
    ),
    pending_actions: () =>
      layout.showPendingActions ? (
        <PendingActionsWidget actions={d.pending_actions} loading={loadingMain} />
      ) : null,
    usage_stats: () =>
      layout.showUsageChart ? (
        <UsageStatsChart usageStats={d.usage_stats} loading={loadingMain} />
      ) : null,
    team_snapshot: () =>
      layout.showTeamSnapshot ? (
        <TeamSnapshotCard teamSnapshot={d.team_snapshot} />
      ) : null,
  }

  // Widget groupings — some widgets should sit side-by-side.
  // Keys here define how the linear widget list is composed into rows.
  const SIDE_BY_SIDE_PAIRS = {
    evm_health: 'milestones_timeline',
    my_tasks: 'recent_changes',
    activity_feed: 'notifications',
  }

  // Human labels for the customise UI (drag tooltips + hidden chips)
  const WIDGET_LABELS = {
    quick_actions:       'Quick Actions',
    welcome_hero:        'Welcome & KPIs',
    ai_insights:         'AI Insights',
    my_modules:          'My Workspace',
    project_portfolio:   'Project Portfolio',
    evm_health:          'EVM Health',
    milestones_timeline: 'Milestones',
    my_tasks:            'My Tasks',
    recent_changes:      'Recent Changes',
    activity_feed:       'Activity Feed',
    notifications:       'Notifications',
    pending_actions:     'Pending Actions',
    usage_stats:         'Usage Stats',
    team_snapshot:       'Team Snapshot',
  }

  // ─── User-customisable layout (drag / hide / reset) ────────────────────
  const [editing, setEditing] = useState(false)
  const layoutApi = usePersonalDashboardLayout({
    userId: user?.id,
    personaCode,
    defaultWidgets: persona.widgets || [],
  })

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return
    const oldIndex = layoutApi.order.indexOf(active.id)
    const newIndex = layoutApi.order.indexOf(over.id)
    if (oldIndex < 0 || newIndex < 0) return
    layoutApi.setOrder(arrayMove(layoutApi.order, oldIndex, newIndex))
  }

  const hiddenChipList = layoutApi.hidden.map(k => ({
    key: k,
    label: WIDGET_LABELS[k] || k,
  }))

  // Render a single widget key → { node, hideable } (skips nulls that widgets
  // return when their layout flag is off)
  const renderKey = (key) => {
    const node = WIDGET_REGISTRY[key]?.()
    if (!node) return null
    return node
  }

  const renderWidgetList = () => {
    // Edit mode: every widget rendered individually so drag targets stay predictable.
    if (editing) {
      return layoutApi.visibleOrder
        .map(key => {
          const node = renderKey(key)
          if (!node) return null
          return (
            <SortableWidget
              key={key}
              id={key}
              editing
              label={WIDGET_LABELS[key]}
              onHide={layoutApi.hideWidget}
            >
              {node}
            </SortableWidget>
          )
        })
        .filter(Boolean)
    }

    // View mode: apply side-by-side pair grouping to the user's chosen order.
    const list = layoutApi.visibleOrder
    const rendered = []
    const consumed = new Set()

    list.forEach((key, idx) => {
      if (consumed.has(idx)) return
      const paired = SIDE_BY_SIDE_PAIRS[key]
      const nextIdx = list.indexOf(paired, idx + 1)

      if (paired && nextIdx > idx) {
        consumed.add(nextIdx)
        const leftNode  = renderKey(key)
        const rightNode = renderKey(paired)
        if (leftNode || rightNode) {
          rendered.push(
            <div key={`${key}-pair`} className="ai-widget-shell grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>{leftNode}</div>
              <div>{rightNode}</div>
            </div>
          )
        }
      } else {
        const node = renderKey(key)
        if (node) rendered.push(
          <div key={key} className="ai-widget-shell">{node}</div>
        )
      }
    })
    return rendered
  }

  return (
    <div className="relative min-h-full px-4 sm:px-6 lg:px-8 py-4 sm:py-6 max-w-[1600px] mx-auto">
      <AIDashboardStyles />

      {/* AI aurora ambient background (fixed, non-interactive) */}
      <div className="ai-aurora" aria-hidden>
        <div className="ai-aurora__blob ai-aurora__blob--a" />
        <div className="ai-aurora__blob ai-aurora__blob--b" />
        <div className="ai-aurora__blob ai-aurora__blob--c" />
      </div>
      <div className="ai-grid-overlay" aria-hidden />

      <CustomizeToolbar
        editing={editing}
        onToggleEdit={() => setEditing(v => !v)}
        hiddenWidgets={hiddenChipList}
        onShow={layoutApi.showWidget}
        onReset={layoutApi.resetLayout}
        isCustomised={layoutApi.isCustomised}
      />

      <div className="space-y-6 pb-8 mt-4">
        {editing ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={layoutApi.visibleOrder}
              strategy={verticalListSortingStrategy}
            >
              {renderWidgetList()}
            </SortableContext>
          </DndContext>
        ) : (
          renderWidgetList()
        )}
      </div>
    </div>
  )
}
