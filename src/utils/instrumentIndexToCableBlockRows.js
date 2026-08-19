/**
 * Pure mapping utility: Instrument Index rows → Cable Block Diagram rows.
 *
 * Re-uses the IO List rule engine (`buildIoListRowsFromInstruments`) to first
 * resolve every instrument to its system / IS-NIS / signal-type classification,
 * then groups the resulting IO points into cable bundles (field cables +
 * multicores) routed to marshalling and system cabinets — the canonical CBD
 * schema seen in ADNOC instrument cable block diagrams.
 *
 * Pure / no side effects / no I/O — fully unit-testable. Designed so the page
 * never has to know the underlying mapping rules; tune them here.
 */

import { buildIoListRowsFromInstruments } from './instrumentIndexToIoRows'

// ── Soft-coded CBD column schema (mirrors typical ADNOC cable block sheet) ──
export const CABLE_BLOCK_COLUMNS = [
  { key: 's_no',                label: '#' },
  { key: 'tag_number',          label: 'Instrument Tag' },
  { key: 'service_description', label: 'Service' },
  { key: 'system',              label: 'System' },
  { key: 'is_nis',              label: 'IS / NIS' },
  { key: 'signal_type',         label: 'Signal Type' },
  { key: 'jb_no',               label: 'Junction Box' },
  { key: 'field_cable_no',      label: 'Field Cable Tag' },
  { key: 'field_cable_size',    label: 'Field Cable Size' },
  { key: 'multicore_cable_no',  label: 'Multicore Tag' },
  { key: 'multicore_size',      label: 'Multicore Size' },
  { key: 'marsh_cab_no',        label: 'Marshalling Cabinet' },
  { key: 'sys_cab_no',          label: 'System Cabinet' },
  { key: 'function',            label: 'Function' },
  { key: 'pid_no',              label: 'P&ID No.' },
  { key: 'rev',                 label: 'Rev' },
  { key: 'remarks',             label: 'Remarks' },
]

// ── Soft-coded cabinet & cable naming conventions ───────────────────────────
// Patterns mirror ADNOC Instrument Cable Block Diagram template
// (ref: DOD-30201-50200-H0-113-13-15-00-001). Override any constant in this
// block alone — no changes to the builder logic required.
//
// Naming examples from the reference:
//   JB:               113 A 16 101   113 D 15 005   113 C 15 008
//   DCS Marshalling:  15-DT-01       15-DT-02
//   DCS System:       15-DS-01
//   ESD Marshalling:  15-ET-02A      15-ET-03B
//   ESD System:       15-ES-02
//   Field cable:      1Px1.5mm² (IS)   1Px2.5mm² (NIS)
//   Multicore:        10Px1.5mm² (IS) 20Px1.5mm² (IS) 30Px1.5mm² (IS)
//                     10Px2.5mm² (NIS)
export const CABLE_BLOCK_DEFAULTS = {
  // Cabinet patterns — sys letter: D = DCS, E = ESD, F = FGS.
  // Type letter:  T = Marshalling (Termination), S = System.
  marshallingCabinetPattern: '{unit}-{sys}T-{seq}',
  systemCabinetPattern:      '{unit}-{sys}S-{seq}',
  // Field cable tag (no ADNOC-mandated public format) — derived per instrument.
  fieldCableTagPattern:      '{unit}-FC-{seq}',
  // Multicore tag matches JB number per ADNOC convention (cable label = JB no.).
  multicoreTagPattern:       '{unit} {jbLetter} {area} {seq}',
  // Junction box: {unit} {sigLetter} {area} {seq}
  // sigLetter:  A = Analog IS, D = Digital IS, C = Digital NIS.
  junctionBoxPattern:        '{unit} {jbLetter} {area} {seq}',
  // Signal-class → JB letter mapping (drives both JB no. and multicore no.).
  jbLetterByClass: {
    'ANALOG_IS':   'A',
    'DIGITAL_IS':  'D',
    'ANALOG_NIS':  'C',
    'DIGITAL_NIS': 'C',
    default:       'A',
  },
  // Field cable gauge (mm²) by IS/NIS classification.
  fieldGaugeByIsNis: { IS: '1.5', NIS: '2.5' },
  // Multicore gauge (mm²) by IS/NIS classification.
  multicoreGaugeByIsNis: { IS: '1.5', NIS: '2.5' },
  // Multicore pair-count tiers — first tier whose threshold ≥ IO count wins.
  // Reference PDF shows 10P, 20P, 30P multicores in use.
  multicorePairTiers: [
    { maxIo: 8,  pairs: 10 },
    { maxIo: 16, pairs: 20 },
    { maxIo: 30, pairs: 30 },
  ],
  multicorePairFallback: 30,
  // Default plant unit prefix when project unit is blank (matches ref dwg “15”).
  defaultUnit: '15',
  // Default area number when not derivable from instrument tag.
  defaultArea: '15',
  // Field instruments per junction box before opening a new JB.
  maxInstrumentsPerJb: 12,
  // JB seq numbering pad width (e.g. 101, 018, 005).
  jbSeqPadWidth: 3,
  // Cabinet seq numbering pad width (e.g. 01, 02).
  cabinetSeqPadWidth: 2,
  // Starting seq for cabinets when none can be inferred.
  defaultCabinetSeq: 1,
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function _systemLetter(system) {
  const s = String(system || '').toUpperCase()
  if (s === 'ESD') return 'E'
  if (s === 'FGS') return 'F'
  return 'D' // default DCS
}

function _isNisLetter(isNis) {
  return String(isNis || '').toUpperCase() === 'NIS' ? 'N' : 'T'
}

function _fmt(pattern, vars) {
  return String(pattern).replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''))
}

