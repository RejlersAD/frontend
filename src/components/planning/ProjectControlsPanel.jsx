/* eslint-disable react/prop-types */
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle, Camera, Check, Download, Gauge, Loader2, RefreshCw,
  Save, TrendingDown, TrendingUp,
} from 'lucide-react'

import planningIntelligenceService from '../../services/planningIntelligence.service'

const number = value => Number(value || 0)
const money = value => number(value).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })
const ratio = value => value === null || value === undefined ? '—' : number(value).toFixed(2)
const today = () => new Date().toISOString().slice(0, 10)

const metricTone = (value, inverse = false) => {
  if (value === null || value === undefined) return 'text-slate-500'
  const healthy = inverse ? number(value) <= 0 : number(value) >= 1
  return healthy ? 'text-emerald-600' : 'text-rose-600'
}

const CurveChart = ({ rows }) => {
  const points = rows || []
  const monetaryMax = Math.max(0, ...points.flatMap(row => [number(row.planned_value), number(row.earned_value), number(row.actual_cost)]))
  const useProgress = monetaryMax <= 0
  const maxValue = useProgress ? 100 : monetaryMax
  const width = 900
  const height = 250
  const pad = 34
  const x = index => pad + (points.length <= 1 ? 0 : index * (width - pad * 2) / (points.length - 1))
  const y = value => height - pad - Math.min(maxValue, Math.max(0, number(value))) * (height - pad * 2) / maxValue
  const path = field => points.map((row, index) => `${index ? 'L' : 'M'}${x(index).toFixed(1)},${y(row[field]).toFixed(1)}`).join(' ')
  const series = useProgress
    ? [{ field: 'planned_progress_pct', color: '#6366f1', label: 'Planned %' }, { field: 'progress_pct', color: '#10b981', label: 'Actual %' }]
    : [{ field: 'planned_value', color: '#6366f1', label: 'PV' }, { field: 'earned_value', color: '#10b981', label: 'EV' }, { field: 'actual_cost', color: '#f59e0b', label: 'AC' }]

  if (!points.length) return <div className="h-64 flex items-center justify-center text-sm text-slate-400">No time-phased data yet.</div>
  return (
    <div>
      <div className="flex flex-wrap gap-4 mb-2 text-xs text-slate-500">
        {series.map(item => <span key={item.field} className="inline-flex items-center gap-1.5"><i className="w-3 h-1 rounded" style={{ backgroundColor: item.color }} />{item.label}</span>)}
        {useProgress && <span className="text-amber-600">Add cost assignments to enable monetary EVM curves.</span>}
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[600px] h-64" role="img" aria-label="Project controls S-curve">
        {[0, 0.25, 0.5, 0.75, 1].map(mark => <g key={mark}><line x1={pad} x2={width - pad} y1={y(maxValue * mark)} y2={y(maxValue * mark)} stroke="#e2e8f0" /><text x="2" y={y(maxValue * mark) + 4} fontSize="10" fill="#94a3b8">{useProgress ? `${Math.round(mark * 100)}%` : money(maxValue * mark)}</text></g>)}
        {series.map(item => <path key={item.field} d={path(item.field)} fill="none" stroke={item.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />)}
        <text x={pad} y={height - 7} fontSize="10" fill="#94a3b8">{points[0]?.date}</text>
        <text x={width - pad} y={height - 7} fontSize="10" fill="#94a3b8" textAnchor="end">{points.at(-1)?.date}</text>
      </svg>
    </div>
  )
}

const ProjectControlsPanel = ({ versionId, canEdit, canBudget, resources = [], assignments = [], onWorkspaceRefresh, onNotice }) => {
  const [controls, setControls] = useState(null)
  const [dataDate, setDataDate] = useState(today())
  const [drafts, setDrafts] = useState({})
  const [dirty, setDirty] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [assignment, setAssignment] = useState({ activity: '', resource: '', budgeted_hours: '', budgeted_cost: '' })

  const load = useCallback(async (date, quiet = false) => {
    if (!versionId) return
    if (!quiet) setLoading(true)
    try {
      const result = await planningIntelligenceService.getScheduleControls(versionId, date)
      setControls(result)
      setDataDate(result.data_date || date || today())
      setDrafts(Object.fromEntries((result.activities || []).map(row => [row.id, {
        physical_progress_pct: row.physical_progress_pct || 0,
        remaining_duration_days: row.remaining_duration_days ?? '',
        actual_start: row.actual_start || '', actual_finish: row.actual_finish || '',
        forecast_finish: row.forecast_finish || '', actual_hours: row.actual_hours || 0,
        actual_cost: row.actual_cost || 0, notes: row.notes || '',
      }])))
      setDirty(new Set())
    } catch (error) {
      onNotice('error', error?.response?.data?.error || 'Unable to load project controls.')
    } finally {
      setLoading(false)
    }
  }, [versionId, onNotice])

  useEffect(() => { load() }, [load])

  const update = (id, field, value) => {
    setDrafts(current => ({ ...current, [id]: { ...current[id], [field]: value } }))
    setDirty(current => new Set(current).add(id))
  }

  const saveProgress = async () => {
    const updates = [...dirty].map(id => ({
      activity: id,
      ...drafts[id],
      remaining_duration_days: drafts[id].remaining_duration_days === '' ? null : drafts[id].remaining_duration_days,
      actual_start: drafts[id].actual_start || null,
      actual_finish: drafts[id].actual_finish || null,
      forecast_finish: drafts[id].forecast_finish || null,
    }))
    if (!updates.length) return
    setBusy('save')
    try {
      await planningIntelligenceService.updateScheduleProgress(versionId, dataDate, updates)
      await load(dataDate, true)
      onNotice('success', `${updates.length} progress update${updates.length === 1 ? '' : 's'} posted for ${dataDate}.`)
    } catch (error) {
      onNotice('error', error?.response?.data?.error || error?.response?.data?.updates?.[0] || 'Progress could not be saved.')
    } finally {
      setBusy('')
    }
  }

  const capture = async () => {
    setBusy('capture')
    try {
      await planningIntelligenceService.captureScheduleControls(versionId, dataDate)
      await load(dataDate, true)
      onNotice('success', `Project-controls snapshot captured for ${dataDate}.`)
    } catch (error) {
      onNotice('error', error?.response?.data?.error || 'Snapshot could not be captured.')
    } finally {
      setBusy('')
    }
  }

  const addAssignment = async event => {
    event.preventDefault()
    setBusy('assignment')
    try {
      await planningIntelligenceService.createAssignment({
        activity: Number(assignment.activity), resource: Number(assignment.resource),
        planned_units: Number(assignment.budgeted_hours || 0),
        budgeted_hours: Number(assignment.budgeted_hours || 0),
        budgeted_cost: Number(assignment.budgeted_cost || 0),
      })
      setAssignment({ activity: '', resource: '', budgeted_hours: '', budgeted_cost: '' })
      await onWorkspaceRefresh?.()
      await load(dataDate, true)
      onNotice('success', 'Activity budget assignment added.')
    } catch (error) {
      onNotice('error', error?.response?.data?.non_field_errors?.[0] || error?.response?.data?.error || 'Budget assignment could not be added.')
    } finally {
      setBusy('')
    }
  }

  const removeAssignment = async id => {
    setBusy(`assignment-${id}`)
    try {
      await planningIntelligenceService.deleteAssignment(id)
      await onWorkspaceRefresh?.()
      await load(dataDate, true)
      onNotice('success', 'Activity budget assignment removed.')
    } catch (error) {
      onNotice('error', error?.response?.data?.error || 'Budget assignment could not be removed.')
    } finally {
      setBusy('')
    }
  }

  const exportCsv = () => {
    const headers = ['Activity ID', 'Name', 'WBS', 'Planned %', 'Actual %', 'Budget Cost', 'Actual Cost', 'Actual Hours', 'Forecast Finish']
    const rows = (controls?.activities || []).map(row => [row.external_id, row.name, row.wbs_code, row.planned_progress_pct, row.physical_progress_pct, row.budgeted_cost, row.actual_cost, row.actual_hours, row.forecast_finish])
    const csv = [headers, ...rows].map(row => row.map(value => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `project-controls-${dataDate}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const kpis = useMemo(() => controls ? [
    { label: 'Physical Progress', value: `${number(controls.progress_pct).toFixed(1)}%`, sub: `${number(controls.planned_progress_pct).toFixed(1)}% planned`, icon: Gauge, tone: number(controls.progress_pct) >= number(controls.planned_progress_pct) ? 'text-emerald-600' : 'text-rose-600' },
    { label: 'SPI', value: ratio(controls.spi), sub: `SV ${money(controls.schedule_variance)}`, icon: controls.spi >= 1 ? TrendingUp : TrendingDown, tone: metricTone(controls.spi) },
    { label: 'CPI', value: ratio(controls.cpi), sub: `CV ${money(controls.cost_variance)}`, icon: controls.cpi >= 1 ? TrendingUp : TrendingDown, tone: metricTone(controls.cpi) },
    { label: 'BAC', value: money(controls.bac), sub: `PV ${money(controls.planned_value)}`, icon: Gauge, tone: 'text-slate-800' },
    { label: 'EAC', value: controls.eac === null ? '—' : money(controls.eac), sub: `VAC ${controls.vac === null ? '—' : money(controls.vac)}`, icon: TrendingUp, tone: metricTone(controls.vac, true) },
    { label: 'Forecast Finish', value: controls.forecast_finish || '—', sub: `Data date ${controls.data_date}`, icon: Gauge, tone: 'text-slate-800' },
  ] : [], [controls])

  if (loading) return <div className="h-72 flex items-center justify-center text-slate-500"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading project controls...</div>
  if (!controls) return null

  return (
    <div className="p-4 space-y-5 bg-slate-50/50">
      <div className="flex flex-wrap items-center gap-2">
        <div className="mr-auto"><h2 className="font-bold text-slate-800">Project Controls</h2><p className="text-xs text-slate-500">Progress measurement, earned value, forecasting, and variance reporting.</p></div>
        <label className="text-xs font-semibold text-slate-500">Data date <input type="date" value={dataDate} onChange={event => setDataDate(event.target.value)} className="ml-2 border rounded-lg px-2 py-1.5 text-sm text-slate-700" /></label>
        <button onClick={() => load(dataDate)} className="p-2 border rounded-lg text-slate-500" title="Refresh data date"><RefreshCw className="w-4 h-4" /></button>
        <button onClick={exportCsv} className="inline-flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm font-semibold text-slate-600"><Download className="w-4 h-4" /> CSV</button>
        <button disabled={!canEdit || Boolean(busy)} onClick={capture} className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-800 text-white rounded-lg text-sm font-semibold disabled:opacity-40"><Camera className="w-4 h-4" /> Capture</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {kpis.map(item => { const Icon = item.icon; return <div key={item.label} className="bg-white border rounded-xl p-3 shadow-sm"><div className="flex justify-between text-[11px] uppercase tracking-wide text-slate-400 font-semibold"><span>{item.label}</span><Icon className={`w-4 h-4 ${item.tone}`} /></div><div className={`text-xl font-bold mt-1 ${item.tone}`}>{item.value}</div><div className="text-xs text-slate-400 mt-1">{item.sub}</div></div> })}
      </div>

      {number(controls.bac) === 0 && <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700"><AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />Cost EVM is waiting for budgeted-cost resource assignments. Schedule progress and hour metrics remain available.</div>}

      <section className="bg-white border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b"><h3 className="font-semibold text-slate-800">Control Account Budget</h3><p className="text-xs text-slate-400">Load activity hours and cost before baselining the schedule definition.</p></div>
        <form onSubmit={addAssignment} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_130px_140px_auto] gap-2 p-3 bg-slate-50">
          <select required disabled={!canBudget} value={assignment.activity} onChange={event => setAssignment(value => ({ ...value, activity: event.target.value }))} className="border rounded-lg px-2 py-2 text-sm"><option value="">Activity</option>{controls.activities.map(row => <option key={row.id} value={row.id}>{row.external_id} - {row.name}</option>)}</select>
          <select required disabled={!canBudget} value={assignment.resource} onChange={event => setAssignment(value => ({ ...value, resource: event.target.value }))} className="border rounded-lg px-2 py-2 text-sm"><option value="">Resource</option>{resources.map(row => <option key={row.id} value={row.id}>{row.code} - {row.name}</option>)}</select>
          <input required disabled={!canBudget} type="number" min="0" step="0.25" value={assignment.budgeted_hours} onChange={event => setAssignment(value => ({ ...value, budgeted_hours: event.target.value }))} placeholder="Budget hours" className="border rounded-lg px-3 py-2 text-sm" />
          <input required disabled={!canBudget} type="number" min="0" step="0.01" value={assignment.budgeted_cost} onChange={event => setAssignment(value => ({ ...value, budgeted_cost: event.target.value }))} placeholder="Budget cost" className="border rounded-lg px-3 py-2 text-sm" />
          <button disabled={!canBudget || Boolean(busy)} className="px-3 py-2 rounded-lg bg-violet-600 text-white text-sm font-semibold disabled:opacity-40">Assign Budget</button>
        </form>
        {assignments.length > 0 && <div className="overflow-auto max-h-44"><table className="w-full min-w-[700px] text-xs"><thead className="bg-white text-slate-400"><tr><th className="text-left px-3 py-2">Activity</th><th className="text-left px-3">Resource</th><th className="text-right px-3">Hours</th><th className="text-right px-3">Cost</th><th /></tr></thead><tbody>{assignments.map(row => { const activityRow = controls.activities.find(item => item.id === row.activity); const resource = resources.find(item => item.id === row.resource); return <tr key={row.id} className="border-t"><td className="px-3 py-2 font-mono">{activityRow?.external_id || row.activity}</td><td className="px-3">{resource?.name || row.resource}</td><td className="px-3 text-right">{money(row.budgeted_hours)}</td><td className="px-3 text-right">{money(row.budgeted_cost)}</td><td className="px-3 text-right"><button type="button" disabled={!canBudget || Boolean(busy)} onClick={() => removeAssignment(row.id)} className="text-rose-500 disabled:opacity-30">Remove</button></td></tr> })}</tbody></table></div>}
      </section>

      <div className="grid xl:grid-cols-[1.55fr_1fr] gap-4">
        <section className="bg-white border rounded-xl p-4 overflow-auto"><h3 className="font-semibold text-slate-800 mb-3">S-Curve</h3><CurveChart rows={controls.curve} /></section>
        <section className="bg-white border rounded-xl p-4"><h3 className="font-semibold text-slate-800 mb-3">Hours & Cost</h3><div className="grid grid-cols-2 gap-3 text-sm">{[
          ['Budgeted hours', controls.budgeted_hours], ['Earned hours', controls.earned_hours], ['Actual hours', controls.actual_hours],
          ['Earned value', controls.earned_value], ['Actual cost', controls.actual_cost], ['ETC', controls.etc],
        ].map(([label, value]) => <div key={label} className="bg-slate-50 rounded-lg p-3"><div className="text-xs text-slate-400">{label}</div><b className="text-slate-800">{value === null ? '—' : money(value)}</b></div>)}</div></section>
      </div>

      <section className="bg-white border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center"><div><h3 className="font-semibold text-slate-800">Activity Status</h3><p className="text-xs text-slate-400">Values are cumulative as of the selected data date.</p></div><button onClick={saveProgress} disabled={!canEdit || !dirty.size || Boolean(busy)} className="ml-auto inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-violet-600 text-white text-sm font-semibold disabled:opacity-40">{busy === 'save' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Post Progress ({dirty.size})</button></div>
        <div className="overflow-auto max-h-[52vh]"><table className="min-w-[1450px] w-full text-xs"><thead className="sticky top-0 bg-slate-100 text-slate-500"><tr>{['ID', 'Activity', 'Plan %', 'Actual %', 'Remaining', 'Actual Start', 'Actual Finish', 'Actual Hours', 'Actual Cost', 'Forecast Finish', 'Notes'].map(label => <th key={label} className="text-left px-2 py-2">{label}</th>)}</tr></thead><tbody>{controls.activities.map(row => { const draft = drafts[row.id] || {}; const behind = number(draft.physical_progress_pct) < number(row.planned_progress_pct); return <tr key={row.id} className={`border-t ${dirty.has(row.id) ? 'bg-amber-50' : behind ? 'bg-rose-50/40' : ''}`}><td className="px-2 py-2 font-mono font-semibold">{row.external_id}</td><td className="px-2 max-w-[260px] truncate" title={row.name}>{row.name}</td><td className="px-2 font-semibold">{number(row.planned_progress_pct).toFixed(1)}%</td><td className="px-2"><input disabled={!canEdit} type="number" min="0" max="100" step="0.1" value={draft.physical_progress_pct ?? 0} onChange={event => update(row.id, 'physical_progress_pct', event.target.value)} className="w-20 border rounded px-2 py-1" /></td><td className="px-2"><input disabled={!canEdit} type="number" min="0" step="0.25" value={draft.remaining_duration_days ?? ''} onChange={event => update(row.id, 'remaining_duration_days', event.target.value)} className="w-20 border rounded px-2 py-1" /></td><td className="px-2"><input disabled={!canEdit} type="date" value={draft.actual_start || ''} onChange={event => update(row.id, 'actual_start', event.target.value)} className="border rounded px-1 py-1" /></td><td className="px-2"><input disabled={!canEdit} type="date" value={draft.actual_finish || ''} onChange={event => update(row.id, 'actual_finish', event.target.value)} className="border rounded px-1 py-1" /></td><td className="px-2"><input disabled={!canEdit} type="number" min="0" step="0.25" value={draft.actual_hours ?? 0} onChange={event => update(row.id, 'actual_hours', event.target.value)} className="w-24 border rounded px-2 py-1" /></td><td className="px-2"><input disabled={!canEdit} type="number" min="0" step="0.01" value={draft.actual_cost ?? 0} onChange={event => update(row.id, 'actual_cost', event.target.value)} className="w-28 border rounded px-2 py-1" /></td><td className="px-2"><input disabled={!canEdit} type="date" value={draft.forecast_finish || ''} onChange={event => update(row.id, 'forecast_finish', event.target.value)} className="border rounded px-1 py-1" /></td><td className="px-2"><input disabled={!canEdit} value={draft.notes || ''} onChange={event => update(row.id, 'notes', event.target.value)} className="w-48 border rounded px-2 py-1" /></td></tr> })}</tbody></table></div>
      </section>

      <div className="grid xl:grid-cols-[1.5fr_1fr] gap-4">
        <section className="bg-white border rounded-xl overflow-hidden"><h3 className="font-semibold text-slate-800 px-4 py-3 border-b">WBS Performance</h3><div className="overflow-auto"><table className="w-full min-w-[720px] text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr>{['WBS', 'Progress', 'Planned', 'PV', 'EV', 'AC', 'SV', 'CV'].map(label => <th key={label} className="text-right first:text-left px-3 py-2">{label}</th>)}</tr></thead><tbody>{controls.wbs_breakdown.map(row => <tr key={row.code} className="border-t"><td className="px-3 py-2"><b className="font-mono text-violet-700">{row.code}</b><div className="text-xs text-slate-400">{row.name}</div></td><td className="text-right px-3">{number(row.progress_pct).toFixed(1)}%</td><td className="text-right px-3">{number(row.planned_progress_pct).toFixed(1)}%</td>{['planned_value', 'earned_value', 'actual_cost', 'schedule_variance', 'cost_variance'].map(field => <td key={field} className={`text-right px-3 ${field.includes('variance') && number(row[field]) < 0 ? 'text-rose-600 font-semibold' : ''}`}>{money(row[field])}</td>)}</tr>)}</tbody></table></div></section>
        <section className="bg-white border rounded-xl overflow-hidden"><h3 className="font-semibold text-slate-800 px-4 py-3 border-b">Control Snapshots</h3>{!controls.snapshots?.length ? <div className="p-6 text-center text-sm text-slate-400">No formal snapshots captured yet.</div> : <div className="divide-y">{controls.snapshots.map(row => <div key={row.id} className="px-4 py-3 flex items-center gap-3"><div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center"><Check className="w-4 h-4" /></div><div><b className="text-sm text-slate-700">{row.data_date}</b><div className="text-xs text-slate-400">Progress {number(row.progress_pct).toFixed(1)}% · SPI {ratio(row.spi)} · CPI {ratio(row.cpi)}</div></div></div>)}</div>}</section>
      </div>
    </div>
  )
}

export default ProjectControlsPanel
