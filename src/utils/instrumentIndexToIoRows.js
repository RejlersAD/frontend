/**
 * Pure mapping utility: Instrument Index rows → IO List rows.
 *
 * Reads the soft-coded rule tables from
 * `frontend/src/config/instrumentIoListRules.config.js` and produces an array
 * of IO List rows in the canonical column schema. No I/O, no side-effects,
 * fully unit-testable. The IO List page submits the produced rows to the
 * existing backend endpoint via `instrumentToolsService.ioList.generate({ rows })`,
 * so the backend / "core logic" is untouched.
 */

import {
  IO_LIST_COLUMNS,
  IO_LIST_DEFAULTS,
  TAG_FUNCTION_RULES,
  TAG_SUFFIX_SYSTEM_RULES,
  SYSTEM_KEYWORD_RULES,
  IO_TYPE_PREFIX,
  FALLBACK_RULE,
  INDEX_HEADER_ALIASES,
} from '../config/instrumentIoListRules.config.js'

// ── Header normalisation ────────────────────────────────────────────────────
function _norm(s) {
  return String(s || '').trim().toLowerCase().replace(/[._\s]+/g, ' ')
}

// Build a reverse lookup once: lowercase alias → canonical key.
const _ALIAS_LOOKUP = (() => {
  const m = new Map()
  for (const [canonical, aliases] of Object.entries(INDEX_HEADER_ALIASES)) {
    for (const a of aliases) m.set(_norm(a), canonical)
  }
  return m
})()

/**
 * Normalise a free-form row object (any header casing / spacing) to the
 * canonical keys declared in INDEX_HEADER_ALIASES. Unknown keys pass through
 * lowercased & snake-cased so downstream rules can still inspect them.
 */
export function normaliseIndexRow(raw) {
  const out = {}
  if (!raw || typeof raw !== 'object') return out
  for (const [k, v] of Object.entries(raw)) {
    const canonical = _ALIAS_LOOKUP.get(_norm(k))
    if (canonical) {
      out[canonical] = v
    } else {
      const snake = _norm(k).replace(/\s+/g, '_')
      out[snake] = v
    }
  }
  return out
}

// ── Tag parsing ─────────────────────────────────────────────────────────────
// Accepts:
//   "113-PT-3191"      → { area:'113', fn:'PT', num:'3191', suffix:'' }
//   "PT-100"           → { area:'',    fn:'PT', num:'100',  suffix:'' }
//   "113-XHSC-9501A"   → { area:'113', fn:'XHSC', num:'9501', suffix:'A' }
//   "FT_100A"          → tolerated
const TAG_REGEX = /^\s*(?:([A-Za-z0-9]+)[-_])?([A-Za-z]+)[-_]?(\d+)([A-Za-z]*)\s*$/

export function parseTag(tag) {
  const m = TAG_REGEX.exec(String(tag || ''))
  if (!m) return { area: '', fn: '', num: '', suffix: '', raw: String(tag || '') }
  return {
    area:   m[1] || '',
    fn:     (m[2] || '').toUpperCase(),
    num:    m[3] || '',
    suffix: (m[4] || '').toUpperCase(),
    raw:    String(tag || ''),
  }
}

// ── Rule lookups ────────────────────────────────────────────────────────────
function resolveFunctionRule(fn) {
  if (!fn) return FALLBACK_RULE
  for (const r of TAG_FUNCTION_RULES) {
    if (r.match.test(fn)) return r
  }
  return FALLBACK_RULE
}

function resolveSystem(parsed, indexRow) {
  // 1. Tag suffix (A/B convention)
  for (const r of TAG_SUFFIX_SYSTEM_RULES) {
    if (parsed.suffix && r.match.test(parsed.suffix)) return r.system
  }
  // 2. Keyword scan across instrument_type + service_description
  const haystack = `${indexRow.instrument_type || ''} ${indexRow.service_description || ''} ${parsed.fn}`
  for (const r of SYSTEM_KEYWORD_RULES) {
    if (r.match.test(haystack)) return r.system
  }
  return IO_LIST_DEFAULTS.system_default
}

function buildIoType(system, ioCategory) {
  const prefix = IO_TYPE_PREFIX[system] || ''
  return prefix ? `${prefix}-${ioCategory}` : ioCategory
}

