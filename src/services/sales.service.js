/**
 * Sales Management API Service
 * Handles all Sales/CRM API calls including AI-powered features
 */

import apiClient from './api.service';

const BASE_URL = '/sales';

class SalesService {
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
    const response = await apiClient.put(`${BASE_URL}/clients/${clientId}/`, clientData);
    return response.data;
  }

  /**
   * Partially update a client
   * @param {string} clientId - Client UUID
   * @param {Object} clientData - Partial client data
   */
  async patchClient(clientId, clientData) {
    const response = await apiClient.patch(`${BASE_URL}/clients/${clientId}/`, clientData);
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
    const response = await apiClient.post(`${BASE_URL}/clients/${clientId}/calculate_health_score/`);
    return response.data;
  }

  /**
   * Predict client churn risk (AI-powered)
   * @param {string} clientId - Client UUID
   */
  async predictChurn(clientId) {
    const response = await apiClient.get(`${BASE_URL}/clients/${clientId}/churn_prediction/`);
    return response.data;
  }

  /**
   * Get AI insights for a client
   * @param {string} clientId - Client UUID
   */
  async getClientInsights(clientId) {
    const response = await apiClient.get(`${BASE_URL}/clients/${clientId}/insights/`);
    return response.data;
  }

  /**
   * Get at-risk clients (high churn probability)
   */
  async getAtRiskClients() {
    const response = await apiClient.get(`${BASE_URL}/analytics/clients/`, { params: { mode: 'at_risk' } });
    return response.data;
  }

  /**
   * Get top clients by revenue or health score
   * @param {Object} params - limit, orderBy (revenue | health_score)
   */
  async getTopClients(params = {}) {
    const response = await apiClient.get(`${BASE_URL}/analytics/clients/`, { params: { mode: 'top', ...params } });
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
      params: { client_id: clientId } 
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
    const response = await apiClient.put(`${BASE_URL}/contacts/${contactId}/`, contactData);
    return response.data;
  }

  /**
   * Delete a contact
   * @param {string} contactId - Contact UUID
   */
  async deleteContact(contactId) {
    const response = await apiClient.delete(`${BASE_URL}/contacts/${contactId}/`);
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
    const response = await apiClient.put(`${BASE_URL}/deals/${dealId}/`, dealData);
    return response.data;
  }

  /**
   * Partially update a deal
   * @param {string} dealId - Deal UUID
   * @param {Object} dealData - Partial deal data
   */
  async patchDeal(dealId, dealData) {
    const response = await apiClient.patch(`${BASE_URL}/deals/${dealId}/`, dealData);
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
    const response = await apiClient.get(`${BASE_URL}/deals/${dealId}/calculate_win_probability/`);
    return response.data;
  }

  /**
   * Score a lead (AI-powered lead scoring)
   * @param {string} dealId - Deal UUID
   */
  async scoreLead(dealId) {
    const response = await apiClient.post(`${BASE_URL}/deals/${dealId}/score_lead/`);
    return response.data;
  }

  /**
   * Get next best action recommendation (AI-powered)
   * @param {string} dealId - Deal UUID
   */
  async getNextAction(dealId) {
    const response = await apiClient.get(`${BASE_URL}/deals/${dealId}/next_action/`);
    return response.data;
  }

  /**
   * Get pipeline summary statistics
   */
  async getPipelineSummary() {
    const response = await apiClient.get(`${BASE_URL}/analytics/pipeline/`);
    return response.data;
  }

  /**
   * Move deal to a new stage
   * @param {string} dealId - Deal UUID
   * @param {string} newStage - New stage key (lead, qualified, proposal, negotiation, closed_won, closed_lost)
   */
  async moveDealStage(dealId, newStage) {
    const response = await apiClient.post(`${BASE_URL}/deals/${dealId}/move_stage/`, {
      new_stage: newStage
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
    const response = await apiClient.put(`${BASE_URL}/quotes/${quoteId}/`, quoteData);
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
    const response = await apiClient.post(`${BASE_URL}/quotes/${quoteId}/send_to_client/`);
    return response.data;
  }

  /**
   * Mark quote as viewed by client
   * @param {string} quoteId - Quote UUID
   */
  async markQuoteViewed(quoteId) {
    const response = await apiClient.post(`${BASE_URL}/quotes/${quoteId}/mark_viewed/`);
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
    const response = await apiClient.get(`${BASE_URL}/activities/my_activities/`);
    return response.data;
  }

  /**
   * Get upcoming activities
   * @param {number} days - Number of days to look ahead (default: 7)
   */
  async getUpcomingActivities(days = 7) {
    const response = await apiClient.get(`${BASE_URL}/analytics/activities/`, {
      params: { days }
    });
    return response.data;
  }

  /**
   * Get a single activity by ID
   * @param {string} activityId - Activity UUID
   */
  async getActivity(activityId) {
    const response = await apiClient.get(`${BASE_URL}/activities/${activityId}/`);
    return response.data;
  }

  /**
   * Create a new activity
   * @param {Object} activityData - Activity information
   */
  async createActivity(activityData) {
    const response = await apiClient.post(`${BASE_URL}/activities/`, activityData);
    return response.data;
  }

  /**
   * Update an activity
   * @param {string} activityId - Activity UUID
   * @param {Object} activityData - Updated activity information
   */
  async updateActivity(activityId, activityData) {
    const response = await apiClient.put(`${BASE_URL}/activities/${activityId}/`, activityData);
    return response.data;
  }

  /**
   * Delete an activity
   * @param {string} activityId - Activity UUID
   */
  async deleteActivity(activityId) {
    const response = await apiClient.delete(`${BASE_URL}/activities/${activityId}/`);
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
    const response = await apiClient.get(`${BASE_URL}/forecasts/${forecastId}/`);
    return response.data;
  }

  /**
   * Generate new forecast (AI-powered)
   * @param {Object} forecastParams - { period_start, period_end, include_pipeline }
   */
  async generateForecast(forecastParams) {
    const response = await apiClient.post(`${BASE_URL}/forecasts/generate_forecast/`, forecastParams);
    return response.data;
  }

  /**
   * Update actual revenue for a forecast
   * @param {string} forecastId - Forecast UUID
   * @param {number} actualRevenue - Actual revenue achieved
   */
  async updateForecastActual(forecastId, actualRevenue) {
    const response = await apiClient.post(`${BASE_URL}/forecasts/${forecastId}/update_actual/`, {
      actual_revenue: actualRevenue
    });
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
    const response = await apiClient.get(`${BASE_URL}/analytics/insights/`);
    return response.data;
  }
}

export default new SalesService();
