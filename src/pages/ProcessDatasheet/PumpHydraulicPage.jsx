/**
 * Pump Hydraulic Calculation Page
 * Form-based datasheet generation with calculations
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  FileText,
  Download,
  Sparkles,
  Upload,
  Loader2
} from 'lucide-react';
import { SparklesIcon } from '@heroicons/react/24/outline';
import apiClient from '../../services/api.service';
import * as XLSX from 'xlsx';

// ─── Soft-coded extraction config ────────────────────────────────────────
// Endpoint, accepted file types and provenance colours all live here so the
// UI behaviour can be tweaked without touching the form / calculation logic.
const PUMP_EXTRACTION_CONFIG = {
  enabled: true,
  endpoint: '/process-datasheet/datasheets/extract-pump-hydraulic/',
  fileFieldName: 'pump_file',                  // multipart field name
  acceptedTypes: '.pdf,application/pdf',
  maxFileSizeMB: 50,
  // Maps backend provenance -> badge styling
  provenanceBadge: {
    text:   { label: 'PDF text',    className: 'bg-emerald-100 text-emerald-700' },
    vision: { label: 'AI Vision',   className: 'bg-indigo-100 text-indigo-700' },
  },
  // Field labels shown in the "extracted fields" summary list
  resultListPreview: 8,
};

const PumpHydraulicPage = () => {
  const navigate = useNavigate();

  const [pumpFormData, setPumpFormData] = useState({
    // PROJECT_INFO Section
    agreement_no: '',
    project_no: '',
    document_no: '',
    revision: 'A',
    document_class: 'Confidential',
    tag_no: '',
    service: '',
    motor_classification: '',
    temperature: '',
    fluid_viscosity_at_temp: '',
    hp: '',
    pump_centerline_elevation: '',
    elevation_source_btl: '',

    // GENERAL_INFO Section (Discharge Pressure Calculations)
    destination_description: 'Cooling Water Tank (06.5- T - 2307)',
    flow: 'Normal',
    destination_pressure: '',
    destination_elevation: '',
    line_friction_loss: '',
    flow_meter_del_p: '',
    other_losses: '',
    control_valve: '',
    misc_item: '',
    contingency: '',
    total_discharge_pressure: '',

    // CONTROL_VALVE_SIZING Section
    density: '',
    cv_max: '',
    cv_min: '',
    cv_ratio: '',
    total_frictional_losses: '',
    dynamic_losses_30_percent: '',
    control_valve_delta_p: '',
    cv_pressure_drop: '',
    cv_rangeability: '',
    cv_ratio_within_range: '',
    cv_pressure_drop_check: '',

    // SUCTION_PRESSURE Section
    source_op_pressure: '',
    suction_elm: '',
    inline_inst_losses: '',
    line_fric_losses: '',
    control_valve_suction: '',
    misc_items_suction: '',
    total_suction_losses: '',
    total_suction_pressure: '',

    // POWER_CONSUMPTION Section
    power_consumption_per_pump: '',
    hydraulic_power: '',
    pump_efficiency: '',
    break_horse_power: '',
    motor_rating: '',
    motor_efficiency: '',
    power_consumption: '',
    type_of_motor: '',

    // NPSH_AVAILABILITY Section
    npsh_availability: '',
    suction_pressure_npsh: '',
    vapor_pressure: '',
    npsha: '',
    safety_margin_npsha: '',
    npsha_with_safety_margin: '',

    // PUMP_CALCULATION_RESULTS Section (5 calculated fields)
    discharge_pressure: '',
    suction_pressure_result: '',
    differential_pressure: '',
    differential_head: '',
    npsha_result: '',

    // MAX_SUCTION_PRESSURE Section (4 fields)
    suction_vessel_max_op_pressure: '',
    suction_el_m: '',
    tl_to_hhll_m: '',
    max_suction_pressure: '',

    // MINIMUM_FLOW Section (9 fields)
    pump_minimum_flow: '',
    fluid_density_mcf: '',
    pump_discharge_pressure_min_flow: '',
    destination_pressure: '',
    el_destination_pump_cl: '',
    mcf_line_friction_losses: '',
    flow_meter_losses: '',
    misc_pressure_drop_mcf: '',
    mcf_cv_pressure_drop: '',

    // MAX_DISCHARGE_PRESSURE Section (6 fields)
    api_610_tolerance_used: '',
    api_tolerance_factor: '',
    shut_off_pressure_factor: '',
    shut_off_differential_pressure: '',
    maximum_discharge_pressure_option_1: '',
    maximum_discharge_pressure_option_2: ''
  });

  const [showPreview, setShowPreview] = useState(false);
  const [error, setError] = useState('');

  // ─── Soft-coded extraction state (additive to the form) ───────────────
  const [extracting, setExtracting] = useState(false);
  const [extractInfo, setExtractInfo] = useState(null);   // { engine, page_count, source_filename, fields, provenance, warnings }
  const [extractError, setExtractError] = useState('');

  const handlePumpExtract = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';                              // allow re-selecting the same file
    if (!file) return;

    if (file.size > PUMP_EXTRACTION_CONFIG.maxFileSizeMB * 1024 * 1024) {
      setExtractError(`File too large (max ${PUMP_EXTRACTION_CONFIG.maxFileSizeMB} MB).`);
      return;
    }

    setExtracting(true);
    setExtractError('');
    setExtractInfo(null);

    try {
      const fd = new FormData();
      fd.append(PUMP_EXTRACTION_CONFIG.fileFieldName, file);
      const res = await apiClient.post(
        PUMP_EXTRACTION_CONFIG.endpoint,
        fd,
        { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 180000 },
      );

      const data = res.data || {};
      if (data.status !== 'ok') {
        setExtractError(data.message || 'Extraction failed.');
        return;
      }

      // Merge extracted fields into the form, but never overwrite a value the
      // user has already typed.  This keeps "manual entry" the source of truth.
      const fields = data.fields || {};
      setPumpFormData(prev => {
        const merged = { ...prev };
        Object.entries(fields).forEach(([k, v]) => {
          if (k in merged && (merged[k] === '' || merged[k] === null || merged[k] === undefined)) {
            merged[k] = String(v);
          }
        });
        return merged;
      });

      setExtractInfo({
        engine:          data.engine,
        page_count:      data.page_count,
        source_filename: data.source_filename || file.name,
        fields,
        provenance:      data.provenance || {},
        warnings:        data.warnings || [],
      });
    } catch (e) {
      setExtractError(
        e?.response?.data?.message
        || e?.response?.data?.error
        || e.message
        || 'Extraction failed',
      );
    } finally {
      setExtracting(false);
    }
  };

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setPumpFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Trigger calculations on specific field changes
    if (['destination_pressure', 'destination_elevation', 'line_friction_loss', 'flow_meter_del_p', 
         'other_losses', 'control_valve', 'misc_item', 'contingency'].includes(name)) {
      calculateTotalDischargePressure({ ...pumpFormData, [name]: value });
    }
    
    if (['density', 'cv_max', 'cv_min'].includes(name)) {
      calculateControlValveSizing({ ...pumpFormData, [name]: value });
    }
    
    if (['source_op_pressure', 'suction_elm', 'inline_inst_losses', 'line_fric_losses',
         'control_valve_suction', 'misc_items_suction'].includes(name)) {
      calculateTotalSuctionPressure({ ...pumpFormData, [name]: value });
    }
    
    if (['hydraulic_power', 'pump_efficiency'].includes(name)) {
      calculatePowerConsumption({ ...pumpFormData, [name]: value });
    }
    
    if (['suction_pressure_npsh', 'vapor_pressure', 'npsha'].includes(name)) {
      calculateNPSHA({ ...pumpFormData, [name]: value });
    }
  };

  // Calculation functions
  const calculateTotalDischargePressure = (data) => {
    const sum = (
      parseFloat(data.destination_pressure || 0) +
      parseFloat(data.destination_elevation || 0) +
      parseFloat(data.line_friction_loss || 0) +
      parseFloat(data.flow_meter_del_p || 0) +
      parseFloat(data.other_losses || 0) +
      parseFloat(data.control_valve || 0) +
      parseFloat(data.misc_item || 0) +
      parseFloat(data.contingency || 0)
    );
    setPumpFormData(prev => ({ ...prev, total_discharge_pressure: sum.toFixed(2) }));
  };

  const calculateControlValveSizing = (data) => {
    const cvMax = parseFloat(data.cv_max || 0);
    const cvMin = parseFloat(data.cv_min || 0);
    const ratio = cvMax && cvMin ? (cvMax / cvMin).toFixed(2) : '';
    setPumpFormData(prev => ({ ...prev, cv_ratio: ratio }));
  };

  const calculateTotalSuctionPressure = (data) => {
    const losses = (
      parseFloat(data.inline_inst_losses || 0) +
      parseFloat(data.line_fric_losses || 0) +
      parseFloat(data.control_valve_suction || 0) +
      parseFloat(data.misc_items_suction || 0)
    );
    const total = parseFloat(data.source_op_pressure || 0) + parseFloat(data.suction_elm || 0) - losses;
    setPumpFormData(prev => ({ 
      ...prev, 
      total_suction_losses: losses.toFixed(2),
      total_suction_pressure: total.toFixed(2) 
    }));
  };

  const calculatePowerConsumption = (data) => {
    const hp = parseFloat(data.hydraulic_power || 0);
    const eff = parseFloat(data.pump_efficiency || 100);
    const bhp = eff ? (hp / (eff / 100)).toFixed(2) : '';
    setPumpFormData(prev => ({ ...prev, break_horse_power: bhp }));
  };

  const calculateNPSHA = (data) => {
    const npsha = (
      parseFloat(data.suction_pressure_npsh || 0) -
      parseFloat(data.vapor_pressure || 0)
    );
    const withMargin = npsha + parseFloat(data.safety_margin_npsha || 0);
    setPumpFormData(prev => ({ 
      ...prev, 
      npsha: npsha.toFixed(2),
      npsha_with_safety_margin: withMargin.toFixed(2)
    }));
  };

  const calculateFinalResults = (data) => {
    return {
      discharge_pressure: data.total_discharge_pressure || '',
      suction_pressure_result: data.total_suction_pressure || '',
      differential_pressure: (parseFloat(data.total_discharge_pressure || 0) - parseFloat(data.total_suction_pressure || 0)).toFixed(2),
      differential_head: ((parseFloat(data.total_discharge_pressure || 0) - parseFloat(data.total_suction_pressure || 0)) / (parseFloat(data.density || 1) * 9.81 / 1000)).toFixed(2),
      npsha_result: data.npsha_with_safety_margin || ''
    };
  };

  const handleGeneratePreview = () => {
    setShowPreview(true);
    const finalCalcs = calculateFinalResults(pumpFormData);
    setPumpFormData(prev => ({ ...prev, ...finalCalcs }));
  };

  const downloadTableAsExcel = () => {
    const data = pumpFormData;
    const excelData = [];
    let currentRow = 0;
    const sectionRows = [];
    const totalRows = [];

    // Helper to add section header
    const addSectionHeader = (title) => {
      excelData.push([title, '']);
      sectionRows.push(currentRow);
      currentRow++;
    };

    // Helper to add field
    const addField = (label, value, isTotal = false) => {
      excelData.push([label, value || '']);
      if (isTotal) totalRows.push(currentRow);
      currentRow++;
    };

    // Main Header
    excelData.push(['PUMP HYDRAULIC CALCULATION DATASHEET', '']);
    sectionRows.push(0);
    currentRow++;
    excelData.push(['', '']);
    currentRow++;

    // Section 1: Project Information
    addSectionHeader('1. PROJECT INFORMATION');
    addField('Agreement No', data.agreement_no);
    addField('Project No', data.project_no);
    addField('Document No', data.document_no);
    addField('Revision', data.revision);
    addField('Document Class', data.document_class);
    addField('Tag No', data.tag_no);
    addField('Service', data.service);
    excelData.push(['', '']);
    currentRow++;

    // Section 2: General Information
    addSectionHeader('2. DISCHARGE PRESSURE CALCULATIONS');
    addField('Destination Description', data.destination_description);
    addField('Flow Type', data.flow);
    addField('Destination Pressure (bar)', data.destination_pressure);
    addField('Destination Elevation (bar)', data.destination_elevation);
    addField('Line Friction Loss (bar)', data.line_friction_loss);
    addField('Flow Meter ΔP (bar)', data.flow_meter_del_p);
    addField('Other Losses (bar)', data.other_losses);
    addField('Control Valve (bar)', data.control_valve);
    addField('Misc Item (bar)', data.misc_item);
    addField('Contingency (bar)', data.contingency);
    addField('TOTAL DISCHARGE PRESSURE (bar)', data.total_discharge_pressure, true);
    excelData.push(['', '']);
    currentRow++;

    // Section 3: Control Valve Sizing
    addSectionHeader('3. CONTROL VALVE SIZING');
    addField('Density (kg/m³)', data.density);
    addField('Cv Max', data.cv_max);
    addField('Cv Min', data.cv_min);
    addField('Cv Ratio', data.cv_ratio, true);
    excelData.push(['', '']);
    currentRow++;

    // Section 4: Suction Pressure
    addSectionHeader('4. SUCTION PRESSURE CALCULATIONS');
    addField('Source Operating Pressure (bar)', data.source_op_pressure);
    addField('Suction Elevation (bar)', data.suction_elm);
    addField('Inline Instrument Losses (bar)', data.inline_inst_losses);
    addField('Line Friction Losses (bar)', data.line_fric_losses);
    addField('Control Valve Suction (bar)', data.control_valve_suction);
    addField('Misc Items Suction (bar)', data.misc_items_suction);
    addField('TOTAL SUCTION LOSSES (bar)', data.total_suction_losses, true);
    addField('TOTAL SUCTION PRESSURE (bar)', data.total_suction_pressure, true);
    excelData.push(['', '']);
    currentRow++;

    // Section 5: Power Consumption
    addSectionHeader('5. POWER CONSUMPTION');
    addField('Hydraulic Power (kW)', data.hydraulic_power);
    addField('Pump Efficiency (%)', data.pump_efficiency);
    addField('BREAK HORSE POWER (kW)', data.break_horse_power, true);
    addField('Motor Rating (kW)', data.motor_rating);
    addField('Motor Efficiency (%)', data.motor_efficiency);
    addField('POWER CONSUMPTION (kW)', data.power_consumption, true);
    addField('Type of Motor', data.type_of_motor);
    excelData.push(['', '']);
    currentRow++;

    // Section 6: NPSH Availability
    addSectionHeader('6. NPSH AVAILABILITY');
    addField('Suction Pressure (bar)', data.suction_pressure_npsh);
    addField('Vapor Pressure (bar)', data.vapor_pressure);
    addField('NPSHA (m)', data.npsha, true);
    addField('Safety Margin (m)', data.safety_margin_npsha);
    addField('NPSHA WITH SAFETY MARGIN (m)', data.npsha_with_safety_margin, true);
    excelData.push(['', '']);
    currentRow++;

    // Section 7: Pump Calculation Results
    addSectionHeader('7. PUMP CALCULATION RESULTS');
    addField('Discharge Pressure (bar)', data.discharge_pressure, true);
    addField('Suction Pressure (bar)', data.suction_pressure_result, true);
    addField('Differential Pressure (bar)', data.differential_pressure, true);
    addField('Differential Head (m)', data.differential_head, true);
    addField('NPSHA (m)', data.npsha_result, true);
    excelData.push(['', '']);
    currentRow++;

    // Section 8: Max Suction Pressure
    addSectionHeader('8. MAXIMUM SUCTION PRESSURE');
    addField('Suction Vessel Max Op Pressure (bar)', data.suction_vessel_max_op_pressure);
    addField('Suction Elevation (m)', data.suction_el_m);
    addField('TL to HHLL (m)', data.tl_to_hhll_m);
    addField('MAX SUCTION PRESSURE (bar)', data.max_suction_pressure, true);
    excelData.push(['', '']);
    currentRow++;

    // Section 9: Minimum Flow
    addSectionHeader('9. MINIMUM FLOW CALCULATIONS');
    addField('Pump Minimum Flow (m³/h)', data.pump_minimum_flow);
    addField('Fluid Density MCF (kg/m³)', data.fluid_density_mcf);
    addField('Pump Discharge Pressure Min Flow (bar)', data.pump_discharge_pressure_min_flow);
    addField('Destination Pressure (bar)', data.destination_pressure);
    addField('Elevation Destination to Pump CL (bar)', data.el_destination_pump_cl);
    addField('MCF Line Friction Losses (bar)', data.mcf_line_friction_losses);
    addField('Flow Meter Losses (bar)', data.flow_meter_losses);
    addField('Misc Pressure Drop MCF (bar)', data.misc_pressure_drop_mcf);
    addField('MCF CV Pressure Drop (bar)', data.mcf_cv_pressure_drop, true);
    excelData.push(['', '']);
    currentRow++;

    // Section 10: Max Discharge Pressure
    addSectionHeader('10. MAXIMUM DISCHARGE PRESSURE');
    addField('API 610 Tolerance Used', data.api_610_tolerance_used);
    addField('API Tolerance Factor', data.api_tolerance_factor);
    addField('Shut-off Pressure Factor', data.shut_off_pressure_factor);
    addField('Shut-off Differential Pressure (bar)', data.shut_off_differential_pressure);
    addField('MAX DISCHARGE PRESSURE Option 1 (bar)', data.maximum_discharge_pressure_option_1, true);
    addField('MAX DISCHARGE PRESSURE Option 2 (bar)', data.maximum_discharge_pressure_option_2, true);

    // Create workbook
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(excelData);

    // Apply styling
    ws['!cols'] = [{ width: 50 }, { width: 20 }];

    // Style section headers (blue background)
    sectionRows.forEach(row => {
      const cellRef = XLSX.utils.encode_cell({ r: row, c: 0 });
      if (!ws[cellRef]) ws[cellRef] = { t: 's', v: '' };
      ws[cellRef].s = {
        fill: { fgColor: { rgb: "4472C4" } },
        font: { bold: true, color: { rgb: "FFFFFF" }, sz: 12 },
        alignment: { horizontal: "center", vertical: "center" }
      };
    });

    // Style total rows (yellow background)
    totalRows.forEach(row => {
      const cellRef = XLSX.utils.encode_cell({ r: row, c: 0 });
      const cellRefValue = XLSX.utils.encode_cell({ r: row, c: 1 });
      if (!ws[cellRef]) ws[cellRef] = { t: 's', v: '' };
      if (!ws[cellRefValue]) ws[cellRefValue] = { t: 's', v: '' };
      
      ws[cellRef].s = {
        fill: { fgColor: { rgb: "FFF2CC" } },
        font: { bold: true, sz: 11 }
      };
      ws[cellRefValue].s = {
        fill: { fgColor: { rgb: "FFF2CC" } },
        font: { bold: true, sz: 11 }
      };
    });

    // Add borders to all cells
    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let R = range.s.r; R <= range.e.r; ++R) {
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
        if (!ws[cellRef]) ws[cellRef] = { t: 's', v: '' };
        if (!ws[cellRef].s) ws[cellRef].s = {};
        ws[cellRef].s.border = {
          top: { style: 'thin', color: { rgb: 'CCCCCC' } },
          bottom: { style: 'thin', color: { rgb: 'CCCCCC' } },
          left: { style: 'thin', color: { rgb: 'CCCCCC' } },
          right: { style: 'thin', color: { rgb: 'CCCCCC' } }
        };
      }
    }

    XLSX.utils.book_append_sheet(wb, ws, 'Pump Hydraulic Datasheet');
    
    const filename = `Pump_Hydraulic_${data.tag_no || 'Datasheet'}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, filename);
  };

  const renderFormField = (label, name, type = 'text', placeholder = '', required = false) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        type={type}
        name={name}
        value={pumpFormData[name]}
        onChange={handleInputChange}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/engineering/process/datasheet/smart')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="h-5 w-5 text-gray-600" />
              </button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                  💧 Pump Hydraulic Calculation
                </h1>
                <p className="text-gray-600 mt-1">
                  Form-based datasheet with automatic calculations
                </p>
              </div>
            </div>
          </div>
        </div>

        {!showPreview ? (
          <>
            {/* Pump Form - All 10 Sections */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">

              {/* ───── Smart PDF prefill (additive, soft-coded) ───── */}
              {PUMP_EXTRACTION_CONFIG.enabled && (
                <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border-2 border-dashed border-indigo-300 rounded-lg p-4">
                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-white rounded-lg shadow-sm">
                      <Upload className="h-6 w-6 text-indigo-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div>
                          <h3 className="font-semibold text-indigo-900 flex items-center gap-2">
                            <SparklesIcon className="h-4 w-4" />
                            Auto-fill from PFD / pump data PDF
                          </h3>
                          <p className="text-xs text-indigo-700/80 mt-0.5">
                            Upload the source drawing — extracted values populate empty fields only.
                            Already-typed values are preserved.
                          </p>
                        </div>
                        <label
                          className={`px-4 py-2 rounded-lg text-sm font-medium cursor-pointer flex items-center gap-2 transition-all ${
                            extracting
                              ? 'bg-indigo-300 text-white cursor-wait'
                              : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm'
                          }`}
                        >
                          {extracting ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Extracting…
                            </>
                          ) : (
                            <>
                              <Upload className="h-4 w-4" />
                              Choose PDF
                            </>
                          )}
                          <input
                            type="file"
                            accept={PUMP_EXTRACTION_CONFIG.acceptedTypes}
                            onChange={handlePumpExtract}
                            disabled={extracting}
                            className="hidden"
                          />
                        </label>
                      </div>

                      {extractError && (
                        <div className="mt-3 px-3 py-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                          {extractError}
                        </div>
                      )}

                      {extractInfo && (
                        <div className="mt-3 bg-white border border-indigo-200 rounded-lg p-3 text-xs">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <span className="text-slate-600">
                              <span className="font-semibold text-slate-800">{extractInfo.source_filename}</span>
                              {' · '}{extractInfo.page_count} page(s)
                              {' · engine: '}<span className="font-mono">{extractInfo.engine}</span>
                              {' · '}<span className="font-semibold text-indigo-700">{Object.keys(extractInfo.fields).length}</span> field(s) found
                            </span>
                            <button
                              onClick={() => setExtractInfo(null)}
                              className="text-slate-400 hover:text-slate-600"
                              type="button"
                            >
                              clear
                            </button>
                          </div>
                          {Object.keys(extractInfo.fields).length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {Object.entries(extractInfo.fields)
                                .slice(0, PUMP_EXTRACTION_CONFIG.resultListPreview)
                                .map(([k, v]) => {
                                  const prov = extractInfo.provenance[k] || 'text';
                                  const badge = PUMP_EXTRACTION_CONFIG.provenanceBadge[prov]
                                              || PUMP_EXTRACTION_CONFIG.provenanceBadge.text;
                                  return (
                                    <span
                                      key={k}
                                      className={`px-2 py-0.5 rounded-full ${badge.className}`}
                                      title={`source: ${badge.label}`}
                                    >
                                      <span className="font-mono text-[10px] uppercase opacity-70 mr-1">{k}</span>
                                      <span className="font-semibold">{String(v)}</span>
                                    </span>
                                  );
                                })}
                              {Object.keys(extractInfo.fields).length > PUMP_EXTRACTION_CONFIG.resultListPreview && (
                                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                                  +{Object.keys(extractInfo.fields).length - PUMP_EXTRACTION_CONFIG.resultListPreview} more
                                </span>
                              )}
                            </div>
                          )}
                          {extractInfo.warnings.length > 0 && (
                            <details className="mt-2 text-[11px] text-amber-700">
                              <summary className="cursor-pointer">
                                {extractInfo.warnings.length} warning(s)
                              </summary>
                              <ul className="list-disc pl-4 mt-1 space-y-0.5">
                                {extractInfo.warnings.map((w, i) => <li key={i}>{w}</li>)}
                              </ul>
                            </details>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Section 1: Project Information */}
              <details className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg p-4" open>
                <summary className="cursor-pointer font-semibold text-blue-900 text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  1. Project Information
                </summary>
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {renderFormField('Agreement No', 'agreement_no', 'text', 'e.g., AGR-2024-001', true)}
                  {renderFormField('Project No', 'project_no', 'text', 'e.g., PRJ-2024-001', true)}
                  {renderFormField('Document No', 'document_no', 'text', 'e.g., DOC-PH-001', true)}
                  {renderFormField('Revision', 'revision', 'text', 'A', true)}
                  {renderFormField('Document Class', 'document_class', 'text', 'Confidential')}
                  {renderFormField('Tag No', 'tag_no', 'text', 'e.g., P-101', true)}
                  {renderFormField('Service', 'service', 'text', 'e.g., Cooling Water')}
                  {renderFormField('Motor Classification', 'motor_classification')}
                  {renderFormField('Temperature (°C)', 'temperature', 'number')}
                  {renderFormField('Fluid Viscosity (cP)', 'fluid_viscosity_at_temp', 'number')}
                  {renderFormField('Horsepower (HP)', 'hp', 'number')}
                  {renderFormField('Pump Centerline Elevation (m)', 'pump_centerline_elevation', 'number')}
                  {renderFormField('Elevation Source BTL (m)', 'elevation_source_btl', 'number')}
                </div>
              </details>

              {/* Section 2: Discharge Pressure */}
              <details className="bg-gradient-to-r from-green-50 to-green-100 rounded-lg p-4">
                <summary className="cursor-pointer font-semibold text-green-900 text-lg">
                  2. Discharge Pressure Calculations
                </summary>
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {renderFormField('Destination Description', 'destination_description')}
                  {renderFormField('Flow Type', 'flow', 'text', 'Normal/Max/Min')}
                  {renderFormField('Destination Pressure (bar)', 'destination_pressure', 'number')}
                  {renderFormField('Destination Elevation (bar)', 'destination_elevation', 'number')}
                  {renderFormField('Line Friction Loss (bar)', 'line_friction_loss', 'number')}
                  {renderFormField('Flow Meter ΔP (bar)', 'flow_meter_del_p', 'number')}
                  {renderFormField('Other Losses (bar)', 'other_losses', 'number')}
                  {renderFormField('Control Valve (bar)', 'control_valve', 'number')}
                  {renderFormField('Misc Item (bar)', 'misc_item', 'number')}
                  {renderFormField('Contingency (bar)', 'contingency', 'number')}
                  <div className="md:col-span-2 lg:col-span-3">
                    {renderFormField('✅ TOTAL DISCHARGE PRESSURE (bar)', 'total_discharge_pressure', 'text', 'Auto-calculated')}
                  </div>
                </div>
              </details>

              {/* Section 3: Control Valve Sizing */}
              <details className="bg-gradient-to-r from-yellow-50 to-yellow-100 rounded-lg p-4">
                <summary className="cursor-pointer font-semibold text-yellow-900 text-lg">
                  3. Control Valve Sizing
                </summary>
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {renderFormField('Density (kg/m³)', 'density', 'number')}
                  {renderFormField('Cv Max', 'cv_max', 'number')}
                  {renderFormField('Cv Min', 'cv_min', 'number')}
                  {renderFormField('✅ Cv Ratio', 'cv_ratio', 'text', 'Auto-calculated')}
                </div>
              </details>

              {/* Section 4: Suction Pressure */}
              <details className="bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg p-4">
                <summary className="cursor-pointer font-semibold text-purple-900 text-lg">
                  4. Suction Pressure Calculations
                </summary>
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {renderFormField('Source Operating Pressure (bar)', 'source_op_pressure', 'number')}
                  {renderFormField('Suction Elevation (bar)', 'suction_elm', 'number')}
                  {renderFormField('Inline Instrument Losses (bar)', 'inline_inst_losses', 'number')}
                  {renderFormField('Line Friction Losses (bar)', 'line_fric_losses', 'number')}
                  {renderFormField('Control Valve Suction (bar)', 'control_valve_suction', 'number')}
                  {renderFormField('Misc Items Suction (bar)', 'misc_items_suction', 'number')}
                  {renderFormField('✅ TOTAL SUCTION LOSSES (bar)', 'total_suction_losses', 'text', 'Auto-calculated')}
                  {renderFormField('✅ TOTAL SUCTION PRESSURE (bar)', 'total_suction_pressure', 'text', 'Auto-calculated')}
                </div>
              </details>

              {/* Section 5: Power Consumption */}
              <details className="bg-gradient-to-r from-red-50 to-red-100 rounded-lg p-4">
                <summary className="cursor-pointer font-semibold text-red-900 text-lg">
                  5. Power Consumption
                </summary>
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {renderFormField('Hydraulic Power (kW)', 'hydraulic_power', 'number')}
                  {renderFormField('Pump Efficiency (%)', 'pump_efficiency', 'number')}
                  {renderFormField('✅ BREAK HORSE POWER (kW)', 'break_horse_power', 'text', 'Auto-calculated')}
                  {renderFormField('Motor Rating (kW)', 'motor_rating', 'number')}
                  {renderFormField('Motor Efficiency (%)', 'motor_efficiency', 'number')}
                  {renderFormField('POWER CONSUMPTION (kW)', 'power_consumption', 'number')}
                  {renderFormField('Type of Motor', 'type_of_motor')}
                </div>
              </details>

              {/* Section 6: NPSH */}
              <details className="bg-gradient-to-r from-cyan-50 to-cyan-100 rounded-lg p-4">
                <summary className="cursor-pointer font-semibold text-cyan-900 text-lg">
                  6. NPSH Availability
                </summary>
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {renderFormField('Suction Pressure (bar)', 'suction_pressure_npsh', 'number')}
                  {renderFormField('Vapor Pressure (bar)', 'vapor_pressure', 'number')}
                  {renderFormField('✅ NPSHA (m)', 'npsha', 'text', 'Auto-calculated')}
                  {renderFormField('Safety Margin (m)', 'safety_margin_npsha', 'number')}
                  {renderFormField('✅ NPSHA WITH SAFETY MARGIN (m)', 'npsha_with_safety_margin', 'text', 'Auto-calculated')}
                </div>
              </details>

              {/* Section 7: Results (Read-only) */}
              <details className="bg-gradient-to-r from-emerald-50 to-emerald-100 rounded-lg p-4">
                <summary className="cursor-pointer font-semibold text-emerald-900 text-lg">
                  7. Pump Calculation Results (Auto-Generated)
                </summary>
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {renderFormField('✅ Discharge Pressure (bar)', 'discharge_pressure', 'text', 'Will be calculated')}
                  {renderFormField('✅ Suction Pressure (bar)', 'suction_pressure_result', 'text', 'Will be calculated')}
                  {renderFormField('✅ Differential Pressure (bar)', 'differential_pressure', 'text', 'Will be calculated')}
                  {renderFormField('✅ Differential Head (m)', 'differential_head', 'text', 'Will be calculated')}
                  {renderFormField('✅ NPSHA (m)', 'npsha_result', 'text', 'Will be calculated')}
                </div>
              </details>

              {/* Section 8: Max Suction Pressure */}
              <details className="bg-gradient-to-r from-orange-50 to-orange-100 rounded-lg p-4">
                <summary className="cursor-pointer font-semibold text-orange-900 text-lg">
                  8. Maximum Suction Pressure
                </summary>
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {renderFormField('Suction Vessel Max Op Pressure (bar)', 'suction_vessel_max_op_pressure', 'number')}
                  {renderFormField('Suction Elevation (m)', 'suction_el_m', 'number')}
                  {renderFormField('TL to HHLL (m)', 'tl_to_hhll_m', 'number')}
                  {renderFormField('✅ MAX SUCTION PRESSURE (bar)', 'max_suction_pressure', 'text', 'Manual entry or calculated')}
                </div>
              </details>

              {/* Section 9: Minimum Flow */}
              <details className="bg-gradient-to-r from-pink-50 to-pink-100 rounded-lg p-4">
                <summary className="cursor-pointer font-semibold text-pink-900 text-lg">
                  9. Minimum Flow Calculations
                </summary>
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {renderFormField('Pump Minimum Flow (m³/h)', 'pump_minimum_flow', 'number')}
                  {renderFormField('Fluid Density MCF (kg/m³)', 'fluid_density_mcf', 'number')}
                  {renderFormField('Pump Discharge Pressure Min Flow (bar)', 'pump_discharge_pressure_min_flow', 'number')}
                  {renderFormField('Destination Pressure (bar)', 'destination_pressure', 'number')}
                  {renderFormField('Elevation Destination to Pump CL (bar)', 'el_destination_pump_cl', 'number')}
                  {renderFormField('MCF Line Friction Losses (bar)', 'mcf_line_friction_losses', 'number')}
                  {renderFormField('Flow Meter Losses (bar)', 'flow_meter_losses', 'number')}
                  {renderFormField('Misc Pressure Drop MCF (bar)', 'misc_pressure_drop_mcf', 'number')}
                  {renderFormField('MCF CV Pressure Drop (bar)', 'mcf_cv_pressure_drop', 'number')}
                </div>
              </details>

              {/* Section 10: Max Discharge Pressure */}
              <details className="bg-gradient-to-r from-indigo-50 to-indigo-100 rounded-lg p-4">
                <summary className="cursor-pointer font-semibold text-indigo-900 text-lg">
                  10. Maximum Discharge Pressure
                </summary>
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {renderFormField('API 610 Tolerance Used', 'api_610_tolerance_used')}
                  {renderFormField('API Tolerance Factor', 'api_tolerance_factor', 'number')}
                  {renderFormField('Shut-off Pressure Factor', 'shut_off_pressure_factor', 'number')}
                  {renderFormField('Shut-off Differential Pressure (bar)', 'shut_off_differential_pressure', 'number')}
                  {renderFormField('MAX DISCHARGE PRESSURE Option 1 (bar)', 'maximum_discharge_pressure_option_1', 'number')}
                  {renderFormField('MAX DISCHARGE PRESSURE Option 2 (bar)', 'maximum_discharge_pressure_option_2', 'number')}
                </div>
              </details>

              {/* Generate Preview Button */}
              <div className="mt-6">
                <button
                  onClick={handleGeneratePreview}
                  className="w-full py-4 px-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg font-bold text-lg shadow-lg transform hover:scale-105 transition-all"
                >
                  <span className="flex items-center justify-center space-x-2">
                    <Sparkles className="h-6 w-6" />
                    <span>📊 Generate Preview Table</span>
                  </span>
                </button>
              </div>
            </div>
          </>
        ) : (
          /* Preview Table */
          <div className="bg-white rounded-lg border-4 border-green-500 shadow-2xl p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-2xl font-bold text-green-900 flex items-center gap-2">
                <SparklesIcon className="h-8 w-8 text-green-600" />
                📊 DATA PREVIEW - READY TO DOWNLOAD
              </h3>
              <button
                onClick={downloadTableAsExcel}
                className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-lg font-bold flex items-center gap-2 shadow-lg transform hover:scale-105 transition-all"
              >
                <Download className="h-5 w-5" />
                Download Excel
              </button>
            </div>

            <div className="max-h-[600px] overflow-y-auto border-2 border-gray-300 rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-gradient-to-r from-green-600 to-emerald-600 text-white sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left font-bold border-b-2 border-white">Field Name</th>
                    <th className="px-4 py-3 text-left font-bold border-b-2 border-white">Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {Object.entries(pumpFormData).map(([key, value], idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-4 py-2 font-medium text-gray-700">{key.replace(/_/g, ' ').toUpperCase()}</td>
                      <td className="px-4 py-2 text-gray-900">{value || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex gap-4">
              <button
                onClick={() => setShowPreview(false)}
                className="px-6 py-3 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                ← Back to Form
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PumpHydraulicPage;
