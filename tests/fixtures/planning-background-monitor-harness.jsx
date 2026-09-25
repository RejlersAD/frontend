import React, { useCallback, useState } from 'react'
import { createRoot } from 'react-dom/client'
import PlanningBackgroundMonitor from '../../src/components/planning/PlanningBackgroundMonitor'
import apiClient from '../../src/services/api.service'

localStorage.removeItem('radai-planning-active-job')
const setup = window.monitorSetup || {}, calls = [], completed = []
let finish = false
apiClient.get = async (url, config = {}) => {
  calls.push({ url, params: config.params })
  if (url.endsWith('/projects/')) return { data: [{ id: Number(config.params.enterprise_project) + 100, enterprise_project: Number(config.params.enterprise_project) }] }
  if (url.endsWith('/intelligence-runs/latest/')) return { data: { id: 51, project: config.params.project, status: 'succeeded' } }
  if (url.endsWith('/jobs/active/')) return { data: setup.active ? { id: 88, project: config.params.project, job_type: 'analyze', status: 'running', api_contract_version: 5 } : null }
  if (url.endsWith('/jobs/88/progress/')) return { data: { id: 88, project: 117, job_type: 'analyze', status: finish ? 'succeeded' : 'running', api_contract_version: 5 } }
  if (url.endsWith('/jobs/88/')) return { data: { id: 88, project: 117, job_type: 'analyze', status: 'succeeded', result_data: { intelligence: { document_intelligence_run_id: 51 } } } }
  throw new Error(`Unexpected background request: ${url}`)
}
function Harness() {
  const [project, setProject] = useState(17), [state, setState] = useState(null)
  const ready = useCallback(job => { completed.push(job) }, [])
  window.backgroundMonitor = { calls, completed, finish: () => { finish = true }, setProject }
  return <main><PlanningBackgroundMonitor key={project} enterpriseProjectId={project} onState={setState} onReady={ready} /><output>{JSON.stringify(state)}</output></main>
}
createRoot(document.getElementById('root')).render(<Harness />)
