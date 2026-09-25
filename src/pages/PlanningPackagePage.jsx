import PlanningExtractionCoverage from '../components/planning/PlanningExtractionCoverage'
import { radaiConfirm } from '../services/radaiDialog'
import React, { useState, useEffect, useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import { useNavigate, useLocation } from 'react-router-dom';
import apiClient from '../services/api.service';
import planningIntelligenceService from '../services/planningIntelligence.service';
import usePlanningJob from '../hooks/usePlanningJob';
import useModalAccessibility from '../hooks/useModalAccessibility';
import GenerationWizard from '../components/planning/GenerationWizard';
import WorkablePlanBuilder from '../components/planning/WorkablePlanBuilder';
import WorkBreakdownPanel from '../components/planning/WorkBreakdownPanel';
import PlannerWorkspacePage from './PlannerWorkspacePage';
import PlanningInputsPanel from '../components/planning/PlanningInputsPanel';
import { calculatePlanningDuration as calculateDateRangeDuration } from '../utils/planningProjectDates';
import { editablePlanningPreview, mergePlanningPreview, planningPreviewError, planningPreviewKey } from '../utils/planningPreview';
import { aiAnalysisOutcome, planningAnalysisOutcome } from '../utils/planningAnalysisOutcome';
import { AlertTriangle, Calculator, Check, CheckCircle2, FileText, Lock, RefreshCw, Sparkles } from 'lucide-react';
import {
  PLANNING_ENDPOINTS,
  PLANNING_FILE_CATEGORIES,
  PLANNING_WORKFLOW_STEPS,
  PLANNING_WORKFLOW_STAGES,
  PARSE_STATUS_STYLES,
  VALIDATION_SEVERITY_STYLES,
  EXPORT_FORMATS,
  EXPORT_CATEGORY_ORDER,
  PRESENTATION_SLIDE_OUTLINE,
  PLANNING_MAX_FILE_MB,
  PLANNING_UI,
  CLAUDE_MODEL_OPTIONS,
  DEFAULT_CLAUDE_MODEL,
  CLAUDE_API_KEY_PATTERN,
  PLANNING_DISCIPLINE_META,
  DEFAULT_DISCIPLINE_META,
} from '../config/planningIntelligence.config';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, LineChart, Line, ScatterChart,
  Scatter, ZAxis, ComposedChart, Area
} from 'recharts';

const LIFECYCLE_LABELS = {
  setup: 'Setup',
  inputs: 'Inputs collected',
  generated: 'Plan generated',
  draft: 'Draft schedule',
  calculated: 'Schedule calculated',
  approved: 'Plan approved',
  baselined: 'Baseline published',
  superseded: 'Superseded',
};

const describeContractError = error => {
  const status = error?.response?.status;
  if (status === 404) {
    return {
      title: 'Planning connection is not active',
      message: 'The planning workspace loaded, but the enterprise-contract API route was not found. The running backend is older than this frontend or has not been restarted since the route was added. Restart the backend service, then retry. No project data was lost.',
    };
  }
  if (status === 401) {
    return {
      title: 'Your session has expired',
      message: 'The server rejected the planning request because you are no longer authenticated. Sign in again, then reopen Plan & Baseline.',
    };
  }
  if (status === 403) {
    return {
      title: 'Planning access is restricted',
      message: 'Your account can view the enterprise project but does not have permission to read its linked planning workspace. Ask the project owner to update your project role.',
    };
  }
  if (status >= 500) {
    return {
      title: 'Planning service failed',
      message: `The backend reached the planning contract handler but returned server error ${status}. Check the backend log for the request, correct the server error, and retry.`,
    };
  }
  if (!error?.response) {
    return {
      title: 'Planning service cannot be reached',
      message: 'The browser could not connect to the backend. Confirm that the backend is running on the configured API address, then retry.',
    };
  }
  return {
    title: 'Planning connection failed',
    message: error.response?.data?.error || error.response?.data?.detail || error.message || 'The enterprise planning contract could not be loaded.',
  };
};

const planningProjectDraft = (enterpriseProject) => ({
  name: enterpriseProject?.name || '',
  client: enterpriseProject?.client_name || '',
  location: enterpriseProject?.location || '',
  phase: enterpriseProject?.custom_fields?.project_phase || 'FEED',
  effective_date: enterpriseProject?.start_date || '',
  planned_end_date: enterpriseProject?.end_date || '',
});

const planningAiSettingsForm = (settings) => ({
  enabled: Boolean(settings?.enabled),
  provider: settings?.provider || 'anthropic',
  model: settings?.model || settings?.provider_choices?.find(provider => provider.value === settings?.provider)?.default_model || DEFAULT_CLAUDE_MODEL,
  apiKey: '',
});

const aiSettingsErrorMessage = (error, fallback) => {
  const data = error?.response?.data;
  for (const field of ['message', 'error', 'detail', 'api_key', 'provider', 'model', 'enabled']) {
    const value = Array.isArray(data?.[field]) ? data[field][0] : data?.[field];
    if (typeof value === 'string' && value.trim()) return value;
  }
  return fallback;
};

const renderScheduleNarrative = narrative => {
  const lines = String(narrative || '').split(/\r?\n/);
  return lines.map((line, index) => {
    const heading = line.match(/^\s*(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (heading) {
      const level = heading[1].length;
      const title = heading[2].replace(/^\*\*(.+)\*\*$/, '$1').trim();
      const HeadingTag = level === 1 ? 'h3' : 'h4';
      return (
        <HeadingTag
          key={`heading-${index}`}
          className={`${level === 1 ? 'text-base' : 'text-sm'} font-bold text-slate-900 ${index > 0 ? 'mt-5' : ''} mb-1.5`}
        >
          {title}
        </HeadingTag>
      );
    }
    if (!line.trim()) return <div key={`space-${index}`} className="h-3" aria-hidden="true" />;
    return (
      <p key={`line-${index}`} className="text-sm leading-relaxed text-slate-700">
        {line}
      </p>
    );
  });
};

/**
 * Small reusable "type a value + press Add" row used by the Document
 * Intelligence edit mode to append a new deliverable to a discipline's
 * checklist. Kept as its own tiny component (rather than inline JSX) so its
 * local input state doesn't get wiped by the parent re-rendering on every
 * keystroke of unrelated fields.
 */
const AddDeliverableRow = ({ onAdd }) => {
  const [value, setValue] = useState('');
  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setValue('');
  };
  return (
    <div className="flex items-center gap-2 mt-2.5">
      <input
        type="text"
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }}
        placeholder="Add a deliverable…"
        className="flex-1 border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-violet-400"
      />
      <button onClick={submit} type="button"
        className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-violet-50 text-violet-700 border border-violet-100 hover:bg-violet-100 transition-colors shrink-0">
        + Add
      </button>
    </div>
  );
};

/**
 * RADAI Project Planning Application
 * SOFT-CODED: Feature 6.2 under Project Control (route: /planning-packages)
 *
 * AI-assisted planning intelligence engine: ingests SOW / WBS / MDR / EDDR /
 * Schedule-Requirements documents and generates a FEED/DEFINE-style WBS,
 * Level-4 activity schedule, EDDR register, manhour estimate, validation
 * report and schedule narrative — backed by apps.planning_intelligence.
 *
 * Deterministic extraction is augmented by the project's mandatory AI
 * BYOK configuration. All generated outputs remain subject to planner review.
 */
