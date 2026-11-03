/**
 * Comparison overview — the project's inputs drawn as an SLD
 * (330px, full width, recomputed on resize).
 *
 * Incomers: SLD (SLD drawing) · EL (Equipment List) · LL (Load List) ·
 * AI (RADAI AI Engine) · LG (Electrical legend). Each feeds one
 * "RADAI COMPARISON BUS" through a breaker; the bus feeds one outgoing
 * feeder per comparison tab of the LATEST analysis.
 *
 * Breaker states: provided/complete → closed green · key missing/untested
 * → amber 'connect key' · legend needs-recheck → amber 're-check' ·
 * file missing → open breaker, dashed line, 'upload' ·
 * 'Not needed — no SLD uploaded' → grey 'not needed'.
 *
 * Feeder colour: red when conflicts/drafting > 0 · amber when
 * matched < total · green otherwise · grey dashed with value '—' and
 * sub 'needs {input}' when a needed input is missing.
 * Rendered as <button>s over an SVG wire layer: Tab reaches all,
 * Enter activates, SVG carries a <title>.
 */
import { useEffect, useMemo, useRef, useState } from 'react'

const H = 330
const INCOMER_W = 96
const INCOMER_H = 34
const INCOMER_Y = 12
const BREAKER_W = 16
const BREAKER_H = 22
const BUS_Y = 148
const FEEDER_W = 150
const FEEDER_H = 92
const FEEDER_Y = 214
const MIN_WIDTH = 980

const INCOMER_COLORS = {
  sld: 'var(--rd-primary)',
  el: 'var(--rd-info)',
  ll: 'var(--rd-success)',
  ai: 'var(--rd-ai, var(--rd-accent))',
  lg: 'var(--rd-warning)',
}

const centers = (count, width, boxW) => {
  if (count === 0) return []
  const margin = boxW / 2 + 10
  const usable = Math.max(width - margin * 2, 1)
  return Array.from({ length: count }, (_, i) => margin + (usable * (count === 1 ? 0.5 : i / (count - 1))))
}

function breakerStyle(status) {
  switch (status?.state) {
    case 'closed': return { fill: 'var(--rd-success)', stroke: 'var(--rd-success)', open: false, label: null }
    case 'connect': return { fill: 'var(--rd-warning)', stroke: 'var(--rd-warning)', open: false, label: 'connect key' }
    case 'recheck': return { fill: 'var(--rd-warning)', stroke: 'var(--rd-warning)', open: false, label: 're-check' }
    case 'not-needed': return { fill: 'transparent', stroke: 'var(--rd-text-faint)', open: true, label: 'not needed' }
    default: return { fill: 'transparent', stroke: 'var(--rd-danger)', open: true, label: 'upload' } // missing
  }
}

export default function ComparisonSld({ incomers, feeders, busLabel, onIncomer, onFeeder }) {
  const wrapRef = useRef(null)
  const [width, setWidth] = useState(MIN_WIDTH)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return undefined
    const update = () => setWidth(el.clientWidth)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const w = Math.max(width, MIN_WIDTH)
  const inX = useMemo(() => centers(incomers.length, w, INCOMER_W), [incomers.length, w])
  const fdX = useMemo(() => centers(feeders.length, w, FEEDER_W), [feeders.length, w])

  return (
    <div ref={wrapRef} className="sc-csld">
      <div className="sc-csld-scroll">
        <div style={{ position: 'relative', width: w, height: H }}>
          <svg width={w} height={H} role="img" style={{ position: 'absolute', inset: 0 }}>
            <title>Comparison inputs as a single line diagram</title>
            {incomers.map((inc, i) => {
              const b = breakerStyle(inc.status)
              const x = inX[i]
              const dashed = inc.status?.state === 'missing' || inc.status?.state === 'not-needed'
              return (
                <g key={inc.id}>
                  <line x1={x} y1={INCOMER_Y + INCOMER_H} x2={x} y2={BUS_Y} stroke={b.stroke} strokeWidth="2" strokeDasharray={dashed ? '5 4' : undefined} />
                  {b.open ? (
                    <g>
                      <line x1={x} y1={BUS_Y - 52} x2={x + 10} y2={BUS_Y - 34} stroke={b.stroke} strokeWidth="2" />
                      <rect x={x - BREAKER_W / 2} y={BUS_Y - 56} width={BREAKER_W} height={BREAKER_H} fill="none" stroke={b.stroke} strokeWidth="2" />
                    </g>
                  ) : (
                    <rect x={x - BREAKER_W / 2} y={BUS_Y - 56} width={BREAKER_W} height={BREAKER_H} fill={b.fill} stroke={b.stroke} strokeWidth="2" />
                  )}
                  {b.label && (
                    <text x={x + 12} y={BUS_Y - 40} fontSize="11" fill={b.stroke}>{b.label}</text>
                  )}
                </g>
              )
            })}
            <rect x={16} y={BUS_Y} width={w - 32} height={8} fill="var(--rd-primary)" rx={2} />
            <rect x={w / 2 - 210} y={BUS_Y - 10} width={420} height={28} rx={4} fill="var(--rd-surface)" stroke="var(--rd-border)" />
            <text x={w / 2} y={BUS_Y + 8} textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--rd-text)">
              {busLabel}
            </text>
            {feeders.map((f, i) => (
              <g key={f.id}>
                <line x1={fdX[i]} y1={BUS_Y + 8} x2={fdX[i]} y2={FEEDER_Y - 8} stroke="var(--rd-border)" strokeWidth="2" />
                <polygon points={`${fdX[i] - 4},${FEEDER_Y - 8} ${fdX[i] + 4},${FEEDER_Y - 8} ${fdX[i]},${FEEDER_Y - 1}`} fill="var(--rd-border)" />
              </g>
            ))}
          </svg>

          {incomers.map((inc, i) => {
            const closed = inc.status?.state === 'closed'
            return (
              <button
                key={inc.id}
                type="button"
                className="sc-csld-incomer"
                style={{
                  left: inX[i] - INCOMER_W / 2, top: INCOMER_Y, width: INCOMER_W, height: INCOMER_H,
                  borderColor: closed ? INCOMER_COLORS[inc.id] : 'var(--rd-text-faint)',
                  borderStyle: closed ? 'solid' : 'dashed',
                }}
                aria-label={inc.ariaLabel}
                onClick={() => onIncomer?.(inc.id)}
              >
                <span className="sc-csld-code" style={{ color: closed ? INCOMER_COLORS[inc.id] : 'var(--rd-text-muted)' }}>{inc.code}</span>
                <span className="sc-csld-name">{inc.name}</span>
              </button>
            )
          })}

          {feeders.map((f, i) => {
            const border = { red: 'var(--rd-danger)', amber: 'var(--rd-warning)', green: 'var(--rd-success)', grey: 'var(--rd-text-faint)' }[f.tone]
            return (
              <button
                key={f.id}
                type="button"
                className="sc-csld-feeder"
                disabled={f.tone === 'grey'}
                style={{
                  left: fdX[i] - FEEDER_W / 2, top: FEEDER_Y, width: FEEDER_W, height: FEEDER_H,
                  borderColor: border,
                  borderStyle: f.tone === 'grey' ? 'dashed' : 'solid',
                }}
                aria-label={f.ariaLabel}
                onClick={() => onFeeder?.(f.id)}
              >
                <span className="sc-csld-fname">{f.name}</span>
                <span className="sc-csld-fvalue" style={f.tone === 'red' ? { color: 'var(--rd-danger)' } : undefined}>{f.value}</span>
                <span className="sc-csld-fsub">{f.sub}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
