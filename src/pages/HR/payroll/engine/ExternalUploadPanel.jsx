/**
 * ExternalUploadPanel — Upload ValueFrame or Sympa XLSX to update payslip data.
 *
 * Displayed inside RunDetail (Draft runs only) before the Deductions/Comparison section.
 * Soft-coded file types come from EXTERNAL_UPLOAD_FILE_TYPES in payrollEngine.config.js.
 * Each upload immediately applies the data to the run's payslips and stores the file in S3.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react'
import * as HeroIcons from '@heroicons/react/24/outline'
import payrollEngineService from '../../../../services/payrollEngine.service'
import { EXTERNAL_UPLOAD_FILE_TYPES } from '../../../../config/payrollEngine.config'

// Soft-coded color classes per file type (Tailwind JIT-safe)
const COLOR_MAP = {
  blue:   { card: 'border-blue-200 bg-blue-50',   btn: 'bg-blue-600 hover:bg-blue-700 text-white', badge: 'bg-blue-100 text-blue-700 border-blue-200' },
  violet: { card: 'border-violet-200 bg-violet-50', btn: 'bg-violet-600 hover:bg-violet-700 text-white', badge: 'bg-violet-100 text-violet-700 border-violet-200' },
}
const DEFAULT_COLOR = { card: 'border-slate-200 bg-slate-50', btn: 'bg-slate-700 hover:bg-slate-800 text-white', badge: 'bg-slate-100 text-slate-700 border-slate-200' }
const colors = (key) => COLOR_MAP[key] || DEFAULT_COLOR

const fmtDate = (iso) => {
  try { return new Date(iso).toLocaleString('en-AE', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) }
  catch { return iso }
}

export default function ExternalUploadPanel({ runId, runEditable, onUploaded, onClose }) {
  const [uploads, setUploads] = useState([])
  const [uploading, setUploading] = useState({})  // { fileType: true/false }
  const [results,   setResults]   = useState({})  // { fileType: result }
  const [errors,    setErrors]    = useState({})  // { fileType: errorMsg }
  const fileRefs = useRef({})

  const loadUploads = useCallback(async () => {
    try {
      const data = await payrollEngineService.listRunUploads(runId)
      setUploads(Array.isArray(data?.results) ? data.results : [])
    } catch { /* silent */ }
  }, [runId])

  useEffect(() => { loadUploads() }, [loadUploads])

  const handleUpload = async (ft) => {
    const file = fileRefs.current[ft.key]?.files?.[0]
    if (!file) {
      setErrors((e) => ({ ...e, [ft.key]: 'Please select a file first.' }))
      return
    }
    setUploading((u) => ({ ...u, [ft.key]: true }))
    setErrors((e) => ({ ...e, [ft.key]: null }))
    setResults((r) => ({ ...r, [ft.key]: null }))
    try {
      const result = await payrollEngineService.uploadExternalFile(runId, file, ft.key)
      setResults((r) => ({ ...r, [ft.key]: result }))
      // Reset file input
      if (fileRefs.current[ft.key]) fileRefs.current[ft.key].value = ''
      await loadUploads()
      onUploaded?.()
    } catch (e) {
      const msg = e?.response?.data?.error || e.message || 'Upload failed.'
      setErrors((er) => ({ ...er, [ft.key]: msg }))
    } finally {
      setUploading((u) => ({ ...u, [ft.key]: false }))
    }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-4">
        <HeroIcons.ArrowUpTrayIcon className="w-4 h-4 text-indigo-600" />
        <h3 className="text-sm font-semibold text-slate-700">Import External Files</h3>
        <span className="text-[10px] uppercase font-medium text-slate-400 ml-2">
          Updates payslip data · Draft only
        </span>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="ml-auto p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600"
            title="Close"
          >
            <HeroIcons.XMarkIcon className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {EXTERNAL_UPLOAD_FILE_TYPES.map((ft) => {
          const cl      = colors(ft.color)
          const busy    = !!uploading[ft.key]
          const result  = results[ft.key]
          const errMsg  = errors[ft.key]

          return (
            <div key={ft.key} className={`rounded-xl border p-4 ${cl.card}`}>
              {/* Header */}
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="text-sm font-semibold text-slate-800">{ft.label}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{ft.description}</div>
                </div>
                <div className="flex flex-wrap gap-1 justify-end">
                  {ft.fields_updated.map((f) => (
                    <span key={f} className={`inline-block px-1.5 py-0.5 rounded text-[10px] border font-medium ${cl.badge}`}>
                      {f.replace('_', ' ')}
                    </span>
                  ))}
                </div>
              </div>

              {/* File input + upload button */}
              {runEditable ? (
                <div className="flex items-center gap-2 mt-3">
                  <input
                    type="file"
                    accept={ft.accept}
                    ref={(el) => { fileRefs.current[ft.key] = el }}
                    disabled={busy}
                    className="flex-1 text-xs text-slate-600 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-medium file:bg-white file:text-slate-700 file:border file:border-slate-300 hover:file:bg-slate-50 disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={() => handleUpload(ft)}
                    disabled={busy}
                    className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md ${cl.btn} disabled:opacity-50`}
                  >
                    {busy
                      ? <HeroIcons.ArrowPathIcon className="w-3.5 h-3.5 animate-spin" />
                      : <HeroIcons.ArrowUpTrayIcon className="w-3.5 h-3.5" />}
                    {busy ? 'Uploading…' : 'Upload'}
                  </button>
                </div>
              ) : (
                <div className="mt-3 text-xs text-slate-400 italic">
                  Run is not in Draft — uploads disabled.
                </div>
              )}

              {/* Result summary */}
              {result && (
                <div className="mt-3 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-xs text-emerald-800">
                  <span className="font-semibold">✓ Applied</span>
                  {' · '}{result.rows_updated} updated · {result.rows_matched} matched
                  {result.unmatched?.length > 0 && (
                    <div className="mt-1 text-amber-700">
                      ⚠ {result.unmatched.length} unmatched: {result.unmatched.slice(0, 5).join(', ')}
                      {result.unmatched.length > 5 && ` +${result.unmatched.length - 5} more`}
                    </div>
                  )}
                </div>
              )}
              {errMsg && (
                <div className="mt-3 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 text-xs text-rose-700">
                  ✗ {errMsg}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Upload history */}
      {uploads.length > 0 && (
        <div className="mt-5">
          <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">Upload History</h4>
          <div className="space-y-1.5">
            {uploads.map((u) => {
              const ft = EXTERNAL_UPLOAD_FILE_TYPES.find((t) => t.key === u.file_type)
              const cl = colors(ft?.color)
              return (
                <div key={u.id} className="flex flex-wrap items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs">
                  <span className={`px-2 py-0.5 rounded-full border font-medium ${cl.badge}`}>{u.file_type_label || u.file_type}</span>
                  <span className="text-slate-700 font-medium truncate max-w-xs">{u.original_filename}</span>
                  <span className="text-slate-400">·</span>
                  <span className="text-slate-600">{u.rows_updated} updated / {u.rows_matched} matched</span>
                  {u.unmatched?.length > 0 && (
                    <span className="text-amber-600">⚠ {u.unmatched.length} unmatched</span>
                  )}
                  <span className="text-slate-400 ml-auto">{fmtDate(u.uploaded_at)} · {u.uploaded_by_name}</span>
                  {u.s3_key && (
                    <span className="text-emerald-600" title={`S3: ${u.s3_key}`}>
                      <HeroIcons.CloudArrowUpIcon className="w-3.5 h-3.5 inline" />
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
