import React, { useCallback, useId, useState } from 'react';
import PropTypes from 'prop-types';
import { ArrowDownTrayIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import PdfDocumentPreview from '../../components/Common/PdfDocumentPreview';
import './ProcurementImportPdfPreview.css';

/** One page-fitted PDF viewer; inactive documents retain their original file URLs. */
export default function ProcurementImportPdfPreview({ documents, selectedKind, onSelect }) {
  const id = useId();
  const [documentStatus, setDocumentStatus] = useState(null);
  const documentReady = useCallback(url => {
    setDocumentStatus(previous => previous?.url === url && previous.status === 'ready' ? previous : { url, status: 'ready' });
  }, []);
  const documentFailed = useCallback(url => {
    setDocumentStatus(previous => previous?.url === url && previous.status === 'error' ? previous : { url, status: 'error' });
  }, []);
  const selected = documents.find(document => document.kind === selectedKind) || documents[0];
  if (!selected) return null;
  const status = !selected.url ? 'unavailable' : documentStatus?.url === selected.url ? documentStatus.status : 'loading';
  const statusLabel = { ready: 'Document ready', loading: 'Loading document…', error: 'Preview unavailable', unavailable: 'Document unavailable' }[status];

  const selectWithKeyboard = event => {
    const index = documents.findIndex(document => document.kind === selected.kind);
    const next = event.key === 'ArrowRight' ? (index + 1) % documents.length
      : event.key === 'ArrowLeft' ? (index + documents.length - 1) % documents.length
        : event.key === 'Home' ? 0 : event.key === 'End' ? documents.length - 1 : -1;
    if (next < 0) return;
    event.preventDefault();
    onSelect(documents[next].kind);
    event.currentTarget.querySelectorAll('[role="tab"]')[next]?.focus();
  };

  const documentActions = selected.url && <>
    <a href={selected.url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${selected.kind.toUpperCase()} PDF in new tab`}
      className="procurement-source-action inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-50">
      <ArrowTopRightOnSquareIcon aria-hidden="true" className="h-4 w-4" />Open PDF
    </a>
    <a href={selected.url} download={selected.name} aria-label={`Download ${selected.kind.toUpperCase()} PDF`}
      className="procurement-source-action procurement-source-download inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-50">
      <ArrowDownTrayIcon aria-hidden="true" className="h-4 w-4" />Download
    </a>
  </>;

  return <section aria-label="Source PDF preview" className="procurement-source-preview flex h-[calc(100dvh-360px)] min-h-[320px] max-h-[760px] min-w-0 flex-col overflow-hidden rounded-xl border border-gray-300 bg-gray-100">
    <div className="procurement-source-header flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-gray-200 bg-white px-3 py-2">
      <div className="procurement-source-heading min-w-0 flex-1">
        <h3 className="text-sm font-semibold text-gray-900">{selected.kind === 'po' ? 'Source PO' : 'Source PDF'}</h3>
        <p className="truncate text-xs text-gray-600" title={selected.name}>{selected.name}</p>
      </div>
      <p className="procurement-source-status inline-flex items-center gap-2 text-xs text-gray-600" data-status={status} aria-live="polite">
        <span className="procurement-source-status-dot" aria-hidden="true" />{statusLabel}
      </p>
      <div role="tablist" aria-label="Source PDFs" onKeyDown={selectWithKeyboard} className="procurement-source-tabs flex w-full gap-1" data-single-document={documents.length === 1}>
        {documents.map(document => <button key={document.kind} id={`${id}-${document.kind}-tab`} type="button" role="tab"
          aria-controls={`${id}-panel`} aria-selected={selected.kind === document.kind} tabIndex={selected.kind === document.kind ? 0 : -1}
          onClick={() => onSelect(document.kind)}
          className={`rounded-md px-3 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600 ${selected.kind === document.kind ? 'bg-indigo-100 text-indigo-800' : 'text-gray-600 hover:bg-gray-100'}`}>
          {document.kind.toUpperCase()} PDF
        </button>)}
      </div>
    </div>
    <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-${selected.kind}-tab`} className="procurement-source-content min-h-0 flex-1">
      {selected.url ? <PdfDocumentPreview continuous={selected.kind === 'po'} url={selected.url} title={`Approved ${selected.kind.toUpperCase()} source PDF`}
        actions={documentActions} onReady={documentReady} onError={documentFailed} />
        : <p className="p-4 text-sm text-gray-600" role="status">The source PDF is unavailable. Select the file again to preview it.</p>}
    </div>
  </section>;
}

ProcurementImportPdfPreview.propTypes = {
  documents: PropTypes.arrayOf(PropTypes.shape({ kind: PropTypes.string.isRequired, name: PropTypes.string.isRequired, url: PropTypes.string })).isRequired,
  selectedKind: PropTypes.string,
  onSelect: PropTypes.func.isRequired,
};
