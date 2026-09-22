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
  previewCasesEndpoint: '/process-datasheet/datasheets/preview-hmb-cases/',
  executeCasesEndpoint: '/process-datasheet/datasheets/execute-hmb-cases/',
  projectSummaryEndpoint: (projectId) => `/process-datasheet/datasheets/hmb-projects/${projectId}/summary/`,
  recordsPreviewEndpoint: (projectId) => `/process-datasheet/datasheets/hmb-projects/${projectId}/records-preview/`,
  streamComparisonEndpoint: (projectId) => `/process-datasheet/datasheets/hmb-projects/${projectId}/stream-comparison/`,
  streamExportEndpoint: (projectId) => `/process-datasheet/datasheets/hmb-projects/${projectId}/stream-export/`,
  fileKey: 'master_template_file',
  acceptedExt: ['xlsx', 'xlsm'],
  maxSizeMb: 20,
};

const CASE_UPLOAD_CFG = {
  acceptedExt: ['xlsx', 'xlsm', 'csv', 'pdf'],
  maxFiles: 12,
  maxSizeMb: 50,
};

// Soft-coded UI visibility toggles for page sections.
const HMB_UI_CFG = {
  showSmartWorkflowManager: false,
  showUpdateCrossCheck: false,
};

const HMB_CASE_SLOTS = [
  'CASE A (1a)', 'CASE A (1b)', 'CASE A (2a)', 'CASE A (2b)',
  'CASE B (1a)', 'CASE B (1b)', 'CASE B (2a)', 'CASE B (2b)',
  'CASE C (1a)', 'CASE C (1b)', 'CASE C (2a)', 'CASE C (2b)',
];

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
  const [workspaceView, setWorkspaceView] = useState('upload');

  const [projects, setProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [projectError, setProjectError] = useState('');
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
  const [casePreviewResolvedName, setCasePreviewResolvedName] = useState('');
  const [casePreviewOptions, setCasePreviewOptions] = useState([]);
  const [casePreviewFileOptions, setCasePreviewFileOptions] = useState([]);
  const [casePreviewRecords, setCasePreviewRecords] = useState([]);
  const [casePreviewRelaxed, setCasePreviewRelaxed] = useState(false);
  const [showTemplateManager, setShowTemplateManager] = useState(true);
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
  const [caseAnalysisResult, setCaseAnalysisResult] = useState(null);
  const [caseAssignments, setCaseAssignments] = useState({});
  const [casePreviewConfirmed, setCasePreviewConfirmed] = useState(false);
  const caseFileInputRef = useRef(null);
  const [projectSummary, setProjectSummary] = useState(null);
  const [canvasExportError, setCanvasExportError] = useState('');
  const [comparisonStreamId, setComparisonStreamId] = useState('');
  const [comparisonData, setComparisonData] = useState(null);
  const [comparisonBusy, setComparisonBusy] = useState(false);
  const [comparisonError, setComparisonError] = useState('');

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
    const layout = templateAnalysis?.template_layout || null;
    const layoutCells = new Map(
      (Array.isArray(layout?.cells) ? layout.cells : []).map((cell) => [`${cell.row}:${cell.column}`, cell])
    );
    const isBadToken = (v) => {
      const s = String(v || '').trim().toUpperCase();
      return !s || s.startsWith('=') || s.includes('#REF!') || s.includes('HLOOKUP(');
    };
    const templateStreamColumns = Array.isArray(templateAnalysis?.stream_columns)
      ? templateAnalysis.stream_columns.filter((s) => !isBadToken(s?.stream_id))
      : [];
    const preview = casePreviewRecords.length > 0
      ? casePreviewRecords.map((item) => ({
        case_name: item.case_name,
        source_filename: item.source_filename,
        section: item.section_label,
        row: item.row_index,
        property: item.property_name,
        unit: item.unit,
        stream_id: item.source_stream_id || item.stream_id,
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
    const columnLetter = (columnIndex) => {
      let index = columnIndex;
      let result = '';
      while (index > 0) {
        index -= 1;
        result = String.fromCharCode(65 + (index % 26)) + result;
        index = Math.floor(index / 26);
      }
      return result;
    };

    const streamIdCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
    const previewStreamIds = Array.from(
      new Set(preview.map((p) => String(p.stream_id || '').trim()).filter(Boolean))
    ).sort(streamIdCollator.compare);
    const streamColumns = casePreviewRecords.length > 0
      ? previewStreamIds.map((streamId, index) => ({
        column_index: index + 4,
        column_letter: columnLetter(index + 4),
        stream_id: streamId,
        description: '',
      }))
      : templateStreamColumns;
    const canvasStreamIds = streamColumns.map((s) => String(s.stream_id || '').trim());

    const caseColumns = Array.from(new Set(
      (casePreviewRecords || [])
        .map((r) => String(r.source_filename || r.case_name || '').trim())
        .filter(Boolean)
    ));

    const valueMapExact = new Map();
    const valueMapLoose = new Map();
    const matrixValueMapExact = new Map();
    const matrixValueMapLoose = new Map();
    preview.forEach((item) => {
      const section = normalizeLabel(item.section);
      const row = String(item.row || '').trim();
      const property = normalizeProp(item.property);
      const unit = normalizeUnit(item.unit);
      const stream = String(item.stream_id || '').trim();
      const caseCol = String(item.source_filename || item.case_name || '').trim();
      const exact = `${section}::${row}::${property}::${unit}::${stream}::${caseCol}`;
      const loose = `${section}::${property}::${unit}::${stream}::${caseCol}`;
      const clean = sanitizeValue(item.value);
      if (clean === '') return;
      valueMapExact.set(exact, clean);
      valueMapLoose.set(loose, clean);
      const matrixExact = `${section}::${row}::${property}::${unit}::${stream}`;
      const matrixLoose = `${section}::${property}::${unit}::${stream}`;
      if (!matrixValueMapExact.has(matrixExact)) matrixValueMapExact.set(matrixExact, clean);
      if (!matrixValueMapLoose.has(matrixLoose)) matrixValueMapLoose.set(matrixLoose, clean);
    });

    const rows = [];
    const matrixRows = [];
    sections.forEach((section) => {
      const props = Array.isArray(section?.properties) ? section.properties : [];
      const sectionAnchor = layoutCells.get(`${section.start_row}:1`);
      const workbookSectionSpan = Math.min(
        props.length,
        Math.max(1, Number(sectionAnchor?.row_span || props.length))
      );
      props.forEach((prop, propertyIndex) => {
        const sectionKey = normalizeLabel(section.label);
        const rowKey = String(prop.row || '').trim();
        const propKey = normalizeProp(prop.property);
        const unitKey = normalizeUnit(prop.unit);

        matrixRows.push({
          section: propertyIndex < workbookSectionSpan ? (section.label || '') : '',
          sectionRowSpan: propertyIndex === 0
            ? workbookSectionSpan
            : (propertyIndex >= workbookSectionSpan ? 1 : 0),
          row: prop.row,
          property: prop.property || '',
          unit: prop.unit || '',
          streamValues: canvasStreamIds.map((resolvedStream) => {
            const exact = `${sectionKey}::${rowKey}::${propKey}::${unitKey}::${resolvedStream}`;
            const loose = `${sectionKey}::${propKey}::${unitKey}::${resolvedStream}`;
            if (matrixValueMapExact.has(exact)) return matrixValueMapExact.get(exact);
            if (matrixValueMapLoose.has(loose)) return matrixValueMapLoose.get(loose);
            return '';
          }),
        });

        const streamIdsForRows = canvasStreamIds.length > 0
          ? canvasStreamIds
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

    return {
      streamColumns,
      caseColumns,
      rows,
      matrixRows,
      layout,
      layoutCells,
    };
  }, [templateAnalysis, casePreviewRecords]);

  const masterCellStyle = useCallback((row, column, fallback = {}) => {
    const cell = templateCanvasModel.layoutCells?.get(`${row}:${column}`);
    const style = cell?.style || {};
    const border = (side) => (style[side] ? '1px solid #94a3b8' : '1px solid #cbd5e1');
    return {
      color: style.font_color ? `#${String(style.font_color).slice(-6)}` : '#0f172a',
      background: style.fill ? `#${String(style.fill).slice(-6)}` : '#ffffff',
      fontWeight: style.bold ? 700 : 400,
      fontStyle: style.italic ? 'italic' : 'normal',
      textAlign: style.horizontal || 'center',
      verticalAlign: style.vertical || 'middle',
      whiteSpace: style.wrap_text ? 'normal' : 'nowrap',
      borderTop: border('border_top'),
      borderRight: border('border_right'),
      borderBottom: border('border_bottom'),
      borderLeft: border('border_left'),
      ...fallback,
    };
  }, [templateCanvasModel.layoutCells]);

  const masterColumnWidth = useCallback((columnLetter, fallback = 13) => {
    const excelWidth = Number(templateCanvasModel.layout?.column_widths?.[columnLetter] || fallback);
    return Math.max(64, Math.min(220, Math.round(excelWidth * 7)));
  }, [templateCanvasModel.layout]);

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
    })).filter((item) => (
      item.unmatched_streams
      || item.duplicate_stream_matches
      || item.unit_mismatches
      || item.unmapped_properties
      || item.zero_filled_components
      || item.composition_sum_warnings
    ));
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

  useEffect(() => {
    if (!hydrated || loadingProjects || !activeProject?.project_id) return;
    if (projects.some((project) => project.project_id === activeProject.project_id)) return;
    const replacement = projects.find((project) => (
      (activeProject.code && project.code === activeProject.code)
      || (activeProject.name && project.name === activeProject.name)
    ));
    if (replacement) {
      setActiveProject(replacement);
      setProjectConfirmed(true);
      setProjectError('The saved project reference was refreshed to the current project.');
    } else {
      clearActiveProject();
      setProjectConfirmed(false);
      setProjectError('The previously selected project no longer exists. Select a current project.');
    }
  }, [activeProject, clearActiveProject, hydrated, loadingProjects, projects, setActiveProject]);

  const loadTemplateProfiles = useCallback(async () => {
    setLoadingProfiles(true);
    try {
      const params = activeProject?.project_id ? { project_id: activeProject.project_id } : undefined;
      const { data } = await apiClient.get(MASTER_TEMPLATE_CFG.listEndpoint, { params });
      const rows = Array.isArray(data?.results) ? data.results : [];
      const analysedId = templateAnalysis?.template_profile_id || templateAnalysis?.template_profile?.id || null;
      setTemplateProfiles(rows);
      setSelectedTemplateProfileId((prev) => {
        if (prev && rows.some((p) => p.id === prev)) return prev;
        if (analysedId && rows.some((p) => p.id === analysedId)) return analysedId;
        return rows[0]?.id || null;
      });
    } catch (err) {
      setTemplateProfiles([]);
      setSelectedTemplateProfileId(null);
      setTemplateError(err?.response?.data?.error || 'Could not load templates for this project.');
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
    setProjectError('');
    try {
      const created = await projectOrganizerService.createProject(payload);
      setShowCreate(false);
      setActiveProject(created);
      setProjectConfirmed(true);
      await loadProjects();
    } catch (err) {
      setProjectError(err?.response?.data?.error || 'Could not create project.');
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
      const retention = data?.source_stored ? ' Original retained in private storage.' : '';
      setTemplateNotice(`Saved as profile ${data?.template_profile_id || ''}.${retention}`.trim());
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

  const handleAnalyzeCases = async (incomingFiles = null) => {
    const filesToImport = Array.isArray(incomingFiles) ? incomingFiles : caseFiles;

    if (!activeProject?.project_id) {
      setCaseError('Select a project first.');
      return;
    }
    if (!filesToImport.length) {
      setCaseError('Select one or more case files.');
      return;
    }
    const resolvedTemplateProfileId = selectedTemplateProfileId || templateProfiles[0]?.id || null;
    if (!resolvedTemplateProfileId) {
      setCaseError('Analyze or select a Master template before analyzing case files.');
      setShowTemplateManager(true);
      setWorkspaceView('template');
      return;
    }

    setCaseBusy(true);
    setCaseError('');
    setCaseNotice('');
    setCaseImportResult(null);
    setCaseAnalysisResult(null);
    setCasePreviewConfirmed(false);
    try {
      const fd = new FormData();
      fd.append('project_id', activeProject.project_id);
      fd.append('template_profile_id', resolvedTemplateProfileId);
      filesToImport.forEach((file) => fd.append('case_files', file));
      const { data } = await apiClient.post(MASTER_TEMPLATE_CFG.previewCasesEndpoint, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 600000,
      });
      if (!data?.success) throw new Error(data?.error || 'File analysis failed');
      setCaseAnalysisResult(data);
      setCaseAssignments(Object.fromEntries(
        (data.files || []).map((file) => [file.filename, file.case_name || ''])
      ));
      setCaseNotice(`Analyzed ${data.files?.length || 0} file(s). Review detected mappings, then execute the import.`);
    } catch (err) {
      setCaseError(err?.response?.data?.error || err.message || 'File analysis failed.');
    } finally {
      setCaseBusy(false);
    }
  };

  const handleExecuteCases = async () => {
    if (!caseAnalysisResult?.preview_token || !casePreviewConfirmed) {
      setCaseError('Review and confirm the analyzed mappings before execution.');
      return;
    }
    const assignedCases = Object.values(caseAssignments).filter(Boolean);
    if (new Set(assignedCases).size !== assignedCases.length) {
      setCaseError('Each file must use a unique case slot.');
      return;
    }
    setCaseBusy(true);
    setCaseError('');
    setCaseNotice('Executing confirmed import...');
    try {
      const { data } = await apiClient.post(MASTER_TEMPLATE_CFG.executeCasesEndpoint, {
        preview_token: caseAnalysisResult.preview_token,
        case_assignments: caseAssignments,
      }, { timeout: 600000 });
      if (!data?.success) throw new Error(data?.error || 'Case import failed');
      setCaseImportResult(data);
      setCaseNotice(`Imported ${data.imported_file_count} file(s) and saved ${data.total_records} records.`);
      setCaseAnalysisResult(null);
      setCasePreviewConfirmed(false);
      await loadProjectSummary();
      setCasePreviewName('');
      setCasePreviewResolvedName('');
      await loadCasePreview();
      await loadStreamComparison();
    } catch (err) {
      setCaseError(err?.response?.data?.error || err.message || 'Case import failed.');
    } finally {
      setCaseBusy(false);
    }
  };

  const handleCaseFileSelection = (event) => {
    const picked = Array.from(event.target.files || []);
    if (!picked.length) return;

    const invalid = picked.find((file) => {
      const ext = (file.name.split('.').pop() || '').toLowerCase();
      return !CASE_UPLOAD_CFG.acceptedExt.includes(ext);
    });
    if (invalid) {
      setCaseError(`${invalid.name} is not a supported HMB file.`);
      if (event.target) event.target.value = '';
      return;
    }
    const oversized = picked.find((file) => file.size > CASE_UPLOAD_CFG.maxSizeMb * 1024 * 1024);
    if (oversized) {
      setCaseError(`${oversized.name} exceeds the ${CASE_UPLOAD_CFG.maxSizeMb}MB limit.`);
      if (event.target) event.target.value = '';
      return;
    }

    const merged = [...caseFiles, ...picked];
    const seen = new Set();
    const deduped = [];
    merged.forEach((file) => {
      const key = `${file.name}::${file.size}::${file.lastModified}`;
      if (seen.has(key)) return;
      seen.add(key);
      deduped.push(file);
    });
    if (deduped.length > CASE_UPLOAD_CFG.maxFiles) {
      setCaseError(`Select no more than ${CASE_UPLOAD_CFG.maxFiles} files per analysis.`);
      if (event.target) event.target.value = '';
      return;
    }

    setCaseNotice('');
    setCaseAnalysisResult(null);
    setCasePreviewConfirmed(false);
    setCaseFiles(deduped);
    setCaseError('');

    // Allow selecting the same file again in a later pick action.
    if (event.target) event.target.value = '';
  };

  const removeCaseFile = (targetFile) => {
    setCaseAnalysisResult(null);
    setCasePreviewConfirmed(false);
    setCaseFiles((prev) => prev.filter((f) => (
      !(f.name === targetFile.name && f.size === targetFile.size && f.lastModified === targetFile.lastModified)
    )));
  };

  const clearCaseFiles = () => {
    setCaseFiles([]);
    setCaseAnalysisResult(null);
    setCaseAssignments({});
    setCasePreviewConfirmed(false);
    if (caseFileInputRef.current) caseFileInputRef.current.value = '';
  };

  const exportTemplateCanvasExcel = () => {
    setCanvasExportError('');
    try {
      const streamColumns = templateCanvasModel.streamColumns || [];
      const matrixRows = templateCanvasModel.matrixRows || [];
      if (!matrixRows.length || !streamColumns.length) {
        setCanvasExportError('No canvas rows available to export.');
        return;
      }

      const templateLabel = templateProfiles.find((p) => p.id === selectedTemplateProfileId)?.template_name
        || templateProfiles.find((p) => p.id === selectedTemplateProfileId)?.source_filename
        || 'Default Master Template';
      const selectedCaseLabel = casePreviewName
        || (casePreviewResolvedName ? `Latest imported case (${casePreviewResolvedName})` : 'Latest imported case');
      const aoa = [
        ['Section', 'Property', 'Unit', 'Stream ID', ...streamColumns.slice(1).map(() => '')],
        ['', '', '', ...streamColumns.map((stream) => stream.stream_id)],
        ...matrixRows.map((row) => [
          row.section || '',
          row.property || '',
          row.unit || '',
          ...row.streamValues.map((value) => (
            value === '' || value === null || value === undefined ? '' : value
          )),
        ]),
      ];

      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws['!cols'] = [
        { wch: Number(templateCanvasModel.layout?.column_widths?.A || 15) },
        { wch: Number(templateCanvasModel.layout?.column_widths?.B || 33) },
        { wch: Number(templateCanvasModel.layout?.column_widths?.C || 15) },
        ...streamColumns.map((stream) => ({
          wch: Number(templateCanvasModel.layout?.column_widths?.[stream.column_letter] || 13),
        })),
      ];
      ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 1, c: 0 } },
        { s: { r: 0, c: 1 }, e: { r: 1, c: 1 } },
        { s: { r: 0, c: 2 }, e: { r: 1, c: 2 } },
        { s: { r: 0, c: 3 }, e: { r: 0, c: streamColumns.length + 2 } },
      ];
      matrixRows.forEach((row, index) => {
        if (row.sectionRowSpan > 1) {
          ws['!merges'].push({
            s: { r: index + 2, c: 0 },
            e: { r: index + row.sectionRowSpan + 1, c: 0 },
          });
        }
      });

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Template_Canvas');
      const metadataSheet = XLSX.utils.aoa_to_sheet([
        ['Project', activeProject?.name || 'N/A'],
        ['Template', templateLabel],
        ['Case Group', selectedCaseLabel],
        ['Exported At', new Date().toLocaleString()],
        ['Stream Count', streamColumns.length],
        ['Property Rows', matrixRows.length],
      ]);
      metadataSheet['!cols'] = [{ wch: 18 }, { wch: 48 }];
      XLSX.utils.book_append_sheet(wb, metadataSheet, 'Export_Info');

      const projectLabel = String(activeProject?.name || 'Project')
        .replace(/[^a-zA-Z0-9_-]+/g, '_')
        .replace(/^_+|_+$/g, '') || 'Project';
      const caseLabel = selectedCaseLabel
        .replace(/[^a-zA-Z0-9_-]+/g, '_')
        .replace(/^_+|_+$/g, '') || 'Latest';
      const dateLabel = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `HMB_Template_Canvas_${projectLabel}_${caseLabel}_${dateLabel}.xlsx`);
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
        limit: 50000,
        all_cases: false,
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
      setCasePreviewResolvedName(data?.case_name || casePreviewName || '');
    } catch (err) {
      setCasePreviewError(err?.response?.data?.error || err.message || 'Failed to load case preview records.');
      setCasePreviewRecords([]);
      setCasePreviewFileOptions([]);
      setCasePreviewRelaxed(false);
      setCasePreviewResolvedName('');
    } finally {
      setCasePreviewBusy(false);
    }
  }, [activeProject?.project_id, selectedTemplateProfileId, casePreviewName]);

  useEffect(() => {
    loadCasePreview();
  }, [loadCasePreview, caseImportResult]);

  useEffect(() => {
    const streams = Array.isArray(templateAnalysis?.stream_columns) ? templateAnalysis.stream_columns : [];
    if (!streams.length) {
      setComparisonStreamId('');
      return;
    }
    if (!streams.some((stream) => String(stream.stream_id) === String(comparisonStreamId))) {
      setComparisonStreamId(String(streams[0].stream_id));
    }
  }, [templateAnalysis, comparisonStreamId]);

  const loadStreamComparison = useCallback(async () => {
    if (!activeProject?.project_id || !selectedTemplateProfileId || !comparisonStreamId) {
      setComparisonData(null);
      return;
    }
    setComparisonBusy(true);
    setComparisonError('');
    try {
      const { data } = await apiClient.get(
        MASTER_TEMPLATE_CFG.streamComparisonEndpoint(activeProject.project_id),
        { params: { template_profile_id: selectedTemplateProfileId, stream_id: comparisonStreamId } }
      );
      if (!data?.success) throw new Error(data?.error || 'Failed to load stream comparison');
      setComparisonData(data);
    } catch (err) {
      setComparisonData(null);
      setComparisonError(err?.response?.data?.error || err.message || 'Failed to load stream comparison.');
    } finally {
      setComparisonBusy(false);
    }
  }, [activeProject?.project_id, selectedTemplateProfileId, comparisonStreamId]);

  useEffect(() => {
    loadStreamComparison();
  }, [loadStreamComparison, caseImportResult]);

  const exportStreamComparison = async () => {
    if (!activeProject?.project_id || !selectedTemplateProfileId || !comparisonStreamId) return;
    setComparisonBusy(true);
    setComparisonError('');
    try {
      const response = await apiClient.get(
        MASTER_TEMPLATE_CFG.streamExportEndpoint(activeProject.project_id),
        {
          params: { template_profile_id: selectedTemplateProfileId, stream_id: comparisonStreamId },
          responseType: 'blob',
        }
      );
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `HMB_Final_${comparisonStreamId}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setComparisonError(err?.response?.data?.error || err.message || 'Final Excel export failed.');
    } finally {
      setComparisonBusy(false);
    }
  };

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

        {projectError && (
          <div role="alert" style={{ marginBottom: 14, padding: '10px 12px', border: '1px solid #fecaca', borderRadius: 8, background: '#fef2f2', color: '#991b1b', fontSize: 12 }}>
            {projectError}
          </div>
        )}

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
                <ShieldCheck width={18} color={T.accent} /> Heat & Material Balance
              </div>
              <div style={{ marginTop: 6, fontSize: 12, color: '#64748b' }}>
                Upload case files, review extracted values, and export the final comparison.
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
          <div role="tablist" aria-label="HMB workspace" style={{ marginTop: 14, display: 'inline-flex', gap: 4, padding: 4, border: '1px solid #cbd5e1', borderRadius: 8, background: '#f1f5f9', maxWidth: '100%', flexWrap: 'wrap' }}>
            {[
              { key: 'upload', label: '1. Upload Cases', icon: Files },
              { key: 'review', label: '2. Review Data', icon: BarChart3 },
              { key: 'template', label: 'Template Setup', icon: Sparkles },
            ].map((item) => {
              const Icon = item.icon;
              const active = workspaceView === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    setWorkspaceView(item.key);
                    if (item.key === 'template') setShowTemplateManager(true);
                    if (item.key === 'review') setShowTemplateManager(false);
                  }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 34, border: active ? '1px solid #176b5b' : '1px solid transparent', borderRadius: 6, padding: '0 11px', background: active ? '#fff' : 'transparent', color: active ? '#176b5b' : '#475569', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}
                >
                  <Icon width={14} /> {item.label}
                </button>
              );
            })}
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gap: 16,
            alignItems: 'start',
            gridTemplateColumns: '1fr',
          }}
        >
          <div>
        <div
          style={{
            display: 'grid',
            gap: 18,
            alignItems: 'start',
            gridTemplateColumns: '1fr',
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
            display: workspaceView === 'upload' ? 'none' : 'block',
            overflow: 'hidden',
          }}>
            <div style={{
              ...UI.panelHeader,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.01em' }}>
                    {workspaceView === 'review' ? 'Review & Export' : 'Template Setup'}
                  </div>
                  <div style={{ marginTop: 4, fontSize: 12, color: T.muted }}>
                    {workspaceView === 'review'
                      ? 'Select a stream to compare imported cases and export the final workbook.'
                      : selectedTemplateProfileId
                      ? 'Template auto-applies to case imports. Open manager only if you need to replace or inspect it.'
                      : 'No template is active yet. Open manager to analyze and save a master template.'}
                  </div>
                </div>
                <div style={{ display: workspaceView === 'template' ? 'flex' : 'none', gap: 8, flexWrap: 'wrap' }}>
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
              <div style={{ display: workspaceView === 'template' ? 'block' : 'none' }}>
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
                    onChange={(e) => {
                      setCasePreviewName(e.target.value);
                      setCasePreviewResolvedName('');
                    }}
                    style={{
                      fontSize: 11,
                      border: '1px solid #cbd5e1',
                      borderRadius: 7,
                      padding: '0 8px',
                      background: '#fff',
                      minWidth: 170,
                      height: 32,
                      boxSizing: 'border-box',
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
                      padding: '0 8px',
                      height: 32,
                      boxSizing: 'border-box',
                      cursor: 'pointer',
                    }}
                  >
                    <RefreshCw width={12} /> Refresh
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
                      padding: '0 10px',
                      height: 32,
                      boxSizing: 'border-box',
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
                  {(casePreviewName || casePreviewResolvedName) ? ` from ${casePreviewName || casePreviewResolvedName}` : ''}.
                </div>
              )}

              {!casePreviewBusy && casePreviewFileOptions.length > 0 && (
                <div style={{ marginBottom: 8, fontSize: 11, color: '#334155' }}>
                  Case files detected: {casePreviewFileOptions.length}. Values are mapped to the Master stream columns.
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
                  <div style={{ maxHeight: 520, overflow: 'auto' }}>
                    <table style={{ borderCollapse: 'separate', borderSpacing: 0, fontSize: 11, tableLayout: 'fixed' }}>
                      <thead>
                        <tr>
                          <th rowSpan={2} style={{ ...masterCellStyle(1, 1), position: 'sticky', left: 0, top: 0, zIndex: 5, width: masterColumnWidth('A', 15), minWidth: masterColumnWidth('A', 15), padding: 8 }}>Section</th>
                          <th rowSpan={2} style={{ ...masterCellStyle(1, 2), position: 'sticky', left: masterColumnWidth('A', 15), top: 0, zIndex: 5, width: masterColumnWidth('B', 33), minWidth: masterColumnWidth('B', 33), padding: 8 }}>Property</th>
                          <th rowSpan={2} style={{ ...masterCellStyle(1, 3), position: 'sticky', left: masterColumnWidth('A', 15) + masterColumnWidth('B', 33), top: 0, zIndex: 5, width: masterColumnWidth('C', 15), minWidth: masterColumnWidth('C', 15), padding: 8 }}>Unit</th>
                          <th colSpan={Math.max(1, templateCanvasModel.streamColumns.length)} style={{ position: 'sticky', top: 0, zIndex: 4, padding: 7, background: '#e2e8f0', color: '#0f172a', border: '1px solid #94a3b8', textAlign: 'left' }}>
                            Stream ID
                          </th>
                        </tr>
                        <tr>
                          {templateCanvasModel.streamColumns.map((stream) => (
                            <th
                              key={`${stream.column_letter}-${stream.stream_id}`}
                              title={stream.description || `Stream ${stream.stream_id}`}
                              style={{
                                ...masterCellStyle(1, stream.column_index),
                                position: 'sticky',
                                top: 30,
                                zIndex: 4,
                                width: masterColumnWidth(stream.column_letter),
                                minWidth: masterColumnWidth(stream.column_letter),
                                padding: '7px 5px',
                                background: '#f8fafc',
                                fontWeight: 700,
                              }}
                            >
                              {stream.stream_id}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {templateCanvasModel.matrixRows.map((row) => (
                          <tr key={`${row.section}-${row.row}-${row.property}`}>
                            {row.sectionRowSpan > 0 && (
                              <td rowSpan={row.sectionRowSpan} style={{ ...masterCellStyle(row.row, 1), position: 'sticky', left: 0, zIndex: 3, width: masterColumnWidth('A', 15), minWidth: masterColumnWidth('A', 15), padding: 8, fontWeight: 700 }}>
                                {row.section}
                              </td>
                            )}
                            <td style={{ ...masterCellStyle(row.row, 2), position: 'sticky', left: masterColumnWidth('A', 15), zIndex: 2, width: masterColumnWidth('B', 33), minWidth: masterColumnWidth('B', 33), padding: 8, textAlign: 'left' }}>{row.property}</td>
                            <td style={{ ...masterCellStyle(row.row, 3), position: 'sticky', left: masterColumnWidth('A', 15) + masterColumnWidth('B', 33), zIndex: 2, width: masterColumnWidth('C', 15), minWidth: masterColumnWidth('C', 15), padding: 8 }}>{row.unit || '-'}</td>
                            {row.streamValues.map((value, idx) => (
                              <td
                                key={`${row.row}-${templateCanvasModel.streamColumns[idx]?.stream_id || idx}`}
                                style={{
                                  ...masterCellStyle(row.row, templateCanvasModel.streamColumns[idx]?.column_index || idx + 4),
                                  width: masterColumnWidth(templateCanvasModel.streamColumns[idx]?.column_letter),
                                  minWidth: masterColumnWidth(templateCanvasModel.streamColumns[idx]?.column_letter),
                                  padding: '6px 5px',
                                }}
                              >
                                {value === '' ? '' : String(value)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ padding: '7px 10px', borderTop: '1px solid #e2e8f0', background: '#f8fafc', fontSize: 11, color: '#64748b' }}>
                    Stream IDs follow the uploaded Master workbook columns; phase sections retain their workbook row groups.
                  </div>
                </div>
              )}
              </div>

              <div style={{ marginTop: 14, border: '1px solid #b9d7d0', borderRadius: 8, overflow: 'hidden' }}>
                <div style={{ padding: '12px 14px', background: '#edf7f4', borderBottom: '1px solid #b9d7d0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#123b35' }}>Compare Cases</div>
                      <div style={{ marginTop: 3, fontSize: 11, color: '#496b66' }}>
                        Compare one Master stream across the fixed case sequence and any additional imported cases.
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <select
                        aria-label="Comparison stream"
                        value={comparisonStreamId}
                        onChange={(event) => setComparisonStreamId(event.target.value)}
                        style={{ height: 34, minWidth: 190, border: '1px solid #94b8b0', borderRadius: 6, padding: '0 9px', background: '#fff', fontSize: 12 }}
                      >
                        {(templateAnalysis?.stream_columns || []).map((stream) => (
                          <option key={stream.stream_id} value={stream.stream_id}>
                            {stream.stream_id} {stream.description ? `- ${stream.description}` : ''}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={loadStreamComparison}
                        disabled={comparisonBusy || !comparisonStreamId}
                        style={{ height: 34, display: 'inline-flex', alignItems: 'center', gap: 6, justifyContent: 'center', border: '1px solid #94b8b0', borderRadius: 6, padding: '0 10px', background: '#fff', color: '#123b35', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                      >
                        <RefreshCw width={15} /> Load Comparison
                      </button>
                      <button
                        onClick={exportStreamComparison}
                        disabled={comparisonBusy || !comparisonData?.rows?.length}
                        style={{ height: 34, display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid #176b5b', borderRadius: 6, padding: '0 11px', background: '#176b5b', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                      >
                        <Files width={14} /> Export Final Excel
                      </button>
                    </div>
                  </div>
                  {comparisonData?.stream?.description && (
                    <div style={{ marginTop: 8, fontSize: 11, color: '#315b54' }}>
                      Stream {comparisonData.stream.stream_id}: {comparisonData.stream.description}
                    </div>
                  )}
                </div>

                {comparisonError && (
                  <div style={{ padding: '9px 12px', background: '#fff1f2', color: '#9f1239', fontSize: 11 }}>{comparisonError}</div>
                )}
                {comparisonData?.conflicts?.length > 0 && (
                  <div style={{ padding: '9px 12px', background: '#fffbeb', color: '#92400e', fontSize: 11 }}>
                    {comparisonData.conflicts.length} conflicting duplicate value(s) were detected. The first value is shown; review source mappings before export.
                  </div>
                )}
                {!comparisonBusy && comparisonData?.case_names?.length > 0 && (
                  <div style={{ padding: '8px 12px', borderBottom: '1px solid #d9e5e2', background: '#f8fcfb', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {comparisonData.case_names.map((caseName) => {
                      const hasData = comparisonData.rows?.some((row) => row.values?.[caseName] !== '' && row.values?.[caseName] != null);
                      return (
                        <span key={caseName} style={{ border: `1px solid ${hasData ? '#86b8ab' : '#d4d4d8'}`, borderRadius: 999, padding: '3px 7px', background: hasData ? '#e7f5f1' : '#f4f4f5', color: hasData ? '#176b5b' : '#71717a', fontSize: 10, fontWeight: 700 }}>
                          {caseName}: {hasData ? 'Imported' : 'Not imported'}
                        </span>
                      );
                    })}
                  </div>
                )}
                {comparisonBusy && (
                  <div style={{ padding: 12, color: '#496b66', fontSize: 12 }}>Loading multi-case values...</div>
                )}
                {!comparisonBusy && comparisonData?.rows?.length > 0 && (
                  <div style={{ maxHeight: 520, overflow: 'auto', background: '#fff' }}>
                    <table style={{ borderCollapse: 'separate', borderSpacing: 0, minWidth: '100%', tableLayout: 'fixed', fontSize: 11 }}>
                      <thead>
                        <tr>
                          {['Phase', 'Property', 'Unit', ...(comparisonData.case_names || [])].map((heading, index) => (
                            <th key={heading} style={{ position: 'sticky', top: 0, zIndex: index < 3 ? 3 : 2, minWidth: index === 1 ? 190 : index < 3 ? 95 : 118, padding: '8px 7px', borderRight: '1px solid #bfd4cf', borderBottom: '1px solid #94b8b0', background: index < 3 ? '#dceee9' : '#edf7f4', color: '#123b35', textAlign: index === 1 ? 'left' : 'center', fontWeight: 800 }}>
                              {heading}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {comparisonData.rows.map((row) => (
                          <tr key={`${row.section_key}-${row.row_index}`}>
                            <td style={{ padding: '6px 7px', borderRight: '1px solid #d9e5e2', borderBottom: '1px solid #e5ecea', background: '#f4faf8', fontWeight: 700, color: '#315b54' }}>{row.section}</td>
                            <td style={{ padding: '6px 7px', borderRight: '1px solid #d9e5e2', borderBottom: '1px solid #e5ecea', color: '#172b27' }}>{row.property}</td>
                            <td style={{ padding: '6px 7px', borderRight: '1px solid #d9e5e2', borderBottom: '1px solid #e5ecea', textAlign: 'center', color: '#496b66' }}>{row.unit || '-'}</td>
                            {(comparisonData.case_names || []).map((caseName) => (
                              <td key={caseName} style={{ padding: '6px 7px', borderRight: '1px solid #e5ecea', borderBottom: '1px solid #e5ecea', textAlign: 'right', color: row.values?.[caseName] === '' ? '#a8b7b3' : '#172b27', fontVariantNumeric: 'tabular-nums' }}>
                                {row.values?.[caseName] === '' || row.values?.[caseName] == null ? '-' : row.values[caseName]}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
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

            <div style={{ ...UI.panel, display: workspaceView === 'upload' ? 'block' : 'none', order: HMB_UI_CFG.showSmartWorkflowManager ? 0 : 1, borderRadius: 12, overflow: 'hidden' }}>
              <div style={{
                ...UI.panelHeader,
                fontSize: 13,
                fontWeight: 800,
                color: '#0f172a',
              }}>
                Upload Case Files
              </div>
              <div style={{ padding: 18 }}>
                <div style={{ marginBottom: 14, fontSize: 13, color: '#475569' }}>
                  Select one or more HMB files. We will preview the detected records before anything is saved.
                </div>
                <label style={{ minHeight: 130, border: '2px dashed #86b8ab', borderRadius: 8, background: '#f4faf8', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 7, padding: 18, cursor: 'pointer', textAlign: 'center' }}>
                  <Files width={28} color="#176b5b" />
                  <span style={{ fontSize: 14, fontWeight: 800, color: '#123b35' }}>
                    {caseFiles.length ? `${caseFiles.length} file(s) ready` : 'Choose HMB files'}
                  </span>
                  <span style={{ fontSize: 11, color: '#64748b' }}>Excel, CSV, or PDF · up to 50 MB each</span>
                  <input
                    ref={caseFileInputRef}
                    type="file"
                    accept=".xlsx,.xlsm,.csv,.pdf"
                    multiple
                    onChange={handleCaseFileSelection}
                    style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
                  />
                </label>
                <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
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
                    onClick={handleAnalyzeCases}
                    disabled={caseBusy || !caseFiles.length}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 8,
                      background: `linear-gradient(135deg, ${T.accent}, ${T.accentAlt})`,
                      color: '#fff', border: 'none', padding: '8px 14px', borderRadius: 8,
                      fontSize: 13, fontWeight: 600, cursor: caseBusy || !caseFiles.length ? 'not-allowed' : 'pointer',
                      opacity: caseBusy || !caseFiles.length ? 0.6 : 1,
                    }}
                  >
                    <Sparkles width={15} /> {caseBusy ? 'Analyzing...' : selectedTemplateProfileId ? 'Analyze Files' : 'Set Up Template'}
                  </button>
                  <span style={{ fontSize: 12, color: selectedTemplateProfileId ? '#176b5b' : '#92400e', fontWeight: 700 }}>
                    {selectedTemplateProfileId ? 'Master template ready' : 'Template setup required'}
                  </span>
                </div>

                {!selectedTemplateProfileId && (
                  <div style={{ marginTop: 8, fontSize: 11, color: '#92400e' }}>
                    Open Template Setup and select or analyze a Master template before case analysis.
                  </div>
                )}

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

                {caseAnalysisResult?.files?.length > 0 && (
                  <div style={{ marginTop: 12, border: '1px solid #b9d7d0', borderRadius: 8, overflow: 'hidden' }}>
                    <div style={{ padding: '9px 11px', background: '#edf7f4', borderBottom: '1px solid #b9d7d0', fontSize: 12, fontWeight: 800, color: '#123b35' }}>
                      Analysis Preview - no database changes yet
                    </div>
                    <div style={{ padding: 10, display: 'grid', gap: 9 }}>
                      <datalist id="hmb-case-slots">
                        {HMB_CASE_SLOTS.map((slot) => <option key={slot} value={slot} />)}
                      </datalist>
                      {caseAnalysisResult.files.map((file) => (
                        <div key={file.filename} style={{ border: `1px solid ${file.requires_mapping ? '#fbbf24' : '#bbd8d1'}`, borderRadius: 7, padding: 10, background: file.requires_mapping ? '#fffbeb' : '#f8fcfb' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 800, color: '#172b27' }}>{file.filename}</div>
                              <div style={{ marginTop: 3, fontSize: 11, color: '#496b66' }}>
                                {file.detected_format || 'Unknown format'} | {file.stream_count} streams | {file.record_count} records | {Math.round((file.confidence || 0) * 100)}% confidence
                              </div>
                            </div>
                            <label style={{ display: 'grid', gap: 3, fontSize: 10, fontWeight: 700, color: '#496b66' }}>
                              CASE SLOT
                              <input
                                list="hmb-case-slots"
                                value={caseAssignments[file.filename] || ''}
                                onChange={(event) => {
                                  setCaseAssignments((current) => ({ ...current, [file.filename]: event.target.value }));
                                  setCasePreviewConfirmed(false);
                                }}
                                style={{ height: 32, minWidth: 170, border: '1px solid #94b8b0', borderRadius: 6, padding: '0 8px', background: '#fff', fontSize: 12 }}
                              />
                            </label>
                          </div>
                          {file.requires_mapping && (
                            <div style={{ marginTop: 7, fontSize: 11, color: '#92400e' }}>
                              Review required: {file.assignment_error || `${file.exceptions?.unresolved_mappings_count || 0} unresolved mapping(s)`}.
                            </div>
                          )}
                          {file.sample_records?.length > 0 && (
                            <div style={{ marginTop: 7, fontSize: 11, color: '#475569' }}>
                              Sample: {file.sample_records.slice(0, 3).map((record) => `${record.stream_id} / ${record.property_name}: ${record.value_text}`).join(' | ')}
                            </div>
                          )}
                        </div>
                      ))}
                      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '9px 10px', borderRadius: 7, background: '#f1f5f9', color: '#334155', fontSize: 12, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={casePreviewConfirmed}
                          onChange={(event) => setCasePreviewConfirmed(event.target.checked)}
                          style={{ marginTop: 2 }}
                        />
                        I reviewed the detected formats, case assignments, sample values, and warnings.
                      </label>
                      <button
                        type="button"
                        onClick={handleExecuteCases}
                        disabled={caseBusy || !casePreviewConfirmed || !caseAnalysisResult.preview_token}
                        style={{ justifySelf: 'start', display: 'inline-flex', alignItems: 'center', gap: 7, height: 36, border: 'none', borderRadius: 6, padding: '0 13px', background: casePreviewConfirmed ? '#176b5b' : '#cbd5e1', color: '#fff', fontSize: 12, fontWeight: 800, cursor: casePreviewConfirmed ? 'pointer' : 'not-allowed' }}
                      >
                        <Database width={15} /> {caseBusy ? 'Executing...' : 'Execute Import'}
                      </button>
                    </div>
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

