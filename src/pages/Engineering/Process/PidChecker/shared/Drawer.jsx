/**
 * Drawer (spec §1): right side, 520–640px (full width on phone), scrim,
 * Esc closes, focus trapped.
 */
import { useEffect, useRef } from 'react'

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export default function Drawer({ open, onClose, title, wide = false, footer = null, children }) {
  const drawerRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const onKey = event => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose?.()
      }
      if (event.key === 'Tab' && drawerRef.current) {
        const items = Array.from(drawerRef.current.querySelectorAll(FOCUSABLE))
        if (items.length === 0) return
        const first = items[0]
        const last = items[items.length - 1]
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey, true)
    const previous = document.activeElement
    const firstField = drawerRef.current?.querySelector(FOCUSABLE)
    firstField?.focus()
    return () => {
      document.removeEventListener('keydown', onKey, true)
      if (previous && typeof previous.focus === 'function') previous.focus()
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="pc-drawer-backdrop"
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose?.()
      }}
    >
      <div
        ref={drawerRef}
        className={`pc-drawer${wide ? ' pc-drawer-wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
      >
        <div className="pc-drawer-header">
          <h2 className="pc-drawer-title">{title}</h2>
          <button type="button" className="pc-icon-btn" onClick={onClose} aria-label="Close drawer">
            <span aria-hidden="true">×</span>
          </button>
        </div>
        <div className="pc-drawer-body">{children}</div>
        {footer && <div className="pc-drawer-footer">{footer}</div>}
      </div>
    </div>
  )
}
