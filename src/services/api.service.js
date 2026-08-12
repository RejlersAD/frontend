import axios from 'axios'
import { API_BASE_URL, API_TIMEOUT, API_TIMEOUT_LONG, API_TIMEOUT_REFRESH } from '../config/api.config'
import { STORAGE_KEYS } from '../config/app.config'
import { toast } from 'react-toastify'

/**
 * Enhanced Axios instance with CORS error handling and retry logic
 * Handles authentication, errors, and request/response transformations
 */

// =============================================================================
// SOFT-CODED AUTH RESILIENCE CONFIG
// Tunable behavior for token refresh, queueing, and silent endpoints.
// Adjust these constants instead of editing core logic below.
// =============================================================================
const AUTH_RESILIENCE_CONFIG = {
  // Endpoint URL substrings that should NOT trigger toast/redirect on 401.
  // These are background/polling endpoints — failing silently keeps the UI clean.
  SILENT_AUTH_ENDPOINTS: [
    '/notifications/unread_count',
    '/notifications/stats',
    '/notifications/categories',
    '/usage_tracking/',
    '/activity/heartbeat',
    '/rbac/ai-champion/champion/current/',
    '/admin/',
    '/rbac/users/me/',
  ],
  // Endpoint URL substrings that should NOT trigger toast on timeout / network errors.
  // Polling endpoints especially must fail silently — otherwise a single slow worker
  // (e.g. busy with an upload) spams the UI with "Cannot connect to server" toasts.
  // Add any background poller here to keep the foreground UX clean.
  // CRITICAL: /timesheet/live/ is NOT in this list — errors should surface to user
  SILENT_TIMEOUT_ENDPOINTS: [
    '/notifications/unread_count',
    '/notifications/stats',
    '/notifications/categories',
    '/usage_tracking/',
    '/activity/heartbeat',
    '/spec-customization/paper-spec/',  // job-status polling
    '/health/',                          // warmup ping — caller treats failure as non-fatal
    '/process-datasheet/mov-job-status/', // MOV async job poller — server may be briefly busy with extraction
    '/rbac/ai-champion/track/',          // fire-and-forget telemetry (route view + AI usage); never block UX or spam toasts when a worker is busy with a long extraction
    '/rbac/ai-champion/champion/current/',
  ],
  // Endpoints that should NEVER attempt a refresh (refresh endpoint itself, login, etc.)
  REFRESH_BLACKLIST: [
    '/auth/refresh',
    '/auth/login',
    '/auth/logout',
  ],
  // Maximum number of queued requests waiting on a single in-flight refresh.
  // Prevents memory blow-up if something goes very wrong.
  MAX_REFRESH_QUEUE: 50,
  // After this many consecutive refresh failures, force logout immediately.
  REFRESH_FAILURE_THRESHOLD: 1,
}

// =============================================================================
// REFRESH-TOKEN MUTEX (concurrency-safe single-flight refresh)
// Fixes: parallel 401s racing each other, refresh-token rotation invalidating
// all but the first call, "Token is invalid or expired" cascades.
// =============================================================================
let _refreshPromise = null              // Single in-flight refresh promise
let _refreshFailureCount = 0            // Track consecutive refresh failures

const _isSilentAuthEndpoint = (url = '') =>
  AUTH_RESILIENCE_CONFIG.SILENT_AUTH_ENDPOINTS.some((s) => url.includes(s))

const _isSilentTimeoutEndpoint = (url = '') =>
  AUTH_RESILIENCE_CONFIG.SILENT_TIMEOUT_ENDPOINTS.some((s) => url.includes(s))

const _isRefreshBlacklisted = (url = '') =>
  AUTH_RESILIENCE_CONFIG.REFRESH_BLACKLIST.some((s) => url.includes(s))

const _clearAuthAndRedirect = (showToast = true) => {
  localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN)
  localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN)
  localStorage.removeItem(STORAGE_KEYS.USER_DATA)
  if (!window.location.pathname.includes('/login')) {
    if (showToast) toast.error('Session expired. Please login again.')
    setTimeout(() => { window.location.href = '/login' }, 1000)
  }
}

