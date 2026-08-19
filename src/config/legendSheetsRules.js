// ═════════════════════════════════════════════════════════════════════
// Legend Sheets — cross-check rules & realtime-sync helpers
// SOFT-CODED registry of the comparison rules the backend applies when it
// validates P&ID tags against Line List / Equipment List / Instrument
// Index legend sheets. Edit values here; the UI reads them directly.
// ═════════════════════════════════════════════════════════════════════

// BroadcastChannel used to keep every open canvas / modal / tab in sync
// whenever a legend is created, updated, activated, or deleted.
export const LEGEND_SYNC_CHANNEL = 'radai_pidv2_legend_sync'

// Payload actions dispatched over the channel.
export const LEGEND_SYNC_ACTIONS = {
  CREATED:   'legend_created',
  UPDATED:   'legend_updated',
  DELETED:   'legend_deleted',
  ACTIVATED: 'legend_activated',
}

// Fallback polling interval (ms) — used only when BroadcastChannel is
// unavailable (older browsers, Safari private mode).
export const LEGEND_SYNC_POLL_MS = 15_000

// Per-section metadata + soft-coded comparison rules.
//   id         — must match backend LEGEND_SECTION choices
//   label      — human-readable
//   icon       — emoji shown in section headers
//   dataSource — where the reference data comes from
//   matchKey   — the primary column the engine matches on
//   rules      — the ordered set of checks the engine executes
// -------------------------------------------------------------------
export const LEGEND_SECTION_RULES = [
  {
    id: 'line_list',
    label: 'Line List',
    icon: '🧵',
    accent: '#7c3aed',
    dataSource: 'Master Line List (Excel)',
    matchKey: 'Composite line tag (size + service + spec + serial)',
    rules: [
      { id: 'LL-R1', name: 'Tag composition',
        detail: 'Every extracted tag must decompose into the legend fields (separator-delimited).' },
      { id: 'LL-R2', name: 'Size match',
        detail: 'Size field must equal the Excel line list `size` column exactly (with " suffix).' },
      { id: 'LL-R3', name: 'Service code',
        detail: 'Service code must exist in the legend lookup table AND match the line list `service_code`.' },
      { id: 'LL-R4', name: 'Spec code',
        detail: 'Piping spec code must match the line list `spec` for the same tag row.' },
      { id: 'LL-R5', name: 'Serial uniqueness',
        detail: 'Serial number must be unique per (service + spec) pair.' },
      { id: 'LL-R6', name: 'Missing / extra',
        detail: 'Tags on P&ID but not on the line list = MISSING; on line list but not on P&ID = EXTRA.' },
    ],
  },
  {
    id: 'equipment_list',
    label: 'Equipment List',
    icon: '⚙️',
    accent: '#0369a1',
    dataSource: 'Master Equipment List (Excel)',
    matchKey: 'Equipment tag (letter prefix + number + optional suffix)',
    rules: [
      { id: 'EQ-R1', name: 'Tag pattern',
        detail: 'Equipment tag must match the legend regex (e.g. V-803-TF, P-101A).' },
      { id: 'EQ-R2', name: 'Prefix ↔ type lookup',
        detail: 'Letter prefix (V, P, E, T…) must resolve to a valid equipment type via the legend lookup.' },
      { id: 'EQ-R3', name: 'Serial range',
        detail: 'Numeric serial must fall in the range allowed by the section prefix.' },
      { id: 'EQ-R4', name: 'Attribute cross-check',
        detail: 'When BYOK AI is enabled, MOC / design P&T / capacity are compared against the equipment list row.' },
      { id: 'EQ-R5', name: 'Missing / extra',
        detail: 'Equipment on P&ID but not on the list = MISSING; on list but not on P&ID = EXTRA.' },
    ],
  },
  {
    id: 'instrument_index',
    label: 'Instrument Index',
    icon: '📟',
    accent: '#059669',
    dataSource: 'Master Instrument Index (Excel)',
    matchKey: 'Instrument tag (function letters + loop number)',
    rules: [
      { id: 'IX-R1', name: 'ISA function letters',
        detail: 'First 1–4 letters must be valid ISA-5.1 function codes defined in the legend lookup.' },
      { id: 'IX-R2', name: 'Loop number',
        detail: 'Loop number must exist in the instrument index and match unit / area.' },
      { id: 'IX-R3', name: 'Signal type',
        detail: 'Signal (electrical / pneumatic / discrete) must be consistent between the P&ID and the index.' },
      { id: 'IX-R4', name: 'Service description',
        detail: 'Instrument service description must match the index for the same loop number.' },
      { id: 'IX-R5', name: 'Missing / extra',
        detail: 'Instruments on P&ID but not indexed = MISSING; indexed but not on P&ID = EXTRA.' },
    ],
  },
]

// Convenience lookup by section id
export function getSectionRules(sectionId) {
  return LEGEND_SECTION_RULES.find(s => s.id === sectionId) || null
}

// Emit a sync event over the BroadcastChannel. Safe no-op when the API
// is not available (older browsers / SSR).
export function emitLegendSync(action, payload = {}) {
  try {
    if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return
    const ch = new BroadcastChannel(LEGEND_SYNC_CHANNEL)
    ch.postMessage({ action, at: Date.now(), ...payload })
    ch.close()
  } catch { /* silent */ }
}

// Subscribe to sync events. Returns an unsubscribe fn.
export function subscribeLegendSync(handler) {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return () => {}
  const ch = new BroadcastChannel(LEGEND_SYNC_CHANNEL)
  ch.onmessage = (e) => { try { handler(e.data) } catch { /* silent */ } }
  return () => { try { ch.close() } catch { /* silent */ } }
}
