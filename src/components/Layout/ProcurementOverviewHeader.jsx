import { useEffect, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { Link, useNavigate } from 'react-router-dom'
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
import { USER_DISPLAY_CONFIG } from '../../config/userDisplay.config'
import NotificationBell from '../notifications/NotificationBell'
import './ProcurementOverviewHeader.css'

export default function ProcurementOverviewHeader({ sidebarOpen, setSidebarOpen, profilePhotoUrl }) {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const user = useSelector((state) => state.auth.user)
  const mode = useSelector((state) => state.theme.mode)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)
  const accountButtonRef = useRef(null)
  const name = USER_DISPLAY_CONFIG.formatting.getDisplayName(user)
  const initials = USER_DISPLAY_CONFIG.formatting.getUserInitials(user)
  const email = USER_DISPLAY_CONFIG.formatting.getEmailDisplay(user)
  const userData = user?.user || user
  const role = user?.roles?.[0]?.name || userData?.job_title || 'Team member'
  const photo = profilePhotoUrl || user?.profile_photo || userData?.profile_photo || user?.employee?.profile_photo

  useEffect(() => {
    if (!menuOpen) return undefined
    const closeOnOutsideClick = (event) => {
      if (!menuRef.current?.contains(event.target)) setMenuOpen(false)
    }
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        setMenuOpen(false)
        accountButtonRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [menuOpen])

  const signOut = () => {
    setMenuOpen(false)
    dispatch(logout())
    navigate('/login')
  }

  return (
    <header className="procurement-overview-header">
      <nav aria-label="Breadcrumb" className="procurement-overview-breadcrumb">
        <button
          type="button"
          className="procurement-overview-drawer-toggle"
          aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
          aria-controls="application-sidebar"
          aria-expanded={sidebarOpen}
          onClick={() => setSidebarOpen(!sidebarOpen)}
        ><Bars3Icon aria-hidden="true" /></button>
        <Link to="/procurement">Procurement</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">Overview</span>
      </nav>
      <div className="procurement-overview-account-area">
        <div className="procurement-overview-notifications"><NotificationBell /></div>
        <div className="procurement-overview-account" ref={menuRef}>
          <button
            ref={accountButtonRef}
            type="button"
            className="procurement-overview-account-trigger"
            aria-label={`Account menu for ${name}`}
            aria-expanded={menuOpen}
            aria-controls="procurement-overview-account-menu"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span className="procurement-overview-avatar">
              <span aria-hidden="true">{initials}</span>
              {photo && <img key={photo} src={photo} alt="" onError={(event) => { event.currentTarget.style.display = 'none' }} />}
            </span>
            <span className="procurement-overview-account-name"><strong>{name.split(' ')[0] || name}</strong><span>{role}</span></span>
            <ChevronDownIcon aria-hidden="true" />
          </button>
          {menuOpen && (
            <div id="procurement-overview-account-menu" className="procurement-overview-account-menu">
              <div className="procurement-overview-account-details"><strong>{name}</strong><span>{email}</span></div>
              <Link to="/profile"><UserCircleIcon aria-hidden="true" />Profile</Link>
              <Link to="/change-password"><KeyIcon aria-hidden="true" />Change password</Link>
              <button type="button" onClick={() => dispatch(toggleTheme())}>
                {mode === 'light' ? <MoonIcon aria-hidden="true" /> : <SunIcon aria-hidden="true" />}
                {mode === 'light' ? 'Use dark theme' : 'Use light theme'}
              </button>
              <button type="button" className="procurement-overview-signout" onClick={signOut}><ArrowRightOnRectangleIcon aria-hidden="true" />Sign out</button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

ProcurementOverviewHeader.propTypes = {
  sidebarOpen: PropTypes.bool,
  setSidebarOpen: PropTypes.func.isRequired,
  profilePhotoUrl: PropTypes.string,
}
