/**
 * Instrument Index → IO List soft-coded rule engine
 * ----------------------------------------------------------------------------
 * Everything in this file is data-only. The mapping logic that consumes it
 * lives in `utils/instrumentIndexToIoRows.js`. Engineers can tune any rule
 * here without touching the IO List page, the InstrumentToolHub, or the
 * backend.
 *
 * Reference template (column set + IO-type codes) mirrors the ADNOC GAS
 * "INSTRUMENT I/O LIST" deliverable, e.g. NM-30201-50200-H0-113-13-15-25-001.
 */

// ── Canonical IO List column schema (Excel column order) ────────────────────
// Add / remove / reorder freely — page & backend just iterate this array.
export const IO_LIST_COLUMNS = [
  { key: 's_no',                 label: 'S. No.' },
  { key: 'tag_number',           label: 'Tag Number' },
  { key: 'loop_number',          label: 'Loop Number' },
  { key: 'instrument_type',      label: 'Instrument Type' },
  { key: 'service_description',  label: 'Service Description' },
  { key: 'hmi_description',      label: 'HMI Description' },
  { key: 'from',                 label: 'From' },
  { key: 'to',                   label: 'To' },
  { key: 'status',               label: 'Status' },
  { key: 'io_type',              label: 'I/O Type' },
  { key: 'system',               label: 'System' },
  { key: 'hmi_tag',              label: 'HMI Tag' },
  { key: 'is_nis',               label: 'IS / NIS' },
  { key: 'signal_type',          label: 'Signal Type' },
  { key: 'voltage_lvl',          label: 'Voltage LVL' },
  { key: 'wire_type',            label: 'Wire Type' },
  { key: 'wet_dry',              label: 'Wet / Dry' },
  { key: 'pid_no',               label: 'P&ID No' },
  { key: 'mos',                  label: 'MOS' },
  { key: 'oos',                  label: 'OOS' },
  { key: 'sys_range_min',        label: 'Sys. Range Min' },
  { key: 'sys_range_max',        label: 'Sys. Range Max' },
  { key: 'unit',                 label: 'Unit' },
  { key: 'alarm_h',              label: 'Alarm H' },
  { key: 'alarm_hh',             label: 'Alarm HH' },
  { key: 'alarm_l',              label: 'Alarm L' },
  { key: 'alarm_ll',             label: 'Alarm LL' },
  { key: 'alarm_priority',       label: 'Alarm Priority' },
  { key: 'marsh_cab_no',         label: 'Marsh Cab No.' },
  { key: 'sys_cab_no',           label: 'Sys Cab No.' },
  { key: 'jb_number',            label: 'JB Number' },
  { key: 'intercon_dwg_no',      label: 'Intercon. Dwg. No.' },
  { key: 'loop_dwg_no',          label: 'Loop Dwg. No.' },
  { key: 'pri_cable_no',         label: 'Pri Cable No.' },
  { key: 'cable_size',           label: 'Cable Size (Pr./Tr./Core)' },
  { key: 'remarks',              label: 'Remarks' },
  { key: 'rev',                  label: 'Rev' },
]

// ── Top-level defaults — apply when a rule does not override the value ──────
export const IO_LIST_DEFAULTS = {
  system_default:       'DCS',
  status_default:       'N-NEW',
  voltage_analog:       '24V DC',
  voltage_digital:      '24V DC',
  voltage_potfree:      '---',
  signal_analog:        '4-20 mA',
  signal_digital_pf:    'POTENTIAL FREE',
  signal_digital_24v:   '24V DC',
  wire_hart:            '2W(HART)',
  wire_none:            '---',
  wet_dry_default:      '---',
  rev_default:          '0',
  is_default:           'IS',     // intrinsically safe (4-20 mA HART loops)
  nis_default:          'NIS',    // non-IS (24V DC digital, hand switches)
}

