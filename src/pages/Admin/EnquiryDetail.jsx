import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeftIcon, BuildingOffice2Icon, CheckCircleIcon, ClockIcon,
  EnvelopeIcon, ExclamationTriangleIcon, MagnifyingGlassIcon, PaperAirplaneIcon,
  PaperClipIcon, PhoneIcon, TrashIcon, UserIcon, UsersIcon, XMarkIcon,
} from '@heroicons/react/24/outline'
import apiService from '../../services/api.service'
import './enquiry-typography.css'

const STATUS_OPTIONS = [
  ['new', 'New'], ['assigned', 'Assigned'], ['in_progress', 'In Progress'],
  ['waiting_user', 'Waiting for User'], ['responded', 'Responded'],
  ['escalated', 'Escalated'], ['reopened', 'Reopened'],
  ['pending_confirmation', 'Awaiting Resolution Confirmation'],
  ['resolved', 'Resolved'], ['closed', 'Closed'], ['spam', 'Spam'],
]
const URGENCY_OPTIONS = [['low', 'Low'], ['normal', 'Normal'], ['high', 'High'], ['urgent', 'Urgent']]
const STATUS_TONE = {
  new: 'bg-blue-50 text-blue-700', assigned: 'bg-cyan-50 text-cyan-700',
  in_progress: 'bg-amber-50 text-amber-700', waiting_user: 'bg-violet-50 text-violet-700',
  responded: 'bg-indigo-50 text-indigo-700', resolved: 'bg-emerald-50 text-emerald-700',
  escalated: 'bg-red-50 text-red-700', pending_confirmation: 'bg-fuchsia-50 text-fuchsia-700',
  reopened: 'bg-orange-50 text-orange-700',
  closed: 'bg-slate-100 text-slate-600', spam: 'bg-slate-100 text-slate-600',
}

const formatDate = (value) => value ? new Date(value).toLocaleString() : '—'
const titleCase = (value = '') => value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())

