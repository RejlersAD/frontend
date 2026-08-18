import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import {
  ArrowPathIcon,
  ArrowUpTrayIcon,
  CheckBadgeIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import apiClient from '../../services/api.service';

const ROLE_LABELS = { pm: 'Project Manager', moe: 'Manager of Engineering', mop: 'Manager of Projects', vp: 'VP Operations' };
const MAX_SIGNED_PR_PDF_SIZE = 15 * 1024 * 1024;
const EDITABLE_FIELDS = [
  ['pr_number', 'PR Number', 'text', true],
  ['issued_by_name', 'Issued By', 'text', true],
  ['issued_date', 'Issued Date', 'date', true],
  ['product_service', 'Product / Service', 'textarea', true],
  ['supplier_name', 'Supplier Name', 'text', true],
  ['supplier_business_id', 'Supplier Business ID', 'text', false],
  ['project_department', 'Project / Department', 'textarea', false],
  ['project_number', 'Project Number', 'text', false],
  ['description_reason', 'Description and Reason', 'textarea', true],
  ['preferred_supplier', 'Preferred Supplier', 'text', false],
  ['net_total', 'Total Price', 'number', true],
  ['currency', 'Currency', 'select', true],
  ['budget_in_aed', 'Budget in AED', 'number', false],
  ['net_total_aed', 'Net Total in AED', 'number', false],
  ['po_reference', 'PO Reference', 'text', false],
  ['special_notes', 'Special Notes', 'textarea', false],
];

export const validateSignedRequisitionPdf = (file) => {
  if (!file) throw new Error('Select an approved PR PDF first.');
  const hasPdfExtension = file.name?.toLowerCase().endsWith('.pdf');
  const hasPdfMimeType = file.type === 'application/pdf';
  if (!hasPdfExtension && !hasPdfMimeType) throw new Error('Signed Purchase Requisition must be a PDF file.');
  if (file.size <= 0) throw new Error('Signed Purchase Requisition PDF is empty.');
  if (file.size > MAX_SIGNED_PR_PDF_SIZE) throw new Error('Signed Purchase Requisition PDF must not exceed 15 MB.');
};

const submitSignedRequisitionPdf = async (file, payload = {}) => {
  validateSignedRequisitionPdf(file);
  const body = new FormData();
  body.append('file', file);
  Object.entries(payload).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') body.append(key, value);
  });
  const response = await apiClient.post('/procurement/requisitions/import-signed-pdf/', body, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 180000,
  });
  return response.data;
};

export const uploadSignedRequisitionPdf = async (file, expectedPrNumber = '', approvalDate = '') => (
  submitSignedRequisitionPdf(file, {
    expected_pr_number: expectedPrNumber,
    approval_date: approvalDate,
  })
);

const errorMessage = (requestError, fallback) => (
  requestError.response?.data?.error
  || requestError.response?.data?.detail
  || (requestError.code === 'ECONNABORTED'
    ? 'PDF capture timed out. Try a clearer or smaller scan.'
    : requestError.message || fallback)
);

