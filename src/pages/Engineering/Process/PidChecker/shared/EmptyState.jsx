/**
 * Empty state (spec §1): neutral text saying what to do next.
 * Features waiting on backend show "Available after …". Never sample numbers.
 */
export default function EmptyState({ title, children, action = null }) {
  return (
    <div className="pc-empty">
      <p className="pc-empty-title">{title}</p>
      {children && <p className="pc-empty-text">{children}</p>}
      {action}
    </div>
  )
}
