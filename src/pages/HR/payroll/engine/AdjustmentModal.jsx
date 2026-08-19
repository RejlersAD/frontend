/**
 * Schema-driven editor for a single PayrollAdjustment.
 *
 * Every field is generated from `ADJUSTMENT_EDIT_FIELDS` in
 * payrollEngine.config — add an entry there and a control appears here.
 *
 * Specials:
 *   • `type: 'employee'`   → searchable employee picker (uses /employees/).
 *   • `type: 'component'`  → dependent dropdown that switches between
 *                            `earning_components` and `deduction_components`
 *                            based on the value of the `kind` field.
 *
 * Backend write access is gated by `PayrollAdjustmentWritePermission`, so
 * this modal is also gated by `canEditPayrollAdjustment` on the parent.
 */
import React, { useEffect, useMemo, useState } from 'react'
import * as HeroIcons from '@heroicons/react/24/outline'
import payrollEngineService from '../../../../services/payrollEngine.service'
import {
  ADJUSTMENT_EDIT_FIELDS,
  ADJUSTMENT_KIND,
  PAYROLL_ENGINE_CURRENCY,
} from '../../../../config/payrollEngine.config'

const MONTHS = [
  { value: 1, label: 'Jan' }, { value: 2, label: 'Feb' }, { value: 3, label: 'Mar' },
  { value: 4, label: 'Apr' }, { value: 5, label: 'May' }, { value: 6, label: 'Jun' },
  { value: 7, label: 'Jul' }, { value: 8, label: 'Aug' }, { value: 9, label: 'Sep' },
  { value: 10, label: 'Oct' }, { value: 11, label: 'Nov' }, { value: 12, label: 'Dec' },
]

const toFormValue = (raw, type) => {
  if (raw === null || raw === undefined) return ''
  return raw
}

const toPayloadValue = (val, type) => {
  if (type === 'number') return val === '' || val === null ? null : val
  return val ?? ''
}

const FIELD_GROUPS_ORDER = (() => {
  const seen = new Set()
  const order = []
  for (const f of ADJUSTMENT_EDIT_FIELDS) {
    const g = f.group || 'General'
    if (!seen.has(g)) { seen.add(g); order.push(g) }
  }
  return order
})()

const today = new Date()
const DEFAULTS = {
  target_year: today.getFullYear(),
  target_month: today.getMonth() + 1,
  kind: ADJUSTMENT_KIND.EARNING,
  status: 'pending',
}

