/**
 * Pure mapping utility: Instrument Index rows → Instrument Cable Schedule rows.
 *
 * Re-uses the Cable Block Diagram builder (`buildCableBlockRowsFromInstruments`)
 * which already groups instruments into JBs and resolves field-cable + multicore
 * tags / sizes + marshalling cabinet IDs. For every CBD row we emit:
 *
 *   1. A **field-cable** schedule row: FROM instrument tag (FIELD) → TO JB (FIELD).
 *   2. A **multicore** schedule row, once per JB: FROM JB (FIELD) → TO Marshalling
 *      Cabinet (IES). De-duplicated by `multicore_cable_no`.
 *
 * Schema mirrors the ADNOC Instrument Cable Schedule template
 * (DOD-30201-50200-H0-113-13-15-00-001) — see attached CRS sample.
 *
 * Pure / no side effects / no I/O — fully unit-testable. All naming patterns,
 * cable-type codes, voltage and gland sizes live in CABLE_SCHEDULE_DEFAULTS so
 * the page never has to know the underlying mapping rules; tune them here.
 */

import { buildCableBlockRowsFromInstruments } from './instrumentIndexToCableBlockRows'

// ── Soft-coded Cable Schedule column schema (ADNOC template) ────────────────
export const CABLE_SCHEDULE_COLUMNS = [
  { key: 's_no',              label: 'Sr. No.' },
  { key: 'unit_no',           label: 'Unit No.' },
  { key: 'cable_tag_no',      label: 'Cable Tag No.' },
  { key: 'cable_status',      label: 'Cable Status' },
  { key: 'cable_type',        label: 'Cable Type' },
  { key: 'cable_description', label: 'Cable Description' },
  { key: 'cable_size',        label: 'Cable Size' },
  { key: 'cable_code',        label: 'Cable Code' },
  { key: 'signal_volt',       label: 'Signal Volt' },
  { key: 'is_nis',            label: 'IS / NIS' },
  { key: 'fir_flr',           label: 'FIR / FLR' },
  { key: 'from_tag_no',       label: 'From — Item Tag No.' },
  { key: 'from_description',  label: 'From — Item Description' },
  { key: 'from_status',       label: 'From — Item Status' },
  { key: 'from_loc',          label: 'From — Item Loc' },
  { key: 'from_gland_size',   label: 'From — Gland Size' },
  { key: 'to_tag_no',         label: 'To — Item Tag No.' },
  { key: 'to_description',    label: 'To — Item Description' },
  { key: 'to_status',         label: 'To — Item Status' },
  { key: 'to_loc',             label: 'To — Item Loc' },
  { key: 'to_gland_size',     label: 'To — Gland Size' },
  { key: 'length_m',          label: 'Length (m)' },
  { key: 'remarks',           label: 'Remarks' },
  { key: 'rev',               label: 'Rev' },
]

