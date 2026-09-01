import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowPathIcon, ChevronRightIcon, EnvelopeIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import apiService from '../../services/api.service'

const PAGE_SIZE = 20
const API = { list: '/enquiry/', stats: '/enquiry/stats/' }
const STATUS = [
  ['', 'All statuses'], ['new', 'New'], ['assigned', 'Assigned'],
  ['in_progress', 'In Progress'], ['waiting_user', 'Waiting for User'],
  ['responded', 'Responded'], ['escalated', 'Escalated'],
  ['pending_confirmation', 'Awaiting Confirmation'], ['reopened', 'Reopened'],
  ['resolved', 'Resolved'], ['closed', 'Closed'], ['spam', 'Spam'],
]
const URGENCY = [['', 'All priorities'], ['low', 'Low'], ['normal', 'Normal'], ['high', 'High'], ['urgent', 'Urgent']]
const STATUS_TONE = {
  new: 'bg-blue-50 text-blue-700', assigned: 'bg-cyan-50 text-cyan-700',
  in_progress: 'bg-amber-50 text-amber-700', waiting_user: 'bg-violet-50 text-violet-700',
  responded: 'bg-indigo-50 text-indigo-700', resolved: 'bg-emerald-50 text-emerald-700',
  escalated: 'bg-red-50 text-red-700', pending_confirmation: 'bg-fuchsia-50 text-fuchsia-700',
  reopened: 'bg-orange-50 text-orange-700',
  closed: 'bg-slate-100 text-slate-600', spam: 'bg-slate-100 text-slate-600',
}
const MIX_COLORS = ['#2563eb', '#0093a3', '#617aad', '#7fcab5', '#f59e0b', '#8b5cf6']

const number = (value) => Number(value || 0).toLocaleString()
const date = (value, compact = false) => value
  ? new Date(value).toLocaleString(undefined, compact
    ? { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }
    : { year: 'numeric', month: 'short', day: '2-digit' })
  : '—'
const label = (value = '') => value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())

