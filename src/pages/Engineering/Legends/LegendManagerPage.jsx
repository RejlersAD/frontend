/**
 * LegendManagerPage.jsx — "1.8 Legend Manager" hub (route: /engineering/legends)
 *
 * A V1-themed, project-aware wrapper around the existing full-page legend
 * manager (LegendSheetsCanvas). Adds a top strip:
 *   • Project selector (shared Project Organizer) — bind the session to a
 *     project so legend edits/packs are project-scoped and inherited by
 *     every tool (Line List, Equipment List, Instrument Index, P&ID QC).
 *   • "Upload Pack (AI)" — one legend pack file → auto-split per section.
 *   • Live coverage chips — which sections have a legend in scope.
 *
 * No project selected → global legend library (unchanged legacy behaviour).
 *
 * SOFT-CODED: palette + copy live in LM_THEME / LM_COPY below.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import LegendSheetsCanvas from '../Process/LegendSheetsCanvas';
import ImportFromRepositoryModal from './ImportFromRepositoryModal';
import projectOrganizerService from '../../../services/projectOrganizerService';
import { uploadLegendPack, listLegends } from '../../../services/pidCheckerV2API';
import { LEGEND_SECTIONS } from '../../../services/pidCheckerV2API';
import {
  BookOpenIcon, FolderIcon, ArrowUpTrayIcon, ChevronDownIcon,
  CheckCircleIcon, SparklesIcon, ServerStackIcon,
} from '@heroicons/react/24/outline';

// ── Soft-coded theme (V1 blue/indigo — matches pid-verification-v1) ─────────
const LM_THEME = {
  bg:      'linear-gradient(135deg, #f8faff 0%, #eef2ff 45%, #f0f9ff 75%, #fffbeb 100%)',
  gridDot: 'radial-gradient(circle, rgba(99,102,241,0.055) 1px, transparent 1px)',
  gradBar: 'linear-gradient(90deg,#3b82f6,#6366f1,#f59e0b,#3b82f6)',
  accent:  'linear-gradient(135deg,#3b82f6,#6366f1)',
  accentAi:'linear-gradient(135deg,#8b5cf6,#6366f1)',
  card:    { background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' },
};

const LM_COPY = {
  title:    'Legend Sheet Manager',
  eyebrow:  'AIFlow · Engineering Suite',
  subtitle: 'Central legend library — configure once per project and every extraction tool inherits it.',
  globalLabel: 'Global library (no project)',
};

// Coverage chip derived per section
const SectionChip = ({ label, covered }) => (
  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
    style={covered
      ? { background: 'rgba(16,185,129,0.10)', color: '#047857', border: '1px solid rgba(16,185,129,0.25)' }
      : { background: '#f8fafc', color: '#94a3b8', border: '1px solid #e2e8f0' }}>
    <span className="w-1.5 h-1.5 rounded-full" style={{ background: covered ? '#10b981' : '#cbd5e1' }} />
    {label}
  </span>
);

const LegendManagerPage = () => {
  const [params] = useSearchParams();

  // ── Project binding (shared Project Organizer) ──────────────────────────
  const [projects, setProjects]       = useState([]);
  const [projectsBusy, setProjectsBusy] = useState(true);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const selectedProject = useMemo(
    () => projects.find(p => p.project_id === selectedProjectId) || null,
    [projects, selectedProjectId],
  );

  // ── AI pack upload ──────────────────────────────────────────────────────
  const packInputRef = useRef(null);
  const [packBusy, setPackBusy] = useState(false);

  // ── Repository import (R: drive replica → legend pack) ─────────────────
  const [repoOpen, setRepoOpen] = useState(false);

  // ── Section coverage (legends present per section in current scope) ──────
  const [coverage, setCoverage] = useState({});
  const [coverageTick, setCoverageTick] = useState(0);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const items = await projectOrganizerService.listProjects();
        if (live) setProjects(items || []);
      } catch { /* non-fatal */ }
      finally { if (live) setProjectsBusy(false); }
    })();
    return () => { live = false; };
  }, []);

  const loadCoverage = useCallback(async () => {
    try {
      const results = await Promise.all(
        LEGEND_SECTIONS.map(s =>
          listLegends(s.id, selectedProjectId || undefined)
            .then(rows => ({ id: s.id, n: Array.isArray(rows) ? rows.length : 0 }))
            .catch(() => ({ id: s.id, n: 0 })),
        ),
      );
      const map = {};
      results.forEach(r => { map[r.id] = r.n; });
      setCoverage(map);
    } catch { /* silent */ }
  }, [selectedProjectId]);

  useEffect(() => { loadCoverage(); }, [loadCoverage, coverageTick]);

  const applyPack = useCallback(async (file) => {
    const res = await uploadLegendPack({
      file,
      projectId: selectedProjectId,
      name: selectedProject?.name || '',
    });
    toast.success(`Legend pack applied — ${res.sections} section${res.sections === 1 ? '' : 's'} configured (${res.method}).`);
    setCoverageTick(t => t + 1);
  }, [selectedProjectId, selectedProject]);

  const handlePackUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !selectedProjectId) return;
    setPackBusy(true);
    try {
      await applyPack(file);
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Legend pack upload failed.');
    } finally {
      setPackBusy(false);
    }
  };

  const coveredCount = useMemo(
    () => LEGEND_SECTIONS.filter(s => (coverage[s.id] || 0) > 0).length,
    [coverage],
  );

  return (
    <div className="min-h-screen relative overflow-x-hidden" style={{ background: LM_THEME.bg }}>
      {/* Fine dot grid + animated top bar (V1) */}
      <div className="fixed inset-0 pointer-events-none"
        style={{ backgroundImage: LM_THEME.gridDot, backgroundSize: '44px 44px' }} />
      <div className="absolute inset-x-0 top-0 h-[3px] pointer-events-none"
        style={{ backgroundImage: LM_THEME.gradBar, backgroundSize: '300% auto', animation: 'gradShift 4s linear infinite' }} />
      <style>{`@keyframes gradShift { 0%,100%{background-position:0% 50%} 50%{background-position:100% 50%} }`}</style>

      <div className="relative z-10 w-full px-2 sm:px-4 lg:px-6 py-6">

        {/* ── Header ── */}
        <div className="rounded-2xl mb-5" style={{
          background: 'linear-gradient(135deg, rgba(59,130,246,0.03) 0%, rgba(99,102,241,0.06) 100%)',
          border: '1px solid #e2e8f0', padding: '24px 28px',
        }}>
          <div className="flex items-start justify-between gap-6 flex-wrap">
            <div className="flex items-start gap-4 flex-1 min-w-0">
              <div style={{
                width: 44, height: 44, borderRadius: 14, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: LM_THEME.accent, boxShadow: '0 4px 14px rgba(59,130,246,0.3)',
              }}>
                <BookOpenIcon className="h-6 w-6 text-white" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-3 mb-1 flex-wrap">
                  <span className="text-blue-600 text-xs font-bold tracking-[0.25em] uppercase">{LM_COPY.eyebrow}</span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold"
                    style={{ background: 'rgba(16,185,129,0.12)', color: '#047857', border: '1px solid rgba(16,185,129,0.25)' }}>
                    <SparklesIcon className="w-3 h-3" /> Shared by all tools
                  </span>
                </div>
                <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight" style={{ margin: 0 }}>
                  {LM_COPY.title}
                </h1>
                <p className="text-sm text-slate-500 mt-1" style={{ margin: '4px 0 0' }}>{LM_COPY.subtitle}</p>
              </div>
            </div>

            {/* Project selector + pack upload */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative">
                <FolderIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <select
                  value={selectedProjectId}
                  onChange={e => setSelectedProjectId(e.target.value)}
                  disabled={projectsBusy}
                  className="pl-9 pr-8 py-2.5 rounded-xl text-sm font-semibold text-slate-700 bg-white border border-slate-200 shadow-sm appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-400/40"
                  style={{ minWidth: 240 }}
                >
                  <option value="">{LM_COPY.globalLabel}</option>
                  {projects.map(p => (
                    <option key={p.project_id} value={p.project_id}>{p.name || p.code || p.project_id}</option>
                  ))}
                </select>
                <ChevronDownIcon className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              <input ref={packInputRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.tiff,.tif,.bmp" className="hidden" onChange={handlePackUpload} />
              <button
                onClick={() => packInputRef.current?.click()}
                disabled={!selectedProjectId || packBusy}
                title={selectedProjectId
                  ? 'Upload one project legend pack — AI splits it into every section for this project'
                  : 'Select a project first to upload a legend pack'}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-bold transition-all hover:-translate-y-px disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: LM_THEME.accentAi, boxShadow: '0 4px 12px rgba(139,92,246,0.35)' }}>
                <ArrowUpTrayIcon className="w-4 h-4" /> {packBusy ? 'Applying…' : 'Upload Pack (AI)'}
              </button>
              <button
                onClick={() => setRepoOpen(true)}
                disabled={!selectedProjectId || packBusy}
                title={selectedProject
                  ? 'Pick a legend sheet file from this project\'s mapped file-server folder (R: drive replica)'
                  : 'Select a project first to import from its repository'}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all hover:-translate-y-px disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: '#ffffff', color: '#1d4ed8',
                  border: '1.5px solid rgba(59,130,246,0.45)',
                  boxShadow: '0 2px 8px rgba(59,130,246,0.15)',
                }}>
                <ServerStackIcon className="w-4 h-4" /> Import from Repository
              </button>            </div>
          </div>

          {/* Coverage chips */}
          <div className="mt-4 pt-4 flex items-center gap-2 flex-wrap" style={{ borderTop: '1px solid rgba(59,130,246,0.12)' }}>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mr-1">
              {selectedProject ? `Coverage in "${selectedProject.name}"` : 'Library coverage'}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold mr-1"
              style={{ background: 'rgba(59,130,246,0.10)', color: '#1d4ed8', border: '1px solid rgba(59,130,246,0.22)' }}>
              <CheckCircleIcon className="w-3 h-3" /> {coveredCount}/{LEGEND_SECTIONS.length} sections
            </span>
            {LEGEND_SECTIONS.map(s => (
              <SectionChip key={s.id} label={s.label} covered={(coverage[s.id] || 0) > 0} />
            ))}
          </div>
        </div>

        {/* ── Legend manager canvas (reused full-page manager) ── */}
        <div className="rounded-2xl overflow-hidden" style={{ ...LM_THEME.card }}>
          <LegendSheetsCanvas
            projectId={selectedProjectId || null}
            projectName={selectedProject?.name || ''}
          />
        </div>

        <ImportFromRepositoryModal
          open={repoOpen}
          onClose={() => setRepoOpen(false)}
          project={selectedProject}
          onImport={applyPack}
        />
      </div>
    </div>
  );
};

export default LegendManagerPage;
