/**
 * CRS (Comment Resolution Sheet) API Service
 * Professional data extraction and management service
 */

import axios from 'axios';
import { API_BASE_URL } from '../config/api.config';
import { STORAGE_KEYS } from '../config/app.config';

// Create axios instance with auth headers
const crsApi = axios.create({
  baseURL: `${API_BASE_URL}/crs`,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Enable credentials for CORS with authentication
});

// Add auth token interceptor
crsApi.interceptors.request.use((config) => {
  const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ============= CRS Documents =============

export const fetchCRSDocuments = async (params = {}) => {
  const response = await crsApi.get('/documents/', { params });
  return response.data;
};

export const fetchCRSDocument = async (id) => {
  const response = await crsApi.get(`/documents/${id}/`);
  return response.data;
};

export const createCRSDocument = async (data) => {
  const response = await crsApi.post('/documents/', data);
  return response.data;
};

export const updateCRSDocument = async (id, data) => {
  const response = await crsApi.patch(`/documents/${id}/`, data);
  return response.data;
};

export const deleteCRSDocument = async (id) => {
  const response = await crsApi.delete(`/documents/${id}/`);
  return response.data;
};

export const uploadPDFDocument = async (id, file, additionalData = {}) => {
  const formData = new FormData();
  formData.append('pdf_file', file);
  
  Object.keys(additionalData).forEach(key => {
    formData.append(key, additionalData[key]);
  });
  
  const response = await crsApi.patch(`/documents/${id}/`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

export const extractPDFComments = async (documentId, options = {}) => {
  const response = await crsApi.post(`/documents/${documentId}/extract_pdf_comments/`, {
    auto_create_comments: options.autoCreate !== false,
    debug_mode: options.debug || false,
  });
  return response.data;
};

export const exportToGoogleSheets = async (documentId, options = {}) => {
  const response = await crsApi.post(`/documents/${documentId}/export_to_google_sheets/`, {
    sheet_id: options.sheetId || '',
    start_row: options.startRow || 9,
    auto_export: options.autoExport !== false,
  });
  return response.data;
};

export const getCRSStatistics = async () => {
  const response = await crsApi.get('/documents/statistics/');
  return response.data;
};

// ============= CRS Comments =============

export const fetchCRSComments = async (params = {}) => {
  const response = await crsApi.get('/comments/', { params });
  return response.data;
};

export const fetchCRSComment = async (id) => {
  const response = await crsApi.get(`/comments/${id}/`);
  return response.data;
};

export const updateCRSComment = async (id, data) => {
  const response = await crsApi.patch(`/comments/${id}/`, data);
  return response.data;
};

export const deleteCRSComment = async (id) => {
  const response = await crsApi.delete(`/comments/${id}/`);
  return response.data;
};

export const addContractorResponse = async (commentId, response) => {
  const result = await crsApi.post(`/comments/${commentId}/add_contractor_response/`, {
    response,
  });
  return result.data;
};

export const addCompanyResponse = async (commentId, response) => {
  const result = await crsApi.post(`/comments/${commentId}/add_company_response/`, {
    response,
  });
  return result.data;
};

export const bulkCreateComments = async (documentId, comments) => {
  const response = await crsApi.post('/comments/bulk_create/', {
    document_id: documentId,
    comments,
  });
  return response.data;
};

// ============= CRS Activities =============

export const fetchCRSActivities = async (params = {}) => {
  const response = await crsApi.get('/activities/', { params });
  return response.data;
};

// ============= Google Sheet Config =============

export const fetchGoogleSheetConfigs = async () => {
  const response = await crsApi.get('/google-configs/');
  return response.data;
};

export const createGoogleSheetConfig = async (data) => {
  const response = await crsApi.post('/google-configs/', data);
  return response.data;
};

export const updateGoogleSheetConfig = async (id, data) => {
  const response = await crsApi.patch(`/google-configs/${id}/`, data);
  return response.data;
};

export const testGoogleSheetConnection = async (configId) => {
  const response = await crsApi.post(`/google-configs/${configId}/test_connection/`);
  return response.data;
};

export default {
  // Documents
  fetchCRSDocuments,
  fetchCRSDocument,
  createCRSDocument,
  updateCRSDocument,
  deleteCRSDocument,
  uploadPDFDocument,
  extractPDFComments,
  exportToGoogleSheets,
  getCRSStatistics,
  
  // Comments
  fetchCRSComments,
  fetchCRSComment,
  updateCRSComment,
  deleteCRSComment,
  addContractorResponse,
  addCompanyResponse,
  bulkCreateComments,
  
  // Activities
  fetchCRSActivities,
  
  // Google Sheets
  fetchGoogleSheetConfigs,
  createGoogleSheetConfig,
  updateGoogleSheetConfig,
  testGoogleSheetConnection,
};
