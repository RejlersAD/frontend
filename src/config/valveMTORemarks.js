/**
 * Soft-coded valve-tag suffix → Remark codes.
 * ============================================
 * Mirrors the backend dictionary at:
 *   backend/apps/pid_verification/services/piping_valve_mto_extractor.py
 *   (VALVE_TAG_REMARK_CODES + VALVE_PHRASE_REMARK_CODES)
 *
 * Standard P&ID valve condition / operator codes appended to a tag
 * (e.g. "BV-1234-LO", "GV-08-FBLC"). When ANY string column of a row
 * contains one of these tokens — or its spelled-out phrase variant
 * ("Locked Open", "Fail Closed") — the matching code is surfaced in
 * the Remarks column so engineers see "LO, LC, TSO, FBLC, FBLO"
 * without manual decoding.
 *
 * Order matters — longer codes / phrases are listed first so "FBLC"
 * is not truncated mid-match to "LC" and "FAIL OPEN" doesn't lose to
 * "OPEN".
 */

// ─── Short-token codes (e.g. inside valve tags) ────────────────────────
// [code, label] — label is what appears in the Remarks column.
export const VALVE_TAG_REMARK_CODES = [
  ['FBLO', 'FBLO'],  // Full-Bore Locked Open
  ['FBLC', 'FBLC'],  // Full-Bore Locked Closed
  ['CSO',  'CSO'],   // Car-Sealed Open
  ['CSC',  'CSC'],   // Car-Sealed Closed
  ['TSO',  'TSO'],   // Tight Shut-Off
  ['NRV',  'NRV'],   // Non-Return Valve
  ['LO',   'LO'],    // Locked Open
  ['LC',   'LC'],    // Locked Closed
  ['NO',   'NO'],    // Normally Open
  ['NC',   'NC'],    // Normally Closed
  ['FO',   'FO'],    // Fail Open
  ['FC',   'FC'],    // Fail Closed
  ['FL',   'FL'],    // Fail Last
  ['FI',   'FI'],    // Fail Indeterminate
];

// ─── Spelled-out phrase → code mapping ─────────────────────────────────
// Vision / Excel cells often store the english phrase rather than the
// short token. Order: longer phrases first so substring matches don't
// steal hits from more-specific phrases.
export const VALVE_PHRASE_REMARK_CODES = [
  ['FULL-BORE LOCKED OPEN',   'FBLO'],
  ['FULL BORE LOCKED OPEN',   'FBLO'],
  ['FULL-BORE LOCKED CLOSED', 'FBLC'],
  ['FULL BORE LOCKED CLOSED', 'FBLC'],
  ['CAR-SEALED OPEN',         'CSO'],
  ['CAR SEALED OPEN',         'CSO'],
  ['CAR-SEALED CLOSED',       'CSC'],
  ['CAR SEALED CLOSED',       'CSC'],
  ['TIGHT SHUT-OFF',          'TSO'],
  ['TIGHT SHUT OFF',          'TSO'],
  ['TIGHT SHUTOFF',           'TSO'],
  ['NON-RETURN VALVE',        'NRV'],
  ['NON RETURN VALVE',        'NRV'],
  ['LOCKED OPEN',             'LO'],
  ['LOCKED CLOSED',           'LC'],
  ['NORMALLY OPEN',           'NO'],
  ['NORMALLY CLOSED',         'NC'],
  ['FAIL OPEN',               'FO'],
  ['FAIL CLOSED',             'FC'],
  ['FAIL CLOSE',              'FC'],
  ['FAIL LAST',               'FL'],
  ['FAIL IN PLACE',           'FL'],
  ['FAIL INDETERMINATE',      'FI'],
];

// Fields scanned when deriving Remarks from a row. Vision/import can
// place the status code in any text column, so scan them all.
export const REMARK_SOURCE_FIELDS = [
  'valve_tag', 'remarks', 'description',
  'type', 'line_number', 'pms_class', 'rating', 'bore',
];

// Free-text values to drop when merging derived codes with the
// pre-existing remarks string (placeholders / empty-ish noise).
const REMARK_DROP_VALUES = new Set(['n/a', 'na', 'none', 'null', '-', '—', '–', '.']);

