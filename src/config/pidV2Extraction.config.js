/**
 * PID Verification V2 - Extraction Configuration (Frontend)
 * ==========================================================
 * Soft-coded configuration for multi-layer extraction UI
 */

export const EXTRACTION_CONFIG = {
  // Extraction Mode Options
  modes: [
    {
      id: 'fast',
      label: 'Fast',
      icon: '⚡',
      description: 'OCR-only with enhanced post-processing',
      details: 'Uses free OCR engines only. No AI Vision calls.',
      usesVisionAPI: false,
      cost: 'Free',
      costPerPage: 0,
      estimatedTime: '10-30 sec/page',
      accuracy: '75-85%',
      recommended: false,
      features: [
        'Tesseract OCR (multiple PSM modes)',
        'PyMuPDF text layer extraction',
        'pdfplumber table detection',
        'Regex pattern matching',
        'Spatial text grouping',
      ],
      bestFor: [
        'High-quality PDF scans',
        'Drawings with text layers',
        'Quick preliminary extraction',
        'Budget-conscious projects',
      ],
    },
    {
      id: 'balanced',
      label: 'Balanced ⭐',
      icon: '⚖️',
      description: 'Smart Vision fallback when OCR is weak',
      details: 'OCR first, then AI Vision only if confidence < 70% or few items found',
      usesVisionAPI: 'conditional',
      cost: '$0.01-0.15/page',
      costPerPage: 0.01,
      costPerPageMax: 0.15,
      estimatedTime: '20-60 sec/page',
      accuracy: '90-95%',
      recommended: true,  // Default
      features: [
        'All Fast mode features',
        'EasyOCR fallback (ML-based)',
        'PaddleOCR for rotated text',
        'Vision AI for weak regions',
        'Cross-validation',
      ],
      bestFor: [
        'Standard engineering drawings',
        'Mix of print and handwritten',
        'Cost-effective accuracy',
        'Most use cases (recommended)',
      ],
    },
    {
      id: 'deep',
      label: 'Deep',
      icon: '🔬',
      description: 'Full Vision analysis + OCR cross-validation',
      details: 'AI Vision runs on EVERY page with OCR as validation',
      usesVisionAPI: true,
      requiresApiKey: true,  // BYOK required
      cost: '$0.20-0.50/page',
      costPerPage: 0.20,
      costPerPageMax: 0.50,
      estimatedTime: '60-120 sec/page',
      accuracy: '95-98%',
      recommended: false,
      features: [
        'All Balanced mode features',
        'Vision AI on every page',
        'Chain-of-thought analysis',
        'Multi-pass validation',
        'Confidence scoring per item',
      ],
      bestFor: [
        'Critical drawings',
        'Low-quality scans',
        'Complex symbols/annotations',
        'Maximum accuracy required',
      ],
    },
    {
      id: 'vision_only',
      label: 'Vision-Only',
      icon: '👁️',
      description: 'Pure AI Vision (no OCR)',
      details: 'Skip all OCR engines, use only Vision AI',
      usesVisionAPI: true,
      requiresApiKey: true,
      cost: '$0.25-0.60/page',
      costPerPage: 0.25,
      costPerPageMax: 0.60,
      estimatedTime: '70-130 sec/page',
      accuracy: '92-97%',
      recommended: false,
      features: [
        'Pure Vision AI extraction',
        'No OCR preprocessing',
        'Spatial understanding',
        'Symbol recognition',
        'Handwriting analysis',
      ],
      bestFor: [
        'Benchmark testing',
        'OCR consistently fails',
        'Research/comparison',
        'Unusual drawing formats',
      ],
    },
  ],

  // Vision AI Provider Options
  providers: [
    {
      id: 'openai',
      name: 'OpenAI',
      label: 'OpenAI GPT-4 Vision',
      model: 'gpt-4o',
      icon: '🤖',
      costPer1kTokensInput: 0.0025,
      costPer1kTokensOutput: 0.010,
      costPerImage: 0.01275,  // High-res mode
      strengths: [
        'Best overall accuracy',
        'Structured JSON output',
        'Chain-of-thought reasoning',
        'Fast response time',
      ],
      limitations: [
        'Higher cost than alternatives',
        'Rate limits on free tier',
      ],
    },
    {
      id: 'claude',
      name: 'Claude',
      label: 'Claude 3.5 Sonnet Vision',
      model: 'claude-3-5-sonnet-20241022',
      icon: '🧠',
      costPer1kTokensInput: 0.003,
      costPer1kTokensOutput: 0.015,
      strengths: [
        'Excellent technical understanding',
        'Long context window',
        'Detailed explanations',
        'Good with complex diagrams',
      ],
      limitations: [
        'Slightly slower than OpenAI',
        'Higher output costs',
      ],
    },
    {
      id: 'gemini',
      name: 'Gemini',
      label: 'Google Gemini Flash Vision',
      model: 'gemini-1.5-flash',
      icon: '✨',
      costPer1kTokensInput: 0.000125,
      costPer1kTokensOutput: 0.000375,
      strengths: [
        'Lowest cost',
        'Very fast',
        'Large context window',
      ],
      limitations: [
        'Less accurate for technical drawings',
        'JSON output less reliable',
        'Not yet implemented',
      ],
      comingSoon: true,
    },
  ],

  // Default Settings
  defaults: {
    mode: 'balanced',
    provider: 'openai',
  },

  // Storage Keys (Session Storage)
  storageKeys: {
    apiKey: 'pidv2_user_api_key',
    mode: 'pidv2_extraction_mode',
    provider: 'pidv2_vision_provider',
    showApiKey: 'pidv2_show_api_key',
  },

  // API Endpoints
  endpoints: {
    startExtraction: '/api/v2/pid-verification/projects/{project_id}/extract/',
    extractionStatus: '/api/v2/pid-verification/extractions/{extraction_id}/status/',
    extractionResults: '/api/v2/pid-verification/extractions/{extraction_id}/',
  },

  // Cost Estimation
  costEstimation: {
    // Average P&ID drawing size
    avgPIDPages: 10,
    avgLegendPages: 5,
    avgEquipmentListPages: 20,
    avgLineListPages: 30,
    avgPMSPages: 15,

    // Typical project composition
    typicalProject: {
      pidDrawings: 20,
      legendSheets: 2,
      equipmentLists: 1,
      lineLists: 1,
      pms: 1,
    },
  },

  // Progress Tracking
  progress: {
    pollInterval: 2000,  // Poll every 2 seconds
    maxRetries: 300,     // 10 minutes max (2s * 300 = 600s)
  },

  // UI Display
  ui: {
    showCostEstimate: true,
    showProcessingTime: true,
    showAccuracyEstimate: true,
    showFeatureComparison: true,
    allowProviderSelection: true,
    requireBYOKForDeep: true,  // Force BYOK for deep/vision-only modes
  },
};

