import { useEffect, useMemo, useRef, useState } from 'react'
import { useSelector } from 'react-redux'
import * as Icons from '@heroicons/react/24/outline'
import ts from '../../../services/timesheet.service'
import {
  ATTENDANCE_DAILY_COLS, ATTENDANCE_STATUS, OPEN_SHIFT_INDICATOR,
  canEditAttendance, classifyDay, empDept, empName,
} from '../../../config/hrAttendance.config'

const STATUS = [
  { id: 'present', label: 'Present', Icon: Icons.UserIcon },
  { id: 'late', label: 'Late', Icon: Icons.ClockIcon },
  { id: 'half_day', label: 'Half day', Icon: Icons.ClockIcon },
  { id: 'absent', label: 'Absent', Icon: Icons.UserMinusIcon },
  { id: 'in_progress', label: 'In progress', Icon: Icons.ClockIcon },
]
const dateObject = value => new Date(`${value}T12:00:00`)
const dateKey = value => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
const sortValue = (row, column) => {
  if (column.id === 'in' || column.id === 'out') return row[column.id === 'in' ? 'first_in' : 'last_out'] || null
  if (column.cellType === 'hours_worked') return row.open_shift ? null : Number(column.accessor(row))
  if (column.id === 'status') return ATTENDANCE_STATUS[classifyDay(row)]?.label || ''
  return column.accessor(row)
}

