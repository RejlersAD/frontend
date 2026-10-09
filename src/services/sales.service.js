/**
 * Sales Management API Service
 * Handles all Sales/CRM API calls including AI-powered features
 */

import apiClient from "./api.service";
import { API_TIMEOUT_UPLOAD, API_BASE_URL } from '../config/api.config';
import { STORAGE_KEYS } from '../config/app.config';
import { responseFilename } from '../utils/downloadFilename';

const BASE_URL = "/sales";

// These screens own inline recovery. Keep email data, cursors and review tokens
// out of the shared interceptor's detailed error logs and duplicate toasts.
const EMAIL_REQUEST_OPTIONS = {
  silentTimeout: true,
  suppressErrorToast: true,
};

class SalesService {
  getApiOrigin() {
    if (API_BASE_URL.startsWith('http')) {
      return new URL(API_BASE_URL).origin;
    }
    if (typeof window !== 'undefined' && window.location?.origin) {
      return window.location.origin;
    }
    return '';
  }

  toBackendAbsoluteUrl(pathOrUrl) {
    if (!pathOrUrl) return '';
    if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;

    const origin = this.getApiOrigin();
    if (!origin) return pathOrUrl;
    if (pathOrUrl.startsWith('/')) return `${origin}${pathOrUrl}`;
    return `${origin}/${pathOrUrl}`;
  }

  // ============================================================================
  // CLIENT MANAGEMENT
  // ============================================================================

  /**
   * Get all clients with optional filtering
   * @param {Object} params - Query parameters (search, industry, tier, status, page, page_size)
   */
  async getClients(params = {}) {
    const response = await apiClient.get(`${BASE_URL}/clients/`, { params });
    return response.data;
  }

  /**
   * Get a single client by ID
   * @param {string} clientId - Client UUID
   */
  async getClient(clientId) {
    const response = await apiClient.get(`${BASE_URL}/clients/${clientId}/`);
    return response.data;
  }

  /**
   * Create a new client
   * @param {Object} clientData - Client information
   */
  async createClient(clientData) {
    const response = await apiClient.post(`${BASE_URL}/clients/`, clientData);
    return response.data;
  }

  /**
   * Update an existing client
   * @param {string} clientId - Client UUID
   * @param {Object} clientData - Updated client information
   */
  async updateClient(clientId, clientData) {
    const response = await apiClient.put(
      `${BASE_URL}/clients/${clientId}/`,
      clientData,
    );
    return response.data;
  }

  /**
   * Partially update a client
   * @param {string} clientId - Client UUID
   * @param {Object} clientData - Partial client data
   */
  async patchClient(clientId, clientData) {
    const response = await apiClient.patch(
      `${BASE_URL}/clients/${clientId}/`,
      clientData,
    );
    return response.data;
  }

  /**
   * Delete a client
   * @param {string} clientId - Client UUID
   */
  async deleteClient(clientId) {
    const response = await apiClient.delete(`${BASE_URL}/clients/${clientId}/`);
    return response.data;
  }

  /**
   * Calculate client health score (AI-powered)
   * @param {string} clientId - Client UUID
   */
  async calculateHealthScore(clientId) {
    const response = await apiClient.post(
      `${BASE_URL}/clients/${clientId}/calculate_health_score/`,
    );
    return response.data;
  }

  /**
   * Predict client churn risk (AI-powered)
   * @param {string} clientId - Client UUID
   */
  async predictChurn(clientId) {
    const response = await apiClient.get(
      `${BASE_URL}/clients/${clientId}/churn_prediction/`,
    );
    return response.data;
  }

  /**
   * Get AI insights for a client
   * @param {string} clientId - Client UUID
   */
  async getClientInsights(clientId) {
    const response = await apiClient.get(
      `${BASE_URL}/clients/${clientId}/insights/`,
    );
    return response.data;
  }

  /**
   * Get at-risk clients (high churn probability)
   */
  async getAtRiskClients() {
    const response = await apiClient.get(`${BASE_URL}/clients/at_risk/`);
    return response.data;
  }

  /**
   * Get top clients by revenue or health score
   * @param {Object} params - limit, orderBy (revenue | health_score)
   */
  async getTopClients(params = {}) {
    const response = await apiClient.get(`${BASE_URL}/clients/top_clients/`, {
      params,
    });
    return response.data;
  }

  // ============================================================================
  // CONTACT MANAGEMENT
  // ============================================================================

  /**
   * Get all contacts
   * @param {Object} params - Query parameters
   */
  async getContacts(params = {}) {
    const response = await apiClient.get(`${BASE_URL}/contacts/`, { params });
    return response.data;
  }

  /**
   * Get contacts for a specific client
   * @param {string} clientId - Client UUID
   */
  async getContactsByClient(clientId) {
    const response = await apiClient.get(`${BASE_URL}/contacts/by_client/`, {
      params: { client_id: clientId },
    });
    return response.data;
  }

