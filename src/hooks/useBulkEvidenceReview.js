import { useCallback, useEffect, useRef, useState } from 'react'
import { planningIntelligenceService as service } from '../services/planningIntelligence.service'

const running = job => ['queued', 'running'].includes(job?.status)
const terminal = job => ['succeeded', 'failed', 'cancelled'].includes(job?.status)
const message = error => error?.response?.data?.detail || error?.response?.data?.error || error?.message || 'Unable to check bulk review progress.'
const belongsTo = (job, projectId, graphId) => Boolean(job?.id)
  && String(job.project) === String(projectId) && job.job_type === 'evidence_bulk'
  && (!job.result_data?.graph_id || String(job.result_data.graph_id) === String(graphId))

// One project owns this hook. Requests are aborted and checked again after each
// await, so late responses cannot become another project's review or decisions.
export default function useBulkEvidenceReview({ projectId, data, onComplete, onConflict }) {
  const [job, setJob] = useState(null)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')
  const [pollError, setPollError] = useState('')
  const [retry, setRetry] = useState(0)
  const mounted = useRef(false)
  const current = useRef({ data, onComplete, onConflict })
  const completed = useRef(new Set())
  const startingRef = useRef(false)
  const startController = useRef(null)
  current.current = { data, onComplete, onConflict }

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false; startController.current?.abort() }
  }, [])

  useEffect(() => {
    if (!data) return
    const summary = data?.bulk_review
    const active = summary?.active_job
    const latest = summary?.latest_job
    const candidate = belongsTo(active, projectId, data?.graph_id) && running(active) ? active
      : belongsTo(latest, projectId, data?.graph_id) && terminal(latest)
        && (latest.result_data?.result_revision === data?.revision
          || ['failed', 'cancelled'].includes(latest.status) && latest.result_data?.result_revision == null) ? latest : null
    setJob(previous => {
      if (candidate && running(candidate) && (candidate.id !== previous?.id || !running(previous))) {
        completed.current.delete(String(candidate.id))
        return candidate
      }
      if (previous && belongsTo(previous, projectId, data?.graph_id)) {
        if (running(previous)) return previous
        const resultRevision = previous.result_data?.result_revision
        if (resultRevision === data?.revision || resultRevision > data?.revision
          || resultRevision == null && previous.result_data?.source_revision === data?.revision) return previous
      }
      if (candidate && terminal(candidate)) completed.current.add(String(candidate.id))
      return candidate
    })
  }, [data, projectId])

  const finish = useCallback(result => {
    if (!terminal(result) || completed.current.has(String(result.id))) return
    completed.current.add(String(result.id))
    current.current.onComplete?.(result)
  }, [])

  const jobId = job?.id
  const jobStatus = job?.status
  useEffect(() => {
    if (!['queued', 'running'].includes(jobStatus)) return undefined
    let stopped = false
    let timer
    const controller = new AbortController()
    const poll = async () => {
      try {
        const next = await service.getJob(jobId, controller.signal)
        if (stopped || !mounted.current) return
        if (!belongsTo(next, projectId, current.current.data?.graph_id)) throw new Error('The returned job does not belong to this project review. Reload review to check its current state.')
        if (Number.isInteger(next.result_data?.result_revision) && next.result_data.result_revision < current.current.data?.revision) {
          setJob(null)
          setError('This job result belongs to an older review revision. The current review has been retained.')
          return
        }
        setJob(next); setPollError('')
        if (terminal(next)) finish(next)
        else timer = window.setTimeout(poll, 1500)
      } catch (caught) {
        if (!stopped && !controller.signal.aborted && mounted.current) setPollError(String(message(caught)))
      }
    }
    timer = window.setTimeout(poll, 1500)
    return () => { stopped = true; controller.abort(); window.clearTimeout(timer) }
  }, [jobId, jobStatus, projectId, retry, finish])

  const start = async (mode, reason) => {
    if (startingRef.current || running(job)) return
    const basis = current.current.data
    startingRef.current = true
    setStarting(true); setError(''); setPollError('')
    const controller = new AbortController()
    startController.current = controller
    try {
      const next = await service.startBulkEvidenceReview(projectId, { revision: basis.revision, mode, reason: reason.trim() }, controller.signal)
      if (!mounted.current || controller.signal.aborted) return
      if (basis.graph_id !== current.current.data?.graph_id || basis.revision !== current.current.data?.revision) {
        throw new Error('The review changed while the job was being started. Reload review to recover its saved progress.')
      }
      if (!belongsTo(next, projectId, basis.graph_id)) throw new Error('The returned job does not belong to this project review. Reload review before continuing.')
      if (Number.isInteger(next.result_data?.source_revision) && next.result_data.source_revision !== basis.revision) throw new Error('The returned job was started from a different review revision. Reload review before continuing.')
      if (running(next)) completed.current.delete(String(next.id))
      setJob(next)
      finish(next)
    } catch (caught) {
      if (!mounted.current || controller.signal.aborted) return
      if (caught.response?.status === 409) current.current.onConflict?.(caught)
      else setError(String(message(caught)))
    } finally {
      startingRef.current = false
      if (mounted.current) setStarting(false)
    }
  }

  return { job, starting, running: starting || running(job), error, pollError, start,
    clearError: () => setError(''),
    checkProgress: () => { setPollError(''); setRetry(value => value + 1) } }
}
