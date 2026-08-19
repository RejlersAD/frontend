/**
 * ComparisonsHub — top-level "Comparison" tab in the Payroll Engine.
 *
 * Lets HR pick any payroll run (regardless of status) and upload an
 * external HR file (ValueFrame, Sympa, generic XLSX) for diffing.
 * Defaults to the most recent run.
 */
import React, { useEffect, useState } from 'react'
import * as HeroIcons from '@heroicons/react/24/outline'

import payrollEngineService from '../../../../services/payrollEngine.service'
import { STATUS_META } from '../../../../config/payrollEngine.config'
import ComparisonPanel from './ComparisonPanel'

export default function ComparisonsHub() {
  const [runs, setRuns] = useState([])
  const [defaultRunId, setDefaultRunId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    payrollEngineService.listRuns()
      .then((data) => {
        const list = Array.isArray(data) ? data : (data?.results ?? [])
        // Order newest-first by cycle_code descending so "2026-06" beats "2026-05"
        const sorted = [...list].sort((a, b) => (b.cycle_code || '').localeCompare(a.cycle_code || ''))
        const decorated = sorted.map((r) => ({
          ...r,
          status_label: STATUS_META[r.status]?.label || r.status,
        }))
        setRuns(decorated)
        if (decorated.length) setDefaultRunId(decorated[0].id)
      })
      .catch((e) => setError(e?.response?.data?.error || e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-6 text-center text-sm text-slate-500">
        Loading runs…
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white border border-rose-200 rounded-xl p-4 text-sm text-rose-700">
        {error}
      </div>
    )
  }

  if (!runs.length) {
    return (
      <div className="bg-white border border-dashed border-slate-300 rounded-xl p-8 text-center">
        <HeroIcons.CalendarDaysIcon className="w-8 h-8 text-slate-400 mx-auto mb-2" />
        <div className="text-sm text-slate-600">
          No payroll runs yet. Generate a run first from the “Monthly Runs” tab.
        </div>
      </div>
    )
  }

  return (
    <ComparisonPanel
      showRunPicker
      runOptions={runs}
      defaultRunId={defaultRunId}
    />
  )
}
