/**
 * QuickActionsGrid - Quick Action Buttons
 * Displays context-aware quick actions based on user role
 */
import React from 'react'
import { useNavigate } from 'react-router-dom'
import {
  UserPlusIcon,
  CurrencyDollarIcon,
  CheckCircleIcon,
  ShoppingCartIcon,
  ArrowUpTrayIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  DocumentTextIcon,
  CalendarDaysIcon,
  TicketIcon,
} from '@heroicons/react/24/outline'
import { ADMIN_QUICK_ACTIONS, USER_QUICK_ACTIONS } from '../../config/enterpriseDashboard.config'

const QuickActionsGrid = ({ isAdmin = false }) => {
  const navigate = useNavigate()
  const actions = isAdmin ? ADMIN_QUICK_ACTIONS : USER_QUICK_ACTIONS

  const getIcon = (iconName) => {
    const icons = {
      '👤': UserPlusIcon,
      '💰': CurrencyDollarIcon,
      '✅': CheckCircleIcon,
      '🛒': ShoppingCartIcon,
      '📤': ArrowUpTrayIcon,
      '📊': ChartBarIcon,
      '⚙️': Cog6ToothIcon,
      '🏖️': CalendarDaysIcon,
      '📄': DocumentTextIcon,
      '📅': CalendarDaysIcon,
      '🎫': TicketIcon,
    }
    return icons[iconName] || DocumentTextIcon
  }

  const getColorClasses = (color) => {
    const colors = {
      blue: { bg: 'bg-blue-50 hover:bg-blue-100', text: 'text-blue-600', border: 'border-blue-200' },
      amber: { bg: 'bg-amber-50 hover:bg-amber-100', text: 'text-amber-600', border: 'border-amber-200' },
      green: { bg: 'bg-emerald-50 hover:bg-emerald-100', text: 'text-emerald-600', border: 'border-emerald-200' },
      purple: { bg: 'bg-purple-50 hover:bg-purple-100', text: 'text-purple-600', border: 'border-purple-200' },
      teal: { bg: 'bg-teal-50 hover:bg-teal-100', text: 'text-teal-600', border: 'border-teal-200' },
      indigo: { bg: 'bg-indigo-50 hover:bg-indigo-100', text: 'text-indigo-600', border: 'border-indigo-200' },
      slate: { bg: 'bg-slate-50 hover:bg-slate-100', text: 'text-slate-600', border: 'border-slate-200' },
      rose: { bg: 'bg-rose-50 hover:bg-rose-100', text: 'text-rose-600', border: 'border-rose-200' },
      pink: { bg: 'bg-pink-50 hover:bg-pink-100', text: 'text-pink-600', border: 'border-pink-200' },
    }
    return colors[color] || colors.slate
  }

  const handleAction = (action) => {
    if (action.route) {
      navigate(action.route)
    } else {
      // TODO: Implement modal or inline action
      console.log('Quick action:', action.id)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
      {/* Header */}
      <div className="mb-5">
        <h2 className="text-lg font-bold text-slate-900">Quick Actions</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          {isAdmin ? 'Admin shortcuts' : 'Your shortcuts'}
        </p>
      </div>

      {/* Actions grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {actions.map((action) => {
          const Icon = getIcon(action.icon)
          const colors = getColorClasses(action.color)

          return (
            <button
              key={action.id}
              onClick={() => handleAction(action)}
              className={`
                relative overflow-hidden
                ${colors.bg} border ${colors.border}
                rounded-xl p-4
                transition-all duration-200
                hover:scale-105 hover:shadow-md
                group
              `}
            >
              {/* Gradient orb */}
              <div className={`absolute -top-6 -right-6 w-20 h-20 ${colors.bg} rounded-full blur-2xl opacity-50 group-hover:opacity-70 transition-opacity`} />

              <div className="relative">
                {/* Icon */}
                <div className={`w-10 h-10 ${colors.bg.replace('hover:', '')} rounded-lg flex items-center justify-center mb-2 ${colors.text}`}>
                  <Icon className="w-5 h-5" />
                </div>

                {/* Label */}
                <p className={`text-xs font-bold ${colors.text} leading-tight`}>
                  {action.label}
                </p>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default QuickActionsGrid
