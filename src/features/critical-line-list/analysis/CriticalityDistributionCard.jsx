// ============================================================================
// §5D — "Stress criticality distribution" card: L1/L2/L3/Cannot evaluate bars
// + a mini criteria-grid heat-map where each cell shows how many lines fell
// into it; clicking a cell filters the register by NPS row + temp column.
// ============================================================================
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAnalysisSummary } from './useAnalysisSummary';
import { useCll } from '../../../pages/Engineering/Piping/cll/CllStore';
import { RESULT_COLORS, fmtNum } from './analysisState';
import {
  NPS_ROW_LABELS, TEMP_LABELS, TEMP_LIMITS, CATEGORY_SOFT,
} from '../../../pages/Engineering/Piping/cll/criticalityEngine';

const BASE = '/engineering/piping/critical-line-list';

const ROWS = [
  { key: 'L1', label: 'L1 · stress critical', bar: RESULT_COLORS.L1 },
  { key: 'L2', label: 'L2', bar: RESULT_COLORS.L2 },
  { key: 'L3', label: 'L3', bar: RESULT_COLORS.L3 },
  { key: 'cannotEvaluate', label: 'Cannot evaluate', bar: RESULT_COLORS.cannotEvaluate },
];

export default function CriticalityDistributionCard({ fullWidth }) {
  const { summary } = useAnalysisSummary();
  const { criteria } = useCll();
  const navigate = useNavigate();
  const c = summary.results;
  const total = ROWS.reduce((n, r) => n + (c[r.key] || 0), 0);
  const pct = total ? Math.round(((c.L1 || 0) / total) * 100) : 0;
  const largest = Math.max(1, ...ROWS.map(r => c[r.key] || 0));
  const cellCounts = summary.cellCounts;

  return (
    <section className="rd-card" style={fullWidth ? { gridColumn: '1 / -1' } : undefined}>
      <header className="rd-card-header" style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600 }}>Stress criticality distribution</div>
          <div className="rd-text-muted" style={{ fontSize: 'var(--rd-text-caption)', fontWeight: 400 }}>
            {fmtNum(c.L1)} stress-critical (L1) lines · {pct}% of the line list
          </div>
        </div>
        <button className="rd-btn rd-btn-ghost rd-btn-sm"
          onClick={() => navigate(`${BASE}?category=L1`)}>
          View L1 lines →
        </button>
      </header>
      <div className="rd-card-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
        {ROWS.map(r => {
          const count = c[r.key] || 0;
          const rowPct = total ? ((count / total) * 100).toFixed(1) : '0.0';
          return (
            <div key={r.key} style={{ display: 'grid', gridTemplateColumns: '150px 1fr 92px', alignItems: 'center', gap: '0.75rem' }}>
              <span className="rd-pill" style={{ justifySelf: 'start', background: `${r.bar}22`, color: r.bar, border: 'none' }}>{r.label}</span>
              <div style={{ height: 10, borderRadius: 999, background: 'var(--rd-surface-subtle)', overflow: 'hidden' }}>
                <div style={{ width: `${(count / largest) * 100}%`, height: '100%', background: r.bar, borderRadius: 999, transition: 'width 0.3s' }} />
              </div>
              <span className="rd-mono" style={{ textAlign: 'right', fontSize: 'var(--rd-text-table)', color: 'var(--rd-text)', fontVariantNumeric: 'tabular-nums' }}>
                {fmtNum(count)} <span className="rd-text-muted">{rowPct}%</span>
              </span>
            </div>
          );
        })}

        {/* Mini criteria-grid heat-map: cell = lines that fell in it */}
        {criteria && cellCounts && (
          <div style={{ marginTop: '0.75rem' }}>
            <div className="rd-text-muted" style={{ fontSize: 'var(--rd-text-caption)', fontWeight: 600, marginBottom: 6 }}>
              LINES PER GRID CELL — CLICK TO FILTER
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', fontSize: 10.5 }}>
                <thead>
                  <tr>
                    <th className="rd-text-muted" style={{ padding: 2, textAlign: 'right' }}>NPS</th>
                    {TEMP_LABELS.map((t, i) => (
                      <th key={i} className="rd-text-muted" style={{ padding: 2, fontWeight: 400, minWidth: 28 }}
                        title={`Design T ≤ ${TEMP_LIMITS[i]} °C`}>
                        {t.replace(' and below', '↓').replace(' and above', '+')}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {criteria.grid.map((row, ri) => (
                    <tr key={ri}>
                      <td className="rd-mono" style={{ padding: 2, textAlign: 'right', color: 'var(--rd-text)' }}>
                        {NPS_ROW_LABELS[ri]}
                      </td>
                      {row.map((cell, ci) => {
                        const n = cellCounts[ri]?.[ci] || 0;
                        return (
                          <td key={ci} style={{ padding: 1 }}>
                            <button type="button"
                              title={`NPS ${NPS_ROW_LABELS[ri]} · T ≤ ${TEMP_LIMITS[ci]} °C → ${cell} · ${fmtNum(n)} lines`}
                              onClick={() => n > 0 && navigate(`${BASE}?cell=${ri},${ci}`)}
                              className="rd-mono"
                              style={{
                                width: '100%', minWidth: 26, padding: '1px 3px', textAlign: 'center',
                                borderRadius: 3, border: 'none', fontSize: 10,
                                cursor: n > 0 ? 'pointer' : 'default',
                                background: CATEGORY_SOFT[cell] || 'transparent',
                                color: n > 0 ? 'var(--rd-text)' : 'var(--rd-text-faint)',
                                fontWeight: n > 0 ? 600 : 400,
                              }}>
                              {n > 0 ? n : '·'}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
