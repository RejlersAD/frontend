import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import apiClient from '../../services/api.service'
import PurchaseRequisitionApproval from './PurchaseRequisitionApproval'

const PurchaseRequisitionReviewPage = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const [requisition, setRequisition] = useState(null)
  const [currentUser, setCurrentUser] = useState(null)
  const [error, setError] = useState('')

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
    <PurchaseRequisitionApproval
      isOpen
      requisition={requisition}
      currentUser={currentUser}
      onClose={() => navigate('/approvals')}
      onApprovalComplete={(updated) => setRequisition(updated)}
    />
  )
}

export default PurchaseRequisitionReviewPage