export default function EnquiryDetail () {
  const { id } = useParams()
  const navigate = useNavigate()
  const [enquiry, setEnquiry] = useState(null)
  const [representatives, setRepresentatives] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [reply, setReply] = useState('')
  const [internal, setInternal] = useState(false)
  const [notes, setNotes] = useState('')
  const [resolution, setResolution] = useState('')
  const [escalationOpen, setEscalationOpen] = useState(false)
  const [escalationReason, setEscalationReason] = useState('')
  const [actionError, setActionError] = useState('')
  const [employeePickerOpen, setEmployeePickerOpen] = useState(false)
  const [employeeSearch, setEmployeeSearch] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      // The ticket is the required resource. Representative options are
      // supplementary and must never prevent a valid ticket from rendering.
      const detailResponse = await apiService.get(`/enquiry/${id}/`)
      const record = detailResponse.data?.enquiry
      if (!record) throw new Error('The server returned an empty enquiry record.')
      setEnquiry(record)
      setNotes(record?.admin_notes || '')
      setResolution(record?.resolution_summary || '')
      apiService.get('/enquiry/representatives/', { timeout: 15000 })
        .then(({ data }) => setRepresentatives(data?.results || []))
        .catch(() => setRepresentatives(record?.assigned_to ? [record.assigned_to] : []))
    } catch (requestError) {
      const status = requestError?.response?.status
      setError(requestError?.response?.data?.detail || (
        status === 404 ? 'This enquiry no longer exists.'
          : status === 403 ? 'You do not have access to this enquiry.'
            : requestError?.code === 'ECONNABORTED' ? 'The enquiry request timed out. Please retry.'
              : requestError?.message || 'Could not load this enquiry.'
      ))
    } finally { setLoading(false) }
  }, [id])

  useEffect(() => { load() }, [load])

  const patch = async (changes) => {
    setSaving(true)
    try {
      const { data } = await apiService.patch(`/enquiry/${id}/`, changes)
      setEnquiry(data?.enquiry)
      setNotes(data?.enquiry?.admin_notes || '')
      return true
    } catch (requestError) {
      alert(requestError?.response?.data?.message || 'Update failed.')
      return false
    } finally { setSaving(false) }
  }

  const send = async () => {
    if (!reply.trim()) return
    setSaving(true)
    try {
      const { data } = await apiService.post(`/enquiry/${id}/respond/`, { body: reply, is_internal: internal })
      setEnquiry(data?.enquiry)
      setReply('')
    } catch (requestError) {
      alert(requestError?.response?.data?.detail || 'Response failed.')
    } finally { setSaving(false) }
  }

  const remove = async () => {
    if (!window.confirm(`Delete ${enquiry.reference}? This cannot be undone.`)) return
    await apiService.delete(`/enquiry/${id}/`)
    navigate('/admin/enquiries')
  }

  const openEscalation = () => {
    setActionError('')
    setEscalationReason(enquiry.is_overdue ? 'SLA response deadline exceeded.' : '')
    setEscalationOpen(true)
  }

  const escalate = async () => {
    if (!escalationReason.trim()) {
      setActionError('Add a clear escalation reason before continuing.')
      return
    }
    setSaving(true)
    setActionError('')
    try {
      const { data } = await apiService.post(`/enquiry/${id}/escalate/`, { reason: escalationReason.trim() })
      setEnquiry(data?.enquiry)
      setEscalationOpen(false)
    } catch (requestError) {
      setActionError(requestError?.response?.data?.detail || 'Could not escalate this request. Please retry.')
    } finally { setSaving(false) }
  }

  const proposeResolution = async () => {
    if (!resolution.trim()) return
    setSaving(true)
    try {
      const { data } = await apiService.post(`/enquiry/${id}/resolve/`, { summary: resolution })
      setEnquiry(data?.enquiry)
    } catch (requestError) {
      alert(requestError?.response?.data?.detail || 'Could not propose resolution.')
    } finally { setSaving(false) }
  }

  if (loading) return <div className="grid min-h-[60vh] place-content-center text-sm text-slate-500">Loading enquiry…</div>
  if (error || !enquiry) return <div className="m-5 rounded border border-red-200 bg-red-50 p-6 text-red-700"><p>{error || 'Enquiry not found.'}</p><div className="mt-4 flex gap-4"><button type="button" onClick={load} className="rounded border border-red-300 bg-white px-3 py-2 text-xs font-bold hover:bg-red-100">Retry</button><button type="button" onClick={() => navigate('/admin/enquiries')} className="text-xs font-bold underline">Return to enquiries</button></div></div>

  const conversationMessages = (enquiry.messages || []).filter((message, index) => {
    const isInitialRequest = index === 0
      && message.sender_type === 'requester'
      && !message.is_internal
      && message.body?.trim() === enquiry.message?.trim()
    return !isInitialRequest
  })
  const conversationLabel = `${conversationMessages.length} ${conversationMessages.length === 1 ? 'message' : 'messages'}`

  return (
    <main className="enquiry-typography min-h-full w-full min-w-0 bg-[#f5f8fc] p-4 sm:p-5">
      <header className="rounded-2xl bg-gradient-to-r from-slate-950 via-blue-950 to-indigo-900 p-5 text-white shadow-lg">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0"><div className="font-mono text-xs font-bold text-cyan-300">{enquiry.reference}</div><div className="mt-1 flex min-w-0 items-center gap-2"><button type="button" onClick={() => navigate('/admin/enquiries')} aria-label="Back to Enquiry Operations" title="Back to Enquiry Operations" className="grid h-8 w-8 shrink-0 place-content-center rounded-lg border border-white/15 bg-white/10 text-slate-200 transition hover:bg-white/20 hover:text-white"><ArrowLeftIcon className="h-4 w-4" /></button><h1 className="min-w-0 truncate text-2xl font-bold text-white">{enquiry.subject}</h1></div><p className="mt-1 text-xs text-slate-300">Received {formatDate(enquiry.created_at)} · Last updated {formatDate(enquiry.updated_at)}</p></div>
          <div className="flex items-center gap-2"><Badge value={enquiry.urgency} priority /><Badge value={enquiry.status} /></div>
        </div>
      </header>

      <section className="my-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Summary icon={BuildingOffice2Icon} label="Department" value={enquiry.department || 'Unrouted'} />
        <Summary icon={UserIcon} label="Representative" value={enquiry.assigned_to?.name || 'Unassigned'} />
        <Summary icon={ClockIcon} label="Response deadline" value={formatDate(enquiry.due_at)} alert={enquiry.is_overdue} />
        <Summary icon={CheckCircleIcon} label="First response" value={formatDate(enquiry.first_response_at)} />
      </section>

      <section className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <Card title="Original request">
            <div className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{enquiry.message}</div>
          </Card>
          {enquiry.attachments?.length > 0 && <Card title={`Attachments · ${enquiry.attachments.length}`}><AttachmentList rows={enquiry.attachments} /></Card>}
          <Card title={`Conversation · ${conversationLabel}`}>
            <div className="space-y-3">
              {conversationMessages.map((message) => (
                <div key={message.id} className={`rounded-xl border border-l-4 p-4 ${message.is_internal ? 'border-amber-400 bg-amber-50' : message.sender_type === 'requester' ? 'border-slate-300 bg-slate-50' : 'border-blue-500 bg-blue-50'}`}>
                  <div className="mb-2 flex flex-wrap justify-between gap-2 text-[10px] font-bold uppercase tracking-wide text-slate-500"><span>{message.is_internal ? 'Internal note' : message.author?.name || titleCase(message.sender_type)}</span><span>{formatDate(message.created_at)}</span></div>
                  <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{message.body}</p>
                </div>
              ))}
            </div>
            {!conversationMessages.length && <p className="mb-3 text-xs text-slate-400">No conversation yet. Send the first response below.</p>}
            {!['closed', 'spam'].includes(enquiry.status) && <div className={conversationMessages.length ? 'mt-5 border-t pt-4' : ''}><textarea value={reply} onChange={(event) => setReply(event.target.value)} rows="5" placeholder={internal ? 'Write an internal note. The requester will not see it.' : 'Write a response to the requester…'} className="w-full rounded-xl border border-slate-300 p-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"/><div className="mt-3 flex items-center justify-between"><label className="flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={internal} onChange={(event) => setInternal(event.target.checked)} />Internal note</label><button onClick={send} disabled={saving || !reply.trim()} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-blue-700 disabled:opacity-50"><PaperAirplaneIcon className="h-4 w-4" />{internal ? 'Add note' : 'Send response'}</button></div></div>}
          </Card>
          <Card title="Activity history"><div className="space-y-3">{(enquiry.activities || []).map((activity) => <div key={activity.id} className="grid grid-cols-[12px_1fr_auto] items-start gap-3 text-xs"><span className="mt-1 h-2 w-2 rounded-full bg-blue-600"/><div><strong>{titleCase(activity.action)}</strong><div className="mt-0.5 text-slate-400">{activity.actor?.name || 'System'}</div></div><span className="text-slate-400">{formatDate(activity.created_at)}</span></div>)}</div></Card>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-4">
          <Card title="Workflow controls">
            <WorkflowProgress enquiry={enquiry} />
            <div className="mt-5 border-t border-slate-200 pt-4">
            <Field label="Status"><select value={enquiry.status} disabled={saving || ['resolved', 'closed'].includes(enquiry.status)} onChange={(event) => patch({ status: event.target.value })} className="mt-1.5 w-full rounded border border-slate-300 bg-white px-3 py-2 text-xs normal-case tracking-normal text-slate-800">{STATUS_OPTIONS.filter(([value]) => !['resolved', 'closed'].includes(value) || value === enquiry.status).map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></Field>
            <Field label="Priority"><select value={enquiry.urgency} disabled={saving} onChange={(event) => patch({ urgency: event.target.value })} className="mt-1.5 w-full rounded border border-slate-300 bg-white px-3 py-2 text-xs normal-case tracking-normal text-slate-800">{URGENCY_OPTIONS.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></Field>
            <Field label="Representative"><button type="button" disabled={saving} onClick={() => { setEmployeeSearch(''); setEmployeePickerOpen(true) }} className="mt-1.5 flex w-full items-center justify-between gap-3 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-left normal-case tracking-normal transition hover:border-blue-400 hover:bg-blue-50 disabled:opacity-50"><span className="flex min-w-0 items-center gap-2"><span className="grid h-7 w-7 shrink-0 place-content-center rounded-full bg-blue-50 text-blue-700"><UserIcon className="h-4 w-4" /></span><span className="min-w-0"><strong className="block truncate text-xs text-slate-800">{enquiry.assigned_to?.name || 'Unassigned'}</strong><span className="block truncate text-[10px] font-normal text-slate-400">{enquiry.assigned_to ? 'Select another RADAI employee' : 'Choose from the employee directory'}</span></span></span><UsersIcon className="h-4 w-4 shrink-0 text-slate-400" /></button></Field>
            <Field label="Department"><input value={enquiry.department || ''} onChange={(event) => setEnquiry((current) => ({ ...current, department: event.target.value }))} onBlur={(event) => patch({ department: event.target.value })} className="mt-1.5 w-full rounded border border-slate-300 bg-white px-3 py-2 text-xs normal-case tracking-normal text-slate-800" /></Field>
            <button onClick={openEscalation} disabled={saving || ['resolved', 'closed', 'spam'].includes(enquiry.status)} className="mt-1 w-full rounded border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 transition hover:bg-red-100 disabled:opacity-40">Escalate ticket</button>
            </div>
            {!['resolved', 'closed', 'spam', 'pending_confirmation'].includes(enquiry.status) && <div className="mt-5 border-t border-slate-200 pt-4"><label className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Completion summary<textarea value={resolution} onChange={(event) => setResolution(event.target.value)} rows="4" placeholder="Describe the completed work and outcome…" className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-xs font-normal normal-case tracking-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"/></label><button onClick={proposeResolution} disabled={saving || !resolution.trim() || (enquiry.approval_required && enquiry.approval_status !== 'approved')} className="mt-2 w-full rounded-lg bg-emerald-600 px-3 py-2.5 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:opacity-40">Complete request</button><p className="mt-2 text-[10px] leading-4 text-slate-500">This sends the resolution to the requester. The ticket closes after user confirmation.</p>{enquiry.approval_required && enquiry.approval_status !== 'approved' && <p className="mt-1 text-[10px] font-semibold text-amber-700">Manager approval is required before completion.</p>}</div>}
          </Card>

          {enquiry.approval_required && <Card title="Approval point"><div className="text-xs text-slate-600"><div className="flex justify-between"><span>Handling approval</span><strong className="uppercase">{enquiry.approval_status}</strong></div>{enquiry.approved_by && <div className="mt-1 text-slate-400">{enquiry.approved_by.name} · {formatDate(enquiry.approved_at)}</div>}</div>{enquiry.approval_status === 'pending' && <div className="mt-3 grid grid-cols-2 gap-2"><button onClick={() => patch({ approval_status: 'rejected' })} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-600">Reject</button><button onClick={() => patch({ approval_status: 'approved' })} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white">Approve</button></div>}</Card>}

          {enquiry.resolution_summary && <Card title="Resolution"><p className="whitespace-pre-wrap text-xs leading-5 text-slate-700">{enquiry.resolution_summary}</p>{enquiry.feedback && <div className="mt-4 border-t pt-3"><div className="text-lg text-amber-500">{'★'.repeat(enquiry.feedback.rating)}{'☆'.repeat(5 - enquiry.feedback.rating)}</div><p className="mt-1 text-xs text-slate-600">{enquiry.feedback.comment || 'No written feedback.'}</p></div>}</Card>}

          <Card title="Requester"><Contact icon={UserIcon} value={enquiry.name} /><Contact icon={EnvelopeIcon} value={enquiry.email} href={`mailto:${enquiry.email}`} /><Contact icon={PhoneIcon} value={enquiry.phone || 'Not provided'} href={enquiry.phone ? `tel:${enquiry.phone}` : null} /><Contact icon={BuildingOffice2Icon} value={enquiry.company || 'No company provided'} /><div className="mt-3 border-t pt-3 text-xs text-slate-500"><strong className="text-slate-700">Request type</strong><div className="mt-1">{enquiry.inquiry_type_label}</div></div></Card>

          <Card title="Administrative notes"><textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows="6" className="w-full rounded border border-slate-300 p-3 text-xs outline-none focus:border-emerald-700" placeholder="Internal administrative notes…"/><button onClick={() => patch({ admin_notes: notes })} disabled={saving || notes === (enquiry.admin_notes || '')} className="mt-2 w-full rounded bg-slate-800 px-3 py-2 text-xs font-bold text-white disabled:opacity-40">Save notes</button></Card>

          <button onClick={remove} className="flex w-full items-center justify-center gap-2 rounded border border-red-200 bg-white px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50"><TrashIcon className="h-4 w-4" />Delete enquiry</button>
        </aside>
      </section>
      {escalationOpen && <EscalationDialog reference={enquiry.reference} reason={escalationReason} setReason={setEscalationReason} error={actionError} saving={saving} onCancel={() => setEscalationOpen(false)} onConfirm={escalate} />}
      {employeePickerOpen && <EmployeePickerDialog employees={representatives} selectedId={enquiry.assigned_to?.id} search={employeeSearch} setSearch={setEmployeeSearch} saving={saving} onClose={() => setEmployeePickerOpen(false)} onSelect={async (person) => { const saved = await patch({ assigned_to: person?.id || null }); if (saved) setEmployeePickerOpen(false) }} />}
    </main>
  )
}

const EscalationDialog = ({ reference, reason, setReason, error, saving, onCancel, onConfirm }) => <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/55 p-4 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-labelledby="escalation-title" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onCancel() }}><section className="w-full max-w-lg overflow-hidden rounded-2xl border border-white/20 bg-white shadow-2xl"><header className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 px-5 py-4"><div className="flex gap-3"><span className="grid h-10 w-10 shrink-0 place-content-center rounded-xl bg-red-50 text-red-600"><ExclamationTriangleIcon className="h-5 w-5" /></span><div><h2 id="escalation-title" className="text-base font-bold text-slate-900">Escalate request</h2><p className="mt-0.5 text-xs text-slate-500">{reference} · The reason will be recorded in the audit history.</p></div></div><button type="button" disabled={saving} onClick={onCancel} aria-label="Close escalation dialog" className="grid h-8 w-8 place-content-center rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-700 disabled:opacity-40"><XMarkIcon className="h-5 w-5" /></button></header><div className="p-5"><label className="block text-[11px] font-bold uppercase tracking-wide text-slate-600">Escalation reason<textarea autoFocus rows="5" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explain why this request needs escalation and what action is required…" className="mt-2 w-full resize-none rounded-xl border border-slate-300 p-3 text-sm font-normal normal-case tracking-normal text-slate-800 outline-none transition focus:border-red-400 focus:ring-4 focus:ring-red-50" /></label>{error && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{error}</p>}<div className="mt-5 flex justify-end gap-2"><button type="button" disabled={saving} onClick={onCancel} className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40">Cancel</button><button type="button" disabled={saving || !reason.trim()} onClick={onConfirm} className="rounded-lg bg-red-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-red-700 disabled:opacity-40">{saving ? 'Escalating…' : 'Escalate request'}</button></div></div></section></div>

