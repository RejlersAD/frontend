/* eslint-disable react/prop-types */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowDownTrayIcon, ArrowPathIcon, ArrowTrendingDownIcon,
  BoltIcon, BuildingOffice2Icon, ChartBarIcon, CheckCircleIcon, ChevronRightIcon,
  CurrencyDollarIcon, DocumentTextIcon, ExclamationTriangleIcon,
  LightBulbIcon, MagnifyingGlassIcon, ShieldCheckIcon, ShoppingCartIcon,
  TruckIcon, UserGroupIcon, XMarkIcon,
} from '@heroicons/react/24/outline';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import apiClient from '../../services/api.service';
import { PageControlButtons } from '../../components/Common/PageControlButtons';
import { usePageControls } from '../../hooks/usePageControls';

const EMPTY = {
  requisitions: { total: 0, pending: 0, approved: 0, rejected: 0, draft: 0 },
  orders: { total: 0, draft: 0, sent: 0, acknowledged: 0, completed: 0, total_value: 0 },
  receipts: { total: 0, pending: 0, accepted: 0, rejected: 0, quality_passed: 0, quality_failed: 0 },
  projects: { active_projects: 0, health_breakdown: { green: 0, yellow: 0, red: 0 } },
};
const FIELDS = ['vendor_code', 'name', 'contact_person', 'email', 'phone', 'address', 'country', 'trade_license_number', 'vat_number', 'categories', 'certifications'];
const COLORS = ['#0E7490', '#14B8A6', '#071B2E', '#F59E0B', '#EF4444'];
const num = (v) => Number(v) || 0;
const pct = (v, total) => total > 0 ? Math.round((num(v) / num(total)) * 100) : 0;
const money = (v) => new Intl.NumberFormat('en-AE', { style: 'currency', currency: 'AED', notation: Math.abs(num(v)) >= 1000000 ? 'compact' : 'standard', maximumFractionDigits: Math.abs(num(v)) >= 1000000 ? 1 : 0 }).format(num(v));
const exactMoney = (v) => new Intl.NumberFormat('en-AE', { style: 'currency', currency: 'AED', maximumFractionDigits: 0 }).format(num(v));
const short = (v) => new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(num(v));
const present = (v) => Array.isArray(v) ? v.length > 0 : v !== null && v !== undefined && String(v).trim() !== '';
const completeness = (v = {}) => Math.round(FIELDS.filter((field) => present(v[field])).length / FIELDS.length * 100);
const expired = (date) => date && new Date(date).getTime() < Date.now();
const risk = (v = {}) => {
  let score = 0; const reasons = [];
  if (v.status !== 'active') { score += 32; reasons.push('Inactive approval'); }
  if (num(v.rating) && num(v.rating) <= 2) { score += 25; reasons.push('Low performance'); }
  if (String(v.audit_status || '').toLowerCase().includes('fail')) { score += 30; reasons.push('Audit failed'); }
  if (expired(v.icv_expiry_date)) { score += 24; reasons.push('ICV expired'); }
  if (completeness(v) < 70) { score += 18; reasons.push('Master data gap'); }
  if (!v.adnoc_approved) { score += 8; reasons.push('Not ADNOC approved'); }
  return { score: Math.min(score, 100), reasons };
};

const Tip = ({ active, payload, label }) => active && payload?.length ? <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-xl"><p className="font-bold text-slate-800">{label || payload[0]?.name}</p>{payload.map((p) => <p key={p.dataKey || p.name} style={{ color: p.color }}>{p.name}: <b>{exactMoney(p.value)}</b></p>)}</div> : null;

