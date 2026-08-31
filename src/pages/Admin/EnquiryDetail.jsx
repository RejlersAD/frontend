import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeftIcon, BuildingOffice2Icon, CheckCircleIcon, ClockIcon,
  EnvelopeIcon, PaperAirplaneIcon, PhoneIcon, TrashIcon, UserIcon,
} from '@heroicons/react/24/outline'
import apiService from '../../services/api.service'

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
    } catch (requestError) {
      alert(requestError?.response?.data?.message || 'Update failed.')
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

  const escalate = async () => {
    const reason = window.prompt('Reason for escalation:', enquiry.is_overdue ? 'SLA deadline exceeded' : '')
    if (reason === null) return
    setSaving(true)
    try {
      const { data } = await apiService.post(`/enquiry/${id}/escalate/`, { reason })
      setEnquiry(data?.enquiry)
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

  return (
    <main className="w-full min-w-0 bg-[#f5f6f3] px-3 py-4 sm:px-5">
      <button onClick={() => navigate('/admin/enquiries')} className="mb-3 inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-emerald-800"><ArrowLeftIcon className="h-4 w-4" />Enquiry Operations</button>
      <header className="rounded border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0"><div className="font-mono text-xs font-bold text-emerald-800">{enquiry.reference}</div><h1 className="mt-1 text-2xl font-bold text-slate-900">{enquiry.subject}</h1><p className="mt-1 text-xs text-slate-500">Received {formatDate(enquiry.created_at)} · Last updated {formatDate(enquiry.updated_at)}</p></div>
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
          <Card title={`Conversation · ${enquiry.messages?.length || 0} messages`}>
            <div className="space-y-3">
              {(enquiry.messages || []).map((message) => (
                <div key={message.id} className={`rounded border-l-4 p-4 ${message.is_internal ? 'border-amber-500 bg-amber-50' : message.sender_type === 'requester' ? 'border-slate-400 bg-slate-50' : 'border-emerald-700 bg-emerald-50'}`}>
                  <div className="mb-2 flex flex-wrap justify-between gap-2 text-[10px] font-bold uppercase tracking-wide text-slate-500"><span>{message.is_internal ? 'Internal note' : message.author?.name || titleCase(message.sender_type)}</span><span>{formatDate(message.created_at)}</span></div>
                  <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{message.body}</p>
                </div>
              ))}
            </div>
            {!['closed', 'spam'].includes(enquiry.status) && <div className="mt-5 border-t pt-4"><textarea value={reply} onChange={(event) => setReply(event.target.value)} rows="5" placeholder={internal ? 'Write an internal note. The requester will not see it.' : 'Write a response to the requester…'} className="w-full rounded border border-slate-300 p-3 text-sm outline-none focus:border-emerald-700"/><div className="mt-3 flex items-center justify-between"><label className="flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={internal} onChange={(event) => setInternal(event.target.checked)} />Internal note</label><button onClick={send} disabled={saving || !reply.trim()} className="inline-flex items-center gap-2 rounded bg-emerald-800 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"><PaperAirplaneIcon className="h-4 w-4" />{internal ? 'Add note' : 'Send response'}</button></div></div>}
          </Card>
          <Card title="Activity history"><div className="space-y-3">{(enquiry.activities || []).map((activity) => <div key={activity.id} className="grid grid-cols-[12px_1fr_auto] items-start gap-3 text-xs"><span className="mt-1 h-2 w-2 rounded-full bg-emerald-700"/><div><strong>{titleCase(activity.action)}</strong><div className="mt-0.5 text-slate-400">{activity.actor?.name || 'System'}</div></div><span className="text-slate-400">{formatDate(activity.created_at)}</span></div>)}</div></Card>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-4">
          <Card title="Workflow controls">
            <Field label="Status"><select value={enquiry.status} disabled={saving || ['resolved', 'closed'].includes(enquiry.status)} onChange={(event) => patch({ status: event.target.value })} className="mt-1.5 w-full rounded border border-slate-300 bg-white px-3 py-2 text-xs normal-case tracking-normal text-slate-800">{STATUS_OPTIONS.filter(([value]) => !['resolved', 'closed'].includes(value) || value === enquiry.status).map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></Field>
            <Field label="Priority"><select value={enquiry.urgency} disabled={saving} onChange={(event) => patch({ urgency: event.target.value })} className="mt-1.5 w-full rounded border border-slate-300 bg-white px-3 py-2 text-xs normal-case tracking-normal text-slate-800">{URGENCY_OPTIONS.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></Field>
            <Field label="Representative"><select value={enquiry.assigned_to?.id || ''} disabled={saving} onChange={(event) => patch({ assigned_to: event.target.value || null })} className="mt-1.5 w-full rounded border border-slate-300 bg-white px-3 py-2 text-xs normal-case tracking-normal text-slate-800"><option value="">Unassigned</option>{representatives.map((person) => <option key={person.id} value={person.id}>{person.name} — {person.department || 'No department'}</option>)}</select></Field>
            <Field label="Department"><input value={enquiry.department || ''} onChange={(event) => setEnquiry((current) => ({ ...current, department: event.target.value }))} onBlur={(event) => patch({ department: event.target.value })} className="mt-1.5 w-full rounded border border-slate-300 bg-white px-3 py-2 text-xs normal-case tracking-normal text-slate-800" /></Field>
            <button onClick={escalate} disabled={saving || ['resolved', 'closed', 'spam'].includes(enquiry.status)} className="mt-1 w-full rounded border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 disabled:opacity-40">Escalate ticket</button>
          </Card>

          {enquiry.approval_required && <Card title="Approval point"><div className="text-xs text-slate-600"><div className="flex justify-between"><span>Handling approval</span><strong className="uppercase">{enquiry.approval_status}</strong></div>{enquiry.approved_by && <div className="mt-1 text-slate-400">{enquiry.approved_by.name} · {formatDate(enquiry.approved_at)}</div>}</div>{enquiry.approval_status === 'pending' && <div className="mt-3 grid grid-cols-2 gap-2"><button onClick={() => patch({ approval_status: 'rejected' })} className="rounded border border-red-200 px-3 py-2 text-xs font-bold text-red-600">Reject</button><button onClick={() => patch({ approval_status: 'approved' })} className="rounded bg-emerald-800 px-3 py-2 text-xs font-bold text-white">Approve</button></div>}</Card>}

          {!['resolved', 'closed', 'spam', 'pending_confirmation'].includes(enquiry.status) && <Card title="Propose resolution"><textarea value={resolution} onChange={(event) => setResolution(event.target.value)} rows="5" placeholder="Describe the completed work and outcome…" className="w-full rounded border border-slate-300 p-3 text-xs outline-none focus:border-emerald-700"/><button onClick={proposeResolution} disabled={saving || !resolution.trim() || (enquiry.approval_required && enquiry.approval_status !== 'approved')} className="mt-2 w-full rounded bg-emerald-800 px-3 py-2 text-xs font-bold text-white disabled:opacity-40">Send for requester confirmation</button>{enquiry.approval_required && enquiry.approval_status !== 'approved' && <p className="mt-2 text-[10px] text-amber-700">Manager approval is required before resolution.</p>}</Card>}

          {enquiry.resolution_summary && <Card title="Resolution"><p className="whitespace-pre-wrap text-xs leading-5 text-slate-700">{enquiry.resolution_summary}</p>{enquiry.feedback && <div className="mt-4 border-t pt-3"><div className="text-lg text-amber-500">{'★'.repeat(enquiry.feedback.rating)}{'☆'.repeat(5 - enquiry.feedback.rating)}</div><p className="mt-1 text-xs text-slate-600">{enquiry.feedback.comment || 'No written feedback.'}</p></div>}</Card>}

          <Card title="Requester"><Contact icon={UserIcon} value={enquiry.name} /><Contact icon={EnvelopeIcon} value={enquiry.email} href={`mailto:${enquiry.email}`} /><Contact icon={PhoneIcon} value={enquiry.phone || 'Not provided'} href={enquiry.phone ? `tel:${enquiry.phone}` : null} /><Contact icon={BuildingOffice2Icon} value={enquiry.company || 'No company provided'} /><div className="mt-3 border-t pt-3 text-xs text-slate-500"><strong className="text-slate-700">Request type</strong><div className="mt-1">{enquiry.inquiry_type_label}</div></div></Card>

          <Card title="Administrative notes"><textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows="6" className="w-full rounded border border-slate-300 p-3 text-xs outline-none focus:border-emerald-700" placeholder="Internal administrative notes…"/><button onClick={() => patch({ admin_notes: notes })} disabled={saving || notes === (enquiry.admin_notes || '')} className="mt-2 w-full rounded bg-slate-800 px-3 py-2 text-xs font-bold text-white disabled:opacity-40">Save notes</button></Card>

          <button onClick={remove} className="flex w-full items-center justify-center gap-2 rounded border border-red-200 bg-white px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50"><TrashIcon className="h-4 w-4" />Delete enquiry</button>
        </aside>
      </section>
    </main>
  )
}

const Card = ({ title, children }) => <article className="rounded border border-slate-200 bg-white p-5 shadow-sm"><h2 className="mb-4 text-[11px] font-bold uppercase tracking-[0.13em] text-slate-500">{title}</h2>{children}</article>
const Summary = ({ icon: Icon, label, value, alert }) => <div className="rounded border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-start gap-3"><Icon className={`h-5 w-5 ${alert ? 'text-red-600' : 'text-emerald-800'}`} /><div className="min-w-0"><div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{label}</div><div className={`mt-1 truncate text-sm font-bold ${alert ? 'text-red-600' : 'text-slate-800'}`}>{value}</div></div></div></div>
const Field = ({ label, children }) => <label className="mb-3 block text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}{children}</label>
const Contact = ({ icon: Icon, value, href }) => { const content = <span className="min-w-0 truncate">{value}</span>; return <div className="mb-3 flex items-center gap-2 text-xs text-slate-700"><Icon className="h-4 w-4 shrink-0 text-slate-400"/>{href ? <a href={href} className="min-w-0 truncate text-emerald-800 hover:underline">{value}</a> : content}</div> }
const Badge = ({ value, priority = false }) => <span className={`rounded-sm px-2.5 py-1 text-[10px] font-bold uppercase ${priority ? value === 'urgent' ? 'bg-red-50 text-red-700' : value === 'high' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600' : STATUS_TONE[value] || 'bg-slate-100 text-slate-600'}`}>{titleCase(value)}</span>
