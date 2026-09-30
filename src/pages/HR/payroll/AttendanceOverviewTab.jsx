import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import * as Icons from '@heroicons/react/24/outline'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import ts from '../../../services/timesheet.service'
import payrollService from '../../../services/payroll.service'
import { ATT_STANDARD_DAILY_HOURS, empDept, empName, filterEmployeeRow } from '../../../config/hrAttendance.config'
import { BRANCHES } from '../../../config/hrLeave.config'
import { buildOverviewDay, overviewDateKeys, overviewNumber } from './overviewAttendanceModel'

const EMPTY = { state: 'loading', data: null }
const dateObject = value => new Date(`${value}T12:00:00`)
const dateKey = value => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
const dateLabel = value => dateObject(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
const format = value => value == null ? '—' : value.toLocaleString('en-US', { maximumFractionDigits: 1 })
const hours = value => value == null ? '—' : `${format(value)}h`
const timestamp = value => value && !Number.isNaN(new Date(value).getTime()) ? new Date(value).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'
const errorMessage = error => error?.response?.status === 403 ? 'Access denied.' : error?.response?.status === 401 ? 'Session expired. Sign in again.' : 'Could not be loaded.'
const sourceLabel = data => ({ manual_upload: 'Manual upload', manual: 'Manual upload', biometric: 'Biometric records', hybrid: 'Biometric + uploaded hours', mirror: 'Biometric mirror', sqlserver: 'Biometric records' })[data?.attendance_source || data?.variant || data?.hours_mode] || 'Attendance records'

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

async function loadHolidays(year) {
  const rows = []
  let count
  for (let page = 1; page <= 1000; page++) {
    const response = await payrollService.getPublicHolidays(year, { active_only: 'true', page })
    if (page === 1 && Array.isArray(response)) return response
    if (!Array.isArray(response?.results) || !Number.isSafeInteger(response.count) || response.count < 0) throw new Error('Incomplete holidays')
    if (page === 1) count = response.count
    if (response.count !== count) throw new Error('Changed holidays')
    rows.push(...response.results)
    if (rows.length > count) throw new Error('Incomplete holidays')
    if (response.next === null) {
      if (rows.length !== count) throw new Error('Incomplete holidays')
      return rows
    }
    if (typeof response.next !== 'string' || !response.results.length || Number(new URL(response.next, 'https://attendance.invalid').searchParams.get('page')) !== page + 1) throw new Error('Incomplete holidays')
  }
  throw new Error('Incomplete holidays')
}

function PanelState({ resource, label, onRetry, empty }) {
  if (resource.state === 'loading') return <p className="att-overview-empty" role="status">Loading {label.toLowerCase()}…</p>
  if (resource.state === 'error') return <div className="att-overview-empty att-overview-error" role="alert">{label}: {resource.error} <button type="button" className="att-overview-link" onClick={onRetry}>Retry {label.toLowerCase()}</button></div>
  return empty ? <p className="att-overview-empty">{empty}</p> : null
}

export default function AttendanceOverviewTab({ date, today, onDateChange, onOpenDaily, onOpenMatrix }) {
  const [branch, setBranch] = useState('all')
  const [department, setDepartment] = useState('all')
  const [search, setSearch] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [attentionExpanded, setAttentionExpanded] = useState(false)
  const [exportBusy, setExportBusy] = useState(false)
  const [exportError, setExportError] = useState('')
  const [week, setWeek] = useState({ key: '', days: {} })
  const year = Number(date.slice(0, 4)), month = Number(date.slice(5, 7))
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
        if (active) setWeek(previous => ({ key: weekKey, days: { ...previous.days, [day]: { state: 'loaded', data: rows.filter(filterEmployeeRow), source: sourceLabel(response) } } }))
      }).catch(error => {
        if (active) setWeek(previous => ({ key: weekKey, days: { ...previous.days, [day]: { state: 'error', data: null, error: errorMessage(error) } } }))
      })
    })
    return () => { active = false }
  }, [dates, weekKey])

  const leave = useOverviewRead(`${year}:${month}:${refresh}`, useCallback(async () => {
    const response = await payrollService.getLeaveCalendar(year, month)
    if (!response?.calendar || typeof response.calendar !== 'object' || Array.isArray(response.calendar)) throw new Error('Invalid calendar')
    return response.calendar
  }, [year, month]))
  const corrections = useOverviewRead(`${year}:${month}:${refresh}`, useCallback(async () => {
    const rows = await payrollService.getAttendanceOverrides(year, month)
    if (!Array.isArray(rows)) throw new Error('Invalid corrections')
    return [...rows].sort((a, b) => (Date.parse(b.created_at) || 0) - (Date.parse(a.created_at) || 0))
  }, [year, month]))
  const holidays = useOverviewRead(`${year}:${refresh}`, useCallback(() => loadHolidays(year), [year]))
  const approvals = useOverviewRead(String(refresh), useCallback(async () => {
    const response = await payrollService.getPendingLeaveApprovals()
    if (!Array.isArray(response?.results) || !Number.isSafeInteger(response.count) || response.count !== response.results.length) throw new Error('Invalid approval queue')
    return response
  }, []))
  const health = useOverviewRead(String(refresh), useCallback(async () => {
    const response = await ts.fetchHealth()
    if (typeof response?.ping?.ok !== 'boolean') throw new Error('Invalid health')
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
  const approvedLeave = leave.state === 'loaded' ? Object.values(leave.data).filter(days => Boolean(days?.[date])).length : null
  const selectedHolidays = holidays.state === 'loaded' ? holidays.data.filter(item => item.date === date && item.is_active !== false) : []
  const recent = corrections.state === 'loaded' ? corrections.data.slice(0, 5) : []
  const attention = attentionExpanded ? totals.attention : totals.attention.slice(0, 5)
  const metric = value => ready ? format(value) : '—'
  const stepDate = delta => {
    const next = dateObject(date)
    next.setDate(next.getDate() + delta)
    changeDate(dateKey(next))
  }
  const changeDate = value => {
    if (value <= today && overviewDateKeys(value).length) {
      onDateChange(value)
      setAttentionExpanded(false)
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
  const sourceHealth = health.data?.data_source
  const sourceValue = health.state === 'loaded' ? health.data.ping.ok ? ({ manual: 'Upload storage available', mirror: 'Mirror records available', sqlserver: 'Connection available' })[sourceHealth] || 'Available' : 'Unavailable / no records' : health.state === 'loading' ? 'Loading…' : 'Unavailable'
  const dataStatus = resource => resource.state === 'loaded' ? 'Loaded' : resource.state === 'loading' ? 'Loading…' : 'Unavailable'

  return <section className="att-overview" aria-label="Attendance overview">
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

    <dl className="att-summary att-overview-summary" aria-label="Overview attendance summary">
      {[
        ['Attendance records', metric(totals.records), Icons.UsersIcon, 'neutral', 'Filtered records'],
        ['Check-ins', metric(totals.checkIns), Icons.UserIcon, 'good', 'Recorded first punch'],
        ['Approved leave', format(approvedLeave), Icons.CalendarDaysIcon, 'blue', 'All permitted employees'],
        ['Late records', metric(totals.late), Icons.ClockIcon, 'warn', 'Source late flag'],
        ['Attention items', metric(totals.attention.length), Icons.ExclamationTriangleIcon, 'warn', 'Filtered records'],
        ['Pending leave', approvals.state === 'loaded' ? format(approvals.data.count) : '—', Icons.ClockIcon, 'warn', 'For your review · all dates'],
      ].map(([label, value, Icon, tone, note]) => <div key={label} className="att-summary-item" data-tone={tone}><Icon /><div><dt>{label}</dt><dd>{value}</dd><small>{note}</small></div></div>)}
    </dl>

    <div className="att-overview-grid">
      <div className="att-overview-main">
        <section className="att-overview-card" aria-label="Requires attention">
          <header><div><h2>Requires attention</h2><p>Open shifts, late arrivals and recorded overtime</p></div><button type="button" className="att-overview-link" disabled={!ready || !totals.attention.length} onClick={() => setAttentionExpanded(value => !value)}>{attentionExpanded ? 'Show less' : `View all (${ready ? totals.attention.length : '—'})`}<Icons.ChevronRightIcon /></button></header>
          {!ready ? <p className="att-overview-empty">Attendance details are unavailable until the selected records load.</p> : !attention.length ? <p className="att-overview-empty">{rows.length ? 'No attention items in the returned records.' : 'No attendance records match this date and filters.'}</p> : <div className="att-overview-table-scroll"><table className="att-overview-table att-overview-attention"><thead><tr><th>Type</th><th>Issue</th><th>Employee</th><th>Department</th><th>Details</th><th>Action</th></tr></thead><tbody>{attention.map(item => <tr key={item.key}><td><span className="att-overview-tone" data-tone={item.tone === 'warning' ? 'warn' : 'blue'}>{item.tone === 'warning' ? <Icons.ExclamationTriangleIcon /> : <Icons.InformationCircleIcon />}{item.tone === 'warning' ? 'Warning' : 'Info'}</span></td><td>{item.issue}</td><td>{empName(item.row)}</td><td>{empDept(item.row)}</td><td>{item.detail}</td><td><button type="button" className="att-overview-review" aria-label={`Review ${empName(item.row)}`} onClick={() => onOpenDaily(date, String(item.row.employee_code || empName(item.row)))}>Review</button></td></tr>)}</tbody></table></div>}
        </section>

        <section className="att-overview-card" aria-label="Attendance by department">
          <header><h2>Attendance by department</h2><button type="button" className="att-overview-link" onClick={() => onOpenDaily(date)}>Open daily register<Icons.ChevronRightIcon /></button></header>
          {ready && totals.departments.length ? <div className="att-overview-table-scroll"><table className="att-overview-table att-overview-departments"><thead><tr><th>Department</th><th>Records</th><th>Check-ins</th><th>Open shifts</th><th>Regular hours</th><th>Check-in share</th></tr></thead><tbody>{totals.departments.map(item => <tr key={item.dept}><td>{item.dept}</td><td>{format(item.records)}</td><td>{format(item.checkIns)}</td><td>{format(item.openShifts)}</td><td>{hours(item.regularHours)}</td><td><span className="att-overview-bar"><span><i style={{ width: `${item.checkInShare || 0}%` }} /></span><b>{format(item.checkInShare)}%</b></span></td></tr>)}</tbody></table></div> : <p className="att-overview-empty">{ready ? 'No department records for this selection.' : 'Department figures unavailable.'}</p>}
          <p className="att-overview-footnote">Share of returned records with a check-in. Records can include multiple sessions per employee.</p>
        </section>

        <section className="att-overview-card" aria-label="Seven-day attendance trend">
          <header><h2>7-day attendance trend</h2><span className="att-overview-chart-key"><i />Attendance records</span></header>
          <div className="att-overview-trend"><div className="att-overview-chart" role="img" aria-label={trend.map(point => `${point.label}: ${point.records == null ? 'unavailable' : `${point.records} records`}`).join('; ')}>
            <ResponsiveContainer width="100%" height={180}><LineChart data={trend} margin={{ top: 10, right: 12, bottom: 4, left: -22 }}><CartesianGrid stroke="#e9eff7" strokeDasharray="3 3" /><XAxis dataKey="label" tick={{ fontSize: 10, fill: '#526c92' }} axisLine={{ stroke: '#c7d5e7' }} tickLine={false} /><YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#526c92' }} axisLine={false} tickLine={false} /><Tooltip formatter={value => [format(value), 'Records']} /><Line type="linear" dataKey="records" stroke="#1765ff" strokeWidth={2} dot={{ r: 3, fill: '#1765ff', stroke: 'white', strokeWidth: 1 }} connectNulls={false} isAnimationActive={false} /></LineChart></ResponsiveContainer>
          </div><aside><span>Selected day</span><strong>{metric(totals.records)}</strong><span>Days loaded</span><b>{trend.filter(point => point.state === 'loaded').length} of 7</b><p><Icons.InformationCircleIcon />Recorded counts; a scheduled workforce denominator is not available.</p></aside></div>
          {trend.some(point => point.state === 'error') && <div className="att-overview-footnote" role="alert">Unavailable days: {trend.filter(point => point.state === 'error').map(point => point.label).join(', ')}. <button className="att-overview-link" type="button" onClick={retry}>Retry trend</button></div>}
        </section>
      </div>

      <div className="att-overview-side">
        <section className="att-overview-card" aria-label="Daily summary">
          <header><h2>Daily summary</h2><button type="button" className="att-overview-link" onClick={() => onOpenMatrix(date)}>Open monthly matrix</button></header>
          <dl className="att-overview-facts">
            <div><dt><Icons.ClockIcon />Configured standard day</dt><dd>{hours(ATT_STANDARD_DAILY_HOURS)}</dd></div>
            <div><dt><Icons.PlayIcon />Source regular hours</dt><dd>{ready ? hours(totals.regularHours) : '—'}</dd></div>
            <div><dt><Icons.ChartBarIcon />Recorded OT · unapproved</dt><dd>{ready ? hours(totals.overtimeHours) : '—'}</dd></div>
            <div><dt><Icons.CalendarDaysIcon />Expected hours / variance</dt><dd className="att-overview-muted">Not available</dd></div>
            <div><dt><Icons.CalendarDaysIcon />Public holidays · all regions</dt><dd>{holidays.state === 'loaded' ? selectedHolidays.length ? selectedHolidays.map(item => `${item.name}${item.region ? ` (${item.region})` : ''}`).join(', ') : 'None listed' : '—'}</dd></div>
          </dl><p className="att-overview-footnote">{current.state === 'loaded' ? current.source : 'Source unavailable'} · {dateLabel(date)}. Source hours exclude HR corrections; open-shift hours may change.</p>
          {holidays.state === 'error' && <PanelState resource={holidays} label="Public holidays" onRetry={retry} />}
        </section>

        <section className="att-overview-card" aria-label="Data health">
          <header><h2>Data health</h2><button type="button" className="att-overview-link" onClick={retry}>Refresh status</button></header>
          <dl className="att-overview-facts">
            {[[health, 'Attendance source', sourceValue], [current, 'Selected-day records', dataStatus(current)], [leave, 'Approved leave calendar', dataStatus(leave)], [corrections, 'HR corrections', dataStatus(corrections)]].map(([resource, label, value]) => <div key={label}><dt>{resource.state === 'error' || (label === 'Attendance source' && resource.data?.ping?.ok === false) ? <Icons.ExclamationTriangleIcon className="att-overview-warn" /> : resource.state === 'loaded' ? <Icons.CheckCircleIcon className="att-overview-good" /> : <Icons.ClockIcon />}{label}</dt><dd>{value}</dd></div>)}
          </dl>
          {health.state === 'loaded' && (health.data.ping.latest_upload || health.data.ping.latest_event) && <p className="att-overview-footnote">{health.data.ping.latest_upload ? 'Latest upload' : 'Latest recorded event'}: {timestamp(health.data.ping.latest_upload || health.data.ping.latest_event)}. This is not a sync heartbeat.</p>}
          {health.state === 'error' && <PanelState resource={health} label="Source health" onRetry={retry} />}
          {leave.state === 'error' && <PanelState resource={leave} label="Approved leave" onRetry={retry} />}
        </section>

        <section className="att-overview-card" aria-label="Pending leave approvals">
          <header><h2>Pending leave approvals{approvals.state === 'loaded' ? ` (${approvals.data.count})` : ''}</h2><Link className="att-overview-link" to="/hr/leave-requests">View all</Link></header>
          <PanelState resource={approvals} label="Leave approvals" onRetry={retry} empty={approvals.state === 'loaded' && !approvals.data.count ? 'No leave requests are waiting for your review.' : ''} />
          {approvals.state === 'loaded' && approvals.data.count > 0 && <div className="att-overview-table-scroll"><table className="att-overview-table att-overview-approvals"><thead className="sr-only"><tr><th>Leave type</th><th>Employee</th><th>Starts</th><th>Action</th></tr></thead><tbody>{approvals.data.results.slice(0, 3).map(item => <tr key={item.id}><td><span className="att-overview-inline"><Icons.ClockIcon />{item.leave_type_detail?.name || 'Leave request'}</span></td><td>{item.employee_name || item.employee_code}</td><td>{item.start_date ? dateLabel(item.start_date) : '—'}</td><td><Link className="att-overview-link" to={`/hr/leave-requests/${encodeURIComponent(item.id)}`}>Review</Link></td></tr>)}</tbody></table></div>}
          <p className="att-overview-footnote">Your current review queue · all dates and departments.</p>
        </section>

        <section className="att-overview-card" aria-label="Recent corrections">
          <header><h2>Recent corrections</h2><button type="button" className="att-overview-link" onClick={() => onOpenMatrix(date)}>Open matrix</button></header>
          <PanelState resource={corrections} label="HR corrections" onRetry={retry} empty={corrections.state === 'loaded' && !recent.length ? 'No active corrections for this month.' : ''} />
          {recent.length > 0 && <div className="att-overview-table-scroll"><table className="att-overview-table att-overview-corrections"><thead><tr><th>Employee</th><th>Original</th><th>Corrected</th><th>Recorded by</th><th>Created</th></tr></thead><tbody>{recent.map(item => <tr key={item.id}><td><button type="button" className="att-overview-link" onClick={() => onOpenMatrix(item.date, item.employee_code)}>{item.employee_name || item.employee_code}</button><small>{item.date ? dateLabel(item.date) : '—'}</small></td><td>{hours(overviewNumber(item.original_hours))}</td><td>{hours(overviewNumber(item.override_hours))}</td><td>{item.created_by_name || '—'}</td><td>{timestamp(item.created_at)}</td></tr>)}</tbody></table></div>}
          <p className="att-overview-footnote">Active corrections for {dateObject(date).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })} · all permitted employees. These are recorded changes.</p>
        </section>
      </div>
    </div>
    <p className="att-overview-scope">Filters apply to attendance records, department figures and trend. Leave and corrections retain their stated scope. Excel includes all permitted records for the selected date.</p>
  </section>
}
