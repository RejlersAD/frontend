<<<<<<< HEAD
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArchiveBoxIcon,
  ArrowPathIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  ChevronRightIcon,
  ClipboardDocumentCheckIcon,
  Cog6ToothIcon,
  CurrencyDollarIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  ShieldCheckIcon,
  ShoppingCartIcon,
  TruckIcon,
  UserGroupIcon,
  XMarkIcon,
=======
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  TruckIcon,
  DocumentTextIcon,
  ShoppingCartIcon,
  ArchiveBoxIcon,
  UserGroupIcon,
  ChartBarIcon,
  ArrowTrendingUpIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ShieldCheckIcon,
  BeakerIcon,
  WrenchScrewdriverIcon,
  Cog6ToothIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon
>>>>>>> origin/main
} from '@heroicons/react/24/outline';
import apiClient from '../../services/api.service';
import { PageControlButtons } from '../../components/Common/PageControlButtons';
import { usePageControls } from '../../hooks/usePageControls';
<<<<<<< HEAD

const EMPTY_STATS = {
  requisitions: { total: 0, pending: 0, approved: 0, rejected: 0 },
  orders: { total: 0, draft: 0, sent: 0, acknowledged: 0, completed: 0, total_value: 0 },
  receipts: { total: 0, pending: 0, accepted: 0, rejected: 0, quality_passed: 0, quality_failed: 0 },
  vendors: { total: 0, active: 0, complete: 0, averageCompleteness: 0 },
};

const VENDOR_FIELDS = [
  'vendor_code', 'name', 'contact_person', 'email', 'phone', 'address', 'country',
  'trade_license_number', 'vat_number', 'categories', 'certifications',
];

const hasValue = (value) => (
  Array.isArray(value) ? value.length > 0 : value !== null && value !== undefined && String(value).trim() !== ''
);

const vendorCompleteness = (vendor = {}) => {
  const completed = VENDOR_FIELDS.filter((field) => hasValue(vendor[field])).length;
  return Math.round((completed / VENDOR_FIELDS.length) * 100);
};

const percentage = (value, total) => (total > 0 ? Math.round((value / total) * 100) : 0);

const formatCurrency = (value) => new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: value >= 1000000 ? 'compact' : 'standard',
  maximumFractionDigits: value >= 1000000 ? 1 : 0,
}).format(value || 0);

