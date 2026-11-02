import * as XLSX from 'xlsx'
import type { CaseData, Stream, StreamProperty } from './index.ts'

/** Property labels commonly found in Heat & Material Balance stream tables */
const PROPERTY_KEYWORDS = [
  'vapour fraction', 'vapor fraction', 'vapour phase fraction', 'vapor phase fraction',
  'liquid fraction', 'solid fraction', 'phase fraction',
  'temperature', 'pressure', 'molar flow', 'mass flow', 'volume flow',
  'liquid volume flow', 'std liquid volume flow', 'std ideal liq vol flow', 'heat flow',
  'enthalpy', 'entropy', 'molecular weight', 'mol weight', 'density', 'mass density',
  'molar density', 'viscosity', 'thermal conductivity', 'surface tension',
  'cp', 'cv', 'cp/cv', 'compressibility', 'z factor', 'phase',
  'mole fraction', 'mass fraction', 'activity', 'fugacity', 'stream',
]

const STREAM_HEADER_ALIASES = [
  'stream name', 'stream', 'streams', 'stream id', 'stream tag', 'material streams',
]
const CLASSIC_HEADER_ALIASES = ['property', 'properties', 'parameter', 'variable']

const norm = (v: unknown): string =>
  String(v ?? '').trim().toLowerCase().replace(/\s+/g, ' ')

/** Normalize a header/label for property-keyword matching: drop qualifier + parens + trailing colon */
const propNorm = (v: unknown): string =>
  norm(v)
    .split('|')[0]
    .replace(/\s*[\(\[][^\)\]]*[\)\]]/g, '')
    .replace(/[/]/g, ' ')
    .replace(/[:：.]\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim()

const isPropertyLabel = (v: unknown): boolean => {
  const s = propNorm(v)
  if (!s) return false
  return PROPERTY_KEYWORDS.some((k) => s === k || s.startsWith(k + ' ') || s.endsWith(' ' + k))
}

const stripParens = (v: string): string => {
  const m = v.trim().match(/^[\(\[]?([^\)\]]*?)[\)\]]?$/)
  return (m ? m[1] : v).trim()
}

/** "Molar Flow (lbmole-hr)" → { quantity: 'Molar Flow', unit: 'lbmole/hr' } */
function parseSheetName(name: string): { quantity: string; unit: string } {
  const m = name.match(/^(.+?)\s*[\(\[](.+?)[\)\]]\s*$/)
  if (m) {
    const unit = m[2].trim().replace(/([a-z])-hr\b/i, '$1/hr')
    return { quantity: m[1].trim(), unit }
  }
  return { quantity: name.trim(), unit: '' }
}

/** Split a property label into name + inline unit, e.g. "Temperature: (F)" → Temperature / F */
const splitUnit = (label: string): { name: string; unit: string } => {
  const m = label.match(/^(.*?)\s*[\(\[]+([^\)\]]+)[\)\]]+\s*$/)
  if (m && looksLikeUnit(m[2])) {
    return { name: m[1].trim().replace(/[:：]\s*$/, ''), unit: m[2].trim() }
  }
  return { name: label.trim().replace(/[:：]\s*$/, ''), unit: '' }
}

/** Parse numeric strings ("1,234.5", "-13.72") into numbers; pass through other values */
function coerceValue(raw: unknown): number | string | null {
  if (raw === null || raw === undefined) return null
  if (typeof raw === 'number') return raw
  const s = String(raw).trim()
  if (!s) return null
  if (/^-?[\d,]+(\.\d+)?([eE][+-]?\d+)?$/.test(s)) {
    const n = Number(s.replace(/,/g, ''))
    if (Number.isFinite(n)) return n
  }
  return s
}

type Grid = (string | number | null)[][]

function sheetToGrid(ws: XLSX.WorkSheet): Grid {
  const aoa = XLSX.utils.sheet_to_json<(string | number | null)[]>(ws, {
    header: 1,
    raw: true,
    defval: null,
    blankrows: true,
  }) as Grid
  let maxCol = 0
  for (const row of aoa) {
    for (let c = row.length - 1; c >= 0; c--) {
      if (row[c] !== null && String(row[c]).trim() !== '') {
        maxCol = Math.max(maxCol, c + 1)
        break
      }
    }
  }
  return aoa.map((row) => row.slice(0, maxCol))
}

