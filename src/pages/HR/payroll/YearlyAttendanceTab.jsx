import { useEffect, useMemo, useRef, useState } from 'react'
import * as Icons from '@heroicons/react/24/outline'
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import ts from '../../../services/timesheet.service'
import payrollService from '../../../services/payroll.service'
import { BRANCHES } from '../../../config/hrLeave.config'
import { ATT_GOOD_RATE_PCT, ATT_WARN_RATE_PCT, ATT_STANDARD_MONTHLY_WORKING_DAYS, MONTH_SHORT, MONTH_FULL } from '../../../config/hrAttendance.config'
import { buildYearlyEmployees, summarizeYearlyEmployees } from './yearlyAttendanceModel'

const STATUS = {
  ready: { label: 'On target', Icon: Icons.CheckCircleIcon },
  review: { label: 'Below target', Icon: Icons.ExclamationTriangleIcon },
  incomplete: { label: 'Incomplete data', Icon: Icons.InformationCircleIcon },
}
const OPTIONAL_COLUMNS = [
  ['department', 'Department'], ['status', 'Status'], ['leave', 'Leave balance'],
  ['overtime', 'Recorded OT (Unapproved)'], ['year', 'Year'],
]
const number = value => (typeof value === 'number' || (typeof value === 'string' && value.trim() !== '')) && Number.isFinite(Number(value)) ? Number(value) : null
const format = value => value === null ? '—' : value.toLocaleString('en-US', { maximumFractionDigits: 1 })
const percent = value => value === null ? '—' : `${format(value)}%`
const tone = value => value === null ? 'unknown' : value >= ATT_GOOD_RATE_PCT ? 'good' : value >= ATT_WARN_RATE_PCT ? 'warn' : 'low'
const matchEmployee = (employee, query) => !query.trim() || [employee.name, employee.code, employee.dept].some(value => String(value).toLowerCase().includes(query.trim().toLowerCase()))

