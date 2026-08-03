/**
 * API client for IO List Workflow Projects (Project Management).
 * Thin axios wrapper — all endpoint paths come from the soft-coded config.
 */

import apiClient from './api.service'
import { IO_LIST_WORKFLOW_PROJECT_API } from '../config/ioListWorkflowProjects.config'

const ioListWorkflowProjectsService = {
  /**
   * List all projects with optional filtering.
   * @param {Object} params - Query parameters
   * @param {string} params.status - Filter by status (draft, active, review, completed, archived)
   * @param {string} params.category - Filter by category (oil_gas, refinery, lng, power, water, other)
   * @param {string} params.search - Search query (project name, client, location, code)
   * @returns {Promise<Array>} Array of project objects
   */
  async listProjects({ status, category, search } = {}) {
    const params = {}
    if (status) params.status = status
    if (category) params.category = category
    if (search) params.search = search
    const { data } = await apiClient.get(IO_LIST_WORKFLOW_PROJECT_API.projects, { params })
    return data
  },

  /**
   * Retrieve a single project by ID.
   * @param {number} id - Project ID
   * @returns {Promise<Object>} Project object with document_count
   */
  async getProject(id) {
    const { data } = await apiClient.get(IO_LIST_WORKFLOW_PROJECT_API.projectById(id))
    return data
  },

  /**
   * Create a new project.
   * @param {Object} projectData - Project fields (project_name, category, status, etc.)
   * @returns {Promise<Object>} Created project object
   */
  async createProject(projectData) {
    const { data } = await apiClient.post(IO_LIST_WORKFLOW_PROJECT_API.projects, projectData)
    return data
  },

  /**
   * Update an existing project.
   * @param {number} id - Project ID
   * @param {Object} updates - Partial project fields to update
   * @returns {Promise<Object>} Updated project object
   */
  async updateProject(id, updates) {
    const { data } = await apiClient.patch(
      IO_LIST_WORKFLOW_PROJECT_API.projectById(id),
      updates,
    )
    return data
  },

  /**
   * Delete a project.
   * Documents are unlinked but not deleted (project FK is SET_NULL).
   * @param {number} id - Project ID
   * @returns {Promise<boolean>} True on success
   */
  async deleteProject(id) {
    await apiClient.delete(IO_LIST_WORKFLOW_PROJECT_API.projectById(id))
    return true
  },

  /**
   * Get all documents for a specific project.
   * @param {number} id - Project ID
   * @returns {Promise<Array>} Array of document objects
   */
  async getProjectDocuments(id) {
    const { data } = await apiClient.get(IO_LIST_WORKFLOW_PROJECT_API.projectDocs(id))
    return data
  },
}

export default ioListWorkflowProjectsService
