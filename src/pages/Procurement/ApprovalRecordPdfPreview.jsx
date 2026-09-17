import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Download, ExternalLink, RefreshCw } from 'lucide-react';
import apiClient from '../../services/api.service';
import './RecommendationSourceDocument.css';

export default function ApprovalRecordPdfPreview({ requisitionId, requisitionNumber, linkedOrderId, sourceVersion = '' }) {
  const [retry, setRetry] = useState(0);
  const [content, setContent] = useState({ key: '', url: '', loading: true, error: '' });
  const contentKey = `${requisitionId}:${linkedOrderId}:${sourceVersion}`;
  const current = content.key === contentKey ? content : { url: '', loading: true, error: '' };
  const filename = `${requisitionNumber || 'Purchase-requisition'}-PR-PO.pdf`;

  useEffect(() => {
    if (!requisitionId || !linkedOrderId) return undefined;
    const controller = new AbortController();
    let objectUrl;
    setContent({ key: contentKey, url: '', loading: true, error: '' });
    const load = async () => {
      try {
        const { data } = await apiClient.get(`/procurement/requisitions/${requisitionId}/approval-record-pdf/`, {
          responseType: 'blob', signal: controller.signal, timeout: 120000, suppressErrorToast: true,
        });
        const blob = data instanceof Blob ? data : new Blob([data]);
        if (!(await blob.slice(0, 1024).text()).trimStart().startsWith('%PDF-')) throw new Error('Invalid PDF');
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
        setContent({ key: contentKey, url: objectUrl, loading: false, error: '' });
      } catch (problem) {
        if (controller.signal.aborted) return;
        const status = problem.response?.status;
        let message = '';
        const data = problem.response?.data;
        try {
          const details = data instanceof Blob ? JSON.parse(await data.text()) : data;
          if (typeof details?.error === 'string') message = details.error;
          else if (typeof details?.detail === 'string') message = details.detail;
        } catch { /* Use a readable fallback when the server returns non-JSON. */ }
        if (controller.signal.aborted) return;
        setContent({ key: contentKey, url: '', loading: false, error: message || (
          status === 403 ? 'You do not have access to both original documents.'
            : status === 404 ? 'Both original PR and PO PDFs are required for the combined preview.'
              : 'The combined PR and PO PDF could not be loaded.'
        ) });
      }
    };
    load();
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [requisitionId, linkedOrderId, contentKey, retry]);

  return <section className="prr-source-document is-embedded" aria-label="Combined PR and PO documents">
    <div className="prr-source-controls">
      <span className="mr-auto rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700">PR first, then PO</span>
      {current.url && <>
        <a href={current.url} target="_blank" rel="noopener noreferrer" aria-label="Open combined PR and PO PDF" title="Open combined PR and PO PDF"><ExternalLink size={17} aria-hidden="true" /></a>
        <a href={current.url} download={filename} aria-label="Download combined PR and PO PDF" title="Download combined PR and PO PDF"><Download size={17} aria-hidden="true" /></a>
      </>}
    </div>
    {current.loading ? <div className="prr-source-state" role="status"><RefreshCw size={22} aria-hidden="true" /><p>Loading PR and PO documents...</p></div>
      : current.error ? <div className="prr-source-state" role="alert"><p>{current.error}</p><button type="button" onClick={() => setRetry(value => value + 1)}>Retry combined PDF</button></div>
        : current.url && <iframe src={`${current.url}#page=1&zoom=page-width&view=FitH&toolbar=0&navpanes=0`} title="Combined original PR and PO PDF" />}
  </section>;
}

ApprovalRecordPdfPreview.propTypes = {
  requisitionId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  requisitionNumber: PropTypes.string,
  linkedOrderId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  sourceVersion: PropTypes.string,
};
