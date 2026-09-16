import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import PurchaseOrderLinkReview from './PurchaseOrderLinkReview';
import {
  ArrowPathIcon,
  ArrowUpTrayIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import apiClient from '../../services/api.service';
import { employeeDisplayName } from '../../utils/employeeDisplayName';
import { calculateProcurementVat, PROCUREMENT_VAT_OPTIONS } from '../../utils/procurementVat';

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
  ['net_total', 'Entered price', 'number', true],
  ['currency', 'Currency', 'select', true],
  ['price_remarks', 'Price Remarks / Sales Budget', 'textarea', false],
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
    attach_only: expectedPrNumber ? 'true' : undefined,
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

const PurchaseRequisitionPdfImport = ({ isOpen, onClose, onImported, expectedPrNumber = '', canLinkPurchaseOrder = true }) => {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [fileUrl, setFileUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [edits, setEdits] = useState({});
  const [manualSignatures, setManualSignatures] = useState({});
  const [employees, setEmployees] = useState([]);
  const [employeeLoadError, setEmployeeLoadError] = useState('');
  const [recordCheck, setRecordCheck] = useState(null);
  useEffect(() => {
    if (!file) {
      setFileUrl('');
      return undefined;
    }
    const url = window.URL.createObjectURL(file);
    setFileUrl(url);
    return () => window.URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    if (!isOpen) return undefined;
    let active = true;
    setEmployeeLoadError('');
    apiClient.get('/procurement/requisitions/get_approvers/', { params: { role: 'any_active' } })
      .then((response) => {
        if (!active) return;
        const payload = response.data?.data || response.data || {};
        setEmployees(Array.isArray(payload.users) ? payload.users : []);
      })
      .catch(() => {
        if (active) setEmployeeLoadError('Employee search is unavailable. You can still edit signer names manually.');
      });
    return () => { active = false; };
  }, [isOpen]);

  if (!isOpen) return null;

  const reset = () => {
    if (inputRef.current) inputRef.current.value = '';
    setFile(null);
    setError('');
    setPreview(null);
    setResult(null);
    setEdits({});
    setManualSignatures({});
    setRecordCheck(null);
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
    setManualSignatures({});
    setError('');
    setRecordCheck(null);
  };

  const capturePreview = async () => {
    if (!file) return setError('Select an approved PR PDF first.');
    setLoading(true);
    setError('');
    try {
      const data = await submitSignedRequisitionPdf(file, {
        preview_only: 'true',
        expected_pr_number: expectedPrNumber,
        attach_only: expectedPrNumber ? 'true' : undefined,
      });
      const extracted = data.extracted_data || {};
      const approvers = data.approval_detection?.approver_names || {};
      setPreview(data);
      setRecordCheck({ number: String(extracted.pr_number || data.pr_number || '').trim().toUpperCase(), exists: data.database_match });
      setEdits({
        ...extracted,
        vat_basis: 'unconfirmed',
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

  const reviewedNumber = String(edits.pr_number || '').trim().toUpperCase();
  const numberNeedsCheck = !reviewedNumber || !recordCheck || typeof recordCheck.exists !== 'boolean' || reviewedNumber !== recordCheck.number;
  const sourceNumber = String(preview?.extracted_data?.pr_number || preview?.pr_number || '').trim().toUpperCase();
  const attachmentNumber = expectedPrNumber || (!numberNeedsCheck && recordCheck?.exists ? reviewedNumber : '');
  const expectedMismatch = Boolean(attachmentNumber && (sourceNumber !== attachmentNumber.trim().toUpperCase() || preview?.document_comparison?.identity_matched === false));
  const createNew = !expectedPrNumber && !numberNeedsCheck && recordCheck.exists === false;
  const missingBoundRecord = Boolean(expectedPrNumber && recordCheck?.exists === false);

  const checkReviewedNumber = async () => {
    if (!reviewedNumber) return setError('Enter the PR number shown on the PDF.');
    setLoading(true);
    setError('');
    try {
      const response = await apiClient.post('/procurement/requisitions/check_pr_number/', { pr_number: reviewedNumber });
      if (typeof response.data?.exists !== 'boolean') throw new Error('The PR number could not be checked. Please retry.');
      setRecordCheck({ number: reviewedNumber, exists: response.data.exists });
    } catch (requestError) {
      setError(errorMessage(requestError, 'The PR number could not be checked.'));
    } finally {
      setLoading(false);
    }
  };

  const saveReviewed = async () => {
    if (numberNeedsCheck || expectedMismatch || missingBoundRecord) return;
    setLoading(true);
    setError('');
    try {
      const manualOverrides = attachmentNumber ? {} : Object.fromEntries(
        EDITABLE_FIELDS.map(([key]) => [key, edits[key] ?? '']),
      );
      if (!attachmentNumber && edits.vat_basis !== 'unconfirmed') {
        manualOverrides.vat_basis = edits.vat_basis;
        manualOverrides.entered_amount = edits.net_total;
      }
      if (!attachmentNumber && edits.price_lines?.length) manualOverrides.price_lines = edits.price_lines;
      const manualSignatureOverrides = Object.fromEntries(
        Object.entries(manualSignatures).filter(([, verified]) => verified),
      );
      const data = await submitSignedRequisitionPdf(file, {
        expected_pr_number: attachmentNumber,
        attach_only: attachmentNumber ? 'true' : undefined,
        approval_date: edits.approval_date || '',
        pm_name: preview?.document_signed_off ? undefined : edits.pm_name || '',
        moe_name: preview?.document_signed_off ? undefined : edits.moe_name || '',
        mop_name: preview?.document_signed_off ? undefined : edits.mop_name || '',
        vp_name: preview?.document_signed_off ? undefined : edits.vp_name || '',
        manual_overrides: JSON.stringify(manualOverrides),
        manual_signature_overrides: preview?.document_signed_off ? undefined : JSON.stringify(manualSignatureOverrides),
        create_new: createNew ? 'true' : undefined,
      });
      const unacknowledgedSignatures = Object.keys(manualSignatureOverrides).filter(
        (role) => !data.approval_detection?.signatures?.[role],
      );
      if (unacknowledgedSignatures.length) {
        throw new Error(`Manual signature verification was not saved for: ${unacknowledgedSignatures.map((role) => ROLE_LABELS[role]).join(', ')}. Please retry.`);
      }
      setResult(data);
      onImported?.(data);
    } catch (requestError) {
      setError(errorMessage(requestError, 'The reviewed PR data could not be saved.'));
    } finally {
      setLoading(false);
    }
  };

  const detection = (result || preview)?.approval_detection || {};
  const documentSignedOff = Boolean((result || preview)?.document_signed_off ?? preview?.document_signed_off);
  const comparisonIssues = (preview?.document_comparison?.fields || []).filter(field => field.status === 'mismatch' || (field.status === 'missing' && field.missing_in !== 'both' && [field.current_value, field.pdf_value].some(value => value != null && String(value).trim() !== '')));
  const confidence = preview?.extracted_data?.field_confidence || {};
  const originalPriceLines = preview?.extracted_data?.price_lines || [];
  const reviewedAmounts = calculateProcurementVat(edits.net_total, 0, { basis: edits.vat_basis || 'unconfirmed' });
  const reviewedMoney = amount => amount === null ? '\u2014' : `${edits.currency || ''} ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`.trim();
  const allIssues = [...new Set([
    ...((result || preview)?.mapping_issues || []),
    ...((result || preview)?.workflow_issues || []),
  ])];

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center px-4 py-8">
        <button type="button" aria-label="Close approved PR import" className="fixed inset-0 bg-black/50" onClick={close} />
        <div role="dialog" aria-modal="true" aria-labelledby="approved-pr-import-title" className="relative w-full max-w-7xl overflow-hidden rounded-2xl bg-white shadow-2xl">
          <div className="flex items-start justify-between bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4 text-white">
            <div>
              <h2 id="approved-pr-import-title" className="text-lg font-bold">{attachmentNumber ? 'Attach signed PR PDF' : 'Import Approved PR PDF'}</h2>
            </div>
            <button type="button" aria-label="Close import dialog" onClick={close} disabled={loading}><XMarkIcon className="h-6 w-6" /></button>
          </div>

          <div className="max-h-[78vh] space-y-5 overflow-y-auto p-6">
            {attachmentNumber && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
                Attach to <strong>{attachmentNumber}</strong>. Existing recommendation values will be kept.
              </div>
            )}

            {!preview && !result && (
              <div className="rounded-xl border border-dashed border-indigo-300 bg-indigo-50/50 p-5">
                <input ref={inputRef} type="file" accept=".pdf,application/pdf" className="hidden" onChange={(event) => chooseFile(event.target.files?.[0])} />
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{file?.name || 'Select signed or approved PR PDF'}</p>
                  </div>
                  <button type="button" onClick={() => inputRef.current?.click()} disabled={loading} className="h-9 rounded-lg border border-indigo-300 bg-white px-3 text-xs font-semibold text-indigo-700">
                    <ArrowUpTrayIcon className="mr-1.5 inline h-4 w-4" /> Choose PDF
                  </button>
                </div>
              </div>
            )}

            {error && <div role="alert" className="flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"><ExclamationTriangleIcon className="h-5 w-5 flex-none" />{error}</div>}

            {preview && !result && <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900" role="status">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{expectedMismatch ? 'PR number does not match this recommendation' : missingBoundRecord ? 'The original recommendation is no longer available' : numberNeedsCheck ? 'Check the corrected PR number' : attachmentNumber ? 'Attach the signed PDF' : recordCheck?.exists ? 'Update existing recommendation' : 'Create a recommendation from this PDF'}</p>
                  <p className="mt-1 text-xs">{expectedMismatch ? `The PDF number is ${sourceNumber || 'not detected'}. Select the PDF for ${attachmentNumber}.` : missingBoundRecord ? 'Close this attachment flow and select an existing recommendation.' : numberNeedsCheck ? 'The PR number was edited. Check whether it already exists before saving.' : attachmentNumber ? `${attachmentNumber} exists in RADAI. Review any differences below before attaching.` : recordCheck?.exists ? `${reviewedNumber} exists in RADAI. Saving will update it and attach this PDF.` : `${reviewedNumber} is not in RADAI. Review the fields below, including the PR number, then create it from this PDF.`}</p>
                </div>
                {!attachmentNumber && <button type="button" onClick={checkReviewedNumber} disabled={loading || !reviewedNumber} className="h-9 rounded-lg border border-blue-300 bg-white px-3 text-xs font-semibold text-blue-700">Check PR number</button>}
              </div>
            </div>}

            {preview && !result && (
              <div className="grid gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.95fr)]">
                <div className="min-h-[680px] overflow-hidden rounded-xl border border-gray-300 bg-gray-100">
                  {fileUrl && <iframe src={`${fileUrl}#toolbar=0&navpanes=0`} title="Approved PR source PDF" className="h-[74vh] min-h-[680px] w-full" />}
                </div>
                <div className="space-y-4">
                  {attachmentNumber && <label className="block text-xs font-semibold text-gray-700">PR Number<input aria-label="PR Number" readOnly value={sourceNumber} className="mt-1 w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm" /></label>}
                  {comparisonIssues.length > 0 && <section aria-label="Differences between recommendation and PDF" className="rounded-lg border border-amber-300 bg-amber-50 p-3">
                    <h3 className="text-sm font-semibold text-amber-900">Review differences</h3>
                    <div className="mt-2 overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr><th scope="col" className="p-2">Field</th><th scope="col" className="p-2">Current recommendation</th><th scope="col" className="p-2">Signed PDF</th></tr></thead><tbody>{comparisonIssues.map(field => <tr key={field.field} className="border-t border-amber-200"><th scope="row" className="p-2 font-semibold">{field.label}</th><td className="p-2">{field.current_value == null || field.current_value === '' ? 'Not provided' : String(field.current_value)}</td><td className="p-2">{field.pdf_value == null || field.pdf_value === '' ? 'Not detected' : String(field.pdf_value)}</td></tr>)}</tbody></table></div>
                  </section>}
                  {!attachmentNumber && <div className="grid gap-3 sm:grid-cols-2">
                    {EDITABLE_FIELDS.map(([key, label, inputType, required]) => {
                      const confidenceKey = ({ issued_by_name: 'issued_by', supplier_name: 'supplier', description_reason: 'description', net_total: 'price' })[key] || key;
                      const edited = String(edits[key] ?? '') !== String(preview.extracted_data?.[key] ?? '');
                      const missing = !String(edits[key] ?? '').trim();
                      const conflicting = !missing && !edited && (confidence[key] || confidence[confidenceKey]) === 'conflict';
                      const fieldError = required && missing ? `Enter ${label.toLowerCase()}.` : conflicting ? 'Conflicting values. Check this field against the PDF.' : '';
                      const errorId = `approved-pr-${key}-error`;
                      const fieldAccessibility = { 'aria-label': label, 'aria-invalid': Boolean(fieldError), 'aria-describedby': fieldError ? errorId : undefined };
                      const baseClass = `mt-1 w-full rounded-lg border px-3 py-2 text-sm ${fieldError ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white'}`;
                      return (
                        <label key={key} className={inputType === 'textarea' ? 'sm:col-span-2 text-xs font-semibold text-gray-700' : 'text-xs font-semibold text-gray-700'}>
                          <span>{label}{required && <span className="text-red-500"> *</span>}</span>
                          {inputType === 'textarea' ? (
                            <textarea {...fieldAccessibility} rows={3} value={edits[key] ?? ''} onChange={(event) => setEdits((current) => ({ ...current, [key]: event.target.value }))} className={baseClass} />
                          ) : inputType === 'select' ? (
                            <select {...fieldAccessibility} value={edits[key] ?? ''} onChange={(event) => setEdits((current) => ({ ...current, [key]: event.target.value }))} className={baseClass}>
                              <option value="">Select currency</option>
                              {['AED', 'USD', 'EUR', 'GBP'].map((currency) => <option key={currency} value={currency}>{currency}</option>)}
                            </select>
                          ) : (
                            <input {...fieldAccessibility} type={inputType} list={key === 'issued_by_name' ? 'approved-pr-active-employees' : undefined} step={inputType === 'number' ? '0.01' : undefined} value={edits[key] ?? ''} onChange={(event) => setEdits((current) => ({ ...current, [key]: event.target.value }))} className={baseClass} />
                          )}
                          {fieldError && <span id={errorId} className="mt-1 block text-xs font-normal text-red-700">{fieldError}</span>}
                        </label>
                      );
                    })}
                  </div>}

                  {!attachmentNumber && <label className="block text-xs font-semibold text-gray-700">Does this price include VAT?<select aria-label="VAT price basis" value={edits.vat_basis || 'unconfirmed'} onChange={event => setEdits(previous => ({ ...previous, vat_basis: event.target.value }))} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"><option value="unconfirmed" disabled>Confirm VAT treatment</option>{PROCUREMENT_VAT_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>}
                  {!attachmentNumber && edits.vat_basis === 'unconfirmed' && <p className="text-sm text-gray-600">VAT is not confirmed. The captured amounts will be kept unless you select a VAT treatment.</p>}
                  {!attachmentNumber && edits.vat_basis !== 'unconfirmed' && <dl aria-label="Reviewed recommendation totals" className="grid gap-3 rounded-xl border border-gray-200 p-3 text-sm sm:grid-cols-3">
                    <div><dt className="text-gray-600">Net excluding VAT</dt><dd className="mt-1 font-semibold">{reviewedMoney(reviewedAmounts.netAmount)}</dd></div>
                    <div><dt className="text-gray-600">{reviewedAmounts.vatRate === 0 ? 'No VAT' : 'VAT (5%)'}</dt><dd className="mt-1 font-semibold">{reviewedMoney(reviewedAmounts.taxAmount)}</dd></div>
                    <div><dt className="text-gray-600">Total</dt><dd className="mt-1 font-semibold">{reviewedMoney(reviewedAmounts.totalAmount)}</dd></div>
                  </dl>}

                  {!attachmentNumber && originalPriceLines.length > 0 && <div className="rounded-xl border border-gray-200 p-3">
                    <h3 className="text-sm font-semibold text-gray-800">Price breakdown</h3>
                    <div className="mt-2 overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-gray-50"><tr><th className="p-2">Description</th><th className="p-2">Amount</th><th className="p-2">Remarks</th></tr></thead>
                        <tbody>{(edits.price_lines || originalPriceLines).map((line, index) => <tr key={index} className="border-t border-gray-100">
                          {['description', 'total', 'remarks'].map((field) => <td key={field} className="p-2">
                            {field === 'total' && <select aria-label={`Price line ${index + 1} currency`} value={line.currency || ''} className="mb-1 w-full rounded border border-gray-300 px-1 py-1" onChange={(event) => setEdits((current) => ({ ...current, price_lines: current.price_lines.map((item, rowIndex) => rowIndex === index ? { ...item, currency: event.target.value } : item) }))}><option value="">Currency</option>{['AED', 'USD', 'EUR', 'GBP'].map((currency) => <option key={currency} value={currency}>{currency}</option>)}</select>}
                            <input aria-label={`Price line ${index + 1} ${field === 'total' ? 'amount' : field}`} type={field === 'total' ? 'number' : 'text'} step={field === 'total' ? '0.01' : undefined} value={line[field] || ''} className="w-full min-w-[90px] rounded border border-gray-300 px-2 py-1" onChange={(event) => setEdits((current) => ({ ...current, price_lines: current.price_lines.map((item, rowIndex) => rowIndex === index ? { ...item, [field]: event.target.value } : item) }))} />
                          </td>)}
                        </tr>)}</tbody>
                      </table>
                    </div>
                  </div>}

                  {(!documentSignedOff || !detection.approval_date) && <div className="rounded-xl border border-gray-200 p-3">
                    {!documentSignedOff && employeeLoadError && <p className="mt-2 text-xs text-amber-700">{employeeLoadError}</p>}
                    <datalist id="approved-pr-active-employees">
                      {employees.map((employee) => (
                        <option key={employee.id} value={employeeDisplayName(employee)}>
                          {[employee.email, employee.job_title, employee.department].filter(Boolean).join(' · ')}
                        </option>
                      ))}
                    </datalist>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {!documentSignedOff && Object.entries(ROLE_LABELS).map(([key, label]) => {
                        const automaticallyDetected = Boolean(detection.signatures?.[key]);
                        const manuallyVerified = Boolean(manualSignatures[key]);
                        return (
                          <div key={key} className={`rounded-lg border p-3 ${automaticallyDetected || manuallyVerified ? 'border-gray-200 bg-white' : 'border-red-200 bg-red-50/40'}`}>
                            <label className="text-xs font-semibold text-gray-700">
                              {label}
                              <input
                                list="approved-pr-active-employees"
                                value={edits[`${key}_name`] || ''}
                                onChange={(event) => setEdits((current) => ({ ...current, [`${key}_name`]: event.target.value }))}
                                placeholder="Search or enter signer"
                                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                              />
                            </label>
                            {!automaticallyDetected && (
                              <label className={`mt-2 flex cursor-pointer items-start gap-2 text-xs font-semibold ${manuallyVerified ? 'text-gray-700' : 'text-red-700'}`}>
                                <input
                                  type="checkbox"
                                  checked={manuallyVerified}
                                  onChange={(event) => setManualSignatures((current) => ({ ...current, [key]: event.target.checked }))}
                                  className="mt-0.5 h-4 w-4 rounded border-red-300 text-emerald-600"
                                />
                                <span>{manuallyVerified ? 'Signature verified in PDF' : 'Verify signature in PDF'}</span>
                              </label>
                            )}
                          </div>
                        );
                      })}
                      <label className="text-xs font-semibold text-gray-700 sm:col-span-2">
                        Approval Date
                        <input aria-invalid={Boolean(detection.approval_date_evidence?.review_required && !edits.approval_date)} type="date" value={edits.approval_date || ''} onChange={(event) => setEdits((current) => ({ ...current, approval_date: event.target.value }))} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                      </label>
                      {detection.approval_date_evidence?.review_required && !edits.approval_date && <p className="text-xs text-red-700 sm:col-span-2">Enter the approval date shown in the PDF.</p>}
                    </div>
                  </div>}
                </div>
              </div>
            )}

            {result && (
              <div className="space-y-4">
                {result.financial_values_preserved && !attachmentNumber && <p className="text-sm text-gray-600">Existing financial values were kept. Confirm the VAT treatment in Edit before changing them.</p>}
                <div className="flex gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                  <CheckCircleIcon className="h-5 w-5 flex-none" />
                  <div><strong>{result.pr_number}</strong>{attachmentNumber ? ' has the signed PDF attached' : ` was ${result.created ? 'created from the reviewed PDF' : 'updated from the reviewed PDF'}`}. {attachmentNumber ? 'Existing recommendation values were kept.' : 'The source PDF is attached.'} Status: <strong>{result.status}</strong>.</div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {!documentSignedOff && Object.entries(ROLE_LABELS).filter(([key]) => !detection.signatures?.[key]).map(([key, label]) => (
                    <div key={key} className="rounded-lg border border-gray-200 p-3">
                      <p className="text-xs text-gray-500">{label}</p>
                      <p className="mt-1 text-sm font-semibold text-gray-800">{detection.approver_names?.[key] || 'Name not detected'}</p>
                      <p className="mt-1 text-xs font-semibold text-red-700">Signature verification required</p>
                    </div>
                  ))}
                </div>
                <PurchaseOrderLinkReview requisitionId={result.requisition_id || result.pr_id} poLink={result.po_link} canLink={canLinkPurchaseOrder} onOpen={close} onLinked={poLink => { const updated = { ...result, po_link: poLink }; setResult(updated); onImported?.(updated); }} />
              </div>
            )}

            {allIssues.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
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
              {preview && !result && <button type="button" onClick={saveReviewed} disabled={loading || numberNeedsCheck || expectedMismatch || missingBoundRecord} className="h-9 rounded-lg bg-emerald-600 px-4 text-xs font-semibold text-white disabled:opacity-50">{loading ? 'Validating and saving...' : attachmentNumber ? 'Attach signed PDF' : createNew ? 'Create reviewed PR' : 'Save Reviewed PR'}</button>}
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
  canLinkPurchaseOrder: PropTypes.bool,
};

export default PurchaseRequisitionPdfImport;
