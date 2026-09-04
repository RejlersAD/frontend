import React, { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useSelector } from 'react-redux'
import Header from './Header'
import Footer from './Footer'
import Sidebar from './Sidebar'
import ProcurementApprovalReminder from '../ProcurementApprovalReminder'
import apiClient from '../../services/api.service'

/**
 * Layout Component
 * Smart layout wrapper with sidebar, header and footer.
 * Sidebar width + main-content offset are driven by config/layout.config.js
 * so the two stay in sync (no overlap, no gap).
 */

const Layout = () => {
  const location = useLocation()
  const { isAuthenticated, user } = useSelector((state) => state.auth)
  const [authenticatedProfilePhoto, setAuthenticatedProfilePhoto] = useState(null)
  const isDesktopViewport = () => (
    typeof window === 'undefined' || window.matchMedia('(min-width: 1024px)').matches
  )
  const [sidebarOpen, setSidebarOpen] = useState(isDesktopViewport)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(isDesktopViewport)

  useEffect(() => {
    const desktopQuery = window.matchMedia('(min-width: 1024px)')
    const handleViewportChange = (event) => {
      setSidebarOpen(event.matches)
      setSidebarCollapsed(event.matches)
    }

    desktopQuery.addEventListener('change', handleViewportChange)
    return () => desktopQuery.removeEventListener('change', handleViewportChange)
  }, [])

  // Resolve the current employee photo once at shell level so every global
  // avatar uses the same authenticated, durable image source. Object URLs are
  // intentionally kept out of persisted Redux/localStorage state.
  useEffect(() => {
    if (!isAuthenticated || !user) {
      setAuthenticatedProfilePhoto(null)
      return undefined
    }

    let active = true
    let objectUrl = null
    setAuthenticatedProfilePhoto(null)

    apiClient.get('/users/employees/my-profile-photo/', {
      responseType: 'blob',
      silentTimeout: true,
    })
      .then((response) => {
        if (!active || !response?.data || !String(response.data.type || '').startsWith('image/')) return
        objectUrl = URL.createObjectURL(response.data)
        setAuthenticatedProfilePhoto(objectUrl)
      })
      .catch(() => {
        if (active) setAuthenticatedProfilePhoto(null)
      })

    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [isAuthenticated, user?.id, user?.user?.id, user?.profile_photo])

  // Public pages render their own navigation experience and should not show
  // the shared authenticated shell even when the user is logged in.
  const publicRoutes = [
    '/',
    '/home',
    '/login',
    '/enquiry',
    '/enquiries',
    '/solutions',
    '/about',
    '/services/pid-analysis',
    '/services/pfd-conversion',
    '/services/asset-integrity',
    '/services/consulting',
    '/data-governance',
    '/security',
    '/terms-of-service',
    '/privacy-policy',
    '/setup-password',
    '/reset-password',
    '/request-password-reset',
    '/forgot-password',
  ]

  const publicRoutePrefixes = ['/services/', '/finance/approve/']
  const isPublicRoute =
    publicRoutes.includes(location.pathname) ||
    publicRoutePrefixes.some((prefix) => location.pathname.startsWith(prefix))

  const showSidebar = isAuthenticated && !isPublicRoute
  const showHeader = isAuthenticated && !isPublicRoute
  const isApplicationShell = isAuthenticated && !isPublicRoute
  const isPurchaseRecommendationFormRoute = (
    location.pathname === '/procurement/requisitions/new'
    || /^\/procurement\/requisitions\/[^/]+\/edit$/.test(location.pathname)
  )
  const isViewportWorkspace = ['/dashboard', '/approvals', '/notifications'].includes(location.pathname)
  const isFlushWorkspace = ['/profile', '/hr/Employeprofile'].includes(location.pathname)
  // Hide the shared footer on public pages that render their own or are auth flow pages.
  const showFooter = !isPublicRoute && !isPurchaseRecommendationFormRoute && !isViewportWorkspace && !isFlushWorkspace

  return (
    <div className={`${isApplicationShell ? 'h-dvh overflow-hidden' : 'min-h-screen'} flex bg-gray-50 dark:bg-gray-900`}>
      {showSidebar && (
        <Sidebar
          isOpen={sidebarOpen}
          setIsOpen={setSidebarOpen}
          isCollapsed={sidebarCollapsed}
          setIsCollapsed={setSidebarCollapsed}
          profilePhotoUrl={authenticatedProfilePhoto}
        />
      )}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {showHeader && (
          <Header
            sidebarOpen={sidebarOpen}
            setSidebarOpen={setSidebarOpen}
            showSidebar={showSidebar}
            profilePhotoUrl={authenticatedProfilePhoto}
          />
        )}
        <main className={`main-content min-w-0 flex-1 overflow-x-hidden transition-all duration-300 ${isApplicationShell ? 'min-h-0' : ''} ${isViewportWorkspace ? 'overflow-y-hidden' : isApplicationShell ? 'overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden' : ''} ${showHeader && !isFlushWorkspace ? 'pt-2 sm:pt-3' : ''}`}>
          <Outlet />
        </main>
        {showFooter && <Footer />}
      </div>

      {showHeader && <ProcurementApprovalReminder />}
    </div>
  )
}

export default Layout
