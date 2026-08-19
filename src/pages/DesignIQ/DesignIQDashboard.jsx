/**
 * DesignIQ Dashboard - Main Entry Point
 * AI-Powered Engineering Design Intelligence
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  BeakerIcon, DocumentPlusIcon, ChartBarIcon, 
  LightBulbIcon, CheckCircleIcon, ClockIcon,
  ViewColumnsIcon, CubeIcon, LinkIcon, BellAlertIcon
} from '@heroicons/react/24/outline';
import { API_BASE_URL } from '../../config/api.config';
import { STORAGE_KEYS } from '../../config/app.config';
import { usePageControls } from '../../hooks/usePageControls';
import { PageControlButtons } from '../../components/Common/PageControlButtons';

const DesignIQDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [moduleConfig, setModuleConfig] = useState(null);

  // Page controls (Fullscreen, Sidebar, Auto-refresh)
  const pageControls = usePageControls({
    refreshCallback: () => loadDashboardData(true),
    autoRefreshInterval: 30000, // 30 seconds
    storageKey: 'designiq_dashboard',
  });

  useEffect(() => {
    loadDashboardData();
    loadModuleConfig();
  }, []);

  const loadModuleConfig = async () => {
    try {
      const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
      const response = await fetch(`${API_BASE_URL}/designiq/projects/module-config/`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const config = await response.json();
        setModuleConfig(config);
      }
    } catch (err) {
      console.error('[DesignIQ] Module config error:', err);
    }
  };

  const loadDashboardData = async (isAutoRefresh = false) => {
    if (isAutoRefresh) setIsRefreshing(true);
    else setLoading(true);
    
    try {
      const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
      const response = await fetch(`${API_BASE_URL}/designiq/projects/dashboard/`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data);
      } else {
        setError('Failed to load dashboard data');
      }
    } catch (err) {
      console.error('[DesignIQ] Dashboard error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  // Get enabled design modules from configuration
  const enabledDesignModules = moduleConfig?.design_modules?.enabled_modules || [];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Apply control styles for fullscreen and sidebar */}
      <style>{pageControls.styles}</style>

      {/* Header with Controls */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <BeakerIcon className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">DesignIQ</h1>
          </div>
          <p className="text-gray-600">AI-Powered Engineering Design Intelligence & Optimization</p>
        </div>

        {/* Page Control Buttons */}
        <PageControlButtons
          sidebarVisible={pageControls.sidebarVisible}
          setSidebarVisible={pageControls.toggleSidebar}
          autoRefreshEnabled={pageControls.autoRefreshEnabled}
          setAutoRefreshEnabled={pageControls.toggleAutoRefresh}
          isFullscreen={pageControls.isFullscreen}
          toggleFullscreen={pageControls.toggleFullscreen}
          isRefreshing={isRefreshing}
          autoRefreshInterval={30}
        />
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Projects</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.total_projects || 0}</p>
            </div>
            <DocumentPlusIcon className="w-10 h-10 text-blue-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Analyzing</p>
              <p className="text-2xl font-bold text-orange-600">{stats?.by_status?.analyzing || 0}</p>
            </div>
            <ClockIcon className="w-10 h-10 text-orange-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Completed</p>
              <p className="text-2xl font-bold text-green-600">{stats?.by_status?.completed || 0}</p>
            </div>
            <CheckCircleIcon className="w-10 h-10 text-green-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Draft</p>
              <p className="text-2xl font-bold text-gray-600">{stats?.by_status?.draft || 0}</p>
            </div>
            <ChartBarIcon className="w-10 h-10 text-gray-500" />
          </div>
        </div>
      </div>

      {/* Design Types Grid - Only show if enabled in config */}
      {moduleConfig?.features?.show_design_type_cards && enabledDesignModules.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Start New Design Analysis</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {enabledDesignModules.map((type) => (
              <button
                key={type.id}
                onClick={() => navigate(`/designiq/new?type=${type.id}`)}
                className={`bg-white rounded-lg shadow hover:shadow-lg transition-all p-6 text-left border-2 border-transparent hover:border-${type.color}-500`}
              >
                <div className="text-4xl mb-3">{type.icon}</div>
                <h3 className="font-semibold text-gray-900 mb-1">{type.name}</h3>
                <p className="text-sm text-gray-500">
                  {stats?.by_design_type?.[type.id] || 0} projects
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Engineering Lists Section - Show by default (enabled unless explicitly disabled) */}
      {(moduleConfig?.features?.show_engineering_lists !== false) && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Engineering Lists</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <button
              onClick={() => navigate('/designiq/lists?type=line_list')}
              className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg hover:shadow-xl transition-all p-6 text-left text-white"
            >
              <ViewColumnsIcon className="w-10 h-10 mb-3" />
              <h3 className="font-semibold text-lg mb-1">Line List</h3>
              <p className="text-sm opacity-90">Piping line specifications</p>
            </button>

            <button
              onClick={() => navigate('/designiq/lists?type=equipment_list')}
              className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-lg hover:shadow-xl transition-all p-6 text-left text-white"
            >
              <CubeIcon className="w-10 h-10 mb-3" />
              <h3 className="font-semibold text-lg mb-1">Equipment List</h3>
              <p className="text-sm opacity-90">Equipment specifications</p>
            </button>

            <button
              onClick={() => navigate('/designiq/lists?type=tie_in_list')}
              className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow-lg hover:shadow-xl transition-all p-6 text-left text-white"
            >
              <LinkIcon className="w-10 h-10 mb-3" />
              <h3 className="font-semibold text-lg mb-1">Tie-In List</h3>
              <p className="text-sm opacity-90">Connection specifications</p>
            </button>

            <button
              onClick={() => navigate('/designiq/lists?type=alarm_trip_list')}
              className="bg-gradient-to-br from-red-500 to-red-600 rounded-lg shadow-lg hover:shadow-xl transition-all p-6 text-left text-white"
            >
              <BellAlertIcon className="w-10 h-10 mb-3" />
              <h3 className="font-semibold text-lg mb-1">Alarm/Trip List</h3>
              <p className="text-sm opacity-90">Safety alarm setpoints</p>
            </button>
          </div>
        </div>
      )}

      {/* Recent Projects */}
      {stats?.recent_projects && stats.recent_projects.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Projects</h2>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Project Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Design Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    AI Score
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {stats.recent_projects.map((project) => (
                  <tr key={project.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{project.project_name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{project.design_type_display}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                        ${project.status === 'completed' ? 'bg-green-100 text-green-800' : ''}
                        ${project.status === 'analyzing' ? 'bg-yellow-100 text-yellow-800' : ''}
                        ${project.status === 'draft' ? 'bg-gray-100 text-gray-800' : ''}
                        ${project.status === 'failed' ? 'bg-red-100 text-red-800' : ''}
                      `}>
                        {project.status_display}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{project.ai_confidence_score.toFixed(1)}%</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(project.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => navigate(`/designiq/projects/${project.id}`)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="mt-8 flex gap-4">
        <button
          onClick={() => navigate('/designiq/projects')}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          View All Projects
        </button>
        <button
          onClick={() => navigate('/designiq/templates')}
          className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
        >
          Browse Templates
        </button>
      </div>
    </div>
  );
};

export default DesignIQDashboard;
