/**
 * AI Models Configuration - Centralized registry of all AI/ML models used in the application
 * Soft-coded configuration for easy maintenance and updates
 * 
 * @author AIFlow Team
 * @date 2026-01-21
 */

/**
 * AI Model Categories
 */
export const AI_MODEL_CATEGORIES = {
  VISION: 'vision',
  TEXT: 'text',
  EMBEDDING: 'embedding',
  IMAGE_GEN: 'image_generation',
  ANALYSIS: 'analysis',
  CLASSIFICATION: 'classification'
};

/**
 * AI Providers
 */
export const AI_PROVIDERS = {
  OPENAI: {
    id: 'openai',
    name: 'OpenAI',
    website: 'https://openai.com',
    logo: '🤖',
    color: 'from-green-500 to-emerald-600'
  },
  ANTHROPIC: {
    id: 'anthropic',
    name: 'Anthropic',
    website: 'https://anthropic.com',
    logo: '🧠',
    color: 'from-purple-500 to-indigo-600'
  },
  CUSTOM: {
    id: 'custom',
    name: 'Custom Models',
    website: null,
    logo: '⚡',
    color: 'from-blue-500 to-cyan-600'
  }
};

/**
 * Comprehensive AI Models Registry
 * Each model includes detailed information about its usage in the application
 */
