import { radaiAlert } from '../../../services/radaiDialog'
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
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  CircleStackIcon,
  DocumentTextIcon,
  SparklesIcon,
  CpuChipIcon,
  TableCellsIcon,
  WrenchScrewdriverIcon,
  ArrowPathIcon,
  FunnelIcon,
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
import { SPEC_CUSTOMIZATION_UI } from '../../../config/specCustomizationUI.config';
import PaperSpecExtractor from './components/PaperSpecExtractor';
import ComponentMatchingWorkbookManager from './components/ComponentMatchingWorkbookManager';

// ─── Soft-coded feature flags ──────────────────────────────────────────────
const HUB_FEATURE_FLAGS = {
  SHOW_PAPER_SPEC_EXTRACTOR: true,   // live AI multi-format extractor
  SHOW_REFERENCE_WORKBOOKS:   true,  // project CAT/SPEC/matching reference set
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

// ─── Soft-coded visual theme (align with HR Employees look) ───────────────
const SPEC_UI_THEME = {
  headerIconGradient: 'from-slate-900 via-blue-900 to-indigo-900',
  primaryGradient: 'from-blue-600 to-indigo-600',
  primaryGradientHover: 'hover:from-blue-700 hover:to-indigo-700',
  accentText: 'text-blue-700 dark:text-blue-300',
  accentTextStrong: 'text-blue-600 dark:text-blue-300',
  accentSoftBg: 'bg-blue-50 dark:bg-blue-900/20',
  accentBorder: 'border-blue-200 dark:border-blue-800/40',
  accentRing: 'focus:ring-blue-500 focus:border-blue-500',
  activeBanner: 'border-blue-200 dark:border-blue-800/40 bg-gradient-to-r from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900/40 dark:via-blue-900/20 dark:to-indigo-900/20',
  activePill: 'text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/40',
  rowActionBtn: 'bg-blue-600 hover:bg-blue-700 text-white',
};

const PROJECT_CREATION_CFG = {
  title: 'Create New Project',
  subtitle: 'Define scope and target deliverables so extraction outputs are project-ready.',
  modalWidthClass: 'max-w-4xl',
  objectivePlaceholder: 'e.g. Build smartplant-ready piping classes and component workbook for FEED release',
  maxObjectiveLen: 220,
  phaseOptions: [
    { value: 'concept', label: 'Concept' },
    { value: 'feed', label: 'FEED' },
    { value: 'detailed_design', label: 'Detailed Design' },
    { value: 'construction', label: 'Construction' },
    { value: 'as_built', label: 'As-built' },
  ],
  readinessOptions: [
    { value: 'draft', label: 'Draft workspace' },
    { value: 'review', label: 'Review-ready outputs' },
    { value: 'handover', label: 'Client handover pack' },
  ],
  deliverableLibrary: [
    { id: 'piping_class_register', label: 'Piping Class Register', hint: 'Validated class list by service/material', recommended: true },
    { id: 'spec_workbook', label: 'SPEC Workbook', hint: 'SmartPlant SPEC export (bulk load)' },
    { id: 'cat_workbook', label: 'CAT Workbook', hint: 'Component CAT export for catalogs', recommended: true },
    { id: 'component_gap_report', label: 'Component Gap Report', hint: 'Missing material standards and sizing gaps' },
    { id: 'qa_release_note', label: 'QA Release Note', hint: 'Extraction confidence and reviewer notes' },
    { id: 'revision_delta_sheet', label: 'Revision Delta Sheet', hint: 'Changes between upload revisions' },
  ],
  disciplineTemplates: [
    {
      id: 'process',
      label: 'Process Team Starter',
      discipline: 'Process',
      defaults: ['piping_class_register', 'spec_workbook', 'component_gap_report'],
    },
    {
      id: 'piping',
      label: 'Piping Team Starter',
      discipline: 'Piping',
      defaults: ['piping_class_register', 'spec_workbook', 'cat_workbook', 'qa_release_note'],
    },
    {
      id: 'digital_handover',
      label: 'Digital Handover Starter',
      discipline: 'Digitization',
      defaults: ['spec_workbook', 'cat_workbook', 'revision_delta_sheet', 'qa_release_note'],
    },
  ],
  innovation: {
    readinessWeights: {
      objective: 15,
      name: 20,
      code: 10,
      plant: 10,
      client: 10,
      discipline: 10,
      deliverables: 25,
    },
    minDeliverablesForReady: 3,
    readyThreshold: 70,
    excellentThreshold: 85,
    codeParts: {
      fallbackPrefix: 'SPC',
      phaseMap: {
        concept: 'CON',
        feed: 'FED',
        detailed_design: 'DED',
        construction: 'CONSTR',
        as_built: 'ASB',
      },
    },
    readinessHints: {
      low: 'Add client/plant context and at least one more deliverable to improve project clarity.',
      medium: 'Good start. Consider adding a project code and one QA deliverable before kickoff.',
      high: 'Great setup. This workspace is ready for extraction and structured handover.',
    },
  },
};

const compactToken = (v) =>
  String(v || '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, ' ')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((x) => x.slice(0, 3))
    .join('');

// ─── Soft-coded roadmap (compact cards) ────────────────────────────────────
const roadmapTools = [
  { id: 'piping_spec_gen',     name: 'Piping Spec Generator',   description: 'Generate project-specific PMS from reference docs and project criteria.', icon: WrenchScrewdriverIcon, gradient: 'from-slate-800 to-blue-700',   badge: 'AI · Planned' },
  { id: 'instrument_spec_gen', name: 'Instrument Spec Builder', description: 'Generate instrument datasheets from Instrument Index with AI parameter fill.', icon: CpuChipIcon, gradient: 'from-blue-600 to-indigo-700', badge: 'AI · Planned' },
  { id: 'equipment_spec_gen',  name: 'Equipment Spec Generator', description: 'Create detailed equipment specs from uploaded PFD, HMB and equipment data.', icon: CircleStackIcon, gradient: 'from-indigo-600 to-slate-700', badge: 'AI · Planned' },
  { id: 'document_templating', name: 'Document Templating',     description: 'Upload your template once; AI auto-fills repetitive fields across spec sheets.', icon: DocumentTextIcon, gradient: 'from-sky-600 to-indigo-700', badge: 'Planned' },
  { id: 'spec_qa_checker',     name: 'Spec QA Checker',         description: 'Cross-check specifications against project data book, P&IDs and line list.', icon: FunnelIcon, gradient: 'from-cyan-600 to-blue-700', badge: 'Planned' },
  { id: 'revision_manager',    name: 'Revision Manager',        description: 'Track and compare specification revisions with auto-generated change notes.', icon: ArrowPathIcon, gradient: 'from-blue-600 to-slate-800', badge: 'Planned' },
  { id: 'spec_catalogue',      name: 'Spec Catalogue',          description: 'Central library of approved specs, BOQs and standard drawings for reuse.', icon: TableCellsIcon, gradient: 'from-indigo-700 to-blue-600', badge: 'Planned' },
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
  const location = useLocation();

  const [projects, setProjects]               = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadError, setLoadError]             = useState('');
  const [activeProject, setActiveProject]     = useState(null);
  const [switcherOpen, setSwitcherOpen]       = useState(false);
  const [createOpen, setCreateOpen]           = useState(false);
  const [busy, setBusy]                       = useState(false);
  const [viewingJobId, setViewingJobId]       = useState(null); // for history table → detail view
  const [workspaceMode, setWorkspaceMode]     = useState(() => (
    new URLSearchParams(location.search).get('stage') === 'reference' ? 'reference' : 'extract'
  ));

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

  useEffect(() => {
    setWorkspaceMode(new URLSearchParams(location.search).get('stage') === 'reference' ? 'reference' : 'extract');
  }, [location.search]);

  const handleWorkspaceModeChange = (mode) => {
    const params = new URLSearchParams(location.search);
    if (mode === 'reference') {
      params.set('stage', 'reference');
      setViewingJobId(null);
    } else {
      params.delete('stage');
    }
    setWorkspaceMode(mode);
    const search = params.toString();
    navigate({ pathname: location.pathname, search: search ? `?${search}` : '' });
  };

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
          ai_enabled: activeProject.ai_enabled,
          ai_provider: activeProject.ai_provider,
          ai_model: activeProject.ai_model,
          ai_key_configured: activeProject.ai_key_configured,
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
      await radaiAlert(err?.response?.data?.error || 'Could not create project.');
    } finally {
      setBusy(false);
    }
  };

  const handleSwitch = (p) => {
    setActiveProject(p);
    setSwitcherOpen(false);
    setViewingJobId(null);
    handleWorkspaceModeChange('extract');
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
    <div>
      <div className="w-full">
        <div className="mb-4 flex justify-end">
          <ProjectSwitcher
            projects={projects}
            activeProject={activeProject}
            open={switcherOpen}
            loading={loadingProjects}
            onToggle={() => setSwitcherOpen((value) => !value)}
            onClose={() => setSwitcherOpen(false)}
            onSwitch={handleSwitch}
            onCreate={() => { setSwitcherOpen(false); setCreateOpen(true); }}
            onClear={handleClearActive}
            onManage={() => navigate(PROJECT_HUB_CFG.manageRoute)}
          />
        </div>

        {loadError && (
          <div className="mb-4 flex items-start gap-2 p-3 rounded-lg border border-red-200 bg-red-50 text-red-800 text-sm">
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
            <div className="mb-3 flex items-center justify-between gap-3 flex-wrap rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-gray-800 px-3 py-2.5 shadow-sm">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-1.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
                  <FolderOpenIcon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-semibold uppercase text-slate-500">Active project</span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white truncate max-w-[28rem]">
                      {activeProject.name}
                    </span>
                    {activeProject.code && (
                      <span className={`text-[11px] px-1.5 py-0.5 rounded bg-white/70 dark:bg-gray-800/60 border ${SPEC_UI_THEME.activePill}`}>
                        {activeProject.code}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleClearActive}
                  className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border hover:bg-white/60 dark:hover:bg-gray-800/40 ${SPEC_UI_THEME.activePill}`}
                >
                  <XMarkIcon className="w-3.5 h-3.5" /> Switch
                </button>
                <button
                  type="button"
                  onClick={() => navigate(PROJECT_HUB_CFG.manageRoute)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border hover:bg-white/60 dark:hover:bg-gray-800/40 ${SPEC_UI_THEME.activePill}`}
                >
                  <Squares2X2Icon className="w-3.5 h-3.5" /> Manage
                </button>
              </div>
            </div>

            <div className="mb-4 border-b border-slate-200 dark:border-slate-700 pb-3">
              <div className="flex items-end justify-between gap-3 flex-wrap mb-2">
                <div>
                  <div className="text-[10px] font-semibold uppercase text-slate-500">{SPEC_CUSTOMIZATION_UI.workspace.eyebrow}</div>
                  <div className="text-sm font-semibold text-gray-900 dark:text-white mt-0.5">{SPEC_CUSTOMIZATION_UI.workspace.title}</div>
                </div>
                <span className="text-[11px] text-slate-500">{SPEC_CUSTOMIZATION_UI.workspace.scope}</span>
              </div>
              <div className="inline-flex w-full sm:w-auto rounded-md border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 p-1" role="tablist" aria-label="Customization workflow">
                <button
                  type="button"
                  onClick={() => handleWorkspaceModeChange('reference')}
                  role="tab"
                  aria-selected={workspaceMode === 'reference'}
                  className={`flex-1 sm:flex-none rounded px-3 py-2 text-left transition-colors ${workspaceMode === 'reference'
                    ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'}`}
                >
                  <div className="flex items-center gap-2">
                    <TableCellsIcon className="w-4 h-4" />
                    <span className="text-xs font-semibold">1. Reference workbooks</span>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => handleWorkspaceModeChange('extract')}
                  role="tab"
                  aria-selected={workspaceMode === 'extract'}
                  className={`flex-1 sm:flex-none rounded px-3 py-2 text-left transition-colors ${workspaceMode === 'extract'
                    ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'}`}
                >
                  <div className="flex items-center gap-2">
                    <SparklesIcon className="w-4 h-4" />
                    <span className="text-xs font-semibold">2. Extract, review and publish</span>
                  </div>
                </button>
              </div>
            </div>

            {HUB_FEATURE_FLAGS.SHOW_REFERENCE_WORKBOOKS && workspaceMode === 'reference' && (
              <div className="mb-10">
                <ComponentMatchingWorkbookManager projectId={activeProject.project_id} />
              </div>
            )}

            {/* Job History Table */}
            {HUB_FEATURE_FLAGS.SHOW_PAPER_SPEC_EXTRACTOR && workspaceMode === 'extract' && !viewingJobId && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <DocumentTextIcon className="h-5 w-5 text-blue-600" />
                    Extraction History
                  </h3>
                  <button
                    onClick={() => fetchProjectJobs(activeProject.project_id)}
                    className="text-sm text-blue-700 dark:text-blue-300 hover:text-blue-900 dark:hover:text-blue-100 flex items-center gap-1"
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
                                  className={`px-3 py-1.5 rounded-lg transition-all font-medium text-xs ${SPEC_UI_THEME.rowActionBtn}`}
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
            {HUB_FEATURE_FLAGS.SHOW_PAPER_SPEC_EXTRACTOR && workspaceMode === 'extract' && viewingJobId && (
              <div className="mb-10">
                <button
                  type="button"
                  onClick={() => setViewingJobId(null)}
                  className="mb-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  ← Back to History
                </button>
                <PaperSpecExtractor
                  projectId={activeProject.project_id}
                  projectByok={{
                    enabled: activeProject.ai_enabled,
                    provider: activeProject.ai_provider,
                    model: activeProject.ai_model,
                    keyConfigured: activeProject.ai_key_configured,
                  }}
                  jobId={viewingJobId}
                />
              </div>
            )}
            {HUB_FEATURE_FLAGS.SHOW_PAPER_SPEC_EXTRACTOR && workspaceMode === 'extract' && !viewingJobId && (
              <div className="mb-10">
                <PaperSpecExtractor
                  projectId={activeProject.project_id}
                  projectByok={{
                    enabled: activeProject.ai_enabled,
                    provider: activeProject.ai_provider,
                    model: activeProject.ai_model,
                    keyConfigured: activeProject.ai_key_configured,
                  }}
                />
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
    <div className="rounded-2xl border border-blue-200 dark:border-blue-800/40 bg-gradient-to-br from-white via-slate-50/60 to-blue-50/50 dark:from-gray-900 dark:via-slate-900/20 dark:to-blue-900/20 shadow-sm overflow-hidden">
      <div className="px-8 py-10 text-center border-b border-blue-100 dark:border-blue-900/30">
        <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br ${SPEC_UI_THEME.headerIconGradient} text-white shadow-lg mb-4`}>
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
            className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-gradient-to-r ${SPEC_UI_THEME.primaryGradient} ${SPEC_UI_THEME.primaryGradientHover} shadow-sm`}
          >
            <PlusIcon className="w-4 h-4" /> Create new project
          </button>
          {hasProjects && (
            <button
              onClick={onManage}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50 hover:bg-blue-50 dark:hover:bg-blue-900/20"
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
                className="text-xs font-semibold text-blue-700 dark:text-blue-300 hover:underline"
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
      className="group text-left p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md transition-all"
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="min-w-0">
          <div className="text-sm font-bold text-gray-900 dark:text-white truncate group-hover:text-blue-700 dark:group-hover:text-blue-300">
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
        <span className="text-blue-600 dark:text-blue-400 font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
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
        className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg shadow-sm transition-colors disabled:opacity-50"
        title="Switch project"
      >
        <FolderIcon className="w-4 h-4 text-blue-600" />
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
              <FolderIcon className="w-4 h-4 text-blue-600" />
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
                          ? 'bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                      }`}
                    >
                      <div className={`mt-0.5 w-4 h-4 shrink-0 ${active ? 'text-blue-600' : 'text-transparent'}`}>
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
                className={`inline-flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-semibold text-white bg-gradient-to-r ${SPEC_UI_THEME.primaryGradient} ${SPEC_UI_THEME.primaryGradientHover} rounded transition-colors`}
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
  const [objective, setObjective] = useState('');
  const [phase, setPhase] = useState(PROJECT_CREATION_CFG.phaseOptions[1]?.value || 'feed');
  const [readiness, setReadiness] = useState(PROJECT_CREATION_CFG.readinessOptions[0]?.value || 'draft');
  const [selectedDeliverables, setSelectedDeliverables] = useState(
    PROJECT_CREATION_CFG.deliverableLibrary.filter((d) => d.recommended).map((d) => d.id),
  );
  const [showAdvanced, setShowAdvanced] = useState(false);
  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const canSubmit = form.name.trim().length > 0 && !busy;

  const readinessSummary = useMemo(() => {
    const w = PROJECT_CREATION_CFG.innovation.readinessWeights;
    let score = 0;
    if (objective.trim()) score += w.objective;
    if (form.name.trim()) score += w.name;
    if (form.code.trim()) score += w.code;
    if (form.plant.trim()) score += w.plant;
    if (form.client.trim()) score += w.client;
    if (form.discipline.trim()) score += w.discipline;
    const deliverableRatio = Math.min(
      1,
      selectedDeliverables.length / Math.max(1, PROJECT_CREATION_CFG.innovation.minDeliverablesForReady),
    );
    score += Math.round(w.deliverables * deliverableRatio);

    const band = score >= PROJECT_CREATION_CFG.innovation.excellentThreshold
      ? 'high'
      : score >= PROJECT_CREATION_CFG.innovation.readyThreshold
        ? 'medium'
        : 'low';

    return {
      score: Math.min(100, score),
      band,
      hint: PROJECT_CREATION_CFG.innovation.readinessHints[band],
    };
  }, [objective, form, selectedDeliverables]);

  const suggestProjectCode = () => {
    const phaseCode = PROJECT_CREATION_CFG.innovation.codeParts.phaseMap[phase] || 'GEN';
    const prefix = compactToken(form.client) || PROJECT_CREATION_CFG.innovation.codeParts.fallbackPrefix;
    const plant = compactToken(form.plant) || compactToken(form.name) || 'PRJ';
    update('code', `${prefix}-${phaseCode}-${plant}`.slice(0, 64));
    setShowAdvanced(true);
  };

  const applyTemplate = (tpl) => {
    setSelectedDeliverables(tpl.defaults);
    if (!form.discipline) update('discipline', tpl.discipline);
  };

  const toggleDeliverable = (id) => {
    setSelectedDeliverables((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleSubmit = (e) => {
    e?.preventDefault?.();
    if (!canSubmit) return;

    const selectedDeliverableObjects = PROJECT_CREATION_CFG.deliverableLibrary
      .filter((item) => selectedDeliverables.includes(item.id))
      .map((item) => ({ id: item.id, label: item.label }));

    onSubmit({
      ...form,
      name: form.name.trim().slice(0, PROJECT_HUB_CFG.nameMaxLen),
      description: form.description.slice(0, PROJECT_HUB_CFG.descMaxLen),
      tags: selectedDeliverables,
      metadata: {
        objective: objective.slice(0, PROJECT_CREATION_CFG.maxObjectiveLen),
        phase,
        readiness,
        deliverables: selectedDeliverableObjects,
      },
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <form
        onSubmit={handleSubmit}
        className={`w-full ${PROJECT_CREATION_CFG.modalWidthClass} bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]`}
      >
        <div className="flex items-center gap-3 px-5 py-4 bg-gradient-to-r from-slate-50 to-blue-50 dark:from-slate-900/20 dark:to-blue-900/20 border-b border-blue-100 dark:border-blue-900/30">
          <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${SPEC_UI_THEME.headerIconGradient} text-white flex items-center justify-center shadow-sm`}>
            <FolderIcon className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-bold text-gray-900 dark:text-white">{PROJECT_CREATION_CFG.title}</h2>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              {PROJECT_CREATION_CFG.subtitle}
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-white/60 dark:hover:bg-gray-700/50">
            <XMarkIcon className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="px-5 py-4 overflow-y-auto space-y-4">
          <div className="rounded-lg border border-blue-100 dark:border-blue-900/30 bg-blue-50/60 dark:bg-blue-900/10 p-3">
            <div className="flex items-center justify-between gap-3 mb-2">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wide text-gray-700 dark:text-gray-200">Workspace Readiness</div>
                <div className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{readinessSummary.hint}</div>
              </div>
              <div className="text-right">
                <div className="text-xl font-extrabold text-blue-700 dark:text-blue-300">{readinessSummary.score}%</div>
                <div className="text-[10px] text-gray-500">planning score</div>
              </div>
            </div>
            <div className="h-2 rounded-full bg-white dark:bg-gray-800 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all"
                style={{ width: `${readinessSummary.score}%` }}
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wide text-gray-700 dark:text-gray-200 mb-1.5">
              Project Objective
            </label>
            <textarea
              rows={2}
              maxLength={PROJECT_CREATION_CFG.maxObjectiveLen}
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              placeholder={PROJECT_CREATION_CFG.objectivePlaceholder}
              className="w-full px-3 py-2.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y"
            />
          </div>

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
              className="w-full px-3 py-2.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <div className="mt-1.5 flex items-center gap-2">
              <button
                type="button"
                onClick={suggestProjectCode}
                className="text-[11px] font-semibold text-blue-700 dark:text-blue-300 hover:underline"
              >
                Smart code suggestion
              </button>
              <span className="text-[10px] text-gray-500">Generates Code from client, phase and plant</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wide text-gray-700 dark:text-gray-200 mb-1.5">
                Delivery Phase
              </label>
              <select
                value={phase}
                onChange={(e) => setPhase(e.target.value)}
                className="w-full px-2.5 py-2 text-sm rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
              >
                {PROJECT_CREATION_CFG.phaseOptions.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wide text-gray-700 dark:text-gray-200 mb-1.5">
                Output Readiness
              </label>
              <select
                value={readiness}
                onChange={(e) => setReadiness(e.target.value)}
                className="w-full px-2.5 py-2 text-sm rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
              >
                {PROJECT_CREATION_CFG.readinessOptions.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="rounded-lg border border-blue-100 dark:border-blue-900/30 bg-blue-50/60 dark:bg-blue-900/10 p-3">
            <div className="flex items-center justify-between gap-2 mb-2">
              <label className="block text-[11px] font-bold uppercase tracking-wide text-gray-700 dark:text-gray-200">
                Deliverables Template
              </label>
              <span className="text-[10px] text-gray-500">One click starter packs</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {PROJECT_CREATION_CFG.disciplineTemplates.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => applyTemplate(tpl)}
                  className="px-2.5 py-1.5 text-xs font-semibold rounded-full border border-blue-200 dark:border-blue-800/40 text-blue-700 dark:text-blue-300 bg-white dark:bg-gray-900 hover:bg-blue-100 dark:hover:bg-blue-900/30"
                >
                  {tpl.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <label className="block text-[11px] font-bold uppercase tracking-wide text-gray-700 dark:text-gray-200">
                Target Deliverables
              </label>
              <span className="text-[10px] text-gray-500">{selectedDeliverables.length} selected</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {PROJECT_CREATION_CFG.deliverableLibrary.map((item) => {
                const selected = selectedDeliverables.includes(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => toggleDeliverable(item.id)}
                    className={`text-left rounded-lg border px-3 py-2 transition-colors ${selected
                      ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/25'
                      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-blue-300'}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-gray-900 dark:text-white">{item.label}</span>
                      {selected ? (
                        <CheckIcon className="w-4 h-4 text-blue-600" />
                      ) : (
                        <span className="w-4 h-4 rounded-full border border-gray-300" />
                      )}
                    </div>
                    <div className="text-[11px] text-gray-500 mt-0.5">{item.hint}</div>
                  </button>
                );
              })}
            </div>
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
              className="w-full px-3 py-2.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y"
            />
          </div>

          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="text-xs font-semibold text-blue-700 dark:text-blue-300 hover:underline"
          >
            {showAdvanced ? '− Hide advanced fields' : '+ Add code, client, plant, discipline, status'}
          </button>

          {showAdvanced && (
            <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30">
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
            className={`inline-flex items-center gap-1.5 px-5 py-2 text-sm font-bold text-white rounded-lg bg-gradient-to-r ${SPEC_UI_THEME.primaryGradient} ${SPEC_UI_THEME.primaryGradientHover} disabled:opacity-50 disabled:cursor-not-allowed shadow-sm`}
          >
            <CheckIcon className="w-4 h-4" /> {busy ? 'Creating…' : 'Create project workspace'}
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
      className="w-full px-2.5 py-1.5 text-sm rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
    />
  </div>
);

export default SpecCustomizationPage;
