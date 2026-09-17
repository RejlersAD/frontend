import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

let pdfLibrary;
const loadPdfLibrary = () => {
  if (!pdfLibrary) pdfLibrary = import('pdfjs-dist/build/pdf.mjs').then(library => {
    library.GlobalWorkerOptions.workerSrc = workerUrl;
    return library;
  }).catch(error => { pdfLibrary = null; throw error; });
  return pdfLibrary;
};

// Fit the current page, not the widest page in a mixed-size document. Only one
// page is rendered at a time, including when a source contains hundreds of pages.
function PdfPages({ url, title, actions }) {
  const viewportRef = useRef(null);
  const canvasHostRef = useRef(null);
  const [pdf, setPdf] = useState(null);
  const [width, setWidth] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageInput, setPageInput] = useState('1');
  const [zoom, setZoom] = useState(1);
  const [rendering, setRendering] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let disposed = false;
    let loadingTask;
    loadPdfLibrary().then(library => {
      if (disposed) return null;
      loadingTask = library.getDocument({ url, isEvalSupported: false, useSystemFonts: true });
      return loadingTask.promise;
    }).then(document => {
      if (!disposed && document) setPdf(document);
    }).catch(() => {
      if (!disposed) setError('This PDF could not be displayed. You can open the original PDF below.');
    });
    return () => {
      disposed = true;
      // Stop parsing and release the worker when a file is replaced or closed.
      if (loadingTask) void loadingTask.destroy().catch(() => {});
    };
  }, [url]);

  useEffect(() => {
    const element = viewportRef.current;
    const measure = () => setWidth(Math.max(0, element.clientWidth - 24));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!pdf || !width) return undefined;
    let disposed = false;
    let renderTask;
    const host = canvasHostRef.current;
    setRendering(true);
    setError('');
    host.replaceChildren();
    viewportRef.current.scrollTo(0, 0);
    pdf.getPage(pageNumber).then(page => {
      if (disposed) return;
      const natural = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: width / natural.width * zoom });
      // Bound raster memory for unusually large drawings while keeping the
      // page's CSS dimensions and aspect ratio independent of raster density.
      const density = Math.min(window.devicePixelRatio || 1, 2,
        8192 / viewport.width, 8192 / viewport.height,
        Math.sqrt(16000000 / (viewport.width * viewport.height)));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.ceil(viewport.width * density));
      canvas.height = Math.max(1, Math.ceil(viewport.height * density));
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      canvas.style.display = 'block';
      canvas.style.margin = '0 auto';
      canvas.setAttribute('role', 'img');
      canvas.setAttribute('aria-label', `${title}, page ${pageNumber} of ${pdf.numPages}`);
      // Each render owns its canvas, so cancellation never races with a new
      // page or a resized viewport rendering into the same canvas.
      renderTask = page.render({ canvasContext: canvas.getContext('2d'), viewport,
        transform: [density, 0, 0, density, 0, 0] });
      return renderTask.promise.then(() => {
        if (!disposed) {
          host.replaceChildren(canvas);
          setRendering(false);
        }
      });
    }).catch(renderError => {
      if (!disposed && renderError.name !== 'RenderingCancelledException') {
        setError('This page could not be displayed. You can open the original PDF below.');
        setRendering(false);
      }
    });
    return () => {
      disposed = true;
      renderTask?.cancel();
      host.replaceChildren();
    };
  }, [pdf, width, pageNumber, zoom, title]);

  const goToPage = value => {
    const parsed = Number(value);
    const next = Number.isFinite(parsed) ? Math.max(1, Math.min(pdf?.numPages || 1, Math.trunc(parsed))) : pageNumber;
    setPageNumber(next);
    setPageInput(String(next));
    if (next !== pageNumber) setZoom(1);
  };
  const controlClass = 'rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-800 hover:bg-gray-100 disabled:cursor-default disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600';

  return <>
    <div className="flex w-full shrink-0 flex-wrap items-center justify-between gap-2 border-b border-gray-300 bg-gray-50 p-2" role="group" aria-label="PDF controls">
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
      <button type="button" className={controlClass} aria-label="Previous page" disabled={!pdf || pageNumber <= 1} onClick={() => goToPage(pageNumber - 1)}>‹</button>
      <label className="flex items-center gap-1 text-xs text-gray-700">Page
        <input type="number" aria-label="Page number" min="1" max={pdf?.numPages || 1} value={pageInput} disabled={!pdf}
          onChange={event => setPageInput(event.target.value)} onBlur={() => goToPage(pageInput)}
          onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); goToPage(pageInput); } }}
          className="w-14 rounded border border-gray-300 bg-white px-1 py-1 text-center text-gray-900" />
        <span>of {pdf?.numPages || '…'}</span>
      </label>
      <button type="button" className={controlClass} aria-label="Next page" disabled={!pdf || pageNumber >= pdf.numPages} onClick={() => goToPage(pageNumber + 1)}>›</button>
      <button type="button" className={controlClass} aria-label="Zoom out" disabled={!pdf || zoom <= 0.5} onClick={() => setZoom(value => Math.max(0.5, value - 0.25))}>−</button>
      <button type="button" className={controlClass} onClick={() => setZoom(1)} disabled={!pdf}>Fit width</button>
      <button type="button" className={controlClass} aria-label="Zoom in" disabled={!pdf || zoom >= 3} onClick={() => setZoom(value => Math.min(3, value + 0.25))}>+</button>
      </div>
      {actions && <div className="ml-auto flex shrink-0 items-center gap-1.5">{actions}</div>}
      <span className="sr-only" aria-label="PDF pages" aria-live="polite">Page {pageNumber} of {pdf?.numPages || '…'}</span>
    </div>
    <div ref={viewportRef} className="relative min-h-0 min-w-0 flex-1 overflow-auto bg-gray-700 p-3" style={{ scrollbarGutter: 'stable' }} aria-busy={!error && rendering}>
      {!error && rendering && <p role="status" className="p-4 text-center text-sm text-white">Loading PDF page…</p>}
      {error && <div role="alert" className="rounded bg-white p-4 text-sm text-gray-800">
        <p>{error}</p><a href={url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-indigo-700 underline">Open original PDF</a>
      </div>}
      <div ref={canvasHostRef} />
    </div>
  </>;
}

export default function PdfDocumentPreview({ url, title, actions, className = '' }) {
  return <section role="region" aria-label={title} className={`flex h-full w-full min-h-0 min-w-0 flex-col overflow-hidden ${className}`}>
    <PdfPages key={url} url={url} title={title} actions={actions} />
  </section>;
}

PdfPages.propTypes = { url: PropTypes.string.isRequired, title: PropTypes.string.isRequired, actions: PropTypes.node };
PdfDocumentPreview.propTypes = { ...PdfPages.propTypes, className: PropTypes.string };
