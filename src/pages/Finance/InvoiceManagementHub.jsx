import { useCallback, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import {
  ArrowPathIcon,
  ArrowTrendingDownIcon,
  ArrowTrendingUpIcon,
  BanknotesIcon,
  ChartBarSquareIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  ScaleIcon,
} from '@heroicons/react/24/outline';
import financeService from '../../services/finance.service';

const INVOICE_AREAS = [
  {
    key: 'incoming',
    label: 'Incoming Invoices',
    short: 'Vendor invoices · Accounts Payable',
    description: 'Invoices received from suppliers, including OCR review, PO matching, receipts, and payment approval.',
    icon: ArrowTrendingDownIcon,
    path: '/finance/incoming-invoices',
  },
  {
    key: 'outgoing',
    label: 'Outgoing Invoices',
    short: 'Customer invoices · Accounts Receivable',
    description: 'Invoices issued to customers, including collection status, overdue balances, and attachments.',
    icon: ArrowTrendingUpIcon,
    path: '/finance/outgoing-invoices',
  },
];

const formatMoney = (value, currency) => {
  const number = Number(value || 0);
  try {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(number);
  } catch {
    return `${currency} ${number.toLocaleString('en-AE', { maximumFractionDigits: 2 })}`;
  }
};

const compactMoney = (value) => {
  const number = Number(value || 0);
  const compact = new Intl.NumberFormat('en-AE', { notation: 'compact', maximumFractionDigits: 2 }).format(number);
  return `AED ${compact}`;
};

const ExecutiveKpiCard = ({ icon: Icon, label, value, description, accent, loading }) => (
  <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.08] p-4 shadow-lg backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/[0.12]">
    <div className={`absolute -right-7 -top-7 h-24 w-24 rounded-full opacity-20 blur-2xl ${accent}`} />
    <div className="relative">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-300">{label}</p>
        <div className="rounded-lg border border-white/10 bg-white/10 p-2"><Icon className="h-4 w-4 text-white" /></div>
      </div>
      {loading ? <div className="mt-4 h-8 w-28 animate-pulse rounded bg-white/15" /> : <p className="mt-3 whitespace-nowrap text-2xl font-black tracking-tight text-white">{value}</p>}
      <p className="mt-1 min-h-8 text-[11px] leading-4 text-slate-400">{description}</p>
    </div>
  </div>
);

ExecutiveKpiCard.propTypes = {
  icon: PropTypes.elementType.isRequired,
  label: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
  description: PropTypes.string.isRequired,
  accent: PropTypes.string.isRequired,
  loading: PropTypes.bool,
};