  /**
   * Get a single contact by ID
   * @param {string} contactId - Contact UUID
   */
  async getContact(contactId) {
    const response = await apiClient.get(`${BASE_URL}/contacts/${contactId}/`);
    return response.data;
  }

  /**
   * Create a new contact
   * @param {Object} contactData - Contact information
   */
  async createContact(contactData) {
    const response = await apiClient.post(`${BASE_URL}/contacts/`, contactData);
    return response.data;
  }

  /**
   * Update a contact
   * @param {string} contactId - Contact UUID
   * @param {Object} contactData - Updated contact information
   */
  async updateContact(contactId, contactData) {
    const response = await apiClient.put(
      `${BASE_URL}/contacts/${contactId}/`,
      contactData,
    );
    return response.data;
  }

  /**
   * Delete a contact
   * @param {string} contactId - Contact UUID
   */
  async deleteContact(contactId) {
    const response = await apiClient.delete(
      `${BASE_URL}/contacts/${contactId}/`,
    );
    return response.data;
  }

  // ============================================================================
  // DEAL MANAGEMENT (SALES PIPELINE)
  // ============================================================================

  /**
   * Get all deals with optional filtering
   * @param {Object} params - Query parameters (search, stage, priority, page, page_size)
   */
  async getDeals(params = {}) {
    const response = await apiClient.get(`${BASE_URL}/deals/`, { params });
    return response.data;
  }

  /**
   * Get a single deal by ID
   * @param {string} dealId - Deal UUID
   */
  async getDeal(dealId) {
    const response = await apiClient.get(`${BASE_URL}/deals/${dealId}/`);
    return response.data;
  }

  async getOpportunityWorkspace(dealId) {
    const response = await apiClient.get(`${BASE_URL}/deals/${encodeURIComponent(dealId)}/workspace/`, EMAIL_REQUEST_OPTIONS);
    return response.data;
  }

  async setupOpportunityWorkspace(dealId) {
    const response = await apiClient.post(`${BASE_URL}/deals/${encodeURIComponent(dealId)}/workspace/setup/`, {}, EMAIL_REQUEST_OPTIONS);
    return response.data;
  }

  async getOpportunityWorkspaceFiles(dealId, folderKey, cursor = null, storage = 'sharepoint') {
    const response = await apiClient.get(`${BASE_URL}/deals/${encodeURIComponent(dealId)}/workspace/folders/${encodeURIComponent(folderKey)}/files/`, { ...EMAIL_REQUEST_OPTIONS, params: { ...(cursor ? { cursor } : {}), ...(storage === 'radai' ? { storage } : {}) } });
    return response.data;
  }

  async uploadOpportunityWorkspaceFile(dealId, folderKey, file, requestId, storage = 'sharepoint', options = {}) {
    const body = new FormData();
    body.append('file', file);
    body.append('upload_request_id', requestId);
    if (storage === 'radai') body.append('storage', storage);
    const response = await apiClient.post(`${BASE_URL}/deals/${encodeURIComponent(dealId)}/workspace/folders/${encodeURIComponent(folderKey)}/upload/`, body, { ...EMAIL_REQUEST_OPTIONS, timeout: API_TIMEOUT_UPLOAD, onUploadProgress: options.onUploadProgress, signal: options.signal });
    return response.data;
  }

  async getOpportunityWorkspaceFile(dealId, folderKey, fileId, { signal } = {}) {
    const response = await apiClient.get(`${BASE_URL}/deals/${encodeURIComponent(dealId)}/workspace/folders/${encodeURIComponent(folderKey)}/files/${encodeURIComponent(fileId)}/`, { ...EMAIL_REQUEST_OPTIONS, signal });
    return response.data;
  }

  async deleteOpportunityWorkspaceFile(dealId, folderKey, fileId, { signal } = {}) {
    const response = await apiClient.delete(`${BASE_URL}/deals/${encodeURIComponent(dealId)}/workspace/folders/${encodeURIComponent(folderKey)}/files/${encodeURIComponent(fileId)}/`, { ...EMAIL_REQUEST_OPTIONS, signal });
    return response.data;
  }

  async getOpportunityWorkspaceVersions(dealId, folderKey, fileId, cursor = null) {
    const response = await apiClient.get(`${BASE_URL}/deals/${encodeURIComponent(dealId)}/workspace/folders/${encodeURIComponent(folderKey)}/files/${encodeURIComponent(fileId)}/versions/`, { ...EMAIL_REQUEST_OPTIONS, params: cursor ? { cursor } : {} });
    return response.data;
  }

  async downloadOpportunityWorkspaceFile(dealId, folderKey, fileId, { signal } = {}) {
    try {
      const response = await apiClient.get(`${BASE_URL}/deals/${encodeURIComponent(dealId)}/workspace/folders/${encodeURIComponent(folderKey)}/files/${encodeURIComponent(fileId)}/download/`, { ...EMAIL_REQUEST_OPTIONS, responseType: 'blob', timeout: API_TIMEOUT_UPLOAD, signal });
      return { blob: response.data, filename: responseFilename(response.headers?.['content-disposition']) };
    } catch (error) {
      if (error.response?.data instanceof Blob) {
        try { error.response.data = JSON.parse(await error.response.data.text()); } catch { /* Keep the safe generic message for a non-JSON response. */ }
      }
      throw error;
    }
  }

