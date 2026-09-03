import { useCallback, useEffect, useMemo, useState } from 'react'
import * as HeroIcons from '@heroicons/react/24/outline'
import hrFoundationService from '../../services/hrFoundation.service'

const TYPES = [
  ['expense', 'Expense', 'Receipt, amount and business purpose', 'ReceiptPercentIcon'],
  ['travel', 'Travel', 'Business trip and travel authorization', 'PaperAirplaneIcon'],
  ['asset', 'Asset', 'Laptop, phone, software or other equipment', 'ComputerDesktopIcon'],
  ['hr_helpdesk', 'HR Helpdesk', 'HR letters, benefits and policy support', 'LifebuoyIcon'],
]
const EMPTY = { request_type: 'expense', title: '', description: '', amount: '', currency: 'AED', destination: '', start_date: '', end_date: '', category: '', priority: 'normal' }

const statusTone = (status) => ({
  pending: 'bg-amber-50 text-amber-700', approved: 'bg-blue-50 text-blue-700',
  fulfilled: 'bg-emerald-50 text-emerald-700', rejected: 'bg-rose-50 text-rose-700',
  cancelled: 'bg-slate-100 text-slate-600', in_progress: 'bg-violet-50 text-violet-700',
}[status] || 'bg-slate-100 text-slate-600')

export default function EmployeeServiceRequestsPanel({ employeeIdentifier }) {
  const [employee, setEmployee] = useState(null)
  const [requests, setRequests] = useState([])
  const [form, setForm] = useState(EMPTY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    if (!employeeIdentifier) return
    setLoading(true)
    try {
      const resolved = await hrFoundationService.resolveEmployee(employeeIdentifier)
      setEmployee(resolved)
      setRequests(await hrFoundationService.getServiceRequests())
    } catch (error) {
      setMessage(error?.response?.data?.detail || 'Could not load employee requests.')
    } finally { setLoading(false) }
  }, [employeeIdentifier])

  useEffect(() => { load() }, [load])
  const approvals = useMemo(() => requests.filter((item) => item.can_approve), [requests])

  const submit = async (event) => {
    event.preventDefault()
    if (!employee) return
    setSaving(true); setMessage('')
    try {
      const data = { ...form, employee: employee.id }
      if (form.request_type !== 'expense') delete data.amount
      if (form.request_type !== 'travel') { delete data.destination; delete data.start_date; delete data.end_date }
      await hrFoundationService.createServiceRequest(data)
      setForm(EMPTY); setMessage('Request submitted successfully.'); await load()
    } catch (error) {
      const data = error?.response?.data
      setMessage(typeof data === 'string' ? data : JSON.stringify(data || { detail: 'Request could not be submitted.' }))
    } finally { setSaving(false) }
  }

  const decide = async (item, decision) => {
    const note = decision === 'reject' ? window.prompt('Enter the rejection reason') : ''
    if (decision === 'reject' && !note) return
    try { await hrFoundationService.decideServiceRequest(item.id, decision, note); await load() }
    catch (error) { setMessage(error?.response?.data?.detail || `Could not ${decision} request.`) }
  }

  if (loading) return <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500">Loading your service workspace…</div>
  return (
    <div className="space-y-5">
      {message && <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">{message}</div>}
      {approvals.length > 0 && (
        <section className="rounded-2xl border border-amber-200 bg-white shadow-sm">
          <div className="border-b border-amber-100 px-5 py-4"><h3 className="font-semibold text-slate-900">Manager approval inbox</h3><p className="text-xs text-slate-500">Requests from your team requiring action</p></div>
          <div className="divide-y divide-slate-100">{approvals.map((item) => <RequestRow key={item.id} item={item} onDecide={decide} />)}</div>
        </section>
      )}
      <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
        <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="font-semibold text-slate-900">Create a request</h3>
          <div className="mt-4 grid grid-cols-2 gap-2">{TYPES.map(([id, label, , icon]) => { const Icon = HeroIcons[icon]; return <button type="button" key={id} onClick={() => setForm({ ...EMPTY, request_type: id })} className={`rounded-xl border p-3 text-left text-sm ${form.request_type === id ? 'border-blue-500 bg-blue-50 text-blue-800' : 'border-slate-200'}`}><Icon className="mb-2 h-5 w-5" />{label}</button> })}</div>
          <div className="mt-4 space-y-3">
            <input required placeholder="Request title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <textarea required rows={3} placeholder="Business reason and details" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <div className="grid grid-cols-2 gap-3"><input placeholder="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" /><select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm"><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option><option value="low">Low</option></select></div>
            {form.request_type === 'expense' && <div className="grid grid-cols-[1fr_90px] gap-3"><input required min="0.01" step="0.01" type="number" placeholder="Amount" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" /><input maxLength={3} value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" /></div>}
            {form.request_type === 'travel' && <><input required placeholder="Destination" value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /><div className="grid grid-cols-2 gap-3"><input required type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" /><input required type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" /></div></>}
            <button disabled={saving} className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Submitting…' : 'Submit request'}</button>
          </div>
        </form>
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4"><h3 className="font-semibold text-slate-900">Request tracker</h3><p className="text-xs text-slate-500">Your requests and visible team requests</p></div>
          {requests.length ? <div className="divide-y divide-slate-100">{requests.map((item) => <RequestRow key={item.id} item={item} onDecide={decide} />)}</div> : <div className="p-10 text-center text-sm text-slate-500">No requests yet.</div>}
        </section>
      </div>
    </div>
  )
}

function RequestRow({ item, onDecide }) {
  return <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"><div><div className="flex items-center gap-2"><span className="font-medium text-slate-900">{item.title}</span><span className={`rounded-full px-2 py-0.5 text-xs ${statusTone(item.status)}`}>{item.status?.replaceAll('_', ' ')}</span></div><div className="mt-1 text-xs text-slate-500">{item.request_number} · {item.employee_name} · {item.request_type?.replaceAll('_', ' ')}{item.current_stage ? ` · ${item.current_stage}` : ''}</div></div>{item.can_approve && <div className="flex gap-2"><button onClick={() => onDecide(item, 'reject')} className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-700">Reject</button><button onClick={() => onDecide(item, 'approve')} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white">Approve</button></div>}</div>
}
