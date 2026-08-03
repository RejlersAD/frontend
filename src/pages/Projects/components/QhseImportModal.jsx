import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  XMarkIcon, ArrowPathIcon, SparklesIcon, CheckCircleIcon,
  ArrowDownTrayIcon, ExclamationTriangleIcon, KeyIcon, GlobeAltIcon,
} from '@heroicons/react/24/outline'

import {
  QHSE_IMPORT_CONFIG, PROJECT_COPY,
} from '../../../config/projectControl.config'
import * as PC from '../../../services/projectControl.service'

const { previewColumns, joinKey, sources, defaultSourceId } = QHSE_IMPORT_CONFIG

const normaliseKey = (v) => String(v ?? '').trim().toLowerCase()

// Session-scoped storage so a tab refresh doesn't drop the token, but it never
// outlives the browser session.
const TOKEN_STORAGE_KEY = 'qhse_import_token'

export default function QhseImportModal({
  open,
  existingProjects = [],
  onClose,
  onImported,             // async ({ created, updated, failed }) => void
}) {
  const [sourceId, setSourceId] = useState(defaultSourceId)
  const [token, setToken] = useState(
    () => sessionStorage.getItem(TOKEN_STORAGE_KEY) || ''
  )
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [selected, setSelected] = useState(() => new Set())
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [summary, setSummary] = useState(null)

  const source = useMemo(
    () => sources.find((s) => s.id === sourceId) || sources[0],
    [sourceId]
  )

  // Index of existing Project codes for "Already imported" detection
  const existingIndex = useMemo(() => {
    const m = new Map()
    for (const p of existingProjects) {
      m.set(normaliseKey(p?.[joinKey.projectField]), p)
    }
    return m
  }, [existingProjects])

  const fetchRows = useCallback(async () => {
    // Remote sources need a token before we even try.
    if (source.requiresToken && !token.trim()) {
      setRows([])
      setSelected(new Set())
      setError(null)
      return
    }
    setLoading(true)
    setError(null)
    setSummary(null)
    try {
      const data = await PC.listQhseProjects({
        baseUrl: source.baseUrl,
        token:   source.requiresToken ? token : undefined,
      })
      setRows(data)
      // Default-select rows that are NEW (not yet imported)
      const initial = new Set()
      for (const r of data) {
        const key = normaliseKey(r?.[joinKey.qhseField])
        if (!existingIndex.has(key)) initial.add(key)
      }
      setSelected(initial)
    } catch (e) {
      if (e?.message === 'auth_failed') {
        setError(PROJECT_COPY.importQhseAuthError)
      } else if (e?.message === 'cors_or_network') {
        setError(PROJECT_COPY.importQhseCorsError)
      } else {
        setError(e?.response?.data?.detail || e?.message || 'Failed to load QHSE projects.')
      }
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [existingIndex, source, token])

  useEffect(() => {
    if (open) fetchRows()
  }, [open, fetchRows])

  // Persist token per browser session
  useEffect(() => {
    if (token) sessionStorage.setItem(TOKEN_STORAGE_KEY, token)
    else sessionStorage.removeItem(TOKEN_STORAGE_KEY)
  }, [token])

  if (!open) return null

  const toggleRow = (key) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
  }

  const toggleAll = () => {
    if (selected.size === rows.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(rows.map((r) => normaliseKey(r?.[joinKey.qhseField]))))
    }
  }

  const handleRun = async () => {
    if (!selected.size) return
    const toImport = rows.filter((r) => selected.has(normaliseKey(r?.[joinKey.qhseField])))
    setRunning(true)
    setProgress({ done: 0, total: toImport.length })
    setSummary(null)
    try {
      const result = await PC.importQhseRows(
        toImport,
        existingProjects,
        ({ done, total }) => setProgress({ done, total }),
      )
      setSummary(result)
      await onImported?.(result)
    } catch (e) {
      setError(e?.message || 'Import failed.')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-5xl max-h-[90vh] overflow-hidden bg-white rounded-2xl shadow-2xl ring-1 ring-slate-200 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-indigo-50 via-violet-50 to-fuchsia-50">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className="inline-flex items-center justify-center h-10 w-10 rounded-lg bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 text-white shadow-md shadow-indigo-500/20">
                <SparklesIcon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-slate-900">{PROJECT_COPY.importQhseTitle}</h2>
                <p className="text-xs text-slate-500 mt-0.5">{PROJECT_COPY.importQhseSubtitle}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-white/60"
              aria-label="Close"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          {/* Source picker + optional bearer token (soft-coded from config) */}
          <div className="mt-4 flex flex-col md:flex-row md:items-end gap-3">
            <label className="flex-1 min-w-0">
              <span className="block text-[11px] uppercase tracking-wider text-slate-500 mb-1 font-medium">
                <GlobeAltIcon className="h-3.5 w-3.5 inline-block -mt-0.5 mr-1" />
                {PROJECT_COPY.importQhseSource}
              </span>
              <select
                value={sourceId}
                onChange={(e) => setSourceId(e.target.value)}
                disabled={loading || running}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                {sources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}{s.baseUrl ? ` — ${s.baseUrl}` : ''}
                  </option>
                ))}
              </select>
            </label>
            {source.requiresToken && (
              <label className="flex-[2] min-w-0">
                <span className="block text-[11px] uppercase tracking-wider text-slate-500 mb-1 font-medium">
                  <KeyIcon className="h-3.5 w-3.5 inline-block -mt-0.5 mr-1" />
                  {PROJECT_COPY.importQhseToken}
                </span>
                <input
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9…"
                  disabled={loading || running}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 font-mono focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
                <span className="text-[11px] text-slate-400 mt-0.5 block">{PROJECT_COPY.importQhseTokenHelp}</span>
              </label>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto px-6 py-4">
          {loading ? (
            <div className="py-16 text-center text-slate-500">
              <ArrowPathIcon className="h-6 w-6 mx-auto mb-2 animate-spin text-indigo-500" />
              {PROJECT_COPY.importQhseLoading}
            </div>
          ) : error ? (
            <div className="py-16 text-center text-rose-600 max-w-xl mx-auto">
              <ExclamationTriangleIcon className="h-6 w-6 mx-auto mb-2" />
              <p>{error}</p>
              <div className="mt-3">
                <button
                  type="button"
                  onClick={fetchRows}
                  className="text-sm font-medium text-indigo-600 hover:underline"
                >
                  Try again
                </button>
              </div>
            </div>
          ) : source.requiresToken && !token.trim() ? (
            <div className="py-16 text-center text-slate-500">
              <KeyIcon className="h-6 w-6 mx-auto mb-2 text-indigo-400" />
              Paste a bearer token above to load projects from {source.label}.
            </div>
          ) : rows.length === 0 ? (
            <div className="py-16 text-center text-slate-500">{PROJECT_COPY.importQhseEmpty}</div>
          ) : (
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-slate-500 border-b border-slate-200">
                  <th className="px-2 py-2 w-10">
                    <input
                      type="checkbox"
                      checked={selected.size === rows.length}
                      onChange={toggleAll}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </th>
                  {previewColumns.map((c) => (
                    <th key={c.key} className="px-2 py-2 font-medium">{c.label}</th>
                  ))}
                  <th className="px-2 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const key = normaliseKey(row?.[joinKey.qhseField])
                  const exists = existingIndex.has(key)
                  const checked = selected.has(key)
                  return (
                    <tr
                      key={key || row.id}
                      className={`border-b border-slate-100 ${checked ? 'bg-indigo-50/40' : 'hover:bg-slate-50'}`}
                    >
                      <td className="px-2 py-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleRow(key)}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                      </td>
                      {previewColumns.map((c) => (
                        <td key={c.key} className="px-2 py-2 text-slate-700 truncate max-w-[220px]" title={String(row[c.key] ?? '')}>
                          {row[c.key] ?? <span className="text-slate-300">—</span>}
                        </td>
                      ))}
                      <td className="px-2 py-2">
                        {exists ? (
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 ring-1 ring-amber-200">
                            {PROJECT_COPY.importQhseExisting}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200">
                            {PROJECT_COPY.importQhseNew}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}

          {/* Summary panel */}
          {summary && (
            <div className="mt-4 p-3 rounded-lg bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100 text-sm">
              <CheckCircleIcon className="h-5 w-5 inline-block mr-1.5 -mt-0.5" />
              {PROJECT_COPY.importQhseDone(summary.created, summary.updated, summary.failed)}
              {summary.errors?.length > 0 && (
                <details className="mt-2 text-xs text-rose-700">
                  <summary className="cursor-pointer">View {summary.errors.length} error(s)</summary>
                  <ul className="mt-1 list-disc pl-5 space-y-0.5">
                    {summary.errors.slice(0, 10).map((e, i) => (
                      <li key={i}>
                        <span className="font-mono">{e.row?.[joinKey.qhseField] || '—'}</span>:{' '}
                        {typeof e.error === 'string' ? e.error : JSON.stringify(e.error)}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50/60 flex items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            {running
              ? `${progress.done} / ${progress.total} processed`
              : PROJECT_COPY.importQhseSelected(selected.size)}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchRows}
              disabled={loading || running}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg disabled:opacity-40"
            >
              <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleRun}
              disabled={running || !selected.size || loading}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 hover:from-indigo-500 hover:via-violet-500 hover:to-fuchsia-500 shadow-md shadow-indigo-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ArrowDownTrayIcon className={`h-4 w-4 ${running ? 'animate-bounce' : ''}`} />
              {running ? PROJECT_COPY.importQhseRunning : PROJECT_COPY.importQhseRun(selected.size)}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