  /**
   * Create a new deal
   * @param {Object} dealData - Deal information
   */
  async createDeal(dealData) {
    const response = await apiClient.post(`${BASE_URL}/deals/`, dealData);
    return response.data;
  }

  /**
   * Update a deal
   * @param {string} dealId - Deal UUID
   * @param {Object} dealData - Updated deal information
   */
  async updateDeal(dealId, dealData) {
    const response = await apiClient.put(
      `${BASE_URL}/deals/${dealId}/`,
      dealData,
    );
    return response.data;
  }

  /**
   * Partially update a deal
   * @param {string} dealId - Deal UUID
   * @param {Object} dealData - Partial deal data
   */
  async patchDeal(dealId, dealData) {
    const response = await apiClient.patch(
      `${BASE_URL}/deals/${dealId}/`,
      dealData,
    );
    return response.data;
  }

  /**
   * Delete a deal
   * @param {string} dealId - Deal UUID
   */
  async deleteDeal(dealId) {
    const response = await apiClient.delete(`${BASE_URL}/deals/${dealId}/`);
    return response.data;
  }

  /**
   * Calculate win probability for a deal (AI-powered)
   * @param {string} dealId - Deal UUID
   */
  async calculateWinProbability(dealId) {
    const response = await apiClient.post(
      `${BASE_URL}/deals/${dealId}/calculate_win_probability/`,
    );
    return response.data;
  }

  /**
   * Score a lead (AI-powered lead scoring)
   * @param {string} dealId - Deal UUID
   */
  async scoreLead(dealId) {
    const response = await apiClient.post(
      `${BASE_URL}/deals/${dealId}/score_lead/`,
    );
    return response.data;
  }

  /**
   * Get next best action recommendation (AI-powered)
   * @param {string} dealId - Deal UUID
   */
  async getNextAction(dealId) {
    const response = await apiClient.get(
      `${BASE_URL}/deals/${dealId}/next_action/`,
    );
    return response.data;
  }

  /**
   * Get pipeline summary statistics
   */
  async getPipelineSummary() {
    const [dealResponse, dashboardResponse] = await Promise.all([
      apiClient.get(`${BASE_URL}/deals/`, { params: { page_size: 500 } }),
      apiClient.get(`${BASE_URL}/dashboard/summary/`),
    ]);
    const deals = Array.isArray(dealResponse.data)
      ? dealResponse.data
      : (dealResponse.data?.results ?? []);
    const dashboard = dashboardResponse.data?.dashboard ?? {};
    const stageKeys = [
      "lead",
      "qualified",
      "proposal",
      "negotiation",
      "award_pending",
      "awarded",
      "converted",
    ];
    const byStage = stageKeys.map((stage) => {
      const rows = deals.filter((deal) => deal.stage === stage);
      return {
        stage,
        stage_label: rows[0]?.stage_display ?? stage.replaceAll("_", " "),
        deal_count: rows.length,
        total_value: rows.reduce(
          (sum, deal) => sum + Number(deal.estimated_value || 0),
          0,
        ),
      };
    });
    return {
      total_deals: deals.length,
      total_pipeline_value: Number(dashboard.pipeline_value || 0),
      won_value: Number(dashboard.won_value_mtd || 0),
      win_rate: Number(dashboard.win_rate || 0),
      avg_deal_days: Number(dashboard.avg_sales_cycle_days || 0),
      currency: deals[0]?.currency ?? "AED",
      currency_locale: "en-AE",
      by_stage: byStage,
      deals: deals.map((deal) => ({
        ...deal,
        title: deal.deal_name,
        value: deal.estimated_value,
        win_probability: deal.ai_win_probability ?? deal.probability,
      })),
    };
  }

  /**
   * Move deal to a new stage
   * @param {string} dealId - Deal UUID
   * @param {string} newStage - New stage key (lead, qualified, proposal, negotiation, closed_won, closed_lost)
   */
  async moveDealStage(dealId, newStage) {
    const response = await apiClient.post(`${BASE_URL}/deals/move_stage/`, {
      deal_id: dealId,
      stage: newStage,
    });
    return response.data;
  }

  // ============================================================================
  // QUOTE MANAGEMENT
  // ============================================================================

  /**
   * Get all quotes
   * @param {Object} params - Query parameters
   */
  async getQuotes(params = {}) {
    const response = await apiClient.get(`${BASE_URL}/quotes/`, { params });
    return response.data;
  }

  /**
   * Get a single quote by ID
   * @param {string} quoteId - Quote UUID
   */
  async getQuote(quoteId) {
    const response = await apiClient.get(`${BASE_URL}/quotes/${quoteId}/`);
    return response.data;
  }

