/**
 * DesignIQ Project Detail Page
 * Shows comprehensive details, analyses, and optimizations for a design project
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeftIcon,
  BeakerIcon,
  DocumentTextIcon,
  ChartBarIcon,
  LightBulbIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  ArrowDownTrayIcon,
  SparklesIcon,
  XCircleIcon
} from '@heroicons/react/24/outline';
import { API_BASE_URL } from '../../config/api.config';
import { STORAGE_KEYS } from '../../config/app.config';
import { usePageControls } from '../../hooks/usePageControls';
import { PageControlButtons } from '../../components/Common/PageControlButtons';

const DesignIQProjectDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState(null);
  const [analyses, setAnalyses] = useState([]);
  const [optimizations, setOptimizations] = useState([]);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [notification, setNotification] = useState(null);
  
  // Page controls
  const pageControls = usePageControls();

  useEffect(() => {
    fetchProjectDetails();
  }, [id]);

  const fetchProjectDetails = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
      
      // Fetch project details
      const projectResponse = await fetch(`${API_BASE_URL}/api/v1/designiq/projects/${id}/`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!projectResponse.ok) {
        throw new Error('Failed to fetch project details');
      }

      const projectData = await projectResponse.json();
      setProject(projectData);

      // Fetch project summary (includes analyses and optimizations stats)
      const summaryResponse = await fetch(`${API_BASE_URL}/api/v1/designiq/projects/${id}/summary/`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (summaryResponse.ok) {
        const summaryData = await summaryResponse.json();
        setSummary(summaryData);
        setAnalyses(projectData.analyses || []);
        setOptimizations(projectData.optimizations || []);
      }

    } catch (err) {
      console.error('Error fetching project details:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadInput = () => {
    if (project?.input_file) {
      window.open(project.input_file, '_blank');
    }
  };

  const handleDownloadOutput = () => {
    if (project?.output_file) {
      window.open(project.output_file, '_blank');
    }
  };

  const handleReanalyze = async () => {
    if (!project?.id) return;

    try {
      setIsAnalyzing(true);
      setNotification(null);

      const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
      
      const response = await fetch(`${API_BASE_URL}/api/v1/designiq/projects/${project.id}/analyze/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to trigger re-analysis');
      }

      const data = await response.json();
      
      setNotification({
        type: 'success',
        message: 'Re-analysis triggered successfully. The page will refresh when complete.',
      });

      // Refresh project data after a delay
      setTimeout(() => {
        fetchProjectDetails();
      }, 3000);

    } catch (err) {
      console.error('Error triggering re-analysis:', err);
      setNotification({
        type: 'error',
        message: err.message || 'Failed to trigger re-analysis',
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleExportSummary = () => {
    const summaryText = `
DesignIQ Project Summary
========================

Project: ${project.project_name}
Design Type: ${project.design_type_display}
Status: ${project.status_display}
AI Confidence Score: ${project.ai_confidence_score ? project.ai_confidence_score.toFixed(1) : 'N/A'}%

Description:
${project.description || 'N/A'}

Total Analyses: ${analyses.length}
Total Optimizations: ${optimizations.length}
Processing Time: ${project.processing_time ? project.processing_time.toFixed(1) : 'N/A'}s

Created: ${new Date(project.created_at).toLocaleString()}
Updated: ${new Date(project.updated_at).toLocaleString()}

${analyses.length > 0 ? `
ANALYSES
--------
${analyses.map((a, i) => `
${i + 1}. ${a.title || 'Analysis'}
   Severity: ${a.severity || 'N/A'}
   Status: ${a.is_resolved ? 'Resolved' : 'Open'}
   ${a.description}
   ${a.recommendation ? `Recommendation: ${a.recommendation}` : ''}
`).join('\n')}
` : ''}

${optimizations.length > 0 ? `
OPTIMIZATIONS
-------------
${optimizations.map((o, i) => `
${i + 1}. ${o.title || 'Optimization'}
   Impact: ${o.impact || 'N/A'}
   Status: ${o.is_implemented ? 'Implemented' : 'Pending'}
   ${o.description}
   ${o.estimated_savings ? `Estimated Savings: ${o.estimated_savings}` : ''}
`).join('\n')}
` : ''}
    `;

    const blob = new Blob([summaryText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.project_name.replace(/[^a-zA-Z0-9]/g, '_')}_summary.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setNotification({
      type: 'success',
      message: 'Summary exported successfully',
    });
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-300';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'low': return 'bg-blue-100 text-blue-800 border-blue-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getImpactColor = (impact) => {
    switch (impact) {
      case 'high': return 'bg-green-100 text-green-800 border-green-300';
      case 'medium': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'low': return 'bg-gray-100 text-gray-800 border-gray-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      draft: <span className="px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">Draft</span>,
      analyzing: <span className="px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800 animate-pulse">Analyzing...</span>,
      completed: <span className="px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">Completed</span>,
      failed: <span className="px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">Failed</span>,
    };
    return badges[status] || badges.draft;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading project details...</p>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 border-2 border-red-200 rounded-lg p-8 text-center">
            <XCircleIcon className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-red-900 mb-2">Error Loading Project</h2>
            <p className="text-red-700 mb-6">{error || 'Project not found'}</p>
            <button
              onClick={() => navigate('/designiq')}
              className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Apply control styles */}
      <style>{pageControls.styles}</style>

      <div className="max-w-7xl mx-auto">
        {/* Notification */}
        {notification && (
          <div className={`mb-6 rounded-lg border-2 p-4 ${
            notification.type === 'success' 
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            <div className="flex items-center gap-2">
              {notification.type === 'success' ? (
                <CheckCircleIcon className="w-5 h-5" />
              ) : (
                <XCircleIcon className="w-5 h-5" />
              )}
              <p>{notification.message}</p>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/designiq')}
              className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <ArrowLeftIcon className="w-6 h-6 text-gray-600" />
            </button>
            <div>
              <div className="flex items-center gap-3 mb-2">
                <BeakerIcon className="w-8 h-8 text-blue-600" />
                <h1 className="text-3xl font-bold text-gray-900">{project.project_name}</h1>
                {getStatusBadge(project.status)}
              </div>
              <p className="text-gray-600">{project.design_type_display}</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleExportSummary}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-2"
            >
              <ArrowDownTrayIcon className="w-5 h-5" />
              Export Summary
            </button>
            <button
              onClick={handleReanalyze}
              disabled={isAnalyzing || project.status === 'analyzing'}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <SparklesIcon className="w-5 h-5" />
              {isAnalyzing ? 'Analyzing...' : 'Re-analyze'}
            </button>
          </div>
        </div>

        {/* Additional Header Actions with Page Controls */}
        <div className="flex items-center justify-end mb-6">
          {/* Page Controls */}
          <PageControlButtons
            sidebarVisible={pageControls.sidebarVisible}
            setSidebarVisible={pageControls.toggleSidebar}
            autoRefreshEnabled={pageControls.autoRefreshEnabled}
            setAutoRefreshEnabled={pageControls.toggleAutoRefresh}
            isFullscreen={pageControls.isFullscreen}
            toggleFullscreen={pageControls.toggleFullscreen}
            isRefreshing={false}
            autoRefreshInterval={30}
          />
        </div>

        {/* Project Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {/* AI Confidence Score */}
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg shadow-md p-6 border-2 border-purple-200">
            <div className="flex items-center gap-3 mb-2">
              <SparklesIcon className="w-6 h-6 text-purple-600" />
              <span className="text-sm font-medium text-purple-800">AI Confidence</span>
            </div>
            <p className="text-3xl font-bold text-purple-700">
              {project.ai_confidence_score ? `${project.ai_confidence_score.toFixed(1)}%` : 'N/A'}
            </p>
            <div className="mt-2 bg-purple-200 rounded-full h-2 overflow-hidden">
              <div 
                className="bg-purple-600 h-full transition-all duration-500"
                style={{ width: `${project.ai_confidence_score || 0}%` }}
              />
            </div>
          </div>

          {/* Total Findings */}
          <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg shadow-md p-6 border-2 border-orange-200">
            <div className="flex items-center gap-3 mb-2">
              <ExclamationTriangleIcon className="w-6 h-6 text-orange-600" />
              <span className="text-sm font-medium text-orange-800">Total Findings</span>
            </div>
            <p className="text-3xl font-bold text-orange-700">{analyses.length}</p>
            {summary?.analyses && (
              <div className="mt-2 text-xs text-orange-700">
                <span className="font-semibold">{summary.analyses.critical || 0}</span> critical • 
                <span className="font-semibold ml-1">{summary.analyses.high || 0}</span> high
              </div>
            )}
          </div>

          {/* Optimizations */}
          <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg shadow-md p-6 border-2 border-yellow-200">
            <div className="flex items-center gap-3 mb-2">
              <LightBulbIcon className="w-6 h-6 text-yellow-600" />
              <span className="text-sm font-medium text-yellow-800">Optimizations</span>
            </div>
            <p className="text-3xl font-bold text-yellow-700">{optimizations.length}</p>
            {summary?.optimizations && (
              <div className="mt-2 text-xs text-yellow-700">
                <span className="font-semibold">{summary.optimizations.implemented || 0}</span> implemented • 
                <span className="font-semibold ml-1">{summary.optimizations.high_impact || 0}</span> high impact
              </div>
            )}
          </div>

          {/* Processing Time */}
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg shadow-md p-6 border-2 border-blue-200">
            <div className="flex items-center gap-3 mb-2">
              <ClockIcon className="w-6 h-6 text-blue-600" />
              <span className="text-sm font-medium text-blue-800">Processing Time</span>
            </div>
            <p className="text-3xl font-bold text-blue-700">
              {project.processing_time ? `${project.processing_time.toFixed(1)}s` : 'N/A'}
            </p>
            <div className="mt-2 text-xs text-blue-700">
              {new Date(project.created_at).toLocaleDateString()}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="border-b border-gray-200">
            <div className="flex">
              <button
                onClick={() => setActiveTab('overview')}
                className={`px-6 py-4 font-medium transition-colors ${
                  activeTab === 'overview'
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <DocumentTextIcon className="w-5 h-5 inline-block mr-2" />
                Overview
              </button>
              <button
                onClick={() => setActiveTab('analyses')}
                className={`px-6 py-4 font-medium transition-colors ${
                  activeTab === 'analyses'
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <ChartBarIcon className="w-5 h-5 inline-block mr-2" />
                Analyses ({analyses.length})
              </button>
              <button
                onClick={() => setActiveTab('optimizations')}
                className={`px-6 py-4 font-medium transition-colors ${
                  activeTab === 'optimizations'
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <LightBulbIcon className="w-5 h-5 inline-block mr-2" />
                Optimizations ({optimizations.length})
              </button>
            </div>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Description */}
                {project.description && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Description</h3>
                    <p className="text-gray-700 whitespace-pre-wrap">{project.description}</p>
                  </div>
                )}

                {/* Design Parameters */}
                {project.design_parameters && Object.keys(project.design_parameters).length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Design Parameters</h3>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <pre className="text-sm text-gray-700 overflow-x-auto">
                        {JSON.stringify(project.design_parameters, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}

                {/* AI Analysis Results */}
                {project.ai_analysis_results && Object.keys(project.ai_analysis_results).length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">AI Analysis Results</h3>
                    <div className="bg-blue-50 rounded-lg p-4">
                      <pre className="text-sm text-gray-700 overflow-x-auto">
                        {JSON.stringify(project.ai_analysis_results, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}

                {/* AI Recommendations */}
                {project.ai_recommendations && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">AI Recommendations</h3>
                    <div className="bg-green-50 rounded-lg p-4">
                      <p className="text-gray-700 whitespace-pre-wrap">{project.ai_recommendations}</p>
                    </div>
                  </div>
                )}

                {/* Files */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Files</h3>
                  <div className="flex gap-4">
                    {project.input_file && (
                      <button
                        onClick={handleDownloadInput}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <ArrowDownTrayIcon className="w-5 h-5" />
                        Download Input File
                      </button>
                    )}
                    {project.output_file && (
                      <button
                        onClick={handleDownloadOutput}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                      >
                        <ArrowDownTrayIcon className="w-5 h-5" />
                        Download Output File
                      </button>
                    )}
                  </div>
                </div>

                {/* Metadata */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Metadata</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-sm text-gray-600 mb-1">Created By</p>
                      <p className="font-medium text-gray-900">{project.created_by_name || 'Unknown'}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-sm text-gray-600 mb-1">Organization</p>
                      <p className="font-medium text-gray-900">{project.organization || 'N/A'}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-sm text-gray-600 mb-1">Created At</p>
                      <p className="font-medium text-gray-900">
                        {new Date(project.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-sm text-gray-600 mb-1">Updated At</p>
                      <p className="font-medium text-gray-900">
                        {new Date(project.updated_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Error Message */}
                {project.error_message && (
                  <div className="bg-red-50 border-l-4 border-red-500 p-4">
                    <div className="flex items-start">
                      <XCircleIcon className="w-6 h-6 text-red-500 mr-3 mt-0.5" />
                      <div>
                        <h4 className="text-sm font-medium text-red-900 mb-1">Error</h4>
                        <p className="text-sm text-red-700">{project.error_message}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Analyses Tab */}
            {activeTab === 'analyses' && (
              <div className="space-y-4">
                {analyses.length === 0 ? (
                  <div className="text-center py-12">
                    <ChartBarIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">No analyses available</p>
                  </div>
                ) : (
                  analyses.map((analysis, index) => (
                    <div
                      key={analysis.id || index}
                      className="bg-white border-2 border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h4 className="text-lg font-semibold text-gray-900">
                              {analysis.title || `Analysis ${index + 1}`}
                            </h4>
                            {analysis.severity && (
                              <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getSeverityColor(analysis.severity)}`}>
                                {analysis.severity.toUpperCase()}
                              </span>
                            )}
                            {analysis.is_resolved && (
                              <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-300">
                                <CheckCircleIcon className="w-4 h-4 inline mr-1" />
                                RESOLVED
                              </span>
                            )}
                          </div>
                          <p className="text-gray-700">{analysis.description}</p>
                        </div>
                      </div>

                      {analysis.recommendation && (
                        <div className="mt-3 bg-blue-50 rounded-lg p-4">
                          <p className="text-sm font-medium text-blue-900 mb-1">Recommendation</p>
                          <p className="text-sm text-blue-700">{analysis.recommendation}</p>
                        </div>
                      )}

                      {analysis.detected_values && Object.keys(analysis.detected_values).length > 0 && (
                        <div className="mt-3 bg-gray-50 rounded-lg p-4">
                          <p className="text-sm font-medium text-gray-900 mb-2">Detected Values</p>
                          <pre className="text-xs text-gray-600 overflow-x-auto">
                            {JSON.stringify(analysis.detected_values, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Optimizations Tab */}
            {activeTab === 'optimizations' && (
              <div className="space-y-4">
                {optimizations.length === 0 ? (
                  <div className="text-center py-12">
                    <LightBulbIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">No optimizations available</p>
                  </div>
                ) : (
                  optimizations.map((optimization, index) => (
                    <div
                      key={optimization.id || index}
                      className="bg-white border-2 border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h4 className="text-lg font-semibold text-gray-900">
                              {optimization.title || `Optimization ${index + 1}`}
                            </h4>
                            {optimization.impact && (
                              <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getImpactColor(optimization.impact)}`}>
                                {optimization.impact.toUpperCase()} IMPACT
                              </span>
                            )}
                            {optimization.is_implemented && (
                              <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-300">
                                <CheckCircleIcon className="w-4 h-4 inline mr-1" />
                                IMPLEMENTED
                              </span>
                            )}
                          </div>
                          <p className="text-gray-700">{optimization.description}</p>
                        </div>
                      </div>

                      {optimization.estimated_savings && (
                        <div className="mt-3 bg-green-50 rounded-lg p-4">
                          <p className="text-sm font-medium text-green-900 mb-1">Estimated Savings</p>
                          <p className="text-sm text-green-700">{optimization.estimated_savings}</p>
                        </div>
                      )}

                      {optimization.implementation_steps && (
                        <div className="mt-3 bg-blue-50 rounded-lg p-4">
                          <p className="text-sm font-medium text-blue-900 mb-2">Implementation Steps</p>
                          <p className="text-sm text-blue-700 whitespace-pre-wrap">
                            {optimization.implementation_steps}
                          </p>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DesignIQProjectDetail;
