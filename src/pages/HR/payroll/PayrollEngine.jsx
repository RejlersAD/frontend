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
  CANVAS_MODES, DEFAULT_CANVAS_MODE, getCanvasMode,
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

export default function PayrollEngine({ activeRunId, onSelectRun, onSwitchTab }) {
  const [tab, setTab] = useState(DEFAULT_ENGINE_TAB)
  const [selectedRunId, setSelectedRunId] = useState(activeRunId || null)
  const [canvasModeKey, setCanvasModeKey] = useState(readStoredCanvas)

  // Deep-link contract: parent supplies ?run=<id> → jump into detail view
  useEffect(() => {
    if (activeRunId) {
      setSelectedRunId(activeRunId)
      setTab('runs')
    }
  }, [activeRunId])

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

  const cycleCanvasMode = () => {
    const idx = CANVAS_MODES.findIndex((m) => m.key === canvasModeKey)
    const next = CANVAS_MODES[(idx + 1) % CANVAS_MODES.length]
    setCanvasModeKey(next.key)
  }

  const canvasMode = getCanvasMode(canvasModeKey)
  const CanvasIcon = HeroIcons[canvasMode.icon] || HeroIcons.ArrowsPointingOutIcon

  return (
    <div className={`${canvasMode.containerClass} mx-auto ${canvasMode.paddingClass} space-y-4 transition-[max-width] duration-200`}>
      {/* Sub-tab nav with canvas-mode cycler */}
      <div className="bg-white border border-slate-200 rounded-xl px-3 pt-2 flex items-end justify-between gap-2">
        <div className="flex gap-1 overflow-x-auto scrollbar-hide">
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
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-t-md border-b-2 whitespace-nowrap ${
                  isActive
                    ? 'border-indigo-600 text-indigo-700 bg-indigo-50/40'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Icon className="w-4 h-4" />
                {t.label}
              </button>
            )
          })}
        </div>
        <button
          type="button"
          onClick={cycleCanvasMode}
          title={`Canvas: ${canvasMode.label}. Click to cycle.\n${canvasMode.description}\n\n💡 Tip: Use 'Full Screen' or 'Ultra Wide' modes to see all columns at once!`}
          className={`mb-1 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border transition-all ${
            canvasMode.key === 'full' || canvasMode.key === 'ultra'
              ? 'border-indigo-300 bg-indigo-100 text-indigo-800 shadow-sm'
              : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700'
          } whitespace-nowrap`}
        >
          <CanvasIcon className="w-4 h-4" />
          <span className="font-semibold">{canvasMode.label}</span>
          {canvasMode.key === 'ultra' && (
            <span className="ml-1 px-1 py-0.5 text-[9px] font-bold uppercase bg-purple-500 text-white rounded">
              Max
            </span>
          )}
        </button>
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
      {tab === 'employees'   && <EmployeesTable />}
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
