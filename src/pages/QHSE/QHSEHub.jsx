import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield,
  Leaf,
  Zap,
  FileCheck,
  BarChart3,
  Brain,
  FolderOpen,
  TableProperties,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  AlertTriangle,
  Award,
  Activity,
  Target,
  Users,
} from 'lucide-react';
import { isQHSEModuleEnabled } from '../../config/qhseModules.config';

// ─── Static KPI tiles (soft-coded — replace with real API data when available) ──
const KPI_TILES = [
  {
    label: 'Active Projects',
    value: '—',
    sub: 'QHSE tracked',
    icon: FolderOpen,
    color: 'from-blue-500 to-blue-700',
    trend: null,
  },
  {
    label: 'Open NCRs',
    value: '—',
    sub: 'Pending action',
    icon: AlertTriangle,
    color: 'from-amber-500 to-orange-600',
    trend: null,
  },
  {
    label: 'Safety Score',
    value: '—',
    sub: 'Avg across projects',
    icon: Shield,
    color: 'from-emerald-500 to-green-700',
    trend: null,
  },
  {
    label: 'Compliance Rate',
    value: '—',
    sub: 'ISO standards',
    icon: CheckCircle2,
    color: 'from-purple-500 to-indigo-700',
    trend: null,
  },
];

// ─── Module cards ────────────────────────────────────────────────────────────
const MODULES = [
  {
    key: 'dashboard',
    title: 'QHSE Dashboard',
    description: 'Live overview of all running projects — charts, KPIs, and trend analysis in one place.',
    icon: BarChart3,
    path: '/qhse/general',
    gradient: 'from-blue-500 via-blue-600 to-blue-700',
    accent: 'blue',
    iso: null,
    badge: null,
  },
  {
    key: 'quality',
    title: 'Quality Management',
    description: 'Non-conformance tracking, audit timelines, compliance matrices, and corrective actions.',
    icon: FileCheck,
    path: '/qhse/general/quality',
    gradient: 'from-indigo-500 via-indigo-600 to-indigo-700',
    accent: 'indigo',
    iso: 'ISO 9001',
    badge: null,
  },
  {
    key: 'health-safety',
    title: 'Health & Safety',
    description: 'Incident reporting, risk matrix, safety KPIs, permit-to-work, and near-miss analysis.',
    icon: Shield,
    path: '/qhse/general/health-safety',
    gradient: 'from-rose-500 via-red-600 to-red-700',
    accent: 'rose',
    iso: 'ISO 45001',
    badge: null,
  },
  {
    key: 'environmental',
    title: 'Environmental',
    description: 'Carbon footprint, waste breakdown, sustainability goals, and environmental compliance.',
    icon: Leaf,
    path: '/qhse/general/environmental',
    gradient: 'from-emerald-500 via-green-600 to-green-700',
    accent: 'emerald',
    iso: 'ISO 14001',
    badge: null,
    enabled: false, // DISABLED: 2026-07-11 - Not related to project quality
  },
  {
    key: 'energy',
    title: 'Energy Management',
    description: 'Consumption trends, renewable sources, efficiency initiatives, and smart technologies.',
    icon: Zap,
    path: '/qhse/general/energy',
    gradient: 'from-amber-500 via-yellow-500 to-orange-500',
    accent: 'amber',
    iso: 'ISO 50001',
    badge: null,
    enabled: false, // DISABLED: 2026-07-11 - Not related to project quality
  },
  {
    key: 'projects',
    title: 'Projects',
    description: 'Create and manage QHSE projects, assign owners, track milestones, and view history.',
    icon: FolderOpen,
    path: '/qhse/general/projects',
    gradient: 'from-purple-500 via-purple-600 to-purple-700',
    accent: 'purple',
    iso: null,
    badge: null,
  },
  {
    key: 'summary',
    title: 'Summary View',
    description: 'Filterable high-level summary of all projects with status indicators and date ranges.',
    icon: TableProperties,
    path: '/qhse/general/summary',
    gradient: 'from-cyan-500 via-sky-500 to-blue-600',
    accent: 'cyan',
    iso: null,
    badge: null,
  },
  {
    key: 'ai-dashboard',
    title: 'AI Insights',
    description: 'Machine-learning predictions, anomaly detection, and AI-driven QHSE recommendations.',
    icon: Brain,
    path: '/qhse/general/ai-dashboard',
    gradient: 'from-violet-500 via-fuchsia-500 to-pink-600',
    accent: 'violet',
    iso: null,
    badge: 'AI',
  },
];

