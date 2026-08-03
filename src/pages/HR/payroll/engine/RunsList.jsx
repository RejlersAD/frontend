import React, { useEffect, useMemo, useState, useRef } from 'react'
import { useSelector } from 'react-redux'
import * as HeroIcons from '@heroicons/react/24/outline'
import payrollEngineService, { downloadBlob } from '../../../../services/payrollEngine.service'
import {
  formatCurrency,
  formatNumber,
  RUN_COLUMNS,
  RUN_DELETABLE_STATUSES,
  canForcePayrollRun,
} from '../../../../config/payrollEngine.config'
import StatusBadge from './StatusBadge'
import MonthYearPicker from './MonthYearPicker'

const today = new Date()

function formatDateTime(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('en-AE', {
      year: 'numeric', month: 'short', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    })
  } catch { return iso }
}

export default function RunsList({ onSelectRun }) {
  const authUser = useSelector((s) => s.auth?.user)
  const rbacUser = useSelector((s) => s.rbac?.currentUser)
  const canForce = useMemo(
    () => canForcePayrollRun(authUser, rbacUser),
    [authUser, rbacUser],
  )

  const [runs, setRuns] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [generating, setGenerating] = useState(false)
  const [period, setPeriod] = useState({
    year: today.getFullYear(),
    month: today.getMonth() + 1,
  })
  const [overwrite, setOverwrite] = useState(false)
  // Soft-coded default: mirrors catalog.DEFAULT_WORKING_DAYS_PER_MONTH (22 UAE standard)
  const DEFAULT_WORKING_DAYS = 22
  const [workingDays, setWorkingDays] = useState(DEFAULT_WORKING_DAYS)
  // Generation mode: 'system' = from live data, 'import' = from uploaded Excel
  const [genMode, setGenMode] = useState('system')
  const [importFile, setImportFile] = useState(null)
  const importFileRef = React.useRef(null)
  const [deletingId, setDeletingId] = useState(null)
  const [revertingId, setRevertingId] = useState(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await payrollEngineService.listRuns()
      setRuns(Array.isArray(data) ? data : (data?.results ?? []))
    } catch (e) {
      setError(e?.response?.data?.error || e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleGenerate = async () => {
    setGenerating(true)
    setError(null)
    try {
      let run
      if (genMode === 'import') {
        if (!importFile) { setError('Select an Excel file to import.'); setGenerating(false); return }
        const data = await payrollEngineService.importFullXlsx(importFile, period)
        run = data.run
        if (importFileRef.current) importFileRef.current.value = ''
        setImportFile(null)
      } else {
        run = await payrollEngineService.generateRun({ ...period, overwrite, working_days: workingDays })
      }
      await load()
      onSelectRun?.(run)
    } catch (e) {
      setError(e?.response?.data?.error || e.message)
    } finally {
      setGenerating(false)
    }
  }

  const handleDownload = async (run) => {
    try {
      const blob = await payrollEngineService.downloadRunMasterXlsx(run.id)
      downloadBlob(blob, `payroll_master_${run.cycle_code}.xlsx`)
    } catch (e) { setError(e?.response?.data?.error || e.message) }
  }

  const handleDelete = async (run, { force = false } = {}) => {
    const standardMsg = `Delete payroll run ${run.cycle_code}?\n\n` +
      `This permanently removes the run, all ${run.employee_count || 0} payslip(s) and ` +
      `their line items so you can rebuild from scratch. This cannot be undone.`
    const forceMsg =
      `⚠️  SUPER-ADMIN OVERRIDE\n\n` +
      `Run ${run.cycle_code} is currently "${run.status}" (approved/released).\n` +
      `Force-deleting will permanently destroy ${run.employee_count || 0} payslip(s) and ` +
      `all related line items, even though the run has already passed through approval.\n\n` +
      `A full audit row will be written to the workflow log.\n\n` +
      `Type OK in the next prompt to confirm.`
    if (!confirm(force ? forceMsg : standardMsg)) return
    if (force) {
      const typed = prompt('Type FORCE DELETE to confirm:', '')
      if ((typed || '').trim().toUpperCase() !== 'FORCE DELETE') return
    }
    setDeletingId(run.id); setError(null)
    try {
      await payrollEngineService.deleteRun(run.id, { force })
      setRuns((prev) => prev.filter((r) => r.id !== run.id))
    } catch (e) {
      setError(e?.response?.data?.error || e.message)
    } finally {
      setDeletingId(null)
    }
  }

  const handleForceRevert = async (run) => {
    const msg =
      `⚠️  SUPER-ADMIN OVERRIDE\n\n` +
      `Force-revert run ${run.cycle_code} (currently "${run.status}") back to Draft?\n\n` +
      `Approval/release timestamps will be cleared so the workflow restarts.\n` +
      `The change will be audit-logged. Continue?`
    if (!confirm(msg)) return
    setRevertingId(run.id); setError(null)
    try {
      const updated = await payrollEngineService.forceRevertRun(run.id)
      setRuns((prev) => prev.map((r) => (r.id === run.id ? updated : r)))
    } catch (e) {
      setError(e?.response?.data?.error || e.message)
    } finally {
      setRevertingId(null)
    }
  }

  return (
    <div className="space-y-4">
      {/* ── Generate Panel ── */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {/* Mode selector tabs */}
        <div className="flex border-b border-slate-200">
          {[
            { key: 'system', label: 'System Generate', icon: 'PlayCircleIcon',       desc: 'From live employee & timesheet data' },
            { key: 'import', label: 'Import from File', icon: 'DocumentArrowUpIcon', desc: 'From master payroll Excel upload' },
          ].map((m) => {
            const Icon = HeroIcons[m.icon]
            return (
              <button key={m.key} type="button"
                onClick={() => { setGenMode(m.key); setError(null) }}
                className={`flex-1 flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                  genMode === m.key
                    ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}>
                <Icon className="w-4 h-4" />
                <span>{m.label}</span>
                <span className="hidden sm:inline text-xs font-normal text-slate-400 ml-1">— {m.desc}</span>
              </button>
            )
          })}
        </div>

        {/* Controls */}
        <div className="p-4">
          <div className="flex items-end flex-wrap gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Month / Year</label>
              <MonthYearPicker year={period.year} month={period.month} onChange={setPeriod} />
            </div>

            {genMode === 'system' && (
              <>
                {/* Working Days */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Working Days <span className="text-slate-400 font-normal">(this month)</span>
                  </label>
                  <input type="number" min={1} max={31} value={workingDays}
                    onChange={(e) => { const v = parseInt(e.target.value, 10); if (v >= 1 && v <= 31) setWorkingDays(v) }}
                    className="w-24 border border-slate-200 rounded-lg px-3 py-2 text-sm text-center font-semibold focus:outline-none focus:ring-2 focus:ring-blue-300"
                    title="Total working days for this month"
                  />
                </div>
                {/* Overwrite */}
                <label className="inline-flex items-center gap-2 text-xs text-slate-600">
                  <input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} className="rounded" />
                  Overwrite if Draft exists
                </label>
              </>
            )}

            {genMode === 'import' && (
              <div className="flex-1 min-w-56">
                <label className="block text-xs font-medium text-slate-600 mb-1">Master Payroll Excel</label>
                <input ref={importFileRef} type="file" accept=".xlsx,.xls"
                  onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                  className="block w-full text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100" />
                {importFile && (
                  <p className="text-xs text-slate-400 mt-0.5">{importFile.name} ({Math.round(importFile.size / 1024)} KB)</p>
                )}
              </div>
            )}

            <button type="button" onClick={handleGenerate} disabled={generating}
              className={`ml-auto inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md disabled:opacity-50 ${
                genMode === 'import'
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}>
              {generating
                ? <HeroIcons.ArrowPathIcon className="w-4 h-4 animate-spin" />
                : genMode === 'import' ? <HeroIcons.DocumentArrowUpIcon className="w-4 h-4" /> : <HeroIcons.PlayCircleIcon className="w-4 h-4" />
              }
              {generating ? (genMode === 'import' ? 'Importing…' : 'Generating…') : (genMode === 'import' ? 'Import & Generate' : 'Generate Run')}
            </button>
          </div>

          {error && (
            <div className="mt-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</div>
          )}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">Monthly Runs</h3>
          <div className="flex items-center gap-3">
            {canForce && (
              <span
                className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide px-2 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200"
                title="You can force-edit, force-revert or force-delete approved or released runs. All actions are audit-logged."
              >
                <HeroIcons.ShieldCheckIcon className="w-3.5 h-3.5" />
                Super-Admin overrides enabled
              </span>
            )}
            <button
              type="button"
              onClick={load}
              className="text-xs text-slate-500 hover:text-slate-800 inline-flex items-center gap-1"
            >
              <HeroIcons.ArrowPathIcon className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>
        </div>
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-400">Loading…</div>
        ) : runs.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">
            No payroll runs yet. Generate one above.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
              <tr>
                {RUN_COLUMNS.map((c) => (
                  <th
                    key={c.key}
                    style={{ width: c.width }}
                    className={`px-3 py-2 font-medium ${c.align === 'right' ? 'text-right' : 'text-left'}`}
                  >
                    {c.label}
                  </th>
                ))}
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {runs.map((r) => (
                <tr
                  key={r.id}
                  className="hover:bg-slate-50 cursor-pointer"
                  onClick={() => onSelectRun?.(r)}
                >
                  <td className="px-3 py-2 font-mono">{r.cycle_code}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <StatusBadge status={r.status} />
                      {r.source_type === 'import' && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200" title="Generated from imported Excel file">
                          ↗ Import
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right">{r.employee_count}</td>
                  <td className="px-3 py-2 text-right font-semibold text-indigo-700">
                    {r.working_days_in_month ?? 22}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatNumber(r.total_hours, { decimals: 2 })}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium text-slate-700">{formatNumber(r.total_days, { decimals: 2 })}</td>
                  <td className="px-3 py-2 text-right">{formatCurrency(r.total_gross, { withSymbol: false })}</td>
                  <td className="px-3 py-2 text-right">{formatCurrency(r.total_deductions, { withSymbol: false })}</td>
                  <td className="px-3 py-2 text-right font-medium">{formatCurrency(r.total_net)}</td>
                  <td className="px-3 py-2 text-xs text-slate-500">{formatDateTime(r.generated_at)}</td>
                  <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="inline-flex items-center gap-3 justify-end">
                      <button
                        type="button"
                        onClick={() => handleDownload(r)}
                        className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1"
                      >
                        <HeroIcons.ArrowDownTrayIcon className="w-3.5 h-3.5" /> XLSX
                      </button>
                      {RUN_DELETABLE_STATUSES.includes(r.status) ? (
                        <button
                          type="button"
                          onClick={() => handleDelete(r)}
                          disabled={deletingId === r.id}
                          title="Delete this Draft run so you can rebuild it"
                          className="text-xs text-red-600 hover:underline inline-flex items-center gap-1 disabled:opacity-50"
                        >
                          {deletingId === r.id
                            ? <HeroIcons.ArrowPathIcon className="w-3.5 h-3.5 animate-spin" />
                            : <HeroIcons.TrashIcon className="w-3.5 h-3.5" />}
                          {deletingId === r.id ? 'Deleting…' : 'Delete'}
                        </button>
                      ) : canForce ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleForceRevert(r)}
                            disabled={revertingId === r.id}
                            title="Super-Admin override: revert this run back to Draft"
                            className="text-xs text-amber-700 hover:underline inline-flex items-center gap-1 disabled:opacity-50"
                          >
                            {revertingId === r.id
                              ? <HeroIcons.ArrowPathIcon className="w-3.5 h-3.5 animate-spin" />
                              : <HeroIcons.ArrowUturnLeftIcon className="w-3.5 h-3.5" />}
                            {revertingId === r.id ? 'Reverting…' : 'Force Revert'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(r, { force: true })}
                            disabled={deletingId === r.id}
                            title="Super-Admin override: force-delete an approved/released run"
                            className="text-xs text-red-700 hover:underline inline-flex items-center gap-1 disabled:opacity-50"
                          >
                            {deletingId === r.id
                              ? <HeroIcons.ArrowPathIcon className="w-3.5 h-3.5 animate-spin" />
                              : <HeroIcons.ShieldExclamationIcon className="w-3.5 h-3.5" />}
                            {deletingId === r.id ? 'Deleting…' : 'Force Delete'}
                          </button>
                        </>
                      ) : (
                        <span
                          title="Only Draft runs can be deleted — revert to Draft first"
                          className="text-xs text-slate-300 inline-flex items-center gap-1 cursor-not-allowed"
                        >
                          <HeroIcons.TrashIcon className="w-3.5 h-3.5" /> Delete
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