interface Anchor {
  row: number
  col: number
  kind: 'stream' | 'classic'
}

function findAnchor(grid: Grid): Anchor | null {
  const rows = Math.min(grid.length, 30)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < Math.min(grid[r]?.length ?? 0, 10); c++) {
      const v = norm(grid[r][c])
      if (STREAM_HEADER_ALIASES.includes(v)) return { row: r, col: c, kind: 'stream' }
      if (CLASSIC_HEADER_ALIASES.includes(v)) return { row: r, col: c, kind: 'classic' }
    }
  }
  return null
}

function looksLikeUnit(v: unknown): boolean {
  if (typeof v !== 'string') return false
  const s = v.trim()
  if (!s || s.length > 14) return false
  if (isPropertyLabel(s)) return false
  return /^[A-Za-z0-9µ°%\/\-\.\^³²@]+$/.test(s) && /[a-zA-Z°µ%]/.test(s)
}

/** Is the row under the header a units row, e.g. "(units) | | (F) | (psig)"? */
function isUnitsRow(grid: Grid, row: number, fromCol: number): boolean {
  const r = grid[row]
  if (!r) return false
  const first = norm(r[fromCol - 1] ?? r[0])
  if (['(units)', 'units', '(unit)', 'unit'].includes(first)) return true
  let total = 0
  let paren = 0
  for (let c = fromCol; c < r.length; c++) {
    const v = r[c]
    if (v === null || String(v).trim() === '') continue
    total++
    if (/^\s*[\(\[].+[\)\]]\s*$/.test(String(v))) paren++
  }
  return total >= 2 && paren / total >= 0.5
}

/* ------------------------------------------------------------------ */
/* Transposed mode: streams down rows, properties across columns       */
/* ------------------------------------------------------------------ */

interface TransposedTable {
  sheetName: string
  streams: Stream[]
  headers: string[]
}

function extractTransposed(grid: Grid, anchor: Anchor, sheetName: string): TransposedTable | null {
  const { row: hr, col: sc } = anchor
  const hasUnitsRow = isUnitsRow(grid, hr + 1, sc + 1)
  const dataStart = hr + (hasUnitsRow ? 2 : 1)
  const unitsRow = hasUnitsRow ? grid[hr + 1] : null
  const { quantity: sheetQuantity, unit: sheetUnit } = parseSheetName(sheetName)

  interface Col {
    idx: number
    name: string
    unit: string
    qualifier: string | null
  }
  const cols: Col[] = []
  for (let c = sc + 1; c < (grid[hr]?.length ?? 0); c++) {
    const raw = grid[hr][c]
    if (raw === null || String(raw).trim() === '') continue
    let base = String(raw).trim()
    let qualifier: string | null = null
    const pipe = base.split('|')
    if (pipe.length > 1) {
      qualifier = pipe.slice(1).join('|').trim()
      base = pipe[0].trim()
    }
    let { name, unit } = splitUnit(base)
    if (!unit && unitsRow) {
      const u = unitsRow[c]
      if (typeof u === 'string' && u.trim() && !isPropertyLabel(u)) unit = stripParens(u)
    }
    if (!unit && sheetUnit) {
      unit = sheetUnit
    }
    // component sheets ("Molar Flow (lbmole/hr)" with bare H2S/CO2… headers):
    // prefix the quantity from the sheet name so properties stay distinguishable
    if (!isPropertyLabel(base) && sheetQuantity && !/sheet|stream|condition|propert/i.test(sheetQuantity)) {
      name = `${name} ${sheetQuantity}`.trim()
    }
    cols.push({ idx: c, name, unit, qualifier })
  }
  if (cols.length === 0) return null

  // keep unqualified + Overall columns only (per-phase variants belong to phase sheets)
  const kept = cols.filter(
    (c) => !c.qualifier || c.qualifier.toLowerCase() === 'overall',
  )
  if (kept.length === 0) return null

  const streams: Stream[] = []
  const seen = new Set<string>()
  for (let r = dataStart; r < grid.length; r++) {
    const rawName = grid[r]?.[sc]
    if (rawName === null || String(rawName).trim() === '') continue
    const name = String(rawName).trim()
    if (seen.has(name)) continue // repeated name → long-format phase/component table, bail per-row
    seen.add(name)
    const properties: StreamProperty[] = kept.map((c) => ({
      name: c.name,
      unit: c.unit,
      value: coerceValue(grid[r][c.idx]),
      edited: false,
    }))
    if (properties.some((p) => p.value !== null)) {
      streams.push({ name, included: true, properties })
    }
  }
  if (streams.length === 0) return null

  // drop columns that carry no data at all (section-header columns, empty spacers)
  const keepIdx = kept.map((c, i) => ({ c, i })).filter(({ i }) =>
    streams.some((s) => s.properties[i].value !== null),
  )
  if (keepIdx.length === 0) return null
  for (const s of streams) {
    s.properties = keepIdx.map(({ i }) => s.properties[i])
  }
  return { sheetName, streams, headers: keepIdx.map(({ c }) => c.name) }
}

