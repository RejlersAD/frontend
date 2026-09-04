import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import {
  ArrowRightOnRectangleIcon,
  Bars3Icon,
  ChevronDownIcon,
  KeyIcon,
  MoonIcon,
  SunIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline'
import { logout } from '../../store/slices/authSlice'
import { toggleTheme } from '../../store/slices/themeSlice'
import { LOGO_CONFIG, getLogoPath } from '../../config/logo.config'
import NotificationBell from '../notifications/NotificationBell'
import PWAHeaderInstall from '../PWAHeaderInstall'
import GlobalSearch from './GlobalSearch'
import { USER_DISPLAY_CONFIG } from '../../config/userDisplay.config'
import {
  getAuthenticatedNavItems,
  getPublicNavItems,
  NAV_ITEM_TYPES,
} from '../../config/headerNavigation.config'

const ACCOUNT_NAV_IDS = new Set(['profile', 'change-password'])

const Header = ({ sidebarOpen, setSidebarOpen, showSidebar }) => {
  const navigate = useNavigate()
  const location = useLocation()
  const dispatch = useDispatch()
  const { isAuthenticated, user } = useSelector((state) => state.auth)
  const rbacData = useSelector((state) => state.rbac?.currentUser)
  const { mode } = useSelector((state) => state.theme)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef(null)

  const navItems = useMemo(
    () => (isAuthenticated
      ? getAuthenticatedNavItems(user, rbacData)
      : getPublicNavItems()),
    [isAuthenticated, user, rbacData],
  )

  const primaryNavItems = useMemo(
    () => navItems.filter((item) => !ACCOUNT_NAV_IDS.has(item.id)),
    [navItems],
  )

  const displayName = USER_DISPLAY_CONFIG.formatting.getDisplayName(user)
  const firstName = displayName.split(' ')[0] || displayName
  const initials = USER_DISPLAY_CONFIG.formatting.getUserInitials(user)
  const email = USER_DISPLAY_CONFIG.formatting.getEmailDisplay(user)
  const userData = user?.user || user
  const profilePhoto = user?.profile_photo || userData?.profile_photo || user?.employee?.profile_photo
  const roleLabel = user?.roles?.[0]?.name || userData?.job_title || 'Team member'

  useEffect(() => {
    setUserMenuOpen(false)
  }, [location.pathname])

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setUserMenuOpen(false)
      }
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
  }, [])

  const handleLogout = () => {
    setUserMenuOpen(false)
    dispatch(logout())
    navigate('/login')
  }

  const handleThemeToggle = () => dispatch(toggleTheme())

  const isActivePath = (path) => (
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path)
  )

  const renderPrimaryNavItem = (item, mobile = false) => {
    const isActive = isActivePath(item.path)
    const isButton = item.type === NAV_ITEM_TYPES.BUTTON

    return (
      <Link
        key={item.id}
        to={item.path}
        aria-current={isActive ? 'page' : undefined}
        className={[
          'relative rounded-lg font-semibold transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7fcab5]',
          mobile ? 'flex w-full items-center px-3 py-2.5 text-sm' : 'px-3 py-2 text-sm',
          mobile
            ? (isActive
                ? 'bg-blue-50 text-blue-800 dark:bg-blue-950/50 dark:text-blue-200'
                : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800')
            : (isActive
                ? 'bg-white/10 text-white shadow-sm ring-1 ring-white/10'
                : 'text-blue-100/80 hover:bg-white/[0.07] hover:text-white'),
          isButton && !isAuthenticated ? 'bg-[#00a896] text-white hover:bg-[#008f80]' : '',
        ].join(' ')}
      >
        {item.label}
        {isActive && !mobile && (
          <span className="absolute inset-x-3 -bottom-[9px] h-0.5 rounded-full bg-[#7fcab5]" />
        )}
      </Link>
    )
  }

  return (
    <header className="relative z-40 h-14 flex-none border-b border-slate-200 bg-white text-slate-700 shadow-sm dark:border-slate-700 dark:bg-gray-800 dark:text-slate-100">
      <nav
        className="grid h-full w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-3 sm:gap-3 sm:px-5 lg:grid-cols-[minmax(12rem,1fr)_minmax(28rem,54rem)_minmax(12rem,1fr)]"
        aria-label="Primary navigation"
      >
        <div className="flex min-w-0 items-center gap-2">
          {showSidebar && (
            <button
              type="button"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white lg:hidden"
              aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
              aria-expanded={sidebarOpen}
            >
              <Bars3Icon className="h-5 w-5" />
            </button>
          )}

          <Link
            to="/dashboard"
            className="flex min-w-0 items-center gap-2 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            aria-label="Rejlers dashboard"
          >
            <span className="flex h-8 w-8 flex-none items-center justify-center rounded-md bg-white p-1 ring-1 ring-slate-200 dark:ring-slate-600">
              <img
                src={getLogoPath()}
                alt={LOGO_CONFIG.primary.alt}
                className="h-full w-full object-contain"
                onError={(event) => { event.currentTarget.src = LOGO_CONFIG.fallback.image }}
              />
            </span>
            <span className="hidden truncate text-xs font-extrabold tracking-[0.14em] text-slate-700 dark:text-slate-200 sm:block">
              REJLERS
            </span>
          </Link>
        </div>

        <div className="flex min-w-0 justify-center">
          <GlobalSearch user={user} rbacData={rbacData} />
        </div>

        <div className="flex min-w-0 flex-none items-center justify-end gap-1">
          {isAuthenticated && <NotificationBell />}
          {isAuthenticated && <PWAHeaderInstall />}

          <button
            type="button"
            onClick={handleThemeToggle}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
            aria-label={mode === 'light' ? 'Use dark theme' : 'Use light theme'}
            title={mode === 'light' ? 'Dark theme' : 'Light theme'}
          >
            {mode === 'light'
              ? <MoonIcon className="h-5 w-5" />
              : <SunIcon className="h-5 w-5" />}
          </button>

          {isAuthenticated && (
            <div ref={userMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setUserMenuOpen((open) => !open)}
                className="flex h-11 items-center gap-2 rounded-lg pl-1 pr-1.5 text-left transition-colors hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-slate-700"
                aria-haspopup="menu"
                aria-expanded={userMenuOpen}
              >
                <span className="relative flex h-9 w-9 flex-none items-center justify-center overflow-hidden rounded-full bg-blue-600 text-[11px] font-bold text-white ring-1 ring-slate-200 dark:ring-slate-600">
                  {profilePhoto && (
                    <img
                      src={profilePhoto}
                      alt=""
                      className="absolute inset-0 z-10 h-full w-full object-cover"
                      onError={(event) => { event.currentTarget.style.display = 'none' }}
                    />
                  )}
                  <span aria-hidden="true">{initials}</span>
                </span>
                <span className="hidden min-w-0 max-w-36 xl:block">
                  <span className="block truncate text-sm font-semibold leading-4 text-slate-800 dark:text-white">{firstName}</span>
                  <span className="block truncate text-[10px] leading-4 text-slate-500 dark:text-slate-400">{roleLabel}</span>
                </span>
                <ChevronDownIcon className={`hidden h-4 w-4 text-slate-400 transition-transform sm:block ${userMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {userMenuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-72 overflow-hidden rounded-2xl border border-slate-200/80 bg-white text-slate-800 shadow-[0_20px_50px_rgba(15,23,42,0.24)] ring-1 ring-slate-900/5 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                >
                  <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                    <div className="truncate text-sm font-bold">{displayName}</div>
                    <div className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">{email}</div>
                  </div>

                  <div className="p-2">
                    <Link role="menuitem" to="/profile" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800">
                      <UserCircleIcon className="h-5 w-5 text-slate-500" />
                      Profile
                    </Link>
                    <Link role="menuitem" to="/change-password" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800">
                      <KeyIcon className="h-5 w-5 text-slate-500" />
                      Change password
                    </Link>
                  </div>

                  <div className="border-t border-slate-100 p-2 dark:border-slate-800">
                    <div className="px-3 pb-1.5 pt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Navigation</div>
                    {primaryNavItems.map((item) => renderPrimaryNavItem(item, true))}
                  </div>

                  <div className="border-t border-slate-100 p-2 dark:border-slate-800">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleLogout}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-rose-600 transition-colors hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30"
                    >
                      <ArrowRightOnRectangleIcon className="h-5 w-5" />
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {!isAuthenticated && (
            <div className="flex items-center gap-1 xl:hidden">
              {primaryNavItems.map((item) => renderPrimaryNavItem(item))}
            </div>
          )}
        </div>
      </nav>
    </header>
  )
}

export default Header
