import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import apiClient from '../../services/api.service'
import LeaveApprovalReview, { leaveError } from '../../components/approvals/LeaveApprovalReview'

const LIST_URL = '/payroll/leave-requests/?ordering=-created_at&page_size=10'
const dateLabel = value => {
  if (!value) return '\u2014'
  const date = new Date(`${value.slice(0, 10)}T12:00:00`)
  return Number.isNaN(date.getTime()) ? '\u2014' : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}
const reportBack = request => {
  if (['CANCELLED', 'REJECTED', 'RM_REJECTED'].includes(request.status) || !request.end_date) return '\u2014'
  const date = new Date(`${request.end_date.slice(0, 10)}T12:00:00`)
  if (Number.isNaN(date.getTime())) return '\u2014'
  do { date.setDate(date.getDate() + 1) } while ([0, 6].includes(date.getDay()))
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function LeaveRequestReviewPage() {
  const { requestId } = useParams()
  const navigate = useNavigate()
  const [requests, setRequests] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [next, setNext] = useState(null)
  const [previous, setPrevious] = useState(null)
  const [pageNumber, setPageNumber] = useState(1)
  const currentUrl = useRef(LIST_URL)
  const [count, setCount] = useState(0)
  const sequence = useRef(0)
  const load = useCallback(async (url = currentUrl.current) => {
    currentUrl.current = url
    const current = ++sequence.current
    setLoading(true)
    setError('')
    try {
      const { data } = await apiClient.get(url)
      if (current !== sequence.current) return
      const rows = Array.isArray(data) ? data : data.results || []
      setRequests([...rows].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)))
      currentUrl.current = url
      setPageNumber(Number(new URL(url, window.location.origin).searchParams.get('page') || 1))
      setPrevious(data.previous || null)
      setNext(data.next || null)
      setCount(data.count ?? rows.length)
    } catch (err) { if (current === sequence.current) setError(leaveError(err)) }
    finally { if (current === sequence.current) setLoading(false) }
  }, [])
  useEffect(() => {
    const timer = setTimeout(() => load(`${LIST_URL}&search=${encodeURIComponent(search.trim())}`), search ? 300 : 0)
    return () => { clearTimeout(timer); sequence.current += 1 }
  }, [load, search])
  const updated = () => {
    window.dispatchEvent(new Event('leave-approval-updated'))
    load()
  }
  return <main className="w-full min-w-0 space-y-4 p-4 lg:p-6">
    <Link to="/hr" className="inline-flex text-sm font-medium text-indigo-700">Back to HR dashboard</Link>
    <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white" aria-label="All leave requests">
        <header className="flex flex-wrap items-center gap-4 border-b border-slate-200 p-5">
          <h1 className="text-lg font-semibold text-slate-900">All leave requests</h1>
          <input type="search" aria-label="Search leave requests by name or employee ID" placeholder="Search name or employee ID" value={search} onChange={event => { sequence.current += 1; setLoading(true); setSearch(event.target.value) }} className="min-w-0 flex-1 basis-48 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
          <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">{count} requests</span>
        </header>
        {error && <div role="alert" className="m-4 text-sm text-rose-700">{error}<button type="button" onClick={() => load()} className="ml-3 underline">Retry</button></div>}
        <div className="max-h-[70vh] overflow-y-auto">
          <table className="w-full table-fixed text-left text-sm [overflow-wrap:anywhere]">
            <caption className="sr-only">Leave requests ordered by submission date, newest first</caption>
            <colgroup>{[14, 13, 16, 15, 14, 14, 14].map((width, index) => <col key={index} style={{ width: `${width}%` }} />)}</colgroup>
            <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-slate-500"><tr>{['Date', 'EmpID', 'Name', 'Requested days', 'Starting', 'End', 'Report back'].map(label => <th key={label} scope="col" title={label === 'Report back' ? 'Expected next working day (Mon-Fri)' : undefined} aria-sort={label === 'Date' ? 'descending' : undefined} className="px-2 py-3 font-medium">{label}{label === 'Date' ? ' \u2193' : ''}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">{requests.map(request => {
              const selected = String(request.id) === requestId
              return <tr key={request.id} onClick={() => navigate(`/hr/leave-requests/${encodeURIComponent(request.id)}`)} className={`cursor-pointer transition-colors ${selected ? 'bg-indigo-50 ring-1 ring-inset ring-indigo-200' : 'hover:bg-slate-50'}`}>
                <td className="px-2 py-2.5 text-slate-600">{dateLabel(request.created_at)}</td>
                <td className="px-2 py-2.5 text-slate-600">{request.employee_code || '\u2014'}</td>
                <td className="px-2 py-2.5"><Link aria-current={selected ? 'true' : undefined} onClick={event => event.stopPropagation()} to={`/hr/leave-requests/${encodeURIComponent(request.id)}`} className="font-semibold text-indigo-700 underline-offset-4 hover:underline focus-visible:outline-indigo-600">{request.employee_name || 'Employee'}</Link></td>
                <td className="px-2 py-2.5 font-medium tabular-nums text-slate-700">{Number(request.days_requested)}</td>
                <td className="px-2 py-2.5 text-slate-600">{dateLabel(request.start_date)}</td>
                <td className="px-2 py-2.5 text-slate-600">{dateLabel(request.end_date)}</td>
                <td className="px-2 py-2.5 text-slate-600">{reportBack(request)}</td>
              </tr>
            })}</tbody>
          </table>
          {!loading && !error && !requests.length && <p className="p-8 text-center text-sm text-slate-500">No leave requests found.</p>}
          {loading && <p role="status" className="p-4 text-sm text-slate-500">Loading requests...</p>}
        </div>
        <footer className="space-y-3 border-t border-slate-200 px-4 py-3 text-xs text-slate-500">
          <div className="flex flex-wrap items-center justify-between gap-3"><p>Showing {requests.length ? (pageNumber - 1) * 10 + 1 : 0} to {(pageNumber - 1) * 10 + requests.length} of {count} requests</p><nav aria-label="Leave request pagination" className="flex items-center gap-2"><button type="button" disabled={loading || !previous} onClick={() => load(previous)} className="rounded-lg border border-slate-200 px-3 py-2 text-indigo-700 disabled:cursor-not-allowed disabled:opacity-40">Previous</button><span>Page {pageNumber} of {Math.max(1, Math.ceil(count / 10))}</span><button type="button" disabled={loading || !next} onClick={() => load(next)} className="rounded-lg border border-slate-200 px-3 py-2 text-indigo-700 disabled:cursor-not-allowed disabled:opacity-40">Next</button></nav></div>
        </footer>
      </section>
      <div className="min-w-0" aria-label="Selected leave request">
        {requestId ? <LeaveApprovalReview key={requestId} requestId={requestId} page onClose={() => navigate('/hr/leave-requests')} onUpdated={updated} /> : <section className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center"><h2 className="text-base font-semibold text-slate-700">Select a leave request</h2><p className="mt-2 text-sm text-slate-500">Employee details and approval actions will appear here.</p></section>}
      </div>
    </div>
  </main>
}
