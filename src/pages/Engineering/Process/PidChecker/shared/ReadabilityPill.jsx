/**
 * Readability pill (spec §1): Vector green · OCR amber · OCR — not readable red.
 */
import Pill from './Pill'

const LABELS = {
  vector: { label: 'Vector', tone: 'success' },
  ocr: { label: 'OCR', tone: 'warning' },
  unreadable: { label: 'OCR — not readable', tone: 'danger' },
}

export default function ReadabilityPill({ readability }) {
  const entry = LABELS[String(readability || '').toLowerCase()]
  if (!entry) return <Pill label="—" tone="neutral" title="Readability not determined yet" />
  return <Pill label={entry.label} tone={entry.tone} />
}
