// ============================================================================
// §5C — "Criticality results" card: proportion bar (L1/L2/L3/Cannot
// evaluate), 4 navigable tiles, and the "Line list flag check" chip row.
// Clicking a tile routes to the Line Register with a filter.
// ============================================================================
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAnalysisSummary } from './useAnalysisSummary';
import { RESULT_COLORS, fmtNum, fmtDateTime } from './analysisState';

const BASE = '/engineering/piping/critical-line-list';

const TILES = [
  { key: 'L1', label: 'L1 · stress critical', filter: 'category=L1',
    desc: 'Comprehensive computer analysis + report' },
  { key: 'L2', label: 'L2', filter: 'category=L2',
    desc: 'Simplified analysis' },
  { key: 'L3', label: 'L3', filter: 'category=L3',
    desc: 'Visual review' },
  { key: 'cannotEvaluate', label: 'Cannot evaluate', filter: 'status=cannot-evaluate',
    desc: 'Missing size or design temperature' },
];

export default function CriticalityResultsCard() {
  const { summary, state } = useAnalysisSummary();
  const navigate = useNavigate();
  const r = summary.results;
  const fc = summary.flagCheck;
  const total = Math.max(1, r.L1 + r.L2 + r.L3 + r.cannotEvaluate);

  const llRows = summary.files.processLineList?.rows ?? 0;
  const crit = summary.criteria;

  return (
    <section className="rd-card">
      <header className="rd-card-header" style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ fontWeight: 600 }}>Criticality results</div>
          <div className="rd-text-muted" style={{ fontSize: 'var(--rd-text-caption)', fontWeight: 400 }}>
            {state === 'blocked'
              ? `Results from the last successful run (${fmtDateTime(summary.lastRunAt)})`
              : `${fmtNum(llRows)} lines evaluated against ${crit?.standard || 'criteria'}${crit?.revision ? ` Rev ${crit.revision}` : ''} Table 2 (${crit?.locationType || '—'})`}
          </div>
        </div>
      </header>
      <div className="rd-card-body">
        {/* Proportion bar */}
        <div style={{ display: 'flex', height: 16, borderRadius: 999, overflow: 'hidden', gap: 2 }}
          role="img" aria-label="Criticality results proportion bar">
          {TILES.map(t => {
            const pct = Math.max(r[t.key] > 0 ? 0.8 : 0, (r[t.key] / total) * 100);
            return (
              <div key={t.key} title={`${t.label}: ${fmtNum(r[t.key])}`}
                style={{ width: `${pct}%`, background: RESULT_COLORS[t.key], transition: 'width 0.3s' }} />
            );
          })}
        </div>

        {/* Tiles */}
        <div className="cll-match-tiles" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginTop: '1rem' }}>
          {TILES.map(t => (
            <button key={t.key} type="button"
              onClick={() => navigate(`${BASE}?${t.filter}`)}
              style={{
                textAlign: 'left', cursor: 'pointer', border: '1px solid var(--rd-border-soft)',
                borderRadius: 8, padding: '0.875rem 1rem', background: 'var(--rd-surface)',
                display: 'flex', flexDirection: 'column', gap: 4,
              }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--rd-text-caption)', color: 'var(--rd-text-muted)' }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: RESULT_COLORS[t.key], flex: '0 0 auto' }} />
                {t.label}
              </span>
              <span className="rd-mono" style={{ fontSize: 24, fontWeight: 700, color: 'var(--rd-text)' }}>{fmtNum(r[t.key])}</span>
              <span className="rd-text-muted" style={{ fontSize: 11.5 }}>{t.desc}</span>
              <span style={{ fontSize: 'var(--rd-text-caption)', color: 'var(--rd-accent)', fontWeight: 500, marginTop: 2 }}>
                View lines →
              </span>
            </button>
          ))}
        </div>

        {/* Line list flag check */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
          <span className="rd-text-muted" style={{ fontSize: 'var(--rd-text-caption)', fontWeight: 600 }}>
            Line list flag check
          </span>
          <button className="rd-pill rd-pill-success" style={{ cursor: 'pointer', border: 'none' }}
            onClick={() => navigate(`${BASE}?flag=agrees`)}>Agrees {fmtNum(fc.agrees)}</button>
          <button className="rd-pill rd-pill-danger" style={{ cursor: 'pointer', border: 'none' }}
            title="Line list not flagged — Table 2 requires L1"
            onClick={() => navigate(`${BASE}?flag=not-flagged-L1`)}>Not flagged but L1 {fmtNum(fc.notFlaggedL1)}</button>
          <button className="rd-pill rd-pill-neutral" style={{ cursor: 'pointer', border: 'none' }}
            title="Flagged Y — Table 2 is L2/L3 (conservative, no action)"
            onClick={() => navigate(`${BASE}?flag=flagged-conservative`)}>Flagged Y but L2/L3 {fmtNum(fc.flaggedConservative)}</button>
        </div>
      </div>
      <style>{`@media (max-width: 1180px) { .cll-match-tiles { grid-template-columns: repeat(2, 1fr) !important; } }`}</style>
    </section>
  );
}
