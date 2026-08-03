import React from 'react'
import {
  Upload, FileText, Sparkles, Key, Eye, EyeOff, Loader2, BookOpen, FileSpreadsheet, Zap, Boxes, Gauge,
} from 'lucide-react'

import { MODE_OCR, MODE_VISION, VISION_PROVIDERS } from '../../../../services/pidCheckerV2API'
import LineListDropzone from './LineListDropzone'
import EquipmentListDropzone from './EquipmentListDropzone'
import InstrumentIndexDropzone from './InstrumentIndexDropzone'

// ─── Soft-coded theme (matches parent) ─────────────────────────────
const THEME_PRIMARY = '#7c3aed'
const THEME_ACCENT  = '#ec4899'
const THEME_TEXT    = '#0f172a'
const THEME_MUTED   = '#64748b'
const THEME_BORDER  = '#e2e8f0'
const THEME_BG_SOFT = '#f8fafc'
const THEME_GRADIENT = `linear-gradient(135deg, ${THEME_PRIMARY} 0%, ${THEME_ACCENT} 100%)`

const ACCEPTED_EXTENSIONS = '.pdf'

/**
 * Combined inputs column: PDF dropzone + Excel dropzone + mode + BYOK + Analyse.
 *
 * All state is parent-controlled — this is a pure layout component.
 */
