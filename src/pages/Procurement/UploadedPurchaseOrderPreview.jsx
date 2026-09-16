import React, { useEffect, useId, useState } from 'react';
import PropTypes from 'prop-types';
import { ArrowDownTrayIcon, ArrowPathIcon, ArrowTopRightOnSquareIcon, DocumentTextIcon } from '@heroicons/react/24/outline';
import apiClient from '../../services/api.service';
import './UploadedPurchaseOrderPreview.css';

export default function UploadedPurchaseOrderPreview({ orderId, active = true }) {
  const selectId = useId();
  const [retry, setRetry] = useState(0);
  const [fileRetry, setFileRetry] = useState(0);
  const [selectedId, setSelectedId] = useState('');
  const [listing, setListing] = useState({ orderId: null, documents: [], loading: false, error: '' });
  const [content, setContent] = useState({ key: '', url: '', loading: false, error: '' });
  const documents = listing.orderId === orderId ? listing.documents : [];
  const selected = documents.find(item => String(item.id) === selectedId) || documents[0];
  const candidatePath = String(selected?.content_url || '').replace(/^\/api\/v1(?=\/)/, '');
  const contentPath = candidatePath.startsWith(`/procurement/orders/${orderId}/uploaded-documents/`) ? candidatePath : '';
  const contentKey = `${orderId || ''}:${selected?.id || ''}:${contentPath}`;
  const currentContent = content.key === contentKey ? content : { url: '', loading: Boolean(contentPath), error: '' };

  useEffect(() => {
    if (!active || !orderId) return undefined;
    const controller = new AbortController();
    setListing({ orderId, documents: [], loading: true, error: '' });
    setSelectedId('');
    apiClient.get(`/procurement/orders/${orderId}/uploaded-documents/`, {
      signal: controller.signal, timeout: 30000, suppressErrorToast: true,
    }).then(response => {
      const rows = Array.isArray(response.data) ? response.data : response.data?.results;
      if (!Array.isArray(rows)) throw new Error('Invalid document list');
      if (!controller.signal.aborted) setListing({ orderId, documents: rows, loading: false, error: '' });
    }).catch(() => {
      if (!controller.signal.aborted) setListing({ orderId, documents: [], loading: false, error: 'Uploaded PO documents could not be loaded.' });
    });
    return () => controller.abort();
  }, [orderId, active, retry]);

  useEffect(() => {
    if (!active || !orderId || !contentPath) return undefined;
    const controller = new AbortController();
    let objectUrl;
    setContent({ key: contentKey, url: '', loading: true, error: '' });
    // Use the authenticated order-bound endpoint, never a public storage URL.
    apiClient.get(contentPath, {
      signal: controller.signal, responseType: 'blob', timeout: 60000, suppressErrorToast: true,
    }).then(async response => {
      const blob = response.data instanceof Blob ? response.data : new Blob([response.data]);
      const header = await blob.slice(0, 1024).text();
      if (!header.trimStart().startsWith('%PDF-')) throw new Error('The saved file is not a PDF.');
      if (controller.signal.aborted) return;
      objectUrl = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
      setContent({ key: contentKey, url: objectUrl, loading: false, error: '' });
    }).catch(error => {
      if (controller.signal.aborted) return;
      const status = error.response?.status;
      const message = status === 403 ? 'You do not have access to this uploaded PO.'
        : status === 404 ? 'The uploaded PO PDF is no longer available.'
          : 'The uploaded PO PDF could not be loaded.';
      setContent({ key: contentKey, url: '', loading: false, error: message });
    });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [orderId, active, contentKey, contentPath, fileRetry]);

  if (!active) return null;
  const listPending = Boolean(orderId && (listing.orderId !== orderId || listing.loading));
  const listError = listing.orderId === orderId && listing.error;
  const filename = selected?.filename || 'Uploaded Purchase Order.pdf';

  return (
    <div className="upo-preview" aria-label="Uploaded purchase order preview">
      {listPending ? <div className="upo-state" role="status"><ArrowPathIcon className="upo-spinner" />Loading uploaded PO documents…</div>
        : listError ? <div className="upo-state" role="alert"><DocumentTextIcon /><p>{listError}</p><button type="button" onClick={() => setRetry(value => value + 1)}>Retry uploaded PO</button></div>
          : !selected ? <div className="upo-state"><DocumentTextIcon /><p>No uploaded PO PDF is linked to this order.</p></div>
            : <>
              <div className="upo-toolbar">
                {documents.length > 1 ? <div className="upo-select"><label htmlFor={selectId}>Uploaded PO document</label><select id={selectId} value={String(selected.id)} onChange={event => setSelectedId(event.target.value)}>{documents.map(item => <option key={item.id} value={String(item.id)}>{item.filename || 'Uploaded Purchase Order.pdf'}</option>)}</select></div>
                  : <span className="upo-filename" title={filename}>{filename}</span>}
                {currentContent.url && <div className="upo-actions">
                  <a href={currentContent.url} download={filename}><ArrowDownTrayIcon />Download uploaded PO</a>
                  <a href={currentContent.url} target="_blank" rel="noopener noreferrer"><ArrowTopRightOnSquareIcon />Open uploaded PO</a>
                </div>}
              </div>
              {currentContent.loading ? <div className="upo-state" role="status"><ArrowPathIcon className="upo-spinner" />Loading uploaded PO PDF…</div>
                : currentContent.error ? <div className="upo-state" role="alert"><DocumentTextIcon /><p>{currentContent.error}</p><button type="button" onClick={() => setFileRetry(value => value + 1)}>Retry uploaded PO</button></div>
                  : currentContent.url ? <iframe title={`Uploaded PO PDF: ${filename}`} src={`${currentContent.url}#page=1&view=FitH&toolbar=1&navpanes=0`} />
                    : <div className="upo-state" role="alert"><p>The uploaded PO PDF is unavailable.</p></div>}
            </>}
    </div>
  );
}

UploadedPurchaseOrderPreview.propTypes = {
  orderId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  active: PropTypes.bool,
};
