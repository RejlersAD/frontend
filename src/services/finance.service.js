/**
 * Finance Module API Service
 * Handles all finance-related API calls
 */

import apiClient from './api.service';
import { API_BASE_URL } from '../config/api.config';

const API_BASE = '/finance';

const financeService = {
  /**
   * Upload a new invoice
   */
  async uploadInvoice(file) {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await apiClient.post(`${API_BASE}/invoices/upload/`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  /**
   * Get list of invoices with optional filtering
   */
  async getInvoices(filters = {}) {
    const params = new URLSearchParams();
    if (filters.status) params.append('status', filters.status);
    if (filters.invoice_type) params.append('invoice_type', filters.invoice_type);
    if (filters.search) params.append('search', filters.search);
    
    const response = await apiClient.get(`${API_BASE}/invoices/?${params.toString()}`);
    return response.data;
  },

  /**
   * Get single invoice details
   */
  async getInvoice(id) {
    const response = await apiClient.get(`${API_BASE}/invoices/${id}/`);
    return response.data;
  },

  /**
   * Trigger AI processing for an invoice
   */
  async processInvoice(id) {
    const response = await apiClient.post(`${API_BASE}/invoices/${id}/process/`);
    return response.data;
  },

  /**
   * Preview invoice PDF
   */
  getInvoicePreviewUrl(id) {
    // Use centralized API config for consistent backend URL
    // Remove /api/v1 from API_BASE_URL for full domain
    const backendUrl = API_BASE_URL.replace('/api/v1', '');
    
    // Get auth token for authenticated PDF access
    const token = localStorage.getItem('radai_access_token');
    return `${backendUrl}/api/v1/finance/invoices/${id}/preview/?token=${token}`;
  },

  /**
   * Approve an invoice
   */
  async approveInvoice(approvalToken, comments = '') {
    const response = await apiClient.post(`${API_BASE}/approvals/${approvalToken}/approve/`, {
      comments,
    });
    return response.data;
  },

  /**
   * Reject an invoice
   */
  async rejectInvoice(approvalToken, comments) {
    const response = await apiClient.post(`${API_BASE}/approvals/${approvalToken}/reject/`, {
      comments,
    });
    return response.data;
  },

  /**
   * Export invoice data
   */
  async exportInvoices(format = 'excel', filters = {}) {
    const response = await apiClient.post(
      `${API_BASE}/invoices/export/`,
      { format, ...filters },
      { responseType: 'blob' }
    );
    
    // Create download link
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `invoices_export.${format === 'excel' ? 'xlsx' : format}`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    
    return response.data;
  },

  /**
   * Get approval routes
   */
  async getApprovalRoutes() {
    const response = await apiClient.get(`${API_BASE}/approval-routes/`);
    return response.data;
  },

  /**
   * Get audit logs for an invoice
   */
  async getAuditLogs(invoiceId) {
    const response = await apiClient.get(`${API_BASE}/audit-logs/?invoice=${invoiceId}`);
    return response.data;
  },

  // ========================================
  // SALARY SLIP API METHODS
  // ========================================

  /**
   * Get salary slips with optional filtering
   */
  async getSalarySlips(params = {}) {
    const queryParams = new URLSearchParams(params);
    const response = await apiClient.get(`${API_BASE}/salary-slips/?${queryParams.toString()}`);
    return response.data;
  },

  /**
   * Get salary slip statistics for dashboard
   */
  async getSalarySlipStats() {
    const response = await apiClient.get(`${API_BASE}/salary-slips/stats/`);
    return response.data;
  },

  /**
   * Get single salary slip details
   */
  async getSalarySlip(id) {
    const response = await apiClient.get(`${API_BASE}/salary-slips/${id}/`);
    return response.data;
  },

  /**
   * Generate PDF for a salary slip
   */
  async generateSalarySlipPDF(id) {
    const response = await apiClient.post(`${API_BASE}/salary-slips/${id}/generate_pdf/`);
    return response.data;
  },

  /**
   * Send salary slip email to employee
   */
  async sendSalarySlipEmail(id) {
    const response = await apiClient.post(`${API_BASE}/salary-slips/${id}/send_email/`);
    return response.data;
  },

  /**
   * Send bulk salary slip emails
   */
  async bulkSendSalarySlipEmails(slipIds, customMessage = '') {
    const response = await apiClient.post(`${API_BASE}/salary-slips/bulk_send_email/`, {
      salary_slip_ids: slipIds,
      custom_message: customMessage
    });
    return response.data;
  },

  /**
   * Approve a salary slip
   */
  async approveSalarySlip(id) {
    const response = await apiClient.post(`${API_BASE}/salary-slips/${id}/approve/`);
    return response.data;
  },

  /**
   * Reject a salary slip
   */
  async rejectSalarySlip(id, reason = '') {
    const response = await apiClient.post(`${API_BASE}/salary-slips/${id}/reject/`, {
      reason
    });
    return response.data;
  },

  /**
   * Get employee salary information list
   */
  async getEmployeeSalaryInfo(params = {}) {
    const queryParams = new URLSearchParams(params);
    const response = await apiClient.get(`${API_BASE}/employee-salary-info/?${queryParams.toString()}`);
    return response.data;
  },

  /**
   * Get payroll runs
   */
  async getPayrollRuns(params = {}) {
    const queryParams = new URLSearchParams(params);
    const response = await apiClient.get(`${API_BASE}/payroll-runs/?${queryParams.toString()}`);
    return response.data;
  },

  /**
   * Process a payroll run (generate slips for all employees)
   */
  async processPayrollRun(payrollRunId) {
    const response = await apiClient.post(`${API_BASE}/payroll-runs/${payrollRunId}/process/`);
    return response.data;
  },
};

export default financeService;


