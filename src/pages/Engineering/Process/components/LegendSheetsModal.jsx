import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'react-toastify'
import * as XLSX from 'xlsx'
import { BookOpen, Plus, Save, Trash2, CheckCircle2, X, Download, Upload, Loader2, LayoutList, Braces, GripVertical, FileSpreadsheet, FileText } from 'lucide-react'

import {
  listLegends, createLegend, updateLegend, deleteLegend,
  activateLegend, getLegendDefaultTemplate, LEGEND_SECTIONS,
} from '../../../../services/pidCheckerV2API'
import { emitLegendSync, subscribeLegendSync, LEGEND_SYNC_ACTIONS, LEGEND_SYNC_POLL_MS } from '../../../../config/legendSheetsRules'
import { parseLegendFile, IMPORT_ACCEPT } from '../../../../config/legendSheetsImport'

// ═════════════════════════════════════════════════════════════════════
// Soft-coded theme (matches parent page)
// ═════════════════════════════════════════════════════════════════════
const THEME_PRIMARY = '#7c3aed'
const THEME_ACCENT = '#ec4899'
const THEME_TEXT = '#0f172a'
const THEME_MUTED = '#64748b'
const THEME_BORDER = '#e2e8f0'
const THEME_BG_SOFT = '#f8fafc'
const THEME_GRADIENT = `linear-gradient(135deg, ${THEME_PRIMARY} 0%, ${THEME_ACCENT} 100%)`

const DEFAULT_SECTION = LEGEND_SECTIONS[0]?.id || 'line_list'
const JSON_INDENT = 2
const EDITOR_MODE_FORM = 'form'
const EDITOR_MODE_JSON = 'json'
const DEFAULT_SEPARATOR = '-'

function prettyJson(obj) {
  try { return JSON.stringify(obj, null, JSON_INDENT) } catch { return '' }
}

// Convert lookup object → friendly "KEY = VALUE" text (one per line)
function lookupToText(lookup) {
  if (!lookup || typeof lookup !== 'object') return ''
  return Object.entries(lookup).map(([k, v]) => `${k} = ${v}`).join('\n')
}

// Parse friendly "KEY = VALUE" text back into a lookup object
function textToLookup(text) {
  const out = {}
  const raw = String(text || '')
  raw.split(/\r?\n/).forEach(line => {
    const s = line.trim()
    if (!s) return
    const idx = s.indexOf('=')
    if (idx <= 0) return
    const k = s.slice(0, idx).trim()
    const v = s.slice(idx + 1).trim()
    if (k) out[k] = v
  })
  return Object.keys(out).length ? out : null
}

// Parse the raw JSON string into a safe form-model
function parseDefinitionSafely(jsonStr) {
  try {
    const parsed = JSON.parse(jsonStr || '{}')
    const separator = typeof parsed.separator === 'string' ? parsed.separator : DEFAULT_SEPARATOR
    const fields = Array.isArray(parsed.fields) ? parsed.fields.map(f => ({
      key: String(f?.key || ''),
      label: String(f?.label || ''),
      regex: String(f?.regex || ''),
      suffix: String(f?.suffix || ''),
      optional: Boolean(f?.optional),
      notes: String(f?.notes || ''),
      lookup: (f?.lookup && typeof f.lookup === 'object') ? f.lookup : null,
    })) : []
    return { separator, fields, _extra: stripKnown(parsed) }
  } catch {
    return null
  }
}

// Preserve unknown top-level keys so the form editor doesn't drop them
function stripKnown(obj) {
  const { separator, fields, ...rest } = obj || {}
  return rest
}

// Rebuild a definition object from the form model
function buildDefinitionFromForm(model) {
  const out = { ...(model._extra || {}), separator: model.separator || DEFAULT_SEPARATOR, fields: [] }
  model.fields.forEach(f => {
    const field = {
      key: f.key.trim(),
      label: f.label.trim(),
      regex: f.regex,
    }
    if (f.suffix) field.suffix = f.suffix
    if (f.optional) field.optional = true
    if (f.notes) field.notes = f.notes
    if (f.lookup && Object.keys(f.lookup).length) field.lookup = f.lookup
    out.fields.push(field)
  })
  return out
}

function newBlankField() {
  return { key: '', label: '', regex: '[A-Z0-9]+', suffix: '', optional: false, notes: '', lookup: null }
}

