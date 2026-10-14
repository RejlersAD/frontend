/**
 * Payroll Engine — Monthly automation shell.
 *
 * Props (passed by parent Payroll.jsx):
 *   activeRunId   — UUID/PK of a run to deep-link into (from ?run= query)
 *   onSelectRun   — bubbles run selection back to parent (kept for URL sync)
 *   onSwitchTab   — bubbles top-level tab changes back to parent (unused here)
 *
 * Internal sub-tabs live in payroll/engine/. Selecting a run from the
 * 'runs' tab shows RunDetail in place; clicking "All runs" returns.
 */
import React, { useState, useEffect } from 'react'
import * as HeroIcons from '@heroicons/react/24/outline'

import {
  ENGINE_TABS, DEFAULT_ENGINE_TAB,
  CANVAS_MODES, DEFAULT_CANVAS_MODE,
  PAYROLL_ENGINE_CANVAS_STORAGE_KEY,
} from '../../../config/payrollEngine.config'

import RunsList         from './engine/RunsList'
import RunDetail        from './engine/RunDetail'
import EmployeesTable   from './engine/EmployeesTable'
import AdjustmentsList  from './engine/AdjustmentsList'
import ComparisonsHub   from './engine/ComparisonsHub'
import ExcelHub         from './engine/ExcelHub'

const TAB_ICONS = {
  runs:        'CalendarDaysIcon',
  employees:   'UsersIcon',
  adjustments: 'AdjustmentsHorizontalIcon',
  comparison:  'ArrowsRightLeftIcon',
  excel:       'TableCellsIcon',
}

const readStoredCanvas = () => {
  try {
    const stored = localStorage.getItem(PAYROLL_ENGINE_CANVAS_STORAGE_KEY)
    if (stored && CANVAS_MODES.some((m) => m.key === stored)) return stored
  } catch (_) { /* localStorage unavailable */ }
  return DEFAULT_CANVAS_MODE
}

export default function PayrollEngine({ activeRunId, initialTab, onSelectRun, onSwitchTab }) {
  const [tab, setTab] = useState(initialTab || DEFAULT_ENGINE_TAB)
  const [selectedRunId, setSelectedRunId] = useState(activeRunId || null)
  const [canvasModeKey] = useState(readStoredCanvas)
  const [employeeActionsTarget, setEmployeeActionsTarget] = useState(null)

  // Deep-link contract: parent supplies ?run=<id> → jump into detail view
  useEffect(() => {
    if (activeRunId) {
      setSelectedRunId(activeRunId)
      setTab('runs')
    }
  }, [activeRunId])

  useEffect(() => {
    if (initialTab && ENGINE_TABS.some((item) => item.key === initialTab)) {
      setTab(initialTab)
      setSelectedRunId(null)
    }
  }, [initialTab])

  // Persist canvas mode across reloads
  useEffect(() => {
    try { localStorage.setItem(PAYROLL_ENGINE_CANVAS_STORAGE_KEY, canvasModeKey) }
    catch (_) { /* ignore */ }
  }, [canvasModeKey])

  const handleSelectRun = (run) => {
    const id = typeof run === 'string' ? run : run?.id
    setSelectedRunId(id)
    onSelectRun?.(run)
  }

  const handleBackToList = () => {
    setSelectedRunId(null)
    onSelectRun?.(null)
  }

  return (
    <div className="w-full min-w-0 space-y-4">
      {/* Sub-tab navigation and actions */}
      <div className="bg-white border border-slate-200 rounded-xl p-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1">
          {ENGINE_TABS.map((t) => {
            const Icon = HeroIcons[TAB_ICONS[t.key]] || HeroIcons.RectangleStackIcon
            const isActive = tab === t.key
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => {
                  setTab(t.key)
                  if (t.key !== 'runs') setSelectedRunId(null)
                }}
                title={t.description}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-lg border whitespace-nowrap ${
                  isActive
                    ? 'border-indigo-200 text-indigo-700 bg-indigo-50'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Icon className="w-4 h-4" />
                {t.label}
              </button>
            )
          })}
        </div>
        <div ref={setEmployeeActionsTarget} />
      </div>

      {/* Sub-tab content */}
      {tab === 'runs' && (
        selectedRunId
          ? <RunDetail
              runId={selectedRunId}
              onBack={handleBackToList}
              canvasModeKey={canvasModeKey}
            />
          : <RunsList onSelectRun={handleSelectRun} />
      )}
      {tab === 'employees'   && <EmployeesTable actionsTarget={employeeActionsTarget} />}
      {tab === 'adjustments' && <AdjustmentsList />}
      {tab === 'comparison'  && <ComparisonsHub />}
      {tab === 'excel'       && (
        <ExcelHub
          onAfterImport={(run) => {
            setTab('runs')
            handleSelectRun(run)
          }}
        />
      )}
    </div>
  )
}
