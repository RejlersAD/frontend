import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { PROJECT_CONTROL_SUBFEATURES } from '../config/projectControl.config';
import apiClient from '../services/api.service';
import {
  PLANNING_ENDPOINTS,
  PLANNING_FILE_CATEGORIES,
  PLANNING_WORKFLOW_STEPS,
  PARSE_STATUS_STYLES,
  VALIDATION_SEVERITY_STYLES,
  EXPORT_FORMATS,
  EXPORT_CATEGORY_ORDER,
  PRESENTATION_SLIDE_OUTLINE,
  PLANNING_MAX_FILE_MB,
  PLANNING_UI,
  CANVAS_MODES,
  CANVAS_MODE_STORAGE_KEY,
  CANVAS_MODE_OPTIONS,
  CANVAS_MODE_STYLES,
  CLAUDE_MODEL_OPTIONS,
  DEFAULT_CLAUDE_MODEL,
  CLAUDE_API_KEY_PATTERN,
  PLANNING_DISCIPLINE_META,
  DEFAULT_DISCIPLINE_META,
} from '../config/planningIntelligence.config';

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
 * Document intelligence and narrative text are produced by a deterministic,
 * rule-based engine (no external AI API key is configured in this
 * environment) — always reviewed by the user before export.
 */
const PlanningPackagePage = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [showNewProjectForm, setShowNewProjectForm] = useState(false);
  const [newProject, setNewProject] = useState({
    name: '', client: '', location: '', phase: 'FEED', effective_date: '', duration_months: 10,
  });

  // Multi-project dashboard — 'dashboard' shows the all-projects grid,
  // 'workspace' shows the existing single-project workflow stepper.
  const [viewMode, setViewMode] = useState('dashboard');
  const [dashboardSearch, setDashboardSearch] = useState('');
  const [dashboardPhaseFilter, setDashboardPhaseFilter] = useState('');

  const [currentStep, setCurrentStep] = useState('upload');
  const [files, setFiles] = useState([]);
  const [uploadCategory, setUploadCategory] = useState('sow');
  const [uploading, setUploading] = useState(false);

  const [intelligencePreview, setIntelligencePreview] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  // Which discipline card ("Process", "Piping", ...) is expanded to show its
  // full deliverable checklist — accordion-style, one at a time.
  const [expandedDiscipline, setExpandedDiscipline] = useState(null);

  const [generation, setGeneration] = useState(null);
  const [generating, setGenerating] = useState(false);
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

  // BYOK — per-project Claude/Anthropic settings (see ai-settings endpoint).
  const [aiSettings, setAiSettings] = useState(null);
  const [showAiSettingsModal, setShowAiSettingsModal] = useState(false);
  const [aiSettingsForm, setAiSettingsForm] = useState({ enabled: false, model: DEFAULT_CLAUDE_MODEL, apiKey: '' });
  const [savingAiSettings, setSavingAiSettings] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState(null); // { success, message }

  const [canvasMode, setCanvasMode] = useState(() => {
    try {
      return localStorage.getItem(CANVAS_MODE_STORAGE_KEY) || CANVAS_MODES.ORIGINAL;
    } catch {
      return CANVAS_MODES.ORIGINAL;
    }
  });
  const canvasStyle = CANVAS_MODE_STYLES[canvasMode] || CANVAS_MODE_STYLES[CANVAS_MODES.ORIGINAL];

  useEffect(() => {
    try { localStorage.setItem(CANVAS_MODE_STORAGE_KEY, canvasMode); } catch { /* ignore storage errors */ }
  }, [canvasMode]);

  const selectedProject = projects.find(p => p.id === selectedProjectId) || null;

  // ── Data loading ─────────────────────────────────────────────────────────
  const loadProjects = useCallback(async () => {
    setLoadingProjects(true);
    try {
      const res = await apiClient.get(PLANNING_ENDPOINTS.projects);
      const list = res.data?.results ?? res.data ?? [];
      setProjects(list);
      if (list.length) {
        setSelectedProjectId(prev => prev || list[0].id);
      }
    } catch (err) {
      setBanner({ type: 'error', message: 'Failed to load planning projects.' });
    } finally {
      setLoadingProjects(false);
    }
  }, []);

  const loadFiles = useCallback(async (projectId) => {
    if (!projectId) return;
    try {
      const res = await apiClient.get(PLANNING_ENDPOINTS.files, { params: { project: projectId } });
      setFiles(res.data?.results ?? res.data ?? []);
    } catch (err) {
      setBanner({ type: 'error', message: 'Failed to load uploaded files.' });
    }
  }, []);

  const loadLatestGeneration = useCallback(async (projectId) => {
    if (!projectId) return;
    try {
      const res = await apiClient.get(PLANNING_ENDPOINTS.generations, { params: { project: projectId } });
      const list = res.data?.results ?? res.data ?? [];
      if (list.length) {
        const detail = await apiClient.get(PLANNING_ENDPOINTS.generation(list[0].id));
        setGeneration(detail.data);
      } else {
        setGeneration(null);
      }
    } catch (err) {
      // non-fatal — user simply hasn't generated a schedule yet
      setGeneration(null);
    }
  }, []);

  const loadAiSettings = useCallback(async (projectId) => {
    if (!projectId) return;
    try {
      const res = await apiClient.get(PLANNING_ENDPOINTS.aiSettings(projectId));
      setAiSettings(res.data);
      setAiSettingsForm({
        enabled: res.data.enabled,
        model: res.data.model || DEFAULT_CLAUDE_MODEL,
        apiKey: '',
      });
    } catch (err) {
      setAiSettings(null);
    }
  }, []);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  useEffect(() => {
    if (selectedProjectId) {
      loadFiles(selectedProjectId);
      loadLatestGeneration(selectedProjectId);
      loadAiSettings(selectedProjectId);
      setIntelligencePreview(null);
      setTestResult(null);
    }
  }, [selectedProjectId, loadFiles, loadLatestGeneration, loadAiSettings]);

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
    if (!newProject.name.trim()) {
      setBanner({ type: 'error', message: 'Project name is required.' });
      return;
    }
    try {
      const payload = { ...newProject, effective_date: newProject.effective_date || null };
      const res = await apiClient.post(PLANNING_ENDPOINTS.projects, payload);
      setProjects(prev => [res.data, ...prev]);
      setSelectedProjectId(res.data.id);
      setViewMode('workspace');
      setShowNewProjectForm(false);
      setNewProject({ name: '', client: '', location: '', phase: 'FEED', effective_date: '', duration_months: 10 });
      setBanner({ type: 'success', message: `Planning project "${res.data.name}" created.` });
    } catch (err) {
      setBanner({ type: 'error', message: 'Failed to create planning project.' });
    }
  };

  const handleOpenProject = (projectId) => {
    setSelectedProjectId(projectId);
    setViewMode('workspace');
  };

  const handleDeleteProject = async (project) => {
    if (!window.confirm(`Delete planning project "${project.name}"? It will be removed from the dashboard immediately.`)) {
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
      setBanner({ type: 'error', message: 'Failed to delete planning project.' });
    }
  };

  const handleUpload = async (fileList) => {
    if (!selectedProjectId || !fileList?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(fileList)) {
        const form = new FormData();
        form.append('project', selectedProjectId);
        form.append('category', uploadCategory);
        form.append('file', file);
        await apiClient.post(PLANNING_ENDPOINTS.files, form);
      }
      setBanner({ type: 'success', message: 'File(s) uploaded — parsing in the background.' });
      await loadFiles(selectedProjectId);
    } catch (err) {
      setBanner({ type: 'error', message: 'Upload failed for one or more files.' });
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteFile = async (fileId) => {
    try {
      await apiClient.delete(PLANNING_ENDPOINTS.file(fileId));
      setFiles(prev => prev.filter(f => f.id !== fileId));
    } catch (err) {
      setBanner({ type: 'error', message: 'Failed to remove file.' });
    }
  };

  const handleAnalyze = async () => {
    if (!selectedProjectId) return;
    setAnalyzing(true);
    setBanner(null);
    try {
      const res = await apiClient.post(PLANNING_ENDPOINTS.analyze(selectedProjectId));
      setIntelligencePreview(res.data.intelligence);
      setCurrentStep('intelligence');
    } catch (err) {
      setBanner({
        type: 'error',
        message: err.response?.data?.error || 'Document intelligence requires at least one parsed file.',
      });
    } finally {
      setAnalyzing(false);
    }
  };

  const handleGenerate = async () => {
    if (!selectedProjectId) return;
    setGenerating(true);
    setBanner(null);
    try {
      // Carry any Document Intelligence edits the Project Scheduler made
      // (project name/date/duration, discipline deliverable checklists,
      // HSE studies) through to WBS/Schedule/EDDR/Manhour generation.
      const overrides = intelligencePreview ? {
        detected_project_name: intelligencePreview.detected_project_name,
        detected_effective_date_text: intelligencePreview.detected_effective_date_text,
        detected_duration_months: intelligencePreview.detected_duration_months,
        disciplines: Object.fromEntries(
          Object.entries(intelligencePreview.disciplines || {}).map(([code, info]) => [code, { deliverables: info.deliverables, in_scope: info.in_scope !== false }])
        ),
        hse_studies: intelligencePreview.hse_studies,
      } : undefined;
      const res = await apiClient.post(
        PLANNING_ENDPOINTS.generate(selectedProjectId),
        overrides ? { intelligence_overrides: overrides } : {},
      );
      setGeneration(res.data);
      setBanner({ type: 'success', message: `Schedule generated (version ${res.data.version}).` });
      setCurrentStep('schedule');
    } catch (err) {
      setBanner({
        type: 'error',
        message: err.response?.data?.error || 'Schedule generation failed. Check the backend logs.',
      });
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
    setBanner({ type: 'success', message: 'Document Intelligence edits saved — they will be used the next time you generate the schedule.' });
    cancelEdit();
  };

  const handleSaveGenerationEdit = async (field, value) => {
    if (!generation) return;
    setSavingEdit(true);
    try {
      const res = await apiClient.patch(PLANNING_ENDPOINTS.editGeneration(generation.id), { [field]: value });
      setGeneration(res.data);
      setBanner({ type: 'success', message: 'Changes saved.' });
      cancelEdit();
    } catch (err) {
      setBanner({ type: 'error', message: err.response?.data?.error || 'Failed to save changes.' });
    } finally {
      setSavingEdit(false);
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
        is_critical: false,
        is_milestone: false,
        predecessors: [],
        responsible_role: '',
        total_float_days: 0,
        original_duration_days: 1,
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
    } catch (err) {
      setBanner({ type: 'error', message: 'Export failed.' });
    } finally {
      setExportingFormat(f => (f === format ? null : f));
    }
  };

  const handleDownloadPresentation = async () => {
    if (!generation) return;
    setDownloadingPresentation(true);
    setBanner(null);
    try {
      await handleExport('pptx');
      setBanner({ type: 'success', message: 'PowerPoint presentation downloaded.' });
    } catch (err) {
      setBanner({ type: 'error', message: 'Failed to generate the PowerPoint presentation.' });
    } finally {
      setDownloadingPresentation(false);
    }
  };

  const handleSaveAiSettings = async () => {
    if (!selectedProjectId) return;
    if (aiSettingsForm.apiKey && !CLAUDE_API_KEY_PATTERN.test(aiSettingsForm.apiKey.trim())) {
      setBanner({ type: 'error', message: 'API key does not look like a valid Anthropic key (expected format: sk-ant-...).' });
      return;
    }
    setSavingAiSettings(true);
    setTestResult(null);
    try {
      const payload = { enabled: aiSettingsForm.enabled, model: aiSettingsForm.model };
      if (aiSettingsForm.apiKey.trim()) payload.api_key = aiSettingsForm.apiKey.trim();
      const res = await apiClient.post(PLANNING_ENDPOINTS.aiSettings(selectedProjectId), payload);
      setAiSettings(res.data);
      setAiSettingsForm(prev => ({ ...prev, apiKey: '' }));
      setBanner({ type: 'success', message: 'AI (BYOK) settings saved.' });
      setProjects(prev => prev.map(p => (p.id === selectedProjectId
        ? { ...p, ai_enabled: res.data.enabled, ai_model: res.data.model, ai_key_configured: res.data.key_configured }
        : p)));
    } catch (err) {
      setBanner({ type: 'error', message: err.response?.data?.error || 'Failed to save AI settings.' });
    } finally {
      setSavingAiSettings(false);
    }
  };

  const handleRemoveAiKey = async () => {
    if (!selectedProjectId) return;
    setSavingAiSettings(true);
    setTestResult(null);
    try {
      const res = await apiClient.delete(PLANNING_ENDPOINTS.aiSettings(selectedProjectId));
      setAiSettings(res.data);
      setAiSettingsForm({ enabled: false, model: DEFAULT_CLAUDE_MODEL, apiKey: '' });
      setBanner({ type: 'success', message: 'AI (BYOK) key removed.' });
    } catch (err) {
      setBanner({ type: 'error', message: 'Failed to remove AI key.' });
    } finally {
      setSavingAiSettings(false);
    }
  };

  const handleTestAiConnection = async () => {
    if (!selectedProjectId) return;
    setTestingConnection(true);
    setTestResult(null);
    try {
      const res = await apiClient.post(PLANNING_ENDPOINTS.aiSettingsTest(selectedProjectId));
      setTestResult(res.data);
    } catch (err) {
      setTestResult(err.response?.data || { success: false, message: 'Connection test failed.' });
    } finally {
      setTestingConnection(false);
    }
  };

  // ── Render helpers ───────────────────────────────────────────────────────
  const renderBanner = () => {
    if (!banner) return null;
    const styles = banner.type === 'error'
      ? 'bg-rose-50 text-rose-700 border-rose-200'
      : 'bg-emerald-50 text-emerald-700 border-emerald-200';
    return (
      <div className={`mb-4 px-4 py-2 rounded-lg border text-sm flex items-center justify-between ${styles}`}>
        <span>{banner.message}</span>
        <button onClick={() => setBanner(null)} className="ml-4 opacity-60 hover:opacity-100">✕</button>
      </div>
    );
  };

  const renderProjectPicker = () => (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-4 sm:p-5 mb-6 flex flex-wrap items-center gap-3">
      <button
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
                ? `🤖 ${CLAUDE_MODEL_OPTIONS.find(m => m.value === aiSettings.model)?.label.split(' (')[0] || 'Claude'} BYOK Active`
                : '🧮 Deterministic mode'}
            </span>
          )}
        </div>
      )}
    </div>
  );

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
        <input
          type="text"
          placeholder="Search by name or client…"
          value={dashboardSearch}
          onChange={e => setDashboardSearch(e.target.value)}
          className="flex-1 min-w-[200px] border-2 border-slate-200 rounded-xl px-3 py-2 text-sm focus:border-violet-400 focus:outline-none transition-colors"
        />
        <select
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
                  onClick={() => handleOpenProject(project.id)}
                  className="flex-1 px-3 py-2 text-sm font-semibold rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-sm hover:shadow-md hover:from-violet-700 hover:to-indigo-700 transition-all"
                >
                  Open →
                </button>
                <button
                  onClick={() => handleDeleteProject(project)}
                  title="Delete project"
                  className="px-3 py-2 text-sm font-semibold rounded-xl border-2 border-slate-200 text-slate-500 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderNewProjectForm = () => (
    <form onSubmit={handleCreateProject} className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5 sm:p-6 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xl">✨</span>

        <h2 className="font-semibold text-slate-800">New Planning Project</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
          <span className="block text-sm font-semibold text-slate-600 mb-1">Effective Date</span>
          <input type="date" className="w-full border-2 border-slate-200 rounded-xl px-3 py-2 text-sm focus:border-violet-400 focus:outline-none transition-colors"
            value={newProject.effective_date} onChange={e => setNewProject({ ...newProject, effective_date: e.target.value })} />
        </label>
        <label className="text-sm">
          <span className="block text-sm font-semibold text-slate-600 mb-1">Duration (months)</span>
          <input type="number" min="1" className="w-full border-2 border-slate-200 rounded-xl px-3 py-2 text-sm focus:border-violet-400 focus:outline-none transition-colors"
            value={newProject.duration_months} onChange={e => setNewProject({ ...newProject, duration_months: e.target.value })} />
        </label>
      </div>
      <div className="flex gap-2 justify-end mt-5">
        <button type="button" onClick={() => setShowNewProjectForm(false)} className="px-4 py-2 text-sm font-medium rounded-xl border-2 border-slate-200 text-slate-600 hover:bg-slate-50">Cancel</button>
        <button type="submit" className="px-4 py-2 text-sm font-semibold rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-sm hover:shadow-md hover:from-violet-700 hover:to-indigo-700 transition-all">Create Project</button>
      </div>
    </form>
  );

  const renderAiSettingsModal = () => {
    if (!showAiSettingsModal || !selectedProject) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4" onClick={() => setShowAiSettingsModal(false)}>
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200/80 w-full max-w-lg p-5 sm:p-6" onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">🤖</span>
            <h2 className="font-semibold text-slate-800">AI Settings (BYOK) — {selectedProject.name}</h2>
          </div>
          <p className="text-sm text-slate-600 mb-4">
            Bring your own Anthropic API key to augment document intelligence and narrative
            generation with Claude for this project. Your key is encrypted at rest and never
            shown again after saving. Leave the key field blank to keep the currently stored key.
          </p>

          <div className="space-y-4">
            <label className="flex items-center gap-2.5 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                className="w-4 h-4 accent-violet-600"
                checked={aiSettingsForm.enabled}
                onChange={e => setAiSettingsForm(prev => ({ ...prev, enabled: e.target.checked }))}
              />
              Enable Claude BYOK for this project
            </label>

            <label className="block text-sm">
              <span className="block text-sm font-semibold text-slate-600 mb-1">Claude Model</span>
              <select
                className="w-full border-2 border-slate-200 rounded-xl px-3 py-2 text-sm focus:border-violet-400 focus:outline-none transition-colors"
                value={aiSettingsForm.model}
                onChange={e => setAiSettingsForm(prev => ({ ...prev, model: e.target.value }))}
              >
                {(aiSettings?.model_choices || CLAUDE_MODEL_OPTIONS).map(m => (
                  <option key={m.value} value={m.value}>{m.label}{m.recommended ? ' ★' : ''}</option>
                ))}
              </select>
            </label>

            <label className="block text-sm">
              <span className="block text-sm font-semibold text-slate-600 mb-1">
                Anthropic API Key {aiSettings?.key_configured && <span className="text-emerald-600 font-normal">(key configured ✓ — leave blank to keep it)</span>}
              </span>
              <input
                type="password"
                placeholder="sk-ant-..."
                autoComplete="off"
                className="w-full border-2 border-slate-200 rounded-xl px-3 py-2 text-sm focus:border-violet-400 focus:outline-none transition-colors"
                value={aiSettingsForm.apiKey}
                onChange={e => setAiSettingsForm(prev => ({ ...prev, apiKey: e.target.value }))}
              />
            </label>

            {testResult && (
              <div className={`text-sm rounded-xl px-3 py-2 border ${testResult.success ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                {testResult.message}
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2 justify-between mt-6">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleRemoveAiKey}
                disabled={savingAiSettings || !aiSettings?.key_configured}
                className="px-3.5 py-2 text-sm font-medium rounded-xl border-2 border-rose-200 text-rose-600 hover:bg-rose-50 disabled:opacity-40 transition-colors"
              >
                Remove Key
              </button>
              <button
                type="button"
                onClick={handleTestAiConnection}
                disabled={testingConnection || !aiSettings?.key_configured}
                className="px-3.5 py-2 text-sm font-medium rounded-xl border-2 border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition-colors"
              >
                {testingConnection ? 'Testing…' : 'Test Connection'}
              </button>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowAiSettingsModal(false)} className="px-4 py-2 text-sm font-medium rounded-xl border-2 border-slate-200 text-slate-600 hover:bg-slate-50">Close</button>
              <button
                type="button"
                onClick={handleSaveAiSettings}
                disabled={savingAiSettings}
                className="px-4 py-2 text-sm font-semibold rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-sm hover:shadow-md hover:from-violet-700 hover:to-indigo-700 transition-all disabled:opacity-40"
              >
                {savingAiSettings ? 'Saving…' : 'Save Settings'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderStepNav = () => (
    <div className="flex lg:flex-col gap-1.5 lg:w-64 shrink-0 overflow-x-auto lg:overflow-visible lg:sticky lg:top-6 lg:self-start bg-white lg:bg-transparent rounded-2xl lg:rounded-none border lg:border-0 border-slate-200/80 p-2 lg:p-0">
      {PLANNING_WORKFLOW_STEPS.map((step, idx) => {
        const isActive = currentStep === step.id;
        const locked = step.requiresGeneration && !generation;
        return (
          <button
            key={step.id}
            onClick={() => setCurrentStep(step.id)}
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
                  ? `bg-gradient-to-br ${step.accent} text-white shadow-sm`
                  : locked ? 'bg-slate-100 text-slate-400' : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200',
              ].join(' ')}
            >
              {step.icon}
            </span>
            <span className="flex flex-col leading-tight min-w-0 flex-1">
              <span className={['break-words', isActive ? 'text-slate-800 font-semibold' : 'text-slate-600'].join(' ')}>
                {idx + 1}. {step.label}
              </span>
              <span className="hidden lg:block text-xs text-slate-500 font-normal break-words whitespace-normal mt-0.5">{step.description}</span>
            </span>
            {locked && <span className="text-slate-300 text-xs hidden lg:inline shrink-0 self-start mt-1">🔒</span>}
          </button>
        );
      })}
    </div>
  );

  const renderUploadStep = () => (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xl">📤</span>
          <h2 className="font-semibold text-slate-800">Upload Reference Documents</h2>
        </div>

        <div className="rounded-2xl border-2 border-dashed border-violet-200 bg-violet-50/40 p-5 sm:p-6 flex flex-wrap items-center gap-4">
          <select className="border-2 border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:border-violet-400 focus:outline-none min-w-[220px]"
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
    return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5 sm:p-6 space-y-5">
      <div className="flex items-center gap-2">
        <span className="text-xl">🧠</span>
        <h2 className="font-semibold text-slate-800">Document Intelligence Preview</h2>
        {intelligencePreview && (
          <span className={`px-2.5 py-1 rounded-full text-sm font-semibold ${intelligencePreview.ai_augmented ? 'bg-violet-50 text-violet-700 border border-violet-200' : 'bg-slate-50 text-slate-500 border border-slate-200'}`}>
            {intelligencePreview.ai_augmented ? '✨ Enhanced by Claude' : '🧮 Deterministic analysis'}
          </span>
        )}
        {intelligencePreview && !isEditing && (
          <button onClick={() => startEdit('intelligence')}
            className="ml-auto px-3 py-1.5 text-sm font-semibold rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors inline-flex items-center gap-1.5">
            ✏️ Edit
          </button>
        )}
        {isEditing && (
          <div className="ml-auto flex items-center gap-2">
            <button onClick={cancelEdit} className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors">Cancel</button>
            <button onClick={handleSaveIntelligenceEdit} className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-violet-600 text-white hover:bg-violet-700 transition-colors">Save Changes</button>
          </div>
        )}
      </div>
      {!intelligencePreview && (
        <div className="flex items-center gap-3 bg-slate-50 rounded-xl p-4">
          <p className="text-sm text-slate-400 flex-1">Run document intelligence from the Upload step first.</p>
          <button onClick={handleAnalyze} disabled={analyzing} className="px-3.5 py-2 text-sm font-semibold rounded-xl bg-slate-800 text-white hover:bg-slate-900 transition-colors">
            {analyzing ? 'Analyzing…' : 'Run Now'}
          </button>
        </div>
      )}
      {data && (
        <>
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

          {data.ai_review && (
            <div className="rounded-xl p-4 bg-gradient-to-br from-violet-50 via-indigo-50 to-white border border-violet-100">
              <div className="flex items-center gap-2 text-violet-700 text-sm font-semibold uppercase tracking-wide mb-1.5">
                <span>✨</span> Claude AI Review
              </div>
              {data.ai_review.review_summary && (
                <p className="text-sm text-slate-700 mb-2">{data.ai_review.review_summary}</p>
              )}
              {data.ai_review.additional_notes && (
                <p className="text-sm text-slate-500 italic">{data.ai_review.additional_notes}</p>
              )}
            </div>
          )}

          {data.sow_only_mode && (
            <div className="rounded-xl p-4 bg-gradient-to-br from-amber-50 via-yellow-50 to-white border border-amber-200">
              <div className="flex items-center gap-2 text-amber-700 text-sm font-semibold uppercase tracking-wide mb-1">
                <span>⚡</span> SOW-only mode
              </div>
              <p className="text-sm text-slate-700">
                Only the Scope of Work has been uploaded — no MDR / EDDR / WBS to cross-reference.
                {data.ai_augmented
                  ? ' Claude will decide which disciplines and HSE studies are actually in scope; review the AI Scope summary below and tick / untick disciplines as needed before generating.'
                  : ' Enable BYOK / Claude on this project to let the AI decide which disciplines and HSE studies are actually in scope, or curate the discipline list manually below.'}
              </p>
            </div>
          )}

          {data.ai_scope && (
            <div className="rounded-xl p-4 bg-gradient-to-br from-indigo-50 via-violet-50 to-white border border-indigo-200">
              <div className="flex items-center gap-2 text-indigo-700 text-sm font-semibold uppercase tracking-wide mb-1.5">
                <span>🎯</span> AI Scope Assessment
                {data.ai_scope.sow_only_authoritative_applied && (
                  <span className="ml-2 text-sm font-semibold bg-violet-100 text-violet-700 border border-violet-200 rounded-full px-2 py-0.5 normal-case tracking-normal">
                    ✨ SOW is source of truth
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
            <h3 className="text-sm font-semibold text-slate-600 mb-2">Disciplines & Deliverables</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
              {Object.entries(data.disciplines || {}).map(([disc, info]) => {
                const meta = PLANNING_DISCIPLINE_META[disc] || { ...DEFAULT_DISCIPLINE_META, label: disc.replace('_', ' ') };
                const total = info.deliverables.length;
                const mentioned = info.mentioned_in_source.length;
                const pct = total ? Math.round((mentioned / total) * 100) : 0;
                const isOpen = expandedDiscipline === disc;
                const inScope = info.in_scope !== false;
                const toggleScope = () => setDraftIntelligence(prev => {
                  const next = { ...prev, disciplines: { ...prev.disciplines } };
                  next.disciplines[disc] = { ...next.disciplines[disc], in_scope: !inScope };
                  return next;
                });
                return (
                  <div key={disc}
                    className={`border rounded-xl overflow-hidden transition-all ${!inScope ? 'opacity-60 border-slate-200 bg-slate-50' : isOpen ? 'border-violet-300 shadow-sm sm:col-span-2 xl:col-span-3' : 'border-slate-200 hover:border-violet-200 hover:shadow-sm'}`}>
                    <div className="w-full flex items-center gap-3 p-3">
                      {isEditing && (
                        <label className="shrink-0 flex items-center gap-1.5 text-sm font-semibold text-slate-500 select-none cursor-pointer" title="Include this discipline in the WBS and schedule">
                          <input type="checkbox" checked={inScope} onChange={toggleScope} className="accent-violet-600" />
                          <span>Scope</span>
                        </label>
                      )}
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
                          {isEditing
                            ? 'Remove deliverables that don\'t apply to this project, or add missing ones below.'
                            : `Full deliverable checklist for ${meta.label} — items flagged as source-mentioned were detected in your uploaded documents; the rest fall back to the standard catalogue.`}
                        </p>
                        <ul className="space-y-1.5">
                          {info.deliverables.map((d, dIdx) => {
                            const wasMentioned = info.mentioned_in_source.includes(d);
                            const aiDiscovered = (info.ai_discovered || []).includes(d);
                            return (
                              <li key={`${d}-${dIdx}`} className="flex items-center gap-2 text-sm">
                                <span className={aiDiscovered ? 'text-violet-500' : wasMentioned ? 'text-emerald-600' : 'text-slate-300'}>{aiDiscovered ? '✨' : wasMentioned ? '✅' : '⬜'}</span>
                                <span className={wasMentioned || aiDiscovered ? 'text-slate-700 font-medium flex-1' : 'text-slate-500 flex-1'}>{d}</span>
                                {aiDiscovered && !isEditing && <span className="ml-auto text-sm font-semibold text-violet-600 bg-violet-50 border border-violet-100 rounded-full px-2 py-0.5">AI-discovered</span>}
                                {!aiDiscovered && wasMentioned && !isEditing && <span className="ml-auto text-sm font-semibold text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-full px-2 py-0.5">In source</span>}
                                {isEditing && (
                                  <button
                                    onClick={() => setDraftIntelligence(prev => {
                                      const next = { ...prev, disciplines: { ...prev.disciplines } };
                                      next.disciplines[disc] = {
                                        ...next.disciplines[disc],
                                        deliverables: next.disciplines[disc].deliverables.filter((_, i) => i !== dIdx),
                                      };
                                      return next;
                                    })}
                                    className="text-slate-300 hover:text-rose-600 transition-colors shrink-0"
                                    title="Remove deliverable"
                                  >🗑️</button>
                                )}
                              </li>
                            );
                          })}
                        </ul>
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

          <div>
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
          </div>

          {(data.notes || []).map((n, i) => (
            <p key={i} className="text-sm text-amber-700 italic bg-amber-50 rounded-lg px-3 py-2">⚠ {n}</p>
          ))}

          {!isEditing && (
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm font-semibold shadow-sm hover:shadow-md hover:from-violet-700 hover:to-indigo-700 transition-all disabled:opacity-40 disabled:shadow-none"
            >
              {generating ? 'Generating Schedule…' : 'Generate Full Schedule →'}
            </button>
          )}
        </>
      )}
    </div>
    );
  };


  const renderEmptyGenerationNotice = (label) => (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-10 text-center">
      <div className="text-4xl mb-3 opacity-60">🗓️</div>
      <p className="text-sm text-slate-400">
        No {label} yet — run <span className="font-semibold text-slate-600">Generate Full Schedule</span> from the Document Intelligence step.
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
    if (!generation) return renderEmptyGenerationNotice('schedule');
    const isEditing = editingSection === 'schedule';
    const rows = isEditing ? draftActivities : generation.activities;
    const criticalCount = generation.activities.filter(a => a.is_critical).length;
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xl">📅</span>
            <h2 className="font-semibold text-slate-800">Activities <span className="text-slate-400 font-normal">(v{generation.version} · {generation.activities.length} total)</span></h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-full bg-rose-50 text-rose-600 text-sm font-semibold">🔴 {criticalCount} on critical path</span>
            {!isEditing && (
              <button onClick={() => startEdit('schedule')}
                className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors inline-flex items-center gap-1.5">
                ✏️ Edit
              </button>
            )}
            {isEditing && (
              <>
                <button onClick={cancelEdit} className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors">Cancel</button>
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
                      <input type="text" value={a.name}
                        onChange={e => updateDraftActivity(a.id, 'name', e.target.value)}
                        className="w-full border border-slate-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-violet-400" />
                    ) : (<>{a.name}{a.is_milestone ? ' 🔷' : ''}</>)}
                  </td>
                  <td className="py-1.5 px-2.5 capitalize text-slate-500">{a.discipline}</td>
                  <td className="py-1.5 px-2.5">
                    {isEditing ? (
                      <input type="number" min="0" value={a.original_duration_days}
                        onChange={e => updateDraftActivity(a.id, 'original_duration_days', Number(e.target.value))}
                        className="w-16 border border-slate-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-violet-400" />
                    ) : `${a.original_duration_days}d`}
                  </td>
                  <td className="py-1.5 px-2.5">
                    {isEditing ? (
                      <input type="date" value={a.start_date || ''}
                        onChange={e => updateDraftActivity(a.id, 'start_date', e.target.value)}
                        className="border border-slate-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-violet-400" />
                    ) : a.start_date}
                  </td>
                  <td className="py-1.5 px-2.5">
                    {isEditing ? (
                      <input type="date" value={a.finish_date || ''}
                        onChange={e => updateDraftActivity(a.id, 'finish_date', e.target.value)}
                        className="border border-slate-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-violet-400" />
                    ) : a.finish_date}
                  </td>
                  <td className="py-1.5 px-2.5">{a.total_float_days}d</td>
                  <td className="py-1.5 px-2.5">{a.is_critical && <span className="px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-600 text-xs font-semibold">CRITICAL</span>}</td>
                  {isEditing && (
                    <td className="py-1.5 px-2.5 text-right whitespace-nowrap">
                      <button onClick={() => deleteDraftActivity(a.id)} title="Delete activity"
                        className="px-1.5 py-1 text-slate-400 hover:text-rose-600 transition-colors">🗑️</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {isEditing && (
          <button onClick={addDraftActivity}
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
            <button onClick={() => startEdit('eddr')}
              className="ml-auto px-3 py-1.5 text-sm font-semibold rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors inline-flex items-center gap-1.5">
              ✏️ Edit
            </button>
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
          <span className="text-xl">📝</span>
          <h2 className="font-semibold text-slate-800">Schedule Narrative</h2>
          <span className={`ml-auto px-2.5 py-1 rounded-full text-sm font-semibold ${aiAugmented ? 'bg-violet-50 text-violet-700 border border-violet-200' : 'bg-slate-50 text-slate-500 border border-slate-200'}`}>
            {aiAugmented ? '✨ Executive Summary refined by Claude' : '🧮 Deterministic narrative'}
          </span>
        </div>
        <div className="rounded-xl bg-slate-50/70 border border-slate-100 p-5">
          <pre className="whitespace-pre-wrap text-sm text-slate-700 font-sans leading-relaxed">{generation.narrative}</pre>
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

  const renderStepContent = () => {
    switch (currentStep) {
      case 'upload': return renderUploadStep();
      case 'intelligence': return renderIntelligenceStep();
      case 'wbs': return renderWbsStep();
      case 'schedule': return renderScheduleStep();
      case 'eddr': return renderEddrStep();
      case 'manhours': return renderManhoursStep();
      case 'validation': return renderValidationStep();
      case 'narrative': return renderNarrativeStep();
      case 'presentation': return renderPresentationStep();
      case 'export': return renderExportStep();
      default: return null;
    }
  };

  // ── Main render ──────────────────────────────────────────────────────────
  return (
    <div className={`min-h-screen bg-gradient-to-br from-slate-50 via-white to-violet-50/30 py-6 sm:py-8 ${canvasStyle.pagePadding} transition-[padding] duration-200`}>
      <div className={`${canvasStyle.container} mx-auto transition-[max-width] duration-200`}>
        {/* SOFT-CODED: Sub-features navigation */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {PROJECT_CONTROL_SUBFEATURES.filter(sf => sf.isActive).map((subFeature) => {
              const isCurrentPage = location.pathname === subFeature.route;
              return (
                <button
                  key={subFeature.id}
                  onClick={() => !isCurrentPage && navigate(subFeature.route)}
                  className={[
                    'group relative inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all',
                    isCurrentPage
                      ? `${subFeature.bgColor} ${subFeature.textColor} ${subFeature.borderColor} border-2 shadow-sm`
                      : `bg-white text-slate-600 border border-slate-200 ${subFeature.hoverBg} hover:border-slate-300 hover:shadow`,
                  ].join(' ')}
                  disabled={isCurrentPage}
                >
                  <span className="text-base">{subFeature.icon}</span>
                  <span className="font-mono text-[11px] opacity-70">{subFeature.number}</span>
                  <span>{subFeature.name}</span>
                </button>
              );
            })}
          </div>

          {/* Canvas width toggle — Original (reading width) vs Full Screen (near edge-to-edge) */}
          <div className="inline-flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/planning-packages/docs')}
              title="Open the workflow guide and documentation"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white border border-slate-200/80 text-violet-700 hover:bg-violet-50 hover:border-violet-200 shadow-sm transition-all"
            >
              <span>📘</span>
              <span className="hidden sm:inline">Workflow &amp; Docs</span>
            </button>

            <div className="inline-flex items-center gap-1 bg-white rounded-xl border border-slate-200/80 p-1 shadow-sm">
              {CANVAS_MODE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setCanvasMode(opt.value)}
                  title={opt.label}
                  className={[
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
                    canvasMode === opt.value
                      ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-sm'
                      : 'text-slate-500 hover:bg-slate-100',
                  ].join(' ')}
                >
                  <span>{opt.icon}</span>
                  <span className="hidden sm:inline">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Hero header */}
        <div className={`relative overflow-hidden rounded-3xl bg-gradient-to-r ${PLANNING_UI.heroGradient} p-6 sm:p-8 mb-6 shadow-lg`}>
          <div className="absolute -right-10 -top-10 w-56 h-56 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -right-24 bottom-0 w-72 h-72 rounded-full bg-white/5 blur-3xl" />
          <div className="relative flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-5">
            <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center text-3xl shrink-0 shadow-inner">
              {PLANNING_UI.heroIcon}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">RADAI Project Planning Application</h1>
              <p className="text-sm text-violet-100/90 mt-1">
                AI-assisted FEED/DEFINE schedule generation from your project reference documents.
              </p>
            </div>
            {viewMode === 'workspace' && selectedProject && (
              <div className="flex gap-2 flex-wrap sm:justify-end shrink-0">
                <div className="rounded-xl bg-white/15 backdrop-blur px-3.5 py-2 text-center min-w-[84px]">
                  <div className="text-xl font-bold text-white">{files.length}</div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-violet-50">Files</div>
                </div>
                <div className="rounded-xl bg-white/15 backdrop-blur px-3.5 py-2 text-center min-w-[84px]">
                  <div className="text-xl font-bold text-white">{generation ? generation.activities.length : '—'}</div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-violet-50">Activities</div>
                </div>
                <div className="rounded-xl bg-white/15 backdrop-blur px-3.5 py-2 text-center min-w-[84px]">
                  <div className="text-xl font-bold text-white">{generation ? `v${generation.version}` : '—'}</div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-violet-50">Version</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {renderBanner()}
        {renderAiSettingsModal()}

        {loadingProjects ? (
          <div className="bg-white rounded-2xl shadow-lg p-14 text-center text-slate-400">
            <div className="animate-pulse text-4xl mb-3">⏳</div>
            Loading planning projects…
          </div>
        ) : projects.length === 0 && !showNewProjectForm ? (
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200/80 p-14 text-center">
            <div className="text-6xl mb-4">📦</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">No Planning Projects Yet</h2>
            <p className="text-gray-600 mb-5">Create your first planning project to begin uploading reference documents.</p>
            <button onClick={() => setShowNewProjectForm(true)} className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold shadow-sm hover:shadow-md hover:from-violet-700 hover:to-indigo-700 transition-all">
              + New Planning Project
            </button>
          </div>
        ) : viewMode === 'dashboard' ? (
          renderProjectsDashboard()
        ) : (
          <>
            {showNewProjectForm && renderNewProjectForm()}
            {projects.length > 0 && renderProjectPicker()}
            {selectedProjectId && (
              <div className="flex flex-col lg:flex-row gap-5 bg-slate-50/60 rounded-3xl border border-slate-200/60 p-3 sm:p-4">
                {renderStepNav()}
                <div className="flex-1 min-w-0">{renderStepContent()}</div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default PlanningPackagePage;

