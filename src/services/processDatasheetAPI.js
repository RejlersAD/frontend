/**
 * Process Datasheet API Service
 * Centralized API calls for datasheet operations
 * Soft-coded endpoints and configurations
 */

import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';
const API_PREFIX = '/process-datasheet';

/**
 * Process Datasheet API Service
 */
class ProcessDatasheetAPI {
  
  // ========== Equipment Types ==========
  
  async getEquipmentTypes() {
    const response = await axios.get(`${API_BASE_URL}${API_PREFIX}/equipment-types/`);
    return response.data;
  }

  async getEquipmentType(id) {
    const response = await axios.get(`${API_BASE_URL}${API_PREFIX}/equipment-types/${id}/`);
    return response.data;
  }

  // ========== Datasheets ==========
  
  async getDatasheets(params = {}) {
    const response = await axios.get(`${API_BASE_URL}${API_PREFIX}/datasheets/`, { params });
    return response.data;
  }

  async getDatasheet(id) {
    const response = await axios.get(`${API_BASE_URL}${API_PREFIX}/datasheets/${id}/`);
    return response.data;
  }

  async createDatasheet(data) {
    const response = await axios.post(`${API_BASE_URL}${API_PREFIX}/datasheets/`, data);
    return response.data;
  }

  async updateDatasheet(id, data) {
    const response = await axios.patch(`${API_BASE_URL}${API_PREFIX}/datasheets/${id}/`, data);
    return response.data;
  }

  async deleteDatasheet(id) {
    const response = await axios.delete(`${API_BASE_URL}${API_PREFIX}/datasheets/${id}/`);
    return response.data;
  }

  // ========== Calculations ==========
  
  async calculateDatasheet(id) {
    const response = await axios.post(`${API_BASE_URL}${API_PREFIX}/datasheets/${id}/calculate/`);
    return response.data;
  }

  // ========== Validation ==========
  
  async validateDatasheet(id) {
    const response = await axios.post(`${API_BASE_URL}${API_PREFIX}/datasheets/${id}/validate/`);
    return response.data;
  }

  // ========== PDF Extraction ==========
  
  async uploadAndExtract(file, equipmentTypeId, workflowType = 'pdf_extraction_complete') {
    const formData = new FormData();
    formData.append('pdf_file', file);
    formData.append('equipment_type', equipmentTypeId);
    formData.append('workflow_type', workflowType);
    formData.append('extraction_mode', 'hybrid');

    const response = await axios.post(
      `${API_BASE_URL}${API_PREFIX}/extraction-jobs/`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      }
    );
    return response.data;
  }

  async getExtractionJob(id) {
    const response = await axios.get(`${API_BASE_URL}${API_PREFIX}/extraction-jobs/${id}/`);
    return response.data;
  }

  async getExtractionJobs(params = {}) {
    const response = await axios.get(`${API_BASE_URL}${API_PREFIX}/extraction-jobs/`, { params });
    return response.data;
  }

  // ========== Statistics ==========
  
  async getStatistics() {
    const response = await axios.get(`${API_BASE_URL}${API_PREFIX}/datasheets/statistics/`);
    return response.data;
  }
}

// Export singleton instance
export default new ProcessDatasheetAPI();
