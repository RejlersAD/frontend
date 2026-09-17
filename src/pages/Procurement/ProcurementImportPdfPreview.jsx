import React, { useId } from 'react';
import PropTypes from 'prop-types';
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';

/** One native PDF viewer; inactive documents retain their file URLs without loading a second viewer. */
export default function ProcurementImportPdfPreview({ documents, selectedKind, onSelect }) {
  const id = useId();
  const selected = documents.find(document => document.kind === selectedKind) || documents[0];
  if (!selected) return null;

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

  return <section aria-label="Source PDF preview" className="flex h-[calc(100dvh-360px)] min-h-[320px] max-h-[760px] min-w-0 flex-col overflow-hidden rounded-xl border border-gray-300 bg-gray-100">
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-gray-200 bg-white px-3 py-2">
      <div role="tablist" aria-label="Source PDFs" onKeyDown={selectWithKeyboard} className="flex gap-1">
        {documents.map(document => <button key={document.kind} id={`${id}-${document.kind}-tab`} type="button" role="tab"
          aria-controls={`${id}-panel`} aria-selected={selected.kind === document.kind} tabIndex={selected.kind === document.kind ? 0 : -1}
          onClick={() => onSelect(document.kind)}
          className={`rounded-md px-3 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600 ${selected.kind === document.kind ? 'bg-indigo-100 text-indigo-800' : 'text-gray-600 hover:bg-gray-100'}`}>
          {document.kind.toUpperCase()} PDF
        </button>)}
      </div>
      {selected.url && <a href={selected.url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${selected.kind.toUpperCase()} PDF in new tab`}
        className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-50">
        <ArrowTopRightOnSquareIcon className="h-4 w-4" />Open PDF
      </a>}
      <p className="w-full truncate text-xs text-gray-600" title={selected.name}>{selected.name}</p>
    </div>
    <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-${selected.kind}-tab`} className="min-h-0 flex-1">
      {selected.url && <iframe key={`${selected.kind}:${selected.url}`} src={`${selected.url}#page=1&zoom=page-width&view=FitH&toolbar=1&navpanes=0`}
        title={`Approved ${selected.kind.toUpperCase()} source PDF`} className="block h-full w-full border-0" />}
    </div>
  </section>;
}

ProcurementImportPdfPreview.propTypes = {
  documents: PropTypes.arrayOf(PropTypes.shape({ kind: PropTypes.string.isRequired, name: PropTypes.string.isRequired, url: PropTypes.string })).isRequired,
  selectedKind: PropTypes.string,
  onSelect: PropTypes.func.isRequired,
};
