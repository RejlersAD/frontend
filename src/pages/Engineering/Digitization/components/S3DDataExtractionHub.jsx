/**
 * S3DDataExtractionHub
 * ────────────────────
 * Redesigned "Extracted Data Preview" page for the SmartPlant 3D flow
 * (route: /engineering/digitization/smart-plant-3d?screen=preview&job=<id>).
 *
 * Page chrome only — breadcrumb, title, actions (Demo workspace / Upload
 * document / Export), document info card and the "Piping classes ⇄ Workbook
 * canvas" tabs. Content comes from:
 *   - classes view → PaperSpecExtractor (embedded, previewOnly)
 *   - canvas view  → WorkbookCanvas (variant="hub")
 *
 * The app Sidebar and Header are rendered by the route layout and are
 * intentionally not touched here.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CloudArrowUpIcon,
  LockClosedIcon,
  ChevronDownIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  LinkIcon,
  TableCellsIcon,
  CodeBracketIcon,
  ArrowPathIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import specCustomizationAPI from '../../../../services/specCustomizationAPI';
import { radaiAlert } from '../../../../services/radaiDialog';
import PaperSpecExtractor from './PaperSpecExtractor';
import WorkbookCanvas from './WorkbookCanvas';

const fmtBytes = (n) => {
  if (!n) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let v = n; let i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i += 1; }
  return `${v.toFixed(v >= 100 ? 0 : 1)} ${units[i]}`;
};

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

const EXPORT_ITEMS = [
  { key: 'spec', label: 'SPEC.xlsx', description: 'SmartPlant 3D — Piping Spec Rules workbook', icon: DocumentTextIcon, iconClass: 'text-slate-500' },
  { key: 'cat', label: 'CAT.xlsx', description: 'SmartPlant 3D — Component Catalog workbook', icon: DocumentTextIcon, iconClass: 'text-slate-500' },
  { key: 'xlsx', label: 'XLSX (combined)', description: 'One sheet per Piping Class', icon: TableCellsIcon, iconClass: 'text-emerald-600' },
  { key: 'json', label: 'JSON', description: 'Raw extracted data', icon: CodeBracketIcon, iconClass: 'text-slate-600' },
];

const HUB_TABS = [
  { key: 'classes', label: 'Piping classes' },
  { key: 'canvas', label: 'Workbook canvas' },
];

const S3DDataExtractionHub = ({ jobId, onUploadAnother, onHistory }) => {
  const [job, setJob] = useState(null);
  const [documentMeta, setDocumentMeta] = useState(null);
  const [loadingJob, setLoadingJob] = useState(Boolean(jobId));
  const [loadError, setLoadError] = useState('');
  const [loadRetry, setLoadRetry] = useState(0);
  const [activeView, setActiveView] = useState('canvas');
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [sheetsCount, setSheetsCount] = useState(null);
  const [rowsCount, setRowsCount] = useState(null);
  const exportMenuRef = useRef(null);

  useEffect(() => {
    if (!jobId) return undefined;
    let cancelled = false;
    setLoadingJob(true);
    setLoadError('');
    (async () => {
      try {
        const jobData = await specCustomizationAPI.getJob(jobId);
        if (cancelled) return;
        setJob(jobData);
        setDocumentMeta(jobData.document_meta || (typeof jobData.document === 'object' ? jobData.document : null));
      } catch (err) {
        if (!cancelled) setLoadError(err?.response?.data?.detail || err?.message || 'Could not load extracted data.');
      } finally {
        if (!cancelled) setLoadingJob(false);
      }
    })();
    return () => { cancelled = true; };
  }, [jobId, loadRetry]);

  // Workbook totals for the document info card (SPEC template).
  useEffect(() => {
    if (!jobId) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const json = await specCustomizationAPI.getWorkbookPreview(jobId, 'spec');
        if (cancelled) return;
        setSheetsCount(json?.sheets?.length ?? null);
        setRowsCount(json?.sheets?.reduce((acc, s) => acc + (s.row_count || 0), 0) ?? null);
      } catch {
        /* counts stay null → rendered as "—" */
      }
    })();
    return () => { cancelled = true; };
  }, [jobId]);

  // Close the export menu on outside click / Escape.
  useEffect(() => {
    if (!exportOpen) return undefined;
    const onPointerDown = (event) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target)) setExportOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setExportOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [exportOpen]);

  const runExport = async (kind) => {
    if (!jobId || exporting) return;
    setExporting(kind);
    try {
      if (kind === 'spec') {
        downloadBlob(await specCustomizationAPI.exportSmartplantSpec(jobId), `spec_customisation_${jobId}_SPEC.xlsx`);
      } else if (kind === 'cat') {
        downloadBlob(await specCustomizationAPI.exportSmartplantCat(jobId), `spec_customisation_${jobId}_CAT.xlsx`);
      } else if (kind === 'xlsx') {
        downloadBlob(await specCustomizationAPI.exportJob(jobId, 'xlsx'), `paper_spec_${jobId}.xlsx`);
      } else if (kind === 'json') {
        const data = await specCustomizationAPI.exportJob(jobId, 'json');
        downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), `paper_spec_${jobId}.json`);
      }
      setExportOpen(false);
    } catch (err) {
      await radaiAlert(`Export failed: ${err?.response?.data?.error || err?.message || 'Unexpected error'}`);
    } finally {
      setExporting('');
    }
  };

  const extractionStatus = useMemo(() => {
    if (!job) return 'unverified';
    return job.status;
  }, [job]);

  const saveExtractedData = async () => {
    if (saving || !jobId) return;
    setSaving(true);
    setSaveError('');
    try {
      const updated = await specCustomizationAPI.saveJob(jobId);
      setJob(updated);
    } catch (err) {
      setSaveError(err?.response?.data?.error || err?.response?.data?.detail || err?.message || 'Could not save extracted data.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-[calc(100dvh-68px)] bg-[#f4f6f9] text-slate-900" style={{ fontFamily: "var(--font-sans, 'Segoe UI', system-ui, sans-serif)" }}>
      <div className="mx-auto max-w-4xl px-6 py-6">
               {/* Title + actions */}
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Data Extraction &amp; Integration Hub</h1>
            <p className="mt-1 text-sm text-slate-500">Review source data, edit SPEC and CAT workbooks, and prepare exports.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <button type="button" onClick={onHistory} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">History Logs</button>
            {job?.status === 'completed' && (
              <button type="button" onClick={saveExtractedData} disabled={saving || Boolean(job.saved_at)}
                className="rounded-lg border border-blue-600 bg-white px-4 py-2 text-sm font-semibold text-blue-600 disabled:opacity-60">
                {saving ? 'Saving…' : job.saved_at ? 'Saved to project' : 'Save extracted data'}
              </button>
            )}
            <button
              type="button"
              onClick={onUploadAnother}
              className="inline-flex items-center gap-2 rounded-lg border border-blue-600 bg-white px-4 py-2 text-sm font-semibold text-blue-600 shadow-sm transition hover:bg-blue-50"
            >
              <CloudArrowUpIcon className="h-4 w-4" />
              Upload document
            </button>
            <div className="relative" ref={exportMenuRef}>
              <button
                type="button"
                onClick={() => setExportOpen((open) => !open)}
                aria-expanded={exportOpen}
                aria-haspopup="menu"
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
              >
                Export
                <ChevronDownIcon className={`h-4 w-4 transition-transform ${exportOpen ? 'rotate-180' : ''}`} />
              </button>
              {exportOpen && (
                <div className="absolute right-0 z-50 mt-2 w-80 rounded-lg border border-slate-200 bg-white shadow-lg" role="menu">
                  <p className="px-4 pb-1 pt-3 text-xs font-medium text-slate-500">Export workbooks (download)</p>
                  <div className="py-1">
                    {EXPORT_ITEMS.map((item) => {
                      const ItemIcon = item.icon;
                      const busy = exporting === item.key;
                      return (
                        <button
                          key={item.key}
                          type="button"
                          role="menuitem"
                          disabled={Boolean(exporting)}
                          onClick={() => runExport(item.key)}
                          title={item.description}
                          className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                        >
                          {busy ? (
                            <ArrowPathIcon className="h-4 w-4 animate-spin text-blue-600" />
                          ) : (
                            <ItemIcon className={`h-4 w-4 ${item.iconClass}`} />
                          )}
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex items-start gap-2 border-t border-slate-100 px-4 py-2.5 text-xs text-slate-500">
                    <InformationCircleIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400" />
                    Review mappings before S3D import.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        {saveError && <p role="alert" className="mt-3 text-sm text-rose-700">{saveError}</p>}
        {job?.saved_at && <p role="status" className="mt-3 text-sm text-emerald-700">Saved to project on {new Date(job.saved_at).toLocaleString()}.</p>}

        {/* Document info card */}
        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-3 rounded-lg border border-slate-200 bg-white px-4 py-3.5 shadow-sm">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-slate-100">
              <DocumentTextIcon className="h-5 w-5 text-slate-500" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">{documentMeta?.original_filename || 'Document'}</p>
              <p className="text-xs text-slate-500">
                {documentMeta
                  ? `${documentMeta.total_pages || 0} pages · ${fmtBytes(documentMeta.file_size_bytes)}`
                  : 'Source metadata unavailable'}
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">
            <ExclamationTriangleIcon className="h-3.5 w-3.5" />
            Source not linked
          </span>
          <div className="ml-auto flex flex-wrap items-center">
            <span className="border-l border-slate-200 px-4 text-xs text-slate-600 first:border-l-0 first:pl-0">
              {sheetsCount ?? '—'} sheets
            </span>
            <span className="border-l border-slate-200 px-4 text-xs text-slate-600">
              {rowsCount ?? '—'} workbook rows
            </span>
            <span className="border-l border-slate-200 px-4 text-xs text-slate-600">
              Extraction status: <span className="font-medium text-slate-700">{extractionStatus}</span>
            </span>
            <span className="border-l border-slate-200 pl-4">
              <button
                type="button"
                onClick={() => radaiAlert('Source linking is automatic: rows are linked to extracted records when the AI matches a Piping Class or component to a template row. No manually uploaded source is attached to this document yet.')}
                className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline"
              >
                <LinkIcon className="h-3.5 w-3.5" />
                Link source
              </button>
            </span>
          </div>
        </div>

        {/* View tabs */}
        <div className="mt-6 border-b border-slate-200" role="tablist" aria-label="Data extraction views">
          <div className="flex gap-6">
            {HUB_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={activeView === tab.key}
                onClick={() => setActiveView(tab.key)}
                className={`-mb-px border-b-2 px-1 pb-2.5 text-sm font-medium transition-colors ${
                  activeView === tab.key
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="mt-4 pb-8">
          {loadingJob && (
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
              <ArrowPathIcon className="h-4 w-4 animate-spin text-blue-600" />
              Loading extracted data…
            </div>
          )}
          {loadError && !loadingJob && (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              <span>{loadError}</span>
              <button
                type="button"
                onClick={() => setLoadRetry(value => value + 1)}
                className="rounded-md border border-rose-300 bg-white px-3 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100"
              >
                Retry
              </button>
            </div>
          )}
          {!loadingJob && !loadError && job && job.status !== 'completed' && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <ExclamationTriangleIcon className="h-4 w-4" />
              Extraction {job.status}. Upload another document to try again.
            </div>
          )}
          {!loadingJob && !loadError && job?.status === 'completed' && activeView === 'classes' && (
            <PaperSpecExtractor key={`${jobId}-classes`} jobId={jobId} previewOnly embedded activeView="classes" onViewChange={setActiveView} />
          )}
          {!loadingJob && !loadError && job?.status === 'completed' && activeView === 'canvas' && (
            <WorkbookCanvas key={`${jobId}-canvas`} job={job} variant="hub" />
          )}
        </div>
      </div>
    </div>
  );
};

export default S3DDataExtractionHub;

