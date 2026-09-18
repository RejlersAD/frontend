import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import PropTypes from 'prop-types'
import { CheckCircle2, X } from 'lucide-react'

export default function ScheduleNotice({ message, onClose }) {
  const [paused, setPaused] = useState(false)
  useEffect(() => {
    if (paused) return undefined
    const timer = window.setTimeout(onClose, 6500)
    return () => window.clearTimeout(timer)
  }, [message, onClose, paused])
  return createPortal(<div className="prv-toast" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
    <CheckCircle2 size={18} aria-hidden="true" />
    <span role="status" aria-live="polite">{message}</span>
    <button type="button" aria-label="Dismiss schedule notification" onClick={onClose}><X size={16} /></button>
  </div>, document.body)
}

ScheduleNotice.propTypes = { message: PropTypes.string.isRequired, onClose: PropTypes.func.isRequired }
