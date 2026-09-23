/* eslint-disable react/prop-types */
import { useEffect, useRef, useState } from 'react';
import { ArrowUpTrayIcon } from '@heroicons/react/24/outline';
import apiClient from '../../services/api.service';
import { formatDate, formatNumber } from '../../pages/Executive/executivePresentation';
import './PortfolioWorkbookUpload.css';

const MAX_WORKBOOK_BYTES = 25 * 1024 * 1024;
const UPLOAD_ENDPOINT = '/dashboard/executive/portfolio-workbook/';

function uploadError(problem, fallback) {
  const data = problem?.response?.data;
  if (typeof data?.detail === 'string') return data.detail;
  if (typeof data?.error === 'string') return data.error;
  for (const field of ['file', 'preview_token']) {
    if (typeof data?.[field] === 'string') return data[field];
    if (Array.isArray(data?.[field])) return data[field].join(' ');
  }
  if (problem?.response?.status === 413) return 'The workbook exceeds the upload limit. Choose an .xlsx file up to 25 MB.';
  if (problem?.response?.status === 403) return 'You do not have permission to import this workbook.';
  return fallback;
}

function warningText(warning) {
  if (typeof warning === 'string') return warning;
  return [warning?.sheet, warning?.cell, String(warning?.field || '').replaceAll('_', ' '), String(warning?.message || warning?.code || 'Workbook validation warning').replaceAll('_', ' ')].filter(Boolean).join(' · ');
}

