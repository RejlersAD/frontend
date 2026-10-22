// ============================================================================
// §6E — "Validation checks" table. Actions route to mapping / register /
// review queue — no dead-end numbers.
// ============================================================================
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAnalysisSummary } from './useAnalysisSummary';
import { useCll } from '../../../pages/Engineering/Piping/cll/CllStore';

const BASE = '/engineering/piping/critical-line-list';

const ICON = {
  passed:  { glyph: '✓', color: 'var(--rd-success)', pill: 'rd-pill-success' },
  warning: { glyph: '!', color: 'var(--rd-warning)', pill: 'rd-pill-warning' },
  failed:  { glyph: '✕', color: 'var(--rd-danger)',  pill: 'rd-pill-danger' },
};

export default function ValidationChecksTable() {
  const { summary, state } = useAnalysisSummary();
  const { setUploadDrawerOpen, setDrawerFileKind } = useCll();
  const navigate = useNavigate();

  const checks = summary.checks || [];
  const failed = checks.filter(c => c.result === 'failed').length;
  const attention = checks.filter(c => c.result === 'warning').length;

  const runAction = (a) => {
    if (!a) return;
    if (a.target === 'mapping') { setDrawerFileKind(a.kind || 'processLineList'); setUploadDrawerOpen(true); }
    else if (a.target === 'reviewQueue') navigate(`${BASE}/review`);
    else if (a.target === 'register') navigate(a.filter ? `${BASE}?${a.filter}` : BASE);
  };

  return (
    <section className="rd-card">
      <header className="rd-card-header">
        <div style={{ fontWeight: 600 }}>Validation checks</div>
        <div className="rd-text-muted" style={{ fontSize: 'var(--rd-text-caption)', fontWeight: 400 }}>
          {state === 'blocked'
            ? '1 check failed — fix it to continue'
            : `${checks.length} checks · ${failed} failed · ${attention} need attention`}
        </div>
      </header>
      <div style={{ overflowX: 'auto' }}>
        <table className="rd-table">
          <thead>
            <tr><th>Check</th><th>File</th><th>Result</th><th>Impact</th><th>Action</th></tr>
          </thead>
          <tbody>
            {checks.map(c => {
              const ic = ICON[c.result] || ICON.passed;
              return (
                <tr key={c.id}>
                  <td>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <span style={{
                        width: 18, height: 18, borderRadius: '50%', flex: '0 0 auto',
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, fontWeight: 700, color: '#fff', background: ic.color,
                      }}>{ic.glyph}</span>
                      <span style={{ color: 'var(--rd-text)' }}>{c.name}</span>
                    </span>
                  </td>
                  <td className="rd-text-muted">{c.file}</td>
                  <td><span className={`rd-pill ${ic.pill}`}>{c.resultText}</span></td>
                  <td className="rd-text-muted" style={{ fontSize: 'var(--rd-text-caption)' }}>{c.impact || '—'}</td>
                  <td>
                    {c.action
                      ? <button className="rd-btn rd-btn-ghost rd-btn-sm" onClick={() => runAction(c.action)}>{c.action.label}</button>
                      : <span className="rd-text-muted">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
