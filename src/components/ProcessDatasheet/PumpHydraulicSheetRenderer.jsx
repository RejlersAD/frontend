/**
 * PumpHydraulicSheetRenderer
 * ==========================
 * Renders a single sub-sheet (tab) of the Pump Hydraulic Calculation
 * datasheet. All structure comes from the soft-coded config; this
 * component contains NO domain logic — it only handles UI and
 * persists user input to localStorage.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Save, RotateCcw, Sparkles } from 'lucide-react';
import { STORAGE_KEY } from '../../config/pumpHydraulicTemplate.config';
import { REFRESH_EVENT } from '../../config/pumpHydraulicAIMapper';

// ─── Soft-coded UI constants ──────────────────────────────────────────────
const COMPUTED_BG  = 'bg-amber-50';
const COMPUTED_TXT = 'text-amber-900';
const HEADER_BG    = 'bg-slate-100';
const SECTION_BG   = 'bg-gradient-to-r from-blue-600 to-blue-700';
const INPUT_CLS    = 'w-full px-2 py-1 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';

// ─── Storage helpers ──────────────────────────────────────────────────────
const loadState = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
  catch { return {}; }
};
const saveState = (state) => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* quota */ }
};

// ─── Field input renderer ─────────────────────────────────────────────────
const FieldInput = ({ field, value, onChange }) => {
  const isComputed = field.computed || field.readonly;
  const cls = `${INPUT_CLS} ${isComputed ? `${COMPUTED_BG} ${COMPUTED_TXT}` : ''}`;
  if (field.type === 'textarea') {
    return (
      <textarea
        className={cls}
        rows={field.rows || 3}
        readOnly={isComputed}
        value={value ?? field.default ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
      />
    );
  }
  if (field.type === 'select') {
    return (
      <select className={cls} value={value ?? ''} onChange={(e) => onChange(e.target.value)} disabled={isComputed}>
        <option value="">—</option>
        {(field.options || []).map((opt) => <option key={opt} value={opt}>{opt}</option>)}
      </select>
    );
  }
  if (field.type === 'image') {
    return (
      <input
        type="file"
        accept="image/*"
        className="text-sm"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          const reader = new FileReader();
          reader.onload = () => onChange(reader.result);
          reader.readAsDataURL(f);
        }}
      />
    );
  }
  return (
    <input
      type={field.type === 'number' ? 'number' : (field.type || 'text')}
      step="any"
      className={cls}
      readOnly={isComputed}
      value={value ?? field.default ?? ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={field.placeholder}
    />
  );
};