const InvoiceManagementHub = () => {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setSummary(await financeService.getCombinedInvoiceSummary());
    } catch (requestError) {
      setError(requestError.response?.data?.detail || requestError.message || 'Combined summary could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSummary();
    const timer = window.setInterval(loadSummary, 60_000);
    return () => window.clearInterval(timer);
  }, [loadSummary]);

  const kpis = summary?.executive_kpis || {};
  const executiveCards = [
    { label: 'Total Receivables', value: compactMoney(kpis.total_receivables), description: 'Customer balances expected in AED', icon: ArrowTrendingUpIcon, accent: 'bg-sky-400' },
    { label: 'Total Payables', value: compactMoney(kpis.total_payables), description: 'Approved and pending vendor exposure', icon: ArrowTrendingDownIcon, accent: 'bg-violet-400' },
    { label: 'Net Exposure', value: compactMoney(kpis.net_exposure), description: 'Receivables less payable obligations', icon: ScaleIcon, accent: 'bg-emerald-400' },
    { label: 'Collection Rate', value: `${Number(kpis.collection_rate || 0).toFixed(1)}%`, description: 'Collected value versus total A/R exposure', icon: ChartBarSquareIcon, accent: 'bg-cyan-400' },
    { label: 'Overdue Receivables', value: Number(kpis.overdue_receivables || 0).toLocaleString(), description: 'Customer invoices past due date', icon: ClockIcon, accent: 'bg-rose-400' },
    { label: 'Approval Bottlenecks', value: Number(kpis.approval_bottlenecks || 0).toLocaleString(), description: 'Invoices currently waiting for approval', icon: ExclamationTriangleIcon, accent: 'bg-amber-400' },
  ];

  return (
    <div className="min-h-screen bg-slate-100">
      <section className="relative overflow-hidden border-b border-slate-800 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 px-4 py-8 text-white lg:px-8">
        <div className="pointer-events-none absolute inset-0 opacity-30"><div className="absolute -left-24 -top-32 h-80 w-80 rounded-full bg-indigo-600 blur-3xl" /><div className="absolute -right-24 top-10 h-72 w-72 rounded-full bg-cyan-600 blur-3xl" /></div>
        <div className="mx-auto max-w-[1600px]">
          <div className="relative flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-indigo-300">3.1 Finance Dashboard</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Finance Command Center</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-300 sm:text-base">Enterprise Financial Operations &amp; Working Capital Overview</p>
            </div>
            <div className="flex flex-col items-start gap-2 lg:items-end"><span className="inline-flex items-center gap-2 text-xs text-slate-400"><span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,.8)]" /> Live financial data</span><button type="button" onClick={loadSummary} disabled={loading} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 text-sm font-semibold hover:bg-white/15 disabled:opacity-50"><ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh command center</button></div>
          </div>
          <div className="relative mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
            {executiveCards.map((card) => <ExecutiveKpiCard key={card.label} {...card} loading={loading && !summary} />)}
          </div>
          {kpis.missing_fx_currencies?.length > 0 && <div className="relative mt-3 rounded-lg border border-amber-300/20 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">AED executive totals exclude currencies without configured FX rates: {kpis.missing_fx_currencies.join(', ')}.</div>}
        </div>
      </section>

      <div className="mx-auto max-w-[1600px] px-4 py-5 lg:px-8">
        {error && <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col justify-between gap-2 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="flex items-center gap-2 font-bold text-slate-900"><BanknotesIcon className="h-5 w-5 text-indigo-600" /> Combined financial summary</h2>
              <p className="mt-0.5 text-xs text-slate-500">Outstanding customer collections minus outstanding vendor payments.</p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600"><InformationCircleIcon className="h-4 w-4" /> No currency conversion applied</span>
          </div>
          {loading && !summary ? <div className="flex h-28 items-center justify-center text-sm text-slate-500"><ArrowPathIcon className="mr-2 h-5 w-5 animate-spin" /> Calculating both ledgers…</div> : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3 text-left">Currency</th><th className="px-4 py-3 text-right">A/R invoiced</th><th className="px-4 py-3 text-right">A/R outstanding</th><th className="px-4 py-3 text-right">A/P invoiced</th><th className="px-4 py-3 text-right">A/P outstanding</th><th className="px-4 py-3 text-right">Net outstanding</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {(summary?.by_currency || []).map((row) => {
                    const positive = Number(row.net_outstanding) >= 0;
                    return <tr key={row.currency} className="hover:bg-slate-50"><td className="px-4 py-3 font-bold text-slate-800">{row.currency}</td><td className="px-4 py-3 text-right text-slate-700">{formatMoney(row.receivable_total, row.currency)}</td><td className="px-4 py-3 text-right font-semibold text-sky-700">{formatMoney(row.receivable_outstanding, row.currency)}</td><td className="px-4 py-3 text-right text-slate-700">{formatMoney(row.payable_total, row.currency)}</td><td className="px-4 py-3 text-right font-semibold text-violet-700">{formatMoney(row.payable_outstanding, row.currency)}</td><td className={`px-4 py-3 text-right font-extrabold ${positive ? 'text-emerald-700' : 'text-rose-700'}`}>{formatMoney(row.net_outstanding, row.currency)}</td></tr>;
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <nav className="mt-5 grid gap-3 md:grid-cols-2" aria-label="Invoice management areas">
          {INVOICE_AREAS.map((area) => {
            const Icon = area.icon;
            return (
              <Link key={area.key} to={area.path} className="rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-indigo-400 hover:bg-indigo-50 hover:shadow-sm">
                <div className="flex items-start gap-3"><div className="rounded-xl bg-indigo-600 p-2.5 text-white"><Icon className="h-5 w-5" /></div><div><p className="font-bold text-slate-900">{area.label} <span className="ml-1 text-xs font-semibold text-slate-500">{area.short}</span></p><p className="mt-1 text-xs text-slate-500">{area.description}</p></div></div>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
};

export default InvoiceManagementHub;
