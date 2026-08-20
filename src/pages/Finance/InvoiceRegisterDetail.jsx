import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowDownTrayIcon,
  ArrowLeftIcon,
  ArrowPathIcon,
  ArrowUpTrayIcon,
  BanknotesIcon,
  CheckCircleIcon,
  ClockIcon,
  DocumentTextIcon,
  LinkIcon,
  PaperClipIcon,
  ShieldCheckIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline';
import { toast } from 'react-toastify';
import financeService from '../../services/finance.service';
import invoiceTrackerService from '../../services/invoiceTracker.service';

const LABELS = {
  ocr_review: 'OCR Review', ready_for_matching: 'Ready for Matching', procurement_review: 'Procurement Review',
  finance_review: 'Finance Review', approved_for_payment: 'Approved for Payment', rejected: 'Rejected', closed: 'Closed',
  unmatched: 'Unmatched', auto_matched: 'Auto Matched', manual_matched: 'Manually Matched', exception: 'Exception', verified: 'Verified',
  not_scheduled: 'Not Scheduled', scheduled: 'Scheduled', partial: 'Partial', paid: 'Paid', on_hold: 'On Hold', cancelled: 'Cancelled',
  pending: 'Pending', overdue: 'Overdue', credit_note: 'Credit Note',
};

const tone = (value) => {
  if (['paid', 'verified', 'manual_matched', 'auto_matched', 'approved_for_payment', 'closed'].includes(value)) return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (['exception', 'rejected', 'overdue', 'on_hold'].includes(value)) return 'border-rose-200 bg-rose-50 text-rose-700';
  if (['pending', 'partial', 'scheduled', 'procurement_review', 'finance_review'].includes(value)) return 'border-amber-200 bg-amber-50 text-amber-700';
  return 'border-slate-200 bg-slate-50 text-slate-700';
};

