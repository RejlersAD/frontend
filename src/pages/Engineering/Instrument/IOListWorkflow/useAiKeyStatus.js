/**
 * useAiKeyStatus — BYOK state for the IO List extraction workspace.
 * Wraps the shared per-user AI key endpoints; the raw key is never stored
 * in the browser and never echoed back by the server.
 */
import { useCallback, useEffect, useState } from 'react'
import apiClient from '../../../../services/api.service'

const BASE = '/instrument-io-workflow/user/ai-key'

export default function useAiKeyStatus() {
  const [keyInfo, setKeyInfo] = useState(null)
  const [modal, setModal] = useState(false)
  const [testState, setTestState] = useState(null)

  const refresh = useCallback(async () => {
    try {
      const { data } = await apiClient.get(`${BASE}/`)
      setKeyInfo(data?.saved ? {
        saved: true, provider: data.provider, last4: data.last4,
        testedAt: data.last_tested_at ? new Date(data.last_tested_at).toLocaleTimeString() : '',
      } : { saved: false })
    } catch {
      setKeyInfo({ saved: false })
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const onTestKey = useCallback(async (provider, apiKey) => {
    setTestState({ testing: true })
    try {
      const { data } = await apiClient.post(`${BASE}/test/`,
        { provider, api_key: apiKey }, { sensitiveRequest: true, timeout: 60000 })
      setTestState({ ok: !!data.valid, message: data.message, testing: false })
      return !!data.valid
    } catch (err) {
      setTestState({ ok: false, message: 'Provider not reachable — try again', testing: false })
      return false
    }
  }, [])

  const onSaveKey = useCallback(async (provider, apiKey) => {
    await apiClient.put(`${BASE}/`, { provider, api_key: apiKey }, { sensitiveRequest: true })
    setModal(false)
    setTestState(null)
    await refresh()
  }, [refresh])

  const onRemoveKey = useCallback(async () => {
    await apiClient.delete(`${BASE}/`)
    await refresh()
  }, [refresh])

  return { keyInfo, modal, setModal, testState, onTestKey, onSaveKey, onRemoveKey }
}