const EmployeePickerDialog = ({ employees, selectedId, search, setSearch, saving, onClose, onSelect }) => {
  const term = search.trim().toLowerCase()
  const filtered = employees.filter((person) => !term || [person.name, person.email, person.employee_id, person.department, person.job_title].some((value) => String(value || '').toLowerCase().includes(term)))
  return <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/55 p-4 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-labelledby="employee-picker-title" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose() }}><section className="flex max-h-[82vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/20 bg-white shadow-2xl"><header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4"><div><h2 id="employee-picker-title" className="text-base font-bold text-slate-900">Assign a RADAI representative</h2><p className="mt-0.5 text-xs text-slate-500">Search the complete active employee directory.</p></div><button type="button" disabled={saving} onClick={onClose} aria-label="Close employee picker" className="grid h-8 w-8 place-content-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"><XMarkIcon className="h-5 w-5" /></button></header><div className="border-b border-slate-200 bg-slate-50 p-4"><label className="relative block"><MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, email, employee ID, department or title" className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50" /></label></div><div className="min-h-0 flex-1 overflow-y-auto p-3"><button type="button" disabled={saving} onClick={() => onSelect(null)} className={`mb-2 flex w-full items-center gap-3 rounded-xl border p-3 text-left transition hover:border-blue-300 hover:bg-blue-50 ${!selectedId ? 'border-blue-400 bg-blue-50' : 'border-slate-200'}`}><span className="grid h-10 w-10 shrink-0 place-content-center rounded-full bg-slate-100 text-slate-500"><UserIcon className="h-5 w-5" /></span><span><strong className="block text-sm text-slate-800">Leave unassigned</strong><span className="text-xs text-slate-500">Admin can assign the correct owner later.</span></span></button>{filtered.map((person) => <button type="button" key={person.id} disabled={saving} onClick={() => onSelect(person)} className={`mb-2 flex w-full items-center gap-3 rounded-xl border p-3 text-left transition hover:border-blue-300 hover:bg-blue-50 ${String(selectedId) === String(person.id) ? 'border-blue-400 bg-blue-50' : 'border-slate-200 bg-white'}`}><span className="grid h-10 w-10 shrink-0 place-content-center rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-xs font-bold text-white">{(person.name || person.email || '?').split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()}</span><span className="min-w-0 flex-1"><strong className="block truncate text-sm text-slate-800">{person.name}</strong><span className="block truncate text-xs text-slate-500">{person.job_title || 'No job title'} · {person.department || 'No department'}</span><span className="block truncate text-[10px] text-slate-400">{person.email}{person.employee_id ? ` · ${person.employee_id}` : ''}</span></span>{String(selectedId) === String(person.id) && <CheckCircleIcon className="h-5 w-5 shrink-0 text-blue-600" />}</button>)}{!filtered.length && <div className="grid place-items-center py-12 text-center"><UsersIcon className="h-8 w-8 text-slate-300" /><p className="mt-2 text-sm font-semibold text-slate-600">No matching employees</p><p className="mt-1 text-xs text-slate-400">Try a different name, department or employee ID.</p></div>}</div><footer className="border-t border-slate-200 bg-slate-50 px-5 py-3 text-xs text-slate-500">{filtered.length} of {employees.length} active employees</footer></section></div>
}