const Badge = ({ value }) => <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${tone(value)}`}>{LABELS[value] || String(value || '—').replaceAll('_', ' ')}</span>;
Badge.propTypes = { value: PropTypes.string };

const money = (value, currency = 'AED') => {
  if (value === null || value === undefined || value === '') return '—';
  try { return new Intl.NumberFormat('en-AE', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(value)); }
  catch { return `${currency} ${Number(value).toLocaleString('en-AE')}`; }
};

const date = (value, withTime = false) => {
  if (!value) return '—';
  try { return new Date(value).toLocaleString('en-GB', withTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' }); }
  catch { return value; }
};

const errorText = (error) => {
  const data = error?.response?.data;
  if (typeof data?.detail === 'string') return data.detail;
  if (typeof data?.error === 'string') return data.error;
  if (data && typeof data === 'object') {
    const first = Object.values(data)[0];
    if (Array.isArray(first)) return first.join(' ');
    if (typeof first === 'string') return first;
  }
  return error?.message || 'The invoice could not be loaded.';
};

const Field = ({ label, value, mono = false, wide = false }) => (
  <div className={wide ? 'sm:col-span-2' : ''}>
    <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</dt>
    <dd className={`mt-1 break-words text-sm font-medium text-slate-800 ${mono ? 'font-mono' : ''}`}>{value === null || value === undefined || value === '' ? '—' : value}</dd>
  </div>
);
Field.propTypes = { label: PropTypes.string.isRequired, value: PropTypes.node, mono: PropTypes.bool, wide: PropTypes.bool };

const Section = ({ icon: Icon, title, children }) => (
  <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <header className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-4 py-3"><Icon className="h-5 w-5 text-indigo-600" /><h2 className="font-bold text-slate-800">{title}</h2></header>
    <div className="p-4">{children}</div>
  </section>
);
Section.propTypes = { icon: PropTypes.elementType.isRequired, title: PropTypes.string.isRequired, children: PropTypes.node.isRequired };

const FinancialCard = ({ label, value, emphasis }) => (
  <div className={`rounded-xl border p-4 ${emphasis ? 'border-indigo-200 bg-indigo-50' : 'border-slate-200 bg-white'}`}><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p><p className={`mt-1 text-xl font-black ${emphasis ? 'text-indigo-800' : 'text-slate-900'}`}>{value}</p></div>
);
FinancialCard.propTypes = { label: PropTypes.string.isRequired, value: PropTypes.string.isRequired, emphasis: PropTypes.bool };

const InvoicePdfPreview = ({ invoice }) => {
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewLoading, setPreviewLoading] = useState(true);
  const [previewError, setPreviewError] = useState('');
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let active = true;
    let objectUrl = '';
    setPreviewLoading(true);
    setPreviewError('');
    setPreviewUrl('');

    financeService.getInvoicePreviewBlob(invoice.id)
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setPreviewUrl(objectUrl);
      })
      .catch((requestError) => {
        if (!active) return;
        setPreviewError(requestError?.response?.status === 404
          ? 'The invoice record exists, but its original PDF is missing from document storage.'
          : 'The invoice PDF could not be loaded.');
      })
      .finally(() => { if (active) setPreviewLoading(false); });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [invoice.id, retryKey]);

  if (previewLoading) {
    return <div className="flex h-[720px] items-center justify-center gap-2 text-sm text-slate-500"><ArrowPathIcon className="h-5 w-5 animate-spin" /> Loading invoice PDF…</div>;
  }

  if (previewError) {
    return (
      <div className="flex h-[720px] flex-col items-center justify-center px-8 text-center">
        <span className="rounded-2xl bg-amber-100 p-4 text-amber-700"><DocumentTextIcon className="h-9 w-9" /></span>
        <h2 className="mt-4 text-lg font-bold text-slate-900">Original PDF unavailable</h2>
        <p className="mt-2 max-w-sm text-sm leading-6 text-slate-600">{previewError}</p>
        <p className="mt-1 max-w-sm text-xs text-slate-500">Ask a finance administrator to restore the source PDF in document storage.</p>
        <button type="button" onClick={() => setRetryKey((value) => value + 1)} className="mt-5 inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:border-indigo-300 hover:text-indigo-700"><ArrowPathIcon className="h-4 w-4" /> Retry preview</button>
      </div>
    );
  }

  return <iframe title={`Invoice ${invoice.invoice_number}`} src={previewUrl} className="h-[720px] w-full" />;
};
InvoicePdfPreview.propTypes = { invoice: PropTypes.object.isRequired };

const IncomingDetail = ({ invoice, onChanged = () => window.location.reload() }) => {
  const allocations = invoice.po_allocations || [];
  const [working, setWorking] = useState(false);
  const [operation, setOperation] = useState('schedule');
  const [amount, setAmount] = useState('');
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState('');
  const runMatch = async () => {
    setWorking(true);
    try { await financeService.runThreeWayMatch(invoice.id); toast.success('Three-way matching evidence refreshed.'); await onChanged(); }
    catch (error) { toast.error(errorText(error)); }
    finally { setWorking(false); }
  };
  const recordOperation = async () => {
    setWorking(true);
    try {
      await financeService.recordPayableOperation(invoice.id, {
        operation, amount: operation === 'payment' ? amount : undefined,
        effective_date: effectiveDate, reference,
      });
      toast.success('Payable operation recorded.');
      setAmount(''); setReference('');
      await onChanged();
    } catch (error) { toast.error(errorText(error)); }
    finally { setWorking(false); }
  };
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(420px,0.9fr)_minmax(600px,1.1fr)]">
      <div className="space-y-4">
        <div className="sticky top-4 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-sm">
          <InvoicePdfPreview invoice={invoice} />
        </div>
      </div>
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3"><FinancialCard label="Net amount" value={money(invoice.amount, invoice.currency)} /><FinancialCard label="Tax" value={money(invoice.tax_amount, invoice.currency)} /><FinancialCard label="Invoice total" value={money(invoice.total_amount, invoice.currency)} emphasis /></div>
        <Section icon={DocumentTextIcon} title="Invoice information"><dl className="grid gap-4 sm:grid-cols-2"><Field label="Vendor master" value={invoice.vendor_master_name || invoice.vendor_name} /><Field label="Captured vendor" value={invoice.vendor_name} /><Field label="Invoice date" value={date(invoice.invoice_date)} /><Field label="Received date" value={date(invoice.received_date)} /><Field label="Due date" value={date(invoice.due_date)} /><Field label="Payment terms" value={invoice.payment_terms} /><Field label="VAT / TRN" value={invoice.vat_registration_number} /><Field label="VAT percentage" value={invoice.vat_percentage ? `${invoice.vat_percentage}%` : '—'} /><Field label="Captured PO reference" value={invoice.po_reference_text} mono /><Field label="Original file" value={invoice.original_filename} /></dl></Section>
        <Section icon={LinkIcon} title="PO and receipt matching">
          <div className="mb-3 flex justify-end"><button type="button" onClick={runMatch} disabled={working || !allocations.length} className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700 disabled:opacity-40"><ArrowPathIcon className={`h-4 w-4 ${working ? 'animate-spin' : ''}`} /> Re-run three-way match</button></div>
          {allocations.length === 0 ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">No Purchase Order allocation has been confirmed.</div> : <div className="space-y-3">{allocations.map((allocation) => <div key={allocation.id} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-mono text-sm font-bold text-slate-900">{allocation.purchase_order_number}</p><p className="mt-1 text-xs text-slate-500">Allocated {money(allocation.allocated_amount, allocation.currency)} · variance {money(allocation.amount_variance, allocation.currency)}</p></div><Badge value={allocation.match_status} /></div><div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4"><span className={allocation.vendor_matched ? 'text-emerald-700' : 'text-rose-700'}>Vendor {allocation.vendor_matched ? 'matched' : 'mismatch'}</span><span className={allocation.currency_matched ? 'text-emerald-700' : 'text-rose-700'}>Currency {allocation.currency_matched ? 'matched' : 'mismatch'}</span><span className={allocation.amount_within_tolerance ? 'text-emerald-700' : 'text-rose-700'}>Amount {allocation.amount_within_tolerance ? 'within tolerance' : 'exception'}</span><span className={allocation.receipt_numbers?.length ? 'text-emerald-700' : 'text-amber-700'}>{allocation.receipt_numbers?.length || 0} receipt(s)</span></div>{allocation.exception_codes?.length > 0 && <ul className="mt-3 list-disc rounded-lg bg-rose-50 px-8 py-3 text-xs text-rose-700">{allocation.exception_codes.map((code) => <li key={code}>{code.replaceAll('_', ' ')}</li>)}</ul>}</div>)}</div>}
        </Section>
        <Section icon={BanknotesIcon} title="Payable payment operations">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <select value={operation} onChange={(event) => setOperation(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm"><option value="schedule">Schedule payment</option><option value="payment">Record payment</option><option value="hold">Place on hold</option><option value="release">Release hold</option><option value="cancel">Cancel payment</option></select>
            <input type="date" value={effectiveDate} onChange={(event) => setEffectiveDate(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input type="number" min="0.01" step="0.01" disabled={operation !== 'payment'} value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Payment amount" className="rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100" />
            <input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Bank/reference number" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div className="mt-3 flex justify-end"><button type="button" onClick={recordOperation} disabled={working} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-40">Record operation</button></div>
          <div className="mt-4 space-y-2">{(invoice.payment_operations || []).map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2 text-xs"><div><span className="font-bold capitalize text-slate-800">{item.operation}</span><span className="ml-2 text-slate-500">{item.reference || 'No reference'} · {date(item.effective_date)}</span></div><span className="font-semibold text-slate-700">{item.amount ? money(item.amount, item.currency) : '—'} · {item.created_by_name || 'System'}</span></div>)}{!(invoice.payment_operations || []).length && <p className="text-sm text-slate-500">No payment operation has been recorded.</p>}</div>
        </Section>
        <Section icon={BanknotesIcon} title="Structured invoice lines">{invoice.structured_line_items?.length ? <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-3 py-2 text-left">#</th><th className="px-3 py-2 text-left">Description</th><th className="px-3 py-2 text-right">Qty</th><th className="px-3 py-2 text-right">Unit price</th><th className="px-3 py-2 text-right">Total</th></tr></thead><tbody className="divide-y divide-slate-100">{invoice.structured_line_items.map((line) => <tr key={line.id}><td className="px-3 py-2">{line.line_number}</td><td className="px-3 py-2">{line.description || '—'}</td><td className="px-3 py-2 text-right">{line.quantity || '—'}</td><td className="px-3 py-2 text-right">{money(line.unit_price, line.currency || invoice.currency)}</td><td className="px-3 py-2 text-right font-semibold">{money(line.total_amount, line.currency || invoice.currency)}</td></tr>)}</tbody></table></div> : <p className="text-sm text-slate-500">No structured invoice lines recorded.</p>}</Section>
        <Section icon={ShieldCheckIcon} title="Approval and audit history"><div className="space-y-2">{(invoice.approvals || []).map((approval) => <div key={approval.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm"><div><p className="font-semibold text-slate-800">Level {approval.approval_level} · {approval.level_name}</p><p className="text-xs text-slate-500">{approval.approver_name}</p></div><Badge value={approval.status} /></div>)}{!(invoice.approvals || []).length && <p className="text-sm text-slate-500">No approval records created.</p>}{(invoice.audit_logs || []).map((log) => <div key={log.id} className="border-l-2 border-indigo-200 pl-3 text-sm"><p className="font-semibold text-slate-700">{log.description || log.action}</p><p className="text-xs text-slate-400">{date(log.timestamp, true)}</p></div>)}</div></Section>
      </div>
    </div>
  );
};
IncomingDetail.propTypes = { invoice: PropTypes.object.isRequired, onChanged: PropTypes.func };

const OutgoingDetail = ({ invoice, onChanged }) => {
  const uploadRef = useRef(null);
  const [working, setWorking] = useState(false);
  const total = invoice.grand_total ?? invoice.invoice_amount;
  const upload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setWorking(true);
    try { await invoiceTrackerService.uploadAttachment(invoice.id, file); toast.success('Attachment uploaded successfully.'); await onChanged(); }
    catch (error) { toast.error(errorText(error)); }
    finally { setWorking(false); event.target.value = ''; }
  };
  const recompute = async () => {
    setWorking(true);
    try { await invoiceTrackerService.recompute(invoice.id); toast.success('Invoice calculations refreshed.'); await onChanged(); }
    catch (error) { toast.error(errorText(error)); }
    finally { setWorking(false); }
  };
  const firstPdf = invoice.attachments?.find((item) => item.content_type === 'application/pdf' || item.original_filename?.toLowerCase().endsWith('.pdf'));
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3"><FinancialCard label="Invoice total" value={money(total, invoice.currency)} /><FinancialCard label="Amount received" value={money(invoice.actual_payment_received, invoice.currency)} /><FinancialCard label="Outstanding balance" value={money(invoice.balance_to_be_received, invoice.currency)} emphasis /></div>
      <div className="grid gap-5 xl:grid-cols-2">
        <div className="space-y-4">
          <Section icon={UserCircleIcon} title="Customer and project"><dl className="grid gap-4 sm:grid-cols-2"><Field label="Account" value={invoice.account} /><Field label="Company" value={invoice.company} /><Field label="RAD project number" value={invoice.rad_project_no} mono /><Field label="Project ID" value={invoice.project_id} mono /><Field label="Project name" value={invoice.project_name} wide /><Field label="Project manager" value={invoice.pm} /><Field label="Finance / PM email" value={invoice.finance_pm_email} /><Field label="Contract clause" value={invoice.contract_clause} wide /></dl></Section>
          <Section icon={ClockIcon} title="Dates and collection"><dl className="grid gap-4 sm:grid-cols-2"><Field label="Invoice date" value={date(invoice.invoice_date)} /><Field label="Invoice sent" value={date(invoice.invoice_sent_date)} /><Field label="Due date" value={date(invoice.due_date)} /><Field label="Payment date" value={date(invoice.payment_date)} /><Field label="Payment terms" value={invoice.payment_terms} /><Field label="Days overdue" value={invoice.days_overdue} /><Field label="Bank reference" value={invoice.bank_reference_code} mono /><Field label="Customer reference" value={invoice.customer_inv_reference} /></dl></Section>
          <Section icon={BanknotesIcon} title="Full financial breakdown"><dl className="grid gap-4 sm:grid-cols-2"><Field label="Currency" value={invoice.currency} /><Field label="Invoice amount" value={money(invoice.invoice_amount, invoice.currency)} /><Field label="PPC value" value={money(invoice.ppc_value, invoice.currency)} /><Field label="Retention" value={money(invoice.retention, invoice.currency)} /><Field label="Amount excluding VAT" value={money(invoice.amount_excl_vat, invoice.currency)} /><Field label="Invoice amount AED" value={money(invoice.invoice_amount_aed, 'AED')} /><Field label="Grand total" value={money(invoice.grand_total, invoice.currency)} /><Field label="Paid excluding VAT" value={money(invoice.paid_amount_excl_vat, invoice.currency)} /></dl></Section>
          <Section icon={DocumentTextIcon} title="References and notes"><dl className="grid gap-4 sm:grid-cols-2"><Field label="Category" value={invoice.category_label || invoice.category} /><Field label="Credit note reference" value={invoice.credit_note_ref} /><Field label="Details" value={invoice.details} wide /><Field label="Remarks" value={invoice.remarks} wide /><Field label="Sent by" value={invoice.sent_by} /><Field label="Sent to account" value={invoice.sent_to_account} /></dl></Section>
        </div>
        <div className="space-y-4">
          <Section icon={PaperClipIcon} title={`Attachments (${invoice.attachments_count || 0})`}><div className="mb-3 flex gap-2"><button onClick={() => uploadRef.current?.click()} disabled={working} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"><ArrowUpTrayIcon className="h-4 w-4" /> Upload attachment</button><button onClick={recompute} disabled={working} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50"><ArrowPathIcon className={`h-4 w-4 ${working ? 'animate-spin' : ''}`} /> Recompute</button><input ref={uploadRef} type="file" accept=".pdf,.png,.jpg,.jpeg" className="hidden" onChange={upload} /></div>{firstPdf && <iframe title="Customer invoice attachment" src={firstPdf.file_url || firstPdf.file} className="mb-3 h-[540px] w-full rounded-xl border border-slate-200 bg-slate-100" />}{invoice.attachments?.length ? <div className="space-y-2">{invoice.attachments.map((attachment) => <a key={attachment.id} href={attachment.file_url || attachment.file} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm hover:border-indigo-300 hover:bg-indigo-50"><span className="truncate font-medium text-slate-700">{attachment.original_filename || 'Attachment'}</span><ArrowDownTrayIcon className="h-4 w-4 text-indigo-600" /></a>)}</div> : <p className="text-sm text-slate-500">No invoice document attached.</p>}</Section>
          <Section icon={CheckCircleIcon} title="Register audit"><dl className="grid gap-4 sm:grid-cols-2"><Field label="Created" value={date(invoice.created_at, true)} /><Field label="Last updated" value={date(invoice.updated_at, true)} /><Field label="Payment status" value={<Badge value={invoice.payment_status} />} /><Field label="ICV applicable" value={invoice.icv_applicable ? 'Yes' : 'No'} /></dl></Section>
        </div>
      </div>
    </div>
  );
};
OutgoingDetail.propTypes = { invoice: PropTypes.object.isRequired, onChanged: PropTypes.func.isRequired };

const InvoiceRegisterDetail = ({ direction }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const incoming = direction === 'incoming';
  const listPath = incoming ? '/finance/incoming-invoices' : '/finance/outgoing-invoices';
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setInvoice(incoming ? await financeService.getInvoice(id) : await invoiceTrackerService.retrieve(id)); }
    catch (requestError) { setError(errorText(requestError)); }
    finally { setLoading(false); }
  }, [id, incoming]);
  useEffect(() => { load(); }, [load]);
  const headerStatuses = useMemo(() => incoming ? [invoice?.procurement_status, invoice?.match_status, invoice?.payment_status] : [invoice?.category, invoice?.payment_status], [incoming, invoice]);
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-800 bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 px-4 py-6 text-white lg:px-8"><div className="mx-auto flex max-w-[1600px] flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><button onClick={() => navigate(listPath)} className="mb-3 inline-flex items-center gap-1 text-xs font-semibold text-indigo-200 hover:text-white"><ArrowLeftIcon className="h-4 w-4" /> Back to {incoming ? 'Incoming' : 'Outgoing'} Invoice Register</button><p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-300">{incoming ? 'Vendor Invoice · Accounts Payable' : 'Customer Invoice · Accounts Receivable'}</p><h1 className="mt-1 text-2xl font-black">{invoice?.invoice_number || 'Invoice Register Detail'}</h1><p className="mt-1 text-xs text-slate-400">{incoming ? invoice?.tracking_id : invoice?.account || invoice?.company}</p></div><div className="flex flex-wrap items-center gap-2">{headerStatuses.filter(Boolean).map((status) => <Badge key={status} value={status} />)}<button onClick={load} disabled={loading} className="ml-1 rounded-lg border border-white/20 bg-white/10 p-2 hover:bg-white/15"><ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button></div></div></header>
      <main className="mx-auto max-w-[1600px] p-4 lg:p-7">{loading && !invoice ? <div className="flex h-72 items-center justify-center text-sm text-slate-500"><ArrowPathIcon className="mr-2 h-5 w-5 animate-spin" /> Loading complete invoice record…</div> : error ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-rose-700"><p className="font-bold">Invoice could not be opened</p><p className="mt-1 text-sm">{error}</p><button onClick={() => navigate(listPath)} className="mt-4 rounded-lg bg-rose-700 px-4 py-2 text-sm font-semibold text-white">Return to register</button></div> : incoming ? <IncomingDetail invoice={invoice} /> : <OutgoingDetail invoice={invoice} onChanged={load} />}</main>
    </div>
  );
};
InvoiceRegisterDetail.propTypes = { direction: PropTypes.oneOf(['incoming', 'outgoing']).isRequired };

export default InvoiceRegisterDetail;
