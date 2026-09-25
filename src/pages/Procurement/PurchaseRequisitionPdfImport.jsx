import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
import PurchaseOrderLinkReview from './PurchaseOrderLinkReview';
import ProcurementImportVendorReview from './ProcurementImportVendorReview';
import ProcurementImportPdfPreview from './ProcurementImportPdfPreview';
import ProcurementApprovalEmployeeSearch from './ProcurementApprovalEmployeeSearch';
import { importErrorMessage } from './procurementPdfImportErrors';
import useProcurementImportDialog from './useProcurementImportDialog';
import './PurchaseRequisitionPdfImport.css';
import {
  ArrowPathIcon,
  ArrowUpTrayIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  DocumentTextIcon,
  InformationCircleIcon,
  PlusCircleIcon,
  TrashIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import apiClient from '../../services/api.service';
import { employeeDisplayName } from '../../utils/employeeDisplayName';
import { isLevelZeroApprover, isUnknownApprover, normalizeSourceApprovalReview } from './recommendationApprovalEvidence';
import { normalizeProjectNumbers } from './recommendationProjectNumbers';
import { calculateProcurementVat, PROCUREMENT_VAT_OPTIONS, roundProcurementMoney } from '../../utils/procurementVat';

const ROLE_LABELS = { pm: 'Project Manager', moe: 'Manager of Engineering', mop: 'Manager of Projects', vp: 'VP Operations' };
const capturedSignerName = (detection, role) => {
  const names = (detection?.approval_rows || []).filter(row => row.role_key === role).map(row => row.name || row.raw_name || '').filter(Boolean);
  return [...new Set(names)].join('; ') || detection?.approver_names?.[role] || '';
};
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
  ['project_number', 'PO Project number', 'text'],
  ['payment_terms', 'PO Payment terms', 'textarea'], ['payment_mode', 'PO Payment method', 'text'],
  ['delivery_terms', 'PO Delivery terms', 'textarea'],
  ['seller_reference', 'PO Seller reference', 'text'], ['quote_ref', 'PO Quote reference', 'text'],
];
const VENDOR_REVIEW_FIELDS = ['vendor_id', 'vendor_license_no', 'seller_contact_person', 'seller_email', 'seller_phone', 'seller_address', 'seller_country'];
const PO_REQUIRED_FIELDS = ['po_number', 'vendor_name', 'summary', 'currency', 'entered_amount', 'po_date'];
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
  const dialogRef = useRef(null);
  const { boundaryStyle, width, canResize, isResizing, isReady, resizeHandleProps } = useProcurementImportDialog(isOpen);
  const sourceSelectionRef = useRef(null);
  const inputRef = useRef(null);
  const poInputRef = useRef(null);
  const poAmountRef = useRef(null);
  const previewVersionRef = useRef(0);
  const [file, setFile] = useState(null);
  const [fileUrl, setFileUrl] = useState('');
  const [poFile, setPoFile] = useState(null);
  const [poFileUrl, setPoFileUrl] = useState('');
  const [sourceKind, setSourceKind] = useState(primaryDocument);
  const [poEdits, setPoEdits] = useState({});
  const [poAmountError, setPoAmountError] = useState('');
  const [poEvidence, setPoEvidence] = useState(emptyPoEvidence);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [edits, setEdits] = useState({});
  const [manualSignatures, setManualSignatures] = useState({});
  const [sourceApprovalReview, setSourceApprovalReview] = useState(() => normalizeSourceApprovalReview());
  const [additionalApproverError, setAdditionalApproverError] = useState('');
  const [employees, setEmployees] = useState([]);
  const [employeeLoadError, setEmployeeLoadError] = useState('');
  const [recordCheck, setRecordCheck] = useState(null);
  const [selectedPrId, setSelectedPrId] = useState('');
  const [prSearch, setPrSearch] = useState('');
  const [prOptions, setPrOptions] = useState([]);
  const [prLoading, setPrLoading] = useState(false);
  const [prSearchError, setPrSearchError] = useState('');
  const [prSearchRetry, setPrSearchRetry] = useState(0);
  const [showSources, setShowSources] = useState(false);
  useEffect(() => {
    if (!showSources) return;
    const chooseButton = sourceSelectionRef.current?.querySelector('button:not(:disabled)');
    chooseButton?.focus({ preventScroll: true });
    chooseButton?.scrollIntoView({ block: 'nearest' });
  }, [showSources]);
  useEffect(() => {
    if (!isOpen || !isReady) return undefined;
    const previousFocus = document.activeElement;
    dialogRef.current?.focus();
    return () => {
      const fallback = document.querySelector(`[aria-label="${primaryDocument === 'po' ? 'More purchase order actions' : 'More recommendation actions'}"]`);
      if (previousFocus?.isConnected && previousFocus !== document.body) previousFocus.focus();
      else fallback?.focus();
    };
  }, [isOpen, primaryDocument, isReady]);
  useEffect(() => {
    // Keep focus inside when a handle disappears or the active action is disabled.
    if (isOpen && isReady && (loading || document.activeElement === document.body)) {
      dialogRef.current?.focus({ preventScroll: true });
    }
  }, [isOpen, isReady, canResize, loading]);
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
    setSourceKind(primaryDocument);
    setPoEdits({});
    setPoAmountError('');
    setPoEvidence(emptyPoEvidence());
    setError('');
    setPreview(null);
    setResult(null);
    setEdits({});
    setManualSignatures({});
    setSourceApprovalReview(normalizeSourceApprovalReview());
    setAdditionalApproverError('');
    setRecordCheck(null);
    setSelectedPrId('');
    setPrSearch('');
    setPrOptions([]);
    setShowSources(false);
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
    if (selectedFile) setSourceKind(kind);
    setPreview(null);
    setResult(null);
    setEdits({});
    setManualSignatures({});
    setSourceApprovalReview(normalizeSourceApprovalReview());
    setAdditionalApproverError('');
    setPoEdits({});
    setPoAmountError('');
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
      setSourceApprovalReview(normalizeSourceApprovalReview(data.source_approval_review));
      setAdditionalApproverError('');
      setRecordCheck({ number: String(extracted.pr_number || data.pr_number || '').trim().toUpperCase(), exists: data.database_match });
      setEdits({
        ...extracted,
        project_number: data.database_match && Array.isArray(data.project_numbers)
          ? normalizeProjectNumbers(data.project_numbers) : extracted.project_number || '',
        vat_basis: 'unconfirmed',
        approval_date: data.approval_detection?.approval_date || '',
        pm_name: approvers.pm || capturedSignerName(data.approval_detection, 'pm'),
        moe_name: approvers.moe || capturedSignerName(data.approval_detection, 'moe'),
        mop_name: approvers.mop || capturedSignerName(data.approval_detection, 'mop'),
        vp_name: approvers.vp || capturedSignerName(data.approval_detection, 'vp'),
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
    const reviewedSourceApprovals = normalizeSourceApprovalReview(sourceApprovalReview);
    const expectedSourceApprovals = normalizeSourceApprovalReview(preview?.source_approval_review);
    Object.keys(ROLE_LABELS).forEach(role => {
      if (isLevelZeroApprover(edits[`${role}_name`]) && reviewedSourceApprovals.approval_labels[role]) reviewedSourceApprovals.approval_labels[role] = '0';
    });
    if (isLevelZeroApprover(reviewedSourceApprovals.additional_approver?.name)) reviewedSourceApprovals.additional_approver.approval_label = '0';
    const sourceReviewChanged = file && JSON.stringify(reviewedSourceApprovals) !== JSON.stringify(expectedSourceApprovals);
    const reviewedProjectNumbers = normalizeProjectNumbers(edits.project_number || '');
    const projectReferencesChanged = Boolean(file && attachmentNumber
      && reviewedProjectNumbers !== normalizeProjectNumbers(Array.isArray(preview?.project_numbers)
        ? preview.project_numbers : preview?.extracted_data?.project_number || ''));
    if (file && reviewedProjectNumbers.length > 200) {
      setError('Project numbers must contain at most 200 characters, including commas.');
      return;
    }
    if (file && reviewedSourceApprovals.additional_approver && !reviewedSourceApprovals.additional_approver.name) {
      setAdditionalApproverError('Enter the additional approver name, or clear the additional row.');
      const input = dialogRef.current?.querySelector('#import-pr-additional-signer');
      input?.focus();
      input?.scrollIntoView({ block: 'center' });
      return;
    }
    const previousAdditional = expectedSourceApprovals.additional_approver;
    const nextAdditional = reviewedSourceApprovals.additional_approver;
    if (file && previousAdditional && nextAdditional
      && (previousAdditional.name !== nextAdditional.name || previousAdditional.approval_label !== nextAdditional.approval_label)
      && !nextAdditional.special_note) {
      setAdditionalApproverError('Enter a Special note explaining the approver correction.');
      dialogRef.current?.querySelector('#import-pr-additional-note')?.focus();
      return;
    }
    const missingNoteRole = file && Object.keys(ROLE_LABELS).find(role => {
      const originalName = capturedSignerName(preview?.approval_detection, role);
      return isUnknownApprover(originalName)
        && (String(edits[`${role}_name`] || '').trim() !== originalName.trim()
          || (reviewedSourceApprovals.approval_labels[role] || '') !== (expectedSourceApprovals.approval_labels[role] || ''))
        && !reviewedSourceApprovals.approver_notes?.[role];
    });
    if (missingNoteRole) {
      setError(`Enter a Special note explaining the ${ROLE_LABELS[missingNoteRole]} correction.`);
      dialogRef.current?.querySelector(`#import-pr-${missingNoteRole}-note`)?.focus();
      return;
    }
    if (poFile && !(roundProcurementMoney(poEdits.entered_amount) > 0)) {
      setError('');
      setPoAmountError('Enter a PO amount greater than zero from the original PDF, then confirm its VAT treatment.');
      poAmountRef.current?.focus();
      poAmountRef.current?.scrollIntoView({ block: 'center' });
      return;
    }
    if (poFile && poEdits.vat_basis === 'unconfirmed' && (
      String(poEdits.entered_amount) !== String(editablePoFields(preview.po_preview).entered_amount)
      || poEdits.currency !== editablePoFields(preview.po_preview).currency
    )) return setError('Confirm the PO VAT treatment before changing its price or currency.');
    setLoading(true);
    setError('');
    try {
      const manualOverrides = attachmentNumber ? {} : Object.fromEntries(
        EDITABLE_FIELDS.map(([key]) => [key, edits[key] ?? '']),
      );
      if (!attachmentNumber) manualOverrides.project_number = reviewedProjectNumbers;
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
        ...Object.fromEntries(Object.keys(ROLE_LABELS).map(role => {
          const sourceName = capturedSignerName(preview?.approval_detection, role);
          const canCorrectUnknown = isUnknownApprover(sourceName) && String(edits[`${role}_name`] || '').trim() !== sourceName.trim();
          return [`${role}_name`, preview?.document_signed_off && !canCorrectUnknown ? undefined : edits[`${role}_name`] || ''];
        })),
        manual_overrides: JSON.stringify(manualOverrides),
        manual_signature_overrides: preview?.document_signed_off ? undefined : JSON.stringify(manualSignatureOverrides),
        source_approval_review: sourceReviewChanged ? JSON.stringify(reviewedSourceApprovals) : undefined,
        expected_source_approval_review: sourceReviewChanged ? JSON.stringify(expectedSourceApprovals) : undefined,
        reviewed_project_references: projectReferencesChanged ? JSON.stringify({
          project_number: reviewedProjectNumbers, expected_updated_at: preview.requisition_updated_at,
        }) : undefined,
        create_new: createNew ? 'true' : undefined,
      });
      if (sourceReviewChanged && (!data.source_approval_review
        || JSON.stringify(normalizeSourceApprovalReview(data.source_approval_review)) !== JSON.stringify(reviewedSourceApprovals))) {
        throw new Error('The saved Level labels and Additional approver could not be confirmed. Your PDF and review are retained. Check the record before retrying.');
      }
      if (projectReferencesChanged && (!Array.isArray(data.project_numbers)
        || normalizeProjectNumbers(data.project_numbers.join(', ')) !== reviewedProjectNumbers)) {
        throw new Error('The saved project numbers could not be confirmed. Your PDF and reviewed details are retained. Check the record before retrying.');
      }
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
      setResult({ ...data, projectReferencesUpdated: projectReferencesChanged });
      onImported?.(data);
    } catch (requestError) {
      setError(!file && (requestError.response || requestError.code || requestError.originalError) ? importErrorMessage(requestError) : errorMessage(requestError, 'The reviewed document details could not be saved.'));
    } finally {
      setLoading(false);
    }
  };

  const detection = (result || preview)?.approval_detection || {};
  const sourceApprovalRows = detection.approval_rows || [];
  const capturedApprovalDateText = [...new Set((Array.isArray(detection.date_ocr) ? detection.date_ocr : [detection.date_ocr]).filter(value => typeof value === 'string' && value.trim()).map(value => value.trim()))].join(' · ');
  const documentSignedOff = Boolean((result || preview)?.document_signed_off ?? preview?.document_signed_off);
  const confidence = preview?.extracted_data?.field_confidence || {};
  const originalPriceLines = preview?.extracted_data?.price_lines || [];
  const reviewedAmounts = calculateProcurementVat(edits.net_total, 0, { basis: edits.vat_basis || 'unconfirmed' });
  const reviewedMoney = amount => amount === null ? '\u2014' : `${edits.currency || ''} ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`.trim();
  const allIssues = [...new Set([
    ...((result || preview)?.mapping_issues || []),
    ...((result || preview)?.workflow_issues || []),
    ...(result?.purchase_order?.reconciliation_issues || []).map(issue => file ? `PO: ${issue}` : issue),
    ...(result?.purchase_order?.mapping_issues || []).map(issue => file ? `PO: ${issue}` : issue),
    ...(result?.purchase_order?.workflow_issues || []).map(issue => file ? `PO: ${issue}` : issue),
  ])];
  const poCaptureIssues = [...new Set([
    ...(preview?.po_preview?.reconciliation_issues || []),
    ...(preview?.po_preview?.mapping_issues || []),
    ...(preview?.po_preview?.approval_evidence?.issues || []),
  ])];
  const missingPoApprovalFields = [
    !poEvidence.approvedByName.trim() && 'PO approver name',
    !poEvidence.approvedDate && 'PO approval date',
  ].filter(Boolean);

  const missingRequired = EDITABLE_FIELDS.filter(([key, , , required]) => {
    if (!required) return false;
    const confidenceKey = ({ issued_by_name: 'issued_by', supplier_name: 'supplier', description_reason: 'description', net_total: 'price' })[key] || key;
    const edited = String(edits[key] ?? '') !== String(preview?.extracted_data?.[key] ?? '');
    return !String(edits[key] ?? '').trim() || (!edited && (confidence[key] || confidence[confidenceKey]) === 'conflict');
  }).length;
  const sourceSignaturesComplete = sourceApprovalRows.length
    ? sourceApprovalRows.every(row => row.role_key && row.name && (row.signature_detected || detection.manual_signature_overrides?.[row.role_key] || manualSignatures[row.role_key]))
    : Object.keys(ROLE_LABELS).every(key => detection.signatures?.[key] || manualSignatures[key]);
  const additionalApprover = sourceApprovalReview.additional_approver || { name: '', approval_label: '', signature_verified: false };
  const hasAdditionalApprover = Boolean(additionalApprover.name.trim() || additionalApprover.approval_label.trim() || additionalApprover.signature_verified);
  const prApprovalComplete = (documentSignedOff || sourceSignaturesComplete) && Boolean(edits.approval_date);
  const poApprovalComplete = poEvidence.signatureVerified && missingPoApprovalFields.length === 0;
  const approvalComplete = (!file || prApprovalComplete) && (!poFile || poApprovalComplete);
  const poOnly = Boolean(poFile && !file);
  const missingPoRequired = PO_REQUIRED_FIELDS.filter(key => key === 'entered_amount'
    ? !(roundProcurementMoney(poEdits[key]) > 0)
    : key === 'currency' ? !/^[A-Z]{3}$/i.test(String(poEdits[key] || '').trim()) : !String(poEdits[key] || '').trim()).length;
  const fieldsComplete = (!file || !missingRequired) && (!poFile || !missingPoRequired);
  const progressSteps = [
    { label: preview ? 'Source document uploaded' : file || poFile ? 'Source document selected' : 'Source document', complete: Boolean(preview) },
    { label: poOnly ? 'Order details' : 'Required fields', complete: Boolean(preview && fieldsComplete) },
    { label: poOnly ? 'Vendor & approval' : 'Approval & signatures', complete: Boolean(preview && approvalComplete && (!poOnly || String(poEdits.vendor_name || '').trim())) },
  ];
  const saveLabel = loading ? 'Validating and saving...' : poFile ? file ? 'Upload PR and PO' : 'Save PO' : attachmentNumber ? 'Attach signed PDF' : 'Upload PR';
  const poField = key => {
    const [, label, type] = PO_REVIEW_FIELDS.find(([name]) => name === key);
    const displayLabel = ['po_number', 'summary'].includes(key) ? label : label.replace(/^PO /, '');
    const amountError = key === 'entered_amount' && poAmountError;
    const props = { 'aria-label': label, 'aria-required': PO_REQUIRED_FIELDS.includes(key), value: poEdits[key] ?? '', disabled: loading,
      onChange: event => { setPoEdits(current => ({ ...current, [key]: event.target.value })); if (key === 'entered_amount') setPoAmountError(''); } };
    return <label key={key} className="procurement-import-review__po-field">
      <span>{displayLabel}{PO_REQUIRED_FIELDS.includes(key) && <span className="procurement-import-review__required"> *</span>}</span>
      <span className="procurement-import-review__control">
        {type === 'textarea' ? <textarea {...props} rows={1} /> : type === 'select' ? <select {...props}><option value="">Select currency</option>{[...new Set(['AED', 'USD', 'EUR', 'GBP', poEdits.currency].filter(Boolean))].map(currency => <option key={currency} value={currency}>{currency}</option>)}</select>
          : <input {...props} ref={key === 'entered_amount' ? poAmountRef : undefined} type={type} step={type === 'number' ? '0.01' : undefined} aria-invalid={Boolean(amountError)} aria-describedby={amountError ? 'po-entered-price-error' : undefined} />}
        {amountError && <span id="po-entered-price-error" role="alert" className="procurement-import-review__field-error">{poAmountError}</span>}
      </span>
    </label>;
  };
  const field = key => {
    const [, label, inputType, required] = EDITABLE_FIELDS.find(([name]) => name === key);
    const capturedOnly = Boolean(attachmentNumber) && key !== 'project_number';
    const values = capturedOnly ? preview?.extracted_data || {} : edits;
    const confidenceKey = ({ issued_by_name: 'issued_by', supplier_name: 'supplier', description_reason: 'description', net_total: 'price' })[key] || key;
    const edited = String(edits[key] ?? '') !== String(preview?.extracted_data?.[key] ?? '');
    const missing = !String(edits[key] ?? '').trim();
    const conflicting = !missing && !edited && (confidence[key] || confidence[confidenceKey]) === 'conflict';
    const fieldError = capturedOnly ? '' : required && missing ? `Enter ${label.toLowerCase()}.` : conflicting ? 'Conflicting values. Check this field against the PDF.' : '';
    const errorId = `approved-pr-${key}-error`;
    const props = { 'aria-label': label, 'aria-invalid': Boolean(fieldError), 'aria-describedby': fieldError ? errorId : undefined,
      value: values[key] ?? '', disabled: loading, readOnly: capturedOnly,
      placeholder: capturedOnly ? 'Not detected' : key === 'project_number' ? '5900828, 5900985' : undefined,
      ...(key === 'project_number' ? { maxLength: 300, onBlur: () => setEdits(current => ({ ...current, project_number: normalizeProjectNumbers(current.project_number || '') })) } : {}),
      onChange: capturedOnly ? undefined : event => setEdits(current => ({ ...current, [key]: event.target.value })) };
    const displayLabel = ({ supplier_business_id: 'Business ID', price_remarks: 'Price Remarks', description_reason: 'Reason' })[key] || label;
    return <label key={key} className="procurement-import-review__field">
      <span>{displayLabel}{required && !capturedOnly && <span className="procurement-import-review__required"> *</span>}</span>
      <span className="procurement-import-review__control">
        {inputType === 'textarea' ? <textarea {...props} rows={1} /> : inputType === 'select' && !capturedOnly ? <select {...props}><option value="">Select currency</option>{['AED', 'USD', 'EUR', 'GBP'].map(currency => <option key={currency} value={currency}>{currency}</option>)}</select>
          : <input {...props} type={capturedOnly ? 'text' : inputType} list={!capturedOnly && key === 'issued_by_name' ? 'approved-pr-active-employees' : undefined} step={inputType === 'number' ? '0.01' : undefined} />}
        {fieldError && <span id={errorId} className="procurement-import-review__field-error">{fieldError}</span>}
      </span>
    </label>;
  };
  const displayedPriceLines = attachmentNumber ? originalPriceLines : edits.price_lines || originalPriceLines;
  const updatePriceLine = (index, key, value) => setEdits(current => ({ ...current, price_lines: (current.price_lines || originalPriceLines).map((line, row) => row === index ? { ...line, [key]: value } : line) }));
  const handleDialogKeys = event => {
    if (event.key === 'Escape' && !event.defaultPrevented && !event.target.matches('input[list], [role="combobox"][aria-expanded="true"]')) { event.stopPropagation(); close(); }
    if (event.key !== 'Tab') return;
    const elements = [...dialogRef.current.querySelectorAll('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]')].filter(element => element.getClientRects().length && element.tabIndex >= 0);
    const first = elements[0], last = elements.at(-1);
    if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialogRef.current)) { event.preventDefault(); first?.focus(); }
  };

  const identityNotice = file && preview && !result && (numberNeedsCheck || expectedMismatch || missingBoundRecord) && <div role="alert" className="procurement-import-review__identity-status">
              <strong>{expectedMismatch ? 'PR number does not match this recommendation' : missingBoundRecord ? 'The original recommendation is no longer available' : 'Check the corrected PR number'}</strong>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="mt-1 text-xs">{expectedMismatch ? `The PDF number is ${sourceNumber || 'not detected'}. Select the PDF for ${attachmentNumber}.` : missingBoundRecord ? 'Close this attachment flow and select an existing recommendation.' : 'Check whether the PR number already exists before saving.'}</p>
                </div>
                {!attachmentNumber && <button type="button" onClick={checkReviewedNumber} disabled={loading || !reviewedNumber} className="h-9 rounded-lg border border-blue-300 bg-white px-3 text-xs font-semibold text-blue-700">Check PR number</button>}
              </div>
            </div>;

  return createPortal(
    <div className={`procurement-import-review ${poOnly ? 'procurement-import-review--po' : ''} ${isResizing ? 'is-resizing' : ''}`} style={boundaryStyle}>
      <div className="procurement-import-review__modal-shield" aria-hidden="true" />
      <div className="procurement-import-review__overlay">
        <button type="button" tabIndex={-1} aria-label="Close document upload" className="procurement-import-review__backdrop" onPointerDown={event => event.preventDefault()} onClick={close} disabled={loading} />
        <div ref={dialogRef} tabIndex={-1} onKeyDown={handleDialogKeys} role="dialog" aria-modal="true" aria-label="Upload PR, PO and Vendor" className="procurement-import-review__dialog" style={{ width }}>
          {canResize && ['left', 'right'].map(edge => <div key={edge} {...resizeHandleProps(edge)} className={`procurement-import-review__resize procurement-import-review__resize--${edge}`} />)}
          <div className="procurement-import-review__surface">
          <div className="procurement-import-review__header">
            <div>
              <h2 id="approved-pr-import-title">{preview ? file ? 'Review Purchase Recommendation' : 'Review Purchase Order' : 'Upload PR, PO and Vendor'}</h2>
              <p>{preview ? file ? attachmentNumber ? 'Review the extracted PDF data and attach it to the existing recommendation.' : 'Verify the source document, complete the form and create the reviewed PR.' : 'Verify the source PO, confirm order and vendor details, then save.' : 'Upload your PDFs, then review the document and vendor details.'}</p>
            </div>
            <button type="button" aria-label="Close import dialog" onClick={close} disabled={loading}><XMarkIcon className="h-6 w-6" /></button>
          </div>

          <div className="procurement-import-review__progress">
            <ol aria-label="Document review progress">
              {progressSteps.map((step, index) => <li key={step.label} className={step.complete ? 'is-complete' : ''} aria-current={progressSteps.findIndex(item => !item.complete) === index ? 'step' : undefined}>
                  {step.complete ? <CheckCircleIcon aria-hidden="true" /> : <span className="procurement-import-review__step-circle" aria-hidden="true">{poOnly ? index + 1 : ''}</span>}<span>{step.label}<span className="sr-only">{step.complete ? ': complete' : ': pending review'}</span></span>
                </li>)}
            </ol>
            <div className="procurement-import-review__review-status"><DocumentTextIcon aria-hidden="true" /><span>{result ? 'Saved' : preview ? 'Review in progress' : 'Ready to upload'}<small>{result ? 'Import complete' : 'PR, PO and Vendor'}</small></span></div>
          </div>

          <div className={`procurement-import-review__body ${file || poFile ? 'has-source' : ''} ${result ? 'has-result' : ''}`}>
            {(file || poFile) && !result && <div className="procurement-import-review__source">
              <ProcurementImportPdfPreview documents={[
                ...(file ? [{ kind: 'pr', name: file.name, url: fileUrl }] : []),
                ...(poFile ? [{ kind: 'po', name: poFile.name, url: poFileUrl }] : []),
              ]} selectedKind={sourceKind} onSelect={setSourceKind} />
            </div>}
            <div className="procurement-import-review__form overflow-y-auto">
            {preview && !file && !result && <div className="procurement-import-review__form-heading"><div><h3>Purchase order details</h3><p>Fields marked <span className="procurement-import-review__required">*</span> are required</p></div><div className="procurement-import-review__heading-actions"><span className={`procurement-import-review__required-count ${!missingPoRequired ? 'is-complete' : ''}`}>{missingPoRequired ? <><b>{missingPoRequired}</b> required {missingPoRequired === 1 ? 'field' : 'fields'} remaining</> : <><CheckCircleIcon aria-hidden="true" />Required fields complete</>}</span><button type="button" onClick={() => setShowSources(value => !value)} disabled={loading} aria-expanded={showSources} className="procurement-import-review__change-source"><ArrowUpTrayIcon aria-hidden="true" />{showSources ? 'Hide source selection' : 'Change documents'}</button></div></div>}
            {!preview && (attachmentNumber || expectedPrNumber) && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
                Attach to <strong>{attachmentNumber || expectedPrNumber}</strong>.
              </div>
            )}
            {requisitionId && !file && !expectedPrNumber && <p className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">The purchase order will be attached to the purchase recommendation you opened.</p>}

            {!result && <>
              <div ref={sourceSelectionRef} hidden={Boolean(preview && !showSources)} className={`procurement-import-review__uploads ${canImportRequisition && canUploadPurchaseOrder ? 'has-both' : ''}`}>
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
            </>}

            {error && <div role="alert" className="flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"><ExclamationTriangleIcon className="h-5 w-5 flex-none" />{error}</div>}

            {identityNotice}

            {(file || poFile) && !result && (
              <div className="procurement-import-review__details">
                <div className="procurement-import-review__sections">
                  {!preview && <section className="procurement-import-review__extraction-prompt" aria-label="Extract PDF data" aria-busy={loading}>
                    <DocumentTextIcon aria-hidden="true" />
                    <div><h3>{loading ? 'Extracting PDF data…' : 'Extract data from your PDF'}</h3><p role="status">{loading ? 'Reading the selected documents. Extracted details will appear here when ready.' : 'The PDF is selected. Run OCR to show its extracted fields here for review.'}</p></div>
                    <button type="button" disabled={loading} onClick={capturePreview}>{loading ? 'Running OCR…' : 'Extract PDF data'}</button>
                  </section>}
                  {file && preview && <>
                  <>
                    <div className="procurement-import-review__columns">
                      <section className="procurement-import-review__section" aria-labelledby="import-pr-information">
                        <h4 id="import-pr-information">PR information</h4>
                        <div className="procurement-import-review__section-body">
                          {['issued_date', 'product_service', 'supplier_name', 'supplier_business_id', 'project_department', 'project_number', 'preferred_supplier', 'net_total'].map(field)}
                        </div>
                      </section>
                      <section className="procurement-import-review__section" aria-labelledby="import-pr-financials">
                        <h4 id="import-pr-financials">Financial information</h4>
                        <div className="procurement-import-review__section-body">
                          {['currency', 'price_remarks', 'budget_in_aed', 'net_total_aed', 'po_reference', 'special_notes'].map(field)}
                          {!attachmentNumber && <><label className="procurement-import-review__field"><span>VAT price basis</span><select aria-label="VAT price basis" disabled={loading} value={edits.vat_basis || 'unconfirmed'} onChange={event => setEdits(previous => ({ ...previous, vat_basis: event.target.value }))}><option value="unconfirmed">Not confirmed</option>{PROCUREMENT_VAT_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                          {edits.vat_basis === 'unconfirmed' ? <p className="procurement-import-review__info"><InformationCircleIcon aria-hidden="true" /><span>VAT is not confirmed; recorded amounts remain unchanged.</span></p>
                            : <dl aria-label="Reviewed recommendation totals" className="procurement-import-review__totals"><div><dt>Net excluding VAT</dt><dd>{reviewedMoney(reviewedAmounts.netAmount)}</dd></div><div><dt>{reviewedAmounts.vatRate === 0 ? 'No VAT' : 'VAT (5%)'}</dt><dd>{reviewedMoney(reviewedAmounts.taxAmount)}</dd></div><div><dt>Total</dt><dd>{reviewedMoney(reviewedAmounts.totalAmount)}</dd></div></dl>}</>}
                        </div>
                      </section>
                    </div>
                    <section className="procurement-import-review__section" aria-labelledby="import-pr-breakdown">
                      <h4 id="import-pr-breakdown">Description and price breakdown</h4>
                      <div className="procurement-import-review__section-body">
                        {field('description_reason')}
                        <div className="procurement-import-review__table-scroll">
                          <table className={`procurement-import-review__price-table ${attachmentNumber ? 'is-captured' : ''}`}>
                            <thead><tr><th scope="col">#</th><th scope="col">Description</th><th scope="col">Amount</th><th scope="col">Remarks</th>{!attachmentNumber && <th scope="col"><button type="button" disabled={loading || displayedPriceLines.length >= 500} onClick={() => setEdits(current => ({ ...current, price_lines: [...(current.price_lines || originalPriceLines), { description: '', total: '', currency: current.currency || '', remarks: '' }] }))}><PlusCircleIcon aria-hidden="true" />Add line</button></th>}</tr></thead>
                            <tbody>{displayedPriceLines.map((line, index, lines) => <tr key={index}>
                              <td>{index + 1}</td>
                              <td><input aria-label={`Price line ${index + 1} description`} disabled={loading} readOnly={Boolean(attachmentNumber)} value={line.description || ''} onChange={event => updatePriceLine(index, 'description', event.target.value)} /></td>
                              <td><div className="procurement-import-review__line-amount"><input aria-label={`Price line ${index + 1} amount`} disabled={loading} readOnly={Boolean(attachmentNumber)} type={attachmentNumber ? 'text' : 'number'} step="0.01" value={line.total ?? ''} onChange={event => updatePriceLine(index, 'total', event.target.value)} />{attachmentNumber ? <input className="procurement-import-review__captured-currency" aria-label={`Price line ${index + 1} currency`} readOnly value={line.currency || ''} placeholder="—" /> : <select aria-label={`Price line ${index + 1} currency`} disabled={loading} value={line.currency || ''} onChange={event => updatePriceLine(index, 'currency', event.target.value)}><option value="">Currency</option>{['AED', 'USD', 'EUR', 'GBP'].map(currency => <option key={currency} value={currency}>{currency}</option>)}</select>}</div></td>
                              <td><input aria-label={`Price line ${index + 1} remarks`} disabled={loading} readOnly={Boolean(attachmentNumber)} value={line.remarks || ''} onChange={event => updatePriceLine(index, 'remarks', event.target.value)} /></td>
                              {!attachmentNumber && <td><button type="button" aria-label={`Remove price line ${index + 1}`} title={lines.length === 1 ? 'Keep at least one price line' : 'Remove price line'} disabled={loading || lines.length === 1} onClick={() => setEdits(current => ({ ...current, price_lines: (current.price_lines || originalPriceLines).filter((_, row) => row !== index) }))}><TrashIcon aria-hidden="true" /></button></td>}
                            </tr>)}</tbody>
                          </table>
                        </div>
                        {displayedPriceLines.length === 0 && <p className="procurement-import-review__empty">{attachmentNumber ? 'No price lines detected in the PDF.' : 'No price lines captured. Add a line to record the breakdown.'}</p>}
                      </div>
                    </section>
                  </>

                  <section className="procurement-import-review__section" aria-labelledby="import-pr-approvals">
                    <h4 id="import-pr-approvals">Approval &amp; signatories</h4>
                    <div className="procurement-import-review__section-body procurement-import-review__approvals">
                      {employeeLoadError && <p className="text-xs text-amber-700">{employeeLoadError}</p>}
                      <datalist id="approved-pr-active-employees">{employees.map(employee => <option key={employee.id} value={employeeDisplayName(employee)}>{[employee.email, employee.job_title, employee.department].filter(Boolean).join(' · ')}</option>)}</datalist>
                      <div className="procurement-import-review__signer-headings" aria-hidden="true"><span>Role</span><span>Level</span><span>Signer</span><span>Signature</span></div>
                      {!isLevelZeroApprover(additionalApprover.name) && !sourceApprovalRows.some(row => isLevelZeroApprover(row.name || row.raw_name)) && <div className="procurement-import-review__signer">
                        <label htmlFor="import-pr-level-zero-signer">Procurement</label>
                        <input className="procurement-import-review__approval-level" aria-label="Procurement level" readOnly value="0" />
                        <input id="import-pr-level-zero-signer" aria-label="Procurement approver, Level 0" readOnly value={preview?.default_level_zero_approver?.full_name || 'Richa Hannah Thomas'} />
                        <span className="procurement-import-review__signature-status">Not recorded</span>
                      </div>}
                      {Object.entries(ROLE_LABELS).map(([key, label]) => {
                        const sourceRows = sourceApprovalRows.filter(row => row.role_key === key);
                        const absentFromSource = sourceApprovalRows.length > 0 && sourceRows.length === 0;
                        const unknownSource = isUnknownApprover(capturedSignerName(detection, key));
                        const capturedOnly = (documentSignedOff && !unknownSource) || absentFromSource || sourceRows.length > 1;
                        const automaticallyDetected = Boolean(sourceRows.length ? sourceRows.every(row => row.signature_detected) : detection.signatures?.[key]);
                        const manuallyVerified = Boolean(manualSignatures[key]);
                        const signerName = capturedOnly ? capturedSignerName(detection, key) : edits[`${key}_name`] || '';
                        const levelZero = isLevelZeroApprover(signerName);
                        return <div key={key} className="procurement-import-review__signer">
                          <div><label htmlFor={`import-pr-${key}-signer`}>{label}</label>{sourceRows.length === 1 && sourceRows[0].source_role && <small className="procurement-import-review__source-role">PDF: {sourceRows[0].source_role}</small>}</div>
                          <input className="procurement-import-review__approval-level" aria-label={`${label} level`} title="Level label shown in the PDF" maxLength={20} disabled={loading} readOnly={levelZero} value={levelZero ? '0' : sourceApprovalReview.approval_labels[key] || ''} placeholder="Level" onChange={event => setSourceApprovalReview(current => ({ ...current, approval_labels: { ...current.approval_labels, [key]: event.target.value } }))} />
                          <input id={`import-pr-${key}-signer`} aria-label={label} disabled={loading} readOnly={capturedOnly} list={capturedOnly ? undefined : 'approved-pr-active-employees'} value={capturedOnly ? absentFromSource ? '' : capturedSignerName(detection, key) : edits[`${key}_name`] || ''} onChange={capturedOnly ? undefined : event => setEdits(current => ({ ...current, [`${key}_name`]: event.target.value }))} placeholder={capturedOnly ? 'Not detected' : 'Select signer'} />
                          {absentFromSource ? <span className="procurement-import-review__signature-status">Not on document</span> : automaticallyDetected ? <span className="procurement-import-review__verified"><CheckCircleIcon aria-hidden="true" />Detected</span> : documentSignedOff ? <span className="procurement-import-review__signature-status">Not detected</span> : <label className="procurement-import-review__verify"><input type="checkbox" disabled={loading} aria-label={manuallyVerified ? 'Signature verified in PDF' : 'Verify signature in PDF'} checked={manuallyVerified} onChange={event => setManualSignatures(current => ({ ...current, [key]: event.target.checked }))} /><span>Verify</span></label>}
                          {sourceRows.map((row, index) => (row.remarks || sourceRows.length > 1) && <p key={index} className="procurement-import-review__source-approval-note">{sourceRows.length > 1 && <span>{row.source_role || label}: {row.name || row.raw_name || 'Name not detected'} — {row.signature_detected ? 'Signature detected' : 'Signature not detected'}. </span>}{row.remarks && <span>Remarks: {row.remarks}</span>}</p>)}
                          {(unknownSource || sourceApprovalReview.approver_notes?.[key]) && <label className="procurement-import-review__signer-note">Special note
                            <textarea id={`import-pr-${key}-note`} aria-label={`${label} special note`} rows={1} maxLength={2000} disabled={loading} value={sourceApprovalReview.approver_notes?.[key] || ''} placeholder="Explain any name or Level correction" onChange={event => setSourceApprovalReview(current => ({ ...current, approver_notes: { ...current.approver_notes, [key]: event.target.value } }))} />
                          </label>}
                        </div>;
                      })}
                      {sourceApprovalRows.filter(row => !Object.hasOwn(ROLE_LABELS, row.role_key)).map((row, index) => <div key={`additional-${index}`} className="procurement-import-review__signer">
                        <label htmlFor={`import-pr-source-signer-${index}`}>{row.source_role || 'Additional source signer'}</label>
                        <span className="procurement-import-review__captured-level" aria-label={`${row.source_role || 'Source signer'} level`}>{isLevelZeroApprover(row.name || row.raw_name) ? '0' : row.approval_label || '—'}</span>
                        <input id={`import-pr-source-signer-${index}`} readOnly value={row.name || row.raw_name || ''} placeholder="Not detected" />
                        {row.signature_detected ? <span className="procurement-import-review__verified"><CheckCircleIcon aria-hidden="true" />Detected</span> : <span className="procurement-import-review__signature-status">Not detected</span>}
                        {row.remarks && <p className="procurement-import-review__source-approval-note">Remarks: {row.remarks}</p>}
                      </div>)}
                      <div className="procurement-import-review__signer procurement-import-review__additional-signer">
                        <div><label htmlFor="import-pr-additional-signer">Additional</label><small className="procurement-import-review__source-role">Optional</small></div>
                        <input className="procurement-import-review__approval-level" aria-label="Additional approver level" title="Level label shown in the PDF" maxLength={20} disabled={loading} readOnly={isLevelZeroApprover(additionalApprover.name)} value={isLevelZeroApprover(additionalApprover.name) ? '0' : additionalApprover.approval_label} placeholder="Level" onChange={event => { setAdditionalApproverError(''); setSourceApprovalReview(current => ({ ...current, additional_approver: { ...additionalApprover, approval_label: event.target.value } })); }} />
                        <input id="import-pr-additional-signer" aria-label="Additional approver" aria-invalid={Boolean(additionalApproverError)} aria-describedby={additionalApproverError ? 'import-pr-additional-error' : undefined} list="approved-pr-active-employees" maxLength={200} disabled={loading} value={additionalApprover.name} placeholder="Select signer" onChange={event => { setAdditionalApproverError(''); setSourceApprovalReview(current => ({ ...current, additional_approver: { ...additionalApprover, name: event.target.value, signature_verified: false } })); }} />
                        <div className="procurement-import-review__additional-actions">
                          <label className="procurement-import-review__verify"><input type="checkbox" disabled={loading || !additionalApprover.name.trim()} aria-label="Verify additional approver signature in PDF" checked={additionalApprover.signature_verified} onChange={event => setSourceApprovalReview(current => ({ ...current, additional_approver: { ...additionalApprover, signature_verified: event.target.checked } }))} /><span>Verify</span></label>
                          {hasAdditionalApprover && <button type="button" aria-label="Clear additional approver" disabled={loading} onClick={() => { setSourceApprovalReview(current => ({ ...current, additional_approver: null })); setAdditionalApproverError(''); }}>Clear</button>}
                        </div>
                        {hasAdditionalApprover && <label className="procurement-import-review__signer-note">Special note
                          <textarea id="import-pr-additional-note" aria-label="Additional approver special note" rows={1} maxLength={2000} disabled={loading} value={additionalApprover.special_note || ''} placeholder="Explain any name or Level correction" onChange={event => { setAdditionalApproverError(''); setSourceApprovalReview(current => ({ ...current, additional_approver: { ...additionalApprover, special_note: event.target.value } })); }} />
                        </label>}
                        {additionalApproverError && <p id="import-pr-additional-error" role="alert" className="procurement-import-review__field-error">{additionalApproverError}</p>}
                      </div>
                      <label className="procurement-import-review__field procurement-import-review__approval-date"><span>PR Approval date</span><input disabled={loading} aria-invalid={Boolean(detection.approval_date_evidence?.review_required && !edits.approval_date)} type="date" value={edits.approval_date || ''} onChange={event => setEdits(current => ({ ...current, approval_date: event.target.value }))} /></label>
                      {detection.approval_date_evidence?.review_required && !edits.approval_date && <p className="procurement-import-review__field-error">Enter the approval date shown in the PDF.</p>}
                      {capturedApprovalDateText && <p className="procurement-import-review__source-approval-note">Captured date text: {capturedApprovalDateText}</p>}
                    </div>
                  </section>
                  <section className="procurement-import-review__section" aria-labelledby="import-pr-identity"><h4 id="import-pr-identity">Document identity</h4><div className="procurement-import-review__section-body procurement-import-review__identity-fields">{['pr_number', 'issued_by_name'].map(field)}</div></section>
                  </>}
                  {poFile && preview?.po_preview && <section aria-label="Review purchase order PDF" className="procurement-import-review__po">
                    {file && <h3 className="procurement-import-review__po-title">Purchase order details</h3>}
                    <div className="procurement-import-review__po-columns">
                      <section className="procurement-import-review__section" aria-labelledby="import-po-order">
                        <h4 id="import-po-order">Order information</h4>
                        <div className="procurement-import-review__po-card-body">
                          {['po_number', 'summary'].map(poField)}
                          <div className="procurement-import-review__po-pairs">{['currency', 'entered_amount', 'po_date', 'expected_delivery', 'project_number', 'payment_mode'].map(poField)}</div>
                        </div>
                      </section>
                      <section className="procurement-import-review__section" aria-labelledby="import-po-commercial">
                        <h4 id="import-po-commercial">Commercial terms</h4>
                        <div className="procurement-import-review__po-card-body">
                          {['payment_terms', 'delivery_terms', 'seller_reference', 'quote_ref'].map(poField)}
                          <label className="procurement-import-review__po-field"><span>VAT price basis</span><select aria-label="PO VAT price basis" value={poEdits.vat_basis || 'unconfirmed'} disabled={loading} onChange={event => setPoEdits(current => ({ ...current, vat_basis: event.target.value }))}><option value="unconfirmed">Keep captured PO amounts</option>{PROCUREMENT_VAT_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                          {!file && !requisitionId && canLinkPurchaseOrder && <section aria-label="Link purchase recommendation" className="procurement-import-review__po-link">
                            <label className="procurement-import-review__po-field"><span>Search recommendations</span><input value={prSearch} disabled={loading} onChange={event => setPrSearch(event.target.value)} placeholder="Type PR number or description" /></label>
                            <label className="procurement-import-review__po-field"><span>Purchase recommendation</span><select value={selectedPrId} disabled={loading} onChange={event => setSelectedPrId(event.target.value)}><option value="">Match from PDF when available</option>{selectedPrId && !prOptions.some(pr => String(pr.id) === selectedPrId) && <option value={selectedPrId}>{preview.po_preview.extracted_data?.pr_number || 'Selected recommendation'}</option>}{prOptions.map(pr => <option key={pr.id} value={pr.id}>{pr.pr_number}{pr.product_service ? ` - ${pr.product_service}` : ''}</option>)}</select></label>
                            {prLoading && <p role="status" className="text-xs text-gray-600">Loading recommendations...</p>}
                            {prSearchError && <p role="alert" className="text-xs text-amber-800">{prSearchError} <button type="button" onClick={() => setPrSearchRetry(value => value + 1)} className="underline">Retry recommendations</button></p>}
                          </section>}
                        </div>
                      </section>
                    </div>
                    <ProcurementImportVendorReview compact fields={poEdits} disabled={loading} onChange={changes => setPoEdits(current => ({ ...current, ...changes }))} />
                    <fieldset className="procurement-import-review__section procurement-import-review__po-approval" aria-label="PO approval evidence" disabled={loading}>
                      <legend className="sr-only">PO approval evidence</legend>
                      <h4>Approval evidence</h4>
                      <div className="procurement-import-review__po-card-body">
                        <p className="procurement-import-review__info"><InformationCircleIcon aria-hidden="true" /><span>Confirm the approver against the source PDF before saving.</span></p>
                        <div className="procurement-import-review__po-evidence-grid">
                          <div className="procurement-import-review__po-approver"><ProcurementApprovalEmployeeSearch label="PO Approver name" value={poEvidence.approvedByName} disabled={loading} onChange={(value, clearTitle) => setPoEvidence(current => ({ ...current, approvedByName: value, ...(clearTitle ? { approvedByTitle: '' } : {}) }))} onSelect={employee => setPoEvidence(current => ({ ...current, approvedByName: employee.name, approvedByTitle: employee.position || '' }))} /></div>
                          <label className="procurement-import-review__verify"><input type="checkbox" checked={poEvidence.signatureVerified} onChange={event => setPoEvidence(current => ({ ...current, signatureVerified: event.target.checked }))} />PO approval signature is visible</label>
                          <label className="procurement-import-review__po-field"><span>Approval date</span><input aria-label="PO Approval date" type="date" value={poEvidence.approvedDate} onChange={event => setPoEvidence(current => ({ ...current, approvedDate: event.target.value }))} /></label>
                          <label className="procurement-import-review__verify"><input type="checkbox" checked={poEvidence.stampVerified} onChange={event => setPoEvidence(current => ({ ...current, stampVerified: event.target.checked }))} />PO company stamp is visible</label>
                          <label className="procurement-import-review__po-field"><span>Approver title</span><input aria-label="PO Approver title" value={poEvidence.approvedByTitle} onChange={event => setPoEvidence(current => ({ ...current, approvedByTitle: event.target.value }))} /></label>
                        </div>
                        {poEvidence.signatureVerified && missingPoApprovalFields.length > 0 && <div role="status" aria-label="PO approval evidence warning" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900"><p className="font-semibold">Missing {missingPoApprovalFields.join(' and ')}.</p><p className="mt-1">You can save now. The PO approval evidence will be kept for review.</p></div>}
                      </div>
                    </fieldset>
                    {poCaptureIssues.length > 0 && <div className="space-y-1 text-xs text-amber-800"><p className="font-semibold">Captured extraction notes</p><p>These describe the original PDF capture. Your reviewed values will be checked when saved.</p><ul className="list-disc space-y-1 pl-5">{poCaptureIssues.map(issue => <li key={issue}>{issue}</li>)}</ul></div>}
                  </section>}
                </div>
              </div>
            )}

            {result && (
              <div className="space-y-4">
                {result.financial_values_preserved && !attachmentNumber && <p className="text-sm text-gray-600">Existing financial values were kept. Confirm the VAT treatment in Edit before changing them.</p>}
                {file && <div className="flex gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                  <CheckCircleIcon className="h-5 w-5 flex-none" />
                  <div><strong>{result.pr_number}</strong>{attachmentNumber ? ' has the signed PDF attached' : ` was ${result.created ? 'created from the reviewed PDF' : 'updated from the reviewed PDF'}`}. {result.projectReferencesUpdated ? 'Project numbers and review were saved.' : attachmentNumber ? 'Existing recommendation values were kept.' : 'The source PDF is attached.'} Status: <strong>{result.status}</strong>.</div>
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
          </div>

          <div className="procurement-import-review__footer">
            <div className="procurement-import-review__footer-secondary">
              {preview && !result && <button type="button" onClick={reset} disabled={loading} className="inline-flex h-9 items-center rounded-lg border border-gray-300 bg-white px-4 text-xs font-semibold text-gray-700"><ArrowPathIcon className="mr-1.5 h-4 w-4" />Start Over</button>}
              {file && preview && !result && <button type="button" onClick={() => setShowSources(value => !value)} disabled={loading} aria-label={showSources ? 'Hide source selection' : 'Change documents'} aria-expanded={showSources} className="procurement-import-review__footer-source"><ArrowUpTrayIcon aria-hidden="true" /><span>{showSources ? 'Hide source selection' : 'Change documents'}</span></button>}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={close} disabled={loading} className="h-9 rounded-lg border border-gray-300 bg-white px-4 text-xs font-semibold text-gray-700">{result ? 'Close' : 'Cancel'}</button>
              {!preview && !result && <button type="button" onClick={capturePreview} disabled={(!file && !poFile) || loading} className="h-9 rounded-lg bg-indigo-600 px-4 text-xs font-semibold text-white disabled:opacity-50">{loading ? 'Running OCR...' : 'Preview OCR'}</button>}
              {preview && !result && <button type="button" onClick={saveReviewed} disabled={loading || numberNeedsCheck || expectedMismatch || missingBoundRecord || Boolean(poFile && !preview.po_preview?.extracted_data)} className="procurement-import-review__submit">{saveLabel}</button>}
            </div>
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
