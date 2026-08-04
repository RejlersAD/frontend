import React from 'react'
import { BookOpen } from 'lucide-react'
import { Link } from 'react-router-dom'

// Small pill shown at the top of any legend-aware extraction page. Displays
// the active legend name + field count and links to the full legend canvas
// scoped to the same section. Purely presentational.
export default function ActiveLegendBadge({ section, legend, loading }) {
  const fieldCount = Array.isArray(legend?.definition?.fields) ? legend.definition.fields.length : 0
  const href = `/engineering/process/pid-checker-v2/legends?section=${encodeURIComponent(section)}`
  const label = loading
    ? 'Loading active legend…'
    : legend
      ? `Active legend: ${legend.name} · ${fieldCount} field${fieldCount === 1 ? '' : 's'}`
      : 'No active legend — using built-in defaults'
  const tone = legend ? '#7c3aed' : '#64748b'
  return (
    <Link
      to={href}
      title="Open Legend Sheets Canvas"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '4px 10px', borderRadius: 999,
        background: legend ? 'rgba(124,58,237,0.08)' : '#f1f5f9',
        color: tone, border: `1px solid ${legend ? 'rgba(124,58,237,0.25)' : '#e2e8f0'}`,
        fontSize: 12, fontWeight: 600, textDecoration: 'none',
      }}
    >
      <BookOpen size={13} />
      <span>{label}</span>
    </Link>
  )
}
