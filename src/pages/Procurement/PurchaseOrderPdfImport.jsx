import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
import {
  CheckCircleIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  LinkIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import apiClient from '../../services/api.service';
import PdfDocumentPreview from '../../components/Common/PdfDocumentPreview';
import { toast } from 'react-toastify';
import { calculateProcurementVat, PROCUREMENT_VAT_OPTIONS } from '../../utils/procurementVat';
import PurchaseRequisitionPdfImport from './PurchaseRequisitionPdfImport';
import { importDetailText } from './procurementPdfImportErrors';

const DOCUMENT_FIELDS = [
  ['po_number', 'PO number', 'text'], ['summary', 'Description', 'textarea'],
  ['vendor_name', 'Supplier name', 'text'], ['currency', 'Currency', 'currency'],
  ['total_amount', 'Price amount', 'number'], ['tax_amount', 'VAT amount', 'number'],
  ['gross_amount', 'Gross amount', 'number'], ['po_date', 'Order date', 'date'],
  ['expected_delivery', 'Expected delivery', 'date'],
];
const editableDocument = result => {
  return {
    ...Object.fromEntries(DOCUMENT_FIELDS.map(([field]) => [field, result?.[field] == null ? '' : String(result[field])])),
    total_amount: result?.canonical_financials?.entered_amount ?? result?.entered_amount ?? result?.total_amount ?? '',
    tax_amount: result?.canonical_financials?.tax_amount ?? result?.tax_amount ?? '',
    gross_amount: result?.canonical_financials?.total_amount ?? result?.gross_amount ?? '',
    vat_basis: 'unconfirmed',
    pr_id: result?.pr_id || '', pr_number: result?.pr_number || '',
  };
};

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

const SavedPurchaseOrderPdfImport = ({ isOpen, onClose, onImported, documentId, editMode = false, pageMode = false, canReconcile = false, canEditDocument = true, requisitionId = null }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [savedPdf, setSavedPdf] = useState(null);
  const [documentName, setDocumentName] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [reload, setReload] = useState(0);
  const [documentEdits, setDocumentEdits] = useState({});
  const [fieldErrors, setFieldErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [changesSaved, setChangesSaved] = useState(false);
  const [prSearch, setPrSearch] = useState('');
  const [prQuery, setPrQuery] = useState('');
  const [prOptions, setPrOptions] = useState([]);
  const [prLoading, setPrLoading] = useState(false);
  const [prError, setPrError] = useState('');
  const [prReload, setPrReload] = useState(0);
  const [supplierSearch, setSupplierSearch] = useState('');
  const [supplierOptions, setSupplierOptions] = useState([]);
  const [supplierLoading, setSupplierLoading] = useState(false);
  const [supplierError, setSupplierError] = useState('');
  const [supplierReload, setSupplierReload] = useState(0);
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [reconciling, setReconciling] = useState(false);
  const originatingRequisitionId = requisitionId || result?.originating_pr_id || null;
  const savedDetailsReady = Boolean(result && String(result.document_id) === String(documentId));
  const canChooseRequisition = isOpen && savedDetailsReady && editMode && canEditDocument && !originatingRequisitionId;
  const canChooseSupplier = isOpen && savedDetailsReady && editMode && canEditDocument && canReconcile && !result.purchase_order_id;

  useEffect(() => {
    if (!isOpen || !savedPdf) { setPreviewUrl(''); return undefined; }
    const url = window.URL.createObjectURL(savedPdf);
    setPreviewUrl(url);
    return () => window.URL.revokeObjectURL(url);
  }, [savedPdf, isOpen]);

  useEffect(() => {
    if (!isOpen || !documentId) return undefined;
    const controller = new AbortController();
    setLoading(true);
    setError('');
    setSavedPdf(null);
    setDocumentName('');
    setResult(null);
    Promise.allSettled([
      apiClient.get(`/procurement/po-documents/${documentId}/`, { signal: controller.signal }),
      apiClient.get(`/procurement/po-documents/${documentId}/content/`, { responseType: 'blob', signal: controller.signal }),
    ]).then(([metadata, content]) => {
      if (controller.signal.aborted) return;
      const issues = [];
      if (metadata.status === 'fulfilled') {
        const saved = metadata.value.data;
        const fields = saved.extracted_data || {};
        setDocumentName(saved.original_filename || 'Signed purchase order.pdf');
        setSelectedVendorId(fields.vendor_id ? String(fields.vendor_id) : '');
        setResult({ ...fields, canonical_financials: saved.canonical_financials ?? fields.canonical_financials, document_id: saved.id, purchase_order_id: saved.confirmed_po || null, operation: 'saved' });
        if (saved.extraction_error) issues.push(saved.extraction_error);
      } else issues.push('The saved document details could not be loaded.');
      if (content.status === 'fulfilled') setSavedPdf(content.value.data);
      else issues.push('The saved PDF preview could not be loaded.');
      setError(issues.join(' '));
      setLoading(false);
    });
    return () => controller.abort();
  }, [isOpen, documentId, reload]);

  useEffect(() => {
    if (documentId && result) {
      setDocumentEdits({ ...editableDocument(result), ...(originatingRequisitionId ? { pr_id: String(originatingRequisitionId) } : {}) });
      setFieldErrors({});
    }
  }, [documentId, result, originatingRequisitionId]);

  useEffect(() => {
    if (!canChooseRequisition) return undefined;
    const controller = new AbortController();
    setPrLoading(true);
    setPrError('');
    apiClient.get('/procurement/orders/available-requisitions/', { params: { search: prQuery, limit: 100 }, signal: controller.signal })
      .then(response => {
        if (controller.signal.aborted) return;
        const rows = Array.isArray(response.data) ? response.data : response.data?.results;
        if (!Array.isArray(rows)) throw new Error('Purchase recommendations could not be loaded.');
        setPrOptions(rows);
      })
      .catch(() => { if (!controller.signal.aborted) setPrError('Purchase recommendations could not be loaded. The current link is retained.'); })
      .finally(() => { if (!controller.signal.aborted) setPrLoading(false); });
    return () => controller.abort();
  }, [canChooseRequisition, documentId, prQuery, prReload]);

  useEffect(() => {
    if (!canChooseSupplier) return undefined;
    const controller = new AbortController();
    setSupplierLoading(true);
    setSupplierError('');
    const timer = window.setTimeout(() => {
      apiClient.get('/procurement/vendors/', { params: { search: supplierSearch, page_size: 50 }, signal: controller.signal, suppressErrorToast: true })
        .then(({ data }) => {
          if (controller.signal.aborted) return;
          const rows = Array.isArray(data) ? data : data?.results;
          if (!Array.isArray(rows)) throw new Error('Supplier master unavailable.');
          setSupplierOptions(rows.filter(supplier => supplier.is_active !== false));
        })
        .catch(() => { if (!controller.signal.aborted) setSupplierError('Suppliers could not be loaded. Retry the supplier search.'); })
        .finally(() => { if (!controller.signal.aborted) setSupplierLoading(false); });
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [canChooseSupplier, documentId, supplierSearch, supplierReload]);

  if (!isOpen) return null;

  const originPendingReview = Boolean(originatingRequisitionId && editMode && result && !result.purchase_order_id);
  const reconciliationPending = Boolean(result && (result.reconciliation_required || !result.pr_id || !result.vendor_id));
  const reconciliationIssues = result?.reconciliation_issues?.length
    ? result.reconciliation_issues
    : reconciliationPending ? [
      !result.pr_id && 'Link the matching purchase recommendation when it is available.',
      !result.vendor_id && 'Match the supplier to a vendor record to complete the purchase order.',
    ].filter(Boolean) : [];

  const resetAndClose = () => {
    if (saving || reconciling) return;
    setLoading(false);
    setSavedPdf(null);
    setDocumentName('');
    setResult(null);
    setError('');
    setFieldErrors({});
    setChangesSaved(false);
    setDocumentEdits({});
    setPrSearch('');
    setPrQuery('');
    setPrOptions([]);
    setPrError('');
    setSupplierSearch('');
    setSupplierOptions([]);
    setSelectedVendorId('');
    setSupplierError('');
    onClose();
  };

  const updateDocumentField = (field, value) => {
    if (field === 'vendor_name' && originatingRequisitionId) setSelectedVendorId('');
    setDocumentEdits(current => {
      const next = { ...current, [field]: value };
      if (['total_amount', 'vat_basis'].includes(field)) {
        const pricing = calculateProcurementVat(next.total_amount, 0, { basis: next.vat_basis });
        const recorded = editableDocument(result);
        next.tax_amount = next.vat_basis === 'unconfirmed' ? recorded.tax_amount : pricing.taxAmount ?? '';
        next.gross_amount = next.vat_basis === 'unconfirmed' ? recorded.gross_amount : pricing.totalAmount ?? '';
      }
      return next;
    });
    setFieldErrors(current => ({ ...current, [field]: '' }));
    setChangesSaved(false);
  };

  const validateReviewedPrice = () => {
    if (documentEdits.vat_basis === 'unconfirmed' && (
      String(documentEdits.total_amount) !== String(editableDocument(result).total_amount)
      || documentEdits.currency !== editableDocument(result).currency
    )) {
      setError('Confirm whether this price includes VAT, excludes VAT, or has no VAT before saving.');
      return false;
    }
    return true;
  };

  const reviewedDocumentPayload = () => {
    const payload = Object.fromEntries(DOCUMENT_FIELDS.filter(([field]) => !['total_amount', 'tax_amount', 'gross_amount'].includes(field)).map(([field, , type]) => [field, ['date', 'number'].includes(type) ? documentEdits[field] || null : documentEdits[field] ?? '']));
    if (documentEdits.vat_basis && documentEdits.vat_basis !== 'unconfirmed') {
      payload.vat_basis = documentEdits.vat_basis;
      payload.entered_amount = documentEdits.total_amount;
    }
    payload.pr_id = originatingRequisitionId || documentEdits.pr_id || null;
    return payload;
  };

  const saveDocument = async () => {
    if (!documentId || !canEditDocument || saving || loading || !validateReviewedPrice()) return;
    setSaving(true);
    setChangesSaved(false);
    setError('');
    setFieldErrors({});
    const payload = reviewedDocumentPayload();
    try {
      const response = await apiClient.patch(`/procurement/po-documents/${documentId}/`, payload, { suppressErrorToast: true });
      const saved = response.data;
      const fields = saved.extracted_data || saved;
      setResult(current => ({ ...current, ...fields, canonical_financials: saved.canonical_financials ?? fields.canonical_financials, document_id: saved.id || documentId, purchase_order_id: saved.confirmed_po ?? current.purchase_order_id }));
      setChangesSaved(true);
      onImported?.(saved);
      return saved;
    } catch (problem) {
      const details = problem.response?.data || {};
      const errors = details.errors || details;
      const extractedErrors = Object.fromEntries([...DOCUMENT_FIELDS.map(([field]) => field), 'pr_id'].filter(field => errors[field]).map(field => [field, Array.isArray(errors[field]) ? errors[field].join(' ') : String(errors[field])]));
      setFieldErrors(extractedErrors);
      if (!Object.keys(extractedErrors).length) setError(details.error || details.detail || 'Document changes could not be saved.');
      return null;
    } finally { setSaving(false); }
  };

  const savePurchaseOrder = async () => {
    if (!originPendingReview || !canReconcile || !canEditDocument || loading || saving || reconciling || !validateReviewedPrice()) return;
    if (!selectedVendorId && !documentEdits.vendor_name?.trim()) {
      setFieldErrors(current => ({ ...current, vendor_name: 'Enter the supplier name from the signed PO or select an existing supplier.' }));
      return;
    }
    setReconciling(true);
    setError('');
    setFieldErrors({});
    try {
      const { data } = await apiClient.post(`/procurement/po-documents/${documentId}/reconcile/`, {
        pr_id: originatingRequisitionId,
        vendor_id: selectedVendorId || null,
        reviewed_fields: reviewedDocumentPayload(),
      }, { suppressErrorToast: true });
      const linked = data?.po_link;
      if (!data?.purchase_order_id || String(data.pr_id) !== String(originatingRequisitionId)
        || !['linked', 'already_linked'].includes(linked?.status) || linked.manual_link_required !== false
        || String(linked.po_id) !== String(data.purchase_order_id)) {
        setError('The purchase order link could not be confirmed. Check the purchase order register before retrying. Your reviewed details are retained here.');
        return;
      }
      onImported?.(data);
      toast.success('Purchase order saved and linked to this purchase recommendation.');
      onClose();
    } catch (problem) {
      const details = problem.response?.data || {};
      const errors = details.errors?.reviewed_fields || details.reviewed_fields || details.errors || details;
      const extractedErrors = Object.fromEntries([...DOCUMENT_FIELDS.map(([field]) => field), 'pr_id'].filter(field => errors[field]).map(field => [field, importDetailText(errors[field])]));
      setFieldErrors(extractedErrors);
      setError(importDetailText(details.error || details.detail || details.po_link?.message || details.message)
        || (Object.keys(extractedErrors).length ? 'Review the highlighted details before saving the purchase order.' : importDetailText(details.errors || details)
          || 'The purchase order could not be saved. Your reviewed details are retained; correct the issue and try Save PO again.'));
    } finally { setReconciling(false); }
  };

  const completeReconciliation = async () => {
    if (!canReconcile || !documentId || loading || saving || reconciling) return;
    const vendorId = selectedVendorId;
    const prId = originatingRequisitionId || documentEdits.pr_id || result?.pr_id;
    if (!prId || !vendorId) {
      setError(!prId ? 'Choose a purchase recommendation before completing reconciliation.' : 'Select the matching supplier from the supplier master.');
      return;
    }
    setReconciling(true);
    setError('');
    try {
      if (!await saveDocument()) return;
      const response = await apiClient.post(`/procurement/po-documents/${documentId}/reconcile/`, { vendor_id: vendorId, pr_id: prId }, { suppressErrorToast: true });
      onImported?.(response.data);
      toast.success('Purchase order reconciliation completed. The original signed PDF is retained.');
      onClose();
    } catch (problem) {
      const details = problem.response?.data;
      const message = details?.error || details?.detail || details?.vendor_id || details?.pr_id;
      setError(Array.isArray(message) ? message.join(' ') : typeof message === 'string' ? message : 'Reconciliation could not be completed. Review the supplier and recommendation links.');
    } finally { setReconciling(false); }
  };

  const content = (
    <div className={pageMode ? 'min-h-screen bg-slate-50' : 'fixed inset-0 z-[70] overflow-y-auto'}>
      <div className={pageMode ? 'px-2 py-3' : 'flex min-h-screen items-center justify-center px-4 py-8'}>
        {!pageMode && <button type="button" aria-label="Close signed PO import" className="fixed inset-0 bg-black/50" onClick={resetAndClose} />}
        <div role={pageMode ? 'region' : 'dialog'} aria-modal={pageMode ? undefined : true} aria-labelledby="signed-po-pdf-title" className={`relative w-full overflow-hidden rounded-2xl bg-white ${pageMode ? 'border border-slate-200' : 'max-w-7xl shadow-2xl'}`}>
          <div className="flex items-start justify-between bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4">
            <div>
              <h2 id="signed-po-pdf-title" className="text-lg font-bold text-white">{editMode ? 'Edit Signed Purchase Order PDF' : 'Signed Purchase Order PDF'}</h2>
            </div>
            <button type="button" aria-label="Close PDF dialog" onClick={resetAndClose} disabled={saving || reconciling} className="text-white hover:text-indigo-100">
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          <div className="max-h-[78vh] overflow-y-auto p-4 sm:p-6">
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
              <section aria-label="Signed PO document preview" className="min-w-0 overflow-hidden rounded-xl border border-gray-300 bg-gray-100">
                <div className="flex min-h-10 items-center gap-2 border-b border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700"><DocumentTextIcon className="h-4 w-4 flex-none" /><span className="truncate">{documentName || 'PDF preview'}</span></div>
                {previewUrl ? <div className="h-[64vh] min-h-[420px] w-full"><PdfDocumentPreview url={previewUrl} title="Signed purchase order PDF preview" /></div> : <div className="flex min-h-[320px] items-center justify-center p-6 text-sm text-gray-500">{loading ? 'Loading saved PDF...' : 'PDF preview unavailable.'}</div>}
              </section>
              <div className="min-w-0 space-y-4">
            {editMode && result && <section aria-label="Edit saved purchase order" className="space-y-4 rounded-xl border border-gray-200 p-4">
              {!canEditDocument && <p className="text-sm text-amber-800">This PDF is saved for review. A user with Purchase Orders update access must review the saved details before completing reconciliation.</p>}
              <fieldset disabled={!canEditDocument} className="space-y-4"><legend className="sr-only">Saved purchase order fields</legend>
              <h3 className="text-sm font-semibold text-gray-800">Purchase order details</h3>
              {originPendingReview && <p className="text-sm text-gray-600">Review the extracted details, then select Save PO to create the purchase order and attach it to this purchase recommendation.</p>}
              <label className="block text-xs font-semibold text-gray-700">Price basis
                <select aria-label="Price basis" value={documentEdits.vat_basis || 'unconfirmed'} onChange={event => updateDocumentField('vat_basis', event.target.value)} disabled={saving || reconciling} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm">
                  <option value="unconfirmed">Confirm VAT treatment</option>
                  {PROCUREMENT_VAT_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                {DOCUMENT_FIELDS.map(([field, label, type]) => {
                  const inputProps = {
                    'aria-label': label, 'aria-invalid': Boolean(fieldErrors[field]),
                    'aria-describedby': fieldErrors[field] ? `saved-po-${field}-error` : undefined,
                    value: documentEdits[field] ?? '', disabled: saving || reconciling,
                    ...(['tax_amount', 'gross_amount'].includes(field) ? { readOnly: true } : {}),
                    onChange: event => updateDocumentField(field, event.target.value),
                    className: `mt-1 w-full rounded-lg border px-3 py-2 text-sm font-normal ${fieldErrors[field] ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white'}`,
                  };
                  return <label key={field} className={`text-xs font-semibold text-gray-700${type === 'textarea' ? ' sm:col-span-2' : ''}`}>
                    {label}
                    {type === 'textarea' ? <textarea {...inputProps} rows={3} /> : type === 'currency' ? <select {...inputProps}><option value="">Select currency</option>{[...new Set(['AED', 'USD', 'EUR', 'GBP', documentEdits.currency].filter(Boolean))].map(currency => <option key={currency} value={currency}>{currency}</option>)}</select> : <input {...inputProps} type={type} step={type === 'number' ? '0.01' : undefined} min={type === 'number' ? '0' : undefined} />}
                    {fieldErrors[field] && <span id={`saved-po-${field}-error`} className="mt-1 block text-xs font-normal text-red-700">{fieldErrors[field]}</span>}
                  </label>;
                })}
              </div>
              <div className="border-t border-gray-200 pt-3">
                <div className="flex gap-2"><label className="min-w-0 flex-1 text-xs font-semibold text-gray-700">Search recommendations<input value={prSearch} disabled={Boolean(originatingRequisitionId) || saving || reconciling} onChange={event => setPrSearch(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); setPrQuery(prSearch.trim()); setPrReload(value => value + 1); } }} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-normal" /></label><button type="button" disabled={Boolean(originatingRequisitionId) || prLoading || saving || reconciling} onClick={() => { setPrQuery(prSearch.trim()); setPrReload(value => value + 1); }} className="self-end rounded-lg border border-blue-300 bg-white px-3 py-2 text-xs font-semibold text-blue-700">Search</button></div>
                <label className="mt-3 block text-xs font-semibold text-gray-700">Purchase recommendation<select aria-label="Purchase recommendation" aria-invalid={Boolean(fieldErrors.pr_id)} value={documentEdits.pr_id || ''} disabled={Boolean(originatingRequisitionId) || prLoading || saving || reconciling} onChange={event => updateDocumentField('pr_id', event.target.value)} className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm font-normal ${fieldErrors.pr_id ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white'}`}><option value="">Not linked</option>{documentEdits.pr_id && !prOptions.some(pr => String(pr.id) === String(documentEdits.pr_id)) && <option value={documentEdits.pr_id}>{documentEdits.pr_number || 'Current recommendation'}</option>}{prOptions.map(pr => <option key={pr.id} value={pr.id}>{pr.pr_number}{pr.product_service ? ` - ${pr.product_service}` : ''}</option>)}</select></label>
                {fieldErrors.pr_id && <p className="mt-1 text-xs text-red-700">{fieldErrors.pr_id}</p>}
                {prError && <p className="mt-2 text-xs text-red-700">{prError}</p>}
              </div>
              {canReconcile && !result.purchase_order_id && <div className="space-y-3 border-t border-gray-200 pt-3">
                <h4 className="text-sm font-semibold text-gray-800">{originPendingReview ? 'Supplier' : 'Match supplier'}</h4>
                {originPendingReview && <p className="text-xs text-gray-600">Save PO reuses the matching supplier or registers a missing supplier using the reviewed Supplier name and PDF details. You can select an existing supplier below instead.</p>}
                <label className="block text-xs font-semibold text-gray-700">Search supplier master<input value={supplierSearch} onChange={event => setSupplierSearch(event.target.value)} disabled={saving || reconciling} placeholder="Search supplier name or code" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-normal" /></label>
                <label className="block text-xs font-semibold text-gray-700">Matched supplier<select value={selectedVendorId} onChange={event => setSelectedVendorId(event.target.value)} disabled={supplierLoading || saving || reconciling} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-normal">
                  <option value="">{originPendingReview ? 'Match or register supplier from signed PO' : supplierLoading ? 'Loading suppliers...' : 'Select matching supplier'}</option>
                  {selectedVendorId && !supplierOptions.some(supplier => String(supplier.id) === selectedVendorId) && <option value={selectedVendorId}>{result.vendor_name || 'Current supplier selection'}</option>}
                  {supplierOptions.map(supplier => <option key={supplier.id} value={supplier.id}>{supplier.name}{supplier.vendor_code ? ` (${supplier.vendor_code})` : ''}</option>)}
                </select></label>
                {supplierError && <p role="alert" className="text-xs text-red-700">{supplierError} <button type="button" onClick={() => setSupplierReload(value => value + 1)} className="font-semibold underline">Retry suppliers</button></p>}
                <p className="text-xs text-gray-600">{originPendingReview ? 'Save PO saves the reviewed details, supplier and purchase order together, with the original signed PDF attached.' : 'Complete reconciliation saves these details and links the original signed PDF to the purchase order.'}</p>
              </div>}
              </fieldset>
            </section>}

            {error && (
              <div role="alert" className="flex flex-wrap gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <ExclamationTriangleIcon className="h-5 w-5 flex-none" /> <span className="min-w-0 flex-1">{error}</span>
                {!originPendingReview && <button type="button" disabled={loading} onClick={() => setReload(value => value + 1)} className="rounded border border-red-300 bg-white px-2 py-1 text-xs font-semibold">Retry</button>}
              </div>
            )}

            {result && (
              <>
                {(!editMode || changesSaved) && <div role="status" className="flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                  <CheckCircleIcon className="h-6 w-6 flex-none" />
                  <div>
                    <p className="font-semibold">{editMode && changesSaved ? 'Changes saved' : 'Signed PO PDF saved'}{result.po_number ? `: ${result.po_number}` : ''}.</p>
                    <p className="mt-1">{reconciliationPending ? 'Reconciliation pending. The uploaded document is retained.' : 'The PDF is attached to the purchase order.'}</p>
                  </div>
                </div>}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-gray-200 p-4">
                    <p className="text-xs text-gray-500">Linked purchase recommendation</p>
                    <p className={`mt-1 flex items-center gap-1.5 text-sm font-semibold ${result.pr_id ? 'text-emerald-800' : 'text-red-700'}`}><LinkIcon className="h-4 w-4" /> {result.pr_id ? result.pr_number || 'Linked recommendation' : 'Not linked'}</p>
                  </div>
                  <div className="rounded-xl border border-gray-200 p-4">
                    <p className="text-xs text-gray-500">Linked supplier</p>
                    <p className={`mt-1 text-sm font-semibold ${result.vendor_id ? 'text-gray-800' : 'text-amber-800'}`}>{result.vendor_id ? result.vendor_name || 'Linked supplier' : result.vendor_name ? `${result.vendor_name} (not linked)` : 'Not linked'}</p>
                  </div>
                </div>
                <IssueList title="Reconciliation pending" items={reconciliationIssues} />
                <IssueList title="Extraction or mapping issues" items={result.mapping_issues} />
                <IssueList title="Workflow issues requiring review" items={result.workflow_issues} tone="red" />
              </>
            )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-2 border-t border-gray-200 bg-gray-50 px-6 py-4">
            <button type="button" onClick={resetAndClose} disabled={saving || reconciling} className="h-9 rounded-lg border border-gray-300 bg-white px-4 text-xs font-semibold text-gray-700">Close</button>
            {editMode && result && !originPendingReview && <button type="button" onClick={saveDocument} disabled={!canEditDocument || saving || loading || reconciling} className="h-9 rounded-lg bg-blue-600 px-4 text-xs font-semibold text-white disabled:opacity-50">{saving ? 'Saving...' : 'Save changes'}</button>}
            {originPendingReview && <button type="button" onClick={savePurchaseOrder} disabled={!canReconcile || !canEditDocument || saving || loading || reconciling} className="h-9 rounded-lg bg-emerald-600 px-4 text-xs font-semibold text-white disabled:opacity-50">{reconciling ? 'Saving PO...' : 'Save PO'}</button>}
            {editMode && result && !originPendingReview && canReconcile && !result.purchase_order_id && <button type="button" onClick={completeReconciliation} disabled={saving || loading || reconciling || supplierLoading} className="h-9 rounded-lg bg-emerald-600 px-4 text-xs font-semibold text-white disabled:opacity-50">{reconciling ? 'Completing...' : 'Complete reconciliation'}</button>}
          </div>
        </div>
      </div>
    </div>
  );
  return pageMode ? content : createPortal(content, document.body);
};

SavedPurchaseOrderPdfImport.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onImported: PropTypes.func,
  documentId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  editMode: PropTypes.bool,
  pageMode: PropTypes.bool,
  canReconcile: PropTypes.bool,
  canEditDocument: PropTypes.bool,
  requisitionId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};

const PurchaseOrderPdfImport = ({ documentId = null, canImportRequisition = false, canUploadPurchaseOrder = true, ...props }) => {
  if (documentId) return <SavedPurchaseOrderPdfImport {...props} documentId={documentId} />;
  const imported = data => {
    const order = data?.purchase_order;
    props.onImported?.(order ? {
      ...order,
      purchase_order_id: data.purchase_order_id || order.purchase_order_id,
      pr_id: order.pr_id || data.pr_id || data.requisition_id,
      po_link: data.po_link || order.po_link,
    } : data);
  };
  return <PurchaseRequisitionPdfImport isOpen={props.isOpen} onClose={props.onClose} onImported={imported}
    primaryDocument="po" requisitionId={props.requisitionId} canImportRequisition={canImportRequisition}
    canLinkPurchaseOrder={props.canEditDocument ?? true} canUploadPurchaseOrder={canUploadPurchaseOrder} />;
};

PurchaseOrderPdfImport.propTypes = {
  ...SavedPurchaseOrderPdfImport.propTypes,
  canImportRequisition: PropTypes.bool,
  canUploadPurchaseOrder: PropTypes.bool,
};

export default PurchaseOrderPdfImport;
