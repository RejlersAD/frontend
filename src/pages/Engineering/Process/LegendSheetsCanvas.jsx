import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'react-toastify'
import * as XLSX from 'xlsx'
import {
  ArrowLeft, BookOpen, Plus, Save, Trash2, CheckCircle2, Download, Upload,
  Loader2, FileSpreadsheet, FileText, RefreshCw, Search,
} from 'lucide-react'

import {
  listLegends, createLegend, updateLegend, deleteLegend,
  activateLegend, getLegendDefaultTemplate, LEGEND_SECTIONS,
} from '../../../services/pidCheckerV2API'
import {
  LEGEND_SECTION_RULES, getSectionRules,
  emitLegendSync, subscribeLegendSync,
  LEGEND_SYNC_ACTIONS, LEGEND_SYNC_POLL_MS,
} from '../../../config/legendSheetsRules'
import { parseLegendFile, IMPORT_ACCEPT } from '../../../config/legendSheetsImport'

// ═════════════════════════════════════════════════════════════════════
// Legend Sheets — full-page CANVAS view
// A dedicated route: /engineering/process/pid-checker-v2/legends
// Query param ?section=line_list|equipment_list|instrument_index selects
// the initially-active section tab.
// ═════════════════════════════════════════════════════════════════════

const THEME_PRIMARY = '#7c3aed'
const THEME_ACCENT = '#ec4899'
const THEME_TEXT = '#0f172a'
const THEME_MUTED = '#64748b'
const THEME_BORDER = '#e2e8f0'
const THEME_BG_SOFT = '#f8fafc'
const THEME_GRADIENT = `linear-gradient(135deg, ${THEME_PRIMARY} 0%, ${THEME_ACCENT} 100%)`

const TOP_NAV_OFFSET_PX = 64
const DEFAULT_SECTION = LEGEND_SECTIONS[0]?.id || 'line_list'
const JSON_INDENT = 2
const DEFAULT_SEPARATOR = '-'

function prettyJson(obj) {
  try { return JSON.stringify(obj, null, JSON_INDENT) } catch { return '' }
}

function safeName(s) {
  return String(s || 'legend').trim().replace(/[^a-zA-Z0-9._-]+/g, '_') || 'legend'
}

function fieldsFromDefinition(def) {
  if (!def || typeof def !== 'object') return []
  return Array.isArray(def.fields) ? def.fields : []
}