const PurchaseRequisitionPdfImport = ({ isOpen, onClose, onImported, expectedPrNumber = '' }) => {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [fileUrl, setFileUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [edits, setEdits] = useState({});

  useEffect(() => {
    if (!file) {
      setFileUrl('');
      return undefined;
    }
    const url = window.URL.createObjectURL(file);
    setFileUrl(url);
    return () => window.URL.revokeObjectURL(url);
  }, [file]);

  if (!isOpen) return null;

  const reset = () => {
    if (inputRef.current) inputRef.current.value = '';
    setFile(null);
    setError('');
    setPreview(null);
    setResult(null);
    setEdits({});
  };

  const close = () => {
    if (loading) return;
    reset();
    onClose();
  };

  const chooseFile = (selectedFile) => {
    setFile(selectedFile || null);
    setPreview(null);
    setResult(null);
    setEdits({});
    setError('');
  };

  const capturePreview = async () => {
    if (!file) return setError('Select an approved PR PDF first.');
    setLoading(true);
    setError('');
    try {
      const data = await submitSignedRequisitionPdf(file, {
        preview_only: 'true',
        expected_pr_number: expectedPrNumber,
      });
      const extracted = data.extracted_data || {};
      const approvers = data.approval_detection?.approver_names || {};
      setPreview(data);
      setEdits({
        ...extracted,
        approval_date: data.approval_detection?.approval_date || '',
        pm_name: approvers.pm || '',
        moe_name: approvers.moe || '',
        mop_name: approvers.mop || '',
        vp_name: approvers.vp || '',
      });
    } catch (requestError) {
      setError(errorMessage(requestError, 'The approved PR PDF could not be previewed.'));
    } finally {
      setLoading(false);
    }
  };

  const saveReviewed = async () => {
    setLoading(true);
    setError('');
    try {
      const manualOverrides = Object.fromEntries(
        EDITABLE_FIELDS.map(([key]) => [key, edits[key] ?? '']),
      );
      const data = await submitSignedRequisitionPdf(file, {
        expected_pr_number: expectedPrNumber,
        approval_date: edits.approval_date || '',
        pm_name: edits.pm_name || '',
        moe_name: edits.moe_name || '',
        mop_name: edits.mop_name || '',
        vp_name: edits.vp_name || '',
        manual_overrides: JSON.stringify(manualOverrides),
      });
      setResult(data);
      onImported?.(data);
    } catch (requestError) {
      setError(errorMessage(requestError, 'The reviewed PR data could not be saved.'));
    } finally {
      setLoading(false);
    }
  };

  const detection = (result || preview)?.approval_detection || {};
  const confidence = preview?.extracted_data?.field_confidence || {};
  const allIssues = [
    ...((result || preview)?.mapping_issues || []),
    ...((result || preview)?.workflow_issues || []),
  ];

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center px-4 py-8">
        <button type="button" aria-label="Close approved PR import" className="fixed inset-0 bg-black/50" onClick={close} />
        <div className="relative w-full max-w-7xl overflow-hidden rounded-2xl bg-white shadow-2xl">
          <div className="flex items-start justify-between bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4 text-white">
            <div>
              <h2 className="text-lg font-bold">Import Approved PR PDF</h2>
              <p className="mt-1 text-xs text-indigo-100">Review OCR beside the original PDF, correct uncertain fields, then save the verified values.</p>
            </div>
            <button type="button" onClick={close} disabled={loading}><XMarkIcon className="h-6 w-6" /></button>
          </div>

          <div className="max-h-[78vh] space-y-5 overflow-y-auto p-6">
            {expectedPrNumber && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
                This attachment must match <strong>{expectedPrNumber}</strong>. Manual correction cannot attach it to a different PR.
              </div>
            )}

            {!preview && !result && (
              <div className="rounded-xl border border-dashed border-indigo-300 bg-indigo-50/50 p-5">
                <input ref={inputRef} type="file" accept=".pdf,application/pdf" className="hidden" onChange={(event) => chooseFile(event.target.files?.[0])} />
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{file?.name || 'Select signed or approved PR PDF'}</p>
                    <p className="mt-1 text-xs text-gray-500">OCR preview does not modify the database. The original PDF is stored only after Save.</p>
                  </div>
                  <button type="button" onClick={() => inputRef.current?.click()} disabled={loading} className="h-9 rounded-lg border border-indigo-300 bg-white px-3 text-xs font-semibold text-indigo-700">
                    <ArrowUpTrayIcon className="mr-1.5 inline h-4 w-4" /> Choose PDF
                  </button>
                </div>
              </div>
            )}

            {error && <div className="flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"><ExclamationTriangleIcon className="h-5 w-5 flex-none" />{error}</div>}

            {preview && !result && (
              <div className="grid gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.95fr)]">
                <div className="min-h-[680px] overflow-hidden rounded-xl border border-gray-300 bg-gray-100">
                  {fileUrl && <iframe src={`${fileUrl}#toolbar=0&navpanes=0`} title="Approved PR source PDF" className="h-[74vh] min-h-[680px] w-full" />}
                </div>
                <div className="space-y-4">
                  <div className={`rounded-lg border p-3 text-sm ${preview.requires_manual_review ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-emerald-300 bg-emerald-50 text-emerald-900'}`}>
                    <p className="font-semibold">{preview.requires_manual_review ? 'Manual review required' : 'OCR confidence checks passed'}</p>
                    <p className="mt-1 text-xs">Compare every value with the PDF. Edited values are recorded as manually verified.</p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {EDITABLE_FIELDS.map(([key, label, inputType, required]) => {
                      const confidenceKey = ({ issued_by_name: 'issued_by', supplier_name: 'supplier', description_reason: 'description', net_total: 'price' })[key] || key;
                      const fieldConfidence = confidence[confidenceKey];
                      const baseClass = `mt-1 w-full rounded-lg border px-3 py-2 text-sm ${fieldConfidence === 'missing' ? 'border-amber-400 bg-amber-50' : 'border-gray-300'}`;
                      return (
                        <label key={key} className={inputType === 'textarea' ? 'sm:col-span-2 text-xs font-semibold text-gray-700' : 'text-xs font-semibold text-gray-700'}>
                          <span>{label}{required && <span className="text-red-500"> *</span>}</span>
                          {fieldConfidence && <span className={`ml-2 rounded px-1.5 py-0.5 text-[10px] uppercase ${fieldConfidence === 'missing' ? 'bg-amber-200 text-amber-900' : 'bg-emerald-100 text-emerald-700'}`}>{fieldConfidence}</span>}
                          {inputType === 'textarea' ? (
                            <textarea rows={3} value={edits[key] ?? ''} onChange={(event) => setEdits((current) => ({ ...current, [key]: event.target.value }))} className={baseClass} />
                          ) : inputType === 'select' ? (
                            <select value={edits[key] ?? ''} onChange={(event) => setEdits((current) => ({ ...current, [key]: event.target.value }))} className={baseClass}>
                              <option value="">Select currency</option>
                              {['AED', 'USD', 'EUR', 'GBP'].map((currency) => <option key={currency} value={currency}>{currency}</option>)}
                            </select>
                          ) : (
                            <input type={inputType} step={inputType === 'number' ? '0.01' : undefined} value={edits[key] ?? ''} onChange={(event) => setEdits((current) => ({ ...current, [key]: event.target.value }))} className={baseClass} />
                          )}
                        </label>
                      );
                    })}
                  </div>

                  <div className="rounded-xl border border-gray-200 p-3">
                    <p className="text-sm font-semibold text-gray-800">Approval evidence</p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      {Object.entries(ROLE_LABELS).map(([key, label]) => (
                        <label key={key} className="text-xs font-semibold text-gray-700">
                          {label}
                          <input value={edits[`${key}_name`] || ''} onChange={(event) => setEdits((current) => ({ ...current, [`${key}_name`]: event.target.value }))} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                          <span className={`mt-1 inline-flex items-center gap-1 ${detection.signatures?.[key] ? 'text-emerald-700' : 'text-red-700'}`}><CheckBadgeIcon className="h-4 w-4" />{detection.signatures?.[key] ? 'Signature detected' : 'Signature not detected'}</span>
                        </label>
                      ))}
                      <label className="text-xs font-semibold text-gray-700 sm:col-span-2">
                        Approval Date
                        <input type="date" value={edits.approval_date || ''} onChange={(event) => setEdits((current) => ({ ...current, approval_date: event.target.value }))} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {result && (
              <div className="space-y-4">
                <div className="flex gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                  <CheckCircleIcon className="h-5 w-5 flex-none" />
                  <div><strong>{result.pr_number}</strong> was manually reviewed, attached, and saved. Database status: <strong>{result.status}</strong>.</div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {Object.entries(ROLE_LABELS).map(([key, label]) => (
                    <div key={key} className="rounded-lg border border-gray-200 p-3">
                      <p className="text-xs text-gray-500">{label}</p>
                      <p className="mt-1 text-sm font-semibold text-gray-800">{detection.approver_names?.[key] || 'Name not detected'}</p>
                      <p className={`mt-1 text-xs font-semibold ${detection.signatures?.[key] ? 'text-emerald-700' : 'text-red-700'}`}>{detection.signatures?.[key] ? 'Signature detected' : 'Signature not detected'}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {allIssues.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                <p className="font-semibold">Review notes</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">{allIssues.map((issue, index) => <li key={`${issue}-${index}`}>{issue}</li>)}</ul>
              </div>
            )}
          </div>

          <div className="flex justify-between gap-2 border-t border-gray-200 bg-gray-50 px-6 py-4">
            <div>
              {preview && !result && <button type="button" onClick={reset} disabled={loading} className="inline-flex h-9 items-center rounded-lg border border-gray-300 bg-white px-4 text-xs font-semibold text-gray-700"><ArrowPathIcon className="mr-1.5 h-4 w-4" />Start Over</button>}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={close} disabled={loading} className="h-9 rounded-lg border border-gray-300 bg-white px-4 text-xs font-semibold text-gray-700">{result ? 'Close' : 'Cancel'}</button>
              {!preview && !result && <button type="button" onClick={capturePreview} disabled={!file || loading} className="h-9 rounded-lg bg-indigo-600 px-4 text-xs font-semibold text-white disabled:opacity-50">{loading ? 'Running OCR...' : 'Preview OCR'}</button>}
              {preview && !result && <button type="button" onClick={saveReviewed} disabled={loading} className="h-9 rounded-lg bg-emerald-600 px-4 text-xs font-semibold text-white disabled:opacity-50">{loading ? 'Validating and saving...' : 'Save Reviewed PR'}</button>}
            </div>
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
