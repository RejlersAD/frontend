import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BellIcon,
  ChartBarSquareIcon,
  CheckBadgeIcon,
  ClockIcon,
  DocumentTextIcon,
  MagnifyingGlassIcon,
  ShieldCheckIcon,
  Squares2X2Icon,
  UserCircleIcon,
  UsersIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import { HEADER_SEARCH_CONFIG, HEADER_SEARCH_ITEMS } from '../../config/headerSearch.config'
import { getAllFeatures } from '../../config/featuresCatalog.config'

const ADMIN_MODULE_CODES = new Set([
  'admin_dashboard',
  'user_mgmt',
  'role_access_mgmt',
  'wrench_integration',
  'ai_champion',
  'enquiry_management',
])

const SEARCH_ICONS = {
  bell: BellIcon,
  clock: ClockIcon,
  dashboard: ChartBarSquareIcon,
  document: DocumentTextIcon,
  module: Squares2X2Icon,
  search: MagnifyingGlassIcon,
  shield: ShieldCheckIcon,
  user: UserCircleIcon,
  users: UsersIcon,
  workflow: CheckBadgeIcon,
}

const normalise = (value) => String(value || '').trim().toLowerCase()

const SEARCH_PROMPTS = [
  HEADER_SEARCH_CONFIG.placeholder,
  'Find employees, projects, and approvals...',
  'Search policies, documents, and requests...',
  'Open any RADAI workspace...',
]