export const AI_MODELS_REGISTRY = [
  // ============================================
  // OpenAI GPT-4 Vision Models
  // ============================================
  {
    id: 'gpt-4o',
    name: 'GPT-4 Omni (Vision)',
    provider: AI_PROVIDERS.OPENAI,
    category: AI_MODEL_CATEGORIES.VISION,
    version: 'gpt-4o',
    description: 'Advanced multimodal model for visual analysis and understanding',
    capabilities: [
      'P&ID Drawing Analysis',
      'Engineering Document Verification',
      'Equipment Recognition',
      'Symbol Detection',
      'Layout Understanding'
    ],
    usedIn: [
      {
        module: 'PID Analysis',
        feature: 'P&ID Document Analysis',
        purpose: 'Analyzes P&ID drawings to extract equipment, instruments, and connections',
        file: 'backend/apps/pid_analysis/services_simple.py',
        accuracy: '95%',
        avgResponseTime: '3-5 seconds'
      },
      {
        module: 'PID Analysis',
        feature: 'PFD to P&ID Conversion',
        purpose: 'Converts Process Flow Diagrams to detailed P&ID drawings',
        file: 'backend/apps/pfd_converter/services.py',
        accuracy: '92%',
        avgResponseTime: '4-6 seconds'
      },
      {
        module: 'PFD Converter',
        feature: 'Canvas Format Conversion',
        purpose: 'Extracts P&ID elements for editable canvas format',
        file: 'backend/apps/pfd_converter/pid_to_canvas_converter.py',
        accuracy: '90%',
        avgResponseTime: '2-4 seconds'
      }
    ],
    specifications: {
      maxTokens: 16000,
      contextWindow: '128K tokens',
      temperature: 0.1,
      imageDetail: 'high',
      costPer1KTokens: {
        input: 0.005,
        output: 0.015
      }
    },
    status: 'active',
    lastUpdated: '2026-01-21'
  },

  // ============================================
  // OpenAI GPT-4 Text Models
  // ============================================
  {
    id: 'gpt-4',
    name: 'GPT-4',
    provider: AI_PROVIDERS.OPENAI,
    category: AI_MODEL_CATEGORIES.TEXT,
    version: 'gpt-4',
    description: 'Advanced language model for complex reasoning and analysis',
    capabilities: [
      'Invoice Classification',
      'Document Analysis',
      'Text Extraction',
      'Data Classification',
      'Intelligent Reasoning'
    ],
    usedIn: [
      {
        module: 'Finance',
        feature: 'Invoice Classification',
        purpose: 'Classifies invoices into IT, Project, Finance, or Admin categories',
        file: 'backend/apps/finance/services/ai_classifier.py',
        accuracy: '97%',
        avgResponseTime: '1-2 seconds'
      },
      {
        module: 'Finance',
        feature: 'Invoice Data Extraction',
        purpose: 'Extracts vendor, amount, invoice number, and line items from invoices',
        file: 'backend/apps/finance/services/ai_classifier.py',
        accuracy: '95%',
        avgResponseTime: '1-2 seconds'
      }
    ],
    specifications: {
      maxTokens: 500,
      contextWindow: '8K tokens',
      temperature: 0.1,
      costPer1KTokens: {
        input: 0.03,
        output: 0.06
      }
    },
    status: 'active',
    lastUpdated: '2026-01-21'
  },

  // ============================================
  // OpenAI Embedding Models
  // ============================================
  {
    id: 'text-embedding-3-small',
    name: 'Text Embedding 3 Small',
    provider: AI_PROVIDERS.OPENAI,
    category: AI_MODEL_CATEGORIES.EMBEDDING,
    version: 'text-embedding-3-small',
    description: 'Efficient text embedding model for semantic search and similarity',
    capabilities: [
      'Text Vectorization',
      'Semantic Search',
      'Document Similarity',
      'Context Retrieval',
      'Knowledge Base Integration'
    ],
    usedIn: [
      {
        module: 'PID Analysis',
        feature: 'RAG (Retrieval Augmented Generation)',
        purpose: 'Generates embeddings for engineering knowledge base and domain expertise',
        file: 'backend/apps/pid_analysis/rag_service.py',
        accuracy: '93%',
        avgResponseTime: '<1 second'
      },
      {
        module: 'PID Analysis',
        feature: 'Context-Aware Analysis',
        purpose: 'Retrieves relevant engineering standards and best practices',
        file: 'backend/apps/pid_analysis/rag_service.py',
        accuracy: '91%',
        avgResponseTime: '<1 second'
      }
    ],
    specifications: {
      dimensions: 1536,
      maxInputTokens: 8191,
      costPer1KTokens: {
        input: 0.0001,
        output: 0
      }
    },
    status: 'active',
    lastUpdated: '2026-01-21'
  },

  // ============================================
  // OpenAI Image Generation Models
  // ============================================
  {
    id: 'dall-e-3',
    name: 'DALL-E 3',
    provider: AI_PROVIDERS.OPENAI,
    category: AI_MODEL_CATEGORIES.IMAGE_GEN,
    version: 'dall-e-3',
    description: 'Advanced AI image generation for engineering drawings',
    capabilities: [
      'P&ID Drawing Generation',
      'Engineering Diagram Creation',
      'Visual Representation',
      'Custom Symbol Generation'
    ],
    usedIn: [
      {
        module: 'PFD Converter',
        feature: 'AI-Generated P&ID Drawings',
        purpose: 'Generates professional P&ID drawings from PFD descriptions',
        file: 'backend/apps/pfd_converter/services.py',
        accuracy: '88%',
        avgResponseTime: '10-15 seconds'
      }
    ],
    specifications: {
      resolution: '1024x1024',
      style: 'natural',
      quality: 'standard',
      costPerImage: 0.04
    },
    status: 'active',
    lastUpdated: '2026-01-21'
  },

  // ============================================
  // Custom AI/ML Models
  // ============================================
  {
    id: 'crs-risk-analyzer',
    name: 'CRS Risk Analysis Engine',
    provider: AI_PROVIDERS.CUSTOM,
    category: AI_MODEL_CATEGORIES.ANALYSIS,
    version: '1.0',
    description: 'Custom ML model for CRS revision risk assessment',
    capabilities: [
      'Risk Score Calculation',
      'Pattern Detection',
      'Completion Prediction',
      'Comment Analysis',
      'Trend Forecasting'
    ],
    usedIn: [
      {
        module: 'CRS (Comment Resolution Sheet)',
        feature: 'Risk Assessment',
        purpose: 'Calculates risk scores for comment revision chains',
        file: 'backend/apps/crs/ai_service.py',
        accuracy: '89%',
        avgResponseTime: '<1 second'
      },
      {
        module: 'CRS',
        feature: 'Pattern Recognition',
        purpose: 'Detects similar comments and suggests linking',
        file: 'backend/apps/crs/ai_service.py',
        accuracy: '85%',
        avgResponseTime: '<1 second'
      },
      {
        module: 'CRS',
        feature: 'Completion Date Prediction',
        purpose: 'Predicts project completion dates based on historical data',
        file: 'backend/apps/crs/ai_service.py',
        accuracy: '82%',
        avgResponseTime: '<1 second'
      }
    ],
    specifications: {
      algorithm: 'Hybrid Rule-Based + ML',
      features: ['Text Similarity', 'Time Series', 'Status Patterns'],
      trainingData: 'Historical CRS data',
      lastRetrained: '2025-12-15'
    },
    status: 'active',
    lastUpdated: '2026-01-21'
  },

  // ============================================
  // Admin Analytics AI Models
  // ============================================
  {
    id: 'predictive-insights-engine',
    name: 'Predictive Insights Engine',
    provider: AI_PROVIDERS.CUSTOM,
    category: AI_MODEL_CATEGORIES.ANALYSIS,
    version: '2.0',
    description: 'ML-powered predictive analytics for system management',
    capabilities: [
      'Usage Forecasting',
      'Capacity Planning',
      'User Churn Prediction',
      'Performance Optimization',
      'Cost Optimization',
      'Security Risk Prediction'
    ],
    usedIn: [
      {
        module: 'Admin Dashboard',
        feature: 'AI Insights',
        purpose: 'Generates predictions and recommendations for proactive management',
        file: 'backend/apps/rbac/analytics_models.py',
        accuracy: '87%',
        avgResponseTime: '<2 seconds'
      },
      {
        module: 'Admin Dashboard',
        feature: 'System Health Monitoring',
        purpose: 'Predicts system issues before they occur',
        file: 'backend/apps/rbac/analytics_models.py',
        accuracy: '91%',
        avgResponseTime: '<1 second'
      }
    ],
    specifications: {
      algorithm: 'Time Series + Neural Network',
      features: ['Usage Patterns', 'Resource Metrics', 'User Behavior'],
      trainingData: 'System logs, metrics, user activity',
      retrainingFrequency: 'Weekly',
      lastRetrained: '2026-01-15'
    },
    status: 'active',
    lastUpdated: '2026-01-21'
  }
];

