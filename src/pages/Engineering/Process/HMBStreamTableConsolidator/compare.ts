import type { CaseData, ComparisonRow, StreamGoverningColumns } from './index.ts'

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

/* ------------------------------------------------------------------ */
/* Per-stream liquid/gas/water rate maxima across all selected cases   */
/* ------------------------------------------------------------------ */

export type RateKind = 'liquid' | 'gas' | 'water'

export const RATE_KINDS: RateKind[] = ['liquid', 'gas', 'water']

const normalizeRateName = (name: string): string =>
  name
    .replace(/\s*\[(Vapour|Light Liquid|Heavy Liquid)\]$/i, ' $1')
    .toLowerCase()
    .replace(/\s*[\(\[][^\)\]]*[\)\]]/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/**
 * Score how well a property name represents the requested phase rate.
 * 0 = not a rate for that phase; higher = closer to the criterion row:
 *   liquid → "Light Liquid Act Flow" (light liquid family)
 *   water  → "Heavy Liquid Flow" (heavy liquid family)
 *   gas    → "Std Ideal Gas Vol Flow" / "Standard Gas Flow" (standard gas)
 * Lower tiers keep the columns useful when a workbook only carries a more
 * generic flow name for that phase.
 */
function rateMatchScore(kind: RateKind, propertyName: string): number {
  const n = normalizeRateName(propertyName)
  if (!/\b(flow|rate)\b/.test(n)) return 0
  const has = (re: RegExp) => re.test(n)
  if (kind === 'gas') {
    if (has(/\b(gas|vapour|vapor)\b/) && has(/\b(std|standard)\b/)) return 100
    if (has(/\b(gas|vapour|vapor)\b/)) return 60
    return 0
  }
  if (kind === 'water') {
    if (has(/\bheavy\b/) && has(/\b(liquid|liq)\b/))
      return 100 + (has(/\bvol(ume)?\b/) ? 10 : 0)
    if (has(/\bwater\b/)) return 70
    return 0
  }
  // liquid
  if (has(/\blight\b/) && has(/\b(liquid|liq)\b/))
    return 100 + (has(/\b(act|actual)\b/) ? 10 : 0)
  if (has(/\b(liquid|liq)\b/)) return 40
  return 0
}

function bestRateProperty(stream: CaseData['streams'][number], kind: RateKind) {
  let best: { value: number | string | null; unit: string; score: number } | null = null
  for (const p of stream.properties) {
    const score = rateMatchScore(kind, p.name)
    if (score === 0) continue
    if (!best || score > best.score) best = { value: p.value, unit: p.unit, score }
  }
  return best
}

/**
 * Governing-case columns per stream across all selected comparison cases,
 * keyed by display stream name (same keying as comparison rows).
 * For each phase the case with the highest criterion value governs
 * (Light Liquid Act Flow → liquid, Std Ideal Gas Vol Flow → gas,
 * Heavy Liquid Flow → water); that case's entire stream column is copied
 * property-by-property. Only included streams and finite numeric criterion
 * values participate; ties go to the earliest imported case.
 */
export function buildGoverningCaseColumns(
  cases: CaseData[],
): Map<string, StreamGoverningColumns> {
  const displayName = new Map<string, string>() // lower -> first-seen display name
  for (const c of cases) {
    for (const s of c.streams) {
      if (!s.included) continue
      const key = s.name.trim().toLowerCase()
      if (!displayName.has(key)) displayName.set(key, s.name)
    }
  }

  const columns = new Map<string, StreamGoverningColumns>()
  for (const [key, name] of displayName) {
    const entry: StreamGoverningColumns = {
      liquid: { caseName: null, values: {} },
      gas: { caseName: null, values: {} },
      water: { caseName: null, values: {} },
    }
    for (const kind of RATE_KINDS) {
      let maxValue: number | null = null
      let governing: CaseData['streams'][number] | null = null
      let governingCaseName: string | null = null
      for (const c of cases) {
        const stream = c.streams.find(
          (s) => s.included && s.name.trim().toLowerCase() === key,
        )
        if (!stream) continue
        const match = kind === 'water'
          ? bestRateProperty(stream, kind) || bestAqueousRateProperty(stream)
          : bestRateProperty(stream, kind)
        if (!match || typeof match.value !== 'number' || !Number.isFinite(match.value))
          continue
        if (maxValue === null || match.value > maxValue) {
          maxValue = match.value
          governing = stream
          governingCaseName = c.name
        }
      }
      if (!governing) continue
      const values: StreamGoverningColumns['liquid']['values'] = {}
      for (const p of governing.properties) {
        const pk = p.name.trim().toLowerCase()
        const phaseKey = p.phase ? `${pk} [${p.phase.toLowerCase()}]` : pk
        if (!(phaseKey in values)) values[phaseKey] = p.value
      }
      entry[kind] = { caseName: governingCaseName, values }
    }
    columns.set(name, entry)
  }
  return columns
}

function bestAqueousRateProperty(stream: CaseData['streams'][number]) {
  let best: { value: number | string | null; unit: string; score: number } | null = null
  for (const property of stream.properties) {
    if (!/aqueous/i.test(property.phase || '')) continue
    const name = normalizeRateName(property.name)
    let score = 0
    if (name === 'mass flow') score = 100
    else if (name === 'std ideal liq vol flow') score = 90
    else if (name === 'liq vol flow std cond' || name === 'actual volume flow' || name === 'liquid volume flow') score = 80
    if (score && (!best || score > best.score)) best = { value: property.value, unit: property.unit, score }
  }
  return best
}
