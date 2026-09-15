import React, { useEffect, useId, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import {
  ArrowDownTrayIcon,
  ArrowRightIcon,
  ArrowsPointingInIcon,
  ArrowsPointingOutIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  MinusIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';
import PurchaseOrderLivePreview from './PurchaseOrderLivePreview';
import './PurchaseOrderPreviewPane.css';

// Keep the existing PO template's natural width so its typography and pagination
// are identical at every viewport size and in the downloaded document.
const PAPER_WIDTH = 560;
const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

export default function PurchaseOrderPreviewPane({ formData, vendor, files = [], issues = [], onIssueClick }) {
  const paneRef = useRef(null);
  const viewportRef = useRef(null);
  const documentRef = useRef(null);
  const documentTabRef = useRef(null);
  const validationTabRef = useRef(null);
  const instanceId = useId();
  const [tab, setTab] = useState('document');
  const [zoom, setZoom] = useState(1);
  const [fitWidth, setFitWidth] = useState(true);
  const [availableWidth, setAvailableWidth] = useState(PAPER_WIDTH);
  const [documentHeight, setDocumentHeight] = useState(792);
  const [pageCount, setPageCount] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [expanded, setExpanded] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState('');
  const scale = fitWidth ? clamp(availableWidth / PAPER_WIDTH, 0.2, 1.5) : zoom;
  const issueLabel = `${issues.length} required ${issues.length === 1 ? 'item' : 'items'} remaining`;

  const updateCurrentPage = () => {
    const viewport = viewportRef.current;
    const paper = documentRef.current;
    if (!viewport || !paper || !viewport.clientHeight) return;
    const edge = viewport.getBoundingClientRect().top + 48;
    const pages = Array.from(paper.querySelectorAll('.po-template-page'));
    const index = pages.findIndex((page) => page.getBoundingClientRect().bottom > edge);
    setCurrentPage(index < 0 ? Math.max(1, pages.length) : index + 1);
  };

  useEffect(() => {
    const viewport = viewportRef.current;
    const paper = documentRef.current;
    if (!viewport || !paper) return undefined;
    const updateSize = () => {
      if (viewport.clientWidth) setAvailableWidth(Math.max(112, viewport.clientWidth - 30));
      if (paper.offsetHeight) setDocumentHeight(paper.offsetHeight);
      setPageCount(Math.max(1, paper.querySelectorAll('.po-template-page').length));
      updateCurrentPage();
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(viewport);
    observer.observe(paper);
    return () => observer.disconnect();
  }, [formData, vendor, files]);

  useEffect(() => {
    updateCurrentPage();
  }, [scale, tab]);

  useEffect(() => {
    const onFullscreenChange = () => setExpanded(document.fullscreenElement === paneRef.current);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  const changeZoom = (amount) => {
    setZoom(clamp(Math.round((scale + amount) * 100) / 100, 0.2, 1.5));
    setFitWidth(false);
  };

  const toggleFullscreen = async () => {
    setDownloadError('');
    try {
      if (document.fullscreenElement === paneRef.current) await document.exitFullscreen();
      else if (paneRef.current?.requestFullscreen) await paneRef.current.requestFullscreen();
      else setDownloadError('Expanded preview is unavailable in this browser. Use the zoom controls to inspect the document.');
    } catch {
      setDownloadError('The browser could not expand the preview. Use the zoom controls to inspect the document.');
    }
  };

  const downloadPdf = async () => {
    if (!documentRef.current || downloading) return;
    setDownloading(true);
    setDownloadError('');
    let exportHost;
    try {
      // Export a stable local copy; this never creates, saves, or submits a PO.
      exportHost = document.createElement('div');
      exportHost.className = 'pop-preview pop-export-host';
      exportHost.setAttribute('aria-hidden', 'true');
      const copy = documentRef.current.cloneNode(true);
      copy.style.transform = 'none';
      exportHost.appendChild(copy);
      document.body.appendChild(exportHost);
      await document.fonts?.ready;
      await Promise.all(Array.from(copy.querySelectorAll('img')).map(async (image) => {
        if (image.decode) {
          try { await image.decode(); } catch { /* Preserve the document when an optional image is unavailable. */ }
        }
      }));
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas'), import('jspdf'),
      ]);
      const pages = Array.from(copy.querySelectorAll('.po-template-page'));
      if (!pages.length) throw new Error('No document pages are available.');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
      for (let index = 0; index < pages.length; index += 1) {
        // Each existing template page gets its own PDF page, including every
        // scope continuation, price summary, and attachment cover sheet.
        const canvas = await html2canvas(pages[index], {
          backgroundColor: '#ffffff',
          scale: 2,
          useCORS: true,
          logging: false,
          windowWidth: 1200,
          scrollX: 0,
          scrollY: 0,
        });
        if (index > 0) pdf.addPage();
        const width = pdf.internal.pageSize.getWidth();
        const height = pdf.internal.pageSize.getHeight();
        const ratio = Math.min(width / canvas.width, height / canvas.height);
        const imageWidth = canvas.width * ratio;
        const imageHeight = canvas.height * ratio;
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', (width - imageWidth) / 2, 0, imageWidth, imageHeight, undefined, 'FAST');
      }
      const reference = String(formData.po_number || 'Purchase-Order-Draft').replace(/[^A-Za-z0-9._-]+/g, '-');
      pdf.setProperties({ title: formData.po_number || 'Draft purchase order', subject: 'Purchase order form preview' });
      pdf.save(`${reference}.pdf`);
    } catch (error) {
      setDownloadError(`PDF download failed. ${error?.message || 'Please try again.'}`);
    } finally {
      exportHost?.remove();
      setDownloading(false);
    }
  };

  const onTabKeyDown = (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 'document' : event.key === 'End' ? 'validation' : tab === 'document' ? 'validation' : 'document';
    setTab(next);
    (next === 'document' ? documentTabRef : validationTabRef).current?.focus();
  };

  return (
    <aside className="pop-preview" ref={paneRef} aria-label="Live purchase order preview">
      <header className="pop-heading">
        <div className="pop-title-row">
          <h2>Purchase order preview</h2>
          <span className="pop-current"><span /> Up to date</span>
        </div>
        <div className="pop-toolbar" aria-label="Purchase order preview controls">
          <span className="pop-page-number">Page {Math.min(currentPage, pageCount)} of {pageCount}</span>
          <div className="pop-zoom-controls">
            <button type="button" aria-label="Zoom out preview" onClick={() => changeZoom(-0.1)} disabled={scale <= 0.2}><MinusIcon /></button>
            <output aria-label="Preview zoom">{Math.round(scale * 100)}%</output>
            <button type="button" aria-label="Zoom in preview" onClick={() => changeZoom(0.1)} disabled={scale >= 1.5}><PlusIcon /></button>
          </div>
          <button type="button" className="pop-tool" aria-pressed={fitWidth} onClick={() => setFitWidth(true)}>Fit width</button>
          <button type="button" className="pop-tool pop-icon-tool" aria-label={expanded ? 'Exit expanded preview' : 'Expand preview'} onClick={toggleFullscreen}>
            {expanded ? <ArrowsPointingInIcon /> : <ArrowsPointingOutIcon />}
          </button>
          <button type="button" className="pop-tool pop-download" disabled={downloading} onClick={downloadPdf}>
            <ArrowDownTrayIcon />{downloading ? 'Preparing PDF...' : 'Download PDF'}
          </button>
        </div>
      </header>
      <div className="pop-tabs" role="tablist" aria-label="Purchase order preview views" onKeyDown={onTabKeyDown}>
        <button type="button" ref={documentTabRef} role="tab" id={`${instanceId}-document-tab`} aria-controls={`${instanceId}-document-panel`} aria-selected={tab === 'document'} tabIndex={tab === 'document' ? 0 : -1} onClick={() => setTab('document')}>Document</button>
        <button type="button" ref={validationTabRef} role="tab" id={`${instanceId}-validation-tab`} aria-controls={`${instanceId}-validation-panel`} aria-selected={tab === 'validation'} tabIndex={tab === 'validation' ? 0 : -1} onClick={() => setTab('validation')}>Validation{issues.length > 0 && <span className="pop-issue-count">{issues.length}</span>}</button>
      </div>
      {downloadError && <div className="pop-error" role="alert">{downloadError}</div>}
      <div className="pop-document-viewport" ref={viewportRef} role="tabpanel" id={`${instanceId}-document-panel`} aria-labelledby={`${instanceId}-document-tab`} hidden={tab !== 'document'} tabIndex={0} onScroll={updateCurrentPage}>
        <div className="pop-paper-frame" style={{ width: PAPER_WIDTH * scale, height: documentHeight * scale }}>
          <div className="pop-document" ref={documentRef} style={{ transform: `scale(${scale})` }}>
            <PurchaseOrderLivePreview formData={formData} vendor={vendor} files={files} documentOnly />
          </div>
        </div>
      </div>
      <section className="pop-validation" role="tabpanel" id={`${instanceId}-validation-panel`} aria-labelledby={`${instanceId}-validation-tab`} hidden={tab !== 'validation'} tabIndex={0}>
        <h3>{issues.length ? 'Complete the required information' : 'Ready for review'}</h3>
        <p>{issues.length ? 'Select an item to return to the relevant form section.' : 'All required form fields are complete. Review the purchase order before saving.'}</p>
        {issues.length > 0 ? <ul>{issues.map((issue, index) => (
          <li key={`${issue.field || issue.step}-${index}`}>
            <button type="button" onClick={() => onIssueClick?.(issue)}><ExclamationCircleIcon /><span>{issue.message}</span><ArrowRightIcon /></button>
          </li>
        ))}</ul> : <div className="pop-validation-ready"><CheckCircleIcon /> Required information complete</div>}
      </section>
      <footer className={`pop-validation-bar${issues.length ? ' has-issues' : ' is-ready'}`}>
        {issues.length ? <ExclamationCircleIcon /> : <CheckCircleIcon />}
        <span aria-live="polite">{issues.length ? issueLabel : 'Required information complete'}</span>
        <button type="button" onClick={() => { setTab('validation'); validationTabRef.current?.focus(); }}>{issues.length ? 'View issues' : 'View checks'}<ArrowRightIcon /></button>
      </footer>
    </aside>
  );
}

PurchaseOrderPreviewPane.propTypes = {
  formData: PropTypes.object.isRequired,
  vendor: PropTypes.object,
  files: PropTypes.arrayOf(PropTypes.object),
  issues: PropTypes.arrayOf(PropTypes.shape({
    field: PropTypes.string,
    message: PropTypes.string.isRequired,
    step: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  })),
  onIssueClick: PropTypes.func,
};
