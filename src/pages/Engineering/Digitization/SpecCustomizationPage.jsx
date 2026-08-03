/**
 * Spec Customization — Hub Page
 * Route: /engineering/digitization/spec-customization
 *
 * Project-gated workflow (mirrors /engineering/piping/pms):
 *   1. On entry the user must select or create a project.
 *   2. Once a project is active, the Paper Spec Extractor is shown and
 *      every upload it issues is tagged with that project's UUID.
 *
 * The extractor itself is unchanged — the page only passes `projectId`
 * as a prop.  Projects are persisted server-side via the new
 * /api/v1/spec-customization/projects/ CRUD endpoints; the active
 * project is mirrored to localStorage so handoff between pages works.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CircleStackIcon,
  DocumentTextIcon,
  SparklesIcon,
  CpuChipIcon,
  TableCellsIcon,
  WrenchScrewdriverIcon,
  ArrowPathIcon,
  FunnelIcon,
  CheckCircleIcon,
  FolderIcon,
  FolderOpenIcon,
  PlusIcon,
  XMarkIcon,
  ChevronDownIcon,
  Squares2X2Icon,
  CheckIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import apiClient from '../../../services/api.service';
import specCustomizationAPI from '../../../services/specCustomizationAPI';
import PaperSpecExtractor from './components/PaperSpecExtractor';

// ─── Soft-coded feature flags ──────────────────────────────────────────────
const HUB_FEATURE_FLAGS = {
  SHOW_PAPER_SPEC_EXTRACTOR: true,   // live AI multi-format extractor
  SHOW_ROADMAP_GRID:         false,  // compact "coming next" strip
};

// ─── Soft-coded project-management config ──────────────────────────────────
const PROJECT_HUB_CFG = {
  storageKey:  'specCustomActiveProject',
  manageRoute: '/engineering/digitization/spec-customization/projects',
  api: {
    list: '/spec-customization/projects/',
  },
  statuses: [
    { value: 'active',    label: 'Active',    dot: 'bg-emerald-500' },
    { value: 'on_hold',   label: 'On hold',   dot: 'bg-amber-500'   },
    { value: 'completed', label: 'Completed', dot: 'bg-blue-500'    },
    { value: 'archived',  label: 'Archived',  dot: 'bg-gray-400'    },
  ],
  nameMaxLen: 80,
  descMaxLen: 240,
};

// ─── Soft-coded roadmap (compact cards) ────────────────────────────────────
const roadmapTools = [
  { id: 'piping_spec_gen',     name: 'Piping Spec Generator',   description: 'Generate project-specific PMS from reference docs and project criteria.', icon: WrenchScrewdriverIcon, gradient: 'from-pink-500 to-rose-600',   badge: 'AI · Planned' },
  { id: 'instrument_spec_gen', name: 'Instrument Spec Builder', description: 'Generate instrument datasheets from Instrument Index with AI parameter fill.', icon: CpuChipIcon, gradient: 'from-purple-500 to-pink-600', badge: 'AI · Planned' },
  { id: 'equipment_spec_gen',  name: 'Equipment Spec Generator', description: 'Create detailed equipment specs from uploaded PFD, HMB and equipment data.', icon: CircleStackIcon, gradient: 'from-rose-500 to-pink-700', badge: 'AI · Planned' },
  { id: 'document_templating', name: 'Document Templating',     description: 'Upload your template once; AI auto-fills repetitive fields across spec sheets.', icon: DocumentTextIcon, gradient: 'from-pink-600 to-fuchsia-600', badge: 'Planned' },
  { id: 'spec_qa_checker',     name: 'Spec QA Checker',         description: 'Cross-check specifications against project data book, P&IDs and line list.', icon: FunnelIcon, gradient: 'from-fuchsia-500 to-pink-600', badge: 'Planned' },
  { id: 'revision_manager',    name: 'Revision Manager',        description: 'Track and compare specification revisions with auto-generated change notes.', icon: ArrowPathIcon, gradient: 'from-pink-500 to-purple-600', badge: 'Planned' },
  { id: 'spec_catalogue',      name: 'Spec Catalogue',          description: 'Central library of approved specs, BOQs and standard drawings for reuse.', icon: TableCellsIcon, gradient: 'from-purple-600 to-rose-500', badge: 'Planned' },
];

// ─── Cost formatting helper ────────────────────────────────────────────────
const SPEC_COST_DECIMAL_PLACES = 4;
const formatSpecCost = (costUsd) => {
  const cost = Number(costUsd) || 0;
  if (cost <= 0) return 'Free';
  return `$${cost.toFixed(SPEC_COST_DECIMAL_PLACES)}`;
};

// ───────────────────────────────────────────────────────────────────────────
const SpecCustomizationPage = () => {
  const navigate = useNavigate();

  const [projects, setProjects]               = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadError, setLoadError]             = useState('');
  const [activeProject, setActiveProject]     = useState(null);
  const [switcherOpen, setSwitcherOpen]       = useState(false);
  const [createOpen, setCreateOpen]           = useState(false);
  const [busy, setBusy]                       = useState(false);
  const [viewingJobId, setViewingJobId]       = useState(null); // for history table → detail view

  // Job history state
  const [projectJobs, setProjectJobs]         = useState([]);
  const [loadingJobs, setLoadingJobs]         = useState(false);

  // ── Fetch projects + restore active project from localStorage on mount.
  const loadProjects = useCallback(async () => {
    setLoadingProjects(true);
    try {
      const res = await apiClient.get(PROJECT_HUB_CFG.api.list);
      const list = Array.isArray(res.data?.items) ? res.data.items : [];
      setProjects(list);
      setLoadError('');

      let restored = null;
      try {
        const raw = localStorage.getItem(PROJECT_HUB_CFG.storageKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.project_id) {
            restored = list.find((p) => p.project_id === parsed.project_id) || null;
          }
        }
      } catch (_) { /* ignore */ }
      setActiveProject(restored);
      return list;
    } catch (err) {
      setLoadError(err?.response?.data?.error || 'Could not load projects.');
      setProjects([]);
      return [];
    } finally {
      setLoadingProjects(false);
    }
  }, []);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  // Persist active project for cross-page handoff.
  useEffect(() => {
    try {
      if (activeProject) {
        localStorage.setItem(PROJECT_HUB_CFG.storageKey, JSON.stringify({
          project_id: activeProject.project_id,
          name:       activeProject.name,
          code:       activeProject.code,
          plant:      activeProject.plant,
          client:     activeProject.client,
          discipline: activeProject.discipline,
        }));
      }
    } catch (_) { /* ignore */ }
  }, [activeProject]);

  const handleCreate = async (payload) => {
    setBusy(true);
    try {
      const res = await apiClient.post(PROJECT_HUB_CFG.api.list, payload);
      const created = res.data;
      setProjects((prev) => [created, ...prev]);
      setActiveProject(created);
      setCreateOpen(false);
    } catch (err) {
      alert(err?.response?.data?.error || 'Could not create project.');
    } finally {
      setBusy(false);
    }
  };

  const handleSwitch = (p) => {
    setActiveProject(p);
    setSwitcherOpen(false);
  };

  // ── Fetch job history for the selected project ──
  const fetchProjectJobs = useCallback(async (projectId) => {
    if (!projectId) return;
    try {
      setLoadingJobs(true);
      const data = await specCustomizationAPI.listProjectJobs(projectId, { page: 1, page_size: 50 });
      if (data.success) {
        setProjectJobs(data.jobs || []);
      }
    } catch (err) {
      console.error('Error loading job history:', err);
      setProjectJobs([]);
    } finally {
      setLoadingJobs(false);
    }
  }, []);

  // Load job history when activeProject changes
  useEffect(() => {
    if (activeProject?.project_id) {
      fetchProjectJobs(activeProject.project_id);
    } else {
      setProjectJobs([]);
    }
  }, [activeProject?.project_id, fetchProjectJobs]);

  const handleClearActive = () => {
    setActiveProject(null);
    try { localStorage.removeItem(PROJECT_HUB_CFG.storageKey); } catch (_) { /* ignore */ }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">

        {/* ── Header ────────────────────────────────────────────────── */}
        <div className="mb-6 flex items-start justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-pink-500 to-fuchsia-600 text-white shadow-md">
              <SparklesIcon className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Spec Customization</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                AI-powered specification generation and quality assurance — project-organised.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <ProjectSwitcher
              projects={projects}
              activeProject={activeProject}
              open={switcherOpen}
              loading={loadingProjects}
              onToggle={() => setSwitcherOpen((v) => !v)}
              onClose={() => setSwitcherOpen(false)}
              onSwitch={handleSwitch}
              onCreate={() => { setSwitcherOpen(false); setCreateOpen(true); }}
              onClear={handleClearActive}
              onManage={() => navigate(PROJECT_HUB_CFG.manageRoute)}
            />
            <span className="px-2.5 py-1 bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300 rounded-full text-xs font-medium">
              Digitization
            </span>
            <span className="px-2.5 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-full text-xs font-medium inline-flex items-center gap-1">
              <CheckCircleIcon className="w-3.5 h-3.5" />
              1 Live
            </span>
          </div>
        </div>

        {loadError && (
          <div className="mb-4 flex items-start gap-2 p-3 rounded-lg border border-rose-200 bg-rose-50 text-rose-800 text-sm">
            <ExclamationTriangleIcon className="w-4 h-4 mt-0.5" />
            <div className="flex-1">{loadError}</div>
            <button onClick={loadProjects} className="text-xs font-semibold underline">Retry</button>
          </div>
        )}

        {/* ── Body ──────────────────────────────────────────────────── */}
        {loadingProjects ? (
          <div className="py-20 text-center text-gray-500 text-sm">Loading projects…</div>
        ) : !activeProject ? (
          <ProjectGate
            projects={projects}
            onPick={handleSwitch}
            onCreate={() => setCreateOpen(true)}
            onManage={() => navigate(PROJECT_HUB_CFG.manageRoute)}
          />
        ) : (
          <>
            {/* Active-project banner */}
            <div className="mb-5 flex items-center justify-between gap-3 flex-wrap rounded-xl border border-pink-200 dark:border-pink-800/50 bg-gradient-to-r from-pink-50 via-rose-50 to-fuchsia-50 dark:from-pink-900/20 dark:via-rose-900/15 dark:to-fuchsia-900/20 px-4 py-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 rounded-lg bg-gradient-to-br from-pink-500 to-fuchsia-600 text-white shadow-sm">
                  <FolderOpenIcon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-pink-700 dark:text-pink-300">Active project</span>
                    <span className="text-sm font-bold text-gray-900 dark:text-white truncate max-w-[28rem]">
                      {activeProject.name}
                    </span>
                    {activeProject.code && (
                      <span className="text-[11px] px-1.5 py-0.5 rounded bg-white/70 dark:bg-gray-800/60 text-pink-700 dark:text-pink-300 border border-pink-200 dark:border-pink-800/40">
                        {activeProject.code}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                    All extractions in this session will be tagged to this project.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleClearActive}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border border-pink-200 dark:border-pink-800/50 text-pink-700 dark:text-pink-300 hover:bg-white/60 dark:hover:bg-gray-800/40"
                >
                  <XMarkIcon className="w-3.5 h-3.5" /> Switch
                </button>
                <button
                  type="button"
                  onClick={() => navigate(PROJECT_HUB_CFG.manageRoute)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-pink-700 dark:text-pink-300 border border-pink-200 dark:border-pink-800/50 hover:bg-white/60 dark:hover:bg-gray-800/40"
                >
                  <Squares2X2Icon className="w-3.5 h-3.5" /> Manage
                </button>
              </div>
            </div>

            {/* Job History Table */}
            {HUB_FEATURE_FLAGS.SHOW_PAPER_SPEC_EXTRACTOR && !viewingJobId && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <DocumentTextIcon className="h-5 w-5 text-pink-500" />
                    Extraction History
                  </h3>
                  <button
                    onClick={() => fetchProjectJobs(activeProject.project_id)}
                    className="text-sm text-pink-700 dark:text-pink-300 hover:text-pink-900 dark:hover:text-pink-100 flex items-center gap-1"
                    disabled={loadingJobs}
                  >
                    <ArrowPathIcon className={`h-4 w-4 ${loadingJobs ? 'animate-spin' : ''}`} />
                    Refresh
                  </button>
                </div>

                {loadingJobs ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">Loading history...</div>
                ) : projectJobs.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 dark:text-gray-500 text-sm">
                    No extraction jobs yet for this project. Upload a document below to get started.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                          <th className="py-2 pr-4 font-medium">Name</th>
                          <th className="py-2 pr-4 font-medium">Date</th>
                          <th className="py-2 pr-4 font-medium">Engineer</th>
                          <th className="py-2 pr-4 font-medium">Status</th>
                          <th className="py-2 pr-4 font-medium">Components</th>
                          <th className="py-2 pr-4 font-medium">Classes</th>
                          <th className="py-2 pr-4 font-medium">Cost</th>
                          <th className="py-2 pr-4 font-medium text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {projectJobs.map((job) => (
                          <tr key={job.id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                            <td className="py-3 pr-4 font-medium text-gray-900 dark:text-white max-w-[220px] truncate" title={job.document_name}>
                              {job.document_name || `Job #${job.id}`}
                            </td>
                            <td className="py-3 pr-4 whitespace-nowrap text-gray-700 dark:text-gray-300">
                              {job.created_at ? new Date(job.created_at).toLocaleString() : '-'}
                            </td>
                            <td className="py-3 pr-4 text-gray-700 dark:text-gray-300">{job.user_name || '-'}</td>
                            <td className="py-3 pr-4">
                              <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                job.status === 'completed' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                job.status === 'failed'    ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                              }`}>
                                {job.status}
                              </span>
                            </td>
                            <td className="py-3 pr-4 text-gray-700 dark:text-gray-300">{job.components_count ?? 0}</td>
                            <td className="py-3 pr-4 text-gray-700 dark:text-gray-300">{job.classes_count ?? 0}</td>
                            <td className="py-3 pr-4 whitespace-nowrap text-gray-700 dark:text-gray-300" title="AI extraction cost">
                              {formatSpecCost(job.cost_usd)}
                            </td>
                            <td className="py-3 pr-4 text-right">
                              {job.status === 'completed' ? (
                                <button
                                  onClick={() => setViewingJobId(job.id)}
                                  className="px-3 py-1.5 bg-pink-500 text-white rounded-lg hover:bg-pink-600 transition-all font-medium text-xs"
                                >
                                  View
                                </button>
                              ) : (
                                <span className="text-xs text-gray-400 dark:text-gray-500">{job.status}</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* PRIMARY: Paper Spec Extractor (live AI panel) */}
            {HUB_FEATURE_FLAGS.SHOW_PAPER_SPEC_EXTRACTOR && viewingJobId && (
              <div className="mb-10">
                <button
                  type="button"
                  onClick={() => setViewingJobId(null)}
                  className="mb-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  ← Back to History
                </button>
                <PaperSpecExtractor projectId={activeProject.project_id} jobId={viewingJobId} />
              </div>
            )}
            {HUB_FEATURE_FLAGS.SHOW_PAPER_SPEC_EXTRACTOR && !viewingJobId && (
              <div className="mb-10">
                <PaperSpecExtractor projectId={activeProject.project_id} />
              </div>
            )}
          </>
        )}

        {/* ROADMAP */}
        {HUB_FEATURE_FLAGS.SHOW_ROADMAP_GRID && roadmapTools.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Roadmap — coming next</h2>
              <span className="text-xs text-gray-500">{roadmapTools.length} tools planned</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {roadmapTools.map((tool) => {
                const Icon = tool.icon;
                return (
                  <div key={tool.id} className="relative bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 opacity-80 hover:opacity-100 transition-opacity overflow-hidden" title={tool.description}>
                    <div className={`h-1 -mx-3 -mt-3 mb-2 bg-gradient-to-r ${tool.gradient}`} />
                    <div className="flex items-start gap-2">
                      <div className={`p-1.5 rounded bg-gradient-to-r ${tool.gradient}`}>
                        <Icon className="w-4 h-4 text-white" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{tool.name}</p>
                        <span className="inline-block mt-0.5 px-1.5 py-0.5 text-[10px] font-medium rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">{tool.badge}</span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 line-clamp-2">{tool.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {createOpen && (
        <CreateProjectModal
          busy={busy}
          onClose={() => setCreateOpen(false)}
          onSubmit={handleCreate}
        />
      )}
    </div>
  );
};

// ───────────────────────────────────────────────────────────────────────────
// Project gate — empty/landing state when no project is active.
// ───────────────────────────────────────────────────────────────────────────
const ProjectGate = ({ projects, onPick, onCreate, onManage }) => {
  const hasProjects = projects.length > 0;
  return (
    <div className="rounded-2xl border border-pink-200 dark:border-pink-800/40 bg-gradient-to-br from-white via-pink-50/40 to-fuchsia-50/40 dark:from-gray-900 dark:via-pink-900/10 dark:to-fuchsia-900/10 shadow-sm overflow-hidden">
      <div className="px-8 py-10 text-center border-b border-pink-100 dark:border-pink-900/30">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-pink-500 to-fuchsia-600 text-white shadow-lg mb-4">
          <FolderIcon className="w-8 h-8" />
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
          {hasProjects ? 'Select a project to continue' : 'Create your first project to get started'}
        </h2>
        <p className="mt-2 max-w-2xl mx-auto text-sm text-gray-600 dark:text-gray-400">
          The Paper Spec Extractor needs a project context so every PDF you upload, every piping
          class extracted, and every workbook export stays organised under one engineering job.
        </p>
        <div className="mt-5 flex items-center justify-center gap-2 flex-wrap">
          <button
            onClick={onCreate}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-pink-600 to-fuchsia-600 hover:from-pink-700 hover:to-fuchsia-700 shadow-sm"
          >
            <PlusIcon className="w-4 h-4" /> Create new project
          </button>
          {hasProjects && (
            <button
              onClick={onManage}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-pink-700 dark:text-pink-300 border border-pink-200 dark:border-pink-800/50 hover:bg-pink-50 dark:hover:bg-pink-900/20"
            >
              <Squares2X2Icon className="w-4 h-4" /> Manage all projects
            </button>
          )}
        </div>
      </div>

      {hasProjects && (
        <div className="px-6 py-6 sm:px-8">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Your projects</h3>
            <span className="text-xs text-gray-500">{projects.length} total</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {projects.slice(0, 9).map((p) => (
              <ProjectPickerCard key={p.project_id} project={p} onClick={() => onPick(p)} />
            ))}
          </div>
          {projects.length > 9 && (
            <div className="mt-4 text-center">
              <button
                onClick={onManage}
                className="text-xs font-semibold text-pink-700 dark:text-pink-300 hover:underline"
              >
                + {projects.length - 9} more — open project manager
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const ProjectPickerCard = ({ project, onClick }) => {
  const meta = PROJECT_HUB_CFG.statuses.find((s) => s.value === project.status) || PROJECT_HUB_CFG.statuses[0];
  const total = (project.job_count || 0) + (project.document_count || 0);
  return (
    <button
      onClick={onClick}
      className="group text-left p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-pink-300 dark:hover:border-pink-700 hover:shadow-md transition-all"
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="min-w-0">
          <div className="text-sm font-bold text-gray-900 dark:text-white truncate group-hover:text-pink-700 dark:group-hover:text-pink-300">
            {project.name}
          </div>
          {project.code && (
            <div className="text-[11px] text-gray-500 truncate">{project.code}</div>
          )}
        </div>
        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-gray-600 dark:text-gray-400 px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 whitespace-nowrap">
          <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
          {meta.label}
        </span>
      </div>
      <div className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-2 min-h-[28px]">
        {project.description || 'No description.'}
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-gray-500">
        <span>{total} extraction{total === 1 ? '' : 's'}</span>
        <span className="text-pink-600 dark:text-pink-400 font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
          Open →
        </span>
      </div>
    </button>
  );
};

// ───────────────────────────────────────────────────────────────────────────
// Project switcher (header pill + popover) — mirrors PMS / ValveMTO.
// ───────────────────────────────────────────────────────────────────────────
const ProjectSwitcher = ({
  projects, activeProject, open, loading,
  onToggle, onClose, onSwitch, onCreate, onClear, onManage,
}) => {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={onToggle}
        disabled={loading}
        className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 hover:border-pink-400 hover:bg-pink-50 dark:hover:bg-pink-900/20 rounded-lg shadow-sm transition-colors disabled:opacity-50"
        title="Switch project"
      >
        <FolderIcon className="w-4 h-4 text-pink-600" />
        <span className="max-w-[200px] truncate">
          {loading ? 'Loading…' : (activeProject?.name || 'No project selected')}
        </span>
        <ChevronDownIcon className={`w-3.5 h-3.5 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={onClose} />
          <div className="absolute right-0 top-full mt-2 w-80 z-40 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl overflow-hidden">
            <div className="px-3 py-2.5 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2">
              <FolderIcon className="w-4 h-4 text-pink-600" />
              <div className="text-xs font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wide flex-1">Projects</div>
              <span className="text-[10px] text-gray-400">{projects.length}</span>
            </div>
            <div className="max-h-72 overflow-y-auto">
              {projects.length === 0 ? (
                <div className="px-3 py-6 text-center text-xs text-gray-500">
                  No projects yet.
                </div>
              ) : (
                projects.map((p) => {
                  const active = p.project_id === activeProject?.project_id;
                  const total = (p.job_count || 0) + (p.document_count || 0);
                  return (
                    <button
                      key={p.project_id}
                      onClick={() => onSwitch(p)}
                      className={`w-full text-left px-3 py-2 flex items-start gap-2 transition-colors ${
                        active
                          ? 'bg-pink-50 dark:bg-pink-900/20 hover:bg-pink-100 dark:hover:bg-pink-900/30'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                      }`}
                    >
                      <div className={`mt-0.5 w-4 h-4 shrink-0 ${active ? 'text-pink-600' : 'text-transparent'}`}>
                        <CheckIcon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">{p.name}</div>
                        <div className="text-[11px] text-gray-500 truncate">
                          {total} extraction{total === 1 ? '' : 's'}
                          {p.code ? ` · ${p.code}` : ''}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
            <div className="p-2 border-t border-gray-100 dark:border-gray-700 grid grid-cols-3 gap-1.5">
              <button
                onClick={onCreate}
                className="inline-flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-pink-600 to-fuchsia-600 hover:from-pink-700 hover:to-fuchsia-700 rounded transition-colors"
              >
                <PlusIcon className="w-3.5 h-3.5" /> New
              </button>
              <button
                onClick={onManage}
                className="inline-flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded transition-colors"
              >
                <Squares2X2Icon className="w-3.5 h-3.5" /> Manage
              </button>
              <button
                onClick={onClear}
                disabled={!activeProject}
                className="inline-flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded transition-colors disabled:opacity-40"
                title="Clear active project"
              >
                <XMarkIcon className="w-3.5 h-3.5" /> Clear
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// ───────────────────────────────────────────────────────────────────────────
// Create-project modal.
// ───────────────────────────────────────────────────────────────────────────
const CreateProjectModal = ({ busy, onClose, onSubmit }) => {
  const [form, setForm] = useState({
    name: '', code: '', client: '', plant: '', discipline: '', description: '', status: 'active',
  });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const canSubmit = form.name.trim().length > 0 && !busy;

  const handleSubmit = (e) => {
    e?.preventDefault?.();
    if (!canSubmit) return;
    onSubmit({
      ...form,
      name: form.name.trim().slice(0, PROJECT_HUB_CFG.nameMaxLen),
      description: form.description.slice(0, PROJECT_HUB_CFG.descMaxLen),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="flex items-center gap-3 px-5 py-4 bg-gradient-to-r from-pink-50 to-fuchsia-50 dark:from-pink-900/20 dark:to-fuchsia-900/20 border-b border-pink-100 dark:border-pink-900/30">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-pink-500 to-fuchsia-600 text-white flex items-center justify-center shadow-sm">
            <FolderIcon className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-bold text-gray-900 dark:text-white">Create new project</h2>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Group your paper-spec extractions under one engineering project.
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-white/60 dark:hover:bg-gray-700/50">
            <XMarkIcon className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="px-5 py-4 overflow-y-auto space-y-4">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wide text-gray-700 dark:text-gray-200 mb-1.5">
              Project name *
            </label>
            <input
              type="text"
              autoFocus
              required
              maxLength={PROJECT_HUB_CFG.nameMaxLen}
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              placeholder="e.g., ADNOC LNG Train-3 PMS"
              className="w-full px-3 py-2.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-pink-400 focus:border-pink-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wide text-gray-700 dark:text-gray-200 mb-1.5">
              Description <span className="text-gray-400 font-normal normal-case">(optional)</span>
            </label>
            <textarea
              rows={3}
              maxLength={PROJECT_HUB_CFG.descMaxLen}
              value={form.description}
              onChange={(e) => update('description', e.target.value)}
              placeholder="Brief project description…"
              className="w-full px-3 py-2.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-pink-400 focus:border-pink-500 resize-y"
            />
          </div>

          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="text-xs font-semibold text-pink-700 dark:text-pink-300 hover:underline"
          >
            {showAdvanced ? '− Hide advanced fields' : '+ Add code, client, plant, discipline, status'}
          </button>

          {showAdvanced && (
            <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-pink-50 dark:bg-pink-900/10 border border-pink-100 dark:border-pink-900/30">
              <ModalField label="Code"       value={form.code}       onChange={(v) => update('code', v)} />
              <ModalField label="Client"     value={form.client}     onChange={(v) => update('client', v)} />
              <ModalField label="Plant"      value={form.plant}      onChange={(v) => update('plant', v)} />
              <ModalField label="Discipline" value={form.discipline} onChange={(v) => update('discipline', v)} />
              <div className="col-span-2">
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300 mb-1">Status</label>
                <select
                  value={form.status}
                  onChange={(e) => update('status', e.target.value)}
                  className="w-full px-2.5 py-1.5 text-sm rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                >
                  {PROJECT_HUB_CFG.statuses.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-3 bg-gray-50 dark:bg-gray-900/40 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-white dark:hover:bg-gray-700/50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="inline-flex items-center gap-1.5 px-5 py-2 text-sm font-bold text-white rounded-lg bg-gradient-to-r from-pink-600 to-fuchsia-600 hover:from-pink-700 hover:to-fuchsia-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            <CheckIcon className="w-4 h-4" /> {busy ? 'Creating…' : 'Create project'}
          </button>
        </div>
      </form>
    </div>
  );
};

const ModalField = ({ label, value, onChange }) => (
  <div>
    <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300 mb-1">{label}</label>
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-2.5 py-1.5 text-sm rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-pink-400 focus:border-pink-500"
    />
  </div>
);

export default SpecCustomizationPage;
