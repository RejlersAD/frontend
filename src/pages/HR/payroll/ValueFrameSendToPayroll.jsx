import { useEffect, useMemo, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { useNavigate } from 'react-router-dom'
import * as HeroIcons from '@heroicons/react/24/outline'
import payrollEngineService from '../../../services/payrollEngine.service'
import { payrollAdjustmentsLink, VALUEFRAME_ADJUSTMENT_SEARCH } from '../../../config/payrollEngine.config'

// Send ValueFrame gaps to Payroll Management as PENDING "absent" deductions.
// Amounts come from the backend (same rule as unpaid leave); payroll reviews them.
const LINE_STATUS = {
  ready: { label: 'Ready', tone: 'is-green' },
  already_sent: { label: 'Already sent', tone: 'is-blue' },
  below_threshold: { label: 'Below minimum', tone: 'is-slate' },
  no_payroll_record: { label: 'No payroll record', tone: 'is-amber' },
  no_salary: { label: 'No salary on file', tone: 'is-amber' },
}
const SELECTABLE = new Set(['ready', 'already_sent'])
const money = (value, currency) => `${currency} ${Number(value || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const monthOptions = (start, count = 3) => Array.from({ length: count }, (_, i) => {
  const d = new Date(start.year, start.month - 1 + i, 1)
  return { year: d.getFullYear(), month: d.getMonth() + 1, label: d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) }
})
const errorText = error => {
  const data = error?.response?.data
  if (data && typeof data === 'object') return data.detail || Object.values(data).flat().map(String).join(' ')
  return 'The request could not be completed.'
}

export default function ValueFrameSendToPayroll({ importId, periodLabel, onClose }) {
  const navigate = useNavigate()
  const dialog = useRef(null)
  const [proposal, setProposal] = useState(null)
  const [selected, setSelected] = useState(new Set())
  const [target, setTarget] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  useEffect(() => {
    let active = true
    payrollEngineService.getValueFrameProposal(importId).then(data => {
      if (!active) return
      setProposal(data)
      setTarget(data.default_target)
      // Partial gaps are pre-selected; 'no attendance all month' often means client-site work, so HR opts in.
      setSelected(new Set(data.lines.filter(l => l.status === 'ready' && l.pattern !== 'whole_period').map(l => l.employee_code)))
    }).catch(err => { if (active) setError(errorText(err)) })
    return () => { active = false }
  }, [importId])
  useEffect(() => {
    const onKey = event => { if (event.key === 'Escape' && !busy) onClose() }
    window.addEventListener('keydown', onKey)
    dialog.current?.focus()
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onClose])

  const currency = proposal?.currency || 'AED'
  const selectedLines = useMemo(() => (proposal?.lines || []).filter(l => selected.has(l.employee_code)), [proposal, selected])
  const total = selectedLines.reduce((sum, l) => sum + Number(l.amount || 0), 0)
  const toggle = code => setSelected(current => {
    const next = new Set(current)
    next.has(code) ? next.delete(code) : next.add(code)
    return next
  })
  const selectable = (proposal?.lines || []).filter(l => SELECTABLE.has(l.status))
  const allSelected = selectable.length > 0 && selectable.every(l => selected.has(l.employee_code))

  const send = async () => {
    setBusy(true)
    setError('')
    try {
      const data = await payrollEngineService.sendValueFrameToPayroll(importId, {
        target_year: target.year, target_month: target.month, employee_codes: [...selected],
      })
      setResult(data)
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }
  const openPayroll = () => navigate(payrollAdjustmentsLink({ year: result.target_year, month: result.target_month, search: VALUEFRAME_ADJUSTMENT_SEARCH }))
  const targetLabel = target ? new Date(target.year, target.month - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) : ''

  return (
    <div className="vf-modal" onMouseDown={event => { if (event.target === event.currentTarget && !busy) onClose() }}>
      <div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="vf-send-title" className="vf-modal-panel">
        <header className="vf-modal-head">
          <span className="vf-modal-icon"><HeroIcons.BanknotesIcon aria-hidden="true" /></span>
          <div className="min-w-0">
            <h2 id="vf-send-title">Send to Payroll Management</h2>
            <p>ValueFrame {periodLabel} · gaps become <strong>pending</strong> “Absent” deductions for payroll to review</p>
          </div>
          <button type="button" className="vf-modal-close" onClick={onClose} disabled={busy} aria-label="Close"><HeroIcons.XMarkIcon aria-hidden="true" /></button>
        </header>

        {result ? (
          <div className="vf-modal-body">
            <div className="vf-notice"><HeroIcons.CheckCircleIcon aria-hidden="true" />
              <span>{result.created} new and {result.updated} updated pending deduction{result.created + result.updated === 1 ? '' : 's'} for {targetLabel}. Nothing is deducted until payroll applies them in a run.</span>
            </div>
            {result.draft_run_id && (
              <p className="vf-warn"><HeroIcons.InformationCircleIcon aria-hidden="true" />
                A draft payroll run for {targetLabel} already exists. Payroll must use <strong>Regenerate</strong> on that run to include these deductions.</p>
            )}
            <div className="vf-modal-foot">
              <button type="button" className="att-button" onClick={onClose}>Close</button>
              <button type="button" className="att-button att-upload" onClick={openPayroll}><HeroIcons.ArrowTopRightOnSquareIcon aria-hidden="true" />Open in Payroll Management</button>
            </div>
          </div>
        ) : (
          <>
            <div className="vf-modal-body">
              {!proposal && !error && <p className="vf-none">Preparing payroll proposal…</p>}
              {error && <p className="vf-error" role="alert"><HeroIcons.ExclamationTriangleIcon aria-hidden="true" />{error}</p>}
              {proposal && (
                <>
                  <div className="vf-send-controls">
                    <label>Payroll month
                      <select value={target ? `${target.year}-${target.month}` : ''} onChange={event => { const [y, m] = event.target.value.split('-').map(Number); setTarget({ year: y, month: m }) }}>
                        {monthOptions(proposal.default_target).map(o => <option key={`${o.year}-${o.month}`} value={`${o.year}-${o.month}`}>{o.label}</option>)}
                      </select>
                    </label>
                    <p className="vf-send-rule">Deduction = gap days × (monthly gross ÷ standard workdays), the same rule payroll uses for unpaid leave. Gaps round down to {proposal.rules.step_days} day, minimum {proposal.rules.min_days}, maximum {proposal.rules.max_days} per employee.</p>
                  </div>
                  <div className="att-table-scroll vf-table vf-send-table">
                    <table>
                      <thead><tr>
                        <th><input type="checkbox" aria-label="Select all ready employees" checked={allSelected} disabled={!selectable.length}
                          onChange={() => setSelected(allSelected ? new Set() : new Set(selectable.map(l => l.employee_code)))} /></th>
                        <th>Employee</th><th className="num">Present</th><th className="num">Gap</th><th className="num">Daily rate</th><th className="num">Deduction</th><th>Status</th>
                      </tr></thead>
                      <tbody>
                        {proposal.lines.map(line => (
                          <tr key={line.employee_code}>
                            <td><input type="checkbox" aria-label={`Send ${line.employee_name}`} checked={selected.has(line.employee_code)}
                              disabled={!SELECTABLE.has(line.status)} onChange={() => toggle(line.employee_code)} /></td>
                            <td><strong>{line.employee_name || '—'}</strong><small>{line.employee_code}{line.hours_per_day ? ` · ${Number(line.hours_per_day)} h/day` : ''}</small>
                              {line.pattern === 'whole_period' && <small className="vf-whole">No attendance all month: check client-site work first</small>}</td>
                            <td className="num">{line.present_days} d</td>
                            <td className="num">{Number(line.gap_days) ? `${Number(line.gap_days)} d` : '—'}</td>
                            <td className="num">{Number(line.daily_rate) ? money(line.daily_rate, currency) : '—'}</td>
                            <td className="num"><strong>{Number(line.amount) ? money(line.amount, currency) : '—'}</strong>
                              {line.status === 'already_sent' && <small>sent {money(line.sent_amount, currency)} · {line.sent_month}</small>}</td>
                            <td><span className={`vf-badge ${LINE_STATUS[line.status]?.tone || ''}`}>{LINE_STATUS[line.status]?.label || line.status}</span></td>
                          </tr>
                        ))}
                        {!proposal.lines.length && <tr><td colSpan={7} className="vf-none">No flagged employees to send.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
            <div className="vf-modal-foot">
              <span className="vf-send-total">{selectedLines.length} selected · {money(total, currency)} for {targetLabel}</span>
              <button type="button" className="att-button" onClick={onClose} disabled={busy}>Cancel</button>
              <button type="button" className="att-button att-upload" onClick={send} disabled={busy || !selectedLines.length || !proposal?.can_send}
                title={proposal && !proposal.can_send ? 'Only payroll adjustment roles can send.' : undefined}>
                <HeroIcons.PaperAirplaneIcon aria-hidden="true" />{busy ? 'Sending…' : 'Send to Payroll'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

ValueFrameSendToPayroll.propTypes = {
  importId: PropTypes.number.isRequired, periodLabel: PropTypes.string, onClose: PropTypes.func.isRequired,
}
