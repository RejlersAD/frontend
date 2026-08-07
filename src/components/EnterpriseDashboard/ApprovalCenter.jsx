/**
 * ApprovalCenter - Centralized Enterprise Approval Widget
 * 
 * Features:
 * - Tabbed navigation (Leave, Payroll, Procurement Requests, Invoice)
 * - Real API integration for Procurement Requests
 * - Strict VP Position & Assigned Approver validation rules (prevents non-VP users from taking action)
 * - Integrated review modal with digital signature support
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircleIcon,
  XCircleIcon,
  EyeIcon,
  ClockIcon,
  ArrowPathIcon,
  LockClosedIcon,
} from '@heroicons/react/24/outline';
import apiClient from '../../services/api.service';
import PurchaseRequisitionApproval from '../Procurement/PurchaseRequisitionApproval';

const ApprovalCenter = ({ currentUser }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('procurement'); // Default to Procurement Requests
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modal State for Full PR Review
  const [selectedPR, setSelectedPR] = useState(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);

  useEffect(() => {
    if (activeTab === 'procurement') {
      fetchPendingProcurementApprovals();
    } else {
      // Placeholder data for other tabs
      setLoading(false);
    }
  }, [activeTab]);

  // User Profile & Position Helper Checks
  const currentUserData = currentUser?.user || currentUser || {};
  const currentUserId = currentUserData?.id || currentUser?.user_id || currentUser?.id;
  const currentUserRolesRaw = currentUser?.roles || currentUserData?.roles;
  const currentUserRoles = Array.isArray(currentUserRolesRaw) ? currentUserRolesRaw : [];

  const isSuperAdmin = currentUserData?.is_superuser === true || currentUserRoles.some(
    (role) => role?.code === 'super_admin' || role?.name === 'Super Administrator'
  );

  // 🔒 STRICT VP POSITION CHECK
  const jobTitle = (currentUserData?.job_title || currentUser?.job_title || '').toString().toLowerCase().trim();
  const primaryRole = (currentUserData?.primary_role?.name || currentUser?.primary_role?.name || '').toString().toLowerCase().trim();

  const holdsVpOperationsPosition = Boolean(
    ((jobTitle.includes('vice president') || jobTitle.includes('vp')) && jobTitle.includes('operation')) ||
    ((primaryRole.includes('vice president') || primaryRole.includes('vp')) && primaryRole.includes('operation')) ||
    currentUserRoles.some((r) => {
      const roleName = (r?.name || r?.code || '').toString().toLowerCase();
      return (roleName.includes('vp') || roleName.includes('vice president')) && roleName.includes('operation');
    })
  );

  const fetchPendingProcurementApprovals = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/procurement/requisitions/pending-for-me/', {
        params: { page_size: 50 }
      });
      const results = response.data.results || response.data || [];
      setApprovals(Array.isArray(results) ? results : []);
    } catch (error) {
      console.error('Error fetching pending procurement approvals:', error);
      setApprovals([]);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenReview = (pr) => {
    setSelectedPR(pr);
    setIsReviewModalOpen(true);
  };

  const handleApprovalComplete = (updatedPR) => {
    setApprovals((prev) => prev.filter((item) => item.id !== updatedPR.id));
    setIsReviewModalOpen(false);
    setSelectedPR(null);
  };

  const handleQuickApprove = async (pr, currentStageKey) => {
    try {
      const endpointMap = {
        pm: 'pm_approve',
        eng_manager: 'eng_manager_approve',
        manager_projects: 'manager_projects_approve',
        vp: 'vp_approve',
      };
      
      const endpoint = endpointMap[currentStageKey] || 'pm_approve';
      const response = await apiClient.post(`/procurement/requisitions/${pr.id}/${endpoint}/`, { signature: '' });
      alert(`PR ${pr.pr_number} successfully Approved!`);
      handleApprovalComplete(response.data || { id: pr.id });
    } catch (error) {
      console.error('Quick approve error:', error);
      alert(error.response?.data?.error || error.response?.data?.detail || 'Failed to approve requisition.');
    }
  };

  const handleQuickReject = (pr) => {
    // Open full review modal to enforce mandatory rejection reason requirement
    handleOpenReview(pr);
  };

  // Helper to compute progress percentage for display
  const getProgressPercentage = (pr) => {
    const workflow = pr.approval_workflow_config || [];
    if (!workflow.length) return 0;
    const approvedCount = workflow.filter(s => (s.status || '').toLowerCase() === 'approved').length;
    return Math.round((approvedCount / workflow.length) * 100);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-slate-200 rounded w-1/4" />
          <div className="h-10 bg-slate-100 rounded-xl" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 bg-slate-50 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
        
        {/* Widget Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="h-5 w-5 rounded-full border-2 border-orange-500 flex items-center justify-center">
              <CheckCircleIcon className="h-4 w-4 text-orange-500" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Approval Center</h2>
          </div>
          
          <button
            onClick={fetchPendingProcurementApprovals}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
            title="Refresh List"
          >
            <ArrowPathIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Category Navigation Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-100">
          <button
            onClick={() => setActiveTab('leave')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
              activeTab === 'leave' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Leave Requests
          </button>

          <button
            onClick={() => setActiveTab('payroll')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
              activeTab === 'payroll' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Payroll Approval
          </button>

          <button
            onClick={() => setActiveTab('procurement')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
              activeTab === 'procurement' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Procurement Requests
            {approvals.length > 0 && (
              <span className="ml-2 px-1.5 py-0.5 text-[10px] bg-indigo-500 text-white rounded-full">
                {approvals.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('invoice')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
              activeTab === 'invoice' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Invoice Approval
          </button>
        </div>

        {/* Tab Content Body */}
        {activeTab === 'procurement' ? (
          <div className="space-y-4">
            {approvals.length === 0 ? (
              <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <CheckCircleIcon className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-700">All caught up!</p>
                <p className="text-xs text-slate-500 mt-0.5">No pending procurement requests.</p>
              </div>
            ) : (
              approvals.map((pr) => {
                // Find Active Stage
                const activeStage = pr.approval_workflow_config?.find(
                  (stage) => ['pending', 'in_review'].includes((stage.status || 'pending').toLowerCase())
                );

                const stageRole = `${activeStage?.role || ''} ${activeStage?.stage || ''}`.toLowerCase();
                
                // Detect if active stage requires Vice President of Operations
                const isVpStage = stageRole.includes('vp operations') || 
                                  stageRole.includes('vice president of operations') || 
                                  stageRole.includes('vice president') || 
                                  stageRole.includes('procurement manager');

                const currentStageKey = stageRole.includes('engineering manager') ? 'eng_manager'
                  : stageRole.includes('manager of projects') ? 'manager_projects'
                  : isVpStage ? 'vp' : 'pm';

                const assignedUserId = activeStage?.user_id || activeStage?.approver_id;
                const isAssignedApprover = Boolean(
                  currentUserId && assignedUserId && String(currentUserId) === String(assignedUserId)
                );

                // 🔒 STRICT PERMISSION GATE: If VP Stage, user MUST hold VP position AND be assigned (or Super Admin)
                const canPerformAction = isVpStage
                  ? Boolean(isSuperAdmin || (isAssignedApprover && holdsVpOperationsPosition))
                  : Boolean(isSuperAdmin || isAssignedApprover);

                return (
                  <div
                    key={pr.id}
                    className="border border-slate-200 rounded-xl p-5 hover:border-indigo-200 hover:shadow-sm transition-all bg-white"
                  >
                    <div className="flex items-start justify-between gap-4">
                      {/* Left Metadata */}
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-slate-900">
                            PR Number: {pr.pr_number}
                          </span>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded uppercase ${
                            (pr.priority || '').toLowerCase() === 'urgent' ? 'bg-red-100 text-red-700' :
                            (pr.priority || '').toLowerCase() === 'high' ? 'bg-orange-100 text-orange-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                            Priority: {pr.priority || 'Normal'}
                          </span>
                        </div>

                        <p className="text-xs text-slate-700 font-medium line-clamp-1">
                          Title: {pr.product_service || pr.price_description || 'N/A'}
                        </p>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-slate-500 pt-1">
                          <div>
                            <span className="text-slate-400">Requester: </span>
                            <span className="font-semibold text-slate-700">{pr.issued_by_name || 'Requester'}</span>
                          </div>
                          <div>
                            <span className="text-slate-400">Amount: </span>
                            <span className="font-semibold text-emerald-600">
                              {pr.currency || 'USD'} {Number(pr.total_price || 0).toLocaleString()}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400">Progress: </span>
                            <span className="font-semibold text-indigo-600">{getProgressPercentage(pr)}%</span>
                          </div>
                          <div>
                            <span className="text-slate-400">Active Stage: </span>
                            <span className="font-semibold text-amber-700">{activeStage?.role || activeStage?.stage || 'Review'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Right Action Control Buttons */}
                      <div className="flex items-center gap-2 flex-shrink-0 self-center">
                        {canPerformAction ? (
                          /* ✅ Authorized Approver Controls */
                          <>
                            <button
                              onClick={() => handleQuickApprove(pr, currentStageKey)}
                              className="p-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors shadow-sm"
                              title="Approve Requisition"
                            >
                              <CheckCircleIcon className="w-5 h-5" />
                            </button>

                            <button
                              onClick={() => handleQuickReject(pr)}
                              className="p-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors shadow-sm"
                              title="Reject Requisition"
                            >
                              <XCircleIcon className="w-5 h-5" />
                            </button>
                          </>
                        ) : (
                          /* 🔒 Non-VP / Unauthorized User Locked Indicator */
                          <div 
                            className="flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1.5 rounded-lg"
                            title="You do not hold the required VP Operations position or assignment to perform actions on this stage."
                          >
                            <LockClosedIcon className="w-3.5 h-3.5 text-amber-600" />
                            <span>Action Locked</span>
                          </div>
                        )}

                        {/* View Details Button (Always Accessible) */}
                        <button
                          onClick={() => handleOpenReview(pr)}
                          className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-sm"
                          title="View Details & Sign"
                        >
                          <EyeIcon className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ) : (
          /* Placeholder Tab Content for non-procurement options */
          <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200">
            <ClockIcon className="w-10 h-10 text-slate-400 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700">No pending approvals</p>
            <p className="text-xs text-slate-500 mt-0.5">There are no active requests in this queue.</p>
          </div>
        )}
      </div>

      {/* Full Modal Review Handler */}
      {isReviewModalOpen && selectedPR && (
        <PurchaseRequisitionApproval
          isOpen={isReviewModalOpen}
          onClose={() => setIsReviewModalOpen(false)}
          requisition={selectedPR}
          currentUser={currentUser}
          onApprovalComplete={handleApprovalComplete}
        />
      )}
    </>
  );
};

export default ApprovalCenter;