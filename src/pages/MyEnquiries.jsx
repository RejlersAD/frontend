import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { InboxIcon, PlusIcon, ArrowPathIcon, XMarkIcon } from '@heroicons/react/24/outline'
import apiService from '../services/api.service'

const TYPES = [
  ['general', 'General Inquiry'], ['technical_support', 'Technical Support'],
  ['complaint', 'Complaint'], ['suggestion', 'Suggestion'], ['partnership', 'Partnership'],
  ['legal', 'Legal'], ['hr', 'HR'], ['it_request', 'IT Request'],
  ['finance_request', 'Finance Request'], ['procurement', 'Procurement'],
  ['facility_request', 'Facility Request'], ['other', 'Other'],
]

const EMPTY_FORM = { inquiry_type: 'general', subject: '', message: '', urgency: 'normal', phone: '', company: '' }
const statusTone = {
  new: 'bg-blue-100 text-blue-800', assigned: 'bg-cyan-100 text-cyan-800',
  in_progress: 'bg-amber-100 text-amber-800', waiting_user: 'bg-violet-100 text-violet-800',
  responded: 'bg-purple-100 text-purple-800', resolved: 'bg-emerald-100 text-emerald-800',
  escalated: 'bg-red-100 text-red-800', pending_confirmation: 'bg-fuchsia-100 text-fuchsia-800',
  reopened: 'bg-orange-100 text-orange-800',
  closed: 'bg-slate-200 text-slate-700', spam: 'bg-slate-200 text-slate-700',
}

const dateText = (value) => value ? new Date(value).toLocaleString() : '—'

export default function MyEnquiries () {
  const navigate = useNavigate()
  const auth = useSelector((state) => state.auth?.user)
  const user = auth?.user || auth || {}
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await apiService.get('/enquiry/mine/')
      setItems(data?.results || [])
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const stats = useMemo(() => ({
    total: items.length,
    active: items.filter((row) => !['resolved', 'closed', 'spam'].includes(row.status)).length,
    responses: items.filter((row) => ['responded', 'resolved', 'closed'].includes(row.status)).length,
  }), [items])

  const open = (row) => navigate(`/my-enquiries/${row.id}`)

  const submit = async (event) => {
    event.preventDefault()
    setSaving(true)
    try {
      await apiService.post('/enquiry/submit/', {
        ...form,
        service: form.inquiry_type,
        name: user.full_name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username || 'RADAI User',
        email: user.email,
      })
      setForm(EMPTY_FORM)
      setCreating(false)
      await load()
    } catch (error) {
      alert(error?.response?.data?.message || 'Could not submit the request.')
    } finally { setSaving(false) }
  }

  return (
    <div className="w-full min-w-0 bg-slate-50 px-4 py-5 sm:px-6">
      <div className="rounded-2xl bg-gradient-to-r from-slate-950 to-blue-900 p-6 text-white">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div><h1 className="text-2xl font-bold">My Requests</h1><p className="mt-1 text-sm text-blue-100">Create, track and respond to your RADAI enquiries.</p></div>
          <div className="flex gap-2">
            <button onClick={load} className="rounded-lg border border-white/20 p-2"><ArrowPathIcon className="h-5 w-5" /></button>
            <button onClick={() => setCreating(true)} className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-bold text-blue-900"><PlusIcon className="h-4 w-4" />New request</button>
          </div>
        </div>
      </div>

      <div className="my-5 grid gap-3 sm:grid-cols-3">
        {[['All requests', stats.total], ['Active', stats.active], ['Responded / completed', stats.responses]].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-4"><div className="text-2xl font-bold text-slate-900">{value}</div><div className="text-xs text-slate-500">{label}</div></div>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? <div className="p-12 text-center text-slate-500">Loading requests…</div> : items.length === 0 ? (
          <div className="p-12 text-center"><InboxIcon className="mx-auto h-10 w-10 text-slate-300" /><p className="mt-3 font-semibold">No requests yet</p><button onClick={() => setCreating(true)} className="mt-3 text-sm font-semibold text-blue-600">Create your first request</button></div>
        ) : (
          <div className="divide-y divide-slate-100">{items.map((row) => (
            <button key={row.id} onClick={() => open(row)} className="grid w-full grid-cols-1 gap-2 p-4 text-left hover:bg-slate-50 md:grid-cols-[130px_1fr_180px_140px]">
              <span className="font-mono text-xs text-slate-500">{row.reference}</span>
              <span><strong className="block text-sm text-slate-900">{row.subject}</strong><span className="text-xs text-slate-500">{row.department || 'Routing pending'} · {row.inquiry_type_label}</span></span>
              <span className="text-xs text-slate-500">{dateText(row.updated_at)}</span>
              <span className={`w-fit rounded-full px-2 py-1 text-xs font-semibold ${statusTone[row.status] || 'bg-slate-100'}`}>{row.status.replaceAll('_', ' ')}</span>
            </button>
          ))}</div>
        )}
      </div>

      {creating && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"><form onSubmit={submit} className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex justify-between"><div><h2 className="text-xl font-bold">Create a request</h2><p className="text-sm text-slate-500">Your request will be routed automatically.</p></div><button type="button" onClick={() => setCreating(false)}><XMarkIcon className="h-5 w-5" /></button></div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="text-xs font-semibold text-slate-600">Inquiry type<select value={form.inquiry_type} onChange={(e) => setForm({...form, inquiry_type:e.target.value})} className="mt-1 w-full rounded-lg border p-3 text-sm">{TYPES.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="text-xs font-semibold text-slate-600">Urgency<select value={form.urgency} onChange={(e) => setForm({...form, urgency:e.target.value})} className="mt-1 w-full rounded-lg border p-3 text-sm"><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></label>
          <label className="text-xs font-semibold text-slate-600">Phone<input required value={form.phone} onChange={(e) => setForm({...form,phone:e.target.value})} className="mt-1 w-full rounded-lg border p-3 text-sm" /></label>
          <label className="text-xs font-semibold text-slate-600">Company<input value={form.company} onChange={(e) => setForm({...form,company:e.target.value})} className="mt-1 w-full rounded-lg border p-3 text-sm" /></label>
          <label className="sm:col-span-2 text-xs font-semibold text-slate-600">Subject<input required minLength="5" value={form.subject} onChange={(e) => setForm({...form,subject:e.target.value})} className="mt-1 w-full rounded-lg border p-3 text-sm" /></label>
          <label className="sm:col-span-2 text-xs font-semibold text-slate-600">Request details<textarea required minLength="10" rows="6" value={form.message} onChange={(e) => setForm({...form,message:e.target.value})} className="mt-1 w-full rounded-lg border p-3 text-sm" /></label>
        </div><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setCreating(false)} className="rounded-lg border px-4 py-2 text-sm">Cancel</button><button disabled={saving} className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-bold text-white disabled:opacity-50">Submit request</button></div>
      </form></div>}

    </div>
  )
}
