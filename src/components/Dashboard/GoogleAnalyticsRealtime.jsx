// ─── GoogleAnalyticsRealtime ─────────────────────────────────────────────────
// Self-contained dashboard widget showing GA4 real-time traffic for the
// configured property. Polls the backend every `pollMs` ms and gracefully
// degrades when credentials aren't configured.
//
// SOFT-CODING — every knob is a prop default; no magic numbers inline.
//   endpoint         REST path appended to API_BASE_URL
//   pollMs           polling interval in milliseconds
//   topRowsLimit     max items rendered per breakdown
//   timeoutMs        per-request timeout
//   adminOnly        when true and user not admin, widget hides itself
// -----------------------------------------------------------------------------

import React, { useEffect, useRef, useState, useCallback } from 'react'
import {
  SignalIcon, GlobeAltIcon, DevicePhoneMobileIcon,
  DocumentTextIcon, ArrowTopRightOnSquareIcon, ArrowPathIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'
import apiClient from '../../services/api.service'

const DEFAULTS = {
  endpoint:     '/marketing-analytics/realtime/',
  pollMs:       30_000,
  topRowsLimit: 5,
  timeoutMs:    12_000,
  adminOnly:    false,
}

const BREAKDOWN_META = {
  top_pages:     { label: 'Top Pages',     Icon: DocumentTextIcon,        accent: 'text-blue-600' },
  top_countries: { label: 'Top Countries', Icon: GlobeAltIcon,            accent: 'text-emerald-600' },
  top_devices:   { label: 'Devices',       Icon: DevicePhoneMobileIcon,   accent: 'text-violet-600' },
  top_sources:   { label: 'Live Screens',  Icon: SignalIcon,              accent: 'text-amber-600' },
}

const formatNumber = (n) => (typeof n === 'number' ? n.toLocaleString() : '0')

const GoogleAnalyticsRealtime = ({
  endpoint     = DEFAULTS.endpoint,
  pollMs       = DEFAULTS.pollMs,
  topRowsLimit = DEFAULTS.topRowsLimit,
  timeoutMs    = DEFAULTS.timeoutMs,
  adminOnly    = DEFAULTS.adminOnly,
  isAdmin      = true,
} = {}) => {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [err,     setErr]     = useState(null)
  const timerRef = useRef(null)

  const url = endpoint

  const fetchData = useCallback(async () => {
    try {
      const resp = await apiClient.get(url, { timeout: timeoutMs })
      setData(resp.data || {})
      setErr(null)
    } catch (e) {
      setErr(e?.response?.data?.detail || e?.message || 'Failed to load analytics')
    } finally {
      setLoading(false)
    }
  }, [url, timeoutMs])

  useEffect(() => {
    fetchData()
    timerRef.current = setInterval(fetchData, pollMs)
    return () => timerRef.current && clearInterval(timerRef.current)
  }, [fetchData, pollMs])

  if (adminOnly && !isAdmin) return null

  const configured  = !!data?.configured
  const activeUsers = data?.active_users ?? 0
  const breakdowns  = data?.breakdowns   ?? {}
  const consoleUrl  = data?.console_url  || 'https://analytics.google.com/'
  const updatedAt   = data?.updated_at ? new Date(data.updated_at * 1000) : null
  const backendErr  = data?.error

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Header */}
      <div
        className="px-4 py-3 border-b border-gray-50 flex items-center gap-2"
        style={{ background: 'linear-gradient(90deg, #fff7ed 0%, white 100%)' }}
      >
        <div className="relative">
          <SignalIcon className="w-4 h-4 text-orange-500" />
          {configured && !backendErr && (
            <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          )}
        </div>
        <span className="text-xs font-bold text-gray-800">Google Analytics — Real-time</span>
        <span className="ml-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700">
          GA4
        </span>
        <button
          onClick={fetchData}
          className="ml-auto p-1 rounded hover:bg-gray-100 transition"
          title="Refresh"
        >
          <ArrowPathIcon className={`w-3.5 h-3.5 text-gray-400 ${loading ? 'animate-spin' : ''}`} />
        </button>
        <a
          href={consoleUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1 rounded hover:bg-gray-100 transition"
          title="Open in Google Analytics"
        >
          <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5 text-gray-400" />
        </a>
      </div>

      {/* Body */}
      <div className="p-4 space-y-3">
        {/* Network/auth error */}
        {err && (
          <div className="flex items-start gap-2 text-[11px] text-red-600 bg-red-50 border border-red-100 rounded-lg p-2">
            <ExclamationTriangleIcon className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            <span className="break-words">{err}</span>
          </div>
        )}

        {/* Not configured */}
        {!err && !configured && (
          <div className="text-[11px] text-gray-600 bg-amber-50 border border-amber-100 rounded-lg p-3 space-y-1">
            <div className="font-semibold text-amber-700 flex items-center gap-1">
              <ExclamationTriangleIcon className="w-3.5 h-3.5" />
              Setup needed
            </div>
            <div className="text-gray-600">
              {backendErr || 'Connect a GA4 service account to display live traffic here.'}
            </div>
            <div className="text-[10px] text-gray-500 mt-1">
              Set <code className="px-1 bg-gray-100 rounded">GA4_CREDENTIALS_JSON</code>
              {' '}and <code className="px-1 bg-gray-100 rounded">GA4_PROPERTY_ID</code> on the backend.
            </div>
          </div>
        )}

        {/* Configured + healthy */}
        {!err && configured && !backendErr && (
          <>
            {/* Active-users KPI */}
            <div className="rounded-xl bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-100 px-4 py-3 flex items-center gap-3">
              <div className="flex-1">
                <div className="text-[10px] font-semibold text-orange-700 uppercase tracking-wide">
                  Active users (last 30 min)
                </div>
                <div className="text-2xl font-bold text-orange-900 leading-tight">
                  {formatNumber(activeUsers)}
                </div>
                {updatedAt && (
                  <div className="text-[9px] text-orange-700/70 mt-0.5">
                    Updated {updatedAt.toLocaleTimeString()}
                  </div>
                )}
              </div>
              <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                <SignalIcon className="w-5 h-5 text-orange-600" />
              </div>
            </div>

            {/* Breakdown grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {Object.entries(BREAKDOWN_META).map(([key, meta]) => {
                const rows = (breakdowns[key] || []).slice(0, topRowsLimit)
                const Icon = meta.Icon
                return (
                  <div key={key} className="border border-gray-100 rounded-xl p-2.5">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Icon className={`w-3.5 h-3.5 ${meta.accent}`} />
                      <span className="text-[10px] font-bold text-gray-700 uppercase tracking-wide">
                        {meta.label}
                      </span>
                    </div>
                    {rows.length === 0 ? (
                      <div className="text-[10px] text-gray-400 italic py-1">No data</div>
                    ) : (
                      <ul className="space-y-1">
                        {rows.map((r, i) => (
                          <li key={i} className="flex items-center justify-between gap-2 text-[10px]">
                            <span className="truncate text-gray-700" title={r.label}>
                              {r.label || '(direct)'}
                            </span>
                            <span className="font-semibold text-gray-900 flex-shrink-0">
                              {formatNumber(r.value)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* Configured but API call failed */}
        {!err && configured && backendErr && (
          <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg p-2">
            {backendErr}
          </div>
        )}
      </div>
    </div>
  )
}

export default GoogleAnalyticsRealtime