// ── Soft-coded defaults for cable-type codes, voltage, glands & lengths ─────
// All ADNOC-style values. Override here without touching the builder.
export const CABLE_SCHEDULE_DEFAULTS = {
  defaultVoltage:    '24VDC',
  defaultCableStatus:'new',
  defaultFromStatus: 'N-NEW',
  defaultToStatus:   'Existing',
  defaultFromLoc:    'FIELD',
  defaultToLoc:      'FIELD',
  defaultIesLoc:     'IES-15',
  defaultRemarks:    '',
  defaultRev:        '0',

  // Field-cable type code by (signal_type, fir_flr) — soft-coded lookup.
  // Falls back to fieldCableTypeFallback when no key matches.
  fieldCableTypeBySignal: {
    Analog:        'TYPE A10',
    'Digital 24V': 'TYPE B10',
    'Digital PF':  'TYPE B10',
  },
  fieldCableTypeFallback: 'TYPE B10',

  // Multicore type code by (signal_type, is_nis).
  multicoreTypeBySignal: {
    Analog:        'TYPE A11',
    'Digital 24V': 'TYPE B7',
    'Digital PF':  'TYPE B7',
  },
  multicoreTypeFallback: 'TYPE B7',

  // Cable description templates (lookup by cable_type code).
  cableDescriptionByType: {
    'TYPE A10': 'Single Pair, Coll Screen, Arm, Flame retardant (BL)',
    'TYPE A11': 'Multi Pair Ind & Collective Screen, Arm, Ext. Bur / FLR (BL)',
    'TYPE A12': 'Single Triad, Coll Screen, Arm, Flame retardant (BL)',
    'TYPE B5':  'Single Pair, Coll Screen, Arm, Flame retardant (BLK)',
    'TYPE B7':  'Multi Pair, Coll Screen, Arm, Fire resistant (BL)',
    'TYPE B10': 'Single Pair, Coll Screen, Arm, Fire resistant (BL)',
    default:    'Single Pair, Coll Screen, Arm, Flame retardant',
  },

  // Cable code templates (lookup by cable_type code).
  cableCodeByType: {
    'TYPE A10': '01P-D1',
    'TYPE A11': '10P-D1',
    'TYPE A12': '01T-D1',
    'TYPE B5':  '01P-D2',
    'TYPE B7':  '05P-D1',
    'TYPE B10': '01P-D3',
    default:    '01P-D1',
  },

  // FIR/FLR per signal mix — Fire Resistant for ESD/IS, Flame Retardant otherwise.
  firForIS:  'FIR',
  flrForNIS: 'FLR',

  // Default gland size patterns (per cable role).
  fieldGlandSize:     'M20',
  multicoreGlandSize: 'M32',
  multicoreNisGlandSize: 'M25',

  // Length defaults (m) — used when builder can't infer per-instrument run.
  defaultFieldLength:    40,
  defaultMulticoreLength: 375,
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function _pickCableType(map, signalType, fallback) {
  return map[signalType] || map.default || fallback
}

function _firFlr(isNis) {
  return String(isNis || '').toUpperCase() === 'NIS'
    ? CABLE_SCHEDULE_DEFAULTS.flrForNIS
    : CABLE_SCHEDULE_DEFAULTS.firForIS
}

function _description(typeCode) {
  return (
    CABLE_SCHEDULE_DEFAULTS.cableDescriptionByType[typeCode] ||
    CABLE_SCHEDULE_DEFAULTS.cableDescriptionByType.default
  )
}

function _code(typeCode) {
  return (
    CABLE_SCHEDULE_DEFAULTS.cableCodeByType[typeCode] ||
    CABLE_SCHEDULE_DEFAULTS.cableCodeByType.default
  )
}

function _parseUnit(tag, fallback) {
  // Tag "113-PT-3191" → "113". Fallback to caller-supplied unit.
  const m = /^\s*(\d{2,4})[-_]/.exec(String(tag || ''))
  return m ? m[1] : fallback
}

// ── Main builder ────────────────────────────────────────────────────────────
/**
 * @param {Array<object>} instruments     Rows from the Instrument Index extractor.
 * @param {object} [opts]
 * @param {string} [opts.pid_no]
 * @param {string} [opts.rev]
 * @param {string} [opts.unit]            Plant unit prefix (defaults to '15').
 * @param {boolean} [opts.includeIndicators]
 * @returns {Array<object>}  Schedule rows keyed by CABLE_SCHEDULE_COLUMNS[].key.
 */
export function buildCableScheduleRowsFromInstruments(instruments, opts = {}) {
  const cbdRows = buildCableBlockRowsFromInstruments(instruments, opts)
  const D       = CABLE_SCHEDULE_DEFAULTS
  const rev     = opts.rev || D.defaultRev
  const fallbackUnit = (opts.unit || '15').trim()

  const out = []
  const seenMulticore = new Set()
  let sNo = 0

  for (const c of cbdRows) {
    // ── 1) FIELD CABLE: instrument → JB (always one per CBD row) ───────────
    const fieldType = _pickCableType(D.fieldCableTypeBySignal, c.signal_type, D.fieldCableTypeFallback)
    sNo += 1
    out.push({
      s_no:              sNo,
      unit_no:           _parseUnit(c.tag_number, fallbackUnit),
      cable_tag_no:      c.field_cable_no,
      cable_status:      D.defaultCableStatus,
      cable_type:        fieldType,
      cable_description: _description(fieldType),
      cable_size:        c.field_cable_size,
      cable_code:        _code(fieldType),
      signal_volt:       D.defaultVoltage,
      is_nis:            c.is_nis,
      fir_flr:           _firFlr(c.is_nis),
      from_tag_no:       c.tag_number,
      from_description:  c.service_description,
      from_status:       D.defaultFromStatus,
      from_loc:          D.defaultFromLoc,
      from_gland_size:   D.fieldGlandSize,
      to_tag_no:         c.jb_no,
      to_description:    `${c.signal_type || ''} JB`.trim(),
      to_status:         D.defaultToStatus,
      to_loc:            D.defaultToLoc,
      to_gland_size:     D.fieldGlandSize,
      length_m:          D.defaultFieldLength,
      remarks:           '',
      rev,
    })
  }

  // ── 2) MULTICORE CABLES: one per unique multicore tag (JB → MARS cabinet) ─
  for (const c of cbdRows) {
    if (!c.multicore_cable_no || seenMulticore.has(c.multicore_cable_no)) continue
    seenMulticore.add(c.multicore_cable_no)

    const mcType = _pickCableType(D.multicoreTypeBySignal, c.signal_type, D.multicoreTypeFallback)
    const isNis  = String(c.is_nis || '').toUpperCase() === 'NIS'
    sNo += 1
    out.push({
      s_no:              sNo,
      unit_no:           _parseUnit(c.tag_number, fallbackUnit),
      cable_tag_no:      c.multicore_cable_no,
      cable_status:      D.defaultCableStatus,
      cable_type:        mcType,
      cable_description: _description(mcType),
      cable_size:        c.multicore_size,
      cable_code:        _code(mcType),
      signal_volt:       D.defaultVoltage,
      is_nis:            c.is_nis,
      fir_flr:           _firFlr(c.is_nis),
      from_tag_no:       c.jb_no,
      from_description:  `${c.signal_type || ''} JB`.trim(),
      from_status:       D.defaultFromStatus,
      from_loc:          D.defaultFromLoc,
      from_gland_size:   isNis ? D.multicoreNisGlandSize : D.multicoreGlandSize,
      to_tag_no:         c.marsh_cab_no,
      to_description:    `${c.system || 'DCS'} Marshalling Cabinet`,
      to_status:         D.defaultToStatus,
      to_loc:            D.defaultIesLoc,
      to_gland_size:     isNis ? D.multicoreNisGlandSize : D.multicoreGlandSize,
      length_m:          D.defaultMulticoreLength,
      remarks:           '',
      rev,
    })
  }

  return out
}
