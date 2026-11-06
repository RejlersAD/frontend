import { useEffect, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { GitBranch, Loader2 } from 'lucide-react'
import planningIntelligenceService from '../../services/planningIntelligence.service'

export default function PipingGuidancePanel({ versionId, canApply, busy, dirty, onApply }) {
  const [plan, setPlan] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const request = useRef(0)
  useEffect(() => () => { request.current += 1 }, [])
  const preview = async () => {
    const sequence = ++request.current
    setLoading(true)
    setError('')
    setPlan(null)
    try {
      const result = await planningIntelligenceService.previewPipingGuidance(versionId)
      if (sequence === request.current) setPlan(result)
    } catch (caught) {
      if (sequence === request.current) setError(caught.response?.data?.error || caught.response?.data?.detail || caught.message || 'The piping guidance preview could not be loaded.')
    } finally {
      if (sequence === request.current) setLoading(false)
    }
  }
  return <section className="m-4 rounded-lg border border-slate-200 bg-white p-4" aria-label="Piping planning guidance">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h3 className="font-semibold text-slate-900">Planning department · Piping guidance</h3><p className="mt-1 text-sm text-slate-600">Match document revisions, retain FF+3 and FF+4, preserve vendor and closeout durations, and check piping completion within 90% of the contractual working-day timeline.</p></div>
      <button type="button" className="pw-button" disabled={loading || busy || dirty} onClick={preview}>{loading ? <Loader2 size={16} className="animate-spin" /> : <GitBranch size={16} />}Review piping guidance</button>
    </div>
    {dirty && <p className="mt-2 text-sm text-amber-800">Save activity changes before reviewing and applying guidance.</p>}
    {error && <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>}
    {plan && <div className="mt-4 space-y-3 text-sm">
      <p>{plan.matched_rule_count} matched links · {plan.add_links.length} links to add or update · {plan.remove_links.length} conflicting links to remove · {plan.duration_changes.length} duration/type changes.</p>
      {plan.deadline?.finish_by && <p><strong>Piping finish by {plan.deadline.finish_by}</strong> · {plan.deadline.piping_working_days} of {plan.deadline.project_working_days} working days · {plan.deadline.contingency_working_days} working days retained before contractual finish {plan.deadline.contractual_finish}.</p>}
      {plan.missing_scope.length > 0 && <details><summary className="cursor-pointer font-semibold text-amber-800">Guidance endpoints absent from this schedule ({plan.missing_scope.length})</summary><p className="mt-2">{plan.missing_scope.join(', ')}. Missing deliverables or revisions are not created automatically.</p></details>}
      {plan.issues.length > 0 && <ul role="alert" className="list-disc space-y-1 pl-5 text-rose-700">{plan.issues.map((item, index) => <li key={`${item.code}-${index}`}>{item.message}</li>)}</ul>}
      <details><summary className="cursor-pointer font-semibold">Review relationship changes</summary><div className="mt-2 max-h-72 overflow-auto"><table className="w-full text-left text-xs"><thead><tr><th>Change</th><th>Predecessor</th><th>Successor</th><th>Link</th></tr></thead><tbody>{[['Remove', plan.remove_links], ['Add / update', plan.add_links]].flatMap(([label, links]) => links.map((link, index) => <tr key={`${label}-${index}`}><td className="py-2 pr-3">{label}</td><td className="pr-3">{link.predecessor}</td><td className="pr-3">{link.successor}</td><td className="whitespace-nowrap">{link.type}+{link.lag_days} working days</td></tr>))}</tbody></table></div></details>
      {plan.duration_changes.length > 0 && <details><summary className="cursor-pointer font-semibold">Review duration and milestone corrections</summary><ul className="mt-2 list-disc space-y-1 pl-5">{plan.duration_changes.map(row => <li key={row.activity_id}>{row.name}: {row.previous_duration_days} → {row.duration_days} working days, recorded as a duration activity.</li>)}</ul></details>}
      {!canApply && !busy && <p className="text-slate-600">Create or open an editable revision with schedule edit access to apply this guidance.</p>}
      <div className="flex gap-2"><button type="button" className="pw-button" disabled={!canApply || busy || dirty || !plan.can_apply} onClick={async () => { await onApply(plan.preview_token); setPlan(null) }}>Apply reviewed piping guidance</button><button type="button" className="pw-button" disabled={busy} onClick={() => setPlan(null)}>Close preview</button></div>
    </div>}
  </section>
}

PipingGuidancePanel.propTypes = {
  versionId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  canApply: PropTypes.bool.isRequired, busy: PropTypes.bool.isRequired, dirty: PropTypes.bool.isRequired,
  onApply: PropTypes.func.isRequired,
}
