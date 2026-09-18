import React, { useEffect, useRef } from 'react'
import PropTypes from 'prop-types'

/** Native disclosure keeps controls keyboard accessible without imposing menu navigation on form fields. */
export default function ScheduleToolbarMenu({ label, children, className = '', disabled = false, name }) {
  const ref = useRef(null)
  useEffect(() => {
    const closeOutside = event => {
      if (ref.current?.open && !ref.current.contains(event.target)) ref.current.open = false
    }
    document.addEventListener('pointerdown', closeOutside)
    return () => document.removeEventListener('pointerdown', closeOutside)
  }, [])
  useEffect(() => { if (disabled && ref.current) ref.current.open = false }, [disabled])
  return <details ref={ref} className={`sc-menu ${className}`} onKeyDown={event => {
    if (event.key === 'Escape' && ref.current.open) {
      event.preventDefault(); event.stopPropagation(); ref.current.open = false
      ref.current.querySelector('summary')?.focus()
    }
  }}>
    <summary aria-label={name} aria-disabled={disabled || undefined} onClick={event => {
      if (disabled) event.preventDefault()
    }}>{label}</summary>
    <div className="sc-menu-content" onClick={event => {
      if (event.target.closest('button[data-close-menu]')) {
        ref.current.open = false
        ref.current.querySelector('summary')?.focus({ preventScroll: true })
      }
    }}>{children}</div>
  </details>
}

ScheduleToolbarMenu.propTypes = {
  label: PropTypes.node.isRequired, children: PropTypes.node.isRequired,
  className: PropTypes.string, disabled: PropTypes.bool, name: PropTypes.string.isRequired,
}
