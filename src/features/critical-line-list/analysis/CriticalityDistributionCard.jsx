// ============================================================================
// §6D-left — "Stress criticality distribution" card.
// ============================================================================
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAnalysisSummary } from './useAnalysisSummary';
import { fmtNum } from './analysisState';

const BASE = '/engineering/piping/critical-line-list';

const ROWS = [
  { key: 'cat1',        label: 'Cat 1',        pill: 'rd-pill-danger',  bar: 'var(--rd-danger)' },
  { key: 'cat2',        label: 'Cat 2',        pill: 'rd-pill-warning', bar: 'var(--rd-warning)' },
  { key: 'cat3',        label: 'Cat 3',        pill: 'rd-pill-info',    bar: 'var(--rd-info)' },
  { key: 'nonCritical', label: 'Non-critical', pill: 'rd-pill-success', bar: 'var(--rd-text-faint)' },
  { key: 'notAssessed', label: 'Not assessed', pill: 'rd-pill-neutral', bar: 'var(--rd-border)' },
];

export default function CriticalityDistributionCard({ fullWidth }) {
  const { summary } = useAnalysisSummary();
  const navigate = useNavigate();
  const c = summary.criticality;
  const total = ROWS.reduce((n, r) => n + (c[r.key] || 0), 0);
  const critical = (c.cat1 || 0) + (c.cat2 || 0) + (c.cat3 || 0);
  const pct = total ? Math.round((critical / total) * 100) : 0;
  const largest = Math.max(1, ...ROWS.map(r => c[r.key] || 0));

  return (
    <section className="rd-card" style={fullWidth ? { gridColumn: '1 / -1' } : undefined}>
      <header className="rd-card-header" style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600 }}>Stress criticality distribution</div>
          <div className="rd-text-muted" style={{ fontSize: 'var(--rd-text-caption)', fontWeight: 400 }}>
            {fmtNum(critical)} stress-critical lines · {pct}% of the line list
          </div>
        </div>
        <button className="rd-btn rd-btn-ghost rd-btn-sm"
          onClick={() => navigate(`${BASE}?category=critical`)}>
          View critical lines →
        </button>
      </header>
      <div className="rd-card-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
        {ROWS.map(r => {
          const count = c[r.key] || 0;
          const rowPct = total ? ((count / total) * 100).toFixed(1) : '0.0';
          return (
            <div key={r.key} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 92px', alignItems: 'center', gap: '0.75rem' }}>
              <span className={`rd-pill ${r.pill}`} style={{ justifySelf: 'start' }}>{r.label}</span>
              <div style={{ height: 10, borderRadius: 999, background: 'var(--rd-surface-subtle)', overflow: 'hidden' }}>
                <div style={{ width: `${(count / largest) * 100}%`, height: '100%', background: r.bar, borderRadius: 999, transition: 'width 0.3s' }} />
              </div>
              <span className="rd-mono" style={{ textAlign: 'right', fontSize: 'var(--rd-text-table)', color: 'var(--rd-text)', fontVariantNumeric: 'tabular-nums' }}>
                {fmtNum(count)} <span className="rd-text-muted">{rowPct}%</span>
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