/** A transposed sheet is mergeable only if it is a genuine stream summary (not long-format phase/component data) */
function isMergeable(t: TransposedTable): boolean {
  const headerNorms = t.headers.map((h) => norm(h))
  if (headerNorms.includes('phase') || headerNorms.includes('component')) return false
  if (t.streams.length > 2000) return false
  return true
}

function mergeTransposed(tables: TransposedTable[]): Stream[] {
  const byName = new Map<string, Stream>()
  const order: string[] = []
  for (const t of tables) {
    for (const s of t.streams) {
      let target = byName.get(s.name)
      if (!target) {
        target = { name: s.name, included: true, properties: [] }
        byName.set(s.name, target)
        order.push(s.name)
      }
      for (const p of s.properties) {
        if (!target.properties.some((q) => q.name === p.name)) {
          target.properties.push(p)
        }
      }
    }
  }
  return order.map((n) => byName.get(n)!)
}

/* ------------------------------------------------------------------ */
/* Classic mode: properties down rows, streams across columns          */
/* ------------------------------------------------------------------ */

function findHeuristicAnchor(grid: Grid): { headerRow: number; labelCol: number } | null {
  let best: { col: number; firstRow: number; score: number } | null = null
  const populatedRows = grid.filter((row) => row.length > 0)
  const maxCols = populatedRows.length ? Math.min(6, Math.max(...populatedRows.map((row) => row.length))) : 0
  for (let c = 0; c < maxCols; c++) {
    let score = 0
    let firstRow = -1
    for (let r = 0; r < grid.length; r++) {
      const v = grid[r][c]
      if (typeof v === 'string' && isPropertyLabel(v)) {
        score++
        if (firstRow === -1) firstRow = r
      }
    }
    if (score >= 3 && (!best || score > best.score)) best = { col: c, firstRow, score }
  }
  if (!best) return null
  return { headerRow: Math.max(0, best.firstRow - 1), labelCol: best.col }
}

function findMasterTemplateAnchor(grid: Grid): { headerRow: number; labelCol: number } | null {
  for (let row = 0; row < Math.min(grid.length - 1, 12); row++) {
    if (
      norm(grid[row]?.[0]) === 'phase' &&
      norm(grid[row]?.[1]) === 'property' &&
      norm(grid[row + 1]?.[2]).includes('pfd')
    ) return { headerRow: row + 1, labelCol: 1 }
  }
  return null
}

