import React, { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useSelector } from 'react-redux'
import Header from './Header'
import Footer from './Footer'
import Sidebar from './Sidebar'
import { HEADER_HEIGHT_CLASS } from '../../config/layout.config'
import { isPublicPath } from '../../config/publicRoutes.config'

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
  const isPublicRoute = isPublicPath(location.pathname)

  const showSidebar = isAuthenticated && !isPublicRoute
  const showHeader = isAuthenticated && !isPublicRoute
  // Hide the shared footer on public pages that render their own or are auth flow pages.
  const showFooter = !isPublicRoute

  const contentOffsetClass = showHeader ? HEADER_HEIGHT_CLASS : ''

  return (
    <div className="app-theme-root min-h-screen flex flex-col bg-gray-50 text-gray-900 transition-colors duration-200 dark:bg-gray-900 dark:text-gray-100">
      {showHeader && (
        <Header />
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
        <main className={`main-content flex-1 min-w-0 bg-gray-50 text-gray-900 transition-all duration-300 overflow-x-hidden dark:bg-gray-900 dark:text-gray-100 ${showHeader ? 'pt-2 sm:pt-3' : ''}`}>
          <Outlet />
        </main>
      </div>
      {showFooter && <Footer />}
    </div>
  )
}

export default Layout
