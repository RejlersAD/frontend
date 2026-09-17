import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { loadPdfLibrary } from './pdfDocumentLibrary';

const GAP = 16;
const initialAnchor = { page: 0, fraction: 0, horizontal: 0 };
const controlClass = 'rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-800 hover:bg-gray-100 disabled:cursor-default disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600';

function positionFor(layout, anchor) {
  const page = Math.min(anchor.page, layout.length - 1);
  return layout[page] ? layout[page].top + anchor.fraction * layout[page].height : 0;
}

// Only pages near the viewport own raster canvases. The remaining pages keep
// lightweight placeholders, with their dimensions refined as they are visited.
function PdfPageCanvas({ pdf, number, width, title, onRatio, onPaint, onError }) {
  const hostRef = useRef(null);
  useEffect(() => {
    let disposed = false;
    let renderTask;
    let page;
    let settled = false;
    pdf.getPage(number).then(async loadedPage => {
      page = loadedPage;
      if (disposed) return;
      const natural = page.getViewport({ scale: 1 });
      onRatio(number, natural.height / natural.width);
      const viewport = page.getViewport({ scale: width / natural.width });
      const density = Math.min(window.devicePixelRatio || 1, 2, 8192 / viewport.width,
        8192 / viewport.height, Math.sqrt(16000000 / (viewport.width * viewport.height)));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.ceil(viewport.width * density));
      canvas.height = Math.max(1, Math.ceil(viewport.height * density));
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      canvas.style.display = 'block';
      canvas.setAttribute('role', 'img');
      canvas.setAttribute('aria-label', `${title}, page ${number} of ${pdf.numPages}`);
      canvas.dataset.renderWidth = String(width);
      renderTask = page.render({ canvasContext: canvas.getContext('2d'), viewport,
        transform: [density, 0, 0, density, 0, 0] });
      await renderTask.promise;
      if (!disposed) {
        hostRef.current.replaceChildren(canvas);
        onPaint(number, width);
      }
    }).catch(error => {
      if (!disposed && error.name !== 'RenderingCancelledException') onError();
    }).finally(() => { settled = true; if (disposed) page?.cleanup(); });
    return () => {
      disposed = true;
      renderTask?.cancel();
      // A finished page can release its decoded resources when it leaves the
      // viewport; an in-flight page is cleaned after cancellation settles.
      if (settled) page?.cleanup();
    };
  }, [pdf, number, width, title, onRatio, onPaint, onError]);
  return <div ref={hostRef} />;
}

function PdfLayer({ document, width, height, zoom, anchor, readingAnchor, active, title, onLayout, onReady, onError }) {
  const layerRef = useRef(null);
  const [ratios, setRatios] = useState({ 1: document.ratio });
  const [painted, setPainted] = useState({});
  const pageWidth = width * zoom;
  const layout = useMemo(() => {
    let top = 0;
    return Array.from({ length: document.pdf.numPages }, (_, index) => {
      const page = { top, height: pageWidth * (ratios[index + 1] || document.ratio) };
      top += page.height + GAP;
      return page;
    });
  }, [document, pageWidth, ratios]);
  const top = positionFor(layout, anchor);
  const visible = layout.map((page, index) => ({ ...page, index }))
    .filter(page => page.top + page.height > top && page.top < top + height);
  const overscan = layout.map((page, index) => ({ ...page, index }))
    .filter(page => page.top + page.height > top - height / 2 && page.top < top + height * 1.5)
    .map(page => page.index);
  const nearby = new Set([...visible.map(page => page.index), ...overscan].slice(0, Math.max(8, visible.length)));
  const onRatio = useCallback((number, ratio) => setRatios(previous => previous[number] === ratio ? previous : { ...previous, [number]: ratio }), []);
  const onPaint = useCallback((number, renderedWidth) => setPainted(previous => ({ ...previous, [number]: renderedWidth })), []);
  const reportError = useCallback(() => onError(document.url, 'This page could not be displayed. You can open the original PDF below.'), [document.url, onError]);
  useLayoutEffect(() => { if (active) onLayout(layout, pageWidth); }, [active, layout, pageWidth, onLayout]);
  const ready = visible.length > 0 && visible.every(page => painted[page.index + 1] === pageWidth);
  useEffect(() => {
    // A scroll event can precede its throttled React update. Validate the latest
    // reading position before replacing the old raster or enabling downloads.
    const latestTop = positionFor(layout, readingAnchor.current);
    const needed = layout.map((page, index) => ({ ...page, index }))
      .filter(page => page.top + page.height > latestTop && page.top < latestTop + height);
    if (ready && needed.length && needed.every(page => layerRef.current.querySelector(`[data-pdf-page="${page.index + 1}"] canvas`)?.dataset.renderWidth === String(pageWidth))) onReady(document);
  }, [ready, document, onReady, pageWidth, layout, readingAnchor, height, painted, anchor]);

  return <div ref={layerRef} data-pdf-layer={active ? 'visible' : 'pending'} aria-hidden={!active || undefined}
    style={{ position: active ? 'relative' : 'absolute', top: 0, left: 0, visibility: active ? 'visible' : 'hidden', width: Math.max(width, pageWidth), overflowAnchor: 'none' }}>
    {layout.map((page, index) => <div key={index} data-pdf-page={index + 1}
      style={{ position: 'relative', width: pageWidth, height: page.height, margin: `0 auto ${GAP}px`, background: 'white', boxShadow: '0 1px 4px #0003' }}>
      {nearby.has(index) && <PdfPageCanvas pdf={document.pdf} number={index + 1} width={pageWidth} title={title} onRatio={onRatio} onPaint={onPaint} onError={reportError} />}
    </div>)}
  </div>;
}