/**
 * Returns a single shared promise that resolves with the new access token.
 * All concurrent 401 retries await the same promise — the refresh endpoint
 * is hit exactly once per expiry event.
 */
const _refreshAccessToken = () => {
  if (_refreshPromise) {
    console.log('[API] ♻️  Refresh already in-flight, awaiting shared promise')
    return _refreshPromise
  }

  const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN)
  if (!refreshToken) {
    return Promise.reject(new Error('No refresh token available'))
  }

  console.log('[API] 🔄 Starting single-flight token refresh...')
  _refreshPromise = axios
    .post(
      `${API_BASE_URL}/auth/refresh/`,
      { refresh: refreshToken },
      { timeout: API_TIMEOUT_REFRESH }
    )
    .then((response) => {
      const { access, refresh } = response.data
      if (!access) throw new Error('No access token received from refresh endpoint')
      localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, access)
      // Persist rotated refresh token if backend returns one (DRF SimpleJWT rotation)
      if (refresh) localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refresh)
      _refreshFailureCount = 0
      console.log('[API] ✅ Token refresh successful (shared)')
      return access
    })
    .catch((err) => {
      _refreshFailureCount += 1
      console.error('[API] ❌ Token refresh failed:', err.message)
      throw err
    })
    .finally(() => {
      // Always release the lock so the next expiry event can refresh again
      _refreshPromise = null
    })

  return _refreshPromise
}