// ── Tag-prefix → measurement-letter table ───────────────────────────────────
// Function letter (per ISA-5.1) is the *second* alphabetic character in
// classic tags like "113-PT-3191", or the first in shortened forms like
// "PT-100". The mapper extracts the function letters then looks the
// combination up here. Lower-case keys, first match wins.
//
// io_category: AI | AO | DI | DO | SC
// signal     : 'analog' | 'digital_pf' | 'digital_24v' | 'serial'
// is_nis     : 'IS' | 'NIS'
// instrument_type_default : human description used when the index row has no
//                           instrument_type filled in.
export const TAG_FUNCTION_RULES = [
  // ── Analog transmitters (HART, IS) ──────────────────────────────────────
  { match: /^(FT|FIT|FQT)$/i,    io_category: 'AI', signal: 'analog', is_nis: 'IS',
    instrument_type_default: 'FLOW TRANSMITTER',                wire: '2W(HART)' },
  { match: /^(FDT|FDIT)$/i,      io_category: 'AI', signal: 'analog', is_nis: 'IS',
    instrument_type_default: 'FLOW DP TRANSMITTER',             wire: '2W(HART)' },
  { match: /^(PT|PIT)$/i,        io_category: 'AI', signal: 'analog', is_nis: 'IS',
    instrument_type_default: 'PRESSURE TRANSMITTER',            wire: '2W(HART)' },
  { match: /^(PDT|PDIT)$/i,      io_category: 'AI', signal: 'analog', is_nis: 'IS',
    instrument_type_default: 'PRESSURE DIFFERENTIAL TRANSMITTER', wire: '2W(HART)' },
  { match: /^(TT|TIT)$/i,        io_category: 'AI', signal: 'analog', is_nis: 'IS',
    instrument_type_default: 'TEMPERATURE TRANSMITTER',         wire: '2W(HART)' },
  { match: /^(TDT|TDIT)$/i,      io_category: 'AI', signal: 'analog', is_nis: 'IS',
    instrument_type_default: 'TEMPERATURE DIFFERENTIAL TRANSMITTER', wire: '2W(HART)' },
  { match: /^(LT|LIT)$/i,        io_category: 'AI', signal: 'analog', is_nis: 'IS',
    instrument_type_default: 'LEVEL TRANSMITTER',               wire: '2W(HART)' },
  { match: /^(AT|AIT)$/i,        io_category: 'AI', signal: 'analog', is_nis: 'IS',
    instrument_type_default: 'ANALYSER TRANSMITTER',            wire: '2W(HART)' },
  { match: /^(VT|VIT)$/i,        io_category: 'AI', signal: 'analog', is_nis: 'IS',
    instrument_type_default: 'VIBRATION TRANSMITTER',           wire: '2W(HART)' },
  { match: /^(ZT|ZIT|PZT|PZIT)$/i, io_category: 'AI', signal: 'analog', is_nis: 'IS',
    instrument_type_default: 'POSITION TRANSMITTER',            wire: '2W(HART)' },

  // ── Analog outputs ──────────────────────────────────────────────────────
  { match: /^(PY|FY|TY|LY)$/i,   io_category: 'AO', signal: 'analog', is_nis: 'IS',
    instrument_type_default: 'VALVE POSITIONER',                wire: '2W(HART)' },

  // ── Digital outputs (commands, solenoids) ───────────────────────────────
  { match: /^(XY|SY)$/i,         io_category: 'DO', signal: 'digital_24v', is_nis: 'NIS',
    instrument_type_default: 'SOLENOID VALVE',                  wire: '---',  wet_dry: 'Wet' },
  { match: /^(XHSC|HSC)$/i,      io_category: 'DI', signal: 'digital_pf',  is_nis: 'NIS',
    instrument_type_default: 'FIELD HAND SWITCH CLOSE',         wire: '---' },
  { match: /^(XHSO|HSO)$/i,      io_category: 'DI', signal: 'digital_pf',  is_nis: 'NIS',
    instrument_type_default: 'FIELD HAND SWITCH OPEN',          wire: '---' },

  // ── Digital inputs (limit switches / proximity / status) ────────────────
  { match: /^(ZSC|XZSC)$/i,      io_category: 'DI', signal: 'digital_pf',  is_nis: 'IS',
    instrument_type_default: 'POSITION CLOSED PROXIMITY SWITCH', wire: '---' },
  { match: /^(ZSO|XZSO)$/i,      io_category: 'DI', signal: 'digital_pf',  is_nis: 'IS',
    instrument_type_default: 'POSITION OPEN PROXIMITY SWITCH',  wire: '---' },
  { match: /^(LSH|LSHH)$/i,      io_category: 'DI', signal: 'digital_pf',  is_nis: 'IS',
    instrument_type_default: 'LEVEL SWITCH HIGH',               wire: '---' },
  { match: /^(LSL|LSLL)$/i,      io_category: 'DI', signal: 'digital_pf',  is_nis: 'IS',
    instrument_type_default: 'LEVEL SWITCH LOW',                wire: '---' },
  { match: /^(PSH|PSHH)$/i,      io_category: 'DI', signal: 'digital_pf',  is_nis: 'IS',
    instrument_type_default: 'PRESSURE SWITCH HIGH',            wire: '---' },
  { match: /^(PSL|PSLL)$/i,      io_category: 'DI', signal: 'digital_pf',  is_nis: 'IS',
    instrument_type_default: 'PRESSURE SWITCH LOW',             wire: '---' },
  { match: /^(TSH|TSL)$/i,       io_category: 'DI', signal: 'digital_pf',  is_nis: 'IS',
    instrument_type_default: 'TEMPERATURE SWITCH',              wire: '---' },

  // ── Indicators (DCS HMI only — no IO; emit as commented row by default) ─
  { match: /^(FI|PI|TI|LI|AI|ZI|PDI)$/i, io_category: 'AI', signal: 'analog', is_nis: 'IS',
    instrument_type_default: 'INDICATOR (HMI)',                 wire: '2W(HART)',
    indicator: true },
]

