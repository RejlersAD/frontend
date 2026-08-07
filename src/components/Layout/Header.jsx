import React, { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import { logout } from '../../store/slices/authSlice'
import { toggleTheme } from '../../store/slices/themeSlice'
import {
  ArrowRightOnRectangleIcon,
  ChevronDownIcon,
  KeyIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline'
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

const Header = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const dispatch = useDispatch()
  const { isAuthenticated, user } = useSelector((state) => state.auth)
  const rbacData = useSelector((state) => state.rbac?.currentUser)
  const { mode } = useSelector((state) => state.theme)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [profilePhotoFailed, setProfilePhotoFailed] = useState(false)
  const userMenuRef = useRef(null)

  const displayName = USER_DISPLAY_CONFIG.formatting.getDisplayName(user)
  const userInitials = USER_DISPLAY_CONFIG.formatting.getUserInitials(user)
  const email = USER_DISPLAY_CONFIG.formatting.getEmailDisplay(user)
  const role = USER_DISPLAY_CONFIG.formatting.getRoleDisplay(user)
  const userData = user?.user || user
  const profilePhoto = user?.profile_photo || userData?.profile_photo

  useEffect(() => {
    setProfilePhotoFailed(false)
  }, [profilePhoto])

  useEffect(() => {
    setUserMenuOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!userMenuOpen) return undefined

    const handlePointerDown = (event) => {
      if (!userMenuRef.current?.contains(event.target)) setUserMenuOpen(false)
    }
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setUserMenuOpen(false)
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [userMenuOpen])

  const handleLogout = () => {
    setUserMenuOpen(false)
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
    const newTabProps = item.openInNewTab
      ? { target: '_blank', rel: 'noopener noreferrer' }
      : {}
    const NavigationLink = item.openInNewTab ? 'a' : Link
    const destinationProps = item.openInNewTab
      ? { href: item.path }
      : { to: item.path }

    if (item.type === NAV_ITEM_TYPES.BUTTON) {
      return (
        <NavigationLink
          key={item.id}
          {...destinationProps}
          className={itemClass}
          {...newTabProps}
        >
          {iconPath && (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={iconPath} />
            </svg>
          )}
          <span>{item.label}</span>
        </NavigationLink>
      )
    }

    // Default: regular link
    return (
      <NavigationLink
        key={item.id}
        {...destinationProps}
        className={itemClass}
        {...newTabProps}
      >
        {item.label}
      </NavigationLink>
    )
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-40 bg-gradient-to-r from-slate-900 via-blue-900 to-indigo-900 shadow-2xl border-b border-white/10">
      <nav className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link
              to="/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-3 group"
            >
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

            {/* Consolidated account actions */}
            {isAuthenticated && (
              <div ref={userMenuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setUserMenuOpen(open => !open)}
                  className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-2.5 py-2 text-left text-white transition-colors hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-cyan-300"
                  aria-haspopup="menu"
                  aria-expanded={userMenuOpen}
                  aria-label={`Open account menu for ${displayName}`}
                >
                  {profilePhoto && !profilePhotoFailed ? (
                    <img
                      src={profilePhoto}
                      alt=""
                      className="h-8 w-8 rounded-full border border-white/30 object-cover"
                      onError={() => setProfilePhotoFailed(true)}
                    />
                  ) : (
                    <span className={`flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br ${USER_DISPLAY_CONFIG.avatar.getGradient(userData)} text-xs font-bold text-white`}>
                      {userInitials}
                    </span>
                  )}
                  <span className="hidden max-w-40 truncate text-sm font-semibold xl:block">
                    {displayName}
                  </span>
                  <ChevronDownIcon className={`h-4 w-4 text-blue-200 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {userMenuOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 mt-2 w-64 overflow-hidden rounded-xl border border-gray-200 bg-white py-2 text-gray-800 shadow-2xl dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                  >
                    <div className="border-b border-gray-100 px-4 py-3 dark:border-gray-700">
                      <p className="truncate text-sm font-semibold">{displayName}</p>
                      <p className="truncate text-xs text-gray-500 dark:text-gray-400">{email}</p>
                      <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-indigo-600 dark:text-indigo-300">{role}</p>
                    </div>

                    <Link
                      to="/profile"
                      target="_blank"
                      rel="noopener noreferrer"
                      role="menuitem"
                      className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-gray-50 focus:bg-gray-50 focus:outline-none dark:hover:bg-gray-700 dark:focus:bg-gray-700"
                    >
                      <UserCircleIcon className="h-5 w-5 text-gray-500 dark:text-gray-300" />
                      <span>Profile</span>
                    </Link>
                    <Link
                      to="/change-password"
                      target="_blank"
                      rel="noopener noreferrer"
                      role="menuitem"
                      className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-gray-50 focus:bg-gray-50 focus:outline-none dark:hover:bg-gray-700 dark:focus:bg-gray-700"
                    >
                      <KeyIcon className="h-5 w-5 text-gray-500 dark:text-gray-300" />
                      <span>Change Password</span>
                    </Link>
                    <div className="my-1 border-t border-gray-100 dark:border-gray-700" />
                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleLogout}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-medium text-red-600 hover:bg-red-50 focus:bg-red-50 focus:outline-none dark:text-red-400 dark:hover:bg-red-950/30 dark:focus:bg-red-950/30"
                    >
                      <ArrowRightOnRectangleIcon className="h-5 w-5" />
                      <span>Logout</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </nav>
    </header>
  )
}

export default Header

