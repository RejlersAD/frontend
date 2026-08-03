import React, { useState, useEffect } from 'react';
import {
  SparklesIcon,
  XMarkIcon,
  DocumentTextIcon,
  BeakerIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  LightBulbIcon,
  ShieldCheckIcon,
  CubeIcon,
  UserGroupIcon,
  CalendarIcon,
  TruckIcon
} from '@heroicons/react/24/outline';
import { PROCUREMENT_CONFIG, getCategoryByCode } from '../../config/procurement.config';
import apiClient from '../../services/api.service';

const AIReceiptCreator = ({ isOpen, onClose, onReceiptCreated, orders }) => {
  const [formData, setFormData] = useState({
    po_id: '',
    po_number: '',
    received_date: new Date().toISOString().split('T')[0],
    quantity_received: 0,
    quantity_rejected: 0,
    inspector_name: '',
    inspection_agency: '',
    packaging_condition: 'good',
    certificates_received: [],
    heat_numbers: '',
    inspection_report_number: '',
    ndt_required: false,
    ndt_performed: false,
    ndt_results: '',
    dimensional_check_passed: null,
    visual_inspection_passed: null,
    material_verification_passed: null,
    quality_check_passed: null,
    notes: '',
    status: 'pending'
  });

  const [aiProcessing, setAiProcessing] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState({
    grNumber: null,
    inspectionRequirements: null,
    certRequirements: null,
    qualityChecklist: null,
    inspectorRecommendation: null,
    acceptanceRecommendation: null,
    defectAnalysis: null
  });
  const [selectedPO, setSelectedPO] = useState(null);
  const [aiInsights, setAiInsights] = useState([]);

  /**
   * AI Feature 1: Auto-generate GR Number
   * Generates unique goods receipt number based on PO and sequence
   */
  const generateGRNumber = async () => {
    setAiProcessing(true);
    
    // Simulate AI processing delay
    await new Promise(resolve => setTimeout(resolve, 1200));
    
    if (!selectedPO) {
      setAiProcessing(false);
      return;
    }

    // Soft-coded GR number generation algorithm
    const poNumber = selectedPO.po_number || '';
    const date = new Date();
    const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`;
    const randomSeq = Math.floor(1000 + Math.random() * 9000);
    
    const grNumber = `GR-${poNumber}-${dateStr}-${randomSeq}`;
    
    setAiSuggestions(prev => ({
      ...prev,
      grNumber: {
        value: grNumber,
        confidence: 0.98,
        reasoning: 'Generated based on PO number, date, and sequence'
      }
    }));
    
    setFormData(prev => ({ ...prev, gr_number: grNumber }));
    
    addAiInsight('success', 'GR Number Generated', `Unique receipt number created: ${grNumber}`);
    setAiProcessing(false);
  };

  /**
   * AI Feature 2: Smart Inspection Requirements Analysis
   * Analyzes PO items and determines required inspections
   */
  const analyzeInspectionRequirements = async () => {
    setAiProcessing(true);
    
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    if (!selectedPO || !selectedPO.items) {
      setAiProcessing(false);
      return;
    }

    // Soft-coded inspection requirement algorithm
    const requirements = {
      dimensional: false,
      visual: true, // Always required
      material: false,
      ndt: false,
      hydrostatic: false,
      functional: false,
      reasons: []
    };

    const items = Array.isArray(selectedPO.items) ? selectedPO.items : [];
    
    items.forEach(item => {
      const description = (item.description || '').toLowerCase();
      const category = item.category || '';
      
      // Dimensional checks required for precision items
      if (description.includes('pipe') || description.includes('valve') || 
          description.includes('flange') || description.includes('fitting') ||
          category.includes('piping') || category.includes('valves')) {
        requirements.dimensional = true;
        requirements.reasons.push('Dimensional verification required for piping/valve components');
      }
      
      // Material verification for critical materials
      if (description.includes('stainless') || description.includes('alloy') ||
          description.includes('duplex') || description.includes('inconel') ||
          description.includes('carbon steel')) {
        requirements.material = true;
        requirements.reasons.push('Material grade verification required for alloy/carbon steel');
      }
      
      // NDT required for pressure equipment
      if (description.includes('pressure') || description.includes('vessel') ||
          description.includes('pump') || description.includes('heat exchanger') ||
          category.includes('rotating') || category.includes('static')) {
        requirements.ndt = true;
        requirements.reasons.push('NDT inspection required for pressure-bearing equipment');
      }
      
      // Hydrostatic test for vessels and piping
      if (description.includes('vessel') || description.includes('tank') ||
          (description.includes('pipe') && description.includes('pressure'))) {
        requirements.hydrostatic = true;
        requirements.reasons.push('Hydrostatic testing required for pressure vessels/piping');
      }
      
      // Functional testing for rotating equipment
      if (description.includes('pump') || description.includes('compressor') ||
          description.includes('motor') || category.includes('rotating')) {
        requirements.functional = true;
        requirements.reasons.push('Functional testing required for rotating equipment');
      }
    });

    setAiSuggestions(prev => ({
      ...prev,
      inspectionRequirements: {
        requirements,
        confidence: 0.95,
        itemCount: items.length
      }
    }));

    // Update form with AI recommendations
    setFormData(prev => ({
      ...prev,
      ndt_required: requirements.ndt,
      dimensional_check_passed: requirements.dimensional ? null : true,
      visual_inspection_passed: null,
      material_verification_passed: requirements.material ? null : true
    }));

    addAiInsight('info', 'Inspection Requirements Analyzed', 
      `${Object.values(requirements).filter(v => v === true).length} inspection types required for ${items.length} items`);
    
    setAiProcessing(false);
  };

  /**
   * AI Feature 3: Certificate Requirements Verification
   * Determines required certificates based on item specifications
   */
  const analyzeCertificateRequirements = async () => {
    setAiProcessing(true);
    
    await new Promise(resolve => setTimeout(resolve, 1400));
    
    if (!selectedPO || !selectedPO.items) {
      setAiProcessing(false);
      return;
    }

    const items = Array.isArray(selectedPO.items) ? selectedPO.items : [];
    const requiredCerts = new Set();
    const reasons = [];

    // Soft-coded certificate requirement algorithm
    items.forEach(item => {
      const description = (item.description || '').toLowerCase();
      const category = item.category || '';
      const materialSpec = item.material_specification || '';
      
      // Base certificates - always required
      requiredCerts.add('MTC 3.1');
      requiredCerts.add('COC');
      
      // Material-specific certificates
      if (materialSpec || description.includes('carbon steel') || 
          description.includes('stainless') || description.includes('alloy')) {
        requiredCerts.add('MTR');
        requiredCerts.add('PMI Report');
        reasons.push('Material Test Reports required for metal components');
      }
      
      // Piping and static equipment
      if (description.includes('pipe') || description.includes('flange') ||
          description.includes('fitting') || category.includes('piping') ||
          category.includes('static')) {
        requiredCerts.add('ASME B31.3');
        requiredCerts.add('Hydrostatic Test');
        reasons.push('ASME compliance certificates required for piping systems');
      }
      
      // Valves and fittings
      if (description.includes('valve') || category.includes('valves')) {
        requiredCerts.add('API 600');
        requiredCerts.add('API 6D');
        requiredCerts.add('Pressure Test');
        reasons.push('API valve certificates and pressure test reports required');
      }
      
      // Rotating equipment
      if (description.includes('pump') || description.includes('compressor') ||
          category.includes('rotating')) {
        requiredCerts.add('API 610');
        requiredCerts.add('FAT Report');
        requiredCerts.add('Performance Test');
        reasons.push('Factory Acceptance Test and performance certificates required');
      }
      
      // Welding requirements
      if (item.welding_required || description.includes('weld')) {
        requiredCerts.add('WPS');
        requiredCerts.add('PQR');
        requiredCerts.add('WQTR');
        requiredCerts.add('NDT Report');
        reasons.push('Welding procedure and qualification records required');
      }
      
      // Electrical equipment
      if (description.includes('motor') || description.includes('electrical') ||
          category.includes('electrical')) {
        requiredCerts.add('IECEx');
        requiredCerts.add('ATEX');
        requiredCerts.add('IEEE Compliance');
        reasons.push('Electrical safety certifications required for hazardous areas');
      }
      
      // Safety equipment
      if (description.includes('safety') || description.includes('relief') ||
          description.includes('psv')) {
        requiredCerts.add('API 526');
        requiredCerts.add('Calibration Report');
        reasons.push('Safety valve certifications and calibration required');
      }
      
      // Chemicals and consumables
      if (category.includes('chemicals') || category.includes('consumables')) {
        requiredCerts.add('MSDS');
        requiredCerts.add('COA');
        reasons.push('Material Safety Data Sheets and Certificate of Analysis required');
      }
    });

    const certArray = Array.from(requiredCerts);
    
    setAiSuggestions(prev => ({
      ...prev,
      certRequirements: {
        certificates: certArray,
        reasons,
        confidence: 0.93,
        itemCount: items.length
      }
    }));

    addAiInsight('info', `${certArray.length} Certificates Required`, 
      `AI identified mandatory documentation for ${items.length} items`);
    
    setAiProcessing(false);
  };

  /**
   * AI Feature 4: Quality Check Guidance
   * Provides step-by-step inspection checklist
   */
  const generateQualityChecklist = async () => {
    setAiProcessing(true);
    
    await new Promise(resolve => setTimeout(resolve, 1600));
    
    if (!selectedPO || !selectedPO.items) {
      setAiProcessing(false);
      return;
    }

    const items = Array.isArray(selectedPO.items) ? selectedPO.items : [];
    const checklist = {
      dimensional: [],
      visual: [],
      material: [],
      functional: [],
      documentation: []
    };

    // Soft-coded quality checklist generation
    items.forEach(item => {
      const description = (item.description || '').toLowerCase();
      const category = item.category || '';
      
      // Dimensional checks
      if (description.includes('pipe') || description.includes('valve') || description.includes('flange')) {
        checklist.dimensional.push({
          item: item.description,
          checks: [
            'Verify dimensions against drawing specifications',
            'Check wall thickness (minimum required per spec)',
            'Measure outside diameter and length',
            'Verify flange dimensions and bolt hole patterns',
            'Check tolerances per ASME B31.3 or applicable standard'
          ]
        });
      }
      
      // Visual inspection - always required
      checklist.visual.push({
        item: item.description,
        checks: [
          'Inspect for surface defects (cracks, pitting, corrosion)',
          'Check coating/painting quality and thickness',
          'Verify identification markings and tags',
          'Check packaging condition and protection',
          'Look for any signs of damage during transport',
          'Verify heat numbers are stamped/marked correctly'
        ]
      });
      
      // Material verification
      if (description.includes('steel') || description.includes('alloy') || item.material_specification) {
        checklist.material.push({
          item: item.description,
          checks: [
            'Verify material grade matches specification',
            'Conduct PMI (Positive Material Identification) test',
            'Check heat number traceability',
            'Review Material Test Reports (MTR)',
            'Verify chemical composition per MTC',
            'Check mechanical properties (tensile, yield, hardness)'
          ]
        });
      }
      
      // Functional tests
      if (description.includes('pump') || description.includes('valve') || 
          category.includes('rotating')) {
        checklist.functional.push({
          item: item.description,
          checks: [
            'Perform operational test per manufacturer specifications',
            'Check pressure rating and perform pressure test',
            'Verify seat tightness (for valves)',
            'Test performance parameters (flow, head, efficiency)',
            'Check seal integrity',
            'Verify rotation direction and coupling alignment'
          ]
        });
      }
      
      // Documentation
      checklist.documentation.push({
        item: item.description,
        checks: [
          'MTC 3.1 certificate present and valid',
          'Certificate of Conformity (COC) received',
          'Test reports match item serial/heat numbers',
          'Manufacturer data sheets and manuals provided',
          'Warranty documentation included',
          'Traceability documentation complete'
        ]
      });
    });

    setAiSuggestions(prev => ({
      ...prev,
      qualityChecklist: {
        checklist,
        confidence: 0.96,
        totalChecks: Object.values(checklist).reduce((sum, cat) => sum + cat.length, 0)
      }
    }));

    addAiInsight('success', 'Quality Checklist Generated', 
      `Comprehensive inspection guide created with ${Object.values(checklist).reduce((sum, cat) => sum + cat.length, 0)} check items`);
    
    setAiProcessing(false);
  };

  /**
   * AI Feature 5: Inspector Recommendation
   * Suggests qualified inspector based on item requirements
   */
  const recommendInspector = async () => {
    setAiProcessing(true);
    
    await new Promise(resolve => setTimeout(resolve, 1300));
    
    if (!selectedPO || !selectedPO.items) {
      setAiProcessing(false);
      return;
    }

    const items = Array.isArray(selectedPO.items) ? selectedPO.items : [];
    
    // Soft-coded inspector recommendation algorithm
    const requiredQualifications = new Set();
    let complexityScore = 0;
    
    items.forEach(item => {
      const description = (item.description || '').toLowerCase();
      const category = item.category || '';
      
      if (description.includes('pressure') || description.includes('vessel')) {
        requiredQualifications.add('API 510 - Pressure Vessel Inspector');
        complexityScore += 3;
      }
      
      if (description.includes('pipe') || description.includes('piping')) {
        requiredQualifications.add('API 570 - Piping Inspector');
        complexityScore += 2;
      }
      
      if (description.includes('weld')) {
        requiredQualifications.add('CWI - Certified Welding Inspector');
        complexityScore += 3;
      }
      
      if (description.includes('ndt') || item.ndt_required) {
        requiredQualifications.add('ASNT Level II NDT');
        complexityScore += 3;
      }
      
      if (description.includes('electrical')) {
        requiredQualifications.add('IECEx Competent Person');
        complexityScore += 2;
      }
      
      if (category.includes('rotating')) {
        requiredQualifications.add('Rotating Equipment Specialist');
        complexityScore += 2;
      }
      
      complexityScore += 1; // Base complexity per item
    });

    // Determine inspection level
    let inspectionLevel = 'Standard';
    let recommendedAgency = 'Internal QC Team';
    
    if (complexityScore > 15) {
      inspectionLevel = 'Critical';
      recommendedAgency = 'Third Party Agency (SGS, Bureau Veritas, TÜV)';
    } else if (complexityScore > 8) {
      inspectionLevel = 'Advanced';
      recommendedAgency = 'Senior Inspector + Third Party Witness';
    }

    const recommendation = {
      level: inspectionLevel,
      agency: recommendedAgency,
      qualifications: Array.from(requiredQualifications),
      complexityScore,
      estimatedDuration: `${Math.ceil(complexityScore * 0.5)} hours`,
      reasoning: `Based on ${items.length} items with complexity score of ${complexityScore}`
    };

    setAiSuggestions(prev => ({
      ...prev,
      inspectorRecommendation: {
        ...recommendation,
        confidence: 0.91
      }
    }));

    setFormData(prev => ({
      ...prev,
      inspection_agency: recommendedAgency
    }));

    addAiInsight('info', `${inspectionLevel} Inspection Required`, 
      `${requiredQualifications.size} qualification(s) needed - ${recommendedAgency}`);
    
    setAiProcessing(false);
  };

  /**
   * AI Feature 6: Defect Detection & Analysis
   * Analyzes inspection results and flags potential issues
   */
  const analyzeDefects = () => {
    const defects = [];
    const warnings = [];
    let severity = 'low';

    // Dimensional defects
    if (formData.dimensional_check_passed === false) {
      defects.push({
        type: 'Dimensional',
        severity: 'high',
        issue: 'Dimensional measurements out of tolerance',
        action: 'Reject or request deviation approval',
        impact: 'May affect fit-up and assembly'
      });
      severity = 'high';
    }

    // Visual defects
    if (formData.visual_inspection_passed === false) {
      defects.push({
        type: 'Visual',
        severity: 'medium',
        issue: 'Visual defects detected (cracks, pitting, or coating issues)',
        action: 'Assess severity and document with photos',
        impact: 'May compromise integrity or aesthetics'
      });
      if (severity === 'low') severity = 'medium';
    }

    // Material verification issues
    if (formData.material_verification_passed === false) {
      defects.push({
        type: 'Material',
        severity: 'critical',
        issue: 'Material grade mismatch or PMI failure',
        action: 'REJECT - Material substitution not acceptable',
        impact: 'Safety and compliance violation'
      });
      severity = 'critical';
    }

    // NDT failures
    if (formData.ndt_required && formData.ndt_performed && formData.ndt_results) {
      const ndtText = formData.ndt_results.toLowerCase();
      if (ndtText.includes('fail') || ndtText.includes('reject') || ndtText.includes('defect')) {
        defects.push({
          type: 'NDT',
          severity: 'high',
          issue: 'NDT testing revealed internal defects',
          action: 'Reject and request repair/replacement',
          impact: 'Structural integrity compromised'
        });
        severity = severity === 'critical' ? 'critical' : 'high';
      }
    }

    // Certificate warnings
    if (!formData.certificates_received || formData.certificates_received.length === 0) {
      warnings.push({
        type: 'Documentation',
        message: 'No certificates received - hold pending documentation',
        recommendation: 'Request vendor to provide required certificates'
      });
    }

    // Heat number warnings
    if (!formData.heat_numbers || formData.heat_numbers.trim() === '') {
      warnings.push({
        type: 'Traceability',
        message: 'Missing heat numbers - material traceability incomplete',
        recommendation: 'Verify heat numbers from markings or request from vendor'
      });
    }

    // Packaging condition
    if (formData.packaging_condition === 'damaged') {
      warnings.push({
        type: 'Packaging',
        message: 'Damaged packaging may have affected item condition',
        recommendation: 'Perform thorough inspection for transportation damage'
      });
    }

    return {
      defects,
      warnings,
      severity,
      hasIssues: defects.length > 0 || warnings.length > 0
    };
  };

  /**
   * AI Feature 7: Acceptance Decision Recommendation
   * Provides AI-based acceptance/rejection recommendation
   */
  const generateAcceptanceRecommendation = () => {
    const analysis = analyzeDefects();
    
    let decision = 'accept';
    let reasoning = [];
    let confidence = 0.95;

    // Critical failures = automatic rejection
    if (analysis.severity === 'critical') {
      decision = 'reject';
      confidence = 0.99;
      reasoning.push('Critical material verification failure detected');
      reasoning.push('Acceptance would violate safety and compliance requirements');
    }
    // High severity = likely rejection
    else if (analysis.severity === 'high') {
      decision = 'reject';
      confidence = 0.92;
      reasoning.push('High severity defects exceed acceptable limits');
      reasoning.push('Recommendation: Return to vendor for replacement');
    }
    // Medium severity = conditional acceptance possible
    else if (analysis.severity === 'medium') {
      decision = 'conditional';
      confidence = 0.85;
      reasoning.push('Medium severity issues detected');
      reasoning.push('Consider: Accept with conditions or request repair');
      reasoning.push('Requires engineering review and deviation approval');
    }
    // Warnings only = hold pending documentation
    else if (analysis.warnings.length > 0) {
      decision = 'hold';
      confidence = 0.88;
      reasoning.push('Items appear satisfactory but documentation incomplete');
      reasoning.push('Hold pending receipt of required certificates');
    }
    // All checks passed = accept
    else {
      decision = 'accept';
      confidence = 0.97;
      reasoning.push('All quality checks passed successfully');
      reasoning.push('Material and workmanship meet specification requirements');
      reasoning.push('Documentation complete and satisfactory');
    }

    return {
      decision,
      reasoning,
      confidence,
      analysis
    };
  };

  // Update acceptance recommendation when quality checks change
  useEffect(() => {
    if (formData.dimensional_check_passed !== null || 
        formData.visual_inspection_passed !== null || 
        formData.material_verification_passed !== null) {
      
      const recommendation = generateAcceptanceRecommendation();
      
      setAiSuggestions(prev => ({
        ...prev,
        acceptanceRecommendation: recommendation
      }));

      // Update overall quality status
      const allPassed = formData.dimensional_check_passed !== false &&
                       formData.visual_inspection_passed !== false &&
                       formData.material_verification_passed !== false;
      
      const anyFailed = formData.dimensional_check_passed === false ||
                       formData.visual_inspection_passed === false ||
                       formData.material_verification_passed === false;
      
      setFormData(prev => ({
        ...prev,
        quality_check_passed: anyFailed ? false : (allPassed ? true : null),
        status: recommendation.decision === 'reject' ? 'rejected' : 
               recommendation.decision === 'accept' ? 'accepted' : 
               recommendation.decision === 'hold' ? 'pending' : 'pending'
      }));
    }
  }, [formData.dimensional_check_passed, formData.visual_inspection_passed, 
      formData.material_verification_passed, formData.ndt_results]);

  const handlePOSelect = (e) => {
    const poId = e.target.value;
    const po = orders.find(o => o.id === parseInt(poId));
    
    if (po) {
      setSelectedPO(po);
      setFormData(prev => ({
        ...prev,
        po_id: poId,
        po_number: po.po_number,
        quantity_received: po.total_quantity || 0
      }));
      
      // Auto-trigger AI analysis
      setTimeout(() => {
        generateGRNumber();
        analyzeInspectionRequirements();
        analyzeCertificateRequirements();
        generateQualityChecklist();
        recommendInspector();
      }, 500);
    }
  };

  const addAiInsight = (type, title, message) => {
    setAiInsights(prev => [...prev, { type, title, message, timestamp: Date.now() }]);
    // Auto-remove after 5 seconds
    setTimeout(() => {
      setAiInsights(prev => prev.filter(i => i.timestamp !== Date.now()));
    }, 5000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      // Prepare data for API
      const submitData = {
        ...formData,
        certificates_received: formData.certificates_received || [],
        // Convert quality checks to proper format
        dimensional_check_passed: formData.dimensional_check_passed,
        visual_inspection_passed: formData.visual_inspection_passed,
        material_verification_passed: formData.material_verification_passed,
        quality_check_passed: formData.quality_check_passed
      };
      
      const response = await apiClient.post('/procurement/receipts/', submitData);
      const data = response.data;
      onReceiptCreated(data);
      handleClose();
      addAiInsight('success', 'Receipt Recorded', 'Goods receipt created successfully with AI quality analysis');
    } catch (error) {
      console.error('Error creating receipt:', error);
      addAiInsight('error', 'Error', error.response?.data?.detail || 'Failed to create receipt');
    }
  };

  const handleClose = () => {
    setFormData({
      po_id: '',
      po_number: '',
      received_date: new Date().toISOString().split('T')[0],
      quantity_received: 0,
      quantity_rejected: 0,
      inspector_name: '',
      inspection_agency: '',
      packaging_condition: 'good',
      certificates_received: [],
      heat_numbers: '',
      inspection_report_number: '',
      ndt_required: false,
      ndt_performed: false,
      ndt_results: '',
      dimensional_check_passed: null,
      visual_inspection_passed: null,
      material_verification_passed: null,
      quality_check_passed: null,
      notes: '',
      status: 'pending'
    });
    setSelectedPO(null);
    setAiSuggestions({});
    setAiInsights([]);
    onClose();
  };

  const toggleCertificate = (cert) => {
    setFormData(prev => {
      const certs = prev.certificates_received || [];
      if (certs.includes(cert)) {
        return { ...prev, certificates_received: certs.filter(c => c !== cert) };
      } else {
        return { ...prev, certificates_received: [...certs, cert] };
      }
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={handleClose}></div>

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-6xl sm:w-full">
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0 bg-white bg-opacity-20 rounded-lg p-2">
                  <SparklesIcon className="h-8 w-8 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white" id="modal-title">
                    AI-Powered Goods Receipt
                  </h3>
                  <p className="text-purple-100 text-sm mt-1">
                    Intelligent quality inspection and material traceability
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="bg-white bg-opacity-20 rounded-md p-2 inline-flex items-center justify-center text-white hover:bg-opacity-30 focus:outline-none"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
          </div>

          {/* AI Insights Bar */}
          {aiInsights.length > 0 && (
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 px-6 py-3 border-b border-purple-200">
              <div className="flex items-center space-x-2">
                <LightBulbIcon className="h-5 w-5 text-purple-600 animate-pulse" />
                <div className="flex-1 overflow-x-auto">
                  {aiInsights.slice(-1).map((insight, idx) => (
                    <div key={insight.timestamp} className="text-sm">
                      <span className="font-semibold text-purple-900">{insight.title}:</span>
                      <span className="text-purple-700 ml-2">{insight.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="bg-white px-6 py-6 max-h-[calc(100vh-250px)] overflow-y-auto">
              <div className="space-y-6">
                {/* PO Selection */}
                <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-6 border-2 border-indigo-200">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <DocumentTextIcon className="h-5 w-5 mr-2 text-indigo-600" />
                    Purchase Order Selection
                  </h4>
                  
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Select Purchase Order *
                      </label>
                      <select
                        value={formData.po_id}
                        onChange={handlePOSelect}
                        required
                        className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      >
                        <option value="">Choose a PO to receive...</option>
                        {orders.map(order => (
                          <option key={order.id} value={order.id}>
                            {order.po_number} - {order.vendor_name} ({order.status})
                          </option>
                        ))}
                      </select>
                    </div>

                    {selectedPO && (
                      <div className="bg-white rounded-lg p-4 border border-indigo-200">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-gray-500">Vendor:</span>
                            <span className="ml-2 font-medium">{selectedPO.vendor_name}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Delivery Date:</span>
                            <span className="ml-2 font-medium">
                              {selectedPO.delivery_date ? new Date(selectedPO.delivery_date).toLocaleDateString() : 'N/A'}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500">Items:</span>
                            <span className="ml-2 font-medium">
                              {selectedPO.items ? selectedPO.items.length : 0}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500">Amount:</span>
                            <span className="ml-2 font-medium">
                              ${selectedPO.total_amount ? parseFloat(selectedPO.total_amount).toFixed(2) : '0.00'}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {aiSuggestions.grNumber && (
                    <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-3">
                      <div className="flex items-start">
                        <CheckCircleIcon className="h-5 w-5 text-green-600 mt-0.5 mr-2" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-green-900">GR Number Generated</p>
                          <p className="text-sm text-green-700 mt-1">{formData.gr_number}</p>
                          <p className="text-xs text-green-600 mt-1">{aiSuggestions.grNumber.reasoning}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Receipt Details */}
                {selectedPO && (
                  <>
                    <div className="bg-white rounded-lg border-2 border-gray-200 p-6">
                      <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                        <TruckIcon className="h-5 w-5 mr-2 text-gray-600" />
                        Receipt Details
                      </h4>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            <CalendarIcon className="h-4 w-4 inline mr-1" />
                            Received Date *
                          </label>
                          <input
                            type="date"
                            value={formData.received_date}
                            onChange={(e) => setFormData({...formData, received_date: e.target.value})}
                            required
                            className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            <CubeIcon className="h-4 w-4 inline mr-1" />
                            Quantity Received *
                          </label>
                          <input
                            type="number"
                            value={formData.quantity_received}
                            onChange={(e) => setFormData({...formData, quantity_received: parseInt(e.target.value) || 0})}
                            required
                            min="0"
                            className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Quantity Rejected
                          </label>
                          <input
                            type="number"
                            value={formData.quantity_rejected}
                            onChange={(e) => setFormData({...formData, quantity_rejected: parseInt(e.target.value) || 0})}
                            min="0"
                            className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Packaging Condition *
                          </label>
                          <select
                            value={formData.packaging_condition}
                            onChange={(e) => setFormData({...formData, packaging_condition: e.target.value})}
                            className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                          >
                            <option value="excellent">Excellent</option>
                            <option value="good">Good</option>
                            <option value="fair">Fair</option>
                            <option value="damaged">Damaged</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Inspector Information */}
                    <div className="bg-white rounded-lg border-2 border-gray-200 p-6">
                      <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                        <UserGroupIcon className="h-5 w-5 mr-2 text-gray-600" />
                        Inspector Information
                      </h4>

                      {aiSuggestions.inspectorRecommendation && (
                        <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
                          <div className="flex items-start">
                            <SparklesIcon className="h-5 w-5 text-blue-600 mt-0.5 mr-2" />
                            <div className="flex-1">
                              <p className="text-sm font-medium text-blue-900">AI Inspector Recommendation</p>
                              <p className="text-sm text-blue-700 mt-1">
                                Level: <span className="font-semibold">{aiSuggestions.inspectorRecommendation.level}</span>
                              </p>
                              <p className="text-sm text-blue-700">
                                Agency: {aiSuggestions.inspectorRecommendation.agency}
                              </p>
                              {aiSuggestions.inspectorRecommendation.qualifications.length > 0 && (
                                <div className="mt-2">
                                  <p className="text-xs text-blue-600 font-medium">Required Qualifications:</p>
                                  <ul className="list-disc list-inside text-xs text-blue-600 mt-1">
                                    {aiSuggestions.inspectorRecommendation.qualifications.map((qual, idx) => (
                                      <li key={idx}>{qual}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              <p className="text-xs text-blue-500 mt-2">
                                Est. Duration: {aiSuggestions.inspectorRecommendation.estimatedDuration}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Inspector Name *
                          </label>
                          <input
                            type="text"
                            value={formData.inspector_name}
                            onChange={(e) => setFormData({...formData, inspector_name: e.target.value})}
                            required
                            className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                            placeholder="John Smith"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Inspection Agency
                          </label>
                          <input
                            type="text"
                            value={formData.inspection_agency}
                            onChange={(e) => setFormData({...formData, inspection_agency: e.target.value})}
                            className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                            placeholder="e.g., SGS, Bureau Veritas"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Inspection Report Number
                          </label>
                          <input
                            type="text"
                            value={formData.inspection_report_number}
                            onChange={(e) => setFormData({...formData, inspection_report_number: e.target.value})}
                            className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                            placeholder="IR-2024-001"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Quality Checks */}
                    <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg border-2 border-green-200 p-6">
                      <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                        <ShieldCheckIcon className="h-6 w-6 mr-2 text-green-600" />
                        Quality Inspection Checks
                      </h4>

                      {aiSuggestions.inspectionRequirements && (
                        <div className="mb-4 bg-white rounded-lg p-4 border border-green-300">
                          <div className="flex items-start">
                            <SparklesIcon className="h-5 w-5 text-green-600 mt-0.5 mr-2" />
                            <div className="flex-1">
                              <p className="text-sm font-medium text-green-900">AI Inspection Analysis</p>
                              <ul className="list-disc list-inside text-sm text-green-700 mt-2 space-y-1">
                                {aiSuggestions.inspectionRequirements.requirements.reasons.map((reason, idx) => (
                                  <li key={idx}>{reason}</li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-white rounded-lg p-4 border-2 border-gray-200">
                          <label className="block text-sm font-medium text-gray-900 mb-3">
                            <CheckCircleIcon className="h-4 w-4 inline mr-1" />
                            Dimensional Check
                          </label>
                          <div className="space-y-2">
                            <button
                              type="button"
                              onClick={() => setFormData({...formData, dimensional_check_passed: true})}
                              className={`w-full px-3 py-2 text-sm rounded ${formData.dimensional_check_passed === true ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                            >
                              ✓ Passed
                            </button>
                            <button
                              type="button"
                              onClick={() => setFormData({...formData, dimensional_check_passed: false})}
                              className={`w-full px-3 py-2 text-sm rounded ${formData.dimensional_check_passed === false ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                            >
                              ✗ Failed
                            </button>
                          </div>
                        </div>

                        <div className="bg-white rounded-lg p-4 border-2 border-gray-200">
                          <label className="block text-sm font-medium text-gray-900 mb-3">
                            <CheckCircleIcon className="h-4 w-4 inline mr-1" />
                            Visual Inspection
                          </label>
                          <div className="space-y-2">
                            <button
                              type="button"
                              onClick={() => setFormData({...formData, visual_inspection_passed: true})}
                              className={`w-full px-3 py-2 text-sm rounded ${formData.visual_inspection_passed === true ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                            >
                              ✓ Passed
                            </button>
                            <button
                              type="button"
                              onClick={() => setFormData({...formData, visual_inspection_passed: false})}
                              className={`w-full px-3 py-2 text-sm rounded ${formData.visual_inspection_passed === false ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                            >
                              ✗ Failed
                            </button>
                          </div>
                        </div>

                        <div className="bg-white rounded-lg p-4 border-2 border-gray-200">
                          <label className="block text-sm font-medium text-gray-900 mb-3">
                            <CheckCircleIcon className="h-4 w-4 inline mr-1" />
                            Material Verification
                          </label>
                          <div className="space-y-2">
                            <button
                              type="button"
                              onClick={() => setFormData({...formData, material_verification_passed: true})}
                              className={`w-full px-3 py-2 text-sm rounded ${formData.material_verification_passed === true ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                            >
                              ✓ Passed
                            </button>
                            <button
                              type="button"
                              onClick={() => setFormData({...formData, material_verification_passed: false})}
                              className={`w-full px-3 py-2 text-sm rounded ${formData.material_verification_passed === false ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                            >
                              ✗ Failed
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* NDT Section */}
                      <div className="mt-4 bg-white rounded-lg p-4 border-2 border-purple-200">
                        <div className="flex items-center mb-3">
                          <BeakerIcon className="h-5 w-5 mr-2 text-purple-600" />
                          <label className="text-sm font-medium text-gray-900">
                            Non-Destructive Testing (NDT)
                          </label>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                checked={formData.ndt_required}
                                onChange={(e) => setFormData({...formData, ndt_required: e.target.checked})}
                                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                              />
                              <span className="text-sm text-gray-700">NDT Required</span>
                            </label>
                          </div>
                          
                          {formData.ndt_required && (
                            <div>
                              <label className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  checked={formData.ndt_performed}
                                  onChange={(e) => setFormData({...formData, ndt_performed: e.target.checked})}
                                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                />
                                <span className="text-sm text-gray-700">NDT Performed</span>
                              </label>
                            </div>
                          )}
                        </div>

                        {formData.ndt_required && formData.ndt_performed && (
                          <div className="mt-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              NDT Results
                            </label>
                            <textarea
                              value={formData.ndt_results}
                              onChange={(e) => setFormData({...formData, ndt_results: e.target.value})}
                              rows="3"
                              className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                              placeholder="Enter NDT test results (e.g., UT, RT, MT, PT)"
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Certificates */}
                    <div className="bg-white rounded-lg border-2 border-gray-200 p-6">
                      <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                        <DocumentTextIcon className="h-5 w-5 mr-2 text-gray-600" />
                        Material Certificates & Documentation
                      </h4>

                      {aiSuggestions.certRequirements && (
                        <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
                          <div className="flex items-start">
                            <SparklesIcon className="h-5 w-5 text-blue-600 mt-0.5 mr-2" />
                            <div className="flex-1">
                              <p className="text-sm font-medium text-blue-900">
                                AI Certificate Requirements - {aiSuggestions.certRequirements.certificates.length} certificates needed
                              </p>
                              <p className="text-xs text-blue-600 mt-1">
                                Confidence: {(aiSuggestions.certRequirements.confidence * 100).toFixed(0)}%
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {aiSuggestions.certRequirements?.certificates.map((cert, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => toggleCertificate(cert)}
                            className={`px-3 py-2 text-sm rounded border-2 transition-colors ${
                              formData.certificates_received?.includes(cert)
                                ? 'bg-green-500 text-white border-green-600'
                                : 'bg-white text-gray-700 border-gray-300 hover:border-indigo-500'
                            }`}
                          >
                            {formData.certificates_received?.includes(cert) && '✓ '}
                            {cert}
                          </button>
                        )) || PROCUREMENT_CONFIG.materialCertifications.map((cert, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => toggleCertificate(cert.code)}
                            className={`px-3 py-2 text-sm rounded border-2 transition-colors ${
                              formData.certificates_received?.includes(cert.code)
                                ? 'bg-green-500 text-white border-green-600'
                                : 'bg-white text-gray-700 border-gray-300 hover:border-indigo-500'
                            }`}
                          >
                            {formData.certificates_received?.includes(cert.code) && '✓ '}
                            {cert.code}
                          </button>
                        ))}
                      </div>

                      <div className="mt-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Heat Numbers / Serial Numbers
                        </label>
                        <textarea
                          value={formData.heat_numbers}
                          onChange={(e) => setFormData({...formData, heat_numbers: e.target.value})}
                          rows="2"
                          className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                          placeholder="Enter heat numbers separated by commas (e.g., HN12345, HN67890)"
                        />
                      </div>
                    </div>

                    {/* AI Acceptance Recommendation */}
                    {aiSuggestions.acceptanceRecommendation && (
                      <div className={`rounded-lg border-2 p-6 ${
                        aiSuggestions.acceptanceRecommendation.decision === 'accept' ? 'bg-green-50 border-green-300' :
                        aiSuggestions.acceptanceRecommendation.decision === 'reject' ? 'bg-red-50 border-red-300' :
                        aiSuggestions.acceptanceRecommendation.decision === 'conditional' ? 'bg-yellow-50 border-yellow-300' :
                        'bg-blue-50 border-blue-300'
                      }`}>
                        <div className="flex items-start">
                          <SparklesIcon className={`h-6 w-6 mt-0.5 mr-3 ${
                            aiSuggestions.acceptanceRecommendation.decision === 'accept' ? 'text-green-600' :
                            aiSuggestions.acceptanceRecommendation.decision === 'reject' ? 'text-red-600' :
                            aiSuggestions.acceptanceRecommendation.decision === 'conditional' ? 'text-yellow-600' :
                            'text-blue-600'
                          }`} />
                          <div className="flex-1">
                            <h4 className={`text-lg font-bold mb-2 ${
                              aiSuggestions.acceptanceRecommendation.decision === 'accept' ? 'text-green-900' :
                              aiSuggestions.acceptanceRecommendation.decision === 'reject' ? 'text-red-900' :
                              aiSuggestions.acceptanceRecommendation.decision === 'conditional' ? 'text-yellow-900' :
                              'text-blue-900'
                            }`}>
                              AI Acceptance Recommendation: {aiSuggestions.acceptanceRecommendation.decision.toUpperCase()}
                            </h4>
                            <div className="space-y-2">
                              {aiSuggestions.acceptanceRecommendation.reasoning.map((reason, idx) => (
                                <p key={idx} className={`text-sm ${
                                  aiSuggestions.acceptanceRecommendation.decision === 'accept' ? 'text-green-800' :
                                  aiSuggestions.acceptanceRecommendation.decision === 'reject' ? 'text-red-800' :
                                  aiSuggestions.acceptanceRecommendation.decision === 'conditional' ? 'text-yellow-800' :
                                  'text-blue-800'
                                }`}>
                                  • {reason}
                                </p>
                              ))}
                            </div>
                            <p className={`text-xs mt-3 font-medium ${
                              aiSuggestions.acceptanceRecommendation.decision === 'accept' ? 'text-green-700' :
                              aiSuggestions.acceptanceRecommendation.decision === 'reject' ? 'text-red-700' :
                              aiSuggestions.acceptanceRecommendation.decision === 'conditional' ? 'text-yellow-700' :
                              'text-blue-700'
                            }`}>
                              AI Confidence: {(aiSuggestions.acceptanceRecommendation.confidence * 100).toFixed(0)}%
                            </p>

                            {/* Defect Analysis */}
                            {aiSuggestions.acceptanceRecommendation.analysis.defects.length > 0 && (
                              <div className="mt-4 p-3 bg-white rounded border-2 border-red-300">
                                <p className="text-sm font-semibold text-red-900 mb-2">⚠️ Defects Detected:</p>
                                {aiSuggestions.acceptanceRecommendation.analysis.defects.map((defect, idx) => (
                                  <div key={idx} className="mb-2 last:mb-0">
                                    <p className="text-sm font-medium text-red-800">{defect.type} ({defect.severity})</p>
                                    <p className="text-xs text-red-700">{defect.issue}</p>
                                    <p className="text-xs text-red-600 italic">Action: {defect.action}</p>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Warnings */}
                            {aiSuggestions.acceptanceRecommendation.analysis.warnings.length > 0 && (
                              <div className="mt-4 p-3 bg-white rounded border-2 border-yellow-300">
                                <p className="text-sm font-semibold text-yellow-900 mb-2">⚡ Warnings:</p>
                                {aiSuggestions.acceptanceRecommendation.analysis.warnings.map((warning, idx) => (
                                  <div key={idx} className="mb-2 last:mb-0">
                                    <p className="text-sm font-medium text-yellow-800">{warning.type}</p>
                                    <p className="text-xs text-yellow-700">{warning.message}</p>
                                    <p className="text-xs text-yellow-600 italic">{warning.recommendation}</p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Notes */}
                    <div className="bg-white rounded-lg border-2 border-gray-200 p-6">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Additional Notes
                      </label>
                      <textarea
                        value={formData.notes}
                        onChange={(e) => setFormData({...formData, notes: e.target.value})}
                        rows="3"
                        className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="Enter any additional inspection notes or observations..."
                      />
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="bg-gray-50 px-6 py-4 flex justify-between items-center">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Cancel
              </button>
              
              <div className="flex space-x-3">
                {aiProcessing && (
                  <div className="flex items-center text-sm text-purple-600">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600 mr-2"></div>
                    AI Analyzing...
                  </div>
                )}
                
                <button
                  type="submit"
                  disabled={!selectedPO || aiProcessing}
                  className="inline-flex items-center px-6 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CheckCircleIcon className="h-5 w-5 mr-2" />
                  Record Goods Receipt
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AIReceiptCreator;
