import PropTypes from 'prop-types'
import { AlertTriangle, CheckCircle2, GitBranch, ShieldCheck } from 'lucide-react'

export default function PlannerLogicAssurance({ configuration, assumptions, validation }) {
  const unresolved = assumptions.filter(item => item.requires_confirmation)
  const critical = validation.filter(item => item.severity === 'critical')
  const warnings = validation.filter(item => item.severity === 'warning')
  return (
    <div className="border-b border-slate-200 bg-gradient-to-r from-slate-50 to-indigo-50/50 p-4">
      <div className="grid gap-3 md:grid-cols-4">
        <Card icon={GitBranch} label="Configured Process gates" value={assumptions.length} detail={configuration?.dependency_template || 'No template'} tone="indigo"/>
        <Card icon={CheckCircle2} label="Confirmed gates" value={Math.max(0, assumptions.length - unresolved.length)} detail={`${unresolved.length} awaiting review`} tone={unresolved.length ? 'amber' : 'green'}/>
        <Card icon={ShieldCheck} label="Validation warnings" value={warnings.length} detail={`${critical.length} critical findings`} tone={critical.length ? 'red' : warnings.length ? 'amber' : 'green'}/>
        <Card icon={CheckCircle2} label="Date authority" value="CPM" detail="JSON dates are not authoritative" tone="blue"/>
      </div>
      {(unresolved.length > 0 || critical.length > 0) && <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900"><AlertTriangle className="mr-2 inline h-4 w-4"/>{unresolved.length} engineering gates and {critical.length} critical validation findings require resolution before approval.</div>}
      {assumptions.length > 0 && <details className="mt-3 rounded-xl border border-slate-200 bg-white"><summary className="cursor-pointer px-4 py-3 text-sm font-bold text-slate-800">Process dependency assumptions ({assumptions.length})</summary><div className="max-h-64 divide-y divide-slate-100 overflow-auto border-t border-slate-100">{assumptions.map((item, index) => <div key={`${item.rule_id}-${index}`} className="grid gap-2 px-4 py-2.5 text-xs sm:grid-cols-[1fr_auto_1fr_auto]"><span className="font-mono font-bold text-slate-700">{item.predecessor_id}</span><span className="font-bold text-blue-700">{item.type}{Number(item.lag_days) ? ` ${item.lag_days}d` : ''} →</span><span className="font-mono font-bold text-slate-700">{item.activity_id}</span><span className={`rounded-full px-2 py-0.5 font-bold ${item.requires_confirmation ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-700'}`}>{item.requires_confirmation ? 'Needs review' : 'Confirmed'}</span></div>)}</div></details>}
    </div>
  )
}

function Card({ icon: Icon, label, value, detail, tone }) {
  const colors = { indigo: 'bg-indigo-100 text-indigo-700', blue: 'bg-blue-100 text-blue-700', green: 'bg-emerald-100 text-emerald-700', amber: 'bg-amber-100 text-amber-800', red: 'bg-rose-100 text-rose-700' }
  return <div className="rounded-xl border border-white bg-white/90 p-3 shadow-sm"><div className="flex items-center gap-2"><span className={`rounded-lg p-2 ${colors[tone] || colors.indigo}`}><Icon className="h-4 w-4"/></span><div><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p><p className="text-lg font-black text-slate-900">{value}</p></div></div><p className="mt-2 text-xs text-slate-500">{detail}</p></div>
}

PlannerLogicAssurance.propTypes = {
  configuration: PropTypes.object,
  assumptions: PropTypes.arrayOf(PropTypes.object).isRequired,
  validation: PropTypes.arrayOf(PropTypes.object).isRequired,
}

Card.propTypes = {
  icon: PropTypes.elementType.isRequired,
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  detail: PropTypes.string.isRequired,
  tone: PropTypes.string.isRequired,
}
