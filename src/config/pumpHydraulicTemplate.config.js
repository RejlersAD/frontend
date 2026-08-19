/**
 * Pump Hydraulic Calculation — Template Schema (Soft-coded)
 * =========================================================
 * Mirrors the 10 sub-sheets of the standard "Pump Hydraulic Calculation.xlsx"
 * template. Used by the tabbed UI at /engineering/process/datasheet/pfd to
 * render each sub-page as a fillable form. NO backend logic is altered —
 * this file only defines the visual structure + persisted field keys.
 *
 * Each tab definition:
 *   {
 *     id:           string  (stable key, used in localStorage path)
 *     label:        string  (visible tab name — matches sheet name)
 *     icon:         lucide icon component
 *     description?: string  (one-line caption shown under header)
 *     sections:     Array<Section>
 *   }
 *
 * Section:
 *   {
 *     title?:  string         (section header bar)
 *     columns?: string[]      (column headings for matrix rows)
 *     rows:    Array<Row>
 *   }
 *
 * Row:
 *   { kind: 'header',  text: string }
 *   { kind: 'note',    text: string }
 *   { kind: 'field',   key: string, label: string, unit?: string,
 *                      type?: 'text'|'number'|'textarea'|'date'|'select',
 *                      options?: string[], readonly?: boolean,
 *                      computed?: boolean,    // visually flagged
 *                      cols?: number }        // columns count for matrix
 */

import {
  FileText, BookOpen, PenTool, ClipboardList, Activity, BarChart3,
  Calculator, Wrench, Zap, Ruler, UploadCloud,
} from 'lucide-react';

// ─── Persistence ──────────────────────────────────────────────────────────
export const STORAGE_KEY = 'radai.pumpHydraulic.formState.v1';

// ─── Common header (project / document metadata) ─────────────────────────
const PROJECT_HEADER_FIELDS = [
  { kind: 'field', key: 'project_title',    label: 'Project Title',    type: 'text' },
  { kind: 'field', key: 'job_no',           label: 'Job No.',          type: 'text' },
  { kind: 'field', key: 'contract_no',      label: 'Contract No.',     type: 'text' },
  { kind: 'field', key: 'client_name',      label: 'Client Name',      type: 'text' },
  { kind: 'field', key: 'client_job_no',    label: 'Client Job No.',   type: 'text' },
  { kind: 'field', key: 'calculation_no',   label: 'Calculation No.',  type: 'text' },
  { kind: 'field', key: 'pump_tag_no',      label: 'Pumps Tag No.',    type: 'text' },
  { kind: 'field', key: 'pump_description', label: 'Pumps Description',type: 'text' },
];

// ─── Number-of-line columns (suction + discharge) for Pressure Drop Cal ──
const PD_LINE_COUNT = 10;
const PD_LINE_COLUMNS = Array.from({ length: PD_LINE_COUNT }, (_, i) => `Line ${i + 1}`);

