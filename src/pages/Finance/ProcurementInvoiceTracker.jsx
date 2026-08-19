import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  ArrowUpTrayIcon,
  BanknotesIcon,
  CheckCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  DocumentMagnifyingGlassIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  EyeIcon,
  LinkIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  ShieldCheckIcon,
  TrashIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import financeService from '../../services/finance.service';

const PAGE_SIZE = 15;
const CURRENCIES = ['AED', 'USD', 'EUR', 'GBP', 'SAR', 'QAR', 'OMR', 'KWD', 'BHD'];

const LABELS = {
  ocr_review: 'OCR Review',
  ready_for_matching: 'Ready for Matching',
  procurement_review: 'Procurement Review',
  finance_review: 'Finance Review',
  approved_for_payment: 'Approved for Payment',
  rejected: 'Rejected',
  closed: 'Closed',
  unmatched: 'Unmatched',
  auto_matched: 'Auto Matched',
  manual_matched: 'Manually Matched',
  exception: 'Exception',
  verified: 'Verified',
  not_scheduled: 'Not Scheduled',
  scheduled: 'Scheduled',
  partial: 'Partially Paid',
  paid: 'Paid',
  on_hold: 'On Hold',
  cancelled: 'Cancelled',
};

const statusTone = (value) => {
  if (['verified', 'manual_matched', 'auto_matched', 'approved_for_payment', 'paid', 'closed'].includes(value)) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }
  if (['exception', 'rejected', 'on_hold'].includes(value)) {
    return 'border-rose-200 bg-rose-50 text-rose-700';
  }
  if (['procurement_review', 'finance_review', 'partial', 'scheduled'].includes(value)) {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }
  return 'border-slate-200 bg-slate-50 text-slate-700';
};

