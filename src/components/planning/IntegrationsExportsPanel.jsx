/* eslint-disable react/prop-types */
import { useCallback, useEffect, useState } from 'react'
import {
  CheckCircle2, Clock, Download, FileJson, FileSpreadsheet, Loader2,
  RefreshCw, RotateCcw, Send, Trash2, Webhook, XCircle,
} from 'lucide-react'

import planningIntelligenceService from '../../services/planningIntelligence.service'

const EXPORTS = [
  { format: 'xlsx', title: 'Excel Workbook', description: 'Activities, WBS, logic, resources, controls and governance.', icon: FileSpreadsheet, tone: 'bg-emerald-600' },
  { format: 'xer', title: 'Primavera P6', description: 'P6-compatible XER with dates, logic, float and progress.', icon: Download, tone: 'bg-orange-600' },
  { format: 'json', title: 'Enterprise JSON', description: 'Versioned machine-readable schedule interchange package.', icon: FileJson, tone: 'bg-indigo-600' },
  { format: 'csv', title: 'Activities CSV', description: 'Portable activity register for downstream analysis.', icon: Download, tone: 'bg-slate-700' },
]

const errorText = (error, fallback) => error?.response?.data?.error || error?.message || fallback
const filenamePart = (value, fallback) => String(value || '')
  .replace(/[^A-Za-z0-9_-]+/g, '_')
  .replace(/^[_-]+|[_-]+$/g, '')
  .slice(0, 80) || fallback
const filenameFromDisposition = disposition => {
  const encoded = disposition.match(/filename\*\s*=\s*UTF-8''([^;]+)/i)?.[1]
  if (encoded) {
    try { return decodeURIComponent(encoded).replace(/^"|"$/g, '') } catch { /* use plain filename */ }
  }
  return disposition.match(/filename\s*=\s*"([^"]+)"/i)?.[1]
    || disposition.match(/filename\s*=\s*([^;]+)/i)?.[1]?.trim()
    || ''
}
const statusIcon = status => status === 'succeeded'
  ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
  : status === 'failed' ? <XCircle className="w-4 h-4 text-rose-500" /> : <Clock className="w-4 h-4 text-amber-500" />