// ─── Regex builders (with Safari < 16.4 lookbehind fallback) ───────────
const _esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const _buildRe = (items) => {
  const body = items.map(([k]) => _esc(k)).join('|');
  try {
    return new RegExp(`(?<![A-Z])(${body})(?![A-Z])`, 'gi');
  } catch (_e) {
    // Lookbehind fallback — captures an optional non-letter prefix.
    return new RegExp(`(^|[^A-Z])(${body})(?![A-Z])`, 'gi');
  }
};

const _CODE_RE   = _buildRe(VALVE_TAG_REMARK_CODES);
const _PHRASE_RE = _buildRe(VALVE_PHRASE_REMARK_CODES);

// Canonical output order = order of VALVE_TAG_REMARK_CODES.
const _ORDER_BY_LABEL = new Map(VALVE_TAG_REMARK_CODES.map(([, l], i) => [l, i]));

const _phraseLookup = (() => {
  const map = new Map();
  for (const [phrase, code] of VALVE_PHRASE_REMARK_CODES) {
    map.set(phrase.toUpperCase(), code);
    map.set(phrase.toUpperCase().replace(/-/g, ' '), code);
  }
  return map;
})();

const _labelByCode = new Map(VALVE_TAG_REMARK_CODES.map(([c, l]) => [c.toUpperCase(), l]));
const _labelFor = (code) => _labelByCode.get(String(code).toUpperCase()) || '';

const _scan = (text, re, resolveLabel, found) => {
  if (!text) return;
  const s = String(text);
  re.lastIndex = 0;
  let m;
  while ((m = re.exec(s)) !== null) {
    // Captured group is always the LAST one regardless of which regex shape.
    const raw = m[m.length - 1] || m[1];
    const label = resolveLabel(String(raw).toUpperCase());
    if (label && !found.includes(label)) found.push(label);
  }
};

const _sortByCanonicalOrder = (arr) => {
  arr.sort((a, b) => (_ORDER_BY_LABEL.get(a) ?? 999) - (_ORDER_BY_LABEL.get(b) ?? 999));
  return arr;
};

/**
 * Return a comma-separated list of suffix codes embedded in `valveTag`.
 * Empty string when no codes match. Order follows VALVE_TAG_REMARK_CODES.
 */
export const deriveRemarksFromTag = (valveTag) => {
  if (!valveTag) return '';
  const found = [];
  _scan(valveTag, _PHRASE_RE, (raw) => _labelFor(_phraseLookup.get(raw.replace(/-/g, ' '))), found);
  _scan(valveTag, _CODE_RE,   _labelFor, found);
  return _sortByCanonicalOrder(found).join(', ');
};

/**
 * Scan an entire row across REMARK_SOURCE_FIELDS for operational codes.
 * Returns a comma-separated label list (deterministic order) or '' when
 * nothing matches.
 */
export const deriveRemarksFromRow = (row) => {
  if (!row || typeof row !== 'object') return '';
  const found = [];
  for (const field of REMARK_SOURCE_FIELDS) {
    const text = row[field];
    if (!text) continue;
    _scan(text, _PHRASE_RE, (raw) => _labelFor(_phraseLookup.get(raw.replace(/-/g, ' '))), found);
    _scan(text, _CODE_RE,   _labelFor, found);
  }
  return _sortByCanonicalOrder(found).join(', ');
};

/**
 * Merge a derived code list with any pre-existing free-text remarks so
 * legitimate engineering notes survive the derivation pass. Keeps the
 * original text when it already contains every derived code; otherwise
 * appends the missing codes in parentheses.
 */
export const mergeRemarks = (original, derived) => {
  const orig = String(original || '').trim();
  const der  = String(derived  || '').trim();
  if (!der) return orig;
  if (!orig || REMARK_DROP_VALUES.has(orig.toLowerCase())) return der;
  const norm = (s) => s.replace(/\s+/g, '').toUpperCase();
  if (norm(orig) === norm(der)) return der;
  const origUp = orig.toUpperCase();
  const extra = der.split(',').map((c) => c.trim()).filter((c) => c && !origUp.includes(c.toUpperCase()));
  if (!extra.length) return orig;
  return `${orig} (${extra.join(', ')})`;
};

export default {
  VALVE_TAG_REMARK_CODES,
  VALVE_PHRASE_REMARK_CODES,
  REMARK_SOURCE_FIELDS,
  deriveRemarksFromTag,
  deriveRemarksFromRow,
  mergeRemarks,
};
