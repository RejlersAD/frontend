import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeftIcon, CheckCircleIcon, PaperAirplaneIcon, PaperClipIcon, StarIcon, XMarkIcon } from '@heroicons/react/24/outline'
import apiService from '../services/api.service'

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
  return <main className="min-h-full w-full min-w-0 bg-[#f5f8fc] px-4 py-5 font-sans sm:px-6">
    <button onClick={() => navigate('/my-enquiries')} className="mb-3 inline-flex items-center gap-1 text-xs font-bold text-slate-500"><ArrowLeftIcon className="h-4 w-4"/>My Requests</button>
    <header className="rounded-2xl bg-gradient-to-r from-slate-950 via-blue-950 to-indigo-900 p-6 text-white shadow-lg"><div className="font-mono text-xs font-bold text-cyan-300">{ticket.reference}</div><div className="mt-1 flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-2xl font-bold">{ticket.subject}</h1><p className="mt-1 text-xs text-slate-300">{ticket.department || 'Routing pending'} · Submitted {date(ticket.created_at)}</p></div><span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold ring-1 ring-white/20">{label(ticket.status)}</span></div></header>
    <div className="mt-4 grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="space-y-4">{ticket.attachments?.length > 0 && <Card title={`Attachments · ${ticket.attachments.length}`}><AttachmentList rows={ticket.attachments}/></Card>}<Card title="Conversation"><div className="space-y-3">{(ticket.messages || []).map((message) => <div key={message.id} className={`max-w-[88%] rounded-xl border p-4 text-sm ${message.sender_type === 'requester' ? 'ml-auto border-blue-200 bg-blue-50' : 'border-slate-200 bg-white'}`}><div className="mb-1 flex justify-between gap-2 text-[10px] font-bold uppercase text-slate-400"><span>{message.author?.name || label(message.sender_type)}</span><span>{date(message.created_at)}</span></div><p className="whitespace-pre-wrap leading-6">{message.body}</p></div>)}</div>{!['closed', 'spam', 'pending_confirmation'].includes(ticket.status) && <div className="mt-4 border-t pt-4"><textarea value={reply} onChange={(event) => setReply(event.target.value)} rows="4" placeholder="Add information or reply…" className="w-full rounded-lg border p-3 text-sm"/><div className="mt-2 text-right"><button onClick={sendReply} disabled={saving || !reply.trim()} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"><PaperAirplaneIcon className="h-4 w-4"/>Send reply</button></div></div>}</Card></section>
      <aside className="space-y-4">
        {ticket.status === 'pending_confirmation' && <Card title="Resolution approval"><p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{ticket.resolution_summary}</p><textarea value={comment} onChange={(event) => setComment(event.target.value)} rows="3" placeholder="Optional confirmation or reopening comment" className="mt-4 w-full rounded-lg border p-3 text-xs"/><div className="mt-3 grid grid-cols-2 gap-2"><button onClick={() => confirm(false)} disabled={saving} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-600">Not resolved</button><button onClick={() => confirm(true)} disabled={saving} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white">Confirm resolved</button></div></Card>}
        {['resolved', 'closed'].includes(ticket.status) && !ticket.feedback && <Card title="After-service feedback"><div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs leading-5 text-emerald-800">This ticket is complete. Please tell us how the service went.</div><button onClick={() => setFeedbackOpen(true)} className="mt-3 w-full rounded-lg bg-blue-600 px-3 py-2.5 text-xs font-bold text-white">Give feedback</button></Card>}
        {ticket.feedback && <Card title="Your feedback"><div className="text-center text-2xl text-amber-500">{'★'.repeat(ticket.feedback.rating)}{'☆'.repeat(5-ticket.feedback.rating)}</div><p className="mt-2 text-center text-xs text-slate-600">{ticket.feedback.comment || 'Thank you for your rating.'}</p></Card>}
        <Card title="Ticket information"><Info k="Type" v={ticket.inquiry_type_label}/><Info k="Priority" v={label(ticket.urgency)}/><Info k="Representative" v={ticket.assigned_to?.name || 'Assignment pending'}/><Info k="Response due" v={date(ticket.due_at)}/><Info k="Escalation" v={ticket.escalation_level ? `Level ${ticket.escalation_level}` : 'None'}/></Card>
      </aside>
    </div>
    {feedbackOpen && !ticket.feedback && <FeedbackDialog rating={rating} setRating={setRating} comment={comment} setComment={setComment} recommend={recommend} setRecommend={setRecommend} saving={saving} submit={feedback} close={() => setFeedbackOpen(false)} />}
  </main>
}

const Card = ({ title, children }) => <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="mb-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">{title}</h2>{children}</article>
const AttachmentList = ({ rows }) => <div className="grid gap-2 sm:grid-cols-2">{rows.map((attachment) => <a key={attachment.id} href={attachment.url} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 hover:border-blue-300 hover:bg-blue-50"><PaperClipIcon className="h-5 w-5 shrink-0 text-blue-600"/><span className="min-w-0"><strong className="block truncate text-xs text-slate-700">{attachment.name}</strong><span className="text-[10px] text-slate-400">{(attachment.size / 1024 / 1024).toFixed(2)} MB</span></span></a>)}</div>
const Info = ({ k, v }) => <div className="flex justify-between border-b border-slate-100 py-2 text-xs last:border-0"><span className="text-slate-400">{k}</span><strong className="text-right text-slate-700">{v}</strong></div>
const FeedbackDialog = ({ rating, setRating, comment, setComment, recommend, setRecommend, saving, submit, close }) => <div className="fixed inset-0 z-[120] grid place-items-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm"><section role="dialog" aria-modal="true" aria-labelledby="feedback-title" className="w-full max-w-lg overflow-hidden rounded-2xl border border-white/20 bg-white shadow-2xl"><div className="h-1 bg-gradient-to-r from-emerald-500 via-cyan-500 to-blue-600"/><div className="relative px-6 pb-6 pt-7 text-center"><button type="button" onClick={close} aria-label="Close feedback prompt" className="absolute right-4 top-4 grid h-8 w-8 place-content-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"><XMarkIcon className="h-4 w-4"/></button><span className="mx-auto grid h-12 w-12 place-content-center rounded-2xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100"><CheckCircleIcon className="h-7 w-7"/></span><p className="mt-4 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-600">Ticket closed</p><h2 id="feedback-title" className="mt-1 text-2xl font-bold tracking-tight text-slate-950">How did we do?</h2><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">Your feedback helps RADAI improve response quality and service performance.</p><div className="mt-5 flex justify-center gap-1">{[1, 2, 3, 4, 5].map((value) => <button type="button" key={value} onClick={() => setRating(value)} aria-label={`${value} star rating`}><StarIcon className={`h-9 w-9 transition hover:scale-110 ${value <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`}/></button>)}</div><div className="mt-1 text-xs font-semibold text-slate-500">{rating} of 5</div><textarea value={comment} onChange={(event) => setComment(event.target.value)} rows="4" placeholder="Tell us about your experience…" className="mt-5 w-full resize-none rounded-xl border border-slate-300 p-3 text-left text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"/><label className="mt-3 flex items-center gap-2 text-left text-xs text-slate-600"><input type="checkbox" checked={recommend} onChange={(event) => setRecommend(event.target.checked)} className="rounded border-slate-300"/>I would recommend RADAI support</label><button type="button" onClick={submit} disabled={saving} className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-700 disabled:opacity-50">{saving ? 'Submitting feedback…' : 'Submit feedback'}</button><button type="button" onClick={close} className="mt-2 text-xs font-semibold text-slate-400 hover:text-slate-600">Remind me later</button></div></section></div>
