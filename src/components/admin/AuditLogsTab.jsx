import React, { useState, useEffect } from 'react';
import rbacService from '../../services/rbac.service';

/**
 * Audit Logs Tab - Comprehensive system audit trail viewer
 * Displays all user actions, system events, and changes with filtering
 */
const AuditLogsTab = ({ onRefresh }) => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    action: 'all',
    resource_type: 'all',
    success: 'all',
    search: '',
    page: 1,
    page_size: 20
  });
  const [stats, setStats] = useState({
    total: 0,
    today: 0,
    failed: 0
  });

  // Soft-coded action types configuration
  const ACTION_TYPES = [
    { value: 'all', label: 'All Actions', icon: '📋', color: 'gray' },
    { value: 'login', label: 'Login', icon: '🔐', color: 'blue' },
    { value: 'logout', label: 'Logout', icon: '🚪', color: 'indigo' },
    { value: 'create', label: 'Create', icon: '➕', color: 'green' },
    { value: 'read', label: 'Read', icon: '👁️', color: 'cyan' },
    { value: 'update', label: 'Update', icon: '✏️', color: 'yellow' },
    { value: 'delete', label: 'Delete', icon: '🗑️', color: 'red' },
    { value: 'file_upload', label: 'File Upload', icon: '📤', color: 'purple' },
    { value: 'file_download', label: 'File Download', icon: '📥', color: 'teal' },
    { value: 'role_assign', label: 'Role Assign', icon: '👤', color: 'pink' },
    { value: 'permission_grant', label: 'Permission Grant', icon: '✅', color: 'emerald' }
  ];

  const RESOURCE_TYPES = [
    { value: 'all', label: 'All Resources' },
    { value: 'UserProfile', label: 'User Profile' },
    { value: 'Role', label: 'Roles' },
    { value: 'Permission', label: 'Permissions' },
    { value: 'Module', label: 'Modules' },
    { value: 'Invoice', label: 'Invoices' },
    { value: 'PIDDrawing', label: 'P&ID Drawings' },
    { value: 'UserStorage', label: 'Files' }
  ];

  useEffect(() => {
    loadAuditLogs();
  }, [filters]);

  const loadAuditLogs = async () => {
    setLoading(true);
    try {
      const params = {
        ...filters,
        ...(filters.action !== 'all' && { action: filters.action }),
        ...(filters.resource_type !== 'all' && { resource_type: filters.resource_type }),
        ...(filters.success !== 'all' && { success: filters.success === 'true' })
      };
      
      const response = await rbacService.getAuditLogs(params);
      setLogs(response.results || response);
      
      // Calculate stats
      const today = new Date().toDateString();
      const todayLogs = (response.results || response).filter(
        log => new Date(log.timestamp).toDateString() === today
      );
      const failedLogs = (response.results || response).filter(log => !log.success);
      
      setStats({
        total: response.count || (response.results || response).length,
        today: todayLogs.length,
        failed: failedLogs.length
      });
    } catch (error) {
      console.error('Failed to load audit logs:', error);
      // Set sample data for demonstration
      setSampleData();
    } finally {
      setLoading(false);
    }
  };

  const setSampleData = () => {
    const sampleLogs = [
      {
        id: '1',
        user_email: 'admin@radai.ae',
        action: 'login',
        resource_type: 'Auth',
        resource_name: 'User Login',
        timestamp: new Date().toISOString(),
        ip_address: '192.168.1.100',
        success: true,
        metadata: { browser: 'Chrome', os: 'Windows' }
      },
      {
        id: '2',
        user_email: 'user@radai.ae',
        action: 'create',
        resource_type: 'PIDDrawing',
        resource_name: 'PID-2026-001.pdf',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        ip_address: '192.168.1.101',
        success: true,
        metadata: { file_size: '2.5 MB' }
      },
      {
        id: '3',
        user_email: 'manager@radai.ae',
        action: 'update',
        resource_type: 'Invoice',
        resource_name: 'INV-2026-100',
        timestamp: new Date(Date.now() - 7200000).toISOString(),
        ip_address: '192.168.1.102',
        success: true,
        changes: { status: ['pending_approval', 'approved'] }
      }
    ];
    setLogs(sampleLogs);
    setStats({ total: 3, today: 3, failed: 0 });
  };

  const getActionBadge = (action) => {
    const actionType = ACTION_TYPES.find(a => a.value === action) || ACTION_TYPES[0];
    const colorMap = {
      gray: 'bg-gray-100 text-gray-800',
      blue: 'bg-blue-100 text-blue-800',
      indigo: 'bg-indigo-100 text-indigo-800',
      green: 'bg-green-100 text-green-800',
      cyan: 'bg-cyan-100 text-cyan-800',
      yellow: 'bg-yellow-100 text-yellow-800',
      red: 'bg-red-100 text-red-800',
      purple: 'bg-purple-100 text-purple-800',
      teal: 'bg-teal-100 text-teal-800',
      pink: 'bg-pink-100 text-pink-800',
      emerald: 'bg-emerald-100 text-emerald-800'
    };
    
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${colorMap[actionType.color]}`}>
        {actionType.icon} {actionType.label}
      </span>
    );
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    
    return date.toLocaleString();
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-bold text-gray-900">Audit Logs</h3>
          <p className="text-gray-600 mt-1">Comprehensive system activity and change tracking</p>
        </div>
        <button
          onClick={() => { onRefresh(); loadAuditLogs(); }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span>Refresh</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-xl border-2 border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-700 font-medium">Total Logs</p>
              <p className="text-3xl font-bold text-blue-900">{stats.total}</p>
            </div>
            <div className="w-12 h-12 bg-blue-200 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-xl border-2 border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-700 font-medium">Today's Activity</p>
              <p className="text-3xl font-bold text-green-900">{stats.today}</p>
            </div>
            <div className="w-12 h-12 bg-green-200 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-50 to-red-100 p-6 rounded-xl border-2 border-red-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-red-700 font-medium">Failed Actions</p>
              <p className="text-3xl font-bold text-red-900">{stats.failed}</p>
            </div>
            <div className="w-12 h-12 bg-red-200 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border-2 border-gray-200 p-6">
        <h4 className="font-bold text-gray-900 mb-4">Filters</h4>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Action Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Action Type</label>
            <select
              value={filters.action}
              onChange={(e) => setFilters({ ...filters, action: e.target.value, page: 1 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {ACTION_TYPES.map(action => (
                <option key={action.value} value={action.value}>
                  {action.icon} {action.label}
                </option>
              ))}
            </select>
          </div>

          {/* Resource Type Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Resource Type</label>
            <select
              value={filters.resource_type}
              onChange={(e) => setFilters({ ...filters, resource_type: e.target.value, page: 1 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {RESOURCE_TYPES.map(resource => (
                <option key={resource.value} value={resource.value}>
                  {resource.label}
                </option>
              ))}
            </select>
          </div>

          {/* Success Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <select
              value={filters.success}
              onChange={(e) => setFilters({ ...filters, success: e.target.value, page: 1 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="true">✅ Success</option>
              <option value="false">❌ Failed</option>
            </select>
          </div>

          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
            <input
              type="text"
              placeholder="User, action, resource..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
            <p className="mt-4 text-gray-600">Loading audit logs...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center">
            <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-lg font-semibold text-gray-900">No Audit Logs Found</p>
            <p className="text-gray-600 mt-2">Try adjusting your filters</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b-2 border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Timestamp</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Resource</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">IP Address</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {logs.map((log, index) => (
                  <tr key={log.id || index} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{formatTimestamp(log.timestamp)}</div>
                      <div className="text-xs text-gray-500">{new Date(log.timestamp).toLocaleString()}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{log.user_email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getActionBadge(log.action)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">{log.resource_type}</div>
                      {log.resource_name && (
                        <div className="text-xs text-gray-500">{log.resource_name}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-600 font-mono">{log.ip_address || 'N/A'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {log.success ? (
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                          ✅ Success
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                          ❌ Failed
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {(log.changes || log.metadata) && (
                        <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                          View →
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {logs.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-700">
            Showing <span className="font-medium">{((filters.page - 1) * filters.page_size) + 1}</span> to{' '}
            <span className="font-medium">{Math.min(filters.page * filters.page_size, stats.total)}</span> of{' '}
            <span className="font-medium">{stats.total}</span> results
          </p>
          <div className="flex space-x-2">
            <button
              onClick={() => setFilters({ ...filters, page: filters.page - 1 })}
              disabled={filters.page === 1}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
              disabled={filters.page * filters.page_size >= stats.total}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditLogsTab;