  /**
   * Create a new quote
   * @param {Object} quoteData - Quote information
   */
  async createQuote(quoteData) {
    const response = await apiClient.post(`${BASE_URL}/quotes/`, quoteData);
    return response.data;
  }

  /**
   * Update a quote
   * @param {string} quoteId - Quote UUID
   * @param {Object} quoteData - Updated quote information
   */
  async updateQuote(quoteId, quoteData) {
    const response = await apiClient.put(
      `${BASE_URL}/quotes/${quoteId}/`,
      quoteData,
    );
    return response.data;
  }

  async patchQuote(quoteId, quoteData) {
    const response = await apiClient.patch(
      `${BASE_URL}/quotes/${quoteId}/`,
      quoteData,
    );
    return response.data;
  }

  /**
   * Delete a quote
   * @param {string} quoteId - Quote UUID
   */
  async deleteQuote(quoteId) {
    const response = await apiClient.delete(`${BASE_URL}/quotes/${quoteId}/`);
    return response.data;
  }

  /**
   * Send quote to client
   * @param {string} quoteId - Quote UUID
   */
  async sendQuote(quoteId) {
    const response = await apiClient.post(
      `${BASE_URL}/quotes/${quoteId}/send_to_client/`,
    );
    return response.data;
  }

  /**
   * Mark quote as viewed by client
   * @param {string} quoteId - Quote UUID
   */
  async markQuoteViewed(quoteId) {
    const response = await apiClient.post(
      `${BASE_URL}/quotes/${quoteId}/mark_viewed/`,
    );
    return response.data;
  }

  // ============================================================================
  // SALES ACTIVITY TRACKING
  // ============================================================================

  /**
   * Get all sales activities
   * @param {Object} params - Query parameters
   */
  async getActivities(params = {}) {
    const response = await apiClient.get(`${BASE_URL}/activities/`, { params });
    return response.data;
  }

  /**
   * Get my activities (current user's activities)
   */
  async getMyActivities() {
    const response = await apiClient.get(
      `${BASE_URL}/activities/my_activities/`,
    );
    return response.data;
  }

  /**
   * Get upcoming activities
   * @param {number} days - Number of days to look ahead (default: 7)
   */
  async getUpcomingActivities(days = 7) {
    const response = await apiClient.get(`${BASE_URL}/activities/upcoming/`, {
      params: { days },
    });
    return response.data;
  }

  /**
   * Get a single activity by ID
   * @param {string} activityId - Activity UUID
   */
  async getActivity(activityId) {
    const response = await apiClient.get(
      `${BASE_URL}/activities/${activityId}/`,
    );
    return response.data;
  }

  /**
   * Create a new activity
   * @param {Object} activityData - Activity information
   */
  async createActivity(activityData) {
    const response = await apiClient.post(
      `${BASE_URL}/activities/`,
      activityData,
    );
    return response.data;
  }

  /**
   * Update an activity
   * @param {string} activityId - Activity UUID
   * @param {Object} activityData - Updated activity information
   */
  async updateActivity(activityId, activityData) {
    const response = await apiClient.put(
      `${BASE_URL}/activities/${activityId}/`,
      activityData,
    );
    return response.data;
  }

  /**
   * Delete an activity
   * @param {string} activityId - Activity UUID
   */
  async deleteActivity(activityId) {
    const response = await apiClient.delete(
      `${BASE_URL}/activities/${activityId}/`,
    );
    return response.data;
  }

  // ============================================================================
  // SALES FORECASTING (AI-POWERED)
  // ============================================================================

  /**
   * Get all forecasts
   * @param {Object} params - Query parameters
   */
  async getForecasts(params = {}) {
    const response = await apiClient.get(`${BASE_URL}/forecasts/`, { params });
    return response.data;
  }

  /**
   * Get a single forecast by ID
   * @param {string} forecastId - Forecast UUID
   */
  async getForecast(forecastId) {
    const response = await apiClient.get(
      `${BASE_URL}/forecasts/${forecastId}/`,
    );
    return response.data;
  }

  async patchForecast(forecastId, payload) {
    return (
      await apiClient.patch(`${BASE_URL}/forecasts/${forecastId}/`, payload)
    ).data;
  }

  async approveForecast(forecastId) {
    return (
      await apiClient.post(`${BASE_URL}/forecasts/${forecastId}/approve/`)
    ).data;
  }

  /**
   * Generate new forecast (AI-powered)
   * @param {Object} forecastParams - { period_start, period_end, include_pipeline }
   */
  async generateForecast(forecastParams) {
    const response = await apiClient.post(
      `${BASE_URL}/forecasts/generate_forecast/`,
      forecastParams,
    );
    return response.data;
  }

  /**
   * Update actual revenue for a forecast
   * @param {string} forecastId - Forecast UUID
   * @param {number} actualRevenue - Actual revenue achieved
   */
  async updateForecastActual(forecastId, actualRevenue) {
    const response = await apiClient.post(
      `${BASE_URL}/forecasts/${forecastId}/update_actual/`,
      {
        actual_revenue: actualRevenue,
      },
    );
    return response.data;
  }

