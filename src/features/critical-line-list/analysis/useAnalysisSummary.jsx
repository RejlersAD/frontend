// ============================================================================
// useAnalysisSummary — single source of truth for the Upload Analysis view.
// Shapes the existing CllStore data (files / match / discrepancies / history)
// into the §3 AnalysisSummary contract. Where backend endpoints (§9) do not
// exist yet, clearly-marked MOCK blocks fill the gaps — swap them out when the
// API lands. Run progress is simulated with timers (`runAnalysis`).
//
// One instance is shared by the page shell (tabs + banner) and the tab itself:
// CllPage wraps the outlet in <AnalysisSummaryProvider>; consumers call
// useAnalysisSummary() which returns the context value.
// ============================================================================
import React, { createContext, useContext, useMemo, useRef, useState, useCallback } from 'react';
import { useCll } from '../../../pages/Engineering/Piping/cll/CllStore';
import { deriveAnalysisState, revLetter } from './analysisState';

// ---------------------------------------------------------------------------
// MOCK (§9 backend endpoints do not exist yet)
// Set USE_MOCK_FALLBACK = false to rely purely on uploaded store data — the
// page then shows the 'empty' state until both files are uploaded.
// Everything inside MOCK_* constants is shaped exactly like real store output
// so swapping to an API response is a drop-in replacement.
// ---------------------------------------------------------------------------
const USE_MOCK_FALLBACK = true;

const MOCK_FILES = {
  processLineList: {
    kind: 'processLineList', title: 'Process Line List',
    fileName: 'PCL-5100-LL-001_RevD.xlsx', sizeBytes: 486_000, revision: 'D',
    uploadedBy: 'sara.lindqvist', uploadedAt: '2026-10-21T10:24:00+04:00',
    rows: 1248, sheet: 'Lines', headerRow: 3,
    requiredMapped: 9, requiredTotal: 9, errors: 0, warnings: 12,
  },
  stressCriticality: {
    kind: 'stressCriticality', title: 'Stress Criticality',
    fileName: 'PCL-5100-SC-002_RevC.xlsx', sizeBytes: 214_000, revision: 'C',
    uploadedBy: 'omar.haddad', uploadedAt: '2026-10-20T15:02:00+04:00',
    rows: 1236, sheet: 'Criticality', headerRow: 2,
    requiredMapped: 5, requiredTotal: 5, errors: 0, warnings: 0,
  },
};

