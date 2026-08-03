import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import rbacService from '../../services/rbac.service';
import { 
  DUPLICATE_DETECTION_CONFIG, 
  formatDuplicateData,
  determineUserToKeep 
} from '../../config/duplicateDetection.config';
import { 
  ExclamationTriangleIcon, 
  CheckCircleIcon,
  XMarkIcon,
  TrashIcon,
  UserIcon 
} from '@heroicons/react/24/outline';

/**
 * Duplicate Detection Modal
 * Soft-coded component for detecting and resolving duplicate user accounts
 */
const DuplicateDetectionModal = ({ isOpen, onClose, onResolved }) => {
  const [loading, setLoading] = useState(false);
  const [duplicates, setDuplicates] = useState([]);
  const [selectedDuplicate, setSelectedDuplicate] = useState(null);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [resolutionStrategy, setResolutionStrategy] = useState(
    DUPLICATE_DETECTION_CONFIG.resolution.default
  );

  const config = DUPLICATE_DETECTION_CONFIG;

  useEffect(() => {
    if (isOpen) {
      checkForDuplicates();
    }
  }, [isOpen]);

  const checkForDuplicates = async () => {
    setLoading(true);
    try {
      const response = await rbacService.checkDuplicateUsers();
      setDuplicates(response.data.duplicates || []);
      
      if (response.data.duplicates?.length > 0) {
        toast.info(
          `Found ${response.data.total_duplicates} duplicate email(s) with ${response.data.total_duplicate_users} total users`,
          { autoClose: 5000 }
        );
      } else {
        toast.success(config.ui.modal.noDataMessage);
      }
    } catch (error) {
      console.error(config.logging.prefix, 'Error checking duplicates:', error);
      toast.error(config.messages.error.checkFailed);
    } finally {
      setLoading(false);
    }
  };

  const handleResolveDuplicate = async (email, keepUserId = null) => {
    if (!keepUserId && resolutionStrategy === config.resolution.strategies.MANUAL_SELECT) {
      toast.error(config.messages.error.noSelection);
      return;
    }

    const confirmed = window.confirm(config.messages.confirm.resolve);
    if (!confirmed) return;

    setLoading(true);
    try {
      await rbacService.resolveDuplicate(email, keepUserId, resolutionStrategy);
      toast.success(config.messages.success.resolved);
      
      // Refresh duplicates list
      await checkForDuplicates();
      setSelectedDuplicate(null);
      setSelectedUserId(null);
      
      if (onResolved) onResolved();
    } catch (error) {
      console.error(config.logging.prefix, 'Error resolving duplicate:', error);
      toast.error(config.messages.error.resolveFailed);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectUser = (duplicate) => {
    setSelectedDuplicate(duplicate);
    const recommendedUser = determineUserToKeep(duplicate.users, resolutionStrategy);
    setSelectedUserId(recommendedUser?.id || null);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Overlay */}
        <div 
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" 
          onClick={onClose}
        ></div>

        {/* Modal */}
        <div className="inline-block w-full max-w-6xl my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-2xl rounded-2xl">
          {/* Header */}
          <div className="px-6 py-4 bg-gradient-to-r from-amber-500 to-orange-600">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ExclamationTriangleIcon className="w-8 h-8 text-white" />
                <h3 className="text-2xl font-bold text-white">
                  {config.ui.modal.title}
                </h3>
              </div>
              <button
                onClick={onClose}
                className="p-1 text-white transition-colors rounded-full hover:bg-white hover:bg-opacity-20"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>
            <p className="mt-2 text-sm text-white text-opacity-90">
              {config.ui.modal.description}
            </p>
          </div>

          {/* Content */}
          <div className="p-6">
            {loading && !duplicates.length ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
              </div>
            ) : duplicates.length === 0 ? (
              <div className="py-12 text-center">
                <CheckCircleIcon className="w-16 h-16 mx-auto text-green-500 mb-4" />
                <p className="text-xl font-semibold text-gray-700">
                  {config.ui.modal.noDataMessage}
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Strategy Selector */}
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Resolution Strategy:
                  </label>
                  <select
                    value={resolutionStrategy}
                    onChange={(e) => setResolutionStrategy(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {Object.entries(config.resolution.strategies).map(([key, value]) => (
                      <option key={value} value={value}>
                        {config.resolution.descriptions[key]}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Duplicates List */}
                <div className="space-y-4">
                  {duplicates.map((duplicate, index) => {
                    const formattedDup = formatDuplicateData(duplicate);
                    const isSelected = selectedDuplicate?.email === duplicate.email;

                    return (
                      <div 
                        key={index} 
                        className="border-2 border-gray-200 rounded-xl overflow-hidden hover:shadow-lg transition-shadow"
                      >
                        {/* Duplicate Header */}
                        <div className={`px-4 py-3 bg-gradient-to-r ${
                          formattedDup.severity === 'danger' ? 'from-red-50 to-red-100' :
                          formattedDup.severity === 'warning' ? 'from-amber-50 to-amber-100' :
                          'from-blue-50 to-blue-100'
                        }`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <span className="text-2xl">
                                {config.ui.icons[formattedDup.severity]}
                              </span>
                              <div>
                                <h4 className="text-lg font-bold text-gray-900">
                                  {duplicate.email}
                                </h4>
                                <p className="text-sm text-gray-600">
                                  {duplicate.count} duplicate accounts found
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={() => handleSelectUser(duplicate)}
                              className="px-4 py-2 bg-white text-blue-600 font-semibold rounded-lg hover:bg-blue-50 transition-colors border border-blue-200"
                            >
                              {isSelected ? 'Selected' : 'Select to Resolve'}
                            </button>
                          </div>
                        </div>

                        {/* User Details (when selected) */}
                        {isSelected && (
                          <div className="p-4 bg-white">
                            <div className="grid grid-cols-1 gap-4">
                              {duplicate.users.map((user) => (
                                <div
                                  key={user.id}
                                  className={`p-4 border-2 rounded-lg transition-all ${
                                    selectedUserId === user.id
                                      ? 'border-green-500 bg-green-50'
                                      : 'border-gray-200 hover:border-blue-300'
                                  }`}
                                >
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-3 mb-2">
                                        <UserIcon className="w-6 h-6 text-gray-400" />
                                        <div>
                                          <h5 className="font-semibold text-gray-900">
                                            {user.first_name} {user.last_name}
                                          </h5>
                                          <p className="text-sm text-gray-500">
                                            ID: {user.id} | {user.username}
                                          </p>
                                        </div>
                                      </div>
                                      
                                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                        <div>
                                          <span className="text-gray-500">Status:</span>
                                          <span className={`ml-2 font-semibold ${
                                            user.is_active ? 'text-green-600' : 'text-red-600'
                                          }`}>
                                            {user.is_active ? 'Active' : 'Inactive'}
                                          </span>
                                        </div>
                                        <div>
                                          <span className="text-gray-500">Created:</span>
                                          <span className="ml-2 font-semibold text-gray-700">
                                            {formatDate(user.date_joined)}
                                          </span>
                                        </div>
                                        <div>
                                          <span className="text-gray-500">Last Login:</span>
                                          <span className="ml-2 font-semibold text-gray-700">
                                            {formatDate(user.last_login)}
                                          </span>
                                        </div>
                                        <div>
                                          <span className="text-gray-500">Modules:</span>
                                          <span className="ml-2 font-semibold text-gray-700">
                                            {user.module_count || 0}
                                          </span>
                                        </div>
                                      </div>

                                      {user.department && (
                                        <div className="mt-2 text-sm">
                                          <span className="text-gray-500">Department:</span>
                                          <span className="ml-2 text-gray-700">{user.department}</span>
                                        </div>
                                      )}
                                    </div>

                                    <div className="flex flex-col gap-2 ml-4">
                                      {selectedUserId === user.id ? (
                                        <span className="px-3 py-1 text-xs font-bold text-green-700 bg-green-100 rounded-full">
                                          ✓ Keeping
                                        </span>
                                      ) : (
                                        <button
                                          onClick={() => setSelectedUserId(user.id)}
                                          className="px-3 py-1 text-xs font-semibold text-blue-600 bg-blue-100 rounded-full hover:bg-blue-200 transition-colors"
                                        >
                                          Select
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-3 mt-4">
                              <button
                                onClick={() => handleResolveDuplicate(duplicate.email, selectedUserId)}
                                disabled={loading || !selectedUserId}
                                className="flex-1 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold rounded-lg hover:from-green-600 hover:to-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {loading ? 'Processing...' : 'Resolve Duplicate'}
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedDuplicate(null);
                                  setSelectedUserId(null);
                                }}
                                className="px-6 py-3 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
            <div className="flex justify-between items-center">
              <button
                onClick={checkForDuplicates}
                disabled={loading}
                className="px-4 py-2 text-blue-600 font-semibold hover:text-blue-700 disabled:opacity-50"
              >
                🔄 Refresh
              </button>
              <button
                onClick={onClose}
                className="px-6 py-2 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DuplicateDetectionModal;