export default function LegendSheetsCanvas() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const initialSection = params.get('section') || DEFAULT_SECTION

  const [activeSection, setActiveSection] = useState(initialSection)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [legends, setLegends] = useState([])
  // Counts per section across the whole registry — populated by loadAllCounts()
  // and refreshed by the real-time sync channel.
  const [sectionCounts, setSectionCounts] = useState({})
  const [sectionActive, setSectionActive] = useState({})
  const [selectedId, setSelectedId] = useState(null)
  const [search, setSearch] = useState('')
  const [lastSync, setLastSync] = useState(null)

  // Draft fields
  const [draftName, setDraftName] = useState('')
  const [draftDesc, setDraftDesc] = useState('')
  const [draftDefinition, setDraftDefinition] = useState('')
  const [jsonError, setJsonError] = useState(null)

  const selected = useMemo(
    () => legends.find(l => l.legend_id === selectedId) || null,
    [legends, selectedId]
  )

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const rows = await listLegends(activeSection)
      setLegends(Array.isArray(rows) ? rows : [])
      setSelectedId(null)
    } catch {
      toast.error('Failed to load legends')
    } finally {
      setLoading(false)
    }
  }, [activeSection])

  // Load lightweight counts + active-legend names for every section so the
  // top overview always reflects reality — even when the user is viewing a
  // different section tab.
  const loadAllCounts = useCallback(async () => {
    try {
      const results = await Promise.all(
        LEGEND_SECTIONS.map(s => listLegends(s.id).then(
          rows => ({ id: s.id, rows: Array.isArray(rows) ? rows : [] }),
          ()  => ({ id: s.id, rows: [] }),
        ))
      )
      const counts = {}
      const active = {}
      results.forEach(({ id, rows }) => {
        counts[id] = rows.length
        active[id] = rows.find(r => r.is_active) || null
      })
      setSectionCounts(counts)
      setSectionActive(active)
      setLastSync(new Date())
    } catch { /* silent — auxiliary */ }
  }, [])

  useEffect(() => { refresh() }, [refresh])
  useEffect(() => { loadAllCounts() }, [loadAllCounts])

  // Realtime sync: refresh whenever ANY tab/window creates/edits/deletes a
  // legend. Falls back to polling for browsers without BroadcastChannel.
  useEffect(() => {
    const handler = (msg) => {
      loadAllCounts()
      if (msg?.section === activeSection) refresh()
    }
    const unsub = subscribeLegendSync(handler)
    const timer = setInterval(loadAllCounts, LEGEND_SYNC_POLL_MS)
    return () => { unsub(); clearInterval(timer) }
  }, [activeSection, refresh, loadAllCounts])

  // Keep the URL in sync so the tab can be bookmarked / shared.
  useEffect(() => {
    if ((params.get('section') || DEFAULT_SECTION) !== activeSection) {
      setParams({ section: activeSection }, { replace: true })
    }
  }, [activeSection, params, setParams])

  useEffect(() => {
    if (selected) {
      setDraftName(selected.name || '')
      setDraftDesc(selected.description || '')
      setDraftDefinition(prettyJson(selected.definition || {}))
      setJsonError(null)
    } else {
      setDraftName('')
      setDraftDesc('')
      setDraftDefinition('')
      setJsonError(null)
    }
  }, [selected])

  const parsedDefinition = useMemo(() => {
    if (!draftDefinition.trim()) return null
    try { return JSON.parse(draftDefinition) } catch { return null }
  }, [draftDefinition])

  const validateDefinition = useCallback(() => {
    try {
      JSON.parse(draftDefinition)
      setJsonError(null)
      return true
    } catch (err) {
      setJsonError(err.message)
      return false
    }
  }, [draftDefinition])

  const onNewFromScratch = useCallback(() => {
    setSelectedId(null)
    setDraftName(`New ${activeSection} legend`)
    setDraftDesc('')
    setDraftDefinition(prettyJson({
      separator: DEFAULT_SEPARATOR,
      fields: [{ key: 'field1', label: 'Field 1', regex: '[A-Z0-9]+' }],
    }))
    setJsonError(null)
  }, [activeSection])

  const onLoadDefaultTemplate = useCallback(async () => {
    try {
      const tpl = await getLegendDefaultTemplate(activeSection)
      setSelectedId(null)
      setDraftName(tpl.name || `${activeSection} — default`)
      setDraftDesc(tpl.description || '')
      setDraftDefinition(prettyJson(tpl.definition || {}))
      setJsonError(null)
      toast.info('Default template loaded — edit and Save to create a new legend')
    } catch {
      toast.error('Failed to load default template')
    }
  }, [activeSection])

  const onSave = useCallback(async () => {
    if (!draftName.trim()) { toast.warn('Name is required'); return }
    if (!validateDefinition()) { toast.error('Definition JSON is invalid'); return }
    setSaving(true)
    try {
      const payload = {
        section: activeSection,
        name: draftName.trim(),
        description: draftDesc,
        definition: JSON.parse(draftDefinition),
      }
      if (selectedId) {
        const updated = await updateLegend(selectedId, payload)
        toast.success('Legend updated')
        setLegends(prev => prev.map(l => l.legend_id === updated.legend_id ? updated : l))
        emitLegendSync(LEGEND_SYNC_ACTIONS.UPDATED, { legend_id: updated.legend_id, section: updated.section })
      } else {
        const created = await createLegend(payload)
        toast.success(`Legend created in ${LEGEND_SECTIONS.find(s => s.id === activeSection)?.label || activeSection}`)
        setLegends(prev => [created, ...prev])
        setSelectedId(created.legend_id)
        emitLegendSync(LEGEND_SYNC_ACTIONS.CREATED, { legend_id: created.legend_id, section: created.section })
      }
      loadAllCounts()
    } catch (err) {
      const data = err?.response?.data || {}
      let msg = data?.definition?.[0] || data?.name?.[0] || data?.section?.[0]
             || data?.detail || data?.error || err?.message || 'Save failed'
      if (typeof msg !== 'string') { try { msg = JSON.stringify(msg) } catch { msg = 'Save failed' } }
      toast.error(String(msg))
    } finally {
      setSaving(false)
    }
  }, [draftName, draftDesc, draftDefinition, activeSection, selectedId, validateDefinition])

  const onActivate = useCallback(async (legendId) => {
    try {
      const activated = await activateLegend(legendId)
      toast.success(`Activated: ${activated.name}`)
      setLegends(prev => prev.map(l => ({
        ...l,
        is_active: l.legend_id === activated.legend_id ? true : (l.section === activated.section ? false : l.is_active),
      })))
      emitLegendSync(LEGEND_SYNC_ACTIONS.ACTIVATED, { legend_id: activated.legend_id, section: activated.section })
      loadAllCounts()
    } catch { toast.error('Failed to activate') }
  }, [loadAllCounts])

  const onDelete = useCallback(async (legendId) => {
    if (!window.confirm('Delete this legend? This cannot be undone.')) return
    try {
      const deletedSection = legends.find(l => l.legend_id === legendId)?.section
      await deleteLegend(legendId)
      setLegends(prev => prev.filter(l => l.legend_id !== legendId))
      if (selectedId === legendId) setSelectedId(null)
      toast.success('Legend deleted')
      emitLegendSync(LEGEND_SYNC_ACTIONS.DELETED, { legend_id: legendId, section: deletedSection })
      loadAllCounts()
    } catch { toast.error('Delete failed') }
  }, [selectedId, legends, loadAllCounts])

  const onImportFile = useCallback(async (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    try {
      const items = await parseLegendFile(f, `Imported ${activeSection} legend`)
      if (!items.length) { toast.error('No legends found in the file'); return }
      const first = items[0]
      setSelectedId(null)
      setDraftName(first.name || `Imported ${activeSection} legend`)
      setDraftDesc(first.description || '')
      setDraftDefinition(prettyJson(first.definition || {}))
      setJsonError(null)
      toast.success(items.length > 1
        ? `Loaded first of ${items.length} legends from ${f.name} — edit and Save to create`
        : `Loaded "${first.name}" from ${f.name} — edit and Save to create`)
    } catch (err) {
      toast.error(err?.message || 'Failed to parse file')
    } finally {
      e.target.value = ''
    }
  }, [activeSection])

  // Rows built from an arbitrary definition (one row per field).
  const rowsFromDefinition = useCallback((def) => {
    if (!def || typeof def !== 'object') return []
    const separator = def.separator || DEFAULT_SEPARATOR
    const fields = fieldsFromDefinition(def)
    return fields.map((f, i) => ({
      order: i + 1,
      key: f?.key || '',
      label: f?.label || '',
      regex: f?.regex || '',
      suffix: f?.suffix || '',
      optional: f?.optional ? 'yes' : 'no',
      separator: i === 0 ? '' : separator,
      notes: f?.notes || '',
      lookup: (f?.lookup && typeof f.lookup === 'object')
        ? Object.entries(f.lookup).map(([k, v]) => `${k}=${v}`).join(' | ')
        : '',
    }))
  }, [])

  // Resolve WHAT to export. Priority:
  //   1) The currently-edited draft (if it parses AND has fields)
  //   2) The selected legend from the list (uses its stored definition)
  //   3) ALL legends in the current section
  const resolveExportPayload = useCallback(() => {
    // 1) Draft (only if the user has typed a valid definition with fields)
    if (parsedDefinition && fieldsFromDefinition(parsedDefinition).length) {
      return {
        mode: 'single',
        items: [{
          name: draftName || (selected?.name) || `New ${activeSection} legend`,
          description: draftDesc || '',
          section: activeSection,
          definition: parsedDefinition,
        }],
      }
    }
    // 2) Selected legend
    if (selected && fieldsFromDefinition(selected.definition).length) {
      return {
        mode: 'single',
        items: [{
          name: selected.name,
          description: selected.description || '',
          section: selected.section,
          definition: selected.definition || {},
        }],
      }
    }
    // 3) All legends in current section
    const all = legends.filter(l => fieldsFromDefinition(l.definition).length)
    if (all.length) {
      return {
        mode: 'section',
        items: all.map(l => ({
          name: l.name,
          description: l.description || '',
          section: l.section,
          definition: l.definition || {},
        })),
      }
    }
    return null
  }, [parsedDefinition, selected, legends, draftName, draftDesc, activeSection])

  const nothingToExportMsg = () => {
    const sectionLabel = LEGEND_SECTIONS.find(s => s.id === activeSection)?.label || activeSection
    if (jsonError) return `Cannot export — fix the JSON error first: ${jsonError}`
    if (legends.length === 0) return `Nothing to export — the ${sectionLabel} section has no legends yet. Click Create Legend or Default first.`
    return `Nothing to export — select a legend from the list or click Create Legend.`
  }

  const onExportJson = useCallback(() => {
    const payload = resolveExportPayload()
    if (!payload) { toast.warn(nothingToExportMsg()); return }
    const body = payload.mode === 'single' ? payload.items[0] : { section: activeSection, legends: payload.items }
    const filename = payload.mode === 'single'
      ? `${safeName(payload.items[0].name)}.json`
      : `${safeName(activeSection)}_all_legends.json`
    const blob = new Blob([JSON.stringify(body, null, JSON_INDENT)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = filename
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success(payload.mode === 'single'
      ? `Exported "${payload.items[0].name}" as JSON`
      : `Exported ${payload.items.length} legends as JSON`)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolveExportPayload, activeSection, legends.length, jsonError])

  const CSV_HEADERS = ['legend_name','order','key','label','regex','suffix','optional','separator','notes','lookup']

  const onExportCsv = useCallback(() => {
    const payload = resolveExportPayload()
    if (!payload) { toast.warn(nothingToExportMsg()); return }
    const esc = v => `"${String(v ?? '').replace(/"/g,'""')}"`
    const lines = [CSV_HEADERS.join(',')]
    payload.items.forEach(item => {
      rowsFromDefinition(item.definition).forEach(r => {
        lines.push(CSV_HEADERS.map(h => esc(h === 'legend_name' ? item.name : r[h])).join(','))
      })
    })
    if (lines.length === 1) { toast.warn('Nothing to export — legend has no fields'); return }
    const filename = payload.mode === 'single'
      ? `${safeName(payload.items[0].name)}.csv`
      : `${safeName(activeSection)}_all_legends.csv`
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = filename
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success(`CSV exported (${lines.length - 1} row${lines.length - 1 === 1 ? '' : 's'})`)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolveExportPayload, rowsFromDefinition, activeSection, legends.length, jsonError])

  const XLSX_HEADERS = ['order','key','label','regex','suffix','optional','separator','notes','lookup']

  const onExportExcel = useCallback(() => {
    const payload = resolveExportPayload()
    if (!payload) { toast.warn(nothingToExportMsg()); return }
    const wb = XLSX.utils.book_new()
    // One sheet per legend + a summary Metadata sheet
    const usedNames = new Set()
    let totalRows = 0
    payload.items.forEach((item, idx) => {
      const rows = rowsFromDefinition(item.definition)
      totalRows += rows.length
      // Excel sheet names: <=31 chars, no []:*?/\
      let base = String(item.name || `Legend_${idx + 1}`).replace(/[\[\]:*?/\\]/g, '_').slice(0, 28) || `Legend_${idx + 1}`
      let sheetName = base
      let n = 1
      while (usedNames.has(sheetName)) { sheetName = `${base}_${n++}`.slice(0, 31) }
      usedNames.add(sheetName)
      const sheet = XLSX.utils.json_to_sheet(rows, { header: XLSX_HEADERS })
      XLSX.utils.book_append_sheet(wb, sheet, sheetName)
    })
    const sectionLabel = LEGEND_SECTIONS.find(s => s.id === activeSection)?.label || activeSection
    const meta = [
      { property: 'Section', value: sectionLabel },
      { property: 'Export mode', value: payload.mode === 'single' ? 'Single legend' : `All legends (${payload.items.length})` },
      { property: 'Field rows', value: totalRows },
      { property: 'Exported at', value: new Date().toISOString() },
    ]
    payload.items.forEach((item, i) => {
      meta.push({ property: `Legend #${i + 1} name`, value: item.name })
      if (item.description) meta.push({ property: `Legend #${i + 1} desc`, value: item.description })
      meta.push({ property: `Legend #${i + 1} separator`, value: item.definition?.separator || DEFAULT_SEPARATOR })
    })
    const metaSheet = XLSX.utils.json_to_sheet(meta, { header: ['property','value'] })
    XLSX.utils.book_append_sheet(wb, metaSheet, 'Metadata')
    const filename = payload.mode === 'single'
      ? `${safeName(payload.items[0].name)}.xlsx`
      : `${safeName(activeSection)}_all_legends.xlsx`
    XLSX.writeFile(wb, filename)
    toast.success(payload.mode === 'single'
      ? `Excel exported (${totalRows} field row${totalRows === 1 ? '' : 's'})`
      : `Excel exported (${payload.items.length} legends, ${totalRows} field rows)`)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolveExportPayload, rowsFromDefinition, activeSection, legends.length, jsonError])

  // Filtered list based on search
  const visibleLegends = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return legends
    return legends.filter(l =>
      String(l.name || '').toLowerCase().includes(q) ||
      String(l.description || '').toLowerCase().includes(q)
    )
  }, [legends, search])

  const previewFields = fieldsFromDefinition(parsedDefinition)
  const previewSeparator = parsedDefinition?.separator || DEFAULT_SEPARATOR
  const sampleTag = useMemo(() => {
    if (!previewFields.length) return ''
    return previewFields.map(f => {
      const key = String(f?.key || '').toUpperCase()
      const suffix = f?.suffix || ''
      const placeholder = key ? `<${key}>` : '<VAL>'
      return `${placeholder}${suffix}`
    }).join(previewSeparator)
  }, [previewFields, previewSeparator])

  // Compute what the export buttons will actually export right now, so the
  // labels can show "current" vs "selected" vs "all in section".
  const exportScope = useMemo(() => {
    if (parsedDefinition && fieldsFromDefinition(parsedDefinition).length) {
      return { label: 'current', hint: 'Exports the definition currently in the editor.' }
    }
    if (selected && fieldsFromDefinition(selected.definition).length) {
      return { label: 'selected', hint: `Exports the selected legend "${selected.name}".` }
    }
    const n = legends.filter(l => fieldsFromDefinition(l.definition).length).length
    if (n > 0) return { label: `all · ${n}`, hint: `Exports all ${n} legends in this section.` }
    return { label: 'empty', hint: 'Nothing to export yet — create or load a legend first.' }
  }, [parsedDefinition, selected, legends])
  const exportScopeLabel = exportScope.label
  const exportScopeHint = exportScope.hint
  const exportScopeBadge = {
    marginLeft: 6, padding: '1px 6px', borderRadius: 999,
    background: THEME_BG_SOFT, color: THEME_MUTED,
    fontSize: 10, fontWeight: 700, border: `1px solid ${THEME_BORDER}`,
  }

  return (
    <div style={{
      minHeight: `calc(100vh - ${TOP_NAV_OFFSET_PX}px)`,
      marginTop: TOP_NAV_OFFSET_PX,
      background: THEME_BG_SOFT,
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 20px', background: '#fff', borderBottom: `1px solid ${THEME_BORDER}`,
      }}>
        <button
          type="button"
          onClick={() => navigate('/engineering/process/pid-checker-v2')}
          title="Back to P&ID Checker V2"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '6px 10px', borderRadius: 8, border: `1px solid ${THEME_BORDER}`,
            background: '#fff', color: THEME_TEXT, cursor: 'pointer', fontSize: 12,
          }}
        >
          <ArrowLeft size={14} /> Back
        </button>

        <div style={{
          width: 36, height: 36, borderRadius: 10, background: THEME_GRADIENT,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <BookOpen size={18} color="#fff" />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: THEME_TEXT }}>Legend Sheets — Canvas</div>
          <div style={{ fontSize: 11, color: THEME_MUTED }}>
            Full-screen manager for all legend sections
          </div>
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
          {lastSync && (
            <span style={{ fontSize: 10, color: THEME_MUTED, marginRight: 4 }}>
              synced {lastSync.toLocaleTimeString()}
            </span>
          )}
          <button onClick={() => { refresh(); loadAllCounts() }} style={btnGhost()} title="Reload">
            <RefreshCw size={13} /> Reload
          </button>
          <button onClick={onNewFromScratch} style={btnPrimary()} title="Create a new legend">
            <Plus size={14} /> Create Legend
          </button>
        </div>
      </div>

      {/* All-sections overview — always in sync with backend + other tabs */}
      <div style={{
        display: 'grid', gridTemplateColumns: `repeat(${LEGEND_SECTION_RULES.length}, 1fr)`,
        gap: 12, padding: '12px 20px', background: THEME_BG_SOFT,
        borderBottom: `1px solid ${THEME_BORDER}`,
      }}>
        {LEGEND_SECTION_RULES.map(s => {
          const count = sectionCounts[s.id] ?? 0
          const active = sectionActive[s.id]
          const isCurrent = s.id === activeSection
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setActiveSection(s.id)}
              style={{
                textAlign: 'left', cursor: 'pointer',
                background: '#fff', border: `1px solid ${isCurrent ? s.accent : THEME_BORDER}`,
                borderLeft: `4px solid ${s.accent}`,
                padding: 12, borderRadius: 10,
                display: 'flex', flexDirection: 'column', gap: 4,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 16 }}>{s.icon}</span>
                <span style={{ fontWeight: 700, color: THEME_TEXT, fontSize: 13 }}>{s.label}</span>
                <span style={{
                  marginLeft: 'auto', fontSize: 10, fontWeight: 700,
                  padding: '2px 8px', borderRadius: 999,
                  background: `${s.accent}22`, color: s.accent,
                }}>{count} legend{count === 1 ? '' : 's'}</span>
              </div>
              <div style={{ fontSize: 11, color: THEME_MUTED }}>{s.dataSource}</div>
              <div style={{ fontSize: 11, color: THEME_TEXT, marginTop: 2 }}>
                <span style={{ color: THEME_MUTED }}>Active:&nbsp;</span>
                {active
                  ? <b style={{ color: '#047857' }}>{active.name}</b>
                  : <span style={{ color: '#b45309', fontWeight: 600 }}>none (using built-in default)</span>}
              </div>
            </button>
          )
        })}
      </div>

      {/* Section tabs — horizontally-scrollable pill rail. Fixed single-line
          height (no wrap) keeps every pill the same shape regardless of
          label length; edge fades + a thin custom scrollbar (see
          .legend-canvas-tabrail below) hint that it scrolls instead of
          relying on the browser's default scrollbar sitting on top. */}
      <div style={{ position: 'relative', background: '#fff', borderBottom: `1px solid ${THEME_BORDER}` }}>
        <div className="legend-canvas-tabrail" style={{
          display: 'flex', gap: 8, padding: '12px 20px',
          overflowX: 'auto', scrollSnapType: 'x proximity',
        }}>
          {LEGEND_SECTIONS.map(s => {
            const on = s.id === activeSection
            const count = sectionCounts[s.id] ?? legends.filter(l => l.section === s.id).length
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setActiveSection(s.id)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '9px 16px', borderRadius: 999, flex: '0 0 auto',
                  scrollSnapAlign: 'start', whiteSpace: 'nowrap',
                  border: on ? 'none' : `1px solid ${THEME_BORDER}`,
                  background: on ? THEME_GRADIENT : '#fff',
                  color: on ? '#fff' : THEME_TEXT,
                  fontWeight: 700, fontSize: 12, cursor: 'pointer',
                  boxShadow: on ? '0 4px 12px rgba(124,58,237,0.28)' : 'none',
                  transition: 'background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease, transform 0.1s ease',
                }}
                onMouseEnter={e => { if (!on) e.currentTarget.style.borderColor = THEME_PRIMARY }}
                onMouseLeave={e => { if (!on) e.currentTarget.style.borderColor = THEME_BORDER }}
              >
                {s.label}
                {on && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    minWidth: 20, height: 18, padding: '0 6px', borderRadius: 999,
                    background: 'rgba(255,255,255,0.25)', fontSize: 10,
                  }}>{count}</span>
                )}
                {!on && count > 0 && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    minWidth: 18, height: 18, padding: '0 6px', borderRadius: 999,
                    background: THEME_BG_SOFT, color: THEME_MUTED,
                    fontSize: 10, border: `1px solid ${THEME_BORDER}`,
                  }}>{count}</span>
                )}
              </button>
            )
          })}
        </div>
        {/* Edge fades hint there's more to scroll, without a visible arrow/scrollbar */}
        <div style={{
          position: 'absolute', top: 0, bottom: 0, left: 0, width: 24, pointerEvents: 'none',
          background: 'linear-gradient(90deg, #fff, rgba(255,255,255,0))',
        }} />
        <div style={{
          position: 'absolute', top: 0, bottom: 0, right: 0, width: 24, pointerEvents: 'none',
          background: 'linear-gradient(270deg, #fff, rgba(255,255,255,0))',
        }} />
      </div>

      {/* Main body — two columns */}
      <div style={{
        flex: 1, minHeight: 0,
        display: 'grid', gridTemplateColumns: '360px 1fr',
        gap: 0,
      }}>
        {/* Left: legends list */}
        <div style={{
          borderRight: `1px solid ${THEME_BORDER}`,
          background: '#fff',
          padding: 14, overflowY: 'auto',
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 10px', borderRadius: 8,
            border: `1px solid ${THEME_BORDER}`, background: THEME_BG_SOFT,
          }}>
            <Search size={13} color={THEME_MUTED} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search legends…"
              style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 12 }}
            />
          </div>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button onClick={onLoadDefaultTemplate} style={btnGhost()} title="Load built-in default template">
              <Download size={13} /> Default
            </button>
            <label style={{ ...btnGhost(), cursor: 'pointer' }} title="Import JSON, CSV, or Excel (.xlsx / .xls)">
              <Upload size={13} /> Import
              <input type="file" accept={IMPORT_ACCEPT} onChange={onImportFile} style={{ display: 'none' }} />
            </label>
          </div>

          {loading && (
            <div style={{ color: THEME_MUTED, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Loading…
            </div>
          )}
          {!loading && visibleLegends.length === 0 && (
            <div style={{
              color: THEME_MUTED, fontSize: 12, padding: 12, textAlign: 'center',
              border: `1px dashed ${THEME_BORDER}`, borderRadius: 10, background: THEME_BG_SOFT,
            }}>
              {legends.length === 0
                ? <>No legends in this section yet — click <b>Create Legend</b> or <b>Default</b>.</>
                : <>No results for "{search}"</>}
            </div>
          )}
          {visibleLegends.map(l => {
            const active = l.legend_id === selectedId
            const fieldCount = fieldsFromDefinition(l.definition).length
            return (
              <div key={l.legend_id}
                onClick={() => setSelectedId(l.legend_id)}
                style={{
                  padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                  border: `1px solid ${active ? THEME_PRIMARY : THEME_BORDER}`,
                  background: active ? '#faf5ff' : '#fff',
                }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{
                    fontWeight: 700, color: THEME_TEXT, fontSize: 13, flex: 1,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{l.name}</span>
                  {l.is_active && (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 3,
                      padding: '2px 6px', borderRadius: 999, fontSize: 10,
                      background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0',
                    }}>
                      <CheckCircle2 size={10} /> Active
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: THEME_MUTED, marginTop: 3 }}>
                  {fieldCount} field{fieldCount === 1 ? '' : 's'} · updated {new Date(l.updated_at || l.created_at || Date.now()).toLocaleDateString()}
                </div>
                {l.description && (
                  <div style={{
                    fontSize: 11, color: THEME_MUTED, marginTop: 3,
                    overflow: 'hidden', textOverflow: 'ellipsis',
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                  }}>{l.description}</div>
                )}
              </div>
            )
          })}
        </div>

        {/* Right: full canvas — meta + preview table + JSON */}
        <div style={{
          padding: 20, overflowY: 'auto',
          display: 'flex', flexDirection: 'column', gap: 16,
        }}>
          {/* Meta strip */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
            background: '#fff', padding: 14, borderRadius: 12,
            border: `1px solid ${THEME_BORDER}`,
          }}>
            <label style={fieldLabel()}>
              Legend Name
              <input value={draftName} onChange={e => setDraftName(e.target.value)}
                placeholder="e.g. Line List — Standard Rev 3" style={fieldInput()} />
            </label>
            <label style={fieldLabel()}>
              Description
              <input value={draftDesc} onChange={e => setDraftDesc(e.target.value)}
                placeholder="Optional short description" style={fieldInput()} />
            </label>
          </div>

          {/* Sample-tag preview */}
          {sampleTag && (
            <div style={{
              padding: '10px 14px', borderRadius: 10,
              background: 'linear-gradient(135deg, #faf5ff 0%, #fdf2f8 100%)',
              border: `1px solid ${THEME_BORDER}`,
              display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
            }}>
              <span style={{ fontSize: 11, color: THEME_MUTED, fontWeight: 600 }}>SAMPLE TAG</span>
              <code style={{
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                fontSize: 14, color: THEME_TEXT, fontWeight: 700,
                background: '#fff', padding: '4px 10px', borderRadius: 6,
                border: `1px solid ${THEME_BORDER}`,
              }}>{sampleTag}</code>
              <span style={{ fontSize: 11, color: THEME_MUTED }}>
                separator: <code style={{ background: '#fff', padding: '1px 5px', borderRadius: 4 }}>{previewSeparator}</code>
              </span>
            </div>
          )}

          {/* Fields table — the "canvas" view of the legend sheet */}
          <div style={{
            background: '#fff', borderRadius: 12,
            border: `1px solid ${THEME_BORDER}`, overflow: 'hidden',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 14px', borderBottom: `1px solid ${THEME_BORDER}`,
              background: THEME_BG_SOFT,
            }}>
              <span style={{ fontWeight: 700, color: THEME_TEXT, fontSize: 13 }}>
                Legend Sheet — {LEGEND_SECTIONS.find(s => s.id === activeSection)?.label || activeSection}
              </span>
              <span style={{
                display: 'inline-flex', padding: '2px 8px', borderRadius: 999,
                background: '#fff', border: `1px solid ${THEME_BORDER}`,
                fontSize: 11, color: THEME_MUTED, fontWeight: 600,
              }}>
                {previewFields.length} field{previewFields.length === 1 ? '' : 's'}
              </span>
            </div>
            {previewFields.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: THEME_MUTED, fontSize: 13 }}>
                No fields defined yet. Click <b>Create Legend</b> or load the <b>Default</b> template to begin.
              </div>
            ) : (
              <div style={{ overflow: 'auto', maxHeight: 420 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead style={{ background: THEME_BG_SOFT, position: 'sticky', top: 0 }}>
                    <tr>
                      {['#','Key','Label','Regex','Suffix','Sep','Optional','Notes','Lookup'].map(h => (
                        <th key={h} style={th()}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewFields.map((f, i) => (
                      <tr key={i} style={{ borderTop: `1px solid ${THEME_BORDER}` }}>
                        <td style={td()}>{i + 1}</td>
                        <td style={{ ...td(), fontFamily: 'ui-monospace, monospace', color: THEME_PRIMARY, fontWeight: 700 }}>{f?.key}</td>
                        <td style={td()}>{f?.label}</td>
                        <td style={{ ...td(), fontFamily: 'ui-monospace, monospace', color: '#0369a1' }}>{f?.regex}</td>
                        <td style={{ ...td(), fontFamily: 'ui-monospace, monospace' }}>{f?.suffix || ''}</td>
                        <td style={{ ...td(), color: THEME_MUTED }}>{i === 0 ? '—' : previewSeparator}</td>
                        <td style={td()}>{f?.optional ? 'yes' : 'no'}</td>
                        <td style={{ ...td(), maxWidth: 240, whiteSpace: 'normal' }}>{f?.notes || ''}</td>
                        <td style={{ ...td(), maxWidth: 260, whiteSpace: 'normal', color: THEME_MUTED }}>
                          {f?.lookup && typeof f.lookup === 'object'
                            ? Object.entries(f.lookup).map(([k, v]) => `${k}=${v}`).join(', ')
                            : ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Comparison rules — soft-coded per section */}
          <RulesCard sectionId={activeSection} />

          {/* JSON editor */}
          <div style={{
            background: '#fff', borderRadius: 12,
            border: `1px solid ${THEME_BORDER}`, padding: 14,
            display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 700, color: THEME_TEXT, fontSize: 13 }}>Definition (JSON)</div>
              <div style={{ fontSize: 11, color: THEME_MUTED }}>
                Structure: <code>{'{ separator, fields: [{ key, label, regex, suffix?, optional?, lookup?, notes? }] }'}</code>
              </div>
            </div>
            <textarea
              value={draftDefinition}
              onChange={e => setDraftDefinition(e.target.value)}
              onBlur={validateDefinition}
              spellCheck={false}
              rows={14}
              style={{
                ...fieldInput(),
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                fontSize: 12.5, minHeight: 260, resize: 'vertical',
                borderColor: jsonError ? '#fca5a5' : THEME_BORDER,
              }}
            />
            {jsonError && (
              <div style={{ fontSize: 11, color: '#b91c1c' }}>JSON parse error: {jsonError}</div>
            )}
          </div>

          {/* Footer actions */}
          <div style={{
            position: 'sticky', bottom: 0, marginTop: 'auto',
            background: '#fff', padding: '12px 14px', borderRadius: 12,
            border: `1px solid ${THEME_BORDER}`,
            display: 'flex', gap: 8, flexWrap: 'wrap',
          }}>
            <button onClick={onSave} disabled={saving} style={btnPrimary(true)}>
              {saving
                ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Saving…</>
                : <><Save size={14} /> {selectedId ? 'Save changes' : 'Create legend'}</>}
            </button>
            {selectedId && !selected?.is_active && (
              <button onClick={() => onActivate(selectedId)} style={btnGreen()}>
                <CheckCircle2 size={14} /> Activate for {LEGEND_SECTIONS.find(s => s.id === activeSection)?.label || activeSection}
              </button>
            )}
            <button onClick={onExportExcel} style={btnGhost()} title={exportScopeHint}>
              <FileSpreadsheet size={14} /> Export Excel <span style={exportScopeBadge}>{exportScopeLabel}</span>
            </button>
            <button onClick={onExportCsv} style={btnGhost()} title={exportScopeHint}>
              <FileText size={14} /> Export CSV <span style={exportScopeBadge}>{exportScopeLabel}</span>
            </button>
            <button onClick={onExportJson} style={btnGhost()} title={exportScopeHint}>
              <Download size={14} /> Export JSON <span style={exportScopeBadge}>{exportScopeLabel}</span>
            </button>
            {selectedId && (
              <button onClick={() => onDelete(selectedId)} style={btnDanger()}>
                <Trash2 size={14} /> Delete
              </button>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .legend-canvas-tabrail { scrollbar-width: thin; scrollbar-color: #cbd5e1 transparent; }
        .legend-canvas-tabrail::-webkit-scrollbar { height: 6px; }
        .legend-canvas-tabrail::-webkit-scrollbar-track { background: transparent; }
        .legend-canvas-tabrail::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 6px; }
        .legend-canvas-tabrail::-webkit-scrollbar-button { display: none; height: 0; width: 0; }
      `}</style>
    </div>
  )
}

// ── Style helpers ───────────────────────────────────────────────────
function fieldLabel() {
  return { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: THEME_MUTED, fontWeight: 600 }
}
function fieldInput() {
  return {
    padding: '9px 11px', borderRadius: 8, border: `1px solid ${THEME_BORDER}`,
    fontSize: 13, color: THEME_TEXT, background: '#fff', outline: 'none',
    fontFamily: 'inherit',
  }
}
function btnPrimary(large = false) {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: large ? '9px 16px' : '7px 12px', borderRadius: 8, border: 'none',
    background: THEME_GRADIENT, color: '#fff', fontWeight: 700, fontSize: large ? 13 : 12,
    cursor: 'pointer',
  }
}
function btnGhost() {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '7px 12px', borderRadius: 8, border: `1px solid ${THEME_BORDER}`,
    background: '#fff', color: THEME_TEXT, fontSize: 12, cursor: 'pointer',
  }
}
function btnGreen() {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '9px 14px', borderRadius: 8, border: '1px solid #10b981',
    background: '#ecfdf5', color: '#047857', fontWeight: 700, fontSize: 12,
    cursor: 'pointer',
  }
}
function btnDanger() {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '9px 14px', borderRadius: 8, border: '1px solid #fecaca',
    background: '#fef2f2', color: '#b91c1c', fontWeight: 700, fontSize: 12,
    cursor: 'pointer',
  }
}
function th() {
  return {
    padding: '8px 10px', textAlign: 'left', fontSize: 11, fontWeight: 700,
    color: THEME_MUTED, textTransform: 'uppercase', letterSpacing: 0.3,
    borderBottom: `1px solid ${THEME_BORDER}`, whiteSpace: 'nowrap',
  }
}
function td() {
  return { padding: '8px 10px', color: THEME_TEXT, verticalAlign: 'top', whiteSpace: 'nowrap' }
}

// ═════════════════════════════════════════════════════════════════════
// RulesCard — soft-coded set of comparison rules displayed per section.
// Sourced from src/config/legendSheetsRules.js so ops can tune the list
// without touching this component.
// ═════════════════════════════════════════════════════════════════════
function RulesCard({ sectionId }) {
  const spec = getSectionRules(sectionId)
  if (!spec) return null
  return (
    <div style={{
      background: '#fff', borderRadius: 12,
      border: `1px solid ${THEME_BORDER}`, overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 14px', borderBottom: `1px solid ${THEME_BORDER}`,
        background: `linear-gradient(90deg, ${spec.accent}15 0%, #fff 100%)`,
      }}>
        <span style={{ fontSize: 18 }}>{spec.icon}</span>
        <span style={{ fontWeight: 700, color: THEME_TEXT, fontSize: 13 }}>
          Comparison Rules — {spec.label}
        </span>
        <span style={{
          marginLeft: 'auto', fontSize: 10, fontWeight: 700,
          padding: '2px 8px', borderRadius: 999,
          background: `${spec.accent}22`, color: spec.accent,
        }}>{spec.rules.length} rules</span>
      </div>
      <div style={{
        padding: '10px 14px', display: 'grid', gap: 6,
        gridTemplateColumns: '1fr 1fr', fontSize: 11, color: THEME_MUTED,
      }}>
        <div><b style={{ color: THEME_TEXT }}>Data source:</b> {spec.dataSource}</div>
        <div><b style={{ color: THEME_TEXT }}>Match key:</b> {spec.matchKey}</div>
      </div>
      <div style={{ padding: '4px 14px 14px' }}>
        {spec.rules.map((r) => (
          <div key={r.id} style={{
            display: 'grid', gridTemplateColumns: '70px 180px 1fr', gap: 10,
            padding: '8px 0', borderTop: `1px dashed ${THEME_BORDER}`, alignItems: 'baseline',
          }}>
            <code style={{
              fontFamily: 'ui-monospace, monospace', fontSize: 11, fontWeight: 700,
              color: spec.accent, background: `${spec.accent}12`,
              padding: '2px 6px', borderRadius: 4, textAlign: 'center',
            }}>{r.id}</code>
            <div style={{ fontWeight: 700, color: THEME_TEXT, fontSize: 12 }}>{r.name}</div>
            <div style={{ color: THEME_MUTED, fontSize: 12, lineHeight: 1.45 }}>{r.detail}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
