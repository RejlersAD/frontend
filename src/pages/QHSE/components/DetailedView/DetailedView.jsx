import { radaiAlert } from '../../../../services/radaiDialog'
import React, { useState, useMemo, useCallback } from "react";
import { useQHSERunningProjects } from '../../hooks/useQHSEProjects'; // Add this import
import {
  Paper, Typography, Box, Button, TextField, InputAdornment, IconButton, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions, DialogContentText, useMediaQuery
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import {
  AlertTriangle, Search, X, Edit, RefreshCw, Plus, Trash2,
  LayoutGrid, Table2, FolderKanban, ShieldAlert, Eye, Target, Gauge, SearchX, ShieldCheck, Users, Clock
} from "lucide-react";
import { withDashboardControls } from '../../../../hoc/withPageControls';
import { PageControlButtons } from '../../../../components/PageControlButtons';
import { qhseProjectsAPI } from '../../../../services/qhse.service';

// Import common components for consistent loading/error states
import { ErrorState } from "../Common/ErrorState"
import { EmptyDataState } from "../Common/EmptyDataState"
import { PageLayout } from '@/layouts/PageLayout';
import ProjectEditModal from '../Common/ProjectEditModal';
import CreateProjectModal from './CreateProjectModal';

// Import soft-coded column visibility configuration
import { getVisibleFieldLabels } from '../../../../config/qhseColumns.config';

// Field labels using the correct Google Sheets field names
const fieldLabels = {
  srNo: "Sr No",
  projectNo: "Project No",
  projectTitle: "Project Title",
  client: "Client",
  projectManager: "Project Manager",
  projectQualityEng: "Project Quality Engineer",
  projectStartingDate: "Project Starting Date",
  projectClosingDate: "Project Closing Date",
  projectExtension: "Project Extension",
  manHourForQuality: "Manhours for Quality",
  manhoursUsed: "Manhours Used",
  manhoursBalance: "Manhours Balance",
  qualityBillabilityPercent: "Quality Billability %",
  projectQualityPlanStatusRev: "Project Quality Plan Status - Rev",
  projectQualityPlanStatusIssueDate: "Project Quality Plan Status - Issue Date",
  projectAudit1: "Project Audit -1",
  projectAudit2: "Project Audit -2",
  projectAudit3: "Project Audit -3",
  projectAudit4: "Project Audit -4",
  clientAudit1: "Client Audit -1",
  clientAudit2: "Client Audit -2",
  delayInAuditsNoDays: "Delay in Audits - No. of Days",
  carsOpen: "CARs Open",
  carsDelayedClosingNoDays: "CARs Delayed Closing No. Days",
  carsClosed: "CARs Closed",
  obsOpen: "No. of Obs Open",
  obsDelayedClosingNoDays: "Obs Delayed Closing No. of Days",
  obsClosed: "Obs Closed",
  projectKPIsAchievedPercent: "Project KPIs Achieved %",
  projectCompletionPercent: "Project Completion %",
  remarks: "Remarks"
};

// ========================================================================
// SOFT-CODED COLUMN VISIBILITY (uses qhseColumns.config.js)
// ========================================================================

// Filter field labels to only include visible columns
const visibleFieldLabels = getVisibleFieldLabels(fieldLabels);

// Remove priority/color logic, just use allHeaders with label only
// ✅ Only include visible columns as per configuration
const allHeaders = Object.keys(visibleFieldLabels).map((key) => ({
  key,
  label: visibleFieldLabels[key] || key
}));

// ========================================================================
// PRESENTATION HELPERS (display only — no data is changed)
// ========================================================================

// Column groups shown as a second header row in the table
const COLUMN_GROUPS = [
  { groupId: 'Project', fields: ['srNo', 'projectNo', 'projectTitle', 'client'] },
  { groupId: 'Team', fields: ['projectManager', 'projectQualityEng'] },
  { groupId: 'Schedule', fields: ['projectStartingDate', 'projectClosingDate', 'projectExtension'] },
  { groupId: 'Manhours', fields: ['manHourForQuality', 'manhoursUsed', 'manhoursBalance', 'qualityBillabilityPercent'] },
  { groupId: 'Quality Plan', fields: ['projectQualityPlanStatusRev', 'projectQualityPlanStatusIssueDate'] },
  { groupId: 'Audits', fields: ['projectAudit1', 'projectAudit2', 'projectAudit3', 'projectAudit4', 'clientAudit1', 'clientAudit2', 'delayInAuditsNoDays'] },
  { groupId: 'CARs & Observations', fields: ['carsOpen', 'carsDelayedClosingNoDays', 'carsClosed', 'obsOpen', 'obsDelayedClosingNoDays', 'obsClosed'] },
  { groupId: 'Performance', fields: ['projectKPIsAchievedPercent', 'projectCompletionPercent'] },
];

const PERCENT_FIELDS = ['projectKPIsAchievedPercent', 'projectCompletionPercent', 'qualityBillabilityPercent'];
const OPEN_COUNT_FIELDS = ['carsOpen', 'obsOpen'];
const DELAY_FIELDS = ['delayInAuditsNoDays', 'carsDelayedClosingNoDays', 'obsDelayedClosingNoDays'];

// Parse "85%", "85", 0.85 → 85. Returns null when not a number.
const toPercent = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const str = String(value);
  const n = parseFloat(str.replace(/[%,\s]/g, ''));
  if (!Number.isFinite(n)) return null;
  const pct = !str.includes('%') && n > 0 && n <= 1 && str.includes('.') ? n * 100 : n;
  return Math.max(0, Math.min(100, pct));
};

