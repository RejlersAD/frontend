import apiClient from './api.service'
import { API_ENDPOINTS } from '../config/api.config'
import { STORAGE_KEYS } from '../config/app.config'
import passwordExpiryService from './passwordExpiry.service'
import { getApiTimeouts } from '../config/environment.config'

// SOFT-CODED: Auth timeout from centralized config (90s to handle Railway cold-start DB reconnect)
const { timeoutAuth: AUTH_TIMEOUT_MS } = getApiTimeouts()

// =============================================================================
// SOFT-CODED LOGIN RESILIENCE CONFIG
// -----------------------------------------------------------------------------
// Railway free/shared tiers cold-start the Django container + DB pool on the
// first request after idle. Symptom: /health/ and /auth/login/ both ECONNABORTED.
// This config controls warmup + retry behavior. Tune values here without
// changing any of the underlying request/response logic.
//
// Override at runtime (e.g. from DevTools) via:
//   window.__LOGIN_RESILIENCE_OVERRIDE = { LOGIN_MAX_ATTEMPTS: 3, ... }
// =============================================================================
const _runtimeOverride =
  (typeof window !== 'undefined' && window.__LOGIN_RESILIENCE_OVERRIDE) || {}

const LOGIN_RESILIENCE_CONFIG = {
  // Warmup ping — wakes Railway container & opens DB pool before the real POST.
  // Hardcoded 15 s was too short for true cold-start; bumped to 45 s and we
  // retry a couple of times since the first hit usually triggers boot.
  WARMUP_TIMEOUT_MS: 45000,
  WARMUP_MAX_ATTEMPTS: 3,
  WARMUP_RETRY_DELAY_MS: 1500,

  // Login POST — total attempts including the first try.
  // After a successful warmup the server is hot, so a retry almost always
  // succeeds quickly even if the first POST timed out mid-cold-start.
  LOGIN_MAX_ATTEMPTS: 2,
  LOGIN_RETRY_DELAY_MS: 2000,
  // Per-attempt login timeout — overridable independently of the global
  // AUTH_TIMEOUT_MS so we can be more aggressive on retries.
  LOGIN_ATTEMPT_TIMEOUT_MS: AUTH_TIMEOUT_MS,

  // Errors we consider transient (cold-start / network) and therefore
  // safe to retry. Auth failures (401) and validation errors are NOT retried.
  isTransient(err) {
    if (!err) return false
    if (err.isTimeout || err.isNetworkError) return true
    if (err.code === 'ECONNABORTED' || err.code === 'ERR_NETWORK') return true
    const msg = (err.message || '').toLowerCase()
    if (msg.includes('timeout') || msg.includes('network')) return true
    const sc = err.response?.status
    // Gateway / overloaded backend — retry. NEVER retry 4xx auth errors.
    if (sc === 502 || sc === 503 || sc === 504 || sc === 408 || sc === 429) return true
    return false
  },

  ..._runtimeOverride,
}

const _sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * Wake the backend with retries. Non-fatal — login is still attempted even
 * if every warmup attempt fails (the POST itself can succeed once the
 * container finishes booting partway through our wait).
 */
async function _warmupBackend() {
  const { WARMUP_MAX_ATTEMPTS, WARMUP_TIMEOUT_MS, WARMUP_RETRY_DELAY_MS } =
    LOGIN_RESILIENCE_CONFIG
  for (let attempt = 1; attempt <= WARMUP_MAX_ATTEMPTS; attempt++) {
    const t0 = Date.now()
    try {
      await apiClient.get(API_ENDPOINTS.HEALTH, { timeout: WARMUP_TIMEOUT_MS })
      console.log(
        `[AuthService] ✅ Backend warmed up (attempt ${attempt}/${WARMUP_MAX_ATTEMPTS}) in ${Date.now() - t0} ms`
      )
      return true
    } catch (err) {
      console.warn(
        `[AuthService] ⚠️ Warmup attempt ${attempt}/${WARMUP_MAX_ATTEMPTS} failed in ${Date.now() - t0} ms:`,
        err.message
      )
      if (attempt < WARMUP_MAX_ATTEMPTS) await _sleep(WARMUP_RETRY_DELAY_MS)
    }
  }
  return false
}

/**
 * Authentication Service
 * Smart authentication operations
 */

