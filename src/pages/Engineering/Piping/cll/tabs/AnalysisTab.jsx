// ============================================================================
// Tab 2 — UPLOAD ANALYSIS: file cards (name, revision, uploader, when, rows,
// validation pill, Replace/Download), match summary, validation issues,
// upload history.
// ============================================================================
import React from 'react';
import * as XLSX from 'xlsx';
import { useCll } from '../CllStore';
import { FILE_KINDS } from '../cllFiles';
import { EmptyState } from './RegisterTab';

const SEV_PILL = { error: 'rd-pill-danger', warning: 'rd-pill-warning' };

/** RADAI auto-classification summary (when no stress file was uploaded). */
function GenerationSummary() {
  const { match } = useCll();
  if (!match?.lines?.length || !match.lines[0] || match.lines[0].category_source !== 'generated') return null;
  const counts = { L1: 0, L2: 0, L3: 0, 'Non-critical': 0 };
  const rules = {};
  let review = 0;
  match.lines.forEach(l => {
    counts[l.stress_category] = (counts[l.stress_category] || 0) + 1;
    l._generated?.sec73?.forEach(s => { rules[s.id] = (rules[s.id] || 0) + 1; });
    if (l._generated?.needs_review) review++;
  });
  return (
    <section className="rd-card">
      <header className="rd-card-header">RADAI auto-classification (AGES-SP-09-004)</header>
      <div className="rd-card-body">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[...Object.entries(counts), ['Needs engineer review', review]].map(([label, v]) => (
            <div key={label} className="rd-card rd-kpi" style={{ boxShadow: 'none' }}>
              <div className="rd-kpi-value">{v}</div>
              <div className="rd-kpi-label">{label}</div>
            </div>
          ))}
        </div>
        {Object.keys(rules).length > 0 && (
          <p className="rd-text-muted" style={{ fontSize: 'var(--rd-text-caption)', marginTop: '0.75rem' }}>
            Sec. 7.3 rules triggered: {Object.entries(rules).sort().map(([id, n]) => `7.3(${id}) ×${n}`).join('  ·  ')}
          </p>
        )}
      </div>
    </section>
  );
}

function FileCard({ kind }) {
  const { files, setUploadDrawerOpen } = useCll();
  const f = files[kind];
  const def = FILE_KINDS[kind];

  const download = () => {
    if (!f) return;
    const headers = def.fields.map(x => x.label);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...f.records.map(r => def.fields.map(x => r[x.key] ?? ''))]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, f.sheet || def.title);
    XLSX.writeFile(wb, f.name || `${def.title}.xlsx`);
  };

  return (
    <section className="rd-card" style={{ flex: 1, minWidth: 320 }}>
      <header className="rd-card-header">
        {def.title}
        {f && (
          <span className={`rd-pill ${f.issues?.some(i => i.severity === 'error') ? 'rd-pill-danger' : f.issues?.length ? 'rd-pill-warning' : 'rd-pill-success'}`}>
            {!f.issues?.length ? 'Valid' : f.issues.some(i => i.severity === 'error') ? 'Errors' : 'Warnings'}
          </span>
        )}
      </header>
      <div className="rd-card-body">
        {!f ? (
          <div className="rd-text-muted" style={{ fontSize: 'var(--rd-text-body)' }}>
            Not uploaded yet.{' '}
            <button className="rd-btn rd-btn-ghost rd-btn-sm" onClick={() => setUploadDrawerOpen(true)}>Upload</button>
          </div>
        ) : (
          <>
            <div className="rd-mono" style={{ color: 'var(--rd-text)', wordBreak: 'break-all' }}>{f.name}</div>
            <div className="rd-text-muted space-y-1" style={{ fontSize: 'var(--rd-text-caption)', margin: '0.5rem 0 1rem' }}>
              <div>Revision <span className="rd-mono">R{f.revision}</span> · {f.rowCount} rows</div>
              <div>Uploaded by {f.uploadedBy} · {new Date(f.uploadedAt).toLocaleString()}</div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="rd-btn rd-btn-secondary rd-btn-sm" onClick={() => setUploadDrawerOpen(true)}>Replace</button>
              <button className="rd-btn rd-btn-ghost rd-btn-sm" onClick={download}>Download</button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

export default function AnalysisTab() {
  const { files, match, history } = useCll();

  if (!files.lineList && !files.stress) return <EmptyState />;

  const issues = [
    ...(files.lineList?.issues || []).map(i => ({ ...i, file: files.lineList.name })),
    ...(files.stress?.issues || []).map(i => ({ ...i, file: files.stress.name })),
  ];

  return (
    <div className="space-y-5">
      {/* File cards */}
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <FileCard kind="lineList" />
        <FileCard kind="stress" />
      </div>

      <GenerationSummary />

      {/* Match summary */}
      {match && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            ['Matched', match.summary.matched, 'var(--rd-success)'],
            ['Missing criticality', match.summary.missing, 'var(--rd-danger)'],
            ['Not in line list', match.summary.notInLineList, 'var(--rd-orange)'],
            ['Conflicts', match.summary.conflicts, 'var(--rd-warning)'],
            ['Category mismatches', match.summary.categoryMismatches || 0, 'var(--rd-warning)'],
          ].map(([label, value, color]) => (
            <div key={label} className="rd-card rd-kpi">
              <div className="rd-kpi-value" style={{ color }}>{value}</div>
              <div className="rd-kpi-label">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Validation issues */}
      <section className="rd-card">
        <header className="rd-card-header">Validation issues ({issues.length})</header>
        <div style={{ overflow: 'auto', maxHeight: 300 }}>
          <table className="rd-table">
            <thead><tr><th>Severity</th><th>File</th><th>Row</th><th>Issue</th></tr></thead>
            <tbody>
              {issues.map((i, idx) => (
                <tr key={idx}>
                  <td><span className={`rd-pill ${SEV_PILL[i.severity] || 'rd-pill-neutral'}`}>{i.severity}</span></td>
                  <td className="rd-mono">{i.file}</td>
                  <td className="rd-mono">{i.row ?? '—'}</td>
                  <td>{i.message}</td>
                </tr>
              ))}
              {issues.length === 0 && (
                <tr><td colSpan={4} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--rd-text-faint)' }}>No validation issues.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Upload history */}
      <section className="rd-card">
        <header className="rd-card-header">Upload history</header>
        <div style={{ overflow: 'auto', maxHeight: 300 }}>
          <table className="rd-table">
            <thead><tr><th>When</th><th>File</th><th>Type</th><th>Revision</th><th>Added</th><th>Removed</th><th>Changed</th></tr></thead>
            <tbody>
              {history.map(h => (
                <tr key={h.at + h.kind}>
                  <td className="rd-mono">{new Date(h.at).toLocaleString()}</td>
                  <td className="rd-mono">{h.fileName}</td>
                  <td>{FILE_KINDS[h.kind]?.title}</td>
                  <td className="rd-mono">R{h.revision}</td>
                  <td><span className="rd-pill rd-pill-success rd-mono">+{h.added}</span></td>
                  <td><span className="rd-pill rd-pill-danger rd-mono">−{h.removed}</span></td>
                  <td><span className="rd-pill rd-pill-warning rd-mono">~{h.changed}</span></td>
                </tr>
              ))}
              {history.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--rd-text-faint)' }}>No uploads yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
