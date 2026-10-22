// ============================================================================
// §6D-right — "Changes since last upload" card. Hidden when no previous
// revision exists (the distribution card then spans full width).
// ============================================================================
import React from 'react';
import { useAnalysisSummary } from './useAnalysisSummary';
import { fmtNum, fmtDateTime } from './analysisState';

export default function ChangesSinceLastCard() {
  const { summary } = useAnalysisSummary();
  const ch = summary.changes;
  if (!ch) return null;

  const boxes = [
    { label: 'Added', value: `+${fmtNum(ch.added)}`, color: 'var(--rd-success)', bg: 'var(--rd-success-soft)' },
    { label: 'Removed', value: `−${fmtNum(ch.removed)}`, color: 'var(--rd-danger)', bg: 'var(--rd-danger-soft)' },
    { label: 'Changed', value: fmtNum(ch.changed), color: 'var(--rd-accent)', bg: 'var(--rd-info-soft)' },
  ];
  const largestField = Math.max(1, ...(ch.changedFields || []).map(f => f.count));

  return (
    <section className="rd-card">
      <header className="rd-card-header">
        <div style={{ fontWeight: 600 }}>Changes since last upload</div>
        <div className="rd-text-muted" style={{ fontSize: 'var(--rd-text-caption)', fontWeight: 400 }}>
          Process Line List Rev {ch.fromRev} → Rev {ch.toRev} · {fmtDateTime(ch.at)}
        </div>
      </header>
      <div className="rd-card-body">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.625rem' }}>
          {boxes.map(b => (
            <div key={b.label} style={{ background: b.bg, borderRadius: 8, padding: '0.625rem 0.875rem' }}>
              <div className="rd-mono" style={{ fontSize: 20, fontWeight: 700, color: b.color, fontVariantNumeric: 'tabular-nums' }}>{b.value}</div>
              <div className="rd-text-muted" style={{ fontSize: 'var(--rd-text-caption)' }}>{b.label}</div>
            </div>
          ))}
        </div>

        {ch.changedFields?.length > 0 && (
          <div style={{ marginTop: '1rem' }}>
            <div className="rd-text-muted" style={{ fontSize: 'var(--rd-text-caption)', fontWeight: 600, marginBottom: '0.5rem' }}>
              Changed fields
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {ch.changedFields.map(f => (
                <div key={f.field} style={{ display: 'grid', gridTemplateColumns: '140px 1fr 40px', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ fontSize: 'var(--rd-text-caption)', color: 'var(--rd-text)' }}>{f.field}</span>
                  <div style={{ height: 8, borderRadius: 999, background: 'var(--rd-surface-subtle)', overflow: 'hidden' }}>
                    <div style={{ width: `${(f.count / largestField) * 100}%`, height: '100%', background: '#4D8AF0', borderRadius: 999 }} />
                  </div>
                  <span className="rd-mono" style={{ textAlign: 'right', fontSize: 'var(--rd-text-caption)', fontVariantNumeric: 'tabular-nums' }}>{f.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
