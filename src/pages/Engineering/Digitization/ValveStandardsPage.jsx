/**
 * Valve Standards Reference Page
 * ──────────────────────────────
 * Route: /engineering/digitization/valve-standards
 *
 * Browse + validate ASME B16.34 pressure-temperature ratings, wall thickness,
 * and material specification reference data. Read-only — data is loaded via
 * the backend `load_asme_b16_34` management command from the extracted
 * standard, not editable here.
 *
 * Soft-coded: every dropdown option, table column, and tab definition below
 * is driven by `BROWSE_CONFIG` + the backend `/config/` endpoint response —
 * no hardcoded class/group/unit lists.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BeakerIcon,
  TableCellsIcon,
  Cog6ToothIcon,
  BookOpenIcon,
  CalculatorIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import valveStandardsAPI from '../../../services/valveStandardsAPI';

// ─── Soft-coded Browse tab definitions ───────────────────────────────────────
// Each entry: label/icon + how to fetch rows + which filters it accepts +
// which columns to render. Add a new reference table by adding one entry.
const B16_34_BROWSE_CONFIG = [
  {
    id: 'materialGroups',
    label: 'Material Groups',
    icon: BeakerIcon,
    fetch: (api, filters) => api.listMaterialGroups(filters),
    filters: [{ key: 'family', label: 'Family' }],
    columns: [
      { key: 'group_no', label: 'Group No.' },
      { key: 'family_name', label: 'Family' },
    ],
  },
  {
    id: 'ratings',
    label: 'Pressure-Temperature Ratings',
    icon: TableCellsIcon,
    fetch: (api, filters) => (filters.group_no ? api.listRatings(filters) : Promise.resolve([])),
    filters: [
      { key: 'group_no', label: 'Group No.', required: true },
      { key: 'class_number', label: 'Class' },
      { key: 'class_section', label: 'Section' },
    ],
    emptyHint: 'Select a Group No. to load ratings (24k+ rows — filtered on purpose).',
    columns: [
      { key: 'group_no', label: 'Group' },
      { key: 'class_section', label: 'Section' },
      { key: 'class_number', label: 'Class' },
      { key: 'temp_label', label: 'Temp' },
      { key: 'temp_unit', label: 'Unit' },
      { key: 'pressure', label: 'Pressure' },
      { key: 'pressure_unit', label: 'P.Unit' },
    ],
  },
  {
    id: 'wallThickness',
    label: 'Wall Thickness (Table 3)',
    icon: Cog6ToothIcon,
    fetch: (api, filters) => api.listWallThickness(filters),
    filters: [
      { key: 'unit', label: 'Unit' },
      { key: 'class_number', label: 'Class' },
    ],
    columns: [
      { key: 'unit', label: 'Unit' },
      { key: 'inside_dia_d', label: 'Inside Dia. (d)' },
      { key: 'class_number', label: 'Class' },
      { key: 'min_wall_thickness_tm', label: 'Min tm' },
    ],
  },
  {
    id: 'npsToId',
    label: 'NPS ↔ Inside Diameter',
    icon: Cog6ToothIcon,
    fetch: (api, filters) => api.listNpsToId(filters),
    filters: [{ key: 'class_number', label: 'Class' }],
    columns: [
      { key: 'nps', label: 'NPS' },
      { key: 'dn', label: 'DN' },
      { key: 'class_number', label: 'Class' },
      { key: 'mm', label: 'mm' },
      { key: 'inch', label: 'in' },
    ],
  },
  {
    id: 'referenceStandards',
    label: 'Reference Standards',
    icon: BookOpenIcon,
    fetch: (api) => api.listReferenceStandards(),
    filters: [],
    columns: [{ key: 'citation', label: 'Citation' }],
  },
];

// ─── ASME B31.3 (Process Piping) Browse tabs ──────────────────────────────────────
const B31_3_BROWSE_CONFIG = [
  {
    id: 'materialAllowableStress',
    label: 'Allowable Stress (Table A-1/A-2)',
    icon: TableCellsIcon,
    fetch: (api, filters) => api.listMaterialAllowableStress(filters),
    filters: [
      { key: 'spec_no', label: 'Spec. No.' },
      { key: 'category', label: 'Category' },
    ],
    columns: [
      { key: 'category', label: 'Category' },
      { key: 'spec_no', label: 'Spec. No.' },
      { key: 'type_grade', label: 'Type/Grade' },
      { key: 'uns_no', label: 'UNS No.' },
      { key: 'product_form', label: 'Product Form' },
      { key: 'tensile_ksi', label: 'Tensile (ksi)' },
      { key: 'yield_ksi', label: 'Yield (ksi)' },
    ],
  },
  {
    id: 'highPressureAllowableStress',
    label: 'High-Pressure Stress (Appendix K)',
    icon: TableCellsIcon,
    fetch: (api, filters) => api.listHighPressureAllowableStress(filters),
    filters: [{ key: 'spec_no', label: 'Spec. No.' }],
    columns: [
      { key: 'spec_no', label: 'Spec. No.' },
      { key: 'type_grade', label: 'Type/Grade' },
      { key: 'uns_no', label: 'UNS No.' },
      { key: 'tensile_ksi', label: 'Tensile (ksi)' },
      { key: 'yield_ksi', label: 'Yield (ksi)' },
    ],
  },
  {
    id: 'castingQualityFactors',
    label: 'Casting Quality Factors (Ec)',
    icon: BeakerIcon,
    fetch: (api) => api.listCastingQualityFactors(),
    filters: [],
    columns: [
      { key: 'category', label: 'Category' },
      { key: 'spec_no', label: 'Spec. No.' },
      { key: 'description', label: 'Description' },
      { key: 'ec', label: 'Ec' },
      { key: 'notes', label: 'Notes' },
    ],
  },
  {
    id: 'weldJointQualityFactors',
    label: 'Weld Joint Quality Factors (Ej)',
    icon: BeakerIcon,
    fetch: (api) => api.listWeldJointQualityFactors(),
    filters: [],
    columns: [
      { key: 'category', label: 'Category' },
      { key: 'spec_no', label: 'Spec. No.' },
      { key: 'class_or_type', label: 'Class/Type' },
      { key: 'description', label: 'Description' },
      { key: 'ej', label: 'Ej' },
    ],
  },
  {
    id: 'thermalExpansion',
    label: 'Thermal Expansion (Table C-1)',
    icon: Cog6ToothIcon,
    fetch: (api) => api.listThermalExpansionCoefficients(),
    filters: [],
    columns: [
      { key: 'material', label: 'Material' },
      { key: 'coeff_70', label: 'Coeff. @70°F (10⁻⁶ in/in/°F)', render: (r) => r.coefficient_1e6_in_per_in_f?.['70'] },
      { key: 'coeff_500', label: 'Coeff. @500°F', render: (r) => r.coefficient_1e6_in_per_in_f?.['500'] },
      { key: 'coeff_1000', label: 'Coeff. @1000°F', render: (r) => r.coefficient_1e6_in_per_in_f?.['1000'] },
    ],
  },
  {
    id: 'modulusOfElasticity',
    label: 'Modulus of Elasticity (Table C-6)',
    icon: Cog6ToothIcon,
    fetch: (api) => api.listModulusOfElasticity(),
    filters: [],
    columns: [
      { key: 'material', label: 'Material' },
      { key: 'e_70', label: 'E @70°F (10⁶ psi)', render: (r) => r.modulus_1e6_psi?.['70'] },
      { key: 'e_500', label: 'E @500°F', render: (r) => r.modulus_1e6_psi?.['500'] },
      { key: 'e_1000', label: 'E @1000°F', render: (r) => r.modulus_1e6_psi?.['1000'] },
    ],
  },
];

// ─── ASME B16.5 (Pipe Flanges and Flanged Fittings) Browse tabs ───────────────
const B16_5_BROWSE_CONFIG = [
  {
    id: 'materialGroups',
    label: 'Material Groups',
    icon: BeakerIcon,
    fetch: (api, filters) => api.listB165MaterialGroups(filters),
    filters: [{ key: 'family', label: 'Family' }],
    columns: [
      { key: 'group_no', label: 'Group No.' },
      { key: 'family_name', label: 'Family' },
    ],
  },
  {
    id: 'ratings',
    label: 'Pressure-Temperature Ratings',
    icon: TableCellsIcon,
    fetch: (api, filters) => (filters.group_no ? api.listB165Ratings(filters) : Promise.resolve([])),
    filters: [
      { key: 'group_no', label: 'Group No.', required: true },
      { key: 'class_number', label: 'Class' },
      { key: 'temp_unit', label: 'Temp Unit' },
    ],
    emptyHint: 'Select a Group No. to load ratings (both SI and US rows — filtered on purpose).',
    columns: [
      { key: 'group_no', label: 'Group' },
      { key: 'class_number', label: 'Class' },
      { key: 'temp_label', label: 'Temp' },
      { key: 'temp_unit', label: 'Unit' },
      { key: 'pressure', label: 'Pressure' },
      { key: 'pressure_unit', label: 'P.Unit' },
    ],
  },
  {
    id: 'drillingTemplates',
    label: 'Drilling Templates',
    icon: Cog6ToothIcon,
    fetch: (api, filters) => api.listB165DrillingTemplates(filters),
    filters: [
      { key: 'class_number', label: 'Class' },
      { key: 'unit', label: 'Unit' },
    ],
    columns: [
      { key: 'class_number', label: 'Class' },
      { key: 'unit', label: 'Unit' },
      { key: 'nps', label: 'NPS' },
      { key: 'outside_diameter_o', label: 'O.D. (O)' },
      { key: 'bolt_circle_w', label: 'Bolt Circle (W)' },
      { key: 'bolt_hole_diameter', label: 'Bolt Hole Dia.' },
      { key: 'num_bolts', label: '# Bolts' },
      { key: 'bolt_diameter', label: 'Bolt Dia.' },
      { key: 'note', label: 'Note' },
    ],
  },
  {
    id: 'flangeDimensions',
    label: 'Flange Dimensions',
    icon: Cog6ToothIcon,
    fetch: (api, filters) => api.listB165FlangeDimensions(filters),
    filters: [
      { key: 'class_number', label: 'Class' },
      { key: 'unit', label: 'Unit' },
    ],
    columns: [
      { key: 'class_number', label: 'Class' },
      { key: 'unit', label: 'Unit' },
      { key: 'nps', label: 'NPS' },
      { key: 'outside_diameter_o', label: 'O.D. (O)' },
      { key: 'values', label: 'Other Dimensions (as printed)', render: (r) => (r.values || []).map((v) => v ?? '…').join(' / ') },
      { key: 'note', label: 'Note' },
    ],
  },
  {
    id: 'flangeBoltingRecommendations',
    label: 'Flange Bolting Recommendations (Table 1C)',
    icon: BookOpenIcon,
    fetch: (api) => api.listB165FlangeBoltingRecommendations(),
    filters: [],
    columns: [
      { key: 'product', label: 'Product' },
      { key: 'carbon_steel', label: 'Carbon Steel' },
      { key: 'alloy_steel', label: 'Alloy Steel' },
    ],
  },
];

// ─── Standard selector ──────────────────────────────────────────────────────────
const STANDARDS = [
  {
    id: 'b16_34', label: 'ASME B16.34', fullName: 'Valves — Flanged, Threaded, and Welding End',
    browseConfig: B16_34_BROWSE_CONFIG, hasValidate: true, getConfig: (api) => api.getConfig(),
  },
  {
    id: 'b31_3', label: 'ASME B31.3', fullName: 'Process Piping',
    browseConfig: B31_3_BROWSE_CONFIG, hasValidate: false, getConfig: (api) => api.getB313Config(),
  },
  {
    id: 'b16_5', label: 'ASME B16.5', fullName: 'Pipe Flanges and Flanged Fittings',
    browseConfig: B16_5_BROWSE_CONFIG, hasValidate: false, getConfig: (api) => api.getB165Config(),
  },
];

const TABS = { BROWSE: 'browse', VALIDATE: 'validate' };

// ─── Browse panel ─────────────────────────────────────────────────────────────
const BrowsePanel = ({ config: apiConfig, browseConfig }) => {
  const [activeTable, setActiveTable] = useState(browseConfig[0].id);
  const [filters, setFilters] = useState({});
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const tableDef = useMemo(() => browseConfig.find((t) => t.id === activeTable) || browseConfig[0], [browseConfig, activeTable]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await tableDef.fetch(valveStandardsAPI, filters);
      setRows(Array.isArray(data) ? data : data?.results || []);
    } catch (e) {
      setError(e?.response?.data?.error || e.message || 'Failed to load data');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [tableDef, filters]);

  useEffect(() => {
    setActiveTable(browseConfig[0].id);
  }, [browseConfig]);

  useEffect(() => {
    setFilters({});
    setRows([]);
  }, [activeTable]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTable, JSON.stringify(filters)]);

  const optionsFor = (key) => {
    if (!apiConfig) return [];
    if (key === 'group_no') return apiConfig.group_nos || [];
    if (key === 'class_number') return apiConfig.class_numbers || [];
    if (key === 'family') return (apiConfig.families || []).map((f) => f.value);
    if (key === 'class_section') return (apiConfig.class_sections || []).map((f) => f.value);
    if (key === 'unit') return (apiConfig.units || apiConfig.length_units || []).map((f) => f.value);
    if (key === 'temp_unit') return (apiConfig.temp_units || []).map((f) => f.value);
    if (key === 'category') return apiConfig.categories || [];
    if (key === 'spec_no') return apiConfig.spec_nos || [];
    return [];
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4">
        {browseConfig.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTable(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTable === t.id
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {tableDef.filters.length > 0 && (
        <div className="flex flex-wrap gap-3 mb-4 bg-white p-4 rounded-lg border border-slate-200">
          {tableDef.filters.map((f) => (
            <div key={f.key} className="flex flex-col">
              <label className="text-xs font-medium text-slate-500 mb-1">
                {f.label}{f.required ? ' *' : ''}
              </label>
              <select
                className="border border-slate-300 rounded-md px-2 py-1.5 text-sm min-w-[140px]"
                value={filters[f.key] || ''}
                onChange={(e) => setFilters((prev) => ({ ...prev, [f.key]: e.target.value || undefined }))}
              >
                <option value="">All</option>
                {optionsFor(f.key).map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-slate-500 py-8 justify-center">
          <ArrowPathIcon className="w-5 h-5 animate-spin" /> Loading...
        </div>
      )}

      {!loading && error && (
        <div className="flex items-center gap-2 text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-4">
          <ExclamationTriangleIcon className="w-5 h-5 flex-shrink-0" /> {error}
        </div>
      )}

      {!loading && !error && rows.length === 0 && (
        <div className="text-center text-slate-500 py-8 bg-white rounded-lg border border-slate-200">
          {tableDef.emptyHint || 'No rows found.'}
        </div>
      )}

      {!loading && !error && rows.length > 0 && (
        <div className="bg-white rounded-lg border border-slate-200 overflow-auto max-h-[520px]">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 sticky top-0">
              <tr>
                {tableDef.columns.map((c) => (
                  <th key={c.key} className="text-left px-4 py-2 font-semibold text-slate-600 whitespace-nowrap">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row, i) => (
                <tr key={row.id ?? i} className="hover:bg-slate-50">
                  {tableDef.columns.map((c) => (
                    <td key={c.key} className="px-4 py-2 text-slate-700 whitespace-nowrap">
                      {(c.render ? c.render(row) : row[c.key]) ?? <span className="text-slate-300">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-2 text-xs text-slate-400 border-t border-slate-100">
            {rows.length.toLocaleString()} row(s)
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Validate panel ───────────────────────────────────────────────────────────
const ValidatePanel = ({ config: apiConfig }) => {
  const [form, setForm] = useState({
    group_no: '', class_number: '', class_section: 'A',
    temp_value: '', temp_unit: 'C', target_pressure: '',
  });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const canSubmit = form.group_no && form.class_number && form.class_section && form.temp_value !== '';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const payload = { ...form };
      if (payload.target_pressure === '') delete payload.target_pressure;
      const data = await valveStandardsAPI.validate(payload);
      setResult(data);
    } catch (e2) {
      setError(e2?.response?.data?.error || e2.message || 'Validation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
        <h3 className="font-semibold text-slate-800 flex items-center gap-2">
          <CalculatorIcon className="w-5 h-5 text-blue-600" /> Rating Lookup
        </h3>
        <p className="text-xs text-slate-500">
          Two-point linear interpolation between tabulated temperatures (ASME B16.34 para 2.1(f)).
          Footnote exceptions (e.g. flanged-end temperature cutoffs) are not applied automatically —
          check the bracketing rows below.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Group No. *</label>
            <select className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm"
              value={form.group_no} onChange={(e) => setField('group_no', e.target.value)}>
              <option value="">Select...</option>
              {(apiConfig?.group_nos || []).map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Class *</label>
            <select className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm"
              value={form.class_number} onChange={(e) => setField('class_number', e.target.value)}>
              <option value="">Select...</option>
              {(apiConfig?.class_numbers || []).map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Class Section *</label>
            <select className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm"
              value={form.class_section} onChange={(e) => setField('class_section', e.target.value)}>
              {(apiConfig?.class_sections || []).map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Temp. Unit</label>
            <select className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm"
              value={form.temp_unit} onChange={(e) => setField('temp_unit', e.target.value)}>
              {(apiConfig?.temp_units || []).map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Temperature *</label>
            <input type="number" step="any" className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm"
              value={form.temp_value} onChange={(e) => setField('temp_value', e.target.value)} placeholder="e.g. 100" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Target Pressure (optional)</label>
            <input type="number" step="any" className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm"
              value={form.target_pressure} onChange={(e) => setField('target_pressure', e.target.value)} placeholder="pass/fail check" />
          </div>
        </div>

        <button type="submit" disabled={!canSubmit || loading}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium disabled:opacity-50 hover:bg-blue-700 transition-colors">
          {loading ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <CalculatorIcon className="w-4 h-4" />}
          Look Up Rating
        </button>
      </form>

      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <h3 className="font-semibold text-slate-800 mb-4">Result</h3>
        {error && (
          <div className="flex items-center gap-2 text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-4">
            <ExclamationTriangleIcon className="w-5 h-5 flex-shrink-0" /> {error}
          </div>
        )}
        {!error && !result && <p className="text-sm text-slate-400">Run a lookup to see the interpolated rating.</p>}
        {result && (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-blue-50 rounded-lg p-4">
              <div>
                <div className="text-xs text-slate-500">Interpolated Pressure</div>
                <div className="text-2xl font-bold text-blue-700">
                  {result.interpolated_pressure} {result.pressure_unit}
                </div>
              </div>
              {'pass' in result && (
                <span className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold ${
                  result.pass ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                }`}>
                  {result.pass ? <CheckCircleIcon className="w-4 h-4" /> : <XCircleIcon className="w-4 h-4" />}
                  {result.pass ? 'PASS' : 'FAIL'} vs {result.target_pressure} {result.pressure_unit}
                </span>
              )}
            </div>
            <div>
              <div className="text-xs font-medium text-slate-500 mb-2">Bracketing tabulated rows</div>
              <table className="w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left px-3 py-1.5">Temp</th>
                    <th className="text-left px-3 py-1.5">Pressure</th>
                  </tr>
                </thead>
                <tbody>
                  {result.bracketing_rows.map((r, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      <td className="px-3 py-1.5">{r.temp_label} °{r.temp_unit}</td>
                      <td className="px-3 py-1.5">{r.pressure} {r.pressure_unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const ValveStandardsPage = () => {
  const navigate = useNavigate();
  const [standardId, setStandardId] = useState(STANDARDS[0].id);
  const [tab, setTab] = useState(TABS.BROWSE);
  const [apiConfig, setApiConfig] = useState(null);

  const standard = useMemo(() => STANDARDS.find((s) => s.id === standardId), [standardId]);

  useEffect(() => {
    setApiConfig(null);
    standard.getConfig(valveStandardsAPI).then(setApiConfig).catch(() => setApiConfig(null));
    if (!standard.hasValidate) setTab(TABS.BROWSE);
  }, [standard]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 p-8">
      <div className="max-w-7xl mx-auto mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl shadow-lg">
            <BookOpenIcon className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
              Valve Standards Reference
            </h1>
            <p className="text-slate-600 mt-1">
              {standard.fullName} — browse reference data extracted from the standard
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm text-slate-600 mb-6">
          <span className="cursor-pointer hover:text-blue-600" onClick={() => navigate('/dashboard')}>Dashboard</span>
          <span>/</span>
          <span className="cursor-pointer hover:text-blue-600" onClick={() => navigate('/engineering/digitization/smart-plant-3d')}>
            Smart Plant 3D
          </span>
          <span>/</span>
          <span className="text-blue-600 font-medium">Valve Standards Reference</span>
        </div>

        <div className="flex gap-2 mb-4">
          {STANDARDS.map((s) => (
            <button key={s.id} onClick={() => setStandardId(s.id)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                standardId === s.id ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}>
              {s.label}
            </button>
          ))}
        </div>

        <div className="flex gap-2 mb-6">
          {[
            { id: TABS.BROWSE, label: 'Browse', icon: TableCellsIcon },
            ...(standard.hasValidate ? [{ id: TABS.VALIDATE, label: 'Validate', icon: CalculatorIcon }] : []),
          ].map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-colors ${
                tab === t.id ? 'bg-white shadow-md text-blue-600 border border-blue-200' : 'text-slate-500 hover:text-slate-700'
              }`}>
              <t.icon className="w-4 h-4" /> {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto">
        {tab === TABS.BROWSE
          ? <BrowsePanel config={apiConfig} browseConfig={standard.browseConfig} />
          : <ValidatePanel config={apiConfig} />}
      </div>
    </div>
  );
};

export default ValveStandardsPage;