const toNumber = (value) => {
  const n = parseFloat(String(value ?? '').replace(/[,\s]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

// Shared status palette (works in light and dark mode)
const TONES = {
  good: { bar: 'bg-emerald-500', pill: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/30', text: 'text-emerald-600 dark:text-emerald-400' },
  warn: { bar: 'bg-amber-500', pill: 'bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-400/30', text: 'text-amber-600 dark:text-amber-400' },
  bad: { bar: 'bg-rose-500', pill: 'bg-rose-50 text-rose-700 ring-rose-600/20 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-400/30', text: 'text-rose-600 dark:text-rose-400' },
  neutral: { bar: 'bg-slate-400', pill: 'bg-slate-50 text-slate-600 ring-slate-500/20 dark:bg-slate-500/10 dark:text-slate-300 dark:ring-slate-400/30', text: 'text-slate-500 dark:text-slate-400' },
};

const percentTone = (pct) => {
  if (pct === null) return 'neutral';
  if (pct >= 80) return 'good';
  if (pct >= 50) return 'warn';
  return 'bad';
};

const countTone = (n) => (n <= 0 ? 'good' : n <= 2 ? 'warn' : 'bad');

const Pill = ({ tone = 'neutral', children, title }) => (
  <span
    title={title}
    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset tabular-nums ${TONES[tone].pill}`}
  >
    {children}
  </span>
);

const MiniBar = ({ pct, label }) => {
  const tone = percentTone(pct);
  return (
    <div className="flex w-full items-center gap-2" title={label}>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
        <div className={`h-full rounded-full ${TONES[tone].bar} transition-all duration-500`} style={{ width: `${pct ?? 0}%` }} />
      </div>
      <span className={`w-10 text-right text-[11px] font-semibold tabular-nums ${pct === null ? 'italic text-slate-400' : TONES[tone].text}`}>
        {label}
      </span>
    </div>
  );
};

// Progress ring used in KPI cards
const Ring = ({ pct, tone }) => {
  const r = 16;
  const c = 2 * Math.PI * r;
  const stroke = { good: '#10b981', warn: '#f59e0b', bad: '#f43f5e', neutral: '#94a3b8' }[tone];
  return (
    <svg viewBox="0 0 40 40" className="h-9 w-9 shrink-0 -rotate-90 sm:h-11 sm:w-11" aria-hidden="true">
      <circle cx="20" cy="20" r={r} fill="none" strokeWidth="4" className="stroke-slate-200 dark:stroke-slate-700" />
      <circle
        cx="20" cy="20" r={r} fill="none" strokeWidth="4" strokeLinecap="round"
        stroke={stroke} strokeDasharray={c} strokeDashoffset={c - (c * (pct ?? 0)) / 100}
        style={{ transition: 'stroke-dashoffset 600ms ease' }}
      />
    </svg>
  );
};

const KpiCard = ({ icon: Icon, label, value, hint, accent, ring }) => (
  <div className="group relative min-w-0 overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-700/80 dark:bg-slate-900">
    <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${accent}`} />
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate text-[10.5px] font-semibold uppercase tracking-wide sm:tracking-wider text-slate-500 dark:text-slate-400">{label}</p>
        <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-50">{value}</p>
        {hint && <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
      </div>
      {ring ? (
        <Ring pct={ring.pct} tone={ring.tone} />
      ) : (
        <div className={`hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${accent} text-white shadow-sm sm:flex`}>
          <Icon size={20} />
        </div>
      )}
    </div>
  </div>
);

const PageHero = ({ count, children }) => (
  <header className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white via-blue-50/60 to-indigo-50/60 p-4 shadow-sm sm:p-6 dark:border-slate-700/80 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950/40">
    <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-indigo-400/10 blur-3xl dark:bg-indigo-500/20" />
    <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div className="flex min-w-0 items-start gap-3 sm:gap-4">
        <div className="shrink-0 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 p-2.5 shadow-lg shadow-indigo-500/20 sm:p-3">
          <ShieldCheck className="h-7 w-7 text-white sm:h-8 sm:w-8" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-indigo-600 dark:text-indigo-300">QHSE · General</p>
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl lg:text-3xl dark:text-slate-50">Detailed Project View</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Every running project&apos;s quality record in one place: audits, CARs, observations and KPIs.
          </p>
          {count !== undefined && (
            <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/30">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              Live data · {count} projects
            </span>
          )}
        </div>
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  </header>
);

const LoadingSkeleton = () => (
  <div className="space-y-4" aria-busy="true" aria-label="Loading detailed project data">
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 min-[1200px]:grid-cols-5">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-[92px] animate-pulse rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
          <div className="m-4 h-3 w-20 rounded bg-slate-200 dark:bg-slate-700" />
          <div className="mx-4 h-6 w-12 rounded bg-slate-200 dark:bg-slate-700" />
        </div>
      ))}
    </div>
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      <div className="h-14 border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/60" />
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex animate-pulse items-center gap-4 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
          <div className="h-3 w-10 rounded bg-slate-200 dark:bg-slate-700" />
          <div className="h-3 flex-1 rounded bg-slate-200 dark:bg-slate-700" />
          <div className="hidden h-3 w-32 rounded bg-slate-200 sm:block dark:bg-slate-700" />
          <div className="hidden h-3 w-24 rounded bg-slate-200 md:block dark:bg-slate-700" />
        </div>
      ))}
    </div>
    <p className="text-center text-sm text-slate-500 dark:text-slate-400">Loading detailed project data…</p>
  </div>
);

