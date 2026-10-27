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
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Clock3, Save } from 'lucide-react';
import {
  CloudArrowUpIcon,
  ChevronDownIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  LinkIcon,
  TableCellsIcon,
  CodeBracketIcon,
  ArrowPathIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import PropTypes from 'prop-types';
import specCustomizationAPI from '../../../../services/specCustomizationAPI';
import { radaiAlert } from '../../../../services/radaiDialog';
import PaperSpecExtractor from './PaperSpecExtractor';
import S3DReviewWorkspace from './S3DReviewWorkspace';
import './S3DPreview.css';
import MatchReviewQueue from './MatchReviewQueue';
import ControlledReleasePanel from './ControlledReleasePanel';
import ComponentMatchingWorkbookManager from './ComponentMatchingWorkbookManager';

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
  { key: 'spec', label: 'Draft SPEC.xlsx', description: 'SmartPlant 3D — Piping Spec Rules workbook', icon: DocumentTextIcon, iconClass: 'text-slate-500' },
  { key: 'cat', label: 'Draft CAT.xlsx', description: 'SmartPlant 3D — Component Catalog workbook', icon: DocumentTextIcon, iconClass: 'text-slate-500' },
  { key: 'xlsx', label: 'Extracted rows (review XLSX)', description: 'Review data: one sheet per piping class. Use Draft SPEC for the standard template.', icon: TableCellsIcon, iconClass: 'text-emerald-600' },
  { key: 'json', label: 'JSON', description: 'Raw extracted data', icon: CodeBracketIcon, iconClass: 'text-slate-600' },
];

const HUB_TABS = [
  { key: 'classes', label: 'Piping classes' },
  { key: 'canvas', label: 'Workbook canvas' },
  { key: 'matching', label: 'Matching' },
  { key: 'release', label: 'Release & pilot' },
];