function resolveSignalLabel(signalKey) {
  switch (signalKey) {
    case 'analog':       return IO_LIST_DEFAULTS.signal_analog
    case 'digital_24v':  return IO_LIST_DEFAULTS.signal_digital_24v
    case 'digital_pf':   return IO_LIST_DEFAULTS.signal_digital_pf
    default:             return IO_LIST_DEFAULTS.signal_digital_pf
  }
}

function resolveVoltage(signalKey) {
  switch (signalKey) {
    case 'analog':       return IO_LIST_DEFAULTS.voltage_analog
    case 'digital_24v':  return IO_LIST_DEFAULTS.voltage_digital
    case 'digital_pf':   return IO_LIST_DEFAULTS.voltage_potfree
    default:             return IO_LIST_DEFAULTS.voltage_potfree
  }
}

// ── Main builder ────────────────────────────────────────────────────────────
/**
 * @param {Array<object>} instruments  Rows from the Instrument Index extractor.
 * @param {object} [opts]
 * @param {string} [opts.pid_no]       Fallback P&ID number (e.g. drawing dwg_no).
 * @param {string} [opts.rev]          Project revision label.
 * @param {boolean} [opts.includeIndicators=false]
 *        When false, pure indicators (FI, PI, TI, …) are skipped (they don't
 *        consume IO channels). Toggle to include them as HMI-only rows.
 * @returns {Array<object>} IO list rows, keyed by `IO_LIST_COLUMNS[].key`.
 */
export function buildIoListRowsFromInstruments(instruments, opts = {}) {
  const includeIndicators = Boolean(opts.includeIndicators)
  const pidFallback       = opts.pid_no || ''
  const rev               = opts.rev || IO_LIST_DEFAULTS.rev_default

  const rows = []
  let serial = 0

  for (const raw of instruments || []) {
    const idx = normaliseIndexRow(raw)
    const tag = String(idx.tag_number || '').trim()
    if (!tag) continue

    const parsed = parseTag(tag)
    const rule   = resolveFunctionRule(parsed.fn)
    if (rule.indicator && !includeIndicators) continue

    const system = resolveSystem(parsed, idx)
    const ioType = buildIoType(system, rule.io_category)
    const signal = rule.signal || FALLBACK_RULE.signal

    serial += 1
    rows.push({
      s_no:                String(serial),
      tag_number:          tag,
      loop_number:         idx.loop_number || `${parsed.area ? parsed.area + '-' : ''}${parsed.fn}-${parsed.num}`,
      instrument_type:     idx.instrument_type || rule.instrument_type_default,
      service_description: idx.service_description || '',
      hmi_description:     idx.service_description || idx.instrument_type || rule.instrument_type_default,
      from:                '',
      to:                  '',
      status:              IO_LIST_DEFAULTS.status_default,
      io_type:             ioType,
      system,
      hmi_tag:             tag,
      is_nis:              rule.is_nis || IO_LIST_DEFAULTS.is_default,
      signal_type:         resolveSignalLabel(signal),
      voltage_lvl:         resolveVoltage(signal),
      wire_type:           rule.wire || IO_LIST_DEFAULTS.wire_none,
      wet_dry:             rule.wet_dry || IO_LIST_DEFAULTS.wet_dry_default,
      pid_no:              idx.pid_no || pidFallback,
      mos:                 '',
      oos:                 '',
      sys_range_min:       idx.range_min || '',
      sys_range_max:       idx.range_max || '',
      unit:                idx.unit || '',
      alarm_h:             '',
      alarm_hh:            '',
      alarm_l:             '',
      alarm_ll:            '',
      alarm_priority:      '',
      marsh_cab_no:        '',
      sys_cab_no:          '',
      jb_number:           '',
      intercon_dwg_no:     '',
      loop_dwg_no:         '',
      pri_cable_no:        '',
      cable_size:          '',
      remarks:             rule === FALLBACK_RULE ? 'Auto-classified — please review' : '',
      rev,
    })
  }

  return rows
}

// Convenience accessor so the page can render a preview without re-importing.
export { IO_LIST_COLUMNS }
