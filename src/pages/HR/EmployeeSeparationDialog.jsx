import { useEffect, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { AlertTriangle, CheckCircle2, ExternalLink, LogOut, UserX, X } from 'lucide-react'
import apiClient from '../../services/api.service'

// Deactivate an employee for resignation or termination. The backend opens (or
// reuses) the offboarding case, sets the HR record, disables the login now or
// when offboarding completes, and notifies the HR team.
const TYPES = {
  resignation: {
    label: 'Resignation', icon: LogOut, noticeDays: 30, deactivateNow: false,
    description: 'Employee is leaving voluntarily. Access usually continues through the notice period.',
  },
  termination: {
    label: 'Termination', icon: UserX, noticeDays: 0, deactivateNow: true,
    description: 'Employment is ended by the company. Access is usually removed immediately.',
  },
}
const isoDate = (offsetDays = 0) => {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const errorText = error => {
  const data = error?.response?.data
  if (!data || typeof data === 'string') return 'The account could not be deactivated. Try again or contact support.'
  return Object.values(data).flat().map(String).join(' ') || 'The account could not be deactivated.'
}

export default function EmployeeSeparationDialog({ employee, employeeName, onClose, onDone }) {
  const dialog = useRef(null)
  const [type, setType] = useState('resignation')
  const [lastDay, setLastDay] = useState(isoDate(TYPES.resignation.noticeDays))
  const [reason, setReason] = useState('')
  const [deactivateNow, setDeactivateNow] = useState(TYPES.resignation.deactivateNow)
  const [accessTouched, setAccessTouched] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const userId = employee?.user?.id || employee?.user_id

  useEffect(() => { dialog.current?.querySelector('button, input, textarea')?.focus() }, [])
  useEffect(() => {
    const onKey = event => { if (event.key === 'Escape' && !saving) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, saving])

  const chooseType = next => {
    setType(next)
    setLastDay(isoDate(TYPES[next].noticeDays))
    if (!accessTouched) setDeactivateNow(TYPES[next].deactivateNow)
    setError('')
  }
  const needsReason = type === 'termination'
  const canSubmit = userId && lastDay && (!needsReason || reason.trim()) && !saving

  const submit = async event => {
    event.preventDefault()
    if (!canSubmit) return
    setSaving(true)
    setError('')
    try {
      const { data } = await apiClient.post('/onboarding/offboarding/separate/', {
        user_id: userId, separation_type: type, last_working_day: lastDay,
        reason: reason.trim(), deactivate_now: deactivateNow,
      })
      setResult(data)
      onDone?.(data)
    } catch (err) {
      setError(errorText(err))
    } finally {
      setSaving(false)
    }
  }

  const caseUrl = result?.offboarding?.id ? `/hr/onboarding?tab=offboarding&record_id=${result.offboarding.id}` : '/hr/onboarding?tab=offboarding'
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/40 p-4" onMouseDown={event => { if (event.target === event.currentTarget && !saving) onClose() }}>
      <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="separation-title"
        className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <header className="flex items-start gap-3 border-b border-slate-200 px-5 py-4">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-rose-50 text-rose-600"><UserX size={18} /></span>
          <div className="min-w-0 flex-1">
            <h2 id="separation-title" className="text-base font-semibold text-slate-900">Deactivate account</h2>
            <p className="truncate text-sm text-slate-500">{employeeName}</p>
          </div>
          <button type="button" onClick={onClose} disabled={saving} aria-label="Close" className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"><X size={18} /></button>
        </header>

        {result ? (
          <div className="space-y-4 px-5 py-5">
            <div className="flex items-start gap-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
              <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">{TYPES[type].label} recorded</p>
                <p className="mt-1">{result.account_active
                  ? 'The account stays active until the offboarding case is completed; it is then deactivated automatically.'
                  : 'The account is deactivated. The employee can no longer sign in.'}</p>
                <p className="mt-1">{result.offboarding_created ? 'An offboarding case was opened' : 'The existing offboarding case was updated'} and the HR team was notified.</p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <a href={caseUrl} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"><ExternalLink size={15} />Open offboarding case</a>
              <button type="button" onClick={onClose} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">Done</button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
              <fieldset>
                <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Separation type</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {Object.entries(TYPES).map(([id, meta]) => {
                    const Icon = meta.icon
                    const active = type === id
                    return (
                      <label key={id} className={`flex cursor-pointer gap-2.5 rounded-lg border p-3 text-sm ${active ? (id === 'termination' ? 'border-rose-400 bg-rose-50' : 'border-blue-400 bg-blue-50') : 'border-slate-200 hover:bg-slate-50'}`}>
                        <input type="radio" name="separation-type" value={id} checked={active} onChange={() => chooseType(id)} className="sr-only" />
                        <Icon size={17} className={`mt-0.5 shrink-0 ${id === 'termination' ? 'text-rose-600' : 'text-blue-600'}`} />
                        <span><span className="block font-semibold text-slate-900">{meta.label}</span><span className="mt-0.5 block text-xs text-slate-500">{meta.description}</span></span>
                      </label>
                    )
                  })}
                </div>
              </fieldset>

              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-700">Last working day</span>
                <input type="date" required value={lastDay} onChange={event => setLastDay(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100" />
              </label>

              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-700">Reason {needsReason ? <span className="text-rose-600">(required)</span> : <span className="font-normal text-slate-400">(optional)</span>}</span>
                <textarea rows={3} maxLength={2000} value={reason} onChange={event => setReason(event.target.value)}
                  placeholder={needsReason ? 'Why is employment being terminated?' : 'Resignation note, for example the date it was received'}
                  className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100" />
              </label>

              <fieldset>
                <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Account access</legend>
                {[[true, 'Deactivate now', 'Sign-in is blocked immediately.'],
                  [false, 'Keep active until offboarding is completed', 'Access closes automatically when HR completes the offboarding case.']].map(([value, label, hint]) => (
                  <label key={label} className="mb-1.5 flex cursor-pointer items-start gap-2.5 rounded-lg border border-slate-200 p-2.5 text-sm hover:bg-slate-50">
                    <input type="radio" name="separation-access" checked={deactivateNow === value} onChange={() => { setDeactivateNow(value); setAccessTouched(true) }} className="mt-1" />
                    <span><span className="block font-medium text-slate-800">{label}</span><span className="block text-xs text-slate-500">{hint}</span></span>
                  </label>
                ))}
              </fieldset>

              <p className="flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-500" />
                This opens an offboarding case (or updates the open one) so clearance, equipment return and final settlement are tracked. The HR team is notified.
              </p>
              {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
              {!userId && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">This employee has no linked user account, so there is nothing to deactivate.</p>}
            </div>
            <footer className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3">
              <button type="button" onClick={onClose} disabled={saving} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
              <button type="submit" disabled={!canSubmit} className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50">
                {saving ? 'Saving…' : deactivateNow ? `Deactivate (${TYPES[type].label})` : `Record ${TYPES[type].label.toLowerCase()}`}
              </button>
            </footer>
          </form>
        )}
      </div>
    </div>
  )
}

EmployeeSeparationDialog.propTypes = {
  employee: PropTypes.object.isRequired, employeeName: PropTypes.string,
  onClose: PropTypes.func.isRequired, onDone: PropTypes.func,
}
