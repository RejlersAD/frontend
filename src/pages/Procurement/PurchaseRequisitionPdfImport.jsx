import React, { useRef, useState } from 'react';
import PropTypes from 'prop-types';
import {
  ArrowUpTrayIcon,
  CheckBadgeIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import apiClient from '../../services/api.service';

const ROLE_LABELS = { pm: 'Project Manager', moe: 'Manager of Engineering', mop: 'Manager of Projects', vp: 'VP Operations' };
const MAX_SIGNED_PR_PDF_SIZE = 15 * 1024 * 1024;

export const validateSignedRequisitionPdf = (file) => {
  if (!file) throw new Error('Select an approved PR PDF first.');
  const hasPdfExtension = file.name?.toLowerCase().endsWith('.pdf');
  const hasPdfMimeType = file.type === 'application/pdf';
  if (!hasPdfExtension && !hasPdfMimeType) throw new Error('Signed Purchase Requisition must be a PDF file.');
  if (file.size <= 0) throw new Error('Signed Purchase Requisition PDF is empty.');
  if (file.size > MAX_SIGNED_PR_PDF_SIZE) throw new Error('Signed Purchase Requisition PDF must not exceed 15 MB.');
};

export const uploadSignedRequisitionPdf = async (file, expectedPrNumber = '', approvalDate = '') => {
  validateSignedRequisitionPdf(file);
  const body = new FormData();
  body.append('file', file);
  if (expectedPrNumber) body.append('expected_pr_number', expectedPrNumber);
  if (approvalDate) body.append('approval_date', approvalDate);
  const response = await apiClient.post('/procurement/requisitions/import-signed-pdf/', body, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 180000,
  });
  return response.data;
};

const PurchaseRequisitionPdfImport = ({ isOpen, onClose, onImported, expectedPrNumber = '' }) => {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [approvalDate, setApprovalDate] = useState('');

  if (!isOpen) return null;

  const close = () => {
    if (loading) return;
    setFile(null);
    setError('');
    setResult(null);
    setApprovalDate('');
    onClose();
  };

  const upload = async () => {
    if (!file) return setError('Select an approved PR PDF first.');
    setLoading(true);
    setError('');
    try {
      const data = await uploadSignedRequisitionPdf(file, expectedPrNumber, approvalDate);
      setResult(data);
      onImported?.(data);
    } catch (requestError) {
      setError(
        requestError.response?.data?.error
        || requestError.response?.data?.detail
        || (requestError.code === 'ECONNABORTED'
          ? 'PDF capture timed out. Try a clearer or smaller scan.'
          : requestError.message || 'The approved PR PDF could not be captured.'),
      );
    } finally {
      setLoading(false);
    }
  };

  const detection = result?.approval_detection || {};
  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center px-4 py-8">
        <button type="button" aria-label="Close approved PR import" className="fixed inset-0 bg-black/50" onClick={close} />
        <div className="relative w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl">
          <div className="flex items-start justify-between bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4 text-white">
            <div>
              <h2 className="text-lg font-bold">Import Approved PR PDF</h2>
              <p className="mt-1 text-xs text-indigo-100">RADAI detects the PR number, matches the database record, captures its details, and verifies approval evidence.</p>
            </div>
            <button type="button" onClick={close} disabled={loading}><XMarkIcon className="h-6 w-6" /></button>
          </div>

          <div className="max-h-[72vh] space-y-5 overflow-y-auto p-6">
            {expectedPrNumber && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
                Edit attachment must match <strong>{expectedPrNumber}</strong>. A different PR number is rejected without changing the database.
              </div>
            )}
            <div className="rounded-xl border border-dashed border-indigo-300 bg-indigo-50/50 p-5">
              <input ref={inputRef} type="file" accept=".pdf,application/pdf" className="hidden" onChange={(event) => { setFile(event.target.files?.[0] || null); setResult(null); setError(''); }} />
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-800">{file?.name || 'Select signed or approved PR PDF'}</p>
                  <p className="mt-1 text-xs text-gray-500">PDF only, maximum 15 MB. The original document is retained as approval evidence.</p>
                </div>
                <button type="button" onClick={() => inputRef.current?.click()} disabled={loading} className="h-9 rounded-lg border border-indigo-300 bg-white px-3 text-xs font-semibold text-indigo-700">
                  <ArrowUpTrayIcon className="mr-1.5 inline h-4 w-4" /> Choose PDF
                </button>
              </div>
            </div>

            <label className="block text-xs font-semibold text-gray-600">
              Approval date override (only when the handwritten date is visually clear)
              <input type="date" value={approvalDate} onChange={(event) => setApprovalDate(event.target.value)} className="mt-1 block h-10 w-full rounded-lg border border-gray-300 px-3 text-sm font-normal" />
              <span className="mt-1 block font-normal text-gray-500">Leave blank for automatic OCR. Enter it only when handwriting OCR cannot read the visible date.</span>
            </label>

            {error && <div className="flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"><ExclamationTriangleIcon className="h-5 w-5 flex-none" />{error}</div>}

            {result && (
              <>
                <div className="flex gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                  <CheckCircleIcon className="h-5 w-5 flex-none" />
                  <div><strong>{result.pr_number}</strong> matched and attached. Database status: <strong>{result.status}</strong>.</div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {Object.entries(ROLE_LABELS).map(([key, label]) => (
                    <div key={key} className="rounded-lg border border-gray-200 p-3">
                      <p className="text-xs text-gray-500">{label}</p>
                      <p className="mt-1 text-sm font-semibold text-gray-800">{detection.approver_names?.[key] || 'Name not detected'}</p>
                      <p className={`mt-1 inline-flex items-center gap-1 text-xs font-semibold ${detection.signatures?.[key] ? 'text-emerald-700' : 'text-red-700'}`}>
                        <CheckBadgeIcon className="h-4 w-4" /> {detection.signatures?.[key] ? 'Signature detected' : 'Signature not detected'}
                      </p>
                    </div>
                  ))}
                </div>
                <div className={`rounded-lg border p-3 text-sm ${detection.approval_date ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
                  Approval date: <strong>{detection.approval_date || (detection.date_present ? 'Visible but requires review' : 'Not detected')}</strong>
                </div>
                {[...(result.mapping_issues || []), ...(result.workflow_issues || [])].length > 0 && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    <p className="font-semibold">Review required</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5">{[...(result.mapping_issues || []), ...(result.workflow_issues || [])].map((issue) => <li key={issue}>{issue}</li>)}</ul>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="flex justify-end gap-2 border-t border-gray-200 bg-gray-50 px-6 py-4">
            <button type="button" onClick={close} disabled={loading} className="h-9 rounded-lg border border-gray-300 bg-white px-4 text-xs font-semibold text-gray-700">{result ? 'Close' : 'Cancel'}</button>
            {!result && <button type="button" onClick={upload} disabled={!file || loading} className="h-9 rounded-lg bg-emerald-600 px-4 text-xs font-semibold text-white disabled:opacity-50">{loading ? 'Capturing and verifying...' : 'Capture Approved PR'}</button>}
          </div>
        </div>
      </div>
    </div>
  );
};

PurchaseRequisitionPdfImport.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onImported: PropTypes.func,
  expectedPrNumber: PropTypes.string,
};

export default PurchaseRequisitionPdfImport;
