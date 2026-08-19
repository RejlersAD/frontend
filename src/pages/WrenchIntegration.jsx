import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useSelector } from 'react-redux'
import { isUserAdmin } from '../utils/rbac.utils'
import wrenchService from '../services/wrench.service'
import {
  WrenchScrewdriverIcon,
  LinkIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  KeyIcon,
  GlobeAltIcon,
  ArrowsRightLeftIcon,
  DocumentTextIcon,
  FolderIcon,
  UsersIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  MagnifyingGlassIcon,
  TableCellsIcon,
  LockClosedIcon,
  ServerIcon,
  UserCircleIcon,
  Cog6ToothIcon,
  CloudArrowUpIcon,
  StopCircleIcon,
  ArrowDownTrayIcon,
} from '@heroicons/react/24/outline'

// ─── Constants ───────────────────────────────────────────────────────────────

const SYNC_DIRECTIONS = [
  {
    value:       'wrench_to_radai',
    label:       'Wrench → RADAI',
    shortLabel:  'Pull',
    description: 'Pull projects and documents from Wrench into RADAI.',
    icon:        '⬇️',
    badge:       'Import',
    // Visual tokens — change here to restyle, never hardcode below
    gradient:    'from-blue-500 to-indigo-600',
    ring:        'ring-blue-400/50',
    activeBg:    'bg-blue-50 border-blue-400',
    activeText:  'text-blue-700',
    activeBadge: 'bg-blue-100 text-blue-700',
    iconBg:      'bg-gradient-to-br from-blue-500 to-indigo-600',
    checkColor:  'text-blue-500',
  },
  {
    value:       'radai_to_wrench',
    label:       'RADAI → Wrench',
    shortLabel:  'Push',
    description: 'Push RADAI analysis results back to Wrench.',
    icon:        '⬆️',
    badge:       'Export',
    gradient:    'from-emerald-500 to-teal-600',
    ring:        'ring-emerald-400/50',
    activeBg:    'bg-emerald-50 border-emerald-400',
    activeText:  'text-emerald-700',
    activeBadge: 'bg-emerald-100 text-emerald-700',
    iconBg:      'bg-gradient-to-br from-emerald-500 to-teal-600',
    checkColor:  'text-emerald-500',
  },
  {
    value:       'wrench_to_s3',
    label:       'Wrench → S3',
    shortLabel:  'S3 Export',
    description: 'Export Wrench data to your AWS S3 bucket (batch or real-time).',
    icon:        '☁️',
    badge:       'AWS S3',
    gradient:    'from-orange-500 to-amber-500',
    ring:        'ring-orange-400/50',
    activeBg:    'bg-orange-50 border-orange-400',
    activeText:  'text-orange-700',
    activeBadge: 'bg-orange-100 text-orange-700',
    iconBg:      'bg-gradient-to-br from-orange-500 to-amber-500',
    checkColor:  'text-orange-500',
  },
]

const ENTITY_TYPES = [
  { value: 'all', label: 'All Entities', icon: ArrowsRightLeftIcon },
  { value: 'project', label: 'Projects', icon: FolderIcon },
  { value: 'document', label: 'Documents', icon: DocumentTextIcon },
  { value: 'transmittal', label: 'Transmittals', icon: ArrowsRightLeftIcon },
  { value: 'user', label: 'Users', icon: UsersIcon },
]

const STATUS_STYLES = {
  success: 'bg-green-100 text-green-800 border border-green-200',
  failed: 'bg-red-100 text-red-800 border border-red-200',
  in_progress: 'bg-blue-100 text-blue-800 border border-blue-200',
  pending: 'bg-yellow-100 text-yellow-800 border border-yellow-200',
  partial: 'bg-orange-100 text-orange-800 border border-orange-200',
}

const STATUS_ICONS = {
  success: CheckCircleIcon,
  failed: XCircleIcon,
  in_progress: ArrowPathIcon,
  pending: ClockIcon,
  partial: ExclamationTriangleIcon,
}

// ─── Sub-components ──────────────────────────────────────────────────────────

