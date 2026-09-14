import { useEffect, useLayoutEffect, useRef, useState } from 'react'

const MOBILE_QUERY = '(max-width: 1023px)'
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export default function useSidebarDrawer({ sidebarRef, isOpen, setIsOpen }) {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(MOBILE_QUERY).matches)
  const openerRef = useRef(null)
  const isMobileDrawer = isMobile && isOpen

  useEffect(() => {
    const query = window.matchMedia(MOBILE_QUERY)
    const update = (event) => setIsMobile(event.matches)
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  // Capture the opener before the layout makes the page behind the drawer inert.
  useLayoutEffect(() => {
    if (isMobileDrawer) openerRef.current = document.activeElement
  }, [isMobileDrawer])

  useEffect(() => {
    if (!isMobileDrawer) return undefined
    const sidebar = sidebarRef.current
    const focusableItems = () => [...sidebar.querySelectorAll(FOCUSABLE)]
      .filter((element) => element.getClientRects().length && !element.closest('[inert]'))
    const focusFirst = () => (focusableItems()[0] || sidebar).focus()
    focusFirst()

    const handleKeyDown = (event) => {
      if (event.defaultPrevented) return
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        setIsOpen(false)
      } else if (event.key === 'Tab') {
        const items = focusableItems()
        const first = items[0]
        const last = items[items.length - 1]
        if (!items.length) {
          event.preventDefault()
          sidebar.focus()
        } else if (event.shiftKey && (document.activeElement === first || !sidebar.contains(document.activeElement))) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && (document.activeElement === last || !sidebar.contains(document.activeElement))) {
          event.preventDefault()
          first.focus()
        }
      }
    }
    const containFocus = (event) => {
      if (!sidebar.contains(event.target)) focusFirst()
    }
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('focusin', containFocus)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('focusin', containFocus)
      // Restore after the shell's inert state and responsive controls update.
      requestAnimationFrame(() => {
        const opener = openerRef.current
        if (opener?.isConnected && opener.getClientRects().length && !opener.closest('[inert]')) {
          opener.focus()
        } else if (window.matchMedia(MOBILE_QUERY).matches) {
          document.querySelector('[aria-controls="application-sidebar"]')?.focus()
        } else {
          sidebar.querySelector('[data-sidebar-toggle]')?.focus()
        }
      })
    }
  }, [isMobileDrawer, setIsOpen, sidebarRef])

  return isMobileDrawer
}
