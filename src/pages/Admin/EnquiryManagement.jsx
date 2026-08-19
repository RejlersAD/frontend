import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  EnvelopeIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
  XMarkIcon,
  EyeIcon,
  TrashIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  InboxArrowDownIcon,
  BuildingOffice2Icon,
  PhoneIcon,
} from '@heroicons/react/24/outline'
import apiService from '../../services/api.service'

// ---------------------------------------------------------------------------
// Soft-coded configuration
// ---------------------------------------------------------------------------
// NOTE: apiService already prepends the API base ('/api/v1'), so these paths
// must NOT include the '/api/v1' prefix — otherwise requests hit
// '/api/v1/api/v1/enquiry/' and get a 404 back from the router.
const ENQUIRY_API = {
  list:   '/enquiry/',
  stats:  '/enquiry/stats/',
  detail: (id) => `/enquiry/${id}/`,
}

const PAGE_SIZE = 25

const STATUS_OPTIONS = [
  { value: '',           label: 'All statuses' },
  { value: 'new',        label: 'New' },
  { value: 'in_review',  label: 'In Review' },
  { value: 'contacted',  label: 'Contacted' },
  { value: 'resolved',   label: 'Resolved' },
  { value: 'spam',       label: 'Spam' },
]

const URGENCY_OPTIONS = [
  { value: '',       label: 'All urgencies' },
  { value: 'low',    label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high',   label: 'High' },
  { value: 'urgent', label: 'Urgent' },
]

const STATUS_BADGE = {
  new:       'bg-blue-100 text-blue-800 ring-1 ring-blue-200',
  in_review: 'bg-amber-100 text-amber-800 ring-1 ring-amber-200',
  contacted: 'bg-purple-100 text-purple-800 ring-1 ring-purple-200',
  resolved:  'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200',
  spam:      'bg-gray-200 text-gray-700 ring-1 ring-gray-300',
}

const URGENCY_BADGE = {
  low:    'bg-gray-100 text-gray-700',
  normal: 'bg-sky-100 text-sky-800',
  high:   'bg-orange-100 text-orange-800',
  urgent: 'bg-red-100 text-red-800',
}

const STATUS_LABEL = {
  new: 'New', in_review: 'In Review', contacted: 'Contacted', resolved: 'Resolved', spam: 'Spam',
}
const URGENCY_LABEL = {
  low: 'Low', normal: 'Normal', high: 'High', urgent: 'Urgent',
}

// Soft-coded service labels & badges — extend when new services are added.
// Password reset requests originate from /forgot-password when SMTP is
// unavailable, so we highlight them for the admin.
const SERVICE_LABEL = {
  'pid-analysis':          'P&ID Analysis',
  'pfd-conversion':        'PFD → P&ID',
  'asset-integrity':       'Asset Integrity',
  'engineering-consulting':'Engineering Consulting',
  'digital-twin':          'Digital Twin',
  'ai-ml-services':        'AI/ML Services',
  'password-reset':        '🔐 Password Reset',
  'general':               'General Enquiry',
  'other':                 'Other',
}
const SERVICE_BADGE = {
  'password-reset': 'bg-red-100 text-red-800 ring-1 ring-red-200 font-semibold',
}
const formatServiceLabel = (code) => SERVICE_LABEL[code] || (code || '—')

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function EnquiryManagement () {
  const [items, setItems]               = useState([])
  const [count, setCount]               = useState(0)
  const [page, setPage]                 = useState(1)
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState(null)

  const [stats, setStats]               = useState(null)

  const [search, setSearch]             = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [urgencyFilter, setUrgencyFilter] = useState('')

  const [selected, setSelected]         = useState(null)   // enquiry object shown in drawer
  const [savingPatch, setSavingPatch]   = useState(false)

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil((count || 0) / PAGE_SIZE)),
    [count]
  )

  const loadList = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await apiService.get(ENQUIRY_API.list, {
        params: {
          page,
          page_size: PAGE_SIZE,
          status:    statusFilter || undefined,
          urgency:   urgencyFilter || undefined,
          search:    search || undefined,
        },
      })
      setItems(data?.results || [])
      setCount(data?.count || 0)
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || 'Failed to load enquiries'
      setError(msg)
      setItems([])
      setCount(0)
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter, urgencyFilter, search])

  const loadStats = useCallback(async () => {
    try {
      const { data } = await apiService.get(ENQUIRY_API.stats)
      setStats(data)
    } catch {
      setStats(null)
    }
  }, [])

  useEffect(() => { loadList()  }, [loadList])
  useEffect(() => { loadStats() }, [loadStats])

  // Reset to page 1 whenever a filter / search changes
  useEffect(() => { setPage(1) }, [search, statusFilter, urgencyFilter])

  const refreshAll = () => { loadList(); loadStats() }

  const openDetail = async (row) => {
    try {
      const { data } = await apiService.get(ENQUIRY_API.detail(row.id))
      setSelected(data?.enquiry || row)
    } catch {
      setSelected(row)
    }
  }

  const patchSelected = async (patch) => {
    if (!selected) return
    setSavingPatch(true)
    try {
      const { data } = await apiService.patch(ENQUIRY_API.detail(selected.id), patch)
      const updated = data?.enquiry
      if (updated) {
        setSelected(updated)
        setItems((rows) => rows.map((r) => (r.id === updated.id ? updated : r)))
        loadStats()
      }
    } catch (e) {
      alert(e?.response?.data?.message || 'Update failed')
    } finally {
      setSavingPatch(false)
    }
  }

  const deleteEnquiry = async (row) => {
    if (!window.confirm(`Delete enquiry ${row.reference || row.id}? This cannot be undone.`)) return
    try {
      await apiService.delete(ENQUIRY_API.detail(row.id))
      setSelected((cur) => (cur && cur.id === row.id ? null : cur))
      refreshAll()
    } catch (e) {
      alert(e?.response?.data?.message || 'Delete failed')
    }
  }

  // ---- render -------------------------------------------------------------
  return (
    <div className="p-6 max-w-[1500px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md">
            <EnvelopeIcon className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Enquiry Management</h1>
            <p className="text-sm text-gray-500">
              Customer enquiries submitted from the public contact form (<code>/enquiry</code>).
            </p>
          </div>
        </div>
        <button
          onClick={refreshAll}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-gray-300 hover:bg-gray-50 text-sm font-medium"
        >
          <ArrowPathIcon className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Stat cards */}
      <StatCards stats={stats} />

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-2 relative">
            <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, email, company, subject or message…"
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select
            value={urgencyFilter}
            onChange={(e) => setUrgencyFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {URGENCY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <Th>Reference</Th>
                <Th>Received</Th>
                <Th>Name / Company</Th>
                <Th>Contact</Th>
                <Th>Subject</Th>
                <Th>Service</Th>
                <Th>Urgency</Th>
                <Th>Status</Th>
                <Th className="text-right pr-6">Actions</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && (
                <tr><td colSpan={9} className="py-10 text-center text-gray-500">Loading enquiries…</td></tr>
              )}
              {!loading && error && (
                <tr><td colSpan={9} className="py-10 text-center text-red-600">{error}</td></tr>
              )}
              {!loading && !error && items.length === 0 && (
                <tr><td colSpan={9} className="py-10 text-center text-gray-500">No enquiries found.</td></tr>
              )}
              {!loading && !error && items.map((row) => (
                <tr key={row.id} className="hover:bg-blue-50/40 cursor-pointer" onClick={() => openDetail(row)}>
                  <Td className="font-mono text-xs text-gray-700">{row.reference}</Td>
                  <Td className="text-sm text-gray-600">{formatDate(row.created_at)}</Td>
                  <Td>
                    <div className="text-sm font-medium text-gray-900">{row.name}</div>
                    {row.company && (
                      <div className="text-xs text-gray-500 flex items-center gap-1">
                        <BuildingOffice2Icon className="w-3.5 h-3.5" /> {row.company}
                      </div>
                    )}
                  </Td>
                  <Td>
                    <div className="text-sm text-gray-700">{row.email}</div>
                    <div className="text-xs text-gray-500 flex items-center gap-1">
                      <PhoneIcon className="w-3.5 h-3.5" /> {row.phone}
                    </div>
                  </Td>
                  <Td className="max-w-[240px] truncate text-sm text-gray-800" title={row.subject}>{row.subject}</Td>
                  <Td className="text-sm text-gray-700">
                    {SERVICE_BADGE[row.service] ? (
                      <Badge cls={SERVICE_BADGE[row.service]}>{formatServiceLabel(row.service)}</Badge>
                    ) : (
                      formatServiceLabel(row.service)
                    )}
                  </Td>
                  <Td><Badge cls={URGENCY_BADGE[row.urgency]}>{URGENCY_LABEL[row.urgency] || row.urgency}</Badge></Td>
                  <Td><Badge cls={STATUS_BADGE[row.status]}>{STATUS_LABEL[row.status] || row.status}</Badge></Td>
                  <Td className="text-right pr-6">
                    <div className="inline-flex items-center gap-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); openDetail(row) }}
                        className="p-1.5 rounded hover:bg-blue-100 text-blue-700"
                        title="View"
                      >
                        <EyeIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteEnquiry(row) }}
                        className="p-1.5 rounded hover:bg-red-100 text-red-600"
                        title="Delete"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && !error && count > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50">
            <div className="text-xs text-gray-600">
              Showing <span className="font-semibold">{(page - 1) * PAGE_SIZE + 1}</span>–
              <span className="font-semibold">{Math.min(page * PAGE_SIZE, count)}</span> of{' '}
              <span className="font-semibold">{count}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 text-xs rounded-md border border-gray-300 bg-white disabled:opacity-50 hover:bg-gray-50"
              >Prev</button>
              <span className="text-xs text-gray-700">Page {page} / {totalPages}</span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 text-xs rounded-md border border-gray-300 bg-white disabled:opacity-50 hover:bg-gray-50"
              >Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Detail drawer */}
      {selected && (
        <DetailDrawer
          enquiry={selected}
          saving={savingPatch}
          onClose={() => setSelected(null)}
          onPatch={patchSelected}
          onDelete={() => deleteEnquiry(selected)}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
const StatCards = ({ stats }) => {
  const cards = [
    { key: 'total',     label: 'Total Enquiries', value: stats?.total ?? 0,                        icon: InboxArrowDownIcon, color: 'from-blue-500 to-indigo-600' },
    { key: 'new',       label: 'New (Unhandled)', value: stats?.new ?? 0,                          icon: ExclamationTriangleIcon, color: 'from-rose-500 to-red-600' },
    { key: 'review',    label: 'In Review',       value: stats?.by_status?.in_review ?? 0,         icon: ClockIcon,         color: 'from-amber-500 to-orange-600' },
    { key: 'resolved',  label: 'Resolved',        value: stats?.by_status?.resolved ?? 0,          icon: CheckCircleIcon,   color: 'from-emerald-500 to-green-600' },
  ]
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      {cards.map((c) => (
        <div key={c.key} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wide">{c.label}</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">{c.value}</div>
            </div>
            <div className={`p-2.5 rounded-lg bg-gradient-to-br ${c.color} text-white`}>
              <c.icon className="w-5 h-5" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

const Th = ({ children, className = '' }) => (
  <th className={`px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider ${className}`}>{children}</th>
)

const Td = ({ children, className = '' }) => (
  <td className={`px-4 py-3 align-top ${className}`}>{children}</td>
)

const Badge = ({ children, cls = 'bg-gray-100 text-gray-700' }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{children}</span>
)

const formatDate = (iso) => {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    return d.toLocaleString(undefined, { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })
  } catch { return iso }
}

// ---------------------------------------------------------------------------
// Detail drawer (right-side panel)
// ---------------------------------------------------------------------------
const DetailDrawer = ({ enquiry, saving, onClose, onPatch, onDelete }) => {
  const [notes, setNotes] = useState(enquiry.admin_notes || '')

  useEffect(() => { setNotes(enquiry.admin_notes || '') }, [enquiry.id, enquiry.admin_notes])

  const saveNotes = () => onPatch({ admin_notes: notes })

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <aside className="absolute right-0 top-0 h-full w-full max-w-xl bg-white shadow-2xl flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-start justify-between">
          <div>
            <div className="text-xs text-gray-500 font-mono">{enquiry.reference}</div>
            <h2 className="text-lg font-semibold text-gray-900">{enquiry.subject}</h2>
            <div className="text-xs text-gray-500 mt-0.5">Received {formatDate(enquiry.created_at)}</div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100"><XMarkIcon className="w-5 h-5" /></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Customer */}
          <Section title="Customer">
            <KV k="Name"     v={enquiry.name} />
            <KV k="Email"    v={<a className="text-blue-600 hover:underline" href={`mailto:${enquiry.email}`}>{enquiry.email}</a>} />
            <KV k="Phone"    v={<a className="text-blue-600 hover:underline" href={`tel:${enquiry.phone}`}>{enquiry.phone}</a>} />
            <KV k="Company"  v={enquiry.company || '—'} />
            <KV k="Service"  v={formatServiceLabel(enquiry.service)} />
          </Section>

          {/* Message */}
          <Section title="Message">
            <div className="whitespace-pre-wrap text-sm text-gray-800 bg-gray-50 border border-gray-200 rounded-lg p-3">
              {enquiry.message}
            </div>
          </Section>

          {/* Triage */}
          <Section title="Triage">
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs text-gray-600">
                Status
                <select
                  value={enquiry.status}
                  onChange={(e) => onPatch({ status: e.target.value })}
                  disabled={saving}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {STATUS_OPTIONS.filter((o) => o.value).map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </label>
              <label className="block text-xs text-gray-600">
                Urgency
                <select
                  value={enquiry.urgency}
                  onChange={(e) => onPatch({ urgency: e.target.value })}
                  disabled={saving}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {URGENCY_OPTIONS.filter((o) => o.value).map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </label>
            </div>

            <label className="block mt-4 text-xs text-gray-600">
              Internal notes
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                placeholder="Notes for the internal team…"
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
            <div className="mt-2 text-right">
              <button
                onClick={saveNotes}
                disabled={saving || notes === (enquiry.admin_notes || '')}
                className="px-3 py-1.5 rounded-md bg-blue-600 text-white text-sm font-medium disabled:opacity-50 hover:bg-blue-700"
              >
                {saving ? 'Saving…' : 'Save notes'}
              </button>
            </div>
          </Section>

          {/* Meta */}
          <Section title="Meta">
            <KV k="Source IP"  v={enquiry.source_ip || '—'} />
            <KV k="User Agent" v={<span className="text-xs break-all">{enquiry.user_agent || '—'}</span>} />
            <KV k="Updated"    v={formatDate(enquiry.updated_at)} />
          </Section>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-200 flex justify-between bg-gray-50">
          <button
            onClick={onDelete}
            className="inline-flex items-center gap-1.5 text-sm text-red-600 hover:text-red-700"
          >
            <TrashIcon className="w-4 h-4" /> Delete enquiry
          </button>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-md bg-white border border-gray-300 text-sm hover:bg-gray-100"
          >Close</button>
        </div>
      </aside>
    </div>
  )
}

const Section = ({ title, children }) => (
  <div>
    <div className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold mb-2">{title}</div>
    <div className="space-y-1.5">{children}</div>
  </div>
)

const KV = ({ k, v }) => (
  <div className="flex text-sm">
    <div className="w-28 shrink-0 text-gray-500">{k}</div>
    <div className="flex-1 text-gray-800">{v}</div>
  </div>
)
