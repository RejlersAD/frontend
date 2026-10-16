import apiClient from './api.service'
import { STORAGE_KEYS } from '../config/app.config'
import { createInFlightReads } from './inFlightReads'

const reads = createInFlightReads(() => {
  try { return JSON.stringify([localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN), localStorage.getItem(STORAGE_KEYS.USER_DATA)]) }
  catch { return null }
})
const mutatesPlanning = config => config?.url?.includes('/planning-intelligence/') && !['get', 'head', 'options'].includes(config.method?.toLowerCase())
// Commands invalidate pending reads both before and after the server mutation.
apiClient.interceptors.request.use(config => { if (mutatesPlanning(config)) reads.invalidate(); return config })
apiClient.interceptors.response.use(response => { if (mutatesPlanning(response.config)) reads.invalidate(); return response }, error => {
  if (mutatesPlanning(error.config)) reads.invalidate()
  return Promise.reject(error)
})

export function planningGet(url, { signal, params, ...config } = {}) {
  const orderedParams = Object.entries(params || {}).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => [key, value == null ? value : String(value)])
  const key = JSON.stringify([url, orderedParams, config])
  return reads.get(key, sharedSignal => apiClient.get(url, { ...config, params, signal: sharedSignal }), signal)
}