export default function ContinuousPdfPreview({ url, title, actions, refreshing, onReady, onError }) {
  const viewportRef = useRef(null);
  const activeRef = useRef(null);
  const tasks = useRef(new Set());
  const callbacks = useRef({ onReady, onError });
  callbacks.current = { onReady, onError };
  const anchorRef = useRef(initialAnchor);
  const layoutRef = useRef({ pages: [], width: 1 });
  const frame = useRef(null);
  const [active, setActive] = useState(null);
  const [candidate, setCandidate] = useState(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [anchor, setAnchor] = useState(initialAnchor);
  const [zoom, setZoom] = useState(1);
  const [error, setError] = useState('');
  const currentUrl = useRef(url);
  currentUrl.current = url;

  const destroyTask = useCallback(task => {
    if (tasks.current.delete(task)) void task.destroy().catch(() => {});
  }, []);
  const reportError = useCallback((failedUrl, message) => {
    if (currentUrl.current !== failedUrl) return;
    setError(message);
    callbacks.current.onError?.(failedUrl, message);
  }, []);

  useEffect(() => {
    let disposed = false;
    let task;
    setError('');
    loadPdfLibrary().then(async library => {
      if (disposed) return;
      task = library.getDocument({ url, isEvalSupported: false, useSystemFonts: true });
      tasks.current.add(task);
      const pdf = await task.promise;
      const firstPage = await pdf.getPage(1);
      const natural = firstPage.getViewport({ scale: 1 });
      firstPage.cleanup();
      if (!disposed) setCandidate({ url, task, pdf, ratio: natural.height / natural.width });
    }).catch(() => { if (!disposed) reportError(url, 'This PDF could not be displayed. You can open the original PDF below.'); });
    return () => {
      disposed = true;
      if (task && activeRef.current?.task !== task) destroyTask(task);
    };
  }, [url, destroyTask, reportError]);

  useEffect(() => () => {
    window.cancelAnimationFrame(frame.current);
    for (const task of tasks.current) void task.destroy().catch(() => {});
    tasks.current.clear();
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    const measure = () => {
      // Hidden preview tabs retain their last layout and reading position.
      if (viewport.clientWidth && viewport.clientHeight) setSize({ width: Math.max(0, viewport.clientWidth - 24), height: viewport.clientHeight });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  const restoreLayout = useCallback((pages, width) => {
    layoutRef.current = { pages, width };
    const next = { ...anchorRef.current, page: Math.min(anchorRef.current.page, pages.length - 1) };
    anchorRef.current = next;
    setAnchor(next);
    viewportRef.current.scrollTo(next.horizontal * width, positionFor(pages, next));
  }, []);
  const readPosition = () => {
    const viewport = viewportRef.current;
    if (!viewport.clientWidth || !viewport.clientHeight) return;
    const { pages, width } = layoutRef.current;
    if (!pages.length) return;
    let index = pages.findIndex(page => page.top + page.height + GAP > viewport.scrollTop);
    if (index < 0) index = pages.length - 1;
    anchorRef.current = { page: index, fraction: Math.max(0, (viewport.scrollTop - pages[index].top) / pages[index].height), horizontal: viewport.scrollLeft / width };
    window.cancelAnimationFrame(frame.current);
    frame.current = window.requestAnimationFrame(() => setAnchor(anchorRef.current));
  };
  const layerReady = useCallback(document => {
    if (document.url !== currentUrl.current || activeRef.current === document) return;
    activeRef.current = document;
    setActive(document);
    callbacks.current.onReady?.(document.url);
  }, []);
  useEffect(() => {
    if (active) for (const task of tasks.current) if (task !== active.task && task !== candidate?.task) destroyTask(task);
  }, [active, candidate, destroyTask]);

  const layers = [active, candidate?.url === url && candidate !== active ? candidate : null].filter(Boolean);
  const busy = refreshing || active?.url !== url;
  const anchoredTop = positionFor(layoutRef.current.pages, anchor);
  const intersectingPage = layoutRef.current.pages.findIndex(page => page.top + page.height > anchoredTop);
  const currentPage = Math.min(Math.max(0, intersectingPage) + 1, active?.pdf.numPages || 1);
  return <>
    <div className="flex w-full shrink-0 flex-wrap items-center justify-between gap-2 border-b border-gray-300 bg-gray-50 p-2" role="group" aria-label="PDF controls">
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        <span className="px-1 text-xs text-gray-700" aria-label="PDF pages">Page {currentPage} of {active?.pdf.numPages || '…'}</span>
        <button type="button" className={controlClass} aria-label="Zoom out" disabled={!active || zoom <= 0.5} onClick={() => setZoom(value => Math.max(0.5, value - 0.25))}>−</button>
        <button type="button" className={controlClass} disabled={!active} onClick={() => setZoom(1)}>Fit width</button>
        <button type="button" className={controlClass} aria-label="Zoom in" disabled={!active || zoom >= 3} onClick={() => setZoom(value => Math.min(3, value + 0.25))}>+</button>
      </div>
      {actions && <div className="ml-auto flex shrink-0 items-center gap-1.5">{actions}</div>}
    </div>
    <div ref={viewportRef} role="region" aria-label={`${title} pages`} tabIndex={0} onScroll={readPosition}
      className="relative min-h-0 min-w-0 flex-1 overflow-auto bg-gray-700 p-3 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-indigo-500"
      style={{ scrollbarGutter: 'stable', overflowAnchor: 'none' }} aria-busy={!error && busy}>
      {!error && busy && <p role="status" className="pointer-events-none sticky top-0 z-10 m-0 h-0 overflow-visible text-center text-xs text-white"><span className="inline-block rounded bg-gray-800/90 px-3 py-2">{active ? 'Updating preview…' : 'Loading PDF pages…'}</span></p>}
      {error && <div role="alert" className="sticky top-0 z-10 rounded bg-white p-4 text-sm text-gray-800"><p>{error}</p><a href={url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-indigo-700 underline">Open original PDF</a></div>}
      <div style={{ position: 'relative' }}>
        {size.width > 0 && layers.map(document => <PdfLayer key={document.url} document={document} width={size.width} height={size.height} zoom={zoom} anchor={anchor} readingAnchor={anchorRef} active={document === active} title={title} onLayout={restoreLayout} onReady={layerReady} onError={reportError} />)}
      </div>
    </div>
  </>;
}

const documentType = PropTypes.shape({ url: PropTypes.string.isRequired, pdf: PropTypes.object.isRequired, ratio: PropTypes.number.isRequired });
PdfPageCanvas.propTypes = { pdf: PropTypes.object.isRequired, number: PropTypes.number.isRequired, width: PropTypes.number.isRequired, title: PropTypes.string.isRequired, onRatio: PropTypes.func.isRequired, onPaint: PropTypes.func.isRequired, onError: PropTypes.func.isRequired };
PdfLayer.propTypes = { document: documentType.isRequired, width: PropTypes.number.isRequired, height: PropTypes.number.isRequired, zoom: PropTypes.number.isRequired, anchor: PropTypes.object.isRequired, readingAnchor: PropTypes.object.isRequired, active: PropTypes.bool.isRequired, title: PropTypes.string.isRequired, onLayout: PropTypes.func.isRequired, onReady: PropTypes.func.isRequired, onError: PropTypes.func.isRequired };
ContinuousPdfPreview.propTypes = { url: PropTypes.string.isRequired, title: PropTypes.string.isRequired, actions: PropTypes.node, refreshing: PropTypes.bool, onReady: PropTypes.func, onError: PropTypes.func };
