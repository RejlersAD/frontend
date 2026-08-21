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
    <header className="fixed inset-x-0 top-0 z-40 h-16 border-b border-white/10 bg-gradient-to-r from-[#08142f]/[0.98] via-[#10255a]/[0.98] to-[#172554]/[0.98] text-white shadow-[0_8px_30px_rgba(2,8,23,0.18)] backdrop-blur-xl">
      <nav className="mx-auto flex h-full max-w-[1600px] items-center gap-4 px-4 sm:px-6" aria-label="Primary navigation">
        <div className="flex min-w-0 items-center gap-2">
          {showSidebar && (
            <button
              type="button"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] text-blue-100 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7fcab5] lg:hidden"
              aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
              aria-expanded={sidebarOpen}
            >
              <Bars3Icon className="h-5 w-5" />
            </button>
          )}

          <Link
            to="/"
            className="group flex min-w-0 items-center gap-2.5 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7fcab5]"
            aria-label="RADAI home"
          >
            <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl border border-white/60 bg-white shadow-sm transition-shadow group-hover:shadow-md">
              <img
                src={getLogoPath()}
                alt={LOGO_CONFIG.primary.alt}
                className="h-7 w-auto"
                onError={(event) => {
                  event.currentTarget.src = LOGO_CONFIG.fallback.image
                }}
              />
            </span>
            <span className="hidden min-w-0 sm:block">
              <span className="block text-[17px] font-extrabold leading-none tracking-wide text-[#7fcab5]">RADAI</span>
              <span className="mt-1 block text-[9px] font-medium uppercase tracking-[0.18em] text-blue-200/65">AI Platform</span>
            </span>
          </Link>
        </div>

        <div className="flex min-w-0 flex-1 justify-center px-1 sm:px-4 lg:px-8">
          <GlobalSearch user={user} rbacData={rbacData} />
        </div>

        <div className="ml-auto flex items-center gap-2">
          {isAuthenticated && <NotificationBell />}

          <button
            type="button"
            onClick={handleThemeToggle}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] text-blue-100 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7fcab5]"
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
                className="flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] pl-1.5 pr-2 text-left transition-colors hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7fcab5]"
                aria-haspopup="menu"
                aria-expanded={userMenuOpen}
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-[#00a896] to-[#3182a0] text-[11px] font-bold text-white shadow-sm">
                  {initials}
                </span>
                <span className="hidden max-w-32 truncate text-sm font-semibold text-white sm:block">{firstName}</span>
                <ChevronDownIcon className={`h-4 w-4 text-blue-200/70 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
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
