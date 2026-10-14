import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { CheckCircleIcon, ExclamationTriangleIcon, UserCircleIcon } from '@heroicons/react/24/outline'
import apiClient from '../services/api.service'

const EXEMPT_ROUTES = new Set([
  '/', '/home', '/login', '/profile', '/hr/Employeprofile', '/change-password',
  '/setup-password', '/reset-password', '/request-password-reset', '/forgot-password',
  '/terms-of-service', '/privacy-policy', '/about', '/solutions', '/enquiry', '/enquiries',
])

export default function ProfileCompletionGuard() {
  const location = useLocation()
  const navigate = useNavigate()
  const isAuthenticated = useSelector((state) => state.auth.isAuthenticated)
  const [completion, setCompletion] = useState(null)

  const isExemptRoute = EXEMPT_ROUTES.has(location.pathname)
    || location.pathname.startsWith('/services/')
    || location.pathname.startsWith('/finance/approve/')

  useEffect(() => {
    if (!isAuthenticated || isExemptRoute) return undefined

    const controller = new AbortController()
    apiClient.get('/rbac/users/me/profile-completeness/', {
      signal: controller.signal,
      timeout: 10000,
      silentTimeout: true,
    }).then(({ data }) => setCompletion(data)).catch((error) => {
      if (error.code !== 'ERR_CANCELED') {
        console.warn('[ProfileCompletion] Check unavailable:', error.message)
      }
    })
    return () => controller.abort()
  }, [isAuthenticated, isExemptRoute, location.pathname])

  const groupedMissing = useMemo(() => {
    return (completion?.missing_fields || []).reduce((groups, field) => {
      const section = field.section || 'Profile details'
      groups[section] = [...(groups[section] || []), field]
      return groups
    }, {})
  }, [completion])

  if (!isAuthenticated || isExemptRoute || !completion || completion.is_complete) return null

  return (
    <div className="fixed inset-0 z-[10050] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[2px]" role="presentation">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-completion-title"
        aria-describedby="profile-completion-description"
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
      >
        <div className="flex items-start gap-4 border-b border-slate-200 px-6 py-5 dark:border-slate-700">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
            <UserCircleIcon className="h-7 w-7" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-700 dark:text-blue-300">Profile required</p>
            <h2 id="profile-completion-title" className="mt-1 text-xl font-semibold text-slate-950 dark:text-white">Please complete your profile</h2>
            <p id="profile-completion-description" className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              {completion.detail || `Your profile is ${completion.percentage}% complete. Finish the items below to continue using RADAI.`}
            </p>
          </div>
          <span className="rounded-full bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-200">
            {completion.percentage}%
          </span>
        </div>

        <div className="max-h-[52vh] space-y-4 overflow-y-auto px-6 py-5">
          {Object.entries(groupedMissing).map(([section, fields]) => (
            <div key={section}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{section}</h3>
              <ul className="grid gap-2 sm:grid-cols-2">
                {fields.map((field) => (
                  <li key={field.key} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    <ExclamationTriangleIcon className="h-4 w-4 shrink-0 text-amber-600" />
                    {field.label}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-slate-200 bg-slate-50 px-6 py-4 dark:border-slate-700 dark:bg-slate-800/60">
          <p className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <CheckCircleIcon className="h-4 w-4 text-emerald-600" />
            {completion.completed_fields} of {completion.total_fields} items completed
          </p>
          <button
            type="button"
            autoFocus
            onClick={() => navigate('/profile?tab=career')}
            className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          >
            Complete my profile
          </button>
        </div>
      </section>
    </div>
  )
}
