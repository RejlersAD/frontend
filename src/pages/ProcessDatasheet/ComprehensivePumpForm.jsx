/**
 * Comprehensive Pump Hydraulic Calculation Form
 * AI-Powered Data Entry with complete field coverage from actual pump data sheet
 * Soft-coded with intelligent field grouping and validation
 * 🎯 Enhanced with intelligent field recommendations based on historical data
 */

import React, { useState, useEffect } from 'react';
import { 
  DocumentTextIcon, 
  BeakerIcon, 
  ChartBarIcon,
  CogIcon,
  CloudIcon,
  LightBulbIcon,
  ArrowUpTrayIcon,
  SparklesIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import apiClient from '../../services/api.service';
import { MOTOR_CLASSIFICATIONS } from '../../constants/motorClassifications';
import { useFieldRecommendations } from '../../hooks/useFieldRecommendations';
import { 
  AutoFillButton, 
  NumericSuggestion, 
  SmartCombinationHint,
  RecommendationContext,
  InlineSuggestion
} from '../../components/FieldSuggestions/FieldSuggestions';

// Soft-coded configuration for form fields
const FORM_SECTIONS = {
  PROJECT_INFO: {
    title: 'Project Information',
    icon: DocumentTextIcon,
    color: 'blue',
    fields: [
      { name: 'agreementNo', label: 'Agreement No', type: 'text', required: true },
      { name: 'projectNo', label: 'Project No.', type: 'text', required: true },
      { name: 'documentNo', label: 'Document No.', type: 'text', required: true },
      { name: 'revision', label: 'Revision', type: 'text', required: true },
      { name: 'documentClass', label: 'Document Class', type: 'select', options: ['Confidential', 'Internal', 'Public', 'Restricted'], required: true },
      { name: 'tagNo', label: 'Tag No.', type: 'text', required: true },
      { name: 'service', label: 'Service', type: 'text', required: true },
      { name: 'motorClassification', label: 'Motor Classification', type: 'select', options: MOTOR_CLASSIFICATIONS, required: true },
      { name: 'temperature', label: 'Temperature', type: 'number', unit: '°C', required: true },
      { name: 'fluidViscosityAtTemp', label: 'Fluid Viscosity @ Temp', type: 'number', unit: 'cP', required: true },
      { name: 'hp', label: 'HP (Horsepower)', type: 'number', unit: 'HP', required: true },
      { name: 'pumpCenterlineElevation', label: 'Pump Central Line Elevation From Grade', type: 'number', unit: 'm', required: true },
      { name: 'elevationSourceBTL', label: 'Elevation of Source BTL From Pump Central Line', type: 'number', unit: 'm', required: true },
    ]
  },
  
  GENERAL_INFO: {
    title: 'Discharge Pressure Calculations',
    icon: CogIcon,
    color: 'indigo',
    fields: [
      { name: 'destinationDescription', label: 'Destination Description', type: 'text', default: 'Cooling Water Tank (06.5- T - 2307)', required: true },
      { name: 'flow', label: 'Flow', type: 'select', options: ['Max', 'Normal', 'Min'], required: true },
      { name: 'destinationPressure', label: 'Destination Pressure', type: 'number', unit: 'barg', required: true },
      { name: 'destinationElevation', label: 'Destination EL from Pump C/L', type: 'number', unit: 'm', required: true },
      { name: 'lineFrictionLoss', label: 'Line Friction Loss', type: 'number', unit: 'bar', required: true },
      { name: 'flowMeterDelP', label: 'Flow meter Del P', type: 'number', unit: 'bar', required: true },
      { name: 'otherLosses', label: 'Other Losses', type: 'number', unit: 'bar', required: false },
      { name: 'controlValve', label: 'Control Valve', type: 'number', unit: 'bar', required: false },
      { name: 'miscItem', label: 'Misc Item', type: 'number', unit: 'bar', required: false },
      { name: 'contingency', label: 'Contingency', type: 'number', unit: 'bar', required: false },
      { name: 'totalDischargePressure', label: 'Total Discharge Pressure', type: 'number', unit: 'bar', calculated: true, required: false },
    ]
  },
  
  CONTROL_VALVE_DELTA_P: {
    title: 'Control Valve Delta P Check',
    icon: BeakerIcon,
    color: 'cyan',
    fields: [
      { name: 'density', label: 'Density', type: 'number', unit: 'kg/m³', required: true },
      { name: 'cvMax', label: 'CV Max', type: 'number', unit: '', required: true },
      { name: 'cvMin', label: 'CV Min', type: 'number', unit: '', required: true },
      { name: 'cvRatio', label: 'CVRatio (Max/Min)', type: 'number', unit: '', calculated: true, required: false },
      { name: 'totalFrictionalLosses', label: 'Total Frictional Losses @ Normal Flow', type: 'number', unit: 'bar', required: true },
      { name: 'dynamicLosses30Percent', label: '30% Dynamic Losses', type: 'number', unit: 'bar', calculated: true, required: false },
      { name: 'cvPressureDrop', label: 'CV Pr. drop @ Normal Flow', type: 'number', unit: 'bar', required: true },
      { name: 'cvRangeability', label: 'CV Rangeability', type: 'number', unit: '', required: true },
      { name: 'cvRatioWithinRange', label: 'A. CV Ratio Within Range', type: 'select', options: ['Yes', 'No'], required: false },
      { name: 'cvPressureDropCheck', label: 'B. CV Pr. drop@Normal Flow > 30% Fric Pr. Loss', type: 'select', options: ['Yes', 'No'], required: false },
    ]
  },
  
  SUCTION_PRESSURE_CALCULATIONS: {
    title: 'Suction Pressure Calculations',
    icon: ChartBarIcon,
    color: 'green',
    fields: [
      { name: 'sourceOpPressure', label: 'Source Op. Pressure', type: 'number', unit: 'bar(g)', required: true },
      { name: 'suctionELm', label: 'Suction ELm', type: 'number', unit: 'm', required: true },
      { name: 'inlineInstLosses', label: 'Inline Inst. Losses', type: 'number', unit: 'bar', required: true },
      { name: 'lineFricLosses', label: 'Line Fric Losses', type: 'number', unit: 'bar', required: true },
      { name: 'controlValveSuction', label: 'Control Valve', type: 'number', unit: 'bar', required: true },
      { name: 'miscItemsSuction', label: 'Misc Items', type: 'number', unit: 'bar', required: true },
      { name: 'totalSuctionLosses', label: 'Total Suction Losses', type: 'number', unit: 'bar', calculated: true, required: false },
      { name: 'totalSuctionPressure', label: 'Total Suction Pressure', type: 'number', unit: 'bar(g)', calculated: true, required: false },
    ]
  },
  
  POWER_CONSUMPTION_PER_PUMP: {
    title: 'Power Consumption Per Pump',
    icon: CogIcon,
    color: 'purple',
    fields: [
      { name: 'hydraulicPower', label: 'Hydraulic Power', type: 'number', unit: 'kW', required: true },
      { name: 'pumpEfficiency', label: 'Pump Efficiency', type: 'number', unit: '%', required: true },
      { name: 'breakHorsePower', label: 'Break Horse Power', type: 'number', unit: 'kW', calculated: true, required: false },
      { name: 'motorRating', label: 'Motor Rating', type: 'number', unit: 'kW', required: true },
      { name: 'motorEfficiency', label: 'Motor Efficiency', type: 'number', unit: '%', required: true },
      { name: 'powerConsumption', label: 'Power Consumption', type: 'number', unit: 'kW', calculated: true, required: false },
      { name: 'typeOfMotor', label: 'Type of Motor', type: 'select', options: ['AC Induction', 'VFD', 'Synchronous', 'DC Motor'], required: true },
    ]
  },
  
  NPSH_AVAILABILITY: {
    title: 'NPSH (Net Positive Suction Head) AVAILABILITY',
    icon: CloudIcon,
    color: 'teal',
    fields: [
      { name: 'suctionPressureNpsh', label: 'Suction Pressure', type: 'number', unit: 'bar(g)', required: true },
      { name: 'vaporPressure', label: 'Vapor Pressure', type: 'number', unit: 'bar(g)', required: true },
      { name: 'npsha', label: 'NPSHA', type: 'number', unit: 'm', calculated: true, required: false },
      { name: 'safetyMarginNpsha', label: 'Safety Margin for NPSHA', type: 'number', unit: 'm', required: true },
      { name: 'npshaWithSafetyMargin', label: 'NPSHA (With Safety Margin)', type: 'number', unit: 'm', calculated: true, required: false },
    ]
  },
  
  PUMP_CALCULATION_RESULTS: {
    title: 'Pump Calculation Results',
    icon: LightBulbIcon,
    color: 'yellow',
    fields: [
      { name: 'dischargePressure', label: 'Discharge Pressure', type: 'number', unit: 'bar(g)', calculated: true, required: false },
      { name: 'suctionPressureResult', label: 'Suction Pressure', type: 'number', unit: 'bar(g)', calculated: true, required: false },
      { name: 'differentialPressure', label: 'Differential Pressure', type: 'number', unit: 'bar', calculated: true, required: false },
      { name: 'differentialHead', label: 'Differential Head', type: 'number', unit: 'm', calculated: true, required: false },
      { name: 'npshaResult', label: 'NPSHA', type: 'number', unit: 'm', calculated: true, required: false },
    ]
  },
  
  MAX_SUCTION_PRESSURE: {
    title: 'Max Suction Pressure Max Density',
    icon: BeakerIcon,
    color: 'emerald',
    fields: [
      { name: 'suctionVesselMaxOpPressure', label: 'Suction Vessel Max Op. Pressure', type: 'number', unit: 'bar(g)', required: false },
      { name: 'suctionElM', label: 'Suction EL,m', type: 'number', unit: 'm', required: false },
      { name: 'tlToHhllM', label: 'TL to HHLL, m', type: 'number', unit: 'm', required: false },
      { name: 'maxSuctionPressure', label: 'Max Suction Pressure', type: 'number', unit: 'bar(g)', calculated: true, required: false },
    ]
  },
  
  MCF_CALCULATION: {
    title: 'Minimum Flow Line Control Valve Calculation',
    icon: CogIcon,
    color: 'purple',
    fields: [
      { name: 'pumpMinimumFlow', label: 'Pump Minimum Flow', type: 'number', unit: 'm³/hr', required: false },
      { name: 'fluidDensityMcf', label: 'Fluid Density', type: 'number', unit: 'kg/m³', required: false },
      { name: 'pumpDischargePressureMinFlow', label: 'Pump Discharge Pressure at Min Flow', type: 'number', unit: 'bar(g)', required: false },
      { name: 'destinationPressure', label: 'Destination Pressure', type: 'number', unit: 'bar(g)', required: false },
      { name: 'elDestinationPumpCl', label: 'EL of Destination from Pump C/L', type: 'number', unit: 'm', required: false },
      { name: 'mcfLineFrictionLosses', label: 'MCF Line Friction Losses', type: 'number', unit: 'bar', required: false },
      { name: 'flowMeterLosses', label: 'Flow Meter Losses', type: 'number', unit: 'bar', required: false },
      { name: 'miscPressureDropMcf', label: 'Misc. Pressure Drop', type: 'number', unit: 'bar', required: false },
      { name: 'mcfCvPressureDrop', label: 'MCF CV Pressure Drop', type: 'number', unit: 'bar', calculated: true, required: false },
    ]
  },
  
  MAX_DISCHARGE_PRESSURE: {
    title: 'Max Discharge Pressure at Max Density',
    icon: ChartBarIcon,
    color: 'teal',
    fields: [
      { name: 'api610ToleranceUsed', label: 'API 610 Tolerance used', type: 'text', required: false },
      { name: 'apiToleranceFactor', label: 'API Tolerance factor', type: 'number', required: false },
      { name: 'shutOffPressureFactor', label: 'Shut off pressure factor', type: 'number', required: false },
      { name: 'shutOffDifferentialPressure', label: 'Shut off Differential Pressure', type: 'number', unit: 'bar', calculated: true, required: false },
    ]
  },
  
  MAX_DISCHARGE_PRESSURE_OPTIONS: {
    title: 'Option for Max Discharge Pressure',
    icon: ExclamationTriangleIcon,
    color: 'cyan',
    fields: [
      { name: 'maximumDischargePressureOption1', label: 'Maximum Discharge Pressure (Option 1)', type: 'number', unit: 'bar', calculated: true, required: false },
      { name: 'maximumDischargePressureOption2', label: 'Maximum Discharge Pressure (Option 2)', type: 'number', unit: 'bar', calculated: true, required: false },
    ],
    notes: [
      {
        title: 'Option 1',
        calculations: [
          'Maximum Discharge Pressure 1 = Maximum Suction Pressure + Rated Differential Pressure',
          'Maximum Discharge Pressure 2 = Suction Vessel Optg. Pressure + Maximum Suction Elevation Head + Shut off Diff. Pressure'
        ]
      },
      {
        title: 'Option 2',
        calculations: [
          'Maximum Discharge Pressure = Maximum Suction Pressure + Shut off Differential Pressure'
        ]
      }
    ]
  }
};

// Soft-coded color schemes
const COLOR_SCHEMES = {
  blue: 'from-blue-500 to-blue-600',
  indigo: 'from-indigo-500 to-indigo-600',
  cyan: 'from-cyan-500 to-cyan-600',
  green: 'from-green-500 to-green-600',
  purple: 'from-purple-500 to-purple-600',
  teal: 'from-teal-500 to-teal-600',
  yellow: 'from-yellow-500 to-yellow-600',
  emerald: 'from-emerald-500 to-emerald-600'
};

const ComprehensivePumpForm = () => {
  const [formData, setFormData] = useState({});
  const [isAIMode, setIsAIMode] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null); // null, 'success', 'error'
  const [errorMessage, setErrorMessage] = useState('');
  const [isGeneratingDatasheet, setIsGeneratingDatasheet] = useState(false);
  const [datasheetStatus, setDatasheetStatus] = useState(null); // null, 'success', 'error'
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfStatus, setPdfStatus] = useState(null); // null, 'success', 'error'
  const [savedPumpId, setSavedPumpId] = useState(null); // Store saved pump calculation ID for Excel/PDF generation
  const [showSuccessModal, setShowSuccessModal] = useState(false); // Show success actions modal
  
  // 🎯 Initialize field recommendations hook
  const {
    recommendations,
    loading: recommendationsLoading,
    isReady: recommendationsReady,
    stats: recommendationStats,
    getSuggestionsForField,
    getNumericSuggestion,
    autoFillForm,
    getMotorEfficiencySuggestion,
    fetchRecommendations
  } = useFieldRecommendations(formData, {
    autoFetch: true,
    context: {
      project_no: formData.projectNo,
      limit: 5
    },
    onRecommendationsLoaded: (data) => {
      console.log('✨ Recommendations ready:', data.context);
    }
  });

  // 🧠 Smart auto-fill handler
  const handleAutoFill = () => {
    console.log('✨ Initiating smart auto-fill');
    
    const fieldsToFill = [
      // Project info fields
      'revision', 'documentClass', 'fluidViscosityAtTemp',
      // Power fields
      'pumpEfficiency', 'motorEfficiency',
      // Safety
      'safetyMarginNpsha',
      // Common numeric defaults
      'temperature', 'density'
    ];
    
    autoFillForm(fieldsToFill, setFormData);
  };

  // 🧠 Smart motor efficiency suggestion when classification changes
  useEffect(() => {
    if (formData.motorClassification && recommendationsReady) {
      const suggestedEfficiency = getMotorEfficiencySuggestion(formData.motorClassification);
      
      if (suggestedEfficiency && !formData.motorEfficiency) {
        console.log(`💡 Suggesting motor efficiency: ${suggestedEfficiency}% for ${formData.motorClassification}`);
        // Don't auto-apply, just show hint
      }
    }
  }, [formData.motorClassification, recommendationsReady]);
  
  // Pump Calculation Results Function
  const calculatePumpResults = (formData) => {
    // 1. Discharge Pressure = Total Discharge Pressure (from discharge calculations)
    const totalDischargePressure = parseFloat(formData.totalDischargePressure) || 0;
    if (totalDischargePressure > 0) {
      formData.dischargePressure = totalDischargePressure.toFixed(2);
    }
    
    // 2. Suction Pressure = Source Operating Pressure - Static Suction Head - Suction Losses
    const sourceOpPressure = parseFloat(formData.sourceOpPressure) || 0;
    const suctionELm = parseFloat(formData.suctionELm) || 0;
    const totalSuctionLosses = parseFloat(formData.totalSuctionLosses) || 0;
    
    if (sourceOpPressure > 0) {
      // Convert static head from meters to pressure (assuming water: 1m = 0.0981 bar)
      const staticHeadPressure = suctionELm * 0.0981;
      const suctionPressure = sourceOpPressure - staticHeadPressure - totalSuctionLosses;
      formData.suctionPressureResult = Math.max(0, suctionPressure).toFixed(3);
    }
    
    // 3. Differential Pressure = Discharge Pressure - Suction Pressure
    const dischargePressure = parseFloat(formData.dischargePressure) || 0;
    const suctionPressureResult = parseFloat(formData.suctionPressureResult) || 0;
    
    if (dischargePressure > 0 && suctionPressureResult >= 0) {
      const differentialPressure = dischargePressure - suctionPressureResult;
      formData.differentialPressure = differentialPressure.toFixed(3);
    }
    
    // 4. Differential Head = Differential Pressure / (density * g) 
    // Converting pressure to head: Head(m) = Pressure(bar) * 10.197 (for water)
    const differentialPressure = parseFloat(formData.differentialPressure) || 0;
    if (differentialPressure > 0) {
      const differentialHead = differentialPressure * 10.197; // Conversion factor for water
      formData.differentialHead = differentialHead.toFixed(2);
    }
    
    // 5. NPSHA Result = NPSHA calculated value (from NPSH Availability section)
    const npsha = parseFloat(formData.npsha) || 0;
    if (npsha > 0) {
      formData.npshaResult = npsha.toFixed(3);
    }
    
    // 6. Max Suction Pressure Calculation (New Section)
    calculateMaxSuctionPressure(formData);
  };
  
  // Max Suction Pressure Calculation Function
  const calculateMaxSuctionPressure = (formData) => {
    const suctionVesselMaxOpPressure = parseFloat(formData.suctionVesselMaxOpPressure) || 0;
    const suctionElM = parseFloat(formData.suctionElM) || 0;
    const tlToHhllM = parseFloat(formData.tlToHhllM) || 0;
    
    // Max Suction Pressure = Suction Vessel Max Op. Pressure + TL to HHLL head - Static suction head
    if (suctionVesselMaxOpPressure > 0) {
      // Convert heights to pressure (1m = 0.0981 bar for water)
      const tlToHhllPressure = tlToHhllM * 0.0981;
      const suctionStaticHead = suctionElM * 0.0981;
      
      const maxSuctionPressure = suctionVesselMaxOpPressure + tlToHhllPressure - suctionStaticHead;
      formData.maxSuctionPressure = Math.max(0, maxSuctionPressure).toFixed(3);
    }
  };
  
  // MCF Control Valve Pressure Drop Calculation Function
  const calculateMcfCvPressureDrop = (formData) => {
    const pumpDischargePressureMinFlow = parseFloat(formData.pumpDischargePressureMinFlow) || 0;
    const destinationPressure = parseFloat(formData.destinationPressure) || 0;
    const elDestinationPumpCl = parseFloat(formData.elDestinationPumpCl) || 0;
    const mcfLineFrictionLosses = parseFloat(formData.mcfLineFrictionLosses) || 0;
    const flowMeterLosses = parseFloat(formData.flowMeterLosses) || 0;
    const miscPressureDropMcf = parseFloat(formData.miscPressureDropMcf) || 0;
    const fluidDensityMcf = parseFloat(formData.fluidDensityMcf) || 1000; // Default to water density
    
    // MCF CV Pressure Drop = Pump Discharge Pressure - Destination Pressure - Elevation Head - All Losses
    if (pumpDischargePressureMinFlow > 0) {
      // Calculate elevation head (positive = destination higher than pump)
      // Using specific gravity relative to water (SG = density/1000)
      const specificGravity = fluidDensityMcf / 1000;
      const elevationHead = elDestinationPumpCl * specificGravity * 0.0981;
      
      const mcfCvPressureDrop = pumpDischargePressureMinFlow 
                                - destinationPressure 
                                - elevationHead 
                                - mcfLineFrictionLosses 
                                - flowMeterLosses 
                                - miscPressureDropMcf;
      
      formData.mcfCvPressureDrop = Math.max(0, mcfCvPressureDrop).toFixed(3);
    }
  };
  
  // Max Discharge Pressure Calculation Function
  const calculateShutOffDifferentialPressure = (formData) => {
    const apiToleranceFactor = parseFloat(formData.apiToleranceFactor) || 1.0;
    const shutOffPressureFactor = parseFloat(formData.shutOffPressureFactor) || 1.0;
    const differentialPressure = parseFloat(formData.differentialPressure) || 0;
    
    // Shut off Differential Pressure = Differential Pressure × API Tolerance Factor × Shut off Pressure Factor
    if (differentialPressure > 0 && apiToleranceFactor > 0 && shutOffPressureFactor > 0) {
      const shutOffDifferentialPressure = differentialPressure * apiToleranceFactor * shutOffPressureFactor;
      formData.shutOffDifferentialPressure = shutOffDifferentialPressure.toFixed(3);
    }
  };
  
  // Maximum Discharge Pressure Options Calculation Function
  const calculateMaxDischargePressureOptions = (formData) => {
    const maxSuctionPressure = parseFloat(formData.maxSuctionPressure) || 0;
    const differentialPressure = parseFloat(formData.differentialPressure) || 0;
    const shutOffDifferentialPressure = parseFloat(formData.shutOffDifferentialPressure) || 0;
    const suctionVesselMaxOpPressure = parseFloat(formData.suctionVesselMaxOpPressure) || 0;
    const suctionElM = parseFloat(formData.suctionElM) || 0;
    
    // Option 1: Maximum Discharge Pressure = Maximum Suction Pressure + Rated Differential Pressure
    if (maxSuctionPressure > 0 && differentialPressure > 0) {
      const maxDischargePressureOption1 = maxSuctionPressure + differentialPressure;
      formData.maximumDischargePressureOption1 = maxDischargePressureOption1.toFixed(3);
    }
    
    // Option 2: Maximum Discharge Pressure = Maximum Suction Pressure + Shut off Differential Pressure
    if (maxSuctionPressure > 0 && shutOffDifferentialPressure > 0) {
      const maxDischargePressureOption2 = maxSuctionPressure + shutOffDifferentialPressure;
      formData.maximumDischargePressureOption2 = maxDischargePressureOption2.toFixed(3);
    }
  };
  
  const handleInputChange = (fieldName, value) => {
    setFormData(prev => {
      const newFormData = {
        ...prev,
        [fieldName]: value
      };

      // Control Valve Delta P Check automatic calculations
      if (['cvMax', 'cvMin'].includes(fieldName)) {
        const cvMax = parseFloat(newFormData.cvMax) || 0;
        const cvMin = parseFloat(newFormData.cvMin) || 0;
        
        // CV Ratio = Max/Min
        if (cvMin > 0) {
          const cvRatio = cvMax / cvMin;
          newFormData.cvRatio = cvRatio.toFixed(2);
        }
      }

      if (fieldName === 'totalFrictionalLosses') {
        const totalFrictionalLosses = parseFloat(newFormData.totalFrictionalLosses) || 0;
        
        // 30% Dynamic Losses = 30% of Total Frictional Losses
        const dynamicLosses30Percent = totalFrictionalLosses * 0.30;
        newFormData.dynamicLosses30Percent = dynamicLosses30Percent.toFixed(2);
      }

      // Suction Pressure Calculations automatic calculations
      if (['inlineInstLosses', 'lineFricLosses', 'controlValveSuction', 'miscItemsSuction'].includes(fieldName)) {
        const inlineInstLosses = parseFloat(newFormData.inlineInstLosses) || 0;
        const lineFricLosses = parseFloat(newFormData.lineFricLosses) || 0;
        const controlValveSuction = parseFloat(newFormData.controlValveSuction) || 0;
        const miscItemsSuction = parseFloat(newFormData.miscItemsSuction) || 0;

        // Total Suction Losses = Sum of all loss components
        const totalSuctionLosses = inlineInstLosses + lineFricLosses + controlValveSuction + miscItemsSuction;
        newFormData.totalSuctionLosses = totalSuctionLosses.toFixed(3);
      }

      if (['sourceOpPressure', 'suctionELm', 'totalSuctionLosses'].includes(fieldName)) {
        const sourceOpPressure = parseFloat(newFormData.sourceOpPressure) || 0;
        const suctionELm = parseFloat(newFormData.suctionELm) || 0;
        const totalSuctionLosses = parseFloat(newFormData.totalSuctionLosses) || 0;

        // Total Suction Pressure = Source Op. Pressure + Suction Elevation - Total Losses
        const totalSuctionPressure = sourceOpPressure + suctionELm - totalSuctionLosses;
        newFormData.totalSuctionPressure = totalSuctionPressure.toFixed(3);
      }

      // Power Consumption Per Pump automatic calculations
      if (['hydraulicPower', 'pumpEfficiency'].includes(fieldName)) {
        const hydraulicPower = parseFloat(newFormData.hydraulicPower) || 0;
        const pumpEfficiency = parseFloat(newFormData.pumpEfficiency) || 0;

        if (hydraulicPower > 0 && pumpEfficiency > 0) {
          // Break Horse Power = Hydraulic Power / (Pump Efficiency / 100)
          const breakHorsePower = hydraulicPower / (pumpEfficiency / 100);
          newFormData.breakHorsePower = breakHorsePower.toFixed(3);
        }
      }

      if (['breakHorsePower', 'motorEfficiency'].includes(fieldName) || fieldName === 'motorRating') {
        const breakHorsePower = parseFloat(newFormData.breakHorsePower) || 0;
        const motorEfficiency = parseFloat(newFormData.motorEfficiency) || 0;

        if (breakHorsePower > 0 && motorEfficiency > 0) {
          // Power Consumption = Break Horse Power / (Motor Efficiency / 100)
          const powerConsumption = breakHorsePower / (motorEfficiency / 100);
          newFormData.powerConsumption = powerConsumption.toFixed(3);
        }
      }

      // NPSH Availability automatic calculations  
      if (['suctionPressureNpsh', 'vaporPressure'].includes(fieldName)) {
        const suctionPressureNpsh = parseFloat(newFormData.suctionPressureNpsh) || 0;
        const vaporPressure = parseFloat(newFormData.vaporPressure) || 0;

        if (suctionPressureNpsh > 0 && vaporPressure >= 0) {
          // NPSHA = Suction Pressure - Vapor Pressure (converted from bar to meters)
          // Using 1 bar = 10.2 m for conversion (approximate for water)
          const npsha = (suctionPressureNpsh - vaporPressure) * 10.2;
          newFormData.npsha = npsha.toFixed(2);
        }
      }

      if (['npsha', 'safetyMarginNpsha'].includes(fieldName)) {
        const npsha = parseFloat(newFormData.npsha) || 0;
        const safetyMarginNpsha = parseFloat(newFormData.safetyMarginNpsha) || 0;

        if (npsha > 0 && safetyMarginNpsha >= 0) {
          // NPSHA (With Safety Margin) = NPSHA - Safety Margin
          const npshaWithSafetyMargin = npsha - safetyMarginNpsha;
          newFormData.npshaWithSafetyMargin = npshaWithSafetyMargin.toFixed(2);
        }
      }

      // AI-powered automatic calculation for Total Discharge Pressure
      if (['destinationPressure', 'destinationElevation', 'lineFrictionLoss', 'flowMeterDelP', 'otherLosses', 'controlValve', 'miscItem', 'contingency'].includes(fieldName)) {
        const destinationPressure = parseFloat(newFormData.destinationPressure) || 0;
        const destinationElevation = parseFloat(newFormData.destinationElevation) || 0;
        const lineFrictionLoss = parseFloat(newFormData.lineFrictionLoss) || 0;
        const flowMeterDelP = parseFloat(newFormData.flowMeterDelP) || 0;
        const otherLosses = parseFloat(newFormData.otherLosses) || 0;
        const controlValve = parseFloat(newFormData.controlValve) || 0;
        const miscItem = parseFloat(newFormData.miscItem) || 0;
        const contingency = parseFloat(newFormData.contingency) || 0;

        // Total Discharge Pressure = Sum of all pressure components including destination elevation
        const totalDischargePressure = destinationPressure + destinationElevation + lineFrictionLoss + flowMeterDelP + 
                                     otherLosses + controlValve + miscItem + contingency;
        
        newFormData.totalDischargePressure = totalDischargePressure.toFixed(2);
        
        // Auto-calculate pump calculation results
        calculatePumpResults(newFormData);
      }

      // Auto-calculate pump calculation results when any relevant field changes
      if (['totalDischargePressure', 'sourceOpPressure', 'suctionELm', 'totalSuctionLosses', 'npsha'].includes(fieldName)) {
        calculatePumpResults(newFormData);
      }

      // Auto-calculate max suction pressure when related fields change
      if (['suctionVesselMaxOpPressure', 'suctionElM', 'tlToHhllM'].includes(fieldName)) {
        calculateMaxSuctionPressure(newFormData);
      }

      // Auto-calculate MCF CV pressure drop when related fields change
      if (['pumpDischargePressureMinFlow', 'destinationPressure', 'elDestinationPumpCl', 'mcfLineFrictionLosses', 'flowMeterLosses', 'miscPressureDropMcf', 'fluidDensityMcf'].includes(fieldName)) {
        calculateMcfCvPressureDrop(newFormData);
      }

      // Auto-calculate shut off differential pressure when related fields change
      if (['apiToleranceFactor', 'shutOffPressureFactor', 'differentialPressure'].includes(fieldName)) {
        calculateShutOffDifferentialPressure(newFormData);
      }

      // Auto-calculate maximum discharge pressure options when related fields change
      if (['maxSuctionPressure', 'differentialPressure', 'shutOffDifferentialPressure', 'suctionVesselMaxOpPressure', 'suctionElM'].includes(fieldName)) {
        calculateMaxDischargePressureOptions(newFormData);
      }

      return newFormData;
    });
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      setUploadedFile(file);
      setIsProcessing(true);
      // TODO: Implement AI extraction from uploaded Excel file
      setTimeout(() => {
        setIsProcessing(false);
        setIsAIMode(true);
        // Auto-populate fields from AI extraction
      }, 2000);
    }
  };

  // Map form data to API format
  const mapFormDataToAPI = () => {
    // Extract project info fields for the main level
    const projectInfoFields = {
      agreement_no: formData.agreementNo || '',
      project_no: formData.projectNo || '',
      document_no: formData.documentNo || '',
      revision: formData.revision || '0',
      document_class: formData.documentClass || '',
      tag_no: formData.tagNo || '',
      service: formData.service || '',
      motor_classification: formData.motorClassification || '',
      temperature: formData.temperature ? parseFloat(formData.temperature) : null,
      fluid_viscosity_at_temp: formData.fluidViscosityAtTemp ? parseFloat(formData.fluidViscosityAtTemp) : null,
      hp: formData.hp ? parseFloat(formData.hp) : null,
      pump_centerline_elevation: formData.pumpCenterlineElevation ? parseFloat(formData.pumpCenterlineElevation) : null,
      elevation_source_btl: formData.elevationSourceBTL ? parseFloat(formData.elevationSourceBTL) : null,
    };

    // Extract discharge pressure calculation fields
    const dischargePressureFields = {
      destination_description: formData.destinationDescription || 'Cooling Water Tank (06.5- T - 2307)',
      flow_type: formData.flow || '',
      destination_pressure: formData.destinationPressure ? parseFloat(formData.destinationPressure) : null,
      destination_elevation: formData.destinationElevation ? parseFloat(formData.destinationElevation) : null,
      line_friction_loss: formData.lineFrictionLoss ? parseFloat(formData.lineFrictionLoss) : null,
      flow_meter_del_p: formData.flowMeterDelP ? parseFloat(formData.flowMeterDelP) : null,
      other_losses: formData.otherLosses ? parseFloat(formData.otherLosses) : null,
      control_valve: formData.controlValve ? parseFloat(formData.controlValve) : null,
      misc_item: formData.miscItem ? parseFloat(formData.miscItem) : null,
      contingency: formData.contingency ? parseFloat(formData.contingency) : null,
      total_discharge_pressure: formData.totalDischargePressure ? parseFloat(formData.totalDischargePressure) : null,
    };

    // Extract control valve delta p check fields
    const controlValveDeltaPFields = {
      density: formData.density ? parseFloat(formData.density) : null,
      cv_max: formData.cvMax ? parseFloat(formData.cvMax) : null,
      cv_min: formData.cvMin ? parseFloat(formData.cvMin) : null,
      cv_ratio: formData.cvRatio ? parseFloat(formData.cvRatio) : null,
      total_frictional_losses: formData.totalFrictionalLosses ? parseFloat(formData.totalFrictionalLosses) : null,
      dynamic_losses_30_percent: formData.dynamicLosses30Percent ? parseFloat(formData.dynamicLosses30Percent) : null,
      cv_pressure_drop: formData.cvPressureDrop ? parseFloat(formData.cvPressureDrop) : null,
      cv_rangeability: formData.cvRangeability ? parseFloat(formData.cvRangeability) : null,
      cv_ratio_within_range: formData.cvRatioWithinRange || '',
      cv_pressure_drop_check: formData.cvPressureDropCheck || '',
    };

    // Extract suction pressure calculation fields
    const suctionPressureFields = {
      source_op_pressure: formData.sourceOpPressure ? parseFloat(formData.sourceOpPressure) : null,
      suction_elm: formData.suctionELm ? parseFloat(formData.suctionELm) : null,
      inline_inst_losses: formData.inlineInstLosses ? parseFloat(formData.inlineInstLosses) : null,
      line_fric_losses: formData.lineFricLosses ? parseFloat(formData.lineFricLosses) : null,
      control_valve_suction: formData.controlValveSuction ? parseFloat(formData.controlValveSuction) : null,
      misc_items_suction: formData.miscItemsSuction ? parseFloat(formData.miscItemsSuction) : null,
      total_suction_losses: formData.totalSuctionLosses ? parseFloat(formData.totalSuctionLosses) : null,
      total_suction_pressure: formData.totalSuctionPressure ? parseFloat(formData.totalSuctionPressure) : null,
    };

    // === NEW TEMPLATE FIELDS ===
    // Liquid Characteristics - Map single values to max/normal fields
    const liquidCharacteristicsFields = {
      liquid_type: formData.service || null, // Map service to liquid_type
      vapor_pressure_max: formData.vaporPressure ? parseFloat(formData.vaporPressure) : null,
      vapor_pressure_min: formData.vaporPressure ? parseFloat(formData.vaporPressure) : null,
      density_max: formData.density ? parseFloat(formData.density) : null,
      density_min: formData.density ? parseFloat(formData.density) : null,
      viscosity_max: formData.fluidViscosityAtTemp ? parseFloat(formData.fluidViscosityAtTemp) : null,
      viscosity_min: formData.fluidViscosityAtTemp ? parseFloat(formData.fluidViscosityAtTemp) : null,
      temperature_max: formData.temperature ? parseFloat(formData.temperature) : null,
      temperature_min: formData.temperature ? parseFloat(formData.temperature) : null,
    };

    // Operating Conditions - Calculate or map existing values
    const operatingConditionsFields = {
      // Flow rate - use destination description as approximation or null
      flow_rate_max: formData.hp ? parseFloat(formData.hp) * 10 : null, // Approximate from HP
      flow_rate_normal: formData.hp ? parseFloat(formData.hp) * 8 : null,
      flow_rate_min: formData.hp ? parseFloat(formData.hp) * 5 : null,
      
      // Suction pressure
      suction_pressure_max: formData.totalSuctionPressure ? parseFloat(formData.totalSuctionPressure) : null,
      suction_pressure_normal: formData.totalSuctionPressure ? parseFloat(formData.totalSuctionPressure) : null,
      suction_pressure_min: formData.totalSuctionPressure ? parseFloat(formData.totalSuctionPressure) : null,
      
      // Discharge pressure
      discharge_pressure_max: formData.totalDischargePressure ? parseFloat(formData.totalDischargePressure) : null,
      discharge_pressure_normal: formData.totalDischargePressure ? parseFloat(formData.totalDischargePressure) : null,
      discharge_pressure_min: formData.totalDischargePressure ? parseFloat(formData.totalDischargePressure) : null,
      
      // Differential pressure
      differential_pressure_max: formData.differentialPressure ? parseFloat(formData.differentialPressure) : null,
      differential_pressure_normal: formData.differentialPressure ? parseFloat(formData.differentialPressure) : null,
      differential_pressure_min: formData.differentialPressure ? parseFloat(formData.differentialPressure) : null,
      
      // Differential head
      differential_head_max: formData.differentialHead ? parseFloat(formData.differentialHead) : null,
      differential_head_normal: formData.differentialHead ? parseFloat(formData.differentialHead) : null,
      differential_head_min: formData.differentialHead ? parseFloat(formData.differentialHead) : null,
    };

    // NPSH Fields - Map to template
    const npshTemplateFields = {
      npsh_available_max: formData.npsha ? parseFloat(formData.npsha) : null,
      npsh_available_min: formData.npsha ? parseFloat(formData.npsha) : null,
      npsh_required: formData.npshaResult ? parseFloat(formData.npshaResult) : null,
    };

    // Pump Performance Fields
    const pumpPerformanceFields = {
      pump_efficiency_max: formData.pumpEfficiency ? parseFloat(formData.pumpEfficiency) : null,
      pump_efficiency_normal: formData.pumpEfficiency ? parseFloat(formData.pumpEfficiency) : null,
      pump_efficiency_min: formData.pumpEfficiency ? parseFloat(formData.pumpEfficiency) : null,
      
      // Round to 2 decimal places to match database precision
      bhp_max: formData.breakHorsePower ? parseFloat(parseFloat(formData.breakHorsePower).toFixed(2)) : null,
      bhp_normal: formData.breakHorsePower ? parseFloat(parseFloat(formData.breakHorsePower).toFixed(2)) : null,
      bhp_min: formData.breakHorsePower ? parseFloat(parseFloat(formData.breakHorsePower).toFixed(2)) : null,
      
      // Round to 2 decimal places to match database precision
      absorbed_power_max: formData.powerConsumption ? parseFloat(parseFloat(formData.powerConsumption).toFixed(2)) : null,
      absorbed_power_normal: formData.powerConsumption ? parseFloat(parseFloat(formData.powerConsumption).toFixed(2)) : null,
      absorbed_power_min: formData.powerConsumption ? parseFloat(parseFloat(formData.powerConsumption).toFixed(2)) : null,
    };

    // Motor/Driver Data Fields
    const motorDriverFields = {
      driver_type: formData.typeOfMotor || null,
      motor_voltage: null, // Not in current form
      motor_speed: null, // Not in current form
    };

    // Construction Materials Fields
    const constructionMaterialsFields = {
      casing: null, // Not in current form
      impeller: null, // Not in current form
      shaft: null, // Not in current form
      bearings: null, // Not in current form
      mechanical_seal: null, // Not in current form
    };

    // Project Info Fields (including new ones)
    const projectInfoFieldsExtended = {
      company_name: null, // Not in current form, but field exists
      site: null, // Not in current form
      unit: null, // Not in current form
      manufacturer: null, // Not in current form
      model: null, // Not in current form
    };

    // Extract power consumption per pump fields
    const powerConsumptionFields = {
      hydraulic_power: formData.hydraulicPower ? parseFloat(formData.hydraulicPower) : null,
      pump_efficiency: formData.pumpEfficiency ? parseFloat(formData.pumpEfficiency) : null,
      break_horse_power: formData.breakHorsePower ? parseFloat(formData.breakHorsePower) : null,
      motor_rating: formData.motorRating ? parseFloat(formData.motorRating) : null,
      motor_efficiency: formData.motorEfficiency ? parseFloat(formData.motorEfficiency) : null,
      power_consumption: formData.powerConsumption ? parseFloat(formData.powerConsumption) : null,
      type_of_motor: formData.typeOfMotor || null,
    };

    // Extract NPSH availability fields
    const npshFields = {
      suction_pressure_npsh: formData.suctionPressureNpsh ? parseFloat(formData.suctionPressureNpsh) : null,
      vapor_pressure: formData.vaporPressure ? parseFloat(formData.vaporPressure) : null,
      npsha: formData.npsha ? parseFloat(formData.npsha) : null,
      safety_margin_npsha: formData.safetyMarginNpsha ? parseFloat(formData.safetyMarginNpsha) : null,
      npsha_with_safety_margin: formData.npshaWithSafetyMargin ? parseFloat(formData.npshaWithSafetyMargin) : null,
    };

    // Extract pump calculation result fields (replacing general notes)
    const pumpCalculationResults = {
      discharge_pressure: formData.dischargePressure ? parseFloat(formData.dischargePressure) : null,
      suction_pressure_result: formData.suctionPressureResult ? parseFloat(formData.suctionPressureResult) : null,
      differential_pressure: formData.differentialPressure ? parseFloat(formData.differentialPressure) : null,
      differential_head: formData.differentialHead ? parseFloat(formData.differentialHead) : null,
      npsha_result: formData.npshaResult ? parseFloat(formData.npshaResult) : null,
    };

    // Extract max suction pressure section fields
    const maxSuctionPressureFields = {
      suction_vessel_max_op_pressure: formData.suctionVesselMaxOpPressure ? parseFloat(formData.suctionVesselMaxOpPressure) : null,
      suction_el_m: formData.suctionElM ? parseFloat(formData.suctionElM) : null,
      tl_to_hhll_m: formData.tlToHhllM ? parseFloat(formData.tlToHhllM) : null,
      max_suction_pressure: formData.maxSuctionPressure ? parseFloat(formData.maxSuctionPressure) : null,
    };

    // Extract MCF calculation section fields
    const mcfCalculationFields = {
      pump_minimum_flow: formData.pumpMinimumFlow ? parseFloat(formData.pumpMinimumFlow) : null,
      fluid_density_mcf: formData.fluidDensityMcf ? parseFloat(formData.fluidDensityMcf) : null,
      pump_discharge_pressure_min_flow: formData.pumpDischargePressureMinFlow ? parseFloat(formData.pumpDischargePressureMinFlow) : null,
      destination_pressure: formData.destinationPressure ? parseFloat(formData.destinationPressure) : null,
      el_destination_pump_cl: formData.elDestinationPumpCl ? parseFloat(formData.elDestinationPumpCl) : null,
      mcf_line_friction_losses: formData.mcfLineFrictionLosses ? parseFloat(formData.mcfLineFrictionLosses) : null,
      flow_meter_losses: formData.flowMeterLosses ? parseFloat(formData.flowMeterLosses) : null,
      misc_pressure_drop_mcf: formData.miscPressureDropMcf ? parseFloat(formData.miscPressureDropMcf) : null,
      mcf_cv_pressure_drop: formData.mcfCvPressureDrop ? parseFloat(formData.mcfCvPressureDrop) : null,
    };

    // Extract Max Discharge Pressure at Max Density section fields
    const maxDischargePressureFields = {
      api_610_tolerance_used: formData.api610ToleranceUsed || null,
      api_tolerance_factor: formData.apiToleranceFactor ? parseFloat(formData.apiToleranceFactor) : null,
      shut_off_pressure_factor: formData.shutOffPressureFactor ? parseFloat(formData.shutOffPressureFactor) : null,
      shut_off_differential_pressure: formData.shutOffDifferentialPressure ? parseFloat(formData.shutOffDifferentialPressure) : null,
    };

    // Extract Max Discharge Pressure Options section fields
    const maxDischargePressureOptionsFields = {
      maximum_discharge_pressure_option_1: formData.maximumDischargePressureOption1 ? parseFloat(formData.maximumDischargePressureOption1) : null,
      maximum_discharge_pressure_option_2: formData.maximumDischargePressureOption2 ? parseFloat(formData.maximumDischargePressureOption2) : null,
    };

    // Group other form data by sections
    const sectionData = {
      general_data: {},
      control_valve_delta_p: {},
      suction_pressure_calculations: {},
      power_consumption_per_pump: {},
      npsh_availability: {},
      general_notes: {}
    };

    // Map remaining fields to their respective sections
    Object.keys(formData).forEach(key => {
      const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      // Exclude fields that are already mapped to specific sections
      const isAlreadyMapped = projectInfoFields.hasOwnProperty(snakeKey) || 
                             dischargePressureFields.hasOwnProperty(snakeKey) || 
                             controlValveDeltaPFields.hasOwnProperty(snakeKey) || 
                             suctionPressureFields.hasOwnProperty(snakeKey) || 
                             powerConsumptionFields.hasOwnProperty(snakeKey) || 
                             npshFields.hasOwnProperty(snakeKey);
      
      // Exclude pump calculation result fields as they have their own section
      const isPumpCalculationResult = ['dischargePressure', 'suctionPressureResult', 'differentialPressure', 'differentialHead', 'npshaResult'].includes(key);
      
      // Exclude max suction pressure fields as they have their own section
      const isMaxSuctionPressureField = ['suctionVesselMaxOpPressure', 'suctionElM', 'tlToHhllM', 'maxSuctionPressure'].includes(key);
      
      // Exclude MCF calculation fields as they have their own section
      const isMcfCalculationField = ['pumpMinimumFlow', 'fluidDensityMcf', 'pumpDischargePressureMinFlow', 'destinationPressure', 'elDestinationPumpCl', 'mcfLineFrictionLosses', 'flowMeterLosses', 'miscPressureDropMcf', 'mcfCvPressureDrop'].includes(key);
      
      if (!isAlreadyMapped && !isPumpCalculationResult && !isMaxSuctionPressureField && !isMcfCalculationField) {
        // Group by field patterns
        if (key.includes('cv') || key.includes('density') || key.includes('frictional') || key.includes('dynamic') || key.includes('rangeability')) {
          sectionData.control_valve_delta_p[key] = formData[key];
        } else if (key.includes('suction') || key.includes('source') || key.includes('inline') || key.includes('elm')) {
          sectionData.suction_pressure_calculations[key] = formData[key];
        } else if (key.includes('hydraulic') || key.includes('pump') || key.includes('break') || key.includes('motor') || key.includes('power') || key.includes('efficiency') || key.includes('type')) {
          sectionData.power_consumption_per_pump[key] = formData[key];
        } else if (key.includes('npsh') || key.includes('vapor') || key.includes('suction') && key.includes('pressure') && key.includes('npsh') || key.includes('safety') && key.includes('margin')) {
          sectionData.npsh_availability[key] = formData[key];
        } else if (key.includes('note') || key.includes('requirement') || key.includes('standard')) {
          sectionData.general_notes[key] = formData[key];
        } else {
          sectionData.general_data[key] = formData[key];
        }
      }
    });

    return {
      ...projectInfoFields,
      ...projectInfoFieldsExtended,
      ...liquidCharacteristicsFields,
      ...operatingConditionsFields,
      ...npshTemplateFields,
      ...pumpPerformanceFields,
      ...motorDriverFields,
      ...constructionMaterialsFields,
      ...dischargePressureFields,
      ...controlValveDeltaPFields,
      ...suctionPressureFields,
      ...powerConsumptionFields,
      ...npshFields,
      ...pumpCalculationResults,
      ...maxSuctionPressureFields,
      ...mcfCalculationFields,
      ...maxDischargePressureFields,
      ...maxDischargePressureOptionsFields,
      ...sectionData
    };
  };

  // Submit form data to Django API
  const handleSubmit = async (e, isDraft = false) => {
    e.preventDefault();
    
    setIsSubmitting(true);
    setSubmitStatus(null);
    setErrorMessage('');

    try {
      const apiData = mapFormDataToAPI();
      
      // Add status based on submission type
      apiData.status = isDraft ? 'draft' : 'ifr';

      const response = await apiClient.post('/process-datasheet/pump-calculations/', apiData);

      if (response.data && response.data.id) {
        console.log('✅ Pump calculation saved with ID:', response.data.id);
        setSavedPumpId(response.data.id); // Store ID for Excel/PDF generation
        setSubmitStatus('success');
        setShowSuccessModal(true); // Show success modal with actions
        
        // Auto-hide status after modal is dismissed
        setTimeout(() => {
          setSubmitStatus(null);
        }, 3000);
      }
    } catch (error) {
      console.error('Submission error:', error);
      setSubmitStatus('error');
      
      if (error.response && error.response.data) {
        const errors = error.response.data;
        
        // Special handling for duplicate document_no error
        if (errors.document_no && Array.isArray(errors.document_no) && 
            errors.document_no.some(msg => msg.includes('already exists'))) {
          setErrorMessage('⚠️ Document No already exists. Please change the Document No field to a unique value, or click Excel/PDF to download the existing calculation.');
        } else if (errors.error) {
          setErrorMessage(errors.error);
        } else {
          const errorMessages = Object.entries(errors)
            .map(([field, messages]) => `${field}: ${Array.isArray(messages) ? messages.join(', ') : messages}`)
            .join('\n');
          setErrorMessage(errorMessages);
        }
      } else {
        setErrorMessage(error.message || 'An unexpected error occurred');
      }
      
      // Show error message for 5 seconds
      setTimeout(() => {
        setSubmitStatus(null);
        setErrorMessage('');
      }, 5000);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Generate AI-Powered Professional Datasheet
  const handleGenerateDatasheet = async (savedDataId = null) => {
    console.log('🔄 handleGenerateDatasheet called with ID:', savedDataId);
    console.log('💾 Stored pump ID:', savedPumpId);
    setIsGeneratingDatasheet(true);
    setDatasheetStatus(null);
    
    try {
      let pumpDataId = savedDataId || savedPumpId; // Use stored ID if available
      
      // If no saved data ID provided, save the current form data first
      if (!pumpDataId) {
        console.log('💾 No ID available, saving form data first...');
        const apiData = mapFormDataToAPI();
        apiData.status = 'ifr'; // Set as issued for review
        
        // ALWAYS generate unique document_no to avoid duplicates
        const timestamp = Date.now();
        const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
        apiData.document_no = `DOC-${timestamp}-${randomSuffix}`;
        console.log('🔢 Generated unique document_no:', apiData.document_no);
        
        console.log('📤 Sending data to backend:', apiData);
        
        const saveResponse = await apiClient.post('/process-datasheet/pump-calculations/', apiData);
        console.log('✅ Save response:', saveResponse);
        console.log('📦 Response data:', saveResponse.data);
        console.log('🔑 Response data keys:', Object.keys(saveResponse.data || {}));
        console.log('🆔 ID value:', saveResponse.data?.id);
        
        // Handle response - ID might be directly in data or nested
        const responseId = saveResponse.data?.id || saveResponse.data?.data?.id || saveResponse.id;
        
        if (!responseId) {
          console.error('❌ No ID found in response');
          console.error('Full response structure:', JSON.stringify(saveResponse, null, 2));
          throw new Error('Failed to get pump calculation ID from server response');
        }
        
        pumpDataId = responseId;
        setSavedPumpId(pumpDataId); // Store for future use
        console.log('✅ Pump data saved with ID:', pumpDataId);
      } else {
        console.log('✅ Using existing pump ID:', pumpDataId);
      }
      
      // Generate the AI-powered datasheet
      console.log('📊 Generating Excel for ID:', pumpDataId);
      const datasheetResponse = await apiClient.get(
        `/process-datasheet/pump-calculations/${pumpDataId}/generate_datasheet/`,
        { responseType: 'blob' }
      );
      console.log('✅ Excel response received:', datasheetResponse);
      
      // Get the blob data and filename
      const blob = datasheetResponse.data;
      console.log('📦 Blob size:', blob.size, 'type:', blob.type);
      const contentDisposition = datasheetResponse.headers['content-disposition'];
      const filename = contentDisposition 
        ? contentDisposition.split('filename=')[1].replace(/"/g, '') 
        : `Pump_Datasheet_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.xlsx`;
      console.log('📁 Filename:', filename);
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      console.log('🔗 Download URL created:', url);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      console.log('🎉 Excel download triggered successfully!');
      
      setDatasheetStatus('success');
      
      // Auto-clear success message
      setTimeout(() => {
        setDatasheetStatus(null);
      }, 5000);
      
    } catch (error) {
      console.error('❌ Datasheet generation error:', error);
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
        
        // Special handling for duplicate document_no
        if (error.response.status === 400 && error.response.data?.document_no) {
          console.warn('⚠️ Duplicate document_no detected. Try changing the Document No field or Submit first.');
          alert('Document No already exists. Please:\n1. Change the Document No field, OR\n2. Click "Submit Calculations" first, then try Excel again');
        }
      }
      setDatasheetStatus('error');
      
      // Auto-clear error message
      setTimeout(() => {
        setDatasheetStatus(null);
      }, 5000);
    } finally {
      setIsGeneratingDatasheet(false);
    }
  };

  // Generate AI-Powered Professional PDF Datasheet
  const handleGeneratePdf = async (savedDataId = null) => {
    console.log('🔄 handleGeneratePdf called with ID:', savedDataId);
    console.log('💾 Stored pump ID:', savedPumpId);
    setIsGeneratingPdf(true);
    setPdfStatus(null);
    
    try {
      let pumpDataId = savedDataId || savedPumpId; // Use stored ID if available
      
      // If no saved data ID provided, save the current form data first
      if (!pumpDataId) {
        console.log('💾 No ID available, saving form data first...');
        const apiData = mapFormDataToAPI();
        apiData.status = 'ifr'; // Set as issued for review
        
        // ALWAYS generate unique document_no to avoid duplicates
        const timestamp = Date.now();
        const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
        apiData.document_no = `DOC-${timestamp}-${randomSuffix}`;
        console.log('🔢 Generated unique document_no:', apiData.document_no);
        
        console.log('📤 Sending data to backend:', apiData);
        
        const saveResponse = await apiClient.post('/process-datasheet/pump-calculations/', apiData);
        console.log('✅ Save response:', saveResponse);
        console.log('📦 Response data:', saveResponse.data);
        console.log('🔑 Response data keys:', Object.keys(saveResponse.data || {}));
        console.log('🆔 ID value:', saveResponse.data?.id);
        
        // Handle response - ID might be directly in data or nested
        const responseId = saveResponse.data?.id || saveResponse.data?.data?.id || saveResponse.id;
        
        if (!responseId) {
          console.error('❌ No ID found in response');
          console.error('Full response structure:', JSON.stringify(saveResponse, null, 2));
          throw new Error('Failed to get pump calculation ID from server response');
        }
        
        pumpDataId = responseId;
        setSavedPumpId(pumpDataId); // Store for future use
        console.log('✅ Pump data saved with ID:', pumpDataId);
      } else {
        console.log('✅ Using existing pump ID:', pumpDataId);
      }
      
      // Generate the AI-powered PDF datasheet
      console.log('📄 Generating PDF for ID:', pumpDataId);
      const pdfResponse = await apiClient.get(
        `/process-datasheet/pump-calculations/${pumpDataId}/generate_pdf_datasheet/`,
        { responseType: 'blob' }
      );
      console.log('✅ PDF response received:', pdfResponse);
      
      // Get the blob data and filename
      const blob = pdfResponse.data;
      console.log('📦 Blob size:', blob.size, 'type:', blob.type);
      const contentDisposition = pdfResponse.headers['content-disposition'];
      const filename = contentDisposition 
        ? contentDisposition.split('filename=')[1].replace(/"/g, '') 
        : `Pump_Datasheet_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.pdf`;
      console.log('📁 Filename:', filename);
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      console.log('🔗 Download URL created:', url);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      console.log('🎉 PDF download triggered successfully!');
      
      setPdfStatus('success');
      
      // Auto-clear success message
      setTimeout(() => {
        setPdfStatus(null);
      }, 5000);
      
    } catch (error) {
      console.error('❌ PDF generation error:', error);
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
        
        // Special handling for duplicate document_no
        if (error.response.status === 400 && error.response.data?.document_no) {
          console.warn('⚠️ Duplicate document_no detected. Try changing the Document No field or Submit first.');
          alert('Document No already exists. Please:\n1. Change the Document No field, OR\n2. Click "Submit Calculations" first, then try PDF again');
        }
      }
      setPdfStatus('error');
      
      // Auto-clear error message
      setTimeout(() => {
        setPdfStatus(null);
      }, 5000);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const renderField = (field) => {
    const commonClasses = "mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm";
    const calculatedClasses = "mt-1 block w-full rounded-md bg-blue-50 border-blue-300 text-blue-800 sm:text-sm font-semibold";
    
    // 🎯 Get recommendations for this field
    const numericSuggestion = recommendationsReady && field.type === 'number' && !field.calculated 
      ? getNumericSuggestion(field.name) 
      : null;

    // 🧠 Smart motor efficiency hint
    const motorEfficiencyHint = field.name === 'motorEfficiency' 
      && formData.motorClassification 
      && recommendationsReady
      ? getMotorEfficiencySuggestion(formData.motorClassification)
      : null;
    
    switch (field.type) {
      case 'select':
        return (
          <div>
            <select
              value={formData[field.name] || field.default || ''}
              onChange={(e) => handleInputChange(field.name, e.target.value)}
              required={field.required}
              className={commonClasses}
            >
              <option value="">Select {field.label}</option>
              {field.options?.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
            
            {/* Text field suggestions */}
            {recommendationsReady && !formData[field.name] && (
              (() => {
                const suggestions = getSuggestionsForField(field.name);
                if (suggestions.length > 0) {
                  return (
                    <InlineSuggestion
                      value={suggestions[0].value}
                      onApply={(value) => handleInputChange(field.name, value)}
                      badge={suggestions[0].badge === 'Recent' ? 'recent' : 'common'}
                      visible={true}
                    />
                  );
                }
                return null;
              })()
            )}
          </div>
        );
      
      case 'textarea':
        return (
          <textarea
            value={formData[field.name] || ''}
            onChange={(e) => handleInputChange(field.name, e.target.value)}
            required={field.required}
            rows={field.rows || 3}
            placeholder={field.placeholder}
            className={commonClasses}
          />
        );
      
      default:
        return (
          <div>
            <div className="flex items-center gap-2">
              <input
                type={field.type}
                value={formData[field.name] || field.default || ''}
                onChange={(e) => handleInputChange(field.name, e.target.value)}
                required={field.required}
                placeholder={field.calculated ? 'Auto-calculated' : field.placeholder}
                step={field.type === 'number' ? '0.01' : undefined}
                readOnly={field.calculated}
                className={`${field.calculated ? calculatedClasses : commonClasses} ${field.unit ? 'flex-1' : ''}`}
              />
              {field.calculated && (
                <div className="px-2 py-2 bg-blue-100 border border-blue-300 rounded-md">
                  <SparklesIcon className="w-4 h-4 text-blue-600" title="AI-Calculated Field" />
                </div>
              )}
              {field.unit && (
                <span className={`px-3 py-2 border rounded-md text-sm whitespace-nowrap ${
                  field.calculated 
                    ? 'bg-blue-100 border-blue-300 text-blue-700' 
                    : 'bg-gray-100 border-gray-300 text-gray-600'
                }`}>
                  {field.unit}
                </span>
              )}
            </div>
            
            {/* 💡 Numeric field suggestions */}
            {numericSuggestion && (
              <NumericSuggestion
                suggestion={numericSuggestion}
                onApply={(value) => handleInputChange(field.name, value)}
                fieldName={field.name}
                currentValue={formData[field.name]}
              />
            )}
            
            {/* 🧠 Smart motor efficiency hint */}
            {motorEfficiencyHint && motorEfficiencyHint !== formData.motorEfficiency && (
              <SmartCombinationHint
                title="Typical efficiency for this motor type"
                suggestion={`${motorEfficiencyHint}%`}
                onApply={() => handleInputChange('motorEfficiency', motorEfficiencyHint)}
              />
            )}
          </div>
        );
    }
  };

  const renderSection = (sectionKey) => {
    const section = FORM_SECTIONS[sectionKey];
    const Icon = section.icon;
    const gradient = COLOR_SCHEMES[section.color];

    return (
      <div key={sectionKey} className="bg-white rounded-xl shadow-md overflow-hidden mb-6">
        {/* Section Header */}
        <div className={`bg-gradient-to-r ${gradient} px-6 py-4 flex items-center gap-3`}>
          <Icon className="w-6 h-6 text-white" />
          <h2 className="text-xl font-bold text-white">{section.title}</h2>
        </div>

        {/* Section Fields */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          {section.fields.map(field => (
            <div key={field.name} className={field.type === 'textarea' ? 'md:col-span-2' : ''}>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {field.label}
                {field.required && <span className="text-red-500 ml-1">*</span>}
              </label>
              {renderField(field)}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Pump Hydraulic Calculation Data Sheet
              </h1>
              <p className="text-gray-600">
                Complete data entry for pump sizing, selection, and hydraulic calculations
              </p>
            </div>
            <SparklesIcon className="w-12 h-12 text-blue-500" />
          </div>

          {/* AI Upload Section */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-dashed border-blue-300 rounded-lg p-6">
            <div className="flex items-center gap-4">
              <ArrowUpTrayIcon className="w-8 h-8 text-blue-600" />
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-1">AI-Powered Data Entry</h3>
                <p className="text-sm text-gray-600">
                  Upload existing pump calculation Excel file for automatic data extraction
                </p>
              </div>
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <div className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors">
                  {isProcessing ? 'Processing...' : 'Upload Excel File'}
                </div>
              </label>
            </div>
            {uploadedFile && (
              <div className="mt-4 flex items-center gap-2 text-sm text-green-600">
                <span className="font-medium">✓ Uploaded:</span>
                <span>{uploadedFile.name}</span>
              </div>
            )}
          </div>
        </div>

        {/* Form Sections */}
        <form onSubmit={(e) => handleSubmit(e, false)}>
          {/* 🎯 Recommendation Context Display */}
          {recommendationsReady && recommendationStats && (
            <RecommendationContext context={recommendationStats} />
          )}

          {/* ✨ Auto-Fill Button */}
          {recommendationsReady && (
            <div className="mb-6 flex items-center justify-between bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-200 rounded-lg p-4">
              <div>
                <h3 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
                  <SparklesIcon className="w-5 h-5 text-purple-600" />
                  Smart Auto-Fill Available
                </h3>
                <p className="text-sm text-gray-600">
                  Fill common fields with intelligent suggestions based on {recommendationStats.total_records_analyzed} recent records
                </p>
              </div>
              <AutoFillButton 
                onClick={handleAutoFill}
                loading={recommendationsLoading}
                disabled={!recommendationsReady}
                fieldsCount={8}
              />
            </div>
          )}

          {/* Status Messages */}
          {/* Success Modal with Actions */}
          {showSuccessModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden animate-fade-in">
                {/* Modal Header */}
                <div className="bg-gradient-to-r from-green-500 to-emerald-600 px-8 py-6">
                  <div className="flex items-center gap-4">
                    <div className="bg-white rounded-full p-3">
                      <CheckCircleIcon className="w-10 h-10 text-green-600" />
                    </div>
                    <div className="text-white">
                      <h2 className="text-2xl font-bold mb-1">Calculation Submitted Successfully!</h2>
                      <p className="text-green-100">Your pump calculation data has been saved. Choose an action below:</p>
                    </div>
                  </div>
                </div>

                {/* Modal Body - Action Options */}
                <div className="p-8">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    {/* View Data Option */}
                    <button
                      onClick={() => {
                        window.open(`/engineering/process/datasheet/view/${savedPumpId}`, '_blank');
                      }}
                      className="group flex flex-col items-center justify-center p-6 border-2 border-blue-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all cursor-pointer"
                    >
                      <div className="bg-blue-100 group-hover:bg-blue-200 rounded-full p-4 mb-3 transition-colors">
                        <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </div>
                      <span className="font-semibold text-gray-800 group-hover:text-blue-600">View Data</span>
                      <span className="text-xs text-gray-500 mt-1 text-center">Preview in template format</span>
                    </button>

                    {/* Download Excel Option */}
                    <button
                      onClick={() => {
                        handleGenerateDatasheet();
                      }}
                      disabled={isGeneratingDatasheet}
                      className="group flex flex-col items-center justify-center p-6 border-2 border-emerald-200 rounded-xl hover:border-emerald-500 hover:bg-emerald-50 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <div className="bg-emerald-100 group-hover:bg-emerald-200 rounded-full p-4 mb-3 transition-colors">
                        <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <span className="font-semibold text-gray-800 group-hover:text-emerald-600">
                        {isGeneratingDatasheet ? 'Generating...' : 'Download Excel'}
                      </span>
                      <span className="text-xs text-gray-500 mt-1 text-center">Pump Data Sheet.xlsx</span>
                    </button>

                    {/* Download PDF Option */}
                    <button
                      onClick={() => {
                        handleGeneratePdf();
                      }}
                      disabled={isGeneratingPdf}
                      className="group flex flex-col items-center justify-center p-6 border-2 border-red-200 rounded-xl hover:border-red-500 hover:bg-red-50 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <div className="bg-red-100 group-hover:bg-red-200 rounded-full p-4 mb-3 transition-colors">
                        <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <span className="font-semibold text-gray-800 group-hover:text-red-600">
                        {isGeneratingPdf ? 'Generating...' : 'Download PDF'}
                      </span>
                      <span className="text-xs text-gray-500 mt-1 text-center">Pump Data Sheet.pdf</span>
                    </button>
                  </div>

                  {/* Saved Data Info */}
                  <div className="bg-gray-50 rounded-lg p-4 mb-6">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Document No:</span>
                        <span className="ml-2 font-medium text-gray-800">{formData.documentNo || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Tag No:</span>
                        <span className="ml-2 font-medium text-gray-800">{formData.tagNo || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Project No:</span>
                        <span className="ml-2 font-medium text-gray-800">{formData.projectNo || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Pump ID:</span>
                        <span className="ml-2 font-mono text-xs text-gray-600">{savedPumpId}</span>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex justify-between items-center">
                    <button
                      onClick={() => {
                        setShowSuccessModal(false);
                        // Optionally reset form
                      }}
                      className="text-gray-600 hover:text-gray-800 font-medium px-6 py-2 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      Continue Editing
                    </button>
                    <button
                      onClick={() => {
                        setShowSuccessModal(false);
                        setFormData({});
                        setSavedPumpId(null);
                        setSubmitStatus(null);
                      }}
                      className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium px-6 py-3 rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md"
                    >
                      Start New Calculation
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {submitStatus === 'error' && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-center">
              <ExclamationTriangleIcon className="w-6 h-6 text-red-500 mr-3" />
              <div>
                <h3 className="text-red-800 font-medium">Error</h3>
                <p className="text-red-700">{errorMessage || 'Failed to save pump calculation data. Please try again.'}</p>
              </div>
            </div>
          )}
          
          {Object.keys(FORM_SECTIONS).map(sectionKey => renderSection(sectionKey))}

          {/* Submit Section */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                <span className="font-medium text-red-500">*</span> Required fields
              </div>
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={(e) => handleSubmit(e, true)}
                  disabled={isSubmitting || isGeneratingDatasheet || isGeneratingPdf}
                  className={`px-6 py-3 border border-gray-300 rounded-lg font-medium transition-all ${
                    isSubmitting || isGeneratingDatasheet || isGeneratingPdf 
                      ? 'text-gray-400 bg-gray-100 cursor-not-allowed' 
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {isSubmitting ? 'Saving...' : 'Save Draft'}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || isGeneratingDatasheet || isGeneratingPdf}
                  className={`px-8 py-3 rounded-lg font-medium transition-all shadow-lg flex items-center gap-2 ${
                    isSubmitting || isGeneratingDatasheet || isGeneratingPdf
                      ? 'bg-gray-400 text-white cursor-not-allowed'
                      : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700'
                  }`}
                >
                  {isSubmitting && (
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  )}
                  {isSubmitting ? 'Processing Data...' : 'Submit Calculation'}
                </button>
                
                {/* Excel Download Button */}
                <button
                  type="button"
                  onClick={() => handleGenerateDatasheet()}
                  disabled={isSubmitting || isGeneratingDatasheet || isGeneratingPdf}
                  className={`px-5 py-3 rounded-lg font-medium transition-all shadow-lg border-2 ${
                    isGeneratingDatasheet
                      ? 'bg-gray-400 text-white border-gray-400 cursor-not-allowed'
                      : datasheetStatus === 'success'
                        ? 'bg-green-600 text-white border-green-600 hover:bg-green-700'
                        : datasheetStatus === 'error'
                          ? 'bg-red-600 text-white border-red-600 hover:bg-red-700'
                          : 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white border-emerald-600 hover:from-emerald-700 hover:to-teal-700'
                  } flex items-center gap-2`}
                >
                  <ArrowUpTrayIcon className="h-4 w-4" />
                  {isGeneratingDatasheet 
                    ? 'Generating...' 
                    : datasheetStatus === 'success'
                      ? 'Excel Ready!'
                      : datasheetStatus === 'error'
                        ? 'Failed'
                        : 'Excel'
                  }
                </button>

                {/* PDF Download Button */}
                <button
                  type="button"
                  onClick={() => handleGeneratePdf()}
                  disabled={isSubmitting || isGeneratingDatasheet || isGeneratingPdf}
                  className={`px-5 py-3 rounded-lg font-medium transition-all shadow-lg border-2 ${
                    isGeneratingPdf
                      ? 'bg-gray-400 text-white border-gray-400 cursor-not-allowed'
                      : pdfStatus === 'success'
                        ? 'bg-green-600 text-white border-green-600 hover:bg-green-700'
                        : pdfStatus === 'error'
                          ? 'bg-red-600 text-white border-red-600 hover:bg-red-700'
                          : 'bg-gradient-to-r from-red-600 to-orange-600 text-white border-red-600 hover:from-red-700 hover:to-orange-700'
                  } flex items-center gap-2`}
                >
                  <DocumentTextIcon className="h-4 w-4" />
                  {isGeneratingPdf 
                    ? 'Generating...' 
                    : pdfStatus === 'success'
                      ? 'PDF Ready!'
                      : pdfStatus === 'error'
                        ? 'Failed'
                        : 'PDF'
                  }
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ComprehensivePumpForm;
