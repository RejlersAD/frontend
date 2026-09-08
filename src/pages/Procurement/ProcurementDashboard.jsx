/* eslint-disable react/prop-types */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownTrayIcon, ArrowPathIcon, CheckCircleIcon, ChevronDownIcon, ChevronRightIcon, ClockIcon, DocumentTextIcon, ExclamationTriangleIcon, InformationCircleIcon, LockClosedIcon, PlusIcon, ShoppingCartIcon, TruckIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import apiClient from '../../services/api.service';

const EMPTY = { definition_version: '2026.1', generated_at: null, as_of_date: null, scope: {}, terminology: {}, metrics: { approved_requisition_value: [], po_commitment: [], invoiced_value: [], paid_value: [], counts: {}, cycle_time: {} }, actions: [], supplier_spend: [], purchasing_flow: {}, recent_decisions: [], supplier_watch: [], data_quality: { limitations: [] } };
const CONTROL = 'h-9 w-full rounded border border-[#D9DEE5] bg-white px-2.5 text-[13px] leading-[18px] text-[#323A46] outline-none focus:border-[#0F6CBD] focus:ring-2 focus:ring-[#0F6CBD]';
const BUTTON = 'inline-flex h-9 items-center justify-center gap-1.5 rounded border border-[#D9DEE5] bg-white px-3 text-[13px] leading-[18px] font-semibold text-[#242B38] hover:bg-[#F1F4F7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0F6CBD] disabled:cursor-not-allowed disabled:text-[#9CA3AF]';
const LINK = 'inline-flex items-center gap-1 text-[13px] leading-[18px] font-medium text-[#0F6CBD] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0F6CBD]';

