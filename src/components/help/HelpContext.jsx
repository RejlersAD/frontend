import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { useLocation } from 'react-router-dom'

import { resolveHelpContext } from '../../config/helpContextRegistry'

const HelpContext = createContext(null)

export function HelpContextProvider({ children }) {
  const location = useLocation()
  const [isOpen, setIsOpen] = useState(false)
  const triggerRef = useRef(null)

  const helpContext = useMemo(
    () => resolveHelpContext(location.pathname, location.search),
    [location.pathname, location.search],
  )

  const openHelp = useCallback((trigger) => {
    triggerRef.current = trigger || document.activeElement
    setIsOpen(true)
  }, [])

  const closeHelp = useCallback(({ restoreFocus = true } = {}) => {
    setIsOpen(false)
    if (restoreFocus) window.setTimeout(() => triggerRef.current?.focus(), 0)
  }, [])

  const value = useMemo(() => ({
    helpContext,
    isOpen,
    openHelp,
    closeHelp,
  }), [closeHelp, helpContext, isOpen, openHelp])

  return <HelpContext.Provider value={value}>{children}</HelpContext.Provider>
}

HelpContextProvider.propTypes = {
  children: PropTypes.node.isRequired,
}

export function useHelpContext() {
  const value = useContext(HelpContext)
  if (!value) throw new Error('useHelpContext must be used within HelpContextProvider')
  return value
}