  // ============================================================================
  // DASHBOARD & AI INSIGHTS
  // ============================================================================

  /**
   * Get comprehensive sales dashboard summary
   */
  async getDashboardSummary() {
    const response = await apiClient.get(`${BASE_URL}/dashboard/summary/`);
    return response.data;
  }

  /**
   * Get real-time AI insights and recommendations
   */
  async getAIInsights() {
    const response = await apiClient.get(`${BASE_URL}/dashboard/ai_insights/`);
    return response.data;
  }

  async submitQualification(dealId, payload = {}) {
    return (
      await apiClient.post(`${BASE_URL}/deals/${dealId}/submit-qualification/`, payload)
    ).data;
  }

  async recordBidDecision(dealId, decision, reason = "") {
    return (
      await apiClient.post(`${BASE_URL}/deals/${dealId}/bid-decision/`, {
        decision,
        reason,
      })
    ).data;
  }

  async recordCeoDecision(dealId, decision, reason = "") {
    return (
      await apiClient.post(`${BASE_URL}/deals/${dealId}/ceo-decision/`, {
        decision,
        reason,
      })
    ).data;
  }

  async draftBidDecisionJustification(dealId, payload, { signal } = {}) {
    return (await apiClient.post(`${BASE_URL}/deals/${encodeURIComponent(dealId)}/bid-decision-justification/`, payload, { ...EMAIL_REQUEST_OPTIONS, signal })).data;
  }

  async closeOpportunity(dealId, outcome, reason) {
    return (
      await apiClient.post(`${BASE_URL}/deals/${dealId}/close/`, {
        outcome,
        reason,
      })
    ).data;
  }

  async enterNegotiation(dealId, reason = "") {
    return (
      await apiClient.post(`${BASE_URL}/deals/${dealId}/enter-negotiation/`, {
        reason,
      })
    ).data;
  }

  async submitAward(dealId, payload) {
    return (
      await apiClient.post(`${BASE_URL}/deals/${dealId}/submit-award/`, payload)
    ).data;
  }

  async approveAward(dealId, reason = "") {
    return (
      await apiClient.post(`${BASE_URL}/deals/${dealId}/approve-award/`, {
        reason,
      })
    ).data;
  }

  async rejectAward(dealId, reason) {
    return (
      await apiClient.post(`${BASE_URL}/deals/${dealId}/reject-award/`, {
        reason,
      })
    ).data;
  }

  async convertToProject(dealId, payload) {
    return (
      await apiClient.post(
        `${BASE_URL}/deals/${dealId}/convert-to-project/`,
        payload,
      )
    ).data;
  }

  async deleteDeal(dealId) {
    return (await apiClient.delete(`${BASE_URL}/deals/${dealId}/`)).data;
  }

  // ============================================================================
  // SALES LETTERS
  // ============================================================================

  async prepareLetter(dealId, letterType, customData = {}) {
    return (
      await apiClient.post(`${BASE_URL}/deals/${dealId}/prepare-letter/`, {
        letter_type: letterType,
        custom_data: customData,
      })
    ).data;
  }

  async getLetters(dealId) {
    return (
      await apiClient.get(`${BASE_URL}/deals/${dealId}/letters/`)
    ).data;
  }

  async sendLetter(dealId, letterId, recipient) {
    return (
      await apiClient.post(`${BASE_URL}/deals/${dealId}/letters/${letterId}/send/`, {
        recipient,
      })
    ).data;
  }

  async downloadLetterPdf(dealId, letterId) {
    const response = await apiClient.get(
      `${BASE_URL}/deals/${dealId}/letters/${letterId}/pdf/`,
      { responseType: 'blob' }
    );
    return { blob: response.data, filename: responseFilename(response.headers?.['content-disposition']) };
  }

  async downloadLetterDocx(dealId, letterId) {
    const response = await apiClient.get(
      `${BASE_URL}/deals/${dealId}/letters/${letterId}/docx/`,
      { responseType: 'blob' }
    );
    return { blob: response.data, filename: responseFilename(response.headers?.['content-disposition']) };
  }

  async previewLetterPdf(dealId, letterId) {
    const response = await apiClient.get(
      `${BASE_URL}/deals/${dealId}/letters/${letterId}/pdf/preview/`,
      { responseType: 'blob' }
    );
    return response.data;
  }