export const authService = {
  /**
   * Login user with enhanced error handling and timeout detection
   */
  async login(credentials) {
    console.log('[AuthService] 🔐 Starting login process...')
    console.log('[AuthService] Email:', credentials.email)
    console.log('[AuthService] API Endpoint:', API_ENDPOINTS.LOGIN)
    console.log('[AuthService] Auth timeout:', AUTH_TIMEOUT_MS, 'ms')
    
    try {
      const loginStartTime = Date.now()

      // Warmup ping(s): wake the Railway backend before the login POST.
      // Soft-coded retries + extended timeout — Railway cold-start can take
      // 30-90 s and a single 15 s ping wasn't enough. Failures are non-fatal.
      console.log('[AuthService] 🌡️ Warming up backend connection...')
      await _warmupBackend()

      console.log('[AuthService] 📡 Sending login request to backend...')

      // Retry the login POST on transient errors (timeout / 5xx / network).
      // By the time we retry, the warmup attempts above have usually finished
      // booting the container, so the second attempt is fast. We NEVER retry
      // on 401 / validation errors — those are real auth failures.
      const { LOGIN_MAX_ATTEMPTS, LOGIN_RETRY_DELAY_MS, LOGIN_ATTEMPT_TIMEOUT_MS } =
        LOGIN_RESILIENCE_CONFIG
      let response
      let lastErr
      for (let attempt = 1; attempt <= LOGIN_MAX_ATTEMPTS; attempt++) {
        const tAttempt = Date.now()
        try {
          response = await apiClient.post(API_ENDPOINTS.LOGIN, credentials, {
            timeout: LOGIN_ATTEMPT_TIMEOUT_MS,
          })
          console.log(
            `[AuthService] ✅ Login attempt ${attempt}/${LOGIN_MAX_ATTEMPTS} succeeded in ${Date.now() - tAttempt} ms`
          )
          lastErr = null
          break
        } catch (err) {
          lastErr = err
          const transient = LOGIN_RESILIENCE_CONFIG.isTransient(err)
          console.warn(
            `[AuthService] ⚠️ Login attempt ${attempt}/${LOGIN_MAX_ATTEMPTS} failed in ${Date.now() - tAttempt} ms (transient=${transient}):`,
            err.message
          )
          if (!transient || attempt >= LOGIN_MAX_ATTEMPTS) {
            throw err
          }
          // Quick best-effort warmup between attempts — the container may
          // have finished booting since the last warmup round.
          await _sleep(LOGIN_RETRY_DELAY_MS)
        }
      }
      if (!response) {
        throw lastErr || new Error('Login failed after retries')
      }

      const loginEndTime = Date.now()
      console.log('[AuthService] ✅ Login request completed in', loginEndTime - loginStartTime, 'ms')
      
      const { access, refresh } = response.data
      
      if (!access || !refresh) {
        console.error('[AuthService] ❌ Invalid response - missing tokens');
        throw new Error('Invalid response from server - missing tokens')
      }
      
      console.log('[AuthService] 🔑 Tokens received, storing...')
      
      // Store tokens
      localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, access)
      localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refresh)
      
      console.log('[AuthService] 👤 Fetching user data...')
      
      // Get user data with retry logic
      let userData;
      let retries = 3;
      while (retries > 0) {
        try {
          userData = await this.getCurrentUser()
          break;
        } catch (userError) {
          retries--;
          if (retries === 0) {
            throw userError;
          }
          console.warn(`[AuthService] Failed to get user data, retrying... (${retries} attempts left)`);
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
        }
      }
      
      localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(userData))
      
      console.log('[AuthService] ✅ Login process completed successfully')
      
      // Start password expiry checking
      try {
        await passwordExpiryService.checkPasswordExpiry()
        passwordExpiryService.startPeriodicCheck()
        console.log('[AuthService] 🔒 Password expiry monitoring started')
      } catch (expiryError) {
        console.warn('[AuthService] ⚠️ Failed to initialize password expiry checking:', expiryError)
        // Don't fail login if expiry check fails
      }
      
      return userData
    } catch (error) {
      console.error('[AuthService] ❌ Login failed:', error.message)
      
      // Re-throw with additional context
      if (error.isTimeout) {
        console.error('[AuthService] ⏱️ TIMEOUT during login request')
        error.message = 'Login request timed out. Please check your connection and try again.';
      } else if (error.isNetworkError) {
        console.error('[AuthService] 🌐 NETWORK ERROR during login request')
        error.message = 'Cannot connect to server. Please verify the backend is running.';
      } else if (error.response?.status === 401) {
        error.message = 'Invalid email or password. Please try again.';
      } else if (error.response?.status >= 500) {
        error.message = 'Server error. Please try again in a moment.';
      }
      
      throw error
    }
  },

  /**
   * Register new user
   */
  async register(userData) {
    const response = await apiClient.post(API_ENDPOINTS.USERS, userData)
    return response.data
  },

  /**
   * Logout user
   */
  logout() {
    // Stop password expiry checking
    passwordExpiryService.stopPeriodicCheck()
    passwordExpiryService.clearStatus()
    
    localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN)
    localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN)
    localStorage.removeItem(STORAGE_KEYS.USER_DATA)
    
    console.log('[AuthService] 🚪 Logged out successfully')
  },

  /**
   * Get current user data
   */
  async getCurrentUser() {
    const response = await apiClient.get(API_ENDPOINTS.USER_ME)
    return response.data
  },

  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    return !!localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN)
  },

  /**
   * Get stored user data
   */
  getUserData() {
    const userData = localStorage.getItem(STORAGE_KEYS.USER_DATA)
    return userData ? JSON.parse(userData) : null
  },
}
