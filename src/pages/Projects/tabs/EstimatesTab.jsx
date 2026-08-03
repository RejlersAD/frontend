import React, { useEffect, useRef, useState } from 'react'
import { ArrowUpTrayIcon, CheckCircleIcon } from '@heroicons/react/24/outline'

import * as PC from '../../../services/projectControl.service'
import {
  ESTIMATE_KIND_OPTIONS, ESTIMATE_STATUS_TONES,
} from '../../../config/projectControl.config'
import VarianceTable from '../components/VarianceTable'

export default function EstimatesTab({ project }) {
  const [estimates, setEstimates] = useState([])
  const [variance, setVariance] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState(null)
  const [groupBy, setGroupBy] = useState('wbs')
  const [importKind, setImportKind] = useState('estimate')
  const fileInputRef = useRef(null)

  const reload = () => {
    setLoading(true)
    setError(null)
    Promise.allSettled([
      PC.listEstimates(project.id),
      PC.getEstimateVariance(project.id, { group_by: groupBy }),
    ]).then(([estRes, varRes]) => {
      if (estRes.status === 'fulfilled') {
        const data = estRes.value
        setEstimates(Array.isArray(data) ? data : (data?.results || []))
      } else {
        setError(estRes.reason?.message || 'Failed to load estimates')
      }
      if (varRes.status === 'fulfilled') setVariance(varRes.value)
    }).finally(() => setLoading(false))
  }

  useEffect(() => { reload() /* eslint-disable-next-line */ }, [project.id, groupBy])

  const onImport = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadResult(null)
    try {
      const result = await PC.importBoqExcel(project.id, file, { kind: importKind })
      setUploadResult(result.summary)
      reload()
    } catch (err) {
      setUploadResult({ error: err?.response?.data?.error || err?.message || 'Import failed' })
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const onApprove = (id) => {
    PC.approveEstimate(id).then(reload).catch(() => {})
  }

  if (loading) return <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-500">Loading estimates…</div>
  if (error)   return <div className="bg-white border border-rose-200 text-rose-700 rounded-xl p-6">{error}</div>

  return (
    <div className="space-y-6">
      {/* Import card */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-500 mb-1">Kind</label>
            <select
              value={importKind}
              onChange={(e) => setImportKind(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
            >
              {ESTIMATE_KIND_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <label className="inline-flex items-center gap-2 cursor-pointer px-4 py-2 rounded-lg
                            bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700
                            disabled:opacity-50">
            <ArrowUpTrayIcon className="h-4 w-4" />
            {uploading ? 'Importing…' : 'Import BOQ (Excel)'}
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={onImport}
              disabled={uploading}
            />
          </label>
          {uploadResult && (
            <div className="text-xs">
              {uploadResult.error ? (
                <span className="text-rose-600">{uploadResult.error}</span>
              ) : (
                <span className="text-emerald-700">
                  Imported {uploadResult.imported_rows} rows · skipped {uploadResult.skipped_rows} · total {uploadResult.total_amount} {uploadResult.currency}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Estimates list */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800">Estimate Versions</h3>
          <span className="text-xs text-slate-500">{estimates.length} record(s)</span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 uppercase text-[11px] tracking-wider">
              <tr>
                <th className="px-4 py-2 text-left">Title</th>
                <th className="px-4 py-2 text-left">Kind</th>
                <th className="px-4 py-2 text-right">Version</th>
                <th className="px-4 py-2 text-right">Lines</th>
                <th className="px-4 py-2 text-right">Total</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-left">Created</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {estimates.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-6 text-center text-slate-500">No estimates yet — import a BOQ above.</td></tr>
              )}
              {estimates.map((e) => (
                <tr key={e.id}>
                  <td className="px-4 py-2 text-slate-800">{e.title || '—'}</td>
                  <td className="px-4 py-2 text-slate-600">{e.kind_display || e.kind}</td>
                  <td className="px-4 py-2 text-right">v{e.version}</td>
                  <td className="px-4 py-2 text-right">{e.line_item_count}</td>
                  <td className="px-4 py-2 text-right font-medium">
                    {Number(e.total_amount).toLocaleString()} {e.currency}
                  </td>
                  <td className="px-4 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded ${ESTIMATE_STATUS_TONES[e.status] || 'bg-slate-100 text-slate-600'}`}>
                      {e.status_display || e.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-500">
                    {new Date(e.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {e.status === 'draft' && (
                      <button
                        onClick={() => onApprove(e.id)}
                        className="text-xs inline-flex items-center gap-1 text-emerald-700 hover:underline"
                      >
                        <CheckCircleIcon className="h-3.5 w-3.5" /> Approve
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Variance */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800">Estimate Variance</h3>
          <div className="text-xs">
            <label className="text-slate-500 mr-2">Group by:</label>
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value)}
              className="border border-slate-300 rounded px-2 py-1"
            >
              <option value="wbs">WBS code</option>
              <option value="discipline">Discipline</option>
            </select>
          </div>
        </div>
        <VarianceTable report={variance} />
      </div>
    </div>
  )
}
