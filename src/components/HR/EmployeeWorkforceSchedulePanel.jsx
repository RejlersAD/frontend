import { useCallback, useEffect, useState } from 'react'
import { ArrowPathIcon, CalendarDaysIcon, ClockIcon, PlusIcon } from '@heroicons/react/24/outline'
import hrFoundationService from '../../services/hrFoundation.service'

const EmployeeWorkforceSchedulePanel = ({ employee }) => {
  const [employeeId, setEmployeeId] = useState('')
  const [assignments, setAssignments] = useState([])
  const [overtime, setOvertime] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ work_date: new Date().toISOString().slice(0, 10), requested_hours: 1, reason: '' })

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const resolved = employee?.employee_master_id ? { id: employee.employee_master_id } : await hrFoundationService.resolveEmployee(employee?.user?.id || employee?.id)
      setEmployeeId(resolved.id)
      const [shiftRows, overtimeRows] = await Promise.all([
        hrFoundationService.getShiftAssignments({ employee: resolved.id }),
        hrFoundationService.getOvertimeRequests({ employee: resolved.id }),
      ])
      setAssignments(shiftRows); setOvertime(overtimeRows)
    } catch (requestError) { setError(requestError?.response?.data?.detail || 'Schedule and overtime records could not be loaded.') }
    finally { setLoading(false) }
  }, [employee?.employee_master_id, employee?.id, employee?.user?.id])

  useEffect(() => { load() }, [load])

  const submit = async (event) => {
    event.preventDefault(); setSaving(true); setError('')
    try { await hrFoundationService.createOvertimeRequest({ ...form, employee: employeeId }); setForm({ work_date: new Date().toISOString().slice(0, 10), requested_hours: 1, reason: '' }); await load() }
    catch (requestError) { setError(requestError?.response?.data ? JSON.stringify(requestError.response.data) : 'Overtime request could not be submitted.') }
    finally { setSaving(false) }
  }

  if (loading) return <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white p-10 text-sm text-slate-500"><ArrowPathIcon className="h-4 w-4 animate-spin" /> Loading shifts and overtime…</div>

  return <div className="mx-auto w-full max-w-5xl space-y-5">
    {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between border-b border-slate-100 pb-3"><div><h3 className="text-sm font-bold text-slate-950">Published shift roster</h3><p className="text-xs text-slate-500">Upcoming and historical scheduled shifts</p></div><CalendarDaysIcon className="h-5 w-5 text-blue-700" /></div><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{assignments.length ? assignments.map((item) => <article key={item.id} className="rounded-lg border border-slate-200 p-3"><div className="flex items-center justify-between"><span className="text-xs font-bold text-blue-700">{item.date}</span><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600">{item.status}</span></div><p className="mt-2 font-semibold text-slate-900">{item.shift_name}</p><p className="mt-1 text-xs text-slate-500">{item.shift_code?.toUpperCase()} · {item.location || 'Default location'}</p></article>) : <p className="py-6 text-sm text-slate-400">No shift assignments have been published.</p>}</div></section>
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-2 border-b border-slate-100 pb-3"><ClockIcon className="h-5 w-5 text-violet-700" /><div><h3 className="text-sm font-bold text-slate-950">Overtime approval</h3><p className="text-xs text-slate-500">Recorded overtime is payroll-eligible only after workflow approval.</p></div></div><div className="mt-4 space-y-2">{overtime.map((item) => <div key={item.id} className="grid items-center gap-2 rounded-lg bg-slate-50 p-3 text-sm sm:grid-cols-[120px_90px_1fr_auto]"><span className="font-semibold">{item.work_date}</span><span>{item.requested_hours} hours</span><span className="truncate text-slate-600">{item.reason}</span><span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${item.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : item.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{item.status}{item.current_stage ? ` · ${item.current_stage}` : ''}</span></div>)}</div><form onSubmit={submit} className="mt-5 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-[160px_110px_1fr_auto]"><input type="date" value={form.work_date} onChange={(e) => setForm({ ...form, work_date: e.target.value })} required className="rounded-lg border border-slate-300 px-3 py-2 text-sm" /><input type="number" min="0.25" max="24" step="0.25" value={form.requested_hours} onChange={(e) => setForm({ ...form, requested_hours: Number(e.target.value) })} required className="rounded-lg border border-slate-300 px-3 py-2 text-sm" /><input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} required placeholder="Business reason for overtime" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" /><button disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"><PlusIcon className="h-4 w-4" /> Submit</button></form></section>
  </div>
}

export default EmployeeWorkforceSchedulePanel
