/**
 * 2D alignment view (step 4). One row per normalised tag; columns:
 * Tag (mono, sticky left) · SLD drawing · Equipment List · Load List ·
 * Result pill. Cells are rounded blocks with a dot; tones:
 * ok → success-soft · diff → danger-soft (differing value bold mono) ·
 * only → warning-soft · demolition → sunken · none → muted.
 * Chips: All tags · Differences only · Boards · Loads ({board}) with
 * counts from buildAlignment. Group headers sticky; rows windowed above
 * 300. The table scrolls inside its card — the page never scrolls
 * horizontally.
 */
import { useMemo, useRef, useState } from 'react'
import { Pill } from '../../../Process/PidChecker/shared'

const ROW_H = 44
const GROUP_H = 34
const VIRTUALISE_ABOVE = 300
const OVERSCAN = 12

const TONE_CLASS = {
  ok: 'sc-al-ok',
  diff: 'sc-al-diff',
  only: 'sc-al-only',
  demolition: 'sc-al-demo',
  none: 'sc-al-none',
}

function Cell({ cell }) {
  if (!cell) return <td />
  return (
    <td>
      <span className={`sc-al-cell ${TONE_CLASS[cell.tone] ?? 'sc-al-none'}`}>
        <span className="sc-al-dot" aria-hidden="true" />
        <span className={cell.tone === 'diff' ? 'pc-mono' : undefined} style={cell.tone === 'diff' ? { fontWeight: 700 } : undefined}>
          {cell.text ?? '—'}
        </span>
        {cell.sub && <span className="sc-al-sub pc-mono">{cell.sub}</span>}
      </span>
    </td>
  )
}

export default function AlignmentView({ alignment, docs, search = '', statusFilter = 'All', selectedTag = null, onSelect }) {
  const [chip, setChip] = useState('all') // all | differences | board | load
  const [scrollTop, setScrollTop] = useState(0)
  const boxRef = useRef(null)

  const rows = useMemo(() => {
    let out = alignment.rows
    if (chip === 'differences') out = out.filter(r => !['matched', 'agrees'].includes(r.status))
    if (chip === 'board') out = out.filter(r => r.group === 'board')
    if (chip === 'load') out = out.filter(r => r.group === 'load')
    if (statusFilter !== 'All') out = out.filter(r => r.status === statusFilter)
    if (search.trim()) {
      const needle = search.trim().toUpperCase().replace(/\s+/g, '')
      out = out.filter(r => r.tag.includes(needle))
    }
    return out
  }, [alignment, chip, statusFilter, search])

  // Flatten with group headers: Boards · Loads (Board {board} ({section})) · Other.
  const flat = useMemo(() => {
    const out = []
    const groups = [
      ['board', 'Boards'],
      ['load', alignment.loadBoard ? `Loads (Board ${alignment.loadBoard}${alignment.loadSection ? ` · ${alignment.loadSection}` : ''})` : 'Loads'],
      ['other', 'Other'],
    ]
    for (const [key, label] of groups) {
      const members = rows.filter(r => r.group === key)
      if (members.length === 0) continue
      out.push({ kind: 'group', key, label, count: members.length })
      for (const r of members) out.push({ kind: 'row', row: r })
    }
    return out
  }, [rows, alignment])

  const chips = [
    ['all', `All tags ${alignment.counts.all}`],
    ['differences', `Differences only ${alignment.counts.differences}`],
    ['board', `Boards ${alignment.counts.boards}`],
    ['load', `Loads${alignment.loadBoard ? ` (${alignment.loadBoard})` : ''} ${alignment.counts.loads}`],
  ]

  // Windowing above 300 rows.
  const virtual = flat.length > VIRTUALISE_ABOVE
  const viewH = boxRef.current?.clientHeight ?? 520
  const itemH = i => (flat[i]?.kind === 'group' ? GROUP_H : ROW_H)
  let start = 0; let end = flat.length; let padTop = 0; let padBottom = 0
  if (virtual) {
    let y = 0
    const heights = flat.map((_, i) => itemH(i))
    start = heights.findIndex(h => (y += h) > scrollTop) 
    if (start < 0) start = flat.length - 1
    start = Math.max(0, start - OVERSCAN)
    let acc = 0
    for (let i = 0; i < start; i++) acc += heights[i]
    padTop = acc
    let y2 = acc
    end = start
    while (end < flat.length && y2 < scrollTop + viewH + OVERSCAN * ROW_H) { y2 += heights[end]; end++ }
    padBottom = heights.slice(end).reduce((a, b) => a + b, 0)
  }
  const visible = virtual ? flat.slice(start, end) : flat

  return (
    <div>
      <div className="pc-chips" role="group" aria-label="Alignment filter" style={{ padding: '0.5rem 1rem 0' }}>
        {chips.map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`pc-chip${chip === id ? ' pc-chip-active' : ''}`}
            style={{ minHeight: 30 }}
            aria-pressed={chip === id}
            onClick={() => setChip(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <div
        ref={boxRef}
        className="sc-al-scroll"
        onScroll={e => virtual && setScrollTop(e.target.scrollTop)}
      >
        <table className="pc-table sc-al-table">
          <thead>
            <tr>
              <th className="sc-al-tagcol">Tag</th>
              <th>SLD drawing{docs.sld ? ` (${docs.sld})` : ''}</th>
              <th>Equipment List{docs.el ? ` (${docs.el})` : ''}</th>
              <th>Load List{docs.ll ? ` (${docs.ll})` : ''}</th>
              <th>Result</th>
            </tr>
          </thead>
          <tbody>
            {virtual && padTop > 0 && <tr aria-hidden="true"><td colSpan={5} style={{ height: padTop, padding: 0, border: 0 }} /></tr>}
            {visible.map((item, i) => item.kind === 'group' ? (
              <tr key={`g-${item.key}`}>
                <td colSpan={5} className="sc-al-group">{item.label} <span className="pc-faint">({item.count})</span></td>
              </tr>
            ) : (
              <tr
                key={item.row.tag}
                className={`pc-row-clickable${item.row.tag === selectedTag ? ' pc-row-selected' : ''}`}
                style={item.row.tag === selectedTag ? { background: 'var(--rd-primary-soft)' } : undefined}
                onClick={() => onSelect?.(item.row)}
              >
                <td className="pc-mono sc-al-tagcol">{item.row.tag}</td>
                <Cell cell={item.row.sld} />
                <Cell cell={item.row.el} />
                <Cell cell={item.row.ll} />
                <td><Pill label={item.row.statusLabel} /></td>
              </tr>
            ))}
            {virtual && padBottom > 0 && <tr aria-hidden="true"><td colSpan={5} style={{ height: padBottom, padding: 0, border: 0 }} /></tr>}
          </tbody>
        </table>
        {flat.length === 0 && (
          <p className="pc-empty-text" style={{ padding: '1.5rem' }}>No tags match these filters.</p>
        )}
      </div>

      <p className="sc-al-legend" aria-label="Legend">
        <span className="sc-al-cell sc-al-ok"><span className="sc-al-dot" />Matches</span>
        <span className="sc-al-cell sc-al-diff"><span className="sc-al-dot" />Differs</span>
        <span className="sc-al-cell sc-al-only"><span className="sc-al-dot" />On this document only</span>
        <span className="sc-al-cell sc-al-demo"><span className="sc-al-dot" />Demolition</span>
        <span className="sc-al-cell sc-al-none"><span className="sc-al-dot" />Not present</span>
      </p>
    </div>
  )
}
