import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import apiClient from '../services/api.service';

/**
 * PFD Analysis Console - Phase 1
 * Display comprehensive PFD analysis before P&ID generation
 */
const PFDAnalysisConsole = () => {
  const { documentId } = useParams();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState('');
  const [selectedModules, setSelectedModules] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    loadAnalysis();
  }, [documentId]);

  const loadAnalysis = async () => {
    try {
      setLoading(true);
      // Try to get existing analysis first
      const response = await apiClient.get(`/pfd/documents/${documentId}/get_analysis/`);
      setAnalysis(response.data);
      // Pre-select all modules
      setSelectedModules(response.data.modules?.map(m => m.module_id) || []);
      setLoading(false);
    } catch (err) {
      if (err.response?.status === 404) {
        // No analysis exists, trigger it
        runAnalysis();
      } else {
        setError('Failed to load analysis');
        setLoading(false);
      }
    }
  };

  const runAnalysis = async () => {
    try {
      setAnalyzing(true);
      setError('');
      const response = await apiClient.post(`/pfd/documents/${documentId}/analyze/`);
      setAnalysis(response.data);
      setSelectedModules(response.data.modules?.map(m => m.module_id) || []);
      setAnalyzing(false);
    } catch (err) {
      setError(err.response?.data?.detail || 'Analysis failed');
      setAnalyzing(false);
    }
  };

  const toggleModuleSelection = (moduleId) => {
    setSelectedModules(prev => 
      prev.includes(moduleId) 
        ? prev.filter(id => id !== moduleId)
        : [...prev, moduleId]
    );
  };

  const proceedToPIDGeneration = () => {
    // Navigate to P&ID generation with selected modules
    navigate(`/pfd/convert/${documentId}`, {
      state: { 
        analysis,
        selectedModules 
      }
    });
  };

  if (loading || analyzing) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-purple-600 mb-4"></div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {analyzing ? 'Analyzing PFD Document...' : 'Loading Analysis...'}
          </h2>
          <p className="text-gray-600">
            {analyzing ? 'AI is identifying modules, connectivity, and complexity' : 'Please wait'}
          </p>
        </div>
      </div>
    );
  }

  if (error && !analysis) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-purple-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md">
          <div className="text-red-500 text-center mb-4">
            <svg className="h-16 w-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h2 className="text-2xl font-bold mb-2">Analysis Failed</h2>
            <p className="text-gray-600">{error}</p>
          </div>
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!analysis) return null;

  const complexity = analysis.complexity_analysis || {};
  const modules = analysis.modules || [];
  const connectivity = analysis.connectivity || {};

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-purple-50 py-6 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center text-purple-600 hover:text-purple-800 mb-4"
          >
            <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Dashboard
          </button>
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-2">
                PFD Analysis Console
              </h1>
              <p className="text-gray-600">Phase 1: Understanding your Process Flow Diagram</p>
              <p className="text-sm text-gray-500 mt-1">Document: {analysis.document_name}</p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-purple-600">{analysis.module_count}</div>
              <div className="text-sm text-gray-600">Modules Identified</div>
            </div>
          </div>
        </div>

        {/* Key Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Modules</p>
                <p className="text-2xl font-bold text-purple-600">{analysis.module_count}</p>
              </div>
              <svg className="h-10 w-10 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Complexity</p>
                <p className={`text-2xl font-bold ${
                  complexity.overall_complexity === 'High' ? 'text-red-600' :
                  complexity.overall_complexity === 'Medium' ? 'text-yellow-600' :
                  'text-green-600'
                }`}>
                  {complexity.overall_complexity || 'N/A'}
                </p>
              </div>
              <svg className="h-10 w-10 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Recommended P&IDs</p>
                <p className="text-2xl font-bold text-blue-600">{analysis.recommended_pids}</p>
              </div>
              <svg className="h-10 w-10 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Equipment</p>
                <p className="text-2xl font-bold text-green-600">{complexity.total_equipment_estimate || 'N/A'}</p>
              </div>
              <svg className="h-10 w-10 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              {[
                { id: 'overview', label: 'Overview', icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z' },
                { id: 'modules', label: `Modules (${modules.length})`, icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10' },
                { id: 'connectivity', label: 'Connectivity', icon: 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1' },
                { id: 'recommendations', label: 'P&ID Strategy', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-purple-600 text-purple-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={tab.icon} />
                  </svg>
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Analysis Summary</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Document:</span>
                      <span className="ml-2 font-medium text-gray-900">{analysis.document_name}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Total Modules:</span>
                      <span className="ml-2 font-medium text-gray-900">{analysis.module_count}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Complexity Score:</span>
                      <span className="ml-2 font-medium text-gray-900">{complexity.complexity_score}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Total Connections:</span>
                      <span className="ml-2 font-medium text-gray-900">{complexity.total_connections || 0}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Safety Critical Modules:</span>
                      <span className="ml-2 font-medium text-red-600">{complexity.safety_critical_modules?.length || 0}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">High Complexity Modules:</span>
                      <span className="ml-2 font-medium text-yellow-600">{complexity.high_complexity_modules?.length || 0}</span>
                    </div>
                  </div>
                </div>

                {/* Process Flow Visualization */}
                {connectivity.main_process_flow && connectivity.main_process_flow.length > 0 && (
                  <div className="bg-white border-2 border-gray-200 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Main Process Flow</h3>
                    <div className="flex items-center space-x-2 overflow-x-auto pb-4">
                      {connectivity.main_process_flow.map((moduleId, idx) => {
                        const module = modules.find(m => m.module_id === moduleId);
                        return (
                          <React.Fragment key={moduleId}>
                            <div className="flex-shrink-0 bg-purple-100 border-2 border-purple-300 rounded-lg px-4 py-3 text-center min-w-[140px]">
                              <div className="text-xs text-purple-600 font-semibold">{moduleId}</div>
                              <div className="text-sm font-medium text-gray-900 mt-1">{module?.module_name || 'Unknown'}</div>
                            </div>
                            {idx < connectivity.main_process_flow.length - 1 && (
                              <svg className="h-6 w-6 text-purple-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                              </svg>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Modules Tab */}
            {activeTab === 'modules' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Identified Modules</h3>
                  <button
                    onClick={() => {
                      if (selectedModules.length === modules.length) {
                        setSelectedModules([]);
                      } else {
                        setSelectedModules(modules.map(m => m.module_id));
                      }
                    }}
                    className="text-sm text-purple-600 hover:text-purple-800 font-medium"
                  >
                    {selectedModules.length === modules.length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>
                
                <div className="grid grid-cols-1 gap-4">
                  {modules.map(module => (
                    <div
                      key={module.module_id}
                      className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                        selectedModules.includes(module.module_id)
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                      onClick={() => toggleModuleSelection(module.module_id)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <input
                              type="checkbox"
                              checked={selectedModules.includes(module.module_id)}
                              onChange={() => {}}
                              className="h-5 w-5 text-purple-600 rounded"
                            />
                            <span className="text-xs font-semibold text-purple-600 bg-purple-100 px-2 py-1 rounded">
                              {module.module_id}
                            </span>
                            <h4 className="text-lg font-semibold text-gray-900">{module.module_name}</h4>
                            <span className={`text-xs px-2 py-1 rounded ${
                              module.complexity_level === 'High' ? 'bg-red-100 text-red-700' :
                              module.complexity_level === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-green-100 text-green-700'
                            }`}>
                              {module.complexity_level} Complexity
                            </span>
                            {module.safety_critical && (
                              <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">Safety Critical</span>
                            )}
                          </div>
                          
                          <div className="ml-8 space-y-2 text-sm">
                            <div>
                              <span className="text-gray-600">Type:</span>
                              <span className="ml-2 font-medium">{module.module_type}</span>
                            </div>
                            <div>
                              <span className="text-gray-600">Function:</span>
                              <span className="ml-2 text-gray-700">{module.primary_function}</span>
                            </div>
                            <div>
                              <span className="text-gray-600">Equipment Count:</span>
                              <span className="ml-2 font-medium">{module.estimated_equipment_count}</span>
                            </div>
                            <div>
                              <span className="text-gray-600">Key Equipment:</span>
                              <span className="ml-2 text-gray-700">{module.key_equipment?.join(', ')}</span>
                            </div>
                            {module.utilities_required && module.utilities_required.length > 0 && (
                              <div>
                                <span className="text-gray-600">Utilities:</span>
                                <span className="ml-2 text-gray-700">{module.utilities_required.join(', ')}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Connectivity Tab */}
            {activeTab === 'connectivity' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Module Connections</h3>
                  <div className="space-y-3">
                    {connectivity.connections && connectivity.connections.length > 0 ? (
                      connectivity.connections.map((conn, idx) => (
                        <div key={idx} className="flex items-center bg-gray-50 rounded-lg p-4">
                          <div className="flex-1 flex items-center space-x-4">
                            <div className="bg-purple-100 text-purple-700 font-semibold px-3 py-2 rounded text-sm">
                              {conn.from_module}
                            </div>
                            <svg className="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                            </svg>
                            <div className="flex-1">
                              <div className="text-sm font-medium text-gray-900">{conn.stream_name}</div>
                              <div className="text-xs text-gray-500">{conn.stream_type}</div>
                            </div>
                            <svg className="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                            </svg>
                            <div className="bg-blue-100 text-blue-700 font-semibold px-3 py-2 rounded text-sm">
                              {conn.to_module}
                            </div>
                            {conn.is_critical && (
                              <span className="bg-red-100 text-red-700 text-xs px-2 py-1 rounded">Critical</span>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center text-gray-500 py-8">
                        No connections data available
                      </div>
                    )}
                  </div>
                </div>

                {connectivity.utility_connections && Object.keys(connectivity.utility_connections).length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Utility Connections</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {Object.entries(connectivity.utility_connections).map(([utility, moduleIds]) => (
                        <div key={utility} className="bg-green-50 border border-green-200 rounded-lg p-4">
                          <div className="font-semibold text-green-800 mb-2 capitalize">{utility.replace('_', ' ')}</div>
                          <div className="flex flex-wrap gap-2">
                            {moduleIds.map(moduleId => (
                              <span key={moduleId} className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded">
                                {moduleId}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Recommendations Tab */}
            {activeTab === 'recommendations' && (
              <div className="space-y-6">
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Recommended P&ID Strategy</h3>
                  <p className="text-gray-700 mb-4">
                    Strategy: <span className="font-semibold">{analysis.coverage_plan?.strategy}</span>
                  </p>
                  <p className="text-sm text-gray-600">
                    Based on the analysis, we recommend creating <span className="font-semibold text-purple-600">{analysis.recommended_pids} P&ID(s)</span> for optimal coverage and clarity.
                  </p>
                </div>

                <div className="space-y-4">
                  {analysis.coverage_plan?.plan?.map((pidPlan, idx) => (
                    <div key={idx} className="border-2 border-gray-200 rounded-lg p-6 bg-white">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h4 className="text-lg font-semibold text-gray-900">{pidPlan.pid_number}: {pidPlan.pid_title}</h4>
                          <p className="text-sm text-gray-600 mt-1">{pidPlan.rationale}</p>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-purple-600">{pidPlan.estimated_equipment}</div>
                          <div className="text-xs text-gray-600">Equipment Items</div>
                        </div>
                      </div>
                      
                      <div>
                        <div className="text-sm text-gray-600 mb-2">Modules Covered:</div>
                        <div className="flex flex-wrap gap-2">
                          {pidPlan.modules_covered?.map(moduleId => {
                            const module = modules.find(m => m.module_id === moduleId);
                            return (
                              <div key={moduleId} className="bg-purple-100 text-purple-700 px-3 py-2 rounded text-sm">
                                <div className="font-semibold">{moduleId}</div>
                                <div className="text-xs">{module?.module_name}</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Ready to Generate P&IDs?</h3>
              <p className="text-sm text-gray-600">
                {selectedModules.length} of {modules.length} modules selected for P&ID generation
              </p>
            </div>
            <div className="flex space-x-4">
              <button
                onClick={() => navigate('/dashboard')}
                className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
              >
                Save & Exit
              </button>
              <button
                onClick={proceedToPIDGeneration}
                disabled={selectedModules.length === 0}
                className="px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed font-medium transition-all shadow-lg flex items-center space-x-2"
              >
                <span>Proceed to Phase 2: P&ID Generation</span>
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PFDAnalysisConsole;
