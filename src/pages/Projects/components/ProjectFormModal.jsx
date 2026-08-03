import React, { useEffect, useMemo, useState } from 'react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import {
  PROJECT_FORM_SECTIONS,
  PROJECT_FORM_API_FIELDS,
  PROJECT_COPY,
} from '../../../config/projectControl.config'

const buildInitial = (project) => {
  const base = {}
  PROJECT_FORM_SECTIONS.forEach((section) => {
    section.fields.forEach((f) => {
      base[f.name] = f.defaultValue ?? ''
    })
  })
  if (project) {
    PROJECT_FORM_API_FIELDS.forEach((k) => {
      if (project[k] !== undefined && project[k] !== null) base[k] = project[k]
    })
  }
  return base
}

const stripBlanks = (values) => {
  const payload = {}
  PROJECT_FORM_API_FIELDS.forEach((k) => {
    const v = values[k]
    if (v === '' || v === null || v === undefined) return
    payload[k] = v
  })
  return payload
}

export default function ProjectFormModal({
  open,
  mode = 'create',          // 'create' | 'edit'
  project = null,
  onClose,
  onSubmit,                 // async (payload) => savedProject
}) {
  const initial = useMemo(() => buildInitial(project), [project])
  const [values, setValues] = useState(initial)
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})

  useEffect(() => {
    if (open) {
      setValues(initial)
      setServerError(null)
      setFieldErrors({})
    }
  }, [open, initial])

  if (!open) return null

  const setField = (name, value) => setValues((prev) => ({ ...prev, [name]: value }))

  const validate = () => {
    const errs = {}
    PROJECT_FORM_SECTIONS.forEach((s) =>
      s.fields.forEach((f) => {
        if (f.required && (values[f.name] === '' || values[f.name] === null || values[f.name] === undefined)) {
          errs[f.name] = `${f.label} is required`
        }
      })
    )
    if (values.start_date && values.end_date && values.end_date < values.start_date) {
      errs.end_date = 'End date must be after start date'
    }
    setFieldErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return
    setSubmitting(true)
    setServerError(null)
    try {
      await onSubmit(stripBlanks(values))
      onClose?.()
    } catch (err) {
      // DRF field-level error dict support
      const data = err?.response?.data
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        const fe = {}
        Object.entries(data).forEach(([k, v]) => {
          fe[k] = Array.isArray(v) ? v.join(', ') : String(v)
        })
        setFieldErrors((prev) => ({ ...prev, ...fe }))
        setServerError(data.detail || 'Please correct the highlighted fields.')
      } else {
        setServerError(err?.message || 'Failed to save project.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">
            {mode === 'edit' ? PROJECT_COPY.editTitle : PROJECT_COPY.createTitle}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded hover:bg-slate-100 text-slate-500"
            aria-label="Close"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="px-6 py-5 space-y-6">
            {serverError && (
              <div className="rounded border border-rose-200 bg-rose-50 text-rose-700 px-3 py-2 text-sm">
                {serverError}
              </div>
            )}

            {PROJECT_FORM_SECTIONS.map((section) => (
              <fieldset key={section.id} className="border-t border-slate-100 pt-4 first:border-0 first:pt-0">
                <legend className="text-sm font-semibold text-slate-700 mb-3">{section.title}</legend>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {section.fields.map((f) => (
                    <div
                      key={f.name}
                      className={f.colSpan === 3 ? 'sm:col-span-3' : f.colSpan === 2 ? 'sm:col-span-2' : ''}
                    >
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        {f.label} {f.required && <span className="text-rose-500">*</span>}
                      </label>
                      <FieldInput field={f} value={values[f.name]} onChange={(v) => setField(f.name, v)} />
                      {f.help && !fieldErrors[f.name] && (
                        <p className="mt-1 text-[11px] text-slate-400">{f.help}</p>
                      )}
                      {fieldErrors[f.name] && (
                        <p className="mt-1 text-[11px] text-rose-600">{fieldErrors[f.name]}</p>
                      )}
                    </div>
                  ))}
                </div>
              </fieldset>
            ))}
          </div>

          <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded disabled:opacity-60"
              disabled={submitting}
            >
              {submitting ? PROJECT_COPY.saving : PROJECT_COPY.saveProject}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function FieldInput({ field, value, onChange }) {
  const common = 'w-full rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'
  const v = value ?? ''
  switch (field.type) {
    case 'textarea':
      return (
        <textarea
          className={common}
          rows={field.rows || 3}
          placeholder={field.placeholder || ''}
          value={v}
          onChange={(e) => onChange(e.target.value)}
        />
      )
    case 'select':
      return (
        <select className={common} value={v} onChange={(e) => onChange(e.target.value)}>
          <option value="">— select —</option>
          {field.options?.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      )
    case 'date':
      return (
        <input
          type="date"
          className={common}
          value={v}
          onChange={(e) => onChange(e.target.value)}
        />
      )
    case 'number':
      return (
        <input
          type="number"
          className={common}
          min={field.min}
          max={field.max}
          step={field.step || 1}
          value={v}
          onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
        />
      )
    case 'currency':
      return (
        <input
          type="number"
          className={common}
          min={0}
          step="0.01"
          placeholder="0.00"
          value={v}
          onChange={(e) => onChange(e.target.value)}
        />
      )
    default:
      return (
        <input
          type="text"
          className={common}
          placeholder={field.placeholder || ''}
          value={v}
          onChange={(e) => onChange(e.target.value)}
        />
      )
  }
}
