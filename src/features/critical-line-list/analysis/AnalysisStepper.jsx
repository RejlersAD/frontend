// ============================================================================
// §6A — "Analysis progress" card. Horizontal 6-step stepper; every stage must
// pass before the register can be issued.
// ============================================================================
import React from 'react';
import { useAnalysisSummary } from './useAnalysisSummary';
import { fmtNum, fmtShort } from './analysisState';

const C = {
  done:   { fill: 'var(--rd-success)', ring: 'none', text: 'var(--rd-success)' },
  current:{ fill: 'var(--rd-accent)',  ring: '0 0 0 4px var(--rd-primary-soft)', text: 'var(--rd-accent)' },
  warning:{ fill: 'var(--rd-warning)', ring: '0 0 0 4px var(--rd-warning-soft)', text: 'var(--rd-warning)' },
  error:  { fill: 'var(--rd-danger)',  ring: '0 0 0 4px var(--rd-danger-soft)', text: 'var(--rd-danger)' },
  locked: { fill: 'var(--rd-neutral-soft, var(--rd-surface-subtle))', ring: 'none', text: 'var(--rd-text-faint)' },
};

function Spinner() {
  return (
    <span style={{
      width: 14, height: 14, borderRadius: '50%', display: 'inline-block',
      border: '2px solid rgba(255,255,255,0.45)', borderTopColor: '#fff',
      animation: 'rdSpin 0.8s linear infinite',
    }} />
  );
}

function Circle({ status, index, isRunning }) {
  const c = C[status];
  return (
    <span style={{
      width: 30, height: 30, borderRadius: '50%', flex: '0 0 auto',
      background: c.fill, boxShadow: c.ring, color: status === 'locked' ? 'var(--rd-text-faint)' : '#fff',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 13, fontWeight: 600,
    }}>
      {status === 'done' && (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
      )}
      {status === 'locked' && (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v2h8z" /></svg>
      )}
      {(status === 'current' || status === 'warning' || status === 'error') && (isRunning ? <Spinner /> : index + 1)}
    </span>
  );
}

function buildSteps(summary, state) {
  const files = Object.values(summary.files).filter(Boolean);
  const ll = summary.files.processLineList;
  const errors = files.reduce((n, f) => n + (f.errors || 0), 0);
  const warnings = files.reduce((n, f) => n + (f.warnings || 0), 0);
  const badFile = files.find(f => f.errors > 0);
  const matchedTotal = summary.match.matched + summary.match.conflicts;
  const llRows = ll?.rows || 0;

  const steps = [];

  // 1 · Files uploaded
  steps.push({
    label: 'Files uploaded', status: 'done',
    sub: state === 'outdated' && ll
      ? `Line list Rev ${ll.revision} · just now`
      : `${files.length} files · ${fmtShort(files.map(f => f.uploadedAt).sort().pop())}`,
  });

  // 2 · Columns mapped
  const mapped = files.reduce((n, f) => n + (f.requiredMapped || 0), 0);
  const total = files.reduce((n, f) => n + (f.requiredTotal || 0), 0);
  steps.push({
    label: 'Columns mapped', status: 'done',
    sub: state === 'outdated' ? 'Saved profile applied' : `${mapped} of ${total} required`,
  });

  // 3 · Validated
  steps.push(state === 'blocked'
    ? { label: 'Validated', status: 'error', sub: `${errors} errors in ${badFile?.title || 'file'}` }
    : { label: 'Validated', status: 'done', sub: `${errors} errors · ${warnings} warnings` });

  // 4 · Lines matched
  if (state === 'blocked') {
    steps.push({ label: 'Lines matched', status: 'locked', sub: 'Waiting for validation' });
  } else if (state === 'outdated') {
    steps.push({ label: 'Lines matched', status: 'warning', sub: 'Re-run needed' });
  } else {
    steps.push({ label: 'Lines matched', status: 'done', sub: `${fmtNum(matchedTotal)} of ${fmtNum(llRows)}` });
  }

  // 5 · Review
  if (state === 'complete') {
    steps.push({ label: 'Review', status: 'current', sub: `${fmtNum(summary.review.open)} open · ${summary.review.critical} critical` });
  } else {
    steps.push({ label: 'Review', status: 'locked', sub: state === 'outdated' ? 'From previous run' : undefined });
  }

  // 6 · Issue register
  steps.push(summary.review.critical === 0 && state === 'complete'
    ? { label: 'Issue register', status: 'current', sub: 'Ready to issue' }
    : { label: 'Issue register', status: 'locked', sub: 'Locked until 0 critical items' });

  return steps;
}

export default function AnalysisStepper() {
  const { summary, state, running, runStep, runAnalysis, canUpload } = useAnalysisSummary();
  const steps = buildSteps(summary, state);

  return (
    <section className="rd-card">
      <header className="rd-card-header" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600 }}>Analysis progress</div>
          <div className="rd-text-muted" style={{ fontSize: 'var(--rd-text-caption)', fontWeight: 400 }}>
            Each stage must pass before the register can be issued
          </div>
        </div>
        {canUpload && (
          <button className="rd-btn rd-btn-secondary rd-btn-sm" onClick={runAnalysis} disabled={running}>
            ↻ Re-run analysis
          </button>
        )}
      </header>
      <div className="rd-card-body" style={{ overflowX: 'auto' }}>
        <style>{`@keyframes rdSpin { to { transform: rotate(360deg); } }`}</style>
        <ol style={{ display: 'flex', listStyle: 'none', margin: 0, padding: 0, minWidth: 0 }}>
          {steps.map((s, i) => {
            const status = running && i === runStep ? 'current' : (running && i < runStep ? 'done' : s.status);
            const isRunning = running && i === runStep;
            const c = C[status];
            const tintSub = ['current', 'warning', 'error'].includes(status);
            return (
              <li key={s.label} style={{ display: 'flex', alignItems: 'flex-start', flex: i < steps.length - 1 ? 1 : '0 0 auto', minWidth: 150 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 6 }}>
                  <Circle status={status} index={i} isRunning={isRunning} />
                  <div>
                    <div style={{ fontSize: 'var(--rd-text-caption)', fontWeight: 600, color: status === 'locked' ? 'var(--rd-text-faint)' : 'var(--rd-text)' }}>
                      {i + 1} · {s.label}
                    </div>
                    {s.sub && (
                      <div style={{ fontSize: 11.5, color: tintSub ? c.text : 'var(--rd-text-muted)', marginTop: 1 }}>{s.sub}</div>
                    )}
                  </div>
                </div>
                {i < steps.length - 1 && (
                  <div aria-hidden style={{
                    flex: 1, height: 2, marginTop: 14, marginLeft: 8, marginRight: 8, minWidth: 16,
                    background: (status === 'done') ? 'var(--rd-success)' : 'var(--rd-border)',
                  }} />
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
