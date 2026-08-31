import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { StarIcon } from '@heroicons/react/24/outline'
import apiService from '../services/api.service'

export default function EnquiryFeedback () {
  const { token } = useParams()
  const [ticket, setTicket] = useState(null)
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [done, setDone] = useState(false)
  const [saving, setSaving] = useState(false)
  useEffect(() => { apiService.get(`/enquiry/feedback/${token}/`).then(({ data }) => { setTicket(data); setDone(data.feedback_submitted) }) }, [token])
  const submit = async (accepted = true) => { setSaving(true); try { await apiService.post(`/enquiry/feedback/${token}/`, { accepted, rating, comment, would_recommend: true }); setDone(accepted) ; if (!accepted) setTicket((current) => ({ ...current, status: 'reopened' })) } finally { setSaving(false) } }
  if (!ticket) return <div className="grid min-h-screen place-content-center text-slate-500">Loading…</div>
  return <main className="grid min-h-screen place-content-center bg-slate-100 p-4"><section className="w-full max-w-xl rounded-2xl bg-white p-7 shadow-xl"><div className="text-xs font-bold text-blue-600">{ticket.reference}</div><h1 className="mt-1 text-2xl font-bold">Service resolution & feedback</h1><p className="mt-1 text-sm text-slate-500">{ticket.subject}</p>{done ? <div className="mt-6 rounded-xl bg-emerald-50 p-5 text-center font-semibold text-emerald-700">Thank you. Your feedback has been recorded and the ticket is closed.</div> : ticket.status === 'reopened' ? <div className="mt-6 rounded-xl bg-amber-50 p-5 text-center font-semibold text-amber-700">The ticket has been reopened for further investigation.</div> : <><div className="mt-6 rounded-xl bg-slate-50 p-4 text-sm leading-6">{ticket.resolution_summary}</div><div className="my-5 flex justify-center gap-1">{[1,2,3,4,5].map((value) => <button key={value} onClick={() => setRating(value)}><StarIcon className={`h-9 w-9 ${value <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`}/></button>)}</div><textarea value={comment} onChange={(event) => setComment(event.target.value)} rows="4" placeholder="Tell us about the resolution…" className="w-full rounded-xl border p-3 text-sm"/><div className="mt-4 grid grid-cols-2 gap-3"><button onClick={() => submit(false)} disabled={saving} className="rounded-xl border border-red-200 px-4 py-3 text-sm font-bold text-red-600">Not resolved</button><button onClick={() => submit(true)} disabled={saving} className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white">Confirm & submit</button></div></>}</section></main>
}
