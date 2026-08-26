import { useCallback, useEffect, useRef, useState } from 'react'
import planningIntelligenceService from '../services/planningIntelligence.service'

const TERMINAL_STATUSES = new Set(['succeeded', 'failed', 'cancelled'])
const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))

export default function usePlanningJob({ pollInterval = 1500, storageKey = 'radai-planning-active-job' } = {}) {
  const [activeJob, setActiveJob] = useState(null)
  const runToken = useRef(0)

  const remember = useCallback(job => {
    setActiveJob(job)
    try {
      if (job?.id) localStorage.setItem(storageKey, String(job.id))
      else localStorage.removeItem(storageKey)
    } catch { /* storage is an optional resilience layer */ }
  }, [storageKey])

  const monitorJob = useCallback(async (initialJob, token, { throwOnFailure = true } = {}) => {
    let job = initialJob
    remember(job)
    while (!TERMINAL_STATUSES.has(job.status)) {
      await wait(pollInterval)
      if (token !== runToken.current) return null
      job = await planningIntelligenceService.getJob(job.id)
      remember(job)
    }
    if (throwOnFailure && job.status !== 'succeeded') {
      const error = new Error(job.error_message || job.message || 'Planning job did not complete.')
      error.job = job
      throw error
    }
    return job
  }, [pollInterval, remember])

  useEffect(() => {
    let jobId = null
    try { jobId = localStorage.getItem(storageKey) } catch { /* ignore */ }
    if (!jobId) return undefined
    const token = ++runToken.current
    planningIntelligenceService.getJob(jobId)
      .then(job => monitorJob(job, token, { throwOnFailure: false }))
      .catch(() => {
        try { localStorage.removeItem(storageKey) } catch { /* ignore */ }
      })
    return () => { runToken.current += 1 }
  }, [monitorJob, storageKey])

  const runJob = useCallback(async (startRequest) => {
    const token = ++runToken.current
    const job = await startRequest()
    return monitorJob(job, token)
  }, [monitorJob])

  const cancelJob = useCallback(async () => {
    runToken.current += 1
    if (!activeJob || TERMINAL_STATUSES.has(activeJob.status)) return null
    const cancelled = await planningIntelligenceService.cancelJob(activeJob.id)
    remember(cancelled)
    return cancelled
  }, [activeJob, remember])

  const clearJob = useCallback(() => {
    runToken.current += 1
    remember(null)
  }, [remember])
  return { activeJob, runJob, cancelJob, clearJob }
}
