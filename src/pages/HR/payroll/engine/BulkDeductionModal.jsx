import React, { useMemo, useState } from 'react'
import * as HeroIcons from '@heroicons/react/24/outline'
import payrollEngineService from '../../../../services/payrollEngine.service'
import {
  formatCurrency,
  BULK_DEDUCTION_FIELDS,
  BULK_DEDUCTION_DEFAULT_PCT,
  BULK_DEDUCTION_MIN_PCT,
  BULK_DEDUCTION_MAX_PCT,
  BULK_DEDUCTION_COMPONENT_CODE,
} from '../../../../config/payrollEngine.config'

const toNumber = (v) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export default function BulkDeductionModal({ run, payslips = [], onClose, onApplied }) {
  const [percentage, setPercentage] = useState(String(BULK_DEDUCTION_DEFAULT_PCT))
  const [fields, setFields] = useState(
    () => Object.fromEntries(BULK_DEDUCTION_FIELDS.map((f) => [f.key, f.defaultChecked]))
  )
  const [label, setLabel] = useState('')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  const selectedKeys = useMemo(
    () => BULK_DEDUCTION_FIELDS.filter((f) => fields[f.key]).map((f) => f.key),
    [fields]
  )

  // Live client-side preview — sums the selected components across all
  // payslips, then applies the percentage. The server is the source of truth;
  // this is just so HR can sanity-check before clicking Apply.
  const preview = useMemo(() => {
    const pct = toNumber(percentage)
    let base = 0
    let affected = 0
    let skipped = 0
    payslips.forEach((slip) => {
      const slipBase = selectedKeys.reduce((sum, k) => sum + toNumber(slip[k]), 0)
      if (slipBase > 0) {
        base += slipBase
        affected += 1
      } else {
        skipped += 1
      }
    })
    const deduction = (base * pct) / 100
    return { base, deduction, affected, skipped, pct }
  }, [payslips, selectedKeys, percentage])

  const existingBulkLines = useMemo(() => {
    let count = 0
    payslips.forEach((slip) => {
      (slip.line_items || []).forEach((li) => {
        if (li.component_code === BULK_DEDUCTION_COMPONENT_CODE) count += 1
      })
    })
    return count
  }, [payslips])

  const pctNumber = toNumber(percentage)
  const pctValid =
    pctNumber >= BULK_DEDUCTION_MIN_PCT && pctNumber <= BULK_DEDUCTION_MAX_PCT
  const fieldsValid = selectedKeys.length > 0
  const canApply = pctValid && fieldsValid && !busy

  const handleApply = async () => {
    setBusy(true); setError(null); setSuccess(null)
    try {
      const payload = {
        percentage: percentage,
        fields: selectedKeys,
        replace_existing: true,
      }
      if (label.trim()) payload.label = label.trim()
      if (description.trim()) payload.description = description.trim()
      const result = await payrollEngineService.applyBulkDeduction(run.id, payload)
      // Refresh the parent BEFORE closing so the table reliably reflects the
      // new DEDUCTIONS / NET PAYABLE values (avoids a render-race where the
      // modal unmounts before payslips state updates).
      await onApplied?.(result)
      setSuccess(result?.summary || null)
      // Brief pause so HR sees the confirmation before the modal disappears.
      setTimeout(() => { onClose?.() }, 1200)
    } catch (e) {
      setError(e?.response?.data?.error || e.message)
    } finally { setBusy(false) }
  }

  const handleReverse = async () => {
    if (!confirm('Remove ALL bulk percentage-deduction line items from this run?')) return
    setBusy(true); setError(null); setSuccess(null)
    try {
      const result = await payrollEngineService.reverseBulkDeduction(run.id)
      await onApplied?.(result)
      onClose?.()
    } catch (e) {
      setError(e?.response?.data?.error || e.message)
    } finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-violet-100 p-2">
              <HeroIcons.ReceiptPercentIcon className="h-6 w-6 text-violet-700" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Bulk Salary Deduction
              </h2>
              <p className="text-sm text-slate-500">
                Apply a percentage deduction across every payslip in{' '}
                <span className="font-medium text-slate-700">{run.cycle_code}</span>.
                Basic salary is protected and never reduced.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <HeroIcons.XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 px-6 py-5">
          {/* Percentage input */}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Deduction Percentage
            </label>
            <div className="flex items-center gap-3">
              <div className="relative w-44">
                <input
                  type="number"
                  step="0.01"
                  min={BULK_DEDUCTION_MIN_PCT}
                  max={BULK_DEDUCTION_MAX_PCT}
                  value={percentage}
                  onChange={(e) => setPercentage(e.target.value)}
                  disabled={busy}
                  className={`w-full rounded-lg border px-3 py-2 pr-9 text-right text-base font-semibold tabular-nums focus:outline-none focus:ring-2 ${
                    pctValid
                      ? 'border-slate-300 focus:border-violet-500 focus:ring-violet-200'
                      : 'border-red-300 focus:border-red-500 focus:ring-red-200'
                  }`}
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-500">
                  %
                </span>
              </div>
              <div className="flex gap-1">
                {[2.5, 5, 10, 15, 20].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setPercentage(String(preset))}
                    disabled={busy}
                    className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-violet-50 hover:text-violet-700"
                  >
                    {preset}%
                  </button>
                ))}
              </div>
            </div>
            {!pctValid && (
              <p className="mt-1 text-xs text-red-600">
                Enter a value between {BULK_DEDUCTION_MIN_PCT}% and {BULK_DEDUCTION_MAX_PCT}%.
              </p>
            )}
          </div>

          {/* Fields */}
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Deduct From
            </label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {BULK_DEDUCTION_FIELDS.map((f) => (
                <label
                  key={f.key}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${
                    fields[f.key]
                      ? 'border-violet-300 bg-violet-50 text-violet-900'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={!!fields[f.key]}
                    onChange={(e) => setFields((prev) => ({ ...prev, [f.key]: e.target.checked }))}
                    disabled={busy}
                    className="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                  />
                  {f.label}
                </label>
              ))}
            </div>
            <div className="mt-2 flex items-center gap-1.5 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <HeroIcons.LockClosedIcon className="h-4 w-4 flex-shrink-0" />
              <span><strong>Basic</strong> is protected and never deducted.</span>
            </div>
            {!fieldsValid && (
              <p className="mt-1 text-xs text-red-600">Select at least one field.</p>
            )}
          </div>

          {/* Optional label + description */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Custom Label <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                disabled={busy}
                placeholder={`Bulk Salary Deduction (${pctNumber}%)`}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Description <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={busy}
                placeholder="e.g. Ramadan adjustment"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200"
              />
            </div>
          </div>

          {/* Live preview */}
          <div className="rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50 to-white p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-violet-900">
              <HeroIcons.CalculatorIcon className="h-4 w-4" />
              Live Preview
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-500">Affected</div>
                <div className="font-semibold text-slate-900">{preview.affected}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-500">Skipped (zero base)</div>
                <div className="font-semibold text-slate-900">{preview.skipped}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-500">Combined Base</div>
                <div className="font-semibold text-slate-900 tabular-nums">
                  {formatCurrency(preview.base)}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-violet-700">Total Deduction</div>
                <div className="text-lg font-bold text-violet-700 tabular-nums">
                  − {formatCurrency(preview.deduction)}
                </div>
              </div>
            </div>
          </div>

          {existingBulkLines > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900">
              <HeroIcons.InformationCircleIcon className="h-4 w-4 flex-shrink-0" />
              <span>
                This run already has <strong>{existingBulkLines}</strong> previous bulk-deduction
                line item(s). Applying a new deduction will <strong>replace</strong> them.
              </span>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              <HeroIcons.ExclamationTriangleIcon className="h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
              <HeroIcons.CheckCircleIcon className="h-4 w-4 flex-shrink-0 text-emerald-600" />
              <span>
                Applied <strong>{success.percentage}%</strong> deduction to{' '}
                <strong>{success.employees_affected}</strong> payslip(s){' '}
                ({success.employees_skipped} skipped). Total deducted:{' '}
                <strong className="tabular-nums">{formatCurrency(success.total_deducted)}</strong>.
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-4">
          <button
            type="button"
            onClick={handleReverse}
            disabled={busy || existingBulkLines === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <HeroIcons.ArrowUturnLeftIcon className="h-4 w-4" />
            Reverse All Bulk Deductions
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={!canApply}
              className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? (
                <HeroIcons.ArrowPathIcon className="h-4 w-4 animate-spin" />
              ) : (
                <HeroIcons.ReceiptPercentIcon className="h-4 w-4" />
              )}
              Apply {pctNumber}% Deduction
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
