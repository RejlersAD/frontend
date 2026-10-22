// ============================================================================
// Upload drawer (right, 580px + scrim) — segmented per file kind:
//   Process Line List (LDT) | Stress criticality criteria
//
// LDT:      Step 1 Select file → Step 2 Sheet + header/units rows →
//           Step 3 27-row column mapping (pill "10 of 10 required mapped").
// Criteria: Step 1 Select file (Onshore note about the built-in table) →
//           Step 2 Sheet → Step 3 Grid check (13 × 15 heat-map + status).
// Wrong-type criteria upload is blocking:
//   "This criteria table is ONSHORE; the project is OFFSHORE."
// ============================================================================
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useCll } from './CllStore';
import { useAnalysisSummary } from '../../../../features/critical-line-list/analysis/useAnalysisSummary';
import {
  parseWorkbook, detectLdtSheet, detectLdtHeaderRow, guessLdtMapping,
  parseLdtSheet, detectCriteriaSheet, parseCriteriaSheet, ignoredSheetNotes,
  downloadLdtTemplate, LDT_FIELDS, MAX_FILE_BYTES,
} from './cllFiles';
import { CATEGORY_SOFT } from './criticalityEngine';
import { revLetter } from '../../../../features/critical-line-list/analysis/analysisState';

const KINDS = [
  { key: 'processLineList', title: 'Process Line List (LDT)' },
  { key: 'stressCriteria', title: 'Stress criticality criteria' },
];

const nextRevLetter = (current) => {
  if (!current) return 'A';
  return String.fromCharCode(Math.min(90, String(current).toUpperCase().charCodeAt(0) + 1));
};