  /**
   * Preview URL for the inline PDF iframe, based on the backend-returned
   * `pdf_preview_url` — used unchanged so the iframe always loads the real
   * PDF endpoint, never a React route. The JWT goes in the query string
   * (iframes cannot send the Authorization header; QueryParamJWTAuthentication
   * validates it), and `cacheBuster` changes after regeneration.
   *
   * Logs the returned URL, the final iframe src and a HEAD status probe so
   * preview issues are diagnosable from the console.
   */
  buildLetterPreviewUrl(letter, cacheBuster = 0) {
    const returned = letter?.pdf_preview_url || '';
    const absolutePreviewUrl = this.toBackendAbsoluteUrl(returned);
    if (!absolutePreviewUrl) {
      console.log('[LetterPreview] backend pdf_preview_url:', returned || '(missing)');
      console.log('[LetterPreview] iframe src:', '(empty — iframe stays hidden)');
      return '';
    }
    const url = new URL(absolutePreviewUrl);
    const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    if (token) url.searchParams.set('token', token);
    if (cacheBuster) url.searchParams.set('v', String(cacheBuster));
    const finalUrl = url.toString();
    console.log('[LetterPreview] backend pdf_preview_url:', returned || '(missing)');
    console.log('[LetterPreview] iframe src:', finalUrl);
    if (finalUrl) {
      fetch(finalUrl, { method: 'HEAD' })
        .then((response) =>
          console.log('[LetterPreview] HEAD status:', response.status, finalUrl),
        )
        .catch((error) =>
          console.warn('[LetterPreview] HEAD probe failed:', error.message),
        );
    }
    return finalUrl;
  }

  /**
   * Fallback builder used only when the backend response carries no
   * pdf_preview_url. Same-origin guaranteed by stripping any absolute origin.
   */
  getLetterPreviewUrl(dealId, letterId, cacheBuster = 0) {
    const previewPath = `/api/v1/sales/deals/${dealId}/letters/${letterId}/pdf/preview/`;
    const absolutePreviewUrl = this.toBackendAbsoluteUrl(previewPath);
    const url = new URL(absolutePreviewUrl);
    const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    if (token) url.searchParams.set('token', token);
    if (cacheBuster) url.searchParams.set('v', String(cacheBuster));
    return url.toString();
  }

  async regenerateLetterPdf(dealId, letterId, payload = {}) {
    return (
      await apiClient.post(
        `${BASE_URL}/deals/${dealId}/letters/${letterId}/regenerate-pdf/`,
        payload
      )
    ).data;
  }

  async updateLetter(dealId, letterId, data) {
    return (
      await apiClient.patch(`${BASE_URL}/deals/${dealId}/letters/${letterId}/`, data)
    ).data;
  }

  async getOpportunityAudit(dealId) {
    return (await apiClient.get(`${BASE_URL}/deals/${dealId}/audit-events/`))
      .data;
  }

  async getFrameworks(params = {}) {
    return (await apiClient.get(`${BASE_URL}/frameworks/`, { params })).data;
  }

  async getFramework(frameworkId) {
    return (await apiClient.get(`${BASE_URL}/frameworks/${frameworkId}/`)).data;
  }

  async patchFramework(frameworkId, payload) {
    return (
      await apiClient.patch(`${BASE_URL}/frameworks/${frameworkId}/`, payload)
    ).data;
  }

  async createFramework(payload) {
    return (await apiClient.post(`${BASE_URL}/frameworks/`, payload)).data;
  }

  async activateFramework(frameworkId) {
    return (
      await apiClient.post(`${BASE_URL}/frameworks/${frameworkId}/activate/`)
    ).data;
  }

  async approveProposal(proposalId, comment = "") {
    return (
      await apiClient.post(`${BASE_URL}/quotes/${proposalId}/approve/`, {
        comment,
      })
    ).data;
  }

  async getProposalReview(proposalId, params = {}, signal) {
    return (await apiClient.get(`${BASE_URL}/quotes/${encodeURIComponent(proposalId)}/review/`, { ...EMAIL_REQUEST_OPTIONS, params, signal })).data;
  }

  async bindProposalReviewDocument(proposalId, payload) {
    return (await apiClient.post(`${BASE_URL}/quotes/${encodeURIComponent(proposalId)}/review/documents/`, payload, { ...EMAIL_REQUEST_OPTIONS, timeout: API_TIMEOUT_UPLOAD })).data;
  }

  async getProposalReviewPdf(proposalId, documentId, download = false, signal) {
    try {
      const response = await apiClient.get(`${BASE_URL}/quotes/${encodeURIComponent(proposalId)}/review/documents/${encodeURIComponent(documentId)}/${download ? 'download' : 'content'}/`, { ...EMAIL_REQUEST_OPTIONS, timeout: API_TIMEOUT_UPLOAD, responseType: 'blob', signal });
      return { blob: response.data, filename: responseFilename(response.headers?.['content-disposition']) };
    } catch (error) {
      if (error.response?.data instanceof Blob) {
        try { error.response.data = JSON.parse(await error.response.data.text()); } catch { /* Do not expose HTML/provider errors. */ }
      }
      throw error;
    }
  }

  async addProposalReviewComment(proposalId, documentId, payload) {
    return (await apiClient.post(`${BASE_URL}/quotes/${encodeURIComponent(proposalId)}/review/documents/${encodeURIComponent(documentId)}/comments/`, payload, EMAIL_REQUEST_OPTIONS)).data;
  }

