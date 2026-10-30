import type { CaseData, CellValue, ComparisonRow, GoverningCaseColumn, StreamGoverningColumns, StreamProperty } from './index.ts'

function propertySection(property: StreamProperty): string {
  const suffix = property.name.match(/\[([^\]]+)\]$/)?.[1]
  const section = (property.section || property.phase || suffix || '').trim()
  if (/vapou?r/i.test(section)) return 'Vapour'
  if (/aqueous|heavy liquid/i.test(section)) return 'Heavy Liquid'
  if (/liquid/i.test(section)) return 'Light Liquid'
  if (/composition/i.test(section)) return 'Composition'
  return property.section || ''
}

function propertyName(name: string): string {
  return name.replace(/\s*\[(Vapou?r|Light Liquid|Heavy Liquid|Aqueous|Composition)\]$/i, '').trim()
}

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
    const propOrder: { key: string; name: string; section: string; unit: string }[] = []
    const propSeen = new Set<string>()
    const perCase = new Map<string, Map<string, { value: number | string | null; edited: boolean }>>()

    for (let ci = 0; ci < cases.length; ci++) {
      const c = cases[ci]
      const stream = caseLookup[ci].get(key)
      const map = new Map<string, { value: number | string | null; edited: boolean }>()
      if (stream) {
        for (const p of stream.properties) {
          const name = propertyName(p.name)
          const section = propertySection(p)
          const pk = JSON.stringify([section, name.toLowerCase(), normalizeUnit(p.unit)])
          if (!propSeen.has(pk)) {
            propSeen.add(pk)
            propOrder.push({ key: pk, name, section, unit: p.unit })
          }
          map.set(pk, { value: p.value, edited: p.edited })
        }
      }
      perCase.set(c.id, map)
    }

    for (const property of propOrder) {
      const pk = property.key
      const values: ComparisonRow['values'] = {}
      const editedFlags: ComparisonRow['editedFlags'] = {}
      for (const c of cases) {
        const cell = perCase.get(c.id)?.get(pk)
        values[c.id] = cell ? cell.value : null
        editedFlags[c.id] = cell ? cell.edited : false
      }
      rows.push({
        streamName: displayName,
        propertyName: property.name,
        section: property.section,
        unit: property.unit,
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

const normalizePropertyKey = (name: string): string =>
  propertyName(name).toLowerCase()

const normalizeUnit = (unit: string): string => unit.toLowerCase().replace(/[()\s]/g, '')

const VOLUME_RATE_FACTORS: Record<string, number> = {
  'ft3/hr': 1, 'ft3/h': 1, 'acfm': 60,
  'barrel/day': 5.614583333333333 / 24, 'bbl/day': 5.614583333333333 / 24,
  'mmscfd': 1e6 / 24, 'mscfd': 1e3 / 24, 'scfd': 1 / 24, 'scfh': 1,
}
const MASS_RATE_FACTORS: Record<string, number> = { 'lb/hr': 1, 'lb/h': 1, 'kg/hr': 2.20462262185, 'kg/h': 2.20462262185 }

function unitsMatchOrConvert(sourceUnit: string, targetUnit: string): boolean {
  const source = normalizeUnit(sourceUnit)
  const target = normalizeUnit(targetUnit)
  if (!source || !target || source === target) return true
  return (source === 'barrel/day' && target === 'ft3/hr')
    || (source === 'ft3/hr' && target === 'barrel/day')
    || (source === 'acfm' && target === 'ft3/hr')
}

function convertComparisonValue(value: StreamProperty['value'], sourceUnit: string, targetUnit: string) {
  if (typeof value !== 'number') return value
  const source = normalizeUnit(sourceUnit)
  const target = normalizeUnit(targetUnit)
  if (source === 'barrel/day' && target === 'ft3/hr') return value * 5.614583333333333 / 24
  if (source === 'ft3/hr' && target === 'barrel/day') return value * 24 / 5.614583333333333
  if (source === 'acfm' && target === 'ft3/hr') return value * 60
  if (source === 'ft3/hr' && target === 'acfm') return value / 60
  return value
}

/** Convert a displayed edit back to the units of the retained source property. */
export function convertTemplateEditValue(raw: string, displayUnit: string, sourceUnit: string): string {
  if (raw.trim() === '') return raw
  const value = Number(raw)
  if (!Number.isFinite(value)) return raw
  return String(convertComparisonValue(value, displayUnit, sourceUnit))
}

function propertyMatchesTemplate(property: StreamProperty, row: { section: string; name: string; unit: string }): boolean {
  const name = normalizePropertyKey(property.name).replace(/[^a-z0-9]+/g, ' ').trim()
  const target = row.name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  const sourceSection = propertySection(property).toLowerCase()
  const targetSection = row.section.toLowerCase()
  if (targetSection === 'composition') {
    if (sourceSection && sourceSection !== 'composition') return false
    const fraction = sourceSection === 'composition' || /frac/i.test(property.unit) || / mole fraction$/.test(name)
    return fraction && name.replace(/ mole fraction$/, '') === target
  }
  if (targetSection) {
    if (sourceSection !== targetSection) return false
  } else if (sourceSection) return false
  if (name === target) return unitsMatchOrConvert(property.unit, row.unit)
  const aliases: Record<string, string[]> = {
    'vapour fraction': ['vapour phase fraction', 'vapor phase fraction'],
    'std gas flow': ['standard gas flow'],
    'standard ideal liquid volume flow': ['std ideal liq vol flow', 'std ideal liquid volume flow'],
    'actual volume flow': ['act liq flow', 'act volume flow', 'act gas flow', 'liquid volume flow'],
    'cp cv gamma': ['cp cv', 'cp cv ent method', 'ideal gas cp cv'],
    'compressibility': ['z factor'],
  }
  if (!(aliases[target] || []).includes(name)) return false
  return unitsMatchOrConvert(property.unit, row.unit) || target === 'vapour fraction'
}

/** Shared by Review and Compare so populated sources use identical matching and units. */
export function resolveTemplateProperty(sourceStream: CaseData['streams'][number] | undefined, row: { section: string; name: string; unit: string }) {
  if (row.section === '__template-divider__') return null
  const candidates = sourceStream?.properties.filter((candidate) => propertyMatchesTemplate(candidate, row)) || []
  const targetUnit = normalizeUnit(row.unit)
  const populated = candidates.filter((candidate) => candidate.value !== null && candidate.value !== '')
  const property = populated.find((candidate) => normalizeUnit(candidate.unit) === targetUnit)
    || populated[0] || candidates.find((candidate) => normalizeUnit(candidate.unit) === targetUnit) || candidates[0]
  return property ? { property, value: convertComparisonValue(property.value, property.unit, row.unit) } : null
}

function rowsForTemplate(stream: string, cases: CaseData[], templateRows: { section: string; name: string; unit: string }[]): ComparisonRow[] {
  return templateRows.map((row) => {
    const values: ComparisonRow['values'] = {}
    const editedFlags: ComparisonRow['editedFlags'] = {}
    let unit = row.unit
    for (const item of cases) {
      const sourceStream = item.streams.find((candidate) => candidate.included && candidate.name.trim().toLowerCase() === stream.trim().toLowerCase())
      const resolved = resolveTemplateProperty(sourceStream, row)
      values[item.id] = resolved?.value ?? null
      editedFlags[item.id] = resolved?.property.edited ?? false
      if (!unit && resolved?.property.unit) unit = resolved.property.unit
    }
    return { streamName: stream, section: row.section, propertyName: row.name, unit, values, editedFlags }
  })
}

export function buildTemplateComparisonRows(cases: CaseData[], templateRows: { section: string; name: string; unit: string }[]): ComparisonRow[] {
  const streams: string[] = []
  const seen = new Set<string>()
  for (const item of cases) for (const stream of item.streams) {
    const key = stream.name.trim().toLowerCase()
    if (stream.included && !seen.has(key)) { seen.add(key); streams.push(stream.name) }
  }
  const rows = streams.flatMap((stream) => rowsForTemplate(stream, cases, templateRows))
  for (const row of rows) if (row.section === '__template-divider__') row.section = 'Composition'
  return rows
}

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
  let best: { value: number; unit: string; score: number; preference: number } | null = null
  const expectedSection = { gas: 'Vapour', liquid: 'Light Liquid', water: 'Heavy Liquid' }[kind]
  for (const p of stream.properties) {
    if (typeof p.value !== 'number' || !Number.isFinite(p.value)) continue
    const section = propertySection(p)
    if (section && section !== expectedSection) continue
    const name = normalizeRateName(propertyName(p.name))
    const actualVolume = /^(actual volume flow|act volume flow|act liq flow|act gas flow|liquid volume flow)$/.test(name)
    const standardLiquid = /^(std ideal liq vol flow|standard ideal liquid volume flow)$/.test(name)
    let score = rateMatchScore(kind, p.name)
    if (section) {
      // A phase's standard gas flow must not compete with Overall or Aqueous
      // standard-gas-equivalent flow. Liquid uses its actual liquid flow;
      // Heavy Liquid/Aqueous uses its mass flow, as in the master layout.
      if (kind === 'gas') score = rateMatchScore(kind, name) === 100 ? 500 : actualVolume ? 300 : name === 'mass flow' ? 200 : 0
      if (kind === 'liquid') score = actualVolume ? 500 : standardLiquid ? 400 : name === 'mass flow' ? 200 : 0
      if (kind === 'water') score = name === 'mass flow' ? 500 : standardLiquid ? 400 : actualVolume ? 300 : 0
    }
    if (score === 0) continue
    const unit = normalizeUnit(p.unit)
    const volumeFactor = VOLUME_RATE_FACTORS[unit]
    const massFactor = MASS_RATE_FACTORS[unit]
    const factor = typeof volumeFactor === 'number' ? volumeFactor : typeof massFactor === 'number' ? massFactor : 1
    const comparisonUnit = typeof volumeFactor === 'number' ? 'ft3/hr' : typeof massFactor === 'number' ? 'lb/hr' : unit
    const value = p.value * factor
    if (!Number.isFinite(value)) continue
    const preference = unit === 'ft3/hr' ? 1 : 0
    if (!best || score > best.score || (score === best.score && preference > best.preference)) {
      best = { value, unit: comparisonUnit, score, preference }
    }
  }
  return best
}

/** Copy the resolved row cell, preserving phase, units, aliases and missingness. */
export function getGoverningCaseValue(row: ComparisonRow, column?: GoverningCaseColumn): CellValue {
  return column?.caseId ? row.values[column.caseId] ?? null : null
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
      liquid: { caseId: null, caseName: null },
      gas: { caseId: null, caseName: null },
      water: { caseId: null, caseName: null },
    }
    for (const kind of RATE_KINDS) {
      let maxValue: number | null = null
      let maxScore = 0
      let comparisonUnit: string | null = null
      let governingCaseId: string | null = null
      let governingCaseName: string | null = null
      for (const c of cases) {
        const stream = c.streams.find(
          (s) => s.included && s.name.trim().toLowerCase() === key,
        )
        if (!stream) continue
        const match = bestRateProperty(stream, kind)
        if (!match || match.score < maxScore) continue
        if (match.score > maxScore) {
          maxScore = match.score
          maxValue = null
          comparisonUnit = match.unit
        }
        // Unknown/incompatible dimensions must never be compared as raw numbers.
        if (match.unit !== comparisonUnit) continue
        if (maxValue === null || match.value > maxValue) {
          maxValue = match.value
          governingCaseId = c.id
          governingCaseName = c.name
        }
      }
      entry[kind] = { caseId: governingCaseId, caseName: governingCaseName }
    }
    columns.set(name, entry)
  }
  return columns
}
