import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
import PurchaseOrderLinkReview from './PurchaseOrderLinkReview';
import ProcurementImportVendorReview from './ProcurementImportVendorReview';
import ProcurementApprovalEmployeeSearch from './ProcurementApprovalEmployeeSearch';
import { importErrorMessage } from './procurementPdfImportErrors';
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
const PO_REVIEW_FIELDS = [
  ['po_number', 'PO Number', 'text'], ['vendor_name', 'PO Supplier name', 'text'],
  ['summary', 'PO Description', 'textarea'], ['currency', 'PO Currency', 'select'],
  ['entered_amount', 'PO Entered price', 'number'], ['po_date', 'PO Order date', 'date'],
  ['expected_delivery', 'PO Expected delivery', 'date'],
];
const VENDOR_REVIEW_FIELDS = ['vendor_id', 'vendor_license_no', 'seller_contact_person', 'seller_email', 'seller_phone', 'seller_address', 'seller_country'];
const emptyPoEvidence = () => ({ signatureVerified: false, stampVerified: false, approvedByName: '', approvedByTitle: '', approvedDate: '' });
const editablePoFields = data => {
  const fields = data?.extracted_data || {};
  return {
    ...fields,
    entered_amount: fields.canonical_financials?.entered_amount ?? fields.entered_amount ?? fields.total_amount ?? '',
    vat_basis: 'unconfirmed',
  };
};
const validatePairedPoPdf = file => {
  if (!file) return;
  if (!file.name?.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') throw new Error('Signed Purchase Order must be a PDF file.');
  if (file.size <= 0) throw new Error('Signed Purchase Order PDF is empty.');
  if (file.size > MAX_SIGNED_PR_PDF_SIZE) throw new Error('Signed Purchase Order PDF must not exceed 15 MB.');
};

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
    suppressErrorToast: true,
    silentTimeout: true,
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

const errorDetailText = detail => {
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return detail.map(errorDetailText).filter(Boolean).join(' ');
  if (!detail || typeof detail !== 'object') return '';
  const labels = { po_reviewed_fields: 'PO details', po_approval: 'PO approval', po_file: 'PO PDF', file: 'PR PDF' };
  return Object.entries(detail).map(([field, value]) => {
    const text = errorDetailText(value);
    if (!text) return '';
    return ['non_field_errors', 'detail', 'error'].includes(field) ? text : `${labels[field] || field.replaceAll('_', ' ')}: ${text}`;
  }).filter(Boolean).join(' ');
};

const errorMessage = (requestError, fallback) => {
  const details = requestError.response?.data;
  return errorDetailText(details && typeof details === 'object' ? details.error || details.detail || details.errors || details : null)
    || (requestError.code === 'ECONNABORTED'
      ? 'PDF capture timed out. Try a clearer or smaller scan.'
      : requestError.message || fallback);
};

const PurchaseRequisitionPdfImport = ({ isOpen, onClose, onImported, expectedPrNumber = '', canLinkPurchaseOrder = true, canUploadPurchaseOrder = false, primaryDocument = 'pr', requisitionId = null, canImportRequisition = true }) => {
  const inputRef = useRef(null);
  const poInputRef = useRef(null);
  const previewVersionRef = useRef(0);
  const [file, setFile] = useState(null);
  const [fileUrl, setFileUrl] = useState('');
  const [poFile, setPoFile] = useState(null);
  const [poFileUrl, setPoFileUrl] = useState('');
  const [poEdits, setPoEdits] = useState({});
  const [poEvidence, setPoEvidence] = useState(emptyPoEvidence);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [edits, setEdits] = useState({});
  const [manualSignatures, setManualSignatures] = useState({});
  const [employees, setEmployees] = useState([]);
  const [employeeLoadError, setEmployeeLoadError] = useState('');
  const [recordCheck, setRecordCheck] = useState(null);
  const [selectedPrId, setSelectedPrId] = useState('');
  const [prSearch, setPrSearch] = useState('');
  const [prOptions, setPrOptions] = useState([]);
  const [prLoading, setPrLoading] = useState(false);
  const [prSearchError, setPrSearchError] = useState('');
  const [prSearchRetry, setPrSearchRetry] = useState(0);
  useEffect(() => {
    if (!file) {
      setFileUrl('');
      return undefined;
    }
    const url = window.URL.createObjectURL(new Blob([file], { type: 'application/pdf' }));
    setFileUrl(url);
    return () => window.URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    if (!poFile) { setPoFileUrl(''); return undefined; }
    const url = window.URL.createObjectURL(new Blob([poFile], { type: 'application/pdf' }));
    setPoFileUrl(url);
    return () => window.URL.revokeObjectURL(url);
  }, [poFile]);

  useEffect(() => {
    if (!isOpen || !canImportRequisition || (primaryDocument === 'po' && !file)) return undefined;
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
  }, [isOpen, canImportRequisition, primaryDocument, file]);

  useEffect(() => {
    if (!isOpen || !preview || file || !poFile || requisitionId || !canLinkPurchaseOrder || result) return undefined;
    const controller = new AbortController();
    setPrLoading(true);
    setPrSearchError('');
    const timer = window.setTimeout(() => apiClient.get('/procurement/orders/available-requisitions/', {
      params: { search: prSearch, limit: 100 }, signal: controller.signal, suppressErrorToast: true,
    }).then(({ data }) => {
      if (controller.signal.aborted) return;
      const rows = Array.isArray(data) ? data : data?.results;
      if (!Array.isArray(rows)) throw new Error('Invalid purchase recommendations');
      setPrOptions(rows);
    }).catch(() => { if (!controller.signal.aborted) setPrSearchError('Purchase recommendations could not be loaded. Retry the search.'); })
      .finally(() => { if (!controller.signal.aborted) setPrLoading(false); }), 250);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [isOpen, preview, file, poFile, requisitionId, canLinkPurchaseOrder, result, prSearch, prSearchRetry]);

  if (!isOpen) return null;

  const reset = () => {
    if (inputRef.current) inputRef.current.value = '';
    if (poInputRef.current) poInputRef.current.value = '';
    previewVersionRef.current += 1;
    setFile(null);
    setPoFile(null);
    setPoEdits({});
    setPoEvidence(emptyPoEvidence());
    setError('');
    setPreview(null);
    setResult(null);
    setEdits({});
    setManualSignatures({});
    setRecordCheck(null);
    setSelectedPrId('');
    setPrSearch('');
    setPrOptions([]);
  };

  const close = () => {
    if (loading) return;
    reset();
    onClose();
  };

  const chooseFile = (selectedFile, kind = 'pr') => {
    previewVersionRef.current += 1;
    if (kind === 'po') setPoFile(selectedFile || null);
    else setFile(selectedFile || null);
    setPreview(null);
    setResult(null);
    setEdits({});
    setManualSignatures({});
    setPoEdits({});
    setPoEvidence(emptyPoEvidence());
    setError('');
    setRecordCheck(null);
    setSelectedPrId('');
    setPrSearch('');
    setPrOptions([]);
  };

  const capturePreview = async () => {
    if (!file && !poFile) return setError('Select a signed or approved PR or PO PDF first.');
    const version = ++previewVersionRef.current;
    setLoading(true);
    setError('');
    try {
      validatePairedPoPdf(poFile);
      let data;
      if (file) data = await submitSignedRequisitionPdf(file, {
        preview_only: 'true',
        expected_pr_number: expectedPrNumber,
        attach_only: expectedPrNumber ? 'true' : undefined,
        po_file: poFile || undefined,
        originating_pr_id: requisitionId || undefined,
      });
      else {
        const body = new FormData();
        body.append('file', poFile);
        if (requisitionId) body.append('pr_id', requisitionId);
        const response = await apiClient.post('/procurement/po-documents/preview_signed_pdf/', body, {
          headers: { 'Content-Type': 'multipart/form-data' }, timeout: 180000, suppressErrorToast: true, silentTimeout: true,
        });
        data = { po_preview: response.data, preview_only: true };
      }
      if (version !== previewVersionRef.current) return;
      if (poFile && !data.po_preview?.extracted_data) throw new Error('The PO PDF could not be previewed. Both selected files are retained; retry Preview OCR.');
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
      setPoEdits(editablePoFields(data.po_preview));
      setSelectedPrId(!file && canLinkPurchaseOrder ? String(data.po_preview?.extracted_data?.pr_id || '') : '');
      const poDetection = data.po_preview?.approval_evidence || {};
      setPoEvidence({ ...emptyPoEvidence(), approvedByName: poDetection.approved_by_name || '', approvedByTitle: poDetection.approved_by_title || '', approvedDate: poDetection.approved_date || '' });
    } catch (requestError) {
      if (version === previewVersionRef.current) setError(!file && (requestError.response || requestError.code || requestError.originalError) ? importErrorMessage(requestError) : errorMessage(requestError, 'The selected PDFs could not be previewed.'));
    } finally {
      setLoading(false);
    }
  };

  const reviewedNumber = String(edits.pr_number || '').trim().toUpperCase();
  const numberNeedsCheck = Boolean(file && (!reviewedNumber || !recordCheck || typeof recordCheck.exists !== 'boolean' || reviewedNumber !== recordCheck.number));
  const sourceNumber = String(preview?.extracted_data?.pr_number || preview?.pr_number || '').trim().toUpperCase();
  const boundPrNumber = expectedPrNumber || preview?.bound_pr_number || '';
  const attachmentNumber = file ? boundPrNumber || (!numberNeedsCheck && recordCheck?.exists ? reviewedNumber : '') : '';
  const expectedMismatch = Boolean(attachmentNumber && (sourceNumber !== attachmentNumber.trim().toUpperCase() || preview?.document_comparison?.identity_matched === false));
  const createNew = Boolean(file && !boundPrNumber && !numberNeedsCheck && recordCheck?.exists === false);
  const missingBoundRecord = Boolean(file && boundPrNumber && recordCheck?.exists === false);

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
    if (poFile && (!preview?.po_preview?.extracted_data || !canUploadPurchaseOrder)) return;
    if (poFile && poEdits.vat_basis === 'unconfirmed' && (
      String(poEdits.entered_amount) !== String(editablePoFields(preview.po_preview).entered_amount)
      || poEdits.currency !== editablePoFields(preview.po_preview).currency
    )) return setError('Confirm the PO VAT treatment before changing its price or currency.');
    if (poFile && poEvidence.signatureVerified && (!poEvidence.approvedByName.trim() || !poEvidence.approvedDate)) {
      return setError('Enter the PO approver name and approval date when the PO signature is verified.');
    }
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
      const poReviewedFields = Object.fromEntries(PO_REVIEW_FIELDS.filter(([key]) => key !== 'entered_amount').map(([key, , type]) => [key, type === 'date' ? poEdits[key] || null : poEdits[key] ?? '']));
      VENDOR_REVIEW_FIELDS.forEach(key => {
        if (poEdits[key] !== undefined) poReviewedFields[key] = key === 'vendor_id' ? poEdits[key] || null : poEdits[key] || '';
      });
      if (poFile && poEdits.vat_basis !== 'unconfirmed') {
        poReviewedFields.vat_basis = poEdits.vat_basis;
        poReviewedFields.entered_amount = poEdits.entered_amount;
      }
      if (!file) {
        const body = new FormData();
        body.append('file', poFile);
        body.append('reviewed_fields', JSON.stringify(poReviewedFields));
        const linkedPrId = requisitionId || selectedPrId;
        if (linkedPrId) body.append('pr_id', linkedPrId);
        Object.entries({ signature_verified: String(poEvidence.signatureVerified), stamp_verified: String(poEvidence.stampVerified), approved_by_name: poEvidence.approvedByName.trim(), approved_by_title: poEvidence.approvedByTitle.trim(), approved_date: poEvidence.approvedDate }).forEach(([key, value]) => body.append(key, value));
        const { data } = await apiClient.post('/procurement/po-documents/import_signed_pdf/', body, {
          headers: { 'Content-Type': 'multipart/form-data' }, timeout: 180000, suppressErrorToast: true, silentTimeout: true,
        });
        if (!data.purchase_order_id || (linkedPrId && (
          String(data.pr_id) !== String(linkedPrId) || data.po_link?.manual_link_required !== false
          || !['linked', 'already_linked'].includes(data.po_link?.status)
          || String(data.po_link?.po_id) !== String(data.purchase_order_id)
        ))) throw new Error('The saved PO and its link could not be confirmed. Your PDF and reviewed details are retained. Check the register before retrying.');
        setResult({ ...data, purchase_order: data });
        onImported?.(data);
        return;
      }
      const data = await submitSignedRequisitionPdf(file, {
        po_file: poFile || undefined,
        po_reviewed_fields: poFile ? JSON.stringify(poReviewedFields) : undefined,
        originating_pr_id: requisitionId || undefined,
        po_signature_verified: poFile ? String(poEvidence.signatureVerified) : undefined,
        po_stamp_verified: poFile ? String(poEvidence.stampVerified) : undefined,
        po_approved_by_name: poFile ? poEvidence.approvedByName.trim() : undefined,
        po_approved_by_title: poFile ? poEvidence.approvedByTitle.trim() : undefined,
        po_approved_date: poFile ? poEvidence.approvedDate : undefined,
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
      if (poFile && (!data.purchase_order_id || data.po_link?.manual_link_required !== false
        || !['linked', 'already_linked'].includes(data.po_link?.status)
        || String(data.po_link?.po_id) !== String(data.purchase_order_id)
        || String(data.purchase_order?.pr_id) !== String(data.requisition_id || data.pr_id))) {
        throw new Error('The combined PR and PO save could not be confirmed. Both PDFs and reviewed details are retained. Check the register before retrying.');
      }
      setResult(data);
      onImported?.(data);
    } catch (requestError) {
      setError(!file && (requestError.response || requestError.code || requestError.originalError) ? importErrorMessage(requestError) : errorMessage(requestError, 'The reviewed document details could not be saved.'));
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
    ...(result?.purchase_order?.reconciliation_issues || []).map(issue => `PO: ${issue}`),
    ...(result?.purchase_order?.mapping_issues || []).map(issue => `PO: ${issue}`),
    ...(result?.purchase_order?.workflow_issues || []).map(issue => `PO: ${issue}`),
  ])];

  return createPortal(
    <div className="fixed inset-0 z-[70] overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center px-4 py-8">
        <button type="button" aria-label="Close document upload" className="fixed inset-0 bg-black/50" onClick={close} />
        <div role="dialog" aria-modal="true" aria-labelledby="approved-pr-import-title" className="relative w-full max-w-7xl overflow-hidden rounded-2xl bg-white shadow-2xl">
          <div className="flex items-start justify-between bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4 text-white">
            <div>
              <h2 id="approved-pr-import-title" className="text-lg font-bold">Upload PR, PO and Vendor</h2>
              <p className="mt-1 text-sm text-indigo-100">Upload your PDFs, review document and vendor details, then save everything here.</p>
            </div>
            <button type="button" aria-label="Close import dialog" onClick={close} disabled={loading}><XMarkIcon className="h-6 w-6" /></button>
          </div>

          <div className="max-h-[78vh] space-y-5 overflow-y-auto p-6">
            {attachmentNumber && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
                Attach to <strong>{attachmentNumber}</strong>. Existing recommendation values will be kept.
              </div>
            )}
            {requisitionId && !file && <p className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">The purchase order will be attached to the purchase recommendation you opened.</p>}

            {!result && (
              <div className={`grid gap-3 ${canImportRequisition && canUploadPurchaseOrder ? 'md:grid-cols-2' : ''}`}>
              {canImportRequisition && <div className="rounded-xl border border-dashed border-indigo-300 bg-indigo-50/50 p-5">
                <input ref={inputRef} aria-label="Select signed or approved PR PDF" type="file" accept=".pdf,application/pdf" disabled={loading} className="hidden" onChange={(event) => chooseFile(event.target.files?.[0])} />
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Select signed or approved PR PDF</p>
                    {file && <p className="mt-1 break-all text-xs text-gray-600">{file.name}</p>}
                  </div>
                  <button type="button" onClick={() => inputRef.current?.click()} disabled={loading} className="h-9 rounded-lg border border-indigo-300 bg-white px-3 text-xs font-semibold text-indigo-700">
                    <ArrowUpTrayIcon className="mr-1.5 inline h-4 w-4" /> Choose PDF
                  </button>
                </div>
                {file && <button type="button" disabled={loading} onClick={() => { if (inputRef.current) inputRef.current.value = ''; chooseFile(null); }} className="mt-2 text-xs font-semibold text-indigo-700 underline">Remove PR PDF</button>}
              </div>}
              {canUploadPurchaseOrder && <div className="rounded-xl border border-dashed border-indigo-300 bg-indigo-50/50 p-5">
                <input ref={poInputRef} aria-label="Select signed or approved PO PDF" type="file" accept=".pdf,application/pdf" disabled={loading} className="hidden" onChange={event => chooseFile(event.target.files?.[0], 'po')} />
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div><p className="text-sm font-semibold text-gray-800">Select signed or approved PO PDF</p><p className="mt-1 break-all text-xs text-gray-600">{poFile?.name || 'Optional. Save both documents as linked PR and PO records.'}</p></div>
                  <button type="button" onClick={() => poInputRef.current?.click()} disabled={loading} className="h-9 shrink-0 rounded-lg border border-indigo-300 bg-white px-3 text-xs font-semibold text-indigo-700"><ArrowUpTrayIcon className="mr-1.5 inline h-4 w-4" />Choose PO PDF</button>
                </div>
                {poFile && <button type="button" disabled={loading} onClick={() => { if (poInputRef.current) poInputRef.current.value = ''; chooseFile(null, 'po'); }} className="mt-2 text-xs font-semibold text-indigo-700 underline">Remove PO PDF</button>}
              </div>}
              </div>
            )}

            {error && <div role="alert" className="flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"><ExclamationTriangleIcon className="h-5 w-5 flex-none" />{error}</div>}

            {file && preview && !result && <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900" role="status">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{expectedMismatch ? 'PR number does not match this recommendation' : missingBoundRecord ? 'The original recommendation is no longer available' : numberNeedsCheck ? 'Check the corrected PR number' : attachmentNumber ? 'Attach the signed PDF' : recordCheck?.exists ? 'Update existing recommendation' : 'Create a recommendation from this PDF'}</p>
                  <p className="mt-1 text-xs">{expectedMismatch ? `The PDF number is ${sourceNumber || 'not detected'}. Select the PDF for ${attachmentNumber}.` : missingBoundRecord ? 'Close this attachment flow and select an existing recommendation.' : numberNeedsCheck ? 'The PR number was edited. Check whether it already exists before saving.' : attachmentNumber ? `${attachmentNumber} exists in RADAI. Review any differences below before attaching.` : recordCheck?.exists ? `${reviewedNumber} exists in RADAI. Saving will update it and attach this PDF.` : `${reviewedNumber} is not in RADAI. Review the fields below, including the PR number, then create it from this PDF.`}</p>
                </div>
                {!attachmentNumber && <button type="button" onClick={checkReviewedNumber} disabled={loading || !reviewedNumber} className="h-9 rounded-lg border border-blue-300 bg-white px-3 text-xs font-semibold text-blue-700">Check PR number</button>}
              </div>
            </div>}

            {(file || poFile) && !result && (
              <div className="grid gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.95fr)]">
                <div className="min-w-0 space-y-4 lg:sticky lg:top-0 lg:max-h-[70vh] lg:self-start lg:overflow-y-auto">
                  {file && <section aria-label="PR source document" className="overflow-hidden rounded-xl border border-gray-300 bg-gray-100">
                    <h3 className="border-b border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700">PR source PDF</h3>
                    {fileUrl && <iframe src={`${fileUrl}#toolbar=0&navpanes=0`} title="Approved PR source PDF" className={`${poFile ? 'h-[42vh] min-h-[340px]' : 'h-[74vh] min-h-[680px]'} w-full`} />}
                  </section>}
                  {poFile && <section aria-label="PO source document" className="overflow-hidden rounded-xl border border-gray-300 bg-gray-100">
                    <h3 className="border-b border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700">PO source PDF</h3>
                    {poFileUrl && <iframe src={`${poFileUrl}#toolbar=0&navpanes=0`} title="Approved PO source PDF" className={`${file ? 'h-[42vh] min-h-[340px]' : 'h-[70vh] min-h-[460px]'} w-full`} />}
                  </section>}
                </div>
                <div className="space-y-4">
                  {!preview && <p className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">Select Preview OCR to fill the details from your PDFs. Review and correct them on this page before saving.</p>}
                  {file && preview && <>
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
                  </>}
                  {poFile && preview?.po_preview && <section aria-label="Review purchase order PDF" className="space-y-4 rounded-xl border border-indigo-200 bg-indigo-50/30 p-4">
                    <div><h3 className="text-sm font-semibold text-gray-800">Purchase order details</h3><p className="mt-1 text-xs text-gray-600">{file ? 'Save PR and PO saves both documents and links their records.' : 'Save PO saves the reviewed order, its original PDF and vendor details.'}</p></div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {PO_REVIEW_FIELDS.filter(([key]) => key !== 'vendor_name').map(([key, label, type]) => <label key={key} className={`text-xs font-semibold text-gray-700 ${type === 'textarea' ? 'sm:col-span-2' : ''}`}>
                        {label}
                        {type === 'textarea' ? <textarea aria-label={label} value={poEdits[key] ?? ''} disabled={loading} onChange={event => setPoEdits(current => ({ ...current, [key]: event.target.value }))} rows={3} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-normal" />
                          : type === 'select' ? <select aria-label={label} value={poEdits[key] ?? ''} disabled={loading} onChange={event => setPoEdits(current => ({ ...current, [key]: event.target.value }))} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-normal"><option value="">Select currency</option>{[...new Set(['AED', 'USD', 'EUR', 'GBP', poEdits.currency].filter(Boolean))].map(currency => <option key={currency} value={currency}>{currency}</option>)}</select>
                            : <input aria-label={label} value={poEdits[key] ?? ''} type={type} step={type === 'number' ? '0.01' : undefined} disabled={loading} onChange={event => setPoEdits(current => ({ ...current, [key]: event.target.value }))} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-normal" />}
                      </label>)}
                      <label className="text-xs font-semibold text-gray-700 sm:col-span-2">PO VAT price basis<select aria-label="PO VAT price basis" value={poEdits.vat_basis || 'unconfirmed'} disabled={loading} onChange={event => setPoEdits(current => ({ ...current, vat_basis: event.target.value }))} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-normal"><option value="unconfirmed">Keep captured PO amounts</option>{PROCUREMENT_VAT_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                    </div>
                    {!file && !requisitionId && canLinkPurchaseOrder && <section aria-label="Link purchase recommendation" className="space-y-2 border-t border-indigo-200 pt-3">
                      <label className="block text-xs font-semibold text-gray-700">Search recommendations<input value={prSearch} disabled={loading} onChange={event => setPrSearch(event.target.value)} placeholder="Type PR number or description" className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-normal" /></label>
                      <label className="block text-xs font-semibold text-gray-700">Purchase recommendation<select value={selectedPrId} disabled={loading} onChange={event => setSelectedPrId(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-normal"><option value="">Match from PDF when available</option>{selectedPrId && !prOptions.some(pr => String(pr.id) === selectedPrId) && <option value={selectedPrId}>{preview.po_preview.extracted_data?.pr_number || 'Selected recommendation'}</option>}{prOptions.map(pr => <option key={pr.id} value={pr.id}>{pr.pr_number}{pr.product_service ? ` - ${pr.product_service}` : ''}</option>)}</select></label>
                      {prLoading && <p role="status" className="text-xs text-gray-600">Loading recommendations...</p>}
                      {prSearchError && <p role="alert" className="text-xs text-amber-800">{prSearchError} <button type="button" onClick={() => setPrSearchRetry(value => value + 1)} className="underline">Retry recommendations</button></p>}
                    </section>}
                    <ProcurementImportVendorReview fields={poEdits} disabled={loading} onChange={changes => setPoEdits(current => ({ ...current, ...changes }))} />
                    <fieldset className="space-y-3 border-t border-indigo-200 pt-3" disabled={loading}>
                      <legend className="px-1 text-sm font-semibold text-gray-800">PO approval evidence</legend>
                      <p className="text-xs text-gray-600">Confirm these only after checking the PO PDF. PR signatures do not confirm PO approval.</p>
                      <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={poEvidence.signatureVerified} onChange={event => setPoEvidence(current => ({ ...current, signatureVerified: event.target.checked }))} />PO approval signature is visible</label>
                      <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={poEvidence.stampVerified} onChange={event => setPoEvidence(current => ({ ...current, stampVerified: event.target.checked }))} />PO company stamp is visible</label>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <ProcurementApprovalEmployeeSearch label="PO Approver name" value={poEvidence.approvedByName} disabled={loading} onChange={(value, clearTitle) => setPoEvidence(current => ({ ...current, approvedByName: value, ...(clearTitle ? { approvedByTitle: '' } : {}) }))} onSelect={employee => setPoEvidence(current => ({ ...current, approvedByName: employee.name, approvedByTitle: employee.position || '' }))} />
                        <label className="text-xs font-semibold text-gray-700">PO Approval date<input type="date" value={poEvidence.approvedDate} onChange={event => setPoEvidence(current => ({ ...current, approvedDate: event.target.value }))} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-normal" /></label>
                        <label className="text-xs font-semibold text-gray-700 sm:col-span-2">PO Approver title<input value={poEvidence.approvedByTitle} onChange={event => setPoEvidence(current => ({ ...current, approvedByTitle: event.target.value }))} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-normal" /></label>
                      </div>
                    </fieldset>
                    {[...(preview.po_preview.reconciliation_issues || []), ...(preview.po_preview.mapping_issues || []), ...(preview.po_preview.approval_evidence?.issues || [])].length > 0 && <ul className="list-disc space-y-1 pl-5 text-xs text-amber-800">{[...new Set([...(preview.po_preview.reconciliation_issues || []), ...(preview.po_preview.mapping_issues || []), ...(preview.po_preview.approval_evidence?.issues || [])])].map(issue => <li key={issue}>{issue}</li>)}</ul>}
                  </section>}
                </div>
              </div>
            )}

            {result && (
              <div className="space-y-4">
                {result.financial_values_preserved && !attachmentNumber && <p className="text-sm text-gray-600">Existing financial values were kept. Confirm the VAT treatment in Edit before changing them.</p>}
                {file && <div className="flex gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                  <CheckCircleIcon className="h-5 w-5 flex-none" />
                  <div><strong>{result.pr_number}</strong>{attachmentNumber ? ' has the signed PDF attached' : ` was ${result.created ? 'created from the reviewed PDF' : 'updated from the reviewed PDF'}`}. {attachmentNumber ? 'Existing recommendation values were kept.' : 'The source PDF is attached.'} Status: <strong>{result.status}</strong>.</div>
                </div>}
                {poFile && result.purchase_order_id && <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">Purchase order <strong>{result.purchase_order?.po_number || result.po_link?.po_number}</strong> is saved{result.purchase_order?.pr_id ? ' and linked to the purchase recommendation' : ''}. {file ? 'Both source PDFs are attached.' : 'The original PO PDF is attached.'}</p>}
                {result.purchase_order?.vendor_registered && <p className="text-sm text-emerald-800">The supplier was registered in the vendor table from the reviewed document details.</p>}
                {result.purchase_order?.operation === 'attached' && <p className="text-sm text-gray-700">The signed PO PDF was attached to the existing purchase order. Existing PO values were kept.</p>}
                <div className="grid gap-3 sm:grid-cols-2">
                  {file && !documentSignedOff && Object.entries(ROLE_LABELS).filter(([key]) => !detection.signatures?.[key]).map(([key, label]) => (
                    <div key={key} className="rounded-lg border border-gray-200 p-3">
                      <p className="text-xs text-gray-500">{label}</p>
                      <p className="mt-1 text-sm font-semibold text-gray-800">{detection.approver_names?.[key] || 'Name not detected'}</p>
                      <p className="mt-1 text-xs font-semibold text-red-700">Signature verification required</p>
                    </div>
                  ))}
                </div>
                {file && <PurchaseOrderLinkReview requisitionId={result.requisition_id || result.pr_id} poLink={result.po_link} canLink={canLinkPurchaseOrder} canUpload={canUploadPurchaseOrder} canImportRequisition={canImportRequisition} onOpen={close} onLinked={poLink => { const updated = { ...result, po_link: poLink }; setResult(updated); onImported?.(updated); }} />}
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
              {!preview && !result && <button type="button" onClick={capturePreview} disabled={(!file && !poFile) || loading} className="h-9 rounded-lg bg-indigo-600 px-4 text-xs font-semibold text-white disabled:opacity-50">{loading ? 'Running OCR...' : 'Preview OCR'}</button>}
              {preview && !result && <button type="button" onClick={saveReviewed} disabled={loading || numberNeedsCheck || expectedMismatch || missingBoundRecord || Boolean(poFile && !preview.po_preview?.extracted_data)} className="h-9 rounded-lg bg-emerald-600 px-4 text-xs font-semibold text-white disabled:opacity-50">{loading ? 'Validating and saving...' : poFile ? file ? 'Save PR and PO' : 'Save PO' : attachmentNumber ? 'Attach signed PDF' : createNew ? 'Create reviewed PR' : 'Save Reviewed PR'}</button>}
            </div>
          </div>
        </div>
      </div>
    </div>, document.body
  );
};

PurchaseRequisitionPdfImport.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onImported: PropTypes.func,
  expectedPrNumber: PropTypes.string,
  canLinkPurchaseOrder: PropTypes.bool,
  canUploadPurchaseOrder: PropTypes.bool,
  primaryDocument: PropTypes.oneOf(['pr', 'po']),
  requisitionId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  canImportRequisition: PropTypes.bool,
};

export default PurchaseRequisitionPdfImport;
