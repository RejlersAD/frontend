import { useCallback, useEffect, useState } from 'react'
import apiClient from '../services/api.service'

export const canonicalAIProvider = provider => provider === 'claude' ? 'anthropic' : provider

// Readiness is advisory. Extraction endpoints authorize the source and resolve
// the current server credential again when the operation starts.
export default function useAIProviderStatus(provider) {
  const [state, setState] = useState({ providers: [], loading: true, error: false })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const refresh = () => setAttempt(value => value + 1)
    window.addEventListener('radai:ai-provider-status-refresh', refresh)
    return () => window.removeEventListener('radai:ai-provider-status-refresh', refresh)
  }, [])
  useEffect(() => {
    const controller = new AbortController()
    // Retire only the known former AI credential slots, without reading values.
    try {
      for (const name of Object.keys(sessionStorage)) {
        if (/^radai_pidv[12]_byok_apikey(?:::|$)/.test(name) || /^radai_(?:spec_user_(?:openai|claude)_key|user_openai_key)(?:::|$)/.test(name) || /^io_list_vision_api_key(?:::|$)/.test(name)) sessionStorage.removeItem(name)
      }
    } catch { /* Browser storage may be disabled. */ }
    setState({ providers: [], loading: true, error: false })
    apiClient.get('/rbac/ai-provider-status/', { signal: controller.signal, suppressErrorToast: true, timeout: 30000 })
      .then(({ data }) => { if (!controller.signal.aborted) setState({ providers: data.providers || [], loading: false, error: false }) })
      .catch(() => { if (!controller.signal.aborted) setState({ providers: [], loading: false, error: true }) })
    return () => controller.abort()
  }, [attempt])
  const configuration = state.providers.find(item => item.provider === canonicalAIProvider(provider))
  const refresh = useCallback(() => window.dispatchEvent(new Event('radai:ai-provider-status-refresh')), [])
  return { ...state, ...configuration, refresh, canUseAI: Boolean(configuration && (!configuration.managed || configuration.ready)) }
}
