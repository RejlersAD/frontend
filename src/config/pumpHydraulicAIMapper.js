/**
 * Pump Hydraulic — AI Result Mapper
 * =================================
 * Translates the JSON returned by `/pid/equipment/results/<id>/`
 * into the flat form-state shape persisted by the renderer
 * (`radai.pumpHydraulic.formState.v1`).
 *
 * SOFT-CODED: every mapping rule is declared in `FIELD_MAP` and
 * `MATRIX_MAP` below. To extend coverage (e.g. when the backend
 * starts returning new fields) — just add an entry. No code changes.
 *
 * Backend contract (UNCHANGED — `equipment_analysis_views.get_equipment_analysis_results`):
 *   {
 *     success:     bool,
 *     equipment:   [ { tag, equipment_type, description,
 *                       design_flowrate, oper_pressure, oper_temperature,
 *                       design_pressure_min, design_pressure_max,
 *                       design_temp_min, design_temp_max,
 *                       moc, insulation, dimension_length, dimension_diameter,
 *                       motor_rating, pid_no, quality_required, phase,
 *                       remarks, ... }, ... ],
 *     total:       number,
 *     drawing_ref: string,
 *   }
 */

import { STORAGE_KEY } from './pumpHydraulicTemplate.config';

// ─── Helpers ──────────────────────────────────────────────────────────────
const toNum = (v) => {
  if (v === null || v === undefined || v === '' || v === '-') return undefined;
  const n = Number(String(v).replace(/[^\d.\-eE+]/g, ''));
  return Number.isFinite(n) ? n : undefined;
};
const firstNonEmpty = (...vals) => vals.find(
  (v) => v !== undefined && v !== null && v !== '' && v !== '-',
);

// ─── 1) Single-value mapping (first detected pump → form fields) ─────────
// Each rule = { dest: form-state key, src: equipment-item key | array, transform? }
const FIELD_MAP = [
  // Cover
  { dest: 'cover.equipment_tag',  src: 'tag' },
  { dest: 'cover.equipment_desc', src: ['description', 'equipment_type'] },

  // Pump Cal — General Information
  { dest: 'pump.tag_no',              src: 'tag' },
  { dest: 'pump.service',             src: ['description', 'equipment_type'] },
  { dest: 'pump.temperature',         src: 'oper_temperature', transform: toNum },
  { dest: 'pump.motor_classification',src: 'motor_rating' },

  // Pump Cal — Operating Conditions
  { dest: 'pump.flow_normal',         src: 'design_flowrate', transform: toNum },

  // Pump Cal — Power Consumption
  { dest: 'pump.motor_rating',        src: 'motor_rating', transform: toNum },

  // Pump Cal — Results (best-effort from operating data)
  { dest: 'pump.r_disch_pr',          src: 'oper_pressure', transform: toNum },

  // Result Summary
  { dest: 'result.rated_capacity',    src: 'design_flowrate', transform: toNum },
  { dest: 'result.discharge_pressure',src: 'oper_pressure',   transform: toNum },

  // Basis (free text — useful aggregate)
  {
    dest: 'basis.references',
    src: '__derived__:references',
    transform: (_v, item, results) => {
      const drawing = results?.drawing_ref ? `Drawing: ${results.drawing_ref}` : '';
      const pid     = item?.pid_no ? `P&ID No.: ${item.pid_no}` : '';
      const total   = results?.total ? `Pumps detected: ${results.total}` : '';
      return [drawing, pid, total].filter(Boolean).join('\n') || undefined;
    },
  },
];

// ─── 2) Per-line matrix mapping (Pressure Drop Cal) ──────────────────────
// Each detected pump contributes ONE line column in the matrix. Up to
// PD_LINE_COUNT (10) pumps will be projected into the matrix.
const MATRIX_LINE_MAX = 10;
const MATRIX_MAP = [
  { destPrefix: 'pd.line_no',     src: 'tag' },
  { destPrefix: 'pd.drawing_ref', src: 'pid_no' },
  { destPrefix: 'pd.from',        src: 'description' },
  { destPrefix: 'pd.pressure',    src: 'oper_pressure',   transform: toNum },
  { destPrefix: 'pd.temperature', src: 'oper_temperature',transform: toNum },
  { destPrefix: 'pd.mass_flow',   src: 'design_flowrate', transform: toNum },
];

// ─── Mapper ───────────────────────────────────────────────────────────────
export const mapResultsToFormState = (resultsData) => {
  if (!resultsData || !Array.isArray(resultsData.equipment) || resultsData.equipment.length === 0) {
    return {};
  }
  const items = resultsData.equipment;
  const primary = items[0] || {};
  const patch = {};

  // Single fields — derived from the FIRST detected pump
  for (const rule of FIELD_MAP) {
    const srcKeys = Array.isArray(rule.src) ? rule.src : [rule.src];
    let raw;
    if (srcKeys[0]?.startsWith('__derived__:')) {
      raw = undefined; // forces transform path
    } else {
      raw = firstNonEmpty(...srcKeys.map((k) => primary[k]));
    }
    const value = rule.transform ? rule.transform(raw, primary, resultsData) : raw;
    if (value !== undefined && value !== null && value !== '') {
      patch[rule.dest] = value;
    }
  }

  // Matrix fields — one column per detected pump (capped)
  const lines = items.slice(0, MATRIX_LINE_MAX);
  lines.forEach((item, idx) => {
    for (const rule of MATRIX_MAP) {
      const raw = item[rule.src];
      const value = rule.transform ? rule.transform(raw, item, resultsData) : raw;
      if (value !== undefined && value !== null && value !== '') {
        patch[`${rule.destPrefix}.${idx}`] = value;
      }
    }
    // Set Suction/Discharge column hint (default: Discharge for first, Suction for rest)
    patch[`pd.suc_or_disch.${idx}`] = idx === 0 ? 'Discharge' : 'Suction';
  });

  return patch;
};

// ─── Apply patch + emit cross-component refresh signal ───────────────────
export const REFRESH_EVENT = 'radai:pumpHydraulic:formStateRefresh';

export const applyExtractedDataToForm = (resultsData) => {
  const patch = mapResultsToFormState(resultsData);
  if (Object.keys(patch).length === 0) return { applied: 0 };

  let current = {};
  try { current = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
  catch { current = {}; }

  const merged = { ...current, ...patch };
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(merged)); }
  catch { /* quota */ }

  // Notify the in-page renderer to re-read state.
  window.dispatchEvent(new CustomEvent(REFRESH_EVENT, { detail: { patch } }));

  return { applied: Object.keys(patch).length, patch };
};

export default applyExtractedDataToForm;