// ─── ISO standard badges ─────────────────────────────────────────────────────
const ISO_STANDARDS = [
  { code: 'ISO 9001', label: 'Quality', color: 'bg-indigo-50 text-indigo-700 border-indigo-200', icon: FileCheck },
  { code: 'ISO 45001', label: 'H&S', color: 'bg-rose-50 text-rose-700 border-rose-200', icon: Shield },
  { code: 'ISO 14001', label: 'Environmental', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: Leaf },
  { code: 'ISO 50001', label: 'Energy', color: 'bg-amber-50 text-amber-700 border-amber-200', icon: Zap },
];

// ─── Animated counter hook ───────────────────────────────────────────────────
function useCountUp(target, duration = 1200) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (typeof target !== 'number') return;
    let start = 0;
    const step = Math.ceil(target / (duration / 16));
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { setCount(target); clearInterval(timer); }
      else setCount(start);
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration]);
  return count;
}

// ─── KPI Tile ────────────────────────────────────────────────────────────────
const KpiTile = ({ label, value, sub, icon: Icon, color }) => (
  <div className="relative overflow-hidden rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-300 p-5">
    <div className={`absolute inset-0 opacity-5 bg-gradient-to-br ${color}`} />
    <div className="relative flex items-start justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">{label}</p>
        <p className="text-3xl font-bold text-gray-800">{value}</p>
        <p className="text-xs text-gray-500 mt-1">{sub}</p>
      </div>
      <div className={`p-3 rounded-xl bg-gradient-to-br ${color} shadow-lg`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
    </div>
  </div>
);

// ─── Module Card ─────────────────────────────────────────────────────────────
const ModuleCard = ({ module, onClick }) => {
  const Icon = module.icon;
  return (
    <button
      onClick={() => onClick(module.path)}
      className="group relative overflow-hidden rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 text-left w-full"
    >
      {/* Top gradient bar */}
      <div className={`h-1.5 w-full bg-gradient-to-r ${module.gradient}`} />

      <div className="p-6">
        {/* Icon + badges row */}
        <div className="flex items-start justify-between mb-4">
          <div className={`p-3 rounded-xl bg-gradient-to-br ${module.gradient} shadow-md group-hover:scale-110 transition-transform duration-300`}>
            <Icon className="w-6 h-6 text-white" />
          </div>
          <div className="flex items-center gap-2">
            {module.iso && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200">
                {module.iso}
              </span>
            )}
            {module.badge && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gradient-to-r from-violet-500 to-pink-500 text-white animate-pulse">
                {module.badge}
              </span>
            )}
          </div>
        </div>

        {/* Title */}
        <h3 className="text-base font-semibold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors duration-200">
          {module.title}
        </h3>

        {/* Description */}
        <p className="text-sm text-gray-500 leading-relaxed line-clamp-2">
          {module.description}
        </p>

        {/* CTA */}
        <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-gray-400 group-hover:text-blue-600 transition-colors duration-200">
          <span>Open module</span>
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform duration-200" />
        </div>
      </div>

      {/* Hover shimmer */}
      <div className={`absolute bottom-0 left-0 h-0.5 w-0 bg-gradient-to-r ${module.gradient} group-hover:w-full transition-all duration-500`} />
    </button>
  );
};

