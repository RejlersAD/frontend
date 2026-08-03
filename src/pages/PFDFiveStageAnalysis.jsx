import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import apiClient from '../services/api.service';

/**
 * PFD Five Stage Analysis Page
 * Displays comprehensive 5-stage analysis of PFD documents
 * 
 * Stages:
 * 1. Module Identification
 * 2. Module Details
 * 3. PID Complexity Analysis
 * 4. Module Coverage
 * 5. Connectivity Analysis
 */
const PFDFiveStageAnalysis = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [document, setDocument] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [activeStage, setActiveStage] = useState(1);
  const [error, setError] = useState('');

  useEffect(() => {
    if (id) {
      fetchDocument();
      fetchAnalysis();
    }
  }, [id]);

  const fetchDocument = async () => {
    try {
      const response = await apiClient.get(`/pfd/documents/${id}/`);
      setDocument(response.data);
    } catch (err) {
      setError('Failed to load document');
      console.error(err);
    }
  };

  const fetchAnalysis = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get(`/pfd/documents/${id}/get_analysis/`);
      setAnalysis(response.data);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching analysis:', err);
      setLoading(false);
    }
  };

  const startAnalysis = async () => {
    try {
      setAnalyzing(true);
      setError('');
      
      const response = await apiClient.post(`/pfd/documents/${id}/analyze_five_stages/`);
      
      if (response.data.success) {
        // Refresh analysis data
        await fetchAnalysis();
        await fetchDocument();
      } else {
        setError('Analysis failed');
      }
      
      setAnalyzing(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to start analysis');
      setAnalyzing(false);
    }
  };

  const renderStageNav = () => {
    const stages = [
      { number: 1, title: 'Module Identification', icon: '🎯' },
      { number: 2, title: 'Module Details', icon: '📝' },
      { number: 3, title: 'Complexity Analysis', icon: '🔍' },
      { number: 4, title: 'Module Coverage', icon: '📑' },
      { number: 5, title: 'Connectivity', icon: '🔗' }
    ];

    return (
      <div className="flex space-x-2 mb-6 overflow-x-auto pb-2">
        {stages.map((stage) => (
          <button
            key={stage.number}
            onClick={() => setActiveStage(stage.number)}
            className={`flex-shrink-0 px-6 py-3 rounded-lg font-medium transition-all ${
              activeStage === stage.number
                ? 'bg-blue-600 text-white shadow-lg'
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
            }`}
          >
            <div className="flex items-center space-x-2">
              <span className="text-2xl">{stage.icon}</span>
              <div className="text-left">
                <div className="text-xs opacity-75">Stage {stage.number}</div>
                <div className="text-sm">{stage.title}</div>
              </div>
            </div>
          </button>
        ))}
      </div>
    );
  };

  const renderStage1 = () => {
    const stage1 = analysis?.stage1_module_identification || {};
    const modules = stage1.modules || [];
    const summary = stage1.module_summary || {};

    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-lg border border-blue-200">
          <h3 className="text-2xl font-bold text-gray-900 mb-4">
            🎯 Stage 1: Module Identification
          </h3>
          <p className="text-gray-700 mb-4">
            Identified <span className="font-bold text-blue-600">{stage1.total_modules || 0}</span> modules from the PFD
          </p>
          
          {/* Module Summary */}
          {Object.keys(summary).length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
              {Object.entries(summary).map(([type, count]) => (
                <div key={type} className="bg-white p-4 rounded-lg shadow">
                  <div className="text-3xl font-bold text-blue-600">{count}</div>
                  <div className="text-xs text-gray-600 capitalize">{type.replace('_', ' ')}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modules List */}
        <div className="grid gap-4">
          {modules.map((module, idx) => (
            <div key={idx} className="bg-white p-6 rounded-lg border border-gray-200 hover:shadow-lg transition-shadow">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h4 className="text-xl font-bold text-gray-900">{module.module_id}</h4>
                  <p className="text-sm text-gray-600">{module.module_type}</p>
                </div>
                <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                  {module.location}
                </span>
              </div>
              
              <p className="text-gray-700 mb-3">{module.name}</p>
              <p className="text-sm text-gray-600 mb-4"><strong>Function:</strong> {module.function}</p>
              
              <div className="grid md:grid-cols-2 gap-4 text-sm">
                {module.operating_pressure && (
                  <div className="flex items-center space-x-2">
                    <span className="text-gray-500">Pressure:</span>
                    <span className="font-medium">{module.operating_pressure}</span>
                  </div>
                )}
                {module.operating_temperature && (
                  <div className="flex items-center space-x-2">
                    <span className="text-gray-500">Temperature:</span>
                    <span className="font-medium">{module.operating_temperature}</span>
                  </div>
                )}
              </div>
              
              {module.key_equipment && module.key_equipment.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="text-sm text-gray-600 mb-2">Key Equipment:</div>
                  <div className="flex flex-wrap gap-2">
                    {module.key_equipment.map((eq, i) => (
                      <span key={i} className="px-2 py-1 bg-gray-100 rounded text-xs">
                        {eq}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderStage2 = () => {
    const stage2 = analysis?.stage2_module_details || {};
    const moduleDetails = stage2.module_details || [];

    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-6 rounded-lg border border-green-200">
          <h3 className="text-2xl font-bold text-gray-900 mb-4">
            📝 Stage 2: Detailed Module Understanding
          </h3>
          <p className="text-gray-700">
            Comprehensive specifications for <span className="font-bold text-green-600">{moduleDetails.length}</span> modules
          </p>
        </div>

        {moduleDetails.map((module, idx) => (
          <div key={idx} className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
            <h4 className="text-xl font-bold text-gray-900 mb-6 pb-4 border-b">
              {module.module_id}
            </h4>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Equipment */}
              {module.equipment && module.equipment.length > 0 && (
                <div>
                  <h5 className="font-semibold text-gray-900 mb-3 flex items-center">
                    <span className="mr-2">⚙️</span> Equipment ({module.equipment.length})
                  </h5>
                  <div className="space-y-2">
                    {module.equipment.map((eq, i) => (
                      <div key={i} className="bg-gray-50 p-3 rounded text-sm">
                        <div className="font-medium">{eq.tag}</div>
                        <div className="text-gray-600">{eq.type}</div>
                        {eq.size && <div className="text-xs text-gray-500">Size: {eq.size}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Instruments */}
              {module.instruments && module.instruments.length > 0 && (
                <div>
                  <h5 className="font-semibold text-gray-900 mb-3 flex items-center">
                    <span className="mr-2">📊</span> Instrumentation ({module.instruments.length})
                  </h5>
                  <div className="space-y-2">
                    {module.instruments.map((inst, i) => (
                      <div key={i} className="bg-blue-50 p-3 rounded text-sm">
                        <div className="font-medium">{inst.tag}</div>
                        <div className="text-gray-600">{inst.type}</div>
                        {inst.range && <div className="text-xs text-gray-500">Range: {inst.range}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Piping */}
              {module.piping && module.piping.length > 0 && (
                <div>
                  <h5 className="font-semibold text-gray-900 mb-3 flex items-center">
                    <span className="mr-2">🔧</span> Piping ({module.piping.length})
                  </h5>
                  <div className="space-y-2">
                    {module.piping.map((pipe, i) => (
                      <div key={i} className="bg-orange-50 p-3 rounded text-sm">
                        <div className="font-medium">{pipe.line_number}</div>
                        <div className="text-gray-600">{pipe.size} - {pipe.material}</div>
                        <div className="text-xs text-gray-500">Service: {pipe.service}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Utilities */}
              {module.utilities && module.utilities.length > 0 && (
                <div>
                  <h5 className="font-semibold text-gray-900 mb-3 flex items-center">
                    <span className="mr-2">⚡</span> Utilities Required
                  </h5>
                  <div className="flex flex-wrap gap-2">
                    {module.utilities.map((util, i) => (
                      <span key={i} className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-xs">
                        {util}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Design Parameters */}
            {module.design_parameters && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <h5 className="font-semibold text-gray-900 mb-3">Design Parameters</h5>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  {Object.entries(module.design_parameters).map(([key, value]) => (
                    <div key={key}>
                      <div className="text-gray-500 text-xs capitalize">{key.replace('_', ' ')}</div>
                      <div className="font-medium">{value}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  const renderStage3 = () => {
    const stage3 = analysis?.stage3_pid_complexity || {};
    const factors = stage3.complexity_factors || {};

    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-yellow-50 to-orange-50 p-6 rounded-lg border border-yellow-200">
          <h3 className="text-2xl font-bold text-gray-900 mb-4">
            🔍 Stage 3: Complexity Analysis
          </h3>
          
          <div className="grid md:grid-cols-3 gap-6 mt-6">
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="text-4xl font-bold text-orange-600 mb-2">
                {stage3.pids_needed || 0}
              </div>
              <div className="text-gray-700">P&IDs Required</div>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="text-4xl font-bold text-blue-600 mb-2">
                {stage3.complexity_level || 'N/A'}
              </div>
              <div className="text-gray-700">Complexity Level</div>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="text-4xl font-bold text-green-600 mb-2">
                {stage3.total_modules || 0}
              </div>
              <div className="text-gray-700">Total Modules</div>
            </div>
          </div>
        </div>

        {/* Complexity Factors */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h4 className="font-semibold text-gray-900 mb-4">Complexity Factors</h4>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{factors.module_count || 0}</div>
              <div className="text-sm text-gray-600">Module Count</div>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{stage3.total_equipment || 0}</div>
              <div className="text-sm text-gray-600">Equipment Items</div>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">{stage3.total_instruments || 0}</div>
              <div className="text-sm text-gray-600">Instruments</div>
            </div>
            <div className="p-4 bg-orange-50 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">{stage3.total_piping_lines || 0}</div>
              <div className="text-sm text-gray-600">Piping Lines</div>
            </div>
          </div>
        </div>

        {/* Recommendation */}
        {stage3.recommendation && (
          <div className="bg-green-50 p-6 rounded-lg border border-green-200">
            <h4 className="font-semibold text-green-900 mb-2 flex items-center">
              <span className="mr-2">💡</span> Recommendation
            </h4>
            <p className="text-green-800">{stage3.recommendation}</p>
          </div>
        )}

        {/* Drawing Split Strategy */}
        {stage3.drawing_split_strategy && stage3.drawing_split_strategy.length > 0 && (
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <h4 className="font-semibold text-gray-900 mb-4">Drawing Split Strategy</h4>
            <div className="space-y-3">
              {stage3.drawing_split_strategy.map((strategy, idx) => (
                <div key={idx} className="flex items-center p-4 bg-gray-50 rounded-lg">
                  <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold mr-4">
                    {strategy.pid_number}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">P&ID #{strategy.pid_number}</div>
                    <div className="text-sm text-gray-600">
                      {strategy.suggested_modules} modules - Focus: {strategy.focus}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderStage4 = () => {
    const stage4 = analysis?.stage4_module_coverage || {};
    const pidCoverage = stage4.pid_coverage || [];

    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-6 rounded-lg border border-purple-200">
          <h3 className="text-2xl font-bold text-gray-900 mb-4">
            📑 Stage 4: Module Coverage Mapping
          </h3>
          <p className="text-gray-700">
            Distribution of <span className="font-bold text-purple-600">{stage4.coverage_summary?.total_modules || 0}</span> modules across <span className="font-bold text-purple-600">{stage4.total_pids || 0}</span> P&ID drawings
          </p>
        </div>

        {/* P&ID Coverage Cards */}
        <div className="grid gap-6">
          {pidCoverage.map((pid, idx) => (
            <div key={idx} className="bg-white p-6 rounded-lg border-2 border-purple-200 hover:shadow-xl transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h4 className="text-2xl font-bold text-gray-900">{pid.pid_number}</h4>
                  <p className="text-lg text-gray-700">{pid.drawing_title}</p>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-purple-600">{pid.module_count}</div>
                  <div className="text-sm text-gray-600">Modules</div>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4 mb-4">
                <div className="p-3 bg-blue-50 rounded">
                  <div className="text-sm text-gray-600">Primary Function</div>
                  <div className="font-medium">{pid.primary_function}</div>
                </div>
                <div className="p-3 bg-green-50 rounded">
                  <div className="text-sm text-gray-600">Process Area</div>
                  <div className="font-medium">{pid.process_area}</div>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-200">
                <h5 className="font-semibold text-gray-900 mb-3">Modules Covered:</h5>
                <div className="flex flex-wrap gap-2">
                  {pid.modules_covered && pid.modules_covered.map((moduleId, i) => (
                    <span key={i} className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-medium">
                      {moduleId}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-4 text-sm text-gray-600">
                Equipment Count: <span className="font-medium text-gray-900">{pid.equipment_count || 0}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderStage5 = () => {
    const stage5 = analysis?.stage5_connectivity || {};
    const connections = stage5.process_connections || [];
    const utilityConnections = stage5.utility_connections || {};
    const criticalPaths = stage5.critical_paths || [];

    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-indigo-50 to-blue-50 p-6 rounded-lg border border-indigo-200">
          <h3 className="text-2xl font-bold text-gray-900 mb-4">
            🔗 Stage 5: Connectivity Analysis
          </h3>
          <div className="grid md:grid-cols-3 gap-4 mt-4">
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="text-3xl font-bold text-indigo-600">{stage5.total_connections || 0}</div>
              <div className="text-sm text-gray-600">Process Connections</div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="text-3xl font-bold text-blue-600">{Object.keys(utilityConnections).length}</div>
              <div className="text-sm text-gray-600">Utility Systems</div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="text-3xl font-bold text-green-600">{criticalPaths.length}</div>
              <div className="text-sm text-gray-600">Critical Paths</div>
            </div>
          </div>
        </div>

        {/* Process Connections */}
        {connections.length > 0 && (
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <h4 className="font-semibold text-gray-900 mb-4 flex items-center">
              <span className="mr-2">🔀</span> Process Connections ({connections.length})
            </h4>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {connections.map((conn, idx) => (
                <div key={idx} className="flex items-center p-3 bg-gray-50 rounded-lg hover:bg-indigo-50 transition-colors">
                  <div className="flex-1 flex items-center space-x-3">
                    <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded font-medium text-sm">
                      {conn.from_module}
                    </span>
                    <span className="text-gray-400">→</span>
                    <span className="px-3 py-1 bg-green-100 text-green-800 rounded font-medium text-sm">
                      {conn.to_module}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">{conn.connection_type}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Utility Connections */}
        {Object.keys(utilityConnections).length > 0 && (
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <h4 className="font-semibold text-gray-900 mb-4 flex items-center">
              <span className="mr-2">⚡</span> Utility Connections
            </h4>
            <div className="grid md:grid-cols-2 gap-4">
              {Object.entries(utilityConnections).map(([utility, modules]) => (
                <div key={utility} className="p-4 bg-purple-50 rounded-lg">
                  <h5 className="font-medium text-purple-900 mb-2">{utility}</h5>
                  <div className="flex flex-wrap gap-2">
                    {modules.map((module, i) => (
                      <span key={i} className="px-2 py-1 bg-white text-purple-800 rounded text-xs">
                        {module}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Critical Paths */}
        {criticalPaths.length > 0 && (
          <div className="bg-orange-50 p-6 rounded-lg border border-orange-200">
            <h4 className="font-semibold text-orange-900 mb-4 flex items-center">
              <span className="mr-2">⚠️</span> Critical Process Paths
            </h4>
            <div className="space-y-3">
              {criticalPaths.map((path, idx) => (
                <div key={idx} className="bg-white p-4 rounded-lg">
                  <div className="font-medium text-gray-900 mb-2">{path.description}</div>
                  <div className="flex flex-wrap gap-2">
                    {path.modules && path.modules.map((module, i) => (
                      <span key={i} className="px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-sm">
                        {module}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Isolated Modules Warning */}
        {stage5.isolated_modules && stage5.isolated_modules.length > 0 && (
          <div className="bg-red-50 p-6 rounded-lg border border-red-200">
            <h4 className="font-semibold text-red-900 mb-2 flex items-center">
              <span className="mr-2">⚠️</span> Isolated Modules ({stage5.isolated_modules.length})
            </h4>
            <p className="text-red-700 text-sm mb-3">
              These modules have no identified connections and may require review
            </p>
            <div className="flex flex-wrap gap-2">
              {stage5.isolated_modules.map((module, i) => (
                <span key={i} className="px-3 py-1 bg-red-100 text-red-800 rounded font-medium text-sm">
                  {module}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading analysis...</p>
        </div>
      </div>
    );
  }

  const hasAnalysis = analysis && (
    analysis.stage1_module_identification || 
    analysis.stage2_module_details || 
    analysis.stage3_pid_complexity || 
    analysis.stage4_module_coverage || 
    analysis.stage5_connectivity
  );

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate('/pfd/history')}
          className="text-blue-600 hover:text-blue-800 mb-4 flex items-center"
        >
          ← Back to History
        </button>
        
        <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            5-Stage PFD Analysis
          </h1>
          {document && (
            <div className="flex items-center space-x-4 text-sm text-gray-600">
              <span>Document: <strong>{document.document_number}</strong></span>
              <span>•</span>
              <span>Project: <strong>{document.project_name}</strong></span>
              <span>•</span>
              <span className={`px-3 py-1 rounded-full ${
                document.status === 'analyzed' ? 'bg-green-100 text-green-800' :
                document.status === 'analyzing' ? 'bg-yellow-100 text-yellow-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {document.status}
              </span>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
          {error}
        </div>
      )}

      {/* Analysis Controls */}
      {!hasAnalysis && (
        <div className="mb-8 bg-blue-50 p-8 rounded-lg border border-blue-200 text-center">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">
            Start 5-Stage Analysis
          </h3>
          <p className="text-gray-700 mb-6">
            This will analyze the PFD document through 5 comprehensive stages using advanced AI models
          </p>
          <button
            onClick={startAnalysis}
            disabled={analyzing}
            className="px-8 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {analyzing ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Analyzing...
              </span>
            ) : (
              '🚀 Start Analysis'
            )}
          </button>
        </div>
      )}

      {/* Analysis Results */}
      {hasAnalysis && (
        <>
          {/* Progress Bar */}
          {analysis.analysis_progress !== undefined && (
            <div className="mb-6 bg-white p-4 rounded-lg shadow">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700">
                  Analysis Progress: Stage {analysis.analysis_stage}/5
                </span>
                <span className="text-sm font-medium text-blue-600">
                  {analysis.analysis_progress}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-blue-600 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${analysis.analysis_progress}%` }}
                ></div>
              </div>
            </div>
          )}

          {/* Stage Navigation */}
          {renderStageNav()}

          {/* Stage Content */}
          <div className="min-h-screen">
            {activeStage === 1 && renderStage1()}
            {activeStage === 2 && renderStage2()}
            {activeStage === 3 && renderStage3()}
            {activeStage === 4 && renderStage4()}
            {activeStage === 5 && renderStage5()}
          </div>

          {/* Refresh Button */}
          <div className="mt-8 flex justify-center">
            <button
              onClick={fetchAnalysis}
              className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              🔄 Refresh Analysis
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default PFDFiveStageAnalysis;
