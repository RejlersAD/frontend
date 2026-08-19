/**
 * Valve MTO — AI Performance / Accuracy Metrics (Soft-coded)
 * ==========================================================
 * Pure functions that derive AI extraction-quality metrics from the
 * existing history & projects stores. Read-only — never mutates state and
 * never touches core extraction logic.
 *
 * "Accuracy" here is a proxy score because we don't have a ground-truth
 * reference. We compute it as the weighted completeness of critical fields
 * across all rows produced by AI Vision (`source === 'pdf'`).
 */

// ─── Soft-coded weights & thresholds ─────────────────────────────────────
// Each critical field contributes a weighted share to the per-row score.
// Tweak weights freely — they re-normalise to 1.0 on use.
export const PERF_FIELD_WEIGHTS = {
  type:        2.0,   // valve type — must be present
  pms_class:   2.0,   // piping material class
  size_1:      2.0,   // primary nominal size
  valve_tag:   1.5,   // tag from spec / area code
  rating:      1.0,
  bore:        0.7,
  description: 0.7,
  qty:         1.5,   // sum(qty_island + qty_field) > 0
  unit:        0.5,
};

// Minimum row count for a snapshot to count toward the rolling accuracy
// score (avoids tiny outliers skewing the dashboard).
export const PERF_MIN_ROWS_FOR_SCORE = 3;

// Score banding for the dashboard pill.
export const PERF_BANDS = [
  { min: 90, label: 'Excellent', color: 'emerald', desc: 'Production-grade extraction' },
  { min: 75, label: 'Good',      color: 'sky',     desc: 'Minor manual edits expected' },
  { min: 60, label: 'Fair',      color: 'amber',   desc: 'Review and complete missing fields' },
  { min:  0, label: 'Needs work', color: 'rose',   desc: 'PDF quality or template may be unusual' },
];

// History sources that represent AI extractions (vs spreadsheet/manual).
export const PERF_AI_SOURCES = ['pdf'];

// Trend bucket size when graphing (most recent N extractions).
export const PERF_TREND_LIMIT = 12;

// ─── Helpers ─────────────────────────────────────────────────────────────
const isFilled = (v) => {
  if (v === null || v === undefined) return false;
  const s = String(v).trim();
  return s.length > 0 && s !== '0' && s !== '-';
};

const numericFilled = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0;
};

const totalWeight = Object.values(PERF_FIELD_WEIGHTS).reduce((a, b) => a + b, 0);

/** Score a single row 0..1 using the weighted critical-field map. */
export const scoreRow = (row = {}) => {
  let got = 0;
  if (isFilled(row.type))        got += PERF_FIELD_WEIGHTS.type;
  if (isFilled(row.pms_class))   got += PERF_FIELD_WEIGHTS.pms_class;
  if (isFilled(row.size_1))      got += PERF_FIELD_WEIGHTS.size_1;
  if (isFilled(row.valve_tag))   got += PERF_FIELD_WEIGHTS.valve_tag;
  if (isFilled(row.rating))      got += PERF_FIELD_WEIGHTS.rating;
  if (isFilled(row.bore))        got += PERF_FIELD_WEIGHTS.bore;
  if (isFilled(row.description)) got += PERF_FIELD_WEIGHTS.description;
  if (isFilled(row.unit))        got += PERF_FIELD_WEIGHTS.unit;
  if (numericFilled(row.qty_island) || numericFilled(row.qty_field)) {
    got += PERF_FIELD_WEIGHTS.qty;
  }
  return totalWeight > 0 ? got / totalWeight : 0;
};

/** Score a snapshot (mean of row scores). Returns 0 if no rows. */
export const scoreSnapshot = (entry) => {
  const rows = entry?.rows || [];
  if (!rows.length) return 0;
  const sum = rows.reduce((acc, r) => acc + scoreRow(r), 0);
  return sum / rows.length;
};

/** Per-field fill rate across an array of rows. */
export const fieldFillRates = (rows = []) => {
  if (!rows.length) return [];
  const n = rows.length;
  const checks = [
    { key: 'type',        label: 'Type',         test: (r) => isFilled(r.type) },
    { key: 'pms_class',   label: 'PMS Class',    test: (r) => isFilled(r.pms_class) },
    { key: 'size_1',      label: 'Size',         test: (r) => isFilled(r.size_1) },
    { key: 'valve_tag',   label: 'Valve Tag',    test: (r) => isFilled(r.valve_tag) },
    { key: 'rating',      label: 'Rating',       test: (r) => isFilled(r.rating) },
    { key: 'bore',        label: 'Bore',         test: (r) => isFilled(r.bore) },
    { key: 'description', label: 'Description',  test: (r) => isFilled(r.description) },
    { key: 'qty',         label: 'Quantity',     test: (r) => numericFilled(r.qty_island) || numericFilled(r.qty_field) },
    { key: 'unit',        label: 'Unit',         test: (r) => isFilled(r.unit) },
  ];
  return checks.map((c) => ({
    key:   c.key,
    label: c.label,
    rate:  rows.filter(c.test).length / n,
  }));
};

