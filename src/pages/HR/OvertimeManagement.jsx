import React, { useEffect, useRef, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { ClockIcon, PlusIcon, XMarkIcon } from '@heroicons/react/24/outline'
import service from '../../services/hrCore.service'
import { radaiConfirm } from '../../services/radaiDialog'

const errorText = (error) => {
  const data = error?.response?.data
  return typeof data === 'string' ? data : data ? Object.values(data).flat().join(' ') : error.message || 'Please try again.'
}
const statusText = (item) => item.status === 'pending' ? (item.stage_code === 'manager_review' ? 'Awaiting manager' : 'Awaiting HR / Finance') : item.status.charAt(0).toUpperCase() + item.status.slice(1)
const formatAED = value => `AED ${Number(value).toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fieldClass = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100'

function RequestDialog({ employees, onClose, onCreated }) {
  const dialog = useRef(null)
  const lock = useRef(false)
  const [form, setForm] = useState({ employee: employees.find(e => e.is_self)?.id || employees[0]?.id || '', reason: '', compensation_type: 'cash' })
  const [selectedDays, setSelectedDays] = useState({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { const el = dialog.current; const prior = document.activeElement; el.showModal(); return () => { el.close(); prior?.focus() } }, [])
  const submit = async (event) => {
    event.preventDefault()
    if (lock.current) return
    lock.current = true; setBusy(true); setError('')
    try { const result = await service.createOvertimeDays({ ...form, days: Object.entries(selectedDays).map(([work_date, requested_hours]) => ({ work_date, requested_hours })) }); onCreated(result.results[0]) }
    catch (failure) { setError(errorText(failure)); lock.current = false; setBusy(false) }
  }
  const [days, setDays] = useState([])
  const [daysLoading, setDaysLoading] = useState(false)
  useEffect(() => {
    let active = true
    setDays([]); setDaysLoading(true); setError('')
    setSelectedDays({})
    service.getOvertimeDays(form.employee).then(data => { if (active) setDays(data.days || []) })
      .catch(failure => { if (active) setError(errorText(failure)) })
      .finally(() => { if (active) setDaysLoading(false) })
    return () => { active = false }
  }, [form.employee])

  const change = (key) => (event) => setForm(old => ({ ...old, [key]: event.target.value }))
  return <dialog ref={dialog} aria-labelledby="ot-create-title" onCancel={(e) => { e.preventDefault(); if (!busy) onClose() }} className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl border border-slate-200 bg-white p-0 shadow-xl backdrop:bg-slate-900/40">
    <form onSubmit={submit}>
      <header className="flex items-center justify-between border-b border-slate-200 bg-indigo-50/50 px-5 py-4"><h2 id="ot-create-title" className="text-base font-semibold">Request overtime</h2><button type="button" disabled={busy} onClick={onClose} aria-label="Close overtime request"><XMarkIcon className="h-5 w-5" /></button></header>
      <div className="space-y-4 p-5">
        <label className="block text-sm">Employee<select autoFocus required value={form.employee} onChange={change('employee')} className={fieldClass}>{employees.map(e => <option key={e.id} value={e.id}>{e.name} ({e.code})</option>)}</select></label>
        <fieldset disabled={busy || daysLoading} className="space-y-2">
          <legend className="mb-2 text-sm">Recorded OT days</legend>
          <div className="max-h-60 space-y-2 overflow-y-auto rounded-lg border border-slate-200 p-3">
            {daysLoading ? <p className="text-sm text-slate-500">Loading timesheet...</p> : !days.length ? <p className="text-sm text-slate-500">No available OT days</p> : days.map(day => <div key={day.date} className="flex items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={day.date in selectedDays} disabled={!(day.date in selectedDays) && Object.keys(selectedDays).length >= 31} onChange={e => setSelectedDays(old => { const next = { ...old }; if (e.target.checked) next[day.date] = String(Math.min(24, Number(day.overtime_hours))); else delete next[day.date]; return next })} />{day.date} / {Number(day.overtime_hours)} OT hours</label>
              {day.date in selectedDays && <input aria-label={`Hours for ${day.date}`} required type="number" min="0.01" max={Math.min(24, Number(day.overtime_hours))} step="0.01" value={selectedDays[day.date]} onChange={e => setSelectedDays(old => ({ ...old, [day.date]: e.target.value }))} className="w-24 rounded-lg border border-slate-300 px-2 py-1 text-sm" />}
            </div>)}
          </div>
          {!!Object.keys(selectedDays).length && <p className="text-sm text-indigo-700">{Object.keys(selectedDays).length} days / {Object.values(selectedDays).reduce((sum, hours) => sum + Number(hours), 0).toFixed(2)} hours</p>}
        </fieldset>
        <label className="block text-sm">Type<select value={form.compensation_type} onChange={change('compensation_type')} className={fieldClass}><option value="cash">Encashment</option><option value="day_off">Off day</option></select></label><label className="block text-sm">Reason<textarea required rows={3} value={form.reason} onChange={change('reason')} className={fieldClass} /></label>
        {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
      </div>
      <footer className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4"><button type="button" disabled={busy} onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm">Cancel</button><button disabled={busy || daysLoading || !Object.keys(selectedDays).length} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{busy ? 'Submitting...' : 'Submit request'}</button></footer>
    </form>
  </dialog>
}

function BenefitDialog({ item, onClose, onApplied }) {
  const dialog = useRef(null)
  const lock = useRef(false)
  const [type, setType] = useState(item.compensation_type || '')
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7))
  const [multiplier, setMultiplier] = useState('1.25')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { const el = dialog.current; const prior = document.activeElement; el.showModal(); return () => { el.close(); prior?.focus() } }, [])
  const submit = async event => {
    event.preventDefault()
    if (lock.current) return
    lock.current = true; setBusy(true); setError('')
    try {
      const [year, month] = period.split('-').map(Number)
      onApplied(await service.applyOvertimeBenefit(item.id, { type, year, month, multiplier }))
    } catch (failure) { setError(errorText(failure)) }
    finally { lock.current = false; setBusy(false) }
  }
  return <dialog ref={dialog} onCancel={event => { event.preventDefault(); if (!busy) onClose() }} aria-labelledby="ot-benefit-title" className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-slate-200 bg-white p-0 shadow-xl backdrop:bg-slate-900/40">
    <form onSubmit={submit}>
      <header className="border-b border-slate-200 bg-indigo-50/40 p-5"><h2 id="ot-benefit-title" className="font-semibold">Apply approved OT</h2><p className="mt-1 text-sm">{item.employee_name} / {Number(item.approved_hours)} hours</p></header>
      <div className="space-y-4 p-5">
        <label className="block text-sm">Type<select required disabled={!!item.compensation_type} value={type} onChange={e => setType(e.target.value)} className={fieldClass}><option value="">Select type</option><option value="cash">Encashment</option><option value="day_off">Off day</option></select></label>
        <label className="block text-sm">{type === 'day_off' ? 'Credit period' : 'Payroll month'}<input required type="month" min={type === 'cash' ? new Date().toISOString().slice(0, 7) : '2000-01'} max="2100-12" value={period} onChange={e => setPeriod(e.target.value)} className={fieldClass} /></label>
        {type === 'cash' && <label className="block text-sm">OT multiplier<select value={multiplier} onChange={e => setMultiplier(e.target.value)} className={fieldClass}><option value="1.25">1.25x</option><option value="1.50">1.50x</option></select></label>}
        {type === 'day_off' && <p className="text-sm text-indigo-700">{Number(item.approved_hours) / 8} days added to annual leave</p>}
        {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
      </div>
      <footer className="flex justify-end gap-2 border-t border-slate-200 p-4"><button type="button" disabled={busy} onClick={onClose} className="rounded-lg border px-4 py-2 text-sm">Cancel</button><button disabled={busy || !type} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white disabled:opacity-40">{busy ? 'Applying...' : type === 'day_off' ? 'Add to annual leave' : 'Apply to monthly run'}</button></footer>
    </form>
  </dialog>
}

export default function OvertimeManagement({ reviewOnly = false }) {
  const [params] = useSearchParams()
  const [employees, setEmployees] = useState([])
  const [rows, setRows] = useState([])
  const [count, setCount] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState(() => params.get('ot_status') === 'pending' ? 'pending' : '')
  const [selected, setSelected] = useState(null)
  const [applying, setApplying] = useState(null)
  const [creating, setCreating] = useState(false)
  const [revision, setRevision] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [note, setNote] = useState('')
  const lock = useRef(false)
  useEffect(() => { if (reviewOnly) return; let active = true; service.getOvertimeEmployees().then(data => { if (active) setEmployees(data.employees || []) }).catch(e => { if (active) setError(errorText(e)) }); return () => { active = false } }, [reviewOnly])
  useEffect(() => {
    let active = true
    setLoading(true)
    const timer = setTimeout(() => service.getOvertimeRequests({ page, search, scope: reviewOnly ? undefined : 'mine', status: status || undefined }).then(data => {
      if (!active) return
      setRows(data.results || []); setCount(data.count || 0)
      if (!params.get('request')) setSelected(old => old || data.results?.[0] || null)
    }).catch(e => { if (active) setError(errorText(e)) }).finally(() => { if (active) setLoading(false) }), 250)
    return () => { active = false; clearTimeout(timer) }
  }, [page, search, status, revision, reviewOnly])
  useEffect(() => {
    const id = params.get('request'); let active = true
    if (id) service.getOvertimeRequest(id, { scope: reviewOnly ? undefined : 'mine' }).then(data => { if (active) setSelected(data) }).catch(e => { if (active) setError(errorText(e)) })
    return () => { active = false }
  }, [params, reviewOnly])
  const review = async (action) => {
    if (!reviewOnly || lock.current) return
    if (action === 'reject' && !note.trim()) { setError('Enter a rejection reason.'); return }
    lock.current = true; setBusy(true); setError('')
    try {
      if (!(await radaiConfirm(`${action === 'approve' ? 'Approve' : action === 'reject' ? 'Reject' : 'Cancel'} overtime for ${selected.employee_name}?`))) return
      const updated = await service.reviewOvertimeRequest(selected.id, action, note)
      setSelected(updated); setNote(''); setRevision(v => v + 1)
    } catch (failure) { setError(errorText(failure)) }
    finally { lock.current = false; setBusy(false) }
  }
  const pages = Math.max(1, Math.ceil(count / 10))
  return <div className="space-y-4 text-slate-900">
    <div className={reviewOnly ? "hidden" : "flex items-center justify-between gap-3"}><h2 className="flex items-center gap-2 text-lg font-semibold"><ClockIcon className="h-5 w-5 text-indigo-600" />Overtime</h2>{!reviewOnly && <button disabled={!employees.length} onClick={() => setCreating(true)} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-40"><PlusIcon className="h-4 w-4" />Request OT</button>}</div>
    {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
    <div className="grid min-w-0 items-start gap-5 xl:grid-cols-2">
      <section className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 p-5"><h2 className="text-base font-semibold">{reviewOnly ? 'All OT requests' : 'My OT requests'}</h2><input aria-label="Search overtime requests" placeholder="Search name or employee ID" value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} className={`${fieldClass} min-w-0 flex-1`} /><select aria-label="Overtime status" value={status} onChange={e => { setStatus(e.target.value); setPage(1) }} className="rounded-lg border border-slate-300 px-3 py-2 text-sm"><option value="">All requests</option><option value="pending">Awaiting approval</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="cancelled">Cancelled</option></select></div>
        <table className="w-full table-fixed text-left text-sm"><thead className="bg-slate-50 text-sm text-slate-500"><tr>{['Date', 'EmpID', 'Name', 'Requested hours', 'Type', reviewOnly ? 'Action' : 'Status'].map(title => <th key={title} className="p-3 font-medium">{title}</th>)}</tr></thead><tbody>{rows.map(row => <tr key={row.id} className={`border-t border-slate-100 ${selected?.id === row.id ? 'bg-indigo-50' : ''}`}><td className="break-words p-3">{row.work_date}{row.day_entries?.length > 1 && <span className="block text-xs text-slate-500">{row.day_entries.length} days</span>}</td><td className="break-words p-3">{row.employee_code}</td><td className="break-words p-3"><button onClick={() => { setSelected(row); setNote(''); setError('') }} className="text-left font-medium text-indigo-600">{row.employee_name}</button></td><td className="p-3">{Number(row.requested_hours)}</td><td className="break-words p-3">{row.compensation_type === 'cash' ? 'Encashment' : row.compensation_type === 'day_off' ? 'Off day' : 'Not selected'}</td><td className="break-words p-3">{row.application ? <span className="text-emerald-700">{row.application.method === 'cash' ? <>Applied to payroll<span className="block font-medium">{formatAED(row.application.amount)}</span></> : 'Added to annual leave'}</span> : reviewOnly && row.can_apply ? <button onClick={() => setApplying(row)} className="text-left font-medium text-indigo-600">{row.compensation_type === 'day_off' ? 'Add to annual leave' : 'Apply'}</button> : <span className="text-slate-500">{statusText(row)}</span>}</td></tr>)}</tbody></table>
        {loading ? <p className="p-5 text-sm text-slate-500">Loading...</p> : !rows.length && <p className="p-5 text-sm text-slate-500">No overtime requests.</p>}
        <footer className="flex items-center justify-between gap-2 border-t border-slate-200 p-3 text-xs text-slate-500"><span>{count} requests</span><div className="flex items-center gap-2"><button disabled={page <= 1 || loading} onClick={() => setPage(p => p - 1)} className="rounded-lg border px-2 py-1.5 disabled:opacity-40">Previous</button><span>{page} / {pages}</span><button disabled={page >= pages || loading} onClick={() => setPage(p => p + 1)} className="rounded-lg border px-2 py-1.5 disabled:opacity-40">Next</button></div></footer>
      </section>
      {selected && <section className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white"><header className="flex items-center gap-3 border-b border-slate-200 bg-indigo-50/30 p-5"><ClockIcon className="h-6 w-6 text-indigo-600" /><h2 className="text-base font-semibold">OT request</h2></header><div className="p-6">
        <div className="flex justify-between gap-3"><div><h3 className="text-base font-semibold">{selected.employee_name}</h3><p className="text-sm text-slate-500">{selected.employee_code}</p></div><button aria-label="Close overtime details" onClick={() => setSelected(null)} disabled={busy}><XMarkIcon className="h-5 w-5" /></button></div>
        <div className="my-5 grid grid-cols-2 gap-3 rounded-xl border border-indigo-100 bg-indigo-50/40 p-4 text-sm"><span>{selected.work_date}</span><span>{Number(selected.requested_hours)} hours</span><span className="col-span-2 text-indigo-700">{statusText(selected)}</span></div>
        {selected.application && <p className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{selected.application.method === 'cash' ? `Payroll ${selected.application.year}-${String(selected.application.month).padStart(2, '0')}: ${formatAED(selected.application.amount)}` : `${Number(selected.application.days)} days added to annual leave (${selected.application.year})`}</p>}
        {!!selected.day_entries?.length && <table className="mb-5 w-full text-left text-sm"><thead><tr className="border-b border-slate-200 text-slate-500"><th className="py-2 font-medium">Date</th><th className="py-2 text-right font-medium">Hours</th></tr></thead><tbody>{selected.day_entries.map(day => <tr key={day.work_date} className="border-b border-slate-100"><td className="py-2">{day.work_date}</td><td className="py-2 text-right">{Number(day.requested_hours)}</td></tr>)}</tbody></table>}
        <h3 className="mb-3 text-sm font-semibold">Request details</h3><p className="whitespace-pre-wrap break-words text-sm">{selected.reason}</p>
        <p className="mt-3 text-xs text-slate-500">Requested by {selected.requested_by_name}</p>
        <h3 className="mt-6 border-t border-slate-100 pt-5 text-sm font-semibold">Approval progress</h3><ol className="my-4 space-y-3">{(selected.history || []).map((event, i) => <li key={i} className="text-sm"><span className="capitalize">{event.action}</span> / {event.actor}<span className="block text-xs text-slate-500">{new Date(event.at).toLocaleString()}</span>{event.note && <p className="whitespace-pre-wrap">{event.note}</p>}</li>)}</ol>
        {reviewOnly && selected.can_review && <label className="block text-sm">Note<textarea rows={2} value={note} onChange={e => setNote(e.target.value)} className={fieldClass} /></label>}
        <div className="mt-3 flex gap-2">{reviewOnly && selected.can_review && <><button disabled={busy} onClick={() => review('approve')} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white disabled:opacity-50">Approve</button><button disabled={busy} onClick={() => review('reject')} className="rounded-lg border border-rose-200 px-4 py-2 text-sm text-rose-700 disabled:opacity-50">Reject</button></>}{reviewOnly && selected.can_cancel && <button disabled={busy} onClick={() => review('cancel')} className="rounded-lg border border-slate-300 px-4 py-2 text-sm disabled:opacity-50">Cancel request</button>}</div>
      </div></section>}
    </div>
    {applying && <BenefitDialog item={applying} onClose={() => setApplying(null)} onApplied={item => { setApplying(null); setSelected(item); setRevision(v => v + 1) }} />}
    {creating && <RequestDialog employees={employees} onClose={() => setCreating(false)} onCreated={item => { setCreating(false); setSelected(item); setPage(1); setRevision(v => v + 1) }} />}
  </div>
}

export function OvertimeReviewPage() {
  const [params] = useSearchParams()
  const next = new URLSearchParams(params)
  next.set('view', 'encashment')
  return <Navigate replace to={`/hr/leave?${next}`} />
}
