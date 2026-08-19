/**
 * usePersonalDashboardLayout — persistence hook for user-customised widget layout.
 *
 * Stores per-user, per-persona:
 *   - order:  ordered array of widget keys (drives render order)
 *   - hidden: array of widget keys the user has hidden
 *
 * Storage adapter is soft-coded so we can swap localStorage → backend later
 * without touching call-sites. `resetLayout()` clears persistence so persona
 * defaults take over again.
 *
 * All persona defaults come from `persona.widgets`. Any new widget added to a
 * persona (that the user has never seen) is appended to the end of their
 * custom order automatically — no data loss.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'

const STORAGE_KEY_PREFIX = 'pd:layout'
const STORAGE_VERSION = 1

const buildKey = (userId, personaCode) =>
  `${STORAGE_KEY_PREFIX}:v${STORAGE_VERSION}:${userId || 'anon'}:${personaCode || 'default'}`

// ─── Storage adapter (swap for a backend adapter later without changing call-sites)
const storage = {
  read(key) {
    try {
      const raw = window.localStorage.getItem(key)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  },
  write(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value))
    } catch {
      /* quota / private mode — silently ignore */
    }
  },
  remove(key) {
    try { window.localStorage.removeItem(key) } catch { /* noop */ }
  },
}

/**
 * Reconcile a stored layout with the current persona's widget list.
 * - Drops keys the persona no longer has (defensive).
 * - Appends any new keys the persona introduced.
 */
function reconcile(defaults, stored) {
  const defaultSet = new Set(defaults)
  const storedOrder = Array.isArray(stored?.order) ? stored.order : []
  const kept = storedOrder.filter(k => defaultSet.has(k))
  const missing = defaults.filter(k => !kept.includes(k))
  const order = [...kept, ...missing]
  const hidden = Array.isArray(stored?.hidden) ? stored.hidden.filter(k => defaultSet.has(k)) : []
  return { order, hidden }
}

export default function usePersonalDashboardLayout({ userId, personaCode, defaultWidgets }) {
  const storageKey = useMemo(
    () => buildKey(userId, personaCode),
    [userId, personaCode],
  )

  const [layout, setLayout] = useState(() =>
    reconcile(defaultWidgets, storage.read(storageKey)),
  )

  // Reconcile whenever persona defaults change (e.g. persona swap or new widget added)
  useEffect(() => {
    setLayout(reconcile(defaultWidgets, storage.read(storageKey)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey, defaultWidgets.join('|')])

  // Persist on every change
  useEffect(() => {
    storage.write(storageKey, layout)
  }, [storageKey, layout])

  const setOrder = useCallback((nextOrder) => {
    setLayout(prev => ({ ...prev, order: nextOrder }))
  }, [])

  const hideWidget = useCallback((key) => {
    setLayout(prev => (
      prev.hidden.includes(key) ? prev : { ...prev, hidden: [...prev.hidden, key] }
    ))
  }, [])

  const showWidget = useCallback((key) => {
    setLayout(prev => ({ ...prev, hidden: prev.hidden.filter(k => k !== key) }))
  }, [])

  const toggleWidget = useCallback((key) => {
    setLayout(prev => (
      prev.hidden.includes(key)
        ? { ...prev, hidden: prev.hidden.filter(k => k !== key) }
        : { ...prev, hidden: [...prev.hidden, key] }
    ))
  }, [])

  const resetLayout = useCallback(() => {
    storage.remove(storageKey)
    setLayout(reconcile(defaultWidgets, null))
  }, [storageKey, defaultWidgets])

  // Convenience — the render list (order minus hidden)
  const visibleOrder = useMemo(
    () => layout.order.filter(k => !layout.hidden.includes(k)),
    [layout],
  )

  return {
    order: layout.order,
    hidden: layout.hidden,
    visibleOrder,
    setOrder,
    hideWidget,
    showWidget,
    toggleWidget,
    resetLayout,
    isCustomised: layout.order.join('|') !== defaultWidgets.join('|') || layout.hidden.length > 0,
  }
}
