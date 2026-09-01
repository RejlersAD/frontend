import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import {
  ArrowPathIcon, ArrowRightIcon, CheckCircleIcon, ChevronRightIcon, ClockIcon,
  DocumentTextIcon, ExclamationTriangleIcon, InboxIcon, MagnifyingGlassIcon,
  PlusIcon, SparklesIcon, XMarkIcon,
} from '@heroicons/react/24/outline'
import apiService from '../services/api.service'

const TYPES = [
  ['general', 'General inquiry'], ['technical_support', 'Technical support'],
  ['complaint', 'Complaint'], ['suggestion', 'Suggestion'], ['partnership', 'Partnership'],
  ['legal', 'Legal'], ['hr', 'HR'], ['it_request', 'IT request'],
  ['finance_request', 'Finance request'], ['procurement', 'Procurement'],
  ['facility_request', 'Facility request'], ['other', 'Other'],
]
const EMPTY_FORM = { inquiry_type: 'general', subject: '', message: '', urgency: 'normal', phone: '', company: '' }
const CLOSED_STATUSES = ['resolved', 'closed', 'spam']
const RESPONSE_STATUSES = ['responded', 'resolved', 'closed']
const ATTENTION_STATUSES = ['waiting_user', 'pending_confirmation']
const STATUS_OPTIONS = [
  ['all', 'All statuses'], ['new', 'New'], ['assigned', 'Assigned'], ['in_progress', 'In progress'],
  ['waiting_user', 'Waiting for me'], ['responded', 'Responded'], ['pending_confirmation', 'Confirmation needed'],
  ['resolved', 'Resolved'], ['closed', 'Closed'], ['escalated', 'Escalated'], ['reopened', 'Reopened'],
]
const statusTone = {
  new: 'border-blue-200 bg-blue-50 text-blue-700', assigned: 'border-cyan-200 bg-cyan-50 text-cyan-700',
  in_progress: 'border-amber-200 bg-amber-50 text-amber-700', waiting_user: 'border-violet-200 bg-violet-50 text-violet-700',
  responded: 'border-indigo-200 bg-indigo-50 text-indigo-700', resolved: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  escalated: 'border-red-200 bg-red-50 text-red-700', pending_confirmation: 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700',
  reopened: 'border-orange-200 bg-orange-50 text-orange-700', closed: 'border-slate-200 bg-slate-100 text-slate-600',
  spam: 'border-slate-200 bg-slate-100 text-slate-600',
}
const priorityTone = { urgent: 'text-red-700', high: 'text-orange-700', normal: 'text-slate-600', low: 'text-slate-400' }
const titleCase = (value = '') => value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
const dateText = (value) => value
  ? new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
  : '—'

