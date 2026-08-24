import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PLANNING_WORKFLOW_STEPS,
  PLANNING_FILE_CATEGORIES,
  EXPORT_FORMATS,
} from '../config/planningIntelligence.config';

// ═══════════════════════════════════════════════════════════════════════
// Planning Packages — Workflow & Documentation (standalone page)
// All copy + section metadata is soft-coded here so wording can change
// without touching JSX.
// ═══════════════════════════════════════════════════════════════════════
const DOCS_ROUTE_BACK = '/planning-packages';

const HERO = {
  eyebrow: 'Project Control · Feature 6.2',
  title: 'Planning Packages — Workflow & Documentation',
  subtitle:
    'From SOW to Primavera P6 in ten deterministic, reviewable stages. This guide walks you through the AI-assisted planning intelligence engine end-to-end.',
  icon: '🧭',
  gradient: 'from-violet-600 via-indigo-600 to-blue-600',
};

const QUICK_STATS = [
  { icon: '🗂️', label: 'Workflow stages', value: PLANNING_WORKFLOW_STEPS.length },
  { icon: '📄', label: 'Input categories', value: PLANNING_FILE_CATEGORIES.length },
  { icon: '⬇️', label: 'Export formats',   value: EXPORT_FORMATS.length },
  { icon: '⚙️', label: 'Engine',           value: 'Rule-based' },
];

const OVERVIEW_PILLARS = [
  {
    icon: '📥',
    title: 'Ingest',
    text: 'Upload SOW, WBS, MDR, EDDR and schedule-requirements documents. PDFs, Word docs and spreadsheets are all supported.',
    accent: 'from-sky-500 to-blue-600',
  },
  {
    icon: '🧠',
    title: 'Understand',
    text: 'A deterministic rule engine extracts scope, disciplines, deliverables and milestones, then the project’s required BYOK Claude configuration augments the result.',
    accent: 'from-violet-500 to-purple-600',
  },
  {
    icon: '🏗️',
    title: 'Build',
    text: 'The engine composes a WBS, a Level-4 schedule, an EDDR register, a manhour estimate, a validation report and a schedule narrative — all versioned.',
    accent: 'from-fuchsia-500 to-pink-600',
  },
  {
    icon: '🚀',
    title: 'Deliver',
    text: 'Review every artefact, tweak inline, then export to CSV, Excel, Primavera P6 XER, JSON or a client-ready PowerPoint deck.',
    accent: 'from-emerald-500 to-teal-600',
  },
];

const TIPS = [
  { icon: '📄', title: 'Upload a complete SOW first',   text: 'SOW drives scope detection — an incomplete SOW yields an incomplete WBS.' },
  { icon: '🧠', title: 'Review Document Intelligence',  text: 'Fix any missed disciplines or deliverables before generating the schedule.' },
  { icon: '🗂️', title: 'Edit the WBS before generation',text: 'Rename, reorder, or add branches — downstream steps inherit your changes.' },
  { icon: '🔁', title: 'Regenerate freely',             text: 'Every generation is versioned; compare or roll back at any time.' },
  { icon: '✅', title: 'Fix Validation warnings',       text: 'Warnings become client questions — resolve them before export.' },
  { icon: '⬇️', title: 'Pick the right export format',   text: 'CSV / Excel for review, Primavera P6 XER for scheduling teams, PPT for stakeholders.' },
];

const FAQ = [
  {
    q: 'Does any of my data leave the platform?',
    a: 'Yes. Analysis and generation require a project-level Anthropic BYOK configuration. The API key is encrypted with the dedicated server encryption key and is never returned by the API.',
  },
  {
    q: 'Can I edit the WBS or activities after generation?',
    a: 'Yes. Every panel (WBS Builder, Schedule Generator, EDDR, Manhours, Narrative) has an inline edit mode. Edits create a new revision — nothing is destructive.',
  },
  {
    q: 'What input file formats are supported?',
    a: 'PDF, DOCX, XLSX and CSV up to 100 MB per file. Multiple files per category are allowed.',
  },
  {
    q: 'Which schedule format should I use for Primavera P6?',
    a: 'Use the Primavera P6 XER export — it maps WBS, activities, relationships and calendars directly into P6 with no manual reformatting.',
  },
  {
    q: 'How is the manhour estimate calculated?',
    a: 'Manhours are computed per deliverable using discipline-specific productivity factors and Level-4 activity durations. You can override any row inline before export.',
  },
];