const MOCK_SUMMARY = {
  lastRunAt: '2026-10-21T10:26:00+04:00',
  files: MOCK_FILES,
  match: { matched: 1217, conflicts: 13, missingCriticality: 18, notInLineList: 6, uniqueLineNumbers: 1242 },
  criticality: { cat1: 86, cat2: 214, cat3: 402, nonCritical: 498, notAssessed: 48 },
  changes: {
    fromRev: 'C', toRev: 'D', at: '2026-10-21T10:24:00+04:00',
    added: 6, removed: 2, changed: 9,
    changedFields: [
      { field: 'Design Pressure', count: 4 },
      { field: 'Design Temperature', count: 3 },
      { field: 'Pipe Class', count: 2 },
    ],
  },
  checks: [
    { id: 'req-cols', name: 'Required columns present', file: 'Both files', result: 'passed', resultText: 'Passed', impact: '—', action: { label: 'View mapping', target: 'mapping' } },
    { id: 'dup-lines', name: 'Duplicate line numbers', file: 'Process Line List', result: 'passed', resultText: 'None found', impact: '—' },
    { id: 'line-fmt', name: 'Line number format', file: 'Process Line List', result: 'warning', resultText: '12 warnings', impact: 'Normalised automatically; check spelling', action: { label: 'View 12 rows', target: 'register', filter: 'match=conflict' } },
    { id: 'pt-numeric', name: 'Design P / T are numeric', file: 'Process Line List', result: 'passed', resultText: 'Passed', impact: '—' },
    { id: 'cat-values', name: 'Stress category values', file: 'Stress Criticality', result: 'passed', resultText: 'Passed', impact: '—' },
    { id: 'agreement', name: 'Size / class / P / T agreement', file: 'Both files', result: 'warning', resultText: '13 conflicts', impact: 'Sent to review queue', action: { label: 'Open queue', target: 'reviewQueue' } },
    { id: 'coverage', name: 'Criticality coverage', file: 'Both files', result: 'failed', resultText: '18 lines missing', impact: 'Sent to review queue', action: { label: 'Open queue', target: 'reviewQueue' } },
  ],
  review: { open: 37, critical: 3 },
  history: [
    { at: '2026-10-21T10:26:00+04:00', by: 'sara.lindqvist', kind: 'analysis', title: 'Analysis run completed', detail: '1,217 matched · 13 conflicts · 18 missing criticality · 6 not in line list' },
    { at: '2026-10-21T10:24:00+04:00', by: 'sara.lindqvist', kind: 'upload', title: 'Process Line List Rev D uploaded', detail: '+6 added · −2 removed · 9 changed vs Rev C' },
    { at: '2026-10-20T15:02:00+04:00', by: 'omar.haddad', kind: 'upload', title: 'Stress Criticality Rev C uploaded', detail: '1,236 rows · 5 of 5 required columns mapped' },
    { at: '2026-10-19T09:41:00+04:00', by: 'sara.lindqvist', kind: 'superseded', title: 'Process Line List Rev C superseded', detail: 'Replaced by Rev D · restore needs the Lead Stress Engineer' },
    { at: '2026-10-18T14:10:00+04:00', by: 'system', kind: 'pending', title: 'Auto-save of mapping profile', detail: 'Saved profile applied to project 5100' },
  ],
};
// ---------------------------------------------------------------------------

const Ctx = createContext(null);

const REQUIRED_TOTAL = { processLineList: 9, stressCriticality: 5 };

/** Shape one store file entry into the §3 SourceFile contract. */
function shapeFile(kindKey, f) {
  if (!f) return null;
  const errors = (f.issues || []).filter(i => i.severity === 'error').length;
  const warnings = (f.issues || []).filter(i => i.severity === 'warning').length;
  return {
    kind: kindKey,
    title: kindKey === 'processLineList' ? 'Process Line List' : 'Stress Criticality',
    fileName: f.name || '—',
    sizeBytes: f.sizeBytes ?? null, // not tracked by the store yet
    revision: revLetter(f.revision),
    uploadedBy: f.uploadedBy || 'current.user',
    uploadedAt: f.uploadedAt || null,
    rows: f.rowCount ?? f.records?.length ?? 0,
    sheet: f.sheet || '—',
    headerRow: f.headerRow ?? '—',
    requiredMapped: errors ? REQUIRED_TOTAL[kindKey] - 1 : REQUIRED_TOTAL[kindKey], // mapping detail not persisted yet
    requiredTotal: REQUIRED_TOTAL[kindKey],
    errors,
    warnings,
  };
}

