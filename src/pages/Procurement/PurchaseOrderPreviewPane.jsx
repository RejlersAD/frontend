import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { ArrowDownTrayIcon, ArrowRightIcon, ArrowsPointingInIcon, ArrowsPointingOutIcon, CheckCircleIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline';
import PdfDocumentPreview from '../../components/Common/PdfDocumentPreview';
import { downloadPurchaseOrderDocument, fetchPurchaseOrderDocument, previewPurchaseOrderDocument, purchaseOrderDocumentError } from '../../services/purchaseOrderDocuments';
import UploadedPurchaseOrderPreview from './UploadedPurchaseOrderPreview';
import useUploadedPurchaseOrderSources from './useUploadedPurchaseOrderSources';
import './PurchaseOrderPreviewPane.css';

const emptyFiles = [];

export default function PurchaseOrderPreviewPane({ formData, files = emptyFiles, issues = [], onIssueClick, orderId, savedOnly = false }) {
  const paneRef = useRef(null);
  const wordRequest = useRef(null);
  const instanceId = useId();
  const [selectedTab, setSelectedTab] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [preview, setPreview] = useState(null);
  const [failure, setFailure] = useState(null);
  const [readyUrl, setReadyUrl] = useState('');
  const [viewerFailure, setViewerFailure] = useState(null);
  const [wordPending, setWordPending] = useState(false);
  const [actionError, setActionError] = useState('');
  const documentIdentity = String(orderId || formData.po_number || formData.pr_reference || 'new-order');
  const sources = useUploadedPurchaseOrderSources(orderId, Boolean(orderId));
  // Start with the retained PDF when one exists; an unresolved source lookup
  // must not silently replace the uploaded evidence with a generated document.
  const initialTab = orderId && (sources.loading || sources.error || sources.documents.length) ? 'original' : 'document';
  const tab = selectedTab?.documentIdentity === documentIdentity ? selectedTab.value : initialTab;
  const setTab = value => setSelectedTab({ documentIdentity, value });
  const request = useMemo(() => ({ formData, files, orderId, savedOnly, attempt, documentIdentity }), [formData, files, orderId, savedOnly, attempt, documentIdentity]);
  const currentRequest = useRef(request);
  currentRequest.current = request;
  const objectUrls = useRef(new Set());
  const keptUrls = useRef({ candidate: '', ready: '' });
  const current = preview?.request === request ? preview : null;
  const displayed = preview?.request.documentIdentity === documentIdentity ? preview : null;
  const apiError = failure?.request === request ? failure.message : '';
  const pageError = viewerFailure && current && viewerFailure.url === current.url ? viewerFailure.message : '';
  const ready = Boolean(current?.blob && current.url === readyUrl && !pageError);
  const issueLabel = `${issues.length} required ${issues.length === 1 ? 'item' : 'items'} remaining`;
  const tabs = orderId ? ['document', 'original', 'validation'] : ['document', 'validation'];

  const releaseUnusedUrls = useCallback(() => {
    for (const url of objectUrls.current) {
      if (url !== keptUrls.current.candidate && url !== keptUrls.current.ready) {
        URL.revokeObjectURL(url);
        objectUrls.current.delete(url);
      }
    }
  }, []);

  const previewReady = useCallback(url => {
    if (!objectUrls.current.has(url)) return;
    keptUrls.current.ready = url;
    setReadyUrl(url);
    setViewerFailure(null);
    releaseUnusedUrls();
  }, [releaseUnusedUrls]);

  const previewFailed = useCallback((url, message) => setViewerFailure({ url, message }), []);

  useEffect(() => () => {
    for (const url of objectUrls.current) URL.revokeObjectURL(url);
    objectUrls.current.clear();
    keptUrls.current = { candidate: '', ready: '' };
  }, [documentIdentity]);

  useEffect(() => {
    if (tab !== 'document' || preview?.request === request) return undefined;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        // Locked number-correction screens preview the saved, approved record.
        // Editable drafts render the exact form snapshot without saving it.
        const result = request.savedOnly
          ? await fetchPurchaseOrderDocument({ ...request.formData, id: request.orderId }, 'pdf', { signal: controller.signal })
          : await previewPurchaseOrderDocument(request.formData, request.files, request.orderId, 'pdf', { signal: controller.signal });
        if (controller.signal.aborted) return;
        const url = URL.createObjectURL(result.blob);
        objectUrls.current.add(url);
        keptUrls.current.candidate = url;
        releaseUnusedUrls();
        setPreview({ request, ...result, url });
      } catch (error) {
        const message = await purchaseOrderDocumentError(error);
        if (!controller.signal.aborted) setFailure({ request, message });
      }
    }, 500);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [request, tab, preview?.request, releaseUnusedUrls]);

  useEffect(() => {
    const onFullscreenChange = () => setExpanded(document.fullscreenElement === paneRef.current);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  useEffect(() => () => wordRequest.current?.abort(), []);

  const toggleFullscreen = async () => {
    setActionError('');
    try {
      if (document.fullscreenElement === paneRef.current) await document.exitFullscreen();
      else if (paneRef.current?.requestFullscreen) await paneRef.current.requestFullscreen();
      else setActionError('Expanded preview is unavailable in this browser.');
    } catch {
      setActionError('The browser could not expand the preview.');
    }
  };

  const downloadWord = async () => {
    if (!ready || wordPending) return;
    setWordPending(true);
    setActionError('');
    const controller = new AbortController();
    wordRequest.current = controller;
    try {
      const result = request.savedOnly
        ? await fetchPurchaseOrderDocument({ ...request.formData, id: request.orderId }, 'word', { signal: controller.signal })
        : await previewPurchaseOrderDocument(request.formData, request.files, request.orderId, 'word', { signal: controller.signal });
      if (controller.signal.aborted) return;
      if (currentRequest.current !== request) {
        setActionError('The order changed while Word was being prepared. Download again to use the current content.');
        return;
      }
      downloadPurchaseOrderDocument(result);
    } catch (error) {
      if (!controller.signal.aborted) setActionError(await purchaseOrderDocumentError(error));
    } finally {
      setWordPending(false);
    }
  };

  const onTabKeyDown = event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? tabs[0] : event.key === 'End' ? tabs.at(-1)
      : tabs[(tabs.indexOf(tab) + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
    setTab(next);
    document.getElementById(`${instanceId}-${next}-tab`)?.focus();
  };

  return <aside className="pop-preview" ref={paneRef} aria-label="Live purchase order preview">
    <header className="pop-heading">
      <div className="pop-title-row"><h2>Purchase order preview</h2>{tab === 'document' && <span className="sr-only" role="status">{apiError || pageError ? 'Preview unavailable' : ready ? savedOnly ? 'Saved purchase order' : 'Current form content' : 'Updating preview…'}</span>}</div>
      <div className="pop-toolbar" aria-label="Purchase order preview controls">
        <button type="button" className="pop-tool pop-icon-tool" aria-label={expanded ? 'Exit expanded preview' : 'Expand preview'} onClick={toggleFullscreen}>{expanded ? <ArrowsPointingInIcon /> : <ArrowsPointingOutIcon />}</button>
      </div>
    </header>
    <div className="pop-tabs" role="tablist" aria-label="Purchase order preview views" onKeyDown={onTabKeyDown}>
      {tabs.map(value => <button key={value} type="button" role="tab" id={`${instanceId}-${value}-tab`} aria-controls={`${instanceId}-${value}-panel`} aria-selected={tab === value} tabIndex={tab === value ? 0 : -1} onClick={() => setTab(value)}>{value === 'document' ? 'Document' : value === 'original' ? 'Original source' : <>Validation{issues.length > 0 && <span className="pop-issue-count">{issues.length}</span>}</>}</button>)}
    </div>
    {actionError && <div className="pop-error" role="alert">{actionError}</div>}
    {tab === 'document' && apiError && <div className="pop-error" role="alert"><p>{apiError}</p><button type="button" className="pop-tool" onClick={() => setAttempt(value => value + 1)}>Retry preview</button></div>}
    {tab === 'document' && pageError && <button type="button" className="pop-tool" onClick={() => setAttempt(value => value + 1)}>Retry preview</button>}
    <section className="pop-uploaded" role="tabpanel" id={`${instanceId}-document-panel`} aria-labelledby={`${instanceId}-document-tab`} hidden={tab !== 'document'} tabIndex={0}>
      {displayed?.url ? <PdfDocumentPreview continuous url={displayed.url} documentKey={documentIdentity} title="Current purchase order PDF preview" className="h-full" refreshing={!ready && !apiError && !pageError} onReady={previewReady} onError={previewFailed} actions={<div className="pop-document-actions">
        <button type="button" className="pop-tool pop-icon-tool" aria-label="Download PDF" title="Download PDF" disabled={!ready} onClick={() => { if (ready) downloadPurchaseOrderDocument(current); }}><ArrowDownTrayIcon aria-hidden="true" /></button>
        <button type="button" className="pop-tool" aria-label={wordPending ? 'Preparing Word…' : 'Download Word'} title="Download Word" disabled={!ready || wordPending} onClick={downloadWord}>{wordPending ? 'Preparing…' : 'Word'}</button>
      </div>} />
        : !apiError && <div className="upo-state" role="status">Updating purchase order PDF preview…</div>}
    </section>
    {orderId && <section className="pop-uploaded" role="tabpanel" id={`${instanceId}-original-panel`} aria-labelledby={`${instanceId}-original-tab`} hidden={tab !== 'original'} tabIndex={0}>
      <UploadedPurchaseOrderPreview orderId={orderId} active={tab === 'original'} sourceState={sources} />
    </section>}
    <section className="pop-validation" role="tabpanel" id={`${instanceId}-validation-panel`} aria-labelledby={`${instanceId}-validation-tab`} hidden={tab !== 'validation'} tabIndex={0}>
      <h3>{issues.length ? 'Complete the required information' : 'Ready for review'}</h3>
      {issues.length > 0 ? <ul>{issues.map((issue, index) => <li key={`${issue.field || issue.step}-${index}`}><button type="button" onClick={() => onIssueClick?.(issue)}><ExclamationCircleIcon /><span>{issue.message}</span><ArrowRightIcon /></button></li>)}</ul>
        : <div className="pop-validation-ready"><CheckCircleIcon />Required information complete</div>}
    </section>
    <footer className={`pop-validation-bar${issues.length ? ' has-issues' : ' is-ready'}`}>
      {issues.length ? <ExclamationCircleIcon /> : <CheckCircleIcon />}<span aria-live="polite">{issues.length ? issueLabel : 'Required information complete'}</span>
      <button type="button" onClick={() => { setTab('validation'); document.getElementById(`${instanceId}-validation-tab`)?.focus(); }}>{issues.length ? 'View issues' : 'View checks'}<ArrowRightIcon /></button>
    </footer>
  </aside>;
}

PurchaseOrderPreviewPane.propTypes = {
  formData: PropTypes.object.isRequired,
  orderId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  savedOnly: PropTypes.bool,
  files: PropTypes.arrayOf(PropTypes.object),
  issues: PropTypes.arrayOf(PropTypes.shape({ field: PropTypes.string, message: PropTypes.string.isRequired, step: PropTypes.oneOfType([PropTypes.number, PropTypes.string]) })),
  onIssueClick: PropTypes.func,
};