const KPI_TONES = {
  emerald: { background: '#E7F8F5', foreground: '#0E7490' },
  violet: { background: '#EAF0F4', foreground: '#071B2E' },
  cyan: { background: '#E8F3F6', foreground: '#0E7490' },
  amber: { background: '#FFF5E1', foreground: '#F59E0B' },
  teal: { background: '#E7F8F5', foreground: '#14B8A6' },
  blue: { background: '#E8F3F6', foreground: '#0E7490' },
};
const KpiCard = ({ title, value, note, icon: Icon, color, href }) => {
  const card = <div className="group relative min-h-[178px] overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-lg">
    <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: KPI_TONES[color].background, color: KPI_TONES[color].foreground }}><Icon className="h-5 w-5" strokeWidth={1.8} /></span>
    <p className="mt-4 text-[11px] font-bold uppercase tracking-[.13em] text-slate-500">{title}</p><p className="mt-1.5 truncate tabular-nums text-[#071B2E]" style={{ fontSize: '48px', fontWeight: 800, lineHeight: 1, letterSpacing: '-0.05em' }}>{value}</p>
    <p className="mt-2 truncate text-[11px] font-medium text-slate-400">{note}</p>{href && <ChevronRightIcon className="absolute right-5 top-5 h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5" />}
  </div>;
  return href ? <Link to={href}>{card}</Link> : card;
};
const FunnelCard = ({ title, value, tone, icon: Icon, progress }) => <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className={`absolute inset-x-0 top-0 h-1 ${tone}`} /><div className="flex items-center justify-between"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50" style={{ color: '#071B2E' }}><Icon className="h-5 w-5" strokeWidth={1.8} /></span><span className="text-[10px] font-bold text-slate-400">{progress}%</span></div><p className="mt-4 text-3xl font-bold tracking-tight text-slate-950">{value}</p><p className="mt-1 text-xs font-semibold text-slate-500">{title}</p><div className="mt-3 h-1 rounded-full bg-slate-100"><div className={`h-full rounded-full ${tone}`} style={{ width: `${progress}%` }} /></div></div>;
const ActionTile = ({ icon: Icon, title, value, href }) => <Link to={href} className="group flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[.06] p-4 transition hover:-translate-y-0.5 hover:bg-white/[.1]"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10" style={{ color: '#14B8A6' }}><Icon className="h-5 w-5" strokeWidth={1.8} /></span><div><p className="text-2xl font-bold text-white">{value}</p><p className="text-xs text-slate-300">{title}</p></div></Link>;

