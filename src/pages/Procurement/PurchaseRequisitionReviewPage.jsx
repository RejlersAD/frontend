import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import apiClient from '../../services/api.service'
import PurchaseRequisitionApproval from './PurchaseRequisitionApproval'

const PurchaseRequisitionReviewPage = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [requisition, setRequisition] = useState(null)
  const [currentUser, setCurrentUser] = useState(null)
  const [error, setError] = useState('')
  const [sourceRefreshError, setSourceRefreshError] = useState('')
  const sourceRefresh = useRef(null)
  const sourceRefreshContext = useRef(null)

  useEffect(() => {
    sourceRefreshContext.current = id
    setSourceRefreshError('')
    return () => {
      sourceRefreshContext.current = null
      sourceRefresh.current?.abort()
    }
  }, [id])

  const refreshSource = useCallback(async () => {
    if (sourceRefreshContext.current !== id) return
    sourceRefresh.current?.abort()
    const controller = new AbortController()
    sourceRefresh.current = controller
    setSourceRefreshError('')
    try {
      const { data } = await apiClient.get(`/procurement/requisitions/${id}/`, {
        params: { _fresh: Date.now() }, signal: controller.signal, suppressErrorToast: true,
      })
      if (controller.signal.aborted || sourceRefreshContext.current !== id) return
      if (String(data?.id) !== String(id)) throw new Error('The refreshed record did not match.')
      setRequisition(current => String(current?.id) === String(id) ? data : current)
    } catch {
      if (!controller.signal.aborted && sourceRefreshContext.current === id) setSourceRefreshError('The documents were saved, but the approval details could not be refreshed.')
    }
  }, [id])

  const load = useCallback(async () => {
    try {
      setError('')
      const [requestResponse, userResponse] = await Promise.all([
        apiClient.get(`/procurement/requisitions/${id}/`, { params: { _fresh: Date.now() } }),
        apiClient.get('/rbac/users/me/'),
      ])
      setRequisition(requestResponse.data)
      setCurrentUser(userResponse.data)
    } catch (loadError) {
      setError(loadError.response?.data?.detail || 'The Purchase Requisition could not be loaded.')
    }
  }, [id])

  useEffect(() => { load() }, [load])

  if (error) return <div className="grid min-h-[65vh] place-items-center p-6"><div className="max-w-md rounded-2xl border border-rose-200 bg-white p-6 text-center shadow-sm"><h1 className="font-bold text-rose-800">Could not open approval request</h1><p className="mt-2 text-sm text-slate-600">{error}</p><button type="button" onClick={() => navigate('/approvals')} className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white">Back to Approval Center</button></div></div>
  if (!requisition || !currentUser) return <div className="grid min-h-[65vh] place-items-center"><div className="text-center"><div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600" /><p className="mt-3 text-sm text-slate-600">Loading approval request...</p></div></div>

  return (
    <>
    {sourceRefreshError && <div role="alert" className="mx-4 mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
      {sourceRefreshError} <button type="button" onClick={refreshSource} className="font-semibold underline">Retry approval details</button>
    </div>}
    <PurchaseRequisitionApproval
      isOpen
      pageMode
      requisition={requisition}
      currentUser={currentUser}
      onClose={() => navigate(location.state?.from || '/procurement/requisitions')}
      onApprovalComplete={(updated) => setRequisition(updated)}
      onSourceUploaded={refreshSource}
    />
    </>
  )
}

export default PurchaseRequisitionReviewPage