function extractClassic(
  grid: Grid,
  headerRow: number,
  labelCol: number,
  isMasterTemplate = false,
): Stream[] {
  let unitCol: number | null = null
  let streamStart = labelCol + 1
  if (isMasterTemplate) {
    unitCol = labelCol + 1
    streamStart = labelCol + 2
  } else if (norm(grid[headerRow][streamStart]) === 'unit' || norm(grid[headerRow][streamStart]) === 'units') {
    unitCol = streamStart
    streamStart = labelCol + 2
  }

  const streamCols: { col: number; name: string; description?: string; pfdNo?: string }[] = []
  for (let c = streamStart; c < (grid[headerRow]?.length ?? 0); c++) {
    const v = grid[headerRow][c]
    const streamName = isMasterTemplate ? grid[0]?.[c] : v
    if (streamName !== null && streamName !== undefined && String(streamName).trim() !== '') {
      streamCols.push({
        col: c,
        name: String(streamName).trim(),
        ...(isMasterTemplate ? {
          description: String(grid[1]?.[c] ?? '').trim(),
          pfdNo: String(v ?? '').trim(),
        } : {}),
      })
    }
  }
  if (streamCols.length === 0) return []

  const streams: Stream[] = streamCols.map(({ name, description, pfdNo }) => ({
    name,
    ...(description ? { description } : {}),
    ...(pfdNo ? { pfdNo } : {}),
    included: true,
    properties: [],
  }))

  let activeSection = ''
  const sectionCol = isMasterTemplate ? labelCol - 1 : null
  for (let r = headerRow + 1; r < grid.length; r++) {
    const rawLabel = grid[r][labelCol]
    if (typeof rawLabel !== 'string' || !rawLabel.trim()) continue
    if (sectionCol !== null && typeof grid[r][sectionCol] === 'string' && String(grid[r][sectionCol]).trim()) {
      activeSection = String(grid[r][sectionCol]).trim()
    }
    // stop only at a genuine second table header: stream alias + stream names to the right
    if (
      STREAM_HEADER_ALIASES.includes(norm(rawLabel)) &&
      grid[r].slice(labelCol + 1).filter((v) => v !== null && String(v).trim() !== '').length >= 2
    )
      break
    const { name, unit: inlineUnit } = splitUnit(rawLabel)
    const unit = inlineUnit || (unitCol !== null ? String(grid[r][unitCol] ?? '').trim() : '')
    const propertySection = /^\*+/.test(name) ? '__template-divider__' : activeSection

    const values = streamCols.map(({ col }) => coerceValue(grid[r][col]))
    if (values.every((v) => v === null) && !isMasterTemplate) continue // section header row (CONDITIONS, PROPERTIES…)

    values.forEach((value, i) => {
      streams[i].properties.push({ name, unit, ...(propertySection ? { section: propertySection } : {}), value, edited: false })
    })
  }

  return isMasterTemplate ? streams : streams.filter((s) => s.properties.some((p) => p.value !== null))
}

/* ------------------------------------------------------------------ */

export interface ParseResult {
  streams: Stream[]
  sheetName: string
  sheetNames?: string[]
  templateTitle?: string
}

const SHEET_NAME_HINT = /stream|balance|hmb|material|overall|summary|condition|properties/i

/** Core HMB conditions — a sheet holding these is the main stream table, not a composition dump */
const CORE_PROPS = ['temperature', 'pressure', 'molar flow', 'mass flow', 'heat flow', 'enthalpy']

const normalizedKey = (value: unknown): string =>
  String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

function mergeSheetRows(target: Stream[], source: Stream[]): void {
  const byName = new Map(target.map((stream) => [stream.name, stream]))
  for (const sourceStream of source) {
    const stream = byName.get(sourceStream.name)
    if (!stream) continue
    for (const property of sourceStream.properties) {
      const key = `${normalizedKey(property.section)}|${normalizedKey(property.name)}|${normalizedKey(property.unit)}`
      const existing = stream.properties.find((item) =>
        `${normalizedKey(item.section)}|${normalizedKey(item.name)}|${normalizedKey(item.unit)}` === key,
      )
      if (!existing) stream.properties.push(property)
      else if (existing.value === null && property.value !== null) Object.assign(existing, property)
    }
  }
}

