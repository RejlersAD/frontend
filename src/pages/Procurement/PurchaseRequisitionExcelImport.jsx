import React, { useRef, useState } from 'react';
import {
  ArrowUpTrayIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import apiClient from '../../services/api.service';

const ACCEPTED_EXTENSIONS = ['.xlsx', '.xlsm'];

const PurchaseRequisitionExcelImport = ({ isOpen, onClose, onImported }) => {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const resetAndClose = () => {
    if (loading) return;
    setFile(null);
    setPreview(null);
    setError('');
    onClose();
  };

  const selectFile = (selected) => {
    setError('');
    setPreview(null);
    if (!selected) return;
    const lowerName = selected.name.toLowerCase();
    if (!ACCEPTED_EXTENSIONS.some((extension) => lowerName.endsWith(extension))) {
      setFile(null);
      setError('Please select an .xlsx or .xlsm Excel file.');
      return;
    }
    if (selected.size > 15 * 1024 * 1024) {
      setFile(null);
      setError('Excel file must not exceed 15 MB.');
      return;
    }
    setFile(selected);
  };

  const upload = async (dryRun) => {
    if (!file) {
      setError('Select an Excel file first.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('dry_run', dryRun ? 'true' : 'false');
      const response = await apiClient.post('/procurement/requisitions/import-excel/', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setPreview(response.data);
      if (!dryRun) onImported?.(response.data);
    } catch (requestError) {
      setError(
        requestError.response?.data?.error
        || requestError.response?.data?.detail
        || 'The Excel import could not be completed.',
      );
    } finally {
      setLoading(false);
    }
  };

  const importComplete = preview && preview.dry_run === false;
  const canImport = preview?.dry_run === true && preview.ready_rows > 0;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center px-4 py-8">
        <button
          type="button"
          aria-label="Close import dialog"
          className="fixed inset-0 bg-black/50"
          onClick={resetAndClose}
        />
        <div className="relative w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl">
          <div className="flex items-start justify-between bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4">
            <div>
              <h2 className="text-lg font-bold text-white">Import Purchase Requisitions</h2>
              <p className="mt-1 text-xs text-indigo-100">
                Preview Excel rows before creating draft PR records in RADAI.
              </p>
            </div>
            <button type="button" onClick={resetAndClose} disabled={loading} className="text-white hover:text-indigo-100">
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          <div className="max-h-[75vh] space-y-5 overflow-y-auto p-6">
            <div className="rounded-xl border border-dashed border-indigo-300 bg-indigo-50/50 p-5">
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="hidden"
                onChange={(event) => selectFile(event.target.files?.[0])}
              />
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-gray-800">
                    {file?.name || 'Select the PR procurement register'}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">Excel .xlsx or .xlsm, maximum 15 MB</p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => inputRef.current?.click()}
                    className="inline-flex h-9 items-center rounded-lg border border-indigo-300 bg-white px-3 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
                  >
                    <ArrowUpTrayIcon className="mr-1.5 h-4 w-4" /> Choose File
                  </button>
                  <button
                    type="button"
                    disabled={!file || loading}
                    onClick={() => upload(true)}
                    className="h-9 rounded-lg bg-indigo-600 px-4 text-xs font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loading ? 'Processing…' : 'Preview Import'}
                  </button>
                </div>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 flex-none" />
                <span>{error}</span>
              </div>
            )}

            {preview && (
              <>
                {preview.source_authoritative && (
                  <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
                    <CheckCircleIcon className="h-5 w-5 flex-none" />
                    <span>
                      Verified source: <strong>{preview.source_authority}</strong>. Original PR numbers and register values are preserved; company vendor and project references are checked separately below.
                    </span>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                  {[
                    ['Rows found', preview.total_rows],
                    ['Ready', preview.ready_rows],
                    ['Created', preview.created_count],
                    ['Duplicates', preview.skipped_count],
                    ['Errors', preview.error_count],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                      <p className="text-xs text-gray-500">{label}</p>
                      <p className="mt-1 text-xl font-bold text-gray-800">{value ?? 0}</p>
                    </div>
                  ))}
                </div>

                {preview.company_match_summary && (
                  <div className="rounded-xl border border-gray-200 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">Company database matching</p>
                    <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {[
                        ['Matched', preview.company_match_summary.matched, 'text-emerald-700'],
                        ['Partially matched', preview.company_match_summary.partial, 'text-amber-700'],
                        ['Unmatched', preview.company_match_summary.unmatched, 'text-red-700'],
                        ['No reference', preview.company_match_summary.no_reference, 'text-gray-600'],
                      ].map(([label, value, colour]) => (
                        <div key={label} className="rounded-lg bg-gray-50 px-3 py-2">
                          <p className="text-[11px] text-gray-500">{label}</p>
                          <p className={`text-lg font-bold ${colour}`}>{value ?? 0}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {importComplete && preview.created_count > 0 && (
                  <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                    <CheckCircleIcon className="h-5 w-5 flex-none" />
                    <span>{preview.created_count} draft Purchase Requisition(s) imported successfully.</span>
                  </div>
                )}

                {importComplete && preview.created_count === 0 && (
                  <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                    <ExclamationTriangleIcon className="h-5 w-5 flex-none" />
                    <span>No Purchase Requisitions were created. Review the reported row errors before retrying.</span>
                  </div>
                )}

                <div className="overflow-hidden rounded-xl border border-gray-200">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 text-xs">
                      <thead className="bg-gray-50 text-left font-semibold text-gray-600">
                        <tr>
                          <th className="px-3 py-2">Sheet / Row</th>
                          <th className="px-3 py-2">PR Number</th>
                          <th className="px-3 py-2">Supplier</th>
                          <th className="px-3 py-2">Purchase Summary</th>
                          <th className="px-3 py-2">Project</th>
                          <th className="px-3 py-2">Company Database</th>
                          <th className="px-3 py-2">Result</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {(preview.rows || []).map((row) => (
                          <tr key={`${row.sheet}-${row.row_number}-${row.pr_number}`}>
                            <td className="whitespace-nowrap px-3 py-2 text-gray-500">{row.sheet} / {row.row_number}</td>
                            <td className="whitespace-nowrap px-3 py-2 font-medium text-gray-800">{row.pr_number}</td>
                            <td className="max-w-[180px] truncate px-3 py-2 text-gray-600" title={row.supplier_name}>{row.supplier_name || '—'}</td>
                            <td className="max-w-[260px] truncate px-3 py-2 text-gray-600" title={row.product_service}>{row.product_service || '—'}</td>
                            <td className="whitespace-nowrap px-3 py-2 text-gray-600">{row.project || '—'}</td>
                            <td className="px-3 py-2">
                              <span className={`rounded-full px-2 py-1 font-semibold ${
                                row.company_match_status === 'matched'
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : row.company_match_status === 'partial'
                                    ? 'bg-amber-100 text-amber-700'
                                    : row.company_match_status === 'unmatched'
                                      ? 'bg-red-100 text-red-700'
                                      : 'bg-gray-100 text-gray-600'
                              }`}>
                                {(row.company_match_status || 'not checked').replace('_', ' ')}
                              </span>
                              <p className="mt-1 max-w-[220px] text-[11px] text-gray-500">
                                Vendor: {row.vendor_match?.matched ? row.vendor_match.vendor_code : 'not matched'}; Projects: {(row.project_matches || []).filter((item) => item.matched).length}/{(row.project_matches || []).length}
                              </p>
                            </td>
                            <td className="px-3 py-2">
                              <span className={`rounded-full px-2 py-1 font-semibold ${row.status === 'ready' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                {row.status === 'ready' ? 'Ready' : 'Duplicate'}
                              </span>
                              {row.warnings?.length > 0 && (
                                <p className="mt-1 max-w-[260px] text-[11px] text-amber-700">{row.warnings.join(' ')}</p>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {preview.errors?.length > 0 && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <p className="text-xs font-semibold text-amber-800">Rows requiring attention</p>
                    <ul className="mt-2 space-y-1 text-xs text-amber-700">
                      {preview.errors.slice(0, 20).map((item, index) => (
                        <li key={`${item.sheet}-${item.row_number}-${index}`}>
                          {item.sheet}{item.row_number ? ` row ${item.row_number}` : ''}: {item.error}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-gray-200 bg-gray-50 px-6 py-4">
            <button type="button" onClick={resetAndClose} disabled={loading} className="h-9 rounded-lg border border-gray-300 bg-white px-4 text-xs font-semibold text-gray-700 hover:bg-gray-50">
              {importComplete ? 'Close' : 'Cancel'}
            </button>
            {!importComplete && (
              <button
                type="button"
                disabled={!canImport || loading}
                onClick={() => upload(false)}
                className="h-9 rounded-lg bg-emerald-600 px-4 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? 'Importing…' : `Import ${preview?.ready_rows || 0} Draft PRs`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PurchaseRequisitionExcelImport;
