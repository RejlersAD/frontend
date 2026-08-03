// ═════════════════════════════════════════════════════════════════════
// Legend Sheets — import helpers
// Parses the same JSON / CSV / Excel formats produced by the Canvas
// exporters back into an in-memory legend structure the editor can load.
// ═════════════════════════════════════════════════════════════════════

import * as XLSX from 'xlsx'

export const IMPORT_ACCEPT = '.json,.csv,.xls,.xlsx,application/json,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

const DEFAULT_SEPARATOR = '-'

// Column headers the exporter writes. Import is CASE-INSENSITIVE and also
// accepts a few obvious aliases so users can hand-craft simple sheets.
const HEADER_ALIASES = {
  legend_name:  ['legend_name', 'legend', 'name'],
  order:        ['order', '#', 'sl', 'sl_no', 'index', 'position'],
  key:          ['key', 'field_key', 'field'],
  label:        ['label', 'field_label', 'title'],
  regex:        ['regex', 'pattern', 'regex_pattern'],
  suffix:       ['suffix', 'literal_suffix'],
  optional:     ['optional', 'is_optional'],
  separator:    ['separator', 'sep'],
  notes:        ['notes', 'note', 'description', 'help'],
  lookup:       ['lookup', 'lookup_table', 'codes'],
}

function normaliseKey(h) {
  return String(h ?? '').trim().toLowerCase().replace(/\s+/g, '_')
}

// Map a raw header row → canonical header index map { canonical: colIndex }
function buildHeaderMap(headerRow) {
  const idx = {}
  headerRow.forEach((h, i) => {
    const k = normaliseKey(h)
    Object.entries(HEADER_ALIASES).forEach(([canonical, aliases]) => {
      if (aliases.includes(k) && idx[canonical] === undefined) idx[canonical] = i
    })
  })
  return idx
}

function isTruthy(v) {
  const s = String(v ?? '').trim().toLowerCase()
  return s === 'yes' || s === 'true' || s === '1' || s === 'y'
}

function parseLookupCell(v) {
  const raw = String(v ?? '').trim()
  if (!raw) return null
  const out = {}
  // Support both "A=1 | B=2" (exporter format) and newline-separated
  raw.split(/\||\r?\n|;/).forEach(pair => {
    const s = pair.trim()
    if (!s) return
    const eq = s.indexOf('=')
    if (eq <= 0) return
    const k = s.slice(0, eq).trim()
    const val = s.slice(eq + 1).trim()
    if (k) out[k] = val
  })
  return Object.keys(out).length ? out : null
}

// Build a definition { separator, fields[] } from row objects.
// rows is an array of { canonicalKey: value } keyed by our canonical headers.
function definitionFromRows(rows) {
  if (!rows.length) return null
  const separator = rows.map(r => r.separator).find(v => v) || DEFAULT_SEPARATOR
  // Preserve order if provided, else use array order
  const sorted = rows.slice().sort((a, b) => {
    const ao = Number(a.order); const bo = Number(b.order)
    if (Number.isFinite(ao) && Number.isFinite(bo)) return ao - bo
    return 0
  })
  const fields = sorted
    .filter(r => (r.key || r.regex))  // ignore blank rows
    .map(r => {
      const field = {
        key: String(r.key || '').trim(),
        label: String(r.label || '').trim(),
        regex: String(r.regex || '').trim() || '[A-Z0-9]+',
      }
      if (r.suffix) field.suffix = String(r.suffix)
      if (isTruthy(r.optional)) field.optional = true
      if (r.notes) field.notes = String(r.notes)
      const lookup = parseLookupCell(r.lookup)
      if (lookup) field.lookup = lookup
      return field
    })
  if (!fields.length) return null
  return { separator, fields }
}

// Convert an array-of-arrays sheet into row objects keyed by canonical headers.
function sheetAoaToRows(aoa) {
  if (!aoa || aoa.length < 2) return { rows: [], firstLegendName: '' }
  const headerMap = buildHeaderMap(aoa[0])
  const rows = []
  let firstLegendName = ''
  for (let i = 1; i < aoa.length; i++) {
    const row = aoa[i]
    if (!row || row.every(c => c === undefined || c === null || String(c).trim() === '')) continue
    const obj = {}
    Object.entries(headerMap).forEach(([canonical, col]) => { obj[canonical] = row[col] })
    if (!firstLegendName && obj.legend_name) firstLegendName = String(obj.legend_name).trim()
    rows.push(obj)
  }
  return { rows, firstLegendName }
}

// ── Public API ─────────────────────────────────────────────────────