// ─── Main Hub Page ────────────────────────────────────────────────────────────
const QHSEHub = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-900 px-6 py-14 md:py-20">
        {/* Background grid overlay */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              'repeating-linear-gradient(0deg,transparent,transparent 39px,rgba(255,255,255,.15) 39px,rgba(255,255,255,.15) 40px),' +
              'repeating-linear-gradient(90deg,transparent,transparent 39px,rgba(255,255,255,.15) 39px,rgba(255,255,255,.15) 40px)',
          }}
        />

        {/* Glowing orbs */}
        <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-blue-600/30 blur-3xl" />
        <div className="absolute -bottom-16 -right-16 w-64 h-64 rounded-full bg-indigo-500/30 blur-3xl" />

        <div className="relative max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-8">
            <div>
              {/* Eyebrow */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/20 text-xs font-semibold text-blue-200 uppercase tracking-widest mb-4">
                <Activity className="w-3.5 h-3.5" />
                RAD AI Platform
              </div>

              {/* Title */}
              <h1 className="text-4xl md:text-5xl font-extrabold text-white leading-tight mb-3">
                QHSE{' '}
                <span className="bg-gradient-to-r from-blue-300 to-cyan-300 bg-clip-text text-transparent">
                  Command Centre
                </span>
              </h1>

              <p className="text-blue-200 text-base md:text-lg max-w-xl leading-relaxed">
                Quality · Health &amp; Safety · Environmental · Energy — all four pillars in a single AI-augmented workspace built for engineering projects.
              </p>

              {/* CTA buttons */}
              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  onClick={() => navigate('/qhse/general')}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-400 text-white text-sm font-semibold shadow-lg hover:shadow-blue-500/30 transition-all duration-200"
                >
                  <BarChart3 className="w-4 h-4" />
                  Open Dashboard
                </button>
                <button
                  onClick={() => navigate('/qhse/general/ai-dashboard')}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/25 text-white text-sm font-semibold transition-all duration-200"
                >
                  <Brain className="w-4 h-4" />
                  AI Insights
                </button>
              </div>
            </div>

            {/* ISO standard badges */}
            <div className="grid grid-cols-2 gap-3 shrink-0">
              {ISO_STANDARDS.map((std) => {
                const Icon = std.icon;
                return (
                  <div
                    key={std.code}
                    className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-white/10 border border-white/20 backdrop-blur-sm"
                  >
                    <div className="p-1.5 rounded-lg bg-white/20">
                      <Icon className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <p className="text-white text-xs font-bold leading-none">{std.code}</p>
                      <p className="text-blue-300 text-[10px] mt-0.5">{std.label}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── KPI Tiles ─────────────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-6 -mt-6 relative z-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {KPI_TILES.map((tile) => (
            <KpiTile key={tile.label} {...tile} />
          ))}
        </div>
      </div>

      {/* ── Module grid ───────────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-6 py-12">
        {/* Section title */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Modules</h2>
            <p className="text-sm text-gray-500 mt-0.5">Select a module to dive in</p>
          </div>
          <span className="text-xs text-gray-400 font-medium">
            {MODULES.filter(mod => mod.enabled !== false).length} modules available
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {MODULES.filter(mod => mod.enabled !== false).map((mod) => (
            <ModuleCard key={mod.key} module={mod} onClick={navigate} />
          ))}
        </div>
      </div>

      {/* ── Quick-access bottom strip ─────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-6 pb-12">
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-md">
                <Target className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">Ready to run your QHSE inspection?</p>
                <p className="text-xs text-gray-500">Jump straight to the live dashboard and start monitoring today.</p>
              </div>
            </div>
            <div className="flex gap-3 shrink-0">
              <button
                onClick={() => navigate('/qhse/general/projects')}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <FolderOpen className="w-4 h-4" />
                View Projects
              </button>
              <button
                onClick={() => navigate('/qhse/general')}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors shadow-sm"
              >
                <BarChart3 className="w-4 h-4" />
                Go to Dashboard
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QHSEHub;
