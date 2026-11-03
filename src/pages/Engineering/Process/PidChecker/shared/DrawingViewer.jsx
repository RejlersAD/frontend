/**
 * Drawing viewer (spec §1): image at Fit/200/300%, scrolls inside a 640px
 * box (420px on phone). Markers are rendered ONLY for findings with real
 * coordinates — never invented. Marker = 28px circle with finding number;
 * red Error, amber Query, grey Minor, green Confirmed, light-grey Rejected;
 * selected = 34px blue ring. Every marker is a <button aria-label="Finding Fn">.
 * A finding in two spots = two markers with the same number.
 *
 * Props:
 *  imageUrl      – page image (backend drawing-image renderer)
 *  imageSize     – { width, height } natural page size for marker placement
 *  findings      – [{ id, number, status, locations: [{ x, y }] }] where x/y
 *                  are 0..1 fractions of the page; findings without locations
 *                  get NO marker
 *  selectedId    – currently selected finding id
 *  onSelect      – (findingId) => void
 */
import { useEffect, useMemo, useState } from 'react'
import { fetchDrawingImage } from '../pidChecker.service'

const ZOOMS = [
  { id: 'fit', label: 'Fit' },
  { id: '200', label: '200%' },
  { id: '300', label: '300%' },
]

/**
 * Authenticated drawing image (spec C). A plain <img src> carries no
 * Authorization header → 401. Fetches the blob via the API client and
 * exposes an object URL; revoked on change/unmount. The token never goes
 * in the URL.
 */
export function useDrawingImage(documentId, page = 0) {
  const [state, setState] = useState({ url: null, loading: true, error: null })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (!documentId) return undefined
    let alive = true
    let objUrl = null
    setState({ url: null, loading: true, error: null })
    fetchDrawingImage(documentId, page)
      .then(url => {
        if (!alive) { URL.revokeObjectURL(url); return }
        objUrl = url
        setState({ url, loading: false, error: null })
      })
      .catch(err => {
        if (alive) setState({ url: null, loading: false, error: err?.response?.status ?? 'error' })
      })
    return () => {
      alive = false
      if (objUrl) URL.revokeObjectURL(objUrl)
    }
  }, [documentId, page, attempt])
  return { ...state, retry: () => setAttempt(a => a + 1) }
}

function markerClass(status = '') {
  const s = String(status).toLowerCase()
  if (s.includes('error') || s.includes('not ok') || s.includes('differ')) return 'pc-marker-error'
  if (s.includes('query') || s.includes('open') || s.includes('waiting')) return 'pc-marker-query'
  if (s.includes('minor')) return 'pc-marker-minor'
  if (s.includes('confirm')) return 'pc-marker-confirmed'
  if (s.includes('reject')) return 'pc-marker-rejected'
  return 'pc-marker-minor'
}

export default function DrawingViewer({ imageUrl, imageLoading = false, imageError = null, onImageRetry = null, imageSize = null, findings = [], ring = null, selectedId = null, onSelect, zoom: controlledZoom = null, onZoomChange = null }) {
  const [internalZoom, setInternalZoom] = useState('fit')
  // Optionally controlled by the caller (zoom deep link, spec §5).
  const zoom = controlledZoom ?? internalZoom
  const setZoom = z => {
    if (onZoomChange) onZoomChange(z)
    else setInternalZoom(z)
  }

  const markers = useMemo(() => {
    const out = []
    for (const f of findings) {
      for (const loc of f.locations || []) {
        if (typeof loc?.x === 'number' && typeof loc?.y === 'number') {
          out.push({ finding: f, x: loc.x, y: loc.y })
        }
      }
    }
    return out
  }, [findings])

  const imgStyle = useMemo(() => {
    if (zoom === 'fit') return { width: '100%', height: 'auto' }
    const factor = Number(zoom) / 100
    if (imageSize?.width) return { width: imageSize.width * factor, height: 'auto' }
    return { width: `${factor * 100}%`, height: 'auto' }
  }, [zoom, imageSize])

  return (
    <div className="pc-viewer">
      <div className="pc-viewer-toolbar" role="toolbar" aria-label="Drawing zoom">
        {ZOOMS.map(z => (
          <button
            key={z.id}
            type="button"
            className={`pc-chip${zoom === z.id ? ' pc-chip-active' : ''}`}
            style={{ minHeight: 30 }}
            onClick={() => setZoom(z.id)}
            aria-pressed={zoom === z.id}
          >
            {z.label}
          </button>
        ))}
        <span className="pc-faint" style={{ marginLeft: 'auto', fontSize: 'var(--rd-text-caption)' }}>
          {markers.length > 0 ? `${markers.length} marker${markers.length === 1 ? '' : 's'}` : 'No marked findings'}
        </span>
      </div>
      <div className="pc-viewer-canvas">
        {imageLoading ? (
          <div style={{ padding: '1rem', width: '100%' }}><div className="pc-skeleton" style={{ height: '100%', minHeight: 320 }} /></div>
        ) : imageError ? (
          <p className="pc-empty-text" style={{ padding: '2rem' }}>
            Drawing image could not be loaded ({imageError}).{' '}
            {onImageRetry && (
              <button type="button" className="rd-btn rd-btn-secondary rd-btn-sm" onClick={onImageRetry}>Retry</button>
            )}
          </p>
        ) : imageUrl ? (
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <img src={imageUrl} alt="Drawing page" style={imgStyle} />
            {ring && (
              <span
                className="pc-ring"
                aria-hidden="true"
                style={{ left: `${ring.x0}%`, top: `${ring.y0}%`, width: `${ring.x1 - ring.x0}%`, height: `${ring.y1 - ring.y0}%` }}
              />
            )}
            {markers.map(({ finding, x, y }, i) => (
              <button
                key={`${finding.id}-${i}`}
                type="button"
                className={`pc-marker ${markerClass(finding.status)}${finding.id === selectedId ? ' pc-marker-selected' : ''}`}
                style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
                aria-label={`Finding ${finding.displayId ?? `F${finding.number}`}`}
                onClick={() => onSelect?.(finding.id)}
              >
                {finding.displayId ?? finding.number}
              </button>
            ))}
          </div>
        ) : (
          <p className="pc-empty-text" style={{ padding: '2rem' }}>
            The drawing image is not available yet.
          </p>
        )}
      </div>
    </div>
  )
}
