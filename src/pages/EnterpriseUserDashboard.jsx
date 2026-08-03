/**
 * EnterpriseUserDashboard - User Personal Dashboard
 * Personalized productivity center for employees
 * Shows leave balance, attendance, tasks, calendar, and personal insights
 */
import React, { useState, useEffect, useMemo } from 'react'
import { useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { API_BASE_URL } from '../config/api.config'
import { API_CONFIG, LAYOUT_CONFIG, GREETING_CONFIG } from '../config/enterpriseDashboard.config'
import { USER_DISPLAY_CONFIG } from '../config/userDisplay.config'
import {
  SparklesIcon,
  CalendarIcon,
  BellIcon,
  RocketLaunchIcon,
} from '@heroicons/react/24/outline'

// Import components
import WelcomeHeader from '../components/EnterpriseDashboard/WelcomeHeader'
import PersonalCards from '../components/EnterpriseDashboard/PersonalCards'
import QuickActionsGrid from '../components/EnterpriseDashboard/QuickActionsGrid'
import ActivityTimeline from '../components/EnterpriseDashboard/ActivityTimeline'
import AIInsightsPanel from '../components/EnterpriseDashboard/AIInsightsPanel'

const EnterpriseUserDashboard = () => {
  const navigate = useNavigate()
  const { user } = useSelector(s => s.auth)
  const rbacCurrentUser = useSelector(s => s.rbac?.currentUser)

  const [personalData, setPersonalData] = useState({})
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchPersonalData()
    
    // Auto-refresh
    const interval = setInterval(fetchPersonalData, API_CONFIG.dashboardRefreshInterval)
    return () => clearInterval(interval)
  }, [])

  const fetchPersonalData = async () => {
    try {
      const token = localStorage.getItem('radai_access_token') || localStorage.getItem('access')
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      }

      // Fetch personal dashboard data
      const [personalRes, notifRes] = await Promise.allSettled([
        fetch(`${API_BASE_URL}/dashboard/personal/`, { headers }),
        fetch(`${API_BASE_URL}/notifications/`, { headers }),
      ])

      if (personalRes.status === 'fulfilled' && personalRes.value.ok) {
        const data = await personalRes.value.json()
        setPersonalData(data)
      }

      if (notifRes.status === 'fulfilled' && notifRes.value.ok) {
        const notifData = await notifRes.value.json()
        setNotifications(notifData.results || notifData || [])
      }
    } catch (error) {
      console.error('Personal dashboard fetch error:', error)
    } finally {
      setLoading(false)
    }
  }

  const displayName = USER_DISPLAY_CONFIG.formatting.getDisplayName(rbacCurrentUser || user)
  const unreadCount = notifications.filter(n => !n.is_read).length

  const greeting = useMemo(() => {
    const hour = new Date().getHours()
    if (hour < GREETING_CONFIG.morningHour) return GREETING_CONFIG.greetings.morning
    if (hour < GREETING_CONFIG.afternoonHour) return GREETING_CONFIG.greetings.afternoon
    return GREETING_CONFIG.greetings.evening
  }, [])

  const motivationalMessage = useMemo(() => {
    return GREETING_CONFIG.motivationalMessages[
      Math.floor(Math.random() * GREETING_CONFIG.motivationalMessages.length)
    ]
  }, [])

  // My Requests placeholder
  const myRequests = [
    {
      id: 1,
      type: 'Leave',
      title: 'Annual Leave - Dec 2026',
      status: 'Pending',
      submittedDate: '2026-07-10',
      icon: '🏖️',
      statusColor: 'amber',
    },
    {
      id: 2,
      type: 'Procurement',
      title: 'Office Equipment Request',
      status: 'Approved',
      submittedDate: '2026-07-05',
      icon: '🛒',
      statusColor: 'green',
    },
  ]

  // Upcoming Events placeholder
  const upcomingEvents = [
    {
      id: 1,
      title: 'Team Meeting',
      date: '2026-07-15',
      time: '10:00 AM',
      type: 'meeting',
      icon: '👥',
      color: 'blue',
    },
    {
      id: 2,
      title: 'Birthday - Sara Ali',
      date: '2026-07-18',
      type: 'birthday',
      icon: '🎂',
      color: 'pink',
    },
    {
      id: 3,
      title: 'Project Deadline',
      date: '2026-07-20',
      type: 'deadline',
      icon: '⏰',
      color: 'red',
    },
    {
      id: 4,
      title: 'Safety Training',
      date: '2026-07-22',
      time: '2:00 PM',
      type: 'training',
      icon: '📚',
      color: 'purple',
    },
  ]

  const statusColorClasses = {
    green: 'bg-emerald-100 text-emerald-700',
    amber: 'bg-amber-100 text-amber-700',
    red: 'bg-red-100 text-red-700',
    blue: 'bg-blue-100 text-blue-700',
    purple: 'bg-purple-100 text-purple-700',
    pink: 'bg-pink-100 text-pink-700',
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-50 to-slate-100">
      <div 
        className={`mx-auto ${LAYOUT_CONFIG.paddingX} ${LAYOUT_CONFIG.paddingY}`}
        style={{ maxWidth: LAYOUT_CONFIG.maxWidth }}
      >
        <div className="space-y-6">
          {/* Welcome Hero */}
          <div className="relative overflow-hidden bg-gradient-to-br from-orange-500 via-pink-500 to-purple-600 rounded-2xl shadow-lg p-8">
            {/* Decorative orbs */}
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/20 rounded-full blur-3xl" />
            <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-white/10 rounded-full blur-3xl" />
            
            <div className="relative">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h1 className="text-3xl font-black text-white mb-2">
                    {greeting}, {displayName}!
                  </h1>
                  <p className="text-lg text-white/90 font-semibold flex items-center gap-2">
                    <SparklesIcon className="w-5 h-5" />
                    {motivationalMessage}
                  </p>
                  <p className="text-sm text-white/70 mt-2">
                    {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>

                {/* Quick stats */}
                <div className="hidden lg:flex items-center gap-3">
                  <button
                    onClick={() => navigate('/notifications')}
                    className="relative p-3 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-xl border border-white/30 transition-all"
                  >
                    <BellIcon className="w-6 h-6 text-white" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-[20px] h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center px-1.5 ring-2 ring-white">
                        {unreadCount}
                      </span>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Personal Cards */}
          <PersonalCards />

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column */}
            <div className="lg:col-span-8 space-y-6">
              {/* My Requests */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">My Requests</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Track your submissions</p>
                  </div>
                </div>

                <div className="space-y-3">
                  {myRequests.map((request) => (
                    <div
                      key={request.id}
                      className="flex items-center gap-3 p-4 border border-slate-200 rounded-xl hover:border-orange-200 hover:bg-orange-50/30 transition-all"
                    >
                      <div className="text-2xl">{request.icon}</div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-bold text-slate-900 truncate">{request.title}</h3>
                        <p className="text-xs text-slate-600">
                          {request.type} • Submitted {request.submittedDate}
                        </p>
                      </div>
                      <span className={`flex-shrink-0 text-xs font-bold px-3 py-1 rounded-full ${statusColorClasses[request.statusColor]}`}>
                        {request.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* AI Assistant Widget */}
              <AIInsightsPanel />

              {/* Quick Actions */}
              <QuickActionsGrid isAdmin={false} />
            </div>

            {/* Right Column */}
            <div className="lg:col-span-4 space-y-6">
              {/* Upcoming Events */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">Upcoming Events</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Your calendar</p>
                  </div>
                  <CalendarIcon className="w-5 h-5 text-slate-400" />
                </div>

                <div className="space-y-3">
                  {upcomingEvents.map((event) => (
                    <div
                      key={event.id}
                      className="flex items-start gap-3 p-3 border border-slate-200 rounded-xl hover:border-orange-200 hover:bg-orange-50/30 transition-all"
                    >
                      <div className="text-xl">{event.icon}</div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-bold text-slate-900 truncate">{event.title}</h3>
                        <p className="text-xs text-slate-600">
                          {event.date} {event.time && `• ${event.time}`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Activity Timeline */}
              <ActivityTimeline />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default EnterpriseUserDashboard
