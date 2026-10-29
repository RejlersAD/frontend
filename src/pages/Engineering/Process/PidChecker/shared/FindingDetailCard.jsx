/**
 * Finding detail card (spec §1): number + title + status pill · optional
 * close-up crop with red ring · Found/Expected/Basis/Checklist ·
 * Confirm finding · Reject — not an error (comment required) · Next.
 * Pair findings show both values side by side plus "Show on PFD / Show on P&ID".
 */
import { useState } from 'react'
import Pill from './Pill'

export default function FindingDetailCard({
  finding,
  cropUrl = null,
  cropRect = null, // { x, y, width, height } in % of the crop image
  isPair = false,
  onConfirm,
  onReject, // (comment) => void — comment required
  onNext,
  onShowDrawing, // ('pfd' | 'pid') => void
}) {
  const [rejecting, setRejecting] = useState(false)
  const [comment, setComment] = useState('')

  if (!finding) return null

  const submitReject = () => {
    if (!comment.trim()) return
    onReject?.(comment.trim())
    setRejecting(false)
    setComment('')
  }

  return (
    <article className="pc-finding-card">
      <div className="pc-finding-head">
        <h3 className="pc-finding-title">F{finding.number} — {finding.title}</h3>
        <Pill label={finding.status || 'Open'} />
      </div>

      {cropUrl && (
        <div className="pc-finding-crop">
          <img src={cropUrl} alt={`Close-up for finding F${finding.number}`} />
          {cropRect && (
            <span
              className="pc-finding-crop-ring"
              style={{
                left: `${cropRect.x}%`, top: `${cropRect.y}%`,
                width: `${cropRect.width}%`, height: `${cropRect.height}%`,
              }}
            />
          )}
        </div>
      )}

      {isPair ? (
        <div className="pc-finding-values">
          <dl className="pc-finding-value">
            <dt>PFD value</dt>
            <dd>{finding.pfdValue ?? '—'}</dd>
          </dl>
          <dl className="pc-finding-value">
            <dt>P&ID value</dt>
            <dd>{finding.pidValue ?? '—'}</dd>
          </dl>
        </div>
      ) : (
        <dl className="pc-kv">
          <dt>Found</dt><dd>{finding.found ?? '—'}</dd>
          <dt>Expected</dt><dd>{finding.expected ?? '—'}</dd>
          <dt>Basis</dt><dd>{finding.basis ?? '—'}</dd>
          <dt>Checklist</dt><dd>{finding.checklist ?? '—'}</dd>
        </dl>
      )}

      {finding.ai && (
        <p className="pc-note pc-note-ai" style={{ margin: 0 }}>
          <span className="pc-ai-mark">AI</span> value suggested by {finding.ai.model ?? 'the AI model'}
          {finding.ai.confidence != null ? ` · confidence ${finding.ai.confidence}` : ''}. Stays a query until confirmed.
        </p>
      )}

      <div className="pc-finding-actions">
        <button type="button" className="rd-btn rd-btn-primary rd-btn-sm" onClick={() => onConfirm?.()}>
          Confirm finding
        </button>
        <button type="button" className="rd-btn rd-btn-secondary rd-btn-sm" onClick={() => setRejecting(v => !v)}>
          Reject — not an error
        </button>
        {isPair && onShowDrawing && (
          <>
            <button type="button" className="rd-btn rd-btn-ghost rd-btn-sm" onClick={() => onShowDrawing('pfd')}>Show on PFD</button>
            <button type="button" className="rd-btn rd-btn-ghost rd-btn-sm" onClick={() => onShowDrawing('pid')}>Show on P&ID</button>
          </>
        )}
        {onNext && (
          <button type="button" className="rd-btn rd-btn-ghost rd-btn-sm" onClick={onNext}>Next</button>
        )}
      </div>

      {rejecting && (
        <div className="pc-field">
          <label className="pc-label" htmlFor={`pc-reject-${finding.id}`}>
            Comment (required to reject)
          </label>
          <textarea
            id={`pc-reject-${finding.id}`}
            className="pc-input"
            style={{ padding: '0.5rem 0.625rem', minHeight: 64 }}
            value={comment}
            onChange={e => setComment(e.target.value)}
          />
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="button" className="rd-btn rd-btn-secondary rd-btn-sm" disabled={!comment.trim()} onClick={submitReject}>
              Reject finding
            </button>
            <button type="button" className="rd-btn rd-btn-ghost rd-btn-sm" onClick={() => setRejecting(false)}>Cancel</button>
          </div>
        </div>
      )}
    </article>
  )
}
