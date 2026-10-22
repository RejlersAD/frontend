import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { BookOpen, ChevronLeft, ChevronRight, ExternalLink, FileText, Link2, Maximize2, Minus, Plus, AlertTriangle, Quote, RotateCw } from 'lucide-react';
import { loadPdfLibrary } from '../../../../components/Common/pdfDocumentLibrary';

export default function S3DEvidencePanel({ documentMeta, sourcePage, sourceReference, onActiveReferenceChange, quote, sourceLinked, onLinkSource }) {
  const host = useRef(null);
  const viewport = useRef(null);
  const panel = useRef(null);
  const [pdf, setPdf] = useState(null);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [width, setWidth] = useState(0);
  const [error, setError] = useState('');
  const [rendering, setRendering] = useState(false);
  const [displayedPage, setDisplayedPage] = useState(null);
  const [retry, setRetry] = useState(0);
  const url = documentMeta?.file_url || '';
  const total = pdf?.numPages || documentMeta?.total_pages || 0;
  const filename = documentMeta?.original_filename || 'Source document';
  useEffect(() => {
    if (!pdf || rendering || displayedPage !== page) { onActiveReferenceChange?.(null); return; }
    // Navigation to another page does not carry the previous table/box along.
    onActiveReferenceChange?.(sourceReference?.page === page ? sourceReference : { page });
  }, [page, sourcePage, sourceReference, onActiveReferenceChange, pdf, rendering, displayedPage]);

  useEffect(() => {
    setPdf(null); setError(''); setRendering(false); setDisplayedPage(null);
    if (!url) return undefined;
    let cancelled = false;
    let task;
    loadPdfLibrary().then(library => {
      if (cancelled) return null;
      task = library.getDocument({ url, isEvalSupported: false, useSystemFonts: true });
      return task.promise;
    }).then(document => { if (!cancelled && document) setPdf(document); }).catch(reason => {
      if (cancelled) return;
      const status = reason?.status;
      const message = status === 404 ? 'The source PDF was not found. Check that the source file is still available.'
        : status === 401 || status === 403 ? 'Source document access was denied. Sign in again or check your document access.'
          : reason?.name === 'InvalidPDFException' ? 'The source response is not a readable PDF. Open the original document to check it.'
            : 'The source PDF could not be loaded. Retry the preview or open the original document.';
      setError(message);
    });
    return () => { cancelled = true; if (task) void task.destroy().catch(() => {}); };
  }, [url, retry]);
  useEffect(() => {
    const value = Math.max(1, Number(sourcePage) || 1);
    setPage(total ? Math.min(value, total) : value);
    setZoom(1);
  }, [sourcePage, total]);
  useEffect(() => {
    const element = viewport.current;
    if (!element) return undefined;
    const observer = new ResizeObserver(() => setWidth(Math.max(100, element.clientWidth - 22)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!pdf || !width) return undefined;
    let cancelled = false;
    let task;
    setRendering(true);
    pdf.getPage(Math.min(page, pdf.numPages)).then(documentPage => {
      if (cancelled) return null;
      const natural = documentPage.getViewport({ scale: 1 });
      const view = documentPage.getViewport({ scale: width / natural.width * zoom });
      const density = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(16000000 / (view.width * view.height)));
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(view.width * density); canvas.height = Math.ceil(view.height * density);
      canvas.style.width = `${view.width}px`; canvas.style.height = `${view.height}px`;
      canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', `${filename}, page ${page}`);
      task = documentPage.render({ canvasContext: canvas.getContext('2d'), viewport: view, transform: [density, 0, 0, density, 0, 0] });
      return task.promise.then(() => {
        if (!cancelled && host.current) {
          const box = sourceReference?.page === page ? sourceReference.bbox : null;
          if (box?.length === 4 && box.every(Number.isFinite)) {
            const rect = sourceReference.coordinate_space === 'normalized'
              ? [box[0] * view.width, box[1] * view.height, box[2] * view.width, box[3] * view.height]
              : view.convertToViewportRectangle(box);
            const context = canvas.getContext('2d');
            context.save(); context.scale(density, density); context.strokeStyle = '#e99500'; context.fillStyle = '#ffbb3326'; context.lineWidth = 1.5;
            context.fillRect(Math.min(rect[0], rect[2]), Math.min(rect[1], rect[3]), Math.abs(rect[2] - rect[0]), Math.abs(rect[3] - rect[1]));
            context.strokeRect(Math.min(rect[0], rect[2]), Math.min(rect[1], rect[3]), Math.abs(rect[2] - rect[0]), Math.abs(rect[3] - rect[1])); context.restore();
          }
          host.current.replaceChildren(canvas); setDisplayedPage(page); setRendering(false); setError('');
        }
      });
    }).catch(reason => { if (!cancelled && reason.name !== 'RenderingCancelledException') { setRendering(false); setError('This source page could not be displayed.'); } });
    return () => { cancelled = true; task?.cancel(); };
  }, [pdf, width, page, zoom, filename, sourceReference]);
  const changePage = value => setPage(Math.max(1, Math.min(total || 1, Number(value) || 1)));
  const openSource = () => { if (url) window.open(`${url}#page=${page}`, '_blank', 'noopener,noreferrer'); };

  return <section className="s3d-evidence s3d-panel" ref={panel} aria-label="Evidence panel">
    <div className="s3d-panel-heading"><h2>Evidence Panel</h2><button type="button" className="s3d-document-picker" onClick={openSource} disabled={!url} title={filename}><FileText /><span>{filename}</span><ChevronRight className="s3d-rotate-down" /></button></div>
    <div className="s3d-pdf-toolbar" role="group" aria-label="Source PDF controls">
      <div className="s3d-page-control"><span>Page</span><button className="s3d-icon-button s3d-previous-page" type="button" aria-label="Previous source page" disabled={!pdf || page <= 1} onClick={() => changePage(page - 1)}><ChevronLeft /></button>
        <label>Page <input aria-label="Source page" type="number" min="1" max={total || 1} value={page} disabled={!pdf} onChange={event => changePage(event.target.value)} /></label><span>/ {total || '—'}</span>
        <button type="button" className="s3d-icon-button" aria-label="Next source page" disabled={!pdf || page >= total} onClick={() => changePage(page + 1)}><ChevronRight /></button></div>
      <div className="s3d-zoom-control"><button type="button" className="s3d-icon-button" aria-label="Zoom out source" disabled={!pdf || zoom <= 0.5} onClick={() => setZoom(value => Math.max(0.5, value - 0.1))}><Minus /></button><span>{Math.round(zoom * 100)}%</span><button type="button" className="s3d-icon-button" aria-label="Zoom in source" disabled={!pdf || zoom >= 2} onClick={() => setZoom(value => Math.min(2, value + 0.1))}><Plus /></button></div>
      <button type="button" className="s3d-icon-button" aria-label="Expand evidence panel" onClick={() => panel.current?.requestFullscreen?.().catch(() => {})}><Maximize2 /></button>
      <button type="button" className="s3d-icon-button" aria-label="Open original source" disabled={!url} onClick={openSource}><ExternalLink /></button>
    </div>
    <div className="s3d-pdf-viewport" ref={viewport} aria-busy={Boolean(url && !pdf && !error) || rendering}>
      {!url ? <div className="s3d-source-empty"><FileText /><h3>Source preview unavailable</h3><p>A source document URL has not been provided for this extraction.</p><button type="button" className="s3d-text-button" onClick={onLinkSource}><Link2 /> Link source</button></div>
        : error ? <div className="s3d-source-empty" role="alert"><AlertTriangle /><p>{error}</p><button type="button" className="s3d-text-button" onClick={() => setRetry(value => value + 1)}><RotateCw />Retry source preview</button><button type="button" className="s3d-text-button" onClick={openSource}>Open original document <ExternalLink /></button></div> : <>
          {(!pdf || rendering) && <span className="s3d-pdf-loading" role="status">Loading source page…</span>}<div className="s3d-pdf-canvas" ref={host} />
        </>}
    </div>
    <div className="s3d-source-references"><div className="s3d-source-heading"><h3><BookOpen /> Source references</h3><button type="button" className="s3d-text-button" disabled={!url} onClick={openSource}>View in document <ExternalLink /></button></div>
      <p className="s3d-source-page">{pdf || sourcePage ? `Page ${pdf ? page : sourcePage}` : 'Source page not recorded'}{sourceReference?.page === page && sourceReference.table_id ? ` · Table ${sourceReference.table_id}` : ''}{sourceLinked ? ' · Linked extracted record' : ''}</p>
      {quote ? <blockquote aria-label="Extracted source text" title="Text recorded by extraction; verify it against the source document."><Quote /><span>{quote}</span></blockquote> : <p className="s3d-reference-empty">Select a record to review its available source evidence.</p>}
      <div className="s3d-source-bottom">{sourceLinked ? <span className="s3d-source-linked"><Link2 /> Source evidence linked</span> : <span className="s3d-badge s3d-badge--warning"><AlertTriangle /> Link source to preserve traceability</span>}<button type="button" className="s3d-text-button" onClick={onLinkSource}><Link2 /> Link source</button></div>
    </div>
  </section>;
}

S3DEvidencePanel.propTypes = { documentMeta: PropTypes.object, sourcePage: PropTypes.number, sourceReference: PropTypes.object, onActiveReferenceChange: PropTypes.func, quote: PropTypes.string, sourceLinked: PropTypes.bool, onLinkSource: PropTypes.func.isRequired };