function _padSeq(n, width = 3) {
  return String(n).padStart(width, '0')
}

function _parseArea(tag) {
  const m = /^\s*([A-Za-z0-9]+)[-_]/.exec(String(tag || ''))
  return m ? m[1] : ''
}

// ── Main builder ────────────────────────────────────────────────────────────
/**
 * @param {Array<object>} instruments  Rows from the Instrument Index extractor.
 * @param {object} [opts]
 * @param {string} [opts.pid_no]
 * @param {string} [opts.rev]
 * @param {string} [opts.unit]                Plant unit prefix for cabinets.
 * @param {boolean} [opts.includeIndicators]  Pass through to IO list builder.
 * @returns {Array<object>}  CBD rows keyed by CABLE_BLOCK_COLUMNS[].key.
 */
export function buildCableBlockRowsFromInstruments(instruments, opts = {}) {
  const ioRows = buildIoListRowsFromInstruments(instruments, opts)
  const unit   = (opts.unit || CABLE_BLOCK_DEFAULTS.defaultUnit).trim()
  const rev    = opts.rev || '0'

  // Group IO rows into (area, system, is_nis) buckets — one bucket per
  // junction box. New JB opens once a bucket fills past maxInstrumentsPerJb.
  const buckets = new Map()        // key → array of io rows
  const bucketMeta = new Map()     // key → { area, sysLet, jbLetter, isNis, jbSeq }
  const jbCounters = new Map()     // `${area}|${sysLet}|${jbLetter}` → next seq
  const cabinetCounters = new Map() // `${unit}|${sysLet}` → next cabinet seq
  const D = CABLE_BLOCK_DEFAULTS

  // Classify each instrument into (sysLet, jbLetter, isNis) and bucket it.
  function _classify(r) {
    const sig    = String(r.signal_type || '').toLowerCase()
    const isNis  = String(r.is_nis || 'IS').toUpperCase() === 'NIS' ? 'NIS' : 'IS'
    const isAna  = sig.includes('analog') || sig === 'ai' || sig === 'ao'
    const classKey = `${isAna ? 'ANALOG' : 'DIGITAL'}_${isNis}`
    const jbLetter = D.jbLetterByClass[classKey] || D.jbLetterByClass.default
    return { sysLet: _systemLetter(r.system), jbLetter, isNis }
  }

  for (const r of ioRows) {
    const area   = _parseArea(r.tag_number) || D.defaultArea
    const { sysLet, jbLetter, isNis } = _classify(r)
    const groupKey = `${area}|${sysLet}|${jbLetter}`
    let bucketKey = `${groupKey}|${jbCounters.get(groupKey) || 1}`
    let bucket    = buckets.get(bucketKey)
    if (!bucket || bucket.length >= D.maxInstrumentsPerJb) {
      const next = (jbCounters.get(groupKey) || 0) + 1
      jbCounters.set(groupKey, next)
      bucketKey = `${groupKey}|${next}`
      bucket = []
      buckets.set(bucketKey, bucket)
      bucketMeta.set(bucketKey, { area, sysLet, jbLetter, isNis, jbSeq: next })
    }
    bucket.push(r)
  }

  // Helpers — multicore pair count derived from IO count using tier table.
  function _pairsForIoCount(n) {
    for (const t of D.multicorePairTiers) if (n <= t.maxIo) return t.pairs
    return D.multicorePairFallback
  }
  function _cabinetSeq(sysLet) {
    const k = `${unit}|${sysLet}`
    const next = (cabinetCounters.get(k) || (D.defaultCabinetSeq - 1)) + 1
    cabinetCounters.set(k, next)
    return _padSeq(next, D.cabinetSeqPadWidth)
  }

  // Emit CBD rows — one row per IO point, enriched with cable / cabinet info.
  // Cabinet seq is reused across all JBs sharing the same (unit, sysLet) so
  // the typical reference layout (single 15-DT-01, single 15-ES-02 …) emerges.
  const out = []
  let serial = 0
  let cableSeq = 0
  const cabinetCache = new Map() // sysLet → { marsh, sys }
  for (const [bucketKey, rows] of buckets.entries()) {
    const meta = bucketMeta.get(bucketKey) || {}
    const jbSeqPad = _padSeq(meta.jbSeq, D.jbSeqPadWidth)
    const jbNo = _fmt(D.junctionBoxPattern, {
      unit, jbLetter: meta.jbLetter, area: meta.area, seq: jbSeqPad,
    })
    // Multicore label = JB number (ADNOC convention seen in the reference dwg).
    const multicoreNo = _fmt(D.multicoreTagPattern, {
      unit, jbLetter: meta.jbLetter, area: meta.area, seq: jbSeqPad,
    })
    // Multicore size: <pairs>P × <gauge>mm² (IS|NIS)
    const mcGauge  = D.multicoreGaugeByIsNis[meta.isNis] || D.multicoreGaugeByIsNis.IS
    const mcPairs  = _pairsForIoCount(rows.length)
    const multicoreSize = `${mcPairs}Px${mcGauge}mm² (${meta.isNis})`
    // Field cable size: 1P × <gauge>mm² (IS|NIS)
    const fGauge   = D.fieldGaugeByIsNis[meta.isNis] || D.fieldGaugeByIsNis.IS
    const fieldCableSize = `1Px${fGauge}mm² (${meta.isNis})`
    // Cabinets: share one set per (unit, sysLet) so 15-DT-01 is reused, etc.
    let cab = cabinetCache.get(meta.sysLet)
    if (!cab) {
      const seq = _cabinetSeq(meta.sysLet)
      cab = {
        marsh: _fmt(D.marshallingCabinetPattern, { unit, sys: meta.sysLet, seq }),
        sys:   _fmt(D.systemCabinetPattern,      { unit, sys: meta.sysLet, seq }),
      }
      cabinetCache.set(meta.sysLet, cab)
    }

    for (const r of rows) {
      serial   += 1
      cableSeq += 1
      out.push({
        s_no:                String(serial),
        tag_number:          r.tag_number,
        service_description: r.service_description || '',
        system:              r.system || '',
        is_nis:              meta.isNis,
        signal_type:         r.signal_type || '',
        jb_no:               jbNo,
        field_cable_no:      _fmt(D.fieldCableTagPattern, {
          unit, area: meta.area, seq: _padSeq(cableSeq, 4),
        }),
        field_cable_size:    fieldCableSize,
        multicore_cable_no:  multicoreNo,
        multicore_size:      multicoreSize,
        marsh_cab_no:        cab.marsh,
        sys_cab_no:          cab.sys,
        function:            (r.io_type || '').replace(/^(DI|DO|AI|AO|DCS-|ESD-)/, ''),
        pid_no:              r.pid_no || '',
        rev,
        remarks:             r.remarks || '',
      })
    }
  }

  return out
}
