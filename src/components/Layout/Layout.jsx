import React, { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useSelector } from 'react-redux'
import Header from './Header'
import Footer from './Footer'
import Sidebar from './Sidebar'
import {
  HEADER_HEIGHT_CLASS,
  getMainMarginClass,
} from '../../config/layout.config'

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

  // Routes where sidebar should be hidden
  // SOFT-CODED: Removed '/pricing' route for in-house deployment (no subscriptions)
  const publicRoutes = ['/', '/login', '/home', '/enquiry', '/solutions', '/about', '/services/pid-analysis', '/services/pfd-conversion', '/services/asset-integrity', '/services/consulting', '/data-governance', '/security', '/terms-of-service', '/privacy-policy']

  const showSidebar = isAuthenticated && !publicRoutes.includes(location.pathname)
  // Hide the shared footer on public pages that render their own (e.g. Home)
  const showFooter = !publicRoutes.includes(location.pathname)

  const mainMarginClass = getMainMarginClass(showSidebar, sidebarOpen, sidebarCollapsed)

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} showSidebar={showSidebar} />
      <div className={`flex flex-1 ${HEADER_HEIGHT_CLASS}`}>
        {showSidebar && (
          <Sidebar
            isOpen={sidebarOpen}
            setIsOpen={setSidebarOpen}
            isCollapsed={sidebarCollapsed}
            setIsCollapsed={setSidebarCollapsed}
          />
        )}
        <main
          className={`flex-grow min-w-0 transition-all duration-300 ${mainMarginClass} overflow-x-hidden`}
        >
          <Outlet />
        </main>
      </div>
      {showFooter && <Footer />}
    </div>
  )
}

export default Layout
