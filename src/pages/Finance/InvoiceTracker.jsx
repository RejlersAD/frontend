import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { ArrowPathIcon, ArrowUpTrayIcon, BoltIcon, CheckCircleIcon, DocumentArrowUpIcon, ExclamationTriangleIcon, XMarkIcon } from '@heroicons/react/24/outline';
import invoiceTrackerService from '../../services/invoiceTracker.service';
import OutgoingInvoiceWorkspace from '../../components/Finance/OutgoingInvoiceWorkspace';

const ImportExcelModal = ({ open, onClose, onImported }) => {
  const [file, setFile]         = useState(null)
  const [mode, setMode]         = useState('workbook')
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
      const fields = [...modal.querySelectorAll('button:not(:disabled), input:not(:disabled):not(.hidden), a[href], [tabindex="0"]')].filter(element => element.getClientRects().length > 0);
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
      setFile(null); setMode('workbook'); setSheets(''); setResult(null); setError(null); setBusy(false); setDragOver(false)
    }
  }, [open])

  if (!open) return null

  const handleFiles = (files) => {
    if (busy) return
    const f = files?.[0]
    if (!f) return
    setResult(null)
    if (!/\.xlsx$/i.test(f.name)) {
      setFile(null); setError('Choose an Excel workbook (.xlsx).')
    } else {
      setFile(f); setError(null)
    }
    if (inputRef.current) inputRef.current.value = ''
  }

  const handleSubmit = async () => {
    if (!file || busy) return
    setBusy(true); setError(null); setResult(null)
    let imported
    try {
      const res = await invoiceTrackerService.importExcel(file, { mode, sheets: sheets.trim() })
      if (mode === 'workbook' && (res?.mode !== 'workbook' || !Number.isInteger(res.rows_published) || res.rows_published <= 0)) {
        throw new Error('The upload response did not confirm publication. Check receivables before trying again.')
      }
      setResult(res)
      imported = res
    } catch (err) {
      const detail = err?.response?.data
      const message = typeof detail === 'string' ? detail : detail?.detail || detail?.error
      const fields = detail && typeof detail === 'object' ? Object.values(detail).flat().filter(value => typeof value === 'string').join(' ') : ''
      setError(typeof message === 'string' ? message : fields || err?.message || 'The workbook could not be imported. Please try again.')
    } finally {
      setBusy(false)
    }
    // Publication is complete even if a subsequent register refresh fails.
    if (imported) onImported?.(imported)
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
              <h3 className="font-bold text-lg">Import invoice workbook</h3>
              <p className="text-[11px] text-white/80">Choose where to use your workbook</p>
            </div>
          </div>
          <button aria-label="Close invoice import" disabled={busy} onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/15">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <fieldset disabled={busy} className="space-y-2">
            <legend className="mb-2 text-sm font-semibold text-gray-800">Import purpose</legend>
            {[
              ['workbook', 'Receivables reporting', 'Publish the External Invoice sheet to the receivables dashboards.'],
              ['operational', 'Invoice register', 'Add or update invoices in the collection register.'],
            ].map(([value, label, description]) => <label key={value} className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 p-3">
              <input type="radio" name="invoice-import-purpose" value={value} checked={mode === value} onChange={() => { setMode(value); setResult(null); setError(null); }} className="mt-1" />
              <span><span className="block text-sm font-semibold text-gray-800">{label}</span><span className="block text-xs text-gray-600">{description}</span></span>
            </label>)}
          </fieldset>
          <div
            role="button"
            tabIndex={busy ? -1 : 0}
            aria-disabled={busy}
            aria-label="Choose invoice workbook"
            onKeyDown={event => { if (!busy && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); inputRef.current?.click(); } }}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files) }}
            onClick={() => { if (!busy) inputRef.current?.click(); }}
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
                : mode === 'workbook' ? 'External Invoice sheet · .xlsx format' : 'External and internal sheets · .xlsx format'}
            </p>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx"
              disabled={busy}
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
          </div>

          {mode === 'operational' && <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1.5">
              Restrict to sheets (optional)
            </label>
            <input
              type="text"
              aria-label="Restrict to sheets"
              value={sheets}
              disabled={busy}
              onChange={(e) => setSheets(e.target.value)}
              placeholder="e.g. ExternalInvoice,InternalInvoice2018"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
          </div>}

          {error && (
            <div role="alert" className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-100 text-sm text-rose-700">
              <ExclamationTriangleIcon className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {result && (
            <div role="status" className="rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircleIcon className="w-5 h-5 text-emerald-600" />
                <p className="font-bold text-emerald-900">{result.mode === 'workbook' ? `${result.rows_published.toLocaleString('en-GB')} invoice rows published` : 'Import complete'}</p>
              </div>
              {result.mode === 'workbook' ? <p className="text-sm text-emerald-900">Receivables now uses {result.source?.file_name || file.name}.</p> : <div className="grid grid-cols-4 gap-2 text-center">
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
              </div>}
            </div>
          )}
        </div>

        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-2">
          <button disabled={busy} onClick={onClose} className="px-4 py-2 text-sm rounded-xl border border-gray-200 text-gray-700 hover:bg-white">
            Close
          </button>
          {result?.mode === 'workbook' ? <Link to="/finance" onClick={onClose} className="px-4 py-2 text-sm rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-500">View receivables</Link> : <button
            onClick={handleSubmit}
            disabled={!file || busy}
            className="px-4 py-2 text-sm rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed shadow-sm inline-flex items-center gap-1.5"
          >
            {busy ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <BoltIcon className="w-4 h-4" />}
            {busy ? mode === 'workbook' ? 'Publishing…' : 'Importing…' : mode === 'workbook' ? 'Publish workbook' : 'Start import'}
          </button>}
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
