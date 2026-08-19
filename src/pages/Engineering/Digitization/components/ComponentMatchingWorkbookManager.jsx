/**
 * Spec Customization — Component Matching Workbook Manager
 * 
 * Manages Match.xlsx, SPEC.xlsx, and CAT.xlsx uploads for isometric software integration.
 * Displays active workbook set, upload form, and matching rules table.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  CloudArrowUpIcon,
  CheckCircleIcon,
  XCircleIcon,
  DocumentTextIcon,
  TableCellsIcon,
  Cog6ToothIcon,
  ArrowPathIcon,
  SparklesIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import apiClient from '../../../../services/api.service';

// ─── Soft-coded configuration ──────────────────────────────────────────────
const WORKBOOK_MANAGER_CONFIG = {
  endpoints: {
    upload: '/spec-customization/matching/upload/',
    sets: '/spec-customization/matching/sets/',
    rules: (setId) => `/spec-customization/matching/sets/${setId}/rules/`,
    parse: (setId) => `/spec-customization/matching/sets/${setId}/parse/`,
  },
  fileTypes: {
    match: { label: 'Match.xlsx', description: 'PDF → Excel name mapping', icon: '🔗' },
    spec: { label: 'SPEC.xlsx', description: 'Specification rules (25 sheets)', icon: '📋' },
    cat: { label: 'CAT.xlsx', description: 'Component catalog (23 sheets)', icon: '📦' },
  },
  maxFileSize: 50 * 1024 * 1024, // 50MB
};

// ───────────────────────────────────────────────────────────────────────────
// Main Component
// ───────────────────────────────────────────────────────────────────────────
const ComponentMatchingWorkbookManager = ({ projectId }) => {
  const [workbookSets, setWorkbookSets] = useState([]);
  const [activeSet, setActiveSet] = useState(null);
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [error, setError] = useState('');

  // File upload state
  const [matchFile, setMatchFile] = useState(null);
  const [specFile, setSpecFile] = useState(null);
  const [catFile, setCatFile] = useState(null);
  const [versionLabel, setVersionLabel] = useState('');

  // Load workbook sets for project
  const loadWorkbookSets = useCallback(async () => {
    if (!projectId) return;
    
    setLoading(true);
    setError('');
    try {
      const res = await apiClient.get(WORKBOOK_MANAGER_CONFIG.endpoints.sets, {
        params: { project_id: projectId },
      });
      const sets = res.data?.items || [];
      setWorkbookSets(sets);
      
      // Find active set
      const active = sets.find((s) => s.is_active);
      setActiveSet(active || null);
      
      // Load rules for active set
      if (active?.is_parsed) {
        loadRules(active.id);
      }
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to load workbook sets');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  // Load matching rules
  const loadRules = async (setId) => {
    try {
      const res = await apiClient.get(WORKBOOK_MANAGER_CONFIG.endpoints.rules(setId));
      setRules(res.data?.items || []);
    } catch (err) {
      console.error('Failed to load rules:', err);
    }
  };

  useEffect(() => {
    loadWorkbookSets();
  }, [loadWorkbookSets]);

  // Handle file upload
  const handleUpload = async (e) => {
    e.preventDefault();
    
    if (!matchFile || !specFile || !catFile) {
      setError('All three files (Match, SPEC, CAT) are required');
      return;
    }

    setUploadingFiles(true);
    setError('');

    const formData = new FormData();
    formData.append('project_id', projectId);
    formData.append('match_file', matchFile);
    formData.append('spec_file', specFile);
    formData.append('cat_file', catFile);
    formData.append('version_label', versionLabel || `Upload ${workbookSets.length + 1}`);
    formData.append('auto_parse', 'true');

    try {
      const res = await apiClient.post(
        WORKBOOK_MANAGER_CONFIG.endpoints.upload,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
        }
      );

      const newSet = res.data?.workbook_set;
      if (newSet) {
        setWorkbookSets([newSet, ...workbookSets.filter((s) => !s.is_active)]);
        setActiveSet(newSet);
        
        if (newSet.is_parsed) {
          loadRules(newSet.id);
        }
      }

      // Reset form
      setMatchFile(null);
      setSpecFile(null);
      setCatFile(null);
      setVersionLabel('');
    } catch (err) {
      setError(err?.response?.data?.error || 'Upload failed');
    } finally {
      setUploadingFiles(false);
    }
  };

  // Re-parse Match.xlsx
  const handleReparse = async () => {
    if (!activeSet) return;

    setLoading(true);
    try {
      const res = await apiClient.post(WORKBOOK_MANAGER_CONFIG.endpoints.parse(activeSet.id));
      
      if (res.data?.success) {
        // Reload sets and rules
        await loadWorkbookSets();
      } else {
        setError(res.data?.error || 'Parsing failed');
      }
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to parse workbook');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-sm">
            <TableCellsIcon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Component Matching Workbooks</h3>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Upload Match, SPEC, and CAT workbooks for isometric software integration
            </p>
          </div>
        </div>
        {activeSet && (
          <button
            onClick={handleReparse}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800/50 hover:bg-violet-50 dark:hover:bg-violet-900/20 rounded-lg disabled:opacity-50"
          >
            <ArrowPathIcon className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Re-parse
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg border border-rose-200 bg-rose-50 dark:bg-rose-900/20 text-rose-800 dark:text-rose-200 text-sm">
          <ExclamationTriangleIcon className="w-4 h-4 mt-0.5 shrink-0" />
          <div className="flex-1">{error}</div>
          <button onClick={() => setError('')} className="text-xs font-semibold underline">Dismiss</button>
        </div>
      )}

      {/* Active Set Status */}
      {activeSet && (
        <div className="rounded-xl border border-violet-200 dark:border-violet-800/40 bg-gradient-to-r from-violet-50 via-purple-50 to-fuchsia-50 dark:from-violet-900/20 dark:via-purple-900/15 dark:to-fuchsia-900/20 p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 flex-1">
              <div className="p-2 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-sm">
                <CheckCircleIcon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">Active workbook set</span>
                  <span className="text-sm font-bold text-gray-900 dark:text-white">{activeSet.version_label}</span>
                </div>
                <div className="mt-1 flex items-center gap-3 text-xs text-gray-600 dark:text-gray-400">
                  <span>🔗 {activeSet.match_file_name}</span>
                  <span>📋 {activeSet.spec_file_name}</span>
                  <span>📦 {activeSet.cat_file_name}</span>
                </div>
                <div className="mt-2 flex items-center gap-3 text-xs">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded ${
                    activeSet.is_parsed
                      ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                      : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                  }`}>
                    {activeSet.is_parsed ? <CheckCircleIcon className="w-3.5 h-3.5" /> : <XCircleIcon className="w-3.5 h-3.5" />}
                    {activeSet.is_parsed ? `${activeSet.rules_count} rules` : 'Not parsed'}
                  </span>
                  <span className="text-gray-500">
                    SPEC: {activeSet.spec_sheets_count} sheets · CAT: {activeSet.cat_sheets_count} sheets
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upload Form */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
        <div className="flex items-center gap-2 mb-4">
          <CloudArrowUpIcon className="w-5 h-5 text-violet-600" />
          <h4 className="text-sm font-bold text-gray-900 dark:text-white">Upload New Workbook Set</h4>
        </div>

        <form onSubmit={handleUpload} className="space-y-4">
          {/* Version Label */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1.5">
              Version Label (optional)
            </label>
            <input
              type="text"
              value={versionLabel}
              onChange={(e) => setVersionLabel(e.target.value)}
              placeholder="e.g., Rev A, Initial, 2024-Q1"
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            />
          </div>

          {/* File Inputs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(WORKBOOK_MANAGER_CONFIG.fileTypes).map(([key, config]) => {
              const file = key === 'match' ? matchFile : key === 'spec' ? specFile : catFile;
              const setFile = key === 'match' ? setMatchFile : key === 'spec' ? setSpecFile : setCatFile;

              return (
                <div key={key}>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1.5">
                    {config.icon} {config.label} *
                  </label>
                  <div className="relative">
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                      className="hidden"
                      id={`file-${key}`}
                    />
                    <label
                      htmlFor={`file-${key}`}
                      className="flex items-center justify-center gap-2 w-full px-3 py-2.5 text-sm border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-violet-400 dark:hover:border-violet-600 bg-gray-50 dark:bg-gray-900 cursor-pointer transition-colors"
                    >
                      {file ? (
                        <>
                          <CheckCircleIcon className="w-4 h-4 text-emerald-600" />
                          <span className="text-xs font-medium text-gray-900 dark:text-white truncate max-w-[120px]">
                            {file.name}
                          </span>
                        </>
                      ) : (
                        <>
                          <CloudArrowUpIcon className="w-4 h-4 text-gray-400" />
                          <span className="text-xs text-gray-500">Choose file</span>
                        </>
                      )}
                    </label>
                  </div>
                  <p className="mt-1 text-[10px] text-gray-500">{config.description}</p>
                </div>
              );
            })}
          </div>

          {/* Submit */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="submit"
              disabled={uploadingFiles || !matchFile || !specFile || !catFile}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 rounded-lg shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploadingFiles ? (
                <>
                  <ArrowPathIcon className="w-4 h-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <CloudArrowUpIcon className="w-4 h-4" />
                  Upload Workbooks
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Matching Rules Table */}
      {activeSet?.is_parsed && rules.length > 0 && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SparklesIcon className="w-4 h-4 text-violet-600" />
              <h4 className="text-sm font-bold text-gray-900 dark:text-white">Matching Rules</h4>
              <span className="text-xs text-gray-500">({rules.length} rules)</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 dark:text-gray-200">PDF Component Name</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 dark:text-gray-200">Catalog Name</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 dark:text-gray-200">CAT Sheet</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 dark:text-gray-200">Row #</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {rules.map((rule) => (
                  <tr key={rule.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50">
                    <td className="px-4 py-2.5 text-gray-900 dark:text-white font-medium">{rule.pdf_component_name}</td>
                    <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300">{rule.catalog_component_name}</td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 text-xs font-medium">
                        📦 {rule.cat_sheet_name}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">Row {rule.row_number}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && !activeSet && (
        <div className="py-12 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg mb-4">
            <TableCellsIcon className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">No workbooks uploaded yet</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 max-w-md mx-auto">
            Upload Match.xlsx, SPEC.xlsx, and CAT.xlsx to enable component matching for isometric software.
          </p>
        </div>
      )}
    </div>
  );
};

export default ComponentMatchingWorkbookManager;
