import React, { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'react-toastify'
import {
  Boxes, Loader2, RefreshCw, Trash2, CheckCircle2, X, Layers,
} from 'lucide-react'

import {
  listEquipmentLists, activateEquipmentList, deleteEquipmentList,
} from '../../../../services/pidCheckerV2API'

// ─── Soft-coded theme ──────────────────────────────────────────────
const THEME_PRIMARY = '#7c3aed'
const THEME_TEXT    = '#0f172a'
const THEME_MUTED   = '#64748b'
const THEME_BORDER  = '#e2e8f0'
const THEME_BG_SOFT = '#f8fafc'

/**
 * Compact history popover for uploaded Equipment Lists.
 * Dropdown-style, click-outside closes.
 *
 * Props:
 *   activeEquipmentList  — currently-active EL (or null)
 *   onChange()           — called after activate / delete / refresh
 */
export default function EquipmentListHistoryPopover({ activeEquipmentList, onChange }) {
  const [open, setOpen] = useState(false)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(false)
  const wrapperRef = useRef(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const rows = await listEquipmentLists()
      setHistory(Array.isArray(rows) ? rows : (rows?.results || []))
    } catch (err) {
      console.warn('[EquipmentListHistoryPopover] refresh failed', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { if (open) refresh() }, [open, refresh])

  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const onActivate = async (id) => {
    try {
      await activateEquipmentList(id)
      await refresh()
      onChange?.()
    } catch (err) {
      toast.error(err?.response?.data?.error || err.message || 'Activate failed')
    }
  }

  const onDelete = async (id) => {
    if (!window.confirm('Delete this uploaded Equipment List?')) return
    try {
      await deleteEquipmentList(id)
      await refresh()
      onChange?.()
    } catch (err) {
      toast.error(err?.response?.data?.error || err.message || 'Delete failed')
    }
  }

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <button
        type="button" onClick={() => setOpen(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 10px', borderRadius: 8,
          border: `1px solid ${THEME_BORDER}`, background: '#fff', color: THEME_TEXT,
          fontSize: 12, cursor: 'pointer',
        }}
      >
        <Layers size={12} /> Manage equipment lists
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: 6,
          width: 380, maxHeight: 380, overflow: 'auto',
          background: '#fff', borderRadius: 10,
          border: `1px solid ${THEME_BORDER}`,
          boxShadow: '0 12px 32px rgba(15,23,42,0.12)',
          zIndex: 50,
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 12px', borderBottom: `1px solid ${THEME_BORDER}`,
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: THEME_TEXT }}>
              Uploaded equipment lists
            </div>
            <span style={{
              padding: '2px 8px', borderRadius: 999, fontSize: 11,
              background: THEME_BG_SOFT, color: THEME_MUTED,
            }}>
              {history.length}
            </span>
            <button
              type="button" onClick={refresh} disabled={loading} title="Refresh"
              style={{
                marginLeft: 'auto', display: 'flex', alignItems: 'center',
                padding: 6, borderRadius: 6,
                border: `1px solid ${THEME_BORDER}`, background: '#fff', color: THEME_TEXT,
                cursor: loading ? 'wait' : 'pointer',
              }}
            >
              {loading
                ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
                : <RefreshCw size={12} />}
            </button>
            <button
              type="button" onClick={() => setOpen(false)} title="Close"
              style={{
                display: 'flex', alignItems: 'center',
                padding: 6, borderRadius: 6,
                border: `1px solid ${THEME_BORDER}`, background: '#fff', color: THEME_MUTED,
                cursor: 'pointer',
              }}
            >
              <X size={12} />
            </button>
          </div>

          <div style={{ padding: 8 }}>
            {history.length === 0 && !loading && (
              <div style={{ padding: 12, textAlign: 'center', color: THEME_MUTED, fontSize: 12 }}>
                No equipment lists uploaded yet.
              </div>
            )}
            <div style={{ display: 'grid', gap: 6 }}>
              {history.map((h) => {
                const active = h.is_active
                const when = h.created_at ? new Date(h.created_at).toLocaleString() : ''
                return (
                  <div key={h.equipment_list_id} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 10px', borderRadius: 8,
                    border: `1px solid ${active ? '#bfdbfe' : THEME_BORDER}`,
                    background: active ? '#eff6ff' : '#fff',
                  }}>
                    <Boxes size={12} color={active ? '#1e40af' : THEME_MUTED} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{
                        fontSize: 12, fontWeight: 500, color: THEME_TEXT,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {h.title || h.filename}
                      </div>
                      <div style={{ fontSize: 10, color: THEME_MUTED, marginTop: 2 }}>
                        {when} · {h.total_rows} items
                      </div>
                    </div>
                    {active
                      ? <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 3,
                          padding: '2px 6px', borderRadius: 999, fontSize: 10,
                          color: '#1e40af', background: '#fff', border: '1px solid #bfdbfe',
                        }}>
                          <CheckCircle2 size={10} /> active
                        </span>
                      : <button
                          type="button" onClick={() => onActivate(h.equipment_list_id)}
                          style={{
                            padding: '4px 8px', borderRadius: 6,
                            border: `1px solid ${THEME_BORDER}`, background: '#fff', color: THEME_PRIMARY,
                            fontSize: 11, fontWeight: 600, cursor: 'pointer',
                          }}
                        >
                          Activate
                        </button>}
                    <button
                      type="button" onClick={() => onDelete(h.equipment_list_id)}
                      title="Delete"
                      style={{
                        display: 'flex', alignItems: 'center',
                        padding: 4, borderRadius: 6,
                        border: `1px solid ${THEME_BORDER}`, background: '#fff', color: '#b91c1c',
                        cursor: 'pointer',
                      }}
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
