/**
 * Invoice Tracker — Accounts Receivable command centre.
 *
 * Visual layers (top → bottom):
 *   1. Hero band with gradient mesh, live indicator, primary actions
 *   2. Financial-health KPI cards (Outstanding, Overdue, Settled, Health)
 *   3. Clickable pipeline bar — status segments act as filters
 *   4. Active-filter chip bar + collapsible advanced filters
 *   5. Modern invoice table with account avatars, balance progress, hover actions
 *
 * Distinct from apps.finance (A/P, AI extraction). Talks only to
 * invoiceTrackerService → /api/v1/invoice-tracker/.
 *
 * Soft-coded knobs live in `frontend/src/config/invoiceTracker.config.js`.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AdjustmentsHorizontalIcon,
  ArrowPathIcon,
  ArrowTrendingUpIcon,
  ArrowUpTrayIcon,
  BanknotesIcon,
  BoltIcon,
  CalculatorIcon,
  CheckCircleIcon,
  ClockIcon,
  DocumentArrowUpIcon,
  ExclamationTriangleIcon,
  EyeIcon,
  InformationCircleIcon,
  MagnifyingGlassIcon,
  PaperClipIcon,
  PlusIcon,
  SparklesIcon,
  Squares2X2Icon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import invoiceTrackerService from '../../services/invoiceTracker.service'
import {
  TRACKER_API_CONFIG,
  INVOICE_CATEGORIES,
  PAYMENT_STATUSES,
  CURRENCIES,
  formatMoney,
  formatDate,
} from '../../config/invoiceTracker.config'

// ─── Visual config (soft-coded) ─────────────────────────────────────────────
const HERO = {
  eyebrow: 'Finance · 3.2 · Accounts Receivable',
  title: 'Invoice Tracker',
  subtitle:
    'Live command centre for customer invoices — External & Internal — with Excel sync and S3 attachments.',
}

const PIPELINE_SEGMENTS = PAYMENT_STATUSES.filter((s) => s.key)

const AVATAR_PALETTE = [
  'from-indigo-500 to-purple-600',
  'from-emerald-500 to-teal-600',
  'from-rose-500 to-pink-600',
  'from-amber-500 to-orange-600',
  'from-sky-500 to-blue-600',
  'from-fuchsia-500 to-violet-600',
  'from-lime-500 to-green-600',
  'from-cyan-500 to-teal-600',
]

const hashIdx = (s = '') => {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h % AVATAR_PALETTE.length
}

const initialsOf = (name = '') => {
  const parts = String(name).trim().split(/\s+/).slice(0, 2)
  return parts.map((p) => p[0] || '').join('').toUpperCase() || '—'
}

// ─── Small presentational helpers ───────────────────────────────────────────

const LiveDot = () => (
  <span className="relative inline-flex h-2 w-2">
    <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
  </span>
)

const KpiCard = ({ icon: Icon, label, value, sub, gradient }) => (
  <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/10 backdrop-blur-md p-5 hover:bg-white/15 transition-colors">
    <div className={`absolute -right-8 -top-8 h-32 w-32 rounded-full opacity-25 bg-gradient-to-br ${gradient} blur-xl`} />
    <div className="relative flex items-start justify-between">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-white/70 mb-1">{label}</p>
        <p className="text-2xl md:text-3xl font-extrabold tabular-nums text-white">{value}</p>
        {sub && <p className="text-[11px] mt-1 text-white/60">{sub}</p>}
      </div>
      <div className={`p-2.5 rounded-xl bg-gradient-to-br ${gradient} shadow-lg`}>
        <Icon className="w-4 h-4 text-white" />
      </div>
    </div>
  </div>
)

const PipelineBar = ({ stats, total, activeStatus, onSelect }) => {
  if (!total) {
    return (
      <div className="h-3 w-full rounded-full bg-gray-100 overflow-hidden">
        <div className="h-full w-full bg-gradient-to-r from-gray-100 to-gray-200 animate-pulse" />
      </div>
    )
  }
  return (
    <div className="space-y-3">
      <div className="h-3 w-full rounded-full bg-gray-100 overflow-hidden flex">
        {PIPELINE_SEGMENTS.map((s) => {
          const count = stats?.[s.key] ?? 0
          if (count === 0) return null
          const pct = (count / total) * 100
          const dim = activeStatus && activeStatus !== s.key
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => onSelect(activeStatus === s.key ? '' : s.key)}
              title={`${s.label}: ${count} (${pct.toFixed(1)}%)`}
              style={{ width: `${pct}%` }}
              className={`h-full bg-gradient-to-r ${s.tile} transition-all duration-300 hover:opacity-90 ${dim ? 'opacity-30' : ''}`}
            />
          )
        })}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {PIPELINE_SEGMENTS.map((s) => {
          const count = stats?.[s.key] ?? 0
          const active = activeStatus === s.key
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => onSelect(active ? '' : s.key)}
              className={`group inline-flex items-center gap-2 text-xs transition-all ${
                active ? 'font-bold text-gray-900' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <span className={`h-2.5 w-2.5 rounded-full bg-gradient-to-br ${s.tile} ${active ? 'ring-2 ring-offset-1 ring-gray-300' : ''}`} />
              <span>{s.label}</span>
              <span className={`tabular-nums ${active ? 'text-indigo-600' : 'text-gray-400'}`}>{count}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

const StatusPill = ({ statusKey }) => {
  const s = PAYMENT_STATUSES.find((x) => x.key === statusKey)
  if (!s || !s.key) return <span className="text-xs text-gray-400">—</span>
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold ${s.badge}`}>
      <span className={`h-1.5 w-1.5 rounded-full bg-gradient-to-br ${s.tile}`} />
      {s.label}
    </span>
  )
}

const CategoryChip = ({ category }) => {
  const isInternal = category === 'internal'
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
        isInternal
          ? 'bg-purple-50 text-purple-700 border border-purple-100'
          : 'bg-indigo-50 text-indigo-700 border border-indigo-100'
      }`}
    >
      {isInternal ? 'INT' : 'EXT'}
    </span>
  )
}

const AccountAvatar = ({ name }) => {
  const gradient = AVATAR_PALETTE[hashIdx(name || '?')]
  return (
    <div className={`flex items-center justify-center h-8 w-8 rounded-lg bg-gradient-to-br ${gradient} text-white text-[11px] font-bold shadow-sm shrink-0`}>
      {initialsOf(name || '—')}
    </div>
  )
}

const BalanceBar = ({ total, paid, currency }) => {
  const t = Number(total) || 0
  const p = Math.max(0, Math.min(Number(paid) || 0, t))
  const pct = t > 0 ? (p / t) * 100 : 0
  const full = pct >= 99.5
  return (
    <div className="w-32">
      <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            full
              ? 'bg-gradient-to-r from-emerald-500 to-green-600'
              : pct > 0
                ? 'bg-gradient-to-r from-indigo-500 to-blue-600'
                : 'bg-gray-200'
          }`}
          style={{ width: `${Math.max(pct, full ? 100 : 4)}%` }}
        />
      </div>
      <div className="flex items-center justify-between mt-0.5 text-[10px] tabular-nums">
        <span className={full ? 'text-emerald-700 font-semibold' : 'text-gray-500'}>{pct.toFixed(0)}%</span>
        <span className="text-gray-400">{formatMoney(t - p, currency)}</span>
      </div>
    </div>
  )
}

// ─── Excel-import modal ─────────────────────────────────────────────────────
const ImportExcelModal = ({ open, onClose, onImported }) => {
  const [file, setFile]         = useState(null)
  const [sheets, setSheets]     = useState('')
  const [busy, setBusy]         = useState(false)
  const [result, setResult]     = useState(null)
  const [error, setError]       = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const inputRef                = useRef(null)

  useEffect(() => {
    if (!open) {
      setFile(null); setSheets(''); setResult(null); setError(null); setBusy(false); setDragOver(false)
    }
  }, [open])

  if (!open) return null

  const handleFiles = (files) => {
    const f = files?.[0]
    if (f) setFile(f)
  }

  const handleSubmit = async () => {
    if (!file) return
    setBusy(true); setError(null); setResult(null)
    try {
      const res = await invoiceTrackerService.importExcel(file, sheets.trim())
      setResult(res)
      onImported?.()
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Import failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-xl w-full overflow-hidden animate-[fadeIn_0.2s_ease-out]">
        <div className="px-6 py-5 bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-white/15">
              <DocumentArrowUpIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg">Import Customer-Invoice Excel</h3>
              <p className="text-[11px] text-white/80">Bulk upsert by invoice number · headers auto-detected</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/15">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files) }}
            onClick={() => inputRef.current?.click()}
            className={`cursor-pointer rounded-2xl py-10 px-6 text-center border-2 border-dashed transition-all ${
              dragOver
                ? 'border-indigo-500 bg-indigo-50 scale-[1.01]'
                : file
                  ? 'border-emerald-300 bg-emerald-50/50'
                  : 'border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/30'
            }`}
          >
            <div className={`inline-flex p-3 rounded-2xl mb-3 ${
              file ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'
            }`}>
              {file ? <CheckCircleIcon className="w-7 h-7" /> : <ArrowUpTrayIcon className="w-7 h-7" />}
            </div>
            <p className="text-sm font-semibold text-gray-800">
              {file ? file.name : 'Drop your .xlsx file here, or click to browse'}
            </p>
            <p className="text-[11px] text-gray-500 mt-1">
              {file
                ? `${(file.size / 1024).toFixed(1)} KB · ready to import`
                : 'External + Internal sheets supported · header row found automatically'}
            </p>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1.5">
              Restrict to sheets (optional)
            </label>
            <input
              type="text"
              value={sheets}
              onChange={(e) => setSheets(e.target.value)}
              placeholder="e.g. ExternalInvoice,InternalInvoice2018"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-100 text-sm text-rose-700">
              <ExclamationTriangleIcon className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {result && (
            <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircleIcon className="w-5 h-5 text-emerald-600" />
                <p className="font-bold text-emerald-900">Import complete</p>
              </div>
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="bg-white/70 rounded-lg p-2">
                  <p className="text-[10px] uppercase text-gray-500">Created</p>
                  <p className="text-lg font-extrabold text-emerald-700 tabular-nums">{result.rows_created}</p>
                </div>
                <div className="bg-white/70 rounded-lg p-2">
                  <p className="text-[10px] uppercase text-gray-500">Updated</p>
                  <p className="text-lg font-extrabold text-indigo-700 tabular-nums">{result.rows_updated}</p>
                </div>
                <div className="bg-white/70 rounded-lg p-2">
                  <p className="text-[10px] uppercase text-gray-500">Skipped</p>
                  <p className="text-lg font-extrabold text-gray-600 tabular-nums">{result.rows_skipped}</p>
                </div>
                <div className="bg-white/70 rounded-lg p-2">
                  <p className="text-[10px] uppercase text-gray-500">Errors</p>
                  <p className={`text-lg font-extrabold tabular-nums ${result.errors?.length ? 'text-rose-700' : 'text-gray-400'}`}>
                    {result.errors?.length || 0}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-xl border border-gray-200 text-gray-700 hover:bg-white">
            Close
          </button>
          <button
            onClick={handleSubmit}
            disabled={!file || busy}
            className="px-4 py-2 text-sm rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed shadow-sm inline-flex items-center gap-1.5"
          >
            {busy ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <BoltIcon className="w-4 h-4" />}
            {busy ? 'Importing…' : 'Start Import'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Attachment-upload control (per row) ────────────────────────────────────
const AttachmentControl = ({ invoice, onChanged }) => {
  const inputRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const count = invoice.attachments_count ?? invoice.attachments?.length ?? 0

  const handleUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true)
    try {
      await invoiceTrackerService.uploadAttachment(invoice.id, file)
      onChanged?.()
    } catch (err) {
      console.error('[InvoiceTracker] upload failed', err)
    } finally {
      setBusy(false)
      e.target.value = ''
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        title={count > 0 ? `${count} attachment(s) — click to add another` : 'Upload attachment'}
        className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] rounded-lg border transition-all ${
          count > 0
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            : 'border-gray-200 text-gray-500 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700'
        } disabled:opacity-50`}
      >
        {busy ? <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" /> : <PaperClipIcon className="w-3.5 h-3.5" />}
        {count > 0 ? count : '+'}
      </button>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept=".pdf,.png,.jpg,.jpeg"
        onChange={handleUpload}
      />
    </>
  )
}

// ─── Invoice Detail Drawer — full 28-column Excel-parity view ──────────────
// Fields flagged with `calc: true` are produced by the soft-coded
// finance_engine on the backend. Adding a new column == add one row to
// TRACKER_FIELD_GROUPS. Nothing else.
const TRACKER_FIELD_GROUPS = [
  {
    title: 'Identification',
    fields: [
      { key: 'invoice_number',         label: 'Invoice #' },
      { key: 'category',               label: 'Category' },
      { key: 'credit_note_reference',  label: 'Credit Note Ref' },
    ],
  },
  {
    title: 'Customer & Project',
    fields: [
      { key: 'account',                label: 'Account' },
      { key: 'company',                label: 'Company' },
      { key: 'rad_project_no',         label: 'RAD Project #' },
      { key: 'project_name',           label: 'Project Name' },
      { key: 'project_id',             label: 'Project ID' },
      { key: 'pm',                     label: 'PM' },
      { key: 'finance_pm_email',       label: 'Finance & PM Email', wide: true },
      { key: 'contract_clause',        label: 'Contract Clause', wide: true },
    ],
  },
  {
    title: 'Dates',
    fields: [
      { key: 'invoice_date',           label: 'Invoice Date',   type: 'date' },
      { key: 'invoice_sent',           label: 'Invoice Sent',   type: 'date' },
      { key: 'due_date',               label: 'Due Date',       type: 'date', calc: true },
      { key: 'payment_date',           label: 'Payment Date',   type: 'date' },
      { key: 'payment_terms',          label: 'Payment Terms' },
    ],
  },
  {
    title: 'Financials',
    fields: [
      { key: 'currency',               label: 'Currency' },
      { key: 'invoice_amount',         label: 'Invoice Amount', type: 'money' },
      { key: 'ppc_value',              label: 'PPC Value',      type: 'money', calc: true },
      { key: 'retention',              label: 'Retention',      type: 'money', calc: true },
      { key: 'icv_applicable',         label: 'ICV Applicable' },
      { key: 'amount_excl_vat',        label: 'Amount Excl. VAT', type: 'money', calc: true },
      { key: 'invoice_amount_aed',     label: 'Inv Amt (AED)',  type: 'money', calc: true, currency: 'AED' },
      { key: 'grand_total',            label: 'Grand Total',    type: 'money' },
      { key: 'paid_amount_excl_vat',   label: 'Paid Amount Excl. VAT', type: 'money', calc: true },
      { key: 'actual_payment_received',label: 'Actual Payment Received', type: 'money' },
      { key: 'balance_to_be_received', label: 'Balance to be Received',  type: 'money', calc: true },
    ],
  },
  {
    title: 'Status & References',
    fields: [
      { key: 'payment_status',         label: 'Payment Status', calc: true },
      { key: 'days_overdue',           label: 'Days Overdue',   calc: true },
      { key: 'received_in_account',    label: 'Bank Account' },
      { key: 'customer_inv_reference', label: 'Customer Inv Ref' },
    ],
  },
  {
    title: 'Notes',
    fields: [
      { key: 'details',                label: 'Details',  wide: true, multi: true },
      { key: 'remarks',                label: 'Remarks',  wide: true, multi: true },
    ],
  },
]

const fmtFieldValue = (field, raw, invoice) => {
  if (raw === null || raw === undefined || raw === '') return '—'
  if (field.type === 'money') {
    const ccy = field.currency || invoice.currency || 'AED'
    return formatMoney(raw, ccy)
  }
  if (field.type === 'date') return formatDate(raw)
  return String(raw)
}

const CalcBadge = () => (
  <span
    title="Auto-calculated by the finance engine (Excel formula parity)"
    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-violet-50 text-violet-700 border border-violet-100"
  >
    <CalculatorIcon className="w-2.5 h-2.5" />
    auto
  </span>
)

const InvoiceDetailDrawer = ({ invoice, onClose, onChanged }) => {
  const [recomputing, setRecomputing] = useState(false)
  const [cfg, setCfg] = useState(null)

  useEffect(() => {
    let cancelled = false
    invoiceTrackerService
      .getConfig()
      .then((c) => { if (!cancelled) setCfg(c) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  if (!invoice) return null

  const handleRecompute = async () => {
    setRecomputing(true)
    try {
      await invoiceTrackerService.recompute(invoice.id)
      onChanged?.()
    } catch (err) {
      console.error('[InvoiceTracker] recompute failed', err)
    } finally {
      setRecomputing(false)
    }
  }

  const total = Number(invoice.grand_total ?? invoice.invoice_amount ?? 0)
  const paid  = Number(invoice.actual_payment_received ?? 0)

  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" />
      <div
        className="relative ml-auto w-full max-w-2xl h-full bg-white shadow-2xl flex flex-col"
        style={{ animation: 'slideInRight 240ms ease-out' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative px-6 py-5 bg-gradient-to-br from-slate-900 via-indigo-900 to-violet-900 text-white">
          <div className="absolute inset-0 opacity-20 [background:radial-gradient(circle_at_30%_40%,#a78bfa_0%,transparent_50%)]" />
          <div className="relative flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <CategoryChip category={invoice.category} />
                <StatusPill statusKey={invoice.payment_status} />
              </div>
              <p className="font-mono text-lg font-bold truncate">{invoice.invoice_number}</p>
              <p className="text-xs text-white/70 truncate">
                {invoice.account || invoice.company || '—'} · {invoice.project_name || invoice.rad_project_no || '—'}
              </p>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 text-white/80 hover:text-white">
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>

          <div className="relative mt-4 grid grid-cols-3 gap-2">
            <div className="bg-white/10 backdrop-blur rounded-lg px-3 py-2">
              <p className="text-[9px] uppercase tracking-wider text-white/60">Total</p>
              <p className="text-sm font-bold tabular-nums">{formatMoney(total, invoice.currency)}</p>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-lg px-3 py-2">
              <p className="text-[9px] uppercase tracking-wider text-white/60">Paid</p>
              <p className="text-sm font-bold tabular-nums">{formatMoney(paid, invoice.currency)}</p>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-lg px-3 py-2">
              <p className="text-[9px] uppercase tracking-wider text-white/60">Balance</p>
              <p className="text-sm font-bold tabular-nums">
                {formatMoney(invoice.balance_to_be_received ?? Math.max(total - paid, 0), invoice.currency)}
              </p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6 bg-gray-50/40">
          {cfg && (
            <div className="rounded-xl border border-violet-100 bg-violet-50/50 px-4 py-3 text-[11px] text-violet-900 flex items-start gap-2">
              <InformationCircleIcon className="w-4 h-4 mt-0.5 flex-shrink-0 text-violet-600" />
              <div className="leading-relaxed">
                Fields marked <CalcBadge /> are derived by the finance engine using your
                Excel formulas: VAT&nbsp;{Math.round(cfg.vat_rate * 100)}%, ICV retention&nbsp;
                {Math.round(cfg.icv_retention_rate * 100)}%, FX-to-AED&nbsp;
                {Object.entries(cfg.fx_to_aed).map(([k, v]) => `${k}=${v}`).join(' · ')}.
              </div>
            </div>
          )}

          {TRACKER_FIELD_GROUPS.map((group) => (
            <div key={group.title} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
                <p className="text-[11px] font-bold uppercase tracking-widest text-gray-600">
                  {group.title}
                </p>
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 px-4 py-3">
                {group.fields.map((f) => {
                  const raw = invoice[f.key]
                  return (
                    <div
                      key={f.key}
                      className={f.wide ? 'col-span-2' : 'col-span-2 sm:col-span-1'}
                    >
                      <dt className="text-[10px] uppercase tracking-wider text-gray-400 mb-0.5 flex items-center gap-1.5">
                        {f.label}
                        {f.calc && <CalcBadge />}
                      </dt>
                      <dd
                        className={`text-sm text-gray-800 ${f.type === 'money' ? 'tabular-nums font-semibold' : ''} ${f.multi ? 'whitespace-pre-wrap break-words' : 'truncate'}`}
                      >
                        {fmtFieldValue(f, raw, invoice)}
                      </dd>
                    </div>
                  )
                })}
              </dl>
            </div>
          ))}
        </div>

        <div className="px-6 py-4 bg-white border-t border-gray-100 flex items-center justify-between gap-2">
          <p className="text-[11px] text-gray-400">
            Created {formatDate(invoice.created_at)} · Updated {formatDate(invoice.updated_at)}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-2 text-sm rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50"
            >
              Close
            </button>
            <button
              onClick={handleRecompute}
              disabled={recomputing}
              title="Re-apply every Excel-derived formula on this invoice"
              className="px-3 py-2 text-sm rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold disabled:opacity-50 inline-flex items-center gap-1.5 shadow-sm"
            >
              {recomputing
                ? <ArrowPathIcon className="w-4 h-4 animate-spin" />
                : <SparklesIcon className="w-4 h-4" />}
              {recomputing ? 'Recomputing…' : 'Recompute'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main page ──────────────────────────────────────────────────────────────
const InvoiceTracker = () => {
  const [invoices, setInvoices]       = useState([])
  const [stats, setStats]             = useState(null)
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState(null)

  const [categoryFilter, setCategoryFilter] = useState('')
  const [statusFilter, setStatusFilter]     = useState('')
  const [currencyFilter, setCurrencyFilter] = useState('')
  const [accountFilter, setAccountFilter]   = useState('')
  const [projectFilter, setProjectFilter]   = useState('')
  const [searchTerm, setSearchTerm]         = useState('')
  const [dateFrom, setDateFrom]             = useState('')
  const [dateTo, setDateTo]                 = useState('')

  const [showAdvanced, setShowAdvanced] = useState(false)
  const [importOpen, setImportOpen]     = useState(false)
  const [lastFetched, setLastFetched]   = useState(null)
  const [selectedInvoice, setSelectedInvoice] = useState(null)

  const buildFilters = useCallback(() => {
    const f = {}
    if (categoryFilter) f.category = categoryFilter
    if (statusFilter)   f.payment_status = statusFilter
    if (currencyFilter) f.currency = currencyFilter
    if (accountFilter.trim()) f.account = accountFilter.trim()
    if (projectFilter.trim()) f.project = projectFilter.trim()
    if (searchTerm.trim()) f.search = searchTerm.trim()
    if (dateFrom) f.date_from = dateFrom
    if (dateTo)   f.date_to   = dateTo
    f.page_size = TRACKER_API_CONFIG.pageSize
    return f
  }, [categoryFilter, statusFilter, currencyFilter, accountFilter, projectFilter, searchTerm, dateFrom, dateTo])

  const fetchData = useCallback(async () => {
    try {
      setError(null)
      const filters = buildFilters()
      const [list, s] = await Promise.all([
        invoiceTrackerService.list(filters),
        invoiceTrackerService.stats({}).catch(() => null),
      ])
      const rows = Array.isArray(list) ? list : list?.results || []
      setInvoices(rows)
      if (s) setStats(s)
      setLastFetched(new Date())
    } catch (err) {
      console.error('[InvoiceTracker] fetch failed', err)
      setError(err?.response?.data?.detail || err?.message || 'Failed to load invoices')
      setInvoices([])
    } finally {
      setLoading(false)
    }
  }, [buildFilters])

  useEffect(() => { setLoading(true); fetchData() }, [fetchData])

  useEffect(() => {
    if (!TRACKER_API_CONFIG.refreshMs) return
    const id = setInterval(fetchData, TRACKER_API_CONFIG.refreshMs)
    return () => clearInterval(id)
  }, [fetchData])

  const kpi = useMemo(() => {
    const total = stats?.total ?? invoices.length
    const overdue = stats?.overdue_count ?? invoices.filter((i) => i.days_overdue > 0).length
    const paid = stats?.by_status?.paid ?? invoices.filter((i) => i.payment_status === 'paid').length
    const pending = stats?.by_status?.pending ?? invoices.filter((i) => i.payment_status === 'pending').length
    const totalAed = stats?.total_aed ?? 0
    const health = total > 0 ? Math.round(((total - overdue) / total) * 100) : 100
    return { total, overdue, paid, pending, totalAed, health }
  }, [stats, invoices])

  const activeFilters = useMemo(() => {
    const list = []
    if (categoryFilter) list.push({ k: 'category',  label: INVOICE_CATEGORIES.find((x) => x.value === categoryFilter)?.label, clear: () => setCategoryFilter('') })
    if (statusFilter)   list.push({ k: 'status',    label: PAYMENT_STATUSES.find((x) => x.key === statusFilter)?.label,       clear: () => setStatusFilter('') })
    if (currencyFilter) list.push({ k: 'currency',  label: currencyFilter,               clear: () => setCurrencyFilter('') })
    if (accountFilter)  list.push({ k: 'account',   label: `Account: ${accountFilter}`,  clear: () => setAccountFilter('') })
    if (projectFilter)  list.push({ k: 'project',   label: `Project: ${projectFilter}`,  clear: () => setProjectFilter('') })
    if (searchTerm)     list.push({ k: 'search',    label: `Search: ${searchTerm}`,      clear: () => setSearchTerm('') })
    if (dateFrom)       list.push({ k: 'from',      label: `From ${dateFrom}`,           clear: () => setDateFrom('') })
    if (dateTo)         list.push({ k: 'to',        label: `To ${dateTo}`,               clear: () => setDateTo('') })
    return list
  }, [categoryFilter, statusFilter, currencyFilter, accountFilter, projectFilter, searchTerm, dateFrom, dateTo])

  const clearAll = () => {
    setCategoryFilter(''); setStatusFilter(''); setCurrencyFilter('')
    setAccountFilter(''); setProjectFilter(''); setSearchTerm('')
    setDateFrom(''); setDateTo('')
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── HERO ────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-900 to-violet-900 text-white pb-20">
        <div className="absolute inset-0 opacity-30">
          <div className="absolute -top-24 -left-16 h-72 w-72 rounded-full bg-fuchsia-500 blur-3xl" />
          <div className="absolute top-10 right-20 h-72 w-72 rounded-full bg-indigo-500 blur-3xl" />
          <div className="absolute -bottom-16 left-1/3 h-72 w-72 rounded-full bg-emerald-500 blur-3xl" />
        </div>
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: 'linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />

        <div className="relative max-w-7xl mx-auto px-6 py-8 lg:py-10">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-white/10 backdrop-blur-sm border border-white/15 text-[10px] font-bold uppercase tracking-widest text-white/90 mb-3">
                <LiveDot /> {HERO.eyebrow}
              </div>
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-tight">{HERO.title}</h1>
              <p className="text-sm md:text-base text-white/70 mt-2 max-w-2xl">{HERO.subtitle}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={fetchData}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 backdrop-blur-sm border border-white/10 text-sm font-medium text-white disabled:opacity-50"
              >
                <ArrowPathIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button
                type="button"
                onClick={() => setImportOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white text-indigo-700 hover:bg-indigo-50 text-sm font-bold shadow-lg shadow-indigo-900/30"
              >
                <DocumentArrowUpIcon className="w-4 h-4" />
                Import Excel
              </button>
            </div>
          </div>

          {/* KPI cards inside the hero */}
          <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard icon={BanknotesIcon}             label="Total Outstanding"  value={formatMoney(kpi.totalAed, 'AED')} sub={`${kpi.total} invoices tracked`}                                  gradient="from-indigo-500 to-violet-600" />
            <KpiCard icon={ExclamationTriangleIcon}   label="Overdue"            value={kpi.overdue}                       sub={kpi.total ? `${((kpi.overdue / kpi.total) * 100).toFixed(0)}% of register` : '—'} gradient="from-rose-500 to-orange-600" />
            <KpiCard icon={CheckCircleIcon}           label="Settled"            value={kpi.paid}                          sub={kpi.total ? `${((kpi.paid / kpi.total) * 100).toFixed(0)}% of register` : '—'}    gradient="from-emerald-500 to-teal-600" />
            <KpiCard icon={ArrowTrendingUpIcon}       label="Collection Health"  value={`${kpi.health}%`}                  sub={kpi.pending > 0 ? `${kpi.pending} pending` : 'All current'}                       gradient="from-sky-500 to-blue-600" />
          </div>
        </div>
      </div>

      {/* ── PIPELINE BAR (overlaps hero) ────────────────────────── */}
      <div className="max-w-7xl mx-auto px-6 -mt-12 relative">
        <div className="rounded-2xl bg-white border border-gray-100 shadow-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Squares2X2Icon className="w-4 h-4 text-indigo-600" />
              <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500">Payment Pipeline</p>
            </div>
            {lastFetched && (
              <p className="text-[10px] text-gray-400 flex items-center gap-1.5">
                <ClockIcon className="w-3 h-3" />
                Updated {lastFetched.toLocaleTimeString()}
              </p>
            )}
          </div>
          <PipelineBar stats={stats?.by_status} total={kpi.total} activeStatus={statusFilter} onSelect={setStatusFilter} />
        </div>
      </div>

      {/* ── FILTERS ─────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-6 mt-4">
        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-4 space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-center gap-3">
            <div className="relative flex-1">
              <MagnifyingGlassIcon className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search invoice #, account, project, customer reference…"
                className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
              />
            </div>
            <div className="inline-flex rounded-xl border border-gray-200 p-0.5 bg-gray-50">
              {INVOICE_CATEGORIES.map((c) => (
                <button
                  key={c.value || 'all'}
                  type="button"
                  onClick={() => setCategoryFilter(c.value)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    categoryFilter === c.value ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-xl border transition-all ${
                showAdvanced ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <AdjustmentsHorizontalIcon className="w-4 h-4" />
              Advanced
            </button>
          </div>

          {activeFilters.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-gray-100">
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mr-1">Active</span>
              {activeFilters.map((f) => (
                <button
                  key={f.k}
                  onClick={f.clear}
                  className="group inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-indigo-50 border border-indigo-100 text-indigo-700 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-700"
                >
                  {f.label}
                  <XMarkIcon className="w-3 h-3 opacity-50 group-hover:opacity-100" />
                </button>
              ))}
              <button onClick={clearAll} className="ml-1 text-[11px] text-gray-500 hover:text-gray-800 underline underline-offset-2">
                Clear all
              </button>
            </div>
          )}

          {showAdvanced && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-gray-100 animate-[fadeIn_0.2s_ease-out]">
              <input
                type="text"
                value={accountFilter}
                onChange={(e) => setAccountFilter(e.target.value)}
                placeholder="Filter by account…"
                className="px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
              <input
                type="text"
                value={projectFilter}
                onChange={(e) => setProjectFilter(e.target.value)}
                placeholder="Filter by project / RAD #…"
                className="px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
              <select
                value={currencyFilter}
                onChange={(e) => setCurrencyFilter(e.target.value)}
                className="px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200"
              >
                {CURRENCIES.map((o) => (
                  <option key={o.value || 'all'} value={o.value}>{o.label}</option>
                ))}
              </select>
              <div className="flex items-center gap-1">
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="flex-1 px-2 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-200"
                />
                <span className="text-gray-300 text-xs">→</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="flex-1 px-2 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-200"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── TABLE ───────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-gray-900">Invoice Register</h3>
              <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-bold tabular-nums">
                {invoices.length}
              </span>
            </div>
            <p className="text-[11px] text-gray-400">Sorted by invoice date · newest first</p>
          </div>

          {error ? (
            <div className="p-12 text-center">
              <div className="inline-flex p-3 rounded-2xl bg-rose-100 text-rose-700 mb-3">
                <ExclamationTriangleIcon className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-rose-700">{error}</p>
            </div>
          ) : loading && invoices.length === 0 ? (
            <div className="p-16 text-center">
              <ArrowPathIcon className="w-8 h-8 mx-auto text-indigo-400 animate-spin mb-2" />
              <p className="text-sm text-gray-400">Loading invoice register…</p>
            </div>
          ) : invoices.length === 0 ? (
            <div className="p-16 text-center">
              <div className="inline-flex p-4 rounded-2xl bg-gradient-to-br from-indigo-100 to-violet-100 text-indigo-700 mb-4">
                <DocumentArrowUpIcon className="w-8 h-8" />
              </div>
              <p className="text-base font-bold text-gray-800 mb-1">No invoices match</p>
              <p className="text-sm text-gray-500 mb-4">
                {activeFilters.length > 0
                  ? 'Try clearing filters, or import the latest Excel master file.'
                  : 'Get started by importing your customer-invoice Excel master.'}
              </p>
              <button
                type="button"
                onClick={() => setImportOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-sm font-bold shadow-sm"
              >
                <PlusIcon className="w-4 h-4" />
                Import Excel
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50/50 border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-gray-500">Invoice</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-gray-500">Account / Project</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-gray-500">Dates</th>
                    <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-gray-500">Amount</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-gray-500">Collection</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-gray-500">Status</th>
                    <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-gray-500">Files</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => {
                    const total = Number(inv.grand_total ?? inv.invoice_amount ?? 0)
                    const paid  = Number(inv.actual_payment_received ?? 0)
                    const isOverdue = inv.days_overdue > 0
                    return (
                      <tr key={inv.id} className="group border-b border-gray-50 hover:bg-indigo-50/30 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <CategoryChip category={inv.category} />
                            <span className="font-mono text-xs font-semibold text-gray-800">{inv.invoice_number}</span>
                          </div>
                          {inv.customer_inv_reference && (
                            <p className="text-[10px] text-gray-400 mt-0.5 ml-9">ref: {inv.customer_inv_reference}</p>
                          )}
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <AccountAvatar name={inv.account || inv.company} />
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-gray-800 truncate max-w-[220px]">
                                {inv.account || inv.company || '—'}
                              </p>
                              <p className="text-[11px] text-gray-500 truncate max-w-[220px]">
                                {inv.project_name || inv.rad_project_no || '—'}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3 whitespace-nowrap">
                          <p className="text-xs text-gray-700">{formatDate(inv.invoice_date)}</p>
                          <p className={`text-[11px] ${isOverdue ? 'text-rose-600 font-bold' : 'text-gray-400'}`}>
                            Due {formatDate(inv.due_date)}
                            {isOverdue && <span className="ml-1">· {inv.days_overdue}d late</span>}
                          </p>
                        </td>

                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <p className="text-sm font-bold text-gray-900 tabular-nums">{formatMoney(total, inv.currency)}</p>
                          <p className="text-[10px] uppercase tracking-wider text-gray-400">{inv.currency}</p>
                        </td>

                        <td className="px-4 py-3">
                          <BalanceBar total={total} paid={paid} currency={inv.currency} />
                        </td>

                        <td className="px-4 py-3"><StatusPill statusKey={inv.payment_status} /></td>

                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              onClick={() => setSelectedInvoice(inv)}
                              className="opacity-60 group-hover:opacity-100 transition-opacity p-1 rounded-md text-gray-500 hover:bg-indigo-50 hover:text-indigo-700"
                              title="View all 28 columns + auto-calc breakdown"
                            >
                              <EyeIcon className="w-4 h-4" />
                            </button>
                            <AttachmentControl invoice={inv} onChanged={fetchData} />
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <div className="px-5 py-3 text-[11px] text-gray-400 bg-gray-50/50 border-t border-gray-100 flex items-center justify-between">
                <span>
                  Showing {invoices.length} row{invoices.length === 1 ? '' : 's'} · page size {TRACKER_API_CONFIG.pageSize}
                </span>
                <span className="inline-flex items-center gap-1">
                  <LiveDot /> auto-refresh every {Math.round(TRACKER_API_CONFIG.refreshMs / 1000)}s
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      <ImportExcelModal open={importOpen} onClose={() => setImportOpen(false)} onImported={fetchData} />

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  )
}

export default InvoiceTracker
