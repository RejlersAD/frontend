import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import * as HeroIcons from '@heroicons/react/24/outline'
import { radaiConfirm } from '../../../services/radaiDialog'
import ts from '../../../services/timesheet.service'
import ValueFrameSendToPayroll from './ValueFrameSendToPayroll'
import './valueframeCheck.css'

// ValueFrame check: hours booked in ValueFrame (monthly Wage Type Report) vs days
// the employee was actually present (office badge-in, HR correction, approved
// Work From Home, site visit check-in). Comparison runs on the backend.
const Icon = ({ name, className = '' }) => {
  const C = HeroIcons[name] || HeroIcons.QuestionMarkCircleIcon
  return <C className={className} aria-hidden="true" />
}
Icon.propTypes = { name: PropTypes.string.isRequired, className: PropTypes.string }

const STATUS = {
  flagged: { label: 'Booked, not present', tone: 'is-red' },
  partial: { label: 'Partial gap', tone: 'is-red' },
  whole_period: { label: 'No attendance all month', tone: 'is-orange' },
  not_enrolled: { label: 'Not in biometric system', tone: 'is-amber' },
  ok: { label: 'Matches', tone: 'is-green' },
  no_booking: { label: 'No office booking', tone: 'is-slate' },
}
const FILTERS = [['all', 'All'], ['partial', 'Partial gap'], ['whole_period', 'No attendance all month'], ['not_enrolled', 'Not enrolled'], ['ok', 'Matches'], ['no_booking', 'No booking']]
// A row's display key: flagged rows split by pattern (partial gap vs no attendance all month).
const rowKey = row => (row.status === 'flagged' ? (row.pattern || 'partial') : row.status)
const fmtDate = value => value ? new Date(`${String(value).slice(0, 10)}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''
const days = value => (Math.round((Number(value) || 0) * 10) / 10).toLocaleString('en-GB')
const hrs = value => (Number(value) || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const errorText = error => {
  const data = error?.response?.data
  return (data && typeof data === 'object' && data.detail) || 'The request could not be completed. Try again.'
}
const csvCell = value => `"${String(value ?? '').replaceAll('"', '""')}"`

export default function ValueFrameCheckTab({ onOpenEmployee }) {
  const [imports, setImports] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [filter, setFilter] = useState('partial')
  const [query, setQuery] = useState('')
  const [sendOpen, setSendOpen] = useState(false)
  const fileInput = useRef(null)

  const loadImports = useCallback(async (selectId) => {
    try {
      const data = await ts.listValueFrameImports()
      const list = data?.results || []
      setImports(list)
      setSelectedId(current => selectId ?? (list.some(i => i.id === current) ? current : list[0]?.id ?? null))
      if (!list.length) setResult(null)
    } catch (err) {
      setError(errorText(err))
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => { loadImports() }, [loadImports])

  useEffect(() => {
    if (!selectedId) return
    let active = true
    setLoading(true)
    setError('')
    ts.fetchValueFrameComparison(selectedId)
      .then(data => { if (active) setResult(data) })
      .catch(err => { if (active) setError(errorText(err)) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [selectedId])

  const upload = async (file, replace = false) => {
    setUploading(true)
    setError('')
    setNotice('')
    try {
      const data = await ts.uploadValueFrameReport(file, replace)
      setResult(data)
      setFilter(data.summary.flagged_partial ? 'partial' : data.summary.flagged ? 'whole_period' : 'all')
      await loadImports(data.import.id)
      setNotice(`${data.import.file_name}: ${data.summary.employees} employees compared for ${fmtDate(data.import.period_start)} – ${fmtDate(data.import.period_end)}.`)
    } catch (err) {
      if (err?.response?.status === 409 && !replace) {
        if (await radaiConfirm(`${err.response.data.detail} The current comparison for that month will be replaced.`)) {
          await upload(file, true)
          return
        }
      } else {
        setError(errorText(err))
      }
    } finally {
      setUploading(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  const removeImport = async () => {
    const current = imports.find(i => i.id === selectedId)
    if (!current || !(await radaiConfirm(`Delete the ValueFrame upload for ${fmtDate(current.period_start)} – ${fmtDate(current.period_end)}? Attendance records are not affected.`))) return
    try {
      await ts.deleteValueFrameImport(current.id)
      setSelectedId(null)
      setResult(null)
      await loadImports()
    } catch (err) {
      setError(errorText(err))
    }
  }

  const rows = useMemo(() => {
    const term = query.trim().toLowerCase()
    return (result?.rows || []).filter(row => (filter === 'all' || rowKey(row) === filter)
      && (!term || `${row.employee_name} ${row.employee_code}`.toLowerCase().includes(term)))
  }, [result, filter, query])
  const counts = useMemo(() => (result?.rows || []).reduce((acc, row) => ({ ...acc, [rowKey(row)]: (acc[rowKey(row)] || 0) + 1 }), {}), [result])

  const exportCsv = () => {
    const period = result?.import ? `${result.import.period_start}_${result.import.period_end}` : 'period'
    const lines = [['Employee number', 'Employee name', 'Booked hours', 'Booked days', 'Leave days', 'Present days', 'Actual hours (Monthly matrix)', 'Hours difference', 'Office badge-in', 'HR correction', 'Work from home', 'Site visit', 'Gap days', 'Status'],
      ...rows.map(r => [r.employee_code, r.employee_name, r.booked_hours, r.booked_days, r.leave_days, r.present_days, r.actual_hours, r.hours_difference, r.office_days, r.manual_days, r.wfh_days, r.site_days, r.gap_days, STATUS[rowKey(r)]?.label || r.status])]
    const blob = new Blob([lines.map(line => line.map(csvCell).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' })
    const href = URL.createObjectURL(blob)
    const anchor = Object.assign(document.createElement('a'), { href, download: `valueframe-check-${period}.csv` })
    anchor.click()
    URL.revokeObjectURL(href)
  }

  const summary = result?.summary
  const current = result?.import
  return (
    <section className="vf-check" aria-labelledby="vf-check-title">
      <header className="vf-head">
        <div className="min-w-0">
          <h2 id="vf-check-title">ValueFrame check</h2>
          <p>Compare office time booked in ValueFrame with days employees were actually present: office badge-in, HR corrections, approved Work From Home and site visit check-ins.</p>
        </div>
        <div className="vf-actions">
          {imports.length > 0 && (
            <label className="vf-period">
              <span className="sr-only">ValueFrame upload</span>
              <select value={selectedId ?? ''} onChange={event => setSelectedId(Number(event.target.value))}>
                {imports.map(item => <option key={item.id} value={item.id}>{fmtDate(item.period_start)} – {fmtDate(item.period_end)}</option>)}
              </select>
            </label>
          )}
          {current && <button type="button" className="att-button" onClick={exportCsv} disabled={!rows.length}><Icon name="ArrowDownTrayIcon" />Export</button>}
          {current && summary?.flagged > 0 && summary?.attendance_available !== false && <button type="button" className="att-button vf-to-payroll" onClick={() => setSendOpen(true)}
            title="Send booked-but-not-present days to Payroll Management as pending deductions"><Icon name="BanknotesIcon" />Send to Payroll</button>}
          {current && <button type="button" className="att-button vf-delete" onClick={removeImport} aria-label="Delete this ValueFrame upload" title="Delete this upload"><Icon name="TrashIcon" /></button>}
          <label className={`att-button att-upload ${uploading ? 'is-busy' : ''}`}>
            <Icon name="ArrowUpTrayIcon" />{uploading ? 'Uploading…' : 'Upload ValueFrame report'}
            <input ref={fileInput} className="att-file-input" type="file" accept=".xlsx,.xlsm" disabled={uploading}
              onChange={event => { const file = event.target.files?.[0]; if (file) upload(file) }} />
          </label>
        </div>
      </header>

      {notice && <p className="vf-notice" role="status"><Icon name="CheckCircleIcon" />{notice}</p>}
      {error && <p className="vf-error" role="alert"><Icon name="ExclamationTriangleIcon" />{error}</p>}
      {summary?.attendance_available === false && (
        <p className="vf-error" role="alert"><Icon name="ExclamationTriangleIcon" />
          Real-time attendance is not reachable right now (Monthly matrix source unavailable), so present days and actual hours show 0.
          These results are not reliable and cannot be sent to Payroll. Refresh once the Monthly matrix shows data again.</p>
      )}
      {current?.warnings?.length > 0 && <p className="vf-warn"><Icon name="InformationCircleIcon" />{current.warnings.join(' ')}</p>}

      {!loading && !imports.length && !error && (
        <div className="vf-empty">
          <Icon name="DocumentArrowUpIcon" />
          <h3>Upload a ValueFrame Wage Type Report</h3>
          <p>Export the monthly <strong>Wage Type Report</strong> from ValueFrame as Excel (.xlsx) and upload it here. RADAI reads the period from the report title and matches each Employee Number with the biometric code.</p>
        </div>
      )}

      {summary && (
        <>
          <div className="vf-explain" aria-label="How the ValueFrame check works">
            <div className="vf-src is-vf">
              <span className="vf-src-tag">Source 1 · ValueFrame</span>
              <strong>What employees booked</strong>
              <p>Uploaded Excel ({current?.file_name}) for {fmtDate(current?.period_start)} – {fmtDate(current?.period_end)}. “Normal” hours booked as work, plus leave.</p>
            </div>
            <span className="vf-op" aria-hidden="true">−</span>
            <div className="vf-src is-rt">
              <span className="vf-src-tag">Source 2 · Real-time attendance</span>
              <strong>Where employees actually were</strong>
              <p>The same data as the <strong>Monthly matrix</strong>: a day with a badge-in counts as present. Approved Work From Home, site visit check-ins and HR corrections also count.</p>
              {summary?.attendance_source && <small className="vf-src-note">Source: {summary.attendance_source}</small>}
            </div>
            <span className="vf-op" aria-hidden="true">=</span>
            <div className="vf-src is-gap">
              <span className="vf-src-tag">Result</span>
              <strong>Gap to review</strong>
              <p>Booked days with no matching presence. 1 day or more is flagged and can be sent to Payroll.</p>
            </div>
          </div>

          <div className="vf-kpis">
            <div><span>Employees compared</span><strong>{summary.employees}</strong><small>{current?.company || ''}</small></div>
            <div className="is-red"><span>Booked, not present</span><strong>{summary.flagged}</strong><small>{summary.flagged_partial ?? 0} partial gap · {summary.flagged_whole_period ?? 0} no attendance all month</small></div>
            <div className="is-amber"><span>Not in biometric system</span><strong>{summary.not_enrolled}</strong><small>booked time, no attendance source</small></div>
            <div className="is-vf"><span>Booked office days <em className="vf-chip is-vf">ValueFrame</em></span><strong>{days(summary.booked_days)}</strong><small>{hrs(summary.booked_hours)} h booked ÷ {summary.hours_per_day} h/day</small></div>
            <div className="is-rt"><span>Present days <em className="vf-chip is-rt">Real-time</em></span><strong>{days(summary.present_days)}</strong><small>{hrs(summary.actual_hours)} h actual (Monthly matrix)</small></div>
          </div>

          <div className="vf-toolbar">
            <div className="vf-filters" role="group" aria-label="Filter by status">
              {FILTERS.map(([id, label]) => (
                <button key={id} type="button" aria-pressed={filter === id} onClick={() => setFilter(id)}>
                  {label}<span>{id === 'all' ? result.rows.length : counts[id] || 0}</span>
                </button>
              ))}
            </div>
            <label className="vf-search">
              <Icon name="MagnifyingGlassIcon" />
              <span className="sr-only">Search employees</span>
              <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search name or employee number" />
            </label>
          </div>

          <div className="att-table-scroll vf-table">
            <table>
              <thead>
                <tr className="vf-group-row">
                  <th rowSpan={2}>Employee</th>
                  <th colSpan={2} className="vf-group is-vf">ValueFrame · booked</th>
                  <th colSpan={3} className="vf-group is-rt">Real-time attendance · actual</th>
                  <th colSpan={2} className="vf-group">Result</th>
                  <th rowSpan={2} className="num"><span className="sr-only">Actions</span></th>
                </tr>
                <tr>
                  <th className="num is-vf">Booked</th><th className="num is-vf">Leave</th>
                  <th className="num is-rt">Present</th><th className="num is-rt">Actual hours</th><th className="is-rt">By source</th>
                  <th className="num">Gap</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.employee_code} className={row.status === 'flagged' ? 'is-flagged' : ''}>
                    <td><strong>{row.employee_name || '—'}</strong><small>{row.employee_code}</small></td>
                    <td className="num is-vf">{days(row.booked_days)} d<small>{days(row.booked_hours)} h</small></td>
                    <td className="num is-vf">{row.leave_days ? `${days(row.leave_days)} d` : '—'}</td>
                    <td className="num is-rt"><strong>{row.present_days} d</strong></td>
                    <td className="num is-rt"><strong>{hrs(row.actual_hours)} h</strong>
                      {row.manual_hours > 0 && <small title="Hours added by HR corrections">incl. {hrs(row.manual_hours)} h HR</small>}</td>
                    <td className="is-rt"><div className="vf-sources">
                      {row.office_days > 0 && <span title="Office badge-in">Office {row.office_days}</span>}
                      {row.manual_days > 0 && <span title="HR manual correction">HR {row.manual_days}</span>}
                      {row.wfh_days > 0 && <span title="Approved Work From Home">WFH {row.wfh_days}</span>}
                      {row.site_days > 0 && <span title="Site visit check-in">Site {row.site_days}</span>}
                      {!row.present_days && <em>No attendance</em>}
                    </div></td>
                    <td className={`num ${row.gap_days >= (summary.flag_threshold_days || 1) ? 'vf-gap' : ''}`}>{row.gap_days > 0 ? `${days(row.gap_days)} d` : '—'}
                      {row.hours_difference < 0 && row.booked_hours > 0 && <small title="Actual hours minus booked hours">{hrs(row.hours_difference)} h</small>}</td>
                    <td><span className={`vf-badge ${STATUS[rowKey(row)]?.tone || ''}`}>{STATUS[rowKey(row)]?.label || row.status}</span></td>
                    <td className="num">
                      <button type="button" className="vf-link" onClick={() => onOpenEmployee?.(row.employee_code, current?.period_start)}>Daily record</button>
                    </td>
                  </tr>
                ))}
                {!rows.length && <tr><td colSpan={9} className="vf-none">{loading ? 'Loading comparison…' : 'No employees match this filter.'}</td></tr>}
              </tbody>
            </table>
          </div>
          <p className="vf-foot">
            ValueFrame reports monthly totals, so the check counts days: booked office days (Normal hours ÷ {summary.hours_per_day} h) against days present in the Monthly matrix.
            An employee is flagged when bookings exceed presence by {summary.flag_threshold_days} day or more. <strong>No attendance all month</strong> often means client-site work or deputation: confirm before sending to payroll. Use <em>Daily record</em> to see which dates are missing.
          </p>
        </>
      )}
      {sendOpen && current && <ValueFrameSendToPayroll importId={current.id}
        periodLabel={`${fmtDate(current.period_start)} – ${fmtDate(current.period_end)}`} onClose={() => setSendOpen(false)} />}
    </section>
  )
}

ValueFrameCheckTab.propTypes = { onOpenEmployee: PropTypes.func }
