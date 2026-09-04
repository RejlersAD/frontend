import { useEffect, useState } from 'react'
import * as HeroIcons from '@heroicons/react/24/outline'
import hrCoreService from '../../services/hrCore.service'
import EmployeeTabLoading from './EmployeeTabLoading'

const metrics = [
  ['service_requests', 'Requests', HeroIcons.InboxStackIcon],
  ['goals', 'Active goals', HeroIcons.FlagIcon],
  ['reviews', 'Reviews', HeroIcons.ChartBarSquareIcon],
  ['overtime', 'Overtime', HeroIcons.ClockIcon],
]

export default function UnifiedHRWorkspacePanel() {
  const [workspace, setWorkspace] = useState(null)
  const [privacy, setPrivacy] = useState([])
  const [graph, setGraph] = useState([])
  const [busy, setBusy] = useState('')
  const [notice, setNotice] = useState('')

  const load = () => hrCoreService.getWorkspace().then(setWorkspace)
  useEffect(() => {
    load().catch(() => setNotice('Your HR workspace could not be loaded.'))
    hrCoreService.listPrivacyRequests().then((data) => setPrivacy(Array.isArray(data) ? data : (data?.results || []))).catch(() => {})
  }, [])
  useEffect(() => {
    if (workspace?.capabilities?.hr) hrCoreService.listGraphConnections().then((data) => setGraph(Array.isArray(data) ? data : (data?.results || []))).catch(() => {})
  }, [workspace?.capabilities?.hr])

  const submitPrivacy = async (type) => {
    if (!workspace?.employee?.id) return
    setBusy(`privacy-${type}`); setNotice('')
    try {
      const item = await hrCoreService.createPrivacyRequest({ employee: workspace.employee.id, request_type: type, details: 'Submitted from employee self-service.' })
      setPrivacy((current) => [item, ...current]); setNotice(`Privacy request ${item.request_number} submitted.`)
    } catch { setNotice('The privacy request could not be submitted.') } finally { setBusy('') }
  }

  const runGraph = async (connection, action) => {
    setBusy(`${connection.id}-${action}`); setNotice('')
    try {
      const result = await ({ test: hrCoreService.testGraphConnection, entra: hrCoreService.syncEntra, sharepoint: hrCoreService.syncSharePointPolicies }[action])(connection.id)
      setNotice(action === 'test' ? (result.connected ? 'Microsoft Graph connection verified.' : result.error) : `${action === 'entra' ? 'Entra users' : 'SharePoint policies'} synchronized.`)
      const data = await hrCoreService.listGraphConnections(); setGraph(Array.isArray(data) ? data : (data?.results || []))
    } catch (error) { setNotice(error?.response?.data?.detail || 'Microsoft Graph operation failed.') } finally { setBusy('') }
  }

  if (!workspace) return <EmployeeTabLoading message="Loading your unified workspace…" />
  return (
    <div className="space-y-5">
      {notice && <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">{notice}</div>}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-blue-600">Unified self-service</p><h2 className="mt-1 text-xl font-bold text-slate-950">My work</h2></div><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Permission scoped</span></div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{metrics.map(([key, label, Icon]) => <div key={key} className="rounded-xl border border-slate-200 bg-slate-50 p-4"><Icon className="h-5 w-5 text-blue-600" /><div className="mt-3 text-2xl font-bold text-slate-900">{workspace.my_work?.[key] || 0}</div><p className="text-xs text-slate-500">{label}</p></div>)}</div>
      </section>
      {workspace.capabilities?.manager && <section className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm"><p className="text-xs font-bold uppercase tracking-[.14em] text-amber-700">Manager hub</p><h2 className="mt-1 text-lg font-bold text-slate-950">Team approval inbox</h2><div className="mt-4 grid gap-3 sm:grid-cols-5">{[['employees','Direct reports'], ...metrics.map(([k,l]) => [k,l])].map(([key,label]) => <div key={key} className="rounded-xl bg-amber-50 p-3"><div className="text-xl font-bold text-amber-900">{workspace.manager_queue?.[key] || 0}</div><p className="text-xs text-amber-700">{label}</p></div>)}</div></section>}
      <section className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><HeroIcons.LockClosedIcon className="h-6 w-6 text-violet-600" /><h3 className="mt-2 font-bold text-slate-900">Privacy center</h3><p className="mt-1 text-sm text-slate-500">Request access, correction, restriction, deletion review, or a portable export of your HR data.</p><div className="mt-4 flex flex-wrap gap-2">{['access','correction','export','restriction','deletion'].map((type) => <button key={type} disabled={!!busy} onClick={() => submitPrivacy(type)} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold capitalize text-slate-700 hover:border-violet-400 disabled:opacity-50">{busy === `privacy-${type}` ? 'Submitting…' : type}</button>)}</div><p className="mt-4 text-xs text-slate-400">{privacy.length} request(s) visible in your account</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><HeroIcons.SquaresPlusIcon className="h-6 w-6 text-blue-600" /><h3 className="mt-2 font-bold text-slate-900">Connected employee services</h3><p className="mt-1 text-sm text-slate-500">Leave, payroll, attendance, requests, goals, schedules and policy support use the same employee identity and manager hierarchy.</p></div>
      </section>
      {workspace.capabilities?.hr && <section className="rounded-2xl border border-blue-200 bg-white p-5 shadow-sm"><p className="text-xs font-bold uppercase tracking-[.14em] text-blue-700">HR administration</p><h2 className="mt-1 text-lg font-bold text-slate-950">Microsoft 365 integration</h2>{!graph.length ? <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">No Microsoft Graph connection has been configured. Add the tenant and application IDs in HR administration; keep the client secret in the server environment.</p> : graph.map((connection) => <div key={connection.id} className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4"><div><p className="font-semibold text-slate-900">{connection.name}</p><p className="text-xs text-slate-500">{connection.last_status} · Last sync {connection.last_sync_at ? new Date(connection.last_sync_at).toLocaleString() : 'never'}</p></div><div className="flex flex-wrap gap-2"><button onClick={() => runGraph(connection, 'test')} className="rounded-lg border px-3 py-2 text-xs font-semibold">Test</button><button onClick={() => runGraph(connection, 'entra')} disabled={!connection.entra_sync_enabled || !!busy} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">Sync Entra</button><button onClick={() => runGraph(connection, 'sharepoint')} disabled={!connection.sharepoint_enabled || !!busy} className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">Sync policies</button></div></div>)}</section>}
    </div>
  )
}
