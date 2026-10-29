/**
 * KPI tile (spec §1): 12px label · 24px/700 value · 11.5px meta.
 * Clickable tiles navigate to a filtered view. Values are always computed
 * from the same source list by the caller — never stored separately.
 */
export default function KpiTile({ label, value, meta = null, danger = false, onClick = null }) {
  const cls = `pc-kpi${onClick ? ' pc-kpi-clickable' : ''}`
  const body = (
    <>
      <span className="pc-kpi-label">{label}</span>
      <span className={`pc-kpi-value${danger ? ' pc-kpi-value-danger' : ''}`}>{value ?? '—'}</span>
      {meta && <span className="pc-kpi-meta">{meta}</span>}
    </>
  )
  if (onClick) {
    return (
      <button type="button" className={cls} onClick={onClick}>
        {body}
      </button>
    )
  }
  return <div className={cls}>{body}</div>
}
