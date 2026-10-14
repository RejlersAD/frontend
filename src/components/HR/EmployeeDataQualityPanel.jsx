import { useCallback, useEffect, useState } from 'react'
import {
  ArrowPathIcon,
  CheckCircleIcon,
  CircleStackIcon,
  ExclamationTriangleIcon,
  LinkIcon,
  WrenchScrewdriverIcon,
} from '@heroicons/react/24/outline'
import hrFoundationService from '../../services/hrFoundation.service'

const EmployeeDataQualityPanel = ({ employee }) => {
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [repairing, setRepairing] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const identifier = employee?.employee_master_id || employee?.user?.id || employee?.id
    if (!identifier) return
    setLoading(true)
    setError('')
    try {
      const canonical = employee?.employee_master_id
        ? { id: employee.employee_master_id }
        : await hrFoundationService.resolveEmployee(identifier)
      setReport(await hrFoundationService.getIdentityHealth(canonical.id))
    } catch (requestError) {
      setError(requestError?.response?.data?.detail || 'Employee identity health could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [employee?.employee_master_id, employee?.id, employee?.user?.id])

  useEffect(() => { load() }, [load])

  const repair = async () => {
    if (!report?.employee_id) return
    setRepairing(true)
    setError('')
    try {
      await hrFoundationService.repairIdentity(report.employee_id)
      await load()
    } catch (requestError) {
      setError(requestError?.response?.data?.detail || 'Identity repair could not be completed.')
    } finally {
      setRepairing(false)
    }
  }

  if (loading) return <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white p-10 text-sm text-slate-500"><ArrowPathIcon className="h-4 w-4 animate-spin" /> Checking employee records…</div>

  if (error && !report) return <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4">
      <section className={`rounded-xl border p-5 ${report?.healthy ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            {report?.healthy ? <CheckCircleIcon className="h-7 w-7 text-emerald-700" /> : <ExclamationTriangleIcon className="h-7 w-7 text-amber-700" />}
            <div>
              <h3 className="font-bold text-slate-950">{report?.healthy ? 'Employee identity is consistent' : `${report?.issue_count || 0} data issue${report?.issue_count === 1 ? '' : 's'} found`}</h3>
              <p className="mt-1 text-sm text-slate-600">EmployeeMaster is the canonical record used to link HR, RBAC, payroll, onboarding and timesheets.</p>
            </div>
          </div>
          {!report?.healthy && <button type="button" onClick={repair} disabled={repairing} className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-3.5 py-2 text-xs font-bold text-white hover:bg-blue-800 disabled:opacity-60">{repairing ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : <WrenchScrewdriverIcon className="h-4 w-4" />} Repair from canonical record</button>}
        </div>
        {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
      </section>

      {(report?.issues || []).length > 0 && <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4"><h3 className="text-sm font-bold text-slate-950">Field differences</h3></div>
        <div className="divide-y divide-slate-100">{report.issues.map((issue, index) => <div key={`${issue.system}-${issue.field}-${index}`} className="grid gap-2 px-5 py-3 text-sm sm:grid-cols-[120px_150px_1fr_1fr]"><span className="font-bold uppercase text-slate-500">{issue.system}</span><span className="font-semibold text-slate-800">{issue.field.replaceAll('_', ' ')}</span><span><span className="text-[10px] font-bold uppercase text-slate-400">Canonical</span><br />{issue.canonical || '—'}</span><span><span className="text-[10px] font-bold uppercase text-slate-400">Current</span><br />{issue.actual || '—'}</span></div>)}</div>
      </section>}

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-3"><LinkIcon className="h-5 w-5 text-blue-700" /><h3 className="text-sm font-bold text-slate-950">Linked system identifiers</h3><span className="ml-auto rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">{report?.aliases?.length || 0}</span></div>
        {(report?.aliases || []).length ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{report.aliases.map((alias) => <article key={alias.id} className="rounded-lg border border-slate-200 p-3"><div className="flex items-center gap-2"><CircleStackIcon className="h-4 w-4 text-slate-400" /><span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{alias.source} · {alias.identifier_type.replaceAll('_', ' ')}</span></div><p className="mt-2 break-all text-sm font-semibold text-slate-900">{alias.value}</p></article>)}</div> : <p className="text-sm text-slate-500">No linked identifiers were found.</p>}
        {(report?.conflicts || []).length > 0 && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">Conflicting identifiers require manual HR review and were not changed automatically.</div>}
      </section>
    </div>
  )
}

export default EmployeeDataQualityPanel
