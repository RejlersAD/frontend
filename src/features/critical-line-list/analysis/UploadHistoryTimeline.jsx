// ============================================================================
// §6F — "Upload history" timeline (latest 4 entries).
// Every upload is a revision; restoring needs the Lead Stress Engineer.
// ============================================================================
import React from 'react';
import { useAnalysisSummary } from './useAnalysisSummary';
import { fmtDateTime } from './analysisState';

const DOT = {
  analysis:   'var(--rd-success)',
  upload:     'var(--rd-accent)',
  pending:    'var(--rd-warning)',
  superseded: 'var(--rd-text-faint)',
};

export default function UploadHistoryTimeline() {
  const { summary, canRestore } = useAnalysisSummary();
  const entries = (summary.history || []).slice(0, 4);

  return (
    <section className="rd-card" id="cll-upload-history">
      <header className="rd-card-header" style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600 }}>Upload history</div>
          <div className="rd-text-muted" style={{ fontSize: 'var(--rd-text-caption)', fontWeight: 400 }}>
            Every upload is a revision; restoring needs the Lead Stress Engineer
          </div>
        </div>
        <button className="rd-btn rd-btn-ghost rd-btn-sm">View full history →</button>
      </header>
      <div className="rd-card-body" style={{ paddingTop: '0.75rem' }}>
        {entries.length === 0 && (
          <p className="rd-text-muted" style={{ fontSize: 'var(--rd-text-body)', margin: 0 }}>No uploads yet.</p>
        )}
        <ol style={{ listStyle: 'none', margin: 0, padding: 0, position: 'relative' }}>
          {entries.map((e, i) => (
            <li key={`${e.at}-${i}`} style={{
              display: 'flex', gap: '0.875rem', alignItems: 'flex-start',
              paddingBottom: i < entries.length - 1 ? '1rem' : 0, position: 'relative',
            }}>
              {/* connector */}
              {i < entries.length - 1 && (
                <span aria-hidden style={{
                  position: 'absolute', left: 4, top: 16, bottom: 0, width: 2,
                  background: 'var(--rd-border-soft)',
                }} />
              )}
              <span style={{
                width: 10, height: 10, borderRadius: '50%', flex: '0 0 auto', marginTop: 4,
                background: DOT[e.kind] || DOT.upload, position: 'relative', zIndex: 1,
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 500, fontSize: 'var(--rd-text-body)', color: 'var(--rd-text)' }}>
                  {e.title}
                  {e.kind === 'superseded' && canRestore && (
                    <button className="rd-btn rd-btn-ghost rd-btn-sm" style={{ marginLeft: 8 }}>Restore</button>
                  )}
                </div>
                <div className="rd-text-muted" style={{ fontSize: 'var(--rd-text-caption)' }}>
                  {e.detail}{e.by ? ` · ${e.by}` : ''}
                </div>
              </div>
              <span className="rd-text-muted rd-mono" style={{ fontSize: 'var(--rd-text-caption)', flex: '0 0 auto' }}>
                {fmtDateTime(e.at)}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
