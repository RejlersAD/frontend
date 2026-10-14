import { useCallback, useEffect, useState } from 'react'

const DESKTOP_MEDIA_QUERY = '(min-width: 1024px)'
const COLLAPSED_STORAGE_KEY = 'radai.sidebar.collapsed'

const isDesktopViewport = () => (
  typeof window === 'undefined' || window.matchMedia(DESKTOP_MEDIA_QUERY).matches
)

const readDesktopCollapsed = () => {
  try {
    return typeof window !== 'undefined'
      && window.localStorage.getItem(COLLAPSED_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

/** Keep the desktop preference independent from the mobile drawer state. */
export default function useSidebarLayout() {
  const [isDesktop, setIsDesktop] = useState(isDesktopViewport)
  const [sidebarOpen, setSidebarOpen] = useState(isDesktopViewport)
  const [desktopCollapsed, setDesktopCollapsed] = useState(readDesktopCollapsed)

  useEffect(() => {
    const desktopQuery = window.matchMedia(DESKTOP_MEDIA_QUERY)
    const handleViewportChange = (event) => {
      setIsDesktop(event.matches)
      setSidebarOpen(event.matches)
    }

    desktopQuery.addEventListener('change', handleViewportChange)
    return () => desktopQuery.removeEventListener('change', handleViewportChange)
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem(COLLAPSED_STORAGE_KEY, String(desktopCollapsed))
    } catch {
      // Navigation remains usable when the browser blocks local storage.
    }
  }, [desktopCollapsed])

  const setSidebarCollapsed = useCallback((nextValue) => {
    if (!isDesktop) return
    setDesktopCollapsed((currentValue) => Boolean(
      typeof nextValue === 'function' ? nextValue(currentValue) : nextValue,
    ))
  }, [isDesktop])

  return {
    isDesktop,
    sidebarOpen,
    setSidebarOpen,
    sidebarCollapsed: isDesktop && desktopCollapsed,
    setSidebarCollapsed,
  }
}
