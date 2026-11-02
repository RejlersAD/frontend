/**
 * ScopeSwitch — "This P&ID · {drawing_no} | All P&IDs · {n}" (spec B2).
 *
 * Segmented control, 36 px, active segment in primary blue. The scope
 * lives in the URL (?scope=one|all) and in user preferences
 * (localStorage). "All P&IDs" opens the combined review page; "This P&ID"
 * returns to the last opened sheet.
 */
import { useNavigate, useSearchParams } from 'react-router-dom'

const PREF_KEY = 'pidchk:scope'
const lastSheetKey = projectId => `pidchk:last-sheet:${projectId}`

export function rememberLastSheet(projectId, drawingId, sheet) {
  try { localStorage.setItem(lastSheetKey(projectId), JSON.stringify({ drawingId, sheet })) } catch { /* blocked */ }
}

export function readLastSheet(projectId) {
  try { return JSON.parse(localStorage.getItem(lastSheetKey(projectId)) || 'null') } catch { return null }
}

export function readScopePref() {
  try { return localStorage.getItem(PREF_KEY) === 'all' ? 'all' : 'one' } catch { return 'one' }
}

export default function ScopeSwitch({ projectId, drawingNo = null, sheetCount = null, active = null }) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  // A3: the drawing page is always "This P&ID", /review always "All P&IDs";
  // elsewhere fall back to the URL, then the saved preference.
  const scope = active ?? (searchParams.get('scope') === 'all' ? 'all' : (searchParams.get('scope') === 'one' ? 'one' : readScopePref()))
  const base = `/engineering/process/pid-verification/projects/${projectId}`

  const choose = next => {
    try { localStorage.setItem(PREF_KEY, next) } catch { /* blocked */ }
    if (next === 'all') {
      navigate(`${base}/review?scope=all`)
      return
    }
    const last = readLastSheet(projectId)
    if (last?.drawingId) {
      navigate(`${base}/drawings/${last.drawingId}?sheet=${last.sheet ?? 1}&scope=one`)
    } else {
      navigate(`${base}?scope=one`)
    }
  }

  return (
    <div className="pc-seg" role="group" aria-label="Review scope" style={{ height: 36 }}>
      <button
        type="button"
        className={`pc-seg-btn${scope === 'one' ? ' pc-seg-btn-active' : ''}`}
        style={{ minHeight: 36 }}
        aria-pressed={scope === 'one'}
        onClick={() => choose('one')}
      >
        This P&ID{drawingNo ? ` · ${drawingNo}` : ''}
      </button>
      <button
        type="button"
        className={`pc-seg-btn${scope === 'all' ? ' pc-seg-btn-active' : ''}`}
        style={{ minHeight: 36 }}
        aria-pressed={scope === 'all'}
        onClick={() => choose('all')}
      >
        All P&amp;IDs{sheetCount != null ? ` · ${sheetCount}` : ''}
      </button>
    </div>
  )
}
