/**
 * QHSE Service - Django API Integration
 * Replaces Google Sheets API with Django REST API
 * Maintains backward compatibility with existing hooks
 */

import { API_BASE_URL } from '../config/api.config';

/**
 * Get authentication headers
 */
const getAuthHeaders = () => {
  const token = localStorage.getItem('radai_access_token') || localStorage.getItem('access');
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
};

/**
 * Handle API responses
 * Supports DRF field-level validation error dicts: { fieldName: ["msg", ...], ... }
 * as well as the standard { detail: "..." } format.
 */
const handleResponse = async (response) => {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: 'Request failed' }));
    const message =
      errorData.detail ||
      (errorData.non_field_errors && errorData.non_field_errors.join(', ')) ||
      Object.entries(errorData)
        .map(([field, errs]) => `${field}: ${Array.isArray(errs) ? errs.join(', ') : errs}`)
        .join(' | ') ||
      'API request failed';
    throw new Error(message);
  }
  return response.json();
};

/**
 * QHSE Running Projects API
 */
export const qhseProjectsAPI = {
  /**
   * Get all running projects
   * @param {Object} filters - Query parameters for filtering
   * @returns {Promise<Array>} List of projects
   */
  async getAll(filters = {}) {
    const queryParams = new URLSearchParams(filters).toString();
    const url = `${API_BASE_URL}/qhse/projects/${queryParams ? `?${queryParams}` : ''}`;
    const response = await fetch(url, { headers: getAuthHeaders() });
    return handleResponse(response);
  },

  /**
   * Get single project by ID
   * @param {number} id - Project ID
   * @returns {Promise<Object>} Project details
   */
  async getById(id) {
    const response = await fetch(`${API_BASE_URL}/qhse/projects/${id}/`, {
      headers: getAuthHeaders()
    });
    return handleResponse(response);
  },

  /**
   * Create new project
   * @param {Object} projectData - Project data
   * @returns {Promise<Object>} Created project
   */
  async create(projectData) {
    const response = await fetch(`${API_BASE_URL}/qhse/projects/`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(projectData)
    });
    return handleResponse(response);
  },

  /**
   * Update existing project
   * @param {number} id - Project ID
   * @param {Object} projectData - Updated project data
   * @returns {Promise<Object>} Updated project
   */
  async update(id, projectData) {
    const response = await fetch(`${API_BASE_URL}/qhse/projects/${id}/`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(projectData)
    });
    return handleResponse(response);
  },

  /**
   * Partial update project
   * @param {number} id - Project ID
   * @param {Object} projectData - Fields to update
   * @returns {Promise<Object>} Updated project
   */
  async patch(id, projectData) {
    const response = await fetch(`${API_BASE_URL}/qhse/projects/${id}/`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify(projectData)
    });
    return handleResponse(response);
  },

  /**
   * Delete project (soft or hard)
   * @param {number} id - Project ID
   * @param {Object} options - Delete options
   * @param {boolean} options.hardDelete - If true, permanently delete. If false, soft delete (default)
   * @returns {Promise<Object>} Response with success message
   */
  async delete(id, options = {}) {
    const { hardDelete = false } = options;
    const queryParams = hardDelete ? '?hard_delete=true' : '';
    const url = `${API_BASE_URL}/qhse/projects/${id}/${queryParams}`;
    
    console.log('[QHSE Service] 🗑️ Delete request:', {
      id,
      hardDelete,
      url,
      API_BASE_URL
    });
    
    const response = await fetch(url, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    
    console.log('[QHSE Service] 📡 Delete response:', response.status, response.statusText);
    
    return handleResponse(response);
  },

  /**
   * Get dashboard statistics
   * @returns {Promise<Object>} Dashboard stats
   */
  async getDashboardStats() {
    const response = await fetch(`${API_BASE_URL}/qhse/projects/dashboard_stats/`, {
      headers: getAuthHeaders()
    });
    return handleResponse(response);
  },

  /**
   * Duplicate project
   * @param {number} id - Project ID to duplicate
   * @returns {Promise<Object>} Duplicated project
   */
  async duplicate(id) {
    const response = await fetch(`${API_BASE_URL}/qhse/projects/${id}/duplicate/`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    return handleResponse(response);
  }
};

// ============================================================================
// QHSE Spot Check Register API - DISABLED per QHSE Manager decision
// ============================================================================
// export const qhseSpotChecksAPI = {
//   /**
//    * Get all spot checks
//    * @param {Object} filters - Query parameters for filtering
//    * @returns {Promise<Array>} List of spot checks
//    */
//   async getAll(filters = {}) {
//     const queryParams = new URLSearchParams(filters).toString();
//     const url = `${API_BASE_URL}/qhse/spot-checks/${queryParams ? `?${queryParams}` : ''}`;
//     const response = await fetch(url, { headers: getAuthHeaders() });
//     return handleResponse(response);
//   },
//
//   /**
//    * Get single spot check by ID
//    * @param {number} id - Spot check ID
//    * @returns {Promise<Object>} Spot check details
//    */
//   async getById(id) {
//     const response = await fetch(`${API_BASE_URL}/qhse/spot-checks/${id}/`, {
//       headers: getAuthHeaders()
//     });
//     return handleResponse(response);
//   },
//
//   /**
//    * Create new spot check
//    * @param {Object} spotCheckData - Spot check data
//    * @returns {Promise<Object>} Created spot check
//    */
//   async create(spotCheckData) {
//     const response = await fetch(`${API_BASE_URL}/qhse/spot-checks/`, {
//       method: 'POST',
//       headers: getAuthHeaders(),
//       body: JSON.stringify(spotCheckData)
//     });
//     return handleResponse(response);
//   },
//
//   /**
//    * Update existing spot check
//    * @param {number} id - Spot check ID
//    * @param {Object} spotCheckData - Updated data
//    * @returns {Promise<Object>} Updated spot check
//    */
//   async update(id, spotCheckData) {
//     const response = await fetch(`${API_BASE_URL}/qhse/spot-checks/${id}/`, {
//       method: 'PUT',
//       headers: getAuthHeaders(),
//       body: JSON.stringify(spotCheckData)
//     });
//     return handleResponse(response);
//   },
//
//   /**
//    * Delete spot check
//    * @param {number} id - Spot check ID
//    * @returns {Promise<void>}
//    */
//   async delete(id) {
//     const response = await fetch(`${API_BASE_URL}/qhse/spot-checks/${id}/`, {
//       method: 'DELETE',
//       headers: getAuthHeaders()
//     });
//     if (!response.ok) {
//       throw new Error('Failed to delete spot check');
//     }
//   },
//
//   /**
//    * Get spot checks grouped by project
//    * @param {Object} filters - Query parameters
//    * @returns {Promise<Array>} Spot checks grouped by project
//    */
//   async getByProject(filters = {}) {
//     const queryParams = new URLSearchParams(filters).toString();
//     const url = `${API_BASE_URL}/qhse/spot-checks/by_project/${queryParams ? `?${queryParams}` : ''}`;
//     const response = await fetch(url, { headers: getAuthHeaders() });
//     return handleResponse(response);
//   }
// };
// ============================================================================

/**
 * QHSE Audits API
 */
export const qhseAuditsAPI = {
  /**
   * Get all audits
   * @param {Object} filters - Query parameters for filtering
   * @returns {Promise<Array>} List of audits
   */
  async getAll(filters = {}) {
    const queryParams = new URLSearchParams(filters).toString();
    const url = `${API_BASE_URL}/qhse/audits/${queryParams ? `?${queryParams}` : ''}`;
    const response = await fetch(url, { headers: getAuthHeaders() });
    return handleResponse(response);
  },

  /**
   * Get single audit by ID
   * @param {number} id - Audit ID
   * @returns {Promise<Object>} Audit details
   */
  async getById(id) {
    const response = await fetch(`${API_BASE_URL}/qhse/audits/${id}/`, {
      headers: getAuthHeaders()
    });
    return handleResponse(response);
  },

  /**
   * Create new audit
   * @param {Object} auditData - Audit data
   * @returns {Promise<Object>} Created audit
   */
  async create(auditData) {
    const response = await fetch(`${API_BASE_URL}/qhse/audits/`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(auditData)
    });
    return handleResponse(response);
  },

  /**
   * Update existing audit
   * @param {number} id - Audit ID
   * @param {Object} auditData - Updated data
   * @returns {Promise<Object>} Updated audit
   */
  async update(id, auditData) {
    const response = await fetch(`${API_BASE_URL}/qhse/audits/${id}/`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(auditData)
    });
    return handleResponse(response);
  },

  /**
   * Delete audit
   * @param {number} id - Audit ID
   * @returns {Promise<void>}
   */
  async delete(id) {
    const response = await fetch(`${API_BASE_URL}/qhse/audits/${id}/`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    if (!response.ok) {
      throw new Error('Failed to delete audit');
    }
  }
};