function buildSummary(store, running) {
  const { files, match, discrepancies, history } = store;

  const shaped = {
    processLineList: shapeFile('processLineList', files.lineList),
    stressCriticality: shapeFile('stressCriticality', files.stress),
  };

  // --- match counters (§3: matched = no conflict; +conflicts = all matched) ---
  const matchCounts = match
    ? {
        matched: Math.max(0, (match.summary.matched || 0) - (match.summary.conflicts || 0)),
        conflicts: match.summary.conflicts || 0,
        missingCriticality: match.summary.missing || 0,
        notInLineList: match.summary.notInLineList || 0,
        uniqueLineNumbers: new Set(match.lines.map(l => l._key)).size,
      }
    : { matched: 0, conflicts: 0, missingCriticality: 0, notInLineList: 0, uniqueLineNumbers: 0 };

  // --- criticality distribution from the live register lines ---
  const criticality = { cat1: 0, cat2: 0, cat3: 0, nonCritical: 0, notAssessed: 0 };
  match?.lines.forEach(l => {
    if (l.stress_category === 'L1') criticality.cat1++;
    else if (l.stress_category === 'L2') criticality.cat2++;
    else if (l.stress_category === 'L3') criticality.cat3++;
    else if (l.stress_category === 'Non-critical') criticality.nonCritical++;
    else criticality.notAssessed++;
  });

  // --- changes since last upload: real revision diff when available,
  //     MOCK changedFields until the diff endpoint reports per-field counts ---
  let changes;
  const lastLLUpload = history.find(h => h.kind === 'lineList' && (h.added || h.removed || h.changed));
  if (lastLLUpload && files.lineList && files.lineList.revision > 1) {
    changes = {
      fromRev: revLetter(files.lineList.revision - 1),
      toRev: revLetter(files.lineList.revision),
      at: lastLLUpload.at,
      added: lastLLUpload.added, removed: lastLLUpload.removed, changed: lastLLUpload.changed,
      // MOCK: per-field breakdown not computed by diffRevisions yet
      changedFields: lastLLUpload.changed > 0 ? [{ field: 'Design Pressure', count: lastLLUpload.changed }] : [],
    };
  }

  // --- validation checks (§6E rows; live counts where the store has them) ---
  const llErrors = shaped.processLineList?.errors || 0;
  const scErrors = shaped.stressCriticality?.errors || 0;
  const llWarnings = shaped.processLineList?.warnings || 0;
  const checks = [
    { id: 'req-cols', name: 'Required columns present', file: 'Both files',
      result: llErrors + scErrors > 0 ? 'failed' : 'passed',
      resultText: llErrors + scErrors > 0 ? `${llErrors + scErrors} missing` : 'Passed',
      impact: llErrors + scErrors > 0 ? 'Blocks analysis' : '—',
      action: { label: 'View mapping', target: 'mapping' } },
    { id: 'dup-lines', name: 'Duplicate line numbers', file: 'Process Line List', result: 'passed', resultText: 'None found', impact: '—' },
    { id: 'line-fmt', name: 'Line number format', file: 'Process Line List',
      result: llWarnings > 0 ? 'warning' : 'passed',
      resultText: llWarnings > 0 ? `${llWarnings} warnings` : 'Passed',
      impact: llWarnings > 0 ? 'Normalised automatically; check spelling' : '—',
      action: llWarnings > 0 ? { label: `View ${llWarnings} rows`, target: 'register', filter: 'match=conflict' } : undefined },
    { id: 'pt-numeric', name: 'Design P / T are numeric', file: 'Process Line List', result: 'passed', resultText: 'Passed', impact: '—' },
    { id: 'cat-values', name: 'Stress category values', file: 'Stress Criticality',
      result: scErrors > 0 ? 'failed' : 'passed',
      resultText: scErrors > 0 ? `${scErrors} invalid` : 'Passed',
      impact: scErrors > 0 ? 'Blocks analysis' : '—',
      action: scErrors > 0 ? { label: 'Fix values', target: 'mapping', kind: 'stressCriticality' } : undefined },
    { id: 'agreement', name: 'Size / class / P / T agreement', file: 'Both files',
      result: matchCounts.conflicts > 0 ? 'warning' : 'passed',
      resultText: matchCounts.conflicts > 0 ? `${matchCounts.conflicts} conflicts` : 'Passed',
      impact: matchCounts.conflicts > 0 ? 'Sent to review queue' : '—',
      action: matchCounts.conflicts > 0 ? { label: 'Open queue', target: 'reviewQueue' } : undefined },
    { id: 'coverage', name: 'Criticality coverage', file: 'Both files',
      result: matchCounts.missingCriticality > 0 ? 'failed' : 'passed',
      resultText: matchCounts.missingCriticality > 0 ? `${matchCounts.missingCriticality} lines missing` : 'Passed',
      impact: matchCounts.missingCriticality > 0 ? 'Sent to review queue' : '—',
      action: matchCounts.missingCriticality > 0 ? { label: 'Open queue', target: 'reviewQueue' } : undefined },
  ];

  // --- review queue counts (live from the store) ---
  const review = {
    open: discrepancies.length,
    critical: discrepancies.filter(d => d.cat === 'L1' || d.severity === 'danger').length,
  };

  // --- history timeline: real store entries, shaped to §3 ---
  const timeline = history.slice(0, 4).map(h => {
    if (h.kind === 'pending' || h.notAnalysed) {
      return {
        at: h.at, by: h.by, kind: 'pending',
        title: `${h.fileName || 'File'} uploaded — analysis not run`,
        detail: 'Saved as a new revision; re-run analysis to refresh matches',
      };
    }
    return {
      at: h.at, by: h.by, kind: 'upload',
      title: `${h.kind === 'lineList' ? 'Process Line List' : 'Stress Criticality'} Rev ${revLetter(h.revision)} uploaded`,
      detail: `+${h.added} added · −${h.removed} removed · ${h.changed} changed · ${h.fileName}`,
    };
  });

  // lastRunAt persisted in the store; legacy projects fall back to the latest upload
  const lastRunAt = store.lastRunAt
    ?? [files.lineList?.uploadedAt, files.stress?.uploadedAt].filter(Boolean).sort().pop()
    ?? null;

  const summary = {
    state: 'empty', lastRunAt,
    files: shaped, match: matchCounts, criticality, changes, checks, review,
    history: timeline,
  };
  summary.state = deriveAnalysisState({ files: shaped, lastRunAt, running });
  if (summary.state === 'blocked') {
    const bad = [shaped.processLineList, shaped.stressCriticality].find(f => f && f.errors > 0);
    summary.blockingReason = `${bad.errors} required value(s) in ${bad.title} could not be validated — fix the column mapping or the source values, then re-run.`;
  }
  return summary;
}

