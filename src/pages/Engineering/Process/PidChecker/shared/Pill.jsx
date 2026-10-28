/**
 * Status pill (spec §1). Status is never conveyed by colour alone —
 * the label text is always rendered.
 *
 * Tone map:
 *  OK / Agrees / Confirmed                         → green
 *  Error / Differs / Not OK                        → red
 *  Query / Open / Waiting                          → amber
 *  N/A / Not checked / Minor / Rejected            → grey
 *  Info / Automatic / PFD                          → blue
 *  AI / Personal (BYOK)                            → violet (AI marks only)
 */
const TONE_MAP = [
  { tone: 'success', match: ['ok', 'agrees', 'confirmed', 'in check', 'signed', 'configured', 'ready', 'active', 'matches drawing', 'matched', 'found', 'pass', 'passed', 'vector'] },
  { tone: 'danger', match: ['error', 'differs', 'not ok', 'blocked', 'missing', 'conflict', 'failed', 'unreadable', 'ocr — not readable', 'not readable'] },
  { tone: 'warning', match: ['query', 'open', 'waiting', 'hold', 'ocr', 'review', 'engineer review', 'confirm columns', 'not configured', 'not set', 'template', 'draft'] },
  { tone: 'info', match: ['info', 'automatic', 'pfd', 'reference'] },
  { tone: 'ai', match: ['ai', 'personal', 'byok'] },
  { tone: 'neutral', match: ['n/a', 'not checked', 'minor', 'rejected', 'none', 'off'] },
]

export function pillTone(label = '') {
  const text = String(label).toLowerCase()
  for (const entry of TONE_MAP) {
    if (entry.match.some(m => text === m || text.startsWith(`${m} `) || text.startsWith(`${m} —`) || text.startsWith(`${m} (`))) {
      return entry.tone
    }
  }
  return 'neutral'
}

export default function Pill({ label, tone = null, title = null }) {
  const resolved = tone || pillTone(label)
  return (
    <span className={`pc-pill pc-pill-${resolved}`} title={title || undefined}>
      {label}
    </span>
  )
}