// Parse a CSV string. Returns { name, description, definition, legends? }
// where `legends` is the extra list when the CSV contains multiple.
export function parseCsvText(text, fallbackName = 'Imported legend') {
  const lines = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/)
  // Minimal CSV parser (handles quoted fields with embedded commas + escaped quotes)
  const parseRow = (line) => {
    const out = []; let cur = ''; let inQ = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (inQ) {
        if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++ }
        else if (ch === '"') inQ = false
        else cur += ch
      } else {
        if (ch === ',') { out.push(cur); cur = '' }
        else if (ch === '"') inQ = true
        else cur += ch
      }
    }
    out.push(cur)
    return out
  }
  const aoa = lines.filter(l => l.length > 0).map(parseRow)
  const { rows, firstLegendName } = sheetAoaToRows(aoa)
  if (!rows.length) {
    // Fallback: treat the CSV as a wide code→description lookup table.
    const inferred = definitionFromWideLookup(aoa)
    if (inferred) return [{ name: inferred.name || fallbackName, description: '', definition: inferred.definition }]
    throw new Error('CSV contains no data rows')
  }
  // Group by legend_name so we can support single OR multi-legend CSVs
  const groups = new Map()
  rows.forEach(r => {
    const name = String(r.legend_name || firstLegendName || fallbackName).trim() || fallbackName
    if (!groups.has(name)) groups.set(name, [])
    groups.get(name).push(r)
  })
  const items = []
  groups.forEach((groupRows, name) => {
    const def = definitionFromRows(groupRows)
    if (def) items.push({ name, description: '', definition: def })
  })
  if (!items.length) throw new Error('CSV had rows but none had a valid key/regex')
  return items
}

// Parse an Excel .xlsx / .xls ArrayBuffer. Returns [{name,description,definition}, ...]
export function parseExcelBuffer(buffer, fallbackName = 'Imported legend') {
  const wb = XLSX.read(buffer, { type: 'array' })
  const items = []
  wb.SheetNames.forEach(name => {
    if (name.toLowerCase() === 'metadata') return
    const sheet = wb.Sheets[name]
    const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false, defval: '' })
    // 1) Try the canonical Fields shape first
    const { rows } = sheetAoaToRows(aoa)
    let def = definitionFromRows(rows)
    // 2) Fallback: infer a lookup-driven legend from a 2-column code→description
    //    table (handles ISA-5.1 instrument-letter sheets, service-code books,
    //    piping spec registries, etc.)
    let inferredName = null
    if (!def) {
      const inferred = definitionFromWideLookup(aoa)
      if (inferred) { def = inferred.definition; inferredName = inferred.name }
    }
    if (def) items.push({
      name: inferredName || name || fallbackName,
      description: '',
      definition: def,
    })
  })
  if (!items.length) throw new Error('Excel workbook has no importable Fields or code-lookup sheet')
  return items
}

// Parse a JSON string. Accepts the exporter's shapes:
//   { section?, name, description?, definition }        — single
//   { section?, legends: [{ name, description?, definition }] } — batch
//   { separator, fields: [...] }                        — raw definition
export function parseJsonText(text, fallbackName = 'Imported legend') {
  const parsed = JSON.parse(text)
  if (parsed && Array.isArray(parsed.legends)) {
    return parsed.legends
      .filter(l => l && l.definition)
      .map(l => ({
        name: l.name || fallbackName,
        description: l.description || '',
        definition: l.definition,
      }))
  }
  if (parsed && parsed.definition) {
    return [{
      name: parsed.name || fallbackName,
      description: parsed.description || '',
      definition: parsed.definition,
    }]
  }
  if (parsed && Array.isArray(parsed.fields)) {
    return [{ name: fallbackName, description: '', definition: parsed }]
  }
  throw new Error('Unrecognised JSON structure')
}

// ─── Wide code→description fallback ──────────────────────────────────
// Soft-coded heuristics for auto-detecting 2-column "code book" sheets
// (e.g. ISA-5.1 instrument letters, service-code books, spec registries)
// so users can import raw domain reference tables without reformatting.
// ---------------------------------------------------------------------
const CODE_CELL_REGEX = /^[A-Z][A-Z0-9]{0,5}$/
const ISA_TITLE_HINTS = ['instrument', 'letter', 'isa', 'iso 5.1', 'iso-5.1', 'iso5.1', 'iso 3511']
// Keywords in header row A/B that suggest a code→variable table
const CODE_HEADER_HINTS = ['letter', 'code', 'symbol', 'first', 'prefix']
const DESC_HEADER_HINTS = ['variable', 'meaning', 'description', 'service', 'name', 'type']

function cellText(v) { return String(v ?? '').replace(/\s+/g, ' ').trim() }

function looksLikeCode(v) {
  const s = cellText(v).toUpperCase()
  return CODE_CELL_REGEX.test(s)
}

