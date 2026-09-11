/**
 * HMB Extractor
 * =============
 * Route: /engineering/process/hmb-extractor
 *
 * Thin wrapper around `DatasheetGeneratorTemplate` (same reusable UI used by
 * SDV Streams / Pressure Instrument). Standalone feature — upload a Heat &
 * Material Balance (HMB) PDF and get the extracted stream table as an
 * Excel workbook. No P&ID upload, no valve/equipment mapping required.
 *
 * Backend contract:
 *   POST /process-datasheet/datasheets/extract-hmb/   (sync, JSON)
 *
 * First adopter of the shared Project Organizer — a project must be
 * selected/created before the upload form is shown, and every successful
 * extraction is logged as cross-tool project activity (fire-and-forget).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import {
  Waves,
  Sparkles,
  Database,
  Files,
  BarChart3,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  ListChecks,
  ShieldCheck,
} from 'lucide-react';
import { FolderIcon, FolderPlusIcon } from '@heroicons/react/24/outline';
import apiClient from '../../../services/api.service';
import { PROJECT_ORGANIZER_CONFIG } from '../../../config/projectOrganizer.config';
import projectOrganizerService from '../../../services/projectOrganizerService';
import { ProjectCard, ProjectFormModal, ProjectSwitcher, useActiveProject } from '../../../components/ProjectOrganizer';

const ACTIVE_PROJECT_STORAGE_KEY = 'hmbExtractorActiveProject';
const T = PROJECT_ORGANIZER_CONFIG.defaultTheme;

const MASTER_TEMPLATE_CFG = {
  endpoint: '/process-datasheet/datasheets/analyze-hmb-master-template/',
  listEndpoint: '/process-datasheet/datasheets/hmb-master-templates/',
  detailEndpoint: (id) => `/process-datasheet/datasheets/hmb-master-templates/${id}/`,
  importCasesEndpoint: '/process-datasheet/datasheets/import-hmb-cases/',
  projectSummaryEndpoint: (projectId) => `/process-datasheet/datasheets/hmb-projects/${projectId}/summary/`,
  recordsPreviewEndpoint: (projectId) => `/process-datasheet/datasheets/hmb-projects/${projectId}/records-preview/`,
  fileKey: 'master_template_file',
  acceptedExt: ['xlsx', 'xlsm'],
  maxSizeMb: 20,
};

// Soft-coded UI visibility toggles for page sections.
const HMB_UI_CFG = {
  showSmartWorkflowManager: false,
  showUpdateCrossCheck: false,
};

const UI = {
  pageBg: 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 62%, #eef2f7 100%)',
  shellMaxWidth: 1680,
  shellPadX: 24,
  panel: {
    border: '1px solid #e2e8f0',
    borderRadius: 14,
    background: '#ffffff',
    boxShadow: '0 1px 2px rgba(15,23,42,0.05), 0 8px 24px rgba(15,23,42,0.04)',
  },
  panelHeader: {
    padding: '14px 16px',
    borderBottom: '1px solid #e2e8f0',
    background: '#f8fafc',
  },
};

const getCaseColumnLabelStorageKey = (projectId, templateProfileId) => (
  `hmbCaseColumnLabels::${projectId || 'no-project'}::${templateProfileId || 'no-template'}`
);

const SMART_WORKFLOW_STEPS = [
  { key: 'project', label: 'Select Project', icon: Database },
  { key: 'template', label: 'Analyze/Load Template', icon: Sparkles },
  { key: 'cases', label: 'Import Case Files', icon: Files },
  { key: 'summary', label: 'Review Consolidation', icon: BarChart3 },
];

// Soft-coded target schema for template alignment checks.
const HMB_EXPECTED_SCHEMA = [
  { section: 'General', property: 'Temperature', unit: 'F' },
  { section: 'General', property: 'Pressure', unit: 'psig' },
  { section: 'General', property: 'Molecular Weight', unit: '<none>' },
  { section: 'General', property: 'Mass Flow', unit: 'lb/hr' },
  { section: 'General', property: 'Vapour Fraction', unit: '<none>' },
  { section: 'Vapour', property: 'Mass Flow', unit: 'lb/hr' },
  { section: 'Vapour', property: 'Std Gas Flow', unit: 'MMSCFD' },
  { section: 'Vapour', property: 'Actual Volume Flow', unit: 'ft3/hr' },
  { section: 'Vapour', property: 'Molecular Weight', unit: '<none>' },
  { section: 'Vapour', property: 'Mass Density', unit: 'lb/ft3' },
  { section: 'Vapour', property: 'Viscosity', unit: 'cP' },
  { section: 'Vapour', property: 'Compressibility', unit: '<none>' },
  { section: 'Vapour', property: 'Thermal Conductivity', unit: 'Btu/hr-ft-F' },
  { section: 'Vapour', property: 'Mass Heat Capacity', unit: 'Btu/lb-F' },
  { section: 'Vapour', property: 'Cp/Cv (Gamma)', unit: '<none>' },
  { section: 'Light Liquid', property: 'Mass Flow', unit: 'lb/hr' },
  { section: 'Light Liquid', property: 'Standard Ideal Liquid Volume Flow', unit: 'barrel/day' },
  { section: 'Light Liquid', property: 'Actual Volume Flow', unit: 'ft3/hr' },
  { section: 'Light Liquid', property: 'Actual Volume Flow', unit: 'barrel/day' },
  { section: 'Light Liquid', property: 'Molecular Weight', unit: '<none>' },
  { section: 'Light Liquid', property: 'Mass Density', unit: 'lb/ft3' },
  { section: 'Light Liquid', property: 'Viscosity', unit: 'cP' },
  { section: 'Light Liquid', property: 'Thermal Conductivity', unit: 'Btu/hr-ft-F' },
  { section: 'Light Liquid', property: 'Mass Heat Capacity', unit: 'Btu/lb-F' },
  { section: 'Heavy Liquid', property: 'Mass Flow', unit: 'lb/hr' },
  { section: 'Heavy Liquid', property: 'Standard Ideal Liquid Volume Flow', unit: 'barrel/day' },
  { section: 'Heavy Liquid', property: 'Actual Volume Flow', unit: 'ft3/hr' },
  { section: 'Heavy Liquid', property: 'Actual Volume Flow', unit: 'barrel/day' },
  { section: 'Heavy Liquid', property: 'Molecular Weight', unit: '<none>' },
  { section: 'Heavy Liquid', property: 'Mass Density', unit: 'lb/ft3' },
  { section: 'Heavy Liquid', property: 'Viscosity', unit: 'cP' },
  { section: 'Heavy Liquid', property: 'Thermal Conductivity', unit: 'Btu/hr-ft-F' },
  { section: 'Heavy Liquid', property: 'Mass Heat Capacity', unit: 'Btu/lb-F' },
  { section: 'Composition', property: 'H2S', unit: 'mol frac.' },
  { section: 'Composition', property: 'CO2', unit: 'mol frac.' },
  { section: 'Composition', property: 'Nitrogen', unit: 'mol frac.' },
  { section: 'Composition', property: 'Methane', unit: 'mol frac.' },
  { section: 'Composition', property: 'Ethane', unit: 'mol frac.' },
  { section: 'Composition', property: 'Propane', unit: 'mol frac.' },
  { section: 'Composition', property: 'i-Butane', unit: 'mol frac.' },
  { section: 'Composition', property: 'n-Butane', unit: 'mol frac.' },
  { section: 'Composition', property: 'i-Pentane', unit: 'mol frac.' },
  { section: 'Composition', property: 'n-Pentane', unit: 'mol frac.' },
  { section: 'Composition', property: 'n-Hexane', unit: 'mol frac.' },
  { section: 'Composition', property: 'Mcyclopentan', unit: 'mol frac.' },
  { section: 'Composition', property: 'Benzene', unit: 'mol frac.' },
  { section: 'Composition', property: 'Cyclohexane', unit: 'mol frac.' },
  { section: 'Composition', property: 'n-Heptane', unit: 'mol frac.' },
  { section: 'Composition', property: 'n-Octane', unit: 'mol frac.' },
  { section: 'Composition', property: 'n-Nonane', unit: 'mol frac.' },
  { section: 'Composition', property: 'n-Decane', unit: 'mol frac.' },
  { section: 'Composition', property: 'Mubarraz-C7+_1*', unit: 'mol frac.' },
  { section: 'Composition', property: 'HAIL-C7-C10_1*', unit: 'mol frac.' },
  { section: 'Composition', property: 'HAIL-C11-C14_1*', unit: 'mol frac.' },
  { section: 'Composition', property: 'HAIL-C15-C19_1*', unit: 'mol frac.' },
  { section: 'Composition', property: 'HAIL-C20-C25_1*', unit: 'mol frac.' },
  { section: 'Composition', property: 'HAIL-C26-C29_1*', unit: 'mol frac.' },
  { section: 'Composition', property: 'HAIL-C30+_1*', unit: 'mol frac.' },
  { section: 'Composition', property: 'ARGA-Undecane+*', unit: 'mol frac.' },
  { section: 'Composition', property: 'ARGA-C7+*', unit: 'mol frac.' },
  { section: 'Composition', property: 'ARGA-C10+*', unit: 'mol frac.' },
  { section: 'Composition', property: 'ARGA-C12+*', unit: 'mol frac.' },
  { section: 'Composition', property: 'ARGA-C20+*', unit: 'mol frac.' },
  { section: 'Composition', property: 'ARGA-C30+*', unit: 'mol frac.' },
  { section: 'Composition', property: 'ARGA-C36+*', unit: 'mol frac.' },
  { section: 'Composition', property: 'H2O', unit: 'mol frac.' },
  { section: 'Composition', property: 'TEGlycol', unit: 'mol frac.' },
  { section: 'Composition', property: 'MDEAmine', unit: 'mol frac.' },
  { section: 'Composition', property: 'Total', unit: 'mol frac.' },
];

const HMBExtractorPage = () => {
  const navigate = useNavigate();
  const { activeProject, setActiveProject, clearActiveProject, hydrated } = useActiveProject(ACTIVE_PROJECT_STORAGE_KEY);
  const [projectConfirmed, setProjectConfirmed] = useState(false);

  const [projects, setProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [masterTemplateFile, setMasterTemplateFile] = useState(null);
  const [templateName, setTemplateName] = useState('');
  const [templateBusy, setTemplateBusy] = useState(false);
  const [templateError, setTemplateError] = useState('');
  const [templateNotice, setTemplateNotice] = useState('');
  const [templateAnalysis, setTemplateAnalysis] = useState(null);
  const [templateCanvasBusy, setTemplateCanvasBusy] = useState(false);
  const [casePreviewBusy, setCasePreviewBusy] = useState(false);
  const [casePreviewError, setCasePreviewError] = useState('');
  const [casePreviewName, setCasePreviewName] = useState('');
  const [casePreviewOptions, setCasePreviewOptions] = useState([]);
  const [casePreviewFileOptions, setCasePreviewFileOptions] = useState([]);
  const [casePreviewRecords, setCasePreviewRecords] = useState([]);
  const [casePreviewRelaxed, setCasePreviewRelaxed] = useState(false);
  const [caseColumnLabels, setCaseColumnLabels] = useState({});
  const [showTemplateManager, setShowTemplateManager] = useState(false);
  const [templateProfiles, setTemplateProfiles] = useState([]);
  const [selectedTemplateProfileId, setSelectedTemplateProfileId] = useState(null);
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  const [profileQuery, setProfileQuery] = useState('');
  const [profileSort, setProfileSort] = useState('updated_desc');
  const [caseFiles, setCaseFiles] = useState([]);
  const [caseBusy, setCaseBusy] = useState(false);
  const [caseError, setCaseError] = useState('');
  const [caseNotice, setCaseNotice] = useState('');
  const [caseImportResult, setCaseImportResult] = useState(null);
  const caseFileInputRef = useRef(null);
  const [projectSummary, setProjectSummary] = useState(null);
  const [canvasExportError, setCanvasExportError] = useState('');

  const filteredProfiles = useMemo(() => {
    const q = profileQuery.trim().toLowerCase();
    let rows = [...templateProfiles];
    if (q) {
      rows = rows.filter((p) =>
        (p.template_name || '').toLowerCase().includes(q)
        || (p.source_filename || '').toLowerCase().includes(q)
      );
    }
    rows.sort((a, b) => {
      if (profileSort === 'streams_desc') return (b.stream_count || 0) - (a.stream_count || 0);
      if (profileSort === 'name_asc') return (a.template_name || a.source_filename || '').localeCompare(b.template_name || b.source_filename || '');
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
    return rows;
  }, [templateProfiles, profileQuery, profileSort]);

  const templateCanvasModel = useMemo(() => {
    const sections = Array.isArray(templateAnalysis?.sections) ? templateAnalysis.sections : [];
    const isBadToken = (v) => {
      const s = String(v || '').trim().toUpperCase();
      return !s || s.startsWith('=') || s.includes('#REF!') || s.includes('HLOOKUP(');
    };
    const streamColumns = Array.isArray(templateAnalysis?.stream_columns)
      ? templateAnalysis.stream_columns.filter((s) => !isBadToken(s?.stream_id)).slice(0, 14)
      : [];
    const preview = casePreviewRecords.length > 0
      ? casePreviewRecords.map((item) => ({
        case_name: item.case_name,
        source_filename: item.source_filename,
        section: item.section_label,
        row: item.row_index,
        property: item.property_name,
        unit: item.unit,
        stream_id: item.stream_id,
        value: item.value_text,
      }))
      : (Array.isArray(templateAnalysis?.normalized_preview) ? templateAnalysis.normalized_preview : []);

    const normalizeLabel = (v) => String(v || '').trim().toLowerCase();
    const sanitizeValue = (v) => {
      const s = String(v ?? '').trim();
      if (!s) return '';
      const u = s.toUpperCase();
      if (s.startsWith('=') || u.includes('#REF!')) return '';
      return s;
    };
    const normalizeProp = (v) => normalizeLabel(v).replace(/:+$/g, '');
    const normalizeUnit = (v) => normalizeLabel(v);
    const asNum = (v) => {
      const s = String(v || '').trim();
      if (!/^\d+(\.0+)?$/.test(s)) return null;
      return Number(s);
    };

    const templateStreamIds = streamColumns.map((s) => String(s.stream_id || '').trim());
    const previewStreamIds = Array.from(new Set(preview.map((p) => String(p.stream_id || '').trim()).filter(Boolean)));
    const templateSet = new Set(templateStreamIds);

    // Heuristic mapping: if incoming case streams are ordinal numbers (1..N),
    // map them by position to template stream IDs (1001, 1008, ...).
    const streamAlias = new Map();
    const numericPreview = previewStreamIds
      .map((id) => ({ id, n: asNum(id) }))
      .filter((x) => Number.isFinite(x.n));
    const exactHits = previewStreamIds.filter((id) => templateSet.has(id)).length;
    const shouldUseOrdinalMap = previewStreamIds.length > 0
      && exactHits <= Math.max(1, Math.floor(previewStreamIds.length * 0.2))
      && numericPreview.length >= Math.max(1, Math.floor(previewStreamIds.length * 0.7));

    if (shouldUseOrdinalMap) {
      numericPreview
        .sort((a, b) => a.n - b.n)
        .forEach((entry, idx) => {
          const mapped = templateStreamIds[idx];
          if (mapped) streamAlias.set(entry.id, mapped);
        });
    }

    const mapStreamId = (id) => {
      const raw = String(id || '').trim();
      if (!raw) return raw;
      if (templateSet.has(raw)) return raw;
      if (streamAlias.has(raw)) return streamAlias.get(raw);
      return raw;
    };

    const caseColumns = Array.from(new Set(
      (casePreviewRecords || [])
        .map((r) => String(r.source_filename || r.case_name || '').trim())
        .filter(Boolean)
    ));

    const valueMapExact = new Map();
    const valueMapLoose = new Map();
    preview.forEach((item) => {
      const section = normalizeLabel(item.section);
      const row = String(item.row || '').trim();
      const property = normalizeProp(item.property);
      const unit = normalizeUnit(item.unit);
      const stream = mapStreamId(item.stream_id);
      const caseCol = String(item.source_filename || item.case_name || '').trim();
      const exact = `${section}::${row}::${property}::${unit}::${stream}::${caseCol}`;
      const loose = `${section}::${property}::${unit}::${stream}::${caseCol}`;
      const clean = sanitizeValue(item.value);
      if (clean === '') return;
      valueMapExact.set(exact, clean);
      valueMapLoose.set(loose, clean);
    });

    const rows = [];
    sections.forEach((section) => {
      const props = Array.isArray(section?.properties) ? section.properties : [];
      props.forEach((prop) => {
        const sectionKey = normalizeLabel(section.label);
        const rowKey = String(prop.row || '').trim();
        const propKey = normalizeProp(prop.property);
        const unitKey = normalizeUnit(prop.unit);

        const streamIdsForRows = templateStreamIds.length > 0
          ? templateStreamIds
          : [''];

        streamIdsForRows.forEach((resolvedStream) => {
          const cells = caseColumns.map((caseCol) => {
            const exact = `${sectionKey}::${rowKey}::${propKey}::${unitKey}::${resolvedStream}::${caseCol}`;
            const loose = `${sectionKey}::${propKey}::${unitKey}::${resolvedStream}::${caseCol}`;
            if (valueMapExact.has(exact)) return valueMapExact.get(exact);
            if (valueMapLoose.has(loose)) return valueMapLoose.get(loose);
            return '';
          });
          rows.push({
            section: section.label || '',
            row: prop.row,
            property: prop.property || '',
            unit: prop.unit || '',
            stream_id: resolvedStream,
            cells,
          });
        });
      });
    });

    return { streamColumns, caseColumns, rows };
  }, [templateAnalysis, casePreviewRecords]);

  const resolvedCaseColumnLabels = useMemo(() => {
    const next = {};
    (templateCanvasModel.caseColumns || []).forEach((key, idx) => {
      next[key] = caseColumnLabels[key] || `Case ${idx + 1}`;
    });
    return next;
  }, [templateCanvasModel.caseColumns, caseColumnLabels]);

  useEffect(() => {
    const storageKey = getCaseColumnLabelStorageKey(activeProject?.project_id, selectedTemplateProfileId);
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) {
        setCaseColumnLabels({});
        return;
      }
      const parsed = JSON.parse(raw);
      setCaseColumnLabels(parsed && typeof parsed === 'object' ? parsed : {});
    } catch (_) {
      setCaseColumnLabels({});
    }
  }, [activeProject?.project_id, selectedTemplateProfileId]);

  useEffect(() => {
    const storageKey = getCaseColumnLabelStorageKey(activeProject?.project_id, selectedTemplateProfileId);
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(caseColumnLabels || {}));
    } catch (_) {
      // best-effort persistence only
    }
  }, [activeProject?.project_id, selectedTemplateProfileId, caseColumnLabels]);

  const templateAlignmentAudit = useMemo(() => {
    const normalizeSection = (v) => String(v || '').trim().toLowerCase();
    const normalizeProp = (v) => String(v || '').trim().toLowerCase().replace(/:+$/g, '');
    const normalizeUnit = (v) => {
      const raw = String(v || '').trim().toLowerCase();
      if (!raw || raw === '-' || raw === 'none') return '<none>';
      return raw;
    };

    const actualRows = (templateCanvasModel?.rows || []).map((r) => ({
      section: normalizeSection(r.section),
      property: normalizeProp(r.property),
      unit: normalizeUnit(r.unit),
      rawSection: r.section,
      rawProperty: r.property,
      rawUnit: r.unit || '<none>',
    }));

    const unitSetByKey = new Map();
    actualRows.forEach((r) => {
      const key = `${r.section}::${r.property}`;
      if (!unitSetByKey.has(key)) unitSetByKey.set(key, new Set());
      unitSetByKey.get(key).add(r.unit);
    });

    let matched = 0;
    let unitMismatch = 0;
    const missing = [];
    const mismatches = [];

    HMB_EXPECTED_SCHEMA.forEach((item) => {
      const section = normalizeSection(item.section);
      const property = normalizeProp(item.property);
      const unit = normalizeUnit(item.unit);
      const key = `${section}::${property}`;
      const unitSet = unitSetByKey.get(key);
      if (!unitSet || unitSet.size === 0) {
        missing.push(item);
        return;
      }
      if (unitSet.has(unit)) {
        matched += 1;
        return;
      }
      unitMismatch += 1;
      mismatches.push({
        expected: item,
        actualUnits: Array.from(unitSet),
      });
    });

    const total = HMB_EXPECTED_SCHEMA.length;
    const score = total > 0 ? Math.round((matched / total) * 100) : 0;

    return {
      total,
      matched,
      missingCount: missing.length,
      unitMismatchCount: unitMismatch,
      score,
      missing,
      mismatches,
    };
  }, [templateCanvasModel]);

  const workflowState = useMemo(() => {
    const hasProject = Boolean(activeProject?.project_id);
    const hasTemplate = Boolean(selectedTemplateProfileId);
    const hasImportedCases = Boolean((projectSummary?.total_records || 0) > 0);
    const hasSummary = Boolean(projectSummary && projectSummary.case_count > 0);
    const doneCount = [hasProject, hasTemplate, hasImportedCases, hasSummary].filter(Boolean).length;
    const score = Math.round((doneCount / SMART_WORKFLOW_STEPS.length) * 100);
    return {
      hasProject,
      hasTemplate,
      hasImportedCases,
      hasSummary,
      doneCount,
      score,
    };
  }, [activeProject?.project_id, selectedTemplateProfileId, projectSummary]);

  const reviewChecklist = useMemo(() => {
    const profile = templateProfiles.find((p) => p.id === selectedTemplateProfileId);
    return [
      {
        key: 'project',
        label: 'Project linked',
        detail: activeProject?.name || 'No project selected',
        done: Boolean(activeProject?.project_id),
      },
      {
        key: 'template',
        label: 'Master template active',
        detail: profile?.template_name || profile?.source_filename || 'No template selected',
        done: Boolean(selectedTemplateProfileId),
      },
      {
        key: 'cases',
        label: 'Case files imported',
        detail: `${projectSummary?.case_count || 0} case(s), ${projectSummary?.total_records || 0} records`,
        done: Boolean((projectSummary?.total_records || 0) > 0),
      },
      {
        key: 'summary',
        label: 'Coverage generated',
        detail: projectSummary?.sections ? `${Object.keys(projectSummary.sections).length} section(s)` : 'No section summary yet',
        done: Boolean(projectSummary?.sections && Object.keys(projectSummary.sections).length > 0),
      },
    ];
  }, [activeProject?.name, activeProject?.project_id, projectSummary, selectedTemplateProfileId, templateProfiles]);

  const importExceptions = useMemo(() => {
    const files = Array.isArray(caseImportResult?.files) ? caseImportResult.files : [];
    return files.map((f) => ({
      filename: f.filename,
      case_name: f.case_name,
      unmatched_streams: (f.exceptions?.unmatched_streams || []).length,
      duplicate_stream_matches: (f.exceptions?.duplicate_stream_matches || []).length,
      unit_mismatches: (f.exceptions?.unit_mismatches || []).length,
      unmapped_properties: (f.exceptions?.unmapped_properties || []).length,
      zero_filled_components: (f.exceptions?.zero_filled_components || []).length,
      composition_sum_warnings: (f.exceptions?.composition_sum_warnings || []).length,
      sample_unmatched: (f.exceptions?.unmatched_streams || []).slice(0, 6),
    }));
  }, [caseImportResult]);

  const loadProjects = useCallback(async () => {
    setLoadingProjects(true);
    try {
      const items = await projectOrganizerService.listProjects();
      setProjects(items);
    } catch (_) {
      setProjects([]);
    } finally {
      setLoadingProjects(false);
    }
  }, []);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  const loadTemplateProfiles = useCallback(async () => {
    setLoadingProfiles(true);
    try {
      const params = activeProject?.project_id ? { project_id: activeProject.project_id } : undefined;
      const { data } = await apiClient.get(MASTER_TEMPLATE_CFG.listEndpoint, { params });
      let rows = Array.isArray(data?.results) ? data.results : [];
      if (rows.length === 0) {
        const fallback = await apiClient.get(MASTER_TEMPLATE_CFG.listEndpoint);
        rows = Array.isArray(fallback?.data?.results) ? fallback.data.results : [];
      }
      const analysedId = templateAnalysis?.template_profile_id || templateAnalysis?.template_profile?.id || null;
      setTemplateProfiles(rows);
      setSelectedTemplateProfileId((prev) => {
        if (prev && rows.some((p) => p.id === prev)) return prev;
        if (analysedId && rows.some((p) => p.id === analysedId)) return analysedId;
        return rows[0]?.id || null;
      });
    } catch (_) {
      setTemplateProfiles([]);
      setSelectedTemplateProfileId(null);
    } finally {
      setLoadingProfiles(false);
    }
  }, [activeProject?.project_id, templateAnalysis]);

  useEffect(() => { loadTemplateProfiles(); }, [loadTemplateProfiles]);

  useEffect(() => {
    if (loadingProfiles) return;
    // Keep setup controls hidden once a default template exists.
    setShowTemplateManager((prev) => (templateProfiles.length === 0 ? true : prev));
  }, [loadingProfiles, templateProfiles.length]);

  const loadProjectSummary = useCallback(async () => {
    if (!activeProject?.project_id) {
      setProjectSummary(null);
      return;
    }
    try {
      const params = selectedTemplateProfileId
        ? { template_profile_id: selectedTemplateProfileId }
        : undefined;
      const { data } = await apiClient.get(MASTER_TEMPLATE_CFG.projectSummaryEndpoint(activeProject.project_id), { params });
      if (data?.success) setProjectSummary(data);
    } catch (_) {
      setProjectSummary(null);
    }
  }, [activeProject?.project_id, selectedTemplateProfileId]);

  useEffect(() => { loadProjectSummary(); }, [loadProjectSummary]);

  const handleCreate = async (payload) => {
    setBusy(true);
    try {
      const created = await projectOrganizerService.createProject(payload);
      setShowCreate(false);
      setActiveProject(created);
      setProjectConfirmed(true);
      await loadProjects();
    } catch (err) {
      alert(err?.response?.data?.error || 'Could not create project.');
    } finally {
      setBusy(false);
    }
  };

  const validateTemplateFile = (file) => {
    if (!file) return 'Template file is required.';
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (!MASTER_TEMPLATE_CFG.acceptedExt.includes(ext)) {
      return `Template file must be ${MASTER_TEMPLATE_CFG.acceptedExt.join('/').toUpperCase()}.`;
    }
    const sizeMb = file.size / (1024 * 1024);
    if (sizeMb > MASTER_TEMPLATE_CFG.maxSizeMb) {
      return `Template file exceeds ${MASTER_TEMPLATE_CFG.maxSizeMb}MB limit.`;
    }
    return '';
  };

  const handleAnalyzeTemplate = async () => {
    const validationMsg = validateTemplateFile(masterTemplateFile);
    if (validationMsg) {
      setTemplateError(validationMsg);
      return;
    }

    setTemplateBusy(true);
    setTemplateError('');
    setTemplateAnalysis(null);
    try {
      const fd = new FormData();
      fd.append(MASTER_TEMPLATE_CFG.fileKey, masterTemplateFile);
      if (templateName.trim()) fd.append('template_name', templateName.trim());
      if (activeProject?.project_id) fd.append('project_id', activeProject.project_id);
      const { data } = await apiClient.post(MASTER_TEMPLATE_CFG.endpoint, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000,
      });
      if (!data?.success) {
        throw new Error(data?.error || 'Template analysis failed');
      }
      setTemplateAnalysis(data);
      setSelectedTemplateProfileId(data?.template_profile_id || data?.template_profile?.id || null);
      setTemplateNotice(`Saved to backend database as profile ${data?.template_profile_id || ''}`.trim());
      await loadTemplateProfiles();
      await loadProjectSummary();
    } catch (err) {
      setTemplateError(err?.response?.data?.error || err.message || 'Template analysis failed.');
    } finally {
      setTemplateBusy(false);
    }
  };

  const loadTemplateProfileDetail = useCallback(async (profileId, opts = {}) => {
    if (!profileId) return;
    const { silent = false, withNotice = false } = opts;

    if (!silent) {
      setTemplateBusy(true);
      setTemplateError('');
      setTemplateNotice('');
    } else {
      setTemplateCanvasBusy(true);
    }

    try {
      const { data } = await apiClient.get(MASTER_TEMPLATE_CFG.detailEndpoint(profileId));
      if (!data?.success) throw new Error(data?.error || 'Failed to load template profile');
      setTemplateAnalysis(data);
      setSelectedTemplateProfileId(profileId);

      if (withNotice) {
        const name = data?.template_profile?.template_name || data?.template_profile?.source_filename || profileId;
        setTemplateNotice(`Loaded saved template profile: ${name}`);
      }
      await loadProjectSummary();
    } catch (err) {
      setTemplateError(err?.response?.data?.error || err.message || 'Failed to load template profile.');
    } finally {
      if (!silent) setTemplateBusy(false);
      else setTemplateCanvasBusy(false);
    }
  }, [loadProjectSummary]);

  const handleLoadTemplateProfile = async (profileId) => {
    await loadTemplateProfileDetail(profileId, { silent: false, withNotice: true });
  };

  useEffect(() => {
    if (!selectedTemplateProfileId) return;
    const analysisProfileId = String(
      templateAnalysis?.template_profile?.id
      || templateAnalysis?.template_profile_id
      || ''
    );
    if (analysisProfileId && analysisProfileId === String(selectedTemplateProfileId)) return;
    loadTemplateProfileDetail(selectedTemplateProfileId, { silent: true, withNotice: false });
  }, [selectedTemplateProfileId, templateAnalysis, loadTemplateProfileDetail]);

  const handleImportCases = async (incomingFiles = null) => {
    const filesToImport = Array.isArray(incomingFiles) ? incomingFiles : caseFiles;

    if (!activeProject?.project_id) {
      setCaseError('Select a project first.');
      return;
    }
    if (!filesToImport.length) {
      setCaseError('Select one or more case files.');
      return;
    }

    setCaseBusy(true);
    setCaseError('');
    setCaseNotice('');
    setCaseImportResult(null);
    try {
      const fd = new FormData();
      fd.append('project_id', activeProject.project_id);
      const resolvedTemplateProfileId = selectedTemplateProfileId || templateProfiles[0]?.id || null;
      if (resolvedTemplateProfileId) {
        fd.append('template_profile_id', resolvedTemplateProfileId);
      }
      filesToImport.forEach((file) => fd.append('case_files', file));

      const postImportWithRetry = async () => {
        const maxRetries = 2;
        for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
          try {
            return await apiClient.post(MASTER_TEMPLATE_CFG.importCasesEndpoint, fd, {
              headers: { 'Content-Type': 'multipart/form-data' },
              timeout: 600000,
            });
          } catch (err) {
            const isBackendUnavailable = err?.response?.status === 503
              && err?.response?.data?.error === 'backend_unavailable';
            if (!isBackendUnavailable || attempt === maxRetries) {
              throw err;
            }
            setCaseNotice(`Backend temporarily unavailable. Retrying import (${attempt + 1}/${maxRetries})...`);
            await new Promise((resolve) => setTimeout(resolve, 4000 * (attempt + 1)));
          }
        }
        return null;
      };

      const { data } = await postImportWithRetry();
      if (!data?.success) throw new Error(data?.error || 'Case import failed');

      if (data?.template_profile_id) {
        setSelectedTemplateProfileId(data.template_profile_id);
      }
      setCaseImportResult(data);
      setCaseNotice(
        `Imported ${data.imported_file_count}/${data.source_file_count} file(s), ${data.total_records} record(s) saved.`
        + (data?.template_profile_name ? ` Template: ${data.template_profile_name}.` : '')
      );
      await loadProjectSummary();
      setCasePreviewName('');
    } catch (err) {
      setCaseError(err?.response?.data?.error || err.message || 'Case import failed.');
    } finally {
      setCaseBusy(false);
    }
  };

  const handleCaseFileSelection = (event) => {
    const picked = Array.from(event.target.files || []);
    if (!picked.length) return;

    setCaseError('');
    setCaseNotice('');
    setCaseFiles((prev) => {
      const merged = [...prev, ...picked];
      const seen = new Set();
      const deduped = [];
      merged.forEach((f) => {
        const key = `${f.name}::${f.size}::${f.lastModified}`;
        if (seen.has(key)) return;
        seen.add(key);
        deduped.push(f);
      });
      return deduped;
    });

    // Allow selecting the same file again in a later pick action.
    if (event.target) event.target.value = '';
  };

  const removeCaseFile = (targetFile) => {
    setCaseFiles((prev) => prev.filter((f) => (
      !(f.name === targetFile.name && f.size === targetFile.size && f.lastModified === targetFile.lastModified)
    )));
  };

  const clearCaseFiles = () => {
    setCaseFiles([]);
    if (caseFileInputRef.current) caseFileInputRef.current.value = '';
  };

  const resetCaseColumnLabels = () => {
    setCaseColumnLabels({});
  };

  const exportTemplateCanvasExcel = () => {
    setCanvasExportError('');
    try {
      const caseKeys = templateCanvasModel.caseColumns || [];
      const visibleRows = (templateCanvasModel.rows || []).slice(0, 120);
      if (!visibleRows.length) {
        setCanvasExportError('No canvas rows available to export.');
        return;
      }

      const header = [
        'Section',
        'Row',
        'Property',
        'Unit',
        'Stream ID',
        ...caseKeys.map((k, idx) => (resolvedCaseColumnLabels[k] || `Case ${idx + 1}`)),
      ];

      const aoa = [];
      aoa.push(['Project', activeProject?.name || 'N/A']);
      aoa.push(['Template', templateProfiles.find((p) => p.id === selectedTemplateProfileId)?.template_name
        || templateProfiles.find((p) => p.id === selectedTemplateProfileId)?.source_filename
        || 'Default Master Template']);
      aoa.push(['Exported At', new Date().toLocaleString()]);
      aoa.push([]);
      aoa.push(header);

      visibleRows.forEach((row) => {
        const cells = caseKeys.map((_, idx) => {
          const val = row.cells?.[idx];
          return val === '' || val === null || val === undefined ? '' : String(val);
        });
        aoa.push([
          row.section || '',
          row.row ?? '',
          row.property || '',
          row.unit || '',
          row.stream_id || '',
          ...cells,
        ]);
      });

      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws['!cols'] = [
        { wch: 16 },
        { wch: 8 },
        { wch: 28 },
        { wch: 14 },
        { wch: 14 },
        ...caseKeys.map(() => ({ wch: 18 })),
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Template_Canvas');

      const projectLabel = String(activeProject?.name || 'Project')
        .replace(/[^a-zA-Z0-9_-]+/g, '_')
        .replace(/^_+|_+$/g, '') || 'Project';
      const dateLabel = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `HMB_Template_Canvas_${projectLabel}_${dateLabel}.xlsx`);
    } catch (err) {
      setCanvasExportError(err?.message || 'Excel export failed.');
    }
  };

  const loadCasePreview = useCallback(async () => {
    if (!activeProject?.project_id) {
      setCasePreviewRecords([]);
      setCasePreviewOptions([]);
      return;
    }

    setCasePreviewBusy(true);
    setCasePreviewError('');
    try {
      const params = {
        limit: 20000,
        all_cases: true,
      };
      if (selectedTemplateProfileId) params.template_profile_id = selectedTemplateProfileId;
      if (casePreviewName) params.case_name = casePreviewName;

      const { data } = await apiClient.get(
        MASTER_TEMPLATE_CFG.recordsPreviewEndpoint(activeProject.project_id),
        { params }
      );
      if (!data?.success) throw new Error(data?.error || 'Failed to load case preview');

      setCasePreviewRecords(Array.isArray(data.records) ? data.records : []);
      setCasePreviewOptions(Array.isArray(data.available_cases) ? data.available_cases : []);
      setCasePreviewFileOptions(Array.isArray(data.available_case_files) ? data.available_case_files : []);
      setCasePreviewRelaxed(Boolean(data.template_filter_relaxed));
      if (!casePreviewName && data?.case_name) setCasePreviewName(data.case_name);
    } catch (err) {
      setCasePreviewError(err?.response?.data?.error || err.message || 'Failed to load case preview records.');
      setCasePreviewRecords([]);
      setCasePreviewFileOptions([]);
      setCasePreviewRelaxed(false);
    } finally {
      setCasePreviewBusy(false);
    }
  }, [activeProject?.project_id, selectedTemplateProfileId, casePreviewName]);

  useEffect(() => {
    loadCasePreview();
  }, [loadCasePreview, caseImportResult]);

  if (!hydrated || loadingProjects) {
    return <div style={{ minHeight: '100vh', background: T.pageBg }} />;
  }

  // ── Gate: require explicit project selection before showing the extractor ──
  if (!projectConfirmed) {
    return (
      <div style={{ minHeight: '100vh', background: T.pageBg, padding: '24px 32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <Waves style={{ color: T.accent }} width={26} height={26} />
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: T.text }}>HMB Extractor</h1>
        </div>
        <p style={{ margin: '0 0 20px', fontSize: 13, color: T.muted }}>
          Select or create a project before opening the extractor workspace.
        </p>

        {activeProject && (
          <div style={{
            marginBottom: 14,
            border: `1px solid ${T.accentBorder}`,
            background: '#ffffff',
            borderRadius: 10,
            padding: '10px 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            flexWrap: 'wrap',
          }}>
            <div style={{ fontSize: 12, color: T.text, fontWeight: 600 }}>
              Previously active project: {activeProject.name || activeProject.code || activeProject.project_id}
            </div>
            <button
              onClick={() => setProjectConfirmed(true)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                background: `linear-gradient(135deg, ${T.accent}, ${T.accentAlt})`,
                color: '#fff', border: 'none', padding: '8px 12px',
                borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
              }}
            >
              Continue with this project
            </button>
          </div>
        )}

        <button
          onClick={() => setShowCreate(true)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 18,
            background: `linear-gradient(135deg, ${T.accent}, ${T.accentAlt})`,
            color: '#fff', border: 'none', padding: '10px 18px',
            borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer',
          }}
        >
          <FolderPlusIcon width={18} /> New Project
        </button>

        {projects.length === 0 ? (
          <div style={{
            background: T.cardBg, padding: 50, textAlign: 'center',
            borderRadius: 12, border: `1px dashed ${T.accentBorder}`,
          }}>
            <FolderIcon width={48} style={{ color: T.accent, opacity: 0.5, margin: '0 auto 12px' }} />
            <h2 style={{ margin: 0, fontSize: 18, color: T.text }}>No projects yet</h2>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: T.muted }}>Create one to get started.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
            {projects.map((p) => (
              <ProjectCard
                key={p.project_id}
                project={p}
                theme={T}
                onOpen={() => {
                  setActiveProject(p);
                  setProjectConfirmed(true);
                }}
              />
            ))}
          </div>
        )}

        {showCreate && (
          <ProjectFormModal
            theme={T}
            busy={busy}
            onClose={() => setShowCreate(false)}
            onSubmit={handleCreate}
          />
        )}
      </div>
    );
  }

  // ── Active project selected: show the extractor with a switcher header ──
  return (
    <>
      <div style={{
        minHeight: '100vh',
        background: UI.pageBg,
        paddingBottom: 24,
      }}>
      <div style={{
        display: 'flex',
        justifyContent: 'flex-end',
        maxWidth: UI.shellMaxWidth,
        margin: '0 auto',
        padding: '16px 24px 0',
        background: 'transparent',
      }}>
        <ProjectSwitcher
          projects={projects}
          activeProject={activeProject}
          loading={loadingProjects}
          theme={T}
          onSwitch={(p) => {
            setActiveProject(p);
            setProjectConfirmed(true);
          }}
          onCreate={() => setShowCreate(true)}
          onClear={() => {
            clearActiveProject();
            setProjectConfirmed(false);
          }}
          onManage={() => navigate(PROJECT_ORGANIZER_CONFIG.routes.manage, {
            state: {
              returnTo: '/engineering/process/hmb-extractor',
              activeProjectStorageKey: ACTIVE_PROJECT_STORAGE_KEY,
            },
          })}
        />
      </div>

      <div style={{ maxWidth: UI.shellMaxWidth, margin: '0 auto', padding: `0 ${UI.shellPadX}px 12px` }}>
        <div style={{
          ...UI.panel,
          marginBottom: 16,
          padding: '16px 18px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#020617', letterSpacing: '-0.01em', display: 'flex', alignItems: 'center', gap: 8 }}>
                <ShieldCheck width={18} color={T.accent} /> HMB Review Workspace
              </div>
              <div style={{ marginTop: 6, fontSize: 12, color: '#64748b' }}>
                Cross-check template mapping, case extraction, and consolidated sections before downstream use.
              </div>
            </div>
            <div style={{
              border: '1px solid #cbd5e1',
              borderRadius: 999,
              background: '#f1f5f9',
              padding: '7px 12px',
              fontSize: 12,
              fontWeight: 700,
              color: '#0b1220',
            }}>
              Active Project: {activeProject?.name || 'N/A'}
            </div>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gap: 16,
            alignItems: 'start',
            gridTemplateColumns: HMB_UI_CFG.showUpdateCrossCheck
              ? 'minmax(0, 2.1fr) minmax(300px, 1fr)'
              : '1fr',
          }}
        >
          <div>
        <div
          style={{
            display: 'grid',
            gap: 18,
            alignItems: 'start',
            gridTemplateColumns: HMB_UI_CFG.showSmartWorkflowManager
              ? 'repeat(auto-fit, minmax(360px, 1fr))'
              : 'minmax(0, 3fr) minmax(0, 7fr)',
          }}
        >
          {HMB_UI_CFG.showSmartWorkflowManager && (
            <div style={{
              background: '#fff', borderRadius: 12, border: '1px solid #dbe3ee',
              boxShadow: '0 1px 2px rgba(15,23,42,0.06), 0 8px 24px rgba(15,23,42,0.05)', overflow: 'hidden',
            }}>
              <div style={{
                padding: '14px 16px',
                borderBottom: '1px solid #e2e8f0',
                background: '#f8fafc',
              }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 17, fontWeight: 700, color: T.text }}>Smart Workflow Manager</div>
                    <div style={{ marginTop: 4, fontSize: 12, color: T.muted }}>
                      Project-scoped template intelligence, case import, and consolidated database summary.
                    </div>
                  </div>
                  <div style={{
                    border: `1px solid ${T.accentBorder}`,
                    borderRadius: 999,
                    padding: '6px 12px',
                    background: '#fff',
                    fontSize: 12,
                    fontWeight: 700,
                    color: T.text,
                  }}>
                    Workflow Score: {workflowState.score}%
                  </div>
                </div>

                <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 8 }}>
                  {SMART_WORKFLOW_STEPS.map((step) => {
                    const Icon = step.icon;
                    const done =
                      (step.key === 'project' && workflowState.hasProject)
                      || (step.key === 'template' && workflowState.hasTemplate)
                      || (step.key === 'cases' && workflowState.hasImportedCases)
                      || (step.key === 'summary' && workflowState.hasSummary);
                    return (
                      <div key={step.key} style={{
                        border: `1px solid ${done ? 'rgba(16,185,129,0.4)' : T.accentBorder}`,
                        background: done ? 'rgba(16,185,129,0.08)' : '#fff',
                        borderRadius: 10,
                        padding: '8px 10px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                      }}>
                        <div style={{
                          width: 28,
                          height: 28,
                          borderRadius: 8,
                          background: done ? 'rgba(16,185,129,0.16)' : T.accentSoft,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}>
                          {done ? <CheckCircle2 width={16} color="#059669" /> : <Icon width={16} color={T.accent} />}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: T.text }}>{step.label}</div>
                          <div style={{ fontSize: 11, color: done ? '#047857' : T.muted }}>{done ? 'Completed' : 'Pending'}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  <button
                    onClick={loadProjectSummary}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      border: `1px solid ${T.accentBorder}`,
                      background: '#fff', color: T.text, borderRadius: 8,
                      padding: '6px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    <RefreshCw width={14} /> Refresh Summary
                  </button>
                </div>
              </div>
            </div>
          )}

          <div style={{
            ...UI.panel,
            order: HMB_UI_CFG.showSmartWorkflowManager ? 0 : 2,
            overflow: 'hidden',
          }}>
            <div style={{
              ...UI.panelHeader,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.01em' }}>Default Master Template</div>
                  <div style={{ marginTop: 4, fontSize: 12, color: T.muted }}>
                    {selectedTemplateProfileId
                      ? 'Template auto-applies to case imports. Open manager only if you need to replace or inspect it.'
                      : 'No template is active yet. Open manager to analyze and save a master template.'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    onClick={loadTemplateProfiles}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      border: `1px solid ${T.accentBorder}`,
                      background: '#fff', color: T.text, borderRadius: 8,
                      padding: '6px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    <RefreshCw width={14} /> Refresh Profiles
                  </button>
                  <button
                    onClick={() => setShowTemplateManager((v) => !v)}
                    style={{
                      border: `1px solid ${T.accentBorder}`,
                      background: '#fff',
                      color: T.text,
                      fontSize: 12,
                      fontWeight: 700,
                      borderRadius: 8,
                      padding: '6px 10px',
                      cursor: 'pointer',
                    }}
                  >
                    {showTemplateManager ? 'Hide Template Manager' : 'Manage Template'}
                  </button>
                </div>
              </div>
              {selectedTemplateProfileId && (
                <div style={{ marginTop: 8, fontSize: 12, color: '#065f46', fontWeight: 600 }}>
                  Active template: {templateProfiles.find((p) => p.id === selectedTemplateProfileId)?.template_name
                    || templateProfiles.find((p) => p.id === selectedTemplateProfileId)?.source_filename
                    || 'Loaded profile'}
                </div>
              )}
            </div>

            <div style={{
              padding: '10px 12px',
              borderTop: '1px solid #e2e8f0',
              borderBottom: '1px solid #e2e8f0',
              background: '#ffffff',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#0f172a' }}>
                  Template Canvas Preview (Master)
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <label htmlFor="hmb-case-preview" style={{ fontSize: 11, color: '#64748b', fontWeight: 700 }}>
                    Case Group
                  </label>
                  <select
                    id="hmb-case-preview"
                    value={casePreviewName}
                    onChange={(e) => setCasePreviewName(e.target.value)}
                    style={{
                      fontSize: 11,
                      border: '1px solid #cbd5e1',
                      borderRadius: 7,
                      padding: '4px 8px',
                      background: '#fff',
                      minWidth: 170,
                    }}
                  >
                    <option value="">Latest imported case</option>
                    {casePreviewOptions.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                  <button
                    onClick={loadCasePreview}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      fontSize: 11,
                      fontWeight: 700,
                      border: '1px solid #cbd5e1',
                      background: '#fff',
                      color: '#0f172a',
                      borderRadius: 7,
                      padding: '4px 8px',
                      cursor: 'pointer',
                    }}
                  >
                    <RefreshCw width={12} /> Refresh
                  </button>
                  <button
                    onClick={resetCaseColumnLabels}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      fontSize: 11,
                      fontWeight: 700,
                      border: '1px solid #cbd5e1',
                      background: '#fff',
                      color: '#0f172a',
                      borderRadius: 7,
                      padding: '4px 8px',
                      cursor: 'pointer',
                    }}
                  >
                    Reset Labels
                  </button>
                  <button
                    onClick={exportTemplateCanvasExcel}
                    disabled={templateCanvasModel.rows.length === 0}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      fontSize: 11,
                      fontWeight: 700,
                      border: '1px solid #0f766e',
                      background: templateCanvasModel.rows.length === 0 ? '#e2e8f0' : '#0f766e',
                      color: templateCanvasModel.rows.length === 0 ? '#64748b' : '#ffffff',
                      borderRadius: 7,
                      padding: '4px 8px',
                      cursor: templateCanvasModel.rows.length === 0 ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Export Excel
                  </button>
                </div>
              </div>

              {canvasExportError && (
                <div style={{ marginBottom: 8, fontSize: 11, color: '#991b1b' }}>
                  {canvasExportError}
                </div>
              )}

              {casePreviewError && (
                <div style={{ marginBottom: 8, fontSize: 11, color: '#991b1b' }}>
                  {casePreviewError}
                </div>
              )}

              {casePreviewBusy && (
                <div style={{ fontSize: 12, color: '#64748b' }}>Loading case-linked template canvas...</div>
              )}

              {!casePreviewBusy && casePreviewRecords.length > 0 && (
                <div style={{ marginBottom: 8, fontSize: 11, color: '#065f46', fontWeight: 700 }}>
                  Showing {casePreviewRecords.length} imported record(s)
                  {casePreviewName ? ` from ${casePreviewName}` : ''}.
                </div>
              )}

              {!casePreviewBusy && casePreviewFileOptions.length > 0 && (
                <div style={{ marginBottom: 8, fontSize: 11, color: '#334155' }}>
                  Case files detected: {casePreviewFileOptions.length}. Column headers are dynamic and editable.
                </div>
              )}

              {!casePreviewBusy && casePreviewRelaxed && (
                <div style={{ marginBottom: 8, fontSize: 11, color: '#92400e', fontWeight: 700 }}>
                  Note: matching records were loaded from project history because selected template-only records were not found.
                </div>
              )}

              {!casePreviewBusy && casePreviewRecords.length === 0 && (
                <div style={{ marginBottom: 8, fontSize: 11, color: '#64748b' }}>
                  No imported case rows found for this template yet. Upload case files to populate this preview.
                </div>
              )}

              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>
                This preview uses uploaded case records when available; otherwise it falls back to the saved template sample preview.
              </div>

              <div style={{ marginBottom: 10, border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
                <div style={{
                  padding: '8px 10px',
                  background: '#f8fafc',
                  borderBottom: '1px solid #e2e8f0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 10,
                  flexWrap: 'wrap',
                }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#0f172a' }}>Attribute Alignment Audit</div>
                  <div style={{ fontSize: 11, color: '#334155', fontWeight: 700 }}>
                    Score: {templateAlignmentAudit.score}%
                    {' | '}Matched: {templateAlignmentAudit.matched}/{templateAlignmentAudit.total}
                    {' | '}Missing: {templateAlignmentAudit.missingCount}
                    {' | '}Unit Mismatch: {templateAlignmentAudit.unitMismatchCount}
                  </div>
                </div>

                {(templateAlignmentAudit.missingCount > 0 || templateAlignmentAudit.unitMismatchCount > 0) ? (
                  <div style={{ padding: 10, display: 'grid', gap: 8 }}>
                    {templateAlignmentAudit.missing.slice(0, 10).map((item, idx) => (
                      <div key={`m-${item.section}-${item.property}-${idx}`} style={{
                        border: '1px solid #fde68a',
                        background: '#fffbeb',
                        color: '#92400e',
                        borderRadius: 8,
                        padding: '6px 8px',
                        fontSize: 11,
                      }}>
                        Missing: {item.section} | {item.property} | {item.unit}
                      </div>
                    ))}

                    {templateAlignmentAudit.mismatches.slice(0, 10).map((m, idx) => (
                      <div key={`u-${m.expected.section}-${m.expected.property}-${idx}`} style={{
                        border: '1px solid #fecaca',
                        background: '#fef2f2',
                        color: '#991b1b',
                        borderRadius: 8,
                        padding: '6px 8px',
                        fontSize: 11,
                      }}>
                        Unit mismatch: {m.expected.section} | {m.expected.property} | expected {m.expected.unit} | actual {m.actualUnits.join(', ')}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ padding: 10, fontSize: 11, color: '#065f46', fontWeight: 700, background: '#ecfdf5' }}>
                    Template rows are aligned with the expected attribute schema.
                  </div>
                )}
              </div>

              {templateCanvasBusy && !casePreviewBusy && (
                <div style={{ fontSize: 12, color: '#64748b' }}>Loading active template schema...</div>
              )}

              {!templateCanvasBusy && !templateAnalysis?.success && (
                <div style={{ fontSize: 12, color: '#64748b' }}>
                  No template canvas available yet. Analyze or load a template profile to preview the Master layout.
                </div>
              )}

              {!templateCanvasBusy && templateAnalysis?.success && (
                <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
                  <div style={{ maxHeight: 280, overflow: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', color: '#334155' }}>
                          <th style={{ textAlign: 'left', padding: 8, position: 'sticky', top: 0, background: '#f8fafc' }}>Section</th>
                          <th style={{ textAlign: 'left', padding: 8, position: 'sticky', top: 0, background: '#f8fafc' }}>Row</th>
                          <th style={{ textAlign: 'left', padding: 8, minWidth: 180, position: 'sticky', top: 0, background: '#f8fafc' }}>Property</th>
                          <th style={{ textAlign: 'left', padding: 8, position: 'sticky', top: 0, background: '#f8fafc' }}>Unit</th>
                          <th style={{ textAlign: 'left', padding: 8, position: 'sticky', top: 0, background: '#f8fafc' }}>Stream ID</th>
                          {templateCanvasModel.caseColumns?.map((caseName, idx) => (
                            <th
                              key={caseName}
                              style={{ textAlign: 'left', padding: 8, whiteSpace: 'nowrap', position: 'sticky', top: 0, background: '#f8fafc' }}
                            >
                              <div style={{ display: 'grid', gap: 4, minWidth: 140 }}>
                                <input
                                  type="text"
                                  value={resolvedCaseColumnLabels[caseName] || `Case ${idx + 1}`}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    setCaseColumnLabels((prev) => ({ ...prev, [caseName]: v }));
                                  }}
                                  style={{
                                    border: '1px solid #cbd5e1',
                                    borderRadius: 6,
                                    padding: '3px 6px',
                                    fontSize: 11,
                                    fontWeight: 700,
                                    color: '#0f172a',
                                    background: '#fff',
                                  }}
                                  placeholder={`Case ${idx + 1}`}
                                />
                                <div
                                  title={caseName}
                                  style={{ fontSize: 10, color: '#64748b', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                                >
                                  {caseName}
                                </div>
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {templateCanvasModel.rows.slice(0, 300).map((row) => (
                          <tr key={`${row.section}-${row.row}-${row.property}-${row.stream_id}`} style={{ borderTop: '1px solid #e2e8f0' }}>
                            <td style={{ padding: 8, color: '#0f172a', fontWeight: 600 }}>{row.section}</td>
                            <td style={{ padding: 8, color: '#334155' }}>{row.row}</td>
                            <td style={{ padding: 8, color: '#0f172a' }}>{row.property}</td>
                            <td style={{ padding: 8, color: '#475569' }}>{row.unit || '-'}</td>
                            <td style={{ padding: 8, color: '#334155', fontWeight: 600 }}>{row.stream_id || '-'}</td>
                            {row.cells.map((value, idx) => (
                              <td key={`${row.property}-${idx}`} style={{ padding: 8, color: '#334155' }}>{value === '' ? '-' : String(value)}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ padding: '7px 10px', borderTop: '1px solid #e2e8f0', background: '#f8fafc', fontSize: 11, color: '#64748b' }}>
                    Showing case-file columns next to Unit with mapped values by section/property.
                  </div>
                </div>
              )}
            </div>

            <div style={{ padding: 16, display: showTemplateManager ? 'block' : 'none', borderTop: '1px solid #e2e8f0', background: '#fcfdff' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
              <input
                type="text"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="Template name (optional)"
                style={{
                  fontSize: 13,
                  border: `1px solid ${T.accentBorder}`,
                  borderRadius: 8,
                  padding: '8px 10px',
                  minWidth: 220,
                }}
              />
              <input
                type="file"
                accept=".xlsx,.xlsm"
                onChange={(e) => {
                  setMasterTemplateFile(e.target.files?.[0] || null);
                  setTemplateError('');
                  setTemplateNotice('');
                }}
                style={{ fontSize: 13 }}
              />
              <button
                onClick={handleAnalyzeTemplate}
                disabled={templateBusy || !masterTemplateFile}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  background: `linear-gradient(135deg, ${T.accent}, ${T.accentAlt})`,
                  color: '#fff', border: 'none', padding: '8px 14px', borderRadius: 8,
                  fontSize: 13, fontWeight: 600, cursor: templateBusy || !masterTemplateFile ? 'not-allowed' : 'pointer',
                  opacity: templateBusy || !masterTemplateFile ? 0.6 : 1,
                }}
              >
                {templateBusy ? 'Analyzing...' : 'Analyze Template'}
              </button>
              {masterTemplateFile && (
                <span style={{ fontSize: 12, color: T.muted }}>
                  {masterTemplateFile.name}
                </span>
              )}
            </div>

            {templateError && (
              <div style={{
                marginTop: 12, padding: '10px 12px', borderRadius: 8,
                background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', fontSize: 12,
              }}>
                {templateError}
              </div>
            )}

            {templateNotice && (
              <div style={{
                marginTop: 12, padding: '10px 12px', borderRadius: 8,
                background: '#ecfeff', border: '1px solid #a5f3fc', color: '#155e75', fontSize: 12,
              }}>
                {templateNotice}
              </div>
            )}

            {templateAnalysis?.success && (
              <div style={{ marginTop: 14, display: 'grid', gap: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10 }}>
                  {[
                    ['Streams', templateAnalysis.summary?.stream_count],
                    ['Sections', templateAnalysis.summary?.section_count],
                    ['Property Rows', templateAnalysis.summary?.property_row_count],
                    ['Preview Records', templateAnalysis.summary?.preview_record_count],
                  ].map(([label, value]) => (
                    <div key={label} style={{
                      border: `1px solid ${T.accentBorder}`, borderRadius: 8, padding: '10px 12px', background: '#fff',
                    }}>
                      <div style={{ fontSize: 11, color: T.muted, textTransform: 'uppercase', fontWeight: 700 }}>{label}</div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: T.text }}>{value ?? 0}</div>
                    </div>
                  ))}
                </div>

                <div style={{ border: `1px solid ${T.accentBorder}`, borderRadius: 8, overflow: 'hidden' }}>
                  <div style={{ padding: '8px 10px', background: '#f8fafc', borderBottom: `1px solid ${T.accentBorder}`, fontSize: 12, fontWeight: 700, color: T.text }}>
                    Detected Sections
                  </div>
                  <div style={{ maxHeight: 220, overflow: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', color: '#334155' }}>
                          <th style={{ textAlign: 'left', padding: 8 }}>Section</th>
                          <th style={{ textAlign: 'left', padding: 8 }}>Rows</th>
                          <th style={{ textAlign: 'left', padding: 8 }}>Properties</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(templateAnalysis.sections || []).map((s) => (
                          <tr key={s.key} style={{ borderTop: '1px solid #e2e8f0' }}>
                            <td style={{ padding: 8, fontWeight: 600 }}>{s.label}</td>
                            <td style={{ padding: 8 }}>{s.start_row}-{s.end_row}</td>
                            <td style={{ padding: 8 }}>{s.property_count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div style={{ border: `1px solid ${T.accentBorder}`, borderRadius: 8, overflow: 'hidden' }}>
                  <div style={{ padding: '8px 10px', background: '#f8fafc', borderBottom: `1px solid ${T.accentBorder}`, fontSize: 12, fontWeight: 700, color: T.text }}>
                    Stream Preview
                  </div>
                  <div style={{ padding: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {(templateAnalysis.stream_columns || []).slice(0, 24).map((s) => (
                      <span key={`${s.column_letter}-${s.stream_id}`} style={{
                        fontSize: 11, fontWeight: 600, border: `1px solid ${T.accentBorder}`,
                        color: T.text, background: T.accentSoft, borderRadius: 999, padding: '4px 8px',
                      }}>
                        {s.stream_id}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
            </div>
          </div>

            <div style={{ ...UI.panel, order: HMB_UI_CFG.showSmartWorkflowManager ? 0 : 1, borderRadius: 12, overflow: 'hidden' }}>
              <div style={{
                ...UI.panelHeader,
                fontSize: 13,
                fontWeight: 800,
                color: '#0f172a',
              }}>
                Case Files Import (Database)
              </div>
              <div style={{ padding: 14 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                  <input
                    ref={caseFileInputRef}
                    type="file"
                    accept=".xlsx,.xlsm"
                    multiple
                    onChange={handleCaseFileSelection}
                    style={{ fontSize: 13 }}
                  />
                  <button
                    type="button"
                    onClick={clearCaseFiles}
                    disabled={caseBusy || !caseFiles.length}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 8,
                      background: '#fff', color: '#0f172a', border: '1px solid #cbd5e1', padding: '8px 14px', borderRadius: 8,
                      fontSize: 13, fontWeight: 600, cursor: caseBusy || !caseFiles.length ? 'not-allowed' : 'pointer',
                      opacity: caseBusy || !caseFiles.length ? 0.6 : 1,
                    }}
                  >
                    Clear Files
                  </button>
                  <button
                    onClick={handleImportCases}
                    disabled={caseBusy || !caseFiles.length}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 8,
                      background: `linear-gradient(135deg, ${T.accent}, ${T.accentAlt})`,
                      color: '#fff', border: 'none', padding: '8px 14px', borderRadius: 8,
                      fontSize: 13, fontWeight: 600, cursor: caseBusy || !caseFiles.length ? 'not-allowed' : 'pointer',
                      opacity: caseBusy || !caseFiles.length ? 0.6 : 1,
                    }}
                  >
                    {caseBusy ? 'Importing...' : 'Import Cases to DB'}
                  </button>
                  <span style={{ fontSize: 12, color: T.muted }}>
                    {caseFiles.length ? `${caseFiles.length} file(s) selected` : 'No files selected'}
                  </span>
                </div>

                {caseFiles.length > 0 && (
                  <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {caseFiles.slice(0, 12).map((f) => (
                      <span key={`${f.name}-${f.size}`} style={{
                        border: `1px solid ${T.accentBorder}`,
                        borderRadius: 999,
                        padding: '4px 8px',
                        fontSize: 11,
                        background: T.accentSoft,
                        color: T.text,
                        maxWidth: 320,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                      }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name}</span>
                        <button
                          type="button"
                          onClick={() => removeCaseFile(f)}
                          style={{
                            border: 'none',
                            background: 'transparent',
                            color: '#475569',
                            fontWeight: 700,
                            cursor: 'pointer',
                            padding: 0,
                            lineHeight: 1,
                          }}
                          title="Remove file"
                        >
                          x
                        </button>
                      </span>
                    ))}
                    {caseFiles.length > 12 && (
                      <span style={{ fontSize: 11, color: T.muted }}>
                        +{caseFiles.length - 12} more
                      </span>
                    )}
                  </div>
                )}

                {caseError && (
                  <div style={{
                    marginTop: 10, padding: '10px 12px', borderRadius: 8,
                    background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', fontSize: 12,
                  }}>
                    {caseError}
                  </div>
                )}

                {caseNotice && (
                  <div style={{
                    marginTop: 10, padding: '10px 12px', borderRadius: 8,
                    background: '#ecfeff', border: '1px solid #a5f3fc', color: '#155e75', fontSize: 12,
                  }}>
                    {caseNotice}
                  </div>
                )}

                {importExceptions.length > 0 && (
                  <div style={{ marginTop: 10, border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
                    <div style={{
                      padding: '8px 10px',
                      background: '#f8fafc',
                      borderBottom: '1px solid #e2e8f0',
                      fontSize: 12,
                      fontWeight: 700,
                      color: '#0f172a',
                    }}>
                      Exceptions Log
                    </div>
                    <div style={{ padding: 10, display: 'grid', gap: 8, maxHeight: 210, overflow: 'auto' }}>
                      {importExceptions.map((item) => (
                        <div key={`${item.filename}-${item.case_name}`} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 9px', background: '#fff' }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#0f172a' }}>{item.filename}</div>
                          <div style={{ marginTop: 3, fontSize: 11, color: '#475569' }}>
                            Case: {item.case_name || 'N/A'}
                          </div>
                          <div style={{ marginTop: 4, fontSize: 11, color: '#334155' }}>
                            Unmatched Streams: {item.unmatched_streams} | Duplicate Matches: {item.duplicate_stream_matches} | Unit Mismatches: {item.unit_mismatches}
                          </div>
                          <div style={{ marginTop: 2, fontSize: 11, color: '#334155' }}>
                            Unmapped Properties: {item.unmapped_properties} | Zero-filled Components: {item.zero_filled_components} | Composition Warnings: {item.composition_sum_warnings}
                          </div>
                          {item.sample_unmatched.length > 0 && (
                            <div style={{ marginTop: 4, fontSize: 11, color: '#92400e' }}>
                              Sample unmatched streams: {item.sample_unmatched.join(', ')}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(caseImportResult || projectSummary) && (
                  <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10 }}>
                    <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 12px', background: '#f8fafc' }}>
                      <div style={{ fontSize: 11, color: T.muted, textTransform: 'uppercase', fontWeight: 700 }}>Project Cases</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: T.text }}>{projectSummary?.case_count ?? 0}</div>
                    </div>
                    <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 12px', background: '#f8fafc' }}>
                      <div style={{ fontSize: 11, color: T.muted, textTransform: 'uppercase', fontWeight: 700 }}>Project Streams</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: T.text }}>{projectSummary?.stream_count ?? 0}</div>
                    </div>
                    <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 12px', background: '#f0fdfa' }}>
                      <div style={{ fontSize: 11, color: T.muted, textTransform: 'uppercase', fontWeight: 700 }}>Stored Records</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: T.text }}>{projectSummary?.total_records ?? 0}</div>
                    </div>
                  </div>
                )}

                {projectSummary?.sections && (
                  <div style={{ marginTop: 10, border: `1px solid ${T.accentBorder}`, borderRadius: 8, overflow: 'hidden' }}>
                    <div style={{
                      padding: '8px 10px',
                      background: '#f8fafc',
                      borderBottom: `1px solid ${T.accentBorder}`,
                      fontSize: 12,
                      fontWeight: 700,
                      color: T.text,
                    }}>
                      Consolidated Section Coverage
                    </div>
                    <div style={{ maxHeight: 160, overflow: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                          <tr style={{ background: '#f8fafc', color: '#334155' }}>
                            <th style={{ textAlign: 'left', padding: 8 }}>Section</th>
                            <th style={{ textAlign: 'left', padding: 8 }}>Records</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(projectSummary.sections).map(([key, val]) => (
                            <tr key={key} style={{ borderTop: '1px solid #e2e8f0' }}>
                              <td style={{ padding: 8, fontWeight: 600 }}>{val.label}</td>
                              <td style={{ padding: 8 }}>{val.records}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {workflowState.doneCount < SMART_WORKFLOW_STEPS.length && (
                  <div style={{
                    marginTop: 10,
                    borderRadius: 8,
                    padding: '9px 11px',
                    border: '1px solid #fde68a',
                    background: '#fffbeb',
                    color: '#92400e',
                    fontSize: 12,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}>
                    <AlertTriangle width={14} />
                    Continue workflow: complete template selection, import cases, then review consolidated summary.
                  </div>
                )}
              </div>
            </div>
        </div>
          </div>

          {HMB_UI_CFG.showUpdateCrossCheck && (
            <aside style={{
              position: 'relative',
              borderRadius: 12,
              border: '1px solid #dbe3ee',
              background: '#ffffff',
              boxShadow: '0 1px 2px rgba(15,23,42,0.06), 0 8px 24px rgba(15,23,42,0.05)',
              overflow: 'hidden',
            }}>
              <div style={{
                padding: '10px 12px',
                borderBottom: '1px solid #e2e8f0',
                background: '#f8fafc',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12,
                fontWeight: 800,
                color: T.text,
                letterSpacing: 0.3,
                textTransform: 'uppercase',
              }}>
                <ListChecks width={14} color={T.accent} /> Update Cross-Check
              </div>

              <div style={{ padding: 12, display: 'grid', gap: 8 }}>
                {reviewChecklist.map((item) => (
                  <div key={item.key} style={{
                    border: `1px solid ${item.done ? 'rgba(16,185,129,0.35)' : T.accentBorder}`,
                    borderRadius: 10,
                    background: item.done ? 'rgba(16,185,129,0.06)' : '#f8fafc',
                    padding: '8px 10px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: T.text }}>
                      <CheckCircle2 width={14} color={item.done ? '#059669' : '#94a3b8'} /> {item.label}
                    </div>
                    <div style={{ marginTop: 3, fontSize: 11, color: item.done ? '#047857' : T.muted }}>
                      {item.detail}
                    </div>
                  </div>
                ))}

                <div style={{
                  marginTop: 2,
                  border: `1px solid ${T.accentBorder}`,
                  borderRadius: 10,
                  background: '#f8fafc',
                  padding: '10px 12px',
                }}>
                  <div style={{ fontSize: 11, color: T.muted, textTransform: 'uppercase', fontWeight: 700 }}>Last Import</div>
                  <div style={{ marginTop: 4, fontSize: 12, color: T.text, fontWeight: 700 }}>
                    {caseImportResult?.imported_file_count
                      ? `${caseImportResult.imported_file_count}/${caseImportResult.source_file_count} file(s)`
                      : 'No imports yet'}
                  </div>
                  <div style={{ marginTop: 2, fontSize: 11, color: T.muted }}>
                    {caseImportResult?.template_profile_name || 'Template not confirmed yet'}
                  </div>
                </div>
              </div>
            </aside>
          )}
        </div>
      </div>
      </div>
      {showCreate && (
        <ProjectFormModal
          theme={T}
          busy={busy}
          onClose={() => setShowCreate(false)}
          onSubmit={handleCreate}
        />
      )}
    </>
  );
};

export default HMBExtractorPage;

