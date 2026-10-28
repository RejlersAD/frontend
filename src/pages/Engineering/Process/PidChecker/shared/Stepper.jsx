/**
 * Stepper (spec §1): steps with live status text under each label.
 * States: current (blue ring) · done (green) · warning (amber) · to-do (grey).
 * Every step clickable; left/right arrow keys move between steps.
 */
import { useRef } from 'react'

export default function Stepper({ steps = [], current = 0, onSelect }) {
  const listRef = useRef(null)

  const onKeyDown = (event, index) => {
    let next = null
    if (event.key === 'ArrowRight') next = Math.min(index + 1, steps.length - 1)
    if (event.key === 'ArrowLeft') next = Math.max(index - 1, 0)
    if (next !== null) {
      event.preventDefault()
      const buttons = listRef.current?.querySelectorAll('.pc-step')
      buttons?.[next]?.focus()
      onSelect?.(next)
    }
  }

  return (
    <ol className="pc-stepper" ref={listRef} aria-label="Progress">
      {steps.map((step, i) => {
        const state = i === current ? 'current' : (step.state || 'todo')
        return (
          <li key={step.id ?? i} style={{ display: 'contents' }}>
            <button
              type="button"
              className={`pc-step pc-step-${state}`}
              aria-current={i === current ? 'step' : undefined}
              onClick={() => onSelect?.(i)}
              onKeyDown={e => onKeyDown(e, i)}
            >
              <span className="pc-step-dot" aria-hidden="true">{i + 1}</span>
              <span className="pc-step-label">{step.label}</span>
              {step.statusText && <span className="pc-step-status">{step.statusText}</span>}
            </button>
          </li>
        )
      })}
    </ol>
  )
}