function findCodeDescColumns(aoa) {
  // Scan the first ~5 rows for a header row where col N looks like a code
  // header and col N+1 looks like a description header.
  for (let r = 0; r < Math.min(aoa.length, 5); r++) {
    const row = aoa[r] || []
    for (let c = 0; c < row.length - 1; c++) {
      const a = cellText(row[c]).toLowerCase()
      const b = cellText(row[c + 1]).toLowerCase()
      const aHit = CODE_HEADER_HINTS.some(k => a.includes(k))
      const bHit = DESC_HEADER_HINTS.some(k => b.includes(k))
      if (aHit && bHit) return { codeCol: c, descCol: c + 1, headerRow: r }
    }
  }
  // Fallback: pick the first two columns and start scanning from row 0.
  return { codeCol: 0, descCol: 1, headerRow: -1 }
}

function looksLikeIsaSheet(aoa) {
  const first10 = aoa.slice(0, 10).map(r => (r || []).map(cellText).join(' ').toLowerCase()).join(' ')
  return ISA_TITLE_HINTS.some(k => first10.includes(k))
}

function collectExtraFunctionCodes(aoa, codeCol, descCol, headerRow) {
  // Sweep every remaining cell in the body for short-uppercase tokens like
  // "TRC", "PSV", "FQIC" and add them to the lookup as extra codes without
  // labels (better than losing them entirely).
  const out = new Set()
  const startRow = Math.max(headerRow + 1, 0)
  for (let r = startRow; r < aoa.length; r++) {
    const row = aoa[r] || []
    for (let c = 0; c < row.length; c++) {
      if (c === codeCol || c === descCol) continue
      const s = cellText(row[c]).toUpperCase()
      // Cells sometimes contain "PSV, PSE" or "FCV, FICV" — split on non-code chars
      s.split(/[^A-Z0-9]+/).forEach(tok => {
        if (tok && CODE_CELL_REGEX.test(tok)) out.add(tok)
      })
    }
  }
  return out
}

export function definitionFromWideLookup(aoa) {
  if (!aoa || aoa.length < 2) return null
  const { codeCol, descCol, headerRow } = findCodeDescColumns(aoa)
  const codeHeader = cellText(aoa[Math.max(headerRow, 0)]?.[codeCol]) || 'Code'
  const descHeader = cellText(aoa[Math.max(headerRow, 0)]?.[descCol]) || 'Description'
  const lookup = {}
  const startRow = Math.max(headerRow + 1, 0)
  for (let r = startRow; r < aoa.length; r++) {
    const row = aoa[r] || []
    const code = cellText(row[codeCol]).toUpperCase()
    const desc = cellText(row[descCol])
    if (!code || !looksLikeCode(code)) continue
    if (!desc) continue
    // First occurrence wins; ignore duplicates below.
    if (!(code in lookup)) lookup[code] = desc
  }
  const codeCount = Object.keys(lookup).length
  if (codeCount < 2) return null

  const isIsa = looksLikeIsaSheet(aoa)
  if (isIsa) {
    const extras = collectExtraFunctionCodes(aoa, codeCol, descCol, headerRow)
    // Merge extras without overwriting labelled first-letter entries.
    extras.forEach(code => { if (!(code in lookup)) lookup[code] = '' })
  }

  const definition = {
    separator: '-',
    fields: [
      {
        key: 'functionCode',
        label: isIsa ? 'ISA Function Code' : (codeHeader || 'Code'),
        regex: '[A-Z]{1,6}',
        notes: isIsa
          ? 'ISA-5.1 first-letter + modifier + function letters. Extend the lookup as needed.'
          : `Imported from a code/${descHeader.toLowerCase()} lookup table.`,
        lookup,
      },
    ],
  }
  if (isIsa) {
    definition.fields.push({
      key: 'loopNumber',
      label: 'Loop Number',
      regex: '\\d{2,5}',
      notes: 'Numeric instrument loop number.',
    })
  }
  const name = isIsa
    ? `ISA-5.1 Instrument Letters (${codeCount} codes)`
    : `${codeHeader} → ${descHeader} (${codeCount} entries)`
  return { name, definition }
}

// Returns a Promise resolving to an array of { name, description, definition }.
export function parseLegendFile(file, fallbackName = 'Imported legend') {
  const ext = String(file.name || '').toLowerCase().split('.').pop()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Failed to read file'))
    if (ext === 'json') {
      reader.onload = () => {
        try { resolve(parseJsonText(String(reader.result), fallbackName)) }
        catch (err) { reject(err) }
      }
      reader.readAsText(file)
    } else if (ext === 'csv') {
      reader.onload = () => {
        try { resolve(parseCsvText(String(reader.result), fallbackName)) }
        catch (err) { reject(err) }
      }
      reader.readAsText(file)
    } else if (ext === 'xlsx' || ext === 'xls') {
      reader.onload = () => {
        try { resolve(parseExcelBuffer(reader.result, fallbackName)) }
        catch (err) { reject(err) }
      }
      reader.readAsArrayBuffer(file)
    } else {
      reject(new Error(`Unsupported file type ".${ext}". Use JSON, CSV, or Excel.`))
    }
  })
}