// CORS Health Check Function
const testCorsConnection = async (baseURL = API_BASE_URL) => {
  console.log('[CORS_TEST] 🩺 Testing CORS connection to:', baseURL);
  
  try {
    // Test with simple fetch request to avoid axios interceptors
    const response = await fetch(`${baseURL}/cors/health/`, {
      method: 'GET',
      mode: 'cors',
      // No credentials - JWT in localStorage, not cookies
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('[CORS_TEST] ✅ CORS health check passed:', data);
      return data;
    } else {
      throw new Error(`CORS health check failed: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    console.error('[CORS_TEST] ❌ CORS health check failed:', error);
    throw error;
  }
};

// Create axios instance
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
  // withCredentials removed - we use JWT in localStorage, not cookies
  // This fixes CORS issues with Access-Control-Allow-Origin
})

console.log('[API Service] Enhanced Axios client initialized with CORS support')
console.log('[API Service] Base URL:', API_BASE_URL)
console.log('[API Service] Timeout:', API_TIMEOUT)
console.log('[API Service] With Credentials:', false) // JWT in localStorage

// Request interceptor - Add auth token and handle content types
apiClient.interceptors.request.use(
  (config) => {
    // CRITICAL: Retrieve token from localStorage
    const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN)
    
    // CRITICAL: Handle FormData BEFORE setting Authorization
    // Axios AxiosHeaders object can be corrupted if we delete after setting Authorization
    if (config.data instanceof FormData) {
      // Set Authorization explicitly for FormData to avoid header object mutation issues
      if (token) {
        config.headers.setAuthorization(`Bearer ${token}`)
      }
      // Remove Content-Type to let browser set multipart boundary
      config.headers.setContentType(false)
      console.log('[API] 📎 FormData detected, Authorization explicitly set, Content-Type cleared');
    } else {
      // For non-FormData requests, set Authorization normally
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      }
    }
    
    console.log('[API Request] 📤', config.method?.toUpperCase(), config.url);
    console.log('[API Request] Authorization:', config.headers.Authorization ? '✅ Present' : '❌ Missing');
    console.log('[API Request] Headers:', Object.keys(config.headers));
    
    return config
  },
  (error) => {
    console.error('[API] ❌ Request interceptor error:', error);
    return Promise.reject(error)
  }
)

// Enhanced response interceptor - Handle CORS and network errors
apiClient.interceptors.response.use(
  (response) => {
    console.log('[API Response] ✅', response.status, response.config.method?.toUpperCase(), response.config.url);
    
    // Check for password expiry headers
    if (response.headers['x-password-expiry-warning'] === 'true' || 
        response.headers['x-password-expiry-grace'] === 'true') {
      // Import dynamically to avoid circular dependency
      import('./passwordExpiry.service').then(module => {
        const passwordExpiryService = module.default;
        passwordExpiryService.handleResponseHeaders(response.headers);
      }).catch(err => {
        console.warn('[API] Failed to load password expiry service:', err);
      });
    }
    
    return response
  },
  async (error) => {
    const originalRequest = error.config
    // silentTimeout: per-request opt-in (not URL-wide) — lets one caller of a
    // shared endpoint suppress the toast while another caller of that same
    // endpoint still surfaces errors normally.
    const _silent = _isSilentTimeoutEndpoint(error.config?.url || '') || error.config?.silentTimeout === true
    
    // Enhanced error logging for debugging — but stay quiet for background
    // pollers so DevTools doesn't drown in red on a slow worker.
    if (_silent) {
      console.warn('[API] Silent endpoint error:', error.config?.url, '→', error.message)
    } else {
      console.group('[API Error] ❌ Detailed Error Information');
      console.error('Error Message:', error.message);
      console.error('Error Code:', error.code);
      console.error('Response Status:', error.response?.status);
      console.error('Response Data:', error.response?.data);
      console.error('Response Data (JSON):', JSON.stringify(error.response?.data, null, 2));
      console.error('Request URL:', error.config?.url);
      console.error('Request Method:', error.config?.method);
      console.error('Request Data:', error.config?.data);
      console.error('Request Timeout:', error.config?.timeout);
      console.error('Full Error Object:', error);
      console.groupEnd();
    }

    // Detect and handle timeout errors specifically
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      if (!_silent) {
        console.error('[API] ⏱️ TIMEOUT ERROR DETECTED');
        console.error('[API] Request timed out after', error.config?.timeout, 'ms');
        console.error('[API] Target:', error.config?.url);
      }
      
      const timeoutError = new Error('Request timeout - server is not responding');
      timeoutError.isTimeout = true;
      timeoutError.originalError = error;
      
      // Soft-coded: silent endpoints (background polls) must NOT spam the UI
      // with toasts when a single worker is briefly busy. Caller still gets
      // the rejection and can fall back to cached data.
      if (!_silent) {
        toast.error(`Server not responding after ${Math.floor((error.config?.timeout || 60000) / 1000)} seconds. Please check if the backend is running.`);
      }
      return Promise.reject(timeoutError);
    }

    // Handle network/connection errors (cannot reach server)
    if (!error.response) {
      console.error('[API] 🌐 NETWORK ERROR - No response received from server');
      // silentTimeout: per-request opt-in (not URL-wide) — lets one caller of a
    // shared endpoint suppress the toast while another caller of that same
    // endpoint still surfaces errors normally.
    const _silent = _isSilentTimeoutEndpoint(error.config?.url || '') || error.config?.silentTimeout === true;
      
      // Check if it's a CORS issue
      if (error.message.includes('CORS') || error.code === 'ERR_NETWORK') {
        console.warn('[API] 🔥 CORS/Network error detected, running diagnostics...');
        
        const networkError = new Error('Cannot connect to server');
        networkError.isNetworkError = true;
        networkError.originalError = error;
        
        if (!_silent) toast.error('Cannot reach server. Please verify the backend is running at ' + API_BASE_URL);
        return Promise.reject(networkError);
      }
      
      // Generic network error
      const networkError = new Error('Network connection failed');
      networkError.isNetworkError = true;
      networkError.originalError = error;
      
      if (!_silent) toast.error('Network error - please check your internet connection.');
      return Promise.reject(networkError);
    }

    // Handle password expiry errors
    if (error.response?.status === 403 && error.response?.data?.error === 'password_expired') {
      console.warn('[API] 🔒 Password expired, redirecting to change password...');
      
      toast.error(error.response.data.message || 'Your password has expired. Please change it.');
      
      // Redirect to change password page
      if (!window.location.pathname.includes('/change-password')) {
        setTimeout(() => {
          window.location.href = '/change-password';
        }, 1000);
      }
      
      return Promise.reject(error);
    }

    // Handle token refresh (single-flight, concurrency-safe)
    if (error.response?.status === 401 && !originalRequest._retry) {
      const reqUrl = originalRequest?.url || ''

      // Never try to refresh on auth endpoints themselves — that's a real auth failure
      if (_isRefreshBlacklisted(reqUrl)) {
        console.warn('[API] 401 on auth endpoint, not retrying:', reqUrl)
        _clearAuthAndRedirect(true)
        return Promise.reject(error)
      }

      // No refresh token => immediate logout
      const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN)
      if (!refreshToken) {
        console.warn('[API] No refresh token available, redirecting to login')
        _clearAuthAndRedirect(!_isSilentAuthEndpoint(reqUrl))
        return Promise.reject(error)
      }

      // If too many consecutive refresh failures already, fail fast
      if (_refreshFailureCount >= AUTH_RESILIENCE_CONFIG.REFRESH_FAILURE_THRESHOLD && !_refreshPromise) {
        console.warn('[API] Refresh failure threshold reached, forcing logout')
        _clearAuthAndRedirect(!_isSilentAuthEndpoint(reqUrl))
        return Promise.reject(error)
      }

      originalRequest._retry = true

      try {
        // All concurrent 401s share the same refresh promise (mutex pattern).
        // This prevents refresh-token rotation from invalidating parallel calls.
        const newAccess = await _refreshAccessToken()

        // Update header on the original request and retry
        originalRequest.headers = originalRequest.headers || {}
        originalRequest.headers.Authorization = `Bearer ${newAccess}`
        return apiClient(originalRequest)
      } catch (refreshError) {
        // Silent endpoints (background polling) shouldn't show a toast
        const silent = _isSilentAuthEndpoint(reqUrl)
        if (silent) {
          console.warn('[API] Silent 401 on background endpoint, suppressing toast:', reqUrl)
          // Don't redirect on silent endpoints — let an active user-initiated request trigger logout
          localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN)
          return Promise.reject(refreshError)
        }
        _clearAuthAndRedirect(true)
        return Promise.reject(refreshError)
      }
    }

    // Enhanced error messages for different error types
    if (error.response?.status !== 401 || originalRequest._retry) {
      // Suppress toasts for background/polling endpoints — they should fail silently
      const silent = _isSilentAuthEndpoint(originalRequest?.url || '')
      if (silent) {
        return Promise.reject(error)
      }

      // Suppress 403 for non-admin endpoints
      if (error.response?.status === 403) {
        const silentForbidden = [
          '/rbac/ai-champion/champion/current',
        ]
        if (silentForbidden.some(e => (originalRequest?.url || '').includes(e))) {
          return Promise.reject(error)
        }
      }

      let errorMessage = 'An error occurred';
      
      if (!error.response) {
        // Network/CORS error
        errorMessage = 'Network error. Please check your connection or try again later.';
      } else if (error.response.status >= 500) {
        // Server error
        errorMessage = 'Server error. Please try again in a moment.';
      } else {
        // Client error
        errorMessage = error.response?.data?.detail || 
                      error.response?.data?.message || 
                      error.response?.data?.error ||
                      `Request failed: ${error.response.status}`;
      }
      
      toast.error(errorMessage);
    }

    return Promise.reject(error)
  }
)

// Add CORS test function to the client
apiClient.testCors = testCorsConnection;

/**
 * Create a custom axios instance for long-running file uploads/processing
 * Uses extended timeout for OCR, AI processing, and large file operations
 */
export const apiClientLongTimeout = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT_LONG, // 10 minutes for file processing
  headers: {
    'Content-Type': 'application/json',
  },
})

// Apply same interceptors to long timeout client
apiClientLongTimeout.interceptors.request.use(apiClient.interceptors.request.handlers[0].fulfilled)
apiClientLongTimeout.interceptors.response.use(
  apiClient.interceptors.response.handlers[0].fulfilled,
  apiClient.interceptors.response.handlers[0].rejected
)

console.log('[API Service] Long timeout client initialized for file processing')
console.log('[API Service] Long Timeout:', API_TIMEOUT_LONG, 'ms')

export default apiClient
