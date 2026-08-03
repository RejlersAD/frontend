import React from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import { logout } from '../../store/slices/authSlice'
import { toggleTheme } from '../../store/slices/themeSlice'
import { Bars3Icon } from '@heroicons/react/24/outline'
import { LOGO_CONFIG, getLogoPath } from '../../config/logo.config'
import NotificationBell from '../notifications/NotificationBell'
import { USER_DISPLAY_CONFIG } from '../../config/userDisplay.config'
import { 
  getAuthenticatedNavItems, 
  getPublicNavItems, 
  getNavItemClass, 
  getNavIcon,
  NAV_ITEM_TYPES
} from '../../config/headerNavigation.config'

/**
 * Header Component - REJLERS RADAI  
 * Premium navigation header with REJLERS branding
 */

const Header = ({ sidebarOpen, setSidebarOpen, showSidebar }) => {
  const navigate = useNavigate()
  const location = useLocation()
  const dispatch = useDispatch()
  const { isAuthenticated, user } = useSelector((state) => state.auth)
  const rbacData = useSelector((state) => state.rbac?.currentUser)
  const { mode } = useSelector((state) => state.theme)

  const handleLogout = () => {
    dispatch(logout())
    navigate('/login')
  }

  const handleThemeToggle = () => {
    dispatch(toggleTheme())
  }

  // SOFT-CODED: Get navigation items based on authentication state and RBAC
  const navItems = isAuthenticated 
    ? getAuthenticatedNavItems(user, rbacData)
    : getPublicNavItems()

  // Render a single navigation item
  const renderNavItem = (item) => {
    const isActive = location.pathname === item.path
    const itemClass = getNavItemClass(item, isActive)
    const iconPath = getNavIcon(item.icon)

    if (item.type === NAV_ITEM_TYPES.BUTTON) {
      return (
        <Link
          key={item.id}
          to={item.path}
          className={itemClass}
        >
          {iconPath && (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={iconPath} />
            </svg>
          )}
          <span>{item.label}</span>
        </Link>
      )
    }

    // Default: regular link
    return (
      <Link
        key={item.id}
        to={item.path}
        className={itemClass}
      >
        {item.label}
      </Link>
    )
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-40 bg-gradient-to-r from-slate-900 via-blue-900 to-indigo-900 shadow-2xl border-b border-white/10">
      <nav className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {showSidebar && (
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 transition-all"
                aria-label="Toggle sidebar"
              >
                <Bars3Icon className="w-6 h-6 text-white" />
              </button>
            )}
            <Link to="/" className="flex items-center space-x-3 group">
              <div className="relative">
                <div className="absolute -inset-1 rounded-xl opacity-0 group-hover:opacity-100 transition duration-300 blur-sm" 
                     style={{ background: 'linear-gradient(135deg, rgba(127, 202, 181, 0.5), rgba(115, 189, 200, 0.5))' }}></div>
                <div className="relative bg-white/95 backdrop-blur-sm rounded-xl shadow-md group-hover:shadow-xl transition-all duration-300 p-2">
                  <img 
                    src={getLogoPath()}
                    alt={LOGO_CONFIG.primary.alt}
                    className="h-9 w-auto transition-all group-hover:scale-105"
                    style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.15))' }}
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextElementSibling.style.display = 'flex';
                    }}
                  />
                  <div style={{display: 'none'}} className="flex items-center h-9 px-2">
                    <img 
                      src={LOGO_CONFIG.fallback.image}
                      alt={LOGO_CONFIG.primary.alt}
                      className="h-full w-auto"
                    />
                  </div>
                </div>
              </div>
              <div className="flex flex-col">
                <div className="text-lg font-black bg-gradient-to-r from-[#00a896] to-[#73bdc8] bg-clip-text text-transparent">
                  RADAI
                </div>
                <div className="text-[9px] font-medium text-blue-200">
                  AI Platform
                </div>
              </div>
            </Link>
          </div>

          <div className="flex items-center space-x-6">
            {isAuthenticated && <NotificationBell />}
            
            <button
              onClick={handleThemeToggle}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 transition-all transform hover:scale-110"
              aria-label="Toggle theme"
            >
              {mode === 'light' ? '🌙' : '☀️'}
            </button>

            {/* SOFT-CODED: Dynamic navigation items from configuration */}
            {navItems.map(item => renderNavItem(item))}

            {/* User greeting and logout - only for authenticated users */}
            {isAuthenticated && (
              <>
                <span className="text-blue-200 font-medium">
                  Hello, {USER_DISPLAY_CONFIG.formatting.getDisplayName(user)}
                </span>
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/30 text-white font-semibold rounded-lg transition-all transform hover:scale-105"
                >
                  Logout
                </button>
              </>
            )}
          </div>
        </div>
      </nav>
    </header>
  )
}

export default Header

