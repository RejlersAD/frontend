import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeftIcon, PaperAirplaneIcon, StarIcon } from '@heroicons/react/24/outline'
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

  const load = useCallback(async () => {
    const { data } = await apiService.get(`/enquiry/mine/${id}/`)
    setTicket(data?.enquiry)
  }, [id])
  useEffect(() => { load() }, [load])

  const sendReply = async () => {
    if (!reply.trim()) return
    setSaving(true)
    try { const { data } = await apiService.post(`/enquiry/mine/${id}/respond/`, { body: reply }); setTicket(data.enquiry); setReply('') } finally { setSaving(false) }
  }
  const confirm = async (accepted) => {
    setSaving(true)
    try { const { data } = await apiService.post(`/enquiry/mine/${id}/resolution/`, { accepted, comment }); setTicket(data.enquiry); setComment('') } finally { setSaving(false) }
  }
  const feedback = async () => {
    setSaving(true)
    try { const { data } = await apiService.post(`/enquiry/mine/${id}/feedback/`, { rating, comment, would_recommend: recommend }); setTicket(data.enquiry); setComment('') } finally { setSaving(false) }
  }

  if (!ticket) return <div className="grid min-h-[60vh] place-content-center text-sm text-slate-500">Loading request…</div>
  return <main className="min-h-full w-full min-w-0 bg-[#f5f8fc] px-4 py-5 font-sans sm:px-6">
    <button onClick={() => navigate('/my-enquiries')} className="mb-3 inline-flex items-center gap-1 text-xs font-bold text-slate-500"><ArrowLeftIcon className="h-4 w-4"/>My Requests</button>
    <header className="rounded-2xl bg-gradient-to-r from-slate-950 via-blue-950 to-indigo-900 p-6 text-white shadow-lg"><div className="font-mono text-xs font-bold text-cyan-300">{ticket.reference}</div><div className="mt-1 flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-2xl font-bold">{ticket.subject}</h1><p className="mt-1 text-xs text-slate-300">{ticket.department || 'Routing pending'} · Submitted {date(ticket.created_at)}</p></div><span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold ring-1 ring-white/20">{label(ticket.status)}</span></div></header>
    <div className="mt-4 grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="space-y-4"><Card title="Conversation"><div className="space-y-3">{(ticket.messages || []).map((message) => <div key={message.id} className={`max-w-[88%] rounded-xl border p-4 text-sm ${message.sender_type === 'requester' ? 'ml-auto border-blue-200 bg-blue-50' : 'border-slate-200 bg-white'}`}><div className="mb-1 flex justify-between gap-2 text-[10px] font-bold uppercase text-slate-400"><span>{message.author?.name || label(message.sender_type)}</span><span>{date(message.created_at)}</span></div><p className="whitespace-pre-wrap leading-6">{message.body}</p></div>)}</div>{!['closed', 'spam', 'pending_confirmation'].includes(ticket.status) && <div className="mt-4 border-t pt-4"><textarea value={reply} onChange={(event) => setReply(event.target.value)} rows="4" placeholder="Add information or reply…" className="w-full rounded-lg border p-3 text-sm"/><div className="mt-2 text-right"><button onClick={sendReply} disabled={saving || !reply.trim()} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"><PaperAirplaneIcon className="h-4 w-4"/>Send reply</button></div></div>}</Card></section>
      <aside className="space-y-4">
        {ticket.status === 'pending_confirmation' && <Card title="Resolution approval"><p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{ticket.resolution_summary}</p><textarea value={comment} onChange={(event) => setComment(event.target.value)} rows="3" placeholder="Optional confirmation or reopening comment" className="mt-4 w-full rounded-lg border p-3 text-xs"/><div className="mt-3 grid grid-cols-2 gap-2"><button onClick={() => confirm(false)} disabled={saving} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-600">Not resolved</button><button onClick={() => confirm(true)} disabled={saving} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white">Confirm resolved</button></div></Card>}
        {ticket.status === 'resolved' && !ticket.feedback && <Card title="After-service feedback"><div className="flex justify-center gap-1 py-2">{[1,2,3,4,5].map((value) => <button key={value} onClick={() => setRating(value)}><StarIcon className={`h-8 w-8 ${value <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`}/></button>)}</div><textarea value={comment} onChange={(event) => setComment(event.target.value)} rows="4" placeholder="Tell us about the service…" className="mt-2 w-full rounded-lg border p-3 text-xs"/><label className="mt-3 flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={recommend} onChange={(event) => setRecommend(event.target.checked)}/>I would recommend RADAI support</label><button onClick={feedback} disabled={saving} className="mt-3 w-full rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white">Submit feedback & close</button></Card>}
        {ticket.feedback && <Card title="Your feedback"><div className="text-center text-2xl text-amber-500">{'★'.repeat(ticket.feedback.rating)}{'☆'.repeat(5-ticket.feedback.rating)}</div><p className="mt-2 text-center text-xs text-slate-600">{ticket.feedback.comment || 'Thank you for your rating.'}</p></Card>}
        <Card title="Ticket information"><Info k="Type" v={ticket.inquiry_type_label}/><Info k="Priority" v={label(ticket.urgency)}/><Info k="Representative" v={ticket.assigned_to?.name || 'Assignment pending'}/><Info k="Response due" v={date(ticket.due_at)}/><Info k="Escalation" v={ticket.escalation_level ? `Level ${ticket.escalation_level}` : 'None'}/></Card>
      </aside>
    </div>
  </main>
}

const Card = ({ title, children }) => <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="mb-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">{title}</h2>{children}</article>
const Info = ({ k, v }) => <div className="flex justify-between border-b border-slate-100 py-2 text-xs last:border-0"><span className="text-slate-400">{k}</span><strong className="text-right text-slate-700">{v}</strong></div>
