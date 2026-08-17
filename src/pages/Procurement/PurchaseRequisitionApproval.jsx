/**
 * Purchase Requisition Approval Component
 * Dynamic multi-tier approval workflow (PM -> Engineering Manager -> Manager of Projects -> VP Operations)
 * 
 * Features:
 * - Dynamic Approval History mapping over all configured workflow stages
 * - Super Admin & assigned approver permission validation
 * - Soft-coded rejection validation
 * - Digital signature support
 */

import React, { useState, useRef } from 'react';
import apiClient from '../../services/api.service';
import PurchaseRequisitionDocumentPreview from './PurchaseRequisitionDocumentPreview';
import {
  XMarkIcon,
  CheckCircleIcon,
  XCircleIcon,
  DocumentTextIcon,
  ClockIcon,
  UserCircleIcon,
  PencilSquareIcon,
  InformationCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  LockClosedIcon,
  PaperAirplaneIcon,
} from '@heroicons/react/24/outline';

const REJECTION_CONFIG = {
  MIN_REASON_LENGTH: 10,
  MAX_REASON_LENGTH: 1000,
  ERROR_MESSAGES: {
    missing: 'Please provide a reason for rejection.',
    too_short: 'Rejection reason must be at least 10 characters long.',
    too_long: 'Rejection reason cannot exceed 1000 characters.',
    empty: 'Rejection reason cannot be empty or contain only whitespace.',
  }
};

