import { useCallback, useEffect, useRef, useState } from 'react'
import planningIntelligenceService from '../services/planningIntelligence.service'

const TERMINAL_STATUSES = new Set(['succeeded', 'failed', 'cancelled'])
const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))

export default function usePlanningJob({ pollInterval = 1500, storageKey = 'radai-planning-active-job', projectId, recoverActiveAnalysis = false } = {}) {
  const [activeJob, setActiveJob] = useState(null)
  const [monitoringError, setMonitoringError] = useState(null)
  const [checkingStatus, setCheckingStatus] = useState(false)
  const runToken = useRef(0)
  const activeJobRef = useRef(null)
  const monitoringErrorRef = useRef(null)
  const monitoringBusy = useRef(false)
  const recoveryRequest = useRef(null)
  const clearedJobIds = useRef(new Set())
  const matchesProject = useCallback(job => projectId === undefined
    || (projectId != null && String(job?.project) === String(projectId)), [projectId])

  const remember = useCallback(job => {
    activeJobRef.current = job
    setActiveJob(job)
    try {
      if (job?.id) localStorage.setItem(storageKey, String(job.id))
      else localStorage.removeItem(storageKey)
    } catch { /* storage is an optional resilience layer */ }
  }, [storageKey])

  const recordMonitoringError = useCallback((error, job, token) => {
    if (token !== runToken.current) return
    if (!error.job) error.job = job
    error.jobUnavailable = [403, 404].includes(error.response?.status)
    if (error.jobUnavailable) {
      activeJobRef.current = null
      setActiveJob(null)
      try {
        if (localStorage.getItem(storageKey) === String(error.job?.id)) localStorage.removeItem(storageKey)
      } catch { /* storage is an optional resilience layer */ }
    }
    monitoringErrorRef.current = error
    setMonitoringError(error)
  }, [storageKey])

  const monitorJob = useCallback(async (initialJob, token, { throwOnFailure = true } = {}) => {
    let job = initialJob
    if (token !== runToken.current || !matchesProject(job)) return null
    monitoringBusy.current = true
    try {
      remember(job)
      while (!TERMINAL_STATUSES.has(job.status)) {
        await wait(pollInterval)
        if (token !== runToken.current) return null
        try {
          job = await planningIntelligenceService.getJob(job.id)
        } catch (error) {
          if (token !== runToken.current) return null
          recordMonitoringError(error, job, token)
          throw error
        }
        if (token !== runToken.current || !matchesProject(job)) return null
        remember(job)
      }
      if (throwOnFailure && job.status !== 'succeeded') {
        const error = new Error(job.error_message || job.message || 'Planning job did not complete.')
        error.job = job
        throw error
      }
      return job
    } finally {
      if (token === runToken.current) monitoringBusy.current = false
    }
  }, [matchesProject, pollInterval, recordMonitoringError, remember])

  const recoverServerJob = useCallback(async () => {
    if (!recoverActiveAnalysis || projectId == null || projectId === ''
      || monitoringBusy.current || activeJobRef.current
      || (monitoringErrorRef.current && !monitoringErrorRef.current.jobUnavailable)
      || recoveryRequest.current) return
    // Discovery never takes ownership from a user command or an existing monitor.
    const token = runToken.current
    const request = {}
    recoveryRequest.current = request
    try {
      const jobs = await planningIntelligenceService.listJobs(projectId, { suppressErrorToast: true })
      if (token !== runToken.current
        || monitoringBusy.current || activeJobRef.current) return
      const job = Array.isArray(jobs) && jobs.find(candidate => candidate?.id
        && matchesProject(candidate) && candidate.job_type === 'analyze'
        && !clearedJobIds.current.has(String(candidate.id))
        && ['queued', 'running'].includes(candidate.status))
      if (!job) return
      monitoringErrorRef.current = null
      setMonitoringError(null)
      await monitorJob(job, ++runToken.current, { throwOnFailure: false })
    } catch {
      // A passive lookup cannot replace a job-monitoring error. A later focus can
      // retry discovery; attached monitors already retain their explicit retry state.
    } finally {
      if (recoveryRequest.current === request) recoveryRequest.current = null
    }
  }, [matchesProject, monitorJob, projectId, recoverActiveAnalysis])

  useEffect(() => {
    const token = ++runToken.current
    activeJobRef.current = null
    monitoringBusy.current = false
    recoveryRequest.current = null
    clearedJobIds.current = new Set()
    setActiveJob(null)
    monitoringErrorRef.current = null
    setMonitoringError(null)
    setCheckingStatus(false)
    let jobId = null
    if (projectId !== null) {
      try { jobId = localStorage.getItem(storageKey) } catch { /* ignore */ }
    }
    if (jobId) {
      monitoringBusy.current = true
      planningIntelligenceService.getJob(jobId)
        .then(job => {
          if (token !== runToken.current) return null
          if (!matchesProject(job)) {
            try {
              if (localStorage.getItem(storageKey) === String(jobId)) localStorage.removeItem(storageKey)
            } catch { /* storage is an optional resilience layer */ }
            return null
          }
          return monitorJob(job, token, { throwOnFailure: false })
        })
        .catch(error => {
          if (token !== runToken.current) return
          recordMonitoringError(error, { id: jobId }, token)
        })
        .finally(() => {
          if (token !== runToken.current) return
          monitoringBusy.current = false
          void recoverServerJob()
        })
    } else {
      void recoverServerJob()
    }
    return () => { runToken.current += 1 }
  }, [matchesProject, monitorJob, projectId, recordMonitoringError, recoverServerJob, storageKey])

  useEffect(() => {
    if (!recoverActiveAnalysis) return undefined
    const onFocus = () => { void recoverServerJob() }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [recoverActiveAnalysis, recoverServerJob])

  const runJob = useCallback(async (startRequest) => {
    const token = ++runToken.current
    monitoringBusy.current = true
    monitoringErrorRef.current = null
    setMonitoringError(null)
    setCheckingStatus(false)
    try {
      const job = await startRequest()
      return await monitorJob(job, token)
    } finally {
      if (token === runToken.current) monitoringBusy.current = false
    }
  }, [monitorJob])

  const cancelJob = useCallback(async () => {
    const token = ++runToken.current
    if (!activeJob || TERMINAL_STATUSES.has(activeJob.status)) return null
    monitoringBusy.current = true
    try {
      const cancelled = await planningIntelligenceService.cancelJob(activeJob.id)
      if (token !== runToken.current || !matchesProject(cancelled)) return null
      monitoringErrorRef.current = null
      setMonitoringError(null)
      setCheckingStatus(false)
      remember(cancelled)
      return cancelled
    } finally {
      if (token === runToken.current) monitoringBusy.current = false
    }
  }, [activeJob, matchesProject, remember])

  const retryMonitoring = useCallback(async () => {
    if (monitoringError?.jobUnavailable) return null
    const jobId = activeJob?.id || monitoringError?.job?.id
    if (!jobId) return null
    const token = ++runToken.current
    monitoringBusy.current = true
    setCheckingStatus(true)
    try {
      const job = await planningIntelligenceService.getJob(jobId)
      if (token !== runToken.current) return null
      monitoringErrorRef.current = null
      setMonitoringError(null)
      setCheckingStatus(false)
      return await monitorJob(job, token, { throwOnFailure: false })
    } catch (error) {
      if (token !== runToken.current) return null
      recordMonitoringError(error, activeJob || { id: jobId }, token)
      return null
    } finally {
      if (token === runToken.current) {
        monitoringBusy.current = false
        setCheckingStatus(false)
      }
    }
  }, [activeJob, monitorJob, monitoringError, recordMonitoringError])

  const clearJob = useCallback(() => {
    runToken.current += 1
    monitoringBusy.current = false
    recoveryRequest.current = null
    const clearedId = activeJobRef.current?.id || monitoringErrorRef.current?.job?.id
    if (clearedId) clearedJobIds.current.add(String(clearedId))
    monitoringErrorRef.current = null
    setMonitoringError(null)
    setCheckingStatus(false)
    remember(null)
  }, [remember])
  return { activeJob, monitoringError, checkingStatus, retryMonitoring, runJob, cancelJob, clearJob }
}
