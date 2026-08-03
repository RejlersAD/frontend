import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Upload,
  DollarSign,
  TrendingUp,
  Users,
  ShoppingCart,
  BarChart3,
  ArrowRight,
  CheckCircle2,
  Clock,
  AlertCircle,
  Briefcase,
  Receipt,
  CreditCard,
  Activity,
  Sparkles,
} from 'lucide-react';

// ─── Finance modules ──────────────────────────────────────────────────────────
const MODULES = [
  {
    key: 'invoice-tracker',
    title: 'Invoice Tracker',
    description: 'Real-time pipeline view of invoices across the approval workflow — read-only with filters and export.',
    icon: Receipt,
    path: '/finance/invoice-tracker',
    gradient: 'from-indigo-500 via-indigo-600 to-indigo-700',
    badge: 'Live',
  },
  {
    key: 'sales',
    title: 'Sales Dashboard',
    description: 'Internal sales analytics — pipeline value, win rates, team performance, and revenue trends.',
    icon: TrendingUp,
    path: '/finance/sales',
    gradient: 'from-violet-500 via-purple-600 to-purple-700',
    badge: null,
  },
  {
    key: 'procurement',
    title: 'Procurement',
    description: 'Purchase orders, vendor management, requisitions, and goods receipt — end-to-end tracking.',
    icon: ShoppingCart,
    path: '/procurement',
    gradient: 'from-amber-500 via-orange-500 to-orange-600',
    badge: null,
  },
];

// ─── Workflow steps ───────────────────────────────────────────────────────────
const WORKFLOW_STEPS = [
  { step: '01', label: 'Upload Invoice', sub: 'AI extracts all fields automatically', icon: Upload, color: 'text-blue-500', bg: 'bg-blue-50 border-blue-200' },
  { step: '02', label: 'Review & Submit', sub: 'Validate data, set GL codes, submit', icon: FileText, color: 'text-indigo-500', bg: 'bg-indigo-50 border-indigo-200' },
  { step: '03', label: 'Approval Chain', sub: 'Multi-level approval per matrix', icon: CheckCircle2, color: 'text-amber-500', bg: 'bg-amber-50 border-amber-200' },
  { step: '04', label: 'Payment', sub: 'Mark as paid, archive record', icon: DollarSign, color: 'text-emerald-500', bg: 'bg-emerald-50 border-emerald-200' },
];

// ─── Stat tiles ───────────────────────────────────────────────────────────────
const STAT_TILES = [
  { label: 'Total Invoices', value: '—', icon: Receipt, color: 'from-blue-500 to-blue-700' },
  { label: 'Pending Approval', value: '—', icon: Clock, color: 'from-amber-500 to-orange-600' },
  { label: 'Approved', value: '—', icon: CheckCircle2, color: 'from-emerald-500 to-green-700' },
  { label: 'Overdue', value: '—', icon: AlertCircle, color: 'from-rose-500 to-red-700' },
];

// ─── Sub-components ───────────────────────────────────────────────────────────
const StatTile = ({ label, value, icon: Icon, color }) => (
  <div className="relative overflow-hidden rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-md transition-shadow p-5">
    <div className={`absolute inset-0 opacity-5 bg-gradient-to-br ${color}`} />
    <div className="relative flex items-start justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">{label}</p>
        <p className="text-3xl font-bold text-gray-800">{value}</p>
      </div>
      <div className={`p-3 rounded-xl bg-gradient-to-br ${color} shadow-lg`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
    </div>
  </div>
);

const ModuleCard = ({ mod, onClick }) => {
  const Icon = mod.icon;
  return (
    <button
      onClick={() => onClick(mod.path)}
      className="group relative overflow-hidden rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 text-left w-full"
    >
      <div className={`h-1.5 w-full bg-gradient-to-r ${mod.gradient}`} />
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className={`p-3 rounded-xl bg-gradient-to-br ${mod.gradient} shadow-md group-hover:scale-110 transition-transform duration-300`}>
            <Icon className="w-6 h-6 text-white" />
          </div>
          {mod.badge && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gradient-to-r from-violet-500 to-pink-500 text-white animate-pulse">
              {mod.badge}
            </span>
          )}
        </div>
        <h3 className="text-base font-semibold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
          {mod.title}
        </h3>
        <p className="text-sm text-gray-500 leading-relaxed line-clamp-2">{mod.description}</p>
        <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-gray-400 group-hover:text-blue-600 transition-colors">
          <span>Open module</span>
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform duration-200" />
        </div>
      </div>
      <div className={`absolute bottom-0 left-0 h-0.5 w-0 bg-gradient-to-r ${mod.gradient} group-hover:w-full transition-all duration-500`} />
    </button>
  );
};

