import { useEffect, useMemo, useState } from 'react'
import * as HeroIcons from '@heroicons/react/24/outline'
import probationPerformanceService from '../../services/probationPerformance.service'

const RATING_FIELDS = [
  ['job_knowledge_rating', 'Job knowledge'],
  ['work_quality_rating', 'Quality of work'],
  ['reliability_rating', 'Reliability'],
  ['teamwork_rating', 'Teamwork'],
]

const RATING_LABELS = ['Needs support', 'Developing', 'Meets expectations', 'Very good', 'Excellent']

const INSIGHT_FIELDS = [
  ['achievements', 'Key achievements', HeroIcons.TrophyIcon, 'border-amber-200 bg-amber-50/60 text-amber-700'],
  ['strengths', 'Strengths', HeroIcons.SparklesIcon, 'border-emerald-200 bg-emerald-50/60 text-emerald-700'],
  ['improvement_areas', 'Areas for improvement', HeroIcons.ArrowTrendingUpIcon, 'border-orange-200 bg-orange-50/60 text-orange-700'],
  ['next_period_goals', 'Goals for the next period', HeroIcons.FlagIcon, 'border-blue-200 bg-blue-50/60 text-blue-700'],
  ['overall_comments', 'Overall assessment', HeroIcons.DocumentTextIcon, 'border-violet-200 bg-violet-50/60 text-violet-700'],
]

const roleCode = (role) => String(role?.code || role?.name || role || '').toLowerCase().replace(/[^a-z0-9]+/g, '_')

const canGenerateReport = (currentUser, employee) => {
  const user = currentUser?.user || currentUser
  if (user?.is_superuser) return true
  const roles = [...(currentUser?.roles || []), ...(user?.roles || [])].map(roleCode)
  if (roles.some((role) => ['super_admin', 'admin', 'hr_admin', 'hr_manager', 'human_resource'].includes(role))) return true
  const manager = employee?.manager_detail
  return Boolean(
    (manager?.id && currentUser?.id && String(manager.id) === String(currentUser.id)) ||
    (manager?.email && user?.email && manager.email.toLowerCase() === user.email.toLowerCase()),
  )
}

const formatDate = (value, withTime = false) => value
  ? new Intl.DateTimeFormat('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric',
      ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
      timeZone: 'UTC',
    }).format(new Date(withTime ? value : `${value}T00:00:00Z`))
  : '—'

const errorMessage = (error, fallback) => {
  const data = error?.response?.data || error?.originalError?.response?.data
  if (typeof data?.detail === 'string') return data.detail
  if (typeof data === 'object' && data) {
    const first = Object.values(data).flat()[0]
    if (first) return String(first)
  }
  return fallback
}

const Metric = ({ label, value, suffix = '' }) => (
  <div className="rounded-xl border border-white/10 bg-white/10 px-3 py-2.5 backdrop-blur-sm">
    <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-100">{label}</p>
    <p className="mt-0.5 text-lg font-bold text-white">{value ?? 0}{suffix}</p>
  </div>
)

