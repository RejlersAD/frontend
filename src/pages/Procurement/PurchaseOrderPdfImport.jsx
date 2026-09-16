import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
import { toast } from 'react-toastify';
import ProcurementApprovalEmployeeSearch from './ProcurementApprovalEmployeeSearch';

const emptyEvidence = () => ({ signatureVerified: false, stampVerified: false, approvedByName: '', approvedByTitle: '', approvedDate: '' });

const DOCUMENT_FIELDS = [
  ['po_number', 'PO number', 'text'], ['summary', 'Description', 'textarea'],
  ['vendor_name', 'Supplier name', 'text'], ['currency', 'Currency', 'currency'],
  ['total_amount', 'Net amount', 'number'], ['tax_amount', 'VAT amount', 'number'],
  ['gross_amount', 'Gross amount', 'number'], ['po_date', 'Order date', 'date'],
  ['expected_delivery', 'Expected delivery', 'date'],
];
const editableDocument = result => ({
  ...Object.fromEntries(DOCUMENT_FIELDS.map(([field]) => [field, result?.[field] == null ? '' : String(result[field])])),
  pr_id: result?.pr_id || '', pr_number: result?.pr_number || '',
});

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

const PurchaseOrderPdfImport = ({ isOpen, onClose, onImported, documentId = null, editMode = false, pageMode = false, canReconcile = false }) => {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
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
  const [evidence, setEvidence] = useState(emptyEvidence);
  const [approvalDetection, setApprovalDetection] = useState(null);
  const [approvalLoading, setApprovalLoading] = useState(false);
  const [approvalError, setApprovalError] = useState('');
  const [approvalReload, setApprovalReload] = useState(0);
  const [selectedFileVersion, setSelectedFileVersion] = useState(0);
  const approvalEditsRef = useRef({});
  const approvalRequestRef = useRef(0);

  useEffect(() => {
    if (!isOpen || documentId || !file || file.size > 15 * 1024 * 1024) return undefined;
    const controller = new AbortController();
    const requestVersion = ++approvalRequestRef.current;
    setApprovalLoading(true);
    setApprovalError('');
    const body = new FormData();
    body.append('file', file);
    apiClient.post('/procurement/po-documents/preview_signed_pdf/', body, {
      headers: { 'Content-Type': 'multipart/form-data' }, signal: controller.signal,
      timeout: 120000, suppressErrorToast: true,
    }).then(({ data }) => {
      if (controller.signal.aborted || requestVersion !== approvalRequestRef.current) return;
      const detected = data?.approval_evidence;
      if (!detected || typeof detected !== 'object') throw new Error('Approval details were not returned.');
      setApprovalDetection(detected);
      setEvidence(current => ({
        ...current,
        ...Object.fromEntries([
          ['approvedByName', detected.approved_by_name],
          ['approvedByTitle', detected.approved_by_title],
          ['approvedDate', detected.approved_date],
        ].filter(([field, value]) => !approvalEditsRef.current[field] && typeof value === 'string' && value.trim() !== '')),
      }));
    }).catch(problem => {
      if (controller.signal.aborted || requestVersion !== approvalRequestRef.current) return;
      const message = problem.response?.data?.error || problem.response?.data?.detail;
      setApprovalError(typeof message === 'string' ? message : 'Approval details could not be read. Search HR Master or enter them manually.');
    }).finally(() => {
      if (!controller.signal.aborted && requestVersion === approvalRequestRef.current) setApprovalLoading(false);
    });
    return () => controller.abort();
  }, [isOpen, documentId, file, approvalReload, selectedFileVersion]);

  const updateEvidence = changes => {
    Object.keys(changes).forEach(field => { approvalEditsRef.current[field] = true; });
    setEvidence(current => ({ ...current, ...changes }));
  };

  useEffect(() => {
    const source = file || savedPdf;
    if (!isOpen || !source) { setPreviewUrl(''); return undefined; }
    const url = window.URL.createObjectURL(source);
    setPreviewUrl(url);
    return () => window.URL.revokeObjectURL(url);
  }, [file, savedPdf, isOpen]);

  useEffect(() => {
    if (!isOpen || !documentId) return undefined;
    const controller = new AbortController();
    setLoading(true);
    setError('');
    setFile(null);
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
        setResult({ ...fields, document_id: saved.id, purchase_order_id: saved.confirmed_po || null, operation: 'saved' });
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
      setDocumentEdits(editableDocument(result));
      setFieldErrors({});
    }
  }, [documentId, result]);

  useEffect(() => {
    if (!isOpen || !documentId || !editMode) return undefined;
    const controller = new AbortController();
    setPrLoading(true);
    setPrError('');
    apiClient.get('/procurement/requisitions/', { params: { search: prQuery, page_size: 100 }, signal: controller.signal })
      .then(response => {
        if (controller.signal.aborted) return;
        const rows = Array.isArray(response.data) ? response.data : response.data?.results;
        if (!Array.isArray(rows)) throw new Error('Purchase recommendations could not be loaded.');
        setPrOptions(rows);
      })
      .catch(() => { if (!controller.signal.aborted) setPrError('Purchase recommendations could not be loaded. The current link is retained.'); })
      .finally(() => { if (!controller.signal.aborted) setPrLoading(false); });
    return () => controller.abort();
  }, [isOpen, documentId, editMode, prQuery, prReload]);

  useEffect(() => {
    if (!isOpen || !documentId || !editMode || !canReconcile) return undefined;
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
  }, [isOpen, documentId, editMode, canReconcile, supplierSearch, supplierReload]);

  if (!isOpen) return null;

  const reconciliationPending = Boolean(result && (result.reconciliation_required || !result.pr_id || !result.vendor_id));
  const reconciliationIssues = result?.reconciliation_issues?.length
    ? result.reconciliation_issues
    : reconciliationPending ? [
      !result.pr_id && 'Link the matching purchase recommendation when it is available.',
      !result.vendor_id && 'Match the supplier to a vendor record to complete the purchase order.',
    ].filter(Boolean) : [];

  const resetAndClose = () => {
    if (saving || reconciling || (loading && !documentId)) return;
    setLoading(false);
    setFile(null);
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
    approvalRequestRef.current += 1;
    approvalEditsRef.current = {};
    setApprovalLoading(false);
    setApprovalError('');
    setApprovalDetection(null);
    setEvidence(emptyEvidence());
    onClose();
  };

  const updateDocumentField = (field, value) => {
    setDocumentEdits(current => ({ ...current, [field]: value }));
    setFieldErrors(current => ({ ...current, [field]: '' }));
    setChangesSaved(false);
  };

  const saveDocument = async () => {
    if (!documentId || saving || loading) return;
    setSaving(true);
    setChangesSaved(false);
    setError('');
    setFieldErrors({});
    const payload = Object.fromEntries(DOCUMENT_FIELDS.map(([field, , type]) => [field, ['date', 'number'].includes(type) ? documentEdits[field] || null : documentEdits[field] ?? '']));
    payload.pr_id = documentEdits.pr_id || null;
    try {
      const response = await apiClient.patch(`/procurement/po-documents/${documentId}/`, payload, { suppressErrorToast: true });
      const saved = response.data;
      const fields = saved.extracted_data || saved;
      setResult(current => ({ ...current, ...fields, document_id: saved.id || documentId, purchase_order_id: saved.confirmed_po ?? current.purchase_order_id }));
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

  const completeReconciliation = async () => {
    if (!canReconcile || !documentId || loading || saving || reconciling) return;
    const vendorId = selectedVendorId;
    const prId = documentEdits.pr_id || result?.pr_id;
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

  const importPdf = async () => {
    if (loading || approvalLoading) return;
    if (!file) {
      setError('Select a signed Purchase Order PDF first.');
      return;
    }
    if (evidence.signatureVerified && (!evidence.approvedByName.trim() || !evidence.approvedDate)) {
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

  const content = (
    <div className={pageMode ? 'min-h-screen bg-slate-50' : 'fixed inset-0 z-[70] overflow-y-auto'}>
      <div className={pageMode ? 'px-2 py-3' : 'flex min-h-screen items-center justify-center px-4 py-8'}>
        {!pageMode && <button type="button" aria-label="Close signed PO import" className="fixed inset-0 bg-black/50" onClick={resetAndClose} />}
        <div role={pageMode ? 'region' : 'dialog'} aria-modal={pageMode ? undefined : true} aria-labelledby="signed-po-pdf-title" className={`relative w-full overflow-hidden rounded-2xl bg-white ${pageMode ? 'border border-slate-200' : 'max-w-7xl shadow-2xl'}`}>
          <div className="flex items-start justify-between bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4">
            <div>
              <h2 id="signed-po-pdf-title" className="text-lg font-bold text-white">{documentId ? editMode ? 'Edit Signed Purchase Order PDF' : 'Signed Purchase Order PDF' : 'Import Signed Purchase Order PDF'}</h2>
              {!documentId && <p className="mt-1 text-xs text-indigo-100">Upload the signed PDF now. Link any missing recommendation or supplier records later.</p>}
            </div>
            <button type="button" aria-label="Close PDF dialog" onClick={resetAndClose} disabled={saving || reconciling || (loading && !documentId)} className="text-white hover:text-indigo-100">
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          <div className="max-h-[78vh] overflow-y-auto p-4 sm:p-6">
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
              <section aria-label="Signed PO document preview" className="min-w-0 overflow-hidden rounded-xl border border-gray-300 bg-gray-100">
                <div className="flex min-h-10 items-center gap-2 border-b border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700"><DocumentTextIcon className="h-4 w-4 flex-none" /><span className="truncate">{file?.name || documentName || 'PDF preview'}</span></div>
                {previewUrl ? <iframe src={`${previewUrl}#toolbar=1&navpanes=0`} title="Signed purchase order PDF preview" className="h-[64vh] min-h-[420px] w-full" /> : <div className="flex min-h-[320px] items-center justify-center p-6 text-sm text-gray-500">{documentId ? loading ? 'Loading saved PDF...' : 'PDF preview unavailable.' : 'Choose a PDF to preview it here.'}</div>}
              </section>
              <div className="min-w-0 space-y-4">
            {!documentId && !result && <>
            <div className="rounded-xl border border-dashed border-indigo-300 bg-indigo-50/50 p-5">
              <input
                ref={inputRef}
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={(event) => {
                  const selected = event.target.files?.[0] || null;
                  approvalRequestRef.current += 1;
                  approvalEditsRef.current = {};
                  setEvidence(emptyEvidence());
                  setApprovalDetection(null);
                  setApprovalError('');
                  setApprovalLoading(Boolean(selected && selected.size <= 15 * 1024 * 1024));
                  setSelectedFileVersion(current => current + 1);
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
              {approvalLoading && <p role="status" className="mt-3 text-sm text-blue-700">Reading approval details from PDF…</p>}
              {approvalError && <div role="alert" className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{approvalError} <button type="button" disabled={loading || approvalLoading} onClick={() => setApprovalReload(current => current + 1)} className="font-medium underline">Retry approval detection</button></div>}
              {approvalDetection && <div className="mt-3 space-y-1 rounded-lg bg-blue-50 p-3 text-sm text-blue-900" aria-label="Detected approval evidence">
                <p>{approvalDetection.signature_detected ? `Signature candidate found${approvalDetection.page ? ` on page ${approvalDetection.page}` : ''}. Confirm it in the PDF.` : 'Signature not detected automatically. Check the PDF before confirming.'}</p>
                <p>{approvalDetection.stamp_detected ? `Company stamp candidate found${approvalDetection.page ? ` on page ${approvalDetection.page}` : ''}. Confirm it in the PDF.` : 'Company stamp not detected automatically. Check the PDF before confirming.'}</p>
                {Array.isArray(approvalDetection.issues) && approvalDetection.issues.map(issue => <p key={issue} className="text-xs">{issue}</p>)}
              </div>}
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={evidence.signatureVerified} disabled={loading} onChange={(event) => updateEvidence({ signatureVerified: event.target.checked })} className="h-4 w-4 rounded border-gray-300 text-indigo-600" />
                  Approval signature is visible
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={evidence.stampVerified} disabled={loading} onChange={(event) => updateEvidence({ stampVerified: event.target.checked })} className="h-4 w-4 rounded border-gray-300 text-indigo-600" />
                  Company stamp is visible
                </label>
                <ProcurementApprovalEmployeeSearch key={selectedFileVersion} value={evidence.approvedByName} disabled={loading}
                  onChange={(name, clearPosition) => updateEvidence({ approvedByName: name, ...(clearPosition ? { approvedByTitle: '' } : {}) })}
                  onSelect={employee => updateEvidence({ approvedByName: employee.name, approvedByTitle: employee.position || '' })} />
                <label className="text-xs font-semibold text-gray-600">
                  Approval date
                  <input type="date" value={evidence.approvedDate} disabled={loading} onChange={(event) => updateEvidence({ approvedDate: event.target.value })} className="mt-1 block h-10 w-full rounded-lg border border-gray-300 px-3 text-sm font-normal" />
                </label>
                <label className="text-xs font-semibold text-gray-600 sm:col-span-2">
                  Approver title
                  <input type="text" value={evidence.approvedByTitle} disabled={loading} onChange={(event) => updateEvidence({ approvedByTitle: event.target.value })} className="mt-1 block h-10 w-full rounded-lg border border-gray-300 px-3 text-sm font-normal" placeholder="Position or role" />
                </label>
              </div>
            </div>
            </>}

            {documentId && editMode && result && <section aria-label="Edit saved purchase order" className="space-y-4 rounded-xl border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-800">Purchase order details</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {DOCUMENT_FIELDS.map(([field, label, type]) => {
                  const inputProps = {
                    'aria-label': label, 'aria-invalid': Boolean(fieldErrors[field]),
                    'aria-describedby': fieldErrors[field] ? `saved-po-${field}-error` : undefined,
                    value: documentEdits[field] ?? '', disabled: saving || reconciling,
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
                <div className="flex gap-2"><label className="min-w-0 flex-1 text-xs font-semibold text-gray-700">Search recommendations<input value={prSearch} disabled={saving || reconciling} onChange={event => setPrSearch(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); setPrQuery(prSearch.trim()); setPrReload(value => value + 1); } }} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-normal" /></label><button type="button" disabled={prLoading || saving || reconciling} onClick={() => { setPrQuery(prSearch.trim()); setPrReload(value => value + 1); }} className="self-end rounded-lg border border-blue-300 bg-white px-3 py-2 text-xs font-semibold text-blue-700">Search</button></div>
                <label className="mt-3 block text-xs font-semibold text-gray-700">Purchase recommendation<select aria-label="Purchase recommendation" aria-invalid={Boolean(fieldErrors.pr_id)} value={documentEdits.pr_id || ''} disabled={prLoading || saving || reconciling} onChange={event => updateDocumentField('pr_id', event.target.value)} className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm font-normal ${fieldErrors.pr_id ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white'}`}><option value="">Not linked</option>{documentEdits.pr_id && !prOptions.some(pr => String(pr.id) === String(documentEdits.pr_id)) && <option value={documentEdits.pr_id}>{documentEdits.pr_number || 'Current recommendation'}</option>}{prOptions.map(pr => <option key={pr.id} value={pr.id}>{pr.pr_number}{pr.product_service ? ` - ${pr.product_service}` : ''}</option>)}</select></label>
                {fieldErrors.pr_id && <p className="mt-1 text-xs text-red-700">{fieldErrors.pr_id}</p>}
                {prError && <p className="mt-2 text-xs text-red-700">{prError}</p>}
              </div>
              {canReconcile && !result.purchase_order_id && <div className="space-y-3 border-t border-gray-200 pt-3">
                <h4 className="text-sm font-semibold text-gray-800">Match supplier</h4>
                <label className="block text-xs font-semibold text-gray-700">Search supplier master<input value={supplierSearch} onChange={event => setSupplierSearch(event.target.value)} disabled={saving || reconciling} placeholder="Search supplier name or code" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-normal" /></label>
                <label className="block text-xs font-semibold text-gray-700">Matched supplier<select value={selectedVendorId} onChange={event => setSelectedVendorId(event.target.value)} disabled={supplierLoading || saving || reconciling} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-normal">
                  <option value="">{supplierLoading ? 'Loading suppliers...' : 'Select matching supplier'}</option>
                  {selectedVendorId && !supplierOptions.some(supplier => String(supplier.id) === selectedVendorId) && <option value={selectedVendorId}>{result.vendor_name || 'Current supplier selection'}</option>}
                  {supplierOptions.map(supplier => <option key={supplier.id} value={supplier.id}>{supplier.name}{supplier.vendor_code ? ` (${supplier.vendor_code})` : ''}</option>)}
                </select></label>
                {supplierError && <p role="alert" className="text-xs text-red-700">{supplierError} <button type="button" onClick={() => setSupplierReload(value => value + 1)} className="font-semibold underline">Retry suppliers</button></p>}
                <p className="text-xs text-gray-600">Complete reconciliation saves these details and links the original signed PDF to the purchase order.</p>
              </div>}
            </section>}

            {error && (
              <div role="alert" className="flex flex-wrap gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <ExclamationTriangleIcon className="h-5 w-5 flex-none" /> <span className="min-w-0 flex-1">{error}</span>
                {documentId && <button type="button" disabled={loading} onClick={() => setReload(value => value + 1)} className="rounded border border-red-300 bg-white px-2 py-1 text-xs font-semibold">Retry</button>}
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
            <button type="button" onClick={resetAndClose} disabled={saving || reconciling || (loading && !documentId)} className="h-9 rounded-lg border border-gray-300 bg-white px-4 text-xs font-semibold text-gray-700">{result || documentId ? 'Close' : 'Cancel'}</button>
            {documentId && editMode && result && <button type="button" onClick={saveDocument} disabled={saving || loading || reconciling} className="h-9 rounded-lg bg-blue-600 px-4 text-xs font-semibold text-white disabled:opacity-50">{saving ? 'Saving...' : 'Save changes'}</button>}
            {documentId && editMode && result && canReconcile && !result.purchase_order_id && <button type="button" onClick={completeReconciliation} disabled={saving || loading || reconciling || supplierLoading} className="h-9 rounded-lg bg-emerald-600 px-4 text-xs font-semibold text-white disabled:opacity-50">{reconciling ? 'Completing...' : 'Complete reconciliation'}</button>}
            {!documentId && !result && (
              <button type="button" disabled={!file || file.size > 15 * 1024 * 1024 || loading || approvalLoading} onClick={importPdf} className="h-9 rounded-lg bg-emerald-600 px-4 text-xs font-semibold text-white disabled:opacity-50">
                {loading ? 'Uploading and extracting...' : 'Upload signed PDF'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
  return pageMode ? content : createPortal(content, document.body);
};

PurchaseOrderPdfImport.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onImported: PropTypes.func,
  documentId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  editMode: PropTypes.bool,
  pageMode: PropTypes.bool,
  canReconcile: PropTypes.bool,
};

export default PurchaseOrderPdfImport;
