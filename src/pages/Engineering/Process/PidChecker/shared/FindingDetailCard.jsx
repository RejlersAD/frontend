/**
 * Finding detail card (spec §1): number + title + status pill · optional
 * close-up crop with red ring · Found/Expected/Basis/Checklist ·
 * Confirm finding · Reject — not an error (comment required) · Next.
 * Pair findings show both values side by side plus "Show on PFD / Show on P&ID".
 *
 * Spec §4.2: the close-up area has its own "2D | 3D" switch, independent of
 * the main viewer. 3D shows a small section view of the items near the
 * finding's anchor; findings without a physical anchor keep 2D only.
 */
import { lazy, Suspense, useEffect, useState } from 'react'
import Pill from './Pill'

// three.js is lazy-loaded so the 2D flow never pays for it.
const Scene3DFocus = lazy(() => import('../threeD/Scene3DFocus'))

export default function FindingDetailCard({
  finding,
  cropUrl = null,
  cropRect = null, // { x, y, width, height } in % of the crop image
  isPair = false,
  scene3d = null, // scene JSON from GET documents/<id>/scene3d/ (or null)
  onViewIn3D, // (findingId) => void — switches the main viewer to 3D + focuses
  onConfirm,
  onReject, // (comment) => void — comment required
  onNext,
  onShowDrawing, // ('pfd' | 'pid') => void
}) {
  const [rejecting, setRejecting] = useState(false)
  const [comment, setComment] = useState('')
  const [detailView, setDetailView] = useState('2d')

  // The finding's 3D anchor from the sheet's scene (null = not a physical
  // item — 2D only).
  const sceneFinding = finding && scene3d
    ? (scene3d.findings || []).find(f => f.id === finding.id)
    : null
  const anchor = sceneFinding?.anchor ?? null

  // Reset to the 2D crop whenever a different finding is shown.
  useEffect(() => { setDetailView('2d') }, [finding?.id])

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

      <div className="pc-segbar" style={{ marginBottom: 0 }}>
        <div className="pc-seg" role="group" aria-label="Close-up view mode">
          <button
            type="button"
            className={`pc-seg-btn${detailView === '2d' ? ' pc-seg-btn-active' : ''}`}
            aria-pressed={detailView === '2d'}
            onClick={() => setDetailView('2d')}
          >
            2D
          </button>
          <button
            type="button"
            className={`pc-seg-btn${detailView === '3d' ? ' pc-seg-btn-active' : ''}`}
            aria-pressed={detailView === '3d'}
            disabled={!anchor}
            title={anchor ? 'Section view around this finding' : 'Not a physical item — 2D only'}
            onClick={() => anchor && setDetailView('3d')}
          >
            3D
          </button>
        </div>
      </div>

      {detailView === '3d' && anchor ? (
        <>
          <Suspense fallback={<div className="pc-skeleton" style={{ height: 280 }} />}>
            <Scene3DFocus scene={scene3d} findingId={finding.id} anchor={anchor} />
          </Suspense>
          {onViewIn3D && (
            <div>
              <button
                type="button"
                className="rd-btn rd-btn-secondary rd-btn-sm"
                onClick={() => onViewIn3D(finding.id)}
              >
                Open in main 3D
              </button>
            </div>
          )}
        </>
      ) : cropUrl ? (
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
      ) : null}

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
          <dt>Checklist item</dt><dd>{finding.checklist ?? '—'}</dd>
          <dt>Rule</dt><dd>{finding.ruleId ?? '—'}</dd>
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