const StatusBadge = ({ value }) => (
  <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusTone(value)}`}>
    {LABELS[value] || String(value || '—').replaceAll('_', ' ')}
  </span>
);

const money = (value, currency = 'AED') => {
  if (value === null || value === undefined || value === '') return '—';
  try {
    return new Intl.NumberFormat('en-AE', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(value));
  } catch {
    return `${currency} ${Number(value).toFixed(2)}`;
  }
};

const dateLabel = (value) => {
  if (!value) return '—';
  const [year, month, day] = String(value).slice(0, 10).split('-');
  return year && month && day ? `${day}/${month}/${year}` : value;
};

const messageFromError = (error) => {
  const data = error?.response?.data;
  if (!data) return error?.code === 'ECONNABORTED' ? 'OCR timed out. Try again with a clearer PDF.' : error?.message || 'Request failed.';
  if (typeof data === 'string') return data;
  if (data.detail || data.error) return data.detail || data.error;
  return Object.entries(data)
    .map(([field, messages]) => `${field.replaceAll('_', ' ')}: ${Array.isArray(messages) ? messages.join(' ') : messages}`)
    .join(' ');
};

const Field = ({ label, required, className = '', children }) => (
  <label className={`block ${className}`}>
    <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
      {label}{required && <span className="ml-1 text-rose-500">*</span>}
    </span>
    {children}
  </label>
);

const inputClass = 'h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100';

const newLine = (number) => ({
  line_number: number,
  description: '',
  quantity: '',
  unit_price: '',
  net_amount: '',
  tax_rate: '',
  tax_amount: '',
  total_amount: '',
  currency: 'AED',
  po_item_reference: '',
  ocr_confidence: '',
});

const InvoiceImportModal = ({ open, onClose, onRecorded }) => {
  const fileInput = useRef(null);
  const [file, setFile] = useState(null);
  const [pdfUrl, setPdfUrl] = useState('');
  const [preview, setPreview] = useState(null);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const reset = useCallback(() => {
    setFile(null);
    setPreview(null);
    setForm(null);
    setBusy(false);
    setError('');
    setResult(null);
  }, []);

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  useEffect(() => {
    if (!file) {
      setPdfUrl('');
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setPdfUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  if (!open) return null;

  const selectFile = (selected) => {
    setError('');
    setPreview(null);
    setForm(null);
    setResult(null);
    if (!selected) return setFile(null);
    if (selected.type !== 'application/pdf' && !selected.name.toLowerCase().endsWith('.pdf')) {
      setFile(null);
      return setError('Select a PDF invoice document.');
    }
    if (selected.size > 20 * 1024 * 1024) {
      setFile(null);
      return setError('PDF exceeds the 20 MB limit.');
    }
    setFile(selected);
  };

  const runPreview = async () => {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const data = await financeService.previewProcurementInvoice(file);
      const extracted = data.extracted || {};
      setPreview(data);
      setForm({
        ...extracted,
        vendor_id: '',
        received_date: new Date().toISOString().slice(0, 10),
        confirmed_po_id: '',
        confirm_po_match: false,
        line_items: extracted.line_items?.length ? extracted.line_items : [],
        ocr_confidence: data.ocr_confidence,
      });
    } catch (requestError) {
      setError(messageFromError(requestError));
    } finally {
      setBusy(false);
    }
  };

  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const updateLine = (index, field, value) => setForm((current) => ({
    ...current,
    line_items: current.line_items.map((line, lineIndex) => lineIndex === index ? { ...line, [field]: value } : line),
  }));
  const removeLine = (index) => setForm((current) => ({
    ...current,
    line_items: current.line_items
      .filter((_, lineIndex) => lineIndex !== index)
      .map((line, lineIndex) => ({ ...line, line_number: lineIndex + 1 })),
  }));

  const selectedPo = preview?.purchase_order_options?.find((po) => po.id === form?.confirmed_po_id);
  const selectedVendor = preview?.vendor_options?.find((vendor) => vendor.id === form?.vendor_id);

  const saveReviewed = async () => {
    if (!form.invoice_number || !form.vendor_id || !form.vendor_name || !form.invoice_date || !form.total_amount || !form.currency) {
      return setError('Complete all required invoice and company-vendor fields before saving.');
    }
    if (form.confirmed_po_id && !form.confirm_po_match) {
      return setError('Confirm the PO match checkbox or clear the selected PO.');
    }
    setBusy(true);
    setError('');
    try {
      const response = await financeService.importReviewedProcurementInvoice(
        file,
        {
          ...form,
          vendor_name: selectedVendor?.name || form.vendor_name,
          extracted_text: preview.extracted_text,
          field_confidence: preview.field_confidence,
        },
        preview.source_file_sha256,
      );
      setResult(response);
      toast.success(response.message || `Successfully recorded ${form.invoice_number}!`);
      onRecorded?.(response.invoice);
    } catch (requestError) {
      setError(messageFromError(requestError));
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    if (!busy) onClose();
  };

  const allocation = result?.invoice?.po_allocations?.[0];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/65 backdrop-blur-sm">
      <div className="flex min-h-screen items-start justify-center p-3 lg:p-6">
        <div className="w-full max-w-[1500px] overflow-hidden rounded-2xl bg-white shadow-2xl">
          <header className="flex items-center justify-between bg-gradient-to-r from-indigo-700 via-violet-700 to-purple-700 px-5 py-4 text-white">
            <div className="flex items-center gap-3">
              <DocumentMagnifyingGlassIcon className="h-7 w-7" />
              <div>
                <h2 className="font-bold">Import Procurement Invoice PDF</h2>
                <p className="text-xs text-indigo-100">OCR preview → manual validation → company master match → controlled database record</p>
              </div>
            </div>
            <button type="button" onClick={close} disabled={busy} className="rounded-lg p-1.5 hover:bg-white/10 disabled:opacity-50">
              <XMarkIcon className="h-6 w-6" />
            </button>
          </header>

          {!preview && !result && (
            <div className="grid min-h-[620px] gap-6 p-6 lg:grid-cols-2">
              <div className="flex flex-col justify-center">
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  className="rounded-2xl border-2 border-dashed border-indigo-300 bg-indigo-50/60 px-6 py-14 text-center transition hover:border-indigo-500 hover:bg-indigo-50"
                >
                  <ArrowUpTrayIcon className="mx-auto h-11 w-11 text-indigo-600" />
                  <p className="mt-4 font-semibold text-slate-800">{file?.name || 'Choose or drop a supplier invoice PDF'}</p>
                  <p className="mt-1 text-xs text-slate-500">Maximum 20 MB. Scanned and text PDFs are supported.</p>
                </button>
                <input ref={fileInput} type="file" accept=".pdf,application/pdf" className="hidden" onChange={(event) => selectFile(event.target.files?.[0])} />
                {error && <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
                <button
                  type="button"
                  onClick={runPreview}
                  disabled={!file || busy}
                  className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {busy ? <ArrowPathIcon className="h-5 w-5 animate-spin" /> : <DocumentMagnifyingGlassIcon className="h-5 w-5" />}
                  {busy ? 'Reading invoice with OCR…' : 'Capture and Review'}
                </button>
              </div>
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                {pdfUrl ? <iframe title="Selected invoice PDF" src={pdfUrl} className="h-full min-h-[570px] w-full" /> : (
                  <div className="flex h-full min-h-[570px] items-center justify-center text-center text-slate-400">
                    <div><DocumentTextIcon className="mx-auto h-16 w-16" /><p className="mt-3 text-sm">The selected PDF appears here before OCR.</p></div>
                  </div>
                )}
              </div>
            </div>
          )}

          {preview && form && !result && (
            <div className="grid max-h-[82vh] lg:grid-cols-[minmax(420px,0.9fr)_minmax(620px,1.1fr)]">
              <div className="border-r border-slate-200 bg-slate-100 p-3">
                <iframe title="Invoice PDF review" src={pdfUrl} className="h-[77vh] w-full rounded-xl bg-white shadow-sm" />
              </div>
              <div className="h-[82vh] overflow-y-auto p-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-slate-900">Review captured fields</h3>
                    <p className="text-xs text-slate-500">OCR confidence: {preview.ocr_confidence}% · all fields remain editable</p>
                  </div>
                  <button type="button" onClick={() => { setPreview(null); setForm(null); }} className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-700">
                    <ArrowLeftIcon className="h-4 w-4" /> Change PDF
                  </button>
                </div>

                {preview.warnings?.length > 0 && (
                  <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                    <p className="flex items-center gap-2 font-semibold"><ExclamationTriangleIcon className="h-5 w-5" /> OCR review required</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">{preview.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
                  </div>
                )}

                <section className="space-y-4 rounded-xl border border-slate-200 p-4">
                  <h4 className="font-semibold text-slate-800">Invoice identity</h4>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Invoice number" required><input className={inputClass} value={form.invoice_number || ''} onChange={(e) => update('invoice_number', e.target.value)} /></Field>
                    <Field label="Invoice date" required><input type="date" className={inputClass} value={form.invoice_date || ''} onChange={(e) => update('invoice_date', e.target.value)} /></Field>
                    <Field label="Received date"><input type="date" className={inputClass} value={form.received_date || ''} onChange={(e) => update('received_date', e.target.value)} /></Field>
                    <Field label="Due date"><input type="date" className={inputClass} value={form.due_date || ''} onChange={(e) => update('due_date', e.target.value)} /></Field>
                    <Field label="OCR vendor text" required className="sm:col-span-2"><input className={inputClass} value={form.vendor_name || ''} onChange={(e) => update('vendor_name', e.target.value)} /></Field>
                    <Field label="Company vendor master" required className="sm:col-span-2">
                      <select className={inputClass} value={form.vendor_id || ''} onChange={(e) => {
                        const vendor = preview.vendor_options?.find((option) => option.id === e.target.value);
                        setForm((current) => ({ ...current, vendor_id: e.target.value, vendor_name: vendor?.name || current.vendor_name }));
                      }}>
                        <option value="">— Confirm an active company vendor —</option>
                        {(preview.vendor_options || []).map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.vendor_code} · {vendor.name}</option>)}
                      </select>
                      {preview.vendor_suggestions?.length > 0 && <p className="mt-1 text-[11px] text-indigo-600">Suggested: {preview.vendor_suggestions.map((item) => `${item.name} (${item.confidence}%)`).join(', ')}</p>}
                    </Field>
                    <Field label="Payment terms" className="sm:col-span-2"><input className={inputClass} value={form.payment_terms || ''} onChange={(e) => update('payment_terms', e.target.value)} /></Field>
                    <Field label="VAT registration / TRN"><input className={inputClass} value={form.vat_registration_number || ''} onChange={(e) => update('vat_registration_number', e.target.value)} /></Field>
                    <Field label="VAT %"><input type="number" min="0" max="100" step="0.01" className={inputClass} value={form.vat_percentage || ''} onChange={(e) => update('vat_percentage', e.target.value)} /></Field>
                  </div>
                </section>

                <section className="mt-4 space-y-4 rounded-xl border border-slate-200 p-4">
                  <h4 className="font-semibold text-slate-800">Amounts</h4>
                  <div className="grid gap-4 sm:grid-cols-4">
                    <Field label="Currency" required><select className={inputClass} value={form.currency || ''} onChange={(e) => update('currency', e.target.value)}><option value="">Select</option>{CURRENCIES.map((currency) => <option key={currency}>{currency}</option>)}</select></Field>
                    <Field label="Net amount"><input type="number" min="0" step="0.01" className={inputClass} value={form.amount || ''} onChange={(e) => update('amount', e.target.value)} /></Field>
                    <Field label="Tax amount"><input type="number" min="0" step="0.01" className={inputClass} value={form.tax_amount || ''} onChange={(e) => update('tax_amount', e.target.value)} /></Field>
                    <Field label="Invoice total" required><input type="number" min="0" step="0.01" className={inputClass} value={form.total_amount || ''} onChange={(e) => update('total_amount', e.target.value)} /></Field>
                  </div>
                </section>

                <section className="mt-4 space-y-4 rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between">
                    <div><h4 className="font-semibold text-slate-800">PO allocation</h4><p className="text-xs text-slate-500">RADAI never links an OCR suggestion automatically.</p></div>
                    <LinkIcon className="h-5 w-5 text-indigo-600" />
                  </div>
                  <Field label="Captured PO reference"><input className={inputClass} value={form.po_reference_text || ''} onChange={(e) => update('po_reference_text', e.target.value)} /></Field>
                  <Field label="Select PO (optional)">
                    <select className={inputClass} value={form.confirmed_po_id || ''} onChange={(e) => update('confirmed_po_id', e.target.value)}>
                      <option value="">— Save without a PO match —</option>
                      {(preview.purchase_order_options || []).map((po) => <option key={po.id} value={po.id}>{po.po_number} · {po.vendor_name} · {money(po.total_amount, po.currency)}</option>)}
                    </select>
                    {preview.purchase_order_suggestions?.length > 0 && <p className="mt-1 text-[11px] text-indigo-600">Top suggestion: {preview.purchase_order_suggestions[0].po_number} ({preview.purchase_order_suggestions[0].confidence}%)</p>}
                  </Field>
                  {selectedPo && (
                    <label className="flex items-start gap-3 rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-900">
                      <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-indigo-300 text-indigo-600" checked={Boolean(form.confirm_po_match)} onChange={(e) => update('confirm_po_match', e.target.checked)} />
                      <span><strong>I confirm this PO match.</strong><br /><span className="text-xs">{selectedPo.po_number} belongs to {selectedPo.vendor_name}. Vendor, currency, value tolerance, and receipt checks run when saved.</span></span>
                    </label>
                  )}
                </section>

                <section className="mt-4 rounded-xl border border-slate-200 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div><h4 className="font-semibold text-slate-800">Invoice lines</h4><p className="text-xs text-slate-500">Add or correct lines when OCR table detection is incomplete.</p></div>
                    <button type="button" onClick={() => setForm((current) => ({ ...current, line_items: [...current.line_items, newLine(current.line_items.length + 1)] }))} className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 px-2.5 py-1.5 text-xs font-semibold text-indigo-700"><PlusIcon className="h-4 w-4" /> Add line</button>
                  </div>
                  <div className="space-y-3">
                    {form.line_items.length === 0 && <p className="rounded-lg bg-slate-50 p-4 text-center text-xs text-slate-500">No lines confidently detected. You may add them manually or save the verified invoice header.</p>}
                    {form.line_items.map((line, index) => (
                      <div key={`${line.line_number}-${index}`} className="grid gap-2 rounded-lg bg-slate-50 p-3 sm:grid-cols-[1fr_90px_120px_120px_36px]">
                        <input aria-label={`Line ${index + 1} description`} placeholder="Description" className={inputClass} value={line.description || ''} onChange={(e) => updateLine(index, 'description', e.target.value)} />
                        <input aria-label={`Line ${index + 1} quantity`} placeholder="Qty" type="number" min="0" step="0.0001" className={inputClass} value={line.quantity || ''} onChange={(e) => updateLine(index, 'quantity', e.target.value)} />
                        <input aria-label={`Line ${index + 1} unit price`} placeholder="Unit price" type="number" min="0" step="0.01" className={inputClass} value={line.unit_price || ''} onChange={(e) => updateLine(index, 'unit_price', e.target.value)} />
                        <input aria-label={`Line ${index + 1} total`} placeholder="Total" type="number" min="0" step="0.01" className={inputClass} value={line.total_amount || ''} onChange={(e) => updateLine(index, 'total_amount', e.target.value)} />
                        <button type="button" onClick={() => removeLine(index)} className="rounded-lg text-rose-600 hover:bg-rose-100" title="Remove line"><TrashIcon className="mx-auto h-4 w-4" /></button>
                      </div>
                    ))}
                  </div>
                </section>

                {error && <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
                <div className="sticky bottom-0 mt-5 flex justify-end gap-2 border-t border-slate-200 bg-white/95 py-4 backdrop-blur">
                  <button type="button" onClick={close} disabled={busy} className="h-10 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700">Cancel</button>
                  <button type="button" onClick={saveReviewed} disabled={busy} className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-600 px-5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                    {busy ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : <ShieldCheckIcon className="h-4 w-4" />}
                    {busy ? 'Recording…' : 'Validate and Record'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {result && (
            <div className="grid min-h-[620px] gap-5 p-6 lg:grid-cols-2">
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100"><iframe title="Recorded invoice PDF" src={pdfUrl} className="h-full min-h-[570px] w-full" /></div>
              <div className="flex flex-col justify-center">
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
                  <CheckCircleIcon className="h-10 w-10 text-emerald-600" />
                  <h3 className="mt-3 text-xl font-bold text-emerald-900">{result.message}</h3>
                  <p className="mt-1 text-sm text-emerald-700">The PDF, reviewed fields, structured lines, and audit entry are stored in the company database.</p>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 p-4"><p className="text-xs text-slate-500">Procurement status</p><div className="mt-2"><StatusBadge value={result.invoice.procurement_status} /></div></div>
                  <div className="rounded-xl border border-slate-200 p-4"><p className="text-xs text-slate-500">PO match status</p><div className="mt-2"><StatusBadge value={result.invoice.match_status} /></div></div>
                </div>
                {allocation?.exception_codes?.length > 0 && (
                  <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-800">
                    <p className="font-semibold">Review required before payment</p>
                    <ul className="mt-2 list-disc pl-5 text-sm">{allocation.exception_codes.map((code) => <li key={code}>{code.replaceAll('_', ' ')}</li>)}</ul>
                  </div>
                )}
                {allocation && !allocation.exception_codes?.length && <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">Vendor, currency, amount tolerance, and accepted receipt evidence passed.</div>}
                <button type="button" onClick={close} className="mt-6 h-11 rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white hover:bg-indigo-700">Close and View Invoice List</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const InvoiceDetailModal = ({ invoice, onClose }) => {
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    financeService.getInvoice(invoice.id).then((data) => active && setDetail(data)).catch((err) => active && setError(messageFromError(err)));
    return () => { active = false; };
  }, [invoice.id]);
  const data = detail || invoice;
  const allocation = data.po_allocations?.[0];
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/65 p-4 backdrop-blur-sm">
      <div className="mx-auto max-w-6xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><div><h2 className="font-bold text-slate-900">{data.invoice_number}</h2><p className="text-xs text-slate-500">{data.tracking_id}</p></div><button onClick={onClose}><XMarkIcon className="h-6 w-6" /></button></header>
        {error ? <div className="m-5 rounded-xl bg-rose-50 p-4 text-rose-700">{error}</div> : (
          <div className="grid gap-5 p-5 lg:grid-cols-2">
            <iframe title={`Invoice ${data.invoice_number}`} src={financeService.getInvoicePreviewUrl(data.id)} className="h-[650px] w-full rounded-xl border border-slate-200 bg-slate-100" />
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {[
                  ['Vendor', data.vendor_master_name || data.vendor_name], ['Invoice date', dateLabel(data.invoice_date)],
                  ['PO reference', allocation?.purchase_order_number || data.po_reference_text || 'Unmatched'], ['Total', money(data.total_amount, data.currency)],
                  ['Procurement', <StatusBadge key="procurement-status" value={data.procurement_status} />], ['Match', <StatusBadge key="match-status" value={data.match_status} />],
                ].map(([label, value]) => <div key={label} className="rounded-xl border border-slate-200 p-3"><p className="text-[11px] uppercase text-slate-500">{label}</p><div className="mt-1 text-sm font-semibold text-slate-800">{value}</div></div>)}
              </div>
              {allocation?.exception_codes?.length > 0 && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"><p className="font-semibold">Matching exceptions</p><ul className="mt-2 list-disc pl-5">{allocation.exception_codes.map((code) => <li key={code}>{code.replaceAll('_', ' ')}</li>)}</ul></div>}
              <div className="rounded-xl border border-slate-200"><div className="border-b border-slate-200 px-4 py-3 font-semibold text-slate-800">Structured invoice lines</div><div className="max-h-72 overflow-auto">
                {(data.structured_line_items || []).length ? <table className="w-full text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-3 py-2 text-left">#</th><th className="px-3 py-2 text-left">Description</th><th className="px-3 py-2 text-right">Qty</th><th className="px-3 py-2 text-right">Total</th></tr></thead><tbody>{data.structured_line_items.map((line) => <tr key={line.id} className="border-t border-slate-100"><td className="px-3 py-2">{line.line_number}</td><td className="px-3 py-2">{line.description || '—'}</td><td className="px-3 py-2 text-right">{line.quantity || '—'}</td><td className="px-3 py-2 text-right">{money(line.total_amount, line.currency || data.currency)}</td></tr>)}</tbody></table> : <p className="p-4 text-sm text-slate-500">No structured lines recorded.</p>}
              </div></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

StatusBadge.propTypes = { value: PropTypes.string };
Field.propTypes = {
  label: PropTypes.string.isRequired,
  required: PropTypes.bool,
  className: PropTypes.string,
  children: PropTypes.node.isRequired,
};
InvoiceImportModal.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onRecorded: PropTypes.func,
};
InvoiceDetailModal.propTypes = {
  invoice: PropTypes.shape({ id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired }).isRequired,
  onClose: PropTypes.func.isRequired,
};

const ProcurementInvoiceTracker = () => {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [matchFilter, setMatchFilter] = useState('');
  const [page, setPage] = useState(1);
  const [importOpen, setImportOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await financeService.getInvoices();
      setInvoices(Array.isArray(data) ? data : data.results || []);
    } catch (requestError) {
      setError(messageFromError(requestError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => invoices.filter((invoice) => {
    const query = search.trim().toLowerCase();
    const matchesText = !query || [invoice.invoice_number, invoice.vendor_name, invoice.vendor_master_name, invoice.po_reference_text, invoice.tracking_id].some((value) => String(value || '').toLowerCase().includes(query));
    return matchesText && (!matchFilter || invoice.match_status === matchFilter);
  }), [invoices, search, matchFilter]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  useEffect(() => { setPage(1); }, [search, matchFilter]);
  useEffect(() => { if (page > pages) setPage(pages); }, [page, pages]);

  const stats = useMemo(() => ({
    total: invoices.length,
    review: invoices.filter((invoice) => ['ocr_review', 'procurement_review', 'finance_review'].includes(invoice.procurement_status)).length,
    exceptions: invoices.filter((invoice) => invoice.match_status === 'exception').length,
    ready: invoices.filter((invoice) => ['manual_matched', 'verified'].includes(invoice.match_status)).length,
  }), [invoices]);

  return (
    <div className="min-h-screen bg-slate-50 p-4 lg:p-7">
      <div className="mx-auto max-w-[1600px]">
        <div className="relative overflow-hidden rounded-2xl border border-blue-500/30 bg-gradient-to-br from-indigo-700 via-blue-600 to-cyan-500 p-6 text-white shadow-xl shadow-blue-950/10">
          <div className="pointer-events-none absolute inset-0"><div className="absolute -left-24 -top-32 h-72 w-72 rounded-full bg-white/20 blur-3xl" /><div className="absolute -right-20 top-4 h-64 w-64 rounded-full bg-cyan-100/25 blur-3xl" /></div>
          <div className="relative flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
            <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-100">Finance + Procurement · Accounts Payable</p><h1 className="mt-2 text-3xl font-extrabold">Procurement Invoice Tracker</h1><p className="mt-2 max-w-2xl text-sm text-white/85">Capture signed vendor invoices, validate OCR against company master data, and reconcile PO and receipt evidence before payment.</p></div>
            <button onClick={() => setImportOpen(true)} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-bold text-indigo-800 shadow-lg hover:bg-indigo-50"><ArrowUpTrayIcon className="h-5 w-5" /> Import Invoice PDF</button>
          </div>
          <div className="relative mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[[BanknotesIcon, 'Total invoices', stats.total], [DocumentMagnifyingGlassIcon, 'In review', stats.review], [ExclamationTriangleIcon, 'Match exceptions', stats.exceptions], [CheckCircleIcon, 'Matched / verified', stats.ready]].map(([Icon, label, value]) => <div key={label} className="rounded-xl border border-white/15 bg-white/10 p-4 shadow-sm backdrop-blur"><Icon className="h-5 w-5 text-cyan-100" /><p className="mt-2 text-2xl font-bold">{value}</p><p className="text-xs text-white/75">{label}</p></div>)}
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center">
          <div className="relative flex-1"><MagnifyingGlassIcon className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search invoice, vendor, PO, or tracking ID" className={`${inputClass} pl-10`} /></div>
          <select value={matchFilter} onChange={(e) => setMatchFilter(e.target.value)} className={`${inputClass} sm:w-52`}><option value="">All match statuses</option><option value="unmatched">Unmatched</option><option value="manual_matched">Manually matched</option><option value="exception">Exception</option><option value="verified">Verified</option></select>
          <button onClick={load} disabled={loading} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700"><ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh</button>
        </div>

        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {error && <div className="m-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">Failed to load procurement invoices: {error}</div>}
          {loading ? <div className="flex h-64 items-center justify-center gap-2 text-sm text-slate-500"><ArrowPathIcon className="h-5 w-5 animate-spin" /> Loading invoices…</div> : visible.length === 0 ? <div className="flex h-64 flex-col items-center justify-center text-slate-500"><DocumentTextIcon className="h-12 w-12 text-slate-300" /><p className="mt-3 font-semibold">No procurement invoices found</p><button onClick={() => setImportOpen(true)} className="mt-3 text-sm font-semibold text-indigo-600">Import the first invoice PDF</button></div> : (
            <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3 text-left">Invoice</th><th className="px-4 py-3 text-left">Vendor</th><th className="px-4 py-3 text-left">PO reference</th><th className="px-4 py-3 text-left">Invoice date</th><th className="px-4 py-3 text-right">Total</th><th className="px-4 py-3 text-left">Procurement</th><th className="px-4 py-3 text-left">Matching</th><th className="px-4 py-3 text-left">Payment</th><th className="px-4 py-3 text-right">View</th></tr></thead><tbody className="divide-y divide-slate-100">{visible.map((invoice) => <tr key={invoice.id} className="cursor-pointer hover:bg-indigo-50/30" onDoubleClick={() => navigate(`/finance/incoming-invoices/${invoice.id}`)}><td className="px-4 py-3"><p className="font-semibold text-slate-900">{invoice.invoice_number}</p><p className="text-[11px] text-slate-400">{invoice.tracking_id}</p></td><td className="max-w-[260px] px-4 py-3"><p className="truncate font-medium text-slate-800">{invoice.vendor_master_name || invoice.vendor_name || '—'}</p></td><td className="px-4 py-3 font-mono text-xs text-slate-600">{invoice.po_reference_text || '—'}</td><td className="px-4 py-3 text-slate-600">{dateLabel(invoice.invoice_date)}</td><td className="px-4 py-3 text-right font-semibold text-slate-800">{money(invoice.total_amount, invoice.currency)}</td><td className="px-4 py-3"><StatusBadge value={invoice.procurement_status} /></td><td className="px-4 py-3"><StatusBadge value={invoice.match_status} /></td><td className="px-4 py-3"><StatusBadge value={invoice.payment_status} /></td><td className="px-4 py-3 text-right"><button onClick={() => navigate(`/finance/incoming-invoices/${invoice.id}`)} className="rounded-lg p-2 text-indigo-600 hover:bg-indigo-100" title="Open complete invoice register detail"><EyeIcon className="h-5 w-5" /></button></td></tr>)}</tbody></table></div>
          )}
          <footer className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500"><span>Showing {visible.length ? (page - 1) * PAGE_SIZE + 1 : 0}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}</span><div className="flex items-center gap-2"><button disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded-md border border-slate-300 bg-white p-1.5 disabled:opacity-40"><ChevronLeftIcon className="h-4 w-4" /></button><span>Page {page} of {pages}</span><button disabled={page >= pages} onClick={() => setPage((value) => value + 1)} className="rounded-md border border-slate-300 bg-white p-1.5 disabled:opacity-40"><ChevronRightIcon className="h-4 w-4" /></button></div></footer>
        </div>
      </div>
      <InvoiceImportModal open={importOpen} onClose={() => setImportOpen(false)} onRecorded={load} />
    </div>
  );
};

export default ProcurementInvoiceTracker;
