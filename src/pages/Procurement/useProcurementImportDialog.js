import { useLayoutEffect, useRef, useState } from 'react';

const DEFAULT_WIDTH = 1160;
const MIN_WIDTH = 760;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/** Keep the body portal above other dialogs, but inside the visible app main. */
export default function useProcurementImportDialog(isOpen) {
  const [bounds, setBounds] = useState(null);
  const [preferredWidth, setPreferredWidth] = useState(DEFAULT_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const dragRef = useRef(null);

  useLayoutEffect(() => {
    if (!isOpen) return undefined;
    const main = document.querySelector('#application-content > main.main-content') || document.querySelector('main');
    const viewport = window.visualViewport;
    const measure = () => {
      const visibleLeft = viewport?.offsetLeft || 0;
      const visibleTop = viewport?.offsetTop || 0;
      const visibleRight = visibleLeft + (viewport?.width || window.innerWidth);
      const visibleBottom = visibleTop + (viewport?.height || window.innerHeight);
      const rect = main?.getBoundingClientRect();
      const left = Math.max(visibleLeft, rect?.left ?? visibleLeft);
      const top = Math.max(visibleTop, rect?.top ?? visibleTop);
      const next = {
        left, top,
        width: Math.max(0, Math.min(visibleRight, rect?.right ?? visibleRight) - left),
        height: Math.max(0, Math.min(visibleBottom, rect?.bottom ?? visibleBottom) - top),
      };
      setBounds(current => current && Object.keys(next).every(key => current[key] === next[key]) ? current : next);
    };
    measure();
    setPreferredWidth(DEFAULT_WIDTH);
    setIsResizing(false);
    const observer = new ResizeObserver(measure);
    const stopDragging = () => {
      dragRef.current = null;
      setIsResizing(false);
    };
    if (main) observer.observe(main);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure);
    window.addEventListener('blur', stopDragging);
    viewport?.addEventListener('resize', measure);
    viewport?.addEventListener('scroll', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure);
      window.removeEventListener('blur', stopDragging);
      viewport?.removeEventListener('resize', measure);
      viewport?.removeEventListener('scroll', measure);
      dragRef.current = null;
    };
  }, [isOpen]);

  const gutter = bounds && bounds.width <= MIN_WIDTH ? 8 : 16;
  const maxWidth = Math.max(0, Math.floor((bounds?.width || 0) - gutter * 2));
  const minWidth = Math.min(MIN_WIDTH, maxWidth);
  const width = clamp(preferredWidth, minWidth, maxWidth);
  const canResize = maxWidth > minWidth;
  useLayoutEffect(() => {
    if (!isOpen || !canResize) {
      dragRef.current = null;
      setIsResizing(false);
    }
  }, [isOpen, canResize]);
  const finishResize = () => {
    dragRef.current = null;
    setIsResizing(false);
  };

  const resizeHandleProps = edge => ({
    role: 'separator',
    tabIndex: 0,
    'aria-label': `Resize upload window from ${edge}`,
    'aria-orientation': 'vertical',
    'aria-valuemin': minWidth,
    'aria-valuemax': maxWidth,
    'aria-valuenow': Math.round(width),
    'aria-valuetext': `Window width ${Math.round(width)} pixels`,
    title: 'Drag to resize. Use arrow keys, Home for minimum width, or End for maximum width.',
    onPointerDown: event => {
      if (event.button !== 0 || !canResize) return;
      event.preventDefault();
      event.currentTarget.focus({ preventScroll: true });
      event.currentTarget.setPointerCapture(event.pointerId);
      dragRef.current = { pointerId: event.pointerId, x: event.clientX, width, direction: edge === 'left' ? -1 : 1 };
      setIsResizing(true);
    },
    onPointerMove: event => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      setPreferredWidth(clamp(drag.width + (event.clientX - drag.x) * 2 * drag.direction, minWidth, maxWidth));
    },
    onPointerUp: finishResize,
    onPointerCancel: finishResize,
    onLostPointerCapture: finishResize,
    onKeyDown: event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      event.stopPropagation();
      const direction = (event.key === 'ArrowRight' ? 1 : -1) * (edge === 'left' ? -1 : 1);
      const next = event.key === 'Home' ? minWidth : event.key === 'End' ? maxWidth : width + direction * (event.shiftKey ? 64 : 32);
      setPreferredWidth(clamp(next, minWidth, maxWidth));
    },
  });

  return {
    boundaryStyle: bounds ? { ...bounds, padding: gutter } : { visibility: 'hidden' },
    width, canResize, isResizing, isReady: Boolean(bounds), resizeHandleProps,
  };
}
