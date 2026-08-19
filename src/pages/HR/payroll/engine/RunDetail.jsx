import React, { useEffect, useState, useMemo, useRef } from 'react'
import { useSelector } from 'react-redux'
import * as HeroIcons from '@heroicons/react/24/outline'
import payrollEngineService, { downloadBlob } from '../../../../services/payrollEngine.service'
import {
  formatCurrency, formatNumber, getPayslipColumns, WORKFLOW_STATUS, STATUS_LABEL,
  canForcePayrollRun, getCanvasMode, TABLE_SIZE_CLASSES,
} from '../../../../config/payrollEngine.config'
import StatusBadge from './StatusBadge'
import PayslipDetailModal from './PayslipDetailModal'
import BulkDeductionModal from './BulkDeductionModal'
import ComparisonPanel from './ComparisonPanel'
import ExternalUploadPanel from './ExternalUploadPanel'
import './payrollTable.css'

function formatDateTime(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('en-AE', {
      year: 'numeric', month: 'short', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    })
  } catch { return iso }
}

function formatDate(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('en-AE', {
      year: 'numeric', month: 'short', day: '2-digit',
    })
  } catch { return iso }
}

const TRANSITION_BUTTONS = [
  { status: WORKFLOW_STATUS.HR_APPROVED,      label: 'HR Approve',      fn: 'hrApproveRun',      tone: 'blue' },
  { status: WORKFLOW_STATUS.FINANCE_APPROVED, label: 'Finance Approve', fn: 'financeApproveRun', tone: 'amber' },
  { status: WORKFLOW_STATUS.RELEASED,         label: 'Release',         fn: 'releaseRun',        tone: 'green' },
]

const TONE_CLASS = {
  blue:  'bg-blue-600 hover:bg-blue-700 text-white',
  amber: 'bg-amber-600 hover:bg-amber-700 text-white',
  green: 'bg-emerald-600 hover:bg-emerald-700 text-white',
  gray:  'bg-slate-100 hover:bg-slate-200 text-slate-700',
}

