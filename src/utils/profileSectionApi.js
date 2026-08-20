/**
 * Profile Section API Client — Soft-Coded, Single Source of Truth
 * ==================================================================
 * Shared, resilient fetch helper for Achievements / Experience / Social
 * Links / Documents. Centralizes auth-header injection, JSON parsing, and
 * field-error extraction so every profile section behaves consistently and
 * a fix (e.g. better error messages) only needs to happen in one place.
 */
import { API_BASE_URL } from '../config/api.config';

// Soft-coded priority order for which backend field error to surface first
// when a request fails validation. Extend this list as new fields are added.
const FIELD_ERROR_PRIORITY = [
  'user_profile', 'organization', 'title', 'category', 'platform', 'url',
  'company_name', 'job_title', 'start_date', 'document_type', 'document_file',
];

function getAuthToken() {
  return localStorage.getItem('radai_access_token') || localStorage.getItem('access');
}

/**
 * Extract a single, human-readable message from a DRF error payload.
 * Handles: {detail}, {error}, {field: [msg]}, {field: "msg"}, plain string.
 */
export function extractErrorMessage(data, fallback = 'Something went wrong. Please try again.') {
  if (!data || typeof data !== 'object') {
    return (typeof data === 'string' && data.trim()) || fallback;
  }

  if (data.detail) return data.detail;
  if (data.error) return data.error;

  for (const field of FIELD_ERROR_PRIORITY) {
    if (data[field]) {
      const value = Array.isArray(data[field]) ? data[field][0] : data[field];
      if (typeof value === 'string') return value;
    }
  }

  // Fall back to the first field error found, in whatever order the API sent it.
  for (const [, value] of Object.entries(data)) {
    const msg = Array.isArray(value) ? value[0] : value;
    if (typeof msg === 'string' && msg.trim()) return msg;
  }

  return fallback;
}

/**
 * Authenticated fetch wrapper for profile-section endpoints.
 *
 * Never throws on HTTP error responses (4xx/5xx) — instead resolves with
 * `{ ok: false, status, data, message }` so callers can render inline field
 * errors without a try/catch per call site. Only throws on genuine network
 * failure (offline, DNS, CORS), and retries once for those automatically
 * since they're usually transient.
 */
export async function profileApiRequest(path, { method = 'GET', body, isFormData = false } = {}) {
  const token = getAuthToken();
  const headers = { Authorization: `Bearer ${token}` };
  if (!isFormData) headers['Content-Type'] = 'application/json';

  const doFetch = () =>
    fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body ? (isFormData ? body : JSON.stringify(body)) : undefined,
    });

  let res;
  try {
    res = await doFetch();
  } catch (networkErr) {
    // One automatic retry for transient network blips before giving up.
    try {
      res = await doFetch();
    } catch (retryErr) {
      return {
        ok: false,
        status: 0,
        data: null,
        message: 'Network error — check your connection and try again.',
      };
    }
  }

  let data = null;
  try {
    const text = await res.text();
    data = text ? JSON.parse(text) : null;
  } catch {
    // Non-JSON response body — leave data as null, status still meaningful.
  }

  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      data,
      message: extractErrorMessage(data, `Server error (${res.status})`),
    };
  }

  return { ok: true, status: res.status, data, message: null };
}
