import { useCallback, useEffect, useRef, useState } from 'react'
import planningIntelligenceService from '../services/planningIntelligence.service'

const TERMINAL_STATUSES = new Set(['succeeded', 'failed', 'cancelled'])
const wait = (milliseconds) => new Promise(resolve => setTimeout(resolve, milliseconds))

export default function usePlanningJob({ pollInterval = 1500 } = {}) {
  const [activeJob, setActiveJob] = useState(null)
  const runToken = useRef(0)

  useEffect(() => () => { runToken.current += 1 }, [])

  const runJob = useCallback(async (startRequest) => {
    const token = ++runToken.current
    let job = await startRequest()
    setActiveJob(job)

    while (!TERMINAL_STATUSES.has(job.status)) {
      await wait(pollInterval)
      if (token !== runToken.current) throw new Error('Planning job polling was cancelled.')
      job = await planningIntelligenceService.getJob(job.id)
      setActiveJob(job)
    }
    if (job.status !== 'succeeded') {
      const error = new Error(job.error_message || job.message || 'Planning job did not complete.')
      error.job = job
      throw error
    }
    return job
  }, [pollInterval])

  const cancelJob = useCallback(async () => {
    runToken.current += 1
    if (!activeJob || TERMINAL_STATUSES.has(activeJob.status)) return null
    const cancelled = await planningIntelligenceService.cancelJob(activeJob.id)
    setActiveJob(cancelled)
    return cancelled
  }, [activeJob])

  const clearJob = useCallback(() => setActiveJob(null), [])
  return { activeJob, runJob, cancelJob, clearJob }
}