export default function RunDetail({ runId, onBack, canvasModeKey }) {
  const payslipColumns = useMemo(() => getPayslipColumns(canvasModeKey), [canvasModeKey])
  const canvasMode = useMemo(() => getCanvasMode(canvasModeKey), [canvasModeKey])
  const tableSizeClasses = useMemo(() => TABLE_SIZE_CLASSES[canvasMode.tableSize] || TABLE_SIZE_CLASSES.normal, [canvasMode])
  const tableContainerRef = useRef(null)
  const [isScrolledToEnd, setIsScrolledToEnd] = useState(false)
  const authUser = useSelector((s) => s.auth?.user)
  const rbacUser = useSelector((s) => s.rbac?.currentUser)
  const canForce = useMemo(
    () => canForcePayrollRun(authUser, rbacUser),
    [authUser, rbacUser],
  )
  const [run, setRun] = useState(null)
  const [payslips, setPayslips] = useState([])
  const [workflowLog, setWorkflowLog] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [selectedSlip, setSelectedSlip] = useState(null)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [showUploadPanel, setShowUploadPanel] = useState(false)
  const [deletingSlipId, setDeletingSlipId] = useState(null)

  const load = async () => {
    if (!runId) return
    setLoading(true)
    setError(null)
    try {
      const [r, slips, log] = await Promise.all([
        payrollEngineService.getRun(runId),
        payrollEngineService.listPayslips({ run: runId }),
        payrollEngineService.getRunWorkflowLog(runId),
      ])
      setRun(r)
      setPayslips(Array.isArray(slips) ? slips : (slips?.results ?? []))
      setWorkflowLog(Array.isArray(log) ? log : (log?.results ?? []))
    } catch (e) {
      setError(e?.response?.data?.error || e.message)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() /* eslint-disable-next-line */ }, [runId])

  const filtered = useMemo(() => {
    if (!search.trim()) return payslips
    const q = search.toLowerCase()
    return payslips.filter((p) =>
      (p.snapshot_full_name || '').toLowerCase().includes(q) ||
      (p.employee_no || '').toLowerCase().includes(q) ||
      (p.snapshot_department || '').toLowerCase().includes(q)
    )
  }, [payslips, search])

  // Track horizontal scroll to show/hide fade overlay
  useEffect(() => {
    const container = tableContainerRef.current
    if (!container) return

    const handleScroll = () => {
      const { scrollLeft, scrollWidth, clientWidth } = container
      const scrolledToEnd = scrollLeft + clientWidth >= scrollWidth - 10
      setIsScrolledToEnd(scrolledToEnd)
    }

    container.addEventListener('scroll', handleScroll)
    handleScroll() // Initial check

    return () => container.removeEventListener('scroll', handleScroll)
  }, [payslips, canvasMode])

  const handleTransition = async (apiFn) => {
    setBusy(true); setError(null)
    try {
      const note = prompt('Optional note for this transition:') || ''
      await payrollEngineService[apiFn](run.id, note)
      await load()
    } catch (e) {
      setError(e?.response?.data?.error || e.message)
    } finally { setBusy(false) }
  }

  const handleRevert = async () => {
    if (!confirm('Revert this run back to Draft?')) return
    setBusy(true); setError(null)
    try {
      await payrollEngineService.revertRun(run.id, 'Reverted by user')
      await load()
    } catch (e) { setError(e?.response?.data?.error || e.message) }
    finally { setBusy(false) }
  }

  const handleDownloadMaster = async () => {
    try {
      const blob = await payrollEngineService.downloadRunMasterXlsx(run.id)
      downloadBlob(blob, `payroll_master_${run.cycle_code}.xlsx`)
    } catch (e) { setError(e?.response?.data?.error || e.message) }
  }

  const handleRefreshHours = async () => {
    const isDraft = run.status === WORKFLOW_STATUS.DRAFT
    const force = !isDraft
    const msg = isDraft
      ? `Pull live "Total" hours from the Time Sheet Summary for ${run.cycle_code}?\n\n`
        + 'Each payslip’s Hours column will be replaced with the biometric '
        + 'total (with HR overrides overlaid).'
      : `⚠️ FORCE-REFRESH HOURS on a ${run.status.toUpperCase()} run?\n\n`
        + `Run ${run.cycle_code} is already approved. Super-Admin override required.\n\n`
        + 'This rewrites each payslip’s Hours column with the live biometric total. '
        + 'Totals, gross and net are not recomputed (Hours is informational only).\n\n'
        + 'Proceed?'
    if (!confirm(msg)) return
    setBusy(true); setError(null)
    try {
      const result = await payrollEngineService.refreshRunHoursFromTimesheet(run.id, { force })
      await load()
      const missing = (result?.missing || []).length
      alert(
        `Hours refreshed from Time Sheet${result?.forced ? ' (FORCED)' : ''}.\n\n`
        + `Updated: ${result?.updated ?? 0}\n`
        + `Unchanged: ${result?.unchanged ?? 0}\n`
        + (missing ? `Missing biometric data: ${missing} employee(s)` : 'All employees matched.')
      )
    } catch (e) {
      setError(e?.response?.data?.error || e.message)
    } finally { setBusy(false) }
  }

  const handleDownloadPack = async () => {
    try {
      const blob = await payrollEngineService.downloadRunPayslipPack(run.id)
      downloadBlob(blob, `payroll_payslips_${run.cycle_code}.xlsx`)
    } catch (e) { setError(e?.response?.data?.error || e.message) }
  }

  const handleDeleteSlip = async (slip) => {
    const label = slip.snapshot_full_name || `payslip #${slip.id}`
    const msg = `Delete payslip for ${label}?\n\nUse this when an employee is terminated or no longer on payroll. This cannot be undone.`
    if (!confirm(msg)) return
    setDeletingSlipId(slip.id); setError(null)
    try {
      await payrollEngineService.deletePayslip(slip.id)
      // Optimistic removal so the row disappears immediately, then full reload
      setPayslips((prev) => prev.filter((s) => s.id !== slip.id))
      await load()
    } catch (e) {
      setError(e?.response?.data?.error || e.message)
    } finally {
      setDeletingSlipId(null)
    }
  }

  if (loading) return <div className="p-8 text-center text-sm text-slate-400">Loading run…</div>
  if (!run) return (
    <div className="p-8 text-center text-sm text-slate-400">
      Run not found.
      <button onClick={onBack} className="ml-2 text-blue-600 hover:underline">Back to list</button>
    </div>
  )

  const nextStatuses = {
    [WORKFLOW_STATUS.DRAFT]: [WORKFLOW_STATUS.HR_APPROVED],
    [WORKFLOW_STATUS.HR_APPROVED]: [WORKFLOW_STATUS.FINANCE_APPROVED],
    [WORKFLOW_STATUS.FINANCE_APPROVED]: [WORKFLOW_STATUS.RELEASED],
    [WORKFLOW_STATUS.RELEASED]: [],
  }
  const availableTransitions = TRANSITION_BUTTONS.filter(
    (b) => nextStatuses[run.status]?.includes(b.status)
  )

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <button
              onClick={onBack}
              className="text-xs text-slate-500 hover:text-slate-800 inline-flex items-center gap-1 mb-2"
            >
              <HeroIcons.ChevronLeftIcon className="w-3.5 h-3.5" /> All runs
            </button>
            <h2 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
              Payroll Run {run.cycle_code} <StatusBadge status={run.status} />
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              {run.employee_count} payslips · generated {formatDateTime(run.generated_at)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {run.status === WORKFLOW_STATUS.DRAFT && (
              <button
                onClick={() => setBulkOpen(true)}
                disabled={busy}
                title="Apply a percentage-based salary deduction across all employees in this run"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-violet-600 hover:bg-violet-700 text-white disabled:opacity-50"
              >
                <HeroIcons.ReceiptPercentIcon className="w-4 h-4" />
                Deduction
              </button>
            )}
            {/* Quick upload buttons in header — trigger the ExternalUploadPanel below */}
            {run.status === WORKFLOW_STATUS.DRAFT && (
              <button
                onClick={() => setShowUploadPanel(true)}
                title="Import ValueFrame or Sympa XLSX to update hours & salary data"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100"
              >
                <HeroIcons.ArrowUpTrayIcon className="w-4 h-4" />
                Import Files
              </button>
            )}
            {availableTransitions.map((b) => (
              <button
                key={b.status}
                disabled={busy}
                onClick={() => handleTransition(b.fn)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md ${TONE_CLASS[b.tone]} disabled:opacity-50`}
              >
                <HeroIcons.CheckCircleIcon className="w-4 h-4" />
                {b.label}
              </button>
            ))}
            {run.status !== WORKFLOW_STATUS.DRAFT && run.status !== WORKFLOW_STATUS.RELEASED && (
              <button
                onClick={handleRevert}
                disabled={busy}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md ${TONE_CLASS.gray} disabled:opacity-50`}
              >
                <HeroIcons.ArrowUturnLeftIcon className="w-4 h-4" />
                Revert to Draft
              </button>
            )}
            {run.status === WORKFLOW_STATUS.DRAFT && (
              <button
                onClick={handleRefreshHours}
                disabled={busy}
                title="Pull each payslip’s Hours column from the live Time Sheet Summary (biometric Total + HR overrides)"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-sky-300 bg-sky-50 text-sky-700 hover:bg-sky-100 disabled:opacity-50"
              >
                <HeroIcons.ClockIcon className="w-4 h-4" />
                Refresh Hours
              </button>
            )}
            {run.status !== WORKFLOW_STATUS.DRAFT && canForce && (
              <button
                onClick={handleRefreshHours}
                disabled={busy}
                title="Super-Admin override — force-refresh Hours from the live Time Sheet on an approved run"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 disabled:opacity-50"
              >
                <HeroIcons.ShieldExclamationIcon className="w-4 h-4" />
                Force Refresh Hours
              </button>
            )}
            <button
              onClick={handleDownloadMaster}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-slate-300 hover:bg-slate-50"
            >
              <HeroIcons.ArrowDownTrayIcon className="w-4 h-4" />
              Master XLSX
            </button>
            <button
              onClick={handleDownloadPack}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-slate-300 hover:bg-slate-50"
            >
              <HeroIcons.DocumentDuplicateIcon className="w-4 h-4" />
              Payslip Pack
            </button>
          </div>
        </div>

        {/* KPI tiles */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          <KpiTile label="Total Gross" value={formatCurrency(run.total_gross)} tone="blue" />
          <KpiTile label="Total Deductions" value={formatCurrency(run.total_deductions)} tone="amber" />
          <KpiTile label="Net Payable" value={formatCurrency(run.total_net)} tone="emerald" />
          <KpiTile label="Employees" value={run.employee_count} tone="slate" />
        </div>

        {error && (
          <div className="mt-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
            {error}
          </div>
        )}
      </div>

      {/* Workflow log */}
      {workflowLog.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <h3 className="text-xs font-semibold text-slate-600 uppercase mb-2">Workflow Log</h3>
          <div className="space-y-1.5">
            {workflowLog.map((log) => (
              <div key={log.id} className="flex items-center gap-2 text-xs text-slate-600">
                <span className="text-slate-400 w-36">{formatDateTime(log.at)}</span>
                <StatusBadge status={log.from_status || WORKFLOW_STATUS.DRAFT} />
                <HeroIcons.ArrowRightIcon className="w-3 h-3 text-slate-400" />
                <StatusBadge status={log.to_status} />
                <span className="text-slate-500">by {log.actor_name || 'system'}</span>
                {log.note && <span className="italic text-slate-400">— {log.note}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* External File Import — collapsible, shown right after KPI tiles */}
      {showUploadPanel && (
        <ExternalUploadPanel
          runId={run.id}
          runEditable={run.status === WORKFLOW_STATUS.DRAFT}
          onUploaded={() => { load(); }}
          onClose={() => setShowUploadPanel(false)}
        />
      )}

      {/* Payslip table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className={`px-4 py-3 border-b border-slate-200 flex items-center justify-between flex-wrap gap-2 ${canvasMode.tableSize === 'ultra-compact' ? 'py-2' : ''}`}>
          <h3 className={`font-semibold text-slate-700 ${
            canvasMode.tableSize === 'ultra-compact' ? 'text-xs' : 'text-sm'
          }`}>
            Payslips ({filtered.length})
          </h3>
          <div className="flex items-center gap-2">
            <div className="relative">
              <HeroIcons.MagnifyingGlassIcon className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search name / emp # / dept"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={`pl-7 pr-2 py-1.5 border border-slate-300 rounded-md ${
                  canvasMode.tableSize === 'ultra-compact' ? 'text-[10px] w-48' : 'text-xs w-64'
                }`}
              />
            </div>
          </div>
        </div>
        {/* Enhanced table container with smooth horizontal scroll and sticky columns */}
        <div
          ref={tableContainerRef}
          className={`payroll-table-container overflow-x-auto overflow-y-visible relative ${
            canvasMode.tableSize === 'ultra-compact' ? 'ultra-compact-table' : ''
          } ${isScrolledToEnd ? 'scrolled-to-end' : ''}`}
          style={{ maxHeight: 'calc(100vh - 320px)' }}
        >
          <div className="inline-block min-w-full align-middle">
            <div className="overflow-hidden">
              <table className={`${tableSizeClasses.minWidth} ${tableSizeClasses.text} border-collapse`}>
                <thead className="bg-slate-50 text-slate-500 uppercase sticky top-0 z-20 shadow-sm">
                  <tr>
                    {payslipColumns.map((c, idx) => (
                      <th
                        key={c.key}
                        style={{
                          width: c.width,
                          minWidth: c.width,
                          ...(idx === 0 ? { left: 0 } : {}),
                          ...(idx === 1 ? { left: payslipColumns[0]?.width || 90 } : {}),
                        }}
                        className={`${
                          tableSizeClasses.headerPadding
                        } font-medium border-b border-slate-200 ${
                          c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left'
                        } ${
                          // Make first two columns sticky for better navigation
                          idx === 0 || idx === 1
                            ? 'sticky bg-slate-50 z-10 shadow-[2px_0_4px_rgba(0,0,0,0.05)] payroll-sticky-col'
                            : ''
                        }`}
                        title={c.helpText || c.label}
                      >
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filtered.map((p) => (
                    <tr
                      key={p.id}
                      className="hover:bg-slate-50 cursor-pointer transition-colors"
                      onClick={() => setSelectedSlip(p)}
                    >
                      {payslipColumns.map((c, idx) => {
                        if (c.action === 'edit') {
                          const editable = run.status === WORKFLOW_STATUS.DRAFT
                          return (
                            <td
                              key={c.key}
                              className={`${tableSizeClasses.cellPadding} text-center border-b border-slate-100`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                onClick={() => setSelectedSlip(p)}
                                title={editable
                                  ? 'Edit salary, earnings & deductions'
                                  : `View payslip (read-only — run is ${run.status})`}
                                className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md border transition-colors ${
                                  editable
                                    ? 'border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                                }`}
                              >
                                {editable
                                  ? <HeroIcons.PencilSquareIcon className="w-3.5 h-3.5" />
                                  : <HeroIcons.EyeIcon className="w-3.5 h-3.5" />
                                }
                                {editable ? 'Edit' : 'View'}
                              </button>
                            </td>
                          )
                        }
                        if (c.action === 'delete') {
                          const editable = run.status === WORKFLOW_STATUS.DRAFT
                          const isDeleting = deletingSlipId === p.id
                          return (
                            <td
                              key={c.key}
                              className={`${tableSizeClasses.cellPadding} text-center border-b border-slate-100`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                disabled={!editable || isDeleting}
                                onClick={() => handleDeleteSlip(p)}
                                title={editable
                                  ? `Delete payslip (e.g. terminated employee)`
                                  : `Deletion disabled — run is ${run.status}`}
                                className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md border transition-colors ${
                                  editable
                                    ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
                                    : 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'
                                } disabled:opacity-60`}
                              >
                                {isDeleting
                                  ? <HeroIcons.ArrowPathIcon className="w-3.5 h-3.5 animate-spin" />
                                  : <HeroIcons.TrashIcon className="w-3.5 h-3.5" />
                                }
                                Delete
                              </button>
                            </td>
                          )
                        }
                        const v = p[c.key]
                        let display
                        if (c.format === 'currency')      display = formatCurrency(v, { withSymbol: false })
                        else if (c.format === 'number')   display = formatNumber(v)
                        else if (c.format === 'date')     display = formatDate(v)
                        else if (c.format === 'datetime') display = formatDateTime(v)
                        else                              display = (v ?? '—')
                        
                        return (
                          <td
                            key={c.key}
                            title={c.key === 'snapshot_iban' && v ? v : c.helpText || undefined}
                            className={`${
                              tableSizeClasses.cellPadding
                            } border-b border-slate-100 ${
                              c.align === 'right' ? 'text-right tabular-nums' : c.align === 'center' ? 'text-center' : ''
                            } ${
                              c.key === 'snapshot_iban' ? 'font-mono text-slate-500' : ''
                            } ${
                              // Highlight new columns with subtle background
                              c.key === 'total_worked_days' || c.key === 'employee_category'
                                ? 'bg-indigo-50/30 new-column-highlight'
                                : ''
                            } ${
                              // Make first two columns sticky
                              idx === 0 || idx === 1
                                ? 'sticky bg-white z-10 shadow-[2px_0_4px_rgba(0,0,0,0.05)] payroll-sticky-col'
                                : ''
                            }`}
                            style={{
                              ...(idx === 0 ? { left: 0, minWidth: c.width, width: c.width } : {}),
                              ...(idx === 1 ? { left: payslipColumns[0]?.width || 90, minWidth: c.width, width: c.width } : {}),
                            }}
                          >
                            {display}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {selectedSlip && (
        <PayslipDetailModal
          slip={selectedSlip}
          runEditable={run.status === WORKFLOW_STATUS.DRAFT}
          onClose={() => setSelectedSlip(null)}
          onChanged={async () => { await load() }}
        />
      )}

      {bulkOpen && (
        <BulkDeductionModal
          run={run}
          payslips={payslips}
          onClose={() => setBulkOpen(false)}
          onApplied={async () => { await load() }}
        />
      )}

      {/* External-file Comparison */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <HeroIcons.ArrowsRightLeftIcon className="w-4 h-4 text-indigo-600" />
          <h3 className="text-sm font-semibold text-slate-700">
            Comparison vs external HR file
          </h3>
          <span className="text-[10px] uppercase font-medium text-slate-400 ml-2">
            ValueFrame · Sympa · Generic
          </span>
        </div>
        <ComparisonPanel runId={run.id} />
      </div>
    </div>
  )
}

function KpiTile({ label, value, tone = 'slate' }) {
  const tones = {
    blue: 'bg-blue-50 border-blue-200 text-blue-800',
    amber: 'bg-amber-50 border-amber-200 text-amber-800',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    slate: 'bg-slate-50 border-slate-200 text-slate-800',
  }
  return (
    <div className={`border rounded-lg p-3 ${tones[tone] || tones.slate}`}>
      <div className="text-[10px] uppercase font-medium opacity-70">{label}</div>
      <div className="text-lg font-semibold tabular-nums mt-1">{value}</div>
    </div>
  )
}