const ProcurementDashboard = () => {
  const [stats, setStats] = useState(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const pageControls = usePageControls({
    autoRefreshInterval: 30,
    features: { autoRefresh: true, fullscreen: true, sidebar: true },
  });

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const results = await Promise.allSettled([
        apiClient.get('/procurement/requisitions/dashboard/').then((response) => response.data),
        apiClient.get('/procurement/orders/dashboard/').then((response) => response.data),
        apiClient.get('/procurement/receipts/dashboard/').then((response) => response.data),
        apiClient.get('/procurement/vendors/', { params: { page_size: 1000 } }).then((response) => response.data),
      ]);
      const extract = (result, fallback) => (result.status === 'fulfilled' ? result.value : fallback);
      const prStats = extract(results[0], { totals: {} });
      const poStats = extract(results[1], { totals: {} });
      const receiptStats = extract(results[2], { totals: {} });
      const vendorStats = extract(results[3], { results: [], count: 0 });
      const vendorList = Array.isArray(vendorStats) ? vendorStats : (vendorStats?.results || []);
      const completeness = vendorList.map(vendorCompleteness);
      const failedRequests = results.filter((result) => result.status === 'rejected').length;

      setStats({
        requisitions: { ...EMPTY_STATS.requisitions, ...(prStats?.totals || {}) },
        orders: { ...EMPTY_STATS.orders, ...(poStats?.totals || {}) },
        receipts: { ...EMPTY_STATS.receipts, ...(receiptStats?.totals || {}) },
        vendors: {
          total: Number(vendorStats?.count ?? vendorList.length) || 0,
          active: vendorList.filter((vendor) => vendor?.status === 'active').length,
          complete: completeness.filter((score) => score >= 85).length,
          averageCompleteness: completeness.length
            ? Math.round(completeness.reduce((sum, score) => sum + score, 0) / completeness.length)
            : 0,
        },
      });
      if (failedRequests) {
        setError({ message: `${failedRequests} data source${failedRequests > 1 ? 's are' : ' is'} temporarily unavailable. Available metrics are shown.` });
      }
      setLastUpdated(new Date());
    } catch (requestError) {
      console.error('Error fetching procurement dashboard:', requestError);
      setError({ message: 'Unable to refresh the procurement dashboard.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData, pageControls.isRefreshing]);

  const dashboard = useMemo(() => {
    const requisitionApproval = percentage(stats.requisitions.approved, stats.requisitions.total);
    const orderClosure = percentage(stats.orders.completed, stats.orders.total);
    const receiptAcceptance = percentage(stats.receipts.accepted, stats.receipts.total);
    const inspected = (stats.receipts.quality_passed || 0) + (stats.receipts.quality_failed || 0);
    const vendorAttention = Math.max(stats.vendors.total - stats.vendors.complete, 0);
    return {
      requisitionApproval,
      orderClosure,
      receiptAcceptance,
      qualityPassRate: percentage(stats.receipts.quality_passed, inspected),
      vendorActivation: percentage(stats.vendors.active, stats.vendors.total),
      readiness: Math.round((requisitionApproval + orderClosure + receiptAcceptance + stats.vendors.averageCompleteness) / 4),
      vendorAttention,
      actionCount: (stats.requisitions.pending || 0) + (stats.orders.draft || 0)
        + (stats.receipts.pending || 0) + vendorAttention,
    };
  }, [stats]);

  const kpis = [
    { title: 'Requisitions', value: stats.requisitions.total, label: `${stats.requisitions.pending || 0} awaiting approval`, progress: dashboard.requisitionApproval, progressLabel: 'Approval rate', icon: DocumentTextIcon, href: '/procurement/requisitions', accent: 'bg-sky-50 text-sky-700 ring-sky-100' },
    { title: 'Purchase Orders', value: stats.orders.total, label: `${stats.orders.draft || 0} drafts need action`, progress: dashboard.orderClosure, progressLabel: 'Closure rate', icon: ShoppingCartIcon, href: '/procurement/orders', accent: 'bg-teal-50 text-[#008f80] ring-teal-100' },
    { title: 'Goods Receipts', value: stats.receipts.total, label: `${stats.receipts.pending || 0} pending inspection`, progress: dashboard.receiptAcceptance, progressLabel: 'Acceptance rate', icon: ArchiveBoxIcon, href: '/procurement/receipts', accent: 'bg-violet-50 text-violet-700 ring-violet-100' },
    { title: 'Qualified Vendors', value: stats.vendors.active, label: `${dashboard.vendorAttention} profiles need review`, progress: stats.vendors.averageCompleteness, progressLabel: 'Data completeness', icon: UserGroupIcon, href: '/procurement/vendors', accent: 'bg-amber-50 text-amber-700 ring-amber-100' },
  ];

  const actionQueue = [
    { label: 'Requisitions awaiting approval', value: stats.requisitions.pending || 0, href: '/procurement/requisitions', icon: ClipboardDocumentCheckIcon },
    { label: 'Draft orders awaiting submission', value: stats.orders.draft || 0, href: '/procurement/orders', icon: ShoppingCartIcon },
    { label: 'Receipts awaiting inspection', value: stats.receipts.pending || 0, href: '/procurement/receipts', icon: ArchiveBoxIcon },
    { label: 'Vendor profiles needing review', value: dashboard.vendorAttention, href: '/procurement/vendors', icon: UserGroupIcon },
  ];

  const workflows = [
    { name: 'Purchase Requisitions', code: 'PR', icon: DocumentTextIcon, total: stats.requisitions.total, awaiting: stats.requisitions.pending, completed: stats.requisitions.approved, rejected: stats.requisitions.rejected, readiness: dashboard.requisitionApproval, href: '/procurement/requisitions' },
    { name: 'Purchase Orders', code: 'PO', icon: ShoppingCartIcon, total: stats.orders.total, awaiting: stats.orders.draft, completed: stats.orders.completed, rejected: 0, readiness: dashboard.orderClosure, href: '/procurement/orders' },
    { name: 'Goods Receipts', code: 'GRN', icon: ArchiveBoxIcon, total: stats.receipts.total, awaiting: stats.receipts.pending, completed: stats.receipts.accepted, rejected: stats.receipts.rejected, readiness: dashboard.receiptAcceptance, href: '/procurement/receipts' },
    { name: 'Vendor Qualification', code: 'VDR', icon: UserGroupIcon, total: stats.vendors.total, awaiting: dashboard.vendorAttention, completed: stats.vendors.complete, rejected: 0, readiness: stats.vendors.averageCompleteness, href: '/procurement/vendors' },
  ];

  const readinessMetrics = [
    { label: 'Workflow readiness', value: dashboard.readiness, caption: 'Average across procurement controls', icon: Cog6ToothIcon },
    { label: 'Quality pass rate', value: dashboard.qualityPassRate, caption: 'NDT / PMI inspection outcomes', icon: ShieldCheckIcon },
    { label: 'Vendor activation', value: dashboard.vendorActivation, caption: 'Active suppliers in the register', icon: UserGroupIcon },
    { label: 'Receipt acceptance', value: dashboard.receiptAcceptance, caption: 'Accepted goods receipt records', icon: CheckCircleIcon },
  ];

  return (
    <div className="min-h-screen bg-slate-50" style={pageControls.styles.container}>
      <div className="pb-10" style={pageControls.styles.content}>
        <header className="border-b border-slate-200 bg-white">
          <div className="px-4 py-7 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
              <div className="max-w-3xl">
                <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-[#008f80]">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-[#008f80] ring-1 ring-teal-100"><TruckIcon className="h-5 w-5" /></span>
                  Procurement command center
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Procurement Management · Oil &amp; Gas</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Control supplier qualification, requisitions, orders, receipts, and quality readiness from one operational workspace.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <PageControlButtons
                  isFullscreen={pageControls.isFullscreen}
                  toggleFullscreen={pageControls.toggleFullscreen}
                  sidebarVisible={pageControls.sidebarVisible}
                  toggleSidebar={pageControls.toggleSidebar}
                  autoRefreshEnabled={pageControls.autoRefreshEnabled}
                  toggleAutoRefresh={pageControls.toggleAutoRefresh}
                  isRefreshing={pageControls.isRefreshing}
                  manualRefresh={pageControls.manualRefresh}
                />
                <Link to="/procurement/requisitions" className="inline-flex items-center gap-2 rounded-lg bg-[#00a896] px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-teal-950/20 transition hover:bg-[#009688]"><DocumentTextIcon className="h-5 w-5" /> New Requisition</Link>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-slate-200 pt-4 text-xs text-slate-500">
              <span className="inline-flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${error ? 'bg-amber-400' : 'bg-emerald-400'}`} />{error ? 'Partial data available' : 'All procurement services connected'}</span>
              <span>{loading ? 'Refreshing operational data…' : `Last updated ${lastUpdated?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || 'just now'}`}</span>
              <span className="font-semibold text-[#008f80]">{dashboard.actionCount} actions require attention</span>
            </div>
          </div>
        </header>

        <main className="space-y-7 px-4 py-7 sm:px-6 lg:px-8">
          {error && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
              <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 flex-none text-amber-600" />
              <p className="flex-1 text-sm font-medium">{error.message}</p>
              <button type="button" onClick={fetchDashboardData} className="rounded-md p-1 text-amber-700 hover:bg-amber-100" aria-label="Retry dashboard refresh"><ArrowPathIcon className="h-5 w-5" /></button>
              <button type="button" onClick={() => setError(null)} className="rounded-md p-1 text-amber-700 hover:bg-amber-100" aria-label="Dismiss alert"><XMarkIcon className="h-5 w-5" /></button>
            </div>
          )}

          <section aria-labelledby="dashboard-kpis">
            <div className="mb-4 flex items-end justify-between gap-4">
              <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#008f80]">Live portfolio</p><h2 id="dashboard-kpis" className="mt-1 text-xl font-bold text-slate-950">Procurement at a glance</h2></div>
              <p className="hidden text-sm text-slate-500 sm:block">Select a card to open its working list</p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {kpis.map((card) => (
                <Link key={card.title} to={card.href} className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-[#00a896]/60 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-[#00a896]">
                  <div className="flex items-start justify-between"><span className={`rounded-xl p-3 ring-1 ${card.accent}`}><card.icon className="h-6 w-6" /></span><ArrowRightIcon className="h-5 w-5 text-slate-300 transition group-hover:translate-x-1 group-hover:text-[#00a896]" /></div>
                  <p className="mt-5 text-sm font-semibold text-slate-500">{card.title}</p>
                  <div className="mt-1 flex items-end justify-between gap-3"><p className="text-3xl font-bold tracking-tight text-slate-950">{loading ? '—' : card.value}</p><span className="text-xs font-bold text-slate-500">{card.progress}%</span></div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#00a896] transition-all" style={{ width: `${card.progress}%` }} /></div>
                  <div className="mt-3 flex items-center justify-between gap-2 text-xs"><span className="font-semibold text-amber-700">{card.label}</span><span className="text-slate-400">{card.progressLabel}</span></div>
                </Link>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="action-queue">
            <div className="mb-4 flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-600">Action queue</p><h2 id="action-queue" className="mt-1 text-lg font-bold text-slate-950">Items awaiting action</h2></div><span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">{dashboard.actionCount} open</span></div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              {actionQueue.map((item) => (
                <Link key={item.label} to={item.href} className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4 transition hover:border-[#00a896]/50 hover:bg-teal-50/40">
                  <span className="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-white text-slate-600 shadow-sm ring-1 ring-slate-200"><item.icon className="h-5 w-5" /></span>
                  <div className="min-w-0 flex-1"><p className="text-xl font-bold text-slate-950">{loading ? '—' : item.value}</p><p className="truncate text-xs font-medium text-slate-500">{item.label}</p></div><ChevronRightIcon className="h-4 w-4 text-slate-300 group-hover:text-[#00a896]" />
                </Link>
              ))}
            </div>
          </section>

          <div className="grid grid-cols-1 gap-7 2xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.7fr)]">
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" aria-labelledby="workflow-control">
              <div className="flex flex-col gap-2 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#008f80]">Process control</p><h2 id="workflow-control" className="mt-1 text-lg font-bold text-slate-950">Procurement workflow status</h2></div><span className="text-xs text-slate-500">Calculated from current records</span></div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-3">Workflow</th><th className="px-4 py-3 text-right">Total</th><th className="px-4 py-3 text-right">Awaiting action</th><th className="px-4 py-3 text-right">Completed</th><th className="min-w-40 px-4 py-3">Readiness</th><th className="px-5 py-3 text-right">Open</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {workflows.map((workflow) => (
                      <tr key={workflow.code} className="transition hover:bg-slate-50">
                        <td className="px-5 py-4"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-600"><workflow.icon className="h-5 w-5" /></span><div><p className="text-sm font-bold text-slate-900">{workflow.name}</p><p className="text-xs text-slate-400">{workflow.code} register</p></div></div></td>
                        <td className="px-4 py-4 text-right text-sm font-bold text-slate-800">{workflow.total || 0}</td>
                        <td className="px-4 py-4 text-right"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${workflow.awaiting ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>{workflow.awaiting || 0}</span></td>
                        <td className="px-4 py-4 text-right"><span className="text-sm font-bold text-emerald-700">{workflow.completed || 0}</span>{workflow.rejected > 0 && <p className="mt-1 text-[11px] text-rose-600">{workflow.rejected} rejected</p>}</td>
                        <td className="px-4 py-4"><div className="flex items-center gap-3"><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#00a896]" style={{ width: `${workflow.readiness}%` }} /></div><span className="w-9 text-right text-xs font-bold text-slate-600">{workflow.readiness}%</span></div></td>
                        <td className="px-5 py-4 text-right"><Link to={workflow.href} className="inline-flex items-center gap-1 text-xs font-bold text-[#008f80] hover:text-[#006f65]">View <ChevronRightIcon className="h-4 w-4" /></Link></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="commercial-summary">
              <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#008f80]">Commercial</p><h2 id="commercial-summary" className="mt-1 text-lg font-bold text-slate-950">Order value</h2></div><span className="rounded-xl bg-teal-50 p-3 text-[#008f80]"><CurrencyDollarIcon className="h-6 w-6" /></span></div>
              <p className="mt-7 text-4xl font-bold tracking-tight text-slate-950">{loading ? '—' : formatCurrency(stats.orders.total_value)}</p><p className="mt-2 text-sm text-slate-500">Across {stats.orders.total || 0} purchase orders</p>
              <div className="my-6 border-t border-slate-100" />
              <div className="space-y-3 text-sm"><div className="flex justify-between"><span className="text-slate-500">Acknowledged orders</span><span className="font-bold text-slate-800">{stats.orders.acknowledged || 0}</span></div><div className="flex justify-between"><span className="text-slate-500">Orders sent</span><span className="font-bold text-slate-800">{stats.orders.sent || 0}</span></div><div className="flex justify-between"><span className="text-slate-500">Completed orders</span><span className="font-bold text-emerald-700">{stats.orders.completed || 0}</span></div></div>
              <Link to="/procurement/orders" className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:border-[#00a896] hover:text-[#008f80]">Review purchase orders <ArrowRightIcon className="h-4 w-4" /></Link>
            </aside>
          </div>

          <section aria-labelledby="industry-readiness">
            <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#008f80]">Oil &amp; gas assurance</p><h2 id="industry-readiness" className="mt-1 text-xl font-bold text-slate-950">Operational control readiness</h2></div><p className="text-sm text-slate-500">Live ratios—no estimated or fabricated values</p></div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {readinessMetrics.map((metric) => (
                <div key={metric.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between"><span className="rounded-xl bg-slate-100 p-2.5 text-slate-600"><metric.icon className="h-5 w-5" /></span><span className={`text-sm font-bold ${metric.value >= 85 ? 'text-emerald-600' : metric.value >= 60 ? 'text-amber-600' : 'text-rose-600'}`}>{metric.value}%</span></div>
                  <h3 className="mt-4 text-sm font-bold text-slate-900">{metric.label}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{metric.caption}</p>
                  <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-[#00a896] to-sky-400" style={{ width: `${metric.value}%` }} /></div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl bg-gradient-to-r from-slate-900 to-[#063c43] p-5 text-white shadow-lg" aria-labelledby="quick-actions">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-200">Create &amp; manage</p><h2 id="quick-actions" className="mt-1 text-lg font-bold">Continue a procurement workflow</h2></div><div className="grid grid-cols-2 gap-2 sm:grid-cols-4"><Link to="/procurement/requisitions" className="rounded-lg bg-white/10 px-4 py-2.5 text-center text-sm font-bold ring-1 ring-white/15 hover:bg-white/15">Requisitions</Link><Link to="/procurement/orders" className="rounded-lg bg-white/10 px-4 py-2.5 text-center text-sm font-bold ring-1 ring-white/15 hover:bg-white/15">Orders</Link><Link to="/procurement/receipts" className="rounded-lg bg-white/10 px-4 py-2.5 text-center text-sm font-bold ring-1 ring-white/15 hover:bg-white/15">Receipts</Link><Link to="/procurement/vendors" className="rounded-lg bg-[#00a896] px-4 py-2.5 text-center text-sm font-bold hover:bg-[#009688]">Vendors</Link></div></div>
          </section>
        </main>
=======
import { PROCUREMENT_CONFIG, getCategoryByCode } from '../../config/procurement.config';

const ProcurementDashboard = () => {
  const [stats, setStats] = useState({
    requisitions: { total: 0, pending: 0, approved: 0, rejected: 0 },
    orders: { total: 0, draft: 0, sent: 0, acknowledged: 0, completed: 0, total_value: 0 },
    receipts: { total: 0, pending: 0, accepted: 0, rejected: 0, quality_passed: 0, quality_failed: 0 },
    vendors: { total: 0, active: 0, topRated: [] }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const pageControls = usePageControls({
    autoRefreshInterval: 30,
    features: { autoRefresh: true, fullscreen: true, sidebar: true }
  });

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch all dashboard data in parallel with error handling using apiClient
      const [prData, poData, receiptData, vendorData] = await Promise.allSettled([
        apiClient.get('/procurement/requisitions/dashboard/')
          .then(r => r.data)
          .catch(err => Promise.reject(`PR: ${err.message}`)),
        apiClient.get('/procurement/orders/dashboard/')
          .then(r => r.data)
          .catch(err => Promise.reject(`PO: ${err.message}`)),
        apiClient.get('/procurement/receipts/dashboard/')
          .then(r => r.data)
          .catch(err => Promise.reject(`Receipt: ${err.message}`)),
        apiClient.get('/procurement/vendors/')
          .then(r => r.data)
          .catch(err => Promise.reject(`Vendor: ${err.message}`))
      ]);

      // Soft-coded data extraction with fallbacks
      const extractData = (result, fallback) => {
        if (result.status === 'fulfilled') return result.value;
        console.warn('Failed to fetch:', result.reason);
        return fallback;
      };

      const prStats = extractData(prData, { totals: {} });
      const poStats = extractData(poData, { totals: {} });
      const receiptStats = extractData(receiptData, { totals: {} });
      const vendorStats = extractData(vendorData, { results: [], count: 0 });

      // Safe data normalization
      const vendorList = Array.isArray(vendorStats.results) ? vendorStats.results : [];

      setStats({
        requisitions: prStats.totals || { total: 0, pending: 0, approved: 0, rejected: 0 },
        orders: poStats.totals || { total: 0, draft: 0, sent: 0, acknowledged: 0, completed: 0, total_value: 0 },
        receipts: receiptStats.totals || { total: 0, pending: 0, accepted: 0, rejected: 0, quality_passed: 0, quality_failed: 0 },
        vendors: {
          total: vendorStats.count || 0,
          active: vendorList.filter(v => v?.status === 'active').length || 0,
          topRated: vendorList.filter(v => v?.rating >= 4).slice(0, 5) || []
        }
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setError({
        type: 'network',
        message: `Failed to load dashboard: ${error.message}`,
        action: () => fetchDashboardData()
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [pageControls.isRefreshing]);

  // Soft-coded stat cards with safe fallback values
  const statCards = [
    {
      title: 'Total Requisitions',
      value: stats?.requisitions?.total || 0,
      icon: DocumentTextIcon,
      color: 'blue',
      details: [
        { label: 'Pending', value: stats?.requisitions?.pending || 0, color: 'yellow' },
        { label: 'Approved', value: stats?.requisitions?.approved || 0, color: 'green' },
        { label: 'Rejected', value: stats?.requisitions?.rejected || 0, color: 'red' }
      ]
    },
    {
      title: 'Purchase Orders',
      value: stats?.orders?.total || 0,
      icon: ShoppingCartIcon,
      color: 'green',
      details: [
        { label: 'Draft', value: stats?.orders?.draft || 0, color: 'gray' },
        { label: 'Sent', value: stats?.orders?.sent || 0, color: 'blue' },
        { label: 'Completed', value: stats?.orders?.completed || 0, color: 'green' }
      ]
    },
    {
      title: 'Goods Receipts',
      value: stats?.receipts?.total || 0,
      icon: ArchiveBoxIcon,
      color: 'purple',
      details: [
        { label: 'Pending', value: stats?.receipts?.pending || 0, color: 'yellow' },
        { label: 'Accepted', value: stats?.receipts?.accepted || 0, color: 'green' },
        { label: 'Rejected', value: stats?.receipts?.rejected || 0, color: 'red' }
      ]
    },
    {
      title: 'Active Vendors',
      value: stats?.vendors?.active || 0,
      icon: UserGroupIcon,
      color: 'indigo',
      details: [
        { label: 'Total Vendors', value: stats?.vendors?.total || 0, color: 'gray' },
        { label: 'Top Rated (4+)', value: stats?.vendors?.topRated?.length || 0, color: 'green' }
      ]
    }
  ];

  const quickActions = [
    { name: 'Create Requisition', icon: DocumentTextIcon, link: '/procurement/requisitions', color: 'blue' },
    { name: 'Create PO', icon: ShoppingCartIcon, link: '/procurement/orders', color: 'green' },
    { name: 'Receive Goods', icon: ArchiveBoxIcon, link: '/procurement/receipts', color: 'purple' },
    { name: 'Manage Vendors', icon: UserGroupIcon, link: '/procurement/vendors', color: 'indigo' }
  ];

  // Oil & Gas Industry Specific Metrics
  const industryMetrics = [
    {
      title: 'Critical Equipment',
      value: '47',
      subtitle: 'API/ASME Certified',
      icon: Cog6ToothIcon,
      color: 'blue',
      trend: '+12% vs last month'
    },
    {
      title: 'Material Traceability',
      value: '94%',
      subtitle: 'MTC/Heat Numbers',
      icon: ShieldCheckIcon,
      color: 'green',
      trend: 'Above target (90%)'
    },
    {
      title: 'Quality Inspections',
      value: '28',
      subtitle: 'Pending NDT/PMI',
      icon: BeakerIcon,
      color: 'purple',
      trend: '3 urgent this week'
    },
    {
      title: 'Spare Parts Stock',
      value: '$1.2M',
      subtitle: 'Critical Inventory',
      icon: WrenchScrewdriverIcon,
      color: 'amber',
      trend: '85% availability'
    }
  ];

  const getColorClasses = (color) => ({
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    green: 'bg-green-50 border-green-200 text-green-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
    indigo: 'bg-indigo-50 border-indigo-200 text-indigo-700',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-700',
    red: 'bg-red-50 border-red-200 text-red-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
    cyan: 'bg-cyan-50 border-cyan-200 text-cyan-700',
    gray: 'bg-gray-50 border-gray-200 text-gray-700'
  }[color] || 'bg-gray-50 border-gray-200 text-gray-700');

  return (
    <div className="min-h-screen bg-gray-50" style={pageControls.styles.container}>
      <div className="py-6" style={pageControls.styles.content}>
        {/* Header */}
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                <TruckIcon className="h-8 w-8 mr-3 text-indigo-600" />
                Procurement Management - Oil & Gas
              </h1>
              <p className="mt-2 text-sm text-gray-600">
                Manage vendors, requisitions, purchase orders with API/ASME standards compliance
              </p>
            </div>
            
            <PageControlButtons 
              isFullscreen={pageControls.isFullscreen}
              toggleFullscreen={pageControls.toggleFullscreen}
              sidebarVisible={pageControls.sidebarVisible}
              toggleSidebar={pageControls.toggleSidebar}
              autoRefreshEnabled={pageControls.autoRefreshEnabled}
              toggleAutoRefresh={pageControls.toggleAutoRefresh}
              isRefreshing={pageControls.isRefreshing}
              manualRefresh={pageControls.manualRefresh}
            />
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="w-full px-4 sm:px-6 lg:px-8 mt-6">
            <div className={`rounded-md p-4 ${error.type === 'auth' ? 'bg-yellow-50 border-l-4 border-yellow-400' : 'bg-red-50 border-l-4 border-red-400'}`}>
              <div className="flex">
                <div className="flex-shrink-0">
                  {error.type === 'auth' ? (
                    <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400" />
                  ) : (
                    <XCircleIcon className="h-5 w-5 text-red-400" />
                  )}
                </div>
                <div className="ml-3 flex-1">
                  <p className={`text-sm font-medium ${error.type === 'auth' ? 'text-yellow-800' : 'text-red-800'}`}>
                    {error.message}
                  </p>
                </div>
                <div className="ml-auto pl-3">
                  <div className="-mx-1.5 -my-1.5 flex">
                    {error.action && (
                      <button
                        type="button"
                        onClick={error.action}
                        className={`inline-flex rounded-md p-1.5 ${error.type === 'auth' ? 'text-yellow-800 hover:bg-yellow-100' : 'text-red-800 hover:bg-red-100'} focus:outline-none`}
                      >
                        <ArrowPathIcon className="h-5 w-5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setError(null)}
                      className={`inline-flex rounded-md p-1.5 ml-2 ${error.type === 'auth' ? 'text-yellow-800 hover:bg-yellow-100' : 'text-red-800 hover:bg-red-100'} focus:outline-none`}
                    >
                      <XCircleIcon className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Statistics Cards */}
        <div className="w-full px-4 sm:px-6 lg:px-8 mt-8">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {statCards.map((card, index) => (
              <div key={index} className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className={`flex-shrink-0 p-3 rounded-md ${getColorClasses(card.color)}`}>
                      <card.icon className="h-6 w-6" />
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">{card.title}</dt>
                        <dd className="text-2xl font-semibold text-gray-900">{loading ? '...' : card.value}</dd>
                      </dl>
                    </div>
                  </div>
                  <div className="mt-4 space-y-2">
                    {card.details.map((detail, idx) => (
                      <div key={idx} className="flex justify-between items-center text-sm">
                        <span className="text-gray-600">{detail.label}:</span>
                        <span className={`font-semibold px-2 py-1 rounded ${getColorClasses(detail.color)}`}>
                          {loading ? '...' : detail.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="w-full px-4 sm:px-6 lg:px-8 mt-8">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {quickActions.map((action, index) => (
              <Link
                key={index}
                to={action.link}
                className={`relative group bg-white p-6 focus-within:ring-2 focus-within:ring-inset focus-within:ring-indigo-500 rounded-lg border-2 hover:border-${action.color}-500 transition-all duration-200`}
              >
                <div>
                  <span className={`rounded-lg inline-flex p-3 ring-4 ring-white ${getColorClasses(action.color)}`}>
                    <action.icon className="h-6 w-6" aria-hidden="true" />
                  </span>
                </div>
                <div className="mt-4">
                  <h3 className="text-lg font-medium">
                    <span className="absolute inset-0" aria-hidden="true" />
                    {action.name}
                  </h3>
                </div>
                <span
                  className="pointer-events-none absolute top-6 right-6 text-gray-300 group-hover:text-gray-400"
                  aria-hidden="true"
                >
                  <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20 4h1a1 1 0 00-1-1v1zm-1 12a1 1 0 102 0h-2zM8 3a1 1 0 000 2V3zM3.293 19.293a1 1 0 101.414 1.414l-1.414-1.414zM19 4v12h2V4h-2zm1-1H8v2h12V3zm-.707.293l-16 16 1.414 1.414 16-16-1.414-1.414z" />
                  </svg>
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* Oil & Gas Industry Metrics */}
        <div className="w-full px-4 sm:px-6 lg:px-8 mt-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-gray-900 flex items-center">
              <ShieldCheckIcon className="h-6 w-6 mr-2 text-[#00a896]" />
              Oil & Gas Industry Metrics
            </h2>
            <span className="text-sm text-gray-500">Real-time compliance tracking</span>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {industryMetrics.map((metric, index) => (
              <div key={index} className="bg-gradient-to-br from-white to-gray-50 overflow-hidden shadow-lg rounded-lg border-2 border-gray-100 hover:border-[#00a896] transition-all duration-200">
                <div className="p-6">
                  <div className="flex items-center justify-between">
                    <div className={`flex-shrink-0 p-3 rounded-lg ${getColorClasses(metric.color)}`}>
                      <metric.icon className="h-7 w-7" />
                    </div>
                    <ArrowTrendingUpIcon className="h-5 w-5 text-green-500" />
                  </div>
                  <div className="mt-4">
                    <h3 className="text-sm font-medium text-gray-600 mb-1">{metric.title}</h3>
                    <p className="text-3xl font-bold text-gray-900">{metric.value}</p>
                    <p className="text-xs text-gray-500 mt-1">{metric.subtitle}</p>
                  </div>
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <p className="text-xs font-medium text-[#00a896]">
                      {metric.trend}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Order Value Summary */}
        <div className="w-full px-4 sm:px-6 lg:px-8 mt-8">
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <ChartBarIcon className="h-6 w-6 mr-2 text-indigo-600" />
              Total Order Value
            </h2>
            <div className="text-4xl font-bold text-indigo-600">
              ${loading ? '...' : (stats.orders?.total_value ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="mt-2 text-sm text-gray-500">
              Across {stats.orders.total} purchase orders
            </p>
          </div>
        </div>
>>>>>>> origin/main
      </div>
    </div>
  );
};

export default ProcurementDashboard;
