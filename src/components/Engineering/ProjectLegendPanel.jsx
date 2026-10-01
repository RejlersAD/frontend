/**
 * ProjectLegendPanel.jsx — shared "Project Legend" status panel.
 *
 * Shows which legend a tool will resolve for the active project, following
 * the inheritance chain:
 *   Project legend pack (inherited) → user's active legend → built-in default
 *
 * Adopted by Line List / Equipment List / Instrument Index so engineers
 * configure a legend ONCE per project instead of per application.
 *
 * SOFT-CODED: section + labels via props; all colours from the V1 palette.
 *
 * Props:
 *   section      {string}  legend section code (e.g. 'line_list')
 *   projectId    {string}  active Project Organizer project_id (optional)
 *   projectName  {string}  display name for the project
 *   onManage     {func}    opens the LegendSheetsModal
 *   enabled      {bool}    false → render nothing
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BookOpenIcon, Cog6ToothIcon, ArrowUpTrayIcon } from '@heroicons/react/24/outline';
import { listLegends, uploadLegendPack } from '../../services/pidCheckerV2API';
import projectOrganizerService from '../../services/projectOrganizerService';

// SOFT-CODED: enable name-based bridging so tools whose projects live only in
// localStorage (e.g. Instrument Index) still attach to a shared Project
// Organizer project by matching name (case-insensitive). No backend change.
const RESOLVE_PROJECT_BY_NAME = true;

const ProjectLegendPanel = ({
  section,
  projectId = null,
  projectName = '',
  onManage,
  enabled = true,
  refreshToken = 0,          // bump to force re-fetch (e.g. after modal closes)
}) => {
  const [activeLegend, setActiveLegend] = useState(null);   // resolved legend
  const [inherited, setInherited]       = useState(false);  // came from project pack?
  const [loaded, setLoaded]             = useState(false);
  const [resolvedProjectId, setResolvedProjectId] = useState(projectId || null);

  // Phase 2: AI legend-pack upload state
  const packInputRef = useRef(null);
  const [packBusy, setPackBusy]   = useState(false);
  const [packMsg, setPackMsg]     = useState(null); // { tone: 'ok'|'err', text }

  const handlePackUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !resolvedProjectId) return;
    setPackBusy(true); setPackMsg(null);
    try {
      const res = await uploadLegendPack({ file, projectId: resolvedProjectId, name: projectName });
      setPackMsg({ tone: 'ok', text: `Legend pack applied — ${res.sections} section${res.sections === 1 ? '' : 's'} configured for this project (${res.method}).` });
      refresh();
    } catch (err) {
      setPackMsg({ tone: 'err', text: err?.response?.data?.error || 'Legend pack upload failed.' });
    } finally {
      setPackBusy(false);
    }
  };

  // Bridge: resolve a shared Project Organizer project_id from the name when
  // the caller only has a local project (Instrument Index). Runs once per name.
  useEffect(() => {
    if (projectId) { setResolvedProjectId(projectId); return; }
    if (!RESOLVE_PROJECT_BY_NAME || !projectName) { setResolvedProjectId(null); return; }
    let live = true;
    (async () => {
      try {
        const items = await projectOrganizerService.listProjects({ q: projectName });
        const match = (items || []).find(p => (p.name || '').toLowerCase() === projectName.toLowerCase())
                   || (items || [])[0] || null;
        if (live) setResolvedProjectId(match?.project_id || null);
      } catch {
        if (live) setResolvedProjectId(null);
      }
    })();
    return () => { live = false; };
  }, [projectId, projectName]);

  const refresh = useCallback(async () => {
    if (!enabled || !section) return;
    try {
      const rows = await listLegends(section, resolvedProjectId || undefined);
      const list = rows || [];
      // Prefer an ACTIVE row; within a project scope prefer the inherited one.
      const active = list.find(l => l.is_active && l.inherited)
                  || list.find(l => l.is_active)
                  || list.find(l => l.inherited)
                  || null;
      setActiveLegend(active);
      setInherited(!!active?.inherited);
    } catch {
      /* non-fatal — legend is optional */
    } finally {
      setLoaded(true);
    }
  }, [enabled, section, resolvedProjectId]);

  useEffect(() => { refresh(); }, [refresh, refreshToken]);

  if (!enabled) return null;

  const statusColor = activeLegend ? (inherited ? '#6366f1' : '#10b981') : '#3b82f6';
  const statusLabel = !loaded
    ? 'Loading legend…'
    : activeLegend
      ? (inherited ? 'Project Legend (inherited)' : 'Custom Legend Active')
      : 'Using Built-in Defaults';

  return (
    <div className="rounded-2xl mb-4 overflow-hidden" style={{
      background: 'white',
      border: '1px solid rgba(59,130,246,0.18)',
      boxShadow: '0 2px 16px rgba(59,130,246,0.07)',
    }}>
      {/* Panel header — V1 legend panel style */}
      <div className="px-5 py-3.5 flex items-center gap-3"
        style={{ background: 'linear-gradient(90deg, rgba(59,130,246,0.06), rgba(99,102,241,0.08))', borderBottom: '1px solid rgba(59,130,246,0.14)' }}>
        <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: 'linear-gradient(135deg,#3b82f6,#6366f1)', boxShadow: '0 4px 12px rgba(59,130,246,0.35)' }}>
          <BookOpenIcon className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-bold text-slate-800 leading-tight">Legend Sheets</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {resolvedProjectId ? `One legend per project — shared by every tool${projectName ? ` in "${projectName}"` : ''}` : 'Managed once — applied to every extraction'}
          </p>
        </div>
        {resolvedProjectId && (
          <>
            <input ref={packInputRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.tiff,.tif,.bmp" className="hidden" onChange={handlePackUpload} />
            <button onClick={() => packInputRef.current?.click()} disabled={packBusy}
              title="Upload one project legend pack (PDF/image) — AI splits it into every section automatically"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-bold transition-all hover:-translate-y-0.5 disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg,#8b5cf6,#6366f1)', boxShadow: '0 4px 12px rgba(139,92,246,0.35)' }}>
              <ArrowUpTrayIcon className="w-4 h-4" /> {packBusy ? 'Applying…' : 'Upload Pack (AI)'}
            </button>
          </>
        )}
        {onManage && (
          <button onClick={onManage}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-bold transition-all hover:-translate-y-0.5"
            style={{ background: 'linear-gradient(135deg,#3b82f6,#6366f1)', boxShadow: '0 4px 12px rgba(59,130,246,0.35)' }}>
            <Cog6ToothIcon className="w-4 h-4" /> Manage Legends
          </button>
        )}
      </div>

      {/* Status row */}
      <div className="px-5 py-4 flex items-start gap-4 flex-wrap">
        {packMsg && (
          <div className="w-full mb-1 px-3 py-2 rounded-lg text-xs font-semibold"
            style={packMsg.tone === 'ok'
              ? { background: '#f0fdf4', border: '1px solid #86efac', color: '#15803d' }
              : { background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c' }}>
            {packMsg.text}
          </div>
        )}
        <div className="flex-1 min-w-[220px]">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{
              background: statusColor,
              animation: activeLegend ? 'pulse 2s ease-in-out infinite' : 'none',
            }} />
            <span className="text-sm font-semibold text-slate-700">{statusLabel}</span>
            {inherited && (
              <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(99,102,241,0.10)', color: '#6366f1', border: '1px solid rgba(99,102,241,0.25)' }}>
                Project Pack
              </span>
            )}
          </div>
          {activeLegend ? (
            <div className="pl-4">
              <p className="text-sm text-slate-600 mb-0.5">
                <span className="font-bold" style={{ color: inherited ? '#6366f1' : '#059669' }}>{activeLegend.name}</span>
              </p>
              <p className="text-xs text-slate-500">
                {activeLegend.definition?.fields?.length || 0} custom fields defined
                {activeLegend.definition?.sections ? ` · ${Object.keys(activeLegend.definition.sections).length} sections` : ''}
              </p>
            </div>
          ) : loaded && (
            <div className="pl-4">
              <p className="text-sm text-slate-600 mb-0.5">Industry-standard legend with smart recognition</p>
              <p className="text-xs text-slate-500">
                {resolvedProjectId
                  ? 'No project legend pack yet — open Manage Legends and save one to this project to share it across all tools'
                  : 'Resolves codes & descriptions automatically for 90%+ of drawings'}
              </p>
            </div>
          )}
        </div>
        <div className="flex-shrink-0 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2" style={{ maxWidth: 320 }}>
          <p className="text-xs font-semibold text-blue-800 mb-0.5">🔄 Configure once per project</p>
          <p className="text-xs text-blue-600 leading-snug">
            A legend saved to the active project is inherited by Line List, Equipment List, Instrument Index and P&ID QC — no per-app setup.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ProjectLegendPanel;
