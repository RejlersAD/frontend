import { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import {
  ArrowPathIcon,
  ArrowTopRightOnSquareIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  LinkIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import financeService from '../../services/finance.service';
import invoiceTrackerService from '../../services/invoiceTracker.service';

const LABELS = {
  ocr_review: 'OCR review', ready_for_matching: 'Ready for matching', procurement_review: 'Procurement review',
  finance_review: 'Finance review', approved_for_payment: 'Approved for payment', rejected: 'Rejected', closed: 'Closed',
  unmatched: 'Unmatched', auto_matched: 'Automatically matched', manual_matched: 'Manually matched', exception: 'Exception',
  verified: 'Verified', not_scheduled: 'Not scheduled', scheduled: 'Scheduled', pending: 'Pending', partial: 'Partially paid',
  paid: 'Paid', on_hold: 'On hold', cancelled: 'Cancelled',
};

const statusClass = (value) => {
  if (['verified', 'auto_matched', 'manual_matched', 'approved_for_payment', 'paid', 'closed'].includes(value)) return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (['exception', 'rejected', 'on_hold', 'cancelled'].includes(value)) return 'border-rose-200 bg-rose-50 text-rose-700';
  if (['procurement_review', 'finance_review', 'partial', 'scheduled', 'pending'].includes(value)) return 'border-amber-200 bg-amber-50 text-amber-700';
  return 'border-slate-200 bg-slate-50 text-slate-700';
};

const Status = ({ value }) => value ? <span className={`inline-flex max-w-full items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusClass(value)}`}><span className="truncate">{LABELS[value] || String(value).replaceAll('_', ' ')}</span></span> : <span className="text-slate-400">—</span>;
Status.propTypes = { value: PropTypes.string };

const money = (value, currency = 'AED') => {
  if (value === null || value === undefined || value === '') return '—';
  try { return new Intl.NumberFormat('en-AE', { style: 'currency', currency: currency || 'AED', maximumFractionDigits: 2 }).format(Number(value)); }
  catch { return `${currency || 'AED'} ${Number(value).toFixed(2)}`; }
};

const date = (value) => {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : new Intl.DateTimeFormat('en-AE', { day: '2-digit', month: 'short', year: 'numeric' }).format(parsed);
};

const Definition = ({ label, children }) => <div className="grid grid-cols-[minmax(105px,0.75fr)_minmax(0,1.25fr)] gap-3 py-1.5"><dt className="text-xs font-medium text-slate-500">{label}</dt><dd className="min-w-0 break-words text-sm font-medium text-slate-800">{children || '—'}</dd></div>;
Definition.propTypes = { label: PropTypes.string.isRequired, children: PropTypes.node };

const EmptyPanel = ({ direction }) => <aside className="invoice-context-panel invoice-context-panel-empty flex items-center justify-center rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm"><div><span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-blue-50 text-blue-600"><DocumentTextIcon className="h-6 w-6" /></span><h2 className="mt-4 text-base font-semibold text-slate-900">Select an invoice</h2><p className="mx-auto mt-1 max-w-[30ch] text-sm leading-5 text-slate-500">Review {direction === 'incoming' ? 'vendor invoice and matching' : 'customer invoice and collection'} details without leaving the register.</p></div></aside>;
EmptyPanel.propTypes = { direction: PropTypes.oneOf(['incoming', 'outgoing']).isRequired };

const InvoiceContextPanel = ({ direction, invoice, onClose }) => {
  const navigate = useNavigate();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!invoice?.id) { setDetail(null); setError(''); return undefined; }
    let active = true;
    setLoading(true); setError(''); setDetail(null);
    const request = direction === 'incoming' ? financeService.getInvoice(invoice.id) : invoiceTrackerService.retrieve(invoice.id);
    request.then((data) => { if (active) setDetail(data); }).catch((requestError) => { if (active) setError(requestError?.response?.data?.detail || requestError?.message || 'Invoice details could not be loaded.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [direction, invoice?.id]);

  const data = detail || invoice;
  const view = useMemo(() => {
    if (!data) return null;
    if (direction === 'incoming') return {
      partyLabel: 'Vendor', party: data.vendor_master_name || data.vendor_name || 'Not recorded', subtitle: data.tracking_id,
      total: data.total_amount, secondaryLabel: 'Net amount', secondary: data.amount, balanceLabel: 'Tax', balance: data.tax_amount,
      referenceLabel: 'PO reference', reference: data.po_allocations?.[0]?.purchase_order_number || data.po_reference_text,
      issued: data.invoice_date, due: data.due_date, status: data.procurement_status, match: data.match_status, payment: data.payment_status,
    };
    return {
      partyLabel: 'Customer / account', party: data.account || data.company || 'Not recorded', subtitle: data.customer_inv_reference || data.rad_project_no,
      total: data.grand_total ?? data.invoice_amount, secondaryLabel: 'Received', secondary: data.actual_payment_received,
      balanceLabel: 'Balance', balance: data.balance_to_be_received, referenceLabel: 'Project', reference: data.project_name || data.rad_project_no,
      issued: data.invoice_date, due: data.due_date, status: data.payment_status, match: null, payment: null,
    };
  }, [data, direction]);

  if (!invoice || !view) return <EmptyPanel direction={direction} />;
  const fullPath = `/finance/${direction === 'incoming' ? 'incoming' : 'outgoing'}-invoices/${invoice.id}`;

  return <aside className="invoice-context-panel sticky top-4 self-start overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm" aria-label="Selected invoice details">
    <header className="border-b border-slate-200 px-4 py-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-medium text-slate-500">{direction === 'incoming' ? 'Incoming invoice' : 'Outgoing invoice'}</p><h2 className="mt-0.5 truncate text-lg font-semibold text-slate-950" title={data.invoice_number}>{data.invoice_number || 'Invoice'}</h2>{view.subtitle && <p className="mt-0.5 truncate text-xs text-slate-500" title={view.subtitle}>{view.subtitle}</p>}</div><button type="button" onClick={onClose} aria-label="Close invoice details" title="Close details" className="grid h-8 w-8 flex-none place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"><XMarkIcon className="h-5 w-5" /></button></div><div className="mt-3 flex flex-wrap gap-1.5"><Status value={view.status} />{view.match && <Status value={view.match} />}{view.payment && <Status value={view.payment} />}</div></header>
    {loading && !detail ? <div className="flex h-80 items-center justify-center gap-2 text-sm text-slate-500"><ArrowPathIcon className="h-5 w-5 animate-spin" /> Loading details…</div> : error ? <div className="m-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"><ExclamationTriangleIcon className="mb-2 h-5 w-5" />{error}</div> : <div className="invoice-context-panel-body">
      <section className="grid grid-cols-2 border-b border-slate-200 bg-slate-50"><div className="col-span-2 border-b border-slate-200 px-4 py-3"><p className="text-[11px] font-medium text-slate-500">Total</p><p className="mt-1 text-lg font-semibold tabular-nums text-slate-950">{money(view.total, data.currency)}</p></div><div className="border-r border-slate-200 px-3 py-3"><p className="text-[11px] font-medium text-slate-500">{view.secondaryLabel}</p><p className="mt-1 truncate text-sm font-semibold tabular-nums text-slate-800" title={money(view.secondary, data.currency)}>{money(view.secondary, data.currency)}</p></div><div className="px-3 py-3"><p className="text-[11px] font-medium text-slate-500">{view.balanceLabel}</p><p className="mt-1 truncate text-sm font-semibold tabular-nums text-slate-800" title={money(view.balance, data.currency)}>{money(view.balance, data.currency)}</p></div></section>
      <section className="border-b border-slate-200 px-4 py-4"><h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900"><DocumentTextIcon className="h-4 w-4 text-blue-600" />Invoice overview</h3><dl className="mt-2 divide-y divide-slate-100"><Definition label={view.partyLabel}>{view.party}</Definition><Definition label={view.referenceLabel}>{view.reference || '—'}</Definition><Definition label="Invoice date">{date(view.issued)}</Definition><Definition label="Due date">{date(view.due)}</Definition><Definition label="Currency">{data.currency || '—'}</Definition></dl></section>
      {direction === 'incoming' ? <section className="px-4 py-4"><h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900"><LinkIcon className="h-4 w-4 text-blue-600" />Matching summary</h3><dl className="mt-2 divide-y divide-slate-100"><Definition label="Captured vendor">{data.vendor_name || '—'}</Definition><Definition label="VAT / TRN">{data.vat_registration_number || '—'}</Definition><Definition label="Matching"><Status value={data.match_status} /></Definition><Definition label="Payment"><Status value={data.payment_status} /></Definition></dl></section> : <section className="px-4 py-4"><h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900"><CalendarDaysIcon className="h-4 w-4 text-blue-600" />Collection summary</h3><dl className="mt-2 divide-y divide-slate-100"><Definition label="Payment status"><Status value={data.payment_status} /></Definition><Definition label="Payment terms">{data.payment_terms || '—'}</Definition><Definition label="Days overdue">{data.days_overdue ?? '—'}</Definition><Definition label="Bank reference">{data.bank_reference_code || '—'}</Definition></dl></section>}
    </div>}
    <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white p-3"><span className="inline-flex items-center gap-1 text-xs text-slate-500"><CheckCircleIcon className="h-4 w-4 text-emerald-600" />Updated {date(data.updated_at)}</span><button type="button" onClick={() => navigate(fullPath)} className="inline-flex h-9 items-center gap-2 rounded-lg bg-blue-600 px-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"><ArrowTopRightOnSquareIcon className="h-4 w-4" />Open full invoice</button></footer>
  </aside>;
};

InvoiceContextPanel.propTypes = { direction: PropTypes.oneOf(['incoming', 'outgoing']).isRequired, invoice: PropTypes.object, onClose: PropTypes.func.isRequired };
export default InvoiceContextPanel;