  async resolveProposalReviewComment(proposalId, documentId, commentId, payload) {
    return (await apiClient.post(`${BASE_URL}/quotes/${encodeURIComponent(proposalId)}/review/documents/${encodeURIComponent(documentId)}/comments/${encodeURIComponent(commentId)}/resolve/`, payload, EMAIL_REQUEST_OPTIONS)).data;
  }

  async submitProposalReview(proposalId, documentId, payload) {
    return (await apiClient.post(`${BASE_URL}/quotes/${encodeURIComponent(proposalId)}/review/documents/${encodeURIComponent(documentId)}/submit/`, payload, EMAIL_REQUEST_OPTIONS)).data;
  }

  async submitProposal(proposalId, payload) {
    return (
      await apiClient.post(
        `${BASE_URL}/quotes/${proposalId}/send_to_client/`,
        payload,
      )
    ).data;
  }

  async getProjectHandovers(params = {}) {
    return (await apiClient.get(`${BASE_URL}/project-handovers/`, { params }))
      .data;
  }

  async getProjectHandover(handoverId) {
    return (await apiClient.get(`${BASE_URL}/project-handovers/${handoverId}/`))
      .data;
  }

  async updateProjectHandover(handoverId, payload) {
    return (
      await apiClient.patch(
        `${BASE_URL}/project-handovers/${handoverId}/`,
        payload,
      )
    ).data;
  }

  async submitProjectHandover(handoverId) {
    return (
      await apiClient.post(
        `${BASE_URL}/project-handovers/${handoverId}/submit-for-acceptance/`,
      )
    ).data;
  }

  async acceptProjectHandover(handoverId, comment = "") {
    return (
      await apiClient.post(
        `${BASE_URL}/project-handovers/${handoverId}/accept/`,
        { comment },
      )
    ).data;
  }

  async returnProjectHandover(handoverId, reason) {
    return (
      await apiClient.post(
        `${BASE_URL}/project-handovers/${handoverId}/return_for_correction/`,
        { reason },
      )
    ).data;
  }

  async getMailboxConnections(params = {}) {
    return (
      await apiClient.get(`${BASE_URL}/mailbox-connections/`, {
        ...EMAIL_REQUEST_OPTIONS,
        params,
      })
    ).data;
  }

  async getMailboxMessages(connectionId, params = {}) {
    return (
      await apiClient.get(
        `${BASE_URL}/mailbox-connections/${encodeURIComponent(connectionId)}/messages/`,
        { ...EMAIL_REQUEST_OPTIONS, params },
      )
    ).data;
  }

  async getMailboxMessage(connectionId, messageId) {
    return (
      await apiClient.get(
        `${BASE_URL}/mailbox-connections/${encodeURIComponent(connectionId)}/message/`,
        { ...EMAIL_REQUEST_OPTIONS, params: { message_id: messageId } },
      )
    ).data;
  }

  async getRegistrationOptions() {
    const response = await apiClient.get(`${BASE_URL}/deals/registration-options/`);
    return response.data;
  }

  async exportDeals(ids) {
    const response = await apiClient.post(`${BASE_URL}/deals/export/`, { ids: ids.join(',') }, { responseType: 'blob' });
    return response.data;
  }

  async getPreparationOpportunities(params = {}, { signal } = {}) {
    return (await apiClient.get(`${BASE_URL}/quotes/preparation-opportunities/`, { ...EMAIL_REQUEST_OPTIONS, params, signal })).data;
  }

  async draftProposalField({ opportunityId, quoteId }, payload, { signal } = {}) {
    const path = quoteId ? `quotes/${encodeURIComponent(quoteId)}/draft-field` : `deals/${encodeURIComponent(opportunityId)}/proposal-draft-field`;
    return (await apiClient.post(`${BASE_URL}/${path}/`, payload, { ...EMAIL_REQUEST_OPTIONS, signal })).data;
  }

  async getOpportunityDocumentClassification(dealId, folderKey, fileId, { signal } = {}) {
    const response = await apiClient.get(`${BASE_URL}/deals/${encodeURIComponent(dealId)}/workspace/folders/${encodeURIComponent(folderKey)}/files/${encodeURIComponent(fileId)}/classification/`, { ...EMAIL_REQUEST_OPTIONS, signal });
    return response.data;
  }

  async updateOpportunityDocumentType(dealId, folderKey, fileId, payload) {
    const response = await apiClient.post(`${BASE_URL}/deals/${encodeURIComponent(dealId)}/workspace/folders/${encodeURIComponent(folderKey)}/files/${encodeURIComponent(fileId)}/classification/`, payload, EMAIL_REQUEST_OPTIONS);
    return response.data;
  }

  async retryOpportunityClassification(dealId, folderKey, fileId, payload) {
    const response = await apiClient.post(`${BASE_URL}/deals/${encodeURIComponent(dealId)}/workspace/folders/${encodeURIComponent(folderKey)}/files/${encodeURIComponent(fileId)}/classification/retry/`, payload, EMAIL_REQUEST_OPTIONS);
    return response.data;
  }

