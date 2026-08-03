/**
 * Smart Datasheet Generator - User Selection Based
 * Allows users to select datasheet type first, then upload appropriate files
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload,
  FileText,
  CheckCircle,
  AlertCircle,
  Loader,
  ArrowLeft,
  Sparkles,
  FileCheck,
  Zap,
  FileUp,
  Download
} from 'lucide-react';
import { SparklesIcon } from '@heroicons/react/24/outline';
import apiClient from '../../services/api.service';
import { API_TIMEOUT_UPLOAD } from '../../config/api.config';
import * as XLSX from 'xlsx';

const SmartDatasheetPage = () => {
  const navigate = useNavigate();

  // Datasheet type definitions
  const DATASHEET_TYPES = [
    {
      id: 'mov_equipment',
      name: 'MOV Equipment',
      fullName: 'Motor Operated Valves',
      description: 'Generate datasheets for Motor Operated Valves from P&ID and HMB drawings',
      icon: '⚙️',
      color: 'blue',
      requiredFiles: [
        { key: 'pid', label: 'P&ID Drawing', required: true, description: 'Piping & Instrumentation Diagram' },
        { key: 'hmb', label: 'HMB Drawing', required: true, description: 'Heat & Material Balance' },
        { key: 'linelist', label: 'Line List', required: false, description: 'Line specifications & design data' },
        { key: 'other', label: 'Additional Document', required: false, description: 'Optional supporting document' }
      ]
    },
    {
      id: 'sdv_streams',
      name: 'SDV Streams',
      fullName: 'Shut Down Valve Streams',
      description: 'Generate stream datasheets for Shut Down Valves from P&ID and HMB',
      icon: '🔴',
      color: 'red',
      requiredFiles: [
        { key: 'pid', label: 'P&ID Drawing', required: true, description: 'Piping & Instrumentation Diagram' },
        { key: 'hmb', label: 'HMB Drawing', required: true, description: 'Heat & Material Balance' },
        { key: 'linelist', label: 'Line List', required: false, description: 'Line specifications & design data' }
      ]
    },
    {
      id: 'pressure_instrument',
      fullName: 'Pressure Instrumentation',
      name: 'Pressure Instrument',
      description: 'Identify and extract pressure instruments from P&ID drawings',
      icon: '📊',
      color: 'purple',
      requiredFiles: [
        { key: 'pid', label: 'P&ID Drawing', required: true, description: 'Supports PDF, PNG, JPG, DWG formats' }
      ]
    },
    {
      id: 'pump_hydraulic',
      name: 'Pump Hydraulic',
      fullName: 'Pump Hydraulic Calculation',
      description: 'Generate pump datasheets from hydraulic parameters',
      icon: '💧',
      color: 'cyan',
      requiredFiles: [] // No files required - uses form data
    }
  ];

  // State
  const [selectedType, setSelectedType] = useState(null);
  const [uploadedFiles, setUploadedFiles] = useState({});
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
    total_discharge_pressure: '', // calculated

    // CONTROL_VALVE_DELTA_P Section
    density: '',
    cv_max: '',
    cv_min: '',
    cv_ratio: '', // calculated
    total_frictional_losses: '',
    dynamic_losses_30_percent: '', // calculated
    cv_pressure_drop: '',
    cv_rangeability: '',
    cv_ratio_within_range: 'Yes',
    cv_pressure_drop_check: 'Yes',

    // SUCTION_PRESSURE_CALCULATIONS Section
    source_op_pressure: '',
    suction_elm: '',
    inline_inst_losses: '',
    line_fric_losses: '',
    control_valve_suction: '',
    misc_items_suction: '',
    total_suction_losses: '', // calculated
    total_suction_pressure: '', // calculated

    // POWER_CONSUMPTION_PER_PUMP Section
    hydraulic_power: '',
    pump_efficiency: '',
    break_horse_power: '', // calculated
    motor_rating: '',
    motor_efficiency: '',
    power_consumption: '', // calculated
    type_of_motor: 'AC Induction',

    // NPSH_AVAILABILITY Section
    suction_pressure_npsh: '',
    vapor_pressure: '',
    npsha: '', // calculated
    safety_margin_npsha: '',
    npsha_with_safety_margin: '', // calculated

    // PUMP_CALCULATION_RESULTS Section (all calculated)
    discharge_pressure: '',
    suction_pressure_result: '',
    differential_pressure: '',
    differential_head: '',
    npsha_result: '',

    // MAX_SUCTION_PRESSURE Section
    suction_vessel_max_op_pressure: '',
    suction_el_m: '',
    tl_to_hhll_m: '',
    max_suction_pressure: '', // calculated

    // MCF_CALCULATION Section
    pump_minimum_flow: '',
    fluid_density_mcf: '',
    pump_discharge_pressure_min_flow: '',
    destination_pressure_mcf: '',
    el_destination_pump_cl: '',
    mcf_line_friction_losses: '',
    flow_meter_losses: '',
    misc_pressure_drop_mcf: '',
    mcf_cv_pressure_drop: '', // calculated

    // MAX_DISCHARGE_PRESSURE Section
    api610_tolerance_used: '',
    api_tolerance_factor: '',
    shut_off_pressure_factor: '',
    shut_off_differential_pressure: '', // calculated

    // MAX_DISCHARGE_PRESSURE_OPTIONS Section (both calculated)
    maximum_discharge_pressure_option_1: '',
    maximum_discharge_pressure_option_2: ''
  });
  const [dragActive, setDragActive] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [analysisStage, setAnalysisStage] = useState('');
  const [uploadResult, setUploadResult] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [jobId, setJobId] = useState(null);
  const [htmlPreview, setHtmlPreview] = useState('');
  const [excelData, setExcelData] = useState(null);
  const [showPreview, setShowPreview] = useState(false);

  // ========== PUMP CALCULATION FUNCTIONS (from ComprehensivePumpForm.jsx) ==========

  // Pump Calculation Results Function
  const calculatePumpResults = (formData) => {
    // 1. Discharge Pressure = Total Discharge Pressure (from discharge calculations)
    const totalDischargePressure = parseFloat(formData.total_discharge_pressure) || 0;
    if (totalDischargePressure > 0) {
      formData.discharge_pressure = totalDischargePressure.toFixed(2);
    }

    // 2. Suction Pressure = Source Operating Pressure - Static Suction Head - Suction Losses
    const sourceOpPressure = parseFloat(formData.source_op_pressure) || 0;
    const suctionELm = parseFloat(formData.suction_elm) || 0;
    const totalSuctionLosses = parseFloat(formData.total_suction_losses) || 0;

    if (sourceOpPressure > 0) {
      // Convert static head from meters to pressure (assuming water: 1m = 0.0981 bar)
      const staticHeadPressure = suctionELm * 0.0981;
      const suctionPressure = sourceOpPressure - staticHeadPressure - totalSuctionLosses;
      formData.suction_pressure_result = Math.max(0, suctionPressure).toFixed(3);
    }

    // 3. Differential Pressure = Discharge Pressure - Suction Pressure
    const dischargePressure = parseFloat(formData.discharge_pressure) || 0;
    const suctionPressureResult = parseFloat(formData.suction_pressure_result) || 0;

    if (dischargePressure > 0 && suctionPressureResult >= 0) {
      const differentialPressure = dischargePressure - suctionPressureResult;
      formData.differential_pressure = differentialPressure.toFixed(3);
    }

    // 4. Differential Head = Differential Pressure / (density * g)
    // Converting pressure to head: Head(m) = Pressure(bar) * 10.197 (for water)
    const differentialPressure = parseFloat(formData.differential_pressure) || 0;
    if (differentialPressure > 0) {
      const differentialHead = differentialPressure * 10.197; // Conversion factor for water
      formData.differential_head = differentialHead.toFixed(2);
    }

    // 5. NPSHA Result = NPSHA calculated value (from NPSH Availability section)
    const npsha = parseFloat(formData.npsha) || 0;
    if (npsha > 0) {
      formData.npsha_result = npsha.toFixed(3);
    }

    // 6. Max Suction Pressure Calculation (New Section)
    calculateMaxSuctionPressure(formData);
  };

  // Max Suction Pressure Calculation Function
  const calculateMaxSuctionPressure = (formData) => {
    const suctionVesselMaxOpPressure = parseFloat(formData.suction_vessel_max_op_pressure) || 0;
    const suctionElM = parseFloat(formData.suction_el_m) || 0;
    const tlToHhllM = parseFloat(formData.tl_to_hhll_m) || 0;

    // Max Suction Pressure = Suction Vessel Max Op. Pressure + TL to HHLL head - Static suction head
    if (suctionVesselMaxOpPressure > 0) {
      // Convert heights to pressure (1m = 0.0981 bar for water)
      const tlToHhllPressure = tlToHhllM * 0.0981;
      const suctionStaticHead = suctionElM * 0.0981;

      const maxSuctionPressure = suctionVesselMaxOpPressure + tlToHhllPressure - suctionStaticHead;
      formData.max_suction_pressure = Math.max(0, maxSuctionPressure).toFixed(3);
    }
  };

  // MCF Control Valve Pressure Drop Calculation Function
  const calculateMcfCvPressureDrop = (formData) => {
    const pumpDischargePressureMinFlow = parseFloat(formData.pump_discharge_pressure_min_flow) || 0;
    const destinationPressureMcf = parseFloat(formData.destination_pressure) || 0;
    const elDestinationPumpCl = parseFloat(formData.el_destination_pump_cl) || 0;
    const mcfLineFrictionLosses = parseFloat(formData.mcf_line_friction_losses) || 0;
    const flowMeterLosses = parseFloat(formData.flow_meter_losses) || 0;
    const miscPressureDropMcf = parseFloat(formData.misc_pressure_drop_mcf) || 0;
    const fluidDensityMcf = parseFloat(formData.fluid_density_mcf) || 1000; // Default to water density

    // MCF CV Pressure Drop = Pump Discharge Pressure - Destination Pressure - Elevation Head - All Losses
    if (pumpDischargePressureMinFlow > 0) {
      // Calculate elevation head (positive = destination higher than pump)
      // Using specific gravity relative to water (SG = density/1000)
      const specificGravity = fluidDensityMcf / 1000;
      const elevationHead = elDestinationPumpCl * specificGravity * 0.0981;

      const mcfCvPressureDrop = pumpDischargePressureMinFlow
                                - destinationPressureMcf
                                - elevationHead
                                - mcfLineFrictionLosses
                                - flowMeterLosses
                                - miscPressureDropMcf;

      formData.mcf_cv_pressure_drop = Math.max(0, mcfCvPressureDrop).toFixed(3);
    }
  };

  // Max Discharge Pressure Calculation Function
  const calculateShutOffDifferentialPressure = (formData) => {
    const apiToleranceFactor = parseFloat(formData.api_tolerance_factor) || 1.0;
    const shutOffPressureFactor = parseFloat(formData.shut_off_pressure_factor) || 1.0;
    const differentialPressure = parseFloat(formData.differential_pressure) || 0;

    // Shut off Differential Pressure = Differential Pressure × API Tolerance Factor × Shut off Pressure Factor
    if (differentialPressure > 0 && apiToleranceFactor > 0 && shutOffPressureFactor > 0) {
      const shutOffDifferentialPressure = differentialPressure * apiToleranceFactor * shutOffPressureFactor;
      formData.shut_off_differential_pressure = shutOffDifferentialPressure.toFixed(3);
    }
  };

  // Maximum Discharge Pressure Options Calculation Function
  const calculateMaxDischargePressureOptions = (formData) => {
    const maxSuctionPressure = parseFloat(formData.max_suction_pressure) || 0;
    const differentialPressure = parseFloat(formData.differential_pressure) || 0;
    const shutOffDifferentialPressure = parseFloat(formData.shut_off_differential_pressure) || 0;

    // Option 1: Maximum Discharge Pressure = Maximum Suction Pressure + Rated Differential Pressure
    if (maxSuctionPressure > 0 && differentialPressure > 0) {
      const maxDischargePressureOption1 = maxSuctionPressure + differentialPressure;
      formData.maximum_discharge_pressure_option_1 = maxDischargePressureOption1.toFixed(3);
    }

    // Option 2: Maximum Discharge Pressure = Maximum Suction Pressure + Shut off Differential Pressure
    if (maxSuctionPressure > 0 && shutOffDifferentialPressure > 0) {
      const maxDischargePressureOption2 = maxSuctionPressure + shutOffDifferentialPressure;
      formData.maximum_discharge_pressure_option_2 = maxDischargePressureOption2.toFixed(3);
    }
  };

  // Smart Input Change Handler with Auto-Calculations
  const handlePumpInputChange = (fieldName, value) => {
    setPumpFormData(prev => {
      const newFormData = {
        ...prev,
        [fieldName]: value
      };

      // Control Valve Delta P Check automatic calculations
      if (['cv_max', 'cv_min'].includes(fieldName)) {
        const cvMax = parseFloat(newFormData.cv_max) || 0;
        const cvMin = parseFloat(newFormData.cv_min) || 0;

        // CV Ratio = Max/Min
        if (cvMin > 0) {
          const cvRatio = cvMax / cvMin;
          newFormData.cv_ratio = cvRatio.toFixed(2);
        }
      }

      if (fieldName === 'total_frictional_losses') {
        const totalFrictionalLosses = parseFloat(newFormData.total_frictional_losses) || 0;

        // 30% Dynamic Losses = 30% of Total Frictional Losses
        const dynamicLosses30Percent = totalFrictionalLosses * 0.30;
        newFormData.dynamic_losses_30_percent = dynamicLosses30Percent.toFixed(2);
      }

      // Suction Pressure Calculations automatic calculations
      if (['inline_inst_losses', 'line_fric_losses', 'control_valve_suction', 'misc_items_suction'].includes(fieldName)) {
        const inlineInstLosses = parseFloat(newFormData.inline_inst_losses) || 0;
        const lineFricLosses = parseFloat(newFormData.line_fric_losses) || 0;
        const controlValveSuction = parseFloat(newFormData.control_valve_suction) || 0;
        const miscItemsSuction = parseFloat(newFormData.misc_items_suction) || 0;

        // Total Suction Losses = Sum of all loss components
        const totalSuctionLosses = inlineInstLosses + lineFricLosses + controlValveSuction + miscItemsSuction;
        newFormData.total_suction_losses = totalSuctionLosses.toFixed(3);
      }

      if (['source_op_pressure', 'suction_elm', 'total_suction_losses'].includes(fieldName)) {
        const sourceOpPressure = parseFloat(newFormData.source_op_pressure) || 0;
        const suctionELm = parseFloat(newFormData.suction_elm) || 0;
        const totalSuctionLosses = parseFloat(newFormData.total_suction_losses) || 0;

        // Total Suction Pressure = Source Op. Pressure + Suction Elevation - Total Losses
        const totalSuctionPressure = sourceOpPressure + suctionELm - totalSuctionLosses;
        newFormData.total_suction_pressure = totalSuctionPressure.toFixed(3);
      }

      // Power Consumption Per Pump automatic calculations
      if (['hydraulic_power', 'pump_efficiency'].includes(fieldName)) {
        const hydraulicPower = parseFloat(newFormData.hydraulic_power) || 0;
        const pumpEfficiency = parseFloat(newFormData.pump_efficiency) || 0;

        if (hydraulicPower > 0 && pumpEfficiency > 0) {
          // Break Horse Power = Hydraulic Power / (Pump Efficiency / 100)
          const breakHorsePower = hydraulicPower / (pumpEfficiency / 100);
          newFormData.break_horse_power = breakHorsePower.toFixed(3);
        }
      }

      if (['break_horse_power', 'motor_efficiency'].includes(fieldName) || fieldName === 'motor_rating') {
        const breakHorsePower = parseFloat(newFormData.break_horse_power) || 0;
        const motorEfficiency = parseFloat(newFormData.motor_efficiency) || 0;

        if (breakHorsePower > 0 && motorEfficiency > 0) {
          // Power Consumption = Break Horse Power / (Motor Efficiency / 100)
          const powerConsumption = breakHorsePower / (motorEfficiency / 100);
          newFormData.power_consumption = powerConsumption.toFixed(3);
        }
      }

      // NPSH Availability automatic calculations
      if (['suction_pressure_npsh', 'vapor_pressure'].includes(fieldName)) {
        const suctionPressureNpsh = parseFloat(newFormData.suction_pressure_npsh) || 0;
        const vaporPressure = parseFloat(newFormData.vapor_pressure) || 0;

        if (suctionPressureNpsh > 0 && vaporPressure >= 0) {
          // NPSHA = Suction Pressure - Vapor Pressure (converted from bar to meters)
          // Using 1 bar = 10.2 m for conversion (approximate for water)
          const npsha = (suctionPressureNpsh - vaporPressure) * 10.2;
          newFormData.npsha = npsha.toFixed(2);
        }
      }

      if (['npsha', 'safety_margin_npsha'].includes(fieldName)) {
        const npsha = parseFloat(newFormData.npsha) || 0;
        const safetyMarginNpsha = parseFloat(newFormData.safety_margin_npsha) || 0;

        if (npsha > 0 && safetyMarginNpsha >= 0) {
          // NPSHA (With Safety Margin) = NPSHA - Safety Margin
          const npshaWithSafetyMargin = npsha - safetyMarginNpsha;
          newFormData.npsha_with_safety_margin = npshaWithSafetyMargin.toFixed(2);
        }
      }

      // AI-powered automatic calculation for Total Discharge Pressure
      if (['destination_pressure', 'destination_elevation', 'line_friction_loss', 'flow_meter_del_p', 'other_losses', 'control_valve', 'misc_item', 'contingency'].includes(fieldName)) {
        const destinationPressure = parseFloat(newFormData.destination_pressure) || 0;
        const destinationElevation = parseFloat(newFormData.destination_elevation) || 0;
        const lineFrictionLoss = parseFloat(newFormData.line_friction_loss) || 0;
        const flowMeterDelP = parseFloat(newFormData.flow_meter_del_p) || 0;
        const otherLosses = parseFloat(newFormData.other_losses) || 0;
        const controlValve = parseFloat(newFormData.control_valve) || 0;
        const miscItem = parseFloat(newFormData.misc_item) || 0;
        const contingency = parseFloat(newFormData.contingency) || 0;

        // Total Discharge Pressure = Sum of all pressure components including destination elevation
        const totalDischargePressure = destinationPressure + destinationElevation + lineFrictionLoss + flowMeterDelP +
                                       otherLosses + controlValve + miscItem + contingency;

        newFormData.total_discharge_pressure = totalDischargePressure.toFixed(2);

        // Auto-calculate pump calculation results
        calculatePumpResults(newFormData);
      }

      // Auto-calculate pump calculation results when any relevant field changes
      if (['total_discharge_pressure', 'source_op_pressure', 'suction_elm', 'total_suction_losses', 'npsha'].includes(fieldName)) {
        calculatePumpResults(newFormData);
      }

      // Auto-calculate MCF when relevant fields change
      if (['pump_discharge_pressure_min_flow', 'destination_pressure', 'el_destination_pump_cl', 'mcf_line_friction_losses', 'flow_meter_losses', 'misc_pressure_drop_mcf', 'fluid_density_mcf'].includes(fieldName)) {
        calculateMcfCvPressureDrop(newFormData);
      }

      // Auto-calculate shut off differential pressure
      if (['api_tolerance_factor', 'shut_off_pressure_factor', 'differential_pressure'].includes(fieldName)) {
        calculateShutOffDifferentialPressure(newFormData);
      }

      // Auto-calculate max discharge pressure options
      if (['max_suction_pressure', 'differential_pressure', 'shut_off_differential_pressure', 'suction_vessel_max_op_pressure', 'suction_el_m'].includes(fieldName)) {
        calculateMaxDischargePressureOptions(newFormData);
      }

      // Auto-calculate max suction when relevant fields change
      if (['suction_vessel_max_op_pressure', 'suction_el_m', 'tl_to_hhll_m'].includes(fieldName)) {
        calculateMaxSuctionPressure(newFormData);
      }

      return newFormData;
    });
  };

  // ========== END PUMP CALCULATION FUNCTIONS ==========

  // File handling
  const handleFileSelect = (fileKey, file) => {
    if (!file) return;

    // Validate PDF
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('Please upload PDF files only');
      return;
    }

    // Validate size (50MB)
    const sizeMB = file.size / (1024 * 1024);
    if (sizeMB > 50) {
      setError('File size must be less than 50MB');
      return;
    }

    setUploadedFiles(prev => ({
      ...prev,
      [fileKey]: file
    }));
    setError('');
  };

  const removeFile = (fileKey) => {
    setUploadedFiles(prev => {
      const newFiles = { ...prev };
      delete newFiles[fileKey];
      return newFiles;
    });
  };

  // Drag and drop
  const handleDrag = (e, fileKey) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(fileKey);
    } else if (e.type === 'dragleave') {
      setDragActive('');
    }
  };

  const handleDrop = (e, fileKey) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive('');

    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      handleFileSelect(fileKey, droppedFile);
    }
  };

  // Validate all required files/data are provided
  const validateFiles = () => {
    if (!selectedType) return { valid: false, message: 'Please select a datasheet type' };

    // For pump hydraulic, validate form data instead of files
    if (selectedType === 'pump_hydraulic') {
      if (!pumpFormData.tag_no || !pumpFormData.service) {
        return { valid: false, message: 'Please enter Tag Number and Service' };
      }
      return { valid: true };
    }

    // For other types, validate file uploads
    const typeConfig = DATASHEET_TYPES.find(t => t.id === selectedType);
    const requiredFiles = typeConfig.requiredFiles.filter(f => f.required);

    for (const reqFile of requiredFiles) {
      if (!uploadedFiles[reqFile.key]) {
        return { valid: false, message: `Please upload ${reqFile.label}` };
      }
    }

    return { valid: true };
  };

  // Function to download HTML table as Excel - DIRECT DOWNLOAD
  const downloadTableAsExcel = () => {
    const data = pumpFormData;
    
    // Create Excel-ready data structure
    const excelData = [];
    let currentRow = 0;
    const sectionRows = []; // Track section header rows for styling
    const totalRows = []; // Track total/calculated rows for styling
    
    // Add main header
    excelData.push(['PUMP HYDRAULIC DATA SHEET']);
    currentRow++;
    
    excelData.push(['Document:', data.document_no || 'DRAFT', '', 'Revision:', data.revision || '0', '', 'Tag:', data.tag_no || 'P-XXX']);
    currentRow++;
    
    excelData.push([]);
    currentRow++;
    
    // Section 1: Project Information
    sectionRows.push(currentRow);
    excelData.push(['PROJECT INFORMATION', '', '', '', '', '', '', '']);
    currentRow++;
    excelData.push(['Agreement No', data.agreement_no || 'N/A']);
    currentRow++;
    excelData.push(['Project No', data.project_no || 'N/A']);
    currentRow++;
    excelData.push(['Document Class', data.document_class || 'N/A']);
    currentRow++;
    excelData.push(['Service', data.service || 'N/A']);
    currentRow++;
    excelData.push(['Temperature (°C)', data.temperature || 'N/A']);
    currentRow++;
    excelData.push(['Fluid Viscosity @ Temp (cP)', data.fluid_viscosity_at_temp || 'N/A']);
    currentRow++;
    excelData.push(['HP (Horsepower)', data.hp || 'N/A']);
    currentRow++;
    excelData.push([]);
    currentRow++;
    
    // Section 2: Discharge Pressure Calculations
    sectionRows.push(currentRow);
    excelData.push(['DISCHARGE PRESSURE CALCULATIONS', '', '', '', '', '', '', '']);
    currentRow++;
    excelData.push(['Destination Description', data.destination_description || 'N/A']);
    currentRow++;
    excelData.push(['Flow Type', data.flow_type || 'N/A']);
    currentRow++;
    excelData.push(['Destination Pressure (bar)', data.destination_pressure || 'N/A']);
    currentRow++;
    excelData.push(['Destination Elevation (m)', data.destination_elevation || 'N/A']);
    currentRow++;
    excelData.push(['Line Friction Loss (bar)', data.line_friction_loss || 'N/A']);
    currentRow++;
    excelData.push(['Flow Meter ΔP (bar)', data.flow_meter_del_p || 'N/A']);
    currentRow++;
    excelData.push(['Other Losses (bar)', data.other_losses || 'N/A']);
    currentRow++;
    excelData.push(['Control Valve (bar)', data.control_valve || 'N/A']);
    currentRow++;
    excelData.push(['Misc Item (bar)', data.misc_item || 'N/A']);
    currentRow++;
    excelData.push(['Contingency (bar)', data.contingency || 'N/A']);
    currentRow++;
    totalRows.push(currentRow);
    excelData.push(['TOTAL Discharge Pressure (bar)', data.total_discharge_pressure || 'N/A']);
    currentRow++;
    excelData.push([]);
    currentRow++;
    
    // Section 3: Control Valve Delta P Check
    sectionRows.push(currentRow);
    excelData.push(['CONTROL VALVE DELTA P CHECK', '', '', '', '', '', '', '']);
    currentRow++;
    excelData.push(['Density (kg/m³)', data.density || 'N/A']);
    currentRow++;
    excelData.push(['CV Max', data.cv_max || 'N/A']);
    currentRow++;
    excelData.push(['CV Min', data.cv_min || 'N/A']);
    currentRow++;
    totalRows.push(currentRow);
    excelData.push(['CV Ratio (Calculated)', data.cv_ratio || 'N/A']);
    currentRow++;
    totalRows.push(currentRow);
    excelData.push(['CV Pressure Drop (bar)', data.cv_pressure_drop || 'N/A']);
    currentRow++;
    totalRows.push(currentRow);
    excelData.push(['CV Ratio Within Range', data.cv_ratio_within_range || 'N/A']);
    currentRow++;
    excelData.push([]);
    currentRow++;
    
    // Section 4: Suction Pressure Calculations
    sectionRows.push(currentRow);
    excelData.push(['SUCTION PRESSURE CALCULATIONS', '', '', '', '', '', '', '']);
    currentRow++;
    excelData.push(['Source Op. Pressure (bar)', data.source_op_pressure || 'N/A']);
    currentRow++;
    excelData.push(['Suction EL (m)', data.suction_elm || 'N/A']);
    currentRow++;
    excelData.push(['Inline Inst. Losses (bar)', data.inline_inst_losses || 'N/A']);
    currentRow++;
    excelData.push(['Line Fric Losses (bar)', data.line_fric_losses || 'N/A']);
    currentRow++;
    excelData.push(['Control Valve (bar)', data.control_valve_suction || 'N/A']);
    currentRow++;
    excelData.push(['Misc Items (bar)', data.misc_items_suction || 'N/A']);
    currentRow++;
    totalRows.push(currentRow);
    excelData.push(['TOTAL Suction Losses (bar)', data.total_suction_losses || 'N/A']);
    currentRow++;
    totalRows.push(currentRow);
    excelData.push(['TOTAL Suction Pressure (bar)', data.total_suction_pressure || 'N/A']);
    currentRow++;
    excelData.push([]);
    currentRow++;
    
    // Section 5: Power Consumption Per Pump
    sectionRows.push(currentRow);
    excelData.push(['POWER CONSUMPTION PER PUMP', '', '', '', '', '', '', '']);
    currentRow++;
    excelData.push(['Hydraulic Power (kW)', data.hydraulic_power || 'N/A']);
    currentRow++;
    excelData.push(['Pump Efficiency (%)', data.pump_efficiency || 'N/A']);
    currentRow++;
    totalRows.push(currentRow);
    excelData.push(['Break Horse Power (kW)', data.break_horse_power || 'N/A']);
    currentRow++;
    excelData.push(['Motor Rating (kW)', data.motor_rating || 'N/A']);
    currentRow++;
    excelData.push(['Motor Efficiency (%)', data.motor_efficiency || 'N/A']);
    currentRow++;
    totalRows.push(currentRow);
    excelData.push(['TOTAL Power Consumption (kW)', data.power_consumption || 'N/A']);
    currentRow++;
    excelData.push(['Type of Motor', data.type_of_motor || 'N/A']);
    currentRow++;
    excelData.push([]);
    currentRow++;
    
    // Section 6: NPSH Availability
    sectionRows.push(currentRow);
    excelData.push(['NPSH AVAILABILITY', '', '', '', '', '', '', '']);
    currentRow++;
    excelData.push(['Suction Pressure (bar)', data.suction_pressure_npsh || 'N/A']);
    currentRow++;
    excelData.push(['Vapor Pressure (bar)', data.vapor_pressure || 'N/A']);
    currentRow++;
    totalRows.push(currentRow);
    excelData.push(['NPSHA (m)', data.npsha || 'N/A']);
    currentRow++;
    excelData.push(['Safety Margin (%)', data.safety_margin_npsha || 'N/A']);
    currentRow++;
    totalRows.push(currentRow);
    excelData.push(['NPSHA with Safety Margin (m)', data.npsha_with_safety_margin || 'N/A']);
    currentRow++;
    excelData.push([]);
    currentRow++;
    
    // Section 7: Pump Calculation Results
    sectionRows.push(currentRow);
    excelData.push(['PUMP CALCULATION RESULTS', '', '', '', '', '', '', '']);
    currentRow++;
    totalRows.push(currentRow);
    excelData.push(['Discharge Pressure (bar)', data.discharge_pressure || 'N/A']);
    currentRow++;
    totalRows.push(currentRow);
    excelData.push(['Suction Pressure (bar)', data.suction_pressure_result || 'N/A']);
    currentRow++;
    totalRows.push(currentRow);
    excelData.push(['Differential Pressure (bar)', data.differential_pressure || 'N/A']);
    currentRow++;
    totalRows.push(currentRow);
    excelData.push(['Differential Head (m)', data.differential_head || 'N/A']);
    currentRow++;
    totalRows.push(currentRow);
    excelData.push(['NPSHA (m)', data.npsha_result || 'N/A']);
    currentRow++;
    excelData.push([]);
    currentRow++;
    
    // Section 8: Maximum Suction Pressure
    sectionRows.push(currentRow);
    excelData.push(['MAXIMUM SUCTION PRESSURE', '', '', '', '', '', '', '']);
    currentRow++;
    excelData.push(['Suction Vessel Max Op. Pressure (bar)', data.suction_vessel_max_op_pressure || 'N/A']);
    currentRow++;
    excelData.push(['Suction EL from Pump C/L Max (m)', data.suction_el_m || 'N/A']);
    currentRow++;
    excelData.push(['TL to HHLL (m)', data.tl_to_hhll_m || 'N/A']);
    currentRow++;
    totalRows.push(currentRow);
    excelData.push(['Max Suction Pressure (bar)', data.max_suction_pressure || 'N/A']);
    currentRow++;
    excelData.push([]);
    currentRow++;
    
    // Section 9: Minimum Flow Conditions
    sectionRows.push(currentRow);
    excelData.push(['MINIMUM FLOW CONDITIONS', '', '', '', '', '', '', '']);
    currentRow++;
    excelData.push(['Pump Minimum Flow (m³/h)', data.pump_minimum_flow || 'N/A']);
    currentRow++;
    excelData.push(['Fluid Density MCF (kg/m³)', data.fluid_density_mcf || 'N/A']);
    currentRow++;
    excelData.push(['Pump Discharge Pressure Min Flow (bar)', data.pump_discharge_pressure_min_flow || 'N/A']);
    currentRow++;
    excelData.push(['Destination Pressure MCF (bar)', data.destination_pressure || 'N/A']);
    currentRow++;
    excelData.push(['EL Destination Pump C/L (m)', data.el_destination_pump_cl || 'N/A']);
    currentRow++;
    excelData.push(['MCF Line Friction Losses (bar)', data.mcf_line_friction_losses || 'N/A']);
    currentRow++;
    excelData.push(['Flow Meter Losses (bar)', data.flow_meter_losses || 'N/A']);
    currentRow++;
    excelData.push(['Misc Pressure Drop MCF (bar)', data.misc_pressure_drop_mcf || 'N/A']);
    currentRow++;
    totalRows.push(currentRow);
    excelData.push(['MCF CV Pressure Drop (bar)', data.mcf_cv_pressure_drop || 'N/A']);
    currentRow++;
    excelData.push([]);
    currentRow++;
    
    // Section 10: Maximum Discharge Pressure
    sectionRows.push(currentRow);
    excelData.push(['MAXIMUM DISCHARGE PRESSURE', '', '', '', '', '', '', '']);
    currentRow++;
    excelData.push(['API610 Tolerance Used', data.api_610_tolerance_used || 'N/A']);
    currentRow++;
    excelData.push(['API Tolerance Factor', data.api_tolerance_factor || 'N/A']);
    currentRow++;
    excelData.push(['Shut Off Pressure Factor', data.shut_off_pressure_factor || 'N/A']);
    currentRow++;
    totalRows.push(currentRow);
    excelData.push(['Shut Off Differential Pressure (bar)', data.shut_off_differential_pressure || 'N/A']);
    currentRow++;
    totalRows.push(currentRow);
    excelData.push(['Maximum Discharge Pressure Option 1 (bar)', data.maximum_discharge_pressure_option_1 || 'N/A']);
    currentRow++;
    totalRows.push(currentRow);
    excelData.push(['Maximum Discharge Pressure Option 2 (bar)', data.maximum_discharge_pressure_option_2 || 'N/A']);
    currentRow++;
    
    // Create worksheet
    const ws = XLSX.utils.aoa_to_sheet(excelData);
    
    // Set column widths
    ws['!cols'] = [
      { wch: 45 },  // Field name column - wider
      { wch: 25 },  // Value column
      { wch: 5 },   // Spacer
      { wch: 20 },  // Extra columns for header
      { wch: 15 },
      { wch: 5 },
      { wch: 15 },
      { wch: 20 }
    ];
    
    // Apply styling to cells
    const range = XLSX.utils.decode_range(ws['!ref']);
    
    // Style main header (row 0)
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const address = XLSX.utils.encode_col(C) + '1';
      if (!ws[address]) continue;
      ws[address].s = {
        font: { bold: true, sz: 16, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "1F4E78" } }, // Dark blue
        alignment: { horizontal: "center", vertical: "center" }
      };
    }
    
    // Style document info row (row 1)
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const address = XLSX.utils.encode_col(C) + '2';
      if (!ws[address]) continue;
      ws[address].s = {
        font: { bold: true, sz: 11 },
        fill: { fgColor: { rgb: "D9E1F2" } }, // Light blue
        alignment: { horizontal: "left", vertical: "center" }
      };
    }
    
    // Style section headers (light blue background, bold, white text)
    sectionRows.forEach(row => {
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const address = XLSX.utils.encode_col(C) + (row + 1);
        if (!ws[address]) continue;
        ws[address].s = {
          font: { bold: true, sz: 12, color: { rgb: "FFFFFF" } },
          fill: { fgColor: { rgb: "4472C4" } }, // Medium blue
          alignment: { horizontal: "center", vertical: "center" },
          border: {
            top: { style: "thin", color: { rgb: "000000" } },
            bottom: { style: "thin", color: { rgb: "000000" } },
            left: { style: "thin", color: { rgb: "000000" } },
            right: { style: "thin", color: { rgb: "000000" } }
          }
        };
      }
    });
    
    // Style total/calculated rows (yellow background, bold)
    totalRows.forEach(row => {
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const address = XLSX.utils.encode_col(C) + (row + 1);
        if (!ws[address]) continue;
        ws[address].s = {
          font: { bold: true, sz: 11 },
          fill: { fgColor: { rgb: "FFF2CC" } }, // Light yellow
          alignment: { horizontal: "left", vertical: "center" },
          border: {
            top: { style: "thin", color: { rgb: "000000" } },
            bottom: { style: "thin", color: { rgb: "000000" } },
            left: { style: "thin", color: { rgb: "000000" } },
            right: { style: "thin", color: { rgb: "000000" } }
          }
        };
      }
    });
    
    // Add borders to all data cells
    for (let R = range.s.r; R <= range.e.r; ++R) {
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const address = XLSX.utils.encode_col(C) + (R + 1);
        if (!ws[address]) continue;
        if (!ws[address].s) ws[address].s = {};
        if (!ws[address].s.border) {
          ws[address].s.border = {
            top: { style: "thin", color: { rgb: "CCCCCC" } },
            bottom: { style: "thin", color: { rgb: "CCCCCC" } },
            left: { style: "thin", color: { rgb: "CCCCCC" } },
            right: { style: "thin", color: { rgb: "CCCCCC" } }
          };
        }
        // Default alignment if not set
        if (!ws[address].s.alignment) {
          ws[address].s.alignment = { vertical: "center" };
        }
      }
    }
    
    // Create workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Pump Data');
    
    // Generate filename
    const filename = `Pump_Data_Sheet_${data.document_no || 'DRAFT'}_${data.tag_no || 'P-XXX'}_${new Date().toISOString().slice(0,10).replace(/-/g,'')}.xlsx`;
    
    // Download directly
    XLSX.writeFile(wb, filename);
    
    setSuccess(`✅ Excel file "${filename}" downloaded successfully!`);
    setTimeout(() => setSuccess(''), 5000);
  };

  // Show preview table (old backend upload functionality removed)
  const handleUpload = async () => {
    // For pump hydraulic, just show preview - no backend call
    if (selectedType === 'pump_hydraulic') {
      setShowPreview(true);
      setSuccess('✅ Preview ready! Review your data and click Download Excel button.');
      return;
    }

    // For other types, keep existing upload logic
    const validation = validateFiles();
    if (!validation.valid) {
      setError(validation.message);
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setError('');
    setAnalysisStage('Uploading files...');

    if (selectedType === 'pump_hydraulic') {
      try {
        console.log('[Smart Datasheet] Sending pump data directly to pump-calculations endpoint');
        
        // Run all calculations before submitting to ensure all result fields are populated
        const calculatedFormData = { ...pumpFormData };
        calculatePumpResults(calculatedFormData);
        calculateMaxDischargePressureOptions(calculatedFormData);
        
        console.log('[Smart Datasheet] Pump form data with calculations:', calculatedFormData);
        
        setAnalysisStage('Processing pump calculation...');
        
          // Save pump calculation first (add required JSON fields to prevent database NOT NULL errors)
          const pumpDataWithRequiredFields = {
            ...calculatedFormData,
            material_design: {},
            site_utility: {},
            general_data: {},
            general_notes: {},
            calculation_results: {},
            control_valve_delta_p: {},
            npsh_availability: {},
            power_consumption_per_pump: {},
            suction_pressure_calculations: {},
          };
          const saveResponse = await apiClient.post('/process-datasheet/pump-calculations/', pumpDataWithRequiredFields);
        if (saveResponse.data && saveResponse.data.id) {
          const pumpId = saveResponse.data.id;
          console.log('[Smart Datasheet] Pump calculation saved with ID:', pumpId);
          
          setAnalysisStage('Generating Excel datasheet...');
          
          // Generate Excel
          const excelResponse = await apiClient.get(
            `/process-datasheet/pump-calculations/${pumpId}/generate_datasheet/`,
            { responseType: 'blob' }
          );
          
          console.log('[Smart Datasheet] Excel response received');
          
          // Get filename from content-disposition header
          const contentDisposition = excelResponse.headers['content-disposition'];
          const filename = contentDisposition
            ? contentDisposition.split('filename=')[1].replace(/"/g, '')
            : `Pump_Datasheet_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.xlsx`;
          
          // Convert blob to base64 for consistent handling
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64data = reader.result.split(',')[1];
            const excelDataToSet = {
              base64: base64data,
              filename: filename
            };
            setExcelData(excelDataToSet);
            
            // Auto-download
            setTimeout(() => {
              console.log('[Smart Datasheet] Auto-downloading Excel file:', filename);
              const binaryString = window.atob(base64data);
              const bytes = new Uint8Array(binaryString.length);
              for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }
              const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
              const url = window.URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.download = filename;
              document.body.appendChild(link);
              link.click();
              window.URL.revokeObjectURL(url);
              document.body.removeChild(link);
              console.log('[Smart Datasheet] Excel file downloaded successfully!');
            }, 1000);
          };
          reader.readAsDataURL(excelResponse.data);
          
          // Set success result
          setUploadResult({
            success: true,
            generated_types: ['pump_hydraulic'],
            results: {
              pump_hydraulic: {
                success: true,
                filename: filename
              }
            }
          });
          setUploading(false);
          setAnalysisStage('');
        }
      } catch (err) {
        console.error('Pump calculation error:', err);
        setError(err.response?.data?.error || err.message || 'Pump calculation failed');
        setUploading(false);
      }
      return;
    }

    // For other types, use the original smart-upload endpoint
    const formData = new FormData();
    formData.append('datasheet_type', selectedType);

    // Add files based on keys for other types
    Object.entries(uploadedFiles).forEach(([key, file]) => {
      formData.append(`${key}_file`, file);
    });

    try {
      setAnalysisStage('Processing datasheet generation...');
      console.log('[Smart Datasheet] Uploading to /process-datasheet/datasheets/smart-upload/');
      const response = await apiClient.post(
        '/process-datasheet/datasheets/smart-upload/',
        formData,
        { timeout: API_TIMEOUT_UPLOAD } // SOFT-CODED: extended for Railway cold-start + file processing
      );

      console.log('[Smart Datasheet] Upload response:', response.data);
      if (response.data.success) {
        const newJobId = response.data.job_id;
        setJobId(newJobId);
        setAnalysisStage('Generation in progress...');
        
        // Start polling
        pollJobStatus(newJobId);
      } else {
        throw new Error(response.data.error || 'Upload failed');
      }
    } catch (err) {
      console.error('Upload error:', err);
      setError(err.response?.data?.error || err.message || 'Upload failed');
      setUploading(false);
    }
  };

  // Poll job status
  const pollJobStatus = async (jobId) => {
    let attempts = 0;
    const maxAttempts = 120; // 6 minutes
    const pollInterval = 3000; // 3 seconds

    const poll = async () => {
      if (attempts >= maxAttempts) {
        setError('Processing timeout - please try again');
        setUploading(false);
        return;
      }

      try {
        const response = await apiClient.get(`/process-datasheet/smart-job-status/${jobId}/`);

        if (response.data.success) {
          const { status, progress, stage, result, error: jobError } = response.data;

          setUploadProgress(progress || 0);
          setAnalysisStage(stage || '');

          if (status === 'completed') {
            console.log('[Smart Datasheet] Job completed, full result:', result);
            console.log('[Smart Datasheet] Selected type:', selectedType);
            
            // Extract result data
            if (result && result.results) {
              console.log('[Smart Datasheet] Results object:', result.results);
              const datasheetResult = result.results[selectedType];
              console.log('[Smart Datasheet] Datasheet result for', selectedType, ':', datasheetResult);
              
              if (datasheetResult) {
                if (datasheetResult.html_preview) {
                  console.log('[Smart Datasheet] Setting HTML preview, length:', datasheetResult.html_preview.length);
                  setHtmlPreview(datasheetResult.html_preview);
                }
                if (datasheetResult.excel_file) {
                  console.log('[Smart Datasheet] Setting Excel data, filename:', datasheetResult.filename);
                  const excelDataToSet = {
                    base64: datasheetResult.excel_file,
                    filename: datasheetResult.filename || 'datasheet.xlsx'
                  };
                  setExcelData(excelDataToSet);
                  
                  // Automatically download Excel after 1 second (same as pressure instrument page)
                  setTimeout(() => {
                    console.log('[Smart Datasheet] Auto-downloading Excel file:', excelDataToSet.filename);
                    try {
                      const binaryString = window.atob(excelDataToSet.base64);
                      const bytes = new Uint8Array(binaryString.length);
                      for (let i = 0; i < binaryString.length; i++) {
                        bytes[i] = binaryString.charCodeAt(i);
                      }
                      const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                      const url = window.URL.createObjectURL(blob);
                      const link = document.createElement('a');
                      link.href = url;
                      link.download = excelDataToSet.filename;
                      document.body.appendChild(link);
                      link.click();
                      window.URL.revokeObjectURL(url);
                      document.body.removeChild(link);
                      console.log('[Smart Datasheet] Excel file downloaded successfully!');
                    } catch (err) {
                      console.error('[Smart Datasheet] Auto-download error:', err);
                    }
                  }, 1000);
                }
                // Check for errors in the result
                if (datasheetResult.error) {
                  console.error('[Smart Datasheet] Error in result:', datasheetResult.error);
                  setError(`Generation failed: ${datasheetResult.error}`);
                  setUploading(false);
                  return;
                }
              } else {
                console.warn('[Smart Datasheet] No result found for selected type:', selectedType);
                console.warn('[Smart Datasheet] Available results:', Object.keys(result.results || {}));
                setError('No datasheet generated. Please check if all required fields are filled.');
                setUploading(false);
                return;
              }
            } else {
              console.warn('[Smart Datasheet] No results object in result');
            }
            setUploadResult(result);
            setUploading(false);
            return;
          } else if (status === 'failed' || status === 'error') {
            setError(jobError || 'Processing failed');
            setUploading(false);
            return;
          }
        }

        attempts++;
        setTimeout(poll, pollInterval);
      } catch (err) {
        console.error('Status poll error:', err);
        attempts++;
        setTimeout(poll, pollInterval);
      }
    };

    poll();
  };

  // Reset form
  const handleReset = () => {
    setSelectedType(null);
    setUploadedFiles({});
    setPumpFormData({
      // Project Information
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
      
      // Discharge Pressure Calculations (GENERAL_INFO)
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
      
      // Control Valve Delta P Check
      density: '',
      cv_max: '',
      cv_min: '',
      cv_ratio: '',
      total_frictional_losses: '',
      dynamic_losses_30_percent: '',
      cv_pressure_drop: '',
      cv_rangeability: '',
      cv_ratio_within_range: 'Yes',
      cv_pressure_drop_check: 'Yes',
      
      // Suction Pressure Calculations
      source_op_pressure: '',
      suction_elm: '',
      inline_inst_losses: '',
      line_fric_losses: '',
      control_valve_suction: '',
      misc_items_suction: '',
      total_suction_losses: '',
      total_suction_pressure: '',
      
      // Power Consumption Per Pump
      hydraulic_power: '',
      pump_efficiency: '',
      break_horse_power: '',
      motor_rating: '',
      motor_efficiency: '',
      power_consumption: '',
      type_of_motor: 'AC Induction',

      // NPSH Availability
      suction_pressure_npsh: '',
      vapor_pressure: '',
      npsha: '',
      safety_margin_npsha: '',
      npsha_with_safety_margin: '',
      suction_el_m_max: '',
      tl_to_hhll_m: '',
      
      // MCF Calculation
      pump_minimum_flow: '',
      fluid_density_mcf: '',
      pump_discharge_pressure_min_flow: '',
      el_destination_pump_cl: '',
      mcf_line_friction_losses: '',
      flow_meter_losses: '',
      misc_pressure_drop_mcf: '',
      mcf_cv_pressure_drop: '',

      // Max Discharge Pressure
      api_610_tolerance_used: '',
      api_tolerance_factor: '',
      shut_off_pressure_factor: '',
      shut_off_differential_pressure: '',

      // Calculated Fields (Pump Calculation Results)
      discharge_pressure: '',
      suction_pressure_result: '',
      differential_pressure: '',
      differential_head: '',
      npsha_result: '',
      total_discharge_pressure: '',
      max_suction_pressure: '',
      maximum_discharge_pressure_option_1: '',
      maximum_discharge_pressure_option_2: ''
    });
    setUploading(false);
    setUploadProgress(0);
    setAnalysisStage('');
    setUploadResult(null);
    setError('');
    setSuccess('');
    setJobId(null);
    setHtmlPreview('');
    setExcelData(null);
    setShowPreview(false);
  };

  // Download Excel file
  const handleDownloadExcel = () => {
    if (!excelData) return;
    triggerExcelDownload(excelData);
  };

  // Helper function to trigger Excel download
  const triggerExcelDownload = (data) => {
    if (!data) return;

    try {
      const binaryString = window.atob(data.base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = data.filename;
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);
    } catch (err) {
      console.error('Download error:', err);
      setError('Failed to download Excel file');
    }
  };

  // Render file upload zone
  const renderFileUpload = (fileConfig) => {
    const file = uploadedFiles[fileConfig.key];
    const isDragging = dragActive === fileConfig.key;

    return (
      <div key={fileConfig.key} className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {fileConfig.label}
          {fileConfig.required && <span className="text-red-500 ml-1">*</span>}
          {!fileConfig.required && <span className="text-gray-400 ml-1">(Optional)</span>}
        </label>
        <p className="text-xs text-gray-500 mb-2">{fileConfig.description}</p>

        {!file ? (
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              isDragging
                ? 'border-purple-500 bg-purple-50'
                : 'border-gray-300 hover:border-purple-400'
            }`}
            onDragEnter={(e) => handleDrag(e, fileConfig.key)}
            onDragLeave={(e) => handleDrag(e, fileConfig.key)}
            onDragOver={(e) => handleDrag(e, fileConfig.key)}
            onDrop={(e) => handleDrop(e, fileConfig.key)}
          >
            <FileUp className="mx-auto h-8 w-8 text-gray-400 mb-2" />
            <p className="text-sm text-gray-600 mb-2">
              Drag and drop or{' '}
              <label className="text-purple-600 hover:text-purple-700 cursor-pointer font-medium">
                browse
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf"
                  onChange={(e) => handleFileSelect(fileConfig.key, e.target.files?.[0])}
                />
              </label>
            </p>
            <p className="text-xs text-gray-500">PDF files only, max 50MB</p>
          </div>
        ) : (
          <div className="border border-green-200 bg-green-50 rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center">
              <FileCheck className="h-5 w-5 text-green-600 mr-3" />
              <div>
                <p className="text-sm font-medium text-gray-900">{file.name}</p>
                <p className="text-xs text-gray-500">
                  {(file.size / (1024 * 1024)).toFixed(2)} MB
                </p>
              </div>
            </div>
            <button
              onClick={() => removeFile(fileConfig.key)}
              className="text-red-600 hover:text-red-700 text-sm font-medium"
            >
              Remove
            </button>
          </div>
        )}
      </div>
    );
  };

  const selectedTypeConfig = DATASHEET_TYPES.find(t => t.id === selectedType);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/engineering/process/datasheet')}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div>
                <div className="flex items-center space-x-2">
                  <Sparkles className="h-6 w-6" />
                  <h1 className="text-2xl font-bold">Smart Datasheet Generator</h1>
                </div>
                <p className="text-purple-100 text-sm mt-1">
                  Select datasheet type and upload required documents
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!uploadResult ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column - Selection and Upload */}
            <div className="lg:col-span-2 space-y-6">
              {/* Step 1: Select Datasheet Type */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center space-x-2 mb-4">
                  <div className="bg-purple-100 p-2 rounded-lg">
                    <span className="text-2xl">1️⃣</span>
                  </div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    Select Datasheet Type
                  </h2>
                </div>

                <select
                  value={selectedType || ''}
                  onChange={(e) => {
                    setSelectedType(e.target.value);
                    setUploadedFiles({});
                    setError('');
                  }}
                  className="w-full px-4 py-3 bg-white border-2 border-gray-300 rounded-lg text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all appearance-none cursor-pointer text-base font-medium shadow-sm hover:border-gray-400"
                  style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='currentColor'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.75rem center', backgroundSize: '1.5em 1.5em', paddingRight: '2.5rem' }}
                >
                  <option value="" disabled>
                     Select a datasheet type to generate...
                  </option>
                  {DATASHEET_TYPES.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.icon} {type.name} - {type.fullName}
                    </option>
                  ))}
                </select>
                
                {/* Selected Type Info Card */}
                {selectedType && (
                  <div className={`mt-4 p-4 rounded-lg border-2 border-${DATASHEET_TYPES.find(t => t.id === selectedType)?.color || 'blue'}-300 bg-${DATASHEET_TYPES.find(t => t.id === selectedType)?.color || 'blue'}-50`}>
                    <div className="flex items-start space-x-3">
                      <span className="text-3xl">{DATASHEET_TYPES.find(t => t.id === selectedType)?.icon}</span>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 text-lg">
                          {DATASHEET_TYPES.find(t => t.id === selectedType)?.fullName}
                        </h3>
                        <p className="text-sm text-gray-700 mt-1">
                          {DATASHEET_TYPES.find(t => t.id === selectedType)?.description}
                        </p>
                        <div className="mt-3 flex items-center space-x-2">
                          <CheckCircle className="h-5 w-5 text-green-600" />
                          <span className="text-sm font-medium text-green-700">Selected</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Step 2: Upload Files OR Pump Form */}
              {selectedType && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center space-x-2 mb-4">
                    <div className="bg-purple-100 p-2 rounded-lg">
                      <span className="text-2xl">2️⃣</span>
                    </div>
                    <h2 className="text-xl font-semibold text-gray-900">
                      {selectedType === 'pump_hydraulic' ? 'Enter Pump Parameters' : 'Upload Required Files'}
                    </h2>
                  </div>

                  <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-800">
                      <strong>{selectedTypeConfig.name}:</strong> {selectedTypeConfig.description}
                    </p>
                  </div>

                  {/* Conditional: Pump Form or File Upload */}
                  {selectedType === 'pump_hydraulic' ? (
                    <div className="space-y-4">
                      {/* Project Information Section */}
                      <details className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg p-4" open>
                        <summary className="cursor-pointer font-semibold text-blue-900 text-lg flex items-center gap-2">
                          <FileText className="h-5 w-5" />
                          1. Project Information
                        </summary>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Agreement No *</label>
                            <input type="text" value={pumpFormData.agreement_no} onChange={(e) => handlePumpInputChange('agreement_no', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="AGR-2024-001" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Project No *</label>
                            <input type="text" value={pumpFormData.project_no} onChange={(e) => handlePumpInputChange('project_no', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="PRJ-2024-001" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Document No *</label>
                            <input type="text" value={pumpFormData.document_no} onChange={(e) => handlePumpInputChange('document_no', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="DOC-001" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Revision *</label>
                            <input type="text" value={pumpFormData.revision} onChange={(e) => handlePumpInputChange('revision', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="A" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Document Class *</label>
                            <select value={pumpFormData.document_class} onChange={(e) => handlePumpInputChange('document_class', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                              <option value="">Select Document Class</option>
                              <option>Confidential</option>
                              <option>Internal</option>
                              <option>Public</option>
                              <option>Restricted</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Tag No *</label>
                            <input type="text" value={pumpFormData.tag_no} onChange={(e) => handlePumpInputChange('tag_no', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="P-101" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Service *</label>
                            <input type="text" value={pumpFormData.service} onChange={(e) => handlePumpInputChange('service', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Cooling Water Pump" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Motor Classification *</label>
                            <select value={pumpFormData.motor_classification} onChange={(e) => handlePumpInputChange('motor_classification', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                              <option value="">Select Motor Classification</option>
                              <option value="Class I, Division 1">Class I, Division 1</option>
                              <option value="Class I, Division 2">Class I, Division 2</option>
                              <option value="Class II, Division 1">Class II, Division 1</option>
                              <option value="Class II, Division 2">Class II, Division 2</option>
                              <option>Non-Hazardous</option>
                              <option value="General Purpose">General Purpose</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Temperature (°C) *</label>
                            <input type="number" value={pumpFormData.temperature} onChange={(e) => handlePumpInputChange('temperature', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="25" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Fluid Viscosity @ Temp (cP)</label>
                            <input type="number" value={pumpFormData.fluid_viscosity_at_temp} onChange={(e) => handlePumpInputChange('fluid_viscosity_at_temp', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="1.0" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">HP (Horsepower) *</label>
                            <input type="number" value={pumpFormData.hp} onChange={(e) => handlePumpInputChange('hp', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="50" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Pump Centerline Elevation From Grade (m) *</label>
                            <input type="number" value={pumpFormData.pump_centerline_elevation} onChange={(e) => handlePumpInputChange('pump_centerline_elevation', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="5.0" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Elevation of Source BTL From Pump Central Line (m) *</label>
                            <input type="number" value={pumpFormData.elevation_source_btl} onChange={(e) => handlePumpInputChange('elevation_source_btl', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="3.0" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Motor Classification *</label>
                            <select value={pumpFormData.motor_classification} onChange={(e) => handlePumpInputChange('motor_classification', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                              <option value="">Select Motor Classification</option>
                              <option value="Class I, Division 1">Class I, Division 1</option>
                              <option value="Class I, Division 2">Class I, Division 2</option>
                              <option value="Class II, Division 1">Class II, Division 1</option>
                              <option value="Class II, Division 2">Class II, Division 2</option>
                              <option value="Non-Hazardous">Non-Hazardous</option>
                              <option value="General Purpose">General Purpose</option>
                            </select>
                          </div>
                        </div>
                      </details>

                      {/* Power & Efficiency Section */}
                      <details className="bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg p-4">
                        <summary className="cursor-pointer font-semibold text-purple-900 text-lg flex items-center gap-2">
                          <Zap className="h-5 w-5" />
                          2. Power Consumption & Efficiency
                        </summary>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Hydraulic Power (kW) *</label>
                            <input type="number" value={pumpFormData.hydraulic_power} onChange={(e) => handlePumpInputChange('hydraulic_power', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500" placeholder="37.5" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Pump Efficiency (%) *</label>
                            <input type="number" value={pumpFormData.pump_efficiency} onChange={(e) => handlePumpInputChange('pump_efficiency', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500" placeholder="85" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                              {pumpFormData.break_horse_power && <SparklesIcon className="h-4 w-4 text-blue-600" />}
                              Break Horse Power {pumpFormData.break_horse_power && '(Auto-calculated)'}
                            </label>
                            <div className="w-full px-3 py-2 border-2 border-blue-300 bg-blue-50 rounded-lg text-lg font-semibold text-blue-900">
                              {pumpFormData.break_horse_power ? `${pumpFormData.break_horse_power} kW` : 'Auto-calculated'}
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Motor Rating (kW) *</label>
                            <input type="number" value={pumpFormData.motor_rating} onChange={(e) => handlePumpInputChange('motor_rating', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500" placeholder="45" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Motor Efficiency (%) *</label>
                            <input type="number" value={pumpFormData.motor_efficiency} onChange={(e) => handlePumpInputChange('motor_efficiency', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500" placeholder="92" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                              {pumpFormData.power_consumption && <SparklesIcon className="h-4 w-4 text-blue-600" />}
                              Power Consumption {pumpFormData.power_consumption && '(Auto-calculated)'}
                            </label>
                            <div className="w-full px-3 py-2 border-2 border-blue-300 bg-blue-50 rounded-lg text-lg font-semibold text-blue-900">
                              {pumpFormData.power_consumption ? `${pumpFormData.power_consumption} kW` : 'Auto-calculated'}
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Type of Motor *</label>
                            <select value={pumpFormData.type_of_motor} onChange={(e) => handlePumpInputChange('type_of_motor', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500">
                              <option>AC Induction</option>
                              <option>VFD</option>
                              <option>Synchronous</option>
                              <option>DC Motor</option>
                            </select>
                          </div>
                        </div>
                      </details>

                      {/* Discharge Pressure Section */}
                      <details className="bg-gradient-to-r from-green-50 to-green-100 rounded-lg p-4">
                        <summary className="cursor-pointer font-semibold text-green-900 text-lg flex items-center gap-2">
                          <CheckCircle className="h-5 w-5" />
                          3. Discharge Pressure Calculations
                        </summary>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Destination Description *</label>
                            <input type="text" value={pumpFormData.destination_description} onChange={(e) => handlePumpInputChange('destination_description', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500" placeholder="Cooling Water Tank" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Flow *</label>
                            <select value={pumpFormData.flow} onChange={(e) => handlePumpInputChange('flow', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500">
                              <option>Max</option>
                              <option>Normal</option>
                              <option>Min</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Destination Pressure (barg) *</label>
                            <input type="number" value={pumpFormData.destination_pressure} onChange={(e) => handlePumpInputChange('destination_pressure', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500" placeholder="5.0" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Destination EL from Pump C/L (m) *</label>
                            <input type="number" value={pumpFormData.destination_elevation} onChange={(e) => handlePumpInputChange('destination_elevation', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500" placeholder="10.0" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Line Friction Loss (bar) *</label>
                            <input type="number" value={pumpFormData.line_friction_loss} onChange={(e) => handlePumpInputChange('line_friction_loss', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500" placeholder="0.5" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Flow Meter Del P (bar) *</label>
                            <input type="number" value={pumpFormData.flow_meter_del_p} onChange={(e) => handlePumpInputChange('flow_meter_del_p', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500" placeholder="0.2" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Other Losses (bar)</label>
                            <input type="number" value={pumpFormData.other_losses} onChange={(e) => handlePumpInputChange('other_losses', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500" placeholder="0.0" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Control Valve (bar)</label>
                            <input type="number" value={pumpFormData.control_valve} onChange={(e) => handlePumpInputChange('control_valve', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500" placeholder="0.0" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Misc Item (bar)</label>
                            <input type="number" value={pumpFormData.misc_item} onChange={(e) => handlePumpInputChange('misc_item', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500" placeholder="0.0" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Contingency (bar)</label>
                            <input type="number" value={pumpFormData.contingency} onChange={(e) => handlePumpInputChange('contingency', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500" placeholder="0.0" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                              {pumpFormData.total_discharge_pressure && <SparklesIcon className="h-4 w-4 text-blue-600" />}
                              Total Discharge Pressure {pumpFormData.total_discharge_pressure && '(Auto-calculated)'}
                            </label>
                            <div className="w-full px-3 py-2 border-2 border-blue-300 bg-blue-50 rounded-lg text-lg font-semibold text-blue-900">
                              {pumpFormData.total_discharge_pressure ? `${pumpFormData.total_discharge_pressure} bar` : 'Auto-calculated'}
                            </div>
                          </div>
                        </div>
                      </details>

                      {/* NPSH Section */}
                      <details className="bg-gradient-to-r from-cyan-50 to-cyan-100 rounded-lg p-4">
                        <summary className="cursor-pointer font-semibold text-cyan-900 text-lg flex items-center gap-2">
                          <AlertCircle className="h-5 w-5" />
                          4. NPSH (Net Positive Suction Head)
                        </summary>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Suction Pressure (bar(g)) *</label>
                            <input type="number" value={pumpFormData.suction_pressure_npsh} onChange={(e) => handlePumpInputChange('suction_pressure_npsh', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500" placeholder="1.5" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Vapor Pressure (bar(g)) *</label>
                            <input type="number" value={pumpFormData.vapor_pressure} onChange={(e) => handlePumpInputChange('vapor_pressure', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500" placeholder="0.03" />
                          </div>
                          <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                                {pumpFormData.npsha && <SparklesIcon className="h-4 w-4 text-blue-600" />}
                                NPSHA {pumpFormData.npsha && '(Auto-calculated)'}
                              </label>
                              <div className="w-full px-3 py-2 border-2 border-blue-300 bg-blue-50 rounded-lg text-lg font-semibold text-blue-900">
                                {pumpFormData.npsha ? `${pumpFormData.npsha} m` : 'Auto-calculated'}
                              </div>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Safety Margin for NPSHA (m) *</label>
                              <input type="number" value={pumpFormData.safety_margin_npsha} onChange={(e) => handlePumpInputChange('safety_margin_npsha', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500" placeholder="0.5" />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                                {pumpFormData.npsha_with_safety_margin && <SparklesIcon className="h-4 w-4 text-blue-600" />}
                                NPSHA (With Safety Margin) {pumpFormData.npsha_with_safety_margin && '(Auto-calculated)'}
                              </label>
                              <div className="w-full px-3 py-2 border-2 border-blue-300 bg-blue-50 rounded-lg text-lg font-semibold text-blue-900">
                                {pumpFormData.npsha_with_safety_margin ? `${pumpFormData.npsha_with_safety_margin} m` : 'Auto-calculated'}
                              </div>
                            </div>
                          </div>
                        </details>

                        {/* Control Valve Delta P Check Section */}
                        <details className="bg-gradient-to-r from-teal-50 to-teal-100 rounded-lg p-4">
                          <summary className="cursor-pointer font-semibold text-teal-900 text-lg flex items-center gap-2">
                            <CheckCircle className="h-5 w-5" />
                            5. Control Valve Delta P Check
                          </summary>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Density (kg/m³) *</label>
                            <input type="number" value={pumpFormData.density} onChange={(e) => handlePumpInputChange('density', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500" placeholder="1000" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">CV Max *</label>
                            <input type="number" value={pumpFormData.cv_max} onChange={(e) => handlePumpInputChange('cv_max', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500" placeholder="100" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">CV Min *</label>
                            <input type="number" value={pumpFormData.cv_min} onChange={(e) => handlePumpInputChange('cv_min', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500" placeholder="20" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                              {pumpFormData.cv_ratio && <SparklesIcon className="h-4 w-4 text-blue-600" />}
                              CV Ratio (Max/Min) {pumpFormData.cv_ratio && '(Auto-calculated)'}
                            </label>
                            <div className="w-full px-3 py-2 border-2 border-blue-300 bg-blue-50 rounded-lg text-lg font-semibold text-blue-900">
                              {pumpFormData.cv_ratio || 'Auto-calculated'}
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Total Frictional Losses @ Normal Flow (bar) *</label>
                            <input type="number" value={pumpFormData.total_frictional_losses} onChange={(e) => handlePumpInputChange('total_frictional_losses', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500" placeholder="1.5" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                              {pumpFormData.dynamic_losses_30_percent && <SparklesIcon className="h-4 w-4 text-blue-600" />}
                              30% Dynamic Losses {pumpFormData.dynamic_losses_30_percent && '(Auto-calculated)'}
                            </label>
                            <div className="w-full px-3 py-2 border-2 border-blue-300 bg-blue-50 rounded-lg text-lg font-semibold text-blue-900">
                              {pumpFormData.dynamic_losses_30_percent ? `${pumpFormData.dynamic_losses_30_percent} bar` : 'Auto-calculated'}
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">CV Pressure Drop @ Normal Flow (bar) *</label>
                            <input type="number" value={pumpFormData.cv_pressure_drop} onChange={(e) => handlePumpInputChange('cv_pressure_drop', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500" placeholder="0.6" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">CV Rangeability *</label>
                            <input type="number" value={pumpFormData.cv_rangeability} onChange={(e) => handlePumpInputChange('cv_rangeability', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500" placeholder="50" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">CV Ratio Within Range?</label>
                            <select value={pumpFormData.cv_ratio_within_range} onChange={(e) => handlePumpInputChange('cv_ratio_within_range', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500">
                              <option>Yes</option>
                              <option>No</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">CV Pr. drop &gt; 30% Fric Pr. Loss?</label>
                            <select value={pumpFormData.cv_pressure_drop_check} onChange={(e) => handlePumpInputChange('cv_pressure_drop_check', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500">
                              <option>Yes</option>
                              <option>No</option>
                            </select>
                          </div>
                        </div>
                      </details>

                      {/* Suction Pressure Calculations Section */}
                      <details className="bg-gradient-to-r from-green-50 to-green-100 rounded-lg p-4">
                        <summary className="cursor-pointer font-semibold text-green-900 text-lg flex items-center gap-2">
                          <FileText className="h-5 w-5" />
                          6. Suction Pressure Calculations
                        </summary>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Source Op. Pressure (bar(g)) *</label>
                            <input type="number" value={pumpFormData.source_op_pressure} onChange={(e) => handlePumpInputChange('source_op_pressure', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500" placeholder="2.0" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Suction EL (m) *</label>
                            <input type="number" value={pumpFormData.suction_elm} onChange={(e) => handlePumpInputChange('suction_elm', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500" placeholder="3.0" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Inline Inst. Losses (bar) *</label>
                            <input type="number" value={pumpFormData.inline_inst_losses} onChange={(e) => handlePumpInputChange('inline_inst_losses', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500" placeholder="0.1" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Line Fric Losses (bar) *</label>
                            <input type="number" value={pumpFormData.line_fric_losses} onChange={(e) => handlePumpInputChange('line_fric_losses', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500" placeholder="0.2" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Control Valve (bar) *</label>
                            <input type="number" value={pumpFormData.control_valve_suction} onChange={(e) => handlePumpInputChange('control_valve_suction', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500" placeholder="0.1" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Misc Items (bar) *</label>
                            <input type="number" value={pumpFormData.misc_items_suction} onChange={(e) => handlePumpInputChange('misc_items_suction', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500" placeholder="0.05" />
                          </div>
                        </div>
                      </details>

                      {/* Pump Calculation Results Section */}
                      <details className="bg-gradient-to-r from-yellow-50 to-yellow-100 rounded-lg p-4">
                        <summary className="cursor-pointer font-semibold text-yellow-900 text-lg flex items-center gap-2">
                          <Sparkles className="h-5 w-5" />
                          7. Pump Calculation Results
                        </summary>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                          <div className="bg-yellow-50 p-3 rounded border border-yellow-200">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Discharge Pressure (bar(g))</label>
                            <div className="text-lg font-semibold text-yellow-900">{pumpFormData.discharge_pressure || 'Calculated'}</div>
                          </div>
                          <div className="bg-yellow-50 p-3 rounded border border-yellow-200">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Suction Pressure (bar(g))</label>
                            <div className="text-lg font-semibold text-yellow-900">{pumpFormData.suction_pressure_result || 'Calculated'}</div>
                          </div>
                          <div className="bg-yellow-50 p-3 rounded border border-yellow-200">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Differential Pressure (bar)</label>
                            <div className="text-lg font-semibold text-yellow-900">{pumpFormData.differential_pressure || 'Calculated'}</div>
                          </div>
                          <div className="bg-yellow-50 p-3 rounded border border-yellow-200">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Differential Head (m)</label>
                            <div className="text-lg font-semibold text-yellow-900">{pumpFormData.differential_head || 'Calculated'}</div>
                          </div>
                          <div className="bg-yellow-50 p-3 rounded border border-yellow-200">
                            <label className="block text-sm font-medium text-gray-700 mb-1">NPSHA (m)</label>
                            <div className="text-lg font-semibold text-yellow-900">{pumpFormData.npsha_result || 'Calculated'}</div>
                          </div>
                        </div>
                        <p className="text-xs text-yellow-800 mt-2">✨ These values are calculated automatically in the backend</p>
                      </details>

                      {/* Max Suction Pressure Max Density Section */}
                      <details className="bg-gradient-to-r from-emerald-50 to-emerald-100 rounded-lg p-4">
                        <summary className="cursor-pointer font-semibold text-emerald-900 text-lg flex items-center gap-2">
                          <AlertCircle className="h-5 w-5" />
                          8. Max Suction Pressure Max Density
                        </summary>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Suction Vessel Max Op. Pressure (bar(g))</label>
                            <input type="number" value={pumpFormData.suction_vessel_max_op_pressure} onChange={(e) => handlePumpInputChange('suction_vessel_max_op_pressure', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500" placeholder="3.0" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Suction EL (m)</label>
                            <input type="number" value={pumpFormData.suction_el_m} onChange={(e) => handlePumpInputChange('suction_el_m', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500" placeholder="4.0" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">TL to HHLL (m)</label>
                            <input type="number" value={pumpFormData.tl_to_hhll_m} onChange={(e) => handlePumpInputChange('tl_to_hhll_m', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500" placeholder="2.0" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                              {pumpFormData.max_suction_pressure && <SparklesIcon className="h-4 w-4 text-blue-600" />}
                              Max Suction Pressure {pumpFormData.max_suction_pressure && '(Auto-calculated)'}
                            </label>
                            <div className="w-full px-3 py-2 border-2 border-blue-300 bg-blue-50 rounded-lg text-lg font-semibold text-blue-900">
                              {pumpFormData.max_suction_pressure ? `${pumpFormData.max_suction_pressure} bar(g)` : 'Auto-calculated'}
                            </div>
                          </div>
                        </div>
                      </details>

                      {/* Minimum Flow Line Control Valve Calculation Section */}
                      <details className="bg-gradient-to-r from-indigo-50 to-indigo-100 rounded-lg p-4">
                        <summary className="cursor-pointer font-semibold text-indigo-900 text-lg flex items-center gap-2">
                          <Zap className="h-5 w-5" />
                          9. Minimum Flow Line Control Valve Calculation
                        </summary>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Pump Minimum Flow (m³/hr)</label>
                            <input type="number" value={pumpFormData.pump_minimum_flow} onChange={(e) => handlePumpInputChange('pump_minimum_flow', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" placeholder="20" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Fluid Density (kg/m³)</label>
                            <input type="number" value={pumpFormData.fluid_density_mcf} onChange={(e) => handlePumpInputChange('fluid_density_mcf', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" placeholder="1000" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Pump Discharge Pressure at Min Flow (bar(g))</label>
                            <input type="number" value={pumpFormData.pump_discharge_pressure_min_flow} onChange={(e) => handlePumpInputChange('pump_discharge_pressure_min_flow', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" placeholder="8.0" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Destination Pressure (bar(g))</label>
                            <input type="number" value={pumpFormData.destination_pressure} onChange={(e) => handlePumpInputChange('destination_pressure', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" placeholder="5.0" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">EL of Destination from Pump C/L (m)</label>
                            <input type="number" value={pumpFormData.el_destination_pump_cl} onChange={(e) => handlePumpInputChange('el_destination_pump_cl', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" placeholder="10" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">MCF Line Friction Losses (bar)</label>
                            <input type="number" value={pumpFormData.mcf_line_friction_losses} onChange={(e) => handlePumpInputChange('mcf_line_friction_losses', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" placeholder="0.3" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Flow Meter Losses (bar)</label>
                            <input type="number" value={pumpFormData.flow_meter_losses} onChange={(e) => handlePumpInputChange('flow_meter_losses', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" placeholder="0.2" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Misc. Pressure Drop (bar)</label>
                            <input type="number" value={pumpFormData.misc_pressure_drop_mcf} onChange={(e) => handlePumpInputChange('misc_pressure_drop_mcf', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" placeholder="0.1" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                              {pumpFormData.mcf_cv_pressure_drop && <SparklesIcon className="h-4 w-4 text-blue-600" />}
                              MCF CV Pressure Drop {pumpFormData.mcf_cv_pressure_drop && '(Auto-calculated)'}
                            </label>
                            <div className="w-full px-3 py-2 border-2 border-blue-300 bg-blue-50 rounded-lg text-lg font-semibold text-blue-900">
                              {pumpFormData.mcf_cv_pressure_drop ? `${pumpFormData.mcf_cv_pressure_drop} bar` : 'Auto-calculated'}
                            </div>
                          </div>
                        </div>
                      </details>

                      {/* Max Discharge Pressure at Max Density Section */}
                      <details className="bg-gradient-to-r from-pink-50 to-pink-100 rounded-lg p-4">
                        <summary className="cursor-pointer font-semibold text-pink-900 text-lg flex items-center gap-2">
                          <FileCheck className="h-5 w-5" />
                          10. Max Discharge Pressure at Max Density
                        </summary>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">API 610 Tolerance Used</label>
                            <input type="text" value={pumpFormData.api_610_tolerance_used} onChange={(e) => setPumpFormData({ ...pumpFormData, api_610_tolerance_used: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500" placeholder="API 610 11th Edition" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">API Tolerance Factor</label>
                            <input type="number" value={pumpFormData.api_tolerance_factor} onChange={(e) => handlePumpInputChange('api_tolerance_factor', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500" placeholder="1.1" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Shut Off Pressure Factor</label>
                            <input type="number" value={pumpFormData.shut_off_pressure_factor} onChange={(e) => handlePumpInputChange('shut_off_pressure_factor', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500" placeholder="1.15" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                              {pumpFormData.shut_off_differential_pressure && <SparklesIcon className="h-4 w-4 text-blue-600" />}
                              Shut Off Differential Pressure {pumpFormData.shut_off_differential_pressure && '(Auto-calculated)'}
                            </label>
                            <div className="w-full px-3 py-2 border-2 border-blue-300 bg-blue-50 rounded-lg text-lg font-semibold text-blue-900">
                              {pumpFormData.shut_off_differential_pressure ? `${pumpFormData.shut_off_differential_pressure} bar` : 'Auto-calculated'}
                            </div>
                          </div>
                        </div>
                      </details>

                      {/* Option for Max Discharge Pressure Section */}
                      <details className="bg-gradient-to-r from-orange-50 to-orange-100 rounded-lg p-4">
                        <summary className="cursor-pointer font-semibold text-orange-900 text-lg flex items-center gap-2">
                          <AlertCircle className="h-5 w-5" />
                          11. Option for Max Discharge Pressure
                        </summary>
                        <div className="space-y-4 mt-4">
                          <div className="bg-orange-50 p-4 rounded border border-orange-200">
                            <h4 className="font-semibold text-orange-900 mb-2">Option 1</h4>
                            <p className="text-sm text-orange-800 mb-2">Maximum Discharge Pressure = Maximum Suction Pressure + Rated Differential Pressure</p>
                            <p className="text-sm text-orange-800">Maximum Discharge Pressure = Suction Vessel Optg. Pressure + Maximum Suction Elevation Head + Shut off Diff. Pressure</p>
                            <div className="mt-3 p-3 bg-white rounded">
                              <label className="block text-sm font-medium text-gray-700 mb-1">Maximum Discharge Pressure (Option 1)</label>
                              <div className="text-lg font-semibold text-orange-900">{pumpFormData.maximum_discharge_pressure_option_1 || 'Calculated'}</div>
                            </div>
                          </div>
                          <div className="bg-orange-50 p-4 rounded border border-orange-200">
                            <h4 className="font-semibold text-orange-900 mb-2">Option 2</h4>
                            <p className="text-sm text-orange-800 mb-2">Maximum Discharge Pressure = Maximum Suction Pressure + Shut off Differential Pressure</p>
                            <div className="mt-3 p-3 bg-white rounded">
                              <label className="block text-sm font-medium text-gray-700 mb-1">Maximum Discharge Pressure (Option 2)</label>
                              <div className="text-lg font-semibold text-orange-900">{pumpFormData.maximum_discharge_pressure_option_2 || 'Calculated'}</div>
                            </div>
                          </div>
                        </div>
                        <p className="text-xs text-orange-800 mt-2">📋 These options are calculated based on different API 610 standards</p>
                      </details>

                      {/* ========== CALCULATED RESULTS SECTIONS (Auto-Calculated) ========== */}
                      
                      {/* Pump Calculation Results - Main Results Section */}
                      {(pumpFormData.discharge_pressure || pumpFormData.suction_pressure_result || pumpFormData.differential_pressure) && (
                        <details open className="bg-gradient-to-r from-yellow-50 to-yellow-100 rounded-lg p-4 border-2 border-yellow-300">
                          <summary className="cursor-pointer font-semibold text-yellow-900 text-lg flex items-center gap-2">
                            <SparklesIcon className="h-6 w-6 text-yellow-600" />
                            📊 Pump Calculation Results (Auto-Calculated)
                          </summary>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                            {pumpFormData.discharge_pressure && (
                              <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-3">
                                <label className="block text-sm font-medium text-blue-900 mb-1 flex items-center gap-2">
                                  <SparklesIcon className="h-4 w-4" />
                                  Discharge Pressure
                                </label>
                                <div className="text-2xl font-bold text-blue-700">{pumpFormData.discharge_pressure} <span className="text-sm font-normal">bar(g)</span></div>
                              </div>
                            )}
                            {pumpFormData.suction_pressure_result && (
                              <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-3">
                                <label className="block text-sm font-medium text-blue-900 mb-1 flex items-center gap-2">
                                  <SparklesIcon className="h-4 w-4" />
                                  Suction Pressure
                                </label>
                                <div className="text-2xl font-bold text-blue-700">{pumpFormData.suction_pressure_result} <span className="text-sm font-normal">bar(g)</span></div>
                              </div>
                            )}
                            {pumpFormData.differential_pressure && (
                              <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-3">
                                <label className="block text-sm font-medium text-blue-900 mb-1 flex items-center gap-2">
                                  <SparklesIcon className="h-4 w-4" />
                                  Differential Pressure
                                </label>
                                <div className="text-2xl font-bold text-blue-700">{pumpFormData.differential_pressure} <span className="text-sm font-normal">bar</span></div>
                              </div>
                            )}
                            {pumpFormData.differential_head && (
                              <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-3">
                                <label className="block text-sm font-medium text-blue-900 mb-1 flex items-center gap-2">
                                  <SparklesIcon className="h-4 w-4" />
                                  Differential Head
                                </label>
                                <div className="text-2xl font-bold text-blue-700">{pumpFormData.differential_head} <span className="text-sm font-normal">m</span></div>
                              </div>
                            )}
                            {pumpFormData.npsha_result && (
                              <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-3">
                                <label className="block text-sm font-medium text-blue-900 mb-1 flex items-center gap-2">
                                  <SparklesIcon className="h-4 w-4" />
                                  NPSHA
                                </label>
                                <div className="text-2xl font-bold text-blue-700">{pumpFormData.npsha_result} <span className="text-sm font-normal">m</span></div>
                              </div>
                            )}
                          </div>
                        </details>
                      )}

                      {/* Inline Calculated Fields Display */}
                      {(pumpFormData.total_discharge_pressure || pumpFormData.cv_ratio || pumpFormData.break_horse_power) && (
                        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200 mt-4">
                          <h3 className="font-semibold text-blue-900 text-sm mb-3 flex items-center gap-2">
                            <SparklesIcon className="h-5 w-5 text-blue-600" />
                            ⚡ Auto-Calculated Values
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
                            {pumpFormData.total_discharge_pressure && (
                              <div className="bg-white border border-blue-300 rounded-md p-2">
                                <div className="text-xs text-blue-600 mb-1">Total Discharge Pressure</div>
                                <div className="text-lg font-semibold text-blue-900">{pumpFormData.total_discharge_pressure} <span className="text-xs">bar</span></div>
                              </div>
                            )}
                            {pumpFormData.cv_ratio && (
                              <div className="bg-white border border-blue-300 rounded-md p-2">
                                <div className="text-xs text-blue-600 mb-1">CV Ratio (Max/Min)</div>
                                <div className="text-lg font-semibold text-blue-900">{pumpFormData.cv_ratio}</div>
                              </div>
                            )}
                            {pumpFormData.dynamic_losses_30_percent && (
                              <div className="bg-white border border-blue-300 rounded-md p-2">
                                <div className="text-xs text-blue-600 mb-1">30% Dynamic Losses</div>
                                <div className="text-lg font-semibold text-blue-900">{pumpFormData.dynamic_losses_30_percent} <span className="text-xs">bar</span></div>
                              </div>
                            )}
                            {pumpFormData.total_suction_losses && (
                              <div className="bg-white border border-blue-300 rounded-md p-2">
                                <div className="text-xs text-blue-600 mb-1">Total Suction Losses</div>
                                <div className="text-lg font-semibold text-blue-900">{pumpFormData.total_suction_losses} <span className="text-xs">bar</span></div>
                              </div>
                            )}
                            {pumpFormData.total_suction_pressure && (
                              <div className="bg-white border border-blue-300 rounded-md p-2">
                                <div className="text-xs text-blue-600 mb-1">Total Suction Pressure</div>
                                <div className="text-lg font-semibold text-blue-900">{pumpFormData.total_suction_pressure} <span className="text-xs">bar(g)</span></div>
                              </div>
                            )}
                            {pumpFormData.break_horse_power && (
                              <div className="bg-white border border-blue-300 rounded-md p-2">
                                <div className="text-xs text-blue-600 mb-1">Break Horse Power</div>
                                <div className="text-lg font-semibold text-blue-900">{pumpFormData.break_horse_power} <span className="text-xs">kW</span></div>
                              </div>
                            )}
                            {pumpFormData.power_consumption && (
                              <div className="bg-white border border-blue-300 rounded-md p-2">
                                <div className="text-xs text-blue-600 mb-1">Power Consumption</div>
                                <div className="text-lg font-semibold text-blue-900">{pumpFormData.power_consumption} <span className="text-xs">kW</span></div>
                              </div>
                            )}
                            {pumpFormData.npsha && (
                              <div className="bg-white border border-blue-300 rounded-md p-2">
                                <div className="text-xs text-blue-600 mb-1">NPSHA</div>
                                <div className="text-lg font-semibold text-blue-900">{pumpFormData.npsha} <span className="text-xs">m</span></div>
                              </div>
                            )}
                            {pumpFormData.npsha_with_safety_margin && (
                              <div className="bg-white border border-blue-300 rounded-md p-2">
                                <div className="text-xs text-blue-600 mb-1">NPSHA (With Safety)</div>
                                <div className="text-lg font-semibold text-blue-900">{pumpFormData.npsha_with_safety_margin} <span className="text-xs">m</span></div>
                              </div>
                            )}
                            {pumpFormData.max_suction_pressure && (
                              <div className="bg-white border border-blue-300 rounded-md p-2">
                                <div className="text-xs text-blue-600 mb-1">Max Suction Pressure</div>
                                <div className="text-lg font-semibold text-blue-900">{pumpFormData.max_suction_pressure} <span className="text-xs">bar(g)</span></div>
                              </div>
                            )}
                            {pumpFormData.mcf_cv_pressure_drop && (
                              <div className="bg-white border border-blue-300 rounded-md p-2">
                                <div className="text-xs text-blue-600 mb-1">MCF CV Pressure Drop</div>
                                <div className="text-lg font-semibold text-blue-900">{pumpFormData.mcf_cv_pressure_drop} <span className="text-xs">bar</span></div>
                              </div>
                            )}
                            {pumpFormData.shut_off_differential_pressure && (
                              <div className="bg-white border border-blue-300 rounded-md p-2">
                                <div className="text-xs text-blue-600 mb-1">Shut Off Diff. Pressure</div>
                                <div className="text-lg font-semibold text-blue-900">{pumpFormData.shut_off_differential_pressure} <span className="text-xs">bar</span></div>
                              </div>
                            )}
                            {pumpFormData.maximum_discharge_pressure_option_1 && (
                              <div className="bg-white border border-blue-300 rounded-md p-2">
                                <div className="text-xs text-blue-600 mb-1">Max Discharge (Option 1)</div>
                                <div className="text-lg font-semibold text-blue-900">{pumpFormData.maximum_discharge_pressure_option_1} <span className="text-xs">bar</span></div>
                              </div>
                            )}
                            {pumpFormData.maximum_discharge_pressure_option_2 && (
                              <div className="bg-white border border-blue-300 rounded-md p-2">
                                <div className="text-xs text-blue-600 mb-1">Max Discharge (Option 2)</div>
                                <div className="text-lg font-semibold text-blue-900">{pumpFormData.maximum_discharge_pressure_option_2} <span className="text-xs">bar</span></div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-sm text-blue-800">
                          <strong>💡 Tip:</strong> Fill in the essential fields (marked with *) to generate a basic datasheet. Expand sections for detailed calculations.
                        </p>
                      </div>
                    </div>
                  ) : (
                    selectedTypeConfig.requiredFiles.map(fileConfig => renderFileUpload(fileConfig))
                  )}

                  {/* Process Documents Button for Non-Pump Types */}
                  {selectedType !== 'pump_hydraulic' && Object.keys(uploadedFiles).length > 0 && !uploading && !analysisStage && (
                    <div className="mt-6">
                      <button
                        onClick={handleUpload}
                        disabled={uploading}
                        className="w-full py-4 px-6 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:from-gray-400 disabled:to-gray-500 text-white rounded-lg font-bold text-lg shadow-lg transform hover:scale-105 transition-all disabled:transform-none disabled:cursor-not-allowed"
                      >
                        <span className="flex items-center justify-center space-x-2">
                          <Zap className="h-6 w-6" />
                          <span> Process Documents</span>
                        </span>
                      </button>
                    </div>
                  )}

                  {/* Error Message */}
                  {error && (
                    <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-3">
                      <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-red-800">{error}</p>
                    </div>
                  )}

                  {/* Show Preview Button First */}
                  {selectedType === 'pump_hydraulic' && !showPreview && (
                    <div className="mt-6">
                      <button
                        onClick={handleUpload}
                        className="w-full py-4 px-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg font-bold text-lg shadow-lg transform hover:scale-105 transition-all"
                      >
                        <span className="flex items-center justify-center space-x-2">
                          <Sparkles className="h-6 w-6" />
                          <span>📊 Generate Preview Table</span>
                        </span>
                      </button>
                    </div>
                  )}

                  {/* FULL DATA PREVIEW TABLE - Shows ALL 10 sections */}
                  {selectedType === 'pump_hydraulic' && showPreview && (
                    <div className="bg-white rounded-lg border-4 border-green-500 shadow-2xl p-6 mb-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-2xl font-bold text-green-900 flex items-center gap-2">
                          <SparklesIcon className="h-8 w-8 text-green-600" />
                          📊 COMPLETE DATA PREVIEW - ALL SECTIONS
                        </h3>
                        <span className="text-sm text-green-700 bg-green-100 px-4 py-2 rounded-full font-bold">✅ Ready to Download</span>
                      </div>

                      <div className="max-h-[600px] overflow-y-auto border-2 border-gray-300 rounded-lg mb-4">
                        <table className="w-full text-sm" id="pumpDataTable">
                          <thead className="bg-gradient-to-r from-green-600 to-emerald-600 text-white sticky top-0">
                            <tr>
                              <th className="px-4 py-3 text-left font-bold border-b-2 border-white">Section</th>
                              <th className="px-4 py-3 text-left font-bold border-b-2 border-white">Field Name</th>
                              <th className="px-4 py-3 text-left font-bold border-b-2 border-white">Value</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {/* PROJECT INFORMATION */}
                            <tr className="bg-gradient-to-r from-blue-100 to-blue-50"><td colSpan="3" className="px-4 py-3 font-bold text-blue-900 text-lg">📋 1. PROJECT INFORMATION</td></tr>
                            <tr><td className="px-4 py-2">1</td><td className="px-4 py-2">Agreement No</td><td className="px-4 py-2 font-semibold">{pumpFormData.agreement_no || 'N/A'}</td></tr>
                            <tr><td className="px-4 py-2">1</td><td className="px-4 py-2">Project No</td><td className="px-4 py-2 font-semibold">{pumpFormData.project_no || 'N/A'}</td></tr>
                            <tr><td className="px-4 py-2">1</td><td className="px-4 py-2">Document No</td><td className="px-4 py-2 font-semibold">{pumpFormData.document_no || 'N/A'}</td></tr>
                            <tr><td className="px-4 py-2">1</td><td className="px-4 py-2">Revision</td><td className="px-4 py-2 font-semibold">{pumpFormData.revision || 'N/A'}</td></tr>
                            <tr><td className="px-4 py-2">1</td><td className="px-4 py-2">Document Class</td><td className="px-4 py-2 font-semibold">{pumpFormData.document_class || 'N/A'}</td></tr>
                            <tr><td className="px-4 py-2">1</td><td className="px-4 py-2">Tag No</td><td className="px-4 py-2 font-semibold">{pumpFormData.tag_no || 'N/A'}</td></tr>
                            <tr><td className="px-4 py-2">1</td><td className="px-4 py-2">Service</td><td className="px-4 py-2 font-semibold">{pumpFormData.service || 'N/A'}</td></tr>
                            <tr><td className="px-4 py-2">1</td><td className="px-4 py-2">Temperature (°C)</td><td className="px-4 py-2 font-semibold">{pumpFormData.temperature || 'N/A'}</td></tr>
                            <tr><td className="px-4 py-2">1</td><td className="px-4 py-2">Fluid Viscosity @ Temp (cP)</td><td className="px-4 py-2 font-semibold">{pumpFormData.fluid_viscosity_at_temp || 'N/A'}</td></tr>
                            <tr><td className="px-4 py-2">1</td><td className="px-4 py-2">HP (Horsepower)</td><td className="px-4 py-2 font-semibold">{pumpFormData.hp || 'N/A'}</td></tr>
                            
                            {/* DISCHARGE PRESSURE CALCULATIONS */}
                            <tr className="bg-gradient-to-r from-purple-100 to-purple-50"><td colSpan="3" className="px-4 py-3 font-bold text-purple-900 text-lg">📐 2. DISCHARGE PRESSURE CALCULATIONS</td></tr>
                            <tr><td className="px-4 py-2">2</td><td className="px-4 py-2">Destination Description</td><td className="px-4 py-2 font-semibold">{pumpFormData.destination_description || 'N/A'}</td></tr>
                            <tr><td className="px-4 py-2">2</td><td className="px-4 py-2">Flow Type</td><td className="px-4 py-2 font-semibold">{pumpFormData.flow_type || 'N/A'}</td></tr>
                            <tr><td className="px-4 py-2">2</td><td className="px-4 py-2">Destination Pressure (bar)</td><td className="px-4 py-2 font-semibold">{pumpFormData.destination_pressure || 'N/A'}</td></tr>
                            <tr><td className="px-4 py-2">2</td><td className="px-4 py-2">Destination Elevation (m)</td><td className="px-4 py-2 font-semibold">{pumpFormData.destination_elevation || 'N/A'}</td></tr>
                            <tr><td className="px-4 py-2">2</td><td className="px-4 py-2">Line Friction Loss (bar)</td><td className="px-4 py-2 font-semibold">{pumpFormData.line_friction_loss || 'N/A'}</td></tr>
                            <tr><td className="px-4 py-2">2</td><td className="px-4 py-2">Flow Meter ΔP (bar)</td><td className="px-4 py-2 font-semibold">{pumpFormData.flow_meter_del_p || 'N/A'}</td></tr>
                            <tr><td className="px-4 py-2">2</td><td className="px-4 py-2">Other Losses (bar)</td><td className="px-4 py-2 font-semibold">{pumpFormData.other_losses || 'N/A'}</td></tr>
                            <tr><td className="px-4 py-2">2</td><td className="px-4 py-2">Control Valve (bar)</td><td className="px-4 py-2 font-semibold">{pumpFormData.control_valve || 'N/A'}</td></tr>
                            <tr><td className="px-4 py-2">2</td><td className="px-4 py-2">Misc Item (bar)</td><td className="px-4 py-2 font-semibold">{pumpFormData.misc_item || 'N/A'}</td></tr>
                            <tr><td className="px-4 py-2">2</td><td className="px-4 py-2">Contingency (bar)</td><td className="px-4 py-2 font-semibold">{pumpFormData.contingency || 'N/A'}</td></tr>
                            <tr className="bg-yellow-50"><td className="px-4 py-2">2</td><td className="px-4 py-2 font-bold">⚡ Total Discharge Pressure (bar)</td><td className="px-4 py-2 font-bold text-green-700">{pumpFormData.total_discharge_pressure || 'N/A'}</td></tr>
                            
                            {/* CONTROL VALVE DELTA P CHECK */}
                            <tr className="bg-gradient-to-r from-teal-100 to-teal-50"><td colSpan="3" className="px-4 py-3 font-bold text-teal-900 text-lg">🔧 3. CONTROL VALVE DELTA P CHECK</td></tr>
                            <tr><td className="px-4 py-2">3</td><td className="px-4 py-2">Density (kg/m³)</td><td className="px-4 py-2 font-semibold">{pumpFormData.density || 'N/A'}</td></tr>
                            <tr><td className="px-4 py-2">3</td><td className="px-4 py-2">CV Max</td><td className="px-4 py-2 font-semibold">{pumpFormData.cv_max || 'N/A'}</td></tr>
                            <tr><td className="px-4 py-2">3</td><td className="px-4 py-2">CV Min</td><td className="px-4 py-2 font-semibold">{pumpFormData.cv_min || 'N/A'}</td></tr>
                            <tr className="bg-yellow-50"><td className="px-4 py-2">3</td><td className="px-4 py-2 font-bold">⚡ CV Ratio</td><td className="px-4 py-2 font-bold text-green-700">{pumpFormData.cv_ratio || 'N/A'}</td></tr>
                            <tr className="bg-yellow-50"><td className="px-4 py-2">3</td><td className="px-4 py-2 font-bold">⚡ CV Pressure Drop (bar)</td><td className="px-4 py-2 font-bold text-green-700">{pumpFormData.cv_pressure_drop || 'N/A'}</td></tr>
                            <tr className="bg-yellow-50"><td className="px-4 py-2">3</td><td className="px-4 py-2 font-bold">⚡ CV Ratio Within Range</td><td className="px-4 py-2 font-bold text-green-700">{pumpFormData.cv_ratio_within_range || 'N/A'}</td></tr>
                            
                            {/* SUCTION PRESSURE CALCULATIONS */}
                            <tr className="bg-gradient-to-r from-orange-100 to-orange-50"><td colSpan="3" className="px-4 py-3 font-bold text-orange-900 text-lg">📉 4. SUCTION PRESSURE CALCULATIONS</td></tr>
                            <tr><td className="px-4 py-2">4</td><td className="px-4 py-2">Source Op. Pressure (bar)</td><td className="px-4 py-2 font-semibold">{pumpFormData.source_op_pressure || 'N/A'}</td></tr>
                            <tr><td className="px-4 py-2">4</td><td className="px-4 py-2">Suction EL (m)</td><td className="px-4 py-2 font-semibold">{pumpFormData.suction_elm || 'N/A'}</td></tr>
                            <tr><td className="px-4 py-2">4</td><td className="px-4 py-2">Inline Inst. Losses (bar)</td><td className="px-4 py-2 font-semibold">{pumpFormData.inline_inst_losses || 'N/A'}</td></tr>
                            <tr><td className="px-4 py-2">4</td><td className="px-4 py-2">Line Fric Losses (bar)</td><td className="px-4 py-2 font-semibold">{pumpFormData.line_fric_losses || 'N/A'}</td></tr>
                            <tr><td className="px-4 py-2">4</td><td className="px-4 py-2">Control Valve (bar)</td><td className="px-4 py-2 font-semibold">{pumpFormData.control_valve_suction || 'N/A'}</td></tr>
                            <tr><td className="px-4 py-2">4</td><td className="px-4 py-2">Misc Items (bar)</td><td className="px-4 py-2 font-semibold">{pumpFormData.misc_items_suction || 'N/A'}</td></tr>
                            <tr className="bg-yellow-50"><td className="px-4 py-2">4</td><td className="px-4 py-2 font-bold">⚡ Total Suction Losses (bar)</td><td className="px-4 py-2 font-bold text-green-700">{pumpFormData.total_suction_losses || 'N/A'}</td></tr>
                            <tr className="bg-yellow-50"><td className="px-4 py-2">4</td><td className="px-4 py-2 font-bold">⚡ Total Suction Pressure (bar)</td><td className="px-4 py-2 font-bold text-green-700">{pumpFormData.total_suction_pressure || 'N/A'}</td></tr>
                            
                            {/* POWER CONSUMPTION */}
                            <tr className="bg-gradient-to-r from-red-100 to-red-50"><td colSpan="3" className="px-4 py-3 font-bold text-red-900 text-lg">⚡ 5. POWER CONSUMPTION PER PUMP</td></tr>
                            <tr><td className="px-4 py-2">5</td><td className="px-4 py-2">Hydraulic Power (kW)</td><td className="px-4 py-2 font-semibold">{pumpFormData.hydraulic_power || 'N/A'}</td></tr>
                            <tr><td className="px-4 py-2">5</td><td className="px-4 py-2">Pump Efficiency (%)</td><td className="px-4 py-2 font-semibold">{pumpFormData.pump_efficiency || 'N/A'}</td></tr>
                            <tr className="bg-yellow-50"><td className="px-4 py-2">5</td><td className="px-4 py-2 font-bold">⚡ Break Horse Power (kW)</td><td className="px-4 py-2 font-bold text-green-700">{pumpFormData.break_horse_power || 'N/A'}</td></tr>
                            <tr><td className="px-4 py-2">5</td><td className="px-4 py-2">Motor Rating (kW)</td><td className="px-4 py-2 font-semibold">{pumpFormData.motor_rating || 'N/A'}</td></tr>
                            <tr><td className="px-4 py-2">5</td><td className="px-4 py-2">Motor Efficiency (%)</td><td className="px-4 py-2 font-semibold">{pumpFormData.motor_efficiency || 'N/A'}</td></tr>
                            <tr className="bg-yellow-50"><td className="px-4 py-2">5</td><td className="px-4 py-2 font-bold">⚡ Power Consumption (kW)</td><td className="px-4 py-2 font-bold text-green-700">{pumpFormData.power_consumption || 'N/A'}</td></tr>
                            <tr><td className="px-4 py-2">5</td><td className="px-4 py-2">Type of Motor</td><td className="px-4 py-2 font-semibold">{pumpFormData.type_of_motor || 'N/A'}</td></tr>
                            
                            {/* NPSH AVAILABILITY */}
                            <tr className="bg-gradient-to-r from-cyan-100 to-cyan-50"><td colSpan="3" className="px-4 py-3 font-bold text-cyan-900 text-lg">💧 6. NPSH AVAILABILITY</td></tr>
                            <tr><td className="px-4 py-2">6</td><td className="px-4 py-2">Suction Pressure (bar)</td><td className="px-4 py-2 font-semibold">{pumpFormData.suction_pressure_npsh || 'N/A'}</td></tr>
                            <tr><td className="px-4 py-2">6</td><td className="px-4 py-2">Vapor Pressure (bar)</td><td className="px-4 py-2 font-semibold">{pumpFormData.vapor_pressure || 'N/A'}</td></tr>
                            <tr className="bg-yellow-50"><td className="px-4 py-2">6</td><td className="px-4 py-2 font-bold">⚡ NPSHA (m)</td><td className="px-4 py-2 font-bold text-green-700">{pumpFormData.npsha || 'N/A'}</td></tr>
                            <tr><td className="px-4 py-2">6</td><td className="px-4 py-2">Safety Margin (%)</td><td className="px-4 py-2 font-semibold">{pumpFormData.safety_margin_npsha || 'N/A'}</td></tr>
                            <tr className="bg-yellow-50"><td className="px-4 py-2">6</td><td className="px-4 py-2 font-bold">⚡ NPSHA with Safety Margin (m)</td><td className="px-4 py-2 font-bold text-green-700">{pumpFormData.npsha_with_safety_margin || 'N/A'}</td></tr>
                            
                            {/* PUMP CALCULATION RESULTS */}
                            <tr className="bg-gradient-to-r from-blue-200 to-blue-100"><td colSpan="3" className="px-4 py-3 font-bold text-blue-900 text-lg">🔵 7. PUMP CALCULATION RESULTS</td></tr>
                            <tr className="bg-yellow-50"><td className="px-4 py-2">7</td><td className="px-4 py-2 font-bold">⚡ Discharge Pressure (bar)</td><td className="px-4 py-2 font-bold text-blue-700">{pumpFormData.discharge_pressure || 'N/A'}</td></tr>
                            <tr className="bg-yellow-50"><td className="px-4 py-2">7</td><td className="px-4 py-2 font-bold">⚡ Suction Pressure (bar)</td><td className="px-4 py-2 font-bold text-blue-700">{pumpFormData.suction_pressure_result || 'N/A'}</td></tr>
                            <tr className="bg-yellow-50"><td className="px-4 py-2">7</td><td className="px-4 py-2 font-bold">⚡ Differential Pressure (bar)</td><td className="px-4 py-2 font-bold text-blue-700">{pumpFormData.differential_pressure || 'N/A'}</td></tr>
                            <tr className="bg-yellow-50"><td className="px-4 py-2">7</td><td className="px-4 py-2 font-bold">⚡ Differential Head (m)</td><td className="px-4 py-2 font-bold text-blue-700">{pumpFormData.differential_head || 'N/A'}</td></tr>
                            <tr className="bg-yellow-50"><td className="px-4 py-2">7</td><td className="px-4 py-2 font-bold">⚡ NPSHA (m)</td><td className="px-4 py-2 font-bold text-blue-700">{pumpFormData.npsha_result || 'N/A'}</td></tr>
                            
                            {/* MAXIMUM SUCTION PRESSURE */}
                            <tr className="bg-gradient-to-r from-emerald-200 to-emerald-100"><td colSpan="3" className="px-4 py-3 font-bold text-emerald-900 text-lg">🟢 8. MAXIMUM SUCTION PRESSURE</td></tr>
                            <tr><td className="px-4 py-2">8</td><td className="px-4 py-2">Suction Vessel Max Op. Pressure (bar)</td><td className="px-4 py-2 font-semibold text-emerald-700">{pumpFormData.suction_vessel_max_op_pressure || 'N/A'}</td></tr>
                            <tr><td className="px-4 py-2">8</td><td className="px-4 py-2">Suction EL from Pump C/L Max (m)</td><td className="px-4 py-2 font-semibold text-emerald-700">{pumpFormData.suction_el_m || 'N/A'}</td></tr>
                            <tr><td className="px-4 py-2">8</td><td className="px-4 py-2">TL to HHLL (m)</td><td className="px-4 py-2 font-semibold text-emerald-700">{pumpFormData.tl_to_hhll_m || 'N/A'}</td></tr>
                            <tr className="bg-yellow-50"><td className="px-4 py-2">8</td><td className="px-4 py-2 font-bold">⚡ Max Suction Pressure (bar)</td><td className="px-4 py-2 font-bold text-emerald-700">{pumpFormData.max_suction_pressure || 'N/A'}</td></tr>
                            
                            {/* MINIMUM FLOW CONDITIONS */}
                            <tr className="bg-gradient-to-r from-indigo-200 to-indigo-100"><td colSpan="3" className="px-4 py-3 font-bold text-indigo-900 text-lg">🟣 9. MINIMUM FLOW CONDITIONS</td></tr>
                            <tr><td className="px-4 py-2">9</td><td className="px-4 py-2">Pump Minimum Flow (m³/h)</td><td className="px-4 py-2 font-semibold text-indigo-700">{pumpFormData.pump_minimum_flow || 'N/A'}</td></tr>
                            <tr><td className="px-4 py-2">9</td><td className="px-4 py-2">Fluid Density MCF (kg/m³)</td><td className="px-4 py-2 font-semibold text-indigo-700">{pumpFormData.fluid_density_mcf || 'N/A'}</td></tr>
                            <tr><td className="px-4 py-2">9</td><td className="px-4 py-2">Pump Discharge Pressure Min Flow (bar)</td><td className="px-4 py-2 font-semibold text-indigo-700">{pumpFormData.pump_discharge_pressure_min_flow || 'N/A'}</td></tr>
                            <tr><td className="px-4 py-2">9</td><td className="px-4 py-2">Destination Pressure MCF (bar)</td><td className="px-4 py-2 font-semibold text-indigo-700">{pumpFormData.destination_pressure || 'N/A'}</td></tr>
                            <tr><td className="px-4 py-2">9</td><td className="px-4 py-2">EL Destination Pump C/L (m)</td><td className="px-4 py-2 font-semibold text-indigo-700">{pumpFormData.el_destination_pump_cl || 'N/A'}</td></tr>
                            <tr><td className="px-4 py-2">9</td><td className="px-4 py-2">MCF Line Friction Losses (bar)</td><td className="px-4 py-2 font-semibold text-indigo-700">{pumpFormData.mcf_line_friction_losses || 'N/A'}</td></tr>
                            <tr><td className="px-4 py-2">9</td><td className="px-4 py-2">Flow Meter Losses (bar)</td><td className="px-4 py-2 font-semibold text-indigo-700">{pumpFormData.flow_meter_losses || 'N/A'}</td></tr>
                            <tr><td className="px-4 py-2">9</td><td className="px-4 py-2">Misc Pressure Drop MCF (bar)</td><td className="px-4 py-2 font-semibold text-indigo-700">{pumpFormData.misc_pressure_drop_mcf || 'N/A'}</td></tr>
                            <tr className="bg-yellow-50"><td className="px-4 py-2">9</td><td className="px-4 py-2 font-bold">⚡ MCF CV Pressure Drop (bar)</td><td className="px-4 py-2 font-bold text-indigo-700">{pumpFormData.mcf_cv_pressure_drop || 'N/A'}</td></tr>
                            
                            {/* MAXIMUM DISCHARGE PRESSURE */}
                            <tr className="bg-gradient-to-r from-pink-200 to-pink-100"><td colSpan="3" className="px-4 py-3 font-bold text-pink-900 text-lg">🔴 10. MAXIMUM DISCHARGE PRESSURE</td></tr>
                            <tr><td className="px-4 py-2">10</td><td className="px-4 py-2">API610 Tolerance Used</td><td className="px-4 py-2 font-semibold text-pink-700">{pumpFormData.api_610_tolerance_used || 'N/A'}</td></tr>
                            <tr><td className="px-4 py-2">10</td><td className="px-4 py-2">API Tolerance Factor</td><td className="px-4 py-2 font-semibold text-pink-700">{pumpFormData.api_tolerance_factor || 'N/A'}</td></tr>
                            <tr><td className="px-4 py-2">10</td><td className="px-4 py-2">Shut Off Pressure Factor</td><td className="px-4 py-2 font-semibold text-pink-700">{pumpFormData.shut_off_pressure_factor || 'N/A'}</td></tr>
                            <tr className="bg-yellow-50"><td className="px-4 py-2">10</td><td className="px-4 py-2 font-bold">⚡ Shut Off Differential Pressure (bar)</td><td className="px-4 py-2 font-bold text-pink-700">{pumpFormData.shut_off_differential_pressure || 'N/A'}</td></tr>
                            <tr className="bg-yellow-50"><td className="px-4 py-2">10</td><td className="px-4 py-2 font-bold">⚡ Max Discharge Pressure Option 1 (bar)</td><td className="px-4 py-2 font-bold text-pink-700">{pumpFormData.maximum_discharge_pressure_option_1 || 'N/A'}</td></tr>
                            <tr className="bg-yellow-50"><td className="px-4 py-2">10</td><td className="px-4 py-2 font-bold">⚡ Max Discharge Pressure Option 2 (bar)</td><td className="px-4 py-2 font-bold text-pink-700">{pumpFormData.maximum_discharge_pressure_option_2 || 'N/A'}</td></tr>
                          </tbody>
                        </table>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <button
                          onClick={downloadTableAsExcel}
                          className="flex-1 py-4 px-6 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-lg font-bold text-lg shadow-xl transform hover:scale-105 transition-all"
                        >
                          <span className="flex items-center justify-center space-x-3">
                            <Download className="h-6 w-6" />
                            <span>📥 DOWNLOAD EXCEL FILE</span>
                          </span>
                        </button>
                        <button
                          onClick={() => setShowPreview(false)}
                          className="px-6 py-4 border-2 border-gray-400 rounded-lg font-medium text-gray-700 hover:bg-gray-100 transition-colors"
                        >
                          Close Preview
                        </button>
                      </div>
                      
                      <div className="mt-4 p-4 bg-green-50 border-2 border-green-300 rounded-lg">
                        <p className="text-sm text-green-900 font-semibold">
                          ✅ <strong>COMPLETE PREVIEW:</strong> This table shows ALL 10 sections with {Object.keys(pumpFormData).length} total fields. 
                          The ⚡ symbol indicates auto-calculated fields. Click "DOWNLOAD EXCEL FILE" to get your datasheet instantly!
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Error/Success Messages */}
                  {error && (
                    <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                      <AlertCircle className="h-5 w-5 inline mr-2" />
                      {error}
                    </div>
                  )}
                  {success && (
                    <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
                      <CheckCircle className="h-5 w-5 inline mr-2" />
                      {success}
                    </div>
                  )}
                  
                  <div className="mt-6 flex space-x-3">
                    <button
                      onClick={handleReset}
                      className="px-6 py-3 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      Reset
                    </button>
                  </div>

                  {/* Progress */}
                  {uploading && (
                    <div className="mt-6">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">{analysisStage}</span>
                        <span className="text-sm text-gray-500">{uploadProgress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-gradient-to-r from-purple-600 to-pink-600 h-2 rounded-full transition-all duration-500"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right Column - Info */}
            <div className="space-y-6">
              <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl shadow-sm border border-purple-200 p-6">
                <div className="flex items-center space-x-2 mb-4">
                  <Sparkles className="h-5 w-5 text-purple-600" />
                  <h3 className="font-semibold text-gray-900">How It Works</h3>
                </div>
                <ol className="space-y-3 text-sm text-gray-700">
                  <li className="flex items-start space-x-2">
                    <span className="font-bold text-purple-600">1.</span>
                    <span>Select the type of datasheet you want to generate</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="font-bold text-purple-600">2.</span>
                    <span>Upload the required documents for that type</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="font-bold text-purple-600">3.</span>
                    <span>AI processes your documents automatically</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="font-bold text-purple-600">4.</span>
                    <span>Download your completed datasheet</span>
                  </li>
                </ol>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="font-semibold text-gray-900 mb-4">File Requirements</h3>
                <ul className="space-y-2 text-sm text-gray-700">
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span>PDF format only</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span>Maximum size: 50MB per file</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span>Clear, readable drawings</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span>Standard engineering formats</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        ) : (
          /* Success Result */
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Success Header */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  Datasheet Generated Successfully!
                </h2>
                <p className="text-gray-600">
                  Your {selectedTypeConfig.name} datasheet is ready
                </p>
              </div>

              {/* Result Summary */}
              <div className="bg-gray-50 rounded-lg p-6 mb-6">
                <h3 className="font-semibold text-gray-900 mb-4">Generation Summary</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Datasheet Type</p>
                    <p className="font-medium text-gray-900">{selectedTypeConfig.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Status</p>
                    <p className="font-medium text-green-600">Completed</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Files Processed</p>
                    <p className="font-medium text-gray-900">{Object.keys(uploadedFiles).length}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Success Rate</p>
                    <p className="font-medium text-gray-900">
                      {uploadResult?.summary?.successful || 0}/{uploadResult?.summary?.total_attempted || 0}
                    </p>
                  </div>
                </div>

                {uploadResult?.generated_types && uploadResult.generated_types.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm text-gray-500 mb-2">Generated Datasheets:</p>
                    <div className="flex flex-wrap gap-2">
                      {uploadResult.generated_types.map((type, idx) => (
                        <span
                          key={idx}
                          className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium"
                        >
                          {type}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Download Button */}
              {excelData && (
                <div className="flex justify-center mb-6">
                  <button
                    onClick={handleDownloadExcel}
                    className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg font-medium hover:from-green-700 hover:to-emerald-700 transition-colors shadow-lg"
                  >
                    <Download className="h-5 w-5" />
                    <span>Download {selectedTypeConfig.name} Datasheet</span>
                  </button>
                </div>
              )}

              {/* Actions */}
              <div className="flex space-x-3">
                <button
                  onClick={handleReset}
                  className="flex-1 py-3 px-6 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-medium hover:from-purple-700 hover:to-pink-700 transition-colors"
                >
                  Generate Another
                </button>
                <button
                  onClick={() => navigate('/engineering/process/datasheet')}
                  className="px-6 py-3 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Back to Dashboard
                </button>
              </div>
            </div>

            {/* HTML Preview Table */}
            {htmlPreview && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                  <FileText className="h-5 w-5 text-purple-600" />
                  <span>Datasheet Preview</span>
                </h3>
                <div className="overflow-x-auto border border-gray-200 rounded-lg">
                  <div dangerouslySetInnerHTML={{ __html: htmlPreview }} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SmartDatasheetPage;