/**
 * Calculate estimated cost for extraction
 * @param {object} params - { mode, files: { pidDrawings, legendSheets, equipmentLists, lineLists, pms } }
 * @returns {object} - { min: number, max: number, currency: 'USD' }
 */
export function estimateExtractionCost({ mode, files }) {
  const modeConfig = EXTRACTION_CONFIG.modes.find(m => m.id === mode);
  if (!modeConfig || !modeConfig.usesVisionAPI) {
    return { min: 0, max: 0, currency: 'USD' };
  }

  const costConfig = EXTRACTION_CONFIG.costEstimation;

  const totalPages =
    (files.pidDrawings || 0) * costConfig.avgPIDPages +
    (files.legendSheets || 0) * costConfig.avgLegendPages +
    (files.equipmentLists || 0) * costConfig.avgEquipmentListPages +
    (files.lineLists || 0) * costConfig.avgLineListPages +
    (files.pms || 0) * costConfig.avgPMSPages;

  const minCost = totalPages * (modeConfig.costPerPage || 0);
  const maxCost = totalPages * (modeConfig.costPerPageMax || modeConfig.costPerPage || 0);

  return {
    min: parseFloat(minCost.toFixed(2)),
    max: parseFloat(maxCost.toFixed(2)),
    currency: 'USD',
    totalPages,
  };
}

/**
 * Calculate estimated processing time
 * @param {object} params - { mode, totalPages }
 * @returns {object} - { min: seconds, max: seconds, display: string }
 */
export function estimateProcessingTime({ mode, totalPages }) {
  const modeConfig = EXTRACTION_CONFIG.modes.find(m => m.id === mode);
  if (!modeConfig) {
    return { min: 0, max: 0, display: 'Unknown' };
  }

  // Parse estimatedTime string (e.g., "10-30 sec/page")
  const match = modeConfig.estimatedTime.match(/(\d+)-(\d+)/);
  if (!match) {
    return { min: 0, max: 0, display: 'Unknown' };
  }

  const minPerPage = parseInt(match[1]);
  const maxPerPage = parseInt(match[2]);

  const minSeconds = totalPages * minPerPage;
  const maxSeconds = totalPages * maxPerPage;

  // Format display
  const formatTime = (seconds) => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}min`;
    return `${Math.round(seconds / 3600)}hr`;
  };

  return {
    min: minSeconds,
    max: maxSeconds,
    display: `${formatTime(minSeconds)}-${formatTime(maxSeconds)}`,
  };
}

export default EXTRACTION_CONFIG;
