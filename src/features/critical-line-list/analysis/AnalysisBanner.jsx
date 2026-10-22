// ============================================================================
// §5 Status banner — rendered in the page shell directly under the tab nav so
// it is visible on EVERY tab. Driven by the shared useAnalysisSummary state.
// ============================================================================
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAnalysisSummary } from './useAnalysisSummary';
import { useCll } from '../../../pages/Engineering/Piping/cll/CllStore';
import { RESULT_COLORS } from './analysisState';

const BASE = '/engineering/piping/critical-line-list';

function Shell({ tone, title, sub, chips, action, canAct }) {
  const palette = tone === 'amber'
    ? { bg: 'var(--rd-warning-soft)', border: 'var(--rd-warning-border, var(--rd-warning))' }
    : { bg: 'var(--rd-danger-soft)', border: 'var(--rd-danger-border, var(--rd-danger))' };
  return (
    <div role="status" style={{
      marginTop: '0.875rem', padding: '0.75rem 1rem', borderRadius: 8,
      background: palette.bg, border: `1px solid ${palette.border}`,
      display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap',
    }}>
      <div style={{ flex: 1, minWidth: 260 }}>
        <div style={{ fontWeight: 600, fontSize: 'var(--rd-text-body)', color: 'var(--rd-text)' }}>{title}</div>
        {sub && <div className="rd-text-muted" style={{ fontSize: 'var(--rd-text-caption)', marginTop: 2 }}>{sub}</div>}
        {chips?.length > 0 && (
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
            {chips.map(c => (
              <span key={c.label} className="rd-pill" style={{ color: c.color, borderColor: c.color, background: 'transparent' }}>
                {c.label} <span className="rd-mono" style={{ marginLeft: 4 }}>{c.count}</span>
              </span>
            ))}
          </div>
        )}
      </div>
      {action && canAct !== false && (
        <button className="rd-btn rd-btn-primary rd-btn-sm" onClick={action.onClick}>{action.label}</button>
      )}
    </div>
  );
}

export default function AnalysisBanner() {
  const { summary, state, runAnalysis, canUpload } = useAnalysisSummary();
  const { setUploadDrawerOpen, setDrawerFileKind, activeProject } = useCll();
  const navigate = useNavigate();

  // Offshore without criteria → blocking banner with an upload action
  if (activeProject?.locationType === 'offshore' && !summary.criteria) {
    return (
      <Shell tone="red"
        title="Offshore criteria table not uploaded."
        sub="Analysis is blocked until the offshore criteria table is uploaded."
        canAct={canUpload}
        action={{
          label: 'Upload offshore criteria',
          onClick: () => { setDrawerFileKind('stressCriteria'); setUploadDrawerOpen(true); },
        }}
      />
    );
  }

  if (state === 'complete' && summary.review.open === 0) return null;
  if (state === 'empty' || state === 'running') return null;

  if (state === 'complete' && summary.review.open > 0) {
    const fc = summary.flagCheck;
    return (
      <Shell tone="amber"
        title={`${summary.review.open} lines need review before the register can be issued`}
        sub={`Resolve ${summary.review.critical} critical items to unlock “Issue register”.`}
        chips={[
          { label: 'Not flagged but L1', count: fc.notFlaggedL1, color: RESULT_COLORS.L1 },
          { label: 'Cannot evaluate', count: summary.results.cannotEvaluate, color: RESULT_COLORS.cannotEvaluate },
        ]}
        action={{ label: 'Open review queue →', onClick: () => navigate(`${BASE}/review`) }}
      />
    );
  }

  if (state === 'outdated') {
    const ll = summary.files.processLineList;
    return (
      <Shell tone="red"
        title={`Analysis is out of date${ll ? ` — LDT Rev ${ll.revision}` : ''}`}
        sub="Counts below are from the previous run. Re-run to refresh categories and the review queue."
        canAct={canUpload}
        action={{ label: '↻ Re-run analysis', onClick: runAnalysis }}
      />
    );
  }

  if (state === 'blocked') {
    const bad = Object.values(summary.files).filter(Boolean).find(f => f.errors > 0);
    return (
      <Shell tone="red"
        title={`Analysis blocked — ${bad?.title || 'A file'} has ${bad?.errors ?? 0} errors`}
        sub={summary.blockingReason}
        canAct={canUpload}
        action={{
          label: 'Fix upload',
          onClick: () => { setDrawerFileKind(bad?.kind || 'processLineList'); setUploadDrawerOpen(true); },
        }}
      />
    );
  }

  return null;
}
