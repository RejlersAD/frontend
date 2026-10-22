// ============================================================================
// analysisState — derives the overall analysis state for the Critical Line
// List "Upload Analysis" view.
//   'blocked'  = any source file has validation errors (>0)
//   'outdated' = a file was uploaded after the last analysis run
//   'empty'    = no source files at all
//   'running'  = an analysis job is in progress
//   otherwise  = 'complete'
// ============================================================================

export const ANALYSIS_STATES = ['empty', 'running', 'complete', 'outdated', 'blocked'];

export function deriveAnalysisState({ files = {}, lastRunAt = null, running = false } = {}) {
  const list = Object.values(files).filter(Boolean);
  if (list.length === 0) return 'empty';
  if (running) return 'running';
  if (list.some(f => (f.errors || 0) > 0)) return 'blocked';
  if (lastRunAt && list.some(f => f.uploadedAt && new Date(f.uploadedAt) > new Date(lastRunAt))) {
    return 'outdated';
  }
  if (!lastRunAt && list.some(f => f.uploadedAt)) return 'outdated';
  return 'complete';
}

/** Revision number (1-based int) → letter (1→A, 2→B …). */
export function revLetter(rev) {
  if (rev == null) return '—';
  if (typeof rev === 'string') return rev;
  return String.fromCharCode(64 + Math.min(Math.max(rev, 1), 26));
}

/** `<DD Mon YYYY, HH:mm>` — e.g. `21 Oct 2026, 10:24`. */
export function fmtDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const pad = n => String(n).padStart(2, '0');
  return `${pad(d.getDate())} ${months[d.getMonth()]} ${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** `<DD Mon, HH:mm>` short form used in stepper sub-lines. */
export function fmtShort(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const pad = n => String(n).padStart(2, '0');
  return `${pad(d.getDate())} ${months[d.getMonth()]}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Thousands-separated number (`1,248`). Tabular figures come from the mono font. */
export function fmtNum(n) {
  if (n == null || Number.isNaN(Number(n))) return '—';
  return Number(n).toLocaleString('en-US');
}

/** Bytes → `1.2 MB` / `340 KB`. */
export function fmtBytes(b) {
  if (b == null || Number.isNaN(Number(b))) return '—';
  if (b >= 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(b / 1024))} KB`;
}

/** Segment colours shared by the match-results bar / tiles (§6C). */
export const MATCH_COLORS = {
  matched: '#12936F',
  conflicts: '#E3A02B',
  missingCriticality: '#DC3545',
  notInLineList: '#EA6A1F',
};
