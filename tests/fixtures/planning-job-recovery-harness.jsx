import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import usePlanningJob from '../../src/hooks/usePlanningJob'
import service from '../../src/services/planningIntelligence.service'

// Actual React hook, with every domain request replaced by an isolated test double.
const setup = window.jobRecoverySetup || {}
const calls = []
const pending = new Map()
const queues = { list: [...(setup.list || [])], get: [...(setup.get || [])], progress: [...(setup.progress || [])], start: [...(setup.start || [])] }
const execute = async (method, args) => {
  calls.push({ method, args })
  let response = queues[method]?.shift()
  if (response?.defer) response = await new Promise(resolve => pending.set(response.defer, resolve))
  if (response?.error) throw Object.assign(new Error(response.error.message || 'Status unavailable'), { response: { status: response.error.status } })
  if (response && 'value' in response) return response.value
  if (method === 'list') return []
  return { id: args[0], project: 32, job_type: 'analyze', status: 'running' }
}
service.getActiveJob = async (...args) => (await execute('list', args))?.filter(item => String(item.project) === String(args[0]) && item.job_type === 'analyze' && ['queued', 'running'].includes(item.status)).sort((a, b) => b.id - a.id)[0] || null
service.getJobProgress = (...args) => execute(setup.compact ? 'progress' : 'get', args)
service.getJob = (...args) => execute('get', args)
service.cancelJob = (...args) => execute('cancel', args)

function Harness() {
  const [projectId, setProjectId] = useState(setup.projectId === undefined ? 32 : setup.projectId)
  const jobState = usePlanningJob({
    projectId, pollInterval: 100, storageKey: 'planning-job-recovery-test',
    recoverActiveAnalysis: setup.enabled !== false,
    initialJob: setup.initialJob || null,
  })
  useEffect(() => {
    window.jobRecovery = {
      calls, projectId, activeJob: jobState.activeJob,
      monitoringError: jobState.monitoringError && {
        message: jobState.monitoringError.message, jobUnavailable: jobState.monitoringError.jobUnavailable,
      },
      setProjectId, clear: jobState.clearJob,
      run: () => { void jobState.runJob(() => execute('start', [])).catch(() => {}) },
      retry: () => { void jobState.retryMonitoring() },
      enqueue: (method, response) => queues[method].push(response),
      resolve: (key, response) => { pending.get(key)?.(response); pending.delete(key) },
      isPending: key => pending.has(key),
    }
  }, [jobState, projectId])
  return <main><h1>Planning job recovery</h1><output>{jobState.activeJob ? `${jobState.activeJob.id}: ${jobState.activeJob.status}` : 'No job'}</output></main>
}

createRoot(document.getElementById('root')).render(<Harness />)
