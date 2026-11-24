import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import {
  ArrowPathIcon, ArrowRightIcon, CheckCircleIcon, ChevronRightIcon, ClockIcon,
  DocumentTextIcon, ExclamationTriangleIcon, InboxIcon, MagnifyingGlassIcon,
  PaperClipIcon, PlusIcon, SparklesIcon, XMarkIcon,
} from '@heroicons/react/24/outline'
import apiService from '../services/api.service'

const TYPES = [
  ['general', 'General inquiry'], ['technical_support', 'Technical support'],
  ['complaint', 'Complaint'], ['suggestion', 'Suggestion'], ['partnership', 'Partnership'],
  ['legal', 'Legal'], ['hr', 'HR'], ['talent_requisition', 'Talent Requisition'], ['it_request', 'IT request'],
  ['finance_request', 'Finance request'], ['procurement', 'Procurement'],
  ['facility_request', 'Facility request'], ['other', 'Other'],
]
const EMPTY_REQUISITION = {
  req_department: '', job_title: '', num_positions: '1', reason: 'new_position', reason_detail: '',
  justification: '', candidate: '', hiring_manager: '', target_join_date: '', proposed_salary: '',
}
const REQUISITION_REASONS = [
  ['new_position', 'New Position'], ['replacement', 'Replacement for a Departing Employee'],
  ['temporary', 'Temporary Position'], ['other', 'Other (Please Specify)'],
]
const EMPTY_FORM = { name: '', email: '', inquiry_type: 'general', subject: '', message: '', urgency: 'normal', phone: '', company: '', requisition: EMPTY_REQUISITION }
const requisitionMessage = (r) => [
  `Department/Division: ${r.req_department || '—'}`,
  `Position: ${r.job_title || '—'}`,
  `Number of Positions: ${r.num_positions || '1'}`,
  `Reason for Recruitment: ${(REQUISITION_REASONS.find(([v]) => v === r.reason) || [])[1] || r.reason}${r.reason_detail ? ` — ${r.reason_detail}` : ''}`,
  '',
  'Justification for Recruitment:',
  r.justification || '—',
  r.candidate ? `\nSelected Candidate: ${r.candidate}` : '',
  r.proposed_salary ? `Proposed Salary/Package: ${r.proposed_salary}` : '',
  r.target_join_date ? `Target Joining Date: ${r.target_join_date}` : '',
  `\nHiring Manager: ${r.hiring_manager || '—'}`,
].filter((line) => line !== '').join('\n')
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
  const user = useMemo(() => auth?.user || auth || {}, [auth])
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [attachments, setAttachments] = useState([])
  const [submitError, setSubmitError] = useState('')
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

  useEffect(() => {
    const identity = user.user || user
    const fallbackName = identity.full_name || `${identity.first_name || ''} ${identity.last_name || ''}`.trim() || identity.username || ''
    setForm((current) => ({
      ...current,
      name: current.name || fallbackName,
      email: current.email || identity.email || '',
      phone: current.phone || user.phone || '',
      company: current.company || user.organization_name || user.organization?.name || '',
    }))
    apiService.get('/rbac/users/me/', { params: { view: 'profile' } }).then(({ data }) => {
      const profileIdentity = data?.user || data || {}
      const profileName = profileIdentity.full_name || `${profileIdentity.first_name || ''} ${profileIdentity.last_name || ''}`.trim() || profileIdentity.username || fallbackName
      setForm((current) => ({
        ...current,
        name: profileName || current.name,
        email: profileIdentity.email || data?.email || current.email,
        phone: data?.phone || current.phone,
        company: data?.organization_name || data?.organization?.name || current.company,
      }))
    }).catch(() => {})
  }, [user])

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
    setSubmitError('')
    try {
      const payload = new FormData()
      const isRequisition = form.inquiry_type === 'talent_requisition'
      const entries = { ...form, service: form.inquiry_type }
      delete entries.requisition
      if (isRequisition) {
        const r = { ...EMPTY_REQUISITION, ...(form.requisition || {}) }
        entries.subject = form.subject || `Talent Requisition – ${r.job_title || 'New Position'} (${r.req_department || 'Department TBD'})`
        entries.message = form.message || requisitionMessage(r)
        entries.requisition = JSON.stringify(r)
      }
      Object.entries(entries).forEach(([key, value]) => payload.append(key, value || ''))
      attachments.forEach((file) => payload.append('attachments', file))
      await apiService.post('/enquiry/submit/', payload)
      setForm((current) => ({ ...EMPTY_FORM, name: current.name, email: current.email, phone: current.phone, company: current.company }))
      setAttachments([])
      setCreating(false)
      await load()
    } catch (error) {
      const fieldErrors = Object.values(error?.response?.data?.errors || {}).join(' ')
      setSubmitError(fieldErrors || error?.response?.data?.message || (error?.code === 'ECONNABORTED' ? 'The request timed out. Please try again.' : 'Could not submit the request.'))
    } finally { setSaving(false) }
  }
  const firstName = user.first_name || user.full_name?.split(' ')[0] || 'there'

  return (
    <main className="min-h-full w-full min-w-0 overflow-x-hidden bg-[#f6f8fc] px-4 py-5 font-sans sm:px-6 xl:px-8">
      <div className="mx-auto w-full max-w-4xl">
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
      {creating && <CreateDialog form={form} setForm={setForm} attachments={attachments} setAttachments={setAttachments} error={submitError} saving={saving} close={() => { setCreating(false); setSubmitError('') }} submit={submit} />}
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

const CreateDialog = ({ form, setForm, attachments, setAttachments, error, saving, close, submit }) => {
  const [fileError, setFileError] = useState('')
  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }))
  const inputClass = 'mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100'
  const addFiles = (event) => {
    const selected = Array.from(event.target.files || [])
    setFileError('')
    if (attachments.length + selected.length > 5) { setFileError('You can attach up to 5 files.'); return }
    const invalid = selected.find((file) => file.size > 10 * 1024 * 1024)
    if (invalid) { setFileError(`${invalid.name} exceeds the 10 MB limit.`); return }
    setAttachments((current) => [...current, ...selected])
    event.target.value = ''
  }
  return <div className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-slate-950/55 p-4 backdrop-blur-sm"><form onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="create-request-title" className="my-auto w-full max-w-3xl overflow-hidden rounded-2xl border border-white/20 bg-white shadow-[0_30px_90px_-20px_rgba(15,23,42,0.55)]"><div className="h-1 bg-gradient-to-r from-blue-600 via-indigo-500 to-cyan-400"/><div className="flex items-start justify-between border-b border-slate-200 px-6 py-5"><div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-blue-600">RADAI service desk</p><h2 id="create-request-title" className="mt-1 text-xl font-bold tracking-tight text-slate-950">Create a request</h2><p className="mt-1 text-sm text-slate-500">Your identity is filled from your employee profile.</p></div><button type="button" onClick={close} aria-label="Close dialog" className="grid h-9 w-9 place-content-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"><XMarkIcon className="h-5 w-5"/></button></div><div className="max-h-[72vh] overflow-y-auto px-6 py-5"><div className="mb-5 rounded-xl border border-blue-100 bg-blue-50/60 p-4"><div className="mb-3 text-[10px] font-bold uppercase tracking-[0.12em] text-blue-700">Requester profile</div><div className="grid gap-4 sm:grid-cols-2"><DialogField label="Requester name"><input readOnly value={form.name} className={`${inputClass} cursor-default bg-white/70 text-slate-600`}/></DialogField><DialogField label="Email address"><input readOnly type="email" value={form.email} className={`${inputClass} cursor-default bg-white/70 text-slate-600`}/></DialogField><DialogField label="Phone number" required><input type="tel" required value={form.phone} onChange={update('phone')} placeholder="Add phone number" className={inputClass}/></DialogField><DialogField label="Company / organization"><input value={form.company} onChange={update('company')} placeholder="Company or organization" className={inputClass}/></DialogField></div></div><div className="grid gap-4 sm:grid-cols-2"><DialogField label="Request type"><select value={form.inquiry_type} onChange={update('inquiry_type')} className={inputClass}>{TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></DialogField><DialogField label="Priority"><select value={form.urgency} onChange={update('urgency')} className={inputClass}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></DialogField>{form.inquiry_type === 'talent_requisition' && <div className="sm:col-span-2"><RequisitionFields form={form} setForm={setForm} inputClass={inputClass} /></div>}{form.inquiry_type !== 'talent_requisition' && <><div className="sm:col-span-2"><DialogField label="Subject" required><input required minLength="5" maxLength="200" value={form.subject} onChange={update('subject')} placeholder="A short summary of your request" className={inputClass}/></DialogField></div><div className="sm:col-span-2"><DialogField label="Request details" required hint={`${form.message.length}/1000`}><textarea required minLength="10" maxLength="1000" rows="5" value={form.message} onChange={update('message')} placeholder="Describe what happened, what you need and any relevant dates or references." className={`${inputClass} resize-none`}/></DialogField></div></>}<div className="sm:col-span-2"><DialogField label="Attachments" hint="Optional · up to 5 files · 10 MB each"><label className="mt-1.5 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm font-semibold text-slate-600 transition hover:border-blue-400 hover:bg-blue-50"><PaperClipIcon className="h-5 w-5 text-blue-600"/>Attach image or document<input type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.ppt,.pptx" onChange={addFiles} className="sr-only"/></label></DialogField>{attachments.length > 0 && <div className="mt-2 space-y-2">{attachments.map((file, index) => <div key={`${file.name}-${file.lastModified}`} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-xs"><span className="min-w-0 truncate text-slate-600">{file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB</span><button type="button" onClick={() => setAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="ml-3 text-red-500 hover:text-red-700">Remove</button></div>)}</div>}{fileError && <p className="mt-2 text-xs font-semibold text-red-600">{fileError}</p>}</div>{error && <div role="alert" className="sm:col-span-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}</div></div><div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end"><button type="button" onClick={close} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">Cancel</button><button type="submit" disabled={saving || !form.name || !form.email} className="inline-flex min-w-36 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">{saving ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"/>Submitting</> : <>Submit request <ArrowRightIcon className="h-4 w-4"/></>}</button></div></form></div>
}
const DialogField = ({ label, required = false, hint, children }) => <label className="block text-xs font-semibold text-slate-700"><span className="flex items-center justify-between"><span>{label}{required && <span className="ml-1 text-red-500">*</span>}</span>{hint && <span className="font-normal text-slate-400">{hint}</span>}</span>{children}</label>