function extractLongPhaseRows(grid: Grid): Stream[] | null {
  const headerRow = grid.slice(0, 8).findIndex((row) => norm(row[0]) === 'stream' && norm(row[1]) === 'phase')
  if (headerRow < 0) return null
  const headers = grid[headerRow].map((value) => String(value ?? '').trim())
  const units = grid[headerRow + 1] || []
  const streamCol = headers.findIndex((value) => norm(value) === 'stream')
  const phaseCol = headers.findIndex((value) => norm(value) === 'phase')
  const streams = new Map<string, Stream>()
  for (let rowIndex = headerRow + 2; rowIndex < grid.length; rowIndex++) {
    const row = grid[rowIndex]
    const streamName = String(row[streamCol] ?? '').trim()
    const phase = String(row[phaseCol] ?? '').trim()
    if (!streamName || !phase) continue
    let stream = streams.get(streamName)
    if (!stream) {
      stream = { name: streamName, included: true, properties: [] }
      streams.set(streamName, stream)
    }
    // HYSYS exposes the water-rich phase as Aqueous. The review and
    // comparison templates call this phase Heavy Liquid, but keep the source
    // phase label so downstream consumers can distinguish its provenance.
    const section = phaseSection(phase)
    for (let col = 0; col < headers.length; col++) {
      const name = headers[col]
      if (!name || col === streamCol || col === phaseCol || row[col] === null || row[col] === undefined || row[col] === '') continue
      let propertyName = name === 'Std Ideal Liq Vol Flow' ? 'Standard Ideal Liquid Volume Flow' : name
      let propertyUnit = stripParens(String(units[col] ?? ''))
      let propertyValue = coerceValue(row[col])
      // HYSYS reports vapour actual gas flow in ACFM while the master review
      // layout is expressed in ft3/hr. Convert the value as it is imported so
      // the displayed number and unit stay aligned.
      if (/^act\.?\s*gas\s*flow$/i.test(name) && /^acfm$/i.test(propertyUnit) && typeof propertyValue === 'number') {
        propertyName = 'Actual Volume Flow'
        propertyUnit = 'ft3/hr'
        propertyValue *= 60
      }
      stream.properties.push({
        name: propertyName,
        unit: propertyUnit,
        ...(section ? { section } : {}),
        phase,
        value: propertyValue,
        edited: false,
      })
    }
  }
  return streams.size ? [...streams.values()] : null
}

function phaseSection(phase: string): string {
  if (/vapou?r/i.test(phase)) return 'Vapour'
  if (/aqueous|heavy liquid/i.test(phase)) return 'Heavy Liquid'
  if (/liquid/i.test(phase)) return 'Light Liquid'
  return ''
}

function extractCompositions(grid: Grid): Stream[] | null {
  const headerRow = grid.slice(0, 8).findIndex((row) =>
    norm(row[0]) === 'stream' && norm(row[1]) === 'phase' && row.some((value) => norm(value) === 'component'),
  )
  if (headerRow < 0) return null
  const headers = grid[headerRow].map((value) => String(value ?? '').trim())
  const units = grid[headerRow + 1] || []
  const streamCol = headers.findIndex((value) => norm(value) === 'stream')
  const phaseCol = headers.findIndex((value) => norm(value) === 'phase')
  const componentCol = headers.findIndex((value) => norm(value) === 'component')
  const fractionCol = headers.findIndex((value) => norm(value) === 'mole fraction')
  if (fractionCol < 0) return null
  const streams = new Map<string, Stream>()
  for (let rowIndex = headerRow + 2; rowIndex < grid.length; rowIndex++) {
    const row = grid[rowIndex]
    const streamName = String(row[streamCol] ?? '').trim()
    const phase = String(row[phaseCol] ?? '').trim()
    const component = String(row[componentCol] ?? '').trim()
    if (!streamName || !component || !/overall/i.test(phase)) continue
    let stream = streams.get(streamName)
    if (!stream) {
      stream = { name: streamName, included: true, properties: [] }
      streams.set(streamName, stream)
    }
    stream.properties.push({
      name: component,
      unit: stripParens(String(units[fractionCol] ?? 'mol frac.')) || 'mol frac.',
      section: 'Composition',
      value: coerceValue(row[fractionCol]),
      edited: false,
    })
  }
  return streams.size ? [...streams.values()] : null
}

function coreCount(streams: Stream[]): number {
  const names = new Set<string>()
  for (const s of streams.slice(0, 20)) {
    for (const p of s.properties) names.add(propNorm(p.name))
  }
  return CORE_PROPS.filter((k) => names.has(k)).length
}

function valueCount(streams: Stream[]): number {
  return streams.reduce((n, s) => n + s.properties.filter((p) => p.value !== null).length, 0)
}

function scoreCandidate(streams: Stream[], sheetName: string): number {
  return (
    valueCount(streams) *
    (SHEET_NAME_HINT.test(sheetName) ? 4 : 1) *
    (1 + coreCount(streams))
  )
}

