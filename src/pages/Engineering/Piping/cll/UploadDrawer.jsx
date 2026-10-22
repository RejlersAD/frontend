// ============================================================================
// §7 Upload drawer (right, 580px + scrim) — segmented per file kind:
//   Process Line List | Stress Criticality
// Step 1 Select file → Step 2 Sheet and header row → Step 3 Column mapping.
// Footer: Cancel · Save without analysing · Upload & run analysis.
// Reuses the existing parsing/mapping code (cllFiles.js + xlsx).
// ============================================================================
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useCll } from './CllStore';
import { useAnalysisSummary } from '../../../../features/critical-line-list/analysis/useAnalysisSummary';
import {
  FILE_KINDS, parseWorkbook, detectHeaderRow, gridToHeadersAndRows,
  guessMapping, applyMapping, downloadTemplate, MAX_FILE_BYTES,
} from './cllFiles';
import { revLetter } from '../../../../features/critical-line-list/analysis/analysisState';

const KINDS = [
  { key: 'processLineList', title: 'Process Line List' },
  { key: 'stressCriticality', title: 'Stress Criticality' },
];

const nextRevLetter = (current) => {
  if (!current) return 'A';
  return String.fromCharCode(Math.min(90, current.toUpperCase().charCodeAt(0) + 1));
};

