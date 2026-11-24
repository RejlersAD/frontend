import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeftIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline'
import apiService from '../services/api.service'

const date = (value) => value ? new Date(value).toLocaleString() : '—'
const label = (value = '') => String(value).replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
const REASON_LABELS = { new_position: 'New Position', replacement: 'Replacement for a Departing Employee', temporary: 'Temporary Position', other: 'Other' }

export default function RequisitionApproval () {
  const { id } = useParams()
  const navigate = useNavigate()
  const [ticket, setTicket] = useState(null)
  const [error, setError] = useState('')
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)
  const [actionError, setActionError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const { data } = await apiService.get(`/enquiry/${id}/requisition/`)
      setTicket(data?.enquiry)
    } catch (requestError) {
      setError(requestError?.response?.data?.detail || 'Could not load this requisition.')
    }
  }, [id])
  useEffect(() => { load() }, [load])

  const decide = async (decision) => {
    setSaving(true)
    setActionError('')
    try {
      const { data } = await apiService.post(`/enquiry/${id}/requisition/`, { decision, comment })
      setTicket(data.enquiry)
      setComment('')
    } catch (requestError) {
      setActionError(requestError?.response?.data?.detail || 'Could not record the decision.')
    } finally { setSaving(false) }
  }

  if (error) return <main className="grid min-h-[60vh] place-content-center px-6 text-center"><p className="text-sm font-semibold text-slate-800">Requisition unavailable</p><p className="mt-1 max-w-md text-xs text-slate-500">{error}</p><button onClick={() => navigate('/my-enquiries')} className="mx-auto mt-4 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">Back to my requests</button></main>
  if (!ticket) return <div className="grid min-h-[60vh] place-content-center text-sm text-slate-500">Loading requisition…</div>

  const r = ticket.requisition || {}
  const stages = r.approval_stages || []
  return <main className="min-h-full w-full min-w-0 bg-[#f5f8fc] px-4 py-5 font-sans sm:px-6">
    <div className="mx-auto max-w-3xl">
      <button onClick={() => navigate(-1)} className="mb-3 inline-flex items-center gap-1 text-xs font-bold text-slate-500"><ArrowLeftIcon className="h-4 w-4"/>Back</button>
      <header className="rounded-2xl bg-gradient-to-r from-slate-950 via-blue-950 to-indigo-900 p-6 text-white shadow-lg">
        <div className="font-mono text-xs font-bold text-cyan-300">{ticket.reference}</div>
        <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
          <div><h1 className="text-2xl font-bold">{ticket.subject}</h1><p className="mt-1 text-xs text-slate-300">Requested by {ticket.requester?.name || ticket.name} · {date(ticket.created_at)}</p></div>
          <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold ring-1 ring-white/20">{label(ticket.approval_status)}</span>
        </div>
      </header>

      <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">Requisition details</h2>
        <div className="grid gap-x-6 sm:grid-cols-2">
          <Info k="Department / Division" v={r.req_department}/>
          <Info k="Position" v={r.job_title}/>
          <Info k="No. of Positions" v={r.num_positions}/>
          <Info k="Hiring Manager" v={r.hiring_manager}/>
          <Info k="Reason" v={`${REASON_LABELS[r.reason] || label(r.reason || '')}${r.reason_detail ? ` — ${r.reason_detail}` : ''}`}/>
          <Info k="Target Joining" v={r.target_join_date}/>
          {r.proposed_salary && <Info k="Proposed Package" v={r.proposed_salary}/>}
          {r.candidate && <Info k="Selected Candidate" v={r.candidate}/>}
        </div>
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Justification</p><p className="mt-1 whitespace-pre-wrap text-xs leading-6 text-slate-700">{r.justification || '—'}</p></div>
      </section>

      {stages.length > 0 && <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">Approval stages</h2>
        <ol className="space-y-3">
          {stages.map((stage, index) => <li key={stage.key || index} className="flex items-start gap-3">
            <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-content-center rounded-full text-[10px] font-bold ${stage.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : stage.status === 'rejected' ? 'bg-red-100 text-red-700' : index === ticket.current_stage && ticket.approval_status === 'pending' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-400'}`}>{stage.status === 'approved' ? '✓' : stage.status === 'rejected' ? '✕' : index + 1}</span>
            <div className="min-w-0 flex-1 border-b border-slate-100 pb-3 last:border-0">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs"><strong className="text-slate-800">{stage.label}</strong><span className={`font-semibold ${stage.status === 'approved' ? 'text-emerald-600' : stage.status === 'rejected' ? 'text-red-600' : 'text-slate-400'}`}>{label(stage.status)}</span></div>
              <p className="mt-0.5 text-[11px] text-slate-500">{stage.approver_name || 'Assignee pending'}{stage.decided_at ? ` · ${date(stage.decided_at)}` : ''}</p>
              {stage.comment && <p className="mt-1 rounded-lg bg-slate-50 p-2 text-[11px] leading-5 text-slate-600">{stage.comment}</p>}
            </div>
          </li>)}
        </ol>
      </section>}

      {ticket.can_approve && <section className="mt-4 rounded-2xl border border-blue-200 bg-white p-5 shadow-sm">
        <h2 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-blue-600">Your decision is required</h2>
        <p className="text-xs leading-5 text-slate-600">Review the requisition above. Approving passes it to the next stage; rejecting returns it to the requester with your comments.</p>
        <textarea value={comment} onChange={(event) => setComment(event.target.value)} rows="3" placeholder="Comments (optional for approval, recommended for rejection)" className="mt-3 w-full rounded-xl border border-slate-300 p-3 text-xs outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"/>
        {actionError && <p role="alert" className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{actionError}</p>}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button onClick={() => decide('rejected')} disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 px-3 py-2.5 text-xs font-bold text-red-600 transition hover:bg-red-50 disabled:opacity-50"><XCircleIcon className="h-4 w-4"/>Not Approved</button>
          <button onClick={() => decide('approved')} disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-2.5 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"><CheckCircleIcon className="h-4 w-4"/>Approve</button>
        </div>
      </section>}
    </div>
  </main>
}

const Info = ({ k, v }) => <div className="flex justify-between gap-3 border-b border-slate-100 py-2 text-xs last:border-0"><span className="text-slate-400">{k}</span><strong className="text-right text-slate-700">{v || '—'}</strong></div>
