import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeftIcon, CheckCircleIcon, PaperAirplaneIcon, PaperClipIcon, StarIcon, XMarkIcon } from '@heroicons/react/24/outline'
import apiService from '../services/api.service'
import './MyEnquiries.css'

const date = (value) => value ? new Date(value).toLocaleString() : '—'
const label = (value = '') => value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())

export default function MyEnquiryDetail () {
  const { id } = useParams()
  const navigate = useNavigate()
  const [ticket, setTicket] = useState(null)
  const [reply, setReply] = useState('')
  const [comment, setComment] = useState('')
  const [rating, setRating] = useState(5)
  const [recommend, setRecommend] = useState(true)
  const [saving, setSaving] = useState(false)
  const [feedbackOpen, setFeedbackOpen] = useState(false)

  const load = useCallback(async () => {
    const { data } = await apiService.get(`/enquiry/mine/${id}/`)
    const record = data?.enquiry
    setTicket(record)
    // `resolved` is included for tickets confirmed before the new close-first
    // workflow was deployed, so historical requests receive the same prompt.
    if (['resolved', 'closed'].includes(record?.status) && !record?.feedback) setFeedbackOpen(true)
  }, [id])
  useEffect(() => { load() }, [load])

  const sendReply = async () => {
    if (!reply.trim()) return
    setSaving(true)
    try { const { data } = await apiService.post(`/enquiry/mine/${id}/respond/`, { body: reply }); setTicket(data.enquiry); setReply('') } finally { setSaving(false) }
  }
  const confirm = async (accepted) => {
    setSaving(true)
    try { const { data } = await apiService.post(`/enquiry/mine/${id}/resolution/`, { accepted, comment }); setTicket(data.enquiry); setComment(''); if (accepted && data.enquiry?.status === 'closed' && !data.enquiry?.feedback) setFeedbackOpen(true) } finally { setSaving(false) }
  }
  const feedback = async () => {
    setSaving(true)
    try { const { data } = await apiService.post(`/enquiry/mine/${id}/feedback/`, { rating, comment, would_recommend: recommend }); setTicket(data.enquiry); setComment(''); setFeedbackOpen(false) } finally { setSaving(false) }
  }

  if (!ticket) return <div className="grid min-h-[60vh] place-content-center text-sm text-slate-500">Loading request…</div>
  return <main className="my-requests min-h-full w-full min-w-0 overflow-x-hidden bg-[#f5f8fc] px-3 py-4 font-sans sm:px-6 sm:py-6 xl:px-8">
    <div className="mx-auto w-full max-w-[1440px]">
    <button onClick={() => navigate('/my-enquiries')} className="mb-3 inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-700"><ArrowLeftIcon className="h-4 w-4"/>My Requests</button>
    <header className="rounded-2xl bg-gradient-to-r from-slate-950 via-blue-950 to-indigo-900 p-5 text-white shadow-lg sm:p-7"><div className="font-mono text-xs font-bold text-cyan-300">{ticket.reference}</div><div className="mt-1 flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><h1 className="break-words text-xl font-bold sm:text-2xl">{ticket.subject}</h1><p className="mt-1 text-xs text-slate-300">{ticket.department || 'Routing pending'} · Submitted {date(ticket.created_at)}</p></div><span className="shrink-0 rounded-full bg-white/15 px-3 py-1 text-xs font-bold ring-1 ring-white/20">{label(ticket.status)}</span></div></header>
    <div className="mr-detail-grid mt-4 sm:mt-5">
      <section className="min-w-0 space-y-4">{ticket.inquiry_type === 'talent_requisition' && ticket.requisition && <RequisitionCard requisition={ticket.requisition} approval={{ status: ticket.approval_status, by: ticket.approved_by, at: ticket.approved_at, notes: ticket.admin_notes }} authorizedBy={ticket.name}/>}{ticket.attachments?.length > 0 && <Card title={`Attachments · ${ticket.attachments.length}`}><AttachmentList rows={ticket.attachments}/></Card>}<Card title="Conversation"><div className="space-y-3">{(ticket.messages || []).map((message) => <div key={message.id} className={`mr-bubble rounded-xl border p-4 text-sm ${message.sender_type === 'requester' ? 'ml-auto border-blue-200 bg-blue-50' : 'border-slate-200 bg-white'}`}><div className="mb-1 flex flex-wrap justify-between gap-x-3 gap-y-0.5 text-[10px] font-bold uppercase text-slate-400"><span>{message.author?.name || label(message.sender_type)}</span><span>{date(message.created_at)}</span></div><p className="whitespace-pre-wrap break-words leading-6 text-slate-800">{message.body}</p></div>)}</div>{!['closed', 'spam', 'pending_confirmation'].includes(ticket.status) && <div className="mt-4 border-t pt-4"><textarea value={reply} onChange={(event) => setReply(event.target.value)} rows="4" placeholder="Add information or reply…" className="w-full rounded-lg border border-slate-300 p-3 text-sm"/><div className="mt-2 text-right"><button onClick={sendReply} disabled={saving || !reply.trim()} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"><PaperAirplaneIcon className="h-4 w-4"/>Send reply</button></div></div>}</Card></section>
      <aside className="mr-detail-aside min-w-0 space-y-4">
        {ticket.status === 'pending_confirmation' && <Card title="Resolution approval"><p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{ticket.resolution_summary}</p><textarea value={comment} onChange={(event) => setComment(event.target.value)} rows="3" placeholder="Optional confirmation or reopening comment" className="mt-4 w-full rounded-lg border border-slate-300 p-3 text-xs"/><div className="mt-3 grid grid-cols-2 gap-2"><button onClick={() => confirm(false)} disabled={saving} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-600">Not resolved</button><button onClick={() => confirm(true)} disabled={saving} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white">Confirm resolved</button></div></Card>}
        {['resolved', 'closed'].includes(ticket.status) && !ticket.feedback && <Card title="After-service feedback"><div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs leading-5 text-emerald-800">This ticket is complete. Please tell us how the service went.</div><button onClick={() => setFeedbackOpen(true)} className="mt-3 w-full rounded-lg bg-blue-600 px-3 py-2.5 text-xs font-bold text-white">Give feedback</button></Card>}
        {ticket.feedback && <Card title="Your feedback"><div className="text-center text-2xl text-amber-500">{'★'.repeat(ticket.feedback.rating)}{'☆'.repeat(5-ticket.feedback.rating)}</div><p className="mt-2 text-center text-xs text-slate-600">{ticket.feedback.comment || 'Thank you for your rating.'}</p></Card>}
        <Card title="Ticket information"><Info k="Type" v={ticket.inquiry_type_label}/><Info k="Priority" v={label(ticket.urgency)}/><Info k="Representative" v={ticket.assigned_to?.name || 'Assignment pending'}/><Info k="Response due" v={date(ticket.due_at)}/><Info k="Escalation" v={ticket.escalation_level ? `Level ${ticket.escalation_level}` : 'None'}/></Card>
      </aside>
    </div>
    </div>
    {feedbackOpen && !ticket.feedback && <FeedbackDialog rating={rating} setRating={setRating} comment={comment} setComment={setComment} recommend={recommend} setRecommend={setRecommend} saving={saving} submit={feedback} close={() => setFeedbackOpen(false)} />}
  </main>
}

const Card = ({ title, children }) => <article className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><h2 className="mb-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">{title}</h2>{children}</article>
const AttachmentList = ({ rows }) => <div className="grid gap-2 sm:grid-cols-2">{rows.map((attachment) => <a key={attachment.id} href={attachment.url} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 hover:border-blue-300 hover:bg-blue-50"><PaperClipIcon className="h-5 w-5 shrink-0 text-blue-600"/><span className="min-w-0"><strong className="block truncate text-xs text-slate-700">{attachment.name}</strong><span className="text-[10px] text-slate-400">{(attachment.size / 1024 / 1024).toFixed(2)} MB</span></span></a>)}</div>
const Info = ({ k, v }) => <div className="flex justify-between gap-4 border-b border-slate-100 py-2 text-xs last:border-0"><span className="shrink-0 text-slate-400">{k}</span><strong className="min-w-0 break-words text-right text-slate-700">{v}</strong></div>

const REASON_LABELS = { new_position: 'New Position', replacement: 'Replacement for a Departing Employee', temporary: 'Temporary Position', other: 'Other' }
const RequisitionCard = ({ requisition: r, approval, authorizedBy }) => {
  const approved = approval.status === 'approved'
  const rejected = approval.status === 'rejected'
  return <Card title="Talent requisition">
    <div className="grid gap-x-6 sm:grid-cols-2">
      <Info k="Department / Division" v={r.req_department || '—'}/>
      <Info k="Position" v={r.job_title || '—'}/>
      <Info k="No. of Positions" v={r.num_positions || '1'}/>
      <Info k="Hiring Manager" v={r.hiring_manager || '—'}/>
      <Info k="Reason" v={`${REASON_LABELS[r.reason] || r.reason || '—'}${r.reason_detail ? ` — ${r.reason_detail}` : ''}`}/>
      <Info k="Target Joining" v={r.target_join_date || '—'}/>
      {r.proposed_salary && <Info k="Proposed Package" v={r.proposed_salary}/>}
      {r.candidate && <Info k="Selected Candidate" v={r.candidate}/>}
    </div>
    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Justification</p><p className="mt-1 whitespace-pre-wrap text-xs leading-6 text-slate-700">{r.justification || '—'}</p></div>
    <div className="mt-3 flex justify-between border-b border-slate-100 py-2 text-xs"><span className="text-slate-400">Authorized by</span><strong className="text-right text-slate-700">{authorizedBy || '—'}</strong></div>
    {(r.approval_stages || []).length > 0 && <div className="mt-4">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Approval chain</p>
      <ol className="space-y-2">
        {r.approval_stages.map((stage, index) => <li key={stage.key || index} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2 text-xs">
          <span className={`grid h-5 w-5 shrink-0 place-content-center rounded-full text-[10px] font-bold ${stage.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : stage.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-slate-200 text-slate-500'}`}>{stage.status === 'approved' ? '✓' : stage.status === 'rejected' ? '✕' : index + 1}</span>
          <span className="font-semibold text-slate-700">{stage.label}</span>
          <span className="text-slate-400">{stage.approver_name || 'Pending assignment'}</span>
          <span className={`ml-auto font-semibold ${stage.status === 'approved' ? 'text-emerald-600' : stage.status === 'rejected' ? 'text-red-600' : 'text-slate-400'}`}>{label(stage.status)}</span>
        </li>)}
      </ol>
      {(r.approval_stages || []).some((stage) => stage.comment) && <div className="mt-2 space-y-1">{r.approval_stages.filter((stage) => stage.comment).map((stage, index) => <p key={index} className="rounded-lg bg-slate-50 p-2 text-[11px] leading-5 text-slate-600"><strong>{stage.label}:</strong> {stage.comment}</p>)}</div>}
    </div>}
    <div className="mt-4 rounded-xl border p-4">{/* Approval format (mirrors the requisition form) */}
      <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Approval</p>
      <div className="grid grid-cols-2 gap-2">
        <span className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold ${approved ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-400'}`}><span className={`grid h-4 w-4 place-content-center rounded border ${approved ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300'}`}>{approved && '✓'}</span>Approved</span>
        <span className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold ${rejected ? 'border-red-300 bg-red-50 text-red-700' : 'border-slate-200 text-slate-400'}`}><span className={`grid h-4 w-4 place-content-center rounded border ${rejected ? 'border-red-500 bg-red-500 text-white' : 'border-slate-300'}`}>{rejected && '✓'}</span>Not Approved</span>
      </div>
      {!approved && !rejected && <p className="mt-2 text-[11px] text-slate-400">Pending department head / HR decision.</p>}
      {(approved || rejected) && <p className="mt-2 text-[11px] text-slate-500">By {approval.by?.name || '—'} · {date(approval.at)}</p>}
      {rejected && approval.notes && <p className="mt-2 rounded-lg bg-red-50 p-2 text-[11px] leading-5 text-red-700">Reason for denial: {approval.notes}</p>}
    </div>
  </Card>
}

const FeedbackDialog = ({ rating, setRating, comment, setComment, recommend, setRecommend, saving, submit, close }) => <div className="fixed inset-0 z-[120] grid place-items-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm"><section role="dialog" aria-modal="true" aria-labelledby="feedback-title" className="w-full max-w-lg overflow-hidden rounded-2xl border border-white/20 bg-white shadow-2xl"><div className="h-1 bg-gradient-to-r from-emerald-500 via-cyan-500 to-blue-600"/><div className="relative px-6 pb-6 pt-7 text-center"><button type="button" onClick={close} aria-label="Close feedback prompt" className="absolute right-4 top-4 grid h-8 w-8 place-content-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"><XMarkIcon className="h-4 w-4"/></button><span className="mx-auto grid h-12 w-12 place-content-center rounded-2xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100"><CheckCircleIcon className="h-7 w-7"/></span><p className="mt-4 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-600">Ticket closed</p><h2 id="feedback-title" className="mt-1 text-2xl font-bold tracking-tight text-slate-950">How did we do?</h2><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">Your feedback helps RADAI improve response quality and service performance.</p><div className="mt-5 flex justify-center gap-1">{[1, 2, 3, 4, 5].map((value) => <button type="button" key={value} onClick={() => setRating(value)} aria-label={`${value} star rating`}><StarIcon className={`h-9 w-9 transition hover:scale-110 ${value <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`}/></button>)}</div><div className="mt-1 text-xs font-semibold text-slate-500">{rating} of 5</div><textarea value={comment} onChange={(event) => setComment(event.target.value)} rows="4" placeholder="Tell us about your experience…" className="mt-5 w-full resize-none rounded-xl border border-slate-300 p-3 text-left text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"/><label className="mt-3 flex items-center gap-2 text-left text-xs text-slate-600"><input type="checkbox" checked={recommend} onChange={(event) => setRecommend(event.target.checked)} className="rounded border-slate-300"/>I would recommend RADAI support</label><button type="button" onClick={submit} disabled={saving} className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-700 disabled:opacity-50">{saving ? 'Submitting feedback…' : 'Submit feedback'}</button><button type="button" onClick={close} className="mt-2 text-xs font-semibold text-slate-400 hover:text-slate-600">Remind me later</button></div></section></div>