export default function InputsPanel({
  // PDF
  fileInputRef, file, onPickFile,
  // Excel / Line List
  activeLineList, onLineListUploaded,
  // Excel / Equipment List
  activeEquipmentList, onEquipmentListUploaded,
  // Excel / Instrument Index
  activeInstrumentIndex, onInstrumentIndexUploaded,
  // Mode + options
  mode, setMode, forceOcr, setForceOcr,
  // BYOK
  visionProvider, setVisionProvider,
  apiKey, setApiKey, showKey, setShowKey,
  rememberKey, setRememberKey,
  // Analyse action
  onSubmit, loading, uploadPct,
  // Read-only status
  activeLegend, effectiveLegend,
}) {
  const canSubmit = Boolean(file) && !loading
    && (mode !== MODE_VISION || (visionProvider && apiKey))

  return (
    <div style={{
      background: '#fff', border: `1px solid ${THEME_BORDER}`, borderRadius: 12,
      padding: 18, display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      {/* Section title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 30, height: 30, borderRadius: 8,
          background: THEME_GRADIENT, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Zap size={15} color="#fff" />
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: THEME_TEXT }}>Inputs</div>
          <div style={{ fontSize: 11, color: THEME_MUTED }}>
            P&amp;ID PDF (required) &middot; Line List &middot; Equipment List &middot; Instrument Index
          </div>
        </div>
      </div>

      {/* Dual dropzones */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10,
      }}>
        {/* PDF card */}
        <div style={{
          padding: 14, borderRadius: 10,
          border: `1px dashed ${file ? THEME_PRIMARY : THEME_BORDER}`,
          background: file ? '#faf5ff' : THEME_BG_SOFT,
          display: 'flex', flexDirection: 'column', gap: 10,
          minHeight: 128,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 6,
              background: THEME_GRADIENT, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <FileText size={14} color="#fff" />
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: THEME_TEXT }}>
              P&amp;ID Drawing (PDF)
            </div>
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '8px 12px', borderRadius: 8,
              border: `1px solid ${THEME_BORDER}`, background: '#fff', color: THEME_TEXT,
              fontSize: 12, fontWeight: 500,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            <Upload size={12} /> {file ? 'Change PDF' : 'Choose PDF'}
          </button>
          <input
            ref={fileInputRef} type="file" accept={ACCEPTED_EXTENSIONS}
            onChange={onPickFile} style={{ display: 'none' }}
          />
          <div style={{ fontSize: 11, color: THEME_MUTED, lineHeight: 1.4, minHeight: 32 }}>
            {file ? (
              <>
                Selected: <b style={{ color: THEME_TEXT }}>{file.name}</b>
                <br />
                <span style={{ color: THEME_MUTED }}>
                  ({(file.size / 1024 / 1024).toFixed(2)} MB)
                </span>
              </>
            ) : (
              <>Required — extraction runs on this file.</>
            )}
          </div>
        </div>

        {/* Excel card */}
        <LineListDropzone
          activeLineList={activeLineList}
          onUploaded={onLineListUploaded}
          disabled={loading}
        />
      </div>

      {/* Equipment List card (full width) */}
      <EquipmentListDropzone
        activeEquipmentList={activeEquipmentList}
        onUploaded={onEquipmentListUploaded}
        disabled={loading}
      />

      {/* Instrument Index card (full width) */}
      <InstrumentIndexDropzone
        activeInstrumentIndex={activeInstrumentIndex}
        onUploaded={onInstrumentIndexUploaded}
        disabled={loading}
      />

      {/* Mode selector */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: THEME_MUTED, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>
          Extraction mode
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[
            { id: MODE_OCR,    label: 'OCR (offline)',    icon: <FileText size={13} /> },
            { id: MODE_VISION, label: 'AI Vision (BYOK)', icon: <Sparkles size={13} /> },
          ].map((m) => {
            const active = mode === m.id
            return (
              <button
                key={m.id} type="button"
                onClick={() => setMode(m.id)} disabled={loading}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '7px 12px', borderRadius: 8,
                  border: `1px solid ${active ? THEME_PRIMARY : THEME_BORDER}`,
                  background: active ? THEME_PRIMARY : '#fff',
                  color: active ? '#fff' : THEME_TEXT,
                  fontSize: 12, fontWeight: 500,
                  cursor: loading ? 'not-allowed' : 'pointer',
                }}
              >
                {m.icon} {m.label}
              </button>
            )
          })}
        </div>
        {mode === MODE_OCR && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: THEME_MUTED, marginTop: 8 }}>
            <input
              type="checkbox" checked={forceOcr}
              onChange={(e) => setForceOcr(e.target.checked)}
              disabled={loading}
            />
            Force OCR (skip embedded-text fast path)
          </label>
        )}
      </div>

      {/* BYOK — only when Vision */}
      {mode === MODE_VISION && (
        <div style={{
          padding: 12, borderRadius: 10,
          border: `1px dashed ${THEME_PRIMARY}`, background: '#faf5ff',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <Sparkles size={13} color={THEME_PRIMARY} />
            <span style={{ fontWeight: 600, color: THEME_TEXT, fontSize: 12 }}>
              Bring Your Own Key
            </span>
            <span style={{ marginLeft: 'auto', fontSize: 10, color: THEME_MUTED }}>
              per-request only
            </span>
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            <select
              value={visionProvider}
              onChange={(e) => setVisionProvider(e.target.value)}
              disabled={loading}
              style={{
                padding: '8px 10px', borderRadius: 8, fontSize: 12,
                border: `1px solid ${THEME_BORDER}`, background: '#fff', color: THEME_TEXT,
              }}
            >
              {VISION_PROVIDERS.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>

            <div style={{ position: 'relative' }}>
              <Key size={12} style={{
                position: 'absolute', top: '50%', left: 10, transform: 'translateY(-50%)',
                color: THEME_MUTED,
              }} />
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={`${VISION_PROVIDERS.find(p => p.id === visionProvider)?.keyPrefix || ''}...`}
                disabled={loading}
                autoComplete="off"
                style={{
                  width: '100%', padding: '8px 36px 8px 30px',
                  borderRadius: 8, fontSize: 12, boxSizing: 'border-box',
                  border: `1px solid ${THEME_BORDER}`, color: THEME_TEXT,
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                }}
              />
              <button
                type="button" onClick={() => setShowKey(v => !v)}
                style={{
                  position: 'absolute', top: '50%', right: 8, transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: THEME_MUTED,
                  display: 'flex', alignItems: 'center', padding: 4,
                }}
                aria-label={showKey ? 'Hide key' : 'Show key'}
              >
                {showKey ? <EyeOff size={12} /> : <Eye size={12} />}
              </button>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: THEME_MUTED }}>
              <input
                type="checkbox" checked={rememberKey}
                onChange={(e) => setRememberKey(e.target.checked)}
                disabled={loading}
              />
              Remember for this session
            </label>
          </div>
        </div>
      )}

      {/* Analyse button */}
      <button
        type="button"
        onClick={onSubmit}
        disabled={!canSubmit}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          padding: '12px 16px', borderRadius: 10,
          border: 'none', color: '#fff',
          background: canSubmit ? THEME_GRADIENT : '#cbd5e1',
          fontSize: 14, fontWeight: 700,
          cursor: canSubmit ? 'pointer' : 'not-allowed',
          boxShadow: canSubmit ? '0 6px 16px rgba(124,58,237,0.28)' : 'none',
        }}
      >
        {loading
          ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Analysing… {uploadPct}%</>
          : <><Zap size={14} /> Analyse P&amp;ID</>}
      </button>

      {/* Status strip */}
      <div style={{
        display: 'grid', gap: 6, padding: 10, borderRadius: 8,
        background: THEME_BG_SOFT, border: `1px solid ${THEME_BORDER}`,
        fontSize: 11,
      }}>
        <StatusRow
          icon={<FileSpreadsheet size={11} color={activeLineList ? '#047857' : THEME_MUTED} />}
          label="Line List"
          value={activeLineList ? (activeLineList.title || activeLineList.filename) : 'none — cross-check disabled'}
          tone={activeLineList ? 'ok' : 'muted'}
        />
        <StatusRow
          icon={<Boxes size={11} color={activeEquipmentList ? '#1e40af' : THEME_MUTED} />}
          label="Equipment List"
          value={activeEquipmentList ? (activeEquipmentList.title || activeEquipmentList.filename) : 'none — cross-check disabled'}
          tone={activeEquipmentList ? 'ok' : 'muted'}
        />
        <StatusRow
          icon={<Gauge size={11} color={activeInstrumentIndex ? '#b45309' : THEME_MUTED} />}
          label="Instrument Index"
          value={activeInstrumentIndex ? (activeInstrumentIndex.title || activeInstrumentIndex.filename) : 'none — cross-check disabled'}
          tone={activeInstrumentIndex ? 'warn' : 'muted'}
        />
        <StatusRow
          icon={<BookOpen size={11} color={activeLegend ? '#047857' : (effectiveLegend ? '#b45309' : THEME_MUTED)} />}
          label="Legend"
          value={activeLegend?.name || effectiveLegend?.name || 'built-in default'}
          tone={activeLegend ? 'ok' : (effectiveLegend ? 'warn' : 'muted')}
        />
      </div>
    </div>
  )
}

function StatusRow({ icon, label, value, tone }) {
  const colour = tone === 'ok' ? '#047857' : tone === 'warn' ? '#b45309' : THEME_MUTED
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
      {icon}
      <span style={{ color: THEME_MUTED, fontWeight: 600 }}>{label}:</span>
      <span style={{
        color: colour, fontWeight: 500,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0,
      }}>
        {value}
      </span>
    </div>
  )
}
