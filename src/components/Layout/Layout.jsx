import React, { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useSelector } from 'react-redux'
import Header from './Header'
import Footer from './Footer'
import Sidebar from './Sidebar'
import { HEADER_HEIGHT_CLASS } from '../../config/layout.config'
import ProcurementApprovalReminder from '../ProcurementApprovalReminder'

/**
 * Layout Component
 * Smart layout wrapper with sidebar, header and footer.
 * Sidebar width + main-content offset are driven by config/layout.config.js
 * so the two stay in sync (no overlap, no gap).
 */

const Layout = () => {
  const location = useLocation()
  const { isAuthenticated } = useSelector((state) => state.auth)
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
  // Hide the shared footer on public pages that render their own or are auth flow pages.
  const showFooter = !isPublicRoute && !isPurchaseRecommendationFormRoute && !isViewportWorkspace

  const contentOffsetClass = showHeader ? HEADER_HEIGHT_CLASS : ''

  return (
    <div className={`${isApplicationShell ? 'h-screen overflow-hidden' : 'min-h-screen'} flex flex-col bg-gray-50 dark:bg-gray-900`}>
      {showHeader && (
        <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} showSidebar={showSidebar} />
      )}
      <div className={`flex min-h-0 flex-1 ${contentOffsetClass}`}>
        {showSidebar && (
          <Sidebar
            isOpen={sidebarOpen}
            setIsOpen={setSidebarOpen}
            isCollapsed={sidebarCollapsed}
            setIsCollapsed={setSidebarCollapsed}
            showHeader={showHeader}
          />
        )}
        <main className={`main-content min-w-0 flex-1 overflow-x-hidden transition-all duration-300 ${isApplicationShell ? 'min-h-0' : ''} ${isViewportWorkspace ? 'overflow-y-hidden' : isApplicationShell ? 'overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden' : ''} ${showHeader ? 'pt-2 sm:pt-3' : ''}`}>
          <Outlet />
        </main>
      </div>
      {showFooter && <Footer />}
      {showHeader && <ProcurementApprovalReminder />}
    </div>
  )
}

export default Layout