const PlanningPackagePage = ({ embedded = false, documentWorkflow = false, enterpriseProject = null, recoveredJob = null, onBackToPortfolio, onOpenPlanner, onAnalysisStateChange, generationRequest = 0, scheduleWorkspaceRequest = 0, documentReviewRequest = null }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [showNewProjectForm, setShowNewProjectForm] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);
  const [newProject, setNewProject] = useState(() => planningProjectDraft(enterpriseProject));
  const [enterpriseContract, setEnterpriseContract] = useState(null);
  const [contractError, setContractError] = useState(null);
  const [loadingContract, setLoadingContract] = useState(false);
  const [syncingContract, setSyncingContract] = useState(false);

  // Multi-project dashboard — 'dashboard' shows the all-projects grid,
  // 'workspace' shows the existing single-project workflow stepper.
  const [viewMode, setViewMode] = useState(embedded ? 'workspace' : 'dashboard');
  const [dashboardSearch, setDashboardSearch] = useState('');
  const [dashboardPhaseFilter, setDashboardPhaseFilter] = useState('');

  const [currentStep, setCurrentStep] = useState('upload');
  const [files, setFiles] = useState([]);
  const [uploadCategory, setUploadCategory] = useState('sow');
  const [uploading, setUploading] = useState(false);

  const [intelligencePreview, setIntelligencePreview] = useState(null);
  const [intelligenceOutdated, setIntelligenceOutdated] = useState(false);
  const [previewConfirmation, setPreviewConfirmation] = useState(null);
  const [workBreakdownDirty, setWorkBreakdownDirty] = useState(false);
  const [workBreakdownSaving, setWorkBreakdownSaving] = useState(false);
  const [workBreakdownSchedule, setWorkBreakdownSchedule] = useState(null);
  const [savingPreview, setSavingPreview] = useState(false);
  const [previewSaveError, setPreviewSaveError] = useState('');
  const [previewReviewState, setPreviewReviewState] = useState({ conflicts: 0, unavailable: true });
  const [reviewRequest, setReviewRequest] = useState(0);
  const [reviewAnalysisRunId, setReviewAnalysisRunId] = useState(null);
  const reviewAnalysisRunRef = useRef(null);
  const loadedPreviewRef = useRef(null);
  const previewSaveInFlight = useRef(false);
  const activePreviewProjectRef = useRef(selectedProjectId);
  activePreviewProjectRef.current = selectedProjectId;
  const intelligenceHeadingRef = useRef(null);
  const [analysisStarting, setAnalysisStarting] = useState(false);
  const analysisRequestRef = useRef(0);
  const consumedAnalysisJobs = useRef(new Set());
  const [analysisRevision, setAnalysisRevision] = useState(0);
  const [pendingAnalysisWorkspace, setPendingAnalysisWorkspace] = useState(null);
  const analysisHandlersRef = useRef(null);
  const packageRequestRef = useRef(0);
  const packageInFlight = useRef(false);
  const packageApplyBlocked = useRef(false);
  const appliedPackageJobs = useRef(new Set());
  const packageSelections = useRef(new Map());
  const [packageError, setPackageError] = useState(null);
  const [inputsReady, setInputsReady] = useState(false);
  // Which discipline card ("Process", "Piping", ...) is expanded to show its
  // full deliverable checklist — accordion-style, one at a time.
  const [expandedDiscipline, setExpandedDiscipline] = useState(null);
  // Discipline selection mode: 'auto' (AI-detected) or 'manual' (expert selection)
  const [disciplineSelectionMode, setDisciplineSelectionMode] = useState('auto');
  // Track last clicked deliverable index for Shift+Click range selection
  const [lastClickedIndex, setLastClickedIndex] = useState({});

  const [generation, setGeneration] = useState(null);
  const [loadingGeneration, setLoadingGeneration] = useState(false);
  const [generationLoadError, setGenerationLoadError] = useState('');
  const [generationSelectionId, setGenerationSelectionId] = useState(null);
  const generationLoadRequest = useRef(0);
  const handledDocumentReview = useRef(null);
  const [generating, setGenerating] = useState(false);
  const [showGenerationWizard, setShowGenerationWizard] = useState(false);
  const handledGenerationRequest = useRef(0);
  const handledWorkspaceRequest = useRef(0);
  const [showPlannerWorkspace, setShowPlannerWorkspace] = useState(false);
  const [workspaceInitialTab, setWorkspaceInitialTab] = useState('activities');
  const [workspaceGenerationId, setWorkspaceGenerationId] = useState(null);
  const [workspaceAnalysisRunId, setWorkspaceAnalysisRunId] = useState(null);
  const [localDocumentReviewRequest, setLocalDocumentReviewRequest] = useState(null);
  const [downloadingPresentation, setDownloadingPresentation] = useState(false);
  const [exportingFormat, setExportingFormat] = useState(null);
  const [exportedFormat, setExportedFormat] = useState(null);

  // ── Inline editing (Project Scheduler correction) ─────────────────────────
  // Which section is currently in "edit mode" — one at a time, mirrors the
  // accordion pattern already used for discipline cards. `editingSection`
  // is one of: 'intelligence' | 'wbs' | 'schedule' | 'eddr' | 'manhours' | null.
  // Draft state holds a working copy so Cancel can discard changes cleanly.
  const [editingSection, setEditingSection] = useState(null);
  const [draftIntelligence, setDraftIntelligence] = useState(null);
  const [draftWbs, setDraftWbs] = useState(null);
  const [draftActivities, setDraftActivities] = useState(null);
  const [draftEddr, setDraftEddr] = useState(null);
  const [draftManhours, setDraftManhours] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const [banner, setBanner] = useState(null); // { type: 'error'|'success', message }
  const { activeJob, monitoringError, checkingStatus, retryMonitoring, runJob: runPlanningJob, clearJob: clearPlanningJob } = usePlanningJob({ projectId: selectedProjectId, recoverActiveAnalysis: documentWorkflow, initialJob: recoveredJob });
  const activeJobMessage = activeJob?.message?.replace(
    /^(?:Anthropic|Google Gemini|AI provider) is reviewing document chunk /,
    'RADAI is reviewing document chunk ',
  );
  const analysisMonitoringError = monitoringError && (!monitoringError.job?.job_type || monitoringError.job.job_type === 'analyze')
    && (monitoringError.job?.project == null || String(monitoringError.job.project) === String(selectedProjectId));
  const unknownSavedJob = analysisMonitoringError && monitoringError.job?.project == null;
  const analyzing = analysisStarting || (activeJob?.job_type === 'analyze' && String(activeJob.project) === String(selectedProjectId)
    && ['queued', 'running'].includes(activeJob.status)) || Boolean(analysisMonitoringError && !monitoringError.jobUnavailable);
  const packageMonitoringError = monitoringError?.job?.job_type === 'generate' && String(monitoringError.job.project) === String(selectedProjectId) ? monitoringError : null;
  const packageBusy = generating || (activeJob?.job_type === 'generate' && String(activeJob.project) === String(selectedProjectId)
    && ['queued', 'running'].includes(activeJob.status) && !packageMonitoringError?.jobUnavailable);

  useEffect(() => {
    onAnalysisStateChange?.({ projectId: selectedProjectId, pending: analyzing,
      savedRunId: intelligencePreview?.document_intelligence_run_id,
      packageVersionId: generation?.generation_mode === 'planning_package'
        && String(generation.intelligence_run_id) === String(intelligencePreview?.document_intelligence_run_id) ? generation.schedule_version_id : null,
      message: analysisMonitoringError ? 'Current analysis status is unavailable. Return to Document Intelligence to check its status.'
        : activeJob?.job_type === 'analyze' ? activeJobMessage : 'Document Intelligence is starting.' });
  }, [onAnalysisStateChange, selectedProjectId, analyzing, analysisMonitoringError, activeJob?.job_type, activeJobMessage, intelligencePreview?.document_intelligence_run_id, generation]);

  useEffect(() => {
    if (!scheduleWorkspaceRequest || handledWorkspaceRequest.current === scheduleWorkspaceRequest || !intelligencePreview?.document_intelligence_run_id) return;
    handledWorkspaceRequest.current = scheduleWorkspaceRequest;
    analysisHandlersRef.current?.requestPackage(intelligencePreview.document_intelligence_run_id);
  }, [scheduleWorkspaceRequest, intelligencePreview?.document_intelligence_run_id]);

  useEffect(() => {
    if (!analysisMonitoringError && activeJob && String(activeJob.project) === String(selectedProjectId) && (activeJob.status === 'queued' || activeJob.status === 'running')) {
      setBanner({
        type: 'info',
        message: `${activeJobMessage || 'Planning job in progress'} (${activeJob.progress || 0}%)`,
      });
    }
  }, [activeJob, activeJobMessage, analysisMonitoringError, selectedProjectId]);

  // BYOK — per-project AI provider settings (see ai-settings endpoint).
  const [aiSettings, setAiSettings] = useState(null);
  const [loadingAiSettings, setLoadingAiSettings] = useState(false);
  const [aiSettingsLoadError, setAiSettingsLoadError] = useState('');
  const [aiSettingsProjectId, setAiSettingsProjectId] = useState(null);
  const aiSettingsLoadRequest = useRef(0);
  const [showAiSettingsModal, setShowAiSettingsModal] = useState(false);
  const [aiSettingsForm, setAiSettingsForm] = useState(() => planningAiSettingsForm(null));
  const [savingAiSettings, setSavingAiSettings] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState(null); // { success, message }
  const aiProviderChoices = aiSettings?.provider_choices || [{
    value: 'anthropic', label: 'Anthropic (Claude)', default_model: DEFAULT_CLAUDE_MODEL,
    model_choices: aiSettings?.model_choices || CLAUDE_MODEL_OPTIONS,
  }];
  const selectedAiProvider = aiProviderChoices.find(provider => provider.value === aiSettingsForm.provider);
  const savedAiProvider = aiProviderChoices.find(provider => provider.value === (aiSettings?.provider || 'anthropic'));
  const savedAiForm = planningAiSettingsForm(aiSettings);
  const aiProviderChanged = aiSettingsForm.provider !== savedAiForm.provider;
  const aiSettingsDirty = aiProviderChanged || aiSettingsForm.enabled !== savedAiForm.enabled
    || aiSettingsForm.model !== savedAiForm.model || Boolean(aiSettingsForm.apiKey.trim());
  const aiReplacementKeyRequired = aiProviderChanged && aiSettings?.key_configured && !aiSettingsForm.apiKey.trim();
  const aiSettingsUnavailable = loadingAiSettings || Boolean(aiSettingsLoadError) || aiSettingsProjectId !== selectedProjectId;
  const canTestAiConnection = Boolean(!aiSettingsUnavailable && aiSettings?.enabled && aiSettings?.key_configured && !aiSettingsDirty);

  // ── Visualization Modal ──────────────────────────────────────────────────
  const [showVisualization, setShowVisualization] = useState(false);
  const aiSettingsDialogRef = useModalAccessibility(
    showAiSettingsModal,
    () => setShowAiSettingsModal(false),
    savingAiSettings || testingConnection,
  );
  const visualizationDialogRef = useModalAccessibility(
    showVisualization,
    () => setShowVisualization(false),
  );
  const [visualizationSection, setVisualizationSection] = useState(null); // 'intelligence' | 'schedule' | 'eddr' | 'manhours'
  const [visualizationTab, setVisualizationTab] = useState('timeline'); // 'timeline' | 'disciplines' | 'statistics' | 'status' | 'workflow' | 'breakdown'

  const selectedProject = projects.find(p => p.id === selectedProjectId) || null;

  const currentPreview = editingSection === 'intelligence' ? draftIntelligence : intelligencePreview;
  const canConfirmPreview = Boolean(currentPreview?.document_intelligence_run_id) && inputsReady
    && !intelligenceOutdated && !previewReviewState.unavailable && !previewReviewState.conflicts
    && (!reviewAnalysisRunId || String(previewReviewState.runId) === String(currentPreview.document_intelligence_run_id));
  const previewConfirmed = Boolean(previewConfirmation?.is_current) && canConfirmPreview
    && planningPreviewKey(currentPreview) === planningPreviewKey(previewConfirmation.preview);
  const unsavedPreviewEdits = Boolean(intelligencePreview && loadedPreviewRef.current
    && planningPreviewKey(intelligencePreview) !== planningPreviewKey(loadedPreviewRef.current));
  packageApplyBlocked.current = Boolean(editingSection || savingEdit || unsavedPreviewEdits || workBreakdownDirty
    || workBreakdownSaving || savingPreview || showAiSettingsModal || savingAiSettings || testingConnection);
  const manualPlanning = selectedProject?.planning_mode === 'manual';
  useEffect(() => {
    if (!generationRequest || handledGenerationRequest.current === generationRequest || loadingProjects || loadingContract || !selectedProject) return;
    handledGenerationRequest.current = generationRequest;
    if (unsavedPreviewEdits || editingSection) {
      setCurrentStep('intelligence');
      setBanner({ type: 'info', message: 'Save or discard your preview edits before opening the generation wizard.' });
      return;
    }
    setCurrentStep('schedule');
    if (intelligencePreview?.document_intelligence_run_id) setShowGenerationWizard(true);
  }, [generationRequest, loadingProjects, loadingContract, selectedProject, intelligencePreview?.document_intelligence_run_id, unsavedPreviewEdits, editingSection]);
  const planningSchedule = workBreakdownSchedule?.schedule_version_id ? workBreakdownSchedule : enterpriseContract?.latest_schedule_version ? {
    schedule_id: enterpriseContract.latest_schedule_version.schedule_id,
    schedule_version_id: enterpriseContract.latest_schedule_version.id,
  } : null;
  const acceptWorkBreakdown = useCallback(data => {
    if (data?.schedule_version_id) setWorkBreakdownSchedule(data);
  }, []);
  const openWorkBreakdown = () => setCurrentStep(manualPlanning ? inputsReady ? 'wbs' : 'upload' : previewConfirmed ? 'wbs' : 'intelligence');
  const acceptLoadedIntelligence = useCallback((data, confirmation) => {
    if (reviewAnalysisRunRef.current && String(data?.document_intelligence_run_id) !== String(reviewAnalysisRunRef.current)) return;
    const prior = loadedPreviewRef.current;
    loadedPreviewRef.current = data;
    setPreviewConfirmation(confirmation);
    setIntelligencePreview(previous => {
      const sameRun = data && previous?.document_intelligence_run_id === data.document_intelligence_run_id;
      return sameRun && prior && planningPreviewKey(previous) !== planningPreviewKey(prior)
        ? mergePlanningPreview(data, previous) : data;
    });
  }, []);

  const confirmPreview = async () => {
    if (previewSaveInFlight.current || !canConfirmPreview) return;
    if (previewConfirmed) { setCurrentStep(documentWorkflow ? 'schedule' : 'wbs'); return; }
    const projectId = selectedProjectId;
    previewSaveInFlight.current = true;
    setSavingPreview(true);
    setPreviewSaveError('');
    try {
      const run = await planningIntelligenceService.confirmIntelligencePreview(
        currentPreview.document_intelligence_run_id, editablePlanningPreview(currentPreview),
      );
      if (activePreviewProjectRef.current !== projectId) return;
      if (!run.preview_confirmation?.is_current) throw new Error('The preview could not be confirmed. Refresh the analysis and try again.');
      loadedPreviewRef.current = run.intelligence;
      setIntelligencePreview(run.intelligence);
      setPreviewConfirmation(run.preview_confirmation);
      setEditingSection(null);
      setDraftIntelligence(null);
      setAnalysisRevision(value => value + 1);
      setBanner({ type: 'success', message: 'Document Intelligence preview confirmed and saved.' });
      setCurrentStep(documentWorkflow ? 'schedule' : 'wbs');
    } catch (error) {
      if (activePreviewProjectRef.current === projectId) {
        setPreviewSaveError(planningPreviewError(error));
      }
    } finally {
      previewSaveInFlight.current = false;
      if (activePreviewProjectRef.current === projectId) setSavingPreview(false);
    }
  };


  // ── Data loading ─────────────────────────────────────────────────────────
  const loadProjects = useCallback(async () => {
    setLoadingProjects(true);
    try {
      const res = await apiClient.get(PLANNING_ENDPOINTS.projects, {
        params: enterpriseProject?.id ? { enterprise_project: enterpriseProject.id } : undefined,
      });
      const list = res.data?.results ?? res.data ?? [];
      setProjects(list);
      setSelectedProjectId(prev => (
        list.some(item => item.id === prev) ? prev : (list.find(item => String(item.id) === String(recoveredJob?.project?.id ?? recoveredJob?.project))?.id || list[0]?.id || null)
      ));
      if (embedded) setViewMode('workspace');
    } catch (err) {
      setBanner({ type: 'error', message: 'Failed to load planning projects.' });
    } finally {
      setLoadingProjects(false);
    }
  }, [embedded, enterpriseProject?.id, recoveredJob]);

  const loadFiles = useCallback(async (projectId) => {
    if (!projectId) return;
    try {
      const allFiles = [];
      let page = 1;
      while (page <= 1000) {
        const res = await apiClient.get(PLANNING_ENDPOINTS.files, { params: { project: projectId, page } });
        allFiles.push(...(res.data?.results ?? res.data ?? []));
        if (!res.data?.next) break;
        if (page >= 1000) throw new Error('The complete reference document list could not be loaded.');
        page += 1;
      }
      setFiles(allFiles);
    } catch (err) {
      setBanner({ type: 'error', message: 'Failed to load uploaded files.' });
    }
  }, []);

  const loadLatestGeneration = useCallback(async (projectId, requestedGenerationId = null) => {
    if (!projectId) return;
    const request = ++generationLoadRequest.current;
    const current = () => request === generationLoadRequest.current && String(activePreviewProjectRef.current) === String(projectId);
    setLoadingGeneration(true); setGenerationLoadError(''); setGeneration(null); setGenerationSelectionId(requestedGenerationId);
    try {
      let generationId = requestedGenerationId;
      if (!generationId) {
        const res = await apiClient.get(PLANNING_ENDPOINTS.generations, { params: { project: projectId } });
        if (!current()) return false;
        const list = res.data?.results ?? res.data ?? [];
        generationId = list[0]?.id;
      }
      if (generationId) {
        const detail = await apiClient.get(PLANNING_ENDPOINTS.generation(generationId));
        if (!current()) return false;
        if (String(detail.data?.id) !== String(generationId) || String(detail.data?.project?.id ?? detail.data?.project) !== String(projectId)) throw new Error('The saved generation does not belong to this planning project.');
        setGeneration(detail.data);
      }
      return true;
    } catch (err) {
      if (current()) setGenerationLoadError(err.response?.data?.detail || err.message || 'Unable to load the saved generation.');
      return false;
    } finally { if (current()) setLoadingGeneration(false); }
  }, []);

  const loadAiSettings = useCallback(async (projectId) => {
    if (!projectId) return;
    const requestId = ++aiSettingsLoadRequest.current;
    const isCurrent = () => requestId === aiSettingsLoadRequest.current && activePreviewProjectRef.current === projectId;
    setLoadingAiSettings(true);
    setAiSettingsLoadError('');
    setAiSettingsProjectId(null);
    setAiSettings(null);
    setAiSettingsForm(planningAiSettingsForm(null));
    setTestResult(null);
    try {
      const res = await apiClient.get(PLANNING_ENDPOINTS.aiSettings(projectId));
      if (!isCurrent()) return;
      setAiSettings(res.data);
      setAiSettingsForm(planningAiSettingsForm(res.data));
      setAiSettingsProjectId(projectId);
    } catch (err) {
      if (isCurrent()) setAiSettingsLoadError(aiSettingsErrorMessage(err, 'AI settings could not be loaded. Retry before editing your configuration.'));
    } finally {
      if (isCurrent()) setLoadingAiSettings(false);
    }
  }, []);

  const loadEnterpriseContract = useCallback(async (projectId) => {
    if (!projectId) {
      setEnterpriseContract(null);
      return;
    }
    setLoadingContract(true);
    setEnterpriseContract(null);
    try {
      const result = await planningIntelligenceService.getEnterpriseContract(projectId);
      if (activePreviewProjectRef.current !== projectId) return;
      setEnterpriseContract(result);
      setContractError(null);
    } catch (err) {
      if (activePreviewProjectRef.current !== projectId) return;
      setEnterpriseContract(null);
      setContractError(describeContractError(err));
    } finally {
      if (activePreviewProjectRef.current === projectId) setLoadingContract(false);
    }
  }, []);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  useEffect(() => {
    if (!embedded) return;
    setNewProject(planningProjectDraft(enterpriseProject));
    setShowNewProjectForm(false);
    setShowPlannerWorkspace(false);
    setViewMode('workspace');
  }, [embedded, enterpriseProject]);

  useEffect(() => {
    if (embedded) return;
    const requestedProjectId = Number(location.state?.openGenerationWizardFor);
    if (!requestedProjectId || !projects.some(item => item.id === requestedProjectId)) return;
    setSelectedProjectId(requestedProjectId);
    setViewMode('workspace');
    setShowGenerationWizard(true);
    navigate(location.pathname, { replace: true, state: null });
  }, [embedded, location.pathname, location.state, navigate, projects]);

  useEffect(() => {
    if (selectedProjectId) {
      setAnalysisStarting(false);
      setBanner(null);
      setWorkBreakdownSchedule(null);
      loadFiles(selectedProjectId);
      loadLatestGeneration(selectedProjectId);
      loadAiSettings(selectedProjectId);
      if (embedded) loadEnterpriseContract(selectedProjectId);
      setIntelligencePreview(null);
      setPreviewConfirmation(null);
      setReviewRequest(0);
      setReviewAnalysisRunId(null);
      reviewAnalysisRunRef.current = null;
      loadedPreviewRef.current = null;
      setPreviewSaveError('');
      setEditingSection(null);
      setSavingEdit(false);
      setWorkspaceGenerationId(null);
      setWorkspaceAnalysisRunId(null);
      setDraftIntelligence(null);
      setTestResult(null);
    }
  }, [embedded, selectedProjectId, loadFiles, loadLatestGeneration, loadAiSettings, loadEnterpriseContract]);

  useEffect(() => () => { generationLoadRequest.current += 1; }, [selectedProjectId]);

  useEffect(() => {
    const request = documentReviewRequest || localDocumentReviewRequest || location.state?.documentReview;
    if (!request || handledDocumentReview.current === request || !selectedProject || loadingProjects || loadingContract) return;
    if (!['intelligence', 'schedule', 'wbs'].includes(request.step)) return;
    if (savingEdit || workBreakdownSaving || savingPreview) return;
    handledDocumentReview.current = request;
    const requestedProject = projects.find(item => String(item.id) === String(request.planningProjectId));
    if (!requestedProject) { setBanner({ type: 'error', message: 'The requested generation workspace is not available in this project.' }); return; }
    const reviewProjectId = selectedProjectId;
    const reviewRevision = analysisRequestRef.current;
    const reviewCurrent = () => handledDocumentReview.current === request
      && activePreviewProjectRef.current === reviewProjectId && analysisRequestRef.current === reviewRevision;
    const openReview = async () => {
      if ((editingSection || workBreakdownDirty) && !(await radaiConfirm('Discard unsaved planning edits and open this saved generation?'))) return;
      if (!reviewCurrent()) return;
      if (String(requestedProject.id) !== String(selectedProjectId)) {
        handledDocumentReview.current = null;
        setSelectedProjectId(requestedProject.id);
        return;
      }
      reviewAnalysisRunRef.current = request.analysisRunId || null;
      setReviewAnalysisRunId(request.analysisRunId || null);
      setEditingSection(null); setShowPlannerWorkspace(false); setShowGenerationWizard(false); setCurrentStep(request.step);
      if (request.generationId) await loadLatestGeneration(selectedProjectId, request.generationId);
      if (request.analysisRunId) {
        try {
          const run = await planningIntelligenceService.getIntelligenceRun(request.analysisRunId);
          if (!reviewCurrent()) return;
          if (String(run?.id) !== String(request.analysisRunId) || String(run.project?.id ?? run.project) !== String(selectedProjectId)) throw new Error('The document analysis does not belong to this project.');
          if (!run.intelligence) throw new Error('The document analysis is unavailable. Retry loading its source findings.');
          acceptLoadedIntelligence(run.intelligence, run.preview_confirmation || null);
          setBanner({ ...planningAnalysisOutcome(run.intelligence), analysisResult: true });
          if (request.analysisAction === 'settings') { setTestResult(null); setShowAiSettingsModal(true); }
          if (request.analysisAction === 'retry') analysisHandlersRef.current?.analyze({ projectId: selectedProjectId,
            resumeRunId: run.intelligence.ai_processing_coverage?.resume_available ? run.id : undefined });
        } catch (error) {
          if (reviewCurrent()) setBanner({ type: 'error', message: error.response?.data?.error || error.message || 'Unable to load this document analysis.' });
        }
      }
    };
    openReview();
  }, [documentReviewRequest, localDocumentReviewRequest, location.state, selectedProject, selectedProjectId, projects, loadingProjects, loadingContract, savingEdit, workBreakdownSaving, savingPreview, editingSection, workBreakdownDirty, loadLatestGeneration, acceptLoadedIntelligence]);

  useEffect(() => () => { analysisRequestRef.current += 1; }, [selectedProjectId]);
  useEffect(() => {
    packageRequestRef.current += 1;
    packageInFlight.current = false;
    setGenerating(false); setPackageError(null); setPendingAnalysisWorkspace(null);
    return () => { packageRequestRef.current += 1; };
  }, [selectedProjectId]);

  useEffect(() => {
    if (analysisMonitoringError) {
      setBanner({ type: 'error', monitoring: true, message: monitoringError.jobUnavailable
        ? 'This saved job is unavailable or you no longer have access. Its local progress link was cleared.'
        : unknownSavedJob
          ? 'Connection to the saved job was interrupted. The server may still be processing. Check saved job status to reconnect.'
          : 'Connection to the analysis job was interrupted. The server may still be processing. Check analysis status to reconnect.' });
      return;
    }
    if (!activeJob) setBanner(previous => previous?.monitoring ? null : previous);
    if (!selectedProjectId || activeJob?.job_type !== 'analyze' || String(activeJob.project) !== String(selectedProjectId)) return;
    if (activeJob.status === 'queued' || activeJob.status === 'running') {
      return;
    }
    if (!['succeeded', 'failed', 'cancelled'].includes(activeJob.status)) return;
    const jobKey = `${selectedProjectId}:${activeJob.id}`;
    if (consumedAnalysisJobs.current.has(jobKey)) return;
    consumedAnalysisJobs.current.add(jobKey);
    if (activeJob.status === 'succeeded' && activeJob.result_data?.intelligence) {
      if (documentWorkflow) {
        reviewAnalysisRunRef.current = activeJob.result_data.intelligence.document_intelligence_run_id || null;
        setReviewAnalysisRunId(reviewAnalysisRunRef.current);
      }
      loadedPreviewRef.current = activeJob.result_data.intelligence;
      setIntelligencePreview(activeJob.result_data.intelligence);
      setAnalysisRevision(value => value + 1);
      setPreviewConfirmation(null);
      setCurrentStep('intelligence');
      setBanner({ ...planningAnalysisOutcome(activeJob.result_data.intelligence), analysisResult: true });
      if (documentWorkflow && activeJob.result_data.intelligence.document_intelligence_run_id) {
        setPendingAnalysisWorkspace({ projectId: selectedProjectId, analysisRunId: activeJob.result_data.intelligence.document_intelligence_run_id });
      }
    } else {
      setBanner({ type: 'error', message: activeJob.error_message || activeJob.message || 'Document analysis did not return saved findings. Please retry.' });
    }
    clearPlanningJob();
  }, [activeJob, analysisMonitoringError, clearPlanningJob, monitoringError, selectedProjectId, unknownSavedJob, documentWorkflow]);

  useEffect(() => {
    if (embedded && currentStep === 'intelligence' && !showPlannerWorkspace) {
      intelligenceHeadingRef.current?.focus({ preventScroll: true });
      intelligenceHeadingRef.current?.scrollIntoView({ block: 'start' });
    }
  }, [embedded, currentStep, showPlannerWorkspace]);

  // Poll while any file is still pending/processing so status badges update
  // without requiring a manual refresh (Celery parses files asynchronously).
  useEffect(() => {
    if (!selectedProjectId) return undefined;
    const hasPending = files.some(f => f.parse_status === 'pending' || f.parse_status === 'processing');
    if (!hasPending) return undefined;
    const interval = setInterval(() => loadFiles(selectedProjectId), 4000);
    return () => clearInterval(interval);
  }, [files, selectedProjectId, loadFiles]);

  // ── Actions ──────────────────────────────────────────────────────────────
  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (creatingProject) return;
    if (!newProject.name.trim()) {
      setBanner({ type: 'error', message: 'Project name is required.' });
      return;
    }
    const rangeDuration = calculateDateRangeDuration(newProject.effective_date, newProject.planned_end_date);
    if (!rangeDuration) {
      setBanner({ type: 'error', message: 'Select a project end date after the project start date.' });
      return;
    }
    setCreatingProject(true);
    try {
      const payload = {
        ...newProject,
        duration_months: rangeDuration.months,
        ...(enterpriseProject?.id ? { enterprise_project: enterpriseProject.id } : {}),
      };
      const res = await apiClient.post(PLANNING_ENDPOINTS.projects, payload);
      setProjects(prev => [res.data, ...prev]);
      setSelectedProjectId(res.data.id);
      setViewMode('workspace');
      setShowNewProjectForm(false);
      setNewProject(planningProjectDraft(enterpriseProject));
      setBanner({ type: 'success', message: `Planning project "${res.data.name}" created.` });
    } catch (err) {
      setBanner({ type: 'error', message: 'Failed to create planning project.' });
    } finally {
      setCreatingProject(false);
    }
  };

  const handleOpenProject = (projectId) => {
    setSelectedProjectId(projectId);
    setViewMode('workspace');
  };

  const openPlannerWorkspace = useCallback((projectId = selectedProjectId, selection = {}) => {
    if (!projectId) return;
    if (!selection.versionId && !selection.generationId && !selection.analysisRunId && generation?.generation_mode === 'planning_package' && generation.schedule_version_id) selection = { ...selection, scheduleId: generation.schedule_id, versionId: generation.schedule_version_id };
    if (!selection.versionId && !selection.generationId && !selection.analysisRunId && generationSelectionId && generation) selection = { ...selection, generationId: generation.id };
    if (onOpenPlanner) {
      setShowGenerationWizard(false);
      onOpenPlanner({ ...selection, planningProjectId: projectId });
      return;
    }
    if (embedded) {
      setSelectedProjectId(projectId);
      setWorkspaceGenerationId(selection.generationId || null);
      setWorkspaceAnalysisRunId(selection.analysisRunId || null);
      if (selection.versionId) setWorkBreakdownSchedule({ schedule_id: selection.scheduleId, schedule_version_id: selection.versionId });
      setWorkspaceInitialTab('activities');
      setShowPlannerWorkspace(true);
      return;
    }
    const query = selection.analysisRunId ? `?analysisRunId=${encodeURIComponent(selection.analysisRunId)}` : selection.generationId ? `?generationId=${encodeURIComponent(selection.generationId)}` : '';
    navigate(`/planning-workspace/${projectId}${query}`);
  }, [embedded, generation, generationSelectionId, navigate, onOpenPlanner, selectedProjectId]);

  useEffect(() => {
    if (!pendingAnalysisWorkspace) return;
    if (String(pendingAnalysisWorkspace.projectId) !== String(selectedProjectId)) { setPendingAnalysisWorkspace(null); return; }
    if (analyzing || generating || showAiSettingsModal || savingAiSettings || testingConnection || editingSection || unsavedPreviewEdits || workBreakdownDirty || workBreakdownSaving || savingPreview || savingEdit) return;
    setPendingAnalysisWorkspace(null);
    if (pendingAnalysisWorkspace.completedPackageJob) analysisHandlersRef.current?.restorePackage(pendingAnalysisWorkspace.completedPackageJob, pendingAnalysisWorkspace.analysisRunId);
    else if (pendingAnalysisWorkspace.selection) openPlannerWorkspace(selectedProjectId, pendingAnalysisWorkspace.selection);
    else analysisHandlersRef.current?.openPackage(pendingAnalysisWorkspace.analysisRunId);
  }, [pendingAnalysisWorkspace, selectedProjectId, analyzing, generating, showAiSettingsModal, savingAiSettings, testingConnection, editingSection, unsavedPreviewEdits, workBreakdownDirty, workBreakdownSaving, savingPreview, savingEdit, openPlannerWorkspace]);

  useEffect(() => {
    const options = activeJob?.request_data?.generation_options || {};
    const result = activeJob?.result_data || {};
    if (!documentWorkflow || packageInFlight.current || activeJob?.job_type !== 'generate'
      || String(activeJob.project) !== String(selectedProjectId)
      || (options.mode !== 'planning_package' && result.generation_mode !== 'planning_package')
      || !['succeeded', 'failed', 'cancelled'].includes(activeJob.status)
      || appliedPackageJobs.current.has(`${selectedProjectId}:${activeJob.id}`)) return;
    appliedPackageJobs.current.add(`${selectedProjectId}:${activeJob.id}`);
    setPendingAnalysisWorkspace({ projectId: selectedProjectId, analysisRunId: options.intelligence_run_id || result.intelligence_run_id, completedPackageJob: activeJob });
  }, [activeJob, documentWorkflow, selectedProjectId, generating]);

  const handleDeleteProject = async (project) => {
    if (!(await radaiConfirm(`Delete planning project "${project.name}"? It will be removed from the dashboard immediately.`))) {
      return;
    }
    try {
      await apiClient.delete(PLANNING_ENDPOINTS.project(project.id));
      setProjects(prev => prev.filter(p => p.id !== project.id));
      if (selectedProjectId === project.id) {
        setSelectedProjectId(null);
        setViewMode('dashboard');
      }
      setBanner({ type: 'success', message: `Planning project "${project.name}" deleted.` });
    } catch (err) {
      const detail = err?.response?.data?.detail || err?.response?.data?.error;
      setBanner({ type: 'error', message: typeof detail === 'string' ? detail : 'Failed to delete planning project.' });
    }
  };

  const handleSyncEnterpriseContract = async () => {
    if (!selectedProjectId || syncingContract) return;
    setSyncingContract(true);
    try {
      const result = await planningIntelligenceService.syncFromEnterprise(selectedProjectId, {
        expected_enterprise_updated_at: enterpriseContract?.enterprise_updated_at,
      });
      setEnterpriseContract(result.contract);
      setContractError(null);
      setProjects(current => current.map(project => (
        project.id === selectedProjectId ? { ...project, ...result.planning_project } : project
      )));
      const lockedNote = result.skipped_fields?.length
        ? ` Baseline-controlled dates were preserved: ${result.skipped_fields.join(', ')}.`
        : '';
      setBanner({
        type: 'success',
        message: result.synced_fields?.length
          ? `Master data synchronized: ${result.synced_fields.join(', ')}.${lockedNote}`
          : `Planning master data is already current.${lockedNote}`,
      });
    } catch (err) {
      if (err.response?.data?.contract) setEnterpriseContract(err.response.data.contract);
      const diagnostic = describeContractError(err);
      setContractError(diagnostic);
      setBanner({
        type: 'error',
        message: `${diagnostic.title}: ${diagnostic.message}`,
      });
    } finally {
      setSyncingContract(false);
    }
  };

  const handleUpload = async (fileList, options = {}) => {
    const projectId = options.projectId || selectedProjectId;
    if (!projectId || !fileList?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(fileList)) {
        const form = new FormData();
        form.append('project', projectId);
        form.append('category', uploadCategory);
        form.append('file', file);
        await apiClient.post(PLANNING_ENDPOINTS.files, form);
      }
      setBanner({ type: 'success', message: 'Upload complete. Document parsing is queued; watch each file status for completion.' });
      await loadFiles(projectId);
      await loadEnterpriseContract(projectId);
    } catch (err) {
      const detail = err.response?.data;
      const message = typeof detail === 'string' ? detail : Object.values(detail || {}).flat().filter(value => typeof value === 'string').join(' ');
      setBanner({ type: 'error', message: message || 'Upload failed for one or more files. Please retry.' });
      await loadFiles(projectId);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteFile = async (fileId) => {
    try {
      await apiClient.delete(PLANNING_ENDPOINTS.file(fileId));
      setFiles(prev => prev.filter(f => f.id !== fileId));
      await loadEnterpriseContract(selectedProjectId);
    } catch (err) {
      setBanner({ type: 'error', message: 'Failed to remove file.' });
    }
  };

  const handleAnalyze = async (options = {}) => {
    const projectId = options.projectId || selectedProjectId;
    if (!projectId || analyzing || packageBusy) return null;
    const requestId = ++analysisRequestRef.current;
    const isCurrent = () => requestId === analysisRequestRef.current && activePreviewProjectRef.current === projectId;
    setAnalysisStarting(true);
    setBanner(null);
    try {
      const job = await runPlanningJob(async () => {
        if (options.resumeRunId) {
          try {
            return await planningIntelligenceService.startResumeAnalysis(options.resumeRunId);
          } catch (err) {
            if (err.response?.status !== 409 || err.response?.data?.code !== 'intelligence_resume_sources_changed' || !isCurrent()) throw err;
          }
        }
        return planningIntelligenceService.startAnalysis(projectId);
      });
      if (!job || !isCurrent()) return null;
      return job;
    } catch (err) {
      if (!isCurrent()) return null;
      setBanner({
        type: 'error',
        message: err.response?.data?.error || err.job?.error_message || err.message || 'Document intelligence requires at least one parsed file.',
      });
      return null;
    } finally {
      if (isCurrent()) setAnalysisStarting(false);
    }
  };

  const buildIntelligenceOverrides = () => {
    const source = intelligencePreview || generation?.intelligence;
    return source ? {
      detected_project_name: source.detected_project_name,
      detected_effective_date_text: source.detected_effective_date_text,
      detected_duration_months: source.detected_duration_months,
      disciplines: Object.fromEntries(
        Object.entries(source.disciplines || {}).map(([code, info]) => {
          const excludedSet = new Set(info.excluded_deliverables || []);
          return [code, {
            deliverables: (info.deliverables || []).filter(item => !excludedSet.has(item)),
            in_scope: info.in_scope !== false,
          }];
        })
      ),
      hse_studies: source.hse_studies,
    } : undefined;
  };

  const applyPlanningPackage = async (job, runId, requestId, { open = false } = {}) => {
    const projectId = selectedProjectId;
    const current = () => requestId === packageRequestRef.current && activePreviewProjectRef.current === projectId;
    if (!current()) return null;
    appliedPackageJobs.current.add(`${projectId}:${job.id}`);
    if (job.status !== 'succeeded') throw new Error(job.error_message || job.message || 'The planning package could not be generated.');
    const result = job.result_data || {};
    if (String(job.project?.id ?? job.project) !== String(projectId) || result.generation_mode !== 'planning_package'
      || String(result.intelligence_run_id) !== String(runId) || !result.schedule_id || !result.schedule_version_id || !result.generation_id) {
      throw new Error('The generated planning package could not be verified for this analysis. Review its status before retrying.');
    }
    const [generated, version, schedules] = await Promise.all([
      planningIntelligenceService.getGeneration(result.generation_id),
      planningIntelligenceService.getScheduleVersion(result.schedule_version_id),
      planningIntelligenceService.listSchedules(projectId),
    ]);
    if (!current()) return null;
    const schedule = schedules.find(row => String(row.id) === String(result.schedule_id) && String(row.project?.id ?? row.project) === String(projectId));
    if (!schedule || String(version?.id) !== String(result.schedule_version_id) || String(version.schedule?.id ?? version.schedule) !== String(schedule.id)
      || String(version.source_generation?.id ?? version.source_generation) !== String(generated?.id)
      || String(generated?.schedule_version_id) !== String(result.schedule_version_id) || String(generated?.schedule_id) !== String(result.schedule_id)
      || String(generated?.id) !== String(result.generation_id) || String(generated.project?.id ?? generated.project) !== String(projectId)
      || String(generated.intelligence_run_id ?? generated.intelligence?.schedule_engine?.source_analysis_run_id ?? generated.intelligence?.schedule_engine?.intelligence_run_id) !== String(runId)) {
      throw new Error('The generated version does not match this project and analysis. The current workspace has been preserved.');
    }
    if (packageApplyBlocked.current) {
      setPendingAnalysisWorkspace({ projectId, analysisRunId: runId, completedPackageJob: job });
      return null;
    }
    generationLoadRequest.current += 1;
    setLoadingGeneration(false); setGenerationLoadError('');
    setGeneration(generated); setGenerationSelectionId(generated.id);
    const selection = { scheduleId: schedule.id, versionId: version.id };
    packageSelections.current.set(`${projectId}:${runId}`, selection);
    setPackageError(null);
    setCurrentStep('schedule');
    setBanner({ type: 'success', message: `Planning package v${generated.version} is ready as an editable draft. Review workflow assumptions and scheduling checks before approval.` });
    if (open) setPendingAnalysisWorkspace({ projectId, analysisRunId: runId, selection });
    return { generation: generated, job };
  };

  const generatePlanningPackage = async (runId, generationOptions = {}, { open = false } = {}) => {
    const projectId = selectedProjectId;
    if (!projectId || !runId || packageInFlight.current || packageBusy || analyzing || unsavedPreviewEdits || editingSection) return null;
    const requestId = ++packageRequestRef.current;
    const current = () => requestId === packageRequestRef.current && activePreviewProjectRef.current === projectId;
    packageInFlight.current = true;
    setGenerating(true); setPackageError(null); setBanner(null);
    let keepMonitoring = false;
    try {
      const job = await runPlanningJob(() => planningIntelligenceService.startGeneration(projectId, {
        generation_options: { ...generationOptions, mode: 'planning_package', intelligence_run_id: runId },
      }));
      if (!job || !current()) return null;
      return await applyPlanningPackage(job, runId, requestId, { open });
    } catch (error) {
      keepMonitoring = Boolean(error.job && ['queued', 'running'].includes(error.job.status) && ![403, 404].includes(error.response?.status));
      if (current()) {
        setPackageError({ runId, message: error.response?.data?.error || error.response?.data?.detail || error.job?.error_message || error.message || 'Planning package generation failed. Your saved analysis is retained.' });
        setCurrentStep('intelligence');
      }
      if (!open && current()) throw error;
      return null;
    } finally {
      if (current()) { packageInFlight.current = false; setGenerating(false); if (!keepMonitoring) clearPlanningJob(); }
    }
  };

  const restorePlanningPackage = async (job, runId) => {
    const projectId = selectedProjectId, requestId = ++packageRequestRef.current;
    packageInFlight.current = true; setGenerating(true);
    try { await applyPlanningPackage(job, runId, requestId, { open: true }); }
    catch (error) {
      if (requestId === packageRequestRef.current && activePreviewProjectRef.current === projectId) setPackageError({ runId, message: error.message });
    } finally {
      if (requestId === packageRequestRef.current && activePreviewProjectRef.current === projectId) {
        packageInFlight.current = false; setGenerating(false); clearPlanningJob();
      }
    }
  };

  const requestPlanningWorkspace = runId => {
    if (!runId || packageBusy || analyzing) return;
    const matchingGeneration = generation?.generation_mode === 'planning_package'
      && String(generation.intelligence_run_id) === String(runId) && generation.schedule_version_id;
    const selection = !intelligenceOutdated && (packageSelections.current.get(`${selectedProjectId}:${runId}`)
      || (matchingGeneration ? { scheduleId: generation.schedule_id, versionId: generation.schedule_version_id } : null));
    setPendingAnalysisWorkspace({ projectId: selectedProjectId, analysisRunId: runId, ...(selection ? { selection } : {}) });
  };

  const handleGenerate = async (generationOptions = {}) => {
    if (!selectedProjectId) return;
    if (documentWorkflow) return generatePlanningPackage(intelligencePreview?.document_intelligence_run_id, generationOptions);
    setGenerating(true);
    setBanner(null);
    try {
      // Carry any Document Intelligence edits the Project Scheduler made
      // (project name/date/duration, discipline deliverable checklists,
      // HSE studies) through to WBS/Schedule/EDDR/Manhour generation.
      const overrides = buildIntelligenceOverrides();
      const job = await runPlanningJob(() => planningIntelligenceService.startGeneration(
        selectedProjectId,
        {
          ...(overrides ? { intelligence_overrides: overrides } : {}),
          generation_options: generationOptions,
        },
      ));
      const generationId = job.result_generation || job.result_data?.generation_id;
      const generatedSchedule = await planningIntelligenceService.getGeneration(generationId);
      setGeneration(generatedSchedule);
      await loadEnterpriseContract(selectedProjectId);
      const needsEvidenceReview = job.result_data?.state === 'needs_evidence_review' || !job.result_data?.schedule_version_id;
      setBanner({ type: 'success', message: needsEvidenceReview ? 'Document evidence ready for review. Resolve Not Specified values using the source documents.' : `Schedule generated (version ${generatedSchedule.version}).` });
      setCurrentStep(needsEvidenceReview ? 'intelligence' : 'schedule');
      return { generation: generatedSchedule, job };
    } catch (err) {
      setBanner({
        type: 'error',
        message: err.response?.data?.error || err.job?.error_message || err.message || 'Schedule generation failed. Check the backend logs.',
      });
      return null;
    } finally {
      setGenerating(false);
    }
  };

  // ── Inline editing (Project Scheduler correction) ─────────────────────────
  const startEdit = (section) => {
    if (section === 'intelligence') setDraftIntelligence(JSON.parse(JSON.stringify(intelligencePreview)));
    if (section === 'wbs') setDraftWbs(JSON.parse(JSON.stringify(generation?.wbs || [])));
    if (section === 'schedule') setDraftActivities(JSON.parse(JSON.stringify(generation?.activities || [])));
    if (section === 'eddr') setDraftEddr(JSON.parse(JSON.stringify(generation?.eddr || [])));
    if (section === 'manhours') setDraftManhours(JSON.parse(JSON.stringify(generation?.manhours || {})));
    setEditingSection(section);
  };

  const cancelEdit = () => {
    setEditingSection(null);
    setDraftIntelligence(null);
    setDraftWbs(null);
    setDraftActivities(null);
    setDraftEddr(null);
    setDraftManhours(null);
  };

  const handleSaveIntelligenceEdit = () => {
    setIntelligencePreview(draftIntelligence);
    setBanner({ type: 'info', message: embedded ? `Preview edits applied. Confirm and save below to continue to ${documentWorkflow ? 'Schedule Generator' : 'Work breakdown'}.` : 'Document Intelligence edits applied for the next schedule generation.' });
    cancelEdit();
  };

  const handleSaveGenerationEdit = async (field, value) => {
    if (!generation || savingEdit) return;
    const projectId = selectedProjectId, request = ++generationLoadRequest.current;
    const current = () => generationLoadRequest.current === request && String(activePreviewProjectRef.current) === String(projectId);
    setSavingEdit(true);
    try {
      const res = await apiClient.patch(PLANNING_ENDPOINTS.editGeneration(generation.id), { [field]: value });
      if (!current()) return;
      if (!res.data?.id || String(res.data?.project?.id ?? res.data?.project) !== String(projectId)) throw new Error('The saved revision could not be verified for this planning project.');
      setGeneration(res.data);
      setGenerationSelectionId(res.data.id);
      const needsReview = res.data.intelligence?.schedule_engine?.policy === 'document_driven' && !res.data.schedule_version_id;
      setBanner({ type: needsReview ? 'info' : 'success', message: needsReview ? `Changes saved as generation v${res.data.version}. Review source evidence and missing scheduling inputs before calculation.` : `Changes saved as generation v${res.data.version}.` });
      cancelEdit();
    } catch (err) {
      if (current()) setBanner({ type: 'error', message: err.response?.data?.error || err.message || 'Failed to save changes.' });
    } finally {
      if (current()) setSavingEdit(false);
    }
  };

  const updateDraftWbsNode = (code, name) => {
    setDraftWbs(prev => prev.map(n => (n.code === code ? { ...n, name } : n)));
  };

  const updateDraftActivity = (id, field, value) => {
    setDraftActivities(prev => prev.map(a => (a.id === id ? { ...a, [field]: value } : a)));
  };

  const updateDraftEddrRow = (index, field, value) => {
    setDraftEddr(prev => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  };

  const updateDraftManhourRow = (discipline, manDays) => {
    setDraftManhours(prev => {
      const hoursPerDay = prev.basis?.hours_per_day || 8;
      const manDaysPerMonth = prev.basis?.man_days_per_month || 22;
      const byDiscipline = (prev.by_discipline || []).map(row => {
        if (row.discipline !== discipline) return row;
        const days = Number(manDays) || 0;
        return {
          ...row,
          man_days: days,
          total_working_days: days,
          man_hours: Math.round(days * hoursPerDay),
          man_months: manDaysPerMonth ? Math.round((days / manDaysPerMonth) * 100) / 100 : null,
        };
      });
      const grandTotal = byDiscipline.reduce((sum, r) => sum + (r.man_hours || 0), 0);
      return { ...prev, by_discipline: byDiscipline, grand_total_man_hours: grandTotal };
    });
  };

  // ── Row add / delete (Project Scheduler correction) ────────────────────────
  // WBS: adding always creates a *child* of a given node (or a new root item
  // when parentCode is null); deleting a node cascades to all its descendants
  // so the tree never ends up with orphaned rows.
  const addDraftWbsNode = (parentCode) => {
    setDraftWbs(prev => {
      const parent = parentCode ? prev.find(n => n.code === parentCode) : null;
      const siblings = prev.filter(n => (n.parent_code || null) === (parentCode || null));
      const siblingNumbers = siblings
        .map(n => Number(n.code.split('.').pop()))
        .filter(n => !Number.isNaN(n));
      const nextNumber = siblingNumbers.length ? Math.max(...siblingNumbers) + 1 : (parentCode ? 1 : prev.length + 1);
      const code = parentCode ? `${parentCode}.${nextNumber}` : `${nextNumber}`;
      const newNode = {
        code,
        name: 'New WBS Item',
        level: parent ? parent.level + 1 : 0,
        parent_code: parentCode || null,
        ...(parent?.discipline ? { discipline: parent.discipline } : {}),
      };
      const insertAt = parent ? prev.findIndex(n => n.code === parentCode) + 1 : prev.length;
      const next = [...prev];
      next.splice(insertAt, 0, newNode);
      return next;
    });
  };

  const deleteDraftWbsNode = (code) => {
    setDraftWbs(prev => {
      const toRemove = new Set([code]);
      let grew = true;
      while (grew) {
        grew = false;
        prev.forEach(n => {
          if (n.parent_code && toRemove.has(n.parent_code) && !toRemove.has(n.code)) {
            toRemove.add(n.code);
            grew = true;
          }
        });
      }
      return prev.filter(n => !toRemove.has(n.code));
    });
  };

  // Activities: deleting an activity also strips it from every remaining
  // activity's `predecessors` list so the schedule never references a
  // task that no longer exists.
  const addDraftActivity = () => {
    setDraftActivities(prev => {
      const existingNums = prev
        .map(a => Number(String(a.id).match(/(\d+)$/)?.[1]))
        .filter(n => !Number.isNaN(n));
      const nextNum = existingNums.length ? Math.max(...existingNums) + 10 : 100;
      const newActivity = {
        id: `NEW-${nextNum}`,
        name: 'New Activity',
        wbs_code: prev[0]?.wbs_code || '',
        discipline: prev[0]?.discipline || '',
        deliverable: null,
        start_date: '',
        finish_date: '',
        is_critical: generation?.intelligence?.schedule_engine?.policy === 'document_driven' ? null : false,
        is_milestone: false,
        predecessors: [],
        responsible_role: '',
        total_float_days: generation?.intelligence?.schedule_engine?.policy === 'document_driven' ? null : 0,
        original_duration_days: generation?.intelligence?.schedule_engine?.policy === 'document_driven' ? null : 1,
      };
      return [...prev, newActivity];
    });
  };

  const deleteDraftActivity = (id) => {
    setDraftActivities(prev =>
      prev
        .filter(a => a.id !== id)
        .map(a => ({ ...a, predecessors: (a.predecessors || []).filter(p => p.id !== id) }))
    );
  };

  // EDDR
  const addDraftEddrRow = () => {
    setDraftEddr(prev => [
      ...prev,
      {
        wbs_code: '',
        discipline: prev[0]?.discipline || '',
        deliverable_name: 'New Deliverable',
        document_status: 'Planned',
        prepare_start_date: '',
        ifr_issue_date: '',
        company_review_date: '',
        ifa_issue_date: '',
        company_approval_date: '',
        final_issue_date: '',
      },
    ]);
  };

  const deleteDraftEddrRow = (index) => {
    setDraftEddr(prev => prev.filter((_, i) => i !== index));
  };

  // Manhours: "Add" is a discipline picker limited to disciplines not already
  // present in the table (uses the same PLANNING_DISCIPLINE_META catalogue as
  // Document Intelligence, so labels/roles stay consistent across the app).
  const addDraftManhourRow = (discipline) => {
    if (!discipline) return;
    setDraftManhours(prev => {
      if ((prev.by_discipline || []).some(r => r.discipline === discipline)) return prev;
      const meta = PLANNING_DISCIPLINE_META[discipline] || { ...DEFAULT_DISCIPLINE_META, label: discipline };
      const newRow = {
        discipline,
        discipline_name: meta.label,
        responsible_role: meta.responsibleRole,
        man_days: 0,
        man_hours: 0,
        man_months: 0,
        total_working_days: 0,
      };
      return { ...prev, by_discipline: [...(prev.by_discipline || []), newRow] };
    });
  };

  const deleteDraftManhourRow = (discipline) => {
    setDraftManhours(prev => {
      const byDiscipline = (prev.by_discipline || []).filter(r => r.discipline !== discipline);
      const grandTotal = byDiscipline.reduce((sum, r) => sum + (r.man_hours || 0), 0);
      return { ...prev, by_discipline: byDiscipline, grand_total_man_hours: grandTotal };
    });
  };

  const handleExport = async (format) => {
    if (!generation) return;
    setExportingFormat(format);
    try {
      const res = await apiClient.get(PLANNING_ENDPOINTS.export(generation.id, format), { responseType: 'blob' });
      const disposition = res.headers['content-disposition'] || '';
      const match = disposition.match(/filename="?([^"]+)"?/);
      const filename = match ? match[1] : `planning_export.${format}`;
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setExportedFormat(format);
      setTimeout(() => setExportedFormat(f => (f === format ? null : f)), 2200);
      return true;
    } catch (err) {
      setBanner({ type: 'error', message: 'Export failed.' });
      return false;
    } finally {
      setExportingFormat(f => (f === format ? null : f));
    }
  };

  const handleDownloadPresentation = async () => {
    if (!generation) return;
    setDownloadingPresentation(true);
    setBanner(null);
    try {
      const downloaded = await handleExport('pptx');
      setBanner(downloaded
        ? { type: 'success', message: 'PowerPoint presentation downloaded.' }
        : { type: 'error', message: 'Failed to generate the PowerPoint presentation.' });
    } finally {
      setDownloadingPresentation(false);
    }
  };

  const testSavedAiConnection = async () => {
    setTestingConnection(true);
    setTestResult(null);
    try {
      const res = await apiClient.post(PLANNING_ENDPOINTS.aiSettingsTest(selectedProjectId));
      const success = res.data?.success === true;
      setTestResult({ success, message: success
        ? 'Settings saved. Connection established. AI is ready for analysis.'
        : res.data?.message || 'Settings are saved, but the connection test failed. Check the key and test again.' });
    } catch (err) {
      setTestResult({ success: false, message: aiSettingsErrorMessage(err,
        'Settings are saved, but the connection test failed. Check the key and test again.') });
    } finally {
      setTestingConnection(false);
    }
  };
  analysisHandlersRef.current = { analyze: handleAnalyze, requestPackage: requestPlanningWorkspace, openPackage: runId => generatePlanningPackage(runId, {}, { open: true }), restorePackage: restorePlanningPackage };

  const handleRetryAnalysis = () => handleAnalyze({
    resumeRunId: intelligencePreview?.ai_processing_coverage?.resume_available || intelligencePreview?.extraction_summary?.resume_available
      ? intelligencePreview?.document_intelligence_run_id : undefined,
  });

  const handleSaveAiSettings = async () => {
    if (!selectedProjectId || savingAiSettings || testingConnection || aiSettingsUnavailable) return;
    if (aiReplacementKeyRequired) {
      setTestResult({ success: false, message: 'Enter an API key for the selected provider before saving.' });
      return;
    }
    if (aiSettingsForm.provider === 'anthropic' && aiSettingsForm.apiKey && !CLAUDE_API_KEY_PATTERN.test(aiSettingsForm.apiKey.trim())) {
      setTestResult({ success: false, message: 'API key does not look like a valid Anthropic key (expected format: sk-ant-...).' });
      return;
    }
    setSavingAiSettings(true);
    setTestResult(null);
    try {
      const payload = { enabled: aiSettingsForm.enabled, provider: aiSettingsForm.provider, model: aiSettingsForm.model };
      if (aiSettingsForm.apiKey.trim()) payload.api_key = aiSettingsForm.apiKey.trim();
      const res = await apiClient.post(PLANNING_ENDPOINTS.aiSettings(selectedProjectId), payload);
      setAiSettings(res.data);
      setAiSettingsForm(planningAiSettingsForm(res.data));
      setProjects(prev => prev.map(p => (p.id === selectedProjectId
        ? { ...p, ai_enabled: res.data.enabled, ai_provider: res.data.provider, ai_model: res.data.model, ai_key_configured: res.data.key_configured }
        : p)));
      if (res.data.enabled && res.data.key_configured) {
        setSavingAiSettings(false);
        await testSavedAiConnection();
      } else {
        setTestResult({ success: false, type: 'info', message: res.data.enabled
          ? 'Settings saved. Configure an API key and test the connection before analysis.'
          : 'Settings saved. AI is disabled for this project.' });
      }
    } catch (err) {
      setTestResult({ success: false, message: aiSettingsErrorMessage(err, 'Failed to save AI settings. Your changes are still here; please retry.') });
    } finally {
      setSavingAiSettings(false);
    }
  };

  const handleRemoveAiKey = async () => {
    if (!selectedProjectId || savingAiSettings || testingConnection || aiSettingsUnavailable) return;
    setSavingAiSettings(true);
    setTestResult(null);
    try {
      const res = await apiClient.delete(PLANNING_ENDPOINTS.aiSettings(selectedProjectId));
      setAiSettings(res.data);
      setAiSettingsForm(planningAiSettingsForm(res.data));
      setTestResult({ success: false, type: 'info', message: 'API key removed. Configure and test a key to use AI analysis.' });
    } catch (err) {
      setTestResult({ success: false, message: aiSettingsErrorMessage(err, 'Failed to remove AI key.') });
    } finally {
      setSavingAiSettings(false);
    }
  };

  const handleTestAiConnection = async () => {
    if (!selectedProjectId || savingAiSettings || testingConnection || !canTestAiConnection) return;
    await testSavedAiConnection();
  };

  // ── Render helpers ───────────────────────────────────────────────────────
  const renderBanner = () => {
    if (!banner) return null;
    const previousResult = analyzing && banner.analysisResult;
    const type = previousResult ? 'info' : banner.type;
    const styles = type === 'error'
      ? 'bg-rose-50 text-rose-700 border-rose-200'
      : type === 'warning'
        ? 'bg-amber-50 text-amber-900 border-amber-200'
      : type === 'info'
        ? 'bg-sky-50 text-sky-700 border-sky-200'
        : 'bg-emerald-50 text-emerald-700 border-emerald-200';
    return (
      <div role={type === 'error' ? 'alert' : 'status'} aria-live={type === 'error' ? 'assertive' : 'polite'} className={`mb-4 rounded-lg border px-4 py-3 text-sm ${styles}`}>
        <div className="flex items-center justify-between gap-3"><span>{previousResult ? 'A new analysis is being monitored. The previous saved result and its coverage remain below until the new findings are saved.' : banner.message}</span>
        {(!analysisMonitoringError || monitoringError.jobUnavailable) && <button type="button" aria-label="Dismiss notification" onClick={() => setBanner(null)} className="ml-4 opacity-60 hover:opacity-100">✕</button>}
        </div>
        {analysisMonitoringError && !monitoringError.jobUnavailable && <button type="button" className="pln-button mt-2" disabled={checkingStatus} onClick={retryMonitoring}>{checkingStatus ? 'Checking status…' : unknownSavedJob ? 'Check saved job status' : 'Check analysis status'}</button>}
        {type === 'info' && activeJob && <div className="mt-2 h-2 overflow-hidden rounded-full bg-sky-100" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={activeJob.progress || 0}><div className="h-full rounded-full bg-sky-600 transition-all duration-500" style={{ width: `${activeJob.progress || 0}%` }} /></div>}
      </div>
    );
  };

  const renderPreviousAnalysisNotice = () => analyzing && intelligencePreview ? (
    <p role="status" className="mb-4 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-700">
      {analysisMonitoringError ? `${unknownSavedJob ? 'Saved job' : 'Analysis'} status is unavailable. The findings below are from the previous saved analysis.` : 'A new analysis is running. The findings below are from the previous saved analysis.'}
      {documentWorkflow && !analysisMonitoringError && ' The Schedule Planner will open when the current analysis finishes and saves its findings.'}
    </p>
  ) : null;

  const renderPendingPlannerNotice = () => pendingAnalysisWorkspace && !analyzing && String(pendingAnalysisWorkspace.projectId) === String(selectedProjectId)
    && (showAiSettingsModal || editingSection || unsavedPreviewEdits || workBreakdownDirty || savingPreview || savingEdit || savingAiSettings || testingConnection) ? (
    <p role="status" className="mb-4 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-700">
      {showAiSettingsModal ? 'Analysis findings are saved. Close AI Settings to open the Schedule Planner.'
        : editingSection ? 'Analysis findings are saved. Save or cancel your current edits to open the Schedule Planner.'
          : unsavedPreviewEdits ? 'Save or discard your preview edits before building the planning package from this analysis.'
          : workBreakdownDirty ? 'Analysis findings are saved. Save or discard work breakdown changes to open the Schedule Planner.'
            : 'Analysis findings are saved. Finishing the current save before opening the Schedule Planner.'}
      {unsavedPreviewEdits && !editingSection && <button type="button" className="pln-button ml-3" disabled={savingPreview} onClick={() => setIntelligencePreview(loadedPreviewRef.current)}>Discard preview edits</button>}
    </p>
  ) : null;

  const renderPlanningPackageState = () => packageMonitoringError ? (
    <div role="alert" className="pln-error">{packageMonitoringError.jobUnavailable ? 'This planning job is unavailable or access has changed. Your saved analysis remains available.' : 'Connection to planning package generation was interrupted. The server may still be building the draft.'}
      {!packageMonitoringError.jobUnavailable && <button type="button" className="pln-button" disabled={checkingStatus} onClick={retryMonitoring}>{checkingStatus ? 'Checking status…' : 'Check planning status'}</button>}
    </div>
  ) : packageError ? (
    <div role="alert" className="pln-error"><p>{packageError.message}</p><p>Your saved analysis is retained; no existing schedule has been replaced.</p>
      <button type="button" className="pln-button" disabled={packageBusy || analyzing || Boolean(editingSection)} onClick={() => requestPlanningWorkspace(packageError.runId)}>Retry planning package</button>
    </div>
  ) : packageBusy ? <p role="status" className="pln-note">Building the planning package from saved analysis. Activities, WBS and logic will open in the editable planner when the draft is saved.</p> : null;

  const renderProjectPicker = () => {
    if (embedded) {
      const differences = enterpriseContract?.differences || [];
      const syncableDifferences = differences.filter(item => !item.locked_by_baseline);
      const protectedDifferences = differences.filter(item => item.locked_by_baseline);
      return selectedProject ? (
        <section aria-label="Linked planning workspace" className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Linked planning workspace</p>
            <p className="mt-1 truncate text-sm font-semibold text-slate-900 dark:text-white">{selectedProject.name}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Planning workflow for <span className="font-semibold text-slate-700 dark:text-slate-200">{enterpriseProject?.code || enterpriseProject?.name}</span></p>
          </div>
          {loadingContract ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              <RefreshCw aria-hidden="true" size={13} className="animate-spin" /> Checking link
            </span>
          ) : enterpriseContract && (
            <>
              <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                {LIFECYCLE_LABELS[enterpriseContract.lifecycle] || enterpriseContract.lifecycle}
              </span>
              {!enterpriseContract.linked ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                  <AlertTriangle aria-hidden="true" size={13} /> Workspace not linked
                </span>
              ) : enterpriseContract.in_sync ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                  <CheckCircle2 aria-hidden="true" size={13} /> Master data synchronized
                </span>
              ) : (
                <span
                  className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                  title={differences.map(item => item.label).join(', ')}
                >
                  <AlertTriangle aria-hidden="true" size={13} /> {differences.length} master-data {differences.length === 1 ? 'change' : 'changes'}
                </span>
              )}
              {enterpriseContract.baseline_locked && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  <Lock aria-hidden="true" size={13} /> Baseline dates locked{protectedDifferences.length ? ` (${protectedDifferences.length} variance)` : ''}
                </span>
              )}
            </>
          )}
          <span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700 dark:bg-sky-950 dark:text-sky-300">{selectedProject.file_count || 0} files</span>
          {selectedProject.latest_generation_version && <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">Version {selectedProject.latest_generation_version}</span>}
          {syncableDifferences.length > 0 && (
            <button
              type="button"
              onClick={handleSyncEnterpriseContract}
              disabled={syncingContract}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 text-sm font-semibold text-amber-900 hover:bg-amber-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 disabled:cursor-wait disabled:opacity-60 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
            >
              <RefreshCw aria-hidden="true" size={15} className={syncingContract ? 'animate-spin' : ''} />
              {syncingContract ? 'Synchronizing...' : 'Sync master data'}
            </button>
          )}
          <button type="button" onClick={() => openPlannerWorkspace(selectedProject.id)} className="min-h-10 rounded-lg bg-indigo-700 px-3 text-sm font-semibold text-white hover:bg-indigo-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2">Open Planner Workspace</button>
          <button type="button" onClick={() => { setShowAiSettingsModal(true); setTestResult(null); }} className="min-h-10 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800">AI settings</button>
          {contractError && (
            <div role="alert" className="flex w-full flex-col gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100 sm:flex-row sm:items-start">
              <AlertTriangle aria-hidden="true" className="mt-0.5 shrink-0" size={19} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{contractError.title}</p>
                <p className="mt-1 text-xs leading-5 text-amber-900 dark:text-amber-200">{contractError.message}</p>
              </div>
              <button
                type="button"
                onClick={() => loadEnterpriseContract(selectedProject.id)}
                disabled={loadingContract}
                className="inline-flex min-h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-amber-400 bg-white px-3 text-xs font-semibold text-amber-950 hover:bg-amber-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-700 disabled:opacity-60 dark:bg-amber-900 dark:text-amber-50"
              >
                <RefreshCw aria-hidden="true" size={14} className={loadingContract ? 'animate-spin' : ''} /> Retry connection
              </button>
            </div>
          )}
          {enterpriseContract && !enterpriseContract.linked && (
            <div role="status" className="flex w-full items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-rose-900 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-100">
              <AlertTriangle aria-hidden="true" className="mt-0.5 shrink-0" size={19} />
              <div>
                <p className="text-sm font-semibold">This planning workspace is not linked to an enterprise project</p>
                <p className="mt-1 text-xs leading-5 text-rose-800 dark:text-rose-200">Its enterprise_project field is empty, so project master data cannot be synchronized. Open the required enterprise project in Project Control and create its linked workspace from the Plan &amp; Baseline tab.</p>
              </div>
            </div>
          )}
        </section>
      ) : null;
    }
    return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-4 sm:p-5 mb-6 flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={() => setViewMode('dashboard')}
        className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-xl border-2 border-slate-200 text-slate-600 hover:border-violet-300 hover:bg-violet-50/50 transition-colors"
      >
        <span>←</span> All Projects
      </button>
      <div className="flex items-center gap-2 text-slate-500">
        <span className="text-lg">🏗️</span>
        <label className="text-sm font-semibold text-slate-600 whitespace-nowrap">Planning Project</label>
      </div>
      <select
        className="border-2 border-slate-200 rounded-xl px-3 py-2 text-sm min-w-[240px] font-medium text-slate-700 bg-slate-50/60 focus:bg-white focus:border-violet-400 focus:outline-none transition-colors"
        value={selectedProjectId || ''}
        onChange={(e) => setSelectedProjectId(Number(e.target.value))}
      >
        {projects.map(p => (
          <option key={p.id} value={p.id}>{p.name}{p.phase ? ` (${p.phase})` : ''}</option>
        ))}
      </select>
      <button
        onClick={() => setShowNewProjectForm(v => !v)}
        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-sm hover:shadow-md hover:from-violet-700 hover:to-indigo-700 transition-all"
      >
        <span>＋</span> New Project
      </button>
      {selectedProject && (
        <button
          onClick={() => { setShowAiSettingsModal(true); setTestResult(null); }}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold rounded-xl border-2 border-slate-200 text-slate-700 hover:border-violet-300 hover:bg-violet-50/50 transition-colors"
        >
          <span>🤖</span> AI Settings
        </button>
      )}
      {selectedProject && (
        <div className="flex items-center gap-2 ml-auto flex-wrap">
          <span className="px-2.5 py-1 rounded-full bg-sky-50 text-sky-700 text-sm font-semibold">
            📁 {selectedProject.file_count || 0} file(s)
          </span>
          <span className="px-2.5 py-1 rounded-full bg-slate-50 text-slate-600 text-sm font-semibold border border-slate-200">
            📆 {selectedProject.effective_date || 'no effective date'}
          </span>
          {selectedProject.latest_generation_version && (
            <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-sm font-semibold">
              ✓ v{selectedProject.latest_generation_version}
            </span>
          )}
          {aiSettings && (
            <span className={`px-2.5 py-1 rounded-full text-sm font-semibold ${aiSettings.enabled && aiSettings.key_configured ? 'bg-violet-50 text-violet-700 border border-violet-200' : 'bg-slate-50 text-slate-500 border border-slate-200'}`}>
              {aiSettings.enabled && aiSettings.key_configured
                ? `🤖 ${savedAiProvider?.model_choices?.find(m => m.value === aiSettings.model)?.label.split(' (')[0] || savedAiProvider?.label || 'AI'} BYOK Active`
                : '🧮 Deterministic mode'}
            </span>
          )}
        </div>
      )}
    </div>
    );
  };

  // ── Multi-project dashboard ──────────────────────────────────────────────
  const dashboardPhases = Array.from(new Set(projects.map(p => p.phase).filter(Boolean))).sort();

  const filteredDashboardProjects = projects.filter(p => {
    const search = dashboardSearch.trim().toLowerCase();
    const matchesSearch = !search
      || p.name?.toLowerCase().includes(search)
      || p.client?.toLowerCase().includes(search);
    const matchesPhase = !dashboardPhaseFilter || p.phase === dashboardPhaseFilter;
    return matchesSearch && matchesPhase;
  });

  const dashboardStats = {
    totalProjects: projects.length,
    totalFiles: projects.reduce((sum, p) => sum + (p.file_count || 0), 0),
    totalGenerated: projects.filter(p => p.latest_generation_version).length,
  };

  const renderProjectsDashboard = () => (
    <div className="space-y-5">
      {/* Summary stats bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-4 flex items-center gap-3">
          <span className="text-2xl">🏗️</span>
          <div>
            <div className="text-2xl font-bold text-slate-800">{dashboardStats.totalProjects}</div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Planning Projects</div>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-4 flex items-center gap-3">
          <span className="text-2xl">📁</span>
          <div>
            <div className="text-2xl font-bold text-slate-800">{dashboardStats.totalFiles}</div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Reference Files</div>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-4 flex items-center gap-3">
          <span className="text-2xl">✓</span>
          <div>
            <div className="text-2xl font-bold text-slate-800">{dashboardStats.totalGenerated}</div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Schedules Generated</div>
          </div>
        </div>
      </div>

      {/* Search / filter / new project */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-4 sm:p-5 flex flex-wrap items-center gap-3">
        <label htmlFor="planning-project-search" className="sr-only">Search planning projects</label>
        <input
          id="planning-project-search"
          type="text"
          placeholder="Search by name or client…"
          value={dashboardSearch}
          onChange={e => setDashboardSearch(e.target.value)}
          className="flex-1 min-w-[200px] border-2 border-slate-200 rounded-xl px-3 py-2 text-sm focus:border-violet-400 focus:outline-none transition-colors"
        />
        <label htmlFor="planning-phase-filter" className="sr-only">Filter by project phase</label>
        <select
          id="planning-phase-filter"
          value={dashboardPhaseFilter}
          onChange={e => setDashboardPhaseFilter(e.target.value)}
          className="border-2 border-slate-200 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 bg-slate-50/60 focus:bg-white focus:border-violet-400 focus:outline-none transition-colors"
        >
          <option value="">All phases</option>
          {dashboardPhases.map(phase => <option key={phase} value={phase}>{phase}</option>)}
        </select>
        <button
          onClick={() => setShowNewProjectForm(v => !v)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-sm hover:shadow-md hover:from-violet-700 hover:to-indigo-700 transition-all"
        >
          <span>＋</span> New Project
        </button>
      </div>

      {showNewProjectForm && renderNewProjectForm()}

      {/* Card grid */}
      {filteredDashboardProjects.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-14 text-center">
          <div className="text-5xl mb-3">🔍</div>
          <p className="text-slate-500">No planning projects match your search.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDashboardProjects.map(project => (
            <div
              key={project.id}
              className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5 flex flex-col gap-3 hover:shadow-md hover:border-violet-200 transition-all"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-slate-800 leading-snug">{project.name}</h3>
                {project.phase && (
                  <span className="shrink-0 px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 text-xs font-semibold border border-violet-100">
                    {project.phase}
                  </span>
                )}
              </div>
              <div className="text-sm text-slate-500 space-y-0.5">
                {project.client && <div>🏢 {project.client}</div>}
                {project.location && <div>📍 {project.location}</div>}
                {project.effective_date && <div>📆 {project.effective_date}</div>}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-1 rounded-full bg-sky-50 text-sky-700 text-xs font-semibold">
                  📁 {project.file_count || 0} file(s)
                </span>
                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${project.latest_generation_version ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50 text-slate-400'}`}>
                  {project.latest_generation_version ? `✓ v${project.latest_generation_version}` : 'Not generated yet'}
                </span>
                {project.ai_enabled && (
                  <span className="px-2.5 py-1 rounded-full bg-violet-50 text-violet-700 text-xs font-semibold">🤖 AI</span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-auto pt-2">
                <button
                  type="button"
                  onClick={() => project.latest_generation_version ? openPlannerWorkspace(project.id) : handleOpenProject(project.id)}
                  className="min-h-11 flex-1 rounded-lg bg-indigo-700 px-3 text-sm font-semibold text-white hover:bg-indigo-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
                >
                  {project.latest_generation_version ? 'Open planning workspace' : 'Prepare plan'}
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteProject(project)}
                  aria-label={`Archive ${project.name}`}
                  title="Archive planning record"
                  className="px-3 py-2 text-sm font-semibold rounded-xl border-2 border-slate-200 text-slate-500 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                >
                  Archive
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderNewProjectForm = () => {
    const rangeDuration = calculateDateRangeDuration(newProject.effective_date, newProject.planned_end_date);
    return (
    <form
      onSubmit={handleCreateProject}
      className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5 sm:p-6 mb-6"
      aria-busy={creatingProject}
    >
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xl">✨</span>

        <h2 className="font-semibold text-slate-800">New Planning Project</h2>
      </div>
      <fieldset disabled={creatingProject} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <label className="text-sm">
          <span className="block text-sm font-semibold text-slate-600 mb-1">Project Name *</span>
          <input required className="w-full border-2 border-slate-200 rounded-xl px-3 py-2 text-sm focus:border-violet-400 focus:outline-none transition-colors"
            value={newProject.name} onChange={e => setNewProject({ ...newProject, name: e.target.value })} />
        </label>
        <label className="text-sm">
          <span className="block text-sm font-semibold text-slate-600 mb-1">Client</span>
          <input className="w-full border-2 border-slate-200 rounded-xl px-3 py-2 text-sm focus:border-violet-400 focus:outline-none transition-colors"
            value={newProject.client} onChange={e => setNewProject({ ...newProject, client: e.target.value })} />
        </label>
        <label className="text-sm">
          <span className="block text-sm font-semibold text-slate-600 mb-1">Location</span>
          <input className="w-full border-2 border-slate-200 rounded-xl px-3 py-2 text-sm focus:border-violet-400 focus:outline-none transition-colors"
            value={newProject.location} onChange={e => setNewProject({ ...newProject, location: e.target.value })} />
        </label>
        <label className="text-sm">
          <span className="block text-sm font-semibold text-slate-600 mb-1">Phase</span>
          <input placeholder="e.g. FEED" className="w-full border-2 border-slate-200 rounded-xl px-3 py-2 text-sm focus:border-violet-400 focus:outline-none transition-colors"
            value={newProject.phase} onChange={e => setNewProject({ ...newProject, phase: e.target.value })} />
        </label>
        <label className="text-sm">
          <span className="block text-sm font-semibold text-slate-600 mb-1">Project Start Date *</span>
          <input required type="date" max={newProject.planned_end_date || undefined} className="w-full border-2 border-slate-200 rounded-xl px-3 py-2 text-sm focus:border-violet-400 focus:outline-none transition-colors"
            value={newProject.effective_date} onChange={e => setNewProject({ ...newProject, effective_date: e.target.value })} />
        </label>
        <label className="text-sm">
          <span className="block text-sm font-semibold text-slate-600 mb-1">Project End Date *</span>
          <input required type="date" min={newProject.effective_date || undefined} className="w-full border-2 border-slate-200 rounded-xl px-3 py-2 text-sm focus:border-violet-400 focus:outline-none transition-colors"
            value={newProject.planned_end_date} onChange={e => setNewProject({ ...newProject, planned_end_date: e.target.value })} />
        </label>
        <div className={`sm:col-span-2 lg:col-span-3 rounded-xl border px-4 py-3 ${rangeDuration ? 'border-violet-200 bg-violet-50' : 'border-slate-200 bg-slate-50'}`}>
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Calculated project duration</div>
          <div className="mt-1 text-sm text-slate-700">
            {rangeDuration
              ? <><span className="font-bold text-violet-700">{rangeDuration.months.toFixed(1)} {rangeDuration.months.toFixed(1) === '1.0' ? 'month' : 'months'}</span><span className="mx-2 text-slate-300">·</span>{rangeDuration.days} calendar days</>
              : 'Select a start date and a later end date.'}
          </div>
          <p className="mt-1 text-xs text-slate-500">Calculated as complete calendar months plus the exact fraction of the remaining calendar month.</p>
        </div>
      </fieldset>
      {creatingProject && (
        <div className="mt-5" role="status" aria-live="polite">
          <div className="mb-1.5 flex items-center justify-between text-xs font-semibold text-violet-700">
            <span>Creating planning project…</span>
            <span>Please wait</span>
          </div>
          <div
            className="h-2 w-full overflow-hidden rounded-full bg-violet-100"
            role="progressbar"
            aria-label="Creating planning project"
          >
            <div className="h-full w-full animate-pulse rounded-full bg-gradient-to-r from-violet-500 via-indigo-500 to-violet-500" />
          </div>
        </div>
      )}
      <div className="flex gap-2 justify-end mt-5">
        <button
          type="button"
          onClick={() => setShowNewProjectForm(false)}
          disabled={creatingProject}
          className="px-4 py-2 text-sm font-medium rounded-xl border-2 border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={creatingProject}
          className="px-4 py-2 text-sm font-semibold rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-sm hover:shadow-md hover:from-violet-700 hover:to-indigo-700 transition-all disabled:opacity-40"
        >
          {creatingProject ? 'Creating…' : 'Create Project'}
        </button>
      </div>
    </form>
    );
  };

  const renderAiSettingsModal = () => {
    if (!showAiSettingsModal || !selectedProject) return null;
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
        onClick={() => { if (!savingAiSettings && !testingConnection) setShowAiSettingsModal(false); }}
      >
        <div
          ref={aiSettingsDialogRef}
          tabIndex="-1"
          role="dialog"
          aria-modal="true"
          aria-labelledby="planning-ai-settings-title"
          className="bg-white rounded-2xl shadow-xl border border-slate-200/80 w-full max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto p-5 sm:p-6"
          onClick={e => e.stopPropagation()}
          aria-busy={loadingAiSettings || savingAiSettings || testingConnection}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">🤖</span>
            <h2 id="planning-ai-settings-title" className="font-semibold text-slate-800">AI Settings (BYOK) — {selectedProject.name}</h2>
          </div>
          <p className="text-sm text-slate-600 mb-4">
            Bring your own API key to augment document intelligence and narrative
            generation for this project. Your key is encrypted at rest and never
            shown again after saving. Leave the key field blank to keep the stored key for the same provider.
          </p>
          <p className="text-sm text-slate-600 mb-4">Save Settings saves your configuration and tests the connection. This dialog stays open to show whether AI is ready for analysis.</p>

          {aiSettingsUnavailable && !aiSettingsLoadError && <p role="status" className="mb-4 text-sm text-slate-600">Loading AI settings…</p>}
          {aiSettingsLoadError && <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"><p role="alert">{aiSettingsLoadError}</p><button type="button" className="pln-button mt-2" onClick={() => loadAiSettings(selectedProjectId)} disabled={loadingAiSettings}>Retry loading AI settings</button></div>}

          <div className="space-y-4">
            <label className="flex items-center gap-2.5 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                className="w-4 h-4 accent-violet-600"
                checked={aiSettingsForm.enabled}
                disabled={aiSettingsUnavailable || savingAiSettings || testingConnection}
                onChange={e => { setTestResult(null); setAiSettingsForm(prev => ({ ...prev, enabled: e.target.checked })); }}
              />
              Enable AI BYOK for this project
            </label>

            <label className="block text-sm">
              <span className="block text-sm font-semibold text-slate-600 mb-1">AI provider</span>
              <select
                className="w-full border-2 border-slate-200 rounded-xl px-3 py-2 text-sm focus:border-violet-400 focus:outline-none transition-colors"
                value={aiSettingsForm.provider}
                disabled={aiSettingsUnavailable || savingAiSettings || testingConnection}
                onChange={e => {
                  const provider = aiProviderChoices.find(choice => choice.value === e.target.value);
                  setTestResult(null);
                  setAiSettingsForm(prev => ({ ...prev, provider: provider.value, model: provider.default_model, apiKey: '' }));
                }}
              >
                {aiProviderChoices.map(provider => <option key={provider.value} value={provider.value}>{provider.label}</option>)}
              </select>
            </label>

            <label className="block text-sm">
              <span className="block text-sm font-semibold text-slate-600 mb-1">AI model</span>
              <select
                className="w-full border-2 border-slate-200 rounded-xl px-3 py-2 text-sm focus:border-violet-400 focus:outline-none transition-colors"
                value={aiSettingsForm.model}
                disabled={aiSettingsUnavailable || savingAiSettings || testingConnection}
                onChange={e => { setTestResult(null); setAiSettingsForm(prev => ({ ...prev, model: e.target.value })); }}
              >
                {(selectedAiProvider?.model_choices || []).map(m => (
                  <option key={m.value} value={m.value}>{m.label}{m.recommended ? ' ★' : ''}</option>
                ))}
              </select>
            </label>

            <label className="block text-sm">
              <span className="block text-sm font-semibold text-slate-600 mb-1">
                {selectedAiProvider?.label || 'AI'} API Key {aiSettings?.key_configured && !aiProviderChanged && <span className="text-emerald-600 font-normal">(key configured ✓ — leave blank to keep it)</span>}
              </span>
              <input
                type="password"
                placeholder={aiSettingsForm.provider === 'gemini' ? 'Google AI Studio API key' : 'sk-ant-...'}
                autoComplete="off"
                className="w-full border-2 border-slate-200 rounded-xl px-3 py-2 text-sm focus:border-violet-400 focus:outline-none transition-colors"
                value={aiSettingsForm.apiKey}
                disabled={aiSettingsUnavailable || savingAiSettings || testingConnection}
                onChange={e => { setTestResult(null); setAiSettingsForm(prev => ({ ...prev, apiKey: e.target.value })); }}
              />
              {aiProviderChanged && aiSettings?.key_configured && <span className="mt-1 block text-xs text-amber-700">Enter a new API key for {selectedAiProvider?.label || 'the selected provider'}. Your saved key belongs to {savedAiProvider?.label || 'the previous provider'}.</span>}
            </label>

            {aiSettingsDirty && <p className="text-xs text-slate-600">Save settings to test the selected provider, model and key. Unsaved changes have not been tested.</p>}
            {testResult && (
              <div role={testResult.success || testResult.type === 'info' ? 'status' : 'alert'} className={`text-sm rounded-xl px-3 py-2 border ${testResult.success ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : testResult.type === 'info' ? 'bg-sky-50 text-sky-700 border-sky-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                {testResult.message}
              </div>
            )}
            {testResult?.success && ['failed', 'partial'].includes(aiAnalysisOutcome(intelligencePreview?.ai_processing_coverage).status) && <div className="mt-3 text-sm text-slate-700">
              <p>The connection test passed. The previous document analysis is still incomplete; retry it with these saved settings.</p>
              <button type="button" className="pln-button mt-2" disabled={analyzing || savingAiSettings || testingConnection || aiSettingsDirty} onClick={() => { setShowAiSettingsModal(false); handleRetryAnalysis(); }}>Retry document analysis</button>
            </div>}
            {pendingAnalysisWorkspace && !analyzing && <p role="status" className="mt-3 text-sm text-sky-700">Analysis findings are saved. Close AI Settings to open the Schedule Planner.</p>}
          </div>

          {(savingAiSettings || testingConnection) && (
            <div className="mt-5" role="status" aria-live="polite">
              <div className="mb-1.5 flex items-center justify-between text-xs font-semibold text-violet-700">
                <span>{testingConnection ? 'Testing AI connection…' : 'Saving AI settings…'}</span>
                <span>Please wait</span>
              </div>
              <div
                className="h-2 w-full overflow-hidden rounded-full bg-violet-100"
                role="progressbar"
                aria-label={testingConnection ? 'Testing AI connection' : 'Saving AI settings'}
              >
                <div className="h-full w-full animate-pulse rounded-full bg-gradient-to-r from-violet-500 via-indigo-500 to-violet-500" />
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2 justify-between mt-6">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleRemoveAiKey}
                disabled={aiSettingsUnavailable || savingAiSettings || testingConnection || !aiSettings?.key_configured}
                className="px-3.5 py-2 text-sm font-medium rounded-xl border-2 border-rose-200 text-rose-600 hover:bg-rose-50 disabled:opacity-40 transition-colors"
              >
                Remove Key
              </button>
              <button
                type="button"
                onClick={handleTestAiConnection}
                disabled={savingAiSettings || testingConnection || !canTestAiConnection}
                className="px-3.5 py-2 text-sm font-medium rounded-xl border-2 border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition-colors"
              >
                {testingConnection ? 'Testing…' : 'Test Connection'}
              </button>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowAiSettingsModal(false)}
                disabled={savingAiSettings || testingConnection}
                className="px-4 py-2 text-sm font-medium rounded-xl border-2 border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleSaveAiSettings}
                disabled={aiSettingsUnavailable || savingAiSettings || testingConnection || aiReplacementKeyRequired}
                className="px-4 py-2 text-sm font-semibold rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-sm hover:shadow-md hover:from-violet-700 hover:to-indigo-700 transition-all disabled:opacity-40"
              >
                {testingConnection ? 'Testing…' : savingAiSettings ? 'Saving…' : 'Save Settings'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderStepNav = () => (
    <div className="flex lg:flex-col gap-1.5 lg:w-64 shrink-0 overflow-x-auto lg:overflow-visible lg:sticky lg:top-6 lg:self-start bg-white lg:bg-transparent rounded-2xl lg:rounded-none border lg:border-0 border-slate-200/80 p-2 lg:p-0">
      {PLANNING_WORKFLOW_STAGES.map((stage, idx) => {
        const firstStep = PLANNING_WORKFLOW_STEPS.find(step => step.id === stage.stepIds[0]);
        const isActive = stage.stepIds.includes(currentStep);
        const locked = stage.stepIds.every(stepId => PLANNING_WORKFLOW_STEPS.find(step => step.id === stepId)?.requiresGeneration) && !generation;
        return (
          <button
            type="button"
            key={stage.id}
            disabled={locked}
            aria-current={isActive ? 'step' : undefined}
            aria-disabled={locked}
            onClick={() => !locked && setCurrentStep(stage.stepIds[0])}
            className={[
              'group flex items-start lg:items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap lg:whitespace-normal text-left transition-all shrink-0 lg:w-full',
              isActive
                ? 'bg-white shadow-md border border-violet-100 ring-1 ring-violet-100'
                : 'text-slate-500 hover:bg-white/70 hover:shadow-sm',
            ].join(' ')}
          >
            <span
              className={[
                'flex items-center justify-center w-8 h-8 rounded-lg text-sm shrink-0 transition-all',
                isActive
                  ? `bg-gradient-to-br ${firstStep?.accent || 'from-indigo-600 to-violet-600'} text-white shadow-sm`
                  : locked ? 'bg-slate-100 text-slate-400' : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200',
              ].join(' ')}
            >
              {idx + 1}
            </span>
            <span className="flex flex-col leading-tight min-w-0 flex-1">
              <span className={['break-words', isActive ? 'text-slate-800 font-semibold' : 'text-slate-600'].join(' ')}>
                {stage.label}
              </span>
              <span className="hidden lg:block text-xs text-slate-500 font-normal break-words whitespace-normal mt-0.5">{stage.description}</span>
            </span>
            {locked && <span className="text-slate-300 text-xs hidden lg:inline shrink-0 self-start mt-1">🔒</span>}
          </button>
        );
      })}
    </div>
  );

  const renderTaskNav = () => {
    const stage = PLANNING_WORKFLOW_STAGES.find(item => item.stepIds.includes(currentStep));
    if (!stage || stage.stepIds.length < 2) return null;
    return (
      <nav aria-label={`${stage.label} tools`} className="mb-3 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1">
        <ul className="flex min-w-max gap-1">
          {stage.stepIds.map(stepId => {
            const step = PLANNING_WORKFLOW_STEPS.find(item => item.id === stepId);
            const active = currentStep === stepId;
            return (
              <li key={stepId}>
                <button type="button" aria-current={active ? 'page' : undefined} onClick={() => setCurrentStep(stepId)} className={`min-h-10 rounded-lg px-3 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 ${active ? 'bg-violet-100 text-violet-800' : 'text-slate-600 hover:bg-slate-100'}`}>
                  {step?.label}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    );
  };

  const renderUploadStep = () => (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xl">📤</span>
          <h2 className="font-semibold text-slate-800">Upload Reference Documents</h2>
        </div>

        <div className="rounded-2xl border-2 border-dashed border-violet-200 bg-violet-50/40 p-5 sm:p-6 flex flex-wrap items-center gap-4">
          <label htmlFor="planning-file-category" className="sr-only">Document category</label>
          <select id="planning-file-category" className="border-2 border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:border-violet-400 focus:outline-none min-w-[220px]"
            value={uploadCategory} onChange={e => setUploadCategory(e.target.value)}>
            {PLANNING_FILE_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.icon} {c.label}</option>)}
          </select>
          <label className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-sm hover:shadow-md hover:from-violet-700 hover:to-indigo-700 cursor-pointer transition-all">
            <span>📁</span>{uploading ? 'Uploading…' : 'Choose File(s)'}
            <input type="file" multiple className="hidden" disabled={uploading || !selectedProjectId}
              onChange={(e) => handleUpload(e.target.files)} />
          </label>
          <span className="text-sm text-slate-500">Max {PLANNING_MAX_FILE_MB} MB/file · PDF, Excel, CSV, DOCX, XER, TXT</span>
        </div>

        <div className="mt-4 divide-y divide-slate-100">
          {files.length === 0 && (
            <p className="text-sm text-slate-400 py-6 text-center">No files uploaded yet for this project.</p>
          )}
          {files.map(f => {
            const style = PARSE_STATUS_STYLES[f.parse_status] || PARSE_STATUS_STYLES.pending;
            const cat = PLANNING_FILE_CATEGORIES.find(c => c.value === f.category);
            return (
              <div key={f.id} className="flex items-center justify-between py-2.5 text-sm hover:bg-slate-50/70 rounded-lg px-2 -mx-2 transition-colors">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-base shrink-0">{cat?.icon || '📎'}</span>
                  <div className="min-w-0">
                    <div className="font-medium text-slate-700 truncate">{f.original_filename}</div>
                    <div className="text-sm text-slate-500">{cat?.label || f.category}</div>
                    {f.parse_status === 'failed' && f.parse_error && (
                      <div className="mt-1 max-w-2xl text-xs text-rose-600 break-words" title={f.parse_error}>
                        Parser error: {f.parse_error}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`px-2.5 py-0.5 rounded-full text-sm font-semibold ${style.className}`}>{style.label}</span>
                  {f.parse_status === 'done' && <span className="text-sm text-slate-500">conf. {Math.round((f.confidence_score || 0) * 100)}%</span>}
                  {f.file && (
                    <a href={f.file} target="_blank" rel="noopener noreferrer"
                      title="View / download from S3"
                      className="text-slate-400 hover:text-violet-600 transition-colors">⬇️</a>
                  )}
                  <button onClick={() => handleDeleteFile(f.id)} className="text-slate-400 hover:text-rose-600 transition-colors">🗑️</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <button
        onClick={handleAnalyze}
        disabled={analyzing || !files.some(f => f.parse_status === 'done')}
        className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-slate-800 to-slate-900 text-white text-sm font-semibold shadow-sm hover:shadow-md transition-all disabled:opacity-40 disabled:shadow-none"
      >
        {analyzing ? 'Analyzing…' : 'Run Document Intelligence →'}
      </button>
    </div>
  );

  const renderIntelligenceStep = () => {
    const isEditing = editingSection === 'intelligence';
    const data = isEditing ? draftIntelligence : intelligencePreview;
    const aiOutcome = aiAnalysisOutcome(intelligencePreview?.ai_processing_coverage);
    const registerBased = data?.deliverable_source === 'register';
    const disciplineMeta = (code) => {
      const meta = PLANNING_DISCIPLINE_META[code] || { ...DEFAULT_DISCIPLINE_META, label: code.replaceAll('_', ' ') };
      return { ...meta, label: data?.disciplines?.[code]?.name || meta.label };
    };
    return (
    <div className="pln-intelligence-preview bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5 sm:p-6 space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xl">🧠</span>
        <h2 ref={intelligenceHeadingRef} tabIndex={-1} className="font-semibold text-slate-800">Document Intelligence Preview</h2>
        {intelligencePreview && (
          <span className={`px-2.5 py-1 rounded-full text-sm font-semibold ${intelligencePreview.ai_augmented ? 'bg-violet-50 text-violet-700 border border-violet-200' : 'bg-slate-50 text-slate-500 border border-slate-200'}`}>
            {analyzing ? `Previous saved analysis · ${aiOutcome.status === 'failed' ? 'AI failed' : aiOutcome.status === 'partial' ? 'AI incomplete' : 'findings retained'}` : aiOutcome.status === 'failed' ? 'AI analysis failed · source extraction retained' : aiOutcome.status === 'partial' ? 'AI analysis incomplete' : intelligencePreview.ai_augmented ? '✨ Enhanced by AI' : '🧮 Deterministic analysis'}
          </span>
        )}
        {intelligencePreview && !isEditing && (
          <>
            <button
              onClick={() => {
                setVisualizationSection('intelligence');
                setShowVisualization(true);
              }}
              className="ml-auto px-3 py-1.5 text-sm font-semibold rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 border border-blue-200 hover:from-blue-100 hover:to-indigo-100 transition-all inline-flex items-center gap-1.5"
            >
              📊 Visualize
            </button>
            <button disabled={savingPreview || packageBusy} onClick={() => startEdit('intelligence')}
              className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors inline-flex items-center gap-1.5">
              ✏️ Edit
            </button>
          </>
        )}
        {isEditing && (
          <div className="ml-auto flex items-center gap-2">
            <button disabled={savingPreview} onClick={cancelEdit} className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors">Cancel</button>
            <button disabled={savingPreview} onClick={handleSaveIntelligenceEdit} className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-violet-600 text-white hover:bg-violet-700 transition-colors">{embedded ? 'Apply edits' : 'Save Changes'}</button>
          </div>
        )}
        {embedded && intelligencePreview && <button type="button" className="pln-button" disabled={savingPreview} onClick={() => setReviewRequest(value => value + 1)}>{previewReviewState.conflicts ? 'Review clarification' : 'Review source findings'}</button>}
      </div>
      {intelligencePreview && <PlanningExtractionCoverage coverage={intelligencePreview.processing_coverage} aiCoverage={intelligencePreview.ai_processing_coverage} previousResult={analyzing} onAiSettings={() => { setShowAiSettingsModal(true); setTestResult(null); }} onRetryAnalysis={handleRetryAnalysis} busy={analyzing || savingPreview || isEditing} />}
      {previewSaveError && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">{previewSaveError}</p>}
      {embedded && previewReviewState.conflicts > 0 && <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">Resolve the source clarification before confirming this preview.</p>}
      {embedded && intelligenceOutdated && <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900" role="status">Project inputs or source documents have changed. Return to Scope &amp; inputs and run Document Intelligence to refresh this preview.</p>}
      {!intelligencePreview && (
        <div className="flex items-center gap-3 bg-slate-50 rounded-xl p-4">
          <p className="text-sm text-slate-400 flex-1">Run document intelligence from the Upload step first.</p>
          <button onClick={handleAnalyze} disabled={analyzing} className="px-3.5 py-2 text-sm font-semibold rounded-xl bg-slate-800 text-white hover:bg-slate-900 transition-colors">
            {analyzing ? 'Analyzing…' : 'Run Now'}
          </button>
        </div>
      )}
      {data && (
        <fieldset disabled={savingPreview || packageBusy} className="min-w-0 space-y-5 border-0 p-0">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <div className="rounded-xl p-4 bg-gradient-to-br from-sky-50 to-white border border-sky-100">
              <div className="text-sky-600 text-sm font-semibold uppercase tracking-wide">Detected Project Name</div>
              {isEditing ? (
                <input type="text" value={data.detected_project_name || ''}
                  onChange={e => setDraftIntelligence(prev => ({ ...prev, detected_project_name: e.target.value }))}
                  className="mt-1 w-full border border-sky-200 rounded-lg px-2 py-1.5 text-sm font-semibold text-slate-700 focus:outline-none focus:border-sky-400" />
              ) : (
                <div className="font-semibold text-slate-700 mt-1">{data.detected_project_name || '—'}</div>
              )}
            </div>
            <div className="rounded-xl p-4 bg-gradient-to-br from-violet-50 to-white border border-violet-100">
              <div className="text-violet-600 text-sm font-semibold uppercase tracking-wide">Detected Effective Date</div>
              {isEditing ? (
                <input type="text" value={data.detected_effective_date_text || ''}
                  onChange={e => setDraftIntelligence(prev => ({ ...prev, detected_effective_date_text: e.target.value }))}
                  className="mt-1 w-full border border-violet-200 rounded-lg px-2 py-1.5 text-sm font-semibold text-slate-700 focus:outline-none focus:border-violet-400" />
              ) : (
                <div className="font-semibold text-slate-700 mt-1">{data.detected_effective_date_text || '—'}</div>
              )}
            </div>
            <div className="rounded-xl p-4 bg-gradient-to-br from-emerald-50 to-white border border-emerald-100">
              <div className="text-emerald-600 text-sm font-semibold uppercase tracking-wide">Detected Duration</div>
              {isEditing ? (
                <input type="number" min="1" value={data.detected_duration_months || ''}
                  onChange={e => setDraftIntelligence(prev => ({ ...prev, detected_duration_months: e.target.value ? Number(e.target.value) : null }))}
                  className="mt-1 w-full border border-emerald-200 rounded-lg px-2 py-1.5 text-sm font-semibold text-slate-700 focus:outline-none focus:border-emerald-400" />
              ) : (
                <div className="font-semibold text-slate-700 mt-1">{data.detected_duration_months ? `${data.detected_duration_months} months` : '—'}</div>
              )}
            </div>
          </div>

          {data.evidence_summary && (
            <div className={`rounded-xl border p-4 ${data.evidence_summary.conflict_count ? 'bg-amber-50/70 border-amber-200' : 'bg-emerald-50/60 border-emerald-200'}`}>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-700">Source Evidence</h3>
                <span className="px-2 py-0.5 rounded-full bg-white border border-slate-200 text-sm text-slate-600">
                  {data.evidence_summary.fact_count || 0} facts
                </span>
                <span className="px-2 py-0.5 rounded-full bg-white border border-emerald-200 text-sm text-emerald-700">
                  {data.evidence_summary.confirmed_count || 0} confirmed
                </span>
                <span className={`px-2 py-0.5 rounded-full bg-white border text-sm ${data.evidence_summary.conflict_count ? 'border-amber-300 text-amber-700' : 'border-slate-200 text-slate-500'}`}>
                  {data.evidence_summary.conflict_count || 0} open conflicts
                </span>
                {data.document_intelligence_run_id && (
                  <span className="ml-auto text-sm font-mono text-slate-400">Run #{data.document_intelligence_run_id}</span>
                )}
              </div>
              <p className="mt-2 text-sm text-slate-600">Facts can include requirements and project details. The fact count is not an activity or deliverable count.</p>
              {(data.open_conflicts || []).length > 0 && (
                <div className="mt-3 space-y-1.5">
                  {(data.open_conflicts || []).map(conflict => (
                    <div key={conflict.id} className="rounded-lg bg-white border border-amber-200 px-3 py-2 text-sm text-amber-800">
                      <span className="font-semibold">Needs review:</span> {conflict.description}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {!embedded && <WorkablePlanBuilder
            projectId={selectedProjectId}
            intelligenceRunId={data.document_intelligence_run_id}
            onOpenPlanner={() => openPlannerWorkspace(selectedProjectId)}
          />}

          {(data.ai_review?.review_summary || data.ai_review?.additional_notes) && (
            <div className="rounded-xl p-4 bg-gradient-to-br from-violet-50 via-indigo-50 to-white border border-violet-100">
              <div className="flex items-center gap-2 text-violet-700 text-sm font-semibold uppercase tracking-wide mb-1.5">
                <span>✨</span> RADAI Review
              </div>
              <p className="text-sm text-slate-700">{Number.isInteger(data.ai_processing_coverage?.chunks_processed) && Number.isInteger(data.ai_processing_coverage?.chunks_total)
                ? `${data.ai_processing_coverage.chunks_processed} of ${data.ai_processing_coverage.chunks_total} AI sections processed. ` : ''}
                {Number.isInteger(data.evidence_summary?.fact_count) ? `${data.evidence_summary.fact_count.toLocaleString()} source facts retained. ` : ''}
                {Number.isInteger(data.evidence_summary?.conflict_count) ? `${data.evidence_summary.conflict_count} open conflicts. ` : ''}
                Review the saved findings and planning assumptions.</p>
              <details className="mt-3"><summary className="cursor-pointer text-sm font-semibold text-violet-800">Read analysis notes</summary>
                <div className="mt-2 max-h-64 overflow-y-auto whitespace-pre-line text-sm text-slate-700" tabIndex={0} role="region" aria-label="Saved analysis notes">
                  {data.ai_review.review_summary && <p>{data.ai_review.review_summary}</p>}
                  {data.ai_review.additional_notes && <p className="mt-2">{data.ai_review.additional_notes}</p>}
                </div>
              </details>
            </div>
          )}

          {data.sow_only_mode && (
            <div className="rounded-xl p-4 bg-gradient-to-br from-amber-50 via-yellow-50 to-white border border-amber-200">
              <div className="flex items-center gap-2 text-amber-700 text-sm font-semibold uppercase tracking-wide mb-1">
                <span>⚡</span> SOW-only mode
              </div>
              <p className="text-sm text-slate-700">
                {registerBased ? 'A deliverable register was extracted from the Scope of Work. Review its source rows and any extraction gaps.' : 'Only the Scope of Work has been uploaded. Review its explicit requirements and deliverable references before planning.'}
                {' Disciplines and deliverables must come from the document or reviewed planning inputs.'}
                {['failed', 'partial'].includes(aiOutcome.status) ? ` ${aiOutcome.recoveryMessage}` : data.ai_augmented ? ' Review AI-proposed scope against the source before confirming it.' : ' Configure project AI settings if AI-assisted source analysis is needed.'}
              </p>
            </div>
          )}

          {data.ai_scope && (
            <div className="rounded-xl p-4 bg-gradient-to-br from-indigo-50 via-violet-50 to-white border border-indigo-200">
              <div className="flex items-center gap-2 text-indigo-700 text-sm font-semibold uppercase tracking-wide mb-1.5">
                <span>🎯</span> AI Scope Assessment
                {data.ai_scope.sow_only_authoritative_applied && (
                  <span className="ml-2 text-sm font-semibold bg-violet-100 text-violet-700 border border-violet-200 rounded-full px-2 py-0.5 normal-case tracking-normal">
                    ✨ Document is source of truth
                  </span>
                )}
              </div>
              {data.ai_scope.scope_summary && (
                <p className="text-sm text-slate-700 mb-2">{data.ai_scope.scope_summary}</p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-emerald-700 font-semibold text-sm mb-1">✓ In scope ({(data.ai_scope.disciplines_in_scope || []).length})</div>
                  <div className="flex flex-wrap gap-1">
                    {(data.ai_scope.disciplines_in_scope || []).length === 0
                      ? <span className="text-slate-400 text-sm italic">(none flagged — everything stays in by default)</span>
                      : (data.ai_scope.disciplines_in_scope || []).map(c => (
                          <span key={c} className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">
                            {(PLANNING_DISCIPLINE_META[c] || {}).label || c}
                          </span>
                        ))}
                  </div>
                </div>
                <div>
                  <div className="text-rose-700 font-semibold text-sm mb-1">✗ Out of scope ({(data.ai_scope.disciplines_out_of_scope || []).length})</div>
                  <div className="flex flex-wrap gap-1">
                    {(data.ai_scope.disciplines_out_of_scope || []).length === 0
                      ? <span className="text-slate-400 text-sm italic">(none)</span>
                      : (data.ai_scope.disciplines_out_of_scope || []).map(c => (
                          <span key={c} className="px-2 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-sm line-through">
                            {(PLANNING_DISCIPLINE_META[c] || {}).label || c}
                          </span>
                        ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-sm font-semibold text-slate-600">Disciplines</h3>
              <span className="text-sm text-slate-400">
                Tick every discipline that applies to this project
              </span>
            </div>
            {(() => {
              const selectedDisciplines = new Set(
                Object.entries(data.disciplines || {})
                  .filter(([_, info]) => info.in_scope !== false)
                  .map(([disc, _]) => disc)
              );
              const toggleDiscipline = (disc) => {
                if (isEditing) {
                  setDraftIntelligence(prev => {
                    const next = { ...prev, disciplines: { ...prev.disciplines } };
                    if (next.disciplines[disc]) {
                      next.disciplines[disc] = { 
                        ...next.disciplines[disc], 
                        in_scope: !next.disciplines[disc].in_scope 
                      };
                    }
                    return next;
                  });
                } else {
                  setIntelligencePreview(prev => {
                    const next = { ...prev, disciplines: { ...prev.disciplines } };
                    if (next.disciplines[disc]) {
                      next.disciplines[disc] = { 
                        ...next.disciplines[disc], 
                        in_scope: !next.disciplines[disc].in_scope 
                      };
                    }
                    return next;
                  });
                }
              };

              const setAllDisciplines = (all) => {
                if (isEditing) {
                  setDraftIntelligence(prev => {
                    const next = { ...prev, disciplines: { ...prev.disciplines } };
                    Object.keys(next.disciplines).forEach(disc => {
                      next.disciplines[disc] = { ...next.disciplines[disc], in_scope: all };
                    });
                    return next;
                  });
                } else {
                  setIntelligencePreview(prev => {
                    const next = { ...prev, disciplines: { ...prev.disciplines } };
                    Object.keys(next.disciplines).forEach(disc => {
                      next.disciplines[disc] = { ...next.disciplines[disc], in_scope: all };
                    });
                    return next;
                  });
                }
              };

              const availableDisciplines = Object.keys(data.disciplines || {});
              if (!availableDisciplines.length) {
                return <p className="text-sm text-slate-400 italic">No disciplines detected yet.</p>;
              }

              return (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {availableDisciplines.map(disc => {
                      const meta = disciplineMeta(disc);
                      const info = data.disciplines[disc];
                      const isChecked = info.in_scope !== false;
                      return (
                        <label
                          key={disc}
                          className={`px-2.5 py-2 text-sm font-medium rounded-lg border cursor-pointer transition-colors flex items-center gap-2 ${
                            isChecked
                              ? 'bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100'
                              : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                          }`}
                          title={isChecked ? 'Included in the schedule' : 'Will be skipped'}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleDiscipline(disc)}
                            className="accent-violet-600"
                          />
                          <span className="text-base">{meta.icon}</span>
                          <span className="truncate">{meta.label}</span>
                        </label>
                      );
                    })}
                  </div>
                  <div className="mt-2 flex items-center gap-3 text-sm">
                    <button
                      type="button"
                      onClick={() => setAllDisciplines(true)}
                      className="text-violet-600 hover:text-violet-700 font-medium"
                    >Select all</button>
                    <span className="text-slate-300">·</span>
                    <button
                      type="button"
                      onClick={() => setAllDisciplines(false)}
                      className="text-slate-500 hover:text-rose-600 font-medium"
                    >Clear all</button>
                    <span className="ml-auto text-sm text-slate-400">
                      {selectedDisciplines.size} selected
                    </span>
                  </div>
                </>
              );
            })()}
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-sm font-semibold text-slate-600">Deliverables</h3>
              <span className="text-sm text-slate-400">
                {registerBased
                  ? `${data.register_summary?.row_count ?? Object.values(data.disciplines || {}).reduce((count, item) => count + (item.deliverables || []).length, 0)} register deliverables`
                  : 'Tick every deliverable to include in the schedule'}
              </span>
            </div>
            {(() => {
              // Collect all deliverables from all disciplines
              const allDeliverables = [];
              Object.entries(data.disciplines || {}).forEach(([disc, info]) => {
                if (info.in_scope !== false) {
                  (info.deliverables || []).forEach(d => {
                    const wasMentioned = (info.mentioned_in_source || []).includes(d);
                    const aiDiscovered = (info.ai_discovered || []).includes(d);
                    const excluded = info.excluded_deliverables || [];
                    const isChecked = !excluded.includes(d);
                    const meta = disciplineMeta(disc);
                    
                    allDeliverables.push({
                      disc,
                      name: d,
                      wasMentioned,
                      aiDiscovered,
                      isChecked,
                      icon: meta.icon,
                      disciplineLabel: meta.label,
                    });
                  });
                }
              });

              const toggleDeliverable = (disc, deliverableName) => {
                if (isEditing) {
                  setDraftIntelligence(prev => {
                    const next = { ...prev, disciplines: { ...prev.disciplines } };
                    const excluded = next.disciplines[disc].excluded_deliverables || [];
                    if (excluded.includes(deliverableName)) {
                      // Include it
                      next.disciplines[disc] = {
                        ...next.disciplines[disc],
                        excluded_deliverables: excluded.filter(item => item !== deliverableName),
                      };
                    } else {
                      // Exclude it
                      next.disciplines[disc] = {
                        ...next.disciplines[disc],
                        excluded_deliverables: [...excluded, deliverableName],
                      };
                    }
                    return next;
                  });
                } else {
                  setIntelligencePreview(prev => {
                    const next = { ...prev, disciplines: { ...prev.disciplines } };
                    const excluded = next.disciplines[disc].excluded_deliverables || [];
                    if (excluded.includes(deliverableName)) {
                      // Include it
                      next.disciplines[disc] = {
                        ...next.disciplines[disc],
                        excluded_deliverables: excluded.filter(item => item !== deliverableName),
                      };
                    } else {
                      // Exclude it
                      next.disciplines[disc] = {
                        ...next.disciplines[disc],
                        excluded_deliverables: [...excluded, deliverableName],
                      };
                    }
                    return next;
                  });
                }
              };

              const setAllDeliverables = (all) => {
                if (isEditing) {
                  setDraftIntelligence(prev => {
                    const next = { ...prev, disciplines: { ...prev.disciplines } };
                    Object.entries(next.disciplines).forEach(([disc, info]) => {
                      if (info.in_scope !== false) {
                        next.disciplines[disc] = {
                          ...next.disciplines[disc],
                          excluded_deliverables: all ? [] : [...(info.deliverables || [])],
                        };
                      }
                    });
                    return next;
                  });
                } else {
                  setIntelligencePreview(prev => {
                    const next = { ...prev, disciplines: { ...prev.disciplines } };
                    Object.entries(next.disciplines).forEach(([disc, info]) => {
                      if (info.in_scope !== false) {
                        next.disciplines[disc] = {
                          ...next.disciplines[disc],
                          excluded_deliverables: all ? [] : [...(info.deliverables || [])],
                        };
                      }
                    });
                    return next;
                  });
                }
              };

              if (!allDeliverables.length) {
                return <p className="text-sm text-slate-400 italic">No deliverables available yet.</p>;
              }

              return (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {allDeliverables.map((item, idx) => {
                      return (
                        <label
                          key={`${item.disc}-${item.name}-${idx}`}
                          className={`px-2.5 py-2 text-sm font-medium rounded-lg border cursor-pointer transition-colors flex items-start gap-2 ${
                            item.isChecked
                              ? 'bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100'
                              : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50'
                          }`}
                          title={item.isChecked ? 'Included in the schedule' : 'Will be skipped'}
                        >
                          <input
                            type="checkbox"
                            checked={item.isChecked}
                            onChange={() => toggleDeliverable(item.disc, item.name)}
                            className="accent-violet-600 mt-0.5"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <span className="text-xs">{item.icon}</span>
                              <span className="text-xs text-slate-500 truncate">{item.disciplineLabel}</span>
                              {item.wasMentioned && (
                                <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-full px-1.5 py-0.5">In source</span>
                              )}
                              {item.aiDiscovered && (
                                <span className="text-xs font-semibold text-violet-600 bg-violet-50 border border-violet-100 rounded-full px-1.5 py-0.5">AI</span>
                              )}
                            </div>
                            <span className={`block whitespace-normal break-words ${item.isChecked ? 'text-slate-700' : 'text-slate-400'}`}>{item.name}</span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                  <div className="mt-2 flex items-center gap-3 text-sm">
                    <button
                      type="button"
                      onClick={() => setAllDeliverables(true)}
                      className="text-violet-600 hover:text-violet-700 font-medium"
                    >Select all</button>
                    <span className="text-slate-300">·</span>
                    <button
                      type="button"
                      onClick={() => setAllDeliverables(false)}
                      className="text-slate-500 hover:text-rose-600 font-medium"
                    >Clear all</button>
                    <span className="ml-auto text-sm text-slate-400">
                      {allDeliverables.filter(d => d.isChecked).length} selected
                    </span>
                  </div>
                </>
              );
            })()}
          </div>

          <div className="border-t border-slate-200 pt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
              {Object.entries(data.disciplines || {}).map(([disc, info]) => {
                const meta = disciplineMeta(disc);
                const total = info.deliverables.length;
                const mentioned = info.mentioned_in_source.length;
                const pct = total ? Math.round((mentioned / total) * 100) : 0;
                const isOpen = expandedDiscipline === disc;
                const inScope = info.in_scope !== false;
                const toggleScope = () => {
                  if (isEditing) {
                    setDraftIntelligence(prev => {
                      const next = { ...prev, disciplines: { ...prev.disciplines } };
                      next.disciplines[disc] = { ...next.disciplines[disc], in_scope: !inScope };
                      return next;
                    });
                  } else {
                    setIntelligencePreview(prev => {
                      const next = { ...prev, disciplines: { ...prev.disciplines } };
                      next.disciplines[disc] = { ...next.disciplines[disc], in_scope: !inScope };
                      return next;
                    });
                  }
                };
                return (
                  <div key={disc}
                    className={`border rounded-xl overflow-hidden transition-all ${!inScope ? 'opacity-60 border-slate-200 bg-slate-50' : isOpen ? 'border-violet-300 shadow-sm sm:col-span-2 xl:col-span-3' : 'border-slate-200 hover:border-violet-200 hover:shadow-sm'}`}>
                    <div className="w-full flex items-center gap-3 p-3">
                      <button
                        type="button"
                        onClick={() => setExpandedDiscipline(isOpen ? null : disc)}
                        className="flex-1 flex items-center gap-3 text-left"
                      >
                        <span className={`shrink-0 w-9 h-9 rounded-lg bg-gradient-to-br ${meta.accent} flex items-center justify-center text-base shadow-sm`}>{meta.icon}</span>
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold capitalize text-slate-700 truncate flex items-center gap-2">
                            <span className={!inScope ? 'line-through text-slate-400' : ''}>{meta.label}</span>
                            {!inScope && (
                              <span className="text-sm font-semibold bg-rose-50 text-rose-600 border border-rose-100 rounded-full px-2 py-0.5">Out of scope</span>
                            )}
                          </div>
                          <div className="text-sm text-slate-500 mt-0.5">
                            {mentioned}/{total} deliverable(s) mentioned in source · {meta.responsibleRole}
                          </div>
                          <div className="mt-1.5 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                            <div className={`h-full rounded-full bg-gradient-to-r ${meta.accent}`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                        <span className={`shrink-0 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}>▾</span>
                      </button>
                    </div>
                    {isOpen && (
                      <div className="border-t border-slate-100 bg-slate-50/60 p-3.5">
                        <p className="text-sm text-slate-500 mb-2">
                          {isEditing && disciplineSelectionMode === 'manual'
                            ? (
                              <span className="flex items-center gap-2">
                                <span className="text-violet-600">👤</span>
                                <span>
                                  <strong>Expert Selection Mode:</strong> Check the deliverables that apply to this project. Add missing ones using the input below.
                                </span>
                              </span>
                            )
                            : isEditing
                            ? <span className="flex items-center gap-2"><span className="text-blue-600">☑️</span><strong>Check/uncheck deliverables to include or exclude them from the schedule.</strong></span>
                            : registerBased
                              ? `Deliverables from the uploaded register for ${meta.label}. Titles and order match the source rows.`
                              : `Full deliverable checklist for ${meta.label} — items flagged as source-mentioned were detected in your uploaded documents; the rest fall back to the standard catalogue.`}
                        </p>
                        {info.deliverables.length === 0 && isEditing && disciplineSelectionMode === 'manual' ? (
                          <div className="mb-3 p-4 bg-violet-50 border border-violet-200 rounded-lg text-center">
                            <span className="text-3xl mb-2 block">📋</span>
                            <p className="text-sm text-slate-600 font-medium mb-1">No deliverables added yet</p>
                            <p className="text-xs text-slate-500">Use the input below to add deliverables for this discipline</p>
                          </div>
                        ) : (
                          <>
                            {isEditing && info.deliverables.length > 0 && (
                              <div className="mb-3 space-y-2">
                                <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
                                  <span className="text-xs text-slate-500 font-medium">Quick Actions:</span>
                                  <button
                                    onClick={() => {
                                      setDraftIntelligence(prev => {
                                        const next = { ...prev, disciplines: { ...prev.disciplines } };
                                        next.disciplines[disc] = {
                                          ...next.disciplines[disc],
                                          excluded_deliverables: [],
                                        };
                                        return next;
                                      });
                                    }}
                                    className="text-xs px-2 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded hover:bg-emerald-100 transition-colors"
                                  >
                                    ✓ Select All
                                  </button>
                                  <button
                                    onClick={() => {
                                      setDraftIntelligence(prev => {
                                        const next = { ...prev, disciplines: { ...prev.disciplines } };
                                        next.disciplines[disc] = {
                                          ...next.disciplines[disc],
                                          excluded_deliverables: [...info.deliverables],
                                        };
                                        return next;
                                      });
                                    }}
                                    className="text-xs px-2 py-1 bg-slate-50 text-slate-600 border border-slate-200 rounded hover:bg-slate-100 transition-colors"
                                  >
                                    ✗ Deselect All
                                  </button>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-xs text-violet-500 font-medium">Smart Presets:</span>
                                  <button
                                    onClick={() => {
                                      const designDocs = info.deliverables.filter(d => 
                                        d.toLowerCase().includes('design') || 
                                        d.toLowerCase().includes('basis') || 
                                        d.toLowerCase().includes('philosophy') ||
                                        d.toLowerCase().includes('criteria')
                                      );
                                      setDraftIntelligence(prev => {
                                        const next = { ...prev, disciplines: { ...prev.disciplines } };
                                        const excluded = next.disciplines[disc].excluded_deliverables || [];
                                        next.disciplines[disc] = {
                                          ...next.disciplines[disc],
                                          excluded_deliverables: info.deliverables.filter(d => !designDocs.includes(d)),
                                        };
                                        return next;
                                      });
                                    }}
                                    className="text-xs px-2 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded hover:bg-blue-100 transition-colors"
                                    title="Select Design Basis, Philosophy, Criteria documents"
                                  >
                                    📐 Design Docs
                                  </button>
                                  <button
                                    onClick={() => {
                                      const drawings = info.deliverables.filter(d => 
                                        d.toLowerCase().includes('drawing') || 
                                        d.toLowerCase().includes('layout') || 
                                        d.toLowerCase().includes('diagram') ||
                                        d.toLowerCase().includes('plan')
                                      );
                                      setDraftIntelligence(prev => {
                                        const next = { ...prev, disciplines: { ...prev.disciplines } };
                                        next.disciplines[disc] = {
                                          ...next.disciplines[disc],
                                          excluded_deliverables: info.deliverables.filter(d => !drawings.includes(d)),
                                        };
                                        return next;
                                      });
                                    }}
                                    className="text-xs px-2 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded hover:bg-indigo-100 transition-colors"
                                    title="Select Drawings, Layouts, Diagrams"
                                  >
                                    🗺️ Drawings
                                  </button>
                                  <button
                                    onClick={() => {
                                      const lists = info.deliverables.filter(d => 
                                        d.toLowerCase().includes('list') || 
                                        d.toLowerCase().includes('schedule') || 
                                        d.toLowerCase().includes('register') ||
                                        d.toLowerCase().includes('index')
                                      );
                                      setDraftIntelligence(prev => {
                                        const next = { ...prev, disciplines: { ...prev.disciplines } };
                                        next.disciplines[disc] = {
                                          ...next.disciplines[disc],
                                          excluded_deliverables: info.deliverables.filter(d => !lists.includes(d)),
                                        };
                                        return next;
                                      });
                                    }}
                                    className="text-xs px-2 py-1 bg-purple-50 text-purple-700 border border-purple-200 rounded hover:bg-purple-100 transition-colors"
                                    title="Select Lists, Schedules, Registers"
                                  >
                                    📋 Lists
                                  </button>
                                  <button
                                    onClick={() => {
                                      const sourceMentioned = info.deliverables.filter(d => 
                                        info.mentioned_in_source.includes(d)
                                      );
                                      setDraftIntelligence(prev => {
                                        const next = { ...prev, disciplines: { ...prev.disciplines } };
                                        next.disciplines[disc] = {
                                          ...next.disciplines[disc],
                                          excluded_deliverables: info.deliverables.filter(d => !sourceMentioned.includes(d)),
                                        };
                                        return next;
                                      });
                                    }}
                                    className="text-xs px-2 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded hover:bg-emerald-100 transition-colors"
                                    title="Select only deliverables found in your uploaded documents"
                                  >
                                    ✅ In Source
                                  </button>
                                  {(info.ai_discovered || []).length > 0 && (
                                    <button
                                      onClick={() => {
                                        const aiDiscovered = info.ai_discovered || [];
                                        setDraftIntelligence(prev => {
                                          const next = { ...prev, disciplines: { ...prev.disciplines } };
                                          next.disciplines[disc] = {
                                            ...next.disciplines[disc],
                                            excluded_deliverables: info.deliverables.filter(d => !aiDiscovered.includes(d)),
                                          };
                                          return next;
                                        });
                                      }}
                                      className="text-xs px-2 py-1 bg-violet-50 text-violet-700 border border-violet-200 rounded hover:bg-violet-100 transition-colors"
                                      title="Select only AI-discovered deliverables"
                                    >
                                      ✨ AI-Discovered
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}
                            <ul className="space-y-1.5">
                            {info.deliverables.map((d, dIdx) => {
                              const wasMentioned = info.mentioned_in_source.includes(d);
                              const aiDiscovered = (info.ai_discovered || []).includes(d);
                              // Check if this deliverable is marked as included (for expert selection)
                              const isIncluded = !info.excluded_deliverables || !info.excluded_deliverables.includes(d);
                              
                              return (
                                <li key={`${d}-${dIdx}`} className={`flex items-center gap-2 text-sm transition-opacity ${!isIncluded && isEditing ? 'opacity-40' : ''}`}>
                                  {isEditing ? (
                                    <label className="flex items-center gap-2 flex-1 cursor-pointer hover:bg-slate-50 -mx-1 px-1 py-1 rounded transition-colors">
                                      <input
                                        type="checkbox"
                                        checked={isIncluded}
                                        onChange={(e) => {
                                          const shiftKey = e.nativeEvent.shiftKey;
                                          
                                          setDraftIntelligence(prev => {
                                            const next = { ...prev, disciplines: { ...prev.disciplines } };
                                            const excluded = next.disciplines[disc].excluded_deliverables || [];
                                            
                                            // Handle Shift+Click for range selection
                                            if (shiftKey && lastClickedIndex[disc] !== undefined && lastClickedIndex[disc] !== dIdx) {
                                              const start = Math.min(lastClickedIndex[disc], dIdx);
                                              const end = Math.max(lastClickedIndex[disc], dIdx);
                                              const rangeDeliverables = info.deliverables.slice(start, end + 1);
                                              
                                              if (e.target.checked) {
                                                // Include all in range
                                                next.disciplines[disc] = {
                                                  ...next.disciplines[disc],
                                                  excluded_deliverables: excluded.filter(item => !rangeDeliverables.includes(item)),
                                                };
                                              } else {
                                                // Exclude all in range
                                                const newExcluded = [...new Set([...excluded, ...rangeDeliverables])];
                                                next.disciplines[disc] = {
                                                  ...next.disciplines[disc],
                                                  excluded_deliverables: newExcluded,
                                                };
                                              }
                                            } else {
                                              // Single click - toggle just this item
                                              if (e.target.checked) {
                                                // Remove from excluded list (include it)
                                                next.disciplines[disc] = {
                                                  ...next.disciplines[disc],
                                                  excluded_deliverables: excluded.filter(item => item !== d),
                                                };
                                              } else {
                                                // Add to excluded list (exclude it)
                                                next.disciplines[disc] = {
                                                  ...next.disciplines[disc],
                                                  excluded_deliverables: [...excluded, d],
                                                };
                                              }
                                            }
                                            
                                            return next;
                                          });
                                          
                                          // Update last clicked index for this discipline
                                          setLastClickedIndex(prev => ({ ...prev, [disc]: dIdx }));
                                        }}
                                        className="accent-violet-600 shrink-0"
                                        title={isIncluded ? "Click to exclude | Shift+Click for range" : "Click to include | Shift+Click for range"}
                                      />
                                      <span className={`${aiDiscovered ? 'text-violet-500' : wasMentioned ? 'text-emerald-600' : 'text-slate-400'} shrink-0`}>
                                        {aiDiscovered ? '✨' : wasMentioned ? '✅' : '⬜'}
                                      </span>
                                      <span className={`flex-1 ${isIncluded ? (wasMentioned || aiDiscovered ? 'text-slate-700 font-medium' : 'text-slate-600') : 'text-slate-400 line-through'}`}>
                                        {d}
                                      </span>
                                      {aiDiscovered && isIncluded && (
                                        <span className="ml-auto text-xs font-semibold text-violet-600 bg-violet-50 border border-violet-100 rounded-full px-2 py-0.5 shrink-0">AI-discovered</span>
                                      )}
                                      {!aiDiscovered && wasMentioned && isIncluded && (
                                        <span className="ml-auto text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-full px-2 py-0.5 shrink-0">In source</span>
                                      )}
                                    </label>
                                  ) : (
                                    <>
                                      <span className={aiDiscovered ? 'text-violet-500' : wasMentioned ? 'text-emerald-600' : 'text-slate-300'}>{aiDiscovered ? '✨' : wasMentioned ? '✅' : '⬜'}</span>
                                      <span className={wasMentioned || aiDiscovered ? 'text-slate-700 font-medium flex-1' : 'text-slate-500 flex-1'}>{d}</span>
                                      {aiDiscovered && <span className="ml-auto text-sm font-semibold text-violet-600 bg-violet-50 border border-violet-100 rounded-full px-2 py-0.5">AI-discovered</span>}
                                      {!aiDiscovered && wasMentioned && <span className="ml-auto text-sm font-semibold text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-full px-2 py-0.5">In source</span>}
                                    </>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                          </>
                        )}
                        {isEditing && (
                          <AddDeliverableRow onAdd={(text) => setDraftIntelligence(prev => {
                            const next = { ...prev, disciplines: { ...prev.disciplines } };
                            next.disciplines[disc] = {
                              ...next.disciplines[disc],
                              deliverables: [...next.disciplines[disc].deliverables, text],
                            };
                            return next;
                          })} />
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {!registerBased && <div>
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-sm font-semibold text-slate-600">HSE Studies</h3>
              <span className="text-sm text-slate-400">
                Tick every study that applies to this project — the schedule will only include the ones you leave checked.
              </span>
            </div>
            {(() => {
              const selected = new Set(data.hse_studies || []);
              const catalogue = (data.available_hse_studies && data.available_hse_studies.length)
                ? data.available_hse_studies
                : Array.from(new Set([...(data.hse_studies || [])]));
              // Toggle works whether or not the Edit panel is open: in edit
              // mode we mutate the draft, otherwise we update the live preview
              // directly so the planner's choice is remembered without an
              // Edit/Save round-trip.
              const applyToggle = (prev, name) => {
                const cur = new Set(prev.hse_studies || []);
                if (cur.has(name)) cur.delete(name); else cur.add(name);
                const ordered = (prev.available_hse_studies || catalogue).filter(s => cur.has(s));
                return { ...prev, hse_studies: ordered };
              };
              const toggleHse = (name) => {
                if (isEditing) {
                  setDraftIntelligence(prev => applyToggle(prev, name));
                } else {
                  setIntelligencePreview(prev => applyToggle(prev || {}, name));
                }
              };
              const setAll = (all) => {
                const nextList = all ? [...(data.available_hse_studies || catalogue)] : [];
                if (isEditing) {
                  setDraftIntelligence(prev => ({ ...prev, hse_studies: nextList }));
                } else {
                  setIntelligencePreview(prev => ({ ...(prev || {}), hse_studies: nextList }));
                }
              };
              if (!catalogue.length) {
                return <p className="text-sm text-slate-400 italic">No HSE studies catalogued.</p>;
              }
              return (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {catalogue.map(s => {
                      const isChecked = selected.has(s);
                      return (
                        <label
                          key={s}
                          className={`px-2.5 py-1.5 text-sm font-medium rounded-lg border cursor-pointer transition-colors flex items-center gap-2 ${
                            isChecked
                              ? 'bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100'
                              : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                          }`}
                          title={isChecked ? 'Included in the schedule' : 'Will be skipped'}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleHse(s)}
                            className="accent-violet-600"
                          />
                          <span className="truncate">{s}</span>
                        </label>
                      );
                    })}
                  </div>
                  <div className="mt-2 flex items-center gap-3 text-sm">
                    <button
                      type="button"
                      onClick={() => setAll(true)}
                      className="text-violet-600 hover:text-violet-700 font-medium"
                    >Select all</button>
                    <span className="text-slate-300">·</span>
                    <button
                      type="button"
                      onClick={() => setAll(false)}
                      className="text-slate-500 hover:text-rose-600 font-medium"
                    >Clear all</button>
                    <span className="ml-auto text-sm text-slate-400">
                      {(data.hse_studies || []).length} selected
                    </span>
                  </div>
                </>
              );
            })()}
          </div>}

          {(data.notes || []).map((n, i) => (
            <p key={i} className="text-sm text-amber-700 italic bg-amber-50 rounded-lg px-3 py-2">⚠ {n}</p>
          ))}

        </fieldset>
      )}
    </div>
    );
  };


  const renderEmptyGenerationNotice = (label) => (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-10 text-center">
      <div className="text-4xl mb-3 opacity-60">🗓️</div>
      <p className="text-sm text-slate-400">
        No {label} yet — open the <span className="font-semibold text-slate-600">Generation Wizard</span> from Document Intelligence.
      </p>
    </div>
  );

  const renderWbsStep = () => {
    if (!generation) return renderEmptyGenerationNotice('WBS');
    const isEditing = editingSection === 'wbs';
    const rows = isEditing ? draftWbs : generation.wbs;
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xl">🗂️</span>
          <h2 className="font-semibold text-slate-800">Work Breakdown Structure <span className="text-slate-400 font-normal">(v{generation.version} · {generation.wbs.length} nodes)</span></h2>
          {!isEditing && (
            <button onClick={() => startEdit('wbs')}
              className="ml-auto px-3 py-1.5 text-sm font-semibold rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors inline-flex items-center gap-1.5">
              ✏️ Edit
            </button>
          )}
          {isEditing && (
            <div className="ml-auto flex items-center gap-2">
              <button onClick={cancelEdit} className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors">Cancel</button>
              <button onClick={() => handleSaveGenerationEdit('wbs', draftWbs)} disabled={savingEdit}
                className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-violet-600 text-white hover:bg-violet-700 transition-colors disabled:opacity-40">
                {savingEdit ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          )}
        </div>
        <div className="rounded-xl border border-slate-100 overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 sticky top-0">
              <tr className="text-left text-slate-500">
                <th className="py-2.5 px-3 font-semibold">Code</th>
                <th className="py-2.5 px-3 font-semibold">Name</th>
                {isEditing && <th className="py-2.5 px-3 font-semibold w-24 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((node, i) => (
                <tr key={node.code} className={`border-t border-slate-100 ${i % 2 ? 'bg-slate-50/50' : ''} hover:bg-violet-50/40 transition-colors`}>
                  <td className="py-2 px-3 font-mono text-sm text-violet-600">{node.code}</td>
                  <td className="py-2 px-3 text-slate-700" style={{ paddingLeft: `${12 + node.level * 20}px` }}>
                    {isEditing ? (
                      <input type="text" value={node.name}
                        onChange={e => updateDraftWbsNode(node.code, e.target.value)}
                        className="w-full border border-slate-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-violet-400" />
                    ) : node.name}
                  </td>
                  {isEditing && (
                    <td className="py-2 px-3 text-right whitespace-nowrap">
                      <button onClick={() => addDraftWbsNode(node.code)} title="Add child item"
                        className="px-1.5 py-1 text-slate-400 hover:text-emerald-600 transition-colors">➕</button>
                      <button onClick={() => deleteDraftWbsNode(node.code)} title="Delete item (and its children)"
                        className="px-1.5 py-1 text-slate-400 hover:text-rose-600 transition-colors">🗑️</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {isEditing && (
          <button onClick={() => addDraftWbsNode(null)}
            className="mt-3 px-3 py-1.5 text-sm font-semibold rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors inline-flex items-center gap-1.5">
            ➕ Add Root Item
          </button>
        )}
      </div>
    );
  };

  const renderScheduleStep = () => {
    if (!generation) return documentWorkflow ? <section className="rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-slate-900">Schedule Generator</h2>
      <p className="my-3 text-sm text-slate-600">Build an editable planning package from the saved analysis. Review its workflow assumptions, WBS and logic before approval.</p>
      <button type="button" className="pln-button pln-primary" disabled={!intelligencePreview?.document_intelligence_run_id || analyzing || packageBusy || savingPreview || Boolean(editingSection) || unsavedPreviewEdits || intelligenceOutdated} onClick={() => setShowGenerationWizard(true)}>Open Generation Wizard</button>
      {unsavedPreviewEdits && <p className="text-sm text-amber-800">Save or discard your preview edits before opening the generation wizard.</p>}
    </section> : renderEmptyGenerationNotice('schedule');
    const isEditing = editingSection === 'schedule';
    const rows = isEditing ? draftActivities : generation.activities;
    const hasCalculatedCriticality = generation.activities.some(a => typeof a.is_critical === 'boolean' && a.total_float_days != null);
    const criticalCount = hasCalculatedCriticality ? generation.activities.filter(a => a.is_critical).length : null;
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xl">📅</span>
            <h2 className="font-semibold text-slate-800">Activities <span className="text-slate-400 font-normal">(v{generation.version} · {generation.activities.length} total)</span></h2>
          </div>
          <div className="flex items-center gap-2">
            {!isEditing && <button type="button" className="pln-button" onClick={() => generation.schedule_version_id ? openPlannerWorkspace(selectedProjectId, { scheduleId: generation.schedule_id, versionId: generation.schedule_version_id }) : openPlannerWorkspace(selectedProjectId, { generationId: generation.id })}>Open draft workspace</button>}
            {!isEditing && (
              <button disabled={packageBusy || analyzing || !intelligencePreview?.document_intelligence_run_id || Boolean(editingSection) || unsavedPreviewEdits} onClick={() => setShowGenerationWizard(true)}
                className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-violet-600 text-white hover:bg-violet-700 transition-colors">
                ✦ New generation
              </button>
            )}
            <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-sm font-semibold">{criticalCount === null ? 'Critical path: Not calculated' : `${criticalCount} on critical path`}</span>
            <button
              disabled={!hasCalculatedCriticality}
              onClick={() => {
                setVisualizationSection('schedule');
                setVisualizationTab('timeline');
                setShowVisualization(true);
              }}
              className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 border border-blue-200 hover:from-blue-100 hover:to-indigo-100 transition-all inline-flex items-center gap-1.5"
            >
              📊 Visualize
            </button>
            {!isEditing && (
              <button onClick={() => startEdit('schedule')}
                className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors inline-flex items-center gap-1.5">
                ✏️ Edit
              </button>
            )}
            {isEditing && (
              <>
                <button onClick={cancelEdit} disabled={savingEdit} className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors">Cancel</button>
                <button onClick={() => handleSaveGenerationEdit('activities', draftActivities)} disabled={savingEdit}
                  className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-violet-600 text-white hover:bg-violet-700 transition-colors disabled:opacity-40">
                  {savingEdit ? 'Saving…' : 'Save Changes'}
                </button>
              </>
            )}
          </div>
        </div>
        <div className="rounded-xl border border-slate-100 overflow-hidden overflow-x-auto max-h-[65vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 sticky top-0 z-10">
              <tr className="text-left text-slate-500">
                <th className="py-2.5 px-2.5 font-semibold">ID</th>
                <th className="py-2.5 px-2.5 font-semibold">Name</th>
                <th className="py-2.5 px-2.5 font-semibold">Discipline</th>
                <th className="py-2.5 px-2.5 font-semibold">Dur.</th>
                <th className="py-2.5 px-2.5 font-semibold">Start</th>
                <th className="py-2.5 px-2.5 font-semibold">Finish</th>
                <th className="py-2.5 px-2.5 font-semibold">Float</th>
                <th className="py-2.5 px-2.5 font-semibold">Critical</th>
                {isEditing && <th className="py-2.5 px-2.5 font-semibold text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((a, i) => (
                <tr key={a.id} className={`border-t border-slate-100 transition-colors ${a.is_critical ? 'bg-rose-50/50 hover:bg-rose-50' : i % 2 ? 'bg-slate-50/50 hover:bg-violet-50/30' : 'hover:bg-violet-50/30'}`}>
                  <td className="py-1.5 px-2.5 font-mono text-violet-600">{a.id}</td>
                  <td className="py-1.5 px-2.5 text-slate-700">
                    {isEditing ? (
                      <input type="text" aria-label={`Activity ${a.id} name`} value={a.name} disabled={savingEdit}
                        onChange={e => updateDraftActivity(a.id, 'name', e.target.value)}
                        className="w-full border border-slate-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-violet-400" />
                    ) : (<>{a.name}{a.is_milestone ? ' 🔷' : ''}</>)}
                  </td>
                  <td className="py-1.5 px-2.5 capitalize text-slate-500">{a.discipline}</td>
                  <td className="py-1.5 px-2.5">
                    {isEditing ? (
                      <input type="number" aria-label={`Activity ${a.id} duration`} min="0" value={a.original_duration_days ?? ''} disabled={savingEdit}
                        onChange={e => updateDraftActivity(a.id, 'original_duration_days', e.target.value === '' ? null : Number(e.target.value))}
                        className="w-16 border border-slate-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-violet-400" />
                    ) : a.original_duration_days == null ? 'Not Specified' : `${a.original_duration_days}d`}
                  </td>
                  <td className="py-1.5 px-2.5">
                    {isEditing ? (
                      <input type="date" aria-label={`Activity ${a.id} start`} value={a.start_date || ''} disabled={savingEdit}
                        onChange={e => updateDraftActivity(a.id, 'start_date', e.target.value)}
                        className="border border-slate-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-violet-400" />
                    ) : a.start_date || 'Not Specified'}
                  </td>
                  <td className="py-1.5 px-2.5">
                    {isEditing ? (
                      <input type="date" aria-label={`Activity ${a.id} finish`} value={a.finish_date || ''} disabled={savingEdit}
                        onChange={e => updateDraftActivity(a.id, 'finish_date', e.target.value)}
                        className="border border-slate-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-violet-400" />
                    ) : a.finish_date || 'Not Specified'}
                  </td>
                  <td className="py-1.5 px-2.5">{a.total_float_days == null ? 'Not calculated' : `${a.total_float_days}d`}</td>
                  <td className="py-1.5 px-2.5">{a.is_critical == null || a.total_float_days == null ? 'Not calculated' : a.is_critical ? 'CRITICAL' : 'No'}</td>
                  {isEditing && (
                    <td className="py-1.5 px-2.5 text-right whitespace-nowrap">
                      <button onClick={() => deleteDraftActivity(a.id)} title="Delete activity" disabled={savingEdit}
                        className="px-1.5 py-1 text-slate-400 hover:text-rose-600 transition-colors">🗑️</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {isEditing && (
          <button onClick={addDraftActivity} disabled={savingEdit}
            className="mt-3 px-3 py-1.5 text-sm font-semibold rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors inline-flex items-center gap-1.5">
            ➕ Add Activity
          </button>
        )}
      </div>
    );
  };

  const renderEddrStep = () => {
    if (!generation) return renderEmptyGenerationNotice('EDDR');
    const isEditing = editingSection === 'eddr';
    const rows = isEditing ? draftEddr : generation.eddr;
    const eddrDateFields = ['ifr_issue_date', 'company_review_date', 'ifa_issue_date', 'company_approval_date', 'final_issue_date'];
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xl">📋</span>
          <h2 className="font-semibold text-slate-800">Engineering Document Deliverable Register <span className="text-slate-400 font-normal">({generation.eddr.length} deliverables)</span></h2>
          {!isEditing && (
            <>
              <button
                onClick={() => {
                  setVisualizationSection('eddr');
                  setVisualizationTab('status');
                  setShowVisualization(true);
                }}
                className="ml-auto px-3 py-1.5 text-sm font-semibold rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 border border-blue-200 hover:from-blue-100 hover:to-indigo-100 transition-all inline-flex items-center gap-1.5"
              >
                📊 Visualize
              </button>
              <button onClick={() => startEdit('eddr')}
                className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors inline-flex items-center gap-1.5">
                ✏️ Edit
              </button>
            </>
          )}
          {isEditing && (
            <div className="ml-auto flex items-center gap-2">
              <button onClick={cancelEdit} className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors">Cancel</button>
              <button onClick={() => handleSaveGenerationEdit('eddr', draftEddr)} disabled={savingEdit}
                className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-violet-600 text-white hover:bg-violet-700 transition-colors disabled:opacity-40">
                {savingEdit ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          )}
        </div>
        <div className="rounded-xl border border-slate-100 overflow-hidden overflow-x-auto max-h-[65vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 sticky top-0 z-10">
              <tr className="text-left text-slate-500">
                <th className="py-2.5 px-2.5 font-semibold">Discipline</th>
                <th className="py-2.5 px-2.5 font-semibold">Deliverable</th>
                <th className="py-2.5 px-2.5 font-semibold">IFR</th>
                <th className="py-2.5 px-2.5 font-semibold">Company Review</th>
                <th className="py-2.5 px-2.5 font-semibold">IFA</th>
                <th className="py-2.5 px-2.5 font-semibold">Approval</th>
                <th className="py-2.5 px-2.5 font-semibold">Final Issue</th>
                {isEditing && <th className="py-2.5 px-2.5 font-semibold text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className={`border-t border-slate-100 hover:bg-violet-50/30 transition-colors ${i % 2 ? 'bg-slate-50/50' : ''}`}>
                  <td className="py-1.5 px-2.5 capitalize text-slate-500">{row.discipline}</td>
                  <td className="py-1.5 px-2.5 text-slate-700 font-medium">
                    {isEditing ? (
                      <input type="text" value={row.deliverable_name}
                        onChange={e => updateDraftEddrRow(i, 'deliverable_name', e.target.value)}
                        className="w-full border border-slate-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-violet-400" />
                    ) : row.deliverable_name}
                  </td>
                  {eddrDateFields.map(field => (
                    <td key={field} className={`py-1.5 px-2.5 ${field === 'final_issue_date' && !isEditing ? 'font-medium text-emerald-600' : ''}`}>
                      {isEditing ? (
                        <input type="date" value={row[field] || ''}
                          onChange={e => updateDraftEddrRow(i, field, e.target.value)}
                          className="border border-slate-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-violet-400" />
                      ) : row[field]}
                    </td>
                  ))}
                  {isEditing && (
                    <td className="py-1.5 px-2.5 text-right whitespace-nowrap">
                      <button onClick={() => deleteDraftEddrRow(i)} title="Delete deliverable"
                        className="px-1.5 py-1 text-slate-400 hover:text-rose-600 transition-colors">🗑️</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {isEditing && (
          <button onClick={addDraftEddrRow}
            className="mt-3 px-3 py-1.5 text-sm font-semibold rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors inline-flex items-center gap-1.5">
            ➕ Add Deliverable
          </button>
        )}
      </div>
    );
  };

  const renderManhoursStep = () => {
    if (!generation) return renderEmptyGenerationNotice('manhour estimate');
    const isEditing = editingSection === 'manhours';
    const m = isEditing ? draftManhours : generation.manhours;
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-xl">⏱️</span>
          <h2 className="font-semibold text-slate-800">Manhour Estimate</h2>
          {!isEditing && (
            <button onClick={() => startEdit('manhours')}
              className="ml-auto px-3 py-1.5 text-sm font-semibold rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors inline-flex items-center gap-1.5">
              ✏️ Edit
            </button>
          )}
          {isEditing && (
            <div className="ml-auto flex items-center gap-2">
              <button onClick={cancelEdit} className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors">Cancel</button>
              <button onClick={() => handleSaveGenerationEdit('manhours', draftManhours)} disabled={savingEdit}
                className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-violet-600 text-white hover:bg-violet-700 transition-colors disabled:opacity-40">
                {savingEdit ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          )}
        </div>
        <p className="text-sm text-slate-600 bg-slate-50 rounded-lg px-3 py-2">
          Basis: {m.basis?.hours_per_day} hrs/day, {m.basis?.man_days_per_month} man-days/month. {m.basis?.assumption}
        </p>
        <div className="rounded-xl border border-slate-100 overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left text-slate-500">
                <th className="py-2.5 px-3 font-semibold">Discipline</th>
                <th className="py-2.5 px-3 font-semibold">Role</th>
                <th className="py-2.5 px-3 font-semibold">Man-Days</th>
                <th className="py-2.5 px-3 font-semibold">Man-Hours</th>
                <th className="py-2.5 px-3 font-semibold">Man-Months</th>
                {isEditing && <th className="py-2.5 px-3 font-semibold text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {(m.by_discipline || []).map((row, i) => (
                <tr key={row.discipline} className={`border-t border-slate-100 hover:bg-cyan-50/30 transition-colors ${i % 2 ? 'bg-slate-50/50' : ''}`}>
                  <td className="py-2 px-3 font-medium text-slate-700">{row.discipline_name}</td>
                  <td className="py-2 px-3 text-slate-500">{row.responsible_role}</td>
                  <td className="py-2 px-3">
                    {isEditing ? (
                      <input type="number" min="0" value={row.man_days}
                        onChange={e => updateDraftManhourRow(row.discipline, e.target.value)}
                        className="w-24 border border-slate-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-violet-400" />
                    ) : row.man_days}
                  </td>
                  <td className="py-2 px-3">{row.man_hours}</td>
                  <td className="py-2 px-3">{row.man_months}</td>
                  {isEditing && (
                    <td className="py-2 px-3 text-right whitespace-nowrap">
                      <button onClick={() => deleteDraftManhourRow(row.discipline)} title="Delete discipline row"
                        className="px-1.5 py-1 text-slate-400 hover:text-rose-600 transition-colors">🗑️</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {isEditing && (() => {
          const available = Object.entries(PLANNING_DISCIPLINE_META).filter(
            ([code]) => !(m.by_discipline || []).some(r => r.discipline === code)
          );
          if (!available.length) return null;
          return (
            <select
              value=""
              onChange={e => addDraftManhourRow(e.target.value)}
              className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors cursor-pointer"
            >
              <option value="" disabled>➕ Add Discipline…</option>
              {available.map(([code, meta]) => (
                <option key={code} value={code}>{meta.label}</option>
              ))}
            </select>
          );
        })()}
        <div className="flex items-center justify-between rounded-xl bg-gradient-to-r from-cyan-50 to-sky-50 border border-cyan-100 px-4 py-3">
          <span className="text-sm font-semibold text-slate-700">Grand Total</span>
          <span className="text-lg font-bold text-cyan-700">{m.grand_total_man_hours} man-hours</span>
        </div>
      </div>
    );
  };

  const renderValidationStep = () => {
    if (!generation) return renderEmptyGenerationNotice('validation report');
    const counts = generation.validation.reduce((acc, i) => ({ ...acc, [i.severity]: (acc[i.severity] || 0) + 1 }), {});
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xl">✅</span>
            <h2 className="font-semibold text-slate-800">Validation Report</h2>
          </div>
          <div className="flex gap-2">
            {Object.entries(VALIDATION_SEVERITY_STYLES).map(([key, s]) => (
              <span key={key} className={`px-2.5 py-1 rounded-full text-sm font-semibold border ${s.className}`}>{s.label}: {counts[key] || 0}</span>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          {generation.validation.map((issue, i) => {
            const style = VALIDATION_SEVERITY_STYLES[issue.severity] || VALIDATION_SEVERITY_STYLES.pass;
            return (
              <div key={i} className={`border rounded-xl px-4 py-2.5 text-sm flex items-start gap-2 ${style.className}`}>
                <span className="font-semibold shrink-0">{style.label}</span>
                <span className="text-slate-600">{issue.message}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderNarrativeStep = () => {
    if (!generation) return renderEmptyGenerationNotice('narrative');
    const aiAugmented = generation.intelligence?.ai_augmented;
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="h-5 w-5 text-violet-600" aria-hidden="true" />
          <h2 className="font-semibold text-slate-800">Schedule Narrative</h2>
          <span className={`ml-auto inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-semibold ${aiAugmented ? 'bg-violet-50 text-violet-700 border border-violet-200' : 'bg-slate-50 text-slate-500 border border-slate-200'}`}>
            {aiAugmented
              ? <><Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> Executive Summary refined by AI</>
              : <><Calculator className="h-3.5 w-3.5" aria-hidden="true" /> Deterministic narrative</>}
          </span>
        </div>
        <div className="rounded-xl bg-slate-50/70 border border-slate-100 p-5">
          <div>{renderScheduleNarrative(generation.narrative)}</div>
        </div>
      </div>
    );
  };

  const renderPresentationStep = () => {
    if (!generation) return renderEmptyGenerationNotice('presentation');
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5 sm:p-6 space-y-5">
        <div className="flex items-center gap-2">
          <span className="text-xl">📊</span>
          <h2 className="font-semibold text-slate-800">PowerPoint Presentation <span className="text-slate-400 font-normal">(v{generation.version})</span></h2>
        </div>
        <p className="text-sm text-slate-500">
          Generate a client/internal-review-ready PowerPoint deck summarizing this schedule
          generation — project overview, WBS, schedule &amp; milestones, EDDR, manhours,
          validation results and the executive summary narrative.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {PRESENTATION_SLIDE_OUTLINE.map((slide, i) => (
            <div key={slide.title} className="flex items-center gap-2.5 border border-slate-200 rounded-xl px-3 py-2.5 text-sm hover:border-rose-200 hover:shadow-sm transition-all">
              <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-slate-100 text-slate-500 text-xs font-semibold shrink-0">{i + 1}</span>
              <span className="text-base shrink-0">{slide.icon}</span>
              <span className="text-slate-700 font-medium">{slide.title}</span>
            </div>
          ))}
        </div>

        <button
          onClick={handleDownloadPresentation}
          disabled={downloadingPresentation}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-orange-500 text-white text-sm font-semibold shadow-sm hover:shadow-md hover:from-rose-600 hover:to-orange-600 transition-all disabled:opacity-40 disabled:shadow-none"
        >
          <span>📊</span>
          {downloadingPresentation ? 'Building Presentation…' : 'Download PowerPoint Presentation'}
        </button>
      </div>
    );
  };

  const renderExportStep = () => {
    if (!generation) return renderEmptyGenerationNotice('generation to export');
    const stats = [
      { icon: '🗂️', label: 'WBS Nodes', value: generation.wbs.length },
      { icon: '📅', label: 'Activities', value: generation.activities.length },
      { icon: '📋', label: 'Deliverables', value: generation.eddr.length },
      { icon: '⏱️', label: 'Man-Hours', value: generation.manhours?.grand_total_man_hours ?? '—' },
    ];
    const grouped = EXPORT_CATEGORY_ORDER
      .map(category => ({ category, formats: EXPORT_FORMATS.filter(f => f.category === category) }))
      .filter(g => g.formats.length);
    return (
      <div className="space-y-5">
        {/* Hero header */}
        <div className="relative overflow-hidden rounded-2xl shadow-sm border border-slate-200/80 bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 p-6 sm:p-8 text-white">
          <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-violet-500/20 blur-3xl" />
          <div className="absolute -bottom-16 -left-10 w-56 h-56 rounded-full bg-sky-500/10 blur-3xl" />
          <div className="relative">
            <div className="flex items-center gap-2 text-slate-300 text-sm font-semibold uppercase tracking-wide">
              <span className="text-lg">⬇️</span> Export Center
            </div>
            <h2 className="mt-1.5 text-xl sm:text-2xl font-bold">
              Take your schedule anywhere <span className="text-violet-300">·</span> v{generation.version}
            </h2>
            <p className="mt-2 text-sm text-slate-300 max-w-2xl">
              Every generation is available in the format your team already works in —
              hand it to Primavera P6, drop it in Excel, or ship the raw JSON to another system.
            </p>
            <div className="mt-5 flex flex-wrap gap-2.5">
              {stats.map(s => (
                <div key={s.label} className="flex items-center gap-2 rounded-xl bg-white/10 backdrop-blur-sm border border-white/10 px-3.5 py-2">
                  <span className="text-base">{s.icon}</span>
                  <span className="font-bold">{s.value}</span>
                  <span className="text-slate-300 text-sm">{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Format cards, grouped by category */}
        {grouped.map(({ category, formats }) => (
          <div key={category}>
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2.5 flex items-center gap-2">
              {category}
              <span className="h-px flex-1 bg-slate-200" />
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5">
              {formats.map(f => {
                const isBusy = exportingFormat === f.format;
                const isDone = exportedFormat === f.format;
                const accent = f.accent || 'from-slate-700 to-slate-900';
                return (
                  <button
                    key={f.format}
                    onClick={() => handleExport(f.format)}
                    disabled={isBusy}
                    className="group relative overflow-hidden text-left rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm hover:shadow-lg hover:-translate-y-0.5 hover:border-transparent transition-all duration-200 disabled:opacity-70 disabled:translate-y-0 disabled:shadow-sm"
                  >
                    <div className={`absolute inset-0 opacity-0 group-hover:opacity-[0.06] bg-gradient-to-br ${accent} transition-opacity duration-200`} />
                    {f.badge && (
                      <span className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 text-xs font-bold uppercase tracking-wide">
                        {f.badge}
                      </span>
                    )}
                    <div className="relative flex items-start gap-3">
                      <span className={`shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br ${accent} flex items-center justify-center text-xl shadow-sm group-hover:scale-105 transition-transform`}>
                        {f.icon}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-slate-800 truncate">{f.label}</div>
                        <p className="text-sm text-slate-500 mt-0.5 leading-snug">{f.description}</p>
                      </div>
                    </div>
                    <div className="relative mt-3.5 flex items-center justify-end">
                      {isDone ? (
                        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-600">✅ Downloaded</span>
                      ) : isBusy ? (
                        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-400">
                          <span className="w-3.5 h-3.5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" /> Preparing…
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 group-hover:text-violet-600 transition-colors">
                          Download <span className="group-hover:translate-y-0.5 transition-transform">⬇️</span>
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-4 flex items-center gap-3">
          <span className="text-xl">📊</span>
          <p className="text-sm text-slate-500">
            Need a client-ready deck instead? Head to the <span className="font-semibold text-slate-700">PowerPoint Presentation</span> step
            to download a polished, on-brand summary of this generation.
          </p>
        </div>
      </div>
    );
  };

  const renderVisualizationModal = () => {
    if (!showVisualization) return null;

    // Prepare data based on section
    let chartData = {};
    
    if (visualizationSection === 'intelligence' && intelligencePreview) {
      // Discipline distribution
      const disciplineData = Object.entries(intelligencePreview.disciplines || {})
        .map(([key, disc]) => ({
          name: PLANNING_DISCIPLINE_META[key]?.label || key,
          count: (disc.deliverables || []).length,
          icon: PLANNING_DISCIPLINE_META[key]?.icon || '📋',
          color: PLANNING_DISCIPLINE_META[key]?.color || '#94a3b8'
        }))
        .filter(d => d.count > 0);
      
      chartData.disciplines = disciplineData;
      chartData.totalDeliverables = disciplineData.reduce((sum, d) => sum + d.count, 0);
    }

    if (visualizationSection === 'schedule' && generation?.activities) {
      const activities = generation.activities;
      
      // Timeline data - group by discipline
      const timelineData = {};
      activities.forEach(act => {
        const disc = act.discipline || 'other';
        if (!timelineData[disc]) {
          timelineData[disc] = [];
        }
        timelineData[disc].push({
          id: act.id,
          name: act.name,
          start: new Date(act.start_date).getTime(),
          finish: new Date(act.finish_date).getTime(),
          duration: act.original_duration_days || 0,
          isCritical: act.is_critical,
          float: act.total_float_days || 0
        });
      });

      // Discipline distribution for schedule
      const disciplineStats = Object.entries(timelineData).map(([disc, acts]) => {
        const meta = PLANNING_DISCIPLINE_META[disc] || DEFAULT_DISCIPLINE_META;
        const criticalCount = acts.filter(a => a.isCritical).length;
        return {
          name: meta.label || disc,
          total: acts.length,
          critical: criticalCount,
          icon: meta.icon,
          color: meta.chartColor
        };
      });

      // Activity duration distribution
      const durationBuckets = [
        { range: '1-5 days', min: 1, max: 5, count: 0 },
        { range: '6-10 days', min: 6, max: 10, count: 0 },
        { range: '11-20 days', min: 11, max: 20, count: 0 },
        { range: '21-30 days', min: 21, max: 30, count: 0 },
        { range: '30+ days', min: 31, max: 999, count: 0 }
      ];

      activities.forEach(act => {
        const dur = act.original_duration_days || 0;
        const bucket = durationBuckets.find(b => dur >= b.min && dur <= b.max);
        if (bucket) bucket.count++;
      });

      // Timeline scatter data (for Gantt-style view)
      const timelineScatter = activities.map(act => {
        const meta = PLANNING_DISCIPLINE_META[act.discipline] || DEFAULT_DISCIPLINE_META;
        return {
          name: act.name.substring(0, 30) + (act.name.length > 30 ? '...' : ''),
          start: new Date(act.start_date).getTime(),
          duration: act.original_duration_days || 0,
          discipline: meta.label,
          isCritical: act.is_critical,
          color: act.is_critical ? '#dc2626' : meta.chartColor
        };
      }).slice(0, 50); // Limit to 50 activities for performance
      
      chartData.disciplineStats = disciplineStats;
      chartData.durationBuckets = durationBuckets.filter(b => b.count > 0);
      chartData.timelineScatter = timelineScatter;
      chartData.totalActivities = activities.length;
      chartData.criticalActivities = activities.filter(a => a.is_critical).length;
      chartData.projectStart = activities.length > 0 ? Math.min(...activities.map(a => new Date(a.start_date).getTime())) : 0;
      chartData.projectFinish = activities.length > 0 ? Math.max(...activities.map(a => new Date(a.finish_date).getTime())) : 0;
    }

    if (visualizationSection === 'eddr' && generation?.eddr) {
      const eddrData = generation.eddr;
      
      // Determine document status based on which dates are filled
      const getDocumentStatus = (doc) => {
        if (doc.final_issue_date) return 'Final Issue';
        if (doc.company_approval_date) return 'Approved';
        if (doc.ifa_issue_date) return 'IFA Issued';
        if (doc.company_review_date) return 'Under Review';
        if (doc.ifr_issue_date) return 'IFR Issued';
        return 'Not Started';
      };
      
      // Status board data (Primavera-style workflow stages)
      const statusCategories = [
        { name: 'Not Started', color: '#cbd5e1', icon: '⚪', key: 'not_started' },
        { name: 'IFR Issued', color: '#3b82f6', icon: '🔵', key: 'ifr' },
        { name: 'Under Review', color: '#f59e0b', icon: '🟡', key: 'review' },
        { name: 'IFA Issued', color: '#8b5cf6', icon: '🟣', key: 'ifa' },
        { name: 'Approved', color: '#10b981', icon: '🟢', key: 'approved' },
        { name: 'Final Issue', color: '#059669', icon: '✅', key: 'final' }
      ];
      
      const statusBoard = statusCategories.map(status => {
        const docs = eddrData.filter(doc => getDocumentStatus(doc) === status.name);
        return {
          ...status,
          count: docs.length,
          documents: docs.slice(0, 10) // First 10 for display
        };
      });
      
      // Discipline breakdown
      const disciplineBreakdown = {};
      eddrData.forEach(doc => {
        const disc = doc.discipline || 'other';
        if (!disciplineBreakdown[disc]) {
          const meta = PLANNING_DISCIPLINE_META[disc] || DEFAULT_DISCIPLINE_META;
          disciplineBreakdown[disc] = {
            name: meta.label || disc,
            icon: meta.icon,
            color: meta.chartColor,
            total: 0,
            notStarted: 0,
            inProgress: 0,
            completed: 0
          };
        }
        disciplineBreakdown[disc].total++;
        const status = getDocumentStatus(doc);
        if (status === 'Not Started') disciplineBreakdown[disc].notStarted++;
        else if (status === 'Final Issue') disciplineBreakdown[disc].completed++;
        else disciplineBreakdown[disc].inProgress++;
      });
      
      const disciplineData = Object.values(disciplineBreakdown);
      
      // Timeline data (workflow progression)
      const timelineData = eddrData
        .filter(doc => doc.ifr_issue_date) // Only docs that have started
        .map(doc => {
          const meta = PLANNING_DISCIPLINE_META[doc.discipline] || DEFAULT_DISCIPLINE_META;
          const status = getDocumentStatus(doc);
          const startDate = doc.ifr_issue_date ? new Date(doc.ifr_issue_date).getTime() : Date.now();
          const endDate = doc.final_issue_date 
            ? new Date(doc.final_issue_date).getTime() 
            : (doc.company_approval_date ? new Date(doc.company_approval_date).getTime() : startDate);
          
          return {
            name: doc.deliverable_name.substring(0, 35) + (doc.deliverable_name.length > 35 ? '...' : ''),
            discipline: meta.label,
            start: startDate,
            end: endDate,
            duration: Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)),
            status: status,
            color: meta.chartColor,
            icon: meta.icon
          };
        })
        .sort((a, b) => a.start - b.start)
        .slice(0, 50); // Limit for performance
      
      // Progress statistics
      const totalDocs = eddrData.length;
      const completedDocs = eddrData.filter(doc => doc.final_issue_date).length;
      const inProgressDocs = eddrData.filter(doc => doc.ifr_issue_date && !doc.final_issue_date).length;
      const notStartedDocs = eddrData.filter(doc => !doc.ifr_issue_date).length;
      const completionPercentage = totalDocs > 0 ? Math.round((completedDocs / totalDocs) * 100) : 0;
      
      // Status progression chart data
      const progressionData = statusCategories.map(status => ({
        name: status.name,
        count: statusBoard.find(s => s.name === status.name)?.count || 0,
        color: status.color
      })).filter(s => s.count > 0);
      
      chartData.statusBoard = statusBoard;
      chartData.disciplineData = disciplineData;
      chartData.timelineData = timelineData;
      chartData.totalDocs = totalDocs;
      chartData.completedDocs = completedDocs;
      chartData.inProgressDocs = inProgressDocs;
      chartData.notStartedDocs = notStartedDocs;
      chartData.completionPercentage = completionPercentage;
      chartData.progressionData = progressionData;
      chartData.earliestStart = timelineData.length > 0 ? Math.min(...timelineData.map(d => d.start)) : 0;
      chartData.latestEnd = timelineData.length > 0 ? Math.max(...timelineData.map(d => d.end)) : 0;
    }

    const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6', '#6366f1'];

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowVisualization(false)}>
        <div ref={visualizationDialogRef} tabIndex="-1" role="dialog" aria-modal="true" aria-labelledby="planning-visualization-title" className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-slate-200 bg-gradient-to-r from-violet-50 to-indigo-50">
            <div className="flex items-center gap-3">
              <span className="text-2xl">📊</span>
              <div>
                <h2 id="planning-visualization-title" className="text-xl font-bold text-slate-800">Data Visualization</h2>
                <p className="text-sm text-slate-500">
                  {visualizationSection === 'intelligence' && 'Document Intelligence Insights'}
                  {visualizationSection === 'schedule' && 'Schedule Analysis & Timeline'}
                  {visualizationSection === 'eddr' && 'EDDR - Engineering Document Deliverable Register'}
                </p>
              </div>
            </div>
            <button type="button" aria-label="Close data visualization" onClick={() => setShowVisualization(false)} className="min-h-11 min-w-11 p-2 rounded-lg hover:bg-white/80 transition-colors">
              <span className="text-2xl text-slate-400 hover:text-slate-600">×</span>
            </button>
          </div>

          {/* Tabs */}
          {visualizationSection === 'schedule' && (
            <div className="flex gap-2 px-6 pt-4 border-b border-slate-100">
              {[
                { id: 'timeline', label: '📅 Timeline', icon: '📅' },
                { id: 'disciplines', label: '🎨 Disciplines', icon: '🎨' },
                { id: 'statistics', label: '📈 Statistics', icon: '📈' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setVisualizationTab(tab.id)}
                  className={`px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors ${
                    visualizationTab === tab.id
                      ? 'bg-white text-violet-600 border-b-2 border-violet-600'
                      : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}
          
          {visualizationSection === 'eddr' && (
            <div className="flex gap-2 px-6 pt-4 border-b border-slate-100">
              {[
                { id: 'status', label: '📋 Status Board', icon: '📋' },
                { id: 'workflow', label: '⏱️ Workflow Timeline', icon: '⏱️' },
                { id: 'breakdown', label: '🎨 Discipline Breakdown', icon: '🎨' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setVisualizationTab(tab.id)}
                  className={`px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors ${
                    visualizationTab === tab.id
                      ? 'bg-white text-violet-600 border-b-2 border-violet-600'
                      : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {visualizationSection === 'intelligence' && chartData.disciplines && (
              <div className="space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-gradient-to-br from-violet-50 to-violet-100 rounded-xl p-4 border border-violet-200">
                    <div className="text-sm font-semibold text-violet-600 uppercase tracking-wide">Total Disciplines</div>
                    <div className="text-3xl font-bold text-violet-900 mt-1">{chartData.disciplines.length}</div>
                  </div>
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200">
                    <div className="text-sm font-semibold text-blue-600 uppercase tracking-wide">Total Deliverables</div>
                    <div className="text-3xl font-bold text-blue-900 mt-1">{chartData.totalDeliverables}</div>
                  </div>
                  <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl p-4 border border-emerald-200">
                    <div className="text-sm font-semibold text-emerald-600 uppercase tracking-wide">Avg per Discipline</div>
                    <div className="text-3xl font-bold text-emerald-900 mt-1">
                      {Math.round(chartData.totalDeliverables / chartData.disciplines.length)}
                    </div>
                  </div>
                </div>

                {/* Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Pie Chart */}
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                    <h3 className="font-semibold text-slate-700 mb-4">Deliverables by Discipline</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={chartData.disciplines}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={entry => `${entry.icon} ${entry.count}`}
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="count"
                        >
                          {chartData.disciplines.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Bar Chart */}
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                    <h3 className="font-semibold text-slate-700 mb-4">Deliverable Count</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={chartData.disciplines}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="count" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}

            {visualizationSection === 'schedule' && visualizationTab === 'timeline' && chartData.timelineScatter && chartData.timelineScatter.length > 0 && (
              <div className="space-y-6">
                <div className="bg-gradient-to-br from-slate-50 to-white rounded-xl p-4 border border-slate-200">
                  <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
                    <h3 className="font-semibold text-slate-700">Project Timeline (First 50 Activities)</h3>
                    {/* Manual legend — Scatter cells are colored per-point (by discipline, or red
                        if critical), so a standard Recharts <Legend/> can't reflect that; this key
                        keeps color from being the only signal (accessibility: color-not-only). */}
                    <div className="flex items-center gap-3 flex-wrap text-xs text-slate-500">
                      {[...new Map(chartData.timelineScatter.map(a => [a.discipline, a])).values()]
                        .filter(a => !a.isCritical)
                        .map(a => (
                          <span key={a.discipline} className="inline-flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: a.color }} />
                            {a.discipline}
                          </span>
                        ))}
                      <span className="inline-flex items-center gap-1.5 font-medium text-rose-600">
                        <span className="w-2.5 h-2.5 rounded-full inline-block bg-rose-600" />
                        🔴 Critical path
                      </span>
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height={400}>
                    <ScatterChart margin={{ top: 20, right: 20, bottom: 30, left: 30 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis
                        type="number"
                        dataKey="start"
                        name="Start Date"
                        domain={[chartData.projectStart, chartData.projectFinish]}
                        tickFormatter={(tick) => new Date(tick).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        tick={{ fontSize: 12, fill: '#64748b' }}
                        label={{ value: 'Start Date', position: 'insideBottom', offset: -10, style: { fontSize: 12, fill: '#64748b' } }}
                      />
                      <YAxis
                        type="number"
                        dataKey="duration"
                        name="Duration (days)"
                        tick={{ fontSize: 12, fill: '#64748b' }}
                        label={{ value: 'Duration (days)', angle: -90, position: 'insideLeft', style: { fontSize: 12, fill: '#64748b', textAnchor: 'middle' } }}
                      />
                      <ZAxis type="number" dataKey="duration" range={[50, 400]} />
                      <Tooltip
                        cursor={{ strokeDasharray: '3 3' }}
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-white p-3 rounded-lg shadow-lg border border-slate-200">
                                <p className="font-semibold text-slate-800">{data.name}</p>
                                <p className="text-sm text-slate-600">Discipline: {data.discipline}</p>
                                <p className="text-sm text-slate-600">Duration: {data.duration} days</p>
                                <p className="text-sm text-slate-600">
                                  Start: {new Date(data.start).toLocaleDateString()}
                                </p>
                                {data.isCritical && <p className="text-sm font-semibold text-rose-600">🔴 Critical Path</p>}
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Scatter name="Activities" data={chartData.timelineScatter} fill="#8b5cf6">
                        {chartData.timelineScatter.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Scatter>
                    </ScatterChart>
                  </ResponsiveContainer>
                  <p className="text-xs text-slate-500 mt-2 text-center">
                    Showing {Math.min(50, chartData.totalActivities)} of {chartData.totalActivities} total activities
                  </p>
                </div>
              </div>
            )}

            {visualizationSection === 'schedule' && visualizationTab === 'timeline' && (!chartData.timelineScatter || chartData.timelineScatter.length === 0) && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <span className="text-4xl mb-3">📅</span>
                <p className="text-sm font-semibold text-slate-600">No schedule activities yet</p>
                <p className="text-sm text-slate-400 mt-1">Generate a schedule from the Document Intelligence step to see the timeline here.</p>
              </div>
            )}

            {visualizationSection === 'schedule' && visualizationTab === 'disciplines' && chartData.disciplineStats && chartData.disciplineStats.length > 0 && (
              <div className="space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-gradient-to-br from-violet-50 to-violet-100 rounded-xl p-4 border border-violet-200">
                    <div className="text-sm font-semibold text-violet-600 uppercase tracking-wide">Total Activities</div>
                    <div className="text-3xl font-bold text-violet-900 mt-1">{chartData.totalActivities}</div>
                  </div>
                  <div className="bg-gradient-to-br from-rose-50 to-rose-100 rounded-xl p-4 border border-rose-200">
                    <div className="text-sm font-semibold text-rose-600 uppercase tracking-wide">Critical Path</div>
                    <div className="text-3xl font-bold text-rose-900 mt-1">{chartData.criticalActivities}</div>
                  </div>
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200">
                    <div className="text-sm font-semibold text-blue-600 uppercase tracking-wide">Active Disciplines</div>
                    <div className="text-3xl font-bold text-blue-900 mt-1">{chartData.disciplineStats.length}</div>
                  </div>
                </div>

                {/* Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Discipline Distribution */}
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                    <h3 className="font-semibold text-slate-700 mb-4">Activities by Discipline</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={chartData.disciplineStats}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} tick={{ fontSize: 12, fill: '#64748b' }} />
                        <YAxis tick={{ fontSize: 12, fill: '#64748b' }} />
                        <Tooltip />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Bar dataKey="total" fill="#8b5cf6" name="Total Activities" radius={[8, 8, 0, 0]} />
                        <Bar dataKey="critical" fill="#dc2626" name="Critical" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Discipline Breakdown */}
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                    <h3 className="font-semibold text-slate-700 mb-4">Discipline Breakdown</h3>
                    <div className="space-y-3 max-h-[300px] overflow-y-auto">
                      {chartData.disciplineStats.map((disc, idx) => (
                        <div key={idx} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-slate-100">
                          <span className="text-2xl">{disc.icon}</span>
                          <div className="flex-1">
                            <div className="font-semibold text-slate-700">{disc.name}</div>
                            <div className="text-sm text-slate-500">
                              {disc.total} activities · {disc.critical} critical
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold text-violet-600">{disc.total}</div>
                            <div className="text-xs text-rose-600">{disc.critical} 🔴</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {visualizationSection === 'schedule' && visualizationTab === 'disciplines' && (!chartData.disciplineStats || chartData.disciplineStats.length === 0) && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <span className="text-4xl mb-3">🎨</span>
                <p className="text-sm font-semibold text-slate-600">No discipline data yet</p>
                <p className="text-sm text-slate-400 mt-1">Generate a schedule from the Document Intelligence step to see this breakdown.</p>
              </div>
            )}

            {visualizationSection === 'schedule' && visualizationTab === 'statistics' && chartData.durationBuckets && chartData.durationBuckets.length > 0 && (
              <div className="space-y-6">
                {/* Duration Distribution */}
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                  <h3 className="font-semibold text-slate-700 mb-4">Activity Duration Distribution</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={chartData.durationBuckets}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="range" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="count" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Project Timeline Info */}
                {chartData.projectStart && chartData.projectFinish && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl p-4 border border-emerald-200">
                      <div className="text-sm font-semibold text-emerald-600 uppercase tracking-wide">Project Start</div>
                      <div className="text-2xl font-bold text-emerald-900 mt-1">
                        {new Date(chartData.projectStart).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </div>
                    </div>
                    <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl p-4 border border-amber-200">
                      <div className="text-sm font-semibold text-amber-600 uppercase tracking-wide">Project Finish</div>
                      <div className="text-2xl font-bold text-amber-900 mt-1">
                        {new Date(chartData.projectFinish).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {visualizationSection === 'schedule' && visualizationTab === 'statistics' && (!chartData.durationBuckets || chartData.durationBuckets.length === 0) && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <span className="text-4xl mb-3">📈</span>
                <p className="text-sm font-semibold text-slate-600">No statistics yet</p>
                <p className="text-sm text-slate-400 mt-1">Generate a schedule from the Document Intelligence step to see activity statistics.</p>
              </div>
            )}

            {visualizationSection === 'eddr' && visualizationTab === 'status' && chartData.statusBoard && (
              <div className="space-y-6">
                {/* Progress Summary */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-4 border border-slate-200">
                    <div className="text-sm font-semibold text-slate-600 uppercase tracking-wide">Total Documents</div>
                    <div className="text-3xl font-bold text-slate-900 mt-1">{chartData.totalDocs}</div>
                  </div>
                  <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl p-4 border border-emerald-200">
                    <div className="text-sm font-semibold text-emerald-600 uppercase tracking-wide">Completed</div>
                    <div className="text-3xl font-bold text-emerald-900 mt-1">{chartData.completedDocs}</div>
                  </div>
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200">
                    <div className="text-sm font-semibold text-blue-600 uppercase tracking-wide">In Progress</div>
                    <div className="text-3xl font-bold text-blue-900 mt-1">{chartData.inProgressDocs}</div>
                  </div>
                  <div className="bg-gradient-to-br from-violet-50 to-violet-100 rounded-xl p-4 border border-violet-200">
                    <div className="text-sm font-semibold text-violet-600 uppercase tracking-wide">Completion</div>
                    <div className="text-3xl font-bold text-violet-900 mt-1">{chartData.completionPercentage}%</div>
                  </div>
                </div>

                {/* Primavera-Style Status Board */}
                <div className="bg-gradient-to-br from-slate-50 to-white rounded-xl p-4 border border-slate-200">
                  <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
                    <span>📋</span> Document Workflow Status Board
                    <span className="text-xs text-slate-500 font-normal">(Primavera-Style)</span>
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    {chartData.statusBoard.map((status, idx) => (
                      <div
                        key={idx}
                        className="rounded-lg p-4 border-2 transition-all hover:shadow-lg"
                        style={{ 
                          backgroundColor: `${status.color}15`,
                          borderColor: status.color
                        }}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-2xl">{status.icon}</span>
                          <div className="text-xs font-semibold text-slate-600 uppercase tracking-wide line-clamp-2">
                            {status.name}
                          </div>
                        </div>
                        <div className="text-3xl font-bold mb-2" style={{ color: status.color }}>
                          {status.count}
                        </div>
                        <div className="text-xs text-slate-500">
                          {Math.round((status.count / chartData.totalDocs) * 100)}% of total
                        </div>
                        {status.documents.length > 0 && (
                          <div className="mt-3 pt-3 border-t space-y-1.5" style={{ borderColor: `${status.color}30` }}>
                            {status.documents.slice(0, 3).map((doc, i) => (
                              <div key={i} className="text-xs text-slate-600 truncate" title={doc.deliverable_name}>
                                • {doc.deliverable_name}
                              </div>
                            ))}
                            {status.documents.length > 3 && (
                              <div className="text-xs text-slate-400 italic">
                                +{status.documents.length - 3} more
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Status Progression Chart */}
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                  <h3 className="font-semibold text-slate-700 mb-4">Document Status Distribution</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={chartData.progressionData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                        {chartData.progressionData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {visualizationSection === 'eddr' && visualizationTab === 'workflow' && chartData.timelineData && (
              <div className="space-y-6">
                {/* Workflow Duration by Discipline - Bar Chart */}
                <div className="bg-gradient-to-br from-slate-50 to-white rounded-xl p-4 border border-slate-200">
                  <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
                    <span>📊</span> Average Workflow Duration by Discipline
                    <span className="text-xs text-slate-500 font-normal">(Bar Chart)</span>
                  </h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart 
                      data={chartData.disciplineData.map(disc => {
                        const docsInDisc = chartData.timelineData.filter(d => d.discipline === disc.name);
                        const avgDuration = docsInDisc.length > 0 
                          ? Math.round(docsInDisc.reduce((sum, d) => sum + d.duration, 0) / docsInDisc.length)
                          : 0;
                        return {
                          name: disc.name,
                          avgDuration: avgDuration,
                          icon: disc.icon,
                          color: disc.color,
                          count: docsInDisc.length
                        };
                      }).filter(d => d.count > 0)}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                      <YAxis label={{ value: 'Days', angle: -90, position: 'insideLeft' }} />
                      <Tooltip 
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-white p-3 rounded-lg shadow-lg border border-slate-200">
                                <p className="font-semibold text-slate-800">{data.icon} {data.name}</p>
                                <p className="text-sm text-slate-600">Avg Duration: {data.avgDuration} days</p>
                                <p className="text-sm text-slate-600">Documents: {data.count}</p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar dataKey="avgDuration" radius={[8, 8, 0, 0]}>
                        {chartData.disciplineData.map((disc, index) => (
                          <Cell key={`cell-${index}`} fill={disc.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Workflow Timeline - Scatter Plot */}
                <div className="bg-gradient-to-br from-slate-50 to-white rounded-xl p-4 border border-slate-200">
                  <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
                    <span>📈</span> Document Workflow Timeline
                    <span className="text-xs text-slate-500 font-normal">(Scatter Plot)</span>
                  </h3>
                  <ResponsiveContainer width="100%" height={400}>
                    <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                      <CartesianGrid />
                      <XAxis
                        type="number"
                        dataKey="start"
                        name="Start Date"
                        domain={[chartData.earliestStart, chartData.latestEnd]}
                        tickFormatter={(tick) => new Date(tick).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      />
                      <YAxis type="number" dataKey="duration" name="Duration (days)" />
                      <ZAxis type="number" dataKey="duration" range={[50, 400]} />
                      <Tooltip
                        cursor={{ strokeDasharray: '3 3' }}
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-white p-3 rounded-lg shadow-lg border border-slate-200">
                                <p className="font-semibold text-slate-800">{data.icon} {data.name}</p>
                                <p className="text-sm text-slate-600">Discipline: {data.discipline}</p>
                                <p className="text-sm text-slate-600">Duration: {data.duration} days</p>
                                <p className="text-sm text-slate-600">
                                  Start: {new Date(data.start).toLocaleDateString()}
                                </p>
                                <p className="text-sm font-semibold text-violet-600">Status: {data.status}</p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Scatter name="Documents" data={chartData.timelineData} fill="#8b5cf6">
                        {chartData.timelineData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Scatter>
                    </ScatterChart>
                  </ResponsiveContainer>
                  <p className="text-xs text-slate-500 mt-2 text-center">
                    Showing {Math.min(50, chartData.totalDocs)} of {chartData.totalDocs} documents with workflow dates
                  </p>
                </div>

                {/* Workflow Duration Distribution - Bar Chart */}
                <div className="bg-gradient-to-br from-slate-50 to-white rounded-xl p-4 border border-slate-200">
                  <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
                    <span>📊</span> Workflow Duration Distribution
                    <span className="text-xs text-slate-500 font-normal">(Bar Chart)</span>
                  </h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart 
                      data={[
                        { range: '0-10 days', count: chartData.timelineData.filter(d => d.duration <= 10).length },
                        { range: '11-20 days', count: chartData.timelineData.filter(d => d.duration > 10 && d.duration <= 20).length },
                        { range: '21-30 days', count: chartData.timelineData.filter(d => d.duration > 20 && d.duration <= 30).length },
                        { range: '31-45 days', count: chartData.timelineData.filter(d => d.duration > 30 && d.duration <= 45).length },
                        { range: '45+ days', count: chartData.timelineData.filter(d => d.duration > 45).length }
                      ].filter(bucket => bucket.count > 0)}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="range" />
                      <YAxis label={{ value: 'Documents', angle: -90, position: 'insideLeft' }} />
                      <Tooltip 
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-white p-3 rounded-lg shadow-lg border border-slate-200">
                                <p className="font-semibold text-slate-800">{data.range}</p>
                                <p className="text-sm text-slate-600">Documents: {data.count}</p>
                                <p className="text-sm text-slate-600">
                                  {Math.round((data.count / chartData.timelineData.length) * 100)}% of total
                                </p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar dataKey="count" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Timeline Legend */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {chartData.disciplineData.slice(0, 6).map((disc, idx) => (
                    <div key={idx} className="bg-white rounded-lg p-3 border border-slate-200 flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: disc.color }}></div>
                      <span className="text-sm font-medium text-slate-700">{disc.icon} {disc.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {visualizationSection === 'eddr' && visualizationTab === 'breakdown' && chartData.disciplineData && (
              <div className="space-y-6">
                {/* Discipline Breakdown Chart */}
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                  <h3 className="font-semibold text-slate-700 mb-4">Documents by Discipline</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={chartData.disciplineData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="completed" fill="#10b981" name="Completed" stackId="a" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="inProgress" fill="#3b82f6" name="In Progress" stackId="a" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="notStarted" fill="#cbd5e1" name="Not Started" stackId="a" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Discipline Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {chartData.disciplineData.map((disc, idx) => (
                    <div key={idx} className="bg-white rounded-xl p-4 border-2 hover:shadow-lg transition-all" style={{ borderColor: disc.color }}>
                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-3xl">{disc.icon}</span>
                        <div className="flex-1">
                          <div className="font-semibold text-slate-800">{disc.name}</div>
                          <div className="text-sm text-slate-500">{disc.total} documents</div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-slate-600">✅ Completed</span>
                          <span className="font-semibold text-emerald-600">{disc.completed}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-slate-600">🔄 In Progress</span>
                          <span className="font-semibold text-blue-600">{disc.inProgress}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-slate-600">⚪ Not Started</span>
                          <span className="font-semibold text-slate-400">{disc.notStarted}</span>
                        </div>
                        <div className="pt-2 mt-2 border-t border-slate-100">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-semibold text-slate-700">Progress</span>
                            <span className="font-bold" style={{ color: disc.color }}>
                              {Math.round((disc.completed / disc.total) * 100)}%
                            </span>
                          </div>
                          <div className="mt-1.5 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full transition-all duration-500"
                              style={{
                                width: `${(disc.completed / disc.total) * 100}%`,
                                backgroundColor: disc.color
                              }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!chartData.disciplines && !chartData.disciplineStats && !chartData.statusBoard && (
              <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                <span className="text-4xl mb-3">📊</span>
                <p className="text-lg font-semibold">No data available</p>
                <p className="text-sm">Generate schedule or analyze documents first</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-4 border-t border-slate-200 bg-slate-50">
            <p className="text-sm text-slate-500">
              {visualizationSection === 'intelligence' && '📋 Insights from document intelligence analysis'}
              {visualizationSection === 'schedule' && '📅 Schedule data with realistic CPM relationships'}
              {visualizationSection === 'eddr' && '📋 EDDR workflow tracking with Primavera-style status board'}
            </p>
            <button
              onClick={() => setShowVisualization(false)}
              className="px-4 py-2 rounded-lg bg-violet-600 text-white font-semibold hover:bg-violet-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderStepContent = () => {
    if (['wbs', 'schedule', 'eddr', 'manhours', 'validation', 'narrative', 'presentation', 'export'].includes(currentStep) && (!embedded || documentWorkflow) && !manualPlanning) {
      if (loadingGeneration) return <p role="status">Loading saved generation…</p>;
      if (generationLoadError) return <section role="alert"><p>{generationLoadError}</p><button type="button" className="pln-button" onClick={() => loadLatestGeneration(selectedProjectId, generationSelectionId)}>Retry saved generation</button></section>;
    }
    switch (currentStep) {
      case 'upload': return renderUploadStep();
      case 'intelligence': return renderIntelligenceStep();
      case 'wbs': return embedded && (manualPlanning || !documentWorkflow) ? manualPlanning || previewConfirmed ? <WorkBreakdownPanel
        key={manualPlanning ? `manual:${selectedProjectId}` : `${intelligencePreview.document_intelligence_run_id}:${previewConfirmation.confirmed_at}`}
        projectId={selectedProjectId} intelligenceRunId={intelligencePreview?.document_intelligence_run_id}
        planningMode={manualPlanning ? 'manual' : 'document'}
        previewConfirmedAt={previewConfirmation?.confirmed_at} baselinePublished={Boolean(enterpriseContract?.baseline_locked)}
        onDirtyChanged={setWorkBreakdownDirty} onSavingChanged={setWorkBreakdownSaving}
        onLoaded={acceptWorkBreakdown}
        onBack={() => setCurrentStep('upload')}
        onContinue={result => {
          setWorkBreakdownSchedule(result); setWorkspaceInitialTab('activities'); setCurrentStep('schedule');
          if (onOpenPlanner) onOpenPlanner({ planningProjectId: selectedProjectId, scheduleId: result.schedule_id, versionId: result.schedule_version_id });
          else setShowPlannerWorkspace(true);
        }}
      /> : <p>Confirm and save the Document Intelligence Preview before building the work breakdown.</p> : renderWbsStep();
      case 'schedule': return renderScheduleStep();
      case 'eddr': return renderEddrStep();
      case 'manhours': return renderManhoursStep();
      case 'validation': return renderValidationStep();
      case 'narrative': return renderNarrativeStep();
      case 'presentation': return renderPresentationStep();
      case 'export': return renderExportStep();
      case 'proposal': return (
        <div className="rounded-2xl border border-blue-200 bg-gradient-to-br from-white to-blue-50 px-8 py-16 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-700 text-3xl text-white">📑</div>
          <h2 className="mt-5 text-2xl font-bold text-slate-900">Enterprise Technical Proposal Studio</h2>
          <p className="mx-auto mt-2 max-w-2xl text-slate-600">Open the dedicated bid workspace for the complete proposal outline, compliance matrix, resources, method statement, schedule exhibits, corporate evidence, live A4 preview and controlled exports.</p>
          <button type="button" onClick={() => navigate(`/proposal-workspace/${selectedProjectId}`)} className="mt-7 rounded-xl bg-blue-700 px-6 py-3 font-bold text-white shadow hover:bg-blue-800">Open Enterprise Proposal Studio →</button>
        </div>
      );
      default: return null;
    }
  };

  // ── Main render ──────────────────────────────────────────────────────────
  if (embedded) {
    const stages = [
      { label: 'Scope & inputs', steps: ['upload', 'intelligence'] },
      { label: 'Work breakdown', steps: ['wbs'] },
      { label: 'Schedule & resources', steps: ['schedule', 'eddr', 'manhours'] },
      { label: 'Review & approve', steps: ['validation'] },
      { label: 'Publish baseline', steps: ['export', 'narrative', 'presentation', 'proposal'] },
    ];
    const selectedStage = stages.findIndex(stage => stage.steps.includes(currentStep));
    const goToStage = async index => {
      if (workBreakdownDirty && index !== 1 && !(await radaiConfirm('Leave Work breakdown and discard unsaved task changes?'))) return;
      if (index === 1) openWorkBreakdown();
      else if (manualPlanning && index >= 2) {
        const initialTab = index === 3 ? 'assurance' : index === 4 ? 'governance' : 'activities';
        setWorkspaceInitialTab(initialTab); setCurrentStep(stages[index].steps[0]);
        if (onOpenPlanner) onOpenPlanner({ planningProjectId: selectedProjectId, scheduleId: planningSchedule?.schedule_id, versionId: planningSchedule?.schedule_version_id, initialTab });
        else setShowPlannerWorkspace(true);
      }
      else setCurrentStep(stages[index].steps[0]);
    };
    const backToPortfolio = () => onBackToPortfolio ? onBackToPortfolio() : navigate(`/projects?project=${enterpriseProject?.id || ''}`);
    const savedProject = saved => {
      setProjects(current => current.some(item => item.id === saved.id)
        ? current.map(item => item.id === saved.id ? saved : item) : [saved, ...current]);
      setSelectedProjectId(saved.id);
      loadEnterpriseContract(saved.id);
    };
    return <div className="planning-design" aria-label="Project planning">
      {renderBanner()}
      {renderPreviousAnalysisNotice()}
      {renderPendingPlannerNotice()}
      {renderPlanningPackageState()}
      {renderAiSettingsModal()}
      <GenerationWizard open={showGenerationWizard} project={selectedProject} files={files}
        generationMode={documentWorkflow ? 'planning_package' : 'document'}
        intelligence={intelligencePreview || generation?.intelligence} intelligenceOverrides={buildIntelligenceOverrides()}
        onClose={() => setShowGenerationWizard(false)} onGenerate={handleGenerate}
        onReviewEvidence={() => { setShowGenerationWizard(false); setShowPlannerWorkspace(false); setCurrentStep('intelligence'); }}
        onOpenPlanner={selection => openPlannerWorkspace(selectedProjectId, selection)} />
      {showPlannerWorkspace && selectedProjectId && <PlannerWorkspacePage embedded planningProjectId={selectedProjectId}
        initialScheduleId={planningSchedule?.schedule_id} initialVersionId={planningSchedule?.schedule_version_id} initialGenerationId={workspaceGenerationId} initialAnalysisRunId={workspaceAnalysisRunId} initialTab={workspaceInitialTab}
        onOpenDocumentStep={request => setLocalDocumentReviewRequest({ ...request, requestId: Date.now() })}
        onBack={() => { setShowPlannerWorkspace(false); if (planningSchedule) setCurrentStep('wbs'); }} onOpenGenerationWizard={() => { setShowPlannerWorkspace(false); if (documentWorkflow && !intelligencePreview?.document_intelligence_run_id) setCurrentStep('intelligence'); else setShowGenerationWizard(true); }} />}
      <nav aria-label="Planning stages" hidden={showPlannerWorkspace || documentWorkflow}><ol className="pln-steps">{stages.map((stage, index) => {
        const active = index === selectedStage;
        const available = !analyzing && !savingPreview && !workBreakdownSaving && (index === 0 || (Boolean(selectedProjectId) && (manualPlanning ? index === 1 ? inputsReady : !loadingContract && Boolean(planningSchedule) : Boolean(generation) || (index === 1 && Boolean(intelligencePreview)))));
        const complete = index === 0 && (manualPlanning ? inputsReady : previewConfirmed) && selectedStage > 0;
        return <li key={stage.label} className={complete ? 'pln-step-complete' : undefined}><button type="button" aria-current={active ? 'step' : undefined} disabled={!available}
          onClick={() => goToStage(index)}>
          <span className="pln-step-number">{complete ? <Check size={21} /> : index + 1}</span><span><strong>{stage.label}</strong><small>{complete ? 'Complete' : active ? 'In progress' : index === 4 && enterpriseContract?.baseline_locked ? 'Baseline published' : generation || manualPlanning && available ? 'Available' : 'Not started'}</small></span>
        </button></li>;
      })}</ol></nav>
      {loadingProjects ? <div className="pln-workspace-tools" role="status"><RefreshCw size={17} className="animate-spin" />Loading project planning…</div> : <>
        {contractError && <div className="pln-error" role="alert">{contractError.title}. <button type="button" className="pln-button" onClick={() => loadEnterpriseContract(selectedProjectId)}>Retry connection</button></div>}
        <div className={documentWorkflow ? 'pln-document-workflow' : undefined}>
        {documentWorkflow && !showPlannerWorkspace && <nav className="pln-document-steps" aria-label="Document Intelligence workflow">
          {PLANNING_WORKFLOW_STEPS.map((step, index) => {
            const locked = !selectedProjectId || analyzing || packageBusy || savingPreview || savingEdit || workBreakdownSaving || (step.requiresGeneration && step.id !== 'schedule' && !generation && !(step.id === 'wbs' && manualPlanning && inputsReady));
            return <button type="button" key={step.id} disabled={locked} aria-current={currentStep === step.id ? 'step' : undefined}
              title={locked && step.requiresGeneration && !generation ? 'Generate a draft to view this output.' : undefined}
              onClick={async () => { if (workBreakdownDirty && step.id !== 'wbs' && !(await radaiConfirm('Leave Work breakdown and discard unsaved task changes?'))) return; setCurrentStep(step.id); }}>
              <span className="pln-document-step-icon" aria-hidden="true">{step.icon}</span>
              <span><strong>{index + 1}. {step.label}</strong><small>{step.description}</small></span>
            </button>;
          })}
        </nav>}
        <div className="pln-document-content">
        <PlanningInputsPanel project={selectedProject} enterpriseProject={enterpriseProject} contract={enterpriseContract} idPrefix={documentWorkflow ? 'document-planning' : 'planning'}
          loadingContract={loadingContract} files={files} uploading={uploading} analyzing={analyzing} busy={packageBusy} analysisRevision={analysisRevision} analysisRunId={reviewAnalysisRunId}
          uploadCategory={uploadCategory} onUploadCategory={setUploadCategory} onUpload={handleUpload} onDeleteFile={handleDeleteFile}
          onAnalyze={handleAnalyze} onSaved={savedProject} onBack={backToPortfolio}
          onOpenWorkBreakdown={() => setCurrentStep('wbs')}
          onOpenIntelligencePreview={() => setCurrentStep('intelligence')}
          onPreviewStaleChanged={setIntelligenceOutdated}
          onReadinessChanged={setInputsReady}
          onIntelligenceLoaded={acceptLoadedIntelligence}
          onReviewStateChanged={setPreviewReviewState} reviewRequest={reviewRequest}
          onAiSettings={() => { setShowAiSettingsModal(true); setTestResult(null); }} hidden={showPlannerWorkspace || currentStep !== 'upload'}
          onRevealInputs={() => { setShowPlannerWorkspace(false); setCurrentStep('upload'); }} />
        {!showPlannerWorkspace && currentStep !== 'upload' && <div className="pln-advanced-panel">
          <nav className="pln-task-tabs" aria-label="Planning tasks" hidden={documentWorkflow || currentStep === 'wbs'}>{(stages[selectedStage]?.steps || []).map(id => <button type="button" key={id} aria-pressed={currentStep === id} onClick={() => setCurrentStep(id)}>{PLANNING_WORKFLOW_STEPS.find(step => step.id === id)?.label}</button>)}</nav>
          {renderStepContent()}
          <div className="pln-workspace-tools" hidden={!documentWorkflow && currentStep === 'wbs'}><button type="button" className="pln-button" onClick={() => setCurrentStep('upload')}>Back to scope &amp; inputs</button><span>{currentStep === 'intelligence' && previewConfirmed ? 'Preview confirmed and saved.' : `${enterpriseProject?.code} · ${enterpriseProject?.name}`}</span>
            {currentStep === 'intelligence' && intelligencePreview?.document_intelligence_run_id && <><button type="button" className="pln-button" disabled={analyzing || packageBusy || savingPreview || savingEdit || Boolean(editingSection) || intelligenceOutdated} onClick={() => requestPlanningWorkspace(intelligencePreview.document_intelligence_run_id)}>Open schedule workspace</button><button type="button" className="pln-button" disabled={analyzing || packageBusy || savingPreview || savingEdit || Boolean(editingSection)} onClick={() => openPlannerWorkspace(selectedProjectId, { analysisRunId: intelligencePreview.document_intelligence_run_id })}>Review extracted source</button></>}
            <button type="button" className="pln-button pln-primary" disabled={currentStep === 'intelligence' && (!canConfirmPreview || savingPreview)} onClick={currentStep === 'intelligence' ? confirmPreview : () => openPlannerWorkspace(selectedProjectId)}>{currentStep === 'intelligence' ? savingPreview ? 'Saving confirmation…' : documentWorkflow ? previewConfirmed ? 'Continue to Schedule Generator' : 'Confirm & save preview' : previewConfirmed ? 'Continue to Work breakdown' : 'Confirm & save → Work breakdown' : 'Open schedule workspace'}</button></div>
        </div>}
        {selectedProject && !showPlannerWorkspace && currentStep !== 'wbs' && <details className="pln-workspace-details"><summary>Planning tools &amp; workspace details</summary><div className="pln-workspace-tools">{!manualPlanning && <button type="button" className="pln-button" onClick={() => setCurrentStep('intelligence')}>Document Intelligence Preview</button>}<span>{manualPlanning ? 'Manage the project calendar, tasks and schedule.' : 'Review the schedule basis, discipline inputs and generation plan.'}</span></div>{renderProjectPicker()}</details>}
        </div></div>
      </>}
      {renderVisualizationModal()}
    </div>;
  }

  return (
    <div className={`project-control-workspace bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 ${embedded ? 'w-full' : 'min-h-screen px-4 py-6 sm:px-6 sm:py-8'}`}>
      <div className={embedded ? 'w-full' : 'mx-auto w-full max-w-[1800px]'}>
        {!embedded && <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><button type="button" onClick={() => navigate('/projects')} className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600">← Back to Project Control</button><button type="button" onClick={() => navigate('/planning-packages/docs')} className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-indigo-700 hover:bg-indigo-50">Workflow &amp; Docs</button></div>}

        {/* Hero header */}
        {!embedded && <header className="relative mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-6">
          <div className="hidden" aria-hidden="true" />
          <div className="hidden" aria-hidden="true" />
          <div className="relative flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-2xl text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
              {PLANNING_UI.heroIcon}
            </div>
            <div className="flex-1 min-w-0">
              <nav aria-label="Breadcrumb" className="mb-1 text-sm text-slate-500 dark:text-slate-400">Project Control / Plan &amp; Baseline</nav>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">Plan &amp; Baseline</h1>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Prepare, validate, approve, and publish a controlled project plan.
              </p>
            </div>
            {viewMode === 'workspace' && selectedProject && (
              <div className="flex gap-2 flex-wrap sm:justify-end shrink-0">
                <button
                  type="button"
                  onClick={() => openPlannerWorkspace(selectedProject.id)}
                  className="min-h-11 rounded-lg bg-indigo-700 px-4 text-sm font-semibold text-white hover:bg-indigo-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
                >
                  Open Planning Workspace
                </button>
                <div className="min-w-[84px] rounded-lg bg-slate-100 px-3.5 py-2 text-center dark:bg-slate-800">
                  <div className="text-xl font-bold text-slate-900 dark:text-white">{files.length}</div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Files</div>
                </div>
                <div className="min-w-[84px] rounded-lg bg-slate-100 px-3.5 py-2 text-center dark:bg-slate-800">
                  <div className="text-xl font-bold text-slate-900 dark:text-white">{generation ? generation.activities.length : '—'}</div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Activities</div>
                </div>
                <div className="min-w-[84px] rounded-lg bg-slate-100 px-3.5 py-2 text-center dark:bg-slate-800">
                  <div className="text-xl font-bold text-slate-900 dark:text-white">{generation ? `v${generation.version}` : '—'}</div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Version</div>
                </div>
              </div>
            )}
          </div>
        </header>}

        {renderBanner()}
        {renderPreviousAnalysisNotice()}
        {renderPendingPlannerNotice()}
        {renderAiSettingsModal()}
        <GenerationWizard
          open={showGenerationWizard}
          project={selectedProject}
          files={files}
          intelligence={intelligencePreview || generation?.intelligence}
          intelligenceOverrides={buildIntelligenceOverrides()}
          onClose={() => setShowGenerationWizard(false)}
          onGenerate={handleGenerate}
          onReviewEvidence={() => { setShowGenerationWizard(false); setShowPlannerWorkspace(false); setCurrentStep('intelligence'); }}
        onOpenPlanner={selection => openPlannerWorkspace(selectedProjectId, selection)}
        />

        {loadingProjects ? (
          <div className="bg-white rounded-2xl shadow-lg p-14 text-center text-slate-400">
            <div className="animate-pulse text-4xl mb-3">⏳</div>
            Loading planning projects…
          </div>
        ) : embedded && !selectedProjectId && !showNewProjectForm ? (
          <section className="rounded-xl border border-indigo-200 bg-white px-6 py-12 text-center shadow-sm dark:border-indigo-900 dark:bg-slate-900">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-indigo-100 text-2xl dark:bg-indigo-950">📅</div>
            <h2 className="mt-4 text-lg font-semibold text-slate-950 dark:text-white">Set up Plan &amp; Baseline</h2>
            <p className="mx-auto mt-2 max-w-xl text-sm text-slate-600 dark:text-slate-400">Create the planning workspace linked to <span className="font-semibold">{enterpriseProject?.name}</span>. Project name, client, location and schedule dates will be carried across for review.</p>
            <button type="button" onClick={() => { setNewProject(planningProjectDraft(enterpriseProject)); setShowNewProjectForm(true); }} className="mt-5 min-h-11 rounded-lg bg-indigo-700 px-4 text-sm font-semibold text-white hover:bg-indigo-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2">Create linked planning workspace</button>
          </section>
        ) : !embedded && projects.length === 0 && !showNewProjectForm ? (
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200/80 p-14 text-center">
            <div className="text-6xl mb-4">📦</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">No Planning Projects Yet</h2>
            <p className="text-gray-600 mb-5">Create your first planning project to begin uploading reference documents.</p>
            <button onClick={() => setShowNewProjectForm(true)} className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold shadow-sm hover:shadow-md hover:from-violet-700 hover:to-indigo-700 transition-all">
              + New Planning Project
            </button>
          </div>
        ) : !embedded && viewMode === 'dashboard' ? (
          renderProjectsDashboard()
        ) : (
          <>
            {showNewProjectForm && renderNewProjectForm()}
            {selectedProjectId && renderProjectPicker()}
            {selectedProjectId && (
              <div className="flex flex-col lg:flex-row gap-5 bg-slate-50/60 rounded-3xl border border-slate-200/60 p-3 sm:p-4">
                {renderStepNav()}
                <div className="flex-1 min-w-0">{renderTaskNav()}{renderStepContent()}</div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Visualization Modal */}
      {renderVisualizationModal()}
    </div>
  );
};

PlanningPackagePage.propTypes = {
  embedded: PropTypes.bool,
  documentWorkflow: PropTypes.bool,
  recoveredJob: PropTypes.object,
  onBackToPortfolio: PropTypes.func,
  onOpenPlanner: PropTypes.func,
  onAnalysisStateChange: PropTypes.func,
  generationRequest: PropTypes.number,
  scheduleWorkspaceRequest: PropTypes.number,
  documentReviewRequest: PropTypes.shape({ step: PropTypes.string, generationId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]), analysisRunId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]), analysisAction: PropTypes.oneOf(['settings', 'retry']), planningProjectId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]), requestId: PropTypes.number }),
  enterpriseProject: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    name: PropTypes.string,
    client_name: PropTypes.string,
    location: PropTypes.string,
    start_date: PropTypes.string,
    end_date: PropTypes.string,
    custom_fields: PropTypes.object,
  }),
};

export default PlanningPackagePage;
