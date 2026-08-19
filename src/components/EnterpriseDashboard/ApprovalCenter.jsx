/**
 * ApprovalCenter - Centralized Approval Widget
 * Displays pending approvals across different categories
 * Placeholder-ready for future API integration
 */
import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CheckCircleIcon,
  XCircleIcon,
  EyeIcon,
  ClockIcon,
} from '@heroicons/react/24/outline'
import { APPROVAL_TYPES, PRIORITY_LEVELS, PLACEHOLDER_CONFIG } from '../../config/enterpriseDashboard.config'

const ApprovalCenter = ({ useRealData = false }) => {
  const navigate = useNavigate()
  const [approvals, setApprovals] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchApprovals()
  }, [])

  const fetchApprovals = async () => {
    setLoading(true)
    try {
      if (useRealData) {
        // TODO: Connect to real API when available
        // const response = await fetch('/api/v1/approvals/pending/')
        // const data = await response.json()
        // setApprovals(data.results || [])
        setApprovals(PLACEHOLDER_APPROVALS)
      } else {
        // Use placeholder data
        setApprovals(PLACEHOLDER_APPROVALS)
      }
    } catch (error) {
      console.error('Error fetching approvals:', error)
      setApprovals(PLACEHOLDER_APPROVALS)
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = (id) => {
    // TODO: Implement approval logic
    console.log('Approve:', id)
  }

  const handleReject = (id) => {
    // TODO: Implement rejection logic
    console.log('Reject:', id)
  }

  const handleView = (approval) => {
    // TODO: Navigate to detail page
    console.log('View:', approval)
  }

  const getWaitingTime = (createdAt) => {
    const now = new Date()
    const created = new Date(createdAt)
    const diffHours = Math.floor((now - created) / (1000 * 60 * 60))
    
    if (diffHours < 1) return 'Just now'
    if (diffHours < 24) return `${diffHours}h ago`
    const diffDays = Math.floor(diffHours / 24)
    return `${diffDays}d ago`
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-slate-200 rounded w-1/3" />
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 bg-slate-100 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Approval Center</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {approvals.length} pending approval{approvals.length !== 1 ? 's' : ''}
          </p>
        </div>
        
        {approvals.length > 0 && (
          <span className="px-2.5 py-1 bg-orange-100 text-orange-700 text-xs font-bold rounded-full">
            Action Required
          </span>
        )}
      </div>

      {/* Approvals list */}
      {approvals.length === 0 ? (
        <div className="text-center py-8">
          <div className="w-16 h-16 mx-auto bg-emerald-50 rounded-full flex items-center justify-center mb-3">
            <CheckCircleIcon className="w-8 h-8 text-emerald-600" />
          </div>
          <p className="text-sm font-semibold text-slate-700">All caught up!</p>
          <p className="text-xs text-slate-500 mt-1">No pending approvals</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          {approvals.map((approval) => {
            const approvalType = APPROVAL_TYPES[approval.type] || APPROVAL_TYPES.DOCUMENT
            const priority = PRIORITY_LEVELS[approval.priority] || PRIORITY_LEVELS.MEDIUM

            return (
              <div
                key={approval.id}
                className="border border-slate-200 rounded-xl p-4 hover:border-orange-200 hover:bg-orange-50/30 transition-all group"
              >
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div className="flex-shrink-0 text-2xl">
                    {approvalType.icon}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className="text-sm font-bold text-slate-900 truncate">
                        {approval.title}
                      </h3>
                      <span className={`flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${priority.badge}`}>
                        {priority.label}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-600 mb-2">
                      <span>{approval.department}</span>
                      <span className="text-slate-300">•</span>
                      <span>By {approval.requestedBy}</span>
                      <span className="text-slate-300">•</span>
                      <span className="flex items-center gap-1">
                        <ClockIcon className="w-3 h-3" />
                        {getWaitingTime(approval.createdAt)}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleApprove(approval.id)}
                        className="
                          flex items-center gap-1 px-3 py-1.5 
                          bg-emerald-500 hover:bg-emerald-600 
                          text-white text-xs font-semibold 
                          rounded-lg transition-colors
                        "
                      >
                        <CheckCircleIcon className="w-3.5 h-3.5" />
                        Approve
                      </button>

                      <button
                        onClick={() => handleReject(approval.id)}
                        className="
                          flex items-center gap-1 px-3 py-1.5 
                          bg-red-500 hover:bg-red-600 
                          text-white text-xs font-semibold 
                          rounded-lg transition-colors
                        "
                      >
                        <XCircleIcon className="w-3.5 h-3.5" />
                        Reject
                      </button>

                      <button
                        onClick={() => handleView(approval)}
                        className="
                          flex items-center gap-1 px-3 py-1.5 
                          bg-slate-100 hover:bg-slate-200 
                          text-slate-700 text-xs font-semibold 
                          rounded-lg transition-colors
                        "
                      >
                        <EyeIcon className="w-3.5 h-3.5" />
                        View
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// Placeholder data (will be replaced by API)
const PLACEHOLDER_APPROVALS = [
  {
    id: 1,
    type: 'LEAVE',
    title: 'Annual Leave Request',
    department: 'Engineering',
    requestedBy: 'Ahmed Hassan',
    priority: 'HIGH',
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 2,
    type: 'PAYROLL',
    title: 'Payroll Adjustment',
    department: 'Finance',
    requestedBy: 'Sara Ali',
    priority: 'CRITICAL',
    createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 3,
    type: 'PROCUREMENT',
    title: 'Equipment Purchase Order',
    department: 'Procurement',
    requestedBy: 'Mohammed Ahmed',
    priority: 'MEDIUM',
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 4,
    type: 'EXPENSE',
    title: 'Travel Expense Claim',
    department: 'Sales',
    requestedBy: 'Fatima Khalil',
    priority: 'LOW',
    createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
  },
]

export default ApprovalCenter
