import { useCallback, useEffect, useRef, useState } from 'react'
import { isTransientWrenchError, MAX_READ_ATTEMPTS, READ_RETRY_DELAY_MS } from '../utils/wrenchSyncState'

const identity = value => value
const neverPoll = () => false

// Read-only recovery for Wrench configuration/history. Mutations never use this
// hook: an uncertain command must not be repeated automatically.
export function useWrenchRead(loader, { enabled = true, parse = identity, pollWhen = neverPoll, pollInterval = 5000 } = {}) {
  const [data, setData] = useState(undefined)
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState(null)
  const generation = useRef(0)
  const disposed = useRef(true)
  const retryTimer = useRef(null)
  const latest = useRef({ loader, parse })
  latest.current = { loader, parse }

  const cancelDelay = useCallback(() => {
    if (retryTimer.current) {
      clearTimeout(retryTimer.current.timer)
      retryTimer.current.resolve(false)
      retryTimer.current = null
    }
  }, [])

  const refresh = useCallback(async () => {
    if (disposed.current) return
    const current = ++generation.current
    cancelDelay()
    setStatus('loading')
    setError(null)
    for (let attempt = 1; attempt <= MAX_READ_ATTEMPTS; attempt += 1) {
      try {
        const response = await latest.current.loader()
        const next = latest.current.parse(response.data)
        if (disposed.current || current !== generation.current) return
        setData(next)
        setStatus('ready')
        return next
      } catch (err) {
        if (disposed.current || current !== generation.current) return
        if (isTransientWrenchError(err) && attempt < MAX_READ_ATTEMPTS) {
          setStatus('retrying')
          const retry = await new Promise(resolve => {
            retryTimer.current = { resolve, timer: setTimeout(() => {
              retryTimer.current = null
              resolve(true)
            }, READ_RETRY_DELAY_MS) }
          })
          if (!retry || disposed.current || current !== generation.current) return
          continue
        }
        const code = err.response?.status ?? err.originalError?.response?.status
        setError(err)
        setStatus(code === 401 || code === 403 ? 'denied' : 'unavailable')
        return
      }
    }
  }, [cancelDelay])

  useEffect(() => {
    disposed.current = !enabled
    if (enabled) refresh()
    return () => {
      disposed.current = true
      generation.current += 1
      cancelDelay()
    }
  }, [enabled, refresh, cancelDelay])

  useEffect(() => {
    // A failed/denied read stops monitoring. Explicit recovery starts a fresh
    // bounded read; a successful read alone can resume normal active-job polling.
    if (!enabled || status !== 'ready' || !pollWhen(data)) return
    const timer = setTimeout(refresh, pollInterval)
    return () => clearTimeout(timer)
  }, [enabled, data, status, pollWhen, pollInterval, refresh])

  return { data, status, error, refresh, busy: status === 'loading' || status === 'retrying' }
}