const Card = ({ title, children }) => <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="mb-4 text-[11px] font-bold uppercase tracking-[0.13em] text-[#2b3a55]">{title}</h2>{children}</article>
const AttachmentList = ({ rows }) => <div className="grid gap-2 sm:grid-cols-2">{rows.map((attachment) => <a key={attachment.id} href={attachment.url} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 transition hover:border-blue-300 hover:bg-blue-50"><span className="grid h-9 w-9 shrink-0 place-content-center rounded-lg bg-white text-blue-600 ring-1 ring-slate-200"><PaperClipIcon className="h-4 w-4"/></span><span className="min-w-0"><strong className="block truncate text-xs text-slate-700">{attachment.name}</strong><span className="text-[10px] text-slate-400">{(attachment.size / 1024 / 1024).toFixed(2)} MB</span></span></a>)}</div>
const WorkflowProgress = ({ enquiry }) => {
  const steps = [
    ['Request Submitted', Boolean(enquiry.created_at)],
    ['Ticket Logged', Boolean(enquiry.id)],
    ['Categorized & Prioritized', Boolean(enquiry.department && enquiry.urgency)],
    ['Assigned', Boolean(enquiry.assigned_to)],
    ['Investigation / Fulfillment', !['new', 'assigned'].includes(enquiry.status)],
    ['Resolved', Boolean(enquiry.resolution_proposed_at || enquiry.resolution_summary)],
    ['User Confirmation', Boolean(enquiry.resolution_confirmed_at)],
    ['Ticket Closed', enquiry.status === 'closed'],
    ['Feedback & Reporting', Boolean(enquiry.feedback)],
  ]
  const current = steps.findIndex(([, done]) => !done)
  return <ol className="space-y-0">{steps.map(([label, done], index) => { const active = index === current; return <li key={label} className="relative flex gap-3 pb-3 last:pb-0">{index < steps.length - 1 && <span className={`absolute left-[9px] top-5 h-[calc(100%-12px)] w-px ${done ? 'bg-emerald-300' : 'bg-slate-200'}`} />}<span className={`relative z-10 mt-0.5 grid h-[19px] w-[19px] shrink-0 place-content-center rounded-full border text-[9px] font-bold ${done ? 'border-emerald-500 bg-emerald-500 text-white' : active ? 'border-blue-600 bg-blue-50 text-blue-700 ring-4 ring-blue-50' : 'border-slate-300 bg-white text-slate-400'}`}>{done ? '✓' : index + 1}</span><span className={`text-[11px] leading-5 ${done ? 'font-semibold text-slate-700' : active ? 'font-bold text-blue-700' : 'text-slate-400'}`}>{label}{active && <span className="ml-1.5 rounded bg-blue-50 px-1.5 py-0.5 text-[8px] uppercase tracking-wide">Current</span>}</span></li> })}</ol>
}
const Summary = ({ icon: Icon, label, value, alert }) => <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-start gap-3"><span className={`grid h-9 w-9 shrink-0 place-content-center rounded-xl ${alert ? 'bg-red-50' : 'bg-blue-50'}`}><Icon className={`h-5 w-5 ${alert ? 'text-red-600' : 'text-blue-600'}`} /></span><div className="min-w-0"><div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{label}</div><div className={`mt-1 truncate text-sm font-bold ${alert ? 'text-red-600' : 'text-slate-800'}`}>{value}</div></div></div></div>
const Field = ({ label, children }) => <label className="mb-3 block text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}{children}</label>
const Contact = ({ icon: Icon, value, href }) => { const content = <span className="min-w-0 truncate">{value}</span>; return <div className="mb-3 flex items-center gap-2 text-xs text-slate-700"><Icon className="h-4 w-4 shrink-0 text-slate-400"/>{href ? <a href={href} className="min-w-0 truncate text-blue-700 hover:underline">{value}</a> : content}</div> }
const Badge = ({ value, priority = false }) => <span className={`rounded-sm px-2.5 py-1 text-[10px] font-bold uppercase ${priority ? value === 'urgent' ? 'bg-red-50 text-red-700' : value === 'high' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600' : STATUS_TONE[value] || 'bg-slate-100 text-slate-600'}`}>{titleCase(value)}</span>
