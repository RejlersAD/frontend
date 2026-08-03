/**
 * Centralized Environment Configuration Loader
 * ============================================
 * This module provides soft-coded configuration management for AIFlow frontend.
 * It reads from the centralized environments.json file to ensure alignment
 * between frontend, backend, and database configurations.
 * 
 * Based on commit: c6c3a7e (9-3-26 : First Commit)
 * Date: 2026-03-11
 * 
 * NOTE: For Docker environments, config is mounted from ../../../config/environments.json
 *       For local development, a copy exists at ./environments.json
 */

// SOFT-CODED: Try to import from local copy (fallback for non-Docker development)
// In Docker, the config directory is mounted and accessible
import environmentsConfig from './environments.json'

/**
 * Environment Configuration Manager
 */
class EnvironmentConfig {
  constructor() {
    this.config = environmentsConfig
    this.currentEnv = this.detectEnvironment()
    
    // Log configuration on initialization
    if (import.meta.env.DEV || this.currentEnv === 'local') {
      this.printCurrentConfig()
    }
  }

  /**
   * Detect current environment (local, dev, preprod, production)
   * @returns {string} Environment name
   */
  detectEnvironment() {
    // Check for explicit environment variable
    const explicitEnv = import.meta.env.VITE_AIFLOW_ENVIRONMENT?.toLowerCase()
    if (['local', 'dev', 'preprod', 'production', 'testing'].includes(explicitEnv)) {
      return explicitEnv
    }

    // Detect from hostname (browser environment)
    if (typeof window !== 'undefined' && window.location) {
      const hostname = window.location.hostname
      
      // Local development
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'local'
      }
      
      // Production domain
      if (hostname === 'radai.ae' || hostname === 'www.radai.ae') {
        return 'production'
      }
      
      // Vercel deployments - check subdomain
      if (hostname.includes('vercel.app')) {
        if (hostname.includes('preprod')) {
          return 'preprod'
        }
        if (hostname.includes('dev')) {
          return 'dev'
        }
        // Default Vercel to production
        return 'production'
      }
    }

    // Check Vercel environment variables (build time)
    const vercelEnv = import.meta.env.VITE_VERCEL_ENV
    if (vercelEnv === 'production') {
      return 'production'
    }
    if (vercelEnv === 'preview') {
      // Check branch name for preview deployments
      const branch = import.meta.env.VITE_VERCEL_GIT_COMMIT_REF
      if (branch?.includes('preprod')) {
        return 'preprod'
      }
      if (branch?.includes('dev')) {
        return 'dev'
      }
      return 'preprod' // Default preview to preprod
    }

