import { useCallback, useEffect, useState } from 'react'
import { listLegends } from '../services/pidCheckerV2API'
import { subscribeLegendSync, LEGEND_SYNC_POLL_MS } from '../config/legendSheetsRules'

// Fetch the currently active legend for a P&ID Checker V2 section and stay in
// sync across tabs. Any consumer page (LineList, EquipmentList, InstrumentIndex,
// piping variants, etc.) can call this hook to render an "Active Legend" badge
// and — when the definition is present — validate/format its data against the
// user's own rules instead of hardcoded regexes.
//
// Returns { legend, loading, error, refresh } where `legend` is either null
// or `{ legend_id, name, description, definition, is_active, ... }`.
export default function useActiveLegend(section) {
  const [legend, setLegend] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    if (!section) return
    setLoading(true)
    try {
      const rows = await listLegends(section)
      const active = (Array.isArray(rows) ? rows : []).find(l => l && l.is_active) || null
      setLegend(active)
      setError(null)
    } catch (err) {
      setError(err)
      setLegend(null)
    } finally {
      setLoading(false)
    }
  }, [section])

  useEffect(() => { refresh() }, [refresh])

  useEffect(() => {
    if (!section) return undefined
    const handler = (msg) => { if (!msg?.section || msg.section === section) refresh() }
    const unsub = subscribeLegendSync(handler)
    const timer = setInterval(refresh, LEGEND_SYNC_POLL_MS)
    return () => { unsub(); clearInterval(timer) }
  }, [section, refresh])

  return { legend, loading, error, refresh }
}