const PurchaseRequisitionApproval = ({ isOpen, onClose, requisition, currentUser, onApprovalComplete }) => {
  const [loading, setLoading] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [currentApproverType, setCurrentApproverType] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectionError, setRejectionError] = useState('');
  const [signature, setSignature] = useState('');
  const [referralTarget, setReferralTarget] = useState('moe');
  const [referralRemarks, setReferralRemarks] = useState('');
  const [referralError, setReferralError] = useState('');

  if (!isOpen || !requisition) return null;

  const normalizedRequisitionStatus = (requisition.status || '').toString().trim().toLowerCase();
  const isDraft = normalizedRequisitionStatus === 'draft';
  const isFullyApproved = normalizedRequisitionStatus === 'approved';
  const isRejected = normalizedRequisitionStatus === 'rejected';
  const isApprovalInProgress = ['submitted', 'in_review'].includes(
    normalizedRequisitionStatus
  );

  const normalizeApprovalStatus = (rawStatus) => {
    const normalized = (rawStatus || '').toString().trim().toLowerCase();
    if (['approved', 'complete', 'completed'].includes(normalized)) return 'approved';
    if (['not_approved', 'rejected', 'declined'].includes(normalized)) return 'not_approved';
    return 'pending';
  };

  // Dynamic Workflow Hierarchy Array
  const approvalHierarchy = Array.isArray(requisition.approval_workflow_config) && requisition.approval_workflow_config.length > 0
    ? requisition.approval_workflow_config
    : Array.isArray(requisition.approval_hierarchy)
      ? requisition.approval_hierarchy
      : [];

  // Active stage determination
  const pendingStages = approvalHierarchy.filter((entry) => {
    const status = (entry?.status || 'pending').toString().trim().toLowerCase();
    return status === 'pending' || status === 'in_review';
  });
  const activeLevel = pendingStages.length
    ? Math.min(...pendingStages.map((entry, index) => Number(entry?.level) || (approvalHierarchy.indexOf(entry) + 1 || index + 1)))
    : null;
  const activeLevelStages = pendingStages.filter((entry) => (Number(entry?.level) || approvalHierarchy.indexOf(entry) + 1) === activeLevel);

  const currentUserData = currentUser?.user || currentUser || {};
  const currentUserId = currentUserData?.id || currentUser?.user_id || currentUser?.id;
  const currentStage = activeLevelStages.find(entry => String(entry?.user_id || entry?.approver_id) === String(currentUserId))
    || activeLevelStages[0]
    || null;

  const currentStageLabel = currentStage?.stage || currentStage?.role || 'the current approver';
  const currentStageRole = `${currentStage?.role || ''} ${currentStage?.stage || ''}`.toLowerCase();
  
  const currentStageKey = currentStageRole.includes('engineering manager') || currentStageRole.includes('manager of engineering') || currentStageRole.includes('moe') || currentStageRole.includes('engineering review')
    ? 'eng_manager'
    : currentStageRole.includes('manager of projects') || currentStageRole.includes('projects manager')
      ? 'manager_projects'
      : currentStageRole.includes('vp operations') || currentStageRole.includes('vice president') || currentStageRole.includes('procurement manager')
        ? 'vp'
        : currentStageRole.includes('level 1 approver') || currentStageRole.includes('project manager') || currentStageRole.includes('department manager') || currentStageRole.includes('technical review')
          ? 'pm'
          : null;

  // Authorization Evaluation
  const issuedByValue = requisition.issued_by?.id || requisition.issued_by_id || requisition.issued_by;
  const isCurrentUserIssuer = Boolean(
    currentUserId && issuedByValue && String(currentUserId) === String(issuedByValue)
  );
  const currentUserRolesRaw = currentUser?.roles || currentUserData?.roles;
  const currentUserRoles = Array.isArray(currentUserRolesRaw) ? currentUserRolesRaw : [];
  
  const isSuperAdmin = currentUserData?.is_superuser === true || currentUserRoles.some(
    (role) => role?.code === 'super_admin' || role?.name === 'Super Administrator'
  );

  const assignedCurrentUserId = currentStage?.user_id || currentStage?.approver_id;
  const isAssignedCurrentApprover = Boolean(
    currentUserId && assignedCurrentUserId && String(currentUserId) === String(assignedCurrentUserId)
  );

  // Employment position is authoritative here. RBAC roles grant module access,
  // but they do not prove that the logged-in user holds the VP Operations post.
  const currentUserJobTitle = (currentUser?.job_title || currentUserData?.job_title || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
  const holdsVpOperationsPosition = [
    'vice president of operations',
    'vice president operations',
    'vp operations',
    'vp of operations',
  ].includes(currentUserJobTitle);

  // VP Operations has no administrator bypass: both assignment and position
  // are required. Other stages retain the existing Super Admin override.
  const canActOnCurrentStage = Boolean(
    currentStage && (
      currentStageKey === 'vp'
        ? isAssignedCurrentApprover && holdsVpOperationsPosition
        : isSuperAdmin || isAssignedCurrentApprover
    )
  );

  const APPROVER_CONFIG = {
    pm: {
      label: activeLevel === 1 ? 'Level 1 Approver' : 'Project Manager',
      approveEndpoint: 'pm_approve',
      rejectEndpoint: 'pm_reject',
      canApprove: isApprovalInProgress && currentStageKey === 'pm' && canActOnCurrentStage
    },
    eng_manager: {
      label: 'Engineering Manager',
      approveEndpoint: 'eng_manager_approve',
      rejectEndpoint: 'eng_manager_reject',
      canApprove: isApprovalInProgress && currentStageKey === 'eng_manager' && canActOnCurrentStage
    },
    manager_projects: {
      label: 'Manager of Projects',
      approveEndpoint: 'manager_projects_approve',
      rejectEndpoint: 'manager_projects_reject',
      canApprove: isApprovalInProgress && currentStageKey === 'manager_projects' && canActOnCurrentStage
    },
    vp: {
      label: 'Vice President of Operations',
      approveEndpoint: 'vp_approve',
      rejectEndpoint: 'vp_reject',
      canApprove: isApprovalInProgress && currentStageKey === 'vp' && canActOnCurrentStage
    }
  };

  const hasAnyApprovalCapability = Object.values(APPROVER_CONFIG).some(config => config.canApprove);

  const handleSubmitForApproval = async () => {
    if (!isDraft || (!isCurrentUserIssuer && !isSuperAdmin)) return;
    setLoading(true);
    try {
      const response = await apiClient.post(`/procurement/requisitions/${requisition.id}/submit/`);
      alert(`PR ${response.data.pr_number || requisition.pr_number} submitted for approval. The assigned Project Manager can now approve or reject it.`);
      onApprovalComplete?.(response.data);
      onClose();
    } catch (error) {
      alert(error.response?.data?.error || error.response?.data?.detail || 'Failed to submit requisition for approval.');
    } finally {
      setLoading(false);
    }
  };

  const validateRejectionReason = (reason) => {
    if (!reason || !reason.trim()) {
      return { valid: false, error: REJECTION_CONFIG.ERROR_MESSAGES.missing };
    }
    const trimmed = reason.trim();
    if (trimmed.length < REJECTION_CONFIG.MIN_REASON_LENGTH) {
      return { valid: false, error: REJECTION_CONFIG.ERROR_MESSAGES.too_short };
    }
    if (trimmed.length > REJECTION_CONFIG.MAX_REASON_LENGTH) {
      return { valid: false, error: REJECTION_CONFIG.ERROR_MESSAGES.too_long };
    }
    return { valid: true, error: null };
  };

  const handleApprove = async (approverType) => {
    const config = APPROVER_CONFIG[approverType];
    if (!config || !config.canApprove) {
      alert(`Action Locked: Awaiting review by ${currentStageLabel}`);
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.post(
        `/procurement/requisitions/${requisition.id}/${config.approveEndpoint}/`,
        { signature: signature || '' }
      );

      alert(`Requisition approved by ${config.label}!`);
      if (onApprovalComplete) onApprovalComplete(response.data);
      onClose();
    } catch (error) {
      console.error('Approval error:', error);
      alert(error.response?.data?.error || error.response?.data?.detail || 'Failed to approve requisition.');
    } finally {
      setLoading(false);
    }
  };

  const handleRejectClick = (approverType) => {
    const config = APPROVER_CONFIG[approverType];
    if (!config?.canApprove) {
      alert(`Action Locked: Awaiting review by ${currentStageLabel}`);
      return;
    }
    setCurrentApproverType(approverType);
    setRejectionReason('');
    setRejectionError('');
    setShowRejectModal(true);
  };

  const handleRejectSubmit = async () => {
    const config = APPROVER_CONFIG[currentApproverType];
    if (!config) return;

    const validation = validateRejectionReason(rejectionReason);
    if (!validation.valid) {
      setRejectionError(validation.error);
      return;
    }

    setLoading(true);
    setRejectionError('');
    
    try {
      const response = await apiClient.post(
        `/procurement/requisitions/${requisition.id}/${config.rejectEndpoint}/`,
        { reason: rejectionReason.trim() }
      );

      alert(`Requisition rejected by ${config.label}`);
      if (onApprovalComplete) onApprovalComplete(response.data);
      onClose();
      setShowRejectModal(false);
    } catch (error) {
      console.error('Rejection error:', error);
      setRejectionError(error.response?.data?.error || error.response?.data?.detail || 'Failed to reject requisition.');
    } finally {
      setLoading(false);
    }
  };

  const handleReferral = async () => {
    if (referralRemarks.trim().length < 10) {
      setReferralError('Add at least 10 characters explaining the discussion required.');
      return;
    }
    setLoading(true);
    setReferralError('');
    try {
      const response = await apiClient.post(
        `/procurement/requisitions/${requisition.id}/refer-rejection/`,
        { target: referralTarget, remarks: referralRemarks.trim() }
      );
      alert(`Rejected PR referred to ${referralTarget === 'moe' ? 'Manager of Engineering' : 'Manager of Projects'} for discussion.`);
      onApprovalComplete?.(response.data);
    } catch (error) {
      setReferralError(error.response?.data?.error || error.response?.data?.remarks || 'Failed to create referral.');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount, currency = 'USD') => {
    if (!amount) return 'N/A';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const getStatusColor = (status) => {
    const normalized = normalizeApprovalStatus(status);
    if (normalized === 'approved') return 'bg-emerald-100 text-emerald-800 border-emerald-300';
    if (normalized === 'not_approved') return 'bg-red-100 text-red-800 border-red-300';
    return 'bg-amber-100 text-amber-800 border-amber-300';
  };

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto p-4">
        <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full my-8">
          
          {/* Modal Header */}
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-8 py-6 rounded-t-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <DocumentTextIcon className="h-8 w-8" />
                <div>
                  <h2 className="text-2xl font-bold">Purchase Requisition Review</h2>
                  <p className="text-indigo-100 text-sm mt-1">
                    PR No: {requisition.pr_number} <span aria-hidden="true">&middot;</span> Status: {requisition.status_display || requisition.status}
                  </p>
                </div>
              </div>
              <button onClick={onClose} className="text-white hover:text-indigo-200 transition-colors">
                <XMarkIcon className="h-7 w-7" />
              </button>
            </div>

            {/* Dynamic Status Header Badges */}
            <div className="mt-4 flex flex-wrap items-center gap-4">
              {approvalHierarchy.map((stage, idx) => (
                <div key={idx} className="flex items-center space-x-2">
                  <span className="text-indigo-100 text-xs font-medium">{stage.role || stage.stage}:</span>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getStatusColor(stage.status)}`}>
                    {normalizeApprovalStatus(stage.status) === 'approved' ? 'Approved' : 
                     normalizeApprovalStatus(stage.status) === 'not_approved' ? 'Rejected' : 'Pending'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Modal Content Body */}
          <div className="p-8 max-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* Left Column - PR Form Information */}
              <div className="lg:col-span-2 space-y-6">
                <PurchaseRequisitionDocumentPreview requisition={requisition} />
                <div className="hidden">
                <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <InformationCircleIcon className="h-5 w-5 mr-2 text-indigo-600" />
                    Header Information
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">Issued By</p>
                      <p className="text-sm font-medium text-gray-900">{requisition.issued_by_name || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Issued Date</p>
                      <p className="text-sm font-medium text-gray-900">{formatDate(requisition.issued_date)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Priority</p>
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                        requisition.priority === 'urgent' ? 'bg-red-100 text-red-800' :
                        requisition.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                        requisition.priority === 'normal' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {requisition.priority_display || requisition.priority}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Requisition Type</p>
                      <p className="text-sm font-medium text-gray-900">{requisition.requisition_type_display || requisition.requisition_type}</p>
                    </div>
                  </div>
                </div>

                {(requisition.supplier_name || (requisition.selected_vendors || []).length > 0) && (
                  <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Vendor Selection</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-500">Selected Supplier</p>
                        <p className="text-sm font-medium text-gray-900">{requisition.supplier_name || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Business ID</p>
                        <p className="text-sm font-medium text-gray-900">{requisition.supplier_business_id || 'N/A'}</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Product/Service Details</h3>
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Product/Service</p>
                      <p className="text-sm text-gray-900 whitespace-pre-wrap">{requisition.product_service}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Project/Department</p>
                      <p className="text-sm text-gray-900 whitespace-pre-wrap">{requisition.project_department}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Purchase Description</p>
                      <p className="text-sm text-gray-900 whitespace-pre-wrap">{requisition.description_reason}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg p-6 border border-indigo-200">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Pricing Details</h3>
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Purchase Description</p>
                      <p className="text-sm text-gray-900 whitespace-pre-wrap">{requisition.price_description}</p>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm text-gray-500">Currency</p>
                        <p className="text-lg font-bold text-indigo-600">{requisition.currency}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Total Price</p>
                        <p className="text-lg font-bold text-indigo-600">{formatCurrency(requisition.total_price, requisition.currency)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Net Total (excl VAT)</p>
                        <p className="text-lg font-bold text-indigo-600">{formatCurrency(requisition.net_total_excl_vat, requisition.currency)}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-gray-200 bg-white p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Reference & Recommendation</h3>
                  <div className="space-y-4 text-sm">
                    <div>
                      <p className="text-gray-500">PO Applicable</p>
                      <p className="font-medium text-gray-900">{requisition.po_applicable ? 'Yes' : 'No'}</p>
                      {requisition.po_applicable && requisition.po_number_reference && (
                        requisition.linked_po_id
                          ? <a href={`/procurement/orders/${requisition.linked_po_id}`} target="_blank" rel="noreferrer" className="font-semibold text-indigo-600 hover:underline">{requisition.po_number_reference} ┬╖ View completed PO</a>
                          : <p className="font-semibold text-gray-900">{requisition.po_number_reference}</p>
                      )}
                    </div>
                    <div>
                      <p className="text-gray-500">Purchase Recommendation</p>
                      <p className="whitespace-pre-wrap text-gray-900">{requisition.purchase_recommendation || '—'}</p>
                    </div>
                    {requisition.requires_management_approval && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                        <p className="font-semibold text-amber-900">Management Approval: {requisition.management_approval ? 'Yes' : 'No'}</p>
                        <p className="mt-1 text-amber-800">{requisition.management_approval_remarks || 'No remarks'}</p>
                        <p className="mt-1 text-xs text-amber-700">Evidence: {(requisition.management_approval_evidence || []).length ? 'Attached' : 'Missing'}</p>
                      </div>
                    )}
                  </div>
                </div>
                </div>
              </div>
              {/* Right Column - Dynamic Approval History & Action Controls */}
              <div className="space-y-6">
                
                {/* Dynamic Approval History List */}
                <div className="bg-white rounded-lg border-2 border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <ClockIcon className="h-5 w-5 mr-2 text-indigo-600" />
                    Approval History
                  </h3>

                  <div className="space-y-4">
                    {approvalHierarchy.length > 0 ? (
                      approvalHierarchy.map((stage, index) => {
                        const statusNormalized = normalizeApprovalStatus(stage.status);
                        return (
                          <div key={index} className="pb-3 border-b border-gray-100 last:border-0 last:pb-0">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-semibold text-gray-800">
                                {stage.role || stage.stage || `Stage ${index + 1}`}
                              </span>
                              <span className={`px-2.5 py-0.5 rounded text-xs font-semibold border ${getStatusColor(stage.status)}`}>
                                {statusNormalized === 'approved' ? 'Approved' : 
                                 statusNormalized === 'not_approved' ? 'Rejected' : 'Pending'}
                              </span>
                            </div>
                            {stage.user_name && (
                              <div className="flex items-center space-x-1.5 text-xs text-gray-600 mt-1">
                                <UserCircleIcon className="h-4 w-4 text-gray-400" />
                                <span>{stage.user_name}</span>
                              </div>
                            )}
                            {stage.approved_at && (
                              <p className="text-xs text-gray-500 mt-0.5">
                                {formatDate(stage.approved_at)} at {new Date(stage.approved_at).toLocaleTimeString()}
                              </p>
                            )}
                            {stage.rejected_at && (
                              <p className="text-xs text-red-500 mt-0.5">
                                Rejected on {formatDate(stage.rejected_at)}
                              </p>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-xs text-gray-500">No workflow steps found.</p>
                    )}
                  </div>

                  {isRejected && requisition.rejection_reason && (
                    <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-sm font-medium text-red-800 mb-1">Rejection Reason:</p>
                      <p className="text-sm text-red-700">{requisition.rejection_reason}</p>
                    </div>
                  )}
                  {isRejected && (isCurrentUserIssuer || isSuperAdmin) && (
                    <div className="mt-4 rounded-lg border border-indigo-200 bg-indigo-50 p-4">
                      <p className="text-sm font-semibold text-indigo-900">Discussion / Resolution Referral</p>
                      {requisition.resolution_referral?.status === 'open' ? (
                        <div className="mt-2 text-xs text-indigo-800">
                          Referred to {requisition.resolution_referral.target_label}: {requisition.resolution_referral.remarks}
                        </div>
                      ) : (
                        <div className="mt-3 space-y-3">
                          <select value={referralTarget} onChange={event => setReferralTarget(event.target.value)} className="w-full rounded-lg border border-indigo-300 bg-white px-3 py-2 text-sm">
                            <option value="moe">Manager of Engineering (MoE)</option>
                            <option value="mop">Manager of Projects (MoP)</option>
                          </select>
                          <textarea value={referralRemarks} onChange={event => { setReferralRemarks(event.target.value); setReferralError(''); }} rows={3} className="w-full rounded-lg border border-indigo-300 px-3 py-2 text-sm" placeholder="Explain the discussion or resolution required..." />
                          {referralError && <p className="text-xs text-red-600">{referralError}</p>}
                          <button type="button" onClick={handleReferral} disabled={loading} className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">Send for Discussion</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Interactive Action Controls */}
                {isDraft && currentStage && (
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-5 shadow-sm">
                    <div className="flex items-start gap-3">
                      <InformationCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
                      <div className="flex-1">
                        <h3 className="text-sm font-bold text-blue-900">Approval has not started</h3>
                        <p className="mt-1 text-xs leading-relaxed text-blue-800">
                          {currentStage.user_name || currentStageLabel} is assigned and pending, but this requisition is still a draft. Approve and Reject become available only after submission.
                        </p>
                        {(isCurrentUserIssuer || isSuperAdmin) ? (
                          <button type="button" onClick={handleSubmitForApproval} disabled={loading} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
                            <PaperAirplaneIcon className="h-4 w-4" />
                            {loading ? 'Submitting...' : 'Submit for Approval'}
                          </button>
                        ) : (
                          <p className="mt-3 text-xs font-semibold text-blue-900">The requisition issuer must submit this draft.</p>
                        )}
                      </div>
                    </div>
                    {(requisition.selected_vendors || []).length > 0 && (
                      <div className="mt-4 overflow-hidden rounded-lg border border-gray-200 bg-white">
                        {(requisition.selected_vendors || []).map(vendor => (
                          <div key={vendor.vendor_id} className="flex justify-between gap-4 border-b border-gray-100 px-3 py-2 text-xs last:border-0">
                            <span className="font-medium text-gray-800">{vendor.name}</span>
                            <span className="text-gray-500">ICV {vendor.icv_percentage ?? 'N/A'}% ┬╖ {vendor.icv_expiry_date ? `valid to ${vendor.icv_expiry_date}` : 'validity not recorded'}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {(requisition.selected_vendors || []).length === 1 && requisition.single_source_justification && (
                      <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                        <p className="text-xs font-semibold text-amber-900">Single Source Justification</p>
                        <p className="mt-1 text-xs text-amber-800">{requisition.single_source_justification}</p>
                      </div>
                    )}
                  </div>
                )}

                {hasAnyApprovalCapability && (
                  <div className="bg-white rounded-lg border-2 border-indigo-200 p-6 shadow-sm">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <PencilSquareIcon className="h-5 w-5 mr-2 text-indigo-600" />
                      Your Action Required
                    </h3>

                    <div className="mb-4">
                      <label className="block text-xs font-medium text-gray-700 mb-2">
                        Digital Signature (Optional)
                      </label>
                      <input
                        type="text"
                        value={signature}
                        onChange={(e) => setSignature(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        placeholder="Enter your name or signature"
                      />
                    </div>

                    <div className="space-y-3">
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        {currentStageLabel} Review
                      </h4>

                      {Object.keys(APPROVER_CONFIG).map((key) => {
                        const config = APPROVER_CONFIG[key];
                        if (!config.canApprove) return null;

                        return (
                          <div key={key} className="flex gap-2">
                            <button
                              onClick={() => handleApprove(key)}
                              disabled={loading}
                              className="flex-1 flex items-center justify-center space-x-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-all font-semibold text-sm disabled:opacity-50"
                            >
                              <CheckCircleIcon className="h-5 w-5" />
                              <span>Approve</span>
                            </button>
                            <button
                              onClick={() => handleRejectClick(key)}
                              disabled={loading}
                              className="flex-1 flex items-center justify-center space-x-2 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all font-semibold text-sm disabled:opacity-50"
                            >
                              <XCircleIcon className="h-5 w-5" />
                              <span>Reject</span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Locked Action Banner */}
                {currentStage && isApprovalInProgress && !hasAnyApprovalCapability && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 shadow-sm">
                    <div className="flex items-start space-x-3">
                      <LockClosedIcon className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <h3 className="font-bold text-sm text-amber-900">
                          Action Locked: Awaiting review by {currentStageLabel}
                        </h3>
                        <p className="mt-1 text-xs text-amber-800 leading-relaxed">
                          {currentStageKey === 'vp'
                            ? 'Only the assigned user with the Vice President of Operations job title can approve or reject this requisition.'
                            : 'Only the approver assigned to this stage can approve or reject this requisition.'}
                        </p>
                        {currentStage?.user_name && (
                          <p className="mt-2 text-xs font-semibold text-amber-900">
                            Assigned approver: {currentStage.user_name}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="bg-gray-50 px-8 py-4 rounded-b-xl border-t border-gray-200 flex items-center justify-between">
            <p className="text-xs text-gray-500">
              Form Reference: {requisition.form_reference || 'RAD-OM-PRC-0001'}
            </p>
            <button
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors text-sm font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Mandatory Rejection Reason Modal */}
      {showRejectModal && currentApproverType && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden">
            <div className="bg-gradient-to-r from-red-600 to-red-700 text-white px-6 py-4">
              <div className="flex items-center space-x-3">
                <ExclamationTriangleIcon className="h-6 w-6" />
                <h3 className="text-xl font-bold">Reject Purchase Requisition</h3>
              </div>
            </div>

            <div className="p-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Rejection Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => {
                  setRejectionReason(e.target.value);
                  setRejectionError('');
                }}
                rows={4}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 focus:outline-none text-sm ${
                  rejectionError ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Enter a detailed reason for rejecting this purchase requisition..."
              />
              
              <div className="flex justify-between items-center mt-2 text-xs">
                <p className={rejectionReason.trim().length < REJECTION_CONFIG.MIN_REASON_LENGTH ? 'text-red-500' : 'text-emerald-600'}>
                  {rejectionReason.trim().length} / {REJECTION_CONFIG.MIN_REASON_LENGTH} chars minimum
                </p>
              </div>

              {rejectionError && (
                <p className="mt-2 text-xs text-red-600 flex items-center gap-1">
                  <ExclamationTriangleIcon className="h-4 w-4" />
                  <span>{rejectionError}</span>
                </p>
              )}

              <div className="flex space-x-3 mt-6">
                <button
                  onClick={() => setShowRejectModal(false)}
                  disabled={loading}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRejectSubmit}
                  disabled={loading || rejectionReason.trim().length < REJECTION_CONFIG.MIN_REASON_LENGTH}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium disabled:opacity-50"
                >
                  {loading ? 'Rejecting...' : 'Confirm Rejection'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PurchaseRequisitionApproval;
