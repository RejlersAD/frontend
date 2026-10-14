import type { CaseData, ComparisonRow } from './index.ts'

/**
 * Build the cross-case comparison matrix.
 * Streams are matched across cases by (case-insensitive) name; properties are
 * the ordered union of property names per stream (first-seen order wins).
 */
export function buildComparison(cases: CaseData[]): {
  streamNames: string[]
  rows: ComparisonRow[]
} {
  const streamOrder: string[] = []
  const streamKey = new Map<string, string>() // lower -> display name
  // per-case stream lookup by lowercase name
  const caseLookup = cases.map((c) => {
    const m = new Map<string, (typeof c.streams)[number]>()
    for (const s of c.streams) {
      if (!s.included) continue
      const key = s.name.trim().toLowerCase()
      if (!m.has(key)) m.set(key, s)
    }
    return m
  })

  for (const c of cases) {
    for (const s of c.streams) {
      if (!s.included) continue
      const key = s.name.trim().toLowerCase()
      if (!streamKey.has(key)) {
        streamKey.set(key, s.name)
        streamOrder.push(s.name)
      }
    }
  }

  const rows: ComparisonRow[] = []
  for (const displayName of streamOrder) {
    const key = displayName.trim().toLowerCase()
    const propOrder: string[] = []
    const propSeen = new Set<string>()
    const propUnit = new Map<string, string>()
    const perCase = new Map<string, Map<string, { value: number | string | null; edited: boolean }>>()

    for (let ci = 0; ci < cases.length; ci++) {
      const c = cases[ci]
      const stream = caseLookup[ci].get(key)
      const map = new Map<string, { value: number | string | null; edited: boolean }>()
      if (stream) {
        for (const p of stream.properties) {
          const pk = p.name.trim().toLowerCase()
          if (!propSeen.has(pk)) {
            propSeen.add(pk)
            propOrder.push(p.name)
          }
          if (p.unit && !propUnit.get(pk)) propUnit.set(pk, p.unit)
          map.set(pk, { value: p.value, edited: p.edited })
        }
      }
      perCase.set(c.id, map)
    }

    for (const propName of propOrder) {
      const pk = propName.trim().toLowerCase()
      const values: ComparisonRow['values'] = {}
      const editedFlags: ComparisonRow['editedFlags'] = {}
      for (const c of cases) {
        const cell = perCase.get(c.id)?.get(pk)
        values[c.id] = cell ? cell.value : null
        editedFlags[c.id] = cell ? cell.edited : false
      }
      rows.push({
        streamName: displayName,
        propertyName: propName,
        unit: propUnit.get(pk) ?? '',
        values,
        editedFlags,
      })
    }
  }

  return { streamNames: streamOrder, rows }
}

/** True when included cases disagree on a numeric value (beyond rounding noise) */
export function rowVaries(row: ComparisonRow, caseIds: string[]): boolean {
  const nums = caseIds
    .map((id) => row.values[id])
    .filter((v): v is number => typeof v === 'number')
  if (nums.length < 2) return false
  const min = Math.min(...nums)
  const max = Math.max(...nums)
  const scale = Math.max(Math.abs(min), Math.abs(max), 1e-12)
  return (max - min) / scale > 1e-9
}

export function formatValue(v: number | string | null): string {
  if (v === null || v === '') return '—'
  if (typeof v === 'string') return v
  if (!Number.isFinite(v)) return String(v)
  const abs = Math.abs(v)
  if (abs !== 0 && (abs >= 1e6 || abs < 1e-3)) return v.toExponential(3)
  return v.toLocaleString('en-US', { maximumFractionDigits: 4 })
}
