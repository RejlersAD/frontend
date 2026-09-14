import ProfileMetricCard from './ProfileMetricCard'
import { useState } from 'react'
import { CalendarDaysIcon, ClockIcon, ChevronDownIcon } from '@heroicons/react/24/outline'

const pendingStatuses = ['PENDING', 'RM_APPROVED']
const statusMeta = {
  PENDING: ['Awaiting manager', 'border-amber-200 bg-amber-50 text-amber-800'],
  RM_APPROVED: ['Awaiting HR', 'border-indigo-200 bg-indigo-50 text-indigo-800'],
  APPROVED: ['Approved', 'border-emerald-200 bg-emerald-50 text-emerald-800'],
  RM_REJECTED: ['Declined by manager', 'border-rose-200 bg-rose-50 text-rose-800'],
  REJECTED: ['Declined by HR', 'border-rose-200 bg-rose-50 text-rose-800'],
  CANCELLED: ['Cancelled', 'border-slate-200 bg-slate-50 text-slate-600'],
}
const days = value => Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 1 })
const duration = value => `${days(value)} ${Number(value) === 1 ? 'day' : 'days'}`
const leaveName = request => request.leave_type_detail?.name || request.leave_type_display || 'Leave request'
const dateLabel = value => value ? new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '\u2014'

export function LeavePanel({ title, subtitle, children }) {
  return <section className="min-w-0 rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
    <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-700"><h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h3>{subtitle && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>}</div>
    <div className="p-5">{children}</div>
  </section>
}

export function ProfileLeaveSummary({ leaveRecord, requests = [], loading, typeConfig }) {
  const approved = requests.filter(request => request.status?.toUpperCase() === 'APPROVED')
  const pending = requests.filter(request => pendingStatuses.includes(request.status?.toUpperCase()))
  const metrics = [
    ['Available annual leave', leaveRecord ? `${days(leaveRecord.leave_balance)} days` : '\u2014', leaveRecord ? `${days(leaveRecord.total_earned)} days earned` : 'Balance not configured', 'blue'],
    ['Approved leave', `${days(approved.reduce((total, request) => total + Number(request.days_requested || 0), 0))} days`, 'Across loaded approved requests', 'emerald'],
    ['Awaiting approval', pending.length, `${pending.filter(request => request.status?.toUpperCase() === 'PENDING').length} with manager / ${pending.filter(request => request.status?.toUpperCase() === 'RM_APPROVED').length} with HR`, 'amber'],
    ['Encashed annual leave', leaveRecord ? `${days(leaveRecord.total_encashed)} days` : '\u2014', 'Recorded leave encashment', 'indigo'],
  ]
  return <div className="space-y-3">
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-busy={loading}>
      {metrics.map(([label, value, sub, tone]) => <ProfileMetricCard key={label} icon={<CalendarDaysIcon />} label={label} value={loading ? '\u2014' : value} sub={sub} tone={tone === 'emerald' ? 'green' : tone === 'indigo' ? 'purple' : tone} />)}
    </div>
    <details className="rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      <summary className="cursor-pointer px-5 py-3 text-sm font-medium text-slate-700 dark:text-slate-200">Leave types and allowances <span className="ml-2 text-xs font-normal text-slate-500">View breakdown</span></summary>
      <div className="overflow-x-auto border-t border-slate-100 px-5 pb-3 dark:border-slate-700"><table className="w-full text-left text-sm"><thead><tr className="text-xs text-slate-500"><th className="py-3 font-medium">Leave type</th><th className="py-3 text-right font-medium">Configured allowance</th><th className="py-3 text-right font-medium">Approved days*</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-700">{Object.entries(typeConfig).filter(([, config]) => config.enabled !== false).map(([key, config]) => {
        const usage = approved.filter(request => (request.leave_type_detail?.category || '').toLowerCase() === key || (!request.leave_type_detail?.category && leaveName(request).toLowerCase() === config.label.toLowerCase())).reduce((total, request) => total + Number(request.days_requested || 0), 0)
        const allowance = key === 'annual' ? leaveRecord?.annual_entitlement ?? config.entitlement : config.entitlement
        return <tr key={key}><td className="py-2.5 text-slate-700 dark:text-slate-200">{config.label}</td><td className="py-2.5 text-right text-slate-500">{allowance > 0 ? `${days(allowance)} days` : 'As applicable'}</td><td className="py-2.5 text-right tabular-nums text-slate-700 dark:text-slate-200">{loading ? '\u2014' : days(usage)}</td></tr>
      })}</tbody></table><p className="mt-2 text-xs text-slate-500">*From loaded approved requests. Eligibility and available balances are confirmed by HR.</p></div>
    </details>
  </div>
}