export default function PortfolioWorkbookUpload({ onImported }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [phase, setPhase] = useState('idle');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [refreshFailed, setRefreshFailed] = useState(false);
  const request = useRef({ generation: 0, controller: null });
  const input = useRef(null);
  const committed = useRef(false);
  const importing = phase === 'importing' || phase === 'refreshing';
  const busy = phase !== 'idle';
  useEffect(() => () => { request.current.generation += 1; request.current.controller?.abort(); }, []);
  useEffect(() => { if (open) input.current?.focus(); }, [open]);

  const resetPreview = () => {
    request.current.generation += 1;
    request.current.controller?.abort();
    setPreview(null); setError(''); setPhase('idle');
  };
  const chooseFile = event => {
    resetPreview(); setSuccess(''); setRefreshFailed(false); committed.current = false;
    const selected = event.target.files?.[0] || null;
    setFile(null);
    if (!selected) return;
    if (!/\.xlsx$/i.test(selected.name)) { setError('Choose an Excel workbook in .xlsx format.'); return; }
    if (!selected.size || selected.size > MAX_WORKBOOK_BYTES) { setError('Choose a non-empty .xlsx file up to 25 MB.'); return; }
    setFile(selected);
  };
  const previewFile = async event => {
    event.preventDefault();
    if (!file || busy) return;
    resetPreview();
    const generation = request.current.generation;
    const controller = new AbortController(); request.current.controller = controller;
    setPhase('previewing');
    const payload = new FormData(); payload.append('file', file);
    try {
      const { data } = await apiClient.post(`${UPLOAD_ENDPOINT}preview/`, payload, { signal: controller.signal, timeout: 120000 });
      if (request.current.generation !== generation) return;
      if (!data?.preview_token) throw new Error('No preview token');
      setPreview(data);
    } catch (problem) {
      if (request.current.generation === generation) setError(uploadError(problem, 'The workbook could not be previewed. Check the file and try again.'));
    } finally {
      if (request.current.generation === generation) setPhase('idle');
    }
  };
  const refreshReport = async () => {
    setPhase('refreshing'); setRefreshFailed(false); setError('');
    try { await onImported?.(); }
    catch { setRefreshFailed(true); setError('The workbook was imported, but its status could not refresh. Retry to see the latest workbook.'); }
    finally { setPhase('idle'); }
  };
  const importFile = async event => {
    event.preventDefault();
    if (!file || !preview?.preview_token || busy || committed.current) return;
    setPhase('importing'); setError('');
    const payload = new FormData(); payload.append('file', file); payload.append('preview_token', preview.preview_token);
    try {
      const { data } = await apiClient.post(`${UPLOAD_ENDPOINT}import/`, payload, { timeout: 120000 });
      committed.current = true;
      setSuccess(`${data.file_name || file.name} ${data.created === false && data.activated === false ? 'was already the active workbook' : 'was imported'} · As of ${formatDate(data.reporting_date || preview.reporting_date)} · ${formatNumber(data.row_count ?? preview.row_count)} rows.`);
      setOpen(false); setFile(null); setPreview(null);
      await refreshReport();
    } catch (problem) {
      setError(uploadError(problem, 'The import could not be confirmed. Refresh the dashboard to check its status before trying again.'));
      setPreview(null);
      setPhase('idle');
    }
  };
  const warnings = Array.isArray(preview?.warnings) ? preview.warnings : [];

  return <section className="portfolio-workbook-upload" aria-label="Upload portfolio workbook" data-testid="portfolio-workbook-upload">
    <div className="pwu-heading"><div><strong>Portfolio workbook upload</strong><p>Upload and validate the latest POC workbook.</p></div><button type="button" className="pwu-button pwu-button--primary" aria-expanded={open} aria-controls="pwu-form" disabled={open || busy} onClick={() => { setOpen(true); setError(''); setSuccess(''); }}><ArrowUpTrayIcon aria-hidden="true" />Upload Excel workbook</button></div>
    {success && <p className="pwu-success" role="status">{success}</p>}
    {error && <p className="pwu-error" role="alert">{error}</p>}
    {refreshFailed && <button type="button" className="pwu-button" disabled={busy} onClick={refreshReport}>Retry workbook refresh</button>}
    {phase === 'refreshing' && <p role="status">Refreshing workbook status…</p>}
    {open && <form id="pwu-form" onSubmit={previewFile} aria-busy={busy}>
      <label className="pwu-file">Excel workbook (.xlsx)<input ref={input} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={importing} onChange={chooseFile} aria-describedby="pwu-file-help" /></label>
      <p id="pwu-file-help" className="pwu-note">Maximum 25 MB. Choose the POC workbook with its saved formula results.</p>
      {preview && <div className="pwu-preview" aria-label="Workbook import preview">
        <h3>Workbook import preview</h3>
        <dl><div><dt>File</dt><dd>{preview.file_name || file?.name}</dd></div><div><dt>Reporting date</dt><dd>{formatDate(preview.reporting_date)}</dd></div><div><dt>Source rows</dt><dd>{formatNumber(preview.row_count)}</dd></div>{preview.reconciliation?.project_count != null && <div><dt>Projects</dt><dd>{formatNumber(preview.reconciliation.project_count)}</dd></div>}</dl>
        {warnings.length ? <details className="pwu-preview-warnings"><summary>Review {formatNumber(warnings.length)} validation warnings</summary><ul>{warnings.slice(0, 50).map((warning, index) => <li key={index}>{warningText(warning)}</li>)}</ul>{warnings.length > 50 && <p>Showing the first 50 warnings. All warnings are retained with the imported workbook.</p>}</details> : <p>No validation warnings.</p>}
        <p className="pwu-note">Confirming saves this workbook as the current portfolio source. Missing values remain blank.</p>
      </div>}
      <div className="pwu-actions">
        {preview ? <button type="button" className="pwu-button pwu-button--primary" disabled={busy} onClick={importFile}>{phase === 'importing' ? 'Importing workbook…' : 'Confirm import'}</button> : <button type="submit" className="pwu-button pwu-button--primary" disabled={!file || busy}>{phase === 'previewing' ? 'Reading workbook…' : 'Preview workbook'}</button>}
        <button type="button" className="pwu-button" disabled={importing} onClick={() => { resetPreview(); setFile(null); setOpen(false); }}>Cancel upload</button>
      </div>
    </form>}
  </section>;
}