  async uploadOpportunityDocumentVersion(dealId, folderKey, fileId, file, requestId, expectedToken, revisionNote, options = {}) {
    const body = new FormData();
    body.append('file', file);
    body.append('upload_request_id', requestId);
    body.append('expected_token', expectedToken);
    body.append('revision_note', revisionNote);
    const response = await apiClient.post(`${BASE_URL}/deals/${encodeURIComponent(dealId)}/workspace/folders/${encodeURIComponent(folderKey)}/files/${encodeURIComponent(fileId)}/versions/upload/`, body, { ...EMAIL_REQUEST_OPTIONS, timeout: API_TIMEOUT_UPLOAD, onUploadProgress: options.onUploadProgress });
    return response.data;
  }

  async updateOpportunityFolderTag(dealId, folderKey, payload) {
    const response = await apiClient.patch(`${BASE_URL}/deals/${encodeURIComponent(dealId)}/workspace/folders/${encodeURIComponent(folderKey)}/tag/`, payload, EMAIL_REQUEST_OPTIONS);
    return response.data;
  }

  async exportQuotes(ids) {
    const response = await apiClient.post(`${BASE_URL}/quotes/export/`, { ids: ids.join(',') }, { responseType: 'blob' });
    return response.data;
  }

  async askMailboxEmail(connectionId, payload) {
    return (await apiClient.post(
      `${BASE_URL}/mailbox-connections/${encodeURIComponent(connectionId)}/review-assistant/`,
      payload,
      EMAIL_REQUEST_OPTIONS,
    )).data;
  }

  async convertMailboxMessage(connectionId, payload) {
    return (
      await apiClient.post(
        `${BASE_URL}/mailbox-connections/${encodeURIComponent(connectionId)}/convert-to-opportunity/`,
        payload,
        EMAIL_REQUEST_OPTIONS,
      )
    ).data;
  }

  async createMailboxConnection(payload) {
    return (await apiClient.post(`${BASE_URL}/mailbox-connections/`, payload, EMAIL_REQUEST_OPTIONS))
      .data;
  }

  async patchMailboxConnection(connectionId, payload) {
    return (
      await apiClient.patch(
        `${BASE_URL}/mailbox-connections/${connectionId}/`,
        payload,
        EMAIL_REQUEST_OPTIONS,
      )
    ).data;
  }

  async testMailboxConnection(connectionId) {
    return (
      await apiClient.post(
        `${BASE_URL}/mailbox-connections/${connectionId}/test-connection/`,
        {},
        EMAIL_REQUEST_OPTIONS,
      )
    ).data;
  }

  async configureMailboxSync(connectionId, enabled, expectedIdentity) {
    return (await apiClient.post(
      `${BASE_URL}/mailbox-connections/${encodeURIComponent(connectionId)}/configure-sync/`,
      { enabled, ...(expectedIdentity ? { expected_identity: expectedIdentity } : {}) },
      EMAIL_REQUEST_OPTIONS,
    )).data;
  }

  async connectOutlook(connectionId) {
    return (
      await apiClient.post(
        `${BASE_URL}/mailbox-connections/${connectionId}/connect-outlook/`,
      )
    ).data;
  }

  async connectMyOutlook() {
    return (
      await apiClient.post(`${BASE_URL}/mailbox-connections/connect-my-outlook/`)
    ).data;
  }

  async disconnectOutlook(connectionId) {
    return (
      await apiClient.post(
        `${BASE_URL}/mailbox-connections/${connectionId}/disconnect-outlook/`,
      )
    ).data;
  }

  async getEmailIntakes(params = {}) {
    return (await apiClient.get(`${BASE_URL}/email-intakes/`, { params })).data;
  }

  async getEmailIntake(intakeId) {
    return (await apiClient.get(`${BASE_URL}/email-intakes/${intakeId}/`)).data;
  }

  async askEmailIntake(intakeId, payload) {
    return (await apiClient.post(
      `${BASE_URL}/email-intakes/${encodeURIComponent(intakeId)}/review-assistant/`,
      payload,
      EMAIL_REQUEST_OPTIONS,
    )).data;
  }

  async startEmailIntakeReview(intakeId) {
    return (
      await apiClient.post(`${BASE_URL}/email-intakes/${intakeId}/start-review/`)
    ).data;
  }

  async rejectEmailIntake(intakeId, reason) {
    return (
      await apiClient.post(`${BASE_URL}/email-intakes/${intakeId}/reject/`, {
        reason,
      })
    ).data;
  }

  async markEmailIntakeDuplicate(intakeId, payload = {}) {
    return (
      await apiClient.post(
        `${BASE_URL}/email-intakes/${intakeId}/mark-duplicate/`,
        payload,
      )
    ).data;
  }

  async convertEmailIntake(intakeId, payload) {
    return (
      await apiClient.post(
        `${BASE_URL}/email-intakes/${intakeId}/convert-to-opportunity/`,
        payload,
        EMAIL_REQUEST_OPTIONS,
      )
    ).data;
  }
}

export default new SalesService();
