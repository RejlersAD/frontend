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
import { useMemo, useState } from 'react'

const ZOOMS = [
  { id: 'fit', label: 'Fit' },
  { id: '200', label: '200%' },
  { id: '300', label: '300%' },
]

function markerClass(status = '') {
  const s = String(status).toLowerCase()
  if (s.includes('error') || s.includes('not ok') || s.includes('differ')) return 'pc-marker-error'
  if (s.includes('query') || s.includes('open') || s.includes('waiting')) return 'pc-marker-query'
  if (s.includes('minor')) return 'pc-marker-minor'
  if (s.includes('confirm')) return 'pc-marker-confirmed'
  if (s.includes('reject')) return 'pc-marker-rejected'
  return 'pc-marker-minor'
}

export default function DrawingViewer({ imageUrl, imageSize = null, findings = [], selectedId = null, onSelect, zoom: controlledZoom = null, onZoomChange = null }) {
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
        {imageUrl ? (
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <img src={imageUrl} alt="Drawing page" style={imgStyle} />
            {markers.map(({ finding, x, y }, i) => (
              <button
                key={`${finding.id}-${i}`}
                type="button"
                className={`pc-marker ${markerClass(finding.status)}${finding.id === selectedId ? ' pc-marker-selected' : ''}`}
                style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
                aria-label={`Finding ${finding.displayId ?? `F${finding.number}`}`}
                onClick={() => onSelect?.(finding.id)}
              >
                {finding.number}
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