/** §3 drawer step 3 — 13 × 15 criteria-grid heat-map. */
function GridCheck({ parsed }) {
  const { table, errors } = parsed;
  const invalidCells = errors.filter(e => e.type === 'grid-value' || e.type === 'grid-empty').length;
  const grid = table?.grid || [];
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <span className={`rd-pill ${parsed.valid ? 'rd-pill-success' : 'rd-pill-danger'}`}>
          {parsed.valid ? '13 × 15 grid · valid' : `${invalidCells || errors.length} invalid cells`}
        </span>
        {parsed.standard && (
          <span className="rd-text-muted" style={{ fontSize: 'var(--rd-text-caption)' }}>
            {parsed.standard}{parsed.revision ? ` Rev ${parsed.revision}` : ''}
          </span>
        )}
      </div>
      {grid.length === 13 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', fontSize: 10.5 }}>
            <thead>
              <tr>
                <th className="rd-text-muted" style={{ padding: 2, textAlign: 'right' }}>NPS</th>
                {(table.tempLabels || []).map((t, i) => (
                  <th key={i} className="rd-text-muted" style={{ padding: 2, fontWeight: 400, minWidth: 26 }}
                    title={`Design T ≤ ${table.tempLimits?.[i]} °C`}>
                    {t.replace(' and below', '↓').replace(' and above', '+')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grid.map((row, ri) => (
                <tr key={ri}>
                  <td className="rd-mono" style={{ padding: 2, textAlign: 'right', color: 'var(--rd-text)' }}>
                    {table.npsRowLabels?.[ri] || (ri === 12 ? '≥24' : table.npsRows?.[ri])}
                  </td>
                  {row.map((cell, ci) => (
                    <td key={ci} className="rd-mono" style={{
                      padding: '1px 4px', textAlign: 'center', borderRadius: 2,
                      background: CATEGORY_SOFT[cell] || 'var(--rd-danger-soft)',
                      color: cell ? 'var(--rd-text)' : 'var(--rd-danger)',
                      fontWeight: cell ? 500 : 700,
                    }}>
                      {cell || '!'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {errors.length > 0 && (
        <div style={{ maxHeight: 90, overflow: 'auto', marginTop: 8, fontSize: 'var(--rd-text-caption)' }}>
          {errors.map((e, i) => <div key={i} style={{ color: 'var(--rd-danger)' }}>{e.message}</div>)}
        </div>
      )}
      {parsed.warnings?.map((w, i) => (
        <div key={i} style={{ color: 'var(--rd-warning)', fontSize: 'var(--rd-text-caption)', marginTop: 4 }}>{w.message}</div>
      ))}
    </div>
  );
}

export default function UploadDrawer() {
  const {
    uploadDrawerOpen, setUploadDrawerOpen,
    drawerFileKind, setDrawerFileKind,
    files, commitLineList, commitCriteria, showToast, activeProject,
  } = useCll();
  const { runAnalysis, canUpload } = useAnalysisSummary();

  const kind = drawerFileKind || 'processLineList';
  const isLdt = kind === 'processLineList';
  const existing = isLdt ? files.lineList : files.criteriaFile;
  const existingRev = existing ? revLetter(existing.revision) : null;

  const [st, setSt] = useState({ status: 'idle' });
  const [drag, setDrag] = useState(false);
  const [parseError, setParseError] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (uploadDrawerOpen) { setSt({ status: 'idle' }); setParseError(''); }
  }, [uploadDrawerOpen, kind]);

  // --- file parsing per kind ---
  const onFile = async (file) => {
    if (!file) return;
    setParseError('');
    setSt({ status: 'loading', fileName: file.name });
    try {
      const wb = await parseWorkbook(file);
      if (isLdt) {
        const sheet = detectLdtSheet(wb);
        const grid = wb.sheets[sheet];
        const headerRow = detectLdtHeaderRow(grid);
        const headers = (grid[headerRow] || []).map((h, i) => String(h).trim() || `col_${i + 1}`);
        const mapping = guessLdtMapping(headers);
        setSt({ status: 'ready', file, fileName: file.name, wb, sheet, headerRow, headers, mapping, autoGuess: mapping });
      } else {
        const sheet = detectCriteriaSheet(wb) || wb.sheetNames[0];
        const parsed = parseCriteriaSheet(wb.sheets[sheet], activeProject?.locationType);
        parsed.info = [...ignoredSheetNotes(wb, sheet), ...(parsed.info || [])];
        setSt({ status: 'ready', file, fileName: file.name, wb, sheet, parsed });
      }
    } catch (e) {
      setParseError(e.message);
      setSt({ status: 'idle' });
    }
  };

  const onSheetLdt = (sheet) => {
    const grid = st.wb.sheets[sheet];
    const headerRow = detectLdtHeaderRow(grid);
    const headers = (grid[headerRow] || []).map((h, i) => String(h).trim() || `col_${i + 1}`);
    const mapping = guessLdtMapping(headers);
    setSt({ ...st, sheet, headerRow, headers, mapping, autoGuess: mapping });
  };

  const onHeaderRow = (hr) => {
    const grid = st.wb.sheets[st.sheet];
    const headers = (grid[hr] || []).map((h, i) => String(h).trim() || `col_${i + 1}`);
    const mapping = guessLdtMapping(headers);
    setSt({ ...st, headerRow: hr, headers, mapping, autoGuess: mapping });
  };

  const onSheetCriteria = (sheet) => {
    const parsed = parseCriteriaSheet(st.wb.sheets[sheet], activeProject?.locationType);
    parsed.info = [...ignoredSheetNotes(st.wb, sheet), ...(parsed.info || [])];
    setSt({ ...st, sheet, parsed });
  };

  // --- LDT live parse / validation ---
  const ldtParsed = useMemo(() => {
    if (!isLdt || st.status !== 'ready' || !st.mapping || !st.wb?.sheets?.[st.sheet]) return null;
    return parseLdtSheet(st.wb.sheets[st.sheet], st.headerRow, st.mapping);
  }, [isLdt, st]);

  const ldtErrors = ldtParsed?.issues.filter(i => i.severity === 'error') || [];
  const mappedRequired = LDT_FIELDS.filter(f => f.required && st.mapping?.[f.key] != null).length;
  const allRequiredMapped = isLdt && st.status === 'ready' && mappedRequired === LDT_FIELDS.filter(f => f.required).length;
  const criteriaValid = !isLdt && st.status === 'ready' && st.parsed?.valid;

  if (!uploadDrawerOpen) return null;

  const close = () => setUploadDrawerOpen(false);

  const buildLdtPayload = () => ({
    name: st.fileName, sheet: st.sheet, headerRow: st.headerRow,
    sizeBytes: st.file?.size,
    records: ldtParsed.records, issues: ldtParsed.issues,
    rawHeaders: st.headers,
    requiredMapped: mappedRequired,
    uploadedBy: 'current.user', uploadedAt: new Date().toISOString(),
    rowCount: ldtParsed.records.length,
  });

  const onSaveOnly = () => {
    commitLineList(buildLdtPayload(), { analysed: false });
    close();
    showToast({
      title: `Rev ${nextRevLetter(existingRev)} saved · analysis out of date`,
      detail: 'Counts and the review queue are updated',
    });
  };

  const onUploadRun = () => {
    commitLineList(buildLdtPayload(), { analysed: true });
    close();
    runAnalysis();
    showToast({ title: 'Uploaded and analysed', detail: 'Counts and the review queue are updated' });
  };

  const onCommitCriteria = () => {
    commitCriteria({
      name: st.fileName, sheet: st.sheet, sizeBytes: st.file?.size,
      errors: st.parsed.errors.length, warnings: st.parsed.warnings.length,
      uploadedBy: 'current.user', uploadedAt: new Date().toISOString(),
    }, st.parsed.table);
    close();
    runAnalysis();
    showToast({
      title: 'Criteria table uploaded',
      detail: `${st.parsed.standard || 'Criteria'}${st.parsed.revision ? ` Rev ${st.parsed.revision}` : ''} now applies to all lines`,
    });
  };

  const sampleFor = (idx) => {
    if (idx == null || !ldtParsed?.records?.length) return '—';
    const rec = ldtParsed.records[0];
    const key = LDT_FIELDS.find(f => st.mapping[f.key] === idx)?.key;
    return key ? String(rec[key] ?? '—') : '—';
  };

  const footerDisabled = isLdt ? (!allRequiredMapped || ldtErrors.length > 0 || !canUpload) : (!criteriaValid || !canUpload);

  return (
    <>
      <div className="rd-drawer-backdrop" onClick={close} />
      <aside className="rd-drawer" role="dialog" aria-label="Upload files" style={{ width: 580, maxWidth: '100vw' }}>
        <header className="rd-drawer-header">
          <div>
            <div style={{ fontWeight: 600 }}>Upload files</div>
            <div className="rd-text-muted" style={{ fontSize: 'var(--rd-text-caption)', fontWeight: 400 }}>
              Select a file, confirm the sheet, then check the {isLdt ? 'column mapping' : 'criteria grid'}
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
                onClick={() => { setDrawerFileKind(k.key); setSt({ status: 'idle' }); setParseError(''); }}>
                {k.title}
              </button>
            ))}
          </div>

          {/* Onshore note above criteria step 1 */}
          {!isLdt && activeProject?.locationType === 'onshore' && (
            <div className="rd-banner rd-banner-info" style={{ fontSize: 'var(--rd-text-caption)' }}>
              Built-in AGPS-SP-PI-004 Rev 01 Table 2 is in use. Upload only if the project uses a different revision.
            </div>
          )}

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
                    {st.file ? `${Math.max(1, Math.round(st.file.size / 1024))} KB` : '—'} · selected just now
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
                    .xlsx, .xls, .csv · max {Math.round(MAX_FILE_BYTES / 1048576)} MB
                    {isLdt && (
                      <> ·{' '}
                        <button type="button" className="rd-btn-ghost" style={{ fontSize: 'inherit', padding: 0, minHeight: 0, textDecoration: 'underline' }}
                          onClick={e => { e.stopPropagation(); downloadLdtTemplate(); }}>Download template</button>
                      </>
                    )}
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

          {st.status === 'ready' && isLdt && (
            <>
              {/* Step 2 · Sheet and header row */}
              <section>
                <div className="rd-text-muted" style={{ fontSize: 'var(--rd-text-caption)', fontWeight: 600, marginBottom: '0.5rem' }}>
                  2 · SHEET AND HEADER ROW
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}>
                  <label style={{ flex: 1, fontSize: 'var(--rd-text-caption)' }} className="rd-text-muted">
                    Sheet
                    <select className="rd-select" value={st.sheet} onChange={e => onSheetLdt(e.target.value)} style={{ marginTop: 4 }}>
                      {st.wb.sheetNames.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </label>
                  <label style={{ width: 140, fontSize: 'var(--rd-text-caption)' }} className="rd-text-muted">
                    Header row
                    <input type="number" min={1} className="rd-input" value={st.headerRow + 1} style={{ marginTop: 4 }}
                      onChange={e => onHeaderRow(Math.max(0, (parseInt(e.target.value, 10) || 1) - 1))} />
                  </label>
                  <span className="rd-pill rd-pill-neutral" style={{ whiteSpace: 'nowrap' }}>
                    Header row {st.headerRow + 1} · units row {st.headerRow + 2}
                  </span>
                </div>
                <div style={{ overflow: 'auto', maxHeight: 160, border: '1px solid var(--rd-border-soft)', borderRadius: 8, marginTop: '0.625rem' }}>
                  <table className="rd-table">
                    <thead><tr>{st.headers.map(h => <th key={h}>{h}</th>)}</tr></thead>
                    <tbody>
                      {(st.wb.sheets[st.sheet] || []).slice(st.headerRow + 2, st.headerRow + 10).map((r, i) => (
                        <tr key={i}>{st.headers.map((h, j) => <td key={h} className="rd-mono">{String(r[j] ?? '')}</td>)}</tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Step 3 · Column mapping (27 rows) */}
              <section>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <div className="rd-text-muted" style={{ fontSize: 'var(--rd-text-caption)', fontWeight: 600, flex: 1 }}>
                    3 · COLUMN MAPPING
                  </div>
                  <span className={`rd-pill ${allRequiredMapped && ldtErrors.length === 0 ? 'rd-pill-success' : ldtErrors.length ? 'rd-pill-danger' : 'rd-pill-warning'}`}>
                    {mappedRequired} of 10 required mapped
                    {ldtErrors.length > 0 ? ` · ${ldtErrors.length} errors` : ''}
                  </span>
                </div>
                <div style={{ border: '1px solid var(--rd-border-soft)', borderRadius: 8, overflow: 'hidden' }}>
                  <table className="rd-table">
                    <thead>
                      <tr><th>Col</th><th>RADAI field</th><th>Unit</th><th>Column in file</th><th>Sample</th></tr>
                    </thead>
                    <tbody>
                      {LDT_FIELDS.map(f => {
                        const mappedIdx = st.mapping[f.key];
                        const mappedHeader = mappedIdx != null ? st.headers[mappedIdx] : null;
                        const isAuto = mappedIdx != null && st.autoGuess?.[f.key] === mappedIdx;
                        return (
                          <tr key={f.key}>
                            <td className="rd-mono rd-text-muted">{f.col}</td>
                            <td style={{ color: 'var(--rd-text)', whiteSpace: 'nowrap' }}>
                              {f.label}{f.required && <span style={{ color: 'var(--rd-danger)' }}> *</span>}
                            </td>
                            <td className="rd-text-muted" style={{ fontSize: 'var(--rd-text-caption)' }}>{f.unit || ''}</td>
                            <td style={{ minWidth: 150 }}>
                              <select className={`rd-select ${f.required && mappedIdx == null ? 'rd-input-error' : ''}`}
                                style={{ minHeight: 32 }}
                                value={mappedIdx ?? ''}
                                onChange={e => setSt({
                                  ...st,
                                  mapping: { ...st.mapping, [f.key]: e.target.value === '' ? null : parseInt(e.target.value, 10) },
                                })}>
                                <option value="">— not mapped —</option>
                                {st.headers.map((h, i) => <option key={h} value={i}>{h}</option>)}
                              </select>
                            </td>
                            <td className="rd-mono rd-text-muted" style={{ fontSize: 'var(--rd-text-caption)', maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis' }}
                              title={isAuto ? 'Auto-mapped' : undefined}>
                              {sampleFor(mappedIdx)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {ldtParsed && ldtErrors.length > 0 && (
                  <div style={{ maxHeight: 90, overflow: 'auto', marginTop: '0.5rem', fontSize: 'var(--rd-text-caption)' }}>
                    {ldtErrors.map((e, i) => <div key={i} style={{ color: 'var(--rd-danger)' }}>{e.message}</div>)}
                  </div>
                )}
                {ldtParsed && ldtErrors.length === 0 && (
                  <div className="rd-text-muted" style={{ fontSize: 'var(--rd-text-caption)', marginTop: '0.5rem' }}>
                    {ldtParsed.records.length.toLocaleString()} lines ·{' '}
                    {ldtParsed.issues.filter(i => i.severity === 'warning').length} warnings · 0 errors
                  </div>
                )}
              </section>
            </>
          )}

          {st.status === 'ready' && !isLdt && (
            <>
              {/* Step 2 · Sheet */}
              <section>
                <div className="rd-text-muted" style={{ fontSize: 'var(--rd-text-caption)', fontWeight: 600, marginBottom: '0.5rem' }}>
                  2 · SHEET
                </div>
                <label style={{ fontSize: 'var(--rd-text-caption)' }} className="rd-text-muted">
                  Criteria sheet
                  <select className="rd-select" value={st.sheet} onChange={e => onSheetCriteria(e.target.value)} style={{ marginTop: 4 }}>
                    {st.wb.sheetNames.map(s => <option key={s}>{s}</option>)}
                  </select>
                </label>
                {(st.parsed?.info || []).map((n, i) => (
                  <div key={i} className="rd-text-muted" style={{ fontSize: 'var(--rd-text-caption)', marginTop: 4 }}>
                    ⓘ {n.message}
                  </div>
                ))}
              </section>

              {/* Step 3 · Grid check */}
              <section>
                <div className="rd-text-muted" style={{ fontSize: 'var(--rd-text-caption)', fontWeight: 600, marginBottom: '0.5rem' }}>
                  3 · GRID CHECK
                </div>
                <GridCheck parsed={st.parsed} />
              </section>
            </>
          )}
        </div>

        <footer className="rd-drawer-footer" style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="rd-btn rd-btn-ghost" onClick={close} style={{ marginRight: 'auto' }}>Cancel</button>
          {isLdt ? (
            <>
              <button className="rd-btn rd-btn-secondary" disabled={footerDisabled} onClick={onSaveOnly}>
                Save without analysing
              </button>
              <button className="rd-btn rd-btn-primary" disabled={footerDisabled}
                title={!allRequiredMapped ? 'Map all required columns first' : ldtErrors.length ? 'Fix blocking errors first' : undefined}
                onClick={onUploadRun}>
                Upload &amp; run analysis
              </button>
            </>
          ) : (
            <button className="rd-btn rd-btn-primary" disabled={footerDisabled}
              title={st.status === 'ready' && !st.parsed?.valid ? 'Fix the criteria grid first' : undefined}
              onClick={onCommitCriteria}>
              Upload criteria &amp; run analysis
            </button>
          )}
        </footer>
      </aside>
    </>
  );
}
