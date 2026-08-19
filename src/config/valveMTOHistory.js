/**
 * Valve MTO — History Store (Soft-coded)
 * ======================================
 * LocalStorage-backed history of Valve MTO snapshots so users can restore
 * past extractions without re-running OpenAI Vision on the same PDF.
 *
 * Storage shape (single key, single JSON blob):
 *   { entries: HistoryEntry[] }
 *
 * HistoryEntry = {
 *   id,          // stable id "h_<ts>_<rand>"
 *   label,       // user-facing name (auto-generated, renameable)
 *   source,      // 'pdf' | 'spreadsheet' | 'manual'
 *   sourceFile,  // original filename if any
 *   engine,      // 'vision' | 'gpt-4o-mini' | 'spreadsheet' | …
 *   savedAt,     // ISO timestamp
 *   rowCount,    // number of valve rows
 *   project,     // copy of project header
 *   rows,        // copy of valve rows
 * }
 *
 * All thresholds and keys are soft-coded constants below — never hardcoded
 * inline at call sites.
 */

// ─── Soft-coded config ───────────────────────────────────────────────────
export const HISTORY_STORAGE_KEY  = 'radai.valveMTO.history.v1';
export const HISTORY_REFRESH_EVENT = 'radai:valveMTO:history:refresh';
export const HISTORY_MAX_ENTRIES   = 50;            // FIFO cap
export const HISTORY_AUTOSAVE_MIN_ROWS = 1;         // skip empty imports
export const HISTORY_LABEL_MAX_LEN = 80;
export const HISTORY_SOURCE_META = {
  pdf:         { label: 'PDF (AI Vision)', accent: 'amber'   },
  spreadsheet: { label: 'Spreadsheet',     accent: 'sky'     },
  manual:      { label: 'Manual snapshot', accent: 'slate'   },
};

const newId = () => `h_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const safeRead = () => {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return { entries: [] };
    const parsed = JSON.parse(raw);
    return { entries: Array.isArray(parsed?.entries) ? parsed.entries : [] };
  } catch {
    return { entries: [] };
  }
};

const safeWrite = (state) => {
  try {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(state));
    window.dispatchEvent(new CustomEvent(HISTORY_REFRESH_EVENT));
  } catch (err) {
    // Likely quota — drop the oldest half and retry once.
    console.warn('[ValveMTOHistory] write failed, trimming:', err?.message);
    try {
      const trimmed = { entries: state.entries.slice(0, Math.floor(HISTORY_MAX_ENTRIES / 2)) };
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(trimmed));
      window.dispatchEvent(new CustomEvent(HISTORY_REFRESH_EVENT));
    } catch { /* give up */ }
  }
};

const truncate = (s, n) => (s && s.length > n ? `${s.slice(0, n - 1)}…` : s || '');

const buildAutoLabel = ({ project, sourceFile, source }) => {
  const docNo = project?.doc_no?.trim();
  const proj  = project?.project_name?.trim();
  const base  = docNo || proj || sourceFile || 'Valve MTO';
  const tag   = source === 'pdf' ? 'PDF' : source === 'spreadsheet' ? 'XLS' : 'Manual';
  return truncate(`${base} · ${tag}`, HISTORY_LABEL_MAX_LEN);
};

// ─── Public API ──────────────────────────────────────────────────────────
export const listHistory = () =>
  safeRead().entries.slice().sort((a, b) => (b.savedAt || '').localeCompare(a.savedAt || ''));

export const getHistoryEntry = (id) => safeRead().entries.find((e) => e.id === id) || null;

export const saveHistoryEntry = ({
  source = 'manual',
  sourceFile = '',
  engine = '',
  project = {},
  rows = [],
  label,
} = {}) => {
  if (!Array.isArray(rows) || rows.length < HISTORY_AUTOSAVE_MIN_ROWS) return null;

  const entry = {
    id:         newId(),
    label:      truncate(label || buildAutoLabel({ project, sourceFile, source }), HISTORY_LABEL_MAX_LEN),
    source,
    sourceFile: sourceFile || '',
    engine:     engine || '',
    savedAt:    new Date().toISOString(),
    rowCount:   rows.length,
    project:    { ...project },
    rows:       rows.map((r) => ({ ...r })),
  };

  const cur = safeRead();
  const next = [entry, ...cur.entries].slice(0, HISTORY_MAX_ENTRIES);
  safeWrite({ entries: next });
  return entry;
};

export const renameHistoryEntry = (id, label) => {
  const cur = safeRead();
  const next = cur.entries.map((e) =>
    e.id === id ? { ...e, label: truncate((label || '').trim() || e.label, HISTORY_LABEL_MAX_LEN) } : e,
  );
  safeWrite({ entries: next });
};

export const deleteHistoryEntry = (id) => {
  const cur = safeRead();
  safeWrite({ entries: cur.entries.filter((e) => e.id !== id) });
};

export const clearHistory = () => safeWrite({ entries: [] });

const _exports = {
  HISTORY_STORAGE_KEY, HISTORY_REFRESH_EVENT, HISTORY_MAX_ENTRIES,
  HISTORY_AUTOSAVE_MIN_ROWS, HISTORY_LABEL_MAX_LEN, HISTORY_SOURCE_META,
  listHistory, getHistoryEntry, saveHistoryEntry, renameHistoryEntry,
  deleteHistoryEntry, clearHistory,
};
export default _exports;
