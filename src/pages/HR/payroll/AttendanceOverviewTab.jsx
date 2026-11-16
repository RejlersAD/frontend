import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import * as Icons from '@heroicons/react/24/outline'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import ts from '../../../services/timesheet.service'
import payrollService from '../../../services/payroll.service'
import { empDept, empName, filterEmployeeRow } from '../../../config/hrAttendance.config'
import { BRANCHES } from '../../../config/hrLeave.config'
import { buildOverviewDay, overviewDateKeys } from './overviewAttendanceModel'

const EMPTY = { state: 'loading', data: null }
const dateObject = value => new Date(`${value}T12:00:00`)
const dateKey = value => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
const dateLabel = value => dateObject(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
const format = value => value == null ? '—' : value.toLocaleString('en-US', { maximumFractionDigits: 1 })
const errorMessage = error => error?.response?.status === 403 ? 'Access denied.' : error?.response?.status === 401 ? 'Session expired. Sign in again.' : 'Could not be loaded.'

// Keyed reads clear obsolete values immediately and ignore late responses.
function useOverviewRead(key, loader) {
  const [result, setResult] = useState({ key: null, ...EMPTY })
  useEffect(() => {
    let active = true
    setResult({ key, ...EMPTY })
    Promise.resolve().then(loader).then(data => {
      if (active) setResult({ key, state: 'loaded', data })
    }).catch(error => {
      if (active) setResult({ key, state: 'error', error: errorMessage(error), data: null })
    })
    return () => { active = false }
  }, [key, loader])
  return result.key === key ? result : EMPTY
}

function PanelState({ resource, label, onRetry, empty }) {
    if (resource.state === 'loading') return <p className="att-overview-empty" role="status">Loading {label.toLowerCase()}...</p>
  if (resource.state === 'error') return <div className="att-overview-empty att-overview-error" role="alert">{label}: {resource.error} <button type="button" className="att-overview-link" onClick={onRetry}>Retry {label.toLowerCase()}</button></div>
  return empty ? <p className="att-overview-empty">{empty}</p> : null
}

const AttentionCard = ({ title, sub, onClick }) => (
  <div className="att-attention-card" role="button" tabIndex={0} onClick={onClick} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onClick() } }}>
    <div className="att-attention-body"><span className="att-attention-title">{title}</span><span className="att-attention-sub">{sub}</span></div>
    <Icons.ChevronRightIcon className="att-attention-chevron" aria-hidden="true" />
  </div>
)