/**
 * QHSE AI/ML API
 */
export const qhseAIAPI = {
  /**
   * Get AI insights dashboard
   * @returns {Promise<Object>} AI insights and analytics
   */
  async getAIInsights() {
    const response = await fetch(`${API_BASE_URL}/qhse/ai/insights/`, {
      headers: getAuthHeaders()
    });
    return handleResponse(response);
  },

  /**
   * Predict risk for specific project
   * @param {string} projectNo - Project number
   * @returns {Promise<Object>} Risk prediction
   */
  async predictProjectRisk(projectNo) {
    const response = await fetch(`${API_BASE_URL}/qhse/ai/risk-prediction/${projectNo}/`, {
      headers: getAuthHeaders()
    });
    return handleResponse(response);
  },

  /**
   * Predict risks for all projects
   * @param {number} limit - Optional limit
   * @returns {Promise<Object>} All risk predictions
   */
  async predictAllRisks(limit = null) {
    const url = limit 
      ? `${API_BASE_URL}/qhse/ai/risk-prediction/all/?limit=${limit}`
      : `${API_BASE_URL}/qhse/ai/risk-prediction/all/`;
    const response = await fetch(url, { headers: getAuthHeaders() });
    return handleResponse(response);
  },

  /**
   * Classify CAR/NCR using AI
   * @param {string} carText - CAR text to classify
   * @param {Object} context - Optional context
   * @returns {Promise<Object>} Classification result
   */
  async classifyCAR(carText, context = {}) {
    const response = await fetch(`${API_BASE_URL}/qhse/ai/car-classification/`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ car_text: carText, context })
    });
    return handleResponse(response);
  },

  /**
   * Predict required manhours
   * @param {Object} projectDetails - Project details
   * @returns {Promise<Object>} Manhour prediction
   */
  async predictManhours(projectDetails) {
    const response = await fetch(`${API_BASE_URL}/qhse/ai/manhour-prediction/`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(projectDetails)
    });
    return handleResponse(response);
  },

  /**
   * Detect anomalies in project
   * @param {string} projectNo - Project number
   * @returns {Promise<Object>} Anomaly detection result
   */
  async detectAnomalies(projectNo) {
    const response = await fetch(`${API_BASE_URL}/qhse/ai/anomaly-detection/${projectNo}/`, {
      headers: getAuthHeaders()
    });
    return handleResponse(response);
  },

  /**
   * Get AI models status
   * @returns {Promise<Object>} Models status and performance
   */
  async getModelsStatus() {
    const response = await fetch(`${API_BASE_URL}/qhse/ai/models/status/`, {
      headers: getAuthHeaders()
    });
    return handleResponse(response);
  },

  /**
   * Analyze remarks using NLP
   * @param {string} remarksText - Text to analyze
   * @param {Array} analysisTypes - Types of analysis ['sentiment', 'entities', 'topics', 'summary']
   * @returns {Promise<Object>} Analysis results
   */
  async analyzeRemarks(remarksText, analysisTypes = ['sentiment', 'entities']) {
    const response = await fetch(`${API_BASE_URL}/qhse/ai/nlp/analyze-remarks/`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ remarks_text: remarksText, analysis_types: analysisTypes })
    });
    return handleResponse(response);
  },

  /**
   * Compare multiple projects using AI
   * @param {Array} projectNos - Array of project numbers
   * @param {Array} comparisonMetrics - Metrics to compare
   * @returns {Promise<Object>} Comparison results
   */
  async compareProjects(projectNos, comparisonMetrics = ['risk_score', 'kpis', 'cars', 'quality_costs']) {
    const response = await fetch(`${API_BASE_URL}/qhse/ai/compare-projects/`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ project_nos: projectNos, comparison_metrics: comparisonMetrics })
    });
    return handleResponse(response);
  },

  /**
   * Get comprehensive AI models registry (real-time)
   * @returns {Promise<Object>} All AI models with configurations and statistics
   */
  async getModelsRegistry() {
    const response = await fetch(`${API_BASE_URL}/qhse/ai/models/registry/`, {
      headers: getAuthHeaders()
    });
    return handleResponse(response);
  },

  /**
   * Get detailed information about a specific model
   * @param {string} modelId - Model identifier
   * @returns {Promise<Object>} Model details
   */
  async getModelDetail(modelId) {
    const response = await fetch(`${API_BASE_URL}/qhse/ai/models/registry/${modelId}/`, {
      headers: getAuthHeaders()
    });
    return handleResponse(response);
  }
};

export default {
  projects: qhseProjectsAPI,
  // spotChecks: qhseSpotChecksAPI,  // Disabled per QHSE Manager decision
  audits: qhseAuditsAPI,
  ai: qhseAIAPI
};
