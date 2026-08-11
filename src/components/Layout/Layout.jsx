import React, { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useSelector } from 'react-redux'
import Header from './Header'
import Footer from './Footer'
import Sidebar from './Sidebar'
import { HEADER_HEIGHT_CLASS } from '../../config/layout.config'

/**
 * Layout Component
 * Smart layout wrapper with sidebar, header and footer.
 * Sidebar width + main-content offset are driven by config/layout.config.js
 * so the two stay in sync (no overlap, no gap).
 */

const Layout = () => {
  const location = useLocation()
  const { isAuthenticated } = useSelector((state) => state.auth)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  // Public pages render their own navigation experience and should not show
  // the shared authenticated shell even when the user is logged in.
  const publicRoutes = [
    '/',
    '/home',
    '/login',
    '/enquiry',
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
  // Hide the shared footer on public pages that render their own or are auth flow pages.
  const showFooter = !isPublicRoute

  const contentOffsetClass = showHeader ? HEADER_HEIGHT_CLASS : ''

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {showHeader && (
        <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} showSidebar={showSidebar} />
      )}
      <div className={`flex flex-1 ${contentOffsetClass}`}>
        {showSidebar && (
          <Sidebar
            isOpen={sidebarOpen}
            setIsOpen={setSidebarOpen}
            isCollapsed={sidebarCollapsed}
            setIsCollapsed={setSidebarCollapsed}
            showHeader={showHeader}
          />
        )}
        <main className={`main-content flex-1 min-w-0 transition-all duration-300 overflow-x-hidden ${showHeader ? 'pt-2 sm:pt-3' : ''}`}>
          <Outlet />
        </main>
      </div>
      {showFooter && <Footer />}
    </div>
  )
}

export default Layout