export function ProfileLeaveRequests({ requests = [], loading }) {
  const [filter, setFilter] = useState('all')
  const options = [['all', 'All requests'], ['pending', 'Awaiting approval'], ['approved', 'Approved'], ['closed', 'Closed']]
  const visible = [...requests].filter(request => {
    const status = request.status?.toUpperCase()
    return filter === 'all' || (filter === 'pending' && pendingStatuses.includes(status)) || (filter === 'approved' && status === 'APPROVED') || (filter === 'closed' && ['REJECTED', 'RM_REJECTED', 'CANCELLED'].includes(status))
  }).sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
  return <LeavePanel title="My leave requests" subtitle="Track your request, current approver and decision history.">
    <div className="mb-4 flex flex-wrap gap-2" aria-label="Filter leave requests">{options.map(([id, label]) => <button key={id} type="button" onClick={() => setFilter(id)} aria-pressed={filter === id} className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${filter === id ? 'border-indigo-300 bg-indigo-50 text-indigo-800 dark:border-indigo-700 dark:bg-indigo-950 dark:text-indigo-200' : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'}`}>{label}</button>)}</div>
    {loading ? <p role="status" className="py-10 text-center text-sm text-slate-500">Loading your requests...</p> : !visible.length ? <div className="rounded-lg border border-dashed border-slate-200 px-4 py-12 text-center dark:border-slate-700"><CalendarDaysIcon className="mx-auto h-7 w-7 text-slate-400" /><p className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-200">{requests.length ? 'No requests match this filter' : 'Your next break starts here'}</p><p className="mt-1 text-xs text-slate-500">{requests.length ? 'Choose another status to see your requests.' : 'Submit a leave request to start the approval process.'}</p></div> : <div className="divide-y divide-slate-100 dark:divide-slate-700">{visible.map(request => {
      const status = request.status?.toUpperCase()
      const [label, tone] = statusMeta[status] || [request.status_display || 'Unknown', 'border-slate-200 bg-slate-50 text-slate-600']
      return <details key={request.id} className="group py-3 first:pt-0">
        <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 rounded-lg py-1 [&::-webkit-details-marker]:hidden">
          <div className="min-w-0"><p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{leaveName(request)} <span className="ml-2 font-normal text-slate-500">{duration(request.days_requested ?? request.duration_days)}</span></p><p className="mt-1 text-xs text-slate-500">{dateLabel(request.start_date)} to {dateLabel(request.end_date)}</p></div>
          <div className="flex items-center gap-2"><span className={`rounded-md border px-2 py-1 text-xs font-medium ${tone}`}>{label}</span><ChevronDownIcon className="h-4 w-4 text-slate-400 group-open:rotate-180" /></div>
        </summary>
        {pendingStatuses.includes(status) && <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500"><ClockIcon className="h-3.5 w-3.5" />Next: {status === 'PENDING' ? request.line_manager_name || 'Line manager review' : 'HR final review'}</p>}
        <div className="mt-3 space-y-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300"><p className="whitespace-pre-wrap"><span className="font-medium">Reason: </span>{request.reason || 'No reason provided.'}</p><ol className="space-y-2"><li>Submitted / {dateLabel(request.created_at)}</li><li>Line manager / {request.rm_reviewed_by_name || (status === 'PENDING' ? 'Awaiting review' : 'No recorded decision')}{request.rm_reviewed_at && ` / ${dateLabel(request.rm_reviewed_at)}`}{request.rm_note && <p className="mt-1 whitespace-pre-wrap">{request.rm_note}</p>}</li><li>HR / {request.reviewed_by_name || (status === 'RM_APPROVED' ? 'Awaiting review' : status === 'PENDING' ? 'After manager approval' : 'No recorded decision')}{request.reviewed_at && ` / ${dateLabel(request.reviewed_at)}`}{request.reviewer_note && <p className="mt-1 whitespace-pre-wrap">{request.reviewer_note}</p>}</li></ol></div>
      </details>
    })}<p className="pt-3 text-xs text-slate-500">{visible.length} of {requests.length} loaded requests</p></div>}
  </LeavePanel>
}
