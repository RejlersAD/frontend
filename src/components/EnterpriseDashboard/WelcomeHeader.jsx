/**
 * WelcomeHeader - Dashboard Welcome Header
 * Displays greeting, search, notifications, and profile
 */
import React, { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  MagnifyingGlassIcon,
  BellIcon,
  UserCircleIcon,
  Cog6ToothIcon,
} from '@heroicons/react/24/outline'
import { GREETING_CONFIG } from '../../config/enterpriseDashboard.config'
import { USER_DISPLAY_CONFIG } from '../../config/userDisplay.config'

const WelcomeHeader = ({ user, unreadNotifications = 0, onSearch, showSearch = true }) => {
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')

  const greeting = useMemo(() => {
    const hour = new Date().getHours()
    if (hour < GREETING_CONFIG.morningHour) return GREETING_CONFIG.greetings.morning
    if (hour < GREETING_CONFIG.afternoonHour) return GREETING_CONFIG.greetings.afternoon
    return GREETING_CONFIG.greetings.evening
  }, [])

  const currentDate = useMemo(() => {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })
  }, [])

  const currentTime = useMemo(() => {
    return new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }, [])

  const displayName = USER_DISPLAY_CONFIG.formatting.getDisplayName(user)

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    if (onSearch && searchQuery.trim()) {
      onSearch(searchQuery)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        {/* Left: Greeting */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center text-white text-xl font-bold shadow-lg">
                {displayName?.charAt(0)?.toUpperCase() || 'U'}
              </div>
            </div>
            
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-slate-900 truncate">
                {greeting}, {displayName}!
              </h1>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-sm text-slate-500">{currentDate}</p>
                <span className="text-slate-300">•</span>
                <p className="text-sm text-slate-500">{currentTime}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {/* Search */}
          {showSearch && (
            <form onSubmit={handleSearchSubmit} className="relative hidden md:block">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="
                  w-64 pl-10 pr-4 py-2 
                  bg-slate-50 border border-slate-200 
                  rounded-xl text-sm
                  focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent
                  transition-all
                "
              />
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            </form>
          )}

          {/* Notifications */}
          <button
            onClick={() => navigate('/notifications')}
            className="
              relative p-2.5 
              text-slate-600 hover:text-orange-600 
              bg-slate-50 hover:bg-orange-50 
              border border-slate-200 hover:border-orange-200
              rounded-xl transition-all
            "
            title="Notifications"
          >
            <BellIcon className="w-5 h-5" />
            {unreadNotifications > 0 && (
              <span className="
                absolute -top-1 -right-1 
                min-w-[18px] h-[18px] 
                bg-red-500 text-white 
                text-[10px] font-bold 
                rounded-full 
                flex items-center justify-center
                px-1
                ring-2 ring-white
              ">
                {unreadNotifications > 9 ? '9+' : unreadNotifications}
              </span>
            )}
          </button>

          {/* Settings */}
          <button
            onClick={() => navigate('/admin')}
            className="
              p-2.5 
              text-slate-600 hover:text-orange-600 
              bg-slate-50 hover:bg-orange-50 
              border border-slate-200 hover:border-orange-200
              rounded-xl transition-all
            "
            title="Settings"
          >
            <Cog6ToothIcon className="w-5 h-5" />
          </button>

          {/* Profile */}
          <button
            onClick={() => navigate('/profile')}
            className="
              p-2.5 
              text-slate-600 hover:text-orange-600 
              bg-slate-50 hover:bg-orange-50 
              border border-slate-200 hover:border-orange-200
              rounded-xl transition-all
            "
            title="Profile"
          >
            <UserCircleIcon className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  )
}

export default WelcomeHeader