export default function EnquiryManagement () {
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [stats, setStats] = useState(null)
  const [count, setCount] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [urgency, setUrgency] = useState('')
  const [department, setDepartment] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [listResponse, statsResponse] = await Promise.all([
        apiService.get(API.list, { params: { page, page_size: PAGE_SIZE, search: search || undefined, status: status || undefined, urgency: urgency || undefined, department: department || undefined } }),
        apiService.get(API.stats),
      ])
      setItems(listResponse.data?.results || [])
      setCount(listResponse.data?.count || 0)
      setStats(statsResponse.data || null)
    } catch (requestError) {
      setError(requestError?.response?.data?.detail || requestError?.message || 'Could not load enquiries.')
    } finally { setLoading(false) }
  }, [department, page, search, status, urgency])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [search, status, urgency, department])

  const departments = useMemo(() => stats?.by_department?.map((row) => row.name).filter((name) => name !== 'Unrouted') || [], [stats])
  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE))
  const active = (stats?.total || 0) - (stats?.by_status?.resolved || 0) - (stats?.by_status?.closed || 0) - (stats?.by_status?.spam || 0)

  return (
    <main className="min-h-full w-full min-w-0 bg-[#f5f8fc] p-4 font-sans text-slate-800 sm:p-5">
      <header className="mb-5 grid items-end gap-3 rounded-2xl bg-gradient-to-r from-slate-950 via-blue-950 to-indigo-900 p-5 text-white shadow-lg xl:grid-cols-[auto_minmax(320px,1fr)_auto_auto]">
        <div className="xl:pr-4">
          <div className="flex items-center gap-2"><span className="grid h-9 w-9 place-content-center rounded-xl bg-white/10 ring-1 ring-white/15"><EnvelopeIcon className="h-5 w-5 text-cyan-300" /></span><h1 className="text-xl font-bold tracking-tight">Enquiry Operations</h1></div>
          <p className="mt-1 text-xs text-slate-300">Assignment, service performance and requester response control</p>
        </div>
        <div className="relative min-w-0"><MagnifyingGlassIcon className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search reference, requester or subject" className="w-full rounded-xl border border-white/20 bg-white py-2 pl-9 pr-3 text-xs text-slate-800 shadow-sm outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-300/30" /></div>
        <div className="flex flex-wrap gap-2 rounded-xl border border-white/15 bg-white/10 p-1 backdrop-blur-sm">
          <Select value={status} onChange={setStatus} options={STATUS} />
          <Select value={urgency} onChange={setUrgency} options={URGENCY} />
          <select value={department} onChange={(event) => setDepartment(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"><option value="">All departments</option>{departments.map((name) => <option key={name}>{name}</option>)}</select>
        </div>
        <button onClick={load} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/20"><ArrowPathIcon className="h-4 w-4" />Refresh dashboard</button>
      </header>

      <section className="grid gap-4 xl:grid-cols-3">
        <Panel title="Overall request status">
          <div className="grid grid-cols-3 gap-4 py-1">
            <Metric label="Active requests" value={number(active)} note={`${stats?.assigned_to_me || 0} assigned to you`} tone="green" />
            <Metric label="All requests" value={number(stats?.total)} note={`${stats?.new || 0} awaiting triage`} tone="blue" />
            <Metric label="Avg response" value={`${stats?.average_response_hours || 0}h`} note={`${stats?.overdue || 0} overdue`} tone={stats?.overdue ? 'red' : 'green'} />
          </div>
        </Panel>

        <Panel title="Service health index">
          <div className="flex items-center gap-6">
            <Gauge value={stats?.sla_compliance ?? 100} />
            <div className="text-xs leading-5 text-slate-600"><div className="mb-1 uppercase tracking-wide text-slate-400">SLA rating</div><span className="rounded-sm bg-emerald-50 px-2 py-1 font-bold text-emerald-800">{(stats?.sla_compliance ?? 100) >= 90 ? 'OPTIMAL' : 'ATTENTION'}</span><div className="mt-2">• {stats?.overdue || 0} overdue requests</div><div>• {stats?.unassigned || 0} unassigned requests</div></div>
          </div>
        </Panel>

        <Panel title="Critical findings & actions">
          <div className="grid grid-cols-3 gap-3">
            <Signal value={stats?.by_urgency?.urgent || 0} label="Urgent" tone="red" />
            <Signal value={stats?.by_urgency?.high || 0} label="High priority" tone="amber" />
            <Signal value={stats?.new || 0} label="New requests" tone="green" />
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel title="Request trend (last six months)"><Trend rows={stats?.monthly_trend || []} /></Panel>
          <Panel title="Workflow stage funnel"><Funnel values={stats?.funnel || {}} /></Panel>
        </div>

        <Panel title="High priority enquiries">
          <CompactTable rows={stats?.priority_items || []} onOpen={(id) => navigate(`/admin/enquiries/${id}`)} />
          <button onClick={() => document.getElementById('enquiry-register')?.scrollIntoView({ behavior: 'smooth' })} className="mt-3 flex w-full items-center justify-end gap-1 border-t pt-3 text-xs font-bold text-blue-700">View all enquiries <ChevronRightIcon className="h-3 w-3" /></button>
        </Panel>

        <div className="space-y-4">
          <Panel title="Request mix by department"><DepartmentMix rows={stats?.by_department || []} total={stats?.total || 0} /></Panel>
          <Panel title="Upcoming response deadlines"><Deadlines rows={stats?.deadlines || []} onOpen={(id) => navigate(`/admin/enquiries/${id}`)} /></Panel>
        </div>
      </section>

      <section id="enquiry-register" className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-end gap-2 border-b border-slate-200 p-4">
          <div className="mr-auto"><h2 className="text-sm font-bold uppercase tracking-wider">Enquiry register</h2><p className="mt-1 text-xs text-slate-500">Open a record to manage assignment, replies, notes and status.</p></div>
          {(search || status || urgency || department) && <button onClick={() => { setSearch(''); setStatus(''); setUrgency(''); setDepartment('') }} className="text-xs font-bold text-blue-700">Clear active filters</button>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[950px] text-left text-xs">
            <thead className="bg-slate-50 uppercase tracking-wide text-slate-500"><tr><Th>Reference</Th><Th>Requester</Th><Th>Subject</Th><Th>Department</Th><Th>Owner</Th><Th>Priority</Th><Th>Status</Th><Th>Due</Th><Th /></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {loading && <tr><td colSpan="9" className="p-10 text-center text-slate-500">Loading enquiries…</td></tr>}
              {!loading && error && <tr><td colSpan="9" className="p-10 text-center text-red-600">{error}</td></tr>}
              {!loading && !error && !items.length && <tr><td colSpan="9" className="p-10 text-center text-slate-500">No enquiries match these filters.</td></tr>}
              {!loading && !error && items.map((row) => <tr key={row.id} onClick={() => navigate(`/admin/enquiries/${row.id}`)} className="cursor-pointer transition hover:bg-blue-50/60"><Td className="font-mono font-semibold text-blue-700">{row.reference}</Td><Td><div className="font-semibold text-slate-800">{row.name}</div><div className="text-[11px] text-slate-400">{row.company || row.email}</div></Td><Td className="max-w-[280px] truncate font-medium">{row.subject}</Td><Td>{row.department || 'Unrouted'}</Td><Td>{row.assigned_to?.name || 'Unassigned'}</Td><Td><Priority value={row.urgency} /></Td><Td><Status value={row.status} /></Td><Td className={row.is_overdue ? 'font-bold text-red-600' : ''}>{date(row.due_at, true)}</Td><Td><ChevronRightIcon className="h-4 w-4 text-slate-400" /></Td></tr>)}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t bg-slate-50 px-4 py-3 text-xs text-slate-500"><span>{count ? `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, count)} of ${count}` : '0 records'}</span><div className="flex items-center gap-2"><button disabled={page === 1} onClick={() => setPage((value) => value - 1)} className="rounded border bg-white px-3 py-1.5 disabled:opacity-40">Previous</button><span>{page} / {totalPages}</span><button disabled={page === totalPages} onClick={() => setPage((value) => value + 1)} className="rounded border bg-white px-3 py-1.5 disabled:opacity-40">Next</button></div></div>
      </section>
    </main>
  )
}

const Panel = ({ title, children, className = '' }) => <article className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}><h2 className="mb-4 text-[11px] font-bold uppercase tracking-[0.13em] text-[#2b3a55]">{title}</h2>{children}</article>
const Metric = ({ label: text, value, note, tone }) => <div><div className="text-[10px] text-slate-500">{text}</div><div className="mt-1 text-3xl font-bold tracking-tight text-slate-800">{value}</div><span className={`mt-2 inline-block rounded-sm px-1.5 py-0.5 text-[9px] font-bold ${tone === 'red' ? 'bg-red-50 text-red-700' : tone === 'blue' ? 'bg-blue-50 text-blue-700' : 'bg-emerald-50 text-emerald-700'}`}>{note}</span></div>
const Signal = ({ value, label: text, tone }) => <div className={`rounded-sm py-5 text-center ${tone === 'red' ? 'bg-red-50 text-red-700' : tone === 'amber' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}><div className="text-2xl font-black">{value}</div><div className="mt-1 text-[10px] font-bold">{text}</div></div>
const Gauge = ({ value }) => { const safe = Math.min(100, Math.max(0, value)); return <div className="relative h-24 w-24 shrink-0"><svg viewBox="0 0 100 100" className="h-full w-full -rotate-90"><circle cx="50" cy="50" r="39" fill="none" stroke="#e5e7eb" strokeWidth="9" strokeDasharray="196 50" strokeLinecap="round"/><circle cx="50" cy="50" r="39" fill="none" stroke="#2563eb" strokeWidth="9" strokeDasharray={`${safe * 1.96} 246`} strokeLinecap="round"/></svg><div className="absolute inset-0 grid place-content-center text-center"><strong className="text-lg">{safe}%</strong><span className="text-[9px] text-slate-400">Target 95%</span></div></div> }
const Trend = ({ rows }) => { const values = rows.length ? rows.map((row) => row.count) : [0]; const max = Math.max(...values, 1); const points = rows.map((row, index) => `${12 + (index * 76 / Math.max(rows.length - 1, 1))},${74 - (row.count / max) * 54}`).join(' '); return <div><svg viewBox="0 0 100 82" preserveAspectRatio="none" className="h-40 w-full"><defs><linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2563eb" stopOpacity=".28"/><stop offset="1" stopColor="#2563eb" stopOpacity="0"/></linearGradient></defs>{[20,47,74].map((y) => <line key={y} x1="10" x2="92" y1={y} y2={y} stroke="#e2e8f0" strokeWidth=".5" />)}{rows.length > 1 && <><polygon points={`12,74 ${points} 88,74`} fill="url(#trend-fill)"/><polyline points={points} fill="none" stroke="#2563eb" strokeWidth="2" vectorEffect="non-scaling-stroke"/></>}</svg><div className="flex justify-between text-[9px] text-slate-400">{rows.map((row) => <span key={row.month}>{row.month}</span>)}</div></div> }
const Funnel = ({ values }) => { const rows = [['Intake', values.intake], ['Assigned', values.assigned], ['In review', values.in_review], ['Resolution', values.resolution]]; const max = Math.max(values.intake || 0, 1); return <div className="space-y-4">{rows.map(([name, value], index) => <div key={name} className="grid grid-cols-[70px_1fr_70px] items-center gap-2 text-xs"><strong>{name}</strong><div className="h-8 bg-slate-100"><div style={{ width: `${Math.max(4, (value || 0) / max * 100)}%`, backgroundColor: MIX_COLORS[index] }} className="h-full" /></div><span className="text-right text-slate-500">{value || 0} · {Math.round((value || 0) / max * 100)}%</span></div>)}</div> }
const CompactTable = ({ rows, onOpen }) => <div className="overflow-x-auto"><table className="w-full text-left text-[11px]"><thead className="border-b text-[9px] uppercase text-slate-400"><tr><th className="pb-2">ID</th><th className="pb-2">Request</th><th className="pb-2">Dept</th><th className="pb-2">Status</th></tr></thead><tbody className="divide-y">{rows.length ? rows.map((row) => <tr key={row.id} onClick={() => onOpen(row.id)} className="cursor-pointer hover:bg-slate-50"><td className="py-3 font-mono">{row.reference}</td><td className="max-w-[190px] truncate py-3 font-semibold">{row.subject}</td><td className="py-3 text-slate-500">{row.department}</td><td className="py-3"><Status value={row.status} /></td></tr>) : <tr><td colSpan="4" className="py-8 text-center text-slate-400">No active priority requests</td></tr>}</tbody></table></div>
const DepartmentMix = ({ rows, total }) => { const top = rows.slice(0, 5); let cursor = 0; const segments = top.map((row, index) => { const start = cursor; cursor += total ? row.count / total * 100 : 0; return `${MIX_COLORS[index]} ${start}% ${cursor}%` }); if (cursor < 100) segments.push(`#e2e8f0 ${cursor}% 100%`); return <div className="flex items-center gap-6"><div style={{ background: `conic-gradient(${segments.join(',')})` }} className="relative h-28 w-28 shrink-0 rounded-full"><div className="absolute inset-6 grid place-content-center rounded-full bg-white text-center"><strong className="text-lg">{number(total)}</strong><span className="text-[8px] text-slate-400">Requests</span></div></div><div className="min-w-0 flex-1 space-y-2">{top.map((row, index) => <div key={row.name} className="flex items-start gap-2 text-[10px]"><span style={{ backgroundColor: MIX_COLORS[index] }} className="mt-1 h-2 w-2 shrink-0 rounded-full"/><span className="min-w-0 flex-1 truncate font-semibold">{row.name}</span><span className="text-slate-400">{row.count}</span></div>)}</div></div> }
const Deadlines = ({ rows, onOpen }) => <div className="space-y-2">{rows.length ? rows.map((row) => <button key={row.id} onClick={() => onOpen(row.id)} className={`w-full rounded-r-lg border-l-2 px-3 py-2 text-left transition hover:bg-blue-50 ${row.is_overdue ? 'border-red-500' : 'border-blue-600'}`}><div className="truncate text-[11px] font-bold">{row.subject}</div><div className="mt-1 flex justify-between text-[9px] text-slate-500"><span>Due {date(row.due_at, true)}</span><Status value={row.status} /></div></button>) : <div className="py-8 text-center text-xs text-slate-400">No upcoming deadlines</div>}</div>
const Status = ({ value }) => <span className={`inline-flex rounded-sm px-2 py-0.5 text-[9px] font-bold uppercase ${STATUS_TONE[value] || 'bg-slate-100 text-slate-600'}`}>{label(value)}</span>
const Priority = ({ value }) => <span className={`font-bold capitalize ${value === 'urgent' ? 'text-red-600' : value === 'high' ? 'text-amber-600' : 'text-slate-500'}`}>{value}</span>
const Select = ({ value, onChange, options }) => <select value={value} onChange={(event) => onChange(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200">{options.map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select>
const Th = ({ children }) => <th className="px-4 py-3 text-[10px] font-bold">{children}</th>
const Td = ({ children, className = '' }) => <td className={`px-4 py-3 ${className}`}>{children}</td>