/** Pick the band entry (label/color) for a 0–100 score. */
export const bandFor = (pct) => PERF_BANDS.find((b) => pct >= b.min) || PERF_BANDS[PERF_BANDS.length - 1];

/** Aggregate metrics from the full history store. */
export const computePerformance = (history = []) => {
  const aiEntries = history.filter((h) => PERF_AI_SOURCES.includes(h.source));
  const scoredEntries = aiEntries.filter((h) => (h.rowCount || 0) >= PERF_MIN_ROWS_FOR_SCORE);

  const totalRows = aiEntries.reduce((acc, h) => acc + (h.rowCount || 0), 0);
  const totalSnapshots = aiEntries.length;
  const avgRows = totalSnapshots ? totalRows / totalSnapshots : 0;

  const avgScore = scoredEntries.length
    ? scoredEntries.reduce((acc, h) => acc + scoreSnapshot(h), 0) / scoredEntries.length
    : 0;

  // Aggregate per-field fill rate across ALL AI rows.
  const allRows = aiEntries.flatMap((h) => h.rows || []);
  const fieldRates = fieldFillRates(allRows);

  // Trend (most recent N, oldest → newest for charting).
  const trend = aiEntries
    .slice() // already sorted newest-first by listHistory
    .slice(0, PERF_TREND_LIMIT)
    .reverse()
    .map((h) => ({
      id:       h.id,
      label:    h.label,
      savedAt:  h.savedAt,
      rowCount: h.rowCount || 0,
      score:    scoreSnapshot(h),
    }));

  // Engine breakdown.
  const engineMap = new Map();
  aiEntries.forEach((h) => {
    const key = h.engine || 'unknown';
    const cur = engineMap.get(key) || { engine: key, count: 0, rows: 0 };
    cur.count += 1;
    cur.rows  += (h.rowCount || 0);
    engineMap.set(key, cur);
  });

  // Detailed per-snapshot breakdown (newest first) — for drill-down panel.
  const detailed = aiEntries.map((h) => {
    const snapScore = scoreSnapshot(h);
    const snapPct   = Math.round(snapScore * 100);
    const rates     = fieldFillRates(h.rows || []);
    const weakest   = rates.slice().sort((a, b) => a.rate - b.rate).slice(0, 3);
    return {
      id:       h.id,
      label:    h.label,
      savedAt:  h.savedAt,
      sourceFile: h.sourceFile || '',
      engine:   h.engine || 'unknown',
      rowCount: h.rowCount || 0,
      score:    snapScore,
      scorePct: snapPct,
      band:     bandFor(snapPct),
      rates,
      weakest,
    };
  });

  // Trend delta — last vs prior average — for hero card.
  const recent = trend.slice(-3).filter((t) => t.score > 0);
  const older  = trend.slice(0, Math.max(0, trend.length - 3)).filter((t) => t.score > 0);
  const recentAvg = recent.length ? recent.reduce((a, t) => a + t.score, 0) / recent.length : 0;
  const olderAvg  = older.length  ? older.reduce((a, t) => a + t.score, 0) / older.length  : 0;
  const trendDeltaPct = recent.length && older.length
    ? Math.round((recentAvg - olderAvg) * 100)
    : 0;

  return {
    totalSnapshots,
    totalRows,
    avgRows,
    avgScore,            // 0..1
    avgScorePct: Math.round(avgScore * 100),
    band: bandFor(Math.round(avgScore * 100)),
    fieldRates,
    trend,
    trendDeltaPct,
    engines: Array.from(engineMap.values()).sort((a, b) => b.count - a.count),
    detailed,
  };
};

