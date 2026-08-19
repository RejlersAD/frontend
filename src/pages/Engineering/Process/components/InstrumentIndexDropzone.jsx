import React, { useRef, useState } from 'react'
import { toast } from 'react-toastify'
import { Gauge, Upload, Loader2, CheckCircle2 } from 'lucide-react'

import { uploadInstrumentIndex } from '../../../../services/pidCheckerV2API'

// ─── Soft-coded theme (matches parent) ─────────────────────────────
const THEME_PRIMARY = '#7c3aed'
const THEME_ACCENT  = '#ec4899'
const THEME_TEXT    = '#0f172a'
const THEME_MUTED   = '#64748b'
const THEME_BORDER  = '#e2e8f0'
const THEME_BG_SOFT = '#f8fafc'
const THEME_GRADIENT = `linear-gradient(135deg, ${THEME_PRIMARY} 0%, ${THEME_ACCENT} 100%)`

// Amber accent to distinguish from Line List (green) and Equipment List (blue)
const ACTIVE_BG      = '#fef3c7'
const ACTIVE_BORDER  = '#fde68a'
const ACTIVE_TEXT    = '#92400e'
const ACTIVE_BADGE   = '#fef3c7'
const ACTIVE_ICON    = '#b45309'

const ACCEPTED = '.xlsx,.xlsm'
const MAX_MB = 15

/**
 * Compact Excel Instrument Index picker — auto-uploads and calls back.
 *
 * Props:
 *   activeInstrumentIndex — currently-active II summary (or null)
 *   onUploaded(data)      — called with the API response when parse succeeds
 *   disabled              — parent-controlled (e.g. during PDF extraction)
 */
export default function InstrumentIndexDropzone({ activeInstrumentIndex, onUploaded, disabled }) {
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
      const data = await uploadInstrumentIndex(f, { onProgress: setPct })
      toast.success(`Uploaded — ${data.total_rows} instrument tags parsed`)
      onUploaded?.(data)
    } catch (err) {
      toast.error(err?.response?.data?.error || err.message || 'Upload failed')
    } finally {
      setUploading(false); setPct(0)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const isActive = Boolean(activeInstrumentIndex)

  return (
    <div style={{
      padding: 14, borderRadius: 10,
      border: `1px dashed ${isActive ? ACTIVE_BORDER : THEME_BORDER}`,
      background: isActive ? ACTIVE_BG : THEME_BG_SOFT,
      display: 'flex', flexDirection: 'column', gap: 10,
      minHeight: 128,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 6,
          background: THEME_GRADIENT, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Gauge size={14} color="#fff" />
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, color: THEME_TEXT }}>
          Master Instrument Index (Excel)
        </div>
        {isActive && (
          <span style={{
            marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '2px 8px', borderRadius: 999, fontSize: 11,
            background: ACTIVE_BADGE, color: ACTIVE_TEXT, border: `1px solid ${ACTIVE_BORDER}`,
          }}>
            <CheckCircle2 size={11} /> {activeInstrumentIndex.total_rows} tags
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
          ? <>Active: <b style={{ color: THEME_TEXT }}>{activeInstrumentIndex.title || activeInstrumentIndex.filename}</b></>
          : <>Optional — enables cross-check between P&amp;ID instrument tags and the master Instrument &amp; F&amp;G Index.</>}
      </div>
      {/* export accent colors for downstream status rows via a data-attr sniff */}
      <span data-accent-icon={ACTIVE_ICON} style={{ display: 'none' }} />
    </div>
  )
}
