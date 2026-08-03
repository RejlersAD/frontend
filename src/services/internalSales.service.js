/**
 * Internal Sales Dashboard Service
 * Connects to the usage_tracking API endpoints.
 * Soft-coded base URL — change once here if the path changes.
 */
import apiClient from './api.service';

const BASE = '/usage';

const internalSalesService = {
  /** Summary KPIs */
  getOverview: (range = '7d') =>
    apiClient.get(`${BASE}/overview/`, { params: { range } }).then(r => r.data),

  /** Usage grouped by engineering discipline */
  getDisciplines: (range = '7d') =>
    apiClient.get(`${BASE}/disciplines/`, { params: { range } }).then(r => r.data),

  /** Top active users */
  getTopUsers: (range = '7d', limit = 10) =>
    apiClient.get(`${BASE}/top-users/`, { params: { range, limit } }).then(r => r.data),

  /** Daily request + users trend */
  getTrends: (range = '30d') =>
    apiClient.get(`${BASE}/trends/`, { params: { range } }).then(r => r.data),

  /** Users active in last 15 minutes */
  getActiveNow: () =>
    apiClient.get(`${BASE}/active-now/`).then(r => r.data),

  /** Full user roster from DB, joined with UsageLog stats */
  getAllUsers: (range = '7d') =>
    apiClient.get(`${BASE}/all-users/`, { params: { range } }).then(r => r.data),

  /** All SystemActivity DB events — logins, uploads, AI calls, errors, etc. */
  getDbEvents: (range = '7d', { category = '', severity = '', limit = 50 } = {}) =>
    apiClient.get(`${BASE}/db-events/`, { params: { range, category, severity, limit } }).then(r => r.data),

  /** Live + recent user sessions (browser, OS, device, current page) */
  getSessions: () =>
    apiClient.get(`${BASE}/sessions/`).then(r => r.data),

  /**
   * Comprehensive utilisation report — departments, users, AI cost, trends.
   * period = 'daily' | 'weekly' | 'monthly' | 'quarterly'
   * anchor = 'YYYY-MM'  (month to anchor to, ignored for daily/weekly)
   * dept   = department name to filter (optional)
   */
  getUtilisationReport: ({ period = 'monthly', anchor = '', dept = '' } = {}) =>
    apiClient.get(`${BASE}/report/`, { params: { period, anchor, dept } }).then(r => r.data),
};

export default internalSalesService;
