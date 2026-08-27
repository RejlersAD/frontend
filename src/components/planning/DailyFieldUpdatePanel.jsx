import { useCallback, useEffect, useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import {
  AlertTriangle, Check, ClipboardList, Clock, FileText, Loader2, MapPin,
  RefreshCw, Save, Send, X,
} from 'lucide-react'

import planningIntelligenceService from '../../services/planningIntelligence.service'

const today = () => new Date().toISOString().slice(0, 10)
const EMPTY_FORM = {
  activity: '', report_date: today(), measurement_method: 'manual',
  physical_progress_pct: 0, installed_quantity: '', planned_quantity: '', quantity_unit: '',
  remaining_duration_days: '', actual_start: '', actual_finish: '', forecast_finish: '',
  actual_hours: 0, actual_cost: 0, work_location: '', constraints: '', notes: '', evidence: null,
}

const statusTone = {
  draft: 'border-slate-200 bg-slate-50 text-slate-600',
  submitted: 'border-amber-200 bg-amber-50 text-amber-700',
  approved: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  rejected: 'border-rose-200 bg-rose-50 text-rose-700',
}

const errorText = error => (
  error?.response?.data?.error
  || error?.response?.data?.detail
  || error?.response?.data?.non_field_errors?.[0]
  || Object.values(error?.response?.data || {}).flat().find(value => typeof value === 'string')
  || error?.message
  || 'The field update could not be saved.'
)

export default function DailyFieldUpdatePanel({
  versionId, activities, canReport, canApprove, selectedActivityId, onNotice, onControlsChanged,
}) {
  const [updates, setUpdates] = useState([])
  const [form, setForm] = useState(EMPTY_FORM)
  const [editingId, setEditingId] = useState(null)
  const [busy, setBusy] = useState('')
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  const loadUpdates = useCallback(async () => {
    if (!versionId) return
    setLoading(true)
    try {
      setUpdates(await planningIntelligenceService.listDailyFieldUpdates(versionId))
    } catch (error) {
      onNotice('error', errorText(error))
    } finally {
      setLoading(false)
    }
  }, [onNotice, versionId])

  useEffect(() => { loadUpdates() }, [loadUpdates])
  useEffect(() => {
    if (selectedActivityId) {
      setEditingId(null)
      setForm(current => ({ ...EMPTY_FORM, report_date: current.report_date || today(), activity: String(selectedActivityId) }))
    }
  }, [selectedActivityId])

  const selectedActivity = useMemo(
    () => activities.find(item => String(item.id) === String(form.activity)),
    [activities, form.activity],
  )
  const visibleUpdates = useMemo(
    () => updates.filter(item => filter === 'all' || item.status === filter),
    [filter, updates],
  )
  const counts = useMemo(() => updates.reduce((result, item) => ({
    ...result, [item.status]: (result[item.status] || 0) + 1,
  }), {}), [updates])

  const setField = (field, value) => setForm(current => ({ ...current, [field]: value }))
  const resetForm = () => {
    setEditingId(null)
    setForm({ ...EMPTY_FORM, report_date: today(), activity: selectedActivityId ? String(selectedActivityId) : '' })
  }

  const payload = () => ({
    ...form,
    activity: Number(form.activity),
    physical_progress_pct: Number(form.physical_progress_pct || 0),
    actual_hours: Number(form.actual_hours || 0),
    actual_cost: Number(form.actual_cost || 0),
  })

  const save = async submitNow => {
    if (!form.activity) {
      onNotice('error', 'Select the schedule activity performed in the field.')
      return
    }
    const existing = !editingId
      ? updates.find(update => (
        String(update.activity) === String(form.activity) && update.report_date === form.report_date
      ))
      : null
    if (existing && !['draft', 'rejected'].includes(existing.status)) {
      const message = existing.status === 'submitted'
        ? 'This activity already has a field update for this date and it is awaiting approval.'
        : 'This activity already has an approved field update for this date.'
      onNotice('error', message)
      return
    }
    setBusy(submitNow ? 'submit' : 'save')
    try {
      const targetId = editingId || existing?.id
      const saved = targetId
        ? await planningIntelligenceService.updateDailyFieldUpdate(targetId, payload())
        : await planningIntelligenceService.createDailyFieldUpdate(payload())
      if (submitNow) {
        try {
          await planningIntelligenceService.submitDailyFieldUpdate(saved.id)
        } catch (error) {
          // Creation succeeded, so keep subsequent attempts attached to this draft.
          setEditingId(saved.id)
          await loadUpdates()
          throw error
        }
      }
      await loadUpdates()
      resetForm()
      onNotice('success', submitNow ? 'Field update submitted for project-manager approval.' : 'Field update saved as a draft.')
    } catch (error) {
      onNotice('error', errorText(error))
    } finally {
      setBusy('')
    }
  }

  const edit = update => {
    setEditingId(update.id)
    setForm({
      activity: String(update.activity), report_date: update.report_date,
      measurement_method: update.measurement_method, physical_progress_pct: update.physical_progress_pct,
      installed_quantity: update.installed_quantity ?? '', planned_quantity: update.planned_quantity ?? '',
      quantity_unit: update.quantity_unit || '', remaining_duration_days: update.remaining_duration_days ?? '',
      actual_start: update.actual_start || '', actual_finish: update.actual_finish || '',
      forecast_finish: update.forecast_finish || '', actual_hours: update.actual_hours || 0,
      actual_cost: update.actual_cost || 0, work_location: update.work_location || '',
      constraints: update.constraints || '', notes: update.notes || '', evidence: null,
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const approve = async update => {
    const comment = window.prompt('Approval comment (optional)', '')
    if (comment === null) return
    setBusy(`approve-${update.id}`)
    try {
      await planningIntelligenceService.approveDailyFieldUpdate(update.id, comment)
      await loadUpdates()
      await onControlsChanged?.()
      onNotice('success', `${update.external_id} field progress approved and posted to Project Controls.`)
    } catch (error) {
      onNotice('error', errorText(error))
    } finally {
      setBusy('')
    }
  }

  const reject = async update => {
    const comment = window.prompt('Reason for rejection (required)', '')
    if (!comment?.trim()) return
    setBusy(`reject-${update.id}`)
    try {
      await planningIntelligenceService.rejectDailyFieldUpdate(update.id, comment.trim())
      await loadUpdates()
      onNotice('success', `${update.external_id} returned to the reporter for correction.`)
    } catch (error) {
      onNotice('error', errorText(error))
    } finally {
      setBusy('')
    }
  }

  const computedProgress = form.measurement_method === 'quantity' && Number(form.planned_quantity) > 0
    ? Math.min(100, (Number(form.installed_quantity || 0) / Number(form.planned_quantity)) * 100)
    : Number(form.physical_progress_pct || 0)

  return (
    <div className="space-y-4 bg-slate-50/70 p-3 lg:p-4">
      <section className="rounded-2xl border border-violet-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-4 py-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-700"><ClipboardList className="h-5 w-5" /></div>
          <div className="mr-auto"><h2 className="font-bold text-slate-800">Daily Field Update</h2><p className="text-xs text-slate-500">Report activity progress, evidence, quantities, hours, and field constraints.</p></div>
          <div className="flex flex-wrap gap-2 text-xs font-bold">
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-700">{counts.submitted || 0} awaiting approval</span>
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">{counts.approved || 0} approved</span>
          </div>
        </div>

        <fieldset disabled={!canReport || Boolean(busy)} className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
          <label className="text-xs font-semibold text-slate-600 xl:col-span-2">Schedule activity
            <select required value={form.activity} onChange={event => setField('activity', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700">
              <option value="">Select activity</option>
              {activities.map(activity => <option key={activity.id} value={activity.id}>{activity.external_id} — {activity.name}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-600">Report/data date<input required type="date" value={form.report_date} onChange={event => setField('report_date', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>
          <label className="text-xs font-semibold text-slate-600">Measurement method
            <select value={form.measurement_method} onChange={event => setField('measurement_method', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="manual">Manual percent</option><option value="quantity">Installed quantity</option><option value="zero_hundred">0/100</option><option value="fifty_fifty">50/50</option><option value="weighted_steps">Weighted steps</option>
            </select>
          </label>

          {form.measurement_method === 'quantity' && <>
            <label className="text-xs font-semibold text-slate-600">Installed quantity<input type="number" min="0" step="0.001" value={form.installed_quantity} onChange={event => setField('installed_quantity', event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" /></label>
            <label className="text-xs font-semibold text-slate-600">Planned quantity<input type="number" min="0.001" step="0.001" value={form.planned_quantity} onChange={event => setField('planned_quantity', event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" /></label>
            <label className="text-xs font-semibold text-slate-600">Unit<input value={form.quantity_unit} onChange={event => setField('quantity_unit', event.target.value)} placeholder="m, items, tonnes…" className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" /></label>
          </>}
          <label className="text-xs font-semibold text-slate-600">Cumulative physical progress
            <div className="mt-1 flex items-center"><input type="number" min="0" max="100" step="0.1" disabled={['quantity', 'zero_hundred', 'fifty_fifty'].includes(form.measurement_method)} value={form.measurement_method === 'quantity' ? computedProgress.toFixed(1) : form.physical_progress_pct} onChange={event => setField('physical_progress_pct', event.target.value)} className="w-full rounded-l-lg border px-3 py-2 text-sm disabled:bg-slate-100" /><span className="rounded-r-lg border border-l-0 bg-slate-50 px-2 py-2 text-sm">%</span></div>
          </label>
          <label className="text-xs font-semibold text-slate-600">Remaining duration (days)<input type="number" min="0" step="0.25" value={form.remaining_duration_days} onChange={event => setField('remaining_duration_days', event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" /></label>
          <label className="text-xs font-semibold text-slate-600">Actual start<input type="date" max={form.report_date} value={form.actual_start} onChange={event => setField('actual_start', event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" /></label>
          <label className="text-xs font-semibold text-slate-600">Actual finish<input type="date" max={form.report_date} value={form.actual_finish} onChange={event => setField('actual_finish', event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" /></label>
          <label className="text-xs font-semibold text-slate-600">Forecast finish<input type="date" value={form.forecast_finish} onChange={event => setField('forecast_finish', event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" /></label>
          <label className="text-xs font-semibold text-slate-600">Cumulative actual hours<input type="number" min="0" step="0.25" value={form.actual_hours} onChange={event => setField('actual_hours', event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" /></label>
          <label className="text-xs font-semibold text-slate-600">Cumulative actual cost<input type="number" min="0" step="0.01" value={form.actual_cost} onChange={event => setField('actual_cost', event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" /></label>
          <label className="text-xs font-semibold text-slate-600 xl:col-span-2">Work location<div className="relative mt-1"><MapPin className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input value={form.work_location} onChange={event => setField('work_location', event.target.value)} placeholder="Area, unit, work front…" className="w-full rounded-lg border py-2 pl-9 pr-3 text-sm" /></div></label>
          <label className="text-xs font-semibold text-slate-600 sm:col-span-2">Field constraints / RFI<input value={form.constraints} onChange={event => setField('constraints', event.target.value)} placeholder="Access, permit, material, inspection, interface…" className="mt-1 w-full rounded-lg border border-amber-300 bg-amber-50/50 px-3 py-2 text-sm" /></label>
          <label className="text-xs font-semibold text-slate-600 sm:col-span-2">Progress notes<textarea rows="3" value={form.notes} onChange={event => setField('notes', event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" /></label>
          <label className="text-xs font-semibold text-slate-600 sm:col-span-2">Evidence attachment <span className="font-normal text-slate-400">(PDF, image, XLSX, DOCX — max 20 MB)</span><input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.xlsx,.docx" onChange={event => setField('evidence', event.target.files?.[0] || null)} className="mt-1 block w-full rounded-lg border bg-white px-3 py-2 text-sm" /></label>
        </fieldset>

        {selectedActivity && <div className="mx-4 mb-3 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700"><b>{selectedActivity.external_id}</b> is linked directly to the Activities &amp; Gantt schedule. Approved values will be posted to its Project Controls record.</div>}
        {busy && <div className="mx-4 mb-3" role="status"><div className="mb-1 flex justify-between text-xs font-semibold text-violet-700"><span>Processing field update…</span><span>Please wait</span></div><div className="h-2 overflow-hidden rounded-full bg-violet-100"><div className="h-full w-2/3 animate-pulse rounded-full bg-gradient-to-r from-violet-600 via-indigo-500 to-violet-600" /></div></div>}
        <div className="flex flex-wrap justify-end gap-2 border-t bg-slate-50 px-4 py-3">
          {editingId && <button type="button" onClick={resetForm} disabled={Boolean(busy)} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold text-slate-600"><X className="h-4 w-4" />Cancel edit</button>}
          <button type="button" onClick={() => save(false)} disabled={!canReport || Boolean(busy)} className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-white px-3 py-2 text-sm font-bold text-violet-700 disabled:opacity-40">{busy === 'save' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save draft</button>
          <button type="button" onClick={() => save(true)} disabled={!canReport || Boolean(busy)} className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-40">{busy === 'submit' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Submit for approval</button>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3"><h3 className="mr-auto font-bold text-slate-800">Field update register</h3>{['all', 'draft', 'submitted', 'approved', 'rejected'].map(value => <button key={value} onClick={() => setFilter(value)} className={`rounded-lg px-2.5 py-1.5 text-xs font-bold capitalize ${filter === value ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500'}`}>{value}</button>)}<button onClick={loadUpdates} className="rounded-lg border p-1.5 text-slate-500" title="Refresh"><RefreshCw className="h-4 w-4" /></button></div>
        {loading ? <div className="flex items-center justify-center gap-2 p-8 text-sm text-slate-500"><Loader2 className="h-5 w-5 animate-spin text-violet-600" />Loading field reports…</div> : !visibleUpdates.length ? <div className="p-8 text-center text-sm text-slate-400">No field updates match this filter.</div> : <div className="divide-y divide-slate-100">{visibleUpdates.map(update => <article key={update.id} className="p-4">
          <div className="flex flex-wrap items-start gap-3"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><b className="font-mono text-violet-700">{update.external_id}</b><span className="truncate font-semibold text-slate-800">{update.activity_name}</span><span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${statusTone[update.status]}`}>{update.status}</span></div><div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500"><span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{update.report_date}</span><span>{update.physical_progress_pct}% complete</span><span>{update.actual_hours} actual hours</span>{update.work_location && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{update.work_location}</span>}<span>Reported by {update.reporter_name || 'Unknown'}</span></div></div>
            <div className="flex gap-2">{['draft', 'rejected'].includes(update.status) && canReport && <button onClick={() => edit(update)} className="rounded-lg border px-3 py-1.5 text-xs font-bold text-violet-700">Edit</button>}{update.status === 'submitted' && canApprove && <><button disabled={Boolean(busy)} onClick={() => reject(update)} className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-bold text-rose-600">Reject</button><button disabled={Boolean(busy)} onClick={() => approve(update)} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white"><Check className="h-3.5 w-3.5" />Approve</button></>}</div>
          </div>
          {(update.notes || update.constraints || update.review_comment || update.evidence) && <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">{update.notes && <div className="rounded-lg bg-slate-50 px-3 py-2 text-slate-600"><b>Notes:</b> {update.notes}</div>}{update.constraints && <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-700"><span className="inline-flex items-center gap-1 font-bold"><AlertTriangle className="h-3.5 w-3.5" />Constraint:</span> {update.constraints}</div>}{update.review_comment && <div className="rounded-lg bg-blue-50 px-3 py-2 text-blue-700"><b>Review:</b> {update.review_comment}</div>}{update.evidence && <a href={update.evidence} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg bg-violet-50 px-3 py-2 font-bold text-violet-700"><FileText className="h-4 w-4" />{update.evidence_name || 'Open evidence'}</a>}</div>}
        </article>)}</div>}
      </section>
    </div>
  )
}

DailyFieldUpdatePanel.propTypes = {
  versionId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  activities: PropTypes.arrayOf(PropTypes.object).isRequired,
  canReport: PropTypes.bool.isRequired,
  canApprove: PropTypes.bool.isRequired,
  selectedActivityId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onNotice: PropTypes.func.isRequired,
  onControlsChanged: PropTypes.func,
}

DailyFieldUpdatePanel.defaultProps = { selectedActivityId: null, onControlsChanged: null }