    // Default to local
    return 'local'
  }

  /**
   * Get current environment name
   * @returns {string}
   */
  getEnvironment() {
    return this.currentEnv
  }

  /**
   * Get configuration value
   * @param {string} key - Configuration key (e.g., 'backend.url')
   * @param {string} environment - Environment name (defaults to current)
   * @param {*} defaultValue - Default value if key not found
   * @returns {*}
   */
  get(key, environment = null, defaultValue = null) {
    const env = environment || this.currentEnv
    const keys = key.split('.')
    
    let value = this.config.environments?.[env]
    if (!value) return defaultValue

    try {
      for (const k of keys) {
        value = value[k]
        if (value === undefined) return defaultValue
      }
      return value
    } catch {
      return defaultValue
    }
  }

  /**
   * Get backend configuration
   * @param {string} environment - Environment name
   * @returns {object}
   */
  getBackendConfig(environment = null) {
    const env = environment || this.currentEnv
    return this.config.environments?.[env]?.backend || {}
  }

  /**
   * Get frontend configuration
   * @param {string} environment - Environment name
   * @returns {object}
   */
  getFrontendConfig(environment = null) {
    const env = environment || this.currentEnv
    return this.config.environments?.[env]?.frontend || {}
  }

  /**
   * Get database configuration
   * @param {string} environment - Environment name
   * @returns {object}
   */
  getDatabaseConfig(environment = null) {
    const env = environment || this.currentEnv
    return this.config.environments?.[env]?.database || {}
  }

  /**
   * Get CORS allowed origins
   * @param {string} environment - Environment name
   * @returns {array}
   */
  getCorsOrigins(environment = null) {
    const env = environment || this.currentEnv
    return this.config.features?.cors?.allowed_origins?.[env] || []
  }

  /**
   * Get API configuration
   * @returns {object}
   */
  getApiConfig() {
    return this.config.api || {}
  }

  /**
   * Get backend URL for current environment
   * @returns {string}
   */
  getBackendUrl() {
    return this.getBackendConfig().url || 'http://localhost:8000'
  }

  /**
   * Get API URL for current environment
   * @returns {string}
   */
  getApiUrl() {
    const backendConfig = this.getBackendConfig()
    
    // For localhost, use Vite proxy (relative path)
    if (this.currentEnv === 'local') {
      return '/api/v1'
    }
    
    // For production and other remote environments, use full URL
    const apiUrl = backendConfig.api_url || 'http://localhost:8000/api/v1'
    
    // Log API URL in production for debugging (only once)
    if (this.currentEnv === 'production' && !window.__API_URL_LOGGED) {
      console.log(`[ENV] 🌐 Production API URL: ${apiUrl}`)
      window.__API_URL_LOGGED = true
    }
    
    return apiUrl
  }

  /**
   * Get API base URL (for axios baseURL)
   * This intelligently handles Vite proxy for local development
   * @returns {string}
   */
  getApiBaseUrl() {
    return this.getApiUrl()
  }

  /**
   * Print current configuration (debug helper)
   */
  printCurrentConfig() {
    console.log('\n' + '='.repeat(60))
    console.log(`[CONFIG] Current Environment: ${this.currentEnv}`)
    console.log('='.repeat(60))

    const backend = this.getBackendConfig()
    console.log('\n[BACKEND]')
    Object.entries(backend).forEach(([key, value]) => {
      console.log(`  ${key}: ${value}`)
    })

    const frontend = this.getFrontendConfig()
    console.log('\n[FRONTEND]')
    Object.entries(frontend).forEach(([key, value]) => {
      console.log(`  ${key}: ${value}`)
    })

    const database = this.getDatabaseConfig()
    console.log('\n[DATABASE]')
    Object.entries(database).forEach(([key, value]) => {
      if (key.toLowerCase().includes('password')) {
        console.log(`  ${key}: ****`)
      } else {
        console.log(`  ${key}: ${value}`)
      }
    })

    console.log(`\n[CORS] Allowed Origins: ${JSON.stringify(this.getCorsOrigins())}`)
    console.log(`[API] Config: ${JSON.stringify(this.getApiConfig())}`)
    console.log('='.repeat(60) + '\n')
  }
}

// Singleton instance
const envConfig = new EnvironmentConfig()

// Export singleton and convenience functions
export default envConfig

/**
 * Get current environment name
 * @returns {string}
 */
export const getEnvironment = () => envConfig.getEnvironment()

/**
 * Get backend URL for current environment
 * @returns {string}
 */
export const getBackendUrl = () => envConfig.getBackendUrl()

/**
 * Get API URL for current environment
 * @returns {string}
 */
export const getApiUrl = () => envConfig.getApiUrl()

/**
 * Get API base URL (for axios)
 * @returns {string}
 */
export const getApiBaseUrl = () => envConfig.getApiBaseUrl()

/**
 * Get API timeout settings
 * @returns {object}
 */
export const getApiTimeouts = () => {
  const config = envConfig.getApiConfig()
  return {
    timeout: config.timeout || 120000,
    timeoutLong: config.timeout_long || 300000,
    timeoutAuth: config.timeout_auth || 90000,
    // SOFT-CODED: Upload and refresh timeouts for Railway cold-start resilience
    timeoutUpload: config.timeout_upload || 120000,
    timeoutRefresh: config.timeout_refresh || 90000,
    // SOFT-CODED: PFD AI verification — multi-page analysis can take 5-8 min
    timeoutPfdVerify: config.timeout_pfd_verify || 600000,
  }
}

/**
 * Get CORS origins for current environment
 * @returns {array}
 */
export const getCorsOrigins = () => envConfig.getCorsOrigins()