const GlobalSearch = ({ user, rbacData }) => {
  const navigate = useNavigate()
  const rootRef = useRef(null)
  const desktopInputRef = useRef(null)
  const mobileInputRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const [inputFocused, setInputFocused] = useState(false)
  const [animatedPlaceholder, setAnimatedPlaceholder] = useState(SEARCH_PROMPTS[0])

  const userData = user?.user || user
  const moduleCodes = useMemo(
    () => new Set((rbacData?.modules || []).map((module) => normalise(module.code))),
    [rbacData],
  )
  const hasSuperAdminAccess = Boolean(
    userData?.is_superuser ||
    user?.roles?.some((role) => role.code === 'super_admin'),
  )
  const hasAdminAccess = Boolean(
    hasSuperAdminAccess ||
    user?.roles?.some((role) => ['admin', 'ict_admin'].includes(role.code)) ||
    [...moduleCodes].some((code) => ADMIN_MODULE_CODES.has(code)),
  )

  const catalogItems = useMemo(
    () => getAllFeatures()
      .filter((feature) => Boolean(feature.path))
      .map((feature) => ({
        id: `feature-${feature.id}`,
        label: feature.name,
        description: feature.description || feature.longDescription || 'Open platform module',
        category: feature.categoryName || 'Modules',
        path: feature.path,
        icon: 'module',
        moduleCode: feature.moduleCode,
        keywords: [
          feature.shortName,
          feature.moduleCode,
          feature.status?.label,
          ...(feature.capabilities || []),
        ].filter(Boolean),
      })),
    [],
  )

  const indexedItems = useMemo(() => {
    const seenPaths = new Set()
    return [...HEADER_SEARCH_ITEMS, ...catalogItems].filter((item) => {
      const pathKey = String(item.path).toLowerCase()
      if (seenPaths.has(pathKey)) return false
      seenPaths.add(pathKey)
      return true
    })
  }, [catalogItems])

  const availableItems = useMemo(
    () => indexedItems.filter((item) => {
      if (item.adminOnly && !hasAdminAccess) return false
      if (item.moduleCode && !hasSuperAdminAccess && !moduleCodes.has(normalise(item.moduleCode))) return false
      return true
    }),
    [hasAdminAccess, hasSuperAdminAccess, indexedItems, moduleCodes],
  )

  const results = useMemo(() => {
    const term = normalise(query)
    if (!term) return availableItems.slice(0, HEADER_SEARCH_CONFIG.resultLimit)
    return availableItems
      .map((item) => {
        const label = normalise(item.label)
        const searchable = normalise([
          item.label,
          item.description,
          item.category,
          ...(item.keywords || []),
        ].join(' '))
        const score = label === term ? 3 : label.startsWith(term) ? 2 : searchable.includes(term) ? 1 : 0
        return { item, score }
      })
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score || a.item.label.localeCompare(b.item.label))
      .slice(0, HEADER_SEARCH_CONFIG.resultLimit)
      .map(({ item }) => item)
  }, [availableItems, query])

  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reducedMotion || inputFocused || query) {
      setAnimatedPlaceholder(SEARCH_PROMPTS[0])
      return undefined
    }

    let promptIndex = 0
    let displayedText = SEARCH_PROMPTS[0]
    let phase = 'hold'
    let timer

    const advancePrompt = () => {
      if (phase === 'hold') {
        phase = 'delete'
        timer = window.setTimeout(advancePrompt, 22)
        return
      }

      if (phase === 'delete') {
        displayedText = displayedText.slice(0, -1)
        setAnimatedPlaceholder(displayedText)
        if (displayedText.length === 0) {
          promptIndex = (promptIndex + 1) % SEARCH_PROMPTS.length
          phase = 'type'
        }
        timer = window.setTimeout(advancePrompt, 22)
        return
      }

      const nextPrompt = SEARCH_PROMPTS[promptIndex]
      displayedText = nextPrompt.slice(0, displayedText.length + 1)
      setAnimatedPlaceholder(displayedText)
      if (displayedText === nextPrompt) phase = 'hold'
      timer = window.setTimeout(advancePrompt, displayedText === nextPrompt ? 2200 : 38)
    }

    timer = window.setTimeout(advancePrompt, 2200)
    return () => window.clearTimeout(timer)
  }, [inputFocused, query])

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false)
    }
    const handleShortcut = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setOpen(true)
        window.setTimeout(() => {
          const target = window.matchMedia('(min-width: 768px)').matches
            ? desktopInputRef.current
            : mobileInputRef.current
          target?.focus()
        }, 0)
      }
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleShortcut)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleShortcut)
    }
  }, [])

  const selectResult = (item) => {
    setOpen(false)
    setQuery('')
    navigate(item.path)
  }

  const handleKeyDown = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((index) => Math.min(index + 1, results.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((index) => Math.max(index - 1, 0))
    } else if (event.key === 'Enter' && results[activeIndex]) {
      event.preventDefault()
      selectResult(results[activeIndex])
    }
  }

  const inputProps = {
    value: query,
    onChange: (event) => setQuery(event.target.value),
    onFocus: () => {
      setInputFocused(true)
      setOpen(true)
    },
    onBlur: () => setInputFocused(false),
    onKeyDown: handleKeyDown,
    placeholder: animatedPlaceholder,
    role: 'combobox',
    'aria-label': 'Global search',
    'aria-expanded': open,
    'aria-controls': 'global-search-results',
    'aria-autocomplete': 'list',
  }

  return (
    <div ref={rootRef} className="relative flex w-full max-w-4xl justify-start">
      <div className="hidden w-full md:block">
        <div className="relative h-full w-full rounded-lg border border-slate-200 bg-slate-50 transition-colors hover:border-slate-300 hover:bg-white focus-within:border-blue-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-100 dark:border-slate-700 dark:bg-slate-900/50 dark:hover:border-slate-600 dark:hover:bg-slate-900 dark:focus-within:border-blue-500 dark:focus-within:ring-blue-950">
          <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            ref={desktopInputRef}
            {...inputProps}
            className="h-10 w-full rounded-lg bg-transparent pl-9 pr-20 text-sm text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500"
          />
          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-500">
            Ctrl K
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={() => {
          setOpen(true)
          window.setTimeout(() => mobileInputRef.current?.focus(), 0)
        }}
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white md:hidden"
        aria-label="Open global search"
      >
        <MagnifyingGlassIcon className="h-5 w-5" />
      </button>

      {open && (
        <div className="fixed left-4 right-4 top-16 overflow-hidden rounded-xl border border-slate-200/80 bg-white text-slate-900 shadow-[0_20px_50px_rgba(15,23,42,0.2)] ring-1 ring-slate-900/5 md:absolute md:left-0 md:right-0 md:top-full md:mt-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
          <div className="flex items-center gap-2 border-b border-slate-100 p-3 md:hidden dark:border-slate-800">
            <MagnifyingGlassIcon className="h-5 w-5 text-slate-400" />
            <input
              ref={mobileInputRef}
              {...inputProps}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
            />
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100" aria-label="Close search">
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          <div className="flex items-center justify-between px-4 pb-2 pt-3">
            <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
              {query ? 'Search results' : HEADER_SEARCH_CONFIG.quickAccessLabel}
            </span>
            <span className="hidden text-[10px] text-slate-400 md:block">↑↓ Navigate · Enter Open · Esc Close</span>
          </div>

          <div id="global-search-results" role="listbox" className="max-h-[min(420px,65vh)] overflow-y-auto px-2 pb-2">
            {results.map((item, index) => {
              const Icon = SEARCH_ICONS[item.icon] || MagnifyingGlassIcon
              const active = index === activeIndex
              return (
                <button
                  key={item.id}
                  id={`global-search-result-${item.id}`}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => selectResult(item)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                    active ? 'bg-blue-50 text-blue-950 dark:bg-blue-950/50 dark:text-blue-100' : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <span className={`flex h-9 w-9 flex-none items-center justify-center rounded-lg ${active ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200' : 'bg-slate-100 text-slate-500 dark:bg-slate-800'}`}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{item.label}</span>
                    <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{item.description}</span>
                  </span>
                  <span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">{item.category}</span>
                </button>
              )
            })}

            {results.length === 0 && (
              <div className="px-4 py-10 text-center">
                <MagnifyingGlassIcon className="mx-auto h-8 w-8 text-slate-300" />
                <div className="mt-2 text-sm font-semibold">{HEADER_SEARCH_CONFIG.emptyTitle}</div>
                <div className="mt-1 text-xs text-slate-500">{HEADER_SEARCH_CONFIG.emptyHint}</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default GlobalSearch