// ── Tag-suffix → side-of-the-loop routing (DCS vs ESD/field) ────────────────
// In ADNOC numbering the same logical loop often produces two rows:
//   113-XHSC-9501A  (FIELD switch)          → ESD side
//   113-XHSC-9501B  (HMI command from DCS)  → DCS side
// Soft-coded suffix table lets you tweak without touching mapper code.
export const TAG_SUFFIX_SYSTEM_RULES = [
  { match: /B$/,   system: 'DCS' },
  { match: /A$/,   system: 'ESD' },
  // default = blank → use SYSTEM_KEYWORD_RULES below
]

// ── Instrument-type / category keywords → ESD vs DCS ────────────────────────
// Used when the tag itself doesn't disambiguate (no A/B suffix).
export const SYSTEM_KEYWORD_RULES = [
  // ESD / safety devices
  { match: /\b(esd|sdv|shutdown|safety|trip|emergency|sis|sil)\b/i, system: 'ESD' },
  // Otherwise default to DCS
]

// ── IO-Type code builder ────────────────────────────────────────────────────
// Combines system + io_category into the ADNOC short-code (D-AI, E-DI, …).
export const IO_TYPE_PREFIX = {
  DCS: 'D',
  ESD: 'E',
}

// ── Generic fallback when nothing matches ───────────────────────────────────
export const FALLBACK_RULE = {
  io_category:             'DI',
  signal:                  'digital_pf',
  is_nis:                  'NIS',
  instrument_type_default: 'UNCLASSIFIED',
  wire:                    '---',
}

// ── Header alias dictionary (Instrument Index → canonical key) ──────────────
// Used to normalise the row shape we get from the Instrument Index Excel or
// the live extractor service. Add new aliases here; mapper code stays put.
export const INDEX_HEADER_ALIASES = {
  tag_number:          ['tag_number', 'tag no', 'tag', 'instrument tag', 'tag number'],
  instrument_type:     ['instrument_type', 'instrument type', 'type'],
  service_description: ['service_description', 'service description', 'service', 'description'],
  loop_number:         ['loop_number', 'loop no', 'loop', 'loop number'],
  pid_no:              ['pid_no', 'p&id no', 'p&id', 'pid', 'p&id number', 'drawing no'],
  line_no:             ['line_no', 'line no', 'line number'],
  equipment_no:        ['equipment_no', 'equipment no', 'equipment'],
  range_min:           ['range_min', 'min', 'sys range min', 'range from'],
  range_max:           ['range_max', 'max', 'sys range max', 'range to'],
  unit:                ['unit', 'units', 'engineering unit', 'eng unit'],
  signal:              ['signal', 'signal type'],
  fail_safe:           ['fail_safe', 'fail safe'],
}
