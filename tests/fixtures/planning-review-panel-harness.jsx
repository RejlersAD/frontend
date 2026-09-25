/* Browser container for the real input review component. All API calls remain
 * handled by planningInputsHarness; this fixture provides project selection only.
 */
import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, useSearchParams } from 'react-router-dom'
import PlanningInputsPanel from '../../src/components/planning/PlanningInputsPanel'
import apiClient from '../../src/services/api.service'
import { PLANNING_ENDPOINTS } from '../../src/config/planningIntelligence.config'
import '../../src/index.css'

const noop = () => {}
const contract = { baseline_locked: false }

function Harness() {
  const [params] = useSearchParams()
  const enterpriseId = params.get('project')
  const [data, setData] = useState(null)
  useEffect(() => {
    let current = true
    setData(null)
    apiClient.get(PLANNING_ENDPOINTS.projects, { params: { enterprise_project: enterpriseId } }).then(async response => {
      const project = (response.data.results || response.data)[0]
      const files = await apiClient.get(PLANNING_ENDPOINTS.files, { params: { project: project.id } })
      if (current) setData({ project, files: files.data.results || files.data })
    })
    return () => { current = false }
  }, [enterpriseId])
  return <main style={{ padding: 16 }}>{data && <PlanningInputsPanel key={enterpriseId}
    project={data.project} enterpriseProject={{ id: Number(enterpriseId) }} contract={contract}
    files={data.files} uploading={false} analyzing={false} uploadCategory="sow"
    onUploadCategory={noop} onUpload={noop} onDeleteFile={noop} onAnalyze={noop}
    onSaved={noop} onBack={noop} onAiSettings={noop} onOpenIntelligencePreview={noop}
  />}</main>
}

createRoot(document.getElementById('performance-test')).render(<BrowserRouter><Harness /></BrowserRouter>)