const money = (value, currency = 'AED') => new Intl.NumberFormat('en-AE', { style: 'currency', currency, notation: Math.abs(Number(value || 0)) >= 1000000 ? 'compact' : 'standard', maximumFractionDigits: Math.abs(Number(value || 0)) >= 1000000 ? 1 : 0 }).format(Number(value || 0));
const formatDate = (value, includeTime = false) => value ? new Intl.DateTimeFormat('en-GB', includeTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' }).format(new Date(value)) : 'Not available';
const ageText = (rows) => { const oldest = Math.max(...rows.map((row) => Number(row.age_days || 0)), 0); return rows.length ? `Oldest ${oldest} day${oldest === 1 ? '' : 's'}` : 'No items waiting'; };
const requestProblem = (error, operation = 'load the dashboard') => {
  const status = error.response?.status; const detail = error.response?.data?.detail;
  if (!error.response) return `Cannot ${operation}: the browser cannot reach the backend service. Check that the local backend is running.`;
  if (status === 404) return `Cannot ${operation}: the running backend has not registered the governed Procurement API. Restart the backend to load the current routes.`;
  if (status === 401) return `Cannot ${operation}: your session has expired or no authentication token was supplied. Sign in again.`;
  if (status === 403) return `Cannot ${operation}: your account does not have Procurement dashboard access.`;
  if (status >= 500) return `Cannot ${operation}: the backend failed while calculating controlled Procurement data.${typeof detail === 'string' ? ` ${detail}` : ''}`;
  return typeof detail === 'string' ? detail : `Cannot ${operation}: the server returned HTTP ${status}.`;
};

function Panel({ title, subtitle, action, children, className = '', label }) {
  return <section className={`rounded-md border border-[#D9DEE5] bg-white shadow-[0_1px_2px_rgba(23,32,51,0.04)] ${className}`} aria-label={label || title}><div className="flex min-h-[54px] items-start justify-between gap-3 px-3 py-2"><div><h2 className="text-[16px] leading-6 font-semibold text-[#242B38]">{title}</h2>{subtitle && <p className="text-[12px] leading-4 font-normal text-[#6B7280]">{subtitle}</p>}</div>{action}</div>{children}</section>;
}

function Signal({ label, value, context, icon: Icon, tone = 'blue', action, badge }) {
  const tones = { blue: 'bg-[#EAF3FC] text-[#0F6CBD]', amber: 'bg-[#FFF4CE] text-[#8A5700]', green: 'bg-[#DFF6DD] text-[#107C41]' };
  return <article className="flex min-h-[88px] items-start gap-3 rounded-md border border-[#D9DEE5] bg-white px-3 py-2.5 shadow-[0_1px_2px_rgba(23,32,51,0.04)]"><span className={`grid h-9 w-9 flex-none place-items-center rounded-md ${tones[tone]}`} aria-hidden="true"><Icon className="h-5 w-5" /></span><div className="min-w-0 flex-1"><p className="text-[12px] leading-4 font-medium text-[#616B7A]">{label}</p><div className="mt-0.5 flex flex-wrap items-center gap-2"><p className="text-[22px] leading-7 font-bold tabular-nums text-[#172033]">{value}</p>{badge}</div><p className="text-[12px] leading-4 font-normal text-[#6B7280]">{context}</p></div>{action}</article>;
}

function ScopeField({ label, children }) { return <label><span className="mb-1 block text-[12px] leading-4 font-medium text-[#616B7A]">{label}</span>{children}</label>; }
function TableButton({ to, children }) { return <Link to={to} className="inline-flex min-w-[64px] justify-center rounded border border-[#0F6CBD] px-2 py-0.5 text-[13px] leading-[18px] font-semibold text-[#0F6CBD] hover:bg-[#EAF3FC]">{children}</Link>; }

export default function ProcurementDashboard() {
  const initial = { scope: 'portfolio', project: '', department: '', period_start: '', period_end: '', currency: '' };
  const [report, setReport] = useState(EMPTY); const [projects, setProjects] = useState([]); const [filters, setFilters] = useState(initial); const [applied, setApplied] = useState(initial); const [scopeOpen, setScopeOpen] = useState(false); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [snapshotStatus, setSnapshotStatus] = useState('');
  useEffect(() => { apiClient.get('/projects/', { params: { page_size: 250, ordering: 'code' } }).then(({ data }) => setProjects(Array.isArray(data) ? data : data.results || [])).catch(() => setProjects([])); }, []);
  const load = useCallback(async () => { setLoading(true); setError(''); try { const params = Object.fromEntries(Object.entries(applied).filter(([, value]) => value)); const { data } = await apiClient.get('/procurement/governance/dashboard/', { params }); setReport(data); } catch (requestError) { setError(requestProblem(requestError)); } finally { setLoading(false); } }, [applied]);
  useEffect(() => { load(); }, [load]);

  const counts = report.metrics.counts || {}; const cycle = report.metrics.cycle_time || {};
  const myApprovals = report.actions.filter((row) => row.owner === 'You' && ['pr_approval', 'po_approval'].includes(row.type));
  const draftActions = report.actions.filter((row) => row.type === 'draft_purchase_order'); const staleDrafts = draftActions.filter((row) => Number(row.age_days || 0) > 7);
  const spendGroup = useMemo(() => report.supplier_spend.find((row) => row.currency === applied.currency) || report.supplier_spend[0] || { currency: applied.currency || 'AED', suppliers: [] }, [applied.currency, report.supplier_spend]);
  const maxSpend = Math.max(...spendGroup.suppliers.map((row) => Number(row.amount)), 0); const flow = report.purchasing_flow || {};
  const scopeText = applied.scope === 'project' ? projects.find((item) => String(item.id) === applied.project)?.code || 'Selected project' : applied.scope === 'department' ? applied.department || 'My department' : applied.scope === 'my_projects' ? 'My projects' : 'Current portfolio';
  const displayCurrency = 'AED';
  const commitmentAed = report.metrics.po_commitment_aed;
  const commitmentContext = !commitmentAed
    ? 'No issued PO value in this scope'
    : commitmentAed.conversion_complete
      ? `Converted to AED · ${commitmentAed.conversions?.map((row) => `${row.currency} × ${row.rate}`).join(' · ')}`
      : `Total blocked · missing FX rate for ${commitmentAed.missing_currencies?.join(', ')}`;
  const exceptionSummaries = [
    { icon: DocumentTextIcon, title: `${myApprovals.length} approval${myApprovals.length === 1 ? '' : 's'} awaiting decision`, detail: `${ageText(myApprovals)} · Owner: You`, to: '/approvals', action: 'Review approvals' },
    { icon: ShoppingCartIcon, title: `${counts.draft_purchase_orders || 0} draft purchase order${counts.draft_purchase_orders === 1 ? '' : 's'}`, detail: `${staleDrafts.length} older than 7 days · Owner: Various`, to: '/procurement/orders?status=draft', action: 'Review drafts' },
    { icon: UserGroupIcon, title: `${counts.supplier_watch || 0} supplier record${counts.supplier_watch === 1 ? '' : 's'} missing required data`, detail: 'Required master-data or compliance fields · Owner: Procurement Data Team', to: '/procurement/vendors', action: 'Review suppliers' },
  ];

  const createSnapshot = async () => { setSnapshotStatus('Creating snapshot…'); try { const payload = Object.fromEntries(Object.entries(applied).filter(([, value]) => value)); const { data } = await apiClient.post('/procurement/governance/snapshots/', payload); setSnapshotStatus(`Locked ${data.id.slice(0, 8)} · ${data.checksum.slice(0, 10)}…`); } catch (requestError) { setSnapshotStatus(requestProblem(requestError, 'create the reporting snapshot')); } };
  const exportReport = () => { const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `procurement-report-${report.as_of_date || 'current'}.json`; anchor.click(); URL.revokeObjectURL(url); };

  return <main className="procurement-overview min-h-screen bg-[#F5F6F8] text-[#323A46]">
    <header className="border-b border-[#D9DEE5] bg-white px-4 py-2.5 sm:px-5">
      <div className="mt-0.5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div><h1 className="text-[24px] leading-8 font-semibold text-[#172033]">Procurement Overview</h1><p className="text-[14px] leading-5 font-normal text-[#616B7A]">Monitor spend, approvals and purchasing activity</p></div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative"><button type="button" onClick={() => setScopeOpen((open) => !open)} className={BUTTON} aria-expanded={scopeOpen} aria-controls="procurement-reporting-scope">{scopeText} · {displayCurrency}<ChevronDownIcon className="h-3.5 w-3.5" /></button>
            {scopeOpen && <form id="procurement-reporting-scope" aria-label="Dashboard reporting scope" onSubmit={(event) => { event.preventDefault(); setApplied({ ...filters }); setScopeOpen(false); }} className="absolute right-0 top-11 z-40 w-[min(540px,calc(100vw-2rem))] rounded-md border border-[#D9DEE5] bg-white p-4 shadow-lg">
              <h2 className="text-[16px] leading-6 font-semibold text-[#242B38]">Reporting scope</h2><p className="mb-3 text-[12px] leading-4 font-normal text-[#6B7280]">Apply organisational scope, reporting period and currency rules.</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <ScopeField label="Scope"><select className={CONTROL} value={filters.scope} onChange={(event) => setFilters({ ...filters, scope: event.target.value, project: '', department: '' })}><option value="portfolio">Authorised portfolio</option><option value="my_projects">My enterprise projects</option><option value="project">One enterprise project</option><option value="department">Department</option></select></ScopeField>
                {filters.scope === 'project' && <ScopeField label="Enterprise project"><select required className={CONTROL} value={filters.project} onChange={(event) => setFilters({ ...filters, project: event.target.value })}><option value="">Select project</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.code} — {project.name}</option>)}</select></ScopeField>}
                {filters.scope === 'department' && <ScopeField label="Department"><input className={CONTROL} value={filters.department} placeholder="My department" onChange={(event) => setFilters({ ...filters, department: event.target.value })} /></ScopeField>}
                <ScopeField label="From"><input type="date" className={CONTROL} value={filters.period_start} onChange={(event) => setFilters({ ...filters, period_start: event.target.value })} /></ScopeField>
                <ScopeField label="To"><input type="date" className={CONTROL} value={filters.period_end} onChange={(event) => setFilters({ ...filters, period_end: event.target.value })} /></ScopeField>
                <ScopeField label="Reporting currency"><input className={`${CONTROL} bg-[#FAFAFB]`} value="AED" readOnly /></ScopeField>
              </div><div className="mt-4 flex justify-end gap-2"><button type="button" onClick={() => setScopeOpen(false)} className={BUTTON}>Cancel</button><button className="inline-flex h-9 items-center rounded bg-[#0F6CBD] px-4 text-[13px] leading-[18px] font-semibold text-white hover:bg-[#0C5A9E]">Apply scope</button></div>
            </form>}
          </div>
          <span className="border-l border-[#E8EBEF] px-3 text-[12px] leading-4 font-normal text-[#6B7280]">Last updated<br /><span className="text-[#0F6CBD]">{formatDate(report.generated_at, true)}</span></span>
          <button type="button" onClick={load} className={BUTTON} aria-label="Refresh procurement overview"><ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh</button>
          <button type="button" onClick={exportReport} disabled={!report.generated_at} className={BUTTON}><ArrowDownTrayIcon className="h-4 w-4" />Export<ChevronDownIcon className="h-3 w-3" /></button>
          <Link to="/procurement/requisitions/new" className="inline-flex h-9 items-center gap-1.5 rounded bg-[#D83B01] px-4 text-[13px] leading-[18px] font-semibold text-white hover:bg-[#B83200] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0F6CBD]"><PlusIcon className="h-4 w-4" />New requisition</Link>
        </div>
      </div>
    </header>

    <div className="space-y-2.5 p-3 sm:px-4">
      {error && <div role="alert" className="flex gap-2 rounded-md border border-[#C42B1C] bg-[#FDE7E9] p-3 text-[14px] leading-5 font-normal text-[#C42B1C]"><ExclamationTriangleIcon className="h-5 w-5 flex-none" />{error}</div>}
      <section className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4" aria-label="Key procurement signals">
        <Signal label="Committed spend" value={commitmentAed?.amount ? money(commitmentAed.amount, 'AED') : '—'} context={commitmentContext} icon={ShoppingCartIcon} />
        <Signal label="Pending approvals" value={counts.pending_approvals || 0} context="Portfolio decisions awaiting action" icon={ClockIcon} tone="amber" action={<TableButton to="/approvals">Review</TableButton>} />
        <Signal label="Purchase orders" value={counts.purchase_orders || 0} context={`${counts.draft_purchase_orders || 0} draft · ${(counts.purchase_orders || 0) - (counts.draft_purchase_orders || 0)} issued or completed`} icon={DocumentTextIcon} action={<TableButton to="/procurement/orders">View</TableButton>} />
        <Signal label="Delivery reliability" value={cycle.on_time_delivery_percent == null ? 'Not calculable' : `${cycle.on_time_delivery_percent}%`} context={cycle.on_time_delivery_percent == null ? `${cycle.on_time_delivery_population || 0} of ${cycle.completed_order_population || 0} completed POs have both dates` : `${cycle.on_time_delivery_numerator} of ${cycle.on_time_delivery_population} eligible POs delivered on time`} icon={CheckCircleIcon} tone="green" badge={cycle.on_time_delivery_percent != null && <span className={`rounded px-2 py-0.5 text-[11px] leading-[14px] font-semibold ${cycle.on_time_delivery_percent >= 80 ? 'bg-[#DFF6DD] text-[#107C41]' : 'bg-[#FFF4CE] text-[#8A5700]'}`}>{cycle.on_time_delivery_percent >= 80 ? 'On track' : 'Needs improvement'}</span>} />
      </section>

      <section className="overflow-hidden rounded-md border border-[#E0B300] bg-white shadow-[0_1px_2px_rgba(23,32,51,0.04)]" aria-labelledby="action-required-title">
        <div className="flex items-center gap-3 border-b border-[#E8EBEF] bg-[#FFF9E8] px-3 py-2"><span className="grid h-8 w-8 place-items-center rounded bg-[#FFF4CE] text-[#8A5700]" aria-hidden="true"><ExclamationTriangleIcon className="h-5 w-5" /></span><div><h2 id="action-required-title" className="text-[16px] leading-6 font-semibold text-[#242B38]">Action required</h2><p className="text-[12px] leading-4 font-normal text-[#6B7280]">Keep procurement moving. These items need your attention.</p></div></div>
        <div className="divide-y divide-[#E8EBEF] px-3">{exceptionSummaries.map((row) => <div key={row.action} className="grid gap-2 py-1.5 sm:grid-cols-[minmax(260px,1fr)_minmax(280px,1fr)_130px] sm:items-center"><div className="flex items-center gap-3"><row.icon className="h-4 w-4 flex-none text-[#323A46]" aria-hidden="true" /><span className="text-[14px] leading-5 font-semibold text-[#242B38]">{row.title}</span></div><span className="text-[12px] leading-4 font-normal text-[#6B7280]">{row.detail}</span><TableButton to={row.to}>{row.action}</TableButton></div>)}</div>
      </section>

      <div className="grid gap-2.5 xl:grid-cols-2">
        <Panel title="Spend by supplier" subtitle={`Top suppliers by committed spend · ${spendGroup.currency}`} action={<Link to="/procurement/orders" className={LINK}>View spend details <ChevronRightIcon className="h-4 w-4" /></Link>}>
          <ol className="space-y-2 px-3 pb-3">{spendGroup.suppliers.slice(0, 5).map((supplier, index) => <li key={supplier.supplier_id || supplier.supplier} className="grid grid-cols-[18px_minmax(125px,200px)_1fr_auto] items-center gap-2 text-[12px] leading-4 font-normal text-[#323A46]"><span>{index + 1}.</span><span className="truncate" title={supplier.supplier}>{supplier.supplier}</span><span className="h-3 overflow-hidden bg-[#EDF1F5]"><span className="block h-full bg-[#1683E6]" style={{ width: `${maxSpend ? Number(supplier.amount) / maxSpend * 100 : 0}%` }} /></span><span className="text-[13px] leading-[18px] font-semibold tabular-nums text-[#242B38]">{money(supplier.amount, spendGroup.currency)}</span></li>)}{!spendGroup.suppliers.length && <li className="py-7 text-center text-[14px] leading-5 font-normal text-[#6B7280]">No issued PO commitments for this scope.</li>}</ol>
          <div className="mx-3 mb-3 flex flex-wrap justify-between gap-2 rounded border border-[#D6E8F8] bg-[#EAF3FC] px-2.5 py-1.5 text-[12px] leading-4 font-normal text-[#0F6CBD]"><span><InformationCircleIcon className="mr-1 inline h-4 w-4" />Values are ranked within one currency only.</span><span className="text-[#616B7A]">Reporting period: {applied.period_start || 'All'} – {applied.period_end || report.as_of_date || 'current'}</span></div>
        </Panel>
        <Panel title="Purchasing flow" subtitle="From requisition to receipt" action={<Link to="/procurement/requisitions" className={LINK}>View workflow <ChevronRightIcon className="h-4 w-4" /></Link>}>
          <div className="space-y-1.5 px-3 pb-2">{[
            ['Requisitions', 'Purchase requests raised', flow.requisitions, DocumentTextIcon, 'bg-[#EAF3FC] text-[#0F6CBD]'],
            ['Approved', 'Requisitions approved for ordering', flow.approved_requisitions, CheckCircleIcon, 'bg-[#DFF6DD] text-[#107C41]'],
            ['Purchase orders', 'Orders created in this scope', flow.purchase_orders, ShoppingCartIcon, 'bg-[#EAF3FC] text-[#0F6CBD]'],
            ['Receipts', 'Goods and services accepted', flow.accepted_receipts, TruckIcon, 'bg-[#F3E8FF] text-[#6B21A8]'],
          ].map(([label, detail, value, Icon, tone]) => <div key={label} className="flex min-h-[42px] items-center gap-3 rounded border border-[#E8EBEF] px-2.5 py-1"><span className={`grid h-8 w-8 place-items-center rounded ${tone}`} aria-hidden="true"><Icon className="h-4 w-4" /></span><div className="flex-1"><p className="text-[12px] leading-4 font-medium text-[#323A46]">{label}</p><p className="text-[12px] leading-4 font-normal text-[#6B7280]">{detail}</p></div><span className="text-[18px] leading-6 font-semibold tabular-nums text-[#172033]">{value || 0}</span></div>)}</div>
          <div className="mx-3 mb-3 rounded border border-[#D6E8F8] bg-[#EAF3FC] px-2.5 py-1.5 text-[12px] leading-4 font-normal text-[#0F6CBD]"><InformationCircleIcon className="mr-1 inline h-4 w-4" />Stage counts may cover different document cohorts and reporting periods.</div>
        </Panel>
      </div>

      <div className="grid gap-2.5 xl:grid-cols-2">
        <Panel title="Recent decisions" subtitle="Latest approved requisitions and orders" action={<Link to="/approvals" className={LINK}>View all <ChevronRightIcon className="h-4 w-4" /></Link>}>
          <div className="overflow-x-auto px-3 pb-3"><table className="w-full text-left text-[13px] leading-[18px] font-normal text-[#323A46]"><caption className="sr-only">Recent procurement approvals</caption><thead className="bg-[#F1F4F7] text-[12px] leading-4 font-semibold text-[#424B57]"><tr><th scope="col" className="px-2 py-1">Item</th><th scope="col" className="px-2 py-1">Type</th><th scope="col" className="px-2 py-1">Owner</th><th scope="col" className="px-2 py-1">Decision</th><th scope="col" className="px-2 py-1"><span className="sr-only">Action</span></th></tr></thead><tbody className="divide-y divide-[#E8EBEF]">{report.recent_decisions.slice(0, 3).map((row) => <tr key={`${row.type}-${row.record}`}><th scope="row" className="max-w-52 truncate px-2 py-1 font-normal" title={row.title}>{row.record} · {row.title}</th><td className="px-2 py-1">{row.type}</td><td className="px-2 py-1">{row.owner || 'Recorded approver'}</td><td className="px-2 py-1">{formatDate(row.decided_at)}</td><td className="px-2 py-1"><TableButton to={row.href}>Open</TableButton></td></tr>)}</tbody></table>{!report.recent_decisions.length && <p className="py-6 text-center text-[14px] leading-5 font-normal text-[#6B7280]">No recorded approvals in this scope.</p>}</div>
        </Panel>
        <Panel title="Supplier watch" subtitle="Suppliers with data or compliance issues" action={<Link to="/procurement/vendors" className={LINK}>View all suppliers <ChevronRightIcon className="h-4 w-4" /></Link>}>
          <div className="overflow-x-auto px-3 pb-3"><table className="w-full text-left text-[13px] leading-[18px] font-normal text-[#323A46]"><caption className="sr-only">Suppliers with compliance or required-data exceptions</caption><thead className="bg-[#F1F4F7] text-[12px] leading-4 font-semibold text-[#424B57]"><tr><th scope="col" className="px-2 py-1">Supplier</th><th scope="col" className="px-2 py-1">Issue</th><th scope="col" className="px-2 py-1">Severity</th><th scope="col" className="px-2 py-1"><span className="sr-only">Action</span></th></tr></thead><tbody className="divide-y divide-[#E8EBEF]">{report.supplier_watch.slice(0, 3).map((row) => <tr key={row.id}><th scope="row" className="px-2 py-1 font-normal">{row.supplier}</th><td className="px-2 py-1">{row.issue}{row.issue_count > 1 ? ` +${row.issue_count - 1}` : ''}</td><td className="px-2 py-1"><span className={`rounded px-2 py-0.5 text-[11px] leading-[14px] font-semibold ${row.severity === 'high' ? 'bg-[#FDE7E9] text-[#C42B1C]' : 'bg-[#FFF4CE] text-[#8A5700]'}`}>{row.severity}</span></td><td className="px-2 py-1"><TableButton to={row.href}>Review</TableButton></td></tr>)}</tbody></table>{!report.supplier_watch.length && <p className="py-6 text-center text-[14px] leading-5 font-normal text-[#6B7280]">No supplier master-data exceptions.</p>}</div>
        </Panel>
      </div>

      <details className="rounded-md border border-[#D9DEE5] bg-white"><summary className="cursor-pointer px-3 py-2 text-[14px] leading-5 font-semibold text-[#242B38] hover:bg-[#F1F4F7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0F6CBD]">Metric definitions and reporting controls</summary><div className="grid gap-5 border-t border-[#E8EBEF] p-4 lg:grid-cols-2"><div><h2 className="text-[14px] leading-5 font-semibold text-[#242B38]">Reporting controls</h2><p className="mt-1 text-[12px] leading-4 font-normal text-[#6B7280]">Enterprise project linking: <span className="font-semibold text-[#242B38]">{report.data_quality.canonical_project_link_percent ?? '—'}%</span> · Definition {report.definition_version}</p><ul className="mt-2 list-disc space-y-1 pl-5 text-[12px] leading-4 font-normal text-[#6B7280]">{report.data_quality.limitations.map((item) => <li key={item}>{item}</li>)}</ul><div className="mt-3 flex flex-wrap items-center gap-2"><button type="button" onClick={createSnapshot} disabled={!report.generated_at} className="inline-flex h-8 items-center gap-1 rounded bg-[#172033] px-3 text-[13px] leading-[18px] font-semibold text-white disabled:bg-[#D9DEE5] disabled:text-[#9CA3AF]"><LockClosedIcon className="h-4 w-4" />Lock snapshot</button>{snapshotStatus && <span className="text-[12px] leading-4 font-normal text-[#6B7280]" aria-live="polite">{snapshotStatus}</span>}<Link to="/procurement/projects/reconciliation" className={LINK}>Resolve project links</Link></div></div><div><h2 className="text-[14px] leading-5 font-semibold text-[#242B38]">Controlled definitions</h2><dl className="mt-2 max-h-44 space-y-2 overflow-y-auto text-[12px] leading-4 font-normal">{Object.entries(report.terminology).map(([term, definition]) => <div key={term}><dt className="font-semibold text-[#242B38] capitalize">{term.replaceAll('_', ' ')}</dt><dd className="text-[#6B7280]">{definition}</dd></div>)}</dl></div></div></details>
    </div>
  </main>;
}
