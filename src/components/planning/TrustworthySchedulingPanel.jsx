import PropTypes from 'prop-types'

const tone = severity => ({
  critical: 'border-rose-200 bg-rose-50 text-rose-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  pass: 'border-emerald-200 bg-emerald-50 text-emerald-800',
}[severity] || 'border-slate-200 bg-slate-50 text-slate-700')

const Metric = ({ label, value, detail }) => <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 text-xl font-black text-slate-900">{value}</p>{detail && <p className="mt-1 text-xs text-slate-500">{detail}</p>}</div>

const Findings = ({ rows = [] }) => <div className="space-y-2">{rows.map((row, index) => <div key={`${row.code}-${index}`} className={`rounded-lg border px-3 py-2 text-sm ${tone(row.severity)}`}><b className="capitalize">{row.code.replaceAll('_', ' ')}</b><span className="ml-2">{row.message}</span></div>)}</div>

export default function TrustworthySchedulingPanel({ assurance, versionStatus, busy, canControl, onRun, onApprove }) {
  if (!assurance) return (
    <div className="p-6">
      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-6">
        <h3 className="text-xl font-bold text-slate-950">Phase 3 — Trustworthy scheduling</h3>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">Run assurance after CPM calculation to validate network quality, contract fit, resource concurrency, and changes against the parent version or baseline. The analysis never shortens activities or changes logic automatically.</p>
        <button type="button" onClick={onRun} disabled={busy || !canControl || versionStatus !== 'calculated'} className="mt-5 rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-40">{busy ? 'Running assurance…' : 'Run Phase 3 assurance'}</button>
        {versionStatus !== 'calculated' && <p className="mt-2 text-xs text-amber-700">Calculate the current draft before running assurance.</p>}
      </div>
    </div>
  )

  const network = assurance.network_validation || {}
  const contract = assurance.contract_scenarios || {}
  const resources = assurance.resource_validation || {}
  const comparison = assurance.change_comparison || {}
  const summary = comparison.summary || {}
  const approved = assurance.status === 'approved'

  return <div className="space-y-5 p-4 sm:p-6">
    <div className="flex flex-wrap items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-5">
      <div className="mr-auto"><p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">Phase 3 assurance</p><h3 className="mt-1 text-xl font-bold text-slate-950">Exact calculated state review</h3><p className="mt-1 text-sm text-slate-500">Run #{assurance.calculation_run} · calculated {new Date(assurance.calculated_state_at).toLocaleString()}</p></div>
      <span className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${approved ? 'bg-emerald-100 text-emerald-800' : assurance.blockers.length ? 'bg-rose-100 text-rose-800' : 'bg-blue-100 text-blue-800'}`}>{assurance.status}</span>
      <button type="button" onClick={onRun} disabled={busy || !canControl || versionStatus !== 'calculated'} className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-bold text-blue-700 disabled:opacity-40">Run again</button>
      {!approved && <button type="button" onClick={onApprove} disabled={busy || !canControl || assurance.blockers.length > 0} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-40">Approve assurance</button>}
    </div>

    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <Metric label="Activities" value={network.activity_count || 0}/><Metric label="Relationships" value={network.relationship_count || 0}/><Metric label="Critical blockers" value={assurance.blockers.length}/><Metric label="Warnings" value={assurance.warnings.length}/><Metric label="Contract variance" value={contract.available ? `${contract.variance_calendar_days}d` : 'N/A'} detail={contract.fits_contract ? 'Within contract' : 'Calendar days'}/>
    </div>

    <section><h4 className="mb-2 font-bold text-slate-900">Expanded network validation</h4><Findings rows={network.findings}/></section>

    <section className="rounded-2xl border border-slate-200 bg-white p-4"><h4 className="font-bold text-slate-900">Contract-fit scenario analysis</h4>{!contract.available ? <p className="mt-2 text-sm text-slate-500">{contract.reason}</p> : <div className="mt-3 grid gap-3 lg:grid-cols-2">{contract.scenarios.map(row => <div key={row.code} className="rounded-xl border border-slate-200 p-4"><p className="font-bold text-slate-800">{row.label}</p><p className="mt-1 text-sm text-slate-600">Finish: {row.forecast_finish}</p>{row.variance_calendar_days !== undefined && <p className="text-sm text-slate-600">Variance: {row.variance_calendar_days} calendar days</p>}{row.required_reduction_working_days !== undefined && <><p className="text-sm text-slate-600">Required reduction: {row.required_reduction_working_days} working days</p><p className="text-sm text-slate-600">Critical-path compression: {row.required_critical_path_compression_pct}%</p><p className="mt-2 text-xs text-amber-700">{row.note}</p></>}</div>)}</div>}</section>

    <section><h4 className="mb-2 font-bold text-slate-900">Resource and concurrency validation</h4><Findings rows={resources.findings}/>{(resources.overloads || []).length > 0 && <div className="mt-3 overflow-auto rounded-xl border border-slate-200"><table className="min-w-full text-left text-xs"><thead className="bg-slate-50 text-slate-500"><tr><th className="px-3 py-2">Resource</th><th className="px-3 py-2">Capacity/day</th><th className="px-3 py-2">Peak</th><th className="px-3 py-2">Peak date</th><th className="px-3 py-2">Overloaded days</th></tr></thead><tbody>{resources.overloads.map(row => <tr key={row.resource_id} className="border-t"><td className="px-3 py-2 font-semibold">{row.resource_code} · {row.resource_name}</td><td className="px-3 py-2">{row.capacity_per_day}</td><td className="px-3 py-2 text-rose-700">{row.peak_demand}</td><td className="px-3 py-2">{row.peak_date}</td><td className="px-3 py-2">{row.overloaded_day_count}</td></tr>)}</tbody></table></div>}</section>

    <section className="rounded-2xl border border-slate-200 bg-white p-4"><h4 className="font-bold text-slate-900">Proposed-change comparison</h4>{!comparison.available ? <p className="mt-2 text-sm text-slate-500">{comparison.message}</p> : <><p className="mt-1 text-xs text-slate-500">Compared with {comparison.reference_type.replaceAll('_', ' ')} v{comparison.reference_version}</p><div className="mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-6"><Metric label="Added activities" value={summary.added_activity_count || 0}/><Metric label="Removed activities" value={summary.removed_activity_count || 0}/><Metric label="Duration changes" value={summary.duration_change_count || 0}/><Metric label="Added logic" value={summary.added_relationship_count || 0}/><Metric label="Removed logic" value={summary.removed_relationship_count || 0}/><Metric label="Finish movement" value={`${comparison.finish_variance_calendar_days ?? 'N/A'}d`}/></div></>}</section>

    <div className={`rounded-xl border p-4 text-sm font-semibold ${approved ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : assurance.blockers.length ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-blue-200 bg-blue-50 text-blue-800'}`}>{approved ? 'Assurance approved. The schedule may proceed to schedule approval and then baseline approval.' : assurance.blockers.length ? `${assurance.blockers.length} critical blocker(s) must be resolved and CPM recalculated before approval.` : 'No critical blockers. A project authority may approve this assurance result.'}</div>
  </div>
}

Metric.propTypes = { label: PropTypes.string.isRequired, value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired, detail: PropTypes.string }
Findings.propTypes = { rows: PropTypes.arrayOf(PropTypes.object) }
TrustworthySchedulingPanel.propTypes = { assurance: PropTypes.object, versionStatus: PropTypes.string, busy: PropTypes.bool, canControl: PropTypes.bool, onRun: PropTypes.func.isRequired, onApprove: PropTypes.func.isRequired }
