/* eslint-disable react/prop-types */
const tones = {
  available: 'bg-emerald-50 text-emerald-800', healthy: 'bg-emerald-50 text-emerald-800',
  accepted: 'bg-emerald-50 text-emerald-800', indexed: 'bg-slate-100 text-slate-700',
  pending: 'bg-amber-50 text-amber-900', pending_review: 'bg-amber-50 text-amber-900',
  stale: 'bg-amber-50 text-amber-900', failed: 'bg-rose-50 text-rose-800',
  error: 'bg-rose-50 text-rose-800', rejected: 'bg-rose-50 text-rose-800',
  missing: 'bg-rose-50 text-rose-800', offline: 'bg-slate-100 text-slate-700',
}
export default function ReplicaStatus({ status, label }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${tones[status] || 'bg-slate-100 text-slate-700'}`}>{label || (status || 'Not connected').replaceAll('_', ' ')}</span>
}
export const dateLabel = value => value ? new Date(value).toLocaleString() : 'Never'
export const sizeLabel = value => {
  if (value == null) return '—'
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}
