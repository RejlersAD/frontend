/* eslint-disable react/prop-types */
import React, { useEffect, useMemo, useState } from 'react'
import {
  ArrowPathIcon, BanknotesIcon, ChevronDownIcon, ClockIcon, LockClosedIcon,
  PlusIcon, ShieldCheckIcon, XMarkIcon,
} from '@heroicons/react/24/outline'

import * as PC from '../../../services/projectControl.service'

const rows = (value) => (Array.isArray(value) ? value : value?.results || [])
const fieldClass = 'mt-1 min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-200'
const secondaryButton = 'inline-flex min-h-9 items-center justify-center rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 disabled:cursor-not-allowed disabled:opacity-50'
const primaryButton = 'inline-flex min-h-9 items-center justify-center rounded-lg bg-indigo-700 px-3 text-xs font-semibold text-white hover:bg-indigo-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50'

const errorMessage = (error, fallback) => {
  const data = error?.response?.data
  const status = error?.response?.status
  const endpoint = error?.config?.url || 'the requested Project Control API endpoint'
  if (typeof data === 'string' && /<!doctype html|<html[\s>]/i.test(data)) {
    return `Backend route ${endpoint} is unavailable (HTTP ${status || 404}). The frontend and backend are running different API versions; restart or deploy the backend containing this route.`
  }
  if (status === 404) {
    return `Backend route ${endpoint} was not found (HTTP 404). The frontend and backend API versions do not match.`
  }
  if (typeof data === 'string') return data
  if (data?.detail) return data.detail
  if (data && typeof data === 'object') {
    const first = Object.values(data).flat().find(Boolean)
    if (first) return String(first)
  }
  return error?.message || fallback
}

const statusTone = {
  draft: 'bg-slate-100 text-slate-700',
  open: 'bg-emerald-100 text-emerald-800',
  reopened: 'bg-amber-100 text-amber-800',
  submitted: 'bg-blue-100 text-blue-800',
  active: 'bg-emerald-100 text-emerald-800',
  locked: 'bg-slate-800 text-white',
  closed: 'bg-slate-200 text-slate-700',
}

