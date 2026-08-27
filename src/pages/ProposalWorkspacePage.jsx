/* eslint-disable react/prop-types */
import { useEffect, useState } from 'react'
import { ArrowLeft, FileText, Loader2 } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'

import FinalProposalStudio from '../components/planning/FinalProposalStudio'
import planningIntelligenceService from '../services/planningIntelligence.service'

const ProposalWorkspacePage = () => {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const [project, setProject] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    planningIntelligenceService.getProject(projectId)
      .then(data => { if (active) setProject(data) })
      .catch(error => {
        if (active) setNotice({
          type: 'error',
          message: error?.response?.data?.detail || error?.message || 'Unable to load the proposal workspace.',
        })
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [projectId])

  if (loading) return (
    <div className="flex min-h-[70vh] items-center justify-center text-slate-500">
      <Loader2 className="mr-2 h-6 w-6 animate-spin" /> Loading Enterprise Technical Proposal Studio...
    </div>
  )

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-100 via-white to-blue-50 px-2 py-4 sm:px-3 lg:px-4">
      <div className="w-full min-w-0">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/planning-packages')} className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-50" title="Back to planning packages"><ArrowLeft className="h-5 w-5" /></button>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-700 text-white"><FileText className="h-6 w-6" /></div>
            <div><h1 className="text-xl font-bold text-slate-900">Enterprise Technical Proposal Studio</h1><p className="text-sm text-slate-500">{project?.name || 'Planning project'} · controlled bid workspace</p></div>
          </div>
          <div className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700">Full Workspace</div>
        </div>

        {notice && <div className={`mb-4 rounded-xl border px-4 py-3 text-sm ${notice.type === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>{notice.message}</div>}
        {project && <FinalProposalStudio projectId={Number(projectId)} project={project} onNotice={(type, message) => setNotice({ type, message })} />}
      </div>
    </div>
  )
}

export default ProposalWorkspacePage
