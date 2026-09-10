import { useEffect, useRef, useState } from 'react'
import { CalendarDaysIcon, CheckIcon, ClockIcon, DocumentTextIcon, ArrowRightIcon, UserIcon, PrinterIcon } from '@heroicons/react/24/outline'
import { printLeaveRequest } from './printLeaveRequest'
import apiClient from '../../services/api.service'

export const leaveError = error => {
  const data = error?.response?.data
  if (!data) return error.message || 'The request could not be completed.'
  return typeof data === 'string' ? data : Object.values(data).flat().join(' ')
}

export default function LeaveApprovalReview({ requestId, onClose, onUpdated, page = false }) {
  const dialog = useRef(null)
  const [request, setRequest] = useState(null)
  const [error, setError] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [printing, setPrinting] = useState(false)
  const [failedPhoto, setFailedPhoto] = useState(null)
  useEffect(() => {
    let active = true
    if (!page) dialog.current?.showModal()
    setRequest(null)
    setError('')
    setNote('')
    apiClient.get(`/payroll/leave-requests/${requestId}/`).then(({ data }) => {
      if (active) setRequest(data)
    }).catch(err => { if (active) setError(leaveError(err)) })
    return () => { active = false }
  }, [requestId, page])
  const decide = async action => {
    if (saving) return
    if (action === 'reject' && !note.trim()) { setError('Please enter a rejection reason.'); return }
    setSaving(true)
    setError('')
    try {
      const endpoint = request.status === 'PENDING' && request.review_stage !== 'hr_review' ? `rm-${action}` : action
      const { data } = await apiClient.post(`/payroll/leave-requests/${requestId}/${endpoint}/`, { note })
      setRequest(data)
      onUpdated()
    } catch (err) {
      setError(leaveError(err))
      // Refresh stale approval rights after another approver acts.
      apiClient.get(`/payroll/leave-requests/${requestId}/`).then(({ data }) => setRequest(data)).catch(() => {})
      onUpdated()
    } finally { setSaving(false) }
  }
  const canPrint = request?.status === 'APPROVED' && (!request.workflow_status || request.workflow_status === 'approved')
  const print = async () => {
    if (!canPrint || saving || printing) return
    setPrinting(true)
    try { await printLeaveRequest(dialog.current) }
    catch (err) { setError(err.message || 'Unable to print this request.') }
    finally { setPrinting(false) }
  }
  const Container = page ? 'section' : 'dialog'
  const status = request?.status
  const directHR = status === 'PENDING' && request?.review_stage === 'hr_review'
  const pending = ['PENDING', 'RM_APPROVED'].includes(status)
  const declined = ['RM_REJECTED', 'REJECTED'].includes(status)
  const statusLabel = directHR ? 'Awaiting HR' : ({ PENDING: 'Awaiting manager', RM_APPROVED: 'Awaiting HR', APPROVED: 'Approved', RM_REJECTED: 'Declined by manager', REJECTED: 'Declined by HR', CANCELLED: 'Cancelled' })[status] || request?.status_display
  const statusStyle = declined ? 'border-rose-200 bg-rose-50 text-rose-700' : status === 'APPROVED' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : pending ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-slate-200 bg-slate-50 text-slate-600'
  const date = (value, time = false) => {
    if (!value) return 'Not recorded'
    const parsed = new Date(time ? value : `${value.slice(0, 10)}T12:00:00`)
    return Number.isNaN(parsed.getTime()) ? 'Not recorded' : parsed.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric', ...(time ? { hour: '2-digit', minute: '2-digit' } : {}) })
  }
  const managerDone = Boolean(request?.rm_reviewed_at) || ['RM_APPROVED', 'APPROVED', 'REJECTED'].includes(status)
  const steps = request ? [
    { title: 'Request submitted', detail: request.employee_name, at: request.created_at, complete: true },
    { title: 'Manager review', detail: request.rm_reviewed_by_name || request.line_manager_name || (directHR ? 'No manager assigned' : 'Manager not available'), at: request.rm_reviewed_at, note: request.rm_note, complete: managerDone && status !== 'RM_REJECTED', rejected: status === 'RM_REJECTED', active: status === 'PENDING' && !directHR, skipped: directHR, label: status === 'PENDING' && !directHR ? 'Awaiting review' : null },
    { title: 'HR approval', detail: request.reviewed_by_name || (status === 'PENDING' && !directHR ? 'After manager approval' : status === 'RM_APPROVED' ? 'Awaiting review' : 'No pending action'), at: request.reviewed_at, note: request.reviewer_note, complete: status === 'APPROVED', rejected: status === 'REJECTED', active: status === 'RM_APPROVED' || directHR },
  ] : []
  return (
    <Container ref={dialog} onCancel={event => { event.preventDefault(); if (!saving) onClose() }} className={`${page ? 'w-full' : 'm-auto w-[min(94vw,960px)]'} overflow-hidden rounded-2xl border border-slate-200 bg-white p-0 text-slate-900 shadow-sm backdrop:bg-slate-950/40`} aria-labelledby="leave-review-title">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-gradient-to-r from-indigo-50/60 via-white to-white px-6 py-4">
        <div className="flex items-center gap-3"><span className="rounded-lg border border-indigo-100 bg-white p-2 text-indigo-600"><CalendarDaysIcon className="h-5 w-5" /></span><div><h2 id="leave-review-title" className="text-base font-semibold">Leave request</h2><p className="mt-0.5 text-xs text-slate-500">Employee leave & approval</p></div></div>
        <div className="flex items-center gap-2"><button type="button" disabled={!canPrint || saving || printing} onClick={print} title={canPrint ? 'Print selected leave request' : 'Available after all required approvals are complete'} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:border-indigo-300 hover:text-indigo-700 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-40"><PrinterIcon className="h-4 w-4" />{printing ? 'Preparing...' : 'Print'}</button>{!page && <button type="button" disabled={saving} onClick={onClose} className="rounded-lg px-3 py-2 text-sm text-slate-600">Close</button>}</div>
      </header>
      <div className={page ? '' : 'max-h-[75vh] overflow-y-auto'}>
        {error && <p role="alert" className="m-5 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
        {!request && !error && <p role="status" className="p-8 text-sm text-slate-500">Loading request...</p>}
        {request && <>
          <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-6">
            <div className="flex min-w-0 items-center gap-4">{request.employee_photo_url && failedPhoto !== request.employee_photo_url ? <img src={request.employee_photo_url} alt={`${request.employee_name || 'Employee'} profile`} onError={() => setFailedPhoto(request.employee_photo_url)} className="h-12 w-12 shrink-0 rounded-xl object-cover" /> : <div aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-lg font-semibold text-indigo-700">{(request.employee_name || 'Employee').split(' ').filter(Boolean).slice(0, 2).map(word => word[0]).join('')}</div>}<div className="min-w-0"><h3 className="break-words text-xl font-semibold tracking-tight">{request.employee_name || 'Employee'}</h3><p className="mt-1 text-sm text-slate-500">{[request.employee_code, request.department].filter(Boolean).join(' / ') || 'Leave application'}</p></div></div>
            <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${statusStyle}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{statusLabel}</span>
          </div>
          <div className="mx-6 mb-6 grid grid-cols-1 divide-y divide-indigo-100 overflow-hidden rounded-xl border border-indigo-100 bg-indigo-50/40 sm:grid-cols-[1fr_1.6fr_0.8fr] sm:divide-x sm:divide-y-0">
            <div className="px-4 py-4"><p className="text-xs text-slate-500">Leave type</p><p className="mt-2 text-sm font-semibold">{request.leave_type_detail?.name || 'Leave'}</p></div>
            <div className="px-4 py-4"><p className="text-xs text-slate-500">Requested dates</p><p className="mt-2 flex flex-wrap items-center gap-2 text-sm font-semibold">{date(request.start_date)}<ArrowRightIcon aria-hidden="true" className="h-4 w-4 text-indigo-400" />{date(request.end_date)}</p></div>
            <div className="px-4 py-3"><p className="text-xs text-slate-500">Duration</p><p className="mt-1 text-2xl font-semibold text-indigo-700">{Number(request.days_requested)} <span className="text-sm font-normal text-slate-600">{Number(request.days_requested) === 1 ? 'day' : 'days'}</span></p>{request.half_day && <p className="text-xs text-indigo-600">Half-day request</p>}</div>
          </div>
          <div className={`grid border-t border-slate-100 ${page ? 'lg:grid-cols-[minmax(0,1.5fr)_minmax(300px,1fr)]' : 'md:grid-cols-2'}`}>
            <section className="min-w-0 space-y-6 p-6" aria-label="Request details">
              <h4 className="flex items-center gap-2 text-sm font-semibold"><DocumentTextIcon className="h-4 w-4 text-indigo-500" />Request details</h4>
              <dl className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2 text-sm">
                {[
                  ['Manager', request.line_manager_name || (directHR ? 'No manager assigned' : 'Manager not available')],
                  ['Substitute', request.substitute_employee_name || request.substitute_name || 'Not provided'],
                  ['Contact during leave', request.contact_number || 'Not provided'],
                  ['Submitted on', date(request.created_at, true)],
                ].map(([label, value]) => <div key={label}><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1.5 break-words font-medium text-slate-700">{value}</dd></div>)}
              </dl>
              <div className="border-t border-slate-100 pt-5"><h4 className="text-xs font-medium text-slate-500">Reason for leave</h4><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{request.reason || 'No reason provided.'}</p></div>
              {request.attachment && <a className="inline-flex items-center gap-2 rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100" href={request.attachment} target="_blank" rel="noreferrer"><DocumentTextIcon className="h-4 w-4" />View supporting document</a>}
            </section>
            <aside className="border-t border-slate-100 bg-slate-50/70 p-6 lg:border-l lg:border-t-0">
              <h4 className="flex items-center gap-2 text-sm font-semibold"><ClockIcon className="h-4 w-4 text-indigo-500" />Approval progress</h4>
              <ol className="mt-5" aria-label="Approval history">{steps.map((step, index) => <li key={step.title} className="relative flex gap-3 pb-5 last:pb-0">
                {index < steps.length - 1 && <span aria-hidden="true" className="absolute bottom-0 left-3.5 top-7 w-px bg-slate-200" />}
                <span aria-hidden="true" className={`relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${step.rejected ? 'border-rose-200 bg-rose-50 text-rose-600' : step.complete ? 'border-emerald-200 bg-emerald-50 text-emerald-600' : step.active ? 'border-indigo-200 bg-indigo-100 text-indigo-700' : 'border-slate-200 bg-white text-slate-400'}`}>{step.complete ? <CheckIcon className="h-4 w-4" /> : step.rejected ? '!' : index + 1}</span>
                <div className="min-w-0 pt-0.5"><p className="text-sm font-medium">{step.title}<span className="ml-2 text-xs font-normal text-slate-500">{step.skipped ? 'Not required' : step.rejected ? 'Declined' : step.complete ? 'Complete' : step.active ? 'Current step' : pending ? 'Waiting' : 'Not completed'}</span></p><p className="mt-1 break-words text-xs text-slate-500">{step.detail}{step.label ? ` / ${step.label}` : ''}</p>{step.at && <p className="mt-1 text-xs text-slate-400">{date(step.at, true)}</p>}{step.note && <p className="mt-2 whitespace-pre-wrap break-words rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-600">{step.note}</p>}</div>
              </li>)}</ol>
            </aside>
          </div>
          <footer className="border-t border-slate-200 bg-white p-6">
            {request.can_review ? <div className="space-y-4"><div><h4 className="text-sm font-semibold">Your decision</h4><p className="mt-1 text-xs text-slate-500">{status === 'PENDING' && !directHR ? 'Your approval sends this request to HR for the final decision.' : 'Your approval completes the leave approval process.'}</p></div><label className="block text-sm font-medium text-slate-700">Comment <span className="font-normal text-slate-500">(required to reject)</span><textarea value={note} onChange={event => setNote(event.target.value)} disabled={saving} placeholder="Add a comment for the employee..." className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50/50 p-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" rows={3} /></label><div className="flex flex-wrap justify-end gap-3"><button type="button" disabled={saving} onClick={() => decide('reject')} className="rounded-lg border border-rose-200 px-4 py-2.5 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50">Reject</button><button type="button" disabled={saving} onClick={() => decide('approve')} className="rounded-lg bg-indigo-700 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-800 disabled:opacity-50">{saving ? 'Saving...' : status === 'PENDING' && !directHR ? 'Approve and send to HR' : 'Approve leave'}</button></div></div> : <div className="flex items-start gap-3 text-sm"><UserIcon className="mt-0.5 h-5 w-5 shrink-0 text-indigo-500" /><div><p className="font-medium text-slate-700">{pending ? 'With the current approver' : 'Review complete'}</p><p className="mt-1 text-xs leading-5 text-slate-500">{status === 'PENDING' && !directHR ? 'Awaiting the assigned manager. HR can act after manager approval.' : status === 'RM_APPROVED' || directHR ? 'Awaiting the assigned HR approver.' : 'This request has no pending approval action.'}</p></div></div>}
          </footer>
        </>}
      </div>
    </Container>
  )
}
