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
import PurchaseRequisitionDocumentPreview from './PurchaseRequisitionDocumentPreview';
import RecommendationSourceDocument from './RecommendationSourceDocument';
import { getOriginalRecommendationDocuments } from './recommendationSourceDocuments';
import './RecommendationPreviewPane.css';

const PAPER_WIDTH = 740;
const PAPER_HEIGHT = 1046;
const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

/** A read-only, live view of the form. PDF export never saves or submits the draft. */
export default function RecommendationPreviewPane({ requisition, issues = [], onIssueClick }) {
  const paneRef = useRef(null);
  const viewportRef = useRef(null);
  const documentRef = useRef(null);
  const documentTabRef = useRef(null);
  const validationTabRef = useRef(null);
  const instanceId = useId();
  const [tab, setTab] = useState('document');
  const [zoom, setZoom] = useState(0.85);
  const [fitWidth, setFitWidth] = useState(true);
  const [availableWidth, setAvailableWidth] = useState(PAPER_WIDTH * 0.85);
  const [documentHeight, setDocumentHeight] = useState(PAPER_HEIGHT);
  const [expanded, setExpanded] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const hasOriginal = getOriginalRecommendationDocuments(requisition.attachments).length > 0;
  const scale = fitWidth ? clamp(availableWidth / PAPER_WIDTH, 0.25, 1.5) : zoom;
  const pageCount = Math.max(1, Math.ceil(documentHeight / PAPER_HEIGHT));
  const errorCount = issues.filter(issue => issue.severity !== 'warning').length;
  const warningCount = issues.length - errorCount;
  const issueLabel = [errorCount && `${errorCount} error${errorCount === 1 ? '' : 's'} to correct`,
    warningCount && `${warningCount} warning${warningCount === 1 ? '' : 's'}`].filter(Boolean).join(' · ');

  useEffect(() => {
    const viewport = viewportRef.current;
    const paper = documentRef.current;
    if (!viewport || !paper) return undefined;
    const updateSize = () => {
      if (viewport.clientWidth) setAvailableWidth(Math.max(180, viewport.clientWidth - 38));
      if (paper.offsetHeight) setDocumentHeight(paper.offsetHeight);
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(viewport);
    observer.observe(paper);
    return () => observer.disconnect();
  }, [hasOriginal]);

  useEffect(() => {
    const onFullscreenChange = () => setExpanded(document.fullscreenElement === paneRef.current);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  const changeZoom = (amount) => {
    setZoom(clamp(Math.round((scale + amount) * 100) / 100, 0.25, 1.5));
    setFitWidth(false);
  };

  const toggleFullscreen = async () => {
    setDownloadError('');
    try {
      if (document.fullscreenElement === paneRef.current) await document.exitFullscreen();
      else if (paneRef.current?.requestFullscreen) await paneRef.current.requestFullscreen();
      else setDownloadError('Expanded preview is not supported by this browser. Use the zoom controls to inspect the document.');
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
      // Render an unscaled copy so zoom and scroll position never change the PDF.
      exportHost = document.createElement('div');
      exportHost.className = 'rpp-preview rpp-export-host';
      exportHost.setAttribute('aria-hidden', 'true');
      const copy = documentRef.current.cloneNode(true);
      copy.style.transform = 'none';
      exportHost.appendChild(copy);
      document.body.appendChild(exportHost);
      await document.fonts?.ready;
      await Promise.all(Array.from(copy.querySelectorAll('img')).map(async (image) => {
        if (image.decode) {
          try { await image.decode(); } catch { /* The text remains exportable if an image is unavailable. */ }
        }
      }));
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas'), import('jspdf'),
      ]);
      const canvas = await html2canvas(copy, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        logging: false,
        windowWidth: 1200,
        scrollX: 0,
        scrollY: 0,
      });
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
      const margin = 6;
      const width = pdf.internal.pageSize.getWidth() - margin * 2;
      const height = pdf.internal.pageSize.getHeight() - margin * 2;
      const pixelsPerPage = Math.floor(Math.min(
        height * canvas.width / width,
        PAPER_HEIGHT * canvas.width / PAPER_WIDTH,
      ));
      const totalPages = Math.ceil(canvas.height / pixelsPerPage);
      for (let page = 0; page < totalPages; page += 1) {
        if (page > 0) pdf.addPage();
        const top = page * pixelsPerPage;
        const slice = document.createElement('canvas');
        slice.width = canvas.width;
        slice.height = Math.min(pixelsPerPage, canvas.height - top);
        const context = slice.getContext('2d');
        if (!context) throw new Error('This browser could not render the document.');
        context.drawImage(canvas, 0, top, canvas.width, slice.height, 0, 0, canvas.width, slice.height);
        pdf.addImage(slice.toDataURL('image/png'), 'PNG', margin, margin, width, slice.height * width / canvas.width, undefined, 'FAST');
      }
      pdf.setProperties({ title: requisition.pr_number || 'Draft purchase recommendation', subject: 'Purchase recommendation form preview' });
      const reference = String(requisition.pr_number || 'Purchase-Recommendation-Draft').replace(/[^A-Za-z0-9._-]+/g, '-');
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
    <aside className={`rpp-preview${hasOriginal ? ' has-original' : ''}`} ref={paneRef} aria-label="Live purchase recommendation preview">
      <header className="rpp-heading">
        <div className="rpp-title-row">
          <h2>{hasOriginal ? 'Purchase Recommendation Preview' : 'Live Purchase Recommendation Preview'}</h2>
          {!hasOriginal && <span className="rpp-current"><span /> Up to date</span>}
        </div>
        {!hasOriginal && <p>Updates as fields are completed</p>}
        <div className="rpp-toolbar" aria-label="Document preview controls">
          {!hasOriginal && <><span className="rpp-page-number">Page {Math.min(currentPage, pageCount)} of {pageCount}</span>
          <div className="rpp-zoom-controls">
            <button type="button" aria-label="Zoom out preview" onClick={() => changeZoom(-0.1)} disabled={scale <= 0.25}><MinusIcon /></button>
            <output aria-label="Preview zoom">{Math.round(scale * 100)}%</output>
            <button type="button" aria-label="Zoom in preview" onClick={() => changeZoom(0.1)} disabled={scale >= 1.5}><PlusIcon /></button>
          </div>
          <button type="button" className="rpp-tool" aria-pressed={fitWidth} onClick={() => setFitWidth(true)}>Fit width</button></>}
          <button type="button" className="rpp-tool rpp-icon-tool" aria-label={expanded ? 'Exit expanded preview' : 'Expand preview'} onClick={toggleFullscreen}>
            {expanded ? <ArrowsPointingInIcon /> : <ArrowsPointingOutIcon />}
          </button>
          {!hasOriginal && <button type="button" className="rpp-tool rpp-download" disabled={downloading} onClick={downloadPdf}>
            <ArrowDownTrayIcon />{downloading ? 'Preparing PDF...' : 'Download PDF'}
          </button>}
        </div>
      </header>
      <div className="rpp-tabs" role="tablist" aria-label="Preview views" onKeyDown={onTabKeyDown}>
        <button type="button" ref={documentTabRef} role="tab" id={`${instanceId}-document-tab`} aria-controls={`${instanceId}-document-panel`} aria-selected={tab === 'document'} tabIndex={tab === 'document' ? 0 : -1} onClick={() => setTab('document')}>Document</button>
        <button type="button" ref={validationTabRef} role="tab" id={`${instanceId}-validation-tab`} aria-controls={`${instanceId}-validation-panel`} aria-selected={tab === 'validation'} tabIndex={tab === 'validation' ? 0 : -1} onClick={() => setTab('validation')}>Validation{issues.length > 0 && <span className="rpp-issue-count">{issues.length}</span>}</button>
      </div>
      {downloadError && <div className="rpp-error" role="alert">{downloadError}</div>}
      {hasOriginal ? <section className="rpp-original" role="tabpanel" id={`${instanceId}-document-panel`} aria-labelledby={`${instanceId}-document-tab`} hidden={tab !== 'document'} tabIndex={0}>
        <RecommendationSourceDocument key={requisition.id || requisition.pr_number} requisitionId={requisition.id} attachments={requisition.attachments} documentSha={requisition.price_remarks_data?.signed_document_verification?.document_sha256} embedded />
      </section> : <div
        className="rpp-document-viewport"
        ref={viewportRef}
        role="tabpanel"
        id={`${instanceId}-document-panel`}
        aria-labelledby={`${instanceId}-document-tab`}
        hidden={tab !== 'document'}
        tabIndex={0}
        onScroll={(event) => setCurrentPage(Math.floor(event.currentTarget.scrollTop / (PAPER_HEIGHT * scale)) + 1)}
      >
        <div className="rpp-paper-frame" style={{ width: PAPER_WIDTH * scale, height: documentHeight * scale }}>
          <div className="rpp-document" ref={documentRef} style={{ transform: `scale(${scale})` }}>
            <PurchaseRequisitionDocumentPreview requisition={requisition} live documentOnly />
          </div>
        </div>
      </div>}
      <section className="rpp-validation" role="tabpanel" id={`${instanceId}-validation-panel`} aria-labelledby={`${instanceId}-validation-tab`} hidden={tab !== 'validation'} tabIndex={0}>
        <h3>{errorCount ? 'Correct the form errors' : warningCount ? 'Registration warnings' : 'Ready for review'}</h3>
        <p>{issues.length ? 'Warnings do not prevent saving or submitting. Select an item to return to the relevant form section.' : 'Review the recommendation before submitting it for approval.'}</p>
        {issues.length > 0 ? (
          <ul>{issues.map((issue, index) => (
            <li key={`${issue.field || issue.step}-${index}`}>
              <button type="button" className={issue.severity === 'warning' ? 'rpp-warning' : ''} onClick={() => onIssueClick?.(issue)}>
                <ExclamationCircleIcon /><span>{issue.message}</span><ArrowRightIcon />
              </button>
            </li>
          ))}</ul>
        ) : <div className="rpp-validation-ready"><CheckCircleIcon /> Required information complete</div>}
      </section>
      <footer className={`rpp-validation-bar${issues.length ? ' has-issues' : ' is-ready'}`}>
        {issues.length ? <ExclamationCircleIcon /> : <CheckCircleIcon />}
        <span aria-live="polite">{issues.length ? issueLabel : 'Required information complete'}</span>
        <button type="button" onClick={() => { setTab('validation'); validationTabRef.current?.focus(); }}>
          {issues.length ? 'View issues' : 'View checks'}<ArrowRightIcon />
        </button>
      </footer>
    </aside>
  );
}

RecommendationPreviewPane.propTypes = {
  requisition: PropTypes.object.isRequired,
  issues: PropTypes.arrayOf(PropTypes.shape({
    field: PropTypes.string,
    message: PropTypes.string.isRequired,
    severity: PropTypes.oneOf(['warning', 'error']),
    step: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  })),
  onIssueClick: PropTypes.func,
};
