import React, { useRef, useState } from 'react';
import PropTypes from 'prop-types';
import {
  ArrowUpTrayIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import apiClient from '../../services/api.service';

const PurchaseOrderExcelImport = ({ isOpen, onClose, onImported }) => {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const close = () => {
    if (loading) return;
    setFile(null);
    setResult(null);
    setError('');
    onClose();
  };

  const upload = async (dryRun) => {
    if (!file) {
      setError('Select an Excel file first.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const body = new FormData();
      body.append('file', file);
      body.append('dry_run', dryRun ? 'true' : 'false');
      const response = await apiClient.post('/procurement/orders/import-excel/', body, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(response.data);
      if (!dryRun) onImported?.(response.data);
    } catch (requestError) {
      setError(
        requestError.response?.data?.error
        || requestError.response?.data?.detail
        || 'The PO Excel import could not be completed.',
      );
    } finally {
      setLoading(false);
    }
  };

  const complete = result?.dry_run === false;
  const canImport = result?.dry_run === true && result.ready_rows > 0;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center px-4 py-8">
        <button type="button" aria-label="Close PO import" className="fixed inset-0 bg-black/50" onClick={close} />
        <div className="relative w-full max-w-6xl overflow-hidden rounded-2xl bg-white shadow-2xl">
          <div className="flex items-start justify-between bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4">
            <div>
              <h2 className="text-lg font-bold text-white">Import Purchase Orders</h2>
              <p className="mt-1 text-xs text-indigo-100">
                Canonical PO numbering, PR linkage validation, and overwrite preview.
              </p>
            </div>
            <button type="button" onClick={close} disabled={loading} className="text-white hover:text-indigo-100">
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
                onChange={(event) => {
                  setFile(event.target.files?.[0] || null);
                  setResult(null);
                  setError('');
                }}
              />
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-800">{file?.name || 'Select the PO procurement register'}</p>
                  <p className="mt-1 text-xs text-gray-500">Excel .xlsx or .xlsm, maximum 15 MB</p>
                </div>
                <div className="flex gap-2">
                  <button type="button" disabled={loading} onClick={() => inputRef.current?.click()} className="h-9 rounded-lg border border-indigo-300 bg-white px-3 text-xs font-semibold text-indigo-700 hover:bg-indigo-50">
                    <ArrowUpTrayIcon className="mr-1.5 inline h-4 w-4" /> Choose File
                  </button>
                  <button type="button" disabled={!file || loading} onClick={() => upload(true)} className="h-9 rounded-lg bg-indigo-600 px-4 text-xs font-semibold text-white disabled:opacity-50">
                    {loading ? 'Processing...' : 'Preview Import'}
                  </button>
                </div>
              </div>
            </div>

            {error && (
              <div className="flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <ExclamationTriangleIcon className="h-5 w-5 flex-none" /> {error}
              </div>
            )}

            {result && (
              <>
                <div className="flex gap-2 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
                  <CheckCircleIcon className="h-5 w-5 flex-none" />
                  <span>
                    Source: <strong>{result.source_authority}</strong>. Legacy month suffixes are normalized to <strong>RAD-{'{GEN|PRJ}'}-PUR-####_YYYY</strong>, and every ready PO is linked to the explicit PR ID.
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                  {[
                    ['PO rows', result.total_rows],
                    ['Ready', result.ready_rows],
                    ['Created', result.created_count],
                    ['Overwritten', result.overwritten_count],
                    ['Issues', result.error_count],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                      <p className="text-xs text-gray-500">{label}</p>
                      <p className="mt-1 text-xl font-bold text-gray-800">{value ?? 0}</p>
                    </div>
                  ))}
                </div>

                {complete && (
                  <div className="flex gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                    <CheckCircleIcon className="h-5 w-5 flex-none" />
                    <span>
                      {result.created_count} PO(s) created and {result.overwritten_count} existing PO(s) overwritten successfully.
                      {' '}Database verified: <strong>{result.database_verification?.verified_count || 0}/{result.database_verification?.expected_count || 0}</strong> PO/PR links.
                    </span>
                  </div>
                )}

                <div className="overflow-hidden rounded-xl border border-gray-200">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 text-xs">
                      <thead className="bg-gray-50 text-left font-semibold text-gray-600">
                        <tr>
                          <th className="px-3 py-2">Sheet / Row</th>
                          <th className="px-3 py-2">Canonical PO</th>
                          <th className="px-3 py-2">Source PR</th>
                          <th className="px-3 py-2">Supplier</th>
                          <th className="px-3 py-2">PR Integrity</th>
                          <th className="px-3 py-2">Database Action</th>
                          <th className="px-3 py-2">Result</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {(result.rows || []).map((row) => (
                          <tr key={`${row.sheet}-${row.row_number}-${row.po_number}`}>
                            <td className="whitespace-nowrap px-3 py-2 text-gray-500">{row.sheet} / {row.row_number}</td>
                            <td className="px-3 py-2 font-semibold text-gray-800">
                              {row.po_number}
                              {row.source_po_number !== row.po_number && <p className="mt-1 text-[10px] font-normal text-gray-500">Source: {row.source_po_number}</p>}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2 text-gray-700">{row.pr_number}</td>
                            <td className="max-w-[220px] px-3 py-2 text-gray-600">{row.supplier_name || '-'}</td>
                            <td className="px-3 py-2">
                              <span className={`rounded-full px-2 py-1 font-semibold ${row.pr_linked ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                {row.pr_linked ? `Linked: ${row.pr_id}` : 'PR not found'}
                              </span>
                            </td>
                            <td className="px-3 py-2 font-semibold text-gray-700">{row.operation === 'overwrite' ? 'Overwrite existing' : 'Create new'}</td>
                            <td className="px-3 py-2">
                              <span className={`rounded-full px-2 py-1 font-semibold ${row.status === 'ready' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                {row.status === 'ready' ? 'Ready' : 'Blocked'}
                              </span>
                              {row.warnings?.length > 0 && <p className="mt-1 max-w-[280px] text-[11px] text-amber-700">{row.warnings.join(' ')}</p>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {result.errors?.length > 0 && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                    <p className="font-semibold">Rows skipped or requiring attention</p>
                    <ul className="mt-2 space-y-1">
                      {result.errors.map((item, index) => <li key={`${item.sheet}-${item.row_number}-${index}`}>{item.sheet} row {item.row_number}: {item.error}</li>)}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="flex justify-end gap-2 border-t border-gray-200 bg-gray-50 px-6 py-4">
            <button type="button" onClick={close} disabled={loading} className="h-9 rounded-lg border border-gray-300 bg-white px-4 text-xs font-semibold text-gray-700">{complete ? 'Close' : 'Cancel'}</button>
            {!complete && (
              <button type="button" disabled={!canImport || loading} onClick={() => upload(false)} className="h-9 rounded-lg bg-emerald-600 px-4 text-xs font-semibold text-white disabled:opacity-50">
                {loading ? 'Importing...' : `Import / Overwrite ${result?.ready_rows || 0} POs`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

PurchaseOrderExcelImport.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onImported: PropTypes.func,
};

export default PurchaseOrderExcelImport;
