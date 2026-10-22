// ============================================================================
// §6C — "Match results" card: proportion bar + 4 navigable tiles.
// Clicking a tile routes to the Line Register with a ?match= filter.
// ============================================================================
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAnalysisSummary } from './useAnalysisSummary';
import { MATCH_COLORS, fmtNum, fmtDateTime } from './analysisState';

const BASE = '/engineering/piping/critical-line-list';

const TILES = [
  { key: 'matched',            label: 'Matched',            filter: 'matched',
    desc: 'Found in both files, values agree',            cta: 'View lines →' },
  { key: 'conflicts',          label: 'Conflicts',          filter: 'conflict',
    desc: 'Found in both, size / class / P / T differ',   cta: n => `Review ${fmtNum(n)} lines →` },
  { key: 'missingCriticality', label: 'Missing criticality', filter: 'missing',
    desc: 'In line list, not in Stress Criticality',      cta: n => `Review ${fmtNum(n)} lines →` },
  { key: 'notInLineList',      label: 'Not in line list',   filter: 'notinll',
    desc: 'In Stress Criticality only',                   cta: n => `Review ${fmtNum(n)} lines →` },
];

export default function MatchResultsCard() {
  const { summary, state } = useAnalysisSummary();
  const navigate = useNavigate();
  const m = summary.match;
  const total = Math.max(1, m.matched + m.conflicts + m.missingCriticality + m.notInLineList);

  const llRows = summary.files.processLineList?.rows ?? 0;
  const scRows = summary.files.stressCriticality?.rows ?? 0;

  return (
    <section className="rd-card">
      <header className="rd-card-header" style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ fontWeight: 600 }}>Match results</div>
          <div className="rd-text-muted" style={{ fontSize: 'var(--rd-text-caption)', fontWeight: 400 }}>
            {state === 'blocked'
              ? `Results from the last successful run (${fmtDateTime(summary.lastRunAt)})`
              : `${fmtNum(llRows)} lines in line list · ${fmtNum(scRows)} in Stress Criticality · ${fmtNum(m.uniqueLineNumbers)} unique line numbers`}
          </div>
        </div>
        <div className="rd-text-muted" style={{ fontSize: 'var(--rd-text-caption)', maxWidth: 320, textAlign: 'right' }}>
          Matched on normalised line number: trimmed, upper-case, separators unified, leading zeros removed
        </div>
      </header>
      <div className="rd-card-body">
        {/* Proportion bar */}
        <div style={{ display: 'flex', height: 16, borderRadius: 999, overflow: 'hidden', gap: 2 }}
          role="img" aria-label="Match results proportion bar">
          {TILES.map(t => {
            const pct = Math.max(m[t.key] > 0 ? 0.8 : 0, (m[t.key] / total) * 100);
            return (
              <div key={t.key} title={`${t.label}: ${fmtNum(m[t.key])}`}
                style={{ width: `${pct}%`, background: MATCH_COLORS[t.key], transition: 'width 0.3s' }} />
            );
          })}
        </div>

        {/* Tiles */}
        <div className="cll-match-tiles" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginTop: '1rem' }}>
          {TILES.map(t => (
            <button key={t.key} type="button"
              onClick={() => navigate(`${BASE}?match=${t.filter}`)}
              style={{
                textAlign: 'left', cursor: 'pointer', border: '1px solid var(--rd-border-soft)',
                borderRadius: 8, padding: '0.875rem 1rem', background: 'var(--rd-surface)',
                display: 'flex', flexDirection: 'column', gap: 4,
              }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--rd-text-caption)', color: 'var(--rd-text-muted)' }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: MATCH_COLORS[t.key], flex: '0 0 auto' }} />
                {t.label}
              </span>
              <span className="rd-mono" style={{ fontSize: 24, fontWeight: 700, color: 'var(--rd-text)' }}>{fmtNum(m[t.key])}</span>
              <span className="rd-text-muted" style={{ fontSize: 11.5 }}>{t.desc}</span>
              <span style={{ fontSize: 'var(--rd-text-caption)', color: 'var(--rd-accent)', fontWeight: 500, marginTop: 2 }}>
                {typeof t.cta === 'function' ? t.cta(m[t.key]) : t.cta}
              </span>
            </button>
          ))}
        </div>
      </div>
      <style>{`@media (max-width: 1180px) { .cll-match-tiles { grid-template-columns: repeat(2, 1fr) !important; } }`}</style>
    </section>
  );
}