/**
 * Get models by category
 */
export const getModelsByCategory = (category) => {
  return AI_MODELS_REGISTRY.filter(model => model.category === category);
};

/**
 * Get models by provider
 */
export const getModelsByProvider = (providerId) => {
  return AI_MODELS_REGISTRY.filter(model => model.provider.id === providerId);
};

/**
 * Get model by ID
 */
export const getModelById = (modelId) => {
  return AI_MODELS_REGISTRY.find(model => model.id === modelId);
};

/**
 * Get all active models
 */
export const getActiveModels = () => {
  return AI_MODELS_REGISTRY.filter(model => model.status === 'active');
};

/**
 * Get models used in a specific module
 */
export const getModelsByModule = (moduleName) => {
  return AI_MODELS_REGISTRY.filter(model => 
    model.usedIn.some(usage => usage.module === moduleName)
  );
};

/**
 * Statistics
 */
export const AI_MODELS_STATS = {
  totalModels: AI_MODELS_REGISTRY.length,
  activeModels: getActiveModels().length,
  providers: Object.keys(AI_PROVIDERS).length,
  categories: Object.keys(AI_MODEL_CATEGORIES).length,
  totalModules: [...new Set(
    AI_MODELS_REGISTRY.flatMap(model => 
      model.usedIn.map(usage => usage.module)
    )
  )].length
};

export default AI_MODELS_REGISTRY;