// ─── Section renderer ─────────────────────────────────────────────────────
const SectionRenderer = ({ section, state, setVal }) => {
  const hasMatrixCols = !!section.columns;
  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden mb-6 shadow-sm">
      {section.title && (
        <div className={`${SECTION_BG} text-white px-4 py-2 text-sm font-semibold tracking-wide`}>
          {section.title}
        </div>
      )}
      <div className="bg-white">
        {hasMatrixCols ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={HEADER_BG}>
                  {section.columns.map((c) => (
                    <th key={c} className="px-3 py-2 text-left font-semibold text-slate-700 border border-slate-200 whitespace-nowrap">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {section.rows.map((row, idx) => (
                  <RowRenderer key={`${section.title || ''}-${idx}`} row={row} state={state} setVal={setVal} columns={section.columns} />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            {section.rows.map((row, idx) => (
              <FlatRowRenderer key={`${section.title || ''}-${idx}`} row={row} state={state} setVal={setVal} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Flat (non-matrix) row ───────────────────────────────────────────────
const FlatRowRenderer = ({ row, state, setVal }) => {
  if (row.kind === 'header') {
    return <div className="md:col-span-2 mt-2 mb-1 text-xs font-bold uppercase tracking-wide text-blue-700">{row.text}</div>;
  }
  if (row.kind === 'note') {
    return <div className="md:col-span-2 text-xs italic text-slate-500">{row.text}</div>;
  }
  if (row.kind === 'field') {
    return (
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-slate-700 flex items-center gap-1">
          {row.label}
          {row.unit && <span className="text-slate-400">[{row.unit}]</span>}
          {row.computed && <Sparkles className="w-3 h-3 text-amber-500" title="Computed" />}
        </label>
        <FieldInput field={row} value={state[row.key]} onChange={(v) => setVal(row.key, v)} />
        {row.hint && <span className="text-[10px] text-slate-400">{row.hint}</span>}
      </div>
    );
  }
  return null;
};

// ─── Matrix row (label + N column inputs) ────────────────────────────────
const RowRenderer = ({ row, state, setVal, columns }) => {
  if (row.kind === 'header') {
    return (
      <tr className={HEADER_BG}>
        <td colSpan={columns.length} className="px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-blue-700 border border-slate-200">
          {row.text}
        </td>
      </tr>
    );
  }
  if (row.kind === 'note') {
    return (
      <tr>
        <td colSpan={columns.length} className="px-3 py-1.5 text-xs italic text-slate-500 border border-slate-200">{row.text}</td>
      </tr>
    );
  }
  if (row.kind === 'matrixRow') {
    const total = columns.length;
    const hasUnit = total - 1 - row.cols >= 1; // first col is label, last N are inputs, optional unit
    return (
      <tr className="hover:bg-slate-50">
        <td className="px-3 py-1.5 border border-slate-200 text-slate-800 align-middle">
          <span className="flex items-center gap-1">
            {row.label}
            {row.computed && <Sparkles className="w-3 h-3 text-amber-500" />}
          </span>
        </td>
        {hasUnit && (
          <td className="px-3 py-1.5 border border-slate-200 text-slate-500 text-xs align-middle">{row.unit || ''}</td>
        )}
        {Array.from({ length: row.cols }, (_, i) => {
          const cellKey = `${row.key}.${i}`;
          return (
            <td key={cellKey} className="px-1.5 py-1 border border-slate-200">
              <FieldInput field={row} value={state[cellKey]} onChange={(v) => setVal(cellKey, v)} />
            </td>
          );
        })}
      </tr>
    );
  }
  if (row.kind === 'matrix') {
    // free-form matrix with `defaultRows` × `cols` cells
    const rowsCount = row.defaultRows || 5;
    return (
      <>
        {Array.from({ length: rowsCount }, (_, r) => (
          <tr key={`${row.key}-r${r}`} className="hover:bg-slate-50">
            {Array.from({ length: row.cols }, (_, c) => {
              const cellKey = `${row.key}.${r}.${c}`;
              const isFixedFirst = row.fixedFirstCol && c === 0;
              const isComputedCol = row.computedCols?.includes(c);
              const field = { type: 'text', readonly: isFixedFirst, computed: isComputedCol };
              const val = isFixedFirst ? r + 1 : state[cellKey];
              return (
                <td key={cellKey} className="px-1.5 py-1 border border-slate-200">
                  <FieldInput field={field} value={val} onChange={(v) => setVal(cellKey, v)} />
                </td>
              );
            })}
          </tr>
        ))}
      </>
    );
  }
  if (row.kind === 'field') {
    // single field embedded in a matrix-section: span all columns
    return (
      <tr>
        <td colSpan={columns.length} className="px-3 py-2 border border-slate-200">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-700 flex items-center gap-1">
              {row.label}
              {row.unit && <span className="text-slate-400">[{row.unit}]</span>}
              {row.computed && <Sparkles className="w-3 h-3 text-amber-500" />}
            </label>
            <FieldInput field={row} value={state[row.key]} onChange={(v) => setVal(row.key, v)} />
          </div>
        </td>
      </tr>
    );
  }
  return null;
};

// ─── Top-level tab renderer ───────────────────────────────────────────────
export default function PumpHydraulicSheetRenderer({ tab }) {
  const [state, setState] = useState(() => loadState());
  const [savedAt, setSavedAt] = useState(null);

  // Auto-save (debounced via timeout)
  useEffect(() => {
    const id = setTimeout(() => { saveState(state); setSavedAt(new Date()); }, 600);
    return () => clearTimeout(id);
  }, [state]);

  // Re-read state when an external source (AI extraction) writes to it.
  useEffect(() => {
    const onRefresh = () => setState(loadState());
    const onStorage = (e) => { if (e.key === STORAGE_KEY) setState(loadState()); };
    window.addEventListener(REFRESH_EVENT, onRefresh);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(REFRESH_EVENT, onRefresh);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const setVal = useCallback((key, value) => {
    setState((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleManualSave = () => { saveState(state); setSavedAt(new Date()); };
  const handleReset = () => {
    if (window.confirm('Reset all fields on this datasheet? This cannot be undone.')) {
      setState({}); saveState({}); setSavedAt(new Date());
    }
  };

  const savedLabel = useMemo(() => savedAt ? `Saved ${savedAt.toLocaleTimeString()}` : 'Not saved yet', [savedAt]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          {tab.description && <p className="text-sm text-slate-600">{tab.description}</p>}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">{savedLabel}</span>
          <button
            onClick={handleManualSave}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            <Save className="w-4 h-4" /> Save
          </button>
          <button
            onClick={handleReset}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-white border border-slate-300 text-slate-700 rounded hover:bg-slate-50"
          >
            <RotateCcw className="w-4 h-4" /> Reset
          </button>
        </div>
      </div>

      {tab.sections.map((section, idx) => (
        <SectionRenderer key={idx} section={section} state={state} setVal={setVal} />
      ))}

      <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
        <Sparkles className="w-3 h-3 text-amber-500" />
        Fields highlighted in amber are computed / auto-populated by the engine.
      </div>
    </div>
  );
}