export default function ProbationPerformancePanel({ employee, currentUser }) {
  const employeeId = employee?.user?.id
  const [report, setReport] = useState(null)
  const [form, setForm] = useState({})
  const [previewOpen, setPreviewOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const mayGenerate = useMemo(() => canGenerateReport(currentUser, employee), [currentUser, employee])

  const applyReport = (next) => {
    setReport(next)
    setForm(next || {})
  }

  useEffect(() => {
    setPreviewOpen(false)
    setReport(null)
    setForm({})
    setLoading(false)
    setError('')
    setSuccess('')
  }, [employeeId])

  const loadPreview = async () => {
    if (!employeeId) return
    setPreviewOpen(true)
    setLoading(true)
    setError('')
    setSuccess('')
    try {
      const rows = await probationPerformanceService.getForEmployee(employeeId)
      applyReport(rows[0] || null)
    } catch (requestError) {
      setError(errorMessage(requestError, 'The 100-day report could not be loaded.'))
    } finally {
      setLoading(false)
    }
  }

  const generate = async () => {
    setSaving(true)
    setError('')
    try {
      const next = await probationPerformanceService.generate(employeeId)
      applyReport(next)
      setSuccess('100-day report generated from current RADAI records.')
    } catch (requestError) {
      setError(errorMessage(requestError, 'The report could not be generated.'))
    } finally {
      setSaving(false)
    }
  }

  const refreshInsights = async () => {
    setRefreshing(true)
    setError('')
    setSuccess('')
    try {
      const next = await probationPerformanceService.refreshInsights(report.id)
      applyReport(next)
      setSuccess('RADAI insights refreshed with the latest available records.')
    } catch (requestError) {
      setError(errorMessage(requestError, 'RADAI insights could not be refreshed.'))
    } finally {
      setRefreshing(false)
    }
  }

  const save = async (submit = false) => {
    setSaving(true)
    setError('')
    setSuccess('')
    const payload = Object.fromEntries([
      ...RATING_FIELDS.map(([field]) => [field, form[field] ? Number(form[field]) : null]),
      ['status', submit ? 'submitted' : 'draft'],
    ])
    try {
      const next = await probationPerformanceService.update(report.id, payload)
      applyReport(next)
      setSuccess(submit ? 'Performance report submitted.' : 'Manager ratings saved as a draft.')
    } catch (requestError) {
      setError(errorMessage(requestError, 'The report could not be saved.'))
    } finally {
      setSaving(false)
    }
  }

  if (!previewOpen) {
    return (
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-5 px-6 py-6">
          <div className="flex items-start gap-4">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><HeroIcons.DocumentChartBarIcon className="h-5 w-5" /></span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-blue-700">Probation checkpoint</p>
              <h3 className="mt-1 text-base font-bold text-slate-950">100-day performance report</h3>
              <p className="mt-1 text-sm text-slate-500">Open the report only when you are ready to review its RADAI insights.</p>
            </div>
          </div>
          <button type="button" onClick={loadPreview} disabled={!employeeId} className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-800 disabled:opacity-50"><HeroIcons.EyeIcon className="h-4 w-4" />Preview report</button>
        </div>
      </section>
    )
  }

  if (loading) return <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500"><HeroIcons.ArrowPathIcon className="mx-auto mb-2 h-6 w-6 animate-spin text-blue-600" />Loading report preview…</div>

  if (!report) {
    return (
      <section className="overflow-hidden rounded-2xl border border-blue-200 bg-white shadow-sm">
        <div className="bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-900 px-6 py-7 text-white">
          <div className="flex flex-wrap items-center justify-between gap-5">
            <div className="flex items-start gap-4"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15"><HeroIcons.DocumentChartBarIcon className="h-6 w-6" /></span><div><p className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-200">Probation checkpoint</p><h3 className="mt-1 text-xl font-bold">100-day performance report</h3><p className="mt-1 max-w-xl text-sm text-blue-100">Generate an evidence-based review from RADAI activity, project, profile and attendance records.</p></div></div>
            {mayGenerate && <button type="button" onClick={generate} disabled={saving} className="rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-blue-950 shadow-sm hover:bg-blue-50 disabled:opacity-50">{saving ? 'Generating…' : 'Generate from RADAI'}</button>}
          </div>
        </div>
        {(error || !mayGenerate) && <p className={`m-5 rounded-xl px-4 py-3 text-xs ${error ? 'bg-red-50 text-red-700' : 'bg-slate-50 text-slate-600'}`}>{error || 'Only HR or this employee’s direct line manager can generate the report.'}</p>}
      </section>
    )
  }

  const editable = report.can_edit !== false && report.status !== 'submitted'
  const snapshot = report.system_snapshot || {}
  const activity = snapshot.activity || {}
  const attendance = snapshot.attendance || {}
  const ratedFields = RATING_FIELDS.filter(([field]) => form[field])
  const averageRating = ratedFields.length
    ? RATING_FIELDS.reduce((sum, [field]) => sum + (Number(form[field]) || 0), 0) / ratedFields.length
    : 0

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-900 px-6 py-6 text-white">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20"><HeroIcons.DocumentChartBarIcon className="h-6 w-6" /></span><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-lg font-bold">100-day performance report</h3><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${report.status === 'submitted' ? 'bg-emerald-400/20 text-emerald-100 ring-1 ring-emerald-300/30' : 'bg-amber-300/20 text-amber-100 ring-1 ring-amber-200/30'}`}>{report.status}</span></div><p className="mt-1 text-xs text-blue-100">Review period {formatDate(snapshot.period?.start || report.joining_date)} – {formatDate(snapshot.period?.end || report.due_date)} · Due {formatDate(report.due_date)}</p><p className="mt-1 text-xs text-blue-200">Created by {report.created_by_name || 'HR / Manager'}</p></div></div>
          {editable && <button type="button" onClick={refreshInsights} disabled={refreshing} className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3.5 py-2 text-xs font-bold text-white hover:bg-white/15 disabled:opacity-50"><HeroIcons.ArrowPathIcon className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />{refreshing ? 'Refreshing…' : 'Refresh RADAI insights'}</button>}
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
          <Metric label="Activities" value={activity.total_actions} />
          <Metric label="Success rate" value={activity.success_rate} suffix="%" />
          <Metric label="AI requests" value={activity.ai_requests} />
          <Metric label="Features" value={activity.features_used} />
          <Metric label="Projects" value={snapshot.projects?.length || 0} />
          <Metric label="Attendance" value={attendance.days_present} suffix=" days" />
        </div>
      </header>

      <div className="space-y-7 p-6">
        <section>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2"><div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-blue-700">Manager assessment</p><h4 className="mt-1 text-base font-bold text-slate-950">Performance ratings</h4></div>{averageRating > 0 && <p className="text-sm font-semibold text-slate-600">Average <span className="ml-1 text-xl font-bold text-blue-700">{averageRating.toFixed(1)}</span><span className="text-slate-400"> / 5</span></p>}</div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {RATING_FIELDS.map(([field, label]) => (
              <div key={field} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
                <p className="text-xs font-bold text-slate-800">{label}</p>
                <div className="mt-3 flex gap-1.5">{[1,2,3,4,5].map((rating) => <button key={rating} type="button" disabled={!editable} title={RATING_LABELS[rating - 1]} onClick={() => setForm((previous) => ({ ...previous, [field]: rating }))} className={`flex h-8 flex-1 items-center justify-center rounded-lg text-xs font-bold transition ${Number(form[field]) === rating ? 'bg-blue-700 text-white shadow-sm' : 'border border-slate-200 bg-white text-slate-500 hover:border-blue-300 hover:text-blue-700'} disabled:cursor-default disabled:hover:border-slate-200`}>{rating}</button>)}</div>
                <p className="mt-2 min-h-4 text-[10px] font-medium text-slate-500">{form[field] ? RATING_LABELS[Number(form[field]) - 1] : 'Select 1–5'}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-violet-700">System-generated analysis</p><h4 className="mt-1 text-base font-bold text-slate-950">RADAI performance insights</h4></div><div className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-3 py-1.5 text-[10px] font-bold text-violet-700"><HeroIcons.SparklesIcon className="h-3.5 w-3.5" />Generated {formatDate(report.insights_generated_at, true)}</div></div>
          <div className="grid gap-4 lg:grid-cols-2">
            {INSIGHT_FIELDS.map(([field, label, InsightIcon, tone], index) => <article key={field} className={`rounded-xl border p-4 ${tone} ${index === INSIGHT_FIELDS.length - 1 ? 'lg:col-span-2' : ''}`}><div className="flex items-start gap-3"><span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/80"><InsightIcon className="h-4 w-4" /></span><div><div className="flex items-center gap-2"><h5 className="text-xs font-bold uppercase tracking-wide">{label}</h5><HeroIcons.LockClosedIcon className="h-3 w-3 opacity-60" title="Generated from RADAI records" /></div><p className="mt-2 text-sm leading-6 text-slate-700">{report[field] || 'No system insight is currently available.'}</p></div></div></article>)}
          </div>
          <p className="mt-3 flex items-start gap-2 text-[11px] leading-5 text-slate-500"><HeroIcons.InformationCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />Narrative sections are generated only from recorded RADAI data and cannot be manually edited. Refresh before submission to include the latest records.</p>
        </section>

        {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-xs text-red-700">{error}</p>}
        {success && <p className="rounded-xl bg-emerald-50 px-4 py-3 text-xs text-emerald-700">{success}</p>}
        {editable && <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5"><p className="text-xs text-slate-500">All four manager ratings are required before submission.</p><div className="flex gap-2"><button type="button" disabled={saving} onClick={() => save(false)} className="rounded-xl border border-slate-300 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Save ratings</button><button type="button" disabled={saving} onClick={() => save(true)} className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-800 disabled:opacity-50"><HeroIcons.PaperAirplaneIcon className="h-4 w-4" />{saving ? 'Submitting…' : 'Submit report'}</button></div></footer>}
        {report.status === 'submitted' && <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800">Submitted by {report.submitted_by_name || 'HR / Manager'} on {formatDate(report.submitted_at, true)}. The report is now read-only.</p>}
      </div>
    </section>
  )
}