// ─── Recommendations engine ──────────────────────────────────────────────
// Each rule is a soft-coded predicate returning a recommendation card when
// it matches. Tweak/extend freely without touching the UI.
export const PERF_RECOMMENDATION_RULES = [
  {
    id: 'low-overall',
    when: (p) => p.totalSnapshots > 0 && p.avgScorePct > 0 && p.avgScorePct < 60,
    severity: 'high',
    icon: 'alert',
    title: 'Overall extraction quality is low',
    body: (p) =>
      `Average score is ${p.avgScorePct}%. PDFs may be scanned, low-resolution, or use a non-standard valve template. ` +
      `Try re-uploading at higher resolution, or split multi-sheet PDFs into single-sheet files before extracting.`,
  },
  {
    id: 'few-rows-per-run',
    when: (p) => p.totalSnapshots >= 2 && p.avgRows > 0 && p.avgRows < 5,
    severity: 'medium',
    icon: 'lightbulb',
    title: 'Average valve count per run is small',
    body: (p) =>
      `You're averaging only ${p.avgRows.toFixed(1)} valve rows per extraction. If your MTO has more, the AI may be ` +
      `missing rows due to thin tables or merged cells — try cropping to the valve table area before upload.`,
  },
  {
    id: 'trend-improving',
    when: (p) => p.trendDeltaPct >= 5,
    severity: 'positive',
    icon: 'sparkles',
    title: 'Accuracy is improving',
    body: (p) =>
      `Recent extractions are scoring +${p.trendDeltaPct} points higher than your earlier runs. ` +
      `Whatever you changed in source PDFs is working — keep the same prep workflow.`,
  },
  {
    id: 'trend-declining',
    when: (p) => p.trendDeltaPct <= -5,
    severity: 'high',
    icon: 'alert',
    title: 'Accuracy is declining',
    body: (p) =>
      `Recent extractions score ${Math.abs(p.trendDeltaPct)} points lower on average. ` +
      `Check if newer PDFs use a different template, page rotation, or scan quality.`,
  },
  {
    id: 'low-tag-fill',
    when: (p) => fieldRate(p, 'valve_tag') < 0.5 && p.totalSnapshots > 0,
    severity: 'medium',
    icon: 'target',
    title: 'Valve Tag is often missing',
    body: (p) =>
      `Only ${pctOf(fieldRate(p, 'valve_tag'))}% of rows have a valve tag. ` +
      `Tags are usually computed from PMS class + size — verify your PDFs include the PMS class column visibly.`,
  },
  {
    id: 'low-rating',
    when: (p) => fieldRate(p, 'rating') < 0.4 && p.totalSnapshots > 0,
    severity: 'low',
    icon: 'lightbulb',
    title: 'Rating / Facing rarely captured',
    body: () =>
      `Rating/Facing is missing in most rows. If your project doesn't use this column it's safe to ignore — ` +
      `otherwise verify the column header is on the same page as the data rows.`,
  },
  {
    id: 'low-qty',
    when: (p) => fieldRate(p, 'qty') < 0.7 && p.totalSnapshots > 0,
    severity: 'high',
    icon: 'alert',
    title: 'Quantity columns often empty',
    body: (p) =>
      `Only ${pctOf(fieldRate(p, 'qty'))}% of rows have any quantity. Quantities are critical for procurement — ` +
      `confirm the ISLAND / FIELD / TOTAL columns are visible and not split across page breaks.`,
  },
  {
    id: 'consistency-warn',
    when: (p) => p.totalSnapshots >= 3 && spread(p.detailed) >= 25,
    severity: 'medium',
    icon: 'target',
    title: 'Inconsistent results across runs',
    body: (p) => {
      const s = spread(p.detailed);
      return `Your scores vary by ${s} points across runs. PDFs from different vendors or templates may need different ` +
        `pre-processing. Open a low-scoring run from the detailed list below to see exactly which fields failed.`;
    },
  },
  {
    id: 'all-good',
    when: (p) => p.totalSnapshots >= 2 && p.avgScorePct >= 85,
    severity: 'positive',
    icon: 'sparkles',
    title: 'AI Vision is performing excellently',
    body: (p) =>
      `Average score is ${p.avgScorePct}%. Your PDFs are clean and the AI is reading them confidently — ` +
      `you can trust the output with only spot-checks.`,
  },
  {
    id: 'first-run',
    when: (p) => p.totalSnapshots === 1,
    severity: 'info',
    icon: 'lightbulb',
    title: 'Run a few more extractions to build a baseline',
    body: () =>
      `Performance trends become meaningful after 3+ extractions. Try a few sample MTOs to see how the AI behaves ` +
      `on your typical document set.`,
  },
];

const fieldRate = (p, key) => {
  const f = (p.fieldRates || []).find((x) => x.key === key);
  return f ? f.rate : 1;
};
const pctOf = (r) => Math.round((r || 0) * 100);
const spread = (detailed = []) => {
  const scores = detailed.filter((d) => d.scorePct > 0).map((d) => d.scorePct);
  if (scores.length < 2) return 0;
  return Math.max(...scores) - Math.min(...scores);
};

/** Run all recommendation rules and return the matching cards. */
export const computeRecommendations = (perf) =>
  PERF_RECOMMENDATION_RULES
    .filter((r) => {
      try { return r.when(perf); } catch { return false; }
    })
    .map((r) => ({
      id: r.id,
      severity: r.severity,
      icon: r.icon,
      title: r.title,
      body:  typeof r.body === 'function' ? r.body(perf) : r.body,
    }));

const _exports = {
  PERF_FIELD_WEIGHTS, PERF_MIN_ROWS_FOR_SCORE, PERF_BANDS,
  PERF_AI_SOURCES, PERF_TREND_LIMIT, PERF_RECOMMENDATION_RULES,
  scoreRow, scoreSnapshot, fieldFillRates, bandFor,
  computePerformance, computeRecommendations,
};
export default _exports;