// ─── Small reusable atoms ────────────────────────────────────────────
const SectionTitle = ({ icon, children }) => (
  <div className="flex items-center gap-2 mb-4">
    <span className="text-2xl">{icon}</span>
    <h2 className="text-xl font-bold text-slate-800 tracking-tight">{children}</h2>
  </div>
);

const Pill = ({ tone = 'violet', children }) => {
  const map = {
    violet:  'bg-violet-50 text-violet-700 border-violet-100',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    amber:   'bg-amber-50 text-amber-800 border-amber-100',
    slate:   'bg-slate-100 text-slate-600 border-slate-200',
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide border ${map[tone] || map.violet}`}>
      {children}
    </span>
  );
};


// ─── Workflow flowchart (soft-coded, keyboard-navigable) ─────────────
const WorkflowFlow = ({ steps, activeIdx, onSelect }) => (
  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
    {steps.map((s, i) => {
      const isActive = i === activeIdx;
      return (
        <button
          key={s.id}
          type="button"
          onClick={() => onSelect(i)}
          className={[
            'relative group text-left rounded-2xl p-3 transition-all border shadow-sm',
            isActive
              ? `bg-gradient-to-br ${s.accent} text-white border-transparent shadow-lg scale-[1.02]`
              : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:shadow-md',
          ].join(' ')}
        >
          <div className={`text-[10px] font-mono ${isActive ? 'text-white/70' : 'text-slate-400'} mb-1`}>
            STEP {String(i + 1).padStart(2, '0')}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-lg">{s.icon}</span>
            <span className="text-sm font-semibold leading-tight">{s.label}</span>
          </div>
          {s.requiresGeneration && (
            <div className={`mt-1.5 inline-flex text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${isActive ? 'bg-white/20 text-white' : 'bg-amber-50 text-amber-700 border border-amber-100'}`}>
              needs generation
            </div>
          )}
          {/* Connector arrow (except last in row) */}
          {i < steps.length - 1 && (
            <div className="hidden md:block absolute top-1/2 -right-2.5 -translate-y-1/2 text-slate-300 group-hover:text-slate-400 text-lg font-bold pointer-events-none select-none">
              ›
            </div>
          )}
        </button>
      );
    })}
  </div>
);


const PlanningPackageDocs = () => {
  const navigate = useNavigate();
  const [activeIdx, setActiveIdx] = useState(0);

  const active = useMemo(
    () => PLANNING_WORKFLOW_STEPS[activeIdx] || PLANNING_WORKFLOW_STEPS[0],
    [activeIdx],
  );

  const goBack = () => navigate(DOCS_ROUTE_BACK);
  const next   = () => setActiveIdx((i) => Math.min(i + 1, PLANNING_WORKFLOW_STEPS.length - 1));
  const prev   = () => setActiveIdx((i) => Math.max(i - 1, 0));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-violet-50/40">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-10 py-6">

        {/* Back nav */}
        <div className="mb-4">
          <button
            onClick={goBack}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-violet-700"
          >
            <span>←</span> Back to Planning Packages
          </button>
        </div>

        {/* Hero */}
        <div className={`relative overflow-hidden rounded-3xl bg-gradient-to-r ${HERO.gradient} p-6 sm:p-10 shadow-xl mb-6`}>
          <div className="absolute -right-16 -top-16 w-72 h-72 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -left-24 -bottom-24 w-80 h-80 rounded-full bg-white/5 blur-3xl" />
          <div className="relative flex flex-col sm:flex-row sm:items-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center text-4xl shrink-0 shadow-inner">
              {HERO.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-violet-100/90 mb-1">
                {HERO.eyebrow}
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                {HERO.title}
              </h1>
              <p className="text-sm text-violet-100/90 mt-2 max-w-3xl">
                {HERO.subtitle}
              </p>
            </div>
          </div>

          {/* Quick stats strip */}
          <div className="relative mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {QUICK_STATS.map((s, i) => (
              <div key={i} className="rounded-xl bg-white/12 backdrop-blur px-3.5 py-3 border border-white/10">
                <div className="text-xl">{s.icon}</div>
                <div className="text-xl font-bold text-white leading-tight mt-1">{s.value}</div>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-violet-50/90">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Overview pillars */}
        <section className="mb-8">
          <SectionTitle icon="🎯">How the engine works</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {OVERVIEW_PILLARS.map((p, i) => (
              <div
                key={i}
                className="relative overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${p.accent}`} />
                <div className="p-4">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${p.accent} text-white flex items-center justify-center text-xl shadow-sm`}>
                    {p.icon}
                  </div>
                  <div className="mt-3 text-sm font-bold text-slate-800">{p.title}</div>
                  <div className="mt-1 text-xs text-slate-600 leading-relaxed">{p.text}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Interactive workflow */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <SectionTitle icon="🧭">End-to-end workflow</SectionTitle>
            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500">
              <Pill tone="slate">click any step</Pill>
              <Pill tone="amber">needs generation</Pill>
            </div>
          </div>

          <WorkflowFlow
            steps={PLANNING_WORKFLOW_STEPS}
            activeIdx={activeIdx}
            onSelect={setActiveIdx}
          />

          {/* Active-step detail card */}
          <div className="mt-5 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className={`h-1.5 bg-gradient-to-r ${active.accent}`} />
            <div className="p-5 sm:p-6">
              <div className="flex items-start gap-4">
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${active.accent} text-white flex items-center justify-center text-2xl shrink-0 shadow-sm`}>
                  {active.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono text-slate-400">
                      STEP {String(activeIdx + 1).padStart(2, '0')} of {String(PLANNING_WORKFLOW_STEPS.length).padStart(2, '0')}
                    </span>
                    {active.requiresGeneration
                      ? <Pill tone="amber">needs generation</Pill>
                      : <Pill tone="emerald">available immediately</Pill>}
                  </div>
                  <div className="text-lg font-bold text-slate-800 mt-1">{active.label}</div>
                  <div className="text-sm text-slate-600 mt-1">{active.description}</div>
                </div>
              </div>

              <div className="flex items-center justify-between mt-5 pt-4 border-t border-slate-100">
                <button
                  onClick={prev}
                  disabled={activeIdx === 0}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  ← Previous
                </button>
                <div className="text-[11px] text-slate-400">{active.id}</div>
                <button
                  onClick={next}
                  disabled={activeIdx === PLANNING_WORKFLOW_STEPS.length - 1}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-sm hover:shadow disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next →
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Inputs + Exports */}
        <section className="mb-8 grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <SectionTitle icon="📥">Accepted inputs</SectionTitle>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {PLANNING_FILE_CATEGORIES.map((c) => (
                <div key={c.value} className="flex items-start gap-2 p-3 rounded-lg border border-slate-200 bg-slate-50/70">
                  <span className="text-lg shrink-0">{c.icon || '📄'}</span>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-800">{c.label}</div>
                    {c.description && (
                      <div className="text-xs text-slate-500 mt-0.5">{c.description}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <SectionTitle icon="⬇️">Export destinations</SectionTitle>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {EXPORT_FORMATS.map((f) => (
                <div key={f.value || f.id || f.label} className="flex items-start gap-2 p-3 rounded-lg border border-slate-200 bg-slate-50/70">
                  <span className="text-lg shrink-0">{f.icon || '📦'}</span>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-800">{f.label || f.value}</div>
                    {f.description && (
                      <div className="text-xs text-slate-500 mt-0.5">{f.description}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Tips */}
        <section className="mb-8">
          <SectionTitle icon="💡">Tips for best results</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {TIPS.map((t, i) => (
              <div key={i} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white flex items-center justify-center text-lg shrink-0">
                    {t.icon}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-slate-800">{t.title}</div>
                    <div className="text-xs text-slate-600 mt-1 leading-relaxed">{t.text}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section className="mb-10">
          <SectionTitle icon="❓">Frequently asked</SectionTitle>
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm divide-y divide-slate-100">
            {FAQ.map((f, i) => (
              <details key={i} className="group p-4 open:bg-violet-50/40 transition-colors">
                <summary className="cursor-pointer list-none flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-slate-800">{f.q}</span>
                  <span className="text-slate-400 group-open:rotate-90 transition-transform">›</span>
                </summary>
                <div className="mt-2 text-sm text-slate-600 leading-relaxed">{f.a}</div>
              </details>
            ))}
          </div>
        </section>

        {/* CTA */}
        <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg">
          <div className="min-w-0">
            <div className="text-lg font-bold">Ready to build your next planning package?</div>
            <div className="text-sm text-slate-300 mt-1">
              Head back to the workspace and upload your project reference documents.
            </div>
          </div>
          <button
            onClick={goBack}
            className="shrink-0 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm font-semibold shadow hover:shadow-lg transition-shadow"
          >
            Open Planning Packages →
          </button>
        </div>
      </div>
    </div>
  );
};

export default PlanningPackageDocs;