export default function AttendanceOverviewTab({ date, today, onDateChange, onOpenDaily, onOpenMatrix }) {
  const [branch, setBranch] = useState('all')
  const [department, setDepartment] = useState('all')
  const [search, setSearch] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [exportBusy, setExportBusy] = useState(false)
  const [exportError, setExportError] = useState('')
  const [week, setWeek] = useState({ key: '', days: {} })
  const year = Number(date.slice(0, 4))
  const weekKey = `${date}:${refresh}`
  const dates = useMemo(() => overviewDateKeys(date), [date])
  const branchYearsKey = [...new Set(dates.map(day => day.slice(0, 4)))].join(',')
  const retry = () => setRefresh(value => value + 1)

  useEffect(() => {
    let active = true
    setWeek({ key: weekKey, days: {} })
    dates.forEach(day => {
      ts.fetchDaily(day).then(response => {
        const rows = Array.isArray(response) ? response : response?.rows
        if (response?.configured === false || !Array.isArray(rows)) throw new Error('Attendance unavailable')
        if (active) setWeek(previous => ({ key: weekKey, days: { ...previous.days, [day]: { state: 'loaded', data: rows.filter(filterEmployeeRow) } } }))
      }).catch(error => {
        if (active) setWeek(previous => ({ key: weekKey, days: { ...previous.days, [day]: { state: 'error', data: null, error: errorMessage(error) } } }))
      })
    })
    return () => { active = false }
  }, [dates, weekKey])

  const approvals = useOverviewRead(String(refresh), useCallback(async () => {
    const response = await payrollService.getPendingLeaveApprovals()
    if (!Array.isArray(response?.results) || !Number.isSafeInteger(response.count) || response.count !== response.results.length) throw new Error('Invalid approval queue')
    return response
  }, []))
  const branchState = useOverviewRead(`${branchYearsKey}:${branch}:${refresh}`, useCallback(async () => {
    if (branch === 'all') return {}
    const entries = await Promise.all(branchYearsKey.split(',').map(async branchYear => {
      const response = await payrollService.getBranchEmployeeCodes(branch, Number(branchYear))
      if (!Array.isArray(response?.codes)) throw new Error('Invalid branch')
      return [branchYear, response.codes.map(String)]
    }))
    return Object.fromEntries(entries)
  }, [branch, branchYearsKey]))

  const current = week.key === weekKey ? week.days[date] || EMPTY : EMPTY
  const branchReady = branch === 'all' || branchState.state === 'loaded'
  const ready = current.state === 'loaded' && branchReady
  const codes = useMemo(() => Object.fromEntries(Object.entries(branchState.data || {}).map(([key, values]) => [key, new Set(values)])), [branchState.data])
  const filterBranch = (row, rowYear = year) => branch === 'all' || Boolean(codes[rowYear]?.has(String(row.employee_code || '')))
  const filterRow = (row, rowYear = year) => filterBranch(row, rowYear) && (department === 'all' || empDept(row) === department) && (!search.trim() || [empName(row), row.employee_code, empDept(row)].some(value => String(value || '').toLowerCase().includes(search.trim().toLowerCase())))
  const rows = ready ? current.data.filter(row => filterRow(row)) : []
  const totals = buildOverviewDay(rows)
  const departments = [...new Set((current.data || []).filter(row => filterBranch(row)).map(empDept))].sort()
  if (department !== 'all' && !departments.includes(department)) departments.push(department)
  const trend = dates.map(day => {
    const resource = week.key === weekKey ? week.days[day] || EMPTY : EMPTY
    return { date: day, label: dateObject(day).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }), records: branchReady && resource.state === 'loaded' ? resource.data.filter(row => filterRow(row, Number(day.slice(0, 4)))).length : null, state: resource.state }
  })
  const pendingLeave = approvals.state === 'loaded' ? approvals.data.count : null
  const openSessions = totals.openShifts == null ? '—' : totals.openShifts
  const attentionRequired = totals.late > 0 || (typeof totals.openShifts === 'number' && totals.openShifts > 0) || (typeof pendingLeave === 'number' && pendingLeave > 0)
  const metric = value => ready ? format(value) : '—'
  const stepDate = delta => {
    const next = dateObject(date)
    next.setDate(next.getDate() + delta)
    changeDate(dateKey(next))
  }
  const changeDate = value => {
    if (value <= today && overviewDateKeys(value).length) {
      onDateChange(value)
      setExportError('')
    }
  }
  const exportDay = async () => {
    setExportError('')
    setExportBusy(true)
    try { await ts.downloadDailyExcel(date) }
    catch { setExportError('The daily report could not be exported. Please try again.') }
    finally { setExportBusy(false) }
  }

  const deptIssues = useMemo(() => {
    const counts = new Map()
    totals.attention.forEach(item => {
      const dept = empDept(item.row)
      counts.set(dept, (counts.get(dept) || 0) + 1)
    })
    return [...counts.entries()].map(([dept, count]) => ({ dept, count })).sort((a, b) => b.count - a.count)
  }, [totals.attention])

  const todayPoint = trend[trend.length - 1]
  const todayRecords = todayPoint.records == null ? totals.records : todayPoint.records
  const prevPoints = trend.slice(0, -1).filter(point => point.records != null)
  const prevAvg = prevPoints.length ? prevPoints.reduce((sum, point) => sum + point.records, 0) / prevPoints.length : 0
  const changePct = prevAvg > 0 ? Math.round(((todayRecords - prevAvg) / prevAvg) * 100) : 0
  const changeLabel = changePct > 0 ? `↑ ${changePct}% versus previous week` : changePct < 0 ? `↓ ${Math.abs(changePct)}% versus previous week` : '— versus previous week'

  return <section className="att-overview" aria-label="Attendance overview">
    {/* ── Filters (unchanged) ── */}
    <div className="att-filter-panel att-overview-toolbar">
      <div className="att-date-navigation">
        <button type="button" className="att-button" aria-label="Previous overview day" disabled={exportBusy} onClick={() => stepDate(-1)}><Icons.ChevronLeftIcon /></button>
        <label className="att-date-picker"><Icons.CalendarDaysIcon /><span>{date === today ? 'Today · ' : ''}{dateLabel(date)}</span><input type="date" aria-label="Overview date" value={date} max={today} disabled={exportBusy} onChange={event => changeDate(event.target.value)} /></label>
        <button type="button" className="att-button" aria-label="Next overview day" disabled={date >= today || exportBusy} onClick={() => stepDate(1)}><Icons.ChevronRightIcon /></button>
        {date !== today && <button type="button" className="att-overview-link" disabled={exportBusy} onClick={() => changeDate(today)}>Today</button>}
      </div>
      <label className="att-field"><span>Branch</span><select aria-label="Branch" value={branch} onChange={event => setBranch(event.target.value)}><option value="all">All branches</option>{BRANCHES.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
      <label className="att-field"><span>Department</span><select aria-label="Department" value={department} onChange={event => setDepartment(event.target.value)}><option value="all">All departments</option>{departments.map(item => <option key={item}>{item}</option>)}</select></label>
      <label className="att-field att-search"><span>Search attendance</span><span className="att-search-box"><Icons.MagnifyingGlassIcon /><input aria-label="Employee search" placeholder="Employee name or ID" value={search} onChange={event => setSearch(event.target.value)} /></span></label>
      <div className="att-overview-tools">
        <button type="button" className="att-button" title="Excel · all permitted records for the selected date" disabled={exportBusy} onClick={exportDay}><Icons.ArrowDownTrayIcon />{exportBusy ? 'Exporting…' : 'Export daily hours'}</button>
        <button type="button" className="att-button att-sync" aria-label="Refresh overview" onClick={retry}><Icons.ArrowPathIcon />Refresh</button>
        <Link className="att-button" to="/hr/leave"><Icons.CalendarDaysIcon />Leave management</Link>
      </div>
    </div>
    {exportError && <div className="att-overview-alert" role="alert">{exportError} <button type="button" className="att-overview-link" disabled={exportBusy} onClick={exportDay}>Retry export</button></div>}
    {branch !== 'all' && branchState.state !== 'loaded' && <PanelState resource={branchState} label="Branch attendance" onRetry={retry} />}
    {current.state !== 'loaded' && <PanelState resource={current} label="Daily attendance" onRetry={retry} />}

    {/* ── SECTION 1: Attendance Snapshot ── */}
    <section className="att-snapshot" aria-label="Attendance snapshot">
      <div className="att-snapshot-card">
        <div className="att-snapshot-head">
          <h2>Attendance Today</h2>
          <span className={`att-snapshot-status ${attentionRequired ? 'att-snapshot-status-warn' : 'att-snapshot-status-ok'}`}>Status: {attentionRequired ? 'Attention Required' : 'All Clear'}</span>
        </div>
        <div className="att-snapshot-body">
          <div className="att-snapshot-item"><span className="att-snapshot-value">{metric(totals.records)}</span><span className="att-snapshot-label">Employees Recorded</span></div>
          <div className="att-snapshot-item"><span className="att-snapshot-value">{metric(totals.late)}</span><span className="att-snapshot-label">Late Records</span></div>
          <div className="att-snapshot-item"><span className="att-snapshot-value">{openSessions}</span><span className="att-snapshot-label">Open Sessions</span></div>
          <div className="att-snapshot-item"><span className="att-snapshot-value">{pendingLeave == null ? '—' : format(pendingLeave)}</span><span className="att-snapshot-label">Pending Leave Requests</span></div>
        </div>
      </div>
    </section>

    {/* ── SECTION 2: Quick Metrics ── */}
    <section className="att-quick-metrics" aria-label="Quick metrics">
      <div className="att-metric-card"><Icons.UsersIcon className="att-metric-icon" aria-hidden="true" /><div className="att-metric-text"><dt>Attendance</dt><dd>{metric(totals.records)}</dd></div></div>
      <div className="att-metric-card"><Icons.ClockIcon className="att-metric-icon" aria-hidden="true" /><div className="att-metric-text"><dt>Late Records</dt><dd>{metric(totals.late)}</dd></div></div>
      <div className="att-metric-card"><Icons.CalendarDaysIcon className="att-metric-icon" aria-hidden="true" /><div className="att-metric-text"><dt>Open Sessions</dt><dd>{openSessions}</dd></div></div>
      <div className="att-metric-card"><Icons.ClockIcon className="att-metric-icon" aria-hidden="true" /><div className="att-metric-text"><dt>Pending Leave</dt><dd>{pendingLeave == null ? '—' : format(pendingLeave)}</dd></div></div>
    </section>

    {/* ── SECTION 3: Needs Attention ── */}
    <section className="att-needs-attention" aria-label="Needs attention">
      <h2>Needs Attention</h2>
      <div className="att-attention-list">
        <AttentionCard title="Late Records" sub={`${totals.late} employees need review`} onClick={() => onOpenDaily(date)} />
        <AttentionCard title="Open Sessions" sub={`${openSessions} attendance sessions require closure`} onClick={() => onOpenDaily(date)} />
        <Link to="/hr/leave-requests" className="att-attention-link"><AttentionCard title="Pending Leave" sub={`${pendingLeave == null ? '—' : pendingLeave} requests awaiting approval`} onClick={() => {}} /></Link>
      </div>
    </section>

    {/* ── SECTION 4: Department Highlights ── */}
    <section className="att-department-highlights" aria-label="Department highlights">
      <h2>Department Highlights</h2>
      <div className="att-department-list">
        {deptIssues.slice(0, 6).map(item => (
          <div key={item.dept} className="att-department-chip"><span className="att-department-name">{item.dept}</span><span className="att-department-count">{item.count} Issues</span></div>
        ))}
        {deptIssues.length === 0 && <p className="att-empty">No departments require attention.</p>}
      </div>
    </section>

    {/* ── SECTION 5: Attendance Trend ── */}
    <section className="att-trend" aria-label="Attendance trend">
      <div className="att-trend-card">
        <div className="att-trend-head">
          <div>
            <h2>Today&apos;s Attendance</h2>
            <p>Weekly Trend</p>
          </div>
          <span className={`att-trend-change ${changePct > 0 ? 'att-trend-change-up' : changePct < 0 ? 'att-trend-change-down' : ''}`}>{changeLabel}</span>
        </div>
        <div className="att-trend-chart" role="img" aria-label={trend.map(point => `${point.label}: ${point.records == null ? 'unavailable' : `${point.records} records`}`).join('; ')}>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={trend} margin={{ top: 8, right: 16, bottom: 28, left: 8 }}>
              <CartesianGrid stroke="#e9eff7" strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#526c92' }} axisLine={{ stroke: '#c7d5e7' }} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#526c92' }} axisLine={false} tickLine={false} hide={true} />
              <Tooltip formatter={value => [`${value} records`, 'Attendance']} />
              <Line type="linear" dataKey="records" stroke="#1765ff" strokeWidth={2} dot={{ r: 3, fill: '#1765ff', stroke: 'white', strokeWidth: 1 }} connectNulls={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="att-trend-footnote">Recorded counts for the selected week. Unavailable days appear as gaps.</p>
      </div>
    </section>
  </section>
}
