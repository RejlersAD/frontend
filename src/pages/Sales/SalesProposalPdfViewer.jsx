import React, { useEffect, useId, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { FileText, List } from 'lucide-react';
import { loadPdfLibrary } from '../../components/Common/pdfDocumentLibrary';
import {
  clampPdfPage, clampPdfZoom, flattenPdfOutline, MAX_SELECTION_TEXT,
  normalizePdfSelection, pdfRasterDensity, resolvePdfOutlinePage, validPdfAnchorRects,
} from './salesProposalPdfHelpers';
import './SalesProposalPdfViewer.css';

const THUMBNAIL_HEIGHT = 216;
const EMPTY_THREADS = [];

function PdfThumbnail({ pdf, pageNumber, selected, onSelect }) {
  const canvasHost = useRef(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let disposed = false;
    let rendering;
    let pageProxy;
    const host = canvasHost.current;
    setFailed(false);
    pdf.getPage(pageNumber).then(page => {
      pageProxy = page;
      if (disposed) { page.cleanup(); return; }
      const natural = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: Math.min(132 / natural.width, 174 / natural.height) });
      const density = Math.min(window.devicePixelRatio || 1, 2);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.ceil(viewport.width * density));
      canvas.height = Math.max(1, Math.ceil(viewport.height * density));
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      canvas.setAttribute('aria-hidden', 'true');
      rendering = page.render({ canvasContext: canvas.getContext('2d'), viewport, transform: [density, 0, 0, density, 0, 0] });
      return rendering.promise.then(() => { if (!disposed) host.replaceChildren(canvas); });
    }).catch(error => { if (!disposed && error.name !== 'RenderingCancelledException') setFailed(true); })
      .finally(() => pageProxy?.cleanup());
    return () => { disposed = true; rendering?.cancel(); host.replaceChildren(); pageProxy?.cleanup(); };
  }, [pdf, pageNumber]);
  return <button type="button" className={`sppdf-thumbnail${selected ? ' is-selected' : ''}`}
    aria-label={`Go to page ${pageNumber}`} aria-current={selected ? 'page' : undefined} onClick={() => onSelect(pageNumber)}>
    <span className="sppdf-thumbnail-paper" ref={canvasHost}>{failed && <FileText aria-hidden="true" size={28} />}</span>
    <span>Page {pageNumber}</span>
  </button>;
}