const RequisitionFields = ({ form, setForm, inputClass }) => {
  const req = { ...EMPTY_REQUISITION, ...(form.requisition || {}) }
  const updateReq = (field) => (event) => setForm((current) => ({
    ...current,
    requisition: { ...EMPTY_REQUISITION, ...(current.requisition || {}), [field]: event.target.value },
  }))
  return <section className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4">
    <div className="mb-3 flex items-center justify-between gap-2">
      <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-indigo-700">Talent requisition</span>
      <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700">Requires HR approval</span>
    </div>
    <div className="grid gap-4 sm:grid-cols-2">
      <DialogField label="Department / Division" required><input required value={req.req_department} onChange={updateReq('req_department')} placeholder="e.g. Piping and Mechanical" className={inputClass}/></DialogField>
      <DialogField label="Position / Job Title" required><input required value={req.job_title} onChange={updateReq('job_title')} placeholder="e.g. Lead Rotating & Package Engineer" className={inputClass}/></DialogField>
      <DialogField label="Number of Positions" required><input required type="number" min="1" value={req.num_positions} onChange={updateReq('num_positions')} className={inputClass}/></DialogField>
      <DialogField label="Hiring Manager" required><input required value={req.hiring_manager} onChange={updateReq('hiring_manager')} placeholder="Name of hiring manager" className={inputClass}/></DialogField>
      <div className="sm:col-span-2"><DialogField label="Reason for Recruitment" required>
        <div className="mt-1.5 grid gap-2">{REQUISITION_REASONS.map(([value, labelText]) => <label key={value} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition ${req.reason === value ? 'border-indigo-400 bg-white text-indigo-700' : 'border-slate-200 bg-white/60 text-slate-600 hover:border-indigo-200'}`}><input type="radio" name="req-reason" value={value} checked={req.reason === value} onChange={updateReq('reason')} className="accent-indigo-600"/>{labelText}</label>)}</div>
      </DialogField></div>
      {(req.reason === 'replacement' || req.reason === 'other') && <div className="sm:col-span-2"><DialogField label={req.reason === 'replacement' ? 'Departing employee / replacement details' : 'Please specify'} required><input required value={req.reason_detail} onChange={updateReq('reason_detail')} placeholder={req.reason === 'replacement' ? 'e.g. Replacement for Rinson, leaving 09-11-2026' : 'Specify the reason'} className={inputClass}/></DialogField></div>}
      <div className="sm:col-span-2"><DialogField label="Justification for Recruitment" required><textarea required minLength="10" rows="4" value={req.justification} onChange={updateReq('justification')} placeholder="Why is this position essential? Include specific requirements of the role…" className={`${inputClass} resize-none`}/></DialogField></div>
      <div className="sm:col-span-2"><DialogField label="Selected Candidate (if identified)"><input value={req.candidate} onChange={updateReq('candidate')} placeholder="e.g. Mr. Juned Ahmed — NPCC Engineering, 16+ yrs, interviewed & offer accepted" className={inputClass}/></DialogField></div>
      <DialogField label="Proposed Salary / Package"><input value={req.proposed_salary} onChange={updateReq('proposed_salary')} placeholder="e.g. AED 22,000 / Month" className={inputClass}/></DialogField>
      <DialogField label="Target Joining Date"><input type="date" value={req.target_join_date} onChange={updateReq('target_join_date')} className={inputClass}/></DialogField>
    </div>
    <p className="mt-3 text-[11px] leading-5 text-slate-500">On submission this requisition is routed to Human Resources and requires department head approval before processing. The subject and description are generated automatically from the details above.</p>
  </section>
}


