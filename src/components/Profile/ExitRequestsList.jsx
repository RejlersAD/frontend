/**
 * Exit Requests List Component
 * Displays user's exit requests with status tracking and activity timeline
 * Features:
 * - Request status visualization
 * - Activity timeline
 * - Withdrawal option
 * - Real-time status updates
 */

import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import apiClient from '../../services/api.service';
import {
  EXIT_API_ENDPOINTS,
  EXIT_STATUS_CONFIG,
  getActivityIcon,
  CLEARANCE_STATUS_CONFIG,
} from '../../config/exitWorkflow.config';

const ExitRequestsList = () => {
  const { user } = useSelector((state) => state.auth);

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawReason, setWithdrawReason] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);

  // Fetch Exit Requests
  useEffect(() => {
    fetchExitRequests();
  }, []);

  const fetchExitRequests = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get(
        `${EXIT_API_ENDPOINTS.list}?view_mode=my_requests`
      );
      // Handle paginated response from Django REST Framework
      const data = response.data.results || response.data || [];
      setRequests(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch exit requests:', error);
      setRequests([]); // Set empty array on error to prevent map errors
    } finally {
      setLoading(false);
    }
  };

  // Fetch Request Details
  const fetchRequestDetails = async (id) => {
    try {
      const response = await apiClient.get(
        EXIT_API_ENDPOINTS.detail(id)
      );
      setSelectedRequest(response.data);
    } catch (error) {
      console.error('Failed to fetch request details:', error);
    }
  };

  // Handle Withdrawal
  const handleWithdraw = async () => {
    if (!withdrawReason.trim()) {
      alert('Please provide a reason for withdrawal');
      return;
    }

    try {
      setWithdrawing(true);
      await apiClient.post(
        EXIT_API_ENDPOINTS.withdraw(selectedRequest.id),
        { reason: withdrawReason }
      );
      
      // Refresh data
      await fetchExitRequests();
      await fetchRequestDetails(selectedRequest.id);
      
      setShowWithdrawModal(false);
      setWithdrawReason('');
      alert('✅ Exit request withdrawn successfully');
    } catch (error) {
      console.error('Withdrawal failed:', error);
      alert(error.response?.data?.error || 'Failed to withdraw request');
    } finally {
      setWithdrawing(false);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">📝</div>
        <h3 className="text-xl font-semibold text-gray-700 mb-2">
          No Exit Requests
        </h3>
        <p className="text-gray-600">
          You haven't submitted any exit requests yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {requests.map((request) => {
          const statusConfig = EXIT_STATUS_CONFIG[request.overall_status] || {};
          
          return (
            <div
              key={request.id}
              className="bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => fetchRequestDetails(request.id)}
            >
              <div className="p-6">
                {/* Status Badge */}
                <div className="flex items-center justify-between mb-4">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${statusConfig.bgColor} ${statusConfig.textColor}`}
                  >
                    {statusConfig.icon} {statusConfig.label}
                  </span>
                  <span className="text-xs text-gray-500">
                    #{request.id}
                  </span>
                </div>

                {/* Request Details */}
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-gray-600">Reason:</span>
                    <span className="ml-2 font-medium text-gray-800">
                      {request.exit_reason.replace(/_/g, ' ').toUpperCase()}
                    </span>
                  </div>
                  
                  <div>
                    <span className="text-gray-600">Proposed LWD:</span>
                    <span className="ml-2 font-medium text-gray-800">
                      {formatDate(request.proposed_last_working_day)}
                    </span>
                  </div>

                  {request.final_approved_lwd && request.final_approved_lwd !== request.proposed_last_working_day && (
                    <div>
                      <span className="text-gray-600">Approved LWD:</span>
                      <span className="ml-2 font-medium text-green-600">
                        {formatDate(request.final_approved_lwd)}
                      </span>
                    </div>
                  )}

                  <div>
                    <span className="text-gray-600">Days Until LWD:</span>
                    <span className={`ml-2 font-medium ${request.days_until_lwd < 7 ? 'text-red-600' : 'text-gray-800'}`}>
                      {request.days_until_lwd} days
                    </span>
                  </div>

                  <div>
                    <span className="text-gray-600">Submitted:</span>
                    <span className="ml-2 font-medium text-gray-800">
                      {formatDate(request.created_at)}
                    </span>
                  </div>
                </div>

                {/* Approval Progress */}
                <div className="mt-4 pt-4 border-t space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-600">Manager:</span>
                    <span
                      className={`font-semibold ${
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
                  
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-600">HR:</span>
                    <span
                      className={`font-semibold ${
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

      {/* Detail Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-800">
                Exit Request Details #{selectedRequest.id}
              </h2>
              <button
                onClick={() => setSelectedRequest(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Status */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Current Status</h3>
                <div
                  className={`inline-flex items-center px-4 py-2 rounded-lg ${
                    EXIT_STATUS_CONFIG[selectedRequest.overall_status]?.bgColor
                  } ${EXIT_STATUS_CONFIG[selectedRequest.overall_status]?.textColor}`}
                >
                  <span className="text-2xl mr-2">
                    {EXIT_STATUS_CONFIG[selectedRequest.overall_status]?.icon}
                  </span>
                  <div>
                    <div className="font-semibold">
                      {EXIT_STATUS_CONFIG[selectedRequest.overall_status]?.label}
                    </div>
                    <div className="text-xs">
                      {EXIT_STATUS_CONFIG[selectedRequest.overall_status]?.description}
                    </div>
                  </div>
                </div>
              </div>

              {/* Activity Timeline */}
              {selectedRequest.activities && selectedRequest.activities.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Activity Timeline</h3>
                  <div className="space-y-3">
                    {selectedRequest.activities.map((activity, index) => (
                      <div key={activity.id} className="flex gap-3">
                        <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-lg">
                          {getActivityIcon(activity.activity_type)}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-800">
                            {activity.activity_description}
                          </p>
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

              {/* Clearances */}
              {selectedRequest.clearances && selectedRequest.clearances.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Department Clearances</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {selectedRequest.clearances.map((clearance) => {
                      const clearanceConfig = CLEARANCE_STATUS_CONFIG[clearance.clearance_status] || {};
                      return (
                        <div
                          key={clearance.id}
                          className={`p-3 rounded-lg border ${clearanceConfig.bgColor}`}
                        >
                          <div className="text-xs font-semibold text-gray-700">
                            {clearance.department_display}
                          </div>
                          <div className={`text-xs mt-1 ${clearanceConfig.textColor}`}>
                            {clearanceConfig.icon} {clearanceConfig.label}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Withdrawal Button */}
              {selectedRequest.overall_status === 'pending_manager' ||
                selectedRequest.overall_status === 'pending_hr' ? (
                <div className="pt-4 border-t">
                  <button
                    onClick={() => setShowWithdrawModal(true)}
                    className="px-6 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors"
                  >
                    ↩️ Withdraw Request
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Withdraw Modal */}
      {showWithdrawModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4">
              Withdraw Exit Request
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Please provide a reason for withdrawing your exit request.
            </p>
            <textarea
              value={withdrawReason}
              onChange={(e) => setWithdrawReason(e.target.value)}
              rows={4}
              placeholder="Enter reason for withdrawal..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={handleWithdraw}
                disabled={withdrawing || !withdrawReason.trim()}
                className="flex-1 px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {withdrawing ? 'Withdrawing...' : 'Confirm Withdrawal'}
              </button>
              <button
                onClick={() => {
                  setShowWithdrawModal(false);
                  setWithdrawReason('');
                }}
                disabled={withdrawing}
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

export default ExitRequestsList;
