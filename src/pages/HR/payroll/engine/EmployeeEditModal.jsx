/**
 * Schema-driven editor for a single PayrollEmployee. Every input is
 * generated from `EMPLOYEE_EDIT_FIELDS` in payrollEngine.config — add a
 * field there and it appears here automatically.
 *
 * Backend write permission is enforced by `PayrollEmployeeWritePermission`,
 * so this modal is also gated by `canEditPayrollEmployee` on the parent.
 */
import React, { useEffect, useMemo, useState } from 'react'
import * as HeroIcons from '@heroicons/react/24/outline'
import payrollEngineService from '../../../../services/payrollEngine.service'
import {
  EMPLOYEE_EDIT_FIELDS,
  PAYROLL_ENGINE_CURRENCY,
} from '../../../../config/payrollEngine.config'

const toFormValue = (raw, type) => {
  if (raw === null || raw === undefined) {
    if (type === 'checkbox') return false
    return ''
  }
  if (type === 'date' && typeof raw === 'string') return raw.slice(0, 10)
  return raw
}

const toPayloadValue = (val, type) => {
  if (type === 'checkbox') return !!val
  if (type === 'number') return val === '' || val === null ? null : val
  if (type === 'date') return val || null
  return val ?? ''
}

const FIELD_GROUPS_ORDER = (() => {
  const seen = new Set()
  const order = []
  for (const f of EMPLOYEE_EDIT_FIELDS) {
    const g = f.group || 'General'
    if (!seen.has(g)) { seen.add(g); order.push(g) }
  }
  return order
})()

export default function EmployeeEditModal({ employee, onClose, onSaved }) {
  const [form, setForm] = useState({})
  const [catalog, setCatalog] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [touched, setTouched] = useState(false)

  // Seed the form from the row whenever the modal opens for a new employee
  useEffect(() => {
    if (!employee) return
    const seeded = {}
    for (const f of EMPLOYEE_EDIT_FIELDS) {
      seeded[f.key] = toFormValue(employee[f.key], f.type)
    }
    setForm(seeded)
    setError(null)
    setTouched(false)
  }, [employee])

  // Hydrate select options that read from /catalog/ (e.g. payment_modes)
  useEffect(() => {
    if (catalog) return
    const needsCatalog = EMPLOYEE_EDIT_FIELDS.some((f) => f.optionsFrom)
    if (!needsCatalog) return
    payrollEngineService.getCatalog()
      .then(setCatalog)
      .catch(() => setCatalog({}))
  }, [catalog])

  const resolveOptions = (field) => {
    if (Array.isArray(field.options)) return field.options
    if (field.optionsFrom && catalog?.[field.optionsFrom]) {
      return catalog[field.optionsFrom].map((o) => ({
        value: o.code ?? o.value ?? o,
        label: o.label ?? o.name ?? o.code ?? String(o),
      }))
    }
    return []
  }

  const grouped = useMemo(() => {
    const byGroup = {}
    for (const f of EMPLOYEE_EDIT_FIELDS) {
      const g = f.group || 'General'
      if (!byGroup[g]) byGroup[g] = []
      byGroup[g].push(f)
    }
    return byGroup
  }, [])

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setTouched(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!employee?.id) return
    // Validation — required fields
    for (const f of EMPLOYEE_EDIT_FIELDS) {
      if (f.required && !f.readOnly) {
        const v = form[f.key]
        if (v === '' || v === null || v === undefined) {
          setError(`${f.label} is required.`)
          return
        }
      }
    }
    setSaving(true); setError(null)
    try {
      const payload = {}
      for (const f of EMPLOYEE_EDIT_FIELDS) {
        if (f.readOnly) continue
        payload[f.key] = toPayloadValue(form[f.key], f.type)
      }
      const updated = await payrollEngineService.updateEmployee(employee.id, payload)
      onSaved?.(updated)
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
    const id = `emp-edit-${field.key}`
    const value = form[field.key]
    const baseCls =
      'w-full text-sm border border-slate-300 rounded-md px-2.5 py-1.5 ' +
      'focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 ' +
      'disabled:bg-slate-50 disabled:text-slate-500'

    if (field.type === 'checkbox') {
      return (
        <label className="inline-flex items-center gap-2 text-sm text-slate-700">
          <input
            id={id}
            type="checkbox"
            checked={!!value}
            disabled={field.readOnly}
            onChange={(e) => handleChange(field.key, e.target.checked)}
            className="rounded"
          />
          {field.label}
        </label>
      )
    }

    if (field.type === 'select') {
      const options = resolveOptions(field)
      return (
        <select
          id={id}
          value={value ?? ''}
          disabled={field.readOnly}
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

    // datalist = freeform input with dropdown suggestions from catalog.
    // Allows HR to type a new value OR pick from existing entries.
    if (field.type === 'datalist') {
      const listId = `${id}-list`
      const suggestions = field.optionsFrom && catalog?.[field.optionsFrom]
        ? catalog[field.optionsFrom]
        : []
      return (
        <>
          <input
            id={id}
            type="text"
            list={listId}
            value={value ?? ''}
            disabled={field.readOnly}
            onChange={(e) => handleChange(field.key, e.target.value)}
            className={baseCls}
            placeholder="Type or select…"
          />
          <datalist id={listId}>
            {suggestions.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </>
      )
    }

    if (field.type === 'textarea') {
      return (
        <textarea
          id={id}
          rows={3}
          value={value ?? ''}
          disabled={field.readOnly}
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
          value={value ?? ''}
          readOnly={field.readOnly}
          disabled={field.readOnly}
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

  if (!employee) return null

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
        {/* Header */}
        <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <HeroIcons.PencilSquareIcon className="w-4 h-4 text-indigo-600" />
              Edit Employee
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {employee.full_name} · {employee.employee_no}
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

        {/* Body */}
        <div className="px-5 py-4 overflow-y-auto space-y-5">
          {FIELD_GROUPS_ORDER.map((group) => (
            <fieldset key={group} className="space-y-2">
              <legend className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                {group}
              </legend>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3">
                {grouped[group].map((field) => (
                  <div key={field.key} className={field.type === 'textarea' ? 'md:col-span-2' : ''}>
                    {field.type !== 'checkbox' && (
                      <label
                        htmlFor={`emp-edit-${field.key}`}
                        className="block text-xs font-medium text-slate-600 mb-1"
                      >
                        {field.label}
                        {field.required && <span className="text-red-500 ml-0.5">*</span>}
                      </label>
                    )}
                    {renderInput(field)}
                  </div>
                ))}
              </div>
            </fieldset>
          ))}

          {error && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
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
            disabled={saving || !touched}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving
              ? <HeroIcons.ArrowPathIcon className="w-4 h-4 animate-spin" />
              : <HeroIcons.CheckIcon className="w-4 h-4" />}
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  )
}
