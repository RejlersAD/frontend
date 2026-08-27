/* eslint-disable react/prop-types */
import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, Clock, Loader2, RefreshCw, ShieldCheck, XCircle } from 'lucide-react'
import planningIntelligenceService from '../../services/planningIntelligence.service'

const errorText = error => {
  const data = error?.response?.data
  if (typeof data?.detail === 'string') return data.detail
  if (data && typeof data === 'object') return Object.values(data).flat().map(String).join(' ')
  return error?.message || 'The approval action failed.'
}

export default function SchedulingDefaultsApprovalPanel({ projectId, onNotice, onChanged }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const load = useCallback(async () => {
    setLoading(true)
    try { setRows(await planningIntelligenceService.listScheduleDefaultProposals(projectId)) }
    catch (error) { onNotice('error', errorText(error)) }
    finally { setLoading(false) }
  }, [projectId, onNotice])
  useEffect(() => { load() }, [load])

  const decide = async (proposal, decision) => {
    const comment = window.prompt(decision === 'approved' ? 'Final approval comment (optional)' : 'Rejection reason (required)', '')
    if (comment === null || (decision === 'rejected' && !comment.trim())) return
    setBusy(`${proposal.id}-${decision}`)
    try {
      await planningIntelligenceService.decideScheduleDefaultProposal(proposal.id, decision, comment)
      onNotice('success', decision === 'approved' ? 'Scheduling defaults approved and made effective.' : 'Scheduling defaults rejected.')
      await load()
      await onChanged?.()
    } catch (error) { onNotice('error', errorText(error)) }
    finally { setBusy('') }
  }

  if (loading) return <div className="flex h-64 items-center justify-center text-slate-500"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading default approvals…</div>
  return <section className="overflow-hidden rounded-xl border bg-white">
    <div className="flex items-center border-b px-4 py-3"><div><h3 className="font-semibold text-slate-800">Scheduling Default Approvals</h3><p className="text-xs text-slate-400">Proposed workflow and Process-network defaults remain non-effective until final approval.</p></div><button onClick={load} className="ml-auto rounded-lg border p-2 text-slate-500"><RefreshCw className="h-4 w-4" /></button></div>
    {!rows.length && <div className="py-16 text-center text-sm text-slate-400"><ShieldCheck className="mx-auto mb-2 h-9 w-9 text-slate-300" />No default changes have been proposed.</div>}
    <div className="divide-y">{rows.map(row => <article key={row.id} className="p-4">
      <div className="flex flex-wrap items-start gap-3"><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h4 className="font-bold text-slate-800">{row.title}</h4><span className={`rounded px-2 py-1 text-[10px] font-bold uppercase ${row.status === 'approved' ? 'bg-emerald-50 text-emerald-700' : row.status === 'rejected' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'}`}>{row.status}</span></div><p className="mt-1 text-sm text-slate-500">{row.rationale || 'No rationale supplied.'}</p><p className="mt-2 text-xs text-slate-400">Proposed by {row.proposed_by_name} · Based on configuration v{row.base_configuration_version} · {new Date(row.created_at).toLocaleString()}</p></div>{row.status === 'proposed' && row.can_approve && <div className="flex gap-2"><button disabled={Boolean(busy) || !row.tests_passed} onClick={() => decide(row, 'approved')} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-40">Approve & apply</button><button disabled={Boolean(busy)} onClick={() => decide(row, 'rejected')} className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-40">Reject</button></div>}</div>
      <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-5">{row.test_results.map(test => <div key={test.code} className={`rounded-lg p-2 text-xs ${test.status === 'passed' ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}><div className="flex items-center gap-1 font-bold">{test.status === 'passed' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}{test.code.replaceAll('_', ' ')}</div><p className="mt-1 opacity-80">{test.message}</p></div>)}</div>
      <div className="mt-3 grid gap-2 rounded-xl bg-slate-50 p-3 text-xs sm:grid-cols-3"><div><span className="text-slate-400">Workflow</span><p className="font-bold text-slate-700">{row.proposed_values.workflow_name} v{row.proposed_values.workflow_version}</p></div><div><span className="text-slate-400">Tasks per deliverable</span><p className="font-bold text-slate-700">{row.proposed_values.standard_task_count}</p></div><div><span className="text-slate-400">Process network</span><p className="font-bold text-slate-700">{row.proposed_values.dependency_name || 'None'}</p></div></div>
      {row.decided_at && <p className="mt-3 flex items-center gap-1 text-xs text-slate-500">{row.status === 'approved' ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Clock className="h-4 w-4" />}Final decision by {row.decided_by_name}: {row.decision_comment || 'No comment.'}</p>}
    </article>)}</div>
  </section>
}
