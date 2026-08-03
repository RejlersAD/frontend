/**
 * PeopleNav — shared tab-bar that interconnects:
 *   /profile, /hr/employees, /admin/users
 *
 * Driven entirely by frontend/src/config/peopleNav.config.js — no
 * page-specific logic lives here.
 *
 * Usage:
 *   import PeopleNav from '@/components/PeopleNav/PeopleNav'
 *   <PeopleNav activeId="profile" />
 *
 * If `activeId` is omitted, the active tab is inferred from the current
 * route via react-router's `useLocation()`.
 */
import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useSelector } from 'react-redux'
import * as HeroIcons from '@heroicons/react/24/outline'
import { isUserAdmin } from '../../utils/rbac.utils'
import {
  PEOPLE_NAV_TABS,
  PEOPLE_NAV_VISIBILITY,
  PEOPLE_NAV_COPY,
} from '../../config/peopleNav.config'

const Icon = ({ name, className }) => {
  const C = HeroIcons[name] || HeroIcons.UserIcon
  return <C className={className} aria-hidden="true" />
}

const PeopleNav = ({ activeId }) => {
  const location = useLocation()
  const { user: authUser } = useSelector((s) => s.auth) || {}
  const { currentUser } = useSelector((s) => s.rbac) || {}
  // Prefer the richer RBAC currentUser (has roles[]) — falls back to auth user.
  const user = currentUser || authUser

  const visible = PEOPLE_NAV_TABS.filter((tab) => {
    const predicate = PEOPLE_NAV_VISIBILITY[tab.visibility] || PEOPLE_NAV_VISIBILITY.always
    return predicate(user, { isUserAdmin })
  })

  const resolvedActive =
    activeId ||
    visible.find((t) => location.pathname === t.to || location.pathname.startsWith(t.to + '/'))?.id

  return (
    <div className="bg-white/80 backdrop-blur rounded-2xl border border-slate-200/70 shadow-sm p-3 sm:p-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
            {PEOPLE_NAV_COPY.title}
          </div>
          <div className="text-sm text-slate-600">{PEOPLE_NAV_COPY.subtitle}</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {visible.map((tab) => {
          const isActive = tab.id === resolvedActive
          return (
            <Link
              key={tab.id}
              to={tab.to}
              aria-current={isActive ? 'page' : undefined}
              className={[
                'group relative flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all',
                isActive
                  ? `text-white shadow-md bg-gradient-to-r ${tab.accent}`
                  : 'text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200',
              ].join(' ')}
              title={tab.description}
            >
              <Icon
                name={tab.icon}
                className={`w-4 h-4 ${isActive ? 'opacity-90' : 'text-slate-500 group-hover:text-slate-700'}`}
              />
              <span>{tab.label}</span>
              {isActive && (
                <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-white/90 animate-pulse" />
              )}
            </Link>
          )
        })}
      </div>
    </div>
  )
}

export default PeopleNav