export default function AdjustmentModal({ open, adjustment, onClose, onSaved }) {
  const isEdit = !!adjustment?.id
  const [form, setForm] = useState({})
  const [catalog, setCatalog] = useState(null)
  const [employees, setEmployees] = useState([])
  const [empSearch, setEmpSearch] = useState('')
  const [empSelected, setEmpSelected] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [touched, setTouched] = useState(false)

  // Seed form whenever modal opens
  useEffect(() => {
    if (!open) return
    const seeded = {}
    for (const f of ADJUSTMENT_EDIT_FIELDS) {
      const raw = adjustment?.[f.key] ?? DEFAULTS[f.key]
      seeded[f.key] = toFormValue(raw, f.type)
    }
    setForm(seeded)
    setError(null)
    setTouched(false)
    setEmpSearch(adjustment?.employee_name || '')
    setEmpSelected(false)
  }, [open, adjustment])

  // Load /catalog/ once for select options
  useEffect(() => {
    if (!open || catalog) return
    payrollEngineService.getCatalog()
      .then(setCatalog)
      .catch(() => setCatalog({}))
  }, [open, catalog])

  // Load employees list for picker (cap at 500 — typical org)
  useEffect(() => {
    if (!open || employees.length > 0) return
    payrollEngineService.listEmployees({ page_size: 500 })
      .then((res) => {
        const list = Array.isArray(res) ? res : (res?.results || [])
        setEmployees(list)
      })
      .catch(() => setEmployees([]))
  }, [open, employees.length])

  const handleChange = (key, value) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value }
      // When kind changes, clear the dependent component_code so the user
      // is forced to re-pick from the right list.
      if (key === 'kind' && value !== prev.kind) next.component_code = ''
      return next
    })
    setTouched(true)
  }

  const resolveOptions = (field) => {
    if (field.optionsFrom === 'months') return MONTHS
    if (field.optionsFrom && catalog?.[field.optionsFrom]) {
      return catalog[field.optionsFrom].map((o) => ({
        value: o.code ?? o.value ?? o,
        label: o.label ?? o.name ?? o.code ?? String(o),
      }))
    }
    return []
  }

  const resolveComponentOptions = () => {
    if (!catalog) return []
    const kind = form.kind
    const src = kind === ADJUSTMENT_KIND.DEDUCTION
      ? catalog.deduction_components
      : catalog.earning_components
    return (src || []).map((o) => ({
      value: o.code,
      label: o.label || o.code,
    }))
  }

  const filteredEmployees = useMemo(() => {
    const q = (empSearch || '').trim().toLowerCase()
    if (!q) return employees.slice(0, 50)
    return employees.filter((e) =>
      (e.full_name || '').toLowerCase().includes(q)
      || (e.employee_no || '').toLowerCase().includes(q)
    ).slice(0, 50)
  }, [empSearch, employees])

  const grouped = useMemo(() => {
    const byGroup = {}
    for (const f of ADJUSTMENT_EDIT_FIELDS) {
      // Hide edit-only fields when creating
      if (f.editOnly && !isEdit) continue
      const g = f.group || 'General'
      if (!byGroup[g]) byGroup[g] = []
      byGroup[g].push(f)
    }
    return byGroup
  }, [isEdit])

  const handleSubmit = async (e) => {
    e.preventDefault()
    for (const f of ADJUSTMENT_EDIT_FIELDS) {
      if (!f.required) continue
      if (f.editOnly && !isEdit) continue
      const v = form[f.key]
      if (v === '' || v === null || v === undefined) {
        setError(`${f.label} is required.`)
        return
      }
    }
    setSaving(true); setError(null)
    try {
      const payload = {}
      for (const f of ADJUSTMENT_EDIT_FIELDS) {
        if (f.editOnly && !isEdit) continue
        payload[f.key] = toPayloadValue(form[f.key], f.type)
      }
      const saved = isEdit
        ? await payrollEngineService.updateAdjustment(adjustment.id, payload)
        : await payrollEngineService.createAdjustment(payload)
      onSaved?.(saved)
    } catch (err) {
      const data = err?.response?.data
      const msg = data?.detail
        || data?.error
        || (typeof data === 'object'
              ? Object.entries(data).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join(' · ')
              : null)
        || err.message
      setError(msg)
    } finally {
      setSaving(false)
    }
  }

  const renderInput = (field) => {
    const id = `adj-edit-${field.key}`
    const value = form[field.key]
    const baseCls =
      'w-full text-sm border border-slate-300 rounded-md px-2.5 py-1.5 ' +
      'focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 ' +
      'disabled:bg-slate-50 disabled:text-slate-500'

    if (field.type === 'employee') {
      const selected = employees.find((e) => String(e.id) === String(value))
      return (
        <div className="space-y-1">
          <input
            type="text"
            placeholder="Search by name or emp #…"
            value={empSearch}
            onChange={(e) => { setEmpSearch(e.target.value); setEmpSelected(false) }}
            className={baseCls}
          />
          {!empSelected && (
          <select
            id={id}
            value={value ?? ''}
            onChange={(e) => {
              handleChange(field.key, e.target.value)
              const emp = employees.find((em) => String(em.id) === String(e.target.value))
              if (emp){
                 setEmpSearch(`${emp.employee_no} · ${emp.full_name}`)
                 setEmpSelected(true)
              }
            }}
            className={baseCls}
            size={Math.min(6, Math.max(3, filteredEmployees.length))}
          >
            {selected && !filteredEmployees.some((e) => e.id === selected.id) && (
              <option value={selected.id}>
                {selected.employee_no} · {selected.full_name}
              </option>
            )}
            {filteredEmployees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.employee_no} · {e.full_name}
              </option>
            ))}
          </select>
          )}
        </div>
      )
    }

    if (field.type === 'component') {
      const options = resolveComponentOptions()
      return (
        <select
          id={id}
          value={value ?? ''}
          onChange={(e) => handleChange(field.key, e.target.value)}
          className={baseCls}
        >
          <option value="">— Select —</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      )
    }

    if (field.type === 'select') {
      const options = resolveOptions(field)
      return (
        <select
          id={id}
          value={value ?? ''}
          onChange={(e) => handleChange(field.key, e.target.value)}
          className={baseCls}
        >
          <option value="">— Select —</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      )
    }

    if (field.type === 'textarea') {
      return (
        <textarea
          id={id}
          rows={3}
          value={value ?? ''}
          onChange={(e) => handleChange(field.key, e.target.value)}
          className={baseCls}
        />
      )
    }

    return (
      <div className="relative">
        <input
          id={id}
          type={field.type || 'text'}
          step={field.type === 'number' ? (field.step || '0.01') : undefined}
          maxLength={field.maxLength}
          value={value ?? ''}
          onChange={(e) => handleChange(field.key, e.target.value)}
          className={`${baseCls} ${field.currency ? 'pr-12' : ''}`}
        />
        {field.currency && (
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-medium text-slate-400 uppercase">
            {PAYROLL_ENGINE_CURRENCY}
          </span>
        )}
      </div>
    )
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full max-w-3xl rounded-xl shadow-xl flex flex-col max-h-[90vh]"
      >
        <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <HeroIcons.AdjustmentsHorizontalIcon className="w-4 h-4 text-indigo-600" />
              {isEdit ? 'Edit Adjustment' : 'New Adjustment'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {isEdit
                ? `${adjustment.employee_name || ''} · ${adjustment.label || ''}`
                : 'Queue an earning or deduction for an upcoming payroll run.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700"
            aria-label="Close"
          >
            <HeroIcons.XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-4 overflow-y-auto space-y-5">
          {FIELD_GROUPS_ORDER.map((group) => (
            grouped[group]?.length ? (
              <fieldset key={group} className="space-y-2">
                <legend className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  {group}
                </legend>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3">
                  {grouped[group].map((field) => (
                    <div
                      key={field.key}
                      className={
                        field.type === 'textarea' || field.type === 'employee'
                          ? 'md:col-span-2'
                          : ''
                      }
                    >
                      <label
                        htmlFor={`adj-edit-${field.key}`}
                        className="block text-xs font-medium text-slate-600 mb-1"
                      >
                        {field.label}
                        {field.required && <span className="text-red-500 ml-0.5">*</span>}
                      </label>
                      {renderInput(field)}
                    </div>
                  ))}
                </div>
              </fieldset>
            ) : null
          ))}

          {error && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {error}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-slate-200 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-sm font-medium rounded-md border border-slate-300 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || (isEdit && !touched)}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving
              ? <HeroIcons.ArrowPathIcon className="w-4 h-4 animate-spin" />
              : <HeroIcons.CheckIcon className="w-4 h-4" />}
            {saving ? 'Saving…' : (isEdit ? 'Save Changes' : 'Create Adjustment')}
          </button>
        </div>
      </form>
    </div>
  )
}