export default function UploadDrawer() {
  const {
    uploadDrawerOpen, setUploadDrawerOpen,
    drawerFileKind, setDrawerFileKind,
    files, commitFile, showToast, activeProject,
  } = useCll();
  const { runAnalysis, canUpload } = useAnalysisSummary();

  const kind = drawerFileKind || 'processLineList';
  const storeKind = kind === 'processLineList' ? 'lineList' : 'stress';
  const def = FILE_KINDS[storeKind];
  const existing = files[storeKind];
  const existingRev = existing ? revLetter(existing.revision) : null;

  const [st, setSt] = useState({ status: 'idle' });
  const [drag, setDrag] = useState(false);
  const [parseError, setParseError] = useState('');
  const [saveProfile, setSaveProfile] = useState(true);
  const inputRef = useRef(null);

  // Reset when the drawer (re)opens or the segmented kind changes.
  useEffect(() => {
    if (uploadDrawerOpen) { setSt({ status: 'idle' }); setParseError(''); }
  }, [uploadDrawerOpen, kind]);

  const onFile = async (file) => {
    if (!file) return;
    setParseError('');
    setSt({ status: 'loading', fileName: file.name });
    try {
      const wb = await parseWorkbook(file);
      const sheet = wb.sheetNames[0];
      const grid = wb.sheets[sheet];
      const headerRow = detectHeaderRow(grid, def.fields);
      const { headers, rows } = gridToHeadersAndRows(grid, headerRow);
      const mapping = guessMapping(headers, def.fields);
      setSt({ status: 'ready', file, fileName: file.name, wb, sheet, headerRow, headers, rows, mapping, autoGuess: mapping });
    } catch (e) {
      setParseError(e.message);
      setSt({ status: 'idle' });
    }
  };

  const onSheet = (sheet) => {
    const grid = st.wb.sheets[sheet];
    const headerRow = detectHeaderRow(grid, def.fields);
    const { headers, rows } = gridToHeadersAndRows(grid, headerRow);
    const mapping = guessMapping(headers, def.fields);
    setSt({ ...st, sheet, headerRow, headers, rows, mapping, autoGuess: mapping });
  };

  const onHeaderRow = (hr) => {
    const { headers, rows } = gridToHeadersAndRows(st.wb.sheets[st.sheet], hr);
    const mapping = guessMapping(headers, def.fields);
    setSt({ ...st, headerRow: hr, headers, rows, mapping, autoGuess: mapping });
  };

  const validation = useMemo(() => {
    if (st.status !== 'ready') return null;
    return applyMapping(st.rows, st.headers, st.mapping, def.fields);
  }, [st, def]);

  const valErrors = validation?.issues.filter(i => i.severity === 'error') || [];
  const requiredFields = def.fields.filter(f => f.required);
  const mappedRequired = requiredFields.filter(f => st.mapping?.[f.key]).length;
  const allRequiredMapped = st.status === 'ready' && mappedRequired === requiredFields.length;

  if (!uploadDrawerOpen) return null;

  const close = () => setUploadDrawerOpen(false);

  const buildPayload = () => ({
    name: st.fileName, sheet: st.sheet, headerRow: st.headerRow,
    sizeBytes: st.file?.size,
    records: validation.records, issues: validation.issues,
    rawHeaders: st.headers,
    uploadedBy: 'current.user', uploadedAt: new Date().toISOString(),
    rowCount: validation.records.length,
    saveProfile,
  });

  const onSaveOnly = () => {
    commitFile(storeKind, buildPayload(), { analysed: false });
    close();
    showToast({
      title: `Rev ${nextRevLetter(existingRev)} saved · analysis out of date`,
      detail: 'Counts and the review queue are updated',
    });
  };

  const onUploadRun = () => {
    commitFile(storeKind, buildPayload(), { analysed: true });
    close();
    runAnalysis();
    showToast({
      title: 'Uploaded and analysed',
      detail: 'Counts and the review queue are updated',
    });
  };

  const sampleFor = (header) => {
    if (!header || !st.rows?.length) return '—';
    const idx = st.headers.indexOf(header);
    return String(st.rows[0]?.values[idx] ?? '—');
  };

  return (
    <>
      <div className="rd-drawer-backdrop" onClick={close} />
      <aside className="rd-drawer" role="dialog" aria-label="Upload files" style={{ width: 580, maxWidth: '100vw' }}>
        <header className="rd-drawer-header">
          <div>
            <div style={{ fontWeight: 600 }}>Upload files</div>
            <div className="rd-text-muted" style={{ fontSize: 'var(--rd-text-caption)', fontWeight: 400 }}>
              Select a file, confirm the sheet, then check the column mapping
            </div>
          </div>
          <button className="rd-btn rd-btn-ghost rd-btn-sm" onClick={close} aria-label="Close">✕</button>
        </header>

        <div className="rd-drawer-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Segmented file kind */}
          <div style={{ display: 'flex', border: '1px solid var(--rd-border)', borderRadius: 8, overflow: 'hidden' }}>
            {KINDS.map(k => (
              <button key={k.key}
                className={`rd-btn rd-btn-sm ${kind === k.key ? 'rd-btn-primary' : 'rd-btn-ghost'}`}
                style={{ flex: 1, borderRadius: 0, color: kind === k.key ? '#fff' : 'var(--rd-text)' }}
                onClick={() => setDrawerFileKind(k.key)}>
                {k.title}
              </button>
            ))}
          </div>

          {/* Step 1 · Select file */}
          <section>
            <div className="rd-text-muted" style={{ fontSize: 'var(--rd-text-caption)', fontWeight: 600, marginBottom: '0.5rem' }}>
              1 · SELECT FILE
            </div>
            {st.status === 'ready' && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.625rem 0.875rem',
                border: '1px solid var(--rd-border-soft)', borderRadius: 8, marginBottom: '0.625rem',
                background: 'var(--rd-surface-subtle)',
              }}>
                <span style={{
                  width: 36, height: 36, borderRadius: 8, background: 'var(--rd-success)', color: '#fff',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700,
                }}>XLSX</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="rd-mono" style={{ fontSize: 'var(--rd-text-body)', color: 'var(--rd-text)' }}>{st.fileName}</div>
                  <div className="rd-text-muted" style={{ fontSize: 'var(--rd-text-caption)' }}>
                    {st.file ? `${Math.max(1, Math.round(st.file.size / 1024))} KB` : '—'} · {st.rows.length} rows · selected just now
                  </div>
                </div>
                <span className="rd-pill rd-pill-success">Ready</span>
              </div>
            )}
            <div
              className={`rd-dropzone ${drag ? 'rd-dropzone-active' : ''}`}
              onDragOver={e => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={e => { e.preventDefault(); setDrag(false); onFile(e.dataTransfer.files?.[0]); }}
              onClick={() => inputRef.current?.click()}
              style={{ textAlign: 'center', padding: '1.5rem 1rem' }}
            >
              <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
                onChange={e => onFile(e.target.files?.[0])} />
              {st.status === 'loading' ? 'Parsing…' : (
                <>
                  <div>{existing ? 'Drop a newer revision here, or browse' : 'Drop the file here, or browse'}</div>
                  <div className="rd-text-muted" style={{ fontSize: 'var(--rd-text-caption)' }}>
                    .xlsx, .xls, .csv · max {Math.round(MAX_FILE_BYTES / 1048576)} MB ·{' '}
                    <button type="button" className="rd-btn-ghost" style={{ fontSize: 'inherit', padding: 0, minHeight: 0, textDecoration: 'underline' }}
                      onClick={e => { e.stopPropagation(); downloadTemplate(storeKind); }}>Download template</button>
                  </div>
                </>
              )}
            </div>
            {parseError && <div className="rd-banner rd-banner-danger" style={{ marginTop: '0.5rem' }}>{parseError}</div>}

            <label className="rd-text-muted" style={{ display: 'block', fontSize: 'var(--rd-text-caption)', marginTop: '0.75rem' }}>
              Revision
              <input className="rd-input" readOnly value={nextRevLetter(existingRev)}
                title="Auto-suggested next revision letter"
                style={{ marginTop: 4, width: 80, textAlign: 'center', background: 'var(--rd-surface-subtle)' }} />
            </label>
          </section>

          {st.status === 'ready' && (
            <>
              {/* Step 2 · Sheet and header row */}
              <section>
                <div className="rd-text-muted" style={{ fontSize: 'var(--rd-text-caption)', fontWeight: 600, marginBottom: '0.5rem' }}>
                  2 · SHEET AND HEADER ROW
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <label style={{ flex: 1, fontSize: 'var(--rd-text-caption)' }} className="rd-text-muted">
                    Sheet
                    <select className="rd-select" value={st.sheet} onChange={e => onSheet(e.target.value)} style={{ marginTop: 4 }}>
                      {st.wb.sheetNames.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </label>
                  <label style={{ width: 160, fontSize: 'var(--rd-text-caption)' }} className="rd-text-muted">
                    Header row (auto-detected)
                    <input type="number" min={1} className="rd-input" value={st.headerRow + 1} style={{ marginTop: 4 }}
                      onChange={e => onHeaderRow(Math.max(0, (parseInt(e.target.value, 10) || 1) - 1))} />
                  </label>
                </div>
                <div style={{ overflow: 'auto', maxHeight: 160, border: '1px solid var(--rd-border-soft)', borderRadius: 8, marginTop: '0.625rem' }}>
                  <table className="rd-table">
                    <thead><tr>{st.headers.map(h => <th key={h}>{h}</th>)}</tr></thead>
                    <tbody>
                      {st.rows.slice(0, 8).map(r => (
                        <tr key={r.excelRow}>{st.headers.map((h, i) => <td key={h} className="rd-mono">{String(r.values[i] ?? '')}</td>)}</tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Step 3 · Column mapping */}
              <section>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <div className="rd-text-muted" style={{ fontSize: 'var(--rd-text-caption)', fontWeight: 600, flex: 1 }}>
                    3 · COLUMN MAPPING
                  </div>
                  <span className={`rd-pill ${allRequiredMapped && valErrors.length === 0 ? 'rd-pill-success' : valErrors.length ? 'rd-pill-danger' : 'rd-pill-warning'}`}>
                    {mappedRequired} of {requiredFields.length} required mapped
                    {valErrors.length > 0 ? ` · ${valErrors.length} value errors` : ''}
                  </span>
                </div>
                <div style={{ border: '1px solid var(--rd-border-soft)', borderRadius: 8, overflow: 'hidden' }}>
                  <table className="rd-table">
                    <thead>
                      <tr><th>Column in file</th><th>RADAI field</th><th>Sample</th><th>Status</th></tr>
                    </thead>
                    <tbody>
                      {def.fields.map(f => {
                        const mappedHeader = st.mapping[f.key];
                        const isAuto = !!(st.autoGuess?.[f.key] && mappedHeader === st.autoGuess[f.key]);
                        const status = !mappedHeader
                          ? (f.required ? { label: 'Not mapped', pill: 'rd-pill-danger' } : { label: 'Optional', pill: 'rd-pill-neutral' })
                          : isAuto ? { label: 'Auto-mapped', pill: 'rd-pill-success' }
                            : f.required ? { label: 'Mapped', pill: 'rd-pill-success' } : { label: 'Optional', pill: 'rd-pill-neutral' };
                        return (
                          <tr key={f.key}>
                            <td style={{ minWidth: 150 }}>
                              <select className={`rd-select ${f.required && !mappedHeader ? 'rd-input-error' : ''}`}
                                style={{ minHeight: 32 }}
                                value={mappedHeader || ''}
                                onChange={e => setSt({ ...st, mapping: { ...st.mapping, [f.key]: e.target.value || undefined } })}>
                                <option value="">— not mapped —</option>
                                {st.headers.map(h => <option key={h}>{h}</option>)}
                              </select>
                            </td>
                            <td style={{ color: 'var(--rd-text)', whiteSpace: 'nowrap' }}>
                              {f.label}{f.required && <span style={{ color: 'var(--rd-danger)' }}> *</span>}
                            </td>
                            <td className="rd-mono rd-text-muted" style={{ fontSize: 'var(--rd-text-caption)', maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {sampleFor(mappedHeader)}
                            </td>
                            <td><span className={`rd-pill ${status.pill}`} style={{ whiteSpace: 'nowrap' }}>{status.label}</span></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: '0.625rem', fontSize: 'var(--rd-text-caption)', color: 'var(--rd-text)' }}>
                  <input type="checkbox" checked={saveProfile} onChange={e => setSaveProfile(e.target.checked)} />
                  Save this mapping as a profile for project {activeProject?.name || activeProject?.id || '—'}
                </label>
                {validation && valErrors.length > 0 && (
                  <div style={{ maxHeight: 90, overflow: 'auto', marginTop: '0.5rem', fontSize: 'var(--rd-text-caption)' }}>
                    {valErrors.map((e, i) => <div key={i} style={{ color: 'var(--rd-danger)' }}>{e.message}</div>)}
                  </div>
                )}
              </section>
            </>
          )}
        </div>

        <footer className="rd-drawer-footer" style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="rd-btn rd-btn-ghost" onClick={close} style={{ marginRight: 'auto' }}>Cancel</button>
          <button className="rd-btn rd-btn-secondary" disabled={!allRequiredMapped || !canUpload} onClick={onSaveOnly}>
            Save without analysing
          </button>
          <button className="rd-btn rd-btn-primary" disabled={!allRequiredMapped || !canUpload}
            title={!allRequiredMapped ? 'Map all required columns first' : undefined}
            onClick={onUploadRun}>
            Upload &amp; run analysis
          </button>
        </footer>
      </aside>
    </>
  );
}
