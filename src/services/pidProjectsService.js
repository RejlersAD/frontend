/**
 * ═══════════════════════════════════════════════════════════════════════════
 * P&ID Projects Service
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Shared project management service for both V1 (P&ID Verification) and 
 * V2 (Line List Extractor). Both versions work with the same projects,
 * legends, and S3 storage structure.
 * 
 * SYNCHRONIZED FEATURES:
 * - Projects: Create, list, update, delete
 * - History: Document uploads per project
 * - Legends: Shared legend sheets (via pidCheckerV2API)
 * - Storage: Same S3 bucket structure
 * 
 * This ensures users can seamlessly switch between V1 and V2 without losing
 * context or duplicating project setup.
 */

import axios from 'axios'
import { API_BASE_URL } from '../config/api.config'

const API_PREFIX = `${API_BASE_URL}/pid-verification`

/**
 * Get authentication header from localStorage
 * Uses the same token keys as V1 for consistency
 */
function authHeader() {
  const token = localStorage.getItem('radai_access_token') || localStorage.getItem('access')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

// ═════════════════════════════════════════════════════════════════════
// PROJECT MANAGEMENT
// ═════════════════════════════════════════════════════════════════════

/**
 * List all projects
 * @returns {Promise<Array>} Array of project objects
 */
export async function listProjects() {
  const res = await axios.get(`${API_PREFIX}/projects/`, { headers: authHeader() })
  return res.data || []
}

/**
 * Create a new project
 * @param {string} projectName - Project name
 * @param {string} description - Optional project description
 * @returns {Promise<Object>} Created project object
 */
export async function createProject(projectName, description = '') {
  const res = await axios.post(
    `${API_PREFIX}/projects/`,
    { project_name: projectName, description },
    { headers: authHeader() }
  )
  return res.data
}

/**
 * Update an existing project
 * @param {number} projectId - Project ID
 * @param {string} projectName - Updated project name
 * @param {string} description - Updated description
 * @returns {Promise<Object>} Updated project object
 */
export async function updateProject(projectId, projectName, description = '') {
  const res = await axios.put(
    `${API_PREFIX}/projects/${projectId}/`,
    { project_name: projectName, description },
    { headers: authHeader() }
  )
  return res.data
}

/**
 * Delete a project
 * @param {number} projectId - Project ID to delete
 * @returns {Promise<void>}
 */
export async function deleteProject(projectId) {
  await axios.delete(`${API_PREFIX}/projects/${projectId}/`, { headers: authHeader() })
}

/**
 * Get project history (list of uploaded documents)
 * @param {number} projectId - Project ID
 * @returns {Promise<Array>} Array of document history objects
 */
export async function getProjectHistory(projectId) {
  const res = await axios.get(`${API_PREFIX}/list/?project_id=${projectId}`, { headers: authHeader() })
  return res.data || []
}

// ═════════════════════════════════════════════════════════════════════
// VERSION COMPATIBILITY
// ═════════════════════════════════════════════════════════════════════

/**
 * Get project compatibility info
 * Projects work seamlessly across V1 and V2:
 * - V1 (pid-verification-v1): Quality checker with 20+ checks
 * - V2 (pid-checker-v2): Line-list extractor with advanced parsing
 * 
 * Both versions share:
 * - Same project database
 * - Same legend sheets (via 'line_list' section)
 * - Same S3 storage structure
 * - Same upload history
 */
export const PROJECT_COMPATIBILITY = {
  v1: {
    route: '/engineering/process/pid-verification-v1',
    name: 'P&ID Verification',
    features: ['Quality checks', 'Compliance', 'ISA-5.1', 'AI Vision'],
  },
  v2: {
    route: '/engineering/process/pid-checker-v2',
    name: 'Line List Extractor',
    features: ['Line tags', 'Advanced parsing', 'Master line list', 'Legend sheets'],
  },
}

/**
 * Check if user can access a project in both versions
 * @returns {boolean} Always true - projects are fully compatible
 */
export function isProjectCompatible() {
  return true // Full compatibility between V1 and V2
}
