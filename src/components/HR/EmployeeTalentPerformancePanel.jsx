import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AcademicCapIcon, ChatBubbleLeftRightIcon, CheckCircleIcon,
  FlagIcon, PlusIcon, SparklesIcon, StarIcon, TrophyIcon,
} from '@heroicons/react/24/outline'
import hrFoundationService from '../../services/hrFoundation.service'
import EmployeeTabLoading from './EmployeeTabLoading'

const statusTone = (status) => ({ active: 'bg-emerald-100 text-emerald-700', completed: 'bg-blue-100 text-blue-700', submitted: 'bg-violet-100 text-violet-700', approved: 'bg-emerald-100 text-emerald-700', pending: 'bg-amber-100 text-amber-700' }[status] || 'bg-slate-100 text-slate-600')

const EmployeeTalentPerformancePanel = ({ employee }) => {
  const [employeeId, setEmployeeId] = useState('')
  const [data, setData] = useState({ cycles: [], goals: [], reviews: [], feedback: [], plans: [], talent: [], promotions: [] })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [goalForm, setGoalForm] = useState({ title: '', description: '', weight: 20, due_date: '' })
  const [feedbackForm, setFeedbackForm] = useState({ feedback_type: 'recognition', content: '' })

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const resolved = employee?.employee_master_id ? { id: employee.employee_master_id } : await hrFoundationService.resolveEmployee(employee?.user?.id || employee?.id)
      setEmployeeId(resolved.id)
      const requests = await Promise.allSettled([
        hrFoundationService.getPerformanceCycles(), hrFoundationService.getGoals({ employee: resolved.id }),
        hrFoundationService.getReviews({ employee: resolved.id }), hrFoundationService.getFeedback({ employee: resolved.id }),
        hrFoundationService.getDevelopmentPlans({ employee: resolved.id }), hrFoundationService.getTalentAssessments({ employee: resolved.id }),
        hrFoundationService.getPromotionCases({ employee: resolved.id }),
      ])
      const value = (index) => requests[index].status === 'fulfilled' ? requests[index].value : []
      setData({ cycles: value(0), goals: value(1), reviews: value(2), feedback: value(3), plans: value(4), talent: value(5), promotions: value(6) })
    } catch (requestError) {
      setError(requestError?.response?.data?.detail || 'Performance and talent records could not be loaded.')
    } finally { setLoading(false) }
  }, [employee?.employee_master_id, employee?.id, employee?.user?.id])

  useEffect(() => { load() }, [load])
  const activeCycle = useMemo(() => data.cycles.find((cycle) => cycle.status === 'active') || data.cycles[0], [data.cycles])

  const createGoal = async (event) => {
    event.preventDefault(); if (!activeCycle || !goalForm.title.trim()) return
    setSaving(true); setError('')
    try {
      const goal = await hrFoundationService.createGoal({ ...goalForm, employee: employeeId, cycle: activeCycle.id, goal_type: 'individual' })
      await hrFoundationService.submitGoal(goal.id)
      setGoalForm({ title: '', description: '', weight: 20, due_date: '' }); await load()
    } catch (requestError) { setError(requestError?.response?.data ? JSON.stringify(requestError.response.data) : 'Goal could not be created.') }
    finally { setSaving(false) }
  }

  const addCheckIn = async (goal) => {
    const raw = window.prompt('Enter progress percentage (0–100)', String(goal.progress || 0))
    if (raw === null) return
    const progress = Number(raw)
    if (!Number.isFinite(progress) || progress < 0 || progress > 100) { setError('Progress must be between 0 and 100.'); return }
    setSaving(true)
    try { await hrFoundationService.checkInGoal({ goal: goal.id, progress, note: 'Progress update' }); await load() }
    catch (requestError) { setError(requestError?.response?.data ? JSON.stringify(requestError.response.data) : 'Check-in failed.') }
    finally { setSaving(false) }
  }

  const createFeedback = async (event) => {
    event.preventDefault(); if (!feedbackForm.content.trim()) return
    setSaving(true)
    try { await hrFoundationService.createFeedback({ ...feedbackForm, employee: employeeId, visibility: 'employee' }); setFeedbackForm({ feedback_type: 'recognition', content: '' }); await load() }
    catch (requestError) { setError(requestError?.response?.data ? JSON.stringify(requestError.response.data) : 'Feedback could not be saved.') }
    finally { setSaving(false) }
  }

  if (loading) return <EmployeeTabLoading message="Loading performance and talent records…" />

  const submittedReviews = data.reviews.filter((review) => ['submitted', 'acknowledged'].includes(review.status))
  const average = submittedReviews.length ? (submittedReviews.reduce((sum, review) => sum + Number(review.overall_score || 0), 0) / submittedReviews.length).toFixed(2) : '—'
  const latestTalent = data.talent[0]

  return <div className="space-y-5">
    {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {[[FlagIcon, 'Active goals', data.goals.filter((g) => g.status === 'active').length, 'text-blue-600'], [StarIcon, 'Review score', average, 'text-violet-600'], [AcademicCapIcon, 'Development plans', data.plans.filter((p) => p.status === 'active').length, 'text-emerald-600'], [TrophyIcon, 'Nine-box', latestTalent?.nine_box || 'Not assessed', 'text-amber-600']].map(([Icon, label, value, tone]) => <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><Icon className={`h-5 w-5 ${tone}`} /><p className="mt-3 text-2xl font-bold text-slate-950">{value}</p><p className="text-xs text-slate-500">{label}</p></div>)}
    </div>

    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3"><div><h3 className="text-sm font-bold text-slate-950">Goals and KPIs</h3><p className="text-xs text-slate-500">{activeCycle ? activeCycle.name : 'HR must activate a performance cycle'}</p></div><FlagIcon className="h-5 w-5 text-blue-700" /></div>
      <div className="mt-4 space-y-3">{data.goals.length ? data.goals.map((goal) => <article key={goal.id} className="rounded-lg border border-slate-200 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-slate-900">{goal.title}</p><p className="mt-1 text-xs text-slate-500">{goal.weight}% weight · Due {goal.due_date || 'not set'}</p></div><span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${statusTone(goal.status)}`}>{goal.status}</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600" style={{ width: `${goal.progress || 0}%` }} /></div><div className="mt-2 flex items-center justify-between text-xs"><span className="font-bold text-blue-700">{goal.progress || 0}%</span>{['active', 'completed'].includes(goal.status) && <button type="button" onClick={() => addCheckIn(goal)} className="font-bold text-blue-700 hover:text-blue-900">Add check-in</button>}</div></article>) : <p className="py-5 text-center text-sm text-slate-400">No goals have been created for this cycle.</p>}</div>
      {activeCycle && <form onSubmit={createGoal} className="mt-5 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2"><input value={goalForm.title} onChange={(e) => setGoalForm({ ...goalForm, title: e.target.value })} placeholder="New goal title" required className="rounded-lg border border-slate-300 px-3 py-2 text-sm" /><input type="date" value={goalForm.due_date} onChange={(e) => setGoalForm({ ...goalForm, due_date: e.target.value })} min={activeCycle.start_date} max={activeCycle.end_date} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" /><textarea value={goalForm.description} onChange={(e) => setGoalForm({ ...goalForm, description: e.target.value })} placeholder="Success criteria and description" className="rounded-lg border border-slate-300 px-3 py-2 text-sm sm:col-span-2" /><div className="flex items-center gap-2"><label className="text-xs font-semibold text-slate-600">Weight %</label><input type="number" min="0" max="100" value={goalForm.weight} onChange={(e) => setGoalForm({ ...goalForm, weight: Number(e.target.value) })} className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm" /></div><button disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"><PlusIcon className="h-4 w-4" /> Create and submit goal</button></form>}
    </section>

    <div className="grid gap-5 lg:grid-cols-2">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-4 flex items-center gap-2"><StarIcon className="h-5 w-5 text-violet-700" /><h3 className="text-sm font-bold">Reviews and 360° feedback</h3></div>{data.reviews.length ? <div className="space-y-2">{data.reviews.map((review) => <div key={review.id} className="flex items-center justify-between rounded-lg bg-slate-50 p-3"><div><p className="text-sm font-semibold capitalize">{review.review_type.replaceAll('_', ' ')}</p><p className="text-xs text-slate-500">{review.reviewer_name}</p></div><div className="text-right"><p className="font-bold text-violet-700">{review.overall_score ? `${review.overall_score}/5` : 'Draft'}</p><span className={`text-[10px] font-bold uppercase ${statusTone(review.status)}`}>{review.status}</span></div></div>)}</div> : <p className="text-sm text-slate-400">No review assignments yet.</p>}</section>
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-4 flex items-center gap-2"><AcademicCapIcon className="h-5 w-5 text-emerald-700" /><h3 className="text-sm font-bold">Development and career</h3></div>{data.plans.length ? data.plans.map((plan) => <div key={plan.id} className="mb-2 rounded-lg border border-slate-200 p-3"><div className="flex justify-between"><p className="text-sm font-semibold">{plan.title}</p><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${statusTone(plan.status)}`}>{plan.status}</span></div><p className="mt-1 text-xs text-slate-500">Target role: {plan.target_role || 'Not set'} · {plan.actions?.length || 0} actions</p></div>) : <p className="text-sm text-slate-400">No development plan recorded.</p>}{data.promotions.map((item) => <div key={item.id} className="mt-3 rounded-lg bg-violet-50 p-3 text-sm text-violet-900"><SparklesIcon className="mr-2 inline h-4 w-4" />Promotion: {item.current_title} → {item.proposed_title} ({item.status})</div>)}</section>
    </div>

    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-4 flex items-center gap-2"><ChatBubbleLeftRightIcon className="h-5 w-5 text-cyan-700" /><h3 className="text-sm font-bold">Continuous feedback</h3></div><div className="space-y-2">{data.feedback.slice(0, 5).map((item) => <div key={item.id} className="rounded-lg bg-slate-50 p-3"><div className="flex justify-between text-xs"><span className="font-bold capitalize text-slate-700">{item.feedback_type}</span><span className="text-slate-400">{item.author_name}</span></div><p className="mt-1 text-sm text-slate-700">{item.content}</p>{item.acknowledged_at && <span className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700"><CheckCircleIcon className="h-3 w-3" /> Acknowledged</span>}</div>)}</div><form onSubmit={createFeedback} className="mt-4 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-[160px_1fr_auto]"><select value={feedbackForm.feedback_type} onChange={(e) => setFeedbackForm({ ...feedbackForm, feedback_type: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm"><option value="recognition">Recognition</option><option value="coaching">Coaching</option><option value="general">General</option></select><input value={feedbackForm.content} onChange={(e) => setFeedbackForm({ ...feedbackForm, content: e.target.value })} required placeholder="Write specific, actionable feedback" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" /><button disabled={saving} className="rounded-lg border border-blue-200 px-4 py-2 text-sm font-bold text-blue-700">Add feedback</button></form></section>
  </div>
}

export default EmployeeTalentPerformancePanel