export default function ProcurementDashboard() {
  const [stats, setStats] = useState(EMPTY);
  const [vendors, setVendors] = useState([]);
  const [topVendors, setTopVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updated, setUpdated] = useState(null);
  const controls = usePageControls({ autoRefreshInterval: 30, features: { autoRefresh: true, fullscreen: true, sidebar: true } });

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null);
    const results = await Promise.allSettled([
      apiClient.get('/procurement/requisitions/dashboard/').then((r) => r.data),
      apiClient.get('/procurement/orders/dashboard/').then((r) => r.data),
      apiClient.get('/procurement/receipts/dashboard/').then((r) => r.data),
      apiClient.get('/procurement/vendors/', { params: { page_size: 1000 } }).then((r) => r.data),
      apiClient.get('/procurement/projects/dashboard_stats/').then((r) => r.data),
    ]);
    const val = (i, fallback) => results[i].status === 'fulfilled' ? results[i].value : fallback;
    const pr = val(0, { totals: {} }); const po = val(1, { totals: {}, top_vendors: [] });
    const gr = val(2, { totals: {} }); const vd = val(3, { results: [] }); const projects = val(4, EMPTY.projects);
    setStats({ requisitions: { ...EMPTY.requisitions, ...(pr.totals || {}) }, orders: { ...EMPTY.orders, ...(po.totals || {}) }, receipts: { ...EMPTY.receipts, ...(gr.totals || {}) }, projects: { ...EMPTY.projects, ...projects } });
    setVendors(Array.isArray(vd) ? vd : (vd.results || [])); setTopVendors(Array.isArray(po.top_vendors) ? po.top_vendors : []);
    const failed = results.filter((r) => r.status === 'rejected').length;
    if (failed) setError(`${failed} source${failed > 1 ? 's are' : ' is'} unavailable. Connected metrics are still shown.`);
    setUpdated(new Date()); setLoading(false);
  }, []);
  useEffect(() => { fetchData(); }, [fetchData, controls.isRefreshing]);

  const intel = useMemo(() => {
    const spend = num(stats.orders.total_value); const active = vendors.filter((v) => v.status === 'active').length;
    const rated = vendors.filter((v) => num(v.rating)); const avgRating = rated.length ? rated.reduce((s, v) => s + num(v.rating), 0) / rated.length : 0;
    const risks = vendors.map((v) => ({ ...v, ...risk(v) })).sort((a, b) => b.score - a.score); const atRisk = risks.filter((v) => v.score >= 30);
    const inspections = num(stats.receipts.quality_passed) + num(stats.receipts.quality_failed);
    const approval = pct(stats.requisitions.approved, stats.requisitions.total); const completion = pct(stats.orders.completed, stats.orders.total); const acceptance = pct(stats.receipts.accepted, stats.receipts.total);
    const concentration = pct(topVendors[0]?.total, spend); const savingsRate = spend ? Math.min(5.5, 2.4 + concentration / 20) : 0;
    const health = stats.projects.health_breakdown || {}; const masterComplete = vendors.length ? Math.round(vendors.reduce((s, v) => s + completeness(v), 0) / vendors.length) : 0;
    return { spend, active, avgRating, risks, atRisk, approval, completion, acceptance, quality: pct(stats.receipts.quality_passed, inspections), efficiency: Math.round((approval + completion + acceptance) / 3), concentration, savingsRate, savings: spend * savingsRate / 100, openShare: pct(num(stats.orders.sent) + num(stats.orders.acknowledged), stats.orders.total), actions: num(stats.requisitions.pending) + num(stats.orders.draft) + num(stats.receipts.pending) + atRisk.length, projectRisk: num(health.red) + num(health.yellow), masterComplete };
  }, [stats, vendors, topVendors]);

  const spendData = useMemo(() => topVendors.slice(0, 5).map((v, i) => ({ name: (v['vendor__name'] || 'Unassigned').slice(0, 18), full: v['vendor__name'] || 'Unassigned supplier', spend: num(v.total), color: COLORS[i] })), [topVendors]);
  const exportBrief = () => {
    const rows = [['Procurement Executive Brief', new Date().toISOString()], ['Committed spend (AED)', intel.spend], ['Active PO share', `${intel.openShare}%`], ['Modeled savings opportunity (AED)', Math.round(intel.savings)], ['Approved suppliers', intel.active], ['Suppliers at risk', intel.atRisk.length], ['Procurement efficiency', `${intel.efficiency}%`], ['Pending actions', intel.actions]];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(',')).join('\n'); const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); const a = document.createElement('a'); a.href = url; a.download = `procurement-executive-brief-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(url);
  };
  const riskTone = (score) => score >= 60 ? 'bg-[#EF4444]/10 text-[#EF4444]' : score >= 30 ? 'bg-[#F59E0B]/10 text-[#B45309]' : 'bg-[#14B8A6]/10 text-[#0E7490]';

  const conceptLayout = <div className="min-h-screen bg-[#F8FAFC] text-slate-900" style={{ ...controls.styles.container, fontFamily: 'Inter, "Segoe UI Variable", "Segoe UI", system-ui, sans-serif' }}>
    <div className="pb-10" style={controls.styles.content}>
      <header className="border-b border-slate-200 bg-white/95 backdrop-blur-xl">
        <div className="flex flex-col gap-4 px-6 py-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-3"><span className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl text-white" style={{ backgroundColor: '#071B2E' }}><ChartBarIcon className="h-5 w-5" strokeWidth={1.8} /><span className="absolute bottom-0 right-0 h-3 w-3 rounded-tl-lg" style={{ backgroundColor: '#14B8A6' }} /></span><div><div className="flex items-center gap-2"><p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#0E7490]">RADAI Procurement</p><span className="rounded-full bg-[#14B8A6]/10 px-2 py-0.5 text-[9px] font-bold text-[#0E7490]"><span className={`mr-1 inline-block h-1.5 w-1.5 rounded-full ${error ? 'bg-[#F59E0B]' : 'bg-[#14B8A6]'}`} />{error ? 'Partial' : 'Live'}</span></div><h1 className="mt-0.5 text-2xl font-bold tracking-[-.025em] text-slate-950">Procurement Command Center</h1><p className="mt-0.5 text-xs text-slate-500">Executive spend, supplier, value and risk intelligence</p></div></div>
          <div className="flex flex-wrap items-center gap-2"><span className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-medium text-slate-500">Current portfolio · AED · {updated ? updated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Connecting'}</span><div className="rounded-xl border border-slate-200 bg-white"><PageControlButtons isFullscreen={controls.isFullscreen} toggleFullscreen={controls.toggleFullscreen} sidebarVisible={controls.sidebarVisible} toggleSidebar={controls.toggleSidebar} autoRefreshEnabled={controls.autoRefreshEnabled} toggleAutoRefresh={controls.toggleAutoRefresh} isRefreshing={controls.isRefreshing} manualRefresh={controls.manualRefresh} /></div><button type="button" onClick={exportBrief} className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"><ArrowDownTrayIcon className="h-4 w-4" strokeWidth={1.8} />Export</button><Link to="/procurement/requisitions/new" className="inline-flex h-9 items-center gap-2 rounded-xl px-3.5 text-xs font-bold text-white hover:opacity-90" style={{ backgroundColor: '#14B8A6' }}><DocumentTextIcon className="h-4 w-4" strokeWidth={1.8} />New requisition</Link></div>
        </div>
      </header>

      <main className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        {error && <div className="flex items-center gap-3 rounded-2xl border border-[#F59E0B]/30 bg-[#F59E0B]/10 px-4 py-3 text-xs text-[#92400E]"><ExclamationTriangleIcon className="h-4 w-4 text-[#F59E0B]" /><p className="flex-1">{error}</p><button type="button" onClick={fetchData}><ArrowPathIcon className="h-4 w-4" /></button><button type="button" onClick={() => setError(null)}><XMarkIcon className="h-4 w-4" /></button></div>}

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          <KpiCard title="Total spend" value={loading ? '—' : money(intel.spend)} note="Committed PO value" icon={CurrencyDollarIcon} color="emerald" href="/procurement/orders" />
          <KpiCard title="Savings pipeline" value={loading ? '—' : money(intel.savings)} note={`${intel.savingsRate.toFixed(1)}% modeled opportunity`} icon={ArrowTrendingDownIcon} color="violet" />
          <KpiCard title="Active suppliers" value={loading ? '—' : intel.active} note={`${vendors.length} total suppliers`} icon={BuildingOffice2Icon} color="cyan" href="/procurement/vendors" />
          <KpiCard title="Risk suppliers" value={loading ? '—' : intel.atRisk.length} note={`${intel.projectRisk} projects on watch`} icon={ShieldCheckIcon} color="amber" href="/procurement/vendors" />
          <KpiCard title="Flow efficiency" value={loading ? '—' : `${intel.efficiency}%`} note="Request-to-receipt index" icon={BoltIcon} color="teal" />
          <KpiCard title="PO portfolio" value={loading ? '—' : stats.orders.total} note={`${num(stats.orders.sent) + num(stats.orders.acknowledged)} active orders`} icon={ShoppingCartIcon} color="blue" href="/procurement/orders" />
        </section>

        <section>
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 px-6 pb-2 pt-6"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#0E7490]">Spend intelligence</p><h2 className="mt-1 text-lg font-bold tracking-tight text-slate-950">Top supplier concentration</h2><p className="mt-1 text-xs text-slate-500">Committed purchase-order value across leading suppliers</p></div><Link to="/procurement/orders" className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:border-[#14B8A6] hover:text-[#0E7490]">Explore spend <ChevronRightIcon className="h-4 w-4" /></Link></div>
            <div className="h-[330px] px-4 pb-5 pt-3"><ResponsiveContainer width="100%" height="100%"><BarChart data={spendData.length ? spendData : [{ name: 'No committed spend', spend: 0, color: '#cbd5e1' }]} margin={{ top: 10, right: 18, left: 8, bottom: 30 }}><defs><linearGradient id="spendBarPrimary" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#14B8A6" /><stop offset="100%" stopColor="#0E7490" /></linearGradient></defs><CartesianGrid stroke="#edf1f5" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} interval={0} angle={-16} textAnchor="end" /><YAxis tickFormatter={short} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} /><Tooltip content={<Tip />} /><Bar dataKey="spend" name="Committed spend" radius={[8, 8, 2, 2]} maxBarSize={58}>{(spendData.length ? spendData : [{ color: '#cbd5e1' }]).map((entry, index) => <Cell key={entry.name || index} fill={index === 0 ? 'url(#spendBarPrimary)' : entry.color} />)}</Bar></BarChart></ResponsiveContainer></div>
            <div className="grid grid-cols-3 border-t border-slate-100 bg-slate-50/70 px-6 py-4 text-center"><div><p className="text-lg font-bold text-slate-950">{intel.concentration}%</p><p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Top supplier share</p></div><div className="border-x border-slate-200"><p className="text-lg font-bold text-slate-950">{spendData.length}</p><p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Leading suppliers</p></div><div><p className={`text-lg font-bold ${intel.concentration >= 35 ? 'text-[#F59E0B]' : 'text-[#14B8A6]'}`}>{intel.concentration >= 35 ? 'Review' : 'Balanced'}</p><p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Concentration</p></div></div>
          </div>

        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#0E7490]">Process performance</p><h2 className="mt-1 text-lg font-bold text-slate-950">Procurement funnel</h2><p className="mt-1 text-xs text-slate-500">Request-to-receipt portfolio conversion</p></div><span className="rounded-full bg-[#14B8A6]/10 px-3 py-1.5 text-xs font-bold text-[#0E7490]">{intel.efficiency}% flow efficiency</span></div><div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><FunnelCard title="Requisitions" value={stats.requisitions.total} icon={DocumentTextIcon} tone="bg-[#071B2E]" progress={100} /><FunnelCard title="Approved" value={stats.requisitions.approved} icon={CheckCircleIcon} tone="bg-[#0E7490]" progress={intel.approval} /><FunnelCard title="Purchase orders" value={stats.orders.total} icon={ShoppingCartIcon} tone="bg-[#14B8A6]" progress={intel.completion} /><FunnelCard title="Receipts" value={stats.receipts.accepted} icon={TruckIcon} tone="bg-[#14B8A6]" progress={intel.acceptance} /></div></section>

        <section className="grid gap-6 xl:grid-cols-2">
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-100 p-6"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#F59E0B]">Supplier intelligence</p><h2 className="mt-1 text-lg font-bold">Supplier risk watchlist</h2></div><Link to="/procurement/vendors" className="text-xs font-semibold text-[#0E7490]">Supplier 360° →</Link></div><div className="divide-y divide-slate-100">{intel.risks.slice(0, 5).map((vendor) => <Link to="/procurement/vendors" key={vendor.id || vendor.name} className="flex items-center justify-between gap-4 px-6 py-3.5 transition hover:bg-slate-50"><div className="flex min-w-0 items-center gap-3"><span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-slate-100 text-[10px] font-bold text-slate-600">{String(vendor.name || 'S').split(' ').slice(0, 2).map((part) => part[0]).join('').toUpperCase()}</span><div className="min-w-0"><p className="truncate text-xs font-semibold text-slate-900">{vendor.name || 'Unnamed supplier'}</p><p className="mt-0.5 truncate text-[10px] text-slate-500">{vendor.reasons[0] || 'No material risk signal'}</p></div></div><span className={`rounded-full px-3 py-1 text-xs font-bold ${riskTone(vendor.score)}`}>{vendor.score}</span></Link>)}{!vendors.length && <div className="flex h-48 flex-col items-center justify-center text-slate-400"><UserGroupIcon className="h-9 w-9" /><p className="mt-2 text-xs">No supplier intelligence available</p></div>}</div></div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#0E7490]">Value realization</p><h2 className="mt-1 text-lg font-bold">Procurement value creation</h2><p className="mt-1 text-xs text-slate-500">Separate verified value from modeled opportunity</p></div><div className="mt-6 grid gap-4 sm:grid-cols-3"><div className="rounded-2xl border border-[#14B8A6]/20 bg-[#14B8A6]/10 p-4"><p className="text-[10px] font-bold uppercase tracking-wide text-[#0E7490]">Realized</p><p className="mt-3 text-2xl font-bold text-slate-950">—</p><p className="mt-2 text-[10px] leading-4 text-[#0E7490]/70">No verified savings ledger connected</p></div><div className="rounded-2xl border border-[#0E7490]/20 bg-[#0E7490]/10 p-4"><p className="text-[10px] font-bold uppercase tracking-wide text-[#0E7490]">Pipeline</p><p className="mt-3 text-2xl font-bold text-slate-950">{money(intel.savings)}</p><p className="mt-2 text-[10px] leading-4 text-[#0E7490]/70">AI-modeled sourcing opportunity</p></div><div className="rounded-2xl border border-[#071B2E]/15 bg-[#071B2E]/5 p-4"><p className="text-[10px] font-bold uppercase tracking-wide text-[#071B2E]">Avoided cost</p><p className="mt-3 text-2xl font-bold text-slate-950">—</p><p className="mt-2 text-[10px] leading-4 text-[#071B2E]/60">Awaiting verified cost baseline</p></div></div><div className="mt-6 rounded-2xl border border-slate-100 bg-slate-50 p-4"><div className="flex items-start gap-3"><span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-white text-[#F59E0B]"><LightBulbIcon className="h-5 w-5" strokeWidth={1.8} /></span><div><p className="text-xs font-bold text-slate-800">Value governance</p><p className="mt-1 text-[11px] leading-5 text-slate-500">Modeled opportunity is based on committed spend and supplier concentration. Validate and approve value before moving it to realized.</p></div></div></div></div>
        </section>

        <section className="relative overflow-hidden rounded-3xl p-6 text-white" style={{ backgroundColor: '#071B2E' }}><div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)', backgroundSize: '28px 28px' }} /><div className="relative"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#14B8A6]">Decision workspace</p><h2 className="mt-1 text-xl font-bold text-white">Executive Action Center</h2><p className="mt-1 text-xs text-slate-300">High-priority procurement actions requiring intervention</p></div><div className="text-right"><p className="text-4xl font-black text-[#14B8A6]">{intel.actions}</p><p className="text-[9px] font-bold uppercase tracking-wide text-slate-300">Open actions</p></div></div><div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><ActionTile icon={DocumentTextIcon} title="Approvals" value={stats.requisitions.pending} href="/procurement/requisitions" /><ActionTile icon={ShoppingCartIcon} title="Draft orders" value={stats.orders.draft} href="/procurement/orders" /><ActionTile icon={MagnifyingGlassIcon} title="Inspections" value={stats.receipts.pending} href="/procurement/receipts" /><ActionTile icon={ShieldCheckIcon} title="Risk alerts" value={intel.atRisk.length} href="/procurement/vendors" /></div></div></section>
      </main>
    </div>
  </div>;

  return conceptLayout;
}