const StatusBadge = ({ status }) => {
  const Icon = STATUS_ICONS[status] || ClockIcon
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLES[status] || ''}`}>
      <Icon className={`w-3 h-3 ${status === 'in_progress' ? 'animate-spin' : ''}`} />
      {status?.replace('_', ' ')}
    </span>
  )
}

const Alert = ({ type = 'info', message }) => {
  const styles = {
    success: 'bg-green-50 border-green-200 text-green-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
  }
  const Icon = type === 'success' ? CheckCircleIcon : type === 'error' ? XCircleIcon :
    type === 'warning' ? ExclamationTriangleIcon : InformationCircleIcon
  return (
    <div className={`flex items-start gap-3 p-4 rounded-lg border ${styles[type]}`}>
      <Icon className="w-5 h-5 shrink-0 mt-0.5" />
      <p className="text-sm">{message}</p>
    </div>
  )
}

// ─── Soft-coded: minimum token length for basic sanity check (matches backend)
const _MIN_TOKEN_LENGTH = 32

// ─── Token Injection Section ──────────────────────────────────────────────────
// Allows pasting a pre-shared token from the Wrench team directly, bypassing
// username/password login. The rolling-token refresh from each API response
// automatically keeps the token current once injected.

const TokenInjectionSection = ({ onSaved }) => {
  const [open, setOpen]       = useState(false)
  const [token, setToken]     = useState('')
  const [saving, setSaving]   = useState(false)
  const [alert, setAlert]     = useState(null)

  const handleSave = async () => {
    const trimmed = token.replace(/\s+/g, '')   // strip all whitespace (shared tokens often contain newlines)
    if (trimmed.length < _MIN_TOKEN_LENGTH) {
      setAlert({ type: 'error', message: `Token appears too short (minimum ${_MIN_TOKEN_LENGTH} characters).` })
      return
    }
    setSaving(true)
    setAlert(null)
    try {
      const res = await wrenchService.injectToken(trimmed)
      setAlert({ type: 'success', message: res.data?.message || 'Token saved.' })
      setToken('')
      onSaved?.()
    } catch (err) {
      setAlert({ type: 'error', message: err.response?.data?.detail || 'Failed to save token.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-6 mb-6 border border-amber-200 rounded-xl overflow-hidden">
      {/* Collapsible header */}
      <button
        type="button"
        onClick={() => { setOpen((v) => !v); setAlert(null) }}
        className="w-full flex items-center justify-between px-4 py-3 bg-amber-50 hover:bg-amber-100 transition text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-amber-800">
          <KeyIcon className="w-4 h-4 text-amber-600" />
          Inject Pre-shared Token
          <span className="text-xs font-normal text-amber-600">(use when Wrench team shares a token directly)</span>
        </span>
        {open
          ? <ChevronUpIcon className="w-4 h-4 text-amber-500" />
          : <ChevronDownIcon className="w-4 h-4 text-amber-500" />}
      </button>

      {open && (
        <div className="p-4 bg-white space-y-3">
          <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
            <InformationCircleIcon className="w-4 h-4 shrink-0 mt-0.5 text-blue-500" />
            <p>
              Paste the full token string below (spaces and line breaks are stripped automatically).
              Once saved, all Wrench API calls bypass the normal login and use this token directly.
              The rolling-token mechanism in each Wrench response keeps it refreshed.
            </p>
          </div>

          {alert && <Alert type={alert.type} message={alert.message} />}

          <textarea
            value={token}
            onChange={(e) => setToken(e.target.value)}
            rows={4}
            placeholder="Paste the Wrench session token here…"
            className="w-full px-3 py-2 text-xs font-mono border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-400 focus:border-amber-400 outline-none transition resize-none"
          />

          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">
              {token.replace(/\s+/g, '').length > 0
                ? `${token.replace(/\s+/g, '').length} characters (whitespace stripped)`
                : 'Paste token above'}
            </span>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || token.replace(/\s+/g, '').length < _MIN_TOKEN_LENGTH}
              className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:opacity-50 text-white text-sm font-semibold rounded-lg shadow-sm transition-all duration-200"
            >
              {saving ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <KeyIcon className="w-4 h-4" />}
              {saving ? 'Saving…' : 'Save Token'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Configuration Panel ─────────────────────────────────────────────────────

const ConfigPanel = ({ config, onSaved, onVerify }) => {
  const [form, setForm] = useState({
    base_url: config?.base_url || '',
    svc_url: config?.svc_url || '',
    server_id: config?.server_id ?? 1,
    login_name: config?.login_name || '',
    password: '',           // always blank – write-only, never returned by API
    is_password_encrypted: config?.is_password_encrypted ?? 0,
    otp: '',                // never persisted server-side; sent only at login time
    language: config?.language || '',
    time_zone_id: config?.time_zone_id || '',
    workstation_name: config?.workstation_name ?? 'RADAI',
    organization_name: config?.organization_name || '',
    is_active: true,
  })
  const [saving, setSaving] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [alert, setAlert] = useState(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Auto-detect state for SVC URL probing
  const [detecting, setDetecting] = useState(false)
  const [detectResult, setDetectResult] = useState(null)  // { recommended, candidates }

  const handleChange = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }))

  const handleAutoDetect = async () => {
    if (!form.base_url) {
      setAlert({ type: 'error', message: 'Enter the Wrench Server URL first, then click Auto-Detect.' })
      return
    }
    setDetecting(true)
    setDetectResult(null)
    setAlert(null)
    try {
      const res = await wrenchService.discoverSvcUrl({
        base_url: form.base_url,
        svc_url: '',  // force probing of all candidates, ignore any saved svc_url
      })
      setDetectResult(res.data)
      if (res.data.recommended) {
        setForm((prev) => ({ ...prev, svc_url: res.data.recommended }))
        setAlert({
          type: 'success',
          message: `Auto-detected: ${res.data.recommended}. Click Save to persist.`,
        })
      } else {
        setAlert({
          type: 'error',
          message: 'No reachable DocumentSearch host found. See the candidate list below to confirm with your Wrench admin.',
        })
      }
    } catch (err) {
      setAlert({
        type: 'error',
        message: err.response?.data?.detail || 'Auto-detect failed. Check server logs.',
      })
    } finally {
      setDetecting(false)
    }
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.password && !config) {
      setAlert({ type: 'error', message: 'Password is required for new configurations.' })
      return
    }
    setSaving(true)
    setAlert(null)
    try {
      const payload = { ...form }
      if (!payload.password) delete payload.password  // keep existing encrypted password on update
      await wrenchService.saveConfig(payload)
      setAlert({ type: 'success', message: 'Configuration saved successfully.' })
      setForm((prev) => ({ ...prev, password: '' }))  // clear password from component state
      onSaved()
    } catch (err) {
      const msg = err.response?.data?.detail
        || Object.values(err.response?.data || {}).flat().join(' ')
        || 'Failed to save configuration.'
      setAlert({ type: 'error', message: msg })
    } finally {
      setSaving(false)
    }
  }

  const handleVerify = async () => {
    setVerifying(true)
    setAlert(null)
    const result = await onVerify()
    setAlert({
      type: result.success ? 'success' : 'error',
      message: result.message,
    })
    setVerifying(false)
  }

  const inputClass =
    'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition'

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-200/80 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-5 bg-gradient-to-r from-slate-800 via-slate-700 to-indigo-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center ring-1 ring-white/20">
            <WrenchScrewdriverIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-white">Connection Settings</h3>
            <p className="text-xs text-slate-300/80">Wrench REST API endpoint &amp; credentials</p>
          </div>
        </div>
        {config?.connection_verified && (
          <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-300 bg-emerald-900/30 border border-emerald-500/30 px-3 py-1.5 rounded-full">
            <CheckCircleIcon className="w-4 h-4" /> Verified
          </span>
        )}
      </div>

        <div className="absolute inset-0 bg-gradient-to-br from-indigo-700/5 to-blue-600/5 rounded-2xl pointer-events-none" />
        {/* Security notice */}
      <div className="mx-6 mt-5">
        <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <ShieldCheckIcon className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <p className="text-xs text-blue-700">
            Passwords are encrypted at rest using Fernet symmetric encryption. Session tokens are
            refreshed with every API call (rolling token). Credentials are never logged or returned.
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="p-6 space-y-4">
        {alert && <Alert type={alert.type} message={alert.message} />}

        {/* Base URL */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            <GlobeAltIcon className="w-4 h-4 inline mr-1 text-gray-400" />
            Wrench WebAPI Server URL <span className="text-red-500">*</span>
          </label>
          <input
            type="url"
            value={form.base_url}
            onChange={handleChange('base_url')}
            placeholder="https://your-org.wrenchproject.com"
            required
            className={inputClass}
          />
          <p className="text-xs text-gray-400 mt-1">Must use HTTPS. Used for login and document operations.</p>
        </div>

        {/* SVC URL (optional) — with Auto-Detect */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-medium text-gray-700">
              <GlobeAltIcon className="w-4 h-4 inline mr-1 text-gray-400" />
              Document Search Service URL
              <span className="ml-1 text-xs text-gray-400 font-normal">(optional)</span>
            </label>
            <button
              type="button"
              onClick={handleAutoDetect}
              disabled={detecting || !form.base_url}
              className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 disabled:opacity-50 text-white transition shadow-sm"
              title="Probe common Wrench SVC URL patterns derived from the Server URL"
            >
              {detecting
                ? <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" />
                : <MagnifyingGlassIcon className="w-3.5 h-3.5" />}
              {detecting ? 'Probing…' : 'Auto-Detect'}
            </button>
          </div>
          <input
            type="url"
            value={form.svc_url}
            onChange={handleChange('svc_url')}
            placeholder="https://rejlers.wrenchsp.com/WrenchService_Rejlers_Live/SVC"
            className={inputClass}
          />
          <p className="text-xs text-gray-400 mt-1">
            Leave blank if DocumentSearch runs on the same host as the WebAPI. Use Auto-Detect to probe common patterns.
            <br />
            <span className="text-gray-500">
              Tip: pasting the full AtomSVC metadata URL (e.g. <code className="font-mono">…/SVC/AtomSVC.svc/</code>)
              is fine — the system trims it automatically.
            </span>
          </p>

          {/* Probe results — clickable candidates */}
          {detectResult && (
            <div className="mt-2 border border-gray-200 rounded-lg overflow-hidden text-xs">
              <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 font-medium text-gray-600">
                Probed {detectResult.candidates.length} candidate{detectResult.candidates.length === 1 ? '' : 's'}
                {detectResult.recommended && (
                  <span className="ml-2 text-emerald-600">
                    · Best match: <span className="font-mono">{detectResult.recommended}</span>
                  </span>
                )}
              </div>
              <ul className="divide-y divide-gray-100 max-h-44 overflow-y-auto">
                {detectResult.candidates.map((c, i) => (
                  <li
                    key={`${c.url}-${i}`}
                    className={`flex items-center justify-between gap-2 px-3 py-1.5 ${
                      c.reachable ? 'bg-emerald-50/40' : 'bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          c.reachable ? 'bg-emerald-500' : 'bg-gray-300'
                        }`}
                      />
                      <span className="font-mono text-[11px] truncate" title={c.url}>{c.url}</span>
                      <span className="text-gray-400 text-[10px] shrink-0">{c.note}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, svc_url: c.url }))}
                      className="px-2 py-0.5 text-[11px] rounded bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium transition shrink-0"
                    >
                      Use
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Server ID + Login Name (row) */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <ServerIcon className="w-4 h-4 inline mr-1 text-gray-400" />
              Server ID <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="1"
              value={form.server_id}
              onChange={(e) => setForm((p) => ({ ...p, server_id: parseInt(e.target.value, 10) || 1 }))}
              placeholder="1"
              required
              className={inputClass}
            />
            <p className="text-xs text-gray-400 mt-1">Wrench SERVER_ID for login</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <UserCircleIcon className="w-4 h-4 inline mr-1 text-gray-400" />
              Login Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.login_name}
              onChange={handleChange('login_name')}
              placeholder="ADMIN"
              required
              className={inputClass}
              autoComplete="username"
            />
          </div>
        </div>

        {/* Password */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            <LockClosedIcon className="w-4 h-4 inline mr-1 text-gray-400" />
            Password {!config && <span className="text-red-500">*</span>}
            {config && <span className="text-gray-400 font-normal"> (leave blank to keep existing)</span>}
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={form.password}
              onChange={handleChange('password')}
              placeholder={config ? '••••••••••••••••' : 'Enter Wrench account password'}
              className={`${inputClass} pr-20`}
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        {/* Organisation Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Organisation Name</label>
          <input
            type="text"
            value={form.organization_name}
            onChange={handleChange('organization_name')}
            placeholder="e.g. Rejlers Abu Dhabi"
            className={inputClass}
          />
        </div>

        {/* ── Advanced / Optional Login Parameters ── */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 text-sm font-medium text-gray-700 transition"
          >
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 4a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
              Advanced Login Parameters
              <span className="text-xs text-gray-400 font-normal">(optional – from SmartProject API spec)</span>
            </span>
            {showAdvanced
              ? <ChevronUpIcon className="w-4 h-4 text-gray-400" />
              : <ChevronDownIcon className="w-4 h-4 text-gray-400" />}
          </button>

          {showAdvanced && (
            <div className="p-4 space-y-4 bg-white border-t border-gray-200">

              {/* IS_PASSWORD_ENCRYPTED */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  IS_PASSWORD_ENCRYPTED
                </label>
                <select
                  value={form.is_password_encrypted}
                  onChange={(e) => setForm((p) => ({ ...p, is_password_encrypted: Number(e.target.value) }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition"
                >
                  <option value={0}>0 – Plain-text password (default)</option>
                  <option value={1}>1 – Pre-encrypted password</option>
                </select>
                <p className="text-xs text-gray-400 mt-1">
                  Set to 1 only if the Wrench server expects a pre-hashed password.
                </p>
              </div>

              {/* OTP */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  OTP <span className="text-gray-400 font-normal">(one-time password)</span>
                </label>
                <input
                  type="text"
                  value={form.otp}
                  onChange={handleChange('otp')}
                  placeholder="Leave blank if MFA is not enabled"
                  className={inputClass}
                  autoComplete="one-time-code"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Required only if your Wrench server enforces MFA via GenerateOTP.
                </p>
              </div>

              {/* Language + Timezone (row) */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    LANGUAGE
                  </label>
                  <input
                    type="text"
                    value={form.language}
                    onChange={handleChange('language')}
                    placeholder="e.g. en-US"
                    className={inputClass}
                  />
                  <p className="text-xs text-gray-400 mt-1">Leave blank for server default.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    TIME_ZONE_ID
                  </label>
                  <input
                    type="text"
                    value={form.time_zone_id}
                    onChange={handleChange('time_zone_id')}
                    placeholder="e.g. Asia/Dubai"
                    className={inputClass}
                  />
                  <p className="text-xs text-gray-400 mt-1">Leave blank for server default.</p>
                </div>
              </div>

              {/* Workstation Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  WORKSTATION_NAME
                </label>
                <input
                  type="text"
                  value={form.workstation_name}
                  onChange={handleChange('workstation_name')}
                  placeholder="RADAI"
                  className={inputClass}
                />
                <p className="text-xs text-gray-400 mt-1">
                  Client identifier sent to Wrench on login. Defaults to "RADAI".
                </p>
              </div>

            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-slate-800 to-slate-700 hover:from-slate-700 hover:to-slate-600 disabled:opacity-50 text-white text-sm font-semibold rounded-xl shadow-md shadow-slate-400/20 transition-all duration-200"
          >
            {saving ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <LinkIcon className="w-4 h-4" />}
            {saving ? 'Saving…' : 'Save Configuration'}
          </button>

          {config && (
            <button
              type="button"
              onClick={handleVerify}
              disabled={verifying}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl shadow-md shadow-green-400/20 transition-all duration-200"
            >
              {verifying ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <CheckCircleIcon className="w-4 h-4" />}
              {verifying ? 'Testing…' : 'Test Connection'}
            </button>
          )}
        </div>
      </form>

      {/* Last verified */}
      {config?.last_verified_at && (
        <div className="px-6 pb-4 text-xs text-gray-400 flex items-center gap-1">
          <ClockIcon className="w-3.5 h-3.5" />
          Last verified: {new Date(config.last_verified_at).toLocaleString()}
        </div>
      )}

      {/* ── Pre-shared Token Injection ─────────────────────────────────────── */}
      {config && <TokenInjectionSection onSaved={() => {}} />}
    </div>
  )
}

// ─── Sync Panel ───────────────────────────────────────────────────────────────

// Direction value that maps to the dedicated S3 Export tab — kept soft-coded so a
// rename here is the only change needed if the value ever changes.
const _S3_SYNC_DIRECTION = 'wrench_to_s3'

const SyncPanel = ({ logs, onTrigger, onGoToS3Tab }) => {
  const [direction, setDirection] = useState('wrench_to_radai')
  const [entityType, setEntityType] = useState('all')
  const [syncing, setSyncing] = useState(false)
  const [alert, setAlert] = useState(null)
  const [showDetails, setShowDetails] = useState(null)

  const isS3Direction = direction === _S3_SYNC_DIRECTION

  const handleSync = async () => {
    // S3 export is handled by the dedicated S3 Export tab, not this sync endpoint
    if (isS3Direction) {
      onGoToS3Tab?.()
      return
    }
    setSyncing(true)
    setAlert(null)
    try {
      await onTrigger(direction, entityType)
      setAlert({ type: 'success', message: 'Sync completed. Logs updated below.' })
    } catch (err) {
      const msg = err.response?.data?.detail || 'Sync failed. Check the log below.'
      setAlert({ type: 'error', message: msg })
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Trigger card */}
      <div className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-200 border border-gray-200/80 overflow-hidden">
        <div className="px-6 py-5 bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center ring-1 ring-white/20">
              <ArrowsRightLeftIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Data Synchronisation</h3>
              <p className="text-xs text-blue-100/80">Pull or push data between RADAI and Wrench</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {alert && <Alert type={alert.type} message={alert.message} />}

          {/* Direction selector — 3-column card grid */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-3 flex items-center gap-2">
              <span className="w-1 h-4 rounded-full bg-gradient-to-b from-blue-500 to-indigo-600 inline-block" />
              Sync Direction
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {SYNC_DIRECTIONS.map((d) => {
                const isActive = direction === d.value
                return (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() => setDirection(d.value)}
                    className={`relative group p-5 rounded-2xl border-2 text-left transition-all duration-200 overflow-hidden focus:outline-none focus-visible:ring-4 ${
                      isActive
                        ? `${d.activeBg} shadow-md ${d.ring} ring-2`
                        : 'border-gray-100 bg-white hover:border-gray-200 hover:shadow-md hover:-translate-y-0.5'
                    }`}
                  >
                    {/* Background shimmer on active */}
                    {isActive && (
                      <div className={`absolute inset-0 bg-gradient-to-br ${d.gradient} opacity-[0.06] pointer-events-none`} />
                    )}

                    {/* Icon orb */}
                    <div className={`w-10 h-10 rounded-xl mb-3 flex items-center justify-center text-base shadow-sm transition-transform duration-200 group-hover:scale-110 ${
                      isActive ? d.iconBg : 'bg-gray-100'
                    }`}>
                      <span>{d.icon}</span>
                    </div>

                    {/* Label row */}
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`text-sm font-bold transition-colors duration-150 ${
                        isActive ? d.activeText : 'text-gray-800'
                      }`}>{d.label}</span>
                      {isActive && (
                        <CheckCircleIcon className={`w-4 h-4 shrink-0 ${d.checkColor}`} />
                      )}
                    </div>

                    {/* Description */}
                    <p className="text-xs text-gray-500 leading-relaxed group-hover:text-gray-600 transition-colors duration-150">
                      {d.description}
                    </p>

                    {/* Badge */}
                    <span className={`inline-block mt-3 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full transition-colors duration-150 ${
                      isActive ? d.activeBadge : 'bg-gray-100 text-gray-400'
                    }`}>
                      {d.badge}
                    </span>

                    {/* Bottom accent bar */}
                    <div className={`absolute bottom-0 left-0 h-0.5 bg-gradient-to-r ${d.gradient} transition-all duration-300 ${
                      isActive ? 'w-full' : 'w-0 group-hover:w-full'
                    }`} />
                  </button>
                )
              })}
            </div>
          </div>

          {/* Entity selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Entity Type</label>
            <div className="flex flex-wrap gap-2">
              {ENTITY_TYPES.map((e) => (
                <button
                  key={e.value}
                  type="button"
                  onClick={() => setEntityType(e.value)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition ${
                    entityType === e.value
                      ? 'bg-slate-800 text-white border-slate-800'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-slate-400'
                  }`}
                >
                  <e.icon className="w-3.5 h-3.5" />
                  {e.label}
                </button>
              ))}
            </div>
          </div>

          {/* S3 direction info banner */}
          {isS3Direction && (
            <div className="flex items-start gap-3 p-4 rounded-lg bg-orange-50 border border-orange-200 text-sm">
              <CloudArrowUpIcon className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-orange-800">Use the S3 Export tab for this direction</p>
                <p className="text-orange-700 mt-0.5">Wrench → AWS S3 supports both batch and real-time export with dedicated controls. Click below to go there.</p>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={handleSync}
            disabled={syncing}
            className={`flex items-center gap-2 px-6 py-2.5 disabled:opacity-50 text-white text-sm font-semibold rounded-xl shadow-md transition-all duration-200 ${
              isS3Direction
                ? 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 shadow-orange-400/25'
                : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-blue-400/25'
            }`}
          >
            {syncing ? (
              <ArrowPathIcon className="w-4 h-4 animate-spin" />
            ) : isS3Direction ? (
              <CloudArrowUpIcon className="w-4 h-4" />
            ) : (
              <ArrowsRightLeftIcon className="w-4 h-4" />
            )}
            {syncing ? 'Syncing…' : isS3Direction ? 'Go to S3 Export →' : 'Run Sync'}
          </button>
        </div>
      </div>

      {/* Sync log table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-slate-50 to-white flex items-center justify-between">
          <h3 className="font-semibold text-gray-800 flex items-center gap-2">
            <ClockIcon className="w-5 h-5 text-indigo-400" />
            Sync History
          </h3>
          <span className="text-xs font-medium text-gray-400 bg-gray-100/80 px-2.5 py-0.5 rounded-full">{logs.length} logs</span>
        </div>

        {logs.length === 0 ? (
          <div className="p-10 text-center text-sm text-gray-400">
            No sync logs yet. Run your first sync above.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {logs.map((log) => (
              <div key={log.id} className="px-6 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <StatusBadge status={log.status} />
                    <span className="text-sm text-gray-700">
                      {log.direction.replace('_', ' → ')} · {log.entity_type}
                    </span>
                    {log.records_synced > 0 && (
                      <span className="text-xs text-gray-400">
                        {log.records_synced} / {log.records_requested} records
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400">
                      {new Date(log.started_at).toLocaleString()}
                    </span>
                    {log.duration_seconds != null && (
                      <span className="text-xs text-gray-400">{log.duration_seconds.toFixed(1)}s</span>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowDetails(showDetails === log.id ? null : log.id)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      {showDetails === log.id ? (
                        <ChevronUpIcon className="w-4 h-4" />
                      ) : (
                        <ChevronDownIcon className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
                {showDetails === log.id && (
                  <div className="mt-2 p-3 bg-gray-50 rounded-lg text-xs text-gray-600 space-y-1">
                    {log.triggered_by_email && (
                      <p><span className="font-medium">Triggered by:</span> {log.triggered_by_email}</p>
                    )}
                    {log.error_message && (
                      <p className="text-red-600"><span className="font-medium">Error:</span> {log.error_message}</p>
                    )}
                    {Object.keys(log.sync_details || {}).length > 0 && (
                      <pre className="bg-white rounded p-2 overflow-x-auto">
                        {JSON.stringify(log.sync_details, null, 2)}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Documents & Transmittals Panel ──────────────────────────────────────────

// Soft-coded column priority list — matched against whatever fields the Wrench API returns.
// First keys found in the data win; remaining slots are filled from any extra fields.
const TRANSMITTAL_COL_PRIORITY = [
  // ── Fields confirmed from this Wrench instance (highest priority) ──
  { key: 'TRANS_REF_NO',       label: 'Trans. Ref No.' },
  { key: 'TRANS_ID',           label: 'Trans. ID' },
  { key: 'ORDER_NO',           label: 'Order No.' },
  { key: 'ORDER_DESCRIPTION',  label: 'Order Description' },
  { key: 'TRANS_DESC',         label: 'Description' },
  { key: 'DIST_LIST_DESC',     label: 'Distribution List' },
  { key: 'PROJECT_ID',         label: 'Project ID' },
  // ── Generic fallbacks for other Wrench instances ──
  { key: 'TRANS_NO',           label: 'Trans. No.' },
  { key: 'TRANSMITTAL_NO',     label: 'Trans. No.' },
  { key: 'NO',                 label: 'No.' },
  { key: 'TRANS_TITLE',        label: 'Title' },
  { key: 'TITLE',              label: 'Title' },
  { key: 'DESCRIPTION',        label: 'Description' },
  { key: 'TRANS_DATE',         label: 'Date' },
  { key: 'ISSUED_DATE',        label: 'Date' },
  { key: 'DATE',               label: 'Date' },
  { key: 'SENDER',             label: 'Sender' },
  { key: 'FROM',               label: 'From' },
  { key: 'RECIPIENT',          label: 'Recipient' },
  { key: 'TO',                 label: 'To' },
  { key: 'STATUS',             label: 'Status' },
  { key: 'TRANS_STATUS',       label: 'Status' },
  { key: 'DOC_COUNT',          label: 'Docs' },
  { key: 'DOCUMENT_COUNT',     label: 'Docs' },
  { key: 'PROJECT',            label: 'Project' },
  { key: 'PROJECT_NAME',       label: 'Project' },
]

// Soft-coded limits
const MAX_TABLE_COLS = 7
const TRANSMITTAL_PAGE_SIZE = 100

// Soft-coded: the field in a transmittal row that links it to its documents in Wrench.
// Wrench uses ORDER_NO as the common join key between GetTransmittalList and GetDocumentList.
const TRANS_DOC_LINK_FIELD = 'ORDER_NO'

// Soft-coded column priority for the per-transmittal document sub-table.
// First keys found in the returned data win; remaining slots fill from any extra fields.
const TRANS_DOC_COL_PRIORITY = [
  { key: 'DOC_NO',            label: 'Doc No.' },
  { key: 'DOCUMENT_NO',       label: 'Doc No.' },       // alias used by some instances
  { key: 'DOC_DESCRIPTION',   label: 'Description' },
  { key: 'DISCIPLINE',        label: 'Discipline' },
  { key: 'REVISION',          label: 'Rev.' },
  { key: 'REVISION_NO',       label: 'Rev.' },
  { key: 'STATUS',            label: 'Status' },
  { key: 'DOC_STATUS',        label: 'Status' },
  { key: 'WF_TEAM_NAME',      label: 'WF Team' },
  { key: 'CREATED_BY_USER',   label: 'Created By' },
]
// Soft-coded: max document columns shown in the sub-table
const TRANS_DOC_MAX_COLS = 5

// Soft-coded document columns for the SearchObject API result
const DOC_COLUMNS = [
  { key: 'DOC_NO',           label: 'Doc No.' },
  { key: 'DOC_DESCRIPTION',  label: 'Description' },
  { key: 'ORDER_NO',         label: 'Order' },
  { key: 'GENEALOGY_STRING', label: 'Path / Genealogy' },
  { key: 'CREATED_BY_USER',  label: 'Created By' },
  { key: 'WF_TEAM_NAME',     label: 'WF Team' },
  { key: 'IDOC_ID',          label: 'IDOC' },
]

// Soft-coded: the document field used as the primary download identifier.
// Change here if your Wrench instance uses a different key for the file ID.
const _IDOC_KEY = 'IDOC_ID'
// Soft-coded: candidate field names for a human-readable document number (used as filename hint).
const _DOC_NO_KEYS = ['DOC_NO', 'DOCUMENT_NO']

// ─── Project / Folder Browser — soft-coded constants ─────────────────────────
// All field names, separators, and limits are configured here so the browser
// adapts to different Wrench deployments without code changes.
const _PROJECT_KEY        = 'ORDER_NO'  // primary project / order identifier
const _PROJECT_DESC_KEYS  = ['ORDER_DESCRIPTION', 'PROJECT_DESCRIPTION', 'PROJECT_NAME']
const _GENEALOGY_KEYS     = ['GENEALOGY_STRING', 'FOLDER_PATH', 'PATH', 'FOLDER']
// Possible transmittal-ID field names across Wrench deployments
const _TRANS_ID_KEYS      = ['TRANS_ID', 'TRANS_REF_NO', 'TRANSMITTAL_ID', 'ID']
// Path-separator characters seen across Wrench installations
const _PATH_SEPARATOR_RE  = /\s*[/\\>|]\s*/
// Number of documents fetched when entering the Browse view (so all projects/folders
// have a chance to appear). Capped to the backend's page_size limit (200).
const _BROWSE_FETCH_SIZE  = 200
// Sentinel label shown when a document carries no ORDER_NO
const _UNASSIGNED_PROJECT = '(Unassigned)'

// Pick the first non-empty value of `keys` from a document row.
const _pickFirst = (doc, keys) => {
  for (const k of keys) {
    const v = doc?.[k]
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim()
  }
  return ''
}

// Split a raw genealogy / path string into clean segments.
// Handles "/", "\", ">", "|" as separators with optional surrounding whitespace.
function parseGenealogyPath(raw) {
  if (!raw) return []
  return String(raw).split(_PATH_SEPARATOR_RE).map((s) => s.trim()).filter(Boolean)
}

/**
 * Build a hierarchical tree from a flat list of Wrench documents.
 * Tree shape:
 *   { projects: {
 *       <order_no>: {
 *         order_no, order_description,
 *         folders: { <name>: { name, folders:{...}, documents:[...], totalDocs } },
 *         documents: [...],     // documents directly at the project root
 *         totalDocs,            // recursive count
 *       }
 *   } }
 * Pure / side-effect free → safe to call inside useMemo.
 */
function buildProjectTree(documents) {
  const root = { projects: {} }
  if (!Array.isArray(documents)) return root
  for (const doc of documents) {
    const projectNo   = _pickFirst(doc, [_PROJECT_KEY]) || _UNASSIGNED_PROJECT
    const projectDesc = _pickFirst(doc, _PROJECT_DESC_KEYS)
    let proj = root.projects[projectNo]
    if (!proj) {
      proj = {
        order_no: projectNo,
        order_description: projectDesc,
        folders: {},
        documents: [],
        totalDocs: 0,
      }
      root.projects[projectNo] = proj
    }
    proj.totalDocs += 1

    // Parse folder segments from the genealogy field
    let segments = parseGenealogyPath(_pickFirst(doc, _GENEALOGY_KEYS))
    // Drop a leading segment when it duplicates the project description (common in Wrench)
    if (
      segments.length &&
      projectDesc &&
      segments[0].toLowerCase() === projectDesc.toLowerCase()
    ) {
      segments = segments.slice(1)
    }
    // Drop a leading segment when it duplicates the ORDER_NO
    if (segments.length && segments[0] === projectNo) {
      segments = segments.slice(1)
    }

    if (segments.length === 0) {
      proj.documents.push(doc)
      continue
    }
    // Walk into nested folders, creating nodes on the fly
    let cursor = proj
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i]
      if (!cursor.folders[seg]) {
        cursor.folders[seg] = { name: seg, folders: {}, documents: [], totalDocs: 0 }
      }
      cursor.folders[seg].totalDocs += 1
      if (i === segments.length - 1) {
        cursor.folders[seg].documents.push(doc)
      }
      cursor = cursor.folders[seg]
    }
  }
  return root
}

/**
 * Resolve a node in the tree from a breadcrumb-path array.
 *   []                          → root (project list)
 *   ['5900737']                 → that project node
 *   ['5900737', 'Engineering']  → a folder inside the project
 */
function resolveTreeNode(root, pathArr) {
  if (!root) return null
  if (!pathArr || pathArr.length === 0) return { kind: 'root', node: root }
  const proj = root.projects[pathArr[0]]
  if (!proj) return null
  let node = proj
  for (let i = 1; i < pathArr.length; i++) {
    node = node.folders[pathArr[i]]
    if (!node) return null
  }
  return { kind: pathArr.length === 1 ? 'project' : 'folder', node }
}

// ─── Project Browser View — purely presentational ─────────────────────────────
// Receives a built tree + current breadcrumb path. Renders projects → folders →
// documents progressively. The same `onDownload` / `downloading` props used by
// the flat table are reused, so download behaviour is unchanged.
const ProjectBrowserView = ({ tree, path, onPathChange, onDownload, downloading }) => {
  const resolved = resolveTreeNode(tree, path)

  if (!resolved) {
    return (
      <div className="p-10 text-center text-sm text-gray-400">
        Path not found in current results. <button
          type="button" className="text-blue-600 hover:underline"
          onClick={() => onPathChange([])}
        >Return to project list</button>
      </div>
    )
  }

  const projectsList = Object.values(tree.projects).sort((a, b) =>
    String(a.order_no).localeCompare(String(b.order_no), undefined, { numeric: true })
  )

  return (
    <div className="p-4 space-y-4">
      {/* Breadcrumb */}
      <div className="flex flex-wrap items-center gap-1.5 text-sm">
        <button
          type="button"
          onClick={() => onPathChange([])}
          className={`flex items-center gap-1 px-2 py-1 rounded-md transition ${
            path.length === 0
              ? 'bg-blue-100 text-blue-700 font-semibold'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <FolderIcon className="w-4 h-4" /> All Projects
          <span className="ml-1 text-xs text-gray-400">({projectsList.length})</span>
        </button>
        {path.map((seg, i) => (
          <React.Fragment key={`${seg}-${i}`}>
            <span className="text-gray-300">›</span>
            <button
              type="button"
              onClick={() => onPathChange(path.slice(0, i + 1))}
              className={`px-2 py-1 rounded-md transition truncate max-w-[260px] ${
                i === path.length - 1
                  ? 'bg-blue-100 text-blue-700 font-semibold'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
              title={seg}
            >
              {seg}
            </button>
          </React.Fragment>
        ))}
      </div>

      {/* ROOT — project grid */}
      {resolved.kind === 'root' && (
        projectsList.length === 0 ? (
          <div className="p-10 text-center text-sm text-gray-400">No projects returned by Wrench for this filter.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {projectsList.map((proj) => {
              const folderCount = Object.keys(proj.folders).length
              return (
                <button
                  type="button"
                  key={proj.order_no}
                  onClick={() => onPathChange([proj.order_no])}
                  className="text-left group p-4 bg-gradient-to-br from-white to-blue-50/40 border border-gray-200 rounded-xl hover:border-blue-400 hover:shadow-md transition"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shrink-0">
                        <FolderIcon className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-mono font-bold text-gray-900 group-hover:text-blue-700 transition truncate">
                          {proj.order_no}
                        </p>
                        <p className="text-xs text-gray-500 truncate" title={proj.order_description}>
                          {proj.order_description || <span className="italic text-gray-300">No description</span>}
                        </p>
                      </div>
                    </div>
                    <ChevronDownIcon className="w-4 h-4 text-gray-400 -rotate-90 shrink-0" />
                  </div>
                  <div className="mt-3 flex items-center gap-3 text-xs">
                    <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-medium">
                      {proj.totalDocs} doc{proj.totalDocs === 1 ? '' : 's'}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">
                      {folderCount} folder{folderCount === 1 ? '' : 's'}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        )
      )}

      {/* PROJECT or FOLDER — sub-folders + leaf documents */}
      {resolved.kind !== 'root' && (() => {
        const node     = resolved.node
        const subFolders = Object.values(node.folders).sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { numeric: true })
        )
        const docs = node.documents || []
        const isProjectRoot = resolved.kind === 'project'

        return (
          <div className="space-y-4">
            {/* Project header (only when at project root) */}
            {isProjectRoot && (
              <div className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-lg">
                <p className="text-xs text-blue-600 font-medium uppercase tracking-wider">Project</p>
                <p className="font-mono font-bold text-lg text-blue-900">{node.order_no}</p>
                {node.order_description && (
                  <p className="text-sm text-blue-700">{node.order_description}</p>
                )}
                <p className="text-xs text-blue-600 mt-1">
                  {node.totalDocs} total document{node.totalDocs === 1 ? '' : 's'} ·
                  {' '}{subFolders.length} top-level folder{subFolders.length === 1 ? '' : 's'} ·
                  {' '}{docs.length} at project root
                </p>
              </div>
            )}

            {/* Sub-folder grid */}
            {subFolders.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Folders ({subFolders.length})
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                  {subFolders.map((folder) => (
                    <button
                      type="button"
                      key={folder.name}
                      onClick={() => onPathChange([...path, folder.name])}
                      className="flex items-center gap-2 p-2.5 text-left bg-white border border-gray-200 rounded-lg hover:border-amber-400 hover:bg-amber-50/40 transition group"
                    >
                      <div className="w-8 h-8 rounded-md bg-amber-100 group-hover:bg-amber-200 flex items-center justify-center shrink-0 transition">
                        <FolderIcon className="w-4 h-4 text-amber-700" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-800 truncate" title={folder.name}>
                          {folder.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {folder.totalDocs} doc{folder.totalDocs === 1 ? '' : 's'}
                        </p>
                      </div>
                      <ChevronDownIcon className="w-4 h-4 text-gray-300 group-hover:text-amber-500 -rotate-90 shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Documents at the current folder/project level */}
            {docs.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Documents ({docs.length})
                </p>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-xs">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          {DOC_COLUMNS.filter((c) => c.key !== 'ORDER_NO' && c.key !== 'GENEALOGY_STRING').map((col) => (
                            <th key={col.key} className="px-3 py-2 text-left font-semibold text-gray-600 whitespace-nowrap">{col.label}</th>
                          ))}
                          <th className="px-3 py-2 text-left font-semibold text-gray-600 whitespace-nowrap">Download</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {docs.map((doc, idx) => {
                          const idocId = doc[_IDOC_KEY]
                          const isDl = Boolean(idocId && downloading[idocId])
                          return (
                            <tr key={`${idocId || idx}`} className="hover:bg-blue-50/40 transition">
                              {DOC_COLUMNS.filter((c) => c.key !== 'ORDER_NO' && c.key !== 'GENEALOGY_STRING').map((col) => (
                                <td key={col.key} className="px-3 py-2 text-gray-700 max-w-[220px] truncate" title={doc[col.key] || ''}>
                                  {doc[col.key] || <span className="text-gray-300">&mdash;</span>}
                                </td>
                              ))}
                              <td className="px-3 py-2">
                                {idocId ? (
                                  <button
                                    type="button"
                                    onClick={() => onDownload(doc)}
                                    disabled={isDl}
                                    className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 border border-blue-300 rounded-md hover:bg-blue-50 disabled:opacity-50 transition whitespace-nowrap"
                                  >
                                    {isDl
                                      ? <ArrowPathIcon className="w-3 h-3 animate-spin" />
                                      : <ArrowDownTrayIcon className="w-3 h-3" />}
                                    {isDl ? '…' : 'Download'}
                                  </button>
                                ) : (
                                  <span className="text-gray-300">&mdash;</span>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Empty state */}
            {subFolders.length === 0 && docs.length === 0 && (
              <div className="p-10 text-center text-sm text-gray-400">
                This folder is empty in the current search result set.
              </div>
            )}
          </div>
        )
      })()}
    </div>
  )
}

// Derive display columns from the first data row using the priority list
function deriveColumns(rows, priorityList, maxCols) {
  if (!rows || rows.length === 0) return []
  const available = new Set(Object.keys(rows[0]))
  const cols = []
  for (const c of priorityList) {
    if (available.has(c.key) && !cols.find((x) => x.key === c.key)) {
      cols.push(c)
      if (cols.length >= maxCols) break
    }
  }
  if (cols.length < maxCols) {
    for (const key of available) {
      if (!cols.find((c) => c.key === key)) {
        cols.push({ key, label: key.replace(/_/g, ' ') })
        if (cols.length >= maxCols) break
      }
    }
  }
  return cols
}

// ─── Shared download helper used by both the Transmittals sub-table and Document Search ──
// Isolated into its own component so each row manages its own loading state independently.
const TransDownloadButton = ({ doc }) => {
  const [busy, setBusy] = useState(false)
  const idocId = doc[_IDOC_KEY]
  const docNo  = (_DOC_NO_KEYS.map((k) => doc[k]).find(Boolean) || idocId) ?? ''

  const handleClick = async () => {
    if (!idocId) return
    setBusy(true)
    try {
      const res = await wrenchService.downloadDocument(String(idocId), String(docNo))
      if (res.data instanceof Blob && res.data.type === 'application/json') {
        const json = JSON.parse(await res.data.text())
        if (json.download_url) { window.open(json.download_url, '_blank'); return }
      }
      const url = URL.createObjectURL(res.data)
      const a   = document.createElement('a')
      a.href    = url
      a.download = `${docNo || idocId}.bin`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (_) {
      // Silent — error surfaced by the parent alert if needed
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      title={`Download IDOC ${idocId}`}
      className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50 disabled:opacity-50 transition whitespace-nowrap"
    >
      {busy
        ? <ArrowPathIcon className="w-3 h-3 animate-spin" />
        : <ArrowDownTrayIcon className="w-3 h-3" />}
      {busy ? '…' : 'DL'}
    </button>
  )
}

// ─── Transmittals browser ─────────────────────────────────────────────────────

const TransmittalsSection = ({ configured, onGoToConfig }) => {
  const [page, setPage] = useState(1)
  const [data, setData] = useState(null)
  const [loadingTrans, setLoadingTrans] = useState(false)
  const [transError, setTransError] = useState(null)
  const [filterText, setFilterText] = useState('')
  const [derivedCols, setDerivedCols] = useState([])

  // Expand / collapse: keyed by the ORDER_NO of the expanded row (null = none)
  const [expandedOrderNo, setExpandedOrderNo] = useState(null)
  // Per-transmittal document cache: { [orderNo]: { loading, error, documents, cols } }
  const [docCache, setDocCache] = useState({})

  const fetchDocs = useCallback(async (orderNo, row = {}) => {
    if (!orderNo) return
    // Soft-coded: candidate field names for the transmittal ID — backend tries all of them
    const transId = row['TRANS_ID'] || row['TRANS_REF_NO'] || row['TRANSMITTAL_ID'] || ''
    setDocCache((prev) => ({ ...prev, [orderNo]: { loading: true, error: null, documents: null, cols: [] } }))
    try {
      const res = await wrenchService.getTransmittalDocuments(orderNo, transId)
      const docs = res.data?.documents ?? []
      const cols = deriveColumns(docs, TRANS_DOC_COL_PRIORITY, TRANS_DOC_MAX_COLS)
      setDocCache((prev) => ({ ...prev, [orderNo]: { loading: false, error: null, documents: docs, cols } }))
    } catch (err) {
      setDocCache((prev) => ({
        ...prev,
        [orderNo]: { loading: false, error: err.response?.data?.detail || 'Failed to load documents.', documents: [], cols: [] },
      }))
    }
  }, [])

  const handleRowClick = useCallback((orderNo, row) => {
    if (!orderNo) return
    setExpandedOrderNo((prev) => {
      const next = prev === orderNo ? null : orderNo
      // Fetch only if not yet cached, passing the full row so TRANS_ID can be extracted
      if (next && !docCache[next]) fetchDocs(next, row)
      return next
    })
  }, [docCache, fetchDocs])

  const load = useCallback(async (targetPage = 1) => {
    setLoadingTrans(true)
    setTransError(null)
    try {
      const res = await wrenchService.listTransmittals(targetPage, TRANSMITTAL_PAGE_SIZE)
      setData(res.data)
      setPage(targetPage)
      if (res.data?.transmittals?.length > 0) {
        setDerivedCols(deriveColumns(res.data.transmittals, TRANSMITTAL_COL_PRIORITY, MAX_TABLE_COLS))
      }
    } catch (err) {
      setTransError(err.response?.data?.detail || 'Failed to load transmittals from Wrench.')
    } finally {
      setLoadingTrans(false)
    }
  }, [])

  useEffect(() => { if (configured) load(1) }, [configured, load])

  const filtered = useMemo(() => {
    if (!data?.transmittals) return []
    if (!filterText.trim()) return data.transmittals
    const q = filterText.toLowerCase()
    return data.transmittals.filter((row) =>
      Object.values(row).some((v) => String(v ?? '').toLowerCase().includes(q))
    )
  }, [data, filterText])

  if (!configured) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-5">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center shadow-lg shadow-amber-200/30">
          <Cog6ToothIcon className="w-8 h-8 text-amber-400" />
        </div>
        <p className="text-sm text-gray-500">Configure Wrench first to browse transmittals.</p>
        <button
          onClick={onGoToConfig}
          className="inline-flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-sm font-medium rounded-xl shadow-md shadow-blue-400/20 transition-all duration-200"
        >
          <Cog6ToothIcon className="w-4 h-4" /> Go to Configuration
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Filter loaded results…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition"
          />
        </div>
        <button
          type="button"
          onClick={() => load(1)}
          disabled={loadingTrans}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg bg-white hover:bg-gray-50 disabled:opacity-50 transition"
        >
          <ArrowPathIcon className={`w-4 h-4 ${loadingTrans ? 'animate-spin' : ''}`} />
          {loadingTrans ? 'Loading…' : 'Reload'}
        </button>
      </div>

      {transError && <Alert type="error" message={transError} />}

      {/* Spinner on first load */}
      {loadingTrans && !data && (
        <div className="flex items-center justify-center h-32">
          <ArrowPathIcon className="w-8 h-8 text-blue-400 animate-spin" />
        </div>
      )}

      {/* Table */}
      {!loadingTrans && data && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50">
            <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <TableCellsIcon className="w-4 h-4 text-gray-400" />
              {filterText.trim()
                ? `${filtered.length} match${filtered.length !== 1 ? 'es' : ''} (page ${page} of ${data.total})`
                : `Showing ${data.transmittals?.length ?? 0} of ${data.total?.toLocaleString()} total`}
            </span>
            {data.total > TRANSMITTAL_PAGE_SIZE && (
              <span className="text-xs text-gray-400">Page {page}</span>
            )}
          </div>

          {filtered.length === 0 ? (
            <div className="p-10 text-center text-sm text-gray-400">
              {filterText.trim()
                ? 'No transmittals match your filter.'
                : 'No transmittals returned from Wrench.'}
            </div>
          ) : derivedCols.length === 0 ? (
            <div className="p-10 text-center text-sm text-gray-400">
              Data received but field structure is unexpected. Check sync logs for details.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead className="bg-gradient-to-r from-slate-100 to-slate-50 border-b border-gray-200">
                  <tr>
                    {/* Expand toggle column header */}
                    <th className="px-3 py-2.5 w-8" />
                    {derivedCols.map((col) => (
                      <th key={col.key} className="px-4 py-2.5 text-left font-semibold text-gray-600 whitespace-nowrap">
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((row, idx) => {
                    const orderNo = row[TRANS_DOC_LINK_FIELD]
                    const isExpanded = expandedOrderNo === orderNo
                    const cache = docCache[orderNo] || {}
                    return (
                      <React.Fragment key={idx}>
                        <tr
                          className={`transition-colors duration-150 cursor-pointer ${isExpanded ? 'bg-blue-50/70' : 'hover:bg-slate-50/80'}`}
                          onClick={() => handleRowClick(orderNo, row)}
                        >
                          {/* Chevron toggle */}
                          <td className="px-3 py-2.5 text-gray-400">
                            <ChevronDownIcon
                              className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180 text-blue-500' : ''}`}
                            />
                          </td>
                          {derivedCols.map((col) => (
                            <td
                              key={col.key}
                              className="px-4 py-2.5 text-gray-700 max-w-[220px] truncate"
                              title={String(row[col.key] ?? '')}
                            >
                              {row[col.key] != null && row[col.key] !== ''
                                ? String(row[col.key])
                                : <span className="text-gray-300">&mdash;</span>}
                            </td>
                          ))}
                        </tr>

                        {/* ── Expanded document sub-table ─────────────────── */}
                        {isExpanded && (
                          <tr>
                            <td colSpan={derivedCols.length + 1} className="px-0 py-0 bg-blue-50">
                              <div className="mx-6 my-3 border border-blue-200 rounded-lg overflow-hidden">
                                {/* Sub-table header */}
                                <div className="px-4 py-2 bg-blue-100 border-b border-blue-200 flex items-center justify-between">
                                  <span className="text-xs font-semibold text-blue-800 flex items-center gap-1.5">
                                    <DocumentTextIcon className="w-3.5 h-3.5" />
                                    Documents for {orderNo}
                                    {cache.documents != null && (
                                      <span className="ml-1 font-normal text-blue-600">
                                        ({cache.documents.length} doc{cache.documents.length !== 1 ? 's' : ''})
                                      </span>
                                    )}
                                  </span>
                                  {cache.loading && (
                                    <ArrowPathIcon className="w-3.5 h-3.5 text-blue-400 animate-spin" />
                                  )}
                                </div>

                                {/* Loading */}
                                {cache.loading && (
                                  <div className="px-4 py-4 text-xs text-gray-400">Loading documents…</div>
                                )}

                                {/* Error */}
                                {cache.error && !cache.loading && (
                                  <div className="px-4 py-3 text-xs text-red-600">{cache.error}</div>
                                )}

                                {/* Empty */}
                                {!cache.loading && !cache.error && cache.documents?.length === 0 && (
                                  <div className="px-4 py-3 text-xs text-gray-400">
                                    No documents found for this transmittal via ORDER_NO filter.
                                  </div>
                                )}

                                {/* Document rows */}
                                {!cache.loading && cache.documents?.length > 0 && (
                                  <div className="overflow-x-auto">
                                    <table className="min-w-full text-xs">
                                      <thead className="bg-blue-50 border-b border-blue-200">
                                        <tr>
                                          {cache.cols.map((c) => (
                                            <th key={c.key} className="px-3 py-2 text-left font-semibold text-blue-700 whitespace-nowrap">
                                              {c.label}
                                            </th>
                                          ))}
                                          <th className="px-3 py-2 text-left font-semibold text-blue-700 whitespace-nowrap">Download</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-blue-100 bg-white">
                                        {cache.documents.map((doc, di) => {
                                          const idocId = doc[_IDOC_KEY]
                                          return (
                                            <tr key={di} className="hover:bg-blue-50 transition">
                                              {cache.cols.map((c) => (
                                                <td
                                                  key={c.key}
                                                  className="px-3 py-2 text-gray-700 max-w-[200px] truncate"
                                                  title={String(doc[c.key] ?? '')}
                                                >
                                                  {doc[c.key] != null && doc[c.key] !== ''
                                                    ? <span className={c.key === 'DOC_NO' || c.key === 'DOCUMENT_NO' ? 'font-mono font-semibold text-blue-700' : ''}>{String(doc[c.key])}</span>
                                                    : <span className="text-gray-300">&mdash;</span>}
                                                </td>
                                              ))}
                                              <td className="px-3 py-2">
                                                {idocId ? (
                                                  <TransDownloadButton doc={doc} />
                                                ) : (
                                                  <span className="text-gray-300">&mdash;</span>
                                                )}
                                              </td>
                                            </tr>
                                          )
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {data.total > TRANSMITTAL_PAGE_SIZE && (
            <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => load(page - 1)}
                disabled={page === 1 || loadingTrans}
                className="px-4 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition"
              >
                ← Previous
              </button>
              <span className="text-xs text-gray-500">Page {page}</span>
              <button
                type="button"
                onClick={() => load(page + 1)}
                disabled={(data.transmittals?.length ?? 0) < TRANSMITTAL_PAGE_SIZE || loadingTrans}
                className="px-4 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition"
              >
                Next →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Document Search section ──────────────────────────────────────────────────

// Soft-coded: page size options offered in the rows-per-page selector
const DOC_PAGE_SIZE_OPTIONS = [25, 50, 100, 200]

// Soft-coded fallback discipline list — used when DocumentSearch API is unreachable.
// These cover the standard O&G engineering disciplines. Edit here to add project-specific ones.
const _FALLBACK_DISCIPLINES = [
  'ARCH', 'CIVIL', 'COMM', 'CONTROL', 'ELEC', 'FIRE',
  'HVAC', 'INST', 'MECH', 'PIPING', 'PROCESS', 'SAFETY',
  'STRUCTURAL', 'TELECOM', 'GENERAL',
]

// ── Smart Search soft-coded constants ────────────────────────────────────────
// localStorage key for recent successful queries (per-browser, no PII)
const _RECENT_SEARCH_KEY   = 'wrench.docSearch.recents'
const _RECENT_SEARCH_LIMIT = 8
// Number of discipline quick-pick pills shown next to the smart bar
const _DISCIPLINE_PILL_COUNT = 6
// Quick range chips — the label is shown; resolver returns { from, to } as ISO
const _QUICK_RANGES = [
  { key: 'today',     label: 'Today' },
  { key: 'week',      label: 'Last 7 Days' },
  { key: 'month',     label: 'This Month' },
  { key: 'last30',    label: 'Last 30 Days' },
  { key: 'quarter',   label: 'This Quarter' },
  { key: 'year',      label: 'This Year' },
]
// Token grammar for the smart bar — order matters (longest prefix first)
//   disc:<code>          → discipline
//   discipline:<code>    → discipline
//   from:YYYY-MM-DD      → date_from (ISO, naturally parseable by <input type=date>)
//   to:YYYY-MM-DD        → date_to
//   after:YYYY-MM-DD     → alias of from:
//   before:YYYY-MM-DD    → alias of to:
//   last:30d / last:6w / last:3m / last:1y → relative date_from = today - N
//   #year                → this:year shortcut (e.g. #2024 → year 2024-01-01..2024-12-31)
const _SMART_TOKEN_PATTERNS = [
  { kind: 'discipline', re: /^(?:disc|discipline):([\w-]+)$/i },
  { kind: 'from',       re: /^(?:from|after):(\d{4}-\d{2}-\d{2})$/i },
  { kind: 'to',         re: /^(?:to|before|until):(\d{4}-\d{2}-\d{2})$/i },
  { kind: 'last',       re: /^last:(\d+)([dwmy])$/i },
  { kind: 'year',       re: /^#?(\d{4})$/ },
]

// Convert a native date-input value ('YYYY-MM-DD') to Wrench format ('YYYY/MM/DD HH:MM')
const _toWrenchDate = (isoDate, endOfDay = false) => {
  if (!isoDate) return ''
  return isoDate.replace(/-/g, '/') + (endOfDay ? ' 23:59' : ' 00:00')
}

// ── Pure date helpers (ISO 'YYYY-MM-DD') for quick-range resolver ───────────
const _pad2 = (n) => String(n).padStart(2, '0')
const _isoOf = (d) => `${d.getFullYear()}-${_pad2(d.getMonth() + 1)}-${_pad2(d.getDate())}`
const _isoToday = () => _isoOf(new Date())
const _isoAddDays = (iso, n) => {
  const d = new Date(iso); d.setDate(d.getDate() + n); return _isoOf(d)
}
const _isoStartOfMonth = () => {
  const d = new Date(); return _isoOf(new Date(d.getFullYear(), d.getMonth(), 1))
}
const _isoStartOfQuarter = () => {
  const d = new Date(); const q = Math.floor(d.getMonth() / 3) * 3
  return _isoOf(new Date(d.getFullYear(), q, 1))
}
const _isoStartOfYear = () => {
  const d = new Date(); return _isoOf(new Date(d.getFullYear(), 0, 1))
}

const _resolveQuickRange = (key) => {
  const today = _isoToday()
  switch (key) {
    case 'today':   return { from: today,                   to: today }
    case 'week':    return { from: _isoAddDays(today, -6),  to: today }
    case 'last30':  return { from: _isoAddDays(today, -29), to: today }
    case 'month':   return { from: _isoStartOfMonth(),      to: today }
    case 'quarter': return { from: _isoStartOfQuarter(),    to: today }
    case 'year':    return { from: _isoStartOfYear(),       to: today }
    default:        return { from: '', to: '' }
  }
}

/**
 * Parse a free-form smart-search string into structured filters.
 * Pure / no side effects → safe to call on every keystroke.
 *
 * Examples:
 *   "P16093 disc:ELEC last:30d"   → discipline=ELEC, doc_no=P16093, date_from=today-30d
 *   "from:2024-01-01 to:2024-06-30 pump"
 *   "#2024 INST"                  → discipline=INST, year 2024
 *   "VESSEL"                      → discipline=VESSEL (if known) else doc_no=VESSEL
 *
 * @param {string} input
 * @param {string[]} knownDisciplines  (case-insensitive matching list)
 * @returns {{discipline:string, doc_no:string, date_from:string, date_to:string}} ISO dates
 */
const parseSmartQuery = (input, knownDisciplines = []) => {
  const out = { discipline: '', doc_no: '', date_from: '', date_to: '' }
  if (!input) return out
  const upperKnown = knownDisciplines.map((d) => String(d).toUpperCase())
  const freeWords  = []

  for (const tok of input.trim().split(/\s+/)) {
    let matched = false
    for (const pat of _SMART_TOKEN_PATTERNS) {
      const m = tok.match(pat.re)
      if (!m) continue
      matched = true
      if (pat.kind === 'discipline') out.discipline = m[1].toUpperCase()
      else if (pat.kind === 'from')  out.date_from  = m[1]
      else if (pat.kind === 'to')    out.date_to    = m[1]
      else if (pat.kind === 'last') {
        const n = parseInt(m[1], 10)
        const unit = m[2].toLowerCase()
        const mult = unit === 'd' ? 1 : unit === 'w' ? 7 : unit === 'm' ? 30 : 365
        out.date_from = _isoAddDays(_isoToday(), -n * mult)
        out.date_to   = _isoToday()
      }
      else if (pat.kind === 'year') {
        const y = m[1]
        out.date_from = `${y}-01-01`
        out.date_to   = `${y}-12-31`
      }
      break
    }
    if (matched) continue
    // Bare token → discipline if it matches a known one, otherwise part of doc_no
    if (upperKnown.includes(tok.toUpperCase()) && !out.discipline) {
      out.discipline = tok.toUpperCase()
    } else {
      freeWords.push(tok)
    }
  }
  out.doc_no = freeWords.join(' ').trim()
  return out
}

// ─── Module-level cache for the slow `listTransmittals` call ─────────────────
// Wrench's GetTransmittalList returns the full set every time and may take several
// minutes. We share the in-flight Promise across mounts/StrictMode double-effects
// AND cache the resolved result for `_PROJECT_LIST_CACHE_TTL_MS` so re-opening the
// Document Search tab is instant. Soft-coded TTL (override at build time if needed).
const _PROJECT_LIST_CACHE_TTL_MS = 5 * 60 * 1000  // 5 minutes
let   _projectListCache    = null   // { data: [...], fetchedAt: <ms epoch> }
let   _projectListInFlight = null   // Promise<list>

const _fetchProjectListShared = (pageSize, maxPages) => {
  // Serve from cache when still fresh
  if (_projectListCache && (Date.now() - _projectListCache.fetchedAt) < _PROJECT_LIST_CACHE_TTL_MS) {
    return Promise.resolve(_projectListCache.data)
  }
  // De-duplicate concurrent callers
  if (_projectListInFlight) return _projectListInFlight

  _projectListInFlight = (async () => {
    const first = await wrenchService.listTransmittals(1, pageSize)
    const list  = first.data?.transmittals || []
    const total = Number(first.data?.total ?? list.length)
    let all = list
    if (total > list.length) {
      const pages = Math.min(maxPages, Math.ceil(total / pageSize))
      for (let p = 2; p <= pages; p++) {
        try {
          const r = await wrenchService.listTransmittals(p, pageSize)
          const part = r.data?.transmittals || []
          if (part.length === 0) break
          all = all.concat(part)
        } catch { break }
      }
    }
    _projectListCache = { data: all, fetchedAt: Date.now() }
    return all
  })().finally(() => { _projectListInFlight = null })

  return _projectListInFlight
}

const _invalidateProjectListCache = () => { _projectListCache = null }

const DocumentSearchSection = ({ config, onGoToConfig }) => {
  // ─── Soft-coded constants (no magic numbers) ──────────────────────────────
  const _PROJECT_FETCH_PAGE_SIZE = 500     // Wrench listTransmittals page size
  const _PROJECT_FETCH_MAX_PAGES = 20      // safety cap when paginating
  const _PROJECT_DOC_FETCH_SIZE  = 100     // documents per project drill-down (smaller = faster perceived response)
  const _PROJECT_DOC_EMPTY_MSG   = 'No documents are linked to project'
  const _SORT_LOCALE_OPTS        = { numeric: true, sensitivity: 'base' }

  // NOTE: We intentionally do NOT gate this view on config.svc_url.
  // The project-first flow uses REST endpoints (list-transmittals,
  // Document/Get, Document/Download) that only need a session token.
  // The legacy SVC URL is only used by the OData search fallback.
  void config; void onGoToConfig;


  // ─── State ────────────────────────────────────────────────────────────────
  const [projectsRaw,       setProjectsRaw]       = useState([])    // raw transmittals
  const [loadingProjects,   setLoadingProjects]   = useState(false)
  const [alert,             setAlert]             = useState(null)
  const [filterText,        setFilterText]        = useState('')
  // browsePath: [] = project grid, [orderNo] = project root, [orderNo, f1, f2…] = folder
  const [browsePath,        setBrowsePath]        = useState([])
  // Per-project doc cache: { [orderNo]: { loading, docs, error } }
  const [projectDocsCache,  setProjectDocsCache]  = useState({})
  const [downloading,       setDownloading]       = useState({})
  // Per-project diagnostic verification: { [orderNo]: { loading, report, error } }
  const [verifyState,       setVerifyState]       = useState({})

  // ─── Aggregate transmittals → unique projects ─────────────────────────────
  const projects = useMemo(() => {
    const map = new Map()
    for (const t of projectsRaw) {
      const orderNo = String(t.ORDER_NO || '').trim()
      if (!orderNo) continue
      const existing = map.get(orderNo)
      const desc = _pickFirst(t, _PROJECT_DESC_KEYS) || ''
      if (!existing) {
        map.set(orderNo, {
          order_no:           orderNo,
          order_description:  desc,
          transmittal_count:  1,
          sample:             t,
        })
      } else {
        existing.transmittal_count += 1
        if (!existing.order_description && desc) existing.order_description = desc
      }
    }
    return Array.from(map.values())
      .sort((a, b) => String(a.order_no).localeCompare(String(b.order_no), undefined, _SORT_LOCALE_OPTS))
  }, [projectsRaw])

  const filteredProjects = useMemo(() => {
    const q = filterText.trim().toLowerCase()
    if (!q) return projects
    return projects.filter((p) =>
      p.order_no.toLowerCase().includes(q) ||
      (p.order_description || '').toLowerCase().includes(q)
    )
  }, [projects, filterText])

  // ─── Load all projects (transmittals) ─────────────────────────────────────
  // Uses the module-level shared fetcher so StrictMode double-effects, tab
  // re-mounts, and concurrent components all share ONE in-flight request and a
  // short-lived result cache (see _fetchProjectListShared above).
  const loadProjects = useCallback(async (opts = {}) => {
    setLoadingProjects(true)
    setAlert(null)
    if (opts.force) _invalidateProjectListCache()
    try {
      const all = await _fetchProjectListShared(_PROJECT_FETCH_PAGE_SIZE, _PROJECT_FETCH_MAX_PAGES)
      setProjectsRaw(all)
      if (all.length === 0) {
        setAlert({ type: 'info', message: 'Wrench returned 0 transmittals. Verify the connection in Configuration.' })
      }
    } catch (err) {
      const isTimeout = err?.code === 'ECONNABORTED' || /timeout/i.test(err?.message || '')
      const message = isTimeout
        ? 'Wrench is taking longer than expected to return the project list. The request is still in flight on the server — wait a moment and click Reload, or verify the Wrench connection in Configuration.'
        : (err?.response?.data?.detail || err?.message || 'Failed to load projects from Wrench.')
      setAlert({ type: isTimeout ? 'warning' : 'error', message })
    } finally {
      setLoadingProjects(false)
    }
  }, [])

  // Auto-load on mount
  useEffect(() => { loadProjects() }, [loadProjects])

  // ─── Fetch documents for a project on demand ──────────────────────────────
  const ensureProjectDocs = useCallback(async (orderNo) => {
    if (!orderNo) return
    const existing = projectDocsCache[orderNo]
    if (existing?.docs || existing?.loading) return

    setProjectDocsCache((prev) => ({
      ...prev,
      [orderNo]: { loading: true, docs: null, error: null },
    }))
    try {
      // Use any transmittal under this ORDER_NO for the TRANS_ID hint
      const sample  = projectsRaw.find((t) => String(t.ORDER_NO || '').trim() === orderNo)
      const transId = (sample && _pickFirst(sample, _TRANS_ID_KEYS)) || ''
      const res = await wrenchService.getTransmittalDocuments(orderNo, transId, 1, _PROJECT_DOC_FETCH_SIZE)
      const docs = res.data?.documents || []
      const note = res.data?.note || null
      setProjectDocsCache((prev) => ({
        ...prev,
        [orderNo]: { loading: false, docs, error: null, note },
      }))
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.message || 'Failed to load documents for this project.'
      setProjectDocsCache((prev) => ({
        ...prev,
        [orderNo]: { loading: false, docs: null, error: msg },
      }))
    }
  }, [projectsRaw, projectDocsCache])

  // Trigger doc fetch whenever we enter a project
  useEffect(() => {
    if (browsePath.length >= 1) ensureProjectDocs(browsePath[0])
  }, [browsePath, ensureProjectDocs])

  // ─── Diagnostic verification (soft-coded) ─────────────────────────────────
  // Runs the backend `trans-documents/verify` endpoint to explain why a
  // project's document list is empty (no docs vs. config / endpoint issue).
  const runVerification = useCallback(async (orderNo) => {
    if (!orderNo) return
    setVerifyState((prev) => ({
      ...prev,
      [orderNo]: { loading: true, report: null, error: null },
    }))
    try {
      const res = await wrenchService.verifyTransmittalDocuments(orderNo)
      setVerifyState((prev) => ({
        ...prev,
        [orderNo]: { loading: false, report: res.data, error: null },
      }))
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.message || 'Verification failed.'
      setVerifyState((prev) => ({
        ...prev,
        [orderNo]: { loading: false, report: null, error: msg },
      }))
    }
  }, [])

  // ─── Resolve folder tree for current project ──────────────────────────────
  const currentProjectTree = useMemo(() => {
    if (browsePath.length === 0) return null
    const orderNo = browsePath[0]
    const cache   = projectDocsCache[orderNo]
    if (!cache?.docs) return null
    const root = buildProjectTree(cache.docs)
    return root.projects[orderNo] || root.projects[_UNASSIGNED_PROJECT] || null
  }, [browsePath, projectDocsCache])

  const currentNode = useMemo(() => {
    if (!currentProjectTree) return null
    if (browsePath.length === 1) return { kind: 'project', node: currentProjectTree }
    let node = currentProjectTree
    for (let i = 1; i < browsePath.length; i++) {
      node = node?.folders?.[browsePath[i]]
      if (!node) return null
    }
    return { kind: 'folder', node }
  }, [currentProjectTree, browsePath])

  // ─── Download a single document ───────────────────────────────────────────
  const handleDownload = useCallback(async (doc) => {
    const idocId = doc[_IDOC_KEY]
    if (!idocId) return
    const docNo = _DOC_NO_KEYS.map((k) => doc[k]).find(Boolean) || String(idocId)
    setDownloading((p) => ({ ...p, [idocId]: true }))
    try {
      const res = await wrenchService.downloadDocument(String(idocId), String(docNo))
      if (res.data instanceof Blob && res.data.type === 'application/json') {
        const txt = await res.data.text()
        try {
          const json = JSON.parse(txt)
          if (json.download_url) { window.open(json.download_url, '_blank'); return }
        } catch { /* fall through and treat as raw blob */ }
      }
      const url = URL.createObjectURL(res.data)
      const a   = document.createElement('a')
      a.href = url; a.download = `${docNo}.bin`
      document.body.appendChild(a); a.click(); a.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      setAlert({
        type:    'error',
        message: `Download failed: ${err?.response?.data?.detail || err?.message || 'unknown error'}`,
      })
    } finally {
      setDownloading((p) => ({ ...p, [idocId]: false }))
    }
  }, [])

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-700 via-blue-600 to-cyan-600 rounded-2xl shadow-md overflow-hidden">
        <div className="px-6 py-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center ring-1 ring-white/20">
              <FolderIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Document Search — Projects</h3>
              <p className="text-xs text-blue-100/80 mt-0.5">
                {loadingProjects
                  ? 'Loading projects from Wrench…'
                  : `${projects.length} project${projects.length === 1 ? '' : 's'} • click any project to browse its folders`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/60" />
              <input
                type="text"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                placeholder="Filter projects by number or name…"
                className="pl-9 pr-3 py-2 w-full md:w-80 text-sm bg-white/10 backdrop-blur border border-white/20 rounded-lg text-white placeholder:text-white/60 focus:bg-white/20 focus:ring-2 focus:ring-white/30 outline-none transition"
              />
            </div>
            <button
              type="button"
              onClick={() => loadProjects({ force: true })}
              disabled={loadingProjects}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-white/10 backdrop-blur border border-white/20 rounded-lg text-white hover:bg-white/20 disabled:opacity-50 transition"
            >
              <ArrowPathIcon className={`w-4 h-4 ${loadingProjects ? 'animate-spin' : ''}`} />
              {loadingProjects ? 'Loading' : 'Reload'}
            </button>
          </div>
        </div>
      </div>

      {/*
        Note: project browsing & document downloads in this view both use Wrench REST
        endpoints (list-transmittals + Document/Get + Document/Download) that require
        only the session token. The legacy SVC URL is only used by the OData/AtomSVC
        search fallback — irrelevant here — so we intentionally do NOT surface any
        "SVC URL is not configured" warning. If a specific download fails because the
        document is only reachable via OData, the per-row download handler will
        surface the actual error via the alert area below.
      */}

      {alert && <Alert type={alert.type} message={alert.message} />}

      {/* Initial loading skeleton */}
      {loadingProjects && projects.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <ArrowPathIcon className="w-10 h-10 text-blue-400 animate-spin mx-auto" />
          <p className="mt-3 text-sm text-gray-500">Fetching all projects from Wrench…</p>
        </div>
      )}

      {/* Breadcrumb */}
      {projects.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-2 flex flex-wrap items-center gap-1.5 text-sm">
          <button
            type="button"
            onClick={() => setBrowsePath([])}
            className={`flex items-center gap-1 px-2 py-1 rounded-md transition ${
              browsePath.length === 0
                ? 'bg-blue-100 text-blue-700 font-semibold'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <FolderIcon className="w-4 h-4" /> All Projects
            <span className="ml-1 text-xs text-gray-400">
              ({filterText ? `${filteredProjects.length}/${projects.length}` : projects.length})
            </span>
          </button>
          {browsePath.map((seg, i) => (
            <React.Fragment key={`${seg}-${i}`}>
              <span className="text-gray-300">›</span>
              <button
                type="button"
                onClick={() => setBrowsePath(browsePath.slice(0, i + 1))}
                className={`px-2 py-1 rounded-md transition truncate max-w-[260px] ${
                  i === browsePath.length - 1
                    ? 'bg-blue-100 text-blue-700 font-semibold'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
                title={seg}
              >
                {i === 0 ? <span className="font-mono">{seg}</span> : seg}
              </button>
            </React.Fragment>
          ))}
        </div>
      )}

      {/* PROJECT GRID (root) */}
      {browsePath.length === 0 && !loadingProjects && (
        filteredProjects.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
            <FolderIcon className="w-10 h-10 text-gray-300 mx-auto" />
            <p className="mt-3 text-sm text-gray-500">
              {projects.length === 0
                ? 'No projects returned by Wrench. Verify the connection in Configuration.'
                : 'No projects match the filter.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {filteredProjects.map((proj) => (
              <button
                type="button"
                key={proj.order_no}
                onClick={() => setBrowsePath([proj.order_no])}
                className="text-left group p-4 bg-white border border-gray-200 rounded-xl hover:border-blue-400 hover:shadow-md hover:-translate-y-0.5 transition"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shrink-0 shadow-sm">
                      <FolderIcon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-mono font-bold text-gray-900 group-hover:text-blue-700 transition">
                        {proj.order_no}
                      </p>
                      <p className="text-xs text-gray-500 truncate" title={proj.order_description}>
                        {proj.order_description || <span className="italic text-gray-300">No description</span>}
                      </p>
                    </div>
                  </div>
                  <ChevronDownIcon className="w-4 h-4 text-gray-400 group-hover:text-blue-500 -rotate-90 shrink-0 transition" />
                </div>
                <div className="mt-3 flex items-center gap-2 text-xs">
                  <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 font-medium">
                    {proj.transmittal_count} transmittal{proj.transmittal_count === 1 ? '' : 's'}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )
      )}

      {/* PROJECT / FOLDER drill-down */}
      {browsePath.length >= 1 && (() => {
        const orderNo = browsePath[0]
        const cache   = projectDocsCache[orderNo]
        if (cache?.loading) {
          return (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <ArrowPathIcon className="w-8 h-8 text-blue-400 animate-spin mx-auto" />
              <p className="mt-3 text-sm text-gray-500">Loading documents for {orderNo}…</p>
            </div>
          )
        }
        if (cache?.error) {
          return <Alert type="error" message={cache.error} />
        }
        if (!cache?.docs) return null
        if (cache.docs.length === 0) {
          const vState  = verifyState[orderNo] || {}
          const vReport = vState.report
          const verdict = vReport?.conclusion?.verdict
          // Soft-coded verdict → fully-static class mapping (Tailwind JIT-safe)
          const _VERDICT_STYLES = {
            no_documents_for_project:     { title: 'Confirmed: no documents linked to this project',
                                            box: 'bg-amber-50 border-amber-200',   text: 'text-amber-800',   sub: 'text-amber-700' },
            documents_exist_unexpectedly: { title: 'Documents exist — refresh required',
                                            box: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-800', sub: 'text-emerald-700' },
            svc_url_missing:              { title: 'DocumentSearch SVC URL is missing',
                                            box: 'bg-rose-50 border-rose-200',     text: 'text-rose-800',    sub: 'text-rose-700' },
            doc_search_unreachable:       { title: 'DocumentSearch endpoint is unreachable',
                                            box: 'bg-rose-50 border-rose-200',     text: 'text-rose-800',    sub: 'text-rose-700' },
            wrench_instance_empty:        { title: 'Wrench instance has no indexed documents',
                                            box: 'bg-slate-50 border-slate-200',   text: 'text-slate-800',   sub: 'text-slate-700' },
            config_error:                 { title: 'Wrench configuration error',
                                            box: 'bg-rose-50 border-rose-200',     text: 'text-rose-800',    sub: 'text-rose-700' },
            unknown:                      { title: 'Inconclusive — see details',
                                            box: 'bg-slate-50 border-slate-200',   text: 'text-slate-800',   sub: 'text-slate-700' },
          }
          const vStyle = _VERDICT_STYLES[verdict] || _VERDICT_STYLES.unknown
          return (
            <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
              <p className="text-sm text-gray-500">{_PROJECT_DOC_EMPTY_MSG} {orderNo}.</p>
              {cache.note && (
                <p className="mt-2 text-xs text-gray-400 max-w-xl mx-auto">{cache.note}</p>
              )}
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => runVerification(orderNo)}
                  disabled={vState.loading}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-60 text-sm"
                >
                  {vState.loading ? (
                    <ArrowPathIcon className="w-4 h-4 animate-spin" />
                  ) : null}
                  {vState.loading ? 'Verifying…' : (vReport ? 'Re-run verification' : 'Verify & validate configuration')}
                </button>
              </div>

              {vState.error && (
                <div className="mt-4 max-w-2xl mx-auto">
                  <Alert type="error" message={vState.error} />
                </div>
              )}

              {vReport && (
                <div className={`mt-5 max-w-3xl mx-auto text-left rounded-lg border ${vStyle.box} p-4`}>
                  <p className={`text-sm font-semibold ${vStyle.text}`}>{vStyle.title}</p>
                  {vReport.conclusion?.reasons?.length > 0 && (
                    <ul className={`mt-2 text-xs ${vStyle.sub} list-disc list-inside space-y-1`}>
                      {vReport.conclusion.reasons.map((r, i) => <li key={i}>{r}</li>)}
                    </ul>
                  )}
                  {vReport.conclusion?.recommendations?.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs font-semibold text-gray-700">Recommendations</p>
                      <ul className="mt-1 text-xs text-gray-600 list-disc list-inside space-y-1">
                        {vReport.conclusion.recommendations.map((r, i) => <li key={i}>{r}</li>)}
                      </ul>
                    </div>
                  )}
                  <details className="mt-3">
                    <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                      Show diagnostic evidence
                    </summary>
                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-gray-600">
                      <div className="bg-white border border-gray-200 rounded p-2">
                        <p className="font-semibold text-gray-700">Configuration</p>
                        <p>base_url: {vReport.config?.has_base_url ? '✓ set' : '✗ missing'}</p>
                        <p>svc_url: {vReport.config?.has_svc_url ? '✓ set' : '✗ missing'}</p>
                        <p>token: {vReport.token?.acquired ? '✓ acquired' : `✗ ${vReport.token?.error || 'failed'}`}</p>
                      </div>
                      <div className="bg-white border border-gray-200 rounded p-2">
                        <p className="font-semibold text-gray-700">DocumentSearch</p>
                        <p>broad: {vReport.doc_search?.broad?.ok
                          ? `✓ total=${vReport.doc_search.broad.total}`
                          : `✗ ${vReport.doc_search?.broad?.error?.slice(0, 80) || 'failed'}`}</p>
                        <p>by ORDER_NO: {vReport.doc_search?.by_order_no?.ok
                          ? `✓ total=${vReport.doc_search.by_order_no.total}`
                          : `✗ ${vReport.doc_search?.by_order_no?.error?.slice(0, 80) || 'failed'}`}</p>
                      </div>
                      <div className="bg-white border border-gray-200 rounded p-2 sm:col-span-2">
                        <p className="font-semibold text-gray-700">REST per-transmittal probes</p>
                        <ul className="mt-1 space-y-0.5">
                          {(vReport.rest_probes || []).map((p, i) => (
                            <li key={i} className="font-mono text-[11px]">
                              {p.ok ? '✓' : '✗'} {p.path} → {p.http_status ?? 'no response'}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </details>
                </div>
              )}
            </div>
          )
        }
        if (!currentNode) {
          return (
            <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
              <p className="text-sm text-gray-500">
                Folder not found.{' '}
                <button onClick={() => setBrowsePath([orderNo])} className="text-blue-600 hover:underline">
                  Return to project root
                </button>
              </p>
            </div>
          )
        }
        const node = currentNode.node
        const subFolders = Object.values(node.folders || {})
          .sort((a, b) => String(a.name).localeCompare(String(b.name), undefined, _SORT_LOCALE_OPTS))
        const docs = node.documents || []
        const isProjectRoot = currentNode.kind === 'project'

        return (
          <div className="space-y-4">
            {isProjectRoot && (
              <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl">
                <p className="text-xs text-blue-600 font-medium uppercase tracking-wider">Project</p>
                <p className="font-mono font-bold text-xl text-blue-900">{node.order_no}</p>
                {node.order_description && <p className="text-sm text-blue-700">{node.order_description}</p>}
                <p className="text-xs text-blue-600 mt-1">
                  {node.totalDocs} document{node.totalDocs === 1 ? '' : 's'} ·{' '}
                  {subFolders.length} top-level folder{subFolders.length === 1 ? '' : 's'} ·{' '}
                  {docs.length} at root
                </p>
              </div>
            )}

            {subFolders.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  Folders ({subFolders.length})
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                  {subFolders.map((folder) => (
                    <button
                      type="button"
                      key={folder.name}
                      onClick={() => setBrowsePath([...browsePath, folder.name])}
                      className="flex items-center gap-2 p-2.5 text-left bg-gray-50 border border-gray-200 rounded-lg hover:border-amber-400 hover:bg-amber-50 transition group"
                    >
                      <div className="w-8 h-8 rounded-md bg-amber-100 group-hover:bg-amber-200 flex items-center justify-center shrink-0 transition">
                        <FolderIcon className="w-4 h-4 text-amber-700" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-800 truncate" title={folder.name}>{folder.name}</p>
                        <p className="text-xs text-gray-500">{folder.totalDocs} doc{folder.totalDocs === 1 ? '' : 's'}</p>
                      </div>
                      <ChevronDownIcon className="w-4 h-4 text-gray-300 group-hover:text-amber-500 -rotate-90 shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {docs.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Documents ({docs.length})
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-xs">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        {DOC_COLUMNS
                          .filter((c) => c.key !== 'ORDER_NO' && c.key !== 'GENEALOGY_STRING')
                          .map((col) => (
                            <th key={col.key} className="px-3 py-2 text-left font-semibold text-gray-600 whitespace-nowrap">
                              {col.label}
                            </th>
                          ))}
                        <th className="px-3 py-2 text-left font-semibold text-gray-600 whitespace-nowrap">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {docs.map((doc, idx) => {
                        const idocId = doc[_IDOC_KEY]
                        const isDl   = Boolean(idocId && downloading[idocId])
                        return (
                          <tr key={idx} className="hover:bg-blue-50/40 transition">
                            {DOC_COLUMNS
                              .filter((c) => c.key !== 'ORDER_NO' && c.key !== 'GENEALOGY_STRING')
                              .map((col) => (
                                <td key={col.key} className="px-3 py-2 text-gray-700 max-w-[220px] truncate" title={doc[col.key] || ''}>
                                  {doc[col.key] || <span className="text-gray-300">—</span>}
                                </td>
                              ))}
                            <td className="px-3 py-2">
                              {idocId ? (
                                <button
                                  type="button"
                                  onClick={() => handleDownload(doc)}
                                  disabled={isDl}
                                  className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 border border-blue-300 rounded-md hover:bg-blue-50 disabled:opacity-50 transition"
                                >
                                  {isDl ? <ArrowPathIcon className="w-3 h-3 animate-spin" /> : <ArrowDownTrayIcon className="w-3 h-3" />}
                                  {isDl ? '…' : 'Download'}
                                </button>
                              ) : <span className="text-gray-300">—</span>}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {subFolders.length === 0 && docs.length === 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
                <p className="text-sm text-gray-500">This folder is empty.</p>
              </div>
            )}
          </div>
        )
      })()}
    </div>
  )
}

// ─── Combined Documents Panel (inner tabs) ────────────────────────────────────

const DOC_INNER_TABS = [
  { id: 'transmittals', label: 'Transmittals', icon: ArrowsRightLeftIcon },
  { id: 'doc_search',   label: 'Document Search', icon: MagnifyingGlassIcon },
]

const DocumentSearchPanel = ({ config, configured, onGoToConfig }) => {
  const [innerTab, setInnerTab] = useState('transmittals')

  if (!configured) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-6">
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center shadow-xl shadow-amber-200/40 ring-4 ring-amber-100/50">
          <Cog6ToothIcon className="w-10 h-10 text-amber-500" />
        </div>
        <div className="text-center">
          <h3 className="text-xl font-bold text-gray-800 mb-2">Wrench Not Configured</h3>
          <p className="text-sm text-gray-500 max-w-sm">
            Set up your Wrench SmartProject credentials in the Configuration tab to start browsing documents.
          </p>
        </div>
        <button onClick={onGoToConfig}
          className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-sm font-semibold rounded-xl shadow-md shadow-blue-400/25 transition-all duration-200">
          <Cog6ToothIcon className="w-4 h-4" /> Go to Configuration
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Inner tab bar */}
      <div className="flex items-center gap-1 border-b border-gray-200">
        {DOC_INNER_TABS.map((t) => (
          <button key={t.id} onClick={() => setInnerTab(t.id)}
            className={`flex items-center gap-1.5 px-5 py-2.5 text-sm font-medium border-b-2 transition ${
              innerTab === t.id
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}>
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {innerTab === 'transmittals' && (
        <TransmittalsSection configured={configured} onGoToConfig={onGoToConfig} />
      )}
      {innerTab === 'doc_search' && (
        <DocumentSearchSection config={config} onGoToConfig={onGoToConfig} />
      )}
    </div>
  )
}

// ─── Overview Stats ───────────────────────────────────────────────────────────

const OverviewStats = ({ config, logs }) => {
  const total = logs.length
  const success = logs.filter((l) => l.status === 'success').length
  const failed = logs.filter((l) => l.status === 'failed').length
  const isVerified = config?.connection_verified

  const stats = [
    { label: 'Total Syncs',  value: total,   color: 'text-slate-800', icon: ArrowsRightLeftIcon, bg: 'bg-blue-50',   iconColor: 'text-blue-500',   bar: 'from-blue-400 to-blue-600' },
    { label: 'Successful',   value: success, color: 'text-green-700', icon: CheckCircleIcon,      bg: 'bg-green-50',  iconColor: 'text-green-500',  bar: 'from-green-400 to-emerald-500' },
    { label: 'Failed',       value: failed,  color: 'text-red-600',   icon: XCircleIcon,          bg: 'bg-red-50',    iconColor: 'text-red-400',    bar: 'from-red-400 to-red-600' },
    {
      label: 'Status',
      value: isVerified ? 'Active' : config ? 'Unverified' : 'Not Set',
      color: isVerified ? 'text-green-700' : 'text-orange-600',
      icon: isVerified ? ShieldCheckIcon : Cog6ToothIcon,
      bg: isVerified ? 'bg-green-50' : 'bg-orange-50',
      iconColor: isVerified ? 'text-green-500' : 'text-orange-400',
      bar: isVerified ? 'from-green-400 to-emerald-500' : 'from-orange-300 to-orange-500',
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((s, i) => (
        <div key={s.label} className="wrench-fade-up bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1.5 hover:border-gray-200 transition-all duration-300 p-5 group overflow-hidden relative" style={{ animationDelay: `${i * 90}ms` }}>
          {/* decorative corner highlight */}
          <div className="absolute top-0 right-0 w-28 h-28 rounded-full bg-gradient-to-br from-slate-50 to-transparent -translate-y-10 translate-x-10 group-hover:scale-125 transition-transform duration-500 pointer-events-none" />
          <div className="flex items-start justify-between mb-3 relative z-10">
            <p className="text-xs text-gray-400 font-semibold uppercase tracking-widest">{s.label}</p>
            <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center shrink-0 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300 shadow-sm`}>
              <s.icon className={`w-5 h-5 ${s.iconColor}`} />
            </div>
          </div>
          <p className={`text-3xl font-extrabold ${s.color} relative z-10`}>{s.value}</p>
          <div className={`mt-3 h-1.5 w-10 rounded-full bg-gradient-to-r ${s.bar} group-hover:w-full transition-all duration-700 ease-out`} />
        </div>
      ))}
    </div>
  )
}

// ─── S3 Export Panel ─────────────────────────────────────────────────────────

const S3_MODES = [
  {
    value: 'batch',
    label: 'Batch Export',
    icon: '📦',
    description: 'Full one-off export of all Wrench data to S3. Processes all pages then completes.',
  },
  {
    value: 'realtime',
    label: 'Real-time',
    icon: '🔄',
    description: 'Continuous polling — exports new pages to S3 every 30 s until you stop it.',
  },
]

const S3_ENTITY_TYPES = [
  { value: 'transmittals', label: 'Transmittals' },
  { value: 'documents',    label: 'Documents' },
  { value: 'all',          label: 'All Entities' },
]

const S3_STATUS_STYLES = {
  pending:     'bg-yellow-100 text-yellow-800 border border-yellow-200',
  in_progress: 'bg-blue-100  text-blue-800  border border-blue-200',
  success:     'bg-green-100 text-green-800 border border-green-200',
  failed:      'bg-red-100   text-red-800   border border-red-200',
  stopped:     'bg-gray-100  text-gray-700  border border-gray-200',
}

const DEFAULT_S3_PREFIX    = 'wrench/'
const S3_BUCKET_DISPLAY    = 'wrench-radai'  // cosmetic label only
const S3_POLL_INTERVAL_MS  = 5000            // auto-refresh when a job is in_progress

// Library Mirror Watcher — soft-coded labels / defaults
const _LIB_WATCHER_TITLE      = 'Library Mirror Watcher'
const _LIB_WATCHER_SUBTITLE   = 'Realtime Wrench ↔ S3 — same folder hierarchy as Wrench'
const _LIB_WATCHER_HELP       = 'Continuously detects added / changed documents in Wrench and syncs them to S3 under library/{order_no}/{discipline}/{doc_type}/{doc_no}/rev_{revision}/'

const S3SyncPanel = ({ configured, onGoToConfig }) => {
  const [jobs, setJobs]                   = useState([])
  const [loadingJobs, setLoadingJobs]     = useState(false)
  const [starting, setStarting]           = useState(false)
  const [alert, setAlert]                 = useState(null)
  const [mode, setMode]                   = useState('batch')
  const [entityType, setEntityType]       = useState('transmittals')
  const [s3Prefix, setS3Prefix]           = useState(DEFAULT_S3_PREFIX)
  const [showAdvanced, setShowAdvanced]   = useState(false)

  // Library Mirror Watcher state — additive
  const [libOrderNo,   setLibOrderNo]   = useState('')
  const [libStarting,  setLibStarting]  = useState(false)
  const [libAlert,     setLibAlert]     = useState(null)
  const [libWatchers,  setLibWatchers]  = useState([])

  const loadJobs = useCallback(async () => {
    try {
      const res = await wrenchService.getS3Jobs()
      setJobs(res.data || [])
    } catch {
      // silent — don't overwrite user-facing alerts during background polls
    }
  }, [])

  useEffect(() => {
    if (!configured) return
    setLoadingJobs(true)
    loadJobs().finally(() => setLoadingJobs(false))
  }, [configured, loadJobs])

  // Auto-refresh while any job is pending / in_progress
  useEffect(() => {
    if (!configured) return
    const hasActive = jobs.some((j) => j.status === 'in_progress' || j.status === 'pending')
    if (!hasActive) return
    const timer = setInterval(loadJobs, S3_POLL_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [jobs, configured, loadJobs])

  const handleStart = async () => {
    setStarting(true)
    setAlert(null)
    try {
      await wrenchService.startS3Sync({ mode, entity_type: entityType, s3_prefix: s3Prefix })
      setAlert({ type: 'success', message: `${mode === 'batch' ? 'Batch' : 'Real-time'} export job started successfully.` })
      await loadJobs()
    } catch (err) {
      setAlert({ type: 'error', message: err.response?.data?.detail || 'Failed to start the export job.' })
    } finally {
      setStarting(false)
    }
  }

  const handleStop = async (jobId) => {
    setAlert(null)
    try {
      await wrenchService.stopS3Job(jobId)
      setAlert({ type: 'info', message: `Job #${jobId} stop signal sent.` })
      await loadJobs()
    } catch (err) {
      setAlert({ type: 'error', message: err.response?.data?.detail || 'Failed to stop the job.' })
    }
  }

  const activeRealtimeJob = jobs.find(
    (j) => j.mode === 'realtime' && (j.status === 'in_progress' || j.status === 'pending'),
  )

  // Library Mirror Watcher handlers — additive
  const loadLibWatchers = useCallback(async () => {
    try {
      const res = await wrenchService.getLibraryWatchers()
      setLibWatchers(res.data || [])
    } catch { /* silent */ }
  }, [])

  useEffect(() => {
    if (!configured) return
    loadLibWatchers()
    const t = setInterval(loadLibWatchers, S3_POLL_INTERVAL_MS)
    return () => clearInterval(t)
  }, [configured, loadLibWatchers])

  const handleStartLibWatcher = async () => {
    setLibAlert(null)
    const orderNo = libOrderNo.trim()
    if (!orderNo) {
      setLibAlert({ type: 'error', message: 'Project ORDER_NO is required.' })
      return
    }
    setLibStarting(true)
    try {
      await wrenchService.startLibraryWatcher({ order_no: orderNo, s3_prefix: s3Prefix })
      setLibAlert({ type: 'success',
        message: `Library mirror started for project ${orderNo}. S3 will stay in sync with Wrench changes.` })
      await loadLibWatchers()
    } catch (err) {
      setLibAlert({ type: 'error',
        message: err.response?.data?.detail || 'Failed to start the library watcher.' })
    } finally {
      setLibStarting(false)
    }
  }

  const handleStopLibWatcher = async (jobId) => {
    try {
      await wrenchService.stopS3Job(jobId)
      await loadLibWatchers()
    } catch (err) {
      setLibAlert({ type: 'error',
        message: err.response?.data?.detail || 'Failed to stop the watcher.' })
    }
  }

  if (!configured) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-6">
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center shadow-xl shadow-amber-200/40 ring-4 ring-amber-100/50">
          <Cog6ToothIcon className="w-10 h-10 text-amber-500" />
        </div>
        <div className="text-center">
          <h3 className="text-xl font-bold text-gray-800 mb-2">Wrench Not Configured</h3>
          <p className="text-sm text-gray-500 max-w-sm">
            Configure and verify your Wrench credentials before exporting data to S3.
          </p>
        </div>
        <button
          onClick={onGoToConfig}
          className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-sm font-semibold rounded-xl shadow-md shadow-blue-400/25 transition-all duration-200"
        >
          <Cog6ToothIcon className="w-4 h-4" /> Go to Configuration
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Control card */}
      <div className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-200 border border-gray-200/80 overflow-hidden">
        <div className="px-6 py-5 bg-gradient-to-r from-orange-600 via-amber-500 to-yellow-500">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center ring-1 ring-white/20">
                <CloudArrowUpIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Export to AWS S3</h3>
                <p className="text-xs text-orange-100/80">Wrench → RADAI → S3 pipeline</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono bg-white/20 text-white border border-white/30 backdrop-blur-sm">
              s3://{S3_BUCKET_DISPLAY}/
            </span>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {alert && <Alert type={alert.type} message={alert.message} />}

          {/* Mode selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Export Mode</label>
            <div className="grid grid-cols-2 gap-3">
              {S3_MODES.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setMode(m.value)}
                  className={`p-4 rounded-lg border-2 text-left transition ${
                    mode === m.value
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <div className="text-xl mb-1">{m.icon}</div>
                  <div className="text-sm font-semibold text-gray-900">{m.label}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{m.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Entity type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Data to Export</label>
            <div className="flex flex-wrap gap-2">
              {S3_ENTITY_TYPES.map((e) => (
                <button
                  key={e.value}
                  type="button"
                  onClick={() => setEntityType(e.value)}
                  className={`px-4 py-1.5 rounded-full text-sm border transition ${
                    entityType === e.value
                      ? 'bg-slate-800 text-white border-slate-800'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-slate-400'
                  }`}
                >
                  {e.label}
                </button>
              ))}
            </div>
          </div>

          {/* Advanced: S3 prefix */}
          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition"
            >
              {showAdvanced
                ? <ChevronUpIcon className="w-3.5 h-3.5" />
                : <ChevronDownIcon className="w-3.5 h-3.5" />}
              Advanced settings
            </button>
            {showAdvanced && (
              <div className="mt-3">
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  S3 Key Prefix
                  <span className="ml-1 font-normal text-gray-400">(e.g. wrench/ or project-x/wrench/)</span>
                </label>
                <input
                  type="text"
                  value={s3Prefix}
                  onChange={(e) => setS3Prefix(e.target.value)}
                  placeholder="wrench/"
                  className="w-full max-w-xs px-3 py-2 text-sm font-mono border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-400 outline-none transition"
                />
                <p className="mt-1 text-xs text-gray-400">
                  S3 path:{' '}
                  <span className="font-mono">
                    s3://{S3_BUCKET_DISPLAY}/{s3Prefix || DEFAULT_S3_PREFIX}{entityType}/year=…/
                  </span>
                </p>
              </div>
            )}
          </div>

          {/* Conflict warning */}
          {mode === 'realtime' && activeRealtimeJob && (
            <Alert
              type="warning"
              message={`A real-time job (ID #${activeRealtimeJob.id}) is already running. Stop it before starting a new one.`}
            />
          )}

          {/* Start button */}
          <button
            type="button"
            onClick={handleStart}
            disabled={starting || (mode === 'realtime' && Boolean(activeRealtimeJob))}
            className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 disabled:opacity-50 text-white text-sm font-semibold rounded-xl shadow-md shadow-orange-400/25 transition-all duration-200"
          >
            {starting
              ? <ArrowPathIcon className="w-4 h-4 animate-spin" />
              : <CloudArrowUpIcon className="w-4 h-4" />}
            {starting ? 'Starting…' : `Start ${mode === 'batch' ? 'Batch Export' : 'Real-time Export'}`}
          </button>
        </div>
      </div>

      {/* ── Library Mirror Watcher (continuous Wrench → S3 sync) ─────────────── */}
      <div className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-200 border border-gray-200/80 overflow-hidden">
        <div className="px-6 py-5 bg-gradient-to-r from-emerald-600 via-teal-500 to-cyan-500">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center ring-1 ring-white/20">
                <ArrowPathIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-white">{_LIB_WATCHER_TITLE}</h3>
                <p className="text-xs text-emerald-100/80">{_LIB_WATCHER_SUBTITLE}</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono bg-white/20 text-white border border-white/30 backdrop-blur-sm">
              library/{'{order_no}'}/…
            </span>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {libAlert && <Alert type={libAlert.type} message={libAlert.message} />}
          <p className="text-xs text-gray-500">{_LIB_WATCHER_HELP}</p>

          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Project ORDER_NO <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={libOrderNo}
                onChange={(e) => setLibOrderNo(e.target.value)}
                placeholder="e.g. 5900620"
                className="w-full px-3 py-2 text-sm font-mono border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-400 outline-none transition"
              />
            </div>
            <button
              type="button"
              onClick={handleStartLibWatcher}
              disabled={libStarting || !libOrderNo.trim()}
              className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 disabled:opacity-50 text-white text-sm font-semibold rounded-xl shadow-md shadow-emerald-400/25 transition-all"
            >
              {libStarting
                ? <ArrowPathIcon className="w-4 h-4 animate-spin" />
                : <ArrowPathIcon className="w-4 h-4" />}
              {libStarting ? 'Starting…' : 'Start Library Sync'}
            </button>
          </div>

          {libWatchers.length > 0 && (
            <div className="mt-2 border border-gray-200 rounded-xl overflow-hidden">
              <table className="min-w-full text-xs">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['Job', 'Order No', 'Status', 'Uploaded', 'Last Tick', ''].map((h) => (
                      <th key={h} className="px-3 py-2 text-left font-semibold text-gray-600 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {libWatchers.map((w) => {
                    const lw = w.job_details?.library_watcher || {}
                    return (
                      <tr key={w.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-mono text-gray-500">#{w.id}</td>
                        <td className="px-3 py-2 font-mono">{lw.order_no || w.job_details?.order_no || '—'}</td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${S3_STATUS_STYLES[w.status] || ''}`}>
                            {w.status === 'in_progress' && <ArrowPathIcon className="w-3 h-3 mr-1 animate-spin" />}
                            {w.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-mono">{lw.uploaded_total ?? w.records_exported ?? 0}</td>
                        <td className="px-3 py-2 text-gray-500">{lw.last_tick || '—'}</td>
                        <td className="px-3 py-2">
                          {(w.status === 'in_progress' || w.status === 'pending') && (
                            <button
                              type="button"
                              onClick={() => handleStopLibWatcher(w.id)}
                              className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition"
                            >
                              <StopCircleIcon className="w-3 h-3" /> Stop
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Jobs table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white flex items-center justify-between bg-gray-50">
          <h3 className="font-semibold text-gray-800 flex items-center gap-2">
            <ClockIcon className="w-5 h-5 text-indigo-400" />
            Export Jobs
          </h3>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400">{jobs.length} recent jobs</span>
            <button
              type="button"
              onClick={loadJobs}
              disabled={loadingJobs}
              className="text-gray-400 hover:text-gray-600 transition"
              title="Refresh"
            >
              <ArrowPathIcon className={`w-4 h-4 ${loadingJobs ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {jobs.length === 0 ? (
          <div className="p-10 text-center text-sm text-gray-400">
            No export jobs yet. Configure the mode above and click Start.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['ID', 'Mode', 'Entity', 'Status', 'Exported', 'Pages', 'Started', 'Duration', ''].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left font-semibold text-gray-600 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {jobs.map((job) => (
                  <tr key={job.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-2.5 text-gray-500 font-mono">#{job.id}</td>
                    <td className="px-4 py-2.5">
                      <span className="capitalize font-medium text-gray-700">
                        {job.mode === 'realtime' ? '🔄 Real-time' : '📦 Batch'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-gray-600 capitalize">{job.entity_type}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${S3_STATUS_STYLES[job.status] || ''}`}>
                        {job.status === 'in_progress' && <ArrowPathIcon className="w-3 h-3 mr-1 animate-spin" />}
                        {job.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-gray-700 font-mono">
                      {job.records_exported != null ? job.records_exported.toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-gray-700 font-mono">{job.pages_processed ?? '—'}</td>
                    <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">
                      {job.started_at ? new Date(job.started_at).toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-gray-500">
                      {job.duration_seconds != null ? `${Number(job.duration_seconds).toFixed(1)}s` : '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      {(job.status === 'in_progress' || job.status === 'pending') && job.mode === 'realtime' && (
                        <button
                          type="button"
                          onClick={() => handleStop(job.id)}
                          className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition"
                        >
                          <StopCircleIcon className="w-3.5 h-3.5" />
                          Stop
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'overview',   label: 'Overview',       icon: InformationCircleIcon },
  { id: 'config',     label: 'Configuration',  icon: WrenchScrewdriverIcon },
  { id: 'sync',       label: 'Sync',           icon: ArrowsRightLeftIcon },
  { id: 's3_export',  label: 'S3 Export',      icon: CloudArrowUpIcon },
  { id: 'documents',  label: 'Documents',      icon: DocumentTextIcon },
]

const WrenchIntegration = () => {
  const { user } = useSelector((state) => state.auth)
  const admin = isUserAdmin(user)

  const [activeTab, setActiveTab] = useState('overview')
  const [config, setConfig] = useState(null)
  const [configured, setConfigured] = useState(false)
  const [syncLogs, setSyncLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [pageAlert, setPageAlert] = useState(null)
  const [retrying, setRetrying] = useState(false)

  const loadData = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true)
    setPageAlert(null)
    try {
      const [cfgRes, logsRes] = await Promise.all([
        wrenchService.getConfig(),
        wrenchService.getSyncLogs(),
      ])
      setConfigured(cfgRes.data?.configured || false)
      setConfig(cfgRes.data?.config || null)
      setSyncLogs(logsRes.data || [])
      setRetrying(false)
    } catch (err) {
      const status = err.response?.status
      const errCode = err.response?.data?.error

      if (status === 503 || errCode === 'backend_unavailable') {
        // Backend is still starting – auto-retry once after 4 seconds
        setPageAlert({
          type: 'warning',
          message: 'Backend is starting up. Retrying in a few seconds…',
        })
        setRetrying(true)
        setTimeout(() => loadData({ silent: true }), 4000)
      } else if (status === 401 || status === 403) {
        setPageAlert({
          type: 'error',
          message: 'Access denied. Admin permissions are required to view Wrench Integration.',
        })
      } else {
        setPageAlert({
          type: 'error',
          message: 'Failed to load Wrench integration data. Check your permissions.',
        })
      }
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleVerify = async () => {
    try {
      const res = await wrenchService.verifyConnection()
      await loadData()
      return res.data
    } catch (err) {
      return {
        success: false,
        message: err.response?.data?.message || 'Connection test failed.',
      }
    }
  }

  const handleSyncTrigger = async (direction, entityType) => {
    const res = await wrenchService.triggerSync(direction, entityType)
    await loadData()
    return res.data
  }

  if (!admin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-5 text-center">
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-rose-100 to-red-100 flex items-center justify-center shadow-xl shadow-rose-200/40 ring-4 ring-rose-100/50">
          <ShieldCheckIcon className="w-10 h-10 text-rose-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-700">Admin Access Required</h2>
          <p className="text-sm text-gray-400 mt-1">Only administrators can access the Wrench Integration settings.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 px-4 pt-8 pb-16 lg:px-10 xl:px-16 relative">
      <style>{`
        @keyframes wrench-fade-up {
          from { opacity: 0; transform: translateY(22px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
        @keyframes wrench-float {
          0%, 100% { transform: translateY(0);    }
          50%       { transform: translateY(-14px); }
        }
        @keyframes wrench-float-slow {
          0%, 100% { transform: translateY(0) scale(1);     }
          33%       { transform: translateY(-10px) scale(1.01); }
          66%       { transform: translateY(6px)  scale(0.99);  }
        }
        @keyframes wrench-shimmer {
          0%   { background-position: -250% center; }
          100% { background-position:  250% center; }
        }
        .wrench-fade-up   { animation: wrench-fade-up   0.55s cubic-bezier(0.16,1,0.3,1) both; }
        .wrench-float     { animation: wrench-float     7s ease-in-out infinite; }
        .wrench-float-slow{ animation: wrench-float-slow 11s ease-in-out infinite; }
        .wrench-title {
          background: linear-gradient(110deg, #0f172a 25%, #818cf8 50%, #1e40af 75%);
          background-size: 250% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: wrench-shimmer 6s linear infinite;
        }
      `}</style>

      {/* Decorative background orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden -z-10" aria-hidden="true">
        <div className="wrench-float-slow absolute -top-40 -right-40 w-[560px] h-[560px] rounded-full bg-gradient-to-br from-blue-400/10 to-indigo-500/8 blur-3xl" />
        <div className="wrench-float absolute -bottom-40 -left-32 w-[480px] h-[480px] rounded-full bg-gradient-to-tr from-slate-300/10 to-cyan-300/7 blur-3xl" style={{animationDelay:'3s'}} />
        <div className="wrench-float-slow absolute top-1/3 right-1/4 w-[600px] h-[200px] rounded-full bg-gradient-to-r from-indigo-200/6 to-blue-200/4 blur-3xl" style={{animationDelay:'6s'}} />
      </div>

      {/* Page header */}
      <div className="mb-8">
        <div className="flex items-center gap-5">
          <div className="relative wrench-float">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-700 to-slate-800 flex items-center justify-center shadow-2xl shadow-blue-500/30 ring-4 ring-blue-500/15 relative z-10">
              <WrenchScrewdriverIcon className="w-9 h-9 text-white" />
            </div>
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 blur-xl opacity-40 scale-125 -z-10" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="wrench-title text-3xl font-extrabold tracking-tight">Wrench Integration</h1>
              <span className="text-xs font-bold bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-2.5 py-0.5 rounded-full shadow-md">
                Beta
              </span>
            </div>
            <p className="text-sm text-gray-400 mt-1">
              Connect RADAI with the Wrench SmartProject Platform
            </p>
          </div>
        </div>

        {/* Status pill */}
        <div className="mt-4 flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${
              config?.connection_verified
                ? 'bg-green-50 text-green-700 border-green-200'
                : configured
                ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                : 'bg-gray-100 text-gray-600 border-gray-200'
            }`}
          >
            <span
              className={`w-2.5 h-2.5 rounded-full transition-colors ${
                config?.connection_verified ? 'bg-green-500 animate-pulse' : configured ? 'bg-yellow-400' : 'bg-gray-400'
              }`}
            />
            {config?.connection_verified
              ? `Connected · ${config.organization_name || config.base_url}`
              : configured
              ? 'Configured – not verified'
              : 'Not configured'}
          </span>
        </div>
      </div>

      {pageAlert && (
        <div className="mb-6 flex items-start gap-3">
          <div className="flex-1">
            <Alert type={pageAlert.type} message={pageAlert.message} />
          </div>
          {!retrying && (
            <button
              type="button"
              onClick={() => loadData()}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg bg-white hover:bg-gray-50 transition shrink-0 mt-0.5"
            >
              <ArrowPathIcon className="w-4 h-4" />
              Retry
            </button>
          )}
          {retrying && (
            <div className="flex items-center gap-1.5 px-4 py-2 text-sm text-gray-500 shrink-0 mt-0.5">
              <ArrowPathIcon className="w-4 h-4 animate-spin" />
              Retrying…
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="mb-8">
        <div className="inline-flex items-center gap-1 bg-white/80 backdrop-blur-sm p-1.5 rounded-2xl shadow-lg shadow-slate-200/60 border border-slate-200/50 flex-wrap">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl transition-all duration-200 whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-slate-800 to-slate-700 text-white shadow-lg shadow-slate-400/30'
                  : 'text-gray-500 hover:text-gray-800 hover:bg-slate-100/70'
              }`}
            >
              <tab.icon className={`w-4 h-4 transition-colors duration-200 ${activeTab === tab.id ? 'text-blue-300' : ''}`} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center h-48 gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <ArrowPathIcon className="w-6 h-6 text-white animate-spin" />
          </div>
          <p className="text-sm text-gray-400 font-medium">Loading Wrench data…</p>
        </div>
      ) : (
        <div>
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <OverviewStats config={config} logs={syncLogs} />

              {/* Two-col grid: guide + activity */}
              <div className="grid lg:grid-cols-2 gap-6 items-start">

              {/* Integration guide */}
              <div className="wrench-fade-up bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5" style={{ animationDelay: '180ms' }}>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2.5">
                    <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-sm shrink-0">
                      <InformationCircleIcon className="w-4 h-4 text-white" />
                    </span>
                    Integration Guide
                  </h3>
                  <span className="text-xs text-gray-400 bg-slate-100 px-2.5 py-1 rounded-full font-medium">6 steps</span>
                </div>
                <ol className="relative text-sm text-gray-600">
                  {[
                    'Go to the Configuration tab and enter the Wrench WebAPI Server URL, Server ID, login name, and password.',
                    'Optionally enter the DocumentSearch Service URL if it runs on a different host than the WebAPI.',
                    'Click “Test Connection” to verify RADAI can authenticate with Wrench (a real login is performed).',
                    'Use the Sync tab to pull documents from Wrench or push RADAI analysis results back.',
                    'Use the Documents tab to search and browse the Wrench document repository directly.',
                    'All activity is recorded in the Sync History and in the RBAC Audit Log.',
                  ].map((step, i) => (
                    <li key={i} className="relative flex items-start gap-4 pb-5 last:pb-0 group">
                      {i < 5 && <div className="absolute left-4 top-8 w-0.5 h-full bg-gradient-to-b from-slate-200 to-transparent pointer-events-none" />}
                      <span
                        className={`wrench-fade-up w-8 h-8 rounded-xl text-white text-xs font-bold flex items-center justify-center shrink-0 shadow-md group-hover:scale-110 group-hover:rotate-3 transition-transform duration-200 z-10 bg-gradient-to-br ${['from-blue-500 to-indigo-600','from-indigo-500 to-violet-600','from-violet-500 to-purple-600','from-purple-500 to-pink-600','from-pink-500 to-rose-600','from-rose-500 to-orange-500'][i]}`}
                        style={{ animationDelay: `${280 + i * 80}ms` }}
                      >
                        {i + 1}
                      </span>
                      <div className="pt-1.5 flex-1">
                        <p className="group-hover:text-gray-800 transition-colors duration-200 leading-relaxed">{step}</p>
                        <span className="inline-block mt-1.5 text-xs font-medium text-slate-400 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-full">{['Setup','Optional','Verify','Sync','Browse','Audit'][i]}</span>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>

              {/* Recent activity */}
              {syncLogs.length > 0 ? (
                <div className="wrench-fade-up bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden" style={{ animationDelay: '260ms' }}>
                  <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      Recent Sync Activity
                    </h3>
                    <span className="text-xs text-gray-400 bg-slate-50 px-2.5 py-1 rounded-full border border-gray-100">
                      Last {Math.min(syncLogs.length, 5)} of {syncLogs.length}
                    </span>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {syncLogs.slice(0, 5).map((log, idx) => (
                      <div key={log.id} className="wrench-fade-up px-6 py-3.5 flex items-center justify-between hover:bg-gradient-to-r hover:from-blue-50/40 hover:to-transparent transition-all duration-200 group" style={{ animationDelay: `${360 + idx * 55}ms` }}>
                        <div className="flex items-center gap-3">
                          <StatusBadge status={log.status} />
                          <div>
                            <span className="text-sm text-gray-700 font-medium group-hover:text-gray-900 transition-colors duration-150">
                              {log.direction.replace(/_/g, ' → ')}
                            </span>
                            <span className="mx-1.5 text-gray-300">·</span>
                            <span className="text-xs text-gray-500 capitalize">{log.entity_type}</span>
                          </div>
                        </div>
                        <span className="text-xs text-gray-400 tabular-nums">
                          {new Date(log.started_at).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="wrench-fade-up hidden lg:flex items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 p-8 min-h-[200px]" style={{ animationDelay: '260ms' }}>
                  <div className="text-center">
                    <ArrowsRightLeftIcon className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">No sync activity yet</p>
                  </div>
                </div>
              )}

              </div>{/* /two-col grid */}

              {!configured && (
                <Alert
                  type="warning"
                  message="Wrench integration is not configured yet. Go to the Configuration tab to get started."
                />
              )}
            </div>
          )}

          {activeTab === 'config' && (
            <ConfigPanel
              config={config}
              onSaved={loadData}
              onVerify={handleVerify}
            />
          )}

          {activeTab === 'sync' && (
            configured ? (
              <SyncPanel logs={syncLogs} onTrigger={handleSyncTrigger} onGoToS3Tab={() => setActiveTab('s3_export')} />
            ) : (
              <Alert
                type="warning"
                message="Please configure and verify the Wrench connection in the Configuration tab before running a sync."
              />
            )
          )}

          {activeTab === 's3_export' && (
            <S3SyncPanel configured={configured} onGoToConfig={() => setActiveTab('config')} />
          )}

          {activeTab === 'documents' && (
            <DocumentSearchPanel
              config={config}
              configured={configured}
              onGoToConfig={() => setActiveTab('config')}
            />
          )}
        </div>
      )}
    </div>
  )
}

export default WrenchIntegration