const IntegrationsExportsPanel = ({
  projectId, projectName, scheduleCode, versionId, versionNumber, canManage, onNotice,
}) => {
  const [endpoints, setEndpoints] = useState([])
  const [deliveries, setDeliveries] = useState([])
  const [exports, setExports] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [draft, setDraft] = useState({ name: '', target_url: '', export_format: 'json', auth_type: 'hmac_sha256', secret: '', event_types: ['schedule.published'], timeout_seconds: 15 })

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true)
    try {
      const [endpointRows, deliveryRows, exportRows] = await Promise.all([
        planningIntelligenceService.listIntegrationEndpoints(projectId),
        planningIntelligenceService.listIntegrationDeliveries(projectId),
        planningIntelligenceService.listScheduleExportRecords(projectId),
      ])
      setEndpoints(endpointRows)
      setDeliveries(deliveryRows)
      setExports(exportRows)
    } catch (error) {
      onNotice('error', errorText(error, 'Unable to load integrations and exports.'))
    } finally {
      setLoading(false)
    }
  }, [projectId, onNotice])

  useEffect(() => { load() }, [load])

  const download = async format => {
    setBusy(`export-${format}`)
    try {
      const response = await planningIntelligenceService.downloadScheduleExport(versionId, format)
      const disposition = response.headers?.['content-disposition'] || ''
      const exportLabel = format === 'csv' ? 'Activities' : 'Schedule'
      const fallbackFilename = `${filenamePart(projectName, 'Project')}_${filenamePart(scheduleCode, 'Schedule')}_v${versionNumber || versionId}_${exportLabel}.${format}`
      const filename = filenameFromDisposition(disposition) || fallbackFilename
      const url = URL.createObjectURL(response.data)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = filename
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      await load(true)
      onNotice('success', `${filename} downloaded and checksum-audited.`)
    } catch (error) {
      onNotice('error', errorText(error, 'Schedule export failed.'))
    } finally {
      setBusy('')
    }
  }

  const createEndpoint = async event => {
    event.preventDefault()
    setBusy('create')
    try {
      await planningIntelligenceService.createIntegrationEndpoint({
        ...draft, project: Number(projectId), secret: draft.auth_type === 'none' ? undefined : draft.secret,
      })
      setDraft({ name: '', target_url: '', export_format: 'json', auth_type: 'hmac_sha256', secret: '', event_types: ['schedule.published'], timeout_seconds: 15 })
      setShowForm(false)
      await load(true)
      onNotice('success', 'Secure outbound integration configured.')
    } catch (error) {
      onNotice('error', errorText(error, 'Integration could not be created.'))
    } finally {
      setBusy('')
    }
  }

  const publish = async endpoint => {
    setBusy(`publish-${endpoint.id}`)
    try {
      await planningIntelligenceService.publishIntegration(endpoint.id, {
        version: Number(versionId), event_type: 'schedule.published',
      })
      await load(true)
      onNotice('success', `Schedule queued for delivery to ${endpoint.name}.`)
    } catch (error) {
      onNotice('error', errorText(error, 'Integration delivery could not be queued.'))
    } finally {
      setBusy('')
    }
  }

  const remove = async endpoint => {
    if (!window.confirm(`Archive integration "${endpoint.name}"?`)) return
    setBusy(`delete-${endpoint.id}`)
    try {
      await planningIntelligenceService.deleteIntegrationEndpoint(endpoint.id)
      await load(true)
      onNotice('success', 'Integration archived.')
    } catch (error) {
      onNotice('error', errorText(error, 'Integration could not be archived.'))
    } finally {
      setBusy('')
    }
  }

  const retry = async delivery => {
    setBusy(`retry-${delivery.id}`)
    try {
      await planningIntelligenceService.retryIntegrationDelivery(delivery.id)
      await load(true)
      onNotice('success', 'Delivery retry queued.')
    } catch (error) {
      onNotice('error', errorText(error, 'Delivery retry failed.'))
    } finally {
      setBusy('')
    }
  }

  if (loading) return <div className="h-72 flex items-center justify-center text-slate-500"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading integration hub...</div>
  return (
    <div className="p-4 space-y-5 bg-slate-50/60">
      <div className="flex items-center gap-2"><div className="mr-auto"><h2 className="font-bold text-slate-800">Integrations & Exports</h2><p className="text-xs text-slate-500">Audited interchange packages and secure delivery to enterprise systems.</p></div><button onClick={() => load()} className="p-2 border rounded-lg text-slate-500"><RefreshCw className="w-4 h-4" /></button></div>

      <section><div className="mb-2"><h3 className="font-semibold text-slate-700">Version-native exports</h3><p className="text-xs text-slate-400 mt-0.5">Files use the project, schedule and version in their name and save to the browser-configured Downloads location.</p></div><div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">{EXPORTS.map(item => { const Icon = item.icon; return <button key={item.format} onClick={() => download(item.format)} disabled={Boolean(busy)} className="text-left bg-white border rounded-xl p-4 hover:border-violet-300 hover:shadow-sm disabled:opacity-50"><div className={`w-9 h-9 ${item.tone} text-white rounded-lg flex items-center justify-center`}>{busy === `export-${item.format}` ? <Loader2 className="w-5 h-5 animate-spin" /> : <Icon className="w-5 h-5" />}</div><div className="font-semibold text-slate-800 mt-3">{busy === `export-${item.format}` ? 'Preparing file...' : item.title}</div><p className="text-xs text-slate-500 mt-1">{item.description}</p></button> })}</div></section>

      <section className="bg-white border rounded-xl overflow-hidden"><div className="px-4 py-3 border-b flex items-center"><div><h3 className="font-semibold text-slate-800">Outbound integrations</h3><p className="text-xs text-slate-400">HTTPS only · encrypted credentials · signed payloads · idempotent delivery</p></div>{canManage && <button onClick={() => setShowForm(value => !value)} className="ml-auto inline-flex items-center gap-1.5 px-3 py-2 bg-violet-600 text-white rounded-lg text-sm font-semibold"><Webhook className="w-4 h-4" /> Add Endpoint</button>}</div>
        {showForm && <form onSubmit={createEndpoint} className="p-4 bg-violet-50 grid grid-cols-1 md:grid-cols-2 gap-2 border-b"><input required value={draft.name} onChange={event => setDraft(value => ({ ...value, name: event.target.value }))} placeholder="Integration name" className="border rounded-lg px-3 py-2 text-sm" /><input required type="url" value={draft.target_url} onChange={event => setDraft(value => ({ ...value, target_url: event.target.value }))} placeholder="https://example.com/webhook" className="border rounded-lg px-3 py-2 text-sm" /><select value={draft.export_format} onChange={event => setDraft(value => ({ ...value, export_format: event.target.value }))} className="border rounded-lg px-3 py-2 text-sm"><option value="json">Enterprise JSON</option><option value="csv">CSV (base64)</option><option value="xer">Primavera XER (base64)</option></select><select value={draft.auth_type} onChange={event => setDraft(value => ({ ...value, auth_type: event.target.value }))} className="border rounded-lg px-3 py-2 text-sm"><option value="hmac_sha256">HMAC SHA-256</option><option value="bearer">Bearer token</option><option value="none">No authentication</option></select>{draft.auth_type !== 'none' && <input required type="password" value={draft.secret} onChange={event => setDraft(value => ({ ...value, secret: event.target.value }))} placeholder={draft.auth_type === 'bearer' ? 'Bearer token' : 'Signing secret'} className="md:col-span-2 border rounded-lg px-3 py-2 text-sm" />}<button disabled={Boolean(busy)} className="md:col-span-2 bg-violet-600 text-white rounded-lg py-2 text-sm font-semibold">Save Secure Endpoint</button></form>}
        <div className="grid lg:grid-cols-2 gap-3 p-4">{!endpoints.length && <div className="lg:col-span-2 text-sm text-slate-400 text-center py-6">No outbound integrations configured.</div>}{endpoints.map(endpoint => <div key={endpoint.id} className="border rounded-xl p-4"><div className="flex items-start gap-3"><div className="w-9 h-9 bg-violet-100 text-violet-700 rounded-lg flex items-center justify-center"><Webhook className="w-5 h-5" /></div><div className="min-w-0 flex-1"><div className="font-semibold text-slate-800">{endpoint.name}</div><div className="text-xs text-slate-400 truncate" title={endpoint.target_url}>{endpoint.target_url}</div><div className="flex gap-2 mt-2 text-[10px]"><span className="bg-slate-100 rounded px-2 py-1">{endpoint.export_format.toUpperCase()}</span><span className="bg-slate-100 rounded px-2 py-1">{endpoint.auth_type.replaceAll('_', ' ')}</span><span className={endpoint.is_active ? 'text-emerald-600' : 'text-slate-400'}>{endpoint.is_active ? 'Active' : 'Inactive'}</span></div></div></div>{endpoint.last_error && <div className="mt-3 text-xs bg-rose-50 text-rose-600 rounded-lg p-2 line-clamp-2">{endpoint.last_error}</div>}<div className="flex gap-2 mt-3"><button onClick={() => publish(endpoint)} disabled={!canManage || Boolean(busy) || !endpoint.is_active} className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold disabled:opacity-40"><Send className="w-3.5 h-3.5" /> Publish Version</button><button onClick={() => remove(endpoint)} disabled={!canManage || Boolean(busy)} className="ml-auto p-2 text-rose-500 disabled:opacity-30"><Trash2 className="w-4 h-4" /></button></div></div>)}</div>
      </section>

      <div className="grid xl:grid-cols-2 gap-4"><section className="bg-white border rounded-xl overflow-hidden"><h3 className="font-semibold text-slate-800 px-4 py-3 border-b">Delivery history</h3><div className="divide-y max-h-72 overflow-auto">{!deliveries.length && <div className="p-6 text-center text-sm text-slate-400">No deliveries yet.</div>}{deliveries.map(row => <div key={row.id} className="px-4 py-3 flex items-center gap-3">{statusIcon(row.status)}<div className="min-w-0"><div className="text-sm font-semibold text-slate-700">{row.endpoint_name} · {row.event_type}</div><div className="text-xs text-slate-400">{new Date(row.created_at).toLocaleString()} · attempt {row.attempt_count}{row.response_status ? ` · HTTP ${row.response_status}` : ''}</div>{row.error_message && <div className="text-xs text-rose-500 truncate">{row.error_message}</div>}</div>{row.status === 'failed' && canManage && <button onClick={() => retry(row)} className="ml-auto p-2 text-violet-600"><RotateCcw className="w-4 h-4" /></button>}</div>)}</div></section><section className="bg-white border rounded-xl overflow-hidden"><h3 className="font-semibold text-slate-800 px-4 py-3 border-b">Export audit</h3><div className="divide-y max-h-72 overflow-auto">{!exports.length && <div className="p-6 text-center text-sm text-slate-400">No version exports yet.</div>}{exports.map(row => <div key={row.id} className="px-4 py-3"><div className="flex justify-between gap-3"><b className="text-sm text-slate-700 truncate" title={row.filename}>{row.filename}</b><span className="text-xs text-slate-400 shrink-0">{Math.ceil(row.size_bytes / 1024)} KB</span></div><div className="text-[10px] font-mono text-slate-400 mt-1 truncate" title={row.sha256}>SHA-256 {row.sha256}</div></div>)}</div></section></div>
    </div>
  )
}

export default IntegrationsExportsPanel
