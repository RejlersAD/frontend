import React, { useLayoutEffect, useRef } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useSelector } from 'react-redux'
import Header from './Header'
import FinanceCommandHeader from '../Finance/FinanceCommandHeader'
import ProcurementOverviewHeader from './ProcurementOverviewHeader'
import Footer from './Footer'
import Sidebar from './Sidebar'
import ProcurementApprovalReminder from '../ProcurementApprovalReminder'
import useAuthenticatedPhoto from '../../hooks/useAuthenticatedPhoto'
import useSidebarLayout from '../../hooks/useSidebarLayout'
import { ProfilePhotoContext } from './ProfilePhotoContext'
import { HelpContextProvider } from '../help/HelpContext'
import ContextualHelpDrawer from '../help/ContextualHelpDrawer'

/**
 * Layout Component
 * Smart layout wrapper with sidebar, header and footer.
 * Sidebar widths come from config/layout.config.js; the flex content fills
 * the remaining space as the navigation expands or collapses.
 */

const Layout = () => {
  const location = useLocation()
  const { isAuthenticated, user } = useSelector((state) => state.auth)
  const authenticatedProfilePhoto = useAuthenticatedPhoto(isAuthenticated ? '/users/employees/my-profile-photo/' : null, `${user?.id || user?.user?.id}:${user?.profile_photo || ''}`)
  const {
    isDesktop,
    sidebarOpen,
    setSidebarOpen,
    sidebarCollapsed,
    setSidebarCollapsed,
  } = useSidebarLayout()
  const applicationContentRef = useRef(null)

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
  const isMobileDrawerOpen = showSidebar && sidebarOpen && !isDesktop

  useLayoutEffect(() => {
    const content = applicationContentRef.current
    content?.toggleAttribute('inert', isMobileDrawerOpen)
    return () => content?.removeAttribute('inert')
  }, [isMobileDrawerOpen])

  const isPurchaseRecommendationFormRoute = (
    location.pathname === '/procurement/requisitions/new'
    || /^\/procurement\/requisitions\/[^/]+\/edit$/.test(location.pathname)
  )
  const isPurchaseOrderFormRoute = location.pathname === '/procurement/orders/new'
  const isViewportWorkspace = ['/dashboard', '/executive', '/approvals', '/notifications', '/admin/enquiries'].includes(location.pathname)
  const isVendorWorkspace = location.pathname === '/procurement/vendors'
  const isFlushWorkspace = ['/profile', '/hr/Employeprofile'].includes(location.pathname)
  const isFinanceCommandWorkspace = ['/finance', '/finance/'].includes(location.pathname)
  const isProcurementOverview = ['/procurement', '/procurement/'].includes(location.pathname)
  // Hide the shared footer on public pages that render their own or are auth flow pages.
  const showFooter = !isPublicRoute && !isPurchaseRecommendationFormRoute && !isPurchaseOrderFormRoute && !isViewportWorkspace && !isFlushWorkspace && !isFinanceCommandWorkspace && !isProcurementOverview

  const application = (
    <div className={`${isApplicationShell ? 'h-dvh overflow-hidden' : 'min-h-screen'} flex bg-gray-50 dark:bg-gray-900`}>
      {showSidebar && (
        <Sidebar
          isOpen={sidebarOpen}
          setIsOpen={setSidebarOpen}
          isCollapsed={sidebarCollapsed}
          setIsCollapsed={setSidebarCollapsed}
        />
      )}

      <div
        id="application-content"
        ref={applicationContentRef}
        aria-hidden={isMobileDrawerOpen ? true : undefined}
        className="isolate flex min-h-0 min-w-0 flex-1 flex-col"
      >
        {showHeader && isFinanceCommandWorkspace && <FinanceCommandHeader sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} profilePhotoUrl={authenticatedProfilePhoto} />}
        {showHeader && isProcurementOverview && <ProcurementOverviewHeader sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} profilePhotoUrl={authenticatedProfilePhoto} />}
        {showHeader && !isFinanceCommandWorkspace && !isProcurementOverview && (
          <Header
            sidebarOpen={sidebarOpen}
            setSidebarOpen={setSidebarOpen}
            showSidebar={showSidebar}
            profilePhotoUrl={authenticatedProfilePhoto}
          />
        )}
        <main className={`main-content min-w-0 flex-1 overflow-x-hidden transition-all duration-300 ${isApplicationShell ? 'min-h-0' : ''} ${isVendorWorkspace ? 'supplier-workspace-main' : ''} ${isProcurementOverview ? 'procurement-overview-main' : ''} ${isViewportWorkspace ? 'overflow-y-hidden' : isApplicationShell ? 'overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden' : ''} ${showHeader && !isFlushWorkspace && !isFinanceCommandWorkspace && !isProcurementOverview ? 'pt-2 sm:pt-3' : ''}`}>
          <Outlet />
        </main>
        {showFooter && <Footer />}
        {showHeader && location.pathname !== '/executive' && <ProcurementApprovalReminder />}
      </div>

      {showHeader && <ContextualHelpDrawer />}
    </div>
  )

  return isApplicationShell
    ? <ProfilePhotoContext.Provider value={{ photo: authenticatedProfilePhoto, userId: user?.user?.id || user?.id, email: user?.email || user?.user?.email }}><HelpContextProvider>{application}</HelpContextProvider></ProfilePhotoContext.Provider>
    : application
}

export default Layout