function StatusBadge({ value, label }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusTone[value] || statusTone.draft}`}>{label || value}</span>
}

export default function ControlsPeriodsTab({ project }) {
  const [accounts, setAccounts] = useState([])
  const [periods, setPeriods] = useState([])
  const [wbsNodes, setWbsNodes] = useState([])
  const [budgets, setBudgets] = useState([])
  const [hourEntries, setHourEntries] = useState([])
  const [snapshots, setSnapshots] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState(null)
  const [showAccountForm, setShowAccountForm] = useState(false)
  const [showPeriodForm, setShowPeriodForm] = useState(false)
  const [showHourForm, setShowHourForm] = useState(false)
  const [reconciliations, setReconciliations] = useState({})
  const [reopenId, setReopenId] = useState(null)
  const [reopenReason, setReopenReason] = useState('')
  const [history, setHistory] = useState({})

  const people = useMemo(() => {
    const map = new Map()
    if (project.owner) map.set(String(project.owner.id), project.owner)
    ;(project.team_members_data || []).forEach((membership) => {
      if (membership.is_active !== false && membership.user) map.set(String(membership.user.id), membership.user)
    })
    return [...map.values()]
  }, [project])

  const [accountForm, setAccountForm] = useState({
    wbs_node: '', code: '', name: '', manager: '', earned_value_method: 'weighted_milestone',
    baseline_start: project.start_date || '', baseline_finish: project.end_date || '', notes: '',
  })
  const [periodForm, setPeriodForm] = useState({
    sequence: 1, name: '', start_date: '', end_date: '', data_date: '', notes: '',
  })
  const [hourForm, setHourForm] = useState({
    control_account: '', reporting_period: '', employee_code: '', employee_name: '',
    work_date: '', hours: '', hourly_cost_rate: '', source_reference: '', notes: '',
  })

  const reload = async () => {
    setLoading(true)
    try {
      const requests = await Promise.allSettled([
        PC.listControlAccounts(project.id), PC.listReportingPeriods(project.id),
        PC.listWbsNodes(project.id), PC.listBudgetAllocations(project.id),
        PC.listApprovedHours(project.id), PC.listIntegratedSnapshots(project.id),
      ])
      const [nextAccounts, nextPeriods, nextWbs, nextBudgets, nextHours, nextSnapshots] = requests.map((result) => (
        result.status === 'fulfilled' ? result.value : []
      ))
      const periodRows = rows(nextPeriods)
      setAccounts(rows(nextAccounts))
      setPeriods(periodRows)
      setWbsNodes(rows(nextWbs))
      setBudgets(rows(nextBudgets))
      setHourEntries(rows(nextHours))
      setSnapshots(rows(nextSnapshots))
      setPeriodForm((current) => ({
        ...current,
        sequence: periodRows.reduce((max, period) => Math.max(max, Number(period.sequence) || 0), 0) + 1,
      }))
      const failed = requests
        .map((result, index) => ({ result, label: ['Control Accounts', 'reporting periods', 'WBS', 'budgets', 'approved hours', 'reporting snapshots'][index] }))
        .filter(({ result }) => result.status === 'rejected')
      if (failed.length) {
        const first = failed[0]
        setMessage({
          tone: 'error',
          text: `${first.label} could not be loaded. ${errorMessage(first.result.reason, 'The backend request failed.')}`,
        })
      }
    } catch (error) {
      setMessage({ tone: 'error', text: errorMessage(error, 'Could not load project controls.') })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setAccountForm({
      wbs_node: '', code: '', name: '', manager: '', earned_value_method: 'weighted_milestone',
      baseline_start: project.start_date || '', baseline_finish: project.end_date || '', notes: '',
    })
    setShowAccountForm(false)
    setShowPeriodForm(false)
    setShowHourForm(false)
    setReopenId(null)
    setHistory({})
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id])

  const approvedBudgetByWbs = useMemo(() => budgets.reduce((totals, budget) => {
    if (budget.status === 'approved') totals[budget.wbs_node] = (totals[budget.wbs_node] || 0) + Number(budget.amount || 0)
    return totals
  }, {}), [budgets])
  const assignedWbs = new Set(accounts.map((account) => String(account.wbs_node)))
  const hasEntryWindow = periods.some((period) => period.is_entry_allowed)

  const runAction = async (key, action, success) => {
    setBusy(key)
    try {
      await action()
      setMessage({ tone: 'success', text: success })
      await reload()
      return true
    } catch (error) {
      setMessage({ tone: 'error', text: errorMessage(error, 'The governance action could not be completed.') })
      return false
    } finally {
      setBusy('')
    }
  }

  const createAccount = async (event) => {
    event.preventDefault()
    const created = await runAction('new-account', () => PC.createControlAccount({ ...accountForm, project: project.id }), 'Draft Control Account created.')
    if (!created) return
    setShowAccountForm(false)
    setAccountForm({
      wbs_node: '', code: '', name: '', manager: '', earned_value_method: 'weighted_milestone',
      baseline_start: project.start_date || '', baseline_finish: project.end_date || '', notes: '',
    })
  }

  const createPeriod = async (event) => {
    event.preventDefault()
    const created = await runAction('new-period', () => PC.createReportingPeriod({ ...periodForm, project: project.id }), 'Reporting period opened for data entry.')
    if (!created) return
    setShowPeriodForm(false)
    setPeriodForm((current) => ({ ...current, name: '', start_date: '', end_date: '', data_date: '', notes: '' }))
  }

  const createHour = async (event) => {
    event.preventDefault()
    const created = await runAction('new-hour', () => PC.createApprovedHour({ ...hourForm, project: project.id }), 'Draft project-hour entry created.')
    if (!created) return
    setShowHourForm(false)
    setHourForm({ control_account: '', reporting_period: '', employee_code: '', employee_name: '', work_date: '', hours: '', hourly_cost_rate: '', source_reference: '', notes: '' })
  }

  const reconcilePeriod = async (period) => {
    setBusy(`reconcile-${period.id}`)
    try {
      const result = await PC.reconcileReportingPeriod(period.id)
      setReconciliations((current) => ({ ...current, [period.id]: result }))
      setMessage({ tone: result.exception_count ? 'error' : 'success', text: result.exception_count ? `Reconciliation found ${result.exception_count} blocking exception(s).` : `Reconciled ${result.approved_hours} approved hours and ${Number(result.ledger_actual_cost).toLocaleString()} ${project.currency || 'AED'} actual cost.` })
      await reload()
    } catch (error) {
      setMessage({ tone: 'error', text: errorMessage(error, 'Could not reconcile reporting-period actuals.') })
    } finally {
      setBusy('')
    }
  }

  const showHistory = async (periodId) => {
    if (history[periodId]) {
      setHistory((current) => ({ ...current, [periodId]: null }))
      return
    }
    setBusy(`history-${periodId}`)
    try {
      const events = await PC.getReportingPeriodHistory(periodId)
      setHistory((current) => ({ ...current, [periodId]: events }))
    } catch (error) {
      setMessage({ tone: 'error', text: errorMessage(error, 'Could not load period history.') })
    } finally {
      setBusy('')
    }
  }

  const reopenPeriod = async (event, periodId) => {
    event.preventDefault()
    const reopened = await runAction(
      `period-${periodId}`,
      () => PC.reopenReportingPeriod(periodId, reopenReason),
      'Reporting period reopened with an audit record.',
    )
    if (reopened) {
      setReopenId(null)
      setReopenReason('')
    }
  }

  if (loading) return <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">Loading governed controls…</div>

  return (
    <div className="space-y-5">
      <section className="grid gap-3 md:grid-cols-4" aria-label="Control governance summary">
        <Summary label="Control Accounts" value={accounts.length} detail={`${accounts.filter((row) => row.status === 'active').length} active`} tone="blue" />
        <Summary label="Approved control budget" value={`${accounts.reduce((sum, row) => sum + Number(row.approved_budget || 0), 0).toLocaleString()} ${project.currency || 'AED'}`} detail="Derived from approved WBS budgets" tone="indigo" />
        <Summary label="Current entry window" value={periods.find((period) => period.is_entry_allowed)?.name || 'None'} detail={hasEntryWindow ? 'Progress and actuals may be entered' : 'Data entry is blocked'} tone={hasEntryWindow ? 'green' : 'amber'} />
        <Summary label="Locked periods" value={periods.filter((row) => row.status === 'locked').length} detail="Immutable reporting history" tone="violet" />
      </section>

      {message && (
        <div role={message.tone === 'error' ? 'alert' : 'status'} className={`flex items-start justify-between rounded-lg border px-4 py-3 text-sm ${message.tone === 'error' ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
          <span>{message.text}</span><button type="button" onClick={() => setMessage(null)} aria-label="Dismiss message"><XMarkIcon className="h-5 w-5" /></button>
        </div>
      )}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white" aria-labelledby="control-accounts-title">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div><h2 id="control-accounts-title" className="flex items-center gap-2 text-base font-semibold text-slate-900"><ShieldCheckIcon className="h-5 w-5 text-indigo-700" />Control Accounts</h2><p className="mt-1 text-xs text-slate-500">One accountable manager and measurement method for each controlled WBS scope.</p></div>
          <button type="button" className={primaryButton} onClick={() => setShowAccountForm((value) => !value)} disabled={!wbsNodes.length}><PlusIcon className="mr-1.5 h-4 w-4" />New Control Account</button>
        </div>

        {showAccountForm && (
          <form onSubmit={createAccount} className="grid gap-4 border-b border-slate-200 bg-slate-50 p-5 md:grid-cols-3">
            <Field label="Controlled WBS"><select required className={fieldClass} value={accountForm.wbs_node} onChange={(event) => setAccountForm({ ...accountForm, wbs_node: event.target.value })}><option value="">Select unassigned WBS</option>{wbsNodes.filter((node) => !assignedWbs.has(String(node.id))).map((node) => <option key={node.id} value={node.id}>{node.code} — {node.name} · {(approvedBudgetByWbs[node.id] || 0).toLocaleString()} approved</option>)}</select></Field>
            <Field label="Account code"><input required className={fieldClass} value={accountForm.code} onChange={(event) => setAccountForm({ ...accountForm, code: event.target.value })} placeholder="CA-ENG-001" /></Field>
            <Field label="Account name"><input required className={fieldClass} value={accountForm.name} onChange={(event) => setAccountForm({ ...accountForm, name: event.target.value })} /></Field>
            <Field label="Control Account Manager"><select required className={fieldClass} value={accountForm.manager} onChange={(event) => setAccountForm({ ...accountForm, manager: event.target.value })}><option value="">Select project member</option>{people.map((person) => <option key={person.id} value={person.id}>{[person.first_name, person.last_name].filter(Boolean).join(' ') || person.email}</option>)}</select></Field>
            <Field label="Earned value method"><select className={fieldClass} value={accountForm.earned_value_method} onChange={(event) => setAccountForm({ ...accountForm, earned_value_method: event.target.value })}><option value="weighted_milestone">Weighted milestones</option><option value="units_complete">Units complete</option><option value="percent_complete">Physical percent complete</option><option value="level_of_effort">Level of effort</option></select></Field>
            <div className="grid grid-cols-2 gap-2"><Field label="Baseline start"><input required type="date" className={fieldClass} value={accountForm.baseline_start} onChange={(event) => setAccountForm({ ...accountForm, baseline_start: event.target.value })} /></Field><Field label="Baseline finish"><input required type="date" className={fieldClass} value={accountForm.baseline_finish} onChange={(event) => setAccountForm({ ...accountForm, baseline_finish: event.target.value })} /></Field></div>
            <div className="flex justify-end gap-2 md:col-span-3"><button type="button" className={secondaryButton} onClick={() => setShowAccountForm(false)}>Cancel</button><button className={primaryButton} disabled={busy === 'new-account'}>{busy === 'new-account' ? 'Creating…' : 'Create draft'}</button></div>
          </form>
        )}

        <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Account / WBS</th><th className="px-4 py-3">Manager</th><th className="px-4 py-3">Measurement</th><th className="px-4 py-3 text-right">Approved budget</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Action</th></tr></thead><tbody className="divide-y divide-slate-100">
          {accounts.map((account) => <tr key={account.id}><td className="px-4 py-3"><p className="font-semibold text-slate-900">{account.code} · {account.name}</p><p className="text-xs text-slate-500">{account.wbs_code} · {account.wbs_name} · {account.baseline_start}–{account.baseline_finish}</p></td><td className="px-4 py-3">{account.manager_name}</td><td className="px-4 py-3 text-xs">{account.earned_value_method_display}</td><td className="px-4 py-3 text-right font-semibold">{Number(account.approved_budget || 0).toLocaleString()} {account.currency}</td><td className="px-4 py-3"><StatusBadge value={account.status} label={account.status_display} /></td><td className="px-4 py-3 text-right">{account.status === 'draft' && <button className={secondaryButton} disabled={busy === `account-${account.id}`} onClick={() => runAction(`account-${account.id}`, () => PC.submitControlAccount(account.id), 'Control Account submitted for independent approval.')}>Submit</button>}{account.status === 'submitted' && <button className={primaryButton} disabled={busy === `account-${account.id}`} onClick={() => runAction(`account-${account.id}`, () => PC.approveControlAccount(account.id), 'Control Account approved and activated.')}>Approve</button>}{account.status === 'active' && <button className={secondaryButton} disabled={busy === `account-${account.id}`} onClick={() => runAction(`account-${account.id}`, () => PC.closeControlAccount(account.id), 'Control Account closed.')}>Close</button>}</td></tr>)}
          {!accounts.length && <tr><td colSpan="6" className="px-5 py-10 text-center text-sm text-slate-500">No Control Accounts. Create WBS and approved budget allocations first, then assign accountable control ownership here.</td></tr>}
        </tbody></table></div>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white" aria-labelledby="actuals-title">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div><h2 id="actuals-title" className="flex items-center gap-2 text-base font-semibold text-slate-900"><BanknotesIcon className="h-5 w-5 text-indigo-700" />Approved hours &amp; reconciled actuals</h2><p className="mt-1 text-xs text-slate-500">Labour becomes cost only after independent approval. Verified finance actuals map through approved WBS allocations.</p></div>
          <button type="button" className={primaryButton} onClick={() => setShowHourForm((value) => !value)} disabled={!accounts.some((account) => account.status === 'active') || !hasEntryWindow}><PlusIcon className="mr-1.5 h-4 w-4" />Enter project hours</button>
        </div>
        {showHourForm && <form onSubmit={createHour} className="grid gap-4 border-b border-slate-200 bg-slate-50 p-5 md:grid-cols-4">
          <Field label="Control Account"><select required className={fieldClass} value={hourForm.control_account} onChange={(event) => setHourForm({ ...hourForm, control_account: event.target.value })}><option value="">Select active account</option>{accounts.filter((account) => account.status === 'active').map((account) => <option key={account.id} value={account.id}>{account.code} — {account.name}</option>)}</select></Field>
          <Field label="Reporting period"><select required className={fieldClass} value={hourForm.reporting_period} onChange={(event) => setHourForm({ ...hourForm, reporting_period: event.target.value })}><option value="">Select open period</option>{periods.filter((period) => period.is_entry_allowed).map((period) => <option key={period.id} value={period.id}>{period.name}</option>)}</select></Field>
          <Field label="Employee code"><input required className={fieldClass} value={hourForm.employee_code} onChange={(event) => setHourForm({ ...hourForm, employee_code: event.target.value })} /></Field>
          <Field label="Employee name"><input className={fieldClass} value={hourForm.employee_name} onChange={(event) => setHourForm({ ...hourForm, employee_name: event.target.value })} /></Field>
          <Field label="Work date"><input required type="date" className={fieldClass} value={hourForm.work_date} onChange={(event) => setHourForm({ ...hourForm, work_date: event.target.value })} /></Field>
          <Field label="Approved hours"><input required min="0.01" step="0.01" type="number" className={fieldClass} value={hourForm.hours} onChange={(event) => setHourForm({ ...hourForm, hours: event.target.value })} /></Field>
          <Field label={`Cost rate (${project.currency || 'AED'}/hour)`}><input required min="0" step="0.01" type="number" className={fieldClass} value={hourForm.hourly_cost_rate} onChange={(event) => setHourForm({ ...hourForm, hourly_cost_rate: event.target.value })} /></Field>
          <Field label="Source reference"><input required className={fieldClass} value={hourForm.source_reference} onChange={(event) => setHourForm({ ...hourForm, source_reference: event.target.value })} placeholder="TS-2026-0001" /></Field>
          <div className="flex justify-end gap-2 md:col-span-4"><button type="button" className={secondaryButton} onClick={() => setShowHourForm(false)}>Cancel</button><button className={primaryButton} disabled={busy === 'new-hour'}>{busy === 'new-hour' ? 'Creating…' : 'Create draft'}</button></div>
        </form>}
        <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Source / employee</th><th className="px-4 py-3">Account / date</th><th className="px-4 py-3 text-right">Hours</th><th className="px-4 py-3 text-right">Labour cost</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Action</th></tr></thead><tbody className="divide-y divide-slate-100">
          {hourEntries.map((entry) => <tr key={entry.id}><td className="px-4 py-3"><p className="font-semibold text-slate-900">{entry.source_reference}</p><p className="text-xs text-slate-500">{entry.employee_code}{entry.employee_name ? ` · ${entry.employee_name}` : ''}</p></td><td className="px-4 py-3"><p>{entry.control_account_code}</p><p className="text-xs text-slate-500">{entry.work_date} · {entry.reporting_period_name}</p></td><td className="px-4 py-3 text-right">{entry.hours}</td><td className="px-4 py-3 text-right font-semibold">{Number(entry.labor_actual_cost || 0).toLocaleString()} {entry.currency}</td><td className="px-4 py-3"><StatusBadge value={entry.status} label={entry.status_display} /></td><td className="px-4 py-3 text-right">{entry.status === 'draft' && <button className={secondaryButton} disabled={busy === `hour-${entry.id}`} onClick={() => runAction(`hour-${entry.id}`, () => PC.submitApprovedHour(entry.id), 'Hour entry submitted for independent approval.')}>Submit</button>}{entry.status === 'submitted' && <button className={primaryButton} disabled={busy === `hour-${entry.id}`} onClick={() => runAction(`hour-${entry.id}`, () => PC.approveApprovedHour(entry.id), 'Hours approved and ready for reconciliation.')}>Approve</button>}</td></tr>)}
          {!hourEntries.length && <tr><td colSpan="6" className="px-5 py-8 text-center text-sm text-slate-500">No project-attributed hour entries. Attendance is not charged until a project and Control Account are assigned.</td></tr>}
        </tbody></table></div>
        {periods.filter((period) => period.is_entry_allowed).map((period) => <div key={period.id} className="border-t border-slate-200 px-5 py-4"><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-slate-700"><strong>{period.name}</strong> · Reconcile approved hours and verified finance actuals before submission.</p><button className={secondaryButton} disabled={busy === `reconcile-${period.id}`} onClick={() => reconcilePeriod(period)}><ArrowPathIcon className="mr-1.5 h-4 w-4" />{busy === `reconcile-${period.id}` ? 'Reconciling…' : 'Reconcile actuals'}</button></div>{reconciliations[period.id] && <div className={`mt-3 rounded-lg border px-4 py-3 text-xs ${reconciliations[period.id].exception_count ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}><p className="font-semibold">Run {reconciliations[period.id].run_number}: {reconciliations[period.id].status} · {reconciliations[period.id].approved_hours} hours · {Number(reconciliations[period.id].ledger_actual_cost).toLocaleString()} {project.currency || 'AED'}</p>{reconciliations[period.id].exceptions.map((item, index) => <p key={`${item.type}-${index}`} className="mt-1">{item.source}: {item.message}</p>)}</div>}</div>)}
        {snapshots.length > 0 && <div className="border-t border-indigo-200 bg-indigo-50 px-5 py-4"><p className="text-xs font-semibold uppercase tracking-wide text-indigo-800">Latest immutable snapshot · v{snapshots[0].version} · {snapshots[0].data_date}</p><div className="mt-2 grid gap-2 text-sm sm:grid-cols-4"><span>BAC <strong>{Number(snapshots[0].budget_at_completion).toLocaleString()}</strong></span><span>AC <strong>{Number(snapshots[0].actual_cost).toLocaleString()}</strong></span><span>CPI <strong>{snapshots[0].cpi ?? 'N/A'}</strong></span><span>SPI <strong>{snapshots[0].spi ?? 'N/A'}</strong></span></div><p className="mt-2 break-all text-xs text-indigo-700">Integrity checksum: {snapshots[0].checksum}</p></div>}
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white" aria-labelledby="periods-title">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4"><div><h2 id="periods-title" className="flex items-center gap-2 text-base font-semibold text-slate-900"><ClockIcon className="h-5 w-5 text-indigo-700" />Reporting Periods</h2><p className="mt-1 text-xs text-slate-500">Submit runs the reconciliation gate and freezes entry; independent lock seals an immutable KPI snapshot.</p></div><button type="button" className={primaryButton} onClick={() => setShowPeriodForm((value) => !value)} disabled={hasEntryWindow}><PlusIcon className="mr-1.5 h-4 w-4" />Open reporting period</button></div>
        {hasEntryWindow && <p className="border-b border-amber-200 bg-amber-50 px-5 py-3 text-xs text-amber-900">Close the current entry window by submitting it before opening another period.</p>}
        {showPeriodForm && !hasEntryWindow && <form onSubmit={createPeriod} className="grid gap-4 border-b border-slate-200 bg-slate-50 p-5 md:grid-cols-5"><Field label="Sequence"><input required min="1" type="number" className={fieldClass} value={periodForm.sequence} onChange={(event) => setPeriodForm({ ...periodForm, sequence: event.target.value })} /></Field><Field label="Period name"><input required className={fieldClass} value={periodForm.name} onChange={(event) => setPeriodForm({ ...periodForm, name: event.target.value })} placeholder="September 2026" /></Field><Field label="Start date"><input required type="date" className={fieldClass} value={periodForm.start_date} onChange={(event) => setPeriodForm({ ...periodForm, start_date: event.target.value })} /></Field><Field label="End date"><input required type="date" className={fieldClass} value={periodForm.end_date} onChange={(event) => setPeriodForm({ ...periodForm, end_date: event.target.value })} /></Field><Field label="Data date"><input required type="date" className={fieldClass} value={periodForm.data_date} onChange={(event) => setPeriodForm({ ...periodForm, data_date: event.target.value })} /></Field><div className="flex justify-end gap-2 md:col-span-5"><button type="button" className={secondaryButton} onClick={() => setShowPeriodForm(false)}>Cancel</button><button className={primaryButton} disabled={busy === 'new-period'}>{busy === 'new-period' ? 'Opening…' : 'Open period'}</button></div></form>}
        <div className="divide-y divide-slate-100">{periods.map((period) => <article key={period.id} className="px-5 py-4"><div className="flex flex-wrap items-center gap-4"><div className="min-w-56 flex-1"><div className="flex items-center gap-2"><p className="font-semibold text-slate-900">P{period.sequence} · {period.name}</p><StatusBadge value={period.status} label={period.status_display} /></div><p className="mt-1 text-xs text-slate-500">{period.start_date}–{period.end_date} · Data date {period.data_date}</p>{period.reopen_reason && <p className="mt-1 text-xs text-amber-800">Reopened: {period.reopen_reason}</p>}</div><div className="flex flex-wrap gap-2">{period.is_entry_allowed && <button className={primaryButton} disabled={busy === `period-${period.id}`} onClick={() => runAction(`period-${period.id}`, () => PC.submitReportingPeriod(period.id), 'Reporting period submitted; data entry is now frozen.')}>Submit period</button>}{period.status === 'submitted' && <button className={primaryButton} disabled={busy === `period-${period.id}`} onClick={() => runAction(`period-${period.id}`, () => PC.lockReportingPeriod(period.id), 'Reporting period locked.')}><LockClosedIcon className="mr-1.5 h-4 w-4" />Lock period</button>}{period.status === 'locked' && <button className={secondaryButton} onClick={() => setReopenId(reopenId === period.id ? null : period.id)}>Reopen</button>}<button className={secondaryButton} onClick={() => showHistory(period.id)} disabled={busy === `history-${period.id}`}><ChevronDownIcon className="mr-1 h-4 w-4" />Audit history</button></div></div>{reopenId === period.id && <form className="mt-3 flex flex-col gap-2 rounded-lg bg-amber-50 p-3 sm:flex-row sm:items-end" onSubmit={(event) => reopenPeriod(event, period.id)}><Field label="Mandatory reopen reason"><input required minLength="10" className={fieldClass} value={reopenReason} onChange={(event) => setReopenReason(event.target.value)} placeholder="Explain the approved correction" /></Field><button className={primaryButton} disabled={busy === `period-${period.id}`}>Confirm reopen</button></form>}{history[period.id] && <ol className="mt-3 border-l-2 border-slate-200 pl-4 text-xs text-slate-600">{history[period.id].map((event) => <li key={event.id} className="mb-2"><span className="font-semibold text-slate-800">{event.action}</span> · {event.from_status || 'none'} → {event.to_status} · {event.actor_name || 'System'} · {new Date(event.created_at).toLocaleString()}{event.reason ? ` · ${event.reason}` : ''}</li>)}</ol>}</article>)}{!periods.length && <p className="px-5 py-10 text-center text-sm text-slate-500">No reporting periods. Open the first controlled data-entry window.</p>}</div>
      </section>
    </div>
  )
}

function Field({ label, children }) {
  return <label className="block flex-1 text-xs font-semibold text-slate-700">{label}{children}</label>
}

function Summary({ label, value, detail, tone = 'blue' }) {
  const tones = {
    blue: 'border-blue-200 bg-gradient-to-br from-white to-blue-50/70 text-blue-800',
    indigo: 'border-indigo-200 bg-gradient-to-br from-white to-indigo-50/70 text-indigo-800',
    green: 'border-emerald-200 bg-gradient-to-br from-white to-emerald-50/70 text-emerald-800',
    amber: 'border-amber-200 bg-gradient-to-br from-white to-amber-50/80 text-amber-800',
    violet: 'border-violet-200 bg-gradient-to-br from-white to-violet-50/70 text-violet-800',
  }
  return <div className={`rounded-xl border p-4 ${tones[tone] || tones.blue}`}><p className="text-xs font-semibold uppercase tracking-wide opacity-75">{label}</p><p className="mt-2 truncate text-lg font-semibold" title={String(value)}>{value}</p><p className="mt-1 text-xs opacity-75">{detail}</p></div>
}
