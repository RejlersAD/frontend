import React, { useEffect, useId, useState } from 'react';
import PropTypes from 'prop-types';
import { ArrowDownTrayIcon, ArrowPathIcon, ArrowTopRightOnSquareIcon, DocumentTextIcon } from '@heroicons/react/24/outline';
import apiClient from '../../services/api.service';
import PdfDocumentPreview from '../../components/Common/PdfDocumentPreview';
import useUploadedPurchaseOrderSources from './useUploadedPurchaseOrderSources';
import './UploadedPurchaseOrderPreview.css';

export default function UploadedPurchaseOrderPreview({ orderId, documentId, filename: documentFilename, active = true, sourceState }) {
  const selectId = useId();
  const [fileRetry, setFileRetry] = useState(0);
  const [selection, setSelection] = useState({ orderId: '', documentId: '' });
  const ownSources = useUploadedPurchaseOrderSources(orderId, active && !sourceState && !documentId);
  const pendingSource = documentId ? { documents: [{ id: documentId, filename: documentFilename }], loading: false, error: '', retry: () => {} } : null;
  const { documents, loading: listPending, error: listError, retry } = pendingSource || sourceState || ownSources;
  const [content, setContent] = useState({ key: '', url: '', loading: false, error: '' });
  const selected = documents.find(item => String(orderId) === selection.orderId && String(item.id) === selection.documentId) || documents[0];
  const candidatePath = String(selected?.content_url || '').replace(/^\/api\/v1(?=\/)/, '');
  const contentPath = documentId ? `/procurement/po-documents/${documentId}/content/` : candidatePath.startsWith(`/procurement/orders/${orderId}/uploaded-documents/`) ? candidatePath : '';
  const contentKey = `${orderId || ''}:${selected?.id || ''}:${contentPath}`;
  const currentContent = content.key === contentKey ? content : { url: '', loading: Boolean(contentPath), error: '' };

  useEffect(() => {
    if (!active || !(orderId || documentId) || !contentPath) return undefined;
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
  }, [orderId, documentId, active, contentKey, contentPath, fileRetry]);

  if (!active) return null;
  const filename = selected?.filename || 'Uploaded Purchase Order.pdf';

  return (
    <div className="upo-preview" aria-label="Uploaded purchase order preview">
      {listPending ? <div className="upo-state" role="status"><ArrowPathIcon className="upo-spinner" />Loading uploaded PO documents…</div>
        : listError ? <div className="upo-state" role="alert"><DocumentTextIcon /><p>{listError}</p><button type="button" onClick={retry}>Retry uploaded PO</button></div>
          : !selected ? <div className="upo-state"><DocumentTextIcon /><p>No uploaded PO PDF is linked to this order.</p></div>
            : <>
              {documents.length > 1 && <div className="upo-toolbar"><div className="upo-select"><label htmlFor={selectId}>Uploaded PO document</label><select id={selectId} value={String(selected.id)} onChange={event => setSelection({ orderId: String(orderId), documentId: event.target.value })}>{documents.map(item => <option key={item.id} value={String(item.id)}>{item.filename || 'Uploaded Purchase Order.pdf'}</option>)}</select></div></div>}
              {currentContent.loading ? <div className="upo-state" role="status"><ArrowPathIcon className="upo-spinner" />Loading uploaded PO PDF…</div>
                : currentContent.error ? <div className="upo-state" role="alert"><DocumentTextIcon /><p>{currentContent.error}</p><button type="button" onClick={() => setFileRetry(value => value + 1)}>Retry uploaded PO</button></div>
                  : currentContent.url ? <PdfDocumentPreview title={`Uploaded PO PDF: ${filename}`} url={currentContent.url} className="min-h-0 flex-1" actions={<div className="upo-actions">
                    <a href={currentContent.url} download={filename} aria-label="Download uploaded PO" title="Download uploaded PO"><ArrowDownTrayIcon aria-hidden="true" /></a>
                    <a href={currentContent.url} target="_blank" rel="noopener noreferrer" aria-label="Open uploaded PO" title="Open uploaded PO"><ArrowTopRightOnSquareIcon aria-hidden="true" /></a>
                  </div>} />
                    : <div className="upo-state" role="alert"><p>The uploaded PO PDF is unavailable.</p></div>}
            </>}
    </div>
  );
}

UploadedPurchaseOrderPreview.propTypes = {
  orderId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  documentId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  filename: PropTypes.string,
  active: PropTypes.bool,
  sourceState: PropTypes.shape({
    documents: PropTypes.array.isRequired,
    loading: PropTypes.bool.isRequired,
    error: PropTypes.string,
    retry: PropTypes.func.isRequired,
  }),
};