export default function MyEnquiries () {
  const navigate = useNavigate()
  const auth = useSelector((state) => state.auth?.user)
  const user = auth?.user || auth || {}
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const { data } = await apiService.get('/enquiry/mine/')
      setItems(data?.results || [])
    } catch (error) {
      setLoadError(error?.response?.data?.message || 'We could not load your requests. Please try again.')
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const stats = useMemo(() => ({
    total: items.length,
    active: items.filter((row) => !CLOSED_STATUSES.includes(row.status)).length,
    attention: items.filter((row) => ATTENTION_STATUSES.includes(row.status)).length,
    completed: items.filter((row) => RESPONSE_STATUSES.includes(row.status)).length,
  }), [items])
  const filteredItems = useMemo(() => {
    const term = query.trim().toLowerCase()
    return items.filter((row) => {
      const matchesStatus = statusFilter === 'all' || row.status === statusFilter
      const content = [row.reference, row.subject, row.department, row.inquiry_type_label, row.status].join(' ').toLowerCase()
      return matchesStatus && (!term || content.includes(term))
    })
  }, [items, query, statusFilter])
  const open = (row) => navigate(`/my-enquiries/${row.id}`)

  const submit = async (event) => {
    event.preventDefault()
    setSaving(true)
    try {
      await apiService.post('/enquiry/submit/', {
        ...form, service: form.inquiry_type,
        name: user.full_name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username || 'RADAI User',
        email: user.email,
      })
      setForm(EMPTY_FORM)
      setCreating(false)
      await load()
    } catch (error) {
      window.alert(error?.response?.data?.message || 'Could not submit the request.')
    } finally { setSaving(false) }
  }
  const firstName = user.first_name || user.full_name?.split(' ')[0] || 'there'

  return (
    <main className="min-h-full w-full min-w-0 overflow-x-hidden bg-[#f6f8fc] px-4 py-5 font-sans sm:px-6 xl:px-8">
      <div className="mx-auto w-full max-w-[1600px]">
        <header className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_14px_38px_rgba(15,23,42,0.06)]">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-600 via-indigo-500 to-cyan-400" />
          <div className="flex flex-col gap-6 px-5 py-6 sm:px-7 lg:flex-row lg:items-center lg:justify-between lg:px-8">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-400"><span>Service desk</span><ChevronRightIcon className="h-3.5 w-3.5" /><span className="text-slate-600">My requests</span></div>
              <div className="mt-4 flex items-start gap-4">
                <span className="grid h-11 w-11 shrink-0 place-content-center rounded-xl bg-blue-50 text-blue-600 ring-1 ring-blue-100"><InboxIcon className="h-6 w-6" /></span>
                <div className="min-w-0"><h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">My Requests</h1><p className="mt-1 text-sm leading-6 text-slate-500">Welcome, {firstName}. Create, track and respond to every RADAI service request in one place.</p></div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button type="button" onClick={load} disabled={loading} title="Refresh requests" aria-label="Refresh requests" className="grid h-10 w-10 place-content-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"><ArrowPathIcon className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} /></button>
              <button type="button" onClick={() => setCreating(true)} className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-[0_8px_18px_-8px_rgba(37,99,235,0.8)] transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100"><PlusIcon className="h-4 w-4" />New request</button>
            </div>
          </div>
        </header>

        <section aria-label="Request summary" className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="All requests" value={stats.total} note="Lifetime total" icon={DocumentTextIcon} tone="blue" />
          <MetricCard label="Active" value={stats.active} note="Currently in progress" icon={ClockIcon} tone="amber" />
          <MetricCard label="Needs your attention" value={stats.attention} note="Reply or confirmation" icon={ExclamationTriangleIcon} tone="violet" />
          <MetricCard label="Responded / completed" value={stats.completed} note="Service response received" icon={CheckCircleIcon} tone="emerald" />
        </section>

        <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-5 lg:flex-row lg:items-end lg:justify-between">
            <div><div className="flex items-center gap-2"><SparklesIcon className="h-4 w-4 text-blue-600" /><h2 className="text-base font-bold text-slate-950">Request workspace</h2></div><p className="mt-1 text-xs text-slate-500">Review progress, open conversations and complete requested actions.</p></div>
            <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
              <label className="relative block min-w-0 sm:w-80"><span className="sr-only">Search requests</span><MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search reference, subject or department" className="h-10 w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100" /></label>
              <label><span className="sr-only">Filter by status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 sm:w-48">{STATUS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            </div>
          </div>
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-5 py-2.5 text-xs text-slate-500"><span>Showing <strong className="font-semibold text-slate-700">{filteredItems.length}</strong> of {items.length} requests</span>{(query || statusFilter !== 'all') && <button type="button" onClick={() => { setQuery(''); setStatusFilter('all') }} className="font-semibold text-blue-600 hover:text-blue-700">Clear filters</button>}</div>
          {loading ? <LoadingState /> : loadError ? <ErrorState message={loadError} retry={load} /> : filteredItems.length === 0 ? <EmptyState hasItems={items.length > 0} create={() => setCreating(true)} clear={() => { setQuery(''); setStatusFilter('all') }} /> : <RequestList rows={filteredItems} open={open} />}
        </section>
      </div>
      {creating && <CreateDialog form={form} setForm={setForm} saving={saving} close={() => setCreating(false)} submit={submit} />}
    </main>
  )
}

