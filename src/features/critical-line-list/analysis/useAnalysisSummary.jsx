// ============================================================================
// useAnalysisSummary — single source of truth for the Upload Analysis view.
// Shapes CllStore data (LDT file / criteria / evaluations / review items)
// into the §6 AnalysisSummary contract:
//   { state, lastRunAt, files:{processLineList, criteria},
//     results:{L1,L2,L3,cannotEvaluate},
//     flagCheck:{agrees,notFlaggedL1,flaggedConservative,noFlag},
//     criteria:{locationType,source,standard,revision},
//     changes, checks[], review{open,critical}, history[], cellCounts }
// One instance is shared by the page shell (tabs + banner) and the tab
// itself: CllPage wraps the outlet in <AnalysisSummaryProvider>.
// ============================================================================
import React, { createContext, useContext, useMemo, useRef, useState, useCallback } from 'react';
import { useCll } from '../../../pages/Engineering/Piping/cll/CllStore';
import { deriveAnalysisState, revLetter } from './analysisState';
import { criteriaSummary, NPS_ROW_LABELS } from '../../../pages/Engineering/Piping/cll/criticalityEngine';

const Ctx = createContext(null);

/** Shape the LDT file entry into the SourceFile contract. */
function shapeLdt(f) {
  if (!f) return null;
  const errors = (f.issues || []).filter(i => i.severity === 'error').length;
  const warnings = (f.issues || []).filter(i => i.severity === 'warning').length;
  return {
    kind: 'processLineList',
    title: 'Process Line List (LDT)',
    fileName: f.name || '—',
    sizeBytes: f.sizeBytes ?? null,
    revision: revLetter(f.revision),
    uploadedBy: f.uploadedBy || 'current.user',
    uploadedAt: f.uploadedAt || null,
    rows: f.rowCount ?? f.records?.length ?? 0,
    sheet: f.sheet || '—',
    headerRow: (f.headerRow ?? 7) + 1,
    unitsRow: (f.headerRow ?? 7) + 2,
    requiredMapped: f.requiredMapped ?? 10,
    requiredTotal: 10,
    errors,
    warnings,
  };
}

/** Shape the criteria entry into the SourceFile contract. */
function shapeCriteria(criteria, criteriaFile) {
  if (!criteria && !criteriaFile) return null;
  const cs = criteria ? criteriaSummary(criteria) : null;
  return {
    kind: 'stressCriteria',
    title: 'Stress criticality criteria',
    fileName: criteriaFile?.name || (criteria?.source === 'builtin' ? 'Built-in table' : '—'),
    sizeBytes: criteriaFile?.sizeBytes ?? null,
    revision: criteriaFile ? revLetter(criteriaFile.revision) : (criteria?.revision || '—'),
    uploadedBy: criteriaFile?.uploadedBy || 'system',
    uploadedAt: criteriaFile?.uploadedAt || null,
    locationType: criteria?.locationType || null,
    source: criteria?.source || 'upload',
    standard: criteria?.standard || '—',
    criteriaRevision: criteria?.revision || '—',
    gridText: cs ? `${cs.rows} × ${cs.cols} · ${cs.valid ? 'valid' : 'invalid'}` : '—',
    gridValid: cs?.valid ?? false,
    categories: cs?.categories || [],
    errors: criteriaFile?.errors ?? 0,
    warnings: criteriaFile?.warnings ?? 0,
    rows: 13,
    sheet: criteriaFile?.sheet || 'TABLE 2',
    headerRow: '—',
    requiredMapped: 0,
    requiredTotal: 0,
  };
}

function issueCount(issues, type) {
  return (issues || []).filter(i => i.type === type).length;
}

