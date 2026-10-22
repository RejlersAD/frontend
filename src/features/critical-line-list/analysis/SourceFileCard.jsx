// ============================================================================
// Source file cards — Process Line List (LDT) and Stress criticality criteria.
// LDT meta strip: Rows · Sheet/header row · Required columns · Validation.
// Criteria card: pills (Onshore · Built-in|Rev r), meta: Standard · Grid ·
// Categories · Validation.
// Empty slot renders a dashed drop zone.
// ============================================================================
import React, { useRef, useState } from 'react';
import { useAnalysisSummary } from './useAnalysisSummary';
import { useCll } from '../../../pages/Engineering/Piping/cll/CllStore';
import { downloadLdtTemplate } from '../../../pages/Engineering/Piping/cll/cllFiles';
import { fmtNum, fmtBytes, fmtDateTime } from './analysisState';

function MetaCell({ label, value, color }) {
  return (
    <div style={{ flex: 1, minWidth: 120, padding: '0.625rem 0.875rem' }}>
      <div className="rd-text-muted" style={{ fontSize: 11.5 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: color || 'var(--rd-text)', marginTop: 2 }}>{value}</div>
    </div>
  );
}

const Divider = () => <div style={{ width: 1, background: 'var(--rd-border-soft)' }} />;

export default function SourceFileCard({ kind }) {
  const { summary, canUpload } = useAnalysisSummary();
  const { setUploadDrawerOpen, setDrawerFileKind } = useCll();
  const file = summary.files[kind];
  const inputRef = useRef(null);
  const [drag, setDrag] = useState(false);

  const openDrawer = () => { setDrawerFileKind(kind); setUploadDrawerOpen(true); };
  const isLdt = kind === 'processLineList';
  const title = isLdt ? 'Process Line List (LDT)' : 'Stress criticality criteria';

  /* ---------------- empty slot: dashed drop zone ---------------- */
  if (!file) {
    return (
      <section className="rd-card" style={{ display: 'flex', flexDirection: 'column' }}>
        <div className="rd-card-body" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div
            className={`rd-dropzone ${drag ? 'rd-dropzone-active' : ''}`}
            onDragOver={e => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={e => { e.preventDefault(); setDrag(false); openDrawer(); }}
            onClick={() => canUpload && openDrawer()}
            style={{ textAlign: 'center', padding: '2rem 1rem' }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--rd-text-faint)" style={{ margin: '0 auto 0.5rem' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 16V4m0 0L8 8m4-4l4 4M4 20h16" />
            </svg>
            <div style={{ fontSize: 'var(--rd-text-body)', color: 'var(--rd-text-muted)' }}>
              Drop {title} (.xlsx, .xls, .csv · max 25 MB)
            </div>
            {isLdt && (
              <button className="rd-btn rd-btn-ghost rd-btn-sm" style={{ marginTop: '0.5rem' }}
                onClick={e => { e.stopPropagation(); downloadLdtTemplate(); }}>
                Download template
              </button>
            )}
          </div>
        </div>
      </section>
    );
  }

  /* ---------------- populated card ---------------- */
  const statusPill = file.errors > 0
    ? <span className="rd-pill rd-pill-danger">{file.errors} errors</span>
    : <span className="rd-pill rd-pill-success">Valid</span>;

  const validationColor = file.errors > 0 ? 'var(--rd-danger)'
    : file.warnings > 0 ? 'var(--rd-warning)' : 'var(--rd-success)';

  return (
    <section className="rd-card" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="rd-card-body" style={{ paddingBottom: 0 }}>
        <div style={{ display: 'flex', gap: '0.875rem', alignItems: 'flex-start' }}>
          {/* XLSX tile */}
          <div style={{
            width: 44, height: 44, borderRadius: 8, flex: '0 0 auto',
            background: isLdt ? 'var(--rd-success)' : 'var(--rd-accent)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
          }}>XLSX</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--rd-text)' }}>{file.title}</span>
              {isLdt
                ? <span className="rd-pill rd-pill-info">Rev {file.revision}</span>
                : <>
                    <span className="rd-pill rd-pill-info" style={{ textTransform: 'capitalize' }}>{file.locationType || '—'}</span>
                    {file.source === 'builtin'
                      ? <span className="rd-pill rd-pill-neutral">Built-in</span>
                      : <span className="rd-pill rd-pill-info">Rev {file.revision}</span>}
                  </>}
              {statusPill}
            </div>
            <div className="rd-text-muted" style={{ fontSize: 'var(--rd-text-caption)', marginTop: 3 }}>
              <span className="rd-mono">{file.fileName}</span>
              {file.sizeBytes ? ` · ${fmtBytes(file.sizeBytes)}` : ''}
              {file.uploadedAt ? ` · uploaded by ${file.uploadedBy}, ${fmtDateTime(file.uploadedAt)}` : ''}
            </div>
          </div>
        </div>

        {/* Meta strip */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', marginTop: '1rem',
          border: '1px solid var(--rd-border-soft)', borderRadius: 8, overflow: 'hidden',
        }}>
          {isLdt ? (
            <>
              <MetaCell label="Rows" value={`${fmtNum(file.rows)} lines`} />
              <Divider />
              <MetaCell label="Sheet · header row"
                value={<><span className="rd-mono">{file.sheet}</span> · rows {file.headerRow}–{file.unitsRow}</>} />
              <Divider />
              <MetaCell label="Required columns" value={`${file.requiredMapped} of ${file.requiredTotal} mapped`} />
              <Divider />
              <MetaCell label="Validation" value={`${file.errors} errors · ${file.warnings} warnings`} color={validationColor} />
            </>
          ) : (
            <>
              <MetaCell label="Standard" value={`${file.standard}${file.criteriaRevision !== '—' ? ` Rev ${file.criteriaRevision}` : ''} · Table 2`} />
              <Divider />
              <MetaCell label="Grid" value={file.gridText} color={file.gridValid ? 'var(--rd-success)' : 'var(--rd-danger)'} />
              <Divider />
              <MetaCell label="Categories" value={file.categories.join(' · ') || '—'} />
              <Divider />
              <MetaCell label="Validation" value={`${file.errors} errors`} color={validationColor} />
            </>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="rd-card-body" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', paddingTop: '0.875rem' }}>
        {canUpload && <button className="rd-btn rd-btn-secondary rd-btn-sm" onClick={openDrawer}>
          {isLdt ? 'Replace file' : 'Upload criteria'}
        </button>}
        {canUpload && isLdt && <button className="rd-btn rd-btn-secondary rd-btn-sm" onClick={openDrawer}>View column mapping</button>}
        {isLdt && (
          <button className="rd-btn rd-btn-secondary rd-btn-sm" onClick={() => downloadLdtTemplate()}>Download</button>
        )}
        <button className="rd-btn rd-btn-ghost rd-btn-sm"
          onClick={() => document.getElementById('cll-upload-history')?.scrollIntoView({ behavior: 'smooth' })}>History</button>
      </div>
    </section>
  );
}