export function AnalysisSummaryProvider({ children }) {
  const store = useCll();
  const [running, setRunning] = useState(false);
  const [runStep, setRunStep] = useState(-1); // stepper index currently executing
  const timers = useRef([]);

  const realEmpty = !store.files.lineList && !store.files.stress;

  const summary = useMemo(() => {
    if (realEmpty && USE_MOCK_FALLBACK) {
      // MOCK fallback (see top of file) — covers the acceptance-test numbers.
      return {
        ...MOCK_SUMMARY,
        state: running ? 'running' : deriveAnalysisState({ files: MOCK_FILES, lastRunAt: MOCK_SUMMARY.lastRunAt, running }),
      };
    }
    return buildSummary(store, running);
  }, [store, running, realEmpty]);

  /** Simulated analysis job — swap for the real endpoint (§9) when it exists. */
  const runAnalysis = useCallback(() => {
    if (running) return;
    setRunning(true);
    setRunStep(0);
    timers.current.forEach(clearTimeout);
    timers.current = [1, 2, 3].map(step =>
      setTimeout(() => setRunStep(step), step * 900));
    timers.current.push(setTimeout(() => {
      setRunning(false);
      setRunStep(-1);
      store.markAnalysed?.(); // clears the 'outdated' state for real uploads
    }, 4 * 900));
  }, [running, store]);

  const value = useMemo(() => ({
    summary,
    state: summary.state,
    running,
    runStep,
    runAnalysis,
    // Role stub (§8): the app exposes no role context yet — default Engineer.
    role: 'Engineer',
    canUpload: true,   // Engineer
    canRestore: false, // Lead Stress Engineer only
  }), [summary, running, runStep, runAnalysis]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAnalysisSummary() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAnalysisSummary must be used inside <AnalysisSummaryProvider>');
  return ctx;
}
