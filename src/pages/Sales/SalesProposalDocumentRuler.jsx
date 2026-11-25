import { useRef } from 'react';
import PropTypes from 'prop-types';

// Page geometry of the editor sheet at 100 % (A4 at 96 dpi, Rejlers body margins).
export const SHEET_WIDTH = 794;
export const SHEET_MARGIN = 72;
const TEXT_WIDTH = SHEET_WIDTH - SHEET_MARGIN * 2;
const PX_PER_PT = 96 / 72;
const PX_PER_CM = 96 / 2.54;
const STEP_PT = 7.087;            // 0.25 cm
const MAX_LEFT = 288;
const MIN_FIRST = -144;

const snap = (value) => Math.round(value / STEP_PT) * STEP_PT;
const round = (value) => Math.round(value * 10) / 10;

/**
 * Horizontal ruler for the paragraph at the cursor: the lower marker sets the left indent, the
 * upper marker the first-line indent (both in points, saved and reproduced in the PDF and Word file).
 */
export default function SalesProposalDocumentRuler({ zoom, left, first, disabled, onChange }) {
  const trackRef = useRef(null);
  const drag = useRef(null);
  const scale = PX_PER_PT * zoom;
  const ticks = Math.floor(TEXT_WIDTH / PX_PER_CM);

  const pointAt = (clientX) => {
    const box = trackRef.current.getBoundingClientRect();
    return snap((clientX - box.left) / scale);
  };
  const apply = (marker, value) => {
    if (marker === 'left') {
      const nextLeft = round(Math.min(MAX_LEFT, Math.max(0, value)));
      onChange(nextLeft, first);   // the first line keeps its offset from the left indent
    } else {
      onChange(left, round(Math.max(MIN_FIRST, Math.min(MAX_LEFT, value - left))));
    }
  };
  const start = (marker) => (event) => {
    if (disabled) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    drag.current = marker;
  };
  const move = (event) => { if (drag.current) apply(drag.current, pointAt(event.clientX)); };
  const end = () => { drag.current = null; };
  const keys = (marker) => (event) => {
    const delta = { ArrowLeft: -STEP_PT, ArrowRight: STEP_PT }[event.key];
    if (!delta || disabled) return;
    event.preventDefault();
    apply(marker, (marker === 'left' ? left : left + first) + delta);
  };
  const cm = (points) => `${(points / 28.3465).toFixed(2)} cm`;

  return (
    <div className={`spde-ruler${disabled ? ' is-disabled' : ''}`} style={{ width: SHEET_WIDTH * zoom }}
      title={disabled ? 'Place the cursor in a paragraph or heading to set its indent. Lists and tables use the template indent.' : undefined}>
      <div className="spde-ruler-track" ref={trackRef} style={{ left: SHEET_MARGIN * zoom, width: TEXT_WIDTH * zoom }}
        onPointerMove={move} onPointerUp={end} onPointerCancel={end}>
        {Array.from({ length: ticks + 1 }, (_, index) => (
          <span key={index} className="spde-ruler-tick" style={{ left: index * PX_PER_CM * zoom }}>{index > 0 && index < ticks ? index : ''}</span>
        ))}
        <button type="button" role="slider" className="spde-ruler-marker spde-ruler-first" aria-label="First-line indent"
          aria-valuemin={MIN_FIRST} aria-valuemax={MAX_LEFT} aria-valuenow={first} aria-valuetext={cm(first)} disabled={disabled}
          style={{ left: (left + first) * scale }} onPointerDown={start('first')} onKeyDown={keys('first')} />
        <button type="button" role="slider" className="spde-ruler-marker spde-ruler-left" aria-label="Left indent"
          aria-valuemin={0} aria-valuemax={MAX_LEFT} aria-valuenow={left} aria-valuetext={cm(left)} disabled={disabled}
          style={{ left: left * scale }} onPointerDown={start('left')} onKeyDown={keys('left')} />
      </div>
    </div>
  );
}

SalesProposalDocumentRuler.propTypes = {
  zoom: PropTypes.number.isRequired,
  left: PropTypes.number.isRequired,
  first: PropTypes.number.isRequired,
  disabled: PropTypes.bool,
  onChange: PropTypes.func.isRequired,
};
