import React, { useState, useMemo } from 'react';

/**
 * Access to All Users Modal
 * Allows bulk assignment of selected modules/apps to all users in the system
 * Smart, soft-coded implementation with multi-select capability
 */
const AccessToAllModal = ({
  isOpen,
  onClose,
  onAssign,
  modules = [],
  totalUsers = 0,
  loading = false
}) => {
  const [selectedModules, setSelectedModules] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [confirmationStep, setConfirmationStep] = useState(false);

  // Filter modules based on search
  const filteredModules = useMemo(() => {
    if (!searchTerm.trim()) return modules;
    
    const search = searchTerm.toLowerCase();
    return modules.filter(module => 
      module.name?.toLowerCase().includes(search) ||
      module.code?.toLowerCase().includes(search) ||
      module.description?.toLowerCase().includes(search)
    );
  }, [modules, searchTerm]);

  // Toggle module selection
  const toggleModule = (moduleCode) => {
    setSelectedModules(prev => 
      prev.includes(moduleCode)
        ? prev.filter(code => code !== moduleCode)
        : [...prev, moduleCode]
    );
  };

  // Select all filtered modules
  const selectAll = () => {
    const allCodes = filteredModules.map(m => m.code);
    setSelectedModules(allCodes);
  };

  // Clear all selections
  const clearAll = () => {
    setSelectedModules([]);
  };

  // Handle confirmation and assignment
  const handleConfirm = () => {
    if (selectedModules.length === 0) {
      alert('Please select at least one app/module');
      return;
    }
    setConfirmationStep(true);
  };

  // Execute the assignment
  const handleFinalAssign = async () => {
    try {
      await onAssign(selectedModules);
      // Reset on success
      setSelectedModules([]);
      setSearchTerm('');
      setConfirmationStep(false);
      onClose();
    } catch (error) {
      console.error('Failed to assign modules:', error);
    }
  };

  // Cancel and reset
  const handleCancel = () => {
    setSelectedModules([]);
    setSearchTerm('');
    setConfirmationStep(false);
    onClose();
  };

  // Go back from confirmation
  const handleBack = () => {
    setConfirmationStep(false);
  };

  if (!isOpen) return null;

  // Get selected module names for confirmation
  const selectedModuleNames = modules
    .filter(m => selectedModules.includes(m.code))
    .map(m => m.name || m.code)
    .join(', ');

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-purple-600 to-indigo-600">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <div>
                <h2 className="text-2xl font-bold text-white">
                  {confirmationStep ? 'Confirm Access Assignment' : 'Grant Access to All Users'}
                </h2>
                <p className="text-purple-100 text-sm">
                  {confirmationStep 
                    ? `Assigning to ${totalUsers} users`
                    : `Select apps/modules to grant access to all ${totalUsers} users`
                  }
                </p>
              </div>
            </div>
            <button
              onClick={handleCancel}
              className="text-white hover:text-gray-200 transition-colors"
              disabled={loading}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {!confirmationStep ? (
            // Step 1: Module Selection
            <>
              {/* Search and Actions */}
              <div className="mb-4 space-y-3">
                <div className="relative">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search apps/modules..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                  <svg className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    {selectedModules.length} of {filteredModules.length} selected
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={selectAll}
                      className="px-3 py-1 text-sm text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                    >
                      Select All
                    </button>
                    <button
                      onClick={clearAll}
                      className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      Clear All
                    </button>
                  </div>
                </div>
              </div>

              {/* Module List */}
              <div className="space-y-2">
                {filteredModules.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <svg className="w-16 h-16 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                    </svg>
                    <p>No apps/modules found</p>
                  </div>
                ) : (
                  filteredModules.map((module) => {
                    const isSelected = selectedModules.includes(module.code);
                    return (
                      <div
                        key={module.id || module.code}
                        onClick={() => toggleModule(module.code)}
                        className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                          isSelected
                            ? 'border-purple-500 bg-purple-50'
                            : 'border-gray-200 hover:border-purple-300 bg-white'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 mt-1">
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                              isSelected
                                ? 'bg-purple-600 border-purple-600'
                                : 'border-gray-300'
                            }`}>
                              {isSelected && (
                                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <h3 className="font-semibold text-gray-900">
                                {module.name || module.code}
                              </h3>
                              <span className="text-xs font-mono text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                {module.code}
                              </span>
                            </div>
                            {module.description && (
                              <p className="text-sm text-gray-600 mt-1">
                                {module.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          ) : (
            // Step 2: Confirmation
            <div className="space-y-6">
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
                <div className="flex items-start">
                  <svg className="w-6 h-6 text-yellow-400 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div>
                    <h3 className="text-lg font-semibold text-yellow-800">Confirm Bulk Access Assignment</h3>
                    <p className="text-yellow-700 mt-1">
                      You are about to grant access to the following apps/modules to <strong>ALL {totalUsers} users</strong> in the system.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-3">Selected Apps/Modules:</h4>
                <div className="space-y-2">
                  {modules
                    .filter(m => selectedModules.includes(m.code))
                    .map(module => (
                      <div key={module.code} className="flex items-center gap-2 bg-white p-3 rounded border border-gray-200">
                        <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="font-medium text-gray-900">{module.name || module.code}</span>
                        <span className="text-xs font-mono text-gray-500 bg-gray-100 px-2 py-1 rounded ml-auto">
                          {module.code}
                        </span>
                      </div>
                    ))}
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> This action will grant access to these modules for all users. 
                  Individual user permissions may need to be adjusted separately if needed.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
          {!confirmationStep ? (
            <>
              <button
                onClick={handleCancel}
                className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={selectedModules.length === 0 || loading}
                className="px-6 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <span>Continue</span>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleBack}
                className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors flex items-center gap-2"
                disabled={loading}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5m0 0l5-5m-5 5h12" />
                </svg>
                <span>Back</span>
              </button>
              <button
                onClick={handleFinalAssign}
                disabled={loading}
                className="px-6 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Assigning...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Confirm & Assign to All Users</span>
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AccessToAllModal;
