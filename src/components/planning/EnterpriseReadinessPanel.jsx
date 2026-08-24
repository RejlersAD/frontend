/* eslint-disable react/prop-types */
import { useCallback, useEffect, useState } from 'react'
import {
  Activity, AlertTriangle, Archive, CheckCircle2, Database, Loader2,
  Lock, RefreshCw, Save, ShieldCheck,
} from 'lucide-react'

import planningIntelligenceService from '../../services/planningIntelligence.service'

const number = value => Number(value || 0)
const ratioTone = value => value === null || value === undefined ? 'text-slate-400' : number(value) >= 1 ? 'text-emerald-600' : 'text-rose-600'
const errorText = (error, fallback) => error?.response?.data?.error || error?.message || fallback

const EnterpriseReadinessPanel = ({ projectId, projectName, canManage, onNotice }) => {
  const [portfolio, setPortfolio] = useState(null)
  const [readiness, setReadiness] = useState(null)
  const [retention, setRetention] = useState(null)
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true)
    try {
      const [portfolioData, readinessData, retentionData] = await Promise.all([
        planningIntelligenceService.getEnterprisePortfolio(),
        planningIntelligenceService.getEnterpriseReadiness(projectId),
        planningIntelligenceService.getRetentionPolicy(projectId),
      ])
      setPortfolio(portfolioData)
      setReadiness(readinessData)
      setRetention(retentionData)
    } catch (error) {
      onNotice('error', errorText(error, 'Unable to load enterprise readiness.'))
    } finally {
      setLoading(false)
    }
  }, [projectId, onNotice])

  useEffect(() => { load() }, [load])

  const saveRetention = async () => {
    setBusy('retention')
    try {
      const result = await planningIntelligenceService.updateRetentionPolicy(projectId, {
        export_history_days: retention.export_history_days,
        delivery_history_days: retention.delivery_history_days,
        completed_job_days: retention.completed_job_days,
        legal_hold: retention.legal_hold,
      })
      setRetention(result)
      onNotice('success', 'Enterprise retention policy updated.')
    } catch (error) {
      onNotice('error', errorText(error, 'Retention policy could not be saved.'))
    } finally {
      setBusy('')
    }
  }

  const previewCleanup = async () => {
    setBusy('preview')
    try {
      setPreview(await planningIntelligenceService.previewRetentionCleanup(projectId))
    } catch (error) {
      onNotice('error', errorText(error, 'Retention preview failed.'))
    } finally {
      setBusy('')
    }
  }

  const executeCleanup = async () => {
    const confirmation = window.prompt(`Type the project name to archive eligible operational history:\n${projectName}`)
    if (confirmation !== projectName) {
      if (confirmation !== null) onNotice('error', 'Project-name confirmation did not match.')
      return
    }
    setBusy('cleanup')
    try {
      const result = await planningIntelligenceService.executeRetentionCleanup(projectId, confirmation)
      setPreview(result)
      await load(true)
      onNotice('success', 'Eligible operational records were soft-archived under the retention policy.')
    } catch (error) {
      onNotice('error', errorText(error, 'Retention cleanup failed.'))
    } finally {
      setBusy('')
    }
  }

  if (loading) return <div className="h-72 flex items-center justify-center text-slate-500"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading enterprise readiness...</div>
  if (!portfolio || !readiness || !retention) return null
  return (
    <div className="p-4 space-y-5 bg-slate-50/60">
      <div className="flex items-center gap-2"><div className="mr-auto"><h2 className="font-bold text-slate-800">Enterprise Readiness</h2><p className="text-xs text-slate-500">Portfolio oversight, operational assurance, secure configuration, and data lifecycle.</p></div><button onClick={() => load()} className="p-2 border rounded-lg text-slate-500"><RefreshCw className="w-4 h-4" /></button></div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[
        ['Accessible Projects', portfolio.summary.project_count, Database, 'text-indigo-600'],
        ['At Risk', portfolio.summary.at_risk_count, AlertTriangle, portfolio.summary.at_risk_count ? 'text-rose-600' : 'text-emerald-600'],
        ['Pending Governance', portfolio.summary.pending_governance, ShieldCheck, 'text-amber-600'],
        ['Failed Operations', portfolio.summary.failed_operations, Activity, portfolio.summary.failed_operations ? 'text-rose-600' : 'text-emerald-600'],
      ].map(([title, value, Icon, tone]) => <div key={title} className="bg-white border rounded-xl p-3 shadow-sm"><div className="flex justify-between text-xs uppercase tracking-wide text-slate-400 font-semibold">{title}<Icon className={`w-4 h-4 ${tone}`} /></div><div className={`text-xl font-bold mt-1 ${tone}`}>{value}</div></div>)}</div>

      <section className="bg-white border rounded-xl overflow-hidden"><div className="px-4 py-3 border-b"><h3 className="font-semibold text-slate-800">Portfolio Control Tower</h3><p className="text-xs text-slate-400">Latest approved performance and operating signals across accessible planning workspaces.</p></div><div className="overflow-auto"><table className="w-full min-w-[1050px] text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr>{['Project', 'Phase', 'Version', 'Status', 'Finish', 'Progress', 'SPI', 'CPI', 'Governance', 'Failures'].map(title => <th key={title} className="text-left px-3 py-2">{title}</th>)}</tr></thead><tbody>{portfolio.projects.map(row => <tr key={row.id} className={`border-t ${String(row.id) === String(projectId) ? 'bg-violet-50/50' : ''}`}><td className="px-3 py-3"><b className="text-slate-800">{row.name}</b><div className="text-xs text-slate-400">{row.enterprise_code || row.client}</div></td><td className="px-3">{row.phase || '—'}</td><td className="px-3">{row.version ? `v${row.version}` : '—'}</td><td className="px-3 capitalize">{row.version_status || 'Not scheduled'}</td><td className="px-3">{row.calculated_finish || '—'}</td><td className="px-3">{row.progress_pct === null ? '—' : `${number(row.progress_pct).toFixed(1)}%`}</td><td className={`px-3 font-semibold ${ratioTone(row.spi)}`}>{row.spi === null ? '—' : number(row.spi).toFixed(2)}</td><td className={`px-3 font-semibold ${ratioTone(row.cpi)}`}>{row.cpi === null ? '—' : number(row.cpi).toFixed(2)}</td><td className="px-3">{row.open_governance_items}</td><td className={`px-3 ${row.failed_jobs + row.failed_deliveries ? 'text-rose-600 font-semibold' : ''}`}>{row.failed_jobs + row.failed_deliveries}</td></tr>)}</tbody></table></div></section>

      <div className="grid xl:grid-cols-[1fr_1.35fr] gap-4">
        <section className="bg-white border rounded-xl overflow-hidden"><div className="px-4 py-3 border-b flex items-center"><h3 className="font-semibold text-slate-800">Operational Readiness</h3><span className={`ml-auto text-xs rounded-full px-2 py-1 ${readiness.status === 'healthy' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{readiness.status}</span></div><div className="p-4 space-y-2">{[
          ['Integration credential encryption', readiness.integration_encryption_configured, readiness.integration_encryption_configured ? 'Configured' : 'Missing server key'],
          ['Background jobs', readiness.operations.failed_jobs_24h === 0, `${readiness.operations.failed_jobs_24h} failed · ${readiness.operations.running_jobs} running`],
          ['Outbound deliveries', readiness.integrations.failed_deliveries_24h === 0, `${readiness.integrations.failed_deliveries_24h} failed · ${readiness.integrations.queued_deliveries} queued`],
          ['Audit activity', true, `${readiness.operations.audit_events_30d} events in 30 days`],
          ['Export operations', true, `${readiness.operations.exports_30d} exports in 30 days`],
        ].map(([title, healthy, detail]) => <div key={title} className="flex items-center gap-3 rounded-lg bg-slate-50 p-3">{healthy ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <AlertTriangle className="w-5 h-5 text-amber-500" />}<div><div className="text-sm font-semibold text-slate-700">{title}</div><div className="text-xs text-slate-400">{detail}</div></div></div>)}</div></section>

        <section className="bg-white border rounded-xl overflow-hidden"><div className="px-4 py-3 border-b flex items-center"><div><h3 className="font-semibold text-slate-800">Data Retention & Legal Hold</h3><p className="text-xs text-slate-400">Domain schedules, baselines, governance, and audit records are never removed by this policy.</p></div>{retention.legal_hold && <Lock className="ml-auto w-5 h-5 text-rose-600" />}</div><div className="p-4"><div className="grid sm:grid-cols-3 gap-3">{[
          ['export_history_days', 'Export history'], ['delivery_history_days', 'Delivery history'], ['completed_job_days', 'Completed jobs'],
        ].map(([field, title]) => <label key={field} className="text-xs text-slate-500">{title}<div className="flex items-center mt-1"><input disabled={!canManage} type="number" min="30" max="3650" value={retention[field]} onChange={event => setRetention(value => ({ ...value, [field]: event.target.value }))} className="w-full border rounded-l-lg px-3 py-2 text-sm text-slate-700" /><span className="border border-l-0 rounded-r-lg px-2 py-2 bg-slate-50">days</span></div></label>)}</div><label className="flex items-center gap-2 mt-4 text-sm text-slate-700"><input disabled={!canManage} type="checkbox" checked={retention.legal_hold} onChange={event => setRetention(value => ({ ...value, legal_hold: event.target.checked }))} /> Legal hold — block all retention cleanup</label><div className="flex flex-wrap gap-2 mt-4"><button disabled={!canManage || Boolean(busy)} onClick={saveRetention} className="inline-flex items-center gap-1.5 px-3 py-2 bg-violet-600 text-white rounded-lg text-sm font-semibold disabled:opacity-40"><Save className="w-4 h-4" /> Save Policy</button><button disabled={!canManage || Boolean(busy) || retention.legal_hold} onClick={previewCleanup} className="inline-flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm font-semibold text-slate-600 disabled:opacity-40"><Archive className="w-4 h-4" /> Preview Cleanup</button></div>{preview && <div className="mt-4 rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm"><b className="text-amber-800">Eligible operational history:</b><div className="flex gap-4 mt-1 text-amber-700"><span>{preview.eligible.exports} exports</span><span>{preview.eligible.deliveries} deliveries</span><span>{preview.eligible.jobs} jobs</span></div>{!preview.execute && canManage && !retention.legal_hold && Object.values(preview.eligible).some(number) && <button onClick={executeCleanup} disabled={Boolean(busy)} className="mt-3 px-3 py-2 bg-rose-600 text-white rounded-lg text-xs font-semibold">Archive Eligible Records</button>}</div>}</div></section>
      </div>
    </div>
  )
}

export default EnterpriseReadinessPanel