const S3DDataExtractionHub = ({ jobId, onUploadAnother, onHistory }) => {
  const [job, setJob] = useState(null);
  const [referenceSet, setReferenceSet] = useState(null);
  const [matching, setMatching] = useState(false);
  const [matchingError, setMatchingError] = useState('');
  const [matchRevision, setMatchRevision] = useState(0);
  const [documentMeta, setDocumentMeta] = useState(null);
  const [loadingJob, setLoadingJob] = useState(Boolean(jobId));
  const [loadError, setLoadError] = useState('');
  const [loadRetry, setLoadRetry] = useState(0);
  const [activeView, setActiveView] = useState('canvas');
  const [codelistProfile, setCodelistProfile] = useState('BUHASA');
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const exportMenuRef = useRef(null);
  const reviewRef = useRef(null);
  const [workspaceStatus, setWorkspaceStatus] = useState({});
  const handleWorkspaceStatus = useCallback(status => setWorkspaceStatus(status), []);
  const refreshReferences = useCallback(() => setMatchRevision(value => value + 1), []);
  const linkSource = useCallback(({ page } = {}) => {
    if (documentMeta?.file_url) window.open(`${documentMeta.file_url}#page=${page || 1}`, '_blank', 'noopener,noreferrer');
    else void radaiAlert('The source document URL is unavailable. Source links are supplied by the extraction service; upload the source document to create a new extraction with its source evidence.');
  }, [documentMeta?.file_url]);
  const changeView = async value => {
    try { await reviewRef.current?.saveChanges(); setActiveView(value); }
    catch { /* Keep unsaved changes visible in the review workspace. */ }
  };
  const leaveWorkspace = async callback => {
    try { await reviewRef.current?.saveChanges(); callback?.(); }
    catch { /* A failed save must not discard the editable draft. */ }
  };

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

  useEffect(() => {
    let cancelled = false;
    setReferenceSet(null);
    if (!job?.project_id) return undefined;
    (async () => {
      try {
        const sets = await specCustomizationAPI.listMatchingSets(job.project_id);
        if (!cancelled) {
          setReferenceSet((sets.items || []).find(item => item.id === job.reference_workbook_set) || (sets.items || []).find(item => item.is_active) || null);
        }
      } catch (err) {
        if (!cancelled) setMatchingError(err?.response?.data?.detail || 'Could not load reference sets. Open Matching to retry.');
      }
    })();
    return () => { cancelled = true; };
  }, [job?.project_id, job?.reference_workbook_set, matchRevision]);

  const runMatching = async () => {
    setMatching(true);
    setMatchingError('');
    try {
      await reviewRef.current?.saveChanges();
      await specCustomizationAPI.runJobMatching(jobId, referenceSet?.id, codelistProfile);
      setMatchRevision(value => value + 1);
      setActiveView('matching');
      setJob(current => ({ ...current, reference_workbook_set: referenceSet.id }));
    } catch (err) {
      setMatchingError(err?.response?.data?.error || err?.response?.data?.detail || 'Matching failed. Try again.');
    } finally { setMatching(false); }
  };


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
      await reviewRef.current?.saveChanges();
      if (kind === 'spec') {
        downloadBlob(await specCustomizationAPI.exportSmartplantSpec(jobId), `DRAFT_spec_customisation_${jobId}_SPEC.xlsx`);
      } else if (kind === 'cat') {
        downloadBlob(await specCustomizationAPI.exportSmartplantCat(jobId), `DRAFT_spec_customisation_${jobId}_CAT.xlsx`);
      } else if (kind === 'xlsx') {
        downloadBlob(await specCustomizationAPI.exportJob(jobId, 'xlsx'), `extracted_rows_review_${jobId}.xlsx`);
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
  const emptyExtraction = job?.extraction_completeness?.state === 'empty';

  const saveExtractedData = async () => {
    if (saving || !jobId) return;
    setSaving(true);
    setSaveError('');
    try {
      await reviewRef.current?.saveChanges();
      if (!job?.saved_at) {
        const updated = await specCustomizationAPI.saveJob(jobId);
        setJob(updated);
      }
    } catch (err) {
      setSaveError(err?.response?.data?.error || err?.response?.data?.detail || err?.message || 'Could not save extracted data.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="s3d-preview">
      <div className="s3d-preview-inner">
               {/* Title + actions */}
        <div className="s3d-hub-heading">
          <div>
            <h1>Data Extraction &amp; Integration Hub</h1>
            <p>Review extracted records, resolve matches, and prepare your workbook.</p>
          </div>
          <div className="s3d-hub-actions">
            <button type="button" onClick={() => leaveWorkspace(onHistory)} className="s3d-button"><Clock3 />History Logs</button>
            <button type="button" onClick={() => leaveWorkspace(onUploadAnother)} className="s3d-button s3d-button--blue"><CloudArrowUpIcon />Upload document</button>
            {job?.status === 'completed' && (
              <button type="button" onClick={saveExtractedData} disabled={emptyExtraction || saving || (Boolean(job.saved_at) && !['unsaved', 'error'].includes(workspaceStatus.saveStatus))}
                aria-label={saving ? 'Saving changes' : job.saved_at ? 'Saved to project' : 'Save extracted data'} className="s3d-button s3d-button--blue">
                <Save />{saving ? 'Saving…' : 'Save changes'}
              </button>
            )}
            <div className="relative" ref={exportMenuRef}>
              <button
                type="button"
                onClick={() => setExportOpen((open) => !open)}
                aria-expanded={exportOpen}
                aria-haspopup="menu"
                className="s3d-button s3d-button--primary s3d-export-button"
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
        {matchingError && <p role="alert" className="mt-3 text-sm text-rose-700">{matchingError}</p>}
        {saveError && <p role="alert" className="mt-3 text-sm text-rose-700">{saveError}</p>}
        {emptyExtraction && <p role="alert" className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">This extraction produced no component records. Choose Upload document and extract the source again to create a new attempt. The previous run remains in History Logs.</p>}
        {job?.saved_at && <span className="sr-only" role="status">Saved to project on {new Date(job.saved_at).toLocaleString()}.</span>}

        {/* Document info card */}
        <div className="s3d-document-bar">
          <div className="flex min-w-0 items-center gap-3">
            <div className="s3d-pdf-file-icon" aria-hidden="true">pdf</div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">{documentMeta?.original_filename || 'Document'}</p>
              <p className="s3d-document-counts"><span>{documentMeta?.total_pages ?? '—'} pages</span><span>{workspaceStatus.sheets ?? '—'} sheets</span><span>{workspaceStatus.records ?? '—'} records</span></p>
            </div>
          </div>
          <span className={`s3d-badge s3d-badge--${extractionStatus === 'completed' && !emptyExtraction ? 'success' : 'warning'}`}>{emptyExtraction ? <ExclamationTriangleIcon /> : <CheckCircle2 />}{emptyExtraction ? 'No components extracted' : extractionStatus === 'completed' ? 'Extraction complete' : `Extraction ${extractionStatus}`}</span>
          <span className={`s3d-badge s3d-badge--${workspaceStatus.sourceLinked ? 'success' : 'warning'}`}>
            {workspaceStatus.sourceLinked ? <CheckCircle2 /> : <ExclamationTriangleIcon className="h-3.5 w-3.5" />}
            {workspaceStatus.sourceLinked ? 'Source linked' : 'Source not linked'}
          </span>
              <button
                type="button"
                onClick={() => linkSource()}
                className="s3d-text-button"
              >
                <LinkIcon className="h-3.5 w-3.5" />
                Link source
              </button>
        </div>

        {/* View tabs */}
        <div className="s3d-hub-tabs" role="tablist" aria-label="Data extraction views">
          <div className="flex gap-6">
            {HUB_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={activeView === tab.key}
                onClick={() => changeView(tab.key)}
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
          {referenceSet && job?.status === 'completed' && <div className="flex items-center gap-2"><label className="text-sm">Project dictionary <select aria-label="Project dictionary" value={codelistProfile} onChange={event => setCodelistProfile(event.target.value)} disabled={matching} className="ml-2 rounded border p-2"><option value="BUHASA">BUHASA codelists</option><option value="">Existing reference matching</option></select></label><button type="button" className="s3d-text-button s3d-run-matching" onClick={runMatching} disabled={matching || emptyExtraction}><ArrowPathIcon />{matching ? 'Matching…' : 'Run Matching'}</button></div>}
        </div>

        {!loadingJob && !loadError && job?.status === 'completed' && activeView === 'matching' && <div className="mt-4 space-y-4">
          <MatchReviewQueue key={jobId} jobId={jobId} revision={matchRevision} />
          {job.project_id && <ComponentMatchingWorkbookManager projectId={job.project_id} onSetsChanged={() => setMatchRevision(value => value + 1)} />}
        </div>}

        {!loadingJob && !loadError && job?.status === 'completed' && activeView === 'release' && <div className="mt-4"><ControlledReleasePanel key={jobId} jobId={jobId} /></div>}

        {/* Content */}
        <div className={`s3d-hub-content ${activeView === 'canvas' ? 's3d-hub-content--canvas' : ''}`}>
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
            <S3DReviewWorkspace ref={reviewRef} key={`${jobId}-canvas`} job={job} documentMeta={documentMeta} onStatusChange={handleWorkspaceStatus} onLinkSource={linkSource} onRefreshReferences={refreshReferences} />
          )}
        </div>
        {activeView === 'canvas' && <div className="s3d-workspace-footer"><span>{workspaceStatus.records ?? '—'} records <span>·</span> {workspaceStatus.issues ?? '—'} issues to review</span><div><span className="s3d-footer-save"><CheckCircle2 />{workspaceStatus.saveStatus === 'unsaved' ? 'Unsaved changes' : workspaceStatus.saveStatus === 'error' ? 'Save failed' : workspaceStatus.saveStatus === 'saving' ? 'Saving changes…' : 'Changes saved'}</span>{workspaceStatus.lastSaved && <span>Last saved today, {new Date(workspaceStatus.lastSaved).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}</div></div>}
      </div>
    </div>
  );
};

S3DDataExtractionHub.propTypes = { jobId: PropTypes.string, onUploadAnother: PropTypes.func, onHistory: PropTypes.func };

export default S3DDataExtractionHub;

