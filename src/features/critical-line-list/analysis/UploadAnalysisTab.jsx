// ============================================================================
// Upload Analysis tab — composes sections A–F in order:
//   A  AnalysisStepper              (Analysis progress)
//   B  SourceFileCard × 2           (source files, 2-col grid)
//   C  MatchResultsCard             (Match results)
//   D  CriticalityDistributionCard + ChangesSinceLastCard (side by side)
//   E  ValidationChecksTable        (Validation checks)
//   F  UploadHistoryTimeline        (Upload history)
// States: empty / running / complete / outdated / blocked (+ skeleton, error).
// ============================================================================
import React from 'react';
import { useAnalysisSummary } from './useAnalysisSummary';
import { useCll } from '../../../pages/Engineering/Piping/cll/CllStore';
import AnalysisStepper from './AnalysisStepper';
import SourceFileCard from './SourceFileCard';
import MatchResultsCard from './MatchResultsCard';
import CriticalityDistributionCard from './CriticalityDistributionCard';
import ChangesSinceLastCard from './ChangesSinceLastCard';
import ValidationChecksTable from './ValidationChecksTable';
import UploadHistoryTimeline from './UploadHistoryTimeline';

function Skeleton() {
  const block = (h) => (
    <div className="rd-card" style={{
      height: h, borderRadius: 8,
      background: 'linear-gradient(90deg, var(--rd-surface-subtle) 25%, var(--rd-border-soft) 50%, var(--rd-surface-subtle) 75%)',
      backgroundSize: '200% 100%', animation: 'rdShimmer 1.4s infinite',
    }} />
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <style>{`@keyframes rdShimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
      {block(140)}
      <div className="cll-analysis-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>{block(220)}{block(220)}</div>
      {block(240)}
      <div className="cll-analysis-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>{block(220)}{block(220)}</div>
    </div>
  );
}

export default function UploadAnalysisTab({ loading, loadError, onRetry }) {
  const { state, summary, canUpload } = useAnalysisSummary();
  const { setUploadDrawerOpen, setDrawerFileKind } = useCll();

  if (loading) return <Skeleton />;

  if (loadError) {
    return (
      <div className="rd-card" style={{ padding: '2rem', textAlign: 'center' }}>
        <p style={{ color: 'var(--rd-danger)', margin: '0 0 0.75rem' }}>Couldn’t load the analysis.</p>
        <button className="rd-btn rd-btn-secondary" onClick={onRetry}>Retry</button>
      </div>
    );
  }

  if (state === 'empty') {
    const open = (kind) => { setDrawerFileKind(kind); setUploadDrawerOpen(true); };
    return (
      <div className="rd-card" style={{ padding: '3rem', textAlign: 'center' }}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--rd-text-faint)" style={{ margin: '0 auto' }}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 16V4m0 0L8 8m4-4l4 4M4 20h16" />
        </svg>
        <p style={{ margin: '0.75rem 0 1.25rem', color: 'var(--rd-text-muted)' }}>
          Upload the Process Line List and Stress Criticality files to build the list
        </p>
        {canUpload && (
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="rd-btn rd-btn-primary" onClick={() => open('processLineList')}>Upload Process Line List</button>
            <button className="rd-btn rd-btn-secondary" onClick={() => open('stressCriticality')}>Upload Stress Criticality</button>
          </div>
        )}
      </div>
    );
  }

  const hasChanges = !!summary.changes;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <style>{`
        @media (max-width: 1180px) {
          .cll-analysis-grid-2 { grid-template-columns: 1fr !important; }
          .cll-meta-strip { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>

      {/* A · Analysis progress */}
      <AnalysisStepper />

      {/* B · Source files */}
      <div className="cll-analysis-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <SourceFileCard kind="processLineList" />
        <SourceFileCard kind="stressCriticality" />
      </div>

      {/* C · Match results */}
      <MatchResultsCard />

      {/* D · Distribution + changes */}
      <div className="cll-analysis-grid-2" style={{ display: 'grid', gridTemplateColumns: hasChanges ? '1fr 1fr' : '1fr', gap: 14 }}>
        <CriticalityDistributionCard fullWidth={!hasChanges} />
        <ChangesSinceLastCard />
      </div>

      {/* E · Validation checks */}
      <ValidationChecksTable />

      {/* F · Upload history */}
      <UploadHistoryTimeline />
    </div>
  );
}
