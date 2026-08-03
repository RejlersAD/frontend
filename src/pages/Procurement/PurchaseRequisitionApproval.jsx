/**
 * Purchase Requisition Approval Component
 * Multi-tier approval workflow: PM → Engineering Manager → Manager of Projects → VP Operations
 * 
 * Features:
 * - View full PR details
 * - Approve/Reject with mandatory reason (soft-coded validation)
 * - Digital signature (optional)
 * - Approval history tracking
 * - Status indicators for all approval tiers
 * - Dynamic approver type detection
 */

import React, { useState, useRef } from 'react';
import apiClient from '../../services/api.service';
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
} from '@heroicons/react/24/outline';

// Soft-coded rejection validation configuration
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
  const [currentApproverType, setCurrentApproverType] = useState(null); // 'pm', 'vp', 'eng_manager', 'manager_projects'
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectionError, setRejectionError] = useState('');
  const [signature, setSignature] = useState('');
  const signatureRef = useRef(null);

  if (!isOpen || !requisition) return null;

  // Soft-coded approver capability detection
  // Maps approval tier to status check and endpoint configuration
  const APPROVER_CONFIG = {
    pm: {
      label: 'Project Manager',
      approveEndpoint: 'pm_approve',
      rejectEndpoint: 'pm_reject',
      statusField: 'pm_approval_status',
      canApprove: requisition.status === 'submitted' && requisition.pm_approval_status === 'pending'
    },
    eng_manager: {
      label: 'Engineering Manager',
      approveEndpoint: 'eng_manager_approve',
      rejectEndpoint: 'eng_manager_reject',
      statusField: 'eng_manager_approval_status',
      canApprove: requisition.eng_manager_approval_status === 'pending'
    },
    manager_projects: {
      label: 'Manager of Projects',
      approveEndpoint: 'manager_projects_approve',
      rejectEndpoint: 'manager_projects_reject',
      statusField: 'manager_projects_approval_status',
      canApprove: requisition.manager_projects_approval_status === 'pending'
    },
    vp: {
      label: 'Vice President of Operations',
      approveEndpoint: 'vp_approve',
      rejectEndpoint: 'vp_reject',
      statusField: 'vp_op_approval_status',
      canApprove: requisition.pm_approval_status === 'approved' && requisition.vp_op_approval_status === 'pending'
    }
  };

  const isFullyApproved = requisition.status === 'fully_approved' || requisition.status === 'approved';
  const isRejected = requisition.status === 'rejected';

  // Soft-coded: Check if current user can perform any approval action
  const hasAnyApprovalCapability = Object.values(APPROVER_CONFIG).some(config => config.canApprove);

  // Soft-coded validation function for rejection reason (frontend)
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
    if (!config) {
      alert('Invalid approver type');
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.post(
        `/procurement/requisitions/${requisition.id}/${config.approveEndpoint}/`,
        { signature: signature || '' }
      );

      alert(`Requisition approved by ${config.label}!`);
      
      if (onApprovalComplete) {
        onApprovalComplete(response.data);
      }
      onClose();
    } catch (error) {
      console.error('Approval error:', error);
      alert(error.response?.data?.error || 'Failed to approve requisition. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRejectClick = (approverType) => {
    setCurrentApproverType(approverType);
    setRejectionReason('');
    setRejectionError('');
    setShowRejectModal(true);
  };

  const handleRejectSubmit = async () => {
    const config = APPROVER_CONFIG[currentApproverType];
    if (!config) {
      alert('Invalid approver type');
      return;
    }

    // Validate rejection reason (soft-coded validation)
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
      
      if (onApprovalComplete) {
        onApprovalComplete(response.data);
      }
      onClose();
      setShowRejectModal(false);
    } catch (error) {
      console.error('Rejection error:', error);
      const errorMsg = error.response?.data?.error || 'Failed to reject requisition. Please try again.';
      setRejectionError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleRejectCancel = () => {
    setShowRejectModal(false);
    setRejectionReason('');
    setRejectionError('');
    setCurrentApproverType(null);
  };

  const formatCurrency = (amount, currency = 'USD') => {
    if (!amount) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      approved: 'bg-green-100 text-green-800 border-green-300',
      not_approved: 'bg-red-100 text-red-800 border-red-300',
    };
    return colors[status] || 'bg-gray-100 text-gray-800 border-gray-300';
  };

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto p-4">
        <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full my-8">
          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-8 py-6 rounded-t-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <DocumentTextIcon className="h-8 w-8" />
                <div>
                  <h2 className="text-2xl font-bold">Purchase Requisition Review</h2>
                  <p className="text-indigo-100 text-sm mt-1">
                    PR No: {requisition.pr_number} • Status: {requisition.status_display}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-white hover:text-indigo-200 transition-colors"
              >
                <XMarkIcon className="h-7 w-7" />
              </button>
            </div>

            {/* Status Banner */}
            <div className="mt-4 flex items-center space-x-4">
              {/* PM Approval Status */}
              <div className="flex items-center space-x-2">
                <span className="text-indigo-100 text-sm">PM Approval:</span>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(requisition.pm_approval_status)}`}>
                  {requisition.pm_approval_status === 'pending' ? 'Pending' : 
                   requisition.pm_approval_status === 'approved' ? 'Approved' : 'Rejected'}
                </span>
              </div>

              {/* VP Approval Status */}
              <div className="flex items-center space-x-2">
                <span className="text-indigo-100 text-sm">VP Approval:</span>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(requisition.vp_op_approval_status)}`}>
                  {requisition.vp_op_approval_status === 'pending' ? 'Pending' : 
                   requisition.vp_op_approval_status === 'approved' ? 'Approved' : 'Rejected'}
                </span>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-8 max-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left Column - PR Details */}
              <div className="lg:col-span-2 space-y-6">
                {/* Header Information */}
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
                        requisition.priority === 'normal' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {requisition.priority_display}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Requisition Type</p>
                      <p className="text-sm font-medium text-gray-900">{requisition.requisition_type_display}</p>
                    </div>
                  </div>
                </div>

                {/* Supplier Information */}
                {(requisition.supplier_name || requisition.supplier_business_id) && (
                  <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Supplier Information</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-500">Supplier Name</p>
                        <p className="text-sm font-medium text-gray-900">{requisition.supplier_name || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Business ID</p>
                        <p className="text-sm font-medium text-gray-900">{requisition.supplier_business_id || 'N/A'}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Product/Service */}
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
                      <p className="text-sm text-gray-500 mb-1">Description and Reason</p>
                      <p className="text-sm text-gray-900 whitespace-pre-wrap">{requisition.description_reason}</p>
                    </div>
                  </div>
                </div>

                {/* Pricing Details */}
                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg p-6 border border-indigo-200">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Pricing Details</h3>
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Price Description</p>
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
                    {requisition.price_remarks && (
                      <div>
                        <p className="text-sm text-gray-500 mb-1">Remarks</p>
                        <p className="text-sm text-gray-900 italic">{requisition.price_remarks}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Additional Information */}
                {(requisition.preferred_supplier_if_any || requisition.special_notes || requisition.po_number_reference) && (
                  <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Additional Information</h3>
                    <div className="space-y-4">
                      {requisition.preferred_supplier_if_any && (
                        <div>
                          <p className="text-sm text-gray-500 mb-1">Preferred Supplier</p>
                          <p className="text-sm text-gray-900">{requisition.preferred_supplier_if_any}</p>
                        </div>
                      )}
                      {requisition.po_number_reference && (
                        <div>
                          <p className="text-sm text-gray-500 mb-1">Related PO Number</p>
                          <p className="text-sm font-mono text-gray-900">{requisition.po_number_reference}</p>
                        </div>
                      )}
                      {requisition.special_notes && (
                        <div>
                          <p className="text-sm text-gray-500 mb-1">Special Notes</p>
                          <p className="text-sm text-gray-900 whitespace-pre-wrap">{requisition.special_notes}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Attachments */}
                {requisition.attachments && requisition.attachments.length > 0 && (
                  <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Attachments ({requisition.attachments.length})</h3>
                    <div className="space-y-2">
                      {requisition.attachments.map((attachment, index) => (
                        <a
                          key={index}
                          href={attachment.s3_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200 hover:border-indigo-300 hover:shadow-sm transition-all"
                        >
                          <div className="flex items-center space-x-3">
                            <DocumentTextIcon className="h-5 w-5 text-gray-400" />
                            <div>
                              <p className="text-sm font-medium text-gray-900">{attachment.filename}</p>
                              <p className="text-xs text-gray-500">
                                {(attachment.file_size / 1024).toFixed(2)} KB • {formatDate(attachment.uploaded_at)}
                              </p>
                            </div>
                          </div>
                          <span className="text-indigo-600 text-sm hover:underline">Download</span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column - Approval Actions */}
              <div className="space-y-6">
                {/* Approval History */}
                <div className="bg-white rounded-lg border-2 border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <ClockIcon className="h-5 w-5 mr-2 text-indigo-600" />
                    Approval History
                  </h3>

                  {/* PM Approval */}
                  <div className="mb-4 pb-4 border-b border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">Project Manager</span>
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${getStatusColor(requisition.pm_approval_status)}`}>
                        {requisition.pm_approval_status === 'pending' ? 'Pending' : 
                         requisition.pm_approval_status === 'approved' ? 'Approved' : 'Rejected'}
                      </span>
                    </div>
                    {requisition.pm_name_display && (
                      <div className="flex items-center space-x-2 text-sm text-gray-600 mt-2">
                        <UserCircleIcon className="h-4 w-4" />
                        <span>{requisition.pm_name_display}</span>
                      </div>
                    )}
                    {requisition.pm_approved_at && (
                      <p className="text-xs text-gray-500 mt-1">
                        {formatDate(requisition.pm_approved_at)} at {new Date(requisition.pm_approved_at).toLocaleTimeString()}
                      </p>
                    )}
                  </div>

                  {/* VP Approval */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">VP Operations</span>
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${getStatusColor(requisition.vp_op_approval_status)}`}>
                        {requisition.vp_op_approval_status === 'pending' ? 'Pending' : 
                         requisition.vp_op_approval_status === 'approved' ? 'Approved' : 'Rejected'}
                      </span>
                    </div>
                    {requisition.vp_op_name_display && (
                      <div className="flex items-center space-x-2 text-sm text-gray-600 mt-2">
                        <UserCircleIcon className="h-4 w-4" />
                        <span>{requisition.vp_op_name_display}</span>
                      </div>
                    )}
                    {requisition.vp_op_approved_at && (
                      <p className="text-xs text-gray-500 mt-1">
                        {formatDate(requisition.vp_op_approved_at)} at {new Date(requisition.vp_op_approved_at).toLocaleTimeString()}
                      </p>
                    )}
                  </div>

                  {/* Rejection Reason */}
                  {isRejected && requisition.rejection_reason && (
                    <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-sm font-medium text-red-800 mb-1">Rejection Reason:</p>
                      <p className="text-sm text-red-700">{requisition.rejection_reason}</p>
                    </div>
                  )}
                </div>

                {/* Approval Actions - Soft-coded visibility check */}
                {hasAnyApprovalCapability && (
                  <div className="bg-white rounded-lg border-2 border-indigo-200 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <PencilSquareIcon className="h-5 w-5 mr-2 text-indigo-600" />
                      Your Action Required
                    </h3>

                    {/* Optional Signature */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Digital Signature (Optional)
                      </label>
                      <input
                        type="text"
                        value={signature}
                        onChange={(e) => setSignature(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        placeholder="Enter your name or signature"
                      />
                    </div>

                    {/* Action Buttons - Dynamic Approval Tiers (Soft-Coded) */}
                    <div className="space-y-4">
                      <h4 className="font-semibold text-gray-900 mb-3">Approval Actions</h4>
                      
                      {/* Project Manager Approval */}
                      {APPROVER_CONFIG.pm.canApprove && (
                        <div className="border-2 border-indigo-200 rounded-lg p-4 bg-indigo-50">
                          <h5 className="text-sm font-semibold text-indigo-900 mb-2">Project Manager Review</h5>
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleApprove('pm')}
                              disabled={loading}
                              className="flex-1 flex items-center justify-center space-x-2 px-4 py-2.5 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 transition-all font-medium disabled:opacity-50"
                            >
                              <CheckCircleIcon className="h-5 w-5" />
                              <span>Approve</span>
                            </button>
                            <button
                              onClick={() => handleRejectClick('pm')}
                              disabled={loading}
                              className="flex-1 flex items-center justify-center space-x-2 px-4 py-2.5 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg hover:from-red-700 hover:to-red-800 transition-all font-medium disabled:opacity-50"
                            >
                              <XCircleIcon className="h-5 w-5" />
                              <span>Reject</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Engineering Manager Approval */}
                      {APPROVER_CONFIG.eng_manager.canApprove && (
                        <div className="border-2 border-purple-200 rounded-lg p-4 bg-purple-50">
                          <h5 className="text-sm font-semibold text-purple-900 mb-2">Engineering Manager Review</h5>
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleApprove('eng_manager')}
                              disabled={loading}
                              className="flex-1 flex items-center justify-center space-x-2 px-4 py-2.5 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 transition-all font-medium disabled:opacity-50"
                            >
                              <CheckCircleIcon className="h-5 w-5" />
                              <span>Approve</span>
                            </button>
                            <button
                              onClick={() => handleRejectClick('eng_manager')}
                              disabled={loading}
                              className="flex-1 flex items-center justify-center space-x-2 px-4 py-2.5 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg hover:from-red-700 hover:to-red-800 transition-all font-medium disabled:opacity-50"
                            >
                              <XCircleIcon className="h-5 w-5" />
                              <span>Reject</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Manager of Projects Approval */}
                      {APPROVER_CONFIG.manager_projects.canApprove && (
                        <div className="border-2 border-blue-200 rounded-lg p-4 bg-blue-50">
                          <h5 className="text-sm font-semibold text-blue-900 mb-2">Manager of Projects Review</h5>
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleApprove('manager_projects')}
                              disabled={loading}
                              className="flex-1 flex items-center justify-center space-x-2 px-4 py-2.5 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 transition-all font-medium disabled:opacity-50"
                            >
                              <CheckCircleIcon className="h-5 w-5" />
                              <span>Approve</span>
                            </button>
                            <button
                              onClick={() => handleRejectClick('manager_projects')}
                              disabled={loading}
                              className="flex-1 flex items-center justify-center space-x-2 px-4 py-2.5 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg hover:from-red-700 hover:to-red-800 transition-all font-medium disabled:opacity-50"
                            >
                              <XCircleIcon className="h-5 w-5" />
                              <span>Reject</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* VP Operations Approval */}
                      {APPROVER_CONFIG.vp.canApprove && (
                        <div className="border-2 border-orange-200 rounded-lg p-4 bg-orange-50">
                          <h5 className="text-sm font-semibold text-orange-900 mb-2">VP Operations Review</h5>
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleApprove('vp')}
                              disabled={loading}
                              className="flex-1 flex items-center justify-center space-x-2 px-4 py-2.5 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 transition-all font-medium disabled:opacity-50"
                            >
                              <CheckCircleIcon className="h-5 w-5" />
                              <span>Approve</span>
                            </button>
                            <button
                              onClick={() => handleRejectClick('vp')}
                              disabled={loading}
                              className="flex-1 flex items-center justify-center space-x-2 px-4 py-2.5 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg hover:from-red-700 hover:to-red-800 transition-all font-medium disabled:opacity-50"
                            >
                              <XCircleIcon className="h-5 w-5" />
                              <span>Reject</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* No pending actions */}
                      {!APPROVER_CONFIG.pm.canApprove && !APPROVER_CONFIG.eng_manager.canApprove && 
                       !APPROVER_CONFIG.manager_projects.canApprove && !APPROVER_CONFIG.vp.canApprove && (
                        <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                          <div className="flex items-start space-x-2">
                            <InformationCircleIcon className="h-5 w-5 text-gray-600 flex-shrink-0 mt-0.5" />
                            <p className="text-sm text-gray-700">
                              No approval action available for your role at this time.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Fully Approved Message */}
                {isFullyApproved && (
                  <div className="bg-green-50 border-2 border-green-300 rounded-lg p-6">
                    <div className="flex items-center space-x-3">
                      <CheckCircleIcon className="h-8 w-8 text-green-600" />
                      <div>
                        <p className="font-semibold text-green-900">Fully Approved</p>
                        <p className="text-sm text-green-700 mt-1">
                          This requisition has been approved by both PM and VP Operations.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Rejected Message */}
                {isRejected && (
                  <div className="bg-red-50 border-2 border-red-300 rounded-lg p-6">
                    <div className="flex items-center space-x-3">
                      <XCircleIcon className="h-8 w-8 text-red-600" />
                      <div>
                        <p className="font-semibold text-red-900">Rejected</p>
                        <p className="text-sm text-red-700 mt-1">
                          This requisition has been rejected and cannot be processed.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-8 py-5 rounded-b-xl border-t border-gray-200 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Form Reference: {requisition.form_reference} • {requisition.page_number}
            </p>
            <button
              onClick={onClose}
              className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Rejection Modal with Mandatory Reason */}
      {showRejectModal && currentApproverType && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full mx-4">
            <div className="bg-gradient-to-r from-red-600 to-red-700 text-white px-6 py-4 rounded-t-xl">
              <div className="flex items-center space-x-3">
                <ExclamationTriangleIcon className="h-6 w-6" />
                <h3 className="text-xl font-bold">Reject Purchase Requisition</h3>
              </div>
            </div>

            <div className="p-6">
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-start space-x-2">
                  <InformationCircleIcon className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-yellow-800">
                    <strong>Rejecting as: {APPROVER_CONFIG[currentApproverType]?.label}</strong><br/>
                    You must provide a detailed reason for rejection (minimum {REJECTION_CONFIG.MIN_REASON_LENGTH} characters).
                  </p>
                </div>
              </div>

              <label className="block text-sm font-medium text-gray-700 mb-2">
                Rejection Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => {
                  setRejectionReason(e.target.value);
                  setRejectionError(''); // Clear error on input
                }}
                rows={5}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent ${
                  rejectionError ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Enter a detailed reason for rejecting this purchase requisition..."
              />
              
              {/* Character Counter */}
              <div className="flex justify-between items-center mt-2">
                <p className={`text-xs ${
                  rejectionReason.trim().length < REJECTION_CONFIG.MIN_REASON_LENGTH 
                    ? 'text-red-500' 
                    : rejectionReason.trim().length > REJECTION_CONFIG.MAX_REASON_LENGTH
                    ? 'text-red-500'
                    : 'text-green-600'
                }`}>
                  {rejectionReason.trim().length} / {REJECTION_CONFIG.MIN_REASON_LENGTH} characters minimum
                </p>
                <p className="text-xs text-gray-500">
                  {REJECTION_CONFIG.MAX_REASON_LENGTH - rejectionReason.length} remaining
                </p>
              </div>

              {/* Validation Error Message */}
              {rejectionError && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-700 flex items-center space-x-2">
                    <ExclamationTriangleIcon className="h-4 w-4" />
                    <span>{rejectionError}</span>
                  </p>
                </div>
              )}

              <div className="flex space-x-3 mt-6">
                <button
                  onClick={handleRejectCancel}
                  disabled={loading}
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors font-medium disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRejectSubmit}
                  disabled={loading || rejectionReason.trim().length < REJECTION_CONFIG.MIN_REASON_LENGTH}
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg hover:from-red-700 hover:to-red-800 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <span className="flex items-center justify-center space-x-2">
                      <ArrowPathIcon className="h-4 w-4 animate-spin" />
                      <span>Rejecting...</span>
                    </span>
                  ) : (
                    'Confirm Rejection'
                  )}
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