function PdfNavigation({ pdf, outline, pageNumber, onPageChange }) {
  const tabsId = useId();
  const [tab, setTab] = useState('pages');
  const [scrollTop, setScrollTop] = useState(0);
  const [height, setHeight] = useState(650);
  const [notice, setNotice] = useState('');
  const scrollRef = useRef(null);
  const activePdf = useRef(pdf);
  activePdf.current = pdf;
  useEffect(() => () => { activePdf.current = null; }, []);
  const start = Math.max(0, Math.floor(scrollTop / THUMBNAIL_HEIGHT) - 1);
  const end = Math.min(pdf?.numPages || 0, start + Math.min(16, Math.ceil(height / THUMBNAIL_HEIGHT) + 3));
  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return undefined;
    const measure = () => setHeight(element.clientHeight || 650);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [tab]);
  useEffect(() => {
    const element = scrollRef.current;
    if (!element || tab !== 'pages') return;
    const top = (pageNumber - 1) * THUMBNAIL_HEIGHT;
    if (top < element.scrollTop || top + THUMBNAIL_HEIGHT > element.scrollTop + element.clientHeight) {
      element.scrollTop = top;
      setScrollTop(element.scrollTop);
    }
  }, [pageNumber, tab]);
  const openOutline = async item => {
    setNotice('');
    try {
      const page = await resolvePdfOutlinePage(pdf, item.destination);
      if (activePdf.current !== pdf) return;
      if (page) onPageChange(page);
      else setNotice('This outline entry has no available page destination.');
    } catch { if (activePdf.current === pdf) setNotice('This outline entry could not be opened.'); }
  };
  return <aside className="sppdf-navigation" aria-label="PDF navigation">
    <div className="sppdf-tabs" role="tablist" aria-label="PDF navigation views">
      {[['pages', 'Pages', FileText], ['outline', 'Outline', List]].map(([key, label, Icon]) => <button key={key} type="button" role="tab"
        id={`${tabsId}-${key}`} aria-selected={tab === key} aria-controls={`${tabsId}-panel`} tabIndex={tab === key ? 0 : -1}
        onClick={() => { setTab(key); setScrollTop(0); }} onKeyDown={event => {
          if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
            event.preventDefault();
            const next = event.key === 'Home' ? 'pages' : event.key === 'End' ? 'outline' : tab === 'pages' ? 'outline' : 'pages';
            setTab(next); setScrollTop(0); document.getElementById(`${tabsId}-${next}`)?.focus();
          }
        }}><Icon size={16} aria-hidden="true" />{label}</button>)}
    </div>
    <div id={`${tabsId}-panel`} role="tabpanel" aria-labelledby={`${tabsId}-${tab}`} className="sppdf-navigation-scroll" ref={scrollRef}
      onScroll={event => { if (tab === 'pages') setScrollTop(event.currentTarget.scrollTop); }}>
      {!pdf ? <p className="sppdf-navigation-empty">Pages appear when the PDF is available.</p> : tab === 'pages'
        ? <div style={{ height: pdf.numPages * THUMBNAIL_HEIGHT, position: 'relative' }}>
          <div style={{ position: 'absolute', top: start * THUMBNAIL_HEIGHT, left: 0, right: 0 }}>
            {Array.from({ length: Math.max(0, end - start) }, (_, index) => start + index + 1).map(number => <PdfThumbnail key={number}
              pdf={pdf} pageNumber={number} selected={number === pageNumber} onSelect={onPageChange} />)}
          </div>
        </div>
        : <div className="sppdf-outline">
          {!outline.length && <p className="sppdf-navigation-empty">This PDF has no outline.</p>}
          {outline.map(item => <button type="button" key={item.id} disabled={!item.destination} title={!item.destination ? 'No internal page destination' : item.title}
            style={{ paddingLeft: `${12 + Math.min(item.depth, 6) * 12}px` }} onClick={() => openOutline(item)}>{item.title}</button>)}
          {notice && <p role="status" className="sppdf-navigation-empty">{notice}</p>}
        </div>}
    </div>
    <div className="sppdf-page-count">{pdf ? `${pdf.numPages} page${pdf.numPages === 1 ? '' : 's'}` : 'PDF navigation'}</div>
  </aside>;
}

