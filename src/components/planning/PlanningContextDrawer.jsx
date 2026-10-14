import { useEffect, useId, useRef } from 'react'
import PropTypes from 'prop-types'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import './PlanningContextDrawer.css'

export default function PlanningContextDrawer({ title, busy = false, onClose, children }) {
  const ref = useRef(null), id = useId()
  useEffect(() => {
    const drawer = ref.current, opener = document.activeElement
    drawer.showModal()
    return () => { drawer.close(); if (opener?.isConnected) opener.focus({ preventScroll: true }) }
  }, [])
  return createPortal(<dialog ref={ref} className="planning-context-drawer" aria-labelledby={id} onCancel={event => { if (busy) event.preventDefault(); else onClose() }}>
    <header><h2 id={id}>{title}</h2><button type="button" aria-label={`Close ${title}`} disabled={busy} onClick={onClose}><X size={19} /></button></header>
    <div className="pcd-content">{children}</div>
  </dialog>, document.body)
}
PlanningContextDrawer.propTypes = { title: PropTypes.string.isRequired, busy: PropTypes.bool, onClose: PropTypes.func.isRequired, children: PropTypes.node }