/**
 * LegendSheetsModal — full legend-sheet manager.
 *
 * Props:
 *   open, onClose
 *   section          — initial section id (user can switch via tabs)
 *   onActiveChange   — callback(activeLegendOrNull) fired whenever the active
 *                      legend for the CURRENT section changes; parent uses it
 *                      to refresh the "Active Legend" badge.
 */
export default function LegendSheetsModal({ open, onClose, section = DEFAULT_SECTION, onActiveChange }) {
  const [activeSection, setActiveSection] = useState(section || DEFAULT_SECTION)

  // Re-sync internal section when the parent re-opens the modal with a new one.
  useEffect(() => { if (open) setActiveSection(section || DEFAULT_SECTION) }, [open, section])

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [legends, setLegends] = useState([])
  const [selectedId, setSelectedId] = useState(null)

  // Draft (edit form) fields
  const [draftName, setDraftName] = useState('')
  const [draftDesc, setDraftDesc] = useState('')
  const [draftDefinition, setDraftDefinition] = useState('')
  const [jsonError, setJsonError] = useState(null)
  const [editorMode, setEditorMode] = useState(EDITOR_MODE_FORM)

  const selected = useMemo(
    () => legends.find(l => l.legend_id === selectedId) || null,
    [legends, selectedId]
  )

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const rows = await listLegends(activeSection)
      setLegends(Array.isArray(rows) ? rows : [])
      // Clear selection when switching sections so the editor doesn't show a
      // stale legend belonging to a different section.
      setSelectedId(null)
      // notify parent about active state (only when viewing the section the
      // parent originally opened us with)
      if (onActiveChange && activeSection === section) {
        const active = (rows || []).find(l => l.is_active) || null
        onActiveChange(active)
      }
    } catch (err) {
      toast.error('Failed to load legends')
    } finally {
      setLoading(false)
    }
  }, [activeSection, section, onActiveChange])

  useEffect(() => { if (open) refresh() }, [open, refresh])

  // Realtime cross-tab sync: refresh when any other window mutates a legend
  // in the section we're currently viewing. Polling fallback covers browsers
  // without BroadcastChannel (Safari private mode, older Edge, etc.).
  useEffect(() => {
    if (!open) return undefined
    const handler = (msg) => { if (!msg?.section || msg.section === activeSection) refresh() }
    const unsub = subscribeLegendSync(handler)
    const timer = setInterval(refresh, LEGEND_SYNC_POLL_MS)
    return () => { unsub(); clearInterval(timer) }
  }, [open, activeSection, refresh])

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
    try {
      const parsed = JSON.parse(draftDefinition)
      return parsed
    } catch (err) {
      return null
    }
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
      separator: '-',
      fields: [
        { key: 'field1', label: 'Field 1', regex: '[A-Z0-9]+' },
      ],
    }))
    setEditorMode(EDITOR_MODE_FORM)
    setJsonError(null)
  }, [activeSection])

  const onLoadDefaultTemplate = useCallback(async () => {
    try {
      const tpl = await getLegendDefaultTemplate(activeSection)
      setSelectedId(null)
      setDraftName(tpl.name || `${activeSection} — default`)
      setDraftDesc(tpl.description || '')
      setDraftDefinition(prettyJson(tpl.definition || {}))
      setEditorMode(EDITOR_MODE_FORM)
      setJsonError(null)
      toast.info('Default template loaded — edit and Save to create a new legend')
    } catch (err) {
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
    } catch (err) {
      // Surface backend field-level validation errors (definition/name/section)
      const data = err?.response?.data || {}
      let msg = data?.definition?.[0]
            || data?.name?.[0]
            || data?.section?.[0]
            || data?.detail
            || data?.error
            || err?.message
            || 'Save failed'
      if (typeof msg !== 'string') {
        try { msg = JSON.stringify(msg) } catch { msg = 'Save failed' }
      }
      toast.error(String(msg))
    } finally {
      setSaving(false)
    }
  }, [draftName, draftDesc, draftDefinition, activeSection, selectedId, validateDefinition])

  const onActivate = useCallback(async (legendId) => {
    try {
      const activated = await activateLegend(legendId)
      toast.success(`Activated: ${activated.name}`)
      // Update local list: only one active per section
      setLegends(prev => prev.map(l => ({
        ...l,
        is_active: l.legend_id === activated.legend_id ? true : (l.section === activated.section ? false : l.is_active),
      })))
      if (onActiveChange && activated.section === section) onActiveChange(activated)
      emitLegendSync(LEGEND_SYNC_ACTIONS.ACTIVATED, { legend_id: activated.legend_id, section: activated.section })
    } catch (err) {
      toast.error('Failed to activate')
    }
  }, [onActiveChange, section])

  const onDelete = useCallback(async (legendId) => {
    if (!window.confirm('Delete this legend? This cannot be undone.')) return
    try {
      await deleteLegend(legendId)
      const wasActive = legends.find(l => l.legend_id === legendId)?.is_active
      const deletedSection = legends.find(l => l.legend_id === legendId)?.section
      setLegends(prev => prev.filter(l => l.legend_id !== legendId))
      if (selectedId === legendId) setSelectedId(null)
      toast.success('Legend deleted')
      if (onActiveChange && wasActive && deletedSection === section) onActiveChange(null)
      emitLegendSync(LEGEND_SYNC_ACTIONS.DELETED, { legend_id: legendId, section: deletedSection })
    } catch (err) {
      toast.error('Delete failed')
    }
  }, [selectedId, legends, onActiveChange, section])

  const safeFilenameBase = useCallback(() => {
    const base = (draftName || activeSection || 'legend').trim().replace(/[^a-zA-Z0-9._-]+/g, '_')
    return base || activeSection
  }, [draftName, activeSection])

  const onExportJson = useCallback(() => {
    if (!parsedDefinition) { toast.warn('Fix JSON before exporting'); return }
    const payload = {
      section: activeSection,
      name: draftName,
      description: draftDesc,
      definition: parsedDefinition,
    }
    const blob = new Blob([JSON.stringify(payload, null, JSON_INDENT)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${safeFilenameBase()}.json`
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [parsedDefinition, activeSection, draftName, draftDesc, safeFilenameBase])

  // Build a tabular representation of the current definition — one row per field.
  // Used by both CSV and Excel exports.
  const buildTableRows = useCallback(() => {
    if (!parsedDefinition) return null
    const separator = parsedDefinition.separator || DEFAULT_SEPARATOR
    const fields = Array.isArray(parsedDefinition.fields) ? parsedDefinition.fields : []
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
  }, [parsedDefinition])

  const onExportCsv = useCallback(() => {
    const rows = buildTableRows()
    if (!rows) { toast.warn('Fix JSON before exporting'); return }
    if (!rows.length) { toast.warn('Definition has no fields to export'); return }
    const headers = ['order', 'key', 'label', 'regex', 'suffix', 'optional', 'separator', 'notes', 'lookup']
    const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const lines = [headers.join(',')]
    rows.forEach(r => lines.push(headers.map(h => escape(r[h])).join(',')))
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${safeFilenameBase()}.csv`
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success('CSV exported')
  }, [buildTableRows, safeFilenameBase])

  const onExportExcel = useCallback(() => {
    const rows = buildTableRows()
    if (!rows) { toast.warn('Fix JSON before exporting'); return }
    if (!rows.length) { toast.warn('Definition has no fields to export'); return }
    const wb = XLSX.utils.book_new()
    // Fields sheet
    const fieldsSheet = XLSX.utils.json_to_sheet(rows, {
      header: ['order', 'key', 'label', 'regex', 'suffix', 'optional', 'separator', 'notes', 'lookup'],
    })
    XLSX.utils.book_append_sheet(wb, fieldsSheet, 'Fields')
    // Metadata sheet
    const meta = [
      { property: 'Section', value: LEGEND_SECTIONS.find(s => s.id === activeSection)?.label || activeSection },
      { property: 'Name', value: draftName || '' },
      { property: 'Description', value: draftDesc || '' },
      { property: 'Separator', value: parsedDefinition?.separator || DEFAULT_SEPARATOR },
      { property: 'Field count', value: rows.length },
      { property: 'Exported at', value: new Date().toISOString() },
    ]
    const metaSheet = XLSX.utils.json_to_sheet(meta, { header: ['property', 'value'] })
    XLSX.utils.book_append_sheet(wb, metaSheet, 'Metadata')
    XLSX.writeFile(wb, `${safeFilenameBase()}.xlsx`)
    toast.success('Excel exported')
  }, [buildTableRows, activeSection, draftName, draftDesc, parsedDefinition, safeFilenameBase])

  const onImportJson = useCallback(async (e) => {
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
      setEditorMode(EDITOR_MODE_FORM)
      setJsonError(null)
      toast.success(items.length > 1
        ? `Loaded first of ${items.length} legends from ${f.name} — edit and Save to create`
        : `Loaded "${first.name}" from ${f.name} — edit and Save to create`)
    } catch (err) {
      toast.error(err?.message || 'Failed to parse file')
    } finally {
      e.target.value = ''
    }
  }, [section])

  // Switch between Form and JSON tabs. Form → JSON is easy (JSON is source
  // of truth). JSON → Form requires a valid parse first.
  const switchToJson = useCallback(() => setEditorMode(EDITOR_MODE_JSON), [])
  const switchToForm = useCallback(() => {
    const model = parseDefinitionSafely(draftDefinition)
    if (!model) {
      toast.error('Fix JSON syntax before switching to the form view')
      return
    }
    setEditorMode(EDITOR_MODE_FORM)
    setJsonError(null)
  }, [draftDefinition])

  if (!open) return null

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: 20,
    }}>
      <div style={{
        background: '#fff', borderRadius: 14, width: '100%', maxWidth: 1100,
        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 22px', borderBottom: `1px solid ${THEME_BORDER}`,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, background: THEME_GRADIENT,
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
          }}>
            <BookOpen size={18} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: THEME_TEXT }}>Legend Sheets</div>
            <div style={{ fontSize: 12, color: THEME_MUTED }}>
              Define custom extraction rules — switch section to view or create legends for {LEGEND_SECTIONS.map(s => s.label).join(', ')}
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer', color: THEME_MUTED,
            display: 'flex', alignItems: 'center', padding: 6, borderRadius: 8,
          }} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {/* Sync Info Banner */}
        <div style={{
          padding: '10px 22px', background: 'linear-gradient(135deg, #eff6ff, #eef2ff)',
          borderBottom: `1px solid ${THEME_BORDER}`, display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: 16 }}>🔄</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#1e40af', marginBottom: 2 }}>
              Synchronized Across Versions
            </div>
            <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.4 }}>
              Legends are shared between V1 (P&ID Verification) and V2 (Line List Extractor). Create once, use everywhere.
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600 }}>
            <span style={{ padding: '3px 8px', background: '#dbeafe', color: '#1e40af', borderRadius: 6 }}>V1</span>
            <span style={{ color: '#94a3b8' }}>↔</span>
            <span style={{ padding: '3px 8px', background: '#dbeafe', color: '#1e40af', borderRadius: 6 }}>V2</span>
          </div>
        </div>

        {/* Body: two columns */}
        <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', flex: 1, minHeight: 0 }}>
          {/* ── Left: list ──────────────────────────────────────── */}
          <div style={{
            borderRight: `1px solid ${THEME_BORDER}`, padding: 14, overflowY: 'auto',
            display: 'flex', flexDirection: 'column', gap: 8, background: THEME_BG_SOFT,
          }}>
            {/* Section switcher — lets user browse and create legends in ANY section */}
            <div style={{
              display: 'flex', gap: 4, padding: 3, borderRadius: 8,
              background: '#fff', border: `1px solid ${THEME_BORDER}`,
            }}>
              {LEGEND_SECTIONS.map(s => {
                const on = s.id === activeSection
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setActiveSection(s.id)}
                    title={s.label}
                    style={{
                      flex: 1, padding: '6px 8px', borderRadius: 6,
                      border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700,
                      background: on ? THEME_GRADIENT : 'transparent',
                      color: on ? '#fff' : THEME_TEXT,
                    }}
                  >
                    {s.label}
                  </button>
                )
              })}
            </div>

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button
                onClick={onNewFromScratch}
                style={btnPrimary()}
                title="Create a new legend in the selected section"
              >
                <Plus size={14} /> New
              </button>
              <button
                onClick={onLoadDefaultTemplate}
                style={btnGhost()}
                title="Load the built-in default template as a starting point"
              >
                <Download size={14} /> Default
              </button>
              <label style={{ ...btnGhost(), cursor: 'pointer', display: 'inline-flex' }} title="Import JSON, CSV, or Excel (.xlsx / .xls)">
                <Upload size={14} /> Import
                <input type="file" accept={IMPORT_ACCEPT} onChange={onImportJson} style={{ display: 'none' }} />
              </label>
            </div>

            {loading && (
              <div style={{ color: THEME_MUTED, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Loading…
              </div>
            )}
            {!loading && legends.length === 0 && (
              <div style={{ color: THEME_MUTED, fontSize: 13, padding: '10px 4px' }}>
                No legends yet — click <b>Default</b> to seed one from the built-in template.
              </div>
            )}
            {legends.map(l => {
              const active = l.legend_id === selectedId
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
                      fontWeight: 600, color: THEME_TEXT, fontSize: 13,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
                    }}>
                      {l.name}
                    </span>
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
                  {l.description && (
                    <div style={{
                      fontSize: 11, color: THEME_MUTED, marginTop: 3,
                      overflow: 'hidden', textOverflow: 'ellipsis',
                      display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                    }}>
                      {l.description}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* ── Right: editor ──────────────────────────────────── */}
          <div style={{ padding: 18, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label style={fieldLabel()}>Name
              <input
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                placeholder="e.g. Line List — Standard Rev 3"
                style={fieldInput()}
              />
            </label>

            <label style={fieldLabel()}>Description
              <textarea
                value={draftDesc}
                onChange={(e) => setDraftDesc(e.target.value)}
                placeholder="Optional short description"
                rows={2}
                style={{ ...fieldInput(), resize: 'vertical' }}
              />
            </label>

            <label style={fieldLabel()}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>Definition</span>
                {/* Tab switcher */}
                <div style={{ display: 'inline-flex', border: `1px solid ${THEME_BORDER}`, borderRadius: 8, overflow: 'hidden' }}>
                  <button
                    type="button"
                    onClick={() => switchToForm()}
                    style={tabBtnStyle(editorMode === EDITOR_MODE_FORM)}
                    title="Friendly form editor"
                  >
                    <LayoutList size={12} /> Form
                  </button>
                  <button
                    type="button"
                    onClick={() => switchToJson()}
                    style={tabBtnStyle(editorMode === EDITOR_MODE_JSON)}
                    title="Raw JSON editor"
                  >
                    <Braces size={12} /> JSON
                  </button>
                </div>
              </div>

              {editorMode === EDITOR_MODE_JSON && (
                <>
                  <div style={{ position: 'relative' }}>
                    <textarea
                      value={draftDefinition}
                      onChange={(e) => setDraftDefinition(e.target.value)}
                      onBlur={validateDefinition}
                      spellCheck={false}
                      rows={18}
                      style={{
                        ...fieldInput(),
                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                        fontSize: 12.5,
                        minHeight: 260,
                        resize: 'vertical',
                        borderColor: jsonError ? '#fca5a5' : THEME_BORDER,
                      }}
                    />
                  </div>
                  {jsonError && (
                    <div style={{ fontSize: 11, color: '#b91c1c', marginTop: 4 }}>
                      JSON parse error: {jsonError}
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: THEME_MUTED, marginTop: 6 }}>
                    Structure: <code>{'{ separator, fields: [{ key, label, regex, suffix?, optional?, lookup?, notes? }] }'}</code>
                  </div>
                </>
              )}

              {editorMode === EDITOR_MODE_FORM && (
                <FormEditor
                  definition={draftDefinition}
                  onChange={(nextDef) => setDraftDefinition(prettyJson(nextDef))}
                  onError={setJsonError}
                  jsonError={jsonError}
                />
              )}
            </label>

            {/* Footer actions */}
            <div style={{ display: 'flex', gap: 8, marginTop: 'auto', flexWrap: 'wrap' }}>
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
              <button onClick={onExportExcel} style={btnGhost()} title="Export field definitions as Excel (.xlsx)">
                <FileSpreadsheet size={14} /> Export Excel
              </button>
              <button onClick={onExportCsv} style={btnGhost()} title="Export field definitions as CSV">
                <FileText size={14} /> Export CSV
              </button>
              <button onClick={onExportJson} style={btnGhost()} title="Export full legend (metadata + definition) as JSON">
                <Download size={14} /> Export JSON
              </button>
              {selectedId && (
                <button onClick={() => onDelete(selectedId)} style={btnDanger()}>
                  <Trash2 size={14} /> Delete
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}


// ─── Style helpers ──────────────────────────────────────────────────
function fieldLabel() {
  return { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: THEME_MUTED, fontWeight: 500 }
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
    background: THEME_GRADIENT, color: '#fff', fontWeight: 600, fontSize: large ? 13 : 12,
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
    background: '#ecfdf5', color: '#047857', fontWeight: 600, fontSize: 12,
    cursor: 'pointer',
  }
}
function btnDanger() {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '9px 14px', borderRadius: 8, border: '1px solid #fecaca',
    background: '#fef2f2', color: '#b91c1c', fontWeight: 600, fontSize: 12,
    cursor: 'pointer',
  }
}
function tabBtnStyle(active) {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '5px 10px', border: 'none', cursor: 'pointer', fontSize: 11,
    background: active ? THEME_GRADIENT : '#fff',
    color: active ? '#fff' : THEME_TEXT,
    fontWeight: 600,
  }
}


// ═════════════════════════════════════════════════════════════════════
// FormEditor — friendly no-code editor for the legend definition.
// Source-of-truth is a JSON string on the parent; on every change we
// re-emit the entire definition object.
// ═════════════════════════════════════════════════════════════════════
function FormEditor({ definition, onChange, onError, jsonError }) {
  const model = useMemo(() => parseDefinitionSafely(definition), [definition])

  const emit = useCallback((nextModel) => {
    try {
      onChange(buildDefinitionFromForm(nextModel))
      onError(null)
    } catch (err) {
      onError(err.message)
    }
  }, [onChange, onError])

  if (!model) {
    return (
      <div style={{
        padding: 14, borderRadius: 8, border: `1px solid #fca5a5`,
        background: '#fef2f2', color: '#b91c1c', fontSize: 12, marginTop: 6,
      }}>
        The current JSON cannot be parsed{jsonError ? `: ${jsonError}` : ''}. Switch to the JSON tab to fix it.
      </div>
    )
  }

  const updateSeparator = (v) => emit({ ...model, separator: v })

  const updateField = (idx, patch) => {
    const fields = model.fields.map((f, i) => i === idx ? { ...f, ...patch } : f)
    emit({ ...model, fields })
  }

  const removeField = (idx) => {
    if (!window.confirm('Remove this field?')) return
    const fields = model.fields.filter((_, i) => i !== idx)
    emit({ ...model, fields })
  }

  const addField = () => emit({ ...model, fields: [...model.fields, newBlankField()] })

  const moveField = (idx, dir) => {
    const j = idx + dir
    if (j < 0 || j >= model.fields.length) return
    const fields = [...model.fields]
    ;[fields[idx], fields[j]] = [fields[j], fields[idx]]
    emit({ ...model, fields })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 6 }}>
      <div style={{
        display: 'flex', gap: 10, alignItems: 'center',
        padding: '8px 10px', borderRadius: 8, background: THEME_BG_SOFT, border: `1px solid ${THEME_BORDER}`,
      }}>
        <span style={{ fontSize: 11, color: THEME_MUTED, fontWeight: 600 }}>Separator</span>
        <input
          value={model.separator}
          onChange={(e) => updateSeparator(e.target.value)}
          placeholder="-"
          style={{
            ...fieldInput(), width: 60, textAlign: 'center', padding: '5px 8px', fontSize: 13,
            fontFamily: 'ui-monospace, monospace',
          }}
        />
        <span style={{ fontSize: 11, color: THEME_MUTED }}>
          e.g. <code style={{ background: '#fff', padding: '1px 5px', borderRadius: 4 }}>-</code>
          &nbsp;means tags look like <code style={{ background: '#fff', padding: '1px 5px', borderRadius: 4 }}>06"-P-1001-11111-C</code>
        </span>
      </div>

      {model.fields.length === 0 && (
        <div style={{ fontSize: 12, color: THEME_MUTED, padding: 10 }}>
          No fields yet — click <b>Add field</b> below.
        </div>
      )}

      {model.fields.map((f, idx) => (
        <div key={idx} style={{
          border: `1px solid ${THEME_BORDER}`, borderRadius: 10, padding: 12,
          background: '#fff', display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          {/* Header row: order controls + title + remove */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <button onClick={() => moveField(idx, -1)} disabled={idx === 0} style={miniBtn()} title="Move up">▲</button>
              <button onClick={() => moveField(idx, 1)} disabled={idx === model.fields.length - 1} style={miniBtn()} title="Move down">▼</button>
            </div>
            <GripVertical size={14} color={THEME_MUTED} />
            <span style={{ fontWeight: 700, fontSize: 12, color: THEME_TEXT, flex: 1 }}>
              Field #{idx + 1}{f.label ? ` — ${f.label}` : ''}
            </span>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: THEME_MUTED, cursor: 'pointer' }}>
              <input type="checkbox" checked={f.optional} onChange={(e) => updateField(idx, { optional: e.target.checked })} />
              Optional
            </label>
            <button onClick={() => removeField(idx)} style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '4px 8px', borderRadius: 6, fontSize: 11,
              border: '1px solid #fecaca', background: '#fef2f2', color: '#b91c1c', cursor: 'pointer',
            }}>
              <Trash2 size={11} /> Remove
            </button>
          </div>

          {/* Row 1: key, label */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <label style={fieldLabel()}>
              Key
              <input
                value={f.key}
                onChange={(e) => updateField(idx, { key: e.target.value })}
                placeholder="e.g. size"
                style={{ ...fieldInput(), fontFamily: 'ui-monospace, monospace', fontSize: 12 }}
              />
            </label>
            <label style={fieldLabel()}>
              Label
              <input
                value={f.label}
                onChange={(e) => updateField(idx, { label: e.target.value })}
                placeholder="e.g. Size (inches)"
                style={fieldInput()}
              />
            </label>
          </div>

          {/* Row 2: regex, suffix */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: 8 }}>
            <label style={fieldLabel()}>
              Regex pattern
              <input
                value={f.regex}
                onChange={(e) => updateField(idx, { regex: e.target.value })}
                placeholder='e.g. \\d{1,3}(?:\\.\\d+)?'
                style={{ ...fieldInput(), fontFamily: 'ui-monospace, monospace', fontSize: 12 }}
              />
            </label>
            <label style={fieldLabel()}>
              Suffix (literal)
              <input
                value={f.suffix}
                onChange={(e) => updateField(idx, { suffix: e.target.value })}
                placeholder='e.g. "'
                style={{ ...fieldInput(), fontFamily: 'ui-monospace, monospace', fontSize: 12 }}
              />
            </label>
          </div>

          {/* Notes */}
          <label style={fieldLabel()}>
            Notes (help text for the AI)
            <textarea
              value={f.notes}
              onChange={(e) => updateField(idx, { notes: e.target.value })}
              placeholder="Short description that will be included in the AI prompt"
              rows={2}
              style={{ ...fieldInput(), resize: 'vertical', fontSize: 12 }}
            />
          </label>

          {/* Lookup table */}
          <label style={fieldLabel()}>
            <span>
              Lookup table <span style={{ color: THEME_MUTED, fontWeight: 400 }}>(optional — one <code>CODE = LABEL</code> per line)</span>
            </span>
            <textarea
              value={lookupToText(f.lookup)}
              onChange={(e) => updateField(idx, { lookup: textToLookup(e.target.value) })}
              placeholder={'AM = AMIN LIQUID\nCH = SRP/DEAERATION/CIP CHEMICAL\nCL = OTHER CHEMICAL'}
              rows={4}
              style={{
                ...fieldInput(),
                fontFamily: 'ui-monospace, monospace', fontSize: 12,
                resize: 'vertical', minHeight: 70,
              }}
            />
          </label>
        </div>
      ))}

      <button onClick={addField} style={{
        alignSelf: 'flex-start',
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '8px 14px', borderRadius: 8, border: `1px dashed ${THEME_PRIMARY}`,
        background: '#faf5ff', color: THEME_PRIMARY, fontWeight: 600, fontSize: 12,
        cursor: 'pointer',
      }}>
        <Plus size={14} /> Add field
      </button>

      <div style={{ fontSize: 11, color: THEME_MUTED }}>
        The form saves back to the same JSON structure. Switch to the <b>JSON</b> tab any time to see or hand-edit the result.
      </div>
    </div>
  )
}

function miniBtn() {
  return {
    width: 20, height: 16, fontSize: 9, padding: 0, lineHeight: 1,
    border: `1px solid ${THEME_BORDER}`, background: '#fff', color: THEME_MUTED,
    borderRadius: 3, cursor: 'pointer',
  }
}