function PdfReviewDocument({ url, title, pageNumber, onPageChange, zoom, onZoomChange, threads, selectedThreadId, onThreadSelect, onSelection, onDocumentLoad, onError, ariaLabel }) {
  const [loaded, setLoaded] = useState(null);
  const [outline, setOutline] = useState([]);
  const [error, setError] = useState('');
  const [pageError, setPageError] = useState('');
  const [width, setWidth] = useState(0);
  const [paint, setPaint] = useState(null);
  const [rendering, setRendering] = useState(false);
  const hostRef = useRef(null);
  const stageRef = useRef(null);
  const paperRef = useRef(null);
  const lastSelectedThread = useRef(null);
  const callbacks = useRef({ onPageChange, onDocumentLoad, onError, onSelection });
  callbacks.current = { onPageChange, onDocumentLoad, onError, onSelection };
  const pdf = loaded?.document || null;
  const currentPage = clampPdfPage(pageNumber, pdf?.numPages);
  const currentZoom = clampPdfZoom(zoom);
  const currentPaint = paint?.pageNumber === currentPage && paint?.width === width && paint?.zoom === currentZoom ? paint : null;
  const pageThreads = threads.filter(thread => thread.page_number === currentPage);

  useEffect(() => {
    if (!url) return undefined;
    if (!url.startsWith('blob:')) {
      const message = 'The protected PDF content is unavailable. Reload the preview to try again.';
      setError(message); callbacks.current.onError?.(message);
      return undefined;
    }
    let disposed = false;
    let loadingTask;
    let passwordProtected = false;
    loadPdfLibrary().then(library => {
      if (disposed) return null;
      loadingTask = library.getDocument({ url, isEvalSupported: false, useSystemFonts: true, enableXfa: false });
      loadingTask.onPassword = () => {
        if (disposed) return;
        passwordProtected = true;
        const message = 'This PDF is password protected. Use an unlocked PDF to preview its content.';
        setError(message); callbacks.current.onError?.(message);
        void loadingTask.destroy().catch(() => {});
      };
      return loadingTask.promise.then(document => ({ library, document }));
    }).then(async result => {
      if (disposed || !result) return;
      setLoaded(result);
      let entries = [];
      try { entries = flattenPdfOutline(await result.document.getOutline()); } catch { /* A PDF may have no readable outline. */ }
      if (disposed) return;
      setOutline(entries);
      callbacks.current.onDocumentLoad?.({ numPages: result.document.numPages, outline: entries.map(({ id, title: text, depth, destination }) => ({ id, title: text, depth, hasDestination: Boolean(destination) })) });
    }).catch(problem => {
      if (disposed || passwordProtected || problem?.name === 'PasswordException') return;
      const message = 'This PDF could not be displayed. Reload the preview or choose another valid PDF.';
      setError(current => current || message); callbacks.current.onError?.(message);
    });
    return () => { disposed = true; if (loadingTask) void loadingTask.destroy().catch(() => {}); };
  }, [url]);

  useEffect(() => {
    const element = stageRef.current;
    const measure = () => setWidth(Math.max(0, element.clientWidth - 56));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (pdf && currentPage !== Number(pageNumber)) callbacks.current.onPageChange?.(currentPage);
  }, [pdf, currentPage, pageNumber]);

  useEffect(() => {
    if (!pdf || !width) return undefined;
    let disposed = false;
    let renderTask;
    let textLayer;
    let pageProxy;
    const host = hostRef.current;
    setRendering(true); setPageError('');
    pdf.getPage(currentPage).then(async page => {
      pageProxy = page;
      if (disposed) { page.cleanup(); return; }
      const natural = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: width / natural.width * currentZoom });
      const density = pdfRasterDensity(viewport.width, viewport.height, window.devicePixelRatio || 1);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.floor(viewport.width * density));
      canvas.height = Math.max(1, Math.floor(viewport.height * density));
      canvas.style.width = `${viewport.width}px`; canvas.style.height = `${viewport.height}px`;
      canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', `${title}, page ${currentPage} of ${pdf.numPages}`);
      const textContainer = document.createElement('div');
      textContainer.className = 'sppdf-text-layer';
      textContainer.style.setProperty('--total-scale-factor', viewport.scale * viewport.userUnit);
      textContainer.setAttribute('aria-label', `Selectable text for page ${currentPage}`);
      renderTask = page.render({ canvasContext: canvas.getContext('2d'), viewport, transform: [density, 0, 0, density, 0, 0] });
      textLayer = new loaded.library.TextLayer({ textContentSource: page.streamTextContent(), container: textContainer, viewport });
      // The preview remains useful for scanned/image-only PDFs. Text extraction
      // failure must not replace correctly rendered source pixels with an error.
      await Promise.all([renderTask.promise, textLayer.render().catch(() => {})]);
      if (disposed) return;
      host.replaceChildren(canvas, textContainer);
      setPaint({ pageNumber: currentPage, width, zoom: currentZoom, pageWidth: viewport.width, pageHeight: viewport.height });
      setRendering(false);
    }).catch(problem => {
      if (disposed || problem?.name === 'RenderingCancelledException') return;
      const message = 'This PDF page could not be displayed. Choose another page or reload the preview.';
      setPageError(message); setRendering(false); callbacks.current.onError?.(message);
    }).finally(() => pageProxy?.cleanup());
    return () => { disposed = true; renderTask?.cancel(); textLayer?.cancel(); pageProxy?.cleanup(); };
  }, [pdf, loaded, width, currentPage, currentZoom, title]);

  useEffect(() => { stageRef.current?.scrollTo(0, 0); }, [currentPage]);

  useEffect(() => {
    if (selectedThreadId == null) { lastSelectedThread.current = null; return; }
    if (lastSelectedThread.current?.pdf === pdf && lastSelectedThread.current?.id === selectedThreadId) return;
    const selected = threads.find(thread => String(thread.id) === String(selectedThreadId));
    if (!selected || !pdf) return;
    lastSelectedThread.current = { pdf, id: selectedThreadId };
    if (selected.page_number >= 1 && selected.page_number <= pdf.numPages && selected.page_number !== currentPage) {
      callbacks.current.onPageChange?.(selected.page_number);
    }
  }, [selectedThreadId, threads, pdf, currentPage]);

  useEffect(() => {
    if (!currentPaint || selectedThreadId == null) return;
    const pin = Array.from(paperRef.current?.querySelectorAll('[data-comment-id]') || [])
      .find(element => element.dataset.commentId === String(selectedThreadId));
    if (pin) {
      const stage = stageRef.current;
      const pinBounds = pin.getBoundingClientRect();
      const stageBounds = stage.getBoundingClientRect();
      if (pinBounds.top < stageBounds.top + 30 || pinBounds.bottom > stageBounds.bottom - 30) {
        stage.scrollTop += pinBounds.top - stageBounds.top - stage.clientHeight / 3;
      }
    }
  }, [currentPaint, selectedThreadId]);

  const captureSelection = () => {
    if (!currentPaint || !callbacks.current.onSelection) return;
    const selection = window.getSelection();
    const textLayer = hostRef.current?.querySelector('.sppdf-text-layer');
    if (!selection || selection.isCollapsed || !selection.rangeCount || !textLayer
      || !textLayer.contains(selection.anchorNode) || !textLayer.contains(selection.focusNode)) return;
    const quote = selection.toString().trim().slice(0, MAX_SELECTION_TEXT);
    if (!quote) return;
    const rectangles = normalizePdfSelection(selection.getRangeAt(0).getClientRects(), paperRef.current.getBoundingClientRect());
    if (rectangles.length) callbacks.current.onSelection({ page_number: currentPage, anchor: { rects: rectangles, quote } });
  };

  return <div className="sales-proposal-pdf-viewer" role="region" aria-label={ariaLabel}>
    <PdfNavigation pdf={pdf} outline={outline} pageNumber={currentPage} onPageChange={onPageChange} />
    <section className="sppdf-stage" ref={stageRef} aria-label="PDF page canvas" tabIndex={0}
      aria-busy={Boolean(url) && !error && (!pdf || rendering)} onKeyDown={event => {
        if (event.target !== event.currentTarget) return;
        if (['PageDown', 'PageUp'].includes(event.key) && pdf) {
          event.preventDefault(); onPageChange(clampPdfPage(currentPage + (event.key === 'PageDown' ? 1 : -1), pdf.numPages));
        } else if ((event.ctrlKey || event.metaKey) && ['+', '=', '-'].includes(event.key) && onZoomChange) {
          event.preventDefault(); onZoomChange(clampPdfZoom(currentZoom + (event.key === '-' ? -0.25 : 0.25)));
        }
      }}>
      {!url ? <div className="sppdf-state"><FileText size={36} aria-hidden="true" /><h2>No PDF linked</h2><p>Choose a proposal PDF to preview its pages and add comments.</p></div>
        : error ? <div className="sppdf-state" role="alert"><FileText size={32} aria-hidden="true" /><p>{error}</p></div>
          : <>
            {(!pdf || rendering) && <div className="sppdf-loading" role="status">{pdf ? 'Rendering PDF page…' : 'Loading PDF…'}</div>}
            {pageError && <div className="sppdf-page-error" role="alert">{pageError}</div>}
            <div ref={paperRef} className="sppdf-paper" data-page-number={currentPage}
              style={{ width: currentPaint?.pageWidth || 0, height: currentPaint?.pageHeight || 0, visibility: currentPaint && !pageError ? 'visible' : 'hidden' }}
              onPointerUp={captureSelection} onKeyUp={captureSelection}>
              <div className="sppdf-raster-host" ref={hostRef} />
              <div className="sppdf-annotations" role="group" aria-label={`Comments on page ${currentPage}`}>
                {pageThreads.map((thread, index) => {
                  const rectangles = validPdfAnchorRects(thread.anchor);
                  const first = rectangles[0];
                  const selected = String(thread.id) === String(selectedThreadId);
                  const number = threads.indexOf(thread) + 1;
                  const alternate = number % 2 === 0;
                  return <React.Fragment key={thread.id}>
                    {rectangles.map((rectangle, rectangleIndex) => <span key={rectangleIndex} aria-hidden="true"
                      className={`sppdf-highlight${alternate ? ' is-alternate' : ''}${selected ? ' is-selected' : ''}${thread.is_resolved ? ' is-resolved' : ''}`}
                      style={{ left: `${rectangle.x * 100}%`, top: `${rectangle.y * 100}%`, width: `${rectangle.width * 100}%`, height: `${rectangle.height * 100}%` }} />)}
                    <button type="button" className={`sppdf-comment-pin${alternate ? ' is-alternate' : ''}${selected ? ' is-selected' : ''}${thread.is_resolved ? ' is-resolved' : ''}`}
                      data-comment-id={String(thread.id)} aria-label={`Open comment ${number} on page ${currentPage}`} aria-pressed={selected}
                      style={{ left: 'calc(100% - 15px)', top: `${first ? first.y * 100 : Math.min(90, 3 + index * 5)}%` }}
                      onClick={() => onThreadSelect?.(thread.id)}><span>{number}</span></button>
                  </React.Fragment>;
                })}
              </div>
            </div>
            {currentPaint && !pageError && <div className="sppdf-page-caption">Page {currentPage} of {pdf?.numPages}</div>}
          </>}
    </section>
  </div>;
}

