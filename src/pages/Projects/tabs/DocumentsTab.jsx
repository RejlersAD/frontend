import React, { useEffect, useRef, useState } from 'react'
import { ArrowUpTrayIcon, ArrowDownTrayIcon, TrashIcon } from '@heroicons/react/24/outline'

import * as PC from '../../../services/projectControl.service'
import { DOCUMENT_KIND_OPTIONS } from '../../../config/projectControl.config'

function fmtBytes(n) {
  if (!n) return '—'
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let v = Number(n)
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++ }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${units[i]}`
}

export default function DocumentsTab({ project }) {
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadKind, setUploadKind] = useState('other')
  const fileRef = useRef(null)

  const reload = () => {
    setLoading(true)
    setError(null)
    PC.listDocuments(project.id)
      .then((data) => setDocuments(Array.isArray(data) ? data : (data?.results || [])))
      .catch((e) => setError(e?.response?.data?.error || e?.message || 'Failed to load documents'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { reload() /* eslint-disable-next-line */ }, [project.id])

  const onUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      await PC.uploadDocument(project.id, file, { kind: uploadKind, title: file.name })
      reload()
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Upload failed')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const onDownload = async (doc) => {
    try {
      const res = await PC.presignDocumentDownload(doc.id)
      if (res?.download_url) {
        window.open(res.download_url, '_blank', 'noopener')
      }
    } catch (err) {
      setError('Could not generate download link.')
    }
  }

  const onDelete = async (doc) => {
    if (!window.confirm(`Delete ${doc.original_filename || doc.title}?`)) return
    try {
      await PC.deleteDocument(doc.id)
      reload()
    } catch (err) {
      setError('Delete failed.')
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-500 mb-1">Document Kind</label>
            <select
              value={uploadKind}
              onChange={(e) => setUploadKind(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
            >
              {DOCUMENT_KIND_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <label className="inline-flex items-center gap-2 cursor-pointer px-4 py-2 rounded-lg
                            bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700
                            disabled:opacity-50">
            <ArrowUpTrayIcon className="h-4 w-4" />
            {uploading ? 'Uploading…' : 'Upload Document'}
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              onChange={onUpload}
              disabled={uploading}
            />
          </label>
          <p className="text-xs text-slate-500">Files are stored privately in S3 when enabled, or local media otherwise.</p>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-3 text-sm">{error}</div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800">Project Documents</h3>
          <span className="text-xs text-slate-500">{documents.length} file(s)</span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 uppercase text-[11px] tracking-wider">
              <tr>
                <th className="px-4 py-2 text-left">Title</th>
                <th className="px-4 py-2 text-left">Kind</th>
                <th className="px-4 py-2 text-left">Filename</th>
                <th className="px-4 py-2 text-right">Size</th>
                <th className="px-4 py-2 text-left">Uploaded By</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-left">Date</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && <tr><td colSpan={8} className="px-4 py-6 text-center text-slate-500">Loading…</td></tr>}
              {!loading && documents.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-6 text-center text-slate-500">No documents yet — upload above.</td></tr>
              )}
              {documents.map((d) => (
                <tr key={d.id}>
                  <td className="px-4 py-2 text-slate-800 max-w-xs truncate">{d.title || '—'}</td>
                  <td className="px-4 py-2 text-slate-600">{d.kind_display || d.kind}</td>
                  <td className="px-4 py-2 text-slate-600 max-w-xs truncate">{d.original_filename}</td>
                  <td className="px-4 py-2 text-right">{fmtBytes(d.size_bytes)}</td>
                  <td className="px-4 py-2 text-xs text-slate-500">{d.uploaded_by_name || '—'}</td>
                  <td className="px-4 py-2 text-xs">
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600">{d.parse_status_display || d.parse_status}</span>
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-500">{new Date(d.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-2 text-right">
                    <div className="inline-flex gap-2">
                      <button
                        onClick={() => onDownload(d)}
                        className="text-xs inline-flex items-center gap-1 text-indigo-600 hover:underline"
                      >
                        <ArrowDownTrayIcon className="h-3.5 w-3.5" /> Download
                      </button>
                      <button
                        onClick={() => onDelete(d)}
                        className="text-xs inline-flex items-center gap-1 text-rose-600 hover:underline"
                      >
                        <TrashIcon className="h-3.5 w-3.5" /> Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