// ─── Tabs ─────────────────────────────────────────────────────────────────
export const PUMP_HYDRAULIC_TABS = [
  // -------------------------------------------------------- Upload & Extract
  {
    id: 'upload',
    label: 'Upload & AI Extract',
    icon: UploadCloud,
    description: 'Upload P&ID / HMB / Pump Curves — AI auto-fills the datasheet',
    sections: [], // rendered specially: embeds DatasheetGeneratorTemplate
    isUploadTab: true,
  },

  // -------------------------------------------------------- 1. Cover
  {
    id: 'cover',
    label: 'Cover',
    icon: FileText,
    description: 'Document cover page — client / project / equipment identification',
    sections: [
      {
        title: 'Document Identification',
        rows: [
          { kind: 'field', key: 'cover.client_name',         label: 'Client Name',         type: 'text' },
          { kind: 'field', key: 'cover.project_name',        label: 'Project Name',        type: 'text' },
          { kind: 'field', key: 'cover.project_number',      label: 'Project Number',      type: 'text' },
          { kind: 'field', key: 'cover.equipment_desc',      label: 'Equipment Description', type: 'text' },
          { kind: 'field', key: 'cover.equipment_tag',       label: 'Equipment Tag No.',   type: 'text' },
          { kind: 'field', key: 'cover.document_no',         label: 'Document No.',        type: 'text', placeholder: 'RAD-PR-CLC-0001' },
          { kind: 'field', key: 'cover.title',               label: 'Title',               type: 'text', readonly: true, default: 'PUMP HYDRAULIC CALCULATION TEMPLATE' },
        ],
      },
      {
        title: 'Revision History',
        columns: ['Rev', 'Date', 'Status', 'Status Description', 'Prepared', 'Reviewed', 'Approved'],
        rows: [
          { kind: 'matrix', key: 'cover.revisions', cols: 7, defaultRows: 3 },
        ],
      },
    ],
  },

  // -------------------------------------------------------- 2. Basis
  {
    id: 'basis',
    label: 'Basis',
    icon: BookOpen,
    description: 'Calculation basis, assumptions and references',
    sections: [
      { title: 'Project Information', rows: PROJECT_HEADER_FIELDS },
      {
        title: 'Basis & Assumptions',
        rows: [
          { kind: 'field', key: 'basis.assumptions', label: 'Basis & Assumptions', type: 'textarea', rows: 6 },
          { kind: 'field', key: 'basis.references',  label: 'References',          type: 'textarea', rows: 4 },
        ],
      },
    ],
  },

  // -------------------------------------------------------- 3. Sketch
  {
    id: 'sketch',
    label: 'Sketch',
    icon: PenTool,
    description: 'Hydraulic sketch / system schematic',
    sections: [
      { title: 'Project Information', rows: PROJECT_HEADER_FIELDS },
      {
        title: 'Sketch',
        rows: [
          { kind: 'note', text: 'Paste / upload the hydraulic sketch image. Useful shapes can be inserted directly.' },
          { kind: 'field', key: 'sketch.image',   label: 'Sketch Image',  type: 'image' },
          { kind: 'field', key: 'sketch.caption', label: 'Caption / Notes', type: 'textarea', rows: 3 },
        ],
      },
    ],
  },

  // -------------------------------------------------------- 4. Result Summary
  {
    id: 'result_summary',
    label: 'Result Summary',
    icon: ClipboardList,
    description: 'High-level pump hydraulic results',
    sections: [
      { title: 'Project Information', rows: PROJECT_HEADER_FIELDS },
      {
        title: 'Result Summary',
        rows: [
          { kind: 'field', key: 'result.total_pumps_working', label: 'Total No. of Pumps — Working', type: 'number' },
          { kind: 'field', key: 'result.total_pumps_standby', label: 'Total No. of Pumps — Standby', type: 'number' },
          { kind: 'field', key: 'result.rated_capacity',      label: 'Rated Capacity of Pump',       type: 'number', unit: 'm³/hr' },
          { kind: 'field', key: 'result.suction_pressure',    label: 'Suction Pressure',             type: 'number', unit: 'barg' },
          { kind: 'field', key: 'result.npsha',               label: 'NPSHA',                        type: 'number', unit: 'm', computed: true },
          { kind: 'field', key: 'result.discharge_pressure',  label: 'Discharge Pressure',           type: 'number', unit: 'barg' },
          { kind: 'field', key: 'result.diff_pressure',       label: 'Differential Pressure',        type: 'number', unit: 'bar', computed: true },
          { kind: 'field', key: 'result.diff_head',           label: 'Differential Head',            type: 'number', unit: 'm',   computed: true },
          { kind: 'field', key: 'result.efficiency',          label: 'Pump Efficiency',              type: 'number', unit: '%' },
          { kind: 'field', key: 'result.hydraulic_power',     label: 'Hydraulic Power',              type: 'number', unit: 'kW',  computed: true },
          { kind: 'field', key: 'result.notes',               label: 'Notes',                        type: 'textarea', rows: 4 },
        ],
      },
    ],
  },

  // -------------------------------------------------------- 5. Pressure Drop Cal
  {
    id: 'pressure_drop',
    label: 'Pressure Drop Cal',
    icon: Activity,
    description: 'Per-line piping data, fittings and frictional pressure-drop calculation',
    sections: [
      { title: 'Project Information', rows: PROJECT_HEADER_FIELDS },
      {
        title: 'Line Identification',
        columns: ['Field', ...PD_LINE_COLUMNS],
        rows: [
          { kind: 'matrixRow', key: 'pd.stream_no',     label: 'Stream Number (PFD)',       type: 'text',   cols: PD_LINE_COUNT },
          { kind: 'matrixRow', key: 'pd.suc_or_disch', label: 'Suction / Discharge',       type: 'select', options: ['Suction', 'Discharge'], cols: PD_LINE_COUNT },
          { kind: 'matrixRow', key: 'pd.line_no',       label: 'Line Number (P&ID)',        type: 'text',   cols: PD_LINE_COUNT },
          { kind: 'matrixRow', key: 'pd.drawing_ref',   label: 'Drawing Ref.',              type: 'text',   cols: PD_LINE_COUNT },
          { kind: 'matrixRow', key: 'pd.from',          label: 'From',                      type: 'text',   cols: PD_LINE_COUNT },
          { kind: 'matrixRow', key: 'pd.to',            label: 'To',                        type: 'text',   cols: PD_LINE_COUNT },
        ],
      },
      {
        title: 'Piping Data',
        columns: ['Field', 'Unit', ...PD_LINE_COLUMNS],
        rows: [
          { kind: 'matrixRow', key: 'pd.diam_basis',    label: 'Nominal or Internal diameter (N/I)', type: 'select', options: ['N', 'I'], cols: PD_LINE_COUNT },
          { kind: 'matrixRow', key: 'pd.diameter',      label: 'Diameter',     unit: 'in',           type: 'number', cols: PD_LINE_COUNT },
          { kind: 'matrixRow', key: 'pd.schedule',      label: 'Schedule (X for Standard)',          type: 'text',   cols: PD_LINE_COUNT },
          { kind: 'matrixRow', key: 'pd.pipe_id',       label: 'Pipe I.D.',    unit: 'in',           type: 'number', cols: PD_LINE_COUNT, computed: true },
          { kind: 'matrixRow', key: 'pd.roughness',     label: 'Pipe roughness', unit: 'in',         type: 'number', cols: PD_LINE_COUNT, default: 0.0018 },
        ],
      },
      {
        title: 'Flow Data and Fluid Properties',
        columns: ['Field', 'Unit', ...PD_LINE_COLUMNS],
        rows: [
          { kind: 'matrixRow', key: 'pd.pressure',     label: 'Pressure',         unit: 'Bar g',       type: 'number', cols: PD_LINE_COUNT },
          { kind: 'matrixRow', key: 'pd.temperature',  label: 'Temperature',      unit: '°C',          type: 'number', cols: PD_LINE_COUNT },
          { kind: 'header',    text: 'Liquid Phase' },
          { kind: 'matrixRow', key: 'pd.mass_flow',    label: 'Mass Flow rate',   unit: 'Kg/Hr',       type: 'number', cols: PD_LINE_COUNT },
          { kind: 'matrixRow', key: 'pd.density',      label: 'Density',          unit: 'Kg/m³',       type: 'number', cols: PD_LINE_COUNT },
          { kind: 'matrixRow', key: 'pd.viscosity',    label: 'Viscosity',        unit: 'cP',          type: 'number', cols: PD_LINE_COUNT },
          { kind: 'matrixRow', key: 'pd.surface_tens', label: 'Surface Tension',  unit: 'Dynes/cm',    type: 'number', cols: PD_LINE_COUNT },
        ],
      },
      {
        title: 'Piping Fittings (counts per line)',
        columns: ['Fitting', 'L/D', ...PD_LINE_COLUMNS],
        rows: [
          { kind: 'matrixRow', key: 'pd.length',         label: 'Physical Length',                        unit: 'm',  type: 'number', cols: PD_LINE_COUNT },
          { kind: 'matrixRow', key: 'pd.delta_elev',     label: 'Delta Elevation',                        unit: 'm',  type: 'number', cols: PD_LINE_COUNT },
          { kind: 'matrixRow', key: 'pd.fit_45',         label: '# of 45° Standard Elbows',               unit: '16', type: 'number', cols: PD_LINE_COUNT },
          { kind: 'matrixRow', key: 'pd.fit_90_std',     label: '# of 90° Standard Elbows',               unit: '30', type: 'number', cols: PD_LINE_COUNT },
          { kind: 'matrixRow', key: 'pd.fit_90_lr',      label: '# of 90° Long Radius Elbows',            unit: '16', type: 'number', cols: PD_LINE_COUNT },
          { kind: 'matrixRow', key: 'pd.tee_thru',       label: '# of Tees: thru flow',                   unit: '20', type: 'number', cols: PD_LINE_COUNT },
          { kind: 'matrixRow', key: 'pd.tee_branch',     label: '# of Tees: branch flow',                 unit: '65', type: 'number', cols: PD_LINE_COUNT },
          { kind: 'matrixRow', key: 'pd.v_shutdown',     label: '# of Valves — Shut Down',                unit: '13', type: 'number', cols: PD_LINE_COUNT },
          { kind: 'matrixRow', key: 'pd.v_check',        label: '# of Valves — Check',                    unit: '135',type: 'number', cols: PD_LINE_COUNT },
          { kind: 'matrixRow', key: 'pd.v_gate_rb',      label: '# of Valves — Gate (RB)(Dia<40mm)',      unit: '65', type: 'number', cols: PD_LINE_COUNT },
          { kind: 'matrixRow', key: 'pd.v_gate',         label: '# of Valves — Gate',                     unit: '13', type: 'number', cols: PD_LINE_COUNT },
          { kind: 'matrixRow', key: 'pd.v_ball_fb',      label: '# of Valves — Ball (FB)',                unit: '3',  type: 'number', cols: PD_LINE_COUNT },
          { kind: 'matrixRow', key: 'pd.v_ball_rb_sm',   label: '# of Valves — Ball (RB)(Dia<40mm)',      unit: '65', type: 'number', cols: PD_LINE_COUNT },
          { kind: 'matrixRow', key: 'pd.v_ball_rb_lg',   label: '# of Valves — Ball (RB)(Dia>50mm)',      unit: '45', type: 'number', cols: PD_LINE_COUNT },
          { kind: 'matrixRow', key: 'pd.v_bf_28',        label: '# of Valves — Butterfly (2"–8")',        unit: '45', type: 'number', cols: PD_LINE_COUNT },
          { kind: 'matrixRow', key: 'pd.v_bf_1014',      label: '# of Valves — Butterfly (10"–14")',      unit: '35', type: 'number', cols: PD_LINE_COUNT },
          { kind: 'matrixRow', key: 'pd.v_bf_16',        label: '# of Valves — Butterfly (≥16")',         unit: '25', type: 'number', cols: PD_LINE_COUNT },
          { kind: 'matrixRow', key: 'pd.v_plug',         label: '# of Valves — Plug',                     unit: '45', type: 'number', cols: PD_LINE_COUNT },
          { kind: 'matrixRow', key: 'pd.sudden_enlarge', label: 'Sudden Enlarg. Nom. Diam.',              unit: 'in', type: 'number', cols: PD_LINE_COUNT },
          { kind: 'matrixRow', key: 'pd.sudden_contr',   label: 'Sudden Contr. Nom. Diam.',               unit: 'in', type: 'number', cols: PD_LINE_COUNT },
          { kind: 'matrixRow', key: 'pd.sharp_entry',    label: 'Pipe Sharp Edged Entrance',              unit: 'K=0.5', type: 'number', cols: PD_LINE_COUNT },
          { kind: 'matrixRow', key: 'pd.pipe_exit',      label: 'Pipe Exit',                              unit: 'K=1', type: 'number', cols: PD_LINE_COUNT },
          { kind: 'matrixRow', key: 'pd.other_ld',       label: "Sum of other Equiv. Lengths (L/D)",      unit: '—', type: 'number', cols: PD_LINE_COUNT },
          { kind: 'matrixRow', key: 'pd.other_k',        label: "Sum of other K's",                       unit: '—', type: 'number', cols: PD_LINE_COUNT },
          { kind: 'matrixRow', key: 'pd.other_dp',       label: 'Sum of other Pressure Drops (Filter)',   unit: 'bar', type: 'number', cols: PD_LINE_COUNT },
        ],
      },
      {
        title: 'Results (computed)',
        columns: ['Field', 'Unit', ...PD_LINE_COLUMNS],
        rows: [
          { kind: 'matrixRow', key: 'pd.r_total_eq_len', label: 'Total Equivalent Length',         unit: 'm',           type: 'number', cols: PD_LINE_COUNT, computed: true },
          { kind: 'matrixRow', key: 'pd.r_velocity',     label: 'Velocity',                        unit: 'm/sec',       type: 'number', cols: PD_LINE_COUNT, computed: true },
          { kind: 'matrixRow', key: 'pd.r_dp_per_100m',  label: 'Pressure drop / 100 m',           unit: 'bar',         type: 'number', cols: PD_LINE_COUNT, computed: true },
          { kind: 'matrixRow', key: 'pd.r_total_dp',     label: 'Total Frictional Pressure drop',  unit: 'bar',         type: 'number', cols: PD_LINE_COUNT, computed: true },
          { kind: 'matrixRow', key: 'pd.r_rv2',          label: 'Dynamic Pressure (ρv²)',          unit: 'kg/m·s²',     type: 'number', cols: PD_LINE_COUNT, computed: true },
          { kind: 'matrixRow', key: 'pd.r_rv3',          label: 'ρv³',                              unit: 'kg/m²·s³',    type: 'number', cols: PD_LINE_COUNT, computed: true },
          { kind: 'matrixRow', key: 'pd.r_reynolds',     label: "Reynold's No.",                   unit: '—',           type: 'number', cols: PD_LINE_COUNT, computed: true },
          { kind: 'matrixRow', key: 'pd.r_friction',     label: 'Darcy Friction Factor',           unit: '—',           type: 'number', cols: PD_LINE_COUNT, computed: true },
        ],
      },
    ],
  },

  // -------------------------------------------------------- 6. Line Loss Summary
  {
    id: 'line_loss',
    label: 'Line Loss Summary',
    icon: BarChart3,
    description: 'Aggregated suction / discharge / MCF line losses',
    sections: [
      { title: 'Project Information', rows: PROJECT_HEADER_FIELDS },
      {
        title: 'Line Loss Summary',
        columns: ['#', 'Suction Losses (bar)', 'Discharge Losses (bar)', 'MCF Line (bar)'],
        rows: [
          { kind: 'matrix', key: 'lineloss.rows', cols: 4, defaultRows: 10, fixedFirstCol: true, computedCols: [1, 2, 3] },
          { kind: 'field', key: 'lineloss.total_suction',   label: 'Total — Suction',   type: 'number', unit: 'bar', computed: true },
          { kind: 'field', key: 'lineloss.total_discharge', label: 'Total — Discharge', type: 'number', unit: 'bar', computed: true },
          { kind: 'field', key: 'lineloss.total_mcf',       label: 'Total — MCF',       type: 'number', unit: 'bar', computed: true },
        ],
      },
    ],
  },

  // -------------------------------------------------------- 7. Pump Cal
  {
    id: 'pump_cal',
    label: 'Pump Cal',
    icon: Calculator,
    description: 'Pump calculation — discharge / suction pressure / NPSH / power',
    sections: [
      { title: 'Project Information', rows: PROJECT_HEADER_FIELDS },
      {
        title: 'General Information',
        rows: [
          { kind: 'field', key: 'pump.tag_no',              label: 'Tag No.',                              type: 'text' },
          { kind: 'field', key: 'pump.service',             label: 'Service',                              type: 'text' },
          { kind: 'field', key: 'pump.temperature',         label: 'Temperature',                          type: 'number', unit: '°C' },
          { kind: 'field', key: 'pump.fluid_visc_at_temp',  label: 'Fluid Viscosity @ Temp',               type: 'number', unit: 'cP' },
          { kind: 'field', key: 'pump.cl_elev_grade',       label: 'Pump Central Line Elevation From Grade', type: 'number', unit: 'm' },
          { kind: 'field', key: 'pump.btl_elev',            label: 'Elevation of Source BTL from Pump C/L', type: 'number', unit: 'm' },
          { kind: 'field', key: 'pump.motor_classification',label: 'Motor Classification',                 type: 'text', unit: 'Hp' },
        ],
      },
      {
        title: 'Operating Conditions (per pump)',
        rows: [
          { kind: 'field', key: 'pump.curve_slope_pct',  label: 'Slope of Pump Curve',          type: 'number', unit: '%', default: 20, hint: 'Initial 20% — confirm with vendor' },
          { kind: 'field', key: 'pump.fluid_density',    label: 'Fluid Density',                type: 'number', unit: 'kg/m³' },
          { kind: 'field', key: 'pump.max_density',      label: 'Max Density for Shut-off',     type: 'number', unit: 'kg/m³' },
          { kind: 'header', text: 'Flow rates per Pump' },
          { kind: 'field', key: 'pump.flow_normal',  label: 'Normal',  type: 'number', unit: 'm³/hr' },
          { kind: 'field', key: 'pump.flow_max',     label: 'Maximum', type: 'number', unit: 'm³/hr' },
          { kind: 'field', key: 'pump.flow_min',     label: 'Minimum', type: 'number', unit: 'm³/hr', hint: 'Confirm with vendor' },
        ],
      },
      {
        title: 'Discharge Pressure Calculations',
        columns: ['Item', 'Unit', 'Max', 'Normal', 'Min'],
        rows: [
          { kind: 'field',     key: 'pump.dest_description', label: 'Destination Description', type: 'text' },
          { kind: 'matrixRow', key: 'pump.dest_pressure',    label: 'Destination Pressure', unit: 'barg', type: 'number', cols: 3 },
          { kind: 'matrixRow', key: 'pump.dest_elev',        label: 'Dest. EL from Pump C/L', unit: 'm',  type: 'number', cols: 3 },
          { kind: 'matrixRow', key: 'pump.line_fric_loss',   label: 'Line Friction Loss',   unit: 'bar',  type: 'number', cols: 3, computed: true },
          { kind: 'matrixRow', key: 'pump.flow_meter_dp',    label: 'Flow Meter ΔP',        unit: 'bar',  type: 'number', cols: 3 },
          { kind: 'matrixRow', key: 'pump.other_losses',     label: 'Other Losses',         unit: 'bar',  type: 'number', cols: 3 },
          { kind: 'matrixRow', key: 'pump.cv_dp',            label: 'Control Valve ΔP',     unit: 'bar',  type: 'number', cols: 3 },
          { kind: 'matrixRow', key: 'pump.misc_item',        label: 'Misc. Item',           unit: 'bar',  type: 'number', cols: 3 },
          { kind: 'matrixRow', key: 'pump.contingency',      label: 'Contingency',          unit: 'bar',  type: 'number', cols: 3 },
          { kind: 'matrixRow', key: 'pump.total_disch_pr',   label: 'Total Discharge Pr.',  unit: 'barg', type: 'number', cols: 3, computed: true },
        ],
      },
      {
        title: 'Suction Pressure Calculations',
        rows: [
          { kind: 'field', key: 'pump.source_op_pr',       label: 'Source Op. Pressure',     type: 'number', unit: 'barg' },
          { kind: 'field', key: 'pump.suction_elev',       label: 'Suction Elevation',       type: 'number', unit: 'm' },
          { kind: 'field', key: 'pump.inline_inst_loss',   label: 'Inline Instrument Losses',type: 'number', unit: 'bar' },
          { kind: 'field', key: 'pump.suction_fric_loss',  label: 'Line Friction Losses',    type: 'number', unit: 'bar', computed: true },
          { kind: 'field', key: 'pump.suction_cv',         label: 'Control Valve',           type: 'number', unit: 'bar' },
          { kind: 'field', key: 'pump.suction_misc',       label: 'Misc. Item',              type: 'number', unit: 'bar' },
          { kind: 'field', key: 'pump.total_suction_loss', label: 'Total Suction Losses',    type: 'number', unit: 'bar', computed: true },
          { kind: 'field', key: 'pump.total_suction_pr',   label: 'Total Suction Pressure',  type: 'number', unit: 'barg', computed: true },
        ],
      },
      {
        title: 'NPSH Available',
        rows: [
          { kind: 'field', key: 'pump.npsh_suction_pr', label: 'Suction Pressure (abs)', type: 'number', unit: 'bara', computed: true },
          { kind: 'field', key: 'pump.npsh_vapour_pr',  label: 'Vapour Pressure',         type: 'number', unit: 'bara' },
          { kind: 'field', key: 'pump.npsh_available',  label: 'NPSHA',                   type: 'number', unit: 'm', computed: true },
          { kind: 'field', key: 'pump.npsh_required',   label: 'NPSHR (vendor)',          type: 'number', unit: 'm' },
          { kind: 'field', key: 'pump.npsh_margin',     label: 'NPSH Margin',             type: 'number', unit: 'm', computed: true },
        ],
      },
      {
        title: 'Power Consumption per Pump',
        rows: [
          { kind: 'field', key: 'pump.hydraulic_power', label: 'Hydraulic Power',  type: 'number', unit: 'Hp', computed: true },
          { kind: 'field', key: 'pump.efficiency',      label: 'Pump Efficiency',  type: 'number', unit: '%' },
          { kind: 'field', key: 'pump.bhp',             label: 'Brake Horse Power',type: 'number', unit: 'Hp', computed: true },
          { kind: 'field', key: 'pump.motor_rating',    label: 'Motor Rating',     type: 'number', unit: 'Hp' },
          { kind: 'field', key: 'pump.motor_eff',       label: 'Motor Efficiency', type: 'number', unit: '%' },
          { kind: 'field', key: 'pump.power_consumption', label: 'Power Consumption', type: 'number', unit: 'Hp', computed: true },
          { kind: 'field', key: 'pump.motor_type',      label: 'Type of Motor',    type: 'text' },
        ],
      },
      {
        title: 'Pump Calculation Results',
        rows: [
          { kind: 'field', key: 'pump.r_disch_pr',  label: 'Discharge Pressure',    type: 'number', unit: 'barg', computed: true },
          { kind: 'field', key: 'pump.r_suct_pr',   label: 'Suction Pressure',      type: 'number', unit: 'barg', computed: true },
          { kind: 'field', key: 'pump.r_diff_pr',   label: 'Differential Pressure', type: 'number', unit: 'bar',  computed: true },
          { kind: 'field', key: 'pump.r_diff_head', label: 'Differential Head',     type: 'number', unit: 'm',    computed: true },
          { kind: 'field', key: 'pump.r_npsha',     label: 'NPSHA',                 type: 'number', unit: 'm',    computed: true },
        ],
      },
    ],
  },

  // -------------------------------------------------------- 8. Fittings Eq. Length
  {
    id: 'fittings',
    label: 'Fittings Eq. Length',
    icon: Wrench,
    description: 'Reference table — equivalent L/D values for piping fittings',
    sections: [
      {
        title: 'Equivalent Length Reference (L/D)',
        columns: ['Fitting / Component', 'L/D', 'Notes'],
        rows: [
          { kind: 'matrix', key: 'fittings.table', cols: 3, defaultRows: 25 },
        ],
      },
    ],
  },

  // -------------------------------------------------------- 9. Motor rating
  {
    id: 'motor_rating',
    label: 'Motor Rating',
    icon: Zap,
    description: 'Standard motor rating selection table',
    sections: [
      {
        title: 'Motor Rating Selection',
        columns: ['Calculated BHP (Hp)', 'Selected Motor Rating (Hp)', 'Service Factor', 'Notes'],
        rows: [
          { kind: 'matrix', key: 'motor.table', cols: 4, defaultRows: 15 },
        ],
      },
    ],
  },

  // -------------------------------------------------------- 10. Liq-Line size
  {
    id: 'liq_line_size',
    label: 'Liq-Line Size',
    icon: Ruler,
    description: 'Liquid line sizing — recommended velocity ranges',
    sections: [
      {
        title: 'Liquid Line Sizing Reference',
        columns: ['Service', 'Pipe Size (in)', 'Velocity (m/s) — min', 'Velocity (m/s) — max', 'Notes'],
        rows: [
          { kind: 'matrix', key: 'liqline.table', cols: 5, defaultRows: 20 },
        ],
      },
    ],
  },
];

export default PUMP_HYDRAULIC_TABS;
