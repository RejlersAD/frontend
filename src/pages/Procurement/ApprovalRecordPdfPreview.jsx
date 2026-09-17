import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Download, ExternalLink, RefreshCw, Upload } from 'lucide-react';
import apiClient from '../../services/api.service';
import PurchaseRequisitionPdfImport from './PurchaseRequisitionPdfImport';
import './RecommendationSourceDocument.css';

export default function ApprovalRecordPdfPreview({ requisitionId, requisitionNumber, linkedOrderId, sourceVersion = '', canUploadPurchaseOrder = false, canImportRequisition = false, onSourceUploaded, onShowOriginalPr }) {
  const [retry, setRetry] = useState(0);
  const [upload, setUpload] = useState(null);
  const [content, setContent] = useState({ key: '', url: '', loading: true, error: '' });
  const contentKey = `${requisitionId}:${linkedOrderId}:${sourceVersion}`;
  const current = content.key === contentKey ? content : { url: '', loading: true, error: '' };
  const filename = `${requisitionNumber || 'Purchase-requisition'}-PR-PO.pdf`;
  const missingSource = current.code === 'approval_record_source_missing' ? current.source : '';
  const canUploadMissing = missingSource === 'po' ? canUploadPurchaseOrder : missingSource === 'pr' && canImportRequisition;

  useEffect(() => { setUpload(null); }, [contentKey]);

  useEffect(() => {
    if (!requisitionId || !linkedOrderId) return undefined;
    const controller = new AbortController();
    let objectUrl;
    setContent({ key: contentKey, url: '', loading: true, error: '' });
    const load = async () => {
      try {
        const { data, headers } = await apiClient.get(`/procurement/requisitions/${requisitionId}/approval-record-pdf/`, {
          responseType: 'blob', signal: controller.signal, timeout: 120000, suppressErrorToast: true,
        });
        const blob = data instanceof Blob ? data : new Blob([data]);
        if (!(await blob.slice(0, 1024).text()).trimStart().startsWith('%PDF-')) throw new Error('Invalid PDF');
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
        setContent({ key: contentKey, url: objectUrl, loading: false, error: '',
          prSource: headers?.['x-approval-record-pr-source'], poSource: headers?.['x-approval-record-po-source'],
          attachmentWarnings: Number(headers?.['x-po-attachment-warnings']) || 0 });
      } catch (problem) {
        if (controller.signal.aborted) return;
        const status = problem.response?.status;
        let message = '';
        let code = '';
        let source = '';
        const data = problem.response?.data;
        try {
          const details = data instanceof Blob ? JSON.parse(await data.text()) : data;
          if (typeof details?.error === 'string') message = details.error;
          else if (typeof details?.detail === 'string') message = details.detail;
          if (status === 404 && details?.code === 'approval_record_source_missing' && ['pr', 'po'].includes(details.source)) {
            code = details.code;
            source = details.source;
          } else if (status === 404 && /original linked PO PDF/i.test(message)) {
            code = 'approval_record_source_missing';
            source = 'po';
          }
        } catch { /* Use a readable fallback when the server returns non-JSON. */ }
        if (controller.signal.aborted) return;
        setContent({ key: contentKey, url: '', loading: false, code, source, error: message || (
          status === 403 ? 'You do not have access to both original documents.'
            : status === 404 ? 'A document required for the combined preview is unavailable.'
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

  const uploaded = data => {
    setUpload(null);
    setRetry(value => value + 1);
    onSourceUploaded?.(data);
  };

  return <><section className="prr-source-document prr-approval-record is-embedded" aria-label="Combined PR and PO documents">
    <div className="prr-source-controls">
      <span className="mr-auto rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700">PR first, then PO</span>
      {current.url && [['PR', current.prSource], ['PO', current.poSource]].map(([label, source]) => (
        ['radai_generated', 'uploaded_original'].includes(source) && <span key={label} className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700">
          {label}: {source === 'radai_generated' ? 'RADAI-generated' : 'Uploaded original'}
        </span>
      ))}
      {current.url && <>
        <a href={current.url} target="_blank" rel="noopener noreferrer" aria-label="Open combined PR and PO PDF" title="Open combined PR and PO PDF"><ExternalLink size={17} aria-hidden="true" /></a>
        <a href={current.url} download={filename} aria-label="Download combined PR and PO PDF" title="Download combined PR and PO PDF"><Download size={17} aria-hidden="true" /></a>
      </>}
    </div>
    {current.url && current.attachmentWarnings > 0 && <p role="status" className="shrink-0 border-y border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
      The PO is included. {current.attachmentWarnings} supporting attachment{current.attachmentWarnings === 1 ? '' : 's'} could not be added to this preview.
    </p>}
    {current.loading ? <div className="prr-source-state" role="status"><RefreshCw size={22} aria-hidden="true" /><p>Loading PR and PO documents...</p></div>
      : current.error ? <div className="prr-source-state" role="alert">
        <p>{current.error}</p>
        {canUploadMissing && <button type="button" onClick={() => setUpload({ key: contentKey, source: missingSource })} className="inline-flex items-center gap-2 font-semibold">
          <Upload size={17} aria-hidden="true" />{missingSource === 'po' ? 'Upload signed PO' : 'Upload original PR'}
        </button>}
        <div className="flex flex-wrap justify-center gap-2">
          {onShowOriginalPr && <button type="button" onClick={onShowOriginalPr}>View PR PDF</button>}
          <button type="button" onClick={() => setRetry(value => value + 1)}>Retry combined PDF</button>
        </div>
      </div>
        : current.url && <iframe src={`${current.url}#page=1&zoom=page-width&view=FitH&toolbar=0&navpanes=0`} title="Combined PR and PO PDF" />}
  </section>
    {upload?.key === contentKey && <PurchaseRequisitionPdfImport isOpen onClose={() => setUpload(null)} onImported={uploaded}
      primaryDocument={upload.source === 'pr' ? 'pr' : 'po'} requisitionId={requisitionId}
      expectedPrNumber={upload.source === 'pr' ? requisitionNumber : ''}
      canImportRequisition={canImportRequisition} canUploadPurchaseOrder={canUploadPurchaseOrder}
      canLinkPurchaseOrder={canUploadPurchaseOrder} />}
  </>;
}

ApprovalRecordPdfPreview.propTypes = {
  requisitionId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  requisitionNumber: PropTypes.string,
  linkedOrderId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  sourceVersion: PropTypes.string,
  canUploadPurchaseOrder: PropTypes.bool,
  canImportRequisition: PropTypes.bool,
  onSourceUploaded: PropTypes.func,
  onShowOriginalPr: PropTypes.func,
};
