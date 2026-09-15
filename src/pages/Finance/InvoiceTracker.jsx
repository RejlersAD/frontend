import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { ArrowPathIcon, ArrowUpTrayIcon, BoltIcon, CheckCircleIcon, DocumentArrowUpIcon, ExclamationTriangleIcon, XMarkIcon } from '@heroicons/react/24/outline';
import invoiceTrackerService from '../../services/invoiceTracker.service';
import OutgoingInvoiceWorkspace from '../../components/Finance/OutgoingInvoiceWorkspace';

const ImportExcelModal = ({ open, onClose, onImported }) => {
  const [file, setFile]         = useState(null)
  const [sheets, setSheets]     = useState('')
  const [busy, setBusy]         = useState(false)
  const [result, setResult]     = useState(null)
  const [error, setError]       = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const inputRef                = useRef(null)
  const modalRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    const modal = modalRef.current;
    const keydown = event => {
      if (event.key === 'Escape') { event.preventDefault(); if (!busy) onClose(); }
      if (event.key !== 'Tab') return;
      const fields = [...modal.querySelectorAll('button:not(:disabled), input:not(.hidden), [tabindex="0"]')];
      const first = fields[0]; const last = fields[fields.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    modal?.addEventListener('keydown', keydown);
    modal?.querySelector('button')?.focus();
    return () => { modal?.removeEventListener('keydown', keydown); previous?.focus(); };
  }, [open, onClose, busy]);

  useEffect(() => {
    if (!open) {
      setFile(null); setSheets(''); setResult(null); setError(null); setBusy(false); setDragOver(false)
    }
  }, [open])

  if (!open) return null

  const handleFiles = (files) => {
    const f = files?.[0]
    if (f) setFile(f)
  }

  const handleSubmit = async () => {
    if (!file) return
    setBusy(true); setError(null); setResult(null)
    try {
      const res = await invoiceTrackerService.importExcel(file, sheets.trim())
      setResult(res)
      onImported?.()
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Import failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div ref={modalRef} role="dialog" aria-modal="true" aria-label="Import customer invoices" className="bg-white rounded-xl shadow-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-5 bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-white/15">
              <DocumentArrowUpIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg">Import Customer-Invoice Excel</h3>
              <p className="text-[11px] text-white/80">Bulk upsert by invoice number · headers auto-detected</p>
            </div>
          </div>
          <button aria-label="Close invoice import" disabled={busy} onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/15">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div
            role="button"
            tabIndex={0}
            aria-label="Choose invoice workbook"
            onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); inputRef.current?.click(); } }}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files) }}
            onClick={() => inputRef.current?.click()}
            className={`cursor-pointer rounded-2xl py-10 px-6 text-center border-2 border-dashed transition-all ${
              dragOver
                ? 'border-indigo-500 bg-indigo-50 scale-[1.01]'
                : file
                  ? 'border-emerald-300 bg-emerald-50/50'
                  : 'border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/30'
            }`}
          >
            <div className={`inline-flex p-3 rounded-2xl mb-3 ${
              file ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'
            }`}>
              {file ? <CheckCircleIcon className="w-7 h-7" /> : <ArrowUpTrayIcon className="w-7 h-7" />}
            </div>
            <p className="text-sm font-semibold text-gray-800">
              {file ? file.name : 'Drop your .xlsx file here, or click to browse'}
            </p>
            <p className="text-[11px] text-gray-500 mt-1">
              {file
                ? `${(file.size / 1024).toFixed(1)} KB · ready to import`
                : 'External + Internal sheets supported · header row found automatically'}
            </p>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1.5">
              Restrict to sheets (optional)
            </label>
            <input
              type="text"
              aria-label="Restrict to sheets"
              value={sheets}
              onChange={(e) => setSheets(e.target.value)}
              placeholder="e.g. ExternalInvoice,InternalInvoice2018"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-100 text-sm text-rose-700">
              <ExclamationTriangleIcon className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {result && (
            <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircleIcon className="w-5 h-5 text-emerald-600" />
                <p className="font-bold text-emerald-900">Import complete</p>
              </div>
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="bg-white/70 rounded-lg p-2">
                  <p className="text-[10px] uppercase text-gray-500">Created</p>
                  <p className="text-lg font-extrabold text-emerald-700 tabular-nums">{result.rows_created}</p>
                </div>
                <div className="bg-white/70 rounded-lg p-2">
                  <p className="text-[10px] uppercase text-gray-500">Updated</p>
                  <p className="text-lg font-extrabold text-indigo-700 tabular-nums">{result.rows_updated}</p>
                </div>
                <div className="bg-white/70 rounded-lg p-2">
                  <p className="text-[10px] uppercase text-gray-500">Skipped</p>
                  <p className="text-lg font-extrabold text-gray-600 tabular-nums">{result.rows_skipped}</p>
                </div>
                <div className="bg-white/70 rounded-lg p-2">
                  <p className="text-[10px] uppercase text-gray-500">Errors</p>
                  <p className={`text-lg font-extrabold tabular-nums ${result.errors?.length ? 'text-rose-700' : 'text-gray-400'}`}>
                    {result.errors?.length || 0}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-2">
          <button disabled={busy} onClick={onClose} className="px-4 py-2 text-sm rounded-xl border border-gray-200 text-gray-700 hover:bg-white">
            Close
          </button>
          <button
            onClick={handleSubmit}
            disabled={!file || busy}
            className="px-4 py-2 text-sm rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed shadow-sm inline-flex items-center gap-1.5"
          >
            {busy ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <BoltIcon className="w-4 h-4" />}
            {busy ? 'Importing…' : 'Start Import'}
          </button>
        </div>
      </div>
    </div>
  )
}


ImportExcelModal.propTypes = { open: PropTypes.bool.isRequired, onClose: PropTypes.func.isRequired, onImported: PropTypes.func };

export default function InvoiceTracker() {
  const [importOpen, setImportOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  return <>
    <OutgoingInvoiceWorkspace onImport={() => setImportOpen(true)} reloadKey={reloadKey} />
    <ImportExcelModal open={importOpen} onClose={() => setImportOpen(false)} onImported={() => setReloadKey(value => value + 1)} />
  </>;
}
