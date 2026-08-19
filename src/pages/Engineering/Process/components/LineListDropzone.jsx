import React, { useRef, useState } from 'react'
import { toast } from 'react-toastify'
import { FileSpreadsheet, Upload, Loader2, CheckCircle2 } from 'lucide-react'

import { uploadLineList } from '../../../../services/pidCheckerV2API'

// ─── Soft-coded theme (matches parent) ─────────────────────────────
const THEME_PRIMARY = '#7c3aed'
const THEME_ACCENT  = '#ec4899'
const THEME_TEXT    = '#0f172a'
const THEME_MUTED   = '#64748b'
const THEME_BORDER  = '#e2e8f0'
const THEME_BG_SOFT = '#f8fafc'
const THEME_GRADIENT = `linear-gradient(135deg, ${THEME_PRIMARY} 0%, ${THEME_ACCENT} 100%)`
const ACCEPTED = '.xlsx,.xlsm'
const MAX_MB = 15

/**
 * Compact Excel Line List picker — auto-uploads and calls back.
 *
 * Props:
 *   activeLineList     — the currently-active LL summary (or null)
 *   onUploaded(data)   — called with the API response when parse succeeds
 *   disabled           — parent-controlled (e.g. during PDF extraction)
 */
export default function LineListDropzone({ activeLineList, onUploaded, disabled }) {
  const fileRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [pct, setPct] = useState(0)

  const onPick = async (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > MAX_MB * 1024 * 1024) {
      toast.error(`File exceeds ${MAX_MB} MB`)
      if (fileRef.current) fileRef.current.value = ''
      return
    }
    setUploading(true); setPct(0)
    try {
      const data = await uploadLineList(f, { onProgress: setPct })
      toast.success(`Uploaded — ${data.total_rows} line items parsed`)
      onUploaded?.(data)
    } catch (err) {
      toast.error(err?.response?.data?.error || err.message || 'Upload failed')
    } finally {
      setUploading(false); setPct(0)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const isActive = Boolean(activeLineList)

  return (
    <div style={{
      padding: 14, borderRadius: 10,
      border: `1px dashed ${isActive ? '#a7f3d0' : THEME_BORDER}`,
      background: isActive ? '#f0fdf4' : THEME_BG_SOFT,
      display: 'flex', flexDirection: 'column', gap: 10,
      minHeight: 128,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 6,
          background: THEME_GRADIENT, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <FileSpreadsheet size={14} color="#fff" />
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, color: THEME_TEXT }}>
          Master Line List (Excel)
        </div>
        {isActive && (
          <span style={{
            marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '2px 8px', borderRadius: 999, fontSize: 11,
            background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0',
          }}>
            <CheckCircle2 size={11} /> {activeLineList.total_rows} lines
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={disabled || uploading}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          padding: '8px 12px', borderRadius: 8,
          border: `1px solid ${THEME_BORDER}`, background: '#fff', color: THEME_TEXT,
          fontSize: 12, fontWeight: 500,
          cursor: (disabled || uploading) ? 'not-allowed' : 'pointer',
        }}
      >
        {uploading
          ? <><Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> Parsing… {pct}%</>
          : <><Upload size={12} /> {isActive ? 'Replace Excel' : 'Choose Excel (.xlsx)'}</>}
      </button>
      <input
        ref={fileRef} type="file" accept={ACCEPTED}
        onChange={onPick} style={{ display: 'none' }}
      />

      <div style={{ fontSize: 11, color: THEME_MUTED, lineHeight: 1.4, minHeight: 32 }}>
        {isActive
          ? <>Active: <b style={{ color: THEME_TEXT }}>{activeLineList.title || activeLineList.filename}</b></>
          : <>Optional — enables cross-check between P&amp;ID tags and the master line list.</>}
      </div>
    </div>
  )
}