// ─── Main Hub ─────────────────────────────────────────────────────────────────
const FinanceHub = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-indigo-950 to-violet-900 px-6 py-14 md:py-20">
        {/* Grid overlay */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              'repeating-linear-gradient(0deg,transparent,transparent 39px,rgba(255,255,255,.15) 39px,rgba(255,255,255,.15) 40px),' +
              'repeating-linear-gradient(90deg,transparent,transparent 39px,rgba(255,255,255,.15) 39px,rgba(255,255,255,.15) 40px)',
          }}
        />
        <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-indigo-600/30 blur-3xl" />
        <div className="absolute -bottom-16 -right-16 w-64 h-64 rounded-full bg-violet-500/30 blur-3xl" />

        <div className="relative max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-8">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/20 text-xs font-semibold text-indigo-200 uppercase tracking-widest mb-4">
                <Activity className="w-3.5 h-3.5" />
                RAD AI Platform
              </div>
              <h1 className="text-4xl md:text-5xl font-extrabold text-white leading-tight mb-3">
                Finance{' '}
                <span className="bg-gradient-to-r from-indigo-300 to-purple-300 bg-clip-text text-transparent">
                  Control Centre
                </span>
              </h1>
              <p className="text-indigo-200 text-base md:text-lg max-w-xl leading-relaxed">
                AI-powered invoice automation, multi-level approvals, salary management, and real-time sales analytics — all in one workspace.
              </p>
              {/* SOFT-CODED: hero CTA buttons retired alongside /finance/invoices link */}
            </div>

            {/* Workflow summary badges */}
            <div className="flex flex-wrap md:flex-col gap-2 shrink-0 md:max-w-[200px]">
              {[
                { label: 'Invoice Workflow', sub: 'Draft → Approved → Paid', icon: FileText },
                { label: 'UAE VAT 5%', sub: 'Auto-calculated server-side', icon: DollarSign },
                { label: 'Multi-level Approval', sub: 'Per org approval matrix', icon: CheckCircle2 },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-white/10 border border-white/20 backdrop-blur-sm">
                    <div className="p-1.5 rounded-lg bg-white/20 shrink-0">
                      <Icon className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <p className="text-white text-xs font-bold leading-none">{item.label}</p>
                      <p className="text-indigo-300 text-[10px] mt-0.5">{item.sub}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Stat tiles ──────────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-6 -mt-6 relative z-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {STAT_TILES.map((t) => <StatTile key={t.label} {...t} />)}
        </div>
      </div>

      {/* ── Module grid ─────────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Modules</h2>
            <p className="text-sm text-gray-500 mt-0.5">Select a module to get started</p>
          </div>
          <span className="text-xs text-gray-400 font-medium">{MODULES.length} modules available</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {MODULES.map((mod) => (
            <ModuleCard key={mod.key} mod={mod} onClick={navigate} />
          ))}
        </div>
      </div>

      {/* ── Workflow strip ───────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-6 pb-12">
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-6">
          <div className="flex items-center gap-2 mb-6">
            <div className="p-2 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 shadow-sm">
              <Briefcase className="w-4 h-4 text-white" />
            </div>
            <h3 className="text-sm font-bold text-gray-800">Invoice Lifecycle</h3>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {WORKFLOW_STEPS.map((step, idx) => {
              const Icon = step.icon;
              return (
                <div key={step.step} className="relative">
                  {idx < WORKFLOW_STEPS.length - 1 && (
                    <div className="hidden md:block absolute top-6 left-full w-full h-px bg-gray-200 z-0" style={{ width: 'calc(100% - 2rem)', left: '2rem' }} />
                  )}
                  <div className={`relative flex flex-col items-center text-center p-4 rounded-xl border ${step.bg}`}>
                    <div className={`p-2.5 rounded-lg bg-white shadow-sm mb-2`}>
                      <Icon className={`w-5 h-5 ${step.color}`} />
                    </div>
                    <span className="text-[10px] font-bold text-gray-400 mb-0.5">STEP {step.step}</span>
                    <p className="text-xs font-bold text-gray-800">{step.label}</p>
                    <p className="text-[11px] text-gray-500 mt-0.5">{step.sub}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 pt-4 border-t border-gray-100">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Sparkles className="w-4 h-4 text-violet-500" />
              <span>AI extraction powered by GPT-4o — saves ~15 min per invoice</span>
            </div>
            <div className="flex gap-3 shrink-0">
              <button
                onClick={() => navigate('/procurement')}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <ShoppingCart className="w-4 h-4" />
                Procurement
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FinanceHub;
