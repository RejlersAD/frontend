/**
 * Exit Requests HR View Component
 * HR interface for viewing and managing all exit requests
 * Features:
 * - Manager approval interface
 * - HR approval interface
 * - Clearance management
 * - Activity tracking
 * - Statistics dashboard
 */

import React, { useState, useEffect } from 'react';
import apiClient from '../../services/api.service';
import {
  EXIT_API_ENDPOINTS,
  EXIT_STATUS_CONFIG,
  getActivityIcon,
  CLEARANCE_DEPARTMENTS,
  CLEARANCE_STATUS_CONFIG,
} from '../../config/exitWorkflow.config';

const ExitRequestsHRView = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [viewMode, setViewMode] = useState('pending_hr_approval'); // pending_hr_approval, pending_manager_approval, all
  const [statistics, setStatistics] = useState(null);
  const [actionType, setActionType] = useState(null); // 'manager' or 'hr'
  const [actionData, setActionData] = useState({ action: 'approve', comments: '', final_approved_lwd: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch Statistics
  useEffect(() => {
    fetchStatistics();
  }, []);

  // Fetch Requests
  useEffect(() => {
    fetchRequests();
  }, [viewMode]);

  const fetchStatistics = async () => {
    try {
      const response = await apiClient.get(EXIT_API_ENDPOINTS.statistics);
      setStatistics(response.data);
    } catch (error) {
      console.error('Failed to fetch statistics:', error);
    }
  };

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get(
        `${EXIT_API_ENDPOINTS.list}?view_mode=${viewMode}`
      );
      // Handle paginated response from Django REST Framework
      const data = response.data.results || response.data || [];
      setRequests(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch requests:', error);
      setRequests([]); // Set empty array on error to prevent map errors
    } finally {
      setLoading(false);
    }
  };

  // Fetch Request Details
  const fetchRequestDetails = async (id) => {
    try {
      const response = await apiClient.get(EXIT_API_ENDPOINTS.detail(id));
      setSelectedRequest(response.data);
    } catch (error) {
      console.error('Failed to fetch request details:', error);
    }
  };

  // Handle Manager/HR Action
  const handleApprovalAction = async () => {
    if (!selectedRequest) return;

    try {
      setIsSubmitting(true);
      const endpoint =
        actionType === 'manager'
          ? EXIT_API_ENDPOINTS.managerAction(selectedRequest.id)
          : EXIT_API_ENDPOINTS.hrAction(selectedRequest.id);

      await apiClient.post(endpoint, actionData);

      // Refresh data
      await fetchRequests();
      await fetchRequestDetails(selectedRequest.id);
      await fetchStatistics();

      setActionType(null);
      setActionData({ action: 'approve', comments: '', final_approved_lwd: '' });
      alert(`✅ Request ${actionData.action === 'approve' ? 'approved' : 'rejected'} successfully`);
    } catch (error) {
      console.error('Action failed:', error);
      alert(error.response?.data?.error || 'Failed to process action');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Format Date
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // Format DateTime
  const formatDateTime = (dateString) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      {statistics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="text-sm text-gray-600">Pending Manager</div>
            <div className="text-2xl font-bold text-yellow-600">{statistics.pending_manager}</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="text-sm text-gray-600">Pending HR</div>
            <div className="text-2xl font-bold text-blue-600">{statistics.pending_hr}</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="text-sm text-gray-600">In Progress</div>
            <div className="text-2xl font-bold text-indigo-600">{statistics.in_progress}</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="text-sm text-gray-600">Total Requests</div>
            <div className="text-2xl font-bold text-gray-800">{statistics.total_requests}</div>
          </div>
        </div>
      )}

      {/* View Mode Tabs */}
      <div className="bg-white rounded-lg shadow-sm border p-2 flex gap-2">
        <button
          onClick={() => setViewMode('pending_hr_approval')}
          className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
            viewMode === 'pending_hr_approval'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Pending HR Approval
        </button>
        <button
          onClick={() => setViewMode('pending_manager_approval')}
          className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
            viewMode === 'pending_manager_approval'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Pending Manager
        </button>
        <button
          onClick={() => setViewMode('all')}
          className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
            viewMode === 'all'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          All Requests
        </button>
      </div>

      {/* Requests List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : requests.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow-sm border">
          <div className="text-6xl mb-4">📭</div>
          <h3 className="text-xl font-semibold text-gray-700 mb-2">No Requests Found</h3>
          <p className="text-gray-600">No exit requests match the current filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {requests.map((request) => {
            const statusConfig = EXIT_STATUS_CONFIG[request.overall_status] || {};

            return (
              <div
                key={request.id}
                className="bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => {
                  fetchRequestDetails(request.id);
                }}
              >
                <div className="p-6">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-gray-800">{request.employee_name}</h3>
                      <p className="text-sm text-gray-600">
                        {request.position} • {request.department}
                      </p>
                    </div>
                    <span className="text-xs text-gray-500">#{request.id}</span>
                  </div>

                  {/* Status */}
                  <div
                    className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold mb-4 ${statusConfig.bgColor} ${statusConfig.textColor}`}
                  >
                    {statusConfig.icon} {statusConfig.label}
                  </div>

                  {/* Details */}
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Exit Reason:</span>
                      <span className="font-medium text-gray-800">
                        {request.exit_reason.replace(/_/g, ' ').toUpperCase()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Proposed LWD:</span>
                      <span className="font-medium text-gray-800">{formatDate(request.proposed_last_working_day)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Days Until LWD:</span>
                      <span
                        className={`font-medium ${
                          request.days_until_lwd < 7 ? 'text-red-600' : 'text-gray-800'
                        }`}
                      >
                        {request.days_until_lwd} days
                      </span>
                    </div>
                  </div>

                  {/* Approval Status */}
                  <div className="mt-4 pt-4 border-t grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-gray-600">Manager:</span>
                      <span
                        className={`ml-2 font-semibold ${
                          request.manager_approval_status === 'approved'
                            ? 'text-green-600'
                            : request.manager_approval_status === 'rejected'
                            ? 'text-red-600'
                            : 'text-yellow-600'
                        }`}
                      >
                        {request.manager_approval_status_display}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">HR:</span>
                      <span
                        className={`ml-2 font-semibold ${
                          request.hr_approval_status === 'approved'
                            ? 'text-green-600'
                            : request.hr_approval_status === 'rejected'
                            ? 'text-red-600'
                            : 'text-yellow-600'
                        }`}
                      >
                        {request.hr_approval_status_display}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-800">Exit Request #{selectedRequest.id}</h2>
              <button onClick={() => setSelectedRequest(null)} className="text-gray-500 hover:text-gray-700">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Employee Info */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Employee Information</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-600">Name:</span>
                    <span className="ml-2 font-medium">{selectedRequest.employee_name}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Email:</span>
                    <span className="ml-2 font-medium">{selectedRequest.employee_email}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Position:</span>
                    <span className="ml-2 font-medium">{selectedRequest.position}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Department:</span>
                    <span className="ml-2 font-medium">{selectedRequest.department}</span>
                  </div>
                </div>
              </div>

              {/* Manager/HR Action Buttons */}
              {selectedRequest.manager_approval_status === 'pending' && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-yellow-800 mb-3">Manager Action Required</h3>
                  <button
                    onClick={() => setActionType('manager')}
                    className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700"
                  >
                    Take Manager Action
                  </button>
                </div>
              )}

              {selectedRequest.hr_approval_status === 'pending' &&
                selectedRequest.manager_approval_status === 'approved' && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-blue-800 mb-3">HR Action Required</h3>
                    <button
                      onClick={() => setActionType('hr')}
                      className="px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700"
                    >
                      Take HR Action
                    </button>
                  </div>
                )}

              {/* Activity Timeline */}
              {selectedRequest.activities && selectedRequest.activities.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Activity Timeline</h3>
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {selectedRequest.activities.map((activity) => (
                      <div key={activity.id} className="flex gap-3">
                        <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-lg">
                          {getActivityIcon(activity.activity_type)}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-800">{activity.activity_description}</p>
                          <p className="text-xs text-gray-500">
                            {formatDateTime(activity.activity_date)}
                            {activity.performed_by_name && ` • by ${activity.performed_by_name}`}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Action Modal */}
      {actionType && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4">
              {actionType === 'manager' ? 'Manager' : 'HR'} Action
            </h3>

            {/* Action Selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Action</label>
              <select
                value={actionData.action}
                onChange={(e) => setActionData((prev) => ({ ...prev, action: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="approve">Approve</option>
                <option value="reject">Reject</option>
              </select>
            </div>

            {/* HR-specific: Final LWD */}
            {actionType === 'hr' && actionData.action === 'approve' && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Final Approved LWD (Optional)
                </label>
                <input
                  type="date"
                  value={actionData.final_approved_lwd}
                  onChange={(e) => setActionData((prev) => ({ ...prev, final_approved_lwd: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">Leave blank to use proposed date</p>
              </div>
            )}

            {/* Comments */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Comments</label>
              <textarea
                value={actionData.comments}
                onChange={(e) => setActionData((prev) => ({ ...prev, comments: e.target.value }))}
                rows={4}
                placeholder="Enter your comments..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleApprovalAction}
                disabled={isSubmitting}
                className={`flex-1 px-4 py-2 font-medium rounded-lg text-white transition-colors ${
                  actionData.action === 'approve'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-red-600 hover:bg-red-700'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {isSubmitting ? 'Processing...' : `Confirm ${actionData.action === 'approve' ? 'Approval' : 'Rejection'}`}
              </button>
              <button
                onClick={() => {
                  setActionType(null);
                  setActionData({ action: 'approve', comments: '', final_approved_lwd: '' });
                }}
                disabled={isSubmitting}
                className="px-4 py-2 bg-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-300 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExitRequestsHRView;