export default function YearlyAttendanceTab({ Pagination }) {
  const now = new Date()
  const currentYear = now.getFullYear(), currentMonth = now.getMonth() + 1
  const [year, setYear] = useState(currentYear)
  const [branch, setBranch] = useState('all')
  const [department, setDepartment] = useState('all')
  const [search, setSearch] = useState('')
  const [tableSearch, setTableSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [density, setDensity] = useState('comfortable')
  const [hidden, setHidden] = useState([])
  const [descending, setDescending] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [refresh, setRefresh] = useState(0)
  const [attendance, setAttendance] = useState({ year: null, busy: true, months: [] })
  const [leave, setLeave] = useState({ year: null, busy: true, balances: {}, error: false })
  const [branchState, setBranchState] = useState({ key: '', busy: false, codes: [], error: false })
  const [exportOpen, setExportOpen] = useState(false)
  const [exportBusy, setExportBusy] = useState(false)
  const [exportFormat, setExportFormat] = useState('excel')
  const [exportError, setExportError] = useState('')
  const exportRef = useRef(null)
  const retry = () => setRefresh(value => value + 1)

  useEffect(() => {
    let active = true
    setAttendance({ year, busy: true, months: [] })
    Promise.all(Array.from({ length: 12 }, async (_, index) => {
      try {
        const response = await ts.fetchMonthly(year, index + 1)
        const rows = Array.isArray(response) ? response : response?.rows
        if (response?.configured === false || !Array.isArray(rows)) throw new Error('Unavailable attendance source')
        return { state: 'loaded', rows }
      } catch { return { state: 'error', rows: [] } }
    })).then(months => { if (active) setAttendance({ year, busy: false, months }) })
    return () => { active = false }
  }, [year, refresh])

  useEffect(() => {
    let active = true
    setLeave({ year, busy: true, balances: {}, error: false })
    payrollService.getAnnualLeaveBalanceSummary(year, 12)
      .then(response => {
        if (!response?.balances || typeof response.balances !== 'object' || Array.isArray(response.balances)) throw new Error('Invalid annual leave response')
        if (active) setLeave({ year, busy: false, balances: response.balances, error: false })
      })
      .catch(() => { if (active) setLeave({ year, busy: false, balances: {}, error: true }) })
    return () => { active = false }
  }, [year, refresh])

  useEffect(() => {
    if (branch === 'all') return undefined
    let active = true
    const key = `${year}:${branch}`
    setBranchState({ key, busy: true, codes: [], error: false })
    payrollService.getBranchEmployeeCodes(branch, year)
      .then(response => {
        if (!Array.isArray(response?.codes)) throw new Error('Invalid branch mapping')
        if (active) setBranchState({ key, busy: false, codes: response.codes.map(String), error: false })
      })
      .catch(() => { if (active) setBranchState({ key, busy: false, codes: [], error: true }) })
    return () => { active = false }
  }, [year, branch, refresh])

  useEffect(() => { setPage(1) }, [year, branch, department, search, status, tableSearch, pageSize, descending])
  useEffect(() => { setExportError('') }, [year])
  useEffect(() => {
    if (!exportOpen) return undefined
    const close = event => { if (!exportRef.current?.contains(event.target)) setExportOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [exportOpen])

  const busy = attendance.year !== year || attendance.busy
  const branchCurrent = branchState.key === `${year}:${branch}`
  const branchBusy = branch !== 'all' && (!branchCurrent || branchState.busy)
  const branchError = branch !== 'all' && branchCurrent && branchState.error
  const ready = !busy && !branchBusy && !branchError
  const relevantMonths = year < currentYear ? 12 : currentMonth
  const failedMonths = attendance.year === year ? attendance.months.flatMap((month, index) => index < relevantMonths && month.state === 'error' ? [MONTH_SHORT[index]] : []) : []
  const allFailed = !busy && failedMonths.length === relevantMonths
  const employees = useMemo(() => busy ? [] : buildYearlyEmployees(attendance.months, { year, currentYear, currentMonth }), [attendance, year, currentYear, currentMonth, busy])
  const branchEmployees = useMemo(() => {
    if (!ready) return []
    const codes = new Set(branchState.codes)
    return branch === 'all' ? employees : employees.filter(employee => codes.has(employee.code))
  }, [ready, employees, branch, branchState.codes])
  const departments = useMemo(() => [...new Set(branchEmployees.map(employee => employee.dept))].sort(), [branchEmployees])
  const filtered = useMemo(() => branchEmployees.filter(employee =>
    (department === 'all' || employee.dept === department) && (status === 'all' || employee.status === status) && matchEmployee(employee, search)
  ), [branchEmployees, department, status, search])
  const totals = useMemo(() => summarizeYearlyEmployees(filtered), [filtered])
  const overtimePartial = filtered.some(employee => employee.months.some(month => !month || month.overtime === null))
  const tableRows = useMemo(() => filtered.filter(employee => matchEmployee(employee, tableSearch)).sort((a, b) => (descending ? -1 : 1) * a.name.localeCompare(b.name)), [filtered, tableSearch, descending])
  const safePage = Math.min(page, Math.max(1, Math.ceil(tableRows.length / pageSize)))
  const paged = tableRows.slice((safePage - 1) * pageSize, safePage * pageSize)
  const leaveReady = leave.year === year && !leave.busy && !leave.error
  const takenValues = filtered.map(employee => employee.code ? number(leave.balances[employee.code]?.taken_ytd) : null)
  const taken = ready && leaveReady && takenValues.length && takenValues.every(value => value !== null) ? takenValues.reduce((sum, value) => sum + value, 0) : null
  const lastPoint = [...totals.trend].reverse().find(point => point.rate !== null)
  const show = id => !hidden.includes(id)
  const metric = value => ready && !allFailed ? format(value) : '—'
  const exportYear = async kind => {
    setExportFormat(kind)
    setExportError('')
    setExportBusy(true)
    try { await (kind === 'pdf' ? ts.downloadYearlyPdf(year) : ts.downloadYearlyExcel(year)) }
    catch { setExportError('The yearly report could not be exported. Please try again.') }
    finally { setExportBusy(false) }
  }

  return <section className="att-yearly" data-density={density} aria-label="Yearly attendance">
    <div className="att-filter-panel att-yearly-toolbar" aria-label="Yearly attendance filters">
      <label className="att-field"><span>Year</span><select aria-label="Year" value={year} disabled={exportBusy} onChange={event => setYear(Number(event.target.value))}>{[currentYear - 2, currentYear - 1, currentYear].map(value => <option key={value}>{value}</option>)}</select></label>
      <label className="att-field att-yearly-select"><span>Branch</span><select aria-label="Branch" value={branch} title="Branch mapping from the selected year's HR records" onChange={event => setBranch(event.target.value)}><option value="all">All branches</option>{BRANCHES.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
      <label className="att-field att-yearly-select"><span>Department</span><select aria-label="Department" value={department} onChange={event => setDepartment(event.target.value)}><option value="all">All departments</option>{department !== 'all' && !departments.includes(department) && <option>{department}</option>}{departments.map(value => <option key={value}>{value}</option>)}</select></label>
      <label className="att-field att-search"><span className="sr-only">Search employees</span><div className="att-search-box"><Icons.MagnifyingGlassIcon aria-hidden="true" /><input aria-label="Search employees" placeholder="Employee name or ID" value={search} onChange={event => setSearch(event.target.value)} /></div></label>
      <label className="att-field"><span>Status</span><select aria-label="Status" value={status} onChange={event => setStatus(event.target.value)}><option value="all">All statuses</option>{Object.entries(STATUS).map(([id, item]) => <option key={id} value={id}>{item.label}</option>)}</select></label>
      <div className="att-yearly-tools">
        <details className="att-columns" onKeyDown={event => { if (event.key === 'Escape') { event.currentTarget.open = false; event.currentTarget.querySelector('summary')?.focus() } }}><summary className="att-button"><Icons.ViewColumnsIcon aria-hidden="true" />Columns</summary><div className="att-columns-panel">{OPTIONAL_COLUMNS.map(([id, label]) => <label key={id}><input type="checkbox" checked={show(id)} onChange={event => setHidden(previous => event.target.checked ? previous.filter(value => value !== id) : [...previous, id])} />{label}</label>)}</div></details>
        <label className="att-density"><span className="sr-only">Density</span><select aria-label="Density" value={density} onChange={event => setDensity(event.target.value)}><option value="comfortable">Comfortable</option><option value="compact">Compact</option></select></label>
        <div ref={exportRef} className="att-yearly-export" onKeyDown={event => { if (event.key === 'Escape') { setExportOpen(false); exportRef.current?.querySelector('button')?.focus() } }}>
          <button type="button" className="att-button" aria-expanded={exportOpen} onClick={() => setExportOpen(value => !value)}><Icons.ArrowUpTrayIcon aria-hidden="true" />Export</button>
          {exportOpen && <div className="att-yearly-export-panel" role="group" aria-label="Yearly export formats"><p>Monthly recorded hours · {year}<br />All employees permitted by the export.</p><button type="button" className="att-button" disabled={exportBusy} onClick={() => exportYear('excel')}>Excel · monthly hours</button><button type="button" className="att-button" disabled={exportBusy} onClick={() => exportYear('pdf')}>PDF · monthly hours</button></div>}
        </div>
        <button type="button" className="att-button" aria-label="Refresh yearly attendance" disabled={busy || branchBusy} onClick={retry}><Icons.ArrowPathIcon aria-hidden="true" /></button>
      </div>
    </div>

    {!busy && failedMonths.length > 0 && <div role="alert" className="att-yearly-message">Attendance unavailable for {failedMonths.join(', ')}. These months are excluded from recorded averages.<button type="button" className="att-button" onClick={retry}>Retry attendance</button></div>}
    {branchError && <div role="alert" className="att-yearly-message">Branch employees could not be loaded. The selected branch remains active.<button type="button" className="att-button" onClick={retry}>Retry branch</button></div>}
    {leave.year === year && leave.error && <div role="status" className="att-yearly-message">Annual leave figures could not be loaded.<button type="button" className="att-button" onClick={retry}>Retry leave</button></div>}
    {exportError && <div role="alert" className="att-yearly-message">{exportError}<button type="button" className="att-button" disabled={exportBusy} onClick={() => exportYear(exportFormat)}>Retry export</button></div>}

    <dl className="att-summary att-yearly-summary" aria-label="Yearly attendance summary">
      <div className="att-summary-item" title="Employees found in available monthly responses"><Icons.UserGroupIcon aria-hidden="true" /><div><dt>Employees</dt><dd>{metric(filtered.length)}</dd></div></div>
      <div className="att-summary-item" title="Mean of the monthly recorded rates. Missing months are excluded; import completeness is not certified."><Icons.CheckCircleIcon aria-hidden="true" /><div><dt>Average recorded rate</dt><dd>{ready && !allFailed ? percent(totals.averageRecordedRate) : '—'}</dd></div></div>
      <div className="att-summary-item" title="Only employees with all 12 recorded months can be assessed for the full year."><Icons.ExclamationTriangleIcon aria-hidden="true" /><div><dt>Below target (&lt; {ATT_GOOD_RATE_PCT}%)</dt><dd className="att-negative">{metric(totals.belowTarget)}</dd><small>Full-year records only</small></div></div>
      <div className="att-summary-item" title="Annual leave taken from HR imports for this year; not all leave types."><Icons.CalendarDaysIcon aria-hidden="true" /><div><dt>Annual leave taken</dt><dd>{taken === null ? '—' : `${format(taken)} days`}</dd></div></div>
      <div className="att-summary-item" title="Sum of available recorded overtime; this is not approved overtime."><Icons.ClockIcon aria-hidden="true" /><div><dt>Recorded OT (Unapproved)</dt><dd>{ready && !allFailed && totals.totalOvertime !== null ? `${format(totals.totalOvertime)} h` : '—'}</dd>{ready && overtimePartial && totals.totalOvertime !== null && <small>Partial · recorded months only</small>}</div></div>
    </dl>

    <section className="att-yearly-trend" aria-label="Yearly attendance trend" aria-busy={busy || branchBusy}>
      <div className="att-yearly-chart-area">
        <div className="att-yearly-chart-heading"><h2>{year} attendance trend</h2><p><Icons.InformationCircleIcon aria-hidden="true" />Recorded months only; missing months stay blank.</p></div>
        <div className="att-yearly-chart" role="img" aria-label={`${year} recorded attendance rates. ${totals.trend.map(point => `${point.month}: ${percent(point.rate)}`).join(', ')}. Configured target ${ATT_GOOD_RATE_PCT} percent.`}>
          <ResponsiveContainer width="100%" height="100%"><LineChart data={totals.trend} margin={{ top: 20, right: 20, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e9eff7" /><XAxis dataKey="month" tick={{ fontSize: 10, fill: '#526b8f' }} interval={0} tickLine={false} /><YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} width={42} tick={{ fontSize: 10, fill: '#526b8f' }} tickFormatter={value => `${value}%`} />
            <Tooltip formatter={value => [percent(value), 'Recorded attendance']} contentStyle={{ borderRadius: 8, borderColor: '#dce5f1', fontSize: 12 }} />
            <ReferenceLine y={ATT_GOOD_RATE_PCT} stroke="#889bb8" strokeDasharray="5 5" />
            <Line type="linear" dataKey="rate" connectNulls={false} stroke="#246bff" strokeWidth={2} dot={{ r: 3, fill: '#246bff' }} activeDot={{ r: 5 }} isAnimationActive={false} label={({ x, y, value }) => value == null ? null : <text x={x} y={y - 10} fill="#203552" textAnchor="middle" fontSize={10} fontWeight={600}>{value}%</text>} />
          </LineChart></ResponsiveContainer>
        </div>
        <div className="att-yearly-legend"><span><i />Recorded attendance rate</span><span><i />Configured target {ATT_GOOD_RATE_PCT}%</span></div>
      </div>
      <dl className="att-yearly-trend-stats">
        <div><dt>{lastPoint ? `Latest (${lastPoint.month} ${year})` : 'Latest recorded month'}</dt><dd data-tone={tone(lastPoint?.rate ?? null)}>{ready ? percent(lastPoint?.rate ?? null) : '—'}</dd></div>
        <div><dt>Configured target</dt><dd>{ATT_GOOD_RATE_PCT}%</dd></div>
        <div><dt>Full-year rate</dt><dd>{ready ? percent(totals.fullYearRate) : '—'}</dd></div>
        <div><dt>Months with records</dt><dd>{ready && !allFailed ? `${totals.monthsWithRecords} of 12` : '—'}</dd></div>
      </dl>
    </section>

    <section className="att-yearly-panel" aria-label="Employee yearly attendance" aria-busy={busy || branchBusy}>
      <div className="att-yearly-table-heading"><strong>{ready && !allFailed ? `${filtered.length} employees` : 'Employee attendance'}</strong><p><Icons.InformationCircleIcon aria-hidden="true" />Rate = present days ÷ {ATT_STANDARD_MONTHLY_WORKING_DAYS} configured workdays.<span className="att-yearly-rate-key">Green ≥{ATT_GOOD_RATE_PCT}%; amber ≥{ATT_WARN_RATE_PCT}%; red &lt;{ATT_WARN_RATE_PCT}%.</span></p><label className="att-yearly-table-search"><Icons.MagnifyingGlassIcon aria-hidden="true" /><input aria-label="Search in yearly table" placeholder="Search in table…" value={tableSearch} onChange={event => setTableSearch(event.target.value)} /></label></div>
      {busy || branchBusy ? <div className="att-yearly-empty" role="status"><Icons.ArrowPathIcon className="animate-spin" aria-hidden="true" />Loading yearly attendance…</div>
        : branchError || allFailed ? <div className="att-yearly-empty">Attendance is unavailable. Use Retry above to load this selection.</div>
          : tableRows.length === 0 ? <div className="att-yearly-empty" role="status"><Icons.CalendarDaysIcon aria-hidden="true" /><p>{employees.length ? 'No employees match the selected filters.' : 'No attendance records for the selected year.'}</p>{(branch !== 'all' || department !== 'all' || status !== 'all' || search || tableSearch) && <button type="button" className="att-button" onClick={() => { setBranch('all'); setDepartment('all'); setStatus('all'); setSearch(''); setTableSearch('') }}>Clear filters</button>}</div>
            : <>
              <div className="att-table-scroll" role="region" aria-label="Yearly attendance table" tabIndex={0}><table className="att-yearly-table"><caption className="sr-only">{year} recorded attendance by employee. Missing months are not zero attendance.</caption>
                <thead><tr><th scope="col" aria-sort={descending ? 'descending' : 'ascending'}><button type="button" aria-label="Sort by Employee" onClick={() => setDescending(value => !value)}>Employee<Icons.ArrowUpIcon aria-hidden="true" className={descending ? 'rotate-180' : ''} /></button></th>{show('department') && <th scope="col">Department</th>}{MONTH_SHORT.map(month => <th scope="col" key={month}>{month}</th>)}{show('status') && <th scope="col">Status</th>}{show('leave') && <th scope="col">Leave balance</th>}{show('overtime') && <th scope="col">Recorded OT<br /><small>(Unapproved)</small></th>}{show('year') && <th scope="col">Year</th>}</tr></thead>
                <tbody>{paged.map(employee => {
                  const statusInfo = STATUS[employee.status]
                  const balance = leaveReady && employee.code ? number(leave.balances[employee.code]?.balance) : null
                  return <tr key={employee.key}><td title={`${employee.name} · ${employee.code}`}>{employee.name}</td>{show('department') && <td title={employee.dept}>{employee.dept}</td>}{employee.months.map((month, index) => <td key={index}>
                    {month ? <span data-tone={tone(month.rate)} title={`${MONTH_FULL[index]}: ${month.present} recorded present days / ${ATT_STANDARD_MONTHLY_WORKING_DAYS} configured days`}>{percent(month.rate)}</span> : <span className="att-yearly-missing">—<small>{employee.monthStates[index] === 'unavailable' ? 'Unavailable' : employee.monthStates[index] === 'future' ? 'Upcoming' : 'No data'}</small></span>}
                  </td>)}{show('status') && <td><span className="att-yearly-status" data-status={employee.status} title="Attendance display threshold only; this does not indicate payroll or import approval."><statusInfo.Icon aria-hidden="true" />{statusInfo.label}</span></td>}{show('leave') && <td className="att-yearly-leave" title="Annual leave balance from HR records">{balance === null ? '—' : `${format(balance)} d`}</td>}{show('overtime') && <td className="att-yearly-overtime" title="Available recorded overtime; missing months are not included">{employee.totalOvertime === null ? '—' : `${format(employee.totalOvertime)} h`}{employee.totalOvertime !== null && employee.months.some(month => !month || month.overtime === null) && <small>Partial</small>}</td>}{show('year') && <td><span data-tone={tone(employee.fullYearRate)} title="A full-year rate requires records for all 12 months.">{percent(employee.fullYearRate)}</span></td>}</tr>
                })}</tbody>
              </table></div>
              <Pagination total={tableRows.length} page={safePage} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
            </>}
    </section>
  </section>
}