const toneMap = {
  blue: ['bg-blue-50 text-blue-600 ring-blue-100', 'text-blue-600'], amber: ['bg-amber-50 text-amber-600 ring-amber-100', 'text-amber-600'],
  violet: ['bg-violet-50 text-violet-600 ring-violet-100', 'text-violet-600'], emerald: ['bg-emerald-50 text-emerald-600 ring-emerald-100', 'text-emerald-600'],
}
const MetricCard = ({ label, value, note, icon: Icon, tone }) => <article className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:shadow-md"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold text-slate-500">{label}</p><p className="mt-2 text-3xl font-bold tracking-tight text-slate-950">{value}</p></div><span className={`grid h-10 w-10 place-content-center rounded-xl ring-1 ${toneMap[tone][0]}`}><Icon className="h-5 w-5" /></span></div><p className={`mt-3 text-[11px] font-medium ${toneMap[tone][1]}`}>{note}</p></article>

const RequestList = ({ rows, open }) => <><div className="hidden overflow-x-auto lg:block"><table className="w-full table-fixed text-left"><thead><tr className="border-b border-slate-200 bg-white text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400"><th className="w-[13%] px-5 py-3">Reference</th><th className="w-[37%] px-4 py-3">Request</th><th className="w-[15%] px-4 py-3">Priority</th><th className="w-[17%] px-4 py-3">Status</th><th className="w-[15%] px-4 py-3">Updated</th><th className="w-[3%] px-3 py-3"><span className="sr-only">Open</span></th></tr></thead><tbody className="divide-y divide-slate-100">{rows.map((row) => <tr key={row.id} onClick={() => open(row)} className="group cursor-pointer transition hover:bg-blue-50/40"><td className="px-5 py-4 align-middle"><span className="font-mono text-xs font-semibold text-blue-600">{row.reference}</span></td><td className="px-4 py-4"><strong className="block truncate text-sm font-semibold text-slate-900 group-hover:text-blue-700">{row.subject}</strong><span className="mt-1 block truncate text-xs text-slate-500">{row.department || 'Routing pending'} · {row.inquiry_type_label || titleCase(row.inquiry_type)}</span></td><td className={`px-4 py-4 text-xs font-semibold ${priorityTone[row.urgency] || priorityTone.normal}`}>{titleCase(row.urgency || 'normal')}</td><td className="px-4 py-4"><StatusBadge status={row.status} /></td><td className="px-4 py-4 text-xs text-slate-500">{dateText(row.updated_at)}</td><td className="px-3 py-4"><ArrowRightIcon className="h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-blue-600" /></td></tr>)}</tbody></table></div><div className="divide-y divide-slate-100 lg:hidden">{rows.map((row) => <button type="button" key={row.id} onClick={() => open(row)} className="block w-full p-4 text-left transition hover:bg-blue-50/40"><div className="flex items-start justify-between gap-3"><span className="font-mono text-xs font-semibold text-blue-600">{row.reference}</span><StatusBadge status={row.status} /></div><strong className="mt-2 block text-sm text-slate-900">{row.subject}</strong><span className="mt-1 block text-xs text-slate-500">{row.department || 'Routing pending'} · {row.inquiry_type_label || titleCase(row.inquiry_type)}</span><div className="mt-3 flex items-center justify-between text-xs"><span className={`font-semibold ${priorityTone[row.urgency] || priorityTone.normal}`}>{titleCase(row.urgency || 'normal')} priority</span><span className="text-slate-400">{dateText(row.updated_at)}</span></div></button>)}</div></>
const StatusBadge = ({ status }) => <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-bold ${statusTone[status] || 'border-slate-200 bg-slate-50 text-slate-600'}`}><span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />{titleCase(status)}</span>
const LoadingState = () => <div className="grid min-h-64 place-content-center text-center"><span className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-blue-100 border-t-blue-600" /><p className="mt-3 text-sm font-medium text-slate-500">Loading your requests…</p></div>
const ErrorState = ({ message, retry }) => <div className="grid min-h-64 place-content-center px-6 text-center"><span className="mx-auto grid h-11 w-11 place-content-center rounded-xl bg-red-50 text-red-600"><ExclamationTriangleIcon className="h-6 w-6" /></span><p className="mt-3 text-sm font-semibold text-slate-800">Could not load requests</p><p className="mt-1 max-w-md text-xs text-slate-500">{message}</p><button type="button" onClick={retry} className="mx-auto mt-4 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">Try again</button></div>
const EmptyState = ({ hasItems, create, clear }) => <div className="grid min-h-72 place-content-center px-6 text-center"><span className="mx-auto grid h-12 w-12 place-content-center rounded-2xl bg-slate-100 text-slate-400"><InboxIcon className="h-6 w-6" /></span><p className="mt-4 text-sm font-semibold text-slate-900">{hasItems ? 'No matching requests' : 'No requests yet'}</p><p className="mt-1 text-xs text-slate-500">{hasItems ? 'Try changing your search or status filter.' : 'Create your first request and we will route it to the right team.'}</p><button type="button" onClick={hasItems ? clear : create} className="mx-auto mt-4 text-xs font-semibold text-blue-600 hover:text-blue-700">{hasItems ? 'Clear filters' : 'Create your first request'}</button></div>

const CreateDialog = ({ form, setForm, saving, close, submit }) => {
  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }))
  const inputClass = 'mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100'
  return <div className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-slate-950/55 p-4 backdrop-blur-sm"><form onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="create-request-title" className="my-auto w-full max-w-2xl overflow-hidden rounded-2xl border border-white/20 bg-white shadow-[0_30px_90px_-20px_rgba(15,23,42,0.55)]"><div className="h-1 bg-gradient-to-r from-blue-600 via-indigo-500 to-cyan-400" /><div className="flex items-start justify-between border-b border-slate-200 px-6 py-5"><div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-blue-600">RADAI service desk</p><h2 id="create-request-title" className="mt-1 text-xl font-bold tracking-tight text-slate-950">Create a request</h2><p className="mt-1 text-sm text-slate-500">Your request will be categorized and routed automatically.</p></div><button type="button" onClick={close} aria-label="Close dialog" className="grid h-9 w-9 place-content-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"><XMarkIcon className="h-5 w-5" /></button></div><div className="grid gap-4 px-6 py-5 sm:grid-cols-2"><DialogField label="Request type"><select value={form.inquiry_type} onChange={update('inquiry_type')} className={inputClass}>{TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></DialogField><DialogField label="Priority"><select value={form.urgency} onChange={update('urgency')} className={inputClass}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></DialogField><DialogField label="Phone number" required><input type="tel" required value={form.phone} onChange={update('phone')} placeholder="+971 50 000 0000" className={inputClass} /></DialogField><DialogField label="Company" hint="Optional"><input value={form.company} onChange={update('company')} placeholder="Company or organisation" className={inputClass} /></DialogField><div className="sm:col-span-2"><DialogField label="Subject" required><input required minLength="5" maxLength="200" value={form.subject} onChange={update('subject')} placeholder="A short summary of your request" className={inputClass} /></DialogField></div><div className="sm:col-span-2"><DialogField label="Request details" required hint={`${form.message.length}/1000`}><textarea required minLength="10" maxLength="1000" rows="5" value={form.message} onChange={update('message')} placeholder="Describe what happened, what you need and any relevant dates or references." className={`${inputClass} resize-none`} /></DialogField></div></div><div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end"><button type="button" onClick={close} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">Cancel</button><button type="submit" disabled={saving} className="inline-flex min-w-36 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">{saving ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />Submitting</> : <>Submit request <ArrowRightIcon className="h-4 w-4" /></>}</button></div></form></div>
}
const DialogField = ({ label, required = false, hint, children }) => <label className="block text-xs font-semibold text-slate-700"><span className="flex items-center justify-between"><span>{label}{required && <span className="ml-1 text-red-500">*</span>}</span>{hint && <span className="font-normal text-slate-400">{hint}</span>}</span>{children}</label>
