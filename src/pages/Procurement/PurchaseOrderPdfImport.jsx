import React, { useRef, useState } from 'react';
import PropTypes from 'prop-types';
import {
  ArrowUpTrayIcon,
  CheckCircleIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  LinkIcon,
  ShieldCheckIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import apiClient from '../../services/api.service';

const IssueList = ({ title, items, tone = 'amber' }) => {
  if (!items?.length) return null;
  const styles = tone === 'red'
    ? 'border-red-200 bg-red-50 text-red-800'
    : 'border-amber-200 bg-amber-50 text-amber-800';
  return (
    <div className={`rounded-xl border p-4 text-sm ${styles}`}>
      <p className="font-semibold">{title}</p>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        {items.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </div>
  );
};

IssueList.propTypes = {
  title: PropTypes.string.isRequired,
  items: PropTypes.arrayOf(PropTypes.string),
  tone: PropTypes.oneOf(['amber', 'red']),
};

const PurchaseOrderPdfImport = ({ isOpen, onClose, onImported }) => {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [evidence, setEvidence] = useState({
    signatureVerified: false,
    stampVerified: false,
    approvedByName: '',
    approvedByTitle: '',
    approvedDate: '',
  });

  if (!isOpen) return null;

  const resetAndClose = () => {
    if (loading) return;
    setFile(null);
    setResult(null);
    setError('');
    setEvidence({
      signatureVerified: false,
      stampVerified: false,
      approvedByName: '',
      approvedByTitle: '',
      approvedDate: '',
    });
    onClose();
  };

  const importPdf = async () => {
    if (!file) {
      setError('Select a signed Purchase Order PDF first.');
      return;
    }
    if (evidence.signatureVerified && (!evidence.approvedByName || !evidence.approvedDate)) {
      setError('Enter the approver name and approval date when the signature is verified.');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);
    try {
      const body = new FormData();
      body.append('file', file);
      body.append('signature_verified', String(evidence.signatureVerified));
      body.append('stamp_verified', String(evidence.stampVerified));
      body.append('approved_by_name', evidence.approvedByName);
      body.append('approved_by_title', evidence.approvedByTitle);
      body.append('approved_date', evidence.approvedDate);
      const response = await apiClient.post('/procurement/po-documents/import_signed_pdf/', body, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 180000,
      });
      setResult(response.data);
      onImported?.(response.data);
    } catch (requestError) {
      setError(
        requestError.response?.data?.error
        || requestError.response?.data?.detail
        || (requestError.code === 'ECONNABORTED'
          ? 'PDF extraction timed out. Please try again or use a clearer scan.'
          : 'The signed PO PDF could not be imported.'),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center px-4 py-8">
        <button type="button" aria-label="Close signed PO import" className="fixed inset-0 bg-black/50" onClick={resetAndClose} />
        <div className="relative w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl">
          <div className="flex items-start justify-between bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4">
            <div>
              <h2 className="text-lg font-bold text-white">Import Signed Purchase Order PDF</h2>
              <p className="mt-1 text-xs text-indigo-100">Extract, link to its PR, store approval evidence, and verify the database record.</p>
            </div>
            <button type="button" onClick={resetAndClose} disabled={loading} className="text-white hover:text-indigo-100">
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          <div className="max-h-[75vh] space-y-5 overflow-y-auto p-6">
            <div className="rounded-xl border border-dashed border-indigo-300 bg-indigo-50/50 p-5">
              <input
                ref={inputRef}
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={(event) => {
                  const selected = event.target.files?.[0] || null;
                  setFile(selected);
                  setResult(null);
                  setError(selected && selected.size > 15 * 1024 * 1024 ? 'PDF file must not exceed 15 MB.' : '');
                }}
              />
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <DocumentTextIcon className="h-9 w-9 text-indigo-600" />
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{file?.name || 'Select a signed PO document'}</p>
                    <p className="mt-1 text-xs text-gray-500">PDF only, maximum 15 MB. OCR processing can take up to three minutes.</p>
                  </div>
                </div>
                <button type="button" disabled={loading} onClick={() => inputRef.current?.click()} className="h-9 rounded-lg border border-indigo-300 bg-white px-3 text-xs font-semibold text-indigo-700 hover:bg-indigo-50">
                  <ArrowUpTrayIcon className="mr-1.5 inline h-4 w-4" /> Choose PDF
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-2">
                <ShieldCheckIcon className="h-5 w-5 text-indigo-600" />
                <h3 className="text-sm font-semibold text-gray-800">Visual approval evidence</h3>
              </div>
              <p className="mt-1 text-xs text-gray-500">Select these only after visually confirming them in the signed document.</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={evidence.signatureVerified} onChange={(event) => setEvidence(current => ({ ...current, signatureVerified: event.target.checked }))} className="h-4 w-4 rounded border-gray-300 text-indigo-600" />
                  Approval signature is visible
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={evidence.stampVerified} onChange={(event) => setEvidence(current => ({ ...current, stampVerified: event.target.checked }))} className="h-4 w-4 rounded border-gray-300 text-indigo-600" />
                  Company stamp is visible
                </label>
                <label className="text-xs font-semibold text-gray-600">
                  Approved by
                  <input type="text" value={evidence.approvedByName} onChange={(event) => setEvidence(current => ({ ...current, approvedByName: event.target.value }))} className="mt-1 block h-10 w-full rounded-lg border border-gray-300 px-3 text-sm font-normal" placeholder="Approver name" />
                </label>
                <label className="text-xs font-semibold text-gray-600">
                  Approval date
                  <input type="date" value={evidence.approvedDate} onChange={(event) => setEvidence(current => ({ ...current, approvedDate: event.target.value }))} className="mt-1 block h-10 w-full rounded-lg border border-gray-300 px-3 text-sm font-normal" />
                </label>
                <label className="text-xs font-semibold text-gray-600 sm:col-span-2">
                  Approver title
                  <input type="text" value={evidence.approvedByTitle} onChange={(event) => setEvidence(current => ({ ...current, approvedByTitle: event.target.value }))} className="mt-1 block h-10 w-full rounded-lg border border-gray-300 px-3 text-sm font-normal" placeholder="Position or role" />
                </label>
              </div>
            </div>

            {error && (
              <div className="flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <ExclamationTriangleIcon className="h-5 w-5 flex-none" /> {error}
              </div>
            )}

            {result && (
              <>
                <div className="flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                  <CheckCircleIcon className="h-6 w-6 flex-none" />
                  <div>
                    <p className="font-semibold">PO {result.po_number} was {result.operation} successfully.</p>
                    <p className="mt-1">Database verification passed and the signed PDF is linked to document {result.document_id}.</p>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-gray-200 p-4">
                    <p className="text-xs text-gray-500">PR-to-PO integrity</p>
                    <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-gray-800"><LinkIcon className="h-4 w-4 text-emerald-600" /> {result.pr_number}</p>
                    <p className="mt-1 break-all text-xs text-gray-500">PR ID: {result.pr_id}</p>
                  </div>
                  <div className="rounded-xl border border-gray-200 p-4">
                    <p className="text-xs text-gray-500">Mapped supplier</p>
                    <p className="mt-1 text-sm font-semibold text-gray-800">{result.vendor_name}</p>
                    <p className="mt-1 break-all text-xs text-gray-500">Vendor ID: {result.vendor_id}</p>
                  </div>
                </div>
                <IssueList title="Extraction or mapping issues" items={result.mapping_issues} />
                <IssueList title="Workflow issues requiring review" items={result.workflow_issues} tone="red" />
                {!result.mapping_issues?.length && !result.workflow_issues?.length && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">No extraction, mapping, or workflow issues were reported.</div>
                )}
              </>
            )}
          </div>

          <div className="flex justify-end gap-2 border-t border-gray-200 bg-gray-50 px-6 py-4">
            <button type="button" onClick={resetAndClose} disabled={loading} className="h-9 rounded-lg border border-gray-300 bg-white px-4 text-xs font-semibold text-gray-700">{result ? 'Close' : 'Cancel'}</button>
            {!result && (
              <button type="button" disabled={!file || file.size > 15 * 1024 * 1024 || loading} onClick={importPdf} className="h-9 rounded-lg bg-emerald-600 px-4 text-xs font-semibold text-white disabled:opacity-50">
                {loading ? 'Extracting and importing...' : 'Import Signed PDF'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

PurchaseOrderPdfImport.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onImported: PropTypes.func,
};

export default PurchaseOrderPdfImport;