const NoResults = ({ searchTerm, onClear }) => (
  <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
      <SearchX size={22} />
    </div>
    <p className="font-semibold text-slate-800 dark:text-slate-100">No projects match{searchTerm ? ` "${searchTerm}"` : ''}</p>
    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Try a project number, title, client or person&apos;s name.</p>
    {searchTerm && (
      <button
        type="button"
        onClick={onClear}
        className="mt-4 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        Clear search
      </button>
    )}
  </div>
);

const DetailedView = ({ pageControls }) => {
  const { data: projectsData, loading, error, lastUpdated, refetch } = useQHSERunningProjects();
  const [searchTerm, setSearchTerm] = useState("");
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteType, setDeleteType] = useState('soft'); // 'soft' or 'hard'

  // Debug: Log first project to verify field structure (only when data exists)
  if (projectsData && projectsData.length > 0) {
    console.log('🔍 DetailedView - First project structure:', {
      srNo: projectsData[0].srNo,
      projectNo: projectsData[0].projectNo,
      projectTitle: projectsData[0].projectTitle,
      client: projectsData[0].client,
      qualityBillabilityPercent: projectsData[0].qualityBillabilityPercent,
      carsOpen: projectsData[0].carsOpen,
      obsOpen: projectsData[0].obsOpen,
      projectKPIsAchievedPercent: projectsData[0].projectKPIsAchievedPercent
    });
  }

  // Show all columns, no tabs or viewMode
  const filteredHeaders = allHeaders;

  // Smart column width calculation
  const getColumnWidth = (header) => {
    const baseWidth = header.label.length * 10;
    switch (header.key) {
      case "srNo":
        return 80;
      case "projectNo":
        return 140;
      case "projectTitle":
        return Math.max(250, baseWidth);
      case "client":
        return Math.max(150, baseWidth);
      case "projectManager":
      case "projectQualityEng":
        return Math.max(180, baseWidth);
      case "remarks":
        return 300;
      case "qualityBillabilityPercent":
      case "projectKPIsAchievedPercent":
        return 180;
      case "carsOpen":
      case "obsOpen":
      case "carsClosed":
      case "obsClosed":
        return 120;
      case "delayInAuditsNoDays":
      case "carsDelayedClosingNoDays":
      case "obsDelayedClosingNoDays":
        return 160;
      default:
        return Math.max(120, Math.min(200, baseWidth));
    }
  };

  // Enhanced empty value handling
  const formatCellValue = (value, header) => {
    if (value === null || value === undefined || value === '' || value === 'N/A' ||
        value === '#DIV/0!' || String(value).includes('#DIV/0!') || String(value).includes('#ERROR')) {
      if (header.key.includes('Percent') || header.key.includes('%')) {
        return 'N/A';
      }
      if (['carsOpen', 'obsOpen', 'carsClosed', 'obsClosed'].includes(header.key)) {
        return '0';
      }
      if (header.key.includes('manhour') || header.key.includes('manHour')) {
        return '0';
      }
      if (header.key.includes('Date')) {
        return 'TBD';
      }
      return '-';
    }
    return value;
  };

  // Enhanced rows with search filtering
  const rows = useMemo(() => {
    if (!projectsData) return [];
    let filteredData = projectsData;
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filteredData = projectsData.filter(row => {
        const searchableFields = [
          row.projectNo,
          row.projectTitle,
          row.client,
          row.projectManager,
          row.projectQualityEng
        ];
        return searchableFields.some(field =>
          field && field.toString().toLowerCase().includes(searchLower)
        );
      });
    }
    // Only include rows where srNo has a value (not empty, not 0, not undefined)
    return filteredData
      .filter(row => row.srNo && Number(row.srNo) > 0)
      .map((row) => ({
        id: row.id || row.srNo, // Use database ID or fallback to srNo
        ...row,
      }));
  }, [projectsData, searchTerm]);

  // Clear search function
  const clearSearch = () => {
    setSearchTerm("");
  };

  // Handle edit project
  const handleEditProject = (project) => {
    setSelectedProject(project);
    setEditModalOpen(true);
  };

  // Handle project update
  const handleProjectUpdate = () => {
    // Refresh data after update
    refetch();
  };

  // Handle project creation success
  const handleProjectCreateSuccess = () => {
    // Refresh data after creation
    refetch();
  };

  // Handle delete project
  const handleDeleteProject = (project) => {
    setProjectToDelete(project);
    setDeleteDialogOpen(true);
  };

  // Confirm delete project
  const confirmDeleteProject = async () => {
    if (!projectToDelete) return;

    setIsDeleting(true);
    console.log('🗑️ Deleting project:', projectToDelete.id, 'Type:', deleteType);

    try {
      // Use soft-coded API service with smart delete options
      const response = await qhseProjectsAPI.delete(projectToDelete.id, {
        hardDelete: deleteType === 'hard'
      });

      console.log('✅ Delete response:', response);

      // Close dialog and refresh data
      setDeleteDialogOpen(false);
      setProjectToDelete(null);
      setDeleteType('soft');
      refetch();

      // Show success message from API response or default message
      const message = response?.message || (deleteType === 'hard'
        ? 'Project permanently deleted from database'
        : 'Project marked as inactive (can be restored)');
      console.log('✅ ' + message);
      await radaiAlert(message);
    } catch (error) {
      console.error('❌ Error deleting project:', error);
      console.error('❌ Error details:', {
        message: error.message,
        stack: error.stack
      });
      const errorMsg = error.message || 'Failed to delete project. Please try again.';
      await radaiAlert(errorMsg);
    } finally {
      setIsDeleting(false);
    }
  };

  // Cancel delete
  const cancelDelete = () => {
    setDeleteDialogOpen(false);
    setProjectToDelete(null);
    setDeleteType('soft');
  };

  // Renders one table cell with status colours (display only)
  const renderStatusCell = (header, value) => {
    const formattedValue = formatCellValue(value, header);
    const isPlaceholder = formattedValue === 'N/A' || formattedValue === 'TBD' || formattedValue === '-';

    if (PERCENT_FIELDS.includes(header.key)) {
      return <MiniBar pct={isPlaceholder ? null : toPercent(value)} label={String(formattedValue)} />;
    }
    if (OPEN_COUNT_FIELDS.includes(header.key)) {
      return <Pill tone={countTone(toNumber(formattedValue))}>{formattedValue}</Pill>;
    }
    if (DELAY_FIELDS.includes(header.key) && !isPlaceholder) {
      const days = toNumber(formattedValue);
      return days > 0 ? <Pill tone={days > 30 ? 'bad' : 'warn'}>{formattedValue}d</Pill> : <span className="text-[11px] text-slate-400">{formattedValue}</span>;
    }
    if (header.key === 'projectNo') {
      return <span className="font-mono text-[11px] font-semibold text-indigo-700 dark:text-indigo-300">{formattedValue}</span>;
    }

    const leftAligned = ["remarks", "projectTitle"].includes(header.key);
    return (
      <span
        title={typeof formattedValue === 'string' && formattedValue.length > 30 ? formattedValue : undefined}
        className={`w-full truncate text-[11.5px] ${leftAligned ? 'text-left' : 'text-center'} ${
          isPlaceholder ? 'italic text-slate-400 dark:text-slate-500' : 'font-medium text-slate-700 dark:text-slate-100'
        } ${header.key === 'projectTitle' ? 'font-semibold text-slate-900 dark:text-white' : ''}`}
      >
        {formattedValue}
      </span>
    );
  };

  // DataGrid columns with simple rendering
  const columns = useMemo(
    () => [
      // Actions column
      {
        field: 'actions',
        headerName: 'Actions',
        width: 96,
        headerAlign: 'center',
        align: 'center',
        sortable: false,
        renderCell: (params) => (
          <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
            <Tooltip title="Edit Project">
              <IconButton
                size="small"
                aria-label="Edit project"
                onClick={() => handleEditProject(params.row)}
                sx={{ color: 'primary.main', '&:hover': { backgroundColor: 'rgba(59, 130, 246, 0.1)' } }}
              >
                <Edit size={15} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Delete Project">
              <IconButton
                size="small"
                aria-label="Delete project"
                onClick={() => handleDeleteProject(params.row)}
                sx={{
                  color: 'error.main',
                  '&:hover': {
                    backgroundColor: 'rgba(239, 68, 68, 0.1)'
                  }
                }}
              >
                <Trash2 size={15} />
              </IconButton>
            </Tooltip>
          </Box>
        ),
      },
      // Existing columns
      ...filteredHeaders.map((header) => ({
        field: header.key,
        headerName: header.label,
        description: header.label,
        width: getColumnWidth(header),
        headerAlign: "center",
        align: ["remarks", "projectTitle"].includes(header.key) ? "left" : "center",
        sortable: true,
        resizable: true,
        renderCell: (params) => renderStatusCell(header, params.value),
      })),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filteredHeaders]
  );

  // Column groups limited to the columns that are actually visible
  const columnGroupingModel = useMemo(() => {
    const visible = new Set(filteredHeaders.map((h) => h.key));
    return COLUMN_GROUPS
      .map((g) => ({
        groupId: g.groupId,
        headerClassName: 'qhse-group-header',
        children: g.fields.filter((f) => visible.has(f)).map((field) => ({ field })),
      }))
      .filter((g) => g.children.length > 0);
  }, [filteredHeaders]);

  // KPI summary for the projects in view (follows the search)
  const kpis = useMemo(() => {
    const avg = (key) => {
      const vals = rows.map((r) => toPercent(r[key])).filter((v) => v !== null);
      return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
    };
    return {
      projects: rows.length,
      carsOpen: rows.reduce((s, r) => s + toNumber(r.carsOpen), 0),
      obsOpen: rows.reduce((s, r) => s + toNumber(r.obsOpen), 0),
      withOpenItems: rows.filter((r) => toNumber(r.carsOpen) + toNumber(r.obsOpen) > 0).length,
      kpiAvg: avg('projectKPIsAchievedPercent'),
      completionAvg: avg('projectCompletionPercent'),
    };
  }, [rows]);

  // Loading state
  if (loading) {
    return (
      <PageLayout>
        <PageHero />
        <LoadingSkeleton />
      </PageLayout>
    );
  }

  // Error state
  if (error) {
    return (
      <PageLayout>
        <PageHero />
        <ErrorState error={error} onRetry={refetch} />
      </PageLayout>
    );
  }

  // Empty state
  if (!projectsData || projectsData.length === 0) {
    return (
      <PageLayout>
        <PageHero />
        <EmptyDataState />
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <PageHero count={projectsData.length}>
        <PageControlButtons controls={pageControls} />
        {lastUpdated && (
          <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
            <Clock size={12} />
            {new Date(lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </PageHero>

      {/* KPI summary */}
      <section aria-label="Summary" className="grid grid-cols-2 gap-3 sm:grid-cols-3 min-[1200px]:grid-cols-5">
        <KpiCard
          icon={FolderKanban} label="Projects in view" value={kpis.projects}
          hint={searchTerm ? `of ${projectsData.length} total` : `${kpis.withOpenItems} with open items`}
          accent="from-blue-500 to-indigo-600"
        />
        <KpiCard
          icon={ShieldAlert} label="Open CARs" value={kpis.carsOpen}
          hint={kpis.carsOpen === 0 ? 'All clear' : 'Corrective actions'}
          accent={kpis.carsOpen === 0 ? 'from-emerald-500 to-teal-500' : 'from-rose-500 to-orange-500'}
        />
        <KpiCard
          icon={Eye} label="Open observations" value={kpis.obsOpen}
          hint={kpis.obsOpen === 0 ? 'All clear' : 'Awaiting closure'}
          accent={kpis.obsOpen === 0 ? 'from-emerald-500 to-teal-500' : 'from-amber-500 to-yellow-500'}
        />
        <KpiCard
          icon={Target} label="Avg KPIs achieved" value={kpis.kpiAvg === null ? 'N/A' : `${kpis.kpiAvg}%`}
          hint="Across projects in view" accent="from-violet-500 to-fuchsia-500"
          ring={{ pct: kpis.kpiAvg, tone: percentTone(kpis.kpiAvg) }}
        />
        <div className="col-span-2 sm:col-span-1">
          <KpiCard
            icon={Gauge} label="Avg completion" value={kpis.completionAvg === null ? 'N/A' : `${kpis.completionAvg}%`}
            hint="Across projects in view" accent="from-sky-500 to-cyan-500"
            ring={{ pct: kpis.completionAvg, tone: percentTone(kpis.completionAvg) }}
          />
        </div>
      </section>

      <DetailedViewContent
        projectsData={projectsData}
        rows={rows}
        columns={columns}
        columnGroupingModel={columnGroupingModel}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        clearSearch={clearSearch}
        filteredHeaders={filteredHeaders}
        onCreateProject={() => setCreateModalOpen(true)}
        onEditProject={handleEditProject}
        onDeleteProject={handleDeleteProject}
        formatCellValue={formatCellValue}
      />

      {/* Edit Modal */}
      <ProjectEditModal
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        project={selectedProject}
        onUpdate={handleProjectUpdate}
      />

      {/* Create Modal */}
      <CreateProjectModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={handleProjectCreateSuccess}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={cancelDelete}
        PaperProps={{
          sx: {
            borderRadius: 3,
            width: '100%',
            maxWidth: 520,
            m: 2,
            '.dark &': { backgroundColor: 'rgb(15 23 42)', color: 'rgb(241 245 249)' }
          }
        }}
      >
        <DialogTitle sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          pb: 1
        }}>
          <AlertTriangle size={24} color="#ef4444" />
          <Typography variant="h6" component="span" sx={{ fontWeight: 600 }}>
            Confirm Delete
          </Typography>
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: 'text.primary', mb: 2, '.dark &': { color: 'rgb(226 232 240)' } }}>
            Choose how you want to delete this project:
          </DialogContentText>

          {/* Delete Type Selection */}
          <Box sx={{ mb: 3 }}>
            {[
              { type: 'soft', color: '#3b82f6', bg: '#eff6ff', darkBg: 'rgba(59,130,246,0.12)', text: '#1e40af', title: 'Soft Delete (Recommended)', body: 'Mark project as inactive. Can be restored later if needed. Project will be hidden from the main view.' },
              { type: 'hard', color: '#ef4444', bg: '#fef2f2', darkBg: 'rgba(239,68,68,0.12)', text: '#991b1b', title: 'Hard Delete (Permanent)', body: 'Permanently remove from database. This action cannot be undone and all data will be lost.' },
            ].map((opt) => {
              const active = deleteType === opt.type;
              return (
                <Box
                  key={opt.type}
                  role="radio"
                  aria-checked={active}
                  tabIndex={0}
                  onClick={() => setDeleteType(opt.type)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDeleteType(opt.type); } }}
                  sx={{
                    p: 2,
                    mb: opt.type === 'soft' ? 2 : 0,
                    borderRadius: 2,
                    border: active ? `2px solid ${opt.color}` : '1px solid #e5e7eb',
                    backgroundColor: active ? opt.bg : '#f9fafb',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    '&:hover': { borderColor: opt.color, backgroundColor: opt.bg },
                    '.dark &': {
                      borderColor: active ? opt.color : '#334155',
                      backgroundColor: active ? opt.darkBg : 'rgb(30 41 59)',
                    },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <Box sx={{
                      width: 20, height: 20, borderRadius: '50%', border: '2px solid',
                      borderColor: active ? opt.color : '#9ca3af',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', mr: 1.5, flexShrink: 0
                    }}>
                      {active && <Box sx={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: opt.color }} />}
                    </Box>
                    <Typography variant="body1" sx={{ fontWeight: 600, color: active ? opt.text : 'text.primary', '.dark &': { color: active ? opt.color : 'rgb(241 245 249)' } }}>
                      {opt.title}
                    </Typography>
                  </Box>
                  <Typography variant="body2" sx={{ color: 'text.secondary', ml: 4.5, '.dark &': { color: 'rgb(148 163 184)' } }}>
                    {opt.body}
                  </Typography>
                </Box>
              );
            })}
          </Box>

          {projectToDelete && (
            <Box sx={{
              backgroundColor: '#f9fafb',
              p: 2,
              borderRadius: 2,
              border: '1px solid #e5e7eb',
              '.dark &': { backgroundColor: 'rgb(30 41 59)', borderColor: '#334155' },
              '& .MuiTypography-root': { wordBreak: 'break-word' },
              '.dark & .MuiTypography-root': { color: 'rgb(203 213 225)' }
            }}>
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                Project Details:
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                <strong>Project No:</strong> {projectToDelete.projectNo}
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                <strong>Title:</strong> {projectToDelete.projectTitle}
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                <strong>Client:</strong> {projectToDelete.client}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1, flexWrap: 'wrap' }}>
          <Button
            onClick={cancelDelete}
            disabled={isDeleting}
            sx={{
              color: 'text.secondary',
              textTransform: 'none',
              fontWeight: 500,
              '&:hover': {
                backgroundColor: '#f3f4f6'
              },
              '.dark &': { color: 'rgb(203 213 225)', '&:hover': { backgroundColor: 'rgb(30 41 59)' } }
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={confirmDeleteProject}
            disabled={isDeleting}
            variant="contained"
            color={deleteType === 'hard' ? 'error' : 'primary'}
            startIcon={isDeleting ? <RefreshCw size={16} className="animate-spin" /> : <Trash2 size={16} />}
            sx={{
              textTransform: 'none',
              fontWeight: 600,
              borderRadius: 2,
              backgroundColor: deleteType === 'hard' ? '#ef4444' : '#3b82f6',
              '&:hover': {
                backgroundColor: deleteType === 'hard' ? '#dc2626' : '#2563eb'
              }
            }}
          >
            {isDeleting ? 'Deleting...' : deleteType === 'hard' ? 'Permanently Delete' : 'Mark as Inactive'}
          </Button>
        </DialogActions>
      </Dialog>
    </PageLayout>
  );
};

// One project as a card (used on small screens or when "Cards" is chosen)
const ProjectCard = ({ project, onEdit, onDelete, formatCellValue }) => {
  const fmt = (key) => formatCellValue(project[key], { key });
  const kpiRaw = fmt('projectKPIsAchievedPercent');
  const doneRaw = fmt('projectCompletionPercent');
  const carsOpen = toNumber(fmt('carsOpen'));
  const obsOpen = toNumber(fmt('obsOpen'));
  const auditDelay = toNumber(fmt('delayInAuditsNoDays'));

  return (
    <article className="flex min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-indigo-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-900 dark:hover:border-indigo-500/60">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-[11px] font-semibold text-indigo-700 dark:text-indigo-300">
            #{project.srNo} · {fmt('projectNo')}
          </p>
          <h3 className="mt-0.5 line-clamp-2 text-sm font-semibold text-slate-900 dark:text-slate-50">{fmt('projectTitle')}</h3>
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">{fmt('client')}</p>
        </div>
        <div className="flex shrink-0 gap-0.5">
          <Tooltip title="Edit Project">
            <IconButton size="small" aria-label="Edit project" onClick={() => onEdit(project)} sx={{ color: 'primary.main' }}>
              <Edit size={15} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete Project">
            <IconButton size="small" aria-label="Delete project" onClick={() => onDelete(project)} sx={{ color: 'error.main' }}>
              <Trash2 size={15} />
            </IconButton>
          </Tooltip>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">KPIs achieved</p>
          <MiniBar pct={kpiRaw === 'N/A' ? null : toPercent(kpiRaw)} label={String(kpiRaw)} />
        </div>
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Completion</p>
          <MiniBar pct={doneRaw === 'N/A' ? null : toPercent(doneRaw)} label={String(doneRaw)} />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <Pill tone={countTone(carsOpen)} title="CARs open">{carsOpen} CARs open</Pill>
        <Pill tone={countTone(obsOpen)} title="Observations open">{obsOpen} Obs open</Pill>
        {auditDelay > 0 && <Pill tone={auditDelay > 30 ? 'bad' : 'warn'} title="Delay in audits">{auditDelay}d audit delay</Pill>}
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-slate-100 pt-3 text-xs dark:border-slate-800">
        <div className="min-w-0">
          <dt className="flex items-center gap-1 text-slate-400"><Users size={11} /> PM</dt>
          <dd className="truncate font-medium text-slate-700 dark:text-slate-200">{fmt('projectManager')}</dd>
        </div>
        <div className="min-w-0">
          <dt className="flex items-center gap-1 text-slate-400"><ShieldCheck size={11} /> Quality Eng.</dt>
          <dd className="truncate font-medium text-slate-700 dark:text-slate-200">{fmt('projectQualityEng')}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-slate-400">Start</dt>
          <dd className="truncate font-medium text-slate-700 dark:text-slate-200">{fmt('projectStartingDate')}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-slate-400">Closing</dt>
          <dd className="truncate font-medium text-slate-700 dark:text-slate-200">{fmt('projectClosingDate')}</dd>
        </div>
      </dl>
      {fmt('remarks') !== '-' && (
        <p className="mt-2 line-clamp-2 text-xs italic text-slate-500 dark:text-slate-400" title={String(fmt('remarks'))}>
          {fmt('remarks')}
        </p>
      )}
    </article>
  );
};

const CARD_BATCH = 12;

// Remove viewMode and setViewMode from props
const DetailedViewContent = ({
  rows,
  columns,
  columnGroupingModel,
  searchTerm,
  setSearchTerm,
  clearSearch,
  filteredHeaders,
  onCreateProject,
  onEditProject,
  onDeleteProject,
  formatCellValue
}) => {
  const isSmall = useMediaQuery('(max-width: 767px)');
  const [layoutChoice, setLayoutChoice] = useState(null); // null = automatic
  const layout = layoutChoice ?? (isSmall ? 'cards' : 'table');
  const [cardLimit, setCardLimit] = useState(CARD_BATCH);

  return (
    <div className="min-w-0 space-y-3">
      <Paper
        elevation={0}
        className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700/80 dark:bg-slate-900"
        sx={{
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 4,
          overflow: 'hidden',
          minWidth: 0,
          backgroundColor: 'white',
          '.dark &': {
            backgroundColor: 'rgb(15 23 42)',
          }
        }}
      >
        {/* Toolbar */}
        <div className="border-b border-slate-200 bg-slate-50/80 p-3 sm:px-4 dark:border-slate-700/80 dark:bg-slate-800/60">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="relative min-w-0 flex-1 basis-full sm:basis-64 sm:max-w-md">
              <TextField
                fullWidth
                variant="outlined"
                size="small"
                placeholder="Search by project no., title, client or person…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                inputProps={{ 'aria-label': 'Search projects' }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search size={15} className="text-slate-400" />
                    </InputAdornment>
                  ),
                  endAdornment: searchTerm && (
                    <InputAdornment position="end">
                      <IconButton size="small" aria-label="Clear search" onClick={clearSearch} sx={{ p: 0.5, color: '#94a3b8' }}>
                        <X size={13} />
                      </IconButton>
                    </InputAdornment>
                  )
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: 'white',
                    borderRadius: '10px',
                    fontSize: '0.85rem',
                    height: '38px',
                    color: '#334155',
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: '#cbd5e1' },
                    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#94a3b8' },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#6366f1', borderWidth: '1px' },
                    '&.Mui-focused': { boxShadow: '0 0 0 3px rgba(99, 102, 241, 0.15)' },
                    '& input::placeholder': { color: '#94a3b8', opacity: 1 },
                  },
                  '.dark & .MuiOutlinedInput-root': {
                    backgroundColor: 'rgb(15 23 42)',
                    color: '#f1f5f9',
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: '#475569' },
                    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#64748b' },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#818cf8' },
                    '& input::placeholder': { color: '#64748b', opacity: 1 },
                  }
                }}
              />
            </div>

            <span className="text-xs text-slate-500 dark:text-slate-400">
              <span className="font-semibold text-slate-700 dark:text-slate-200">{rows.length}</span> project{rows.length !== 1 ? 's' : ''}
              <span className="hidden sm:inline"> · {filteredHeaders.length} columns</span>
            </span>

            <div className="ml-auto flex items-center gap-2">
              {/* Table / cards switch */}
              <div role="group" aria-label="Layout" className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 dark:border-slate-600 dark:bg-slate-900">
                {[
                  { id: 'table', icon: Table2, label: 'Table' },
                  { id: 'cards', icon: LayoutGrid, label: 'Cards' },
                ].map(({ id, icon: Icon, label }) => (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={layout === id}
                    onClick={() => setLayoutChoice(id)}
                    className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition ${
                      layout === id
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Icon size={13} /> {label}
                  </button>
                ))}
              </div>

              <Button
                variant="contained"
                size="small"
                startIcon={<Plus size={16} />}
                onClick={onCreateProject}
                sx={{
                  background: 'linear-gradient(135deg, #3b82f6, #4f46e5)',
                  color: 'white',
                  textTransform: 'none',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  px: 2,
                  py: 0.75,
                  borderRadius: '10px',
                  whiteSpace: 'nowrap',
                  boxShadow: '0 4px 12px -4px rgba(79, 70, 229, 0.5)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #2563eb, #4338ca)',
                    boxShadow: '0 6px 16px -4px rgba(79, 70, 229, 0.6)'
                  }
                }}
              >
                New Project
              </Button>
            </div>
          </div>
        </div>

        {layout === 'cards' ? (
          rows.length === 0 ? (
            <NoResults searchTerm={searchTerm} onClear={clearSearch} />
          ) : (
            <div className="p-3 sm:p-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {rows.slice(0, cardLimit).map((row) => (
                  <ProjectCard
                    key={row.id}
                    project={row}
                    onEdit={onEditProject}
                    onDelete={onDeleteProject}
                    formatCellValue={formatCellValue}
                  />
                ))}
              </div>
              {rows.length > cardLimit && (
                <div className="mt-4 flex justify-center">
                  <button
                    type="button"
                    onClick={() => setCardLimit((n) => n + CARD_BATCH)}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    Show more ({rows.length - cardLimit} left)
                  </button>
                </div>
              )}
            </div>
          )
        ) : (
          <Box sx={{ width: '100%', minWidth: 0, height: { xs: 520, md: 'clamp(480px, calc(100vh - 380px), 860px)' } }}>
            <DataGrid
              className="bg-white dark:bg-slate-900"
              rows={rows}
              columns={columns}
              columnGroupingModel={columnGroupingModel}
              experimentalFeatures={{ columnGrouping: true }}
              pagination={true}
              pageSizeOptions={[10, 25, 50, 100]}
              initialState={{
                pagination: { paginationModel: { pageSize: 25 } },
              }}
              disableRowSelectionOnClick
              sortingOrder={['asc', 'desc']}
              disableColumnMenu={false}
              columnHeaderHeight={40}
              rowHeight={44}
              slots={{ noRowsOverlay: () => <NoResults searchTerm={searchTerm} onClear={clearSearch} /> }}
              sx={{
                height: '100%',
                width: '100%',
                border: 'none',
                fontSize: '0.75rem',
                '& .MuiDataGrid-main': {
                  overflow: 'hidden'
                },
                '& .MuiDataGrid-columnHeader': {
                  backgroundColor: "#f8fafc !important",
                  borderBottom: "1px solid #e2e8f0",
                  '.dark &': {
                    backgroundColor: "rgb(30 41 59) !important",
                    borderBottom: "1px solid #334155",
                  }
                },
                '& .MuiDataGrid-columnHeaderTitle': {
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  lineHeight: 1.15,
                  whiteSpace: 'normal',
                  textAlign: 'center',
                  color: '#334155',
                  '.dark &': { color: 'rgb(226 232 240)' }
                },
                '& .qhse-group-header': {
                  backgroundColor: '#eef2ff !important',
                  '.dark &': { backgroundColor: 'rgba(99,102,241,0.15) !important' },
                  '& .MuiDataGrid-columnHeaderTitle': {
                    fontSize: '0.65rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: '#4338ca',
                    '.dark &': { color: '#c7d2fe' }
                  }
                },
                '& .MuiDataGrid-columnHeader--filledGroup .MuiDataGrid-columnHeaderTitleContainer': {
                  borderBottom: 'none'
                },
                '& .MuiDataGrid-cell': {
                  padding: '2px 8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderBottom: '1px solid #f1f5f9',
                  color: '#374151',
                  '&:focus, &:focus-within': { outline: '2px solid rgba(99,102,241,0.4)', outlineOffset: '-2px' },
                  '.dark &': {
                    color: 'rgb(241 245 249)',
                    borderBottom: '1px solid #1e293b',
                  }
                },
                '& .MuiDataGrid-cell--textLeft': { justifyContent: 'flex-start' },
                '& .MuiDataGrid-row': {
                  backgroundColor: 'white',
                  transition: 'background-color 120ms',
                  '&:nth-of-type(even)': {
                    backgroundColor: '#fbfcfe',
                  },
                  '&:hover': {
                    backgroundColor: "#eef2ff",
                  },
                  '.dark &': {
                    backgroundColor: 'rgb(15 23 42)',
                    '&:nth-of-type(even)': {
                      backgroundColor: 'rgb(20 29 50)',
                    },
                    '&:hover': {
                      backgroundColor: "rgba(99,102,241,0.12)",
                    },
                  }
                },
                '& .MuiDataGrid-columnSeparator': {
                  visibility: 'visible',
                  color: '#e2e8f0',
                  '.dark &': {
                    color: '#334155',
                  }
                },
                '& .MuiDataGrid-footerContainer': {
                  borderTop: '1px solid #e2e8f0',
                  backgroundColor: '#f8fafc',
                  minHeight: '44px',
                  '& .MuiTablePagination-root': {
                    color: '#374151',
                    fontSize: '0.75rem',
                  },
                  '& .MuiTablePagination-toolbar': {
                    flexWrap: 'wrap',
                    minHeight: '44px',
                    px: 1,
                  },
                  '& .MuiIconButton-root': {
                    color: '#6b7280',
                    padding: '4px',
                  },
                  '.dark &': {
                    borderTop: '1px solid #334155',
                    backgroundColor: 'rgb(30 41 59)',
                    '& .MuiTablePagination-root': {
                      color: 'rgb(241 245 249)',
                    },
                    '& .MuiIconButton-root': {
                      color: 'rgb(148 163 184)',
                    },
                    '& .MuiSelect-icon': {
                      color: 'rgb(148 163 184)',
                    }
                  }
                },
                '& .MuiDataGrid-sortIcon, & .MuiDataGrid-menuIconButton': {
                  color: '#6b7280',
                  '.dark &': {
                    color: 'rgb(148 163 184)',
                  }
                },
                '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': {
                  color: '#374151',
                  fontSize: '0.75rem',
                  '.dark &': {
                    color: 'rgb(241 245 249)',
                  }
                },
                '& .MuiDataGrid-filler, & .MuiDataGrid-scrollbarFiller': {
                  backgroundColor: "#fff !important",
                  '.dark &': {
                    backgroundColor: "rgb(15 23 42) !important",
                  }
                },
                '& .MuiDataGrid-scrollbarFiller--header': {
                  backgroundColor: "#f8fafc !important",
                  '.dark &': {
                    backgroundColor: "rgb(30 41 59) !important",
                  }
                },
                '& .MuiDataGrid-virtualScroller': {
                  backgroundColor: 'white',
                  '.dark &': {
                    backgroundColor: 'rgb(15 23 42)',
                  }
                },
                '& .MuiDataGrid-overlayWrapper, & .MuiDataGrid-overlay': {
                  backgroundColor: 'white',
                  '.dark &': {
                    backgroundColor: 'rgb(15 23 42)',
                  }
                },
              }}
            />
          </Box>
        )}
      </Paper>
    </div>
  );
};

// Wrapper component to provide refetch functionality
const DetailedViewWithRefresh = (props) => {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const refetch = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
  }, []);

  return <DetailedView {...props} refetch={refetch} key={refreshTrigger} />;
};

export default withDashboardControls(DetailedViewWithRefresh, {
  autoRefreshInterval: 30000, // 30 seconds
  storageKey: 'qhseDetailedViewPageControls',
});