export default function SalesProposalPdfViewer({ url = '', documentKey, title = 'Proposal PDF', pageNumber = 1, onPageChange, zoom = 1, onZoomChange,
  threads = EMPTY_THREADS, selectedThreadId = null, onThreadSelect, onSelection, onDocumentLoad, onError, ariaLabel = 'Proposal PDF pages' }) {
  // A changed revision or protected Blob must never display the previous PDF,
  // even during the first render before effects clean up old worker tasks.
  return <PdfReviewDocument key={`${documentKey || ''}:${url}`} {...{ url, title, pageNumber, onPageChange, zoom, onZoomChange,
    threads, selectedThreadId, onThreadSelect, onSelection, onDocumentLoad, onError, ariaLabel }} />;
}

PdfThumbnail.propTypes = { pdf: PropTypes.object.isRequired, pageNumber: PropTypes.number.isRequired, selected: PropTypes.bool, onSelect: PropTypes.func.isRequired };
PdfNavigation.propTypes = { pdf: PropTypes.object, outline: PropTypes.array.isRequired, pageNumber: PropTypes.number.isRequired, onPageChange: PropTypes.func.isRequired };
PdfReviewDocument.propTypes = {
  url: PropTypes.string, title: PropTypes.string, ariaLabel: PropTypes.string, pageNumber: PropTypes.number, onPageChange: PropTypes.func.isRequired,
  zoom: PropTypes.number, onZoomChange: PropTypes.func, threads: PropTypes.array, selectedThreadId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onThreadSelect: PropTypes.func, onSelection: PropTypes.func, onDocumentLoad: PropTypes.func, onError: PropTypes.func,
};
SalesProposalPdfViewer.propTypes = { ...PdfReviewDocument.propTypes, documentKey: PropTypes.oneOfType([PropTypes.string, PropTypes.number]) };