function buildSummary(store) {
  const { files, criteria, criteriaFile = files.criteriaFile, evaluation, reviewItems, history, activeProject } = store;

  const shaped = {
    processLineList: shapeLdt(files.lineList),
    criteria: shapeCriteria(criteria, criteriaFile),
  };

  const results = evaluation?.results || { L1: 0, L2: 0, L3: 0, cannotEvaluate: 0 };
  const flagCheck = evaluation?.flagCheck || { agrees: 0, notFlaggedL1: 0, flaggedConservative: 0, noFlag: 0 };
  const cellCounts = evaluation?.cellCounts || null;

  // --- changes since last upload (LDT revision diff) ---
  let changes;
  const lastLLUpload = history.find(h => h.kind === 'lineList' && (h.added || h.removed || h.changed));
  if (lastLLUpload && files.lineList && files.lineList.revision > 1) {
    changes = {
      fromRev: revLetter(files.lineList.revision - 1),
      toRev: revLetter(files.lineList.revision),
      at: lastLLUpload.at,
      added: lastLLUpload.added, removed: lastLLUpload.removed, changed: lastLLUpload.changed,
      changedFields: lastLLUpload.changed > 0 ? [{ field: 'Design Temperature', count: lastLLUpload.changed }] : [],
    };
  }

  // --- §5E validation checks ---
  const issues = files.lineList?.issues || [];
  const llErrors = issues.filter(i => i.severity === 'error');
  const reqErrors = llErrors.filter(i => i.type === 'required-column').length;
  const dupNo = issueCount(issues, 'duplicate-line-number');
  const dupKey = issueCount(issues, 'duplicate-line-key');
  const classMm = issueCount(issues, 'class-mismatch');
  const multiSize = issueCount(issues, 'multiple-sizes');
  const lowerCase = issueCount(issues, 'lower-case');
  const missingDT = (evaluation?.evaluations || []).filter(e => e.status === 'cannot-evaluate').length;
  const criteriaFileErrors = criteriaFile?.errors ?? 0;
  const cs = criteria ? criteriaSummary(criteria) : null;
  const locType = activeProject?.locationType || null;

  const checks = [];
  if (files.lineList) {
    checks.push(
      { id: 'req-cols', name: 'Required columns present', file: 'Process Line List',
        result: reqErrors ? 'failed' : 'passed',
        resultText: reqErrors ? `${reqErrors} missing` : `Passed ${shaped.processLineList.requiredMapped} of 10`,
        impact: reqErrors ? 'Blocks analysis' : '—',
        action: { label: 'View mapping', target: 'mapping', kind: 'processLineList' } },
      { id: 'dup-lines', name: 'Duplicate line numbers', file: 'Process Line List',
        result: dupNo ? 'failed' : 'passed', resultText: dupNo ? `${dupNo} found` : 'None found',
        impact: dupNo ? 'Blocks analysis' : '—' },
      { id: 'dup-keys', name: 'Duplicate line keys', file: 'Process Line List',
        result: dupKey ? 'warning' : 'passed', resultText: dupKey ? `${dupKey} warning${dupKey > 1 ? 's' : ''}` : 'None found',
        impact: dupKey ? 'Check insulation code' : '—',
        action: dupKey ? { label: 'View rows', target: 'register', filter: 'check=duplicate-line-key' } : undefined },
      { id: 'class-mm', name: 'Line number vs MATERIAL CLASS', file: 'Process Line List',
        result: classMm ? 'warning' : 'passed', resultText: classMm ? `${classMm} warnings` : 'Passed',
        impact: classMm ? 'Line number may be out of date' : '—',
        action: classMm ? { label: `View ${classMm} rows`, target: 'register', filter: 'check=class-mismatch' } : undefined },
      { id: 'size-parse', name: 'Size parsable', file: 'Process Line List',
        result: multiSize ? 'warning' : 'passed', resultText: multiSize ? `${multiSize} warnings (multiple sizes)` : 'Passed',
        impact: multiSize ? 'Evaluated on largest size' : '—',
        action: multiSize ? { label: 'View rows', target: 'register', filter: 'check=multiple-sizes' } : undefined },
      { id: 'lower-case', name: 'Lower-case codes', file: 'Process Line List',
        result: lowerCase ? 'warning' : 'passed', resultText: lowerCase ? `${lowerCase} normalised` : 'Passed',
        impact: '—',
        action: lowerCase ? { label: 'View rows', target: 'register', filter: 'check=lower-case' } : undefined },
      { id: 'pt-numeric', name: 'Design T / P numeric', file: 'Process Line List',
        result: missingDT ? 'warning' : 'passed', resultText: missingDT ? `${missingDT} lines cannot be evaluated` : 'Passed',
        impact: missingDT ? 'Missing size or design temperature' : '—',
        action: missingDT ? { label: 'View rows', target: 'register', filter: 'status=cannot-evaluate' } : undefined },
    );
  }
  if (criteria) {
    checks.push(
      { id: 'grid-valid', name: 'Criteria grid valid 13 × 15', file: 'Criteria table',
        result: criteriaFileErrors ? 'failed' : cs?.valid ? 'passed' : 'failed',
        resultText: cs?.valid ? 'Passed' : 'Invalid cells',
        impact: cs?.valid ? '—' : 'Blocks analysis',
        action: { label: 'Grid check', target: 'mapping', kind: 'stressCriteria' } },
      { id: 'type-match', name: 'Criteria matches project type', file: 'Criteria table',
        result: locType && criteria.locationType === locType ? 'passed' : 'failed',
        resultText: locType && criteria.locationType === locType
          ? `Passed ${locType === 'onshore' ? 'Onshore' : 'Offshore'}`
          : 'Mismatch',
        impact: locType && criteria.locationType === locType ? '—' : 'Blocks analysis' },
    );
  }
  if (evaluation) {
    checks.push({
      id: 'flag-check', name: 'Line list flag vs Table 2', file: 'Both',
      result: flagCheck.notFlaggedL1 ? 'failed' : 'passed',
      resultText: flagCheck.notFlaggedL1 ? `${flagCheck.notFlaggedL1} not flagged but L1` : 'Passed',
      impact: flagCheck.notFlaggedL1 ? 'Sent to review queue' : '—',
      action: flagCheck.notFlaggedL1 ? { label: 'Open queue', target: 'reviewQueue' } : undefined,
    });
  }

  const review = {
    open: reviewItems.length,
    critical: reviewItems.filter(d => d.severity === 'critical').length,
  };

  // --- history timeline ---
  const timeline = history.slice(0, 6).map(h => {
    if (h.title) {
      return { at: h.at, by: h.by, kind: h.kind === 'location' || h.kind === 'criteria' ? 'analysis' : 'upload', title: h.title, detail: h.detail };
    }
    return {
      at: h.at, by: h.by, kind: 'upload',
      title: `Process Line List Rev ${revLetter(h.revision)} uploaded`,
      detail: `+${h.added} added · −${h.removed} removed · ${h.changed} changed · ${h.fileName}`,
    };
  });

  const lastRunAt = store.lastRunAt ?? files.lineList?.uploadedAt ?? null;

  const summary = {
    state: 'empty', lastRunAt,
    files: shaped, results, flagCheck, cellCounts, changes, checks, review,
    criteria: criteria
      ? { locationType: criteria.locationType, source: criteria.source, standard: criteria.standard, revision: criteria.revision }
      : null,
    history: timeline,
    evaluations: evaluation?.evaluations || [],
  };

  // --- state derivation ---
  if (locType === 'offshore' && !criteria) {
    summary.state = 'blocked';
    summary.blockingReason = 'Offshore criteria table not uploaded.';
  } else if (locType === 'onshore' && !criteria) {
    summary.state = 'blocked';
    summary.blockingReason = 'Onshore criteria not available.';
  } else {
    summary.state = deriveAnalysisState({
      files: shaped, lastRunAt,
      pendingReRun: store.pendingReRun,
    });
  }
  if (summary.state === 'blocked' && !summary.blockingReason) {
    const bad = [shaped.processLineList, shaped.criteria].find(f => f && f.errors > 0);
    if (bad) {
      summary.blockingReason = `${bad.errors} error(s) in ${bad.title} — fix the source file, then re-upload.`;
    }
  }
  return summary;
}

export function AnalysisSummaryProvider({ children }) {
  const store = useCll();
  const [running, setRunning] = useState(false);
  const [runStep, setRunStep] = useState(-1);
  const timers = useRef([]);

  const summary = useMemo(() => buildSummary(store), [store]);

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
      store.markAnalysed?.();
    }, 4 * 900));
  }, [running, store]);

  const state = running ? 'running' : summary.state;

  const value = useMemo(() => ({
    summary: { ...summary, state },
    state,
    running,
    runStep,
    runAnalysis,
    // Role stub (§1): default Engineer; Engineer treated as allowed for now.
    role: store.role || 'Engineer',
    canUpload: true,
    canRestore: false,
  }), [summary, state, running, runStep, runAnalysis, store.role]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAnalysisSummary() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAnalysisSummary must be used inside <AnalysisSummaryProvider>');
  return ctx;
}

export { NPS_ROW_LABELS };
