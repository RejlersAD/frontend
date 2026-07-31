import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * Resets scroll position to the top on every route change.
 * React Router (client-side navigation) preserves scroll by default,
 * so without this, navigating to a new page keeps the old page's
 * scroll offset instead of starting fresh at the top.
 */
const ScrollToTop = () => {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return null
}

export default ScrollToTop