export function parseWorkbook(buffer: ArrayBuffer, fileName: string): ParseResult {
  const wb = XLSX.read(buffer, { type: 'array' })

  const transposedTables: TransposedTable[] = []
  const classicCandidates: { streams: Stream[]; sheetName: string; score: number; templateTitle?: string }[] = []
  const companionSheets: { sheetName: string; streams: Stream[] }[] = []

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName]
    if (!ws) continue
    const grid = sheetToGrid(ws)
    if (grid.length < 3) continue

    if (/^phase properties$/i.test(sheetName)) {
      const streams = extractLongPhaseRows(grid)
      if (streams) companionSheets.push({ sheetName, streams })
      continue
    }
    if (/^compositions?$/i.test(sheetName)) {
      const streams = extractCompositions(grid)
      if (streams) companionSheets.push({ sheetName, streams })
      continue
    }

    const masterAnchor = findMasterTemplateAnchor(grid)
    if (masterAnchor) {
      const streams = extractClassic(grid, masterAnchor.headerRow, masterAnchor.labelCol, true)
      if (valueCount(streams) > 0) classicCandidates.push({
        streams,
        sheetName,
        score: scoreCandidate(streams, sheetName),
        templateTitle: String(grid[0]?.[0] ?? '').trim() || undefined,
      })
      continue
    }

    const anchor = findAnchor(grid)
    if (anchor?.kind === 'stream') {
      // decide orientation: property-like headers to the right → transposed
      const right = grid[anchor.row].slice(anchor.col + 1).filter((v) => v !== null && String(v).trim() !== '')
      const rightPropScore = right.slice(0, 60).filter(isPropertyLabel).length
      const belowPropScore = grid
        .slice(anchor.row + 1, anchor.row + 61)
        .filter((r) => isPropertyLabel(r[anchor.col])).length
      const unitsBelow = isUnitsRow(grid, anchor.row + 1, anchor.col + 1)

      if (right.length >= 1 && (rightPropScore >= 2 || unitsBelow || (belowPropScore === 0 && right.length >= 2))) {
        const t = extractTransposed(grid, anchor, sheetName)
        if (t && isMergeable(t)) transposedTables.push(t)
        continue
      }
    }

    // classic mode
    const classicAnchor =
      anchor && anchor.kind === 'classic'
        ? { headerRow: anchor.row, labelCol: anchor.col }
        : anchor && anchor.kind === 'stream'
          ? { headerRow: anchor.row, labelCol: anchor.col }
          : findHeuristicAnchor(grid)
    if (!classicAnchor) continue
    const streams = extractClassic(grid, classicAnchor.headerRow, classicAnchor.labelCol)
    if (valueCount(streams) === 0) continue
    classicCandidates.push({ streams, sheetName, score: scoreCandidate(streams, sheetName) })
  }

  if (transposedTables.length > 0) {
    const merged = mergeTransposed(transposedTables)
    const mergedName = transposedTables.map((t) => t.sheetName).join(' + ')
    const mergedScore = scoreCandidate(merged, mergedName)
    classicCandidates.push({ streams: merged, sheetName: mergedName, score: mergedScore })
  }

  classicCandidates.sort((a, b) => b.score - a.score)
  const best = classicCandidates[0]
  if (!best) {
    throw new Error(
      `No stream table found in "${fileName}". Expected stream names in a header row or column, with properties such as Temperature, Pressure or flows.`,
    )
  }
  for (const companion of companionSheets) mergeSheetRows(best.streams, companion.streams)
  return {
    streams: best.streams,
    sheetName: best.sheetName,
    sheetNames: [best.sheetName, ...companionSheets.map((sheet) => sheet.sheetName)],
    templateTitle: best.templateTitle,
  }
}

let caseSeq = 0
export const CASE_COLORS = [
  '#0284c7', '#d97706', '#059669', '#dc2626', '#7c3aed', '#db2777', '#0891b2', '#65a30d',
]

export function makeCase(parsed: ParseResult, fileName: string): CaseData {
  const base = fileName.replace(/\.(xlsx|xlsm|xls|csv)$/i, '')
  return {
    id: `case-${Date.now()}-${caseSeq++}`,
    name: base,
    fileName,
    sheetName: parsed.sheetName,
    ...(parsed.templateTitle ? { templateTitle: parsed.templateTitle } : {}),
    streams: parsed.streams,
    color: CASE_COLORS[caseSeq % CASE_COLORS.length],
  }
}
