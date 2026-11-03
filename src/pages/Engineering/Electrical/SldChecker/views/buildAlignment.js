/**
 * buildAlignment — pure helper that builds one AlignRow per normalised
 * tag from the EXISTING comparison rows (equipment / load / eqload /
 * interfaces / cables). No new backend calls; every value comes from
 * sldService.getAnalysis(projectId, analysisId, tab).
 *
 * Types:
 *   DocCell  { present, text?, sub?, tone: 'ok'|'diff'|'only'|'demolition'|'none' }
 *   AlignRow { tag, group: 'board'|'load'|'other', sld, el, ll,
 *              status, statusLabel, source: [{ tab, index }] }
 *
 * Tag normalisation: uppercase; – — ‐ → '-'; no spaces.
 */

export const normalizeTag = tag => String(tag ?? '')
  .toUpperCase()
  .replace(/[–—‐]/g, '-')
  .replace(/\s+/g, '')

export const STATUS_LABEL = {
  matched: 'Matched', 'not-on-sld': 'Not on SLD', 'sld-only': 'On SLD only',
  'sld-demolition': 'On SLD · demolition', 'cable-only': 'Cable reference only',
  'different-tag': 'Different tag on SLD', 'no-tag-in-list': 'No tag in list',
  agrees: 'Agrees', 'board-mismatch': 'Board mismatch', 'rating-mismatch': 'Rating mismatch',
  'tag-conflict': 'Tag conflict', 'not-in-load-list': 'Not in Load List',
  'board-not-covered': 'Board not covered', 'board-covered': 'Board covered',
  'not-in-equipment-list': 'Not in Equipment List',
  interface: 'Interface', cable: 'Cable',
}

const BOARD_CATEGORIES = ['board', 'transformer', 'generator']

const cell = (present, text, tone, sub = null) => ({ present, text: text ?? null, sub, tone })
const NONE = text => cell(false, text ?? '—', 'none')

/** onSld already reads 'Sheet 00n' in the comparison rows; prefix only a bare number. */
const sheetText = onSld => (/^sheet/i.test(String(onSld ?? '')) ? String(onSld) : `Sheet ${onSld}`)

/** Load-List cell for a load row. */
function loadLlCell(row, tone) {
  const text = row.boardList ? `fed from ${row.boardList}` : (row.description ?? '—')
  const sub = row.kwList != null && row.kwList !== '' ? `${row.kwList} kW` : null
  return { present: true, text, sub, tone }
}

/** Equipment-List cell from the eqload lookup (loads), or '—'. */
function eqloadCell(eq) {
  if (!eq) return NONE()
  if (eq.status === 'not-in-equipment-list') return cell(true, 'Not in Equipment List', 'none')
  if (eq.status === 'board-covered') return cell(true, 'Board covered', 'ok')
  if (eq.status === 'board-not-covered') return cell(true, 'Board not covered', 'none')
  return cell(true, STATUS_LABEL[eq.status] ?? eq.status ?? '—', 'none')
}