export default function DailyAttendanceTab({ rows, date, today, loading, error, source, onDateChange, onRefresh, Pagination, initialSearch = '' }) {
  const [department, setDepartment] = useState('all')
  const [search, setSearch] = useState(initialSearch)
  const [status, setStatus] = useState('all')
  const [density, setDensity] = useState('comfortable')
  const [hiddenColumns, setHiddenColumns] = useState([])
  const [sort, setSort] = useState({ key: 'in', direction: 'asc' })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [uploadMessage, setUploadMessage] = useState('')
  const [uploadSelection, setUploadSelection] = useState(null)
  const fileRef = useRef(null)
  const authUser = useSelector(state => state.auth?.user)
  const profile = useSelector(state => state.rbac?.currentUser)
  const canUpload = canEditAttendance(profile, authUser)
  const ready = !loading && !error
  const periodBusy = uploading || exporting
  const progressAvailable = rows.every(row => typeof row.open_shift === 'boolean')
  const departments = useMemo(() => [...new Set(rows.map(empDept))].sort(), [rows])
  const visibleColumns = ATTENDANCE_DAILY_COLS.filter(column => !hiddenColumns.includes(column.id))
  const counts = useMemo(() => {
    const result = { all: rows.length, present: 0, late: 0, half_day: 0, absent: 0, in_progress: 0 }
    for (const row of rows) {
      result[classifyDay(row)]++
      if (row.open_shift) result.in_progress++
    }
    return result
  }, [rows])
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    const selected = rows.filter(row =>
      (department === 'all' || empDept(row) === department) &&
      (status === 'all' || (status === 'in_progress' ? row.open_shift : classifyDay(row) === status)) &&
      (!query || [empName(row), empDept(row), row.employee_code, row.employee_id, row.radai_email, row.email]
        .some(value => String(value || '').toLowerCase().includes(query)))
    )
    const column = ATTENDANCE_DAILY_COLS.find(item => item.id === sort.key)
    return selected.sort((a, b) => {
      const left = sortValue(a, column), right = sortValue(b, column)
      if (left == null) return right == null ? 0 : 1
      if (right == null) return -1
      const comparison = typeof left === 'number' && typeof right === 'number'
        ? left - right : String(left).localeCompare(String(right), undefined, { numeric: true })
      return sort.direction === 'asc' ? comparison : -comparison
    })
  }, [rows, department, search, status, sort])
  const safePage = Math.min(page, Math.max(1, Math.ceil(filtered.length / pageSize)))
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize)

  useEffect(() => { setPage(1) }, [date, department, search, status, pageSize, sort])
  useEffect(() => { setExportError('') }, [date])
  useEffect(() => {
    if (ready && !progressAvailable && status === 'in_progress') setStatus('all')
  }, [ready, progressAvailable, status])

  const changeDate = value => {
    if (value && /^\d{4}-\d{2}-\d{2}$/.test(value) && value <= today && !Number.isNaN(dateObject(value).getTime())) onDateChange(value)
  }
  const stepDate = amount => {
    const next = dateObject(date)
    next.setDate(next.getDate() + amount)
    changeDate(dateKey(next))
  }
  const exportDay = async () => {
    setExportError('')
    setExporting(true)
    try { await ts.downloadDailyExcel(date) }
    catch { setExportError('The daily report could not be exported. Please try again.') }
    finally { setExporting(false) }
  }
  const uploadHours = async (selection = uploadSelection) => {
    if (!selection?.file || !canUpload) return
    setUploading(true)
    setUploadError('')
    setUploadMessage('')
    try {
      const { file, year, month } = selection
      const result = await ts.uploadDailyAttendance(file, year, month)
      if (fileRef.current) fileRef.current.value = ''
      setUploadSelection(null)
      setUploadMessage(`Imported ${(result.created || 0) + (result.updated || 0)} daily entries for ${year}-${String(month).padStart(2, '0')}${result.skipped ? ` · ${result.skipped} skipped` : ''}.`)
      onRefresh()
    } catch (failure) {
      const data = failure?.response?.data
      setUploadError(data?.detail || data?.errors?.[0]?.error || 'Attendance upload failed. Please retry.')
    } finally { setUploading(false) }
  }
  const selectUpload = event => {
    const file = event.target.files?.[0]
    if (!file) return
    const [year, month] = date.split('-').map(Number)
    const selection = { file, year, month }
    setUploadSelection(selection)
    uploadHours(selection)
  }
  const countLabel = key => ready && (key !== 'in_progress' || progressAvailable) ? counts[key].toLocaleString() : '—'
  const hasFilters = department !== 'all' || search || status !== 'all'
  const summaryItems = [{ id: 'all', label: 'Attendance records', Icon: Icons.UserGroupIcon }, ...STATUS]

  return (
    <section className="att-daily" data-density={density} aria-label="Daily attendance">
      <div className="att-filter-panel att-daily-toolbar" aria-label="Daily attendance filters">
        <div className="att-date-navigation">
          <button type="button" className="att-button" aria-label="Previous day" disabled={periodBusy} onClick={() => stepDate(-1)}><Icons.ChevronLeftIcon aria-hidden="true" /></button>
          <label className="att-date-picker">
            <Icons.CalendarDaysIcon aria-hidden="true" />
            <span>{date === today ? 'Today · ' : ''}{dateObject(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            <input type="date" aria-label="Attendance date" value={date} max={today} disabled={periodBusy} onChange={event => changeDate(event.target.value)} />
          </label>
          <button type="button" className="att-button" aria-label="Next day" disabled={date >= today || periodBusy} onClick={() => stepDate(1)}><Icons.ChevronRightIcon aria-hidden="true" /></button>
          {date !== today && <button type="button" className="att-button" disabled={periodBusy} onClick={() => changeDate(today)}>Today</button>}
        </div>
        <label className="att-field att-daily-department"><span>Department</span>
          <select aria-label="Department" value={department} onChange={event => setDepartment(event.target.value)}>
            <option value="all">All departments</option>
            {department !== 'all' && !departments.includes(department) && <option value={department}>{department}</option>}
            {departments.map(item => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label className="att-field att-search"><span className="sr-only">Search employees</span>
          <div className="att-search-box"><Icons.MagnifyingGlassIcon aria-hidden="true" /><input aria-label="Search employees" value={search} placeholder="Employee name or ID" onChange={event => setSearch(event.target.value)} /></div>
        </label>
        <div className="att-daily-tools">
          <details className="att-columns" onKeyDown={event => { if (event.key === 'Escape') { event.currentTarget.open = false; event.currentTarget.querySelector('summary')?.focus() } }}>
            <summary className="att-button"><Icons.ViewColumnsIcon aria-hidden="true" />Columns<Icons.ChevronDownIcon aria-hidden="true" /></summary>
            <div className="att-columns-panel">
              {ATTENDANCE_DAILY_COLS.filter(column => column.id !== 'name').map(column => <label key={column.id}>
                <input type="checkbox" checked={!hiddenColumns.includes(column.id)} onChange={event => setHiddenColumns(previous => event.target.checked ? previous.filter(id => id !== column.id) : [...previous, column.id])} />{column.label}
              </label>)}
            </div>
          </details>
          <label className="att-density"><span className="sr-only">Density</span><select aria-label="Density" value={density} onChange={event => setDensity(event.target.value)}><option value="comfortable">Comfortable</option><option value="compact">Compact</option></select></label>
          <button type="button" className="att-button" disabled={exporting || !ready} title="Export all attendance records for the selected date" onClick={exportDay}><Icons.ArrowDownTrayIcon aria-hidden="true" />{exporting ? 'Exporting…' : 'Export'}</button>
          <button type="button" className="att-button" aria-label="Refresh daily attendance" disabled={loading || uploading} onClick={onRefresh}><Icons.ArrowPathIcon aria-hidden="true" /></button>
          {canUpload && <label className="att-button att-upload"><Icons.ArrowUpTrayIcon aria-hidden="true" />{uploading ? 'Importing…' : 'Upload daily hours'}
            <input ref={fileRef} className="att-file-input" type="file" aria-label="Upload daily hours" accept=".xlsx,.csv" disabled={uploading} onChange={selectUpload} />
          </label>}
        </div>
      </div>

      {exportError && <div className="att-daily-error" role="alert">{exportError}<button type="button" className="att-button" disabled={exporting} onClick={exportDay}>Retry export</button></div>}
      {uploadError && <div className="att-daily-error" role="alert"><span>{uploadError}{uploadSelection && ` Upload period: ${uploadSelection.year}-${String(uploadSelection.month).padStart(2, '0')}.`}</span><button type="button" className="att-button" disabled={uploading} onClick={() => uploadHours()}>Retry upload</button></div>}
      {uploadMessage && <p className="att-daily-notice" role="status">{uploadMessage}</p>}

      <dl className="att-summary att-daily-summary" aria-label="Daily attendance summary" title="Counts cover all returned attendance records for the selected date. In progress can also be included in a daily status.">
        {summaryItems.map(({ id, label, Icon }) => <div className="att-summary-item" data-status={id} key={id} title={id === 'in_progress' && !progressAvailable ? 'Open-shift information is unavailable for this source.' : undefined}>
          <Icon aria-hidden="true" /><div><dt>{label}</dt><dd>{countLabel(id)}</dd></div>
        </div>)}
      </dl>

      <div className="att-status-filters" role="group" aria-label="Filter daily status">
        {summaryItems.map(({ id, label, Icon }) => <button type="button" key={id} className="att-status-filter" data-status={id} aria-pressed={status === id} disabled={id === 'in_progress' && !progressAvailable} onClick={() => setStatus(id)}>
          <Icon aria-hidden="true" />{id === 'all' ? 'All' : label} ({countLabel(id)})
        </button>)}
      </div>

      <div className="att-daily-panel" aria-busy={loading}>
        <div className="att-daily-table-heading">
          <span>{ready ? `${filtered.length.toLocaleString()} attendance records` : 'Attendance records'} · {date}</span>
          {ready && <span className="att-daily-source"><Icons.CircleStackIcon aria-hidden="true" />{source || 'Attendance records'}</span>}
        </div>
        {loading ? <div className="att-daily-empty" role="status"><Icons.ArrowPathIcon className="animate-spin" aria-hidden="true" />Loading daily attendance…</div>
          : error ? <div className="att-daily-empty att-daily-load-error" role="alert"><Icons.ExclamationTriangleIcon aria-hidden="true" /><p>{error}</p><button type="button" className="att-button" onClick={onRefresh}>Retry</button></div>
            : !filtered.length ? <div className="att-daily-empty" role="status"><Icons.CalendarDaysIcon aria-hidden="true" /><p>{hasFilters ? 'No attendance records match these filters.' : 'No attendance records for the selected date.'}</p>{hasFilters && <button type="button" className="att-button" onClick={() => { setSearch(''); setDepartment('all'); setStatus('all') }}>Clear filters</button>}</div>
              : <>
                <div className="att-table-scroll" role="region" aria-label="Daily attendance table" tabIndex={0}>
                  <table className="att-daily-table">
                    <caption className="sr-only">Attendance records for {date}</caption>
                    <thead><tr>{visibleColumns.map(column => <th key={column.id} scope="col" aria-sort={sort.key === column.id ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
                      <button type="button" aria-label={`Sort by ${column.label}`} onClick={() => setSort(previous => ({ key: column.id, direction: previous.key === column.id && previous.direction === 'asc' ? 'desc' : 'asc' }))}>{column.label}<Icons.ChevronUpDownIcon aria-hidden="true" /></button>
                    </th>)}</tr></thead>
                    <tbody>{paged.map((row, index) => <tr key={`${row.employee_code || row.radai_user_id || 'record'}:${row.first_in || ''}:${index}`}>
                      {visibleColumns.map(column => {
                        const value = column.accessor(row)
                        if (column.cellType === 'att_status') {
                          const { Icon = Icons.UserIcon } = STATUS.find(item => item.id === value) || {}
                          return <td key={column.id}><span className="att-daily-status" data-status={value}><Icon aria-hidden="true" />{ATTENDANCE_STATUS[value]?.label || value}</span></td>
                        }
                        if (column.cellType === 'hours_worked') return <td key={column.id} className="att-daily-hours">
                          {row.open_shift ? <span className="att-in-progress" title={OPEN_SHIFT_INDICATOR.tooltip}><Icons.ClockIcon aria-hidden="true" />{OPEN_SHIFT_INDICATOR.label}{OPEN_SHIFT_INDICATOR.maxCreditedH > 0 && Number(value) > 0 ? ` (${Number(value).toFixed(1)}h)` : ''}</span>
                            : Number(value) > 0 ? `${Number(value).toFixed(1)}h` : '—'}
                        </td>
                        return <td key={column.id} title={String(value)}>{value}</td>
                      })}
                    </tr>)}</tbody>
                  </table>
                </div>
                <Pagination total={filtered.length} page={safePage} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} itemLabel="records" />
              </>}
      </div>
    </section>
  )
}