export default function buildAlignment({ equipment = [], load = [], eqload = [], interfaces = [], cables = [], loadMeta = {} } = {}) {
  const eqloadByTag = new Map()
  eqload.forEach((r, index) => {
    const t = normalizeTag(r.tag)
    if (t) eqloadByTag.set(t, { row: r, index })
  })

  const byTag = new Map()
  const put = (tag, make) => {
    const t = normalizeTag(tag)
    if (!t) return
    if (byTag.has(t)) {
      // Same tag seen twice (e.g. equipment + load rows): merge sources,
      // keep the first row's cells.
      byTag.get(t)._sources.push(make._source)
      return
    }
    byTag.set(t, make)
  }

  // ── equipment rows ────────────────────────────────────────────────────
  equipment.forEach((r, index) => {
    const group = BOARD_CATEGORIES.includes(String(r.category || '').toLowerCase()) ? 'board' : 'load'
    const status = r.status ?? 'matched'
    let sld; let el; let ll = NONE()
    switch (status) {
      case 'matched':
        sld = cell(true, sheetText(r.onSld), 'ok')
        el = cell(true, r.listSheet ?? '—', 'ok', r.description ?? null)
        if (eqloadByTag.has(normalizeTag(r.tag))) ll = eqloadCell(eqloadByTag.get(normalizeTag(r.tag)).row)
        break
      case 'not-on-sld':
        sld = NONE('— not found')
        el = r.listSheet === 'Demolition'
          ? cell(true, 'Demolition', 'demolition')
          : cell(true, r.listSheet ?? '—', 'ok', r.description ?? null)
        if (eqloadByTag.has(normalizeTag(r.tag))) ll = eqloadCell(eqloadByTag.get(normalizeTag(r.tag)).row)
        break
      case 'sld-only':
        sld = cell(true, sheetText(r.onSld), 'only')
        el = NONE('— not in list')
        ll = NONE()
        break
      case 'sld-demolition':
        sld = cell(true, sheetText(r.onSld), 'ok')
        el = cell(true, 'Demolition', 'demolition')
        if (eqloadByTag.has(normalizeTag(r.tag))) ll = eqloadCell(eqloadByTag.get(normalizeTag(r.tag)).row)
        break
      case 'no-tag-in-list':
        sld = NONE()
        el = NONE('No tag in list')
        ll = NONE()
        break
      default:
        sld = cell(Boolean(r.onSld), r.onSld ? sheetText(r.onSld) : '—', r.onSld ? 'ok' : 'none')
        el = cell(Boolean(r.listSheet), r.listSheet ?? '—', r.listSheet ? 'ok' : 'none', r.description ?? null)
    }
    put(r.tag, {
      _sources: [{ tab: 'equipment', index }],
      _source: { tab: 'equipment', index },
      tag: normalizeTag(r.tag),
      group,
      sld, el, ll,
      status,
      statusLabel: STATUS_LABEL[status] ?? status,
      description: r.description ?? null,
      board: r.onSld ?? null,
      kw: null,
    })
  })

  // ── load rows ─────────────────────────────────────────────────────────
  load.forEach((r, index) => {
    const status = r.status ?? 'agrees'
    const eq = eqloadByTag.get(normalizeTag(r.tag))?.row ?? null
    let sld; let ll; const el = eqloadCell(eq)
    switch (status) {
      case 'board-mismatch':
      case 'rating-mismatch':
      case 'tag-conflict':
        sld = r.boardSld ? cell(true, `fed from ${r.boardSld}`, 'diff') : NONE('— not found')
        ll = loadLlCell(r, 'diff')
        break
      case 'not-on-sld':
        sld = NONE('— not found')
        ll = loadLlCell(r, 'ok')
        break
      case 'agrees':
        sld = cell(true, `fed from ${r.boardSld ?? r.boardList ?? '—'}`, 'ok')
        ll = loadLlCell(r, 'ok')
        break
      default: // not-in-load-list, board-not-covered, …
        sld = r.boardSld ? cell(true, `fed from ${r.boardSld}`, 'only') : NONE()
        ll = r.boardList ? loadLlCell(r, 'none') : NONE()
    }
    put(r.tag, {
      _sources: [{ tab: 'load', index }],
      _source: { tab: 'load', index },
      tag: normalizeTag(r.tag),
      group: 'load',
      sld, el, ll,
      status,
      statusLabel: STATUS_LABEL[status] ?? status,
      description: r.description ?? null,
      board: r.boardSld ?? r.boardList ?? null,
      kw: typeof r.kwList === 'number' ? r.kwList : parseFloat(r.kwList) || null,
    })
  })

  // ── interfaces ────────────────────────────────────────────────────────
  interfaces.forEach((r, index) => {
    put(r.tag, {
      _sources: [{ tab: 'interfaces', index }],
      _source: { tab: 'interfaces', index },
      tag: normalizeTag(r.tag),
      group: 'other',
      sld: cell(true, r.where ?? '—', 'only'),
      el: NONE(),
      ll: NONE(),
      status: 'interface',
      statusLabel: STATUS_LABEL.interface,
      description: r.meaning ?? null,
      board: null,
      kw: null,
    })
  })

  // ── cables ────────────────────────────────────────────────────────────
  cables.forEach((r, index) => {
    put(r.tag, {
      _sources: [{ tab: 'cables', index }],
      _source: { tab: 'cables', index },
      tag: normalizeTag(r.tag),
      group: 'other',
      sld: cell(true, [r.size, r.sheet].filter(Boolean).join(' · ') || '—', 'only'),
      el: NONE(),
      ll: NONE(),
      status: 'cable',
      statusLabel: STATUS_LABEL.cable,
      description: null,
      board: null,
      kw: null,
    })
  })

  const rows = [...byTag.values()].map(({ _sources, ...rest }) => ({ ...rest, source: _sources }))
  // Stable order: boards first, then loads, then other; by tag inside.
  const order = { board: 0, load: 1, other: 2 }
  rows.sort((a, b) => order[a.group] - order[b.group] || a.tag.localeCompare(b.tag))

  const counts = {
    all: rows.length,
    differences: rows.filter(r => !['matched', 'agrees'].includes(r.status)).length,
    boards: rows.filter(r => r.group === 'board').length,
    loads: rows.filter(r => r.group === 'load').length,
    other: rows.filter(r => r.group === 'other').length,
  }

  return {
    rows,
    counts,
    loadBoard: loadMeta.board ?? null,
    loadSection: loadMeta.section ?? null,
  }
}

